# v0.5.2 CI / publishing audit — 2026-10-23

## Evidence from actual GitHub API and raw logs

- Latest CI: [39910731269](https://github.com/PhanHoangQuocTu/precisekit/actions/runs/39910731269), success, master b3e089cf34c90a365fdb9eb839190eb36eeba8a6.
- Latest CodeQL: [39910731360](https://github.com/PhanHoangQuocTu/precisekit/actions/runs/39910731360), success. Analysis 2010993951 at 06:19:45 UTC contains five findings; scan execution success does not mean vulnerabilities resolved. Full alert payloads in /tmp/precisekit-alerts.json.
- Latest Pages: [39910730333](https://github.com/PhanHoangQuocTu/precisekit/actions/runs/39910730333), success for build, report-build-status and deploy. API reports legacy publishing from master:/docs; no repository-owned Pages workflow exists. Historical cancellations 39898690106, 39898652260, 39898624495 occurred amid rapid successive master pushes, superseded by successful deployments. No evidence of a present Pages outage. Legacy deployment does not wait for repository CI; switching to a gated custom workflow also requires GitHub Pages source configuration and has not been performed.
- Latest Dependabot update executions success (39910867250, 39910862708, 39910862313, 39910861688, 39910860634, 39910737812, 39910737617). Dependabot alert endpoint returns HTTP403: alerts disabled, missing admin:repo_hook scope for enabling. No claim that remote alerts are zero.
- Dependency review workflow has no recorded executions (workflow runs API empty); PR-only trigger means it does not run on push/release. Cannot claim it was repaired or succeeded.
- Publish [39911220041](https://github.com/PhanHoangQuocTu/precisekit/actions/runs/39911220041), failure. Raw job 120274434109 logs show all verification gates success, Node v22.23.3, npm 11.21.1; final publish fails: `You cannot publish over the previously published versions: 0.5.1.` Registry publication timestamp 0.5.1 = 2026-10-23T06:23:53.146Z, before preflight 06:23:58 and publish 06:24:41. Existing npm-view guard did not block; it suppresses every error and fails open. The precise original npm-view error was discarded, so cannot be reconstructed. Raw log saved /tmp/precisekit-publish.log.
- Earlier Publish [39897681668](https://github.com/PhanHoangQuocTu/precisekit/actions/runs/39897681668), historical failure ENEEDAUTH (raw /tmp/precisekit-old-publish.log); do not conflate with latest duplicate-version failure.
- npm 0.5.1 exists, npm 0.5.2 E404 as of this audit. Registry `dist.attestations` absent on 0.5.1, so no provenance verified for that existing version.
- master classic branch protection endpoint 404, BUT active ruleset master-protection (24556429) applies to default branch, requires PR + 1 approval, deletion/non-fast-forward protections and linear history. required_status_checks list EMPTY. Set actual successful CI/CodeQL check contexts in repository settings before release; not modified remotely.
- GitHub environment npm exists, protection_rules=[], deployment_branch_policy=null. Add required reviewer/tag/branch restrictions manually if desired. npm Trusted Publisher private account state / creation time cannot be read using available GitHub credentials; user-reported Pending validation is unverified account state. No successful authorized publish attempted.

## Changes implemented locally

- Shared scripts/verify-release-registry.mjs reads public npm package metadata directly over HTTPS with 30s timeout, no credential/registry inheritance, no-cache header, redirect rejection. Requires HTTP200 + correct package name + versions object; blocks duplicate versions, missing packages, authorization/network/server errors and malformed metadata.
- Publish workflow replaces fail-open npm-view guard, repeats registry check immediately before publish, explicitly disables setup-node automatic cache, runs registry regression tests, preserves GitHub-hosted runner, npm environment, pinned actions/npm, OIDC permission and signed provenance.
- CI verify job runs dependency-free registry regression tests.
- scripts/release.sh uses same registry preflight/tests and includes missing production audit plus Bun gate. --skip-tarball explicitly reports skipped Bun/tarball checks; no full release claim from those omissions.
- Publish header documents direct npm-publish permission and two-day validation expiration.

## Local verification

- node scripts/verify-release-registry.test.mjs: 4 tests PASS (absent version, duplicate including null entry, HTTP/network errors, malformed metadata/JSON).
- Read-only live integration: 0.5.2 absent allowed, 0.5.1 duplicate blocked.
- bash -n scripts/release.sh PASS; node --check both new mjs files PASS; git diff --check PASS.
- actionlint and CodeQL CLI unavailable (`command -v` empty). New GitHub executions require approved push/release; none dispatched, pushed or published. Full release helper not run because intentionally requires clean committed master and performs the expensive gates main agent runs separately.

## Official requirements verified

https://docs.npmjs.com/trusted-publishers/ — npm>=11.5.1, Node>=22.14.0, GitHub-hosted runner, exact identity/workflow/environment, id-token write, explicit direct-publish permission for newer registrations. First successful publish must occur within two days, or delete expired configuration and recreate exact identity. Successful OIDC public-package/public-repository publish provides provenance; retained --provenance explicitly. Existing toolchain meets requirements; latest failure is not evidence of OIDC misconfiguration.
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site — branch /docs publishing remains supported, custom Actions deployment requires source configuration.

## Remaining release actions (not executed)

Review exact npm account Trusted Publisher identity PhanHoangQuocTu / precisekit / publish.yml / npm, enable direct publish, recreate only if expired; do not retry 0.5.1. Configure required status checks, optionally protect npm environment, enable Dependabot alerts. After approval, push verified master changes, create approved v0.5.2 tag/release through existing script instructions. Inspect NEW CI/CodeQL/Pages/Publish runs, verify all five alerts resolved, npm0.5.2 provenance and Trusted Publisher validation. No local source change can validate the private trusted-publisher registration without the real authorized publish.
