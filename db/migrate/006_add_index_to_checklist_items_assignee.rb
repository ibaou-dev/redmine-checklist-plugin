class AddIndexToChecklistItemsAssignee < ActiveRecord::Migration[7.2]
  def change
    add_index :checklist_items, :assignee_id unless index_exists?(:checklist_items, :assignee_id)
  end
end
