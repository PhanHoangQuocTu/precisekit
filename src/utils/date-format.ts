/**
 * Dependency-free ISO 8601 parsing and token-based date formatting.
 *
 * Tokens follow Unicode TR35 as implemented by date-fns (`yyyy-MM-dd HH:mm:ss`, `EEEE`, `MMM do`, `xxx`, ...)
 * so existing format strings keep working. English names are built in; other locales use `Intl`, or a
 * date-fns locale object may be passed and is used as-is.
 */

// ---------------------------------------------------------------- calendar math (pure, DST-free)

const DAY_MS = 86_400_000;

/** Days since 1970-01-01 of a proleptic Gregorian date; months and days may overflow like `Date.UTC`. */
export const epochDay = (year: number, month: number, day: number): number => {
  const date = new Date(0);
  date.setUTCFullYear(year, month, day);
  return Math.floor(date.getTime() / DAY_MS);
};

const weekdayOf = (epoch: number): number => (((epoch + 4) % 7) + 7) % 7;

const startOfWeek = (epoch: number, weekStartsOn: number): number => {
  const weekday = weekdayOf(epoch);
  return epoch - ((weekday < weekStartsOn ? 7 : 0) + weekday - weekStartsOn);
};

const weekYearOf = (year: number, epoch: number, weekStartsOn: number, firstWeekContainsDate: number): number => {
  if (epoch >= startOfWeek(epochDay(year + 1, 0, firstWeekContainsDate), weekStartsOn)) return year + 1;
  if (epoch >= startOfWeek(epochDay(year, 0, firstWeekContainsDate), weekStartsOn)) return year;
  return year - 1;
};

const weekOf = (year: number, epoch: number, weekStartsOn: number, firstWeekContainsDate: number): number => {
  const weekYear = weekYearOf(year, epoch, weekStartsOn, firstWeekContainsDate);
  const firstWeek = startOfWeek(epochDay(weekYear, 0, firstWeekContainsDate), weekStartsOn);
  return Math.round((startOfWeek(epoch, weekStartsOn) - firstWeek) / 7) + 1;
};

// ---------------------------------------------------------------- ISO 8601 parsing

const DAYS_IN_MONTH = [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const isLeapYear = (year: number): boolean => year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);

const DATE_RE = /^-?(?:(\d{3})|(\d{2})(?:-?(\d{2}))?|W(\d{2})(?:-?(\d{1}))?|)$/;
const TIME_RE = /^(\d{2}(?:[.,]\d*)?)(?::?(\d{2}(?:[.,]\d*)?))?(?::?(\d{2}(?:[.,]\d*)?))?$/;
const ZONE_RE = /^([+-])(\d{2})(?::?(\d{2}))?$/;
const YEAR_RE = /^(?:(\d{4}|[+-]\d{6})|(\d{2}|[+-]\d{4})$)/;
// Anchoring the prefix prevents retrying the suffix at every sign in malformed input.
const ZONE_TAIL_RE = /^[^Z+-]*([Z+-].*)$/;

const unit = (value: string | undefined): number => (value ? parseInt(value, 10) : 1);
const timeUnit = (value: string | undefined): number => (value && parseFloat(value.replace(",", "."))) || 0;

const parseDay = (text: string, year: number): number => {
  const match = DATE_RE.exec(text);
  if (!match) return NaN;
  const dayOfYear = unit(match[1]);
  const month = unit(match[2]) - 1;
  const day = unit(match[3]);
  const week = unit(match[4]);
  const weekday = unit(match[5]) - 1;
  if (match[4]) {
    if (week < 1 || week > 53 || weekday < 0 || weekday > 6) return NaN;
    const fourth = epochDay(year, 0, 4);
    return (fourth + (week - 1) * 7 + weekday + 1 - (weekdayOf(fourth) || 7)) * DAY_MS;
  }
  const days = DAYS_IN_MONTH[month] || (isLeapYear(year) ? 29 : 28);
  if (month < 0 || month > 11 || day < 1 || day > days) return NaN;
  if (dayOfYear < 1 || dayOfYear > (isLeapYear(year) ? 366 : 365)) return NaN;
  return epochDay(year, month, Math.max(dayOfYear, day)) * DAY_MS;
};

const parseClock = (text: string): number => {
  const match = TIME_RE.exec(text);
  if (!match) return NaN;
  const hours = timeUnit(match[1]);
  const minutes = timeUnit(match[2]);
  const seconds = timeUnit(match[3]);
  const valid =
    hours === 24
      ? minutes === 0 && seconds === 0
      : seconds >= 0 && seconds < 60 && minutes >= 0 && minutes < 60 && hours >= 0 && hours < 25;
  return valid ? hours * 3_600_000 + minutes * 60_000 + seconds * 1000 : NaN;
};

const parseZone = (text: string): number => {
  if (text === "Z") return 0;
  const match = ZONE_RE.exec(text);
  if (!match) return 0;
  const minutes = (match[3] && parseInt(match[3], 10)) || 0;
  if (minutes > 59) return NaN;
  return (match[1] === "+" ? -1 : 1) * (parseInt(match[2], 10) * 3_600_000 + minutes * 60_000);
};

/**
 * Parse an ISO 8601 date or date-time. Unlike `new Date("2026-10-03")`, a string without an offset is read as
 * local time. Accepts calendar (`2026-10-03`, `20261003`), week (`2026-W40-6`) and ordinal (`2026-276`) dates,
 * fractional hours/minutes/seconds, `24:00`, `Z`, `+07:00` and `+0700`. Returns an Invalid Date when malformed.
 */
export const parseISO = (value: string): Date => {
  const invalid = new Date(NaN);
  const pieces = value.split(/[T ]/);
  if (pieces.length > 2) return invalid;
  let dateText: string | undefined;
  let timeText: string | undefined;
  if (/:/.test(pieces[0])) {
    timeText = pieces[0];
  } else {
    dateText = pieces[0];
    timeText = pieces[1];
    if (/[Z ]/i.test(dateText)) {
      dateText = value.split(/[Z ]/i)[0];
      timeText = value.slice(dateText.length);
    }
  }
  let zoneText: string | undefined;
  if (timeText) {
    const zone = ZONE_TAIL_RE.exec(timeText);
    if (zone) {
      zoneText = zone[1];
      timeText = timeText.replace(zoneText, "");
    }
  }
  if (!dateText) return invalid;
  const yearMatch = YEAR_RE.exec(dateText);
  if (!yearMatch) return invalid;
  const year = yearMatch[1] ? parseInt(yearMatch[1], 10) : parseInt(yearMatch[2], 10) * 100;
  const day = parseDay(dateText.slice((yearMatch[1] || yearMatch[2]).length), year);
  if (Number.isNaN(day)) return invalid;
  const clock = timeText ? parseClock(timeText) : 0;
  if (Number.isNaN(clock)) return invalid;
  if (zoneText === undefined) {
    const wall = new Date(day + clock);
    const local = new Date(0);
    local.setFullYear(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
    local.setHours(wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds());
    return local;
  }
  const offset = parseZone(zoneText);
  return Number.isNaN(offset) ? invalid : new Date(day + clock + offset);
};

// ---------------------------------------------------------------- locale names

type Width = "abbreviated" | "wide" | "narrow" | "short";
type Context = "formatting" | "standalone";
type OrdinalUnit = "year" | "quarter" | "month" | "week" | "date" | "dayOfYear" | "day" | "hour" | "minute" | "second";
type DayPeriod = "am" | "pm" | "midnight" | "noon" | "morning" | "afternoon" | "evening" | "night";

interface FormatPart {
  isToken: boolean;
  value: string;
}

interface Names {
  era(era: 0 | 1, width: Width): string;
  quarter(quarter: number, width: Width, context: Context): string;
  month(month: number, width: Width, context: Context): string;
  day(day: number, width: Width, context: Context): string;
  dayPeriod(period: DayPeriod, width: Width, context: Context): string;
  ordinalNumber(value: number, unit: OrdinalUnit): string;
  long?(kind: "date" | "time" | "dateTime", width: "full" | "long" | "medium" | "short"): string;
  preprocessor?(date: Date, parts: FormatPart[]): FormatPart[];
  weekStartsOn?: number;
  firstWeekContainsDate?: number;
}

/** The subset of a date-fns `Locale` that is read; pass one from `date-fns/locale` to format in that language. */
export interface DateFnsLikeLocale {
  code?: string;
  localize?: {
    preprocessor?(date: Date, parts: FormatPart[]): FormatPart[];
    era(era: 0 | 1, options?: object): string;
    quarter(quarter: number, options?: object): string;
    month(month: number, options?: object): string;
    day(day: number, options?: object): string;
    dayPeriod(period: string, options?: object): string;
    ordinalNumber(value: number, options?: object): string;
  };
  formatLong?: {
    date(options: { width: string }): string;
    time(options: { width: string }): string;
    dateTime(options: { width: string }): string;
  };
  options?: { weekStartsOn?: number; firstWeekContainsDate?: number };
}

export type FormatLocale = string | Intl.Locale | DateFnsLikeLocale;

const EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const EN_PERIODS: Record<DayPeriod, [string, string, string, string]> = {
  am: ["AM", "a.m.", "a", "am"],
  pm: ["PM", "p.m.", "p", "pm"],
  midnight: ["midnight", "midnight", "mi", "midnight"],
  noon: ["noon", "noon", "n", "noon"],
  morning: ["in the morning", "in the morning", "in the morning", "in the morning"],
  afternoon: ["in the afternoon", "in the afternoon", "in the afternoon", "in the afternoon"],
  evening: ["in the evening", "in the evening", "in the evening", "in the evening"],
  night: ["at night", "at night", "at night", "at night"],
};
const EN_LONG_DATE = { full: "EEEE, MMMM do, y", long: "MMMM do, y", medium: "MMM d, y", short: "MM/dd/yyyy" };
const EN_LONG_TIME = { full: "h:mm:ss a zzzz", long: "h:mm:ss a z", medium: "h:mm:ss a", short: "h:mm a" };
const EN_LONG_DATE_TIME = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}",
};

const sliceName = (name: string, width: Width): string =>
  width === "narrow" ? name[0] : width === "short" ? name.slice(0, 2) : width === "abbreviated" ? name.slice(0, 3) : name;

const englishOrdinal = (value: number): string => {
  const rest = value % 100;
  if (rest > 20 || rest < 10) {
    if (rest % 10 === 1) return `${value}st`;
    if (rest % 10 === 2) return `${value}nd`;
    if (rest % 10 === 3) return `${value}rd`;
  }
  return `${value}th`;
};

const englishNames: Names = {
  era: (era, width) => (width === "wide" ? ["Before Christ", "Anno Domini"][era] : width === "narrow" ? ["B", "A"][era] : ["BC", "AD"][era]),
  quarter: (quarter, width) => (width === "wide" ? `${englishOrdinal(quarter)} quarter` : width === "narrow" ? String(quarter) : `Q${quarter}`),
  month: (month, width) => (width === "narrow" ? EN_MONTHS[month][0] : width === "wide" ? EN_MONTHS[month] : EN_MONTHS[month].slice(0, 3)),
  day: (day, width) => sliceName(EN_DAYS[day], width),
  dayPeriod: (period, width) => EN_PERIODS[period][width === "abbreviated" || width === "short" ? 0 : width === "wide" ? 1 : 2],
  ordinalNumber: (value) => englishOrdinal(value),
  long: (kind, width) => (kind === "date" ? EN_LONG_DATE : kind === "time" ? EN_LONG_TIME : EN_LONG_DATE_TIME)[width],
  weekStartsOn: 0,
  firstWeekContainsDate: 1,
};

const intlName = (locale: string | Intl.Locale, options: Intl.DateTimeFormatOptions, date: Date, type: Intl.DateTimeFormatPartTypes): string => {
  const part = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).formatToParts(date).find((p) => p.type === type);
  return part ? part.value : "";
};

const intlNames = (locale: string | Intl.Locale): Names => {
  const intlWidth = (width: Width): "long" | "short" | "narrow" => (width === "wide" ? "long" : width === "narrow" ? "narrow" : "short");
  let weekInfo: { firstDay?: number; minimalDays?: number } | undefined;
  try {
    const resolved = typeof locale === "string" ? new Intl.Locale(locale) : locale;
    const info = (resolved as unknown as { getWeekInfo?(): typeof weekInfo; weekInfo?: typeof weekInfo });
    weekInfo = typeof info.getWeekInfo === "function" ? info.getWeekInfo() : info.weekInfo;
  } catch {
    weekInfo = undefined;
  }
  return {
    era: (era, width) => intlName(locale, { era: intlWidth(width) }, new Date(Date.UTC(era ? 2000 : -2000, 0, 1)), "era"),
    quarter: englishNames.quarter,
    month: (month, width, context) =>
      intlName(locale, context === "standalone" ? { month: intlWidth(width) } : { month: intlWidth(width), day: "numeric" }, new Date(Date.UTC(2000, month, 15)), "month"),
    day: (day, width) => {
      const name = intlName(locale, { weekday: width === "short" ? "short" : intlWidth(width) }, new Date(Date.UTC(2000, 0, 2 + day)), "weekday");
      return width === "short" ? name.slice(0, 2) : name;
    },
    dayPeriod: (period, width) =>
      period === "am" || period === "pm"
        ? intlName(locale, { hour: "numeric", hour12: true }, new Date(Date.UTC(2000, 0, 1, period === "am" ? 1 : 13)), "dayPeriod")
        : englishNames.dayPeriod(period, width, "formatting"),
    ordinalNumber: (value) => String(value),
    weekStartsOn: weekInfo?.firstDay === undefined ? undefined : weekInfo.firstDay % 7,
    firstWeekContainsDate: weekInfo?.minimalDays,
  };
};

const adaptDateFns = (locale: DateFnsLikeLocale): Names => {
  const { localize, formatLong, options } = locale;
  if (!localize) return locale.code ? intlNames(locale.code) : englishNames;
  return {
    era: (era, width) => localize.era(era, { width }),
    quarter: (quarter, width, context) => localize.quarter(quarter, { width, context }),
    month: (month, width, context) => localize.month(month, { width, context }),
    day: (day, width, context) => localize.day(day, { width, context }),
    dayPeriod: (period, width, context) => localize.dayPeriod(period, { width, context }),
    ordinalNumber: (value, ordinalUnit) => localize.ordinalNumber(value, { unit: ordinalUnit }),
    long: formatLong ? (kind, width) => formatLong[kind]({ width }) : undefined,
    preprocessor: localize.preprocessor,
    weekStartsOn: options?.weekStartsOn,
    firstWeekContainsDate: options?.firstWeekContainsDate,
  };
};

const resolveNames = (locale: FormatLocale | undefined): Names => {
  if (locale === undefined) return englishNames;
  if (typeof locale === "string") return /^en(?:-US)?$/i.test(locale) ? englishNames : intlNames(locale);
  if (typeof Intl.Locale === "function" && locale instanceof Intl.Locale) return intlNames(locale);
  return adaptDateFns(locale as DateFnsLikeLocale);
};

// ---------------------------------------------------------------- formatting

/** Calendar fields of an instant as seen from one zone. */
export interface Fields {
  year: number;
  month: number;
  date: number;
  hours: number;
  minutes: number;
  seconds: number;
  ms: number;
  weekday: number;
  /** Minutes to add to local time to get UTC (positive west of Greenwich), like `Date#getTimezoneOffset`. */
  offset: number;
  time: number;
}

/** Fields in the runtime's local zone. */
export const localFields = (date: Date): Fields => ({
  year: date.getFullYear(),
  month: date.getMonth(),
  date: date.getDate(),
  hours: date.getHours(),
  minutes: date.getMinutes(),
  seconds: date.getSeconds(),
  ms: date.getMilliseconds(),
  weekday: date.getDay(),
  offset: date.getTimezoneOffset(),
  time: date.getTime(),
});

/** Fields of the instant `date` when a zone is `offsetSeconds` ahead of UTC. */
export const shiftedFields = (date: Date, offsetSeconds: number): Fields => {
  const shifted = new Date(date.getTime() + offsetSeconds * 1000);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    date: shifted.getUTCDate(),
    hours: shifted.getUTCHours(),
    minutes: shifted.getUTCMinutes(),
    seconds: shifted.getUTCSeconds(),
    ms: shifted.getUTCMilliseconds(),
    weekday: shifted.getUTCDay(),
    offset: -offsetSeconds / 60,
    time: date.getTime(),
  };
};

export interface TokenFormatOptions {
  /** 0 = Sunday ... 6 = Saturday. Default follows the locale (Sunday for English). */
  weekStartsOn?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Day of January that always falls in week 1 (1 to 7). Default follows the locale (1 for English). */
  firstWeekContainsDate?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  /** Allow the week-year tokens `YY`/`YYYY`, which are a common mistake for `yy`/`yyyy`. */
  useAdditionalWeekYearTokens?: boolean;
  /** Allow the day-of-year tokens `D`/`DD`, which are a common mistake for `d`/`dd`. */
  useAdditionalDayOfYearTokens?: boolean;
}

const pad = (value: number, length: number): string => {
  const text = Math.abs(value).toString().padStart(length, "0");
  return value < 0 ? `-${text}` : text;
};

const zoneShort = (offset: number, delimiter: string): string => {
  const sign = offset > 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  const hours = Math.trunc(absolute / 60);
  const minutes = absolute % 60;
  return minutes === 0 ? sign + hours : sign + hours + delimiter + pad(minutes, 2);
};

const zoneFull = (offset: number, delimiter: string): string => {
  const sign = offset > 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  return sign + pad(Math.trunc(absolute / 60), 2) + delimiter + pad(absolute % 60, 2);
};

const zoneOptionalMinutes = (offset: number, delimiter: string): string =>
  offset % 60 === 0 ? (offset > 0 ? "-" : "+") + pad(Math.abs(offset) / 60, 2) : zoneFull(offset, delimiter);

/** Consume each pattern character once, including escaped and unterminated quoted literals. */
const tokenize = (pattern: string, long: boolean): string[] => {
  const pieces: string[] = [];
  let at = 0;
  while (at < pattern.length) {
    const start = at++;
    const letter = pattern[start];
    if (letter === "'") {
      if (pattern[at] === "'") at++;
      else {
        while (at < pattern.length) {
          if (pattern[at++] !== "'") continue;
          if (pattern[at] === "'") at++;
          else break;
        }
      }
    } else if (long && (letter === "P" || letter === "p")) {
      while (pattern[at] === letter) at++;
      if (letter === "P") while (pattern[at] === "p") at++;
    } else if (!long && "yYQqMLwIdDecihHKkms".includes(letter) && pattern[at] === "o") {
      at++;
    } else if (!long && /\w/.test(letter)) {
      while (pattern[at] === letter) at++;
    } else if (/^[\r\n\u2028\u2029]$/.test(letter)) {
      // The previous dot fallback ignored line terminators outside quoted literals.
      continue;
    }
    pieces.push(pattern.slice(start, at));
  }
  return pieces;
};
const TOKEN_LETTERS = "GyYuRQqMLwIdDEeciabBhHKkmsSXxOztT";
const LETTER_RE = /[a-zA-Z]/;

const unquote = (text: string): string => text.slice(1, text.endsWith("'") ? -1 : undefined).replace(/''/g, "'");

const expandLong = (token: string, names: Names): string => {
  const widths = ["short", "medium", "long", "full"] as const;
  const pick = (count: number): (typeof widths)[number] => widths[Math.min(count, 4) - 1];
  const long = names.long ?? englishNames.long!;
  if (token[0] === "p") return long("time", pick(token.length));
  const timeStart = token.indexOf("p");
  if (timeStart === -1) return long("date", pick(token.length));
  return long("dateTime", pick(timeStart))
    .replace("{{date}}", long("date", pick(timeStart)))
    .replace("{{time}}", long("time", pick(token.length - timeStart)));
};

/**
 * Format `fields` with a date-fns style pattern. Characters between single quotes are literal
 * (`''` is a quote); an unquoted letter that is not a token throws a RangeError, as does an invalid pattern.
 */
export const formatTokens = (fields: Fields, pattern: string, locale?: FormatLocale, options: TokenFormatOptions = {}): string => {
  if (typeof pattern !== "string") throw new TypeError("format must be a string");
  const names = resolveNames(locale);
  const weekStartsOn = options.weekStartsOn ?? names.weekStartsOn ?? 0;
  const firstWeekContainsDate = options.firstWeekContainsDate ?? names.firstWeekContainsDate ?? 1;
  if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) throw new RangeError("weekStartsOn must be between 0 and 6 inclusively");
  if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
    throw new RangeError("firstWeekContainsDate must be between 1 and 7 inclusively");
  }

  const expanded = tokenize(pattern, true)
    .map((piece) => (piece[0] === "P" || piece[0] === "p" ? expandLong(piece, names) : piece))
    .join("");

  const { year: signedYear, month, date, hours, minutes, seconds, ms, weekday, offset } = fields;
  const epoch = epochDay(signedYear, month, date);
  const eraYear = signedYear > 0 ? signedYear : 1 - signedYear;
  const hour12 = hours % 12;
  const localWeekday = (weekday - weekStartsOn + 8) % 7 || 7;
  const ordinal = (value: number, ordinalUnit: OrdinalUnit): string => names.ordinalNumber(value, ordinalUnit);
  const dayPeriodOf = (kind: "ampm" | "noon" | "flexible"): DayPeriod => {
    if (kind === "ampm") return hours / 12 >= 1 ? "pm" : "am";
    if (kind === "noon") return hours === 12 ? "noon" : hours === 0 ? "midnight" : hours / 12 >= 1 ? "pm" : "am";
    return hours >= 17 ? "evening" : hours >= 12 ? "afternoon" : hours >= 4 ? "morning" : "night";
  };
  // Runs longer than the documented tokens fall back to the wide form, like date-fns.
  const widthOf = (length: number, short = false): Width =>
    length <= 3 ? "abbreviated" : length === 5 ? "narrow" : length === 6 && short ? "short" : "wide";

  const render = (token: string): string => {
    const letter = token[0];
    const length = token.length;
    const ordinalToken = token[1] === "o" && length === 2;
    switch (letter) {
      case "G":
        return names.era(signedYear > 0 ? 1 : 0, widthOf(length));
      case "y":
        return ordinalToken ? ordinal(eraYear, "year") : pad(token === "yy" ? eraYear % 100 : eraYear, length);
      case "Y": {
        const weekYear = weekYearOf(signedYear, epoch, weekStartsOn, firstWeekContainsDate);
        const eraWeekYear = weekYear > 0 ? weekYear : 1 - weekYear;
        if (token === "YY") return pad(eraWeekYear % 100, 2);
        return ordinalToken ? ordinal(eraWeekYear, "year") : pad(eraWeekYear, length);
      }
      case "R":
        return pad(weekYearOf(signedYear, epoch, 1, 4), length);
      case "u":
        return pad(signedYear, length);
      case "Q":
      case "q": {
        const quarter = Math.ceil((month + 1) / 3);
        if (ordinalToken) return ordinal(quarter, "quarter");
        if (length <= 2) return pad(quarter, length);
        return names.quarter(quarter, widthOf(length), letter === "Q" ? "formatting" : "standalone");
      }
      case "M":
      case "L":
        if (ordinalToken) return ordinal(month + 1, "month");
        if (length <= 2) return pad(month + 1, length);
        return names.month(month, widthOf(length), letter === "M" ? "formatting" : "standalone");
      case "w": {
        const week = weekOf(signedYear, epoch, weekStartsOn, firstWeekContainsDate);
        return ordinalToken ? ordinal(week, "week") : pad(week, length);
      }
      case "I": {
        const week = weekOf(signedYear, epoch, 1, 4);
        return ordinalToken ? ordinal(week, "week") : pad(week, length);
      }
      case "d":
        return ordinalToken ? ordinal(date, "date") : pad(date, length);
      case "D": {
        const dayOfYear = epoch - epochDay(signedYear, 0, 1) + 1;
        return ordinalToken ? ordinal(dayOfYear, "dayOfYear") : pad(dayOfYear, length);
      }
      case "E":
        return names.day(weekday, widthOf(length, true), "formatting");
      case "i": {
        const isoWeekday = weekday === 0 ? 7 : weekday;
        if (ordinalToken) return ordinal(isoWeekday, "day");
        if (length <= 2) return pad(isoWeekday, length);
        return names.day(weekday, widthOf(length, true), "formatting");
      }
      case "e":
      case "c":
        if (ordinalToken) return ordinal(localWeekday, "day");
        if (length <= 2) return pad(localWeekday, length);
        return names.day(weekday, widthOf(length, true), letter === "e" ? "formatting" : "standalone");
      case "a": {
        const period = dayPeriodOf("ampm");
        if (length <= 2) return names.dayPeriod(period, "abbreviated", "formatting");
        if (length === 3) return names.dayPeriod(period, "abbreviated", "formatting").toLowerCase();
        return names.dayPeriod(period, length === 5 ? "narrow" : "wide", "formatting");
      }
      case "b": {
        const period = dayPeriodOf("noon");
        if (length <= 2) return names.dayPeriod(period, "abbreviated", "formatting");
        if (length === 3) return names.dayPeriod(period, "abbreviated", "formatting").toLowerCase();
        return names.dayPeriod(period, length === 5 ? "narrow" : "wide", "formatting");
      }
      case "B":
        return names.dayPeriod(dayPeriodOf("flexible"), widthOf(length), "formatting");
      case "h":
        return ordinalToken ? ordinal(hour12 || 12, "hour") : pad(hour12 || 12, length);
      case "H":
        return ordinalToken ? ordinal(hours, "hour") : pad(hours, length);
      case "K":
        return ordinalToken ? ordinal(hour12, "hour") : pad(hour12, length);
      case "k":
        return ordinalToken ? ordinal(hours === 0 ? 24 : hours, "hour") : pad(hours === 0 ? 24 : hours, length);
      case "m":
        return ordinalToken ? ordinal(minutes, "minute") : pad(minutes, length);
      case "s":
        return ordinalToken ? ordinal(seconds, "second") : pad(seconds, length);
      case "S":
        return pad(Math.trunc(ms * Math.pow(10, length - 3)), length);
      case "X":
        if (offset === 0) return "Z";
        return length === 1 ? zoneOptionalMinutes(offset, "") : length === 2 || length === 4 ? zoneFull(offset, "") : zoneFull(offset, ":");
      case "x":
        return length === 1 ? zoneOptionalMinutes(offset, "") : length === 2 || length === 4 ? zoneFull(offset, "") : zoneFull(offset, ":");
      case "O":
      case "z":
        return "GMT" + (length >= 4 ? zoneFull(offset, ":") : zoneShort(offset, ":"));
      case "t":
        return pad(Math.trunc(fields.time / 1000), length);
      case "T":
        return pad(fields.time, length);
      default:
        throw new RangeError(`Format string contains an unescaped latin alphabet character \`${letter}\``);
    }
  };

  let parts: FormatPart[] = tokenize(expanded, false).map((piece) => {
    if (piece === "''") return { isToken: false, value: "'" };
    if (piece[0] === "'") return { isToken: false, value: unquote(piece) };
    if (TOKEN_LETTERS.includes(piece[0])) return { isToken: true, value: piece };
    if (LETTER_RE.test(piece[0])) throw new RangeError(`Format string contains an unescaped latin alphabet character \`${piece[0]}\``);
    return { isToken: false, value: piece };
  });
  if (names.preprocessor) {
    const wall = new Date(0);
    wall.setFullYear(signedYear, month, date);
    wall.setHours(hours, minutes, seconds, ms);
    parts = names.preprocessor(wall, parts);
  }
  return parts
    .map(({ isToken, value }) => {
      if (!isToken) return value;
      if (!options.useAdditionalWeekYearTokens && (value === "YY" || value === "YYYY")) {
        throw new RangeError(`Use \`${value.toLowerCase()}\` instead of \`${value}\` (in \`${pattern}\`) for formatting years; pass useAdditionalWeekYearTokens to allow it`);
      }
      if (!options.useAdditionalDayOfYearTokens && (value === "D" || value === "DD")) {
        throw new RangeError(`Use \`${value.toLowerCase()}\` instead of \`${value}\` (in \`${pattern}\`) for formatting days of the month; pass useAdditionalDayOfYearTokens to allow it`);
      }
      return render(value);
    })
    .join("");
};
