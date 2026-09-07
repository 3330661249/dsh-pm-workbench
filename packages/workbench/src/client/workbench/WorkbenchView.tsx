import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { PRODUCT_API_VERSION, PRODUCT_ERROR_CODES, parseProductInput } from '../../protocol/product.js'
import type { ProjectId, PrdRevisionId } from '../../domain/ids.js'
import type { Stage3aProjectCommand } from './transport.js'
import type { ConfirmationSnapshot, StoreErrorCode, StoreResult, WorkbenchStore } from './store.js'
import { CreateProjectDialog, NativeDialog, ProjectList, type FocusTarget } from './ProjectList.js'
import { MaterialPane } from './MaterialPane.js'
import { RequirementsPane } from './RequirementsPane.js'
import { PriorityPane } from './PriorityPane.js'
import { PrdPane } from './PrdPane.js'
import { workbenchCss } from './styles.js'

const errors: Record<StoreErrorCode, string> = {
  'transport-internal': '工作台暂时无法连接', 'host-unavailable': '工作台暂时无法连接',
  'protocol-invalid': '工作台返回的内容无法校验，请刷新后重试',
  'version-conflict': '内容已更新，请刷新后重试', 'invalid-evidence': '原文依据无法核对，请刷新后重试',
  'project-switch-blocked': '请先保存或放弃当前项目的修改；结果待确认时请重试或刷新',
  'confirmation-stale': '确认摘要已失效，请重新核对确认摘要', 'baseline-stale': '内容已更新，请重新核对确认摘要',
  'refresh-required': '已接受的结果尚未读回，请刷新确认',
  'not-found': '内容暂未找到，请刷新后重试', 'project-deleted': '项目已删除，请刷新项目列表',
  'project-limit-reached': '已达到 20 个项目上限', 'idempotency-key-reused': '操作标识无法核对，请刷新后重试',
  'receipt-capacity-reached': '此项目的操作记录已达上限，请新建合成测试项目', 'limit-exceeded': '内容超过当前限制，请缩短后重试',
  'synthetic-attestation-required': '请先确认此次操作仅包含合成测试材料', 'fixture-not-allowed': '当前仅可保存内置合成测试材料，请载入测试材料后重试',
  'source-locked': '材料已锁定，请新建项目使用另一份合成材料', 'analysis-already-reviewed': '需求已进入人工审核，无法重新生成草稿',
  'no-included-requirements': '请至少选择一项纳入本期的需求并保存修改', 'stage-unavailable': '当前阶段暂不支持此操作',
  cancelled: '操作观察已结束，请刷新确认', 'storage-failed': '保存失败，请刷新确认后重试',
  unsaved: '请先保存修改', saving: '保存中，请等待结果',
  failed: '保存失败，请检查修改并刷新确认', uncertain: '结果待确认，请重试原操作或刷新',
  closed: '工作台已关闭，请重新打开', disposed: '工作台已卸载，请重新打开插件',
}
export function storeErrorText(code: StoreErrorCode): string { return errors[code] ?? '工作台暂时无法连接' }
const saveText = { unsaved: '未保存', saving: '保存中', saved: '已保存', failed: '保存失败', uncertain: '结果待确认' } as const
type ActionResult = { readonly ok: true } | { readonly ok: false; readonly code: StoreErrorCode }
const done = { ok: true } as const
const cancelled = { ok: false, code: 'cancelled' } as const

export function WorkbenchLauncher({ onOpen }: { onOpen(target: FocusTarget): void }) {
  return <button type="button" data-dsh-pm-workbench="launcher" onClick={event => onOpen(event.currentTarget)}>AI PM 工作台</button>
}

export function WorkbenchView({ store, createCommandId = () => globalThis.crypto.randomUUID().toLowerCase(), restoreFocus, onClose }: {
  store: WorkbenchStore; createCommandId?: () => string; restoreFocus?: () => void; onClose?: () => void
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [review, setReview] = useState(() => ({ token: store.getConfirmationSnapshot(), dirty: state.dirtyRevision,
    saved: state.savedDraftRevision, generation: 0 }))
  const [error, setError] = useState<string>(), [pending, setPending] = useState(0)
  const [materialReading, setMaterialReading] = useState(false)
  const [createDialog, setCreateDialog] = useState(false), [deleteDialog, setDeleteDialog] = useState(false), [discardDialog, setDiscardDialog] = useState(false)
  const actionLatch = useRef(false), activeActions = useRef(0), prdRequest = useRef(0), recoveryRequest = useRef(0), exportRequest = useRef(0)
  const errorOwner = useRef(0)
  const selection = useRef({ id: state.selectedProjectId, open: state.isOpen, generation: 0 })
  if (selection.current.id !== state.selectedProjectId || selection.current.open !== state.isOpen) {
    selection.current = { id: state.selectedProjectId, open: state.isOpen, generation: selection.current.generation + 1 }
  }
  const confirmation: ConfirmationSnapshot = review.dirty === state.dirtyRevision && review.saved === state.savedDraftRevision
    && review.generation === selection.current.generation ? review.token : { ok: false, reason: 'unsaved' }
  function displayConfirmation(token: ConfirmationSnapshot) {
    const current = store.getSnapshot()
    setReview({ token, dirty: current.dirtyRevision, saved: current.savedDraftRevision, generation: selection.current.generation })
  }
  const sectionRefs = useRef<Array<HTMLElement | null>>([]), sectionId = useId()
  function ownAlert() {
    const owner = ++errorOwner.current, captured = selection.current
    return (message?: string) => {
      if (owner === errorOwner.current && selectedStill(captured.id) && selection.current.generation === captured.generation) setError(message)
    }
  }
  function report(result: ActionResult, update = ownAlert()) { update(result.ok ? undefined : storeErrorText(result.code)) }
  async function run(work: () => Promise<ActionResult>, latest: () => boolean = () => true) {
    const captured = selection.current, update = ownAlert()
    activeActions.current++; setPending(activeActions.current); update(undefined)
    const current = () => store.getSnapshot().isOpen && store.getSnapshot().selectedProjectId === captured.id
      && selection.current.generation === captured.generation && latest()
    try { const result = await work(); if (current()) report(result, update) }
    catch { if (current()) update('工作台暂时无法连接') }
    finally { activeActions.current--; setPending(activeActions.current) }
  }
  function mutate(work: () => Promise<ActionResult>, latest?: () => boolean) {
    if (actionLatch.current) return
    actionLatch.current = true
    void run(async () => { try { return await work() } finally { actionLatch.current = false } }, latest)
  }
  function selectedStill(id: ProjectId | undefined) { const next = store.getSnapshot(); return next.isOpen && next.selectedProjectId === id }
  function capturePrdSelection() {
    const captured = selection.current, request = prdRequest.current
    return () => selectedStill(captured.id) && selection.current.generation === captured.generation && request === prdRequest.current
  }
  async function loadDetails(current = capturePrdSelection()): Promise<ActionResult> {
    if (!current()) return cancelled
    const selected = store.getSnapshot()
    if (!selected.selectedProjectId || !selected.selectedProject) return done
    if (selected.selectedProject.source) {
      const source = await store.loadSource(); if (!source.ok) return source
      if (!current()) return cancelled
    }
    const latest = store.getSnapshot()
    // The public projection preserves the immutable, append-only revision order.
    const revision = latest.selectedPrdRevisionId ?? latest.selectedProject?.prdSummaries.at(-1)?.prdRevisionId
    if (revision) return store.selectPrd(revision)
    return done
  }
  useEffect(() => {
    if (!state.isOpen) return
    // A lost creation receipt is retried under its original identity; do not replace
    // that failure with an expected not-found read of the unconfirmed project.
    if (!state.selectedProject && state.pendingRetry) return
    let active = true
    const sameSelection = capturePrdSelection(), current = () => active && sameSelection()
    void run(async () => {
      const refreshed = await store.refresh()
      if (!current()) return cancelled
      if (!refreshed.ok) return refreshed
      const result = await loadDetails(current)
      if (current() && result.ok) displayConfirmation(store.getConfirmationSnapshot())
      return result
    }, current)
    return () => { active = false }
  }, [state.isOpen, state.selectedProjectId])

  function localCommand(kind: 'project.delete' | 'analysis.runFixture'): Promise<StoreResult<unknown>> {
    const project = store.getSnapshot().selectedProject
    if (!project) return Promise.resolve({ ok: false, code: 'not-found' })
    try {
      const payload = kind === 'project.delete' ? { kind } : { kind, sourceRevisionId: project.source?.sourceRevisionId }
      const command = parseProductInput('projects.command', { apiVersion: PRODUCT_API_VERSION, projectId: project.header.id,
        expectedVersion: project.header.projectVersion, commandId: createCommandId(), payload }) as Stage3aProjectCommand
      return store.command(command)
    } catch { return Promise.resolve({ ok: false, code: 'protocol-invalid' }) }
  }
  async function continueBaseline(current: () => boolean): Promise<ActionResult> {
    if (!current()) return cancelled
    const before = store.getSnapshot()
    if (before.pendingRetry) return { ok: false, code: 'uncertain' }
    const acceptedPrd = before.acceptedReceipt?.value.prdRevisionId
    if (acceptedPrd && before.selectedProject?.prdSummaries.some(item => item.prdRevisionId === acceptedPrd && item.baselineId === before.baselineChain?.baselineId)) {
      return store.selectPrd(acceptedPrd)
    }
    if (!before.baselineChain) return loadDetails(current)
    const rendered = await store.renderPublishedBaseline()
    if (!rendered.ok) return rendered
    if (!current()) return cancelled
    return store.selectPrd(rendered.prdRevisionId)
  }
  function recover(retry = false) {
    if (actionLatch.current) return
    const request = ++recoveryRequest.current, sameSelection = capturePrdSelection()
    const current = () => request === recoveryRequest.current && sameSelection()
    mutate(async () => {
      const intent = store.getSnapshot().pendingRetry
      if (!retry) {
        const refreshed = await store.refresh()
        if (!current()) return cancelled
        return refreshed.ok ? continueBaseline(current) : refreshed
      }
      const result = await store.retryUncertain()
      if (result.ok && result.value === null) { if (store.getSnapshot().isOpen && request === recoveryRequest.current) setDeleteDialog(false); return done }
      if (!current()) return cancelled
      if (!result.ok) return result
      if (intent?.payload.kind === 'prd.render') {
        const id = store.getSnapshot().acceptedReceipt?.value.prdRevisionId
        return id ? store.selectPrd(id) : { ok: false, code: 'refresh-required' }
      }
      return continueBaseline(current)
    }, current)
  }
  function confirm() {
    if (actionLatch.current) return
    const displayed = confirmation
    if (!displayed.ok) { report({ ok: false, code: displayed.reason }); return }
    const current = store.getSnapshot(), generation = selection.current.generation
    if (current.dirtyRevision !== review.dirty || current.savedDraftRevision !== review.saved || current.selectedProject !== displayed.project) {
      displayConfirmation({ ok: false, reason: 'unsaved' }); report({ ok: false, code: 'confirmation-stale' }); return
    }
    if (!displayed.project.humanDecisions.some(item => item.decision === 'include')) { report({ ok: false, code: 'no-included-requirements' }); return }
    mutate(async () => {
      const published = await store.publishConfirmedBaseline(displayed)
      if (!published.ok) {
        if (selection.current.generation === generation && selectedStill(displayed.project.header.id)) {
          setReview(current => current.token === displayed ? { ...current, token: { ok: false, reason: 'unsaved' } } : current)
        }
        return published
      }
      if (!selectedStill(displayed.project.header.id)) return cancelled
      const rendered = await store.renderPublishedBaseline()
      if (!rendered.ok) return rendered
      if (!selectedStill(displayed.project.header.id)) return cancelled
      return store.selectPrd(rendered.prdRevisionId)
    })
  }
  function selectPrd(id: PrdRevisionId) {
    const request = ++prdRequest.current
    void run(() => store.selectPrd(id), () => request === prdRequest.current)
  }
  function exportPrd(download: boolean) {
    const revision = store.getSnapshot().selectedPrdRevisionId, request = ++exportRequest.current, sameSelection = capturePrdSelection()
    void run(() => download ? store.downloadSelectedMarkdown() : store.copySelectedMarkdown(),
      () => sameSelection() && store.getSnapshot().selectedPrdRevisionId === revision && request === exportRequest.current)
  }
  function saveRequirements() {
    const current = store.getSnapshot()
    if (!current.drafts.length || current.saveState === 'uncertain'
      || !current.drafts.every(intent => ['requirement.update', 'requirements.reorder'].includes(intent.payload.kind))) return
    mutate(() => store.flushProjectEdits())
  }
  function close() { onClose?.(); setCreateDialog(false); setDeleteDialog(false); setDiscardDialog(false); store.close() }
  const knownRejection = state.saveState === 'failed' && PRODUCT_ERROR_CODES.some(code => code !== 'cancelled' && code === state.error)
  const canDiscard = pending === 0 && !materialReading && state.dirty && (state.saveState === 'unsaved' || state.saveState === 'failed') && !state.pendingRetry
    && state.acceptedVersionFloor <= (state.selectedProject?.header.projectVersion ?? 0)
    && (knownRejection || state.drafts.every(intent => ['requirement.update', 'requirements.reorder', 'source.importText'].includes(intent.payload.kind)))
  const hasAcceptedPrd = state.acceptedReceipt?.value.prdRevisionId && state.selectedProject?.prdSummaries.some(item => item.prdRevisionId === state.acceptedReceipt?.value.prdRevisionId)
  const recovery = !!state.baselineChain && !hasAcceptedPrd
  const visibleError = state.error === 'transport-internal' || state.error === 'host-unavailable'
    ? storeErrorText(state.error) : error ?? (state.error ? storeErrorText(state.error) : undefined)
  if (!state.isOpen) return null
  return <NativeDialog marker="overlay" heading="AI PM 工作台" onClose={close} restoreFocus={restoreFocus} workbench>
    <style>{workbenchCss}</style>
    <header><p>材料 → 需求 → 优先级 → PRD</p><button type="button" data-dsh-pm-workbench="close" onClick={close}>关闭工作台</button></header>
    <p className="pmwb-notice">当前仅支持合成测试材料，请勿导入真实访谈或客户信息</p>
    <p data-dsh-pm-workbench="save-state" role="status">{saveText[state.saveState]}</p>
    {visibleError && <p role="alert">{visibleError}</p>}
    {recovery && <p role="status">基线已确认，PRD 尚未完成，请刷新继续</p>}
    <div className="pmwb-actions">
      <button type="button" data-dsh-pm-workbench="refresh-project" disabled={pending > 0} onClick={() => recover()}>刷新项目</button>
      {state.pendingRetry && <button type="button" data-dsh-pm-workbench="retry-uncertain" disabled={pending > 0} onClick={() => recover(true)}>重试原操作</button>}
      {canDiscard && <button type="button" data-dsh-pm-workbench="discard-drafts" onClick={() => setDiscardDialog(true)}>放弃未保存修改</button>}
    </div>
    <div className="pmwb-body">
      <ProjectList state={state} onNew={() => setCreateDialog(true)} onSelect={id => { if (id !== state.selectedProjectId) void run(() => store.selectProject(id)) }} />
      <main>{state.selectedProject ? <>
        <header><h2>{state.selectedProject.header.name}</h2>
          <button type="button" data-dsh-pm-workbench="delete-project" disabled={pending > 0 || state.saveState !== 'saved'} onClick={() => setDeleteDialog(true)}>删除项目</button></header>
        <p>{state.selectedProject.header.researchGoal || '研究目标未提供'}</p>
        <p>{state.selectedProject.header.reviewStarted ? '需求审核中' : state.selectedProject.analysis ? '本地草稿待审核' : state.selectedProject.source ? '材料已保存' : '等待合成材料'}</p>
        <nav>{['材料', '需求', '优先级', 'PRD'].map((label, index) => <button key={index} type="button" onClick={() => {
          sectionRefs.current[index]?.scrollIntoView?.({ block: 'start' }); sectionRefs.current[index]?.focus()
        }}>{label}</button>)}</nav>
        {['材料', '需求', '优先级', 'PRD'].map((label, index) => <section key={index} tabIndex={-1} aria-labelledby={`${sectionId}-${index}`} ref={node => { sectionRefs.current[index] = node }}>
          <h2 id={`${sectionId}-${index}`}>{label}</h2>
          {index === 0 && <MaterialPane store={store} state={state} pending={pending > 0} onResult={report} onReading={setMaterialReading}
            onReadStart={() => { const update = ownAlert(); update(undefined); return {
              onResult: result => report(result, update),
              onReadError: () => update('材料读取失败，请检查 TXT 或 Markdown 文件及 UTF-8 编码后重试'),
            } }}
            onSave={() => mutate(async () => { const result = await store.importMaterial(); if (!result.ok) return result; return store.loadSource() })}
            onAnalyse={() => mutate(() => localCommand('analysis.runFixture'))} />}
          {index === 1 && <RequirementsPane store={store} state={state} pending={pending > 0} onResult={report}
            onSave={saveRequirements} onEvidence={() => { void run(() => store.loadSource()) }} />}
          {index === 2 && <PriorityPane state={state} confirmation={confirmation} pending={pending > 0} onConfirm={confirm}
            onReview={() => { const token = store.prepareConfirmation(); displayConfirmation(token); report(token.ok ? done : { ok: false, code: token.reason }) }} />}
          {index === 3 && <PrdPane state={state} onSelect={selectPrd} onCopy={() => exportPrd(false)} onDownload={() => exportPrd(true)} />}
        </section>)}
      </> : <p>请选择或新建一个合成测试项目。</p>}</main>
    </div>
    {createDialog && <CreateProjectDialog pending={pending > 0} uncertain={state.saveState === 'uncertain'} error={visibleError} onClose={() => setCreateDialog(false)} onCreate={(name, researchGoal, attested) => mutate(async () => {
      const result = await store.createProject({ name, researchGoal }, attested)
      if (result.ok && store.getSnapshot().isOpen) setCreateDialog(false)
      return result
    })} />}
    {deleteDialog && state.selectedProject && <NativeDialog marker="delete-dialog" heading="确认删除项目" onClose={() => setDeleteDialog(false)}>
      <p>确认删除项目“{state.selectedProject.header.name}”？该项目的材料、需求和 PRD 将被删除。</p>
      {visibleError && <p role="alert">{visibleError}</p>}
      {state.pendingRetry && <p>关闭确认窗口不会撤销已发送的操作，请返回工作台重试原操作或刷新。</p>}
      <button type="button" onClick={() => setDeleteDialog(false)}>{state.pendingRetry ? '返回工作台' : '取消删除'}</button>
      <button type="button" data-dsh-pm-workbench="confirm-delete" disabled={pending > 0 || state.saveState !== 'saved'} onClick={() => {
        if (store.getSnapshot().saveState !== 'saved') return
        mutate(async () => { const result = await localCommand('project.delete'); if (result.ok) setDeleteDialog(false); return result })
      }}>确认删除</button>
    </NativeDialog>}
    {discardDialog && <NativeDialog marker="discard-dialog" heading="放弃未保存修改" onClose={() => setDiscardDialog(false)}>
      <p>仅放弃本地未保存或被拒绝的修改。已保存的项目、材料与 PRD 会保留。</p>
      {visibleError && <p role="alert">{visibleError}</p>}
      <button type="button" onClick={() => setDiscardDialog(false)}>取消放弃</button>
      <button type="button" data-dsh-pm-workbench="confirm-discard" disabled={!canDiscard} onClick={() => {
        if (!canDiscard) return
        const result = store.discardDrafts(); report(result); if (result.ok) setDiscardDialog(false)
      }}>确认放弃</button>
    </NativeDialog>}
  </NativeDialog>
}
