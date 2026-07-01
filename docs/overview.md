---
type: Explanation
title: Project Overview & Vision
description: What the Redmine Checklist plugin is, who it serves, and the boundaries of its scope.
status: accepted
tags: [overview, vision, scope]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - planning/proposal.md
  - product/feature-matrix.md
---

# Project Overview & Vision

## What it is

`redmine_checklist` is an open-source Redmine plugin that adds **checklists to issues**. An issue gains an ordered list of small, checkable items — subtasks too lightweight to warrant their own issue — with progress tracking, optional templates, and an audit trail.

It is built for **Redmine 6.x** (Rails 7.2 / Ruby 3.2+), targeting `requires_redmine version_or_higher: '5.0'`, and is designed to look good alongside the [Prism theme](https://github.com/ibaou-dev/redmine-theme-prism) by consuming its CSS custom properties rather than hardcoding colors.

## Why it exists

Teams routinely need a "definition of done," QA sign-off steps, release runbooks, or onboarding lists attached to an issue. Today they either:

- Create child issues for every small step (heavy, noisy, clutters the tracker), or
- Track steps in the description as Markdown checkboxes (no progress %, no permissions, no audit, no templates), or
- Pay for a commercial plugin (RedmineFlux, RedmineUP PRO, Advanced Checklists).

This plugin delivers the commercial feature set as a clean, modern, GPL-licensed, dependency-light alternative.

## Who it serves

- **Project / product managers** — enforce a definition of done; track completion at a glance.
- **QA engineers** — structured, assignable test steps with sign-off.
- **Release / ops engineers** — reusable release & deployment checklists via templates.
- **Team leads** — onboarding and process checklists applied per tracker.

See [product/use-cases.md](product/use-cases.md) for detailed scenarios.

## Principles

1. **Dependency-light.** Unlike RedmineUP's plugin, no `redmineup` gem dependency. Pure Rails + Redmine APIs.
2. **Native feel.** Use Redmine's hooks, permissions, journals, and REST conventions so it behaves like core.
3. **Progressive enhancement.** Works without JS; AJAX layered on top.
4. **Theme-aware.** Inherit Prism's design tokens; degrade gracefully on the default theme.
5. **API-first.** Everything doable in the UI is doable over the REST API.

## In scope (v1.0)

- Checklist items on issues (CRUD, AJAX, REST API)
- Section headers, drag-and-drop reorder
- Progress bar + done ratio integration
- Role-based permissions (view / done / manage)
- Change logging into issue journals
- Checklist templates (project/global, tracker-linked)
- Mandatory items that block status transitions

## Out of scope (for now)

- Per-item file attachments and threaded comments (heavy) — intentionally handled by **converting an item to a subtask** (a real issue with attachments and comments) rather than built into checklist items
- Cross-project checklist dashboards / reporting
- Nested/hierarchical items beyond a single section level

See [planning/roadmap.md](planning/roadmap.md) for how scope is sequenced.
