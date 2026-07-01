# Changelog

All notable changes to the Redmine Checklist plugin are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and this
project adheres to [Semantic Versioning](https://semver.org/).

## [1.1.0] — 2026-07-01

**Convert a checklist item into a subtask.** A checklist task can now be promoted to a real child issue when a step outgrows a simple done/not-done.

### Added
- **"Convert to subtask" action** on open checklist tasks (not sections, not already-done items). It opens the standard Redmine new-issue form **prefilled** from the item (subject, parent issue, assignee, due date), so the tracker's own required-field, workflow, and permission rules all apply — nothing is bypassed. On save, the created child issue is **linked back** to the item (via a signed one-time token) and the conversion is recorded in the issue **History** ("Checklist: … — converted to #N").
- The converted item is **kept as a locked linked row** showing "→ #N" and the child's status. Its completion **mirrors the child issue**: when the subtask is closed the item counts as done for progress and mandatory-item enforcement (a mandatory step promoted to a subtask is satisfied when its issue closes).
- **Issue "% Done" now combines checklist items and subtasks.** When the *Affect issue done ratio* setting is on and an issue has a checklist, its `done_ratio` is computed over the **combined** set — each non-converted checklist item plus each subtask (a converted item is counted once, via its subtask) — instead of Redmine's subtask-only average. Issues **without** a checklist are untouched (core's normal derivation still applies).
- **The issue "% Done" field now refreshes live** (no page reload) when you check/uncheck, add, or remove checklist items — previously the plugin's own progress bar updated but Redmine's core % Done field needed an F5.
- Requires the standard core **`add_issues`** + **`manage_subtasks`** permissions (in addition to `manage_checklists`); the control is hidden when the user lacks them or the parent issue is closed.
- New plugin setting **"Allow converting … while the parent issue is closed"** (off by default).

### Notes
- **One-way by design** — there is no subtask→item reverse (it would lose the issue's workflow, journals, and relations).
- See [`docs/planning/feature-item-to-subtask.md`](docs/planning/feature-item-to-subtask.md) for the full spec and rationale.

### Upgrade — ⚠️ run the migration
This release adds columns (`checklist_items.converted_issue_id` / `converted_at` / `converted_by_id`). After extracting, run `bundle exec rake redmine:plugins:migrate RAILS_ENV=production NAME=redmine_checklist` and restart. To let members convert items, grant them Redmine's **Add issues** and **Manage subtasks** permissions.

### Tested
- 71 Playwright e2e tests (real Chrome). New `phase6-convert` spec covers the prefilled-form conversion + linked row + History, the done-state mirror on child close, the section/done guards, and the permission gate.

## [1.0.1] — 2026-06-29

**Polish — completeness fixes.** No new user-facing features.

### Added
- **History now records metadata edits**: changing a checklist item's **assignee**, **due date**, or **mandatory** flag is logged in the issue History tab (e.g. "Checklist: Task — assigned to Jane", "— due 2026-07-15", "— marked mandatory"), with the same consolidation as other checklist changes.
- **Separate `manage_checklist_enforcement` permission**: per-project mandatory-item enforcement is now gated by its own permission instead of reusing `manage_checklist_templates`. The project *Checklist* tab shows the templates section and the enforcement panel independently, per the member's permissions.

### Changed / Fixed
- **Mandatory items can no longer be silently unchecked while the issue is in a guarded status** — the uncheck is refused (the checkbox reverts and a message explains to change the issue status first), keeping the enforcement invariant consistent both ways.
- **Removed the unused `is_public` flag** from checklist templates (it never affected anything — scope is determined by `project_id`). Dropped from the form and the database (migration 004).

### Upgrade — ⚠️ run the migration
This release drops a column (`checklist_templates.is_public`). After extracting, run `bundle exec rake redmine:plugins:migrate RAILS_ENV=production NAME=redmine_checklist` and restart. To let members configure per-project enforcement, grant the new **`manage_checklist_enforcement`** permission (admins are unaffected).

### Tested
- 67 Playwright e2e tests (real Chrome). New `polish` spec covers metadata journaling, the uncheck-guard, and the template/enforcement permission separation.

## [1.0.0] — 2026-06-29

**v1.0 — issue-list column + polish.** First stable release.

### Added
- **Issue-list "Checklist" column**: an optional column for the issue list and saved queries showing each issue's progress (`done/total · %`); issues with no checklist tasks render blank, and it exports to CSV/PDF.

### Changed
- **Compatibility**: the plugin now declares **Redmine 6.0+** (Rails 7.2, Ruby 3.x) — the version it is built and tested against — instead of an unverified "5.0+" claim (the migrations and code use Rails 7.2 / Ruby 3.x features).
- i18n pass: every user-facing string is sourced from a locale key; the English locale is complete (verified no "Translation missing" across all plugin pages).

### Notes
- This release adds no database migration. Feature set: interactive checklists, sections, change history, done-ratio, activity & search, templates (global/project + auto-apply), mandatory-item enforcement (global or per-project), per-item assignment, and the issue-list column.
- Verified by **64 Playwright end-to-end tests** (real Chrome), plus independent behavioral checks of every subsystem.

## [0.5.0] — 2026-06-29

**Per-project enforcement override + checklist-row UI polish.**

### Added
- **Per-project enforcement override**: each project's *Checklist* tab now has an enforcement panel — **Inherit the global default**, **Enforce for this project** (with its own status list), or **Disabled for this project**. The project's choice wins; with no override it inherits the global setting. Resolved via `ChecklistProjectSetting.effective_for(project)` and applied in the same `Issue` validation (so it holds for the form, bulk edit, and API). New `checklist_project_settings` table (migration 003); gated by `manage_checklist_templates`.

### Changed
- The checklist row's **expand control** is now a clean rotating chevron icon, and the expand / edit / delete icons share **one muted colour scheme** (matching the edit pencil; link colour on hover).
- You can **expand/collapse an item's detail panel by clicking anywhere in the row body** (not just the chevron); the row shows a pointer cursor.

### Tested
- 63 Playwright e2e tests (real Chrome). New `phase5-project-enforcement` spec verifies project-wins resolution (disabled beats a global enforce; enabled uses the project's own statuses) through the real edit form + DB, and that the panel persists the override; the Phase 4 spec gained a click-row-to-expand test.

## [0.4.0] — 2026-06-29

**Phase 4 — Mandatory-item enforcement & per-item assignment.**

### Added
- **Mandatory items**: any task can be marked *mandatory*. Mandatory items show a red `*` flag.
- **Status-transition enforcement**: an admin enables enforcement and picks (in the plugin settings) which issue statuses are **blocked until all mandatory checklist items are checked**. Enforced at the `Issue` validation layer, so it holds for the issue form, **bulk edit, and the REST API** — the transition is refused with a clear error while mandatory items remain incomplete.
- **Per-item assignment**: each task row has an expandable **detail panel** to set an **assignee** (from the issue's assignable users), a **due date**, and the **mandatory** flag, saved via AJAX.
- **Per-item meta**: assignee (`@name`) and due date are shown inline on the row; overdue, not-yet-done due dates are highlighted in red.
- **Completion audit**: completed items show a `✓` with a "Completed by *user* on *date*" tooltip (stamped via `completed_by` / `completed_at`).

### Tested
- 59 Playwright e2e tests (real Chrome). New `phase4-enforcement` spec verifies the status transition is blocked with an incomplete mandatory item and allowed once it is checked (through the real edit form + DB), the detail panel sets mandatory/due/assignee, and read-only users see the flag but no edit control.

## [0.3.1] — 2026-06-29

**Patch — template UI polish.**

### Fixed
- Delete (trashcan) icon now matches Redmine's **native issue-delete icon** (neutral outline, inherits the theme colour) instead of a forced solid red.
- Missing translations on the template **categories** admin pages (`button_new`, `field_position`) — added proper keys.
- Template **section parsing** now accepts `#Section` as well as `# Section` (the space after `#` is optional); a line containing only `#` is ignored. Hint text updated to match.

### Changed
- Template **categories** moved under the templates section: `/checklist_templates/categories` (was the flat `/checklist_template_categories`), for a tidier admin URL hierarchy.

## [0.3.0] — 2026-06-29

**Phase 3 — Checklist templates.**

### Added
- **Checklist templates**: reusable lists of items/sections that can be applied to any issue.
  - **Global templates** managed under *Administration → Checklist templates* (admin-only), with optional **categories**.
  - **Per-project templates**: a *Checklist templates* tab on each project for members with the new `manage_checklist_templates` permission.
  - **Apply to an issue**: an "Apply template" control on the issue checklist panel (for users who can manage checklists) appends the template's items; the change is logged in the issue History.
  - **Auto-apply on creation**: a template marked *default* for a tracker is applied automatically (silently) when a new issue of that tracker is created — project default first, otherwise the global default.
  - **Item editor**: a simple one-item-per-line text editor; a line starting with `# ` becomes a section header.
  - REST: templates are listed via `GET /checklist_templates(.json)`; apply via `POST /issues/:id/checklist_items/apply_template`.
- New permission **`manage_checklist_templates`** (project-scoped template management).

### Tested
- 56 Playwright e2e tests (real Chrome). New `phase3-templates` spec covers admin template creation, applying a template to an issue (items added + wired + history, no JSON leak), silent tracker auto-apply on issue creation, and permission gating (view-only users get 403 on the project templates page and see no apply control).

## [0.2.1] — 2026-06-29

**Patch — History tab fixes & delete-icon polish.**

### Fixed
- **History tab showed raw JSON** (`Translation missing: …field_checklist changed from [{…}] to […]`). The `IssuesHelper#details_to_strings` override was registered only in a `to_prepare` block, which does not run during the plugin-load prepare pass, so the override never applied on boot. It is now applied at require-time (like the Issue patch), so checklist changes render as readable lines again.
- **History tab required a manual refresh (F5)** to show new entries after an AJAX check/uncheck/add/edit/delete. The issue **History** tab now refreshes in place after each checklist change.

### Added
- **Renames and deletions are now shown in history**, with id-aware diffing: a rename appears as a single *"renamed X → Y"* entry instead of a misleading delete + add; deletions render as a struck-through *"removed"* line.
- Delete control now uses Redmine's native **trashcan** icon (in destructive red) instead of an `✕` glyph.

### Tested
- 52 Playwright e2e tests (full suite, real Chrome). New `bugfix-history` spec asserts the History tab is human-readable and contains **no** raw JSON / "Translation missing", verifies live refresh without reload, and covers delete/rename history plus the trashcan icon. The Phase 2 journal spec was hardened to reject JSON markers (the old assertion matched the item subject *inside* the broken JSON dump).

## [0.2.0] — 2026-06-28

**Phase 2 — history, done-ratio, activity & search.**

### Added
- **Change history**: checklist changes (item done/reopened, added/removed) are recorded into the issue journal and rendered in the issue **History** tab. Gated by the `save_log` setting.
- **Consolidation**: rapid successive changes by the same user within a 1-minute window are merged into a single journal entry; a net round-trip (check then uncheck) leaves no noise.
- **Done-ratio integration**: when Redmine's done-ratio mode is *issue field* and the `affect_done_ratio` setting is on, the issue's % done is driven by checklist completion (tasks only; rounded to 10%). Applied without creating spurious journals.
- **Activity feed**: checklist items appear in the global Activity page under a "Checklists" type (opt-in).
- **Global search**: checklist item subjects are searchable (respecting `view_checklists`).
- Settings form now includes `save_log`, with hidden fields so unchecking persists correctly.

### Fixed
- Global search returned **HTTP 500** (`PG::AmbiguousColumn` on `created_on`) because `acts_as_searchable` defaulted to an unqualified date column while our table uses `created_at`; now qualified via `date_column`.

### Tested
- 46 Playwright e2e tests (35 Phase 1 + 11 Phase 2), deterministic across runs; search/activity assertions hardened to check HTTP 200 and matches within the results region.

## [0.1.0] — 2026-06-28

First public release — **Phase 1 MVP: interactive issue checklists**.

### Added
- Checklist panel on the issue page (via `view_issues_show_details_bottom` hook).
- Add **items** and **section headers** through two explicit buttons (Enter in the input adds an item). All AJAX, no page reload.
- **Inline edit** of item and section titles (pencil control; Enter saves, Esc cancels).
- **Check / uncheck** items via a dedicated `done` action, with a live progress bar and "x/y done" badge. Sections are excluded from progress.
- **Delete** items/sections (uses `aria-label`, so no lingering browser tooltip).
- **Drag-and-drop reorder** (jQuery UI sortable); order is persisted.
- **Flat group-header sections**: section rows visually group the items indented beneath them (no nesting/ownership).
- **Three-tier permissions** under the *Issue tracking* module — `view_checklists`, `done_checklists`, `manage_checklists` — enforced in the UI and on the server (direct calls without permission return 403).
- **Plugin settings**: show progress bar, affect done ratio, save change log.
- **REST API** (`accept_api_auth`) for index/create/update/destroy/done/reorder.
- Database schema: `checklist_items` (incl. forward-looking columns for assignment, due dates, mandatory, and completion audit) and `checklist_templates` + categories.
- Theme-aware CSS using CSS custom properties (integrates with the Prism theme, degrades on the default theme).

### Tested
- 35 Playwright end-to-end tests driving real Chrome across all permission tiers and every interaction (deterministic across runs).
- Unit + functional tests; eager-load boot check.

### Notes
- Built for Redmine 6.x; requires Redmine 5.0+. No proprietary gem dependencies.

[1.0.1]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v1.0.1
[1.0.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v1.0.0
[0.5.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.5.0
[0.4.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.4.0
[0.3.1]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.3.1
[0.3.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.3.0
[0.2.1]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.2.1
[0.2.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.2.0
[0.1.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.1.0
