import { countryCurrencies } from "../formatter/country-currencies";
import type { RoundingMode } from "../math/arithmetic";
import { checkBigInt, guardBigInt, outOfRange, toDecimal } from "../../utils/numeric";
import type { NumericInput } from "../../utils/numeric";

/** Currency scales depend on the runtime ICU/CLDR data; supported codes use the bundled active-tender snapshot. */
export interface MoneyOptions { currency: string; roundingMode?: RoundingMode }
export interface TaxOptions extends MoneyOptions { mode: "inclusive" | "exclusive" }
export interface TaxResult { subtotal: string; tax: string; total: string }
export type DiscountOptions = { type: "fixed" | "percentage"; value: NumericInput };
export interface DiscountResult { original: string; discount: string; final: string }

const modes: readonly RoundingMode[] = ["up", "down", "ceil", "floor", "half-up", "half-down", "half-even"];
function scale(options: MoneyOptions): number {
  if (!options || typeof options.currency !== "string") throw new TypeError("currency must be a string");
  const code = options.currency.toUpperCase();
  if (!Object.values(countryCurrencies).some(codes => codes.includes(code))) throw outOfRange("Unsupported currency");
  if (options.roundingMode !== undefined && !modes.includes(options.roundingMode)) throw outOfRange("Invalid roundingMode");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
}
function ratio(value: NumericInput, name: string): [bigint, bigint] {
  const d = toDecimal(value, name);
  return guardBigInt(() => {
    const signed = d.neg ? -d.c : d.c;
    return d.x >= 0 ? [signed * 10n ** BigInt(d.x), 1n] : [signed, 10n ** BigInt(-d.x)];
  });
}
function rounded(n: bigint, d: bigint, mode?: RoundingMode): bigint {
  const neg = n < 0n;
  const a = neg ? -n : n;
  let q = a / d;
  const r = a % d;
  if (r !== 0n) {
    if (mode === undefined) throw outOfRange("Amount exceeds currency precision; provide roundingMode");
    const up = mode === "up" || mode === "ceil" && !neg || mode === "floor" && neg ||
      (mode.startsWith("half-") && (r * 2n > d || r * 2n === d && (mode === "half-up" || mode === "half-even" && q % 2n !== 0n)));
    if (up) q++;
  }
  return checkBigInt(neg ? -q : q, "Money result");
}
function render(value: bigint, digits: number): string {
  checkBigInt(value, "Money result");
  const text = (value < 0n ? -value : value).toString().padStart(digits + 1, "0");
  return (value < 0n ? "-" : "") + (digits ? text.slice(0, -digits) + "." + text.slice(-digits) : text);
}
/** Convert an exact amount to bigint minor units. Excess precision requires explicit rounding; inputs are never mutated.
 * @param amount Exact decimal amount; number inputs retain only the precision already present in JavaScript.
 * @param options Active currency code and optional rounding mode.
 * @returns Signed bigint minor units for the runtime currency scale.
 * @throws TypeError for invalid numeric inputs; RangeError for unsupported currency, excess precision or unsupported magnitude.
 * @example toMinorUnits("12.34", { currency: "USD" }) // 1234n
 */
export function toMinorUnits(amount: NumericInput, options: MoneyOptions): bigint {
  const digits = scale(options);
  const [n, d] = ratio(amount, "amount");
  return guardBigInt(() => rounded(n * 10n ** BigInt(digits), d, options.roundingMode));
}
/** Convert bigint or integer-string minor units to fixed-scale decimal text. Rejects nonintegers and unknown currencies.
 * @param amount Signed bigint or integer-string minor units.
 * @param options Active currency code and optional rounding mode validation.
 * @returns Decimal string with exactly the currency's fraction digits.
 * @throws TypeError for noninteger input; RangeError for unsupported currency or magnitude.
 * @example fromMinorUnits(1234n, { currency: "USD" }) // "12.34"
 */
export function fromMinorUnits(amount: bigint | string, options: MoneyOptions): string {
  const digits = scale(options);
  if (typeof amount !== "bigint" && (typeof amount !== "string" || !/^[+-]?\d+$/.test(amount))) throw new TypeError("minor units must be bigint or integer string");
  const value = toDecimal(amount, "amount").toBigInt();
  return render(value, digits);
}
/** Split positive or negative money by exact nonnegative ratios. Largest remainders win; ties use input order.
 * @param amount Exact amount to distribute; excess precision requires explicit rounding.
 * @param ratios Nonempty nonnegative exact weights whose total is positive; caller data is not mutated.
 * @param options Currency and optional input rounding mode.
 * @returns Fixed-scale amounts in ratio order whose minor units sum to the input amount's minor units.
 * @throws TypeError for invalid numeric inputs; RangeError for invalid ratios, precision, currency or magnitude.
 * @example allocateMoney("10", [1, 1, 1], { currency: "USD" }) // ["3.34", "3.33", "3.33"]
 */
export function allocateMoney(amount: NumericInput, ratios: readonly NumericInput[], options: MoneyOptions): string[] {
  const digits = scale(options);
  const units = toMinorUnits(amount, options);
  if (!Array.isArray(ratios) || ratios.length === 0) throw outOfRange("ratios must be nonempty");
  const parsed = Array.from(ratios, v => toDecimal(v, "ratio"));
  if (parsed.some(v => v.neg && !v.isZero())) throw outOfRange("ratios must be nonnegative");
  const exp = parsed.reduce((min, v) => Math.min(min, v.x), 0);
  return guardBigInt(() => {
    const weights = parsed.map(v => v.c * 10n ** BigInt(v.x - exp));
    const total = weights.reduce((a, b) => a + b, 0n);
    if (!total) throw outOfRange("ratio total must be positive");
    const magnitude = units < 0n ? -units : units;
    const shares = weights.map(w => magnitude * w / total);
    let left = magnitude - shares.reduce((a, b) => a + b, 0n);
    const order = weights.map((w, i) => ({ i, remainder: magnitude * w % total })).sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.i - b.i);
    for (const { i } of order) { if (left === 0n) break; shares[i]++; left--; }
    return shares.map(v => render(units < 0n ? -v : v, digits));
  });
}
/** Calculate inclusive/exclusive tax; rate "0.08" means 8%. Generated values round half-even by default; refunds retain sign.
 * @param amount Exact subtotal for exclusive mode or total for inclusive mode.
 * @param rate Nonnegative fractional tax ratio, with no jurisdiction-specific interpretation.
 * @param options Currency, required tax mode and optional rounding mode.
 * @returns Fixed-scale subtotal, tax and total with an exact additive identity.
 * @throws TypeError for invalid numeric inputs; RangeError for invalid rate, mode, precision, currency or magnitude.
 * @example calculateTax("100", "0.08", { currency: "USD", mode: "exclusive" })
 */
export function calculateTax(amount: NumericInput, rate: NumericInput, options: TaxOptions): TaxResult {
  const digits = scale(options);
  const units = toMinorUnits(amount, options);
  const [n, d] = ratio(rate, "rate");
  if (n < 0n || !["inclusive", "exclusive"].includes(options.mode)) throw outOfRange("Invalid tax options");
  return guardBigInt(() => {
    const subtotal = options.mode === "inclusive" ? rounded(units * d, d + n, options.roundingMode ?? "half-even") : units;
    const tax = options.mode === "inclusive" ? units - subtotal : rounded(units * n, d, options.roundingMode ?? "half-even");
    return { subtotal: render(subtotal, digits), tax: render(tax, digits), total: render(subtotal + tax, digits) };
  });
}
/** Apply a nonnegative fixed or percentage ("15" means 15%) discount. Rejects negative originals and excess discounts.
 * @param amount Nonnegative exact original amount.
 * @param discount Fixed amount or percentage from zero through one hundred; never clamped.
 * @param options Currency and optional rounding mode; generated percentage discounts default to half-even.
 * @returns Fixed-scale original, discount and final amounts whose minor units reconcile exactly.
 * @throws TypeError for invalid numeric inputs; RangeError for invalid/excess discounts, precision, currency or magnitude.
 * @example applyDiscount("100", { type: "percentage", value: "15" }, { currency: "USD" })
 */
export function applyDiscount(amount: NumericInput, discount: DiscountOptions, options: MoneyOptions): DiscountResult {
  const digits = scale(options);
  const units = toMinorUnits(amount, options);
  const original = toDecimal(amount, "amount");
  if (original.neg && !original.isZero() || !discount || !["fixed", "percentage"].includes(discount.type)) throw outOfRange("Invalid discount");
  const [n, d] = ratio(discount.value, "discount");
  if (n < 0n || discount.type === "percentage" && n > 100n * d) throw outOfRange("Invalid discount value");
  return guardBigInt(() => {
    if (discount.type === "fixed" && toDecimal(discount.value, "discount").gt(original)) throw outOfRange("Discount exceeds original amount");
    const reduction = discount.type === "fixed" ? toMinorUnits(discount.value, options) : rounded(units * n, d * 100n, options.roundingMode ?? "half-even");
    if (reduction > units) throw outOfRange("Discount exceeds original amount");
    return { original: render(units, digits), discount: render(reduction, digits), final: render(units - reduction, digits) };
  });
}
