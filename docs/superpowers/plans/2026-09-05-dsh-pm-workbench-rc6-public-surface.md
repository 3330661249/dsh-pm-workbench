# DSH PM Workbench rc.6 Public Surface Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove or reject, without starting Harness, that the exact DeepSeek Harness `0.1.0-rc.6` public packages expose the Connection RPC, storage-domain, and additive UI slot seams required by the minimal integration design.

**Architecture:** Add exact development-only rc.6 packages to the isolated worktree, then compile Host and Client API contracts in separate TypeScript projects. Runtime tests verify exact versions and dependency containment; no production plugin behavior is added in this plan.

**Tech Stack:** TypeScript 6.0.3, Node.js 24.14.0, Vitest 3.2.7, DeepSeek Harness public packages `0.1.0-rc.6`.

**Spec:** `docs/superpowers/specs/2026-09-05-dsh-pm-workbench-minimal-harness-integration-design.md`

## Global Constraints

- Start from `bd0ae743e0c490b5aa770eccae3dd77d325e9a48` in the isolated worktree `/private/tmp/dsh-pm-workbench-gate-a-prime`.
- This plan implements A′-P1 only. Do not start Harness, create a profile, install a tgz, bind port `3186`, or claim Gate A′ PASS.
- Use only public package exports and exact `0.1.0-rc.6` versions.
- Every DeepSeek package and executable used by the checks must resolve within this worktree's own `node_modules`; parent/global fallback fails the plan.
- Do not read `~/.dsh`, port `3080`, user sessions, credentials, real interview data, or model configuration.
- Use TDD: observe the focused contract fail before adding the missing dependencies.

---

### Task 1: Add a failing exact-version and dependency-boundary contract

**Files:**

- Create: `tests/contract/connection-rpc-rc6-surface.test.ts`
- Create: `tests/integration/rc6-dependency-boundary.test.ts`

**Interfaces:**

- Consumes: package manifests resolved by Node from the current worktree.
- Produces: a runtime proof that all required public packages are exact rc.6 and physically contained below the local dependency root.

- [ ] **Step 1: Write the exact-version test**

The contract loads each public `package.json` through `createRequire(import.meta.url)` and requires exact version `0.1.0-rc.6` for:

- `@deepseek-ai/dsh-client-connection`;
- `@deepseek-ai/dsh-storage-domain`;
- `@deepseek-ai/dsh-client-runtime`;
- `@deepseek-ai/dsh-client-ui-layout`;
- `@deepseek-ai/dsh-client-ui-sidebar`;
- `@deepseek-ai/dsh-client-ui-slots`.

The boundary test resolves each package manifest, takes its realpath, and asserts it is strictly below this worktree's real `node_modules`. It also asserts that the worktree has no parent-directory dependency fallback.

- [ ] **Step 2: Run the tests and verify RED**

Run:

```bash
npm test -- tests/contract/connection-rpc-rc6-surface.test.ts tests/integration/rc6-dependency-boundary.test.ts
```

Expected: FAIL because at least `dsh-client-connection` and `dsh-storage-domain` are not present in this worktree.

- [ ] **Step 3: Record RED without committing a broken branch**

Record the command, exit code, and expected missing-package reason in the task ledger. Keep the tests uncommitted until Task 2 makes them green; do not change manifests before RED is observed.

---

### Task 2: Pin the public integration packages

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `packages/workbench/package.json`
- Modify: `tests/contract/package-manifest.test.ts`
- Modify: `THIRD_PARTY_NOTICES.md`
- Modify: `packages/workbench/docs/third-party.md`

**Interfaces:**

- Consumes: Task 1 exact-version and containment contract.
- Produces: exact development dependencies plus optional peer declarations for the eventual Host and Client runtime.

- [ ] **Step 1: Add exact development dependencies**

Add the six exact rc.6 packages named in Task 1 to the root `devDependencies` using npm with lifecycle scripts disabled. Explicitly pin any DeepSeek peer packages required to close their public type graph at `0.1.0-rc.6`; do not allow npm to select a floating peer version, range, or `latest`.

- [ ] **Step 2: Declare package peers and Client injection order**

The workbench package declares exact-compatible rc.6 peers for the same public services. Client injection must include, in dependency order:

1. `@deepseek-ai/dsh-client-runtime`;
2. `@deepseek-ai/dsh-client-connection`;
3. `@deepseek-ai/dsh-client-ui-layout`;
4. `@deepseek-ai/dsh-client-ui-sidebar`;
5. `@deepseek-ai/dsh-client-ui-slots`.

All Harness peers remain optional for repository development. No runtime implementation is added.

- [ ] **Step 3: Update provenance**

Record package names, exact versions, MIT license, public registry source, and the fact that they are development/type verification inputs. Do not claim runtime compatibility.

- [ ] **Step 4: Run focused GREEN checks**

Run:

```bash
npm test -- tests/contract/connection-rpc-rc6-surface.test.ts tests/integration/rc6-dependency-boundary.test.ts tests/contract/package-manifest.test.ts
npm ls --depth=0
```

Expected: PASS, with every required package resolved locally and no extraneous dependency.

---

### Task 3: Compile Host and Client public surface contracts separately

**Files:**

- Create: `tests/types/harness-host-rc6-surface.ts`
- Create: `tests/types/harness-client-rc6-surface.ts`
- Create: `tsconfig.surface.host.json`
- Create: `tsconfig.surface.client.json`
- Modify: `tests/integration/standalone-copy.test.ts`
- Create: `research/2026-09-05-connection-rpc-rc6-surface.md`

**Interfaces:**

- Consumes: exact packages and public types from Task 2.
- Produces: compile-only contracts for the next preflight slice; no callable production adapter.

- [ ] **Step 1: Write compile-only Host contract**

Using public exports only, declare values that prove these assignments compile:

```ts
const disposeChannel: () => Promise<void> = host.rpc.handle(
  '/dsh-pm-workbench-v1',
  handler,
  { authority: 'loopback' },
)

const openedDomain = hostContext.storageDomain.open(domainSpec)
```

The file must not construct fake runtime objects or call Harness.

- [ ] **Step 2: Write compile-only Client contract**

Using public exports and declaration merging only, declare values that prove these assignments compile:

```ts
const response = client.rpc.call(
  '/dsh-pm-workbench-v1',
  'health',
  {},
  new AbortController().signal,
)

const disposeLauncher = clientContext.slots.inject('sidebar.footer.action', () =>
  clientContext.slots.register(
    { name: 'sidebar.footer.action', id: 'pm-workbench-probe-launcher' },
    component,
  ),
)

const disposeOverlay = clientContext.slots.inject('shell.overlay', () =>
  clientContext.slots.register(
    { name: 'shell.overlay', id: 'pm-workbench-probe-overlay' },
    component,
  ),
)
```

The public framework types intentionally expose broader capabilities such as other slot keys and `trusted-host`. This compile-only contract does not pretend those public types reject them. The A′-P2 implementation must introduce narrow workbench-owned wrappers and test that its production graph uses only `loopback`, `sidebar.footer.action`, and `shell.overlay`.

- [ ] **Step 3: Compile both projects**

Run:

```bash
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
```

Expected: PASS. A signature mismatch is a plan failure; do not weaken the required semantics.

- [ ] **Step 4: Extend standalone-copy verification**

The arbitrary-path copy must include both surface configs and type files, install from the copied lock without network, run both surface compilers, and prove their packages resolve below the copied dependency root.

- [ ] **Step 5: Record the result**

`research/2026-09-05-connection-rpc-rc6-surface.md` records:

- exact tested package versions;
- public export paths and observed signatures;
- local dependency-containment result;
- tests and compiler commands actually run;
- PASS or FAIL;
- the narrow claim permitted by A′-P1;
- the explicit statement that no Harness process or profile was started.

---

### Task 4: Final verification and independent review

**Files:**

- Modify only if verification finds a documented defect in the A′-P1 files above.

**Interfaces:**

- Consumes: Tasks 1–3.
- Produces: one reviewed A′-P1 commit or a recorded failure that stops A′-P2.

- [ ] **Step 1: Run complete verification**

Run:

```bash
npm run typecheck
npm test
npm run build
npm run demo:build
npm run verify:package
npm run pack:dry
npm ls --depth=0
git diff --check
git diff --cached --check
```

The Harness dry-run package must remain the existing nine-file no-op skeleton. The new packages and test-only contracts must not enter it.

- [ ] **Step 2: Independently review the exact diff**

The reviewer checks public-only imports, exact versions, local dependency containment, manifest/injection consistency, notices, standalone-copy isolation, and claim language.

- [ ] **Step 3: Stop and report**

If approved, report only:

> The exact tested DeepSeek Harness 0.1.0-rc.6 public packages expose the minimum typed surfaces required to implement the isolated Connection RPC preflight.

Do not start A′-P2, install a tgz, create a Harness profile, or claim compatibility in this plan.
