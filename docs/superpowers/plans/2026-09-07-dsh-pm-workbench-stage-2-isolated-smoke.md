# DSH PM Workbench Stage 2 Isolated Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the smallest real Harness Probe package and verify install, visibility, overlay interaction, public Connection RPC, synthetic persistence, removal, reinstall, and cleanup in a disposable DeepSeek Harness `0.1.0-rc.6` profile.

**Architecture:** The shipped package keeps separate Host and Client entry graphs. The Host owns a strict two-endpoint Probe service and a synthetic counter; the Client contributes one additive sidebar action and one additive overlay through public slots and talks to the Host only through public Connection RPC. A repository-owned runner creates a fresh `DSH_HOME`, uses `127.0.0.1:3186`, installs a real tgz, records a sanitized result, and removes only files and processes it owns.

**Tech Stack:** TypeScript 6.0.3, React 18.3.1, esbuild 0.25.12, Vitest 3.2.7, Zod 4.4.3, DeepSeek Harness and public integration packages `0.1.0-rc.6`.

**Spec:** `docs/superpowers/specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md`

## Global Constraints

- This is a **Stage 2 isolated smoke**, not the full A01-A22 Gate A-prime result and not a Harness Alpha.
- Use only a new marker-owned `DSH_HOME`, `127.0.0.1`, port `3186`, and synthetic integer state.
- Do not read, write, stop, or reuse the active `3080` process, `~/.dsh`, real Workspaces, Sessions, browser data, models, providers, recordings, interviews, documents, or the installed ripple profile.
- Use only public rc.6 package exports. No `/api` interception, bare HTTP fallback, private imports, private DOM, root replacement, copied descriptors, or Harness source edits.
- Install from a real tgz. A source link, config dump, package listing, or screenshot alone cannot establish a runtime PASS.
- If rc.6 exposes no public disable command, report only the lifecycle actually observed: component disposal plus public remove/re-add.
- Keep raw logs and the temporary profile outside Git. Any committed result must be sanitized and contain no credentials, payload text, or local absolute paths.
- No push, pull request, merge, publication, model call, or real-data enablement is in scope.

---

### Task 1: Freeze and compile the public rc.6 surface

**Files:**

- Create: `tests/contract/harness-rc6-public-surface.test.ts`
- Create: `tests/types/harness-host-rc6-surface.ts`
- Create: `tests/types/harness-client-rc6-surface.ts`
- Create: `tsconfig.surface.host.json`
- Create: `tsconfig.surface.client.json`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/workbench/package.json`
- Modify: `tests/contract/package-manifest.test.ts`
- Create: `research/2026-09-07-stage-2-rc6-public-surface.md`

**Interfaces:**

- Consumes: `HostConnectionHandle.rpc.handle`, `ConnectionHandle.rpc.call`, `DomainFacility.open`, `SlotRegistry.inject/register`.
- Produces: exact dependency pins and compile-only Host/Client contracts without calling or constructing fake runtime objects.

- [ ] **Step 1: Write failing contract tests**

The runtime test must resolve the exact package manifests and assert version `0.1.0-rc.6`. The Host compile fixture must typecheck:

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
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
```

Expected: fail because Connection, storage, sidebar, slots, and Zod are not yet pinned in this worktree.

- [ ] **Step 3: Add exact public dependencies and package injection metadata**

Pin the rc.6 packages exactly in the root development graph. Keep `zod` as the workbench runtime dependency. The workbench Client injection order is runtime, Connection, layout, sidebar, then slots; the Host exports `inject = ['client-connection', 'storage-domain']` only after Task 3.

- [ ] **Step 4: Run GREEN and record the observed public signatures**

```bash
npm test -- tests/contract/harness-rc6-public-surface.test.ts tests/contract/package-manifest.test.ts
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
npm run typecheck
```

- [ ] **Step 5: Commit the exact Task 1 file inventory**

```bash
git diff --check
git add -- package.json package-lock.json packages/workbench/package.json tests/contract/package-manifest.test.ts tests/contract/harness-rc6-public-surface.test.ts tests/types/harness-host-rc6-surface.ts tests/types/harness-client-rc6-surface.ts tsconfig.surface.host.json tsconfig.surface.client.json research/2026-09-07-stage-2-rc6-public-surface.md
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

All parsing uses strict Zod schemas. The handler catches every internal error and returns a bounded safe envelope without `Error.message`, stack, payload, or paths.

- [ ] **Step 3: Write RED Client transport tests**

Cover success, Host business rejection, malformed success output, carrier rejection, transport exception, and cancellation. A malformed or failed result must not update the Client's authoritative snapshot.

- [ ] **Step 4: Implement the Connection RPC adapter**

The adapter calls only channel `/dsh-pm-workbench-v1`; it validates request before send and response after receive, returning a closed discriminated result.

- [ ] **Step 5: Write RED lifecycle/UI tests**

Use fake public-shaped contexts to prove exactly one launcher and one overlay registration, open/close state, and disposal without duplicate registrations after remount.

- [ ] **Step 6: Implement Host and Client entrypoints**

Host opens the synthetic domain, registers one loopback channel, and disposes route before closing storage. Client contributes one `sidebar.footer.action` and one `shell.overlay`, renders no replacement root, and restores focus after close.

- [ ] **Step 7: Run Task 2 verification and commit**

```bash
npm test -- tests/probe
npm run typecheck
npm run build
npm run verify:package
git diff --check
git add -- packages/workbench/src packages/workbench/build.mjs tests/probe
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
- Create outside Git during execution: `.tmp/dsh-pm-workbench/stage-2-smoke/<run-id>/`
- Create only after a completed sanitized run: `docs/gate-results/stage-2-isolated-smoke.md`

**Interfaces:**

- Produces: one marker-owned run directory with `result.json`, sanitized `report.md`, and cleanup receipt.
- The runner accepts an explicit absolute rc.6 CLI entry and never resolves `dsh` via PATH.

- [ ] **Step 1: Write RED ownership and command-graph tests**

Prove refusal of `3080`, non-loopback bind, an existing/non-owned profile root, symlinks, missing marker, PATH CLI fallback, source links, unexpected package hash, and cleanup outside the owned run directory.

- [ ] **Step 2: Implement deterministic package freeze**

Build the workbench, run package allowlist verification, create one real tgz in the owned run directory, hash it, and install that exact file. Do not publish it.

- [ ] **Step 3: Initialize and install into a fresh profile**

Set `DSH_HOME` only for the child process. Use the public `dsh plugin --profile web add <absolute-tgz>` path and record the resolved package/bundle list from the isolated profile. If this operation requires network, stop before network and request the separate permission required by the runtime.

- [ ] **Step 4: Start only the isolated runtime**

Launch the fixed rc.6 entry on `127.0.0.1:3186`, reject any inherited proxy/provider/credential variables, verify the child/listener belongs to the run marker, and never signal a process not owned by the runner.

- [ ] **Step 5: Observe the smoke graph**

Observe Host and Client load, one launcher, overlay open/close, `health`, one synthetic counter increment, restart persistence, public remove plus restart disappearance, same-tgz re-add, and sentinel readback. If a browser is unavailable, mark UI observations `INCONCLUSIVE`; do not infer them from config.

- [ ] **Step 6: Cleanup and prove isolation**

Stop only the owned child, verify the `3186` listener disappears, remove the marker-owned run profile, and record that no command targeted `3080` or the default profile. Do not delete retained data outside the owned run root.

- [ ] **Step 7: Verify, sanitize, and commit only code plus the eligible report**

```bash
npm test -- tests/integration/stage-2-smoke-runner.test.ts
npm run check
npm run build
npm run verify:package
git diff --check
```

The result is `PASS`, `FAIL`, or `INCONCLUSIVE`. `PASS` permits only the phrase: “The Stage 2 isolated smoke passed for the recorded rc.6 combination.” It does not permit “Gate A-prime passed,” “the PM Workbench is complete,” real interview use, or public distribution.
