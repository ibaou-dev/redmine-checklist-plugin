# ChecklistHistory encapsulates the before/after state of a checklist for
# journal recording.  It intentionally avoids OpenStruct and any DB/I18n access
# at load time so it is safe under Zeitwerk eager-load.
#
# Usage:
#   history = ChecklistHistory.new(items_before_array, items_after_array)
#   history.diff          # => { done: [...], undone: [...] }
#   history.empty_diff?   # => true when no net change
#   history.journal_detail # => JournalDetail (unsaved)
#
# The class also provides +can_consolidate?+ / +consolidate+ for merging a
# rapid same-user checklist journal into the previous one.

# Not an AR model — plain Ruby class, no inheritance needed.
class ChecklistHistory
  # Lightweight struct to hold a checklist item's relevant fields.
  # We use Struct, NOT OpenStruct (gone in Rails 7.2 safe usage).
  ChecklistItemSnapshot = Struct.new(:id, :subject, :is_done, :is_section, :position,
                                     :assignee_id, :due_date, :is_mandatory)

  # --------------------------------------------------------------------------
  # Class helpers
  # --------------------------------------------------------------------------

  # Build a snapshot array from ActiveRecord ChecklistItem objects.
  def self.from_records(records)
    records.map do |r|
      ChecklistItemSnapshot.new(r.id, r.subject, r.is_done, r.is_section, r.position,
                                r.assignee_id, r.due_date&.to_s, r.is_mandatory)
    end
  end

  # Deserialize a JSON string (as stored in JournalDetail#value / #old_value)
  # back into snapshot structs. Older journals lack the assignee/due/mandatory
  # keys; those read as nil and simply produce no spurious "changes".
  def self.from_json(json_str)
    return [] if json_str.blank?
    parsed = JSON.parse(json_str)
    parsed.map do |h|
      ChecklistItemSnapshot.new(
        h['id'], h['subject'], h['is_done'], h['is_section'], h['position'],
        h['assignee_id'], h['due_date'], h['is_mandatory']
      )
    end
  rescue JSON::ParserError
    []
  end

  # Serialize an array of records or snapshots to JSON.
  def self.serialize(items)
    items.map do |item|
      {
        id:           item.id,
        subject:      item.subject,
        is_done:      item.is_done,
        is_section:   item.is_section,
        position:     item.respond_to?(:position) ? item.position : 0,
        assignee_id:  item.respond_to?(:assignee_id) ? item.assignee_id : nil,
        due_date:     (item.due_date.to_s if item.respond_to?(:due_date) && item.due_date.present?),
        is_mandatory: item.respond_to?(:is_mandatory) ? item.is_mandatory : nil
      }
    end.to_json
  end

  # --------------------------------------------------------------------------
  # Instance
  # --------------------------------------------------------------------------

  def initialize(was_items, become_items)
    @was    = was_items    # array of snapshot structs or AR objects
    @become = become_items # array of snapshot structs or AR objects
  end

  # Returns an id-aware change set comparing the before/after snapshots:
  #   {
  #     done:    [subjects],            # toggled undone -> done
  #     undone:  [subjects],            # toggled done -> undone
  #     added:   [subjects],            # ids present only in the after state
  #     removed: [subjects],            # ids present only in the before state
  #     renamed:   [{ from:, to: }, ...]        # same id, subject changed
  #     reassigned:[{ subject:, to: }, ...]      # assignee_id changed (to = id|nil)
  #     due_changed:[{ subject:, to: }, ...]     # due_date changed (to = date|nil)
  #     mandatory_changed:[{ subject:, mandatory: }, ...] # is_mandatory toggled
  #   }
  # Renames are detected by id (NOT by subject set-difference) so a rename does
  # not masquerade as a delete + add. Assignee/due/mandatory changes are only
  # reported for items that exist in BOTH snapshots (added/removed items are not
  # also reported as reassigned, etc.).
  def diff
    was_map    = @was.index_by(&:id)
    become_map = @become.index_by(&:id)
    was_ids    = was_map.keys
    become_ids = become_map.keys
    shared_ids = was_ids & become_ids

    done   = shared_ids.select { |id| !was_map[id].is_done && become_map[id].is_done }
                       .map    { |id| become_map[id].subject }
    undone = shared_ids.select { |id| was_map[id].is_done && !become_map[id].is_done }
                       .map    { |id| was_map[id].subject }

    added   = (become_ids - was_ids).map { |id| become_map[id].subject }
    removed = (was_ids - become_ids).map { |id| was_map[id].subject }
    renamed = shared_ids.select { |id| was_map[id].subject != become_map[id].subject }
                        .map    { |id| { from: was_map[id].subject, to: become_map[id].subject } }

    reassigned = shared_ids.select { |id| was_map[id].assignee_id != become_map[id].assignee_id }
                           .map    { |id| { subject: become_map[id].subject, to: become_map[id].assignee_id } }
    due_changed = shared_ids.select { |id| was_map[id].due_date.to_s != become_map[id].due_date.to_s }
                            .map    { |id| { subject: become_map[id].subject, to: become_map[id].due_date } }
    mandatory_changed = shared_ids.select { |id| !!was_map[id].is_mandatory != !!become_map[id].is_mandatory }
                                  .map    { |id| { subject: become_map[id].subject, mandatory: !!become_map[id].is_mandatory } }

    { done: done, undone: undone, added: added, removed: removed, renamed: renamed,
      reassigned: reassigned, due_changed: due_changed, mandatory_changed: mandatory_changed }
  end

  # True when the before/after snapshots are equivalent across every tracked
  # change category (so a net round-trip — e.g. check+uncheck, or add+delete —
  # collapses to nothing during consolidation).
  def empty_diff?
    d = diff
    d.values.all?(&:empty?)
  end

  # Build an unsaved JournalDetail representing this change.
  def journal_detail(old_json, new_json)
    JournalDetail.new(
      property:  'attr',
      prop_key:  'checklist',
      old_value: old_json,
      value:     new_json
    )
  end

  # --------------------------------------------------------------------------
  # Consolidation
  # --------------------------------------------------------------------------

  # Can we merge the incoming change into +prev_journal+?
  # Conditions: same user, within 1 minute, blank notes, only checklist details.
  def self.can_consolidate?(prev_journal, current_user)
    return false if prev_journal.nil?
    return false if prev_journal.user_id != current_user.id
    return false if prev_journal.notes.present?
    return false if Time.zone.now > prev_journal.created_on + 1.minute

    detail_keys = prev_journal.details.map(&:prop_key)
    detail_keys.all? { |k| k == 'checklist' } && detail_keys.any?
  end

  # Merge current state into +prev_journal+.
  # +new_value_json+ is the new "after" state.
  # +prev_old_json+  is the original "before" state stored in prev_journal.
  # If net diff is empty → destroy prev_journal (round-trip, no change).
  # Otherwise           → update prev_journal's detail value; destroy new_journal.
  # Returns :destroyed_both | :merged | :noop
  def self.consolidate(prev_journal, new_value_json, new_journal = nil)
    prev_detail = prev_journal.details.find { |d| d.prop_key == 'checklist' }
    return :noop unless prev_detail

    was    = from_json(prev_detail.old_value)
    become = from_json(new_value_json)
    history = new(was, become)

    if history.empty_diff?
      prev_journal.destroy
      new_journal&.destroy
      :destroyed_both
    else
      prev_detail.update_column(:value, new_value_json)
      new_journal&.destroy
      :merged
    end
  end
end
