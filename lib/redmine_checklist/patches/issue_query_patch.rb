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
      def available_columns
        cols = super
        unless cols.any? { |c| c.name == :checklist_progress }
          cols << QueryColumn.new(:checklist_progress,
                                  caption: :label_checklist,
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
