# <!-- package-metadata:display-name -->PreciseKit<!-- /package-metadata:display-name -->

<!-- package-metadata:tagline -->Exact, Safe &amp; Reliable TypeScript Utilities<!-- /package-metadata:tagline -->

<p>
  <a href="https://www.npmjs.com/package/@fatdevcon/precisekit"><img alt="npm version" src="https://img.shields.io/npm/v/@fatdevcon/precisekit?color=0b5fff&label=npm"></a>
  <a href="https://github.com/PhanHoangQuocTu/precisekit/actions/workflows/ci.yml"><img alt="CI status" src="https://img.shields.io/github/actions/workflow/status/PhanHoangQuocTu/precisekit/ci.yml?branch=master&label=CI"></a>
  <a href="LICENSE"><img alt="MIT license" src="https://img.shields.io/npm/l/@fatdevcon/precisekit?color=2da44e"></a>
  <img alt="Zero runtime dependencies" src="https://img.shields.io/badge/runtime%20dependencies-0-2da44e">
  <img alt="Node.js 18 or newer" src="https://img.shields.io/badge/node-%E2%89%A518-5fa04e">
  <img alt="TypeScript declarations included" src="https://img.shields.io/badge/types-included-3178c6">
</p>

<!-- package-metadata:description -->Zero-dependency TypeScript utilities for exact math, financial calculations, safe data handling, locale parsing, dates, security and async workflows.<!-- /package-metadata:description -->

- **Exact by default**: decimal and BigInt arithmetic, minor-unit money, strict locale parsing.
- **Safe at the boundary**: normalize untrusted records, redact logs, validate redirects, copy objects without prototype pollution.
- **Small and auditable**: no runtime dependencies, named exports, `sideEffects: false`, readable unminified ESM/CommonJS and bundled `.d.ts`/`.d.mts`.

[Documentation](https://phanhoangquoctu.github.io/precisekit/) ·
[API reference](https://phanhoangquoctu.github.io/precisekit/#api) ·
[Playground](https://phanhoangquoctu.github.io/precisekit/#playground) ·
[Changelog](CHANGELOG.md)

## Contents

[Install](#install) · [Quick start](#quick-start) · [Workflows](#workflows) · [New in 0.5.2](#new-in-052) ·
[Examples](#money-without-hidden-rounding) · [Compatibility](#compatibility) · [Bundle size](#bundle-size-and-tree-shaking) ·
[Security](#security) · [Migration](#migration) · [Contributing](#contributing-and-license)

## Install

```sh
npm install @fatdevcon/precisekit
# pnpm add @fatdevcon/precisekit · yarn add @fatdevcon/precisekit · bun add @fatdevcon/precisekit
```

Requires Node.js 18+, Bun, or a modern browser through a bundler. Locale behavior
follows the runtime's ICU/Intl data.

## Quick start

```ts
import { summary, round, formatCurrency, allocateMoney } from "@fatdevcon/precisekit";

summary(0.1, 0.2); // 0.3
round(1.005, 2); // 1.01
formatCurrency("12345678901234567890.129", "USD");
// "$12,345,678,901,234,567,890.13"
allocateMoney("10.00", [1, 1, 1], { currency: "USD" });
// ["3.34", "3.33", "3.33"]
```

Use decimal strings or bigint when a JavaScript number cannot retain all digits.
Existing numeric helpers preserve their documented number/bigint/string result
kinds and throw typed errors rather than silently overflowing or underflowing.
No function can recover precision already lost before receiving a number.

Try it without installing: [open the playground](https://phanhoangquoctu.github.io/precisekit/#playground).

<a id="api-index"></a>

## Workflows

| Need | APIs |
| --- | --- |
| Exact money | `toMinorUnits`, `fromMinorUnits`, `allocateMoney`, `calculateTax`, `applyDiscount` |
| External data | `normalizeRecord`, `normalizeArray`, nullable `safeTo*` converters |
| Locale parsing | `parseLocalizedNumber`, `parseLocalizedCurrency`, `parseLocalizedPercent` |
| Bounded async work | `mapConcurrent`, `mapSettledConcurrent`, `batchAsync`, `withTimeout` |
| Business calendars | `isBusinessDay`, `addBusinessDays`, `differenceInBusinessDays`, `nextBusinessDay` |
| Safer URLs and logs | `isSafeRedirectUrl`, `getSafeRedirectTarget`, `redactSensitiveFields`, `sanitizeUrlForLogging` |
| Collections and objects | `compactNullish`, `pickBy`, `pick`, `omit`, `getByPath`, `hasByPath`, `setByPath`, `deepMerge` |
| Existing utilities | Exact arithmetic, date/timezone formatting, Unicode text, immutable collections, retry, debounce and validators |

The [API reference](https://phanhoangquoctu.github.io/precisekit/#api) documents
each signature, default, return kind, error and example.

## New in 0.5.2

Security maintenance: linear-time date/number parsing and FAQ text extraction,
with regression tests for adversarial inputs. Public APIs and runtime dependencies
are unchanged. CI and OIDC release verification are documented in
[the release report](https://github.com/PhanHoangQuocTu/precisekit/blob/master/plans/v0.5.2-security-ci-release-report.md).

### Helpers added in 0.5.1

```ts
import { compactNullish, hasByPath, getByPath, pickBy } from "@fatdevcon/precisekit";

compactNullish([0, null, "", undefined, false, 1]); // [0, "", false, 1]

const data = { a: { b: undefined, list: [{ id: 1 }] } };
hasByPath(data, "a.b"); // true  (own property, value is undefined)
getByPath(data, "a.b"); // undefined
hasByPath(data, "a.list[0].id"); // true
hasByPath({}, "toString"); // false (inherited, not own)

pickBy({ id: 7, note: null, flag: false }, (value) => value !== null);
// { id: 7, flag: false }
```

- `compactNullish` removes only `null` and `undefined`; `0`, `false`, `""`, `NaN` and `0n` stay.
- `hasByPath` checks own properties only, never runs getters and returns `false` for array holes and primitives.
- `pickBy` keeps own enumerable string and symbol keys the predicate accepts and writes plain data properties, so an own `__proto__` key cannot pollute prototypes.

## Money without hidden rounding

```ts
import { toMinorUnits, calculateTax } from "@fatdevcon/precisekit";

toMinorUnits("123.45", { currency: "USD" }); // 12345n
toMinorUnits("1.005", { currency: "USD", roundingMode: "half-even" }); // 100n
calculateTax("100.00", "0.08", { currency: "USD", mode: "exclusive" });
// { subtotal: "100.00", tax: "8.00", total: "108.00" }
```

Excess input precision rejects unless `roundingMode` is explicit. Generated tax
and percentage discounts default to half-even. Tax rate `"0.08"` means 8%;
discount percentage `"15"` means 15%. Discounts above the original reject.
Currency support uses the bundled active-tender snapshot and ICU decimal scales;
these helpers do not implement jurisdiction-specific accounting or tax law.

## Normalize untrusted records

```ts
import { normalizeRecord, strip, safeToInteger, safeToBoolean } from "@fatdevcon/precisekit";

const result = normalizeRecord(
  { name: "  Minh  ", age: "21", active: "true" },
  { name: strip, age: safeToInteger, active: safeToBoolean },
);
if (result.success) {
  result.data; // inferred { name: string; age: number; active: boolean }
} else {
  result.errors; // path, code and safe message
}
```

Nullish returns and exceptions are failures. Own data properties are read without
invoking getters. Missing fields fail unless a schema descriptor supplies a
default. Array failures expose indexed successes/errors rather than a misleading
complete output array. Caller-provided normalizers remain responsible for their
own side effects and mutations.

## Parse locale data exactly

```ts
import { parseLocalizedNumber, parseLocalizedPercent } from "@fatdevcon/precisekit";

parseLocalizedNumber("1.234,56", { locale: "de-DE" }); // "1234.56"
parseLocalizedPercent("12.5%", { locale: "en-US" }); // "0.125"
```

Parsing is strict standard notation with locale-specific digits, grouping and
affixes. It returns canonical decimal strings without rounding; malformed
grouping, exponent and compact notation reject.

## Bound asynchronous work

```ts
import { mapConcurrent, batchAsync } from "@fatdevcon/precisekit";

const values = await mapConcurrent([1, 2, 3], async n => n * 2, { concurrency: 2 });
const sizes = await batchAsync(values, async batch => batch.length, { batchSize: 2 });
```

Results retain input order. Fail-fast and abort stop new scheduling while
in-flight tasks continue with rejection handlers attached. Abort rejects with
the signal reason. `mapSettledConcurrent` collects task failures; abort still
rejects the whole operation.

## Civil dates and safe logs

```ts
import { addBusinessDays, getSafeRedirectTarget, sanitizeUrlForLogging } from "@fatdevcon/precisekit";

addBusinessDays("2026-12-24", 1, { holidays: ["2026-12-25"] }); // "2026-12-28"
getSafeRedirectTarget("https://evil.example", { fallback: "/" }); // "/"
sanitizeUrlForLogging("https://example.com/?token=secret&page=1");
// "https://example.com/?token=%5BREDACTED%5D&page=1"
```

Business calendars accept strict Gregorian `YYYY-MM-DD` strings, years
0000–9999, independently of timezone. Holidays are caller supplied.
Redirect validation is not SSRF protection. Redaction supports plain objects,
arrays, cycles and cloned Dates; unsupported structures/accessors reject.

## CommonJS

```js
const { summary } = require("@fatdevcon/precisekit");
```

## Compatibility

| Area | Support |
| --- | --- |
| Runtimes | Node.js 18+, Bun, modern browsers through a bundler, SSR-safe at import time |
| Module formats | ESM (`import`) and CommonJS (`require`), each with matching TypeScript declarations |
| TypeScript | Bundled `.d.ts` / `.d.mts`, checked with strict NodeNext `.mts` and `.cts` consumers |
| Dependencies | None at runtime. `decimal.js` and `date-fns` are dev-only test oracles |
| Tree-shaking | `sideEffects: false`, named exports, no import-time work |
| Package paths | The root export and `dist/*` are retained |

Building this repository needs Node.js 22.18+ because of its toolchain; using the
published package does not.

## Bundle size and tree-shaking

Distribution JS intentionally stays readable and unminified. Consumer bundlers
can remove unused named exports. Current raw, minified, gzip and Brotli figures
for the full bundle and for selected imports are generated by `npm run test:bundle`;
see the [measured data](docs/bundle-data.json) and the
[bundle comparison](https://phanhoangquoctu.github.io/precisekit/#size) in the docs.
A larger full-root bundle reflects added functions; selected imports are measured
independently.

## Security

- Zero runtime dependencies and no install-time scripts.
- `setByPath` and `deepMerge` refuse `__proto__`, `constructor` and `prototype` keys. `pick`, `omit`, `pickBy` and `hasByPath` treat an own `__proto__` key as plain data and never change a prototype. `hasByPath` never runs getters; `getByPath` and `pickBy` read values, so own getters run.
- `isSafeRedirectUrl` is not SSRF protection; redaction rejects unsupported structures instead of guessing.
- Report vulnerabilities privately using [SECURITY.md](SECURITY.md).

## Migration

For `@fatdevcon/utilities@0.4.2 → @fatdevcon/precisekit@0.5.0`, replace the
installation and import name. Existing function contracts remain supported.

```sh
npm uninstall @fatdevcon/utilities
npm install @fatdevcon/precisekit
```

See the [migration guide](docs/migration-from-utilities.md). Old changelog entries
retain their historical identity. Publication/deprecation are manual maintainer
actions and are not performed by local verification.

## Contributing and license

Report bugs and ideas through [Issues](https://github.com/PhanHoangQuocTu/precisekit/issues);
please open an issue before sending a pull request. See [CONTRIBUTING.md](CONTRIBUTING.md)
for the development workflow.

MIT license; [third-party notices](THIRD_PARTY_NOTICES.md) preserve data credits.
