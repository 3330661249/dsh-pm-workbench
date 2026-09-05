import { describe, expect, it } from 'vitest'

import { createDemoCards, SYNTHETIC_INTERVIEW_TEXT } from '../../packages/workbench/src/demo/domain/fixture-provider.js'
import { validatePastedText } from '../../packages/workbench/src/demo/domain/material.js'
import { renderDemoPrd } from '../../packages/workbench/src/demo/domain/prd.js'
import { canEnterStep, demoReducer, initialDemoState } from '../../packages/workbench/src/demo/state.js'

function fixture() {
  const materialResult = validatePastedText(SYNTHETIC_INTERVIEW_TEXT)
  if (!materialResult.ok) throw new Error(materialResult.error.message)
  const cardsResult = createDemoCards(materialResult.value)
  if (!cardsResult.ok) throw new Error(cardsResult.error.message)
  return { material: materialResult.value, cards: cardsResult.value }
}

function analysedState() {
  const { material, cards } = fixture()
  return demoReducer(
    demoReducer(initialDemoState, { type: 'materialAccepted', material }),
    { type: 'analysisAccepted', cards },
  )
}

function includedState() {
  const state = analysedState()
  return demoReducer(state, { type: 'requirementEdited', id: 'demo-cited-1', edit: { decision: 'include', humanReason: '有明确原文。' } })
}

describe('closed Demo state machine', () => {
  it('gates steps until accepted material has been analysed', () => {
    const { material, cards } = fixture()
    expect(canEnterStep(initialDemoState, 'requirements')).toMatchObject({ allowed: false })
    const withMaterial = demoReducer(initialDemoState, { type: 'materialAccepted', material })
    expect(canEnterStep(withMaterial, 'requirements')).toMatchObject({ allowed: false })
    const analysed = demoReducer(withMaterial, { type: 'analysisAccepted', cards })
    expect(canEnterStep(analysed, 'priority')).toEqual({ allowed: true })
    expect(canEnterStep(analysed, 'prd')).toEqual({ allowed: true })
    expect(demoReducer(analysed, { type: 'stepRequested', step: 'priority' }).step).toBe('priority')
  })

  it('rejects inference inclusion and keeps accepted cards unchanged', () => {
    const analysed = analysedState()
    const refused = demoReducer(analysed, {
      type: 'requirementEdited', id: 'demo-inferred-1', edit: { decision: 'include' },
    })

    expect(refused.error).toBe('只有带原文引用的需求才能纳入本次 PRD。')
    expect(refused.cards.find((card) => card.id === 'demo-inferred-1')?.decision).toBe('defer')
    expect(refused.prd).toBe(analysed.prd)
  })

  it('applies each editable card field and clears stale PRD after an effective edit', () => {
    const { material } = fixture()
    const included = includedState()
    const artifact = renderDemoPrd({ projectTitle: included.projectTitle, material, cards: included.cards })
    if (!artifact.ok) throw new Error(artifact.error.message)
    const withPreview = demoReducer(included, { type: 'prdGenerated', artifact: artifact.value })
    const edited = demoReducer(withPreview, {
      type: 'requirementEdited',
      id: 'demo-cited-1',
      edit: { title: '改名', painPoint: '新痛点', description: '新描述', priority: 'low', decision: 'defer', humanReason: '调整范围。' },
    })

    expect(edited.cards.find((card) => card.id === 'demo-cited-1')).toMatchObject({
      title: '改名', painPoint: '新痛点', description: '新描述', priority: 'low', decision: 'defer', humanReason: '调整范围。', manuallyEdited: true,
    })
    expect(edited.prd).toBeUndefined()
  })

  it('keeps a stale preview for an identical card edit because no card value changed', () => {
    const { material } = fixture()
    const included = includedState()
    const artifact = renderDemoPrd({ projectTitle: included.projectTitle, material, cards: included.cards })
    if (!artifact.ok) throw new Error(artifact.error.message)
    const withPreview = demoReducer(included, { type: 'prdGenerated', artifact: artifact.value })

    const unchanged = demoReducer(withPreview, {
      type: 'requirementEdited', id: 'demo-cited-1', edit: { decision: 'include', humanReason: '有明确原文。' },
    })
    expect(unchanged.prd).toEqual(artifact.value)
  })

  it('clears stale PRD for effective project-title and material changes but not an identical title', () => {
    const { material, cards } = fixture()
    const included = includedState()
    const artifact = renderDemoPrd({ projectTitle: included.projectTitle, material, cards: included.cards })
    if (!artifact.ok) throw new Error(artifact.error.message)
    const withPreview = demoReducer(included, { type: 'prdGenerated', artifact: artifact.value })

    const sameTitle = demoReducer(withPreview, { type: 'projectTitleChanged', value: withPreview.projectTitle })
    expect(sameTitle.prd).toEqual(artifact.value)
    const renamed = demoReducer(withPreview, { type: 'projectTitleChanged', value: '新的项目名称' })
    expect(renamed.prd).toBeUndefined()
    const replaced = demoReducer(withPreview, { type: 'materialAccepted', material: { ...material, text: '另一份材料' } })
    expect(replaced).toMatchObject({ material: { text: '另一份材料' }, cards: [] })
    expect(replaced.prd).toBeUndefined()
    expect(demoReducer(demoReducer(initialDemoState, { type: 'materialAccepted', material }), { type: 'analysisAccepted', cards }).cards).toHaveLength(3)
  })

  it('keeps the PRD step reachable with no included cards and only generates after inclusion', () => {
    const analysed = analysedState()
    expect(canEnterStep(analysed, 'prd')).toEqual({ allowed: true })
    const unavailable = demoReducer(analysed, {
      type: 'prdGenerated', artifact: { filename: 'invalid.md', markdown: 'invalid', bytes: new Uint8Array() },
    })
    expect(unavailable.prd).toBeUndefined()
    expect(unavailable.error).toBe('至少需要一条已纳入的需求。')

    const included = includedState()
    const { material } = fixture()
    const artifact = renderDemoPrd({ projectTitle: included.projectTitle, material, cards: included.cards })
    if (!artifact.ok) throw new Error(artifact.error.message)
    expect(demoReducer(included, { type: 'prdGenerated', artifact: artifact.value }).prd).toEqual(artifact.value)
  })

  it('retains a concrete operation failure until cleared without dropping accepted values', () => {
    const analysed = analysedState()
    const failed = demoReducer(analysed, { type: 'operationFailed', message: '读取文件失败：编码无效。' })
    expect(failed).toMatchObject({ error: '读取文件失败：编码无效。', material: analysed.material, cards: analysed.cards })
    expect(demoReducer(failed, { type: 'errorCleared' }).error).toBeUndefined()
  })
})
