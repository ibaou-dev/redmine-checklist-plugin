# Adds an optional "Checklist" column to the issue list / saved queries.
#
# The column is non-sortable text (e.g. "3/5 (60%)") sourced from
# Issue#checklist_progress, so it also exports cleanly to CSV/PDF. It is opt-in:
# users add it to a query's columns; issues with no checklist tasks show blank.
#
# Applied via prepend at require-time (mirroring issue_patch.rb).

module RedmineChecklist
  module Patches
    module IssueQueryPatch
      # Register our extra filters (the built-in assigned_to_id filter is extended
      # separately, via sql_for_assigned_to_id_field below — no new UI filter for
      # it, on purpose: checklist assignees fold into the EXISTING assignee filter).
      def initialize_available_filters
        super
        add_available_filter('checklist_due_date',
                             type:  :date,
                             label: :label_checklist_due_column)
      end

      # Fold checklist-item assignees into the native "assigned to" filter (unless
      # the kill-switch is off). "me" and group ids are already resolved into
      # +value+ by Query#statement before we get here. Handles every operator:
      #   =  (is)   → issue is one of value OR has a checklist item assigned to one
      #   !  (isn't)→ issue isn't one of value AND has no such checklist item
      #   *  (any)  → issue is assigned OR has any assigned checklist item
      #   !* (none) → issue is unassigned AND has no assigned checklist item
      def sql_for_assigned_to_id_field(field, operator, value)
        issue_sql = sql_for_field(field, operator, value, Issue.table_name, 'assigned_to_id')
        return "(#{issue_sql})" unless RedmineChecklist.include_checklist_assignee?

        cl = ChecklistItem.table_name
        f  = IssueQueryPatch.sql_false
        # issues that have a (non-section) checklist item assigned to one of `value`
        in_cl = "#{Issue.table_name}.id IN (SELECT #{cl}.issue_id FROM #{cl} " \
                "WHERE #{cl}.is_section = #{f} AND " +
                sql_for_field(field, '=', value, cl, 'assignee_id') + ')'
        # issues that have any assigned (non-section) checklist item
        any_cl = "#{Issue.table_name}.id IN (SELECT #{cl}.issue_id FROM #{cl} " \
                 "WHERE #{cl}.is_section = #{f} AND #{cl}.assignee_id IS NOT NULL)"

        case operator
        when '='  then "((#{issue_sql}) OR (#{in_cl}))"
        when '!'  then "((#{issue_sql}) AND NOT (#{in_cl}))"
        when '*'  then "((#{issue_sql}) OR (#{any_cl}))"
        when '!*' then "((#{issue_sql}) AND NOT (#{any_cl}))"
        else           "(#{issue_sql})"
        end
      end

      # Filter issues by their checklist items' due dates (open, non-converted).
      def sql_for_checklist_due_date_field(field, operator, value)
        cl = ChecklistItem.table_name
        f  = IssueQueryPatch.sql_false
        inner = sql_for_field(field, operator, value, cl, 'due_date')
        "#{Issue.table_name}.id IN (SELECT #{cl}.issue_id FROM #{cl} " \
          "WHERE #{cl}.is_section = #{f} AND #{cl}.is_done = #{f} " \
          "AND #{cl}.converted_issue_id IS NULL AND (#{inner}))"
      end

      def available_columns
        cols = super
        unless cols.any? { |c| c.name == :checklist_progress }
          cols << QueryColumn.new(:checklist_progress,
                                  caption: :label_checklist,
                                  inline:  true)
        end
        # Distinct per-item assignees (the core Assignee column shows the issue
        # owner; this surfaces who has checklist work on the issue).
        unless cols.any? { |c| c.name == :checklist_assignees }
          cols << QueryColumn.new(:checklist_assignees,
                                  caption: :label_checklist_assignees_column,
                                  inline:  true)
        end
        # "Checklist due" — the earliest due date among an issue's OPEN,
        # non-converted checklist items. Sortable via a MIN() subquery so issues
        # can be ordered by their nearest checklist deadline in list/query views
        # (a robust way to surface checklist due dates in planning views without
        # patching calendar/gantt internals). Converted items are real child
        # issues and already appear in calendar/gantt on their own.
        unless cols.any? { |c| c.name == :checklist_due_date }
          cols << QueryColumn.new(
            :checklist_due_date,
            caption:  :label_checklist_due_column,
            sortable: "(SELECT MIN(cli.due_date) FROM #{ChecklistItem.table_name} cli " \
                      "WHERE cli.issue_id = #{Issue.table_name}.id " \
                      "AND cli.is_done = #{IssueQueryPatch.sql_false} " \
                      "AND cli.is_section = #{IssueQueryPatch.sql_false} " \
                      "AND cli.converted_issue_id IS NULL)",
            inline:   true
          )
        end
        cols
      end

      # Portable SQL false literal for the current adapter.
      def self.sql_false
        ActiveRecord::Base.connection.quoted_false
      end
    end
  end
end

unless IssueQuery.ancestors.include?(RedmineChecklist::Patches::IssueQueryPatch)
  IssueQuery.prepend RedmineChecklist::Patches::IssueQueryPatch
end
