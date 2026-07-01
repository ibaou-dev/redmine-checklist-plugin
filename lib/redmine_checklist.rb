module RedmineChecklist
  # Signed verifier for the item->subtask conversion token. The token travels
  # from the `convert` action, through the core new-issue form (as a hidden
  # field injected by ConvertViewHooks), into the create POST, where the
  # after-save listener links the created issue back to the checklist item.
  # Signing prevents a user from linking an arbitrary item to an arbitrary issue.
  def self.convert_verifier
    Rails.application.message_verifier('redmine_checklist/convert')
  end

  # Completes an item -> subtask conversion after the child issue is saved.
  # Verifies the signed token, then (idempotently, with a parent-link sanity
  # check) stamps the conversion columns on the checklist item and journals it.
  # Any failure is swallowed — a conversion hiccup must never break issue save.
  module Conversion
    module_function

    def link!(token, issue)
      return if token.blank? || issue.nil? || !issue.persisted?

      data = RedmineChecklist.convert_verifier.verify(token)
      item = ChecklistItem.find_by(id: data['item'])
      return unless item
      return if item.converted?                     # idempotent — already linked
      return unless issue.parent_id == item.issue_id # sanity: issue IS a child of the item's issue

      parent = item.issue
      before = ChecklistHistory.serialize(parent.checklist_items.ordered.to_a)

      item.update_columns(
        converted_issue_id: issue.id,
        converted_at:       Time.current,
        converted_by_id:    data['user']
      )

      record_convert_journal(parent, before)
    rescue ActiveSupport::MessageVerifier::InvalidSignature, ActiveSupport::MessageVerifier::InvalidMessage
      nil
    rescue StandardError => e
      Rails.logger.error("checklist convert link error: #{e.class}: #{e.message}")
      nil
    end

    # Fresh journal on the parent issue recording the conversion (no consolidation —
    # a conversion is a distinct, deliberate event worth its own line).
    def record_convert_journal(parent, before_json)
      plugin_settings = Setting.plugin_redmine_checklist
      return if plugin_settings['save_log'].to_s == '0'

      parent.checklist_items.reload
      after_json = ChecklistHistory.serialize(parent.checklist_items.ordered.to_a)
      return if before_json == after_json

      journal = Journal.new(journalized: parent, user: User.current, notes: '')
      journal.details << JournalDetail.new(
        property: 'attr', prop_key: 'checklist',
        old_value: before_json, value: after_json
      )
      journal.save!
    rescue StandardError => e
      Rails.logger.error("checklist convert journal error: #{e.class}: #{e.message}")
    end
  end
end

require_relative 'redmine_checklist/hooks/asset_hooks'
require_relative 'redmine_checklist/hooks/view_hooks'
require_relative 'redmine_checklist/hooks/convert_hooks'
require_relative 'redmine_checklist/patches/issue_patch'
require_relative 'redmine_checklist/patches/issue_query_patch'
require_relative 'redmine_checklist/patches/issues_helper_patch'
