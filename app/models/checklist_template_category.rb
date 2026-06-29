class ChecklistTemplateCategory < ApplicationRecord
  has_many :checklist_templates, foreign_key: :category_id, dependent: :nullify

  validates :name, presence: true

  scope :ordered, -> { order(:position, :name) }
end
