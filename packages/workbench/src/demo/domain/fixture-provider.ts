import type {
  Citation,
  DomainResult,
  InferenceRequirement,
  Material,
  RequirementCard,
} from './types.js'

export const SYNTHETIC_INTERVIEW_TEXT =
  '受访者：每次整理访谈都要在多个文档里找原话，常常花半小时。\n' +
  '受访者：我希望能先看到需求对应的原文，再决定是否纳入。\n'

const invalidCitation = <T>(): DomainResult<T> => ({
  ok: false,
  error: { code: 'invalid-citation', message: '引用位置无效。' },
})

const invalidCardShape = <T>(): DomainResult<T> => ({
  ok: false,
  error: { code: 'invalid-card-shape', message: '需求卡片结构无效。' },
})

const inferenceCannotBeIncluded = <T>(): DomainResult<T> => ({
  ok: false,
  error: { code: 'inference-cannot-be-included', message: '无引用推断不能纳入。' },
})

function trimSpan(text: string, start: number, end: number): readonly [number, number] {
  while (start < end && /\s/u.test(text[start])) start += 1
  while (end > start && /\s/u.test(text[end - 1])) end -= 1
  return [start, end]
}

function trimEnd(text: string, start: number, end: number): number {
  while (end > start && /\s/u.test(text[end - 1])) end -= 1
  return end
}

function citationSpans(text: string): readonly Citation[] {
  const citations: Citation[] = []
  let lineStart = 0
  let index = 0

  while (index <= text.length && citations.length < 2) {
    const isEnd = index === text.length
    const isLineBreak = text[index] === '\r' || text[index] === '\n'
    if (!isEnd && !isLineBreak) {
      index += 1
      continue
    }

    let [start, end] = trimSpan(text, lineStart, index)
    if (start < end) {
      if (text.slice(start, end).startsWith('受访者：')) {
        start += '受访者：'.length
        ;[start, end] = trimSpan(text, start, end)
      }
      if ('。！？!?'.includes(text[end - 1] ?? '')) end -= 1
      end = trimEnd(text, start, end)
      if (start < end) citations.push({ start, end, text: text.slice(start, end) })
    }

    if (isEnd) break
    if (text[index] === '\r' && text[index + 1] === '\n') index += 1
    index += 1
    lineStart = index
  }

  return citations
}

export function assertCardIntegrity(material: Material, card: RequirementCard): DomainResult<RequirementCard> {
  if (card.kind === 'cited') {
    if (card.citations.length === 0) return invalidCardShape()
    for (const citation of card.citations) {
      if (
        !Number.isInteger(citation.start) ||
        !Number.isInteger(citation.end) ||
        citation.start < 0 ||
        citation.start >= citation.end ||
        citation.end > material.text.length ||
        material.text.slice(citation.start, citation.end) !== citation.text
      ) {
        return invalidCitation()
      }
    }
    return { ok: true, value: card }
  }

  if (card.citations.length !== 0) return invalidCardShape()
  if (card.decision === 'include') return inferenceCannotBeIncluded()
  return { ok: true, value: card }
}

export function createDemoCards(material: Material): DomainResult<readonly RequirementCard[]> {
  const citations = citationSpans(material.text)
  if (citations.length === 0) return invalidCitation()

  const citedCards = citations.map((citation, index): RequirementCard => {
    const number = index + 1
    const priority = number === 1 ? 'high' : 'medium'
    return {
      id: `demo-cited-${number}`,
      fixtureLabel: '演示生成',
      kind: 'cited',
      title: `访谈需求候选 ${number}`,
      painPoint: '这段原话反映了需要进一步判断的工作痛点。',
      description: `基于第 ${number} 段原文生成的演示候选需求，等待产品经理编辑。`,
      demoReason: `本地演示规则按原文顺序提取了第 ${number} 段非空内容。`,
      suggestedPriority: priority,
      priority,
      decision: 'pending',
      humanReason: '',
      manuallyEdited: false,
      citations: [citation],
    }
  })

  const inference: InferenceRequirement = {
    id: 'demo-inferred-1',
    fixtureLabel: '演示生成',
    kind: 'inference',
    title: '补充访谈覆盖范围',
    painPoint: '当前材料可能仍有未覆盖的场景。',
    description: '这是没有原文引用的演示推断，不能纳入本次 PRD。',
    demoReason: '本地演示规则固定加入一张无引用卡，用于演示边界。',
    suggestedPriority: 'low',
    priority: 'low',
    decision: 'defer',
    humanReason: '',
    manuallyEdited: false,
    citations: [],
  }

  return { ok: true, value: [...citedCards, inference] }
}
