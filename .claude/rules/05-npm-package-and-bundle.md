# npm package integrity, real tree-shaking and bundle weight

Treat the **installed consumer experience** as the product. Raw output bytes, tarball bytes, minified+gzip bytes and browser-consumer bundle bytes are different metrics.

## Actual build topology (reconfirm locally)

- `tsup.config.ts`: ESM + CommonJS generated from `src/index.ts`, ES2020 target, `minify: false`, `treeshake: true`, `splitting: false` by deliberate design. Avoid changing these simply because a generic bundling guide says so.
- `rollup.config.mjs` generates `dist/index.d.ts` and `dist/index.d.mts`; inspect actual emissions before declaring success.
- `package.json` may expose the root via conditional import/require typings and `./dist/*`; preserve published package paths unless compatibility migration is approved.
- The current package claims **zero runtime dependencies** and `sideEffects: false`. Treat these as enforced product invariants, not decoration. Dev-only `decimal.js`/`date-fns` must not leak into built JS or installation dependencies.

## Tree-shaking and performance

- Avoid import-time computation, mutation, environment reads, Node polyfills, optional feature eager imports, cycles and heavyweight shared barrel patterns.
- Adding a public function must not force unrelated large Intl datasets, numeric algorithms or date implementations into a consumer bundle when tree-shaking should remove them.
- Preserve readable, auditable non-minified distribution unless there is explicit agreement to change it; consumers can minify downstream. Never equate enabling tsup `minify` with verified application-size improvement.
- Compare the **same** small consumer fixture (`import { helper } from "@fatdevcon/precisekit"`) before/after with an existing or approved bundler configuration; record raw/minified/gzip and selected-import size only if actually measured.
- If baseline or tooling is missing, say *not measured*; do not install a benchmark suite, make up a budget or promise zero bundle growth.
- Optimize algorithms only where a correctness-preserving change has measured payoff; test worst cases and memory for large BigInt/decimal input when relevant.

## Package inspection and exports

- Verify `exports`, `main`, `module`, `types`, `files`, `sideEffects`, `engines` and built filenames as a consistent unit.
- Exercise **both** ESM `import` and CJS `require` where supported, and TS `.mts`/`.cts` consumers for declaration correctness.
- Check `npm pack --dry-run --json` for unintended test, CI, coverage, secrets, source maps, `node_modules`, generated docs or agent files. Keep LICENSE and third-party notices where declared.
- Existing `npm run test:tarball` verifies installing packed output; it also invokes Bun. If Bun is absent, report the exact missing prerequisite instead of treating it as passing.
- `npm pack` may invoke lifecycle hooks; use `--dry-run` for inspection and consider `prepack` (`npm run build`) and generated file churn before proceeding.
- Avoid adding runtime or peer dependencies. If absolutely required, discuss cost, security/maintenance, compatibility, licensing and tree-shaking with the maintainer first.

## Release gate

For changes affecting entry points, types, dependency graph, exports or build: run `npm run check`, `npm run test:package`, packed-content validation and targeted consumer smoke tests; add `npm run test:tarball` for release readiness when prerequisites are installed. Document actual results and deltas.
