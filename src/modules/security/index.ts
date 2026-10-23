export interface SafeRedirectOptions { allowedOrigins?: readonly string[]; allowRelative?: boolean }
export interface RedactionOptions { keys: readonly string[]; caseSensitive?: boolean; replacement?: string }
/** Redaction can replace any matched field, including a numeric field, with a string. */
export type Redacted<T> = T extends Date ? Date : T extends readonly (infer U)[] ? (Redacted<U> | string)[] : T extends object ? { [K in keyof T]: Redacted<T[K]> | string } : T;
export interface UrlLoggingOptions { sensitiveQueryKeys?: readonly string[]; caseSensitive?: boolean; replacement?: string; preserveFragment?: boolean }

/**
 * Accept a single-slash root-relative path (default) or HTTP(S) URL whose
 * exact parsed origin is allowlisted. Reject credentials, controls, backslashes,
 * protocol-relative targets, malformed Unicode/percent encoding and encoded
 * redirect delimiters. Encoding validation never rewrites the target. Not SSRF protection.
 * @example isSafeRedirectUrl("/dashboard", { allowedOrigins: ["https://example.com"] })
 * @param value Redirect target to validate.
 * @param options Exact origin allowlist and relative-path policy.
 * @returns Whether the target meets the configured policy.
 * @throws No parsing or option inspection exceptions escape.
 */
export function isSafeRedirectUrl(value: string, options: SafeRedirectOptions = {}): boolean {
  try {
  if (!options || typeof options !== "object" || (options.allowRelative !== undefined && typeof options.allowRelative !== "boolean") || (options.allowedOrigins !== undefined && (!Array.isArray(options.allowedOrigins) || !options.allowedOrigins.every(origin => typeof origin === "string")))) return false;
  if (typeof value !== "string" || !value || /[\s\\\u0000-\u001f\u007f]/u.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c|25)/i.test(value)) return false;
  // Validate raw UTF-16 and one layer of percent-encoded UTF-8 without using
  // the decoded value as a redirect or recursively interpreting its contents.
  encodeURI(value);
  decodeURIComponent(value);
  if (value.startsWith("/")) return options.allowRelative !== false && !value.startsWith("//");
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    const target = new URL(value);
    if (target.username || target.password) return false;
    return (options.allowedOrigins ?? []).some(origin => {
      const allowed = new URL(origin);
      return !allowed.username && !allowed.password && allowed.pathname === "/" && !allowed.search && !allowed.hash && (allowed.protocol === "https:" || allowed.protocol === "http:") && allowed.origin === target.origin;
    });
  } catch { return false; }
  } catch { return false; }
}

/**
 * Return the input when safe, otherwise fallback.
 * @param value Untrusted redirect candidate.
 * @param options Redirect policy and required fallback, validated first.
 * @returns The validated candidate or fallback.
 * @throws TypeError for invalid fallback or malformed options.
 * @example getSafeRedirectTarget("//evil.example", { fallback: "/" })
 */
export function getSafeRedirectTarget(value: unknown, options: SafeRedirectOptions & { fallback: string }): string {
  try {
    const fallback = options.fallback;
    if (!isSafeRedirectUrl(fallback, options)) throw new TypeError();
    return typeof value === "string" && isSafeRedirectUrl(value, options) ? value : fallback;
  } catch { throw new TypeError("Invalid redirect fallback"); }
}

/**
 * Clone own data properties of plain objects/arrays and Dates, redacting keys
 * case-insensitively by default. Preserve cycles without retaining references.
 * Accessors and unsupported objects throw a fixed error without input contents.
 * @example redactSensitiveFields({ password: "secret" }, { keys: ["password"] })
 * @param value Plain structured data; cycles, arrays and Dates are supported.
 * @param options Sensitive keys, case policy and optional replacement string.
 * @returns A detached copy whose matched fields contain the replacement.
 * @throws TypeError with a fixed message for unsupported data or invalid options.
 */
export function redactSensitiveFields<T>(value: T, options: RedactionOptions): Redacted<T> {
  try {
  if (!options || typeof options !== "object" || !Array.isArray(options.keys) || !options.keys.every(key => typeof key === "string") || (options.replacement !== undefined && typeof options.replacement !== "string") || (options.caseSensitive !== undefined && typeof options.caseSensitive !== "boolean")) throw new TypeError();
  const seen = new WeakMap<object, object>();
  const keys = new Set(options.keys.map(key => options.caseSensitive ? key : key.toLowerCase()));
  const replacement = options.replacement ?? "[REDACTED]";
  const clone = (node: unknown): unknown => {
    if (typeof node === "function" || typeof node === "symbol") throw new TypeError();
    if (node === null || typeof node !== "object") return node;
    const cached = seen.get(node);
    if (cached) return cached;
    const prototype = Object.getPrototypeOf(node);
    if (prototype === Date.prototype) {
      if (Reflect.ownKeys(node).length) throw new TypeError();
      const copy = new Date(Date.prototype.getTime.call(node));
      seen.set(node, copy);
      return copy;
    }
    if (Array.isArray(node) ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) throw new TypeError();
    const output: object = Array.isArray(node) ? [] : Object.create(prototype);
    seen.set(node, output);
    for (const key of Reflect.ownKeys(node)) {
      const descriptor = Object.getOwnPropertyDescriptor(node, key);
      if (!descriptor || !("value" in descriptor)) throw new TypeError();
      const matches = typeof key === "string" && keys.has(options.caseSensitive ? key : key.toLowerCase());
      Object.defineProperty(output, key, { ...descriptor, value: matches ? replacement : clone(descriptor.value) });
    }
    return output;
  };
  return clone(value) as Redacted<T>;
  }
  catch { throw new TypeError("Unsupported value for redaction"); }
}

/**
 * Remove credentials and, by default, fragments; replace every sensitive query
 * value (case-insensitive). WHATWG URL canonicalizes encoding. Malformed or
 * non-HTTP(S) URLs return "[INVALID_URL]", never the original input.
 * @param value Absolute HTTP(S) URL.
 * @param options Query redaction and fragment-retention policies.
 * @returns Canonical URL or the fixed invalid marker.
 * @throws No parsing or option inspection exceptions escape.
 * @example sanitizeUrlForLogging("https://example.com/?token=secret")
 */
export function sanitizeUrlForLogging(value: string, options: UrlLoggingOptions = {}): string {
  try {
    if (!options || typeof options !== "object" || (options.sensitiveQueryKeys !== undefined && (!Array.isArray(options.sensitiveQueryKeys) || !options.sensitiveQueryKeys.every(key => typeof key === "string"))) || (options.replacement !== undefined && typeof options.replacement !== "string") || (options.caseSensitive !== undefined && typeof options.caseSensitive !== "boolean") || (options.preserveFragment !== undefined && typeof options.preserveFragment !== "boolean")) return "[INVALID_URL]";
    if (typeof value !== "string") return "[INVALID_URL]";
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "[INVALID_URL]";
    url.username = ""; url.password = "";
    if (!options.preserveFragment) url.hash = "";
    const keys = new Set((options.sensitiveQueryKeys ?? ["token", "password", "secret", "api_key", "access_token", "authorization"]).map(key => options.caseSensitive ? key : key.toLowerCase()));
    const params = new URLSearchParams();
    url.searchParams.forEach((entry, key) => params.append(key, keys.has(options.caseSensitive ? key : key.toLowerCase()) ? options.replacement ?? "[REDACTED]" : entry));
    url.search = params.toString();
    return url.href;
  } catch { return "[INVALID_URL]"; }
}
