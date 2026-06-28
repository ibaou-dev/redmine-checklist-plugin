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
            history = ChecklistHistory.new(was, become)
            diff   = history.diff

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

            # If only structural changes (adds/deletes, no done/undone) → generic entry
            if diff[:done].empty? && diff[:undone].empty?
              added   = ChecklistHistory.from_json(detail.value).map(&:subject) -
                        ChecklistHistory.from_json(detail.old_value).map(&:subject)
              removed = ChecklistHistory.from_json(detail.old_value).map(&:subject) -
                        ChecklistHistory.from_json(detail.value).map(&:subject)

              added.each do |subject|
                if no_html
                  strings << "#{l(:label_checklist)}: + #{subject}"
                else
                  strings << content_tag(:span) do
                    safe_join([
                      content_tag(:strong, "#{l(:label_checklist)}: "),
                      '+ ',
                      subject
                    ])
                  end
                end
              end

              removed.each do |subject|
                if no_html
                  strings << "#{l(:label_checklist)}: - #{subject}"
                else
                  strings << content_tag(:span) do
                    safe_join([
                      content_tag(:strong, "#{l(:label_checklist)}: "),
                      content_tag(:del, subject)
                    ])
                  end
                end
              end
            end
          rescue StandardError => e
            Rails.logger.error("ChecklistHistory render error: #{e.message}")
          end
        end

        strings
      end
    end
  end
end
