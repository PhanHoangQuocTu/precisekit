import DecimalOracle from "decimal.js";
import { allocateMoney, applyDiscount, calculateTax, fromMinorUnits, toMinorUnits } from "../modules/money";
import type { RoundingMode } from "../modules/math/arithmetic";

const usd = { currency: "USD" };
describe("exact money", () => {
  test("scales, rounding, precision and huge amounts", () => {
    expect(toMinorUnits("12.34000", usd)).toBe(1234n);
    expect(() => toMinorUnits("1.001", usd)).toThrow();
    expect(toMinorUnits("-1.005", { ...usd, roundingMode: "half-even" })).toBe(-100n);
    expect(toMinorUnits("-1.005", { ...usd, roundingMode: "floor" })).toBe(-101n);
    expect(fromMinorUnits("1", { currency: "KWD" })).toBe("0.001");
    expect(fromMinorUnits(123n, { currency: "JPY" })).toBe("123");
    for (const [currency, input, units] of [["USD", "12.34", 1234n], ["EUR", "12.34", 1234n], ["VND", "1234", 1234n], ["JPY", "1234", 1234n], ["KWD", "1.234", 1234n]] as const) {
      expect(toMinorUnits(input, { currency })).toBe(units);
      expect(fromMinorUnits(units, { currency })).toBe(input);
    }
    const amount = "9".repeat(200) + ".99";
    expect(fromMinorUnits(toMinorUnits(amount, usd), usd)).toBe(amount);
    for (const currency of ["ZZZ", "", "US", "constructor"]) expect(() => toMinorUnits("1", { currency })).toThrow();
    for (const value of [NaN, Infinity, "1e-300001", " ", "0x12"]) expect(() => toMinorUnits(value, usd)).toThrow();
    expect(() => fromMinorUnits("1.2", usd)).toThrow();
    expect(() => toMinorUnits("1", { ...usd, roundingMode: "constructor" as "up" })).toThrow();
  });
  test("largest remainder preserves signed totals with exact ratios", () => {
    expect(allocateMoney("10", [1, 1, 1], usd)).toEqual(["3.34", "3.33", "3.33"]);
    expect(allocateMoney("-10", [1, 1, 1], usd)).toEqual(["-3.34", "-3.33", "-3.33"]);
    expect(allocateMoney("0.01", ["1e100", "1e100", "0"], usd)).toEqual(["0.01", "0.00", "0.00"]);
    for (let i = -25; i <= 25; i++) {
      const amount = fromMinorUnits(BigInt(i), usd);
      const shares = allocateMoney(amount, ["0.1", "0.25", 9n, "0"], usd);
      expect(shares.reduce((sum, share) => sum + toMinorUnits(share, usd), 0n)).toBe(BigInt(i));
    }
    for (const ratios of [[], [0, 0], [1, -1], [NaN], Array(2)]) expect(() => allocateMoney("1", ratios, usd)).toThrow();
  });
  test("taxes and discounts maintain additive identities", () => {
    expect(calculateTax("100", "0.08", { ...usd, mode: "exclusive" })).toEqual({ subtotal: "100.00", tax: "8.00", total: "108.00" });
    expect(calculateTax("-108", "0.08", { ...usd, mode: "inclusive" })).toEqual({ subtotal: "-100.00", tax: "-8.00", total: "-108.00" });
    expect(calculateTax("0.05", "0.1", { ...usd, mode: "exclusive" }).tax).toBe("0.00");
    expect(applyDiscount("100", { type: "percentage", value: "15" }, usd)).toEqual({ original: "100.00", discount: "15.00", final: "85.00" });
    for (const [amount, value] of [["-1", "1"], ["1", "2"], ["1", "-1"]]) expect(() => applyDiscount(amount, { type: "fixed", value }, usd)).toThrow();
    expect(() => applyDiscount("1", { type: "percentage", value: "100.1" }, usd)).toThrow();
    expect(() => calculateTax("1", "-0.1", { ...usd, mode: "inclusive" })).toThrow();
  });
  test("rounding and inclusive tax match independent decimal oracle", () => {
    const Oracle = DecimalOracle.clone({ precision: 100, rounding: DecimalOracle.ROUND_HALF_EVEN });
    for (let i = -100; i <= 100; i++) {
      const value = new Oracle(i).div(1000).toFixed(3);
      const rounded = new Oracle(value).toFixed(2);
      expect(fromMinorUnits(toMinorUnits(value, { ...usd, roundingMode: "half-even" }), usd)).toBe(rounded === "-0.00" ? "0.00" : rounded);
      const amount = new Oracle(i).div(100).toFixed(2);
      const expected = new Oracle(amount).div("1.075").toFixed(2);
      const actual = calculateTax(amount, "0.075", { ...usd, mode: "inclusive" });
      expect(actual.subtotal).toBe(expected === "-0.00" ? "0.00" : expected);
      expect(new Oracle(actual.subtotal).add(actual.tax).toFixed(2)).toBe(amount === "-0.00" ? "0.00" : amount);
    }
  });
  test("all seven modes match oracle for signs and midpoint neighbors", () => {
    const modes: readonly RoundingMode[] = ["up", "down", "ceil", "floor", "half-up", "half-down", "half-even"];
    for (const [index, roundingMode] of modes.entries()) {
      const Oracle = DecimalOracle.clone({ precision: 100, rounding: index as DecimalOracle.Rounding });
      for (const value of ["1.0049", "1.005", "1.0051", "1.015", "-1.0049", "-1.005", "-1.0051", "-1.015"]) {
        expect(fromMinorUnits(toMinorUnits(value, { ...usd, roundingMode }), usd)).toBe(new Oracle(value).toFixed(2));
      }
    }
    expect(() => applyDiscount("1", { type: "fixed", value: "1.001" }, { ...usd, roundingMode: "half-even" })).toThrow();
    expect(() => applyDiscount("-0.001", { type: "fixed", value: "0" }, { ...usd, roundingMode: "half-even" })).toThrow();
  });
  test("large immutable allocation and giant tax retain exact units", () => {
    const ratios = Object.freeze(Array.from({ length: 2000 }, (_, i) => String(i % 11)));
    const shares = allocateMoney("12345678901234567890123456789.99", ratios, usd);
    expect(shares.reduce((sum, value) => sum + toMinorUnits(value, usd), 0n)).toBe(1234567890123456789012345678999n);
    expect(ratios[0]).toBe("0");
    expect(calculateTax("12345678901234567890123456789.00", "0.1", { ...usd, mode: "exclusive" }).tax).toBe("1234567890123456789012345678.90");
  });
});
