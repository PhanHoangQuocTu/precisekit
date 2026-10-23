// Enhancements for the documentation page. The page is complete without JavaScript; this adds the live
// drift gauge, the playground, the searchable API reference, copy buttons and the theme switch.
// The demos run the real, unminified package from ./precisekit.mjs (a copy of dist/index.mjs).

import { GROUPS } from "../api-data.js";
import { runPlayground } from "./playground-parser.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value) => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const safeStorage = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch { /* storage can be blocked */ } },
};

// ---------------------------------------------------------------- theme
const root = document.documentElement;
const savedTheme = safeStorage.get("fdc-theme");
if (savedTheme === "light" || savedTheme === "dark") root.dataset.theme = savedTheme;
const themeButton = $("#theme");
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches);
const syncThemeButton = () => themeButton?.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
themeButton?.addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  safeStorage.set("fdc-theme", root.dataset.theme);
  syncThemeButton();
});
syncThemeButton();

// ---------------------------------------------------------------- copy buttons
const flash = (button, text) => {
  const original = button.dataset.label ?? (button.dataset.label = button.textContent);
  button.textContent = text;
  setTimeout(() => (button.textContent = original), 1400);
};
document.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-copy], [data-copy-text]");
  if (!button) return;
  const text = button.dataset.copyText ?? document.getElementById(button.dataset.copy)?.textContent ?? "";
  try {
    await navigator.clipboard.writeText(text);
    flash(button, "Copied");
  } catch {
    flash(button, "Select and copy");
  }
});

// ---------------------------------------------------------------- install tabs
const installCommands = { npm: "npm install @fatdevcon/precisekit", pnpm: "pnpm add @fatdevcon/precisekit", yarn: "yarn add @fatdevcon/precisekit", bun: "bun add @fatdevcon/precisekit" };
$$(".install-tabs button").forEach((tab) => {
  tab.addEventListener("click", () => {
    $$(".install-tabs button").forEach((other) => other.setAttribute("aria-selected", String(other === tab)));
    const command = installCommands[tab.dataset.pm];
    $("#install-cmd").textContent = command;
    $("#install-copy").dataset.copyText = command;
  });
});

// ---------------------------------------------------------------- syntax highlighting
const KEYWORDS = new Set("import from export const let var function return if else for while of in new await async try catch throw typeof true false null undefined type interface".split(" "));
let knownFunctions = new Set();
const highlight = (code) => {
  const pattern = /(\/\/[^\n]*)|("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?n?\b)|([A-Za-z_$][\w$]*)/g;
  let out = "";
  let last = 0;
  for (const match of code.matchAll(pattern)) {
    out += esc(code.slice(last, match.index));
    const [text, comment, string, number, word] = match;
    if (comment) out += `<span class="tk-c">${esc(text)}</span>`;
    else if (string) out += `<span class="tk-s">${esc(text)}</span>`;
    else if (number) out += `<span class="tk-n">${esc(text)}</span>`;
    else if (KEYWORDS.has(word)) out += `<span class="tk-k">${esc(text)}</span>`;
    else if (knownFunctions.has(word) && code[match.index + text.length] === "(") out += `<span class="tk-f">${esc(text)}</span>`;
    else out += esc(text);
    last = match.index + text.length;
  }
  return out + esc(code.slice(last));
};
const codeBlock = (code, extraClass = "") =>
  `<div class="code ${extraClass}"><button class="copy" type="button" data-copy-text="${esc(code).replace(/"/g, "&quot;")}">Copy</button><pre><code>${highlight(code)}</code></pre></div>`;

// ---------------------------------------------------------------- load the package
let lib = null;
try {
  lib = await import("./precisekit.mjs");
  knownFunctions = new Set(Object.keys(lib));
} catch (error) {
  console.warn("Live demos are disabled because the package build could not be loaded:", error);
  $$("[data-needs-lib]").forEach((element) => (element.hidden = true));
}
$$("pre.hl code").forEach((element) => {
  const source = element.textContent;
  element.innerHTML = highlight(source);
  const copy = document.createElement("button");
  copy.type = "button";
  copy.className = "copy";
  copy.textContent = "Copy";
  copy.dataset.copyText = source;
  element.closest(".code")?.prepend(copy);
});

// ---------------------------------------------------------------- drift gauge
const nativeValue = (value) => (Object.is(value, -0) ? "-0" : String(value));
const GAUGE_PRESETS = {
  add: { label: "0.1 + 0.2", native: ["0.1 + 0.2", () => 0.1 + 0.2], exact: ["summary(0.1, 0.2)", () => lib.summary(0.1, 0.2)] },
  round: { label: "round 1.005", native: ["Math.round(1.005 * 100) / 100", () => Math.round(1.005 * 100) / 100], exact: ["round(1.005, 2)", () => lib.round(1.005, 2)] },
  sum: { label: "sum of prices", native: ["[0.1, 0.2, 0.3].reduce((a, b) => a + b)", () => [0.1, 0.2, 0.3].reduce((a, b) => a + b)], exact: ["sumValueInArray([0.1, 0.2, 0.3])", () => lib.sumValueInArray([0.1, 0.2, 0.3])] },
  big: { label: "past 2^53", native: ["9007199254740993 + 2", () => 9007199254740993 + 2], exact: ['summary("9007199254740993", 2)', () => lib.summary("9007199254740993", 2)] },
};
const OPS = { "+": ["summary", (a, b) => a + b], "−": ["subtract", (a, b) => a - b], "×": ["multiply", (a, b) => a * b], "÷": ["divide", (a, b) => a / b] };

/** Mark the digits where the native result stops agreeing with the exact one. */
const markDrift = (nativeText, exactText) => {
  if (nativeText === exactText) return { html: esc(nativeText), note: "Matches the exact result." };
  if (exactText.startsWith(nativeText)) return { html: esc(nativeText), note: "Correct, but a double keeps only about 16 digits." };
  let at = 0;
  while (at < nativeText.length && at < exactText.length && nativeText[at] === exactText[at]) at++;
  return { html: `${esc(nativeText.slice(0, at))}<span class="drift">${esc(nativeText.slice(at))}</span>`, note: "The highlighted digits are floating-point error." };
};

const gauge = $(".gauge");
if (gauge && lib) {
  let preset = "add";
  let op = "+";
  const customA = $("#gauge-a");
  const customB = $("#gauge-b");
  const setRow = (id, expression, html, note, isError) => {
    $(`#${id}-expr`).textContent = expression;
    $(`#${id}-value`).innerHTML = html;
    const noteElement = $(`#${id}-note`);
    noteElement.textContent = note;
    noteElement.classList.toggle("is-error", Boolean(isError));
  };
  const render = () => {
    let nativeExpression;
    let exactExpression;
    let nativeText;
    let exactText;
    let error = null;
    if (preset === "custom") {
      const [name, nativeOp] = OPS[op];
      const a = customA.value.trim();
      const b = customB.value.trim();
      nativeExpression = `${a || "a"} ${op === "−" ? "-" : op === "×" ? "*" : op === "÷" ? "/" : "+"} ${b || "b"}`;
      exactExpression = `${name}("${a}", "${b}")`;
      nativeText = nativeValue(nativeOp(Number(a), Number(b)));
      try {
        exactText = String(lib[name](a, b));
      } catch (caught) {
        error = caught;
      }
    } else {
      const spec = GAUGE_PRESETS[preset];
      [nativeExpression] = spec.native;
      [exactExpression] = spec.exact;
      nativeText = nativeValue(spec.native[1]());
      exactText = String(spec.exact[1]());
    }
    if (error) {
      setRow("native", nativeExpression, esc(nativeText), "");
      setRow("exact", exactExpression, "Unavailable", `${error.code ?? error.name}: ${error.message}`, true);
      return;
    }
    const { html, note } = markDrift(nativeText, exactText);
    setRow("native", nativeExpression, html, note);
    setRow("exact", exactExpression, esc(exactText), "Exact: no digits are lost.");
  };
  $$(".gauge-tabs button").forEach((button) =>
    button.addEventListener("click", () => {
      preset = button.dataset.preset;
      $$(".gauge-tabs button").forEach((other) => other.setAttribute("aria-selected", String(other === button)));
      $(".gauge-custom").hidden = preset !== "custom";
      render();
    })
  );
  $$(".ops button").forEach((button) =>
    button.addEventListener("click", () => {
      op = button.textContent;
      $$(".ops button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
      render();
    })
  );
  [customA, customB].forEach((input) => input.addEventListener("input", render));
  render();
}

// ---------------------------------------------------------------- playground
const SAMPLES = {
  Cleaning: `title(strip("   nguyen van an   "))
lstrip("   hello   ")
rstrip("   hello   ")
strip("abbahelloab", "ab")
title("đẶNG vĂN lÂM-o'CONNOR")
firstChar("👨‍👩‍👧‍👦family")
lastChar("hello👍🏽")
normalizeWhitespace("  Hello    world  ")`,
  "Safe conversion": `safeToNumber(" 12.5 ")
safeToNumber("9007199254740993")
safeToNumber("1e-999")
safeToNumber("")
safeToInteger("1.5")
safeToBigInt("9007199254740993")
safeToBoolean(" FALSE ")
safeToString({ name: "An" })`,
  Money: `// Supported function calls and data literals only.
toMinorUnits("123.45", { currency: "USD" })
allocateMoney("10.00", [1, 1, 1], { currency: "USD" })
calculateTax("100.00", "0.08", { currency: "USD", mode: "exclusive" })
applyDiscount("100.00", { type: "percentage", value: "15" }, { currency: "USD" })
summary(0.1, 0.2)
multiply("19.99", 3)
divide("1", "3", { precision: 12 })
round(2.675, 2)
formatCurrency("12345678901234567890.129", "USD")
formatCurrency(1234.5, "VND", "vi-VN")
percentage(25, 200)`,
  "Big numbers": `factorial(30n)
summary("100000000000000000000000000000", 1)
power(2n, 100n)
isPrime("170141183460469231731687303715884105727")
fibonacci(100n)
gcd("0.5", "0.25")
formatBytes("1500000000000000000000000000000")`,
  Dates: `formatDate("2026-01-31T09:30:00", "EEEE, do MMMM yyyy HH:mm")
addBusinessDays("2026-12-24", 1, { holidays: ["2026-12-25"] })
formatDate(addMonths("2026-01-31T09:30:00", 1), "yyyy-MM-dd")
differenceInCalendarDays("2026-12-25", "2026-01-31")
formatDate("2026-01-15T17:30:00Z", "HH:mm xxx", { timeZone: "Asia/Ho_Chi_Minh" })
getTimeZoneOffset("2026-01-15T12:00:00Z", "America/New_York", { unit: "hours" })
parseDuration("1h 2m 3s")
formatDuration(90061000, { maxUnits: 2 })`,
  Text: `slugify("Đặng Thị Tú, Hà Nội 2026")
truncateText("👨‍👩‍👧‍👦🇻🇳 emoji stay whole", 8)
maskString("4111111111111111")
camelCase("hello big world")
escapeRegExp("1+1=2 (really?)")
setByPath({ a: 1 }, "b.c[0]", true)
parseBytes("1.5 GiB")`,
  Locale: `parseLocalizedNumber("1.234,56", { locale: "de-DE" })
parseLocalizedCurrency("$1,234.56", { locale: "en-US", currency: "USD" })
parseLocalizedPercent("12.5%", { locale: "en-US" })`,
  Security: `isSafeRedirectUrl("/dashboard", { allowedOrigins: ["https://example.com"] })
getSafeRedirectTarget("https://evil.example", { fallback: "/", allowedOrigins: ["https://example.com"] })
redactSensitiveFields({ password: "secret", user: "minh" }, { keys: ["password"] })
sanitizeUrlForLogging("https://example.com/?token=secret&page=1")`,
};

const formatResult = (value) => {
  const seen = new WeakSet();
  const render = (item, depth) => {
    if (item === undefined) return "undefined";
    if (typeof item === "bigint") return `${item}n`;
    if (typeof item === "string") return JSON.stringify(item);
    if (typeof item === "number") return Object.is(item, -0) ? "-0" : String(item);
    if (typeof item === "function") return `[Function ${item.name || "anonymous"}]`;
    if (item instanceof Date) return Number.isNaN(item.getTime()) ? "Invalid Date" : `Date ${item.toISOString()}`;
    if (item instanceof Error) return `${item.name}${item.code ? ` ${item.code}` : ""}: ${item.message}`;
    if (item === null || typeof item !== "object") return String(item);
    if (seen.has(item)) return "[Circular]";
    if (depth > 4) return Array.isArray(item) ? "[…]" : "{…}";
    seen.add(item);
    if (item instanceof Map) return `Map { ${[...item].map(([k, v]) => `${render(k, depth + 1)} => ${render(v, depth + 1)}`).join(", ")} }`;
    if (item instanceof Set) return `Set { ${[...item].map((v) => render(v, depth + 1)).join(", ")} }`;
    if (Array.isArray(item)) return `[${Array.from(item, (v) => render(v, depth + 1)).join(", ")}]`;
    return `{ ${Object.entries(item).map(([k, v]) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${render(v, depth + 1)}`).join(", ")} }`;
  };
  return render(value, 0);
};

const area = $("#play-input");
const output = $("#play-output");
if (area && output && lib) {
  const update = () => {
    const fragment = document.createDocumentFragment();
    for (const result of runPlayground(area.value, lib)) {
      const line = document.createElement("div");
      line.className = result.kind;
      line.textContent = result.kind === "ok" ? formatResult(result.value) : result.text || " ";
      fragment.append(line);
    }
    output.replaceChildren(fragment);
  };
  area.value = SAMPLES.Money;
  area.addEventListener("input", update);
  area.addEventListener("scroll", () => (output.scrollTop = area.scrollTop));
  $$("[data-sample]").forEach((button) =>
    button.addEventListener("click", () => {
      area.value = SAMPLES[button.dataset.sample];
      $$("[data-sample]").forEach((other) => other.setAttribute("aria-selected", String(other === button)));
      update();
    })
  );
  update();
}

// ---------------------------------------------------------------- API reference
const params = (list) => `<h5>Parameters</h5><div class="scroll"><table><tr><th>Name</th><th>Type</th><th>Default</th><th>Description</th></tr>${list.map((q) => `<tr><td class="name"><code>${esc(q.name)}</code></td><td class="type"><code>${esc(q.type)}</code></td><td>${q.def === undefined ? "<em>required</em>" : `<code>${esc(q.def)}</code>`}</td><td>${esc(q.desc)}</td></tr>`).join("")}</table></div>`;
const throwsList = (list) => `<h5>Throws</h5><ul class="throws">${list.map((t) => `<li>${t.code ? `<span class="err">${esc(t.code)}</span>` : `<span class="err plain">${esc(t.kind)}</span>`}<span><strong>${esc(t.kind)}</strong> when ${esc(t.when)}</span></li>`).join("")}</ul>`;
const extraTable = (t) => `<div class="scroll"><table><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${t.rows.map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? `<code>${esc(c)}</code>` : esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;

const reference = $("#api-reference");
const nav = $("#nav-groups");
if (reference) {
  reference.innerHTML = GROUPS.map(
    (g) => `<section id="${g.id}" class="group"><h3 class="group-title">${esc(g.title)}</h3>${g.note ? `<p class="group-note">${esc(g.note)}</p>` : ""}${g.fns
      .map(
        (f) => `<details class="fn" id="${f.name}" data-name="${f.name.toLowerCase()}" data-group="${esc(g.id)}" data-search="${esc(`${f.name} ${g.title} ${f.desc}`.toLowerCase())}"><summary class="fn-head"><h4>${f.name}</h4><a href="#${f.name}" aria-label="Permalink to ${f.name}">#</a></summary><div class="code sig-block"><pre><code>${highlight(f.sig)}</code></pre></div><p class="desc">${esc(f.desc)}</p>${f.params?.length ? params(f.params) : ""}${f.table ? extraTable(f.table) : ""}${f.returns ? `<h5>Returns</h5><p>${esc(f.returns)}</p>` : ""}${f.throws?.length ? throwsList(f.throws) : ""}<h5>Example</h5>${codeBlock(f.ex)}<p class="related">Related: ${g.fns.filter(other => other.name !== f.name).slice(0, 3).map(other => `<a href="#${other.name}">${other.name}</a>`).join(", ")}</p></details>`
      )
      .join("")}</section>`
  ).join("");
  nav.innerHTML = GROUPS.map((g) => `<h3><a href="#${g.id}">${esc(g.title)}</a></h3><ul>${g.fns.map((f) => `<li data-name="${f.name.toLowerCase()}" data-group="${esc(g.id)}" data-search="${esc(`${f.name} ${g.title} ${f.desc}`.toLowerCase())}"><a href="#${f.name}">${f.name}</a></li>`).join("")}</ul>`).join("");
  $("#category-filter").innerHTML += GROUPS.map(g => `<option value="${esc(g.id)}">${esc(g.title)}</option>`).join("");
  $("#api-count").textContent = String(GROUPS.reduce((sum, g) => sum + g.fns.length, 0));
}

const search = $("#search");
const category = $("#category-filter");
const filter = () => {
  const query = search.value.trim().toLowerCase();
  let shown = 0;
  $$("#api [data-name]").forEach((element) => {
    const match = element.dataset.search.includes(query) && (!category.value || element.dataset.group === category.value);
    element.hidden = !match;
    if (match && element.classList.contains("fn")) shown++;
  });
  $$("#api-reference .group").forEach((group) => (group.hidden = !group.querySelector(".fn:not([hidden])")));
  $$("#nav-groups h3").forEach((heading) => {
    const list = heading.nextElementSibling;
    const visible = list && list.querySelector("li:not([hidden])");
    heading.hidden = !visible;
    if (list) list.hidden = !visible;
  });
  $("#empty").hidden = shown > 0;
  $("#search-status").textContent = `${shown} functions`;
};
search?.addEventListener("input", filter);
category?.addEventListener("change", filter);
filter();
addEventListener("keydown", (event) => {
  const typing = /^(input|textarea|select)$/i.test(event.target.tagName) || event.target.isContentEditable;
  if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey) {
    event.preventDefault();
    $("#api").scrollIntoView();
    search.focus();
  } else if (event.key === "Escape" && document.activeElement === search) {
    search.value = "";
    filter();
    search.blur();
  }
});
$("#api-nav-toggle")?.addEventListener("click", (event) => {
  const open = $(".api-nav-wrap").classList.toggle("open");
  event.currentTarget.setAttribute("aria-expanded", String(open));
});

// ---------------------------------------------------------------- scroll spy
const topLinks = $$(".nav a");
const sectionObserver = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      if (entry.isIntersecting) topLinks.forEach((link) => link.setAttribute("aria-current", String(link.getAttribute("href") === `#${entry.target.id}`)));
    }),
  { rootMargin: "-30% 0px -65%" }
);
$$("main > section[id]").forEach((section) => sectionObserver.observe(section));
const navLinks = new Map($$("#nav-groups a").map((a) => [a.getAttribute("href").slice(1), a]));
const fnObserver = new IntersectionObserver(
  (entries) =>
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => link.removeAttribute("aria-current"));
      navLinks.get(entry.target.id)?.setAttribute("aria-current", "true");
    }),
  { rootMargin: "-20% 0px -75%" }
);
$$("#api-reference .fn").forEach((fn) => fnObserver.observe(fn));
const revealHash = () => {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = document.getElementById(id);
  if (!target) return;
  if (target.classList.contains("fn")) {
    search.value = ""; category.value = target.dataset.group; filter(); target.open = true;
  } else if (target.classList.contains("group")) {
    search.value = ""; category.value = target.id; filter();
  }
  target.scrollIntoView();
};
addEventListener("hashchange", revealHash);
if (location.hash) revealHash();
