class CreateChecklistItems < ActiveRecord::Migration[7.0]
  def change
    create_table :checklist_items do |t|
      t.references :issue,       null: false, index: true
      t.string  :subject,        null: false, limit: 1000
      t.boolean :is_done,        null: false, default: false
      t.boolean :is_section,     null: false, default: false
      t.boolean :is_mandatory,   null: false, default: false
      t.integer :position,       null: false, default: 0
      t.integer :author_id,      null: true
      t.integer :assignee_id,    null: true
      t.date    :due_date,       null: true
      t.integer :completed_by_id, null: true
      t.datetime :completed_at,  null: true
      t.timestamps null: false
    end
  end
end
