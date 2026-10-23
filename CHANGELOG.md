# Changelog

All notable changes to `@fatdevcon/precisekit`. The project follows [semantic versioning](https://semver.org/).

## 0.5.1

### Added

- `compactNullish` removes only `null` and `undefined` from an array and keeps `0`, `false`, `""`, `NaN` and `0n`. It accepts readonly arrays, returns a new array and narrows the element type with `NonNullable`.
- `hasByPath` reports whether a nested path is made of own properties, so properties whose value is `undefined` count and inherited ones do not. It uses the `getByPath` path syntax, never runs getters and returns `false` for array holes, primitives and empty paths.
- `pickBy` copies the own enumerable string and symbol properties accepted by a predicate into a new object with plain data properties. A type-guard predicate narrows the result type, and an own `__proto__` key is copied as data without changing any prototype.
- Contributor documentation: `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, issue and pull request templates and `CODEOWNERS`.

### Changed

- `getByPath`, `setByPath` and `hasByPath` accept readonly array paths. The change only widens the accepted parameter type.
- Added tests for `withTimeout` timer cleanup, late-rejection handling, error messages and argument validation, and documented its 2147483647 ms timer limit. Its behavior is unchanged.
- Rebuilt the documentation site with a documentation-style layout, compact searchable API cards, copyable code blocks, an accessible mobile sidebar and consistent light and dark themes. The themes use `light-dark()`, which needs a browser from 2024 or later.
- Replaced the bundle-size chart with horizontal bars on one gzip scale that separate historical fixtures from the current measurement, and added the new helpers to the measured consumer fixtures.
- Redesigned the README with badges, a contents list, a compatibility table and security notes.
- Updated development dependencies to their latest stable releases, including `tsup` 9, `eslint` 10.13, `@typescript-eslint` 8.72, `rollup` 4.65 and `ts-jest` 29.4.15, and removed the unused `eslint-config-prettier`. Rebuilding the unchanged 0.5.0 sources with the new toolchain produced byte-identical `dist` files.
- Building the repository now needs Node.js 22.18 or newer because `tsup` 9 requires it. The published package still supports Node.js 18 and newer.
- `scripts/release.sh` no longer pushes or publishes. It runs the pre-release checks and prints the tag and release commands.

### Security

- GitHub Actions are pinned to full commit SHAs at their latest major versions, and CI has concurrency groups, `persist-credentials: false` and a Node 18, 20, 22 and 24 compatibility matrix.
- The publish workflow uses npm trusted publishing (OIDC) with provenance instead of a long-lived token. It needs the npm trusted publisher and a GitHub `npm` environment to be configured before the next release.
- Added CodeQL and dependency-review workflows and grouped Dependabot updates.

### Compatibility

- No existing function, signature, runtime result, error code or export path changed. The package still has zero runtime dependencies, readable unminified output and side-effect-free named exports.

## 0.5.0

### Added

- Exact money conversion, proportional allocation, inclusive/exclusive taxes and fixed/percentage discounts with explicit currency precision policies.
- Typed record/array normalization with indexed errors, own-property validation and safe failure results.
- Strict locale-aware number, currency and percent parsers that preserve exact decimal text.
- Ordered concurrency-limited mapping, settled mapping and lazy asynchronous batches with AbortSignal support.
- Timezone-independent business-calendar helpers with configurable weekends and caller-supplied holidays.
- Redirect validation, safe fallback selection, cycle-preserving field redaction and URL sanitization for logs.

### Changed

- Renamed the package from `@fatdevcon/utilities` to `@fatdevcon/precisekit` and moved the active repository and documentation URLs to the PreciseKit identity.
- Updated documentation synchronization, package, tarball and static-site verification to resolve current package identity, version and URLs from authoritative manifest metadata instead of stale release literals.
- Renamed the checked-in playground bundle to `docs/assets/precisekit.mjs` and synchronized installation commands, imports, SEO metadata and crawler URLs.

### Compatibility

- Existing functions, signatures, ESM/CommonJS behavior, TypeScript declarations, exact numeric behavior and root export paths are unchanged after updating the package import name.
- The package retains zero runtime dependencies, readable unminified output and side-effect-free named exports.
- Historical release notes continue to use the package name under which those versions were published.

## 0.4.2

### Fixed

- Replaced the documentation playground's dynamic source execution with a bounded parser for allowlisted synchronous public calls and data literals. Editable text is no longer compiled or executed as JavaScript.
- Moved API reference data to an ESM export and removed dynamic compilation of that data from documentation verification.

### Improved

- Refined the static documentation interface with local system font stacks, retained light and dark themes, keyboard navigation, responsive API browsing and stable anchors.
- Removed third-party font requests from the documentation site. The site now uses only local browser fonts and the checked-in package artifact.
- Added safe-playground checks to the static-site verification and audited all 195 documented public functions against the built package.

### Compatibility

- No public library API, runtime dependency, ESM/CJS import path, declaration contract or exact numeric behavior changed.

## 0.4.1

### Added

- `strip`, `lstrip`, `rstrip`: ECMAScript whitespace trimming or an explicit Unicode code-point set.
- `title`: Unicode word casing that preserves whitespace/punctuation and internal apostrophes.
- `firstChar`, `lastChar`: grapheme endpoints with a documented code-point fallback without `Intl.Segmenter`.
- `safeToNumber`, `safeToInteger`, `safeToBigInt`, `safeToBoolean`, `safeToString`: unknown-input conversion with explicit `null` failure results, safe integer checks and no object coercion in numeric/boolean conversion.

### Improved

- `capitalize` extracts only the first grapheme instead of segmenting the entire input; the rest of the string and the existing locale argument remain unchanged.
- Segmenter instances initialize lazily and are reused without retaining user text.

### Fixed

- Importing the root package no longer fails solely because `Intl.Segmenter` is absent. Existing grapheme/word formatters still require it when called; new endpoints provide their documented fallback.

### Tests

- Added Unicode, hostile-object/proxy, precision, strict-API compatibility, JSON and seeded property/oracle regressions.
- Extended installed ESM/CJS and TypeScript consumer probes for the new APIs and version consistency.
- Added reproducible browser-consumer bundle measurement and bounded million-character/10,000-level JSON stress checks and benchmarks.

### Documentation

- Documented all new signatures, failure contracts, numeric syntax, floating-point limits, Unicode fallback and casing differences in README and the API reference.
- Updated website release metadata and playground examples; preserved existing strict conversions, JSON result types and capitalization behavior.
- Zero runtime dependencies, unminified builds and existing public import paths remain unchanged.

## 0.4.0

### Added

- Local-calendar date arithmetic (`addWeeks`, subtraction helpers and year helpers), boundaries, comparisons, injectable-now predicates, full-unit differences and calendar metadata.
- Import-safe runtime capability checks for browser, DOM, Node, Bun-backed server contexts and browser workers.
- Immutable collection ergonomics: `sort`, `enumerate`, `take`, `drop`, `first`, `last`, `minBy`, `maxBy` and exact `sumBy`.
- Strict primitive guards, safe JSON result helpers, strict conversion helpers and prototype-safe query-string helpers.

### Changed

- Date/month arithmetic and IANA offset calculation now preserve proleptic Gregorian years `0`–`99` instead of inheriting JavaScript's `Date` constructor/`Date.UTC` 1900-year adjustment.
- Package verification now validates SemVer shape instead of a release-specific version literal, so future release candidates do not inherit a stale assertion.
- README and static API reference document the new API contracts, local-date semantics, runtime definitions and 0.3.7 → 0.4.0 upgrade path.

### Compatibility

- No intentional breaking changes. Existing root imports, exact numeric behavior, zero runtime dependencies and readable ESM/CJS output are retained.

## 0.3.7

- README: the Socket badge rendered as a broken image on npm (its endpoint is behind a bot challenge); replaced with a static badge that links to the live report. The bundlephobia badge is replaced with a registry-backed unpacked-size badge.
- Documentation site: the size comparison and release notes now show the current version.

## 0.3.6

- Clearer package description for npm search and a more precise keyword set.
- Test-only fix: the local time zone offset assertion no longer fails on runtimes whose zone is UTC (it compared `0` with `-0`). The library itself is unchanged.

## 0.3.5

### Changed

- **No runtime dependencies.** `decimal.js` and `date-fns` are replaced by an in-package BigInt decimal engine and an ISO 8601 parser and formatter. The bundle shrinks from 90.9 kB to 59.1 kB minified (32.3 kB to 21.4 kB gzipped) as measured on the full package, and installing the package adds nothing else to `node_modules`.
- The old engines moved to `devDependencies` and act as test oracles: hundreds of thousands of seeded random operations are compared against `decimal.js` and `date-fns`, and a differential run over the public API compared 720,000 calls with 0.3.4 with no differences.
- Published files are no longer minified and no longer ship source maps, so they read like source and are easy to audit.
- Very long numbers convert to and from text in chunks, which keeps 300,000-digit values fast on JavaScriptCore (Bun) as well as V8.
- `formatDate` now accepts `FormatDateOptions` (`timeZone`, `locale`, `weekStartsOn`, `firstWeekContainsDate`, `useAdditionalWeekYearTokens`, `useAdditionalDayOfYearTokens`). The tokens match date-fns, and a date-fns `Locale` object is still accepted as `locale`.
- `formatDate(date, "")` returns `""` instead of throwing a `TypeError`.
- The protected-token error for `YY`, `YYYY`, `D` and `DD` has a shorter message, and no console warning is printed for the other protected tokens.

### Added

- `parseISO`, `addDays`, `addMonths`, `startOfDay`, `endOfDay`, `differenceInCalendarDays`.
- `parseDuration` (inverse of `formatDuration`) and `parseBytes` (inverse of `formatBytes`, with `base` and `bigint` options).
- `setByPath` (immutable, prototype-pollution safe) and `escapeRegExp`.
- Error code `ERR_INVALID_FORMAT`.
- A redesigned documentation site with a live playground that runs the real package in the browser, and a CHANGELOG, a security policy, CI and publish workflows with npm provenance.

## 0.3.4

- Package landing page and discoverability metadata for the documentation site.

## 0.3.3

- Time zone offsets in seconds, minutes or hours, with an optional native `Date#getTimezoneOffset` direction.

## 0.3.2

- Time zone utilities: `isTimeZone`, `getTimeZoneOffset`, `getTimeZoneName`, `formatInTimeZone`.

## 0.3.1

- Abort-aware `wait`, `withRetry`, `sleep`, `retry` and related helpers.

## 0.3.0

- Big-number support: every numeric helper accepts numbers, bigints and numeric strings, with exact decimal math, stable error codes and common helpers.
