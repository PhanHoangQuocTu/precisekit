## PreciseKit 0.5.2

Security and release-infrastructure maintenance; no public API changes or runtime dependencies.

- Replace backtracking date tokenization, timezone suffix matching and byte-size parsing with linear-time processing.
- Harden FAQ text extraction against nested and incomplete delimiters while retaining script-safe JSON-LD encoding.
- Add adversarial parsing and documentation regressions.
- Make npm duplicate-version checks fail closed on registry errors and recheck immediately before OIDC publishing.
- Preserve signed provenance, synchronize release gates and refresh documentation/playground assets.

Local verification: 1608 Jest tests; Bun 1297 pass, 2 skip; ESM/CJS and TypeScript tarball consumers; package/docs/site checks; production and full dependency audits (0 vulnerabilities).

GitHub CodeQL remediation and npm Trusted Publisher validation must be verified after the authorized remote runs.
