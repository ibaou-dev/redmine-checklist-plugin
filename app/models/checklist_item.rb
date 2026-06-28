class ChecklistItem < ApplicationRecord
  belongs_to :issue
  belongs_to :author,       class_name: 'User', optional: true
  belongs_to :assignee,     class_name: 'User', optional: true, foreign_key: :assignee_id
  belongs_to :completed_by, class_name: 'User', optional: true, foreign_key: :completed_by_id

  validates :subject,  presence: true, length: { maximum: 1000 }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :issue,    presence: true

  scope :done,     -> { where(is_done: true) }
  scope :pending,  -> { where(is_done: false) }
  scope :ordered,  -> { order(:position) }
  scope :tasks,    -> { where(is_section: false) }
  scope :sections, -> { where(is_section: true) }

  before_save :stamp_completion

  # -----------------------------------------------------------------------
  # done? / section? / mandatory? convenience predicates
  # -----------------------------------------------------------------------
  def done?      = is_done?
  def section?   = is_section?
  def mandatory? = is_mandatory?

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
  # Recalculates and persists `done_ratio` on the parent issue using ONLY
  # checklist tasks (sections are excluded).
  #
  # Guards:
  #   - Setting.issue_done_ratio must be 'issue_field'
  #   - plugin setting affect_done_ratio must be truthy ('1'/'true')
  #   - There must be at least one task item (non-section)
  #
  # Uses `update_all` (no callbacks, no journal) on a fresh query.
  def self.recalc_done_ratio(issue_id)
    plugin_settings = Setting.plugin_redmine_checklist
    affect = plugin_settings['affect_done_ratio'].to_s
    return unless Setting.issue_done_ratio == 'issue_field' && (affect == '1' || affect == 'true')

    issue = Issue.find_by(id: issue_id)
    return unless issue

    tasks = issue.checklist_items.tasks.to_a
    return if tasks.empty?

    total    = tasks.size
    done_cnt = tasks.count(&:is_done?)
    # Integer formula: rounds to nearest 10% (matches reference plugin)
    ratio = (done_cnt * 10) / total * 10

    Issue.where(id: issue_id).update_all(done_ratio: ratio)
  rescue StandardError => e
    Rails.logger.error("ChecklistItem.recalc_done_ratio error: #{e.class}: #{e.message}")
  end

  private

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
