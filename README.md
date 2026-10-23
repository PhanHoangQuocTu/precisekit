# <!-- package-metadata:display-name -->PreciseKit<!-- /package-metadata:display-name -->

<!-- package-metadata:tagline -->Exact, Safe &amp; Reliable TypeScript Utilities<!-- /package-metadata:tagline -->

<!-- package-metadata:description -->Zero-dependency TypeScript utilities for exact math, financial calculations, safe data handling, locale parsing, dates, security and async workflows.<!-- /package-metadata:description -->

Zero runtime dependencies, named exports, ESM/CommonJS and bundled declarations.

[Documentation](https://phanhoangquoctu.github.io/precisekit/) ·
[API reference](https://phanhoangquoctu.github.io/precisekit/#api) ·
[Playground](https://phanhoangquoctu.github.io/precisekit/#playground) ·
[Changelog](CHANGELOG.md)

## Install

```sh
npm install @fatdevcon/precisekit
```

Also supports pnpm, Yarn and Bun. Requires Node.js 18+, Bun, or a modern
browser through a bundler. Locale behavior follows the runtime's ICU/Intl data.

## Start with exact values

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

<a id="api-index"></a>

## Workflows

| Need | APIs |
| --- | --- |
| Exact money | `toMinorUnits`, `fromMinorUnits`, `allocateMoney`, `calculateTax`, `applyDiscount` |
| External data | `normalizeRecord`, `normalizeArray`, nullable `safeTo*` converters |
| Locale parsing | `parseLocalizedNumber`, `parseLocalizedCurrency`, `parseLocalizedPercent` |
| Bounded async work | `mapConcurrent`, `mapSettledConcurrent`, `batchAsync` |
| Business calendars | `isBusinessDay`, `addBusinessDays`, `differenceInBusinessDays`, `nextBusinessDay` |
| Safer URLs and logs | `isSafeRedirectUrl`, `getSafeRedirectTarget`, `redactSensitiveFields`, `sanitizeUrlForLogging` |
| Existing utilities | Exact arithmetic, date/timezone formatting, Unicode text, immutable collections, object paths, retry, debounce and validators |

The [API reference](https://phanhoangquoctu.github.io/precisekit/#api) documents
each signature, default, return kind, error and example.

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

## Modules, types and performance

```js
const { summary } = require("@fatdevcon/precisekit");
```

Strict NodeNext `.mts` and `.cts` consumer fixtures check inference, options and
negative type cases against the installed tarball. Existing root and
`dist/*` exports are retained. Runtime detection is import-safe for SSR.

Distribution JS intentionally stays readable and unminified. Consumer bundlers
can remove unused named exports. Current raw/minified/gzip/Brotli and subsystem
measurements are generated by `npm run test:bundle`; see
[measured data](docs/bundle-data.json) and the release verification report.
A larger full-root bundle reflects added functions; selected imports are measured
independently. There are no runtime dependencies.

## Migration and support

For `@fatdevcon/utilities@0.4.2 → @fatdevcon/precisekit@0.5.0`, replace the
installation and import name. Existing function contracts remain supported.

```sh
npm uninstall @fatdevcon/utilities
npm install @fatdevcon/precisekit
```

See the [migration guide](docs/migration-from-utilities.md). Old changelog entries
retain their historical identity. Publication/deprecation are manual maintainer
actions and are not performed by local verification.

Report bugs through [Issues](https://github.com/PhanHoangQuocTu/precisekit/issues).
Report vulnerabilities privately using [SECURITY.md](SECURITY.md).
MIT license; [third-party notices](THIRD_PARTY_NOTICES.md) preserve data credits.
Maintained by the package owner; external contributions are not accepted.
