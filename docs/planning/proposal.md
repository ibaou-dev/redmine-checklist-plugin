---
type: Proposal
title: Product Proposal — Redmine Checklist Plugin
description: The problem, the proposed solution, market differentiation, and success criteria.
status: review
tags: [proposal, product, strategy]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - overview.md
  - product/feature-matrix.md
  - planning/roadmap.md
  - research/competitive-analysis.md
---

# Product Proposal — Redmine Checklist Plugin

## Problem

Redmine issues are the unit of work, but real tasks contain many small steps that don't deserve their own issue. Redmine offers no first-class way to track these. Workarounds (child issues, Markdown checkboxes in the description) lack progress tracking, permissions, audit history, reusability, and enforcement.

Commercial solutions exist but are paid, and the leading free option (RedmineUP Checklists "Light") drags in the proprietary `redmineup` gem and gates the genuinely useful features (change history with notifications, issue-list filters, template categorization) behind the PRO license.

## Proposed solution

A clean-room, GPL-3.0, dependency-light checklist plugin for Redmine 6.x that delivers the commercial feature set:

- **Core:** add/edit/remove/check items on any issue, inline and via AJAX; drag-and-drop reorder; section headers to group items.
- **Progress:** a progress bar on the issue and optional contribution to the issue's done ratio.
- **Governance:** three-tier permissions (view / mark-done / manage); every change written into the issue's journal so it appears in history and activity.
- **Reuse:** named templates, project-scoped or global, optionally auto-applied per tracker.
- **Enforcement:** mandatory items that block a status transition (e.g. cannot move to *Resolved* until all required items are checked) — the headline differentiator vs. the free RedmineUP plugin.
- **Integration:** full REST API, global search, activity feed.

## Differentiation

| Capability | This plugin | RedmineUP Light (free) | RedmineUP PRO | RedmineFlux |
|---|---|---|---|---|
| License | GPL-3.0, free | GPL-3.0, free | Commercial | Commercial |
| `redmineup` gem dependency | **No** | Yes | Yes | n/a |
| Sections, reorder, AJAX | Yes | Yes | Yes | Yes |
| Change history in journals | **Yes** | Yes (basic) | Yes + email | Yes |
| Mandatory items block status | **Yes** | No | No | Yes |
| Templates (tracker auto-apply) | **Yes** | Partial | Yes | Yes |
| Issue-list column by completion | **Yes** (filter dropped) | No | Yes | Yes |
| Per-item assignee + due date | **Yes** | No | No | Yes (PRO) |
| REST API | Yes | Yes | Yes | Yes |

The wedge: **free + no proprietary gem + enforcement (mandatory items) + per-item assignment**, which no single free option offers today.

## Success criteria

- **Functional:** an issue can carry a checklist; progress is visible; a mandatory item blocks the configured status transition; a template can be applied; all of it works over REST.
- **Quality:** eager-load boot check passes in CI; unit + functional tests green; no `redmineup` or other proprietary dependency.
- **Compatibility:** installs cleanly on Redmine 6.0+ with PostgreSQL (tested). MySQL is untested, but the code uses portable ActiveRecord throughout (no vendor-specific SQL).
- **Adoption signal:** published to GitHub with docs; installable via the standard Redmine plugin flow.

## Risks & mitigations

- **Core API drift across Redmine versions** → pin to documented hooks; eager-load check in CI; tested target is Redmine 6.x.
- **Mandatory-item enforcement edge cases** (bulk edits, API status changes, workflow plugins) → enforce in the `Issue` model validation layer, not just the controller, so it holds across all paths.
- **Journal/history performance on large checklists** → consolidate rapid successive edits into one journal entry (RedmineUP pattern: same user within a 1-minute window).
- **Scope creep** (attachments, comments, dashboards) → explicitly deferred; see [overview.md](overview.md) non-goals.

## Recommendation

Proceed with the phased plan in [planning/roadmap.md](planning/roadmap.md). Ship a tight MVP (items + progress + permissions + journals) first to validate the core UX against the live Prism-themed dev instance, then layer templates and enforcement.
