Redmine::Plugin.register :redmine_checklist do
  name        'Redmine Checklist'
  author      'ibaou-dev'
  description 'Checklist management for Redmine issues'
  version     '0.2.1'
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

  # Register the activity provider for the Activity tab.
  # The ChecklistItem model gets acts_as_activity_provider applied below at init.rb
  # evaluation time (which happens inside the plugin_loader's prepare callback,
  # AFTER the acts_as_activity_provider module has been included in ApplicationRecord).
  activity_provider :checklists, class_name: 'ChecklistItem', default: false
end

# Register the search type so Redmine's search controller includes it.
# The name 'checklist_items' maps to ChecklistItem model via singularize.camelcase.constantize.
Redmine::Search.register :checklist_items

Rails.autoloaders.each { |l| l.ignore(File.expand_path('lib', __dir__)) } if Rails.autoloaders.respond_to?(:each)

# Load hooks and patches once at boot (require is idempotent).
require_relative 'lib/redmine_checklist'

# Apply acts_as_* macros to ChecklistItem DIRECTLY here (not inside a to_prepare block).
#
# WHY: This init.rb is executed by the PluginLoader's to_prepare callback (callback #11
# in the reloader._prepare_callbacks chain). By the time we get here, the acts_as_*
# plugins (callbacks #1-#8) have already run and included Redmine::Acts::ActivityProvider
# (and Event, Searchable) into ApplicationRecord. So we can safely call these macros now.
#
# Registering our own reloader.to_prepare block here does NOT work because newly-added
# callbacks are not executed in the current prepare! pass (Rails compiles the callback
# chain lazily, and new additions during a pass are deferred to the next pass). By the
# time our dynamically-added block would run (on the next prepare! / Zeitwerk reload),
# the web request has already failed.
#
# IDEMPOTENCY: acts_as_activity_provider has a built-in guard:
#   unless self.included_modules.include?(Redmine::Acts::ActivityProvider::InstanceMethods)
# acts_as_event and acts_as_searchable have similar guards. When Zeitwerk reloads
# ChecklistItem (fresh class), those guards are reset and the macros re-apply cleanly.
ChecklistItem.acts_as_event(
  datetime:    :created_at,
  type:        'checklist_item',
  title:       proc { |o| o.subject },
  description: proc { |o| "#{Issue.model_name.human} ##{o.issue_id}: #{o.issue&.subject}" },
  author:      :author,
  url:         proc { |o| { controller: 'issues', action: 'show', id: o.issue_id } }
)

ChecklistItem.acts_as_activity_provider(
  type:       'checklists',
  permission: :view_checklists,
  timestamp:  "#{ChecklistItem.table_name}.created_at",
  author_key: :author_id,
  scope:      proc { ChecklistItem.joins(issue: :project).preload(:issue) }
)

ChecklistItem.acts_as_searchable(
  columns:     ["#{ChecklistItem.table_name}.subject"],
  scope:       proc { |_options| ChecklistItem.joins(issue: :project).order("#{ChecklistItem.table_name}.id") },
  project_key: "#{Issue.table_name}.project_id",
  # Our table uses created_at (t.timestamps). acts_as_searchable defaults the
  # sort column to an UNQUALIFIED :created_on, which is ambiguous once the search
  # query JOINs issues/projects (both have created_on) -> PG::AmbiguousColumn 500
  # on ANY global search. Qualify it to our own column.
  date_column: "#{ChecklistItem.table_name}.created_at",
  permission:  :view_checklists,
  preload:     [:issue]
)

# to_prepare block: used ONLY for patching Redmine core classes.
# These are safe here because Issue/IssuesHelper are already loaded by
# the time our init.rb runs (inside the plugin_loader's prepare callback).
Rails.application.config.to_prepare do
  # --- Issue patch ---
  unless Issue.include?(RedmineChecklist::Patches::IssuePatch)
    Issue.include RedmineChecklist::Patches::IssuePatch
  end

  # --- IssuesHelper patch (prepend so super() chains correctly) ---
  unless IssuesHelper.ancestors.include?(RedmineChecklist::Patches::IssuesHelperPatch)
    IssuesHelper.prepend RedmineChecklist::Patches::IssuesHelperPatch
  end

  # Register ChecklistItemsHelper on IssuesController.
  IssuesController.helper :checklist_items if defined?(IssuesController)
end
