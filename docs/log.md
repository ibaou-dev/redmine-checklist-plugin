# Changelog — Knowledge Base

All notable changes to this docs bundle.

## 2026-06-29 — Per-project enforcement + row polish (v0.5.0)

- **Per-project enforcement override.** New `checklist_project_settings` table (migration 003) + `ChecklistProjectSetting` with `effective_for(project)` resolver: tri-state `inherit` / `enabled` (project's own statuses) / `disabled`; **project wins**, no row = inherit global. The `Issue` validation now reads the resolver instead of global settings directly. Config UI is an enforcement panel on the project *Checklist* tab (gated by `manage_checklist_templates`); the project menu caption changed to "Checklist".
- **Row UI polish.** Expand control is a rotating chevron sprite; expand/edit/delete share the muted edit-pencil colour (scoped under `#checklist-panel` to beat the theme's `#content a`); clicking anywhere in the row body toggles the detail panel (pointer cursor via `.checklist-expandable`).
- Independent verification through the real edit form + DB confirmed disabled-beats-global, enabled-uses-own-statuses, and inherit-falls-back. Note: a manual verification run left a project override in the DB that initially failed the global Phase 4 spec — added a defensive `ChecklistProjectSetting` clear to that spec's `beforeEach` (per-project overrides are shared global state across specs).
- 63 Playwright e2e tests (real Chrome). New `phase5-project-enforcement` spec.

## 2026-06-29 — Phase 4 shipped (v0.4.0)

- **Phase 4 complete and released as v0.4.0.** Mandatory items + status-transition enforcement (global setting: enable + pick guarded statuses; validated on `Issue`, so UI/bulk/API all blocked when transitioning into a guarded status with incomplete mandatory items). Per-item assignee + due date via an expandable detail row; inline meta (assignee/`@name`, due, overdue red); completion audit (`✓` + "completed by … on …" tooltip from `completed_by`/`completed_at`).
- Validation gates on `status_id_changed?` + status in the configured list, then counts incomplete mandatory non-section items — avoids false positives on unrelated edits and on issue creation (no items yet).
- Independent verification through the real edit form + DB confirmed the block holds and lifts once the mandatory item is checked. Note: the detail-panel assignee `<select>` is Prism-enhanced into a typeahead (see [[reference-phase3-gotchas]]); e2e sets the native value.
- 59 Playwright e2e tests (real Chrome). New `phase4-enforcement` spec.

## 2026-06-29 — Patch v0.3.1 (template UI polish)

- Delete icon: dropped the forced red fill so the trashcan inherits the theme colour and matches Redmine's native issue-delete icon (same `#icon--del` sprite, outline style).
- Fixed missing i18n on the categories admin pages (`button_new` and `field_position` are not core keys → added `label_checklist_template_category_new` + `field_position`).
- Template categories moved under the templates section: `/checklist_templates/categories` (routes via a `scope 'checklist_templates'` with `as:` to preserve helper names); the flat `/checklist_template_categories` now 404s.
- Section parsing accepts `#Section` as well as `# Section` (space optional); lone `#` ignored; hint updated.

## 2026-06-29 — Phase 3 shipped (v0.3.0)

- **Phase 3 complete and released as v0.3.0.** Checklist templates: global (admin) + per-project management, optional categories, apply-to-issue (logged in History), and silent tracker auto-apply on issue creation (project default → global default). New `manage_checklist_templates` permission. Item editor uses a one-line-per-item textarea (`# ` prefix = section).
- Models `ChecklistTemplate` / `ChecklistTemplateCategory` over the pre-existing tables; dual-scope `ChecklistTemplatesController` (admin vs `project_id`); auto-apply via `Issue after_create`; `apply_template` action on the checklist-items controller.
- Independent verification caught: the apply `.js.erb` called non-existent JS helpers (fixed to `initChecklistRow` + new `window.reinitChecklistSortable`); `error_messages_for :sym, object:` mis-call (→ `error_messages_for @obj`); missing form-field ids; and a stale-reload hazard where the issue-show view hook silently stops firing after init.rb/route changes until a **full container restart**. The Prism theme enhances `<select>` into a typeahead — not a bug; e2e drives the typeahead.
- 56 Playwright e2e tests (real Chrome). New `phase3-templates` spec.

## 2026-06-29 — Patch v0.2.1 (History tab fixes & delete-icon polish)

- **Fixed History tab rendering raw JSON** (`Translation missing: …field_checklist changed from [{…}] to […]`). Root cause: the `IssuesHelper#details_to_strings` override was registered only in a `to_prepare` block, which does not execute during the plugin-load prepare pass — so the prepend never applied on boot. Now applied at require-time (like the Issue patch). See `reference-to-prepare-prepend-gotcha`.
- **Fixed History tab needing a manual F5** after AJAX checklist changes — it now refreshes in place (shared `_history_sync.js.erb` re-renders `#tab-content-history`; controller gained `helper :issues/:journals/:attachments/:custom_fields/:avatars` because Redmine runs with `include_all_helpers = false`).
- **Added id-aware diffing**: renames render as a single *"renamed X → Y"* entry (not delete + add); deletions render as a *"removed"* line.
- Delete control switched from an `✕` glyph to Redmine's native **trashcan** sprite (`sprite_icon('del')`) in destructive red.
- Hardened tests: new `bugfix-history` spec rejects raw JSON / "Translation missing" and verifies live refresh + delete/rename history + trashcan icon; the Phase 2 journal spec no longer passes on the subject-inside-JSON substring.

## 2026-06-28 — Phase 2 shipped (v0.2.0)

- **Phase 2 complete and released as v0.2.0.** Journal/history change-logging (rendered in the issue History tab) with 1-minute same-user consolidation; done-ratio integration (issue_field mode + `affect_done_ratio`); activity-feed and global-search integration.
- Fixed a critical global-search 500 (`acts_as_searchable` unqualified `created_on` → `PG::AmbiguousColumn`; qualified to `created_at`) — found during independent verification, missed by the first suite because the search test matched the 500 error page's echoed query param.
- Updated roadmap (Phase 2 ✅), integration-points, README/feature-matrix as needed; hardened search/activity e2e to assert HTTP 200 + results-region matches.

## 2026-06-28 — Phase 1 shipped (v0.1.0)

- **Phase 1 MVP complete and released as v0.1.0.** Interactive checklist panel: two-button add (item/section), inline edit, done-toggle with live progress, drag-reorder, flat group-header sections, three-tier permissions, full AJAX.
- Verified by 35 Playwright e2e tests (real Chrome, all tiers, deterministic) + visual review of every flow.
- Updated roadmap (Phase 1 ✅), integration-points (dedicated `done` action; progress on model `Issue#checklist_progress_stats`; hook render-context gotcha), feature-matrix.
- Added LICENSE (GPL-3.0) and CHANGELOG.md.

## 2026-06-28 — Initial bundle

- Initial OKF bundle created.
- Captured competitive research (RedmineFlux, RedmineUP free/PRO, Advanced Checklists).
- Documented synthesized data model, integration points, use cases, feature matrix.
- Wrote product proposal and phased roadmap.
- Recorded dev-environment wiring (bind-mount architecture, Prism theme).
