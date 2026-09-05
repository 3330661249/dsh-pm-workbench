# DSH PM Workbench H0 Connection RPC Probe Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Prove or reject the smallest public Connection RPC, additive slot, synthetic persistence, restart, and remove lifecycle in an isolated DeepSeek Harness 0.1.0-rc.6 profile.

**Architecture:** Compile a Probe-only Host and Client from a real tgz. The Host registers one loopback-only channel and stores one synthetic counter aggregate; the Client validates all responses and exposes one additive sidebar launcher plus one overlay. Probe and Product types never coexist in the same runtime registry.

**Tech Stack:** TypeScript 6.0.3, Node.js 24.14.0, React 18.3.1, Vitest 3.2.7, esbuild 0.25.12, Zod 4.4.3, Playwright Test 1.62.1, @deepseek-ai/dsh-client-connection 0.1.0-rc.6, @deepseek-ai/dsh-storage-domain 0.1.0-rc.6.

**Spec:** ../specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md

## Global Constraints

- H0 starts from the exact accepted F0 evidence tip, whose canonical-ledger block names the frozen F0 source commit and lock, and needs a separate H0 implementation authorization. It consumes F0 shared ports without recreating or broadening them.
- H0 exact-lock hydration and the later exact rc.6 dependency/lock mutation each require their own canonical action decision. A classified hydration cache miss and the fixed public-registry dependency download each require a separate, non-substitutable network decision. F0's repository wrapper validates every applicable decision before allocating output or spawning npm, records only canonical IDs plus path-free receipt hashes, and never forwards a decision ID to npm.
- This plan is H0 only. It cannot create projects, import text, analyze evidence, render PRDs, call models, or process files.
- H0 runtime accepts only health and counter.increment.
- Real Harness execution requires a separate owner authorization after the H0 code is reviewed.
- Runtime uses a new repository-local DSH_HOME, port 3186, bind 127.0.0.1, trustedHosts=[], and authority: loopback.
- Do not read or touch ~/.dsh, active port 3080, real ripple installation, user browser state, Workspaces, Sessions, credentials, or real data.
- Do not use /api intercept, bare webServer routes, private imports, root replacement, private DOM, copied Typert descriptors, or Harness source modification.
- Gate A′ plugin request and outcome budgets are each 4,096 canonical JSON UTF-8 bytes.
- Gate A′ permits at most 256 receipts and 1,048,576 persisted receipt-ledger bytes.
- Client admission is eight requests per adapter. Host admission is sixteen requests for the entire channel.
- A gate failure is retained as FAIL or INCONCLUSIVE and stops Harness-facing work.
- Each task stages only the exact Files inventory for that task, runs `git diff --cached --check`, compares `git diff --cached --name-only` with the inventory, and checks `git status --short` before committing. Directory-wide staging is forbidden.

## Worktree and dependency preflight

After separate creation-only authorization, use `superpowers:using-git-worktrees` only through isolation creation. Explicitly skip its automatic Project Setup, `.gitignore` edit/commit, and active-checkout fallback. The creation command may create only the worktree directory and Git administrative link; it may not run package-manager commands or mutate tracked files. Use an owner-approved external root whose realpath is outside the active checkout and has no ancestor `node_modules`; if no creation mechanism can meet that boundary, stop.

Before Task 1, separately authorize the worktree-local `node_modules` write, bind that action to the exact accepted F0 source/lock, new H0 worktree, marker-owned output, scope, expiry, and F0's closed offline-first/verified-cache-miss/one-public-registry-retry state machine, and record its canonical ID as `DSH_PMWB_H0_HYDRATION_DECISION_ID`. Then run F0's committed audited hydrator offline first:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --offline --action-decision-id "$DSH_PMWB_H0_HYDRATION_DECISION_ID"
~~~

Before hydration, record SHA-256 for `package.json` and `package-lock.json` and require a missing local `node_modules`. After hydration, recompute both hashes byte-for-byte, require `lstat(node_modules)` to be a real directory rather than a symlink, require `realpath(node_modules)` to be strictly below this worktree realpath, record the approved Node/npm executable identities separately, and require `tsc`, `vitest`, `esbuild`, `zod`, every package binary, and every installed package to resolve from that exact dependency root. `tests/integration/worktree-dependency-boundary.test.ts` creates an external fixture with a sentinel package available only in a parent `node_modules` and proves resolution fails when the fixture's local dependency is absent; it also rejects a symlinked local `node_modules`, a package/binary realpath escape, an unapproved Node/npm executable identity, and any pre/post manifest or lock hash change.

Only an immutable classified-cache-miss receipt from that first stage permits requesting public-registry network authorization bound to that exact miss, original action state machine, fixed registry, source/lock, output, second-stage argv, scope, and expiry. Record the distinct canonical ID as `DSH_PMWB_H0_HYDRATION_NETWORK_DECISION_ID`, then retry once with both IDs:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --public-registry-network --action-decision-id "$DSH_PMWB_H0_HYDRATION_DECISION_ID" --network-decision-id "$DSH_PMWB_H0_HYDRATION_NETWORK_DECISION_ID"
~~~

The hydrator validates the action decision against the complete state machine before either mode and validates the miss receipt plus network extension before the network child. It rejects direct entry to stage two or any source/lock/output/argv drift. It fixes registry/userconfig/environment, disables lifecycle scripts, preserves exact manifest/lock bytes, validates integrity, and rejects every dependency package or package binary realpath outside this worktree's own `node_modules`; the separately recorded Node/npm executables must match the approved F0 runtime identities. Before Task 1, run F0's Node-built-in exact-lock hydration test and the accepted F0 checks after that closure passes; Task 1 then adds the full worktree dependency-boundary regression and runs it in RED/GREEN and final-freeze verification. A bare `npm install`, parent dependency fallback, implicit setup, missing/cross-scoped/reused decision, or unapproved network is H0 No-Go.

~~~bash
node --test tests/bootstrap/exact-lock-hydration.node.test.mjs
npm run check
~~~

---

### Task 1: Pin and prove the rc.6 public API surface

**Files:**

- Create: tests/contract/connection-rpc-rc6-surface.test.ts
- Create: tests/types/harness-host-rc6-surface.ts
- Create: tests/types/harness-client-rc6-surface.ts
- Create: tsconfig.surface.host.json
- Create: tsconfig.surface.client.json
- Create: research/2026-09-02-connection-rpc-rc6-surface.md
- Modify: package.json
- Modify: package-lock.json
- Modify: packages/workbench/package.json
- Modify: tests/contract/package-manifest.test.ts
- Modify: THIRD_PARTY_NOTICES.md
- Modify: packages/workbench/docs/third-party.md
- Modify: tests/integration/standalone-copy.test.ts
- Create: tests/integration/worktree-dependency-boundary.test.ts

**Interfaces:**

- Consumes: public package exports only.
- Produces: exact peer/dev dependency set, a runtime version/export test, and a non-executed compile contract for Host handle, Client handle, storageDomain, sidebar.footer.action, shell.overlay, signal, registration, and async disposers.

- [ ] **Step 1: Write the failing runtime package test and compile-only surface contract**

~~~ts
import { createRequire } from 'node:module'
import { describe, expect, test } from 'vitest'

const require = createRequire(import.meta.url)

describe('rc.6 public integration surface', () => {
  test('resolves the exact Connection package', () => {
    const pkg = require('@deepseek-ai/dsh-client-connection/package.json')
    expect(pkg.version).toBe('0.1.0-rc.6')
  })

})
~~~

The two `tests/types` files are compiled by separate `tsconfig.surface.host.json` and `tsconfig.surface.client.json` projects and are never imported by Vitest. This prevents Host and Client context augmentations from masking one another. They declare handles and check expressions without constructing or calling fake objects at runtime. The Host file uses a declared public `DomainSpec`; it does not depend on the Task 5 `probeDomainSpec`:

~~~ts
declare const host: HostConnectionHandle
declare const client: ConnectionHandle
declare const hostContext: import('@deepseek-ai/cordis').Context
declare const clientContext: import('@deepseek-ai/cordis').Context
declare const handler: ConnectionRpcHandler
declare const component: React.ComponentType
declare const domainSpec: import('@deepseek-ai/dsh-storage-domain').DomainSpec

const disposeChannel: () => Promise<void> = host.rpc.handle(
  '/dsh-pm-workbench-v1', handler, { authority: 'loopback' },
)
const callResult = client.rpc.call(
  '/dsh-pm-workbench-v1', 'health', {}, new AbortController().signal,
)
const openedDomain = hostContext.storageDomain.open(domainSpec)
const disposeLauncher = clientContext.slots.inject('sidebar.footer.action', () =>
  clientContext.slots.register(
    { name: 'sidebar.footer.action', id: 'pm-workbench-probe-launcher' }, component,
  ),
)
const disposeOverlay = clientContext.slots.inject('shell.overlay', () =>
  clientContext.slots.register(
    { name: 'shell.overlay', id: 'pm-workbench-probe-overlay' }, component,
  ),
)
void disposeChannel; void callResult; void openedDomain; void disposeLauncher; void disposeOverlay
~~~

Use the actual public exported type names discovered from the exact package. If those names or signatures differ, record the mismatch and stop; do not alter the semantic assertions to force a pass.

In the same RED step, require `standalone-copy.test.ts` to copy both new surface tsconfigs as mandatory inputs and to fail if either is absent. It must execute both surface compilers in the standalone copy and resolve the copied compiler and every public package from the isolated copy's own dependency root, never from the source worktree or an ancestor. Add `worktree-dependency-boundary.test.ts` with the realpath, lock-hash, symlink, CLI-escape, and parent-fallback negatives defined in the preflight; after Task 1 dependency mutation its positive case also requires every new rc.6/Playwright/jsdom package to resolve below this worktree's own `node_modules`.

- [ ] **Step 2: Run the tests and observe the intended RED state**

Run:

~~~bash
npm test -- tests/contract/connection-rpc-rc6-surface.test.ts tests/contract/package-manifest.test.ts
npm test -- tests/integration/worktree-dependency-boundary.test.ts tests/integration/standalone-copy.test.ts
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
npm run typecheck
~~~

Expected: FAIL because the exact Connection, storageDomain, sidebar declarations, and their type graph are not yet installed in this repository. A pass caused by resolving a parent checkout is also a failure.

- [ ] **Step 3: Define package roles before regenerating the lock**

Keep F0's exact `zod: 4.4.3`. Add exact rc.6 peer ranges and make the Client injection graph explicit:

~~~json
{
  "dsh": {
    "client": {
      "platform": "web",
      "inject": [
        "@deepseek-ai/dsh-client-runtime",
        "@deepseek-ai/dsh-client-connection",
        "@deepseek-ai/dsh-client-ui-layout",
        "@deepseek-ai/dsh-client-ui-sidebar",
        "@deepseek-ai/dsh-client-ui-slots"
      ]
    }
  },
  "dependencies": { "zod": "4.4.3" },
  "peerDependencies": {
    "@deepseek-ai/cordis": "4.0.1",
    "@deepseek-ai/dsh-client-connection": "0.1.0-rc.6",
    "@deepseek-ai/dsh-client-runtime": "0.1.0-rc.6",
    "@deepseek-ai/dsh-client-ui-layout": "0.1.0-rc.6",
    "@deepseek-ai/dsh-client-ui-sidebar": "0.1.0-rc.6",
    "@deepseek-ai/dsh-client-ui-slots": "0.1.0-rc.6",
    "@deepseek-ai/dsh-invariants": "0.1.0-rc.6",
    "@deepseek-ai/dsh-storage-domain": "0.1.0-rc.6",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  }
}
~~~

Update `package-manifest.test.ts` in the same RED step to require this exact injection order, peer set, optional peer metadata, and the unchanged private/UNLICENSED package boundary.

- [ ] **Step 4: Obtain separate approval for dependency download, node_modules write, and lockfile mutation**

Do not continue from plan, H0 code approval, or hydration approval alone. Obtain one canonical action decision bound to the exact pre-add source/lock, fixed package set, manifest/lock and worktree-local `node_modules` outputs, fixed argv, scope, and expiry; record it as `DSH_PMWB_H0_DEPENDENCY_DECISION_ID`. Obtain a distinct canonical public-registry decision bound to the same exact add and fixed registry; record it as `DSH_PMWB_H0_DEPENDENCY_NETWORK_DECISION_ID`. Only after both decisions exist may F0's audited exact-dependency installer run; do not invoke npm directly, read the user's npm configuration, run lifecycle scripts, or use latest/semver ranges:

~~~bash
node scripts/install-exact-dependencies.mjs --save-dev --save-exact @deepseek-ai/dsh-client-connection@0.1.0-rc.6 @deepseek-ai/dsh-storage-domain@0.1.0-rc.6 @deepseek-ai/dsh-client-runtime@0.1.0-rc.6 @deepseek-ai/dsh-client-ui-layout@0.1.0-rc.6 @deepseek-ai/dsh-client-ui-sidebar@0.1.0-rc.6 @deepseek-ai/dsh-client-ui-slots@0.1.0-rc.6 @playwright/test@1.62.1 jsdom@26.1.0 --action-decision-id "$DSH_PMWB_H0_DEPENDENCY_DECISION_ID" --network-decision-id "$DSH_PMWB_H0_DEPENDENCY_NETWORK_DECISION_ID"
~~~

The wrapper validates both decisions before allocating its output or spawning npm, rejects missing/equal/reused/expired/cross-scoped IDs, and binds the canonical IDs plus path-free receipts to the exact add result without forwarding either ID to npm. The runner uses F0's audited environment builder with unique marker-owned HOME/XDG/npm cache plus distinct empty `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG` files, strips inherited config/auth/token/proxy/provider overrides, fixes the public npm registry, invokes the recorded npm CLI with `shell: false` and `--ignore-scripts --no-audit --no-fund`, and sanitizes bounded output. Audit lockfile integrity fields and dependency package lifecycle scripts before running any package script. If a package requires an install/build script, stop for a narrower authorization rather than weakening the runner. Verify the workspace manifest snapshot in `package-lock.json` exactly matches the edited manifest and record the inherited F0 config-binding receipt plus both H0 dependency-decision receipts.

- [ ] **Step 5: Record the public-only evidence**

research/2026-09-02-connection-rpc-rc6-surface.md must list package name, exact version, public export path, observed signature, and whether the plan assumption passed. It also records the equal pre/post F0-hydration manifest and lock hashes; the H0 hydration action and any used network decision IDs plus path-free receipt hashes; the separately approved Task 1 post-mutation manifest/lock hashes; the distinct dependency action/network decision IDs plus path-free receipt hashes; `nodeModulesIsRealDirectory: true`; `nodeModulesRealpathWithinWorktree: true`; path-free approved Node/npm identities; and the parent-fallback negative outcome. It must not include a worktree, npm cache, CLI-source, or user-home absolute path.

- [ ] **Step 6: Run GREEN verification**

Run:

~~~bash
npm test -- tests/contract/connection-rpc-rc6-surface.test.ts tests/contract/package-manifest.test.ts
npm test -- tests/integration/worktree-dependency-boundary.test.ts tests/integration/standalone-copy.test.ts
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
npm run typecheck
npm ls --depth=0
~~~

Expected: PASS with every DeepSeek integration package exactly 0.1.0-rc.6 and no extraneous dependency.

- [ ] **Step 7: Commit**

~~~bash
git add -- package.json package-lock.json packages/workbench/package.json THIRD_PARTY_NOTICES.md packages/workbench/docs/third-party.md research/2026-09-02-connection-rpc-rc6-surface.md tests/contract/connection-rpc-rc6-surface.test.ts tests/types/harness-host-rc6-surface.ts tests/types/harness-client-rc6-surface.ts tsconfig.surface.host.json tsconfig.surface.client.json tests/contract/package-manifest.test.ts tests/integration/standalone-copy.test.ts tests/integration/worktree-dependency-boundary.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "build: pin rc6 public integration surface"
~~~

**No-Go:** Stop if a private import, copied protocol, Harness upgrade, source patch, bare HTTP route, trusted-host authority, or duplicate bundled Harness runtime is required.

### Task 2: Separate shared, Host, Client, test, and build graphs

**Files:**

- Modify: tsconfig.shared.json
- Modify: tsconfig.client.json
- Create: tests/contract/host-client-build-boundary.test.ts
- Create: tests/fixtures/build-boundary/forbidden-client.ts
- Create: tests/fixtures/build-boundary/forbidden-host.ts
- Create: packages/workbench/src/integration/harness-rc6/probe/index.ts
- Create: packages/workbench/src/client/probe/index.tsx
- Create: playwright.gate-a.config.ts
- Modify: tsconfig.host.json
- Modify: tsconfig.tests.json
- Modify: package.json
- Modify: packages/workbench/package.json
- Modify: packages/workbench/build.mjs
- Modify: scripts/pack-dry.mjs
- Modify: scripts/verify-package.mjs
- Modify: tests/integration/build-writer-boundary.test.ts
- Modify: tests/integration/standalone-copy.test.ts
- Modify: .github/workflows/static-verification.yml

**Interfaces:**

- Consumes: accepted F0 compiler/test graphs and the exact H0 dependency graph from Task 1.
- Produces: buildWorkbench({ target, outdir, guard }) and repository-relative build-metafile.json for target probe.

- [ ] **Step 1: Write failing boundary assertions**

~~~ts
import { readFile } from 'node:fs/promises'
import { expect, test } from 'vitest'

test('probe client graph excludes Host and Node modules', async () => {
  const meta = JSON.parse(await readFile('packages/workbench/lib/build-metafile.json', 'utf8'))
  const clientInputs = Object.keys(meta.client.inputs)
  const clientExternalImports = Object.values(meta.client.outputs)
    .flatMap((output) => output.imports)
    .filter((item) => item.external)
    .map((item) => item.path)
  expect(clientInputs.some((name) => name.includes('storage-domain'))).toBe(false)
  expect([...clientInputs, ...clientExternalImports].some((name) => name.startsWith('node:'))).toBe(false)
  expect([...clientInputs, ...clientExternalImports].some((name) => name.includes('storage-domain'))).toBe(false)
})

test('probe Host graph excludes React view modules', async () => {
  const meta = JSON.parse(await readFile('packages/workbench/lib/build-metafile.json', 'utf8'))
  const hostInputs = Object.keys(meta.host.inputs)
  const hostExternalImports = Object.values(meta.host.outputs)
    .flatMap((output) => output.imports)
    .filter((item) => item.external)
    .map((item) => item.path)
  expect([...hostInputs, ...hostExternalImports].some((name) => /(?:^|\/)react(?:-dom)?(?:\/|$)/.test(name))).toBe(false)
  expect(hostInputs.some((name) => name.includes('/client/'))).toBe(false)
})
~~~

Build the two malicious fixture entries into `.tmp/dsh-pm-workbench/build-boundary` and prove the verifier rejects a Client import of `node:fs`/storageDomain and a Host import of React/WorkbenchView. This mutation test prevents an externalized forbidden import from making the metafile check appear green.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- tests/contract/host-client-build-boundary.test.ts
~~~

Expected: FAIL because the current builder emits no graph manifest and accepts no target.

- [ ] **Step 3: Add exact TypeScript project boundaries**

Keep F0's shared graph phase-neutral. Extend tsconfig.host.json with the Probe Host entry and integration/harness-rc6; extend tsconfig.client.json with the Probe Client entry. `tsconfig.tests.json` already includes both TS and TSX from F0. Create minimal compile-safe Probe Host/Client entry modules now; Task 7 modifies these exact files with behavior. They export only H0 metadata and do not register a route or slot yet.

Root typecheck becomes:

~~~json
{
  "scripts": {
    "typecheck": "tsc -p tsconfig.shared.json --noEmit && tsc -p tsconfig.host.json --noEmit && tsc -p tsconfig.client.json --noEmit && tsc -p tsconfig.tests.json --noEmit"
  }
}
~~~

- [ ] **Step 4: Make build target explicit**

packages/workbench/build.mjs must reject missing or unknown targets. The H0 entry map is:

~~~js
const entries = {
  probe: {
    host: 'src/integration/harness-rc6/probe/index.ts',
    client: 'src/client/probe/index.tsx',
  },
}

export async function buildWorkbench({ target, outdir, guard = assertWorkbenchWritePath } = {}) {
  if (target !== 'probe') throw new Error('H0 build target must be probe')
  // Build Host and Client separately and write a path-sanitized metafile.
}
~~~

The Host build externalizes every @deepseek-ai package. The Client build externalizes React, React DOM, and every @deepseek-ai package. The emitted metafile replaces absolute input names with repository-relative POSIX paths before writing.

Keep root and workspace `build` scripts as argument-forwarders: neither script inserts a target. Every caller must supply exactly one explicit target; missing, duplicate, or unknown `--target` values fail closed. `scripts/pack-dry.mjs`, `scripts/verify-package.mjs`, `build-writer-boundary.test.ts`, `standalone-copy.test.ts`, and `static-verification.yml` pass `probe` exactly once in H0. Update writer-boundary expectations for both bundles and the metafile. No implicit Probe default remains that H1 could accidentally package, and later `npm run build -- --target product` cannot become a conflicting `probe` plus `product` argv.

- [ ] **Step 5: Extend the standalone copy allowlist**

Add the now-existing `tsconfig.shared.json`, `tsconfig.client.json`, and `playwright.gate-a.config.ts` to sourceCandidates. Do not add `fixtures` until P0 creates it. Every required candidate must exist; do not hide a missing source tree behind optional-copy behavior. The copy must still install offline, avoid a parent workspace, and leave source hashes unchanged.

- [ ] **Step 6: Run GREEN**

~~~bash
npm run typecheck
npm run build -- --target probe
npm test -- tests/contract/host-client-build-boundary.test.ts tests/integration/standalone-copy.test.ts
~~~

Expected: PASS. The metafile contains only relative paths.

- [ ] **Step 7: Commit**

~~~bash
git add -- tsconfig.shared.json tsconfig.client.json tsconfig.host.json tsconfig.tests.json package.json packages/workbench/package.json packages/workbench/build.mjs packages/workbench/src/integration/harness-rc6/probe/index.ts packages/workbench/src/client/probe/index.tsx playwright.gate-a.config.ts scripts/pack-dry.mjs scripts/verify-package.mjs tests/contract/host-client-build-boundary.test.ts tests/fixtures/build-boundary/forbidden-client.ts tests/fixtures/build-boundary/forbidden-host.ts tests/integration/build-writer-boundary.test.ts tests/integration/standalone-copy.test.ts .github/workflows/static-verification.yml
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "build: separate probe host and client graphs"
~~~

### Task 3: Implement the Probe-only strict protocol

**Files:**

- Create: packages/workbench/src/ports/protocol/probe.ts
- Create: packages/workbench/src/adapters/node-sha256.ts
- Create: tests/contract/probe-registry.test.ts
- Create: tests/contract/probe-errors.test.ts
- Create: tests/contract/plugin-payload-budget.test.ts
- Create: tests/adapters/node-sha256.test.ts

**Interfaces:**

- Produces: ProbeEndpointTypes, a null-prototype `probeRegistry`, exact Probe schemas/budgets, and a Host/test Node SHA-256 adapter.
- Consumes: accepted F0 WorkbenchTransport, outcomes, canonical JSON, registry types, HashPort, and exact Zod 4.4.3.

- [ ] **Step 1: Write RED tests for endpoint closure and strict schemas**

~~~ts
expect(Object.keys(probeRegistry)).toEqual(['counter.increment', 'health'])
expect(parseProbeInput('health', { extra: true }).ok).toBe(false)
expect(parseProbeInput('counter.increment', {
  apiVersion: 'pmwb-v1',
  expectedVersion: 0,
  commandId: '00000000-0000-4000-8000-000000000000',
  delta: 2,
}).ok).toBe(false)
~~~

Also enumerate non-canonical UUIDs, unsafe integers, negative versions, wrong API versions, prototype-named endpoints, extra fields, and 4,095/4,096/4,097-byte canonical endpoint-plus-payload and outcome values. F0 already owns primitive canonical-JSON rejection tests.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- tests/contract/probe-registry.test.ts tests/contract/probe-errors.test.ts tests/contract/plugin-payload-budget.test.ts tests/adapters/node-sha256.test.ts
~~~

Expected: FAIL because the protocol files do not exist.

- [ ] **Step 3: Reuse the exact F0 transport and outcome unions**

~~~ts
import type {
  WorkbenchOutcome,
  WorkbenchTransport,
  WorkbenchTransportResult,
} from './common.js'
~~~

Do not redefine or widen these types in H0. The F0 exhaustive safe-message table remains the only source.

- [ ] **Step 4: Bind the Probe request hash to F0 canonical JSON**

canonicalJson accepts only null, booleans, strings, finite numbers admitted by endpoint schemas, arrays, and plain own-property objects with Object.prototype or null prototype. Sort object keys deterministically, reject cycles and accessors, and measure new TextEncoder().encode(text).byteLength.

requestHash receives endpoint and strict input without commandId:

~~~ts
export async function requestHash(endpoint: string, inputWithoutCommandId: JsonValue): Promise<string> {
  return hashPort.sha256Utf8(canonicalJson({ endpoint, input: inputWithoutCommandId }))
}
~~~

Implement `NodeSha256` behind the F0 asynchronous browser-safe HashPort. Node crypto may enter the Host/test graph but must not enter the Client graph.

- [ ] **Step 5: Implement the registry entry contract**

~~~ts
export interface EndpointDefinition<I, O, C> {
  inputSchema: z.ZodType<I>
  outputSchema: z.ZodType<O>
  validateOutput: (input: I, output: O, context: C) => boolean
  maxRequestUtf8Bytes: number
  maxOutcomeUtf8Bytes: number
  sensitivity: 'none' | 'metadata' | 'content'
}
~~~

`probeRegistry` is one frozen null-prototype readonly table addressed through `Object.hasOwn`. It has only health and counter.increment. A Map is not an allowed alternative because all closure tests use one representation.

- [ ] **Step 6: Run GREEN**

~~~bash
npm test -- tests/contract/probe-registry.test.ts tests/contract/probe-errors.test.ts tests/contract/plugin-payload-budget.test.ts tests/adapters/node-sha256.test.ts
npm run typecheck
~~~

- [ ] **Step 7: Commit**

~~~bash
git add -- packages/workbench/src/ports/protocol/probe.ts packages/workbench/src/adapters/node-sha256.ts tests/contract/probe-registry.test.ts tests/contract/probe-errors.test.ts tests/contract/plugin-payload-budget.test.ts tests/adapters/node-sha256.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: add probe-only transport contract"
~~~

### Task 4: Implement the synthetic counter state machine

**Files:**

- Create: packages/workbench/src/ports/probe-repository.ts
- Create: packages/workbench/src/application/probe-counter-service.ts
- Create: packages/workbench/src/adapters/in-memory-probe-repository.ts
- Create: tests/application/probe-counter-service.test.ts
- Create: tests/adapters/in-memory-probe-repository.test.ts

**Interfaces:**

- Consumes: Probe request schemas and WorkbenchOutcome.
- Produces: ProbeRepository.transact(), ProbeCounterService.health(), ProbeCounterService.increment().

- [ ] **Step 1: Write failing state-machine tests**

~~~ts
const first = await service.increment({
  apiVersion: 'pmwb-v1',
  expectedVersion: 0,
  commandId: '00000000-0000-4000-8000-000000000001',
  delta: 1,
})
expect(first).toEqual({
  status: 'accepted',
  value: { counter: 1, aggregateVersion: 1 },
})
expect(await service.increment(sameRequest)).toEqual(first)
expect((await service.increment(reusedIdDifferentVersion)).status).toBe('rejected')
~~~

Add tests for two distinct commands racing on version 0, accepted and receipt-eligible rejected receipts, pre-execution refusals, ledger count 256, ledger bytes 1,048,576, and abort checkpoints.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- tests/application/probe-counter-service.test.ts tests/adapters/in-memory-probe-repository.test.ts
~~~

Expected: FAIL with missing ProbeCounterService.

- [ ] **Step 3: Define the single-record aggregate**

~~~ts
export interface ProbeState {
  counter: number
  aggregateVersion: number
  receipts: Readonly<Record<string, ProbeReceipt>>
}

export interface ProbeRepository {
  read(): Promise<ProbeState>
  transact<T>(
    signal: AbortSignal,
    operation: (current: ProbeState, beginCommit: () => void) => {
      next: ProbeState
      result: T
    },
  ): Promise<T>
  close(): Promise<void>
}
~~~

One transaction performs receipt lookup before CAS. Once beginCommit is called, the complete single-record update finishes even if the signal aborts.

- [ ] **Step 4: Implement receipt decisions exactly**

Receipt identity is commandId because Gate A′ owns one pre-existing synthetic aggregate. Hash the endpoint plus strict input without commandId. Store the first compact outcome. Do not create a receipt for invalid schema, ledger full, byte quota full, pre-commit abort, transport failure, internal failure, or reused ID with a different hash.

- [ ] **Step 5: Run GREEN and a race loop**

~~~bash
npm test -- tests/application/probe-counter-service.test.ts tests/adapters/in-memory-probe-repository.test.ts
npm run typecheck
~~~

Expected: one winner per version in 1,000 repeated two-command races and no duplicate increment.

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/ports/probe-repository.ts packages/workbench/src/application/probe-counter-service.ts packages/workbench/src/adapters/in-memory-probe-repository.ts tests/application/probe-counter-service.test.ts tests/adapters/in-memory-probe-repository.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: add synthetic counter state machine"
~~~

### Task 5: Persist the Probe aggregate with storageDomain

**Files:**

- Create: packages/workbench/src/integration/harness-rc6/probe/domain-spec.ts
- Create: packages/workbench/src/integration/harness-rc6/probe/storage-domain-probe-repository.ts
- Create: tests/integration/probe-storage-domain-repository.test.ts
- Create: tests/support/memory-domain-facility.ts

**Interfaces:**

- Consumes: ProbeRepository and public DomainFacility.open().
- Produces: createStorageDomainProbeRepository(domainFacility, lifecycleSignal).

- [ ] **Step 1: Write RED persistence, reopen, and corruption tests**

The test facility must exercise the same repository codec and commit path, not a replacement repository.

~~~ts
await repository.transact(signal, incrementOnce)
await repository.close()
const reopened = await createStorageDomainProbeRepository(facility, signal)
expect(await reopened.read()).toMatchObject({ counter: 1, aggregateVersion: 1 })
~~~

Inject malformed stored values and prove open fails closed without resetting to zero.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- tests/integration/probe-storage-domain-repository.test.ts
~~~

- [ ] **Step 3: Define one strict global record**

~~~ts
export const probeDomainSpec = defineDomain({
  name: 'dsh_pmwb_probe',
  version: 1,
  global: {
    schema: probeStateSchema,
    initial: { counter: 0, aggregateVersion: 0, receipts: {} },
  },
  tables: {},
})
~~~

Using one Domain global makes counter, aggregateVersion, and receipts one durable write. The repository serializes all writes, performs projected byte checks before global.set(), and never mutates values returned from Domain in place.

- [ ] **Step 4: Implement close discipline**

close() first rejects new transactions, waits for the write tail, awaits domain.close(), and then marks the repository closed. Repeated close calls share the same promise.

- [ ] **Step 5: Run GREEN**

~~~bash
npm test -- tests/integration/probe-storage-domain-repository.test.ts
npm run typecheck
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/integration/harness-rc6/probe/domain-spec.ts packages/workbench/src/integration/harness-rc6/probe/storage-domain-probe-repository.ts tests/integration/probe-storage-domain-repository.test.ts tests/support/memory-domain-facility.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: persist the synthetic probe aggregate"
~~~

### Task 6: Add the safe Host dispatcher and Client transport

**Files:**

- Create: packages/workbench/src/integration/harness-rc6/probe/rpc-dispatcher.ts
- Create: packages/workbench/src/integration/harness-rc6/probe/host-admission.ts
- Create: packages/workbench/src/client/probe/connection-rpc-transport.ts
- Create: packages/workbench/src/client/probe/client-admission.ts
- Create: packages/workbench/src/client/probe/probe-api.ts
- Create: tests/contract/probe-rpc-dispatcher.test.ts
- Create: tests/contract/probe-client-transport.test.ts
- Create: tests/contract/probe-canary-redaction.test.ts
- Create: tests/contract/probe-admission.test.ts

**Interfaces:**

- Consumes: probeRegistry, ProbeCounterService, HostConnectionRpc, ClientConnectionRpc.
- Produces: createProbeRpcHandler(), ConnectionRpcProbeTransport, ProbeWorkbenchApi.

- [ ] **Step 1: Write RED transport tests**

Cover valid calls, unknown endpoint, malformed input, malformed accepted output, unknown outer code, bad-request, cancelled, internal, thrown schema/repository/adapter errors, unreachable Host, abort, deterministic admission pressure, and canaries:

~~~text
CANARY_INTERVIEW_BODY_91f7
CANARY_TOKEN_sk-fake-91f7
/Users/example/private/transcript.md
Error: secret stack 91f7
~~~

Assert zero occurrences in returned data, console sink, Host log sink, and UI message key. With deterministic barriers, requests 1–8 enter the Client transport while request 9 remains in an abortable local queue and makes no Host call; aborting it returns transport `cancelled`. Direct Host requests 1–16 enter the handler while request 17 fails before service invocation with constant outer `internal` and zero repository side effect. Neither condition is an inner business `limit-exceeded`.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- tests/contract/probe-rpc-dispatcher.test.ts tests/contract/probe-client-transport.test.ts tests/contract/probe-canary-redaction.test.ts tests/contract/probe-admission.test.ts
~~~

- [ ] **Step 3: Implement Host boundary ordering**

~~~text
Host admission check
→ endpoint ownership check
→ canonical request byte check
→ strict input parse
→ service call with signal
→ domain invariant check
→ contextual output validation
→ WorkbenchOutcome byte check
→ safe outer RpcResult
~~~

Catch every thrown value before returning from the Connection handler. Host-created outer codes are limited to bad-request, cancelled, and internal. The internal message is constant and contains only an opaque incident ID.

The Host limiter owns one channel-wide pool of sixteen permits. A caller that bypasses the Client and arrives while all permits are held is not queued: it receives the fixed outer `internal` before endpoint/schema/service work. The Client limiter owns eight permits per adapter and queues later calls locally in FIFO order; waiting is AbortSignal-aware and releases no phantom permit. Both limiters return idempotent release handles and are driven by barriers, never sleeps.

- [ ] **Step 4: Implement Client boundary ordering**

~~~text
Client admission queue
→ strict input validation and request budget
→ ctx.connection.rpc.call
→ outer RpcResult validation
→ inner WorkbenchOutcome validation
→ endpoint output and correlation validation
→ typed WorkbenchTransportResult
~~~

Never return raw error.message, details, response body, or stack.

- [ ] **Step 5: Run GREEN**

~~~bash
npm test -- tests/contract/probe-rpc-dispatcher.test.ts tests/contract/probe-client-transport.test.ts tests/contract/probe-canary-redaction.test.ts tests/contract/probe-admission.test.ts
npm run typecheck
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/integration/harness-rc6/probe/rpc-dispatcher.ts packages/workbench/src/integration/harness-rc6/probe/host-admission.ts packages/workbench/src/client/probe/connection-rpc-transport.ts packages/workbench/src/client/probe/client-admission.ts packages/workbench/src/client/probe/probe-api.ts tests/contract/probe-rpc-dispatcher.test.ts tests/contract/probe-client-transport.test.ts tests/contract/probe-canary-redaction.test.ts tests/contract/probe-admission.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: connect the safe probe transport"
~~~

### Task 7: Register the minimal additive launcher and overlay

**Files:**

- Create: packages/workbench/src/client/probe/ProbeLauncher.tsx
- Create: packages/workbench/src/client/probe/ProbeOverlay.tsx
- Modify: packages/workbench/src/client/probe/index.tsx
- Create: packages/workbench/src/integration/harness-rc6/probe/lifecycle.ts
- Modify: packages/workbench/src/integration/harness-rc6/probe/index.ts
- Modify: packages/workbench/src/config.ts
- Create: tests/integration/probe-slot-registration.test.tsx
- Create: tests/integration/probe-lifecycle.test.ts

**Interfaces:**

- Consumes: ProbeWorkbenchApi, ctx.slots, ctx.connection, ctx.storageDomain.
- Produces: Probe Host apply() and Probe Client apply().

- [ ] **Step 1: Write RED lifecycle and slot tests**

Start `probe-slot-registration.test.tsx` with the exact `@vitest-environment jsdom` file pragma. Assert exactly one sidebar.footer.action entry with ID pm-workbench-probe-launcher and exactly one shell.overlay entry with ID pm-workbench-probe-overlay. Assert no root, sidebar, conversation, or details replacement. Mount, unmount, and remount three times and assert one live channel and no old listener. A contract test proves Vitest discovers the TSX file and jsdom is exact 26.1.0.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- tests/integration/probe-slot-registration.test.tsx tests/integration/probe-lifecycle.test.ts
~~~

- [ ] **Step 3: Register slots through declaration-aware injection**

~~~ts
export const inject = ['connection', 'slots']

export function apply(ctx: ClientContext): void {
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'pm-workbench-probe-launcher',
        order: 900,
        label: 'PM Workbench Probe',
      },
      ProbeLauncher,
    ),
  )
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'pm-workbench-probe-overlay',
        order: 900,
      },
      ProbeOverlay,
    ),
  )
}
~~~

The actual component face receives its API through the register inject closure. A root-level observable store owns only open/closed state, last safe status, counter, and aggregateVersion.

- [ ] **Step 4: Implement the Host lifecycle coordinator**

~~~text
draining=true
→ await connection channel disposer
→ lifecycleAbort.abort()
→ await all in-flight handlers
→ await repository.close()
→ release remaining resources
~~~

The coordinator is one async disposer. Do not rely on unspecified relative order among separate Cordis effects.

- [ ] **Step 5: Run GREEN and build**

~~~bash
npm test -- tests/integration/probe-slot-registration.test.tsx tests/integration/probe-lifecycle.test.ts
npm run typecheck
npm run build -- --target probe
npm run verify:package -- --target probe
npm run pack:dry -- --target probe
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/client/probe/ProbeLauncher.tsx packages/workbench/src/client/probe/ProbeOverlay.tsx packages/workbench/src/client/probe/index.tsx packages/workbench/src/integration/harness-rc6/probe/lifecycle.ts packages/workbench/src/integration/harness-rc6/probe/index.ts packages/workbench/src/config.ts tests/integration/probe-slot-registration.test.tsx tests/integration/probe-lifecycle.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: add the additive probe launcher and overlay"
~~~

### Task 8: Build the fail-closed Gate A′ runner and Probe package pipeline

**Files:**

- Create: scripts/gates/shared/command.mjs
- Create: scripts/gates/shared/profile-boundary.mjs
- Create: scripts/gates/shared/redact.mjs
- Create: scripts/gates/shared/result-schema.mjs
- Create: scripts/gates/shared/report.mjs
- Create: scripts/gates/shared/tarball-audit.mjs
- Create: scripts/gates/shared/deny-external-network.mjs
- Create: scripts/gates/gate-a.mjs
- Create: scripts/gates/gate-a-cli.mjs
- Create: scripts/gates/gate-a-browser.mjs
- Create: scripts/gates/gate-a-checks.mjs
- Create: scripts/gates/gate-a-bootstrap.mjs
- Reuse unchanged from accepted F0: scripts/bootstrap/policy-fetch.mjs
- Reuse unchanged from accepted F0: scripts/bootstrap/materialize-browser.mjs
- Reuse unchanged from accepted F0: tests/bootstrap/policy-fetch.node.test.mjs
- Reuse unchanged from accepted F0: tests/bootstrap/browser-materializer.node.test.mjs
- Create: scripts/gates/accept-dsh-cli-input.mjs
- Create: scripts/gates/accept-ripple-input.mjs
- Create: scripts/gates/promote-evidence.mjs
- Create: scripts/gates/export-gate-a-evidence.mjs
- Create: scripts/package-probe.mjs
- Create: packages/workbench/src/integration/harness-rc6/probe/gate-test-harness.ts
- Create: tests/integration/gate-a-command-plan.test.ts
- Create: tests/integration/gate-a-cli-surface.test.ts
- Create: tests/integration/gate-a-check-list.test.ts
- Create: tests/integration/gate-a-compiled-seam.test.ts
- Create: tests/integration/gate-a-profile-boundary.test.ts
- Create: tests/integration/gate-a-bootstrap.test.ts
- Create: tests/integration/gate-a-cli-input.test.ts
- Create: tests/integration/gate-a-network-boundary.test.ts
- Create: tests/integration/gate-a-run-closure.test.ts
- Create: tests/integration/gate-a-redaction.test.ts
- Create: tests/integration/gate-a-report.test.ts
- Create: tests/integration/gate-a-export.test.ts
- Create: tests/contract/probe-package-allowlist.test.ts
- Create: tests/contract/probe-package-byte-scan.test.ts
- Create: tests/integration/probe-tarball.test.ts
- Create: tests/contract/status-claims.test.ts
- Modify: packages/workbench/build.mjs
- Modify: scripts/verify-package.mjs
- Modify: scripts/pack-dry.mjs
- Modify: scripts/workspace-boundary.ts
- Modify: package.json
- Modify: README.md
- Modify: SECURITY.md
- Modify: docs/compatibility.md
- Modify: packages/workbench/README.md
- Modify: packages/workbench/docs/compatibility.md
- Modify: packages/workbench/docs/privacy.md
- Modify: docs/ci.md
- Modify: docs/probe-results.md
- Generated outside Git after separate package-freeze authorization on a clean H0 commit: .tmp/dsh-pm-workbench/probe-packages/<sourceCommit>/<tgzSha256>/*.tgz
- Generated outside Git after separate package-freeze authorization on a clean H0 commit: .tmp/dsh-pm-workbench/probe-packages/<sourceCommit>/<tgzSha256>/package-manifest.json
- Generated outside Git after separate CLI-input authorization: .tmp/dsh-pm-workbench/gate-inputs/dsh-cli/<closureSha256>/{accepted.json,closure-manifest.json,artifact/**}
- Generated outside Git after separate ripple-input authorization: .tmp/dsh-pm-workbench/gate-inputs/ripple-theme/<tgzSha256>/{accepted.json,*.tgz}
- Generated outside Git after owner review: .tmp/dsh-pm-workbench/gate-inputs/gate-a-browser-download-policy.json
- Generated outside Git after separate bootstrap authorization: .tmp/dsh-pm-workbench/gate-inputs/gate-a-bootstrap/<bootstrapId>/{manifest.json,browsers/**,pnpm-store/**}
- Generated outside Git by a real Gate A′ attempt: .tmp/dsh-pm-workbench/gate-a/runs/<runId>/{result.json,report.md,junit.xml,run.final.json}
- Generated outside Git after a completed Gate A′ attempt: .tmp/dsh-pm-workbench/gate-a/current-run.json
- Generated outside Git under separate handoff authorization: <derivedHandoffRoot>/.dsh-pm-workbench-handoff-root
- Generated outside Git after human review and before promotion/evidence commit, in the derived owner-approved cross-worktree handoff root: dsh-pm-workbench/gate-a/<sourceCommit>/<runFinalSha256>/<handoffManifestSha256>/{handoff-manifest.json,evidence/**}

**Interfaces:**

- Produces: `npm run package:probe`; separately authorized `npm run gate:a:accept-cli-input` and `npm run gate:a:accept-ripple-input`; one privileged direct-Node `node scripts/gates/gate-a-bootstrap.mjs --bootstrap-decision-id …` entrypoint; offline `npm run gate:a` with port plus four explicit accepted-manifest arguments; `npm run gate:a:export` with the derived owner-approved handoff root; and `npm run gate:a:promote` bound to that exact handoff hash. The bootstrap wrapper reuses the accepted F0 policy fetcher/materializer unchanged and never invokes an outer npm script or Playwright's stock downloader. The gate writes one unique four-file result closure below `.tmp/dsh-pm-workbench/gate-a/runs/<runId>`; export writes one content-addressed cross-worktree closure after human review and before promotion/evidence commit.
- Consumes: a clean committed H0 source, exact lock, content-addressed audited Probe tgz, one fixed owner-reviewed browser-download policy plus its canonical bootstrap decision and immutable marker-owned bootstrap manifest, the accepted F0 policy-fetch/materialize source hashes, owner-selected and sealed rc.6 CLI closure, and the separately owner-accepted ripple manifest.

- [ ] **Step 1: Write RED package, runner, boundary, network, and closure tests**

Test that package/runner construction rejects:

~~~text
port 3080; host 0.0.0.0; non-empty trustedHosts
DSH_HOME outside the new marker-owned run or equal/nested under ~/.dsh
fixture/profile/arbitrary input path outside its fixed allowlist
shell=true, arbitrary command strings, npx/global fallback, missing or duplicate --target
inherited names matching token, auth, secret, password, credential, api-key, cookie, proxy, dsh, harness, deepseek, provider, NODE_OPTIONS, or npm config overrides
caller-supplied DSH_HOME/HOME/XDG/npm/pnpm/browser path
mutable HOME/XDG/npm cache/browser user-data outside the current run
PLAYWRIGHT_BROWSERS_PATH or pnpm offline store outside the exact read-only bootstrap manifest
missing/mismatched ownership marker, symlink, realpath escape, reuse, or partial input/output
unaccepted/PATH-resolved/global dsh CLI; wrong version; executable or dependency symlink escape; incomplete or mutable CLI dependency closure
missing or mismatched source commit, lock, tgz, package manifest, owner-reviewed browser-download policy, bootstrap origin/redirect observations, CLI acceptance/closure, ripple manifest, or owner decision
inherited PLAYWRIGHT_DOWNLOAD_HOST, PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST, another PLAYWRIGHT_* key, proxy/custom-CA override, an empty/wildcard/non-HTTPS/unreviewed origin policy, URL userinfo, HTTP downgrade, redirect loop/ceiling overflow, unlisted redirect, or any default/environment/discovered-host expansion
browser policy without one exact reviewed HTTPS archive URL, exact byte length and SHA-256, literal ZIP format, one archive root, one executable-relative path, exact tool/revision/platform/architecture, or a bootstrap decision bound to those same bytes
stock Playwright browser download, outer npm bootstrap, automatic redirect following, a response body consumed before exact URL/origin/status/Location validation, missing or mismatched Content-Length, or a partial archive/extraction/published browser tree
archive absolute/parent/backslash/NUL/duplicate or case/Unicode-normalization-colliding path, encrypted/sparse/overlapping/ambiguous entry, local-header/central-directory mismatch, symlink, hardlink, device/FIFO/socket, extra top-level root, escaping extraction, missing/non-regular executable, or any `/usr/bin/ditto` argv other than the fixed offline `-x -k` form
missing/reordered/extra Probe or ripple install, remove, re-add, restart/remount, or cleanup argv
partial/reordered/duplicate check IDs; zero collection; skipped/focused required test
manual PASS edit; final/child exit mismatch; stale current-run pointer
export before human review or from a dirty/non-source HEAD; promotion without the exact completed pointer and sealed handoff hash; report/ledger hash disagreement; handoff manifest that binds future promoted docs/evidence commit; partial/tampered/cross-run/symlinked handoff closure
absolute path, payload, quote, canary, token, cookie, stack, or local profile path in sanitized output
any non-loopback DNS/socket/HTTP/fetch/WebSocket or Chromium request after bootstrap
~~~

The Probe package test creates its own unique controlled package output; no test may depend on a pre-existing `lib/`, tgz, browser cache, or earlier command order. It verifies this exact archive allowlist plus only hash-enumerated chunks:

~~~text
package/package.json
package/cordis.patch.yml
package/README.md
package/LICENSE
package/docs/compatibility.md
package/docs/privacy.md
package/docs/third-party.md
package/lib/index.js
package/lib/client.js
package/lib/internal/probe-gate-test-harness.js
package/lib/chunks/**
package/lib/build-manifest.json
~~~

Reject source maps, test/runtime state, credentials, local paths, lifecycle scripts, undeclared files, escaping symlinks, Product endpoints, and fixture/interview content.

- [ ] **Step 2: Run RED**

~~~bash
node --test tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
npm test -- tests/integration/gate-a-command-plan.test.ts tests/integration/gate-a-cli-surface.test.ts tests/integration/gate-a-check-list.test.ts tests/integration/gate-a-compiled-seam.test.ts tests/integration/gate-a-profile-boundary.test.ts tests/integration/gate-a-bootstrap.test.ts tests/integration/gate-a-cli-input.test.ts tests/integration/gate-a-network-boundary.test.ts tests/integration/gate-a-run-closure.test.ts tests/integration/gate-a-redaction.test.ts tests/integration/gate-a-report.test.ts tests/integration/gate-a-export.test.ts tests/contract/probe-package-allowlist.test.ts tests/contract/probe-package-byte-scan.test.ts tests/integration/probe-tarball.test.ts tests/contract/status-claims.test.ts
~~~

Expected: the two accepted dependency-free shared bootstrap tests PASS unchanged first; the H0 Vitest command then FAILS because the runner, package, direct-Node bootstrap wrapper, production-entry redirect/materialization boundary, network, closure, and status contracts do not exist. `gate-a-bootstrap.test.ts` must reach the real phase wrapper with local redirect fixtures and fail until that wrapper uses the inherited policy fetcher and materializer; a helper-only mock is not sufficient. A changed/failing inherited test or zero collected H0 tests is a failed RED run.

- [ ] **Step 3: Implement safe process and network boundaries**

Use `spawn`/`execFile` with `shell: false`, fixed executable-plus-argv arrays, an exact working directory, bounded and sanitized output, per-stage deadlines, process-group cleanup, and no arbitrary command string. Strip every inherited DSH/Harness/provider/credential/auth/token/cookie/proxy/npm-config/Node-option value, then inject exactly one runner-generated, realpath-checked `DSH_HOME`.

Every mutable `HOME`, `TMPDIR`, XDG directory, npm cache, browser user-data directory, and temporary profile path is a marker-owned child of the new run. The pnpm offline store and `PLAYWRIGHT_BROWSERS_PATH` are the exact read-only directories named and hashed by the immutable bootstrap manifest; they may live under `.tmp/dsh-pm-workbench/gate-inputs/gate-a-bootstrap/<bootstrapId>`, never under user home. The runner validates `lstat`, realpath containment, marker identity, manifest hashes, and read-only use before launch.

After an authorized bootstrap finishes, `deny-external-network.mjs` preloads guards for dns, dgram, net, tls, http, https, global fetch, and WebSocket and permits only numeric loopback destinations needed by the fixed run. Chromium uses resolver/direct-proxy and background-networking flags plus a route that rejects every request except the exact `http://127.0.0.1:3186/` origin. A network attempt is recorded as FAIL; the gate never retries with network enabled.

- [ ] **Step 4: Implement content-addressed Probe packaging**

`scripts/package-probe.mjs` requires an explicit canonical package-freeze authorization ID and an empty tracked/untracked status, records full HEAD and lock hash, invokes the builder with exactly one `probe` target, invokes the recorded npm CLI with fixed `pack --ignore-scripts` semantics and `shell: false`, computes the tgz hash, and moves it once into `.tmp/dsh-pm-workbench/probe-packages/<sourceCommit>/<tgzSha256>/`. It writes `package-manifest.json` last with the authorization ID, source/lock/build/tgz/file hashes, exact archive entries, modes, package identity, and audit outcome. Exclusive creation, ownership markers, `lstat`/realpath/no-follow checks, and immutable revalidation prevent reuse or symlink substitution. A conflicting or partial existing directory fails; `pack:dry` remains preview only.

The target-aware `tarball-audit.mjs` implements the exact allowlist/byte/mode/license/script scans shared later by Product packaging. `verify-package.mjs` requires the unexported Probe seam in the Probe metafile/tgz and rejects it in a Product target. The seam imports the same production dispatcher, transports, admission limiters, service, receipt logic, and repository codec as `lib/index.js`, proven through sanitized graph edges; it is unreachable from RPC, config, exports, or UI.

At this uncommitted Task 8 point, tests exercise controlled archives and assert `package:probe` refuses a dirty tree. The real tgz is created only from Task 9's new clean commit.

- [ ] **Step 5: Implement immutable bootstrap and frozen rc.6 command graph**

Add these exact package scripts; tests assert both the keys and command strings, so a documented command cannot silently be absent from `package.json`. The privileged bootstrap is deliberately absent from `scripts`: its only production command is the direct Node entrypoint defined below, and command-plan tests reject a `gate:a:bootstrap` npm script, `npm exec`, `npx`, or Playwright download command.

~~~json
{
  "scripts": {
    "package:probe": "node scripts/package-probe.mjs",
    "gate:a:accept-cli-input": "node scripts/gates/accept-dsh-cli-input.mjs",
    "gate:a:accept-ripple-input": "node scripts/gates/accept-ripple-input.mjs",
    "gate:a": "node scripts/gates/gate-a.mjs",
    "gate:a:promote": "node scripts/gates/promote-evidence.mjs",
    "gate:a:export": "node scripts/gates/export-gate-a-evidence.mjs"
  }
}
~~~

`accept-dsh-cli-input.mjs` runs before bootstrap and only after a separate owner decision names one rc.6 CLI artifact. The accepted source must contain a regular CLI entry, its nearest package manifest with exact version `0.1.0-rc.6`, an exact package-manager lock, and the installed runtime dependency graph described by that lock; PATH lookup, a global-name fallback, any active checkout, a source checkout without a frozen graph, and an archive that needs an unrecorded fetch are rejected. The script validates every package name/version/integrity edge, resolves internal symlinks without permitting an escape, copies the entry and complete locked runtime closure into a newly created staging directory, normalizes internal links, and hashes every regular file and mode. It executes only the staged hash-verified entry with `--version` under a fresh filtered environment and requires the exact normalized rc.6 result before atomically sealing the directory at `.tmp/dsh-pm-workbench/gate-inputs/dsh-cli/<closureSha256>/`. `closure-manifest.json` records canonical sorted package/file edges, source artifact hash, lock hash, entry hash, Node identity, npm/pnpm identity when present, owner decision ID, and a path-free provenance label; `accepted.json` is the final file in the atomically published closure and binds its hash, `activeProfileTouched: false`, and the single `--version` observation. Tests reject an omitted transitive dependency, undeclared file, mutable or partial directory, wrong version, changed lock, link escape, absolute-path leakage, or manifest that cannot independently recompute the closure digest.

`gate-a-bootstrap.mjs` runs only after separate network/download authorization and only consumes a valid accepted CLI closure; it never resolves a local or PATH `dsh`. Before authorization, the owner reviews exactly one fixed non-Git `.tmp/dsh-pm-workbench/gate-inputs/gate-a-browser-download-policy.json`. Its canonical bytes bind one exact HTTPS archive URL; one ordered, non-empty, closed set of owner-confirmed official HTTPS origins allowed for the initial request and redirects; a finite redirect ceiling; exact archive SHA-256 and byte length; literal ZIP archive format; exactly one expected archive-root name and one executable-relative path beneath that root; exact Playwright tool version, Chromium revision, platform, and architecture. The plan deliberately does not guess the URL or origins. URL/origin entries have no wildcard, userinfo, IP-literal/private/loopback target, or downgrade. The bootstrap decision binds the already reviewed policy SHA-256 and every one of those fields, plus source/lock/Probe/CLI/ripple inputs and the output root. The wrapper requires `--bootstrap-decision-id <canonical-id>` and the three accepted-manifest arguments, accepts no policy path, URL, host, archive, output, transport, CA, or redirect override, and cannot merge an internal default, environment value, or redirect-discovered host.

The H0 wrapper imports the accepted F0 `scripts/bootstrap/policy-fetch.mjs` and `scripts/bootstrap/materialize-browser.mjs` unchanged and verifies their accepted source hashes before any request. It does not invoke Playwright's `install chromium`, an outer npm command, `npm exec`, or `npx`. `policy-fetch.mjs` uses Node's HTTPS client with automatic redirects disabled. It validates the exact initial URL before opening the request; for every response it pauses without registering a body consumer, validates status plus the current exact URL/origin, and, for a redirect, parses and validates `Location`, the next exact HTTPS origin, no userinfo/downgrade/loop, and the remaining ceiling before destroying the redirect response and issuing the next request. Only a final allowed `200` whose literal `Content-Length` equals the reviewed byte length may stream into one exclusively created marker-owned temporary archive. It counts bytes while streaming, rejects early/extra bytes, hashes the single read, and requires the exact reviewed archive SHA-256 before materialization. A denied response is destroyed before a data listener or file write is attached. The fetcher records the exact observed initial/redirect chain but never records authorization prose, a local absolute path, or response bodies.

`materialize-browser.mjs` accepts only the live exclusive no-follow archive descriptor and immutable device/inode/hash receipt returned by the inherited fetcher; it never reopens a caller-controlled pathname. From that same descriptor it parses and cross-checks every ZIP central-directory record and corresponding local header with Node built-ins, including canonical filename bytes, flags, compression, CRC, sizes, offset, and non-overlapping data interval. It reads/decompresses each supported regular-file interval from the same descriptor, verifies CRC and uncompressed size, and records an entry content SHA-256. It rejects an absolute, parent-traversing, backslash, NUL, empty, duplicate, case/Unicode-normalization-colliding, or otherwise non-canonical entry; an encrypted, data-descriptor, ZIP64, multi-disk, sparse, truncated, overlapping, ambiguous, unexplained-trailing-data, unsupported-compression, or local-header/central-directory-mismatched entry; symlink, hardlink, device, FIFO, socket or other special mode; more than the one reviewed top-level root; and any entry outside that root. After revalidating descriptor identity/hash it unlinks and verifies absence of the temporary name, rewinds the retained descriptor, maps it to child fd 3, and invokes literal `/usr/bin/ditto` through `spawn` with fixed `['-x', '-k', '/dev/fd/3', <exclusive-staging-directory>]`, explicit fd-3 stdio inheritance, `shell: false`, a minimal sanitized environment, bounded output, and no network-capable child. A production-entry synthetic ZIP capability test must first prove the accepted Darwin and exact `/usr/bin/ditto` identity can consume that fd-3 binding; failure is unsupported/INCONCLUSIVE, never a pathname or PATH fallback. A complete post-extraction `lstat`/no-follow walk must equal the preflight path/type/mode/size inventory, contain only directories and single-link regular files beneath the real staging root, contain exactly the reviewed archive root, find the reviewed executable-relative path as a regular executable file, and match every extracted regular-file SHA-256 to its preflight entry digest. The materializer atomically publishes only that tree below `browsers/` and removes the extraction staging before `manifest.json`; neither archive name nor staging is a retained bootstrap output. Descriptor drift, entry-content drift, traversal, link/special entry, extra root, output escape, cleanup ambiguity, tree/hash drift, or an existing destination fails before publication and never yields a manifest.

The wrapper revalidates exact local `@playwright/test@1.62.1`, the audited Probe package manifest, accepted CLI and ripple manifests, and every fixed offline-install dependency. It seeds `pnpm-store/**` only from hash-bound already accepted offline inputs; missing dependency bytes are INCONCLUSIVE and cannot trigger an additional registry request in this browser-bootstrap command. It constructs fresh marker-owned HOME/XDG/npm paths plus distinct empty `NPM_CONFIG_USERCONFIG`/`NPM_CONFIG_GLOBALCONFIG`, strips every inherited npm configuration, every case-insensitive `PLAYWRIGHT_*` key, HTTP/HTTPS/ALL/NO proxy variants, `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`, `SSL_CERT_DIR`, credential/provider variables, and `NODE_OPTIONS`, and supplies no custom CA in production. It atomically publishes one new `.tmp/dsh-pm-workbench/gate-inputs/gate-a-bootstrap/<bootstrapId>/` containing exactly `browsers/**`, `pnpm-store/**`, and final-written `manifest.json`. The manifest binds the bootstrap decision ID and its scope; exact policy bytes/hash and every policy field; observed redirect chain; inherited F0 fetcher/materializer source hashes; source commit, lock, Probe tgz, CLI closure, ripple, F0 config receipt, dsh/npm/pnpm/Playwright/Chromium identities; browser executable and complete browser/store tree hashes; sanitized-environment receipt; fixed ditto identity/argv; and zero active-profile access. Gate A `result.json`, sanitized report, JUnit, and `run.final.json` carry the same bootstrap decision ID and manifest hash. Any missing or drifting field is INCONCLUSIVE; nothing is fetched during Gate A′ and the policy is never widened.

`gate-a-bootstrap.test.ts` starts local redirect fixtures and exercises the actual exported H0 wrapper entry with constructor-only test HTTPS/CA and origin-classification ports; those ports are unavailable to the CLI parser, environment, production export, or Gate A runner. It verifies the production command still selects the built-in HTTPS adapter and rejects every test-only selector. Through the same policy parser/fetch/materialize path, it covers allowed multi-hop transfer, unlisted origin, downgrade, userinfo, loop, ceiling overflow, redirect body, wrong/missing length, hash drift, truncated/extra body, malicious ZIP paths/modes/roots, case/Unicode collisions, encrypted/data-descriptor/ZIP64/multi-disk/sparse/truncated/overlapping/ambiguous/unexplained-tail records, local-header/central-directory disagreement, and ditto/post-extraction drift. Each denied redirect must show zero body bytes consumed and zero archive/browser publication. The test may use only generated synthetic bytes and local loopback fixtures; it never downloads Chromium. `gate-a-command-plan.test.ts` fixes the direct privileged argv and proves no stock Playwright downloader or outer npm bootstrap path remains.

`gate-a-cli.mjs` copies the sealed CLI closure into the current run, recomputes it, and invokes only its recorded regular Node entry through `process.execPath`; it never resolves PATH, a global install, the implementation worktree's `node_modules`, or the owner-selected source again. The fixed chronological command graph below is exhaustive. Angle-bracketed tokens are not caller-controlled command text: each is replaced only with the already hash-bound run copy or exact package name from an accepted manifest. Every `web` process reaches the exact loopback listener and shell-readiness condition before its check phase, then the runner applies bounded SIGTERM/process-group cleanup and proves port 3186 has no listener before the next numbered command.

~~~text
01 Node + sealed dsh entry: --version
02 Node + sealed dsh entry: plugin --profile web add <run-copy-of-probe-tgz> --offline --ignore-scripts
03 Node + sealed dsh entry: plugin --profile web add <run-copy-of-ripple-tgz> --offline --ignore-scripts
04 Node + sealed dsh entry: web --host 127.0.0.1 --port 3186
05 Node + sealed dsh entry: plugin --profile web remove @knight/dsh-pm-workbench --offline --ignore-scripts
06 Node + sealed dsh entry: web --host 127.0.0.1 --port 3186
07 Node + sealed dsh entry: plugin --profile web add <same-run-copy-of-probe-tgz> --offline --ignore-scripts
08 Node + sealed dsh entry: web --host 127.0.0.1 --port 3186
09 Node + sealed dsh entry: plugin --profile web remove <accepted-ripple-package-name> --offline --ignore-scripts
10 Node + sealed dsh entry: web --host 127.0.0.1 --port 3186
11 Node + sealed dsh entry: plugin --profile web add <same-run-copy-of-ripple-tgz> --offline --ignore-scripts
12 Node + sealed dsh entry: web --host 127.0.0.1 --port 3186
13 Node + sealed dsh entry: plugin --profile web remove @knight/dsh-pm-workbench --offline --ignore-scripts
14 Node + sealed dsh entry: web --host 127.0.0.1 --port 3186
15 Node + sealed dsh entry: plugin --profile web add <same-run-copy-of-probe-tgz> --offline --ignore-scripts
16 Node + sealed dsh entry: web --host 127.0.0.1 --port 3186
17 Node + sealed dsh entry: plugin --profile web remove @knight/dsh-pm-workbench --offline --ignore-scripts
18 Node + sealed dsh entry: plugin --profile web remove <accepted-ripple-package-name> --offline --ignore-scripts
19 Node + sealed dsh entry: web --host 127.0.0.1 --port 3186
~~~

Commands 05–08 prove the real public Workbench remove/re-add plus restart/remount sequence for A15; they do not claim an installed-but-disabled state. Commands 09–12 prove the accepted ripple's real remove/re-add lifecycle and renewed coexistence for A17. Commands 13–14 prove Workbench remove/restart while the ripple and synthetic chat sentinel remain for A18; commands 15–16 prove same-tgz reinstall and sentinel readback for A19. Commands 17–19 are mandatory cleanup and prove both plugins absent from the isolated profile before final process shutdown. Any missing, reordered, repeated, substituted, or extra command, a bundle-list mismatch after any mutation, or residual listener/profile process yields FAIL or INCONCLUSIVE; cleanup is attempted in a parent `finally` path even after an earlier failure and its observed outcome is retained. Component-level lifecycle tests may exercise Cordis disposer/remount hooks, but Gate A′ records only the concrete public CLI operations above and never relabels remove/re-add as disable/enable.

Preflight recomputes repository/profile realpaths and markers; port/bind/trusted-host plan; clean source/lock; audited package manifest and tgz; accepted CLI manifest/closure/owner decision; owner-reviewed browser-policy bytes/hash plus bootstrap manifest/origin chain/tree; accepted ripple manifest/tgz/owner decision; F0 config-binding receipt; Node, npm, pnpm, Playwright, Chromium, OS, and architecture. It never probes port 3080 and records only normalized versions, hashes, relative paths, safe booleans, and opaque IDs.

- [ ] **Step 6: Define the deterministic seam and A01–A22 evidence classes**

The extracted tgz seam injects only runner-owned barriers at Client pre-send, Host pre-service, queued-before-project-lock, queued-before-catalog, and commit-start, plus malformed Host output, canary failure, receipt saturation, and 8/16 admission pressure. It proves Client request 9 waits locally and may abort with no Host call; direct Host request 17 returns fixed outer `internal` before service with zero side effect. Constructor seams are Probe-only and Product packaging later rejects their modules and strings.

Gate A′ result schema contains immutable ordered IDs A01–A22 from specification §10.2. Each ID declares `REAL_TGZ_RUNTIME`, `REAL_BROWSER`, `EXTRACTED_TGZ_SEAM`, or their required conjunction. Static/unit evidence cannot satisfy runtime/browser evidence. Missing, timed-out, skipped, mismatched, or unobservable items are INCONCLUSIVE. Overall state is derived; no input can set PASS.

- [ ] **Step 7: Freeze the independently reviewed ripple input**

`accept-ripple-input.mjs` accepts only an owner-selected standalone theme tgz after a separate authorization. It requires a non-symlink regular file, realpath outside active profiles, one read of exact bytes, a valid package identity, and no URL/profile directory. It copies once into `.tmp/dsh-pm-workbench/gate-inputs/ripple-theme/<tgzSha256>/` and writes `accepted.json` last with exact tgz SHA-256, package name/version, source commit or provenance, canonical owner decision ID, and `activeInstallationTouched: false`.

Every Gate A `result.json`, `report.md`, and `run.final.json` binds `rippleAcceptanceManifestSha256`, `rippleTgzSha256`, and `ownerDecisionId`. If the manifest/artifact is missing, changes, or disagrees with the owner decision, A17 is INCONCLUSIVE and Gate A′ is No-Go. The gate copies the verified tgz into its run only after the runtime authorization and never reads or changes the active theme.

- [ ] **Step 8: Implement a parent-observed four-file closure, sealed handoff export, and deterministic promotion**

The child writes `result.json`, sanitized `report.md`, and `junit.xml` atomically for PASS, FAIL, and recoverable INCONCLUSIVE attempts. The parent observes the child's actual exit status and atomically writes `run.final.json` last with run ID; source/lock, package-freeze decision, tgz/package, CLI acceptance/closure/owner decision, browser-policy hash/origin allowlist/observed chain, bootstrap decision/manifest, F0 config-binding receipt, ripple/owner decision, and runtime-decision identities; derived overall state; actual exit code; and SHA-256 of the first three files. All four files carry the identical bootstrap decision ID and bootstrap-manifest hash. Missing output, hash disagreement, decision mismatch, mismatched exit semantics, interrupted child, or final marker not written last is INCONCLUSIVE.

Only after verifying that complete closure does the parent atomically update `.tmp/dsh-pm-workbench/gate-a/current-run.json` with the run ID and `run.final.json` hash. The promoter accepts only that exact pointer, revalidates every bound identity, and never searches by mtime or “latest.” A new attempt uses a collision-resistant ID and exclusive directory; no run is overwritten.

`export-gate-a-evidence.mjs` is the only cross-worktree exporter. It runs after human sanitization review but before promotion or the evidence commit, from an otherwise clean frozen source worktree, and accepts one explicit owner-approved absolute handoff root only as an equality assertion. It computes `commonDirRealpath = realpath(git rev-parse --path-format=absolute --git-common-dir)`, rejects a bare repository, sets `primaryCheckout = realpath(dirname(commonDirRealpath))`, and requires that checkout to occur exactly once in two byte-identical reads of `git worktree list --porcelain -z` after every listed worktree path is resolved. It then computes `familyId = sha256(UTF8(commonDirRealpath))` and `derivedRoot = <parent-of-primaryCheckout>/.dsh-pm-workbench-handoffs/<familyId>`. The supplied root must equal that canonical path, be disjoint in both directions from every enumerated checkout, and have no symlink component. Under the export decision the script may exclusively create an absent root through a real existing parent and write `.dsh-pm-workbench-handoff-root` binding the path-free `familyId`, or reuse only a byte-identical marker-owned root. It revalidates `current-run.json`; the four-file raw closure; accepted Probe, CLI, bootstrap, and ripple manifests/artifacts; the frozen source commit; and the exact sanitization plus export decisions. The sanitization record must directly contain matching `sourceCommit`, `runId`, `runFinalSha256`, `reportSha256`, and accepted `sanitizationOutcome`; a final hash alone is not a substitute. It copies only the four raw closure files, content-addressed Probe tgz/package manifest, accepted ripple tgz/manifest, the accepted CLI manifest and complete sealed artifact/dependency closure, and bootstrap manifest into a new staging directory. It deliberately excludes the not-yet-created promoted report and canonical ledger, as well as the bootstrap browser/store payload, profile, browser user data, screenshots, traces, and non-allowlisted raw logs. It writes canonical `handoff-manifest.json` last with exact relative-path/mode/SHA-256 entries, all owner decision IDs, the five sanitization fields, path-free `familyId`, frozen source commit, `runId`, and `runFinalSha256`, then atomically renames to `dsh-pm-workbench/gate-a/<sourceCommit>/<runFinalSha256>/<handoffManifestSha256>/`. H1 derives the same shared root from the same Git object and worktree-list rules and selects this exact directory by the manifest hash later committed in Gate A′ evidence, never by mtime, caller-selected arbitrary path, or a repository-local `.tmp` path. Tests reconstruct every hash from the carried bytes and reject a bare repository, primary-checkout/worktree-list ambiguity or drift, a partial write, export before human review, export from a dirty or non-source HEAD, wrong/family-mismatched root, marker mismatch, checkout overlap, duplicate/conflicting destination, extra file, symlink, path escape, changed mode, tamper, cross-run mix, non-allowlisted raw log/profile/browser data, an indirect-only/mismatched/rejected sanitization decision, or a manifest that references rather than carries required evidence.

`promote-evidence.mjs` is the only raw-to-Git copier and has a closed mode grammar. Read-only `--preview` holds the pointer lock, revalidates the exact derived handoff and closure, renders twice in memory, writes nothing, and returns only the fixed two path/SHA-256 pairs plus `candidateSetSha256`. A separate evidence-write decision must bind the frozen source, `runId`, `runFinalSha256`, `reportSha256`, accepted `sanitizationOutcome`, sanitization decision, exact handoff hash, both candidate byte hashes and candidate-set hash, fixed two-document allowlist, and intended evidence commit message. Write mode requires that candidate-set assertion and decision, reads `current-run.json`, accepts only the exact derived handoff root and `handoffManifestSha256`, then revalidates the handoff manifest, every carried byte, the four-file closure, all five direct sanitization fields, and all source/lock/Probe/CLI/bootstrap/ripple bindings. Only after that closure passes may it write exactly `docs/gate-results/gate-a-connection-rpc.md` and one append-only run-ID block in `docs/probe-results.md`; both documents bind the handoff manifest hash, export decision ID, evidence-write decision ID, and sanitized-report identity/outcome. It then finalizes one immutable promotion receipt outside Git that binds pointer/closure/decision/renderer identities and both path hashes. `--check`, `--verify-index`, and `--verify-commit <40-lowercase-hex>` require the exact promotion-receipt hash and respectively rerender without writing, hash the staged blobs, or hash the exact commit-object blobs and verify one-parent/two-path topology. It never writes package documentation or mutates the sealed handoff. Tests require the two generated documents to be a deterministic rendering of the same sealed source and handoff, reject duplicate run IDs, stale/cross-run pointers, an unsealed or mismatched handoff, missing or scope-mismatched evidence authorization, candidate/receipt/index/commit byte drift, an indirect-only/mismatched/rejected sanitization decision, manual PASS edits, path/canary leakage, or any source-code change, and prove a second rendering is byte-identical.

- [ ] **Step 9: Freeze build-time package status and root canonical-ledger semantics**

Root and packed documentation must say precisely: the Probe implementation/package pipeline exists and static tests passed, while real Harness load, Connection round trip, browser mounting, persistence lifecycle, and Gate A′ remain NOT_RUN until the separate runtime gate. It must still call the repository private, unofficial, UNLICENSED, synthetic-counter-only, and unsuitable for real interview data. The three package documents under `packages/workbench` are immutable build-time statements sealed into the tgz: they keep Gate A′ as `NOT_RUN` even after a later gate and may never be rewritten by promotion. `docs/probe-results.md` is the root canonical post-run ledger; before Gate A′ it contains only the defined empty/not-run state, and after Gate A′ only `gate:a:promote` may append a recomputable run block after validating the exact sealed handoff. The Gate A report and ledger must contain the same `handoffManifestSha256`, `familyId`, and export-decision identity. `status-claims.test.ts` verifies both phases and rejects “compatible,” “installed,” “passed Gate A′,” or PM workflow claims from package docs or from root docs without a promoted closure and handoff-hash agreement.

- [ ] **Step 10: Run GREEN without starting Harness or downloading**

~~~bash
node --test tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
npm test -- tests/integration/gate-a-command-plan.test.ts tests/integration/gate-a-cli-surface.test.ts tests/integration/gate-a-check-list.test.ts tests/integration/gate-a-compiled-seam.test.ts tests/integration/gate-a-profile-boundary.test.ts tests/integration/gate-a-bootstrap.test.ts tests/integration/gate-a-cli-input.test.ts tests/integration/gate-a-network-boundary.test.ts tests/integration/gate-a-run-closure.test.ts tests/integration/gate-a-redaction.test.ts tests/integration/gate-a-report.test.ts tests/integration/gate-a-export.test.ts tests/contract/probe-package-allowlist.test.ts tests/contract/probe-package-byte-scan.test.ts tests/integration/probe-tarball.test.ts tests/contract/status-claims.test.ts
npm run check
npm run build -- --target probe
npm run verify:package -- --target probe
npm run pack:dry -- --target probe
~~~

Expected: all named static/helper tests pass; the exact six listed package scripts exist; the privileged direct-Node bootstrap grammar is fixed and no bootstrap package script exists; the package integration test owns any temporary build it reads; `package:probe` still refuses the dirty tree; and CLI/ripple acceptance, direct bootstrap, promotion, export, and Gate A′ are exercised only against test fixtures. No Harness, real browser download, package bootstrap, model, provider, profile mutation, or non-loopback network starts.

- [ ] **Step 11: Commit source and pre-gate status, not generated artifacts**

~~~bash
git add -- scripts/gates/shared/command.mjs scripts/gates/shared/profile-boundary.mjs scripts/gates/shared/redact.mjs scripts/gates/shared/result-schema.mjs scripts/gates/shared/report.mjs scripts/gates/shared/tarball-audit.mjs scripts/gates/shared/deny-external-network.mjs scripts/gates/gate-a.mjs scripts/gates/gate-a-cli.mjs scripts/gates/gate-a-browser.mjs scripts/gates/gate-a-checks.mjs scripts/gates/gate-a-bootstrap.mjs scripts/gates/accept-dsh-cli-input.mjs scripts/gates/accept-ripple-input.mjs scripts/gates/promote-evidence.mjs scripts/gates/export-gate-a-evidence.mjs scripts/package-probe.mjs packages/workbench/src/integration/harness-rc6/probe/gate-test-harness.ts packages/workbench/build.mjs scripts/verify-package.mjs scripts/pack-dry.mjs scripts/workspace-boundary.ts package.json README.md SECURITY.md docs/compatibility.md packages/workbench/README.md packages/workbench/docs/compatibility.md packages/workbench/docs/privacy.md docs/ci.md docs/probe-results.md tests/integration/gate-a-command-plan.test.ts tests/integration/gate-a-cli-surface.test.ts tests/integration/gate-a-check-list.test.ts tests/integration/gate-a-compiled-seam.test.ts tests/integration/gate-a-profile-boundary.test.ts tests/integration/gate-a-bootstrap.test.ts tests/integration/gate-a-cli-input.test.ts tests/integration/gate-a-network-boundary.test.ts tests/integration/gate-a-run-closure.test.ts tests/integration/gate-a-redaction.test.ts tests/integration/gate-a-report.test.ts tests/integration/gate-a-export.test.ts tests/contract/probe-package-allowlist.test.ts tests/contract/probe-package-byte-scan.test.ts tests/integration/probe-tarball.test.ts tests/contract/status-claims.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "test: close the Probe package and Gate A prime runner"
~~~

Do not stage `lib`, tgz files, bootstrap inputs, profiles, logs, or `.tmp`.

### Task 9: Freeze the H0 code candidate

**Files:**

- Modify only if static checks expose a defect: files owned by Tasks 1–8.
- Do not create a gate report in this task.

**Interfaces:**

- Produces: one clean immutable source commit eligible for a separately authorized runtime gate.

- [ ] **Step 1: Run the complete static suite**

~~~bash
npm run check
npm run build -- --target probe
npm run verify:package -- --target probe
npm run pack:dry -- --target probe
npm test -- tests/integration/worktree-dependency-boundary.test.ts tests/integration/standalone-copy.test.ts
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
git diff --check
~~~

This is the final pre-gate rerun of both Host and Client public-surface projects. `standalone-copy.test.ts` must copy and execute both configs inside its isolated dependency root; a missing config, skipped compiler, parent resolution, or source-worktree resolution is a failure even when the direct commands pass.

- [ ] **Step 2: Audit the dry package**

Assert the Probe dry preview contains only the allowlisted Host/Client files plus `lib/internal/probe-gate-test-harness.js`. It contains no test source, `.tmp`, profile, database, credential, browser artifact, local path, Product registry, real data, postinstall, or dynamic phase switch. The verifier proves the internal seam is not exported or RPC/UI/config reachable. Dry-run output is not the real tgz and cannot satisfy Gate A′.

- [ ] **Step 3: Commit any repair before freezing**

If Steps 1–2 expose a defect, add only the exact repaired paths listed by the owning task, run `git diff --cached --check`, verify the staged-name allowlist, commit the repair, and repeat Steps 1–2 from the new commit. Never run Gate A′ against an uncommitted fix.

- [ ] **Step 4: Freeze and record identity**

~~~bash
git status --short
git rev-parse HEAD
shasum -a 256 package-lock.json
~~~

Expected: clean status and stable hashes. Record the exact 40-lowercase-hex `git rev-parse HEAD` output as `DSH_PMWB_H0_FROZEN_SOURCE_COMMIT`; it is an equality assertion for all later package, run, handoff, promotion, and post-commit topology checks, never a moving ref. Do not amend or rebase this commit after Gate execution. If any code changes later, freeze a new candidate and invalidate old evidence.

- [ ] **Step 5: Obtain a separate Probe package-freeze authorization**

The H0 implementation, dependency, bootstrap, CLI-input, ripple-input, and runtime authorizations do not grant this step. Ask the owner to authorize exactly one local, package-only operation from the frozen clean commit: run the audited build plus `npm pack --ignore-scripts` pipeline and write a content-addressed Probe tgz/package manifest under this repository's marker-owned ignored `.tmp`. This authorization permits no Harness start, browser start/download, plugin install/remove, profile mutation, network access, publish, model/provider call, or source/lock mutation. Record its canonical decision ID in `package-manifest.json`; without it, stop before the first real tgz is built.

- [ ] **Step 6: Build and independently audit the real Probe tgz from the frozen commit**

~~~bash
git status --porcelain=v1 --untracked-files=all
npm run package:probe -- --authorization-id "$DSH_PMWB_PACKAGE_FREEZE_DECISION_ID"
npm test -- tests/integration/probe-tarball.test.ts
git status --porcelain=v1 --untracked-files=all
~~~

Both status commands must print nothing because generated artifacts are ignored. Select only the content-addressed manifest printed by `package:probe`; recompute its package-freeze decision ID, source/lock/tgz/file hashes, exact allowlist, and immutable directory identity. The integration test rebuilds or extracts inside its own unique temporary root and cannot pass because an old `lib` or tgz happens to exist. Any repair requires a new commit, a new package-freeze decision, and repetition of Tasks 9.1–9.6.

### Task 10: Run Gate A′ only after separate runtime authorization

**Files:**

- Generated outside Git after separate input authorizations: .tmp/dsh-pm-workbench/gate-inputs/dsh-cli/<closureSha256>/{accepted.json,closure-manifest.json,artifact/**}
- Generated outside Git after separate input authorizations: .tmp/dsh-pm-workbench/gate-inputs/ripple-theme/<tgzSha256>/{accepted.json,*.tgz}
- Generated outside Git after separate bootstrap authorization: .tmp/dsh-pm-workbench/gate-inputs/gate-a-bootstrap/<bootstrapId>/{manifest.json,browsers/**,pnpm-store/**}
- Generated outside Git: .tmp/dsh-pm-workbench/gate-a/runs/<runId>/result.json
- Generated outside Git: .tmp/dsh-pm-workbench/gate-a/runs/<runId>/report.md
- Generated outside Git: .tmp/dsh-pm-workbench/gate-a/runs/<runId>/junit.xml
- Generated outside Git: .tmp/dsh-pm-workbench/gate-a/runs/<runId>/run.final.json
- Generated outside Git: .tmp/dsh-pm-workbench/gate-a/runs/<runId>/inputs/*.tgz
- Generated outside Git: .tmp/dsh-pm-workbench/gate-a/current-run.json
- Generated outside Git while updating, promoting, or verifying the pointer: .tmp/dsh-pm-workbench/gate-a/current-run.lock
- Generated outside Git after authorized promotion: .tmp/dsh-pm-workbench/gate-a/promotion-receipts/<candidateSetSha256>/promotion-receipt.json
- Generated outside Git after owner review: .tmp/dsh-pm-workbench/gate-inputs/gate-a-browser-download-policy.json
- Create after human sanitization and sealed export: docs/gate-results/gate-a-connection-rpc.md
- Modify after human sanitization and sealed export: docs/probe-results.md
- Generated outside Git under separate handoff authorization: <derivedHandoffRoot>/.dsh-pm-workbench-handoff-root
- Generated outside Git after human sanitization and before promotion/evidence commit, in the derived owner-approved handoff root: dsh-pm-workbench/gate-a/<sourceCommit>/<runFinalSha256>/<handoffManifestSha256>/{handoff-manifest.json,evidence/**}

**Interfaces:**

- Consumes: frozen H0 commit, exact lock, content-addressed audited Probe tgz/package manifest, immutable accepted rc.6 CLI closure, fixed owner-reviewed browser-download policy plus canonical bootstrap decision and immutable bootstrap manifest, accepted F0 policy-fetch/materialize source hashes, owner-accepted ripple manifest, and a new isolated profile.
- Produces: observed Gate A′ PASS, FAIL, or INCONCLUSIVE run evidence, one content-addressed cross-worktree handoff sealed before promotion, and deterministic Git evidence whose report and canonical ledger bind the same handoff manifest hash.

- [ ] **Step 1: Accept and seal the owner-selected rc.6 CLI and ripple artifacts under separate decisions**

Set each quoted variable below only from the corresponding recorded owner decision. Each script rejects an unset/empty value, non-canonical path, unapproved decision ID, URL, symlink escape, active-profile path, or identity mismatch:

~~~bash
npm run gate:a:accept-cli-input -- --entry "$DSH_PMWB_APPROVED_CLI_ENTRY" --owner-decision-id "$DSH_PMWB_CLI_DECISION_ID"
npm run gate:a:accept-ripple-input -- --source "$DSH_PMWB_APPROVED_RIPPLE_TGZ" --owner-decision-id "$DSH_PMWB_RIPPLE_DECISION_ID"
~~~

CLI acceptance authorizes only immutable local inspection, one filtered `--version`, and content-addressed copying of the complete locked runtime dependency closure; it does not authorize a Harness launch, profile mutation, network, or PATH/global discovery. Ripple acceptance authorizes only immutable local inspection and copying. Record the exact accepted manifest paths and hashes for bootstrap and Gate A′; never select an acceptance directory by mtime or “latest.”

- [ ] **Step 2: Review the fixed browser policy, then create the immutable Gate A bootstrap only if separately approved and absent**

Before requesting bootstrap authorization, create no browser artifact. Have the owner review and freeze the exact bytes of the fixed browser-download policy from Task 8 and independently recompute its SHA-256. The later authorization must bind that hash; the exact reviewed HTTPS archive URL; exact allowed origin/redirect list and ceiling; archive SHA-256, byte length, literal ZIP format, archive root, and executable-relative path; Playwright tool/Chromium revision/platform/architecture; the three accepted input manifests; inherited F0 fetcher/materializer hashes; and the output root. Do not guess or derive a URL from the Playwright package at execution time.

~~~bash
node scripts/gates/gate-a-bootstrap.mjs --bootstrap-decision-id "$DSH_PMWB_BOOTSTRAP_DECISION_ID" --probe-package-manifest "$DSH_PMWB_PROBE_MANIFEST" --cli-acceptance "$DSH_PMWB_CLI_ACCEPTANCE" --ripple-acceptance "$DSH_PMWB_RIPPLE_ACCEPTANCE"
~~~

This separately authorized direct-Node network step consumes the explicitly recorded Probe, CLI, ripple, reviewed-policy, bootstrap-decision, and inherited fetcher/materializer identities. It manually follows only policy-allowed HTTPS redirects, verifies exact archive length/hash before the fixed offline `/usr/bin/ditto -x -k` materialization, creates a new content-addressed marker-owned `browsers/**` plus `pnpm-store/**`, and writes immutable `manifest.json` last. It must not invoke an outer npm command or Playwright downloader, start Harness, execute Chromium, install into a DSH profile, mutate the repository lock/node_modules, read user/global npm configuration, accept an inherited Playwright host/proxy/custom CA, retain its temporary archive/staging, or reuse an unmanifested browser/store. Bootstrap authorization is not CLI acceptance, package-freeze, ripple acceptance, or Gate A′ runtime authorization. If the exact valid manifest already exists and its decision/policy/origin/redirect/archive/executable/tree closure revalidates byte-for-byte, do not download again.

- [ ] **Step 3: Obtain exact Gate A′ runtime and isolated-plugin lifecycle permission**

After Steps 1–2 produce stable identities, the owner decision must name the frozen source commit, Probe package-manifest hash, accepted CLI manifest hash, bootstrap manifest hash, accepted ripple manifest hash, port 3186, and exact command graph from Task 8. It must authorize only: creation and mutation of a new marker-owned repository-local DSH_HOME; install/remove/re-add of the copied Probe tgz; install/remove/re-add of the copied ripple tgz; repeated Harness restarts on `127.0.0.1:3186`; automation of a new browser context; creation of one empty synthetic chat/session sentinel without a prompt or model; and mandatory removal of both copied plugins plus process/listener cleanup. It does not authorize reading or changing the real profile/theme, port 3080, existing browser state, network/bootstrap, models, providers, publishing, or real user data. Without this exact authorization, stop before copying either tgz into a run.

- [ ] **Step 4: Run the real gate with the four explicitly accepted manifests**

~~~bash
npm run gate:a -- --runtime-decision-id "$DSH_PMWB_GATE_A_RUNTIME_DECISION_ID" --port 3186 --probe-package-manifest "$DSH_PMWB_PROBE_MANIFEST" --cli-acceptance "$DSH_PMWB_CLI_ACCEPTANCE" --bootstrap-manifest "$DSH_PMWB_BOOTSTRAP_MANIFEST" --ripple-acceptance "$DSH_PMWB_RIPPLE_ACCEPTANCE"
~~~

The runner requires each quoted variable to be the canonical accepted manifest named in the runtime decision. It copies and revalidates only the content-addressed tgz/closure selected by those manifests; it never builds, downloads, follows a source link, resolves PATH/global/worktree `dsh`, or selects by mtime during the gate. Before Workbench installation it creates one empty synthetic chat/session sentinel in the fresh isolated profile without sending a prompt or invoking a model, then hashes its safe metadata. It executes all nineteen fixed CLI invocations and intervening bounded stops from Task 8. It must observe Host and Client load, health round-trip, counter CAS and receipt behavior, abort phases, Client-9 local wait/abort with no Host call, direct Host-17 fixed outer `internal` with zero side effect, receipt saturation, restart, Workbench remove/re-add with restart/remount, ripple remove/re-add, Workbench remove/restart, same-tgz reinstall readback, final two-plugin cleanup, trust-fence negatives, listener addresses, zero external-network attempts, canary scans, and unchanged synthetic chat sentinel. Checks whose declared evidence class is `EXTRACTED_TGZ_SEAM` load only the audited internal Probe harness from that same tgz; the report distinguishes them from `REAL_TGZ_RUNTIME` and `REAL_BROWSER` observations and makes no separate real disable/enable claim.

- [ ] **Step 5: Preserve every result**

Do not rerun over the same run directory. A second attempt gets a new run ID. The child writes result/report/JUnit atomically; the parent observes the real exit and writes `run.final.json` last with hashes of all three, then updates `current-run.json` only after closure verification. FAIL and INCONCLUSIVE attempts remain present until the user decides cleanup. A missing/mismatched final marker or stale pointer is INCONCLUSIVE.

- [ ] **Step 6: Review the exact run and record its sanitization decision**

Read the exact completed pointer and recompute source, lock, package-freeze decision, package manifest, tgz, CLI acceptance/closure/owner decision, owner-reviewed browser-policy bytes/hash/origin chain, bootstrap decision/manifest/tree, F0 config receipt, ripple acceptance manifest/tgz/owner decision, runtime decision, result, report, JUnit, and final-marker hashes. Scan response bodies, Host stdout/stderr, temporary profile logs, browser console, UI text, filenames, and report fields for canaries, payload, quote, token, stack, and local paths. Raw evidence remains under `.tmp` and is not committed. A human must record one canonical sanitization decision that directly binds all five fields `sourceCommit`, `runId`, `runFinalSha256`, `reportSha256`, and `sanitizationOutcome`; the outcome is an explicit accepted/rejected sanitization judgment and cannot be inferred from Gate PASS or possession of the final-marker hash. The exporter and promoter must parse the same decision record, require all five values to equal the selected immutable closure and reviewed report, and reject a missing, indirect-only, ambiguous, cross-run, report-drifting, source-drifting, or rejected decision. Review alone authorizes neither export nor promotion.

- [ ] **Step 7: Export the reviewed run before any evidence document exists**

Obtain a separate handoff-export decision naming the frozen source commit, `runId`, `runFinalSha256`, `reportSha256`, accepted `sanitizationOutcome`, sanitization decision, intended H1 consumer, and the canonical derived-root equality assertion. Runtime, sanitization, promotion, or H1 code approval does not authorize this copy. The decision permits only creation of the allowlisted sealed export below the independently derived root; it permits no network, profile access, Harness/browser start, plugin/package installation, Git mutation/commit, publish, or cleanup. Set `DSH_PMWB_APPROVED_HANDOFF_ROOT` only to the exact canonical absolute root in that decision, then run:

~~~bash
npm run gate:a:export -- --authorization-id "$DSH_PMWB_HANDOFF_DECISION_ID" --sanitization-decision-id "$DSH_PMWB_SANITIZATION_DECISION_ID" --handoff-root "$DSH_PMWB_APPROVED_HANDOFF_ROOT"
~~~

The exporter requires clean HEAD to equal the frozen H0 source commit, independently derives the same repository-family root, revalidates the current-run pointer and every carried byte, and directly verifies that the sanitization decision's `sourceCommit`, `runId`, `runFinalSha256`, `reportSha256`, and accepted `sanitizationOutcome` equal this closure. It prints the final content-addressed export path plus `handoffManifestSha256`. Recompute that manifest and test the closure from a fresh temporary consumer directory with no repository-local `.tmp` access. The manifest must not contain or hash a future promoted report, canonical ledger, or evidence commit. An export of a sanitized FAIL or INCONCLUSIVE run may be retained for audit but is ineligible as an H1 prerequisite; a rejected sanitization decision cannot be exported at all. The external export is never staged or committed in H0, and deleting it needs a separate cleanup decision.

- [ ] **Step 8: Separately authorize and promote only the sealed handoff, then commit deterministic evidence**

First run the promoter in read-only `--preview` mode with the exact closure, sanitization/export decisions, derived-root equality assertion, and independently recomputed handoff manifest hash. It holds the pointer lock, renders twice in memory, writes nothing, and prints only the two fixed path/SHA-256 pairs plus `candidateSetSha256`; record the set as `DSH_PMWB_GATE_A_CANDIDATE_SET_SHA256` and independently compare the path set. The earlier sanitization decision remains bound to the pre-export five-field run closure; it cannot bind a future handoff-dependent candidate. Obtain a distinct evidence-write/commit decision only now, bound to the frozen source commit, `runId`, `runFinalSha256`, `reportSha256`, accepted `sanitizationOutcome`, sanitization decision, exact handoff manifest hash, both candidate path hashes, candidate-set hash, the two fixed Git paths, and commit message below. It permits only deterministic rendering of those bytes, verification, staging, and one local evidence-only commit; it permits no source/test/package edit, handoff mutation, network, Harness/browser/profile action, push, PR, merge, tag, or publication. Then run write mode with that decision. Record its final-written immutable promotion receipt SHA-256 as `DSH_PMWB_GATE_A_PROMOTION_RECEIPT_SHA256`:

~~~bash
npm run gate:a:promote -- --sanitization-decision-id "$DSH_PMWB_SANITIZATION_DECISION_ID" --handoff-decision-id "$DSH_PMWB_HANDOFF_DECISION_ID" --handoff-root "$DSH_PMWB_APPROVED_HANDOFF_ROOT" --handoff-manifest-sha256 "$DSH_PMWB_HANDOFF_MANIFEST_SHA256" --preview
npm run gate:a:promote -- --evidence-decision-id "$DSH_PMWB_EVIDENCE_DECISION_ID" --sanitization-decision-id "$DSH_PMWB_SANITIZATION_DECISION_ID" --handoff-decision-id "$DSH_PMWB_HANDOFF_DECISION_ID" --handoff-root "$DSH_PMWB_APPROVED_HANDOFF_ROOT" --handoff-manifest-sha256 "$DSH_PMWB_HANDOFF_MANIFEST_SHA256" --candidate-set-sha256 "$DSH_PMWB_GATE_A_CANDIDATE_SET_SHA256"
npm run gate:a:promote -- --evidence-decision-id "$DSH_PMWB_EVIDENCE_DECISION_ID" --sanitization-decision-id "$DSH_PMWB_SANITIZATION_DECISION_ID" --handoff-decision-id "$DSH_PMWB_HANDOFF_DECISION_ID" --handoff-root "$DSH_PMWB_APPROVED_HANDOFF_ROOT" --handoff-manifest-sha256 "$DSH_PMWB_HANDOFF_MANIFEST_SHA256" --candidate-set-sha256 "$DSH_PMWB_GATE_A_CANDIDATE_SET_SHA256" --promotion-receipt-sha256 "$DSH_PMWB_GATE_A_PROMOTION_RECEIPT_SHA256" --check
git status --short
git add -- docs/gate-results/gate-a-connection-rpc.md docs/probe-results.md
git diff --cached --check
git diff --cached --name-only
git status --short
npm run gate:a:promote -- --evidence-decision-id "$DSH_PMWB_EVIDENCE_DECISION_ID" --sanitization-decision-id "$DSH_PMWB_SANITIZATION_DECISION_ID" --handoff-decision-id "$DSH_PMWB_HANDOFF_DECISION_ID" --handoff-root "$DSH_PMWB_APPROVED_HANDOFF_ROOT" --handoff-manifest-sha256 "$DSH_PMWB_HANDOFF_MANIFEST_SHA256" --candidate-set-sha256 "$DSH_PMWB_GATE_A_CANDIDATE_SET_SHA256" --promotion-receipt-sha256 "$DSH_PMWB_GATE_A_PROMOTION_RECEIPT_SHA256" --verify-index
git commit -m "docs: record observed Gate A prime result"
git rev-list --parents -n 1 HEAD
git diff-tree --no-commit-id --raw -r -z "$DSH_PMWB_H0_FROZEN_SOURCE_COMMIT" HEAD
git status --short
~~~

The promoter independently derives the repository-family root; the supplied root is only an exact equality assertion. It locates only the supplied `handoffManifestSha256`, revalidates the manifest-last closure against `current-run.json` plus the sanitization/export/evidence-write decisions, and deterministically renders that same hash, path-free `familyId`, export decision, sanitization decision and its five direct fields, evidence-write decision, `runFinalSha256`, frozen source commit, package-freeze decision, Probe tgz/package, CLI acceptance/closure, browser-policy/bootstrap/F0-config receipts, ripple acceptance/tgz/owner decision, runtime decision, actual outcome, and all four run-closure hashes into both fixed Git documents. Before staging, verify the short status is exactly the two Files paths; after staging, compare `git diff --cached --name-only` byte-for-byte with that inventory and require `--verify-index` to match each staged blob to the immutable promotion receipt. The `--check` invocation revalidates the handoff, receipt, and byte-identical rerendering. The promoter cannot include a code fix, mutate the sealed handoff, or rewrite packed `packages/workbench` documentation.

Record the full new commit as `DSH_PMWB_H0_EVIDENCE_COMMIT`, then run:

~~~bash
npm run gate:a:promote -- --evidence-decision-id "$DSH_PMWB_EVIDENCE_DECISION_ID" --sanitization-decision-id "$DSH_PMWB_SANITIZATION_DECISION_ID" --handoff-decision-id "$DSH_PMWB_HANDOFF_DECISION_ID" --handoff-root "$DSH_PMWB_APPROVED_HANDOFF_ROOT" --handoff-manifest-sha256 "$DSH_PMWB_HANDOFF_MANIFEST_SHA256" --candidate-set-sha256 "$DSH_PMWB_GATE_A_CANDIDATE_SET_SHA256" --promotion-receipt-sha256 "$DSH_PMWB_GATE_A_PROMOTION_RECEIPT_SHA256" --verify-commit "$DSH_PMWB_H0_EVIDENCE_COMMIT"
~~~

It reads the two blobs from that exact commit object and requires both hashes to match the promotion receipt. Parse the two post-commit Git outputs rather than accepting their display alone. `rev-list` must return exactly `HEAD` plus one parent, and that parent must equal `DSH_PMWB_H0_FROZEN_SOURCE_COMMIT`. Parse the raw NUL-delimited `diff-tree` records and require exactly regular-file additions/modifications at `docs/gate-results/gate-a-connection-rpc.md` and `docs/probe-results.md`; reject a third path, rename, copy, deletion, submodule, symlink, special/type substitution, or any mode change other than a new regular file at the previously absent Gate-report path. The final status must be empty. Any topology or candidate-byte mismatch invalidates the evidence candidate and cannot be repaired by amending it; return to the frozen source and repeat promotion under a new evidence decision. Only an all-A01–A22 PASS closure whose report and canonical ledger agree on the sealed handoff hash may unlock a separately authorized H1 start.

## Gate A′ check-to-evidence map

| Check | Evidence class | Required observation |
| --- | --- | --- |
| A01 | REAL_TGZ_RUNTIME | one channel from installed tgz, no `/api` interceptor |
| A02 | REAL_TGZ_RUNTIME + REAL_BROWSER | same package loads Client and one launcher |
| A03 | REAL_BROWSER | launcher opens and closes the overlay |
| A04 | REAL_TGZ_RUNTIME | exact Probe health and capacity tuple |
| A05 | REAL_TGZ_RUNTIME | counter and aggregate version increment |
| A06 | REAL_TGZ_RUNTIME | same-ID replay and different-payload refusal |
| A07 | REAL_TGZ_RUNTIME | old expectedVersion conflict |
| A08 | REAL_TGZ_RUNTIME + EXTRACTED_TGZ_SEAM | strict schema and plugin-budget rejection; no whole-wire claim |
| A09 | EXTRACTED_TGZ_SEAM | malformed Host output rejected by packed Client transport |
| A10 | EXTRACTED_TGZ_SEAM + REAL_TGZ_RUNTIME + REAL_BROWSER | canary throw is caught and all runtime surfaces scan clean |
| A11 | EXTRACTED_TGZ_SEAM | three deterministic abort barriers and exact-command reconciliation |
| A12 | REAL_TGZ_RUNTIME | receipt 256/257 boundary and old replay |
| A13 | EXTRACTED_TGZ_SEAM | packed Client 9 waits/aborts locally without Host call; direct Host 17 returns fixed outer internal with zero side effect |
| A14 | REAL_TGZ_RUNTIME | restart restores counter/version/receipts |
| A15 | REAL_TGZ_RUNTIME + REAL_BROWSER | public remove/re-add plus restart/remount never duplicate resources |
| A16 | REAL_TGZ_RUNTIME | trust-fence negatives and listener-table proof |
| A17 | REAL_TGZ_RUNTIME + REAL_BROWSER | owner-reviewed isolated ripple copy coexists |
| A18 | REAL_TGZ_RUNTIME + REAL_BROWSER | remove/restart removes route/UI while preserving data/theme/chat |
| A19 | REAL_TGZ_RUNTIME | same-tgz reinstall reads sentinel |
| A20 | REAL_TGZ_RUNTIME | clean commit/lock/tgz package audit |
| A21 | REAL_TGZ_RUNTIME | only sanitized, recomputable evidence is eligible for Git |
| A22 | REAL_TGZ_RUNTIME | resolved handler/carrier/rpcId behavior re-observed with residual risk stated |

## Gate A′ completion rule

Only all twenty-two required runtime checks with observed PASS permit the narrow runtime claim in specification §10.3. H1 eligibility additionally requires the human-reviewed run to be sealed first, the promoter to revalidate it, both fixed Git documents to record the same `handoffManifestSha256`, and the resulting evidence-only commit to be accepted. Any FAIL, INCONCLUSIVE result, missing handoff, hash disagreement, or unaccepted evidence commit is H0 downstream No-Go.

~~~text
STOP — report observed evidence and wait for the owner.
Do not continue to H1 automatically.
~~~

If H0 fails, do not add a private fallback, weaken schemas, alter the active Harness, or select a different Harness version. Return to architecture review. Whether pure P0 work continues is a separate owner decision.
