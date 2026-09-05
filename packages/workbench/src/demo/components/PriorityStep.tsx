import { eligibleRequirements, type ManualRequirementEdit } from '../domain/requirements.js'
import type { Decision, Priority } from '../domain/types.js'
import type { DemoState } from '../state.js'
import { CardEvidence } from './RequirementEditor.js'

const priorities: readonly { value: Priority; label: string }[] = [{ value: 'high', label: '高' }, { value: 'medium', label: '中' }, { value: 'low', label: '低' }]
const decisions: readonly { value: Decision; label: string }[] = [{ value: 'include', label: '纳入' }, { value: 'defer', label: '暂缓' }, { value: 'reject', label: '拒绝' }]

export function PriorityStep({ state, onEdit, onContinue }: {
  state: DemoState
  onEdit: (id: string, edit: ManualRequirementEdit) => void
  onContinue: () => void
}) {
  return <section aria-labelledby="priority-heading">
    <div className="section-heading"><div><p className="eyebrow">03 / 优先级</p><h2 id="priority-heading">每一项取舍，都由你决定。</h2>
      <p className="muted">优先级是人工判断。只有你明确纳入、且有原文引用的需求才会进入 PRD。</p></div></div>
    <p className="selection-count">已纳入 {eligibleRequirements(state.cards).length} 条有原文引用的需求</p>
    <div className="priority-list">{state.cards.map((card) => <fieldset key={card.id} className="panel priority-card">
      <legend>{card.title || '未命名需求'}</legend>
      <div className="priority-grid"><div><p>{card.description}</p><CardEvidence card={card} /></div><div className="decision-fields">
        {card.kind === 'cited' && <fieldset className="control-group"><legend>人工优先级</legend><div className="choice-row">{priorities.map((priority) => <label key={priority.value} className="choice"><input type="radio" name={`${card.id}-priority`} value={priority.value} checked={card.priority === priority.value} onChange={() => onEdit(card.id, { priority: priority.value })} />{priority.label}</label>)}</div></fieldset>}
        <fieldset className="control-group"><legend>本期决定</legend><div className="choice-row">{decisions.filter((decision) => card.kind === 'cited' || decision.value !== 'include').map((decision) => <label key={decision.value} className="choice"><input type="radio" name={`${card.id}-decision`} value={decision.value} checked={card.decision === decision.value} onChange={() => onEdit(card.id, { decision: decision.value })} />{decision.label}</label>)}</div></fieldset>
        {card.decision === 'pending' && <p className="help">尚未决定</p>}
        <label htmlFor={`${card.id}-reason`}>人工判断理由</label>
        <textarea id={`${card.id}-reason`} rows={3} placeholder="写下取舍的依据" value={card.humanReason} onChange={(event) => onEdit(card.id, { humanReason: event.target.value })} />
      </div></div>
    </fieldset>)}</div>
    <div className="step-footer"><p className="muted">尚未纳入需求时，也可以查看 PRD 空状态。</p><button type="button" className="primary" onClick={onContinue}>前往 PRD</button></div>
  </section>
}
