/** Options for ordered, bounded asynchronous mapping. */
export interface ConcurrentOptions {
  concurrency: number;
  signal?: AbortSignal;
}

/** Options for lazy, bounded batch processing. */
export interface BatchAsyncOptions {
  batchSize: number;
  /** Defaults to one batch at a time. */
  concurrency?: number;
  signal?: AbortSignal;
}

function positiveInteger(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}

function schedule<R>(
  length: number,
  task: (index: number) => R | PromiseLike<R>,
  options: ConcurrentOptions,
  settled: boolean,
): Promise<(R | PromiseSettledResult<R>)[]> {
  positiveInteger(options.concurrency, "concurrency");
  return new Promise((resolve, reject) => {
    const { signal, concurrency } = options;
    const results: (R | PromiseSettledResult<R>)[] = new Array(length);
    let next = 0;
    let active = 0;
    let completed = 0;
    let stopped = false;
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const fail = (reason: unknown) => {
      if (stopped) return;
      stopped = true;
      cleanup();
      reject(reason);
    };
    const abort = () => fail(signal?.reason);
    if (signal?.aborted) { abort(); return; }
    signal?.addEventListener("abort", abort, { once: true });
    const launch = () => {
      if (stopped) return;
      if (completed === length) {
        stopped = true;
        cleanup();
        resolve(results);
        return;
      }
      while (!stopped && active < concurrency && next < length) {
        const index = next++;
        active++;
        // Invoke synchronously so a synchronous throw stops further scheduling.
        let value: R | PromiseLike<R>;
        try { value = task(index); }
        catch (reason) {
          active--;
          if (!settled) { fail(reason); return; }
          results[index] = { status: "rejected", reason };
          completed++;
          continue;
        }
        Promise.resolve(value).then(
          (result) => {
            if (stopped) return;
            results[index] = settled ? { status: "fulfilled", value: result } : result;
            active--; completed++; launch();
          },
          (reason: unknown) => {
            if (stopped) return;
            if (!settled) { fail(reason); return; }
            results[index] = { status: "rejected", reason };
            active--; completed++; launch();
          },
        );
      }
      // All tasks may have thrown synchronously in settled mode.
      if (!stopped && completed === length) launch();
    };
    launch();
  });
}

/**
 * Maps without mutating input, with bounded concurrency and input-ordered results.
 * Rejects on the first failure or abort reason; running tasks are not cancelled.
 * Sparse entries are passed as undefined. Invalid options throw RangeError.
 * @param items Readonly source items, visited in input order.
 * @param mapper Sync or async callback receiving the item and original index.
 * @param options Positive concurrency limit and optional cancellation signal.
 * @returns Input-ordered mapped values after every task succeeds.
 * @throws {TypeError} If items or mapper have invalid runtime types.
 * @throws {RangeError} If concurrency is not a positive safe integer.
 * @example await mapConcurrent([1, 2], async value => value * 2, { concurrency: 2 }) // [2, 4]
 */
export function mapConcurrent<T, R>(
  items: readonly T[], mapper: (item: T, index: number) => R | PromiseLike<R>,
  options: ConcurrentOptions,
): Promise<R[]> {
  if (!Array.isArray(items) || typeof mapper !== "function") throw new TypeError("Expected an array and mapper");
  // settled=false stores only R, as enforced by the scheduler branch.
  return schedule(items.length, (i) => mapper(items[i], i), options, false) as Promise<R[]>;
}

/**
 * Maps with bounded concurrency, collecting task failures in input order.
 * Abort rejects the entire operation with the signal reason and stops new work.
 * Sparse entries are passed as undefined; invalid options throw RangeError.
 * @param items Readonly source items.
 * @param mapper Sync or async callback receiving the item and original index.
 * @param options Positive concurrency limit and optional cancellation signal.
 * @returns Input-ordered fulfillment and rejection records; abort rejects instead.
 * @throws {TypeError} If items or mapper have invalid runtime types.
 * @throws {RangeError} If concurrency is not a positive safe integer.
 * @example await mapSettledConcurrent([1, 2], async value => value * 2, { concurrency: 1 })
 */
export function mapSettledConcurrent<T, R>(
  items: readonly T[], mapper: (item: T, index: number) => R | PromiseLike<R>,
  options: ConcurrentOptions,
): Promise<PromiseSettledResult<R>[]> {
  if (!Array.isArray(items) || typeof mapper !== "function") throw new TypeError("Expected an array and mapper");
  // settled=true stores only PromiseSettledResult<R>.
  return schedule(items.length, (i) => mapper(items[i], i), options, true) as Promise<PromiseSettledResult<R>[]>;
}

/**
 * Processes stable contiguous batches, creating each slice only when scheduled.
 * Defaults to sequential execution. Results follow batch order; failures and
 * abort behave like mapConcurrent. Input is never mutated.
 * @param items Readonly source items.
 * @param processor Sync or async callback for each newly created batch slice.
 * @param options Positive batch size, optional concurrency and cancellation signal.
 * @returns Processor results in batch order; rejects on task failure or abort.
 * @throws {TypeError} If items or processor have invalid runtime types.
 * @throws {RangeError} If batchSize or concurrency is not a positive safe integer.
 * @example await batchAsync([1, 2, 3], async batch => batch.length, { batchSize: 2 }) // [2, 1]
 */
export function batchAsync<T, R>(
  items: readonly T[], processor: (batch: readonly T[]) => R | PromiseLike<R>,
  options: BatchAsyncOptions,
): Promise<R[]> {
  if (!Array.isArray(items) || typeof processor !== "function") throw new TypeError("Expected an array and processor");
  const { batchSize } = options;
  positiveInteger(batchSize, "batchSize");
  return schedule(Math.ceil(items.length / batchSize), (i) => {
    const start = i * batchSize;
    return processor(items.slice(start, start + batchSize));
  }, { concurrency: options.concurrency ?? 1, signal: options.signal }, false) as Promise<R[]>;
}
