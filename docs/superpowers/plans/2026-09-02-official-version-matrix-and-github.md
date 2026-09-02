# Official Typert Version Matrix and GitHub Repository Implementation Plan

> **Historical executed plan.** The committed matrix results and adversarial
> review remain evidence for the generated-Typert decision only. Do not use this
> plan to implement the current product architecture. The owner-selected
> Connection RPC design is
> [`../specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md`](../specs/2026-09-02-dsh-pm-workbench-v0.1-connection-rpc-design.md);
> its implementation plan has not been written or approved.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a private, independently cloneable GitHub repository for DSH PM Workbench and use one frozen synthetic Remote fixture to determine whether any exact official DeepSeek Harness Typert cohort after `0.1.0-rc.6` is eligible for a later isolated Host/Client mount probe.

**Architecture:** `main` contains only repository governance. All existing skeleton code, portability fixes, research, and the version-matrix runner land through `codex/version-matrix`. The runner creates one workspace, npm cache, npmrc, lockfile, log set, and evidence record per exact cohort. It validates registry identity, the installed dependency graph, TypeScript compilation, direct discovery/generation, tsdown generation, five fresh Typert artifacts, strict request/result codecs, and package contents. Canonical JSON drives Markdown/JUnit reports. A passing cohort only becomes `ELIGIBLE_FOR_NEXT_ISOLATED_MOUNT_PROBE`; it never changes the active Harness profile.

**Tech Stack:** Node.js `24.14.0`, npm CLI `11.9.0`, TypeScript `6.0.3`, tsdown `0.22.2`, Vitest, Zod `4.4.3`, official `registry.npmjs.org`, Git, GitHub Pull Requests.

**Spec:** `docs/superpowers/specs/2026-09-02-official-typert-version-matrix-design.md`

## Global constraints

- Do not execute `dsh`, bind a port, edit `~/.dsh`, alter the active profile, or access `127.0.0.1:3080`.
- Do not read, copy, commit, upload, or process the ripple theme, real interviews, recordings, transcripts, user documents, provider responses, credentials, browser sessions, or model outputs.
- Use only the fixed synthetic `strict-remote-v1` fixture. No ambient shim, handwritten descriptor, copied generated artifact, protocol vendoring, generator patch, HTTP fallback, or dynamic Cordis fallback.
- Pin every DSH package and Cordis version exactly. Never use `latest`, `next`, `alpha`, `^`, `~`, Git URLs, aliases, or local package substitutions in matrix cases.
- Every subprocess uses an executable plus an argv array with `shell: false`. Child environments remove token, credential, provider, and Harness variables.
- Preserve observed failures. A successful TypeScript or tsdown process with missing Typert artifacts is a compatibility failure, not a pass.
- Do not merge the Pull Request. The repository owner reviews and decides.

---

## Task 1: Freeze design and official source evidence

**Files:**

- Create: `docs/superpowers/specs/2026-09-02-official-typert-version-matrix-design.md`
- Create: `docs/superpowers/plans/2026-09-02-official-version-matrix-and-github.md`
- Create: `research/2026-09-02-official-version-matrix-sources.md`

- [ ] Copy the reviewed runner design into the tracked specification path without altering its evidence boundary.
- [ ] Record official GitHub commits/tags, exact npm versions, dist-tag mismatch, Cordis boundaries, toolchain versions, license boundaries, and the `0.1.2-alpha.1` npm `E404` exclusion.
- [ ] Verify the research contains direct official URLs, a check date, and a clear separation between static source inference and unexecuted runtime results.
- [ ] Run `shasum -a 256` over the design and research documents and record the observed hashes in the implementation log.

## Task 2: Establish the private repository governance baseline

**Files:**

- Create: `README.md`
- Create: `.gitignore`
- Create: `LICENSE`
- Create: `SECURITY.md`
- Modify outside child repository: `../../.gitignore`

- [ ] Add `/plugins/dsh-pm-workbench/` to the parent repository `.gitignore` before initializing the child repository so the parent never records an embedded repository or gitlink.
- [ ] Add a root README that labels the project private, unofficial, experimental, and Gate A `NO-GO`; list what is not yet proven and define the PR evidence workflow.
- [ ] Ignore dependencies, build output, matrix workspaces/caches/logs, `.npmrc`, environment files, Harness state, real interview data, and audio/video formats.
- [ ] Add `UNLICENSED` terms and a security/data policy that prohibits real user data and credentials in commits, issues, PRs, or CI artifacts.
- [ ] Initialize the child repository with `git init -b main`.
- [ ] Stage only `README.md`, `.gitignore`, `LICENSE`, and `SECURITY.md`; confirm `git diff --cached --name-only` has exactly four paths.
- [ ] Commit as `chore: initialize private workbench repository`.

## Task 3: Create and verify the private GitHub repository

**Remote:** `https://github.com/3330661249/dsh-pm-workbench`

- [ ] In the authenticated GitHub browser session, create `3330661249/dsh-pm-workbench` as **Private**, with no generated README, `.gitignore`, or license.
- [ ] Use the description: `Unofficial private DeepSeek Harness plugin lab for AI product management workflows, from interview evidence to requirements, prioritization, and POC planning.`
- [ ] Add the HTTPS origin and push `main` without force.
- [ ] Verify the GitHub page shows the exact owner/name, `Private`, default branch `main`, and the four governance files.
- [ ] If Git credential authorization blocks the push, stop and request browser-based authorization; never read, print, or store a token in the repository.

## Task 4: Import the existing skeleton and make it independently cloneable

**Files:**

- Modify: `scripts/workspace-boundary.ts`
- Modify: `scripts/pack-dry.mjs`
- Modify: `scripts/verify-package.mjs`
- Modify: `tests/integration/workspace-boundary.test.ts`
- Modify: `tests/integration/build-writer-boundary.test.ts`
- Create: `tests/integration/standalone-copy.test.ts`
- Import: `package.json`, `package-lock.json`, TypeScript/Vitest config, `packages/workbench/**`, `docs/**`, `research/**`, `scripts/**`, `tests/**`, `THIRD_PARTY_NOTICES.md`

- [ ] Create branch `codex/version-matrix` from the pushed `main` baseline.
- [ ] Write failing tests that expect repository root to equal the child repository, allow writes only under `packages/workbench/lib/**` and `.tmp/**`, reject writes elsewhere in the repo, and reject a symlink whose physical target is outside the repo.
- [ ] Refactor root discovery to derive the standalone repository from `scripts/..`; move npm cache paths below `<repo>/.tmp/npm-cache`.
- [ ] Add a standalone-copy test using a random OS temporary directory. Copy only tracked source candidates, run install from the committed lock without network when cache permits, then run typecheck, tests, build, package verification, and dry pack; assert no writes occur outside that copy.
- [ ] Run `npm run typecheck`, `npm test`, `npm run build`, `npm run verify:package`, and `npm run pack:dry`.
- [ ] Re-run the parent ripple suite and compare the protected SHA-256 manifest; record exact counts and confirm no ripple file changed.
- [ ] Commit as `refactor: make workbench repository standalone`.

## Task 5: Build fail-closed matrix foundations with TDD

**Files:**

- Create: `tools/typert-version-matrix/package.json`
- Create: `tools/typert-version-matrix/package-lock.json`
- Create: `tools/typert-version-matrix/tsconfig.json`
- Create: `tools/typert-version-matrix/src/types.ts`
- Create: `tools/typert-version-matrix/src/exact-version.ts`
- Create: `tools/typert-version-matrix/src/config.ts`
- Create: `tools/typert-version-matrix/src/boundaries.ts`
- Create: `tools/typert-version-matrix/src/process.ts`
- Create: `tools/typert-version-matrix/src/environment.ts`
- Create: `tools/typert-version-matrix/tests/exact-version.test.ts`
- Create: `tools/typert-version-matrix/tests/config.test.ts`
- Create: `tools/typert-version-matrix/tests/boundaries.test.ts`
- Create: `tools/typert-version-matrix/tests/process.test.ts`

- [ ] First write tests rejecting ranges, tags, aliases, URLs, local specs, whitespace, partial versions, duplicate ids, mixed DSH cohorts, unknown registries/adapters/packages, absolute paths, `..`, output reuse, and symlink escape.
- [ ] Implement branded exact-version parsing and strict matrix schema validation.
- [ ] Implement case-local path allocation under a new empty run root.
- [ ] Implement bounded subprocess execution with `shell: false`, explicit argv, timeouts, signal capture, and an allowlisted environment that excludes token/API/Harness variables.
- [ ] Prove two cases receive distinct workspace, npm cache, npmrc, node_modules, and log roots.
- [ ] Run the runner's typecheck and offline unit tests; commit as `feat: add fail-closed matrix foundations`.

## Task 6: Freeze the fixture and implement Typert assertions

**Files:**

- Create: `tools/typert-version-matrix/fixtures/strict-remote-v1/**`
- Create: `tools/typert-version-matrix/config/matrix.official.json`
- Create: `tools/typert-version-matrix/config/matrix.official-experimental.json`
- Create: `tools/typert-version-matrix/config/matrix.legacy-diagnostic.json`
- Create: `tools/typert-version-matrix/src/registry.ts`
- Create: `tools/typert-version-matrix/src/workspace.ts`
- Create: `tools/typert-version-matrix/src/adapters/workspace-v1.ts`
- Create: `tools/typert-version-matrix/src/assertions/*.ts`
- Create: corresponding `tools/typert-version-matrix/tests/*.test.ts`

- [ ] Freeze `matrixProbe/health(request)` with request `{ nonce: 'matrix-v1' }` and result `{ ok: true, apiVersion: 'v1' }`; commit SHA-256 values for every fixture file.
- [ ] Configure the main RC matrix for `0.1.0-rc.6`, rc.7, rc.8, `0.1.1-rc.1`, and `0.1.1-rc.2`; configure alpha.2-alpha.4 separately; configure rc.5/rc.2/rc.3 only as legacy diagnostics.
- [ ] Validate exact official registry name/version/integrity and the installed lock/dependency/workspace link before executing package code.
- [ ] Implement direct `WorkspaceTypertGenerator` discovery, automatic generation, forced generation, and tsdown generation using one reviewed adapter.
- [ ] Require five fresh regular artifacts, exact package exports, generated headers, identical direct/tsdown hashes, safe source maps, strict non-empty Host/Remote method inventories, valid payload acceptance, malformed payload rejection, and a clean dry pack.
- [ ] Add negative tests for build-only false positives, empty descriptors, permissive codecs, stale/copied/symlinked artifacts, wrong exports, missing workspace link, package drift, and unexpected methods.
- [ ] Run typecheck and offline tests; commit as `feat: add frozen strict Typert probe`.

## Task 7: Implement aggregation, reports, and CLI exit semantics

**Files:**

- Create: `tools/typert-version-matrix/src/run-case.ts`
- Create: `tools/typert-version-matrix/src/aggregate.ts`
- Create: `tools/typert-version-matrix/src/report-json.ts`
- Create: `tools/typert-version-matrix/src/report-markdown.ts`
- Create: `tools/typert-version-matrix/src/redact.ts`
- Create: `tools/typert-version-matrix/src/cli.ts`
- Create: report/aggregation tests
- Create: `.github/workflows/typert-matrix-runner-tests.yml`
- Create: `.github/workflows/typert-version-matrix.yml`

- [ ] Make `matrix.json` canonical and derive Markdown/JUnit only from validated JSON.
- [ ] Normalize local paths to `<repo>`, `<run-root>`, and `<case-root>`; keep raw bounded logs local and store only hashes/references in canonical reports.
- [ ] Implement statuses `PASS`, `FAIL_COMPATIBILITY`, `INCONCLUSIVE_REGISTRY`, `INCONCLUSIVE_LOCK`, `INCONCLUSIVE_ADAPTER`, and `INFRA_ERROR`.
- [ ] Return exit `0` only when every case is conclusive and at least one candidate passes, exit `1` for a complete matrix with no passing candidate, and exit `2` for any inconclusive/infra/report error.
- [ ] Hard-code the strongest success decision to `ELIGIBLE_FOR_NEXT_ISOLATED_MOUNT_PROBE` plus `humanDecisionRequired: true`.
- [ ] Add read-only, secret-free CI with exact Node and pinned action commits; matrix execution remains manual.
- [ ] Run deterministic report snapshots, redaction tests, aggregate truth-table tests, and command-plan tests proving no `dsh`, profile, port, browser, model, or user-data operation.
- [ ] Commit as `feat: add reproducible matrix reports`.

## Task 8: Execute the official matrix and preserve evidence

**Files:**

- Create: `tools/typert-version-matrix/locks/darwin-arm64-node24-npm11/*.package-lock.json`
- Create: `docs/matrix-results/2026-09-02-darwin-arm64/matrix.json`
- Create: `docs/matrix-results/2026-09-02-darwin-arm64/matrix.md`
- Create: `docs/matrix-results/2026-09-02-darwin-arm64/junit.xml`
- Modify: `docs/compatibility.md`
- Modify: `docs/probe-results.md`

- [ ] Validate local Node/npm versions before network access.
- [ ] Resolve each exact cohort only from `https://registry.npmjs.org`, freeze its lock, and record official integrity.
- [ ] Run the rc.6 control first, then `0.1.1-rc.2`, alpha.4, and the remaining main/experimental cohorts in isolated case roots.
- [ ] Verify the aggregate JSON schema and regenerate Markdown/JUnit from JSON.
- [ ] Copy only sanitized canonical evidence into `docs/matrix-results`; do not commit raw logs, caches, npmrc files, workspaces, node_modules, or absolute paths.
- [ ] Run a repository-wide secret/path/data scan and verify all protected ripple hashes again.
- [ ] Commit observed results without rewriting failures as successes: `test: record official Typert version matrix`.

## Task 9: Adversarial review and Pull Request

**Files:**

- Create: `docs/reviews/2026-09-02-version-matrix-adversarial-review.md`
- Create temporary PR body outside the repository, then remove it after use.

- [ ] Assign an independent reviewer to challenge version provenance, fixture equality, workspace-link correctness, artifact freshness, strict codec assertions, report redaction, exit-code aggregation, and compatibility wording.
- [ ] Address only validated findings; re-run focused tests and then the full static/matrix verification set.
- [ ] Confirm `git status`, staged paths, commit history, remote URL, branch name, and the absence of ignored data/build/cache files.
- [ ] Push `codex/version-matrix` without force.
- [ ] Open a Pull Request to `main` explaining the scope, evidence, exact matrix outcomes, remaining unknowns, privacy boundary, and next decision. Do not merge.
- [ ] Verify the PR page displays the expected base/head branches, commits, file diff, and check state.

## Completion rule

The task is complete only when the private repository and open Pull Request are visible on GitHub, the local and remote branches match, the matrix produces a validated conclusive report or explicitly records why it is inconclusive, the adversarial review is resolved, and no active Harness/profile/ripple/real-data boundary was crossed.
