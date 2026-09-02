# DSH PM Workbench F0 Shared Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Create the smallest phase-neutral, test-first foundation shared by the H0 Probe and P0 Product core without loading Harness, defining a phase endpoint, or processing content.

**Architecture:** Put strict canonical JSON, stable outcome/error types, generic endpoint registry types, browser-safe ports, and split TypeScript/test graphs in shared modules. Add repository-only exact-dependency and browser-artifact bootstrap tools with decision receipts; they never enter the Product bundle. H0 adds only Probe schemas and H1/P0 add only Product schemas; neither phase imports the other registry.

**Tech Stack:** TypeScript 6.0.3, Node.js 24.14.0, Vitest 3.2.7, Zod 4.4.3, Web-standard TextEncoder, injected hash/clock/ID ports, and fixed `/usr/bin/ditto` ZIP extraction on the accepted Darwin target.

**Spec:** ../specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md

## Global Constraints

- F0 needs separate owner authorization. Approval of this plan set is not permission to implement it or modify dependencies.
- Use `superpowers:using-git-worktrees` only for isolation detection and creation at an owner-approved external root. Explicitly skip its automatic Project Setup: no bare `npm install`, no `.gitignore` edit/commit, and no fallback to the active checkout. If creation-only isolation cannot be guaranteed, stop.
- The new worktree must have no ancestor `node_modules`. Before ordinary project commands, Task 1 bootstraps and tests an audited exact-lock hydrator using Node built-ins only; worktree-local `node_modules` write and any public-registry access each require explicit, mutually non-substitutable canonical decision IDs passed to the repository wrapper and recorded in its path-free receipt.
- The Zod exact-add action and its public-network permission use two further canonical decision IDs and must run through the repository-owned exact-dependency installer described in Task 1. A decision authorizes only its exact source, lock, action grammar, output root, expiry, and network mode; the wrapper consumes the decision while npm receives no authorization argument.
- Every accepted installer mode uses one non-bypassable environment builder before mode dispatch. For each invocation it exclusively creates distinct empty regular files for `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG` below the same marker-owned root, binds both variables explicitly after removing inherited case variants, and records their content hashes in a path-free sanitized receipt. A caller, user npmrc, system/global npmrc, inherited npm override, symlink/hardlink/special file, or validated-then-replaced config file must never influence npm.
- Task 1 also creates two phase-neutral bootstrap tools: a repository-owned policy-enforcing HTTPS downloader and a fixed offline browser-archive materializer. They are tooling, not product imports. The downloader handles redirects itself and checks the exact reviewed URL/origin policy before reading any response body. It keeps one exclusive no-follow archive file descriptor and its device/inode identity alive through byte counting, hashing, ZIP preflight, and extraction. The materializer never reopens the archive by its mutable pathname: on the accepted Darwin target it passes that same descriptor as child fd 3 to fixed `/usr/bin/ditto -x -k /dev/fd/3 …`, after a synthetic capability check proves the exact accepted `ditto` can consume this binding. It rejects unsafe archive trees, compares every extracted regular file with the preflight entry content hash, and publishes atomically. F0 exercises the complete production seam only against loopback synthetic fixtures and never downloads a real browser.
- F0 production modules do not import DeepSeek Harness, Cordis, React, storageDomain, Connection, filesystem, network, child processes, models, providers, or credentials. Repository bootstrap/gate tooling may use Node built-ins only within the explicit boundaries above.
- F0 defines no Probe or Product endpoint, no repository, no fixture, no UI, no build tgz, and no runtime phase switch.
- Shared code exposes only browser-safe pure data/functions and dependency-inversion ports. Node SHA implementations belong to later Host/test adapters.
- Passing F0 proves only the named static foundation. It is not Gate A′, P0, P1, or Gate B evidence.
- Each commit stages only the exact files listed by that task, then runs `git diff --cached --check`, compares `git diff --cached --name-only` with that task's allowlist, and checks `git status --short`. Never stage a whole directory.

---

### Task 1: Pin the phase-neutral validator and split compiler/test graphs

**Files:**

- Modify: package.json
- Modify: package-lock.json
- Modify: packages/workbench/package.json
- Modify: tests/contract/package-manifest.test.ts
- Modify: vitest.config.ts
- Modify: tsconfig.host.json
- Modify: tsconfig.tests.json
- Create: tsconfig.shared.json
- Create: tsconfig.client.json
- Modify: tests/integration/standalone-copy.test.ts
- Create: tests/contract/compiler-test-graph.test.ts
- Create: scripts/install-exact-dependencies.mjs
- Create: scripts/bootstrap/policy-fetch.mjs
- Create: scripts/bootstrap/materialize-browser.mjs
- Create: tests/bootstrap/exact-lock-hydration.node.test.mjs
- Create: tests/bootstrap/policy-fetch.node.test.mjs
- Create: tests/bootstrap/browser-materializer.node.test.mjs
- Create: tests/integration/exact-dependency-installer.test.ts

**Interfaces:**

- Produces: decision-bound audited `--hydrate-lock` and exact-add installer modes, a phase-neutral policy-enforcing HTTPS downloader plus offline browser materializer, exact `zod@4.4.3`, explicit shared/Host/Client/test TypeScript graphs, Vitest discovery for both `.test.ts` and `.test.tsx`, and an offline standalone-copy contract.

- [ ] **Step 1: Write all three dependency-free RED bootstrap tests**

`tests/bootstrap/exact-lock-hydration.node.test.mjs` uses only `node:test`, `node:assert`, temporary directories, and fake executable recorders. It fails until the installer can plan a hydration without loading any package from `node_modules`. It requires:

~~~text
exact mode is --hydrate-lock with either --offline or --public-registry-network; the required wrapper-only action decision binds one closed two-stage state machine containing the exact offline-first argv and, only after its verified cache-miss receipt, one exact public-registry retry argv; network mode additionally requires a distinct network decision bound to that receipt and second-stage argv
npm argv is ci --ignore-scripts --no-audit --no-fund plus exactly one accepted network-mode flag and the fixed public registry; caller argv cannot supply a config, prefix, registry, cache, script-shell, or lifecycle override
offline is always attempted first; network mode is impossible without a distinct explicit flag
the wrapper verifies each canonical decision against exact source/lock/action/output/expiry/network scope, records only canonical ID plus a path-free receipt hash, rejects reuse or cross-scope substitution, and never forwards a decision ID to npm
HOME/XDG/npm cache plus separate userconfig and globalconfig files are unique marker-owned children
NPM_CONFIG_USERCONFIG and NPM_CONFIG_GLOBALCONFIG are the only child config bindings, each names its own empty regular file, and both files hash to the canonical SHA-256 of zero bytes
inherited upper/lower/mixed-case userconfig/globalconfig, prefix, registry, cache, script-shell, auth/token/cookie/credential/proxy/provider/NODE_OPTIONS, and other npm override variables are stripped before the two canonical bindings are inserted
both config files are exclusively created, non-symlink regular files with one link, stay beneath the real marker-owned root, and pass same-open identity plus same-read empty-byte/hash checks immediately before spawn and again after npm exits
the path-free sanitized receipt records userConfigSha256, globalConfigSha256, and a canonical role-to-hash binding digest; it records no absolute config path or config contents
malicious inherited user/global npmrc canaries, a fake system-prefix npmrc, config symlink/hardlink/special-file cases, and a deterministic validate-then-swap seam all stop before the fake npm recorder observes a child invocation
the worktree root is a non-symlink Git worktree outside the active checkout and has no ancestor node_modules
package.json and package-lock.json are regular, same-read, hashed inputs and remain byte-identical
node_modules is a non-symlink child of this worktree; every resolved project package/CLI must remain beneath it
failure or cache miss cannot silently consult a parent/user installation or change the lock
~~~

Before Step 2, also create `tests/bootstrap/policy-fetch.node.test.mjs` and
`tests/bootstrap/browser-materializer.node.test.mjs` with Node built-ins only. They exercise the
actual future production entries through controlled loopback HTTPS/redirect fixtures and synthetic
ZIP bytes. The RED assertions cover allowed redirect success plus pre-body rejection, exact
length/hash, policy replacement, retained-descriptor identity, pathname/fd substitution, fd-3
capability, central/local header agreement, unsafe entry paths/types/collisions, CRC/size/content
agreement, extractor/post-walk drift, cleanup, and atomic publication. Both files must be collected
and fail on missing production modules or unmet behavior; a missing test path, import crash before
test registration, skipped test, or zero collected assertion is not the required RED.

- [ ] **Step 2: Run the dependency-free RED test**

~~~bash
node --test tests/bootstrap/exact-lock-hydration.node.test.mjs tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
~~~

Expected: all three named files are collected and fail because the installer and two browser-bootstrap tools do not exist. Zero collected tests is failure.

- [ ] **Step 3: Implement only safe exact-lock hydration, then run its GREEN test**

Implement the command planner/environment builder using Node built-ins. It resolves the npm CLI from the recorded Node installation, invokes it through `process.execPath` with executable-plus-argument arrays and `shell: false`, and supports no package additions yet. `--hydrate-lock --offline --action-decision-id <canonical-id>` invokes exact-lock `npm ci` with npm's literal `--offline`; if the cache is insufficient it emits one immutable classified-miss receipt and never retries online in that invocation. The action decision is not bound only to that first argv: it binds one closed state machine containing the exact source/lock/output plus the offline-first argv and the sole permitted public-registry transition. `--hydrate-lock --public-registry-network --action-decision-id <same-action-id> --network-decision-id <distinct-canonical-id>` is accepted only when the action record names that state machine and the separate network decision binds the same immutable miss receipt and exact second-stage argv; it omits `--offline`. The wrapper validates the action decision before either output allocation, and validates the miss plus network extension before the network child. It rejects a missing/reused/cross-scope ID, a direct second-stage entry without the recorded first-stage miss, or any argv/state mismatch, and records a path-free decision receipt; neither ID is included in npm argv. Both modes use literal `--ignore-scripts --no-audit --no-fund`, fixed `https://registry.npmjs.org/`, a unique marker-owned HOME/XDG/cache, filtered environment, bounded sanitized output, and before/after manifest/lock hashes. No other npm network-mode flag or transition is accepted.

Before mode-specific planning, the shared builder removes every inherited case variant of `NPM_CONFIG_USERCONFIG`, `NPM_CONFIG_GLOBALCONFIG`, `npm_config_prefix`, registry/cache/script-shell, and every other npm/auth/proxy/provider override. Under one freshly and exclusively created marker-owned invocation root it then creates two different empty regular files with different inode identities, one for the user role and one for the global role, and inserts exactly one canonical `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG` child binding. It rejects caller `--userconfig`, `--globalconfig`, `--prefix`, `--location`, `--registry`, `--cache`, `--script-shell`, or generic `--config` argv. Each file must be a non-symlink, single-link regular file whose realpath remains below the invocation root; the builder keeps the validated file identity/open handle through final same-read verification so a symlink, hardlink, special file, non-empty byte, rename/swap, or realpath/content drift stops before npm. After the child exits, it rechecks the same identities and hashes before accepting the result.

The sanitized invocation receipt records lowercase `userConfigSha256` and `globalConfigSha256`, each equal to the canonical empty-file digest `e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855`, plus a canonical path-free `configBindingSha256` over the two role/hash pairs and the environment-builder source hash. It never records either absolute config path, inherited config contents, or a canary. Both hydrate modes reject an in-repository worktree directory that needs an ignore commit, an active-checkout fallback, an ancestor/foreign `node_modules`, config identity drift, or package resolution outside the current worktree.

~~~bash
node --test tests/bootstrap/exact-lock-hydration.node.test.mjs
~~~

Implement `policy-fetch.mjs` as a direct-Node HTTPS client with automatic redirects disabled. Its only accepted policy is a same-read regular JSON file that fixes the initial archive URL, ordered non-empty exact HTTPS origin allowlist, redirect ceiling, expected byte length and SHA-256, archive format, single expected archive root, executable relative path, tool identity, and browser revision. Before consuming any body byte at the initial response or a redirect target, it parses the URL, rejects userinfo, non-HTTPS, an unlisted origin, loops, excess redirects, or a changed immutable policy, and records the observed chain. It opens a unique marker-owned temporary regular file with exclusive creation, no-follow semantics, mode `0600`, and a retained file descriptor; records and repeatedly revalidates its device/inode/type/link identity; streams with a hard byte cap; fsyncs; and computes exact length/hash from the same open object. Every failure closes the handle and removes only the still-proven marker-owned name.

`materialize-browser.mjs` accepts only that live verified handle plus its immutable receipt, never an archive pathname or caller fd. From the same descriptor it cross-checks every ZIP central-directory record against its local header, including canonical filename bytes, flags, compression, CRC, sizes, offset, and non-overlapping data interval. For every supported regular-file entry it reads/decompresses the recorded interval from that descriptor, verifies CRC and uncompressed size, and records a SHA-256 content digest. It rejects absolute, parent-traversing, backslash, NUL, empty, duplicate, case-colliding, or Unicode-normalization-colliding paths; encrypted, data-descriptor, ZIP64, multi-disk, sparse, truncated, overlapping, ambiguous, link, device, FIFO, socket, unsupported-compression, unexplained-trailing-data, extra-root, size/count/ratio-overflow entries; central/local disagreement; or a missing exact executable entry. It revalidates descriptor identity/hash, unlinks and verifies disappearance of the temporary pathname while retaining the handle, rewinds it, and maps that exact descriptor to child fd 3. Only then may it invoke `/usr/bin/ditto -x -k /dev/fd/3 <unique-staging>` with `shell: false`, explicit stdio mapping, and a sanitized environment. A prerequisite synthetic ZIP capability test binds the accepted Darwin and `/usr/bin/ditto` executable identity and proves this exact fd-3 argv extracts the expected bytes; failure is unsupported/INCONCLUSIVE with no fallback. The post-extraction no-follow walk requires the exact preflight path/type/mode/size set and every regular-file SHA-256 to equal its preflight entry digest before atomically renaming the verified tree to its immutable content-addressed destination. Neither tool accepts a caller redirect, archive path/fd, executable path, output escape, alternate extractor, proxy, custom CA, credential, or status override.

Run the already-authored Node-only production-entry tests against the implementation. Expand an
assertion only if implementation work exposes a missing case; do not defer either test file's first
behavior-level RED until this step. The controlled fixtures may trust only their generated local
certificate and never enable external access, and every denied case must leave no published or
partial browser tree.

~~~bash
node --test tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
~~~

- [ ] **Step 4: Obtain hydration authorization and establish the worktree-local baseline**

First obtain a canonical authorization for the exact-lock worktree-local `node_modules` write, bind it to this source/lock, output root, expiry, and the closed offline-first/verified-miss/one-network-retry state machine above, and record it as `DSH_PMWB_F0_HYDRATION_DECISION_ID`. Invoke the repository wrapper directly with the reviewed Node executable so an outer npm process cannot consume inherited npm configuration before the wrapper establishes its environment:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --offline --action-decision-id "$DSH_PMWB_F0_HYDRATION_DECISION_ID"
~~~

If and only if it reports a missing cache artifact, stop and obtain a separate public-registry network authorization bound to that exact classified miss and record it as `DSH_PMWB_F0_HYDRATION_NETWORK_DECISION_ID` before:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --public-registry-network --action-decision-id "$DSH_PMWB_F0_HYDRATION_DECISION_ID" --network-decision-id "$DSH_PMWB_F0_HYDRATION_NETWORK_DECISION_ID"
~~~

Recompute package/lock hashes, run `npm ls --all`, and prove each resolved project package and CLI realpath is beneath this worktree's own `node_modules`. Revalidate the invocation receipt's user/global empty-file hashes and path-free binding digest. Any lock/manifest/config drift, lifecycle execution, inherited user or global npmrc effect, parent resolution, missing/extraneous package, or unapproved network is No-Go.

- [ ] **Step 5: Write RED graph, manifest, and full installer tests**

Assert that:

~~~text
zod is exactly 4.4.3 in packages/workbench dependencies and lockfile
tsconfig.shared includes only ports/protocol and browser-safe ports
tsconfig.host includes shared plus Host/application/adapters/integration graphs
tsconfig.client includes shared plus client graphs with DOM libs
tsconfig.tests includes tests/**/*.ts and tests/**/*.tsx
Vitest includes tests/**/*.test.ts and tests/**/*.test.tsx
DOM tests must opt into jsdom with a file pragma; Node remains the default environment
standalone-copy includes every newly created config and fails on a missing required candidate
the dependency installer invokes the recorded local npm CLI with shell=false, exact packages, and --ignore-scripts --no-audit --no-fund
every hydrate and exact-add variant reaches npm only through the one shared builder with unique marker-owned HOME/XDG/npm-cache plus distinct empty NPM_CONFIG_USERCONFIG/NPM_CONFIG_GLOBALCONFIG regular files; no mode-specific bypass is accepted
every repository-wrapper invocation requires the exact action decision ID; each network form additionally requires a distinct network decision ID, validates source/lock/action/output/expiry/scope, writes a path-free receipt, rejects missing/reused/cross-scope decisions, and never forwards an ID to npm
the dependency-free test injects upper/lower/mixed-case inherited config variables, a malicious global npmrc and fake system-prefix npmrc with registry/auth/proxy/cache/script-shell canaries, then proves the fake npm recorder sees only the two canonical empty config bindings and that the sanitized receipt contains only their empty-file hashes and path-free binding digest
the integration test exercises both hydrate network modes and exact-add with malicious user/global npmrc files and asserts their registry/auth/proxy/cache/script-shell/cafile canaries affect neither argv, child environment, filesystem destinations, bounded output, nor receipt
config symlink, hardlink, special-file, non-empty-file, root escape, duplicate-role path/inode, case-variant override, and deterministic validate-then-replace mutations fail before npm; post-child identity/hash drift also rejects the result
the installer rejects inherited auth/token/proxy/provider/NODE_OPTIONS and generic npm configuration in addition to the explicit user/global config attacks
hydrate-lock preserves exact manifest/lock bytes and rejects ancestor or foreign node_modules resolution
~~~

The package-manifest test keeps current Harness peers unchanged in F0 and adds only exact Zod. H0 later owns Connection/storage/slot peer changes.

- [ ] **Step 6: Run RED**

~~~bash
npm test -- tests/contract/compiler-test-graph.test.ts tests/contract/package-manifest.test.ts tests/integration/standalone-copy.test.ts tests/integration/exact-dependency-installer.test.ts
node --test tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
npm run typecheck
~~~

- [ ] **Step 7: Extend the tested installer and obtain exact Zod dependency authorization**

Extend `scripts/install-exact-dependencies.mjs` test-first with the exact-add mode. It must enter the same environment builder before exact-add dispatch; mode registration fails closed if it does not consume the builder's verified config and decision receipts. It keeps the same recorded npm CLI, `process.execPath`, executable-plus-argument arrays, `shell: false`, filtered environment, marker-owned paths, fixed registry, separate empty userconfig/globalconfig bindings, exact package validation, literal `--ignore-scripts --no-audit --no-fund`, bounded sanitized output, and resulting lock-integrity/version checks. Later exact-add variants such as `--save-dev` or another fixed workspace cannot bypass this builder. A private registry, proxy, or non-empty npm configuration requires a new narrower design and authorization.

Obtain one canonical decision for the exact manifest/lock mutation and worktree-local install, bound to the source, pre-add lock, package/workspace, output root, and expiry, and record it as `DSH_PMWB_F0_EXACT_ADD_DECISION_ID`. Obtain a distinct exact-public-network decision bound to the same operation and fixed registry as `DSH_PMWB_F0_EXACT_ADD_NETWORK_DECISION_ID`. Only after both exist may the directly invoked wrapper run:

~~~bash
node scripts/install-exact-dependencies.mjs --workspace packages/workbench --save-exact zod@4.4.3 --action-decision-id "$DSH_PMWB_F0_EXACT_ADD_DECISION_ID" --network-decision-id "$DSH_PMWB_F0_EXACT_ADD_NETWORK_DECISION_ID"
~~~

The runner consumes both decision IDs but its frozen npm child argv includes only `install --ignore-scripts --no-audit --no-fund --save-exact --workspace packages/workbench zod@4.4.3` plus the fixed registry; the child environment contains only the builder-created empty `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG` bindings. Verify both decision receipts, both config hashes/binding digest, and that manifest and lock record exactly 4.4.3; do not use a caret, `latest`, a parent installation, the user's `~/.npmrc`, a system/global npmrc, or a hand-edited stale lock.

- [ ] **Step 8: Implement the graph configs**

Root `typecheck` runs shared, Host, Client, and tests explicitly. `sourceCandidates` adds only files that exist at this F0 commit; later phases extend it in the same commit that creates each new required config/directory. Do not add a nonexistent future path or silently treat required source as optional.

- [ ] **Step 9: Run GREEN**

~~~bash
npm test -- tests/contract/compiler-test-graph.test.ts tests/contract/package-manifest.test.ts tests/integration/standalone-copy.test.ts tests/integration/exact-dependency-installer.test.ts
node --test tests/bootstrap/exact-lock-hydration.node.test.mjs tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
npm run typecheck
~~~

- [ ] **Step 10: Commit**

~~~bash
git add -- package.json package-lock.json packages/workbench/package.json tests/contract/package-manifest.test.ts vitest.config.ts tsconfig.host.json tsconfig.tests.json tsconfig.shared.json tsconfig.client.json tests/integration/standalone-copy.test.ts tests/contract/compiler-test-graph.test.ts scripts/install-exact-dependencies.mjs scripts/bootstrap/policy-fetch.mjs scripts/bootstrap/materialize-browser.mjs tests/bootstrap/exact-lock-hydration.node.test.mjs tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs tests/integration/exact-dependency-installer.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "build: add the shared protocol foundation"
~~~

### Task 2: Implement canonical JSON and safe shared outcomes

**Files:**

- Create: packages/workbench/src/ports/hash-port.ts
- Create: packages/workbench/src/ports/id-port.ts
- Create: packages/workbench/src/ports/clock-port.ts
- Create: packages/workbench/src/ports/workbench-transport.ts
- Create: packages/workbench/src/ports/protocol/canonical-json.ts
- Create: packages/workbench/src/ports/protocol/common.ts
- Create: packages/workbench/src/ports/protocol/registry.ts
- Create: packages/workbench/src/ports/protocol/index.ts
- Create: tests/contract/canonical-json.test.ts
- Create: tests/contract/workbench-outcome.test.ts
- Create: tests/contract/registry-types.test.ts
- Create: tests/contract/shared-import-boundary.test.ts

**Interfaces:**

- Produces: `JsonValue`, `canonicalJson()`, `canonicalJsonUtf8Bytes()`, `requestHashInput()`, `WorkbenchOutcome<T>`, `WorkbenchTransportResult<T>`, `WorkbenchTransport<R>`, generic `EndpointDefinition<I,O,C>`, and pure ports.

- [ ] **Step 1: Write RED canonicalization tests**

Accept only null, booleans, strings, finite schema-admitted numbers, arrays, and plain own-property objects whose prototype is Object.prototype or null. Sort keys by Unicode code point order and emit only JSON-required escaping. Reject undefined, NaN, Infinity, BigInt, Date, Map, Set, class instances, functions, symbols, accessors, sparse arrays, cycles, unsafe integers, and inherited properties. Measure `new TextEncoder().encode(text).byteLength`.

- [ ] **Step 2: Write RED outcome and generic registry tests**

Use exact types:

~~~ts
export type WorkbenchErrorCode =
  | 'invalid-input'
  | 'source-too-large'
  | 'limit-exceeded'
  | 'version-conflict'
  | 'idempotency-key-reused'
  | 'stale-input'
  | 'not-found'
  | 'invalid-transition'
  | 'unsupported-schema'

export type WorkbenchErrorMessageKey = `workbench.error.${WorkbenchErrorCode}`

export type WorkbenchOutcome<T> =
  | { status: 'accepted'; value: T }
  | { status: 'rejected'; error: { code: WorkbenchErrorCode; messageKey: WorkbenchErrorMessageKey } }

export type WorkbenchTransportResult<T> =
  | { transport: 'connected'; outcome: WorkbenchOutcome<T> }
  | { transport: 'failed'; error: {
      code: 'host-unavailable' | 'cancelled' | 'protocol-invalid' | 'transport-internal'
      incidentId?: string
    } }
~~~

Require an exhaustive `Record<WorkbenchErrorCode, WorkbenchErrorMessageKey>` safe-message lookup. `EndpointDefinition` uses numeric budgets so a concrete registry can set 4,096, 786,432, or 2,883,584 without widening its exact checked value:

~~~ts
export interface EndpointDefinition<I, O, C> {
  inputSchema: z.ZodType<I>
  outputSchema: z.ZodType<O>
  validateOutput(input: I, output: O, context: C): boolean
  maxRequestUtf8Bytes: number
  maxOutcomeUtf8Bytes: number
  sensitivity: 'none' | 'metadata' | 'content'
}
~~~

Freeze browser-compatible dependency ports; hashing is asynchronous so P1 may use Web Crypto without adding a Node module to its browser graph:

~~~ts
export interface HashPort {
  sha256Utf8(value: string): Promise<string>
}

export interface IdPort {
  uuidV4(): string
}

export interface ClockPort {
  nowIso(): string
}
~~~

Every implementation validates the returned lowercase 64-hex digest, canonical lowercase UUID v4, or canonical UTC ISO timestamp at the consuming boundary.

- [ ] **Step 3: Run RED**

~~~bash
npm test -- tests/contract/canonical-json.test.ts tests/contract/workbench-outcome.test.ts tests/contract/registry-types.test.ts tests/contract/shared-import-boundary.test.ts
~~~

- [ ] **Step 4: Implement browser-safe shared code**

`requestHashInput(endpoint, inputWithoutCommandId)` returns canonical JSON bytes for an injected HashPort; it does not import Node crypto. Every concrete registry uses one frozen null-prototype readonly table addressed only after `Object.hasOwn`; Map and prototype traversal are not alternate representations. The import-boundary test walks the complete shared graph and rejects React, `@deepseek-ai`, Cordis, `node:`, filesystem, network, child process, storage, model, provider, credential, global fetch, WebSocket, or EventSource dependencies.

- [ ] **Step 5: Run GREEN**

~~~bash
npm test -- tests/contract/canonical-json.test.ts tests/contract/workbench-outcome.test.ts tests/contract/registry-types.test.ts tests/contract/shared-import-boundary.test.ts
npm run typecheck
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/ports/hash-port.ts packages/workbench/src/ports/id-port.ts packages/workbench/src/ports/clock-port.ts packages/workbench/src/ports/workbench-transport.ts packages/workbench/src/ports/protocol/canonical-json.ts packages/workbench/src/ports/protocol/common.ts packages/workbench/src/ports/protocol/registry.ts packages/workbench/src/ports/protocol/index.ts tests/contract/canonical-json.test.ts tests/contract/workbench-outcome.test.ts tests/contract/registry-types.test.ts tests/contract/shared-import-boundary.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: add strict shared transport primitives"
~~~

### Task 3: Freeze and verify the reusable foundation commit

**Files:**

- Create: tests/contract/no-phase-endpoints-in-foundation.test.ts
- Create: tests/integration/shared-foundation-copy.test.ts
- Create: tests/integration/f0-report.test.ts
- Create: scripts/gates/f0.mjs
- Create: scripts/gates/promote-f0-evidence.mjs
- Modify: docs/ci.md
- Modify after clean verification: docs/probe-results.md
- Generated outside Git: .tmp/dsh-pm-workbench/f0/runs/*/{result.json,report.md,junit.xml,run.final.json}
- Generated outside Git after closure validation: .tmp/dsh-pm-workbench/f0/current-run.json
- Generated outside Git while updating/promoting the pointer: .tmp/dsh-pm-workbench/f0/current-run.lock
- Generated outside Git after authorized promotion: .tmp/dsh-pm-workbench/f0/promotion-receipts/<candidateSetSha256>/promotion-receipt.json

**Interfaces:**

- Produces: a clean F0 code commit, one decision-bound static-verification closure, and a separately authorized documentation-only canonical-ledger commit that H0 and P0 may independently consume by exact recorded identity.

- [ ] **Step 1: Write RED phase-closure tests**

Scan source and compiled TypeScript graphs. F0 must contain no `ProbeEndpointTypes`, `ProductEndpointTypes`, endpoint string, Harness package, repository implementation, fixture loader, React view, model adapter, profile path, or runtime switch. `f0-report.test.ts` additionally requires a closed verification runner and single-document promoter: unique four-file run closure, final-marker-last semantics, marker-owned pointer lock, explicit verification/evidence decision binding, a non-writing candidate render, evidence-decision binding to the candidate-set and per-path SHA-256, immutable promotion receipt, deterministic non-writing `--check`, exact index-blob and committed-blob verification, fixed `docs/probe-results.md` output, and rejection of caller status/result/output overrides.

- [ ] **Step 2: Run RED, implement only the checks, then run GREEN**

~~~bash
npm test -- tests/contract/no-phase-endpoints-in-foundation.test.ts tests/integration/shared-foundation-copy.test.ts tests/integration/f0-report.test.ts
npm run check
npm run build
npm run verify:package
npm run pack:dry
~~~

The existing skeleton build/package checks still pass; they are not a gate result.

- [ ] **Step 3: Commit the F0 verification code**

~~~bash
git add -- tests/contract/no-phase-endpoints-in-foundation.test.ts tests/integration/shared-foundation-copy.test.ts tests/integration/f0-report.test.ts scripts/gates/f0.mjs scripts/gates/promote-f0-evidence.mjs docs/ci.md
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "test: close the shared foundation boundary"
~~~

- [ ] **Step 4: Freeze the clean source and obtain one static-verification decision**

~~~bash
git status --short
git rev-parse HEAD
shasum -a 256 package-lock.json
~~~

Expected: empty status, one recorded F0 source commit, a recomputable lock hash, and accepted path-free installer receipts whose action/network decisions, user/global config hashes, binding hash, and builder-source hash recompute. Then stop and obtain `DSH_PMWB_F0_VERIFICATION_DECISION_ID`, bound only to that source/lock, the fixed static command graph, one unique marker-owned run root, and expiry. It authorizes no dependency/network/browser/Harness/evidence/Git action. Run the repository entry directly:

~~~bash
node scripts/gates/f0.mjs --verification-decision-id "$DSH_PMWB_F0_VERIFICATION_DECISION_ID"
~~~

The runner independently repeats the exact graph, unit, build, package, bootstrap-tool local-fixture, and boundary checks, records the verification decision receipt plus accepted dependency-action receipts, and derives PASS only from their real exits. It writes `result.json`, sanitized `report.md`, and `junit.xml`, then writes `run.final.json` last and only afterward updates the fixed pointer while holding `current-run.lock`. The lock is exclusively created, marker-owned, regular, single-link, and non-symlink; replacement, contention, abandoned ambiguity, or pointer race fails closed. The pointer binds `runId`, source, final hash, and report hash. No real browser, external network, Harness, model, or fixture content is used.

- [ ] **Step 5: Review, separately authorize, promote, check, and commit the static result**

Read the exact completed pointer/closure, recompute every hash, and review its sanitized `report.md`. While holding the same pointer lock, first run the promoter's read-only `--preview` mode with the four explicit closure identities. It writes no file and prints one bounded canonical object containing the sole output path, that candidate byte SHA-256, and `candidateSetSha256`; independently record those values as `DSH_PMWB_F0_CANDIDATE_SET_SHA256` and the path/hash pair. A preview whose pointer identity changes, whose render is not deterministic on a second in-memory pass, or whose output path differs is invalid.

Then stop and obtain `DSH_PMWB_F0_EVIDENCE_DECISION_ID`, distinct from every implementation, dependency, network, and verification decision and bound to the exact source, run ID, final/report hashes, successful sanitization outcome, sole output `docs/probe-results.md`, its exact candidate byte hash, `candidateSetSha256`, and commit message `docs: record observed F0 result`. It authorizes only deterministic rendering of those exact bytes, byte checking, exact staging, and one local commit. `promote-f0-evidence.mjs` consumes that decision plus the four explicit closure identities and candidate-set assertion, holds the same pointer lock through validation/render/write or `--check`, and rejects a stale/racing pointer, dirty source, missing receipt, candidate drift, duplicate run with different bytes, arbitrary path/status, or any write outside the ledger. A successful write creates one immutable, final-written promotion receipt outside Git binding the pointer identity, closure, evidence decision, renderer source hash, output path/hash, and candidate-set hash; its SHA-256 is recorded as `DSH_PMWB_F0_PROMOTION_RECEIPT_SHA256`.

The rendered block appends the exact source commit, lock hash, commands, verification/evidence decision IDs, accepted installer action/network receipt hashes, environment-builder source hash, `userConfigSha256`, `globalConfigSha256`, path-free `configBindingSha256`, and observed PASS/FAIL state to `docs/probe-results.md`. Both config hashes must equal the canonical empty-file digest; no local config path, npmrc content, decision prose, or raw output enters Git. State only that the phase-neutral foundation is statically closed; do not imply Connection RPC, Product behavior, Harness installation, browser, model, or real-data evidence. Promote, prove deterministic bytes, then stage and commit only the ledger:

~~~bash
node scripts/gates/promote-f0-evidence.mjs --run-id "$DSH_PMWB_F0_RUN_ID" --source-commit "$DSH_PMWB_F0_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_F0_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_F0_REPORT_SHA256" --preview
node scripts/gates/promote-f0-evidence.mjs --run-id "$DSH_PMWB_F0_RUN_ID" --source-commit "$DSH_PMWB_F0_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_F0_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_F0_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_F0_CANDIDATE_SET_SHA256" --evidence-decision-id "$DSH_PMWB_F0_EVIDENCE_DECISION_ID"
node scripts/gates/promote-f0-evidence.mjs --run-id "$DSH_PMWB_F0_RUN_ID" --source-commit "$DSH_PMWB_F0_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_F0_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_F0_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_F0_CANDIDATE_SET_SHA256" --evidence-decision-id "$DSH_PMWB_F0_EVIDENCE_DECISION_ID" --promotion-receipt-sha256 "$DSH_PMWB_F0_PROMOTION_RECEIPT_SHA256" --check
git add -- docs/probe-results.md
git diff --cached --name-only
git diff --cached --check
git status --short
node scripts/gates/promote-f0-evidence.mjs --run-id "$DSH_PMWB_F0_RUN_ID" --source-commit "$DSH_PMWB_F0_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_F0_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_F0_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_F0_CANDIDATE_SET_SHA256" --evidence-decision-id "$DSH_PMWB_F0_EVIDENCE_DECISION_ID" --promotion-receipt-sha256 "$DSH_PMWB_F0_PROMOTION_RECEIPT_SHA256" --verify-index
git commit -m "docs: record observed F0 result"
git rev-list --parents -n 1 HEAD
git diff-tree --no-commit-id --raw -r -z "$DSH_PMWB_F0_SOURCE_COMMIT" HEAD
git status --short
~~~

Record the full new evidence commit as `DSH_PMWB_F0_EVIDENCE_COMMIT`, then invoke the same promoter with the same closure/candidate/decision/receipt arguments:

~~~bash
node scripts/gates/promote-f0-evidence.mjs --run-id "$DSH_PMWB_F0_RUN_ID" --source-commit "$DSH_PMWB_F0_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_F0_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_F0_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_F0_CANDIDATE_SET_SHA256" --evidence-decision-id "$DSH_PMWB_F0_EVIDENCE_DECISION_ID" --promotion-receipt-sha256 "$DSH_PMWB_F0_PROMOTION_RECEIPT_SHA256" --verify-commit "$DSH_PMWB_F0_EVIDENCE_COMMIT"
~~~

`--verify-index` reads the staged blob bytes and requires their SHA-256 to equal the immutable promotion receipt immediately before the fixed commit command. `--verify-commit` revalidates the pointer and receipt, reads the committed blob from the exact commit object, and requires the same byte hash. Parse the post-commit objects: the evidence commit has exactly one parent equal to the frozen F0 source, and its NUL-delimited raw diff contains exactly one regular-file modification at `docs/probe-results.md`, with no rename, copy, mode/type substitution, submodule, or second path. A race or byte mismatch invalidates the local evidence candidate; do not amend it or call it accepted—return to the frozen source and obtain a new evidence decision.

H0 and P0 plans record both this evidence commit and its named F0 source commit before implementation; neither inherits authorization for the other phase. Root README points to this canonical ledger, so no mutable phase status is duplicated in package documentation.

## F0 completion rule

All F0 tests and existing repository checks pass from one clean source commit under the exact verification decision, the shared graph contains neither Probe nor Product behavior, and a separate evidence-decision-bound canonical-ledger commit with the verified single-parent/single-path topology names that source. This is static foundation evidence only.

~~~text
STOP — report the F0 commit and checks, then wait for a separate H0 or P0 authorization.
~~~
