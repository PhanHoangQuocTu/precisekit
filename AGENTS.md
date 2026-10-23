# AGENTS.md — Codex Instructions for @fatdevcon/precisekit

This repository is a **published, zero-runtime-dependency TypeScript utility library**, not an application. Follow the same standards as Claude Code without duplicating every detailed rule in this file.

## Project context (verify before use)

- Public entry `src/index.ts`; implementation generally under `src/modules/`; tests under `src/__tests__/`.
- JS builds: **tsup** (ESM/CJS); declarations: **Rollup DTS**; tests: **Jest**; code checks: TypeScript + ESLint.
- Release includes npm package metadata, `CHANGELOG.md`, `README.md`, static docs at `docs/` and a synced playground ESM artifact.
- Important invariant: **zero runtime dependencies**. `decimal.js` and `date-fns` may exist as **dev-only test oracles**.
- Known build design deliberately leaves production JS **unminified** for inspection. Consumer bundle weight and actual tree-shaking matter more than raw `dist` bytes.
- Read local `package.json` for the authoritative version, scripts, exports and supported environments; do not assume public-branch metadata matches the working tree.

## Do this for every code task

1. Inspect only the relevant source, its tests, `src/index.ts`, related docs and `git status`. For build/release tasks, inspect `package.json`, lockfile, tsup/Rollup configs and verification scripts.
2. Identify existing public behavior: names/signatures, overload inference, return kinds, errors (`code`), empty/invalid handling, mutation policy, runtime and import paths.
3. Make the smallest coherent change and targeted regression tests; avoid unrelated refactors and dependency increases.
4. Run focused checks, then broader **actual project** commands proportionate to risk. Do not claim checks passed unless executed successfully.
5. For each **completed logical repository update**, bump version once and synchronize manifests, changelog, relevant README/docs/current-version labels and version-dependent verification scripts. Read-only analysis is exempt; do not publish or tag.
6. Report **Changes | Version old -> new | Tests pass/fail/not run | Bundle/dependency impact | Risks**.

## Absolute constraints

- No silent precision loss, unannounced behavior changes, implicit coercion, swallowed errors, weakening of types/tests, mutable caller data or prototype pollution.
- No framework dependency, implicit telemetry/networking, global/prototype patch, or browser/Node-only access at module import time.
- No unmeasured claims that minifying `dist` fixes real consumer bundle size; check real tree-shaking if impacted.
- Never `npm publish`, tag, push, force-reset, commit or overwrite unrelated files without explicit user permission.
- Correctness and published compatibility take precedence over convenience; ask before intentionally breaking an existing contract.

## Focused canonical rules — read on demand

Read **only the task-relevant files** below; they are shared with Claude Code. Do not read the entire set for a typo or isolated docs edit.

| When working on... | Read |
| --- | --- |
| Module structure, exports, refactors | `.claude/rules/01-architecture.md` |
| Validation, errors, security, cancellation | `.claude/rules/02-reliability-and-security.md` |
| Build/package metadata, imports, bundle weight | `.claude/rules/05-npm-package-and-bundle.md` |
| Production code change or regression tests | `.claude/rules/06-verification.md` |
| Version/release/docs synchronization | `.claude/rules/07-release-and-documentation.md` |
| TS types, portability, ESM/CJS `.d.ts` | `.claude/rules/08-typescript-and-runtime.md` |
| New or modified generic utility behavior | `.claude/rules/09-utility-function-contracts.md` |
| Decimal, BigInt, numeric formatting, precision | `.claude/rules/10-exact-numeric-engine.md` |

Prefer **focused tests** while editing; run the repository's publish gates before claiming **release ready**. Preserve existing CI/release workflows instead of inventing alternative tooling.
