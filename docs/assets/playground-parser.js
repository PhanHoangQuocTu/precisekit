// A deliberately small evaluator for the public documentation playground.
// It accepts only allowlisted synchronous API calls and JSON-like data literals.
// User-provided text is parsed as data and is never dynamically executed.

export const PLAYGROUND_FUNCTIONS = new Set([
  "summary", "multiply", "divide", "round", "percentage", "formatCurrency", "formatBytes",
  "factorial", "power", "isPrime", "fibonacci", "gcd",
  "formatDate", "addMonths", "differenceInCalendarDays", "getTimeZoneOffset", "parseDuration", "formatDuration",
  "strip", "lstrip", "rstrip", "title", "firstChar", "lastChar", "normalizeWhitespace",
  "safeToNumber", "safeToInteger", "safeToBigInt", "safeToBoolean", "safeToString",
  "slugify", "truncateText", "maskString", "camelCase", "escapeRegExp", "setByPath", "parseBytes",
  "toMinorUnits", "fromMinorUnits", "allocateMoney", "calculateTax", "applyDiscount",
  "parseLocalizedNumber", "parseLocalizedCurrency", "parseLocalizedPercent",
  "isBusinessDay", "addBusinessDays", "differenceInBusinessDays", "nextBusinessDay",
  "isSafeRedirectUrl", "getSafeRedirectTarget", "redactSensitiveFields", "sanitizeUrlForLogging",
]);

const MAX_SOURCE_LENGTH = 10_000;
const MAX_LINES = 40;
const MAX_DEPTH = 12;
const MAX_ITEMS = 200;
const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);

class ParseError extends Error {
  constructor(message) {
    super(message);
    this.name = "PlaygroundSyntaxError";
  }
}

class Parser {
  constructor(source, library) {
    this.source = source;
    this.library = library;
    this.at = 0;
  }

  fail(message) {
    throw new ParseError(`${message} at column ${this.at + 1}.`);
  }

  skipSpace() {
    while (/\s/.test(this.source[this.at] ?? "")) this.at++;
  }

  take(char) {
    this.skipSpace();
    if (this.source[this.at] !== char) return false;
    this.at++;
    return true;
  }

  expect(char) {
    if (!this.take(char)) this.fail(`Expected ${JSON.stringify(char)}`);
  }

  identifier() {
    this.skipSpace();
    const match = /^[A-Za-z_$][\w$]*/.exec(this.source.slice(this.at));
    if (!match) this.fail("Expected an identifier");
    this.at += match[0].length;
    return match[0];
  }

  string() {
    this.skipSpace();
    const quote = this.source[this.at];
    if (quote !== '"' && quote !== "'") this.fail("Expected a quoted string");
    this.at++;
    let value = "";
    while (this.at < this.source.length) {
      const char = this.source[this.at++];
      if (char === quote) return value;
      if (char !== "\\") {
        value += char;
        continue;
      }
      const escaped = this.source[this.at++];
      if (escaped === undefined) this.fail("Unfinished escape sequence");
      const simple = { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", v: "\v", 0: "\0" };
      if (escaped in simple) value += simple[escaped];
      else if (escaped === "u") {
        const hex = this.source.slice(this.at, this.at + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) this.fail("Invalid Unicode escape");
        value += String.fromCharCode(Number.parseInt(hex, 16));
        this.at += 4;
      } else value += escaped;
    }
    this.fail("Unterminated string");
  }

  number() {
    this.skipSpace();
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?n?/.exec(this.source.slice(this.at));
    if (!match) this.fail("Expected a number");
    const token = match[0];
    const next = this.source[this.at + token.length];
    if (next && /[A-Za-z_$]/.test(next)) this.fail("Invalid number");
    this.at += token.length;
    if (token.endsWith("n")) {
      if (/[.eE]/.test(token)) this.fail("A bigint must be an integer");
      return BigInt(token.slice(0, -1));
    }
    const value = Number(token);
    if (!Number.isFinite(value)) this.fail("Number must be finite");
    return value;
  }

  array(depth) {
    this.expect("[");
    const value = [];
    this.skipSpace();
    if (this.take("]")) return value;
    while (true) {
      if (value.length >= MAX_ITEMS) this.fail(`Arrays may contain at most ${MAX_ITEMS} items`);
      value.push(this.expression(depth + 1));
      if (this.take("]")) return value;
      this.expect(",");
    }
  }

  object(depth) {
    this.expect("{");
    const value = {};
    let count = 0;
    this.skipSpace();
    if (this.take("}")) return value;
    while (true) {
      if (count++ >= MAX_ITEMS) this.fail(`Objects may contain at most ${MAX_ITEMS} properties`);
      this.skipSpace();
      const char = this.source[this.at];
      const key = char === '"' || char === "'" ? this.string() : this.identifier();
      if (FORBIDDEN_KEYS.has(key)) this.fail(`Property ${JSON.stringify(key)} is not allowed`);
      this.expect(":");
      value[key] = this.expression(depth + 1);
      if (this.take("}")) return value;
      this.expect(",");
    }
  }

  call(name, depth) {
    if (!PLAYGROUND_FUNCTIONS.has(name)) this.fail(`${name} is not available in the playground`);
    const fn = this.library?.[name];
    if (typeof fn !== "function") this.fail(`${name} is unavailable in this build`);
    this.expect("(");
    const args = [];
    this.skipSpace();
    if (!this.take(")")) {
      while (true) {
        if (args.length >= MAX_ITEMS) this.fail(`Calls may contain at most ${MAX_ITEMS} arguments`);
        args.push(this.expression(depth + 1));
        if (this.take(")")) break;
        this.expect(",");
      }
    }
    const result = fn(...args);
    if (result && typeof result.then === "function") this.fail("Async functions are not available in the playground");
    return result;
  }

  expression(depth = 0) {
    if (depth > MAX_DEPTH) this.fail(`Values may be nested at most ${MAX_DEPTH} levels`);
    this.skipSpace();
    const char = this.source[this.at];
    if (char === '"' || char === "'") return this.string();
    if (char === "[") return this.array(depth);
    if (char === "{") return this.object(depth);
    if (char === "-" || /\d/.test(char ?? "")) return this.number();
    const name = this.identifier();
    if (name === "true") return true;
    if (name === "false") return false;
    if (name === "null") return null;
    this.skipSpace();
    if (this.source[this.at] === "(") return this.call(name, depth);
    this.fail("Only literals and supported function calls are allowed");
  }

  parse() {
    const value = this.expression();
    this.skipSpace();
    if (this.at !== this.source.length) this.fail("Unexpected input");
    return value;
  }
}

const withoutComment = (line) => {
  let quote = null;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (quote) {
      if (char === "\\") index++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'") quote = char;
    else if (char === "/" && line[index + 1] === "/") return line.slice(0, index);
  }
  return line;
};

export const runPlayground = (source, library) => {
  if (typeof source !== "string") return [{ kind: "bad", text: "Input must be text." }];
  if (source.length > MAX_SOURCE_LENGTH) return [{ kind: "bad", text: `Input is limited to ${MAX_SOURCE_LENGTH.toLocaleString()} characters.` }];
  const lines = source.split("\n");
  if (lines.length > MAX_LINES) return [{ kind: "bad", text: `Input is limited to ${MAX_LINES} lines.` }];
  return lines.map((line) => {
    const expression = withoutComment(line).trim().replace(/;$/, "");
    if (!expression) return { kind: "skip", text: "" };
    try {
      return { kind: "ok", value: new Parser(expression, library).parse() };
    } catch (error) {
      return { kind: "bad", text: error instanceof Error ? error.message : "Could not run this line." };
    }
  });
};
