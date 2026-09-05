import { describe, expect, it } from 'vitest'

import { assertCardIntegrity, createDemoCards, SYNTHETIC_INTERVIEW_TEXT } from '../../packages/workbench/src/demo/domain/fixture-provider.js'
import { validatePastedText } from '../../packages/workbench/src/demo/domain/material.js'
import { applyManualEdit, eligibleRequirements, type ManualRequirementEdit } from '../../packages/workbench/src/demo/domain/requirements.js'

function fixture() {
  const materialResult = validatePastedText(SYNTHETIC_INTERVIEW_TEXT)
  if (!materialResult.ok) throw new Error(materialResult.error.message)
  const cardsResult = createDemoCards(materialResult.value)
  if (!cardsResult.ok) throw new Error(cardsResult.error.message)
  const [citedCard, deferredCited, inferredCard] = cardsResult.value
  if (citedCard.kind !== 'cited' || deferredCited.kind !== 'cited' || inferredCard.kind !== 'inference') {
    throw new Error('fixture card kinds changed')
  }
  return { material: materialResult.value, citedCard, deferredCited, inferredCard }
}

describe('human requirement decisions', () => {
  it('returns a new cited card with only effective human edits', () => {
    const { material, citedCard } = fixture()
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
    if (!included.ok) return
    expect(included.value).not.toBe(citedCard)
    expect(citedCard).toMatchObject({
      title: '访谈需求候选 1', priority: 'high', decision: 'pending', humanReason: '', manuallyEdited: false,
    })
    expect(assertCardIntegrity(material, included.value).ok).toBe(true)
  })

  it('rejects an attempt to include an inference without returning a partial card', () => {
    const { material, inferredCard } = fixture()

    expect(applyManualEdit(material, inferredCard, { decision: 'include' })).toMatchObject({
      ok: false,
      error: { code: 'inference-cannot-be-included' },
    })
    expect(inferredCard.decision).toBe('defer')
  })

  it('allows inference cards to remain pending, deferred, or rejected', () => {
    const { material, inferredCard } = fixture()
    const pending = applyManualEdit(material, inferredCard, { decision: 'pending' })
    const rejected = applyManualEdit(material, inferredCard, { decision: 'reject' })

    expect(pending).toMatchObject({ ok: true, value: { decision: 'pending', manuallyEdited: true } })
    expect(rejected).toMatchObject({ ok: true, value: { decision: 'reject', manuallyEdited: true } })
  })

  it('does not permit protected card fields to be patched', () => {
    const { material, citedCard } = fixture()
    const protectedEdit = {
      id: 'replaced',
      citations: [],
      fixtureLabel: 'other',
      demoReason: 'changed',
      suggestedPriority: 'low',
    } as unknown as ManualRequirementEdit

    const result = applyManualEdit(material, citedCard, protectedEdit)
    expect(result).toMatchObject({ ok: true, value: { id: citedCard.id, citations: citedCard.citations, fixtureLabel: '演示生成', demoReason: citedCard.demoReason, suggestedPriority: citedCard.suggestedPriority, manuallyEdited: false } })
  })

  it('returns only cited included cards in their original input order', () => {
    const { material, citedCard, deferredCited, inferredCard } = fixture()
    const first = applyManualEdit(material, citedCard, { decision: 'include' })
    const second = applyManualEdit(material, deferredCited, { decision: 'include' })
    if (!first.ok || !second.ok) throw new Error('fixture inclusion failed')

    expect(eligibleRequirements([inferredCard, second.value, deferredCited, first.value])).toEqual([second.value, first.value])
  })
})
