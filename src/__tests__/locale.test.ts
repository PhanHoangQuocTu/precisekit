import { parseLocalizedCurrency, parseLocalizedNumber, parseLocalizedPercent } from "../modules/locale";

describe("exact localized parsing", () => {
  test("style-specific grouping round trips across ICU locales", () => {
    const locales = ["bn", "ml", "mr", "or", "te", "hi-IN", "en-US", "de-DE", "es-ES", "pl-PL", "ar-EG", "fr-FR", "vi-VN"];
    for (const locale of locales) {
      for (const amount of [-12345678.125, -1234.567, 123.125, 0.125]) {
        const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 3 });
        expect(parseLocalizedPercent(percent.format(amount), { locale })).toBe(String(amount));
        for (const currency of ["USD", "KWD", "JPY"]) {
          const format = new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 3 });
          expect(parseLocalizedCurrency(format.format(amount), { locale, currency })).toBe(String(amount));
        }
      }
    }
  });
  test("locale-specific grouping, digits and exact round trips", () => {
    for (const locale of ["en-US", "vi-VN", "de-DE", "fr-FR", "hi-IN", "ar-EG"]) {
      const fmt = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 });
      for (const amount of [0, 1.25, -12345.6789, 123456789.25]) expect(parseLocalizedNumber(fmt.format(amount), { locale })).toBe(String(amount));
      const huge = new Intl.NumberFormat(locale).format(123456789012345678901234567890n);
      expect(parseLocalizedNumber(huge, { locale })).toBe("123456789012345678901234567890");
      const percent = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 3 });
      expect(parseLocalizedPercent(percent.format(-0.125), { locale })).toBe("-0.125");
    }
    expect(parseLocalizedNumber("12,34,567.89", { locale: "hi-IN" })).toBe("1234567.89");
  });
  test("currency affixes must match explicit options", () => {
    for (const locale of ["en-US", "de-DE", "ar-EG"]) for (const currencyDisplay of ["symbol", "code", "narrowSymbol"] as const) for (const currencySign of ["standard", "accounting"] as const) {
      const options = { locale, currency: "USD", currencyDisplay, currencySign };
      const fmt = new Intl.NumberFormat(locale, { style: "currency", currency: "USD", currencyDisplay, currencySign });
      expect(parseLocalizedCurrency(fmt.format(-1234.5), options)).toBe("-1234.5");
    }
    expect(() => parseLocalizedCurrency("€1.00", { locale: "en-US", currency: "USD" })).toThrow();
    expect(() => parseLocalizedCurrency("$1.00", { locale: "en-US", currency: "ZZZ" })).toThrow();
    expect(() => parseLocalizedPercent("12.5", { locale: "en-US" })).toThrow();
  });
  test("reject malformed grouping, mixed digits, notation, spaces and affixes", () => {
    for (const value of ["1,23.45", "1,,234", "1,234,", "1.234,56", "1e3", "Infinity", "NaN", " 12", "12 ", "", ".5", "1.", "١2", "--1", "+1"]) expect(() => parseLocalizedNumber(value, { locale: "en-US" })).toThrow();
    expect(() => parseLocalizedNumber("1,234,567", { locale: "hi-IN" })).toThrow();
    expect(() => parseLocalizedNumber("1 234,56", { locale: "fr-FR" })).toThrow();
    expect(parseLocalizedNumber("-0.000", { locale: "en-US" })).toBe("0");
    expect(() => parseLocalizedNumber("0." + "0".repeat(300001) + "1", { locale: "en-US" })).toThrow();
  });
  test("exact long fractions, percent decimal shift and locale whitespace", () => {
    const fraction = "12345678901234567890123456789";
    expect(parseLocalizedNumber("1," + fraction, { locale: "de-DE" })).toBe("1." + fraction);
    expect(parseLocalizedPercent("1." + fraction + "%", { locale: "en-US" })).toBe("0.01" + fraction);
    expect(() => parseLocalizedNumber("١٢3", { locale: "ar-EG" })).toThrow();
    expect(() => parseLocalizedNumber("\u200f123", { locale: "en-US" })).toThrow();
    expect(() => parseLocalizedCurrency("$ 1.00", { locale: "en-US", currency: "USD" })).toThrow();
    expect(() => parseLocalizedPercent("12,5 %", { locale: "de-DE" })).toThrow();
    expect(parseLocalizedPercent("12,5\u00a0%", { locale: "de-DE" })).toBe("0.125");
  });
});
