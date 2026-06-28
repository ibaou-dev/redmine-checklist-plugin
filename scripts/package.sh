#!/usr/bin/env bash
# scripts/package.sh — build a versioned Redmine install package.
#
# Produces dist/redmine_checklist-<version>.tar.gz and .zip, each containing a
# single top-level `redmine_checklist/` directory with only the runtime plugin
# files (no e2e/, docs/, .git, .references, tmp/). Extract into Redmine's
# plugins/ directory and run redmine:plugins:migrate.
#
# Usage: bash scripts/package.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

NAME="redmine_checklist"
VERSION="$(grep -E "version[[:space:]]+'" init.rb | head -1 | sed -E "s/.*'([^']+)'.*/\1/")"
[ -n "$VERSION" ] || { echo "ERROR: could not read version from init.rb"; exit 1; }

DIST="$ROOT/dist"
WORK="$(mktemp -d)"
STAGE="$WORK/$NAME"
mkdir -p "$STAGE" "$DIST"

# Runtime files only.
for f in init.rb README.md CHANGELOG.md LICENSE; do
  [ -e "$ROOT/$f" ] && cp "$ROOT/$f" "$STAGE/"
done
for d in app assets config db lib test; do
  [ -d "$ROOT/$d" ] && cp -r "$ROOT/$d" "$STAGE/"
done

# Strip any stray dev artifacts.
find "$STAGE" \( -name '*.log' -o -name '.DS_Store' -o -name 'tmp' \) -prune -exec rm -rf {} + 2>/dev/null || true

TAR="$DIST/${NAME}-${VERSION}.tar.gz"
ZIP="$DIST/${NAME}-${VERSION}.zip"
rm -f "$TAR" "$ZIP"

tar -C "$WORK" -czf "$TAR" "$NAME"
( cd "$WORK" && zip -qr "$ZIP" "$NAME" )

rm -rf "$WORK"

echo "Version: $VERSION"
echo "Built:   $TAR"
echo "Built:   $ZIP"
( cd "$DIST" && sha256sum "${NAME}-${VERSION}.tar.gz" "${NAME}-${VERSION}.zip" )
