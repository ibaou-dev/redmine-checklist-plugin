# Changelog — Knowledge Base

All notable changes to this docs bundle.

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
