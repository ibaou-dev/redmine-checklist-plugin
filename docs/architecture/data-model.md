---
type: Architecture
title: Data Model
description: Tables, columns, relationships, and indexing for the checklist plugin.
status: accepted
tags: [architecture, database, schema]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - architecture/integration-points.md
  - research/reference-plugin-teardown.md
---

# Data Model

Three tables. The `checklist_items` schema provisions columns for later phases up front so no migration is needed to begin enforcement/assignment work.

## `checklist_items`

One row per item on an issue.

| Column | Type | Null | Default | Purpose |
|---|---|---|---|---|
| `id` | bigint PK | no | | |
| `issue_id` | bigint FK→issues | no | | owning issue; indexed |
| `subject` | string(1000) | no | | item text |
| `is_done` | boolean | no | false | checked state |
| `is_section` | boolean | no | false | section header (cosmetic; excluded from progress) |
| `is_mandatory` | boolean | no | false | must be checked to pass guarded status transition |
| `position` | integer | no | 0 | ordering within the issue |
| `author_id` | integer | yes | | who created the item |
| `assignee_id` | integer | yes | | optional per-item assignee |
| `due_date` | date | yes | | optional per-item due date |
| `completed_by_id` | integer | yes | | who checked it (audit) |
| `completed_at` | datetime | yes | | when it was checked (audit) |
| `created_at` / `updated_at` | datetime | no | | timestamps |

Relationships (model `ChecklistItem`):

- `belongs_to :issue`
- `belongs_to :author` / `:assignee` / `:completed_by` (class `User`, optional)
- `Issue has_many :checklist_items, -> { order(:position) }, dependent: :destroy`

Scopes: `done`, `pending`, `ordered`, `tasks` (non-section), `sections`.

Completion stamping: a `before_save` hook sets `completed_by_id`/`completed_at` when `is_done` flips true (and clears them when unchecked), skipping sections.

## `checklist_templates`

Named reusable checklists.

| Column | Type | Null | Purpose |
|---|---|---|---|
| `id` | bigint PK | no | |
| `name` | string(255) | no | template name |
| `project_id` | integer | yes | null = global, else project-scoped (indexed) |
| `tracker_id` | integer | yes | auto-apply to issues of this tracker (indexed) |
| `category_id` | integer | yes | FK→checklist_template_categories (indexed) |
| `user_id` | integer | yes | owner |
| `is_public` | boolean | no | visible to others |
| `is_default` | boolean | no | default for its scope |
| `template_items` | text | yes | serialized item subjects (JSON/newline) |
| `created_at` / `updated_at` | datetime | no | |

## `checklist_template_categories`

| Column | Type | Null | Purpose |
|---|---|---|---|
| `id` | bigint PK | no | |
| `name` | string(255) | no | category name |
| `position` | integer | no | ordering |
| `created_at` / `updated_at` | datetime | no | |

## Design notes

- **Why columns up front:** provisioning `is_mandatory`, `assignee_id`, `due_date`, and audit columns in the Phase-0 migration avoids churn; unused columns are cheap and keep Phase 4 migration-free.
- **`subject` length 1000** matches the RedmineUP reference, supporting long item text and pasted lines.
- **Sections** are rows like any other but `is_section = true`; they render as headers and never count toward progress or done-ratio.
- **Template items** stored denormalized (serialized) rather than as a child table — templates are write-rarely, read-rarely, and applied by expansion into `checklist_items`. Revisit if per-template-item metadata (assignee defaults, mandatory flags) is needed.

## Open questions

- Should template items carry `is_mandatory`/`is_section` flags so applying a template seeds those? (Likely yes for UC-1; would push `template_items` toward structured JSON.)
- Indexing: add a composite index on `(issue_id, position)` if reorder/read profiles show need.
