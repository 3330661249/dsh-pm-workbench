import type { DemoState, DemoStep } from '../state.js'

const steps: readonly { id: DemoStep; label: string; hint: string }[] = [
  { id: 'material', label: '材料', hint: '从访谈开始' },
  { id: 'requirements', label: '需求', hint: '回到原文判断' },
  { id: 'priority', label: '优先级', hint: '由你决定取舍' },
  { id: 'prd', label: 'PRD', hint: '形成可追溯草稿' },
]

export function StepNavigation({ state, onStep }: {
  state: DemoState
  onStep: (step: DemoStep) => void
}) {
  return <nav className="step-navigation" aria-label="工作流程">
    <ol>{steps.map((step, index) => <li key={step.id}>
      <button type="button" data-step={step.id} aria-current={state.step === step.id ? 'step' : undefined}
        disabled={step.id !== 'material' && (state.cards.length === 0 || (step.id === 'requirements' && !state.material))}
        onClick={() => onStep(step.id)}>
        <span className="step-number" aria-hidden="true">0{index + 1}</span>
        <span><strong>{step.label}</strong><small>{step.hint}</small></span>
      </button>
    </li>)}</ol>
  </nav>
}
