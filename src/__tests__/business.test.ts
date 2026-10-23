import { addBusinessDays, differenceInBusinessDays, isBusinessDay, nextBusinessDay } from "../modules/date/business";

describe("date-only business calendar", () => {
  const options = { holidays: ["2026-12-25", "2026-12-25", "2026-12-26"] };
  it("implements holiday, interval and direction contracts", () => {
    expect(isBusinessDay("2026-12-25", options)).toBe(false);
    expect(addBusinessDays("2026-12-24", 1, options)).toBe("2026-12-28");
    expect(nextBusinessDay("2026-12-25", options)).toBe("2026-12-28");
    expect(nextBusinessDay("2026-12-24")).toBe("2026-12-25");
    expect(differenceInBusinessDays("2026-12-24", "2026-12-29", options)).toBe(2);
    expect(differenceInBusinessDays("2026-12-29", "2026-12-24", options)).toBe(-2);
    expect(addBusinessDays("2026-12-28", -1, options)).toBe("2026-12-24");
    expect(addBusinessDays("2026-12-26", 0, options)).toBe("2026-12-26");
  });
  it("supports years zero to 99, leap centuries and bounds", () => {
    expect(addBusinessDays("0000-02-28", 1, { weekend: [] })).toBe("0000-02-29");
    expect(addBusinessDays("0099-12-31", 1, { weekend: [] })).toBe("0100-01-01");
    expect(addBusinessDays("2000-02-28", 1, { weekend: [] })).toBe("2000-02-29");
    expect(() => isBusinessDay("1900-02-29")).toThrow();
    expect(() => addBusinessDays("0000-01-01", -1)).toThrow();
    expect(() => addBusinessDays("9999-12-31", 1)).toThrow();
    expect(addBusinessDays("9999-12-31", 0)).toBe("9999-12-31");
  });
  it("uses custom weekdays and consecutive holidays", () => {
    expect(addBusinessDays("2026-12-24", 1, { weekend: [5, 6], holidays: ["2026-12-27", "2026-12-28"] })).toBe("2026-12-29");
    expect(() => isBusinessDay("2026-01-01", { weekend: [0, 1, 2, 3, 4, 5, 6] })).toThrow();
    expect(() => addBusinessDays("2026-01-01", 0.1)).toThrow();
  });
  it("rejects sparse calendar rules instead of counting phantom excluded days", () => {
    const weekend = new Array<0 | 1 | 2 | 3 | 4 | 5 | 6>(1);
    const holidays = new Array<string>(1);
    expect(() => isBusinessDay("2026-01-01", { weekend })).toThrow(RangeError);
    expect(() => differenceInBusinessDays("2026-01-01", "2026-02-01", { weekend })).toThrow(RangeError);
    expect(() => addBusinessDays("2026-01-01", 1, { holidays })).toThrow(RangeError);
    expect(() => isBusinessDay("2026-01-01", { holidays })).toThrow(RangeError);
  });
  it.each(["2026-2-01", "2026-00-01", "2026-13-01", "2026-02-30", "2026-01-00", "2026-01-01T00:00:00Z", "10000-01-01"])("rejects %s", (input) => {
    expect(() => isBusinessDay(input)).toThrow(RangeError);
  });
  it("handles the entire supported interval with week arithmetic", () => {
    const count = differenceInBusinessDays("0000-01-01", "9999-12-31");
    expect(count).toBeGreaterThan(2600000);
    expect(addBusinessDays("0000-01-01", count)).toBe("9999-12-30");
    expect(() => addBusinessDays("0000-01-01", Number.MAX_SAFE_INTEGER)).toThrow();
  });
  it("matches a simple daily oracle on varied small intervals", () => {
    const holidays = ["2024-03-11", "2024-03-12", "2024-03-16"];
    const rules = { holidays, weekend: [0, 6] as const };
    const step = (date: string, direction: number) => new Date(Date.parse(date + "T00:00:00Z") + direction * 86400000).toISOString().slice(0, 10);
    for (let offset = -60; offset <= 60; offset++) {
      let expected = "2024-03-08", remaining = Math.abs(offset);
      while (remaining > 0) { expected = step(expected, Math.sign(offset)); if (isBusinessDay(expected, rules)) remaining--; }
      expect(addBusinessDays("2024-03-08", offset, rules)).toBe(expected);
    }
  });
  it("matches counting and addition oracles for every single working weekday", () => {
    for (let working = 0; working < 7; working++) {
      const weekend = ([0, 1, 2, 3, 4, 5, 6] as const).filter((day) => day !== working);
      const rules = { weekend, holidays: ["2026-01-02", "2026-01-04", "2026-01-08"] };
      let count = 0;
      for (let day = 1; day <= 30; day++) {
        const current = `2026-01-${String(day).padStart(2, "0")}`;
        expect(differenceInBusinessDays("2026-01-01", current, rules)).toBe(count);
        if (isBusinessDay(current, rules)) count++;
      }
      const start = "2026-01-01";
      for (let offset = 1; offset <= 20; offset++) {
        const result = addBusinessDays(start, offset, rules);
        expect(isBusinessDay(result, rules)).toBe(true);
        expect(differenceInBusinessDays(start, result, rules) + 1 - Number(isBusinessDay(start, rules))).toBe(offset);
      }
    }
  });
});
