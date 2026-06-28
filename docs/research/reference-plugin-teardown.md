---
type: Reference
title: Reference Teardown — redmine_checklists (RedmineUP Light)
description: Deep dive on the local reference plugin's data model, models, hooks, and patterns we adapt.
status: accepted
tags: [research, reference, patterns]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - architecture/data-model.md
  - architecture/integration-points.md
  - research/competitive-analysis.md
---

# Reference Teardown — `redmine_checklists` (RedmineUP Light)

The free RedmineUP build, vendored at `.references/redmine_checklists/` (git-ignored, local-only). v4.0.2, GPL-3.0, `requires_redmine version_or_higher: '4.0'`. This is our closest open-source reference; we adapt its patterns but **drop the `redmineup` gem dependency**.

> Note: this is a *reference for patterns only*. Our implementation is clean-room and uses different table/model names (`checklist_items` vs. their `checklists`) to avoid collision and carry our extended schema.

## Their data model (from migrations)

**`checklists`** — `id`, `issue_id` (FK, not null), `subject` (text ≤1000), `is_done` (bool), `position` (int), `is_section` (bool), `author_id` (FK), `created_at`, `updated_at`.

**`checklist_template_categories`** — `id`, `name`, `position`.

**`checklist_templates`** — `id`, `name`, `project_id` (nullable = global), `category_id`, `user_id`, `is_public`, `is_default`, `tracker_id` (auto-apply), `template_items` (serialized subjects).

## History model

`JournalChecklistHistory` diffs checklist state and writes into Redmine's `journal_details` with `prop_key: 'checklist'`, storing old/new state as JSON arrays. Rapid successive changes by the same user within a ~1-minute window are consolidated into a single journal entry. We adopt this approach in Phase 2.

## Registration & permissions (`init.rb`)

```ruby
Redmine::AccessControl.map do |map|
  map.project_module :issue_tracking do |map|
    map.permission :view_checklists, { checklists: [:show, :index] }
    map.permission :done_checklists, { checklists: :done }
    map.permission :edit_checklists, { checklists: [:done, :create, :destroy, :update] }
  end
end
settings default: { save_log: true, issue_done_ratio: false }, partial: 'settings/checklists/checklists'
```

They also `requires_redmineup` and ignore `lib/` from Zeitwerk — we keep the Zeitwerk-ignore pattern, drop the redmineup requirement.

## Files of interest

```
app/models/checklist.rb                      # acts_as_list, acts_as_searchable, acts_as_activity_provider
app/models/journal_checklist_history.rb      # journal diff writer
app/controllers/checklists_controller.rb     # AJAX + accept_api_auth, :done action
lib/redmine_checklists/hooks/views_issues_hook.rb
lib/redmine_checklists/patches/issue_query_patch.rb     # PRO: filters
lib/redmine_checklists/patches/issues_controller_patch.rb
lib/redmine_checklists/patches/project_patch.rb
db/migrate/001..007                          # incremental schema, incl. is_section, template fields
```

## Patterns we adopt

1. **AJAX `done` action** with `format.js` for instant toggle.
2. **`acts_as_list`** (or equivalent `position` logic) for reorder.
3. **Journal diff writer** with consolidation window (Phase 2).
4. **Sections excluded** from done-ratio.
5. **Template tracker auto-apply** on issue creation.
6. **`accept_api_auth`** on every action for REST parity.

## Patterns we deliberately change

- **No `redmineup` gem** — pure Rails/Redmine APIs.
- **Extended schema** — add `is_mandatory`, `assignee_id`, `due_date`, `completed_by_id`, `completed_at` (our differentiators) up front.
- **Model-layer enforcement** for mandatory items (they have none; RedmineFlux does it but we want it free).
- **Distinct names** (`checklist_items`, `ChecklistItem`) to coexist cleanly and signal a separate project.
