# Probe results

This is the repository's canonical phase and gate-status ledger. Its run-ID
blocks are append-only and immutable; a promoter may regenerate only the
designated summary rows from the latest accepted block after it revalidates the
frozen source/run closure. A summary row cannot delete, rewrite, or supersede an
earlier run block. Package-local documentation is an immutable build-time
statement and cannot supersede this ledger; every later runtime observation
must identify the exact source and tgz hashes it applies to.

This record preserves the historical, then-approved generated-Typert Gate A
result and separately tracks the owner-approved Connection RPC architecture and
its implementation plan set, which is pending owner review. Gate A′ has not run.
`Not run` is not evidence of
compatibility or authorization. Gates B–E retain their product-scope release
meanings.

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

## Architecture decision after the historical Gate A

On 2026-09-02, the owner approved public Connection RPC plus a shared strict Zod
endpoint registry and `WorkbenchTransport` abstraction for the next design. The
decision does not revise the historical result above. It creates a different,
still-unproved Gate A′. The implementation plan set exists at
[`superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-rollout.md`](superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-rollout.md),
remains pending owner review, and authorizes no code or runtime action.

## Gate A′ — isolated Connection RPC integration probe

Gate A′ permits only a real tgz in a project-local profile, a non-3080 port, and
synthetic counter data. The canonical scope and claim boundary are in
[`superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md`](superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md).

| Connection RPC probe check | State | Result |
| --- | --- | --- |
| Target rc.6 package exports, Host/Client injects and public signatures revalidated | Not run | No implementation dependency has been added. |
| Real tgz Host and Client load | Not run | No profile load has been attempted. |
| Unique `/dsh-pm-workbench-v1` loopback-only channel and `health` round trip | Not run | No Connection RPC handler or caller exists. |
| Closed endpoint set and strict request/output rejection | Not run | No endpoint registry or shared Zod contract exists. |
| Wrong Host/Origin, cross-site, method, content type and envelope rejected before side effects; listener is loopback-only | Not run | No trust-fence or listener evidence exists. |
| Malformed Host output makes the Client fail closed | Not run | No Client output-validation test exists. |
| Parsed plugin payload budget separated from Connection carrier/body/`rpcId` limits | Not run | Local rc.6 source suggests a 160 MiB default carrier pre-buffer and an unbounded-string `rpcId`; the actual resolved package has not been revalidated in a third-party tgz run. No whole-wire 3 MiB claim is made. |
| Throw-canary response/log/browser scan | Not run | No real RPC exception-path evidence exists. |
| Abort before queue, while queued and after commit begins; result reconciliation | Not run | No RPC cancellation or transaction-timing test exists. |
| Additive launcher opens and closes `shell.overlay` | Not run | Client `apply()` remains a no-op. |
| Synthetic counter CAS, exact-request idempotency, reused-id rejection and restart persistence | Not run | No workbench Domain has been opened. |
| Receipt ledger saturation at 256 and deterministic refusal of the 257th id | Not run | No receipt ledger exists. |
| Client 8-request throttle and Host 16-handler global limit | Not run | No Client throttle or Host admission limit exists. |
| Remove/restart cleans route and UI while retaining declared Domain data | Not run | No plugin install/remove test has run. |
| Reinstall reads the retained synthetic counter/version through `health` | Not run | Retention has not been observed. |
| Original chat and isolated ripple copy coexist | Not run | No browser E2E has run. |
| Logs, errors and artifacts contain no payload, credential, stack or local path | Not run | No runtime evidence exists. |

| Gate decision field | Value |
| --- | --- |
| Decision | **NOT RUN / NO-GO for downstream integration claims.** Architecture selection and this checklist are not proof. Wait for an approved implementation plan and actual Gate A′ evidence. |

## Product component gates — P0 and P1

| Component gate | State | Result |
| --- | --- | --- |
| Evidence Core P0 | Not run | No domain implementation or fixed-fixture golden path exists. |
| Shell-neutral Review UI P1 | Not run | No React test shell, `InProcessTransport` product flow, browser-state, keyboard/focus or reduced-motion acceptance has run. See [canonical spec §12](./superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md#12-shell-neutral-review-ui-p1-验收). |

## Gate B — allow the text-only personal Alpha

| Field | Value |
| --- | --- |
| State | Not run; blocked until Gate A′, Evidence Core P0 and shell-neutral Review UI P1 pass |
| Result | No personal Alpha was built or installed. |
| Required combined evidence | A fresh real tgz in an isolated loopback profile must complete the synthetic create → import → fixture analysis → human review/edit/reorder → baseline publish → deterministic render/chunked export → restart/readback path, plus the snapshot pagination, response-correlation, wire/persistence limits, CAS/receipt, abort, lifecycle, leakage and ripple-coexistence checks in [canonical spec §13](./superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md#13-gate-b合成数据-dsh-plugin-alpha). H0/P0/P1 reports alone do not satisfy Gate B. |
| Decision | Do not begin until the owner approves a new implementation plan and Gate A′, P0 and P1 all pass. Then run Gate B as a separate H1 combination gate; do not infer it from component green lights. |

## Gate C — allow connection to a real model

| Field | Value |
| --- | --- |
| State | Not run; blocked until the text-only personal Alpha gate passes |
| Result | No model, provider, network tool, prompt, or real response was used. |
| Decision | Do not connect a real model. Fixed synthetic-fixture regressions and their explainability remain future requirements. |

## Gate D — allow processing of real interviews

| Field | Value |
| --- | --- |
| State | Not run; blocked until the real-model gate and a separate real-data review pass |
| Result | No real interview, transcript, recording, identity, or provider data was read or processed. |
| Decision | Do not process real interviews. |

## Gate E — allow a public Alpha

| Field | Value |
| --- | --- |
| State | Not run; blocked until installation, product, model, privacy and distribution gates pass |
| Result | A private, unofficial GitHub research repository and its `origin` remote have been created to hold governance, the plugin skeleton, research, and matrix work. This private research setup is not a public Alpha. No public repository, public release, package publication, installable Alpha, deployment, public license grant, or merge to `main` has been completed. |
| Decision | Do not publish or deploy. Keep the research repository private, keep the workbench `UNLICENSED`, and do not treat a private branch or Pull Request as Gate E approval. |
