import { normalizeArray, normalizeRecord } from "../modules/normalization";
import { strip } from "../modules/formatter/cleaning";
import { safeToInteger, safeToBoolean } from "../modules/helper/conversion";

describe("normalization", () => {
  const age = (value: unknown): number | null => typeof value === "string" && /^\d+$/.test(value) ? Number(value) : null;
  test("reuses existing helpers without wrapping or widening inference", () => {
    const result = normalizeRecord({ name: " Minh ", age: "21", active: "true" }, { name: strip, age: safeToInteger, active: safeToBoolean });
    expect(result).toEqual({ success: true, data: { name: "Minh", age: 21, active: true } });
    if (result.success) {
      const data: { name: string; age: number; active: boolean } = result.data;
      expect(data.active).toBe(true);
    }
  });
  test("infers narrow helper return types and does not mutate", () => {
    const input = { name: " Minh ", age: "21", other: true };
    const result = normalizeRecord(input, { name: (v: string) => v.trim(), age });
    expect(result).toEqual({ success: true, data: { name: "Minh", age: 21 } });
    if (result.success) {
      const name: string = result.data.name;
      const numeric: number = result.data.age;
      expect([name, numeric]).toEqual(["Minh", 21]);
      // @ts-expect-error normalizer inference is not widened
      const wrong: string = result.data.age;
      void wrong;
    }
    expect(input.name).toBe(" Minh ");
  });
  test("missing defaults only apply to absent fields", () => {
    const schema = { age: { normalize: age, default: "42" } };
    expect(normalizeRecord({}, schema)).toEqual({ success: true, data: { age: 42 } });
    expect(normalizeRecord({ age: undefined }, schema).success).toBe(false);
    expect(normalizeRecord({ age: null }, schema).success).toBe(false);
    expect(normalizeRecord({}, { age })).toMatchObject({ success: false, errors: [{ path: ["age"], code: "MISSING_FIELD" }] });
  });
  test("nullish and thrown transforms fail without secret leakage", () => {
    for (const fn of [() => null, () => undefined, () => { throw Error("private secret"); }]) {
      const result = normalizeRecord({ a: "private secret" }, { a: fn });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result)).not.toContain("private secret");
    }
  });
  test("unknown keys and unsafe schema keys", () => {
    expect(normalizeRecord({ extra: 1 }, {}, { unknownKeys: "reject" }).success).toBe(false);
    expect(normalizeRecord({}, JSON.parse('{"__proto__":{}}')).success).toBe(false);
    expect(Object.getPrototypeOf({})).toBe(Object.prototype);
    expect(normalizeRecord(Object.create({ age: "21" }), { age }).success).toBe(false);
  });
  test("never executes getters in input, schema, defaults or array", () => {
    const get = jest.fn(() => "21");
    const input = Object.defineProperty({}, "age", { enumerable: true, get });
    expect(normalizeRecord(input, { age }).success).toBe(false);
    const schema = Object.defineProperty({}, "age", { enumerable: true, get });
    expect(normalizeRecord({}, schema).success).toBe(false);
    expect(normalizeRecord({}, { age: Object.defineProperty({ normalize: age }, "default", { get }) }).success).toBe(false);
    const array = Object.defineProperty(["a"], "0", { get });
    expect(normalizeArray(array, v => ({ success: true, data: v })).success).toBe(false);
    expect(get).not.toHaveBeenCalled();
  });
  test("proxy errors are sanitized", () => {
    const proxy = new Proxy({}, { ownKeys() { throw Error("secret"); } });
    const result = normalizeRecord(proxy, {});
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret");
  });
  test("indexed partial successes and errors, fail-fast and sparse arrays", () => {
    const fn = (v: unknown) => normalizeRecord(v, { age });
    expect(normalizeArray([{ age: "1" }, { age: "bad" }, { age: "3" }], fn)).toMatchObject({ success: false, entries: [{ index: 0, data: { age: 1 } }, { index: 2, data: { age: 3 } }], errors: [{ path: [1, "age"] }] });
    const spy = jest.fn(fn);
    expect(normalizeArray([{}, {}], spy, { onError: "fail-fast" }).success).toBe(false);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(normalizeArray(new Array(1), fn)).toMatchObject({ success: false, errors: [{ path: [0], code: "MISSING_ENTRY" }] });
    expect(normalizeArray([], fn)).toEqual({ success: true, data: [] });
    expect(normalizeArray({}, fn).success).toBe(false);
  });
  test("malformed result contracts fail and result getters never execute", () => {
    const getter = jest.fn(() => true);
    const malformed: unknown[] = [null, {}, { success: 1 }, { success: true }, { success: false, errors: [] }, { success: false, errors: [null] }, Object.defineProperty({}, "success", { get: getter }), { success: false, errors: [{ code: "X", path: Object.defineProperty(["x"], "0", { get: getter }) }] }];
    for (const result of malformed) {
      // Deliberately simulate malformed JavaScript callbacks at the public boundary.
      const fn = () => result as ReturnType<typeof normalizeRecord>;
      expect(normalizeArray([1], fn)).toMatchObject({ success: false, errors: [{ code: "INVALID_ENTRY" }] });
    }
    expect(getter).not.toHaveBeenCalled();
  });
  test("callback error arrays and paths never read proxy properties", () => {
    const get = jest.fn(() => { throw Error("private secret"); });
    const path = new Proxy(["age"], { get });
    const errors = new Proxy([{ path, code: "INVALID_FIELD", message: "private secret" }], { get });
    const result = normalizeArray([1], () => ({ success: false, errors }));
    expect(result).toMatchObject({ success: false, errors: [{ path: [0, "age"], code: "INVALID_FIELD" }] });
    expect(JSON.stringify(result)).not.toContain("private secret");
    expect(get).not.toHaveBeenCalled();
  });
});
