class ChecklistItem < ActiveRecord::Base
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

  def done?     = is_done?
  def section?  = is_section?
  def mandatory? = is_mandatory?

  def counts_toward_progress?
    !is_section?
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
