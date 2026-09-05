import { assertCardIntegrity } from './fixture-provider.js'
import type { CitedRequirement, DomainResult, Material, RequirementCard } from './types.js'

export interface PrdArtifact {
  readonly filename: string
  readonly markdown: string
  readonly bytes: Uint8Array<ArrayBuffer>
}

function trimSeparators(value: string): string {
  return value.replace(/^[._-]+|[._-]+$/g, '')
}

export function safePrdBaseName(projectTitle: string): string {
  const normalized = trimSeparators(
    projectTitle
      .replace(/[^\p{L}\p{N}._-]+/gu, '-')
      .replace(/[._-]{2,}/g, '-'),
  )
  if (normalized.length === 0) return 'pm-workbench'

  let bounded = normalized.slice(0, 80)
  const finalUnit = bounded.charCodeAt(bounded.length - 1)
  if (finalUnit >= 0xd800 && finalUnit <= 0xdbff) bounded = bounded.slice(0, -1)
  return trimSeparators(bounded) || 'pm-workbench'
}

export function utf8NoBom(markdown: string): Uint8Array<ArrayBuffer> {
  return new TextEncoder().encode(markdown)
}

function escapeMarkdownLine(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/[\\`*_{}[\]()#+!|\-]/g, '\\$&')
    .replace(/^([ ]{0,3})(\d{1,9})\.(?=[\t\v\f ]|$)/, '$1$2\\.')
}

function escapeMarkdown(value: string): string {
  return escapeMarkdownLine(value)
    .replace(/[\r\n]+/g, ' ')
}

function renderQuote(text: string): string {
  return text
    .split(/(\r\n|\r|\n)/)
    .map((part, index) => index % 2 === 0 ? `> ${escapeMarkdownLine(part)}` : part)
    .join('')
}

function compareRequirements(left: CitedRequirement, right: CitedRequirement): number {
  const leftCitation = left.citations[0]
  const rightCitation = right.citations[0]
  if (leftCitation.start !== rightCitation.start) return leftCitation.start - rightCitation.start
  if (leftCitation.end !== rightCitation.end) return leftCitation.end - rightCitation.end
  if (left.id < right.id) return -1
  if (left.id > right.id) return 1
  return 0
}

function renderRequirement(card: CitedRequirement): string {
  const citations = card.citations.flatMap((citation) => [
    renderQuote(citation.text),
    `> 位置：[${citation.start}, ${citation.end})`,
  ])
  return [
    `### [${card.id}] ${escapeMarkdown(card.title)}`,
    `- 用户痛点：${escapeMarkdown(card.painPoint)}`,
    `- 需求描述：${escapeMarkdown(card.description)}`,
    `- 人工优先级：${card.priority}`,
    `- 人工理由：${escapeMarkdown(card.humanReason || '待产品经理补充')}`,
    '- 访谈依据：',
    ...citations,
  ].join('\n')
}

function noIncludedRequirements<T>(): DomainResult<T> {
  return { ok: false, error: { code: 'no-included-requirements', message: '至少需要一条已纳入的需求。' } }
}

export function renderDemoPrd(input: {
  readonly projectTitle: string
  readonly material: Material
  readonly cards: readonly RequirementCard[]
}): DomainResult<PrdArtifact> {
  for (const card of input.cards) {
    const integrity = assertCardIntegrity(input.material, card)
    if (!integrity.ok) return integrity
  }

  const included = input.cards
    .filter((card): card is CitedRequirement => card.kind === 'cited' && card.decision === 'include')
    .slice()
    .sort(compareRequirements)
  if (included.length === 0) return noIncludedRequirements()

  const materialName = escapeMarkdown(input.material.displayName)
  const markdown = [
    '## 背景与问题',
    `- 访谈材料：${materialName}`,
    '- 本演示只保留产品经理明确纳入、且可回溯原文的需求。',
    '',
    '## 目标用户',
    '待产品经理补充。',
    '',
    '## 用户痛点及访谈依据',
    `材料来源：${materialName}`,
    '',
    ...included.map(renderRequirement),
    '',
    '## 本期目标',
    '待产品经理补充。',
    '',
    '## 功能需求和优先级',
    ...included.map((card) => `- [${card.id}] ${escapeMarkdown(card.title)}（${card.priority}）`),
    '',
    '## 非本期范围',
    '- 无引用推断不会纳入本次 PRD。',
    '',
    '## 成功指标',
    '待产品经理补充。',
    '',
    '## 风险与待确认问题',
    '- 访谈材料的覆盖范围和上线验证标准待产品经理补充。',
    '',
    '## 演示说明',
    '本地确定性 Demo：本产物仅用于演示需求取舍与原文追溯，不代表正式 PRD、上线结论或用户事实。',
    '',
  ].join('\n')
  const bytes = utf8NoBom(markdown)
  return { ok: true, value: { filename: `${safePrdBaseName(input.projectTitle)}-prd.md`, markdown, bytes } }
}
