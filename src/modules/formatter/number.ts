import { ExactDecimal, outOfRange, overflowError, toDecimal } from "../../utils/numeric";
import { NumericRangeError, NumericTypeError } from "../../utils/errors";
import { assertInteger, describeValue } from "../../utils/validate";
import type { Decimal } from "../../utils/numeric";
import { ROUND_HALF_UP } from "../../utils/decimal";
import type { NumericInput } from "../../utils/numeric";
import { getNumberFormat, toIntlNumber } from "../../utils/intl";


export type CompactNumberOptions = Omit<Intl.NumberFormatOptions, "notation">;
export type CurrencyFormatOptions = Omit<Intl.NumberFormatOptions, "style" | "currency">;
export type PercentFormatOptions = Omit<Intl.NumberFormatOptions, "style">;
export type UnitFormatOptions = Omit<Intl.NumberFormatOptions, "style" | "unit">;

const formatWith = (
  value: unknown,
  locale: Intl.LocalesArgument,
  options: Intl.NumberFormatOptions
): string => getNumberFormat(locale, options).format(toIntlNumber(value, "value") as number);

/** Format abbreviated magnitudes, e.g. 1200 -> "1.2K" in en-US. Accepts number, bigint and numeric strings. */
export function formatCompactNumber(
  value: NumericInput,
  locale: Intl.LocalesArgument = "en-US",
  options: CompactNumberOptions = {}
): string {
  return formatWith(value, locale, { maximumFractionDigits: 1, ...options, notation: "compact" });
}

/** Input is a ratio: 0.125 -> "12.5%". Accepts number, bigint and numeric strings. */
export function formatPercent(
  value: NumericInput,
  locale: Intl.LocalesArgument = "en-US",
  options: PercentFormatOptions = {}
): string {
  return formatWith(value, locale, { maximumFractionDigits: 2, ...options, style: "percent" });
}

/** Format money for an ISO 4217 code. Accepts number, bigint and numeric strings, so amounts keep every digit. */
export function formatCurrency(
  value: NumericInput,
  currency: string,
  locale: Intl.LocalesArgument = "en-US",
  options: CurrencyFormatOptions = {}
): string {
  const code = normalizeCurrency(currency);
  return formatWith(value, locale, { ...options, style: "currency", currency: code });
}

/** Validates code syntax; Intl accepts well-formed unassigned codes too. */
export function normalizeCurrency(currency: string): string {
  if (typeof currency !== "string") throw new TypeError("currency must be a string");
  if (!/^[a-z]{3}$/i.test(currency)) throw new RangeError("currency must be a three-letter ISO 4217 code");
  return currency.toUpperCase();
}

export function formatUnit(
  value: NumericInput,
  unit: string,
  locale: Intl.LocalesArgument = "en-US",
  options: UnitFormatOptions = {}
): string {
  return formatWith(value, locale, { ...options, style: "unit", unit });
}

export interface BytesFormatOptions {
  /** SI (1000) by default; use 1024 for IEC units. */
  base?: 1000 | 1024;
  /** Integer from 0 to 20; trailing zeroes are omitted. */
  decimals?: number;
  locale?: Intl.LocalesArgument;
}

const SI_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB", "RB", "QB"];
const IEC_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];

// 1 / 1000^k = 10^-3k and 1 / 1024^k = 5^10k * 10^-10k: both are exact decimal factors.
const unitThresholds = new Map<number, Decimal[]>();
const unitFactors = new Map<number, Decimal[]>();
const unitTable = (base: 1000 | 1024, count: number): { thresholds: Decimal[]; factors: Decimal[] } => {
  let thresholds = unitThresholds.get(base);
  let factors = unitFactors.get(base);
  if (!thresholds || !factors) {
    thresholds = [];
    factors = [];
    for (let k = 0; k < count; k++) {
      thresholds.push(new ExactDecimal(base).pow(k));
      factors.push(
        base === 1000
          ? new ExactDecimal(`1e-${3 * k}`)
          : new ExactDecimal(5).pow(10 * k).mul(new ExactDecimal(`1e-${10 * k}`))
      );
    }
    unitThresholds.set(base, thresholds);
    unitFactors.set(base, factors);
  }
  return { thresholds, factors };
};

/**
 * Human-readable size from B up to QB (SI) or YiB (IEC). Accepts number, bigint and
 * numeric strings and scales them exactly, so `formatBytes("1500000000000000000000000000000")`
 * is "1.5 QB".
 */
export function formatBytes(value: NumericInput, options: BytesFormatOptions = {}): string {
  const { base = 1000, decimals = 2, locale = "en-US" } = options;
  const bytes = toDecimal(value, "value");
  if (bytes.isNeg() && !bytes.isZero()) throw outOfRange("value must be non-negative");
  if (base !== 1000 && base !== 1024) throw outOfRange("base must be 1000 or 1024");
  assertInteger(decimals, "decimals");
  if (decimals < 0 || decimals > 20) throw outOfRange("decimals must be between 0 and 20");

  const units = base === 1000 ? SI_UNITS : IEC_UNITS;
  const last = units.length - 1;
  const { thresholds, factors } = unitTable(base, units.length);
  let index = 0;
  while (index < last && bytes.gte(thresholds[index + 1])) index++;
  let rounded = bytes.mul(factors[index]).toDecimalPlaces(decimals, ROUND_HALF_UP);
  // Promote values that round up to the next unit, e.g. 999999 -> "1 MB".
  if (index < last && rounded.gte(base)) {
    index++;
    rounded = bytes.mul(factors[index]).toDecimalPlaces(decimals, ROUND_HALF_UP);
  }
  const text = getNumberFormat(locale, { maximumFractionDigits: decimals }).format(
    toIntlNumber(rounded.toFixed(), "value") as number
  );
  return `${text} ${units[index]}`;
}

/** Parse the number and unit without backtracking over overlapping digit/whitespace runs. */
const splitByteSize = (text: string): [string, string] | undefined => {
  const input = text.trim();
  let at = input[0] === "+" ? 1 : 0;
  const isDigit = (index: number): boolean => input[index] >= "0" && input[index] <= "9";
  const start = at;
  while (isDigit(at)) at++;
  let digits = at - start;
  if (input[at] === ".") {
    const fraction = ++at;
    while (isDigit(at)) at++;
    digits += at - fraction;
  }
  if (digits === 0) return undefined;
  if (input[at] === "e" || input[at] === "E") {
    let end = at + 1;
    if (input[end] === "+" || input[end] === "-") end++;
    const exponent = end;
    while (isDigit(end)) end++;
    // An E without exponent digits can instead begin an EB/EiB unit.
    if (end > exponent) at = end;
  }
  const numberEnd = at;
  while (at < input.length && /\s/.test(input[at])) at++;
  const unitStart = at;
  while (at < input.length && /[a-z]/i.test(input[at])) at++;
  if (at !== input.length) return undefined;
  return [input.slice(0, numberEnd), input.slice(unitStart)];
};

export interface ParseBytesOptions {
  /** What a bare "KB"/"MB"/"GB" means: 1000 (SI, default) or 1024. "KiB"/"MiB" are always 1024. */
  base?: 1000 | 1024;
  /** Return a `bigint`, exact for any size up to "QB"/"YiB"; without it the result must be a safe integer. */
  bigint?: boolean;
}

/**
 * Inverse of `formatBytes`: `"1.5 GB"`, `"512 KiB"`, `"2tb"`, `"1e3 B"` or `"1024"` to a whole number of bytes,
 * computed exactly and rounded half-up to the nearest byte. Units are B, kB..QB (SI) and KiB..YiB (IEC),
 * case-insensitive; a bare number is bytes. Throws `ERR_INVALID_FORMAT` for text it cannot read and
 * `ERR_OVERFLOW` beyond `Number.MAX_SAFE_INTEGER` unless `bigint: true`.
 */
export function parseBytes(text: string, options: ParseBytesOptions & { bigint: true }): bigint;
export function parseBytes(text: string, options?: ParseBytesOptions): number;
export function parseBytes(text: string, options: ParseBytesOptions = {}): number | bigint {
  const { base = 1000, bigint = false } = options;
  if (typeof text !== "string") {
    throw new NumericTypeError("ERR_INVALID_FORMAT", `text must be a string, received ${describeValue(text)}`);
  }
  if (base !== 1000 && base !== 1024) throw outOfRange("base must be 1000 or 1024");
  const invalid = (): never => {
    throw new NumericTypeError("ERR_INVALID_FORMAT", `Cannot read ${describeValue(text)} as a size such as "1.5 GB" or "512 KiB"`);
  };
  const match = splitByteSize(text);
  if (!match) return invalid();
  const unit = /^(?:b|([kmgtpezyrq])(i?)b)?$/.exec(match[1].toLowerCase());
  if (!unit || (unit[2] && "rq".includes(unit[1]))) return invalid();
  const power = unit[1] ? "kmgtpezyrq".indexOf(unit[1]) + 1 : 0;
  const bytes = new ExactDecimal(match[0]).mul(new ExactDecimal(unit[2] ? 1024 : base).pow(power)).toDecimalPlaces(0);
  if (!bytes.isFinite()) throw overflowError("Size");
  const exact = bytes.toBigInt();
  if (bigint) return exact;
  if (exact > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new NumericRangeError("ERR_OVERFLOW", "Size exceeds Number.MAX_SAFE_INTEGER; pass { bigint: true } for an exact result");
  }
  return Number(exact);
}
