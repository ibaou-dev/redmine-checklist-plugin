module RedmineChecklist
  module Hooks
    # Injects plugin CSS and JS into every Redmine page <head>.
    # Uses render_on so Redmine calls the partial automatically.
    class AssetHooks < Redmine::Hook::ViewListener
      render_on :view_layouts_base_html_head,
                partial: 'hooks/redmine_checklist/html_head'
    end
  end
end
