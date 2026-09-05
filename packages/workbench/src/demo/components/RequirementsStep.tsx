import type { ManualRequirementEdit } from '../domain/requirements.js'
import type { DemoState } from '../state.js'
import { RequirementEditor } from './RequirementEditor.js'

export function RequirementsStep({ state, onEdit, onContinue }: {
  state: DemoState
  onEdit: (id: string, edit: ManualRequirementEdit) => void
  onContinue: () => void
}) {
  return <section aria-labelledby="requirements-heading">
    <div className="section-heading"><div><p className="eyebrow">02 / 需求</p><h2 id="requirements-heading">先看原话，再完善需求。</h2>
      <p className="muted">共 {state.cards.length} 张演示卡片。你可以编辑描述，原文引用保持只读。</p></div></div>
    <div className="cards-grid">{state.cards.map((card) => <RequirementEditor key={card.id} card={card} onEdit={onEdit} />)}</div>
    <div className="step-footer"><p className="muted">下一步，由你选择优先级与本期范围。</p><button type="button" className="primary" onClick={onContinue}>前往优先级</button></div>
  </section>
}
