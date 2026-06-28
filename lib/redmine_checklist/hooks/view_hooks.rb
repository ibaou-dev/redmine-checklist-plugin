module RedmineChecklist
  module Hooks
    class ViewHooks < Redmine::Hook::ViewListener
      render_on :view_issues_show_details_bottom,
                partial: 'checklists/issue_checklist'
    end
  end
end
