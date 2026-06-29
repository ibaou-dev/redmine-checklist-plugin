module RedmineChecklist
  module Patches
    module IssuePatch
      def self.included(base)
        base.has_many :checklist_items, -> { order(:position) },
                      dependent: :destroy,
                      foreign_key: :issue_id

        base.after_create :apply_default_checklist_template
        base.validate :checklist_mandatory_items_satisfied
      end

      # Auto-apply the default checklist template on issue creation (silent — no journal).
      def apply_default_checklist_template
        template = ChecklistTemplate.default_for(project, tracker)
        template&.apply_to(self, User.current)
      rescue StandardError => e
        Rails.logger.error("checklist auto-apply error: #{e.message}")
      end

      # Block status transitions when enforcement is enabled and mandatory items
      # are incomplete. Only fires when status_id is changing (new records count
      # as a change) and the target status is in the blocked list.
      def checklist_mandatory_items_satisfied
        s = Setting.plugin_redmine_checklist
        return unless ['1', 'true', true].include?(s['enforce_mandatory'])

        statuses = Array(s['enforce_statuses']).reject(&:blank?).map(&:to_s)
        return if statuses.empty?

        # Only enforce when transitioning INTO a blocked status.
        # status_id_changed? is true for new records too.
        return unless status_id_changed? && statuses.include?(status_id.to_s)

        incomplete = checklist_items.where(is_mandatory: true, is_section: false, is_done: false).count
        return if incomplete.zero?

        errors.add(:base, l(:error_checklist_mandatory_incomplete, count: incomplete))
      rescue StandardError => e
        Rails.logger.error("checklist mandatory validation error: #{e.message}")
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
