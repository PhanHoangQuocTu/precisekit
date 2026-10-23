import { batchAsync, mapConcurrent, mapSettledConcurrent } from "../modules/function/concurrent";

const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

describe("bounded async workflows", () => {
  it("bounds active work and preserves order", async () => {
    let active = 0, peak = 0;
    const input = Object.freeze([4, 3, 2, 1]);
    const result = await mapConcurrent(input, async (item, i) => {
      peak = Math.max(peak, ++active);
      await new Promise((resolve) => setTimeout(resolve, item));
      active--;
      return `${i}:${item}`;
    }, { concurrency: 2 });
    expect(result).toEqual(["0:4", "1:3", "2:2", "3:1"]);
    expect(peak).toBe(2);
  });

  it("stops immediately on sync throw and collects sync failures in settled mode", async () => {
    const error = new Error("failed");
    const fn = jest.fn(() => { throw error; });
    await expect(mapConcurrent([1, 2, 3], fn, { concurrency: 3 })).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(await mapSettledConcurrent([1, 2], fn, { concurrency: 1 })).toEqual([
      { status: "rejected", reason: error }, { status: "rejected", reason: error },
    ]);
  });

  it("handles failures in tasks still running after fail-fast", async () => {
    let rejectLater!: (reason: unknown) => void;
    const error = new Error("first");
    const unhandled = jest.fn();
    process.on("unhandledRejection", unhandled);
    try {
      const mapper = jest.fn((n: number) => n === 0 ? Promise.reject(error) : new Promise<number>((_, reject) => { rejectLater = reject; }));
      await expect(mapConcurrent([0, 1, 2], mapper, { concurrency: 2 })).rejects.toBe(error);
      rejectLater(new Error("late"));
      await tick();
      expect(mapper).toHaveBeenCalledTimes(2);
      expect(unhandled).not.toHaveBeenCalled();
    } finally { process.removeListener("unhandledRejection", unhandled); }
  });

  it("preserves even falsy abort reasons and removes listeners", async () => {
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, "removeEventListener");
    const mapper = jest.fn(() => new Promise<never>(() => {}));
    const pending = mapConcurrent([1, 2], mapper, { concurrency: 1, signal: controller.signal });
    controller.abort(0);
    await expect(pending).rejects.toBe(0);
    expect(mapper).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
    await expect(mapSettledConcurrent([], mapper, { concurrency: 1, signal: controller.signal })).rejects.toBe(0);
  });

  it("cleans up success listeners and handles abort inside mapper", async () => {
    const controller = new AbortController();
    const remove = jest.spyOn(controller.signal, "removeEventListener");
    expect(await mapConcurrent([], (n) => n, { concurrency: 1, signal: controller.signal })).toEqual([]);
    expect(remove).toHaveBeenCalledTimes(1);
    const mapper = jest.fn(() => { controller.abort("stop"); return Promise.reject("late"); });
    await expect(mapConcurrent([1, 2], mapper, { concurrency: 2, signal: controller.signal })).rejects.toBe("stop");
    expect(mapper).toHaveBeenCalledTimes(1);
    await tick();
  });

  it("settles in order and supports sparse arrays", async () => {
    expect(await mapSettledConcurrent([1, 2, 3], async (n) => { if (n === 2) throw "bad"; return n * 2; }, { concurrency: 2 }))
      .toEqual([{ status: "fulfilled", value: 2 }, { status: "rejected", reason: "bad" }, { status: "fulfilled", value: 6 }]);
    expect(await mapConcurrent(new Array(2), (n) => n, { concurrency: 2 })).toEqual([undefined, undefined]);
  });

  it("creates batches lazily and defaults to sequential processing", async () => {
    const source = [1, 2, 3, 4, 5];
    const slice = jest.spyOn(source, "slice");
    let release!: (value: number) => void;
    const mapper = jest.fn((batch: readonly number[]) => batch[0] === 1 ? new Promise<number>((resolve) => { release = resolve; }) : batch.length);
    const pending = batchAsync(source, mapper, { batchSize: 2 });
    expect(slice).toHaveBeenCalledTimes(1);
    release(2);
    expect(await pending).toEqual([2, 2, 1]);
    expect(mapper.mock.calls.map(([batch]) => batch)).toEqual([[1, 2], [3, 4], [5]]);
    slice.mockRestore();
    expect(source).toEqual([1, 2, 3, 4, 5]);
  });

  it.each([0, -1, 1.1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])("rejects invalid size %s", (value) => {
    expect(() => mapConcurrent([], (n) => n, { concurrency: value })).toThrow(RangeError);
    expect(() => batchAsync([], (n) => n, { batchSize: value })).toThrow(RangeError);
  });
});
