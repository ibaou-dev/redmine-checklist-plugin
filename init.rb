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
      map.permission :view_checklists,
                     { checklist_items: [:index] }
      map.permission :done_checklists,
                     { checklist_items: [:update] }
      map.permission :manage_checklists,
                     { checklist_items: [:create, :update, :destroy, :reorder] },
                     require: :member
    end
  end
end

Rails.autoloaders.each { |l| l.ignore(File.expand_path('lib', __dir__)) } if Rails.autoloaders.respond_to?(:each)
require_relative 'lib/redmine_checklist'
