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
- Create: `tests/probe/lifecycle.test.tsx`

**Interfaces:**

- Produces: `createProbeHandler(repository)`, `ProbeRepository`, `ConnectionRpcProbeTransport`, and the two exact endpoints `health` and `counter.increment`.
- `health({})` returns `mode`, exact capability constants, `counter`, and `aggregateVersion`.
- `counter.increment({ apiVersion, expectedVersion, commandId, delta: 1 })` implements CAS and same-command idempotency over synthetic state.

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

- [ ] **Step 6: Implement Host and Client entrypoints**

Host opens the synthetic domain, registers one loopback channel, rejects excess in-flight requests, and performs ordered drain: stop admissions, unregister route, abort lifecycle, await in-flight work and repository writes, then close storage. Its Cordis `inject` keys are the provided service names `['connection', 'storageDomain']`, not the provider package/plugin names. Client contributes one `sidebar.footer.action` and one `shell.overlay`, renders no replacement root, uses the public rc.6 Connection-context intersection, imports the public Client declaration entrypoints it consumes instead of relying on test-global augmentations, and restores focus after close. Add `tsc -p packages/workbench/tsconfig.json --noEmit` to the root typecheck chain so production Host and Client sources compile in their own program. Bundle Zod into both Host and Client artifacts; keep the root development pin but remove Zod from the published package runtime dependencies so a fresh profile can install the tgz offline. Use esbuild metafiles to prove both entry graphs include Zod, exclude Cordis/DeepSeek runtime source, and contain only the declared external packages; never use `packages: 'external'`. Keep Host externals at `@deepseek-ai/*` plus Cordis and Node built-ins, and Client externals at React/React DOM and `@deepseek-ai/*`. Update both manifest contracts that currently require a published Zod dependency. Package verification must prove zero published runtime dependencies, no bare Zod runtime import, no bundled second Harness/Cordis runtime, and inclusion of the Zod notice. Append the resulting Task 2 dependency delta to the Task 1 research checkpoint and append a source-only checkpoint to `docs/probe-results.md`; do not rewrite its immutable historical run blocks or call the checkpoint a runtime PASS. Update the packed third-party notice and root notice with the applicable Zod 4.4.3 MIT attribution/license, and update packed privacy/compatibility plus root/package READMEs from “static no-op” to “implemented but not yet runtime-verified.” Add every new production file, Probe test, and required build/contract/doc file to the standalone relocation manifest so the cloned verification path runs the same implementation and checks. No document may claim installation or smoke success before Task 3 observes it.

- [ ] **Step 7: Run Task 2 verification and commit**

```bash
npm test -- tests/probe
npm run typecheck
npm run build
npm run verify:package
git diff --check
git add -- packages/workbench/src packages/workbench/build.mjs packages/workbench/package.json package.json package-lock.json tests/probe tests/contract/package-manifest.test.ts tests/contract/harness-rc6-public-surface.test.ts tests/fixtures/standalone-source-manifest.json scripts/verify-package.mjs packages/workbench/README.md packages/workbench/docs/compatibility.md packages/workbench/docs/privacy.md packages/workbench/docs/third-party.md README.md THIRD_PARTY_NOTICES.md research/2026-09-07-stage-2-rc6-public-surface.md docs/probe-results.md
git diff --cached --check
git commit -m "feat: add minimal Harness smoke probe"
```

**Stop condition:** The real public API cannot express the route, slots, disposal ordering, or synthetic persistence without a private fallback.

---

### Task 3: Run the real-tgz isolated Harness smoke

**Files:**

- Create: `scripts/run-stage-2-isolated-smoke.mjs`
- Create: `tests/integration/stage-2-smoke-runner.test.ts`
- Modify: `packages/workbench/build.mjs`
- Modify: `package.json`
- Create outside Git during execution: a fresh marker-owned directory under the operating system temporary root
- Create only after a completed sanitized run: `docs/gate-results/stage-2-isolated-smoke.md`

**Interfaces:**

- Produces: one marker-owned run directory with temporary raw evidence and cleanup receipt; only a separately verified sanitized report may later be copied into the repository.
- The runner accepts an explicit absolute rc.6 CLI entry and never resolves `dsh` via PATH.

- [ ] **Step 1: Write RED ownership and command-graph tests**

Prove refusal of actual port `3080`, non-loopback bind, an existing/non-owned run root, symlinks at owned roots, missing/mismatched marker, PATH CLI fallback, source/link/Git install specs, unexpected package hash, signaling a PID whose identity changed, and cleanup outside the owned run directory. The runner owns a state machine with explicit `PASS`, `FAIL`, `INCONCLUSIVE`, `NEEDS_NETWORK_PERMISSION`, and `SAFETY_ABORT` outcomes.

- [ ] **Step 2: Implement deterministic package freeze**

Build the workbench, run package allowlist verification, create one real tgz in the owned run directory, hash it, and install that exact file. Do not publish it.

- [ ] **Step 3: Initialize and install into a fresh profile**

Start from an empty allowlisted child environment and isolate `HOME`, `DSH_HOME`, XDG, npm, pnpm, temp, cwd, and browser paths. Use the public `dsh plugin --profile web add <absolute-tgz> --offline` path and verify the resolved package, tgz hash, bundle row, and package entrypoints directly in the isolated profile. Do not use `--dump-config` as PASS evidence. If an exact external runtime dependency is unexpectedly absent from the new isolated store, stop as `NEEDS_NETWORK_PERMISSION`; never silently retry online.

- [ ] **Step 4: Start only the isolated runtime**

Launch the explicit fixed rc.6 CLI entry on `127.0.0.1` with `--port 0`, parse the actual port, reject `3080`, and prove the child owns the listener. Reject inherited proxy/provider/credential variables and never signal a process whose PID, start time, argv, marker path, or listener ownership no longer matches. Start a new isolated headless Chrome profile for each runtime phase; if Chrome/CDP is unavailable, the overall result is `INCONCLUSIVE` rather than an inferred UI success.

- [ ] **Step 5: Observe the smoke graph**

Observe the following through real Host RPC, Client bundle and plugin-owned DOM markers: initial counter `0`; launcher and overlay interaction; UI-driven increment to `1`; restart persistence at `1`; public patch disable while the package remains installed; public remove and runtime disappearance; reinstall of the byte-identical tgz with retained counter `1`; and another UI-driven increment to `2`. Every plugin-set change gets a new Harness process and new Chrome profile. The boot entry identifier is the package name `@knight/dsh-pm-workbench`. Disabled or removed RPC proves only that the plugin's successful response is absent; rc.6 may return `404` or `405`.

- [ ] **Step 6: Cleanup and prove isolation**

Stop only identity-verified owned children, verify each dynamic listener disappears, remove the marker-owned run root without following dependency symlinks, and record that no command targeted `3080`, the default profile, or user browser state. If ownership changes or cleanup cannot be proven, stop destructive cleanup and return `SAFETY_ABORT`. Do not delete retained data outside the owned run root.

- [ ] **Step 7: Verify, sanitize, and commit only code plus the eligible report**

```bash
npm test -- tests/integration/stage-2-smoke-runner.test.ts
npm run check
npm run build
npm run verify:package
git diff --check
```

The runner does not commit its own report. After cleanup, independently validate sanitization before copying an eligible report to `docs/gate-results/`. The result is `PASS`, `FAIL`, `INCONCLUSIVE`, `NEEDS_NETWORK_PERMISSION`, or `SAFETY_ABORT`. `PASS` permits only the phrase: “The Stage 2 isolated smoke passed for the recorded rc.6 combination.” It does not permit “Gate A-prime passed,” “the PM Workbench is complete,” real interview use, or public distribution.
