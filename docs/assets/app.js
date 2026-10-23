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
// An inline script in <head> applies the saved choice before first paint; this keeps the switch in sync.
const root = document.documentElement;
const savedTheme = safeStorage.get("fdc-theme");
if (savedTheme === "light" || savedTheme === "dark") root.dataset.theme = savedTheme;
const themeButton = $("#theme");
const colorScheme = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : colorScheme.matches);
const syncThemeButton = () => themeButton?.setAttribute("aria-label", isDark() ? "Switch to light theme" : "Switch to dark theme");
themeButton?.addEventListener("click", () => {
  root.dataset.theme = isDark() ? "light" : "dark";
  safeStorage.set("fdc-theme", root.dataset.theme);
  syncThemeButton();
});
colorScheme.addEventListener?.("change", syncThemeButton);
syncThemeButton();

// ---------------------------------------------------------------- top navigation (small screens)
const navToggle = $("#nav-toggle");
const primaryNav = $("#primary-nav");
const setNavOpen = (open) => {
  primaryNav?.classList.toggle("open", open);
  navToggle?.setAttribute("aria-expanded", String(open));
};
navToggle?.addEventListener("click", () => setNavOpen(!primaryNav.classList.contains("open")));
primaryNav?.addEventListener("click", (event) => { if (event.target.closest("a")) setNavOpen(false); });
addEventListener("keydown", (event) => {
  if (event.key === "Escape" && primaryNav?.classList.contains("open")) { setNavOpen(false); navToggle.focus(); }
});

// ---------------------------------------------------------------- copy buttons
const copyStatus = document.createElement("div");
copyStatus.className = "visually-hidden";
copyStatus.setAttribute("role", "status");
copyStatus.setAttribute("aria-live", "polite");
document.body.append(copyStatus);
const announce = (message) => {
  copyStatus.textContent = "";
  requestAnimationFrame(() => (copyStatus.textContent = message));
};
const flash = (button, text, ok) => {
  const original = button.dataset.label ?? (button.dataset.label = button.textContent);
  button.textContent = text;
  button.classList.toggle("is-done", ok);
  clearTimeout(Number(button.dataset.timer));
  button.dataset.timer = String(setTimeout(() => { button.textContent = original; button.classList.remove("is-done"); }, 1400));
};
document.addEventListener("click", async (event) => {
  const button = event.target.closest?.("[data-copy], [data-copy-text]");
  if (!button) return;
  const source = button.dataset.copy ? document.getElementById(button.dataset.copy) : null;
  const text = button.dataset.copyText ?? (source ? ("value" in source ? source.value : source.textContent) : "");
  try {
    await navigator.clipboard.writeText(text);
    flash(button, "Copied", true);
    announce("Copied to clipboard");
  } catch {
    flash(button, "Select and copy", false);
    announce("Copy is unavailable here. Select the text and copy it manually.");
  }
});

// ---------------------------------------------------------------- tabs with arrow-key support
const selectTab = (tabs, tab) =>
  tabs.forEach((other) => {
    other.setAttribute("aria-selected", String(other === tab));
    other.tabIndex = other === tab ? 0 : -1;
  });
const enableTabKeys = (tabs, activate) => {
  tabs.forEach((tab) =>
    tab.addEventListener("keydown", (event) => {
      const at = tabs.indexOf(tab);
      const next = { ArrowRight: at + 1, ArrowDown: at + 1, ArrowLeft: at - 1, ArrowUp: at - 1, Home: 0, End: tabs.length - 1 }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      const target = tabs[(next + tabs.length) % tabs.length];
      target.focus();
      activate(target);
    })
  );
};

// ---------------------------------------------------------------- install tabs
const installCommands = { npm: "npm install @fatdevcon/precisekit", pnpm: "pnpm add @fatdevcon/precisekit", yarn: "yarn add @fatdevcon/precisekit", bun: "bun add @fatdevcon/precisekit" };
const installTabs = $$(".install-tabs button");
const chooseInstall = (tab) => {
  selectTab(installTabs, tab);
  const command = installCommands[tab.dataset.pm];
  $("#install-cmd").textContent = command;
  $("#install-copy").dataset.copyText = command;
};
installTabs.forEach((tab) => tab.addEventListener("click", () => chooseInstall(tab)));
enableTabKeys(installTabs, chooseInstall);
selectTab(installTabs, installTabs.find((tab) => tab.getAttribute("aria-selected") === "true") ?? installTabs[0]);

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
const copyButton = (text, label) =>
  `<button class="copy" type="button" aria-label="${esc(label)}" data-copy-text="${esc(text)}">Copy</button>`;
const codeBlock = (code, label, extraClass = "") =>
  `<div class="code ${extraClass}">${copyButton(code, label)}<pre><code>${highlight(code)}</code></pre></div>`;

// ---------------------------------------------------------------- load the package
let lib = null;
try {
  lib = await import("./precisekit.mjs");
  knownFunctions = new Set(Object.keys(lib));
} catch (error) {
  console.warn("Live demos are disabled because the package build could not be loaded:", error);
  $$("[data-needs-lib]").forEach((element) => (element.hidden = true));
}
// Highlight static examples, then give every static code block a copy button.
$$("pre.hl code").forEach((element) => {
  element.innerHTML = highlight(element.textContent);
});
$$(".code").forEach((block) => {
  const pre = $("pre", block);
  if (!pre || $(".copy", block)) return;
  const title = block.closest(".recipe")?.querySelector("h3")?.textContent;
  block.insertAdjacentHTML("afterbegin", copyButton(pre.textContent, title ? `Copy code: ${title}` : "Copy code"));
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
      $$(".gauge-tabs button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
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
  Collections: `// compactNullish drops only null and undefined.
compactNullish([0, null, "", false, null, 1])
compactNullish(["a", null, "b"])
// hasByPath checks own properties and never runs getters.
hasByPath({ a: { list: [{ id: 1 }] } }, "a.list[0].id")
hasByPath({ a: { b: null } }, "a.b")
hasByPath({ a: { b: null } }, "a.missing")
hasByPath({}, "toString")
setByPath({ a: 1 }, "b.c[0]", true)`,
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
      line.textContent = result.kind === "ok" ? formatResult(result.value) : result.text || " ";
      fragment.append(line);
    }
    output.replaceChildren(fragment);
    output.scrollTop = area.scrollTop;
  };
  const sampleTabs = $$("[data-sample]");
  const panel = $("#play-panel");
  const chooseSample = (button) => {
    area.value = SAMPLES[button.dataset.sample];
    selectTab(sampleTabs, button);
    panel?.setAttribute("aria-labelledby", button.id);
    update();
  };
  sampleTabs.forEach((button) => button.addEventListener("click", () => chooseSample(button)));
  enableTabKeys(sampleTabs, chooseSample);
  chooseSample(sampleTabs.find((button) => button.getAttribute("aria-selected") === "true") ?? sampleTabs[0]);
  area.addEventListener("input", update);
  area.addEventListener("scroll", () => (output.scrollTop = area.scrollTop));
}

// ---------------------------------------------------------------- API reference
const firstSentence = (text) => /^[\s\S]*?[.!?](?=\s+[A-Z"`(]|$)/.exec(text)?.[0] ?? text;

const paramList = (list) =>
  `<dl class="params">${list
    .map(
      (q) =>
        `<div class="param"><dt><code>${esc(q.name)}</code>${q.def === undefined ? '<span class="p-req">required</span>' : ""}</dt><dd class="p-type"><code>${esc(q.type)}</code></dd><dd class="p-desc">${esc(q.desc)}${q.def === undefined ? "" : `<span class="p-def">Default: <code>${esc(q.def)}</code></span>`}</dd></div>`
    )
    .join("")}</dl>`;
const throwsList = (list) =>
  `<ul class="throws">${list
    .map((t) => (t.code ? `<li><span class="err">${esc(t.code)}</span><span>${esc(t.kind)} when ${esc(t.when)}</span></li>` : `<li><span class="err plain">${esc(t.kind)}</span><span>when ${esc(t.when)}</span></li>`))
    .join("")}</ul>`;
const extraTable = (t) =>
  `<div class="scroll"><table><tr>${t.head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${t.rows.map((r) => `<tr>${r.map((c, i) => `<td>${i === 0 ? `<code>${esc(c)}</code>` : esc(c)}</td>`).join("")}</tr>`).join("")}</table></div>`;
const spec = (title, inner, note = "") => `<div class="fn-sec"><h5>${title}${note}</h5><div>${inner}</div></div>`;
const neighbours = (list, at) => list.filter((_, index) => index !== at && Math.abs(index - at) <= 2);

const card = (f, g, at) => {
  const tags = (f.tags ?? []).map((tag) => `<span class="tag">${esc(tag)}</span>`).join("");
  const related = neighbours(g.fns, at).map((other) => `<a href="#${other.name}">${other.name}</a>`).join("");
  const searchText = `${f.name} ${g.title} ${f.desc} ${(f.tags ?? []).join(" ")}`.toLowerCase();
  const illustrative = f.run === false ? '<span class="run-note">illustrative, not executed</span>' : "";
  return `<details class="fn" id="${f.name}" data-name="${f.name.toLowerCase()}" data-group="${esc(g.id)}" data-search="${esc(searchText)}">`
    + `<summary><h4 class="fn-name"><code>${f.name}</code></h4><span class="fn-desc">${esc(firstSentence(f.desc))}</span><span class="fn-tags">${tags}</span><a class="permalink" href="#${f.name}" aria-label="Permalink to ${f.name}">#</a></summary>`
    + `<div class="fn-body">${codeBlock(f.sig, `Copy signature of ${f.name}`, "sig")}<p class="fn-full">${esc(f.desc)}</p>`
    + (f.params?.length ? spec("Parameters", paramList(f.params)) : "")
    + (f.table ? spec("Reference", extraTable(f.table)) : "")
    + (f.returns ? spec("Returns", `<p>${esc(f.returns)}</p>`) : "")
    + (f.throws?.length ? spec("Throws", throwsList(f.throws)) : "")
    + spec("Example", codeBlock(f.ex, `Copy example for ${f.name}`), illustrative)
    + (related ? spec("Related", `<p class="related">${related}</p>`) : "")
    + `</div></details>`;
};

const reference = $("#api-reference");
const nav = $("#nav-groups");
const search = $("#search");
const category = $("#category-filter");
const total = GROUPS.reduce((sum, g) => sum + g.fns.length, 0);
let items = [];
let groupItems = [];

if (reference) {
  reference.innerHTML = GROUPS.map(
    (g) => `<section id="${g.id}" class="group" aria-labelledby="${g.id}-title"><div class="group-head"><h3 class="group-title" id="${g.id}-title">${esc(g.title)}</h3><span class="group-count">${g.fns.length}</span></div>${g.note ? `<p class="group-note">${esc(g.note)}</p>` : ""}<div class="fns">${g.fns.map((f, at) => card(f, g, at)).join("")}</div></section>`
  ).join("");
  nav.innerHTML = `<ul>${GROUPS.map(
    (g) => `<li class="grp" data-group="${esc(g.id)}"><a href="#${g.id}"><span>${esc(g.title)}</span><span class="count">${g.fns.length}</span></a><ul class="fnlist">${g.fns.map((f) => `<li data-name="${f.name.toLowerCase()}"><a href="#${f.name}">${f.name}</a></li>`).join("")}</ul></li>`
  ).join("")}</ul>`;
  category.innerHTML += GROUPS.map((g) => `<option value="${esc(g.id)}">${esc(g.title)} (${g.fns.length})</option>`).join("");
  $("#api-count").textContent = String(total);
  const listItems = new Map($$("li[data-name]", nav).map((li) => [li.firstElementChild.getAttribute("href").slice(1), li]));
  items = $$("#api-reference .fn").map((el) => ({
    el, name: el.id, group: el.dataset.group, search: el.dataset.search, code: $(".fn-name code", el), li: listItems.get(el.id), html: null,
  }));
  groupItems = GROUPS.map((g) => ({
    id: g.id, size: g.fns.length, el: document.getElementById(g.id), li: $(`.grp[data-group="${g.id}"]`, nav),
    count: $(".group-count", document.getElementById(g.id)), navCount: $(".count", $(`.grp[data-group="${g.id}"]`, nav)),
  }));
}

/** Wrap every occurrence of the search terms in <mark>. */
const markText = (text, terms) => {
  const lower = text.toLowerCase();
  const flags = new Array(text.length).fill(false);
  for (const term of terms) {
    for (let at = lower.indexOf(term); at >= 0; at = lower.indexOf(term, at + term.length)) flags.fill(true, at, at + term.length);
  }
  let out = "";
  let open = false;
  [...text].forEach((char, index) => {
    if (flags[index] !== open) { out += open ? "</mark>" : "<mark>"; open = flags[index]; }
    out += esc(char);
  });
  return out + (open ? "</mark>" : "");
};

const filter = () => {
  const terms = search.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const group = category.value;
  const perGroup = new Map();
  let shown = 0;
  for (const item of items) {
    const match = (!group || item.group === group) && terms.every((term) => item.search.includes(term));
    item.el.hidden = !match;
    if (item.li) item.li.hidden = !match;
    if (match) { shown++; perGroup.set(item.group, (perGroup.get(item.group) ?? 0) + 1); }
    const html = match && terms.length ? markText(item.name, terms) : esc(item.name);
    if (html !== item.html) { item.code.innerHTML = html; item.html = html; }
  }
  const filtering = terms.length > 0 || Boolean(group);
  for (const g of groupItems) {
    const count = perGroup.get(g.id) ?? 0;
    g.el.hidden = count === 0;
    g.li.hidden = count === 0;
    g.count.textContent = filtering ? `${count} of ${g.size}` : String(g.size);
    g.navCount.textContent = filtering ? String(count) : String(g.size);
  }
  nav.classList.toggle("is-filtering", filtering);
  $("#empty").hidden = shown > 0;
  $("#search-status").textContent = filtering ? (shown ? `${shown} of ${total} functions` : `No functions match`) : `${total} functions`;
  requestSpy();
};
search?.addEventListener("input", filter);
category?.addEventListener("change", filter);

addEventListener("keydown", (event) => {
  const typing = /^(input|textarea|select)$/i.test(event.target.tagName) || event.target.isContentEditable;
  if (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    $("#api").scrollIntoView();
    search.focus({ preventScroll: true });
  } else if (event.key === "Escape" && document.activeElement === search) {
    if (search.value) { search.value = ""; filter(); } else search.blur();
  } else if (event.key === "Enter" && document.activeElement === search) {
    const first = items.find((item) => !item.el.hidden);
    if (first) { first.el.open = true; first.el.scrollIntoView(); first.el.querySelector("summary").focus({ preventScroll: true }); }
  }
});

const navWrap = $(".api-nav-wrap");
const navGroupsToggle = $("#api-nav-toggle");
const setGroupsOpen = (open) => {
  navWrap?.classList.toggle("open", open);
  navGroupsToggle?.setAttribute("aria-expanded", String(open));
};
navGroupsToggle?.addEventListener("click", () => setGroupsOpen(!navWrap.classList.contains("open")));
nav?.addEventListener("click", (event) => { if (event.target.closest("a")) setGroupsOpen(false); });

const setAll = (open) => items.forEach((item) => { if (!item.el.hidden) item.el.open = open; });
$("#expand-all")?.addEventListener("click", () => setAll(true));
$("#collapse-all")?.addEventListener("click", () => setAll(false));

// ---------------------------------------------------------------- scroll spy
const topLinks = new Map($$(".nav a").map((link) => [link.getAttribute("href").slice(1), link]));
const sections = $$("main > section[id]");
const apiSection = $("#api");
const sideBox = $(".api-nav-wrap");
const READING_LINE = 120;
let spyFrame = 0;
let lastGroup = null;
let lastFn = null;
const mark = (link, on) => (on ? link.setAttribute("aria-current", "true") : link.removeAttribute("aria-current"));
const keepVisible = (link) => {
  if (!sideBox || sideBox.scrollHeight <= sideBox.clientHeight + 1) return;
  const box = sideBox.getBoundingClientRect();
  const rect = link.getBoundingClientRect();
  if (rect.top < box.top + 8) sideBox.scrollTop -= box.top + 8 - rect.top;
  else if (rect.bottom > box.bottom - 8) sideBox.scrollTop += rect.bottom - box.bottom + 8;
};
const spy = () => {
  spyFrame = 0;
  let current = null;
  for (const section of sections) if (section.getBoundingClientRect().top <= READING_LINE) current = section;
  // The last section can be too short to reach the reading line, so the end of the page selects it.
  if (innerHeight + scrollY >= document.documentElement.scrollHeight - 2) current = sections.at(-1);
  const currentKey = current ? (current.id === "top" ? "install" : current.id) : null;
  topLinks.forEach((link, key) => mark(link, key === currentKey));
  if (!groupItems.length || !apiSection) return;
  let group = null;
  let fn = null;
  if (apiSection.getBoundingClientRect().top <= READING_LINE) {
    const visibleGroups = groupItems.filter((g) => !g.el.hidden);
    group = visibleGroups.filter((g) => g.el.getBoundingClientRect().top <= READING_LINE).at(-1) ?? visibleGroups[0] ?? null;
    if (group) fn = items.filter((item) => item.group === group.id && !item.el.hidden && item.el.getBoundingClientRect().top <= READING_LINE).at(-1) ?? null;
  }
  if (group !== lastGroup) {
    if (lastGroup) { lastGroup.li.classList.remove("is-active"); mark(lastGroup.li.firstElementChild, false); }
    if (group) { group.li.classList.add("is-active"); mark(group.li.firstElementChild, true); }
    lastGroup = group;
    if (group && !sideBox.contains(document.activeElement)) requestAnimationFrame(() => keepVisible(group.li.firstElementChild));
  }
  if (fn !== lastFn) {
    if (lastFn?.li) mark(lastFn.li.firstElementChild, false);
    if (fn?.li) mark(fn.li.firstElementChild, true);
    lastFn = fn;
  }
};
function requestSpy() { if (!spyFrame) spyFrame = requestAnimationFrame(spy); }
addEventListener("scroll", requestSpy, { passive: true });
addEventListener("resize", requestSpy);

// ---------------------------------------------------------------- deep links
const revealHash = (event) => {
  let id;
  try { id = decodeURIComponent(location.hash.slice(1)); } catch { return; }
  const target = id && document.getElementById(id);
  if (!target) return;
  const isCard = target.classList.contains("fn");
  const isGroup = target.classList.contains("group");
  if ((isCard || isGroup) && target.hidden) {
    // A filter is hiding the target: clear it so the link always lands somewhere visible.
    search.value = "";
    category.value = "";
    filter();
  }
  if (isCard) target.open = true;
  // Jump instantly on page load; animate only when following a link inside the page.
  target.scrollIntoView({ behavior: event && !matchMedia("(prefers-reduced-motion: reduce)").matches ? "smooth" : "instant" });
  if (isCard) target.querySelector("summary")?.focus({ preventScroll: true });
  requestSpy();
};
addEventListener("hashchange", revealHash);
filter();
if (location.hash) revealHash();
requestSpy();
requestAnimationFrame(() => root.classList.add("is-ready"));
