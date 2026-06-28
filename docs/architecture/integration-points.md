---
type: Architecture
title: Redmine Integration Points
description: Hooks, model patches, permissions, routes, and API surface used to integrate with Redmine core.
status: accepted
tags: [architecture, hooks, permissions, api]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - architecture/data-model.md
  - research/reference-plugin-teardown.md
  - dev/environment.md
---

# Redmine Integration Points

How the plugin attaches to Redmine 6.x without forking core. Reference patterns confirmed against the local `redmine_checklists` teardown and the `redmine-plugin-developer` skill.

## View hooks

| Hook | Use |
|---|---|
| `view_issues_show_details_bottom` | render the checklist panel on the issue page (Phase 1, implemented) |
| `view_issues_form_details_bottom` | template selector on the new/edit issue form (Phase 3) |
| `view_layouts_base_html_head` | inject plugin CSS/JS assets if not auto-served (as needed) |

Hook listener: `RedmineChecklist::Hooks::ViewHooks < Redmine::Hook::ViewListener`.

## Controller hooks

| Hook | Use |
|---|---|
| `controller_issues_new_after_save` | auto-apply a default/tracker-matched template on issue creation (Phase 3) |
| `controller_issues_edit_before_save` / model validation | mandatory-item enforcement (Phase 4) |

## Model patches

- **`Issue`** — `has_many :checklist_items` (Phase 0, implemented via `IssuePatch`).
- **`Issue` validation** — add a validation that rejects a guarded status transition while mandatory items are unchecked (Phase 4). Enforced at the model layer so it holds for UI, bulk edit, and REST.
- **`IssueQuery`** — add a column/filter for checklist completion (Phase 5).
- Optional: `acts_as_activity_provider`, `acts_as_searchable`, `acts_as_event` on `ChecklistItem` for activity/search integration (Phase 2).

Patches live in `lib/redmine_checklist/patches/` and are applied at the bottom of each patch file (`Issue.include ...`). The `lib/` dir is ignored by the Zeitwerk autoloader and required explicitly from `init.rb` to avoid load-time issues.

## Permissions

Registered under the `:issue_tracking` project module in `init.rb`:

| Permission | Grants | Maps to |
|---|---|---|
| `view_checklists` | see items | `checklist_items#index` |
| `done_checklists` | toggle done | `checklist_items#update` (done only) |
| `manage_checklists` | full CRUD + reorder | create/update/destroy/reorder (`require: :member`) |

## Routes

Nested under issues (`config/routes.rb`):

```
resources :issues do
  resources :checklist_items, only: [:index, :create, :update, :destroy] do
    collection { post :reorder }
  end
end
```

## REST API

- `accept_api_auth` on all controller actions.
- JSON responses mirror UI capabilities (list, create, update, destroy, reorder).
- API key or session auth, honoring the same permissions.
- Templates get their own API endpoints in Phase 3.

## Settings

Plugin settings (`Setting.plugin_redmine_checklist`), partial at `app/views/settings/checklist/_settings.html.erb`:

- `show_progress_bar` (bool) — show the progress bar on issues.
- `affect_done_ratio` (bool) — contribute to issue done ratio.
- `save_log` (bool) — write changes into issue journals.

## Assets

- CSS `assets/stylesheets/redmine_checklist.css` — uses CSS custom properties (`var(--color-primary)`, `var(--border-color)`, …) so it inherits Prism theme tokens and degrades on the default theme.
- JS `assets/javascripts/redmine_checklist.js` — progressive enhancement (AJAX done-toggle, multiline paste). Served via Propshaft (Redmine 6.x); no build step.

## Load-time safety

Per the `redmine-plugin-developer` skill: never call `l()`/`I18n` or hit the DB at class-body/module load time — it crashes eager-load in production. The CI eager-load check (`rails runner "Rails.application.eager_load!"`) guards this; it currently passes.
