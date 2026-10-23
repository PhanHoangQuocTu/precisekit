import { getSafeRedirectTarget, isSafeRedirectUrl, redactSensitiveFields, sanitizeUrlForLogging } from "../modules/security";

describe("redirect safety", () => {
  const options = { allowedOrigins: ["https://example.com"] };
  test.each(["/%GG", "/%", "/%C0%AF", "/%E0%A4", "/\uD800", "/\uDC00"])("rejects malformed encoding %s", value => expect(isSafeRedirectUrl(value, options)).toBe(false));
  test.each(["/", "/dashboard?a=1", "/caf%C3%A9", "https://example.com/path", "https://example.com:443/path"])("accepts %s", value => expect(isSafeRedirectUrl(value, options)).toBe(true));
  test.each(["//evil.com", "/\\evil.com", "javascript:alert(1)", "data:text/plain,x", " https://example.com", "https://example.com\n", "https://example.com.evil.com", "https://example.com:444", "https://u:p@example.com", "/%2fevil.com", "/%5Cevil.com", "/%252fevil.com", "/%0d%0aLocation:evil", "https:example.com", "https://evil.com/?https://example.com"])("rejects %s", value => expect(isSafeRedirectUrl(value, options)).toBe(false));
  test("fallback validated even when input safe; relative policy", () => {
    expect(getSafeRedirectTarget("https://evil.com", { ...options, fallback: "/" })).toBe("/");
    expect(() => getSafeRedirectTarget("/safe", { fallback: "//evil.com" })).toThrow("Invalid redirect fallback");
    expect(isSafeRedirectUrl("/", { allowRelative: false })).toBe(false);
  });
});
describe("structured redaction", () => {
  test("configuration proxy exceptions cannot leak secrets", () => {
    const options = new Proxy({ keys: [] as string[], fallback: "/" }, { get() { throw Error("secret"); } });
    expect(() => redactSensitiveFields({}, options)).toThrow("Unsupported value for redaction");
    expect(() => getSafeRedirectTarget("/", options)).toThrow("Invalid redirect fallback");
    expect(isSafeRedirectUrl("/", options)).toBe(false);
    expect(sanitizeUrlForLogging("https://example.com", options)).toBe("[INVALID_URL]");
    // @ts-expect-error runtime callers can supply invalid replacement types
    expect(() => redactSensitiveFields({}, { keys: [], replacement: {} })).toThrow("Unsupported value for redaction");
  });
  test("nested arrays, cycles, dates and repeated identity are cloned", () => {
    const date = new Date("2025-01-01");
    const input: { Password: number; rows: { token: string }[]; self?: unknown; date: Date; repeated: Date } = { Password: 123, rows: [{ token: "secret" }], date, repeated: date };
    input.self = input;
    const output = redactSensitiveFields(input, { keys: ["password", "token"] });
    expect(output.Password).toBe("[REDACTED]");
    expect(output.rows).toEqual([{ token: "[REDACTED]" }]);
    expect(output.self).toBe(output);
    expect(output.date).not.toBe(date);
    expect(output.date).toBe(output.repeated);
    expect(input.Password).toBe(123);
    // @ts-expect-error a redacted numeric field can be a string
    const numeric: number = output.Password;
    void numeric;
  });
  test("case-sensitive options and custom replacement", () => {
    expect(redactSensitiveFields({ TOKEN: 1, token: 2 }, { keys: ["token"], caseSensitive: true, replacement: "x" })).toEqual({ TOKEN: 1, token: "x" });
  });
  test("prototype-sensitive properties remain own without pollution", () => {
    const input = JSON.parse('{"__proto__":{"polluted":true},"constructor":"secret"}');
    const result = redactSensitiveFields(input, { keys: ["constructor"] });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.prototype).not.toHaveProperty("polluted");
    expect(Object.getOwnPropertyDescriptor(result, "__proto__")?.value).toEqual({ polluted: true });
  });
  test("rejects unsupported data and getters without input leakage", () => {
    const getter = jest.fn(() => "secret");
    class Private { secret = "secret"; }
    const proxy = new Proxy({}, { ownKeys() { throw Error("secret"); } });
    for (const input of [new Map(), new Set(), new Private(), proxy, Object.defineProperty({}, "token", { get: getter }), () => "secret"]) {
      expect(() => redactSensitiveFields(input, { keys: ["token"] })).toThrow("Unsupported value for redaction");
    }
    expect(getter).not.toHaveBeenCalled();
  });
});
describe("URL logging", () => {
  test("removes userinfo and fragments, preserves repeated query entries", () => {
    const result = new URL(sanitizeUrlForLogging("https://user:secret@example.com/path?token=a&TOKEN=b&page=1#secret"));
    expect(result.username).toBe(""); expect(result.password).toBe(""); expect(result.hash).toBe("");
    expect([...result.searchParams]).toEqual([["token", "[REDACTED]"], ["TOKEN", "[REDACTED]"], ["page", "1"]]);
  });
  test("custom policy and malformed input", () => {
    expect(sanitizeUrlForLogging("secret")).toBe("[INVALID_URL]");
    expect(sanitizeUrlForLogging("javascript:secret")).toBe("[INVALID_URL]");
    const result = new URL(sanitizeUrlForLogging("https://example.com/?key=secret#ok", { sensitiveQueryKeys: ["key"], replacement: "x", preserveFragment: true }));
    expect(result.searchParams.get("key")).toBe("x"); expect(result.hash).toBe("#ok");
  });
});
