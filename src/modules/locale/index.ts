import { countryCurrencies } from "../formatter/country-currencies";
import { decimalToString, MAX_EXPONENT, outOfRange, toDecimal } from "../../utils/numeric";

/** Standard decimal notation only. Locale digits, grouping and affixes must match ICU data exactly. */
export interface LocalizedNumberOptions { locale: string }
export interface LocalizedCurrencyOptions extends LocalizedNumberOptions {
  currency: string;
  currencyDisplay?: "symbol" | "code" | "narrowSymbol";
  currencySign?: "standard" | "accounting";
}
export type LocalizedPercentOptions = LocalizedNumberOptions;

function parse(value: string, options: LocalizedNumberOptions, style: "decimal" | "currency" | "percent", currencyOptions?: LocalizedCurrencyOptions): string {
  if (typeof value !== "string") throw new TypeError("value must be a string");
  if (!options || typeof options.locale !== "string" || !options.locale) throw new TypeError("locale must be a nonempty string");
  if (value.length > MAX_EXPONENT * 2 + 100) throw outOfRange("Localized input is too long");
  let currency: string | undefined;
  if (style === "currency") {
    if (typeof currencyOptions?.currency !== "string") throw new TypeError("currency must be a string");
    currency = currencyOptions.currency.toUpperCase();
    if (!Object.values(countryCurrencies).some(codes => codes.includes(currency!))) throw outOfRange("Unsupported currency");
    if (currencyOptions.currencyDisplay !== undefined && !["symbol", "code", "narrowSymbol"].includes(currencyOptions.currencyDisplay)) throw outOfRange("Invalid currencyDisplay");
    if (currencyOptions.currencySign !== undefined && !["standard", "accounting"].includes(currencyOptions.currencySign)) throw outOfRange("Invalid currencySign");
  }
  const formatter = new Intl.NumberFormat(options.locale, {
    style, currency, currencyDisplay: currencyOptions?.currencyDisplay,
    currencySign: currencyOptions?.currencySign, maximumFractionDigits: 20,
  });
  const decimalSeparator = formatter.formatToParts(1.1234567).find(p => p.type === "decimal")?.value;
  // ICU can choose different grouping rules for decimal, currency and percent
  // styles in the same locale. Probe the actual style, using exact bigint input.
  const groupParts = formatter.formatToParts(123456789012345n);
  const groupSeparator = groupParts.find(p => p.type === "group")?.value;
  const digits = new Map<string, string>();
  const digitFormatter = new Intl.NumberFormat(options.locale, { useGrouping: false });
  for (let i = 0; i < 10; i++) digits.set(digitFormatter.format(i), String(i));
  const lengths = groupParts.filter(p => p.type === "integer").map(p => [...p.value].length);
  const primary = lengths[lengths.length - 1];
  const secondary = lengths[lengths.length - 2] ?? primary;
  const numericTypes = new Set(["integer", "group", "decimal", "fraction"]);
  let body: string | undefined;
  let negative = false;
  for (const sample of [12345.6, -12345.6]) {
    const parts = formatter.formatToParts(sample);
    const start = parts.findIndex(p => numericTypes.has(p.type));
    let end = parts.length - 1;
    while (!numericTypes.has(parts[end].type)) end--;
    const prefix = parts.slice(0, start).map(p => p.value).join("");
    const suffix = parts.slice(end + 1).map(p => p.value).join("");
    if (value.startsWith(prefix) && value.endsWith(suffix)) {
      const candidate = value.slice(prefix.length, suffix ? -suffix.length : undefined);
      // A positive decimal's empty affixes must not consume a negative pattern.
      if ([...candidate].some(c => digits.has(c))) {
        const forbidden = [...candidate].some(c => !digits.has(c) && c !== decimalSeparator && c !== groupSeparator);
        if (!forbidden) { body = candidate; negative = sample < 0; break; }
      }
    }
  }
  if (body === undefined) throw outOfRange("Localized affix or digits do not match locale");
  const fractions = decimalSeparator ? body.split(decimalSeparator) : [body];
  if (fractions.length > 2 || !fractions[0] || fractions.length === 2 && !fractions[1]) throw outOfRange("Malformed localized decimal");
  const groups = groupSeparator ? fractions[0].split(groupSeparator) : [fractions[0]];
  const decode = (text: string): string => {
    let result = "";
    for (const char of text) {
      const digit = digits.get(char);
      if (digit === undefined) throw outOfRange("Invalid localized digit");
      result += digit;
    }
    return result;
  };
  const integerGroups = groups.map(decode);
  if (integerGroups.some(g => !g)) throw outOfRange("Empty digit group");
  if (groups.length > 1) {
    if (integerGroups[integerGroups.length - 1].length !== primary || integerGroups[0].length > secondary || integerGroups.slice(1, -1).some(g => g.length !== secondary)) throw outOfRange("Malformed grouping");
    // Some locales do not group four-digit numbers; validate the first grouped magnitude too.
    const totalDigits = integerGroups.reduce((n, g) => n + g.length, 0);
    const sampleExponent = totalDigits - (style === "percent" ? 3 : 1);
    if (totalDigits <= 15 && sampleExponent >= 0 && !formatter.formatToParts(10n ** BigInt(sampleExponent)).some(p => p.type === "group")) throw outOfRange("Grouping not used at this magnitude");
  }
  const fraction = fractions.length === 2 ? decode(fractions[1]) : "";
  const canonical = (negative ? "-" : "") + integerGroups.join("") + (fraction ? "." + fraction : "");
  const parsed = toDecimal(canonical, "value");
  if (style !== "percent" || parsed.isZero()) return decimalToString(parsed);
  return decimalToString(toDecimal(`${decimalToString(parsed)}e-2`, "percent"));
}

/** Parse strict locale decimal text to canonical exact decimal text; rejects exponent, malformed grouping and mixed digits.
 * Locale behavior depends on runtime ICU data. Caller input is never mutated.
 * @param value Text using the locale's digits, separators and sign.
 * @param options Locale configuration; no locale is guessed from input.
 * @returns Canonical decimal text without grouping or insignificant zeroes.
 * @throws TypeError for invalid input types; RangeError for malformed locale text or unsupported numeric magnitude.
 * @example parseLocalizedNumber("1.234,56", { locale: "de-DE" }) // "1234.56"
 */
export function parseLocalizedNumber(value: string, options: LocalizedNumberOptions): string { return parse(value, options, "decimal"); }

/** Parse currency text with an explicit code and matching locale affix. Symbol/code/accounting modes are explicit; no currency guessing.
 * @param value Currency text with exact locale affixes and spacing.
 * @param options Locale, active currency code and optional display/accounting modes.
 * @returns Canonical exact amount, without the currency affix.
 * @throws TypeError for invalid input types; RangeError for unknown currencies, mismatched affixes or malformed numeric text.
 * @example parseLocalizedCurrency("1.234,56 €", { locale: "de-DE", currency: "EUR" }) // "1234.56"
 */
export function parseLocalizedCurrency(value: string, options: LocalizedCurrencyOptions): string { return parse(value, options, "currency", options); }

/** Parse a locale percent with its required affix into an exact fractional ratio.
 * @param value Percent text including the locale's required percent affix.
 * @param options Locale configuration.
 * @returns Canonical decimal ratio; twelve percent becomes "0.12".
 * @throws TypeError for invalid input types; RangeError for malformed affixes, grouping, digits or unsupported numeric magnitude.
 * @example parseLocalizedPercent("12,5 %", { locale: "de-DE" }) // "0.125"
 */
export function parseLocalizedPercent(value: string, options: LocalizedPercentOptions): string { return parse(value, options, "percent"); }
