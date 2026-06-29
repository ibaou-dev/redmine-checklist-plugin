# Changelog

All notable changes to the Redmine Checklist plugin are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and this
project adheres to [Semantic Versioning](https://semver.org/).

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

[0.2.1]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.2.1
[0.2.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.2.0
[0.1.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.1.0
