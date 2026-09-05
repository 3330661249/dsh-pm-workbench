# DSH PM Workbench rc.6 Declaration Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove or reject, without starting Harness, that selected exact DeepSeek Harness `0.1.0-rc.6` public declaration entrypoints support the Connection RPC and additive layout/sidebar slot assignments needed by a later isolated mount probe.

**Architecture:** Create the Host and Client declaration contracts before their packages are installed, record the expected missing-module RED result and exact contract hashes, then accept one frozen declaration dependency input and rerun the same bytes for GREEN. The Host contract uses the official Cordis Host Context augmentation; the Client RPC contract uses direct values of the public `ConnectionHandle`/`ClientConnectionRpc` types because rc.6 provides no official Client Context Connection augmentation; the Client slot contract uses `ClientContext` plus official layout/sidebar `/client` augmentations. Derive and review the complete lock-resolved DeepSeek closure while keeping every workbench production manifest, peer, injection list, source file, bundle, and tgz unchanged. Storage is deferred to A′-P1b.

**Tech Stack:** TypeScript 6.0.3, Node.js 24.14.0, Vitest 3.2.7, Cordis 4.0.1, DeepSeek Harness public declaration packages `0.1.0-rc.6`.

**Spec:** `docs/superpowers/specs/2026-09-05-dsh-pm-workbench-minimal-harness-integration-design.md`

## Global Constraints

- Start from baseline `bd0ae743e0c490b5aa770eccae3dd77d325e9a48` in the isolated worktree `/private/tmp/dsh-pm-workbench-gate-a-prime`.
- This plan implements A′-P1a Declaration surface only. Do not start Harness, accept or execute a Harness CLI, create a profile, install a workbench tgz, open a browser, bind port `3186`, check storage, or claim Gate A′ PASS.
- Use only package-root and documented `/client` public exports from selected exact `0.1.0-rc.6` packages.
- The Host contract obtains Connection from the official Cordis Host `Context` augmentation. Client RPC uses the exported public `ConnectionHandle`/`ClientConnectionRpc` types directly; only Client slots use the real public `ClientContext`.
- The Client contract must not import the Connection Host root entrypoint, access `ctx.connection`, or claim that rc.6 officially augments Cordis Client Context with Connection.
- Never create a local Harness module augmentation or structural stand-in. Contract files may not contain explicit or implicit `any`, a double cast through `unknown`, `@ts-ignore`, `@ts-nocheck`, or copied declarations.
- Both surface tsconfigs must set `strict: true`, `noImplicitAny: true`, `skipLibCheck: false`, and `noEmit: true`, and must not define `paths` or `typeRoots`.
- The reviewed TypeScript/test toolchain must resolve from this repository's root `node_modules`; every Harness declaration used by GREEN must resolve within one accepted disposable declaration dependency root below this worktree's controlled temporary area. Parent, global, active-checkout, source-checkout, and copied-declaration fallback fail the plan.
- Do not modify `packages/workbench/package.json`, its production peers, `dsh.client.inject`, Host or Client source, build scripts, built files, `cordis.patch.yml`, or the existing dry-run package.
- Do not add `@deepseek-ai/dsh-storage-domain` or a storage backend in this plan. Storage declarations belong to A′-P1b after A′-P2.
- Do not read `~/.dsh`, port `3080`, user sessions, credentials, browser profiles, real interview data, model configuration, or provider environment variables.
- A missing-package RED is setup evidence only. It is not RPC, slot, lifecycle, loader, browser, or compatibility evidence.

## Permitted report

A′-P1a may report only:

> In the accepted dependency closure and TypeScript configuration, the selected DeepSeek Harness `0.1.0-rc.6` public declarations support Host Connection through the official Cordis Context augmentation, Client RPC through the exported `ConnectionHandle`/`ClientConnectionRpc` types, and additive slots through `ClientContext` plus the official layout/sidebar `/client` augmentations. The rc.6 Client Connection package does not declare `connection` on Cordis Client Context. Harness was not started; no Client bridge, JavaScript runtime export, Cordis composition, live slot declaration, plugin load, browser behavior, storage, persistence, or compatibility was tested.

---

### Task 1: Create the immutable declaration contracts and record RED

**Files:**

- Create: `tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts`
- Create: `tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts`
- Create: `tsconfig.surface.host.json`
- Create: `tsconfig.surface.client.json`
- Create: `tests/contract/rc6-declaration-contract-guard.test.ts`
- Create: `docs/reviews/2026-09-05-rc6-declaration-surface-ledger.md`

**Interfaces:**

- Consumes: baseline Cordis, TypeScript, and the selected public package names; the exact Harness packages are intentionally absent for RED.
- Produces: two immutable compile-only contracts, two strict compiler configurations, one anti-bypass guard, and one named evidence ledger used unchanged by Tasks 2-4.

- [ ] **Step 1: Write the Host declaration contract**

Create `tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts` with only public imports and a real Cordis Context. The dedicated tools path deliberately stays outside `tsconfig.tests.json`; only the strict surface compiler may compile this contract, so the repository's ordinary test typecheck cannot resolve it through the wrong dependency root:

```ts
import '@deepseek-ai/dsh-client-connection'
import type { Context } from '@deepseek-ai/cordis'
import type {
  ConnectionRpcHandler,
  HostConnectionHandle,
} from '@deepseek-ai/dsh-client-connection'

declare const ctx: Context
declare const handler: ConnectionRpcHandler

const connection: HostConnectionHandle = ctx.connection

const disposeChannel: () => Promise<void> = connection.rpc.handle(
  '/dsh-pm-workbench-v1',
  handler,
  { authority: 'loopback' },
)

const disposeEffect: () => Promise<void> =
  ctx.effect(() => disposeChannel)

void disposeEffect
```

This compile-only assignment tests that public Cordis lifecycle typing accepts
the asynchronous disposer **function**. It must not call `disposeChannel()`
during effect setup: that would return `Promise<void>` instead of installing a
disposer, and it would be an unawaited-cleanup bug. The Connection declaration
also states that channel registration belongs to the caller fiber, so this
generic compatibility assignment is not an instruction to double-register the
same disposer in production. A′-P2 must verify the actual single-registration
ownership and unload behavior. If the assignment does not compile against the
exact public Cordis types, record `FAIL_ASYNC_DISPOSER_LIFECYCLE` and stop; do
not cast or suppress it.

- [ ] **Step 2: Write the Client declaration contract**

Create `tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts` with direct public Client Connection types and explicit layout/sidebar Client entrypoints. The dedicated tools path is outside `tsconfig.tests.json` for the same dependency-root isolation reason. Connection RPC and slots are deliberately proven through different values:

```ts
import '@deepseek-ai/dsh-client-ui-layout/client'
import '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {
  ClientConnectionRpc,
  ConnectionHandle,
} from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ReactElement } from 'react'

declare const ctx: ClientContext
declare const connection: ConnectionHandle
declare const component: () => ReactElement | null

const rpc: ClientConnectionRpc = connection.rpc
const response: ReturnType<ClientConnectionRpc['call']> =
  rpc.call(
    '/dsh-pm-workbench-v1',
    'health',
    {},
    new AbortController().signal,
  )

const disposeLauncher: () => void =
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'pm-workbench-probe-launcher',
      },
      component,
    ),
  )

const disposeOverlay: () => void =
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'pm-workbench-probe-overlay',
      },
      component,
    ),
  )

void response
void connection
void disposeLauncher
void disposeOverlay
```

Do not add a `declare module` block. The exact rc.6 Connection `/client` entrypoint exports `ConnectionHandle` and `ClientConnectionRpc` but does not augment Cordis Client Context. Importing the Connection Host root entrypoint here would make a Host-only `Context.connection` declaration visible and create a false Client proof, so it is forbidden. The package-root layout/sidebar Host entries are also insufficient by themselves; their public `/client` entries above must provide the slot augmentations.

- [ ] **Step 3: Write the separate strict compiler configurations**

Both configs include only their corresponding surface file. Use `module` and `moduleResolution` values already compatible with this repository's ESM checks, include the standard library required by that contract, and set these exact guard fields:

```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": false,
    "noEmit": true
  }
}
```

Neither config may define `paths` or `typeRoots`. Neither config may include a Harness checkout, generated copy, fixture declaration, production workbench source, or the other surface contract.

- [ ] **Step 4: Write the anti-bypass guard**

`tests/contract/rc6-declaration-contract-guard.test.ts` reads the two surface files and both surface tsconfigs. It fails on:

- a local `declare module` whose target begins `@deepseek-ai/`;
- the TypeScript token `any` in either surface contract;
- `as unknown as`;
- `@ts-ignore` or `@ts-nocheck`;
- a missing or false `strict`, `noImplicitAny`, or `noEmit`;
- any `skipLibCheck` value other than `false`;
- any `paths` or `typeRoots` key;
- an include/file path outside the named contract file;
- imports containing `/src/`, a relative copied declaration, or an absolute Harness checkout path.

The guard also asserts that:

- the Client file imports `ConnectionHandle` and `ClientConnectionRpc` from the exact Connection `/client` entrypoint;
- the Client file does not import the Connection Host root entrypoint and does not contain `ctx.connection`;
- Client RPC is called through the direct public handle;
- `ctx.slots` uses both exact slot keys after the layout/sidebar `/client` imports;
- the Host file alone imports the Connection root entrypoint, accesses `ctx.connection.rpc.handle`, and contains the Cordis effect line.

- [ ] **Step 5: Run the unchanged contracts to verify RED**

Run:

```bash
npm test -- tests/contract/rc6-declaration-contract-guard.test.ts
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
```

Expected:

- the anti-bypass guard passes;
- both compilers fail with missing-module diagnostics for the selected Harness packages;
- no diagnostic may come from a malformed contract, a private path, an implicit `any`, a copied declaration, or a parent dependency.

If a selected package unexpectedly resolves before installation, use `node:module` resolution plus `realpath` to identify it. Any parent/global/source-checkout resolution is a plan failure, not an acceptable RED substitute.

- [ ] **Step 6: Freeze and record the RED contract bytes**

Run SHA-256 over the two surface files and two surface tsconfigs. In `docs/reviews/2026-09-05-rc6-declaration-surface-ledger.md`, record:

- baseline commit;
- all four relative paths and SHA-256 values;
- exact commands;
- exit codes;
- the missing package names;
- `RED_SETUP_ONLY`;
- `OFFICIAL_CLIENT_CONTEXT_CONNECTION_AUGMENTATION_ABSENT`, based on the reviewed rc.6 public `/client` and Host declaration entries;
- the statement that no Harness process, profile, browser, port, tgz, production manifest, or storage package was used.

Do not commit the failing state. Task 2 must either make these exact contract bytes pass from an accepted input or record an explicit stop result.

---

### Task 2: Accept or reject one frozen declaration dependency input

**Files:**

- Create: `scripts/accept-rc6-declaration-input.mjs`
- Create: `scripts/verify-rc6-declaration-closure.mjs`
- Create on accepted input only: `tools/harness-rc6-declarations/package.json`
- Create on accepted input only: `tools/harness-rc6-declarations/package-lock.json`
- Create on accepted input only: `tools/harness-rc6-declarations/input-manifest.json`
- Create: `tests/integration/rc6-declaration-input.test.ts`
- Create: `tests/integration/rc6-declaration-dependency-boundary.test.ts`
- Create on accepted input only: `research/2026-09-05-rc6-declaration-closure.json`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `docs/reviews/2026-09-05-rc6-declaration-surface-ledger.md`

**Explicitly unchanged:**

- root `package.json` and root `package-lock.json`;
- `packages/workbench/package.json`;
- `packages/workbench/cordis.patch.yml`;
- `packages/workbench/src/**`;
- `packages/workbench/lib/**`;
- `packages/workbench/docs/third-party.md`.

**Interfaces:**

- Consumes: Task 1 contract hashes plus one candidate manifest/lock/cache set placed at `.tmp/dsh-pm-workbench/declaration-input-candidate/` by the owner-approved input step.
- Produces: either an accepted frozen declaration cohort and GREEN-capable disposable dependency root, or the explicit stop result `FAIL_FRESH_RESOLUTION`, `MIXED_COHORT`, `INCONCLUSIVE_INPUT_NOT_ACCEPTED`, or `INCONCLUSIVE_CACHE_MISS`.

- [ ] **Step 1: Record the fresh-resolution result separately**

Record this already observed diagnostic in the ledger without rerunning a network install:

> Fresh registry resolution of exact rc.6 direct roots followed their `^0.1.0-rc.6` transitive ranges to rc.8 candidates and ended in `ERESOLVE`. Exact direct roots did not freeze the dependency closure.

Label it `FAIL_FRESH_RESOLUTION_RC8_ERESOLVE`. Do not alter the root manifest, add npm overrides, retry against another registry, or treat the failed fresh resolution as evidence about the frozen historical cohort.

- [ ] **Step 2: Accept the historical frozen-cohort candidate or stop**

The candidate label is `local-2026-08-14-rc6-lock-v3`. The current observation is that its lockfileVersion 3 input replayed in a temporary root with:

```bash
npm ci --ignore-scripts --offline
```

That observation installed 531 packages, including 186 `@deepseek-ai/dsh-*` packages, all at `0.1.0-rc.6`. These counts are candidate evidence only.

`scripts/accept-rc6-declaration-input.mjs` reads the fixed candidate directory and requires:

- a matching regular `package.json` and lockfileVersion 3 `package-lock.json`;
- an exact root dependency on `@deepseek-ai/dsh@0.1.0-rc.6` or an equivalent exact rc.6 root set declared by that matching manifest;
- integrity for every registry package in the lock;
- a declared read-only npm cache containing every integrity-bound artifact required for offline replay;
- no lifecycle execution, link escape, absolute path in the accepted manifest, mutable source checkout, parent dependency, or global executable;
- exact hashes for the source manifest, lock, cache index, Node binary identity, and npm identity;
- a path-free provenance label rather than the source machine path.

If the candidate directory or any required artifact is absent, record `INCONCLUSIVE_INPUT_NOT_ACCEPTED` or `INCONCLUSIVE_CACHE_MISS` and stop before GREEN. A successful historical replay by itself is not acceptance.

- [ ] **Step 3: Publish only the accepted manifest and lock inputs**

After acceptance, copy the byte-identical matching manifest and lock to:

- `tools/harness-rc6-declarations/package.json`;
- `tools/harness-rc6-declarations/package-lock.json`.

Write `tools/harness-rc6-declarations/input-manifest.json` with the path-free label, source hashes, accepted Node/npm identities, cache-index hash, lockfile version, expected package counts, acceptance command, and acceptance result. Do not commit cache contents, `node_modules`, an absolute source path, token, registry credential, or authorization URL.

The acceptance script copies only integrity-verified cache objects required by the accepted lock into `.tmp/dsh-pm-workbench/declaration-input-cache/`, verifies the copied cache index, and makes that temporary cache read-only before replay. The cache path is fixed by the script but is not written into committed provenance; absence or mutation on a later run yields `INCONCLUSIVE_CACHE_MISS` rather than ambient-cache fallback.

The committed input is development evidence only. It is not the A′-P2 executable runtime acceptance record.

- [ ] **Step 4: Replay into a disposable declaration dependency root**

Create the empty fixed root `.tmp/dsh-pm-workbench/rc6-declarations/accepted/`, copy the accepted manifest and lock into it, and run npm through `accept-rc6-declaration-input.mjs` with lifecycle scripts disabled, offline mode, and the accepted read-only cache. The script rejects a pre-existing nonempty root; it, not an ambient npm setting, supplies the cache and prefix.

Copy the two Task 1 surface files and tsconfigs into the same relative paths below that disposable root. Require their SHA-256 values to equal the RED ledger before compilation. The repository's reviewed TypeScript executable may drive the compile, but all Harness declarations must resolve from this disposable root's `node_modules`.

- [ ] **Step 5: Derive the complete accepted DeepSeek closure**

`scripts/verify-rc6-declaration-closure.mjs` reads the accepted lock and installed manifests. It emits two canonical sections in `research/2026-09-05-rc6-declaration-closure.json`:

1. the entire accepted `@deepseek-ai/*` cohort reachable from the frozen root;
2. the declaration subgraph reachable from the five selected packages used by the Host and Client contracts.

Each record contains:

```json
{
  "name": "@deepseek-ai/example",
  "version": "0.1.0-rc.6",
  "integrity": "sha512-...",
  "manifestPath": "node_modules/@deepseek-ai/example/package.json",
  "parents": ["@deepseek-ai/parent"]
}
```

The file also records the five direct declaration roots, accepted lock SHA-256, input-manifest SHA-256, Node/npm identities, total installed package count, total `@deepseek-ai/dsh-*` count, and generation command. Paths are relative to the disposable dependency root.

The verifier deep-compares the committed JSON with a recomputation, realpaths every manifest below the disposable root, and rejects symlink escape, parent fallback, missing integrity, undeclared installed package, duplicate logical package/version ambiguity, or lock/manifest mismatch. Every reachable `@deepseek-ai/dsh-*` package must be `0.1.0-rc.6`; Cordis and Schemastery must match their separately recorded exact versions. Any unexpected version yields `MIXED_COHORT` and stops the plan.

- [ ] **Step 6: Add executable acceptance and boundary tests**

`tests/integration/rc6-declaration-input.test.ts` validates the committed accepted-input files and recomputes the input-manifest hashes without requiring the uncommitted source path. `tests/integration/rc6-declaration-dependency-boundary.test.ts` invokes the verifier in check mode and asserts:

- the accepted lock and input-manifest hashes match;
- the selected five manifests are exact `0.1.0-rc.6`;
- both full cohort and declaration subgraph equal their recomputation;
- every `@deepseek-ai/dsh-*` cohort member is exact rc.6;
- every Harness declaration realpath is below the disposable dependency root;
- the workbench package manifest bytes equal baseline;
- root manifests remain unchanged;
- storage-domain is not one of the selected declaration roots.

Do not treat `npm ls --depth=0` or the five exact root versions as a substitute for the recursive lock and realpath checks.

- [ ] **Step 7: Update development-input provenance**

Add the five selected public declaration packages to `THIRD_PARTY_NOTICES.md` with exact version, MIT license, public npm registry source, and the label `development/type verification input`. Link the accepted input manifest and closure JSON and state that the accepted historical lock is neither a fresh registry resolution nor runtime compatibility evidence.

Do not modify the workbench package's bundled third-party document because none of these development inputs enters its existing tgz.

- [ ] **Step 8: Verify GREEN using the same contract bytes**

Run the anti-bypass and input tests from the repository, then compile the byte-identical copied contracts from the disposable dependency root using the reviewed repository TypeScript executable. The acceptance script prints the exact generated paths; do not reconstruct them through ambient module paths.

Expected: PASS with unchanged contract/config hashes, an accepted lock/input manifest, no unexpected cohort, and no Harness declaration outside the disposable root. The Client RPC contract must pass through direct public Connection types, while the Client slot contract passes through `ClientContext`; `ctx.connection` must remain absent from the Client contract.

If either compiler reports a signature mismatch, record FAIL. Do not weaken the assignment, import the Host Connection root into the Client contract, add a local bridge, cast, copy a declaration, or add a module augmentation.

- [ ] **Step 9: Record the result**

Append to the ledger:

- unchanged contract/config hashes;
- fresh-resolution failure as separate evidence;
- accepted input label and hashes, or exact INCONCLUSIVE reason;
- exact selected versions and full-cohort/declaration-subgraph counts;
- closure JSON hash;
- exact commands and exit codes;
- `OFFICIAL_CLIENT_CONTEXT_CONNECTION_AUGMENTATION_ABSENT`;
- PASS, FAIL, `MIXED_COHORT`, `INCONCLUSIVE_INPUT_NOT_ACCEPTED`, or `INCONCLUSIVE_CACHE_MISS`;
- the permitted report and every unproven item;
- the statement that no Harness process, CLI, profile, browser, listener, workbench tgz, production manifest, production bridge, or storage package was used.

---

### Task 3: Prove accepted-input offline replay and arbitrary-path declaration locality

**Files:**

- Modify: `tests/integration/standalone-copy.test.ts`
- Modify: `docs/reviews/2026-09-05-rc6-declaration-surface-ledger.md`

**Interfaces:**

- Consumes: the unchanged declaration contracts, accepted input manifest/lock/cache identity, closure verifier, and closure JSON.
- Produces: an accepted-input offline replay and arbitrary-path declaration-locality result. The repository by itself remains insufficient without the separately accepted cache bundle.

- [ ] **Step 1: Extend the arbitrary-path copy allowlist**

The minimal replay root includes:

- both surface files and surface tsconfigs;
- the anti-bypass and dependency-boundary tests;
- the closure verifier and closure JSON;
- `tools/harness-rc6-declarations/package.json` copied to the replay root as `package.json`;
- `tools/harness-rc6-declarations/package-lock.json` copied to the replay root as `package-lock.json`;
- `tools/harness-rc6-declarations/input-manifest.json`;
- the exact repository TypeScript executable identity used to drive the compile.

Do not copy the source worktree's `node_modules`, any Harness checkout, root application manifest, absolute-path declaration, user profile, or global executable.

- [ ] **Step 2: Install and compile in the copy**

Create the minimal replay root under a new arbitrary temporary parent that has no `node_modules`. Clear `NODE_PATH` and package-manager prefix overrides. The acceptance helper reads the fixed accepted cache location `.tmp/dsh-pm-workbench/declaration-input-cache/`, verifies it against `input-manifest.json`, and performs the whole replay through this exact command:

```bash
node scripts/accept-rc6-declaration-input.mjs --replay-arbitrary-path
```

The helper internally invokes npm with `ci`, `--ignore-scripts`, `--offline`, an explicit cache, and an explicit replay-root prefix; it then invokes the reviewed repository TypeScript executable on both copied configs and runs the closure verifier in check mode. The test asserts that the accepted cache is read-only and outside module resolution. Every Harness declaration and package manifest realpath must be below the replay root's `node_modules`; the TypeScript executable must equal the reviewed repository toolchain identity.

- [ ] **Step 3: Preserve the evidence boundary**

The test and ledger use this exact label after PASS:

> Accepted frozen-input offline replay and arbitrary-path declaration locality PASS. The repository alone is not self-contained without the separately accepted cache bundle, and this run did not test a Harness executable, workbench tgz, plugin load, or runtime compatibility.

If the accepted cache lacks any integrity-bound artifact, record `INCONCLUSIVE_CACHE_MISS`. Do not access the network, fall back to an ambient machine cache, or call the repository alone self-contained.

- [ ] **Step 4: Run the focused locality check**

Run:

```bash
npm test -- tests/integration/standalone-copy.test.ts tests/integration/rc6-declaration-dependency-boundary.test.ts
```

Expected: PASS or the explicit `INCONCLUSIVE_CACHE_MISS` stop result. A parent/global fallback, ambient-cache use, changed contract hash, closure mismatch, or unexpected cohort is FAIL.

---

### Task 4: Complete verification, exact-diff review, and one commit

**Files:**

- Modify only a Task 1-3 file if verification identifies a documented defect.
- Do not modify any production workbench file.

**Interfaces:**

- Consumes: Tasks 1-3 and the complete ledger.
- Produces: one independently reviewed A′-P1a commit or a recorded stop result. It never starts A′-P2.

- [ ] **Step 1: Verify the allowed path set before staging**

Compare the exact working tree against `bd0ae743e0c490b5aa770eccae3dd77d325e9a48`. The changed path set may contain only the spec and plan plus the files explicitly named by Tasks 1-3. Fail if it contains:

- `packages/workbench/package.json`;
- `packages/workbench/cordis.patch.yml`;
- anything below `packages/workbench/src/` or `packages/workbench/lib/`;
- a storage package or adapter;
- a profile, tgz, browser artifact, listener log, or Harness runtime artifact.

Record the exact `git diff --name-status` output and its hash in the ledger.

- [ ] **Step 2: Run complete verification**

Run:

```bash
node scripts/accept-rc6-declaration-input.mjs --verify-and-compile
npm run typecheck
npm test
npm run build
npm run demo:build
npm run verify:package
npm run pack:dry
npm ls --all
git diff --check
```

The package verification must prove that the existing workbench tgz manifest and nine-file no-op skeleton are unchanged from baseline. None of the development declaration inputs or test contracts may enter it.

- [ ] **Step 3: Independently review the exact baseline diff**

The reviewer examines the complete diff from `bd0ae743e0c490b5aa770eccae3dd77d325e9a48`, not a summary and not an implementer report. The review explicitly checks:

- official package-root and `/client` imports;
- official Host Context augmentation, direct public Client Connection handles, and ClientContext slot use kept separate;
- explicit `OFFICIAL_CLIENT_CONTEXT_CONNECTION_AUGMENTATION_ABSENT` evidence and no Host root import in the Client contract;
- anti-bypass coverage;
- asynchronous Host disposer lifecycle typing;
- synchronous UI disposer typing;
- same-contract RED→GREEN hashes;
- exact direct versions and complete lock-derived closure;
- local dependency containment;
- no production manifest, peer, injection, code, bundle, or tgz change;
- accepted-input replay wording and repository-not-self-contained boundary;
- permitted claim language and ledger completeness.

Any requested change returns to the relevant focused check and then repeats the full verification and exact-diff review.

- [ ] **Step 4: Stage only the reviewed allowlist and verify the index**

Stage only the files named by Tasks 1-3 plus these two reviewed documents. Then run:

```bash
git diff --cached --check
git diff --cached --name-status
git diff --cached --stat
```

Compare the staged path list with the independently reviewed path list. An empty index, extra path, missing path, or byte change after review stops the commit.

- [ ] **Step 5: Commit the exact reviewed tree**

Commit with:

```bash
git commit -m "test: verify rc6 declaration surface"
```

Record the commit ID and committed tree ID in the ledger before the final commit if the ledger entry can be completed deterministically without the commit ID; otherwise record the commit ID in the external review result rather than amending an already reviewed commit. Do not amend after review without repeating the exact-diff review.

- [ ] **Step 6: Verify the committed result and stop**

Run the accepted-input compile helper, closure verifier, focused tests, and `git status --short` against the committed tree. Report only the permitted A′-P1a statement above, the commit ID, the closure artifact, the official Client Context augmentation gap, and the accepted-input replay status.

Do not start A′-P1b or A′-P2 automatically.

## A′-P2 handoff blockers

A′-P2 requires a new design reconciliation and implementation plan. Before that plan may authorize a process start, it must name exact files, commands, expected outputs, and cleanup evidence for:

1. an accepted `@deepseek-ai/dsh@0.1.0-rc.6` CLI artifact, lock, runtime dependency closure, absolute entrypoint, integrity values, and file hashes;
2. the exact Node and package-manager identities;
3. a filtered environment allowlist with provider, token, session, workspace, proxy, and unrelated configuration excluded;
4. the static public `DSH_HOME` evidence from `dsh-home-paths`, CLI help, and profile-boot plus a no-plugin Web profile-root canary proving every actual read/write location; the static support does not replace the canary;
5. an exact audited workbench tgz installed without lifecycle scripts into a disposable package root;
6. a disposable composition patch that references the package by absolute path and configures the existing Connection plugin with `trustedHosts: []`;
7. workbench channel policy `{ authority: 'loopback' }`, owned separately from Connection's deployment configuration;
8. a new browser context and user-data directory below the disposable root;
9. process-owned acquisition of `127.0.0.1:3186`, with pre-check treated only as diagnostic and bind failure leaving the existing owner untouched;
10. awaited asynchronous RPC disposal, synchronous UI disposal, Cordis unload, exact process exit, and proof that no listener remains;
11. a separately designed Client Connection acquisition boundary: rc.6 has no official Cordis Client Context augmentation, so any workbench-owned bridge must be identified as such and validated by the real health round trip;
12. confirmation that `@deepseek-ai/dsh-client-ui-slots` is not listed as a Client plugin injection because rc.6 gives it no `dsh.client` loader metadata;
13. a canonical reconciliation matrix for every legacy A01-A22 item before Full Gate A′ can be claimed.

Until that separate plan and runtime-input acceptance record pass review, A′-P2 remains blocked by design.
