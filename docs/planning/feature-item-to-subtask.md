---
type: Feature Spec
title: Feature Request — Convert Checklist Item to Subtask
description: Promote a single checklist item (task) into a real child issue, carrying its metadata, gated by parent/item state, with a prefilled-vs-auto-create strategy grounded in how Redmine actually builds issues.
status: accepted
tags: [feature-request, subtasks, issues, enforcement, workflow]
timestamp: 2026-07-01T12:00:00Z
relates-to:
  - product/feature-matrix.md
  - architecture/data-model.md
  - architecture/integration-points.md
  - planning/roadmap.md
---

# Feature Request — Convert Checklist Item → Subtask

> **Delivery status:** **Phase 1 delivered in v1.1.0** (2026-07-01) — the prefilled-form
> conversion path (§4.4 A), the retained locked linked row + done-state mirror (§4.3, §4.6),
> the `converted` History event, migration 005, and the permission/parent-open guards.
> **Phase 2 (Quick auto-convert, §4.4 B) is now shipped in v1.2.0** — one-click conversion
> on the **parent's tracker**, with a required-field pre-flight (falling back to the prefilled
> form when a required field can't be supplied). The proposed per-project `subtask_tracker_id`
> setting was **dropped** — quick convert uses the parent's tracker. A separate **future** idea
> is converting an item to a subtask on a *different* tracker (e.g. a 'deploy' item → a
> Deployment tracker, a 'merge/cherry-pick' item → a Merge-request tracker).

## 1. Summary

Add a per-item action **"Convert to subtask"** that promotes a single checklist
**task** (never a section) into a real Redmine **child issue** of the item's
parent issue, carrying over the item's `subject`, `assignee`, and `due_date`.
The original checklist item is **retained as a linked, locked row** that mirrors
the subtask's open/closed state.

The conversion is **one-way** (item → issue). The reverse (issue → item) is
explicitly a **non-goal**: an issue holds strictly richer information (status
workflow, journals, time entries, relations, custom fields) that a checklist row
cannot represent, so downgrading would be lossy and meaningless.

**Rationale (the "why"):** a checklist item is the right tool while a step is a
simple binary *done / not-done*. Sometimes, mid-flight, a step turns out to
deserve its own workflow — an assignee who needs to accept it, a review status,
its own due date and time tracking, its own comments. Today the only path is to
manually create a child issue and delete the checklist item, losing the link and
the metadata. This feature makes that promotion a single click and keeps the
lineage intact.

---

## 2. How Redmine actually creates issues (the constraints that shape this design)

Everything below was read from Redmine 6.1 core (`app/models/issue.rb`,
`app/controllers/issues_controller.rb`). These mechanics are what make a naive
"just call `Issue.create`" approach unsafe, and they drive every decision in §4.

### 2.1 The starting status is **not ours to choose**
```ruby
def default_status
  tracker.try(:default_status)          # issue.rb:1071
end
```
A new issue's status is dictated by **its tracker's configured default status**.
There is no such thing as "create it in status X" independent of the tracker —
status is a property of the tracker's workflow. So the honest answer to *"at what
status should we create the subtask?"* is: **whatever the chosen tracker's
default status is.** We must not hardcode "New" or fight the workflow.

### 2.2 Required fields are **dynamic per tracker × status × role**
```ruby
def required_attribute_names(user=nil)
  workflow_rule_by_attribute(user).reject {|attr, rule| rule != 'required'}.keys
end
```
`workflow_rule_by_attribute` reads `WorkflowPermission` rows for the issue's
tracker + status + the user's roles. Any core field **or custom field** can be
flagged `required` (e.g. `due_date`, `category_id`, `fixed_version_id`, a
mandatory custom field). This is configurable by admins per project/tracker and
is unknowable to us at design time.

**Consequence:** a blind `Issue.create(subject: …, parent_issue_id: …)` can fail
validation for reasons entirely outside the checklist's control. Any auto-create
path **must pre-flight** `issue.required_attribute_names(User.current)` and, if it
can't satisfy them from item data, fall back to a human-driven form. This single
fact is the strongest argument for the prefilled-form default in §4.4.

### 2.3 The new-issue form is **already prefillable via URL params** — for free
`build_new_issue_from_params` (`issues_controller.rb:592`) does:
```ruby
@issue = Issue.new
@issue.project = @project
@issue.safe_attributes = (params[:issue] || {}).deep_dup
```
So a plain link to
`GET /projects/:id/issues/new?issue[subject]=…&issue[parent_issue_id]=…&issue[assigned_to_id]=…&issue[due_date]=…&issue[tracker_id]=…`
lands the user on the **standard new-issue form, prefilled**, with Redmine's own
required-field validation, tracker picker, and permission checks all intact.
This makes the "present a prefilled form" option nearly **zero-code and
maximally safe** — we reuse core end-to-end.

### 2.4 `parent_issue_id` is a safe attribute, gated by `manage_subtasks`
```ruby
safe_attributes 'parent_issue_id',
  :if => lambda {|issue, user| … user.allowed_to?(:manage_subtasks, issue.project) }  # issue.rb:533
```
Creating the parent-child link requires the **`manage_subtasks`** permission.
Creating an issue at all requires **`add_issues`** (which can be restricted
*per-tracker* via role settings — `issue.rb:1691`). So the actor needs
`add_issues` (on the target tracker) **and** `manage_subtasks`, on top of the
checklist's own `manage_checklists`.

### 2.5 The item's assignee may not be assignable on the subtask
```ruby
def assignable_users
  users = project.assignable_users(tracker).to_a   # issue.rb:1011
  …
end
```
Assignable users are scoped to the **project and tracker** (role must be
"assignable", member of project). A checklist item's `assignee` is set freely and
may **not** be a legal assignee for the child issue's tracker. We must degrade
gracefully: if the item's assignee isn't assignable, drop it and tell the user
(the prefilled-form path surfaces this via core validation automatically).

### 2.6 Subtasks live in the project tree
A child issue defaults to the **parent's project**. (Redmine can allow
cross-project subtasks, but the sane default — and ours — is same project as the
parent.)

---

## 3. Answering the specific questions & concerns

| Question | Answer / recommendation |
|---|---|
| **At what status of the *parent* issue may we convert?** | Allow while the parent is **open (not closed)**. Spawning children under a closed parent is confusing and can conflict with "close-if-all-subtasks-closed" workflows. Make this a **plugin setting** (`allow_convert_when_parent_closed`, default **off**). |
| **At what status of the *item*?** | Only **open (not `is_done`)** items, and only **tasks** (never sections). Converting a *done* item is contradictory — the step is finished; there's nothing to promote. Block done items with a clear message. |
| **Carry over which fields?** | `subject → subject`; `assignee → assigned_to_id` (**iff** assignable, else drop + notify); `due_date → due_date` (iff not readonly by workflow). `is_mandatory` is **not** a subtask field — see §4.6 for how mandatory-ness is preserved via the retained item. `position` stays with the retained item. No description on items today → subtask description left blank (or a small backlink note, see §4.3). |
| **Prefilled form OR auto-create?** | **Hybrid, defaulting to the prefilled form** (§4.4). Because required fields are dynamic (§2.2), guaranteed silent auto-create is impossible in the general case. Offer **"Quick convert"** (auto) only when a pre-flight shows the target tracker's default status has **no required field we can't supply**; otherwise route to the prefilled form. |
| **At what status do we create it?** | The **target tracker's `default_status`** (§2.1). Not configurable independently. The tracker is chosen from a **project setting** (`subtask_tracker_id`, default = project's default tracker) or picked by the user on the prefilled form. |
| **Mandatory-per-tracker-status fields?** | Handled by §2.2 pre-flight + form fallback. We never bypass core validation; we let Redmine enforce its own required-field rules. |
| **Reverse (subtask → item)?** | **Non-goal.** Lossy and semantically backwards. Documented as explicitly out of scope. |

---

## 4. Specification

### 4.1 Scope & guards (a conversion is offered only when *all* hold)
1. Item is a **task** (`is_section == false`).
2. Item is **not done** (`is_done == false`).
3. Item is **not already converted** (`converted_issue_id` is null — §4.5).
4. Parent issue is **open**, unless `allow_convert_when_parent_closed` is set.
5. Current user has **`manage_checklists`** (mutate the item) **and**
   **`add_issues`** on the project (for the target tracker) **and**
   **`manage_subtasks`**.

If any guard fails, the convert control is hidden (or disabled with a tooltip
explaining why); the server re-checks all guards (never trust the client).

### 4.2 Field mapping (item → child issue)
| Child issue attribute | Source | Fallback |
|---|---|---|
| `project_id` | parent issue's project | — |
| `parent_issue_id` | parent issue id | — |
| `tracker_id` | project setting `subtask_tracker_id`, else project default tracker | user picks on form |
| `status_id` | tracker's `default_status` (implicit) | — |
| `subject` | item `subject` | required — always present |
| `assigned_to_id` | item `assignee_id` **if** in `issue.assignable_users` | dropped + flash notice |
| `due_date` | item `due_date` **if** not workflow-readonly | dropped |
| `author_id` | `User.current` | — |
| `description` | blank (items have none) | optional backlink note (§4.3) |

### 4.3 What happens to the original item after conversion
The item is **kept**, not deleted, and becomes a **locked linked row**:
- Shows "→ #123" linking to the created subtask (with its live status/subject).
- Checkbox, inline edit, drag, and the detail panel are **disabled** (its truth
  now lives in the issue).
- Its **done-state mirrors the subtask**: when the child issue is **closed**, the
  item renders as done (and counts toward progress / done-ratio); reopening the
  child un-dones it. Implemented by reading the linked issue's `closed?` at render
  and in `checklist_progress_stats`, **not** by copying state.
- Optionally, the child issue gets a description backlink:
  *"Converted from a checklist item on #<parent>."*

This keeps the checklist a faithful **index of the work**, including the steps
that outgrew it. (Alternative considered: delete the item. Rejected — it destroys
the lineage and would make the History confusing.)

### 4.4 Prefilled-form vs Quick-convert (the interaction model)
Two entry points from the item's action menu:

**A. "Convert to subtask…" (default, always available when guards pass)**
- Links to the core new-issue form, prefilled via `issue[...]` query params (§2.3):
  subject, parent_issue_id, assigned_to_id, due_date, tracker_id.
- The user sees Redmine's real form: required fields, custom fields, tracker
  picker, permission checks — all native. On save, core creates the issue.
- **After creation we must attach the link** (`converted_issue_id`). Two viable
  hooks: (a) pass a return token and complete the link on the issue-created
  `controller_issues_new_after_save` hook when a `checklist_item_token` is
  present; or (b) a thin plugin-owned wrapper action that renders the prefilled
  form and post-processes the save. **Recommendation: (a)** — least surface area,
  reuses core form untouched.

**B. "Quick convert" (auto, shown only when safe)**
- Enabled only when pre-flight passes: build the candidate `Issue` in memory, set
  known attrs, and check `issue.required_attribute_names(User.current)` ⊆
  {attributes we supplied} **and** `issue.valid?`.
- If valid → create immediately (single POST to a plugin action), link it, done.
- If not → the control is hidden and only path **A** is offered. The UI never
  presents a one-click path that would dead-end on a validation error.

This hybrid respects §2.2 while still giving the common, no-required-fields case
the frictionless single click the user asked about.

### 4.5 Data model
Add to `checklist_items` (migration `005`):
- `converted_issue_id` : integer, nullable, indexed — the child issue created
  from this item. Non-null ⇒ item is converted/locked. Gives **idempotency**
  (guard §4.1.3), the render link (§4.3), and the mirror source.
- `converted_at` : datetime, nullable.
- `converted_by_id` : integer, nullable (User).

Model: `belongs_to :converted_issue, class_name: 'Issue', optional: true`.
On the child issue side, no schema change — the parent link is native
(`parent_id`); we find "items that spawned me" via `converted_issue_id`.

**Edge — link no longer valid (deleted / unlinked / reparented):** `converted?` is
a render-time guard requiring the child to still exist **and** still be a child of
this item's issue (`converted_issue.parent_id == issue_id`). So if the subtask is
destroyed, **unlinked** from the parent (Redmine's "unlink" sets `parent_id` to
nil), or **reparented** elsewhere, the item automatically reverts to a normal,
editable, is_done-counted checklist row — keeping the display and the done-ratio
consistent (the item is no longer excluded from `plain_tasks`, and the now-detached
issue is no longer in `children`, so it's counted exactly once). Re-linking the
child to the parent restores the converted state. *(Delivered — v1.2.1.)*

### 4.6 Interaction with existing features
- **Mandatory enforcement.** If a *mandatory* item is converted, its mirrored
  done-state (§4.3) means the mandatory rule is satisfied exactly when the
  **subtask is closed**. This is a clean, intuitive extension: "this mandatory
  step is done when its issue is done." No new enforcement code — the existing
  `checklist_mandatory_items_satisfied` validation already counts done-ness; we
  only change how a converted item computes done-ness.
- **History.** Log conversion as a checklist journal event — new diff category
  `converted` rendered as *"Checklist: <subject> — converted to #123"* (extend
  `ChecklistHistory` snapshot + `checklist_meta_change_string`, mirroring how
  v1.0.1 added `reassigned`/`due_changed`).
- **done-ratio (combined — implemented).** Once an issue has subtasks, Redmine
  core derives the parent `done_ratio` from its **subtasks only**
  (`recalculate_attributes_for` → `done_ratio_derived?`, gated by
  `Setting.parent_issue_done_ratio == 'derived'`), which would clobber the
  checklist value. The plugin instead computes `done_ratio` over the **combined**
  universe when *Affect issue done ratio* is on and the issue has a checklist:
  each non-converted checklist task (`is_done`) + each direct subtask (`closed?`),
  a converted item counted once via its subtask. Requires: (a) `recalc_done_ratio`
  spanning both sets; (b) a prepended `done_ratio_derived?` override returning
  false when the plugin owns the ratio (so core stops deriving from subtasks
  alone); (c) an `Issue after_save` that recomputes the parent's ratio when a
  subtask closes/reopens. Issues without a checklist keep core's behaviour.
  *(v1.1.1)* The parent recalc fires only on a child's status/parent change (and
  on delete), not on every save, and a plugin setting `subtask_done_ratio`
  (default on) can disable the combining entirely — off leaves subtask parents to
  core and drives only leaf issues from the checklist.
- **Templates.** Out of scope here, but a natural follow-up: a template item flag
  "create as subtask on apply". Deferred.
- **Issue-list "Checklist" column.** Unchanged; converted-but-open items count as
  not-done, same as any open task.

### 4.7 Permissions & API
- No new permission needed — reuse `manage_checklists` for the checklist side and
  rely on core `add_issues` + `manage_subtasks` for the issue side (server
  re-checks all three).
- New routes (member of the existing issue checklist-items scope):
  - `GET  …/checklist_items/:id/convert` → redirects to the prefilled form (path A helper).
  - `POST …/checklist_items/:id/convert` → quick-convert (path B), returns JS that
    swaps the row for the locked linked row + syncs History.
- REST/JSON parity for both, behind `accept_api_auth`.

### 4.8 i18n
New keys: `button_convert_to_subtask`, `label_checklist_converted` ("converted to
%{issue}"), `label_checklist_converted_row` ("→ %{issue}"),
`text_convert_confirm`, `error_convert_item_done`, `error_convert_parent_closed`,
`error_convert_no_permission`, `notice_convert_assignee_dropped`.

### 4.9 Out of scope / non-goals
- Reverse conversion (issue → item).
- Bulk "convert all items to subtasks".
- Cross-project subtasks (default same project only).
- Template-driven auto-subtask creation (future).
- Two-way field sync (only done-state mirrors; we do **not** sync subject/assignee
  back and forth — the issue is authoritative once created).

---

## 5. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Silent auto-create fails on dynamic required fields | Pre-flight `required_attribute_names` + `valid?`; fall back to prefilled form (§4.4). |
| Item assignee not assignable on child tracker | Drop assignee, flash a notice; form path shows it natively (§2.5). |
| Actor lacks `add_issues`/`manage_subtasks` | Hide/disable control; server re-checks (§4.1). |
| Linked subtask later deleted | Revert item to normal on nullify/render guard (§4.5). |
| Convert-then-parent-closed inconsistency | Gate on parent open by default; setting to override (§3). |
| Scope creep into "mini project management" | Keep strictly one-way, single-item, no bulk, no back-sync (§4.9). |

---

## 6. Value assessment (opinion)

**Verdict: build it — medium-high value, genuine differentiator, phase it.**

**Why it's worth doing.**
- It closes the one real gap in the plugin's philosophy. The product thesis is
  *"steps too lightweight for their own issue."* The honest corollary is *"…until
  one isn't."* Today that transition is a manual, lineage-destroying chore. This
  feature makes the checklist a **staging area that gracefully promotes** work
  into the issue tracker — a story none of the competitor checklist plugins tell
  well.
- It's **native-mechanics-respecting**, not a bolt-on. Because Redmine already
  prefills the new-issue form from URL params (§2.3), the safe 80% is nearly
  free, and the design leans on core validation/permissions instead of
  reimplementing them. Low technical risk for the default path.
- The **mandatory-item synergy** (§4.6) is the sleeper win: "a mandatory step is
  done when its issue is closed" turns the checklist into a lightweight
  definition-of-done that can now include *workflow-bearing* steps, not just
  binary ones. That materially strengthens the enforcement feature already
  shipped in v0.4/v0.5.

**Why to be disciplined about it.**
- It's the feature most prone to scope creep — the moment you add back-sync, bulk
  convert, or template auto-creation, you're building a second issue tracker
  inside the checklist. The non-goals in §4.9 are load-bearing; hold them.
- The dynamic-required-fields reality (§2.2) means "one click auto-create" is a
  *sometimes* affordance, not always. Setting that expectation in the UI (Quick
  convert appears only when safe) avoids a frustrating dead-end.

**Recommended delivery (phased):**
1. **v1.1.0 — core promotion.** Path A (prefilled form) + retained locked linked
   row + done-state mirror + History event + migration 005. This is the whole
   value at minimal risk.
2. **v1.2.0 — Quick convert.** Path B auto-create with pre-flight, plus the
   `subtask_tracker_id` project setting.
3. **Later.** Template "create as subtask" flag, if demand appears.

**Estimated effort:** Phase 1 is a moderate change — one migration, one action
pair, a render branch for the locked row, a `ChecklistHistory` category, and an
e2e spec — comparable in size to v0.5.0. Phase 2 is smaller.
