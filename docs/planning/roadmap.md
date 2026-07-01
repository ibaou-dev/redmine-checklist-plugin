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

## Phase 3 — Templates ✅ (done — v0.3.0)

- ✅ `ChecklistTemplate` CRUD UI — global (admin) **and** per-project scope (`manage_checklist_templates` permission; project *Checklist templates* tab).
- ✅ Template categories (admin-managed).
- ✅ Apply a template to an issue (appends its items; logged in History).
- ✅ Auto-apply default template on issue creation when the tracker matches (project default → global default; silent, no journal).
- ✅ REST endpoints (`GET /checklist_templates(.json)`, `POST .../checklist_items/apply_template`).
- ✅ One-item-per-line textarea editor (`# ` prefix = section header).

**Exit:** a saved template can be applied manually and auto-applied per tracker on new issues. ✔ Verified e2e (56 tests, real Chrome) + independent behavioral checks (template_text parsing, default_for resolution, auto-apply on real issue creation, apply wiring, permission gating). Shipped as **v0.3.0**.

## Phase 4 — Enforcement & assignment ✅ (done — v0.4.0)

- ✅ Mandatory items (`is_mandatory`) block configured status transitions, enforced at the `Issue` validation layer (holds for the issue form, bulk edit, and API). Enforcement is a global plugin setting: enable it + pick the guarded statuses. Blocks the *transition* into a guarded status (`status_id_changed?`).
- ✅ Per-item assignee + due date editing via an expandable detail row; assignee/due shown inline; overdue not-done due dates highlighted.
- ✅ Completion audit (`completed_by`, `completed_at`) surfaced as a `✓` with a "Completed by … on …" tooltip.

**Exit:** moving an issue to a guarded status with unchecked mandatory items is rejected with a clear error, through every code path. ✔ Verified e2e (59 tests) + independent checks through the real edit form and DB. Shipped as **v0.4.0**.

## Phase 5 — v1.0 polish ✅ (done — v1.0.0)

- ✅ Issue-list **column**: optional "Checklist" column showing `done/total · %` on the issue list / saved queries (exports to CSV/PDF). *(A completion **filter** was deferred — see future work.)*
- ✅ i18n pass: every user-facing string sourced from a locale key; English locale complete (verified no "Translation missing" across all plugin pages).
- ✅ Prism theme co-styling — the plugin is built and visually verified against the Prism theme throughout.
- ✅ Compatibility set honestly to **Redmine 6.0+** (Rails 7.2, Ruby 3.x) — the tested target; the migrations/code use Rails 7.2 / Ruby 3.x features, so the earlier "5.0+" claim was dropped.
- ✅ Packaging, README, install docs, release tag (v1.0.0).

**Exit:** v1.0 tagged and installable via the standard Redmine plugin flow. ✔ Shipped as **v1.0.0** (64 e2e tests).

### Deferred to future work
- Cross-DB (MySQL) / older-version runtime verification (developed and tested on PostgreSQL + Redmine 6.1; code uses portable ActiveRecord only — no raw vendor SQL). Planned on a separate branch.

*(**Multiline paste** to bulk-add items — since **shipped in v1.2.0**, see Phase 7.)*

## Phase 6 — Convert to subtask & combined done-ratio ✅ (done — v1.1.0 / v1.2.0)

- ✅ Convert a checklist item → real child issue via a prefilled new-issue form (v1.1.0), plus **one-click "Quick convert"** on the parent's tracker (v1.2.0).
- ✅ The original item is retained as a **locked linked row** that mirrors the subtask's open/closed (done) state.
- ✅ Issue `done_ratio` combines **checklist items + subtasks** (settings `subtask_done_ratio` on/off, `count_subtask_when_full`).
- ✅ Live `done_ratio` refresh.

## Phase 7 — Notifications & due-date surfacing ✅ (done — v1.2.0)

- ✅ **Email + JSON webhook** to a checklist item's assignee on assignment (both setting-gated, off by default).
- ✅ **"Next checklist due"** chip on the issue + a sortable **"Checklist due"** issue-list column (converted items are real issues that already appear in calendar/Gantt).
- ✅ **Multiline paste** → bulk-add items.

## Beyond v1.0 (backlog)

- Cross-project checklist reporting/dashboard.
- Convert a checklist item to a subtask on a *different* tracker (e.g. a 'deploy' item → a Deployment tracker; a 'merge/cherry-pick' item → a Merge-request tracker).

## Sequencing rationale

MVP first validates the core UX (the riskiest UX surface) against the live Prism-themed instance before investing in templates and enforcement. History and done-ratio precede enforcement because enforcement depends on reliable item state being recorded.
