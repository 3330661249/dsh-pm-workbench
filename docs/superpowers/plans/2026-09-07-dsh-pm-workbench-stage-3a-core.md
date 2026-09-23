# DeepSeek Harness AI PM Workbench Stage 3A Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship and independently verify an installable DeepSeek Harness `0.1.0-rc.6` plugin that takes one allowlisted synthetic interview text through evidence-backed requirements, human prioritization, an immutable scope baseline, and a deterministic Markdown PRD.

**Architecture:** Keep one plugin package with separate Host and Client graphs. The Host owns a strict Product RPC, a `storageDomain` table-backed project aggregate, evidence validation, Fixture analysis, CAS/idempotency, immutable baselines, and deterministic PRD rendering; the Client contributes an additive launcher and overlay, owns only ephemeral drafts, and reads or mutates data through the validated RPC. Before building the full workflow, pass a real isolated storage-surface gate; after implementation, replace the Probe production graph with a Product-only graph and pass a new end-to-end isolated smoke using a fresh package and profile.

**Tech Stack:** TypeScript 6.0.3, React 18.3.1, esbuild 0.25.12, Vitest 3.2.7, Zod 4.4.3, DeepSeek Harness and public integration packages `0.1.0-rc.6`, Node.js, Chrome DevTools Protocol.

**Spec:** `docs/superpowers/specs/2026-09-07-dsh-pm-workbench-stage-3-hybrid-workflow-design.md`

## Global Constraints

- This plan implements **Stage 3A only**. It must not call a model, accept real interview/customer data, implement a model adapter or Gate M, or claim AI analysis. The wire schema reserves `analysis.runHarnessModel` for Stage 3B, but Stage 3A always returns the closed `stage-unavailable` outcome before any model/provider path.
- Use one installable package, `@knight/dsh-pm-workbench`; do not introduce a general workflow engine or split the product into multiple plugins.
- Leave the user's active Harness at `127.0.0.1:3080`, `~/.dsh`, browser profile, ripple theme, workspaces, sessions, providers, and files untouched.
- All real runtime checks use a new marker-owned operating-system temporary root, a fresh Harness profile, a fresh Chrome profile, `127.0.0.1`, and a dynamically allocated port that is proved not to be `3080`.
- Test and smoke data must be newly written, synthetic, and free of identity or customer information. Never commit raw runtime logs, profiles, browser data, material payloads, downloaded PRD files, credentials, authorization URLs, signed URLs, or absolute local paths.
- Stage 3A accepts persisted material only when `syntheticDataAttested === true` and its final UTF-8 SHA-256 is present in the shipped Fixture allowlist. Stranger text may exist only in unsaved Client memory.
- A source is UTF-8 `.txt`, UTF-8 `.md`, or pasted text; raw and persisted UTF-8 are each at most `262144` bytes, the final string is at most `80000` UTF-16 code units, leading UTF-8 BOM removal is the only normalization, and NUL or unpaired surrogate is rejected.
- Project name is required and immutable after creation, with at most 120 Unicode code points and 512 UTF-8 bytes. Research goal is optional and immutable after creation, with at most 500 code points and 2048 UTF-8 bytes; when absent, the UI says `研究目标未提供` and does not claim business-goal ranking.
- A project has at most one accepted source revision in Stage 3A. Once analysis exists, source replacement returns `source-locked`; changing the material requires a new project.
- Evidence uses safe-integer UTF-16 half-open offsets `[start,end)`, cannot split a surrogate pair, must belong to the current project/source, must exactly equal `source.text.slice(start, end)`, and must carry the lowercase SHA-256 of its UTF-8 quote.
- Generated drafts, human text revisions, human decisions, baselines, and PRDs remain distinct immutable records. Any edit, priority change, decision change, reorder, baseline publication, or PRD render locks reanalysis for that project.
- `projectVersion` is the CAS counter for every accepted mutation. `contentVersion` changes only for source, analysis, requirement text, priority, decision, or order changes; baseline publication and PRD rendering do not change it.
- PRD bytes depend only on the immutable baseline, renderer version `pmwb-prd-v1`, and fixed renderer configuration. `createdAt` and `updatedAt` never enter Markdown bytes.
- Production Product RPC uses only `/dsh-pm-workbench-product-v1` with the six endpoints `health`, `projects.list`, `projects.get`, `sources.get`, `artifacts.getMarkdown`, and `projects.command`.
- `projects.command` has nine strict schema variants: the eight executable Stage 3A commands `project.create`, `project.delete`, `source.importText`, `analysis.runFixture`, `requirement.update`, `requirements.reorder`, `baseline.publish`, and `prd.render`, plus the reserved `analysis.runHarnessModel` variant that is never shown in the Stage 3A Client and always returns `stage-unavailable`.
- All protocol schemas are strict at Client send, Host receive, Host return, and Client receive. Outer errors have empty details and never echo source text, quotes, paths, stack traces, model output, Zod input, or `Error.message`.
- Host permits at most `16` in-flight requests; Client permits at most `8`. Host teardown order is stop admissions, unregister route, abort, drain requests and writes, close repository, close Domain. Client unregisters overlay and launcher, aborts requests, disposes state, and restores launcher focus after normal close.
- First version limits are fixed: 20 active projects, 1024-tombstone create threshold, 1044 total rows, 24 requirements, 96 evidence items, 8 baselines, 8 PRDs, 256 receipts, 4 MiB canonical active record, 2048-byte tombstone, and 262144-byte Markdown.
- One evidence quote is at most 4000 code points and 16384 UTF-8 bytes; all evidence quotes in one project total at most 131072 UTF-8 bytes. Each requirement has at most 20 assumptions and 20 unknowns; each entry is at most 500 code points/2048 UTF-8 bytes, each category totals at most 8192 bytes per requirement, and both categories total at most 65536 bytes per analysis.
- Requirement `title`, `painPoint`, `description`, and `rationale`, plus `humanReason`, are each at most 2000 code points and 8192 UTF-8 bytes; a stricter field schema may lower a limit but never raise it.
- The profile active-record total is derived as `20 × 4194304 = 83886080` bytes, not implemented as a cross-row CAS quota. Project summaries are derived from active table rows; there is no second catalog that can diverge.
- Production project deletion uses one `table.update` from active record to tombstone. `table.delete` appears only in the compile-only public-surface proof and is never used for the Product delete command.
- Endpoint canonical `{ endpoint, input }` / `{ endpoint, outcome }` budgets are fixed: `health` 4096/16384; `projects.list` 4096/131072; `projects.get` 4096/1048576; `sources.get` 4096/786432; `artifacts.getMarkdown` 4096/786432; `projects.command` 786432/262144 bytes.
- Before every durable write, validate the complete candidate record and every public projection that remains readable from it. Reject the whole command on overflow; never truncate a successful record or response.
- Client-side storage must not contain project text, evidence, requirements, baselines, or PRDs. `localStorage`, `sessionStorage`, and IndexedDB are not product persistence mechanisms.
- Stage 2 Probe source/tests/report remain historical evidence. Product production entrypoints, metafiles, packed JavaScript, and runtime route must exclude Probe and Demo code.
- No push, pull request, merge, publication, deployment, current-profile installation, model authorization, or real-data authorization is in this plan.

---

## File and Responsibility Map

The following structure is frozen before implementation. A task may modify a file created by an earlier task, but it must not move responsibilities across these boundaries.

| Path | Responsibility |
| --- | --- |
| `packages/workbench/src/domain/ids.ts` | Canonical lowercase UUID v4 and lowercase SHA-256 branded schemas. |
| `packages/workbench/src/domain/limits.ts` | Every code-point, UTF-16, UTF-8, collection, record, tombstone, PRD, and RPC budget constant. |
| `packages/workbench/src/domain/model.ts` | Pure immutable Stage 3A data types and strict stored-record schemas. |
| `packages/workbench/src/domain/text.ts` | UTF-8/BOM/NUL/surrogate validation and bounded text helpers. |
| `packages/workbench/src/domain/evidence.ts` | Exact source citation and cross-identity validation. |
| `packages/workbench/src/domain/requirements.ts` | Generated draft, human revision, decision, include-support, reorder, and review-lock rules. |
| `packages/workbench/src/domain/baseline.ts` | Deep immutable snapshot creation and current/stale rules. |
| `packages/workbench/src/domain/prd.ts` | Deterministic `pmwb-prd-v1` Markdown renderer and hash. |
| `packages/workbench/src/analysis/types.ts` | `InsightEngine`, input, and candidate contracts. |
| `packages/workbench/src/analysis/fixture-manifest.ts` | One built-in synthetic interview, its hash, evidence, and deterministic requirement candidates. |
| `packages/workbench/src/analysis/fixture-engine.ts` | Manifest-bound Stage 3A analysis; rejects every unlisted source hash. |
| `packages/workbench/src/application/clock.ts` | Injected Host clock; fixed clock for tests. |
| `packages/workbench/src/application/project-views.ts` | Bounded `ProjectSummary`, `ProjectView`, `SourceView`, and `MarkdownView` projections. |
| `packages/workbench/src/application/receipts.ts` | Canonical request hashes and compact idempotency receipts. |
| `packages/workbench/src/application/project-repository.ts` | Table adapter, membership/project serialization, CAS, tombstones, durable failure, and close. |
| `packages/workbench/src/application/project-service.ts` | Eight Stage 3A command workflows and commit-before-return orchestration. |
| `packages/workbench/src/application/product-handler.ts` | Strict Product endpoint dispatch and safe closed errors. |
| `packages/workbench/src/protocol/canonical-json.ts` | Browser-safe canonical serialization and UTF-8 measurement using `TextEncoder`; no hashing or Node globals. |
| `packages/workbench/src/application/node-sha256.ts` | Host-only synchronous SHA-256 through `node:crypto`, injected into domain/application operations. |
| `packages/workbench/src/protocol/product.ts` | Product channel, capabilities, strict endpoint registry, request/outcome schemas, and budgets. |
| `packages/workbench/src/integration/harness-rc6/project-domain.ts` | Final `defineDomain`/`domainTable` declaration and public `KvTable` adapter. |
| `packages/workbench/src/integration/harness-rc6/product-host.ts` | Public Connection RPC registration and ordered Host lifecycle. |
| `packages/workbench/src/client/workbench/material-input.ts` | Pasted/file input decoding and ephemeral Client preflight. |
| `packages/workbench/src/client/workbench/web-sha256.ts` | Client-only asynchronous SHA-256 through `crypto.subtle.digest`; no Buffer or Node shim. |
| `packages/workbench/src/client/workbench/transport.ts` | Eight-admission Connection RPC Client with response correlation and hash checks. |
| `packages/workbench/src/client/workbench/store.ts` | Authoritative read state, ephemeral drafts, CAS retry/refresh, uncertain outcome, and lifecycle. |
| `packages/workbench/src/client/workbench/browser-port.ts` | Injected clipboard and Markdown-download side effects. |
| `packages/workbench/src/client/workbench/WorkbenchView.tsx` | Accessible overlay and four-area orchestration. |
| `packages/workbench/src/client/workbench/ProjectList.tsx` | Project creation, selection, limit state, and named deletion confirmation. |
| `packages/workbench/src/client/workbench/MaterialPane.tsx` | Synthetic warning, attestation, paste/file/fixture import, and local draft action. |
| `packages/workbench/src/client/workbench/RequirementsPane.tsx` | Evidence opening, human text revision, and empty evidence-safe state. |
| `packages/workbench/src/client/workbench/PriorityPane.tsx` | Priority, decision, reason, exact ordering, and scope confirmation. |
| `packages/workbench/src/client/workbench/PrdPane.tsx` | Current/stale preview, copy, and UTF-8 no-BOM download. |
| `packages/workbench/src/client/workbench/styles.ts` | Product-owned visual constants only; no Harness-private selectors. |
| `packages/workbench/src/client/probe/index.tsx` | Historical Stage 2 Probe mount retained only for its frozen unit tests; never imported by Product entry or build. |
| `packages/workbench/src/index.ts` | Product Host entry only. |
| `packages/workbench/src/client/index.tsx` | Additive Product launcher/overlay entry only. |
| `tests/product/helpers/fake-domain-table.ts` | Faithful public-shaped per-domain write-chain fake; returned objects are not defensively copied, matching rc.6. |
| `tests/product/helpers/synthetic-records.ts` | Valid small, near-4-MiB, over-limit, and tombstone test records with no real data. |
| `tests/probe/helpers/stage2-build-graph.ts` | Frozen Stage 2 Probe graph assertion helper used only by historical tests after Product becomes production. |
| `tests/integration/fixtures/stage3a-storage-gate/` | Self-contained test-only diagnostic package with exact build inputs; it imports no Product source and exercises the rc.6 table through stable UI markers. |
| `scripts/run-stage-3a-storage-surface-gate.mjs` | Fresh-profile real table/restart/tombstone/near-limit runner. |
| `scripts/verify-stage-3a-storage-surface-result.mjs` | Closed-schema, sanitization, hash, and cleanup verifier for the storage gate. |
| `scripts/run-stage-3a-isolated-smoke.mjs` | Fresh-package full Product UI, persistence, lifecycle, and cleanup runner. |
| `scripts/verify-stage-3a-smoke-result.mjs` | Independent full-smoke result verifier and Markdown report renderer. |

## Execution Gates

This plan is committed before Task 1 with the exact subject `docs: plan stage 3a workbench core`. That commit is the implementation review base; no production code is changed in the plan commit.

1. Task 1 must prove the required public rc.6 declarations. A private import or missing method stops Stage 3A.
2. Task 3 must produce a verified `PASS` from a real storage-surface tgz and fresh profile. A fake-table pass, build pass, or config listing cannot substitute for it.
3. Task 11 must produce a new frozen Product tgz hash and Product-only build-graph receipt before the full runtime smoke.
4. Task 12 must produce an independently verified `PASS` before any claim that Stage 3A works in DeepSeek Harness.

---

### Task 1: Freeze the public rc.6 Product surface

**Files:**

- Create: `tests/types/harness-host-rc6-product-surface.ts`
- Create: `tests/types/harness-client-rc6-product-surface.ts`
- Create: `tsconfig.stage3a.surface.host.json`
- Create: `tsconfig.stage3a.surface.client.json`
- Modify: `tests/contract/harness-rc6-public-surface.test.ts`
- Modify: `tests/integration/rc6-declaration-input.test.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`
- Create: `research/2026-09-07-stage-3a-product-surface.md`

**Interfaces:**

- Consumes: public `defineDomain`, `domainTable`, `DomainFacility.open`, `Domain.table`, `KvTable.get/entries/keys/size/put/update/delete`, `Domain.close`, `ConnectionRpcHandler`, `HostConnectionHandle.rpc.handle`, `ConnectionHandle.rpc.call`, and public slot registration.
- Produces: compile-only proof for channel `/dsh-pm-workbench-product-v1`, table `projects`, Product launcher, and Product overlay. It produces no runtime implementation.

- [ ] **Step 1: Write the failing Host and Client compile fixtures**

```ts
// tests/types/harness-host-rc6-product-surface.ts
import '@deepseek-ai/dsh-client-connection'
import '@deepseek-ai/dsh-storage-domain'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

type ProjectId = string & { readonly __projectId: unique symbol }
const recordSchema = z.strictObject({ kind: z.literal('surface'), version: z.number().int() })
const spec = defineDomain({
  name: 'dsh_pm_workbench_product_surface',
  version: 1,
  tables: { projects: domainTable<ProjectId, z.infer<typeof recordSchema>>(recordSchema) },
})
declare const ctx: Context
declare const handler: ConnectionRpcHandler
const domain = await ctx.storageDomain.open(spec)
const projects = domain.table('projects')
const id = '00000000-0000-4000-8000-000000000000' as ProjectId
void projects.get(id)
void projects.entries()
void projects.keys()
void projects.size
await projects.put(id, { kind: 'surface', version: 1 })
const updated = await projects.update(id, current => ({ ...current, version: current.version + 1 }))
const deleted = await projects.delete(id)
const dispose = ctx.connection.rpc.handle('/dsh-pm-workbench-product-v1', handler, { authority: 'loopback' })
await dispose()
await domain.close()
void updated
void deleted
```

```tsx
// tests/types/harness-client-rc6-product-surface.ts
import '@deepseek-ai/dsh-client-connection/client'
import '@deepseek-ai/dsh-client-runtime/client'
import '@deepseek-ai/dsh-client-ui-layout/client'
import '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ReactElement } from 'react'

declare const ctx: ClientContext & { readonly connection: ConnectionHandle }
declare const signal: AbortSignal
declare function Launcher(): ReactElement | null
declare function Overlay(): ReactElement | null
await ctx.connection.rpc.call('/dsh-pm-workbench-product-v1', 'health', { apiVersion: 'pmwb-product-v1' }, signal)
ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
  { name: 'sidebar.footer.action', id: 'pm-workbench-product-launcher', order: 90 },
  Launcher,
))
ctx.slots.inject('shell.overlay', () => ctx.slots.register(
  { name: 'shell.overlay', id: 'pm-workbench-product-overlay', order: 90 },
  Overlay,
))
```

- [ ] **Step 2: Run RED**

Run:

```bash
./node_modules/.bin/tsc -p tsconfig.stage3a.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.stage3a.surface.client.json --noEmit
npm test -- tests/contract/harness-rc6-public-surface.test.ts tests/integration/rc6-declaration-input.test.ts
```

Expected: FAIL because the Stage 3A tsconfig files, fixture inventory, and Product surface assertions do not exist.

- [ ] **Step 3: Add isolated compiler configurations and public-surface guards**

Each tsconfig includes only its matching fixture, uses the same compiler options and exact rc.6 dependency closure as the Stage 2 fixture, and never imports an implementation or private package subpath. Extend the contract test to assert the two new files contain only public entrypoint imports and the Product route/table names. Record the observed signatures and package versions in `research/2026-09-07-stage-3a-product-surface.md`; state that compile success is declaration evidence, not runtime persistence evidence.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noImplicitAny": true,
    "skipLibCheck": false,
    "noEmit": true,
    "lib": ["ES2022", "DOM"],
    "types": ["node"]
  },
  "files": ["tests/types/harness-host-rc6-product-surface.ts"]
}
```

The Client configuration is identical except `lib` is `["ES2022", "DOM", "DOM.Iterable"]`, `types` is `[]`, and `files` contains only `tests/types/harness-client-rc6-product-surface.ts`.

- [ ] **Step 4: Run GREEN**

```bash
./node_modules/.bin/tsc -p tsconfig.stage3a.surface.host.json --noEmit
./node_modules/.bin/tsc -p tsconfig.stage3a.surface.client.json --noEmit
npm test -- tests/contract/harness-rc6-public-surface.test.ts tests/integration/rc6-declaration-input.test.ts
npm run typecheck
```

Expected: both compile fixtures and focused contracts PASS; Stage 2 surface fixtures remain unchanged and passing.

- [ ] **Step 5: Commit**

```bash
git add tests/types/harness-host-rc6-product-surface.ts tests/types/harness-client-rc6-product-surface.ts tsconfig.stage3a.surface.host.json tsconfig.stage3a.surface.client.json tests/contract/harness-rc6-public-surface.test.ts tests/integration/rc6-declaration-input.test.ts tests/fixtures/standalone-source-manifest.json research/2026-09-07-stage-3a-product-surface.md
git diff --cached --check
git commit -m "test: freeze stage 3a public surface"
```

**Stop condition:** any required table, route, Client call, slot, or close operation requires a private import, copied descriptor, or untyped cast.

---

### Task 2: Define the stored record boundary and faithful table fake

**Files:**

- Create: `packages/workbench/src/domain/ids.ts`
- Create: `packages/workbench/src/domain/limits.ts`
- Create: `packages/workbench/src/domain/model.ts`
- Create: `packages/workbench/src/protocol/canonical-json.ts`
- Create: `packages/workbench/src/application/node-sha256.ts`
- Create: `packages/workbench/src/integration/harness-rc6/project-domain.ts`
- Create: `tests/product/helpers/fake-domain-table.ts`
- Create: `tests/product/helpers/synthetic-records.ts`
- Create: `tests/product/stored-record.test.ts`
- Create: `tests/product/storage-table-adapter.test.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`

**Interfaces:**

- Produces: `ProjectId`, all Stage 3A immutable record types, `storedProjectRecordSchema`, browser-safe `canonicalJson(value)` / `canonicalJsonUtf8Bytes(value)`, Host-only `nodeSha256Utf8(value)`, `projectDomainSpec`, `openProjectsTable(ctx)`, and a test fake matching public `KvTable<ProjectId, StoredProjectRecord>` behavior.
- `StoredProjectRecord` is exactly `ActiveProjectRecord | DeletedProjectTombstone`; a tombstone contains only `kind`, `schemaVersion`, `projectId`, `deletedAt`, `deleteCommandId`, `deleteRequestHash`, and compact `deleteOutcome`.

```ts
export interface ActiveProjectRecord {
  readonly kind: 'active'
  readonly schemaVersion: 1
  readonly header: ProjectHeader
  readonly source: SourceRevision | null
  readonly analyses: readonly AnalysisRevision[]
  readonly currentAnalysisRevisionId: AnalysisRevisionId | null
  readonly evidence: readonly EvidenceExcerpt[]
  readonly generatedRequirements: readonly GeneratedRequirementDraft[]
  readonly humanRevisions: readonly HumanRequirementRevision[]
  readonly humanDecisions: readonly HumanDecision[]
  readonly requirementOrder: readonly RequirementId[]
  readonly baselines: readonly RequirementBaseline[]
  readonly currentBaselineId: BaselineId | null
  readonly prdRevisions: readonly PrdRevision[]
  readonly commandReceipts: readonly ProjectCommandReceipt[]
}

export interface DeletedProjectTombstone {
  readonly kind: 'deleted'
  readonly schemaVersion: 1
  readonly projectId: ProjectId
  readonly deletedAt: string
  readonly deleteCommandId: CommandId
  readonly deleteRequestHash: Sha256Hex
  readonly deleteOutcome: DeleteProjectAcceptedOutcome
}
```

- [ ] **Step 1: Write failing schema, byte-limit, and fake-table tests**

```ts
it('keeps a rejected durable write out of visible memory and preserves the queue', async () => {
  const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>()
  fake.rejectNextWrite(new Error('synthetic durable failure'))
  await expect(fake.put(SMALL_PROJECT_ID, makeSmallActiveRecord())).rejects.toThrow()
  expect(fake.get(SMALL_PROJECT_ID)).toBeUndefined()
  await fake.put(SMALL_PROJECT_ID, makeSmallActiveRecord())
  expect(fake.get(SMALL_PROJECT_ID)?.kind).toBe('active')
})

it('replaces an active record with a body-free tombstone in one update', async () => {
  const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>([[SMALL_PROJECT_ID, makeSmallActiveRecord()]])
  const tombstone = makeTombstone()
  await fake.update(SMALL_PROJECT_ID, () => tombstone)
  expect(storedProjectRecordSchema.parse(fake.get(SMALL_PROJECT_ID))).toEqual(tombstone)
  expect(JSON.stringify(tombstone)).not.toMatch(/project name|source|evidence|markdown/i)
})

it('accepts the largest generated record below 4194304 bytes and rejects the next byte budget', () => {
  expect(canonicalJsonUtf8Bytes(makeNearLimitActiveRecord())).toBeLessThanOrEqual(4_194_304)
  expect(() => assertStoredRecordBudget(makeOverLimitActiveRecord())).toThrowError('limit-exceeded')
})
```

Also cover strict discriminants, lowercase UUID/hash, invalid dates, unpaired surrogate rejection, project-name 120/121-code-point and 512-byte boundaries, research-goal null plus 500/501-code-point and 2048-byte boundaries, 2048-byte tombstone ceiling, application/repository code never mutating returned objects, update-at-queue-slot semantics, missing-key rejection, close rejecting new writes, and queued writes draining before close resolves.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/stored-record.test.ts tests/product/storage-table-adapter.test.ts
```

Expected: FAIL because the Stage 3A model, project domain, canonical JSON helper, synthetic builders, and faithful fake do not exist.

- [ ] **Step 3: Implement the immutable storage boundary**

```ts
export const projectDomainSpec = defineDomain({
  name: 'dsh_pm_workbench_projects',
  version: 1,
  tables: {
    projects: domainTable<ProjectId, StoredProjectRecord>(storedProjectRecordSchema),
  },
})

export async function openProjectsTable(ctx: Context) {
  const domain = await ctx.storageDomain.open(projectDomainSpec)
  return Object.freeze({ domain, table: domain.table('projects') })
}
```

Use a recursive canonical JSON serializer that sorts object keys, preserves array order, rejects non-JSON values and unpaired surrogates, and measures `new TextEncoder().encode(serialized).byteLength`. It must not reference `Buffer`, `node:crypto`, `crypto.subtle`, or another environment-specific global. `application/node-sha256.ts` uses `createHash('sha256')` only in the Host graph; domain functions receive that hash function as an explicit dependency rather than importing a browser API.

The fake queues every write on one settled per-domain tail, awaits its injected durable operation before changing visible memory, reads the current record inside the queued `update`, returns the stored object from `get`, returns stable pair/key iterator snapshots without deep-copying values, and makes `close()` idempotently reject new writes while draining accepted writes.

The synthetic near-limit builder uses only repeated neutral strings and valid Stage 3A fields; it returns a schema-valid active record whose canonical bytes are within 4096 bytes below `4194304`. The over-limit builder adds one bounded field increment that crosses the plugin quota; it does not depend on a storage backend failure.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- tests/product/stored-record.test.ts tests/product/storage-table-adapter.test.ts
npm run typecheck
```

Expected: focused tests PASS; the final Domain has exactly one `projects` table and no global state.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/src/domain/ids.ts packages/workbench/src/domain/limits.ts packages/workbench/src/domain/model.ts packages/workbench/src/protocol/canonical-json.ts packages/workbench/src/application/node-sha256.ts packages/workbench/src/integration/harness-rc6/project-domain.ts tests/product/helpers/fake-domain-table.ts tests/product/helpers/synthetic-records.ts tests/product/stored-record.test.ts tests/product/storage-table-adapter.test.ts tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "feat: define stage 3a storage boundary"
```

---

### Task 3: Pass the real Product storage-surface gate

**Files:**

- Create: `tests/integration/fixtures/stage3a-storage-gate/host.ts`
- Create: `tests/integration/fixtures/stage3a-storage-gate/client.tsx`
- Create: `tests/integration/fixtures/stage3a-storage-gate/record.ts`
- Create: `tests/integration/fixtures/stage3a-storage-gate/build.mjs`
- Create: `tests/integration/fixtures/stage3a-storage-gate/package.json`
- Create: `tests/integration/fixtures/stage3a-storage-gate/cordis.patch.yml`
- Create: `scripts/run-stage-3a-storage-surface-gate.mjs`
- Create: `scripts/verify-stage-3a-storage-surface-result.mjs`
- Create: `tests/integration/stage-3a-storage-surface-runner.test.ts`
- Create: `tests/integration/stage-3a-storage-surface-result-boundary.test.ts`
- Modify: `package.json`
- Modify: `tests/fixtures/standalone-source-manifest.json`
- Create after a verified real run: `docs/gate-results/stage-3a-storage-surface.md`

**Interfaces:**

- Consumes: only the public rc.6 Connection/storage packages, React public Client runtime, Zod, and its own self-contained synthetic record/schema/build files.
- Produces: a test-only tgz and closed sanitized receipt proving real rc.6 `put → restart → get`, active-to-tombstone `update → restart → hidden-from-the-gate's active-record view`, near-limit `put → restart → identical bytes/hash`, and over-quota rejection before backend invocation.
- The storage gate proves the generic public table/restart/size behavior required by Product; it does not claim that the later Product record schema or public projections have passed. The final Product record/persistence path is independently exercised in Task 12.
- The diagnostic package imports nothing from `packages/workbench/src/**` and never enters `@knight/dsh-pm-workbench` production files or build graphs.

- [ ] **Step 1: Write failing runner and result-verifier tests**

```ts
it('requires every real table witness before PASS', () => {
  const result = makeStorageGateResult({ nearLimitHashAfterRestart: null })
  expect(() => verifyStage3aStorageSurfaceResult(result)).toThrowError('missing-near-limit-restart-witness')
})

it('rejects leaked paths and material payloads', () => {
  const result = makeStorageGateResult({ note: ['', 'private', 'profile', 'source text'].join('/') })
  expect(() => verifyStage3aStorageSurfaceResult(result)).toThrowError('unsafe-result-field')
})

it('freezes a self-contained package with no Product-source imports', async () => {
  const receipt = await buildStorageGateFixture()
  expect(receipt.packageFiles).toEqual([
    'package/cordis.patch.yml', 'package/lib/client.js', 'package/lib/index.js', 'package/package.json',
  ])
  expect(Object.keys(receipt.hostMetafile.inputs).join('\n')).not.toContain('packages/workbench/src/')
  expect(Object.keys(receipt.clientMetafile.inputs).join('\n')).not.toContain('packages/workbench/src/')
})

it('always removes a marker-owned run root after child shutdown', async () => {
  const run = await runStorageGateWithFakes({ backend: 'pass' })
  expect(run.listenerCountAfterCleanup).toBe(0)
  expect(run.runRootExistsAfterCleanup).toBe(false)
})
```

Runner tests must inject process, filesystem, CDP, pack, and executable-verification ports. Cover forbidden port `3080`, non-canonical or symlink tool input, package identity mismatch, external page-target request, backend write failure, restart read mismatch, tombstone still visible, near-limit hash mismatch, over-quota backend invocation, verifier rejection, child/listener leak, and cleanup failure.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/integration/stage-3a-storage-surface-runner.test.ts tests/integration/stage-3a-storage-surface-result-boundary.test.ts
```

Expected: FAIL because the diagnostic package, runner, verifier, and scripts do not exist.

- [ ] **Step 3: Build the test-only UI gate and isolated runner**

The diagnostic package identity is `@knight/dsh-pm-workbench-storage-gate@0.0.0-stage3a`, its Cordis row ID is `dsh-pm-workbench-storage-gate`, its Domain name is `dsh_pm_workbench_storage_gate`, and its test-only loopback channel is `/dsh-pm-workbench-stage3a-storage-gate-v1`. `record.ts` owns a minimal strict union `{ kind: 'active'; id; bytes; hash; padding } | { kind: 'deleted'; id; deletedAt; deleteCommandId; requestHash }`; it is deliberately not the Product model. `build.mjs` has literal Host/Client source allowlists, exact public external allowlists, Zod bundling checks, and an exact four-file tgz inventory. The production package verifier must reject all diagnostic package/channel/domain strings from `@knight/dsh-pm-workbench` output.

The diagnostic Client exposes only these stable markers and hash/byte witnesses, never record text:

```text
data-dsh-pm-storage-gate="write-small"
data-dsh-pm-storage-gate="read-small"
data-dsh-pm-storage-gate="write-tombstone"
data-dsh-pm-storage-gate="read-tombstone"
data-dsh-pm-storage-gate="write-near-limit"
data-dsh-pm-storage-gate="read-near-limit"
data-dsh-pm-storage-gate="reject-over-limit"
data-dsh-pm-storage-gate="status"
```

The runner invokes the fixture's committed `build.mjs`, copies only its verified four-file pack tree into the owned run root, creates one real tgz, freezes its bytes/SHA-256/metafiles, installs offline, and drives actual pointer input through Chrome. It rejects any build input outside the fixture directory plus bundled Zod. It restarts Harness and Chrome between durable phases. It records only closed booleans, counts, versions, byte counts, and hashes. The verifier emits Markdown only after all children/listeners are stopped, the run root is deleted, and absence is checked.

Add scripts:

```json
{
  "smoke:stage3a:storage": "node --experimental-strip-types scripts/run-stage-3a-storage-surface-gate.mjs",
  "verify:stage3a:storage": "node --experimental-strip-types scripts/verify-stage-3a-storage-surface-result.mjs"
}
```

- [ ] **Step 4: Run deterministic runner tests GREEN**

```bash
npm test -- tests/integration/stage-3a-storage-surface-runner.test.ts tests/integration/stage-3a-storage-surface-result-boundary.test.ts
npm run typecheck
git diff --check
```

Expected: injected runner and verifier tests PASS without starting the user's Harness or using port `3080`.

- [ ] **Step 5: Commit the runner before executing it**

```bash
git add tests/integration/fixtures/stage3a-storage-gate tests/integration/stage-3a-storage-surface-runner.test.ts tests/integration/stage-3a-storage-surface-result-boundary.test.ts scripts/run-stage-3a-storage-surface-gate.mjs scripts/verify-stage-3a-storage-surface-result.mjs package.json tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "test: add stage 3a storage surface gate"
```

- [ ] **Step 6: Collect ephemeral absolute tool inputs and run the real gate**

In one zsh session, enter six absolute paths obtained from the current host. The runner must resolve and verify each input before first use and again before every later use: absolute canonical non-symlink regular file, required executable bit, device/inode/size/SHA-256 stability, Node identity, npm/pnpm package-and-bin identity, DSH package-and-bin identity exactly `@deepseek-ai/dsh@0.1.0-rc.6`, and Chrome identity. Do not infer a path from `PATH`, a shebang, npm configuration, Corepack, `npx`, or a package-manager wrapper. The values remain shell variables and must not be written to Git or the sanitized result.

```bash
read -r "STAGE3A_NODE?Absolute canonical Node file: "
read -r "STAGE3A_DSH_CLI?Absolute canonical DSH rc.6 bin file: "
read -r "STAGE3A_NPM_CLI?Absolute canonical npm cli file: "
read -r "STAGE3A_PNPM_NODE?Absolute canonical pnpm Node file: "
read -r "STAGE3A_PNPM_CLI?Absolute canonical pnpm cli file: "
read -r "STAGE3A_CHROME?Absolute canonical Chrome executable: "
STAGE3A_STORAGE_OUTPUT_ROOT="$(mktemp -d "${TMPDIR%/}/dsh-pmwb-stage3a-storage-report.XXXXXX")"
"$STAGE3A_NODE" --experimental-strip-types scripts/run-stage-3a-storage-surface-gate.mjs \
  --node "$STAGE3A_NODE" \
  --dsh-cli "$STAGE3A_DSH_CLI" \
  --npm-cli "$STAGE3A_NPM_CLI" \
  --pnpm-node "$STAGE3A_PNPM_NODE" \
  --pnpm-cli "$STAGE3A_PNPM_CLI" \
  --chrome "$STAGE3A_CHROME" \
  --result "$STAGE3A_STORAGE_OUTPUT_ROOT/result.json"
"$STAGE3A_NODE" --experimental-strip-types scripts/verify-stage-3a-storage-surface-result.mjs \
  "$STAGE3A_STORAGE_OUTPUT_ROOT/result.json" \
  --markdown "$STAGE3A_STORAGE_OUTPUT_ROOT/report.md"
```

Expected: verifier prints `STAGE3A_STORAGE_SURFACE=PASS`; the listener count is zero, the owned run root is absent, and the Markdown contains no absolute path or source content. If an executable identity has changed, stop and update the invocation only after validating the replacement; do not relax the runner.

- [ ] **Step 7: Commit only the independently verified sanitized report**

```bash
cp "$STAGE3A_STORAGE_OUTPUT_ROOT/report.md" docs/gate-results/stage-3a-storage-surface.md
npm test -- tests/integration/stage-3a-storage-surface-result-boundary.test.ts
git add docs/gate-results/stage-3a-storage-surface.md
git diff --cached --check
git commit -m "docs: record stage 3a storage surface pass"
rm -rf "$STAGE3A_STORAGE_OUTPUT_ROOT"
```

**Stop condition:** any real-table phase is `FAIL`, `INCONCLUSIVE`, unobservable through the test-owned UI, requires raw RPC/private DOM, leaks data/path/logs, touches port `3080`, or cannot prove cleanup.

---

### Task 4: Implement source, evidence, and manifest-bound Fixture analysis

**Files:**

- Create: `packages/workbench/src/domain/text.ts`
- Create: `packages/workbench/src/domain/evidence.ts`
- Create: `packages/workbench/src/analysis/types.ts`
- Create: `packages/workbench/src/analysis/fixture-manifest.ts`
- Create: `packages/workbench/src/analysis/fixture-engine.ts`
- Create: `tests/product/domain-text.test.ts`
- Create: `tests/product/domain-evidence.test.ts`
- Create: `tests/product/fixture-engine.test.ts`
- Modify: `packages/workbench/src/domain/model.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`

**Interfaces:**

- Produces: `decodeMaterialFile(bytes, format, displayName)`, `validatePersistedSource(source)`, `validateEvidence(source, evidence)`, `validateAnalysisCandidate(input, candidate)`, `InsightEngine.analyse(input, signal)`, and `FixtureInsightEngine`.
- `FixtureInsightEngine` returns one complete immutable candidate only when `source.contentHash` equals the built-in manifest hash; abort or one invalid citation returns no partial candidate.

- [ ] **Step 1: Write failing boundary and tamper tests**

```ts
it.each([
  { start: -1, end: 1 },
  { start: 0.5, end: 1 },
  { start: 2, end: 2 },
  { start: 0, end: Number.NaN },
])('rejects unsafe evidence offsets %#', ({ start, end }) => {
  expect(() => validateEvidence(SOURCE_WITH_EMOJI, makeEvidence({ start, end }))).toThrowError('invalid-evidence')
})

it('rejects a boundary that splits a surrogate pair', () => {
  const source = makeSource('A😀B')
  expect(() => validateEvidence(source, makeEvidence({ start: 1, end: 2, quote: '\ud83d' }))).toThrowError('invalid-evidence')
})

it('never analyses an unlisted source hash', async () => {
  const engine = new FixtureInsightEngine(FIXTURE_MANIFEST)
  await expect(engine.analyse(makeAnalysisInput('stranger synthetic text'), new AbortController().signal))
    .rejects.toMatchObject({ code: 'fixture-not-allowed' })
})
```

Cover exact raw/persisted 262144-byte boundaries, 80000/80001 UTF-16 units, UTF-8 fatal decode, one leading BOM, interior BOM preservation, CRLF/LF preservation, empty-after-trim, NUL, lone high/low surrogate, emoji offsets, quote/hash mismatch, wrong project/source, duplicate evidence IDs, missing evidence IDs, 24/96 collection limits, 4000-code-point/16384-byte quote, 131072-byte quote aggregate, assumptions/unknown counts and aggregate bytes, and abort before/after Fixture validation.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/domain-text.test.ts tests/product/domain-evidence.test.ts tests/product/fixture-engine.test.ts
```

Expected: FAIL because the source/evidence helpers and manifest-bound engine do not exist.

- [ ] **Step 3: Implement exact validation and one built-in synthetic manifest**

```ts
export interface InsightEngine {
  analyse(input: AnalysisInput, signal: AbortSignal): Promise<AnalysisCandidate>
}

export class FixtureInsightEngine implements InsightEngine {
  constructor(
    private readonly manifest: FixtureManifest,
    private readonly sha256Utf8: (value: string) => Sha256Hex,
  ) {}
  async analyse(input: AnalysisInput, signal: AbortSignal): Promise<AnalysisCandidate> {
    signal.throwIfAborted()
    const fixture = this.manifest.sources[input.source.contentHash]
    if (!fixture) throw new DomainFailure('fixture-not-allowed')
    const candidate = structuredClone(fixture.candidate)
    validateAnalysisCandidate(input, candidate, this.sha256Utf8)
    signal.throwIfAborted()
    return deepFreeze(candidate)
  }
}
```

Write one neutral Chinese synthetic interview that contains repeated wording and a counterexample so evidence roles can be tested. Compute and freeze its final UTF-8 hash and exact offsets in the manifest test; never derive generic requirements from arbitrary text. Keep old `src/demo/**` code and tests independent and unchanged.

- [ ] **Step 4: Run GREEN and Demo regressions**

```bash
npm test -- tests/product/domain-text.test.ts tests/product/domain-evidence.test.ts tests/product/fixture-engine.test.ts
npm test -- tests/demo/material.test.ts tests/demo/fixture-provider.test.ts
npm run typecheck
```

Expected: Product tests and existing Demo regressions PASS; no Product source imports from `src/demo/**`.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/src/domain/text.ts packages/workbench/src/domain/evidence.ts packages/workbench/src/domain/model.ts packages/workbench/src/analysis/types.ts packages/workbench/src/analysis/fixture-manifest.ts packages/workbench/src/analysis/fixture-engine.ts tests/product/domain-text.test.ts tests/product/domain-evidence.test.ts tests/product/fixture-engine.test.ts tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "feat: add evidence bound fixture analysis"
```

---

### Task 5: Implement human review, immutable baseline, and deterministic PRD

**Files:**

- Create: `packages/workbench/src/domain/requirements.ts`
- Create: `packages/workbench/src/domain/baseline.ts`
- Create: `packages/workbench/src/domain/prd.ts`
- Create: `tests/product/domain-requirements.test.ts`
- Create: `tests/product/baseline-prd.test.ts`
- Modify: `packages/workbench/src/domain/model.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`

**Interfaces:**

- Produces: `applyRequirementUpdate`, `applyRequirementOrder`, `publishRequirementBaseline`, `isPrdCurrent`, and `DeterministicPrdRenderer.render`.
- `publishRequirementBaseline` accepts only current decisions, at least one `include`, and at least one valid `support` evidence for every included item; it deep-copies all PRD inputs.

- [ ] **Step 1: Write failing review/baseline/renderer tests**

```ts
it('creates a human revision without overwriting generated evidence or rationale', () => {
  const next = applyRequirementUpdate(REVIEWABLE_PROJECT, updateTitleCommand('新的人工标题'))
  expect(next.generatedRequirements[0]).toEqual(REVIEWABLE_PROJECT.generatedRequirements[0])
  expect(next.humanRevisions.at(-1)?.title).toBe('新的人工标题')
  expect(next.reviewStarted).toBe(true)
})

it('deep copies included content into an immutable baseline', () => {
  const baseline = publishRequirementBaseline(INCLUDED_PROJECT, FIXED_CLOCK)
  const mutated = structuredClone(INCLUDED_PROJECT)
  mutated.humanDecisions[0].humanReason = 'changed later'
  expect(baseline.items[0].humanReason).not.toBe('changed later')
})

it('renders identical bytes and hash from the same baseline', () => {
  const first = renderer.render({ baseline: BASELINE, prdRevisionId: PRD_ID, createdAt: FIRST_TIME })
  const second = renderer.render({ baseline: BASELINE, prdRevisionId: PRD_ID, createdAt: SECOND_TIME })
  expect(Buffer.from(first.markdown, 'utf8')).toEqual(Buffer.from(second.markdown, 'utf8'))
  expect(first.contentHash).toBe(second.contentHash)
  expect(first.markdown.charCodeAt(0)).not.toBe(0xfeff)
})
```

Cover exact permutation/no duplicates, no support evidence cannot include, generated/human `selectedText` identity, high/medium/low, pending/include/defer/reject, optional reason limits, review lock on every review action, baseline minimum/maximum, baseline deep-copy identity fields, current/stale rules, eight-baseline/eight-PRD ceilings, Markdown/HTML/pipe/backtick/footnote escaping, required nine headings, trace IDs/hashes, no invented market size/schedule/revenue/cost/metric/technical plan, and 262144-byte PRD rejection without truncation.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/domain-requirements.test.ts tests/product/baseline-prd.test.ts
```

Expected: FAIL because review, baseline, and renderer functions do not exist.

- [ ] **Step 3: Implement pure immutable transformations**

```ts
export interface PrdRenderer {
  render(input: CurrentBaselineInput): PrdRevision
}

export class DeterministicPrdRenderer implements PrdRenderer {
  constructor(private readonly sha256Utf8: (value: string) => Sha256Hex) {}
  render(input: CurrentBaselineInput): PrdRevision {
    const markdown = renderPmwbPrdV1(input.baseline)
    assertUtf8Budget(markdown, LIMITS.prdMarkdownBytes)
    return deepFreeze({
      id: input.prdRevisionId,
      projectId: input.baseline.projectId,
      sourceRevisionId: input.baseline.sourceRevisionId,
      baselineId: input.baseline.id,
      baselineContentVersion: input.baseline.contentVersion,
      rendererVersion: 'pmwb-prd-v1',
      contentHash: this.sha256Utf8(markdown),
      markdown,
      createdAt: input.createdAt,
    })
  }
}
```

The renderer writes the nine required Chinese sections in a fixed order. Unsupported business facts render as `待产品经理补充`; generated acceptance criteria render with `建议`; deferred/rejected items do not become invented non-scope claims. Trace rows include project ID, source revision/hash, baseline ID, requirement ID, generated draft or human revision ID, evidence offsets/quote hash, and renderer version.

- [ ] **Step 4: Run GREEN and Demo regressions**

```bash
npm test -- tests/product/domain-requirements.test.ts tests/product/baseline-prd.test.ts
npm test -- tests/demo/requirements.test.ts tests/demo/prd.test.ts tests/demo/state.test.ts
npm run typecheck
```

Expected: Product and Demo suites PASS; fixed metadata clock changes do not change Markdown bytes.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/src/domain/model.ts packages/workbench/src/domain/requirements.ts packages/workbench/src/domain/baseline.ts packages/workbench/src/domain/prd.ts tests/product/domain-requirements.test.ts tests/product/baseline-prd.test.ts tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "feat: add review baseline and deterministic prd"
```

---

### Task 6: Freeze the strict Product RPC and bounded projections

**Files:**

- Create: `packages/workbench/src/protocol/product.ts`
- Create: `packages/workbench/src/application/project-views.ts`
- Create: `tests/product/protocol.test.ts`
- Create: `tests/product/project-views.test.ts`
- Modify: `packages/workbench/src/protocol/canonical-json.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`

**Interfaces:**

- Produces: `PRODUCT_RPC_CHANNEL`, `PRODUCT_CAPABILITIES`, `productEndpointRegistry`, endpoint-specific parsers, `ProjectSummary`, `ProjectView`, `SourceView`, `MarkdownView`, `projectSummaryOf`, `projectViewOf`, `sourceViewOf`, and `markdownViewOf`.
- `ProjectView` contains current metadata/content plus at most eight PRD summaries; it never contains source text, Markdown, historical baseline items, or full human revision history.

- [ ] **Step 1: Write failing strict-schema and budget tests**

```ts
it('exposes six endpoints, nine schemas, and only eight Stage 3A executable commands', () => {
  expect(Object.keys(productEndpointRegistry)).toEqual([
    'health', 'projects.list', 'projects.get', 'sources.get', 'artifacts.getMarkdown', 'projects.command',
  ])
  expect(STAGE3A_COMMAND_KINDS).toEqual([
    'project.create', 'project.delete', 'source.importText', 'analysis.runFixture',
    'requirement.update', 'requirements.reorder', 'baseline.publish', 'prd.render',
  ])
  expect(PRODUCT_COMMAND_SCHEMA_KINDS).toEqual([
    ...STAGE3A_COMMAND_KINDS,
    'analysis.runHarnessModel',
  ])
})

it('rejects a valid-shaped outcome whose canonical envelope crosses its endpoint budget', () => {
  expect(() => parseProductOutcome('projects.get', oversizedProjectOutcome())).toThrowError('limit-exceeded')
})

it('keeps source and markdown out of ProjectView', () => {
  const view = projectViewOf(MAX_VALID_PROJECT)
  expect(JSON.stringify(view)).not.toContain(MAX_VALID_PROJECT.source?.text ?? 'unreachable')
  expect(JSON.stringify(view)).not.toContain(MAX_VALID_PROJECT.prdRevisions[0]?.markdown ?? 'unreachable')
})
```

Cover extra/missing fields, invalid API version, canonical UUID/hash, every command payload, exact endpoint budgets, unsafe integer/version, exact reorder permutation shape, request/outcome identity correlation, fixed closed error codes, safe outer error, maximum ProjectView, full SourceView, full MarkdownView, and eight PRD summaries.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/protocol.test.ts tests/product/project-views.test.ts
```

Expected: FAIL because Product schemas, registry, and projections do not exist.

- [ ] **Step 3: Implement the closed endpoint registry**

```ts
export const PRODUCT_RPC_CHANNEL = '/dsh-pm-workbench-product-v1' as const
export const PRODUCT_API_VERSION = 'pmwb-product-v1' as const
export const PRODUCT_CAPABILITIES = Object.freeze({
  wireSchemaVersion: '1',
  dataSchemaVersion: '1',
  analysisMode: 'fixture',
  modelAnalysis: false,
  realDataAllowed: false,
  maxHostInflightRequests: 16,
  maxClientInflightRequests: 8,
})

export const PRODUCT_ERROR_CODES = Object.freeze([
  'not-found', 'project-deleted', 'project-limit-reached', 'version-conflict',
  'idempotency-key-reused', 'receipt-capacity-reached', 'limit-exceeded',
  'synthetic-attestation-required', 'fixture-not-allowed', 'source-locked',
  'analysis-already-reviewed', 'invalid-evidence', 'no-included-requirements',
  'baseline-stale', 'stage-unavailable', 'cancelled', 'storage-failed',
] as const)
```

Every endpoint registry entry stores its strict input schema, strict outcome schema, request budget, outcome budget, and correlation function. A command outcome includes `projectId`, `commandId`, stable accepted/rejected status, and resulting version where applicable. `sources.get` correlates `projectId + sourceRevisionId`; `artifacts.getMarkdown` correlates `projectId + prdRevisionId`. Hash/byte fields describe the returned complete content.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- tests/product/protocol.test.ts tests/product/project-views.test.ts
npm run typecheck
```

Expected: focused tests PASS; `analysis.runHarnessModel` appears only in the strict schema and deterministic unavailable tests, while `rg "dsh-agent|dsh-llm|provider|model adapter" packages/workbench/src` finds no Stage 3A implementation import or adapter.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/src/protocol/product.ts packages/workbench/src/protocol/canonical-json.ts packages/workbench/src/application/project-views.ts tests/product/protocol.test.ts tests/product/project-views.test.ts tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "feat: define bounded product protocol"
```

---

### Task 7: Implement project repository, receipts, tombstones, and commands

**Files:**

- Create: `packages/workbench/src/application/clock.ts`
- Create: `packages/workbench/src/application/receipts.ts`
- Create: `packages/workbench/src/application/project-repository.ts`
- Create: `packages/workbench/src/application/project-service.ts`
- Create: `tests/product/project-repository.test.ts`
- Create: `tests/product/project-service.test.ts`
- Create: `tests/product/receipts-tombstone.test.ts`
- Create: `tests/product/write-readability-invariant.test.ts`
- Modify: `packages/workbench/src/application/project-views.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`

**Interfaces:**

- Produces: `Clock`, `ProjectRepository`, `TableProjectRepository`, `ProjectService`, `hashProjectCommandRequest`, all eight Stage 3A command handlers, and one deterministic receipt-aware `stage-unavailable` rejection for the reserved model command.
- `ProjectRepository.create`, `mutate`, and `deleteProject` return only after durable table completion; cancellation before durable admission writes nothing, while cancellation after a write starts drains and lets the Client classify an unobserved result as uncertain.

- [ ] **Step 1: Write failing concurrency, idempotency, and workflow tests**

```ts
it('allows exactly one of concurrent twentieth and twenty-first creates', async () => {
  const service = makeServiceWithActiveProjects(19)
  const outcomes = await Promise.all([
    service.command(createProjectCommand(PROJECT_20)),
    service.command(createProjectCommand(PROJECT_21)),
  ])
  expect(outcomes.filter(outcome => outcome.ok)).toHaveLength(1)
  expect(outcomes.filter(outcome => !outcome.ok && outcome.code === 'project-limit-reached')).toHaveLength(1)
})

it('replays the same delete and rejects every later command against the tombstone', async () => {
  const service = makeServiceWithProject(REVIEWABLE_PROJECT)
  const command = deleteProjectCommand(REVIEWABLE_PROJECT.header.projectVersion)
  const first = await service.command(command)
  expect(await service.command(command)).toEqual(first)
  expect(await service.command(updateRequirementCommand({ commandId: OTHER_COMMAND_ID })))
    .toMatchObject({ ok: false, code: 'project-deleted' })
})

it('rejects a candidate before table.update when any future read projection is too large', async () => {
  const { service, table } = makeServiceWithProject(MAX_VALID_PROJECT)
  const before = table.writeCount
  await expect(service.command(commandThatOverflowsMarkdownView())).resolves
    .toMatchObject({ ok: false, code: 'limit-exceeded' })
  expect(table.writeCount).toBe(before)
})

it('rejects the reserved model command before invoking an analysis engine', async () => {
  const { service, engine } = makeServiceWithProject(SOURCED_PROJECT)
  await expect(service.command(runHarnessModelCommand())).resolves.toMatchObject({
    ok: false,
    code: 'stage-unavailable',
  })
  expect(engine.analyse).not.toHaveBeenCalled()
})
```

Cover create `expectedVersion: 0`, client-originated IDs, `put` overwrite prevention, fixed lock order, create/delete interleaving, same-version concurrent mutation, request-hash replay/mismatch, accepted and business-rejected receipts, receipt capacity while delete remains allowed, old create retry after delete, deletion failure retaining active data, tombstone 1024/1044 thresholds, version/updatedAt/contentVersion rules, fixed-clock sorting, restart-equivalent reconstruction, import atomicity, Fixture rerun before review, analysis lock after review, stale generation, every review command, baseline and PRD limits, stale PRD retention, and empty project behavior.

The request hash binds endpoint, command kind, project ID, expected version, and the strict payload after removing only `commandId`. Test that changing any one of those fields under the same command ID returns `idempotency-key-reused`. Also test that a baseline can remain durably saved when PRD rendering fails, then the same current baseline can be retried without publishing a duplicate.

`tests/product/write-readability-invariant.test.ts` must construct the largest legal current source/analysis/review state while retaining eight deep baselines and eight PRD revisions. Assert that `projects.get` remains below its complete outcome-envelope budget, each retained `artifacts.getMarkdown` result remains schema-valid and within budget, and the first command that would overflow any required projection returns `limit-exceeded` without increasing the fake table write count.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/project-repository.test.ts tests/product/project-service.test.ts tests/product/receipts-tombstone.test.ts tests/product/write-readability-invariant.test.ts
```

Expected: FAIL because repository, receipts, clock, and service do not exist.

- [ ] **Step 3: Implement fixed-order queues and candidate-before-write validation**

```ts
export interface ProjectRepository {
  list(signal?: AbortSignal): Promise<readonly ProjectSummary[]>
  get(projectId: ProjectId, signal?: AbortSignal): Promise<StoredProjectRecord | undefined>
  create(command: CreateProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome>
  mutate(command: ExistingProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome>
  deleteProject(command: DeleteProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome>
  close(): Promise<void>
}
```

Membership operations acquire the membership queue before the project queue. Ordinary mutations acquire only the project queue. The final `table.update` callback rechecks record kind, command receipt/hash, expected version, candidate schema, record bytes, and readable projections against the value current at its queue slot. It performs no async work, model work, file work, clock lookup, UUID generation, or random generation. Prepare IDs, clock values, Fixture candidate, baseline, PRD bytes, and request hash before the callback, then validate identity/CAS again inside it.

Accepted outcomes and defined business rejections consume compact receipts up to 256. Schema/transport rejection, pre-commit cancellation, and quota preflight do not. A receipt replay performs no `put/update`, creates no ID, changes no clock, and never decreases Client version. Tombstones are never listed, returned, or automatically removed.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- tests/product/project-repository.test.ts tests/product/project-service.test.ts tests/product/receipts-tombstone.test.ts tests/product/write-readability-invariant.test.ts
npm run typecheck
```

Expected: focused tests PASS, including the 20/21 concurrency boundary and durable-failure queue recovery.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/src/application/clock.ts packages/workbench/src/application/receipts.ts packages/workbench/src/application/project-repository.ts packages/workbench/src/application/project-service.ts packages/workbench/src/application/project-views.ts tests/product/project-repository.test.ts tests/product/project-service.test.ts tests/product/receipts-tombstone.test.ts tests/product/write-readability-invariant.test.ts tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "feat: add durable project command service"
```

---

### Task 8: Connect the Product Host and enforce lifecycle safety

**Files:**

- Create: `packages/workbench/src/application/product-handler.ts`
- Create: `packages/workbench/src/integration/harness-rc6/product-host.ts`
- Create: `tests/product/product-handler.test.ts`
- Create: `tests/product/host-lifecycle.test.ts`
- Modify: `packages/workbench/src/index.ts`
- Modify: `tests/contract/harness-rc6-public-surface.test.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`

**Interfaces:**

- Produces: `createProductHandler(service)`, `internalProductResult()`, `apply(ctx)`, `inject = ['connection', 'storageDomain']`, and `projectDomainSpec` export.
- Host registers exactly one loopback handler at `/dsh-pm-workbench-product-v1` and exports no Probe runtime entry.

- [ ] **Step 1: Write failing dispatch and lifecycle tests**

```ts
it('opens storage before registering the route and closes it if registration fails', async () => {
  const ctx = makeHostContext({ routeRegistration: 'reject' })
  await expect(apply(ctx)).rejects.toThrow()
  expect(ctx.events).toEqual(['domain.open', 'route.handle', 'repository.close', 'domain.close'])
})

it('rejects the seventeenth request and drains the first sixteen on dispose', async () => {
  const ctx = makeHostContextWithDeferredRequests()
  const dispose = await apply(ctx)
  const requests = Array.from({ length: 17 }, () => ctx.callHealth())
  expect(await requests[16]).toEqual(internalProductResult())
  const closing = dispose()
  expect(ctx.domain.closed).toBe(false)
  ctx.resolveAllRequests()
  await closing
  expect(ctx.domain.closed).toBe(true)
})
```

Cover six-endpoint dispatch, unknown endpoint, strict input/outcome, fixed safe errors, service exception, input abort, open failure, route registration failure, in-flight cap, repeated/synchronous reentrant disposal returning one promise, route disposer failure with continued drain/close, request rejection after teardown begins, and no write/UI update after awaited teardown.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/product-handler.test.ts tests/product/host-lifecycle.test.ts
```

Expected: FAIL because Product handler/Host do not exist and `src/index.ts` still exports the Probe Host.

- [ ] **Step 3: Implement safe dispatch and ordered disposal**

```ts
export const inject = ['connection', 'storageDomain'] as const

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const { domain, table } = await openProjectsTable(ctx)
  const repository = new TableProjectRepository(table)
  const service = new ProjectService(
    repository,
    new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8),
    new DeterministicPrdRenderer(nodeSha256Utf8),
    nodeSha256Utf8,
    systemClock,
  )
  return mountProductHost(ctx, domain, repository, createProductHandler(service))
}
```

The outer handler catches every exception and maps it to a fixed code with empty details. Setup is transactional: if any step after Domain open fails, close repository and Domain before rethrowing. Disposal sets `accepting = false` synchronously, stores and returns one promise, attempts route disposal, aborts lifecycle, awaits all in-flight handlers and repository writes, closes repository, closes Domain, then throws only the first teardown failure after all cleanup attempts.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- tests/product/product-handler.test.ts tests/product/host-lifecycle.test.ts
npm test -- tests/contract/harness-rc6-public-surface.test.ts
npm run typecheck
```

Expected: Product tests PASS and production `src/index.ts` has no Probe import/export.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/src/application/product-handler.ts packages/workbench/src/integration/harness-rc6/product-host.ts packages/workbench/src/index.ts tests/product/product-handler.test.ts tests/product/host-lifecycle.test.ts tests/contract/harness-rc6-public-surface.test.ts tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "feat: mount stage 3a product host"
```

---

### Task 9: Implement Client transport, ephemeral input, and authoritative store

**Files:**

- Create: `packages/workbench/src/client/workbench/material-input.ts`
- Create: `packages/workbench/src/client/workbench/web-sha256.ts`
- Create: `packages/workbench/src/client/workbench/transport.ts`
- Create: `packages/workbench/src/client/workbench/store.ts`
- Create: `packages/workbench/src/client/workbench/browser-port.ts`
- Create: `tests/product/material-input.test.ts`
- Create: `tests/product/client-web-sha256.test.ts`
- Create: `tests/product/transport.test.ts`
- Create: `tests/product/client-store.test.ts`
- Create: `tests/product/client-no-browser-persistence.test.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`

**Interfaces:**

- Produces: `readMaterialDraft`, `webSha256Utf8`, `ConnectionRpcWorkbenchTransport`, `WorkbenchTransport`, `createWorkbenchStore`, `WorkbenchStore`, and `WorkbenchBrowserPort`.
- The store keeps one authoritative server snapshot and separate ephemeral form drafts; it never treats an unconfirmed mutation as saved.

- [ ] **Step 1: Write failing transport/store/privacy tests**

```ts
it('marks a sent mutation uncertain when the carrier outcome is lost', async () => {
  const transport = makeTransportThatCommitsThenDisconnects()
  const store = createWorkbenchStore(transport, FIXED_CLIENT_IDS, MEMORY_BROWSER_PORT)
  await store.command(CREATE_PROJECT_COMMAND)
  expect(store.getSnapshot().saveState).toBe('uncertain')
  expect(store.getSnapshot().pendingRetry?.commandId).toBe(CREATE_PROJECT_COMMAND.commandId)
})

it('never lets an older receipt replay decrease the authoritative project version', async () => {
  const store = makeStoreAtVersion(7)
  await store.acceptOutcome(makeAcceptedOutcome({ projectVersion: 5, replayed: true }))
  expect(store.getSnapshot().selectedProject?.header.projectVersion).toBe(7)
})

it('does not call browser persistence APIs', async () => {
  const browser = installThrowingStorageSpies()
  const store = createWorkbenchStore(PASSING_TRANSPORT, FIXED_CLIENT_IDS, MEMORY_BROWSER_PORT)
  await store.open()
  expect(browser.calls).toEqual([])
})

it('recomputes hashes without Buffer or a Node shim', async () => {
  vi.stubGlobal('Buffer', undefined)
  await expect(webSha256Utf8('中文😀')).resolves.toMatch(/^[0-9a-f]{64}$/)
})

it('does not expose a confirmation snapshot until the latest edit is durably saved', async () => {
  const deferred = makeDeferredMutationTransport()
  const store = makeEditableStore(deferred)
  store.editRequirement(REQUIREMENT_ID, { title: '人工最终标题' })
  expect(store.getConfirmationSnapshot()).toEqual({ ok: false, reason: 'unsaved' })
  deferred.resolveNextAccepted()
  await store.flushProjectEdits()
  expect(store.getConfirmationSnapshot()).toMatchObject({
    ok: true,
    projectVersion: expect.any(Number),
    contentVersion: expect.any(Number),
  })
})

it('keeps a newer draft dirty when an older save response arrives late', async () => {
  const deferred = makeDeferredMutationTransport()
  const store = makeEditableStore(deferred)
  store.editRequirement(REQUIREMENT_ID, { title: '第一次修改' })
  const firstFlush = store.flushProjectEdits()
  store.editRequirement(REQUIREMENT_ID, { title: '第二次修改' })
  deferred.resolveNextAccepted()
  await firstFlush
  expect(store.getSnapshot()).toMatchObject({ saveState: 'unsaved', dirty: true })
})

it('publishes a baseline then renders PRD with the returned version and baseline id', async () => {
  const store = makeStoreWithRealServiceTransport(INCLUDED_PROJECT)
  const confirmed = store.getConfirmationSnapshot()
  expect(confirmed.ok).toBe(true)
  if (!confirmed.ok) throw new Error('expected a confirmation snapshot')
  const baseline = await store.publishConfirmedBaseline()
  expect(baseline).toMatchObject({ ok: true, projectVersion: confirmed.projectVersion + 1 })
  if (!baseline.ok) throw new Error('expected baseline publication to succeed')
  const prd = await store.renderPublishedBaseline()
  expect(prd).toMatchObject({
    ok: true,
    baselineId: baseline.baselineId,
    projectVersion: baseline.projectVersion + 1,
    current: true,
  })
})

it('invalidates confirmation when content changes between baseline and PRD', async () => {
  const store = makeStoreWithRealServiceTransport(INCLUDED_PROJECT)
  await store.publishConfirmedBaseline()
  await store.simulateAcceptedExternalContentChange()
  await expect(store.renderPublishedBaseline()).resolves.toMatchObject({
    ok: false,
    code: 'baseline-stale',
  })
  expect(store.getConfirmationSnapshot().ok).toBe(false)
})
```

Cover strict request before send, strict response after receive, project/source/PRD correlation, source/Markdown UTF-8 byte/hash recomputation, eight-request Client admission, queued cancellation, authoritative refresh, version conflict requiring refresh, same-command uncertain retry, draft preservation on business error, stale generation ignored after close, no duplicate listener on reopen, file extension/MIME/decode bounds, Blob/object URL revocation after download, edit-then-immediate-confirm, confirm while saving, confirm after failed/uncertain save, and an old accepted response arriving after a newer local draft.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/material-input.test.ts tests/product/client-web-sha256.test.ts tests/product/transport.test.ts tests/product/client-store.test.ts tests/product/client-no-browser-persistence.test.ts
```

Expected: FAIL because Client Product transport/store/browser ports do not exist.

- [ ] **Step 3: Implement validated transport and state machine**

```ts
export interface WorkbenchTransport {
  health(signal: AbortSignal): Promise<WorkbenchResult<Capabilities>>
  listProjects(signal: AbortSignal): Promise<WorkbenchResult<readonly ProjectSummary[]>>
  getProject(input: GetProjectInput, signal: AbortSignal): Promise<WorkbenchResult<ProjectView>>
  getSource(input: GetSourceInput, signal: AbortSignal): Promise<WorkbenchResult<SourceView>>
  getMarkdown(input: GetMarkdownInput, signal: AbortSignal): Promise<WorkbenchResult<MarkdownView>>
  command(input: Stage3aProjectCommand, signal: AbortSignal): Promise<WorkbenchResult<ProjectCommandOutcome>>
}
```

Use a FIFO transport admission queue capped at eight active calls, but serialize all mutations for one project in a dedicated per-project queue. The next related mutation is constructed only after the previous accepted result supplies the new authoritative `projectVersion`; independent reads and different projects may still use the wider transport allowance. Every queued or active call is tied to the current store generation and abort signal.

Track monotonically increasing `dirtyRevision` and `savedDraftRevision` for the selected project. For a mutation, set `保存中` only after admission. An accepted response sets `已保存` only when its captured draft revision still equals the latest dirty revision and no later project mutation is queued; otherwise the newer draft remains `未保存`. Authoritative business rejection becomes `保存失败` while retaining drafts; a transport loss after send becomes `结果待确认` with the exact original command object. Only refresh or exact-command retry clears uncertainty.

`flushProjectEdits()` drains the selected project's text, priority, decision, reason, and reorder mutations in order and returns the final authoritative `ProjectView`. `getConfirmationSnapshot()` returns `{ ok: true, projectVersion, contentVersion, project }` only when `dirtyRevision === savedDraftRevision`, no project mutation is queued or active, save state is `saved`, and the snapshot matches the latest Host response. It returns `{ ok: false, reason: 'unsaved' | 'saving' | 'failed' | 'uncertain' }` otherwise.

`baseline.publish` uses the confirmation snapshot's `projectVersion` as `expectedVersion` and freezes its `contentVersion`. Its accepted outcome returns the new `projectVersion` and `baselineId`. Only then may `prd.render` use that returned version/baseline ID while also sending the original confirmed `contentVersion`; Host requires the baseline content version and current project content version to equal it. Any content mutation between those two commands returns `baseline-stale`, invalidates the confirmation snapshot, and requires the user to review a rebuilt summary. It must never silently adopt the intervening content.

`material-input.ts` may decode and display stranger text in memory, but `canPersistFixtureDraft` is true only for the manifest hash plus checked attestation. `web-sha256.ts` uses `TextEncoder` and `globalThis.crypto.subtle.digest('SHA-256', bytes)` asynchronously; neither it nor protocol code references `Buffer` or `node:crypto`. Browser ports are injected so tests prove clipboard/download behavior without global side effects.

- [ ] **Step 4: Run GREEN**

```bash
npm test -- tests/product/material-input.test.ts tests/product/client-web-sha256.test.ts tests/product/transport.test.ts tests/product/client-store.test.ts tests/product/client-no-browser-persistence.test.ts
npm run typecheck
```

Expected: all Client data/lifecycle tests PASS and no browser persistence API is referenced by production Client code.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/src/client/workbench/material-input.ts packages/workbench/src/client/workbench/web-sha256.ts packages/workbench/src/client/workbench/transport.ts packages/workbench/src/client/workbench/store.ts packages/workbench/src/client/workbench/browser-port.ts tests/product/material-input.test.ts tests/product/client-web-sha256.test.ts tests/product/transport.test.ts tests/product/client-store.test.ts tests/product/client-no-browser-persistence.test.ts tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "feat: add workbench client state and transport"
```

---

### Task 10: Build the four-area accessible Workbench UI

**Files:**

- Create: `packages/workbench/src/client/workbench/WorkbenchView.tsx`
- Create: `packages/workbench/src/client/workbench/ProjectList.tsx`
- Create: `packages/workbench/src/client/workbench/MaterialPane.tsx`
- Create: `packages/workbench/src/client/workbench/RequirementsPane.tsx`
- Create: `packages/workbench/src/client/workbench/PriorityPane.tsx`
- Create: `packages/workbench/src/client/workbench/PrdPane.tsx`
- Create: `packages/workbench/src/client/workbench/styles.ts`
- Create: `packages/workbench/src/client/probe/index.tsx`
- Create: `tests/product/client-view.test.tsx`
- Create: `tests/product/client-lifecycle.test.tsx`
- Modify: `packages/workbench/src/client/index.tsx`
- Modify: `tests/probe/lifecycle.test.tsx`
- Modify: `tests/fixtures/standalone-source-manifest.json`

**Interfaces:**

- Produces: `WorkbenchLauncher`, `WorkbenchView`, `mountWorkbenchClient`, and stable Product-owned markers for real UI smoke.
- The overlay is additive through `shell.overlay`; the launcher is additive through `sidebar.footer.action`; no Harness root replacement or private selector is used.

- [ ] **Step 1: Write failing semantic UI and lifecycle tests**

```tsx
it('shows the synthetic-only material gate and local-test identity', () => {
  const html = renderToStaticMarkup(<WorkbenchView store={makeMaterialStore()} />)
  expect(html).toContain('当前仅支持合成测试材料，请勿导入真实访谈或客户信息')
  expect(html).toContain('我确认这是新写的合成测试材料，不含真实个人或客户数据')
  expect(html).toContain('生成本地测试草稿')
  expect(html).toContain('本地 Fixture 结果，未调用模型，不代表 AI 分析')
})

it('marks a retained PRD stale after a later review change', () => {
  const html = renderToStaticMarkup(<PrdPane state={STALE_PRD_STATE} />)
  expect(html).toContain('需求已调整，此 PRD 保留的是上次确认的内容')
  expect(html).toContain('复制 Markdown')
  expect(html).toContain('下载 Markdown')
})

it.each(['unsaved', 'saving', 'failed', 'uncertain'] as const)(
  'blocks final baseline publication while save state is %s',
  (saveState) => {
    const html = renderToStaticMarkup(<PriorityPane state={makeConfirmationState(saveState)} />)
    expect(html).toContain('确认本期需求并生成 PRD')
    expect(html).toContain('disabled=""')
  },
)

it('binds the confirmation summary to the fully saved authoritative content', () => {
  const html = renderToStaticMarkup(<PriorityPane state={SAVED_CONFIRMATION_STATE} />)
  expect(html).toContain('人工最终标题')
  expect(html).toContain('高')
  expect(html).toContain('data-confirmation-content-version="7"')
})
```

Cover project empty/20-limit/list order, named delete confirmation, delete cancel/failure, optional goal and `研究目标未提供`, four areas, evidence open/context, human text/priority/decision/reason/order controls, neutral no-valid-needs state, authoritative confirmation summary, exact button `确认本期需求并生成 PRD`, blocked confirmation for unsaved/saving/failed/uncertain edits, summary invalidation after a newer edit, current/stale PRD, five save states, connection/version/evidence errors, dialog semantics, keyboard labels, close focus restoration, setup rollback, reverse cleanup, idempotent dispose, reopen without duplicate slots/listeners, and absence of model/provider/send controls.

The fixed user-facing strings include `新建项目`, `暂时没有项目`, `已达到 20 个项目上限`, `工作台暂时无法连接`, `内容已更新，请刷新后重试`, `查看原文`, `暂未找到有充分依据的需求，可检查材料或保留为后续研究问题。`, `未保存`, `保存中`, `已保存`, `保存失败`, and `结果待确认`. Save state and review/business stage render independently.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/client-view.test.tsx tests/product/client-lifecycle.test.tsx
```

Expected: FAIL because Product UI components do not exist and Client entry still mounts the Probe.

- [ ] **Step 3: Implement Product components and stable markers**

Use these exact markers; item identity is carried only in opaque `data-project-id`, `data-requirement-id`, `data-evidence-id`, or `data-prd-revision-id` attributes, never in text-derived attributes:

```text
data-dsh-pm-workbench="launcher"
data-dsh-pm-workbench="overlay"
data-dsh-pm-workbench="close"
data-dsh-pm-workbench="project-list"
data-dsh-pm-workbench="new-project"
data-dsh-pm-workbench="project-name"
data-dsh-pm-workbench="research-goal"
data-dsh-pm-workbench="delete-project"
data-dsh-pm-workbench="synthetic-attestation"
data-dsh-pm-workbench="load-fixture"
data-dsh-pm-workbench="source-status"
data-dsh-pm-workbench="analyse-fixture"
data-dsh-pm-workbench="requirement-card"
data-dsh-pm-workbench="evidence"
data-dsh-pm-workbench="priority"
data-dsh-pm-workbench="decision"
data-dsh-pm-workbench="human-reason"
data-dsh-pm-workbench="requirement-order"
data-dsh-pm-workbench="confirmation-summary"
data-dsh-pm-workbench="confirm-scope"
data-dsh-pm-workbench="prd-preview"
data-dsh-pm-workbench="copy-prd"
data-dsh-pm-workbench="download-prd"
data-dsh-pm-workbench="save-state"
```

Move the current Stage 2 `mountProbeClient`, `ProbeClientContext`, cleanup helper, and Probe `apply` implementation into `src/client/probe/index.tsx`, changing only the relative import paths required by the new location. The existing Probe lifecycle assertions must remain byte-identical except for their import path to this historical entry. Do not export or import the historical entry from production `src/client/index.tsx`.

Production `src/client/index.tsx` exports `inject = ['connection', 'slots']`, registers Product IDs `pm-workbench-product-launcher` and `pm-workbench-product-overlay`, unregisters overlay before launcher, disposes the store last, and never imports `client/probe/**`. The final confirmation button is disabled unless `getConfirmationSnapshot().ok === true`. Its click command uses the exact bound project/content versions; if another edit occurs, the summary and button become invalid until the project mutation queue drains and a fresh authoritative summary is rendered.

- [ ] **Step 4: Run GREEN and Probe historical regressions**

```bash
npm test -- tests/product/client-view.test.tsx tests/product/client-lifecycle.test.tsx
npm test -- tests/probe/view.test.tsx tests/probe/lifecycle.test.tsx
npm run typecheck
```

Expected: Product and historical Probe component tests PASS; production Client entry has no Probe import.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/src/client/workbench/WorkbenchView.tsx packages/workbench/src/client/workbench/ProjectList.tsx packages/workbench/src/client/workbench/MaterialPane.tsx packages/workbench/src/client/workbench/RequirementsPane.tsx packages/workbench/src/client/workbench/PriorityPane.tsx packages/workbench/src/client/workbench/PrdPane.tsx packages/workbench/src/client/workbench/styles.ts packages/workbench/src/client/probe/index.tsx packages/workbench/src/client/index.tsx tests/product/client-view.test.tsx tests/product/client-lifecycle.test.tsx tests/probe/lifecycle.test.tsx tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "feat: add stage 3a workbench interface"
```

---

### Task 11: Ship a Product-only build graph and frozen package

**Files:**

- Modify: `packages/workbench/build.mjs`
- Modify: `scripts/pack-dry.mjs`
- Modify: `scripts/verify-package.mjs`
- Create: `tests/product/build.test.ts`
- Create: `tests/probe/helpers/stage2-build-graph.ts`
- Modify: `tests/probe/build.test.ts`
- Modify: `tests/contract/package-manifest.test.ts`
- Modify: `tests/contract/harness-rc6-public-surface.test.ts`
- Modify: `tests/integration/package-freeze.test.ts`
- Modify: `tests/integration/standalone-copy.test.ts`
- Modify: `tests/fixtures/standalone-source-manifest.json`
- Modify: `packages/workbench/package.json`
- Modify: `packages/workbench/README.md`
- Modify: `packages/workbench/docs/compatibility.md`
- Modify: `packages/workbench/docs/privacy.md`
- Modify: `README.md`

**Interfaces:**

- Produces: `assertHostProductBuildGraph`, `assertClientProductBuildGraph`, real `lib/index.js`, real `lib/client.js`, a nine-file package inventory, package SHA-256, and Product build receipt.
- Product package has zero runtime dependencies, bundles Zod with its notice, externalizes React and the exact public Harness packages, and excludes all Probe, Demo, storage-gate, and model/Agent files.

- [ ] **Step 1: Write failing Product graph/package tests**

```ts
it('ships Product and excludes Probe, Demo, and Stage 3B graphs', async () => {
  const receipt = await buildWorkbench({ outdir: TEST_OUTDIR })
  expect(productHostInputsOnly(receipt.hostMetafile.inputs)).toBe(true)
  expect(productClientInputsOnly(receipt.clientMetafile.inputs)).toBe(true)
  expect(Object.keys(receipt.hostMetafile.inputs).join('\n')).not.toMatch(/src\/(probe|demo)\//)
  expect(Object.keys(receipt.clientMetafile.inputs).join('\n')).not.toMatch(/client\/probe|storage-domain|runHarnessModel/)
})

it('freezes a package whose bundled route is Product-only', async () => {
  const packed = await inspectPackedWorkbench()
  expect(packed.files).toEqual(EXACT_NINE_FILE_INVENTORY)
  expect(packed.combinedJavaScript).toContain('/dsh-pm-workbench-product-v1')
  expect(packed.combinedJavaScript).not.toContain('/dsh-pm-workbench-v1')
  expect(packed.clientJavaScript).not.toMatch(/\bBuffer\b|node:crypto|crypto-browserify/)
})
```

Cover exact Host/Client input sets, no transitive surprise input, exact external specifier allowlists rather than `@deepseek-ai/*`, bundled Zod, no bare Zod, no second Harness/Cordis runtime, no Node shim in Client, no Host/storage implementation in Client, no Product Client implementation in Host, real package identity, patch identity, public peer pins, zero dependencies, license/notice, package inventory, relocation, and the unchanged historical Stage 2 report.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/product/build.test.ts tests/contract/package-manifest.test.ts tests/contract/harness-rc6-public-surface.test.ts tests/integration/package-freeze.test.ts tests/integration/standalone-copy.test.ts
```

Expected: FAIL because the build and verifier still assert the Stage 2 Probe graph.

- [ ] **Step 3: Replace production allowlists and claims**

Use literal `Set` entries for every production file listed in this plan's map. Host externals are limited to the exact public root imports actually observed in its metafile: `@deepseek-ai/cordis`, `@deepseek-ai/dsh-client-connection`, `@deepseek-ai/dsh-storage-domain`, plus used Node built-ins. Client externals are limited to `react`, `react/jsx-runtime`, `@deepseek-ai/dsh-client-connection/client`, `@deepseek-ai/dsh-client-runtime/client`, `@deepseek-ai/dsh-client-ui-layout/client`, and `@deepseek-ai/dsh-client-ui-sidebar/client`. Any other external fails the build.

```js
const allowedHostExternals = new Set([
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-storage-domain',
  'node:crypto',
])
const allowedClientExternals = new Set([
  'react',
  'react/jsx-runtime',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-runtime/client',
  '@deepseek-ai/dsh-client-ui-layout/client',
  '@deepseek-ai/dsh-client-ui-sidebar/client',
])

function assertAllowedExternal(label, specifier, allowed) {
  if (!allowed.has(specifier)) {
    throw new Error(`${label} build has an undeclared external: ${specifier}`)
  }
}
```

After the first Product metafile is produced, remove any allowlist entry that has no corresponding runtime import; type-only imports do not justify a broader external. Adding an external requires a focused package/build test and review in the same commit.

Rename production Probe graph assertions to Product graph assertions in build and package verifier. Move the old literal Probe Host/Client input sets and `assertHostProbeBuildGraph` / `assertClientProbeBuildGraph` functions into `tests/probe/helpers/stage2-build-graph.ts`; update the first two historical Probe build tests to import that helper. Replace their third call to current `buildWorkbench()` with a complete synthetic Stage 2 metafile acceptance case, because the real current build is now Product and belongs to `tests/product/build.test.ts`. This preserves Stage 2's frozen rule without asking a historical Probe suite to approve Product bytes.

Keep Probe/Demo files in the repository for history and standalone Demo regressions, but no production import reaches them. Documentation says exactly: Stage 3A uses one built-in synthetic Fixture, does not call a model, does not accept real interview/customer data, persists Product data in the Harness profile, remove is not secure erasure, and Stage 3B model execution is unimplemented.

- [ ] **Step 4: Run complete static verification**

```bash
npm test -- tests/product/build.test.ts tests/contract/package-manifest.test.ts tests/contract/harness-rc6-public-surface.test.ts tests/integration/package-freeze.test.ts tests/integration/standalone-copy.test.ts
npm run typecheck
npm run build
npm run pack:dry
npm run verify:package
npm test
npm run check
git diff --check
```

Expected: all commands PASS; `verify:package` prints a new Product package hash and Product Host/Client graph receipts; no runtime installation claim is made yet.

- [ ] **Step 5: Commit**

```bash
git add packages/workbench/build.mjs scripts/pack-dry.mjs scripts/verify-package.mjs tests/product/build.test.ts tests/probe/helpers/stage2-build-graph.ts tests/probe/build.test.ts tests/contract/package-manifest.test.ts tests/contract/harness-rc6-public-surface.test.ts tests/integration/package-freeze.test.ts tests/integration/standalone-copy.test.ts tests/fixtures/standalone-source-manifest.json packages/workbench/package.json packages/workbench/README.md packages/workbench/docs/compatibility.md packages/workbench/docs/privacy.md README.md
git diff --cached --check
git commit -m "build: ship stage 3a product package"
```

---

### Task 12: Pass the full isolated Stage 3A Product smoke

**Files:**

- Create: `scripts/run-stage-3a-isolated-smoke.mjs`
- Create: `scripts/verify-stage-3a-smoke-result.mjs`
- Create: `tests/integration/stage-3a-smoke-runner.test.ts`
- Create: `tests/integration/stage-3a-result-file-boundary.test.ts`
- Modify: `package.json`
- Modify: `tests/fixtures/standalone-source-manifest.json`
- Modify after a verified real run: `packages/workbench/README.md`
- Modify after a verified real run: `README.md`
- Create only after a verified real run: `docs/gate-results/stage-3a-isolated-smoke.md`

**Interfaces:**

- Consumes: the final real Product tgz, Product-owned UI markers, one built-in synthetic Fixture, and the same six explicit executable inputs as Task 3.
- Produces: a closed, path-free, payload-free result and independently rendered report proving the complete Product workflow, persistence, lifecycle, package identity, bounded network observation, and cleanup.

- [ ] **Step 1: Write failing injected runner and verifier tests**

```ts
it('does not pass unless every Product phase uses the same frozen package hash', () => {
  const result = makeStage3aResult({ readdPackageHash: DIFFERENT_HASH })
  expect(() => verifyStage3aResult(result)).toThrowError('package-hash-drift')
})

it('does not treat screenshots or file existence as PRD proof', () => {
  const result = makeStage3aResult({ downloadedMarkdownHashVerified: false })
  expect(() => verifyStage3aResult(result)).toThrowError('missing-prd-byte-witness')
})

it('preserves project B through project A deletion and remove/re-add', () => {
  const result = makeStage3aResult({ projectBAfterReadd: false })
  expect(() => verifyStage3aResult(result)).toThrowError('retained-project-not-restored')
})
```

Cover tool identity drift, package hash drift, port `3080`, external page-target request, private/raw RPC attempt, missing pointer/keyboard event, wrong marker identity, absent evidence locator, wrong human edit/priority/order/decision, missing immutable baseline trace, BOM/hash/download mismatch, stale PRD not retained, restart mismatch, disable/remove/re-add inventory/marker mismatch, project A tombstone failure, project B loss, process/listener leak, unsafe result field, result too large, cleanup failure, and verifier failure. The real result schema has no `routeAbsent` witness because a disabled plugin has no Product-owned UI from which that route can be observed without raw RPC.

- [ ] **Step 2: Run RED**

```bash
npm test -- tests/integration/stage-3a-smoke-runner.test.ts tests/integration/stage-3a-result-file-boundary.test.ts
```

Expected: FAIL because the Stage 3A Product runner/verifier do not exist.

- [ ] **Step 3: Implement the closed runner and exact Product flow**

Add scripts:

```json
{
  "smoke:stage3a": "node --experimental-strip-types scripts/run-stage-3a-isolated-smoke.mjs",
  "verify:stage3a": "node --experimental-strip-types scripts/verify-stage-3a-smoke-result.mjs"
}
```

The real browser sequence is fixed:

1. Pack once; freeze package bytes, SHA-256, version, inventory, Host metafile, and Client metafile.
2. Create a new non-`3080` Harness profile and fresh Chrome profile; install the frozen tgz offline.
3. Open the Product launcher with a real pointer event; create project A with a project name and no research goal.
4. Load the built-in synthetic material, check the synthetic attestation with a real pointer event, save it, and observe `已保存`.
5. Run `生成本地测试草稿`; observe `本地 Fixture 结果，未调用模型，不代表 AI 分析`.
6. Open one evidence locator and verify exact displayed context, source revision, offsets, and quote hash through Product-owned markers.
7. Edit one requirement with keyboard input, change priority, set include/defer/reject decisions, enter one human reason, and reorder the exact set. Wait for and observe `已保存`; then verify the confirmation summary contains the final edited text, priorities, decisions, and exact order bound to the saved `contentVersion`.
8. Only after that saved summary is visible, use `确认本期需求并生成 PRD`; verify baseline trace, current PRD preview, copied Markdown bytes, downloaded UTF-8 no-BOM bytes, SHA-256, and exact equality between the summary's included content/order and the PRD.
9. Change one upstream human decision; prove the old PRD bytes remain and UI says `需求已调整，此 PRD 保留的是上次确认的内容`; create a new baseline/PRD and verify a new hash.
10. Refresh and restart Harness with a new Chrome profile; recover project A, decisions, baselines, and both PRD summaries.
11. Create project B and persist its built-in synthetic source so retained business data exists independently of project A.
12. Delete project A through the named confirmation; restart and prove `projects.list` and UI omit A while B remains.
13. Disable the plugin and restart; inventory reports installed-disabled, Product launcher/overlay markers are absent, and no Product UI action is available.
14. Remove the package and restart; inventory reports removed and Product launcher/overlay markers are absent. Record this as package removal, not secure data erasure.
15. Re-add the identical frozen tgz and restart; recover project B and its persisted source/analysis state.
16. Close Chrome and Harness, prove owned listeners/processes are gone, remove only the marker-owned run root, prove absence, then emit the closed result.

Network observation is limited to the attached Chrome page target. The report may state zero observed external requests in that scope, offline package-manager configuration, and loopback listeners; it must not claim host-wide packet capture.

Route unregistration remains a Task 8 component-level lifecycle proof using the public `rpc.handle` disposer. The real smoke reports only the plugin inventory and Product-owned launcher/overlay behavior it can directly observe; marker absence is never presented as independent proof that a Host route was removed.

- [ ] **Step 4: Run deterministic runner tests GREEN and the full static suite**

```bash
npm test -- tests/integration/stage-3a-smoke-runner.test.ts tests/integration/stage-3a-result-file-boundary.test.ts
npm run typecheck
npm run build
npm run verify:package
npm test
npm run check
git diff --check
```

Expected: all injected runner tests and repository checks PASS; no Harness process is started by these tests.

- [ ] **Step 5: Commit the runner before executing it**

```bash
git add scripts/run-stage-3a-isolated-smoke.mjs scripts/verify-stage-3a-smoke-result.mjs tests/integration/stage-3a-smoke-runner.test.ts tests/integration/stage-3a-result-file-boundary.test.ts package.json tests/fixtures/standalone-source-manifest.json
git diff --cached --check
git commit -m "test: add stage 3a isolated product smoke"
```

- [ ] **Step 6: Collect ephemeral absolute tool inputs and run the real Product smoke**

Repeat Task 3's six interactive absolute-path inputs in one zsh session; do not reuse stale shell values without rerunning the runner's identity checks. Keep the values and output-root path outside Git and outside the closed result.

```bash
read -r "STAGE3A_NODE?Absolute canonical Node file: "
read -r "STAGE3A_DSH_CLI?Absolute canonical DSH rc.6 bin file: "
read -r "STAGE3A_NPM_CLI?Absolute canonical npm cli file: "
read -r "STAGE3A_PNPM_NODE?Absolute canonical pnpm Node file: "
read -r "STAGE3A_PNPM_CLI?Absolute canonical pnpm cli file: "
read -r "STAGE3A_CHROME?Absolute canonical Chrome executable: "
STAGE3A_PRODUCT_OUTPUT_ROOT="$(mktemp -d "${TMPDIR%/}/dsh-pmwb-stage3a-product-report.XXXXXX")"
"$STAGE3A_NODE" --experimental-strip-types scripts/run-stage-3a-isolated-smoke.mjs \
  --node "$STAGE3A_NODE" \
  --dsh-cli "$STAGE3A_DSH_CLI" \
  --npm-cli "$STAGE3A_NPM_CLI" \
  --pnpm-node "$STAGE3A_PNPM_NODE" \
  --pnpm-cli "$STAGE3A_PNPM_CLI" \
  --chrome "$STAGE3A_CHROME" \
  --result "$STAGE3A_PRODUCT_OUTPUT_ROOT/result.json"
"$STAGE3A_NODE" --experimental-strip-types scripts/verify-stage-3a-smoke-result.mjs \
  "$STAGE3A_PRODUCT_OUTPUT_ROOT/result.json" \
  --markdown "$STAGE3A_PRODUCT_OUTPUT_ROOT/report.md"
```

Expected: verifier prints `STAGE3A_PRODUCT_SMOKE=PASS`; every phase uses one package hash, project B survives re-add, project A remains hidden after deletion/restart, external page-target attempts are zero, listeners/processes are closed, and the owned run root is absent.

- [ ] **Step 7: Request independent code and evidence review**

Use `superpowers:requesting-code-review`. Resolve the implementation review base with `git log --format=%H --grep='^docs: plan stage 3a workbench core$' -1`; require exactly one non-empty match, and review from that commit through `HEAD`. The reviewer re-runs focused and full tests, verifies the new report against the result schema, and explicitly checks that model implementation, real data, active `3080`, Probe runtime, and hidden diagnostic endpoints are absent from the Product package.

```bash
STAGE3A_PLAN_BASE="$(git log --format=%H --grep='^docs: plan stage 3a workbench core$' -1)"
test -n "$STAGE3A_PLAN_BASE"
test "$(git log --format=%H --grep='^docs: plan stage 3a workbench core$' | wc -l | tr -d ' ')" = "1"
git diff --check "$STAGE3A_PLAN_BASE"..HEAD
npm run check
npm run verify:package
```

- [ ] **Step 8: Commit the verified sanitized report and update claim scope**

```bash
cp "$STAGE3A_PRODUCT_OUTPUT_ROOT/report.md" docs/gate-results/stage-3a-isolated-smoke.md
npm test -- tests/integration/stage-3a-result-file-boundary.test.ts tests/product/build.test.ts
git add docs/gate-results/stage-3a-isolated-smoke.md packages/workbench/README.md README.md
git diff --cached --check
git commit -m "docs: record stage 3a product smoke pass"
rm -rf "$STAGE3A_PRODUCT_OUTPUT_ROOT"
git status --short
```

Expected: tests PASS and `git status --short` is empty. Documentation may now claim only that the fixed Stage 3A synthetic Fixture workflow passed in the recorded isolated rc.6 environment. It must still say model analysis, real interview data, transcription, multi-interview synthesis, prototype generation, publication, and secure erasure are unimplemented or separately gated.

**Stop condition:** any required phase is unobserved, the verifier does not return `PASS`, cleanup is incomplete, package bytes drift, project persistence differs from the contract, or a reviewer finds a P0/P1 issue.

---

## Final Verification Checklist

- [ ] `git diff --check` passes and the worktree is clean after the final report commit.
- [ ] Stage 3A Host and Client compile against only public rc.6 declarations.
- [ ] The real storage-surface report is independently verified and committed.
- [ ] Source, evidence, Fixture, review, baseline, and PRD boundary suites pass.
- [ ] CAS, receipts, tombstones, concurrency, cancellation, durable failure, and read-before-write budget suites pass.
- [ ] Product protocol has six endpoints, nine strict command schemas, eight executable Stage 3A commands, and one reserved model command that is unavailable and invisible in the Client.
- [ ] Product Host/Client lifecycles pass setup, failure, in-flight, repeated disposal, and reopen tests.
- [ ] Product UI shows all required Chinese warnings/states and no model/provider/send control.
- [ ] Product metafiles and tgz exclude Probe, Demo, storage-gate, model, and private Harness code.
- [ ] The final real tgz completes the full pointer/keyboard flow, restart recovery, delete/tombstone, disable/remove/re-add, and cleanup in a fresh non-`3080` profile.
- [ ] Final documentation separates verified Stage 3A behavior from Stage 3B proposals and real-data restrictions.

## Claim Allowed After Completion

After every checkbox above is complete and the final verifier reports `PASS`, the precise allowed claim is:

> `@knight/dsh-pm-workbench` completed the recorded DeepSeek Harness `0.1.0-rc.6` isolated Stage 3A smoke for one built-in synthetic interview: project creation, manifest-bound local Fixture draft, exact evidence review, human prioritization and scope decisions, immutable baseline, deterministic Markdown PRD, restart recovery, deletion/tombstone behavior, disable/remove/re-add behavior, and owned-environment cleanup.

This claim does not mean the plugin can analyse real interviews, call a Harness model, transcribe audio, combine multiple interviews, generate a prototype, publish externally, or securely erase storage history.
