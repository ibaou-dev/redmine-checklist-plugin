# Redmine Checklist

A checklist plugin for Redmine issues — add ordered, checkable items to any issue, with progress tracking, sections, templates, per-item assignment, and mandatory-item enforcement. Open-source (GPL-3.0), dependency-light (no proprietary gems), built for **Redmine 6.x** (works on 5.0+).

> **Status:** early development. Foundation scaffold is in place (model, migrations, view hook, permissions, settings); interactive features are being built per the [roadmap](docs/planning/roadmap.md).

## Why

Real tasks contain small steps too lightweight for their own issue. This plugin tracks them natively — with progress %, permissions, audit history, reusable templates, and a "definition of done" that can block status transitions — without the proprietary `redmineup` gem the popular free alternative requires.

## Features (target v1.0)

- ✅ Checklist items on issues (CRUD, AJAX, REST API)
- ✅ Section headers and drag-and-drop reorder
- ✅ Progress bar and optional done-ratio contribution
- ✅ Role-based permissions (view / mark-done / manage)
- ✅ Change logging into issue journals
- ✅ Templates (project/global, tracker auto-apply)
- ✅ Mandatory items that block status transitions
- ✅ Per-item assignee, due date, and completion audit

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

```bash
# into your Redmine's plugins/ directory
cd /path/to/redmine/plugins
git clone https://github.com/ibaou-dev/redmine-checklist-plugin.git redmine_checklist
cd /path/to/redmine
bundle exec rake redmine:plugins:migrate RAILS_ENV=production NAME=redmine_checklist
# restart Redmine
```

Then grant the `view_checklists` / `done_checklists` / `manage_checklists` permissions to roles under each project's *Issue tracking* module.

## Development

The plugin is developed against the [`redmine-devcontainer`](https://github.com/ibaou-dev/redmine-devcontainer) stack via bind mounts — edit this repo directly and the running Redmine reflects changes live. See [docs/dev/environment.md](docs/dev/environment.md).

## License

GPL-3.0.
