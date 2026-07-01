module RedmineChecklist
  module Hooks
    # Injects the signed conversion token into the new-issue form as a hidden
    # field, so it survives the GET (prefilled form) -> POST (create) round trip.
    # Only fires when a token is present in the request params (i.e. the user
    # arrived via the checklist "Convert to subtask" action).
    class ConvertViewHooks < Redmine::Hook::ViewListener
      def view_issues_form_details_bottom(context = {})
        token = context[:request]&.params&.[](:checklist_item_token)
        return '' if token.blank?

        %(<input type="hidden" name="checklist_item_token" value="#{ERB::Util.html_escape(token)}" />)
      end
    end

    # After a new issue is saved, if it carries a conversion token, link the
    # created (child) issue back to the originating checklist item.
    class ConvertControllerHooks < Redmine::Hook::Listener
      def controller_issues_new_after_save(context = {})
        token = context[:params] && context[:params][:checklist_item_token]
        RedmineChecklist::Conversion.link!(token, context[:issue])
      end
    end
  end
end
