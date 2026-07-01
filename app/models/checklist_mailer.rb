# Mailer for checklist notifications. Inherits Redmine's Mailer to reuse the
# mail layout, from-address, per-recipient locale handling and helpers.
class ChecklistMailer < Mailer
  # Email sent to a user when a checklist item is assigned to them.
  def item_assigned(user, item, actor)
    @item      = item
    @issue     = item.issue
    @actor     = actor
    @user      = user
    @issue_url = url_for(controller: 'issues', action: 'show', id: @issue, anchor: 'checklist')

    redmine_headers 'Project'  => @issue.project.identifier,
                    'Issue-Id' => @issue.id
    subject = "[#{@issue.project.name} - #{@issue.tracker.name} ##{@issue.id}] " \
              "#{l(:mail_subject_checklist_item_assigned, subject: item.subject)}"
    mail to: user, subject: subject
  end

  # Deliver the assignment email to the item's assignee, unless they are the
  # actor making the change or inactive. Respects the plugin setting.
  def self.deliver_item_assigned(item, actor)
    return unless Setting.plugin_redmine_checklist['notify_on_assignment'].to_s == '1' ||
                  Setting.plugin_redmine_checklist['notify_on_assignment'].to_s == 'true'

    recipient = item.assignee
    return unless recipient && recipient.active?
    return if actor && recipient.id == actor.id

    item_assigned(recipient, item, actor).deliver_later
  end
end
