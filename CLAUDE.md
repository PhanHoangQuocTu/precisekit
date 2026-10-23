# CLAUDE.md — @fatdevcon/precisekit

> Repository-wide instructions for Claude Code. This is a **published TypeScript utility library**, not a frontend application or API server. Prioritize correct public contracts, zero runtime dependencies, small consumer bundles, stable types and safe releases.

## Project facts — verify against the working tree

- Package: `@fatdevcon/precisekit`; public source entry: `src/index.ts`; implementation commonly lives under `src/modules/`, types under `src/types/`, tests under `src/__tests__/`.
- Existing stack on the public repository: **TypeScript, tsup (ESM/CJS JS), Rollup DTS, Jest, ESLint, npm**, GitHub Actions and a static `docs/` website/playground.
- Known build outputs: `dist/index.mjs`, `dist/index.js`, `dist/index.d.mts`, `dist/index.d.ts`. `package.json` and the real build output are authoritative if this changes.
- Supported claims to preserve until deliberately revised: **no runtime dependencies**, Node.js >=18, supported Bun versions and modern browsers through bundlers, tree-shakeable side-effect-free exports.
- `tsup.config.ts` intentionally uses `minify: false`, `treeshake: true`, `splitting: false` for readable auditable publishing. **Do not flip minification simply to make `dist` smaller.** Measure consumer bundles separately.
- `decimal.js` and `date-fns` are **dev-only differential-testing oracles**, NOT runtime dependencies. Never claim complete API parity with either library.
- Project versions evolve: always read the **current local** `package.json`. Never assume a remembered release number is still current.

## Mandatory engineering principles

1. **Correctness > public compatibility > security > maintainability > measurable performance > speed.** Never optimize at the cost of silently wrong results.
2. **Read before writing:** inspect `git status`, owning module, call sites, relevant tests, public exports, related docs and packaging scripts. Read only what the task needs.
3. **Small, cohesive changes:** reuse existing primitives; do not create duplicate helpers, new frameworks, unrelated refactors or needless abstractions.
4. **Public API is a contract:** maintain names, overloads, runtime return kinds, numeric/string formatting, thrown error codes, mutation policy, types, and exposed import paths unless a breaking change is requested.
5. **No runtime dependencies by default.** Request an explicit design justification before introducing one; do not pull optional dev test libraries into built output.
6. **Pure and platform-neutral by default:** no hidden network/telemetry, import-time I/O, global/prototype mutation, or unconditional browser/Node globals.
7. **Validate real JS callers.** Handle malformed inputs and boundary conditions as documented. Catch exceptions only where recovery, cleanup or meaningful translation is possible; never swallow errors.
8. **Keep tree-shaking real.** Prevent accidental dependency cascades, cycles, side effects and bundled test/docs artifacts. Compare consumer import weight for changes that may affect it.
9. **Tests and verification are part of implementation.** Never suppress failing assertions, fake results, or mark unexecuted checks as passed.
10. **Protect user work.** Do not reset branches, overwrite unrelated edits, push, commit, tag, publish, deploy or alter npm registry without explicit permission.

## Workflow

### Discover and decide
- Identify owning module, existing public consumers/exports, feature behavior, declarations, tests, docs and version impact.
- For nontrivial work, state a concise plan with compatibility risks and a targeted verification strategy. Ask only about genuine ambiguity or destructive changes.
- For numeric/date/object/async algorithms, define edge cases and failure behavior before changing the implementation.

### Implement
- Prefer isolated modules and named exports; share a private helper only when genuinely reused.
- Keep numeric precision exact, date/time semantics explicit, string manipulation Unicode-safe, object helpers prototype-pollution-resistant and async cleanup reliable.
- For changed public behavior, update **source + tests + declarations/exports as applicable + docs examples** together.

### Verify (scale to risk)
- Discover scripts from `package.json`; normally start with focused Jest tests and finish with `npm run check` for deliverable code changes.
- For published/exported behavior, consider `npm run test:package`, `npm run test:tarball` (requires Bun), ESM/CJS/typings checks, pack inspection and consumer-bundle comparisons.
- For docs-site/playground changes, build before `npm run docs:sync`, then run `npm run test:docs` and `npm run test:site`.
- Review `git diff`, including lockfile churn and generated website artifacts; report blocked/skipped checks accurately.

### Version and delivery
- For **each completed logical repository update** (including docs/config/test changes), bump the package version **once**, following the repository's documented `0.x`/SemVer release convention. Do not bump for analysis-only work or each intermediate file edit.
- Synchronize `package.json`, `package-lock.json`, `CHANGELOG.md`, README, docs/metadata and applicable release scripts. Check existing `scripts/verify-package.mjs` for hardcoded version assertions; prefer a reliable dynamic check when changing that test.
- Do not publish or create Git tags without an explicit request. An unfinished or blocked task must not be represented as release-ready.
- Final response: **Changes | Version old -> new | Verification: pass/fail/not run | Dependency/bundle/pack impact | Risks**.

## Detailed rules

Claude Code discovers `.claude/rules/*.md`; apply the task-relevant rules:

- `01-architecture.md` — private/shared/public boundaries and module ownership.
- `02-reliability-and-security.md` — exception policy, prototype safety, async cleanup.
- `05-npm-package-and-bundle.md` — exports, ESM/CJS/types, tree-shaking and tarball.
- `06-verification.md` — project-specific commands, consumer gates and regressions.
- `07-release-and-documentation.md` — versions, changelog, docs and release safety.
- `08-typescript-and-runtime.md` — TS declarations, Node/browser/SSR portability.
- `09-utility-function-contracts.md` — dates, strings, arrays, objects, Intl, async.
- `10-exact-numeric-engine.md` — BigInt/decimal arithmetic, return-kind and error invariants.

**Precedence:** current verified source code and published compatibility promises over speculative examples here. If an instruction would violate an existing public contract, preserve the contract and flag the discrepancy rather than silently rewriting it.
