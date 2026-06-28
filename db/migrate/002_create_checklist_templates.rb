class CreateChecklistTemplates < ActiveRecord::Migration[7.0]
  def change
    create_table :checklist_template_categories do |t|
      t.string  :name,     null: false, limit: 255
      t.integer :position, null: false, default: 0
      t.timestamps null: false
    end

    create_table :checklist_templates do |t|
      t.string  :name,        null: false, limit: 255
      t.integer :project_id,  null: true,  index: true
      t.integer :tracker_id,  null: true,  index: true
      t.integer :category_id, null: true,  index: true
      t.integer :user_id,     null: true
      t.boolean :is_public,   null: false, default: false
      t.boolean :is_default,  null: false, default: false
      t.text    :template_items
      t.timestamps null: false
    end
  end
end
