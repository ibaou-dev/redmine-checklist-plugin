---
type: Reference
title: Use Cases & Personas
description: Concrete scenarios the plugin must support, drawn from competitive research and target personas.
status: accepted
tags: [use-cases, personas, requirements]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - overview.md
  - product/feature-matrix.md
---

# Use Cases & Personas

## Personas

- **Priya — Product Manager.** Wants a "definition of done" enforced on every story; checks completion at a glance without opening each issue.
- **Quentin — QA Engineer.** Runs structured test steps per issue; needs to assign steps and record sign-off (who tested, when).
- **Riya — Release Engineer.** Repeats the same deploy/smoke-test runbook every release; wants it pre-filled per "Release" tracker.
- **Sam — Team Lead.** Onboards new members with a standard checklist; tracks who finished which step.
- **Viewer — Stakeholder.** Read-only; sees progress but cannot edit.

## Use cases

### UC-1 — Definition of Done enforcement
Priya configures mandatory checklist items on the "Story" tracker via a template. An issue cannot transition to *Resolved* until all mandatory items are checked. Enforced across UI, bulk edit, and API.
**Features:** templates, mandatory items, status-transition block, permissions.

### UC-2 — QA sign-off
Quentin opens a bug, applies the "Regression Test" template, assigns specific steps to testers, sets due dates, and checks items as they pass. The audit trail records who completed each step and when; it appears in the issue history and activity feed.
**Features:** templates, per-item assignee, due dates, completion audit, journal/activity integration.

### UC-3 — Release runbook
Riya's "Release" tracker auto-applies the deployment checklist on issue creation. The team checks items during the release; progress shows on the issue list so managers see release status without opening issues.
**Features:** template tracker auto-apply, progress bar, issue-list completion column.

### UC-4 — Lightweight subtasks
A developer breaks a task into five small steps as checklist items instead of creating five child issues. The parent issue's done ratio reflects checklist completion automatically.
**Features:** items, sections, done-ratio integration.

### UC-5 — Onboarding
Sam applies the "New Engineer Onboarding" global template to an onboarding issue per hire. Each item is assigned to the new hire or a buddy; Sam tracks completion centrally.
**Features:** global templates, per-item assignee, progress tracking.

### UC-6 — Audit & compliance
Every checklist change is journaled with user and timestamp; completion records are immutable history. An auditor reviews the issue history to confirm process was followed.
**Features:** journal change-logging, completion audit, read-only stakeholder access.

### UC-7 — Bulk authoring
Quentin pastes a multi-line list of test steps from a spec; each line becomes a separate checklist item in one action.
**Features:** multiline paste bulk-add.

### UC-8 — API automation
A CI pipeline marks the "Smoke tests passed" checklist item done via the REST API when the test stage succeeds.
**Features:** REST API with `accept_api_auth`, done-toggle endpoint.

## Traceability

Each use case maps to features in [feature-matrix.md](feature-matrix.md) and to delivery phases in [roadmap.md](../planning/roadmap.md). UC-1, UC-2, UC-4 are the primary validation scenarios for v1.0.
