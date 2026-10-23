#!/usr/bin/env bash
# Verify, push the release commit and tag, then publish to npm.
# Usage: scripts/release.sh [--otp=123456]
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION=$(node -p "require('./package.json').version")
NAME=$(node -p "require('./package.json').name")
echo "Releasing $NAME@$VERSION"

[ -z "$(git status --porcelain)" ] || { echo "Working tree is not clean" >&2; exit 1; }
git rev-parse "v$VERSION" >/dev/null 2>&1 || { echo "Missing tag v$VERSION" >&2; exit 1; }
npm whoami >/dev/null 2>&1 || { echo "Not logged in to npm: run 'npm login' first" >&2; exit 1; }
if npm view "$NAME@$VERSION" version >/dev/null 2>&1; then
  echo "$VERSION is already on npm" >&2
  exit 1
fi

npm ci
npm run check
npm run docs:sync
git diff --quiet || { echo "docs/assets is stale: commit the sync first" >&2; exit 1; }
npm run test:package
npm run test:docs
npm run test:site
npm run test:tarball

git push origin master
git push origin "v$VERSION"
npm publish --access public "$@"
echo "Published $NAME@$VERSION"
