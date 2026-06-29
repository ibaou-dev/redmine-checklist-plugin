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
        cols
      end
    end
  end
end

unless IssueQuery.ancestors.include?(RedmineChecklist::Patches::IssueQueryPatch)
  IssueQuery.prepend RedmineChecklist::Patches::IssueQueryPatch
end
