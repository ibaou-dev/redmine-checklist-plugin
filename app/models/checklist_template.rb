class ChecklistTemplate < ApplicationRecord
  ChecklistTemplateItem = Struct.new(:subject, :is_section, :position)

  belongs_to :project,  optional: true
  belongs_to :tracker,  optional: true
  belongs_to :category, class_name: 'ChecklistTemplateCategory', optional: true
  belongs_to :author,   class_name: 'User', foreign_key: :user_id, optional: true

  validates :name, presence: true

  scope :global,       -> { where(project_id: nil) }
  scope :for_project,  ->(project) { where(project_id: project.id) }
  scope :ordered,      -> { order(:name) }

  # -------------------------------------------------------------------------
  # template_items serialization
  # -------------------------------------------------------------------------

  # Parse template_items JSON → array of ChecklistTemplateItem structs.
  def items
    return [] if template_items.blank?

    data = JSON.parse(template_items)
    data.map do |h|
      ChecklistTemplateItem.new(h['subject'], h['is_section'], h['position'])
    end
  rescue JSON::ParserError, TypeError
    []
  end

  # Render items to the plain-text editor format:
  #   section → "# <subject>"
  #   item    → "<subject>"
  def template_text
    items.map do |it|
      it.is_section ? "# #{it.subject}" : it.subject
    end.join("\n")
  end

  # Parse the textarea: one entry per line.
  # Lines matching /\A#\s+(.*)/ → section; everything else → item.
  # Assigns sequential positions and stores as JSON.
  def template_text=(text)
    return self.template_items = '[]' if text.blank?

    parsed = text.to_s.split("\n").each_with_index.filter_map do |line, idx|
      next if line.strip.empty?

      if (m = line.match(/\A#\s+(.*)/))
        { 'subject' => m[1].strip, 'is_section' => true,  'position' => idx }
      else
        { 'subject' => line.strip,  'is_section' => false, 'position' => idx }
      end
    end

    self.template_items = parsed.to_json
  end

  # -------------------------------------------------------------------------
  # Scoped queries
  # -------------------------------------------------------------------------

  # Global + project-scoped templates available to a project.
  def self.available_for(project)
    where(project_id: [nil, project&.id]).order(:name).includes(:category)
  end

  # Returns the default template for a tracker (project-scoped preferred; else global).
  # Returns nil when tracker is nil.
  def self.default_for(project, tracker)
    return nil if tracker.nil?

    project_default = where(project_id: project&.id, tracker_id: tracker.id, is_default: true).first
    return project_default if project_default

    where(project_id: nil, tracker_id: tracker.id, is_default: true).first
  end

  # -------------------------------------------------------------------------
  # Apply to an issue
  # -------------------------------------------------------------------------

  # Create ChecklistItem records on issue from this template's items,
  # appended after the current max position (preserving existing items).
  # Does NOT write journals — the caller decides.
  # Returns the array of created ChecklistItem records.
  def apply_to(issue, user)
    base_position = issue.checklist_items.maximum(:position).to_i
    created = []

    items.each_with_index do |tmpl_item, idx|
      item = issue.checklist_items.create!(
        subject:    tmpl_item.subject,
        is_section: tmpl_item.is_section,
        position:   base_position + idx + 1,
        author_id:  user&.id
      )
      created << item
    end

    created
  end

  # -------------------------------------------------------------------------
  # Display helpers
  # -------------------------------------------------------------------------

  # Human-readable scope label for views.
  def scope_label
    project ? project.name : I18n.t(:label_checklist_template_global)
  end
end
