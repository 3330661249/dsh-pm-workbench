# DeepSeek Harness rc.6 Legacy Writer Retirement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development to implement this plan task-by-task.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permanently fail closed the two legacy committed-evidence writers and
make the staged schema-v2 proposal name only the reviewed B2b stage that
actually produced it.

**Architecture:** Keep the old exported function names as compatibility shims
that reject before inspecting their arguments or touching the filesystem. Keep
their direct CLIs as fixed, path-free, nonzero policy rejections; never forward
an old CLI call into B2b staging. Continue to use `prepareSelectedSource` and
`stageRc6DeclarationInputV2` as the only working proposal pipeline, and rename
the schema-v2 `acceptance` claim to an exact `proposalStage` claim.

**Tech Stack:** Node.js ESM, TypeScript, Vitest, npm offline replay, Git.

**Spec:**
`docs/reviews/2026-09-05-rc6-declaration-surface-ledger.md`, plus the owner's
2026-09-06 simple-version decision to disable the old path and retain only the
new staged proposal flow.

## Global Constraints

- Do not start, install, configure, or inspect a live DeepSeek Harness.
- Do not access profiles, accounts, models, conversations, credentials, or real
  user documents.
- Do not use the network, push, create/update a pull request, merge, or deploy.
- Do not promote the schema-v2 proposal in this task.
- Preserve the committed schema-v1 input and closure bytes as historical
  evidence.
- An old CLI invocation must never silently trigger `stageRc6DeclarationInputV2`.
- Write production code only after the new behavioral tests have failed for the
  expected reason.
- Supersede local proposal evidence by reversible rename, never by deletion or
  overwrite.

---

### Task 1: Add RED tests for both retired writer surfaces

**Files:**

- Modify: `tests/integration/rc6-declaration-input.test.ts`
- Modify: `tests/integration/rc6-declaration-dependency-boundary.test.ts`

**Interfaces:**

- Consumes: current `acceptRc6DeclarationInput`,
  `writeCommittedDeclarationClosure`, and the two direct CLIs.
- Produces: exact desired API and CLI policy behavior for the GREEN change.

- [ ] **Step 1: Write the acceptance API RED.**

  Assert that a Proxy argument whose property getter throws still rejects with
  `{ code: 'LEGACY_ACCEPT_DISABLED' }`. This proves the compatibility shim does
  not destructure or inspect caller input. Also call it with a missing
  workspace path and assert that no `.tmp` path is created.

- [ ] **Step 2: Write the acceptance CLI RED.**

  Run the copied CLI with each argv set `[]`, `['--verify-and-compile']`,
  `['--replay-arbitrary-path']`, `['--help']`, and `['--unknown']`. Every case
  must exit `1`, keep stderr empty, and emit only:

  ```json
  {
    "status": "FAIL_INPUT_POLICY",
    "reasonCode": "LEGACY_ACCEPT_DISABLED"
  }
  ```

- [ ] **Step 3: Write the closure writer API and CLI RED.**

  Assert the API rejects a Proxy argument with
  `{ code: 'LEGACY_CLOSURE_WRITE_DISABLED' }`. Run the verifier CLI with `[]`,
  `['--write']`, `['--check-metadata-only']`, `['--check-realpaths']`, and an
  unknown argument. Every case must exit `1`, keep stderr empty, and emit only:

  ```json
  {
    "status": "FAIL_CLOSURE_POLICY",
    "reasonCode": "LEGACY_CLOSURE_WRITE_DISABLED"
  }
  ```

  Snapshot the historical closure before and after so the test proves its bytes
  are unchanged.

- [ ] **Step 4: Run the two focused test files and verify RED.**

  Run:

  ```bash
  npm test -- tests/integration/rc6-declaration-input.test.ts tests/integration/rc6-declaration-dependency-boundary.test.ts --maxWorkers=1
  ```

  Expected: the new policy tests fail because the legacy functions still read
  inputs/write output and the CLIs still expose their former behavior.

### Task 2: Fail closed the legacy APIs and CLIs

**Files:**

- Modify: `scripts/accept-rc6-declaration-input.mjs`
- Modify: `scripts/verify-rc6-declaration-closure.mjs`

**Interfaces:**

- Consumes: Task 1 policy tests.
- Produces: rejecting compatibility shims and fixed direct-CLI policy output.

- [ ] **Step 1: Replace the legacy acceptance body with the minimal shim.**

  Keep the export name but accept one unused, non-destructured parameter:

  ```js
  export async function acceptRc6DeclarationInput(_options) {
    fail('LEGACY_ACCEPT_DISABLED', 'use stageRc6DeclarationInputV2')
  }
  ```

  Map this one code to `FAIL_INPUT_POLICY`, then keep the direct CLI on the same
  shim and set exit code `1` without printing stack traces or local paths.

- [ ] **Step 2: Replace the legacy closure writer with the minimal shim.**

  Keep the export name but reject before inspecting its argument:

  ```js
  export async function writeCommittedDeclarationClosure(_options) {
    fail('LEGACY_CLOSURE_WRITE_DISABLED', 'use staged proposal closure')
  }
  ```

  Make the direct verifier CLI emit the fixed `FAIL_CLOSURE_POLICY` result and
  exit `1`. Remove its now-unused `writeFile` import.

- [ ] **Step 3: Run Task 1 tests and verify GREEN.**

  Run the identical command from Task 1. Both files must pass with the same
  production code that produced the RED.

### Task 3: Replace the false schema-v2 acceptance claim

**Files:**

- Modify: `scripts/accept-rc6-declaration-input.mjs`
- Modify: `tests/integration/rc6-declaration-input.test.ts`

**Interfaces:**

- Consumes: v2 manifest validation and B2b proposal generation.
- Produces: exact `proposalStage` schema and rejection of the retired claim.

- [ ] **Step 1: Add a RED for the desired exact v2 schema.**

  The synthetic v2 fixture must contain only:

  ```js
  proposalStage: {
    command: 'stageRc6DeclarationInputV2({ workspaceRoot })',
    result: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
  }
  ```

  Assert that an `acceptance` key, the old CLI command,
  `PASS_ACCEPTED_INPUT`, or `PASS_OFFLINE_INSTALL` is rejected.

- [ ] **Step 2: Run the exact test and verify RED.**

  Expected: current validation requires `acceptance` and rejects
  `proposalStage`.

- [ ] **Step 3: Implement the exact v2 schema.**

  Replace `acceptance` with `proposalStage` in the exact key list, generation,
  and validation. Replace `ACCEPTANCE_RESULT_MISMATCH` with
  `PROPOSAL_STAGE_RESULT_MISMATCH` in the owned public mismatch registry.

- [ ] **Step 4: Extend the synthetic published-proposal test.**

  Read `input-manifest.v2.json` from the published bundle, assert canonical
  bytes, assert the exact `proposalStage`, and assert its serialized value does
  not contain any retired acceptance result or command.

- [ ] **Step 5: Run the focused input test and verify GREEN.**

### Task 4: Rebind source identities and preserve historical instructions

**Files:**

- Modify: `scripts/accept-rc6-declaration-input.mjs`
- Modify: `docs/superpowers/plans/2026-09-05-dsh-pm-workbench-rc6-public-surface.md`

**Interfaces:**

- Consumes: final verifier source bytes and acceptance source bytes.
- Produces: exact verifier pin, exact normalized acceptance self-hash, and a
  visible correction above obsolete legacy commands.

- [ ] **Step 1: Recompute and stamp `EXPECTED_VERIFIER_SOURCE_SHA256`.**
- [ ] **Step 2: Recompute and stamp
  `EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256`.**
- [ ] **Step 3: Add a historical-plan correction.**

  Do not rewrite the old steps. State that the owner's simple-version decision
  retires both legacy writer CLIs and that the only working proposal entry is
  the explicit `stageRc6DeclarationInputV2({ workspaceRoot })` API.

- [ ] **Step 4: Run source-hash tests, syntax checks, typecheck, and the three
  focused rc.6 files.**

### Task 5: Review, regenerate, and verify the local proposal

**Files:**

- Modify: `docs/reviews/2026-09-05-rc6-declaration-surface-ledger.md`
- Local evidence only:
  `.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal*.json`
- Local evidence only:
  `.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal-bundles*`

**Interfaces:**

- Consumes: reviewed GREEN code and the existing selected-source publication.
- Produces: a new immutable proposal bound to the retired legacy writers and
  exact `proposalStage` semantics.

- [ ] **Step 1: Obtain an independent pre-publication code review.**

  Do not run the real stage until the reviewer reports no P0/P1 on the new
  reachable code and tests.

- [ ] **Step 2: Reversibly supersede the old proposal.**

  Rename the current pointer and bundle parent to fixed
  `.superseded-pre-legacy-disable-20260906` paths after confirming those
  destinations are absent. Do not delete or overwrite evidence.

- [ ] **Step 3: Run the real local stage twice.**

  The first result must be `PASS_STAGED_RC6_DECLARATION_INPUT_V2`,
  `PASS_STAGED_REPLAY`, `PUBLISHED`. The second must return the same two PASS
  values and `ADOPTED_EXISTING` for the same pointer and bundle.

- [ ] **Step 4: Independently reconstruct the evidence closure.**

  Recompute pointer, receipt, input, closure, raw source, normalized self-hash,
  and compiler-result hashes; check file modes/link counts and recursively scan
  structured values for local absolute paths and `file:` URIs.

- [ ] **Step 5: Append a ledger section.**

  Preserve prior sections as historical. Record RED/GREEN evidence, new
  proposal identities, the two retired CLI policies, and the precise boundary:
  no promotion, Harness action, network observation, push, or PR.

### Task 6: Full verification, independent review, and local commit

**Files:** All files changed by Tasks 1 through 5.

**Interfaces:**

- Consumes: the complete legacy-retirement diff and regenerated proposal.
- Produces: one reviewed local commit; no remote operation.

- [ ] **Step 1: Run the full serial test suite.**

  ```bash
  npm test -- --maxWorkers=1
  ```

- [ ] **Step 2: Run fresh repository checks.**

  Run typecheck, both production syntax checks, strict-umask helper syntax,
  build, package verification, dry pack, and `git diff --check`.

- [ ] **Step 3: Obtain two independent final reviews.**

  One reviewer checks code/reachability and one checks evidence wording. Resolve
  every P0/P1 before proceeding.

- [ ] **Step 4: Stage only intended files, inspect the cached diff, and commit
  locally.**

  Suggested message:

  ```text
  Retire legacy rc6 declaration writers
  ```

  Verify the worktree is clean afterward. Do not push or create/update a pull
  request.
