require 'net/http'
require 'uri'
require 'json'

module RedmineChecklist
  # Fan-out for checklist-item assignment notifications: an email to the assignee
  # (via ChecklistMailer, gated by `notify_on_assignment`) and an optional JSON
  # webhook POST (gated by a non-blank `webhook_url`). Each channel is guarded so
  # a failure never breaks the triggering request.
  module Notifier
    module_function

    def item_assigned(item, actor)
      return unless item&.assignee_id
      # Self-assignment: the assignee already knows — nothing to notify (applies
      # to both channels, so external webhooks aren't spammed with self-assigns).
      return if actor && item.assignee_id == actor.id

      deliver_email(item, actor)
      deliver_webhook(item, actor)
    rescue StandardError => e
      Rails.logger.error("checklist notify error: #{e.class}: #{e.message}")
    end

    def deliver_email(item, actor)
      ChecklistMailer.deliver_item_assigned(item, actor)
    rescue StandardError => e
      Rails.logger.error("checklist notify email error: #{e.message}")
    end

    def deliver_webhook(item, actor)
      url = Setting.plugin_redmine_checklist['webhook_url'].to_s
      return if url.blank?

      post_json(url, build_payload(item, actor))
    rescue StandardError => e
      Rails.logger.error("checklist notify webhook error: #{e.message}")
    end

    # Pure — builds the webhook JSON body. Kept separate so it is easy to test.
    def build_payload(item, actor)
      issue     = item.issue
      recipient = item.assignee
      {
        event:    'checklist_item.assigned',
        issue_id: item.issue_id,
        project:  issue&.project&.identifier,
        url:      "#{Setting.protocol}://#{Setting.host_name}/issues/#{item.issue_id}",
        item:     { id: item.id, subject: item.subject, due_date: item.due_date&.to_s },
        assignee: recipient && { id: recipient.id, login: recipient.login, name: recipient.name },
        actor:    actor && { id: actor.id, login: actor.login }
      }
    end

    # POST the JSON payload with short timeouts (a slow/dead endpoint must not
    # hang the request for long). Overridable/stubbable in tests.
    def post_json(url, payload)
      uri  = URI.parse(url)
      http = Net::HTTP.new(uri.host, uri.port)
      http.use_ssl      = uri.scheme == 'https'
      http.open_timeout = 3
      http.read_timeout = 3
      req = Net::HTTP::Post.new(uri.request_uri, 'Content-Type' => 'application/json')
      req.body = payload.to_json
      http.request(req)
    end
  end
end
