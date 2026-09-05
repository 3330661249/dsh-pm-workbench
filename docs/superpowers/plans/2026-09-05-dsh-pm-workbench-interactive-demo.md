# DSH PM Workbench Interactive Demo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished standalone React Demo for the four-step `材料 → 需求 → 优先级 → PRD` journey, backed only by deterministic local demo rules and clearly separated from real DeepSeek Harness, model, Host, and persistence claims.

**Architecture:** Pure TypeScript modules own material validation, citation integrity, human decisions, and deterministic Markdown generation. A React `DemoApp` holds one mounted-page session in `useReducer`, and a separate esbuild entry creates an unshipped static page under the repository `.tmp` root. The current Harness Host and Client entries remain unchanged until a later Alpha integration plan.

**Tech Stack:** Existing Node 24, TypeScript 6.0.3, Vitest 3.2.7, React/React DOM 18.3.1, esbuild 0.25.12, native browser `File`, `TextDecoder`, `Blob`, and object-URL APIs. Task 3 adds only the missing dev-time declarations `@types/react-dom@18.3.7`; it adds no runtime dependency.

**Spec:** `docs/superpowers/specs/2026-09-04-dsh-pm-workbench-simple-alpha-design.md`, limited to the standalone Demo described in §8.1. Alpha-only installation, model, Host storage, restart, and privacy claims remain unimplemented.

## Global Constraints

- Keep this exact, non-dismissible banner visible at every step: `演示数据，未连接 DeepSeek Harness，未调用真实模型。`
- Keep this adjacent warning visible: `仅保存在当前页面内存中；刷新或关闭页面后会丢失。`
- Call local card generation `本地演示规则` or `演示生成`; never call it AI analysis.
- Do not import Harness, Cordis, a provider SDK, or a model package anywhere in the Demo graph.
- Do not call `fetch`, `XMLHttpRequest`, `WebSocket`, or any external/loopback endpoint from the Demo page.
- Do not use `localStorage`, `sessionStorage`, IndexedDB, cookies, Cache Storage, or Service Workers.
- Leave `packages/workbench/src/index.ts`, `packages/workbench/src/client/index.tsx`, `packages/workbench/cordis.patch.yml`, `packages/workbench/package.json`, and the existing package build behavior unchanged.
- Accept pasted text plus `.txt` and `.md` uploads only. File MIME and `<input accept>` are hints; validation uses extension, bytes, and decoded text.
- Uploads are at most `256 * 1024` bytes. Decoded or pasted text is at most 80,000 UTF-16 code units, contains no NUL, and must not be blank after `trim()`.
- Remove at most one leading UTF-8 BOM before fatal UTF-8 decoding. Preserve all other bytes as their decoded JavaScript string, including CRLF. Do not normalize Unicode or newlines.
- Every cited card must satisfy `material.text.slice(start, end) === citation.text` for its UTF-16 half-open interval `[start, end)`.
- An inference-only card has no citation, visibly says `AI 推断，待确认（演示）`, never offers `纳入`, and never enters PRD output.
- PRD output contains only cited cards whose human decision is `纳入`; source order determines output order. Priority is an editable human choice, not a calculated score.
- PRD output is UTF-8 without BOM, uses a safe filename, and includes explicit `待产品经理补充` placeholders rather than invented metrics, dates, scale, or technical solutions.
- Generated Demo output is written only under the dedicated `.tmp/dsh-pm-workbench/` subtree: the user-facing build uses `.tmp/dsh-pm-workbench/demo/` and integration tests use strict sibling children named `test-*`. A Demo-specific physical-path guard rejects the subtree root itself, all wider `.tmp` paths, package output, and symlink escapes. Demo output never enters the npm package.
- All fixtures are synthetic and non-sensitive. No real interview, provider response, credential, profile, or model output may enter source, tests, screenshots, or Git.
- A successful Demo does not prove Harness installation, plugin mount, a real model call, Host persistence, restart recovery, or sensitive-data safety.

## Execution Setup

The execution worktree is `/private/tmp/dsh-pm-workbench-f0`, currently based on the approved spec commit `ab49ffb45a812fd25780a2833a99f96306b76ed4`.

Before Task 1, check whether this exact worktree has `node_modules`. If it does not, run the locked, script-disabled offline hydration first:

```bash
npm ci --offline --ignore-scripts --no-audit --no-fund
```

If and only if npm reports a cache miss, stop and obtain explicit public-registry permission before running:

```bash
npm ci --ignore-scripts --no-audit --no-fund
```

Do not use a parent checkout's `node_modules`, do not symlink dependencies, and do not modify `package.json` or `package-lock.json` during hydration. Verify the baseline with:

```bash
npm ls --depth=0
npm run typecheck
npm test
```

---

### Task 1: Material validation and deterministic cited Demo cards

**Files:**

- Create: `packages/workbench/src/demo/domain/types.ts`
- Create: `packages/workbench/src/demo/domain/material.ts`
- Create: `packages/workbench/src/demo/domain/fixture-provider.ts`
- Create: `tests/demo/material.test.ts`
- Create: `tests/demo/fixture-provider.test.ts`

**Interfaces:**

- Produces: `Material`, `Citation`, `RequirementCard`, `DomainResult<T>`, `validatePastedText()`, `decodeUploadedText()`, `assertCardIntegrity()`, `createDemoCards()`, and `SYNTHETIC_INTERVIEW_TEXT`.
- No file in this task imports React, DOM APIs, Node filesystem/crypto, Harness, Cordis, storage, or networking.

- [ ] **Step 1: Write the closed domain types.**

Use these exact public contracts in `types.ts`:

```ts
export const MAX_UPLOAD_BYTES = 256 * 1024
export const MAX_MATERIAL_CODE_UNITS = 80_000

export type MaterialFormat = 'pasted' | 'text/plain' | 'text/markdown'
export type Priority = 'high' | 'medium' | 'low'
export type Decision = 'pending' | 'include' | 'defer' | 'reject'

export interface Material {
  readonly text: string
  readonly displayName: string
  readonly format: MaterialFormat
}

export interface Citation {
  readonly start: number
  readonly end: number
  readonly text: string
}

interface RequirementBase {
  readonly id: string
  readonly fixtureLabel: '演示生成'
  readonly title: string
  readonly painPoint: string
  readonly description: string
  readonly demoReason: string
  readonly suggestedPriority: Priority
  readonly priority: Priority
  readonly decision: Decision
  readonly humanReason: string
  readonly manuallyEdited: boolean
}

export interface CitedRequirement extends RequirementBase {
  readonly kind: 'cited'
  readonly citations: readonly [Citation, ...Citation[]]
}

export interface InferenceRequirement extends RequirementBase {
  readonly kind: 'inference'
  readonly citations: readonly []
}

export type RequirementCard = CitedRequirement | InferenceRequirement

export type DomainErrorCode =
  | 'empty-material'
  | 'nul-character'
  | 'unsupported-extension'
  | 'file-too-large'
  | 'invalid-utf8'
  | 'material-too-long'
  | 'invalid-citation'
  | 'invalid-card-shape'
  | 'inference-cannot-be-included'
  | 'material-required'
  | 'no-included-requirements'

export type DomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: DomainErrorCode; readonly message: string } }
```

- [ ] **Step 2: Write failing material tests.**

`tests/demo/material.test.ts` covers exact boundaries:

```ts
expect(validatePastedText('甲\r\n乙')).toMatchObject({
  ok: true,
  value: { text: '甲\r\n乙', displayName: '粘贴访谈.txt', format: 'pasted' },
})
expect(validatePastedText('   ')).toMatchObject({ ok: false, error: { code: 'empty-material' } })
expect(validatePastedText('甲\u0000乙')).toMatchObject({ ok: false, error: { code: 'nul-character' } })
expect(validatePastedText('甲'.repeat(80_000)).ok).toBe(true)
expect(validatePastedText('甲'.repeat(80_001))).toMatchObject({ ok: false, error: { code: 'material-too-long' } })

const encoder = new TextEncoder()
expect(decodeUploadedText('访谈.md', new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('甲\r\n乙')]))).toMatchObject({
  ok: true,
  value: { text: '甲\r\n乙', displayName: '访谈.md', format: 'text/markdown' },
})
expect(decodeUploadedText('访谈.pdf', encoder.encode('甲'))).toMatchObject({ ok: false, error: { code: 'unsupported-extension' } })
expect(decodeUploadedText('访谈.txt', new Uint8Array([0xc3, 0x28]))).toMatchObject({ ok: false, error: { code: 'invalid-utf8' } })
expect(decodeUploadedText('访谈.txt', new Uint8Array(256 * 1024))).toMatchObject({ ok: false, error: { code: 'nul-character' } })
expect(decodeUploadedText('访谈.txt', new Uint8Array(256 * 1024 + 1))).toMatchObject({ ok: false, error: { code: 'file-too-large' } })
```

Also assert uppercase `.TXT`/`.MD` are accepted and `.markdown`, missing extension, and whitespace-only decoded text are rejected. Prove that one leading BOM is removed, a second leading BOM remains as `U+FEFF`, and a non-leading BOM remains at its original position; neither the decoder nor the validator may silently remove those retained characters.

- [ ] **Step 3: Run the material test and observe RED.**

Run:

```bash
npm test -- tests/demo/material.test.ts
```

Expected: the test file is collected and fails because `material.ts` does not exist.

- [ ] **Step 4: Implement exact input validation.**

`material.ts` exports:

```ts
export function validatePastedText(text: string): DomainResult<Material>
export function decodeUploadedText(fileName: string, bytes: Uint8Array): DomainResult<Material>
```

Implement one private `validateDecodedText()` that checks blankness without trimming the returned text, rejects NUL, and checks `text.length`. `decodeUploadedText()` checks the last case-insensitive extension first, checks raw byte length, removes the byte prefix `EF BB BF` at offset zero once, then runs `new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(payload)`. `ignoreBOM: true` is required because BOM handling has already happened explicitly; it preserves a second leading BOM and every non-leading BOM as `U+FEFF`. Catch only decoding failure and return `invalid-utf8`. Use stable Chinese messages keyed by each error code.

- [ ] **Step 5: Write failing fixture and citation tests.**

Use this exact synthetic material in `fixture-provider.ts`:

```ts
export const SYNTHETIC_INTERVIEW_TEXT =
  '受访者：每次整理访谈都要在多个文档里找原话，常常花半小时。\n' +
  '受访者：我希望能先看到需求对应的原文，再决定是否纳入。\n'
```

`tests/demo/fixture-provider.test.ts` verifies:

```ts
const material = validatePastedText(SYNTHETIC_INTERVIEW_TEXT)
expect(material.ok).toBe(true)
if (!material.ok) return
const cards = createDemoCards(material.value)
expect(cards.ok).toBe(true)
if (!cards.ok) return
expect(cards.value).toHaveLength(3)
expect(cards.value.map((card) => card.id)).toEqual(['demo-cited-1', 'demo-cited-2', 'demo-inferred-1'])
expect(cards.value[0]).toMatchObject({ kind: 'cited', fixtureLabel: '演示生成' })
expect(cards.value[1]).toMatchObject({ kind: 'cited', fixtureLabel: '演示生成' })
expect(cards.value[2]).toMatchObject({ kind: 'inference', citations: [], decision: 'defer' })
expect(cards.value[0].citations).toEqual([{ start: 4, end: 28, text: '每次整理访谈都要在多个文档里找原话，常常花半小时' }])
expect(cards.value[1].citations).toEqual([{ start: 34, end: 56, text: '我希望能先看到需求对应的原文，再决定是否纳入' }])
for (const card of cards.value) {
  expect(assertCardIntegrity(material.value, card).ok).toBe(true)
  if (card.kind === 'cited') {
    for (const citation of card.citations) {
      expect(material.value.text.slice(citation.start, citation.end)).toBe(citation.text)
    }
  }
}
```

Add negative cases for changed quote text, `start === end`, an end beyond `material.text.length`, cited cards without citations, inference cards with a citation-shaped payload, and inference cards set to `include`.

- [ ] **Step 6: Run the fixture test and observe RED.**

```bash
npm test -- tests/demo/fixture-provider.test.ts
```

Expected: collected failures because `fixture-provider.ts` is missing.

- [ ] **Step 7: Implement deterministic Demo cards.**

Export:

```ts
export function assertCardIntegrity(material: Material, card: RequirementCard): DomainResult<RequirementCard>
export function createDemoCards(material: Material): DomainResult<readonly RequirementCard[]>
```

`createDemoCards()` scans physical lines with their original UTF-16 offsets and selects the first two non-blank lines in source order. For each selected line, trim surrounding whitespace by adjusting its offsets; remove one exact leading `受访者：` prefix when present; trim again; remove one terminal sentence mark from `。！？!?` when present; and trim trailing whitespace again. The resulting `citation.text` is always the exact `material.text.slice(start, end)`. This rule yields `[4, 28)` and `[34, 56)` for the fixed fixture above.

Create one cited card per selected span with IDs `demo-cited-1` and `demo-cited-2`. For card number `N`, use title `访谈需求候选 N`, pain point `这段原话反映了需要进一步判断的工作痛点。`, description `基于第 N 段原文生成的演示候选需求，等待产品经理编辑。`, Demo reason `本地演示规则按原文顺序提取了第 N 段非空内容。`, suggested/current priority `high` for the first card and `medium` for the second, pending decision, empty human reason, and `manuallyEdited: false`.

Add exactly one inference card `demo-inferred-1` with title `补充访谈覆盖范围`, pain point `当前材料可能仍有未覆盖的场景。`, description `这是没有原文引用的演示推断，不能纳入本次 PRD。`, Demo reason `本地演示规则固定加入一张无引用卡，用于演示边界。`, no citations, suggested/current priority `low`, `decision: 'defer'`, empty human reason, and `manuallyEdited: false`. If no exact non-empty span is available, return `invalid-citation`; never substitute sample text for entered text.

`assertCardIntegrity()` rejects every cited interval that is non-integer, outside `0 <= start < end <= material.text.length`, or whose exact slice differs. It rejects a cited card with no citations and an inference card that has citations or `decision === 'include'`.

- [ ] **Step 8: Run focused GREEN checks.**

```bash
npm test -- tests/demo/material.test.ts tests/demo/fixture-provider.test.ts
npm run typecheck
```

Expected: all focused assertions pass with no skipped tests and typecheck passes.

- [ ] **Step 9: Commit Task 1.**

```bash
git add -- packages/workbench/src/demo/domain/types.ts packages/workbench/src/demo/domain/material.ts packages/workbench/src/demo/domain/fixture-provider.ts tests/demo/material.test.ts tests/demo/fixture-provider.test.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: add deterministic demo material contracts"
```

---

### Task 2: Human decisions, navigation gates, and deterministic PRD

**Files:**

- Create: `packages/workbench/src/demo/domain/requirements.ts`
- Create: `packages/workbench/src/demo/domain/prd.ts`
- Create: `packages/workbench/src/demo/state.ts`
- Create: `tests/demo/requirements.test.ts`
- Create: `tests/demo/prd.test.ts`
- Create: `tests/demo/state.test.ts`

**Interfaces:**

- Consumes Task 1 `Material`, `RequirementCard`, `DomainResult<T>`, and `assertCardIntegrity()`.
- Produces: `applyManualEdit()`, `eligibleRequirements()`, `renderDemoPrd()`, `utf8NoBom()`, `safePrdBaseName()`, `DemoState`, `DemoAction`, `initialDemoState`, `demoReducer()`, and `canEnterStep()`.

- [ ] **Step 1: Write failing human-decision tests.**

`tests/demo/requirements.test.ts` asserts:

```ts
const included = applyManualEdit(material, citedCard, {
  title: '保留引用的需求',
  priority: 'high',
  decision: 'include',
  humanReason: '用户反复寻找原话，先解决追溯。',
})
expect(included).toMatchObject({
  ok: true,
  value: { title: '保留引用的需求', priority: 'high', decision: 'include', manuallyEdited: true },
})
expect(applyManualEdit(material, inferredCard, { decision: 'include' })).toMatchObject({
  ok: false,
  error: { code: 'inference-cannot-be-included' },
})
```

Prove the original input object is unchanged; ID, citations, `fixtureLabel`, `demoReason`, and `suggestedPriority` cannot be patched; cited cards can be included/deferred/rejected; inference cards can only remain pending, defer, or reject. `eligibleRequirements()` returns only cited cards with `decision === 'include'` in original source order.

- [ ] **Step 2: Run the requirement test and observe RED.**

```bash
npm test -- tests/demo/requirements.test.ts
```

Expected: failure because `requirements.ts` does not exist.

- [ ] **Step 3: Implement immutable human decisions.**

Use this exact edit contract:

```ts
export interface ManualRequirementEdit {
  readonly title?: string
  readonly description?: string
  readonly painPoint?: string
  readonly priority?: Priority
  readonly decision?: Decision
  readonly humanReason?: string
}

export function applyManualEdit(
  material: Material,
  card: RequirementCard,
  edit: ManualRequirementEdit,
): DomainResult<RequirementCard>

export function eligibleRequirements(cards: readonly RequirementCard[]): readonly CitedRequirement[]
```

Create a new card, copy only the six editable fields, and set `manuallyEdited` only when an effective field changes. Validate the complete result after applying the edit; a rejected edit returns no partial card.

- [ ] **Step 4: Write failing PRD tests.**

`tests/demo/prd.test.ts` first includes one cited card and verifies:

```ts
const artifact = renderDemoPrd({
  projectTitle: '访谈 / 需求',
  material,
  cards: [includedCited, deferredCited, inferredCard],
})
expect(artifact.ok).toBe(true)
if (!artifact.ok) return
expect(artifact.value.filename).toBe('访谈-需求-prd.md')
expect(artifact.value.markdown).toContain('## 功能需求和优先级')
expect(artifact.value.markdown).toContain(includedCited.id)
expect(artifact.value.markdown).not.toContain(deferredCited.id)
expect(artifact.value.markdown).not.toContain(inferredCard.id)
expect(artifact.value.markdown).toContain('待产品经理补充')
expect(new TextDecoder().decode(artifact.value.bytes)).toBe(artifact.value.markdown)
expect(Array.from(artifact.value.bytes.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf])
```

Assert all eight required headings in exact order, citation text and `[start, end)` offsets, human priority/reason, the material display name, and a final Demo disclaimer. No included card returns `no-included-requirements`. `safePrdBaseName('../../')`, blank text, and punctuation-only text fall back to `pm-workbench`; path separators never survive. Two renders return identical Markdown and bytes.

Add two export-boundary cases: an included card whose quote or interval no longer matches the current material returns `invalid-citation`, and reversed input cards are emitted in ascending first-citation `start` order. Ties sort by first-citation `end`, then by `id` using direct UTF-16 string comparison so output does not depend on locale.

- [ ] **Step 5: Implement the deterministic PRD artifact.**

Use:

```ts
export interface PrdArtifact {
  readonly filename: string
  readonly markdown: string
  readonly bytes: Uint8Array
}

export function safePrdBaseName(projectTitle: string): string
export function utf8NoBom(markdown: string): Uint8Array
export function renderDemoPrd(input: {
  readonly projectTitle: string
  readonly material: Material
  readonly cards: readonly RequirementCard[]
}): DomainResult<PrdArtifact>
```

`safePrdBaseName()` keeps Unicode letters and numbers plus internal `.`, `_`, and `-`; replace every other run with one `-`, collapse repeated separators, trim leading/trailing `.`, `_`, and `-`, and fall back to `pm-workbench` when nothing remains. Thus `访谈 / 需求` becomes `访谈-需求`, while `../../` becomes `pm-workbench`. Limit the safe base to the first 80 UTF-16 code units without leaving a dangling high surrogate, then trim separators again.

Before filtering, run `assertCardIntegrity(material, card)` for every input card and return the first integrity error. Then select cited cards with `decision === 'include'` and sort them by first-citation `start`, first-citation `end`, and direct `id` comparison in that order. Render headings in this order: `背景与问题`, `目标用户`, `用户痛点及访谈依据`, `本期目标`, `功能需求和优先级`, `非本期范围`, `成功指标`, `风险与待确认问题`, followed by `演示说明`. Put exact quotes in Markdown blockquotes with their `[start, end)` values. Escape user-authored heading/list metacharacters; never interpret user text as HTML. Encode with exactly `new TextEncoder().encode(markdown)`.

- [ ] **Step 6: Write reducer/navigation tests before state code.**

`tests/demo/state.test.ts` covers:

```ts
expect(canEnterStep(initialDemoState, 'requirements')).toMatchObject({ allowed: false })
const withMaterial = demoReducer(initialDemoState, { type: 'materialAccepted', material })
const analysed = demoReducer(withMaterial, { type: 'analysisAccepted', cards })
expect(canEnterStep(analysed, 'priority')).toEqual({ allowed: true })
const refused = demoReducer(analysed, {
  type: 'requirementEdited',
  id: 'demo-inferred-1',
  edit: { decision: 'include' },
})
expect(refused.error).toBe('只有带原文引用的需求才能纳入本次 PRD。')
expect(refused.cards.find((card) => card.id === 'demo-inferred-1')?.decision).toBe('defer')
```

Also cover project-title edit, card title/pain/description/priority/decision/reason edit, valid step navigation, replacing material clearing cards and PRD, generating PRD after one inclusion, and any subsequent card edit clearing a stale preview. Prove that an effective project-title change clears a stale PRD, an identical title does not, and `operationFailed` stores a concrete validation/file-read/analysis message until `errorCleared` runs. Prove the PRD step is reachable once cards exist even with zero included items; only generation remains unavailable until a cited card is included.

- [ ] **Step 7: Implement the closed Demo state machine.**

Use:

```ts
export type DemoStep = 'material' | 'requirements' | 'priority' | 'prd'

export interface DemoState {
  readonly step: DemoStep
  readonly projectTitle: string
  readonly material?: Material
  readonly cards: readonly RequirementCard[]
  readonly prd?: PrdArtifact
  readonly notice: string
  readonly error?: string
}

export type DemoAction =
  | { readonly type: 'projectTitleChanged'; readonly value: string }
  | { readonly type: 'materialAccepted'; readonly material: Material }
  | { readonly type: 'analysisAccepted'; readonly cards: readonly RequirementCard[] }
  | { readonly type: 'requirementEdited'; readonly id: string; readonly edit: ManualRequirementEdit }
  | { readonly type: 'stepRequested'; readonly step: DemoStep }
  | { readonly type: 'prdGenerated'; readonly artifact: PrdArtifact }
  | { readonly type: 'operationFailed'; readonly message: string }
  | { readonly type: 'reset' }
  | { readonly type: 'errorCleared' }

export const initialDemoState: DemoState
export function canEnterStep(state: DemoState, step: DemoStep): { allowed: true } | { allowed: false; reason: string }
export function demoReducer(state: DemoState, action: DemoAction): DemoState
```

Step `requirements` requires material and at least one card, while `priority` and `prd` require cards. The PRD step itself remains reachable with zero included cards so it can explain why generation is disabled; `renderDemoPrd()` and the generate action still require at least one eligible card. Previous steps remain reachable. Every material/card change and every effective project-title change clears `prd`. `operationFailed` records the supplied concrete message without changing accepted material/cards, and successful accepted operations clear stale errors. Use the exact inference-inclusion error from the test.

- [ ] **Step 8: Run Task 2 GREEN checks.**

```bash
npm test -- tests/demo/requirements.test.ts tests/demo/prd.test.ts tests/demo/state.test.ts
npm run typecheck
```

Expected: all focused assertions pass, no skips, and typecheck passes.

- [ ] **Step 9: Commit Task 2.**

```bash
git add -- packages/workbench/src/demo/domain/requirements.ts packages/workbench/src/demo/domain/prd.ts packages/workbench/src/demo/state.ts tests/demo/requirements.test.ts tests/demo/prd.test.ts tests/demo/state.test.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: add demo decisions and prd rules"
```

---

### Task 3: Four-step accessible React interface

**Files:**

- Create: `packages/workbench/src/demo/components/DemoNotice.tsx`
- Create: `packages/workbench/src/demo/components/StepNavigation.tsx`
- Create: `packages/workbench/src/demo/components/MaterialStep.tsx`
- Create: `packages/workbench/src/demo/components/RequirementEditor.tsx`
- Create: `packages/workbench/src/demo/components/RequirementsStep.tsx`
- Create: `packages/workbench/src/demo/components/PriorityStep.tsx`
- Create: `packages/workbench/src/demo/components/PrdStep.tsx`
- Create: `packages/workbench/src/demo/components/WorkbenchMark.tsx`
- Create: `packages/workbench/src/demo/DemoApp.tsx`
- Create: `packages/workbench/demo/main.tsx`
- Create: `packages/workbench/demo/demo.css`
- Create: `packages/workbench/demo/index.html`
- Create: `tests/demo/markup.test.tsx`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `tsconfig.tests.json`
- Modify: `vitest.config.ts`

**Interfaces:**

- Consumes Tasks 1–2 domain functions and reducer only.
- Components receive `state` plus explicit callbacks; child components do not import `demoReducer` or call a provider.
- `MaterialStep` is the only place that reads a browser `File`.
- `PrdStep` is the only place that creates a `Blob`/object URL.
- `packages/workbench/demo/main.tsx` is the only ordinary-DOM mount entry. The Harness client entry remains untouched.

- [ ] **Step 1: Lock React DOM declarations, extend test discovery, and write failing SSR markup tests.**

Run this exact setup command and verify that it changes only `package.json`, `package-lock.json`, and the ignored `node_modules` tree:

```bash
npm install --save-dev --save-exact @types/react-dom@18.3.7 --ignore-scripts --no-audit --no-fund
npm ls @types/react-dom --depth=0
```

Do not upgrade React, React DOM, TypeScript, Vitest, esbuild, or any Harness package.

Add `tests/**/*.tsx` to `tsconfig.tests.json`. Change Vitest discovery to:

```ts
export default defineConfig({
  test: { include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'] },
})
```

`tests/demo/markup.test.tsx` uses `renderToStaticMarkup` from `react-dom/server` and asserts the initial app contains both permanent warnings, all four step names, a labelled textarea, `.txt / .md` help, and a `载入演示访谈` button. Render the requirements and priority components with deterministic cards and assert `原文引用`, `[4, 28)`, `演示生成`, `AI 推断，待确认（演示）`, and `不可纳入本次 PRD` appear. It must not contain `dangerouslySetInnerHTML`, a model name, or a “saved” claim.

- [ ] **Step 2: Run the TSX test and observe RED.**

```bash
npm test -- tests/demo/markup.test.tsx
```

Expected: the file is discovered and fails because the components do not exist.

- [ ] **Step 3: Create the visual shell and permanent Demo boundary.**

`WorkbenchMark.tsx` renders an `aria-hidden="true"` inline SVG with three curved lavender blades; no raster asset or text is embedded in the mark. `DemoNotice.tsx` renders both exact warning strings in a `role="status"` region.

`DemoApp.tsx` uses `useReducer(demoReducer, initialDemoState)`, renders `header`, `nav`, and `main`, and keeps the notice above step content. Include a visually hidden polite live region for `state.notice` and a focusable `role="alert"` for `state.error`.

- [ ] **Step 4: Implement the Material step.**

Render a project-title input, paste textarea, file input with `accept=".txt,.md,text/plain,text/markdown"`, exact limit help, `载入演示访谈`, and `分析访谈（本地演示）`.

For paste, call `validatePastedText()`. For upload, read `new Uint8Array(await file.arrayBuffer())` and call `decodeUploadedText(file.name, bytes)`. `载入演示访谈` passes `SYNTHETIC_INTERVIEW_TEXT` through the same paste validator. If cards already exist, call `window.confirm('替换材料会清空当前页面中的需求、优先级和 PRD 预览。是否继续？')` before dispatching `materialAccepted`. Analysis calls `createDemoCards()` locally and announces `已用本地演示规则生成 N 张卡片；没有调用模型。`. Every validation, file-read, or local-analysis failure dispatches `operationFailed` with the concrete domain/browser message so the shared focusable alert displays it; do not keep a second component-local error state.

- [ ] **Step 5: Implement Requirements and Priority steps.**

Every cited card shows `原文引用`, its read-only blockquote and all `[start, end)` values. All cards show `演示生成`. Requirements fields use labelled inputs/textareas and dispatch only allowed manual edits.

Priority uses a fieldset per card. Cited cards expose native controls for high/medium/low and include/defer/reject. Inference cards expose only defer/reject, display `AI 推断，待确认（演示）` and `不可纳入本次 PRD`, and never render an include control. Display `已纳入 X 条有原文引用的需求` from `eligibleRequirements()`.

- [ ] **Step 6: Implement PRD preview and browser download.**

The PRD step is reachable as soon as cards exist. Before eligibility, show `请先在“优先级”中纳入至少一条有原文引用的需求。`, keep `生成 PRD 预览` disabled, and provide a return action. After eligibility, the enabled button calls `renderDemoPrd()` and dispatches `prdGenerated`; a domain failure dispatches `operationFailed` rather than showing success.

Render a safe structured preview from current project/card data using React elements; do not parse arbitrary Markdown into HTML. The download handler is exactly a thin adapter around the current artifact:

```ts
const blob = new Blob([state.prd.bytes], { type: 'text/markdown;charset=utf-8' })
const href = URL.createObjectURL(blob)
const anchor = document.createElement('a')
anchor.href = href
anchor.download = state.prd.filename
document.body.append(anchor)
anchor.click()
anchor.remove()
setTimeout(() => URL.revokeObjectURL(href), 0)
```

After download, announce the exact filename and say it is a Demo export.

- [ ] **Step 7: Add the standalone entry and complete visual system.**

`demo/main.tsx` imports `./demo.css`, requires `#root`, and mounts `<DemoApp />` with `createRoot`. `demo/index.html` contains only UTF-8 charset, viewport, Chinese title, `#root`, and `./assets/demo.js`; esbuild emits the imported stylesheet as `./assets/demo.css`, which the build step injects into the copied HTML.

Use these exact base tokens in `demo.css`:

```css
:root {
  color-scheme: dark;
  --bg: #0d0b12;
  --panel: rgba(25, 21, 33, 0.86);
  --panel-strong: rgba(32, 27, 43, 0.96);
  --border: rgba(205, 178, 255, 0.2);
  --text: #f7f3fb;
  --muted: #b9afc6;
  --accent: #c7a6ff;
  --accent-strong: #9a6bff;
  --success: #8ce3c0;
  --warning: #f5c46b;
  --danger: #ff8f9a;
}
```

Use a deep ink background with restrained lavender radial gradients and frosted panels so the Demo fits the existing personalized ripple theme without implementing another mouse effect. Content max-width is 1120px. Controls have at least 44px height and visible `:focus-visible` outlines. At 720px, collapse grids and make step navigation horizontally scrollable. At 400px, retain 16px gutters and wrap quotes with `overflow-wrap: anywhere`. Disable nonessential transitions under `prefers-reduced-motion: reduce`.

- [ ] **Step 8: Run Task 3 GREEN checks.**

```bash
npm test -- tests/demo/markup.test.tsx
npm test -- tests/demo
npm run typecheck
```

Expected: all Demo tests and typecheck pass; this is static/SSR evidence, not interactive browser evidence.

- [ ] **Step 9: Commit Task 3.**

```bash
git add -- packages/workbench/src/demo/components packages/workbench/src/demo/DemoApp.tsx packages/workbench/demo tests/demo/markup.test.tsx package.json package-lock.json tsconfig.tests.json vitest.config.ts
git diff --cached --check
git diff --cached --name-only
git commit -m "feat: add four-step local demo interface"
```

---

### Task 4: Guarded browser build, quick-start command, and acceptance

**Files:**

- Modify: `packages/workbench/build.mjs`
- Modify: `scripts/workspace-boundary.ts`
- Create: `scripts/serve-demo.mjs`
- Modify: `package.json`
- Create: `tests/integration/demo-build.test.ts`
- Create: `tests/integration/demo-server.test.ts`
- Modify: `tests/integration/workspace-boundary.test.ts`
- Create: `tests/contract/demo-boundary.test.ts`
- Modify: `packages/workbench/README.md`

**Interfaces:**

- `buildWorkbench()` remains the default package build with identical outputs.
- Produces `assertWorkbenchDemoWritePath()`, which accepts only strict physical descendants of repository `.tmp/dsh-pm-workbench/` and rejects the subtree root, wider `.tmp`, package output, and symlink escapes.
- Produces `buildDemo({ outdir?, guard? })`, writing only `index.html`, `assets/demo.js`, and `assets/demo.css` beneath the dedicated Demo subtree. The injected guard is an additional test hook and can never replace the Demo-specific security guard.
- Produces `startDemoServer({ port? })`, bound only to `127.0.0.1`, serving a fixed three-file route set and returning a closeable `{ server, url }` handle after listening.
- Produces `npm run demo:build` and `npm run demo:serve`; neither is a Harness command.

- [ ] **Step 1: Write failing Demo graph and build tests.**

`tests/contract/demo-boundary.test.ts` recursively reads only `packages/workbench/src/demo/**` and `packages/workbench/demo/**`. It fails on Harness/Cordis/provider imports or the exact tokens `fetch(`, `XMLHttpRequest`, `WebSocket`, `localStorage`, `sessionStorage`, `indexedDB`, `document.cookie`, `caches.`, or `navigator.serviceWorker`. Allow `Blob`, `URL.createObjectURL`, and the single DOM entry/download adapter.

`tests/integration/workspace-boundary.test.ts` proves `assertWorkbenchDemoWritePath()` accepts the default Demo directory and a strict `.tmp/dsh-pm-workbench/test-*` child, but rejects `.tmp`, `.tmp/dsh-pm-workbench` itself, `packages/workbench/lib/demo`, and a lexical child whose existing symlink resolves outside the dedicated subtree.

`tests/integration/demo-build.test.ts` creates a unique output at `.tmp/dsh-pm-workbench/test-<id>`, calls `buildDemo({ outdir })`, and asserts the exact sorted files:

```ts
expect(files).toEqual(['assets/demo.css', 'assets/demo.js', 'index.html'])
expect(await readFile(path.join(outdir, 'index.html'), 'utf8')).toContain('./assets/demo.js')
expect(await readFile(path.join(outdir, 'index.html'), 'utf8')).toContain('./assets/demo.css')
expect(await readFile(path.join(outdir, 'assets/demo.js'), 'utf8')).toContain('演示数据')
expect(await readFile(path.join(outdir, 'assets/demo.js'), 'utf8')).not.toContain('__ModuleLoader__')
```

Inject a rejecting additional guard and prove it fails before creating the otherwise in-bound output directory. Separately call `buildDemo()` with `.tmp`, `.tmp/dsh-pm-workbench`, `packages/workbench/lib/demo`, and the tested symlink escape; prove each rejects before mutation even when the injected guard is a no-op.

`tests/integration/demo-server.test.ts` imports `startDemoServer()`, calls it with `port: 0`, and verifies the returned server address is `127.0.0.1`. Against the returned actual URL, assert GET `/` and `/assets/demo.js` return 200, HEAD `/assets/demo.css` returns 200 with an empty body, GET `/missing` returns 404, and POST `/` returns 405. Close the returned server in `finally`, await the close callback, and assert it is no longer listening.

- [ ] **Step 2: Run all Task 4 tests and observe RED.**

```bash
npm test -- tests/contract/demo-boundary.test.ts tests/integration/workspace-boundary.test.ts tests/integration/demo-build.test.ts tests/integration/demo-server.test.ts
```

Expected: the source boundary test may pass on the current source subset, while the Demo guard/build/server tests are collected and fail because their exports do not exist. Zero collected tests is not RED.

- [ ] **Step 3: Implement the separate esbuild Demo target.**

Extend `build.mjs` with:

```js
const repositoryRoot = path.resolve(packageRoot, '../..')
const demoTempRoot = path.join(repositoryRoot, '.tmp', 'dsh-pm-workbench')
const defaultDemoOutdir = path.join(repositoryRoot, '.tmp', 'dsh-pm-workbench', 'demo')

export async function buildDemo({ outdir = defaultDemoOutdir, guard = assertWorkbenchWritePath } = {})
```

In `scripts/workspace-boundary.ts`, implement and export `assertWorkbenchDemoWritePath()` by passing the candidate through the existing physical `resolveForWrite()` logic and requiring it to be inside, but not equal to, `.tmp/dsh-pm-workbench`. Keep the general package/temp guard unchanged.

At the start of `buildDemo()`, run the Demo-specific guard on the resolved output root regardless of the injected `guard`; before every later mutation, run both the Demo-specific guard and the injected additional guard. Bundle `packages/workbench/demo/main.tsx` for `platform: 'browser'`, `format: 'iife'`, `charset: 'utf8'`, with React included and no `@deepseek-ai/*` import. Use esbuild `write: false` and `outfile: <outdir>/assets/demo.js`; accept exactly one JS and one CSS output from memory, map them only to `assets/demo.js` and `assets/demo.css`, and fail closed on a missing or extra output. Then guard immediately before `rm(outdir)`, each `mkdir`, and each of the three explicit `writeFile` calls. Read the static HTML and inject `<link rel="stylesheet" href="./assets/demo.css">` if it is not already present. Add one closed CLI branch, `--demo`; keep default build, `--verify`, `--verify-profile`, and `--test-e2e` semantics unchanged.

- [ ] **Step 4: Implement a fixed loopback static server.**

`scripts/serve-demo.mjs` imports and runs `buildDemo()` first. Export:

```js
export async function startDemoServer({ port = 4173 } = {})
```

Resolve only after the server is listening. Return `Promise<{ server: import('node:http').Server; url: string }>` where `url` contains the actual bound port, including when the input port is `0`. Bind only `127.0.0.1`. Accept GET/HEAD for exactly `/`, `/index.html`, `/assets/demo.js`, and `/assets/demo.css`; HEAD returns the same headers without a response body. Return 404 for every other path and 405 for other methods. Do not proxy, list directories, accept an alternate root, or open a browser automatically. Print exactly the returned URL once after listening. When run as the entry, close cleanly on SIGINT/SIGTERM.

- [ ] **Step 5: Add quick-start scripts and honest documentation.**

Add to root `package.json`:

```json
"demo:build": "node --experimental-strip-types packages/workbench/build.mjs --demo",
"demo:serve": "node scripts/serve-demo.mjs"
```

Update `packages/workbench/README.md` with:

```text
npm run demo:serve
open http://127.0.0.1:4173/
```

The surrounding paragraph must state that this is an in-memory fixture Demo, not an installed Harness plugin or real model result. Keep the existing no-op package disclosure intact.

- [ ] **Step 6: Run complete automated verification.**

```bash
npm run typecheck
npm test
npm run build
npm run demo:build
npm run verify:package
npm run pack:dry
git diff --check
```

Expected: all commands exit 0. `verify:profile` and `test:e2e` remain deliberately unimplemented and must not be run or reported as passing.

- [ ] **Step 7: Commit Task 4.**

```bash
git add -- packages/workbench/build.mjs scripts/workspace-boundary.ts scripts/serve-demo.mjs package.json tests/integration/demo-build.test.ts tests/integration/demo-server.test.ts tests/integration/workspace-boundary.test.ts tests/contract/demo-boundary.test.ts packages/workbench/README.md
git diff --cached --check
git diff --cached --name-only
git commit -m "build: add guarded standalone demo preview"
```

- [ ] **Step 8: Run browser acceptance through the real built output.**

Run `npm run demo:serve`, open `http://127.0.0.1:4173/`, and record only directly observed behavior:

1. Both permanent Demo warnings stay visible on all four steps.
2. Load the synthetic interview, run local Demo analysis, and see two cited cards plus one inference-only card.
3. Edit a cited title/description/pain point, set its priority to high, and mark it included.
4. Confirm the inference card has no include control and no quotation.
5. Generate the PRD preview and confirm only the included cited card appears.
6. Download and reopen the Markdown; confirm the filename, headings, exact quote, offsets, and placeholder text. Inspect its first three bytes with `xxd -l 3 <downloaded-file>` (or an equivalent byte-level read) and confirm they are not `ef bb bf`.
7. Record checks at desktop, exactly 720px, and exactly 400px widths; verify keyboard navigation, visible focus, and no horizontal page overflow. Emulate `prefers-reduced-motion: reduce` and confirm nonessential transitions are disabled.
8. Refresh and confirm state is lost as the banner promises.

Any failed item remains a Demo defect. Do not reinterpret it as an Alpha/Harness blocker or report the Demo complete until fixed and rechecked.

---

## Plan Self-Review Checklist

- **Spec coverage:** Demo input, four steps, exact citation display, inference exclusion, human priority/inclusion, PRD preview/download, persistent Demo boundary, and responsive/accessibility behavior all have implementation and verification steps.
- **Intentional exclusions:** Harness mount, model/provider call, model consent, Host project list/storage, save status, restart, install/remove, and real sensitive interviews belong to a separate Alpha plan after this Demo is reviewed.
- **Dependency boundary:** runtime implementation uses already locked dependencies. Task 3 adds only the missing compatible dev declarations `@types/react-dom@18.3.7`; the plan does not add `jsdom`, Testing Library, Vite, a UI kit, router, state library, or Markdown renderer.
- **Output boundary:** package `lib` and Harness entries are unchanged; Demo files are generated under `.tmp` and excluded from the package by location.
- **TDD:** every behavioral task starts with a focused collected RED, then minimal implementation, focused GREEN, and exact-file commit.
- **Claim boundary:** fixture output, SSR checks, built browser behavior, and Alpha claims stay separate in tests, copy, documentation, and final reporting.
