import { describe, expect, it } from 'vitest'

import { validatePastedText } from '../../packages/workbench/src/demo/domain/material.js'
import {
  assertCardIntegrity,
  createDemoCards,
  SYNTHETIC_INTERVIEW_TEXT,
} from '../../packages/workbench/src/demo/domain/fixture-provider.js'
import type { RequirementCard } from '../../packages/workbench/src/demo/domain/types.js'

describe('deterministic Demo cards', () => {
  it('creates cited cards and one clearly bounded inference card from entered material', () => {
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
    expect(cards.value[0].citations).toEqual([
      { start: 4, end: 28, text: '每次整理访谈都要在多个文档里找原话，常常花半小时' },
    ])
    expect(cards.value[1].citations).toEqual([
      { start: 34, end: 56, text: '我希望能先看到需求对应的原文，再决定是否纳入' },
    ])

    for (const card of cards.value) {
      expect(assertCardIntegrity(material.value, card).ok).toBe(true)
      if (card.kind === 'cited') {
        for (const citation of card.citations) {
          expect(material.value.text.slice(citation.start, citation.end)).toBe(citation.text)
        }
      }
    }
  })

  it('rejects malformed citations and an inference marked for inclusion', () => {
    const material = validatePastedText(SYNTHETIC_INTERVIEW_TEXT)
    expect(material.ok).toBe(true)
    if (!material.ok) return
    const cards = createDemoCards(material.value)
    expect(cards.ok).toBe(true)
    if (!cards.ok) return

    const cited = cards.value[0]
    const inference = cards.value[2]
    if (cited.kind !== 'cited' || inference.kind !== 'inference') return

    expect(assertCardIntegrity(material.value, {
      ...cited,
      citations: [{ ...cited.citations[0], text: '改写后的原话' }],
    })).toMatchObject({ ok: false, error: { code: 'invalid-citation' } })
    expect(assertCardIntegrity(material.value, {
      ...cited,
      citations: [{ ...cited.citations[0], end: cited.citations[0].start }],
    })).toMatchObject({ ok: false, error: { code: 'invalid-citation' } })
    expect(assertCardIntegrity(material.value, {
      ...cited,
      citations: [{ ...cited.citations[0], end: material.value.text.length + 1 }],
    })).toMatchObject({ ok: false, error: { code: 'invalid-citation' } })
    expect(assertCardIntegrity(material.value, {
      ...cited,
      citations: [],
    } as unknown as RequirementCard)).toMatchObject({ ok: false, error: { code: 'invalid-card-shape' } })
    expect(assertCardIntegrity(material.value, {
      ...inference,
      citations: [cited.citations[0]],
    } as unknown as RequirementCard)).toMatchObject({ ok: false, error: { code: 'invalid-card-shape' } })
    expect(assertCardIntegrity(material.value, {
      ...inference,
      decision: 'include',
    })).toMatchObject({ ok: false, error: { code: 'inference-cannot-be-included' } })
  })
})
