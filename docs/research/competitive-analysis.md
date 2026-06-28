---
type: Reference
title: Competitive Analysis — Existing Checklist Plugins
description: Teardown of RedmineFlux, RedmineUP (free/PRO), and Advanced Checklists — features, data hints, limitations.
status: accepted
tags: [research, competitive, market]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - planning/proposal.md
  - product/feature-matrix.md
  - research/reference-plugin-teardown.md
---

# Competitive Analysis

Three reference products surveyed. Conclusions feed [feature-matrix.md](../product/feature-matrix.md) and [proposal.md](../planning/proposal.md).

## 1. RedmineFlux Checklist (commercial)

Source: <https://www.redmineflux.com/product/redmine-plugins/checklist/>

**Core**
- Checklist items on any issue; rich-text item descriptions.
- Mandatory vs. optional items; **mandatory items block issue status transitions until ticked**.
- Inline edit, drag-and-drop reorder.
- Progress indicators on the issue and in the issue list (completion summary without opening the issue).

**Templates**
- Named templates, project-level or global/admin.
- Versioned: changes apply to new issues only (never retroactive).
- Integrates with the Issue Template plugin for embedding during creation.

**Item assignment**
- Assign individual items to users; assigned items appear in activity feeds; email notifications to assignees; audit trail of who completed each item and when.

**Permissions** — separate create / edit / mark-complete; read-only stakeholder access.

**Limitations** — template changes intentionally non-retroactive; supports only the three most recent Redmine releases; self-hosted/managed cloud only.

## 2. RedmineUP / Restream `redmine_checklists` (open source)

The most widely deployed OSS implementation. GPL-3.0. The local `.references/redmine_checklists/` is the **Light (free)** build; see the full teardown in [reference-plugin-teardown.md](reference-plugin-teardown.md).

**Free (Light) features**
- Add/remove/mark-done via AJAX; drag-and-drop reorder (`acts_as_list`).
- Section headers (`is_section`) for grouping.
- Multiline paste to add many items.
- Optional change log into issue journals.
- Optional done-ratio drive (requires Redmine done-ratio = "issue field").
- Full REST API; global search (`acts_as_searchable`); activity feed (`acts_as_activity_provider`).
- Templates: named, project/global, categorized, public/private, tracker-linkable, default flag.
- Permissions: `view_checklists`, `done_checklists`, `edit_checklists`.
- Settings: `save_log`, `issue_done_ratio`. 14-language i18n.

**PRO-only (gated)**
- Change history **with email notifications**.
- Checklist **filters on issue queries**.
- Template categorization UI; tracker auto-assignment UI.

**Limitations** — depends on the proprietary `redmineup` gem; free build lacks notifications and issue-list filters; flat items (sections only, no nesting).

## 3. Advanced Checklists (commercial)

Goes beyond RedmineUP with per-item **assignment, deadlines, comments, file attachments**, per-item change history, text-file import, checklist-level search, and automation (auto-add a checklist when an issue reaches a status). Requires Redmine at domain root (architectural limitation). Unlimited items.

## Synthesis

- **Table stakes:** items + sections + reorder + AJAX + progress + permissions + journals + REST. Everyone has these; we must too (Phase 1–2).
- **Free-market gap:** the free RedmineUP build lacks **mandatory-item enforcement**, **per-item assignment/due dates**, and **issue-list filters**. RedmineFlux/Advanced have them but are paid.
- **Our wedge:** deliver mandatory-item enforcement + per-item assignment for free, with **no proprietary gem dependency**. See [proposal.md](../planning/proposal.md) differentiation table.
- **Patterns worth copying:** journal consolidation window (1 min, same user); sections excluded from ratio; template tracker auto-apply; done-ratio only in "issue field" mode.
