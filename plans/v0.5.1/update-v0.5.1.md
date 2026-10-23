# TASK: PreciseKit v0.5.1 — Features, Security, Dependencies, Performance & Documentation

## 1. ROLE & OBJECTIVE

Act as a team of senior specialists:

- **Senior TypeScript Library Engineer:** Clean architecture, strongly typed APIs, performance and backward compatibility.
- **Dependency & Build Engineer:** Dependency upgrades, migrations, build tooling and package compatibility.
- **Security Engineer:** Software supply-chain security, vulnerability assessment and npm publishing integrity.
- **Senior UI/UX Designer:** Professional, accessible and visually polished developer documentation.
- **Performance Engineer:** Consumer bundle optimization, tree-shaking and documentation performance.
- **QA Engineer:** Unit, integration, regression, security, accessibility and browser testing.

Upgrade `@fatdevcon/precisekit` from `v0.5.0` to `v0.5.1`.

Complete all requested improvements, not just planning.

## 2. INITIAL REPOSITORY ANALYSIS

Work on the existing `master` branch.

Before editing, inspect:

- `CLAUDE.md`, `AGENTS.md`, `.claude/rules/`
- `package.json`, lockfile, build configurations and scripts
- All relevant source modules, exports, types and tests
- README, CHANGELOG, documentation and playground
- CI/CD, npm publishing workflows and security configurations

Discover and use all relevant installed plugins, MCP servers, skills and subagents for coding, security, UI/UX, design, testing and verification.

Prefer effective tools and parallel read-only investigation over unnecessary tool calls.

Create an implementation plan following existing project conventions, then proceed directly with implementation.

Preserve unrelated local changes.

## 3. IMPLEMENT NEW UTILITIES

Implement and export:

**`compactNullish()`**

Remove only `null` and `undefined`, preserving `0`, `false`, `""`, `NaN` and `0n`.

Ensure strong TypeScript inference, readonly input compatibility, immutability, correct ordering and comprehensive edge-case tests.

**`hasByPath()`**

Check whether a nested own property exists, including properties whose values are `undefined`.

Reuse existing path syntax. Support arrays and nested objects while preventing prototype pollution, inherited-property confusion and accessor side effects.

**`pickBy()`**

Select object properties using a typed predicate.

Ensure safe object construction, immutability, predictable behavior for enumerable keys and symbols, and accurate TypeScript return types.

Also review existing `withTimeout()` functionality. Do not duplicate it. Test timeout behavior, timer cleanup, rejection handling and edge cases.

Maintain zero runtime dependencies and backward compatibility.

## 4. IMPROVE SOCKET SECURITY SCORES

Target:

https://socket.dev/npm/package/%40fatdevcon%2Fprecisekit

Baseline from the supplied screenshot:

- Supply Chain Security: 79
- Vulnerability: 100
- Quality: 100
- Maintenance: 88
- License: 100

Investigate actual findings and identify actionable improvements.

Audit package metadata, publishing provenance, CI permissions, dependency security, release workflow, lifecycle scripts, lockfile integrity and distribution contents.

Do not manipulate scoring systems or compromise security to improve scores.

Document factors outside repository control and only report verified score changes.

## 5. REDESIGN README

Create a polished, informative GitHub/npm README with a strong visual hierarchy.

Put critical information first:

1. Package identity and value proposition
2. Attractive, reliable badges
3. Installation and quick start
4. Key features and real examples
5. API documentation links
6. Playground
7. Compatibility and bundle performance
8. Security, contribution and license

Improve readability, code examples, badges and navigation.

Avoid broken badge endpoints, misleading claims and excessive decoration.

## 6. REDESIGN DOCUMENTATION UI/UX

Modernize the existing documentation website without unnecessary framework migrations.

Implement:

- Clear documentation-oriented layout
- Professional typography and consistent design tokens
- Better sidebar and navigation hierarchy
- Searchable API reference
- Redesigned API accordions/detail cards
- Readable signatures and examples
- Copy-code functionality
- Responsive mobile experience
- Accessible keyboard interactions
- Dark/light theme consistency
- Improved SEO and page metadata

Replace the unattractive existing accordion presentation with a more compact, readable and professional design.

**Improve performance visualizations:**

- Display accurate historical bundle comparisons.
- Use attractive horizontal comparison bars with a consistent scale.
- Highlight the current release.
- Show measured gzip/Brotli values where available.
- Clearly distinguish historical fixtures from current measurements.
- Never fabricate benchmark results.

Preserve documentation generation, synchronization and safe playground execution.

## 7. UPDATE ALL PACKAGE DEPENDENCIES TO LATEST STABLE

**This is a mandatory part of the v0.5.1 implementation.**

Review and update all existing dependencies in `package.json`, including:

- `dependencies`
- `devDependencies`
- `optionalDependencies`, if present
- `peerDependencies`, if present and appropriate

### 7.1 Audit installed and available versions

Run:

```bash
npm outdated
npm ls --depth=0
npm audit
```

Inspect each package's latest stable version through the npm registry, using tools such as `npm view`.

Distinguish:

- Installed version
- Version declared in `package.json`
- Latest compatible version
- Latest stable published version
- Major version changes
- Deprecated or unmaintained packages

Do not assume the version reported by `npm outdated` is the latest published stable version; verify the registry `latest` dist-tag.

### 7.2 Upgrade strategy

Update all direct development dependencies to their latest stable releases, including major versions when feasible.

Requirements:

- Do not install alpha, beta, canary, RC or nightly versions.
- Respect Node.js support and engine requirements.
- Keep zero runtime dependencies.
- Preserve ESM/CJS/type declaration compatibility.
- Avoid replacing a stable dependency with an unmaintained alternative.
- Investigate deprecated packages and appropriate replacements.
- Avoid unnecessary dependency additions.
- Keep toolchain dependencies mutually compatible.

For major upgrades:

1. Read official changelogs and migration guides.
2. Identify breaking changes.
3. Update affected configurations and code.
4. Fix deprecated APIs.
5. Update tests and tooling where necessary.
6. Verify compatibility with the project's supported environments.

Check interactions between TypeScript, Jest, ts-jest, tsup, Rollup, ESLint, type declarations and any documentation tooling actually used by the repository.

Do not blindly run `npm update` and assume the task is complete.

Do not use `--force`, `--legacy-peer-deps` or `npm audit fix --force` to bypass legitimate incompatibilities.

If a latest major version cannot support an essential project constraint, retain the newest verified compatible stable version and document the blocker.

### 7.3 Lockfile integrity

After upgrading:

- Update `package.json`.
- Regenerate/synchronize `package-lock.json` with npm.
- Verify `npm ci` succeeds from a clean installation.
- Ensure no unnecessary changes to dependency metadata.
- Review unexpected transitive dependencies.
- Confirm no runtime dependency was introduced accidentally.

Use reproducible installations and avoid unrelated package manager migrations.

### 7.4 Security verification

After upgrading, run:

```bash
npm audit
npm ls --depth=0
npm outdated
```

Investigate and remediate security alerts wherever safely possible.

Do not silently suppress advisories.

Review the impact of major upgrades on build scripts, CI/CD and publishing.

### 7.5 Regression testing

Run all affected checks after dependencies have been upgraded:

```bash
npm run typecheck
npm run lint
npm test -- --runInBand
npm run build
npm run test:package
npm run test:bundle
npm run docs:sync
npm run test:docs
npm run test:site
npm run test:tarball
```

Inspect each script's actual definition before execution and respect the repository's documented build/test order.

Also run existing aggregate checks, consumer tests, and security checks when available.

Resolve incompatibilities rather than bypassing failing checks.

### 7.6 Dependency upgrade report

Report dependency changes in a table:

| Package | Previous | Updated | Breaking changes | Verification |
|---|---|---|---|---|

Include:

- Successfully upgraded packages
- Packages intentionally retained and why
- Major migrations performed
- Security findings resolved
- Remaining known limitations
- Verification outcomes

The goal is **the newest secure, stable and compatible dependency set**, not merely newer version numbers.

## 8. BUNDLE & PERFORMANCE OPTIMIZATION

Measure baseline and final library and documentation performance.

Focus on:

- Named-import tree-shaking
- Consumer bundle sizes
- Unnecessary code duplication
- Import-time side effects
- Docs asset sizes
- Runtime loading performance

Preserve the project's intentionally readable, unminified distribution build.

Use existing bundle scripts and verified fixtures.

Report actual before/after measurements without manipulating historical values.

## 9. COMPREHENSIVE VERIFICATION

Perform functional, regression, compatibility, security and UI/UX tests.

Validate:

- New public utilities and type declarations
- Existing API compatibility
- ESM, CJS and consumer imports
- Node.js 18+ compatibility where supported
- SSR-safe behavior
- Dependency and build-tool integration
- Tree-shaking
- Documentation rendering
- Search, navigation, accordions and playground
- Desktop/mobile responsive layouts
- Accessibility
- Package tarball contents
- CI workflow compatibility

Use browser automation and screenshots if relevant tools are available.

Fix discovered defects and rerun affected checks.

Never remove tests or weaken assertions to hide failures.

## 10. PREPARE VERSION v0.5.1

Synchronize release-related artifacts:

- `package.json`
- `package-lock.json`
- Public exports and declarations
- README
- CHANGELOG
- Documentation/API reference
- Playground data
- SEO metadata
- Bundle metrics
- Relevant versioned fixtures and scripts

Follow existing repository conventions.

Review the compatibility of the requested patch version with the project's documented SemVer policy and report any concerns.

Do not automatically:

- Commit
- Push
- Change branches
- Create tags
- Create GitHub releases
- Publish to npm
- Deploy documentation

Only prepare and verify a release-ready working tree.

## 11. FINAL ACCEPTANCE CRITERIA

The task is complete when:

- All three new utility functions are implemented and tested.
- Existing `withTimeout()` is reviewed.
- Every applicable dependency has been reviewed against the latest stable release.
- Dependency migrations and compatibility issues are resolved or explicitly documented.
- Lockfile and clean installation are verified.
- Actionable Socket security issues are addressed.
- README is professional, attractive and informative.
- Documentation UI/UX is materially improved.
- API accordions/detail views are redesigned.
- Bundle comparison charts use verified measurements.
- Consumer bundles and tree-shaking are tested.
- Relevant tests pass or remaining blockers are accurately reported.
- All v0.5.1 release metadata is synchronized.

## 12. FINAL REPORT

Respond entirely in **Vietnamese**, including:

1. Implementation summary
2. New public APIs
3. Dependency upgrade table
4. Security and Socket findings
5. README/docs improvements
6. Before/after bundle metrics
7. Test and verification results
8. Changed files
9. Remaining risks and limitations
10. Release readiness and recommended next steps

Be precise about completed changes, measured outcomes, skipped checks and unresolved issues.

**Begin by reading repository instructions and auditing the codebase. Create the implementation plan, execute it, perform thorough verification, and prepare PreciseKit v0.5.1 for release.**
