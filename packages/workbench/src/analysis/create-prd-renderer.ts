import { z } from 'zod'
import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import type { Sha256Hex } from '../domain/ids.js'
import { MAX_PRD_MARKDOWN_UTF8_BYTES, MAX_PRD_REVISIONS_PER_PROJECT, utf8ByteLength } from '../domain/limits.js'
import { deepFreeze, prdRevisionSchema, type RequirementBaseline } from '../domain/model.js'
import { escapeInline, validateBaseline, type CurrentBaselineInput, type PrdRenderer } from '../domain/prd.js'

export const CREATE_PRD_SKILL_REVISION = 'a372bee16dc2275e26078ca70a2eb7614ea316f7'
const text = z.string().trim().min(1).max(6000).refine(value => !value.includes('待产品经理补充'))
const entries = z.array(text).max(24)
const feature = z.strictObject({ key: z.string().regex(/^R[1-9]\d*$/), userStory: text,
  flow: entries.min(1), acceptanceCriteria: entries.min(1), exceptions: entries.min(1), aiNotes: entries })
const draftSchema = z.strictObject({ summary: text, background: text, objectives: entries.min(1),
  usersAndScenarios: text, valueProposition: text, requirements: z.array(feature).min(1).max(24),
  releasePlan: entries.min(1), assumptions: entries, openQuestions: entries })
const stringField = { type: 'string' } as const
const stringList = { type: 'array', items: stringField } as const
export const STRUCTURED_PRD_OUTPUT_SCHEMA: ObjectJsonSchema = {
  type: 'object', additionalProperties: false,
  required: ['summary', 'background', 'objectives', 'usersAndScenarios', 'valueProposition', 'requirements', 'releasePlan', 'assumptions', 'openQuestions'],
  properties: { summary: stringField, background: stringField, objectives: stringList,
    usersAndScenarios: stringField, valueProposition: stringField,
    requirements: { type: 'array', items: { type: 'object', additionalProperties: false,
      required: ['key', 'userStory', 'flow', 'acceptanceCriteria', 'exceptions', 'aiNotes'],
      properties: { key: stringField, userStory: stringField, flow: stringList, acceptanceCriteria: stringList, exceptions: stringList, aiNotes: stringList } } },
    releasePlan: stringList, assumptions: stringList, openQuestions: stringList },
}
export interface StructuredPrdRunner {
  run(input: { readonly baseline: RequirementBaseline }, signal: AbortSignal): Promise<{
    readonly stopReason: string; readonly structured?: unknown; readonly provider: string; readonly model: string
  }>
}
const bullets = (values: readonly string[]) => values.map(value => `- ${escapeInline(value)}`)

/** Model proposes prose; the immutable human baseline owns scope, priority, order and evidence. */
export class HarnessSkillPrdRenderer implements PrdRenderer {
  constructor(private readonly runner: StructuredPrdRunner, private readonly sha256Utf8: (value: string) => Sha256Hex) {}

  async render(input: CurrentBaselineInput, signal = new AbortController().signal) {
    signal.throwIfAborted()
    const baseline = input.baseline
    validateBaseline(baseline, this.sha256Utf8)
    if ((input.currentBaselineId !== undefined && input.currentBaselineId !== baseline.id)
      || (input.currentContentVersion !== undefined && input.currentContentVersion !== baseline.contentVersion)) throw new Error('baseline-stale')
    if (input.existingPrdCount !== undefined && (!Number.isSafeInteger(input.existingPrdCount)
      || input.existingPrdCount < 0 || input.existingPrdCount >= MAX_PRD_REVISIONS_PER_PROJECT)) throw new Error('limit-exceeded')
    const result = await this.runner.run({ baseline }, signal)
    signal.throwIfAborted()
    if (result.stopReason !== 'completed' || !result.provider?.trim() || !result.model?.trim()) throw new Error('stage-unavailable')
    const parsed = draftSchema.safeParse(result.structured)
    if (!parsed.success) throw new Error('invalid-evidence')
    const draft = parsed.data, keys = new Set(draft.requirements.map(item => item.key))
    if (keys.size !== draft.requirements.length || keys.size !== baseline.items.length
      || baseline.items.some(item => !keys.has(`R${item.rank}`))) throw new Error('invalid-evidence')
    const byKey = new Map(draft.requirements.map(item => [item.key, item]))
    const sections = baseline.items.flatMap(item => {
      const proposal = byKey.get(`R${item.rank}`)!
      return [`### R${item.rank} ${escapeInline(item.title)}`,
        `- 用户痛点：${escapeInline(item.painPoint)}`, `- 已确认需求：${escapeInline(item.description)}`,
        `- 人工优先级：${({ high: '高', medium: '中', low: '低' } as const)[item.priority]}`,
        `- 人工理由：${escapeInline(item.humanReason || '本次未填写理由')}`,
        `- 用户故事（AI 建议）：${escapeInline(proposal.userStory)}`, '',
        '#### 使用流程（AI 建议）', ...proposal.flow.map((value, index) => `${index + 1}. ${escapeInline(value)}`), '',
        '#### 验收条件（AI 建议）', ...bullets(proposal.acceptanceCriteria), '',
        '#### 异常与边界（AI 建议）', ...bullets(proposal.exceptions), '',
        ...(proposal.aiNotes.length ? ['#### AI 能力与人工控制（AI 建议）', ...bullets(proposal.aiNotes), ''] : []),
        '#### 访谈依据', ...item.evidence.map((evidence, index) => `- E${item.rank}.${index + 1}（${evidence.role}）：${escapeInline(evidence.quote)}`), '']
    })
    const markdown = ['AI 建议草稿，尚需产品经理审查。需求范围、顺序与优先级来自人工确认；流程、验收与发布方案是待验证建议。', '',
      '## 1. 概要', `- 项目名称：${escapeInline(baseline.projectName)}`, escapeInline(draft.summary), '',
      '## 2. 协作与责任', '产品、设计、研发与验收负责人尚未提供，需在待确认问题中明确。', '',
      '## 3. 背景与问题', escapeInline(draft.background),
      ...(baseline.researchGoal ? [`- 研究目标：${escapeInline(baseline.researchGoal)}`] : []), '',
      '## 4. 目标与成功标准（AI 建议）', ...bullets(draft.objectives), '',
      '## 5. 目标用户与使用场景', escapeInline(draft.usersAndScenarios), '',
      '## 6. 用户价值', escapeInline(draft.valueProposition), '',
      '## 7. 功能方案', '### 人工确认的本期范围',
      ...baseline.items.map(item => `- R${item.rank} ${escapeInline(item.title)}`),
      '未纳入本次基线的需求不属于本期开发承诺。', '', ...sections,
      '## 8. 发布与验证（AI 建议）', ...bullets(draft.releasePlan), '',
      '## 假设与待确认问题', '### 待验证假设', ...bullets(draft.assumptions.length ? draft.assumptions : ['暂无额外假设；方案仍需 POC 验证。']),
      '### 待确认问题', ...bullets([...new Set(['确认产品、设计、研发与验收负责人。',
        '确认成功指标的基线、目标值、测量方法与验收时间；未提供数值不视为已达成效果。', ...draft.openQuestions])]), '',
      '## 附录：需求与证据追溯', '### 可追溯信息',
      `- projectId=${baseline.projectId}; baselineId=${baseline.id}; sourceRevisionId=${baseline.sourceRevisionId}; sourceContentHash=${baseline.sourceContentHash}`,
      `- rendererVersion=pmwb-create-prd-v1; skill=create-prd; skillRevision=${CREATE_PRD_SKILL_REVISION}`,
      `- 模型来源：${escapeInline(result.provider)} / ${escapeInline(result.model)}`,
      ...baseline.items.flatMap(item => item.evidence.map((evidence, index) =>
        `- R${item.rank}/E${item.rank}.${index + 1}: requirementId=${item.requirementId}; evidenceId=${evidence.id}; offsets=[${evidence.start},${evidence.end}); quoteHash=${evidence.quoteHash}`)), ''].join('\n')
    if (utf8ByteLength(markdown) > MAX_PRD_MARKDOWN_UTF8_BYTES) throw new Error('limit-exceeded')
    const revision = prdRevisionSchema.parse({ id: input.prdRevisionId, projectId: baseline.projectId,
      sourceRevisionId: baseline.sourceRevisionId, baselineId: baseline.id, baselineContentVersion: baseline.contentVersion,
      rendererVersion: 'pmwb-create-prd-v1', contentHash: this.sha256Utf8(markdown), markdown, createdAt: input.createdAt })
    return deepFreeze(revision)
  }
}
