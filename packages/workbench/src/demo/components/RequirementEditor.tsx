import type { ManualRequirementEdit } from '../domain/requirements.js'
import type { RequirementCard } from '../domain/types.js'

export function CardEvidence({ card }: { card: RequirementCard }) {
  return <div className="card-evidence">
    <div className="card-tags"><span className="tag">{card.fixtureLabel}</span>{card.manuallyEdited && <span className="tag human-tag">已人工编辑</span>}</div>
    {card.kind === 'cited' ? <div className="citation"><h4>原文引用</h4>
      {card.citations.map((citation, index) => <div key={index}><blockquote>{citation.text}</blockquote><p className="citation-position">[{citation.start}, {citation.end})</p></div>)}
    </div> : <div className="inference-notice"><strong>AI 推断，待确认（演示）</strong><p>不可纳入本次 PRD</p></div>}
    <p className="help">{card.demoReason}</p>
  </div>
}

export function RequirementEditor({ card, onEdit }: {
  card: RequirementCard
  onEdit: (id: string, edit: ManualRequirementEdit) => void
}) {
  return <article className="panel requirement-card" aria-labelledby={`${card.id}-heading`}>
    <h3 id={`${card.id}-heading`}>{card.title || '未命名需求'}</h3>
    <CardEvidence card={card} />
    <div className="editable-fields">
      <label htmlFor={`${card.id}-title`}>需求标题</label>
      <input id={`${card.id}-title`} value={card.title} onChange={(event) => onEdit(card.id, { title: event.target.value })} />
      <label htmlFor={`${card.id}-pain`}>用户痛点</label>
      <textarea id={`${card.id}-pain`} rows={2} value={card.painPoint} onChange={(event) => onEdit(card.id, { painPoint: event.target.value })} />
      <label htmlFor={`${card.id}-description`}>需求描述</label>
      <textarea id={`${card.id}-description`} rows={3} value={card.description} onChange={(event) => onEdit(card.id, { description: event.target.value })} />
    </div>
  </article>
}
