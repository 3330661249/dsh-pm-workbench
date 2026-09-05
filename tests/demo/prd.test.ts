import { describe, expect, it } from 'vitest'

import { createDemoCards, SYNTHETIC_INTERVIEW_TEXT } from '../../packages/workbench/src/demo/domain/fixture-provider.js'
import { validatePastedText } from '../../packages/workbench/src/demo/domain/material.js'
import { renderDemoPrd, safePrdBaseName, utf8NoBom } from '../../packages/workbench/src/demo/domain/prd.js'
import { applyManualEdit } from '../../packages/workbench/src/demo/domain/requirements.js'
import type { CitedRequirement } from '../../packages/workbench/src/demo/domain/types.js'

function fixture() {
  const materialResult = validatePastedText(SYNTHETIC_INTERVIEW_TEXT)
  if (!materialResult.ok) throw new Error(materialResult.error.message)
  const cardsResult = createDemoCards(materialResult.value)
  if (!cardsResult.ok) throw new Error(cardsResult.error.message)
  const [citedCard, deferredCited, inferredCard] = cardsResult.value
  if (citedCard.kind !== 'cited' || deferredCited.kind !== 'cited' || inferredCard.kind !== 'inference') {
    throw new Error('fixture card kinds changed')
  }
  const includedResult = applyManualEdit(materialResult.value, citedCard, {
    decision: 'include', priority: 'high', humanReason: '先解决追溯。',
  })
  if (!includedResult.ok || includedResult.value.kind !== 'cited') throw new Error('fixture inclusion failed')
  return { material: materialResult.value, includedCited: includedResult.value, deferredCited, inferredCard }
}

describe('deterministic Demo PRD artifacts', () => {
  it('renders the cited human-included requirements as UTF-8 without a BOM', () => {
    const { material, includedCited, deferredCited, inferredCard } = fixture()
    const artifact = renderDemoPrd({
      projectTitle: '访谈 / 需求', material, cards: [includedCited, deferredCited, inferredCard],
    })

    expect(artifact.ok).toBe(true)
    if (!artifact.ok) return
    expect(artifact.value.filename).toBe('访谈-需求-prd.md')
    expect(artifact.value.markdown).toContain('## 功能需求和优先级')
    expect(artifact.value.markdown).toContain(includedCited.id)
    expect(artifact.value.markdown).not.toContain(deferredCited.id)
    expect(artifact.value.markdown).not.toContain(inferredCard.id)
    expect(artifact.value.markdown).toContain('待产品经理补充')
    expect(artifact.value.markdown).toContain(material.displayName)
    expect(artifact.value.markdown).toContain(`> ${includedCited.citations[0].text}`)
    expect(artifact.value.markdown).toContain(`[${includedCited.citations[0].start}, ${includedCited.citations[0].end})`)
    expect(artifact.value.markdown).toContain('人工优先级：high')
    expect(artifact.value.markdown).toContain('人工理由：先解决追溯。')
    expect(new TextDecoder().decode(artifact.value.bytes)).toBe(artifact.value.markdown)
    expect(Array.from(artifact.value.bytes.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf])
    expect(artifact.value.markdown.trimEnd()).toMatch(/演示说明[\s\S]*本地确定性 Demo/)

    const headings = [...artifact.value.markdown.matchAll(/^## (.+)$/gm)].map((match) => match[1])
    expect(headings).toEqual([
      '背景与问题', '目标用户', '用户痛点及访谈依据', '本期目标', '功能需求和优先级',
      '非本期范围', '成功指标', '风险与待确认问题', '演示说明',
    ])
  })

  it('returns no-included-requirements before rendering an empty export', () => {
    const { material, deferredCited, inferredCard } = fixture()
    expect(renderDemoPrd({ projectTitle: '访谈', material, cards: [deferredCited, inferredCard] })).toMatchObject({
      ok: false, error: { code: 'no-included-requirements' },
    })
  })

  it('uses a bounded path-safe Unicode base name and exact TextEncoder output', () => {
    expect(safePrdBaseName('../../')).toBe('pm-workbench')
    expect(safePrdBaseName('   ')).toBe('pm-workbench')
    expect(safePrdBaseName('!?，。')).toBe('pm-workbench')
    expect(safePrdBaseName('a/b\\c: d...__--e')).toBe('a-b-c-d-e')
    expect(safePrdBaseName('甲'.repeat(79) + '😀x')).toBe('甲'.repeat(79))
    expect(utf8NoBom('甲')).toEqual(new TextEncoder().encode('甲'))
  })

  it('revalidates every card against the material before filtering included cards', () => {
    const { material, includedCited, deferredCited } = fixture()
    const staleQuote = { ...includedCited, citations: [{ ...includedCited.citations[0], text: '不存在的原话' }] } as unknown as CitedRequirement
    const staleInterval = { ...includedCited, citations: [{ ...includedCited.citations[0], end: includedCited.citations[0].end - 1 }] } as CitedRequirement
    const invalidExcluded = (decision: 'defer' | 'reject') => ({
      ...deferredCited,
      decision,
      citations: [{ ...deferredCited.citations[0], text: '已失效的引用' }],
    }) as unknown as CitedRequirement

    expect(renderDemoPrd({ projectTitle: '访谈', material, cards: [staleQuote] })).toMatchObject({ ok: false, error: { code: 'invalid-citation' } })
    expect(renderDemoPrd({ projectTitle: '访谈', material, cards: [staleInterval] })).toMatchObject({ ok: false, error: { code: 'invalid-citation' } })
    expect(renderDemoPrd({ projectTitle: '访谈', material, cards: [includedCited, invalidExcluded('defer')] })).toMatchObject({ ok: false, error: { code: 'invalid-citation' } })
    expect(renderDemoPrd({ projectTitle: '访谈', material, cards: [includedCited, invalidExcluded('reject')] })).toMatchObject({ ok: false, error: { code: 'invalid-citation' } })
  })

  it('preserves LF and CRLF source lines in blockquotes, including empty lines', () => {
    const { includedCited } = fixture()
    const quote = '第一行\r\n\r\n第二行\n第三行'
    const material = { text: quote, displayName: '多行访谈.txt', format: 'text/plain' as const }
    const multiline = {
      ...includedCited,
      citations: [{ start: 0, end: quote.length, text: quote }],
    } as CitedRequirement

    const artifact = renderDemoPrd({ projectTitle: '访谈', material, cards: [multiline] })
    expect(artifact.ok).toBe(true)
    if (!artifact.ok) return
    expect(artifact.value.markdown).toContain('> 第一行\r\n> \r\n> 第二行\n> 第三行')
    expect(artifact.value.markdown).toContain(`[0, ${quote.length})`)
  })

  it('escapes only an initial ordered-list marker in quoted source evidence', () => {
    const { includedCited } = fixture()
    const material = { text: '01. 原话里的编号需要保留。', displayName: '编号访谈.txt', format: 'text/plain' as const }
    const quote = '01. 原话里的编号需要保留'
    const numbered = { ...includedCited, citations: [{ start: 0, end: quote.length, text: quote }] } as CitedRequirement

    const first = renderDemoPrd({ projectTitle: '访谈', material, cards: [numbered] })
    const second = renderDemoPrd({ projectTitle: '访谈', material, cards: [numbered] })
    expect(first.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first).toEqual(second)
    expect(first.value.markdown).toContain('> 01\\. 原话里的编号需要保留')
    expect(first.value.markdown).toContain('[0, 14)')
    expect(new TextDecoder().decode(first.value.bytes)).toBe(first.value.markdown)
  })

  it('sorts included cards by citation coordinates and then direct id comparison', () => {
    const { material, includedCited } = fixture()
    const later = { ...includedCited, id: 'z-card', title: '后面的卡', citations: [{ ...includedCited.citations[0], start: 34, end: 56, text: '我希望能先看到需求对应的原文，再决定是否纳入' }] } as CitedRequirement
    const firstZ = { ...includedCited, id: 'z-tie', title: '同坐标 Z' }
    const firstA = { ...includedCited, id: 'a-tie', title: '同坐标 A' }

    const artifact = renderDemoPrd({ projectTitle: '访谈', material, cards: [later, firstZ, firstA] })
    expect(artifact.ok).toBe(true)
    if (!artifact.ok) return
    expect(artifact.value.markdown.indexOf('a-tie')).toBeLessThan(artifact.value.markdown.indexOf('z-tie'))
    expect(artifact.value.markdown.indexOf('z-tie')).toBeLessThan(artifact.value.markdown.indexOf('z-card'))
  })

  it('produces identical artifacts and escapes user-authored Markdown and HTML', () => {
    const { material, includedCited } = fixture()
    const edit = { ...includedCited, title: '# 标题 <script>', painPoint: '- 痛点', description: '<b>描述</b>' }
    const first = renderDemoPrd({ projectTitle: '访谈', material, cards: [edit] })
    const second = renderDemoPrd({ projectTitle: '访谈', material, cards: [edit] })
    expect(first).toEqual(second)
    if (!first.ok) return
    expect(first.value.markdown).toContain('\\# 标题 &lt;script&gt;')
    expect(first.value.markdown).toContain('\\- 痛点')
    expect(first.value.markdown).toContain('&lt;b&gt;描述&lt;/b&gt;')
  })
})
