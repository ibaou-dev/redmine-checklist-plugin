---
type: Feature Spec
title: Research — Checklist assignee & due date in issue queries, calendar & Gantt
description: What it takes to make an issue surface in assignee-based and due-date-based views (queries, "assigned to me", calendar, Gantt) because of its CHECKLIST items, not just the issue's own fields. Grounded in Redmine 6.1 query/calendar internals.
status: accepted
tags: [research, queries, filters, calendar, gantt, assignee, due-date]
timestamp: 2026-07-02T10:00:00Z
relates-to:
  - architecture/integration-points.md
  - product/feature-matrix.md
  - planning/roadmap.md
---

# Research — Surface issues by their checklist items in queries / calendar / Gantt

> **Delivered in v1.3.0 (2026-07-02):** item 1 (assignee) shipped as a **fold into
> the native Assignee filter, ON by default** (product-owner decision — a checklist
> assignment IS an assignment; opt-out only, via a kill-switch) rather than the
> default-off / separate-filter framing originally floated in §2. Item 2 shipped as
> a separate **"Checklist due" filter** + the existing sortable column, plus a
> "Checklist assignees" column and an index on `checklist_items.assignee_id`.
>
> **Calendar/Gantt — solved a better way (v1.3.0):** rather than patching the core
> Calendar/Gantt widgets (§3, rejected as fragile), the plugin now **derives the
> issue's own `due_date`** from its checklist items — combined with subtasks,
> latest-wins, exactly like Redmine derives a parent's due from its children
> (`ChecklistItem.recalc_due_date`, setting `combine_checklist_due`, default on).
> Because the issue genuinely gets a `due_date`, it appears in Calendar, Gantt,
> due-date reminders, and the built-in due filter **natively** — no core-widget
> surgery. Checklist items contribute a due date only (no start date).

Two asks:

1. **Assignee.** When a checklist *item* is assigned to a user (even if the issue
   itself is unassigned or assigned to someone else), that user should be able to
   find the issue via assignee-based views — "Issues assigned to me" and, more
   generally, filtering issues by assignee.
2. **Due date.** When a checklist *item* has a due date (even if the issue has
   none), the issue should be considered by due-date views — saved queries,
   calendar, Gantt.

This document analyses the Redmine mechanics, lays out the options with their
trade-offs, and recommends an approach. No code is written yet.

---

## 1. How Redmine querying actually works (the hooks we have)

Read from Redmine 6.1 core (`app/models/query.rb`, `app/models/issue_query.rb`,
`app/controllers/calendars_controller.rb`, `gantts_controller.rb`).

### 1.1 Filters are pluggable via `add_available_filter` + `sql_for_<field>_field`
`IssueQuery#initialize_available_filters` registers each filter with
`add_available_filter("name", type:, values:)`. When building the WHERE clause,
`Query#statement` dispatches (query.rb:1025):
```ruby
elsif respond_to?(method = "sql_for_#{field.tr('.', '_')}_field")
  filters_clauses << send(method, field, operator, v)
```
So a **plugin can add a brand-new filter** whose SQL is an arbitrary **subquery**.
The built-in `watcher_id` filter is the template (issue_query.rb:551) — it emits
`issues.id IN (SELECT … FROM watchers WHERE user_id = …)`, handles the special
**"me"** value, and respects visibility. We can do exactly this against
`checklist_items`.

### 1.2 Columns are pluggable too (already used)
We already add the `checklist_progress` and `checklist_due_date` **columns** via a
prepend on `IssueQuery#available_columns`. Same mechanism extends to an assignee
column.

### 1.3 "Assigned to me" is just the `assigned_to_id` filter with value `me`
There is no separate mechanism — the standard page is a query with
`assigned_to_id = me`. The built-in `assigned_to_id` filter has **no**
`sql_for_assigned_to_id_field` method; it falls through to the generic
`sql_for_field` on `issues.assigned_to_id`. That means we *can* introduce our own
`sql_for_assigned_to_id_field` (via a prepend) to **change what that filter
matches** — but doing so alters core semantics globally (see §2, option C).

### 1.4 Calendar & Gantt filter by the issue's OWN date columns, in raw SQL
The calendar does **not** rely on a filter for dates. `CalendarsController#show`
runs the query and then **adds a raw SQL condition** (calendars_controller.rb:47):
```ruby
@query.issues(conditions:
  "((start_date BETWEEN ? AND ?) OR (due_date BETWEEN ? AND ?))", …)
```
i.e. it reads `issues.start_date` / `issues.due_date` directly, and positions each
event on the issue's own dates. Gantt (`GanttsController` + `Redmine::Helpers::Gantt`)
likewise draws bars from `issue.start_date`/`issue.due_date`/`issue.done_ratio`.
**Neither has an extension point for "some other date".** So making an issue appear
on the calendar/Gantt *because of a checklist item's date* — and especially
positioning it there — requires **patching those controllers/helpers**, not just
adding a filter. This is the crux of item 2's difficulty and mirrors the earlier
pragmatic decision on due-date surfacing.

---

## 2. Item 1 — assignee

### What's cleanly feasible
**A new filter + column** for checklist assignee, entirely additive:
- Filter `checklist_assignee_id` (type `:list_optional`, values = assignable
  users + **me**) via `add_available_filter` in an `IssueQuery` prepend, backed by
  `sql_for_checklist_assignee_id_field`:
  ```sql
  issues.id IN (SELECT issue_id FROM checklist_items
                WHERE is_section = false AND assignee_id IN (…))
  ```
  Users can then build and **save** queries like "Checklist assignee = me", and it
  works in the issue list, bulk ops, and the API — all for free once the filter
  exists. Effort: **small** (mirror `watcher_id`).
- Optional column `checklist_assignees` showing the distinct users with items on
  the issue. Effort: small.

### The harder part: making the *standard* "Assigned to me" include it
Three options, increasingly invasive:

- **Option A — separate filter only (recommended default).** Ship the
  `checklist_assignee_id` filter (with "me"). "Issues assigned to me" stays
  issue-level; users who want the combined view add the checklist-assignee filter
  (or we ship a **saved query** "Assigned to me (incl. checklist)" using an `OR`
  of the two — note: core queries are AND-only across filters, so a true OR needs
  option B/C or a custom query). Zero core-semantics change.
- **Option B — a combined "assignee (incl. checklist)" filter.** One filter whose
  subquery matches `issues.assigned_to_id IN (…) OR issues.id IN (SELECT …
  checklist_items …)`. Users pick this filter explicitly; the default page is
  unchanged. Clean, opt-in, gives the OR semantics in one filter. Effort: small-medium.
- **Option C — extend the built-in `assigned_to_id` filter** by defining
  `sql_for_assigned_to_id_field` to OR-in the checklist subquery. This makes the
  **default "Assigned to me" and every existing assignee query** also return
  issues with a checklist item assigned to the value. Most "magical" / matches the
  ask most literally, but **changes core behaviour globally** and can surprise
  users (an issue assigned to Bob appears under Alice because Alice has a checklist
  item on it). **Gate behind a plugin setting** (default off) if we do it.

**Recommendation:** ship **Option B** (a combined opt-in filter) + the column, and
optionally **Option C behind a default-off setting** for teams that want the
standard page to reflect it. Avoid changing core semantics on by default.

### Caveats
- **Visibility:** the subquery must not leak issues the user can't see — but the
  outer query already applies `Project.allowed_to_condition`, so `issues.id IN
  (subquery)` is safe (it only narrows). No extra visibility gate needed for the
  assignee filter (unlike watchers, which have their own permission).
- **Performance:** an `IN (SELECT issue_id FROM checklist_items WHERE …)` is
  indexed-friendly if `checklist_items.assignee_id` is indexed — **add an index**
  (currently only `converted_issue_id` is indexed). Small migration.

---

## 3. Item 2 — due date

### Cleanly feasible: a due-date FILTER (completes what the column started)
We already have a sortable `checklist_due_date` **column**. Add the matching
**filter** `checklist_due_date` (type `:date`) via `sql_for_checklist_due_date_field`:
```sql
issues.id IN (SELECT issue_id FROM checklist_items
              WHERE is_section = false AND is_done = false
                AND due_date BETWEEN … )   -- operator-dependent
```
This gives saved-query / issue-list filtering "checklist due this week / overdue /
before X", plus API. Effort: **small-medium** (date operators: `=`, `<=`, `>=`,
`><`, `t`, `w`, `t+`, etc. — reuse `sql_for_field` with the subquery's date column).

### The hard part: calendar & Gantt placement
As established in §1.4, calendar/Gantt read the issue's own `start_date`/`due_date`
in raw SQL and position events there. To surface an issue on the calendar/Gantt
*by its checklist due date* there are only invasive routes:
- **Patch `CalendarsController#show`** to widen its date condition to also match
  `issues.id IN (SELECT … checklist_items … due_date BETWEEN …)`, AND patch the
  calendar event rendering to place the issue on the checklist date (the helper
  keys off `issue.due_date`). Two coupled patches; fragile across versions/themes.
- **Gantt** is worse: `Redmine::Helpers::Gantt` computes bar geometry from
  `issue.start_date`/`due_date`/`done_ratio` deep inside; injecting a different
  date means overriding a large private method — high maintenance risk.

**Recommendation:** ship the **filter** (robust, high value — completes the
column). **Do not** patch calendar/Gantt placement now; it's low-ROI and fragile.
If a team really needs checklist deadlines on the calendar, the honest answer
remains **convert the item to a subtask** — a real issue that appears natively.
(Optionally, a *future* lightweight "checklist deadlines" mini-calendar page owned
by the plugin could render our own data without touching core — its own feature.)

---

## 4. Summary & recommendation

| Piece | Feasibility | Effort | Recommend |
|---|---|---|---|
| Checklist-assignee **filter** (+ "me") | Clean, additive | Small | **Yes** |
| Combined "assignee incl. checklist" filter (Option B) | Clean, opt-in | Small-med | **Yes** |
| Extend core "Assigned to me" (Option C) | Changes core semantics | Small | Only behind a default-off setting |
| Checklist-assignee **column** | Clean | Small | Yes (nice-to-have) |
| Checklist-due **filter** | Clean, additive | Small-med | **Yes** |
| Calendar/Gantt **placement** by checklist due | Requires patching core internals | High, fragile | **No** (convert-to-subtask instead) |
| Index on `checklist_items.assignee_id` (+ maybe `due_date`) | migration | Trivial | Yes (with the filters) |

**Proposed package (a natural v1.3.0):** the checklist-**assignee** filter (with a
combined opt-in variant), the checklist-**due** filter, an assignee column, and the
supporting index — all additive, all query/API-level, no core-behaviour change by
default. Optionally a default-off setting to fold checklist assignees into the
built-in "Assigned to me". Calendar/Gantt placement is explicitly **out** (fragile;
covered by convert-to-subtask).

**Value:** high and well-aligned — it makes per-item assignment and due dates
*actionable* (people can actually find their work), which is the point of having
them. The filter/column route is low-risk because it rides Redmine's own query
extension points; the only thing we deliberately avoid is the fragile calendar/Gantt
internals.
