import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { GROUPS } from "../docs/api-data.js";
import { runPlayground } from "../docs/assets/playground-parser.js";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const metadata = JSON.parse(await read("../package.json"));
const { name, version, homepage: url, branding } = metadata;
const escapeHtml = value => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const npm = `https://www.npmjs.com/package/${name}`;
const github = metadata.repository.url.replace(/^git\+/, "").replace(/\.git$/, "");
const bundleName = `${name.split("/").at(-1)}.mjs`;
const [site, robots, sitemap, script, style, bundle, built, parser] = await Promise.all([
  read("../docs/index.html"),
  read("../docs/robots.txt"),
  read("../docs/sitemap.xml"),
  read("../docs/assets/app.js"),
  read("../docs/assets/style.css"),
  read(`../docs/assets/${bundleName}`),
  read("../dist/index.mjs"),
  read("../docs/assets/playground-parser.js"),
]);
for (const value of [
  '<html lang="en">',
  '<meta name="description"',
  `<link rel="canonical" href="${url}">`,
  'name="robots" content="index,follow"',
  'application/ld+json',
  'id="install"',
  'id="quick-start"',
  'id="features"',
  'id="playground"',
  'id="api"',
  'id="examples"',
  'id="migration"',
  'id="releases"',
  'id="faq"',
  'type="module" src="assets/app.js"',
  'href="assets/style.css"',
  npm,
  github,
]) assert.ok(site.includes(value), `site is missing ${value}`);

assert.equal(bundle, built, `docs/assets/${bundleName} is stale: run npm run build && npm run docs:sync`);
assert.ok(site.includes(`<title>${escapeHtml(branding.seoTitle)}</title>`), "title must match manifest branding");
for (const [attribute, key, value] of [
  ["name", "description", branding.seoDescription], ["property", "og:title", branding.seoTitle],
  ["property", "og:description", branding.seoDescription], ["name", "twitter:description", branding.seoDescription],
]) {
  assert.equal([...site.matchAll(new RegExp(`<meta ${attribute}="${key}" content="[^"]+">`, "g"))].length, 1, `${key} must occur exactly once`);
  assert.ok(site.includes(`<meta ${attribute}="${key}" content="${escapeHtml(value)}">`), `${key} must match manifest branding`);
}
assert.ok(site.includes(`<meta property="og:site_name" content="${escapeHtml(branding.displayName)}">`), "Open Graph site name must match manifest branding");
assert.ok(site.includes(`<meta property="og:url" content="${url}">`), "Open Graph URL must match package metadata");
assert.ok(site.includes(`<meta name="twitter:title" content="${escapeHtml(branding.seoTitle)}">`), "Twitter title must match manifest branding");
assert.ok(site.includes(`<code id="install-cmd">npm install ${name}</code>`), "install command must use the current package name");
assert.ok(site.includes(`data-copy-text="npm install ${name}"`), "copied install command must use the current package name");
for (const [, packageSpecifier] of site.matchAll(/(?:from\s+|require\()\s*["'](@[^"']+)["']/g)) {
  assert.equal(packageSpecifier, name, `code example imports stale package ${packageSpecifier}`);
}
for (const [, packageSpecifier] of site.matchAll(/\b(?:npm install|pnpm add|yarn add|bun add)\s+(@[^\s<"']+)/g)) {
  assert.equal(packageSpecifier, name, `install example uses stale package ${packageSpecifier}`);
}
assert.ok(site.includes("Migrate from @fatdevcon/utilities"), "site must identify the old package in its migration guide");
assert.ok(site.includes("npm uninstall @fatdevcon/utilities"), "site must explain how to remove the old package");
assert.ok(site.includes(`Version ${version}`), "footer must show the current version");
assert.ok(site.includes(`"softwareVersion":"${version}"`), "structured data must carry the current version");
assert.ok(site.includes(`Release ${version}`), "release section must describe the current version");
const marker = key => {
  const start = `<!-- package-metadata:${key} -->`;
  const end = `<!-- /package-metadata:${key} -->`;
  assert.equal(site.split(start).length, 2, `unique ${key} marker required`);
  assert.equal(site.split(end).length, 2, `unique ${key} end marker required`);
  return site.slice(site.indexOf(start) + start.length, site.indexOf(end));
};
assert.equal(marker("footer-version"), `Version ${version}`, "footer must show the current version");
assert.equal(marker("release-title"), `Release ${version}`, "release heading must show the current version");
for (const [key, value] of [["hero-name", branding.displayName], ["tagline", branding.tagline], ["description", metadata.description]]) {
  assert.equal(marker(key), escapeHtml(value), `visible ${key} must match manifest`);
}
const readme = await read("../README.md");
for (const [key, value] of [["display-name", branding.displayName], ["tagline", branding.tagline], ["description", metadata.description]]) {
  assert.ok(readme.includes(`<!-- package-metadata:${key} -->${escapeHtml(value)}<!-- /package-metadata:${key} -->`), `README ${key} must match manifest`);
}
const repositoryMetadata = JSON.parse(await read("../.github/repository-metadata.json"));
assert.equal(repositoryMetadata.description, metadata.description);
assert.equal(repositoryMetadata.homepage, url);
assert.equal(repositoryMetadata.name, name.split("/").at(-1));
const lock = JSON.parse(await read("../package-lock.json"));
for (const entry of [lock, lock.packages[""]]) {
  assert.equal(entry.name, name);
  assert.equal(entry.version, version);
  assert.equal(Object.keys(entry.dependencies ?? {}).length, 0, "lockfile must preserve zero runtime dependencies");
}
const measurement = JSON.parse(await read("../docs/bundle-data.json"));
assert.equal(measurement.name, name);
assert.equal(measurement.version, version);
assert.equal(measurement.entry, "dist/index.mjs", "measurement must use a portable artifact identifier");
assert.equal(measurement.esmSha256, createHash("sha256").update(built).digest("hex"), "measurements must describe the current built ESM");
assert.ok(marker("bundle-note").includes(`${(measurement.consumers.full.gzip / 1000).toFixed(1)} kB gzip`));
const count = GROUPS.reduce((sum, group) => sum + group.fns.length, 0);
assert.ok(site.includes(`<span id="api-count">${count}</span>`), "static API count must match documentation inventory");
const changelog = await read("../CHANGELOG.md");
const release = changelog.split(/^## /m).find(entry => entry.split("\n")[0].trim() === version);
assert.ok(release, "current changelog section required");
const releaseItems = release.split("\n").filter(line => line.startsWith("- ")).map(line => {
  const escaped = line.slice(2).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/`([^`]+)`/g, "<code>$1</code>");
  return `<li>${escaped}</li>`;
});
assert.equal(marker("release-summary"), `<ul>${releaseItems.join("")}</ul>`, "release summary must exactly match the current changelog entry");

const structuredData = [...site.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) => JSON.parse(json));
const software = structuredData.find((entry) => entry["@type"] === "SoftwareSourceCode");
assert.ok(software, "site must include SoftwareSourceCode structured data");
assert.equal(software.name, branding.displayName);
assert.equal(software.alternateName, name);
assert.equal(software.description, metadata.description);
assert.equal(software.softwareVersion, version);
assert.equal(software.codeRepository, github);
assert.equal(software.url, url);
assert.equal(software.downloadUrl, npm);
const plainText = html => html.replace(/<[^>]+>/g, "").replace(/&(amp|lt|gt|quot|apos|#39|nbsp);/g,
  (_match, entity) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'", nbsp: "\u00a0" })[entity]).replace(/\s+/g, " ").trim();
const faqSection = site.match(/<section class="block" id="faq">[\s\S]*?<\/section>/)?.[0] ?? "";
const visibleFaq = [...faqSection.matchAll(/<details>\s*<summary>([\s\S]*?)<\/summary>\s*<p>([\s\S]*?)<\/p>\s*<\/details>/g)].map(([, question, answer]) => ({
  "@type": "Question", name: plainText(question), acceptedAnswer: { "@type": "Answer", text: plainText(answer) },
}));
assert.ok(visibleFaq.length > 0);
assert.equal(visibleFaq.length, [...faqSection.matchAll(/<details\b/g)].length, "every visible FAQ must be verified");
assert.deepEqual(structuredData.find(entry => entry["@type"] === "FAQPage")?.mainEntity, visibleFaq, "FAQ JSON-LD must match every visible answer exactly");
assert.ok(/^import |await import\(/m.test(script), "app.js must be an ES module");
for (const [manager, command] of Object.entries({ npm: "npm install", pnpm: "pnpm add", yarn: "yarn add", bun: "bun add" })) {
  assert.ok(script.includes(`${manager}: "${command} ${name}"`), `${manager} install command must match package metadata`);
}
assert.ok(script.includes(`await import("./${bundleName}")`), "playground import must match the package-derived bundle name");
assert.ok(/:focus-visible/.test(style) && /prefers-reduced-motion/.test(style) && /prefers-color-scheme: dark/.test(style), "styles must keep focus, motion and dark-mode handling");
assert.doesNotMatch(`${script}\n${parser}`, /\b(?:eval|new\s+Function)\b/, "documentation must not dynamically execute editable source text");

const playgroundApi = await import("../dist/index.mjs");
assert.deepEqual(runPlayground('summary(0.1, 0.2)', playgroundApi), [{ kind: "ok", value: 0.3 }]);
assert.match(runPlayground('summary(0.1, 0.2) + 1', playgroundApi)[0].text, /Unexpected input/);
assert.match(runPlayground('constructor()', playgroundApi)[0].text, /not available/);
assert.match(runPlayground('safeToString({ __proto__: "x" })', playgroundApi)[0].text, /not allowed/);

// Every internal anchor in the static page must exist, either in the page or as a documented function.
const ids = new Set([...site.matchAll(/ id="([^"]+)"/g)].map((m) => m[1]));
const fnNames = new Set(GROUPS.flatMap((group) => group.fns.map((fn) => fn.name)));
const groupIds = new Set(GROUPS.map((group) => group.id));
for (const [, target] of site.matchAll(/href="#([^"]+)"/g)) {
  assert.ok(ids.has(target) || fnNames.has(target) || groupIds.has(target), `broken anchor #${target}`);
}
assert.ok(/<nav class="nav"[\s\S]*?href="#releases"/.test(site), "primary Releases link must retain the local deep link");
for (const [, target] of site.matchAll(/(?:href|src)="([^"#]+)"/g)) {
  if (/^(?:https?:|data:)/.test(target)) continue;
  assert.ok((await stat(new URL(`../docs/${target.split("#")[0]}`, import.meta.url))).isFile(), `missing local asset ${target}`);
}
for (const [path, content] of [["README.md", readme], ["docs/api-data.js", await read("../docs/api-data.js")], ["docs/v050-api.js", await read("../docs/v050-api.js")], ["docs/index.html", site]]) {
  assert.doesNotMatch(content, /Every example (?:is executed|outcome is checked)|well under 0\.2 s|Nothing else to audit|results stay identical|Bun 1\.1\.34\+/, `${path} must not make unverified claims`);
  assert.doesNotMatch(content, /https:\/\/[^\s"'<>]*\/(?:fatdevcon-utilities|utilities)(?:\/|#|\b)/, `${path} must not link to the old repository`);
}

assert.match(robots, /User-agent: \*/);
assert.match(robots, new RegExp(`Sitemap: ${url}sitemap\\.xml`));
assert.match(sitemap, new RegExp(`<loc>${url}</loc>`));
console.log("Site markup, structured data, live-demo bundle, anchors and crawl directives verified.");
