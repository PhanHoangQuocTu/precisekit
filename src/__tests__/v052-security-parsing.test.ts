import { format, parseISO as oracleParseISO } from "date-fns";
import { formatDate, parseBytes, parseISO } from "../index";

describe("v0.5.2 linear date and byte-size parsing", () => {
  const date = new Date(2024, 1, 29, 13, 45, 12, 345);

  test.each([
    "yyyy-MM-dd 'It''s' HH:mm:ss.SSS xxx",
    "PPPPpppp", "pppp", "'PPPP pppp' Pp", "'", "''", "'''", "''''",
    "'unterminated literal", "'trailing doubled quote''", "yyyy\nMM\rdd",
    "'literal\nwith newline' yyyy", "yyyy '😀 é'",
  ])("preserves quoted literals and long tokens: %j", pattern => {
    expect(formatDate(date, pattern)).toBe(format(date, pattern));
  });

  test("handles large long-token and escaped-literal patterns", () => {
    expect(formatDate(date, "P".repeat(100_000))).toBe(format(date, "PPPP"));
    expect(formatDate(date, "p".repeat(100_000))).toBe(format(date, "pppp"));
    expect(formatDate(date, "P".repeat(100_000) + "p".repeat(100_000))).toBe(format(date, "PPPPpppp"));
    expect(formatDate(date, "'" + "a''".repeat(50_000))).toBe("a'".repeat(50_000));
    expect(formatDate(date, "'" + "a".repeat(100_000))).toBe("a".repeat(100_000));
  });

  test.each([
    "2024-02-29T13:45:12.345+07:00", "2024-02-29T13:45-0330",
    "2024-02-29T13:45Z\n", "2024-02-29T13:45+\n+07:00",
    "2024-02-29T13:45\n+07:00", "2024-02-29T13:45Z\r\n",
    "2023-02-29", "2024-12-31T24:00Z", "2024-02-29T13:45+0760",
  ])("preserves ISO offset/invalid-date behavior: %j", input => {
    expect(parseISO(input).getTime()).toBe(oracleParseISO(input).getTime());
  });

  test("rejects many timezone candidates followed by an embedded newline", () => {
    const input = "2024-02-29T13:45" + "+".repeat(100_000) + "\n!";
    expect(Number.isNaN(parseISO(input).getTime())).toBe(true);
  });

  test.each([
    [" +1.5e+3 KiB ", 1536000], [".5 B", 1], ["1. B", 1],
    ["1E3B", 1000], ["\u00a0+2.5e-1\tKB\uFEFF", 250], ["1\nKB", 1000],
  ] as const)("preserves byte decimal/exponent/whitespace parsing: %j", (input, expected) => {
    expect(parseBytes(input)).toBe(expected);
  });

  test("preserves exact large byte units and bigint results", () => {
    expect(parseBytes("1EB", { bigint: true })).toBe(1000000000000000000n);
    expect(parseBytes("1 EiB", { bigint: true })).toBe(1152921504606846976n);
    expect(parseBytes("9007199254740993 B", { bigint: true })).toBe(9007199254740993n);
    expect(() => parseBytes("1 EB")).toThrow(expect.objectContaining({ code: "ERR_OVERFLOW" }));
  });

  test.each([
    "-1 B", "1,5 KB", ". B", "1e+ B", "1 B junk", "1 RiB", "1\u200bKB",
    "9".repeat(100_000) + "!", "1" + " ".repeat(100_000) + "!", ".0" + " ".repeat(100_000) + "!",
    "1" + "a".repeat(100_000) + "!", "1e" + "9".repeat(100_000) + "!",
  ].map(input => ({ input, length: input.length })))("rejects malformed byte sizes with the existing error: length $length", ({ input }) => {
    expect(() => parseBytes(input)).toThrow(expect.objectContaining({ code: "ERR_INVALID_FORMAT" }));
  });
});
