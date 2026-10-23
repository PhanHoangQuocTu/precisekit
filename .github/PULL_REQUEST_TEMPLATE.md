## Summary

<!-- What changes and why? Link the related issue if there is one. -->

## Type of change

- [ ] Bug fix (no public contract change)
- [ ] New public helper (compatible)
- [ ] Documentation / tooling only
- [ ] Breaking change (discussed with the maintainer first)

## Checklist

- [ ] Source, tests, type declarations/exports and docs examples are updated together
- [ ] No new runtime dependency was added
- [ ] `npm run check` passes (typecheck, lint, Jest, build)
- [ ] `npm run docs:sync` leaves no diff, then `npm run test:package`, `npm run test:docs` and `npm run test:site` pass (for public behavior or docs changes)
- [ ] `npm run test:tarball` passes (needs Bun; for export, type or build changes)
- [ ] Commits follow Conventional Commits
- [ ] I did not bump the package version (the maintainer does that at release time)

## Verification

<!-- Paste the commands you ran and their result. State any check you could not run. -->

## Risks

<!-- Compatibility, bundle-size or behavior risks. Write "none known" if applicable. -->
