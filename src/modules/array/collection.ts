import { KeySelector } from "@/types";
import { assertArray, assertFunction, assertInteger, assertFiniteNumber } from "../../utils/validate";
import { ExactDecimal, divideDecimals, outOfRange } from "../../utils/numeric";
import { assertRandom, draw } from "../../utils/random";

type Falsy = false | null | undefined | 0 | "" | 0n;

/** Drops false, null, undefined, 0, "", NaN and 0n. */
const compact = <T>(arr: T[]): Exclude<T, Falsy>[] => {
  assertArray(arr, "arr");
  return arr.filter(Boolean) as Exclude<T, Falsy>[];
};

/** Drops only null and undefined; keeps 0, false, "", NaN and 0n. Returns a new array in the original order. */
const compactNullish = <T>(arr: readonly T[]): NonNullable<T>[] => {
  assertArray(arr, "arr");
  return arr.filter((item) => item !== null && item !== undefined) as NonNullable<T>[];
};

/** Items of `arr` that are not in `values`. Compares with SameValueZero. */
const difference = <T>(arr: T[], values: T[]): T[] => {
  assertArray(arr, "arr");
  assertArray(values, "values");
  const exclude = new Set(values);
  return arr.filter((item) => !exclude.has(item));
};

/** Unique items present in both arrays, in the order of `arr`. */
const intersection = <T>(arr: T[], values: T[]): T[] => {
  assertArray(arr, "arr");
  assertArray(values, "values");
  const include = new Set(values);
  return [...new Set(arr)].filter((item) => include.has(item));
};

/** Unique items across all arrays, in order of first appearance. */
const union = <T>(...arrays: T[][]): T[] => {
  arrays.forEach((arr) => assertArray(arr, "arrays"));
  return [...new Set(arrays.flat() as T[])];
};

/** Splits into [matching, non-matching] in one pass. */
const partition = <T>(
  arr: T[],
  predicate: (item: T, index: number) => boolean
): [T[], T[]] => {
  assertArray(arr, "arr");
  assertFunction(predicate, "predicate");
  const pass: T[] = [];
  const fail: T[] = [];
  arr.forEach((item, index) => (predicate(item, index) ? pass : fail).push(item));
  return [pass, fail];
};

/** Counts items per key: countBy(["a", "b", "a"], x => x) -> { a: 2, b: 1 } */
const countBy = <T>(
  arr: T[],
  keySelector: KeySelector<T>
): Record<string, number> => {
  assertArray(arr, "arr");
  assertFunction(keySelector, "keySelector");
  const result = Object.create(null) as Record<string, number>;
  for (const item of arr) {
    const key = String(keySelector(item));
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
};

/** Index items by key; later items win when keys collide. */
const keyBy = <T>(
  arr: T[],
  keySelector: KeySelector<T>
): Record<string, T> => {
  assertArray(arr, "arr");
  assertFunction(keySelector, "keySelector");
  const result = Object.create(null) as Record<string, T>;
  for (const item of arr) {
    result[String(keySelector(item))] = item;
  }
  return result;
};

/** Pairs items by index; the result is as long as the shorter array. */
const zip = <A, B>(a: A[], b: B[]): [A, B][] => {
  assertArray(a, "a");
  assertArray(b, "b");
  return Array.from({ length: Math.min(a.length, b.length) }, (_, i) => [a[i], b[i]]);
};

/** Most items `range` will build, to avoid exhausting memory on a mistyped bound. */
const MAX_RANGE_LENGTH = 10_000_000;

/**
 * range(3) -> [0, 1, 2]; range(1, 4) -> [1, 2, 3]; range(0, 10, 5) -> [0, 5].
 * `end` is exclusive. Fractional steps are computed exactly: range(0, 0.5, 0.1) -> [0, 0.1, 0.2, 0.3, 0.4].
 */
const range = (start: number, end?: number, step?: number): number[] => {
  assertFiniteNumber(start, "start");
  const from = end === undefined ? 0 : start;
  const to = end === undefined ? start : end;
  assertFiniteNumber(to, "end");
  const increment = step ?? (to >= from ? 1 : -1);
  assertFiniteNumber(increment, "step");
  if (increment === 0) throw outOfRange("step must not be 0");
  if (Math.abs(from) > Number.MAX_SAFE_INTEGER || Math.abs(to) > Number.MAX_SAFE_INTEGER) {
    throw outOfRange("start and end must not exceed 2^53 - 1 in magnitude");
  }

  if (Number.isInteger(from) && Number.isInteger(to) && Number.isInteger(increment)) {
    const length = Math.max(Math.ceil((to - from) / increment), 0);
    if (length > MAX_RANGE_LENGTH) throw outOfRange(`range would create ${length} items; the limit is ${MAX_RANGE_LENGTH}`);
    return Array.from({ length }, (_, i) => from + i * increment);
  }

  // Decimal arithmetic keeps 0.1 * 3 at 0.3 and counts range(0.1, 0.4, 0.1) as 3 items, not 4
  const base = new ExactDecimal(from);
  const delta = new ExactDecimal(increment);
  const count = divideDecimals(new ExactDecimal(to).sub(base), delta, 40).ceil();
  const length = count.isNeg() ? 0 : count.toNumber();
  if (length > MAX_RANGE_LENGTH) throw outOfRange(`range would create ${length} items; the limit is ${MAX_RANGE_LENGTH}`);
  return Array.from({ length }, (_, i) => base.add(delta.mul(i)).toNumber());
};

/** Fisher-Yates shuffle into a new array; `random` is injectable for tests. */
const shuffle = <T>(arr: T[], random: () => number = Math.random): T[] => {
  assertArray(arr, "arr");
  assertRandom(random);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(draw(random) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};

/** Random item, or undefined for an empty array. */
const sample = <T>(arr: T[], random: () => number = Math.random): T | undefined => {
  assertArray(arr, "arr");
  assertRandom(random);
  return arr.length === 0 ? undefined : arr[Math.floor(draw(random) * arr.length)];
};

/** Flattens any depth of nesting (or up to `depth` levels). */
const flattenDeep = (arr: unknown[], depth = Infinity): unknown[] => {
  assertArray(arr, "arr");
  if (depth !== Infinity) assertInteger(depth, "depth");
  return arr.flat(depth);
};

export {
  compact,
  compactNullish,
  difference,
  intersection,
  union,
  partition,
  countBy,
  keyBy,
  zip,
  range,
  shuffle,
  sample,
  flattenDeep,
};
