# Probe results

This record follows the Go/No-Go meanings in the approved design specification.
`Not run` is not evidence of compatibility or authorization. Technical checks
belong under Gate A; Gates B–E retain their product-scope release meanings.

## Gate A — isolated technical probe

Gate A permits only an isolated probe with project-local data, a non-3080 port,
and synthetic inputs. A failed required sub-probe stops every downstream item.

| Technical-probe check | State | Fresh evidence | Result |
| --- | --- | --- | --- |
| Static Host/Client bundle contract and additive patch syntax | Passed as a static check only | `cd plugins/dsh-pm-workbench && npm run typecheck && npm test && npm run build && npm run verify:package && npm run pack:dry`; pristine structured copy with offline `npm ci`; isolated `dsh --profile web --patch .../cordis.patch.yml --dump-config` | Typecheck passed; 6/6 tests passed locally and in the pristine copy; build/package checks passed; 9-file dry-run pack; patch parsed and appended one `dsh-pm-workbench` row. This is not a profile load result. |
| Generated strict Typert Host/Client Remote descriptors | **Failed** | Original rc.6 isolated probe; then frozen selection and experimental matrices from clean commit `d1cb6c6` with one hashed synthetic fixture and eight reviewed exact dependency graphs; canonical results in [`matrix-results/2026-09-02-darwin-arm64/`](matrix-results/2026-09-02-darwin-arm64/) | The original rc.6 ordinary bundle existed while all five required Typert artifacts were absent. The hardened matrix reproduced this across rc.6, rc.7, rc.8, 1.1-rc.1, 1.1-rc.2, and alpha.2-alpha.4: each exact package was discovered once, while automatic and forced generation both returned 0 and artifacts remained 0/5. Selection: `NO_ELIGIBLE_CANDIDATE`; experimental: `EXPLORATORY_ONLY`. |
| Host and Client package load/mount/health | Not run — stopped | Prohibited after the strict Remote failure | No load, mount, `$mount`, transport, or health result was tested. |
| Additive `sidebar.footer.action` opens `shell.overlay`; no root replacement | Not run — stopped | Prohibited after the strict Remote failure | No UI implementation or browser interaction was started. |
| Strict JSON Remote creates and reads one synthetic Project | Not run — stopped | Prohibited after the strict Remote failure | No project API or data was implemented. |
| Profile-private persistence, restart, CAS conflict and idempotency | Not run — stopped | Prohibited after the strict Remote failure | No persistence implementation was started. |
| Mock Run starts, polls, cancels and restores as `interrupted` | Not run — stopped | Prohibited after the strict Remote failure | No Run implementation was started. |
| Tarball install, removal/restart recovery, original chat and ripple coexistence | Not run — stopped | Prohibited after the strict Remote failure | Only `npm pack --dry-run` was checked; no Harness install/remove or browser E2E occurred. |

Strict Remote evidence:

- `.tmp/dsh-pm-workbench/typert-probe-a-report.md`
- `.superpowers/sdd/2026-09-01-dsh-pm-workbench-v0.1/gate-a-remote-review.md`

| Gate decision field | Value |
| --- | --- |
| Decision | **NO-GO.** The approved architecture requires generated strict Host/Client Remote artifacts. All eight tested exact official cohorts produced no generator output for the fixed normal npm-workspace fixture. No selection candidate is eligible for the next isolated mount probe. Stop before UI, storage, Mock Run, profile install, or E2E until a human approves a new architecture and a fresh Gate A. |

## Gate B — allow the text-only personal Alpha

| Field | Value |
| --- | --- |
| State | Not run; blocked by Gate A No-Go |
| Result | No personal Alpha was built or installed. |
| Decision | Do not begin until the owner chooses and approves a revised architecture, followed by a new Gate A. |

## Gate C — allow connection to a real model

| Field | Value |
| --- | --- |
| State | Not run; blocked by Gate A No-Go |
| Result | No model, provider, network tool, prompt, or real response was used. |
| Decision | Do not connect a real model. Fixed synthetic-fixture regressions and their explainability remain future requirements. |

## Gate D — allow processing of real interviews

| Field | Value |
| --- | --- |
| State | Not run; blocked by Gate A No-Go |
| Result | No real interview, transcript, recording, identity, or provider data was read or processed. |
| Decision | Do not process real interviews. |

## Gate E — allow a public Alpha

| Field | Value |
| --- | --- |
| State | Not run; blocked by Gate A No-Go |
| Result | A private, unofficial GitHub research repository and its `origin` remote have been created to hold governance, the plugin skeleton, research, and matrix work. This private research setup is not a public Alpha. No public repository, public release, package publication, installable Alpha, deployment, public license grant, or merge to `main` has been completed. |
| Decision | Do not publish or deploy. Keep the research repository private, keep the workbench `UNLICENSED`, and do not treat a private branch or Pull Request as Gate E approval. |
