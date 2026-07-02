class ChecklistItem < ApplicationRecord
  belongs_to :issue
  belongs_to :author,          class_name: 'User',  optional: true
  belongs_to :assignee,        class_name: 'User',  optional: true, foreign_key: :assignee_id
  belongs_to :completed_by,    class_name: 'User',  optional: true, foreign_key: :completed_by_id
  belongs_to :converted_by,    class_name: 'User',  optional: true, foreign_key: :converted_by_id
  belongs_to :converted_issue, class_name: 'Issue', optional: true, foreign_key: :converted_issue_id

  validates :subject,  presence: true, length: { maximum: 1000 }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :issue,    presence: true

  scope :done,     -> { where(is_done: true) }
  scope :pending,  -> { where(is_done: false) }
  scope :ordered,  -> { order(:position) }
  scope :tasks,    -> { where(is_section: false) }
  scope :sections, -> { where(is_section: true) }

  before_save :stamp_completion
  after_update :checklist_notify_assignment

  # -----------------------------------------------------------------------
  # done? / section? / mandatory? convenience predicates
  # -----------------------------------------------------------------------
  def done?      = is_done?
  def section?   = is_section?
  def mandatory? = is_mandatory?

  # True when this item has been promoted to a child issue that still exists AND
  # is still a child of this item's issue. A converted item's truth lives in the
  # subtask, so it renders as a locked linked row and its completion mirrors the
  # subtask (see effective_done?).
  #
  # Reverts to a normal (unconverted) item when the link is no longer valid — the
  # child was deleted, unlinked from the parent ("unlink" sets parent_id to nil),
  # or reparented elsewhere. In every such case the item goes back to a regular,
  # editable, is_done-counted checklist row so the display and the done-ratio stay
  # consistent with reality. (Re-linking the child restores the converted state.)
  def converted?
    converted_issue_id.present? &&
      converted_issue.present? &&
      converted_issue.parent_id == issue_id
  end

  # Completion as it should count toward progress / done-ratio / enforcement.
  # For a converted item this mirrors the child issue's closed state (the issue
  # is authoritative once created); otherwise it is the raw is_done flag.
  def effective_done?
    return ChecklistItem.subtask_done?(converted_issue) if converted?

    is_done?
  end

  def counts_toward_progress?
    !is_section?
  end

  # Required by the Redmine activity view (_activities.html.erb line 10):
  #   e.project — the project this event belongs to.
  # ChecklistItem belongs_to :issue, and issue belongs_to :project.
  def project
    issue&.project
  end

  # -----------------------------------------------------------------------
  # done_ratio recalculation
  # -----------------------------------------------------------------------
  # Recalculates and persists `done_ratio` on the issue from the COMBINED set of
  # checklist items and subtasks — they are the sources of truth together.
  #
  # Units (equal-weight), without double-counting:
  #   * each checklist task NOT converted to a subtask  → done when is_done
  #   * each direct subtask (child issue)               → done when closed?
  # A converted checklist item is represented by its subtask (counted on the
  # subtask side), so it is excluded from the checklist side.
  #
  # Guards:
  #   - Setting.issue_done_ratio must be 'issue_field'
  #   - plugin setting affect_done_ratio must be truthy ('1'/'true')
  #   - the issue must HAVE a checklist (>=1 non-section item); otherwise the
  #     plugin stays out and lets Redmine core handle done_ratio (incl. its own
  #     subtask derivation).
  #
  # Uses `update_all` (no callbacks, no journal) on a fresh query.
  # Whether the plugin combines subtasks into done_ratio (and propagates a
  # subtask close up to its parent). Plugin setting `subtask_done_ratio`, default
  # ON — off only when explicitly '0'/'false'. When OFF, the plugin drives
  # done_ratio only for LEAF issues from their checklist and leaves subtask
  # parents to Redmine core (an escape hatch against deep-tree recalc overhead).
  def self.combine_subtasks?
    !['0', 'false'].include?(Setting.plugin_redmine_checklist['subtask_done_ratio'].to_s)
  end

  # True when the plugin manages issue done_ratio at all (Redmine in issue-field
  # mode + the affect_done_ratio setting on). Used to decide whether to keep the
  # displayed "% Done" in sync after any checklist mutation.
  def self.affects_done_ratio?
    affect = Setting.plugin_redmine_checklist['affect_done_ratio'].to_s
    Setting.issue_done_ratio == 'issue_field' && (affect == '1' || affect == 'true')
  end

  # Opt-in (default OFF): count a subtask as a "done" unit once it reaches 100%
  # done_ratio even while still open, not only when its status is closed.
  def self.count_subtask_when_full?
    ['1', 'true'].include?(Setting.plugin_redmine_checklist['count_subtask_when_full'].to_s)
  end

  # Is +issue+ (a subtask) done for the purpose of parent progress? Closed always
  # counts; 100% counts only when the setting above is on.
  def self.subtask_done?(issue)
    return false unless issue

    issue.closed? || (count_subtask_when_full? && issue.done_ratio.to_i >= 100)
  end

  def self.recalc_done_ratio(issue_id)
    plugin_settings = Setting.plugin_redmine_checklist
    affect = plugin_settings['affect_done_ratio'].to_s
    return unless Setting.issue_done_ratio == 'issue_field' && (affect == '1' || affect == 'true')

    issue = Issue.find_by(id: issue_id)
    return unless issue

    checklist_tasks = issue.checklist_items.reject(&:is_section?)

    if checklist_tasks.empty?
      # No checklist tasks remain (e.g. the last item was just deleted). Don't
      # leave a stale done_ratio behind:
      #   * combining on + subtasks exist → drive from the subtasks;
      #   * leaf issue (no subtasks)      → reset to 0;
      #   * non-leaf with combining off   → leave it to Redmine core (don't touch).
      if combine_subtasks? && issue.children.exists?
        subs  = issue.children.to_a
        ratio = (subs.count { |c| subtask_done?(c) } * 10) / subs.size * 10
        Issue.where(id: issue_id).update_all(done_ratio: ratio)
      elsif issue.leaf?
        Issue.where(id: issue_id).update_all(done_ratio: 0)
      end
      return
    end

    if combine_subtasks?
      # Combined universe: non-converted checklist tasks (is_done) + all direct
      # subtasks (closed?). Exclude only items whose subtask still exists
      # (converted?); a converted item whose child was deleted reverts to a
      # normal countable task.
      plain_tasks = checklist_tasks.reject(&:converted?)
      subtasks    = issue.children.to_a
      total = plain_tasks.size + subtasks.size
      return if total.zero?

      done = plain_tasks.count(&:is_done?) + subtasks.count { |c| subtask_done?(c) }
    else
      # Subtask combining OFF: only own LEAF issues; leave subtask parents to core.
      return unless issue.leaf?

      total = checklist_tasks.size
      done  = checklist_tasks.count(&:effective_done?)
    end

    # Integer formula: rounds to nearest 10% (matches reference plugin)
    ratio = (done * 10) / total * 10

    Issue.where(id: issue_id).update_all(done_ratio: ratio)
  rescue StandardError => e
    Rails.logger.error("ChecklistItem.recalc_done_ratio error: #{e.class}: #{e.message}")
  end

  private

  # Notify the assignee (email + optional webhook) when an item is assigned to a
  # new user. Fires only when assignee_id actually changed to a present value.
  def checklist_notify_assignment
    return unless saved_change_to_assignee_id? && assignee_id.present?

    RedmineChecklist::Notifier.item_assigned(self, User.current)
  rescue StandardError => e
    Rails.logger.error("checklist notify trigger error: #{e.message}")
  end

  def stamp_completion
    if is_done? && is_done_changed? && !is_section?
      self.completed_by_id = User.current&.id
      self.completed_at    = Time.current
    elsif !is_done? && is_done_changed?
      self.completed_by_id = nil
      self.completed_at    = nil
    end
  end
end
