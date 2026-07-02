# Changelog — Knowledge Base

All notable changes to this docs bundle.

## 2026-07-02 — v1.2.1 (bug fixes & UX polish)

- **Delete-last-item done-ratio bug.** `recalc_done_ratio` used to `return` early when no checklist tasks remained, leaving a stale `done_ratio`. Now the empty case resets to 0 (leaf) or recomputes from subtasks (combining on + children), and `_done_ratio_sync.js.erb` guards on the new `ChecklistItem.affects_done_ratio?` (not `checklist_drives_done_ratio?`) so the reset shows live even with no checklist left.
- **Unlink/reparent edge case.** `converted?` now also requires `converted_issue.parent_id == issue_id`. Unlinking (parent_id→nil), reparenting, or deleting the child reverts the item to a normal, counted, editable row (re-linking restores it) — previously an unlinked subtask kept showing "→ #N" while silently dropping out of the done-ratio (jumping to 100%). Runner-verified unlink→50 (not 100), relink→restored; browser regression in `phase6-convert`.
- **Quick-convert Subtasks refresh.** `convert_quick.js.erb` now re-renders core's `issues/subtasks` partial into `#issue_tree` (server-side rescue so a cross-controller render hiccup can't break the row swap; `@issue.reload` first so descendants are fresh).
- **Icon/cursor polish.** Expand chevron moved to sit right after the drag handle (still toggles; row-click handler already excludes `button`); drag handle cursor → `ns-resize` (up/down).
- New `phase10-polish` spec + unlink regression in `phase6`. Also added research doc `docs/planning/feature-checklist-in-queries.md` (assignee/due filters — feasible via `sql_for_<field>_field` subqueries; calendar/Gantt placement needs core-internals patching → out).

## 2026-07-01 — v1.2.0 (quick convert, notifications, checklist due dates, done-ratio hardening)

- **Quick convert.** Second row icon (`chevrons-right`) → `POST convert_quick` (`checklist-quick-convert`, remote). Builds the child on the **parent's tracker** + default status (`build_quick_subtask`), carries subject + (if assignable) assignee + due, `child.save`; on success `RedmineChecklist::Conversion.attach!` links + journals and `convert_quick.js.erb` swaps the row to the locked converted row in place (+ done_ratio/history sync). On validation failure → `convert_fallback.js.erb` navigates to the prefilled form. Refactored `Conversion` to share `attach!(item, issue)` between the token flow (`link!`) and quick flow. New permission action `:convert_quick`.
- **Assignment notifications.** `ChecklistItem after_update :checklist_notify_assignment` (fires on `saved_change_to_assignee_id?` + present) → `RedmineChecklist::Notifier.item_assigned(item, actor)`. Skips self-assign (both channels) at the entry point. Email via `ChecklistMailer < Mailer` (`deliver_item_assigned`, `deliver_later`, gated by `notify_on_assignment`); webhook via `post_json` (Net::HTTP, 3s timeouts, `build_payload` pure/testable) gated by non-blank `webhook_url`. Settings + i18n (`mail_subject/body_checklist_item_assigned*`). Verified at runner level (cross-process: browser-triggered deliveries aren't visible to a separate `rails runner`) — new `phase7-notifications` spec drives the whole cycle in one process (`:inline` jobs + `:test` mail + stubbed `post_json`).
- **Checklist due dates (pragmatic — no calendar/gantt patching).** `Issue#checklist_due_date` = MIN due of open, non-section, non-converted items. Sortable **"Checklist due"** query column (`issue_query_patch`, MIN() subquery via `quoted_false`). Panel header "next due" chip (red when overdue). Converted items are real issues → already in calendar/gantt. New `phase8-due-dates` spec (note: assert via `ApplicationController.helpers.format_date`, not ISO — user date format is %m/%d/%Y).
- **Done-ratio hardening.** (folded in from the pending 1.1.1 work) —

- **Trigger optimization.** `Issue#checklist_recalc_parent_done_ratio` (after_save) now only recomputes the parent when `saved_change_to_status_id?` or `saved_change_to_parent_id?` (a subtask's "closed" unit or tree membership can only change then) — previously it ran on every issue save instance-wide. Added `after_destroy` so deleting a subtask updates its parent. Reparenting recalcs both old and new parents.
- **`subtask_done_ratio` on/off setting (default on).** `ChecklistItem.combine_subtasks?` gates the combined behaviour. When OFF: `recalc_done_ratio` only drives LEAF issues from the checklist (`effective_done?`), returns early for issues that have children; `checklist_convert_allowed?`… (unrelated); `checklist_drives_done_ratio?` returns `combine_subtasks? || leaf?` so `done_ratio_derived?` stops overriding core on subtask parents → core's normal derivation applies. Escape hatch for deep-tree recalc cost; default preserves v1.1.0 behaviour (missing key ⇒ on).
- Verified via `rails runner`: ON=combined (30→60), OFF=core subtask-avg (50) + `checklist_drives_done_ratio?`=false on subtask parents, trigger optimization (non-status child edit leaves parent unchanged), after_destroy (50→100 on manual-subtask delete). New toggle e2e in `phase6-convert`.

## 2026-07-01 — v1.1.0 (convert item → subtask)

- **Convert a checklist item into a subtask.** A "Convert to subtask" control on open tasks (not sections, not done, not already converted) redirects to the **standard new-issue form prefilled** via `issue[...]` URL params (subject, parent_issue_id, assigned_to_id, due_date) — reusing core validation/workflow/permissions untouched. A signed one-time token (`Rails.application.message_verifier`) travels GET→form→POST: injected as a hidden field by a `view_issues_form_details_bottom` hook, then consumed by a `controller_issues_new_after_save` listener that idempotently links the created child issue back to the item (`RedmineChecklist::Conversion.link!`, with a `parent_id == item.issue_id` sanity check) and journals it.
- **Locked linked row + done-state mirror.** A converted item is kept and rendered as a locked "→ #N" row (no checkbox/edit/delete). New `ChecklistItem#effective_done?` returns the child issue's `closed?` when converted; threaded through `checklist_progress_stats` and the mandatory-enforcement validation (which moved from a SQL `where(is_done:false)` count to a Ruby `reject(&:effective_done?)` count). So a mandatory step promoted to a subtask is satisfied exactly when its issue closes. Guards against a dangling link if the child is later deleted (`converted?` checks `converted_issue.present?`).
- **Combined done_ratio (checklist + subtasks).** Fixed a bug where, once an issue had subtasks, Redmine core's parent-derivation (`recalculate_attributes_for` → `done_ratio_derived?`, `Setting.parent_issue_done_ratio='derived'`) overwrote our checklist-based `done_ratio` with a **subtask-only average** (e.g. 3 items + close 1 of 2 subtasks showed 50% instead of 60%). Fix: (1) `ChecklistItem.recalc_done_ratio` now computes over the **combined** universe — non-converted checklist tasks (`is_done`) + all direct subtasks (`closed?`), converted items counted once via their subtask; it only engages when the issue HAS a checklist (else core handles it). (2) A prepended `IssueDoneRatioOverride#done_ratio_derived?` returns false when the plugin owns the ratio, stopping core's subtask-only derivation. (3) A new `Issue after_save` recomputes the parent's combined ratio when a subtask closes/reopens. Verified via `rails runner` incl. a manual (non-checklist) subtask and a no-checklist sanity case. NOTE: `done_ratio_derived?` needs `prepend` (not the existing `include`) to override core with `super`.
- **Live %Done refresh.** The checklist AJAX responses (done/create/update/destroy/apply_template) now re-render Redmine's core "% Done" cell in place via a shared `_done_ratio_sync.js.erb` partial — it reads the fresh `done_ratio` from the DB (recalc uses `update_all`, so `@issue` in memory is stale) and swaps `document.querySelector('.attribute.progress .value')` with a freshly-rendered `progress_bar`, guarded by `@issue.checklist_drives_done_ratio?`. Closes the previous "needs F5 to see updated %Done" gap.
- **History.** `ChecklistHistory` snapshot/serialize/diff gained `converted_issue_id` + a `converted` category; the IssuesHelper patch renders "Checklist: … — converted to #N" with a clickable issue link.
- **Permissions / setting.** Needs core `add_issues` + `manage_subtasks` on top of `manage_checklists`; eligibility lives on `Issue#checklist_convert_allowed?` (on the **model**, not a helper — the issue-show view-hook render context does not mix in plugin helpers; this was caught by e2e as a `NoMethodError`). New plugin setting `allow_convert_parent_closed` (off by default). Migration 005 adds the three columns.
- 71 Playwright e2e tests (real Chrome). New `phase6-convert` spec: prefilled-form conversion + linked row + History, done-state mirror on child close, section/done guards, and the manage_subtasks permission gate. Backend flow independently smoke-tested via `rails runner` (token round-trip, mirror, idempotency, progress, journal) with rollback.

## 2026-06-29 — v1.0.1 (polish / completeness)

- **History records metadata edits.** `ChecklistHistory` snapshot/serialize/diff extended with `assignee_id` / `due_date` / `is_mandatory`; new diff categories `reassigned` / `due_changed` / `mandatory_changed` rendered by the IssuesHelper patch (`checklist_meta_change_string`). `empty_diff?` now `values.all?(&:empty?)` so round-trips still consolidate. Old journals (pre-fields) read as nil → no spurious changes.
- **Separate `manage_checklist_enforcement` permission.** Enforcement panel gated by it; template CRUD still needs `manage_checklist_templates`; the project Checklist page is reachable with EITHER, and each section renders per-permission. `ChecklistTemplatesController` gained `require_template_management` for CRUD actions; `ChecklistProjectSettingsController` authorizes on the new permission. Project menu shows for either permission.
- **Uncheck-guard.** `ChecklistItemsController#done` refuses unchecking a mandatory item while the issue's current status is guarded (`checklist_uncheck_blocked?` + `blocked.js.erb` reverts the checkbox + flashes); keeps the invariant both ways.
- **Dropped the cosmetic `is_public`** column (migration 004) + removed from form/params/i18n/e2e seed.
- 67 Playwright e2e tests (real Chrome). New `polish` spec (metadata journaling, uncheck-guard, permission separation). NOTE: per-project overrides + role-permission grants are shared global state — polish spec uses clearCookies between user sessions and revokes granted perms in afterAll.

## 2026-06-29 — v1.0.0 (stable)

- **Issue-list "Checklist" column.** `Issue#checklist_progress` returns `done/total · %`; surfaced as an opt-in query column via `IssueQuery#available_columns` prepend (`lib/redmine_checklist/patches/issue_query_patch.rb`, applied require-time + re-applied in to_prepare for dev reloads). Non-sortable text → exports to CSV/PDF; blank for issues without checklist tasks. (Value is computed per-issue, so it only queries `checklist_items` for issues whose query selects the column.)
- **i18n pass.** Verified no hardcoded user-facing strings (views/JS) and that every `l(:…)` our-namespace key exists; runtime sweep of all plugin pages showed zero "Translation missing".
- **Honest compatibility.** `requires_redmine` raised 5.0 → **6.0** (migrations are `ActiveRecord::Migration[7.2]` and code uses Ruby 3.x endless methods); README updated to "Redmine 6.x (Rails 7.2, Ruby 3.x)".
- Deferred to future work: completion filter, multiline paste bulk-add, extra locales, MySQL/older-version runtime testing (code is portable ActiveRecord — no vendor SQL).
- 64 Playwright e2e tests (real Chrome). New `phase5-issue-column` spec.

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
