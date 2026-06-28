# Changelog — Knowledge Base

All notable changes to this docs bundle.

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
