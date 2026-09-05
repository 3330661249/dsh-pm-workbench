# DSH PM Workbench Minimal Harness Integration Design

**Status:** proposed integration sequence; the 2026-09-04 simple Alpha product direction remains approved, while each implementation stage below requires its own reviewed plan and gate

**Baseline:** `origin/main` merge commit `bd0ae743e0c490b5aa770eccae3dd77d325e9a48`

**Target declarations and eventual runtime:** DeepSeek Harness `0.1.0-rc.6`
**Owner direction:** continue from the accepted standalone Demo with the smallest isolated Harness integration proof

## 1. Purpose

The standalone `材料 → 需求 → 优先级 → PRD` Demo proves the product flow, but it does not prove that a third-party package can load inside DeepSeek Harness. This design defines a narrow sequence that answers that question without touching the user's active Harness profile or introducing real interview data or model calls.

The first technical evidence is declaration-only: the selected public rc.6 Host and Client declaration entrypoints must typecheck against the exact assignments needed for a future Connection RPC health probe and additive launcher/overlay. A separately accepted rc.6 runtime may then load a diagnostic panel and complete that health round trip. Storage, persistence, and the full four-step workbench follow only after their own earlier evidence passes.

## 2. Relationship to earlier documents

The following documents remain research history and are not executable task lists for the current branch:

- `docs/superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-rollout.md`
- `docs/superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-f0-shared-foundation.md`
- `docs/superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-h0-connection-rpc-probe.md`
- `docs/superpowers/plans/2026-09-02-dsh-pm-workbench-v0.1-h1-plugin-alpha.md`

Their public-API, isolation, lifecycle, trust-fence, and evidence requirements remain useful references. Their missing F0 evidence chain and large authorization machinery are not silently treated as completed prerequisites. Any old A01-A22 item used by Full Gate A′ must first be copied into the canonical reconciliation matrix defined in §6.5, with a current acceptance statement and evidence artifact.

The 2026-09-04 simple design remains the product definition. This document only adds the current Harness integration sequence.

## 3. Claim ladder

Each stage has a separate claim. Passing an earlier stage never implies a later one.

| Stage | What may be claimed after PASS | What remains unproven |
| --- | --- | --- |
| A′-P1a Declaration surface | In one accepted TypeScript dependency closure, the Host root declaration augments Cordis `Context` with Host Connection, the public Client Connection types support direct RPC assignments, and official layout/sidebar `/client` declarations augment `ClientContext` slots | A public Client `Context.connection` augmentation, any future workbench-owned Client bridge, JavaScript runtime exports, Cordis composition, live slot declarations, package load, browser behavior, storage, persistence, Harness compatibility |
| A′-P1b Storage declaration surface | In its separately recorded dependency closure, the exact selected rc.6 storage-domain declaration entrypoint exposes the required asynchronous open/close and global-record types | A configured backend, atomicity, restart recovery, retention, live Harness behavior |
| A′-P2 Runtime input and isolated mount | One accepted rc.6 CLI/runtime closure loaded one exact audited workbench tgz in one proven disposable profile root; health and additive launcher/overlay worked | Persistence, restart recovery, full Gate A′, product workflow |
| A′-P3 Synthetic state | The same frozen runtime, tgz, and isolated profile preserved a synthetic counter through the declared restart and composition remove/re-add sequence | Real projects, interview data, model calls, complete Gate A′ |
| Full Gate A′ | Every current item in the canonical reconciliation matrix passed in one frozen run | Product Alpha, real model, real data, public distribution |
| Harness workflow Alpha | The approved four-step synthetic workflow worked inside Harness | Real-data readiness unless a later privacy gate passes |
| Gate M | A separately approved real model path passed synthetic evaluation | Real interview deployment unless separately approved |

The exact permitted A′-P1a report is:

> In the accepted dependency closure and TypeScript configuration, the selected DeepSeek Harness `0.1.0-rc.6` public declarations support Host Connection through the official Cordis Context augmentation, Client RPC through the exported `ConnectionHandle`/`ClientConnectionRpc` types, and additive slots through `ClientContext` plus the official layout/sidebar `/client` augmentations. The rc.6 Client Connection package does not declare `connection` on Cordis Client Context. Harness was not started; no Client bridge, JavaScript runtime export, Cordis composition, live slot declaration, plugin load, browser behavior, storage, persistence, or compatibility was tested.

Until Full Gate A′ passes, A′-P1a, A′-P1b, A′-P2, and A′-P3 are called **preflight slices**, not Gate A′ PASS.

## 4. Fixed safety boundary for Harness-facing work

A′-P1a and A′-P1b do not start Harness, create a profile, install a plugin tgz, bind a port, or open a browser. Before any A′-P2 process starts, a reviewed runtime-input acceptance record must prove all of the following:

- the exact `@deepseek-ai/dsh@0.1.0-rc.6` CLI artifact, its lock, runtime dependency closure, entrypoint, integrity values, and file hashes;
- the exact Node and package-manager identities used to assemble and run that closure;
- execution by an absolute path inside the accepted disposable runtime root, with PATH, global, parent-directory, and active-checkout fallback rejected;
- the exact locally built workbench tgz, its package manifest, integrity, file list, and hashes;
- an environment allowlist that excludes provider configuration, API keys, tokens, cookies, model settings, sessions, workspace paths, proxy variables, and unrelated user configuration;
- a newly created browser context and user-data directory below the disposable run root, with no reuse of the user's current browser profile or saved sessions;
- a profile-root canary proving where rc.6 reads and writes before the plugin is loaded.

Static rc.6 public support for `DSH_HOME` has been found: `@deepseek-ai/dsh-home-paths` exports `DSH_HOME_ENV` and `resolveDshHome` with precedence `explicit path > $DSH_HOME > ~/.dsh`; the rc.6 CLI help locates profiles under `$DSH_HOME/profiles`; and the profile-boot public implementation comments locate the user patch at `$DSH_HOME/cordis.patch.yml`. This is declaration and implementation evidence, not an observed Web-start isolation result. A no-plugin black-box canary must still prove that the accepted CLI redirects every profile read and write before the workbench tgz is loaded. If that proof fails or any access to `~/.dsh` is observed, A′-P2 stops.

After that acceptance gate passes, every Harness-facing run must use:

- the newly created, proven disposable profile root below the repository-controlled temporary run root;
- profile name `pm-workbench-probe` inside that root;
- `127.0.0.1` only;
- port `3186` only if the accepted Harness process acquires the bind itself;
- the existing Connection plugin configured with `trustedHosts: []` inside the disposable composition;
- workbench channel policy `{ authority: 'loopback' }`;
- the accepted CLI/runtime closure and accepted workbench tgz only;
- synthetic strings and integers only;
- no inherited user profile, workspace, session, credential, model, browser profile, or ripple installation.

The pre-bind availability check is diagnostic only because another process can claim the port between inspection and bind. A bind failure must stop without killing or modifying the process that owns the port. PASS requires the accepted Harness process to acquire `127.0.0.1:3186`, and cleanup requires proving that no listener remains after that exact process exits.

The run must not read or write:

- `~/.dsh`;
- port `3080`;
- the `web` or `open-design` user profiles;
- the current browser's profile or saved sessions;
- Desktop, Downloads, clipboard, recordings, transcripts, or real interview files;
- provider configuration, API keys, tokens, cookies, or model responses.

## 5. Architecture

### 5.1 A′-P1a declaration contract

A′-P1a checks only public declarations for Connection, Client runtime, layout/sidebar Client slot augmentations, and the slots core. It does not modify the workbench production manifest, production peers, `dsh.client.inject`, Host code, Client code, built package, or dry-run tgz.

The Client contracts must load the official public Client declaration entrypoints:

- `@deepseek-ai/dsh-client-connection/client`;
- `@deepseek-ai/dsh-client-runtime/client`;
- `@deepseek-ai/dsh-client-ui-layout/client`;
- `@deepseek-ai/dsh-client-ui-sidebar/client`.

The rc.6 `@deepseek-ai/dsh-client-connection/client` entrypoint exports `ConnectionHandle` and `ClientConnectionRpc`, but it does **not** augment Cordis Client Context with `connection`. Only the Host root entrypoint's `rpc-host.d.ts` declares `Context.connection: HostConnectionHandle`. A′-P1a therefore makes three independent checks:

1. the Host contract loads the official Connection root entrypoint and accesses `ctx.connection.rpc.handle(...)` through the official Cordis Host `Context` augmentation;
2. the Client RPC contract uses a directly declared value of the exported public `ConnectionHandle`/`ClientConnectionRpc` type and calls `connection.rpc.call(...)` without asserting that it exists on `ClientContext`;
3. the Client slot contract uses the real public `ClientContext` plus the official layout/sidebar `/client` augmentations for `ctx.slots`, `sidebar.footer.action`, and `shell.overlay`.

The Client contract must not import the Connection Host root entrypoint to make `ClientContext.connection` appear to compile. The absence of an official Client Context augmentation is recorded as `OFFICIAL_CLIENT_CONTEXT_CONNECTION_AUGMENTATION_ABSENT`, not patched locally. If A′-P2 later needs a workbench-owned Cordis bridge, that bridge requires a separate design, production boundary, and real runtime health test; it may not be described as an official rc.6 declaration.

The contracts must not create their own Harness module augmentation or structural substitute. They must reject local `declare module '@deepseek-ai/…'`, explicit or implicit `any`, double casts through `unknown`, `@ts-ignore`, `@ts-nocheck`, `skipLibCheck: true`, and `paths` or `typeRoots` aliases that could supply copied declarations, a Harness source checkout, or parent dependencies.

The lock analysis records every resolved `@deepseek-ai/*` package in the Host and Client declaration closure, including package name, version, integrity, real manifest path, and dependency parent. The five selected direct DSH declaration packages must be exact `0.1.0-rc.6`; every reachable `@deepseek-ai/dsh-*` package must also be rc.6, while independent package lines such as Cordis and Schemastery use their own reviewed exact versions. `npm ls --depth=0` alone is not closure evidence.

Two dependency-input facts are already known and must remain separate:

- a fresh registry resolution of the selected exact rc.6 roots was observed selecting rc.8 through their `^0.1.0-rc.6` transitive ranges and ending in `ERESOLVE`; exact direct roots did not freeze the closure;
- a path-free candidate labeled `local-2026-08-14-rc6-lock-v3` was replayed with `npm ci --ignore-scripts --offline` in a temporary root: 531 packages were installed and all 186 reachable `@deepseek-ai/dsh-*` packages were `0.1.0-rc.6`.

The first observation is a fresh-resolution failure, not a cohort. The second is evidence that a frozen historical cohort can replay, but it is not an accepted A′-P1a input until its matching manifest, lock, cache artifacts, integrity values, provenance, and containment pass an independent acceptance check. Until one input is accepted, A′-P1a may end as `FAIL_FRESH_RESOLUTION` or `INCONCLUSIVE_INPUT_NOT_ACCEPTED`; it must not force GREEN with new overrides.

### 5.2 Future Host and Client probe

After A′-P1a and the runtime-input acceptance gate pass, the Host may register the unique channel `/dsh-pm-workbench-v1` with `authority: 'loopback'`.

Preflight endpoints are closed and stage-specific:

- A′-P2: `health` only;
- A′-P3: `health` and `counter.increment` only.

Unknown endpoints and malformed input or output fail closed. The Host returns the existing rc.6 `RpcResult` envelope. The public Connection declaration shows an asynchronous channel disposer; A′-P1a must typecheck the exact Cordis lifecycle wiring rather than merely assign the disposer. If the public Cordis lifecycle cannot accept and await that disposer, A′-P1a fails. A′-P2 must then observe the channel disappear before unload is recorded as complete and must surface a disposer rejection as failure.

The future Client validates every returned RPC payload and contributes only:

- `sidebar.footer.action` with ID `pm-workbench-probe-launcher`;
- `shell.overlay` with ID `pm-workbench-probe-overlay`.

The public Client slot declaration contract must prove synchronous UI disposers. `@deepseek-ai/dsh-client-ui-slots` has no `dsh.client` loader metadata, so a future workbench manifest must not list it as a Client plugin injection; it remains a public type/core dependency reached through the actual runtime composition. The future production wrapper must reject `root`, `sidebar`, `conversation`, and `details`. The diagnostic panel shows only connection state, plugin and protocol versions, the synthetic counter in A′-P3, an explicit “isolated test” label, and open, retry, increment, and close controls as applicable.

The existing four-step Demo is not mounted during A′-P1a, A′-P1b, A′-P2, or A′-P3.

### 5.3 Future synthetic storage

Storage is not part of A′-P1a or A′-P2. A′-P1b runs only after A′-P2 is independently reviewed and before A′-P3 begins.

A′-P1b checks the public `@deepseek-ai/dsh-storage-domain` declaration entrypoint, the exact `@deepseek-ai/dsh-storage` peer in its recorded closure, the asynchronous return from `DomainFacility.open(...)`, the required global-record operations, and awaited `Domain.close()`. It does not claim that a backend is configured or that persistence works.

A′-P3 must separately freeze and configure the storage hub and exact backend package inside the disposable composition before opening one domain and one global record. The record stores only:

- `counter`;
- `aggregateVersion`;
- a bounded ordered set of idempotency receipts containing request ID, request digest, accepted aggregate version, and deterministic result.

The A′-P3 plan must fix the receipt maximum, eviction order, request-size limit, record-size limit, compare-and-set rule, and reused-ID conflict result before implementation. It stores no source text, filenames, paths, timestamps, user identifiers, sessions, prompts, or model output.

The retention contract is:

- closing the overlay does not alter the record;
- Cordis fiber unmount/remount and disposable composition remove/re-add preserve the record;
- deleting the disposable profile root deletes the record;
- npm/package removal is not used as a synonym for composition unmount and has no implied data-deletion claim.

Ordinary typechecking or successful readback cannot prove backend crash atomicity. If public rc.6 material and a separately reviewed fault test cannot support the required replacement guarantee, A′-P3 stops with `INCONCLUSIVE_STORAGE_ATOMICITY`.

## 6. Stage gates

### 6.1 A′-P1a Declaration surface

PASS requires all of the following:

1. One declaration input mode is explicitly accepted. Fresh registry resolution and frozen historical-lock acceptance remain separate; a fresh `ERESOLVE`, mixed cohort, or unaccepted historical input cannot PASS.
2. The selected exact rc.6 packages resolve below the accepted disposable declaration dependency root, with no parent, global, active-checkout, or source-tree fallback.
3. The same Host, Client RPC, and Client slot declaration contracts are created before dependency installation, fail only because the exact modules are absent, and pass unchanged after an accepted frozen dependency input is installed.
4. The Host contract compiles against the official Host Context augmentation; the Client RPC contract compiles against direct exported `ConnectionHandle`/`ClientConnectionRpc` values; the Client slot contract compiles against `ClientContext` plus official layout/sidebar `/client` augmentations.
5. The contracts prove `ctx.connection.rpc.handle(...)` on Host only, `connection.rpc.call(...)` on the direct Client handle, `sidebar.footer.action`, `shell.overlay`, synchronous UI disposers, the asynchronous RPC disposer, and the public Cordis lifecycle acceptance of that asynchronous disposer.
6. Static guards reject a Host root import in the Client contract, any claim that official `ClientContext.connection` exists, self-declared Harness modules, `any`, double casts, TypeScript suppression directives, skipped library checks, copied declarations, path aliases, type-root aliases, and parent/source-checkout fallback.
7. The accepted lock-derived complete DeepSeek declaration closure is recorded and contains no unexpected cohort.
8. The ledger records `OFFICIAL_CLIENT_CONTEXT_CONNECTION_AUGMENTATION_ABSENT` as an observed public-surface gap.
9. No storage package, production manifest, production peer, production injection list, runtime implementation, Harness source, profile, tgz installation, browser, or listener is used.
10. Input-acceptance checks, focused tests, separate compilers, complete project checks, build, existing package boundary checks, and dependency-locality checks pass.

Any mismatch is recorded as FAIL, `FAIL_FRESH_RESOLUTION`, `MIXED_COHORT`, or `INCONCLUSIVE_INPUT_NOT_ACCEPTED` and returns to architecture review. A′-P2 must not start.

### 6.2 A′-P1b Storage declaration surface

A′-P1b is not implemented by the current plan. Its future reviewed plan must use a same-contract RED→GREEN cycle and prove only the storage declaration types listed in §5.3. It must record its complete DeepSeek closure and must not claim a configured backend, atomicity, restart recovery, or persistence.

### 6.3 A′-P2 Runtime input and isolated mount

A′-P2 cannot start until its runtime-input acceptance record and exact executable procedure are independently reviewed. Npm staging and Harness/Cordis loading are separate recorded operations: the exact tgz is installed without lifecycle scripts into a disposable package root, then an absolute package path is referenced by a patch that exists only in the disposable composition.

PASS requires the accepted runtime and tgz to complete:

1. profile-root canary and environment/browser isolation checks;
2. Host and Client load;
3. exact `health` round trip through `/dsh-pm-workbench-v1`;
4. launcher appearance without replacing the shipped sidebar;
5. overlay open, close, focus restoration, and continued non-model chat-shell interaction;
6. Cordis removal making the launcher, overlay, and channel disappear;
7. awaited asynchronous Host disposal with no rejected cleanup;
8. exact process exit and listener cleanup.

The result is still only an isolated mount preflight.

### 6.4 A′-P3 Synthetic state

PASS requires the same accepted runtime, tgz, and disposable profile to prove:

1. compare-and-set version behavior;
2. exact-request idempotency and reused-ID rejection;
3. restart readback;
4. composition remove/re-add preserving the record exactly as declared in §5.3;
5. no duplicate handler, launcher, or overlay after remount;
6. bounded storage, receipt, and request sizes;
7. clean shutdown and no listener residue;
8. deletion of the disposable profile root removing the synthetic record without touching user data.

### 6.5 Full Gate A′ canonical reconciliation

Full Gate A′ is a separate implementation and review step. Before its plan may be approved, this design receives a canonical matrix with one row for every previously named A01-A22 check and these required columns:

| Column | Required content |
| --- | --- |
| Legacy ID | Exact A01-A22 identifier |
| Decision | `retain`, `replace`, or `drop` |
| Current acceptance | One executable current-version assertion |
| Stage | Exact preflight or Full Gate owner |
| Evidence artifact | Path and machine-checkable result |
| Rationale | Reason for retaining, replacing, or dropping it |

Only rows in that reviewed matrix define Full Gate A′. The future matrix must cover trust-fence negatives, cancellation timing, admission limits, canary scanning, package audit, ripple coexistence, lifecycle cleanup, and evidence closure where retained. An old plan or specification is never itself an executable acceptance list.

## 7. Testing and evidence strategy

The current declaration plan uses one unchanged contract for RED and GREEN: first it fails because the exact packages are absent, then the same bytes pass after the frozen dependencies are installed. Dependency absence alone is setup evidence; it is not RPC, slot, lifecycle, or compatibility evidence.

Host and Client compile in separate TypeScript projects. A sealed arbitrary-path copy proves dependency locality after installation. Offline reproducibility is a different claim: it requires a declared cache/input bundle containing every integrity-bound tarball. A successful `npm ci --offline` against an undeclared machine cache must be labeled cache-assisted locality evidence, not self-contained offline replay.

Future runtime tests use the accepted disposable profile and browser context only after the CLI closure, tgz, patch, environment, and expected evidence files are frozen. Cleanup assertions run on PASS, FAIL, timeout, and signal paths.

No screenshot, config dump, successful build, visible button, declaration compile, or package manifest alone counts as RPC, persistence, disposal, or compatibility evidence.

## 8. Stop conditions

Stop immediately if implementation requires or observes any of the following:

- private imports, copied generated descriptors, or locally recreated Harness module augmentations;
- `/api` interception or a custom bare HTTP route;
- `root`, `sidebar`, `conversation`, or `details` replacement;
- non-loopback binding, `trusted-host` channel authority, proxy, tunnel, or LAN access;
- edits to DeepSeek Harness source or installed package bytes;
- the user's active profile, credentials, model configuration, sessions, browser profile, or real data;
- an unreviewed lifecycle script;
- an unresolved mixed DeepSeek dependency cohort;
- a missing public disposer, an unawaited asynchronous disposer, or a listener that cannot be proven closed;
- an unproven profile-root redirect or any observed access to `~/.dsh`.

The result is FAIL or INCONCLUSIVE. The next stage does not begin automatically.

## 9. Current implementation decision

The current implementation plan covers **A′-P1a Declaration surface only**: Connection, Client runtime, the layout/sidebar Client slot augmentations, and slots core. It does not check storage, modify the workbench production manifest or peers, build or run a Harness plugin, accept a CLI artifact, create a profile, install a tgz, open a browser, or bind port `3186`.

After A′-P1a is implemented, tested, committed, and independently reviewed against the exact diff from `bd0ae743e0c490b5aa770eccae3dd77d325e9a48`, the owner receives only the narrow declaration report in §3. A′-P2 requires a new reviewed implementation plan and runtime-input acceptance record.
