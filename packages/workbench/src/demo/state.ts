import { assertCardIntegrity } from './domain/fixture-provider.js'
import type { ManualRequirementEdit } from './domain/requirements.js'
import { applyManualEdit, eligibleRequirements } from './domain/requirements.js'
import type { Material, RequirementCard } from './domain/types.js'
import type { PrdArtifact } from './domain/prd.js'

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

export const initialDemoState: DemoState = {
  step: 'material',
  projectTitle: 'PM Workbench 演示',
  cards: [],
  notice: '请先提供访谈材料。',
}

export function canEnterStep(
  state: DemoState,
  step: DemoStep,
): { allowed: true } | { allowed: false; reason: string } {
  if (step === 'material') return { allowed: true }
  if (step === 'requirements') {
    return state.material && state.cards.length > 0
      ? { allowed: true }
      : { allowed: false, reason: '请先提供材料并完成需求分析。' }
  }
  return state.cards.length > 0
    ? { allowed: true }
    : { allowed: false, reason: '请先完成需求分析。' }
}

function failed(state: DemoState, error: string): DemoState {
  return { ...state, error }
}

function cardChanged(before: RequirementCard, after: RequirementCard): boolean {
  return before.title !== after.title ||
    before.description !== after.description ||
    before.painPoint !== after.painPoint ||
    before.priority !== after.priority ||
    before.decision !== after.decision ||
    before.humanReason !== after.humanReason
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  switch (action.type) {
    case 'projectTitleChanged':
      if (action.value === state.projectTitle) return state
      return {
        ...state,
        projectTitle: action.value,
        prd: undefined,
        notice: '项目名称已更新，PRD 预览已失效。',
        error: undefined,
      }

    case 'materialAccepted':
      return {
        ...state,
        step: 'material',
        material: action.material,
        cards: [],
        prd: undefined,
        notice: '材料已接收，请运行本地演示分析。',
        error: undefined,
      }

    case 'analysisAccepted': {
      if (!state.material) return failed(state, '需要先提供材料。')
      for (const card of action.cards) {
        const integrity = assertCardIntegrity(state.material, card)
        if (!integrity.ok) return failed(state, integrity.error.message)
      }
      return {
        ...state,
        step: action.cards.length > 0 ? 'requirements' : 'material',
        cards: [...action.cards],
        prd: undefined,
        notice: '需求分析结果已接收，请由产品经理逐条决定。',
        error: undefined,
      }
    }

    case 'requirementEdited': {
      if (!state.material) return failed(state, '需要先提供材料。')
      const index = state.cards.findIndex((card) => card.id === action.id)
      if (index < 0) return failed(state, '未找到要编辑的需求卡片。')
      const result = applyManualEdit(state.material, state.cards[index], action.edit)
      if (!result.ok) {
        const error = result.error.code === 'inference-cannot-be-included'
          ? '只有带原文引用的需求才能纳入本次 PRD。'
          : result.error.message
        return failed(state, error)
      }
      if (!cardChanged(state.cards[index], result.value)) return state
      const cards = state.cards.map((card, cardIndex) => cardIndex === index ? result.value : card)
      return {
        ...state,
        cards,
        prd: undefined,
        notice: '需求卡片已更新，PRD 预览已失效。',
        error: undefined,
      }
    }

    case 'stepRequested': {
      const entry = canEnterStep(state, action.step)
      if (!entry.allowed) return failed(state, entry.reason)
      return { ...state, step: action.step, notice: '已切换演示步骤。', error: undefined }
    }

    case 'prdGenerated':
      if (eligibleRequirements(state.cards).length === 0) return failed(state, '至少需要一条已纳入的需求。')
      return {
        ...state,
        step: 'prd',
        prd: action.artifact,
        notice: 'PRD 预览已生成。',
        error: undefined,
      }

    case 'operationFailed':
      return { ...state, notice: '操作失败。', error: action.message }

    case 'errorCleared':
      return { ...state, error: undefined }

    case 'reset':
      return initialDemoState
  }
}
