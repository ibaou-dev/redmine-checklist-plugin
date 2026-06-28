Redmine::Plugin.register :redmine_checklist do
  name        'Redmine Checklist'
  author      'ibaou-dev'
  description 'Checklist management for Redmine issues'
  version     '0.1.0'
  url         'https://github.com/ibaou-dev/redmine-checklist-plugin'
  author_url  'https://github.com/ibaou-dev'

  requires_redmine version_or_higher: '5.0'

  settings default: {
    'show_progress_bar' => true,
    'affect_done_ratio' => false,
    'save_log'          => true
  }, partial: 'settings/checklist/settings'

  Redmine::AccessControl.map do |map|
    map.project_module :issue_tracking do |map|
      # view_checklists: read-only list view
      map.permission :view_checklists,
                     { checklist_items: [:index] },
                     read: true

      # done_checklists: toggle done/undone only — no add/edit/delete
      map.permission :done_checklists,
                     { checklist_items: [:done] }

      # manage_checklists: full create/edit/delete/reorder
      map.permission :manage_checklists,
                     { checklist_items: [:create, :update, :destroy, :reorder] },
                     require: :member
    end
  end
end

Rails.autoloaders.each { |l| l.ignore(File.expand_path('lib', __dir__)) } if Rails.autoloaders.respond_to?(:each)

# Load hooks and patches once at boot (require is idempotent).
require_relative 'lib/redmine_checklist'

# Hooks live in lib/ (ignored by Zeitwerk) and subclass Redmine::Hook::ViewListener,
# which is not reloaded — so they register once at boot and persist. Only the Issue
# patch needs re-applying: Issue is a core model that Zeitwerk reloads in development,
# and each reloaded class loses the included module.
Rails.application.config.to_prepare do
  Issue.include RedmineChecklist::Patches::IssuePatch unless
    Issue.include?(RedmineChecklist::Patches::IssuePatch)
end
