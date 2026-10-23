/** A field transform; narrower input helpers are accepted and may reject incompatible values. */
export type FieldNormalizer = (value: never) => unknown;
export type NormalizationSchema = Record<string, FieldNormalizer | { normalize: FieldNormalizer; default?: unknown }>;
export type InferNormalized<S extends NormalizationSchema> = {
  [K in keyof S]: NonNullable<S[K] extends FieldNormalizer ? ReturnType<S[K]> : S[K] extends { normalize: infer F extends FieldNormalizer } ? ReturnType<F> : never>;
};
export interface NormalizeError { path: (string | number)[]; code: string; message: string }
export type NormalizeResult<T> = { success: true; data: T } | { success: false; errors: NormalizeError[] };
export interface NormalizeOptions { unknownKeys?: "strip" | "reject" }
export interface NormalizeArrayOptions { onError?: "collect" | "fail-fast" }
export type Normalizer<T> = (input: unknown) => NormalizeResult<T>;
export type NormalizeArrayResult<T> = { success: true; data: T[] } | {
  success: false; entries: { index: number; data: T }[]; errors: NormalizeError[];
};
const error = (path: (string | number)[], code: string): NormalizeError => ({ path, code, message: `Normalization failed: ${code}` });
const unsafe = new Set(["__proto__", "constructor", "prototype"]);
const plain = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
/** Read array sizes without invoking a proxy's `get` trap. */
const arrayLength = (value: unknown): number => {
  if (!Array.isArray(value)) throw new TypeError();
  const descriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!descriptor || !("value" in descriptor) || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0) throw new TypeError();
  return descriptor.value;
};

/**
 * Normalize own data fields without reading getters. Missing fields fail unless a
 * schema descriptor has a default (which is passed through the normalizer).
 * Nullish returns and thrown errors fail safely; unknown keys are stripped by
 * default. Input is not modified. Proxy reflection failures become errors.
 * @example normalizeRecord({ age: "21" }, { age: (v: unknown) => Number(v) })
 * @param input Unknown plain record; own data properties only.
 * @param schema Field normalizers or descriptors with an optional input default.
 * @param options Unknown-key policy (default: strip).
 * @returns A complete normalized record or structured errors without raw values.
 * @throws No input/normalizer exceptions escape; they become structured errors.
 */
export function normalizeRecord<S extends NormalizationSchema>(input: unknown, schema: S, options: NormalizeOptions = {}): NormalizeResult<InferNormalized<S>> {
  const errors: NormalizeError[] = [];
  const data: Record<string, unknown> = {};
  try {
    if (!plain(input) || !plain(schema)) return { success: false, errors: [error([], "INVALID_RECORD")] };
    if (options.unknownKeys !== undefined && options.unknownKeys !== "strip" && options.unknownKeys !== "reject") throw new TypeError();
    const fields = Object.getOwnPropertyDescriptors(schema);
    for (const key of Reflect.ownKeys(fields)) {
      if (typeof key !== "string" || unsafe.has(key)) { errors.push(error([], "UNSAFE_SCHEMA_KEY")); continue; }
      const descriptor = fields[key];
      if (!("value" in descriptor)) { errors.push(error([key], "ACCESSOR")); continue; }
      const field: unknown = descriptor.value;
      let fn: unknown = field;
      let fallback: PropertyDescriptor | undefined;
      if (typeof field !== "function") {
        if (!plain(field)) { errors.push(error([key], "INVALID_SCHEMA")); continue; }
        const fd = Object.getOwnPropertyDescriptor(field, "normalize");
        fn = fd && "value" in fd ? fd.value : undefined;
        fallback = Object.getOwnPropertyDescriptor(field, "default");
      }
      if (typeof fn !== "function") { errors.push(error([key], "INVALID_SCHEMA")); continue; }
      const source = Object.getOwnPropertyDescriptor(input, key) ?? fallback;
      if (!source) { errors.push(error([key], "MISSING_FIELD")); continue; }
      if (!("value" in source)) { errors.push(error([key], "ACCESSOR")); continue; }
      try {
        const value: unknown = Reflect.apply(fn, undefined, [source.value]);
        if (value === null || value === undefined) errors.push(error([key], "INVALID_FIELD"));
        else Object.defineProperty(data, key, { value, enumerable: true, writable: true, configurable: true });
      } catch { errors.push(error([key], "INVALID_FIELD")); }
    }
    for (const key of Reflect.ownKeys(input)) {
      const own = Object.getOwnPropertyDescriptor(input, key);
      if (own && !("value" in own)) errors.push(error([String(key)], "ACCESSOR"));
      else if (options.unknownKeys === "reject" && (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(fields, key))) errors.push(error([String(key)], "UNKNOWN_FIELD"));
    }
  } catch { errors.push(error([], "INVALID_RECORD")); }
  return errors.length ? { success: false, errors } : { success: true, data: data as InferNormalized<S> };
}

/**
 * Normalize array entries in order; failures expose indexed successes, never a
 * misleading complete array. Sparse entries fail as missing.
 * @param input Unknown array of inputs.
 * @param normalizer Transform returning a discriminated normalization result.
 * @param options Error collection policy (default: collect).
 * @returns Complete data on success, indexed entries and errors on failure.
 * @throws TypeError for an invalid error-collection policy.
 * @example normalizeArray([{ age: "21" }], v => normalizeRecord(v, { age: Number }))
 */
export function normalizeArray<T>(input: unknown, normalizer: Normalizer<T>, options: NormalizeArrayOptions = {}): NormalizeArrayResult<T> {
  const entries: { index: number; data: T }[] = [];
  const errors: NormalizeError[] = [];
  let length: number;
  let onError: NormalizeArrayOptions["onError"];
  try {
    onError = options.onError;
    if (onError !== undefined && onError !== "collect" && onError !== "fail-fast") throw new TypeError();
  } catch { throw new TypeError("Invalid normalization error policy"); }
  try {
    if (!Array.isArray(input) || typeof normalizer !== "function") throw new TypeError();
    length = arrayLength(input);
  } catch { return { success: false, entries, errors: [error([], "INVALID_ARRAY")] }; }
  for (let index = 0; index < length; index++) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(input, index);
      if (!descriptor) errors.push(error([index], "MISSING_ENTRY"));
      else if (!("value" in descriptor)) errors.push(error([index], "ACCESSOR"));
      else {
        const result: unknown = normalizer(descriptor.value);
        if (!plain(result)) throw new TypeError();
        const status = Object.getOwnPropertyDescriptor(result, "success");
        if (!status || !("value" in status)) throw new TypeError();
        if (status.value === true) {
          const data = Object.getOwnPropertyDescriptor(result, "data");
          if (!data || !("value" in data)) throw new TypeError();
          // The validated discriminant/data pair is the normalizer's T contract.
          entries.push({ index, data: data.value as T });
        } else if (status.value === false) {
          const issues = Object.getOwnPropertyDescriptor(result, "errors");
          if (!issues || !("value" in issues)) throw new TypeError();
          const issuesLength = arrayLength(issues.value);
          if (issuesLength === 0) throw new TypeError();
          const validated: NormalizeError[] = [];
          for (let i = 0; i < issuesLength; i++) {
            const item = Object.getOwnPropertyDescriptor(issues.value, i);
            if (!item || !("value" in item) || !plain(item.value)) throw new TypeError();
            const fields = Object.getOwnPropertyDescriptors(item.value);
            if (!fields.path || !("value" in fields.path) || !Array.isArray(fields.path.value) || !fields.code || !("value" in fields.code) || typeof fields.code.value !== "string") throw new TypeError();
            const pathLength = arrayLength(fields.path.value);
            const path: (string | number)[] = [index];
            for (let p = 0; p < pathLength; p++) {
              const segment = Object.getOwnPropertyDescriptor(fields.path.value, p);
              if (!segment || !("value" in segment) || (typeof segment.value !== "string" && (typeof segment.value !== "number" || !Number.isSafeInteger(segment.value)))) throw new TypeError();
              path.push(segment.value);
            }
            validated.push(error(path, fields.code.value));
          }
          errors.push(...validated);
        } else throw new TypeError();
      }
    } catch { errors.push(error([index], "INVALID_ENTRY")); }
    if (errors.length && onError === "fail-fast") break;
  }
  return errors.length ? { success: false, entries, errors } : { success: true, data: entries.map(entry => entry.data) };
}
