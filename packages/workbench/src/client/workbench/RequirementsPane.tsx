import { useId, useState } from 'react'
import type { ProjectView, SourceView } from '../../application/project-views.js'
import type { RequirementId } from '../../domain/ids.js'
import type { EvidenceExcerpt, HumanDecision } from '../../domain/model.js'
import type { DraftIntent, StoreResult, WorkbenchState, WorkbenchStore } from './store.js'

export const priorityText = { high: '高', medium: '中', low: '低' } as const
export const decisionText = { pending: '待决定', include: '纳入本期', defer: '后续研究', reject: '不采纳' } as const

/** Resolve the selected text, then overlay local edit intents only in editing views. */
export function selectedRequirements(project: ProjectView, drafts: readonly DraftIntent[] = []) {
  const intents = [...drafts].sort((a, b) => a.revision - b.revision)
  let order = project.requirementOrder
  for (const intent of intents) if (intent.payload.kind === 'requirements.reorder') order = intent.payload.requirementIds
  return order.flatMap(requirementId => {
    const draft = project.generatedRequirements.find(item => item.requirementId === requirementId)
    if (!draft) return []
    const decision = project.humanDecisions.find(item => item.requirementId === requirementId)
    const selectedText = decision?.selectedText
    const human = selectedText?.kind === 'human-revision' ? project.selectedHumanRevisions.find(item => item.id === selectedText.revisionId) : undefined
    let value = { requirementId, title: human?.title ?? draft.title, painPoint: human?.painPoint ?? draft.painPoint,
      description: human?.description ?? draft.description, priority: decision?.priority ?? draft.suggestedPriority,
      decision: decision?.decision ?? 'pending' as HumanDecision['decision'], humanReason: decision?.humanReason ?? '',
      evidence: draft.evidenceIds.flatMap(id => project.evidence.filter(item => item.id === id)),
      rationale: draft.rationale, assumptions: draft.assumptions, unknowns: draft.unknowns }
    for (const intent of intents) if (intent.payload.kind === 'requirement.update' && intent.payload.requirementId === requirementId) {
      const { title, painPoint, description, priority, decision, humanReason } = intent.payload
      value = { ...value, ...(title !== undefined ? { title } : {}), ...(painPoint !== undefined ? { painPoint } : {}),
        ...(description !== undefined ? { description } : {}), ...(priority !== undefined ? { priority } : {}),
        ...(decision !== undefined ? { decision } : {}), ...(humanReason !== undefined ? { humanReason } : {}) }
    }
    return [value]
  })
}

export function Evidence({ evidence, source, onOpen }: { evidence: EvidenceExcerpt; source?: SourceView; onOpen?: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const matches = source?.sourceRevisionId === evidence.sourceRevisionId && source.text.slice(evidence.start, evidence.end) === evidence.quote
  return <blockquote data-dsh-pm-workbench="evidence" data-evidence-id={evidence.id} data-source-revision-id={evidence.sourceRevisionId}
    data-quote-start={evidence.start} data-quote-end={evidence.end} data-quote-hash={evidence.quoteHash}>
    <p>{({ support: '支持依据', counterexample: '相反情况', context: '背景' } as const)[evidence.role]}</p>
    <p data-dsh-pm-workbench="evidence-quote">{evidence.quote}</p>
    <div data-dsh-pm-workbench="evidence-context">
      <p>原文位置：第 {evidence.start + 1} 至 {evidence.end} 个 UTF-16 码元</p>
      {expanded && matches && <p>{source.text.slice(Math.max(0, evidence.start - 60), Math.min(source.text.length, evidence.end + 60))}</p>}
      {expanded && !matches && <p>正在核对原文，请刷新后重试</p>}
    </div>
    {onOpen && <button type="button" onClick={() => { setExpanded(true); onOpen() }}>查看原文</button>}
  </blockquote>
}

function RequirementCard({ item, rank, count, source, disabled, onEdit, onOrder, onEvidence }: {
  item: ReturnType<typeof selectedRequirements>[number]; rank: number; count: number; source?: SourceView
  disabled: boolean; onEdit(patch: Parameters<WorkbenchStore['editRequirement']>[1]): void; onOrder(rank: number): void; onEvidence(): void
}) {
  const id = useId()
  return <article data-dsh-pm-workbench="requirement-card" data-requirement-id={item.requirementId}>
    <h3>需求 {rank}</h3>
    {(['title', 'painPoint', 'description'] as const).map(field => {
      const marker = { title: 'requirement-title', painPoint: 'requirement-pain-point', description: 'requirement-description' }[field]
      return <div key={field}>
        <label id={`${id}-${field}-label`} htmlFor={`${id}-${field}`}>{({ title: '需求标题', painPoint: '用户痛点', description: '需求描述' })[field]}</label>
        <textarea id={`${id}-${field}`} aria-labelledby={`${id}-${field}-label`} data-dsh-pm-workbench={marker} value={item[field]} disabled={disabled}
          onChange={event => onEdit({ [field]: event.currentTarget.value })} />
      </div>
    })}
    <label id={`${id}-priority-label`} htmlFor={`${id}-priority`}>人工优先级</label>
    <select id={`${id}-priority`} aria-labelledby={`${id}-priority-label`} data-dsh-pm-workbench="priority" value={item.priority} disabled={disabled}
      onChange={event => onEdit({ priority: event.currentTarget.value as HumanDecision['priority'] })}>
      {Object.entries(priorityText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <label id={`${id}-decision-label`} htmlFor={`${id}-decision`}>人工决定</label>
    <select id={`${id}-decision`} aria-labelledby={`${id}-decision-label`} data-dsh-pm-workbench="decision" value={item.decision} disabled={disabled}
      onChange={event => onEdit({ decision: event.currentTarget.value as HumanDecision['decision'] })}>
      {Object.entries(decisionText).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <label id={`${id}-reason-label`} htmlFor={`${id}-reason`}>人工理由</label>
    <textarea id={`${id}-reason`} aria-labelledby={`${id}-reason-label`} data-dsh-pm-workbench="human-reason" value={item.humanReason} disabled={disabled}
      onChange={event => onEdit({ humanReason: event.currentTarget.value })} />
    <label id={`${id}-order-label`} htmlFor={`${id}-order`}>需求顺序</label>
    <select id={`${id}-order`} aria-labelledby={`${id}-order-label`} data-dsh-pm-workbench="requirement-order" value={rank} disabled={disabled}
      onChange={event => onOrder(Number(event.currentTarget.value))}>
      {Array.from({ length: count }, (_, index) => <option key={index} value={index + 1}>{index + 1}</option>)}
    </select>
    <p>草稿推导：{item.rationale}</p>
    <p>假设：{item.assumptions.join('；') || '未提供'}</p><p>待研究问题：{item.unknowns.join('；') || '未提供'}</p>
    {item.evidence.map(evidence => <Evidence key={evidence.id} evidence={evidence} source={source} onOpen={onEvidence} />)}
  </article>
}

export function RequirementsPane({ store, state, pending, onResult, onSave, onEvidence }: {
  store: WorkbenchStore; state: WorkbenchState; pending: boolean
  onResult(result: StoreResult<unknown>): void; onSave(): void; onEvidence(): void
}) {
  const items = state.selectedProject ? selectedRequirements(state.selectedProject, state.drafts) : []
  function reorder(id: RequirementId, rank: number) {
    if (!Number.isSafeInteger(rank) || rank < 1 || rank > items.length) return
    const order = items.map(item => item.requirementId).filter(item => item !== id); order.splice(rank - 1, 0, id)
    onResult(store.reorderRequirements(order))
  }
  return <>
    {items.length === 0 && <p>暂未找到有充分依据的需求，可检查材料或保留为后续研究问题。</p>}
    {items.map((item, index) => <RequirementCard key={item.requirementId} item={item} rank={index + 1} count={items.length} source={state.selectedSource} disabled={state.saveState === 'uncertain'}
      onEdit={patch => onResult(store.getSnapshot().saveState === 'uncertain' ? { ok: false, code: 'uncertain' } : store.editRequirement(item.requirementId, patch))}
      onOrder={rank => { if (store.getSnapshot().saveState !== 'uncertain') reorder(item.requirementId, rank) }} onEvidence={onEvidence} />)}
    <button type="button" data-dsh-pm-workbench="save-requirements" disabled={pending || state.saveState === 'uncertain' || state.drafts.length === 0
      || !state.drafts.every(intent => ['requirement.update', 'requirements.reorder'].includes(intent.payload.kind))} onClick={onSave}>保存修改</button>
  </>
}
