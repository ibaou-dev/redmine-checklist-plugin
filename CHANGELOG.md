# Changelog

All notable changes to the Redmine Checklist plugin are documented here.
The format is based on [Keep a Changelog](https://keepachangelog.com/), and this
project adheres to [Semantic Versioning](https://semver.org/).

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

[0.1.0]: https://github.com/ibaou-dev/redmine-checklist-plugin/releases/tag/v0.1.0
