# Contributing to @fatdevcon/precisekit

Thanks for helping. PreciseKit is a published TypeScript utility library, so correctness, a stable public API and a small consumer bundle matter more than speed of change. Please read this page before opening a pull request, and follow the [Code of Conduct](CODE_OF_CONDUCT.md).

Security problems must not be reported in public issues: see [SECURITY.md](SECURITY.md).

## Development setup

- **Node.js 22.18 or newer** is needed to build and test the project, because the build toolchain (tsup 9) requires it.
- The **published package** still supports Node.js 18 and newer. Do not use syntax or APIs that break the package on Node 18 in runtime code; CI loads the built output on Node 18, 20, 22 and 24.
- Install with `npm ci` (not `npm install`) so the lockfile is respected.
- [Bun](https://bun.sh) is optional, but needed for `npm run test:bun` and `npm run test:tarball`.

```bash
git clone https://github.com/PhanHoangQuocTu/precisekit.git
cd precisekit
npm ci
npm run check
```

## Project rules

- **Zero runtime dependencies.** Do not add one. `decimal.js` and `date-fns` are dev-only test oracles and must never reach the built output.
- Code is pure and platform-neutral by default: no import-time I/O, global or prototype mutation, or unconditional browser/Node globals.
- The public API is a contract. Keep names, overloads, return kinds, error codes and number/string formatting stable unless a breaking change was agreed with the maintainer.
- Keep tree-shaking intact: no side effects at module load and no dependency cascades between unrelated modules.
- Keep changes small and cohesive. Reuse existing primitives instead of adding new helpers or abstractions.

## Verification

Run the checks that match your change. Report anything you could not run.

| Command | When |
| --- | --- |
| `npm test -- --runInBand` | Any code change (start with the nearest test file) |
| `npm run check` | Always for code changes: typecheck, lint, Jest and build |
| `npm run docs:sync` | After a build, when docs, API data or public behavior changed. It must leave no diff in `docs`, `README.md` or `.github/repository-metadata.json` other than what you intend |
| `npm run test:package` | Exports, types or build changes |
| `npm run test:docs` | Documentation examples and API data |
| `npm run test:site` | Documentation site and playground consistency |
| `npm run test:tarball` | Exports, types, build or packaging changes (needs Bun) |

## Adding a public function

1. Search for existing implementations, exports, types, docs and tests first.
2. Implement it in the owning module under `src/modules/<module>/`, with one clear responsibility. Keep helpers private unless they are genuinely public.
3. Export it from the module, and make sure it is reachable through `src/index.ts`. The root entry re-exports modules with `export * from "./modules/..."` blocks, so a new module needs its own block there.
4. Add tests under `src/__tests__/`, including edge cases (invalid input, boundaries, Unicode, time zones or precision limits where relevant).
5. Add an entry with an executable example to `docs/api-data.js` (or the data file it imports for newer groups) so the reference lists it.
6. Run `npm run check`, `npm run docs:sync`, `npm run test:package`, `npm run test:docs` and `npm run test:site`.

## Commits and pull requests

- Use [Conventional Commits](https://www.conventionalcommits.org/), for example `fix(money): round half to even correctly` or `docs: clarify locale parsing`. Dependency updates use `build(deps)`, `build(deps-dev)` and `ci(deps)`.
- Do **not** bump the package version, edit the version in `package-lock.json`, or add a release heading to `CHANGELOG.md` in a pull request unless the maintainer asks. Releases are prepared separately.
- Fill in the pull request template and list the verification commands you ran.

## Releases

Only the maintainer publishes. Releases are published by the `Publish` GitHub Actions workflow through npm trusted publishing, so each release carries npm provenance. `scripts/release.sh` runs the pre-flight checks and prints the tag and release commands.
