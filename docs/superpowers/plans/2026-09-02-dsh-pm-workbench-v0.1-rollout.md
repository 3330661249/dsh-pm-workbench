# DSH PM Workbench v0.1 Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Deliver a privately installable, synthetic-data-only DeepSeek Harness 0.1.0-rc.6 Alpha that turns a fixed interview fixture into traceable evidence, human-reviewed requirements, a published requirement baseline, and deterministic cited Markdown PRD.

**Architecture:** Ship one Bundle with a modular-monolith core. Keep the shell-neutral React view behind WorkbenchApi and WorkbenchTransport, compile Probe and Product endpoint registries as separate closed worlds, keep Host-owned state behind repository ports, and admit Harness integration only through public Connection RPC, additive slots, and storageDomain.

**Tech Stack:** TypeScript 6.0.3, Node.js 24.14.0, React 18.3.1, Vitest 3.2.7, esbuild 0.25.12, Zod 4.4.3, DeepSeek Harness 0.1.0-rc.6 public packages, jsdom 26.1.0, Playwright Test 1.62.1.

**Spec:** ../specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md

**Plan status:** Written after owner approval of the architecture specification. This plan set is pending owner review and does not authorize implementation, dependency installation, Harness startup, profile installation, push, Pull Request, merge, model use, real-data use, or publication.

## Global Constraints

- The only supported Host target in v0.1 is DeepSeek Harness 0.1.0-rc.6.
- Gate A′ and Gate B may run only in a repository-local temporary DSH_HOME created for that run.
- Harness gates use ports 3186 and 3187 by default; port 3080 is forbidden.
- Harness gates bind only 127.0.0.1, use trustedHosts=[], and register Connection RPC with authority: loopback.
- A runtime that requires 0.0.0.0, LAN access, trusted-host, reverse proxy, tunnel, shared /api interception, or a bare HTTP fallback is a No-Go.
- Gate D has not been authorized. The only admitted source-content identities are the two exact normalized hashes derived from the owner-accepted `fixtures/synthetic/pm-discovery-v1.input.md` and `fixtures/synthetic/pm-discovery-v1.r2.input.md`. The strict loader separately requires the repository fixture/golden files to match their accepted raw bytes. A pasted or selected UTF-8 byte sequence that differs only by the specified BOM/LF/NFC normalization is the same admitted content identity; every other normalized TXT/MD identity is rejected by the application service before a project, source, receipt, or version write.
- Gate M has not been authorized. Do not add a model SDK, provider adapter, credential reader, model call, external HTTP call, Agent, Subagent, or Run orchestrator.
- Do not read, modify, stop, restart, probe, install into, or reuse the active 127.0.0.1:3080 service or any user profile under ~/.dsh.
- Do not read Downloads, Desktop, clipboard, existing Workspaces, Sessions, chat history, browser state, recordings, real transcripts, or real interview documents.
- H0 may obtain the rc.6 CLI only through a separate owner decision naming one exact standalone artifact. The acceptance step may execute only that artifact's sealed entry with `--version` in a filtered environment, then must copy and hash its complete lock-described runtime closure. PATH lookup, a global install, an active checkout, an unfrozen dependency graph, and later replacement by a nearby CLI are forbidden. H1 may consume that CLI only through the owner-selected sealed Gate A′ handoff.
- The existing ripple theme stays independently packaged, configured, stored, enabled, disabled, and removed. Coexistence tests use an explicitly reviewed isolated copy.
- Every dependency or browser bootstrap is a separately authorized preparation step whose direct-Node repository wrapper validates a canonical decision before allocating output. It uses a marker-owned HOME/XDG/cache, distinct empty marker-owned `NPM_CONFIG_USERCONFIG` and `NPM_CONFIG_GLOBALCONFIG` files, exact locked tools, `--ignore-scripts`, inherited auth/token/proxy/provider/`NODE_OPTIONS`/npm-config stripping, and bounded sanitized output. A Chromium bootstrap uses the repository-owned downloader/materializer and one fixed owner-reviewed policy binding the exact archive URL, allowed HTTPS initial/redirect origins, redirect ceiling, expected length/SHA-256, archive layout, executable relative path, tool, and revision; inherited Playwright download-host, proxy, custom-CA, registry, credential overrides, stock Playwright download, and outer npm launch are rejected. Gate A′ and Gate B themselves remain offline except for numeric loopback.
- P1 browser work has three separate scopes: browser bootstrap, bounded development browser execution, and the final frozen acceptance run. Its 200% case must use measured native Chromium page zoom on an unchanged 1024×768 configured viewport and complete the keyboard flow; CSS zoom, transforms, device-scale emulation, viewport reduction, and screenshot scaling are not evidence. An unsupported or unmeasured native zoom is INCONCLUSIVE.
- H1 storage may not write a staging record until one fixed, discoverable prepared intent durably names every possible staged key. Initialization, mutation, root replacement, cleanup, physical-quota recount, and repeated recovery must all fail closed. The exact resolved rc.6 public storage primitive needs independently frozen semantic evidence plus a real isolated old-or-new hard-kill observation; an unproved or torn replacement is H1 No-Go.
- H0 compiles only ProbeEndpointTypes. H1 compiles only ProductEndpointTypes. There is no runtime phase switch and no union registry.
- Plugin byte limits measure canonical endpoint-plus-payload and WorkbenchOutcome JSON UTF-8 bytes. They do not establish a whole Connection carrier or rpcId limit.
- Loopback and cursor HMAC are local trust controls, not identity authentication.
- Typecheck, unit tests, build output, config discovery, package listing, screenshots, and agent reports are supporting evidence only. They cannot independently pass Gate A′, P0, P1, or Gate B.
- Every gate records failures. SKIPPED, timeout, missing tools, missing evidence, and unknown environment are INCONCLUSIVE and therefore No-Go.
- Gate C/M, Gate D, and Gate E are outside this plan set.

---

## 1. Why this is a plan set

The approved specification contains four independently rejectable systems plus one shared static foundation:

1. phase-neutral transport primitives and compiler/test boundaries;
2. a public Harness transport and lifecycle probe;
3. a pure evidence and requirement domain;
4. a shell-neutral human-review interface;
5. a production repository and real Harness composition.

Putting them into one uninterrupted checklist would let one approval accidentally carry across incompatible risk boundaries. This index therefore delegates execution detail to five self-contained plans:

| Phase | Plan | Depends on | Ends with |
| --- | --- | --- | --- |
| F0 | [Shared Foundation](./2026-09-02-dsh-pm-workbench-v0.1-f0-shared-foundation.md) | approved spec and approved F0 execution | clean phase-neutral source commit plus a canonical-ledger evidence commit naming that source, then STOP |
| H0 | [Gate A′ Connection RPC Probe](./2026-09-02-dsh-pm-workbench-v0.1-h0-connection-rpc-probe.md) | exact accepted F0 evidence tip, its recorded F0 source commit, and approved H0 execution | content-addressed audited Probe tgz, owner-selected sealed rc.6 CLI/ripple inputs, real-tgz Gate A′ run, sealed cross-worktree handoff, and evidence commit binding that handoff, then STOP |
| P0 | [Evidence Core](./2026-09-02-dsh-pm-workbench-v0.1-p0-evidence-core.md) | exact accepted F0 evidence tip, its recorded F0 source commit, and approved P0 execution | deterministic synthetic golden evidence, then STOP |
| P1 | [Shell-neutral Review UI](./2026-09-02-dsh-pm-workbench-v0.1-p1-review-ui.md) | accepted P0 evidence and approved P1 execution | real-browser shell-neutral evidence, then STOP |
| H1 | [Plugin Alpha and Gate B](./2026-09-02-dsh-pm-workbench-v0.1-h1-plugin-alpha.md) | exact accepted Gate A′ evidence commit whose report and canonical ledger agree on `handoffManifestSha256`, accepted P0/P1 evidence, plus separate H1 authorization | explicit two-parent integration record, audited Product tgz, real-tgz Gate B evidence, then STOP |

H0 and P0 may be implemented independently from the same exact accepted F0 **evidence tip** after recording the F0 source commit named by its canonical-ledger entry. They do not depend on each other's endpoint registry or evidence result. P1 depends on P0. Gate A′ follows one non-circular chain: run closure → human sanitization decision → separately authorized sealed handoff export → promoter revalidation and identical `handoffManifestSha256` in the fixed Gate A′ report plus canonical ledger → evidence-only commit. H1 may begin only after that exact H0 evidence commit and the accepted P0/P1 evidence identify the code being combined; it reads the handoff hash from the accepted H0 Git blobs rather than from an out-of-band selection. The external handoff is not another H0 Git commit.

## 2. Authorization ladder

| Checkpoint | Current state | A later explicit owner decision is required for |
| --- | --- | --- |
| Architecture specification | Approved on 2026-09-02 | none; it is the design baseline |
| This implementation plan set | Pending owner review | any implementation |
| Worktree creation | Not authorized | creation-only isolation at an owner-approved external root; no setup command, `.gitignore` edit, or fallback to the active checkout |
| Exact-lock worktree hydration | Not authorized | each phase's own worktree-local `node_modules` write against its accepted lock under an action decision bound to one closed offline-first/verified-cache-miss/one-public-registry-retry state machine; stage two also requires a distinct network decision bound to that immutable miss receipt and exact retry argv |
| F0 shared foundation | Not authorized | common protocol, safe exact-dependency installer, policy downloader/materializer tooling, compiler/test graph |
| F0 exact dependency lock | Not authorized | isolated exact Zod install/lock mutation under one action decision and public-registry access under a distinct network decision |
| F0 static verification | Not authorized | run the fixed foundation graph once from a frozen source and create its four-file local closure; no dependency, browser, Harness, evidence, or Git action |
| F0 evidence recording | Not authorized | preview the canonical-ledger candidate without writing, bind its exact byte hash in the evidence decision, write and receipt it, then verify the index and committed blob against that receipt |
| H0 code | Not authorized | Probe code and build-boundary changes |
| H0 exact dependency lock | Not authorized | hydrate the accepted F0 lock under an H0 action decision, then install the fixed rc.6/Playwright/jsdom set and mutate the H0 manifest/lock under a different action decision; each public-registry action needs its own non-substitutable network decision |
| H0 Probe package freeze | Not authorized | build and audit a content-addressed Probe tgz from a clean frozen H0 commit |
| rc.6 CLI artifact acceptance | Not authorized | inspect one owner-selected standalone rc.6 artifact, run only its sealed entry with `--version`, and copy/hash its complete exact-lock runtime closure; no PATH/global/active-profile fallback |
| Ripple input acceptance | Not authorized | copy and hash one owner-selected standalone theme tgz outside active profiles |
| Gate A′ bootstrap | Not authorized | through the direct-Node repository downloader/materializer, prepare exact caches and Chromium under a marker-owned, empty-config, secret-stripped environment and one owner-reviewed content-hashed URL/origin/redirect/archive policy; no outer npm, inherited download-host/proxy/custom-CA override, Harness launch, or profile install |
| Gate A′ runtime | Not authorized | create isolated DSH_HOME, bind 3186, start Harness, and execute the fixed Probe plus accepted-ripple install/remove/re-add/restart/remount/cleanup graph; it makes no separate installed-but-disabled claim |
| Gate A′ human sanitization | Not accepted | review one exact completed run/report and bind the decision to its frozen source, run ID, final-marker hash, report hash, and sanitization outcome |
| Gate A′ handoff export | Not authorized | after human sanitization of one exact completed run, seal its four-file closure, package, accepted CLI, bootstrap manifest, and ripple inputs below the independently derived repository-family root; an owner-supplied root is equality-only, with no network, profile, Git mutation, or package install |
| Gate A′ evidence promotion | Not authorized | revalidate the sealed handoff, preview and decision-bind both candidate hashes, render the same `handoffManifestSha256`, finalize a promotion receipt, then verify render, index blobs, committed blobs, and topology |
| P0 code | Not authorized | domain, fixture engine, in-memory service |
| P0 acceptance run | Not authorized | execute the frozen P001–P018 synthetic command graph once under its own canonical runtime decision and create one local closure; no browser, Harness, evidence, or Git action |
| P0 human evidence review | Not accepted | review one exact completed synthetic run/report and bind the decision to its frozen source, run ID, final-marker hash, report hash, and sanitization outcome |
| P0 evidence promotion | Not authorized | use candidate-bound human/evidence decisions to render only the fixed P0 result and ledger, finalize a promotion receipt, and verify rendered, staged, and committed bytes |
| P1 code | Not authorized | React workbench, DOM and browser test dependencies |
| P1 browser bootstrap | Not authorized | direct-Node repository downloader/materializer preparation under one owner-reviewed content-hashed URL/origin/redirect/archive policy; no outer npm or inherited download-host/proxy/custom-CA override |
| P1 development browser runs | Not authorized | Tasks 1–8 fixed shell-neutral loopback server and Chromium tests from the accepted immutable browser manifest |
| P1 acceptance run | Not authorized | Task 9's closed P101–P110 browser run and four-file closure; no document promotion or Git write |
| P1 human evidence review | Not accepted | review one exact completed run/report and bind the decision to its frozen source, run ID, final-marker hash, report hash, and sanitization outcome |
| P1 evidence promotion | Not authorized | use candidate-bound human/evidence decisions to render only the fixed P1 result and ledger, finalize a promotion receipt, and verify rendered, staged, and committed bytes |
| H1 code | Not authorized | production repository, Product RPC and real overlay assembly |
| H1 union-lock reconstruction | Not authorized | consume the verifier-derived exact-union path/hash under one action decision; any public-registry retry needs its own non-substitutable network decision |
| H1 union-lock hydration | Not authorized | hydrate the reconstructed union lock under a separate action decision; its public-registry retry uses a fourth, separately bound network decision |
| H1 sealed-handoff import | Not authorized | import only the exact H0-evidence-derived sealed bundle into the H1 worktree under its own source/root/manifest-bound decision; no runtime, package install, Git mutation, or alternate path |
| H1 Product package freeze | Not authorized | build and audit a content-addressed Product tgz from a clean frozen H1 commit |
| Gate B bootstrap | Not authorized | direct-Node Chromium plus npm-cache/pnpm-store preparation under separate frozen browser/offline-store policies, fixed reviewed URL/origins/redirect/archive and exact package/version/integrity sets, hash-bound network guard, marker-owned empty configuration, inherited-secret stripping, offline-install proof, and bounded sanitized output; no outer npm, Harness launch, profile install, `pnpm fetch`, implicit pnpm lock, or unreviewed package-manager argv |
| Gate B runtime | Not authorized | create the unique run/DSH_HOME boundary, bind 3187 loopback, start and ordinarily stop the isolated Harness, drive the browser, and orchestrate B01–B20; it does not itself authorize package lifecycle or intentional signals |
| Gate B isolated package lifecycle | Not authorized | offline/no-script install, public remove/re-add, restart/remount, and cleanup of only the exact audited Product and accepted ripple artifacts inside that isolated profile; component lifecycle tests separately drive Cordis disposer/remount hooks and no real installed-but-disabled state is claimed without a verified public action |
| Gate B intentional stop/kill/restart | Not authorized | ordinary/final/failure stops use runtime-decision-bound authenticated readiness, fresh identity/member revalidation, exactly one negative-PGID SIGTERM, and bounded group/listener disappearance with no automatic escalation; timeout remains INCONCLUSIVE. At B10's declared atomicity barrier only, a distinct kill decision permits an ACKed post-invocation begin → identity-revalidated group SIGSTOP → stopped-state event-channel drain/no-return proof → revalidation → SIGKILL/disappearance sequence, followed by same-profile restart and exact old-or-new observation; no name/port/self/external target |
| Gate B candidate materialization | Not authorized | after a zero-candidate-output preview freezes the exact two path/SHA-256/Git-blob-OID tuples and `candidateSetSha256`, validate and atomically consume a fresh source/closure/render/root/schema-bound decision before creating the fixed content-addressed candidate root, two review documents, or final candidate receipt; this is separate from the five Gate action decisions and authorizes no tracked-file or Git write |
| Gate B human sanitization | Not accepted | review the exact authorized persistent candidate bytes and bind the decision to their candidate-materialization decision/authorization receipt, candidate receipt/hash, set hash, frozen source, run ID, final-marker/report/tgz/prerequisite hashes, and sanitization outcome |
| Gate B evidence promotion | Not authorized | use evidence and human-review decisions bound to the same materialization decision/receipt and candidate bytes to render only the fixed Gate B result and ledger, finalize a promotion receipt, and verify rendered, staged, and committed bytes |
| Git remote operations | Not authorized | push, create/update PR, merge, tag or release |
| Model use | Not authorized before Gate M | model SDK, provider, token or real response |
| Real data | Not authorized before Gate D | any real interview or identifying material |
| Distribution | Not authorized before Gate E | public repo, license grant, npm publish, marketplace or release |

An implementation approval must name the phase. Approval of F0 does not authorize H0 or P0; approval of H0 does not authorize P0, P1, or H1. Approval of code does not automatically authorize a real Harness or browser run. Every decision above receives a canonical ID bound to its exact source, artifacts, action graph, outputs, expiry, and scope; IDs required by the same gate are distinct, are passed to the responsible repository wrapper, and are recorded in its path-free receipt and resulting closure/evidence. A wrapper validates authorization before allocating action output. npm/Playwright/system-tool child argv never receives an arbitrary decision argument. One decision cannot substitute for another.

Each H0/H1 package-freeze approval binds one full clean source commit, the exact Probe/Product target, the committed lock, fixed no-script pack argv, and a marker-owned content-addressed output root. It authorizes neither dependency/network activity nor bootstrap, Harness/profile access, browser execution, publication, or a later changed HEAD. Runner or test commits made after an earlier package invalidate that package for the final gate and require a renewed freeze authorization.

## 3. Branch and worktree policy for later execution

Execution starts only after owner approval and must use `superpowers:using-git-worktrees` for isolation detection and creation **only**. This plan explicitly overrides that skill's automatic Project Setup step: never run its bare `npm install`, never let worktree creation edit/commit `.gitignore`, and never accept its fallback to the active checkout. The current repository has no pre-approved ignored `.worktrees` directory, so the owner must approve a creation-only external worktree root first. If the available native/manual mechanism cannot suppress setup or would require an unplanned baseline commit, stop.

Every phase hydrates its own exact accepted lock into its own worktree before any npm/Vitest/TypeScript command; another checkout's `node_modules`, cache success, or earlier phase hydration never carries authorization or evidence forward. Invoke the audited installer through its direct-Node repository entry rather than an outer npm script. The phase-specific action decision binds one closed state machine: exact offline-first argv, immutable classified-miss receipt, and at most one exact public-registry retry. The first invocation cannot retry online. Stage two accepts the unchanged action ID only because that ID names the complete state machine, and additionally requires a distinct network decision bound to the first-stage miss and second-stage argv. The wrapper validates the action before either output allocation, validates the miss plus network extension before a network child, rejects direct stage-two entry or source/lock/output/argv drift, and records path-free receipts; its npm child never sees the IDs. The child uses marker-owned HOME/XDG/cache/empty user and global npm configuration, exact `npm ci --ignore-scripts --no-audit --no-fund` planning with only the selected offline/public-registry mode, a fixed registry, filtered inherited environment, unchanged manifest/lock hashes, and integrity checks. It rejects any package/CLI whose realpath is outside the current worktree's own real, non-symlink `node_modules`; the external worktree root must also have no ancestor `node_modules`. F0 bootstraps and tests the installer with Node built-ins before ordinary project dependencies exist.

H1 has two independent hydration boundaries. First hydrate the exact accepted P1 lock immediately after creation so the pre-merge verifier can run. The composition verifier then derives one canonical, content-addressed `.tmp/dsh-pm-workbench/h1/exact-unions/<unionManifestSha256>/exact-union.json` from the two accepted Git trees. After the merge, the audited direct-Node installer must consume that exact path/hash under a lock-reconstruction action decision bound to the closed offline-first/verified-miss/one-network-retry state machine for the two fixed `--package-lock-only` argv forms; stage two additionally requires its own lock-network decision bound to the immutable stage-one miss. Then exact-lock hydration uses a different action decision bound to the corresponding closed two-stage hydration state machine; its stage two requires a fourth hydration-network decision bound to that action's own miss and retry argv. No merged-tree npm/Vitest/TypeScript/build/package command may run first, and the pre-merge dependency tree cannot satisfy the union. Both action receipts, both optional network receipts, manifest/lock hashes, and realpath/integrity closure enter the composition record. None of the four decisions, state machines, or miss receipts can substitute for another.

F0's phase-neutral bootstrap tooling owns the real download boundary used by H0, P1, and H1. A phase wrapper is invoked directly by the accepted Node binary, reads one fixed owner-reviewed policy as a same-read regular file, and uses the repository downloader rather than Playwright's stock downloader. The policy fixes the archive URL, non-empty ordered exact HTTPS origin allowlist, redirect ceiling, expected archive length/SHA-256, archive format/root/executable relative path, tool identity, and browser revision. Each initial or redirect URL is validated before body bytes; userinfo, downgrade, unlisted origin, loop, overflow, length/hash mismatch, partial transfer, or policy drift removes staging and fails closed. The fetcher keeps one exclusive no-follow archive descriptor and immutable device/inode identity through stream, fsync, exact hash/length, ZIP preflight, and extraction. From that same descriptor the materializer cross-checks every central-directory record with its local header, including filename/flags/compression/CRC/sizes/offset/data interval; decompresses each supported regular-file interval to verify CRC/size and record a content hash; and rejects absolute/escaping/backslash/NUL/empty/duplicate/case-or-Unicode-colliding paths, encrypted/data-descriptor/ZIP64/multi-disk/sparse/truncated/overlapping/ambiguous/link/special/unsupported-compression/unexplained-trailing-data entries, extra roots, or size/count/ratio overflow. It unlinks the archive name, maps the retained descriptor to child fd 3, and uses only fixed `/usr/bin/ditto -x -k /dev/fd/3 …` on an accepted Darwin/ditto identity whose fd binding passed a production-entry synthetic capability check. The no-follow post-walk must equal every preflight path/type/mode/size/content hash before atomic publication. Production-entry loopback redirect, archive, fd-substitution, and entry-content tests prove this seam. No plan may substitute a pathname reopen, stock `playwright install`, an inherited proxy/download host/custom CA, or an outer npm process for this mechanism.

Gate B adds one H1-owned offline-store seeder because F0's npm-only lock hydrator is not a pnpm-store producer. A second owner-reviewed policy binds the frozen union-lock, Product/ripple/CLI artifacts, the complete sorted exact package name/version/integrity set, accepted Node/npm/pnpm JavaScript entry identities and version-proven command-grammar IDs, the sole public registry, and one marker-owned output root. The direct-Node wrapper launches each accepted package-manager JavaScript entry only through the accepted Node plus a source-hash-verified network-guard preload. That guard permits only the policy's exact HTTPS registry origin, pins validated public DNS results to the connected peer, rejects rebinding/private/loopback/link-local/reserved/direct-IP/cross-origin paths, disables unchecked redirects and descendant spawn, and records a bounded path-free origin/address receipt. Fixed code-owned argv run sorted exact packages through `npm cache add` and `pnpm store add`; `pnpm fetch`, `--lockfile-dir`, an implicit/generated `pnpm-lock.yaml`, range/tag input, lifecycle scripts, PATH shims, outer package managers, or caller-supplied argv are forbidden. After networking closes, a disposable no-script offline install must reproduce the exact closure from both candidate trees with zero request attempts before the browser, npm-cache, and pnpm-store trees are atomically published and bound in the bootstrap manifest. A zero exit or nonempty directory alone is not evidence of a usable store.

F0 uses the reviewed documentation baseline and ends with a clean source commit followed by its canonical-ledger evidence commit. H0 and P0 each branch from that exact accepted F0 **evidence tip**, record and revalidate the F0 source commit named by the ledger, and then diverge under separate authorizations; neither branches directly from an unrecorded source-only tip. P1 branches from the exact accepted P0 evidence tip. H1 follows its Task 0 composition protocol: start from the exact accepted P1 evidence tip and first prove from Git objects that it has exactly one parent equal to the P1 frozen source and a raw NUL diff of exactly the fixed P1 report/ledger regular files; then prepare and commit the staged-tree composition verifier. It accepts the exact Gate A′ evidence commit as a second parent only after equivalent Git-object checks prove one parent equal to the H0 frozen source named by both fixed evidence blobs and exactly those two evidence paths. It merges that commit under the narrow conflict allowlist, reconstructs and hydrates the union lock under distinct decisions, imports the exact sealed handoff under another decision, commits the two-parent merge, then creates the specified documentation-only composition-record commit containing all path-free receipts. The allowlist includes the overlapping root/package status documents; their only accepted resolution is a verifier-computed deterministic union that preserves both parents' evidence and boundaries, keeps package text build-time-only, and leaves the combined H1 tree/Gate B as NOT_RUN. `package-lock.json` may differ without a textual Git conflict only when the exact union-lock reconstruction computes and verifies that difference. The Gate A′ hash authority is the fixed report and canonical-ledger blobs in that exact H0 evidence commit. Its sealed artifact import is a verified, decision-bound worktree-local input recorded by the composition commit; it is not a third parent or an independent "handoff commit." Any production-source conflict returns to the owning phase instead of being resolved in H1.

| Phase | Default local branch |
| --- | --- |
| F0 | codex/pmwb-f0-shared-foundation |
| H0 | codex/pmwb-h0-connection-probe |
| P0 | codex/pmwb-p0-evidence-core |
| P1 | codex/pmwb-p1-review-ui |
| H1 | codex/pmwb-h1-plugin-alpha |

Do not create stacked remote PRs automatically. H1 must identify the exact accepted H0, P0, and P1 commits it combines. A local commit is not permission to push it.

## 4. Locked source layout

All publishable source remains under packages/workbench/src:

~~~text
packages/workbench/src/
├── domain/
├── application/
├── modules/
│   ├── intake/
│   ├── analysis/
│   ├── review/
│   └── prd/
├── ports/
│   ├── workbench-transport.ts
│   └── protocol/
├── adapters/
├── integration/
│   └── harness-rc6/
└── client/
~~~

Shared wire contracts live in ports/protocol. Tests and reviewed fixtures live at repository root:

~~~text
tests/
fixtures/synthetic/
scripts/fixtures/
~~~

Do not create a repository-root src directory. Do not use fixtures/interviews because interviews is deliberately ignored and reserved for material that must never enter Git.

Automatic runners may write only beneath:

~~~text
.tmp/dsh-pm-workbench/
packages/workbench/lib/
~~~

Strict fixture and golden loaders accept only non-symlink regular files, require the resolved path to remain under the declared immutable input root, bind `lstat`/open/`fstat` identity, read each file once, and hash those same bytes. Artifact-reading tests must create and own a unique temporary build/package directory; no test may depend on a pre-existing `lib`, tgz, manifest, or another test's execution order. Content-addressed packages and immutable inputs live only beneath:

~~~text
.tmp/dsh-pm-workbench/probe-packages/<sourceCommit>/<tgzSha256>/
.tmp/dsh-pm-workbench/product-packages/<sourceCommit>/<tgzSha256>/
.tmp/dsh-pm-workbench/gate-inputs/<kind>/<inputId>/
.tmp/dsh-pm-workbench/gate-a/runs/<runId>/
.tmp/dsh-pm-workbench/gate-b/runs/<runId>/
~~~

H0 and H1 share no ordinary worktree-local `.tmp`. Both exporter and importer run fixed `git rev-parse --path-format=absolute --git-common-dir`, reject a bare repository, and require two byte-identical `git worktree list --porcelain -z` reads. They resolve `commonDirRealpath`, set `primaryCheckout = realpath(dirname(commonDirRealpath))`, require it exactly once in the resolved stable worktree set, and derive:

~~~text
familyId = sha256(commonDirRealpath)
derivedSharedRoot = <parent-of-primary-checkout>/.dsh-pm-workbench-handoffs/<familyId>
<derivedSharedRoot>/dsh-pm-workbench/gate-a/<sourceCommit>/<runFinalSha256>/<handoffManifestSha256>/
~~~

The derived root must be outside and not contain any enumerated checkout, have no symlink component, and carry a marker binding only the path-free family identity. An owner- or caller-supplied `--handoff-root` never chooses or alters the destination; after canonicalization it is accepted only when it equals the independently derived root byte-for-byte. A mismatch, bare/ambiguous primary checkout, different common-dir family, or worktree-list drift is No-Go.

After Gate A′ closes one run and a human accepts its exact sanitized `runId`/`runFinalSha256`, H0's sole exporter may, under a separate decision, write one manifest-last content-addressed bundle to that derived root. `handoff-manifest.json` binds the four-file closure, clean frozen H0 source, Probe package manifest/tgz, owner-accepted rc.6 CLI acceptance plus complete closure, bootstrap manifest, ripple acceptance manifest/tgz, sanitization/export decisions, path-free family identity, relative modes, and every carried-file hash. Because the handoff precedes promotion, it deliberately excludes the future promoted Git report, canonical ledger, and evidence commit; no future Git identity may be referenced from the manifest.

The promoter then derives the same root independently, locates only the exact `handoffManifestSha256`, validates every non-symlink regular-file/realpath/same-read/mode/hash entry against the completed run and decisions, and first renders both proposed documents twice in memory without writing. The evidence decision binds those two fixed path/SHA-256 pairs and their canonical set hash. Write mode renders that same handoff hash into `docs/gate-results/gate-a-connection-rpc.md` and the root canonical ledger and finalizes an immutable promotion receipt outside Git. Only after `--check`, staged-index blob, committed-blob, and one-parent/two-path topology verification all match that receipt may those files form a Gate A′ evidence candidate. H1 reads the hash and candidate identities from both fixed blobs of that exact owner-accepted H0 evidence commit, requires equality, derives the same root, and copies the sealed bundle once into its worktree-local immutable input root. It never reads H0's `.tmp`, follows a reference back to H0, accepts a partial tree, or chooses a caller hash/path, "current", "latest", or mtime. This is a non-Git artifact handoff with a one-way evidence binding; there is deliberately no standalone handoff commit.

The existing scripts/workspace-boundary.ts guard remains authoritative. Gate runners never write directly into docs. The only H0 order is run → human sanitization → separate export → promoter verifies handoff and writes the same `handoffManifestSha256` to report plus ledger → evidence commit → H1 import from that exact accepted commit.

The following historical evidence remains read-only:

~~~text
tools/typert-version-matrix/**
docs/matrix-results/**
docs/reviews/2026-09-02-version-matrix-adversarial-review.md
~~~

Connection RPC success would not rewrite the historical generated-Typert No-Go.

## 5. Cross-phase interfaces

These names are frozen by the specification and must not drift between plans:

~~~ts
export interface WorkbenchTransport<R> {
  request<E extends Extract<keyof R, string>>(
    endpoint: E,
    input: InputOf<R, E>,
    signal?: AbortSignal,
  ): Promise<WorkbenchTransportResult<OutputOf<R, E>>>
}

export type ProbeTransport = WorkbenchTransport<ProbeEndpointTypes>
export type ProductTransport = WorkbenchTransport<ProductEndpointTypes>
~~~

ProbeEndpointTypes contains exactly:

~~~text
health
counter.increment
~~~

ProductEndpointTypes contains exactly:

~~~text
health
projects.list
projects.get
projects.readCollection
sources.getRevision
sources.readSegments
projects.command
artifacts.getMarkdownManifest
artifacts.readMarkdownChunk
~~~

The UI consumes WorkbenchApi. It never imports Harness Context, storageDomain, Node built-ins, ctx.connection, or a raw fetch client. H1 replaces transport, repository, and shell adapters while reusing the P0 application service and P1 WorkbenchView.

## 6. Dependency decisions to verify before first code

The plan pins versions so a later executor does not choose latest:

| Package | Planned role | Exact implementation-time version |
| --- | --- | --- |
| zod | shared runtime request/output schemas | 4.4.3 |
| @deepseek-ai/dsh-client-connection | public Host and Client Connection RPC types/services | 0.1.0-rc.6 |
| @deepseek-ai/dsh-storage-domain | public Host storageDomain type/service | 0.1.0-rc.6 |
| @deepseek-ai/dsh-client-runtime | Client Context and slots service | 0.1.0-rc.6 |
| @deepseek-ai/dsh-client-ui-layout | shell.overlay declaration | 0.1.0-rc.6 |
| @deepseek-ai/dsh-client-ui-sidebar | sidebar.footer.action declaration | 0.1.0-rc.6 |
| @deepseek-ai/dsh-client-ui-slots | slot registration types | 0.1.0-rc.6 |
| @playwright/test | isolated browser acceptance | 1.62.1 |
| jsdom | explicit DOM environment for focused React tests | 26.1.0 |

Before H0 changes its manifest or lockfile, its compile-only surface check must prove that the exact rc.6 public packages expose:

~~~ts
ctx.connection.rpc.handle(channel, handler, { authority: 'loopback' })
ctx.connection.rpc.call(channel, endpoint, payload, signal)
ctx.storageDomain.open(spec)
ctx.slots.inject('sidebar.footer.action', callback)
ctx.slots.register({ name: 'shell.overlay', id: 'pm-workbench-overlay' }, component)
~~~

If the exact public surfaces differ, stop and return to design review. Do not use a deep private import, copy a protocol, broaden the peer range, or upgrade Harness to make the plan appear executable.

## 7. Build targets and phase closure

The later build script must require an explicit compile-time target:

~~~text
probe
product
~~~

The target selects disjoint entry graphs. There is no environment setting, profile option, RPC call, or user switch that changes a running package between them.

H0 uses:

~~~text
packages/workbench/src/integration/harness-rc6/probe/index.ts
packages/workbench/src/client/probe/index.tsx
~~~

H1 uses:

~~~text
packages/workbench/src/index.ts
packages/workbench/src/client/index.tsx
packages/workbench/src/internal/repository-core.ts
~~~

The Product tarball audit fails on the byte strings and module inputs for:

~~~text
counter.increment
ProbeEndpointTypes
ProbeHealthOutput
ProbeWorkbenchApi
gate-a-probe
tests/support/faulting-storage-domain-driver
testQuotaOverrides
~~~

Tree shaking alone is not proof. The build emits a repository-relative esbuild metafile, and the package verifier checks both the module graph and final bytes.

H1 repository work begins only after its Task 1 freezes two independent facts for the exact resolved rc.6 storage package: the public type surface and authoritative evidence that the chosen single-key global-root replacement is atomic. A type signature, memory driver, normal restart, package version alone, or implementation assumption cannot establish atomicity. If authoritative evidence is absent or conflicts with the resolved bytes, H1 stops before repository implementation; Gate B later adds a real isolated hard-kill old-or-new observation but cannot manufacture the missing public contract.

Initialization and every mutation use the same discoverability rule: before any catalog/project/receipt/staging record is written, one fixed pending-intent key must durably list every prospective key, generation, expected byte count, command identity, and recovery action. Capacity refusal happens before that intent write. Recovery and physical quota accounting use only the committed root plus the fixed intent, never table enumeration or a random key guess. Root replacement is the single visible commit point; response emission waits until cleanup succeeds or a durable `recovery-required` state is set. Failed initialization, cleanup, recount, or repeated recovery blocks later mutations without accumulating an unlisted orphan. Any third/mixed state, unenumerable write, accepted-before-cleanup response, or unproved initialization/recovery path is No-Go.

## 8. Evidence contract

Every gate result uses the same status vocabulary:

~~~ts
export type GateCheckState = 'PASS' | 'FAIL' | 'INCONCLUSIVE' | 'NOT_RUN'
~~~

Every structured result records:

~~~ts
export interface GateEvidenceIdentity {
  sourceCommit: string
  lockSha256: string
  fixtureRevisionSha256?: readonly [string, string]
  fixtureManifestSha256?: string
  acceptedArtifactSetSha256?: string
  goldenManifestSha256?: string
  goldenArtifactSetSha256?: string
  packageManifestSha256?: string
  tgzSha256?: string
  bootstrapManifestSha256?: string
  handoffManifestSha256?: string
  rippleAcceptanceManifestSha256?: string
  rippleTgzSha256?: string
  prerequisiteFinalSha256?: Readonly<Record<string, string>>
  dshVersion?: '0.1.0-rc.6'
  resolvedConnectionVersion?: '0.1.0-rc.6'
  nodeVersion: string
  npmVersion: string
  os: string
  architecture: string
}

export interface GateCheckResult {
  id: string
  required: true
  state: GateCheckState
  expected: string
  observed: string
}
~~~

A phase records only the identity fields it owns, but its final marker must bind every immutable prerequisite it consumed. FAIL and INCONCLUSIVE reports remain valid audit records; a report is admissible as a downstream PASS prerequisite only when:

- every required check is present;
- every required state is PASS;
- result and final marker exit codes agree;
- every applicable source, lock, fixture manifest/set, golden manifest/set, package manifest/tgz, bootstrap, ripple, and prerequisite-final hash recomputes;
- failures from earlier attempts remain visible;
- raw logs remain outside Git;
- sanitized outputs contain no canary, credential, payload, quote, local absolute path, browser session, or stack;
- the report states the exact allowed claim and prohibited extrapolations.

For Gate A′, admissibility additionally requires that the promoter independently revalidate the sealed handoff and render one identical `handoffManifestSha256` into both fixed Git documents before the evidence commit. The handoff manifest binds only earlier run/input/review identities; binding a future promoted document or evidence commit is forbidden because that would create a hash cycle.

F0, P0, P1, Gate A′, and Gate B each produce one unique four-file acceptance/runtime closure: `result.json`, sanitized `report.md`, `junit.xml`, and final-written `run.final.json`; phase-only raw scenario files may remain alongside but never replace it. The final marker binds the real child exit and the other three hashes; only after recomputation may a current-run pointer be updated under that phase's shared pointer lock. Each closure binds the exact clean source commit, lock, action decisions, accepted inputs, and every phase-specific prerequisite available when the run closes. Gate B additionally binds the mutually distinct Product-package-freeze, bootstrap, runtime, isolated-package-lifecycle, and intentional-stop/kill decision IDs plus hashed process-ownership/signal outcomes. Gate A′ `run.final.json` does not and cannot bind the later handoff; the promoted report/ledger bind that manifest in the forward direction. A pointer, screenshot, raw log, package listing, authorization narrative, or report without its required closure cannot authenticate a run.

`docs/probe-results.md` is the root canonical phase-status ledger. Every phase first offers a read-only preview that holds the phase pointer lock, renders twice in memory, creates no candidate output, and returns only the fixed output path/SHA-256 pairs plus canonical `candidateSetSha256`. F0's evidence decision binds its one candidate hash; the Gate A′ evidence decision, issued after its sealed handoff exists, binds both candidate hashes and the exact `handoffManifestSha256`; P0 and P1 human-review and evidence decisions both bind their two candidate hashes. Their authorized write mode rerenders exactly that set and finalizes one immutable promotion receipt outside Git containing pointer/closure/decision/renderer and per-path byte hashes.

Gate B adds one explicit intermediate boundary because a person must inspect exact persisted candidate bytes: after the zero-candidate-output preview, a fresh `candidate-materialization` decision binds the frozen closure, render-policy hash, exact two path/SHA-256/Git-blob-OID tuples, `candidateSetSha256`, fixed content-addressed root, and fixed three-file output schema. The renderer validates and atomically consumes that distinct decision before any candidate `mkdir` or file creation, atomically publishes exactly the two review documents plus final immutable `candidate-receipt.json` under `<sourceCommit>/<runId>/<candidateSetSha256>/`, and rejects replay or replacement. A crash after consumption requires a new decision. Gate B human-review and evidence decisions then bind the candidate-materialization decision and authorization receipt, candidate receipt/path/hash, set hash, and exact candidate bytes. The promoter derives that root without scanning and writes only the reviewed bytes to the two tracked destinations.

For every phase, the same explicit run/source/final/report/candidate/receipt identities drive non-writing `--check`, pre-commit index-blob verification, and post-commit commit-object blob verification. The pointer lock prevents selection/render races; immutable receipts plus pre/post Git-blob checks detect any replacement after lock release. Each evidence commit has exactly one parent equal to the frozen source and a raw NUL-delimited diff containing exactly its fixed regular-file allowlist: one ledger file for F0, two result/ledger files for P0, P1, Gate A′, and Gate B. A byte or topology mismatch invalidates the local candidate and cannot be repaired by amend. Root README/security/compatibility summaries are frozen source/build-time pointers to the ledger and are never an independent or mutable truth source. Documentation packed into a tgz remains an immutable build-time statement bound to that tgz and points to the external content-addressed ledger for later observations. A later Gate must not rewrite package-local text to imply a permanently current `PASS`, `FAIL`, `INCONCLUSIVE`, or `NOT_RUN` state.

## 9. Commit policy

Each task follows RED → minimal GREEN → focused verification → refactor if needed → full phase verification → commit. Never write a large implementation first and add tests afterward.

Every authored-file task commit uses only the exact paths listed by that task. Immediately before each commit, run `git diff --cached --check`, compare `git diff --cached --name-only` with the task's Files allowlist, and run `git status --short` to prove that no earlier task's tracked or untracked work is being absorbed. H1 Task 0's two-parent merge is the sole exception: its staged set is the verifier-computed difference between two immutable accepted parents plus only the actual changed subset of its literal conflict allowlist. A directory-wide `git add`, `git add .`, `git add -A`, or later-task path is forbidden. If the applicable staged set differs, stop and inspect; do not commit.

Code and evidence are separate commits and external handoffs remain outside Git:

1. freeze a clean code commit;
2. build and run the gate from that exact commit and lock;
3. do not amend or rebase the frozen commit;
4. review and sanitize one exact temporary closure, recording a decision bound to its source/run/final/report identities;
5. for Gate A′ only, obtain separate export authorization and seal the reviewed run beneath the independently derived shared root;
6. preview the deterministic candidate without candidate output; for Gate B only, obtain a distinct materialization decision bound to that preview before atomically publishing the fixed candidate set and receipt for exact human review; bind the applicable per-path/set hashes and, for Gate B, materialization decision/receipt in the required review/evidence decisions; then have the promoter revalidate its complete closure and, for Gate A′, the exact sealed handoff, write only those allowlisted tracked bytes, finalize an immutable promotion receipt, and pass the non-writing byte check;
7. stage only that derived evidence, verify every index blob against the receipt, commit it while naming the frozen source and required forward-bound hashes, then verify every committed blob plus the frozen-source sole parent and raw NUL exact-path topology against the same receipt;
8. if code changes, invalidate the old report, handoff, and evidence candidate and repeat the gate.

Suggested responsibility-sized commit order:

~~~text
docs: add reviewed PM workbench implementation plans

# F0
build: add the shared protocol foundation
feat: add strict shared transport primitives
test: close the shared foundation boundary
docs: record observed F0 result

# H0, from the exact accepted F0 evidence tip; record its named F0 source
build: pin rc6 public integration surface
build: separate probe host and client graphs
feat: add probe-only transport contract
feat: add synthetic counter state machine
feat: persist the synthetic probe aggregate
feat: connect the safe probe transport
feat: add the additive probe launcher and overlay
test: close the Probe package and Gate A prime runner
docs: record observed Gate A prime result

# P0, independently from the exact accepted F0 evidence tip; record its named F0 source
test: freeze the synthetic discovery fixture case
feat: add immutable source revisions
feat: add project evidence invariants
feat: add the synthetic fixture analysis
feat: require human review and baseline publication
feat: render deterministic cited PRDs
feat: add the product-only protocol
feat: add the in-process workbench service
feat: add snapshot-safe complete reads
test: add the P0 acceptance runner
docs: record observed P0 result

# P1, from the accepted P0 evidence tip
test: add the shell-neutral UI harness
feat: add monotonic workbench client state
feat: add the shell-neutral workbench frame
feat: add traceable source and evidence review
feat: add explicit requirement decisions
feat: confirm baselines and verify PRD downloads
test: cover workbench failure and concurrency states
feat: complete accessible workbench interactions
test: add the fail-closed P1 acceptance gate
docs: record observed P1 result

# H1 composition, from the exact accepted P1 evidence tip plus H0 evidence tip
test: add the H1 composition verifier
build: merge accepted H0 and P1 workbench lines
docs: record the H1 composition merge
feat: define versioned Harness storage records
feat: add the journaled Harness repository
test: prove repository quota and crash recovery
feat: connect the Product-only RPC transport
feat: assemble the additive Product workbench
build: close and audit the Product package
test: add the isolated Gate B runner
test: define the combined Product acceptance
test: complete Gate B safety scenarios
docs: record observed Gate B result
~~~

The block above lists Git commits only. H0's separately authorized Probe package freeze occurs after its final code commit and before Gate A′; after the run and exact human sanitization decision, the sealed Gate A′ handoff export occurs **before** promotion and the Gate A′ evidence commit and is intentionally not committed. The promoter binds its `handoffManifestSha256` forward into both committed documents. H1's final Product package freeze occurs after all H1 Task 1–9 code/runner commits and before Gate B, even though the package-pipeline code was committed earlier. These external artifacts remain content-addressed inputs; neither package freeze nor handoff export creates a pseudo commit.

Do not commit lib, node_modules, .tmp, profiles, runtime databases, browser artifacts, caches, raw logs, tgz files, credentials, or real data.

## 10. Claim ladder

| Evidence reached | Only permitted statement |
| --- | --- |
| Static checks only | The source and package skeleton pass the named static checks. |
| Gate A′ | Public Connection RPC, additive slots, synthetic storage, restart and remove lifecycle passed in the recorded isolated rc.6 combination. |
| P0 | The pure Evidence Core completed the fixed synthetic fixture and required negative invariants. |
| P1 | The production WorkbenchView completed the review flow in the recorded shell-neutral browser harness. |
| Gate B | The recorded Product tgz completed the synthetic cited-requirement and Markdown PRD flow in the recorded isolated rc.6 combination. |

None of these statements proves real AI analysis, real interview privacy, compatibility with another Harness release, LAN/remote safety, multi-user behavior, production readiness, or public distributability.

## 11. Master stop rules

Stop immediately and report a No-Go when any implementation would require:

- a private Harness export or deep implementation import;
- handwritten or copied Typert descriptors;
- modification of Harness source;
- root, conversation, or private DOM replacement;
- a bare HTTP route or shared /api interceptor;
- active 3080 or ~/.dsh access;
- an automatic worktree package setup, an implicit `.gitignore` commit, a fallback to the active checkout, an ancestor/foreign `node_modules`, or non-audited dependency hydration;
- an H0 or P0 branch based on anything other than the exact accepted F0 evidence tip, or failure to record/revalidate the F0 source commit named by that ledger;
- real data, a nonaccepted normalized source identity, a repository fixture/golden raw-byte mismatch, a symlinked fixture/golden, a path escape, or a loader identity/hash drift;
- a Product model, provider, credential, Agent, Subagent, arbitrary filesystem/shell capability, or external network path; or any network outside a separately authorized bootstrap's exact reviewed origins;
- a package freeze without its own authorization and clean source binding, a gate that rebuilds/selects by mtime, or an installer/bootstrap wrapper that lacks an exact action-decision receipt, does not force distinct empty marker-owned user and global npm configs, inherits auth/token/proxy/provider/`NODE_OPTIONS`, accepts caller config/prefix/registry/cache/script-shell overrides, runs lifecycle scripts, retains unbounded raw output, or uses unmanifested cache/browser state;
- a Gate A′ run that does not execute the fixed accepted Probe and ripple install/remove/re-add/restart/remount/cleanup graph from their exact accepted artifacts, or that relabels remove/re-add as a separately observed disabled/enabled state;
- a browser bootstrap without the direct-Node repository downloader/materializer, or without an exact owner-reviewed content-hashed URL/origin/redirect/length/archive policy; any stock Playwright downloader, outer npm, inherited/discovered download host, proxy, custom CA, credential, HTTP downgrade, unlisted redirect, partial tree, or widened default; a Gate B cache/store bootstrap without the separate exact-package/integrity policy, accepted-version `npm cache add`/`pnpm store add` grammar, hash-bound exact-origin/address-pinning preload and zero-network disposable-install proof; any `pnpm fetch`, implicit pnpm lock, range/tag, arbitrary argv, lifecycle execution, unchecked socket/redirect/DNS peer, child-zero/nonempty-tree proxy for usability, or partial cache/store publication; a browser command under the wrong authorization scope; or a claimed 200% result produced without measured native browser zoom and the complete interaction/reflow assertions;
- a new endpoint not present in the approved Product registry;
- a test repository replacing production HarnessProjectRepository;
- a runtime probe/product switch;
- an H1 integration conflict outside the explicit Task 0 allowlist, or a production-source conflict resolved on the H1 line;
- an unbound/mismatched ripple manifest, theme tgz, or owner decision required by Gate A′ or Gate B;
- a PATH/global/moving-checkout rc.6 CLI, an unsealed or incomplete accepted CLI runtime closure, or a CLI artifact different from the owner's exact accepted decision;
- a Gate A′ export before the exact human sanitization decision, promotion before a complete sealed handoff, a manifest that binds future promoted documents/evidence commit, or a missing/different `handoffManifestSha256` between the fixed report and canonical ledger;
- a handoff root selected from an owner/caller path instead of independently derived from the real common-dir/primary-checkout family rule, or an owner root assertion that is not exactly equal to that derived root;
- an H1 import based on a caller-supplied hash/path, working-tree drift, H0 `.tmp`, mtime, or “latest” instead of the identical handoff hash in both blobs of the exact accepted H0 evidence commit; or an H0 evidence commit that is not a one-parent commit over its named frozen source with exactly the two fixed evidence-path changes;
- an H1 merge-tree npm/test/build command before the verifier-derived content-addressed exact-union manifest is consumed by the action-decision-bound fixed lock-only grammar and the reconstructed lock receives its own separately decision-bound exact hydration; either network retry without its own classified-miss-bound decision; an H1 handoff import without its distinct decision/receipt; or reuse of the pre-merge P1 dependency tree as union evidence;
- an unverified public atomic-replacement contract for the exact resolved rc.6 storage primitive;
- a staging write that occurs before a fixed discoverable prepared intent names every possible record, or a crash path that can leave an unenumerable orphan;
- unresolved journal/orphan/staging cleanup failure, mutation while the repository is `recovery-required`, or quota accounting that omits physical retained records;
- a Gate B signal outside the two closed purpose-locked paths; an ordinary/final/failure stop without its exact runtime decision, authenticated readiness, live sentinel, fresh PID/PGID/parent/birth/member revalidation, exactly one negative-PGID SIGTERM, or bounded child/descendant/listener disappearance; automatic escalation after a graceful-stop timeout instead of retaining INCONCLUSIVE; a B10 SIGSTOP/SIGKILL without a distinct exact kill decision, ACKed post-invocation begin, fresh isolated process group, launch sentinel, PID/PGID/parent/birth identity and registered-descendant receipt; a signal after foreign/reused/unknown membership, PID reuse, or self/name/port/external targeting; failure to distinguish registered members proven exited from unknown members; failure to prove stopped-state, drain the authenticated event channel through its committed watermark, causally exclude an ACKed/committed returned frame, revalidate identity/membership before SIGKILL, prove complete group disappearance and same-profile restart, or observe exactly complete old or complete new state;
- an evidence promoter without the required exact-run review/evidence decisions, with a replaceable pointer, without a deterministic read-only candidate preview, decisions that omit candidate hashes, no immutable promotion receipt, no non-writing `--check`, no index/committed-blob equality proof, output outside its fixed paths, or an evidence commit whose sole parent/diff does not match the frozen source and exact path allowlist;
- a Gate/result/root-summary claim that is not derived from the canonical status ledger, or package-local documentation rewritten after packaging to claim a mutable current Gate state;
- weakening strict schemas, correlation checks, CAS, receipt, pagination, quota, recovery, or accessibility acceptance.

At each phase endpoint:

~~~text
STOP — report observed evidence and wait for the owner.
Do not continue to the next phase automatically.
~~~

## 12. Plan self-review map

| Specification section | Implementation plan |
| --- | --- |
| §1–3 decisions and claims | this rollout index |
| §4 architecture and source roots | F0 and all four phase plans |
| §5.1–5.8 transport, schemas, errors, lifecycle and limits | F0 Tasks 1–3; H0 Tasks 1–8; P0 Tasks 6–9; H1 Tasks 0 and 3–8 |
| §6 domain entities and invariants | P0 Tasks 1–7 |
| §7 application and module boundaries | P0 Tasks 3–8 |
| §8 UI integration | P1 Tasks 1–9; H1 Task 5 |
| §9 storage, lifecycle and privacy | H0 Tasks 4–10; H1 Tasks 0–9 |
| §10 Gate A′ | H0 Tasks 8–10 |
| §11 Evidence Core P0 | P0 Tasks 1–10 |
| §12 Review UI P1 | P1 Tasks 1–9 |
| §13 Gate B | H1 Tasks 0–10 |
| §14–16 deferred/rejected architecture | global constraints and master stop rules |
| §17 adversarial questions | negative tests in every phase |
| §18 authorization sequence | authorization ladder and every phase STOP |

## 13. Execution handoff after plan approval

After the owner approves this plan set, F0 becomes the first phase eligible for a separate implementation authorization. Its exact dependency actions/network retries, frozen-source verification, and evidence recording remain separate decisions. F0 must finish with one clean source commit and one canonical-ledger evidence commit that names it. Only after that exact evidence tip is accepted may H0 or P0 branch from it; each records the named F0 source and receives its own authorization:

1. **Subagent-Driven, recommended:** execute F0, then H0 or P0, with a fresh implementation subagent per task and two-stage review after each task.
2. **Inline Execution:** execute the currently authorized phase in a dedicated worktree with superpowers:executing-plans and stop at its documented checkpoints.

For H0, the mandatory downstream checkpoint is: close the Gate A′ run, obtain the exact human sanitization decision, separately export the sealed handoff to the independently derived repository-family root, preview and decision-bind the two exact candidate hashes, have the promoter revalidate the handoff and render the same `handoffManifestSha256` into report plus ledger, then verify the immutable receipt against index/commit blobs and topology. H1 remains ineligible until it can read that identical hash from both fixed blobs of the exact owner-accepted H0 evidence commit and independently verify both H0 and P1 evidence commits' candidate hashes, one-parent/exact-two-path topology, and committed bytes. Its exact-union reconstruction, reconstructed-lock hydration, and sealed-handoff import each use their own action decisions; the two possible registry retries use separate network decisions bound to their own immutable miss receipts. P0 and P1 each require a distinct frozen-source acceptance decision before review. For P0 and P1, the exact run review and evidence-write/commit decision are separate from the run and bind the read-only preview's exact candidate hashes. Gate B additionally requires a post-preview, pre-output candidate-materialization decision; its later human-review and evidence-write/commit decisions bind that decision, its authorization receipt, the immutable candidate receipt, and the exact persisted bytes. Only the applicable decision-bound, pointer-race-safe renderer/promoter plus receipts and rendered/index/committed byte checks may create or promote an evidence candidate. For Gate B, package freeze, bootstrap, runtime orchestration, isolated package lifecycle, and intentional B10 stop/kill use five mutually distinct recorded Gate action decisions; candidate materialization is a sixth post-run decision with no runtime or Git authority. Ordinary/final/failure shutdown behavior and B10 signal scope are fixed separately in H1; neither authorizes touching another process.

Neither choice includes Gate runtime, human sanitization acceptance, handoff export, evidence promotion, isolated package lifecycle, bounded Gate B kill/restart, dependency network access, Git remote actions, H1, model use, real data, or publication unless the owner explicitly includes that exact action and the responsible command records its bound decision ID.
