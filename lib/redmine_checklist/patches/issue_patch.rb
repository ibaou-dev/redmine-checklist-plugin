module RedmineChecklist
  module Patches
    module IssuePatch
      def self.included(base)
        base.has_many :checklist_items, -> { order(:position) },
                      dependent: :destroy,
                      foreign_key: :issue_id

        base.after_create :apply_default_checklist_template
        base.after_save   :checklist_recalc_parent_done_ratio
        base.validate     :checklist_mandatory_items_satisfied

        # Prepend the done_ratio override so it can call super() through to core.
        base.prepend RedmineChecklist::Patches::IssueDoneRatioOverride
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
      # Per-project override wins over the global setting (project-wins resolution).
      def checklist_mandatory_items_satisfied
        return if project.nil?

        cfg = ChecklistProjectSetting.effective_for(project)
        return unless cfg[:enabled]
        return if cfg[:status_ids].empty?

        # Only enforce when transitioning INTO a blocked status.
        # status_id_changed? is true for new records too.
        return unless status_id_changed? && cfg[:status_ids].include?(status_id.to_s)

        # Count mandatory, non-section items that are not effectively done.
        # Ruby-side (not a SQL where) so converted items count as done when their
        # child issue is closed (effective_done? mirrors the subtask).
        mandatory   = checklist_items.select { |i| i.is_mandatory? && !i.is_section? }
        incomplete  = mandatory.reject(&:effective_done?).size
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

        done = tasks.count(&:effective_done?)
        { done: done, total: total, percent: (done.to_f / total * 100).round }
      end

      # True when the plugin owns this issue's done_ratio (computing it from the
      # combined checklist + subtasks set): plugin setting on + Redmine configured
      # for issue-field done ratio + the issue actually has checklist tasks.
      # Mirrors the guard in ChecklistItem.recalc_done_ratio so both agree on when
      # the plugin — rather than core's subtask derivation — owns the done_ratio.
      def checklist_drives_done_ratio?
        affect = Setting.plugin_redmine_checklist['affect_done_ratio'].to_s
        return false unless Setting.issue_done_ratio == 'issue_field' && (affect == '1' || affect == 'true')

        checklist_items.any? { |i| !i.is_section? }
      end

      # after_save on ANY issue: if it has a parent, refresh the parent's
      # checklist-driven done_ratio. This is what makes closing/reopening a
      # converted subtask update the parent's % Done (the child's effective_done?
      # mirror flips). Guarded + cheap for non-checklist parents (recalc returns
      # early). Uses update_all internally, so no callback recursion.
      def checklist_recalc_parent_done_ratio
        return unless parent_id

        ChecklistItem.recalc_done_ratio(parent_id)
      rescue StandardError => e
        Rails.logger.error("checklist parent done_ratio recalc error: #{e.message}")
      end

      # Issue-level gate for promoting checklist items to subtasks: the user can
      # manage checklists AND create child issues (add_issues + manage_subtasks),
      # and the issue is open (unless the plugin setting permits a closed parent).
      # Lives on the model (not a helper) so it is available in the issue-show
      # hook render context, which does not mix in the plugin helper.
      def checklist_convert_allowed?(user = User.current)
        return false if project.nil?
        return false unless user.allowed_to?(:manage_checklists, project) &&
                            user.allowed_to?(:add_issues,       project) &&
                            user.allowed_to?(:manage_subtasks,  project)

        Setting.plugin_redmine_checklist['allow_convert_parent_closed'].to_s == '1' || !closed?
      end

      # Short text for the issue-list "Checklist" column — e.g. "3/5 (60%)",
      # or nil for issues that have no checklist tasks.
      def checklist_progress
        stats = checklist_progress_stats
        return nil unless stats

        "#{stats[:done]}/#{stats[:total]} (#{stats[:percent]}%)"
      end
    end

    # Prepended (see IssuePatch.included) so it can override a core method with
    # a super() fallback.
    module IssueDoneRatioOverride
      # When the issue has a checklist, its done_ratio is the COMBINED progress of
      # checklist items AND subtasks (ChecklistItem.recalc_done_ratio). So we must
      # stop core from deriving done_ratio from subtasks ALONE — otherwise core's
      # subtask-only average (e.g. 1 of 2 closed = 50%) clobbers the combined
      # value (e.g. 1 checklist item + 1 closed of 2 subtasks, over 3 units = 60%).
      # For issues without a checklist this falls straight through to core.
      def done_ratio_derived?
        return false if respond_to?(:checklist_drives_done_ratio?) && checklist_drives_done_ratio?

        super
      end
    end
  end
end

Issue.include RedmineChecklist::Patches::IssuePatch
