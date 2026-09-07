import { describe, expect, it } from 'vitest'

import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import {
  publishRequirementBaseline,
} from '../../packages/workbench/src/domain/baseline.js'
import {
  analysisRevisionIdSchema,
  baselineIdSchema,
  evidenceIdSchema,
  generatedDraftIdSchema,
  prdRevisionIdSchema,
  projectIdSchema,
  requirementIdSchema,
  requirementRevisionIdSchema,
  sourceRevisionIdSchema,
} from '../../packages/workbench/src/domain/ids.js'
import {
  MAX_BASELINES_PER_PROJECT,
  MAX_PRD_MARKDOWN_UTF8_BYTES,
  MAX_PRD_REVISIONS_PER_PROJECT,
  utf8ByteLength,
} from '../../packages/workbench/src/domain/limits.js'
import type { ActiveProjectRecord, RequirementBaseline } from '../../packages/workbench/src/domain/model.js'
import {
  DeterministicPrdRenderer,
  PRD_RENDERER_VERSION,
  isPrdCurrent,
  renderPmwbPrdV1,
} from '../../packages/workbench/src/domain/prd.js'

const PROJECT_ID = projectIdSchema.parse('00000000-0000-4000-8000-000000000551')
const SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000551')
const ANALYSIS_ID = analysisRevisionIdSchema.parse('20000000-0000-4000-8000-000000000551')
const EVIDENCE_ID = evidenceIdSchema.parse('30000000-0000-4000-8000-000000000551')
const REQUIREMENT_ID = requirementIdSchema.parse('40000000-0000-4000-8000-000000000551')
const DRAFT_ID = generatedDraftIdSchema.parse('50000000-0000-4000-8000-000000000551')
const REVISION_ID = requirementRevisionIdSchema.parse('60000000-0000-4000-8000-000000000551')
const BASELINE_ID = baselineIdSchema.parse('70000000-0000-4000-8000-000000000551')
const OTHER_BASELINE_ID = baselineIdSchema.parse('70000000-0000-4000-8000-000000000552')
const PRD_ID = prdRevisionIdSchema.parse('80000000-0000-4000-8000-000000000551')
const CREATED_AT = '2026-09-07T08:00:00.000Z'
const OTHER_TIME = '2026-09-08T08:00:00.000Z'
const SOURCE_TEXT = '用户说：原文支持需求。'
const QUOTE = '原文支持需求'
const START = SOURCE_TEXT.indexOf(QUOTE)
const SOURCE_HASH = nodeSha256Utf8(SOURCE_TEXT)
const QUOTE_HASH = nodeSha256Utf8(QUOTE)

function includedProject(overrides: Partial<ActiveProjectRecord> = {}): ActiveProjectRecord {
  const project: ActiveProjectRecord = {
    kind: 'active', schemaVersion: 1,
    header: {
      id: PROJECT_ID, name: '项目 *名称* <b>', researchGoal: '验证 [目标] | `内容` [^fake]',
      projectVersion: 5, contentVersion: 4, reviewStarted: true, updatedAt: CREATED_AT,
    },
    source: {
      id: SOURCE_ID, projectId: PROJECT_ID, revision: 1, displayName: '合成访谈.md', format: 'text/markdown',
      text: SOURCE_TEXT, utf8Bytes: utf8ByteLength(SOURCE_TEXT), contentHash: SOURCE_HASH,
      syntheticDataAttested: true,
    },
    analyses: [{
      id: ANALYSIS_ID, sourceRevisionId: SOURCE_ID, kind: 'fixture', generation: 1,
      baseProjectVersion: 2, status: 'draft',
    }],
    currentAnalysisRevisionId: ANALYSIS_ID,
    evidence: [{
      id: EVIDENCE_ID, sourceRevisionId: SOURCE_ID, role: 'support', start: START,
      end: START + QUOTE.length, quote: QUOTE, quoteHash: QUOTE_HASH,
    }],
    generatedRequirements: [{
      id: DRAFT_ID, requirementId: REQUIREMENT_ID, analysisRevisionId: ANALYSIS_ID,
      sourceRevisionId: SOURCE_ID, producer: 'fixture', title: '生成 #标题 <script>',
      painPoint: '痛点 | `代码` [^1]', description: '描述 **加粗** <img src=x>',
      evidenceIds: [EVIDENCE_ID], rationale: '生成理由不可改写', assumptions: [], unknowns: [],
      suggestedPriority: 'high',
    }],
    humanRevisions: [],
    humanDecisions: [{
      requirementId: REQUIREMENT_ID, selectedText: { kind: 'generated', draftId: DRAFT_ID },
      priority: 'high', decision: 'include', humanReason: '人工理由 | <tag> `x` [^reason]',
    }],
    requirementOrder: [REQUIREMENT_ID], baselines: [], currentBaselineId: null,
    prdRevisions: [], commandReceipts: [],
  }
  return { ...project, ...overrides }
}

function publish(project: ActiveProjectRecord = includedProject(), baselineId = BASELINE_ID): RequirementBaseline {
  return publishRequirementBaseline(project, {
    baselineId,
    createdAt: CREATED_AT,
    sha256Utf8: nodeSha256Utf8,
  })
}

describe('immutable requirement baseline', () => {
  it('deep copies every included generated identity and PRD input into a frozen baseline', () => {
    const project = includedProject()
    const baseline = publish(project)
    const mutable = structuredClone(project)
    Reflect.set(mutable.header, 'name', 'changed later')
    Reflect.set(mutable.humanDecisions[0]!, 'humanReason', 'changed later')
    Reflect.set(mutable.evidence[0]!, 'quote', 'changed later')

    expect(baseline).toMatchObject({
      id: BASELINE_ID, projectId: PROJECT_ID, projectName: '项目 *名称* <b>',
      researchGoal: '验证 [目标] | `内容` [^fake]', sourceRevisionId: SOURCE_ID,
      sourceContentHash: SOURCE_HASH, projectVersion: 5, contentVersion: 4,
      items: [{
        rank: 1, requirementId: REQUIREMENT_ID,
        textSource: { kind: 'generated', draftId: DRAFT_ID, producer: 'fixture' },
        title: '生成 #标题 <script>', priority: 'high',
        humanReason: '人工理由 | <tag> `x` [^reason]',
        evidence: [{ id: EVIDENCE_ID, start: START, end: START + QUOTE.length, quoteHash: QUOTE_HASH }],
      }],
      createdAt: CREATED_AT,
    })
    expect(baseline.items[0]?.humanReason).not.toBe('changed later')
    expect(baseline.items[0]?.evidence[0]?.quote).not.toBe('changed later')
    expect(baseline.items[0]).not.toBe(project.generatedRequirements[0])
    expect(baseline.items[0]?.evidence[0]).not.toBe(project.evidence[0])
    expect(Object.isFrozen(baseline)).toBe(true)
    expect(Object.isFrozen(baseline.items[0]?.evidence)).toBe(true)
  })

  it('copies the exact selected human revision while retaining its based-on generated draft identity', () => {
    const project = includedProject()
    const human = {
      id: REVISION_ID, requirementId: REQUIREMENT_ID, basedOnDraftId: DRAFT_ID,
      title: '人工标题', painPoint: '人工痛点', description: '人工描述',
    }
    const baseline = publish({
      ...project,
      humanRevisions: [human],
      humanDecisions: [{ ...project.humanDecisions[0]!, selectedText: { kind: 'human-revision', revisionId: REVISION_ID } }],
    })
    expect(baseline.items[0]).toMatchObject({
      textSource: { kind: 'human-revision', draftId: DRAFT_ID, revisionId: REVISION_ID },
      title: '人工标题', painPoint: '人工痛点', description: '人工描述',
    })
  })

  it('rejects empty inclusion, unsupported inclusion, invalid evidence, and stale selected identities', () => {
    const project = includedProject()
    expect(() => publish({
      ...project, humanDecisions: [{ ...project.humanDecisions[0]!, decision: 'defer' }],
    })).toThrowError('no-included-requirements')
    expect(() => publish({
      ...project, evidence: [{ ...project.evidence[0]!, role: 'context' }],
    })).toThrowError('invalid-evidence')
    expect(() => publish({
      ...project, evidence: [{ ...project.evidence[0]!, quoteHash: SOURCE_HASH }],
    })).toThrowError('invalid-evidence')
    expect(() => publish({
      ...project,
      humanDecisions: [{ ...project.humanDecisions[0]!, selectedText: { kind: 'human-revision', revisionId: REVISION_ID } }],
    })).toThrowError('baseline-stale')
    expect(() => publish({
      ...project, currentAnalysisRevisionId: analysisRevisionIdSchema.parse('20000000-0000-4000-8000-000000000599'),
    })).toThrowError('baseline-stale')
    expect(() => publish({ ...project, baselines: [publish(project)] })).toThrowError('baseline-stale')
  })

  it('enforces a complete current decision set, exact order, and the eight-baseline ceiling', () => {
    const project = includedProject()
    expect(() => publish({ ...project, humanDecisions: [] })).toThrowError('baseline-stale')
    expect(() => publish({ ...project, requirementOrder: [] })).toThrowError('baseline-stale')

    const eight = Array.from({ length: MAX_BASELINES_PER_PROJECT }, (_, index) => ({
      ...publish(project, baselineIdSchema.parse(`70000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`)),
    }))
    expect(eight).toHaveLength(8)
    expect(() => publish({ ...project, baselines: eight })).toThrowError('limit-exceeded')
  })

  it('accepts exactly 24 included baseline items and rejects a twenty-fifth without truncation', () => {
    const project = includedProject()
    const drafts = Array.from({ length: 25 }, (_, index) => ({
      ...project.generatedRequirements[0]!,
      id: generatedDraftIdSchema.parse(`50000000-0000-4000-8000-${(index + 600).toString(16).padStart(12, '0')}`),
      requirementId: requirementIdSchema.parse(`40000000-0000-4000-8000-${(index + 600).toString(16).padStart(12, '0')}`),
    }))
    const decisions = drafts.map(draft => ({
      ...project.humanDecisions[0]!, requirementId: draft.requirementId,
      selectedText: { kind: 'generated' as const, draftId: draft.id },
    }))
    const exact = {
      ...project,
      generatedRequirements: drafts.slice(0, 24),
      humanDecisions: decisions.slice(0, 24),
      requirementOrder: drafts.slice(0, 24).map(item => item.requirementId),
    }
    expect(publish(exact).items).toHaveLength(24)
    expect(() => publish({
      ...exact,
      generatedRequirements: drafts,
      humanDecisions: decisions,
      requirementOrder: drafts.map(item => item.requirementId),
    })).toThrowError('limit-exceeded')
  })
})

describe('deterministic pmwb-prd-v1 renderer', () => {
  const renderer = new DeterministicPrdRenderer(nodeSha256Utf8)

  it('renders identical UTF-8 bytes and hash when only createdAt changes', () => {
    const baseline = publish()
    const first = renderer.render({ baseline, prdRevisionId: PRD_ID, createdAt: CREATED_AT })
    const second = renderer.render({ baseline, prdRevisionId: PRD_ID, createdAt: OTHER_TIME })

    expect(Buffer.from(first.markdown, 'utf8')).toEqual(Buffer.from(second.markdown, 'utf8'))
    expect(first.contentHash).toBe(second.contentHash)
    expect(first.contentHash).toBe(nodeSha256Utf8(first.markdown))
    expect(first.markdown.charCodeAt(0)).not.toBe(0xfeff)
    expect(first.rendererVersion).toBe(PRD_RENDERER_VERSION)
    expect(first.createdAt).not.toBe(second.createdAt)
    expect(Object.isFrozen(first)).toBe(true)
  })

  it('writes exactly nine required Chinese sections in fixed order and trace rows with every frozen identity', () => {
    const baseline = publish()
    const markdown = renderer.render({ baseline, prdRevisionId: PRD_ID, createdAt: CREATED_AT }).markdown
    const headings = [...markdown.matchAll(/^## (.+)$/gm)].map(match => match[1])
    expect(headings).toEqual([
      '背景与问题', '目标用户和场景', '用户痛点及访谈依据', '本期目标',
      '功能需求和优先级', '非本期范围', '验收建议', '成功指标', '风险与待确认问题',
    ])
    for (const value of [
      PROJECT_ID, SOURCE_ID, SOURCE_HASH, BASELINE_ID, REQUIREMENT_ID, DRAFT_ID,
      EVIDENCE_ID, String(START), String(START + QUOTE.length), QUOTE_HASH, PRD_RENDERER_VERSION,
    ]) expect(markdown).toContain(value)
    expect(markdown).toContain('使用原始本地测试草稿')
  })

  it('escapes Markdown, HTML, table pipes, backticks, and footnote syntax from every baseline-authored field', () => {
    const markdown = renderer.render({ baseline: publish(), prdRevisionId: PRD_ID, createdAt: CREATED_AT }).markdown
    expect(markdown).not.toContain('<script>')
    expect(markdown).not.toContain('<img')
    expect(markdown).not.toContain('<tag>')
    expect(markdown).not.toMatch(/\[\^(?:fake|1|reason)\]/)
    expect(markdown).toContain('&lt;script&gt;')
    expect(markdown).toContain('\\|')
    expect(markdown).toContain('\\`内容\\`')
    expect(markdown).toContain('\\[\\^fake\\]')
  })

  it('replaces authored C0, DEL, and C1 controls with stable visible encodings', () => {
    const baseline = structuredClone(publish())
    Reflect.set(baseline, 'projectName', '项目\0名称')
    Reflect.set(baseline, 'researchGoal', '目标\u001b结束')
    Reflect.set(baseline.items[0]!, 'title', '标题\t制表')
    Reflect.set(baseline.items[0]!, 'painPoint', '痛点\u007f删除')
    Reflect.set(baseline.items[0]!, 'description', '描述\u0085换行')
    Reflect.set(baseline.items[0]!, 'humanReason', '理由\u009f控制')
    Reflect.set(baseline.items[0]!.evidence[0]!, 'quote', '证据\0\u001b\t\u007f\u0085\u009f')
    Reflect.set(
      baseline.items[0]!.evidence[0]!,
      'quoteHash',
      nodeSha256Utf8(baseline.items[0]!.evidence[0]!.quote),
    )

    const first = renderer.render({ baseline, prdRevisionId: PRD_ID, createdAt: CREATED_AT })
    const second = renderer.render({ baseline, prdRevisionId: PRD_ID, createdAt: OTHER_TIME })
    expect(first.markdown).toBe(second.markdown)
    for (const raw of ['\0', '\u001b', '\t', '\u007f', '\u0085', '\u009f']) {
      expect(first.markdown).not.toContain(raw)
    }
    for (const visible of ['⟦U+0000⟧', '⟦U+001B⟧', '⟦U+0009⟧', '⟦U+007F⟧', '⟦U+0085⟧', '⟦U+009F⟧']) {
      expect(first.markdown).toContain(visible)
    }
  })

  it('marks unknown business facts and generated acceptance criteria without inventing scope or plans', () => {
    const markdown = renderer.render({ baseline: publish(), prdRevisionId: PRD_ID, createdAt: CREATED_AT }).markdown
    for (const label of ['市场规模', '用户数量', '排期', '收入', '研发成本', '成功指标', '技术方案']) {
      expect(markdown).toContain(`${label}：待产品经理补充`)
    }
    expect(markdown).toContain('建议：')
    expect(markdown).not.toContain('延期需求')
    expect(markdown).not.toMatch(/Q[1-4]|万用户|万元|开发周期|转化率|准确率|React|Node\.js/)
    expect(markdown.match(/待产品经理补充/g)?.length).toBeGreaterThanOrEqual(7)
  })

  it('derives current and stale status from the current baseline and content version', () => {
    const baseline = publish()
    const prd = renderer.render({ baseline, prdRevisionId: PRD_ID, createdAt: CREATED_AT })
    const current = { ...includedProject(), baselines: [baseline], currentBaselineId: BASELINE_ID, prdRevisions: [prd] }
    expect(isPrdCurrent(current, prd)).toBe(true)
    expect(isPrdCurrent({ ...current, currentBaselineId: OTHER_BASELINE_ID }, prd)).toBe(false)
    expect(isPrdCurrent({ ...current, header: { ...current.header, contentVersion: current.header.contentVersion + 1 } }, prd)).toBe(false)
    expect(isPrdCurrent(current, { ...prd, baselineContentVersion: prd.baselineContentVersion + 1 })).toBe(false)
  })

  it('rechecks frozen evidence identity and quote hash before rendering', () => {
    const baseline = publish()
    const wrongSource = structuredClone(baseline)
    Reflect.set(wrongSource.items[0]!.evidence[0]!, 'sourceRevisionId', sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000599'))
    const wrongQuote = structuredClone(baseline)
    Reflect.set(wrongQuote.items[0]!.evidence[0]!, 'quote', '被篡改的引用')
    expect(() => renderer.render({ baseline: wrongSource, prdRevisionId: PRD_ID, createdAt: CREATED_AT }))
      .toThrowError('invalid-prd-input')
    expect(() => renderer.render({ baseline: wrongQuote, prdRevisionId: PRD_ID, createdAt: CREATED_AT }))
      .toThrowError('invalid-evidence')
  })

  it('enforces the eight-PRD ceiling and accepts 262144 bytes then rejects the next byte without truncation', () => {
    const baseline = publish()
    expect(() => renderer.render({
      baseline, prdRevisionId: PRD_ID, createdAt: CREATED_AT,
      existingPrdCount: MAX_PRD_REVISIONS_PER_PROJECT,
    })).toThrowError('limit-exceeded')
    expect(renderer.render({
      baseline, prdRevisionId: PRD_ID, createdAt: CREATED_AT,
      existingPrdCount: MAX_PRD_REVISIONS_PER_PROJECT - 1,
    }).id).toBe(PRD_ID)
    expect(() => renderer.render({
      baseline, prdRevisionId: PRD_ID, createdAt: CREATED_AT,
      currentBaselineId: OTHER_BASELINE_ID,
    })).toThrowError('baseline-stale')
    expect(() => renderer.render({
      baseline, prdRevisionId: PRD_ID, createdAt: CREATED_AT,
      currentContentVersion: baseline.contentVersion + 1,
    })).toThrowError('baseline-stale')

    const sized: RequirementBaseline = {
      ...structuredClone(baseline),
      items: Array.from({ length: 24 }, (_, index) => ({
        ...baseline.items[0]!, rank: index + 1,
        requirementId: requirementIdSchema.parse(`40000000-0000-4000-8000-${(index + 100).toString(16).padStart(12, '0')}`),
        textSource: {
          kind: 'generated' as const,
          draftId: generatedDraftIdSchema.parse(`50000000-0000-4000-8000-${(index + 100).toString(16).padStart(12, '0')}`),
          producer: 'fixture' as const,
        },
        title: 'a', painPoint: 'a', description: 'a', humanReason: 'a',
      })),
    }
    let remaining = MAX_PRD_MARKDOWN_UTF8_BYTES - utf8ByteLength(renderPmwbPrdV1(sized))
    expect(remaining).toBeGreaterThan(0)
    const fields = sized.items.flatMap(item => [
      [item, 'painPoint'] as const,
      [item, 'description'] as const,
      [item, 'humanReason'] as const,
    ])
    for (const [item, field] of fields) {
      if (remaining === 0) break
      const extraBytes = Math.min(remaining, 5_899)
      const desiredBytes = extraBytes + 1
      const chinese = Math.floor(desiredBytes / 3)
      const ascii = desiredBytes % 3
      Reflect.set(item, field, `${'中'.repeat(chinese)}${'x'.repeat(ascii)}`)
      remaining -= extraBytes
    }
    expect(remaining).toBe(0)
    expect(utf8ByteLength(renderPmwbPrdV1(sized))).toBe(MAX_PRD_MARKDOWN_UTF8_BYTES)
    const exact = renderer.render({ baseline: sized, prdRevisionId: PRD_ID, createdAt: CREATED_AT })
    expect(utf8ByteLength(exact.markdown)).toBe(MAX_PRD_MARKDOWN_UTF8_BYTES)

    const over = structuredClone(sized)
    Reflect.set(over.items[0]!, 'painPoint', `${over.items[0]!.painPoint}x`)
    expect(utf8ByteLength(renderPmwbPrdV1(over))).toBe(MAX_PRD_MARKDOWN_UTF8_BYTES + 1)
    expect(() => renderer.render({ baseline: over, prdRevisionId: PRD_ID, createdAt: CREATED_AT }))
      .toThrowError('limit-exceeded')
    expect(MAX_PRD_MARKDOWN_UTF8_BYTES).toBe(262_144)
  })
})
