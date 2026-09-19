import { useEffect, useId, useState } from 'react'
import type { ProjectView, SourceView } from '../../application/project-views.js'
import type { RequirementId } from '../../domain/ids.js'
import type { EvidenceExcerpt, HumanDecision } from '../../domain/model.js'
import type { ConfirmationSnapshot, DraftIntent, StoreResult, WorkbenchState, WorkbenchStore } from './store.js'

export const priorityText = { high: '高', medium: '中', low: '低' } as const
export const decisionText = { pending: '待决定', include: '纳入本期', defer: '暂缓', reject: '不采纳' } as const

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
  return <blockquote className="pmwb-evidence" data-dsh-pm-workbench="evidence" data-evidence-id={evidence.id} data-source-revision-id={evidence.sourceRevisionId}
    data-quote-start={evidence.start} data-quote-end={evidence.end} data-quote-hash={evidence.quoteHash}>
    <p className="pmwb-evidence-role">{({ support: '支持依据', counterexample: '相反情况', context: '背景' } as const)[evidence.role]}</p>
    <p className="pmwb-evidence-quote" data-dsh-pm-workbench="evidence-quote">“{evidence.quote}”</p>
    <div data-dsh-pm-workbench="evidence-context">
      <p>来源：{source?.displayName ?? '访谈材料'} · 原文片段</p>
      {expanded && matches && <p>{source.text.slice(Math.max(0, evidence.start - 60), Math.min(source.text.length, evidence.end + 60))}</p>}
      {expanded && !matches && <p>正在核对原文，请刷新后重试</p>}
    </div>
    {onOpen && <button type="button" className="pmwb-evidence-open" onClick={() => { setExpanded(true); onOpen() }}>来自访谈</button>}
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

const priorities = [
  { value: 'high', label: 'P0', hint: '最高优先级' },
  { value: 'medium', label: 'P1', hint: '高优先级' },
  { value: 'low', label: 'P2', hint: '中优先级' },
] as const

const decisions = [
  { value: 'include', label: '纳入本期', hint: '进入 PRD 范围' },
  { value: 'defer', label: '暂缓', hint: '留待后续评估' },
  { value: 'reject', label: '不采纳', hint: '本期不做' },
] as const

const decisionBadge = { pending: '待确认', include: '已纳入', defer: '暂缓', reject: '不采纳' } as const
const priorityBadge = { high: 'P0', medium: 'P1', low: 'P2' } as const

export function ReviewWorkspace({ store, state, confirmation, pending, onResult, onSave, onEvidence, onReview, onConfirm }: {
  store: WorkbenchStore
  state: WorkbenchState
  confirmation: ConfirmationSnapshot
  pending: boolean
  onResult(result: StoreResult<unknown>): void
  onSave(): void
  onEvidence(): void
  onReview(): void
  onConfirm(): void
}) {
  const id = useId()
  const items = state.selectedProject ? selectedRequirements(state.selectedProject, state.drafts) : []
  const suggestions = new Map(state.selectedProject?.generatedRequirements.map(item => [item.requirementId, item.suggestedPriority]))
  const [selectedId, setSelectedId] = useState<RequirementId | undefined>(() => items[0]?.requirementId)
  const [sourceExpanded, setSourceExpanded] = useState(false)
  const selectedIndex = Math.max(0, items.findIndex(item => item.requirementId === selectedId))
  const selected = items[selectedIndex]
  const source = state.selectedSource?.sourceRevisionId === state.selectedProject?.source?.sourceRevisionId ? state.selectedSource : undefined

  useEffect(() => {
    if (!items.some(item => item.requirementId === selectedId)) setSelectedId(items[0]?.requirementId)
  }, [state.selectedProjectId, items.length, selectedId])
  useEffect(() => { setSourceExpanded(false) }, [state.selectedProjectId, state.selectedProject?.source?.sourceRevisionId])

  const valid = confirmation.ok === true && state.saveState === 'saved' && !state.dirty && !pending
    && confirmation.project === state.selectedProject
    && confirmation.projectVersion === state.selectedProject?.header.projectVersion
    && confirmation.contentVersion === state.selectedProject?.header.contentVersion
  const confirmedProject = valid && confirmation.ok ? confirmation.project : undefined
  const included = items.filter(item => item.decision === 'include').length
  const waiting = items.filter(item => item.decision === 'pending').length
  const deferred = items.filter(item => item.decision === 'defer' || item.decision === 'reject').length
  const hasIncluded = items.some(item => item.decision === 'include')
  const editable = !!selected && state.saveState !== 'uncertain' && !pending
  const canSave = state.drafts.length > 0 && state.saveState !== 'uncertain'
    && state.drafts.every(intent => ['requirement.update', 'requirements.reorder'].includes(intent.payload.kind))

  function edit(patch: Parameters<WorkbenchStore['editRequirement']>[1]) {
    if (!selected || state.saveState === 'uncertain') return
    onResult(store.editRequirement(selected.requirementId, patch))
  }

  function move(rank: number) {
    if (!selected || !Number.isSafeInteger(rank) || rank < 1 || rank > items.length || state.saveState === 'uncertain') return
    const order = items.map(item => item.requirementId).filter(requirementId => requirementId !== selected.requirementId)
    order.splice(rank - 1, 0, selected.requirementId)
    onResult(store.reorderRequirements(order))
  }

  if (!selected) return <section className="pmwb-review-empty">
    <h2>没有可审核的需求</h2>
    <p>暂未找到有充分依据的需求，可检查材料或保留为后续研究问题。</p>
  </section>

  return <section className="pmwb-review" data-dsh-pm-workbench="review-workspace">
    <div className="pmwb-review-content">
    <section className="pmwb-review-dock" data-dsh-pm-workbench="review-navigator">
      <header className="pmwb-review-nav-header">
        <div><h2>确认本期需求</h2><p>先核对依据，再决定优先级与本期范围。</p></div>
        <span>{items.length} 条需求</span>
      </header>
      <div className="pmwb-review-columns"><span>需求</span><span>AI 建议</span><span>人工决定</span></div>
      <div className="pmwb-requirement-strip">
        {items.map((item, index) => {
          const quote = item.evidence[0]?.quote
          // Display a contiguous sentence from the real quote; never paraphrase text inside quotation marks.
          const sentence = quote?.match(/^[\s\S]*?[。！？.!?](?:[”’」』"])?|^[\s\S]+$/u)?.[0] ?? quote
          const suggested = suggestions.get(item.requirementId)
          return <button type="button" key={item.requirementId} data-requirement-id={item.requirementId}
            className={item.requirementId === selected.requirementId ? 'is-selected' : undefined}
            aria-pressed={item.requirementId === selected.requirementId} onClick={() => setSelectedId(item.requirementId)}>
            <span className="pmwb-requirement-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="pmwb-requirement-summary"><strong>{item.title}</strong><small>{sentence ? `“${sentence}”` : '暂无原文依据'}</small></span>
            <span className="pmwb-requirement-ai">{suggested ? priorityBadge[suggested] : '未提供'}</span>
            <span className="pmwb-requirement-decision">{item.decision === 'pending' ? decisionBadge.pending : `${priorityBadge[item.priority]} · ${decisionBadge[item.decision]}`}</span>
          </button>
        })}
      </div>
    </section>

    <aside className="pmwb-focus-panel" data-dsh-pm-workbench="requirement-card" data-requirement-id={selected.requirementId}>
      <section className="pmwb-evidence-section">
        <header><div><h3>原文依据</h3><span>{selected.evidence.length} 条依据</span></div>
          <button type="button" className="pmwb-text-action" aria-expanded={sourceExpanded}
            onClick={() => { setSourceExpanded(true); onEvidence() }}>查看全部原文</button></header>
        <div className="pmwb-evidence-list">
          {selected.evidence.slice(0, 1).map(evidence => <Evidence key={evidence.id} evidence={evidence} source={source} onOpen={onEvidence} />)}
          {selected.evidence.length > 1 && <details className="pmwb-more-evidence" key={selected.requirementId}>
            <summary>更多原文依据（{selected.evidence.length - 1} 条）</summary>
            {selected.evidence.slice(1).map(evidence => <Evidence key={evidence.id} evidence={evidence} source={source} onOpen={onEvidence} />)}
          </details>}
          {selected.evidence.length === 0 && <p className="pmwb-muted-copy">这条需求暂时没有可展示的原文依据。</p>}
        </div>
        {sourceExpanded && <details className="pmwb-source-details" data-dsh-pm-workbench="review-source" open={sourceExpanded}
          onToggle={event => setSourceExpanded(event.currentTarget.open)}>
          <summary>完整访谈原文</summary>
          {source ? <pre className="pmwb-source-text" data-dsh-pm-workbench="review-source-text">{source.text}</pre>
            : <p>正在读取原文；读取失败时可重试上方按钮。</p>}
        </details>}
      </section>
      <div className="pmwb-ai-recommendation">
        <strong>AI 建议：{suggestions.get(selected.requirementId) ? priorityBadge[suggestions.get(selected.requirementId)!] : '未提供'}</strong>
        <span>{selected.rationale}</span>
      </div>
      <section className="pmwb-decision-palette">
        <h2>你的判断</h2>
        <div className="pmwb-priority-row">
          <h3>优先级</h3>
          <div className="pmwb-priority-options" data-dsh-pm-workbench="priority">
            {priorities.map(option => <button key={option.value} type="button" className={selected.priority === option.value ? 'is-selected' : undefined}
              aria-pressed={selected.priority === option.value} disabled={!editable} onClick={() => edit({ priority: option.value as HumanDecision['priority'] })}>
              <strong>{option.label}</strong><span>{option.hint}</span>
            </button>)}
          </div>
        </div>
        <div className="pmwb-scope-row">
          <h3>本期范围</h3>
          <div className="pmwb-decision-options" data-dsh-pm-workbench="decision">
            {decisions.map(option => <button key={option.value} type="button" className={selected.decision === option.value ? 'is-selected' : undefined}
              aria-pressed={selected.decision === option.value} disabled={!editable} onClick={() => edit({ decision: option.value as HumanDecision['decision'] })}>
              <strong>{option.label}</strong><span>{option.hint}</span>
            </button>)}
          </div>
        </div>
        <label className="pmwb-reason" htmlFor={`${id}-reason`}><span>决定理由</span>
          <textarea id={`${id}-reason`} data-dsh-pm-workbench="human-reason" value={selected.humanReason} disabled={!editable}
            placeholder="可选：记录调整依据" onChange={event => edit({ humanReason: event.currentTarget.value })} />
        </label>
      </section>
      <details className="pmwb-requirement-details">
        <summary>需求详情</summary>
        {state.selectedProject?.analysis?.kind === 'harness-model' && <p className="pmwb-model-route" data-dsh-pm-workbench="model-route">
          Harness 模型分析 · {state.selectedProject.analysis.provider} / {state.selectedProject.analysis.model}
        </p>}
        <header className="pmwb-focus-header">
          <div>
            <label htmlFor={`${id}-title`}>需求标题</label>
            <textarea id={`${id}-title`} data-dsh-pm-workbench="requirement-title" value={selected.title} disabled={!editable}
              onChange={event => edit({ title: event.currentTarget.value })} />
          </div>
          <label className="pmwb-rank-control" htmlFor={`${id}-order`}>
            <span>排序</span>
            <select id={`${id}-order`} data-dsh-pm-workbench="requirement-order" value={selectedIndex + 1} disabled={!editable}
              onChange={event => move(Number(event.currentTarget.value))}>
              {items.map((_, index) => <option key={index} value={index + 1}>第 {index + 1} 位</option>)}
            </select>
          </label>
        </header>
        <label htmlFor={`${id}-description`}>需求描述</label>
        <textarea id={`${id}-description`} className="pmwb-focus-description" data-dsh-pm-workbench="requirement-description" value={selected.description}
          disabled={!editable} onChange={event => edit({ description: event.currentTarget.value })} />
        <div className="pmwb-insight-grid">
          <section>
            <label htmlFor={`${id}-pain-point`}>用户问题</label>
            <textarea id={`${id}-pain-point`} data-dsh-pm-workbench="requirement-pain-point" value={selected.painPoint} disabled={!editable}
              onChange={event => edit({ painPoint: event.currentTarget.value })} />
          </section>
        </div>
        <section className="pmwb-unknowns">
          <h3>仍需确认</h3>
          <p>{selected.unknowns.join('；') || '暂无额外不确定项。'}</p>
          {!!selected.assumptions.length && <p>假设：{selected.assumptions.join('；')}</p>}
        </section>
      </details>
    </aside>
    </div>

    <footer className="pmwb-review-actions">
      <div className="pmwb-review-summary">
        <p><strong>已纳入 {included} 条</strong><span>待确认 {waiting} 条</span>{deferred > 0 && <span>暂缓 / 不采纳 {deferred} 条</span>}</p>
        <small>仅已纳入的需求进入本期 PRD</small>
      </div>
      {canSave ? <button type="button" className="pmwb-primary" data-dsh-pm-workbench="save-requirements" disabled={pending} onClick={onSave}>保存修改</button>
        : !valid ? <button type="button" className="pmwb-primary" data-dsh-pm-workbench="confirm-scope"
            disabled={!hasIncluded || pending || state.saveState === 'uncertain' || state.saveState === 'saving'} onClick={onReview}>核对本期范围</button>
          : <button type="button" className="pmwb-primary" data-dsh-pm-workbench="confirm-scope" disabled={!hasIncluded || !!state.baselineChain} onClick={onConfirm}>确认范围并生成 PRD</button>}
    </footer>

    {confirmedProject && <div className="pmwb-visually-hidden" data-dsh-pm-workbench="confirmation-summary"
      data-project-id={confirmedProject.header.id} data-confirmation-project-version={confirmedProject.header.projectVersion}
      data-confirmation-content-version={confirmedProject.header.contentVersion}>确认摘要已准备</div>}
  </section>
}
