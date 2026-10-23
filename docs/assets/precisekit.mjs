// src/utils/errors.ts
var NumericTypeError = class extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = "NumericTypeError";
    this.code = code;
  }
};
var NumericRangeError = class extends RangeError {
  constructor(code, message) {
    super(message);
    this.name = "NumericRangeError";
    this.code = code;
  }
};

// src/utils/validate.ts
var describeValue = (value) => {
  try {
    if (typeof value === "string") {
      const shown = value.length > 40 ? `${value.slice(0, 37)}...` : value;
      return JSON.stringify(shown);
    }
    if (typeof value === "bigint") return `${value}n`;
    if (typeof value === "object" && value !== null) return Array.isArray(value) ? "an array" : "an object";
    return String(value);
  } catch {
    return `a value of type ${typeof value}`;
  }
};
var assertFiniteNumber = (value, name) => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new NumericTypeError(
      "ERR_INVALID_NUMBER",
      `${name} must be a finite number, received ${describeValue(value)}`
    );
  }
};
var assertInteger = (value, name) => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new NumericTypeError(
      "ERR_NOT_INTEGER",
      `${name} must be an integer, received ${describeValue(value)}`
    );
  }
};
var assertArray = (value, name) => {
  if (!Array.isArray(value)) {
    throw new TypeError(`${name} must be an array, received ${describeValue(value)}`);
  }
};
var assertFunction = (value, name) => {
  if (typeof value !== "function") {
    throw new TypeError(`${name} must be a function, received ${describeValue(value)}`);
  }
};
var assertObject = (value, name) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`${name} must be an object, received ${describeValue(value)}`);
  }
};

// src/utils/compare.ts
var defaultCompare = (a, b) => {
  if (a < b) return -1;
  if (a > b) return 1;
  if (typeof a === "number" && Number.isNaN(a) || typeof b === "number" && Number.isNaN(b)) {
    throw new NumericTypeError(
      "ERR_INVALID_NUMBER",
      "Cannot order NaN; remove it from the array or pass a compareFn"
    );
  }
  return 0;
};

// src/utils/decimal.ts
var MAX_EXPONENT = 3e5;
var ROUND_UP = 0;
var ROUND_DOWN = 1;
var ROUND_CEIL = 2;
var ROUND_FLOOR = 3;
var ROUND_HALF_UP = 4;
var ROUND_HALF_DOWN = 5;
var ROUND_HALF_EVEN = 6;
var SMALL_POWERS = [];
for (let i = 0, p = 1n; i <= 64; i++, p *= 10n) SMALL_POWERS.push(p);
var pow10 = (n) => n < SMALL_POWERS.length ? SMALL_POWERS[n] : 10n ** BigInt(n);
var CHUNK = 2048;
var CHUNK_POWERS = [10n ** BigInt(CHUNK)];
var chunkPower = (level) => CHUNK_POWERS[level] ?? (CHUNK_POWERS[level] = chunkPower(level - 1) ** 2n);
var paddedDigits = (n, level) => {
  if (level === 0) return n.toString().padStart(CHUNK, "0");
  const half = chunkPower(level - 1);
  const high = n / half;
  return paddedDigits(high, level - 1) + paddedDigits(n - high * half, level - 1);
};
var digitsOf = (n) => {
  if (n < CHUNK_POWERS[0]) return n.toString();
  const bound = Math.ceil(n.toString(16).length * 4 * Math.LOG10E * Math.LN2) + 1;
  let level = 1;
  while (CHUNK << level < bound) level++;
  return paddedDigits(n, level).replace(/^0+/, "");
};
var parseDigits = (digits) => {
  if (digits.length <= CHUNK) return BigInt(digits);
  let level = 0;
  while (CHUNK << level + 1 < digits.length) level++;
  const split = digits.length - (CHUNK << level);
  return parseDigits(digits.slice(0, split)) * chunkPower(level) + parseDigits(digits.slice(split));
};
var MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);
var digitCount = (n) => n <= MAX_SAFE ? String(Number(n)).length : digitsOf(n).length;
var divRound = (n, d, negative, mode) => {
  const q = n / d;
  const r = n - q * d;
  if (r === 0n) return q;
  switch (mode) {
    case ROUND_UP:
      return q + 1n;
    case ROUND_DOWN:
      return q;
    case ROUND_CEIL:
      return negative ? q : q + 1n;
    case ROUND_FLOOR:
      return negative ? q + 1n : q;
    default: {
      const twice = r * 2n;
      if (twice > d) return q + 1n;
      if (twice < d) return q;
      if (mode === ROUND_HALF_UP) return q + 1n;
      if (mode === ROUND_HALF_DOWN) return q;
      return q % 2n === 1n ? q + 1n : q;
    }
  }
};
var NUMBER_PATTERN = /^([+-]?)(\d*)(?:\.(\d*))?(?:[eE]([+-]?\d+))?$/;
var Decimal = class _Decimal {
  constructor(value) {
    /** @internal magnitude, always >= 0 */
    this.c = 0n;
    /** @internal power-of-ten exponent applied to `c` */
    this.x = 0;
    /** @internal sign; true for negatives and for -0 */
    this.neg = false;
    /** @internal false for the result of an overflow or an undefined operation */
    this.fin = true;
    if (value instanceof _Decimal) {
      this.c = value.c;
      this.x = value.x;
      this.neg = value.neg;
      this.fin = value.fin;
      return;
    }
    if (typeof value === "bigint") {
      this.neg = value < 0n;
      this.c = this.neg ? -value : value;
      this.settle();
      return;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        this.fin = false;
        this.neg = value < 0;
        return;
      }
      if (value === 0) {
        this.neg = Object.is(value, -0);
        return;
      }
      value = String(value);
    }
    const match = NUMBER_PATTERN.exec(value);
    if (!match || match[2] === "" && !match[3]) throw new SyntaxError(`Invalid decimal: ${String(value).slice(0, 40)}`);
    const [, sign2, whole, fraction = "", exponent] = match;
    this.neg = sign2 === "-";
    let digits = whole + fraction;
    let exp = (exponent === void 0 ? 0 : Number(exponent)) - fraction.length;
    let end = digits.length;
    while (end > 1 && digits.charCodeAt(end - 1) === 48) end--;
    exp += digits.length - end;
    digits = digits.slice(0, end);
    this.c = parseDigits(digits);
    this.x = exp;
    this.settle();
  }
  /** Apply the overflow/underflow limits and normalize zero. */
  settle() {
    if (this.c === 0n) {
      this.x = 0;
      return;
    }
    const e = this.e;
    if (e > MAX_EXPONENT) {
      this.fin = false;
      this.c = 0n;
      this.x = 0;
    } else if (e < -MAX_EXPONENT) {
      this.c = 0n;
      this.x = 0;
    }
  }
  /** @internal build from parts, without parsing */
  static from(neg, c, x) {
    const result = new _Decimal(0);
    result.neg = neg;
    result.c = c;
    result.x = x;
    result.settle();
    return result;
  }
  /** @internal */
  static nonFinite(neg) {
    const result = new _Decimal(0);
    result.fin = false;
    result.neg = neg;
    return result;
  }
  /** Exponent of the leading digit: 1 -> 0, 1234 -> 3, 0.012 -> -2. Zero reports 0. */
  get e() {
    if (this.c === 0n) return 0;
    return this.exponentCache ?? (this.exponentCache = digitCount(this.c) - 1 + this.x);
  }
  /** @internal same value without trailing zeros in the coefficient (cached) */
  trimmed() {
    if (this.trimmedCache) return this.trimmedCache;
    let end = 0;
    let digits = "";
    if (this.fin && this.c !== 0n && this.c % 10n === 0n) {
      digits = digitsOf(this.c);
      end = digits.length;
      while (digits.charCodeAt(end - 1) === 48) end--;
    }
    if (end === 0) return this.trimmedCache = this;
    const result = new _Decimal(0);
    result.neg = this.neg;
    result.c = parseDigits(digits.slice(0, end));
    result.x = this.x + digits.length - end;
    return this.trimmedCache = result;
  }
  /** @internal significant digits of the magnitude, without trailing zeros */
  digits() {
    return digitsOf(this.trimmed().c);
  }
  isFinite() {
    return this.fin;
  }
  isZero() {
    return this.fin && this.c === 0n;
  }
  /** True for negative values and for -0, like Math.sign's sign bit. */
  isNeg() {
    return this.neg;
  }
  isInteger() {
    if (!this.fin) return false;
    if (this.c === 0n) return true;
    return this.trimmed().x >= 0;
  }
  /** Number of digits after the decimal point once trailing zeros are dropped. */
  decimalPlaces() {
    if (!this.fin || this.c === 0n) return 0;
    const { x } = this.trimmed();
    return x < 0 ? -x : 0;
  }
  abs() {
    if (!this.neg) return this;
    return this.fin ? _Decimal.from(false, this.c, this.x) : _Decimal.nonFinite(false);
  }
  negated() {
    return this.fin ? _Decimal.from(!this.neg, this.c, this.x) : _Decimal.nonFinite(!this.neg);
  }
  /** Magnitudes aligned to the smaller exponent. */
  static align(a, b) {
    if (a.x === b.x) return [a.c, b.c, a.x];
    if (a.x > b.x) return [a.c * pow10(a.x - b.x), b.c, b.x];
    return [a.c, b.c * pow10(b.x - a.x), a.x];
  }
  add(other) {
    const o = new _Decimal(other);
    if (!this.fin || !o.fin) return _Decimal.nonFinite(this.neg);
    if (o.c === 0n) {
      if (this.c !== 0n) return this;
      return this.neg && o.neg ? this : new _Decimal(0);
    }
    if (this.c === 0n) return o;
    const [a, b, x] = _Decimal.align(this, o);
    const sum = (this.neg ? -a : a) + (o.neg ? -b : b);
    if (sum === 0n) return new _Decimal(0);
    return _Decimal.from(sum < 0n, sum < 0n ? -sum : sum, x);
  }
  sub(other) {
    return this.add(new _Decimal(other).negated());
  }
  mul(other) {
    const o = new _Decimal(other);
    if (!this.fin || !o.fin) return _Decimal.nonFinite(this.neg !== o.neg);
    return _Decimal.from(this.neg !== o.neg, this.c * o.c, this.x + o.x);
  }
  /**
   * Quotient rounded to `precision` significant digits in `mode`; exact quotients stay exact.
   * Dividing by zero yields a non-finite value.
   */
  div(other, precision, mode = ROUND_HALF_UP) {
    const o = new _Decimal(other);
    const negative = this.neg !== o.neg;
    if (!this.fin || !o.fin || o.c === 0n) return _Decimal.nonFinite(negative);
    if (this.c === 0n) return _Decimal.from(negative, 0n, 0);
    const shift = precision + 1 + digitCount(o.c) - digitCount(this.c);
    const numerator = shift > 0 ? this.c * pow10(shift) : this.c;
    const denominator = shift < 0 ? o.c * pow10(-shift) : o.c;
    const quotient = numerator / denominator;
    const exact = quotient * denominator === numerator;
    const drop2 = digitCount(quotient) - precision;
    const unit2 = pow10(drop2);
    let kept = quotient / unit2;
    const rest = quotient - kept * unit2;
    if (rest !== 0n || !exact) {
      const twice = rest * 2n;
      const up = mode === ROUND_UP ? true : mode === ROUND_DOWN ? false : mode === ROUND_CEIL ? !negative : mode === ROUND_FLOOR ? negative : twice > unit2 || twice === unit2 && (!exact || mode === ROUND_HALF_UP || mode === ROUND_HALF_EVEN && kept % 2n === 1n);
      if (up) kept += 1n;
    }
    return _Decimal.from(negative, kept, this.x - o.x - shift + drop2);
  }
  /** Remainder with the sign of the dividend (truncated division), exact. Zero divisor yields a non-finite value. */
  mod(other) {
    const o = new _Decimal(other);
    if (!this.fin || !o.fin || o.c === 0n) return _Decimal.nonFinite(this.neg);
    if (this.c === 0n) return this;
    const [a, b, x] = _Decimal.align(this, o);
    const remainder = a % b;
    return _Decimal.from(this.neg, remainder, x);
  }
  /**
   * Integer power. Without `precision` the result is exact (and the exponent must not be negative).
   * With it, a result needing more than `precision` significant digits is correctly rounded half-up.
   */
  pow(exponent, precision) {
    if (!Number.isInteger(exponent)) throw new RangeError("pow exponent must be an integer");
    if (precision === void 0 && exponent < 0) throw new RangeError("pow needs a precision for a negative exponent");
    if (!this.fin) return _Decimal.nonFinite(this.neg);
    const negative = this.neg && exponent % 2 !== 0;
    if (exponent === 0) return new _Decimal(1);
    if (this.c === 0n) return exponent < 0 ? _Decimal.nonFinite(negative) : _Decimal.from(negative, 0n, 0);
    const base = this.trimmed();
    const times = Math.abs(exponent);
    if (precision === void 0) return _Decimal.from(negative, base.c ** BigInt(times), base.x * times);
    return powRounded(base, times, exponent < 0, negative, precision);
  }
  cmp(other) {
    const o = new _Decimal(other);
    if (!this.fin || !o.fin) {
      if (this.fin) return o.neg ? 1 : -1;
      if (o.fin) return this.neg ? -1 : 1;
      return this.neg === o.neg ? 0 : this.neg ? -1 : 1;
    }
    const zeroA = this.c === 0n;
    const zeroB = o.c === 0n;
    if (zeroA && zeroB) return 0;
    if (zeroA) return o.neg ? 1 : -1;
    if (zeroB) return this.neg ? -1 : 1;
    if (this.neg !== o.neg) return this.neg ? -1 : 1;
    const flip = this.neg ? -1 : 1;
    const ea = this.e;
    const eb = o.e;
    if (ea !== eb) return ea > eb ? flip : -flip;
    const [a, b] = _Decimal.align(this, o);
    return a === b ? 0 : a > b ? flip : -flip;
  }
  eq(other) {
    return this.cmp(other) === 0;
  }
  gt(other) {
    return this.cmp(other) === 1;
  }
  gte(other) {
    return this.cmp(other) >= 0;
  }
  lt(other) {
    return this.cmp(other) === -1;
  }
  lte(other) {
    return this.cmp(other) <= 0;
  }
  /** Round to `places` digits after the decimal point in `mode` (default half-up). */
  toDecimalPlaces(places, mode = ROUND_HALF_UP) {
    if (!this.fin || this.c === 0n) return this;
    const drop2 = -places - this.x;
    if (drop2 <= 0) return this;
    const digits = digitCount(this.c);
    let rounded2;
    if (drop2 > digits + 1) {
      rounded2 = mode === ROUND_UP || mode === ROUND_CEIL && !this.neg || mode === ROUND_FLOOR && this.neg ? 1n : 0n;
    } else {
      rounded2 = divRound(this.c, pow10(drop2), this.neg, mode);
    }
    return _Decimal.from(this.neg, rounded2, this.x + drop2);
  }
  floor() {
    return this.toDecimalPlaces(0, ROUND_FLOOR);
  }
  ceil() {
    return this.toDecimalPlaces(0, ROUND_CEIL);
  }
  /** Integer value as a bigint; a fraction is truncated toward zero. Throws for non-finite values. */
  toBigInt() {
    if (!this.fin) throw new RangeError("Cannot convert a non-finite value to bigint");
    if (this.c === 0n) return 0n;
    const { c, x } = this.trimmed();
    const magnitude = x >= 0 ? c * pow10(x) : c / pow10(-x);
    return this.neg ? -magnitude : magnitude;
  }
  /** Plain decimal notation, never an exponent. Zero prints as "0" whatever its sign. */
  toFixed() {
    if (!this.fin) return this.neg ? "-Infinity" : "Infinity";
    if (this.c === 0n) return "0";
    const sign2 = this.neg ? "-" : "";
    const { c, x } = this.trimmed();
    const digits = digitsOf(c);
    if (x >= 0) return sign2 + digits + "0".repeat(x);
    const point = digits.length + x;
    if (point > 0) return `${sign2}${digits.slice(0, point)}.${digits.slice(point)}`;
    return `${sign2}0.${"0".repeat(-point)}${digits}`;
  }
  /** The nearest double, `-0` for negative zero, ±Infinity beyond the double range. */
  toNumber() {
    if (!this.fin) return this.neg ? -Infinity : Infinity;
    if (this.c === 0n) return this.neg ? -0 : 0;
    const { c, x } = this.trimmed();
    return Number(`${this.neg ? "-" : ""}${c}e${x}`);
  }
  toString() {
    return this.toFixed();
  }
};
var roundSignificant = (value, precision) => {
  const digits = digitCount(value.c);
  if (digits <= precision) return value;
  const drop2 = digits - precision;
  return Decimal.from(value.neg, divRound(value.c, pow10(drop2), value.neg, ROUND_HALF_UP), value.x + drop2);
};
var powRounded = (base, times, reciprocal, negative, precision) => {
  const one = new Decimal(1);
  const guard = String(times).length + 4;
  const errorFactor = BigInt(times) * 4n + 4n;
  for (let width = precision + guard; ; width *= 2) {
    let truncated = false;
    const shrink = (value) => {
      const exact = value.trimmed();
      const digits = digitCount(exact.c);
      if (digits <= width) return exact;
      truncated = true;
      const drop2 = digits - width;
      return Decimal.from(false, exact.c / pow10(drop2), exact.x + drop2);
    };
    let low = one;
    let square = Decimal.from(false, base.c, base.x);
    for (let n = times; n > 0; n = Math.floor(n / 2)) {
      if (n % 2 === 1) low = shrink(low.mul(square));
      if (n > 1) square = shrink(square.mul(square));
      if (!low.fin || !square.fin) return Decimal.nonFinite(negative);
    }
    const signed = (value) => Decimal.from(negative, value.c, value.x);
    if (!truncated) {
      if (!reciprocal) return signed(roundSignificant(low, precision));
      return signed(one.div(low, precision));
    }
    if (low.c === 0n) return reciprocal ? Decimal.nonFinite(negative) : signed(low);
    const high = Decimal.from(false, low.c + low.c * errorFactor / pow10(width - 1) + 2n, low.x);
    const lower = reciprocal ? one.div(high, precision) : roundSignificant(low, precision);
    const upper = reciprocal ? one.div(low, precision) : roundSignificant(high, precision);
    if (lower.cmp(upper) === 0 || width > precision * 8 + 400) return signed(lower);
  }
};

// src/utils/numeric.ts
var MAX_EXPONENT2 = MAX_EXPONENT;
var MAX_PRECISION = 1e4;
var DEFAULT_PRECISION = 40;
var MAX_DECIMALS = MAX_EXPONENT2;
var ExactDecimal = Decimal;
var NUMERIC_STRING = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
var MAX_STRING_LENGTH = 2 * MAX_EXPONENT2 + 100;
var maxBigInt;
var bigIntLimit = () => maxBigInt ?? (maxBigInt = 1n << 996578n);
var invalidNumber = (name, value) => new NumericTypeError(
  "ERR_INVALID_NUMBER",
  `${name} must be a finite number, bigint or numeric string, received ${describeValue(value)}`
);
var overflowError = (what) => new NumericRangeError(
  "ERR_OVERFLOW",
  `${what} exceeds the supported magnitude of about 1e${MAX_EXPONENT2}`
);
var underflowError = (what) => new NumericRangeError(
  "ERR_UNDERFLOW",
  `${what} is smaller than the supported magnitude of about 1e-${MAX_EXPONENT2}`
);
var divisionByZero = (what = "Division by zero") => new NumericRangeError("ERR_DIVISION_BY_ZERO", what);
var outOfRange = (message) => new NumericRangeError("ERR_OUT_OF_RANGE", message);
var guardBigInt = (operation, what = "Result") => {
  try {
    return operation();
  } catch (error2) {
    if (error2 instanceof RangeError && !(error2 instanceof NumericRangeError)) throw overflowError(what);
    throw error2;
  }
};
var checkBigInt = (value, what) => {
  const limit = bigIntLimit();
  if (value >= limit || value <= -limit) throw overflowError(what);
  return value;
};
var toDecimal = (value, name) => {
  switch (typeof value) {
    case "number":
      if (!Number.isFinite(value)) throw invalidNumber(name, value);
      return new Decimal(value);
    case "bigint":
      checkBigInt(value, name);
      return new Decimal(value);
    case "string": {
      if (!NUMERIC_STRING.test(value)) throw invalidNumber(name, value);
      if (value.length > MAX_STRING_LENGTH) throw overflowError(name);
      const decimal = guardBigInt(() => new Decimal(value), name);
      if (!decimal.isFinite()) throw overflowError(name);
      if (decimal.isZero() && /[1-9]/.test(value.split(/[eE]/, 1)[0])) throw underflowError(name);
      return decimal;
    }
    default:
      throw invalidNumber(name, value);
  }
};
var kindOf = (...values) => {
  if (values.every((v) => typeof v === "number")) return "number";
  if (values.every((v) => typeof v === "bigint")) return "bigint";
  return "string";
};
var decimalToNumber = (value) => {
  if (!value.isFinite()) throw overflowError("Result");
  const result = value.toNumber();
  if (!Number.isFinite(result)) {
    throw new NumericRangeError(
      "ERR_OVERFLOW",
      "Result exceeds the largest representable number (1.7976931348623157e+308); pass bigint or numeric-string arguments for an exact result"
    );
  }
  if (result === 0) {
    if (!value.isZero()) {
      throw new NumericRangeError(
        "ERR_UNDERFLOW",
        "Result is too small to represent as a number (below 5e-324); pass bigint or numeric-string arguments for an exact result"
      );
    }
    return 0;
  }
  return result;
};
var decimalToString = (value) => {
  if (!value.isFinite()) throw overflowError("Result");
  return value.isZero() ? "0" : value.toFixed();
};
var decimalToBigInt = (value) => {
  if (!value.isFinite()) throw overflowError("Result");
  return value.toBigInt();
};
var bigIntToDecimal = (value) => new Decimal(value);
var resolvePrecision = (precision) => {
  if (precision === void 0) return DEFAULT_PRECISION;
  if (typeof precision !== "number" || !Number.isInteger(precision)) {
    throw new NumericTypeError("ERR_NOT_INTEGER", `precision must be an integer, received ${describeValue(precision)}`);
  }
  if (precision < 1 || precision > MAX_PRECISION) {
    throw outOfRange(`precision must be between 1 and ${MAX_PRECISION}`);
  }
  return precision;
};
var log10Abs = (value) => {
  const digits = value.digits();
  return value.e + Math.log10(Number(`${digits[0]}.${digits.slice(1, 17)}`));
};
var divideDecimals = (a, b, precision) => {
  if (b.isZero()) throw divisionByZero();
  const result = a.div(b, precision);
  if (result.isZero() && !a.isZero()) throw underflowError("Result");
  return result;
};

// src/modules/math/aggregate.ts
var accumulate = (values) => {
  let fast = 0;
  let i = 0;
  for (; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) throw invalidNumber(`arr[${i}]`, v);
    if (Number.isSafeInteger(v) && Number.isSafeInteger(fast + v)) fast += v;
    else break;
  }
  if (i === values.length) return { fast };
  let exact = new ExactDecimal(fast);
  for (; i < values.length; i++) {
    const v = values[i];
    if (typeof v !== "number" || !Number.isFinite(v)) throw invalidNumber(`arr[${i}]`, v);
    exact = exact.add(v);
  }
  return { exact };
};
function sumValueInArray(arr) {
  assertArray(arr, "arr");
  const total = accumulate(arr);
  return "fast" in total ? total.fast : decimalToNumber(total.exact);
}
function averageValueInArray(arr, options = {}) {
  assertArray(arr, "arr");
  const precision = resolvePrecision(options.precision);
  if (arr.length === 0) return 0;
  const total = accumulate(arr);
  if ("fast" in total) {
    return total.fast % arr.length === 0 ? total.fast / arr.length : decimalToNumber(divideDecimals(new ExactDecimal(total.fast), new ExactDecimal(arr.length), precision));
  }
  return decimalToNumber(divideDecimals(total.exact, new ExactDecimal(arr.length), precision));
}
var parseAll = (values) => {
  assertArray(values, "values");
  return values.map((value, index) => toDecimal(value, `values[${index}]`));
};
var sumExact = (values) => {
  assertArray(values, "values");
  if (values.every((v) => typeof v === "bigint")) {
    let total2 = 0n;
    guardBigInt(() => {
      for (const v of values) total2 += checkBigInt(v, "values[]");
    });
    return bigIntToDecimal(checkBigInt(total2, "Result"));
  }
  let total = new ExactDecimal(0);
  values.forEach((value, index) => {
    total = total.add(toDecimal(value, `values[${index}]`));
  });
  return total;
};
function sumBig(values) {
  return decimalToString(sumExact(values));
}
function averageBig(values, options = {}) {
  const precision = resolvePrecision(options.precision);
  assertArray(values, "values");
  if (values.length === 0) return "0";
  return decimalToString(divideDecimals(sumExact(values), new ExactDecimal(values.length), precision));
}
function median(values) {
  assertArray(values, "values");
  if (values.length === 0) return 0;
  values.forEach((value, index) => {
    if (typeof value !== "number" || !Number.isFinite(value)) throw invalidNumber(`values[${index}]`, value);
  });
  const sorted = Float64Array.from(values).sort();
  const mid = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[mid] === 0 ? 0 : sorted[mid];
  return decimalToNumber(new ExactDecimal(sorted[mid - 1]).add(sorted[mid]).mul(0.5));
}
function medianBig(values) {
  const parsed = parseAll(values);
  if (parsed.length === 0) return "0";
  parsed.sort((a, b) => a.cmp(b));
  const mid = parsed.length >> 1;
  return decimalToString(parsed.length % 2 === 1 ? parsed[mid] : parsed[mid - 1].add(parsed[mid]).mul(0.5));
}

// src/modules/math/arithmetic.ts
var ROUNDING_MODES = {
  up: 0,
  down: 1,
  ceil: 2,
  floor: 3,
  "half-up": 4,
  "half-down": 5,
  "half-even": 6
};
var safe = Number.isSafeInteger;
var binary = (a, b, ops) => {
  if (typeof a === "number" && typeof b === "number") {
    if (!Number.isFinite(a)) throw invalidNumber("a", a);
    if (!Number.isFinite(b)) throw invalidNumber("b", b);
    const fast = ops.fast?.(a, b);
    if (fast !== void 0) return fast === 0 ? 0 : fast;
    return decimalToNumber(ops.decimal(toDecimal(a, "a"), toDecimal(b, "b")));
  }
  if (typeof a === "bigint" && typeof b === "bigint" && ops.bigint) {
    checkBigInt(a, "a");
    checkBigInt(b, "b");
    return checkBigInt(guardBigInt(() => ops.bigint(a, b)), "Result");
  }
  return decimalToString(ops.decimal(toDecimal(a, "a"), toDecimal(b, "b")));
};
function summary(a, b) {
  return binary(a, b, {
    fast: (x, y) => safe(x) && safe(y) && safe(x + y) ? x + y : void 0,
    bigint: (x, y) => x + y,
    decimal: (x, y) => x.add(y)
  });
}
function subtract(a, b) {
  return binary(a, b, {
    fast: (x, y) => safe(x) && safe(y) && safe(x - y) ? x - y : void 0,
    bigint: (x, y) => x - y,
    decimal: (x, y) => x.sub(y)
  });
}
function multiply(a, b) {
  return binary(a, b, {
    fast: (x, y) => safe(x) && safe(y) && safe(x * y) ? x * y : void 0,
    bigint: (x, y) => x * y,
    decimal: (x, y) => {
      const product2 = x.mul(y);
      if (product2.isZero() && !x.isZero() && !y.isZero()) throw underflowError("Result");
      return product2;
    }
  });
}
function divide(a, b, options = {}) {
  const precision = resolvePrecision(options.precision);
  return binary(a, b, {
    fast: (x, y) => {
      if (y === 0) throw divisionByZero();
      return safe(x) && safe(y) && x % y === 0 ? x / y : void 0;
    },
    decimal: (x, y) => divideDecimals(x, y, precision)
  });
}
function modulo(a, b) {
  return binary(a, b, {
    fast: (x, y) => {
      if (y === 0) throw divisionByZero("Modulo by zero");
      return safe(x) && safe(y) ? x % y : void 0;
    },
    bigint: (x, y) => {
      if (y === 0n) throw divisionByZero("Modulo by zero");
      return x % y;
    },
    decimal: (x, y) => {
      if (y.isZero()) throw divisionByZero("Modulo by zero");
      return x.mod(y);
    }
  });
}
function power(base, exponent, options = {}) {
  const kind = kindOf(base, exponent);
  const precision = resolvePrecision(options.precision);
  const b = toDecimal(base, "base");
  const e = toDecimal(exponent, "exponent");
  if (!e.isInteger()) {
    throw new NumericTypeError("ERR_NOT_INTEGER", `exponent must be an integer, received ${describeValue(exponent)}`);
  }
  if (kind === "bigint" && e.isNeg()) {
    throw outOfRange("exponent must be non-negative when both arguments are bigint; pass numeric strings for negative exponents");
  }
  const emit = (value) => {
    if (value.isZero() && !b.isZero()) throw underflowError("Result");
    if (kind === "bigint") return checkBigInt(decimalToBigInt(value), "Result");
    return kind === "number" ? decimalToNumber(value) : decimalToString(value);
  };
  if (b.isZero()) {
    if (e.isNeg()) throw divisionByZero("Zero cannot be raised to a negative power");
    return emit(new ExactDecimal(e.isZero() ? 1 : 0));
  }
  if (b.abs().eq(1)) return emit(new ExactDecimal(b.isNeg() && e.mod(2).abs().eq(1) ? -1 : 1));
  if (e.isZero()) return emit(new ExactDecimal(1));
  const exp = e.toNumber();
  if (Math.abs(exp) * Math.abs(log10Abs(b)) > MAX_EXPONENT2 + 1) {
    const grows = log10Abs(b) > 0 === exp > 0;
    throw grows ? overflowError("Result") : underflowError("Result");
  }
  if (b.isInteger() && !e.isNeg()) {
    const exact = guardBigInt(() => b.toBigInt() ** e.toBigInt());
    return emit(bigIntToDecimal(exact));
  }
  return emit(b.pow(exp, precision));
}
function abs(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidNumber("value", value);
    return Math.abs(value);
  }
  if (typeof value === "bigint") return value < 0n ? -checkBigInt(value, "value") : checkBigInt(value, "value");
  return decimalToString(toDecimal(value, "value").abs());
}
function percentage(value, total, options = {}) {
  const precision = resolvePrecision(options.precision);
  const kind = kindOf(value, total);
  const v = toDecimal(value, "value");
  const t = toDecimal(total, "total");
  if (t.isZero()) return kind === "number" ? 0 : "0";
  const result = divideDecimals(v.mul(100), t, precision);
  return kind === "number" ? decimalToNumber(result) : decimalToString(result);
}
function round(value, decimals = 2, mode = "half-up") {
  assertInteger(decimals, "decimals");
  if (decimals < 0 || decimals > MAX_DECIMALS) {
    throw outOfRange(`decimals must be a non-negative integer no greater than ${MAX_DECIMALS}`);
  }
  const rounding = ROUNDING_MODES[mode];
  if (rounding === void 0 || !Object.prototype.hasOwnProperty.call(ROUNDING_MODES, mode)) {
    throw outOfRange(`mode must be one of ${Object.keys(ROUNDING_MODES).join(", ")}, received ${describeValue(mode)}`);
  }
  if (typeof value === "bigint") return checkBigInt(value, "value");
  const rounded2 = toDecimal(value, "value").toDecimalPlaces(decimals, rounding);
  return typeof value === "number" ? decimalToNumber(rounded2) : decimalToString(rounded2);
}
function clamp(value, min, max) {
  const kind = kindOf(value, min, max);
  const v = toDecimal(value, "value");
  const lo = toDecimal(min, "min");
  const hi = toDecimal(max, "max");
  if (lo.gt(hi)) throw outOfRange("min must be less than or equal to max");
  if (kind === "bigint") return value < min ? min : value > max ? max : value;
  const chosen = v.lt(lo) ? lo : v.gt(hi) ? hi : v;
  return kind === "number" ? decimalToNumber(chosen) : decimalToString(chosen);
}
function compareNumbers(a, b) {
  if (typeof a === "number" && typeof b === "number") {
    if (!Number.isFinite(a)) throw invalidNumber("a", a);
    if (!Number.isFinite(b)) throw invalidNumber("b", b);
    return a < b ? -1 : a > b ? 1 : 0;
  }
  if (typeof a === "bigint" && typeof b === "bigint") return a < b ? -1 : a > b ? 1 : 0;
  return toDecimal(a, "a").cmp(toDecimal(b, "b"));
}
function isNumeric(value) {
  try {
    toDecimal(value, "value");
    return true;
  } catch {
    return false;
  }
}
function toDecimalString(value) {
  return decimalToString(toDecimal(value, "value"));
}

// src/modules/array/python.ts
function assertReadonlyArray(value, name) {
  if (!Array.isArray(value)) throw new TypeError(`${name} must be an array`);
}
var assertCount = (count, name) => {
  assertInteger(count, name);
  if (count < 0) throw new RangeError(`${name} must be a non-negative integer`);
};
function sort(array, compareFn = defaultCompare) {
  assertReadonlyArray(array, "array");
  assertFunction(compareFn, "compareFn");
  return [...array].sort(compareFn);
}
function enumerate(array, startIndex = 0) {
  assertReadonlyArray(array, "array");
  assertInteger(startIndex, "startIndex");
  return array.map((item, index) => [startIndex + index, item]);
}
function take(array, count) {
  assertReadonlyArray(array, "array");
  assertCount(count, "count");
  return array.slice(0, count);
}
function drop(array, count) {
  assertReadonlyArray(array, "array");
  assertCount(count, "count");
  return array.slice(count);
}
function first(array) {
  assertReadonlyArray(array, "array");
  return array[0];
}
function last(array) {
  assertReadonlyArray(array, "array");
  return array[array.length - 1];
}
function minBy(array, selector, compareFn = defaultCompare) {
  assertReadonlyArray(array, "array");
  assertFunction(selector, "selector");
  assertFunction(compareFn, "compareFn");
  let selected;
  let selectedValue;
  array.forEach((item, index) => {
    const value = selector(item, index);
    if (selected === void 0 || compareFn(value, selectedValue) < 0) {
      selected = item;
      selectedValue = value;
    }
  });
  return selected;
}
function maxBy(array, selector, compareFn = defaultCompare) {
  assertReadonlyArray(array, "array");
  assertFunction(selector, "selector");
  assertFunction(compareFn, "compareFn");
  let selected;
  let selectedValue;
  array.forEach((item, index) => {
    const value = selector(item, index);
    if (selected === void 0 || compareFn(value, selectedValue) > 0) {
      selected = item;
      selectedValue = value;
    }
  });
  return selected;
}
function sumBy(array, selector) {
  assertReadonlyArray(array, "array");
  assertFunction(selector, "selector");
  let total = 0;
  let hasValue = false;
  array.forEach((item, index) => {
    const value = selector(item, index);
    total = hasValue ? summary(total, value) : value;
    hasValue = true;
  });
  return total;
}

// src/modules/array/index.ts
var findMin = (arr, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  if (arr.length === 0) return void 0;
  return arr.reduce(
    (min, current) => compareFn(current, min) < 0 ? current : min
  );
};
var findMax = (arr, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  if (arr.length === 0) return void 0;
  return arr.reduce(
    (max, current) => compareFn(current, max) > 0 ? current : max
  );
};

// src/utils/intl.ts
var CACHE_LIMIT = 64;
var formatCache = /* @__PURE__ */ new Map();
var cacheKey = (locale, options) => {
  const plainLocale = locale === void 0 || typeof locale === "string" || Array.isArray(locale) && locale.every((item) => typeof item === "string");
  if (!plainLocale) return void 0;
  try {
    return JSON.stringify([locale ?? null, options]);
  } catch {
    return void 0;
  }
};
var getNumberFormat = (locale, options) => {
  const key = cacheKey(locale, options);
  if (key === void 0) return new Intl.NumberFormat(locale, options);
  const cached = formatCache.get(key);
  if (cached) {
    formatCache.delete(key);
    formatCache.set(key, cached);
    return cached;
  }
  const created = new Intl.NumberFormat(locale, options);
  formatCache.set(key, created);
  if (formatCache.size > CACHE_LIMIT) formatCache.delete(formatCache.keys().next().value);
  return created;
};
var exactStrings;
var supportsExactStrings = () => exactStrings ?? (exactStrings = (() => {
  try {
    return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(
      "12345678901234567890"
    ) === "12,345,678,901,234,567,890";
  } catch {
    return false;
  }
})());
var toIntlNumber = (value, name) => {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw invalidNumber(name, value);
    return value;
  }
  const decimal = toDecimal(value, name);
  if (typeof value === "bigint" || supportsExactStrings()) return value;
  const asNumber = Number(value);
  if (!Number.isFinite(asNumber) || !new ExactDecimal(asNumber).eq(decimal)) {
    throw new NumericRangeError(
      "ERR_PRECISION_LOSS",
      `${name} cannot be formatted exactly on this runtime (needs Intl.NumberFormat v3, Node 20+); received ${String(value).slice(0, 40)}`
    );
  }
  return asNumber;
};

// src/modules/formatter/number.ts
var formatWith = (value, locale, options) => getNumberFormat(locale, options).format(toIntlNumber(value, "value"));
function formatCompactNumber(value, locale = "en-US", options = {}) {
  return formatWith(value, locale, { maximumFractionDigits: 1, ...options, notation: "compact" });
}
function formatPercent(value, locale = "en-US", options = {}) {
  return formatWith(value, locale, { maximumFractionDigits: 2, ...options, style: "percent" });
}
function formatCurrency(value, currency, locale = "en-US", options = {}) {
  const code = normalizeCurrency(currency);
  return formatWith(value, locale, { ...options, style: "currency", currency: code });
}
function normalizeCurrency(currency) {
  if (typeof currency !== "string") throw new TypeError("currency must be a string");
  if (!/^[a-z]{3}$/i.test(currency)) throw new RangeError("currency must be a three-letter ISO 4217 code");
  return currency.toUpperCase();
}
function formatUnit(value, unit2, locale = "en-US", options = {}) {
  return formatWith(value, locale, { ...options, style: "unit", unit: unit2 });
}
var SI_UNITS = ["B", "kB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB", "RB", "QB"];
var IEC_UNITS = ["B", "KiB", "MiB", "GiB", "TiB", "PiB", "EiB", "ZiB", "YiB"];
var unitThresholds = /* @__PURE__ */ new Map();
var unitFactors = /* @__PURE__ */ new Map();
var unitTable = (base, count) => {
  let thresholds = unitThresholds.get(base);
  let factors = unitFactors.get(base);
  if (!thresholds || !factors) {
    thresholds = [];
    factors = [];
    for (let k = 0; k < count; k++) {
      thresholds.push(new ExactDecimal(base).pow(k));
      factors.push(
        base === 1e3 ? new ExactDecimal(`1e-${3 * k}`) : new ExactDecimal(5).pow(10 * k).mul(new ExactDecimal(`1e-${10 * k}`))
      );
    }
    unitThresholds.set(base, thresholds);
    unitFactors.set(base, factors);
  }
  return { thresholds, factors };
};
function formatBytes(value, options = {}) {
  const { base = 1e3, decimals = 2, locale = "en-US" } = options;
  const bytes = toDecimal(value, "value");
  if (bytes.isNeg() && !bytes.isZero()) throw outOfRange("value must be non-negative");
  if (base !== 1e3 && base !== 1024) throw outOfRange("base must be 1000 or 1024");
  assertInteger(decimals, "decimals");
  if (decimals < 0 || decimals > 20) throw outOfRange("decimals must be between 0 and 20");
  const units = base === 1e3 ? SI_UNITS : IEC_UNITS;
  const last2 = units.length - 1;
  const { thresholds, factors } = unitTable(base, units.length);
  let index = 0;
  while (index < last2 && bytes.gte(thresholds[index + 1])) index++;
  let rounded2 = bytes.mul(factors[index]).toDecimalPlaces(decimals, ROUND_HALF_UP);
  if (index < last2 && rounded2.gte(base)) {
    index++;
    rounded2 = bytes.mul(factors[index]).toDecimalPlaces(decimals, ROUND_HALF_UP);
  }
  const text = getNumberFormat(locale, { maximumFractionDigits: decimals }).format(
    toIntlNumber(rounded2.toFixed(), "value")
  );
  return `${text} ${units[index]}`;
}
var BYTE_UNIT = /^\s*([+]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:e[+-]?[0-9]+)?)\s*([a-z]*)\s*$/i;
function parseBytes(text, options = {}) {
  const { base = 1e3, bigint = false } = options;
  if (typeof text !== "string") {
    throw new NumericTypeError("ERR_INVALID_FORMAT", `text must be a string, received ${describeValue(text)}`);
  }
  if (base !== 1e3 && base !== 1024) throw outOfRange("base must be 1000 or 1024");
  const invalid = () => {
    throw new NumericTypeError("ERR_INVALID_FORMAT", `Cannot read ${describeValue(text)} as a size such as "1.5 GB" or "512 KiB"`);
  };
  const match = BYTE_UNIT.exec(text);
  if (!match) return invalid();
  const unit2 = /^(?:b|([kmgtpezyrq])(i?)b)?$/.exec(match[2].toLowerCase());
  if (!unit2 || unit2[2] && "rq".includes(unit2[1])) return invalid();
  const power2 = unit2[1] ? "kmgtpezyrq".indexOf(unit2[1]) + 1 : 0;
  const bytes = new ExactDecimal(match[1]).mul(new ExactDecimal(unit2[2] ? 1024 : base).pow(power2)).toDecimalPlaces(0);
  if (!bytes.isFinite()) throw overflowError("Size");
  const exact = bytes.toBigInt();
  if (bigint) return exact;
  if (exact > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new NumericRangeError("ERR_OVERFLOW", "Size exceeds Number.MAX_SAFE_INTEGER; pass { bigint: true } for an exact result");
  }
  return Number(exact);
}

// src/utils/segmenter.ts
var graphemeSegmenter;
var wordSegmenter;
function getGraphemeSegmenter() {
  return graphemeSegmenter ?? (graphemeSegmenter = new Intl.Segmenter("en", { granularity: "grapheme" }));
}
function getWordSegmenter() {
  return wordSegmenter ?? (wordSegmenter = new Intl.Segmenter("en", { granularity: "word" }));
}

// src/modules/formatter/text.ts
function assertText(value, name = "text") {
  if (typeof value !== "string") throw new TypeError(name + " must be a string");
}
function graphemes(text) {
  assertText(text);
  return Array.from(getGraphemeSegmenter().segment(text), (item) => item.segment);
}
function assertLength(value, name) {
  if (!Number.isSafeInteger(value)) throw new TypeError(name + " must be a safe integer");
  if (value < 0) throw new RangeError(name + " must be non-negative");
}
function truncateText(text, maxLength, options = {}) {
  const chars = graphemes(text);
  assertLength(maxLength, "maxLength");
  const { ellipsis = "...", preserveWords = false } = options;
  const marker = graphemes(ellipsis);
  if (chars.length <= maxLength) return text;
  if (marker.length >= maxLength) return marker.slice(0, maxLength).join("");
  const length = maxLength - marker.length;
  let prefix = chars.slice(0, length).join("");
  if (preserveWords && !/\s/u.test(chars[length] ?? "")) {
    const boundary = prefix.search(/\s+\S*$/u);
    if (boundary >= 0) prefix = prefix.slice(0, boundary);
  }
  return (preserveWords ? prefix.trimEnd() : prefix) + ellipsis;
}
function shortenString(text, options = {}) {
  const chars = graphemes(text);
  const { startLength = 4, endLength = 4, separator = "..." } = options;
  assertLength(startLength, "startLength");
  assertLength(endLength, "endLength");
  const marker = graphemes(separator);
  if (chars.length <= startLength + endLength + marker.length) return text;
  return chars.slice(0, startLength).join("") + separator + (endLength === 0 ? "" : chars.slice(-endLength).join(""));
}
function normalizeWhitespace(text) {
  assertText(text);
  return text.trim().replace(/\s+/gu, " ");
}
var LATIN_MARKS = /[\u0300-\u036f\u1ab0-\u1aff\u1dc0-\u1dff\u20d0-\u20ff\ufe20-\ufe2f]/g;
var TRANSLITERATIONS = {
  "\u0111": "d",
  "\u0110": "D",
  "\xF0": "d",
  "\xD0": "D",
  "\xF8": "o",
  "\xD8": "O",
  "\u0142": "l",
  "\u0141": "L",
  "\u0127": "h",
  "\u0126": "H",
  "\u0131": "i",
  "\xDF": "ss",
  "\u1E9E": "SS",
  "\xE6": "ae",
  "\xC6": "AE",
  "\u0153": "oe",
  "\u0152": "OE",
  "\xFE": "th",
  "\xDE": "Th"
};
var TRANSLITERATION_PATTERN = new RegExp(`[${Object.keys(TRANSLITERATIONS).join("")}]`, "g");
function removeDiacritics(text) {
  assertText(text);
  return text.normalize("NFD").replace(LATIN_MARKS, "").normalize("NFC").replace(TRANSLITERATION_PATTERN, (char) => TRANSLITERATIONS[char]);
}
function slugify(text) {
  return removeDiacritics(text).toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
}
function capitalize(text, locale) {
  assertText(text);
  if (!text) return "";
  const first2 = getGraphemeSegmenter().segment(text).containing(0).segment;
  return first2.toLocaleUpperCase(locale) + text.slice(first2.length);
}
function maskString(text, options = {}) {
  const chars = graphemes(text);
  const { visibleStart = 0, visibleEnd = 4, mask = "*" } = options;
  assertLength(visibleStart, "visibleStart");
  assertLength(visibleEnd, "visibleEnd");
  if (graphemes(mask).length !== 1) throw new RangeError("mask must contain exactly one grapheme");
  return chars.map(
    (char, index) => index < visibleStart || index >= chars.length - visibleEnd ? char : mask
  ).join("");
}
function escapeRegExp(text) {
  assertText(text);
  return text.replace(/[\\^$.*+?()[\]{}|/]/g, "\\$&").replace(/-/g, "\\x2d");
}

// src/modules/formatter/country-currencies.ts
var countryCurrencies = {
  "AC": [
    "SHP"
  ],
  "AD": [
    "EUR"
  ],
  "AE": [
    "AED"
  ],
  "AF": [
    "AFN"
  ],
  "AG": [
    "XCD"
  ],
  "AI": [
    "XCD"
  ],
  "AL": [
    "ALL"
  ],
  "AM": [
    "AMD"
  ],
  "AO": [
    "AOA"
  ],
  "AR": [
    "ARS"
  ],
  "AS": [
    "USD"
  ],
  "AT": [
    "EUR"
  ],
  "AU": [
    "AUD"
  ],
  "AW": [
    "AWG"
  ],
  "AX": [
    "EUR"
  ],
  "AZ": [
    "AZN"
  ],
  "BA": [
    "BAM"
  ],
  "BB": [
    "BBD"
  ],
  "BD": [
    "BDT"
  ],
  "BE": [
    "EUR"
  ],
  "BF": [
    "XOF"
  ],
  "BG": [
    "EUR"
  ],
  "BH": [
    "BHD"
  ],
  "BI": [
    "BIF"
  ],
  "BJ": [
    "XOF"
  ],
  "BL": [
    "EUR"
  ],
  "BM": [
    "BMD"
  ],
  "BN": [
    "BND"
  ],
  "BO": [
    "BOB"
  ],
  "BQ": [
    "USD"
  ],
  "BR": [
    "BRL"
  ],
  "BS": [
    "BSD"
  ],
  "BT": [
    "BTN",
    "INR"
  ],
  "BV": [
    "NOK"
  ],
  "BW": [
    "BWP"
  ],
  "BY": [
    "BYN"
  ],
  "BZ": [
    "BZD"
  ],
  "CA": [
    "CAD"
  ],
  "CC": [
    "AUD"
  ],
  "CD": [
    "CDF"
  ],
  "CF": [
    "XAF"
  ],
  "CG": [
    "XAF"
  ],
  "CH": [
    "CHF"
  ],
  "CI": [
    "XOF"
  ],
  "CK": [
    "NZD"
  ],
  "CL": [
    "CLP"
  ],
  "CM": [
    "XAF"
  ],
  "CN": [
    "CNY"
  ],
  "CO": [
    "COP"
  ],
  "CR": [
    "CRC"
  ],
  "CU": [
    "CUP"
  ],
  "CV": [
    "CVE"
  ],
  "CW": [
    "XCG"
  ],
  "CX": [
    "AUD"
  ],
  "CY": [
    "EUR"
  ],
  "CZ": [
    "CZK"
  ],
  "DE": [
    "EUR"
  ],
  "DG": [
    "USD"
  ],
  "DJ": [
    "DJF"
  ],
  "DK": [
    "DKK"
  ],
  "DM": [
    "XCD"
  ],
  "DO": [
    "DOP"
  ],
  "DZ": [
    "DZD"
  ],
  "EA": [
    "EUR"
  ],
  "EC": [
    "USD"
  ],
  "EE": [
    "EUR"
  ],
  "EG": [
    "EGP"
  ],
  "EH": [
    "MAD"
  ],
  "ER": [
    "ERN"
  ],
  "ES": [
    "EUR"
  ],
  "ET": [
    "ETB"
  ],
  "EU": [
    "EUR"
  ],
  "FI": [
    "EUR"
  ],
  "FJ": [
    "FJD"
  ],
  "FK": [
    "FKP"
  ],
  "FM": [
    "USD"
  ],
  "FO": [
    "DKK"
  ],
  "FR": [
    "EUR"
  ],
  "GA": [
    "XAF"
  ],
  "GB": [
    "GBP"
  ],
  "GD": [
    "XCD"
  ],
  "GE": [
    "GEL"
  ],
  "GF": [
    "EUR"
  ],
  "GG": [
    "GBP"
  ],
  "GH": [
    "GHS"
  ],
  "GI": [
    "GIP"
  ],
  "GL": [
    "DKK"
  ],
  "GM": [
    "GMD"
  ],
  "GN": [
    "GNF"
  ],
  "GP": [
    "EUR"
  ],
  "GQ": [
    "XAF"
  ],
  "GR": [
    "EUR"
  ],
  "GS": [
    "GBP"
  ],
  "GT": [
    "GTQ"
  ],
  "GU": [
    "USD"
  ],
  "GW": [
    "XOF"
  ],
  "GY": [
    "GYD"
  ],
  "HK": [
    "HKD"
  ],
  "HM": [
    "AUD"
  ],
  "HN": [
    "HNL"
  ],
  "HR": [
    "EUR"
  ],
  "HT": [
    "HTG",
    "USD"
  ],
  "HU": [
    "HUF"
  ],
  "IC": [
    "EUR"
  ],
  "ID": [
    "IDR"
  ],
  "IE": [
    "EUR"
  ],
  "IL": [
    "ILS"
  ],
  "IM": [
    "GBP"
  ],
  "IN": [
    "INR"
  ],
  "IO": [
    "USD"
  ],
  "IQ": [
    "IQD"
  ],
  "IR": [
    "IRR"
  ],
  "IS": [
    "ISK"
  ],
  "IT": [
    "EUR"
  ],
  "JE": [
    "GBP"
  ],
  "JM": [
    "JMD"
  ],
  "JO": [
    "JOD"
  ],
  "JP": [
    "JPY"
  ],
  "KE": [
    "KES"
  ],
  "KG": [
    "KGS"
  ],
  "KH": [
    "KHR"
  ],
  "KI": [
    "AUD"
  ],
  "KM": [
    "KMF"
  ],
  "KN": [
    "XCD"
  ],
  "KP": [
    "KPW"
  ],
  "KR": [
    "KRW"
  ],
  "KW": [
    "KWD"
  ],
  "KY": [
    "KYD"
  ],
  "KZ": [
    "KZT"
  ],
  "LA": [
    "LAK"
  ],
  "LB": [
    "LBP"
  ],
  "LC": [
    "XCD"
  ],
  "LI": [
    "CHF"
  ],
  "LK": [
    "LKR"
  ],
  "LR": [
    "LRD"
  ],
  "LS": [
    "ZAR",
    "LSL"
  ],
  "LT": [
    "EUR"
  ],
  "LU": [
    "EUR"
  ],
  "LV": [
    "EUR"
  ],
  "LY": [
    "LYD"
  ],
  "MA": [
    "MAD"
  ],
  "MC": [
    "EUR"
  ],
  "MD": [
    "MDL"
  ],
  "ME": [
    "EUR"
  ],
  "MF": [
    "EUR"
  ],
  "MG": [
    "MGA"
  ],
  "MH": [
    "USD"
  ],
  "MK": [
    "MKD"
  ],
  "ML": [
    "XOF"
  ],
  "MM": [
    "MMK"
  ],
  "MN": [
    "MNT"
  ],
  "MO": [
    "MOP"
  ],
  "MP": [
    "USD"
  ],
  "MQ": [
    "EUR"
  ],
  "MR": [
    "MRU"
  ],
  "MS": [
    "XCD"
  ],
  "MT": [
    "EUR"
  ],
  "MU": [
    "MUR"
  ],
  "MV": [
    "MVR"
  ],
  "MW": [
    "MWK"
  ],
  "MX": [
    "MXN"
  ],
  "MY": [
    "MYR"
  ],
  "MZ": [
    "MZN"
  ],
  "NA": [
    "NAD",
    "ZAR"
  ],
  "NC": [
    "XPF"
  ],
  "NE": [
    "XOF"
  ],
  "NF": [
    "AUD"
  ],
  "NG": [
    "NGN"
  ],
  "NI": [
    "NIO"
  ],
  "NL": [
    "EUR"
  ],
  "NO": [
    "NOK"
  ],
  "NP": [
    "NPR"
  ],
  "NR": [
    "AUD"
  ],
  "NU": [
    "NZD"
  ],
  "NZ": [
    "NZD"
  ],
  "OM": [
    "OMR"
  ],
  "PA": [
    "PAB",
    "USD"
  ],
  "PE": [
    "PEN"
  ],
  "PF": [
    "XPF"
  ],
  "PG": [
    "PGK"
  ],
  "PH": [
    "PHP"
  ],
  "PK": [
    "PKR"
  ],
  "PL": [
    "PLN"
  ],
  "PM": [
    "EUR"
  ],
  "PN": [
    "NZD"
  ],
  "PR": [
    "USD"
  ],
  "PS": [
    "ILS",
    "JOD"
  ],
  "PT": [
    "EUR"
  ],
  "PW": [
    "USD"
  ],
  "PY": [
    "PYG"
  ],
  "QA": [
    "QAR"
  ],
  "RE": [
    "EUR"
  ],
  "RO": [
    "RON"
  ],
  "RS": [
    "RSD"
  ],
  "RU": [
    "RUB"
  ],
  "RW": [
    "RWF"
  ],
  "SA": [
    "SAR"
  ],
  "SB": [
    "SBD"
  ],
  "SC": [
    "SCR"
  ],
  "SD": [
    "SDG"
  ],
  "SE": [
    "SEK"
  ],
  "SG": [
    "SGD"
  ],
  "SH": [
    "SHP"
  ],
  "SI": [
    "EUR"
  ],
  "SJ": [
    "NOK"
  ],
  "SK": [
    "EUR"
  ],
  "SL": [
    "SLE"
  ],
  "SM": [
    "EUR"
  ],
  "SN": [
    "XOF"
  ],
  "SO": [
    "SOS"
  ],
  "SR": [
    "SRD"
  ],
  "SS": [
    "SSP"
  ],
  "ST": [
    "STN"
  ],
  "SV": [
    "USD"
  ],
  "SX": [
    "XCG"
  ],
  "SY": [
    "SYP"
  ],
  "SZ": [
    "SZL"
  ],
  "TA": [
    "GBP"
  ],
  "TC": [
    "USD"
  ],
  "TD": [
    "XAF"
  ],
  "TF": [
    "EUR"
  ],
  "TG": [
    "XOF"
  ],
  "TH": [
    "THB"
  ],
  "TJ": [
    "TJS"
  ],
  "TK": [
    "NZD"
  ],
  "TL": [
    "USD"
  ],
  "TM": [
    "TMT"
  ],
  "TN": [
    "TND"
  ],
  "TO": [
    "TOP"
  ],
  "TR": [
    "TRY"
  ],
  "TT": [
    "TTD"
  ],
  "TV": [
    "AUD"
  ],
  "TW": [
    "TWD"
  ],
  "TZ": [
    "TZS"
  ],
  "UA": [
    "UAH"
  ],
  "UG": [
    "UGX"
  ],
  "UM": [
    "USD"
  ],
  "US": [
    "USD"
  ],
  "UY": [
    "UYU"
  ],
  "UZ": [
    "UZS"
  ],
  "VA": [
    "EUR"
  ],
  "VC": [
    "XCD"
  ],
  "VE": [
    "VES"
  ],
  "VG": [
    "USD"
  ],
  "VI": [
    "USD"
  ],
  "VN": [
    "VND"
  ],
  "VU": [
    "VUV"
  ],
  "WF": [
    "XPF"
  ],
  "WS": [
    "WST"
  ],
  "XK": [
    "EUR"
  ],
  "YE": [
    "YER"
  ],
  "YT": [
    "EUR"
  ],
  "ZA": [
    "ZAR"
  ],
  "ZM": [
    "ZMW"
  ],
  "ZW": [
    "ZWG",
    "USD"
  ]
};

// src/modules/formatter/currency.ts
function getCountryCurrencies(countryCode) {
  if (typeof countryCode !== "string") throw new TypeError("countryCode must be a string");
  if (!/^[a-z]{2}$/i.test(countryCode)) throw new RangeError("countryCode must be a two-letter region code");
  return [...countryCurrencies[countryCode.toUpperCase()] ?? []];
}
function getCurrencySymbol(currency, locale = "en-US", display = "symbol") {
  const code = normalizeCurrency(currency);
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: code,
    currencyDisplay: display
  }).formatToParts(0).find((part) => part.type === "currency")?.value ?? code;
}
function getCurrencyName(currency, locale = "en-US") {
  const code = normalizeCurrency(currency);
  return new Intl.DisplayNames(locale, { type: "currency" }).of(code) ?? code;
}

// src/utils/date-format.ts
var DAY_MS = 864e5;
var epochDay = (year, month, day) => {
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(year, month, day);
  return Math.floor(date.getTime() / DAY_MS);
};
var weekdayOf = (epoch) => ((epoch + 4) % 7 + 7) % 7;
var startOfWeek = (epoch, weekStartsOn) => {
  const weekday2 = weekdayOf(epoch);
  return epoch - ((weekday2 < weekStartsOn ? 7 : 0) + weekday2 - weekStartsOn);
};
var weekYearOf = (year, epoch, weekStartsOn, firstWeekContainsDate) => {
  if (epoch >= startOfWeek(epochDay(year + 1, 0, firstWeekContainsDate), weekStartsOn)) return year + 1;
  if (epoch >= startOfWeek(epochDay(year, 0, firstWeekContainsDate), weekStartsOn)) return year;
  return year - 1;
};
var weekOf = (year, epoch, weekStartsOn, firstWeekContainsDate) => {
  const weekYear = weekYearOf(year, epoch, weekStartsOn, firstWeekContainsDate);
  const firstWeek = startOfWeek(epochDay(weekYear, 0, firstWeekContainsDate), weekStartsOn);
  return Math.round((startOfWeek(epoch, weekStartsOn) - firstWeek) / 7) + 1;
};
var DAYS_IN_MONTH = [31, 0, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
var isLeapYear = (year) => year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
var DATE_RE = /^-?(?:(\d{3})|(\d{2})(?:-?(\d{2}))?|W(\d{2})(?:-?(\d{1}))?|)$/;
var TIME_RE = /^(\d{2}(?:[.,]\d*)?)(?::?(\d{2}(?:[.,]\d*)?))?(?::?(\d{2}(?:[.,]\d*)?))?$/;
var ZONE_RE = /^([+-])(\d{2})(?::?(\d{2}))?$/;
var YEAR_RE = /^(?:(\d{4}|[+-]\d{6})|(\d{2}|[+-]\d{4})$)/;
var ZONE_TAIL_RE = /([Z+-].*)$/;
var unit = (value) => value ? parseInt(value, 10) : 1;
var timeUnit = (value) => value && parseFloat(value.replace(",", ".")) || 0;
var parseDay = (text, year) => {
  const match = DATE_RE.exec(text);
  if (!match) return NaN;
  const dayOfYear = unit(match[1]);
  const month = unit(match[2]) - 1;
  const day = unit(match[3]);
  const week = unit(match[4]);
  const weekday2 = unit(match[5]) - 1;
  if (match[4]) {
    if (week < 1 || week > 53 || weekday2 < 0 || weekday2 > 6) return NaN;
    const fourth = epochDay(year, 0, 4);
    return (fourth + (week - 1) * 7 + weekday2 + 1 - (weekdayOf(fourth) || 7)) * DAY_MS;
  }
  const days = DAYS_IN_MONTH[month] || (isLeapYear(year) ? 29 : 28);
  if (month < 0 || month > 11 || day < 1 || day > days) return NaN;
  if (dayOfYear < 1 || dayOfYear > (isLeapYear(year) ? 366 : 365)) return NaN;
  return epochDay(year, month, Math.max(dayOfYear, day)) * DAY_MS;
};
var parseClock = (text) => {
  const match = TIME_RE.exec(text);
  if (!match) return NaN;
  const hours = timeUnit(match[1]);
  const minutes = timeUnit(match[2]);
  const seconds = timeUnit(match[3]);
  const valid = hours === 24 ? minutes === 0 && seconds === 0 : seconds >= 0 && seconds < 60 && minutes >= 0 && minutes < 60 && hours >= 0 && hours < 25;
  return valid ? hours * 36e5 + minutes * 6e4 + seconds * 1e3 : NaN;
};
var parseZone = (text) => {
  if (text === "Z") return 0;
  const match = ZONE_RE.exec(text);
  if (!match) return 0;
  const minutes = match[3] && parseInt(match[3], 10) || 0;
  if (minutes > 59) return NaN;
  return (match[1] === "+" ? -1 : 1) * (parseInt(match[2], 10) * 36e5 + minutes * 6e4);
};
var parseISO = (value) => {
  const invalid = /* @__PURE__ */ new Date(NaN);
  const pieces = value.split(/[T ]/);
  if (pieces.length > 2) return invalid;
  let dateText;
  let timeText;
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
  let zoneText;
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
  if (zoneText === void 0) {
    const wall = new Date(day + clock);
    const local = /* @__PURE__ */ new Date(0);
    local.setFullYear(wall.getUTCFullYear(), wall.getUTCMonth(), wall.getUTCDate());
    local.setHours(wall.getUTCHours(), wall.getUTCMinutes(), wall.getUTCSeconds(), wall.getUTCMilliseconds());
    return local;
  }
  const offset = parseZone(zoneText);
  return Number.isNaN(offset) ? invalid : new Date(day + clock + offset);
};
var EN_MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
var EN_DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
var EN_PERIODS = {
  am: ["AM", "a.m.", "a", "am"],
  pm: ["PM", "p.m.", "p", "pm"],
  midnight: ["midnight", "midnight", "mi", "midnight"],
  noon: ["noon", "noon", "n", "noon"],
  morning: ["in the morning", "in the morning", "in the morning", "in the morning"],
  afternoon: ["in the afternoon", "in the afternoon", "in the afternoon", "in the afternoon"],
  evening: ["in the evening", "in the evening", "in the evening", "in the evening"],
  night: ["at night", "at night", "at night", "at night"]
};
var EN_LONG_DATE = { full: "EEEE, MMMM do, y", long: "MMMM do, y", medium: "MMM d, y", short: "MM/dd/yyyy" };
var EN_LONG_TIME = { full: "h:mm:ss a zzzz", long: "h:mm:ss a z", medium: "h:mm:ss a", short: "h:mm a" };
var EN_LONG_DATE_TIME = {
  full: "{{date}} 'at' {{time}}",
  long: "{{date}} 'at' {{time}}",
  medium: "{{date}}, {{time}}",
  short: "{{date}}, {{time}}"
};
var sliceName = (name, width) => width === "narrow" ? name[0] : width === "short" ? name.slice(0, 2) : width === "abbreviated" ? name.slice(0, 3) : name;
var englishOrdinal = (value) => {
  const rest = value % 100;
  if (rest > 20 || rest < 10) {
    if (rest % 10 === 1) return `${value}st`;
    if (rest % 10 === 2) return `${value}nd`;
    if (rest % 10 === 3) return `${value}rd`;
  }
  return `${value}th`;
};
var englishNames = {
  era: (era, width) => width === "wide" ? ["Before Christ", "Anno Domini"][era] : width === "narrow" ? ["B", "A"][era] : ["BC", "AD"][era],
  quarter: (quarter, width) => width === "wide" ? `${englishOrdinal(quarter)} quarter` : width === "narrow" ? String(quarter) : `Q${quarter}`,
  month: (month, width) => width === "narrow" ? EN_MONTHS[month][0] : width === "wide" ? EN_MONTHS[month] : EN_MONTHS[month].slice(0, 3),
  day: (day, width) => sliceName(EN_DAYS[day], width),
  dayPeriod: (period, width) => EN_PERIODS[period][width === "abbreviated" || width === "short" ? 0 : width === "wide" ? 1 : 2],
  ordinalNumber: (value) => englishOrdinal(value),
  long: (kind, width) => (kind === "date" ? EN_LONG_DATE : kind === "time" ? EN_LONG_TIME : EN_LONG_DATE_TIME)[width],
  weekStartsOn: 0,
  firstWeekContainsDate: 1
};
var intlName = (locale, options, date, type) => {
  const part = new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).formatToParts(date).find((p) => p.type === type);
  return part ? part.value : "";
};
var intlNames = (locale) => {
  const intlWidth = (width) => width === "wide" ? "long" : width === "narrow" ? "narrow" : "short";
  let weekInfo;
  try {
    const resolved = typeof locale === "string" ? new Intl.Locale(locale) : locale;
    const info = resolved;
    weekInfo = typeof info.getWeekInfo === "function" ? info.getWeekInfo() : info.weekInfo;
  } catch {
    weekInfo = void 0;
  }
  return {
    era: (era, width) => intlName(locale, { era: intlWidth(width) }, new Date(Date.UTC(era ? 2e3 : -2e3, 0, 1)), "era"),
    quarter: englishNames.quarter,
    month: (month, width, context) => intlName(locale, context === "standalone" ? { month: intlWidth(width) } : { month: intlWidth(width), day: "numeric" }, new Date(Date.UTC(2e3, month, 15)), "month"),
    day: (day, width) => {
      const name = intlName(locale, { weekday: width === "short" ? "short" : intlWidth(width) }, new Date(Date.UTC(2e3, 0, 2 + day)), "weekday");
      return width === "short" ? name.slice(0, 2) : name;
    },
    dayPeriod: (period, width) => period === "am" || period === "pm" ? intlName(locale, { hour: "numeric", hour12: true }, new Date(Date.UTC(2e3, 0, 1, period === "am" ? 1 : 13)), "dayPeriod") : englishNames.dayPeriod(period, width, "formatting"),
    ordinalNumber: (value) => String(value),
    weekStartsOn: weekInfo?.firstDay === void 0 ? void 0 : weekInfo.firstDay % 7,
    firstWeekContainsDate: weekInfo?.minimalDays
  };
};
var adaptDateFns = (locale) => {
  const { localize, formatLong, options } = locale;
  if (!localize) return locale.code ? intlNames(locale.code) : englishNames;
  return {
    era: (era, width) => localize.era(era, { width }),
    quarter: (quarter, width, context) => localize.quarter(quarter, { width, context }),
    month: (month, width, context) => localize.month(month, { width, context }),
    day: (day, width, context) => localize.day(day, { width, context }),
    dayPeriod: (period, width, context) => localize.dayPeriod(period, { width, context }),
    ordinalNumber: (value, ordinalUnit) => localize.ordinalNumber(value, { unit: ordinalUnit }),
    long: formatLong ? (kind, width) => formatLong[kind]({ width }) : void 0,
    preprocessor: localize.preprocessor,
    weekStartsOn: options?.weekStartsOn,
    firstWeekContainsDate: options?.firstWeekContainsDate
  };
};
var resolveNames = (locale) => {
  if (locale === void 0) return englishNames;
  if (typeof locale === "string") return /^en(?:-US)?$/i.test(locale) ? englishNames : intlNames(locale);
  if (typeof Intl.Locale === "function" && locale instanceof Intl.Locale) return intlNames(locale);
  return adaptDateFns(locale);
};
var localFields = (date) => ({
  year: date.getFullYear(),
  month: date.getMonth(),
  date: date.getDate(),
  hours: date.getHours(),
  minutes: date.getMinutes(),
  seconds: date.getSeconds(),
  ms: date.getMilliseconds(),
  weekday: date.getDay(),
  offset: date.getTimezoneOffset(),
  time: date.getTime()
});
var shiftedFields = (date, offsetSeconds) => {
  const shifted = new Date(date.getTime() + offsetSeconds * 1e3);
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
    time: date.getTime()
  };
};
var pad = (value, length) => {
  const text = Math.abs(value).toString().padStart(length, "0");
  return value < 0 ? `-${text}` : text;
};
var zoneShort = (offset, delimiter) => {
  const sign2 = offset > 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  const hours = Math.trunc(absolute / 60);
  const minutes = absolute % 60;
  return minutes === 0 ? sign2 + hours : sign2 + hours + delimiter + pad(minutes, 2);
};
var zoneFull = (offset, delimiter) => {
  const sign2 = offset > 0 ? "-" : "+";
  const absolute = Math.abs(offset);
  return sign2 + pad(Math.trunc(absolute / 60), 2) + delimiter + pad(absolute % 60, 2);
};
var zoneOptionalMinutes = (offset, delimiter) => offset % 60 === 0 ? (offset > 0 ? "-" : "+") + pad(Math.abs(offset) / 60, 2) : zoneFull(offset, delimiter);
var TOKEN_RE = /[yYQqMLwIdDecihHKkms]o|(\w)\1*|''|'(''|[^'])+('|$)|./g;
var LONG_TOKEN_RE = /P+p+|P+|p+|''|'(''|[^'])+('|$)|./g;
var TOKEN_LETTERS = "GyYuRQqMLwIdDEeciabBhHKkmsSXxOztT";
var LETTER_RE = /[a-zA-Z]/;
var unquote = (text) => /^'([^]*?)'?$/.exec(text)[1].replace(/''/g, "'");
var expandLong = (token, names) => {
  const widths = ["short", "medium", "long", "full"];
  const pick2 = (count) => widths[Math.min(count, 4) - 1];
  const long = names.long ?? englishNames.long;
  const match = /(P+)(p+)?/.exec(token);
  if (token[0] === "p") return long("time", pick2(token.length));
  if (!match[2]) return long("date", pick2(token.length));
  return long("dateTime", pick2(match[1].length)).replace("{{date}}", long("date", pick2(match[1].length))).replace("{{time}}", long("time", pick2(match[2].length)));
};
var formatTokens = (fields, pattern, locale, options = {}) => {
  if (typeof pattern !== "string") throw new TypeError("format must be a string");
  const names = resolveNames(locale);
  const weekStartsOn = options.weekStartsOn ?? names.weekStartsOn ?? 0;
  const firstWeekContainsDate = options.firstWeekContainsDate ?? names.firstWeekContainsDate ?? 1;
  if (!(weekStartsOn >= 0 && weekStartsOn <= 6)) throw new RangeError("weekStartsOn must be between 0 and 6 inclusively");
  if (!(firstWeekContainsDate >= 1 && firstWeekContainsDate <= 7)) {
    throw new RangeError("firstWeekContainsDate must be between 1 and 7 inclusively");
  }
  const expanded = (pattern.match(LONG_TOKEN_RE) ?? []).map((piece) => piece[0] === "P" || piece[0] === "p" ? expandLong(piece, names) : piece).join("");
  const { year: signedYear, month, date, hours, minutes, seconds, ms, weekday: weekday2, offset } = fields;
  const epoch = epochDay(signedYear, month, date);
  const eraYear = signedYear > 0 ? signedYear : 1 - signedYear;
  const hour12 = hours % 12;
  const localWeekday = (weekday2 - weekStartsOn + 8) % 7 || 7;
  const ordinal = (value, ordinalUnit) => names.ordinalNumber(value, ordinalUnit);
  const dayPeriodOf = (kind) => {
    if (kind === "ampm") return hours / 12 >= 1 ? "pm" : "am";
    if (kind === "noon") return hours === 12 ? "noon" : hours === 0 ? "midnight" : hours / 12 >= 1 ? "pm" : "am";
    return hours >= 17 ? "evening" : hours >= 12 ? "afternoon" : hours >= 4 ? "morning" : "night";
  };
  const widthOf = (length, short = false) => length <= 3 ? "abbreviated" : length === 5 ? "narrow" : length === 6 && short ? "short" : "wide";
  const render2 = (token) => {
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
        return names.day(weekday2, widthOf(length, true), "formatting");
      case "i": {
        const isoWeekday = weekday2 === 0 ? 7 : weekday2;
        if (ordinalToken) return ordinal(isoWeekday, "day");
        if (length <= 2) return pad(isoWeekday, length);
        return names.day(weekday2, widthOf(length, true), "formatting");
      }
      case "e":
      case "c":
        if (ordinalToken) return ordinal(localWeekday, "day");
        if (length <= 2) return pad(localWeekday, length);
        return names.day(weekday2, widthOf(length, true), letter === "e" ? "formatting" : "standalone");
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
        return pad(Math.trunc(fields.time / 1e3), length);
      case "T":
        return pad(fields.time, length);
      default:
        throw new RangeError(`Format string contains an unescaped latin alphabet character \`${letter}\``);
    }
  };
  let parts = (expanded.match(TOKEN_RE) ?? []).map((piece) => {
    if (piece === "''") return { isToken: false, value: "'" };
    if (piece[0] === "'") return { isToken: false, value: unquote(piece) };
    if (TOKEN_LETTERS.includes(piece[0])) return { isToken: true, value: piece };
    if (LETTER_RE.test(piece[0])) throw new RangeError(`Format string contains an unescaped latin alphabet character \`${piece[0]}\``);
    return { isToken: false, value: piece };
  });
  if (names.preprocessor) {
    const wall = /* @__PURE__ */ new Date(0);
    wall.setFullYear(signedYear, month, date);
    wall.setHours(hours, minutes, seconds, ms);
    parts = names.preprocessor(wall, parts);
  }
  return parts.map(({ isToken, value }) => {
    if (!isToken) return value;
    if (!options.useAdditionalWeekYearTokens && (value === "YY" || value === "YYYY")) {
      throw new RangeError(`Use \`${value.toLowerCase()}\` instead of \`${value}\` (in \`${pattern}\`) for formatting years; pass useAdditionalWeekYearTokens to allow it`);
    }
    if (!options.useAdditionalDayOfYearTokens && (value === "D" || value === "DD")) {
      throw new RangeError(`Use \`${value.toLowerCase()}\` instead of \`${value}\` (in \`${pattern}\`) for formatting days of the month; pass useAdditionalDayOfYearTokens to allow it`);
    }
    return render2(value);
  }).join("");
};

// src/utils/date.ts
var toValidDate = (date) => {
  let dateObj;
  if (date instanceof Date) dateObj = date;
  else if (typeof date === "number") dateObj = new Date(date);
  else if (typeof date === "string") {
    const iso = parseISO(date);
    dateObj = Number.isNaN(iso.getTime()) ? new Date(date) : iso;
  } else {
    throw new TypeError("date must be a Date, string or number");
  }
  if (Number.isNaN(dateObj.getTime())) throw new RangeError(`Invalid date: ${String(date)}`);
  return dateObj;
};

// src/utils/zone.ts
var offsetFormatters = /* @__PURE__ */ new Map();
var getOffsetFormatter = (timeZone) => {
  if (typeof timeZone !== "string") throw new TypeError("timeZone must be a string");
  const cached = offsetFormatters.get(timeZone);
  if (cached) return cached;
  try {
    const formatter = new Intl.DateTimeFormat("en-US-u-ca-iso8601-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    offsetFormatters.set(timeZone, formatter);
    return formatter;
  } catch {
    throw new RangeError(`Invalid time zone: ${timeZone}`);
  }
};
var getOffsetSeconds = (date, timeZone) => {
  const instant = toValidDate(date);
  const parts = getOffsetFormatter(timeZone).formatToParts(instant);
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)])
  );
  const localAsUtcDate = /* @__PURE__ */ new Date(0);
  localAsUtcDate.setUTCFullYear(values.year, values.month - 1, values.day);
  localAsUtcDate.setUTCHours(values.hour, values.minute, values.second, 0);
  const localAsUtc = localAsUtcDate.getTime();
  const instantAtSecond = Math.floor(instant.getTime() / 1e3) * 1e3;
  const offset = (localAsUtc - instantAtSecond) / 1e3;
  return offset === 0 ? 0 : offset;
};

// src/modules/formatter/date.ts
function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.getTime());
}
function formatDate(date, formatStr, options = {}) {
  const instant = toValidDate(date);
  const fields = options.timeZone === void 0 ? localFields(instant) : shiftedFields(instant, getOffsetSeconds(instant, options.timeZone));
  return formatTokens(fields, formatStr, options.locale, options);
}
var SECOND = 1e3;
var truncatedQuotient = (diff, size) => {
  const whole = Number(BigInt(diff) / BigInt(size));
  return whole === 0 && diff < 0 ? -0 : whole;
};
var RELATIVE_UNITS = [
  ["year", 365.25 * 24 * 3600 * SECOND],
  ["month", 365.25 / 12 * 24 * 3600 * SECOND],
  ["week", 7 * 24 * 3600 * SECOND],
  ["day", 24 * 3600 * SECOND],
  ["hour", 3600 * SECOND],
  ["minute", 60 * SECOND]
];
function formatRelativeTime(date, options = {}) {
  const { locale = "en-US", now = /* @__PURE__ */ new Date(), numeric = "auto" } = options;
  const diff = toValidDate(date).getTime() - toValidDate(now).getTime();
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric });
  for (const [unit2, size] of RELATIVE_UNITS) {
    if (Math.abs(diff) >= size) {
      return formatter.format(truncatedQuotient(diff, size), unit2);
    }
  }
  return formatter.format(truncatedQuotient(diff, SECOND), "second");
}
function formatDuration(milliseconds, options = {}) {
  const parsed = toDecimal(milliseconds, "milliseconds");
  if (parsed.isNeg() && !parsed.isZero()) throw outOfRange("milliseconds must be non-negative");
  const { maxUnits = Infinity } = options;
  if (maxUnits !== Infinity && (!Number.isInteger(maxUnits) || maxUnits < 1)) {
    throw outOfRange("maxUnits must be a positive integer");
  }
  const total = BigInt(parsed.floor().toFixed());
  if (total < 1000n) return `${total}ms`;
  let seconds = total / 1000n;
  const parts = [];
  for (const [label, size] of [["d", 86400n], ["h", 3600n], ["m", 60n], ["s", 1n]]) {
    const amount = seconds / size;
    seconds -= amount * size;
    if (amount > 0n) parts.push(`${amount}${label}`);
  }
  return parts.slice(0, maxUnits).join(" ");
}
var DURATION_UNITS = {};
for (const [names, size] of [
  [["ms", "msec", "msecs", "millisecond", "milliseconds"], 1],
  [["s", "sec", "secs", "second", "seconds"], 1e3],
  [["m", "min", "mins", "minute", "minutes"], 6e4],
  [["h", "hr", "hrs", "hour", "hours"], 36e5],
  [["d", "day", "days"], 864e5],
  [["w", "wk", "wks", "week", "weeks"], 6048e5]
]) {
  for (const name of names) DURATION_UNITS[name] = size;
}
var DURATION_PART = /\s*(?:,|\band\b)?\s*([0-9]*\.?[0-9]+)\s*([a-z]*)/iy;
function parseDuration(text) {
  if (typeof text !== "string") {
    throw new NumericTypeError("ERR_INVALID_FORMAT", `text must be a string, received ${describeValue(text)}`);
  }
  const invalid = () => {
    throw new NumericTypeError("ERR_INVALID_FORMAT", `Cannot read ${describeValue(text)} as a duration such as "1h 2m 3s"`);
  };
  const source = text.trim();
  if (source === "") return invalid();
  let total = new ExactDecimal(0);
  let position = 0;
  let parts = 0;
  while (position < source.length) {
    DURATION_PART.lastIndex = position;
    const match = DURATION_PART.exec(source);
    if (!match) return invalid();
    const size = match[2] === "" ? 1 : DURATION_UNITS[match[2].toLowerCase()];
    if (size === void 0 || match[2] === "" && (parts > 0 || DURATION_PART.lastIndex < source.length)) return invalid();
    parts++;
    total = total.add(new ExactDecimal(match[1]).mul(size));
    position = DURATION_PART.lastIndex;
  }
  const rounded2 = total.toDecimalPlaces(0);
  const milliseconds = rounded2.toNumber();
  if (!rounded2.isFinite()) throw overflowError("Duration");
  if (milliseconds > Number.MAX_SAFE_INTEGER) {
    throw new NumericRangeError("ERR_OVERFLOW", "Duration exceeds Number.MAX_SAFE_INTEGER milliseconds");
  }
  return milliseconds;
}

// src/modules/formatter/case.ts
function assertText2(value) {
  if (typeof value !== "string") throw new TypeError("text must be a string");
}
function splitWords(text) {
  assertText2(text);
  return text.replace(/(\p{Ll}|\p{N})(\p{Lu})/gu, "$1 $2").replace(/(\p{Lu}+)(\p{Lu}\p{Ll})/gu, "$1 $2").split(/[^\p{L}\p{M}\p{N}]+/u).filter(Boolean);
}
var upperFirst = (word) => {
  const [first2 = "", ...rest] = Array.from(word);
  return first2.toLocaleUpperCase() + rest.join("");
};
function camelCase(text) {
  return splitWords(text).map((word, index) => index === 0 ? word.toLowerCase() : upperFirst(word.toLowerCase())).join("");
}
function pascalCase(text) {
  return splitWords(text).map((word) => upperFirst(word.toLowerCase())).join("");
}
function kebabCase(text) {
  return splitWords(text).map((word) => word.toLowerCase()).join("-");
}
function snakeCase(text) {
  return splitWords(text).map((word) => word.toLowerCase()).join("_");
}
function titleCase(text) {
  return splitWords(text).map((word) => upperFirst(word.toLowerCase())).join(" ");
}
var HTML_ESCAPES = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};
var HTML_UNESCAPES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'"
};
function escapeHtml(text) {
  assertText2(text);
  return text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}
function unescapeHtml(text) {
  assertText2(text);
  return text.replace(/&(?:amp|lt|gt|quot|#39|#x27);/g, (entity) => HTML_UNESCAPES[entity]);
}
function countWords(text) {
  assertText2(text);
  let count = 0;
  for (const segment of getWordSegmenter().segment(text)) {
    if (segment.isWordLike) count++;
  }
  return count;
}
function reverseText(text) {
  assertText2(text);
  const graphemes2 = Array.from(
    new Intl.Segmenter("en", { granularity: "grapheme" }).segment(text),
    (item) => item.segment
  );
  return graphemes2.reverse().join("");
}

// src/modules/formatter/cleaning.ts
function assertText3(value, name = "text") {
  if (typeof value !== "string") throw new TypeError(`${name} must be a string`);
}
function previousIndex(text, end) {
  const last2 = text.charCodeAt(end - 1);
  const previous = text.charCodeAt(end - 2);
  return end - (last2 >= 56320 && last2 <= 57343 && previous >= 55296 && previous <= 56319 ? 2 : 1);
}
function stripCharacters(text, chars, left, right) {
  assertText3(chars, "chars");
  if (!chars || !text) return text;
  const characters = new Set(chars);
  let start = 0;
  let end = text.length;
  if (left) {
    for (const char of text) {
      if (!characters.has(char)) break;
      start += char.length;
    }
  }
  if (right) {
    while (end > start) {
      const previous = previousIndex(text, end);
      if (!characters.has(text.slice(previous, end))) break;
      end = previous;
    }
  }
  return text.slice(start, end);
}
function strip(text, chars) {
  assertText3(text);
  return chars === void 0 ? text.trim() : stripCharacters(text, chars, true, true);
}
function lstrip(text, chars) {
  assertText3(text);
  return chars === void 0 ? text.trimStart() : stripCharacters(text, chars, true, false);
}
function rstrip(text, chars) {
  assertText3(text);
  return chars === void 0 ? text.trimEnd() : stripCharacters(text, chars, false, true);
}
function title(text) {
  assertText3(text);
  return text.replace(/\p{L}[\p{L}\p{M}]*(?:['’]\p{L}[\p{L}\p{M}]*)*/gu, (word) => {
    const lower = word.toLowerCase();
    const first2 = String.fromCodePoint(lower.codePointAt(0));
    return first2.toUpperCase() + lower.slice(first2.length);
  });
}
function endpoint(text, last2) {
  assertText3(text);
  if (!text) return "";
  if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
    const segments = getGraphemeSegmenter().segment(text);
    return segments.containing(last2 ? text.length - 1 : 0).segment;
  }
  return last2 ? text.slice(previousIndex(text, text.length)) : String.fromCodePoint(text.codePointAt(0));
}
function firstChar(text) {
  return endpoint(text, false);
}
function lastChar(text) {
  return endpoint(text, true);
}

// src/modules/formatter/index.ts
var formatNumber = (value, locale, options) => {
  const input = typeof value === "number" ? value : toIntlNumber(value, "value");
  return getNumberFormat(locale, options ?? {}).format(input);
};

// src/modules/math/integer.ts
var MAX_FACTORIAL_NUMBER = 170;
var MAX_FACTORIAL_BIG = 65e3;
var MAX_FIBONACCI_NUMBER = 1476;
var MAX_FIBONACCI_BIG = 1e6;
var MAX_GCD_SCALE = 1e3;
var MAX_PRIME_BITS = 2048;
var toInteger = (value, name) => {
  if (typeof value === "bigint") return checkBigInt(value, name);
  const decimal = toDecimal(value, name);
  if (!decimal.isInteger()) {
    throw new NumericTypeError("ERR_NOT_INTEGER", `${name} must be an integer, received ${describeValue(value)}`);
  }
  return decimal.toBigInt();
};
var factorialTable;
var numberFactorial = (n) => {
  if (!factorialTable) {
    factorialTable = [1];
    let acc = 1n;
    for (let i = 1; i <= MAX_FACTORIAL_NUMBER; i++) {
      acc *= BigInt(i);
      factorialTable.push(Number(acc));
    }
  }
  return factorialTable[n];
};
var product = (lo, hi) => {
  if (hi - lo < 16) {
    let acc = BigInt(lo);
    for (let i = lo + 1; i <= hi; i++) acc *= BigInt(i);
    return acc;
  }
  const mid = lo + hi >> 1;
  return product(lo, mid) * product(mid + 1, hi);
};
function factorial(n) {
  if (typeof n === "number") {
    assertInteger(n, "n");
    if (n < 0) throw outOfRange("Factorial of negative number is not defined");
    if (n > MAX_FACTORIAL_NUMBER) {
      throw outOfRange(
        `Factorial of ${n} exceeds the maximum representable number; pass a bigint (factorial(${n}n)) for an exact result`
      );
    }
    return numberFactorial(n);
  }
  const k = toInteger(n, "n");
  if (k < 0n) throw outOfRange("Factorial of negative number is not defined");
  if (k > BigInt(MAX_FACTORIAL_BIG)) {
    throw outOfRange(`Factorial is supported up to ${MAX_FACTORIAL_BIG}, received ${k}`);
  }
  const result = k < 2n ? 1n : product(2, Number(k));
  return typeof n === "bigint" ? result : result.toString();
}
var fibonacciTable;
var numberFibonacci = (n) => {
  if (!fibonacciTable) {
    fibonacciTable = [0, 1];
    let a = 0n;
    let b = 1n;
    for (let i = 2; i <= MAX_FIBONACCI_NUMBER; i++) {
      [a, b] = [b, a + b];
      fibonacciTable.push(Number(b));
    }
  }
  return fibonacciTable[n];
};
var bigFibonacci = (n) => {
  let a = 0n;
  let b = 1n;
  for (let bit = 31 - Math.clz32(n); bit >= 0; bit--) {
    const c = a * (2n * b - a);
    const d = a * a + b * b;
    if (n >> bit & 1) {
      a = d;
      b = c + d;
    } else {
      a = c;
      b = d;
    }
  }
  return a;
};
function fibonacci(n) {
  if (typeof n === "number") {
    assertInteger(n, "n");
    if (n < 0) throw outOfRange("Fibonacci of negative number is not defined");
    if (n > MAX_FIBONACCI_NUMBER) {
      throw outOfRange(
        `Fibonacci of ${n} exceeds the maximum representable number; pass a bigint (fibonacci(${n}n)) for an exact result`
      );
    }
    return numberFibonacci(n);
  }
  const k = toInteger(n, "n");
  if (k < 0n) throw outOfRange("Fibonacci of negative number is not defined");
  if (k > BigInt(MAX_FIBONACCI_BIG)) {
    throw outOfRange(`Fibonacci is supported up to ${MAX_FIBONACCI_BIG}, received ${k}`);
  }
  const result = bigFibonacci(Number(k));
  return typeof n === "bigint" ? result : result.toString();
}
var gcdBig = (a, b) => {
  a = a < 0n ? -a : a;
  b = b < 0n ? -b : b;
  while (b !== 0n) [a, b] = [b, a % b];
  return a;
};
var scale = (da, db) => {
  const places = Math.max(da.decimalPlaces(), db.decimalPlaces());
  if (places > MAX_GCD_SCALE) {
    throw outOfRange(`Arguments may have at most ${MAX_GCD_SCALE} decimal places, received ${places}`);
  }
  const factor = new ExactDecimal(`1e${places}`);
  return {
    a: da.abs().mul(factor).toBigInt(),
    b: db.abs().mul(factor).toBigInt(),
    places
  };
};
var fromScaled = (value, places) => Decimal.from(value < 0n, value < 0n ? -value : value, -places);
function gcd(a, b) {
  if (typeof a === "bigint" && typeof b === "bigint") {
    return gcdBig(checkBigInt(a, "a"), checkBigInt(b, "b"));
  }
  if (typeof a === "number" && typeof b === "number" && Number.isSafeInteger(a) && Number.isSafeInteger(b)) {
    let x2 = Math.abs(a);
    let y2 = Math.abs(b);
    while (y2 !== 0) [x2, y2] = [y2, x2 % y2];
    return x2;
  }
  const kind = kindOf(a, b);
  const { a: x, b: y, places } = scale(toDecimal(a, "a"), toDecimal(b, "b"));
  const result = fromScaled(gcdBig(x, y), places);
  return kind === "number" ? decimalToNumber(result) : decimalToString(result);
}
function lcm(a, b) {
  if (typeof a === "bigint" && typeof b === "bigint") {
    checkBigInt(a, "a");
    checkBigInt(b, "b");
    if (a === 0n || b === 0n) return 0n;
    const g = gcdBig(a, b);
    const result2 = guardBigInt(() => a / g * b);
    return checkBigInt(result2 < 0n ? -result2 : result2, "Result");
  }
  const kind = kindOf(a, b);
  const { a: x, b: y, places } = scale(toDecimal(a, "a"), toDecimal(b, "b"));
  const multiple = x === 0n || y === 0n ? 0n : guardBigInt(() => x / gcdBig(x, y) * y);
  const result = fromScaled(multiple, places);
  return kind === "number" ? decimalToNumber(result) : decimalToString(result);
}
var BASES = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n];
var DETERMINISTIC_BOUND = 3317044064679887385961981n;
var modPow = (base, exponent, modulus) => {
  let result = 1n;
  base %= modulus;
  while (exponent > 0n) {
    if (exponent & 1n) result = result * base % modulus;
    base = base * base % modulus;
    exponent >>= 1n;
  }
  return result;
};
var millerRabin = (n) => {
  for (const p of BASES) {
    if (n === p) return true;
    if (n % p === 0n) return false;
  }
  let d = n - 1n;
  let s = 0;
  while ((d & 1n) === 0n) {
    d >>= 1n;
    s++;
  }
  const bases = n < DETERMINISTIC_BOUND ? BASES.slice(0, 13) : BASES;
  witness: for (const a of bases) {
    let x = modPow(a, d, n);
    if (x === 1n || x === n - 1n) continue;
    for (let r = 1; r < s; r++) {
      x = x * x % n;
      if (x === n - 1n) continue witness;
    }
    return false;
  }
  return true;
};
var trialDivision = (n) => {
  if (n <= 3) return n > 1;
  if (n % 2 === 0 || n % 3 === 0) return false;
  for (let i = 5; i * i <= n; i += 6) {
    if (n % i === 0 || n % (i + 2) === 0) return false;
  }
  return true;
};
function isPrime(n) {
  if (typeof n === "number") {
    if (!Number.isInteger(n) || n <= 1) return false;
    if (n < 1e6) return trialDivision(n);
    return Number.isSafeInteger(n) ? millerRabin(BigInt(n)) : false;
  }
  if (typeof n === "string") {
    if (!toDecimal(n, "n").isInteger()) return false;
  }
  const value = typeof n === "bigint" ? n : toDecimal(n, "n").toBigInt();
  if (value <= 1n) return false;
  if (value >= 1n << BigInt(MAX_PRIME_BITS)) {
    throw outOfRange(`n may have at most ${MAX_PRIME_BITS} bits for a primality test`);
  }
  return value < 1000000n ? trialDivision(Number(value)) : millerRabin(value);
}

// src/utils/random.ts
var draw = (random) => {
  const value = random();
  if (typeof value !== "number" || !(value >= 0 && value < 1)) {
    throw outOfRange(`random() must return a number from 0 up to, but not including, 1; received ${describeValue(value)}`);
  }
  return value;
};
var assertRandom = (random) => {
  if (typeof random !== "function") {
    throw new TypeError(`random must be a function, received ${describeValue(random)}`);
  }
};

// src/modules/math/random.ts
var MAX_NUMBER_SPAN = 2 ** 53;
var MAX_REJECTIONS = 64;
var DIRECT_SPAN = 2n ** 32n;
var bitLength = (value) => value === 0n ? 0 : value.toString(16).length * 4;
var randomBelow = (span, random) => {
  if (span <= DIRECT_SPAN) return BigInt(Math.floor(draw(random) * Number(span)));
  const bits = bitLength(span - 1n) || 1;
  const chunks = Math.ceil(bits / 32);
  const excess = BigInt(chunks * 32 - bits);
  let candidate = 0n;
  for (let attempt = 0; attempt < MAX_REJECTIONS; attempt++) {
    candidate = 0n;
    for (let i = 0; i < chunks; i++) {
      const word = Math.floor(draw(random) * 4294967296);
      candidate = candidate << 32n | BigInt(word >>> 0);
    }
    candidate >>= excess;
    if (candidate < span) return candidate;
  }
  return candidate % span;
};
function randomInt(min, max, random = Math.random) {
  assertRandom(random);
  if (typeof min === "bigint" && typeof max === "bigint") {
    checkBigInt(min, "min");
    checkBigInt(max, "max");
    if (min > max) throw outOfRange("min must be less than or equal to max");
    return guardBigInt(() => min + randomBelow(max - min + 1n, random));
  }
  if (typeof min === "bigint" || typeof max === "bigint") {
    throw new NumericTypeError("ERR_INVALID_NUMBER", "min and max must both be numbers or both be bigints");
  }
  assertInteger(min, "min");
  assertInteger(max, "max");
  if (min > max) throw outOfRange("min must be less than or equal to max");
  const span = max - min + 1;
  if (span > MAX_NUMBER_SPAN) {
    throw outOfRange("The range is wider than 2^53; pass bigint bounds instead");
  }
  return min + Math.floor(draw(random) * span);
}

// src/modules/algorithms/helpers.ts
var merge = (left, right, compareFn) => {
  const result = [];
  let leftIndex = 0;
  let rightIndex = 0;
  while (leftIndex < left.length && rightIndex < right.length) {
    if (compareFn(left[leftIndex], right[rightIndex]) <= 0) {
      result.push(left[leftIndex]);
      leftIndex++;
    } else {
      result.push(right[rightIndex]);
      rightIndex++;
    }
  }
  return [...result, ...left.slice(leftIndex), ...right.slice(rightIndex)];
};
var countingSortByDigit = (arr, exp) => {
  const count = new Array(10).fill(0);
  const result = new Array(arr.length);
  for (const num of arr) {
    const digit = (num - num % exp) / exp % 10;
    count[digit]++;
  }
  for (let i = 1; i < 10; i++) {
    count[i] += count[i - 1];
  }
  for (let i = arr.length - 1; i >= 0; i--) {
    const digit = (arr[i] - arr[i] % exp) / exp % 10;
    result[count[digit] - 1] = arr[i];
    count[digit]--;
  }
  return result;
};
var heapify = (arr, n, i, compareFn) => {
  let largest = i;
  const left = 2 * i + 1;
  const right = 2 * i + 2;
  if (left < n && compareFn(arr[left], arr[largest]) > 0) {
    largest = left;
  }
  if (right < n && compareFn(arr[right], arr[largest]) > 0) {
    largest = right;
  }
  if (largest !== i) {
    [arr[i], arr[largest]] = [arr[largest], arr[i]];
    heapify(arr, n, largest, compareFn);
  }
};

// src/modules/helper/conversion.ts
function safeJsonParse(text) {
  if (typeof text !== "string") throw new TypeError("text must be a string");
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch (error2) {
    return { ok: false, error: error2 };
  }
}
function safeJsonStringify(value) {
  try {
    return { ok: true, value: JSON.stringify(value) };
  } catch (error2) {
    return { ok: false, error: error2 };
  }
}
var isPlainObject = (value) => {
  if (typeof value !== "object" || value === null) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
var DECIMAL_TEXT = /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;
function toString(value) {
  if (value === null) return "null";
  if (value === void 0) return "undefined";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || typeof value === "bigint" || typeof value === "symbol") {
    return String(value);
  }
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "Invalid Date" : value.toISOString();
  if (Array.isArray(value) || isPlainObject(value)) {
    try {
      return JSON.stringify(value);
    } catch (error2) {
      const detail = error2 instanceof Error ? `: ${error2.message}` : "";
      throw new TypeError(`value cannot be represented as deterministic JSON${detail}`);
    }
  }
  throw new TypeError("value must be a primitive, Date, array or plain object");
}
function toNumber(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("value must be a finite number");
    return value;
  }
  if (typeof value === "bigint") {
    if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) {
      throw new RangeError("value is outside the safe integer range for number conversion");
    }
    return Number(value);
  }
  if (typeof value !== "string" || value.trim() !== value || !DECIMAL_TEXT.test(value)) throw new TypeError("value must be a non-empty decimal numeric string");
  const result = Number(value);
  if (!Number.isFinite(result)) throw new RangeError("value must be finite and within the JavaScript number range");
  if (Number.isInteger(result) && !Number.isSafeInteger(result)) {
    throw new RangeError("integer text is outside the safe integer range for number conversion");
  }
  return result;
}
function toBoolean(value) {
  if (typeof value === "boolean") return value;
  if (value === 0 || value === "false") return false;
  if (value === 1 || value === "true") return true;
  throw new TypeError('value must be a boolean, 0, 1, "true" or "false"');
}
function toArray(value) {
  if (value === null || value === void 0) return [];
  return Array.isArray(value) ? [...value] : [value];
}
function safeToNumber(value) {
  if (typeof value === "bigint") {
    return value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER) ? Number(value) : null;
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!DECIMAL_TEXT.test(text)) return null;
    const result = Number(text);
    if (result === 0) {
      const exponent = text.search(/[eE]/);
      if (/[1-9]/.test(exponent < 0 ? text : text.slice(0, exponent))) return null;
    }
    return Number.isFinite(result) && (!Number.isInteger(result) || Number.isSafeInteger(result)) ? result : null;
  }
  return typeof value === "number" && Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)) ? value : null;
}
var INTEGER_TEXT = /^[+-]?\d+$/;
function safeToInteger(value) {
  if (typeof value === "string") {
    const text = value.trim();
    if (!INTEGER_TEXT.test(text)) return null;
    const result2 = Number(text);
    return Number.isSafeInteger(result2) ? result2 : null;
  }
  const result = safeToNumber(value);
  return result !== null && Number.isSafeInteger(result) ? result : null;
}
function safeToBigInt(value) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return Number.isSafeInteger(value) ? BigInt(value) : null;
  if (typeof value !== "string") return null;
  const text = value.trim();
  return INTEGER_TEXT.test(text) ? BigInt(text) : null;
}
function safeToBoolean(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") value = value.trim().toLowerCase();
  if (value === 1 || value === "1" || value === "true") return true;
  if (value === 0 || value === "0" || value === "false") return false;
  return null;
}
function safeToString(value) {
  if (value === null || value === void 0 || typeof value === "number" && !Number.isFinite(value)) return null;
  try {
    if (value instanceof Date && !Number.isFinite(value.getTime())) return null;
    const result = toString(value);
    return typeof result === "string" ? result : null;
  } catch {
    return null;
  }
}

// src/modules/helper/query.ts
var UNSAFE_KEYS = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var isPlainObject2 = (value) => {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
};
function buildQueryString(values) {
  if (typeof values !== "object" || values === null || Array.isArray(values) || !isPlainObject2(values)) {
    throw new TypeError("values must be a plain object");
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (UNSAFE_KEYS.has(key)) throw new TypeError(`values must not contain the unsafe key "${key}"`);
    if (value === null || value === void 0) continue;
    if (Array.isArray(value)) value.forEach((item) => params.append(key, String(item)));
    else params.append(key, String(value));
  }
  return params.toString();
}
function parseQueryString(query) {
  if (typeof query !== "string") throw new TypeError("query must be a string");
  const result = /* @__PURE__ */ Object.create(null);
  const params = new URLSearchParams(query.startsWith("?") ? query.slice(1) : query);
  for (const [key, value] of params) {
    if (UNSAFE_KEYS.has(key)) throw new TypeError(`query must not contain the unsafe key "${key}"`);
    const previous = result[key];
    if (previous === void 0) result[key] = value;
    else result[key] = Array.isArray(previous) ? [...previous, value] : [previous, value];
  }
  return result;
}

// src/modules/algorithms/search.ts
var binarySearch = (arr, target, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  let left = 0;
  let right = arr.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const comparison = compareFn(arr[mid], target);
    if (comparison === 0) {
      return mid;
    } else if (comparison < 0) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return -1;
};
var linearSearch = (arr, target, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  for (let i = 0; i < arr.length; i++) {
    if (compareFn(arr[i], target) === 0) {
      return i;
    }
  }
  return -1;
};

// src/modules/algorithms/sort.ts
var MAX_COUNTING_SORT_RANGE = 1e7;
var assertSafeIntegers = (arr) => {
  assertArray(arr, "arr");
  for (let i = 0; i < arr.length; i++) {
    const num = arr[i];
    if (typeof num !== "number" || !Number.isFinite(num)) throw invalidNumber(`arr[${i}]`, num);
    if (!Number.isSafeInteger(num)) {
      throw outOfRange(`Only safe integers are supported, received ${describeValue(num)} at index ${i}`);
    }
  }
};
var quickSort = (arr, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  if (arr.length <= 1) return [...arr];
  const pivot = arr[Math.floor(arr.length / 2)];
  const left = [];
  const equal = [];
  const right = [];
  for (const item of arr) {
    const cmp = compareFn(item, pivot);
    if (cmp < 0) left.push(item);
    else if (cmp > 0) right.push(item);
    else equal.push(item);
  }
  return [
    ...quickSort(left, compareFn),
    ...equal,
    ...quickSort(right, compareFn)
  ];
};
var mergeSort = (arr, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  if (arr.length <= 1) return [...arr];
  const mid = Math.floor(arr.length / 2);
  const left = mergeSort(arr.slice(0, mid), compareFn);
  const right = mergeSort(arr.slice(mid), compareFn);
  return merge(left, right, compareFn);
};
var insertionSort = (arr, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  const result = [...arr];
  for (let i = 1; i < result.length; i++) {
    const current = result[i];
    let j = i - 1;
    while (j >= 0 && compareFn(result[j], current) > 0) {
      result[j + 1] = result[j];
      j--;
    }
    result[j + 1] = current;
  }
  return result;
};
var selectionSort = (arr, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  const result = [...arr];
  for (let i = 0; i < result.length - 1; i++) {
    let minIndex = i;
    for (let j = i + 1; j < result.length; j++) {
      if (compareFn(result[j], result[minIndex]) < 0) {
        minIndex = j;
      }
    }
    if (minIndex !== i) {
      [result[i], result[minIndex]] = [result[minIndex], result[i]];
    }
  }
  return result;
};
var bubbleSort = (arr, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  const result = [...arr];
  let swapped;
  for (let i = 0; i < result.length - 1; i++) {
    swapped = false;
    for (let j = 0; j < result.length - i - 1; j++) {
      if (compareFn(result[j], result[j + 1]) > 0) {
        [result[j], result[j + 1]] = [result[j + 1], result[j]];
        swapped = true;
      }
    }
    if (!swapped) break;
  }
  return result;
};
var heapSort = (arr, compareFn = defaultCompare) => {
  assertArray(arr, "arr");
  const result = [...arr];
  const n = result.length;
  for (let i = Math.floor(n / 2) - 1; i >= 0; i--) {
    heapify(result, n, i, compareFn);
  }
  for (let i = n - 1; i > 0; i--) {
    [result[0], result[i]] = [result[i], result[0]];
    heapify(result, i, 0, compareFn);
  }
  return result;
};
var countingSort = (arr) => {
  assertSafeIntegers(arr);
  if (arr.length <= 1) return [...arr];
  let min = arr[0];
  let max = arr[0];
  for (const num of arr) {
    if (num < min) min = num;
    if (num > max) max = num;
  }
  const range2 = max - min;
  if (range2 > MAX_COUNTING_SORT_RANGE) {
    throw outOfRange(
      `Value range ${range2} exceeds counting sort limit of ${MAX_COUNTING_SORT_RANGE}; use radixSort or mergeSort`
    );
  }
  const count = new Uint32Array(range2 + 1);
  for (const num of arr) count[num - min]++;
  for (let i = 1; i <= range2; i++) count[i] += count[i - 1];
  const result = new Array(arr.length);
  for (let i = arr.length - 1; i >= 0; i--) {
    result[--count[arr[i] - min]] = arr[i];
  }
  return result;
};
var radixSortMagnitudes = (values) => {
  let max = 0;
  for (const v of values) if (v > max) max = v;
  let source = values;
  let target = new Float64Array(values.length);
  const count = new Uint32Array(256);
  for (let divisor = 1; divisor <= max; divisor *= 256) {
    count.fill(0);
    for (let i = 0; i < source.length; i++) count[Math.floor(source[i] / divisor) % 256]++;
    for (let i = 1; i < 256; i++) count[i] += count[i - 1];
    for (let i = source.length - 1; i >= 0; i--) {
      target[--count[Math.floor(source[i] / divisor) % 256]] = source[i];
    }
    [source, target] = [target, source];
  }
  return source;
};
var radixSortBigMagnitudes = (values) => {
  let max = 0n;
  for (const v of values) if (v > max) max = v;
  let source = values;
  let target = new Array(values.length);
  const count = new Uint32Array(65536);
  for (let shift = 0n; max >> shift > 0n; shift += 16n) {
    count.fill(0);
    for (const v of source) count[Number(v >> shift & 0xffffn)]++;
    for (let i = 1; i < 65536; i++) count[i] += count[i - 1];
    for (let i = source.length - 1; i >= 0; i--) {
      target[--count[Number(source[i] >> shift & 0xffffn)]] = source[i];
    }
    [source, target] = [target, source];
  }
  return source;
};
function radixSort(arr) {
  assertArray(arr, "arr");
  if (arr.length > 0 && typeof arr[0] === "bigint") {
    for (let i = 0; i < arr.length; i++) {
      if (typeof arr[i] !== "bigint") throw invalidNumber(`arr[${i}]`, arr[i]);
    }
    const items = arr;
    const negatives2 = radixSortBigMagnitudes(items.filter((v) => v < 0n).map((v) => -v)).reverse().map((v) => -v);
    return negatives2.concat(radixSortBigMagnitudes(items.filter((v) => v >= 0n)));
  }
  assertSafeIntegers(arr);
  if (arr.length <= 1) return [...arr];
  const numbers = arr;
  const negatives = [];
  const positives = [];
  for (const v of numbers) (v < 0 ? negatives : positives).push(v < 0 ? -v : v);
  const sortedNegatives = Array.from(radixSortMagnitudes(Float64Array.from(negatives)), (v) => -v).reverse();
  return sortedNegatives.concat(Array.from(radixSortMagnitudes(Float64Array.from(positives))));
}

// src/modules/object/index.ts
var deepClone = (obj) => {
  return structuredClone(obj);
};
var mergeObjects = (target, source) => {
  assertObject(target, "target");
  assertObject(source, "source");
  return { ...target, ...source };
};
var UNSAFE_KEYS2 = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
var setOwn = (obj, key, value) => {
  Object.defineProperty(obj, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true
  });
};
var isPlainObject3 = (value) => {
  if (typeof value !== "object" || value === null) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
};
var pick = (obj, keys) => {
  assertObject(obj, "obj");
  assertArray(keys, "keys");
  const result = {};
  for (const key of keys) {
    if (hasOwn(obj, key)) setOwn(result, key, obj[key]);
  }
  return result;
};
function pickBy(obj, predicate) {
  assertObject(obj, "obj");
  assertFunction(predicate, "predicate");
  const result = {};
  for (const key of Reflect.ownKeys(obj)) {
    if (!Object.prototype.propertyIsEnumerable.call(obj, key)) continue;
    const value = obj[key];
    if (predicate(value, key, obj)) setOwn(result, key, value);
  }
  return result;
}
var omit = (obj, keys) => {
  assertObject(obj, "obj");
  assertArray(keys, "keys");
  const excluded = new Set(keys);
  const result = {};
  for (const key of Object.keys(obj)) {
    if (!excluded.has(key)) setOwn(result, key, obj[key]);
  }
  return result;
};
var mapValues = (obj, fn) => {
  assertObject(obj, "obj");
  assertFunction(fn, "fn");
  const result = {};
  for (const key of Object.keys(obj)) {
    if (!UNSAFE_KEYS2.has(key)) result[key] = fn(obj[key], key);
  }
  return result;
};
var deepMerge = (target, source) => {
  assertObject(target, "target");
  assertObject(source, "source");
  const result = {};
  const assign = (from) => {
    for (const key of Object.keys(from)) {
      if (UNSAFE_KEYS2.has(key)) continue;
      const value = from[key];
      const existing = result[key];
      result[key] = isPlainObject3(value) ? deepMerge(isPlainObject3(existing) ? existing : {}, value) : isPlainObject3(value) ? {} : value;
    }
  };
  assign(target);
  assign(source);
  return result;
};
var parsePath = (path) => {
  if (Array.isArray(path)) return path.map(String);
  if (typeof path !== "string") throw new TypeError("path must be a string or an array");
  return path.split(/[.[\]]+/).filter(Boolean);
};
var getByPath = (obj, path, defaultValue) => {
  let current = obj;
  for (const key of parsePath(path)) {
    if (current === null || current === void 0) return defaultValue;
    const target = Object(current);
    if (!hasOwn(target, key)) return defaultValue;
    current = target[key];
  }
  return current === void 0 ? defaultValue : current;
};
var hasByPath = (obj, path) => {
  const keys = parsePath(path);
  if (keys.length === 0) return false;
  let current = obj;
  for (let depth = 0; depth < keys.length; depth++) {
    if (typeof current !== "object" && typeof current !== "function" || current === null) return false;
    const descriptor = Object.getOwnPropertyDescriptor(current, keys[depth]);
    if (descriptor === void 0) return false;
    if (depth === keys.length - 1) return true;
    if (!("value" in descriptor)) return false;
    current = descriptor.value;
  }
  return true;
};
var setByPath = (obj, path, value) => {
  if (typeof obj !== "object" || obj === null) throw new TypeError("obj must be an object or an array");
  const keys = parsePath(path);
  if (keys.length === 0) throw new RangeError("path must contain at least one key");
  const unsafe2 = keys.find((key) => UNSAFE_KEYS2.has(key));
  if (unsafe2 !== void 0) throw new TypeError(`path must not contain the unsafe key "${unsafe2}"`);
  const write = (node, depth) => {
    const key = keys[depth];
    let copy;
    if (Array.isArray(node)) copy = [...node];
    else if (isPlainObject3(node)) copy = { ...node };
    else if (node === null || typeof node !== "object") copy = /^(?:0|[1-9]\d*)$/.test(key) ? [] : {};
    else throw new TypeError(`path crosses a non-plain object at "${keys.slice(0, depth).join(".") || "(root)"}"`);
    copy[key] = depth === keys.length - 1 ? value : write(hasOwn(copy, key) ? copy[key] : void 0, depth + 1);
    return copy;
  };
  return write(obj, 0);
};
var deepEqual = (a, b) => {
  const seen = /* @__PURE__ */ new WeakMap();
  const compare = (x, y) => {
    if (x === y || x !== x && y !== y) return true;
    if (typeof x !== "object" || typeof y !== "object" || x === null || y === null) return false;
    if (Object.getPrototypeOf(x) !== Object.getPrototypeOf(y)) return false;
    if (seen.get(x) === y) return true;
    seen.set(x, y);
    if (x instanceof Date) return x.getTime() === y.getTime();
    if (x instanceof RegExp) return String(x) === String(y);
    if (x instanceof Map) {
      const other = y;
      return x.size === other.size && [...x].every(([k, v]) => other.has(k) && compare(v, other.get(k)));
    }
    if (x instanceof Set) {
      const other = y;
      return x.size === other.size && [...x].every((v) => other.has(v));
    }
    const keysX = Object.keys(x);
    return keysX.length === Object.keys(y).length && keysX.every((key) => hasOwn(y, key) && compare(x[key], y[key]));
  };
  return compare(a, b);
};
var isEmpty = (value) => {
  if (value === null || value === void 0) return true;
  if (typeof value === "string" || Array.isArray(value)) return value.length === 0;
  if (value instanceof Map || value instanceof Set) return value.size === 0;
  if (isPlainObject3(value)) return Object.keys(value).length === 0;
  return false;
};

// src/modules/array/manipulation.ts
var unique = (arr, keySelector) => {
  assertArray(arr, "arr");
  if (!keySelector) {
    return [...new Set(arr)];
  }
  assertFunction(keySelector, "keySelector");
  const seen = /* @__PURE__ */ new Set();
  return arr.filter((item) => {
    const key = keySelector(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
var filterBy = (arr, predicate) => {
  assertArray(arr, "arr");
  assertFunction(predicate, "predicate");
  return arr.filter(predicate);
};
var sortBy = (arr, keySelector, order = "asc") => {
  assertArray(arr, "arr");
  assertFunction(keySelector, "keySelector");
  if (order !== "asc" && order !== "desc") {
    throw new RangeError('order must be "asc" or "desc"');
  }
  const compareFn = (a, b) => {
    const valA = keySelector(a);
    const valB = keySelector(b);
    if (valA < valB) return order === "asc" ? -1 : 1;
    if (valA > valB) return order === "asc" ? 1 : -1;
    return 0;
  };
  return [...arr].sort(compareFn);
};
var chunk = (arr, size) => {
  assertArray(arr, "arr");
  assertInteger(size, "size");
  if (size < 1) {
    throw new RangeError("size must be a positive integer");
  }
  return Array.from(
    { length: Math.ceil(arr.length / size) },
    (_, i) => arr.slice(i * size, i * size + size)
  );
};
var flatten = (arr) => {
  assertArray(arr, "arr");
  return arr.flat();
};
var findIndexes = (arr, predicate) => {
  assertArray(arr, "arr");
  assertFunction(predicate, "predicate");
  return arr.reduce((indexes, item, index) => {
    if (predicate(item, index, arr)) {
      indexes.push(index);
    }
    return indexes;
  }, []);
};
var groupBy = (arr, keySelector) => {
  assertArray(arr, "arr");
  assertFunction(keySelector, "keySelector");
  return arr.reduce((result, item) => {
    const key = String(keySelector(item));
    if (!Object.prototype.hasOwnProperty.call(result, key)) {
      result[key] = [];
    }
    result[key].push(item);
    return result;
  }, /* @__PURE__ */ Object.create(null));
};

// src/modules/array/collection.ts
var compact = (arr) => {
  assertArray(arr, "arr");
  return arr.filter(Boolean);
};
var compactNullish = (arr) => {
  assertArray(arr, "arr");
  return arr.filter((item) => item !== null && item !== void 0);
};
var difference = (arr, values) => {
  assertArray(arr, "arr");
  assertArray(values, "values");
  const exclude = new Set(values);
  return arr.filter((item) => !exclude.has(item));
};
var intersection = (arr, values) => {
  assertArray(arr, "arr");
  assertArray(values, "values");
  const include = new Set(values);
  return [...new Set(arr)].filter((item) => include.has(item));
};
var union = (...arrays) => {
  arrays.forEach((arr) => assertArray(arr, "arrays"));
  return [...new Set(arrays.flat())];
};
var partition = (arr, predicate) => {
  assertArray(arr, "arr");
  assertFunction(predicate, "predicate");
  const pass = [];
  const fail = [];
  arr.forEach((item, index) => (predicate(item, index) ? pass : fail).push(item));
  return [pass, fail];
};
var countBy = (arr, keySelector) => {
  assertArray(arr, "arr");
  assertFunction(keySelector, "keySelector");
  const result = /* @__PURE__ */ Object.create(null);
  for (const item of arr) {
    const key = String(keySelector(item));
    result[key] = (result[key] ?? 0) + 1;
  }
  return result;
};
var keyBy = (arr, keySelector) => {
  assertArray(arr, "arr");
  assertFunction(keySelector, "keySelector");
  const result = /* @__PURE__ */ Object.create(null);
  for (const item of arr) {
    result[String(keySelector(item))] = item;
  }
  return result;
};
var zip = (a, b) => {
  assertArray(a, "a");
  assertArray(b, "b");
  return Array.from({ length: Math.min(a.length, b.length) }, (_, i) => [a[i], b[i]]);
};
var MAX_RANGE_LENGTH = 1e7;
var range = (start, end, step) => {
  assertFiniteNumber(start, "start");
  const from = end === void 0 ? 0 : start;
  const to = end === void 0 ? start : end;
  assertFiniteNumber(to, "end");
  const increment = step ?? (to >= from ? 1 : -1);
  assertFiniteNumber(increment, "step");
  if (increment === 0) throw outOfRange("step must not be 0");
  if (Math.abs(from) > Number.MAX_SAFE_INTEGER || Math.abs(to) > Number.MAX_SAFE_INTEGER) {
    throw outOfRange("start and end must not exceed 2^53 - 1 in magnitude");
  }
  if (Number.isInteger(from) && Number.isInteger(to) && Number.isInteger(increment)) {
    const length2 = Math.max(Math.ceil((to - from) / increment), 0);
    if (length2 > MAX_RANGE_LENGTH) throw outOfRange(`range would create ${length2} items; the limit is ${MAX_RANGE_LENGTH}`);
    return Array.from({ length: length2 }, (_, i) => from + i * increment);
  }
  const base = new ExactDecimal(from);
  const delta = new ExactDecimal(increment);
  const count = divideDecimals(new ExactDecimal(to).sub(base), delta, 40).ceil();
  const length = count.isNeg() ? 0 : count.toNumber();
  if (length > MAX_RANGE_LENGTH) throw outOfRange(`range would create ${length} items; the limit is ${MAX_RANGE_LENGTH}`);
  return Array.from({ length }, (_, i) => base.add(delta.mul(i)).toNumber());
};
var shuffle = (arr, random = Math.random) => {
  assertArray(arr, "arr");
  assertRandom(random);
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(draw(random) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
};
var sample = (arr, random = Math.random) => {
  assertArray(arr, "arr");
  assertRandom(random);
  return arr.length === 0 ? void 0 : arr[Math.floor(draw(random) * arr.length)];
};
var flattenDeep = (arr, depth = Infinity) => {
  assertArray(arr, "arr");
  if (depth !== Infinity) assertInteger(depth, "depth");
  return arr.flat(depth);
};

// src/modules/function/index.ts
function getAbortError(signal) {
  if (signal?.reason) return signal.reason;
  if (typeof DOMException === "function") {
    return new DOMException("This operation was aborted", "AbortError");
  }
  const error2 = new Error("This operation was aborted");
  error2.name = "AbortError";
  return error2;
}
function isAbortError(error2) {
  return typeof error2 === "object" && error2 !== null && "name" in error2 && error2.name === "AbortError";
}
async function wait(time, { signal } = {}) {
  assertWait(time, "time");
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(getAbortError(signal));
      return;
    }
    const cleanup = () => signal?.removeEventListener("abort", onAbort);
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, time);
    const onAbort = () => {
      clearTimeout(timeout);
      cleanup();
      reject(getAbortError(signal));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
function withRetry(fn, {
  delay: delay_ = 100,
  retryCount = 2,
  shouldRetry = () => true,
  signal
} = {}) {
  return new Promise((resolve, reject) => {
    const attemptRetry = async ({ count = 0 } = {}) => {
      if (signal?.aborted) {
        reject(getAbortError(signal));
        return;
      }
      const retry2 = async ({ error: error2 }) => {
        const delay = typeof delay_ === "function" ? delay_({ count, error: error2 }) : delay_;
        if (delay) {
          try {
            await wait(delay, { signal });
          } catch (error3) {
            reject(error3);
            return;
          }
        }
        return attemptRetry({ count: count + 1 });
      };
      try {
        const data = await fn();
        resolve(data);
      } catch (error2) {
        if (signal?.aborted) {
          reject(getAbortError(signal));
          return;
        }
        if (isAbortError(error2)) {
          reject(error2);
          return;
        }
        if (count < retryCount && await shouldRetry({ count, error: error2 })) {
          return retry2({ error: error2 });
        }
        reject(error2);
      }
    };
    void attemptRetry().catch(reject);
  });
}
var assertWait = (value, name) => {
  assertFiniteNumber(value, name);
  if (value < 0) throw new RangeError(`${name} must be non-negative`);
};
function debounce(fn, wait2, options = {}) {
  assertFunction(fn, "fn");
  assertWait(wait2, "wait");
  const { leading = false, trailing = true } = options;
  let timer;
  let pending;
  let result;
  const invoke = () => {
    const run = pending;
    pending = void 0;
    result = run();
  };
  const debounced = function(...args) {
    const startsBurst = timer === void 0;
    pending = () => fn.apply(this, args);
    if (timer !== void 0) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = void 0;
      if (trailing && pending) invoke();
      pending = void 0;
    }, wait2);
    if (leading && startsBurst) invoke();
    return result;
  };
  debounced.cancel = () => {
    if (timer !== void 0) clearTimeout(timer);
    timer = void 0;
    pending = void 0;
  };
  debounced.flush = () => {
    if (timer !== void 0) {
      clearTimeout(timer);
      timer = void 0;
      if (pending) invoke();
    }
    return result;
  };
  return debounced;
}
function throttle(fn, wait2, options = {}) {
  assertFunction(fn, "fn");
  assertWait(wait2, "wait");
  const { leading = true, trailing = true } = options;
  let timer;
  let lastCall = 0;
  let pending;
  let result;
  const throttled = function(...args) {
    const now = Date.now();
    if (!lastCall && !leading) lastCall = now;
    const remaining = wait2 - (now - lastCall);
    pending = () => fn.apply(this, args);
    if (remaining <= 0 || remaining > wait2) {
      if (timer !== void 0) clearTimeout(timer);
      timer = void 0;
      lastCall = now;
      pending = void 0;
      result = fn.apply(this, args);
    } else if (timer === void 0 && trailing) {
      timer = setTimeout(() => {
        timer = void 0;
        lastCall = leading ? Date.now() : 0;
        if (pending) {
          const run = pending;
          pending = void 0;
          result = run();
        }
      }, remaining);
    }
    return result;
  };
  throttled.cancel = () => {
    if (timer !== void 0) clearTimeout(timer);
    timer = void 0;
    lastCall = 0;
    pending = void 0;
  };
  return throttled;
}
function memoize(fn, options = {}) {
  assertFunction(fn, "fn");
  const { resolver, maxSize = Infinity } = options;
  if (resolver !== void 0) assertFunction(resolver, "resolver");
  if (maxSize !== Infinity && (!Number.isInteger(maxSize) || maxSize < 1)) {
    throw new RangeError("maxSize must be a positive integer");
  }
  const cache = /* @__PURE__ */ new Map();
  const memoized = function(...args) {
    const key = resolver ? resolver(...args) : args[0];
    if (cache.has(key)) return cache.get(key);
    const value = fn.apply(this, args);
    cache.set(key, value);
    if (cache.size > maxSize) cache.delete(cache.keys().next().value);
    return value;
  };
  memoized.cache = cache;
  memoized.clear = () => cache.clear();
  return memoized;
}
function once(fn) {
  assertFunction(fn, "fn");
  let called = false;
  let result;
  return function(...args) {
    if (!called) {
      called = true;
      result = fn.apply(this, args);
    }
    return result;
  };
}
function sleep(ms) {
  assertWait(ms, "ms");
  return new Promise((resolve) => setTimeout(resolve, ms));
}
async function retry(fn, options = {}) {
  assertFunction(fn, "fn");
  const { retries = 3, delayMs = 0, factor = 1, shouldRetry } = options;
  if (!Number.isInteger(retries) || retries < 0) {
    throw new RangeError("retries must be a non-negative integer");
  }
  assertWait(delayMs, "delayMs");
  assertFiniteNumber(factor, "factor");
  if (factor < 1) throw new RangeError("factor must be at least 1");
  let delay = delayMs;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error2) {
      if (attempt >= retries || shouldRetry && !shouldRetry(error2, attempt + 1)) throw error2;
      if (delay > 0) await sleep(delay);
      delay *= factor;
    }
  }
}
function withTimeout(promise, ms, message) {
  assertWait(ms, "ms");
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error2 = new Error(message ?? `Timed out after ${ms}ms`);
      error2.name = "TimeoutError";
      reject(error2);
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error2) => {
        clearTimeout(timer);
        reject(error2);
      }
    );
  });
}

// src/modules/validator/guards.ts
function isNil(value) {
  return value === null || value === void 0;
}
function isDefined(value) {
  return value !== null && value !== void 0;
}
function isString(value) {
  return typeof value === "string";
}
function isNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isBoolean(value) {
  return typeof value === "boolean";
}
function isFunction(value) {
  return typeof value === "function";
}
function isPromiseLike(value) {
  if (typeof value !== "object" && typeof value !== "function" || value === null) return false;
  try {
    return typeof value.then === "function";
  } catch {
    return false;
  }
}

// src/modules/validator/index.ts
var EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/u;
var UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-([1-8])[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function isEmail(value) {
  if (typeof value !== "string" || value.length > 254) return false;
  if (!EMAIL_PATTERN.test(value)) return false;
  const [local, domain] = value.split("@");
  return local.length <= 64 && !local.startsWith(".") && !local.endsWith(".") && !local.includes("..") && !domain.startsWith(".") && !domain.startsWith("-") && !domain.includes("..");
}
function isUrl(value, options = {}) {
  if (typeof value !== "string" || value.trim() !== value || value === "") return false;
  const { protocols = ["http:", "https:"] } = options;
  try {
    const url = new URL(value);
    return protocols.includes(url.protocol) && (url.hostname !== "" || url.protocol === "file:");
  } catch {
    return false;
  }
}
function isUuid(value, version) {
  if (typeof value !== "string") return false;
  const match = UUID_PATTERN.exec(value);
  return match !== null && (version === void 0 || Number(match[1]) === version);
}

// src/modules/timezone/index.ts
function isTimeZone(value) {
  if (typeof value !== "string") return false;
  try {
    new Intl.DateTimeFormat(void 0, { timeZone: value });
    return true;
  } catch {
    return false;
  }
}
function getTimeZoneOffset(date = /* @__PURE__ */ new Date(), timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone, options = {}) {
  const { unit: unit2 = "minutes", direction = "utc" } = options;
  if (unit2 !== "seconds" && unit2 !== "minutes" && unit2 !== "hours") {
    throw new RangeError(`Unsupported time zone offset unit: ${String(unit2)}`);
  }
  if (direction !== "utc" && direction !== "native") {
    throw new RangeError(`Unsupported time zone offset direction: ${String(direction)}`);
  }
  const seconds = getOffsetSeconds(date, timeZone);
  const signedSeconds = direction === "native" ? -seconds : seconds;
  const divisor = unit2 === "seconds" ? 1 : unit2 === "minutes" ? 60 : 3600;
  const offset = signedSeconds / divisor;
  return offset === 0 ? 0 : offset;
}
function getTimeZoneName(date, timeZone, locale = "en-US", style = "short") {
  getOffsetFormatter(timeZone);
  const parts = new Intl.DateTimeFormat(locale, { timeZone, timeZoneName: style }).formatToParts(toValidDate(date));
  return parts.find(({ type }) => type === "timeZoneName")?.value ?? "";
}
function formatInTimeZone(date, timeZone, locale = "en-US", options = { dateStyle: "medium", timeStyle: "medium" }) {
  getOffsetFormatter(timeZone);
  return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(toValidDate(date));
}

// src/modules/date/index.ts
var checked = (date, what) => {
  if (Number.isNaN(date.getTime())) throw new RangeError(`${what} is outside the range of dates JavaScript can represent`);
  return date;
};
var daysInLocalMonth = (year, month) => {
  const result = /* @__PURE__ */ new Date(0);
  result.setHours(0, 0, 0, 0);
  result.setFullYear(year, month + 1, 0);
  return result.getDate();
};
function addDays(date, amount) {
  assertInteger(amount, "amount");
  const result = new Date(toValidDate(date));
  result.setDate(result.getDate() + amount);
  return checked(result, "Result");
}
function addMonths(date, amount) {
  assertInteger(amount, "amount");
  const result = new Date(toValidDate(date));
  const day = result.getDate();
  result.setDate(1);
  result.setMonth(result.getMonth() + amount);
  const lastDay = daysInLocalMonth(result.getFullYear(), result.getMonth());
  result.setDate(Math.min(day, lastDay));
  return checked(result, "Result");
}
function addWeeks(date, amount) {
  assertInteger(amount, "amount");
  return addDays(date, amount * 7);
}
function subDays(date, amount) {
  assertInteger(amount, "amount");
  return addDays(date, -amount);
}
function subWeeks(date, amount) {
  assertInteger(amount, "amount");
  return addWeeks(date, -amount);
}
function subMonths(date, amount) {
  assertInteger(amount, "amount");
  return addMonths(date, -amount);
}
function addYears(date, amount) {
  assertInteger(amount, "amount");
  return addMonths(date, amount * 12);
}
function subYears(date, amount) {
  assertInteger(amount, "amount");
  return addYears(date, -amount);
}
function startOfDay(date) {
  const result = new Date(toValidDate(date));
  result.setHours(0, 0, 0, 0);
  return result;
}
function endOfDay(date) {
  const result = new Date(toValidDate(date));
  result.setHours(23, 59, 59, 999);
  return result;
}
var weekStartsOnOf = (options) => {
  const weekStartsOn = options.weekStartsOn ?? 0;
  assertInteger(weekStartsOn, "options.weekStartsOn");
  if (weekStartsOn < 0 || weekStartsOn > 6) {
    throw new RangeError("options.weekStartsOn must be an integer from 0 through 6");
  }
  return weekStartsOn;
};
function startOfWeek2(date, options = {}) {
  const result = startOfDay(date);
  const offset = (result.getDay() - weekStartsOnOf(options) + 7) % 7;
  result.setDate(result.getDate() - offset);
  return result;
}
function endOfWeek(date, options = {}) {
  const result = startOfWeek2(date, options);
  result.setDate(result.getDate() + 6);
  return endOfDay(result);
}
function startOfISOWeek(date) {
  return startOfWeek2(date, { weekStartsOn: 1 });
}
function endOfISOWeek(date) {
  return endOfWeek(date, { weekStartsOn: 1 });
}
function startOfMonth(date) {
  const result = startOfDay(date);
  result.setDate(1);
  return result;
}
function endOfMonth(date) {
  const result = startOfMonth(date);
  result.setMonth(result.getMonth() + 1, 0);
  return endOfDay(result);
}
function startOfYear(date) {
  const result = startOfDay(date);
  result.setMonth(0, 1);
  return result;
}
function endOfYear(date) {
  const result = startOfYear(date);
  result.setFullYear(result.getFullYear() + 1);
  result.setMilliseconds(-1);
  return result;
}
function differenceInCalendarDays(later, earlier) {
  const a = toValidDate(later);
  const b = toValidDate(earlier);
  return epochDay(a.getFullYear(), a.getMonth(), a.getDate()) - epochDay(b.getFullYear(), b.getMonth(), b.getDate());
}
function isBefore(date, dateToCompare) {
  return toValidDate(date).getTime() < toValidDate(dateToCompare).getTime();
}
function isAfter(date, dateToCompare) {
  return toValidDate(date).getTime() > toValidDate(dateToCompare).getTime();
}
function isEqualDate(date, dateToCompare) {
  return toValidDate(date).getTime() === toValidDate(dateToCompare).getTime();
}
function isSameDay(dateLeft, dateRight) {
  const left = toValidDate(dateLeft);
  const right = toValidDate(dateRight);
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth() && left.getDate() === right.getDate();
}
function isSameMonth(dateLeft, dateRight) {
  const left = toValidDate(dateLeft);
  const right = toValidDate(dateRight);
  return left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();
}
function isSameYear(dateLeft, dateRight) {
  return toValidDate(dateLeft).getFullYear() === toValidDate(dateRight).getFullYear();
}
var nowOf = (options) => toValidDate(options.now ?? /* @__PURE__ */ new Date());
function isToday(date, options = {}) {
  return isSameDay(date, nowOf(options));
}
function isYesterday(date, options = {}) {
  return isSameDay(date, subDays(nowOf(options), 1));
}
function isTomorrow(date, options = {}) {
  return isSameDay(date, addDays(nowOf(options), 1));
}
function isWithinInterval(date, interval) {
  if (typeof interval !== "object" || interval === null) throw new TypeError("interval must be an object with start and end dates");
  const value = toValidDate(date).getTime();
  const start = toValidDate(interval.start).getTime();
  const end = toValidDate(interval.end).getTime();
  if (start > end) throw new RangeError("interval.start must be before or equal to interval.end");
  return value >= start && value <= end;
}
var sign = (value) => value === 0 ? 0 : value < 0 ? -1 : 1;
function differenceInDays(later, earlier) {
  const end = toValidDate(later);
  const start = toValidDate(earlier);
  const direction = sign(end.getTime() - start.getTime());
  if (direction === 0) return 0;
  const calendarDays = Math.abs(differenceInCalendarDays(end, start));
  const candidate = addDays(start, direction * calendarDays);
  const partial = direction > 0 ? candidate.getTime() > end.getTime() : candidate.getTime() < end.getTime();
  const result = direction * (calendarDays - Number(partial));
  return result === 0 ? 0 : result;
}
function differenceInCalendarMonths(later, earlier) {
  const end = toValidDate(later);
  const start = toValidDate(earlier);
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}
function differenceInMonths(later, earlier) {
  const end = toValidDate(later);
  const start = toValidDate(earlier);
  const months = differenceInCalendarMonths(end, start);
  const direction = sign(months);
  if (direction === 0) return 0;
  const candidate = addMonths(start, months);
  const partial = direction > 0 ? candidate.getTime() > end.getTime() : candidate.getTime() < end.getTime();
  const result = months - direction * Number(partial);
  return result === 0 ? 0 : result;
}
function differenceInYears(later, earlier) {
  const end = toValidDate(later);
  const start = toValidDate(earlier);
  const years = end.getFullYear() - start.getFullYear();
  const direction = sign(years);
  if (direction === 0) return 0;
  const candidate = addYears(start, years);
  const partial = direction > 0 ? candidate.getTime() > end.getTime() : candidate.getTime() < end.getTime();
  const result = years - direction * Number(partial);
  return result === 0 ? 0 : result;
}
function getDaysInMonth(date) {
  const value = toValidDate(date);
  return daysInLocalMonth(value.getFullYear(), value.getMonth());
}
function getDayOfYear(date) {
  const value = toValidDate(date);
  return epochDay(value.getFullYear(), value.getMonth(), value.getDate()) - epochDay(value.getFullYear(), 0, 1) + 1;
}
function isLeapYear2(date) {
  const year = toValidDate(date).getFullYear();
  return year % 400 === 0 || year % 4 === 0 && year % 100 !== 0;
}

// src/modules/runtime/index.ts
var globalObject = () => globalThis;
function isBrowser() {
  const windowLike = globalObject().window;
  return typeof windowLike === "object" && windowLike !== null && typeof windowLike.document === "object";
}
function hasDOM() {
  const documentLike = globalObject().document;
  return typeof documentLike === "object" && documentLike !== null && typeof documentLike.createElement === "function";
}
function isWebWorker() {
  const workerGlobalScope = globalObject().WorkerGlobalScope;
  const selfLike = globalObject().self;
  return typeof workerGlobalScope === "function" && typeof selfLike === "object" && selfLike !== null && selfLike instanceof workerGlobalScope;
}
function isNode() {
  const processLike = globalObject().process;
  return typeof processLike?.versions?.node === "string";
}
var isBun = () => typeof globalObject().Bun === "object" && globalObject().Bun !== null;
function isClient() {
  return isBrowser() || isWebWorker();
}
function isServer() {
  return isNode() || isBun();
}

// src/modules/money/index.ts
var modes = ["up", "down", "ceil", "floor", "half-up", "half-down", "half-even"];
function scale2(options) {
  if (!options || typeof options.currency !== "string") throw new TypeError("currency must be a string");
  const code = options.currency.toUpperCase();
  if (!Object.values(countryCurrencies).some((codes) => codes.includes(code))) throw outOfRange("Unsupported currency");
  if (options.roundingMode !== void 0 && !modes.includes(options.roundingMode)) throw outOfRange("Invalid roundingMode");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
}
function ratio(value, name) {
  const d = toDecimal(value, name);
  return guardBigInt(() => {
    const signed = d.neg ? -d.c : d.c;
    return d.x >= 0 ? [signed * 10n ** BigInt(d.x), 1n] : [signed, 10n ** BigInt(-d.x)];
  });
}
function rounded(n, d, mode) {
  const neg = n < 0n;
  const a = neg ? -n : n;
  let q = a / d;
  const r = a % d;
  if (r !== 0n) {
    if (mode === void 0) throw outOfRange("Amount exceeds currency precision; provide roundingMode");
    const up = mode === "up" || mode === "ceil" && !neg || mode === "floor" && neg || mode.startsWith("half-") && (r * 2n > d || r * 2n === d && (mode === "half-up" || mode === "half-even" && q % 2n !== 0n));
    if (up) q++;
  }
  return checkBigInt(neg ? -q : q, "Money result");
}
function render(value, digits) {
  checkBigInt(value, "Money result");
  const text = (value < 0n ? -value : value).toString().padStart(digits + 1, "0");
  return (value < 0n ? "-" : "") + (digits ? text.slice(0, -digits) + "." + text.slice(-digits) : text);
}
function toMinorUnits(amount, options) {
  const digits = scale2(options);
  const [n, d] = ratio(amount, "amount");
  return guardBigInt(() => rounded(n * 10n ** BigInt(digits), d, options.roundingMode));
}
function fromMinorUnits(amount, options) {
  const digits = scale2(options);
  if (typeof amount !== "bigint" && (typeof amount !== "string" || !/^[+-]?\d+$/.test(amount))) throw new TypeError("minor units must be bigint or integer string");
  const value = toDecimal(amount, "amount").toBigInt();
  return render(value, digits);
}
function allocateMoney(amount, ratios, options) {
  const digits = scale2(options);
  const units = toMinorUnits(amount, options);
  if (!Array.isArray(ratios) || ratios.length === 0) throw outOfRange("ratios must be nonempty");
  const parsed = Array.from(ratios, (v) => toDecimal(v, "ratio"));
  if (parsed.some((v) => v.neg && !v.isZero())) throw outOfRange("ratios must be nonnegative");
  const exp = parsed.reduce((min, v) => Math.min(min, v.x), 0);
  return guardBigInt(() => {
    const weights = parsed.map((v) => v.c * 10n ** BigInt(v.x - exp));
    const total = weights.reduce((a, b) => a + b, 0n);
    if (!total) throw outOfRange("ratio total must be positive");
    const magnitude = units < 0n ? -units : units;
    const shares = weights.map((w) => magnitude * w / total);
    let left = magnitude - shares.reduce((a, b) => a + b, 0n);
    const order = weights.map((w, i) => ({ i, remainder: magnitude * w % total })).sort((a, b) => a.remainder > b.remainder ? -1 : a.remainder < b.remainder ? 1 : a.i - b.i);
    for (const { i } of order) {
      if (left === 0n) break;
      shares[i]++;
      left--;
    }
    return shares.map((v) => render(units < 0n ? -v : v, digits));
  });
}
function calculateTax(amount, rate, options) {
  const digits = scale2(options);
  const units = toMinorUnits(amount, options);
  const [n, d] = ratio(rate, "rate");
  if (n < 0n || !["inclusive", "exclusive"].includes(options.mode)) throw outOfRange("Invalid tax options");
  return guardBigInt(() => {
    const subtotal = options.mode === "inclusive" ? rounded(units * d, d + n, options.roundingMode ?? "half-even") : units;
    const tax = options.mode === "inclusive" ? units - subtotal : rounded(units * n, d, options.roundingMode ?? "half-even");
    return { subtotal: render(subtotal, digits), tax: render(tax, digits), total: render(subtotal + tax, digits) };
  });
}
function applyDiscount(amount, discount, options) {
  const digits = scale2(options);
  const units = toMinorUnits(amount, options);
  const original = toDecimal(amount, "amount");
  if (original.neg && !original.isZero() || !discount || !["fixed", "percentage"].includes(discount.type)) throw outOfRange("Invalid discount");
  const [n, d] = ratio(discount.value, "discount");
  if (n < 0n || discount.type === "percentage" && n > 100n * d) throw outOfRange("Invalid discount value");
  return guardBigInt(() => {
    if (discount.type === "fixed" && toDecimal(discount.value, "discount").gt(original)) throw outOfRange("Discount exceeds original amount");
    const reduction = discount.type === "fixed" ? toMinorUnits(discount.value, options) : rounded(units * n, d * 100n, options.roundingMode ?? "half-even");
    if (reduction > units) throw outOfRange("Discount exceeds original amount");
    return { original: render(units, digits), discount: render(reduction, digits), final: render(units - reduction, digits) };
  });
}

// src/modules/locale/index.ts
function parse(value, options, style, currencyOptions) {
  if (typeof value !== "string") throw new TypeError("value must be a string");
  if (!options || typeof options.locale !== "string" || !options.locale) throw new TypeError("locale must be a nonempty string");
  if (value.length > MAX_EXPONENT2 * 2 + 100) throw outOfRange("Localized input is too long");
  let currency;
  if (style === "currency") {
    if (typeof currencyOptions?.currency !== "string") throw new TypeError("currency must be a string");
    currency = currencyOptions.currency.toUpperCase();
    if (!Object.values(countryCurrencies).some((codes) => codes.includes(currency))) throw outOfRange("Unsupported currency");
    if (currencyOptions.currencyDisplay !== void 0 && !["symbol", "code", "narrowSymbol"].includes(currencyOptions.currencyDisplay)) throw outOfRange("Invalid currencyDisplay");
    if (currencyOptions.currencySign !== void 0 && !["standard", "accounting"].includes(currencyOptions.currencySign)) throw outOfRange("Invalid currencySign");
  }
  const formatter = new Intl.NumberFormat(options.locale, {
    style,
    currency,
    currencyDisplay: currencyOptions?.currencyDisplay,
    currencySign: currencyOptions?.currencySign,
    maximumFractionDigits: 20
  });
  const decimalSeparator = formatter.formatToParts(1.1234567).find((p) => p.type === "decimal")?.value;
  const groupParts = formatter.formatToParts(123456789012345n);
  const groupSeparator = groupParts.find((p) => p.type === "group")?.value;
  const digits = /* @__PURE__ */ new Map();
  const digitFormatter = new Intl.NumberFormat(options.locale, { useGrouping: false });
  for (let i = 0; i < 10; i++) digits.set(digitFormatter.format(i), String(i));
  const lengths = groupParts.filter((p) => p.type === "integer").map((p) => [...p.value].length);
  const primary = lengths[lengths.length - 1];
  const secondary = lengths[lengths.length - 2] ?? primary;
  const numericTypes = /* @__PURE__ */ new Set(["integer", "group", "decimal", "fraction"]);
  let body;
  let negative = false;
  for (const sample2 of [12345.6, -12345.6]) {
    const parts = formatter.formatToParts(sample2);
    const start = parts.findIndex((p) => numericTypes.has(p.type));
    let end = parts.length - 1;
    while (!numericTypes.has(parts[end].type)) end--;
    const prefix = parts.slice(0, start).map((p) => p.value).join("");
    const suffix = parts.slice(end + 1).map((p) => p.value).join("");
    if (value.startsWith(prefix) && value.endsWith(suffix)) {
      const candidate = value.slice(prefix.length, suffix ? -suffix.length : void 0);
      if ([...candidate].some((c) => digits.has(c))) {
        const forbidden = [...candidate].some((c) => !digits.has(c) && c !== decimalSeparator && c !== groupSeparator);
        if (!forbidden) {
          body = candidate;
          negative = sample2 < 0;
          break;
        }
      }
    }
  }
  if (body === void 0) throw outOfRange("Localized affix or digits do not match locale");
  const fractions = decimalSeparator ? body.split(decimalSeparator) : [body];
  if (fractions.length > 2 || !fractions[0] || fractions.length === 2 && !fractions[1]) throw outOfRange("Malformed localized decimal");
  const groups = groupSeparator ? fractions[0].split(groupSeparator) : [fractions[0]];
  const decode = (text) => {
    let result = "";
    for (const char of text) {
      const digit = digits.get(char);
      if (digit === void 0) throw outOfRange("Invalid localized digit");
      result += digit;
    }
    return result;
  };
  const integerGroups = groups.map(decode);
  if (integerGroups.some((g) => !g)) throw outOfRange("Empty digit group");
  if (groups.length > 1) {
    if (integerGroups[integerGroups.length - 1].length !== primary || integerGroups[0].length > secondary || integerGroups.slice(1, -1).some((g) => g.length !== secondary)) throw outOfRange("Malformed grouping");
    const totalDigits = integerGroups.reduce((n, g) => n + g.length, 0);
    const sampleExponent = totalDigits - (style === "percent" ? 3 : 1);
    if (totalDigits <= 15 && sampleExponent >= 0 && !formatter.formatToParts(10n ** BigInt(sampleExponent)).some((p) => p.type === "group")) throw outOfRange("Grouping not used at this magnitude");
  }
  const fraction = fractions.length === 2 ? decode(fractions[1]) : "";
  const canonical = (negative ? "-" : "") + integerGroups.join("") + (fraction ? "." + fraction : "");
  const parsed = toDecimal(canonical, "value");
  if (style !== "percent" || parsed.isZero()) return decimalToString(parsed);
  return decimalToString(toDecimal(`${decimalToString(parsed)}e-2`, "percent"));
}
function parseLocalizedNumber(value, options) {
  return parse(value, options, "decimal");
}
function parseLocalizedCurrency(value, options) {
  return parse(value, options, "currency", options);
}
function parseLocalizedPercent(value, options) {
  return parse(value, options, "percent");
}

// src/modules/normalization/index.ts
var error = (path, code) => ({ path, code, message: `Normalization failed: ${code}` });
var unsafe = /* @__PURE__ */ new Set(["__proto__", "constructor", "prototype"]);
var plain = (v) => typeof v === "object" && v !== null && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
var arrayLength = (value) => {
  if (!Array.isArray(value)) throw new TypeError();
  const descriptor = Object.getOwnPropertyDescriptor(value, "length");
  if (!descriptor || !("value" in descriptor) || !Number.isSafeInteger(descriptor.value) || descriptor.value < 0) throw new TypeError();
  return descriptor.value;
};
function normalizeRecord(input, schema, options = {}) {
  const errors = [];
  const data = {};
  try {
    if (!plain(input) || !plain(schema)) return { success: false, errors: [error([], "INVALID_RECORD")] };
    if (options.unknownKeys !== void 0 && options.unknownKeys !== "strip" && options.unknownKeys !== "reject") throw new TypeError();
    const fields = Object.getOwnPropertyDescriptors(schema);
    for (const key of Reflect.ownKeys(fields)) {
      if (typeof key !== "string" || unsafe.has(key)) {
        errors.push(error([], "UNSAFE_SCHEMA_KEY"));
        continue;
      }
      const descriptor = fields[key];
      if (!("value" in descriptor)) {
        errors.push(error([key], "ACCESSOR"));
        continue;
      }
      const field = descriptor.value;
      let fn = field;
      let fallback;
      if (typeof field !== "function") {
        if (!plain(field)) {
          errors.push(error([key], "INVALID_SCHEMA"));
          continue;
        }
        const fd = Object.getOwnPropertyDescriptor(field, "normalize");
        fn = fd && "value" in fd ? fd.value : void 0;
        fallback = Object.getOwnPropertyDescriptor(field, "default");
      }
      if (typeof fn !== "function") {
        errors.push(error([key], "INVALID_SCHEMA"));
        continue;
      }
      const source = Object.getOwnPropertyDescriptor(input, key) ?? fallback;
      if (!source) {
        errors.push(error([key], "MISSING_FIELD"));
        continue;
      }
      if (!("value" in source)) {
        errors.push(error([key], "ACCESSOR"));
        continue;
      }
      try {
        const value = Reflect.apply(fn, void 0, [source.value]);
        if (value === null || value === void 0) errors.push(error([key], "INVALID_FIELD"));
        else Object.defineProperty(data, key, { value, enumerable: true, writable: true, configurable: true });
      } catch {
        errors.push(error([key], "INVALID_FIELD"));
      }
    }
    for (const key of Reflect.ownKeys(input)) {
      const own = Object.getOwnPropertyDescriptor(input, key);
      if (own && !("value" in own)) errors.push(error([String(key)], "ACCESSOR"));
      else if (options.unknownKeys === "reject" && (typeof key !== "string" || !Object.prototype.hasOwnProperty.call(fields, key))) errors.push(error([String(key)], "UNKNOWN_FIELD"));
    }
  } catch {
    errors.push(error([], "INVALID_RECORD"));
  }
  return errors.length ? { success: false, errors } : { success: true, data };
}
function normalizeArray(input, normalizer, options = {}) {
  const entries = [];
  const errors = [];
  let length;
  let onError;
  try {
    onError = options.onError;
    if (onError !== void 0 && onError !== "collect" && onError !== "fail-fast") throw new TypeError();
  } catch {
    throw new TypeError("Invalid normalization error policy");
  }
  try {
    if (!Array.isArray(input) || typeof normalizer !== "function") throw new TypeError();
    length = arrayLength(input);
  } catch {
    return { success: false, entries, errors: [error([], "INVALID_ARRAY")] };
  }
  for (let index = 0; index < length; index++) {
    try {
      const descriptor = Object.getOwnPropertyDescriptor(input, index);
      if (!descriptor) errors.push(error([index], "MISSING_ENTRY"));
      else if (!("value" in descriptor)) errors.push(error([index], "ACCESSOR"));
      else {
        const result = normalizer(descriptor.value);
        if (!plain(result)) throw new TypeError();
        const status = Object.getOwnPropertyDescriptor(result, "success");
        if (!status || !("value" in status)) throw new TypeError();
        if (status.value === true) {
          const data = Object.getOwnPropertyDescriptor(result, "data");
          if (!data || !("value" in data)) throw new TypeError();
          entries.push({ index, data: data.value });
        } else if (status.value === false) {
          const issues = Object.getOwnPropertyDescriptor(result, "errors");
          if (!issues || !("value" in issues)) throw new TypeError();
          const issuesLength = arrayLength(issues.value);
          if (issuesLength === 0) throw new TypeError();
          const validated = [];
          for (let i = 0; i < issuesLength; i++) {
            const item = Object.getOwnPropertyDescriptor(issues.value, i);
            if (!item || !("value" in item) || !plain(item.value)) throw new TypeError();
            const fields = Object.getOwnPropertyDescriptors(item.value);
            if (!fields.path || !("value" in fields.path) || !Array.isArray(fields.path.value) || !fields.code || !("value" in fields.code) || typeof fields.code.value !== "string") throw new TypeError();
            const pathLength = arrayLength(fields.path.value);
            const path = [index];
            for (let p = 0; p < pathLength; p++) {
              const segment = Object.getOwnPropertyDescriptor(fields.path.value, p);
              if (!segment || !("value" in segment) || typeof segment.value !== "string" && (typeof segment.value !== "number" || !Number.isSafeInteger(segment.value))) throw new TypeError();
              path.push(segment.value);
            }
            validated.push(error(path, fields.code.value));
          }
          errors.push(...validated);
        } else throw new TypeError();
      }
    } catch {
      errors.push(error([index], "INVALID_ENTRY"));
    }
    if (errors.length && onError === "fail-fast") break;
  }
  return errors.length ? { success: false, entries, errors } : { success: true, data: entries.map((entry) => entry.data) };
}

// src/modules/security/index.ts
function isSafeRedirectUrl(value, options = {}) {
  try {
    if (!options || typeof options !== "object" || options.allowRelative !== void 0 && typeof options.allowRelative !== "boolean" || options.allowedOrigins !== void 0 && (!Array.isArray(options.allowedOrigins) || !options.allowedOrigins.every((origin) => typeof origin === "string"))) return false;
    if (typeof value !== "string" || !value || /[\s\\\u0000-\u001f\u007f]/u.test(value) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|2f|5c|25)/i.test(value)) return false;
    encodeURI(value);
    decodeURIComponent(value);
    if (value.startsWith("/")) return options.allowRelative !== false && !value.startsWith("//");
    if (!/^https?:\/\//i.test(value)) return false;
    try {
      const target = new URL(value);
      if (target.username || target.password) return false;
      return (options.allowedOrigins ?? []).some((origin) => {
        const allowed = new URL(origin);
        return !allowed.username && !allowed.password && allowed.pathname === "/" && !allowed.search && !allowed.hash && (allowed.protocol === "https:" || allowed.protocol === "http:") && allowed.origin === target.origin;
      });
    } catch {
      return false;
    }
  } catch {
    return false;
  }
}
function getSafeRedirectTarget(value, options) {
  try {
    const fallback = options.fallback;
    if (!isSafeRedirectUrl(fallback, options)) throw new TypeError();
    return typeof value === "string" && isSafeRedirectUrl(value, options) ? value : fallback;
  } catch {
    throw new TypeError("Invalid redirect fallback");
  }
}
function redactSensitiveFields(value, options) {
  try {
    if (!options || typeof options !== "object" || !Array.isArray(options.keys) || !options.keys.every((key) => typeof key === "string") || options.replacement !== void 0 && typeof options.replacement !== "string" || options.caseSensitive !== void 0 && typeof options.caseSensitive !== "boolean") throw new TypeError();
    const seen = /* @__PURE__ */ new WeakMap();
    const keys = new Set(options.keys.map((key) => options.caseSensitive ? key : key.toLowerCase()));
    const replacement = options.replacement ?? "[REDACTED]";
    const clone = (node) => {
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
      const output = Array.isArray(node) ? [] : Object.create(prototype);
      seen.set(node, output);
      for (const key of Reflect.ownKeys(node)) {
        const descriptor = Object.getOwnPropertyDescriptor(node, key);
        if (!descriptor || !("value" in descriptor)) throw new TypeError();
        const matches = typeof key === "string" && keys.has(options.caseSensitive ? key : key.toLowerCase());
        Object.defineProperty(output, key, { ...descriptor, value: matches ? replacement : clone(descriptor.value) });
      }
      return output;
    };
    return clone(value);
  } catch {
    throw new TypeError("Unsupported value for redaction");
  }
}
function sanitizeUrlForLogging(value, options = {}) {
  try {
    if (!options || typeof options !== "object" || options.sensitiveQueryKeys !== void 0 && (!Array.isArray(options.sensitiveQueryKeys) || !options.sensitiveQueryKeys.every((key) => typeof key === "string")) || options.replacement !== void 0 && typeof options.replacement !== "string" || options.caseSensitive !== void 0 && typeof options.caseSensitive !== "boolean" || options.preserveFragment !== void 0 && typeof options.preserveFragment !== "boolean") return "[INVALID_URL]";
    if (typeof value !== "string") return "[INVALID_URL]";
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "[INVALID_URL]";
    url.username = "";
    url.password = "";
    if (!options.preserveFragment) url.hash = "";
    const keys = new Set((options.sensitiveQueryKeys ?? ["token", "password", "secret", "api_key", "access_token", "authorization"]).map((key) => options.caseSensitive ? key : key.toLowerCase()));
    const params = new URLSearchParams();
    url.searchParams.forEach((entry, key) => params.append(key, keys.has(options.caseSensitive ? key : key.toLowerCase()) ? options.replacement ?? "[REDACTED]" : entry));
    url.search = params.toString();
    return url.href;
  } catch {
    return "[INVALID_URL]";
  }
}

// src/modules/function/concurrent.ts
function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive safe integer`);
  }
}
function schedule(length, task, options, settled) {
  positiveInteger(options.concurrency, "concurrency");
  return new Promise((resolve, reject) => {
    const { signal, concurrency } = options;
    const results = new Array(length);
    let next = 0;
    let active = 0;
    let completed = 0;
    let stopped = false;
    const cleanup = () => signal?.removeEventListener("abort", abort);
    const fail = (reason) => {
      if (stopped) return;
      stopped = true;
      cleanup();
      reject(reason);
    };
    const abort = () => fail(signal?.reason);
    if (signal?.aborted) {
      abort();
      return;
    }
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
        let value;
        try {
          value = task(index);
        } catch (reason) {
          active--;
          if (!settled) {
            fail(reason);
            return;
          }
          results[index] = { status: "rejected", reason };
          completed++;
          continue;
        }
        Promise.resolve(value).then(
          (result) => {
            if (stopped) return;
            results[index] = settled ? { status: "fulfilled", value: result } : result;
            active--;
            completed++;
            launch();
          },
          (reason) => {
            if (stopped) return;
            if (!settled) {
              fail(reason);
              return;
            }
            results[index] = { status: "rejected", reason };
            active--;
            completed++;
            launch();
          }
        );
      }
      if (!stopped && completed === length) launch();
    };
    launch();
  });
}
function mapConcurrent(items, mapper, options) {
  if (!Array.isArray(items) || typeof mapper !== "function") throw new TypeError("Expected an array and mapper");
  return schedule(items.length, (i) => mapper(items[i], i), options, false);
}
function mapSettledConcurrent(items, mapper, options) {
  if (!Array.isArray(items) || typeof mapper !== "function") throw new TypeError("Expected an array and mapper");
  return schedule(items.length, (i) => mapper(items[i], i), options, true);
}
function batchAsync(items, processor, options) {
  if (!Array.isArray(items) || typeof processor !== "function") throw new TypeError("Expected an array and processor");
  const { batchSize } = options;
  positiveInteger(batchSize, "batchSize");
  return schedule(Math.ceil(items.length / batchSize), (i) => {
    const start = i * batchSize;
    return processor(items.slice(start, start + batchSize));
  }, { concurrency: options.concurrency ?? 1, signal: options.signal }, false);
}

// src/modules/date/business.ts
var DAY = 864e5;
var MIN = -719528;
var MAX = 2932896;
var weekday = (day) => ((day + 4) % 7 + 7) % 7;
function parseDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new RangeError("Expected YYYY-MM-DD");
  const year = +value.slice(0, 4), month = +value.slice(5, 7), day = +value.slice(8);
  const date = /* @__PURE__ */ new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RangeError("Invalid Gregorian calendar date");
  }
  return date.getTime() / DAY;
}
function formatDate2(day) {
  if (day < MIN || day > MAX) throw new RangeError("Calendar result outside years 0000 through 9999");
  return new Date(day * DAY).toISOString().slice(0, 10);
}
function calendar(options) {
  const weekend = options.weekend ?? [0, 6];
  if (!Array.isArray(weekend) || Array.from(weekend).some((n) => !Number.isInteger(n) || n < 0 || n > 6)) throw new RangeError("Invalid weekend");
  const excluded = new Set(weekend);
  if (excluded.size === 7) throw new RangeError("Calendar must contain a working weekday");
  if (options.holidays !== void 0 && !Array.isArray(options.holidays)) throw new TypeError("holidays must be an array");
  const holidays = [...new Set(Array.from(options.holidays ?? [], parseDate))].filter((day) => !excluded.has(weekday(day))).sort((a, b) => a - b);
  const lower = (day) => {
    let lo = 0, hi = holidays.length;
    while (lo < hi) {
      const mid = lo + hi >>> 1;
      if (holidays[mid] < day) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  };
  const count = (start, end) => {
    const length = end - start;
    let total = Math.floor(length / 7) * (7 - excluded.size);
    for (let i = 0; i < length % 7; i++) if (!excluded.has(weekday(start + i))) total++;
    return total - (lower(end) - lower(start));
  };
  return { count, isBusiness: (day) => !excluded.has(weekday(day)) && holidays[lower(day)] !== day };
}
function isBusinessDay(date, options = {}) {
  return calendar(options).isBusiness(parseDate(date));
}
function addBusinessDays(date, amount, options = {}) {
  const start = parseDate(date), rules = calendar(options);
  if (!Number.isSafeInteger(amount)) throw new RangeError("amount must be a safe integer");
  if (amount === 0) return date;
  const positive = amount > 0, target = Math.abs(amount);
  const available = positive ? MAX - start : start - MIN;
  const count = (distance) => positive ? rules.count(start + 1, start + distance + 1) : rules.count(start - distance, start);
  if (count(available) < target) throw new RangeError("Calendar result outside years 0000 through 9999");
  let low = 1, high = available;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (count(mid) >= target) high = mid;
    else low = mid + 1;
  }
  return formatDate2(start + (positive ? low : -low));
}
function differenceInBusinessDays(start, end, options = {}) {
  const a = parseDate(start), b = parseDate(end), rules = calendar(options);
  return a <= b ? rules.count(a, b) : -rules.count(b, a);
}
function nextBusinessDay(date, options = {}) {
  return addBusinessDays(date, 1, options);
}

export { NumericRangeError, NumericTypeError, abs, addBusinessDays, addDays, addMonths, addWeeks, addYears, allocateMoney, applyDiscount, averageBig, averageValueInArray, batchAsync, binarySearch, bubbleSort, buildQueryString, calculateTax, camelCase, capitalize, chunk, clamp, compact, compactNullish, compareNumbers, countBy, countWords, countingSort, countingSortByDigit, debounce, deepClone, deepEqual, deepMerge, difference, differenceInBusinessDays, differenceInCalendarDays, differenceInCalendarMonths, differenceInDays, differenceInMonths, differenceInYears, divide, drop, endOfDay, endOfISOWeek, endOfMonth, endOfWeek, endOfYear, enumerate, escapeHtml, escapeRegExp, factorial, fibonacci, filterBy, findIndexes, findMax, findMin, first, firstChar, flatten, flattenDeep, formatBytes, formatCompactNumber, formatCurrency, formatDate, formatDuration, formatInTimeZone, formatNumber, formatPercent, formatRelativeTime, formatUnit, fromMinorUnits, gcd, getAbortError, getByPath, getCountryCurrencies, getCurrencyName, getCurrencySymbol, getDayOfYear, getDaysInMonth, getSafeRedirectTarget, getTimeZoneName, getTimeZoneOffset, groupBy, hasByPath, hasDOM, heapSort, heapify, insertionSort, intersection, isAbortError, isAfter, isBefore, isBoolean, isBrowser, isBusinessDay, isClient, isDefined, isEmail, isEmpty, isEqualDate, isFunction, isLeapYear2 as isLeapYear, isNil, isNode, isNumber, isNumeric, isPlainObject3 as isPlainObject, isPrime, isPromiseLike, isSafeRedirectUrl, isSameDay, isSameMonth, isSameYear, isServer, isString, isTimeZone, isToday, isTomorrow, isUrl, isUuid, isValidDate, isWebWorker, isWithinInterval, isYesterday, kebabCase, keyBy, last, lastChar, lcm, linearSearch, lstrip, mapConcurrent, mapSettledConcurrent, mapValues, maskString, maxBy, median, medianBig, memoize, merge, mergeObjects, mergeSort, minBy, modulo, multiply, nextBusinessDay, normalizeArray, normalizeRecord, normalizeWhitespace, omit, once, parseBytes, parseDuration, parseISO, parseLocalizedCurrency, parseLocalizedNumber, parseLocalizedPercent, parseQueryString, partition, pascalCase, percentage, pick, pickBy, power, quickSort, radixSort, randomInt, range, redactSensitiveFields, removeDiacritics, retry, reverseText, round, rstrip, safeJsonParse, safeJsonStringify, safeToBigInt, safeToBoolean, safeToInteger, safeToNumber, safeToString, sample, sanitizeUrlForLogging, selectionSort, setByPath, shortenString, shuffle, sleep, slugify, snakeCase, sort, sortBy, startOfDay, startOfISOWeek, startOfMonth, startOfWeek2 as startOfWeek, startOfYear, strip, subDays, subMonths, subWeeks, subYears, subtract, sumBig, sumBy, sumValueInArray, summary, take, throttle, title, titleCase, toArray, toBoolean, toDecimalString, toMinorUnits, toNumber, toString, truncateText, unescapeHtml, union, unique, wait, withRetry, withTimeout, zip };
