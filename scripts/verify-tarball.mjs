import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const manifest = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const packageParts = manifest.name.split("/");
function run(binary, args, cwd = root) {
  const result = spawnSync(binary, args, { cwd, encoding: "utf8", env: process.env });
  if (result.error) throw new Error([binary, ...args].join(" ") + "\n" + result.error.message);
  if (result.status !== 0) throw new Error([binary, ...args].join(" ") + "\n" + result.stdout + result.stderr + (result.error ?? ""));
  if (/npm warn|npm error/i.test(result.stderr)) throw new Error(result.stderr);
  return result.stdout;
}
const release = join(root, ".release");
mkdirSync(release, { recursive: true });
const pack = JSON.parse(run(npm, ["pack", "--ignore-scripts", "--json", "--pack-destination", release]))[0];
const names = pack.files.map(file => file.path);
assert.equal(pack.name, manifest.name, "packed name must match the working manifest");
assert.equal(pack.version, manifest.version, "packed version must match the working manifest");
const allowed = ["package.json", "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md", "CHANGELOG.md", "SECURITY.md"];
for (const name of ["dist/index.js", "dist/index.mjs", "dist/index.d.ts", "dist/index.d.mts", "README.md", "LICENSE", "THIRD_PARTY_NOTICES.md"]) assert.ok(names.includes(name), name);
assert.ok(names.every(name => name.startsWith("dist/") || allowed.includes(name)), "Unexpected packaged file");
assert.ok(!names.some(name => name.endsWith(".map")), "Source maps must not ship");
const artifact = resolve(release, pack.filename);
const consumer = mkdtempSync(join(tmpdir(), "precisekit-consumer-"));
writeFileSync(join(consumer, "package.json"), JSON.stringify({ name: "release-consumer", version: "1.0.0", private: true }));
run(npm, ["install", "--no-fund", "--fetch-retries=0", artifact], consumer);
const installed = readdirSync(join(consumer, "node_modules")).filter((entry) => !entry.startsWith("."));
assert.deepEqual(installed, ["@fatdevcon"], "Installing the package must add no other package");
const installedPackage = join(consumer, "node_modules", ...packageParts);
assert.deepEqual(readdirSync(join(consumer, "node_modules", packageParts[0])), [packageParts[1]], "The package scope must contain only PreciseKit");
const installedManifest = join(installedPackage, "package.json");
const shipped = JSON.parse(readFileSync(installedManifest, "utf8"));
assert.equal(shipped.name, manifest.name, "packed name must match the working manifest");
assert.equal(shipped.version, manifest.version, "packed version must match the working manifest");
assert.equal(shipped.dependencies, undefined);
assert.equal(shipped.peerDependencies, undefined);
assert.equal(shipped.optionalDependencies, undefined);
for (const field of ["exports", "main", "module", "types", "sideEffects", "engines"]) {
  assert.deepEqual(shipped[field], manifest[field], `packed ${field} must match the working manifest`);
}
for (const file of ["index.js", "index.mjs"]) {
  const code = readFileSync(join(installedPackage, "dist", file), "utf8");
  assert.ok(code.split("\n").length > 500, `${file} must stay readable, not minified`);
  assert.ok(!/\b(eval|child_process|XMLHttpRequest)\b|process\.env|new Function\(|require\(["'](?!node:)/.test(code), `${file} must not touch eval, the shell, the network or the environment`);
  assert.doesNotMatch(code, /\b(?:fetch|WebSocket|EventSource)\s*\(/, `${file} must not initiate network calls`);
}
const probe = readFileSync(join(root, "scripts/verify-package.mjs"), "utf8");
writeFileSync(join(consumer, "probe.mjs"), probe);
console.log(run(process.execPath, ["probe.mjs", installedManifest], consumer).trim());
console.log(run("bun", ["run", "probe.mjs", installedManifest], consumer).trim());
const packageSpecifier = JSON.stringify(manifest.name);
const fixture = `import { formatCurrency, shortenString, getCountryCurrencies, summary, factorial, divide, NumericRangeError, getAbortError, isAbortError, wait, withRetry, getTimeZoneOffset, formatInTimeZone, type Comparator, type BytesFormatOptions, type NumericInput, type AbortErrorType, type WithRetryParameters, type DateInput, type TimeZoneNameStyle, type TimeZoneOffsetOptions, formatDate, parseISO, addDays, addMonths, addYears, startOfDay, endOfDay, differenceInCalendarDays, isWithinInterval, isNode, enumerate, sumBy, safeJsonParse, buildQueryString, type DateInterval, type WeekOptions, type SafeJsonResult, type QueryValue, parseDuration, parseBytes, setByPath, escapeRegExp, type FormatDateOptions, type ParseBytesOptions, type DateFnsLikeLocale } from ${packageSpecifier};
import { strip, lstrip, rstrip, title, firstChar, lastChar, safeToNumber, safeToInteger, safeToBigInt, safeToBoolean, safeToString, capitalize } from ${packageSpecifier};
type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false;
type Expect<T extends true> = T;
type ConversionTypes = [
  Expect<Equal<ReturnType<typeof safeToNumber>, number | null>>,
  Expect<Equal<ReturnType<typeof safeToInteger>, number | null>>,
  Expect<Equal<ReturnType<typeof safeToBigInt>, bigint | null>>,
  Expect<Equal<ReturnType<typeof safeToBoolean>, boolean | null>>,
  Expect<Equal<ReturnType<typeof safeToString>, string | null>>,
  Expect<Equal<Parameters<typeof safeToNumber>, [value: unknown]>>
];
const external: unknown = JSON.parse("null");
const conversions = [safeToNumber(external), safeToInteger(external), safeToBigInt(external), safeToBoolean(external), safeToString(external)];
const cleaned: string[] = [strip(" x "), lstrip(".x", "."), rstrip("x.", "."), title("x"), firstChar("x"), lastChar("x"), capitalize("istanbul", "tr")];
const fallback: number = safeToNumber(external) ?? 0;
// @ts-expect-error safe results must be narrowed before use
const unsafeNumber: number = safeToNumber(external);
// @ts-expect-error cleaning is strict about string input
strip(external);
// @ts-expect-error custom strip characters must be a string
rstrip("text", 1);
// @ts-expect-error no implicit fallback option overload
safeToNumber(external, { fallback: 0 });
void [conversions, cleaned, fallback, unsafeNumber];
const typeProof: ConversionTypes = [true, true, true, true, true, true];
void typeProof;
const value: string = formatCurrency(1, "USD");
const countries: string[] = getCountryCurrencies("VN");
const compare: Comparator<number> = (a, b) => a - b;
const options: BytesFormatOptions = { base: 1024 };
shortenString(value, { endLength: 2 });
formatCurrency("1", "USD"); // numeric strings are valid input
// @ts-expect-error objects are not numeric input
formatCurrency({}, "USD");
// @ts-expect-error base is constrained
const badOptions: BytesFormatOptions = { base: 2 };
const asNumber: number = summary(1, 2);
const asBigint: bigint = summary(1n, 2n);
const asString: string = summary("1", 2);
const factorialBig: bigint = factorial(25n);
const quotient: string = divide(10n, 3n, { precision: 5 });
const input: NumericInput = "1e30";
const abortError: AbortErrorType = getAbortError();
const retryOptions: WithRetryParameters = { retryCount: 1, delay: ({ count }) => count * 10 };
const pendingWait: Promise<void> = wait(10);
const retried: Promise<string> = withRetry(async () => "ok", retryOptions);
const dateInput: DateInput = "2026-01-15T12:00:00Z";
const timeZoneNameStyle: TimeZoneNameStyle = "shortOffset";
const timeZoneOffsetOptions: TimeZoneOffsetOptions = { unit: "hours", direction: "utc" };
const offset: number = getTimeZoneOffset(dateInput, "Asia/Ho_Chi_Minh", timeZoneOffsetOptions);
const zonedDate: string = formatInTimeZone(dateInput, "Asia/Ho_Chi_Minh");
const dateOptions: FormatDateOptions = { timeZone: "UTC", locale: "fr", weekStartsOn: 1 };
const dateText: string = formatDate(dateInput, "yyyy-MM-dd", dateOptions);
const parsedDate: Date = parseISO("2026-01-15");
const later: Date = addMonths(addDays(startOfDay(parsedDate), 1), 1);
const days: number = differenceInCalendarDays(endOfDay(later), parsedDate);
const milliseconds: number = parseDuration("1h");
const bytes: number = parseBytes("1 KiB");
const exactBytes: bigint = parseBytes("1 QB", { bigint: true });
const parseOptions: ParseBytesOptions = { base: 1024 };
const nested: { a: number } = setByPath({ a: 1 }, "a", 2);
const escaped: string = escapeRegExp("a.b");
const customLocale: DateFnsLikeLocale = { code: "vi" };
const interval: DateInterval = { start: dateInput, end: later };
const week: WeekOptions = { weekStartsOn: 1 };
const parsedJson: SafeJsonResult<unknown> = safeJsonParse("null");
const query: QueryValue = ["a", "b"];
const queryString: string = buildQueryString({ tag: query });
const nextYear: Date = addYears(parsedDate, 1);
const included: boolean = isWithinInterval(parsedDate, interval);
const nodeRuntime: boolean = isNode();
const enumerated: [number, string][] = enumerate(["a"]);
const total: NumericInput = sumBy([{ amount: "0.1" }, { amount: "0.2" }], item => item.amount);
// @ts-expect-error format must be a string
formatDate(dateInput, 5);
// @ts-expect-error amount must be a number
addDays(dateInput, "1");
// @ts-expect-error a bigint option returns a bigint, not a number
const wrongBytes: number = parseBytes("1 QB", { bigint: true });
void [dateText, days, milliseconds, bytes, exactBytes, parseOptions, nested, escaped, customLocale, interval, week, parsedJson, queryString, nextYear, included, nodeRuntime, enumerated, total, wrongBytes];
if (isAbortError(abortError)) { void abortError.message; }
// @ts-expect-error a number pair returns a number, not a string
const wrongKind: string = summary(1, 2);
try { divide(1, 0); } catch (error) { if (error instanceof NumericRangeError) { const code: string = error.code; void code; } }
void [countries, compare, options, badOptions, asNumber, asBigint, asString, factorialBig, quotient, input, abortError, retryOptions, pendingWait, retried, dateInput, timeZoneNameStyle, timeZoneOffsetOptions, offset, zonedDate, wrongKind];
`;
const v050Fixture = `
import { toMinorUnits, fromMinorUnits, allocateMoney, calculateTax, applyDiscount, parseLocalizedNumber,
  parseLocalizedCurrency, parseLocalizedPercent, normalizeRecord, normalizeArray, mapConcurrent, mapSettledConcurrent,
  batchAsync, isBusinessDay, addBusinessDays, differenceInBusinessDays, nextBusinessDay, isSafeRedirectUrl,
  getSafeRedirectTarget, redactSensitiveFields, sanitizeUrlForLogging,
  type MoneyOptions, type TaxResult, type InferNormalized, type NormalizeResult, type Redacted } from ${packageSpecifier};
const moneyOptions: MoneyOptions = { currency: "USD", roundingMode: "half-even" };
const minor: bigint = toMinorUnits("1.23", moneyOptions);
const major: string = fromMinorUnits(minor, moneyOptions);
const parts: string[] = allocateMoney(major, [1n, "2"] as const, moneyOptions);
const tax: TaxResult = calculateTax(major, "0.08", { ...moneyOptions, mode: "inclusive" });
const discounted: string = applyDiscount(major, { type: "percentage", value: 15 }, moneyOptions).final;
const localized: string[] = [parseLocalizedNumber("1", {locale:"en-US"}), parseLocalizedCurrency("$1",{locale:"en-US",currency:"USD"}), parseLocalizedPercent("1%",{locale:"en-US"})];
const schema = { name: strip, age: safeToInteger, active: safeToBoolean };
type User = InferNormalized<typeof schema>;
type UserProof = Expect<Equal<User, {name:string;age:number;active:boolean}>>;
const userProof: UserProof = true;
const user: NormalizeResult<User> = normalizeRecord({}, schema);
if (user.success) { const age: number = user.data.age; void age; }
else { const path: (string | number)[] = user.errors[0].path; void path; }
const users = normalizeArray([], value => normalizeRecord(value, schema));
if (!users.success) { const entries: {index:number;data:User}[] = users.entries; void entries; }
const mapped: Promise<string[]> = mapConcurrent([1,2] as const, async n => String(n), {concurrency:2});
const settled: Promise<PromiseSettledResult<number>[]> = mapSettledConcurrent([1,2], n => n, {concurrency:2});
const batches: Promise<number[]> = batchAsync([1,2], batch => batch.length, {batchSize:1});
const business: boolean = isBusinessDay("2026-01-01");
const daysOut: string[] = [addBusinessDays("2026-01-01", 1), nextBusinessDay("2026-01-01")];
const countOut: number = differenceInBusinessDays("2026-01-01","2026-01-02");
const safe: boolean = isSafeRedirectUrl("/");
const target: string = getSafeRedirectTarget(null, {fallback:"/"});
const redacted: Redacted<{password:number}> = redactSensitiveFields({password:123}, {keys:["password"]});
const sanitized: string = sanitizeUrlForLogging("invalid");
// @ts-expect-error redacted field may be a replacement string
const originalSecret: number = redacted.password;
// @ts-expect-error result must be narrowed before data access
user.data.age;
// @ts-expect-error invalid rounding literal
toMinorUnits("1", {currency:"USD",roundingMode:"nearest"});
// @ts-expect-error currency is required
toMinorUnits("1", {});
// @ts-expect-error calendar APIs deliberately accept date-only strings
addBusinessDays(new Date(), 1);
// @ts-expect-error readonly array cannot be mutated by a batch processor
batchAsync([1], batch => batch.push(2), {batchSize:1});
void [parts,tax,discounted,localized,userProof,mapped,settled,batches,business,daysOut,countOut,safe,target,sanitized,originalSecret];
`;
for (const ext of ["mts", "cts"]) writeFileSync(join(consumer, "consumer." + ext), fixture + v050Fixture);
console.log(run(process.execPath, [join(root, "node_modules/typescript-native/bin/tsc"),
  "--noEmit", "--strict", "--module", "NodeNext", "--moduleResolution", "NodeNext",
  "--target", "ES2020", "--skipLibCheck", "false", "consumer.mts", "consumer.cts"], consumer));
writeFileSync(join(release, "verification.json"), JSON.stringify({
  artifact, consumer, integrity: pack.integrity, shasum: pack.shasum,
  files: names, node: process.version, bun: run("bun", ["--version"]).trim(),
}, null, 2) + "\n");
console.log("Verified tarball installation, Node/Bun ESM+CJS, and TypeScript ESM+CJS consumers.");
console.log(artifact);
console.log("Integrity: " + pack.integrity);
