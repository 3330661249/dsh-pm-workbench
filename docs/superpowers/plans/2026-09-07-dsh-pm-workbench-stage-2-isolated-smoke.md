# DSH PM Workbench Stage 2 Isolated Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest real Harness Probe package and verify install, visibility, overlay interaction, public Connection RPC, synthetic persistence, removal, reinstall, and cleanup in a disposable DeepSeek Harness `0.1.0-rc.6` profile.

**Architecture:** The shipped package keeps separate Host and Client entry graphs. The Host owns a strict two-endpoint Probe service and a synthetic counter; the Client contributes one additive sidebar action and one additive overlay through public slots and talks to the Host only through public Connection RPC. A repository-owned runner creates a marker-owned system-temporary run root, isolates `HOME`, `DSH_HOME`, XDG, npm, pnpm, temp, working-directory, and browser state, binds `127.0.0.1` on a dynamically allocated port that must not be `3080`, installs one frozen real tgz, records a sanitized result, and removes only files and processes it owns.

**Tech Stack:** TypeScript 6.0.3, React 18.3.1, esbuild 0.25.12, Vitest 3.2.7, Zod 4.4.3, DeepSeek Harness and public integration packages `0.1.0-rc.6`.

**Spec:** `docs/superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md`

## Global Constraints

- This is a **Stage 2 isolated smoke**, not the full A01-A22 Gate A-prime result and not a Harness Alpha.
- Use only a new marker-owned system-temporary run root, `127.0.0.1`, a dynamically allocated port that is verified not to be `3080`, and synthetic integer state. Fixed port `3186` is allowed only as an explicit compatibility fallback after ownership and availability checks.
- Launch child processes from an empty allowlisted environment with isolated `HOME`, `DSH_HOME`, XDG directories, npm cache/config, pnpm store, temp directory, working directory, and a fresh browser profile for every runtime phase.
- Do not read, write, stop, or reuse the active `3080` process, `~/.dsh`, real Workspaces, Sessions, browser data, models, providers, recordings, interviews, documents, or the installed ripple profile.
- Use only public rc.6 package exports. No `/api` interception, bare HTTP fallback, private imports, private DOM, root replacement, copied descriptors, or Harness source edits.
- Install from a real tgz. A source link, config dump, package listing, or screenshot alone cannot establish a runtime PASS.
- Distinguish public patch disable from public package removal. Observe both installed-but-disabled and removed states, with a fresh Harness process and fresh browser profile after every plugin-set change.
- Keep raw logs and the temporary profile outside Git. Any committed result must be sanitized and contain no credentials, payload text, or local absolute paths.
- No push, pull request, merge, publication, model call, or real-data enablement is in scope.

---

### Task 1: Freeze and compile the public rc.6 surface

**Files:**

- Create: `tests/contract/harness-rc6-public-surface.test.ts`
- Create: `tests/types/harness-host-rc6-surface.ts`
- Create: `tests/types/harness-client-rc6-surface.ts`
- Restore to the frozen legacy bytes: `tsconfig.surface.host.json`
- Restore to the frozen legacy bytes: `tsconfig.surface.client.json`
- Create: `tsconfig.stage2.surface.host.json`
- Create: `tsconfig.stage2.surface.client.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/workbench/package.json`
- Modify: `tests/contract/package-manifest.test.ts`
- Create: `research/2026-09-07-stage-2-rc6-public-surface.md`
- Modify: `tests/integration/rc6-declaration-input.test.ts`
- Modify: `tests/integration/helpers/rc6-169-production-path.ts`
- Create: `tests/fixtures/rc6-legacy-production-boundary.json`
- Modify: `tests/fixtures/standalone-source-manifest.json`
- Append only: `docs/reviews/2026-09-05-rc6-declaration-surface-ledger.md`

**Interfaces:**

- Consumes: `HostConnectionHandle.rpc.handle`, `ConnectionHandle.rpc.call`, `DomainFacility.open`, `SlotRegistry.inject/register`.
- Produces: exact dependency pins and compile-only Host/Client contracts without calling or constructing fake runtime objects.

- [ ] **Step 1: Write failing contract tests**

The runtime test must resolve the exact package manifests and assert version `0.1.0-rc.6`. Keep the historical `tsconfig.surface.*` files byte-identical because they belong to the frozen legacy declaration evidence. The new Stage 2 Host compile fixture uses `tsconfig.stage2.surface.host.json` and must typecheck:

```ts
const dispose = ctx.connection.rpc.handle(
  '/dsh-pm-workbench-v1',
  handler,
  { authority: 'loopback' },
)
const domain = await ctx.storageDomain.open(probeDomainSpec)
void dispose
void domain
```

The Client fixture must typecheck:

```tsx
const result = await ctx.connection.rpc.call(
  '/dsh-pm-workbench-v1',
  'health',
  {},
  signal,
)
ctx.slots.inject('sidebar.footer.action', () =>
  ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'pm-workbench-probe-launcher', order: 90 },
    Launcher,
  ),
)
```

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/contract/harness-rc6-public-surface.test.ts tests/contract/package-manifest.test.ts
./node_modules/.bin/tsc -p tsconfig.stage2.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.stage2.surface.client.json --noEmit
```

Expected: fail because Connection, storage, sidebar, slots, and Zod are not yet pinned in this worktree.

- [ ] **Step 3: Add exact public dependencies and package injection metadata**

Pin the complete 56-package rc.6 closure exactly in the root development graph and verify every installed occurrence stays on `0.1.0-rc.6`. Pin the four observed compatible Cordis support packages and one exact Zod version. The contract must prove that root DSH development dependency keys equal the declared direct set, every override-designated DSH package is absent from root development dependencies, the sets do not overlap, and their union is the complete closure. The workbench Client injection graph contains only packages that expose an rc.6 Web client bundle: Connection, runtime, layout, and sidebar, in dependency-topological order. `@deepseek-ai/dsh-client-ui-slots` remains a type/peer dependency and must not appear in `dsh.client.inject` because rc.6 exposes no `dsh.client` declaration or `./client` bundle for it. Every Harness peer is exact and optional. The Host exports Cordis service injection keys `inject = ['connection', 'storageDomain']` only after Task 2.

The root dependency and workbench package changes intentionally leave the new Stage 2 workspace outside the old immutable rc.6 acceptance production boundary. Do not rewrite the old expected hashes. Preserve the legacy tests through one committed, path-free, exact-byte boundary fixture whose path set and every SHA-256 are checked before reconstruction; explicitly test that the current Stage 2 workspace is rejected by the legacy boundary. Append the resulting supersession status to the historical ledger without rewriting prior evidence.

- [ ] **Step 4: Run GREEN and record the observed public signatures**

```bash
npm test -- tests/contract/harness-rc6-public-surface.test.ts tests/contract/package-manifest.test.ts
./node_modules/.bin/tsc -p tsconfig.stage2.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.stage2.surface.client.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit --types node
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
npm run typecheck
npm test -- tests/integration/rc6-declaration-input.test.ts
```

- [ ] **Step 5: Commit the exact Task 1 file inventory**

```bash
git diff --check
git add -- package.json package-lock.json packages/workbench/package.json tests/contract/package-manifest.test.ts tests/contract/harness-rc6-public-surface.test.ts tests/types/harness-host-rc6-surface.ts tests/types/harness-client-rc6-surface.ts tsconfig.surface.host.json tsconfig.surface.client.json tsconfig.stage2.surface.host.json tsconfig.stage2.surface.client.json research/2026-09-07-stage-2-rc6-public-surface.md tests/integration/rc6-declaration-input.test.ts tests/integration/helpers/rc6-169-production-path.ts tests/fixtures/rc6-legacy-production-boundary.json tests/fixtures/standalone-source-manifest.json docs/reviews/2026-09-05-rc6-declaration-surface-ledger.md
git diff --cached --check
git commit -m "build: pin rc6 smoke integration surface"
```

**Stop condition:** Any required operation is absent from the public rc.6 declarations or requires a private import.

---

### Task 2: Implement the strict synthetic Probe and additive UI

**Files:**

- Create: `packages/workbench/src/probe/protocol.ts`
- Create: `packages/workbench/src/probe/service.ts`
- Create: `packages/workbench/src/integration/harness-rc6/probe-host.ts`
- Create: `packages/workbench/src/client/probe/store.ts`
- Create: `packages/workbench/src/client/probe/ProbeView.tsx`
- Create: `packages/workbench/src/client/probe/transport.ts`
- Modify: `packages/workbench/src/index.ts`
- Modify: `packages/workbench/src/client/index.tsx`
- Modify: `packages/workbench/build.mjs`
- Modify: `packages/workbench/package.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tests/contract/package-manifest.test.ts`
- Modify: `tests/contract/harness-rc6-public-surface.test.ts`
- Modify: `tests/types/harness-client-rc6-surface.ts`
- Modify: `scripts/verify-package.mjs`
- Modify: `packages/workbench/README.md`
- Modify: `packages/workbench/docs/compatibility.md`
- Modify: `packages/workbench/docs/privacy.md`
- Modify: `packages/workbench/docs/third-party.md`
- Modify: `README.md`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `tests/fixtures/standalone-source-manifest.json`
- Modify: `research/2026-09-07-stage-2-rc6-public-surface.md`
- Append only: `docs/probe-results.md`
- Create: `tests/probe/protocol.test.ts`
- Create: `tests/probe/service.test.ts`
- Create: `tests/probe/transport.test.ts`
- Create: `tests/probe/store.test.ts`
- Create: `tests/probe/lifecycle.test.tsx`
- Create: `tests/probe/host-lifecycle.test.ts`
- Create: `tests/probe/build.test.ts`

**Interfaces:**

- Produces: `createProbeHandler(repository)`, `ProbeRepository`, `ConnectionRpcProbeTransport`, and the two exact endpoints `health` and `counter.increment`.
- `health({})` returns `mode`, exact capability constants, `counter`, and `aggregateVersion`.
- `counter.increment({ apiVersion, expectedVersion, commandId, delta: 1 })` implements CAS and same-command idempotency over synthetic state.
- The wire capability versions are strings (`apiVersion: 'pmwb-v1'`, `wireSchemaVersion: '1'`, `dataSchemaVersion: '1'`); only persisted `ProbeState.schemaVersion` is numeric `1`.

- [ ] **Step 1: Write RED protocol and service tests**

Cover strict empty health input, canonical UUID v4 command IDs, extra/missing fields, invalid version/delta, successful increment, idempotent replay, reused ID with different payload, stale expected version, and unknown endpoint.

- [ ] **Step 2: Implement the smallest strict registry and service**

All parsing uses strict Zod schemas. The handler catches every internal error and returns a bounded safe envelope without `Error.message`, stack, payload, paths, or an incident id. The public rc.6 outer `internal` error details are exactly empty; record this bounded deviation from the older architecture spec instead of widening or privately importing the carrier.

- [ ] **Step 3: Write RED Client transport tests**

Cover success, Host business rejection, malformed success output, carrier rejection, transport exception, and cancellation. A malformed or failed result must not update the Client's authoritative snapshot.

- [ ] **Step 4: Implement the Connection RPC adapter**

The adapter calls only channel `/dsh-pm-workbench-v1`; it validates request before send and response after receive, returning a closed discriminated result.

- [ ] **Step 5: Write RED lifecycle/UI tests**

Use fake public-shaped contexts to prove exactly one launcher and one overlay registration, open/close state, focus restoration, abort/generation behavior, and disposal without duplicate registrations after remount. Keep this Task 2 suite dependency-free: test a DOM-independent store/controller, server-render the React markup for semantic markers, and test slot lifecycles with public-shaped fakes. Real rendered clicks and focus belong to Task 3's isolated Chrome observation. Treat the plugin-owned DOM contract as stable public smoke markers:

```text
data-dsh-pm-workbench="launcher"
data-dsh-pm-workbench="overlay"
data-dsh-pm-workbench="increment"
data-dsh-pm-workbench="close"
data-dsh-pm-workbench="counter"
```

The overlay is a `role="dialog"` with `aria-modal="true"`; the counter exposes numeric `data-counter` and `data-version` values. Tests and the runner must not query Harness-private DOM structure or class names.

Keep Host lifecycle and build-graph proof in their own focused files. Host lifecycle tests cover transactional Domain/route setup, the 16-request cap, and ordered idempotent drain. Build tests inspect esbuild metafiles rather than searching source strings, while preserving the existing Demo and write-boundary tests.

- [ ] **Step 6: Implement Host and Client entrypoints**

Host opens the synthetic domain, registers one loopback channel, rejects excess in-flight requests, and performs ordered drain: stop admissions, unregister route, abort lifecycle, await in-flight work and repository writes, then close storage. Its Cordis `inject` keys are the provided service names `['connection', 'storageDomain']`, not the provider package/plugin names. Client contributes one `sidebar.footer.action` and one `shell.overlay`, renders no replacement root, uses the public rc.6 Connection-context intersection, imports the public Client declaration entrypoints it consumes instead of relying on test-global augmentations, and restores focus after close. Add `tsc -p packages/workbench/tsconfig.json --noEmit` to the root typecheck chain so production Host and Client sources compile in their own program. Bundle Zod into both Host and Client artifacts; keep the root development pin but remove Zod from the published package runtime dependencies so a fresh profile can install the tgz offline. Use esbuild metafiles to prove both entry graphs include Zod, exclude Cordis/DeepSeek runtime source, and contain only the declared external packages; never use `packages: 'external'`. Keep Host externals at `@deepseek-ai/*` plus Cordis and Node built-ins, and Client externals at React/React DOM and `@deepseek-ai/*`. Update both manifest contracts that currently require a published Zod dependency. Package verification must prove zero published runtime dependencies, no bare Zod runtime import, no bundled second Harness/Cordis runtime, and inclusion of the Zod notice. Append the resulting Task 2 dependency delta to the Task 1 research checkpoint and append a source-only checkpoint to `docs/probe-results.md`; do not rewrite its immutable historical run blocks or call the checkpoint a runtime PASS. Update the packed third-party notice and root notice with the applicable Zod 4.4.3 MIT attribution/license, and update packed privacy/compatibility plus root/package READMEs from “static no-op” to “implemented but not yet runtime-verified.” Add every new production file, Probe test, and required build/contract/doc file to the standalone relocation manifest so the cloned verification path runs the same implementation and checks. No document may claim installation or smoke success before Task 3 observes it.

- [ ] **Step 7: Run Task 2 verification and commit**

```bash
npm test -- tests/probe
npm run typecheck
npm run build
npm run verify:package
git diff --check
git add -- packages/workbench/src packages/workbench/build.mjs packages/workbench/package.json package.json package-lock.json tests/probe tests/contract/package-manifest.test.ts tests/contract/harness-rc6-public-surface.test.ts tests/types/harness-client-rc6-surface.ts tests/fixtures/standalone-source-manifest.json scripts/verify-package.mjs packages/workbench/README.md packages/workbench/docs/compatibility.md packages/workbench/docs/privacy.md packages/workbench/docs/third-party.md README.md THIRD_PARTY_NOTICES.md research/2026-09-07-stage-2-rc6-public-surface.md docs/probe-results.md
git diff --cached --check
git commit -m "feat: add minimal Harness smoke probe"
```

**Stop condition:** The real public API cannot express the route, slots, disposal ordering, or synthetic persistence without a private fallback.

---

### Task 3: Run the real-tgz isolated Harness smoke

**Files:**

- Create: `scripts/run-stage-2-isolated-smoke.mjs`
- Create: `scripts/verify-stage-2-smoke-result.mjs`
- Create: `tests/integration/stage-2-smoke-runner.test.ts`
- Create: `tests/integration/package-freeze.test.ts`
- Modify: `packages/workbench/build.mjs`
- Modify: `scripts/pack-dry.mjs`
- Modify: `scripts/verify-package.mjs`
- Modify: `package.json`
- Modify: `tests/fixtures/standalone-source-manifest.json`
- Create outside Git during execution: one fresh marker-owned directory under the canonical operating-system temporary root
- Create only from a separately verified sanitized result after the run has ended: `docs/gate-results/stage-2-isolated-smoke.md`

**Interfaces:**

- The canonical runner invocation supplies six explicit absolute inputs: `--node`, `--dsh-cli`, `--npm-cli`, `--pnpm-node`, `--pnpm-cli`, and `--chrome`. The declared `--node` must equal the canonical executable running the runner. No input may be inferred from `PATH`, a shebang, npm configuration, Corepack, `npx`, a package-manager wrapper, or a browser search.
- Before first use and immediately before every later use, validate each input as an absolute canonical non-symlink regular file, verify the required executable bit for Node and Chrome, record device/inode/size/SHA-256 identity, and verify bounded version/package identity. The DSH entry must be the declared `dsh` bin of `@deepseek-ai/dsh@0.1.0-rc.6`; the npm and pnpm entries must match their nearest package manifests and declared bin entries.
- The npm package, profile dependency, profile bundle, Client ModuleLoader, add, and remove identity is exactly `@knight/dsh-pm-workbench`. The Cordis row inserted by `cordis.patch.yml` has exact `id: dsh-pm-workbench`. Package/name identity is verified separately and is not repeated in the disable patch.
- Raw evidence exists only below the marker-owned run root while the run is active. Before deletion, derive a bounded, closed, path-free result candidate in memory. Only after successful deletion and absence verification may the runner append a successful cleanup receipt and emit the canonical result; it never writes the cleanup receipt into the directory it will delete.
- `scripts/verify-stage-2-smoke-result.mjs` independently validates the emitted closed result schema, outcome-specific evidence, allowed claims, size bounds, and sanitization. Only its verified Markdown output is eligible to be copied into `docs/gate-results/`.
- Network evidence is deliberately scoped to the attached Chrome page target. The runner may report that this page target made zero observed external attempts, while separately proving that package-manager operations were configured offline and Harness listeners were loopback-only; it does not claim host-wide packet capture or global process-network observation.

- [ ] **Step 1: Write RED ownership, provenance, command-graph, and UI-boundary tests**

Use injected filesystem, child-process, `lsof`, package, and browser/CDP fakes; these tests do not start real Harness, Chrome, npm, or pnpm processes.

Prove refusal of:

- missing, relative, symlinked, non-regular, wrong-package, wrong-bin, wrong-version, or identity-drifting Node, DSH CLI, npm CLI, pnpm Node, pnpm CLI, and Chrome inputs;
- inherited or multi-entry `PATH`, a global `pnpm`, Corepack, `npx`, a shell-based DSH invocation, or any executable fallback;
- actual port `3080`, a non-loopback Harness bind, an existing or non-owned run root, symlinks at owned roots, a missing or mismatched marker, or a working directory outside the run root;
- source, link, Git, registry, range, or tag install specs in place of the one absolute frozen tgz;
- an unexpected package allowlist, package byte/hash, build graph, package member set, or second tgz;
- a build or package path that bypasses the canonical write guard, rereads repository package files after their bytes are frozen, uses `npm pack --workspace`, or performs a separate dry-run;
- importing `scripts/verify-package.mjs` if import rebuilds, writes, packs, or resolves npm through `PATH`;
- remove argv containing `--offline`, `--ignore-scripts`, an unscoped package ID, or any additional token;
- direct Harness HTTP, `/api`, Probe-channel, Connection-carrier, `fetch`, `XMLHttpRequest`, or runtime-evaluated transport probes;
- private Harness selectors or any selector other than the stable `data-dsh-pm-workbench` markers;
- signaling through a raw PID, signaling after the retained `ChildProcess` has exited, or signaling when the spawn receipt, retained child, PID, cwd witness, marker witness, or listener witness disagrees;
- cleanup outside the owned root, cleanup after ownership drift, cleanup through a changed root name, or emission of a successful cleanup receipt before confirmed deletion.

Prove this exact DSH plugin command graph:

```text
<node> <dsh-cli> plugin --profile web add <absolute-tgz> --offline
<node> <dsh-cli> plugin --profile web remove @knight/dsh-pm-workbench
```

The remove command has no `--offline`, no `--ignore-scripts`, and no other forwarded pnpm flag.

Prove the closed result states `PASS`, `FAIL`, `INCONCLUSIVE`, `NEEDS_NETWORK_PERMISSION`, and `SAFETY_ABORT`. A runtime observation mismatch is `FAIL`; a validated Chrome that cannot start or expose CDP is `INCONCLUSIVE`; an offline install that proves a required exact external artifact is absent is `NEEDS_NETWORK_PERMISSION`; uncertain ownership, process, listener, or cleanup identity is `SAFETY_ABORT`.

- [ ] **Step 2: Implement the non-bypassable canonical build and byte-frozen package**

In `packages/workbench/build.mjs`, retain the existing test hook only as an additional restriction. Immediately after that hook and immediately before every `rm`, `mkdir`, or `writeFile`, always run repository-owned `assertWorkbenchWritePath`; a caller-supplied no-op guard must never weaken the physical boundary.

Expose a no-argument canonical package-build entry such as `buildPackableWorkbench()`. It fixes output to `packages/workbench/lib`, accepts no caller-selected `outdir` or guard, runs both graph validators before writing, writes exactly `lib/index.js` and `lib/client.js`, and returns both metafiles plus output hashes. The smoke runner may call only this canonical entry.

Refactor `scripts/verify-package.mjs` so its reusable verifier is import-safe and side-effect-free: importing it must not build, pack, invoke npm, or write. Its Stage 2 verification entry accepts canonical build evidence, opens and verifies the exact package closure once, and returns both a closed verification receipt and the frozen bytes for exactly these nine relative files:

```text
LICENSE
README.md
cordis.patch.yml
docs/compatibility.md
docs/privacy.md
docs/third-party.md
lib/client.js
lib/index.js
package.json
```

The verifier validates the exact allowlist, zero-runtime-dependency contract, Zod bundling and notice, Host/Client graph direction, entrypoints, modes, sizes, hashes, and absence of absolute-path leakage. Each returned byte buffer must come from the same bounded read whose before/after file identity passed. Its ordinary command-line wrapper may compose the canonical builder for repository checks, but that wrapper is not Stage 2 runtime evidence.

After canonical build and verification, create `<run-root>/package-source` exclusively and copy only the nine already-returned verified byte buffers into that tree with their verified relative paths and modes. Do not reopen or reread a repository package file after verification. Reinventory `package-source` and require exact equality to the nine-file receipt.

With cwd exactly `<run-root>/package-source`, invoke the explicit absolute Node and npm CLI exactly once. The fixed argv begins as:

```text
<absolute-node> <absolute-npm-cli> pack . --json
```

The only permitted trailing arguments are fixed safety restrictions owned by this repository: `--ignore-scripts`, `--offline`, an explicit `--pack-destination` below `<run-root>/pack`, explicit cache/user-config/global-config paths below the same owned operation root, disabled audit/fund/update-notifier, and bounded error logging. Do not run a separate npm dry-run, do not use `npm pack --workspace`, and do not resolve npm through `PATH`. Reject package lifecycle hooks that could mutate the frozen package source. Require exactly one newly created regular tgz in the explicit pack destination, validate npm's exact nine-member path/size/mode inventory, revalidate the staged nine-file byte receipt after packing, independently verify the tgz byte count, npm SHA-1 and SHA-512 integrity, then compute and freeze the whole-tgz SHA-256 for every later add or reinstall. npm metadata does not expose per-member SHA-256, so Stage 2 makes no such claim. Do not publish, rebuild after freeze, select a tgz by “latest” or mtime, or accept a package created by another command.

- [ ] **Step 3: Initialize the isolated profile with the owned pnpm shim**

Create the run root exclusively below the canonical system temporary directory, write its random ownership marker with `wx`, record root and marker device/inode/mode identities, and create every isolation path beneath it.

Build every child environment from an empty object. Isolate at least `HOME`, `DSH_HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_DATA_HOME`, `TMPDIR`, npm cache and both npm config files, pnpm home/store/cache/state directories, cwd, and browser user-data. Strip all inherited proxy, registry override, auth, token, credential, provider, model, DSH, Node-option, npm, pnpm, Corepack, and browser variables.

Because rc.6 resolves `pnpm` by name, create exactly one exclusive regular executable at `<run-root>/bin/pnpm`. Its fixed, tested bytes invoke only the validated absolute pnpm Node with the validated absolute pnpm CLI and forward original argv without interpretation. Before every plugin operation, revalidate shim bytes/mode/identity and both pnpm inputs. For plugin operations, `PATH` is exactly `<run-root>/bin`; no other child receives an inherited executable search path.

Initialize and install only with:

```text
<absolute-node> <absolute-dsh-cli> plugin --profile web add <absolute-frozen-tgz> --offline
```

Verify in the isolated profile that `package.json` has exact dependency `@knight/dsh-pm-workbench`; `dsh.profile.bundles` contains exact `@knight/dsh-pm-workbench`; the resolved manifest matches the frozen tgz; the patch, Host bundle, Client bundle, and entrypoints match the verification receipt; and the package Cordis row has exact `id: dsh-pm-workbench` while package/name identity is independently `@knight/dsh-pm-workbench`.

Do not treat `--dump-config`, a profile listing, package listing, or filesystem presence as runtime PASS evidence. If offline add proves an exact required external artifact is unavailable, return `NEEDS_NETWORK_PERMISSION`; never retry online.

- [ ] **Step 4: Start and stop only identity-witnessed isolated children**

Launch Harness only as:

```text
<absolute-node> <absolute-dsh-cli> web [--patch <absolute-owned-disable-patch>] --host 127.0.0.1 --port 0
```

Launch Chrome directly from the validated absolute Chrome executable with a new owned user-data directory and dynamically allocated CDP port for every phase. Obtain the DevTools WebSocket URL from bounded Chrome process output; do not make an HTTP request to a Chrome discovery endpoint. Use CDP only to control the rendered browser.

The fixed Chrome argv includes `--use-mock-keychain`. On macOS this prevents the disposable test profile from consulting or prompting for the user's real Keychain. This is an isolation and shutdown-determinism control, not PASS evidence; Chrome process exit, listener absence, zero open handles, and owned-root removal remain mandatory.

Immediately after each spawn, retain an in-memory receipt containing exact executable, argv, cwd, allowlisted-environment-key digest, marker ID, `ChildProcess` object, and PID. Treat the retained child object as authoritative continuity. Use fixed absolute `/usr/sbin/lsof` to prove the live child's marker-owned cwd, the Harness child's exact `127.0.0.1:<dynamic-port>` listener, and the Chrome child's exact CDP listener.

Reject port `3080`. Before signaling, require the same retained child object, unchanged PID, `exitCode === null`, `signalCode === null`, matching receipt, matching cwd, and matching listener. Signal through the retained child object, not a caller-supplied or raw PID. After exit, prove the listener is gone.

Chrome has a dedicated graceful-close path. After a fresh retained-child, marker, cwd, PID, and exact DevTools-listener validation, send browser-scope CDP `Browser.close` through the already authenticated peer and wait boundedly for the retained `ChildProcess` `exit` event. A CDP response, WebSocket close, or listener disappearance alone is not completion. Only the retained child exit followed by strict listener absence permits `markChildStopped`. If graceful close times out, close the local peer and require a fresh complete identity and listener witness before the existing retained-child signal fallback; if that witness is unavailable, return `SAFETY_ABORT` and retain the owned root. Never discover or kill a process by name, raw PID, process group, or helper/descendant identity. Profile commands that consume bounded stdout/stderr continue to wait for Node's `close` event; Chrome lifecycle proof uses `exit` so an inherited pipe cannot masquerade as a live main process.

Do not require OS `ps` start time, OS-reported argv, or executable-name matching. The accepted witness is the spawn receipt plus still-live retained `ChildProcess` plus `lsof` cwd/listener ownership. If any element disagrees, do not signal and return `SAFETY_ABORT`.

If validated Chrome cannot start, expose bounded CDP, or render the isolated loopback page, return `INCONCLUSIVE`; do not infer UI success.

- [ ] **Step 5: Observe the smoke graph through rendered UI only**

The runner may use CDP `Page`, `DOM`, `Input`, and accessibility/lifecycle operations needed to navigate, wait, query stable plugin-owned attributes, read attributes/text, and dispatch real pointer input. It must not evaluate or inject code that calls `fetch`, `XMLHttpRequest`, a Connection object, the Probe channel, or any Harness API. It must not inspect Harness-private classes, component structure, globals, source modules, or private DOM.

Use the 30-second startup budget only for `Page.navigate`; keep the ordinary CDP command budget at 10 seconds. The navigation request is not retried after a local timeout because the first browser navigation may still be active and a retry would make loader evidence ambiguous.

Observe this exact sequence:

1. installed and enabled, fresh Harness and Chrome: wait for the launcher marker, click it, observe overlay and counter markers at `data-counter="0"` and `data-version="0"`, click increment, and observe counter/version `1`;
2. restart with fresh Harness and Chrome: reopen overlay and observe retained counter/version `1`;
3. stop both children, then start fresh Harness and Chrome with the owned disable patch below; prove package dependency, profile bundle, and installed package remain present while plugin-owned launcher and overlay markers remain absent after normal page lifecycle and a bounded quiet period;
4. stop both children and run the exact remove command below;
5. start fresh Harness and Chrome; prove dependency, bundle, and installed package are absent and plugin-owned markers remain absent after normal page lifecycle and a bounded quiet period;
6. stop both children, reinstall the byte-identical frozen tgz with the original add argv, and start fresh Harness and Chrome;
7. reopen overlay, observe retained counter/version `1`, click increment, and observe counter/version `2`.

The owned public disable patch is exactly:

```yaml
- id: dsh-pm-workbench
  disabled: true
```

Package/name identity remains independently verified as `@knight/dsh-pm-workbench`; it is deliberately not repeated in the disable patch.

The exact remove command is:

```text
<absolute-node> <absolute-dsh-cli> plugin --profile web remove @knight/dsh-pm-workbench
```

It contains neither `--offline` nor `--ignore-scripts`. Every plugin-set change occurs while Harness is stopped and is followed by a new Harness process and Chrome profile.

UI increment followed by restart persistence is the RPC proof: it demonstrates the shipped Client invoking the shipped Host through public Connection RPC without the runner calling the carrier. Disabled and removed states are proved by isolated-profile state plus rendered plugin-marker absence. Do not call a raw RPC or HTTP endpoint, and do not accept `404` or `405` as evidence.

- [ ] **Step 6: Cleanup with rename, revalidation, no-follow removal, and post-deletion emission**

First stop only children satisfying retained-child, spawn-receipt, cwd, marker, and listener witnesses. Verify every Harness and Chrome listener disappeared.

Before deleting filesystem state:

1. derive a bounded, sanitized, path-free result candidate and cleanup-receipt draft in memory;
2. revalidate the run root, every existing ancestor below the canonical temporary parent, ownership marker, and saved device/inode/mode identities with `lstat`;
3. require the original root to contain only the owned lexical run closure and reject a changed root, marker, ancestor, unexplained hardlink count, mount/cross-device directory, or special file; inventory every interior symlink with `lstat`/`readlink`, including pnpm links and rc.6 fallback links whose targets may sit outside the run root, never follow any target during closure traversal or removal, and make no claim that a recorded symlink target belongs to the owned closure;
4. exclusively choose a fresh sibling tombstone under the same verified temporary parent;
5. atomically rename the run root to that tombstone;
6. require the original pathname to be absent;
7. revalidate that tombstone and marker retain exact pre-rename identities under the unchanged temporary parent;
8. recursively remove the tombstone without following symlinks;
9. verify both original and tombstone pathnames are absent and the temporary parent identity is unchanged.

Only after step 9 may the runner finalize `cleanup.deleted: true` in memory and emit the canonical sanitized result. The successful cleanup receipt is emitted from memory after deletion and never stored inside the deleted root.

If identity changes before rename, do not rename or delete. If it changes after rename, do not continue removal. If removal or absence verification fails, return bounded `SAFETY_ABORT` with `cleanup.deleted: false` and no successful cleanup receipt. Do not reveal a retained absolute path in sanitized output.

This rename/revalidate/remove sequence protects against accidental path or ownership drift. An interior symlink with an external target does not extend deletion authority because inventory and removal never follow it; only the link entry inside the owned tombstone is unlinked. The result does not attest to ownership or validity of the target. The sequence does not claim resistance to a malicious same-user process racing filesystem mutations between checks; that adversarial same-user race is explicitly outside the Stage 2 threat model.

- [ ] **Step 7: Verify, sanitize, and commit only code plus an eligible report**

Run:

```bash
npm test -- tests/integration/stage-2-smoke-runner.test.ts
npm run check
npm run build
npm run verify:package
npm test -- tests/integration/standalone-copy.test.ts
git diff --check
```

The standalone source manifest must include the runner, its test, the smoke-result verifier, and every Task 3 production file needed to reproduce the same build/package checks after relocation.

Invoke the real smoke directly through explicit Node, not `npm run`, `npx`, a shebang, or a PATH-resolved command:

```text
<absolute-node> scripts/run-stage-2-isolated-smoke.mjs --node <absolute-node> --dsh-cli <absolute-dsh-cli> --npm-cli <absolute-npm-cli> --pnpm-node <absolute-pnpm-node> --pnpm-cli <absolute-pnpm-cli> --chrome <absolute-chrome>
```

The runner emits one bounded canonical JSON result only after the cleanup decision is final. Independently pass those exact bytes to `scripts/verify-stage-2-smoke-result.mjs`. The verifier rejects unknown fields, raw logs, credentials, payload text, local absolute paths, unbounded strings, an invalid outcome/evidence combination, or a successful cleanup claim without post-deletion proof. It alone renders the eligible Markdown report.

The runner and verifier do not commit or copy the report. Only after verifier success may the verified Markdown be copied into `docs/gate-results/stage-2-isolated-smoke.md`.

The result is `PASS`, `FAIL`, `INCONCLUSIVE`, `NEEDS_NETWORK_PERMISSION`, or `SAFETY_ABORT`. `PASS` requires every enabled UI observation, restart persistence, disabled state, removal/reinstall, package identity, process/listener closure, and successful cleanup receipt. `PASS` permits only the phrase: “The Stage 2 isolated smoke passed for the recorded rc.6 combination.” It does not permit “Gate A-prime passed,” “the PM Workbench is complete,” real interview use, or public distribution.
