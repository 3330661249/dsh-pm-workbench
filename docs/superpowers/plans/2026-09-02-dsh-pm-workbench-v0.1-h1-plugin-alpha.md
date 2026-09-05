# DSH PM Workbench H1 Plugin Alpha and Gate B Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Assemble the accepted H0 transport, P0 Evidence Core, and P1 `WorkbenchView` into one privately installable Product-only tgz, then pass the complete synthetic-data Gate B in an isolated DeepSeek Harness 0.1.0-rc.6 profile.

**Architecture:** Keep the P0 domain/application layer and P1 view unchanged. Replace only the in-memory repository with a journaled `HarnessProjectRepository`, the in-process transport with public Connection RPC adapters, and the test shell with additive Harness slots. Use a versioned catalog, one fixed discoverable pending-intent key written before any staging, and one version-locked, publicly documented atomic Domain global-root replacement as the commit marker so recovery exposes a complete old or new state, never a mixture. If the exact resolved rc.6 public contract cannot prove that single-key replacement property, H1 stops before repository implementation.

**Tech Stack:** TypeScript 6.0.3, Node.js 24.14.0, React 18.3.1, Vitest 3.2.7, esbuild 0.25.12, Zod 4.4.3, Playwright Test 1.62.1, and exact DeepSeek Harness 0.1.0-rc.6 public Connection, Client runtime, slots, and storageDomain packages.

**Spec:** ../specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md

## Global Constraints

- H1 code begins only after the owner accepts one exact 40-hex H0 evidence commit plus exact P0 and P1 evidence commits, verifies that their named source commits are the code being combined, and separately authorizes H1 implementation. The H0 prerequisite is the commit object itself: `git rev-list` must prove exactly one parent equal to the frozen H0 source named identically by its two fixed evidence blobs, and a NUL-delimited raw `git diff-tree` must prove exactly regular-file additions/modifications at `docs/gate-results/gate-a-connection-rpc.md` and `docs/probe-results.md`, with no rename, copy, mode/type substitution, submodule, or third path. The P1 prerequisite is independently checked the same way: exactly one parent equal to the frozen P1 source named identically by `docs/gate-results/shell-neutral-review-ui-p1.md` and `docs/probe-results.md`, and exactly those two regular-file additions/modifications in its NUL-delimited raw diff. Both fixed blobs for each phase must exist in that commit and name the same run/source; the two H0 blobs must also contain the same canonical `handoffManifestSha256`. No caller argument, environment value, current-worktree document, moving ref, copied text, or verbal handoff may supply or override any of those identities.
- Task 0 has four mandatory independent owner decisions—for accepted-P1 pre-merge hydration, union-lock reconstruction, final-lock hydration, and sealed-handoff import—plus three independent public-registry retry decisions that exist only after the corresponding hydration or reconstruction command returns its classified cache miss. Their canonical IDs are `DSH_PMWB_H1_PREMERGE_HYDRATION_DECISION_ID`, optional `DSH_PMWB_H1_PREMERGE_HYDRATION_NETWORK_DECISION_ID`, `DSH_PMWB_H1_UNION_LOCK_DECISION_ID`, optional `DSH_PMWB_H1_UNION_LOCK_NETWORK_DECISION_ID`, `DSH_PMWB_H1_HYDRATION_DECISION_ID`, optional `DSH_PMWB_H1_HYDRATION_NETWORK_DECISION_ID`, and `DSH_PMWB_H1_HANDOFF_IMPORT_DECISION_ID`; no ID can substitute for another scope. Each wrapper validates its action decision before creating output, validates the separate network decision before a network child, and binds the decisions actually used into its receipt and the composition records. Every later closure binds every prerequisite receipt it consumes; pre-merge hydration remains setup provenance in the immutable composition record and cannot masquerade as final union hydration.
- Product package freeze, Gate B bootstrap, Gate B runtime, isolated Product/ripple install-remove, and the bounded B10 process-group kill are five further distinct owner decisions after H1 code review. Each canonical decision ID is supplied through its one fixed CLI option, is bound into the artifact or run closure that consumes it, and cannot substitute for another decision. The gate itself is offline except for loopback; the install decision covers the exact audited Product tgz and, only when B18 runs, the exact H0-accepted ripple tgz. Runtime approval authorizes only an authenticated, identity-revalidated ordinary/final/failure stop that sends one `SIGTERM` to the fresh runner-owned process group and performs a bounded disappearance check with no automatic escalation. Kill approval authorizes only the ownership-verified B10 `SIGSTOP`/`SIGKILL` crash sequence; neither decision permits selection or signaling of a process outside that newly created group.
- Gate B candidate materialization is a sixth, post-run decision outside the five Gate action decisions. It exists only after a zero-candidate-output preview has frozen `candidateSetSha256`, binds the exact completed closure, render-policy hash, two destination/path-to-byte identities, fixed content-addressed candidate root and three-file schema, and is validated and atomically consumed before the renderer creates any candidate directory or file. Its canonical ID is `DSH_PMWB_GATE_B_CANDIDATE_MATERIALIZATION_DECISION_ID`; a consumed ID, including one consumed before a crash, cannot be replayed, and the decision cannot substitute for a Gate action, prerequisite, human-review, or evidence decision. The later human-review and evidence decisions bind this materialization decision, its authorization receipt, candidate receipt, and exact bytes.
- Target only exact DeepSeek Harness 0.1.0-rc.6. Any resolved package/export/signature drift from accepted Gate A′ is a stop condition and returns to architecture review.
- Build only ProductEndpointTypes in H1. ProbeEndpointTypes, counter.increment, probe health, ProbeWorkbenchApi, probe UI/copy, fault drivers, reduced quota wiring, and test fixture runners must not enter the Product graph or tgz.
- Every Gate B attempt gets a cryptographically random `runId` and a new, exclusively created `.tmp/dsh-pm-workbench/gate-b/runs/<runId>` root containing a matching ownership marker. `DSH_HOME`, `HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_DATA_HOME`, npm cache, pnpm home/store, Playwright browser path, and browser user-data directory must all resolve beneath marker-owned inputs or that run root. Reuse, symlink traversal, missing/mismatched markers, or deletion outside those roots fails preflight.
- Runtime uses port 3187, bind 127.0.0.1, `trustedHosts=[]`, and Connection authority `loopback`. Port 3080, `~/.dsh`, LAN, 0.0.0.0, trusted-host, proxy, tunnel, and shared `/api` interception are forbidden.
- The only admitted content identities are the two owner-reviewed R1/R2 normalized equivalence classes. The Product Host embeds only their accepted normalized hashes/manifest identity and rejects every other `source.importText` before any write. A UTF-8 input that differs only by the frozen BOM removal, CRLF/CR-to-LF, or Unicode NFC normalization is the same admitted content identity; the repository fixture/golden loader separately requires the committed artifacts to match their accepted raw bytes. Build and Gate preflight use the shared strict regular-file/realpath/same-read loader. Do not read Desktop, Downloads, clipboard, browser state, current Workspaces/Sessions, recordings, real transcripts, or real interview documents.
- Do not add or call a model, provider, credential reader, Agent, Subagent, external HTTP service, ASR, arbitrary filesystem importer, or shell tool from product code.
- The production repository, codec, quota meter, journal, commit marker, and recovery path are the code under fault test. A mock repository cannot substitute for them.
- The ripple theme remains an independently packaged add-on. Gate B may consume only the ripple subtree inside the exact H1-imported Gate A′ sealed handoff selected by `handoffManifestSha256FromAcceptedH0Evidence`, after rechecking its enclosing handoff, acceptance/owner-decision, artifact hash, and active-profile exclusion; H1 defines no second acceptance format or downloader. It never reads the H0 worktree directly, modifies the active theme, or combines theme data/config with the workbench.
- H1 executes only the owner-selected rc.6 CLI artifact sealed by H0: executable entry plus the complete package/dependency closure, version, integrity and tree hashes. It never calls bare `dsh`, searches PATH, falls back to a global install or `npx`, or records a host-global CLI path in evidence.
- A missing tool, skipped required test, uncertain commit-marker outcome without successful recovery, raw log only, screenshot only, stale prerequisite, or incomplete evidence is INCONCLUSIVE and therefore No-Go.
- Gate B PASS does not authorize real models, real data, active-profile installation, purge, LAN/multi-user use, push, PR, merge, license change, publication, or a general Harness-compatibility claim.

Runtime identifiers shown as `<runId>`, `<sourceCommit>`, or `<tgzSha256>` in generated-path descriptions are values produced and validated by scripts, never values the operator types or unfinished placeholders.

## Commit discipline for every task

Each authored-file Commit step stages only the literal file paths listed in that step, with `git add --` and no directory, glob, or `-A` argument. Task 0's two-parent merge is the sole exception: Git may auto-stage only the verifier-computed difference between the two exact accepted parent trees, while manual conflict resolution/staging is limited to the literal conflict allowlist in Task 0 Step 3. Before every commit, run:

~~~bash
git diff --cached --name-only
git diff --cached --check
git status --short
~~~

For authored commits, the first command must print exactly that task's literal staged-file allowlist. For the Task 0 merge, it must equal the verifier-computed parent-tree union plus only the actual changed subset of the literal conflict allowlist. No generated artifact, unrelated edit, or omitted file is allowed; the second command must exit 0; the third must show no unrelated tracked or untracked work. Any mismatch stops the commit for inspection.

## Frozen H1 composition inputs

Before Task 1, record these exact identities in `research/2026-09-02-h1-composition-inputs.md`:

~~~text
architecture spec SHA-256
exact accepted H0 evidence commit, its sole-parent frozen H0 source commit, and the exact raw-NUL two-regular-file evidence diff receipt
accepted P0 report commit and P0 source commit
exact accepted P1 evidence commit, its sole-parent frozen P1 source commit, and the exact raw-NUL two-regular-file evidence diff receipt
integration base commit
package-lock SHA-256
both fixture revisions, fixture manifest/set receipt, golden manifest/set receipt, and every golden-file SHA-256
Git blob OIDs and SHA-256 values for `<acceptedH0EvidenceCommit>:docs/gate-results/gate-a-connection-rpc.md` and `<acceptedH0EvidenceCommit>:docs/probe-results.md`; the one canonical handoffManifestSha256 derived identically from both blobs; run.final.json/report hashes; accepted CLI artifact manifest/tree/entry/version hashes; rippleAcceptanceManifestSha256; rippleTgzSha256; and owner decision ID
content-addressed exact-union manifest relative path and SHA-256, binding the accepted P1 tip, accepted H0 tip, exact root/workspace package manifests, dependency union, lock-reconstruction mode, and permitted registry mode
pre-merge hydration action decision and optional network decision; union-lock action decision and optional union-lock network decision; final-lock hydration action decision and optional hydration network decision; sealed-handoff import decision plus each wrapper's immutable receipt hash
~~~

The integration worktree is created only after approval, using `superpowers:using-git-worktrees` for detection and creation **only**, on local branch `codex/pmwb-h1-plugin-alpha`. Override the skill's Project Setup: do not run its bare `npm install`, do not edit/commit `.gitignore`, and do not fall back to the active checkout. The owner must approve an external worktree root with no ancestor `node_modules`. Immediately after creation, hydrate the accepted P1 lock through F0's audited wrapper under a separate pre-merge hydration decision; a verified cache miss stops for its own public-registry decision. Those pre-merge IDs are recorded separately and never reused for the final union lock. After Task 0 reconstructs the union lock, use `DSH_PMWB_H1_HYDRATION_DECISION_ID` and, only after its classified cache miss, `DSH_PMWB_H1_HYDRATION_NETWORK_DECISION_ID`. Every compiler/test/package executable and public package must resolve by realpath beneath this worktree's own `node_modules` and match the committed lock integrity. It combines only reviewed local commits through Task 0. A conflict resolution changes code and invalidates the corresponding prerequisite until the affected checks are rerun.

---

### Task 0: Compose the accepted H0 and P1 lines through one explicit integration merge

**Files:**

- Create before merge: research/2026-09-02-h1-composition-inputs.md
- Create before merge: scripts/verify-h1-composition.mjs
- Create before merge: tests/integration/h1-composition-boundary.test.ts
- Create before merge: scripts/import-gate-a-handoff.mjs
- Create before merge: tests/integration/gate-a-handoff-import.test.ts
- Modify before merge for safe lock reconstruction: scripts/install-exact-dependencies.mjs
- Modify before merge for safe lock reconstruction: tests/integration/exact-dependency-installer.test.ts
- Modify only when a listed merge conflict exists: package.json
- Modify when a listed merge conflict exists or exact union-lock reconstruction changes bytes: package-lock.json
- Modify only when a listed merge conflict exists: packages/workbench/package.json
- Modify only when a listed merge conflict exists: tsconfig.tests.json
- Modify only when a listed merge conflict exists: tests/integration/standalone-copy.test.ts
- Modify only when a listed merge conflict exists: scripts/workspace-boundary.ts
- Modify only when a listed merge conflict exists: docs/ci.md
- Modify only when a listed merge conflict exists: docs/probe-results.md
- Modify only when a listed merge conflict exists: README.md
- Modify only when a listed merge conflict exists: SECURITY.md
- Modify only when a listed merge conflict exists: docs/compatibility.md
- Modify only when a listed merge conflict exists: packages/workbench/README.md
- Modify only when a listed merge conflict exists: packages/workbench/docs/compatibility.md
- Modify only when a listed merge conflict exists: packages/workbench/docs/privacy.md
- Modify only when a listed merge conflict exists: .github/workflows/static-verification.yml
- Create after the merge commit: research/2026-09-02-h1-merge-resolution.md
- Modify after the merge commit: research/2026-09-02-h1-composition-inputs.md
- Generated outside Git: .tmp/dsh-pm-workbench/h1/exact-unions/<unionManifestSha256>/exact-union.json
- Generated outside Git: .tmp/dsh-pm-workbench/h1/action-receipts/<decisionIdSha256>/<receiptSha256>/receipt.json
- Generated outside Git after authorized import: .tmp/dsh-pm-workbench/gate-inputs/gate-a-handoff/<handoffManifestSha256FromAcceptedH0Evidence>/import-manifest.json

**Interfaces:**

- Consumes: the exact accepted P1 evidence commit with its verified sole-parent frozen source and raw-NUL exact-two-regular-file closure containing accepted P0/F0 ancestry, the exact accepted 40-hex H0 evidence commit containing accepted H0/F0 ancestry and its separately verified two-file Gate A′ closure, their one common accepted F0 evidence tip whose ledger names the frozen F0 source commit, and independent pre-merge hydration, union-lock, final hydration, and handoff-import decisions plus each conditionally used network decision.
- Produces: (1) a preparation commit on the P1 line, (2) one two-parent local merge commit, and (3) a documentation-only composition-record commit. The record binds every action/network decision actually used plus its receipt hash; phase-owned production modules remain byte-identical to an accepted parent.

- [ ] **Step 1: Verify immutable tips and create the worktree from P1**

Use full 40-character IDs copied from accepted evidence ledgers, never moving branches. `DSH_PMWB_ACCEPTED_H0_EVIDENCE_COMMIT` and `DSH_PMWB_ACCEPTED_P1_EVIDENCE_COMMIT` may name only the exact owner-accepted 40-lowercase-hex evidence commits; neither is accepted as a branch, tag, abbreviated SHA, manifest hash, path, or prose claim. Create `codex/pmwb-h1-plugin-alpha` from exactly `DSH_PMWB_ACCEPTED_P1_EVIDENCE_COMMIT`, then obtain a pre-merge hydration action decision bound to that commit, its lock, the new worktree, the one closed offline-first hydration transaction, and both fixed possible wrapper argv branches. The action decision authorizes the local hydration mutation and mandatory offline first attempt only; it does not authorize public network. Record it as `DSH_PMWB_H1_PREMERGE_HYDRATION_DECISION_ID` and run before any npm/Vitest/TypeScript command:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --offline --action-decision-id "$DSH_PMWB_H1_PREMERGE_HYDRATION_DECISION_ID"
~~~

Only if that wrapper returns its signed/classified cache-miss receipt for this still-open action transaction, obtain a distinct public-registry decision as `DSH_PMWB_H1_PREMERGE_HYDRATION_NETWORK_DECISION_ID`. That decision is a one-use amendment bound to the original action ID, exact miss receipt, unchanged inputs/output, fixed public registry and exact online retry argv; retry once with both IDs. This is the authorized continuation of one transaction, not replay of a completed action. The action decision remains required and the network decision cannot replace it:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --public-registry-network --action-decision-id "$DSH_PMWB_H1_PREMERGE_HYDRATION_DECISION_ID" --network-decision-id "$DSH_PMWB_H1_PREMERGE_HYDRATION_NETWORK_DECISION_ID"
~~~

Before merging and while still on that clean P1-derived worktree, use Git object reads against the exact H0 commit—not the current checkout's documents—to prove P0/F0 ancestry under P1, H0/F0 ancestry under the H0 evidence commit, one exact common F0 evidence tip plus the frozen F0 source commit named by its ledger block, and the required fixed H0 blobs. Through fixed executable-plus-argv calls with `shell: false`, the verifier runs the equivalent of `git cat-file -e <acceptedH0EvidenceCommit>^{commit}`, `git rev-list --parents -n 1 <acceptedH0EvidenceCommit>`, and NUL-delimited `git diff-tree --no-commit-id --raw -r -z <h0SourceCommit> <acceptedH0EvidenceCommit>`. It requires exactly one parent, requires that parent to equal the frozen H0 source parsed identically from both evidence blobs, and requires the relative diff to contain exactly regular-file changes at `docs/gate-results/gate-a-connection-rpc.md` and `docs/probe-results.md`, with no rename, copy, type/mode substitution, submodule, or third path. Read `<commit>:docs/gate-results/gate-a-connection-rpc.md` and `<commit>:docs/probe-results.md` as blobs, bind each blob OID and the SHA-256 of the same bytes, parse their unique accepted Gate A′ run blocks, and require identical canonical `handoffManifestSha256`, H0 source commit, `runId`, and `runFinalSha256` values. An absent blob, multiple or ambiguous selected blocks, malformed hash, report/ledger disagreement, non-PASS Gate A′ block, extra parent/path, wrong parent, or any attempt to obtain the hash from the P1 worktree, caller, environment, clipboard, or owner narration stops before implementation. Record the exact H0 evidence commit, its verified sole parent, the NUL-delimited two-path diff receipt, both fixed blob identities and matching parsed fields, accepted P0/P1 tips, reports, hashes, F0 evidence-tip/source identities, fixture/golden set receipts, Gate A final/report/handoff/CLI/ripple bindings, and intended second parent in `research/2026-09-02-h1-composition-inputs.md`; do not claim an integration commit yet.

Independently treat `DSH_PMWB_ACCEPTED_P1_EVIDENCE_COMMIT` as a commit object and run the same fixed `cat-file`, `rev-list`, and raw NUL-delimited `diff-tree` topology checks against the frozen P1 source parsed identically from `<acceptedP1EvidenceCommit>:docs/gate-results/shell-neutral-review-ui-p1.md` and `<acceptedP1EvidenceCommit>:docs/probe-results.md`. Require exactly one parent equal to that source and exactly regular-file additions/modifications at those two paths, with no rename, copy, mode/type change, submodule, or third path. Both blobs must have stable OID/SHA-256 identities and must name one identical accepted P1 run, source, final marker, report, review decision, and evidence decision. Require the current clean HEAD to equal this exact P1 evidence commit before the preparation commit. Record its parent, raw-NUL diff receipt, both blob identities, and matching parsed fields beside the H0 receipt; a name-only diff or ancestry alone is insufficient.

- [ ] **Step 2: Add and commit the composition verifier before merging**

Write `h1-composition-boundary.test.ts` and `gate-a-handoff-import.test.ts` RED against synthetic commit graphs/trees and synthetic sealed handoffs, then run the focused tests and observe the expected failures before writing implementation. The verifier has four explicit states and never guesses from a dirty tree: `prepare`, `staged-merge`, `record-candidate`, and `recorded`. `prepare` validates full-SHA prerequisite tips, ancestry, both the accepted H0 and accepted P1 evidence commits' independent exact one-parent/raw-NUL-two-regular-file closures, their fixed blobs read directly from those commit objects, their byte hashes and matching parsed evidence identities, and the pre-merge input record without requiring a future merge or resolution record. Synthetic Git fixtures cover nominal H0 and P1 evidence commits; for each phase they also cover a merge commit with the same two correct blobs, a wrong-parent commit, a name-only-equivalent mode/type/submodule replacement, a rename/copy, and a single-parent commit with those blobs plus one source/config file; every negative must fail before merge or import. `staged-merge` requires the expected `MERGE_HEAD`, validates the complete index plus conflict allowlist, and proves the exact accepted H0 Gate A′ and P1 blocks are still present byte-for-byte in the staged union ledger. It also computes the only accepted deterministic union for conflicting root/package documentation: preserve both parents' immutable evidence identities and boundary statements, make the canonical root ledger authoritative, keep package text build-time-only, state that the combined H1 tree and Gate B are not yet verified, and never imply that either already sealed parent tgz changed. `record-candidate` permits exactly the two staged documentation paths from Step 6 and validates their claimed parent merge. `recorded` requires the documentation commit whose sole parent is the recorded two-parent merge. Tests reject a branch/ref in place of a full SHA, wrong merge base, missing or ambiguous fixed report/ledger blob, report/ledger hash or parsed-field disagreement, extra evidence parent/path/type/mode change, a caller/environment/current-worktree manifest-hash substitution, dirty input outside the mode allowlist, unexpected conflict path, dropped H0/P1 ledger block, dropped dependency/script/config, a non-deterministic or status-promoting documentation merge, edited phase-owned production byte, lock/manifest disagreement, a missing resolution record in the two record modes, a missing/substituted action or network decision, or a test that depends on pre-existing build output.

Implement `verify-h1-composition.mjs`, `import-gate-a-handoff.mjs`, and extend F0's installer with a tested `--package-lock-only` mode. The verifier accepts exact H0 and P1 evidence commits as separate 40-lowercase-hex commit IDs, resolves both to commit objects, and independently verifies both one-parent/raw-NUL-two-regular-file closures above. It reads only each commit object's fixed phase report and canonical-ledger blobs; only the H0 pair derives the handoff hash and matching H0 source/run identities. The preparation verifier requires both arguments to equal the commits recorded in `research/2026-09-02-h1-composition-inputs.md`; during the staged merge, the importer requires the H0 argument to equal `MERGE_HEAD`. The importer additionally requires exactly one `--handoff-import-decision-id <canonical-id>` whose external authorization record binds the accepted H0 evidence commit, both fixed blob hashes, derived handoff hash, immutable export manifest, destination root, current merge boundary, and fixed copy operation. It rejects a missing, duplicate, substituted, cross-scoped, expired, or identity-mismatched decision before creating output and binds the ID into `import-manifest.json`. Neither script reads evidence paths from the current worktree or exposes a handoff-manifest-hash input. A caller-provided or inherited environment hash, arbitrary evidence file, moving ref, copied report, spoken hash, or import decision from another closure cannot substitute for values derived from the Git blobs and authorization record.

In `prepare`, the verifier also derives the exact H0∪P1 root/workspace package-manifest union from the two accepted commit objects, canonicalizes it, and writes it once as `.tmp/dsh-pm-workbench/h1/exact-unions/<unionManifestSha256>/exact-union.json`. The manifest is written last below an exclusively created marker-owned directory and binds schema version, accepted P1 evidence commit plus its verified source/diff receipt, accepted H0 evidence commit plus its verified source/diff receipt, both input package/lock hashes, the complete exact dependency/devDependency/peer/export/script union, expected root/workspace manifest bytes, allowed lock-only modes, and the input Git-blob receipt. `unionManifestSha256` is computed over the final canonical manifest bytes and appears only in the enclosing directory name and verifier output, never inside those bytes, so there is no self-hash cycle. The verifier prints exactly the relative path and SHA-256; the operator records both in `research/2026-09-02-h1-composition-inputs.md` before the preparation commit. Later `prepare`/`staged-merge` checks and the installer recompute the manifest from Git objects and accept the recorded path/hash only as equality assertions. Missing, changed, symlinked, caller-selected, differently derived, or non-content-addressed union input fails before lock mutation.

`exact-dependency-installer.test.ts` locks the complete new mode while preserving F0's accepted authorization grammar. `--package-lock-only` requires exactly one `--exact-union-manifest <recorded-path>`, one `--exact-union-manifest-sha256 <64-lowercase-hex>`, one `--action-decision-id <canonical-id>` carrying `DSH_PMWB_H1_UNION_LOCK_DECISION_ID`, and exactly one network mode. Offline mode accepts no network-decision flag; public-registry mode additionally requires exactly one distinct `--network-decision-id <canonical-id>` carrying `DSH_PMWB_H1_UNION_LOCK_NETWORK_DECISION_ID`. `--hydrate-lock` retains the inherited F0 CLI exactly: it always requires `--action-decision-id <canonical-id>` carrying `DSH_PMWB_H1_HYDRATION_DECISION_ID`, its public-registry form additionally requires one distinct `--network-decision-id <canonical-id>` carrying `DSH_PMWB_H1_HYDRATION_NETWORK_DECISION_ID`, and offline rejects that flag. Each action record binds one closed offline-first transaction and the exact two possible wrapper argv branches but grants only the local output mutation; its offline attempt either completes the transaction or emits one immutable cache-miss receipt that leaves only the fixed online continuation open. A network record can enable that continuation only when it binds the same action ID, exact miss receipt, unchanged inputs/output and fixed public-registry argv. The wrapper validates the supplied records' phase, action, transition, and expected canonical IDs against the selected mode, so a union decision cannot satisfy hydration even though the fixed option names are shared. It validates every external decision before output/spawn, binds the actual transition and decisions into a content-addressed final action receipt, and keeps npm child argv closed to the reviewed npm flags—decision metadata never reaches npm. The receipt path hashes the validated canonical decision ID as `decisionIdSha256`; raw authorization text or an untrusted ID never becomes a path segment. Tests reject a missing/extra/equal/cross-scoped/expired/substituted decision, a completed-action replay, online retry without the exact preceding miss, a second retry, input/output drift between attempts, a legacy-incompatible alias, both network modes, a network decision in offline mode, public-network mode without both action and network decisions, an alternate path/hash, manifest/Git-union drift, registry fallback, lifecycle execution, and any manifest mutation. Offline cache miss is a classified nonzero pause, never an implicit online retry or a completed success. Lock-only mode may write only `package-lock.json`, and only when the post-resolution workspace snapshot equals the exact union manifest.

The importer reproduces H0's repository-family algorithm completely. It obtains `commonDir` with fixed `git rev-parse --path-format=absolute --git-common-dir`, requires fixed `git rev-parse --is-bare-repository` to return literal `false`, resolves `commonDirRealpath`, computes `primaryCheckout = realpath(dirname(commonDirRealpath))`, and requires that checkout to occur exactly once in two byte-identical, stable reads of fixed `git worktree list --porcelain -z`; duplicate/ambiguous checkout realpaths or a list that changes during derivation fail closed. It computes `familyId = sha256(UTF8(commonDirRealpath))`, then derives `<realpath(dirname(primaryCheckout))>/.dsh-pm-workbench-handoffs/<familyId>` and the exact `dsh-pm-workbench/gate-a/<h0SourceCommit>/<runFinalSha256>/<handoffManifestSha256FromAcceptedH0Evidence>/` child without scanning siblings. The supplied and resolved common directory, primary checkout, every existing derived-root component, root marker, manifest family ID, and checkout exclusion must all agree with that derivation and contain no symlink; family drift, a missing/changed marker, a checkout-contained root, a bare/linked ambiguity, or an unstable worktree list is fatal. An optional `--handoff-root` is only an equality assertion against the derived canonical absolute root; it cannot select or redirect the root.

The importer requires an exclusively created marker-owned regular-file tree with no symlink, hardlink, special file, raw log, extra file, or path outside the root, and same-read hashes for the Gate A four-file closure, CLI artifact closure, ripple acceptance/owner decision/tgz, and source/lock identities. The handoff manifest must match the hash derived from the accepted H0 evidence blobs and must not contain the future promoted repository documents `docs/gate-results/gate-a-connection-rpc.md` or `docs/probe-results.md`, any evidence-commit identity field including `evidenceCommit` or `acceptedH0EvidenceCommit`, or any claim that it was sealed after promotion; those are impossible for H0's pre-promotion sealed export. It copies the verified set once into `.tmp/dsh-pm-workbench/gate-inputs/gate-a-handoff/<handoffManifestSha256FromAcceptedH0Evidence>/`; it never selects “latest,” mtime, a caller hash, or a caller path. The lock mode inherits F0's audited empty-user-and-global-config contract: recorded npm, `shell: false`, `--ignore-scripts`, fixed public registry, exact packages, unique marker-owned HOME/XDG/cache plus empty `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG`, and stripped auth/token/proxy/provider/npm-override environment.

Before staging, prove the TDD sequence and preparation state:

~~~bash
npm test -- tests/integration/h1-composition-boundary.test.ts tests/integration/gate-a-handoff-import.test.ts
# expected RED before implementation
npm test -- tests/integration/h1-composition-boundary.test.ts tests/integration/gate-a-handoff-import.test.ts tests/integration/exact-dependency-installer.test.ts
node scripts/verify-h1-composition.mjs --mode prepare --accepted-h0-evidence-commit "$DSH_PMWB_ACCEPTED_H0_EVIDENCE_COMMIT" --accepted-p1-evidence-commit "$DSH_PMWB_ACCEPTED_P1_EVIDENCE_COMMIT" --emit-exact-union-manifest
node scripts/verify-h1-composition.mjs --mode prepare --accepted-h0-evidence-commit "$DSH_PMWB_ACCEPTED_H0_EVIDENCE_COMMIT" --accepted-p1-evidence-commit "$DSH_PMWB_ACCEPTED_P1_EVIDENCE_COMMIT" --exact-union-manifest "$DSH_PMWB_H1_EXACT_UNION_MANIFEST" --exact-union-manifest-sha256 "$DSH_PMWB_H1_EXACT_UNION_MANIFEST_SHA256" --check
~~~

Only the second focused run and both `prepare` invocations may be GREEN. Set the two `DSH_PMWB_H1_EXACT_UNION_*` values only from the first invocation's single JSON result after independently recomputing the file hash; record that exact pair in the composition-input document before the `--check` invocation. Neither variable selects content. Then commit only:

~~~bash
git add -- research/2026-09-02-h1-composition-inputs.md scripts/verify-h1-composition.mjs tests/integration/h1-composition-boundary.test.ts scripts/import-gate-a-handoff.mjs tests/integration/gate-a-handoff-import.test.ts scripts/install-exact-dependencies.mjs tests/integration/exact-dependency-installer.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "test: add the H1 composition verifier"
~~~

- [ ] **Step 3: Merge the exact accepted H0 evidence commit without committing**

Run a no-fast-forward, no-commit merge of the same recorded 40-character H0 evidence commit whose fixed blobs supplied the handoff hash. Nonconflicting files come only from accepted parent trees. The verifier generates the expected auto-staged path union. Manual resolution is allowed only for:

~~~bash
git merge --no-ff --no-commit "$DSH_PMWB_ACCEPTED_H0_EVIDENCE_COMMIT"
~~~

~~~text
package.json / package-lock.json / packages/workbench/package.json:
  exact union of accepted dependencies, scripts, peers, exports and private/UNLICENSED boundary
tsconfig.tests.json:
  union of required TS/TSX roots with Node default
standalone-copy / workspace-boundary / docs/ci / static-verification:
  union of every accepted required config/path and exactly targeted phase commands
docs/probe-results.md:
  append-only preservation of both accepted run blocks and hashes, including the exact H0 Gate A′ block from the accepted H0 evidence-commit blob
README.md / SECURITY.md / docs/compatibility.md:
  deterministic union of accepted H0 and P1 evidence references, boundaries, and canonical-ledger linkage; combined H1 tree and Gate B remain NOT_RUN
packages/workbench/README.md / packages/workbench/docs/compatibility.md / packages/workbench/docs/privacy.md:
  deterministic build-time-only union of accepted parent provenance and boundaries; no mutable current-state claim and no implication that a sealed parent tgz changed
~~~

Any conflict in `packages/workbench/src/**`, fixture/golden bytes, endpoint registry, Gate report, or any unlisted path aborts the merge. Repair on the owning phase line, obtain new evidence where required, and restart Task 0.

- [ ] **Step 4: Reconstruct the union lock and verify the complete merge tree**

Resolve the allowed root/workspace package manifests to the exact canonical bytes in the recorded exact-union manifest; do not hand-edit dependency nodes or integrity. Obtain the lock-reconstruction action authorization bound to those two accepted tips and evidence-topology receipts, the recorded union-manifest path/hash, output `package-lock.json`, and the closed offline-first transaction with its exact offline and conditional public-registry argv branches. It authorizes the local lock mutation and mandatory offline first attempt, not network; record its canonical ID as `DSH_PMWB_H1_UNION_LOCK_DECISION_ID`, then invoke the safe wrapper in its complete offline grammar:

~~~bash
node scripts/install-exact-dependencies.mjs --package-lock-only --exact-union-manifest "$DSH_PMWB_H1_EXACT_UNION_MANIFEST" --exact-union-manifest-sha256 "$DSH_PMWB_H1_EXACT_UNION_MANIFEST_SHA256" --offline --action-decision-id "$DSH_PMWB_H1_UNION_LOCK_DECISION_ID"
~~~

The installer independently recomputes the union from the accepted Git objects and requires the two manifest arguments to equal the committed composition record; they never select an alternate manifest. If and only if this command returns the immutable classified cache-miss receipt while leaving this action transaction open, stop and obtain a separate public-registry lock-reconstruction authorization bound to the same action decision, exact miss receipt, unchanged inputs/output, fixed registry, exact network child argv, and one retry. Record it as `DSH_PMWB_H1_UNION_LOCK_NETWORK_DECISION_ID` before that one permitted continuation:

~~~bash
node scripts/install-exact-dependencies.mjs --package-lock-only --exact-union-manifest "$DSH_PMWB_H1_EXACT_UNION_MANIFEST" --exact-union-manifest-sha256 "$DSH_PMWB_H1_EXACT_UNION_MANIFEST_SHA256" --public-registry-network --action-decision-id "$DSH_PMWB_H1_UNION_LOCK_DECISION_ID" --network-decision-id "$DSH_PMWB_H1_UNION_LOCK_NETWORK_DECISION_ID"
~~~

`package-lock.json` may be restaged when and only when this deterministic reconstruction changes its bytes, even if Git did not mark that path conflicted; this is the sole non-conflict exception in the resolution allowlist. Recompute the manifest snapshot, exact versions, integrity and licenses; no lifecycle script may run. Next obtain a separate final-lock hydration action authorization bound to the reconstructed lock, worktree, output `node_modules`, and another closed offline-first transaction with exact offline and conditional public-registry argv branches. It authorizes the local hydration mutation and mandatory offline first attempt, not network; record it as `DSH_PMWB_H1_HYDRATION_DECISION_ID` and run the exact offline hydration before any npm, Vitest, TypeScript, build, verify, or pack command:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --offline --action-decision-id "$DSH_PMWB_H1_HYDRATION_DECISION_ID"
~~~

If and only if hydration returns its own immutable classified cache-miss receipt while leaving that action transaction open, stop for a distinct public-registry hydration authorization bound to the action decision, exact miss receipt, unchanged reconstructed lock/output, fixed registry, exact network child argv, and one retry. Record it as `DSH_PMWB_H1_HYDRATION_NETWORK_DECISION_ID` before the single permitted continuation:

~~~bash
node scripts/install-exact-dependencies.mjs --hydrate-lock --public-registry-network --action-decision-id "$DSH_PMWB_H1_HYDRATION_DECISION_ID" --network-decision-id "$DSH_PMWB_H1_HYDRATION_NETWORK_DECISION_ID"
~~~

The lock-reconstruction action/network decisions do not authorize hydration, and the hydration action/network decisions do not authorize reconstruction. Reusing an action ID only for its receipt-bound online continuation is not a second action consumption; any retry after completion or without the exact preceding cache miss is rejected. Each wrapper validates both applicable decisions while keeping the child npm argv free of decision metadata and writes one content-addressed final receipt for the completed transition. Revalidate every executable/package realpath and lock integrity before continuing. Before any handoff copy, obtain a separate import authorization bound to the exact accepted H0 evidence commit, its two Git blob identities, `handoffManifestSha256FromAcceptedH0Evidence`, sealed export manifest, derived destination, and this staged-merge boundary; record it as `DSH_PMWB_H1_HANDOFF_IMPORT_DECISION_ID`. It authorizes only the one immutable copy, never network, source/lock mutation, a different handoff, Harness, profile access, or evidence promotion. After import and resolution, stage only the actual changed subset of the literal conflict allowlist from Step 3 plus the verified union-lock exception; never stage a directory, wildcard, production source, or an unlisted path. The staged `docs/probe-results.md` must retain the exact accepted H0 Gate A′ block; neither an “ours” resolution nor a semantically reconstructed substitute is acceptable. Every resolved root/package document must equal the verifier-computed deterministic union described in Step 2 and must retain Gate B as NOT_RUN.

~~~bash
node scripts/import-gate-a-handoff.mjs --from-evidence-commit "$DSH_PMWB_ACCEPTED_H0_EVIDENCE_COMMIT" --handoff-import-decision-id "$DSH_PMWB_H1_HANDOFF_IMPORT_DECISION_ID"
git add -- package.json package-lock.json packages/workbench/package.json tsconfig.tests.json tests/integration/standalone-copy.test.ts scripts/workspace-boundary.ts docs/ci.md docs/probe-results.md README.md SECURITY.md docs/compatibility.md packages/workbench/README.md packages/workbench/docs/compatibility.md packages/workbench/docs/privacy.md .github/workflows/static-verification.yml
npm test -- tests/integration/h1-composition-boundary.test.ts tests/integration/exact-dependency-installer.test.ts tests/integration/standalone-copy.test.ts
npm run typecheck
npm run build -- --target probe
npm run verify:package -- --target probe
npm run pack:dry -- --target probe
node scripts/verify-h1-composition.mjs --mode staged-merge --accepted-h0-evidence-commit "$DSH_PMWB_ACCEPTED_H0_EVIDENCE_COMMIT" --accepted-p1-evidence-commit "$DSH_PMWB_ACCEPTED_P1_EVIDENCE_COMMIT"
git diff --cached --check
git diff --cached --name-only
git status --short
~~~

The literal `git add --` list is the complete conflict allowlist plus the sole union-lock exception; Git stages only paths whose bytes/modes actually changed. Run the accepted P0 and P1 static/unit command manifests too. The verifier compares the actual staged subset—not the nominal allowlist—with the computed parent union and closed resolution allowlist, revalidates both prerequisite evidence topologies, and hashes every one-parent phase-owned module against that parent. Any unrelated path, changed production byte, missing contribution, stale `lib` dependency, unresolved marker, missing/substituted decision, or receipt mismatch stops.

- [ ] **Step 5: Commit the verified two-parent merge**

Commit the staged merge without squash/rebase/amend. Confirm it has exactly the preparation commit and the exact accepted H0 evidence commit as parents; confirm the accepted P1/P0/F0 and H0/F0 tips are ancestors. Re-read the H0 report and ledger blobs from that second parent and prove the committed merge ledger still contains their exact Gate A′ block and the same `handoffManifestSha256FromAcceptedH0Evidence`. Original runtime reports remain prerequisite evidence for their exact source tips, not evidence that the new merge itself ran. Gate B later proves the combined tree.

~~~bash
git commit -m "build: merge accepted H0 and P1 workbench lines"
git show --no-patch --format=%P HEAD
git status --short
~~~

The parent output must contain exactly two full commit IDs in the recorded order, and status must be empty.

- [ ] **Step 6: Record and commit the immutable composition result**

Now that the merge ID exists, write `research/2026-09-02-h1-merge-resolution.md` with both parents, accepted phase tips, both H0/P1 sole-parent/raw-NUL evidence receipts and named source SHAs, merge commit/tree, expected/staged name hashes, every actual conflict/resolution, pre-merge hydration action/network decision IDs and receipt, union lock and hydration hashes, union-lock action/network decision IDs and receipt, final hydration action/network decision IDs and receipt, the imported Gate A′ handoff manifest/copy hashes selected by `handoffManifestSha256FromAcceptedH0Evidence`, `DSH_PMWB_H1_HANDOFF_IMPORT_DECISION_ID` and import receipt, both fixed H0 evidence blob identities, phase-subtree hashes, commands/results, and Gate B `NOT_RUN`. Append the same immutable decision and handoff identities to `h1-composition-inputs.md`. Stage only those two documents, validate the exact record candidate, commit them, then validate the resulting one-parent documentation commit:

~~~bash
git add -- research/2026-09-02-h1-composition-inputs.md research/2026-09-02-h1-merge-resolution.md
git diff --cached --name-only
git diff --cached --check
git status --short
node scripts/verify-h1-composition.mjs --mode record-candidate --accepted-h0-evidence-commit "$DSH_PMWB_ACCEPTED_H0_EVIDENCE_COMMIT" --accepted-p1-evidence-commit "$DSH_PMWB_ACCEPTED_P1_EVIDENCE_COMMIT"
git commit -m "docs: record the H1 composition merge"
node scripts/verify-h1-composition.mjs --mode recorded --accepted-h0-evidence-commit "$DSH_PMWB_ACCEPTED_H0_EVIDENCE_COMMIT" --accepted-p1-evidence-commit "$DSH_PMWB_ACCEPTED_P1_EVIDENCE_COMMIT"
git status --short
~~~

This documentation commit is the integration base for Task 1. It records its parent merge commit rather than trying to self-reference. Any accepted production-byte change still returns to the owning phase and restarts Task 0.

---

### Task 1: Prove the public storage surface and define durable records

**Files:**

- Create: tests/types/storage-domain-rc6-surface.ts
- Create: tsconfig.surface.storage.json
- Create: research/2026-09-02-storage-domain-rc6-atomicity.md
- Create: tests/contract/storage-domain-rc6-atomicity-contract.test.ts
- Create: packages/workbench/src/ports/storage-domain-driver.ts
- Create: packages/workbench/src/adapters/storage/record-types.ts
- Create: packages/workbench/src/adapters/storage/record-codec.ts
- Create: packages/workbench/src/adapters/storage/persisted-limits.ts
- Create: packages/workbench/src/adapters/node-id-port.ts
- Create: packages/workbench/src/adapters/system-clock-port.ts
- Create: packages/workbench/src/integration/harness-rc6/product/storage-domain-driver.ts
- Create: packages/workbench/src/integration/harness-rc6/product/domain-spec.ts
- Create: tests/adapters/storage-record-codec.test.ts
- Create: tests/adapters/storage-domain-driver-contract.test.ts
- Create: tests/adapters/node-id-port.test.ts
- Create: tests/adapters/system-clock-port.test.ts
- Create: tests/support/memory-storage-domain-driver.ts
- Modify: tests/integration/standalone-copy.test.ts

**Interfaces:**

- Consumes: exact public `ctx.storageDomain.open(spec)`, `Domain.global.get/set`, table `get/put/update/delete`, and `Domain.close()` surfaces observed in rc.6, plus authoritative version-locked public documentation/source for `Domain.global.set` single-key crash-atomic replacement semantics.
- Consumes: F0 IdPort/ClockPort and the accepted H0 asynchronous NodeSha256 adapter.
- Produces: a narrow `StorageDomainDriver`, strict durable record codecs, production limit constants, production Node ID/clock adapters, and the rc.6 storage adapter.

- [ ] **Step 1: Write the RED compile-only public-surface contract and runtime memory-driver tests**

`tests/types/storage-domain-rc6-surface.ts` imports only the exact public rc.6 package exports and typechecks that `open()` returns a Domain with the required global/table operations and an awaited `close()`. It never constructs a fake Harness context or executes storage methods. `tsconfig.surface.storage.json` resolves only repository `node_modules`, rejects a parent checkout/private subpath/copied declaration/Harness source tree, and is compile-only. Runtime driver/repository behavior in this task uses `tests/support/memory-storage-domain-driver.ts`; the real rc.6 adapter is executed only by the separately authorized Gate B.

Before defining `replaceRoot`, inspect the exact resolved rc.6 package's public declaration, public implementation/source artifact, version, integrity, entry hash, license, and any official public contract text. Record citations by package-relative path and SHA-256—not a private checkout path—in `research/2026-09-02-storage-domain-rc6-atomicity.md`. `storage-domain-rc6-atomicity-contract.test.ts` fails unless this frozen evidence proves that one awaited `Domain.global.set` on a single known key is crash-atomic: after process interruption it exposes either the complete previous value or the complete replacement value, never torn/partial data. A type signature, in-memory mock, ordinary successful reread, or inference from the method name is insufficient. If the exact rc.6 public material does not make that guarantee, record `NO_GO_UNPROVEN_ATOMIC_REPLACEMENT` and stop H1; do not implement a journal on top of an unproven marker.

Extend `standalone-copy.test.ts` in this same task so `tsconfig.surface.storage.json` is a required copied candidate and a missing copy fails. The standalone test creates any build output it reads in a unique temporary child; it never relies on an existing repository `lib`.

Define the narrow port:

~~~ts
export interface StorageDomainDriver {
  readRoot(): Promise<unknown>
  replaceRoot(value: unknown): Promise<void>
  readRecord(table: StorageTable, key: string): Promise<unknown | undefined>
  writeRecord(table: StorageTable, key: string, value: unknown): Promise<void>
  removeRecord(table: StorageTable, key: string): Promise<void>
  close(): Promise<void>
}
~~~

No driver method exposes a physical path, raw SQL, transaction claim, unrestricted table name, watch stream, profile object, or migration helper.
The production adapter may emit only two fixed, payload-free lifecycle events around the accepted primitive—`root-replace-begin` and `root-replace-returned`—each carrying only an opaque transaction ID plus a strictly increasing per-process sequence. For Gate B, these fixed operational audit events use the supervisor's authenticated, bounded, atomic-frame event channel. The adapter first invokes the accepted `Domain.global.set` and captures its returned promise, installs the returned-frame/ACK continuation before yielding, and only then commits `root-replace-begin` with a fixed `primitiveInvoked: true` enum and waits for the matching collector ACK. A synchronous throw emits no begin and cannot enter B10. If the captured promise settles before or while begin is acknowledged, the installed continuation commits `root-replace-returned`; the attempt is ineligible for a crash observation. After the awaited primitive resolves, the adapter cannot resolve `replaceRoot()` to its caller until that returned frame receives its matching ACK. Thus a valid ACKed begin proves invocation occurred, while the stopped-state drain below distinguishes a still-pending call from a return race. The fixed frame is smaller than the transport's proven atomic-message limit, and an unacknowledged, partial, duplicate, reordered, or mismatched frame fails the operation rather than being treated as absence. Outside an authenticated collector the same events may use the accepted sanitized logger, but that path is ineligible for B10 timing evidence. This is a production observability contract, not a runtime fault switch: it exposes no fault injection control, root value, storage path, or test-only command, and the packaged byte graph is identical in Gate and ordinary use.

- [ ] **Step 2: Run RED**

~~~bash
./node_modules/.bin/tsc -p tsconfig.surface.storage.json --noEmit
npm test -- tests/contract/storage-domain-rc6-atomicity-contract.test.ts tests/adapters/storage-record-codec.test.ts tests/adapters/storage-domain-driver-contract.test.ts tests/adapters/node-id-port.test.ts tests/adapters/system-clock-port.test.ts
npm test -- tests/integration/standalone-copy.test.ts
npm run typecheck
~~~

Expected: FAIL because the driver, schema, and codecs do not exist. A failure in the public rc.6 signature is an H1 stop, not permission to deep-import or upgrade.

- [ ] **Step 3: Define versioned records and one visible root**

Use these tables only:

~~~ts
export type StorageTable =
  | 'catalog_generations'
  | 'project_generations'
  | 'receipt_generations'
  | 'journals'

export interface RepositoryRootV1 {
  dataSchemaVersion: 1
  activeCatalogGenerationId: GenerationId
  committedTransactionId: TransactionId
  cursorSigningKeyBase64Url: string
}

export interface CatalogGenerationV1 {
  id: GenerationId
  catalogVersion: number
  projects: Readonly<Record<string, {
    projectGenerationId: GenerationId
    receiptGenerationId: GenerationId
    summary: ProjectSummary
  }>>
  canonicalHash: Sha256
}

export interface ProjectGenerationV1 {
  id: GenerationId
  projectId: ProjectId
  aggregate: ProjectAggregate
  canonicalUtf8Bytes: number
  canonicalHash: Sha256
}

export interface ReceiptGenerationV1 {
  id: GenerationId
  projectId: ProjectId
  receipts: Readonly<Record<string, ProjectCommandReceipt>>
  canonicalUtf8Bytes: number
  canonicalHash: Sha256
}

export interface PendingIntentV1 {
  key: 'pending-v1'
  kind: 'initialize' | 'mutation'
  transactionId: TransactionId
  oldRootIdentity: Sha256 | 'NO_ROOT_V1'
  targetRoot: RepositoryRootV1
  targetRootHash: Sha256
  stagedRecords: readonly PersistedRecordRef[]
  supersededRecords: readonly PersistedRecordRef[]
  projectedPhysicalBytes: number
  state: 'prepared'
  canonicalHash: Sha256
}
~~~

There is exactly one known journal key, `journals/pending-v1`, because the public driver has no enumeration primitive and H1 supports one writer. `PendingIntentV1` is written and reread **before any generation staging** and predeclares every future generation key/hash, every superseded ref, the complete target root, and projected physical bytes. Thus a crash after any later write leaves a discoverable inventory; random generation IDs never exist only in lost process memory. The current root's `committedTransactionId` and the pending intent's old/target identities decide whether the transaction lost or won. A second pending intent is forbidden until the first is recovered and removed. `NodeIdPort` wraps `crypto.randomUUID()` and validates canonical lowercase UUID v4 output; `SystemClockPort` returns a finite canonical UTC ISO instant. Fault tests inject deterministic F0 port implementations rather than altering either production adapter.

- [ ] **Step 4: Implement strict codecs and initialization**

All reads parse strict schemas, recompute byte counts/hashes, traverse aggregate refs, and reject unsupported `dataSchemaVersion`. Initialization has an explicit no-root state machine. `open()` under the process-local single-open coordinator observes exactly one of: (a) root present/no intent; (b) `NO_ROOT_V1` and no intent; (c) `NO_ROOT_V1` plus a valid initialization intent at `pending-v1`; or (d) invalid/mismatched state, which fails closed. For (b), generate one cryptographically random 256-bit cursor key and target empty catalog/root entirely in memory, check projected physical quota, write/reread the fixed initialization intent first, stage/reread the listed catalog, atomically replace root, synchronously remove the intent, then return. For (c), if all intent-listed bytes/hashes exist, finish the exact target-root replacement; if staging is absent/incomplete and root is still absent, remove only the fully enumerated intent-owned records and intent before a fresh attempt. Cleanup failure leaves initialization `recovery-required` and read-only; it never silently resets, rotates an already committed key, or discards an unknown record. Concurrent double-open calls serialize and observe one committed signing key; multiple Host processes remain unsupported. The key is never returned by Product health, logged, exported, embedded in a cursor payload, or copied into evidence.

- [ ] **Step 5: Run GREEN**

~~~bash
./node_modules/.bin/tsc -p tsconfig.surface.storage.json --noEmit
npm test -- tests/contract/storage-domain-rc6-atomicity-contract.test.ts tests/adapters/storage-record-codec.test.ts tests/adapters/storage-domain-driver-contract.test.ts tests/adapters/node-id-port.test.ts tests/adapters/system-clock-port.test.ts
npm test -- tests/integration/standalone-copy.test.ts
npm run typecheck
~~~

- [ ] **Step 6: Commit**

~~~bash
git add -- tests/types/storage-domain-rc6-surface.ts tsconfig.surface.storage.json research/2026-09-02-storage-domain-rc6-atomicity.md tests/contract/storage-domain-rc6-atomicity-contract.test.ts packages/workbench/src/ports/storage-domain-driver.ts packages/workbench/src/adapters/storage/record-types.ts packages/workbench/src/adapters/storage/record-codec.ts packages/workbench/src/adapters/storage/persisted-limits.ts packages/workbench/src/adapters/node-id-port.ts packages/workbench/src/adapters/system-clock-port.ts packages/workbench/src/integration/harness-rc6/product/storage-domain-driver.ts packages/workbench/src/integration/harness-rc6/product/domain-spec.ts tests/adapters/storage-record-codec.test.ts tests/adapters/storage-domain-driver-contract.test.ts tests/adapters/node-id-port.test.ts tests/adapters/system-clock-port.test.ts tests/support/memory-storage-domain-driver.ts tests/integration/standalone-copy.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: define versioned Harness storage records"
~~~

### Task 2: Implement the production journaled project repository

**Files:**

- Create: packages/workbench/src/adapters/storage/quota-meter.ts
- Create: packages/workbench/src/adapters/storage/journal.ts
- Create: packages/workbench/src/adapters/storage/recovery.ts
- Create: packages/workbench/src/adapters/storage/keyed-mutation-queue.ts
- Create: packages/workbench/src/adapters/harness-project-repository.ts
- Create: tests/adapters/harness-project-repository.test.ts
- Create: tests/adapters/catalog-concurrency.test.ts
- Create: tests/adapters/storage-recovery.test.ts
- Create: tests/adapters/storage-corruption.test.ts
- Create: tests/contract/repository-lock-order.test.ts

**Interfaces:**

- Consumes: `ProjectRepositoryPort`, `StorageDomainDriver`, production codecs/limits, HashPort, IdPort, and ClockPort.
- Produces: `HarnessProjectRepository.open()`, project-scoped serial mutation, one catalog coordinator, versioned commit, deterministic recovery, draining, and close.

- [ ] **Step 1: Write RED atomicity and lock tests**

Assert:

~~~text
reads observe only the root-referenced catalog and generations
an existing-project mutation acquires project then catalog
project.create acquires catalog without a nonexistent project lock
no code path acquires project while holding catalog
two projects may compute concurrently but their visible catalog commits are globally ordered
two old-version commands for one project produce exactly one accepted mutation
parallel commits to different projects increment catalogVersion twice without losing either summary
accepted mutation makes snapshot, receipt, summary, aggregateVersion, and catalogVersion visible together
receipt replay does not write or increment either version
~~~

The lock-order contract scans the production repository call graph or uses instrumented queues to fail on catalog → project acquisition.

- [ ] **Step 2: Write RED recovery tests**

For the single fixed prepared intent:

~~~text
root still equals old root → discard new staging, preserve old committed state
root equals journal new root and committedTransactionId → keep complete new state, finish cleanup
root matches neither old nor new identity → fail closed as storage corruption
root absent + no intent → enter the explicit initialization path
root absent + valid initialization intent + complete listed staging → finish the exact target root, then cleanup
root absent + valid initialization intent + incomplete listed staging → clean only listed bytes, verify no owned remainder, then retry initialization
root absent + malformed/mismatched intent or unverifiable listed record → fail closed; no reset or new key
recovery interrupted during cleanup → next open reaches the same complete state
cleanup repeatedly fails → committed reads remain available but repository stays recovery-required/read-only
while recovery-required, every new mutation is rejected before queue/staging/receipt/version write
unsupported root schema → read-only unsupported-schema; no write or reset
malformed catalog/project/receipt/hash/ref → fail closed; no silent repair or deletion
~~~

- [ ] **Step 3: Run RED**

~~~bash
npm test -- tests/adapters/harness-project-repository.test.ts tests/adapters/catalog-concurrency.test.ts tests/adapters/storage-recovery.test.ts tests/adapters/storage-corruption.test.ts tests/contract/repository-lock-order.test.ts
~~~

- [ ] **Step 4: Implement the only allowed commit sequence**

Inside project → catalog ordering:

~~~text
load and validate active root/catalog/project/receipts
→ receipt lookup before CAS
→ compute next domain state without writes
→ construct every read view and perform read-after-write closure
→ allocate all transaction/generation IDs in memory and construct the fixed pending intent listing every future/superseded ref and hash
→ calculate project, ledger, profile, pending-intent, staging, superseded, and temporary persisted bytes
→ final AbortSignal check
→ require journals/pending-v1 absent
→ write and reread journals/pending-v1 prepared intent
→ write new project generation
→ write new receipt generation
→ write new catalog generation
→ reread and validate all staged records
→ replace the single global root with new catalog/transaction identity
→ synchronously remove superseded records and the pending intent
→ verify cleanup and recount every root-reachable plus pending-intent-listed physical record
→ only now return committed result
~~~

All quota checks, schema validation, domain rules, and read-after-write construction finish before the **intent write**, which is the first physical write. No project/receipt/catalog staging is legal before the fixed intent has been durably reread. `replaceRoot()` maps to the exact version-locked public atomic single-key primitive accepted in Task 1 and is the only visible commit marker; ordinary table writes are never described as atomic. If root replacement throws before or after writing, or its result is otherwise uncertain, enter `recovery-required`, return a transport outer `internal` with `commit-result-unknown`, and let open-time recovery compare the old/target identities before exact-command reconciliation.

Profile and temporary quota count every plugin-owned physical record: active and inactive generations, intent-listed staging/orphan records, the fixed prepared intent, superseded records awaiting cleanup, catalog, cursor key, and receipts. Inventory is the union of root/catalog-reachable records and every ref named by the fixed pending intent; the implementation never depends on table enumeration. A root-switch success followed by any synchronous cleanup/recount failure preserves the complete committed view, enters `recovery-required` **before responding**, and returns outer `internal`/`commit-result-unknown`; it must not have returned an accepted result first. All later mutations fail before queue/intent/staging writes until `open()` completes and verifies cleanup. Repeated cleanup failure stays read-only and cannot accumulate more records or bypass quota. An exact replay after successful recovery reads the committed receipt and returns the already committed result without another version increment.

- [ ] **Step 5: Implement lifecycle discipline**

`drain()` rejects new mutations, lets queued/in-flight operations reach a safe pre-intent refusal or a fully resolved root-plus-synchronous-cleanup outcome, and resolves when the queues are empty. `close()` calls drain, then awaits driver.close, and is idempotent. Reads after draining begins return a fixed safe failure; no background cleanup, timer, detached promise, or late write is permitted after a response or after close.

- [ ] **Step 6: Run GREEN**

~~~bash
npm test -- tests/adapters/harness-project-repository.test.ts tests/adapters/catalog-concurrency.test.ts tests/adapters/storage-recovery.test.ts tests/adapters/storage-corruption.test.ts tests/contract/repository-lock-order.test.ts
npm run typecheck
~~~

- [ ] **Step 7: Commit**

~~~bash
git add -- packages/workbench/src/adapters/storage/quota-meter.ts packages/workbench/src/adapters/storage/journal.ts packages/workbench/src/adapters/storage/recovery.ts packages/workbench/src/adapters/storage/keyed-mutation-queue.ts packages/workbench/src/adapters/harness-project-repository.ts tests/adapters/harness-project-repository.test.ts tests/adapters/catalog-concurrency.test.ts tests/adapters/storage-recovery.test.ts tests/adapters/storage-corruption.test.ts tests/contract/repository-lock-order.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: add the journaled Harness repository"
~~~

### Task 3: Prove quotas and crash boundaries through one production repository-core entry

**Files:**

- Create: packages/workbench/src/internal/repository-core.ts
- Create: scripts/build-repository-core-test.mjs
- Create: tests/support/faulting-storage-domain-driver.ts
- Create: tests/support/storage-fault-schedule.ts
- Create: tests/adapters/harness-repository-quota.test.ts
- Create: tests/adapters/harness-repository-fault-matrix.test.ts
- Create: tests/adapters/harness-repository-abort.test.ts
- Create: tests/adapters/harness-repository-read-after-write.test.ts
- Create: tests/security/repository-canary-redaction.test.ts
- Create: tests/integration/built-repository-core.test.ts
- Modify: package.json

**Interfaces:**

- Consumes: the production repository/codec/quota/journal/recovery source through `packages/workbench/src/internal/repository-core.ts`.
- Produces: a unique test-only compiled repository-core artifact, deterministic driver-level faults, constructor-only limit injection, and a complete physical persisted-limit matrix. Task 5 makes the Product Host import this same source entry; Task 6 alone proves final Host/tgz chunk identity.

- [ ] **Step 1: Write RED physical quota boundary tests**

Exercise limit−1, limit, and limit+1 for:

~~~text
2,048 receipts and 8,388,608 receipt-ledger bytes per project
67,108,864 project persisted bytes
536,870,912 total plugin-owned physical profile bytes
75,497,472 transaction temporary bytes
100 projects
~~~

Data includes ASCII, Chinese, multibyte characters, quotes, backslashes, tabs/newlines, and JSON escaping. Profile accounting deterministically walks root/catalog-reachable generations plus every ref in the single fixed pending intent, covering active/inactive generations, intent-listed staging/orphan records, the intent itself, superseded records awaiting cleanup, catalog, cursor key, and receipts without assuming table enumeration. Each capacity refusal occurs before the intent write and leaves receipt count, snapshot, versions, root, pending intent, and complete physical record inventory byte-for-byte unchanged. Existing receipts remain readable after ledger saturation.

- [ ] **Step 2: Write the RED fault and recovery matrix**

Inject exactly once at each boundary:

~~~text
before/during/after fixed pending-intent write and reread
after intent success then process disappearance before any staging
before/during/after project, receipt, and catalog staging, including each write-then-throw case
after all staging succeeds then process disappearance before root replacement
before root replacement
root replacement throws before write
root replacement writes then throws
root replacement succeeds but response is lost
before/during/after initialization intent, catalog staging, root replacement, and cleanup
initialization write-then-throw at intent/catalog/root
initialization capacity refusal and concurrent double-open/single-writer
superseded-record or journal cleanup fails
cleanup fails repeatedly, then a subsequent mutation attempts to enter
Domain capacity refusal
record remove/write/read throws
first recovery crashes
recovery cleanup crashes again
~~~

After reopen, assert only complete old or complete new state. Every post-intent crash must be discoverable from `journals/pending-v1`; every intent-listed partial record is counted and either retained as committed or cleaned. In the no-root matrix, assert one durable cursor key, one empty catalog/root, deterministic recovery, and no silent reset. Root-switch-plus-cleanup failure exposes the complete committed state read-only, keeps `recovery-required`, returns no accepted response, and makes every later mutation perform zero writes until cleanup succeeds and all physical bytes are recounted. Assert the response is emitted only after cleanup succeeds or the recovery-required state is set. Reject mixed generations, duplicate receipts, double version increase, uncounted orphan bytes, undiscoverable random keys, business rejection for infrastructure failure, background/after-close writes, or leaked canary cause.

- [ ] **Step 3: Write RED abort, read-after-write, and build-order tests**

Abort before enqueue, while waiting for project/catalog, immediately before intent, and after the intent/commit sequence begins. The pre-intent cases write nothing; once the intent is written, the transaction finishes or recovers completely and remains result-unknown until exact-command reconciliation. Every accepted source/entity/PRD must be completely reconstructable before the intent write.

`built-repository-core.test.ts` leaves any repository `lib` directory untouched and never reads it, asks the dedicated builder for a new exclusive temp output, then imports only that returned artifact. It fails if the test can pass from stale output, an earlier `npm run build`, a Probe Host entry, or a mocked repository.

- [ ] **Step 4: Run RED**

~~~bash
npm test -- tests/adapters/harness-repository-quota.test.ts tests/adapters/harness-repository-fault-matrix.test.ts tests/adapters/harness-repository-abort.test.ts tests/adapters/harness-repository-read-after-write.test.ts tests/security/repository-canary-redaction.test.ts tests/integration/built-repository-core.test.ts
~~~

- [ ] **Step 5: Compile the production source entry independently of the future Product Host**

`repository-core.ts` exports only production repository constructors/codecs and an explicit constructor parameter for immutable `PersistedLimits`. It contains no fault schedule, mock Domain, environment switch, reduced constant, or test factory. `build-repository-core-test.mjs` invokes local esbuild through its API with a fixed entry, fixed options, path-sanitized metafile, and unique marker-owned output below `.tmp/dsh-pm-workbench/repository-core-tests/<runId>/`. It walks every transitive input/external/output and rejects Probe/UI/test/support/fault modules from the compiled graph.

The tests inject `faulting-storage-domain-driver.ts` and reduced limits below the compiled production constructor, never into its bundle. At this stage there is deliberately no assertion about `lib/index.js`: the Product Host does not exist until Task 5. Task 6 later builds Host plus this internal entry with splitting and proves both import the same repository chunks, then binds those bytes to the real tgz.

- [ ] **Step 6: Run GREEN from a fresh unique artifact**

~~~bash
npm run build:repository-core-test
npm test -- tests/adapters/harness-repository-quota.test.ts tests/adapters/harness-repository-fault-matrix.test.ts tests/adapters/harness-repository-abort.test.ts tests/adapters/harness-repository-read-after-write.test.ts tests/security/repository-canary-redaction.test.ts tests/integration/built-repository-core.test.ts
npm run typecheck
~~~

Expected: the builder prints one new relative run path, tests load that path, every mutation and initialization fault converges to one complete state, every post-intent staging orphan is discoverable/countable, repeated cleanup failure blocks subsequent writes, response ordering forbids accepted-before-cleanup, and no pre-existing Product `lib` or package is required. Missing named test files fail; no command silently filters them out.

- [ ] **Step 7: Commit**

~~~bash
git add -- packages/workbench/src/internal/repository-core.ts scripts/build-repository-core-test.mjs tests/support/faulting-storage-domain-driver.ts tests/support/storage-fault-schedule.ts tests/adapters/harness-repository-quota.test.ts tests/adapters/harness-repository-fault-matrix.test.ts tests/adapters/harness-repository-abort.test.ts tests/adapters/harness-repository-read-after-write.test.ts tests/security/repository-canary-redaction.test.ts tests/integration/built-repository-core.test.ts package.json
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "test: prove repository quota and crash recovery"
~~~

### Task 4: Add the Product-only Host and Client Connection adapters

**Files:**

- Create: packages/workbench/src/integration/harness-rc6/product/rpc-dispatcher.ts
- Create: packages/workbench/src/integration/harness-rc6/product/host-admission.ts
- Create: packages/workbench/src/client/product/connection-rpc-transport.ts
- Create: packages/workbench/src/client/product/workbench-api.ts
- Create: tests/contract/product-rpc-dispatcher.test.ts
- Create: tests/contract/product-client-transport.test.ts
- Create: tests/contract/product-host-admission.test.ts
- Create: tests/contract/product-connection-error-mapping.test.ts
- Create: tests/security/product-rpc-canary-redaction.test.ts
- Create: tests/contract/product-no-probe-runtime.test.ts

**Interfaces:**

- Consumes: `productRegistry`, `WorkbenchService`, public `ctx.connection.rpc.handle/call`, and AbortSignal.
- Produces: `createProductRpcHandler()`, `ConnectionRpcProductTransport`, and the nine-method `WorkbenchApi` facade.

- [ ] **Step 1: Write RED closed-registry and boundary tests**

Assert the runtime owns exactly `/dsh-pm-workbench-v1` and exactly nine Product endpoints. Unknown endpoint, `counter.increment`, probe health input/output, prototype keys, extra fields, malformed canonical JSON values, wrong API/wire/data version, oversized plugin request/outcome, and shape-valid but wrong-correlated output all fail closed. No Product type imports a Probe symbol.

- [ ] **Step 2: Write RED outer/inner error tests**

Cover every observed rc.6 outer result and every Product business rejection. Host-created outer codes remain limited to `bad-request`, `cancelled`, and `internal`; business codes remain inside `WorkbenchOutcome`. Any unknown outer code, malformed Host output, wrong project/kind/revision/hash/offset/ref owner, or missing context maps to `protocol-invalid` or the fixed safe transport union. Raw cause, response body, stack, field value, quote, path, token, and payload never cross the adapter.

- [ ] **Step 3: Write RED admission and abort tests**

Eight Client requests may be in flight; a ninth waits and can abort without a call. Sixteen Host handlers may be in flight; the seventeenth fails before `WorkbenchService` with constant outer internal and zero side effect. Pass the same signal through Host, service, and repository. Verify abort at all four H1 timings and exact-command reconciliation after an uncertain commit.

- [ ] **Step 4: Run RED**

~~~bash
npm test -- tests/contract/product-rpc-dispatcher.test.ts tests/contract/product-client-transport.test.ts tests/contract/product-host-admission.test.ts tests/contract/product-connection-error-mapping.test.ts tests/security/product-rpc-canary-redaction.test.ts tests/contract/product-no-probe-runtime.test.ts
~~~

- [ ] **Step 5: Implement Host ordering and catch-all**

~~~text
global Host admission
→ exact endpoint ownership
→ canonical endpoint+payload byte budget
→ strict input schema
→ WorkbenchService with signal
→ domain invariant check
→ contextual output validation
→ WorkbenchOutcome byte budget
→ controlled outer RpcResult
~~~

Catch every thrown value before the Connection handler resolves. The only diagnostic is an opaque incident ID emitted with a fixed safe event name and stable code; no payload or cause text enters logs.

- [ ] **Step 6: Implement Client ordering and semantic facade**

~~~text
Client eight-request queue
→ strict input and request budget
→ public Connection call
→ outer result parse
→ WorkbenchOutcome parse
→ endpoint-specific output/context validation
→ monotonic WorkbenchApi controller result
~~~

The facade method-to-endpoint mapping is one-to-one and adds no hidden request. `ConnectionRpcProductTransport` cannot name a Probe endpoint at compile time.

- [ ] **Step 7: Run GREEN**

~~~bash
npm test -- tests/contract/product-rpc-dispatcher.test.ts tests/contract/product-client-transport.test.ts tests/contract/product-host-admission.test.ts tests/contract/product-connection-error-mapping.test.ts tests/security/product-rpc-canary-redaction.test.ts tests/contract/product-no-probe-runtime.test.ts
npm run typecheck
~~~

- [ ] **Step 8: Commit**

~~~bash
git add -- packages/workbench/src/integration/harness-rc6/product/rpc-dispatcher.ts packages/workbench/src/integration/harness-rc6/product/host-admission.ts packages/workbench/src/client/product/connection-rpc-transport.ts packages/workbench/src/client/product/workbench-api.ts tests/contract/product-rpc-dispatcher.test.ts tests/contract/product-client-transport.test.ts tests/contract/product-host-admission.test.ts tests/contract/product-connection-error-mapping.test.ts tests/security/product-rpc-canary-redaction.test.ts tests/contract/product-no-probe-runtime.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: connect the Product-only RPC transport"
~~~

### Task 5: Assemble additive Harness slots and one lifecycle coordinator

**Files:**

- Create: packages/workbench/src/client/product/WorkbenchLauncher.tsx
- Create: packages/workbench/src/client/product/WorkbenchOverlay.tsx
- Create: packages/workbench/src/client/product/register-workbench-ui.tsx
- Create: packages/workbench/src/integration/harness-rc6/product/lifecycle.ts
- Create: packages/workbench/src/integration/harness-rc6/product/accepted-fixture-policy.ts
- Modify: packages/workbench/src/index.ts
- Modify: packages/workbench/src/client/index.tsx
- Modify: packages/workbench/src/config.ts
- Modify: packages/workbench/build.mjs
- Create: tests/integration/product-slot-registration.test.tsx
- Create: tests/integration/product-lifecycle.test.ts
- Create: tests/contract/product-view-reuse.test.ts
- Create: tests/security/product-browser-storage.test.tsx
- Create: tests/integration/product-fixture-policy.test.ts
- Create: tests/contract/product-build-entry.test.ts

**Interfaces:**

- Consumes: production `WorkbenchView`, `ConnectionRpcProductTransport`, public `sidebar.footer.action`, public `shell.overlay`, Connection, and storageDomain.
- Produces: final Product Host `apply()`, Product Client `apply()`, one launcher, one overlay, and one ordered async disposer.

- [ ] **Step 1: Write RED slot and reuse tests**

Assert exactly one `sidebar.footer.action` registration with ID `pm-workbench-launcher` and one `shell.overlay` registration with ID `pm-workbench-overlay`. Reject root, conversation, sidebar replacement, private DOM selector, private portal, Harness-internal React root, or requirement for a current Session. The overlay must render the exact P1 `WorkbenchView` module and inject only Product `WorkbenchApi` plus shell props. The Product Host imports Task 3's `repository-core.ts`; an alternate repository factory is rejected.

- [ ] **Step 2: Write RED lifecycle tests**

Mount, disable/enable, unload/reload, and remount three times. Record this exact disposal order:

~~~text
set draining and reject new business commands
→ await Connection channel disposer
→ abort lifecycle signal
→ await handlers to reach a safe pre-commit refusal or complete commit
→ await repository drain
→ await Domain.close
→ release slots and remaining resources
~~~

Assert one live handler/launcher/overlay/listener at each active point, zero after unload, no write after Domain close, and idempotent repeated dispose. Do not rely on unspecified cleanup order among separate Cordis effects.

- [ ] **Step 3: Write RED fixture-policy, browser-storage, and Product-entry tests**

Spy on localStorage, sessionStorage, IndexedDB, Cache Storage, service workers, and cookies. Formal project, source, quote, evidence, decision, baseline, PRD, cursor key, receipt, and payload data must never be written there. Only non-sensitive presentation preferences named in an explicit allowlist may use localStorage; unsaved form text remains memory-only and the close/remount copy states that it is discarded.

Drive `source.importText` through the assembled Product handler with accepted R1 and R2; raw UTF-8 variants using BOM/no-BOM, CRLF/CR/LF, and NFC/NFD that normalize to the same R1/R2 hashes; arbitrary valid TXT/MD; a one-byte/character mutation that changes the normalized identity; and a bypassed Client precheck. The equivalent variants resolve to one of the same two accepted identities and create no third policy entry. Only those normalized hashes may reach repository code. Every normalized-identity mismatch returns fixed `invalid-input` before queue/intent/repository code and leaves project/source/receipt/aggregate/catalog/physical record state unchanged.

`product-build-entry.test.ts` requires exactly one target argument, proves `product` resolves Host `src/index.ts`, Client `src/client/index.tsx`, and internal `src/internal/repository-core.ts`, and rejects missing/duplicate/unknown targets. It also proves no test depends on an earlier `lib` directory.

- [ ] **Step 4: Run RED**

~~~bash
npm test -- tests/integration/product-slot-registration.test.tsx tests/integration/product-lifecycle.test.ts tests/contract/product-view-reuse.test.ts tests/security/product-browser-storage.test.tsx tests/integration/product-fixture-policy.test.ts tests/contract/product-build-entry.test.ts
~~~

- [ ] **Step 5: Implement the final composition**

The Host opens the Product Domain, recovers the production repository through Task 3's sole `repository-core.ts`, injects the accepted H0 `NodeSha256` plus Task 1 `NodeIdPort`/`SystemClockPort`, P0 `HmacCursorCodec`, and an immutable `AcceptedSyntheticInputPolicy`, builds `WorkbenchService`, registers the Product handler with `{ authority: 'loopback' }`, and returns the single lifecycle disposer. `accepted-fixture-policy.ts` contains only the two normalized hashes plus fixture manifest/set identity injected by the build after strict loading; it contains no fixture bytes, path, runtime selector, or update mechanism. The Client obtains Connection through public context injection, constructs Product transport/API, and registers only the additive launcher and overlay. The Product configuration has no runtime phase switch, trust-mode switch, profile path, endpoint list, quota override, purge, fixture-policy override, or debug field.

Extend `buildWorkbench({ target })` to accept exactly `probe | product`, with no default and no environment-driven target. The Product entry map is fixed to the three entries tested above. Every caller passes one target; duplicate target flags fail. Product build strict-loads fixture/golden manifests only to inject accepted hashes/identities and never bundles their text or filesystem paths. It writes all outputs and a sanitized metafile into a new explicit output root supplied by the caller.

- [ ] **Step 6: Run GREEN**

~~~bash
npm test -- tests/integration/product-slot-registration.test.tsx tests/integration/product-lifecycle.test.ts tests/contract/product-view-reuse.test.ts tests/security/product-browser-storage.test.tsx tests/integration/product-fixture-policy.test.ts tests/contract/product-build-entry.test.ts
npm run typecheck
npm run build -- --target product
~~~

- [ ] **Step 7: Commit**

~~~bash
git add -- packages/workbench/src/client/product/WorkbenchLauncher.tsx packages/workbench/src/client/product/WorkbenchOverlay.tsx packages/workbench/src/client/product/register-workbench-ui.tsx packages/workbench/src/integration/harness-rc6/product/lifecycle.ts packages/workbench/src/integration/harness-rc6/product/accepted-fixture-policy.ts packages/workbench/src/index.ts packages/workbench/src/client/index.tsx packages/workbench/src/config.ts packages/workbench/build.mjs tests/integration/product-slot-registration.test.tsx tests/integration/product-lifecycle.test.ts tests/contract/product-view-reuse.test.ts tests/security/product-browser-storage.test.tsx tests/integration/product-fixture-policy.test.ts tests/contract/product-build-entry.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "feat: assemble the additive Product workbench"
~~~

### Task 6: Close the Product build and audit the real tarball

**Files:**

- Modify: packages/workbench/build.mjs
- Modify: packages/workbench/package.json
- Modify: package.json
- Modify: scripts/verify-package.mjs
- Modify: scripts/pack-dry.mjs
- Modify: scripts/build-repository-core-test.mjs
- Create: scripts/package-product.mjs
- Modify: scripts/gates/shared/tarball-audit.mjs
- Create: tests/contract/product-build-closure.test.ts
- Create: tests/contract/product-package-allowlist.test.ts
- Create: tests/contract/product-package-byte-scan.test.ts
- Create: tests/contract/product-license-closure.test.ts
- Create: tests/contract/product-status-claims.test.ts
- Create: tests/integration/product-tarball.test.ts
- Modify: tests/integration/standalone-copy.test.ts
- Create: tests/fixtures/product-build-boundary/probe-import.ts
- Create: tests/fixtures/product-build-boundary/test-seam-import.ts
- Create: tests/fixtures/product-build-boundary/client-node-import.tsx
- Create: tests/fixtures/product-build-boundary/host-react-import.ts
- Create: tests/fixtures/product-build-boundary/host-node-fs-import.ts
- Create: tests/fixtures/product-build-boundary/host-network-import.ts
- Create: tests/fixtures/product-build-boundary/client-dynamic-code-import.tsx
- Modify: README.md
- Modify: SECURITY.md
- Modify: docs/compatibility.md
- Modify: packages/workbench/README.md
- Modify: packages/workbench/docs/compatibility.md
- Modify: packages/workbench/docs/privacy.md
- Modify: docs/ci.md
- Modify: .github/workflows/static-verification.yml
- Generated outside Git: .tmp/dsh-pm-workbench/product-packages/<sourceCommit>/<tgzSha256>/*.tgz
- Generated outside Git: .tmp/dsh-pm-workbench/product-packages/<sourceCommit>/<tgzSha256>/package-manifest.json

**Interfaces:**

- Produces: explicit `product` build, sanitized esbuild metafiles, an actual npm tgz, file/hash manifest, repository-core identity manifest, license closure, and fail-closed tarball audit.
- Consumes: a clean committed H1 source, exact lock, and—only for a real tgz build—one canonical Product package-freeze decision ID bound to that source/lock/target/argv/output boundary.

- [ ] **Step 1: Write RED graph-closure tests**

The Product build must fail if the Host/Client graph or emitted bytes contain any of:

~~~text
counter.increment
ProbeEndpointTypes
ProbeHealthOutput
ProbeWorkbenchApi
gate-a-probe
pm-workbench-probe
lib/internal/probe-gate-test-harness.js
integration/harness-rc6/probe
client/probe
probe-gate-test-harness
tests/support
tests/e2e
faulting-storage-domain-driver
storage-fault-schedule
testQuotaOverrides
reduced quota
mock Harness
debug endpoint
fixture runner
gate-a
gate-b
synthetic fixture body, fixture loader, or unreviewed input policy
fault injection
~~~

The scanner checks the complete transitive source-input graph, emitted import graph, output names, and emitted bytes for both literal and encoded variants. It proves the negative by compiling one mutation fixture for each forbidden category and observing a failure. The Product Host transitive graph explicitly rejects `node:fs`, `node:fs/promises`, `child_process`, `dns`, `net`, `tls`, `http`, `https`, `dgram`, `fetch`, `WebSocket`, `EventSource`, and equivalent bare/encoded/dynamic imports; it also rejects model/provider modules. The Client transitive graph rejects every Node built-in, storageDomain, repository, journal, cursor key, raw filesystem, network API, `eval`, `Function`, string timers, dynamic code loader, and model/provider module. The Host graph must not bundle React/React DOM. Each Host filesystem/network and Client network/dynamic-code category has a compiling mutation fixture that the closure audit must reject. The only registered endpoint list is the nine-key Product registry. The production `repository-core` entry and hash-only accepted-fixture policy are allowed; fixture text/path and every Probe/test/fault/reduced-limit runner or seam are forbidden from Product output and tgz.

- [ ] **Step 2: Write RED tarball allowlist and secret scans**

Before package-freeze authorization, exercise the tar audit only with repository-owned synthetic archive fixtures and `npm pack --dry-run`; do not invoke real `npm pack` or generate a Product tgz. The audit inspects extracted bytes, names, modes, package scripts, manifests, and licenses. Reject undeclared lifecycle scripts, every non-regular tar entry (symlink, hardlink, FIFO, socket, block/character device, sparse/device-like entry), source maps, caches, `.npmrc`, credentials, token/cookie patterns, local absolute paths, runtime DB/profile/log/browser data, real interviews, non-allowlisted fixtures, model/ASR/provider/network adapters, test files, or unlisted package content. A link that happens to remain inside the package is still forbidden.

The allowlist is exact:

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
package/lib/internal/repository-core.js
package/lib/chunks/**
package/lib/build-manifest.json
~~~

The extracted archive must contain that exact finite set plus only chunk filenames enumerated and hashed by `build-manifest.json`; arbitrary documentation, fixture, test, Probe, Gate, support, source-map, and test-harness paths are not wildcard-accepted.
The packed `package.json` exports exactly `.`, `./client`, and `./package.json`; `lib/internal/repository-core.js` and chunks remain unexported implementation files, and no Probe/test/fault subpath or lifecycle script is exposed. Package-local README/compatibility/privacy files explicitly identify themselves as immutable **build-time status** for that tgz and direct readers to the repository's canonical `docs/probe-results.md` ledger by bound tgz SHA for later observations. Root status docs point to that ledger rather than duplicating a mutable Gate state. They describe only an implemented, statically checked Product candidate whose Gate B has not yet been observed at build time; they do not retain the old “no-op skeleton” statement or claim installability, compatibility, AI analysis, real-data safety, or Gate B PASS. `product-status-claims.test.ts` locks those statements.

- [ ] **Step 3: Run RED**

~~~bash
npm test -- tests/contract/product-build-closure.test.ts tests/contract/product-package-allowlist.test.ts tests/contract/product-package-byte-scan.test.ts tests/contract/product-license-closure.test.ts tests/contract/product-status-claims.test.ts tests/integration/product-tarball.test.ts
~~~

- [ ] **Step 4: Make product targeting mandatory**

`buildWorkbench({ target })` accepts only one `probe` or `product` value; H1 packaging passes `product` exactly once and never consults an environment variable or runtime config. Product entries are `src/index.ts`, `src/client/index.tsx`, and `src/internal/repository-core.ts`; Probe entries are absent from the Product metafile. `scripts/build-repository-core-test.mjs` and Product packaging reuse one exported internal-entry build function/options. All metafile paths are repository-relative POSIX paths before serialization.

This task takes ownership of `standalone-copy.test.ts`: its H1 child must copy `tsconfig.surface.host.json`, `tsconfig.surface.client.json`, `tsconfig.surface.storage.json`, and every Product/Gate compile config; run Product build, Product verify, and Product dry-pack **exactly once each**; and self-create unique outputs. Missing/duplicate targets, any final Probe target, missing required config, or use of a parent/source worktree executable must fail. The temporary Task 0 Probe union check is not the final H1 closure.

In the package pipeline's mandatory frozen-source mode, every esbuild metafile input is opened as a regular file with no-follow/same-read checks and its bytes and executable mode are compared with `git cat-file` for the recorded clean HEAD. It rejects an input marked `skip-worktree` or `assume-unchanged`, any ignored/untracked source input, dirty staged/unstaged bytes, and any input outside the frozen source tree. Tests build synthetic committed/dirty cases and mutate each condition to prove failure. Ordinary uncommitted development builds may run for RED/GREEN feedback but produce no reusable package/evidence manifest and cannot satisfy package freeze. This binds the actual tgz graph to reviewed Git bytes instead of trusting path names.

- [ ] **Step 5: Package from a clean commit**

`scripts/package-product.mjs` requires `--package-freeze-decision-id <canonical-id>` for real packaging, a clean tracked/untracked tree, and a decision bound to the exact source commit, lock, Product target, fixed npm-pack argv, and content-addressed output boundary. It strict-loads both fixture revisions plus fixture/golden accepted set receipts, recomputes lock/source hashes, runs Product build, invokes the recorded npm CLI with fixed arguments, `--ignore-scripts`, the inherited empty user/global npm configuration, sanitized environment, and `shell: false`, computes the tgz SHA-256, then writes once beneath marker-owned `.tmp/dsh-pm-workbench/product-packages/<sourceCommit>/<tgzSha256>`. It writes that decision ID into `package-manifest.json`, extracts to a new sibling directory, computes each file hash, and runs the audit. If that exact content-addressed output already exists, it may only revalidate every marker/manifest/file/decision binding byte-for-byte and reuse it read-only; it rejects any partial/conflicting reuse, symlink, mismatched ownership marker, path identity that differs from the manifest, absent/malformed decision, or decision from another source/target. `npm pack --dry-run` remains a preview and cannot satisfy Gate B.

The build manifest proves that the compiled repository core loaded by Task 3 is byte-identical to the packed file and that Product Host imports its shared chunks. Any rebuild that changes the tgz or repository-core hash invalidates later evidence.

- [ ] **Step 6: Run GREEN**

~~~bash
npm run check
npm run build -- --target product
npm run verify:package -- --target product
npm run pack:dry -- --target product
npm test -- tests/contract/product-build-closure.test.ts tests/contract/product-package-allowlist.test.ts tests/contract/product-package-byte-scan.test.ts tests/contract/product-license-closure.test.ts tests/contract/product-status-claims.test.ts tests/integration/product-tarball.test.ts
npm test -- tests/integration/standalone-copy.test.ts
~~~

At this still-uncommitted point, every integration test creates its own unique controlled build/archive and the tarball test asserts that `package:product` refuses a dirty tree; it does not weaken the clean-commit precondition or rely on `lib` from the previous command. The static workflow runs Product typecheck/build/verify/dry-pack with exactly one target and all closed tests; it never keeps H0's Probe target as the final H1 package check.

- [ ] **Step 7: Commit source, not artifacts**

~~~bash
git add -- packages/workbench/build.mjs packages/workbench/package.json package.json scripts/verify-package.mjs scripts/pack-dry.mjs scripts/build-repository-core-test.mjs scripts/package-product.mjs scripts/gates/shared/tarball-audit.mjs tests/contract/product-build-closure.test.ts tests/contract/product-package-allowlist.test.ts tests/contract/product-package-byte-scan.test.ts tests/contract/product-license-closure.test.ts tests/contract/product-status-claims.test.ts tests/integration/product-tarball.test.ts tests/integration/standalone-copy.test.ts tests/fixtures/product-build-boundary/probe-import.ts tests/fixtures/product-build-boundary/test-seam-import.ts tests/fixtures/product-build-boundary/client-node-import.tsx tests/fixtures/product-build-boundary/host-react-import.ts tests/fixtures/product-build-boundary/host-node-fs-import.ts tests/fixtures/product-build-boundary/host-network-import.ts tests/fixtures/product-build-boundary/client-dynamic-code-import.tsx README.md SECURITY.md docs/compatibility.md packages/workbench/README.md packages/workbench/docs/compatibility.md packages/workbench/docs/privacy.md docs/ci.md .github/workflows/static-verification.yml
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "build: close and audit the Product package"
~~~

- [ ] **Step 8: Stop and obtain H1 Product package-freeze authorization**

The authorization is limited to this clean commit and exact Product target: run the recorded npm executable with fixed `npm pack` arguments and `--ignore-scripts`, write only the marker-owned content-addressed `.tmp` package root, and perform local extraction/audit. Record its canonical ID as `DSH_PMWB_H1_PACKAGE_FREEZE_DECISION_ID`; it cannot equal or substitute for a bootstrap, runtime, install, kill, review, or evidence decision. It does not authorize dependency installation, network access, Harness/profile/browser use, publication, or npm upload. Without this authorization, leave the real tgz `NOT_BUILT` and stop after the dry-pack checks.

- [ ] **Step 9: Audit the real tgz from the new clean commit once authorized**

~~~bash
git status --porcelain=v1 --untracked-files=all
npm run package:product -- --package-freeze-decision-id "$DSH_PMWB_H1_PACKAGE_FREEZE_DECISION_ID"
npm test -- tests/integration/product-tarball.test.ts
git status --porcelain=v1 --untracked-files=all
~~~

Both status commands must print nothing because generated artifacts are ignored. The integration test resolves the manifest emitted for the current HEAD, recomputes the tgz/file/repository-core hashes, extracts it again, and applies the exact allowlist and byte scans. If it fails, retain the failed artifact, fix the defect in a new reviewed commit, and repeat with a new content-addressed output; do not amend the audited commit.

Do not add `lib`, tgz files, manifests below `.tmp`, extracted packages, or logs.

### Task 7: Build the fail-closed Gate B runner and evidence schema

**Files:**

- Create: scripts/gates/gate-b.mjs
- Create: scripts/gates/gate-b-checks.mjs
- Create: scripts/gates/gate-b-harness.mjs
- Create: scripts/gates/gate-b-browser.mjs
- Create: scripts/gates/gate-b-faults.mjs
- Create: scripts/gates/gate-b-bootstrap.mjs
- Create: scripts/gates/gate-b-offline-store-seeder.mjs
- Create: scripts/gates/render-gate-b-evidence-candidate.mjs
- Create: scripts/gates/promote-gate-b-evidence.mjs
- Reuse unchanged from accepted F0: scripts/bootstrap/policy-fetch.mjs
- Reuse unchanged from accepted F0: scripts/bootstrap/materialize-browser.mjs
- Reuse unchanged from accepted F0: tests/bootstrap/policy-fetch.node.test.mjs
- Reuse unchanged from accepted F0: tests/bootstrap/browser-materializer.node.test.mjs
- Modify: scripts/gates/shared/deny-external-network.mjs
- Create: tests/integration/gate-b-preconditions.test.ts
- Create: tests/integration/gate-b-command-plan.test.ts
- Create: tests/integration/gate-b-check-list.test.ts
- Create: tests/integration/gate-b-profile-boundary.test.ts
- Create: tests/integration/gate-b-report.test.ts
- Create: tests/integration/gate-b-run-closure.test.ts
- Create: tests/integration/gate-b-network-boundary.test.ts
- Create: tests/integration/gate-b-bootstrap-environment.test.ts
- Create: tests/integration/gate-b-browser-materializer.test.ts
- Create: tests/integration/gate-b-offline-store-seeder.test.ts
- Create: tests/integration/gate-b-authorization-boundary.test.ts
- Create: tests/integration/gate-b-process-ownership.test.ts
- Create: tests/integration/gate-b-pointer-lock.test.ts
- Create: tests/integration/gate-b-promotion-candidate.test.ts
- Create: tests/fixtures/process-group/owned-harness-tree.mjs
- Create: tests/security/gate-b-redaction.test.ts
- Modify: scripts/gates/shared/command.mjs
- Modify: scripts/gates/shared/profile-boundary.mjs
- Modify: scripts/gates/shared/result-schema.mjs
- Modify: scripts/gates/shared/report.mjs
- Modify: scripts/workspace-boundary.ts
- Modify: package.json
- Modify: docs/ci.md
- Generated outside Git after owner review: .tmp/dsh-pm-workbench/gate-inputs/gate-b-browser-download-policy.json
- Generated outside Git after owner review: .tmp/dsh-pm-workbench/gate-inputs/gate-b-offline-store-policy.json
- Generated outside Git during an authorized bootstrap: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/.dsh-pm-workbench-bootstrap-input
- Generated outside Git during an authorized bootstrap: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/browsers/**
- Generated outside Git during an authorized bootstrap: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/npm-cache/**
- Generated outside Git during an authorized bootstrap: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/pnpm-store/**
- Generated outside Git after separate bootstrap authorization: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/manifest.json
- Generated outside Git by every Gate B attempt: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/{result.json,report.md,junit.xml,run.final.json}
- Generated outside Git after a completed Gate B attempt: .tmp/dsh-pm-workbench/gate-b/current-run.json
- Generated outside Git for runner/promotion serialization: .tmp/dsh-pm-workbench/gate-b/current-run.lock
- Generated outside Git after candidate-materialization authorization for exact human review: .tmp/dsh-pm-workbench/gate-b/promotion-candidates/<sourceCommit>/<runId>/<candidateSetSha256>/gate-result.md
- Generated outside Git after candidate-materialization authorization for exact human review: .tmp/dsh-pm-workbench/gate-b/promotion-candidates/<sourceCommit>/<runId>/<candidateSetSha256>/probe-results.md
- Generated outside Git after candidate-materialization authorization for exact human review: .tmp/dsh-pm-workbench/gate-b/promotion-candidates/<sourceCommit>/<runId>/<candidateSetSha256>/candidate-receipt.json
- Generated outside Git by evidence promotion: .tmp/dsh-pm-workbench/gate-b/promotions/<sourceCommit>/<runId>/<promotionReceiptSha256>/promotion-receipt.json

**Interfaces:**

- Produces: decision-bound direct `node scripts/gates/gate-b-bootstrap.mjs --bootstrap-decision-id …`, offline `npm run gate:b -- --runtime-decision-id … --install-decision-id … --kill-decision-id … --port 3187`, a zero-candidate-output preview followed only after a distinct decision by one immutable content-addressed candidate set for exact human review, exact-closure-bound `npm run gate:b:promote -- --run-id … --source-commit … --run-final-sha256 … --report-sha256 … --candidate-set-sha256 … --candidate-materialization-decision-id … --candidate-receipt-sha256 … --human-review-decision-id … --evidence-decision-id … [--check]`, one immutable promotion receipt binding the candidate-materialization decision, reviewed candidate receipt, and two rendered document hashes/Git blob OIDs, a fixed 20-check manifest matching specification §13.2, and one write-once `.tmp/dsh-pm-workbench/gate-b/runs/<runId>` output root per attempt.
- Consumes: the exact accepted H0 evidence commit and its verified one-parent/two-path closure plus two fixed matching Git blobs, the independently verified accepted P1 evidence topology, accepted P0 identity, the content-addressed Gate A′ handoff imported only by `handoffManifestSha256FromAcceptedH0Evidence` under `DSH_PMWB_H1_HANDOFF_IMPORT_DECISION_ID`, a clean committed H1 source, exact lock plus pre-merge hydration/union-lock/final-hydration decision receipts and each conditionally used network receipt, strict-loaded R1/R2 fixture and owner-accepted golden set, the accepted rc.6 CLI artifact closure, exact public package identities, an audited Product tgz with package-freeze decision, one fixed owner-reviewed browser archive policy and one fixed owner-reviewed offline-store policy plus both hashes, the unchanged accepted F0 policy-fetch/materialize implementations, the H1 offline-store seeder, a marker-owned browsers/npm-cache/pnpm-store bootstrap closure with bootstrap decision, the frozen storage atomicity evidence hash, the exact ripple manifest/tgz/owner decision bound by that same H0 evidence, separate runtime/install/kill decisions, and later distinct candidate-materialization/human-review/evidence decisions.

- [ ] **Step 1: Write RED precondition tests**

Runner construction rejects:

~~~text
port 3080 or a non-loopback host
0.0.0.0, LAN, non-empty trustedHosts, trusted-host authority, proxy, or tunnel
DSH_HOME outside .tmp/dsh-pm-workbench/gate-b
DSH_HOME equal to or nested under ~/.dsh
missing/reused/nonexclusive runId root or mismatched ownership marker
HOME/XDG_CONFIG_HOME/XDG_CACHE_HOME/XDG_DATA_HOME/npm cache/pnpm home/pnpm store/PLAYWRIGHT_BROWSERS_PATH/browser user-data outside marker-owned roots
inherited DSH_* or proxy environment reaching a child process
dirty tracked source or prerequisite commit/hash drift
fixture/golden symlink, non-regular file, realpath escape, open-identity change, strict manifest/set-receipt failure, or same-read hash drift
missing actual tgz or tgz audit/hash mismatch
missing/mismatched owner-reviewed browser archive or offline-store policy, exact archive URL/hash/length, exact public package name/version/integrity set, accepted Node/npm/pnpm identity and supported seeding grammar, accepted F0 policy-fetch/materializer source hash, H1 seeder source hash, bootstrap manifest, recorded initial/redirect origin chain, zero-network offline-proof receipt, browser tree, npm-cache tree, pnpm-store tree, or bootstrap hash
missing/mismatched exact accepted H0 evidence commit, its one-parent/two-path evidence closure, fixed report/ledger blob identity, handoffManifestSha256FromAcceptedH0Evidence, export/import copy hash, final/report closure, or source identity
missing/mismatched accepted P1 evidence commit, its sole frozen-source parent, raw-NUL exact-two-regular-file closure, fixed report/ledger blobs, or source/run identity
missing/mismatched union-lock action/network receipt, hydration action/network receipt, handoff-import decision/import manifest, or substitution between those scopes
missing/mismatched imported H0 ripple acceptance-manifest hash, tgz hash, owner decision, or binding to handoffManifestSha256FromAcceptedH0Evidence for B18
missing/mismatched accepted CLI artifact manifest/tree/entry/version/integrity or a CLI realpath outside the imported immutable closure
resolved Harness/Connection/storage export drift or frozen atomicity-evidence/package-identity drift
inherited NPM_CONFIG_USERCONFIG, NPM_CONFIG_GLOBALCONFIG, user/global npmrc, registry, auth/token, proxy, provider, NODE_OPTIONS, PLAYWRIGHT_DOWNLOAD_HOST, PLAYWRIGHT_CHROMIUM_DOWNLOAD_HOST, another inherited PLAYWRIGHT_* key, custom-CA override, or any environment variable name matching token, secret, password, credential, api-key, cookie, provider
an empty/wildcard/non-HTTPS/unreviewed browser origin policy, missing or mismatched exact archive SHA-256/byte length, URL userinfo, HTTP downgrade, redirect loop/ceiling overflow, unlisted redirect, automatic redirect following, any body consumption before origin acceptance, or any default/environment/discovered-host expansion
missing, malformed, equal, cross-scoped, or source/artifact-mismatched package-freeze, bootstrap, runtime, install, or kill decision ID
Harness supervisor without a fresh isolated process group, child PID/PGID equal to the runner group, missing launch sentinel/birth identity, unowned group member, PID-reuse simulation, or any name/port-selected signal target
ordinary/final/failure cleanup without exact runtime-decision and purpose binding, live sentinel plus PID/PGID/birth/member revalidation, exactly one group `SIGTERM`, bounded child/descendant/listener disappearance, or an attempt to escalate a graceful-stop timeout automatically
`SIGTERM` outside ordinary/final/failure cleanup, `SIGSTOP`/`SIGKILL` outside B10 or the recorded group, any signal after identity drift, unbounded stopped-state/disappearance wait, root-replace-returned racing confirmed stop, cleanup that cannot prove group disappearance, or a claimed hard-kill observation without confirmed group stop and actual `SIGKILL` delivery
current-run lock path non-absent before a new exclusive acquisition; contention or stale/abandoned-looking content; or an acquired lock that disappears, becomes symlinked/hardlinked/replaced/retargeted/truncated/owner-marker-mismatched/ABA-reused, or is released before pointer update/promotion validation/render/both writes/check completes
candidate preview that creates a candidate directory/file or returns anything beyond the fixed two path/SHA-256/Git-blob-OID tuples plus `candidateSetSha256`; missing, malformed, expired, replayed, equal, cross-scoped, or closure/render/output-mismatched candidate-materialization decision; candidate mkdir/file creation before that decision validates; mutable, symlinked, non-content-addressed, root-replaced, or closure/decision-mismatched candidate receipt; review/evidence decisions that do not bind the candidate-materialization decision, its receipt, and exact two candidate hashes; a missing, mutable, or decision-mismatched promotion receipt; candidate/worktree/staged-index bytes or Git blob OIDs that differ from those receipts; or a committed evidence blob that differs from the checked staged blob
shell:true or string-built user command
missing run marker, partial check list, skipped required test, mismatched exit code, or forced PASS
missing/mismatched result.json/report.md/junit.xml/run.final.json closure
absolute path, payload, quote, token, cookie, stack, browser session, Domain location, or canary in a sanitized result
~~~

The runner never reads `~/.dsh` to decide safety; it compares normalized candidate paths. It generates `runId` with `crypto.randomUUID()`, creates `.tmp/dsh-pm-workbench/gate-b/runs/<runId>` with exclusive semantics, rejects symlinks/reuse, and writes a matching owner marker before creating children. Every mutable environment directory is created below that root and inherits the same marker. A previously populated directory is never cleaned and reused.

- [ ] **Step 2: Write the RED exact-check-list test**

Define immutable IDs `B01` through `B20`, one for each numbered item in specification §13.2. The report schema rejects missing, duplicate, unknown, or reordered IDs and requires a concrete observation plus evidence hash for every PASS. FAIL and INCONCLUSIVE attempts remain listed; only the final complete run can determine overall state.

- [ ] **Step 3: Run RED**

~~~bash
node --test tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
npm test -- tests/integration/gate-b-preconditions.test.ts tests/integration/gate-b-command-plan.test.ts tests/integration/gate-b-check-list.test.ts tests/integration/gate-b-profile-boundary.test.ts tests/integration/gate-b-report.test.ts tests/integration/gate-b-run-closure.test.ts tests/integration/gate-b-network-boundary.test.ts tests/integration/gate-b-bootstrap-environment.test.ts tests/integration/gate-b-browser-materializer.test.ts tests/integration/gate-b-offline-store-seeder.test.ts tests/integration/gate-b-authorization-boundary.test.ts tests/integration/gate-b-process-ownership.test.ts tests/integration/gate-b-pointer-lock.test.ts tests/integration/gate-b-promotion-candidate.test.ts tests/security/gate-b-redaction.test.ts
~~~

- [ ] **Step 4: Implement a separately authorized bootstrap and an offline runtime boundary**

`gate-b-bootstrap.mjs` is a direct Node phase wrapper: the operator invokes it with exactly `node scripts/gates/gate-b-bootstrap.mjs --bootstrap-decision-id <canonical-id>`, never through outer npm, `npx`, or `gate:b`. Before any authorization, the owner reviews exactly one fixed non-Git `.tmp/dsh-pm-workbench/gate-inputs/gate-b-browser-download-policy.json`. Its canonical bytes bind schema version, exact Playwright 1.62.1 and expected Chromium revision, platform and architecture, one exact owner-reviewed HTTPS archive URL, literal ZIP format, the archive's expected SHA-256 and exact byte length, exactly one expected archive root and one executable-relative path, bounded ZIP entry count/uncompressed-byte/compression-ratio ceilings, one ordered non-empty set of exact owner-confirmed HTTPS origins allowed for the initial URL and redirects, and a finite redirect ceiling. The plan does not guess or embed a URL, origin, hash, length, layout, or archive ceiling: only those reviewed policy bytes supply them. The URL and origins have no wildcard, userinfo, fragment, IP-literal/private/loopback target, or downgrade. The bootstrap decision binds the policy SHA-256, exact URL/archive identity, layout and limits, origin list/ceiling, source/lock/tool identities, fixed registry and output root. The wrapper accepts no policy path, URL, host, archive hash/length, archive layout/limit, output path, or downloader override and cannot merge an internal default, environment value, or redirect-discovered host.

The direct Node wrapper imports the inherited repository-owned `scripts/bootstrap/policy-fetch.mjs` and `scripts/bootstrap/materialize-browser.mjs` unchanged and verifies their accepted source hashes before any request. H1 additionally revalidates that the accepted F0 receipt contract carries one retained no-follow open archive descriptor and its device/inode/mode/link-count/size identity from fetch through materialization; if the exact accepted implementation cannot supply that contract, H1 stops and returns the repair to F0 instead of patching or copying either shared file. It never invokes Playwright's `install chromium`, any other stock Playwright downloader, an outer npm command, `npm exec`, or `npx`. The inherited fetcher uses Node's HTTPS transport with automatic redirect following disabled. It validates the exact initial URL before opening the request, resolves each `Location` against the accepted current URL, validates scheme, userinfo, loop count and exact origin before issuing the next request, and never attaches a body consumer or writes bytes for a response whose URL/origin has not passed. It rejects malformed/multiple locations, downgrade, unexpected final status, early EOF, extra bytes, and any response or accumulated archive exceeding the reviewed exact length. Only after an exact-length stream completes and the single retained descriptor's bytes have the policy SHA-256 may its exclusively created marker-owned temporary archive enter offline materialization; failed or disallowed responses leave no published browser tree.

After the browser-archive transfer subphase is closed and before extraction, the inherited repository-owned materializer parses and cross-checks the ZIP central directory and corresponding local headers from that same retained descriptor. It rejects encrypted or multi-disk archives, malformed/sparse/overlapping/ambiguous records, local-header disagreement, duplicate or case/Unicode-normalization-colliding names, NUL/backslash/absolute/drive-prefixed or `..` paths, symlink/hardlink/device/socket/FIFO or other unsupported entry types, multiple or wrong top-level roots, entry-count or declared-uncompressed-byte overflow, and compression ratios beyond the reviewed ceiling. A bounded pass over that descriptor inflates every supported regular entry without publication and records its declared size, CRC and SHA-256; the total must remain within policy. Immediately before extraction it requires `fstat` and a same-descriptor full hash to equal the fetch receipt, keeps the descriptor open, exposes only a fixed inherited descriptor number to the child, and invokes absolute `/usr/bin/ditto` with fixed argv `-x -k /dev/fd/<fixed-archive-fd> <exclusive-staging-directory>` and `shell: false`. The accepted macOS/ditto capability test must prove that form reads the inherited regular descriptor without reopening the mutable archive pathname; lack of that capability is unsupported/INCONCLUSIVE, never a fallback to the pathname. No environment, archive metadata, or caller value can add an argument. After the child exits, it again verifies the same open descriptor identity/size/hash. In the offline staging directory it repeats path/type/count/byte checks against actual filesystem objects, requires a complete no-follow inventory equal to the preflight entries, requires every extracted regular file's size/CRC/SHA-256 to equal the bounded preflight record, permits only directories and single-link regular files, proves the expected Chromium revision/layout against exact local Playwright registry metadata, requires the executable and bundle realpaths to remain inside staging, hashes every regular file/mode, and executes no extracted binary.

The same direct wrapper invokes repository-owned `gate-b-offline-store-seeder.mjs` as a separate direct Node phase under the same bootstrap decision; it does not pretend that F0's npm-only exact dependency installer can create a pnpm content-addressed store. Before authorization, the owner also reviews the exact canonical bytes of `.tmp/dsh-pm-workbench/gate-inputs/gate-b-offline-store-policy.json`. That policy binds its schema/version; the exact frozen source and final union-lock hash; Product and accepted ripple local-tgz identities; the complete sorted public package name/version/integrity set derived from the final lock plus the imported CLI/runtime manifests; exact accepted Node/npm/pnpm executable-entry/version/file hashes; fixed public registry `https://registry.npmjs.org/`; the two immutable command-grammar variant IDs; and the single marker-owned bootstrap root. It contains no arbitrary argv token, executable path, package range/tag, lifecycle permission, registry alternative, output path, or network host. The bootstrap decision binds this policy hash and every listed identity in addition to the browser policy. Missing pnpm identity, a package without exact integrity, lock/package-set disagreement, or an unsupported CLI grammar is a pre-network No-Go.

The seeder maps the two reviewed variant IDs to code-owned constant argv constructors proven for those exact CLI versions. Both variants invoke the accepted JavaScript CLI entry through the accepted Node executable with an explicit, source-hash-verified `--import <repository-owned-bootstrap-network-guard>` prefix; neither uses a shell shim, PATH executable, `NODE_OPTIONS`, or an outer package manager. After that fixed prefix, the npm variant runs once per sorted package with the exact grammar `<npm-cli-entry> cache add --cache <fixed-npm-cache> --registry https://registry.npmjs.org/ --ignore-scripts --no-audit --no-fund -- <exact-name@version>`; the pnpm variant likewise runs once per sorted package with the exact public grammar `<pnpm-cli-entry> store add --store-dir <fixed-pnpm-store> --registry https://registry.npmjs.org/ --ignore-scripts -- <exact-name@version>`. It deliberately uses no `fetch`, `--lockfile-dir`, or `pnpm-lock.yaml`: `package-lock.json` and the imported manifests authenticate the policy's exact package set but are not misrepresented as a pnpm lock. Before authorization, a real loopback synthetic registry fixture plus constructor-only guard allowance must prove both literal remote-package grammars against the exact accepted npm/pnpm versions, with exact-integrity test packages and lifecycle canaries; the production guard never admits that loopback allowance. If either accepted CLI is not a directly executable JavaScript entry or does not publicly support its mapped grammar, stop as unsupported rather than guessing a flag, using a private API, generating an unreviewed pnpm lock, or substituting an outer npm/npx command. Both children use argument arrays with `shell: false`, may spawn no descendant, and receive fresh marker-owned HOME/XDG/config/cache paths, distinct empty `NPM_CONFIG_USERCONFIG`/`NPM_CONFIG_GLOBALCONFIG`, and no inherited user/global config, `PLAYWRIGHT_*`, proxy, registry/auth/token/provider/custom-CA, or `NODE_OPTIONS` values.

The explicit preload puts `deny-external-network.mjs` into one bootstrap allow-policy mode whose canonical input is supplied by the already validated wrapper over a private inherited descriptor, not by a caller path or child environment. Before the child runs, the wrapper binds the guard source hash, exact preload argv, fixed `https://registry.npmjs.org/` scheme/host/port, and bootstrap decision into the receipt. The guard wraps every DNS lookup and Node socket/HTTP/HTTPS/undici/fetch/WebSocket entry used by the CLI, disables automatic cross-origin redirects, and permits a request only after normalizing the URL to that exact origin, resolving the hostname itself, rejecting every IP literal and every private/loopback/link-local/multicast/reserved result, and pinning the checked address set to the ensuing connection. It verifies the connected peer belongs to that set; a second lookup/peer disagreement is rebinding and fails before any response body is consumed. Every redirect target is resolved and subjected to the same exact-origin and pinned-address checks before a new request; an alternate host/origin, downgrade, credential-bearing URL, unchecked socket API, direct address, descendant spawn, or attempt to replace/unload the preload aborts the child. The wrapper records a bounded path-free receipt containing the guard/source/argv hashes, request count, exact normalized origin, per-request URL hashes, and public-address-set/peer hashes; any request lacking that receipt fails bootstrap. The bootstrap decision is consumed by the wrapper and receipt only and is never passed to either package-manager child.

The seeder independently resolves every fetched cache/store object back to the policy's exact name/version/integrity and rejects missing, extra, mutable, linked, or integrity-mismatched content before atomic publication. After the bootstrap network phase is closed, it must prove both trees usable by performing one disposable marker-owned install of the exact Product/ripple/CLI dependency closure with lifecycle scripts disabled, the fixed registry unreachable, and the package managers' public offline modes pointed only at those candidate trees; success requires zero request attempts and exact installed package identities. It then removes and proves absence of that disposable offline-install workspace. Neither cache tree is accepted merely because a child exited zero or because files exist. The wrapper never edits repository manifests, lock, `node_modules`, a DSH profile, or any existing bootstrap tree.

The unchanged F0 Node tests run first. H1 tests then use a real loopback HTTPS redirect fixture with synthetic archive bytes plus constructor-only test transport/process ports unavailable to the production CLI or export; they prove that initial and every redirected origin is accepted before body consumption and that unlisted/downgrade/userinfo/loop/ceiling/length/hash failures publish no browser tree. They also inject malicious parent `.npmrc`, named and future-shaped Playwright download-host variables, proxy/registry/auth/provider/custom-CA/Node-preload values, a forged `/usr/bin/ditto` path, archive-path rename/replacement after hash and during extraction, retained-descriptor identity drift, malicious central-directory paths/types/links/counts/lengths, decompressed CRC/content disagreement, post-extraction drift, and atomic-publish collisions; none may affect argv, destination, output, or receipt. A platform capability test proves the fixed inherited-descriptor `/dev/fd` invocation with synthetic ZIP bytes before any real archive is accepted. Seeder tests reject an unreviewed policy, arbitrary argv or path injection, unsupported/non-JavaScript npm/pnpm entry or version/grammar, any `pnpm fetch`/lockfile-based substitute, range/tag/missing-integrity/extra-package input, lifecycle enablement, inherited config, network fallback during the offline proof, empty or malformed cache/store success, symlink/hardlink/identity race, and a child-zero result whose exact offline install cannot be reproduced. Constructor-only network-guard tests inject alternate/cross-origin and credential-bearing redirects, direct-IP/private/loopback/link-local/reserved answers, DNS rebinding, connected-peer mismatch, raw/unwrapped socket paths, descendant spawn, preload replacement, body-before-acceptance, missing receipt, and sanitized-receipt tamper; none may issue or retain an unauthorized request body. Bootstrap stdout/stderr is bounded and sanitized. The wrapper creates one exclusive marker-owned `.tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/` and atomically publishes only the fixed `browsers/**`, `npm-cache/**`, and `pnpm-store/**` trees; it removes and verifies absence of the temporary archive, extraction staging, and disposable offline-install workspace before writing `manifest.json` last. That manifest binds bootstrap decision ID, exact wrapper/seeder/network-guard plus inherited fetcher/materializer source hashes, both policy bytes/hashes, archive retained-descriptor identity, URL/SHA-256/length and ZIP limits, allowed origins, redirect ceiling, observed initial/redirect chain, source/union-lock/environment-builder identities, exact npm/pnpm/Node versions and entry hashes, the exact public package/integrity set, fixed preload/package-manager argv and network-origin receipts, zero-network offline-proof receipt, exact `/usr/bin/ditto` identity/descriptor argv, tool versions, preflight entry content hashes, and SHA-256 browser/npm-cache/pnpm-store tree manifests. Absence, policy drift, transfer/extraction/seeding/network-receipt/offline-proof/cleanup/publish failure, partial tree, or manifest disagreement is INCONCLUSIVE and is never repaired by widening policy or using the stock downloader.

At Gate B start, the runner revalidates immutable seeds and uses their browser/offline-store trees read-only; it copies only the audited Product tgz/manifests and the imported Gate A handoff inputs selected by `handoffManifestSha256FromAcceptedH0Evidence` into the new run. It then denies external networking for the remainder of the attempt. It rejects inherited `NODE_OPTIONS` and supplies only the reviewed preload through explicit Node argv/environment so the accepted rc.6 CLI artifact and descendants reject `dns`, `dgram`, `net`, `tls`, `http`, `https`, `fetch`, WebSocket, and EventSource destinations unless the resolved address is loopback. The Playwright context disables service workers, aborts every non-loopback request, and launches Chromium with direct-proxy and host-resolver rules that permit only loopback. npm and pnpm run with offline flags. Any attempted external resolution or connection is a recorded FAIL; the only permitted sockets are 127.0.0.1/::1 for selected local ports.

- [ ] **Step 5: Implement staged execution without claim inflation**

The runner executes package audit, isolated empty-profile initialization, actual package install, Harness start, Connection/UI scenarios, compiled production-repository fault suite, public remove/re-add plus restart/remount, theme coexistence, browser acceptance, and sanitization as separately recorded stages. Component lifecycle tests directly drive the Cordis disposer/remount hooks and remain a separate evidence class; neither class may be relabelled as a real installed-but-disabled observation. A typecheck, build, config discovery, package listing, screenshot, or prior phase report can support a check but cannot alone mark it PASS.

The runner requires three distinct canonical arguments—`--runtime-decision-id`, `--install-decision-id`, and `--kill-decision-id`—and requires the package/bootstrap manifests to carry their own two distinct decision IDs. It rejects equality or substitution among all five IDs and binds each ID only to its declared scope and exact source/lock/tgz/bootstrap/ripple/process boundary. It strips every inherited `DSH_*` variable and supplies exactly one run-owned `DSH_HOME`. It sets run-owned `HOME`, `XDG_CONFIG_HOME`, `XDG_CACHE_HOME`, `XDG_DATA_HOME`, `npm_config_cache`, empty run-owned `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG`, `PNPM_HOME`, `PNPM_STORE_DIR`, and browser user-data; `PLAYWRIGHT_BROWSERS_PATH` points only to the hash-verified marker-owned bootstrap input. All subprocesses use executable-plus-argument arrays and `shell: false`. There is no PATH/global/npx resolution: the CLI executable-plus-entry is copied from the imported H0-accepted immutable CLI closure, its full package/dependency tree and entry hashes are revalidated, and its realpath must stay inside the run input. The frozen rc.6 CLI argv invokes `plugin --profile web add` for the local audited Product tgz with `--offline --ignore-scripts`, `web --host 127.0.0.1 --port 3187`, and `plugin --profile web remove @knight/dsh-pm-workbench --offline --ignore-scripts`. No `--trusted-host` flag is present. If B18 runs, its exact add/enable-disable-or-remove/re-add/cleanup argv comes only from the imported accepted ripple manifest; the runner has no URL, live-profile, or downloader path.

`gate-b-harness.mjs` starts a dedicated Node supervisor as a fresh detached POSIX process-group leader; that supervisor starts only the accepted Harness entry inside its own group. A runner-generated 256-bit launch sentinel is returned over an owned IPC channel and bound with child PID, PGID, parent PID, spawn monotonic instant, accepted CLI entry hash, isolated profile hash, and an OS process-birth observation into a `HarnessProcessIdentity` receipt. The runner records its own PID/PGID first and refuses a child group equal to the runner group. Ordinary stop, final cleanup, and failure cleanup call only the closed `gracefulRuntimeStop(identity, runtimeDecision, purpose)` path. It authenticates a runner-to-supervisor readiness request carrying the launch sentinel, literal `purpose: graceful-runtime-stop`, and exact runtime decision ID; rechecks that the fresh negative PGID is not the runner group; enumerates it through the fixed OS adapter; and requires every live member's PID, birth identity, parentage, CLI/profile binding, and sentinel channel to remain in the receipt. Only then does the runner send exactly one `SIGTERM` to that negative PGID and perform one bounded wait for every registered child/descendant plus the loopback listener to disappear. It sends no second signal and has no automatic `SIGKILL` fallback. Identity/membership ambiguity stops before signaling; timeout or any survivor makes the run INCONCLUSIVE and requires a later separately authorized manual cleanup. Supervisor exit alone never counts as Harness shutdown, and the B10 kill decision cannot authorize this path.

The signal controller exposes exactly two purpose-locked methods and no generic signal primitive, process-name, port, arbitrary PID/PGID, or caller-selected purpose. `gracefulRuntimeStop` above accepts only an in-memory `HarnessProcessIdentity`, exact runtime decision ID, literal graceful purpose, and fixed `SIGTERM`. `crashAtRootReplace` accepts only that identity, exact kill decision ID, literal `purpose: b10-storage-crash`, and the fixed `SIGSTOP`/`SIGKILL` sequence. The latter may begin only after the external collector has authenticated and ACKed the installed Product path's matching `root-replace-begin` atomic frame, verified its fixed `primitiveInvoked: true` enum, and recorded its transaction/sequence receipt. It challenges the live IPC sentinel, rechecks every process-birth observation, enumerates the group through one fixed absolute OS utility plus fixed argv, and refuses the runner/self group. Every live member must match a registered descendant identity. A registered member may be treated as exited only after two stable bounded process-table observations prove that exact birth identity absent and prove that its PID was not reused; every survivor must remain receipt-bound, and the storage-owning Harness process must still be a survivor. A pre-invocation stop can never have an ACKed begin receipt and is rejected as a B10 observation. A foreign/reused/unknown member, unstable membership, closed/replaced IPC/event channel, changed birth identity, or ambiguity stops before the first signal and makes B10 INCONCLUSIVE.

The sole B10 sequence sends `SIGSTOP` to the negative recorded PGID and performs a bounded wait until every survivor is OS-confirmed stopped. Because the group can no longer enqueue new frames, the collector then drains the authenticated event channel to its committed-frame watermark, rejects a partial frame or sequence gap, and revalidates the same PGID, birth identities, channel identity, complete survivor membership, and ACK ledger before any second signal. The collector must prove that no matching `root-replace-returned` frame was committed at or before confirmed stop; since the adapter cannot resolve `replaceRoot()` before that frame's external ACK, absence after the stopped-state drain is a causal fact rather than a logger-timing inference. It then sends `SIGKILL` to that same fully verified negative PGID, performs a second bounded wait, and proves every registered identity plus the listener disappeared. If a matching returned frame was committed, arrives during the stop/drain barrier, has a missing ACK, or otherwise raced confirmed stop, the attempt remains INCONCLUSIVE even when the owned stopped group is subsequently killed for bounded cleanup; if ownership or event-channel identity becomes ambiguous after `SIGSTOP`, no further signal is permitted and the stopped group is escalated for separately authorized manual handling. A hard-kill observation counts only when the begin ACK, confirmed stop, completed channel drain, no-returned proof, actual `SIGKILL` delivery, complete disappearance, exact purpose/kill-decision binding, and later same-profile restart all agree.

Every signal attempt records purpose, the correctly scoped runtime or kill decision ID, ownership-receipt hash, pre-signal membership receipt, delivered signal outcome, disappearance outcome, and bounded timing buckets; B10 additionally records stopped-state, begin/returned sequence and ACK, stopped-channel drain/watermark, and `SIGKILL` receipts. Synthetic-adapter tests cover decision/purpose/signal cross-substitution, sentinel mismatch, PID reuse, foreign member, self-target, name/port/caller-purpose rejection, member exit proved by stable identity absence, unknown disappearance, graceful `SIGTERM` timeout with no escalation, stop timeout, a returned frame buffered before stop but delivered only during drain, a partial/reordered/duplicate frame, missing or forged ACK, returned-event race, kill failure, and post-kill survivors. Separate real-process cases start only `tests/fixtures/process-group/owned-harness-tree.mjs` in fresh detached groups, prove each differs from the test runner group, and prove both exact sequences: one runtime-decision `SIGTERM` followed by bounded full disappearance with no second signal, and one ACKed-begin/kill-decision `SIGSTOP`/stopped-state/event-drain/`SIGKILL` followed by full disappearance. They never discover or target an external process.

Raw stdout/stderr, HTTP bodies, profile logs, browser traces, and screenshots remain below the unique run root; only a derived fixed-field summary is eligible for human review. Persistent logs allow only safe event name, opaque synthetic ID, version, duration bucket, and stable error code.

Every attempt writes `result.json`, `report.md`, and `junit.xml` atomically, including FAIL/INCONCLUSIVE attempts. All three bind the distinct package-freeze, bootstrap, runtime, install, and kill decision IDs plus the prerequisite pre-merge hydration, union-lock, final hydration, and handoff-import decisions and receipt hashes; each of the three optional network-decision fields is present only when its own classified retry occurred. The report includes only canonical opaque IDs/scopes and safe receipt hashes, not authorization prose or local paths. It writes `run.final.json` last with `runId`; those decisions and receipts; frozen source/lock/two-revision-fixture/golden-set/tgz/repository-core/bootstrap identities; reviewed browser-policy and offline-store-policy hashes, exact archive SHA-256/length, origin/redirect allowlist and observed chain, exact package/integrity set, Node/npm/pnpm identities, seeder/argv receipts, zero-network offline-proof receipt, and three immutable bootstrap tree hashes; storage atomicity evidence and exact resolved storage package identity; exact accepted H0 and P1 evidence topology receipts and fixed Git blob identities; `handoffManifestSha256FromAcceptedH0Evidence`, handoff-import decision, import manifest and copy hashes; accepted CLI artifact manifest/tree/entry/version identities; accepted Gate A′ report/final-marker plus ripple manifest/tgz/owner-decision bindings; hashes of raw `HarnessProcessIdentity` receipts plus runtime-decision `SIGTERM`/child-and-listener disappearance or kill-decision `SIGSTOP`/stopped-state/`SIGKILL`/wait outcomes and purposes; overall state; actual process exit; and SHA-256 for the first three files. Raw PID, PGID, process-birth fields, and IPC sentinel remain only beneath the uncommitted run root; sanitized report/evidence retain receipt hashes and safe ownership/outcome enums.

Runner pointer publication, candidate rendering, and every promoter invocation share `.tmp/dsh-pm-workbench/gate-b/current-run.lock`. The actor exclusively creates a marker-owned regular single-link non-symlink lock, performs `lstat` plus no-follow open/fstat and same-read content/identity checks, and writes a random operation ID, actor purpose, PID/birth identity, and frozen source into the lock. It never deletes or steals an existing lock: contention, abandoned/stale-looking content, replacement, hardlink, owner-marker mismatch, truncation, or ambiguous identity stops for review. Only while holding that exact lock, and only after result/final hashes and exit semantics agree, may the runner atomically update `current-run.json`; it releases the lock after pointer identity and bytes revalidate. Missing or mismatched closure is INCONCLUSIVE. All earlier runs remain intact.

`render-gate-b-evidence-candidate.mjs` is the sole Gate B candidate renderer and has two closed modes. Preview mode accepts exactly the four closure assertions `--run-id`, `--source-commit`, `--run-final-sha256`, and `--report-sha256` plus literal `--preview`; it accepts no decision, output, status, template, or path override. Under `current-run.lock` it revalidates the pointer, complete four-file closure, redaction result, frozen HEAD, deterministic render-policy hash, and exact two future destination paths. It renders twice in memory, requires byte identity, computes each SHA-256 and repository Git blob OID, derives canonical `candidateSetSha256`, and prints only one bounded JSON object containing that set hash plus the fixed two destination/path/SHA-256/Git-blob-OID tuples. Preview mode creates no candidate root, candidate document, or receipt and cannot authorize later writing.

Materialization mode accepts the same four closure assertions plus exact `--candidate-set-sha256 <64-lowercase-hex>` and `--candidate-materialization-decision-id <canonical-id>`; it has no path/status/template/output override. Before any candidate `mkdir`, staging-file creation, or final-file publication, it validates and atomically consumes `DSH_PMWB_GATE_B_CANDIDATE_MATERIALIZATION_DECISION_ID` as a fresh, unexpired decision in the candidate-materialization scope and requires it to equal the CLI value. That decision binds the frozen source/run/final/report closure, Product tgz and every prerequisite receipt, render-policy hash, previewed `candidateSetSha256`, exact two destination/path/SHA-256/Git-blob-OID tuples, the fixed root `.tmp/dsh-pm-workbench/gate-b/promotion-candidates/<sourceCommit>/<runId>/<candidateSetSha256>/`, fixed three-file schema, and expiry. It must be distinct from every package/bootstrap/runtime/install/kill, prerequisite action/network, human-review, and evidence decision. Missing, malformed, expired, already consumed, equal, cross-scoped, drifted, or substituted authorization fails before any candidate output is allocated; a crash after consumption requires a new owner decision and never reuses the consumed ID.

Only after that validation, while retaining the same pointer lock, materialization mode rerenders twice and requires exact equality with the preview-bound set. In a decision-bound exclusive staging directory it writes `gate-result.md`, `probe-results.md`, and final canonical `candidate-receipt.json`, verifies that exact three-file set, then performs one atomic publication into the fixed absent content-addressed root; no fourth entry is permitted. The receipt hash is over canonical bytes omitting its own hash and binds the candidate-materialization decision ID and its authorization-receipt hash, four closure identities, render-policy hash, `candidateSetSha256`, exact two destination/path-to-candidate mappings, candidate SHA-256/Git blob OIDs, fixed root/schema, and locked pointer identity. It revalidates all three immutable regular single-link files plus pointer/lock before release and prints one bounded JSON object with the exact relative receipt path/hash, materialization-decision ID, set hash, and two candidate identities. Any existing root, action replay, partial staging/publishing, extra entry, link/special file, root replacement, path scan, pointer race, or redaction canary fails closed and requires separate review; it is never overwritten or silently resumed. A person reviews those exact authorized candidate files, not only the preview, upstream report, or render policy.

`promote-gate-b-evidence.mjs` requires exactly `--run-id <canonical-id>`, `--source-commit <40-lowercase-hex>`, `--run-final-sha256 <64-lowercase-hex>`, `--report-sha256 <64-lowercase-hex>`, `--candidate-set-sha256 <64-lowercase-hex>`, `--candidate-materialization-decision-id <canonical-id>`, `--candidate-receipt-sha256 <64-lowercase-hex>`, `--human-review-decision-id <canonical-id>`, and `--evidence-decision-id <canonical-id>`, with optional `--check` as the only additional flag. These are equality assertions; the promoter derives the one fixed candidate root and never accepts or scans a caller path. The candidate-materialization, human-review, and evidence decisions must be mutually distinct and distinct from all Gate B and prerequisite action/network decisions. The human-review decision binds the exact source/run/final/report, Product tgz/package manifest, prerequisite evidence/decision receipts, sanitization outcome, canonical render policy, candidate-materialization decision/receipt, exact candidate-receipt path/hash, `candidateSetSha256`, both candidate SHA-256/Git blob OIDs, and exact output path set `docs/gate-results/dsh-pm-workbench-gate-b.md` plus `docs/probe-results.md`. The later evidence-write/commit decision binds those same identities and candidate bytes, the human-review decision, exact two-path set, and fixed commit message. Neither decision authorizes another candidate, run, package/bootstrap/install/signal action, source edit, push, or publication.

The promoter acquires the same exclusive `current-run.lock` before selecting anything and holds it across no-follow pointer read, complete closure/candidate-materialization-decision/candidate-receipt/human-review/evidence-decision validation, in-memory rerender, both atomic document replacements, post-write byte verification, immutable promotion-receipt publication, pointer/lock revalidation, and release. The rerendered SHA-256/Git blob OIDs must equal the authorized, human-reviewed candidate receipt and both later decisions before the first tracked write. It canonicalizes those four values with source/run/final/report, render-policy hash, `candidateSetSha256`, candidate-materialization decision/receipt, pointer identity, human-review/evidence decisions, and exact two-path set; computes `promotionReceiptSha256` over canonical bytes that omit their own hash; and exclusively writes `promotion-receipt.json` last beneath `.tmp/dsh-pm-workbench/gate-b/promotions/<sourceCommit>/<runId>/<promotionReceiptSha256>/`. It rejects an existing non-identical tree, link/special file, extra entry, or path/identity drift and prints one bounded JSON object containing the exact receipt relative path/hash and both reviewed candidate SHA-256/Git blob OIDs.

The independent `--check` invocation runs only after the two documents have been staged. It reacquires and holds `current-run.lock` across the same selection/validation/candidate-materialization/candidate-receipt/human-review/evidence-decision/render path, writes nothing, derives both exact receipt paths rather than scanning, requires the candidate and promotion receipts plus both worktree documents to equal the fresh render, reads the exact two index blobs through fixed no-shell Git plumbing, and requires their bytes, SHA-256 values, and OIDs to equal both receipts before revalidating pointer plus lock identity immediately before success. Ordinary mode requires HEAD equal the explicit source and empty tracked/untracked status; `--check` requires the same HEAD and permits exactly those two staged documents with no unstaged bytes or third path. The later evidence commit is accepted only after its two committed blobs also equal both receipts. A new completed run, pointer or lock replacement, ABA-reused bytes with different identity, lock loss, receipt substitution, or retarget is a race failure, never an implicit reselection. Tests cover zero-candidate-output preview; candidate mkdir/file absence before authorization validation; missing/malformed/expired/replayed/equal/cross-scoped/materialization-drift decisions; runner/renderer/promoter contention; abandoned, symlinked, hardlinked, truncated, replaced, retargeted, and ABA locks/pointers/receipts/roots; pointer change before preview, between preview and materialization, during atomic candidate publication, between tracked document writes, before promotion-receipt publication, and before check completion; changed candidate after review; review/evidence decisions bound to another materialization decision, receipt, or candidate; worktree/index/committed-blob mismatch; mismatched explicit closure/review/evidence identities; duplicate decisions; dirty or advanced HEAD; stale final marker; third output path; and PASS inflation from FAIL/INCONCLUSIVE.

- [ ] **Step 6: Run GREEN without bootstrapping or starting Harness**

~~~bash
node --test tests/bootstrap/policy-fetch.node.test.mjs tests/bootstrap/browser-materializer.node.test.mjs
npm test -- tests/integration/gate-b-preconditions.test.ts tests/integration/gate-b-command-plan.test.ts tests/integration/gate-b-check-list.test.ts tests/integration/gate-b-profile-boundary.test.ts tests/integration/gate-b-report.test.ts tests/integration/gate-b-run-closure.test.ts tests/integration/gate-b-network-boundary.test.ts tests/integration/gate-b-bootstrap-environment.test.ts tests/integration/gate-b-browser-materializer.test.ts tests/integration/gate-b-offline-store-seeder.test.ts tests/integration/gate-b-authorization-boundary.test.ts tests/integration/gate-b-process-ownership.test.ts tests/integration/gate-b-pointer-lock.test.ts tests/integration/gate-b-promotion-candidate.test.ts tests/security/gate-b-redaction.test.ts
npm run typecheck
~~~

Expected: runner unit/contract tests PASS. The process-ownership file runs its own fresh isolated fixture group only and proves the test runner is never targeted. Gate B and browser bootstrap both remain `NOT_RUN`; do not use `node scripts/gates/gate-b-bootstrap.mjs`, `npm run gate:b`, or `npm run gate:b:promote` in this task. `package.json` must not define a `gate:b:bootstrap` npm alias; the separately authorized bootstrap entry is direct Node only.

- [ ] **Step 7: Commit**

~~~bash
git add -- scripts/gates/gate-b.mjs scripts/gates/gate-b-checks.mjs scripts/gates/gate-b-harness.mjs scripts/gates/gate-b-browser.mjs scripts/gates/gate-b-faults.mjs scripts/gates/gate-b-bootstrap.mjs scripts/gates/gate-b-offline-store-seeder.mjs scripts/gates/render-gate-b-evidence-candidate.mjs scripts/gates/promote-gate-b-evidence.mjs scripts/gates/shared/deny-external-network.mjs scripts/gates/shared/command.mjs scripts/gates/shared/profile-boundary.mjs scripts/gates/shared/result-schema.mjs scripts/gates/shared/report.mjs scripts/workspace-boundary.ts package.json docs/ci.md tests/integration/gate-b-preconditions.test.ts tests/integration/gate-b-command-plan.test.ts tests/integration/gate-b-check-list.test.ts tests/integration/gate-b-profile-boundary.test.ts tests/integration/gate-b-report.test.ts tests/integration/gate-b-run-closure.test.ts tests/integration/gate-b-network-boundary.test.ts tests/integration/gate-b-bootstrap-environment.test.ts tests/integration/gate-b-browser-materializer.test.ts tests/integration/gate-b-offline-store-seeder.test.ts tests/integration/gate-b-authorization-boundary.test.ts tests/integration/gate-b-process-ownership.test.ts tests/integration/gate-b-pointer-lock.test.ts tests/integration/gate-b-promotion-candidate.test.ts tests/fixtures/process-group/owned-harness-tree.mjs tests/security/gate-b-redaction.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "test: add the isolated Gate B runner"
~~~

### Task 8: Implement Gate B functional, pagination, protocol, and concurrency scenarios

**Files:**

- Create: tests/e2e/gate-b-product-flow.spec.ts
- Create: tests/e2e/gate-b-pagination.spec.ts
- Create: tests/e2e/gate-b-protocol.spec.ts
- Create: tests/e2e/gate-b-concurrency.spec.ts
- Create: tests/e2e/gate-b-capacity.spec.ts
- Create: tests/e2e/gate-b-domain-invariants.spec.ts
- Create: tests/support/gate-b-synthetic-scenario.ts
- Create: tests/integration/gate-b-scenario-manifest.test.ts
- Create: tsconfig.gate-b-e2e.json
- Modify: package.json
- Modify: scripts/gates/gate-b-checks.mjs
- Modify: scripts/gates/gate-b-browser.mjs
- Modify: tests/integration/standalone-copy.test.ts

**Interfaces:**

- Consumes: the installed audited tgz through real Harness Product Host/Client, real Connection RPC, production `HarnessProjectRepository`, real `WorkbenchView`, and fixed fixture.
- Produces: observations for B01–B16 that re-run the combined path instead of summing H0/P0/P1 reports.

- [ ] **Step 1: Write RED end-to-end product-flow tests**

Through visible Harness UI and real Connection RPC, perform:

~~~text
create project
→ import reviewed synthetic TXT/MD text without a Host path
→ create fixture analysis
→ inspect supporting evidence, counterexample, and unknown
→ accept A
→ edit A with human reason
→ reject or defer B with reason
→ reorder by human action
→ independently confirm and publish baseline
→ render deterministic PRD
→ read manifest and all chunks
→ verify chunk identities/offsets/hashes, total bytes, and content hash
→ compare download bytes with the frozen renderer golden
~~~

Read all source segment pages, reconstruct normalized text, and recompute every cited locator/hash. Confirm every accepted source/entity/PRD is completely readable.

Before the accepted flow, use the visible intake with arbitrary valid `.txt`/`.md`, a one-byte-changed R1, and a matching safe basename with wrong content; then bypass any Client precheck with the same cases through real Connection RPC. Every case must show the fixed recoverable invalid-input state and prove zero project/source/receipt/aggregate/catalog/physical-record write. Only strict-loaded accepted R1/R2 bytes may proceed.

- [ ] **Step 2: Write RED pagination/cursor tests**

Create at least two pages for project list, every collection kind actually used by the flow, source segments, and at least two Markdown chunks. Without mutation there are no gaps, duplicates, or ordering changes. With a mutation between pages, mutable old snapshots return stale-input and Client discards the entire partial aggregate before restarting at page one.

Tamper endpoint, project, kind, snapshot, next key, encoding, and HMAC tag. Inject a wrong public continuation and shape-valid wrong project/kind/revision/content hash/chunk offset/hash/EntityRef owner. Every case fails closed, never crosses projects, never reveals a physical path, never marks data complete, and never enables download.

- [ ] **Step 3: Write RED CAS/receipt/concurrency tests**

Verify same ID/same hash replay, same ID/different hash preservation, two commands on one old version, accepted and receipt-eligible rejected replay after restart, all no-receipt precondition classes from §5.6, ledger saturation, and exact C1/C2 ordering:

~~~text
C1 commits version 1 and response is lost
C2 commits version 2 in another tab
C1 exact replay returns historical committedVersion 1
projects.get returns authoritative version 2
UI never regresses or starts pagination at version 1
~~~

Also run parallel commands on two projects and observe both catalog increments.

- [ ] **Step 4: Write RED capacity and invariant tests**

Cover specification §5.8 limit−1/limit/limit+1 for Product request/outcome, page/chunk, raw and normalized text, UTF-16 units, Markdown, segment/chunk/item/overview/command sizes, object/array counts, receipts, all physical project/profile/temporary bytes, and admission. With deterministic barriers, Client request 9 waits locally and can abort without Host invocation; a direct Host request 17 returns fixed outer `internal` before service with zero side effect. Reject cross-project refs, stale baselines, invalid locators, wrong actors, fixture prompt execution, and Markdown/footnote structure escape. Every refusal has zero partial write.

- [ ] **Step 5: Run RED without invoking Playwright**

~~~bash
./node_modules/.bin/tsc -p tsconfig.gate-b-e2e.json --noEmit
npm test -- tests/integration/gate-b-scenario-manifest.test.ts
npm test -- tests/integration/standalone-copy.test.ts
~~~

Expected: the compile-only command validates the six `.spec.ts` files and fixed test driver without executing them; the manifest test FAILS because B01–B16 do not yet map to complete scenario implementations. `standalone-copy` fails until the new config is a required copied candidate. Its eventual GREEN must preserve Task 6's Product-only build/verify/dry-pack exactly-once assertions and may only extend the required config set; it cannot restore a Probe target. `vitest.config.ts` continues to include only `.test.ts` and `.test.tsx`, so no `.spec.ts` is ever passed to Vitest.

- [ ] **Step 6: Complete the scenario implementations**

Reuse Product API/UI drivers and production validators. Test helpers may select visible controls and inject fixed Connection/driver faults only through Gate runner-owned test processes; they cannot call application services to stand in for the real tgz path. Each scenario records B-check IDs, public action, safe observed identity/version/hash, and exit state. `gate-b-browser.mjs` invokes the repository-local Playwright CLI with an executable-plus-argument array and `shell: false`; those `.spec.ts` files run only as one stage inside the separately authorized `npm run gate:b`.

- [ ] **Step 7: Run code-level GREEN**

~~~bash
npm run typecheck
./node_modules/.bin/tsc -p tsconfig.gate-b-e2e.json --noEmit
npm test
npm test -- tests/integration/standalone-copy.test.ts
~~~

Expected: the complete Vitest suite and compile-only Gate B E2E contract PASS, Vitest reports zero `.spec.ts` executions, and real Gate B states remain NOT_RUN until Task 10 authorization.

- [ ] **Step 8: Commit**

~~~bash
git add -- tests/e2e/gate-b-product-flow.spec.ts tests/e2e/gate-b-pagination.spec.ts tests/e2e/gate-b-protocol.spec.ts tests/e2e/gate-b-concurrency.spec.ts tests/e2e/gate-b-capacity.spec.ts tests/e2e/gate-b-domain-invariants.spec.ts tests/support/gate-b-synthetic-scenario.ts tests/integration/gate-b-scenario-manifest.test.ts tsconfig.gate-b-e2e.json package.json scripts/gates/gate-b-checks.mjs scripts/gates/gate-b-browser.mjs tests/integration/standalone-copy.test.ts
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "test: define the combined Product acceptance"
~~~

### Task 9: Complete recovery, lifecycle, theme, leakage, and accessibility scenarios

**Files:**

- Create: tests/e2e/gate-b-recovery.spec.ts
- Create: tests/e2e/gate-b-storage-atomicity.spec.ts
- Create: tests/e2e/gate-b-lifecycle.spec.ts
- Create: tests/e2e/gate-b-theme-coexistence.spec.ts
- Create: tests/e2e/gate-b-accessibility.spec.ts
- Create: tests/security/gate-b-canary-matrix.test.ts
- Create: tests/integration/gate-b-listener-boundary.test.ts
- Modify: scripts/gates/gate-b-faults.mjs
- Modify: scripts/gates/gate-b-browser.mjs
- Modify: scripts/gates/gate-b-checks.mjs

**Interfaces:**

- Consumes: the audited tgz, compiled production repository core, test-only driver below it, isolated profile, the exact revalidated H0 ripple acceptance manifest/tgz, and real browser.
- Produces: observations for B10, B14, and B16–B20 plus a supporting real-rc.6 atomic/crash observation, full-chain canary, and lifecycle evidence.

- [ ] **Step 1: Write RED recovery and abort scenarios**

Run the complete Task 3 mutation **and initialization** failure schedule against the compiled production repository core and verify its packed hashes. Repeated post-root cleanup failure must leave complete committed reads available, keep the repository recovery-required/read-only, return no prior accepted response, and make a subsequent mutation perform zero physical writes until a later successful recovery cleans and recounts every owned record. In the real installed profile, restart after normal commits and recover project, revisions, decisions, baseline, PRD, catalog/project versions, receipts, current immutable cursors, and explicit stale cursors. Exercise abort before enqueue, waiting for project lock, waiting for catalog, immediately before intent, and after intent/root commit; only the post-intent cases may commit and must show result unknown until exact-command reconciliation.

`gate-b-storage-atomicity.spec.ts` is supporting runtime observation for the Task 1 authoritative contract, not a substitute for it. Through the installed Product production path, the storage adapter invokes the accepted root-replacement primitive, captures its promise and installs its settlement continuation before yielding, then emits the fixed safe `root-replace-begin` frame with opaque transaction ID, monotonic sequence, and `primitiveInvoked: true` on the authenticated atomic-frame channel. A synchronous throw emits no begin; if the promise settles before or while begin is acknowledged, the continuation commits `root-replace-returned` and the attempt is ineligible. The adapter cannot resolve `replaceRoot()` after the accepted primitive returns until the collector ACKs the matching returned frame. Across bounded fresh isolated runs, and only under the exact kill decision bound at Gate start, the Gate runner invokes the Task 7 ownership state machine with `purpose: b10-storage-crash` on the current `HarnessProcessIdentity` only after validating and ACKing that post-invocation begin frame. It revalidates the complete owned group, sends `SIGSTOP` to the negative PGID, proves every surviving registered member is stopped with the same birth identity, drains the now-quiescent event channel through its committed-frame watermark, rejects partial/gapped frames, and proves no matching returned frame was committed before confirmed stop; only then may it send `SIGKILL` to that same revalidated group and prove bounded complete disappearance. Registered descendants already exited are accepted only through the stable two-observation identity rule; any foreign, reused, unknown, or critical-Harness-missing member is INCONCLUSIVE. A returned frame observed before or during the stopped-state drain, a missing/forged ACK, a partial frame, a pre-invocation stop, or an event-channel identity change is a return race/ambiguity and remains INCONCLUSIVE even if the already stopped owned group is killed for cleanup. The scenario counts as a hard-kill observation only when the post-invocation begin ACK, stopped-state and channel-drain receipts, no-returned causal proof, actual `SIGKILL` delivery, decision/purpose binding, and complete group disappearance all prove the intended crash boundary. It restarts the exact profile with a new ownership receipt, then verifies by public Product reads and receipt reconciliation that each attempt yields exactly the complete old checksum or complete target checksum—never a torn root, mixed generations, duplicate version, or missing listed intent record. Raw PID/PGID/birth/sentinel evidence remains under the run root; the sanitized check records only ownership-receipt hash, purpose, decision ID, ACK/drain/stopped/event/signal outcome enums, bounded timing buckets, old/new safe hashes, restart result, storage package version/integrity/entry hash, and the Task 1 atomicity-evidence document hash. If begin cannot be ACKed, primitive invocation is unproven, stop or complete drain cannot be confirmed, return races stop, ownership or membership changes, PID reuse is detected, `SIGKILL` is not delivered, disappearance is unproven, a third state appears, or the public guarantee is absent, B10 is INCONCLUSIVE/FAIL and Gate B is No-Go.

- [ ] **Step 2: Write RED lifecycle and removal scenarios**

In the compiled Product lifecycle contract, directly drive repeated Cordis disposer/remount hooks and assert the Task 5 disposal order. In the real isolated profile, execute only the frozen public Product remove/re-add plus Harness restart/remount sequence, then final remove/restart. Keep these evidence classes distinct: do not call remove/re-add “disable/enable.” Assert handler/launcher/overlay disappear after removal, original chat remains usable, no write occurs after Domain close, Domain records remain, and reinstalling the exact same tgz reads the sentinel. UI/report copy says removal retains data. Purge controls/endpoints are absent.

- [ ] **Step 3: Write RED theme coexistence scenarios**

Before execution, require the exact H1-imported `.tmp/dsh-pm-workbench/gate-inputs/gate-a-handoff/<handoffManifestSha256FromAcceptedH0Evidence>/ripple/accepted.json`, independently reverify the exact accepted H0 evidence commit's one-parent/two-path closure, re-read its two fixed blobs, and verify their matching derived handoff hash, the enclosing export/import manifest hashes, recorded tgz SHA-256/provenance, owner decision, and `activeInstallationTouched: false` before copying that tgz into the marker-owned Gate B run input. H1 does not read the H0 worktree or current-worktree evidence documents, accept a caller/environment hash, new path/URL/live profile/alternate manifest, or select by mtime. Installing/removing that copy inside the isolated Gate B home still needs the exact Gate B install decision. With the theme enabled and disabled, the workbench launcher, overlay, pointer, keyboard, focus, confirmation, errors, chat, and download work. Removing the workbench does not change theme files/settings; removing the isolated theme copy does not change workbench project data. If the H0-evidence-derived imported input is absent or drifts, B18 is INCONCLUSIVE and Gate B is No-Go; any replacement must go back through H0's acceptance script, sealed export, promotion, evidence commit, and owner review.

- [ ] **Step 4: Write RED browser accessibility scenarios**

In the actual Harness overlay, repeat the P1 keyboard path, modal focus containment/restoration, visible focus, loading/empty/error/stale/commit-result-unknown states, reduced motion, 1440×900, 1024×768, and 200% zoom. The 200% case must use the browser's real page-zoom/reflow control on the unchanged 1024×768 CSS viewport; CSS `zoom`, `transform: scale`, device-scale-factor changes, or a smaller viewport do not count. Assert via bounding boxes and hit-testing that no required control/text is clipped or overlaps, horizontal scrolling is absent unless the documented component explicitly requires it, focus remains visible, and every action is reachable by keyboard. P1 evidence is a prerequisite but cannot substitute for this mounted acceptance.

- [ ] **Step 5: Write the RED canary matrix**

Inject synthetic transcript text, quote, fake token, fake cookie, fake absolute path, Domain-location marker, stack marker, and hostile unknown keys. Scan HTTP bodies, Host stdout/stderr, profile logs, browser console, UI, trace, screenshots, download filename, gate report, tgz, build manifest/metafile, and test-failure output. Any occurrence is FAIL. Expected synthetic content may appear only in the explicitly reviewed source/evidence/PRD UI and downloaded PRD body; the scan uses separate canaries that must never be legitimately rendered and records this distinction.

- [ ] **Step 6: Run RED/offline checks**

~~~bash
npm test -- tests/security/gate-b-canary-matrix.test.ts tests/integration/gate-b-listener-boundary.test.ts
npm run typecheck
./node_modules/.bin/tsc -p tsconfig.gate-b-e2e.json --noEmit
~~~

Expected: FAIL because the Gate runner does not yet register the complete recovery/lifecycle/theme/accessibility/canary matrix. No `.spec.ts` executes, and real browser/profile states remain NOT_RUN.

- [ ] **Step 7: Complete the remaining Gate runner scenario registrations**

Wire the compiled production-core fault schedule and the six visible-runtime scenario groups to their exact B-check IDs. The runner may expose fixed barriers/fault schedules only to its own test processes; no Product RPC, config, UI, package export, or packed byte can select them. Require safe observations for cleanup, listener disappearance, retained Domain sentinel, accepted ripple hash, browser status/focus, and the full canary scan.

- [ ] **Step 8: Run GREEN without starting Harness**

~~~bash
npm test -- tests/security/gate-b-canary-matrix.test.ts tests/integration/gate-b-listener-boundary.test.ts
npm run typecheck
./node_modules/.bin/tsc -p tsconfig.gate-b-e2e.json --noEmit
~~~

Expected: static/helper/compile-only checks PASS; Playwright `.spec.ts` files remain unexecuted and real Gate B states remain NOT_RUN.

- [ ] **Step 9: Commit**

~~~bash
git add -- tests/e2e/gate-b-recovery.spec.ts tests/e2e/gate-b-storage-atomicity.spec.ts tests/e2e/gate-b-lifecycle.spec.ts tests/e2e/gate-b-theme-coexistence.spec.ts tests/e2e/gate-b-accessibility.spec.ts tests/security/gate-b-canary-matrix.test.ts tests/integration/gate-b-listener-boundary.test.ts scripts/gates/gate-b-faults.mjs scripts/gates/gate-b-browser.mjs scripts/gates/gate-b-checks.mjs
git diff --cached --name-only
git diff --cached --check
git status --short
git commit -m "test: complete Gate B safety scenarios"
~~~

### Task 10: Freeze H1, run the separately authorized Gate B, and stop

**Files:**

- Generated outside Git after owner review: .tmp/dsh-pm-workbench/gate-inputs/gate-b-browser-download-policy.json
- Generated outside Git after owner review: .tmp/dsh-pm-workbench/gate-inputs/gate-b-offline-store-policy.json
- Generated outside Git if bootstrap is authorized: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/.dsh-pm-workbench-bootstrap-input
- Generated outside Git if bootstrap is authorized: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/browsers/**
- Generated outside Git if bootstrap is authorized: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/npm-cache/**
- Generated outside Git if bootstrap is authorized: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/pnpm-store/**
- Generated outside Git if bootstrap is authorized: .tmp/dsh-pm-workbench/gate-inputs/gate-b-bootstrap/<bootstrapId>/manifest.json
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/result.json
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/report.md
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/junit.xml
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/run.final.json
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/inputs/product/<productTgzSha256>.tgz
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/inputs/ripple/<rippleTgzSha256>.tgz
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/inputs/gate-a-handoff/<handoffManifestSha256FromAcceptedH0Evidence>/**
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/profile/**
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/runs/<runId>/browser-user-data/**
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/current-run.json
- Generated outside Git: .tmp/dsh-pm-workbench/gate-b/current-run.lock
- Generated outside Git after candidate-materialization authorization for exact review: .tmp/dsh-pm-workbench/gate-b/promotion-candidates/<sourceCommit>/<runId>/<candidateSetSha256>/gate-result.md
- Generated outside Git after candidate-materialization authorization for exact review: .tmp/dsh-pm-workbench/gate-b/promotion-candidates/<sourceCommit>/<runId>/<candidateSetSha256>/probe-results.md
- Generated outside Git after candidate-materialization authorization for exact review: .tmp/dsh-pm-workbench/gate-b/promotion-candidates/<sourceCommit>/<runId>/<candidateSetSha256>/candidate-receipt.json
- Generated outside Git after promotion: .tmp/dsh-pm-workbench/gate-b/promotions/<sourceCommit>/<runId>/<promotionReceiptSha256>/promotion-receipt.json
- Create or append after human review: docs/gate-results/dsh-pm-workbench-gate-b.md
- Modify after human review: docs/probe-results.md

**Interfaces:**

- Consumes: a frozen clean H1 source commit; exact lock; independently verified H0 and P1 evidence topologies; accepted P0 identity; the Gate A′ handoff imported only by `handoffManifestSha256FromAcceptedH0Evidence` under the recorded handoff-import decision; accepted CLI closure; audited tgz; exact rc.6 runtime/packages; fixed fixture/goldens; frozen storage-atomicity evidence; one owner-reviewed browser archive policy and one owner-reviewed offline-store policy plus the marker-owned browsers/npm-cache/pnpm-store bootstrap closure; revalidated ripple manifest; pre-merge hydration, union-lock, final-hydration, and handoff-import action decisions/receipts plus each conditionally used network decision/receipt; and distinct canonical owner decisions for final package freeze, bootstrap, runtime, isolated install/remove, bounded B10 process-group kill, candidate materialization, human sanitization review, and evidence write/commit.
- Produces: a unique observed Gate B run with a four-file cryptographic closure bound to package/bootstrap/runtime/install/kill decisions and every consumed import/union/hydration decision receipt; a zero-candidate-output preview; one separately authorized immutable candidate set plus receipt; and, only after candidate-bound human sanitization review and evidence-write decisions, a byte-reproducible evidence-only documentation commit at the fixed paths.

- [ ] **Step 1: Commit and freeze the reviewed H1 code, then run static preflight**

All Task 1–9 source/test/runner changes must already be in local commits. If review changes any tracked file, commit that repair first and restart this step; a dirty or amended tree cannot inherit an earlier result.

~~~bash
npm run check
./node_modules/.bin/tsc -p tsconfig.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.client.json --noEmit
./node_modules/.bin/tsc -p tsconfig.surface.storage.json --noEmit
./node_modules/.bin/tsc -p tsconfig.gate-b-e2e.json --noEmit
npm run build -- --target product
npm run verify:package -- --target product
npm run pack:dry -- --target product
npm test -- tests/integration/standalone-copy.test.ts
git diff --check
git status --porcelain=v1 --untracked-files=all
git rev-parse HEAD
shasum -a 256 package-lock.json fixtures/synthetic/pm-discovery-v1.input.md fixtures/synthetic/pm-discovery-v1.r2.input.md fixtures/synthetic/pm-discovery-v1.manifest.json fixtures/synthetic/pm-discovery-v1.expected-analysis.json fixtures/synthetic/pm-discovery-v1.expected-prd.md fixtures/synthetic/pm-discovery-v1.expected-prd.json fixtures/synthetic/pm-discovery-v1.goldens.manifest.json
~~~

The status command must print nothing. Run the shared strict loader and require its two-revision fixture/set receipt and golden/set receipt to match the accepted prerequisite evidence. Product standalone-copy must build/verify/dry-pack Product exactly once and run all three public surface compilers from its own dependency root. Reverify both the exact accepted H0 and P1 evidence commits' sole-parent/raw-NUL-two-regular-file closures; re-read the H0 fixed Gate A report and canonical-ledger blobs; derive `handoffManifestSha256FromAcceptedH0Evidence` again; and revalidate the exact imported handoff/import decision, pre-merge hydration, union-lock, and final-hydration action receipts plus each conditionally used network receipt, CLI closure, storage atomicity evidence/package identity, and all prerequisite hashes. Neither current-worktree docs nor a stored caller/environment hash or decision ID may replace this check. Record this HEAD as the frozen source commit. Do not amend, rebase, or change it after a package/runtime result; any repair gets a new commit, renewed package authorization, new tgz, and new `runId`.

- [ ] **Step 2: Stop and obtain/renew Product package-freeze authorization for final H1 HEAD**

Tasks 7–9 changed the source commit after Task 6, so an earlier Product tgz cannot authenticate final H1 even if its packed bytes happen to match. Obtain a fresh authorization limited to the recorded clean HEAD, exact Product target, fixed npm-pack argv with `--ignore-scripts`, and marker-owned content-addressed `.tmp` output; record its new canonical ID as `DSH_PMWB_H1_PACKAGE_FREEZE_DECISION_ID`. It excludes dependency/network/profile/browser/publish actions and cannot reuse an earlier-source package decision. Then run:

~~~bash
npm run package:product -- --package-freeze-decision-id "$DSH_PMWB_H1_PACKAGE_FREEZE_DECISION_ID"
npm test -- tests/integration/product-tarball.test.ts
~~~

The final Product audit must prove that no fixture body/path, Host filesystem/network capability, Client network/dynamic-code capability, or Probe/test/fault/reduced-limit seam is packed. Bind the resulting tgz and build/source manifest to this HEAD. Without this authorization or a passing audit, stop before bootstrap/runtime.

- [ ] **Step 3: Bootstrap only if preflight reports a missing exact input, under separate authorization**

If the exact browsers/npm-cache/pnpm-store bootstrap manifest is already valid, do not run bootstrap; its bound decision ID, both reviewed policy hashes, archive SHA-256/length, redirect observations, exact package/integrity set, npm/pnpm seeding-grammar and preload/network-origin receipts, zero-network offline-proof receipt, and all tree hashes remain the ones consumed by Gate B. Otherwise, first create no network artifact: have the owner separately review and freeze the exact canonical bytes of both fixed policies described in Task 7 and independently recompute both SHA-256 values. Verify that the browser policy bytes—not this plan—contain the exact HTTPS archive URL, expected archive SHA-256 and byte length, ZIP entry/unpacked ceilings, literal format, expected root and executable-relative path, exact origin/redirect list and ceiling, Playwright version, Chromium revision, platform, and architecture. Verify that the offline-store policy contains the final union-lock hash, exact Product/ripple/CLI/local-tgz identities, complete sorted public package name/version/integrity set, exact accepted Node/npm/pnpm identities, the two closed version-proven `npm cache add` and `pnpm store add` command-grammar variant IDs, fixed public registry, and fixed output root, with no arbitrary argv, package range, `pnpm fetch`, or pnpm-lock input. Run the local synthetic grammar and network-guard contracts before authorization; an absent accepted pnpm binary, unsupported public `store add` grammar, package without exact integrity, or inability to enforce exact-origin/address-pinning on the accepted CLI is No-Go, not permission to improvise. Only then obtain authorization specifically for the direct-Node networked bootstrap. The authorization binds both policy hashes and all those identities, source/union-lock/fetcher/materializer/seeder/network-guard hashes, fixed preload and child argv variants, fixed registry, and output root; record its canonical ID as `DSH_PMWB_GATE_B_BOOTSTRAP_DECISION_ID`, then run directly without an outer npm process:

~~~bash
node scripts/gates/gate-b-bootstrap.mjs --bootstrap-decision-id "$DSH_PMWB_GATE_B_BOOTSTRAP_DECISION_ID"
~~~

Inspect its manifest, both policy bytes/hashes, archive URL hash label/SHA-256/length, manual initial/redirect observations, direct Node wrapper plus inherited fetcher/materializer and H1 seeder/network-guard source hashes, `/usr/bin/ditto -x -k` receipt, exact Node/npm/pnpm identities and fixed preload/package-manager argv receipts, exact public package/integrity set, exact-origin/address-pinning request receipt, sanitized environment receipt, zero-network disposable offline-install proof, and separate browsers/npm-cache/pnpm-store tree hashes without starting Harness, executing the extracted browser, or installing a plugin into any DSH profile. Prove the temporary archive, extraction staging, and disposable offline-install workspace are absent. Bootstrap success does not authorize Gate B. From this point onward the runner permits no external network; a later missing artifact is INCONCLUSIVE, not permission to fetch during the gate or invoke a stock Playwright downloader.

- [ ] **Step 4: Obtain three explicit and non-substitutable Gate B action decisions**

Obtain and record three separate canonical decisions. `DSH_PMWB_GATE_B_RUNTIME_DECISION_ID` covers only creation of the unique run root and isolated DSH_HOME/environment, loopback 3187, exact rc.6 launch, browser control, the fixed B01–B20 execution graph, and ordinary/final/failure cleanup through the authenticated, identity-revalidated, one-`SIGTERM`, bounded-no-escalation path from Task 7. `DSH_PMWB_GATE_B_INSTALL_DECISION_ID` covers only offline/no-script install, public remove/re-add, restart/remount sequencing, and cleanup of the exact audited Product tgz and, for B18, the exact H0-accepted ripple tgz inside that isolated profile. It does not authorize or claim an installed-but-disabled Product state. `DSH_PMWB_GATE_B_KILL_DECISION_ID` covers only the Task 7 ownership-verified process group's fixed B10 `SIGSTOP`/bounded stopped-state verification/`SIGKILL`/bounded disappearance sequence with literal `purpose: b10-storage-crash`. Require all three IDs to be distinct from each other and from package/bootstrap/import/union/hydration decisions and bind each to the frozen source, exact relevant artifacts, command graph, run boundary, and expiry/scope. None covers bootstrap/network access, the active profile, port 3080, any non-run-owned process, network providers, real data, evidence promotion, Git mutation, push, PR, merge, or publication.

- [ ] **Step 5: Run the real gate once authorized**

~~~bash
npm run gate:b -- --runtime-decision-id "$DSH_PMWB_GATE_B_RUNTIME_DECISION_ID" --install-decision-id "$DSH_PMWB_GATE_B_INSTALL_DECISION_ID" --kill-decision-id "$DSH_PMWB_GATE_B_KILL_DECISION_ID" --port 3187
~~~

The command generates the `runId`; the operator supplies no output path or manifest hash. It runs from the recorded clean frozen HEAD, copies only verified inputs into its new run root, and invokes real Playwright only inside this gate. After closing the attempt and publishing the pointer under `current-run.lock`, it prints exactly one bounded JSON object containing `runId`, `sourceCommit`, `runFinalSha256`, and `reportSha256`. Keep the pre-run `DSH_PMWB_H1_FROZEN_SOURCE_COMMIT` recorded in Step 1 immutable and require the printed `sourceCommit`, locked pointer, recomputed final marker, and current HEAD all to equal it; never overwrite that variable from runner output. Set only `DSH_PMWB_GATE_B_RUN_ID`, `DSH_PMWB_GATE_B_RUN_FINAL_SHA256`, and `DSH_PMWB_GATE_B_REPORT_SHA256` from the other printed values after independently recomputing the pointer and closure. These variables are equality assertions for promotion, never selectors. Expected PASS only if all B01–B20 checks are present and PASS, zero required assertion is skipped; all five package/bootstrap/runtime/install/kill decision IDs are present, distinct, correctly scoped and identical across result/report/JUnit/final marker; every import/union/hydration action and actually used network decision plus receipt hash agrees across prerequisite records and the closure; both reviewed policy hashes, browser archive/hash/length and exact allowed/observed origin chain, exact package/integrity set, npm/pnpm seeding/preload/network-origin receipts, zero-network offline proof, and browser/cache/store tree hashes recompute; source/lock/two-revision-fixture/golden-set/tgz/repository-core hashes recompute; arbitrary normalized identities have zero write; normalization-equivalent R1/R2 inputs map to the accepted identity; initialization/mutation/cleanup recovery and supporting ownership-verified real-storage hard-kill observations pass; storage atomicity evidence and resolved package identity recompute; exact accepted H0 and P1 evidence topologies revalidate; H0 fixed report/ledger blobs still derive `handoffManifestSha256FromAcceptedH0Evidence`; corresponding handoff export/import decision/manifest plus CLI/ripple/decision bindings recompute; listener table is loopback-only; external-network attempts are zero; every install/remove action used the isolated profile and install decision; every ordinary/final/failure stop used the runtime decision and fresh live ownership receipt, sent exactly one group `SIGTERM`, proved bounded child/descendant/listener disappearance, and never escalated automatically; every B10 `SIGSTOP`/`SIGKILL` used the separate kill decision, literal purpose, and live `HarnessProcessIdentity`; raw artifacts remain outside Git; and `result.json`, `report.md`, `junit.xml`, and final-written `run.final.json` agree in state, hashes, and process exit status. Otherwise retain FAIL/INCONCLUSIVE and stop. Even a failed attempt keeps its unique directory and closure files when the process can finish safely.

- [ ] **Step 6: Independently inspect the unique run and sanitized evidence**

Using the shared read-only pointer-lock helper, acquire `current-run.lock`, read `current-run.json` no-follow, confirm it names `DSH_PMWB_GATE_B_RUN_ID` plus the explicit frozen identities, verify `DSH_PMWB_GATE_B_RUN_FINAL_SHA256`, then verify the three artifact hashes inside that final marker before releasing the unchanged lock. Re-read both accepted H0 and P1 commit topologies and fixed Git blobs; derive `handoffManifestSha256FromAcceptedH0Evidence`; and recompute the sealed Gate A′ export/import manifests and handoff-import decision, Gate A′ report/final marker, accepted CLI closure, ripple acceptance/tgz/owner decision, both bootstrap policies, archive/redirect/browser tree, seeder package/integrity and npm-cache/pnpm-store closure, zero-network offline proof, storage atomicity evidence, exact storage package identity, package/bootstrap/runtime/install/kill decisions, pre-merge hydration/union-lock/final-hydration action receipts and each conditionally used network-decision receipt, and every process-ownership/purpose/ACK/drain/stopped-state/signal outcome rather than trusting a pointer, current-worktree document, environment value, or recorded caller hash to authenticate itself. Review `result.json` and `report.md` against raw artifacts without copying raw logs into Git. Re-run the redaction scanner. Confirm prior failures remain summarized, each PASS has a recomputable observation, and no fixture body/quote, raw PID/PGID/birth/sentinel, payload, token, cookie, stack, Domain path, browser session, archive URL, or local absolute path enters candidate documentation. A missing/stale pointer, contested/ambiguous lock, or incomplete four-file closure is INCONCLUSIVE.

Preview the exact review bytes without creating a candidate root or touching Git-tracked files:

~~~bash
node scripts/gates/render-gate-b-evidence-candidate.mjs --run-id "$DSH_PMWB_GATE_B_RUN_ID" --source-commit "$DSH_PMWB_H1_FROZEN_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_GATE_B_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_GATE_B_REPORT_SHA256" --preview
~~~

Capture the command's single bounded JSON result, independently recompute both candidate SHA-256/Git blob OIDs and canonical `candidateSetSha256`, and prove the fixed candidate root is still absent. Record the exact set hash as `DSH_PMWB_GATE_B_CANDIDATE_SET_SHA256`. Then obtain a fresh canonical candidate-materialization decision bound to the frozen source, `runId`, `run.final.json` hash, report hash, Product package manifest/tgz, every prerequisite/action/network decision and receipt consumed by the closure, canonical render-policy hash, the exact previewed set hash and two destination/path/SHA-256/Git-blob-OID tuples, fixed content-addressed root and three-file schema, expiry, and candidate-materialization-only scope. Record its canonical ID as `DSH_PMWB_GATE_B_CANDIDATE_MATERIALIZATION_DECISION_ID`; it is distinct from all earlier and later decisions and authorizes no tracked write or Git action.

Only after that decision exists, materialize exactly the previewed set:

~~~bash
node scripts/gates/render-gate-b-evidence-candidate.mjs --run-id "$DSH_PMWB_GATE_B_RUN_ID" --source-commit "$DSH_PMWB_H1_FROZEN_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_GATE_B_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_GATE_B_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_GATE_B_CANDIDATE_SET_SHA256" --candidate-materialization-decision-id "$DSH_PMWB_GATE_B_CANDIDATE_MATERIALIZATION_DECISION_ID"
~~~

Capture the materializer's single bounded JSON result, independently recompute `candidateReceiptSha256`, record it as `DSH_PMWB_GATE_B_CANDIDATE_RECEIPT_SHA256`, and verify exactly three immutable regular single-link files at `.tmp/dsh-pm-workbench/gate-b/promotion-candidates/<sourceCommit>/<runId>/<candidateSetSha256>/`. Require the receipt to bind the exact materialization decision and its authorization receipt, set hash, preview tuples, closure, root, schema, and locked pointer; no replay, replacement, extra file, or alternate root is accepted. A person must read both candidate documents byte-for-byte, compare them with the recomputed run/report and canonical render policy, rerun redaction against those exact bytes, and require their SHA-256/Git blob OIDs to equal `candidate-receipt.json`. No preview-only or result/report-only review can substitute. After that exact candidate review, obtain a canonical human-sanitization decision bound to the frozen source, `runId`, `run.final.json` hash, report hash, Product package manifest/tgz, prerequisite hashes, package/bootstrap/runtime/install/kill decisions, every pre-merge hydration/union-lock/final-hydration/handoff-import action and each actually used network decision/receipt, the observed sanitization outcome, canonical render policy, candidate-materialization decision and its authorization receipt, `candidateSetSha256`, exact candidate-receipt relative path/hash, both reviewed candidate SHA-256/Git blob OIDs, and exactly the two future output paths `docs/gate-results/dsh-pm-workbench-gate-b.md` and `docs/probe-results.md`; record it as `DSH_PMWB_GATE_B_REVIEW_DECISION_ID`. Review alone authorizes no tracked documentation write or Git action.

- [ ] **Step 7: Promote and commit evidence separately only after review**

Obtain a distinct evidence-write/commit decision bound to the same identities, candidate-materialization decision/receipt, `candidateSetSha256`, exact candidate-receipt path/hash and candidate bytes, the human-review decision, exactly the two documentation paths below, and the exact commit message. Record it as `DSH_PMWB_GATE_B_EVIDENCE_DECISION_ID`. It authorizes only deterministic promotion of those reviewed bytes, byte-equality checking, exact staging, and one local evidence commit; it does not authorize another candidate/run, a source/package/handoff edit, network, install, signal, push, PR, merge, tag, or publication.

~~~bash
npm run gate:b:promote -- --run-id "$DSH_PMWB_GATE_B_RUN_ID" --source-commit "$DSH_PMWB_H1_FROZEN_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_GATE_B_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_GATE_B_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_GATE_B_CANDIDATE_SET_SHA256" --candidate-materialization-decision-id "$DSH_PMWB_GATE_B_CANDIDATE_MATERIALIZATION_DECISION_ID" --candidate-receipt-sha256 "$DSH_PMWB_GATE_B_CANDIDATE_RECEIPT_SHA256" --human-review-decision-id "$DSH_PMWB_GATE_B_REVIEW_DECISION_ID" --evidence-decision-id "$DSH_PMWB_GATE_B_EVIDENCE_DECISION_ID"
git diff -- docs/gate-results/dsh-pm-workbench-gate-b.md docs/probe-results.md
git add -- docs/gate-results/dsh-pm-workbench-gate-b.md docs/probe-results.md
npm run gate:b:promote -- --run-id "$DSH_PMWB_GATE_B_RUN_ID" --source-commit "$DSH_PMWB_H1_FROZEN_SOURCE_COMMIT" --run-final-sha256 "$DSH_PMWB_GATE_B_RUN_FINAL_SHA256" --report-sha256 "$DSH_PMWB_GATE_B_REPORT_SHA256" --candidate-set-sha256 "$DSH_PMWB_GATE_B_CANDIDATE_SET_SHA256" --candidate-materialization-decision-id "$DSH_PMWB_GATE_B_CANDIDATE_MATERIALIZATION_DECISION_ID" --candidate-receipt-sha256 "$DSH_PMWB_GATE_B_CANDIDATE_RECEIPT_SHA256" --human-review-decision-id "$DSH_PMWB_GATE_B_REVIEW_DECISION_ID" --evidence-decision-id "$DSH_PMWB_GATE_B_EVIDENCE_DECISION_ID" --check
git rev-parse :docs/gate-results/dsh-pm-workbench-gate-b.md
git rev-parse :docs/probe-results.md
git diff --cached --name-only
git diff --cached --check
git diff --exit-code -- docs/gate-results/dsh-pm-workbench-gate-b.md docs/probe-results.md
git status --short
git commit -m "docs: record observed Gate B result"
git rev-list --parents -n 1 HEAD
git diff-tree --no-commit-id --raw -r -z "$DSH_PMWB_H1_FROZEN_SOURCE_COMMIT" HEAD
git rev-parse HEAD:docs/gate-results/dsh-pm-workbench-gate-b.md
git rev-parse HEAD:docs/probe-results.md
git status --short
~~~

`gate:b:promote` treats the four supplied closure identities plus candidate-set hash, candidate-materialization decision ID, and candidate-receipt hash as exact equality assertions under the Task 7 pointer lock, rechecks the complete closure and all three post-run decisions, and appends that exact `runId`; it never selects a directory by mtime or scans for a candidate. Capture the first invocation's single bounded promotion-receipt result, independently recompute its canonical SHA-256, and require its fixed path, candidate-materialization decision/receipt identities, two candidate SHA-256 values, and two Git blob OIDs to match the rendered files. The second invocation runs after staging and must prove a byte-identical rerender, immutable receipts, worktree bytes, and exact two index blobs without writing. Both `git rev-parse :<path>` outputs must equal the corresponding receipt OIDs; the no-unstaged-diff command must exit 0. Before promotion, HEAD must equal the frozen H1 source; before commit, the staged allowlist and index bytes must equal the receipt-bound Gate result and canonical status ledger exactly.

Parse every post-commit Git output rather than accepting its display alone: `rev-list` must return exactly `HEAD` plus one parent equal to `DSH_PMWB_H1_FROZEN_SOURCE_COMMIT`; the NUL-delimited raw `diff-tree` must contain exactly regular-file additions/modifications at `docs/gate-results/dsh-pm-workbench-gate-b.md` and `docs/probe-results.md`, with no rename, copy, mode/type substitution, submodule, or third path; both `git rev-parse HEAD:<path>` outputs must equal the same promotion-receipt OIDs already checked in the index; and status must be empty. Recompute the committed blob bytes' SHA-256 and require the receipt values too. A topology-valid commit with different blob bytes is rejected and cannot become accepted evidence. Root and package docs point to the ledger, while package-local text remains its immutable build-time statement. The evidence commit and promotion receipt name the frozen source commit, run ID, tgz hash, exact accepted H0 and P1 evidence topology receipts, both fixed H0 blob hashes, `handoffManifestSha256FromAcceptedH0Evidence`, CLI closure, storage atomicity evidence/package hashes, package/bootstrap/runtime/install/kill decisions, all pre-merge hydration/union-lock/final-hydration/handoff-import action and conditionally used network-decision/receipt identities, candidate-materialization decision/authorization receipt, `candidateSetSha256`, candidate-receipt hash, human-review decision ID, and evidence-write decision ID. If Gate B fails, the ledger says FAIL/INCONCLUSIVE and preserves the No-Go; it never edits the code commit or converts supporting static evidence into a pass.

- [ ] **Step 8: State only the allowed claim and stop**

Only if every check passes:

> DSH PM Workbench Alpha 在记录的 DeepSeek Harness 0.1.0-rc.6 组合、隔离 loopback profile 与合成 fixture 下，完成了引用式需求审阅和 Markdown PRD 的可安装端到端验收。

Explicitly state that real models, real interviews, another Harness version, remote/LAN use, multiple OS users, production readiness, safe purge, and public distribution were not established.

## Gate B check-to-test map

| Spec check | Required observation | Primary task and test |
| --- | --- | --- |
| B01 | Product tgz has nine endpoints and no Probe residue | Task 6, `product-build-closure.test.ts`, `product-tarball.test.ts` |
| B02 | Product health exact capabilities and limits | Task 4, `product-rpc-dispatcher.test.ts`; Task 8 product flow |
| B03 | Real Harness UI/Connection complete human flow | Task 8, `gate-b-product-flow.spec.ts` |
| B04 | Manifest/chunks verified before exact download | Task 8, `gate-b-product-flow.spec.ts` |
| B05 | Source pages reconstruct text and evidence locators | Task 8, `gate-b-product-flow.spec.ts` |
| B06 | Multi-page snapshots, mutation staleness, restart at page one | Task 8, `gate-b-pagination.spec.ts` |
| B07 | Cursor binding/HMAC/public continuation failures | Task 8, `gate-b-pagination.spec.ts` |
| B08 | Shape-valid correlation attacks fail Client validation | Task 8, `gate-b-protocol.spec.ts` |
| B09 | Exact fixture policy, wire/object limits and read-after-write closure | Tasks 3, 5, and 8, fixture/capacity/read-after-write tests |
| B10 | Fixed-intent physical quota, initialization/mutation/cleanup recovery, authoritative rc.6 atomic contract and supporting ownership-verified real hard-kill old/new observation | Tasks 1–3, 7, and 9, atomicity contract, `gate-b-process-ownership.test.ts`, and repository/storage recovery tests |
| B11 | CAS/idempotency/rejected receipts survive restart | Task 8, `gate-b-concurrency.spec.ts` |
| B12 | C1/C2 receipt replay never regresses UI | Task 8, `gate-b-concurrency.spec.ts` |
| B13 | Every no-receipt prerequisite and ledger saturation | Tasks 3 and 8, quota/concurrency tests |
| B14 | Four AbortSignal timings and exact-command reconciliation | Tasks 3, 4, and 9, abort/recovery tests |
| B15 | Cross-project/stale/actor/citation/injection rejection | Task 8, `gate-b-domain-invariants.spec.ts` |
| B16 | Complete restart persistence and cursor behavior | Task 9, `gate-b-recovery.spec.ts` |
| B17 | Component disposer/remount plus real public remove/re-add/restart lifecycle and retained data, reported separately | Tasks 5 and 9, lifecycle tests |
| B18 | Independent ripple on/off/removal coexistence | Task 9, `gate-b-theme-coexistence.spec.ts` |
| B19 | Full-chain canary and local-path non-disclosure | Tasks 4, 6, 7, and 9, redaction tests |
| B20 | Mounted keyboard/focus/status/reduced-motion and real 200% page-zoom/reflow acceptance | Task 9, `gate-b-accessibility.spec.ts` |

## H1 completion rule

Every specification §13.2 item must pass in the same recorded real-tgz, real-Harness, Product-only, isolated-profile run. Any unavailable/mismatched handoff, CLI or theme copy, unproven storage atomicity contract, real hard-kill third state, private API requirement, non-loopback requirement, endpoint failure, Probe residue, partial read, mixed snapshot, CAS/receipt duplicate, staging before intent, quota write before refusal, initialization ambiguity, accepted-before-cleanup response, ambiguous recovery, production-code mismatch, test seam in the tgz, repeated lifecycle registration, post-close write, removal data loss, canary leak, or skipped required assertion is Gate B No-Go.

~~~text
STOP — report observed evidence and wait for the owner.
Do not begin Gate M, Gate D, Gate E, active-profile installation, push, PR, merge, or publication automatically.
~~~
