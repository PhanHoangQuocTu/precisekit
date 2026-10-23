#!/usr/bin/env bash
# Release pre-flight checklist. This script does NOT publish, push or tag anything.
#
# It verifies the working tree and version consistency, runs the same gates as the publish
# workflow, and then prints the commands you run yourself. Publishing happens in
# .github/workflows/publish.yml (npm trusted publishing with provenance) when the GitHub
# release is created.
#
# Usage: scripts/release.sh [--skip-tarball]
set -euo pipefail
cd "$(dirname "$0")/.."

skip_tarball=false
for arg in "$@"; do
  case "$arg" in
    --skip-tarball) skip_tarball=true ;;
    *)
      echo "Unknown argument: $arg" >&2
      echo "Usage: scripts/release.sh [--skip-tarball]" >&2
      exit 2
      ;;
  esac
done

fail() {
  echo "ERROR: $*" >&2
  exit 1
}

VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")
LOCK_VERSION=$(node -p "require('./package-lock.json').version")
LOCK_ROOT_VERSION=$(node -p "require('./package-lock.json').packages[''].version")
TAG="v$VERSION"
echo "Pre-flight for $NAME@$VERSION"

echo "==> Version consistency"
[ "$LOCK_VERSION" = "$VERSION" ] || fail "package-lock.json version ($LOCK_VERSION) differs from package.json ($VERSION)"
[ "$LOCK_ROOT_VERSION" = "$VERSION" ] || fail "package-lock.json root package version ($LOCK_ROOT_VERSION) differs from package.json ($VERSION)"
grep -Eq "^## ${VERSION//./\\.}([[:space:]]|$)" CHANGELOG.md || fail "CHANGELOG.md has no '## $VERSION' heading"

echo "==> Working tree and tag"
[ -z "$(git status --porcelain)" ] || fail "working tree is not clean: commit or stash your changes first"
branch=$(git rev-parse --abbrev-ref HEAD)
[ "$branch" = "master" ] || fail "release from master (current branch: $branch)"
if git rev-parse -q --verify "refs/tags/$TAG" >/dev/null; then
  fail "tag $TAG already exists"
fi

echo "==> Registry"
node --test scripts/verify-release-registry.test.mjs
node scripts/verify-release-registry.mjs

echo "==> Gates (same as the publish workflow)"
npm ci
npm run check
npm run docs:sync
git diff --quiet -- docs README.md .github/repository-metadata.json || fail "generated docs are stale: commit the docs:sync output first"
npm run test:package
npm run test:docs
npm run test:site
npm audit --audit-level=low --omit=dev
if [ "$skip_tarball" = true ]; then
  echo "SKIPPED: npm run test:bun and npm run test:tarball (--skip-tarball); full release verification remains required"
else
  npm run test:bun
  npm run test:tarball
fi
[ -z "$(git status --porcelain)" ] || fail "gates changed the working tree: review 'git status' and commit or discard the changes"

cat <<MSG

All pre-flight checks passed for $NAME@$VERSION. Nothing was pushed, tagged or published.

Run these yourself, in order:

  git push origin master
  git tag -a $TAG -m "$NAME $VERSION"
  git push origin $TAG
  gh release create $TAG --verify-tag --title "$TAG" --notes-from-tag

Creating the release triggers .github/workflows/publish.yml, which re-runs the gates and
publishes with npm provenance. Prerequisites (one time): npm trusted publisher registration
for publish.yml / environment 'npm', and a GitHub environment named 'npm'. See the header of
.github/workflows/publish.yml.
MSG
