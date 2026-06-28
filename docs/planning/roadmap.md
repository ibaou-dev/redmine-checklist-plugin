---
type: Planning
title: Delivery Roadmap
description: Phased implementation plan from MVP through v1.0 and beyond, with per-phase exit criteria.
status: review
tags: [roadmap, planning, phases]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - planning/proposal.md
  - product/feature-matrix.md
  - architecture/data-model.md
  - architecture/integration-points.md
---

# Delivery Roadmap

Each phase is independently shippable and ends with a working, tested increment on the live dev instance. Implementation phases are delegated to Sonnet subagents under the `redmine-plugin-developer` skill; the orchestrator reviews and integrates.

## Phase 0 — Foundation ✅ (done)

- Plugin scaffold (`init.rb`, registration, permissions, settings).
- `ChecklistItem` model + migration (all columns present).
- `ChecklistTemplate` + categories migration.
- View hook rendering on issue show.
- Dev environment wired (bind mounts, Prism theme), migrations applied, eager-load clean.

**Exit:** plugin loads in the container, tables exist, issue page renders the (empty) checklist panel. ✔

## Phase 1 — MVP: interactive items ✅ (done — v0.1.0)

Goal: a fully usable single-issue checklist.

- ✅ Add items and section headers via two explicit buttons (Enter = add item); AJAX, no reload.
- ✅ Inline edit of item/section titles (pencil; Enter saves, Esc cancels).
- ✅ Checkbox done-toggle (dedicated `done` action) with live progress.
- ✅ Drag-and-drop reorder (jQuery UI sortable; persists `position`).
- ✅ Section headers (`is_section`) as flat group headers; items visually indented under them; sections excluded from progress.
- ✅ Progress bar + "x/y done" badge; respects `show_progress_bar` setting.
- ✅ Three-tier permissions (view / done / manage) enforced in views and on the server (403 on direct calls).
- ✅ Delete with `aria-label` (no lingering tooltip).
- ✅ Unit + functional tests; eager-load CI check; **35 Playwright e2e tests** (real Chrome, all tiers, every interaction).

**Exit:** a member can add, edit, check, reorder, and delete items; a viewer sees read-only; progress updates live. ✔ Verified e2e (two deterministic runs + visual review) and shipped as **v0.1.0**.

## Phase 2 — History & done-ratio ✅ (done — v0.2.0)

- ✅ Write checklist changes into the issue journal (diff-based), visible in the History tab and the Activity feed.
- ✅ Consolidate rapid edits (same user, 1-minute window) into one journal entry; net round-trips leave no noise.
- ✅ Optional contribution to issue `done_ratio` when Redmine is in "issue field" done-ratio mode and `affect_done_ratio` is on (tasks only, rounded to 10%, no spurious journals).
- ✅ `acts_as_activity_provider` + `acts_as_searchable` integration (search respects `view_checklists`).
- ✅ Fixed a global-search 500 (`acts_as_searchable` unqualified `created_on` vs our `created_at`).

**Exit:** checking items shows up in issue history and activity; done ratio reflects checklist completion when enabled. ✔ Verified e2e (46 tests, two deterministic runs) + independent behavioral checks (journal/consolidation/done-ratio/search/activity). Shipped as **v0.2.0**.

## Phase 3 — Templates

- `ChecklistTemplate` CRUD UI (admin + project scope).
- Template categories.
- Apply a template to an issue (adds its items).
- Auto-apply default template on issue creation when tracker matches.
- REST endpoints for templates.

**Exit:** a saved template can be applied manually and auto-applied per tracker on new issues.

## Phase 4 — Enforcement & assignment

- Mandatory items (`is_mandatory`) block configured status transitions, enforced at the `Issue` validation layer (holds for UI, bulk edit, and API).
- Per-item assignee + due date display and editing.
- Completion audit (`completed_by`, `completed_at`) surfaced in the UI.

**Exit:** moving an issue to a guarded status with unchecked mandatory items is rejected with a clear error, through every code path.

## Phase 5 — v1.0 polish

- Issue-list column/filter: filter and display issues by checklist completion.
- Multiline paste to bulk-add items.
- i18n: complete locale coverage beyond English.
- Prism theme co-styling pass.
- Cross-DB (PostgreSQL + MySQL) and cross-version (5.0, 6.1) verification.
- Packaging, README, install docs, release tag.

**Exit:** v1.0 tagged and installable via the standard Redmine plugin flow.

## Beyond v1.0 (backlog)

- Per-item file attachments and comments.
- Cross-project checklist reporting/dashboard.
- Due-date surfacing in calendar/Gantt.
- Webhooks / email notifications on item assignment.

## Sequencing rationale

MVP first validates the core UX (the riskiest UX surface) against the live Prism-themed instance before investing in templates and enforcement. History and done-ratio precede enforcement because enforcement depends on reliable item state being recorded.
