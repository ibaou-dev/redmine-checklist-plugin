# Patch for IssuesHelper to render checklist journal details as human-readable
# lines in the issue History tab.
#
# Prepended onto IssuesHelper so super() calls through to the original.
# Applied in init.rb to_prepare block.

module RedmineChecklist
  module Patches
    module IssuesHelperPatch
      # Override details_to_strings to intercept 'checklist' prop_key details
      # and render them as human-readable strings.
      # All non-checklist details are delegated to super (the original Redmine method).
      def details_to_strings(details, no_html = false, options = {})
        checklist_details, other_details = details.partition { |d| d.prop_key == 'checklist' }

        # Render non-checklist details via Redmine's default implementation.
        strings = super(other_details, no_html, options)

        # Render checklist details.
        checklist_details.each do |detail|
          begin
            was    = ChecklistHistory.from_json(detail.old_value)
            become = ChecklistHistory.from_json(detail.value)
            diff   = ChecklistHistory.new(was, become).diff

            diff[:done].each do |subject|
              if no_html
                strings << "#{l(:label_checklist_item_done)}: #{subject}"
              else
                strings << content_tag(:span, class: 'checklist-journal-done') do
                  safe_join([
                    content_tag(:strong, "#{l(:label_checklist)}: "),
                    content_tag(:s, subject),
                    ' ',
                    content_tag(:span, "(#{l(:label_checklist_completed)})", class: 'checklist-journal-note')
                  ])
                end
              end
            end

            diff[:undone].each do |subject|
              if no_html
                strings << "#{l(:label_checklist_item_reopened)}: #{subject}"
              else
                strings << content_tag(:span, class: 'checklist-journal-undone') do
                  safe_join([
                    content_tag(:strong, "#{l(:label_checklist)}: "),
                    subject,
                    ' ',
                    content_tag(:span, "(#{l(:label_checklist_reopened)})", class: 'checklist-journal-note')
                  ])
                end
              end
            end

            diff[:added].each do |subject|
              if no_html
                strings << "#{l(:label_checklist_item_added)}: #{subject}"
              else
                strings << content_tag(:span, class: 'checklist-journal-added') do
                  safe_join([
                    content_tag(:strong, "#{l(:label_checklist)}: "),
                    subject,
                    ' ',
                    content_tag(:span, "(#{l(:label_checklist_added)})", class: 'checklist-journal-note')
                  ])
                end
              end
            end

            diff[:removed].each do |subject|
              if no_html
                strings << "#{l(:label_checklist_item_removed)}: #{subject}"
              else
                strings << content_tag(:span, class: 'checklist-journal-removed') do
                  safe_join([
                    content_tag(:strong, "#{l(:label_checklist)}: "),
                    content_tag(:del, subject),
                    ' ',
                    content_tag(:span, "(#{l(:label_checklist_removed)})", class: 'checklist-journal-note')
                  ])
                end
              end
            end

            diff[:renamed].each do |change|
              if no_html
                strings << "#{l(:label_checklist_item_renamed)}: #{change[:from]} #{l(:label_checklist_renamed_to)} #{change[:to]}"
              else
                strings << content_tag(:span, class: 'checklist-journal-renamed') do
                  safe_join([
                    content_tag(:strong, "#{l(:label_checklist)}: "),
                    content_tag(:i, change[:from]),
                    " #{l(:label_checklist_renamed_to)} ",
                    content_tag(:i, change[:to])
                  ])
                end
              end
            end

            diff[:reassigned].each do |change|
              name  = change[:to] ? (User.find_by(id: change[:to])&.name || "##{change[:to]}") : nil
              label = name ? l(:label_checklist_reassigned, name: name) : l(:label_checklist_unassigned)
              strings << checklist_meta_change_string(change[:subject], label, no_html)
            end

            diff[:due_changed].each do |change|
              label = change[:to].present? ? l(:label_checklist_due_set, date: change[:to]) : l(:label_checklist_due_cleared)
              strings << checklist_meta_change_string(change[:subject], label, no_html)
            end

            diff[:mandatory_changed].each do |change|
              label = change[:mandatory] ? l(:label_checklist_marked_mandatory) : l(:label_checklist_unmarked_mandatory)
              strings << checklist_meta_change_string(change[:subject], label, no_html)
            end

            diff[:converted].each do |change|
              if no_html
                label = l(:label_checklist_converted, issue: "##{change[:to]}")
                strings << "#{l(:label_checklist)}: #{change[:subject]} — #{label}"
              else
                child = Issue.find_by(id: change[:to])
                issue_link = child ? link_to_issue(child) : "##{change[:to]}"
                # Only the (already-escaped) issue link is interpolated here — no other
                # user data — so marking the interpolated result html_safe is safe.
                label = l(:label_checklist_converted, issue: issue_link).html_safe
                strings << content_tag(:span, class: 'checklist-journal-meta') do
                  safe_join([
                    content_tag(:strong, "#{l(:label_checklist)}: "),
                    change[:subject],
                    ' ',
                    content_tag(:span, "(#{label})".html_safe, class: 'checklist-journal-note')
                  ])
                end
              end
            end
          rescue StandardError => e
            Rails.logger.error("ChecklistHistory render error: #{e.message}")
          end
        end

        strings
      end

      private

      # Renders one "Checklist: <subject> (<label>)" change line, used for the
      # assignee / due-date / mandatory metadata changes.
      def checklist_meta_change_string(subject, label, no_html)
        if no_html
          "#{l(:label_checklist)}: #{subject} — #{label}"
        else
          content_tag(:span, class: 'checklist-journal-meta') do
            safe_join([
              content_tag(:strong, "#{l(:label_checklist)}: "),
              subject,
              ' ',
              content_tag(:span, "(#{label})", class: 'checklist-journal-note')
            ])
          end
        end
      end
    end
  end
end

# Apply the patch at require-time (top level), mirroring issue_patch.rb.
#
# WHY NOT only in init.rb's to_prepare block: this init.rb is itself evaluated
# *inside* the PluginLoader's to_prepare callback. A to_prepare block registered
# during that pass does NOT run in the same prepare! pass (Rails compiles the
# callback chain up-front), so a prepend deferred to that block never takes
# effect on first boot — the History tab then falls back to Redmine's default
# detail rendering ("Translation missing: <locale>.field_checklist changed
# from <json> to <json>"). Prepending here (require-time) guarantees it is
# applied on first boot, exactly like Issue.include in issue_patch.rb.
unless IssuesHelper.ancestors.include?(RedmineChecklist::Patches::IssuesHelperPatch)
  IssuesHelper.prepend RedmineChecklist::Patches::IssuesHelperPatch
end
