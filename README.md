# Redmine Checklist

A checklist plugin for Redmine issues — add ordered, checkable items to any issue, with progress tracking, sections, templates, per-item assignment, and mandatory-item enforcement. Open-source (GPL-3.0), dependency-light (no proprietary gems), built for **Redmine 6.x** (works on 5.0+).

> **Status:** **v0.1.0** — Phase 1 MVP shipped and end-to-end tested. The interactive
> single-issue checklist is fully working; later phases (history/done-ratio, templates,
> mandatory-item enforcement, per-item assignment) are on the [roadmap](docs/planning/roadmap.md).

## Why

Real tasks contain small steps too lightweight for their own issue. This plugin tracks them natively — with progress %, permissions, audit history, reusable templates, and a "definition of done" that can block status transitions — without the proprietary `redmineup` gem the popular free alternative requires.

## Features

**Shipped in v0.1.0:**

- ✅ Add items and section headers (two buttons; Enter adds an item) — AJAX, no reload
- ✅ Inline edit of titles (Enter saves, Esc cancels)
- ✅ Check/uncheck with a live progress bar (sections excluded from progress)
- ✅ Delete, and drag-and-drop reorder (order persisted)
- ✅ Flat group-header sections with items visually grouped beneath them
- ✅ Three-tier role permissions (view / done / manage), enforced in UI and on the server
- ✅ REST API; plugin settings (progress bar, done ratio, change log)

**Planned (see [roadmap](docs/planning/roadmap.md)):**

- ⏳ Change logging into issue journals; done-ratio integration (Phase 2)
- ⏳ Templates — project/global, tracker auto-apply (Phase 3)
- ⏳ Mandatory items that block status transitions; per-item assignee/due date (Phase 4)
- ⏳ Issue-list completion filter, full i18n, v1.0 polish (Phase 5)

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
tar xzf redmine_checklist-0.1.0.tar.gz   # extracts redmine_checklist/
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

Then grant the `view_checklists` / `done_checklists` / `manage_checklists` permissions to roles under each project's *Issue tracking* module.

Releases (with packaged tarball/zip) are on the [Releases page](https://github.com/ibaou-dev/redmine-checklist-plugin/releases).

## Development

The plugin is developed against the [`redmine-devcontainer`](https://github.com/ibaou-dev/redmine-devcontainer) stack via bind mounts — edit this repo directly and the running Redmine reflects changes live. See [docs/dev/environment.md](docs/dev/environment.md).

End-to-end tests (Playwright + Chrome) live in [`e2e/`](e2e/): `cd e2e && npm install && npx playwright test`.

## License

[GPL-3.0](LICENSE).
