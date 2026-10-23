# Migrating from utilities to PreciseKit

The migration baseline is `@fatdevcon/utilities@0.4.2` to `@fatdevcon/precisekit@0.5.0`.
These versions describe this historical migration and do not follow future release bumps.

```sh
npm uninstall @fatdevcon/utilities
npm install @fatdevcon/precisekit
```

Replace the old package specifier in JavaScript imports, CommonJS requires and
TypeScript type imports. Existing function names, return kinds, numeric error
codes, root exports and `dist/*` subpaths remain supported under the new name.
There is no automatic alias from the old package name.

```ts
import { summary, type NumericInput } from "@fatdevcon/precisekit";
const amount: NumericInput = summary("0.1", "0.2");
```

New optional capabilities cover money, normalization, locale parsing, concurrent
workflows, business calendars and URL/redaction helpers. They add no runtime
dependencies. Existing local-calendar Date helpers remain unchanged; new business
calendar helpers deliberately accept/return date-only strings.

Documentation: https://phanhoangquoctu.github.io/precisekit/

## Maintainer announcement draft

PreciseKit is the successor to @fatdevcon/utilities. New releases use
@fatdevcon/precisekit. Please replace the installation and import name; existing
utility behavior remains supported. See the migration guide and changelog for
the new features and precise contracts.

This is an announcement draft, not a claim that npm deprecation has occurred.
Repository rename/redirects, registry publication, any old-package deprecation
and documentation deployment require separate maintainer actions.
