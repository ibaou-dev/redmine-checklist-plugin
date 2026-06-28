# Redmine Checklist Plugin — Knowledge Base

This `docs/` folder is an **[Open Knowledge Format (OKF)](https://github.com/GoogleCloudPlatform/knowledge-catalog/tree/main/okf) v0.1 bundle** — a directory of Markdown files, each carrying YAML frontmatter with a required `type` field. The `type` vocabulary follows the [Diátaxis](https://diataxis.fr/) documentation framework plus a few project-specific types (`Proposal`, `Feature Spec`, `ADR`, `Planning`).

It doubles as the project's "second brain": planning, research, proposals, architecture, and feature specs all live here, version-controlled alongside the code and directly consumable by AI agents.

## Bundle Contents

| File | Type | Purpose |
|------|------|---------|
| [overview.md](overview.md) | Explanation | What the plugin is, vision, scope, non-goals |
| [planning/proposal.md](planning/proposal.md) | Proposal | The product proposal — problem, solution, differentiation |
| [planning/roadmap.md](planning/roadmap.md) | Planning | Phased delivery plan (MVP → v1.0 → beyond) |
| [product/feature-matrix.md](product/feature-matrix.md) | Feature Spec | Must-have vs. nice-to-have, prioritized |
| [product/use-cases.md](product/use-cases.md) | Reference | Concrete use cases and personas |
| [architecture/data-model.md](architecture/data-model.md) | Architecture | Tables, columns, relationships |
| [architecture/integration-points.md](architecture/integration-points.md) | Architecture | Redmine hooks, patches, permissions, API |
| [research/competitive-analysis.md](research/competitive-analysis.md) | Reference | RedmineFlux, RedmineUP, Advanced Checklists teardown |
| [research/reference-plugin-teardown.md](research/reference-plugin-teardown.md) | Reference | Deep dive on the local `redmine_checklists` reference |
| [dev/environment.md](dev/environment.md) | How-To | How the dev environment is wired and driven |

## Conventions

- **Frontmatter** — every doc has `type`, `title`, `description`, `status`, `tags`, `timestamp`. Custom fields (`relates-to`) are preserved per OKF.
- **Linking** — relative Markdown links between bundle files; relationships are also declared in `relates-to`.
- **Status lifecycle** — `draft` → `review` → `accepted` → `superseded`.
- **Changelog** — see [log.md](log.md).

## Tooling

A Claude Code skill for authoring/validating OKF bundles exists: [`scaccogatto/okf-skills`](https://github.com/scaccogatto/okf-skills) (`/plugin marketplace add scaccogatto/okf-skills` → `/okf:validate`, `/okf:visualize`). Optional — adopt if we want conformance checking and graph visualization.
