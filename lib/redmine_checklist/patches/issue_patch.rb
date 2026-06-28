module RedmineChecklist
  module Patches
    module IssuePatch
      def self.included(base)
        base.has_many :checklist_items, -> { order(:position) },
                      dependent: :destroy,
                      foreign_key: :issue_id
      end

      # Progress over checklist *tasks* (sections excluded), as a hash
      # { done:, total:, percent: }, or nil when there are no tasks.
      # Lives on the model so it is available in any view context (including
      # the issue-show hook), without depending on plugin helper availability.
      def checklist_progress_stats
        tasks = checklist_items.reject(&:is_section?)
        total = tasks.size
        return nil if total.zero?

        done = tasks.count(&:is_done?)
        { done: done, total: total, percent: (done.to_f / total * 100).round }
      end
    end
  end
end

Issue.include RedmineChecklist::Patches::IssuePatch
