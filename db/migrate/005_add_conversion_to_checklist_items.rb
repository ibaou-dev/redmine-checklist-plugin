class AddConversionToChecklistItems < ActiveRecord::Migration[7.2]
  def change
    add_column :checklist_items, :converted_issue_id, :integer
    add_column :checklist_items, :converted_at,       :datetime
    add_column :checklist_items, :converted_by_id,    :integer
    add_index  :checklist_items, :converted_issue_id
  end
end
