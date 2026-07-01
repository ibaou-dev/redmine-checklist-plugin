# Redmine Checklist

A checklist plugin for Redmine issues — add ordered, checkable items to any issue, with progress tracking, sections, templates, per-item assignment, and mandatory-item enforcement. Open-source (GPL-3.0), dependency-light (no proprietary gems), built and tested for **Redmine 6.x** (Rails 7.2, Ruby 3.x).

> **Status:** **v1.1.0** — stable. The interactive single-issue checklist, change history,
> done-ratio integration, activity feed, search, reusable **templates**, **mandatory-item
> enforcement** (global **or per-project**), **per-item assignment** (assignee/due date),
> the optional **issue-list "Checklist" column**, and **converting an item into a subtask**
> are all shipped and end-to-end tested. See the
> [roadmap](docs/planning/roadmap.md) for what's next.

## Why

Real tasks contain small steps too lightweight for their own issue. This plugin tracks them natively — with progress %, permissions, audit history, reusable templates, and a "definition of done" that can block status transitions — without the proprietary `redmineup` gem the popular free alternative requires.

## Features

**Shipped:**

- ✅ Add items and section headers (two buttons; Enter adds an item) — AJAX, no reload
- ✅ Inline edit of titles (Enter saves, Esc cancels)
- ✅ Check/uncheck with a live progress bar (sections excluded from progress)
- ✅ Delete, and drag-and-drop reorder (order persisted)
- ✅ Flat group-header sections with items visually grouped beneath them
- ✅ Three-tier role permissions (view / done / manage), enforced in UI and on the server
- ✅ REST API; plugin settings (progress bar, done ratio, change log)
- ✅ Change history in the issue **History** tab — done/reopened, added, removed and renamed, with consolidation and live (no-reload) refresh — *v0.2.0 / v0.2.1*
- ✅ Done-ratio driven by checklist completion (issue-field mode) — *v0.2.0*
- ✅ Activity feed + global search integration — *v0.2.0*
- ✅ Templates — global + per-project, categories, apply-to-issue, tracker auto-apply — *v0.3.0*
- ✅ Mandatory items that block configured status transitions (global **or per-project** override); per-item assignee, due date & completion audit — *v0.4.0 / v0.5.0*
- ✅ Optional **"Checklist" column** on the issue list / saved queries (shows `done/total · %`) — *v1.0.0*
- ✅ **Convert a checklist item into a subtask** — promotes an open task to a linked child issue via the prefilled new-issue form; the item becomes a locked row whose done-state mirrors the subtask — *v1.1.0*

**Possible future work (see [roadmap](docs/planning/roadmap.md)):**

- ⏳ Issue-list completion *filter*, multiline paste bulk-add, additional locale translations

See the [feature matrix](docs/product/feature-matrix.md) for full scope and priorities.

## Documentation

Project planning, research, and architecture live in [`docs/`](docs/index.md) — an [Open Knowledge Format](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) bundle:

- [Overview & vision](docs/overview.md)
- [Product proposal](docs/planning/proposal.md) · [Roadmap](docs/planning/roadmap.md)
- [Use cases](docs/product/use-cases.md) · [Feature matrix](docs/product/feature-matrix.md)
- [Data model](docs/architecture/data-model.md) · [Integration points](docs/architecture/integration-points.md)
- [Competitive analysis](docs/research/competitive-analysis.md)
- [Dev environment](docs/dev/environment.md)

## Installation

The plugin directory must be named `redmine_checklist`.

**From a release package** (recommended):

```bash
cd /path/to/redmine/plugins
tar xzf redmine_checklist-1.1.0.tar.gz   # extracts redmine_checklist/
cd /path/to/redmine
bundle exec rake redmine:plugins:migrate RAILS_ENV=production NAME=redmine_checklist
# restart Redmine
```

**From git:**

```bash
cd /path/to/redmine/plugins
git clone https://github.com/ibaou-dev/redmine-checklist-plugin.git redmine_checklist
cd /path/to/redmine
bundle exec rake redmine:plugins:migrate RAILS_ENV=production NAME=redmine_checklist
# restart Redmine
```

Then grant the `view_checklists` / `done_checklists` / `manage_checklists` permissions to roles under each project's *Issue tracking* module. To let project members manage **project-scoped templates** grant `manage_checklist_templates`, and to let them configure **per-project mandatory-item enforcement** grant `manage_checklist_enforcement` (global templates are managed by admins under *Administration → Checklist templates*). To let members **convert a checklist item into a subtask**, grant them Redmine's core **Add issues** and **Manage subtasks** permissions (in addition to `manage_checklists`).

Releases (with packaged tarball/zip) are on the [Releases page](https://github.com/ibaou-dev/redmine-checklist-plugin/releases).

## Development

The plugin is developed against the [`redmine-devcontainer`](https://github.com/ibaou-dev/redmine-devcontainer) stack via bind mounts — edit this repo directly and the running Redmine reflects changes live. See [docs/dev/environment.md](docs/dev/environment.md).

End-to-end tests (Playwright + Chrome) live in [`e2e/`](e2e/): `cd e2e && npm install && npx playwright test`.

## License

[GPL-3.0](LICENSE).
