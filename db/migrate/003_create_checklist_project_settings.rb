class CreateChecklistProjectSettings < ActiveRecord::Migration[7.2]
  def change
    create_table :checklist_project_settings do |t|
      t.references :project, null: false, index: { unique: true }
      t.string :enforce_mode, null: false, default: 'inherit'
      t.text   :enforce_statuses
      t.timestamps
    end
  end
end
