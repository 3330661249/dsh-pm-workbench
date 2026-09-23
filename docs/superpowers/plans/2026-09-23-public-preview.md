# Public Preview Publication Plan

> For agentic workers: execute inline, preserve all local project data and existing work.

**Goal:** publish the authorized workbench preview under MIT; prepare ripple separately without distributing restricted code/assets.
**Architecture:** retain the existing repository and PR; preserve the current runtime and Git history. GitHub publication is separate from npm publication.
**Spec:** user-approved two-project publication discussion and explicit MIT approval, September 23.

## Tasks

- [x] Read-only inspect remote repository, existing PR and current source.
- [x] Scan reachable history and tracked source for common secret patterns; manually classify matches without displaying credentials.
- [x] Add MIT notices, current README, synthetic example and honest preview boundaries.
- [ ] Verify build, tests and exact package contents; document installation from the local CLI contract.
- [ ] Stage only reviewed source/docs/tests, excluding all private runtime directories; commit and update existing PR without force pushing.
- [ ] Check remote CI, merge if passing, then expose only audited content and publish a labelled prerelease.
- [ ] Keep ripple code/photo private pending redistribution permission; record a local release hold with an author-contact draft.

## Review Focus

No real customer data or profile secrets; no unreviewed historical attachments; no fabricated fresh-install proof; no arbitrary-POC promise; no restricted ripple source or photo in workbench package.
