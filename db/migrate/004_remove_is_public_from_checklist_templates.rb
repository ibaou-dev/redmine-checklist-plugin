class RemoveIsPublicFromChecklistTemplates < ActiveRecord::Migration[7.2]
  # The is_public flag was never used — template scope is determined solely by
  # project_id (nil = global). Drop the leftover column.
  def change
    remove_column :checklist_templates, :is_public, :boolean, null: false, default: false
  end
end
