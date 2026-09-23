import type { PrdRevisionId, Sha256Hex } from './ids.js'
import {
  MAX_PRD_MARKDOWN_UTF8_BYTES,
  MAX_PRD_REVISIONS_PER_PROJECT,
  utf8ByteLength,
} from './limits.js'
import {
  deepFreeze,
  prdRevisionSchema,
  requirementBaselineSchema,
  type ActiveProjectRecord,
  type EvidenceExcerpt,
  type PrdRevision,
  type RequirementBaseline,
  type RequirementBaselineItem,
} from './model.js'

export const PRD_RENDERER_VERSION = 'pmwb-prd-v1' as const

export interface CurrentBaselineInput {
  readonly baseline: RequirementBaseline
  readonly prdRevisionId: PrdRevisionId
  readonly createdAt: string
  readonly currentBaselineId?: RequirementBaseline['id']
  readonly currentContentVersion?: number
  readonly existingPrdCount?: number
}

export interface PrdRenderer {
  render(input: CurrentBaselineInput, signal?: AbortSignal): PrdRevision | Promise<PrdRevision>
}

function failPrd(code = 'invalid-prd-input'): never {
  throw new Error(code)
}

export function escapeInline(value: string): string {
  return value
    .replace(/\r\n|\r|\n/g, ' ')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}\[\]()#+.!|^~-]/g, '\\$&')
    .replace(/[\u0000-\u0009\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, character =>
      `⟦U+${character.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}⟧`)
}

function priorityLabel(value: RequirementBaselineItem['priority']): string {
  if (value === 'high') return '高'
  if (value === 'medium') return '中'
  return '低'
}

function evidenceLine(evidence: EvidenceExcerpt): string {
  return `- ${escapeInline(evidence.quote)}（角色：${evidence.role}；证据 ID：${evidence.id}；位置：[${evidence.start}, ${evidence.end})；引用哈希：${evidence.quoteHash}）`
}

function textSourceLines(item: RequirementBaselineItem): readonly string[] {
  if (item.textSource.kind === 'generated') {
    const origin = item.textSource.producer === 'fixture' ? '使用原始本地测试草稿' : '使用原始模型草稿'
    return [`- 文本来源：${origin}`, `- 生成草稿 ID：${item.textSource.draftId}`]
  }
  return [
    '- 文本来源：使用人工修订',
    `- 基于生成草稿 ID：${item.textSource.draftId}`,
    `- 人工修订 ID：${item.textSource.revisionId}`,
  ]
}

function renderRequirementEvidence(item: RequirementBaselineItem): string {
  return [
    `### ${item.rank}. ${escapeInline(item.title)}`,
    `- 需求 ID：${item.requirementId}`,
    `- 用户痛点：${escapeInline(item.painPoint)}`,
    ...textSourceLines(item),
    '- 访谈依据：',
    ...item.evidence.map(evidenceLine),
  ].join('\n')
}

function renderFunctionalRequirement(item: RequirementBaselineItem): string {
  return [
    `### ${item.rank}. ${escapeInline(item.title)}`,
    `- 需求描述：${escapeInline(item.description)}`,
    `- 人工优先级：${priorityLabel(item.priority)}（${item.priority}）`,
    `- 人工理由：${item.humanReason.length === 0 ? '待产品经理补充' : escapeInline(item.humanReason)}`,
  ].join('\n')
}

function renderAcceptance(item: RequirementBaselineItem): string {
  return `- 建议：按已确认需求“${escapeInline(item.title)}”逐条核对需求描述，并确认所列访谈依据仍可追溯。`
}

function renderRiskEvidence(items: readonly RequirementBaselineItem[]): readonly string[] {
  const counterexamples = items.flatMap(item => item.evidence
    .filter(evidence => evidence.role === 'counterexample')
    .map(evidence => `- 反例（需求 ${item.requirementId}）：${escapeInline(evidence.quote)}；证据 ID：${evidence.id}`))
  return counterexamples.length === 0 ? ['- 反例：待产品经理补充'] : counterexamples
}

function renderTrace(item: RequirementBaselineItem): readonly string[] {
  const textIdentity = item.textSource.kind === 'generated'
    ? `generatedDraftId=${item.textSource.draftId}; producer=${item.textSource.producer}`
    : `generatedDraftId=${item.textSource.draftId}; humanRevisionId=${item.textSource.revisionId}`
  return item.evidence.map(evidence =>
    `- requirementId=${item.requirementId}; ${textIdentity}; evidenceId=${evidence.id}; offsets=[${evidence.start},${evidence.end}); quoteHash=${evidence.quoteHash}; rendererVersion=${PRD_RENDERER_VERSION}`)
}

export function renderPmwbPrdV1(baseline: RequirementBaseline): string {
  return [
    '## 背景与问题',
    `- 项目名称：${escapeInline(baseline.projectName)}`,
    `- 研究目标：${baseline.researchGoal === null || baseline.researchGoal.length === 0 ? '待产品经理补充' : escapeInline(baseline.researchGoal)}`,
    '- 市场规模：待产品经理补充',
    '- 用户数量：待产品经理补充',
    `- 项目 ID：${baseline.projectId}`,
    `- 来源版本 ID：${baseline.sourceRevisionId}`,
    `- 来源内容哈希：${baseline.sourceContentHash}`,
    `- 需求基线 ID：${baseline.id}`,
    `- Renderer 版本：${PRD_RENDERER_VERSION}`,
    '',
    '## 目标用户和场景',
    '待产品经理补充',
    '',
    '## 用户痛点及访谈依据',
    ...baseline.items.map(renderRequirementEvidence),
    '',
    '## 本期目标',
    '待产品经理补充',
    '- 排期：待产品经理补充',
    '',
    '## 功能需求和优先级',
    ...baseline.items.map(renderFunctionalRequirement),
    '',
    '## 非本期范围',
    '待产品经理补充',
    '',
    '## 验收建议',
    ...baseline.items.map(renderAcceptance),
    '',
    '## 成功指标',
    '- 成功指标：待产品经理补充',
    '- 收入：待产品经理补充',
    '- 研发成本：待产品经理补充',
    '',
    '## 风险与待确认问题',
    ...renderRiskEvidence(baseline.items),
    '- 技术方案：待产品经理补充',
    '',
    '### 可追溯信息',
    `- projectId=${baseline.projectId}; sourceRevisionId=${baseline.sourceRevisionId}; sourceContentHash=${baseline.sourceContentHash}; baselineId=${baseline.id}; rendererVersion=${PRD_RENDERER_VERSION}`,
    ...baseline.items.flatMap(renderTrace),
    '',
  ].join('\n')
}

export function validateBaseline(
  baseline: RequirementBaseline,
  sha256Utf8: (value: string) => Sha256Hex,
): void {
  if (!requirementBaselineSchema.safeParse(baseline).success) failPrd()
  if (baseline.items.length === 0
    || baseline.items.some((item, index) => item.rank !== index + 1)
    || new Set(baseline.items.map(item => item.requirementId)).size !== baseline.items.length
    || baseline.items.some(item => !item.evidence.some(evidence => evidence.role === 'support'))
    || baseline.items.some(item => item.evidence.some(evidence =>
      evidence.sourceRevisionId !== baseline.sourceRevisionId
      || sha256Utf8(evidence.quote) !== evidence.quoteHash))) failPrd('invalid-evidence')
}

export class DeterministicPrdRenderer implements PrdRenderer {
  constructor(private readonly sha256Utf8: (value: string) => Sha256Hex) {}

  render(input: CurrentBaselineInput): PrdRevision {
    validateBaseline(input.baseline, this.sha256Utf8)
    if (input.existingPrdCount !== undefined
      && (!Number.isSafeInteger(input.existingPrdCount)
        || input.existingPrdCount < 0
        || input.existingPrdCount >= MAX_PRD_REVISIONS_PER_PROJECT)) failPrd('limit-exceeded')
    if ((input.currentBaselineId !== undefined && input.currentBaselineId !== input.baseline.id)
      || (input.currentContentVersion !== undefined
        && input.currentContentVersion !== input.baseline.contentVersion)) failPrd('baseline-stale')

    const markdown = renderPmwbPrdV1(input.baseline)
    if (utf8ByteLength(markdown) > MAX_PRD_MARKDOWN_UTF8_BYTES) failPrd('limit-exceeded')
    const revision: PrdRevision = {
      id: input.prdRevisionId,
      projectId: input.baseline.projectId,
      sourceRevisionId: input.baseline.sourceRevisionId,
      baselineId: input.baseline.id,
      baselineContentVersion: input.baseline.contentVersion,
      rendererVersion: PRD_RENDERER_VERSION,
      contentHash: this.sha256Utf8(markdown),
      markdown,
      createdAt: input.createdAt,
    }
    if (!prdRevisionSchema.safeParse(revision).success) failPrd()
    return deepFreeze(structuredClone(revision))
  }
}

export function isPrdCurrent(project: ActiveProjectRecord, prd: PrdRevision): boolean {
  if (project.currentBaselineId !== prd.baselineId) return false
  const baselines = project.baselines.filter(item => item.id === project.currentBaselineId)
  const baseline = baselines[0]
  return baselines.length === 1
    && baseline !== undefined
    && baseline.contentVersion === project.header.contentVersion
    && prd.baselineContentVersion === baseline.contentVersion
    && prd.projectId === project.header.id
    && prd.sourceRevisionId === baseline.sourceRevisionId
}
