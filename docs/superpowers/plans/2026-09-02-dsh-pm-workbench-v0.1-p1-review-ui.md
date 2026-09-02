# DSH PM Workbench P1 Shell-neutral Review UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Implement and verify the production `WorkbenchView` as a shell-neutral, keyboard-operable React interface for the fixed synthetic discovery flow, using the accepted P0 service and no Harness runtime.

**Architecture:** Mount the real `WorkbenchView` in a minimal test shell. Inject only `WorkbenchApi`, a reviewed fixture loader, and browser-safe download/focus ports. Connect the API to `InProcessTransport<ProductEndpointTypes>`, `InMemoryProjectRepository`, and `FixtureAnalysisEngine`; retain unfinished form state in the Client while treating Host-style API snapshots as authoritative.

**Tech Stack:** TypeScript 6.0.3, React 18.3.1, React DOM 18.3.1, Vitest 3.2.7, jsdom 26.1.0, Playwright Test 1.62.1, esbuild 0.25.12, and the accepted P0 Product contract.

**Spec:** ../specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md

## Global Constraints

- P1 branches from the exact accepted P0 evidence commit on the accepted P0 line. That report must name the frozen P0 source commit descended from the exact accepted F0 evidence tip and must preserve the frozen F0 source commit named by that tip's ledger block. Before work, record the F0 evidence tip, its named F0 source commit, P0 frozen source commit, P0 evidence commit, and P0 report hash, then obtain separate P1 implementation authorization; a nearby branch name or a green local test run is not a substitute.
- Create the P1 worktree in creation-only mode. The `superpowers:using-git-worktrees` invocation may perform detection and worktree/branch creation only; its automatic project-setup and baseline-test steps are explicitly overridden for this plan. It must not run `npm install`, `npm ci`, a package script, browser install, local server, or browser. If the available native worktree mechanism cannot suppress automatic setup, stop before creation rather than accepting an implicit install.
- Worktree creation, exact-lock hydration, a public-registry hydration retry, dependency/lockfile mutation, its exact public-registry download, browser-binary download policy and download, development browser runtime, the final frozen P1 acceptance run, human sanitization acceptance, and evidence write/commit are distinct authorization scopes. Every action authorization has a canonical ID bound to its exact source, policy/artifacts, action graph, output boundary, scope, and expiry; the responsible repository-owned wrapper receives and records that ID. Approval of any one does not authorize another, and an ID cannot be omitted, replayed outside its declared action graph, or substituted across scopes.
- The new worktree starts without inherited or parent-resolved dependencies. Before P1 baseline tests, hydrate only the accepted P0 `package-lock.json` through F0's already accepted `--hydrate-lock` mode as exercised in Task 0. Hydration may write that worktree's ignored `node_modules` and its marker-owned cache only after explicit authorization; it may not modify either manifest or the lock, use lifecycle scripts, follow a parent checkout, or select newer versions.
- P1 mounts the production `WorkbenchView`, not a screenshot-specific duplicate, Storybook-only mock, or static HTML facsimile.
- P1 does not load DeepSeek Harness, Cordis, Connection RPC, storageDomain, any DSH profile, the active 127.0.0.1:3080 service, or the ripple theme.
- P1's build and acceptance inputs are the exact owner-reviewed R1/R2 files and raw-byte hashes in the accepted fixture manifest. The Product service authorizes the two **normalized identities**, not a raw-byte spelling: a BOM-, CRLF/bare-CR-, or NFC/NFD-equivalent input is accepted only when the shared normalization algorithm produces exactly an accepted R1/R2 content hash. Any change to the normalized scalar sequence is rejected before a write. P1 does not read Desktop, Downloads, clipboard history, browser sessions, arbitrary paths, recordings, or real interview material.
- P1 production code and its development/acceptance runtime do not call a model, provider, external network, credential store, Agent, Subagent, or product shell command. The isolated test runner may start only its own loopback static server and manifest-bound Chromium process with fixed arguments. The separately authorized Chromium bootstrap is the sole P1 external-network exception and is restricted to its fixed owner-reviewed origin/redirect policy.
- The UI labels fixture output as `示例分析草稿 / fixture`; it never says that AI analyzed the interview or that a requirement is user-confirmed before a human decision and baseline publication.
- There is no default accept-all action. Edit, reject, and defer require a non-blank reason; baseline publication is a separate confirmation.
- Incomplete pages or chunks never become authoritative UI state or downloadable content.
- Formal project data, command receipts, source text, analysis, decisions, baselines, PRDs, and unsaved edits must never be written to `localStorage`, `sessionStorage`, IndexedDB, Cache Storage, cookies, service workers, or any other Client-side persistent store. Formal state comes from `WorkbenchApi`; unfinished drafts exist only in the mounted Client instance and are explicitly discarded on remount.
- Temporary browser output is written only below `.tmp/dsh-pm-workbench/p1`; screenshots, traces, console dumps, browser profiles, and raw logs do not enter Git.
- The production Client graph is fail-closed against network, process, filesystem, model/provider, Harness, Connection, storageDomain, dynamic-code, and browser-persistence APIs. The test harness proves the rule with transitive graph inspection, runtime denial, and malicious mutation fixtures; simple source-string searching is not sufficient evidence.
- Every task stages only the exact paths in its `Files` list. Before each commit, run `git diff --cached --check`, print `git diff --cached --name-only`, compare that output with the task's explicit `git add` allowlist, and inspect `git status --short` for unrelated work. Any missing or additional path is a stop; directory-wide adds, `git add .`, and `git add -A` are forbidden.
- Required Vitest and Playwright files are passed explicitly to their local runners. A missing file, zero collected tests, skipped/focused test, missing Chromium, missing viewport, browser crash, or incomplete result is FAIL or INCONCLUSIVE and can never be promoted to PASS.
- Downloading Chromium does not authorize executing it. Before the first development Playwright command or loopback test server, obtain a separate bounded development browser-runtime authorization. The final direct-Node `p1` runner against the frozen commit requires a new acceptance-runtime authorization even if development browser runs were already approved. Networked bootstrap and browser runtime entrypoints are invoked directly through `process.execPath`; an outer `npm run` must not read inherited npm configuration or select a script shell before the repository wrapper validates authorization and sanitizes its children.
- `docs/probe-results.md` is the only mutable canonical phase-status ledger. Before the P1 source freezes, `README.md`, `SECURITY.md`, `docs/compatibility.md`, and the three package-local documents state only immutable build-time/source boundaries and point to that ledger; the P1 promoter never rewrites them. Neither root nor package documentation may present `NOT_RUN`, PASS, FAIL, INCONCLUSIVE, or another mutable gate state as a permanently current fact.
- P1 PASS proves only the shell-neutral review flow in the recorded test shell. It does not prove Harness installation, overlay behavior, Connection RPC, storage, real AI, real-data privacy, or distribution.

---

### Task 0: Create an inert worktree and hydrate the accepted lock independently

**Files:**

- Generated outside Git: the creation-only worktree for local branch `codex/pmwb-p1-review-ui`
- Generated outside Git after separate authorization: node_modules and .tmp/dsh-pm-workbench/dependency-hydration/<hydrationId> inside that worktree, including the canonical hydration action decision ID, any used network decision ID, and path-free invocation receipt

**Interfaces:**

- Consumes: the full accepted P0 evidence commit SHA, its recorded `package-lock.json` SHA-256, the accepted F0 npm-CLI resolver, separate P1 implementation/worktree authorization, and a canonical exact-lock hydration decision; a network retry requires a second canonical decision.
- Produces: a creation-only P1 worktree, an independently verified `install-exact-dependencies.mjs --hydrate-lock` run, a manifest/lock-preserving dependency tree, and a verified accepted-P0 baseline. It creates no tracked file and does not install P1's new dependencies or a browser.

- [ ] **Step 1: Create only the isolated checkout**

Use `superpowers:using-git-worktrees` with this plan's explicit creation-only override. Exclusively create a new `codex/pmwb-p1-review-ui` worktree from the full accepted P0 evidence SHA recorded in `docs/probe-results.md`; do not reuse an existing path/branch or create it from a moving branch. Immediately verify `HEAD`, branch name, worktree/common Git directories, clean tracked/untracked status, and absence of `node_modules`. If the tool ran setup, a package command, or a baseline test, preserve the observation, remove no evidence automatically, and stop: that worktree is not an accepted P1 starting point.

- [ ] **Step 2: Verify the inherited dependency-free hydration contract**

Before any package-manager or third-party-module command, verify that the inherited installer, Node-only contract test, and their recorded hashes are exactly those accepted by F0/P0. Run only the inherited Node-built-in test:

~~~bash
node --test tests/bootstrap/exact-lock-hydration.node.test.mjs
~~~

Expected: PASS without resolving a third-party package, writing `node_modules`, launching npm, or accessing the network. The test fixes the accepted `--hydrate-lock` modes, exact `npm ci --ignore-scripts --no-audit --no-fund` command plan, manifest/lock byte preservation, marker-owned HOME/XDG/cache plus distinct empty `NPM_CONFIG_USERCONFIG`/`NPM_CONFIG_GLOBALCONFIG` files, config-binding receipt, environment stripping, parent-resolution refusal, installed-tree integrity checks, and symlink/realpath containment. A missing file, hash drift, or failed contract stops P1; P1 must not patch the inherited installer to make the preflight pass.

- [ ] **Step 3: Obtain exact-lock hydration authorization and hydrate offline once**

The action authorization must name only the new worktree, ignored `node_modules` write, marker-owned hydration root, accepted lock, expiry, and F0's closed offline-first/verified-cache-miss/one-public-registry-retry state machine. Record its canonical ID as `DSH_PMWB_P1_HYDRATION_DECISION_ID`. By itself it does not permit the second stage's public-registry access, manifest/lock mutation, P1 dependency changes, Chromium download/execution, a server, or Harness. Only after approval run:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --offline --action-decision-id "$DSH_PMWB_P1_HYDRATION_DECISION_ID"
~~~

If the audited offline mode reports an immutable verified cache-miss receipt, stop. Only a new public-registry authorization bound to that exact receipt, the original action state machine, fixed registry, source/lock/output, and exact second-stage argv, recorded as `DSH_PMWB_P1_HYDRATION_NETWORK_DECISION_ID` and distinct from the action ID, may permit exactly:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --public-registry-network --action-decision-id "$DSH_PMWB_P1_HYDRATION_DECISION_ID" --network-decision-id "$DSH_PMWB_P1_HYDRATION_NETWORK_DECISION_ID"
~~~

The installer validates the action decision against the complete state machine before either output allocation and validates the miss receipt plus distinct network extension before the retry. It rejects direct stage-two entry or any source/lock/output/argv drift, retains the npm child argv exactly as audited, and records every applicable decision ID in the path-free hydration receipt without forwarding either ID to npm. If any package needs a lifecycle script, the exact lock cannot be satisfied, package or lock bytes change, an installed version/integrity differs, a parent module resolves, or a symlink escapes, stop and discard no evidence automatically.

- [ ] **Step 4: Verify the accepted P0 baseline inside the hydrated worktree**

~~~bash
node --test tests/bootstrap/exact-lock-hydration.node.test.mjs
npm test -- tests/integration/exact-dependency-installer.test.ts
npm run check
git diff --check
git status --short
~~~

Expected: the accepted P0 suite remains green, the hydration manifest and installed-tree hash revalidate, manifests and lock retain their recorded hashes, `node_modules` is ignored and local to this worktree, and tracked/untracked status is empty. A baseline failure stops P1 implementation for owner review.

---

### Task 1: Add a deterministic DOM and real-browser test shell

**Files:**

- Modify: package.json
- Modify: package-lock.json
- Modify: vitest.config.ts
- Modify: tsconfig.tests.json
- Modify: tests/integration/standalone-copy.test.ts
- Create: playwright.p1.config.ts
- Create: tests/support/dom-setup.ts
- Create: tests/ui-shell/index.html
- Create: tests/ui-shell/main.tsx
- Create: tests/ui-shell/create-test-workbench.ts
- Create: tests/ui-shell/browser-test-ports.ts
- Create: scripts/ui-shell/build.mjs
- Create: scripts/ui-shell/serve.mjs
- Create: scripts/ui-shell/run-playwright.mjs
- Reuse unchanged from the accepted F0 source: scripts/bootstrap/policy-fetch.mjs
- Reuse unchanged from the accepted F0 source: scripts/bootstrap/materialize-browser.mjs
- Reuse unchanged from the accepted F0 source: tests/bootstrap/policy-fetch.node.test.mjs
- Reuse unchanged from the accepted F0 source: tests/bootstrap/browser-materializer.node.test.mjs
- Create: scripts/bootstrap/p1-browser.mjs
- Create: scripts/ui-shell/verify-client-boundary.mjs
- Create: tests/contract/ui-test-boundary.test.ts
- Create: tests/security/p1-execution-boundary.test.ts
- Create: tests/security/p1-browser-bootstrap.test.ts
- Create: tests/security/p1-fixture-build-boundary.test.ts
- Create: tests/fixtures/ui-boundary/forbidden-node-entry.tsx
- Create: tests/fixtures/ui-boundary/forbidden-browser-api-entry.tsx
- Create: tests/ui/test-shell-smoke.test.tsx
- Create: tests/e2e/review-ui.spec.ts
- Generated outside Git after separate owner review: .tmp/dsh-pm-workbench/gate-inputs/p1-browser-download-policy.json
- Generated outside Git after separate browser-download authorization: .tmp/dsh-pm-workbench/gate-inputs/p1-browser/<bootstrapId>/**
- Generated outside Git by each authorized development browser run: .tmp/dsh-pm-workbench/p1/development-runs/<devRunId>/{result.json,report.md,junit.xml,run.final.json,playwright/**}
- Generated outside Git by the development decision validator: .tmp/dsh-pm-workbench/p1/development-decisions/<decisionId>/{usage.json,usage.lock}

**Interfaces:**

- Produces: `createTestWorkbench()`, browser-safe Web Crypto test ports, a production-view mount point, a loopback-only static shell, explicit jsdom test selection, a direct-Node repository-owned Chromium bootstrap, and decision-bound development browser-run closures.
- Consumes: the exact accepted P0 commit, `WorkbenchApi`, `InProcessTransport<ProductEndpointTypes>`, `InMemoryProjectRepository`, the strict fixture loader, the fixed fixture/golden manifests, the inherited hash-bound policy downloader/materializer and their tests, and—only for browser bootstrap—the exact fixed owner-reviewed download-policy input plus its separate canonical authorization.

- [ ] **Step 1: Write the RED boundary and smoke tests**

The boundary test must fail until all of these are true:

~~~text
Vitest includes tests/**/*.test.ts and tests/**/*.test.tsx
Playwright includes only tests/e2e/**/*.spec.ts
DOM tests opt into jsdom explicitly
browser artifacts resolve below .tmp/dsh-pm-workbench/p1
the static server host is exactly 127.0.0.1
the requested port is not 3080
the child process uses process.execPath, fixed argv, shell:false, and an allowlisted environment
the exact root dev-package add requires distinct action and fixed-public-registry network decision IDs, passes neither ID to npm, and can reach the fixed npm CLI only through F0's shared sanitized builder and exact child argv
the Chromium bootstrap consumes exactly the fixed owner-reviewed download-policy input, which binds the exact initial archive URL, one closed set of owner-confirmed official Playwright HTTPS origins for initial requests/redirects, exact archive SHA-256 and byte length/cap, archive format/root/executable relative path, Playwright tool version, and Chromium revision, with no default, environment, or discovered-host extension
PLAYWRIGHT_DOWNLOAD_HOST, PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST, every PLAYWRIGHT_*_DOWNLOAD_HOST alias, every other inherited PLAYWRIGHT_* key, proxy, registry/auth, credential, NODE_OPTIONS, and custom-CA overrides are rejected before any network request or materializer child launch and absent from every child environment; bootstrap sets no PLAYWRIGHT_BROWSERS_PATH, while later runtime wrappers derive that path only from the accepted immutable manifest
the repository-owned fetcher uses redirect:'manual' or an equivalent no-auto-follow API, validates the exact initial URL/origin before its request and every resolved redirect URL/origin before following it, and accepts no response body bytes until the current URL passes; downgrade, userinfo, loop, limit overflow, malformed Location, or an unlisted target fails closed
the temporary archive is exclusive and marker-owned, cannot exceed the policy byte cap, and must equal the policy's exact length and SHA-256 before materialization; failure publishes no partial browser tree
the offline materializer accepts only the downloader's retained no-follow archive descriptor/identity, preflights the ZIP central directory and every referenced local header from that same descriptor, requires their names/flags/methods/CRC/sizes/offsets and bounded non-overlapping data ranges to agree, verifies every supported entry's CRC/size/content SHA-256, unlinks the temporary name, maps the retained descriptor to child fd 3, and invokes only /usr/bin/ditto -x -k /dev/fd/3 with fixed argv/stdio and shell:false into a new staging root; a synthetic production-entry capability check binds the exact ditto/Darwin identity, and the post-walk must match every preflight path/type/mode/size/content hash before publication
the immutable browser manifest records the bootstrap decision ID, policy bytes/hash, exact archive URL/hash/length/format/root/executable, allowed origins, redirect ceiling, observed request/redirect chain, ditto identity/argv, and browser-tree hash
the development browser wrapper requires DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID before server/browser launch, atomically consumes exactly one still-unused ordered action occurrence declared by that decision, and writes the decision/occurrence IDs plus source/bootstrap/spec/project/exit/artifact hashes into a unique final-marker-last development closure
tests/ui-shell exposes one owned root and receives test composition ports without implementing business endpoint results
no Harness, Connection, storageDomain, model, provider, credential, or remote URL import exists in the test shell graph
the full transitive Client graph and executable browser-shell graph contain no filesystem, process, shell, model/provider, network, dynamic-code, or persistent-browser-storage access
the boundary checker rejects both malicious fixtures before either fixture can run
fixtures/synthetic is copied by standalone-copy; interviews, recordings, transcripts, user-data, browser profiles, and .tmp are excluded
the Node build accepts only strict-loaded regular files whose realpaths, same-read hashes, two-revision set digest, and owner receipt match
symlink, identity-swap, manifest drift, or a third fixture path fails before bundling
~~~

The initial smoke test mounts the minimal shell bootstrap, expects exactly one owned root plus a `test-shell-ready` marker, and proves the shell can receive the P0 in-process composition without rendering or fabricating endpoint results. `browser-test-ports.ts` implements the accepted asynchronous HashPort and CursorCodec with `crypto.subtle` SHA-256/HMAC plus deterministic test ClockPort/IdPort; it has no Node import, remote call, or persistence. Cross-runtime vectors must match P0's Node test adapters byte-for-byte. The file is test-shell composition only and cannot enter the H1 Product graph. The smoke test fails until this deterministic shell infrastructure exists; production `WorkbenchView` mounting begins in Task 3.

- [ ] **Step 2: Run RED**

~~~bash
node --test tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
npm test -- tests/contract/ui-test-boundary.test.ts tests/security/p1-execution-boundary.test.ts tests/security/p1-browser-bootstrap.test.ts tests/security/p1-fixture-build-boundary.test.ts tests/ui/test-shell-smoke.test.tsx
~~~

Expected: all seven named files are collected by their stated runners. The two inherited Node-only bootstrap files must already PASS unchanged under `node --test`; the five P1-owned Vitest files fail on missing exact dependencies, deterministic test shell, boundary checker, phase wrapper/decision binding, fixed download policy, hostile override/redirect rejection, and malicious-fixture rejection. Vitest must not collect or substitute for either inherited Node-only file. A changed inherited shared file, a production bootstrap path that bypasses those modules, or zero collected tests is a failed RED run.

- [ ] **Step 3: Obtain explicit dependency and network authorizations, then pin versions**

Only after Task 0's accepted-lock hydration and baseline pass, obtain a new authorization for the exact P1 package-manifest/lock mutation and worktree-local install, bound to the source, pre-add lock, exact root dev packages, output root, and expiry; record its canonical ID as `DSH_PMWB_P1_DEPENDENCY_DECISION_ID`. Obtain a distinct exact-public-registry network authorization bound to that same operation and fixed registry as `DSH_PMWB_P1_DEPENDENCY_NETWORK_DECISION_ID`; neither hydration decision covers this step. Use F0's audited installer with exact versions:

~~~bash
node scripts/install-exact-dependencies.mjs --save-dev --save-exact jsdom@26.1.0 @playwright/test@1.62.1 --action-decision-id "$DSH_PMWB_P1_DEPENDENCY_DECISION_ID" --network-decision-id "$DSH_PMWB_P1_DEPENDENCY_NETWORK_DECISION_ID"
~~~

The runner validates and records both IDs before invoking F0's audited builder with the fixed public registry, unique marker-owned HOME/XDG/npm cache, distinct empty `NPM_CONFIG_USERCONFIG`/`NPM_CONFIG_GLOBALCONFIG` files, stripped config/auth/token/proxy/provider environment, recorded npm CLI, `shell: false`, and literal child argv `install --ignore-scripts --no-audit --no-fund --save-dev --save-exact jsdom@26.1.0 @playwright/test@1.62.1` plus the fixed registry. Neither decision ID enters npm argv. Do not use `latest`, a caret, package lifecycle scripts, a globally installed binary, a user/global npmrc, or a transitive Playwright from another checkout. This step installs packages only and must not download Chromium. Record both decision IDs, exact versions/integrity, and the path-free config-binding receipt in the lock evidence and re-run RED.

- [ ] **Step 4: Add a separately authorized, repository-owned Chromium bootstrap**

Before implementation may treat a browser download as eligible, the owner reviews exactly one fixed non-Git input at `.tmp/dsh-pm-workbench/gate-inputs/p1-browser-download-policy.json`. Its canonical bytes bind the exact initial HTTPS archive URL; exact Playwright package/tool version and expected Chromium revision; one ordered non-empty set of exact owner-confirmed official Playwright HTTPS origins allowed for the initial request and redirects; a finite redirect ceiling; exact archive SHA-256 and byte length, with that length also serving as the hard byte cap; literal ZIP archive format; exactly one expected top-level root; and the expected regular executable relative path. The later browser-download authorization binds the hash of these already reviewed bytes, exact source commit, archive/tool/browser identities, fixed action graph/output root, scope, and expiry, avoiding any policy/decision hash cycle. The actual URL and origins are supplied only by that owner-reviewed input; this plan intentionally does not guess them. The archive URL must be HTTPS with no userinfo or fragment. Origin entries are bare HTTPS origins with no userinfo, path, query, fragment, wildcard, IP-literal/private/loopback destination, or downgrade. `p1-browser.mjs` accepts only `--bootstrap-decision-id <canonical-id>`; it accepts no URL, host, policy path, output path, redirect, hash, length, revision, or materializer override. It opens the fixed policy as a regular non-symlink single-link file, proves same-open identity and same-read bytes/hash, and fails before network access on absence, drift, ambiguity, expired/wrong-scope decision, reused cross-scope ID, or a decision that does not name that exact policy and source.

`p1-browser.mjs` imports the accepted F0 `policy-fetch.mjs` and `materialize-browser.mjs` by exact inherited source hash; it does not invoke Playwright's stock `install chromium` downloader and has no `npx`, npm-script, global binary, PATH-selected tool, or automatic mirror fallback. Before any request or materializer child, the direct-Node wrapper rejects every inherited case-insensitive `PLAYWRIGHT_*` key—including `PLAYWRIGHT_DOWNLOAD_HOST`, `PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST`, and future-shaped download-host aliases—plus `HTTP_PROXY`, `HTTPS_PROXY`, `ALL_PROXY`, `NO_PROXY`, their lowercase/npm variants, every inherited npm configuration key, registry/auth/token/cookie/password/secret/credential/API-key/provider variable, `NODE_OPTIONS`, `NODE_EXTRA_CA_CERTS`, `SSL_CERT_FILE`, and `SSL_CERT_DIR`; none enters a child environment. It creates fresh marker-owned HOME/TMP/XDG/cache paths and sets no download host or proxy.

`policy-fetch.mjs` validates the policy's exact initial URL and origin before making the first request. It uses `redirect: 'manual'` or an equivalent no-auto-follow HTTPS primitive. For every 3xx response it resolves `Location` without consuming response body bytes, rejects missing/malformed/userinfo/non-HTTPS/downgrade/loop/over-limit targets, validates the next exact origin against the frozen ordered allowlist, closes the prior response, and only then issues the next request. For the final response it validates the current exact URL/origin and status before consuming any body byte. It writes to one exclusively created marker-owned temporary regular file, aborts as soon as the exact policy length/cap would be exceeded, requires any Content-Length to equal the policy, requires the observed byte count and SHA-256 to equal the reviewed values, fsyncs and same-read verifies that open file, and exposes it to the materializer only by the retained verified identity. Failure closes and removes only the still-proven marker-owned temporary file and never publishes a partial browser tree.

`materialize-browser.mjs` is offline and accepts only the policy-bound ZIP format plus the downloader's still-open exclusive no-follow descriptor and immutable device/inode/length/hash receipt; no pathname or caller fd can select the archive. From that same descriptor it parses the central directory and every referenced local header, requires exact agreement of decoded name, general-purpose flags, compression method, CRC, compressed/uncompressed sizes, and data offset/range, then reads/decompresses every supported regular-file interval to verify CRC/size and record a content SHA-256. It rejects data descriptors, ZIP64/multi-disk ambiguity, truncated or overlapping records/data, trailing unaccounted payload, absolute paths, `..`, duplicate/case/Unicode-normalization-colliding names, symlink, hardlink, special/sparse/device entries, encrypted or ambiguous members, an unexpected top-level root, or an entry that could escape or overwrite another. After revalidating descriptor identity/hash it unlinks and verifies disappearance of the temporary archive name, rewinds the descriptor, maps it to child fd 3, and invokes exactly `/usr/bin/ditto -x -k /dev/fd/3 <new-marker-owned-staging-root>` through `spawn('/usr/bin/ditto', fixedArgs, { shell: false, env: allowlist, stdio: fd3Binding })`. A production-entry synthetic ZIP capability test first proves the exact `/usr/bin/ditto` and accepted macOS platform can consume this fd-3 binding; failure is unsupported/INCONCLUSIVE, with no pathname or PATH fallback. After extraction a no-follow walk requires only regular single-link files/directories beneath the staging realpath, exactly one policy-named root and regular executable at the policy-named relative path, and exact equality with every preflight path/type/mode/size/content digest. A failure removes only a still-proven exclusive staging root. No archive or staging bytes become the accepted browser root until every check passes and the complete tree is atomically published.

The wrapper publishes only a newly marked `.tmp/dsh-pm-workbench/gate-inputs/p1-browser/<bootstrapId>/`, keeps the materialized tree read-only, and writes immutable `manifest.json` last. The manifest records `DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID`; source commit; exact policy bytes/SHA-256; initial archive URL; ordered allowed origins; redirect ceiling and observed initial/redirect URL+origin chain; expected and observed archive SHA-256/length; archive format/root/executable; Playwright tool/Chromium identities; shared downloader/materializer source hashes; sanitized-environment receipt; `/usr/bin/ditto` identity/fixed argv; and complete browser-tree mode/hash manifest. It rejects unexpected versions, policy/request/materialization drift, symlink or path escape, existing/partial output, a previously consumed or cross-scoped decision ID, and any repository lock or `node_modules` mutation. Add the P1 wrapper, but do not run it without separate authorization. The only authorized production entry is direct Node, never an outer npm script:

~~~bash
node scripts/bootstrap/p1-browser.mjs --bootstrap-decision-id "$DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID"
~~~

Running this wrapper requires a separate browser-binary download authorization recorded as `DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID`; it names the reviewed policy hash and all policy-bound download/materialization identities above. Package-install or exact-lock hydration authorization does not cover it. The wrapper downloads, verifies, and materializes bytes only: it must not launch Chromium, start the static server, or run Playwright tests. The inherited Node-only `tests/bootstrap/policy-fetch.node.test.mjs` and `tests/bootstrap/browser-materializer.node.test.mjs` exercise the exact production modules under `node --test`, while the P1-owned Vitest file `tests/security/p1-browser-bootstrap.test.ts` proves the phase wrapper cannot bypass them. Vitest must not collect or replace the two inherited Node-only suites. Tests inject both named Playwright host overrides, a future-shaped alias, other inherited Playwright/npm/proxy/credential/CA values, an unlisted redirect, downgrade, userinfo, missing/malformed Location, redirect loop/overflow, oversized/short/hash-wrong archive, post-hash pathname replacement, descriptor identity drift, caller-fd injection, fd-3 capability failure, central/local-header name/flag/method/CRC/size/offset disagreement, entry-content mismatch, truncated/overlapping/trailing ZIP data, malicious archive paths/types, ditto failure, post-extract substitution, wrong root/executable, and publication race; no disallowed body, archive, partial tree, or manifest may survive. The browser runner consumes only one exact verified read-only manifest/root and revalidates its decision, policy, redirect, archive, descriptor, materialization, and tree receipts. A missing/drifting input leaves browser evidence INCONCLUSIVE and is never repaired by invoking Playwright's downloader or widening the list.

- [ ] **Step 5: Separate DOM unit tests from browser acceptance**

`vitest.config.ts` keeps Node as the default environment and includes `.test.tsx`. DOM files use the exact file pragma `@vitest-environment jsdom`; no global browser shim is applied to domain or Host tests. `playwright.p1.config.ts` names two ordinary projects plus one dedicated headed native-zoom project for each required viewport, and the local runner always passes that config explicitly:

~~~ts
projects: [
  { name: 'chromium-1440', use: { browserName: 'chromium', viewport: { width: 1440, height: 900 } } },
  { name: 'chromium-1024', use: { browserName: 'chromium', viewport: { width: 1024, height: 768 } } },
  { name: 'chromium-1440-native-zoom', use: {
      browserName: 'chromium', viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 1, headless: false,
    } },
  { name: 'chromium-1024-native-zoom', use: {
      browserName: 'chromium', viewport: { width: 1024, height: 768 },
      deviceScaleFactor: 1, headless: false,
    } },
]
~~~

Set `retries: 0`, `workers: 1`, screenshots to `only-on-failure`, trace to `retain-on-failure`, and output below the current unique run directory. Both native-zoom projects keep `deviceScaleFactor: 1` and their declared 1440×900 or 1024×768 configured viewport; neither may use mobile emulation, a smaller viewport, CSS zoom/transform, screenshot scaling, or a CDP page-scale override. The direct-Node local runner resolves the Playwright test CLI from exact local `@playwright/test@1.62.1`, passes only its canonical development-runtime decision argument followed by explicit spec files/projects, uses the exact read-only browser root named by the verified bootstrap manifest, and has no `npm run`, `npx`, downloader, or global-binary fallback. Under a regular, single-link, non-symlink exclusive `usage.lock`, each invocation matches its exact command fingerprint and ordinal to one still-unused occurrence in the decision's immutable ordered action manifest, atomically reserves it in `usage.json`, and refuses an already consumed, missing, reordered, excess, or concurrently claimed occurrence; duplicate command text at different plan steps remains distinct by ordinal. An abandoned or identity-drifting lock fails closed and is never silently removed. The invocation then exclusively creates `.tmp/dsh-pm-workbench/p1/development-runs/<devRunId>/`, writes sanitized `result.json`, `report.md`, and `junit.xml`, and writes `run.final.json` last with the development decision and occurrence IDs, exact source identity, bootstrap decision/manifest/tree identities, exact spec/project argv, exit status, and sibling hashes. Playwright raw output and the development usage ledger remain below `.tmp` and never enter Git or final P1 evidence.

- [ ] **Step 6: Build, audit, and serve the real shell safely**

`build.mjs` bundles the minimal `tests/ui-shell/main.tsx` and emits an esbuild metafile; Task 3 replaces the bootstrap with the production view. The Node build step calls `load-reviewed-fixture.mjs` with no caller-selected path, consumes its same-read R1/R2 bytes and accepted identities, and embeds only those data; the browser never fetches or resolves a filesystem path. A symlink, realpath escape, opened-file identity change, manifest/golden drift, or hash mismatch aborts before output. `verify-client-boundary.mjs` walks every transitive production Client input and output import and every executable browser-shell input, parses TypeScript/JavaScript syntax, and rejects `@deepseek-ai`, Cordis, storageDomain, Node built-ins, process/shell/filesystem APIs, model/provider SDKs, `eval`/`Function`, remote URLs, `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, service workers, cookies, Cache Storage, `localStorage`, `sessionStorage`, and IndexedDB. The runner/build scripts themselves are outside the browser graph and separately restricted to their fixed operations. The same checker must reject `forbidden-node-entry.tsx` and `forbidden-browser-api-entry.tsx`; if either mutation passes, P1 is No-Go.

`serve.mjs` serves only its generated directory, rejects traversal and dotfiles, binds `127.0.0.1`, rejects port 3080, sends fixed MIME types, and exposes no directory listing. Before creating a run root, `run-playwright.mjs` requires `--development-runtime-decision-id <canonical-id>`, validates that decision against the current source, exact bootstrap policy/manifest/tree, requested closed spec/project graph, loopback action, output scope, expiry, and the next exact unused action occurrence, and rejects a bootstrap/acceptance/cross-source/out-of-order/replayed ID. One development decision may cover only the explicitly declared ordered Tasks 1–8 action graph on this exact source line; every declared occurrence is consumable once, every invocation records its occurrence in a new closure, and the decision expires with that graph. The wrapper starts the server through `spawn(process.execPath, fixedArgs, { shell: false, env: allowlist })`, waits for a random OS-assigned loopback port, invokes only the exact local Playwright test CLI, and always terminates the server. Chromium uses fixed flags that disable background networking, component updates, domain reliability, and sync. A Playwright route denies every request except `GET`/`HEAD` to that exact loopback origin. Before the production view initializes, an init guard makes `fetch`, XHR, WebSocket, EventSource, `sendBeacon`, service-worker registration, persistent-storage writes, and dynamic code throw. Only the runner may spawn the fixed server and Chromium processes; no production module receives a process handle.

- [ ] **Step 7: Obtain the bounded development browser-runtime authorization**

This is the first point at which P1 may start its loopback test server or execute Chromium. Obtain an explicit development-runtime authorization recorded as `DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID`, covering only the exact ordered direct-Node `scripts/ui-shell/run-playwright.mjs` occurrences listed in Tasks 1–8, their command fingerprints and ordinals, the fixed `127.0.0.1` random non-3080 server, the exact manifest-bound Chromium binary, named Playwright files/projects, and unique development closures below `.tmp/dsh-pm-workbench/p1/development-runs`. It must be distinct from `DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID`; each enumerated occurrence may be atomically consumed once, and the decision cannot authorize an extra/reordered/repeated occurrence or be replayed after graph completion/expiry. It does not authorize the final frozen `scripts/gates/p1.mjs` acceptance run, another browser binary, Harness, an external URL, or network access beyond the fixed loopback origin. Without this authorization, stop before the direct-Node command; do not mark Task 1 complete from DOM tests alone.

- [ ] **Step 8: Run GREEN**

~~~bash
node --test tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
npm test -- tests/contract/ui-test-boundary.test.ts tests/security/p1-execution-boundary.test.ts tests/security/p1-browser-bootstrap.test.ts tests/security/p1-fixture-build-boundary.test.ts tests/ui/test-shell-smoke.test.tsx
npm run typecheck
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

Expected: PASS with both inherited Node-only bootstrap files, all five named P1 Vitest files, and the named Playwright spec collected by their stated runners; every hostile download/redirect/archive/materialization case is rejected before disallowed body transfer or retained partial output, both malicious fixtures are rejected by the production checker, the unique development closure is bound to the correct decision ID, and no Harness or non-loopback runtime network access occurs. A downloaded binary without the separate development browser-runtime authorization is not executable evidence; if either the binary or that authorization is absent, the browser command is not run and Task 1 remains INCONCLUSIVE.

- [ ] **Step 9: Commit**

~~~bash
git add -- package.json package-lock.json vitest.config.ts tsconfig.tests.json playwright.p1.config.ts tests/support/dom-setup.ts tests/ui-shell/index.html tests/ui-shell/main.tsx tests/ui-shell/create-test-workbench.ts tests/ui-shell/browser-test-ports.ts scripts/ui-shell/build.mjs scripts/ui-shell/serve.mjs scripts/ui-shell/run-playwright.mjs scripts/bootstrap/p1-browser.mjs scripts/ui-shell/verify-client-boundary.mjs tests/contract/ui-test-boundary.test.ts tests/security/p1-execution-boundary.test.ts tests/security/p1-browser-bootstrap.test.ts tests/security/p1-fixture-build-boundary.test.ts tests/fixtures/ui-boundary/forbidden-node-entry.tsx tests/fixtures/ui-boundary/forbidden-browser-api-entry.tsx tests/ui/test-shell-smoke.test.tsx tests/e2e/review-ui.spec.ts tests/integration/standalone-copy.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "test: add the shell-neutral UI harness"
~~~

The staged-name output must equal the literal paths passed to `git add`, with no generated browser, cache, bundle, or fixture-review artifact.

### Task 2: Implement the Client controller and monotonic view state

**Files:**

- Create: packages/workbench/src/client/workbench/workbench-state.ts
- Create: packages/workbench/src/client/workbench/use-workbench-controller.ts
- Create: packages/workbench/src/client/workbench/WorkbenchStatus.tsx
- Create: packages/workbench/src/client/workbench/client-copy.ts
- Create: tests/ui/workbench-controller.test.tsx
- Create: tests/ui/workbench-status.test.tsx
- Create: tests/client/project-version-monotonicity.test.ts
- Create: tests/client/unsaved-edit-preservation.test.ts

**Interfaces:**

- Consumes: only `WorkbenchApi` and validated Product wire views.
- Produces: `WorkbenchController`, `WorkbenchViewState`, typed async-operation states, monotonic authoritative versions, and isolated unsaved drafts.

- [ ] **Step 1: Write RED state-transition tests**

Cover all distinct states:

~~~ts
export type UiOperationState =
  | { type: 'idle' }
  | { type: 'empty' }
  | { type: 'loading'; operation: string }
  | { type: 'validation-error'; messageKey: string }
  | { type: 'source-too-large'; messageKey: 'workbench.error.source-too-large' }
  | { type: 'limit-exceeded'; messageKey: 'workbench.error.limit-exceeded' }
  | { type: 'unsupported-schema'; messageKey: 'workbench.error.unsupported-schema' }
  | { type: 'host-unavailable'; retry: 'manual' }
  | { type: 'cancelled'; operation: 'read' | 'pre-commit-command' }
  | { type: 'version-conflict'; authoritativeVersion: number }
  | { type: 'stale-input' }
  | { type: 'idempotency-key-reused' }
  | { type: 'not-found' }
  | { type: 'invalid-transition' }
  | { type: 'protocol-invalid' }
  | { type: 'transport-internal' }
  | { type: 'commit-result-unknown'; commandId: CommandId }
  | { type: 'ready' }
~~~

Test empty load, success, manual retry, abort before response, every transport failure, every closed-set business rejection, and an unknown future union member entering the runtime guard. `invalid-input` maps only to `validation-error`; `source-too-large`, `limit-exceeded`, `unsupported-schema`, and `cancelled` stay visibly distinct. A cancelled read/pre-commit command may be conclusive, but a mutation interrupted after dispatch becomes `commit-result-unknown`. Unknown states render a safe error rather than a blank panel or success.

- [ ] **Step 2: Write RED monotonicity and draft-preservation tests**

Simulate C1 confirmation at version 1 arriving after the controller has observed version 2. The receipt may confirm C1, but `highestKnownProjectVersion` and overview stay at 2. Then simulate cancelled, source-too-large, limit-exceeded, unsupported-schema, version conflict, stale input, host unavailable, protocol invalid, transport-internal, and commit-result-unknown; every path retains the exact unsaved edit until the user explicitly discards it or successfully commits a replacement.

- [ ] **Step 3: Run RED**

~~~bash
npm test -- tests/ui/workbench-controller.test.tsx tests/ui/workbench-status.test.tsx tests/client/project-version-monotonicity.test.ts tests/client/unsaved-edit-preservation.test.ts
~~~

- [ ] **Step 4: Implement a command journal in Client memory**

Each submitted mutation stores `commandId`, canonical input, send-time project version, and local draft identity in the mounted controller instance until the API returns a conclusive accepted/rejected outcome. This journal is ordinary in-memory state: it has no storage adapter, serialization hook, persistence fallback, or cross-remount promise. An abort or transport failure after dispatch becomes `commit-result-unknown`; the controller reissues only the exact same command ID and payload or refreshes the authoritative snapshot. It never invents a replacement command ID automatically.

- [ ] **Step 5: Implement monotonic reconciliation**

~~~ts
export interface ProjectVersionState {
  highestKnownProjectVersion: number
  highestKnownCatalogVersion: number
  authoritativeOverview?: ProjectOverview
  pendingDrafts: Readonly<Record<string, PendingDraft>>
}
~~~

Accepted historical receipts confirm their command but cannot replace a newer overview. Any read below the highest known version is ignored for authoritative display and cannot seed pagination. Errors map to fixed message keys; raw messages, payloads, response bodies, stacks, quotes, and paths are never rendered.

- [ ] **Step 6: Run GREEN**

~~~bash
npm test -- tests/ui/workbench-controller.test.tsx tests/ui/workbench-status.test.tsx tests/client/project-version-monotonicity.test.ts tests/client/unsaved-edit-preservation.test.ts
npm run typecheck
~~~

- [ ] **Step 7: Commit**

~~~bash
git add -- packages/workbench/src/client/workbench/workbench-state.ts packages/workbench/src/client/workbench/use-workbench-controller.ts packages/workbench/src/client/workbench/WorkbenchStatus.tsx packages/workbench/src/client/workbench/client-copy.ts tests/ui/workbench-controller.test.tsx tests/ui/workbench-status.test.tsx tests/client/project-version-monotonicity.test.ts tests/client/unsaved-edit-preservation.test.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: add monotonic workbench client state"
~~~

The staged-name output must equal those eight paths exactly.

### Task 3: Build the shell-neutral workbench frame

**Files:**

- Create: packages/workbench/src/client/workbench/WorkbenchView.tsx
- Create: packages/workbench/src/client/workbench/WorkbenchShell.tsx
- Create: packages/workbench/src/client/workbench/WorkbenchNavigation.tsx
- Create: packages/workbench/src/client/workbench/workbench.css
- Create: packages/workbench/src/client/workbench/tokens.css
- Create: packages/workbench/src/client/workbench/index.ts
- Create: tests/ui/workbench-shell.test.tsx
- Create: tests/contract/workbench-view-boundary.test.ts
- Create: tests/security/p1-browser-storage.test.tsx
- Modify: tests/ui-shell/main.tsx
- Modify: tests/e2e/review-ui.spec.ts

**Interfaces:**

- Produces: `WorkbenchView({ api, fixtureSource, downloadPort, initialProjectId })` and a four-stage navigation: 材料、证据、需求、PRD.
- Consumes: the Task 2 controller and browser-safe props; no Harness service.

- [ ] **Step 1: Write RED frame and boundary tests**

Assert that the production view:

~~~text
renders a semantic main region and named navigation
shows an explicit synthetic-only disclosure
renders loading, empty, ready, and safe error states
does not contain a default accept-all control
does not import @deepseek-ai, cordis, storageDomain, node:, fs, path, http, https, net, child_process, or a raw fetch client
does not inspect document outside its owned root
does not use fixed Harness class names, selectors, or root portals
accepts WorkbenchApi through props
tests/ui-shell/main.tsx imports and mounts the production WorkbenchView
does not read or write localStorage, sessionStorage, IndexedDB, Cache Storage, cookies, or service workers
~~~

`p1-browser-storage.test.tsx` installs throwing storage/cookie/service-worker adapters before mounting the real frame, initializes the controller, creates a project, enters an unsaved draft, and expects zero access. The browser spec verifies empty `localStorage`/`sessionStorage`, no IndexedDB database, no Cache Storage entry, no cookie, and no service-worker registration after the currently implemented path; Tasks 4–6 extend the same spec through the complete flow. The test must fail if a production component adds any persistence fallback.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- tests/ui/workbench-shell.test.tsx tests/contract/workbench-view-boundary.test.ts tests/security/p1-browser-storage.test.tsx
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

- [ ] **Step 3: Implement the responsive frame**

Use CSS custom properties scoped below `.pmwb-root`. The wide layout uses source/evidence/decision panes; the 1024 layout collapses them into explicit tabs without hiding counterexamples, unknowns, errors, or the publish action. All interactive components use native buttons, inputs, textareas, lists, headings, status regions, and dialogs before ARIA supplementation. Formal state is always loaded through `WorkbenchApi`; drafts stay in React/controller memory and the remount disclosure says they will be discarded.

- [ ] **Step 4: Keep motion decorative and local**

Only opacity/color and a short panel transition are allowed. No canvas, WebGL, global pointer listener, background replacement, or ripple implementation belongs in P1. The root honors `prefers-reduced-motion` by removing nonessential transforms and transitions.

- [ ] **Step 5: Run GREEN**

~~~bash
npm test -- tests/ui/workbench-shell.test.tsx tests/contract/workbench-view-boundary.test.ts tests/security/p1-browser-storage.test.tsx
npm run typecheck
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/client/workbench/WorkbenchView.tsx packages/workbench/src/client/workbench/WorkbenchShell.tsx packages/workbench/src/client/workbench/WorkbenchNavigation.tsx packages/workbench/src/client/workbench/workbench.css packages/workbench/src/client/workbench/tokens.css packages/workbench/src/client/workbench/index.ts tests/ui/workbench-shell.test.tsx tests/contract/workbench-view-boundary.test.ts tests/security/p1-browser-storage.test.tsx tests/ui-shell/main.tsx tests/e2e/review-ui.spec.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: add the shell-neutral workbench frame"
~~~

The staged-name output must equal those eleven paths exactly.

### Task 4: Implement source intake and evidence inspection

**Files:**

- Create: packages/workbench/src/client/workbench/SourceIntake.tsx
- Create: packages/workbench/src/client/workbench/EvidenceReview.tsx
- Create: packages/workbench/src/client/workbench/SourceExcerpt.tsx
- Create: packages/workbench/src/client/workbench/UnknownsPanel.tsx
- Create: packages/workbench/src/client/workbench/CounterEvidencePanel.tsx
- Create: packages/workbench/src/client/workbench/browser-file-reader.ts
- Create: tests/ui/source-intake.test.tsx
- Create: tests/ui/evidence-review.test.tsx
- Create: tests/ui/source-excerpt.test.tsx
- Create: tests/security/ui-source-safety.test.tsx
- Create: tests/security/ui-fixture-policy.test.tsx
- Modify: tests/e2e/review-ui.spec.ts

**Interfaces:**

- Consumes: user-selected `.txt`/`.md` or pasted text only as an untrusted candidate, the accepted fixture identity injected into the P0 API, Product source reads, and complete-read validation.
- Produces: validated `source.importText` command drafts and a traceable source/evidence/interpretation review surface.

- [ ] **Step 1: Write RED intake tests**

Test accepted R1 by paste and accepted R1/R2 through explicitly selected `.txt` and `.md`. After strict-loading the exact manifest-bound bytes, construct byte-distinct positive variants in test memory only:

~~~text
UTF-8 BOM + accepted decoded text
LF replaced by CRLF
LF replaced by bare CR
NFC accepted text converted to NFD
~~~

For every variant, first assert that its raw bytes differ from the manifest bytes, then assert that the shared normalization function produces the same scalar sequence and accepted content hash. Import each variant into a fresh project through the real P0 `WorkbenchService`; it must be accepted and produce the same normalized `SourceRevision.contentHash`, reconstructed source text, evidence locators, and deterministic analysis as its canonical revision. At least one accepted R1/R2 string must contain a canonically decomposable scalar so its NFD bytes differ while NFC output is equal. If neither accepted revision satisfies that prerequisite, stop and return to the P0 fixture review for a new owner-accepted manifest/set; do not replace this with a test-only accepted hash or claim that a no-op `normalize('NFD')` proves NFD equivalence.

Also cover empty input, unsupported extension, invalid UTF-8, raw file bytes over 1,048,576, normalized text over either P0 limit, and recovery after validation failure. The API receives decoded text and safe display metadata only; it never receives a local path, File object, object URL, or browser-specific handle. `source-too-large` stays distinct from ordinary validation failure and preserves safe selection metadata for correction.

For arbitrary shape-valid TXT/MD bytes, a mutation that changes one scalar **after normalization**, accepted raw bytes plus one visible ASCII scalar, a matching safe basename with wrong normalized content, and an unaccepted third synthetic string, first recompute and assert a normalized content hash different from both accepted hashes. Bypass the browser-side precheck and assert the Product service returns fixed `invalid-input` before creating or changing any project/source revision/receipt/aggregateVersion/catalogVersion. A raw-byte-only change that remains in the same BOM/line-ending/NFC equivalence class belongs to the positive table above and must not be mislabeled a rejection. The UI says a rejected file does not match an approved synthetic normalized identity and never labels it imported; only the service policy is authoritative.

- [ ] **Step 2: Write RED evidence tests**

For every evidence card, assert distinct labels for exact quote, fixture interpretation, role, source revision, locator, and current/stale status. Canonical role values `support`, `counterexample`, and `context`, plus unknowns, remain individually visible. Selecting evidence loads and validates all needed source segments before highlighting the exact UTF-16 slice.

Inject an abort, stale result, wrong public continuation, rejected opaque cursor, duplicate/missing segment, non-contiguous offset, wrong segment/source identity, byte-count mismatch, and content-hash mismatch at every page boundary. Each case must destroy the operation-local aggregate, render no partial quote as complete, seed no later retry, and begin any user-requested retry from the first page under the newest authoritative revision.

- [ ] **Step 3: Write RED safety tests**

Inject raw HTML, script tags, Markdown links, fake footnotes, a fake absolute path, and the fixture prompt-injection sentence. Source and quote render as text nodes; no HTML executes, no URL is followed, no path is derived, and no hidden console/log output contains the canary.

- [ ] **Step 4: Run RED**

~~~bash
npm test -- tests/ui/source-intake.test.tsx tests/ui/evidence-review.test.tsx tests/ui/source-excerpt.test.tsx tests/security/ui-source-safety.test.tsx tests/security/ui-fixture-policy.test.tsx
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

- [ ] **Step 5: Implement intake and evidence views**

Read selected files with `arrayBuffer()`, enforce the raw-byte cap before `TextDecoder('utf-8', { fatal: true })`, then pass decoded text to the P0 command. Display `file.name` only after the P0 safe-basename validator succeeds. The test shell injects only the strict-loaded accepted fixture identities/bytes; production UI receives no arbitrary filesystem loader. Inside `WorkbenchService` and before any repository operation, `AcceptedSyntheticInputPolicy` uses the P0 order unchanged: validate the JavaScript scalar sequence, remove one leading BOM, canonicalize CRLF/bare CR to LF, apply NFC, reject forbidden controls, measure the normalized limits, then hash. Authorization compares that normalized hash with the two accepted content hashes; it never compares an unnormalized paste/file hash with the manifest raw-byte hash. Evidence linking uses validated `SourceRevisionMetadata` and complete `SourceSegmentPage` assembly; partial text is held in an operation-local buffer, never copied to authoritative state, and discarded on error, abort, stale identity, unmount, or protocol mismatch.

- [ ] **Step 6: Run GREEN**

~~~bash
npm test -- tests/ui/source-intake.test.tsx tests/ui/evidence-review.test.tsx tests/ui/source-excerpt.test.tsx tests/security/ui-source-safety.test.tsx tests/security/ui-fixture-policy.test.tsx
npm run typecheck
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

- [ ] **Step 7: Commit**

~~~bash
git add -- packages/workbench/src/client/workbench/SourceIntake.tsx packages/workbench/src/client/workbench/EvidenceReview.tsx packages/workbench/src/client/workbench/SourceExcerpt.tsx packages/workbench/src/client/workbench/UnknownsPanel.tsx packages/workbench/src/client/workbench/CounterEvidencePanel.tsx packages/workbench/src/client/workbench/browser-file-reader.ts tests/ui/source-intake.test.tsx tests/ui/evidence-review.test.tsx tests/ui/source-excerpt.test.tsx tests/security/ui-source-safety.test.tsx tests/security/ui-fixture-policy.test.tsx tests/e2e/review-ui.spec.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: add traceable source and evidence review"
~~~

The staged-name output must equal the literal paths above exactly.

### Task 5: Implement human decisions and priority ordering

**Files:**

- Create: packages/workbench/src/client/workbench/RequirementReview.tsx
- Create: packages/workbench/src/client/workbench/RequirementEditor.tsx
- Create: packages/workbench/src/client/workbench/PriorityBoard.tsx
- Create: packages/workbench/src/client/workbench/DecisionReason.tsx
- Create: tests/ui/requirement-review.test.tsx
- Create: tests/ui/priority-board.test.tsx
- Create: tests/ui/decision-reasons.test.tsx
- Create: tests/ui/no-accept-all.test.tsx
- Modify: tests/e2e/review-ui.spec.ts

**Interfaces:**

- Consumes: RequirementDraftRevision, PriorityProposal, HumanDecision, `projects.command`, and unsaved draft state.
- Produces: explicit accept/edit/reject/defer commands and a human-controlled ordered list without replacing the original proposal.

- [ ] **Step 1: Write RED decision tests**

Assert one action group per requirement, no bulk or default acceptance, and these exact rules:

~~~text
accept may omit reason
edit requires a changed human-authored draft and non-blank reason
reject requires non-blank reason
defer requires non-blank reason
closing a failed dialog preserves entered text
submitting disables only the affected requirement action
the UI never labels a proposal as the final priority
~~~

- [ ] **Step 2: Write RED ordering tests**

Start with the fixture proposal, move the human-edited A before B by pointer drag and by keyboard buttons, then verify consecutive ranks and the accessible order announcement. Keep the original recommended order visible for comparison. A rejected/deferred item cannot silently enter the publishable current selection.

- [ ] **Step 3: Run RED**

~~~bash
npm test -- tests/ui/requirement-review.test.tsx tests/ui/priority-board.test.tsx tests/ui/decision-reasons.test.tsx tests/ui/no-accept-all.test.tsx
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

- [ ] **Step 4: Implement review controls**

Use one explicit command ID per user submission. Keyboard ordering uses visible `上移` and `下移` buttons and announces position changes through a polite live region; pointer drag is an additional path, not the only path. The UI retains immutable fixture proposal data next to the current human order.

- [ ] **Step 5: Run GREEN**

~~~bash
npm test -- tests/ui/requirement-review.test.tsx tests/ui/priority-board.test.tsx tests/ui/decision-reasons.test.tsx tests/ui/no-accept-all.test.tsx
npm run typecheck
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/client/workbench/RequirementReview.tsx packages/workbench/src/client/workbench/RequirementEditor.tsx packages/workbench/src/client/workbench/PriorityBoard.tsx packages/workbench/src/client/workbench/DecisionReason.tsx tests/ui/requirement-review.test.tsx tests/ui/priority-board.test.tsx tests/ui/decision-reasons.test.tsx tests/ui/no-accept-all.test.tsx tests/e2e/review-ui.spec.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: add explicit requirement decisions"
~~~

The staged-name output must equal those nine paths exactly.

### Task 6: Add baseline confirmation and verified PRD download

**Files:**

- Create: packages/workbench/src/client/workbench/BaselinePublishDialog.tsx
- Create: packages/workbench/src/client/workbench/PrdPreview.tsx
- Create: packages/workbench/src/client/workbench/VerifiedMarkdownDownload.tsx
- Create: packages/workbench/src/client/workbench/download-port.ts
- Create: tests/ui/baseline-publish-dialog.test.tsx
- Create: tests/ui/prd-preview.test.tsx
- Create: tests/ui/prd-lineage.test.tsx
- Create: tests/client/verified-markdown-download.test.ts
- Modify: tests/e2e/review-ui.spec.ts

**Interfaces:**

- Consumes: current accepted requirement revisions, decisions, complete Markdown reads, and the P0 manifest/chunk verifier.
- Produces: an independently confirmed baseline command, plain-text Markdown preview, and a download enabled only for fully verified bytes.

- [ ] **Step 1: Write RED baseline tests**

Opening the dialog shows exact included requirement revision IDs, final order, excluded deferred/rejected count, counterexamples, unknowns, and current source/baseline versions. The confirm button is initially disabled until the user checks an explicit acknowledgement. Closing without confirm creates no command. Stale input or version conflict leaves the dialog data and reason edits available while the user refreshes.

- [ ] **Step 2: Write RED preview and download tests**

Before all chunks arrive, the panel says `正在读取` and the download action is disabled. Inject abort, stale result, bad continuation, rejected opaque cursor, wrong project/PRD identity, duplicate/missing chunk, non-contiguous offset, chunk-hash mismatch, total-byte mismatch, or content-hash mismatch at every boundary; destroy the partial buffer, keep download disabled, and ensure a later retry cannot reuse any byte from the failed read. On exact completion, render Markdown in a `<pre>` text surface and create one Blob from the verified bytes. The safe suggested filename contains no slash, backslash, traversal segment, or local path.

`prd-lineage.test.tsx` then imports source revision R2 after B1 produced historical PRD P1. The UI must mark B1 and P1 as based on old source/requirement revisions, refuse to generate a new current PRD from stale B1, retain P1 in an explicitly historical read-only view, and keep P1's verified download available only after re-reading and validating P1's own complete manifest/chunks. A refreshed current snapshot must not silently relabel or hide the old PRD.

- [ ] **Step 3: Run RED**

~~~bash
npm test -- tests/ui/baseline-publish-dialog.test.tsx tests/ui/prd-preview.test.tsx tests/ui/prd-lineage.test.tsx tests/client/verified-markdown-download.test.ts
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

- [ ] **Step 4: Implement independent publication and download ports**

`BaselinePublishDialog` emits only after its own confirmation. `VerifiedMarkdownDownload` receives `{ filename, utf8Bytes, contentHash }` only from a complete P0 read result; object URL creation, click, revocation, and test observation are behind `DownloadPort`. Its read state is keyed by project, PRD revision, manifest hash, and authoritative version, so a stale/current selection change cancels and discards the old in-flight buffer. Never use `dangerouslySetInnerHTML`, a Markdown HTML renderer, a Host filesystem path, or a browser download as proof that bytes were complete.

- [ ] **Step 5: Run GREEN**

~~~bash
npm test -- tests/ui/baseline-publish-dialog.test.tsx tests/ui/prd-preview.test.tsx tests/ui/prd-lineage.test.tsx tests/client/verified-markdown-download.test.ts
npm run typecheck
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/client/workbench/BaselinePublishDialog.tsx packages/workbench/src/client/workbench/PrdPreview.tsx packages/workbench/src/client/workbench/VerifiedMarkdownDownload.tsx packages/workbench/src/client/workbench/download-port.ts tests/ui/baseline-publish-dialog.test.tsx tests/ui/prd-preview.test.tsx tests/ui/prd-lineage.test.tsx tests/client/verified-markdown-download.test.ts tests/e2e/review-ui.spec.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: confirm baselines and verify PRD downloads"
~~~

The staged-name output must equal those nine paths exactly.

### Task 7: Prove failure, pagination, remount, and concurrency behavior

**Files:**

- Create: tests/support/scripted-workbench-api.ts
- Create: tests/ui/workbench-failure-matrix.test.tsx
- Create: tests/ui/incomplete-read-state.test.tsx
- Create: tests/ui/workbench-remount.test.tsx
- Create: tests/ui/concurrent-confirmation.test.tsx
- Create: tests/e2e/review-ui-failures.spec.ts
- Modify: packages/workbench/src/client/workbench/use-workbench-controller.ts
- Modify: tests/e2e/review-ui.spec.ts

**Interfaces:**

- Consumes: the production controller/view and a test-only scripted implementation of the existing `WorkbenchApi` interface.
- Produces: deterministic failure injection below the view without adding a runtime endpoint, configuration switch, or production dependency.

- [ ] **Step 1: Write the RED failure matrix**

For loading, empty, validation error, source-too-large, limit-exceeded, unsupported-schema, host unavailable, cancelled read, version conflict, stale input, idempotency-key-reused, not-found, invalid-transition, protocol-invalid, transport-internal, unknown outer result, commit-result-unknown, abort, and partial page/chunk, assert a distinct heading/message key, a safe next action, no false success, and exact preservation/discard rules. The scripted API may return only schema-valid or intentionally malformed test values; it cannot bypass controller validation.

For every paginated source read and chunked PRD read, inject a failure before the first item, between every pair of pages/chunks, and immediately before completion. The controller must destroy the entire operation-local aggregate, expose no stale item or byte as current/complete, disable download, and restart a manual retry from the first page under the latest authoritative identity.

- [ ] **Step 2: Write RED concurrency and remount tests**

Drive C1 at version 1, C2 at version 2, then replay C1. Confirm C1 without regressing overview, then start new reads from version 2 only. Replace source R1 with R2 while historical B1/P1 remain open: B1 cannot create a new current PRD, historical P1 remains visibly old and read-only, and the newest overview wins. Mount/unmount/remount the real view three times; each user action makes one API call, stale listeners are removed, operation AbortControllers are closed, formal project state reloads from API, unsaved in-memory drafts are discarded, no browser-persistent state appears, and the displayed policy says exactly that before remount.

- [ ] **Step 3: Run RED**

~~~bash
npm test -- tests/ui/workbench-failure-matrix.test.tsx tests/ui/incomplete-read-state.test.tsx tests/ui/workbench-remount.test.tsx tests/ui/concurrent-confirmation.test.tsx
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts tests/e2e/review-ui-failures.spec.ts
~~~

- [ ] **Step 4: Implement explicit cleanup and unknown-result recovery**

All controller subscriptions return disposers. Unmount aborts in-flight reads and releases listeners but never implies a server-side command was rolled back. Commit-result-unknown exposes exactly two actions: `用相同命令核对` and `刷新权威状态`; no automatic new command appears.

- [ ] **Step 5: Run GREEN**

~~~bash
npm test -- tests/ui/workbench-failure-matrix.test.tsx tests/ui/incomplete-read-state.test.tsx tests/ui/workbench-remount.test.tsx tests/ui/concurrent-confirmation.test.tsx
npm run typecheck
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts tests/e2e/review-ui-failures.spec.ts
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/client/workbench/use-workbench-controller.ts tests/support/scripted-workbench-api.ts tests/ui/workbench-failure-matrix.test.tsx tests/ui/incomplete-read-state.test.tsx tests/ui/workbench-remount.test.tsx tests/ui/concurrent-confirmation.test.tsx tests/e2e/review-ui-failures.spec.ts tests/e2e/review-ui.spec.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "test: cover workbench failure and concurrency states"
~~~

The staged-name output must equal those eight paths exactly.

### Task 8: Complete keyboard, focus, responsive, and reduced-motion acceptance

**Files:**

- Create: packages/workbench/src/client/workbench/use-dialog-focus.ts
- Create: tests/ui/dialog-focus.test.tsx
- Create: tests/ui/keyboard-flow.test.tsx
- Create: tests/ui/reduced-motion.test.tsx
- Create: tests/e2e/review-ui-accessibility.spec.ts
- Create: tests/e2e/review-ui-responsive.spec.ts
- Modify: packages/workbench/src/client/workbench/workbench.css
- Modify: packages/workbench/src/client/workbench/tokens.css
- Modify: packages/workbench/src/client/workbench/WorkbenchView.tsx

**Interfaces:**

- Produces: complete keyboard flow, visible focus, dialog focus containment/restoration, reduced-motion behavior, measured native 200% browser zoom/reflow, and both required configured viewports.
- Consumes: the production components from Tasks 3–7.

- [ ] **Step 1: Write RED DOM accessibility tests**

Using only Tab, Shift+Tab, Enter, Space, Escape, and arrow/order buttons, complete create, intake, review, edit, defer, reorder, baseline confirmation, PRD preview, and download. Assert every form control has a programmatic name, validation status uses an announced region, focus is visible, modal focus enters the dialog, Tab cannot escape it, Escape closes only when safe, and focus returns to the exact trigger.

- [ ] **Step 2: Write RED browser viewport tests**

At 1440×900 and 1024×768 at 100%, assert every visible critical region and action has a non-zero bounding box inside the layout viewport, `documentElement.scrollWidth <= documentElement.clientWidth`, center-point hit testing reaches the expected control or its descendant, and no pair of independently actionable controls overlaps. Cover confirmation, errors, evidence citation, reason field, ordering controls, modal actions, PRD preview, and download.

Run the 200% case independently in `chromium-1440-native-zoom` and `chromium-1024-native-zoom`. Start each from a fresh headed Chromium context at its declared configured viewport, record baseline `devicePixelRatio`, `innerWidth/innerHeight`, `outerWidth/outerHeight`, `visualViewport.scale`, and the configured Playwright viewport, then send Chromium's native browser zoom-in accelerator (`Meta` on macOS, `Control` elsewhere) until the observed page zoom is exactly 200%; reset with the native browser zoom-reset accelerator after each case. The test passes the zoom-mechanism precondition only when all of these are true for both viewport projects:

~~~text
devicePixelRatio / baselineDevicePixelRatio is 2.00 within ±0.02
innerWidth / baselineInnerWidth is 0.50 within ±0.02 and layout breakpoints reflow
outerWidth and outerHeight remain unchanged within 2 CSS pixels
Playwright's configured viewport remains exactly 1440×900 or 1024×768 for its named project
visualViewport.scale remains 1, excluding pinch/page-scale emulation
~~~

The runner/test source and command-plan contract reject CSS `zoom`, root `transform: scale`, `deviceScaleFactor != 1`, `Emulation.setPageScaleFactor`, viewport reduction, mobile emulation, and post-render screenshot scaling as substitutes. If the native accelerator is unsupported or the measured tuple does not reach 200%, record INCONCLUSIVE; do not fall back to any substitute.

While the measured native 200% zoom remains active, repeat the complete primary flow using only Tab, Shift+Tab, Enter, Space, Escape, and the explicit arrow/order buttons. Re-run the bounding-box, hit-test, overlap, horizontal-overflow, focus visibility, dialog trap/restore, error visibility, citation visibility, and download-reachability assertions after every responsive mode change. A screenshot alone cannot satisfy the check. Test `prefers-reduced-motion: reduce` separately and assert no nonessential transform/animation is active.

- [ ] **Step 3: Run RED**

~~~bash
npm test -- tests/ui/dialog-focus.test.tsx tests/ui/keyboard-flow.test.tsx tests/ui/reduced-motion.test.tsx
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts tests/e2e/review-ui-failures.spec.ts tests/e2e/review-ui-accessibility.spec.ts tests/e2e/review-ui-responsive.spec.ts
~~~

Expected: all three named DOM test files are collected and fail until semantics are complete. The browser runner must collect all four named specs in the two ordinary projects and the responsive/accessibility specs in both named native-zoom projects; the two existing flow specs remain regression controls while the two new specs are RED. It requires the separately approved development Chromium runtime; without it the result is INCONCLUSIVE, not PASS. A missing 1440 or 1024 native-zoom run, zoom substitution, missing metric, skipped/focused test, or zero collected test is not GREEN.

- [ ] **Step 4: Implement focus and layout corrections**

Use a real modal dialog primitive built from `<dialog>` only if its exact target-browser behavior passes; otherwise use `role="dialog"`, `aria-modal="true"`, an owned focus loop, and restoration captured before open. Never trap focus in a non-modal side panel. CSS breakpoints reflow the existing controls without DOM duplication, page scaling, a second zoom-only component tree, or hiding counterexamples/unknowns/actions.

- [ ] **Step 5: Run GREEN**

~~~bash
npm test -- tests/ui/dialog-focus.test.tsx tests/ui/keyboard-flow.test.tsx tests/ui/reduced-motion.test.tsx
node scripts/ui-shell/run-playwright.mjs --development-runtime-decision-id "$DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID" -- tests/e2e/review-ui.spec.ts tests/e2e/review-ui-failures.spec.ts tests/e2e/review-ui-accessibility.spec.ts tests/e2e/review-ui-responsive.spec.ts
~~~

Expected: both native-zoom projects record complete baseline/200%/reset metric tuples, demonstrate real half-width CSS reflow with unchanged outer windows/configured viewports, and complete the keyboard path with no clipping, overlap, horizontal overflow, hidden required content, or unreachable action. The two ordinary projects and reduced-motion case also pass. A CSS/device-scale/CDP/viewport substitute or a metrics-only run without interaction remains INCONCLUSIVE.

- [ ] **Step 6: Commit**

~~~bash
git add -- packages/workbench/src/client/workbench/use-dialog-focus.ts packages/workbench/src/client/workbench/workbench.css packages/workbench/src/client/workbench/tokens.css packages/workbench/src/client/workbench/WorkbenchView.tsx tests/ui/dialog-focus.test.tsx tests/ui/keyboard-flow.test.tsx tests/ui/reduced-motion.test.tsx tests/e2e/review-ui-accessibility.spec.ts tests/e2e/review-ui-responsive.spec.ts
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "feat: complete accessible workbench interactions"
~~~

The staged-name output must equal those nine paths exactly.

### Task 9: Run and freeze the P1 acceptance gate

**Files:**

- Create: scripts/gates/p1.mjs
- Create: scripts/gates/promote-p1-evidence.mjs
- Create: tests/integration/p1-report.test.ts
- Create: tests/security/p1-artifact-redaction.test.ts
- Create: tests/contract/p1-status-claims.test.ts
- Modify: package.json
- Modify: scripts/workspace-boundary.ts
- Modify: docs/ci.md
- Modify before freeze only; immutable during promotion: README.md
- Modify before freeze only; immutable during promotion: SECURITY.md
- Modify before freeze only; immutable during promotion: docs/compatibility.md
- Modify before freeze only; immutable during promotion: packages/workbench/README.md
- Modify before freeze only; immutable during promotion: packages/workbench/docs/compatibility.md
- Modify before freeze only; immutable during promotion: packages/workbench/docs/privacy.md
- Generated outside Git: .tmp/dsh-pm-workbench/p1/runs/*/result.json
- Generated outside Git: .tmp/dsh-pm-workbench/p1/runs/*/report.md
- Generated outside Git: .tmp/dsh-pm-workbench/p1/runs/*/junit.xml
- Generated outside Git: .tmp/dsh-pm-workbench/p1/runs/*/run.final.json
- Generated outside Git: .tmp/dsh-pm-workbench/p1/runs/*/playwright/**
- Generated outside Git after closure validation: .tmp/dsh-pm-workbench/p1/current-run.json
- Generated outside Git while updating or promoting that pointer: .tmp/dsh-pm-workbench/p1/current-run.lock
- Generated outside Git after authorized promotion: .tmp/dsh-pm-workbench/p1/promotion-receipts/<candidateSetSha256>/promotion-receipt.json
- Create after human review: docs/gate-results/shell-neutral-review-ui-p1.md
- Modify after human review: docs/probe-results.md

**Interfaces:**

- Produces: direct-Node `node scripts/gates/p1.mjs --acceptance-runtime-decision-id …`, parameterized `npm run p1:promote`, one unique fail-closed run directory for specification §12, and—only under a distinct evidence-write/commit decision—exactly two deterministic evidence documents: the fixed P1 gate result and one append-only canonical-ledger entry.
- Consumes: a clean frozen P1 source commit, exact lock, accepted F0/P0 source identities, accepted P0 evidence identity, strict-loaded two-revision fixture and owner-accepted golden-set identities, the exact immutable Chromium bootstrap manifest including `DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID` and reviewed download/materialization receipts, a distinct frozen-run `DSH_PMWB_P1_ACCEPTANCE_RUNTIME_DECISION_ID`, then an exact human-review decision and a distinct evidence-write/commit decision bound to one closed run. Development-run closures and `DSH_PMWB_P1_DEVELOPMENT_RUNTIME_DECISION_ID` are deliberately not final evidence inputs.

- [ ] **Step 1: Write RED runner tests**

The result schema requires the closed check IDs `P101` through `P110`, mapped one-to-one and in order to specification §12.2. It also requires the two ordinary viewport projects and both `chromium-1440-native-zoom`/`chromium-1024-native-zoom`; each native project’s baseline/200%/reset metric tuple; native accelerator identity/count; reduced motion; both fixture revision hashes; fixture/golden manifest hashes and accepted set receipts; source commit; lock hash; F0 source identity; P0 source/evidence identities; immutable browser-bootstrap identity including `DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID`, owner-reviewed download-policy hash, exact initial archive URL/hash/length/format/root/executable, origin/redirect allowlist and observed chain, materializer receipt, and browser-tree hash; the distinct `DSH_PMWB_P1_ACCEPTANCE_RUNTIME_DECISION_ID`; Node/npm/OS/architecture; exact Playwright package/browser versions; test file/count totals; zero skipped/focused required tests; console/trace/screenshot canary scan; and production-view transitive module hash. The two IDs must validate against the exact source/artifact/action/scope/expiry, be distinct, and be identical in `result.json`, `report.md`, `junit.xml`, and `run.final.json`; neither a development ID nor an ID used for another source/run may substitute. P101 includes BOM, CRLF, bare-CR, and byte-distinct NFD positive equivalence cases plus a bypassed-Client normalized-identity-changing negative with zero repository write. P110 rejects CSS zoom/transform, device-scale, CDP page-scale, viewport reduction, and screenshot scaling as 200% substitutes.

The runner owns closed, explicit arrays of the inherited F0 dependency-free hydration test, the inherited Node-only `tests/bootstrap/policy-fetch.node.test.mjs` and `tests/bootstrap/browser-materializer.node.test.mjs`, every P1 Vitest file from Tasks 1–9, and all four Playwright specs: `tests/e2e/review-ui.spec.ts`, `tests/e2e/review-ui-failures.spec.ts`, `tests/e2e/review-ui-accessibility.spec.ts`, and `tests/e2e/review-ui-responsive.spec.ts`. It invokes the three inherited `.node.test.mjs` files only through the exact local Node executable with `--test`, never through Vitest. Tests assert that each path exists, its source hash matches the accepted input where inherited, it is passed to the corresponding local runner, collects at least one test, and appears in JUnit/results. There is no glob-only, grep-only, optional, or shared-scenario substitute. Missing Chromium/project/viewport, missing native-zoom metrics, unsupported native accelerator, zoom substitution, missing file, zero collection, skipped/focused test, retained canary, absolute path, static-only evidence, hash mismatch, or manually forced PASS yields INCONCLUSIVE or FAIL.

`p1-report.test.ts` fixes the two-document evidence boundary. The promoter must reject a missing/stale/symlinked completed-run pointer, a pointer or pointer-file identity that races any validation/render/write/check/index/commit-verification stage, dirty or changed frozen source before promotion, mismatched run/final/report/result/JUnit hashes, missing/mismatched/bootstrap-equals-acceptance action decisions, an absent or mismatched human-review decision, an absent or non-distinct evidence-write/commit decision, a candidate or immutable promotion-receipt mismatch, a reused run ID with different bytes, any caller-supplied result path/status override, and any proposed write outside `docs/gate-results/shell-neutral-review-ui-p1.md` plus `docs/probe-results.md`. Read-only `--preview` renders twice in memory, writes nothing, and outputs only the two fixed path/SHA-256 pairs plus `candidateSetSha256`. Tests bind both promotion decisions to the exact expected run ID, frozen source commit, `run.final.json` SHA-256, sanitized `report.md` SHA-256, exact bootstrap-plus-acceptance action identities, both candidate path hashes, and the candidate-set hash; the evidence decision additionally binds the two fixed paths and fixed commit message. A successful write finalizes one immutable promotion receipt binding the same identities and renderer source hash. Development decision IDs and development closures are rejected as evidence inputs. PASS, FAIL, and INCONCLUSIVE render truthfully. Read-only `--check`, `--verify-index`, and `--verify-commit` must reproduce or hash the two expected byte sequences exactly and fail on either missing or differing blob.

- [ ] **Step 2: Run RED**

~~~bash
npm test -- tests/integration/p1-report.test.ts tests/security/p1-artifact-redaction.test.ts tests/contract/p1-status-claims.test.ts
~~~

Expected: all three named files are collected and fail because the closed schema, unique-run protocol, explicit execution manifest, two-document promoter, decision binding, pointer-race rejection, byte-check mode, immutable status-document boundary, and redaction boundary do not exist. Zero collected tests is a failed RED run.

- [ ] **Step 3: Implement the fail-closed runner and real execution manifest**

Before creating output, the direct-Node runner requires exactly one `--acceptance-runtime-decision-id <canonical-id>` argument and empty output from `git status --porcelain=v1 --untracked-files=all`. It verifies frozen HEAD, exact lock, accepted F0/P0 source identities, accepted P0 evidence commit/report hash, the strict loader's same-read fixture/golden identities, and the immutable browser-bootstrap manifest/tree including its bootstrap decision, fixed reviewed-policy, archive, redirect, materialization, and tree receipts. It validates `DSH_PMWB_P1_ACCEPTANCE_RUNTIME_DECISION_ID` against this exact frozen source, bootstrap identity, closed tests/projects, loopback action, unique output boundary, scope, and expiry; requires it to differ from the manifest's bootstrap decision; and rejects a development, bootstrap, expired, previously consumed, or cross-source decision before server/browser launch. Symlink, realpath, open-identity, set-receipt, policy, redirect, materialization, decision, or hash drift stops before build. It creates a collision-resistant run ID from UTC basic time plus 128 random bits and refuses an existing directory. All generated run output then goes below a newly allocated child of `.tmp/dsh-pm-workbench/p1/runs/`; raw subprocess output, Playwright profile, screenshots, and traces never leave that child. Existing ignored dependencies and the verified browser root are inputs, not proof, and are never copied into the run report.

The runner invokes the exact local TypeScript compiler, Vitest, and Playwright test CLI entrypoints directly through `process.execPath` with every closed test path; it never invokes an outer npm script or Playwright downloader. Every test that reads a build artifact creates it inside its own unique run child; no test relies on a pre-existing `lib` or earlier build order. It builds and audits the production shell, starts only the fixed loopback server via `process.execPath`, fixed argv, `shell: false`, and an allowlisted environment, and runs Chromium from the exact read-only root named by `.tmp/dsh-pm-workbench/gate-inputs/p1-browser/<bootstrapId>/manifest.json`. The allowlist constructs fresh `HOME`, `TMPDIR`, XDG, npm cache, and browser-profile paths under the run; it removes inherited proxy, DSH, model/provider, auth/credential, Node-option, and package-manager overrides. After authorized browser bootstrap, the run denies external network and allows only its exact loopback origin.

The runner hashes the production `WorkbenchView` transitive module graph; checks the graph mutation negatives; enables the runtime network/storage/dynamic-code guards; and records actual process exit codes, collection counts, skips, retries, projects, physical viewports, native-zoom metrics/mechanism, reduced motion, and artifact scans. It writes `result.json`, sanitized `report.md`, and `junit.xml` with the identical bootstrap and acceptance decision IDs, then atomically writes `run.final.json` last with those IDs, run ID, source identity, output hashes, overall state, and exit code. FAIL and INCONCLUSIVE runs are preserved with the same four files. The final evidence closure intentionally excludes the development decision and every development-run artifact. Only after closing and revalidating those files may it exclusively create the regular, single-link, non-symlink, marker-owned `current-run.lock`, prove the existing fixed pointer is either absent or a regular non-symlink file, atomically update `current-run.json` with exactly the run ID, frozen source commit, `run.final.json` SHA-256, and sanitized `report.md` SHA-256, and release the lock. Lock reuse, replacement, hardlink, owner-marker mismatch, or an abandoned ambiguous lock fails closed for review rather than being deleted automatically. The runner cannot accept `--pass`, a reduced check list, a screenshot directory as success, an alternate fixture, a zoom substitute, an old result directory, a development decision, or more than the one canonical acceptance-decision argument.

`promote-p1-evidence.mjs` is the only evidence-document writer and has one closed, mutually exclusive mode grammar. `--preview` requires the four closure identities, writes nothing, renders twice under the pointer lock, and returns only both fixed path/SHA-256 pairs plus `candidateSetSha256`. Write mode requires those identities, `--candidate-set-sha256`, `--human-review-decision-id`, and `--evidence-decision-id`; the two decision IDs must be non-empty and distinct, and both decisions must bind the exact candidate hashes. A successful write creates one final-written immutable promotion receipt outside Git. `--check`, `--verify-index`, and `--verify-commit <40-lowercase-hex>` additionally require `--promotion-receipt-sha256`; check rerenders without writing, index mode hashes the staged blobs, and commit mode hashes the exact commit-object blobs and verifies one-parent/two-path topology. The human-review decision is bound to the exact run ID, frozen source commit, final-marker hash, report hash, successful sanitization review, and candidate hashes; the later evidence decision is independently bound to those same identities, the two fixed documentation paths, and `docs: record observed P1 result`. No argument may name a result path, status, test filter, browser project, output path, or arbitrary command.

For every mode, the promoter acquires the same exclusive `current-run.lock` used by the runner, opens only the fixed `current-run.json` as a regular non-symlink file, captures its same-read file identity and byte hash, and requires its fields to equal all four expected run/source/final/report arguments. It re-reads and revalidates the unchanged pointer identity/bytes around closure validation, rendering, writing, receipt finalization, or Git-object verification; injected replacement, truncation, retargeting, or lock contention fails closed. It revalidates source/lock/fixture/golden/browser/result/JUnit/report/final-marker identities, requires the identical distinct bootstrap-plus-acceptance IDs throughout the final closure, rejects any development ID/artifact and duplicate run ID with non-identical bytes, and deterministically renders only `docs/gate-results/shell-neutral-review-ui-p1.md` plus one immutable run-ID block in `docs/probe-results.md`. The immutable promotion receipt records both promotion decision IDs, their bound candidate hashes, closure bootstrap/acceptance decisions, renderer source hash, and exact output byte hashes. `--check` writes nothing and succeeds only when both existing documents equal a fresh render and the receipt. `--verify-index` and `--verify-commit` use fixed Git executable-plus-argv calls and compare actual blob bytes with that receipt; commit mode also enforces the exact parent/path/type/mode topology. The write mode cannot modify source, tests, manifests, lock, fixtures, CI, generated artifacts, `README.md`, `SECURITY.md`, `docs/compatibility.md`, or any package-local document, and it never turns FAIL/INCONCLUSIVE into PASS.

Root `package.json` exposes only `p1:promote` as a fixed local Node entrypoint; it exposes no npm-script alias for browser bootstrap, development browser execution, or the frozen P1 acceptance run. `docs/ci.md` records the three exact direct-Node entries and their required bootstrap, development-runtime, and acceptance-runtime decision variables. `scripts/gates/p1.mjs` is invoked directly with exactly `--acceptance-runtime-decision-id <canonical-id>` and accepts no caller-supplied result path, status override, test filter, browser project override, arbitrary command, or second flag. `p1:promote` accepts only the mode-specific closed arguments above; it accepts no PASS flag and refuses a dirty source mismatch where applicable, stale or racing pointer, unreviewed/incomplete closure, candidate/receipt drift, reused decision identity, or output outside the two-document allowlist.

Before the runtime gate, the three root and three package-local documents are frozen with immutable build-time/source wording: they describe the implementation and inherited reviewed evidence present in that exact source, retain the P0/Harness/model/real-data boundaries, and point to `docs/probe-results.md` for later observations. They do not assert a mutable current `NOT_RUN`, PASS, FAIL, or INCONCLUSIVE state. `p1-status-claims.test.ts` uses temporary PASS, FAIL, and INCONCLUSIVE ledger fixtures to prove that the fixed P1 gate result and appended ledger block agree while all six frozen documents retain byte-identical source-bound wording and are never promoter outputs.

- [ ] **Step 4: Run implementation tests, then commit the gate before acceptance**

~~~bash
npm test -- tests/integration/p1-report.test.ts tests/security/p1-artifact-redaction.test.ts tests/contract/p1-status-claims.test.ts
npm run typecheck
git add -- scripts/gates/p1.mjs scripts/gates/promote-p1-evidence.mjs tests/integration/p1-report.test.ts tests/security/p1-artifact-redaction.test.ts tests/contract/p1-status-claims.test.ts package.json scripts/workspace-boundary.ts docs/ci.md README.md SECURITY.md docs/compatibility.md packages/workbench/README.md packages/workbench/docs/compatibility.md packages/workbench/docs/privacy.md
git diff --cached --check
git diff --cached --name-only
git status --short
git commit -m "test: add the fail-closed P1 acceptance gate"
~~~

The staged-name output must equal those fourteen paths exactly. If any implementation or test outside that set changed, return it to its owning task and do not commit. The acceptance run must never execute against an uncommitted repair. All six root/package status documents in this source commit use the immutable build-time/source rule above and remain byte-identical through promotion; only the later two-document evidence commit may record the observed gate state.

- [ ] **Step 5: Freeze and verify the exact source identity**

~~~bash
git status --short
git rev-parse HEAD
shasum -a 256 package-lock.json fixtures/synthetic/pm-discovery-v1.input.md fixtures/synthetic/pm-discovery-v1.r2.input.md fixtures/synthetic/pm-discovery-v1.manifest.json fixtures/synthetic/pm-discovery-v1.expected-analysis.json fixtures/synthetic/pm-discovery-v1.expected-prd.md fixtures/synthetic/pm-discovery-v1.expected-prd.json fixtures/synthetic/pm-discovery-v1.goldens.manifest.json README.md SECURITY.md docs/compatibility.md packages/workbench/README.md packages/workbench/docs/compatibility.md packages/workbench/docs/privacy.md
~~~

Expected: `git status --short` is empty and every named file exists. Record the exact 40-hex HEAD as `DSH_PMWB_P1_SOURCE_COMMIT` plus the recomputed lock, fixture, golden-manifest, and six immutable status-document hashes as runner inputs. If code, tests, lock, fixture, any frozen status document, F0/P0 source identity, or P0 evidence identity changes, commit that repair separately and restart this step; an older run is not proof for the new combination.

- [ ] **Step 6: Bootstrap the exact browser only if separately authorized and absent**

If a complete immutable browser manifest already exists at the exact expected package/browser revision, its recorded `DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID`, owner-reviewed policy bytes/hash, archive URL/hash/length/format/root/executable, origin/redirect observations, materializer receipt, and every tree hash revalidate against this frozen source, skip this step. Otherwise stop, review/fix the single policy input without guessing a URL or origin, request browser-binary download authorization bound to those exact bytes, record its canonical ID as `DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID`, then run only the direct-Node production entry:

~~~bash
node scripts/bootstrap/p1-browser.mjs --bootstrap-decision-id "$DSH_PMWB_P1_BROWSER_BOOTSTRAP_DECISION_ID"
git status --short
~~~

The wrapper downloads, verifies, and materializes Chromium but must not execute it or start the local server. Download authorization does not authorize the final acceptance runtime. A missing/drifting decision or policy, disallowed initial/redirect URL/origin, hostile environment override, wrong archive bytes, unsafe materialization, or partial/mismatched manifest is INCONCLUSIVE and is never repaired by the P1 runner, Playwright's stock downloader, or silently expanding the allowlist.

- [ ] **Step 7: Obtain a new frozen-acceptance browser-runtime authorization**

After the exact source is frozen and the browser manifest, bootstrap decision, reviewed policy/archive/materialization identities, exact origin/redirect list and observations, and browser tree revalidate, obtain an explicit authorization for this one P1 acceptance attempt. Record its canonical ID as `DSH_PMWB_P1_ACCEPTANCE_RUNTIME_DECISION_ID`. It covers only the exact direct-Node `scripts/gates/p1.mjs` action below, one random non-3080 `127.0.0.1` static server, the manifest-bound Chromium binary including both headed native-zoom projects, all closed Node/Vitest/Playwright paths, and a new marker-owned run directory. It must be distinct from both browser-bootstrap and development-runtime IDs, validate the frozen source/artifacts/action/scope/expiry, and may be consumed only for this attempt. It does not inherit from the development browser authorization and does not permit browser download, dependency/lock mutation, external network, Harness, port 3080, another fixture, or another source commit. Without this new authorization, P1 remains `NOT_RUN`.

- [ ] **Step 8: Run once from the frozen source**

~~~bash
git status --short
node scripts/gates/p1.mjs --acceptance-runtime-decision-id "$DSH_PMWB_P1_ACCEPTANCE_RUNTIME_DECISION_ID"
~~~

The direct-Node runner validates and records the acceptance decision before it creates output or launches a child. It runs `tests/bootstrap/exact-lock-hydration.node.test.mjs`, the inherited policy-fetch/materializer security tests, every exact P1 Vitest file, and all four Playwright files in their closed projects through exact local CLI entries; do not substitute an outer npm script, an earlier development run, manual `npm test`, a screenshot, or browser-only sampling. Expected only when observed:

~~~text
P101 through P110 all PASS
the complete real React flow passes in Chromium at configured 1440×900 and 1024×768 viewports
both headed native-zoom projects prove their baseline/200%/reset metric tuples, true reflow, and complete zoomed keyboard flow
no CSS zoom/transform, deviceScaleFactor, CDP page-scale, smaller viewport, or screenshot scaling substitutes for 200%
the browser manifest's bootstrap decision, reviewed policy/archive/materialization identities, exact origin/redirect allowlist, redirect ceiling, observed redirect chain, browser revision, and tree hash all recompute
bootstrap and acceptance runtime decision IDs are distinct, correctly scoped, unexpired, and identical across all four final closure files; no development ID or development closure enters final evidence
all unit, integration, and browser test files named in Tasks 1–9 pass
zero required test is skipped
the shell imports the production WorkbenchView and accepted P0 API
partial reads never become complete or downloadable
BOM/CRLF/bare-CR/NFD equivalents with the same accepted normalized identity succeed and reconstruct identically
every normalized-identity-changing TXT/MD case is rejected before any project/source/receipt/version write
stale B1 cannot make a new current PRD and historical P1 remains visibly available
Client formal data and drafts never enter browser-persistent storage
the transitive and runtime network/process/model/storage boundaries and both mutation negatives pass
no canary, raw payload, local absolute path, browser session, or stack enters the sanitized result
result.json, report.md, junit.xml, and run.final.json agree on run ID, source identity, bootstrap/acceptance decision IDs, hashes, state, and exit code
~~~

- [ ] **Step 9: Inspect the unique result without promoting it**

~~~bash
find .tmp/dsh-pm-workbench/p1/runs -name run.final.json -type f -print
git status --short
~~~

The direct-Node P1 runner must print exactly one newly allocated relative run directory and its run ID on its final status line. Select that directory only; the `find` output is an inventory cross-check, never a “latest run” selector. Verify `run.final.json` was written last, recompute the three sibling output hashes, compare their source identity and identical bootstrap/acceptance decision IDs with frozen HEAD and the accepted manifest, and inspect sanitized `report.md`. Read the fixed `current-run.json` through its same-read regular-file identity and require that it names this exact run ID and `run.final.json` hash. Record the exact selected identities as `DSH_PMWB_P1_RUN_ID`, `DSH_PMWB_P1_SOURCE_COMMIT`, `DSH_PMWB_P1_RUN_FINAL_SHA256`, and `DSH_PMWB_P1_REPORT_SHA256`; retain the already validated bootstrap and acceptance decision IDs for the two decisions in Step 10. Do not delete failed/inconclusive or development runs, overwrite a prior run, stage anything below `.tmp`, or treat a later pointer as this run. A missing, racing, or disagreeing pointer/final marker is INCONCLUSIVE.

- [ ] **Step 10: Review, promote, byte-check, and commit exactly two documents**

First, a person reviews the exact sanitized `report.md` selected in Step 9. Run `p1:promote --preview` with the four explicit closure identities; under the pointer lock it renders twice in memory, writes nothing, and returns exactly both fixed path/SHA-256 pairs plus `candidateSetSha256`. Record the set as `DSH_PMWB_P1_CANDIDATE_SET_SHA256` and independently compare the path set. Then record a human-review decision as `DSH_PMWB_P1_REVIEW_DECISION_ID`, bound to its run ID, frozen source commit, `run.final.json` SHA-256, sanitized-report SHA-256, bootstrap decision ID, acceptance-runtime decision ID, sanitization result, both candidate byte hashes, and candidate-set hash. Raw Playwright output, screenshots, traces, console output, development closures, and logs remain below `.tmp`. After that review, obtain a **distinct** evidence-write/commit decision as `DSH_PMWB_P1_EVIDENCE_DECISION_ID`, bound to the same identities and candidate hashes, exactly `docs/gate-results/shell-neutral-review-ui-p1.md` and `docs/probe-results.md`, and the commit message `docs: record observed P1 result`. It authorizes only the deterministic two-document promoter write of those bytes and exact evidence commit; it does not authorize another run, source/status change, root/package documentation change, H1, Harness, network, model use, real data, push, or PR. Neither promotion decision may equal any browser action decision, and no development decision or closure is an evidence input. Never select a run by mtime or “latest,” and never reuse either decision for a different closure.

Only with both promotion decisions may the promoter create the fixed evidence path and append the selected run ID to the canonical ledger. Write mode prints the final immutable promotion-receipt SHA-256; independently recompute it and record it as `DSH_PMWB_P1_PROMOTION_RECEIPT_SHA256` before `--check` or any staging. The gate document must include `P101`–`P110`; human-review and evidence decision IDs; source/lock/two-revision-fixture/golden-set/P0 identities; normalized-equivalence observations; strict-loader result; runner output hashes; exact bootstrap decision and policy/archive/origin/redirect/materialization/tree identities; acceptance-runtime decision ID; native-zoom metrics/mechanism; explicit PASS/FAIL/INCONCLUSIVE states; and the allowed/prohibited claims. It must state that development decisions/closures were not promoted and must not copy raw logs or local paths. Before promotion, `git status --short` must be empty. Run the preview, write, and read-only byte check with the closed mode arguments:

~~~bash
git status --short
npm run p1:promote -- --run-id "$DSH_PMWB_P1_RUN_ID" --source-commit "$DSH_PMWB_P1_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_P1_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_P1_REPORT_SHA256" --preview
npm run p1:promote -- --run-id "$DSH_PMWB_P1_RUN_ID" --source-commit "$DSH_PMWB_P1_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_P1_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_P1_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_P1_CANDIDATE_SET_SHA256" --human-review-decision-id "$DSH_PMWB_P1_REVIEW_DECISION_ID" --evidence-decision-id "$DSH_PMWB_P1_EVIDENCE_DECISION_ID"
npm run p1:promote -- --run-id "$DSH_PMWB_P1_RUN_ID" --source-commit "$DSH_PMWB_P1_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_P1_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_P1_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_P1_CANDIDATE_SET_SHA256" --human-review-decision-id "$DSH_PMWB_P1_REVIEW_DECISION_ID" --evidence-decision-id "$DSH_PMWB_P1_EVIDENCE_DECISION_ID" --promotion-receipt-sha256 "$DSH_PMWB_P1_PROMOTION_RECEIPT_SHA256" --check
npm test -- tests/integration/p1-report.test.ts tests/contract/p1-status-claims.test.ts tests/security/p1-artifact-redaction.test.ts
git diff -- docs/gate-results/shell-neutral-review-ui-p1.md docs/probe-results.md
~~~

Only after the person confirms those exact promoted bytes may the evidence commit be created:

~~~bash
git add -- docs/gate-results/shell-neutral-review-ui-p1.md docs/probe-results.md
git diff --cached --check
git diff --cached --name-only
git status --short
npm run p1:promote -- --run-id "$DSH_PMWB_P1_RUN_ID" --source-commit "$DSH_PMWB_P1_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_P1_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_P1_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_P1_CANDIDATE_SET_SHA256" --human-review-decision-id "$DSH_PMWB_P1_REVIEW_DECISION_ID" --evidence-decision-id "$DSH_PMWB_P1_EVIDENCE_DECISION_ID" --promotion-receipt-sha256 "$DSH_PMWB_P1_PROMOTION_RECEIPT_SHA256" --verify-index
git commit -m "docs: record observed P1 result"
git rev-list --parents -n 1 HEAD
git diff-tree --no-commit-id --raw -r -z "$DSH_PMWB_P1_SOURCE_COMMIT" HEAD
git status --short
~~~

The staged-name output must equal those two documentation paths exactly, and `--verify-index` must hash both staged Git blobs and match the immutable promotion receipt immediately before commit. Record the full new commit as `DSH_PMWB_P1_EVIDENCE_COMMIT`, then run:

~~~bash
npm run p1:promote -- --run-id "$DSH_PMWB_P1_RUN_ID" --source-commit "$DSH_PMWB_P1_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_P1_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_P1_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_P1_CANDIDATE_SET_SHA256" --human-review-decision-id "$DSH_PMWB_P1_REVIEW_DECISION_ID" --evidence-decision-id "$DSH_PMWB_P1_EVIDENCE_DECISION_ID" --promotion-receipt-sha256 "$DSH_PMWB_P1_PROMOTION_RECEIPT_SHA256" --verify-commit "$DSH_PMWB_P1_EVIDENCE_COMMIT"
~~~

It reads the two exact commit-object blobs, compares them with the receipt, and enforces topology. Parse both post-commit Git outputs: `rev-list` must return `HEAD` plus exactly one parent equal to `DSH_PMWB_P1_SOURCE_COMMIT`; the NUL-delimited raw `diff-tree` must contain exactly regular-file additions/modifications at `docs/gate-results/shell-neutral-review-ui-p1.md` and `docs/probe-results.md`, with no rename, copy, mode/type substitution, submodule, or third path; final status must be empty. A race or byte mismatch invalidates the local evidence candidate; do not amend or accept it. `p1:promote` must verify all three root and all three package-local status-document hashes against frozen HEAD before writing, after writing, and in every verification mode; those six documents remain byte-identical and merely point to the mutable ledger. `docs/probe-results.md` is the canonical state, and the fixed gate document must name the same state, selected run, frozen source, closure hashes, bootstrap/acceptance action decisions, and both promotion decisions. The evidence document states the exact permitted P1 claim and explicitly says that Harness, Connection RPC, storageDomain, ripple coexistence, real AI, real interviews, and distribution were not tested. PASS, FAIL, and INCONCLUSIVE are all recorded truthfully; only an owner-accepted evidence commit whose recomputable state is PASS is eligible as H1 input. Before consuming it, H1 must independently read the exact accepted P1 commit object and reject it unless the same one-parent/raw-NUL/exact-two-regular-file topology, both fixed blob identities and candidate hashes, source/run/final/report/action-decision fields, and recomputable PASS state all verify; a branch, working-tree document, copied report, or prose claim cannot substitute.

## P1 completion rule

All ten specification §12.2 checks must be observed through the production `WorkbenchView` in the real recorded browser shell. Any stock/downloader bypass, unreviewed URL/origin/archive/materialization, static-only surrogate, skipped/focused/missing required case, rejected normalization-equivalent accepted input, accepted normalized-identity mutation, incomplete read treated as complete, editing loss, version regression, stale baseline producing a new current PRD, historical PRD disappearing, Client persistence, forbidden network/process/model access, failed mutation negative, mouse-only primary action, focus escape, hidden counterexample/unknown, CSS/device-scale/CDP/viewport/screenshot zoom substitute, unmeasured reflow, 200%-zoom clipping/overlap/unreachable action, canary leak, gate-result/ledger disagreement, mutable status claim in a frozen root/package document, missing or racing pointer, absent/reused/substituted action or promotion decision, development closure promoted as final evidence, failed byte check, invalid evidence-commit topology, or uncertain browser result is P1 No-Go.

~~~text
STOP — report observed evidence and wait for the owner.
Do not start H1 automatically.
~~~
