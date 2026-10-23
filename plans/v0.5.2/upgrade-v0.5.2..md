# Task: PreciseKit v0.5.2 — Security Hardening, GitHub Actions Recovery & Trusted Publishing

## 1. Role & Mission

Act as a team of experienced specialists:

- **Senior TypeScript Library Engineer:** Maintain clean, secure, reliable, performant and backward-compatible utilities.
- **Application Security Engineer:** Investigate CodeQL findings, ReDoS vulnerabilities, input sanitization and supply-chain risks.
- **Senior DevOps / CI/CD Engineer:** Diagnose and fix GitHub Actions, npm OIDC Trusted Publishing, provenance and release automation.
- **Senior QA / Test Automation Engineer:** Design comprehensive regression, edge-case, security and integration tests.
- **Technical Documentation Engineer:** Maintain accurate release documentation, changelogs and maintainer instructions.

**Objective:** Prepare PreciseKit v0.5.2 as a stable security and infrastructure maintenance release. Resolve existing security findings and actionable workflow failures, improve publishing reliability, and verify that the public package remains fully functional.

Repository: `https://github.com/PhanHoangQuocTu/precisekit`

Package: `@fatdevcon/precisekit`

Target version: `0.5.2`

Working branch: `master`

**Respond to me in Vietnamese.** Technical names, source code, CLI commands and established terminology may remain in English.

## 2. Mandatory Working Rules

1. Read `CLAUDE.md`, `AGENTS.md`, `.claude/rules` and other repository instructions before making changes.
2. Inspect the actual codebase, workflows, security findings and available CI logs. Do not assume the provided screenshots represent the complete current state.
3. Discover and use relevant active Claude Code skills, MCP servers, plugins and specialized agents for code analysis, security, testing, GitHub Actions and verification.
4. Delegate independent investigations to appropriate agents when useful. Optimize token usage by avoiding duplicated repository reads and redundant work.
5. Work directly on `master`. Do not create or switch to another branch.
6. Preserve existing public APIs, error codes, return types, import compatibility and documented behavior.
7. Preserve zero runtime dependencies unless an exceptional change is technically justified.
8. Maintain ESM, CJS, TypeScript declarations, tree-shaking, supported Node/Bun environments and browser/SSR compatibility.
9. Do not silence security scanners, disable checks, ignore failures or delete tests simply to obtain green status.
10. Do not expose credentials, tokens or secret contents in logs.
11. Do not rewrite history, force-push, unpublish packages or delete existing release tags.
12. Create a concise implementation plan and proceed with implementation. Only stop for missing credentials, mandatory external configuration or destructive/irreversible actions.
13. Do not commit, push, publish or create a release until the relevant verification steps have passed. Obtain my approval before the final public release.

## 3. Phase 1 — Audit Current Repository & CI/CD

First, inspect:

- `package.json`, lockfile and `publishConfig`
- `.github/workflows/`
- `.github/dependabot.yml`
- GitHub Actions runs and required status checks
- GitHub Code Scanning and Dependabot alerts
- `scripts/release.sh` and other release helpers
- Existing unit, integration, package and documentation tests
- npm registry state for versions 0.5.1 and 0.5.2

Investigate each GitHub workflow, including CI, CodeQL, Publish, Dependabot, dependency review and documentation deployment.

Classify each latest relevant execution as:

- Success
- Failed
- Pending / Waiting
- Cancelled
- Skipped
- Blocked by external configuration

For non-successful runs, distinguish actual defects from intentional skips, concurrency cancellation, environment approvals, obsolete historical failures and genuine infrastructure problems.

For each actionable problem, record its root cause, evidence, affected files, risk level and proposed correction.

Use GitHub MCP/API or `gh` CLI when available. If authenticated logs cannot be accessed, explain exactly which evidence is missing rather than guessing.

Create an implementation plan at `plans/v0.5.2-security-ci-release.md`, following the existing planning conventions.

## 4. Phase 2 — Resolve All Five High-Severity CodeQL Findings

GitHub currently reports these five alerts:

| Alert | Type | Location |
|---|---|---|
| #5 | Incomplete multi-character sanitization | `scripts/verify-site.mjs:177` |
| #4 | Incomplete multi-character sanitization | `scripts/sync-docs.mjs:178` |
| #3 | Polynomial regular expression on uncontrolled data | `src/utils/date-format.ts:407` |
| #2 | Polynomial regular expression on uncontrolled data | `src/utils/date-format.ts:117` |
| #1 | Polynomial regular expression on uncontrolled data | Number formatter module, around line 156; resolve exact path from CodeQL |

Links: `https://github.com/PhanHoangQuocTu/precisekit/security/code-scanning`

For each finding:

1. Retrieve and analyze the complete CodeQL alert, including source-to-sink data flow if available.
2. Identify the actual vulnerability and whether the input can be attacker-controlled.
3. Fix the underlying behavior rather than merely changing syntax to evade detection.
4. Replace vulnerable regular expressions with bounded, linear-time processing, explicit parsing or safer validated logic where appropriate.
5. For sanitization findings, verify that overlapping or repeated dangerous sequences cannot survive a single sanitization pass.
6. Check whether fixes change legitimate inputs or public behavior.
7. Add targeted regression tests, adversarial inputs and large-input tests.
8. Verify that malformed or malicious input cannot cause unexpected excessive CPU consumption or unsafe output.
9. Maintain date-formatting, timezone, Unicode and number-formatting correctness.

Pay special attention to decimals, negative values, separators, special characters, long strings, year boundaries, leap years, timezone offsets and existing error contracts.

Avoid unbounded regex execution, accidental changes to output formatting and arbitrary input truncation that silently breaks documented behavior.

Do not mark an alert as dismissed without technical justification.

**Acceptance:** All five vulnerabilities are addressed in code, tests pass, and subsequent CodeQL analysis confirms they are resolved. If an alert remains, report its exact status and evidence.

## 5. Phase 3 — Diagnose & Repair npm Publishing

Known incident:

- GitHub Actions `Publish #3` for v0.5.1 failed.
- Trusted Publisher is configured but shows `Pending validation`.
- npm publishing uses GitHub OIDC.
- GitHub environment `npm` exists.

Relevant workflow:

`.github/workflows/publish.yml`

Trusted Publisher configuration:

- Organization/user: `PhanHoangQuocTu`
- Repository: `precisekit`
- Workflow filename: `publish.yml`
- Environment name: `npm`
- Direct `npm publish`: enabled

Failed run:

`https://github.com/PhanHoangQuocTu/precisekit/actions/runs/39911220041`

### Investigation requirements

1. Retrieve the actual failure logs, especially the `Publish with provenance` step.
2. Confirm the current npm registry state before modifying any release logic.
3. Verify package name, repository URL, package version, GitHub release tag and `master` consistency.
4. Verify OIDC permissions (`id-token: write`) and GitHub environment identity.
5. Verify supported Node.js and npm CLI versions.
6. Check authentication behavior, registry configuration, token conflicts and access permissions.
7. Validate GitHub-hosted runner compatibility.
8. Verify npm provenance configuration and publishing permissions.
9. Review release triggers, concurrency, permissions, tag validation and duplicate-version prevention.
10. Preserve signed provenance and supply-chain security.

Prefer npm OIDC Trusted Publishing instead of long-lived write tokens.

Do not introduce an `NPM_TOKEN` workaround unless there is an unavoidable compatibility issue, clearly documented and approved.

Do not disable provenance merely to make publishing succeed.

**Important:** Trusted Publisher can transition from `Pending validation` to validated only after a successful authorized publish. Code changes or local tests cannot independently complete this external verification.

The current configuration may expire 48 hours after creation. Check its status before release and provide manual reconfiguration instructions if it has expired.

Do not attempt to republish v0.5.1 if it already exists on the registry.

## 6. Phase 4 — Improve All GitHub Actions Workflows

Audit and repair all actionable `Failed`, `Pending` or incorrectly `Skipped` jobs.

Review:

- Workflow triggers and event filters
- Minimal token permissions
- Branch and tag restrictions
- Workflow concurrency
- Timeouts and cancellation behavior
- Dependency caching and lockfile correctness
- Build artifact integrity
- Dependency review and Dependabot behavior
- CodeQL configuration and reporting
- Pages deployment
- npm release preflight checks
- Toolchain and action-version compatibility
- Supply-chain hardening and pinning where appropriate

Ensure that:

1. CI runs on the appropriate commits and pull requests.
2. Security scanning remains active and reliable.
3. Documentation deployment does not publish broken artifacts.
4. Dependency-review checks distinguish legitimate skips from failures.
5. Publishing cannot occur before required checks pass.
6. Existing published versions are never silently overwritten.
7. Error logs identify failures clearly.
8. Workflows follow least-privilege principles.

Avoid unnecessary retries and duplicated expensive builds.

Do not alter historical run statuses or claim that previously failed executions have been repaired. Validate the corrected workflows using new runs.

## 7. Phase 5 — Dependency & Supply-Chain Review

Inspect dependencies and development tooling for outdated, vulnerable, unsupported or incompatible packages.

Upgrade packages where safe and justified. Avoid uncontrolled major-version upgrades that add unrelated release risk.

Verify:

- Runtime dependency count remains zero.
- Lockfile remains synchronized.
- Production dependency audit passes.
- Build toolchain compatibility is preserved.
- GitHub Actions versions are compatible.
- Any remaining vulnerability has a documented reason and mitigation.

Prefer actual fixes over broad suppression or audit exceptions.

## 8. Phase 6 — Comprehensive Verification

Run the existing project's verification commands after reading their definitions in `package.json`.

At minimum, where available and applicable:

```bash
npm ci
npm run check
npm run test:package
npm run test:docs
npm run test:site
npm run test:bun
npm run test:tarball
npm audit --audit-level=low --omit=dev
npm pack --dry-run
```

Also verify:

- TypeScript and lint checks
- Unit and integration tests
- Security regression tests
- Date, number and sanitization edge cases
- Package exports and declarations
- ESM / CommonJS consumers
- Bun compatibility
- Browser and SSR safety
- Documentation generation consistency
- Release metadata correctness

Add or update tests as needed, but do not weaken assertions to obtain passing results.

If a check cannot be executed locally, document the limitation and ensure the equivalent CI validation is scheduled.

For CodeQL, use the repository's supported scanning workflow to confirm remediation.

## 9. Phase 7 — Prepare v0.5.2 Release

Once implementation and verification have passed:

1. Update package version to `0.5.2` and synchronize the relevant lockfile.
2. Update CHANGELOG and release notes.
3. Update README and release/security documentation where relevant.
4. Verify that all package metadata references PreciseKit correctly.
5. Document fixes for CodeQL, publishing and CI/CD.
6. Confirm that no unrelated feature changes have entered the release.
7. Prepare a clean, reproducible release from `master`.
8. Validate the package tarball and registry readiness.
9. Present the exact commit, tag and GitHub Release actions required.
10. Request my approval before pushing release-related changes or publishing the package.

Do not create or publish a version merely to test credentials.

After approval and a real GitHub release, verify from external systems:

- GitHub Publish workflow succeeded.
- npm registry contains `@fatdevcon/precisekit@0.5.2`.
- Package provenance is available.
- Trusted Publisher status is validated.
- CodeQL scanning has reanalyzed the fixed code.
- Documentation deployment succeeds.

If actual release requires manual account actions, provide exact instructions and do not report them as completed.

## 10. Final Deliverables & Reporting

Provide a final Vietnamese report with:

1. Root causes of actionable failures.
2. Summary of all five CodeQL fixes.
3. GitHub Actions changes and verification status.
4. Trusted Publisher diagnosis and current validation state.
5. Dependency and security improvements.
6. Changed files and version updates.
7. Executed tests with actual results.
8. Remaining external blockers, if any.
9. Release readiness assessment.
10. Exact next steps to complete v0.5.2.

Clearly distinguish:

- **Fixed in source**
- **Verified locally**
- **Verified by GitHub Actions**
- **Verified on npm**
- **Pending external/manual action**

### Definition of Done

v0.5.2 is considered fully released only when:

- All five identified High CodeQL alerts are resolved and verified.
- Relevant current CI/CD workflows succeed.
- No critical publishing blockers remain.
- Regression and package compatibility checks pass.
- `@fatdevcon/precisekit@0.5.2` is successfully published through OIDC.
- npm provenance is available.
- Trusted Publisher is validated.
- Documentation and release metadata are consistent.

Do not claim complete success before these conditions are verified.

**Start immediately with repository inspection, security/CI root-cause analysis, a concise implementation plan and execution. Prioritize real security and publishing defects.**