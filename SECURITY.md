# Security policy

## Supported versions

Security fixes are released for the latest minor version of `@fatdevcon/precisekit`. Please upgrade before reporting an issue you found on an older release.

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately through GitHub:

1. Open the [Security tab](https://github.com/PhanHoangQuocTu/precisekit/security) of the repository.
2. Choose **Report a vulnerability** and describe what you found, how to reproduce it and the affected versions.

Please include a minimal reproduction without real secrets. Confirmed issues are addressed in a security release and credited in the changelog unless you prefer otherwise; response times are not guaranteed.

## Supply-chain posture

- **No runtime dependencies.** The published package declares no runtime dependencies.
- **Readable, unminified build output**, so the published files can be audited directly.
- **No install hooks.** Library runtime code does not use `eval`, perform network or file-system I/O, or spawn child processes. Caller-provided callbacks can have their own side effects; development and release tooling is separate.
- **Safe path helpers.** `setByPath` rejects `__proto__`, `constructor` and `prototype` keys; `deepMerge` skips those keys.
- **Release provenance.** Releases are published by the `Publish` GitHub Actions workflow (`.github/workflows/publish.yml`) using npm trusted publishing (OIDC, no long-lived npm token) with an npm provenance attestation. Version 0.5.0 was published before this workflow was in place and has no provenance attestation. Verify a given version on its npm page or with `npm audit signatures` rather than assuming it.
- **Pinned CI.** GitHub Actions used by the workflows are pinned to full commit SHAs and updated through Dependabot; workflows run with read-only repository permissions by default.
- URL helpers validate redirects and redact logs within their documented contracts; they are not general sanitizers or SSRF protection. Redaction rejects unsupported structures rather than returning secret input on failure.
