# TASK: Rebrand to PreciseKit & Implement Production-Grade v0.5.0

## 1. ROLE & OBJECTIVE

You are acting as a team of:

- **Principal Software Engineer / Library Architect:** Design reliable, maintainable, extensible public APIs.
- **Senior TypeScript Developer:** Implement strongly typed, zero-runtime-dependency, tree-shakeable utilities.
- **Numerical & Data Correctness Engineer:** Ensure exact arithmetic, safe conversions, robust date and locale behavior.
- **Senior QA / Test Engineer:** Design extensive unit, integration, regression, stress, differential and property-based tests.
- **Senior UI/UX Designer & Frontend Engineer:** Modernize documentation and developer experience.
- **Release & Package Engineer:** Ensure npm metadata, distribution artifacts, documentation and compatibility remain correct.

**Main objectives:**

1. Rebrand `@fatdevcon/utilities` to **`@fatdevcon/precisekit`**.
2. Upgrade the project from v0.4.2 (verify actual local version) to **v0.5.0**.
3. Implement six major feature groups:
   - Exact money & financial calculations
   - Safe API data normalization
   - Locale-aware parsing
   - Reliable asynchronous workflows
   - Calendar & business-date helpers
   - URL & data-security helpers
4. Audit and improve existing functions without unintended breaking changes.
5. Modernize documentation, API reference, playground and IntelliSense.
6. Validate correctness, performance, security, bundle size and npm packaging.

All explanations, plans, progress summaries and final reports must be written in **Vietnamese**. Code, TypeScript identifiers, documentation and public-facing package content should use professional English.

## 2. EXISTING PROJECT CONTEXT

Current public repository:

`https://github.com/PhanHoangQuocTu/fatdevcon-utilities`

Current documentation:

`https://phanhoangquoctu.github.io/fatdevcon-utilities/`

Target identity:

- Display name: `PreciseKit`
- Package: `@fatdevcon/precisekit`
- Version: `0.5.0`
- Target GitHub repository: `PhanHoangQuocTu/precisekit`
- Target docs: `https://phanhoangquoctu.github.io/precisekit/`
- Old package: `@fatdevcon/utilities`

The repository currently uses TypeScript, tsup, Rollup DTS, Jest, ESLint, npm, GitHub Actions and a static documentation website.

**The working tree is the source of truth. Do not assume the public GitHub branch is fully synchronized with local changes.**

Before modifying anything:

1. Inspect `git status`, `package.json`, lockfile, repository structure and actual build outputs.
2. Read `CLAUDE.md`, `AGENTS.md` and task-relevant `.claude/rules/`.
3. Inspect `src/index.ts`, `src/modules/`, `src/types/`, `src/__tests__/`, `docs/`, `scripts/`, `.github/workflows/` and build configuration as relevant.
4. Identify every existing public export, signature, overload, error contract, return type and internal helper.
5. Understand the current decimal engine, date/timezone system, documentation generation and bundling behavior.
6. Identify code or features that can be reused instead of duplicated.
7. Record the baseline results of tests, public exports, runtime dependencies, package sizes and consumer bundle measurements.

Use available Claude Code tools, active skills, MCP servers and specialized agents when they materially improve accuracy or productivity. Delegate independent research, codebase analysis, testing and documentation review where appropriate. Do not invoke tools or agents unnecessarily.

If multiple model roles are available, prioritize efficient models for repository discovery, capable coding models for implementation, and stronger reasoning for architecture or difficult correctness reviews.

## 3. MANDATORY WORKFLOW

### Phase A — Repository audit and implementation plan

Create a detailed implementation plan at:

`plans/precisekit-v0.5.0.md`

If the repository has an established plans convention, use that convention instead.

The plan must include:

- Existing architecture and feature inventory.
- Public API compatibility assessment.
- New feature specifications and TypeScript contracts.
- Shared abstractions and module ownership.
- File creation/modification map.
- Implementation phases and dependency ordering.
- Testing strategy and complex edge cases.
- Security considerations.
- Bundle-size baseline and budgets.
- Documentation architecture decision.
- Package rebranding and migration checklist.
- CI/CD and release-readiness checklist.
- Risks, tradeoffs and acceptance criteria.

Clearly separate existing behavior from proposed behavior.

After writing the plan, **continue implementation in the same task**. The plan must guide actual changes, not become a substitute for implementation.

If an operation requires changing GitHub repository settings, npm ownership, deployment credentials or external publication, prepare the configuration and instructions but do not execute that external operation without authorization.

### Phase B — Implementation

Implement all six requested feature groups, their tests, types, exports and documentation in manageable phases.

After completing each module:

1. Run targeted tests.
2. Verify the public contract.
3. Check edge cases and mutation behavior.
4. Review maintainability and security.
5. Check relevant build and bundle implications.
6. Continue only after fixing identified issues.

### Phase C — Integration and verification

Run comprehensive verification after integrating all modules.

Do not mark the work complete while known critical failures remain.

## 4. NON-NEGOTIABLE ENGINEERING PRINCIPLES

Priority order:

**Correctness > Security > Public API compatibility > Type safety > Maintainability > Measured performance > Development speed.**

Requirements:

- Preserve zero runtime dependencies.
- Reuse existing exact decimal/BigInt capabilities.
- Avoid unnecessary abstractions and duplicated business logic.
- Prefer pure functions and immutable inputs.
- Preserve existing public contracts wherever possible.
- Maintain stable error codes and meaningful error messages.
- Avoid implicit unsafe coercion and silent numeric precision loss.
- No unnecessary global state, prototype modification, runtime network calls or telemetry.
- Maintain Node.js 18+ compatibility unless explicitly justified otherwise.
- Ensure ESM, CommonJS, Bun and supported browsers work as documented.
- Optimize tree-shaking through genuinely independent named exports.
- Keep implementation modular, readable, testable and maintainable.
- Do not add runtime packages just to simplify implementations.
- Do not rewrite working code without measurable benefits.
- Do not fake benchmark results or pass tests by weakening assertions.
- Do not silently alter rounding policies, error behavior or output types.

Existing build output intentionally remains readable and unminified. **Do not simply minify distributed JavaScript to claim a smaller consumer bundle.**

## 5. FEATURE GROUP A — EXACT MONEY & FINANCIAL CALCULATIONS

Build upon the existing exact decimal engine.

Never rely on ordinary floating-point calculations for intermediate financial values where exactness is required.

### A1. `toMinorUnits`

Purpose: Convert an amount into the smallest currency unit using the currency's correct decimal exponent.

Proposed API:

`toMinorUnits(amount: string | bigint | number, options: { currency: string; roundingMode?: RoundingMode }): bigint`

Example:

`toMinorUnits("123.45", { currency: "USD" }) // 12345n`

Requirements:

- Support currencies with 0, 2, 3 or other valid minor-unit scales.
- Correctly handle negative values and large amounts.
- Define policy for excessive fractional digits.
- Reject invalid currency codes and non-finite numeric values.
- Do not silently truncate extra precision.
- Document JavaScript number precision limitations.

### A2. `fromMinorUnits`

Purpose: Convert an integer minor-unit value to an exact human-readable decimal string.

Proposed API:

`fromMinorUnits(amount: bigint | string, options: { currency: string }): string`

Example:

`fromMinorUnits(12345n, { currency: "USD" }) // "123.45"`

Preserve trailing decimal places when required by the selected currency.

### A3. `allocateMoney`

Purpose: Split an amount proportionally without losing or creating minor currency units.

Proposed API:

`allocateMoney(amount: string, ratios: readonly number[], options: MoneyOptions): string[]`

Example:

`allocateMoney("10.00", [1, 1, 1], { currency: "USD" })`

Expected result:

`["3.34", "3.33", "3.33"]`

Requirements:

- Sum of allocations must exactly equal the original amount.
- Use a deterministic remainder-distribution algorithm.
- Support positive/negative amounts as explicitly documented.
- Reject invalid ratios and zero-total ratios.
- Test highly unbalanced ratios and large allocation arrays.
- Avoid precision loss when representing or summing ratios.

Evaluate whether ratio inputs should also support exact decimal strings or BigInt.

### A4. `calculateTax`

Purpose: Calculate inclusive or exclusive taxes using explicit rounding rules.

Proposed API:

`calculateTax(amount: string, rate: string, options: TaxOptions): TaxResult`

Example:

`calculateTax("100.00", "0.08", { currency: "USD", mode: "exclusive" })`

Expected fields:

`{ subtotal: "100.00", tax: "8.00", total: "108.00" }`

Requirements:

- Inclusive and exclusive tax modes.
- Explicit percentage/rate interpretation.
- Deterministic rounding behavior.
- Correct handling of refunds, negative values and zero rates.
- No undocumented assumption about jurisdiction-specific tax laws.

### A5. `applyDiscount`

Purpose: Apply either a fixed or percentage-based discount safely.

Proposed API:

`applyDiscount(amount: string, discount: DiscountOptions, options: MoneyOptions): DiscountResult`

Examples:

- `applyDiscount("100.00", { type: "percentage", value: "15" }, { currency: "USD" })`
- `applyDiscount("100.00", { type: "fixed", value: "20.00" }, { currency: "USD" })`

Define a clear result structure containing original amount, discount amount and final amount.

Explicitly specify whether discounts exceeding the original amount are rejected or clamped. Never silently choose an ambiguous policy.

### A6. Shared financial correctness

Define reusable public/internal types as appropriate:

- `MoneyOptions`
- `RoundingMode`
- `TaxOptions`
- `TaxResult`
- `DiscountOptions`
- `DiscountResult`

Avoid exporting types that are purely internal.

Test USD, EUR, VND, JPY, KWD and representative currencies with varying decimal scales. Use authoritative currency metadata available from the runtime or explicitly maintained data, with well-documented limitations.

---

## 6. FEATURE GROUP B — SAFE API DATA NORMALIZATION

Create reliable helpers for untrusted API responses, forms, query parameters, JSON and external data.

Reuse existing functions such as `safeToNumber`, `safeToInteger`, `safeToBoolean`, `safeJsonParse`, `pick`, `omit`, `getByPath` and `mapValues` when appropriate.

Do not recreate Zod, Valibot or an entire schema-validation framework.

### B1. `normalizeRecord`

Purpose: Transform an unknown object into a predictable typed record using field-level normalizers.

Proposed API:

`normalizeRecord<TSchema>(input: unknown, schema: TSchema, options?: NormalizeOptions): NormalizeResult<InferNormalized<TSchema>>`

Example:

`normalizeRecord({ name: "  Minh  ", age: "21", active: "true" }, { name: strip, age: safeToInteger, active: safeToBoolean })`

Expected normalized data:

`{ name: "Minh", age: 21, active: true }`

Requirements:

- Strong TypeScript inference.
- Predictable missing-field and null behavior.
- Structured errors with field paths.
- No prototype pollution.
- No mutation of input data.
- No unsafe property access.
- No silent loss of invalid fields.

Check actual existing helper signatures before choosing this exact API.

### B2. `normalizeArray`

Purpose: Normalize arrays of external records consistently.

Proposed API:

`normalizeArray(input: unknown, normalizer: Normalizer<T>, options?: NormalizeArrayOptions): NormalizeArrayResult<T>`

Example:

`normalizeArray([{ age: "21" }, { age: "invalid" }], normalizeUser, { onError: "collect" })`

Requirements:

- Preserve original indices in errors.
- Support fail-fast or error-collection policies.
- Predictable output order.
- Strong type inference.
- Reject inputs that are not arrays.
- Support large datasets without unnecessary allocations.
- Avoid partial-success ambiguity.

### B3. Shared normalization contracts

Create well-defined types for:

- Field-level normalizers.
- Success/failure result.
- Error path and error code.
- Unknown/missing properties.
- Defaults and null handling.

Use discriminated unions where appropriate so developers can safely narrow the result.

If existing utilities already cover a proposed behavior, reuse them rather than creating superficial aliases.

---

## 7. FEATURE GROUP C — LOCALE-AWARE PARSING

Develop the reverse operations of the existing locale-aware formatting functions.

Support reliable parsing without assuming all countries use `.` as a decimal separator or `,` as a thousands separator.

### C1. `parseLocalizedNumber`

Proposed API:

`parseLocalizedNumber(value: string, options: LocalizedNumberOptions): string`

Example:

`parseLocalizedNumber("1.234,56", { locale: "de-DE" }) // "1234.56"`

Requirements:

- Support locale-specific decimal/grouping characters.
- Handle Unicode whitespace and locale-specific digits where supported.
- Reject incorrect separators in strict mode.
- Avoid silently accepting malformed input.
- Preserve arbitrarily large decimal values as strings.
- Support negative numbers and configurable accepted notation.
- Use `Intl.NumberFormat.formatToParts` when useful.

### C2. `parseLocalizedCurrency`

Proposed API:

`parseLocalizedCurrency(value: string, options: { locale: string; currency: string }): string`

Example:

`parseLocalizedCurrency("1.234,56 €", { locale: "de-DE", currency: "EUR" }) // "1234.56"`

Requirements:

- Validate currency symbols/codes against the specified currency.
- Do not guess between ambiguous currency symbols.
- Support locale-specific currency placement and spacing.
- Reject unsupported or malformed representations.
- Avoid rounding or changing values during parsing.

### C3. `parseLocalizedPercent`

Proposed API:

`parseLocalizedPercent(value: string, options: LocalizedPercentOptions): string`

Example:

`parseLocalizedPercent("12,5 %", { locale: "de-DE" }) // "0.125"`

Define that the returned value represents a fractional ratio, not the displayed percentage value.

### C4. Locale and TypeScript developer experience

Support valid BCP 47 locale identifiers according to actual runtime capabilities.

Provide excellent autocomplete and documentation for common examples, such as:

- `en-US`
- `en-GB`
- `vi-VN`
- `de-DE`
- `fr-FR`
- `ja-JP`

Do not artificially restrict all valid locales to a small TypeScript union if the runtime supports more.

If enumerating valid values is impractical, use clear JSDoc, typed options and comprehensive documentation.

Test Arabic-style digits/separators, non-breaking spaces, malformed grouping, extremely large values and round-trip formatting/parsing behavior.

---

## 8. FEATURE GROUP D — RELIABLE ASYNCHRONOUS WORKFLOWS

Extend existing `retry`, `withRetry`, `withTimeout`, `wait`, `sleep`, `debounce` and `throttle` capabilities.

Do not add redundant wrappers unless they solve a distinct practical problem.

### D1. `mapConcurrent`

Purpose: Map over a collection while limiting active asynchronous tasks.

Proposed API:

`mapConcurrent<T, R>(items: readonly T[], mapper: (item: T, index: number) => Promise<R> | R, options: { concurrency: number; signal?: AbortSignal }): Promise<R[]>`

Example:

`await mapConcurrent(userIds, fetchUser, { concurrency: 3, signal })`

Requirements:

- Maximum active tasks must never exceed `concurrency`.
- Preserve the original result order.
- Support synchronous and asynchronous mappers.
- Define fail-fast behavior explicitly.
- Handle rejected promises without unhandled rejections.
- Support AbortSignal without falsely claiming in-flight work has been cancelled.
- Validate invalid concurrency values.
- Prevent runaway resource consumption.

### D2. `mapSettledConcurrent`

Purpose: Process independent tasks even when some fail.

Proposed API:

`mapSettledConcurrent<T, R>(items: readonly T[], mapper: AsyncMapper<T, R>, options: ConcurrencyOptions): Promise<PromiseSettledResult<R>[]>`

Example:

`await mapSettledConcurrent(ids, fetchUser, { concurrency: 5 })`

Requirements:

- Preserve input order.
- Return explicit success/rejection results.
- Correctly handle cancellation and empty collections.
- Preserve rejection reasons without leaking unrelated sensitive data.
- Avoid unnecessary work once cancellation is requested.

### D3. `batchAsync`

Purpose: Process large collections in bounded asynchronous batches.

Proposed API:

`batchAsync<T, R>(items: readonly T[], processor: (batch: readonly T[]) => Promise<R>, options: { batchSize: number; concurrency?: number; signal?: AbortSignal }): Promise<R[]>`

Example:

`await batchAsync(records, saveBatch, { batchSize: 100, concurrency: 2 })`

Requirements:

- Stable batching boundaries.
- Clear ordering guarantees.
- Explicit partial-failure behavior.
- No unbounded queue growth.
- Correct empty-input handling.
- Avoid unnecessary copies of large input collections.

Evaluate whether this function should reuse `mapConcurrent` internally.

### D4. Concurrency limiter — design decision

Evaluate whether a standalone `createConcurrencyLimiter` adds meaningful functionality beyond `mapConcurrent` and `batchAsync`.

Only implement it as a new public API if the plan demonstrates a distinct use case, clean semantics and acceptable bundle impact.

---

## 9. FEATURE GROUP E — CALENDAR & BUSINESS-DATE HELPERS

Extend the existing calendar utilities without duplicating `addDays`, `differenceInCalendarDays`, `startOfWeek`, `endOfMonth`, etc.

Business dates must represent calendar dates correctly, not fixed 24-hour intervals.

### E1. `isBusinessDay`

Proposed API:

`isBusinessDay(date: CalendarDateInput, options?: BusinessCalendarOptions): boolean`

Example:

`isBusinessDay("2026-12-25", { weekend: [0, 6], holidays: ["2026-12-25"] }) // false`

Requirements:

- Configurable weekend days.
- Configurable holiday dates.
- Clear date-only parsing rules.
- Avoid timezone-dependent accidental date shifts.

### E2. `addBusinessDays`

Proposed API:

`addBusinessDays(date: CalendarDateInput, amount: number, options?: BusinessCalendarOptions): CalendarDateResult`

Example:

`addBusinessDays("2026-12-24", 1, { holidays: ["2026-12-25"] }) // "2026-12-28"`

Requirements:

- Positive and negative offsets.
- Leap years, month ends and year transitions.
- Configurable holidays and weekends.
- Explicit handling of zero offsets and non-business starting dates.
- No hidden assumption that every country's weekend is Saturday/Sunday.

### E3. `differenceInBusinessDays`

Proposed API:

`differenceInBusinessDays(start: CalendarDateInput, end: CalendarDateInput, options?: BusinessCalendarOptions): number`

Example:

`differenceInBusinessDays("2026-12-24", "2026-12-29", { holidays: ["2026-12-25"] }) // 2`

Define precisely which endpoints are inclusive/exclusive and how reversed dates behave.

### E4. `nextBusinessDay`

Proposed API:

`nextBusinessDay(date: CalendarDateInput, options?: BusinessCalendarOptions): CalendarDateResult`

Example:

`nextBusinessDay("2026-12-25", { holidays: ["2026-12-25"] }) // "2026-12-28"`

Require consistent date input/output contracts across all business-calendar helpers.

### E5. Calendar correctness

Test:

- DST boundaries.
- Leap years, including century-year rules.
- Different timezone environments.
- Dates near month/year boundaries.
- Custom weekend definitions.
- Consecutive holidays.
- Large business-day offsets.
- Empty and invalid holiday calendars.
- Years 0–99 if supported by existing project contracts.

Do not claim comprehensive official holiday calculation. Let callers supply holiday data.

---

## 10. FEATURE GROUP F — URL & DATA-SECURITY HELPERS

Implement secure, platform-neutral utilities for common frontend/backend data-handling workflows.

Prioritize predictable validation, safe defaults and compatibility with standard WHATWG URL behavior.

### F1. `isSafeRedirectUrl`

Purpose: Validate application redirect targets.

Proposed API:

`isSafeRedirectUrl(value: string, options: SafeRedirectOptions): boolean`

Example:

`isSafeRedirectUrl("/dashboard", { allowedOrigins: ["https://example.com"] }) // true`

Requirements:

- Reject `javascript:`, `data:` and dangerous schemes.
- Reject protocol-relative external redirects where not permitted.
- Handle encoded paths, control characters, backslashes and ambiguous URL formats.
- Validate origins using parsed URL components, not substring matching.
- Treat userinfo, ports and subdomains carefully.
- Avoid assuming string prefix comparison provides security.

### F2. `getSafeRedirectTarget`

Purpose: Return a validated redirect target or a safe fallback.

Proposed API:

`getSafeRedirectTarget(value: unknown, options: SafeRedirectOptions & { fallback: string }): string`

Example:

`getSafeRedirectTarget("https://evil.example", { fallback: "/", allowedOrigins: ["https://example.com"] }) // "/"`

Validate the fallback itself and document accepted relative/absolute URL behavior.

### F3. `redactSensitiveFields`

Purpose: Produce a safely redacted copy of structured data for logs or diagnostics.

Proposed API:

`redactSensitiveFields<T>(value: T, options: RedactionOptions): Redacted<T>`

Example:

`redactSensitiveFields({ username: "minh", password: "secret" }, { keys: ["password"] })`

Expected visible data:

`{ username: "minh", password: "[REDACTED]" }`

Requirements:

- Nested objects and arrays.
- Exact and case-insensitive field-name policies.
- Circular references.
- Prototype safety.
- Non-mutating behavior.
- Clear handling of Dates, Maps, Sets and unsupported structures.
- Avoid leaking original secrets through errors.
- Type declarations must not misleadingly promise preservation of secret value types.

### F4. `sanitizeUrlForLogging`

Purpose: Redact credentials and sensitive query parameters from URLs.

Proposed API:

`sanitizeUrlForLogging(url: string, options?: UrlLoggingOptions): string`

Example:

`sanitizeUrlForLogging("https://example.com/?token=secret&page=1", { sensitiveQueryKeys: ["token"] })`

Expected result:

`"https://example.com/?token=%5BREDACTED%5D&page=1"` or an equivalent correctly encoded redacted URL.

Requirements:

- Preserve safe URL structure.
- Redact username/password fields.
- Match query parameter names safely.
- Handle repeated query keys.
- Fail safely for malformed URLs.
- Clearly document decoding/re-encoding behavior.

### F5. Security review

Include adversarial tests for open redirects, URL encoding tricks, malformed Unicode, prototype pollution, circular references and sensitive-data leakage.

Do not claim SSRF protection or complete URL sanitization unless the implementation actually covers the full relevant threat model.

---

## 11. PUBLIC API, TYPESCRIPT & INTELLISENSE

Developer experience is a major acceptance criterion.

For every new function:

1. Export accurate public TypeScript types.
2. Prefer strict options interfaces and discriminated unions where appropriate.
3. Use generic inference so users rarely need explicit type arguments.
4. Add carefully designed overloads only when runtime behavior supports them.
5. Provide complete JSDoc descriptions, `@param`, `@returns`, `@throws` and `@example`.
6. Define accepted values, defaults, constraints and units.
7. Give autocomplete suggestions for finite option sets using literal unions.
8. Use meaningful defaults that are safe and predictable.
9. Avoid `any`, unsafe casts, misleading generics and excessively complicated conditional types.
10. Verify TypeScript declarations for ESM and CJS consumers.

Example desired developer experience:

When typing:

`allocateMoney("10.00", [1, 1, 1], { ... })`

VS Code should suggest available fields such as `currency` and `roundingMode`.

When assigning `roundingMode`, IntelliSense should suggest the finite modes actually supported by the implementation.

For open-ended standards like BCP 47 locales, maintain valid extensibility and show examples without falsely claiming every locale is part of a small fixed union.

Add type-level compile tests and realistic sample consumer projects.

Test Ctrl+Space autocomplete-related type inference through TypeScript fixtures or language-service tests where feasible.

---

## 12. AUDIT AND IMPROVE EXISTING FUNCTIONS

Audit existing public exports with emphasis on:

- Exact numeric correctness.
- Safe conversion contracts.
- Locale formatting.
- Date/timezone behavior.
- Unicode strings.
- Array/object immutability.
- Sorting and searching.
- Async cancellation/retry/timeout.
- Type guards and validators.
- SSR and browser compatibility.
- Security and prototype pollution.

Classify findings into:

1. Critical bugs.
2. Incorrect documented behavior.
3. Performance bottlenecks.
4. TypeScript declaration weaknesses.
5. Duplicated implementation.
6. Documentation deficiencies.
7. Potential breaking changes.

Fix genuine bugs and safe optimizations when they are supported by tests.

Do not change signatures, return kinds, numeric rounding, error codes, exports or mutation policies without identifying a deliberate migration strategy.

New APIs should share existing internal primitives whenever reasonable.

---

## 13. BUNDLE SIZE AND PERFORMANCE REQUIREMENTS

Treat bundle performance as a release-quality requirement.

### Establish a baseline

Measure the existing version using the project's actual benchmark tooling.

Record at least:

- Raw distributed JS size.
- Minified size.
- Minified + gzip size.
- Brotli size if consistently measurable.
- Root import consumer bundle.
- Representative named-import consumer bundles.
- Module-specific import costs.
- Total runtime dependency count.

### Measure v0.5.0

Repeat measurements using the same bundler, compression settings, environment and methodology.

Create a before/after report with absolute and percentage changes.

If the full-root bundle becomes larger, that is acceptable when justified by new functionality.

**Do not inflate or misrepresent performance claims.**

Prioritize:

- Minimal named-import costs.
- Real tree-shaking.
- No import-time side effects.
- No accidental cross-module dependencies.
- No giant shared module loaded for small utilities.
- No runtime dependency growth.
- Efficient allocations for large input collections.
- Appropriate algorithmic complexity.

Test representative inputs ranging from small values to very large numeric strings, arrays and concurrent task sets.

For each meaningful performance regression, explain the tradeoff or improve the implementation.

Do not hardcode previous bundle figures as the new release's results.

---

## 14. TESTING & QUALITY ASSURANCE

Testing must cover the implementation's actual contracts, not just happy paths.

### Required test categories

- Unit tests for every new function.
- Existing regression tests.
- Type-level tests.
- Boundary-value tests.
- Invalid/malformed input tests.
- Randomized and property-based tests where valuable.
- Differential/oracle tests where reference implementations exist.
- Stress tests for large inputs.
- Async race/cancellation tests.
- Timezone/DST tests.
- Security/adversarial tests.
- ESM/CJS import and package tarball tests.
- Browser/SSR compatibility checks.
- Documentation and playground tests.

### Financial invariants

Examples:

- Sum of allocated amounts always equals original amount.
- No unintentional precision loss.
- Correct currency decimal exponent.
- Deterministic rounding.
- Correct behavior for zero, negative and very large amounts.
- Rounding boundaries such as `1.005`, `2.675` and negative half values.

### Normalization invariants

- Input remains unchanged.
- Missing fields handled according to contract.
- Error paths identify the correct field/index.
- `__proto__`, `constructor` and `prototype` do not introduce prototype pollution.
- Nested invalid values cannot silently become valid results.

### Locale invariants

- Valid localized strings produce exact canonical values.
- Malformed grouping is rejected in strict mode.
- Very large decimals remain precise.
- Round-trip properties hold for the documented formatting policy.

### Async invariants

- Never exceed configured concurrency.
- Results remain correctly ordered.
- No unhandled promise rejections.
- No incorrectly reported cancellations.
- All cleanup paths terminate.
- Empty/large collections behave predictably.

### Date invariants

- Business-day arithmetic follows calendar semantics.
- Correct behavior at DST and year boundaries.
- Custom holidays/weekends remain deterministic.

### Security invariants

- Unsafe redirect schemes and origins are rejected.
- Sensitive fields are redacted.
- Invalid URLs fail safely.
- No mutation or prototype pollution.
- No accidental secret disclosure.

Use existing dev-only dependencies as test oracles when appropriate, but never bundle them into runtime output.

Run the project's real verification commands. Inspect failures and fix root causes rather than bypassing them.

Report pass/fail/skipped status honestly.

---

## 15. COMPLETE REBRANDING & PACKAGE METADATA

Migrate from:

`@fatdevcon/utilities`

to:

`@fatdevcon/precisekit`

Target release:

`0.5.0`

Inspect and update all relevant project-owned files, including:

- `package.json`
- `package-lock.json`
- `README.md`
- `CHANGELOG.md`
- `SECURITY.md`
- `CONTRIBUTING.md`, if present
- `LICENSE`, where the project identity appears
- `THIRD_PARTY_NOTICES.md`
- `CLAUDE.md`
- `AGENTS.md`
- `.claude/rules/`
- GitHub Actions workflows
- Release and provenance configurations
- Build and publish scripts
- Package verification scripts
- Test fixtures and expected metadata
- Documentation and playground
- SEO and social metadata
- Import examples
- Source references
- GitHub/npm URLs
- Generated version and bundle statistics

Do not rewrite historical changelog entries to pretend previous releases were published under the new name.

Keep explicit legacy package references where they serve migration documentation, historical accuracy or compatibility verification.

Update package metadata:

- `name`
- `version`
- `description`
- `keywords`
- `repository`
- `bugs`
- `homepage`
- `publishConfig`
- Any release workflow bindings that rely on repository identity.

Preserve functioning exports, entry points, `sideEffects`, supported runtimes and zero runtime dependencies.

Audit for stale links, package names and version numbers.

### Migration documentation

Create a dedicated migration guide:

`docs/migration-from-utilities.md`

(or an equivalent route consistent with the docs architecture).

Explain:

- Old package and latest old version.
- New package and new version.
- How to uninstall the old package.
- How to install the new package.
- How to update import paths.
- Which old functions remain compatible.
- Any documented breaking changes, if unavoidable.
- Deprecation of the old package.
- New documentation URL.

Prepare a deprecation announcement but DO NOT execute npm deprecation.

---

## 16. DOCUMENTATION UI/UX REDESIGN

The current docs provide a long categorized function list.

Improve discoverability without introducing unnecessary complexity.

Act as an experienced developer-documentation designer.

### Information architecture

Evaluate whether to:

A. Keep a single-page documentation site with stronger navigation, or

B. Split into a landing page, categorized reference pages, feature details and playground.

Make the decision based on:

- Number of public functions.
- Content density.
- Navigation and search requirements.
- Deep-linking needs.
- Maintainability.
- Bundle/performance impact.
- Mobile and desktop usability.

Document the decision and rationale in the implementation plan.

Do not migrate to a large framework unless its benefits are clearly demonstrated.

### Desired documentation experience

Provide:

- Clear product identity and visual hierarchy.
- Concise explanation of PreciseKit's value.
- Prominent install commands.
- Quick-start examples.
- Visual overview of feature categories.
- Clearly grouped API navigation.
- Searchable functions by name, keyword and category.
- Function-level details and permalinks.
- Signature and parameter descriptions.
- Accepted values/defaults.
- Realistic usage examples.
- Return values and failure behavior.
- Copyable snippets.
- Playground where technically appropriate.
- Related-function recommendations.
- Migration notice.
- Release/version information.
- Responsive layout and accessible navigation.
- Consistent code styling and readable typography.

Avoid overwhelming users with a single giant list.

Highlight genuinely useful attributes such as exact arithmetic, zero runtime dependencies, type safety and tree-shaking.

### Design and accessibility

Ensure:

- Strong contrast and keyboard navigation.
- Accessible focus indicators and semantic structure.
- Mobile-responsive side navigation.
- Fast search and sensible search-result highlighting.
- No unnecessary animations.
- Reduced-motion compatibility.
- Professional visual hierarchy.
- Minimal layout shift.
- Good performance on lower-powered devices.

Support light/dark modes if appropriate for the existing architecture.

### Documentation correctness

Documentation must derive current claims from authoritative sources where possible.

Avoid duplicated hardcoded values for:

- Package name.
- Current version.
- Installation command.
- Number of public exports.
- Bundle measurements.
- Public API definitions.
- GitHub/npm links.

Prefer an automated documentation-data generation process from TypeScript exports, build metadata and measured artifacts where practical.

Every public function must have discoverable documentation.

### Version comparison

Provide an honest v0.4.2 versus v0.5.0 comparison:

- Old/new package names.
- Feature categories.
- Public function counts.
- Bundle sizes using comparable methodologies.
- New capabilities.
- Migration instructions.

The new package may have a larger full-root bundle. Explain why additional features increase size while demonstrating real named-import tree-shaking benefits.

Never fabricate benchmark numbers or claim improvements without measurements.

### SEO

Provide appropriate:

- Page titles.
- Meta descriptions.
- Canonical URLs.
- Open Graph/Twitter metadata.
- Sitemap where applicable.
- Meaningful headings.
- Semantic links.
- Correct internal URLs and asset paths.

Ensure pages work under the new GitHub Pages base path `/precisekit/`.

Test direct navigation, refresh behavior and nested routes.

---

## 17. README AND PROJECT DOCUMENTATION QUALITY

Rewrite the README for a professional public TypeScript package.

Keep it concise, developer-oriented and easy to scan.

Recommended order:

1. PreciseKit name and one-line value proposition.
2. Core differentiators.
3. Installation.
4. Quick-start TypeScript examples.
5. Major feature categories.
6. Small practical examples.
7. TypeScript, runtime and module compatibility.
8. Documentation and playground links.
9. Migration from `@fatdevcon/utilities`.
10. Contribution, security and license references.

Avoid turning the README into an enormous API reference.

Do not include unsupported marketing claims.

For `SECURITY.md`:

- Keep a clear responsible disclosure process.
- State which versions receive security fixes.
- Avoid publishing private contact information not already intended to be public.
- Avoid inventing response-time guarantees.

For the changelog:

- Record migration and newly added features.
- Include security/correctness improvements.
- Identify any intentional breaking changes.
- Preserve historical release information.

For other documentation files:

- Update project identity where appropriate.
- Retain accurate license and third-party notices.
- Preserve useful existing contribution guidance.

---

## 18. RELEASE READINESS AND VERIFICATION

Before completing this task, verify:

- The package has the correct new name/version.
- All six feature groups are implemented.
- New functions are exported and typed correctly.
- Existing functions remain operational.
- Runtime dependencies remain zero.
- ESM and CJS are usable.
- Type declarations match runtime exports.
- Build passes.
- Lint passes.
- Full test suite passes.
- Package verification passes.
- Docs sync/validation passes.
- Playground works.
- Docs URL and base path are correct.
- Bundle measurements are reproducible.
- No hardcoded stale package identity remains outside intentional legacy references.
- npm tarball includes only intended files.
- GitHub Actions and release configuration are migration-ready.

Use existing commands when available, such as:

- `npm run check`
- `npm run test:coverage`
- `npm run docs:sync`
- `npm run test:package`
- `npm run test:docs`
- `npm run test:site`
- `npm run test:bundle`
- `npm run test:tarball`
- `npm pack --dry-run`

Inspect the actual scripts before running them.

Perform an additional consumer smoke test in a temporary project against the built package/tarball.

Do not modify, delete or override unrelated user changes.

**Do not execute `git push`, `git tag`, `npm publish`, `npm deprecate`, GitHub repository rename or production deployment without explicit authorization.**

## 19. REQUIRED FINAL DELIVERABLES

Produce:

1. Detailed implementation plan.
2. Implemented production source code.
3. Public TypeScript types and JSDoc.
4. Complete tests and verification.
5. Updated package configuration.
6. Updated README, changelog and project documents.
7. Improved documentation and playground.
8. Migration documentation.
9. Bundle comparison report.
10. Release-readiness checklist.

Create a concise verification report if the repository has an appropriate reports convention.

Final response MUST be in Vietnamese and include:

### A. Architecture & implementation
- Feature groups completed.
- New public functions.
- Shared utilities reused.
- Design decisions and tradeoffs.

### B. Correctness & testing
- Actual commands executed.
- Passed/failed/skipped tests.
- Critical edge cases.
- Remaining risks.

### C. Package & bundle
- Previous and new identity.
- Previous and new version.
- Public export count.
- Runtime dependencies.
- Raw, gzip and named-import bundle measurements.
- Comparison methodology.

### D. Documentation & migration
- Files updated.
- Documentation layout decision.
- Changes to user-facing documentation.
- Old-to-new package migration instructions.
- Remaining manual GitHub/npm actions.

### E. Release decision
State clearly whether the project is:

- Ready for manual review and publication, or
- Blocked by specific unresolved problems.

Do not report success for work that was not verified.

## 20. EXECUTION INSTRUCTION

Start by auditing the repository and writing the plan.

Then implement the planned improvements across all six feature groups.

Work autonomously on normal repository code, tests, documentation and configuration within the requested scope.

Prioritize accuracy, security, minimal bundles and developer experience.

Use active tools and MCP integrations intelligently, and investigate genuine uncertainties rather than inventing technical facts.

**Deliver a complete, carefully verified PreciseKit v0.5.0 release candidate — not merely a feature proposal or a list of TODOs.**