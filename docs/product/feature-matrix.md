---
type: Feature Spec
title: Feature Matrix — Must-Have vs. Nice-to-Have
description: Prioritized feature inventory synthesized from competitive research, mapped to roadmap phases.
status: review
tags: [features, prioritization, mvp]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - planning/roadmap.md
  - research/competitive-analysis.md
  - architecture/integration-points.md
---

# Feature Matrix

Priority key: **P0** = MVP, **P1** = v1.0, **P2** = post-v1.0. Phase refers to [roadmap](../planning/roadmap.md).

## Must-have (baseline parity)

| Feature | Priority | Phase | Notes |
|---|---|---|---|
| Checklist items on issues (CRUD) | P0 | 1 | `checklist_items` table; `issue_id`, `subject`, `is_done`, `position` |
| AJAX add/check/delete (no reload) | P0 | 1 | `format.js` responses |
| Section headers | P0 | 1 | `is_section`; excluded from progress/ratio |
| Drag-and-drop reorder | P0 | 1 | persist `position` |
| Progress bar + done badge | P0 | 1 | gated by `show_progress_bar` setting |
| Role-based permissions (view/done/manage) | P0 | 1 | under `:issue_tracking` module |
| Change logging into issue journals | P1 | 2 | diff-based; consolidate rapid edits |
| Done-ratio integration | P1 | 2 | only when Redmine done-ratio = "issue field" |
| Activity feed + global search | P1 | 2 | `acts_as_activity_provider`, `acts_as_searchable` |
| Checklist templates (project/global) | P1 | 3 | `checklist_templates`; public/private, default flag |
| Template auto-apply per tracker | P1 | 3 | `tracker_id` match on issue create |
| REST API (all actions) | P0/P1 | 1–3 | `accept_api_auth`; mirror UI capabilities |
| Plugin settings | P0 | 1 | `show_progress_bar`, `affect_done_ratio`, `save_log` |

## Differentiators (nice-to-have)

| Feature | Priority | Phase | Source / rationale |
|---|---|---|---|
| Mandatory items block status transition | P1 | 4 | RedmineFlux; headline differentiator vs free options |
| Per-item assignee | P1 | 4 | Advanced Checklists; `assignee_id` |
| Per-item due date | P1 | 4 | Advanced Checklists; `due_date` |
| Completion audit (who/when) | P1 | 4 | `completed_by_id`, `completed_at` |
| Issue-list **column** by completion | P1 | 5 | done (v1.0.0); **filter** dropped |
| Multiline paste → bulk add | P1 | 7 | done (v1.2.0); JS split on newline |
| Full i18n coverage | P1 | — | dropped/deprioritized (English complete) |
| Cross-project reporting/dashboard | P2 | backlog | net-new |
| Email notifications on assignment | P1 | 7 | done (v1.2.0); email + JSON webhook |

## Explicit non-goals (v1.0)

- Nested/hierarchical items beyond a single section level (flat list + sections only).
- Checklist due dates are now surfaced **pragmatically** — a "next due" chip on the issue + a sortable "Checklist due" column — but native Gantt/calendar **entry injection** of item due dates remains a non-goal (converted items already appear as real issues in calendar/Gantt).
- Real-time multi-user collaborative editing.

## Data fields already provisioned

The Phase 0 migration already includes columns for later phases (`is_mandatory`, `assignee_id`, `due_date`, `completed_by_id`, `completed_at`, `author_id`) so no schema change is needed to start Phase 4. See [architecture/data-model.md](../architecture/data-model.md).
