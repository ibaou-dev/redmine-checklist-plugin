---
type: How-To
title: Development Environment
description: How the dev environment is wired and how to drive it — bind-mount architecture, Prism theme, common commands.
status: accepted
tags: [dev, environment, how-to, docker]
timestamp: 2026-06-28T10:00:00Z
relates-to:
  - architecture/integration-points.md
---

# Development Environment

## Architecture

This plugin is developed against the **`redmine-devcontainer`** stack (sibling repo), but **this folder is the single source of truth** — you edit here and the running container sees changes live.

```
/home/ibaou/workspace/
├── redmine-checklist-plugin/     ← THIS repo (edit here; on `main`)
├── redmine-theme-prism/          ← Prism theme + companion plugin
└── redmine-devcontainer/         ← Docker stack, Make, AI skills
```

**Wiring:**

1. **Skills** — `.claude/skills` here is a symlink to the devcontainer's `.agents/skills`, so `redmine-plugin-developer` (and friends) auto-load when you open a Claude session in **this** folder. The symlink is git-ignored.
2. **Bind mounts** — `redmine-devcontainer/docker-compose.local.yml` mounts the real source folders directly into the Redmine container (no worktree, no second copy):
   - `../redmine-checklist-plugin → /usr/src/redmine/plugins/redmine_checklist`
   - `../redmine-theme-prism/plugins/redmine_prism → /usr/src/redmine/plugins/redmine_prism`
   - `../redmine-theme-prism/themes/prism → /usr/src/redmine/themes/prism`

   > Earlier we used a git worktree + symlinks. Symlinks pointing outside the bind-mounted tree don't resolve **inside** the container, so we replaced them with explicit bind mounts. Relative paths resolve against the devcontainer dir and match its documented sibling-directory convention.

3. **Prism theme** — installed for a pleasant dev UI. Enable it in Administration → Settings → Display → Theme → *Prism*.

## Running it (driven by the orchestrator)

All commands run from `redmine-devcontainer/`:

```bash
make start      # start the stack (Redmine on http://localhost:4000)
make logs       # tail Redmine logs
make shell      # bash inside the Redmine container
make restart    # after Ruby/init.rb/config changes
make migrate    # after adding db/migrate files (or the plugin-scoped rake below)
make stop       # stop the stack
```

Plugin-scoped migration:

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml \
  exec -T redmine bundle exec rake redmine:plugins:migrate \
  RAILS_ENV=development NAME=redmine_checklist
```

Eager-load boot check (run in CI; catches load-time crashes):

```bash
docker compose -f docker-compose.yml -f docker-compose.local.yml \
  exec -T redmine bundle exec rails runner "Rails.application.eager_load!" RAILS_ENV=development
```

Credentials: `admin` / `admin` (change on first login).

## Gotchas

- **Postgres password drift** — Postgres only applies `POSTGRES_PASSWORD` on first volume init. If the container crash-loops on `password authentication failed for user "redmine"`, the volume was initialized with a different password than `.env`. Fix without data loss:
  ```bash
  docker compose ... exec -T postgres psql -U redmine -d redmine \
    -c "ALTER USER redmine WITH PASSWORD '<value from .env>';"
  docker compose ... restart redmine
  ```
- **Ruby/`init.rb` changes** need `make restart`; view/CSS/JS changes are live (hard-refresh for assets).
- **Load-time safety** — never call `l()`/`I18n` or hit the DB at class/module body load time; it crashes eager-load in production.
- **No `test` bundle group** in the dev image — run the plugin's own test suite via a self-contained CI image (official `redmine:` base + full `bundle install`).

## End-to-end tests

Browser e2e tests (Playwright + system Chrome) live in `e2e/`. They drive the live dev Redmine on `http://localhost:4000` across all permission tiers and every interaction.

```bash
cd e2e && npm install
BASE_URL=http://localhost:4000 ISSUE_ID=9 npx playwright test
```

- Test fixtures (project `checklist-qa`, issue #9, tier users `cl_viewer`/`cl_checker`/`cl_manager`, pw `Test1234!`) are seeded via a rails runner; `tests/reset.ts` clears/seeds the checklist between tests.
- After a container restart, **warm up** with one request before running (Propshaft compiles assets on first request, which otherwise fails the first test run).
- `node_modules/` and `artifacts/` are git-ignored; specs and config are committed.
- Each phase is gated: build → e2e green (run twice for determinism) → visual screenshot review → commit.

## Releasing

- Bump `version` in `init.rb`, update `CHANGELOG.md`, commit, then `git tag vX.Y.Z`.
- Build the install package with `scripts/package.sh` (produces `dist/redmine_checklist-X.Y.Z.tar.gz` + `.zip`, containing only the runtime plugin files).
- Publish a GitHub release with the artifacts attached.

## Editing model

Edit files in **this** repo. The container picks them up immediately (bind mount). Commit and push from here; the GitHub remote is `ibaou-dev/redmine-checklist-plugin`. The devcontainer never tracks this plugin.
