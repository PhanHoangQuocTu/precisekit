# Versioning, changelog, docs and safe release

The maintainer requires a **single version bump per completed logical repository update**, including code, config, tests and docs edits. Do not bump for read-only analysis or after each intermediate modification. A version bump is **not** permission to publish.

## SemVer and 0.x compatibility

1. Read the current version from the **local** `package.json`. Do not hardcode `0.3.7`, `0.4.0` or any remembered version into instruction examples or validation logic.
2. Honor any explicit maintainer release target and existing pre-1.0 compatibility policy. In the absence of a special project convention: PATCH for backward-compatible fixes/docs/internal changes, MINOR for compatible new public helpers, and an explicitly discussed breaking bump for incompatible contracts. **In `0.x`, SemVer permits changing the minor version for breaking changes; do not automatically jump to 1.0.0.** Document the impact and get agreement where ambiguous.
3. Update `package.json` and `package-lock.json` consistently without unrelated upgrades. Prefer package-manager commands that avoid Git tags (e.g. `npm version <next> --no-git-tag-version` after checking lifecycle behavior), or carefully edit both and verify metadata.
4. Follow existing release automation if present; never invent a second competing tagging/publish process.

## Documentation and discoverability

- Update `CHANGELOG.md` with changes grouped under the new release, observable public behavior, deprecations and migration notes for breaking changes.
- Synchronize README public API tables/snippets, package capabilities and installation claims. Include new functions only when actually exported, documented and tested.
- Sync documentation UI in `docs/index.html`, structured-data `softwareVersion`, footer/version labels, release sections and any API list in `docs/api-data.js` where relevant.
- Documentation's playground runs a copied build artifact, not directly imported source: after a successful build use `npm run docs:sync` to refresh manifest-owned site metadata and `docs/assets/precisekit.mjs`; `npm run test:site` should verify both metadata and bundle consistency.
- Maintain truthful SEO/metadata descriptions, canonical URL, sitemap and robots entries when changing site routes; do not keyword-stuff or invent functionality.
- Treat `package.json` description/branding as the source for current positioning. Run `docs:sync` to update README, visible site copy, SEO/social metadata, JSON-LD and the reviewable `.github/repository-metadata.json` About proposal. This never changes remote GitHub settings. Keep historical migration versions fixed and current bundle claims tied to `docs/bundle-data.json` and its build hash.
- Keep `THIRD_PARTY_NOTICES.md` and copyright/license attributions accurate when changing bundled data sources or licensing requirements.

## Avoid the hard-coded version trap

- Current public `scripts/verify-package.mjs` has had an assertion comparing the manifest version to a **literal release number**. Before version bump, inspect and update/refactor this check so the next release does not fail.
- Prefer validating **consistency** of installed/packed metadata with the authoritative manifest and documentation rather than making a tautological `version === version` assertion or replacing the constant blindly.
- Inspect `scripts/verify-tarball.mjs`, docs checks and metadata for other active release references. Avoid changing historical changelog versions or legitimately pinned dependency versions.
- Version claims must match the public package, the built artifact and the release docs. A working-tree version being higher than npm published version is normal until explicit publishing.

## Final release gate

- Run the actual `prepublishOnly` equivalent: `npm run check`, `npm run docs:sync`, `npm run test:package`, `npm run test:docs`, `npm run test:site` (or use updated locally defined scripts).
- For stronger release confidence run `npm run test:tarball` when Bun is installed; inspect `npm pack --dry-run --json` and `exports`/typings/package contents.
- Report failing/blocked checks and compatibility/bundle risks. Never claim "published" or "ready" without evidence.
- Do **not** execute `npm publish`, `npm unpublish`, push, commit, create git tags/GitHub releases or deploy docs without explicit authorization.
