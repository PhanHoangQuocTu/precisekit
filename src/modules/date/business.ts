/** A validated-at-runtime Gregorian date-only string, years 0000 through 9999. */
export type CalendarDateInput = string;
/** A Gregorian date-only string formatted as YYYY-MM-DD. */
export type CalendarDateResult = string;
/** Calendar rules supplied by the caller; no official holiday database is included. */
export interface BusinessCalendarOptions {
  /** Sunday=0 through Saturday=6. Defaults to [0, 6]. */
  weekend?: readonly (0 | 1 | 2 | 3 | 4 | 5 | 6)[];
  holidays?: readonly CalendarDateInput[];
}

const DAY = 86400000;
const MIN = -719528; // 0000-01-01 relative to 1970-01-01.
const MAX = 2932896; // 9999-12-31.
const weekday = (day: number) => ((day + 4) % 7 + 7) % 7;

function parseDate(value: CalendarDateInput): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Expected YYYY-MM-DD");
  const year = +value.slice(0, 4), month = +value.slice(5, 7), day = +value.slice(8);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError("Invalid Gregorian calendar date");
  }
  return date.getTime() / DAY;
}

function formatDate(day: number): CalendarDateResult {
  if (day < MIN || day > MAX) throw new RangeError("Calendar result outside years 0000 through 9999");
  return new Date(day * DAY).toISOString().slice(0, 10);
}

function calendar(options: BusinessCalendarOptions) {
  const weekend = options.weekend ?? [0, 6];
  if (!Array.isArray(weekend) || Array.from(weekend).some((n) => !Number.isInteger(n) || n < 0 || n > 6)) throw new RangeError("Invalid weekend");
  const excluded = new Set<number>(weekend);
  if (excluded.size === 7) throw new RangeError("Calendar must contain a working weekday");
  if (options.holidays !== undefined && !Array.isArray(options.holidays)) throw new TypeError("holidays must be an array");
  // Array.from visits sparse slots as undefined so parseDate rejects them.
  const holidays = [...new Set(Array.from(options.holidays ?? [], parseDate))]
    .filter((day) => !excluded.has(weekday(day))).sort((a, b) => a - b);
  const lower = (day: number) => {
    let lo = 0, hi = holidays.length;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (holidays[mid] < day) lo = mid + 1; else hi = mid; }
    return lo;
  };
  const count = (start: number, end: number) => {
    const length = end - start;
    let total = Math.floor(length / 7) * (7 - excluded.size);
    for (let i = 0; i < length % 7; i++) if (!excluded.has(weekday(start + i))) total++;
    return total - (lower(end) - lower(start));
  };
  return { count, isBusiness: (day: number) => !excluded.has(weekday(day)) && holidays[lower(day)] !== day };
}

/** Tests a date against caller-supplied holidays/weekends without timezone effects.
 * @param date Gregorian YYYY-MM-DD date in years 0000 through 9999.
 * @param options Caller-provided weekends and holidays; defaults to Saturday/Sunday.
 * @returns Whether the date is neither a weekend nor a holiday.
 * @throws {RangeError} If dates or weekend rules are invalid.
 * @throws {TypeError} If holidays is not an array.
 * @example isBusinessDay("2026-12-25", { holidays: ["2026-12-25"] }) // false
 */
export function isBusinessDay(date: CalendarDateInput, options: BusinessCalendarOptions = {}): boolean {
  return calendar(options).isBusiness(parseDate(date));
}

/**
 * Adds signed business days, excluding the starting date; zero returns the same date.
 * Uses week arithmetic and holiday indexing, independent of local time and DST.
 * Throws on invalid inputs or results outside years 0000 through 9999.
 * @param date Starting Gregorian YYYY-MM-DD date.
 * @param amount Signed safe integer count, excluding the starting day.
 * @param options Caller-provided weekends and holidays.
 * @returns Result as YYYY-MM-DD; zero returns the original date.
 * @throws {RangeError} If dates, amount, weekend rules or result range are invalid.
 * @throws {TypeError} If holidays is not an array.
 * @example addBusinessDays("2026-12-24", 1, { holidays: ["2026-12-25"] }) // "2026-12-28"
 */
export function addBusinessDays(date: CalendarDateInput, amount: number, options: BusinessCalendarOptions = {}): CalendarDateResult {
  const start = parseDate(date), rules = calendar(options);
  if (!Number.isSafeInteger(amount)) throw new RangeError("amount must be a safe integer");
  if (amount === 0) return date;
  const positive = amount > 0, target = Math.abs(amount);
  const available = positive ? MAX - start : start - MIN;
  const count = (distance: number) => positive ? rules.count(start + 1, start + distance + 1) : rules.count(start - distance, start);
  if (count(available) < target) throw new RangeError("Calendar result outside years 0000 through 9999");
  let low = 1, high = available;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (count(mid) >= target) high = mid; else low = mid + 1;
  }
  return formatDate(start + (positive ? low : -low));
}

/** Counts business dates in [start, end); reversed arguments negate the result.
 * @param start Gregorian YYYY-MM-DD interval start, included for forward intervals.
 * @param end Gregorian YYYY-MM-DD interval end, excluded for forward intervals.
 * @param options Caller-provided weekends and holidays.
 * @returns Signed business date count, or zero for equal dates.
 * @throws {RangeError} If dates or weekend rules are invalid.
 * @throws {TypeError} If holidays is not an array.
 * @example differenceInBusinessDays("2026-12-24", "2026-12-29", { holidays: ["2026-12-25"] }) // 2
 */
export function differenceInBusinessDays(start: CalendarDateInput, end: CalendarDateInput, options: BusinessCalendarOptions = {}): number {
  const a = parseDate(start), b = parseDate(end), rules = calendar(options);
  return a <= b ? rules.count(a, b) : -rules.count(b, a);
}

/** Returns the first business date strictly after date, never date itself.
 * @param date Gregorian YYYY-MM-DD starting date.
 * @param options Caller-provided weekends and holidays.
 * @returns Next business date as YYYY-MM-DD.
 * @throws {RangeError} If dates, rules or result range are invalid.
 * @throws {TypeError} If holidays is not an array.
 * @example nextBusinessDay("2026-12-25") // "2026-12-28"
 */
export function nextBusinessDay(date: CalendarDateInput, options: BusinessCalendarOptions = {}): CalendarDateResult {
  return addBusinessDays(date, 1, options);
}
