import { compactNullish, hasByPath, pickBy } from "../index";

type Equal<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
const expectType = <T extends true>(_proof?: T): void => undefined;

describe("compactNullish", () => {
  test("removes only null and undefined and keeps order", () => {
    const input = [0, null, false, undefined, "", NaN, 0n, "a", null, 1];
    const result = compactNullish(input);
    expect(result).toEqual([0, false, "", NaN, 0n, "a", 1]);
    expect(Number.isNaN(result[3])).toBe(true);
    expect(result).not.toBe(input);
    expect(input).toHaveLength(10);
  });

  test("empty, all-nullish and no-op inputs", () => {
    expect(compactNullish([])).toEqual([]);
    expect(compactNullish([null, undefined, null])).toEqual([]);
    const clean = [1, 2, 3];
    expect(compactNullish(clean)).toEqual(clean);
    expect(compactNullish(clean)).not.toBe(clean);
  });

  test("keeps duplicates, object identity and nested nullish values", () => {
    const item = { value: null };
    const result = compactNullish([item, item, [null], undefined]);
    expect(result).toEqual([item, item, [null]]);
    expect(result[0]).toBe(item);
  });

  test("sparse arrays: holes are dropped as undefined", () => {
    expect(compactNullish([1, , 3])).toEqual([1, 3]);
  });

  test("accepts frozen and readonly arrays without mutating them", () => {
    const frozen = Object.freeze([1, null, 2] as const);
    expect(compactNullish(frozen)).toEqual([1, 2]);
    expect(frozen).toEqual([1, null, 2]);
  });

  test("handles a large array", () => {
    const big = Array.from({ length: 100_000 }, (_, i) => (i % 2 === 0 ? null : i));
    expect(compactNullish(big)).toHaveLength(50_000);
  });

  test("rejects non-arrays", () => {
    expect(() => compactNullish(null as never)).toThrow(TypeError);
    expect(() => compactNullish("abc" as never)).toThrow(TypeError);
    expect(() => compactNullish({} as never)).toThrow(TypeError);
  });

  test("types", () => {
    const mixed: (number | null | undefined)[] = [1, null];
    expectType<Equal<ReturnType<typeof compactNullish<number | null | undefined>>, number[]>>();
    const result = compactNullish(mixed);
    expectType<Equal<typeof result, number[]>>();
    expect(result).toEqual([1]);
    const readonlyInput: readonly (string | null)[] = ["a", null];
    expectType<Equal<ReturnType<typeof compactNullish<string | null>>, string[]>>();
    expect(compactNullish(readonlyInput)).toEqual(["a"]);
    const keepsFalsy = compactNullish([0, "", false, null] as const);
    expectType<Equal<typeof keepsFalsy, (0 | "" | false)[]>>();
    expect(keepsFalsy).toEqual([0, "", false]);
  });
});

describe("hasByPath", () => {
  test("detects own nested properties, including undefined values", () => {
    const obj = { a: { b: undefined, c: 0, d: null }, list: [{ id: 1 }, undefined] };
    expect(hasByPath(obj, "a")).toBe(true);
    expect(hasByPath(obj, "a.b")).toBe(true);
    expect(hasByPath(obj, "a.c")).toBe(true);
    expect(hasByPath(obj, "a.d")).toBe(true);
    expect(hasByPath(obj, "a.missing")).toBe(false);
    expect(hasByPath(obj, "missing.deeper")).toBe(false);
    expect(hasByPath(obj, "a.b.c")).toBe(false);
  });

  test("supports array syntax in strings and array paths", () => {
    const obj = { list: [{ id: 1 }, undefined] };
    expect(hasByPath(obj, "list[0].id")).toBe(true);
    expect(hasByPath(obj, "list.0.id")).toBe(true);
    expect(hasByPath(obj, ["list", 0, "id"])).toBe(true);
    expect(hasByPath(obj, "list[1]")).toBe(true);
    expect(hasByPath(obj, "list[1].id")).toBe(false);
    expect(hasByPath(obj, "list[2]")).toBe(false);
    expect(hasByPath(obj, ["list", 5])).toBe(false);
    expect(hasByPath([10, 20], "[1]")).toBe(true);
    expect(hasByPath([10, 20], [1])).toBe(true);
  });

  test("array holes are not own properties", () => {
    const sparse = [1, , 3];
    expect(hasByPath({ sparse }, "sparse[1]")).toBe(false);
    expect(hasByPath({ sparse }, "sparse[0]")).toBe(true);
    expect(hasByPath({ sparse }, "sparse.length")).toBe(true);
  });

  test("ignores inherited properties", () => {
    class Base {
      inherited = 1;
    }
    const child = Object.create({ inheritedFromProto: 1 }) as Record<string, unknown>;
    child.own = { inner: 1 };
    expect(hasByPath(child, "inheritedFromProto")).toBe(false);
    expect(hasByPath(child, "own.inner")).toBe(true);
    expect(hasByPath({}, "toString")).toBe(false);
    expect(hasByPath({}, "constructor")).toBe(false);
    expect(hasByPath({}, "__proto__")).toBe(false);
    expect(hasByPath([], "map")).toBe(false);
    expect(hasByPath({ a: {} }, "a.hasOwnProperty")).toBe(false);
    expect(hasByPath(new Base(), "inherited")).toBe(true);
    expect(hasByPath(Object.create(null), "x")).toBe(false);
  });

  test("own __proto__ / constructor keys from JSON are only found when truly own", () => {
    const parsed = JSON.parse('{"__proto__":{"x":1},"constructor":{"prototype":{"y":2}}}');
    expect(hasByPath(parsed, "__proto__")).toBe(true);
    expect(hasByPath(parsed, "__proto__.x")).toBe(true);
    expect(hasByPath(parsed, "constructor.prototype.y")).toBe(true);
    expect(hasByPath(parsed, "__proto__.missing")).toBe(false);
    expect(Object.prototype).not.toHaveProperty("x");
    expect(Object.prototype).not.toHaveProperty("y");
  });

  test("never invokes getters or proxies traps for values", () => {
    const getter = jest.fn(() => ({ deep: 1 }));
    const obj = {
      get lazy() {
        return getter();
      },
      plain: { value: 1 },
    };
    expect(hasByPath(obj, "lazy")).toBe(true);
    expect(hasByPath(obj, "lazy.deep")).toBe(false);
    expect(hasByPath(obj, "plain.value")).toBe(true);
    expect(getter).not.toHaveBeenCalled();
  });

  test("non-object roots and intermediates return false", () => {
    expect(hasByPath(null, "a")).toBe(false);
    expect(hasByPath(undefined, "a")).toBe(false);
    expect(hasByPath("abc", "length")).toBe(false);
    expect(hasByPath(42, "a")).toBe(false);
    expect(hasByPath({ a: "text" }, "a.length")).toBe(false);
    expect(hasByPath({ a: null }, "a.b")).toBe(false);
  });

  test("empty paths are false and invalid path types throw", () => {
    expect(hasByPath({ a: 1 }, "")).toBe(false);
    expect(hasByPath({ a: 1 }, [])).toBe(false);
    expect(() => hasByPath({ a: 1 }, null as never)).toThrow(TypeError);
    expect(() => hasByPath({ a: 1 }, 5 as never)).toThrow(TypeError);
  });

  test("accepts readonly array paths and does not mutate the path or object", () => {
    const path = Object.freeze(["a", "b"] as const);
    const obj = Object.freeze({ a: Object.freeze({ b: 1 }) });
    expect(hasByPath(obj, path)).toBe(true);
    expect(path).toEqual(["a", "b"]);
  });

  test("Maps, Sets and Dates are objects with no path-addressable own entries", () => {
    expect(hasByPath({ m: new Map([["k", 1]]) }, "m.k")).toBe(false);
    expect(hasByPath({ m: new Map([["k", 1]]) }, "m.size")).toBe(false);
  });
});

describe("pickBy", () => {
  test("selects properties with a predicate (value, key, object)", () => {
    const source = { a: 1, b: 2, c: 3, d: 0, e: undefined };
    expect(pickBy(source, (value) => typeof value === "number" && value > 1)).toEqual({ b: 2, c: 3 });
    const seen: [unknown, string | symbol, unknown][] = [];
    pickBy(source, (value, key, obj) => {
      seen.push([value, key, obj]);
      return false;
    });
    expect(seen.map(([, key]) => key)).toEqual(["a", "b", "c", "d", "e"]);
    expect(seen.every(([, , obj]) => obj === source)).toBe(true);
  });

  test("returns a new object and never mutates the input", () => {
    const nested = { x: 1 };
    const source = Object.freeze({ keep: nested, drop: 2 });
    const result = pickBy(source, (_value, key) => key === "keep");
    expect(result).toEqual({ keep: nested });
    expect(result.keep).toBe(nested);
    expect(result).not.toBe(source);
    expect(source).toEqual({ keep: nested, drop: 2 });
    expect(pickBy({}, () => true)).toEqual({});
    expect(pickBy({ a: 1 }, () => false)).toEqual({});
  });

  test("keeps falsy values the predicate accepts", () => {
    expect(pickBy({ a: 0, b: "", c: false, d: null, e: undefined, f: NaN }, () => true)).toEqual({
      a: 0, b: "", c: false, d: null, e: undefined, f: NaN,
    });
  });

  test("includes enumerable own symbols and skips non-enumerable and inherited keys", () => {
    const sym = Symbol("s");
    const hidden = Symbol("hidden");
    const proto = { inherited: 1 };
    const source = Object.create(proto) as Record<string | symbol, unknown>;
    source.a = 1;
    source[sym] = 2;
    Object.defineProperty(source, "nonEnumerable", { value: 3, enumerable: false });
    Object.defineProperty(source, hidden, { value: 4, enumerable: false });
    const keys: (string | symbol)[] = [];
    const result = pickBy(source, (_value, key) => {
      keys.push(key);
      return true;
    });
    expect(keys).toEqual(["a", sym]);
    expect(result.a).toBe(1);
    expect(result[sym]).toBe(2);
    expect(Object.getOwnPropertyNames(result)).toEqual(["a"]);
    expect(Object.getOwnPropertySymbols(result)).toEqual([sym]);
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
  });

  test("orders integer-like keys first, then insertion order", () => {
    const keys: (string | symbol)[] = [];
    pickBy({ b: 1, 2: 1, a: 1, 1: 1 }, (_value, key) => {
      keys.push(key);
      return true;
    });
    expect(keys).toEqual(["1", "2", "b", "a"]);
  });

  test("own __proto__ key is copied as data without polluting prototypes", () => {
    const source = JSON.parse('{"__proto__":{"polluted":true},"safe":1}');
    const result = pickBy(source, () => true) as Record<string, unknown>;
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.getOwnPropertyDescriptor(result, "__proto__")?.value).toEqual({ polluted: true });
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(pickBy(source, (_v, key) => key !== "__proto__")).toEqual({ safe: 1 });
  });

  test("reads own enumerable accessors once and stores plain values", () => {
    const getter = jest.fn(() => 5);
    const source = Object.defineProperty({ plain: 1 }, "lazy", { get: getter, enumerable: true });
    const result = pickBy(source, () => true);
    expect(getter).toHaveBeenCalledTimes(1);
    expect(Object.getOwnPropertyDescriptor(result, "lazy")).toMatchObject({ value: 5, writable: true, enumerable: true, configurable: true });
  });

  test("propagates predicate errors without partial output", () => {
    expect(() => pickBy({ a: 1, b: 2 }, (_value, key) => {
      if (key === "b") throw new Error("boom");
      return true;
    })).toThrow("boom");
  });

  test("validates arguments", () => {
    expect(() => pickBy(null as never, () => true)).toThrow(TypeError);
    expect(() => pickBy([1, 2] as never, () => true)).toThrow(TypeError);
    expect(() => pickBy({}, null as never)).toThrow(TypeError);
    expect(() => pickBy({}, "x" as never)).toThrow(TypeError);
  });

  test("types", () => {
    const source: { a: number; b: string | null; c: string } = { a: 1, b: null, c: "x" };
    // TypeScript 5.5+ infers `value is string | number` here, so null is removed from `b`.
    const inferred = pickBy(source, (value) => value !== null);
    expectType<Equal<typeof inferred, { a?: number; b?: string; c?: string }>>();
    const plain = pickBy(source, (value): boolean => value !== null);
    expectType<Equal<typeof plain, Partial<typeof source>>>();
    const narrowed = pickBy(source, (value): value is string => typeof value === "string");
    expectType<Equal<typeof narrowed, { a?: never; b?: string; c?: string }>>();
    expect(() => {
      // @ts-expect-error the predicate must be a function
      pickBy(source, "a");
    }).toThrow(TypeError);
    expect(() => {
      // @ts-expect-error the source must be an object
      pickBy(1, () => true);
    }).toThrow(TypeError);
    expect(inferred).toEqual({ a: 1, c: "x" });
    expect(plain).toEqual({ a: 1, c: "x" });
    expect(narrowed).toEqual({ c: "x" });
  });
});
