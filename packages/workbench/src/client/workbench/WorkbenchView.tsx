import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PRODUCT_API_VERSION, PRODUCT_ERROR_CODES, parseProductInput } from '../../protocol/product.js'
import type { ProjectId, PrdRevisionId } from '../../domain/ids.js'
import type { Stage3aProjectCommand } from './transport.js'
import type { ConfirmationSnapshot, StoreErrorCode, StoreResult, WorkbenchState, WorkbenchStore } from './store.js'
import { CreateProjectDialog, NativeDialog, ProjectList, type FocusTarget } from './ProjectList.js'
import { MaterialPane } from './MaterialPane.js'
import { ReviewWorkspace } from './RequirementsPane.js'
import './PriorityPane.js'
import { PrdPane } from './PrdPane.js'
import { launcherCss, workbenchCss } from './styles.js'
import { ValidationPane } from './ValidationPane.js'
import type { ValidationClient } from './validation-client.js'
import { validationCss } from './validation-styles.js'

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
  'synthetic-attestation-required': '请先确认此次操作仅包含合成测试材料', 'data-use-attestation-required': '请先确认你有权处理这份材料',
  'fixture-not-allowed': '材料校验失败，请重新载入后重试',
  'source-locked': '材料已锁定，请新建项目使用另一份合成材料', 'analysis-already-reviewed': '需求已进入人工审核，无法重新生成草稿',
  'no-included-requirements': '请至少选择一项纳入本期的需求并保存修改', 'stage-unavailable': '当前阶段暂不支持此操作',
  'model-output-incomplete': '模型已达到本次输出上限，未生成完整结果。原材料已保留，未自动重试；再次分析会消耗模型额度。',
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

function naturalStage(state: WorkbenchState): 0 | 1 | 2 {
  const project = state.selectedProject
  if (!project?.analysis) return 0
  const currentBaseline = project.currentBaseline
  const baselineStillCurrent = !!currentBaseline && currentBaseline.contentVersion === project.header.contentVersion
  return state.baselineChain || baselineStillCurrent || project.prdSummaries.length > 0 ? 2 : 1
}

function PrismMark({ marker, className = 'dsh-pm-launcher-icon', variant = false }: { marker?: string; className?: string; variant?: boolean }) {
  return <svg className={className} data-dsh-pm-workbench={marker} data-icon-variant={variant ? 'validation-prism' : undefined} viewBox="0 0 64 64" role="presentation" focusable="false">
    <path className="dsh-pm-launcher-prism-blade dsh-pm-launcher-prism-blade--top" d="M32 5C38 14 40 23 38 29L32 25 26 29C24 23 26 14 32 5Z" />
    <path className="dsh-pm-launcher-prism-blade dsh-pm-launcher-prism-blade--right" d="M55.4 45.5C44.6 46.2 35.8 43.5 31.6 38.8L37.9 37.5 39.6 31.3C45.9 31.6 52.3 38 55.4 45.5Z" />
    <path className="dsh-pm-launcher-prism-blade dsh-pm-launcher-prism-blade--left" d="M8.6 45.5C11.7 38 18.1 31.6 24.4 31.3L26.1 37.5 32.4 38.8C28.2 43.5 19.4 46.2 8.6 45.5Z" />
    <path className="dsh-pm-launcher-prism-core" d="M32 27.5 36.5 32 32 36.5 27.5 32Z" />
  </svg>
}

export function WorkbenchLauncher({ onOpen }: { onOpen(target: FocusTarget): void }) {
  return <>
    <style>{launcherCss}</style>
    <button type="button" className="dsh-pm-launcher" data-dsh-pm-workbench="launcher" onClick={event => onOpen(event.currentTarget)}>
      <PrismMark variant />
      <span className="dsh-pm-launcher-label">AI PM 工作台</span>
    </button>
  </>
}

export function WorkbenchView({ store, validationClient, createCommandId = () => globalThis.crypto.randomUUID().toLowerCase(), restoreFocus, onClose }: {
  store: WorkbenchStore; validationClient?: ValidationClient; createCommandId?: () => string; restoreFocus?: () => void; onClose?: () => void
}) {
  const state = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot)
  const [review, setReview] = useState(() => ({ token: store.getConfirmationSnapshot(), dirty: state.dirtyRevision,
    saved: state.savedDraftRevision, generation: 0 }))
  const [error, setError] = useState<string>(), [pending, setPending] = useState(0)
  const [materialReading, setMaterialReading] = useState(false)
  const [activeStage, setActiveStage] = useState<0 | 1 | 2 | 3 | 4>(() => naturalStage(state))
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
  async function selectAndShowPrd(id: PrdRevisionId, current: () => boolean): Promise<ActionResult> {
    const result = await store.selectPrd(id)
    if (result.ok && current()) setActiveStage(2)
    return result
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
    // Creation allocates the selection before persistence. Do not read that ID
    // until creation settles, or mask an uncertain receipt with a not-found read.
    if (!state.selectedProject && (state.pendingRetry || state.drafts.some(draft => draft.payload.kind === 'project.create'))) return
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

  function localCommand(kind: 'project.delete' | 'analysis.runHarnessModel'): Promise<StoreResult<unknown>> {
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
      return selectAndShowPrd(acceptedPrd, current)
    }
    if (!before.baselineChain) return loadDetails(current)
    const rendered = await store.renderPublishedBaseline()
    if (!rendered.ok) return rendered
    if (!current()) return cancelled
    return selectAndShowPrd(rendered.prdRevisionId, current)
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
        return id ? selectAndShowPrd(id, current) : { ok: false, code: 'refresh-required' }
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
      return selectAndShowPrd(rendered.prdRevisionId, () => selectedStill(displayed.project.header.id))
    })
  }
  function selectPrd(id: PrdRevisionId) {
    const request = ++prdRequest.current
    void run(() => store.selectPrd(id), () => request === prdRequest.current)
  }
  function regeneratePrd() {
    const snapshot = store.getSnapshot(), project = snapshot.selectedProject, baseline = project?.currentBaseline
    if (!project || !baseline || snapshot.dirty || snapshot.saveState !== 'saved' || snapshot.pendingRetry
      || baseline.contentVersion !== project.header.contentVersion) { report({ ok: false, code: 'baseline-stale' }); return }
    const sameSelection = capturePrdSelection()
    mutate(async () => {
      const refreshed = await store.refresh()
      if (!sameSelection()) return cancelled
      if (!refreshed.ok) return refreshed
      const current = store.getSnapshot(), latest = current.selectedProject
      if (!latest || latest.header.id !== project.header.id || latest.currentBaseline?.id !== baseline.id
        || latest.header.contentVersion !== baseline.contentVersion || current.dirty || current.saveState !== 'saved') return { ok: false, code: 'baseline-stale' }
      const command = parseProductInput('projects.command', { apiVersion: PRODUCT_API_VERSION, projectId: project.header.id,
        expectedVersion: latest.header.projectVersion, commandId: createCommandId(), payload: { kind: 'prd.render',
          baselineId: baseline.id, confirmedContentVersion: baseline.contentVersion } }) as Stage3aProjectCommand
      const result = await store.command(command)
      if (!sameSelection()) return cancelled
      if (!result.ok) return result
      const id = store.getSnapshot().acceptedReceipt?.value.prdRevisionId
      return id ? selectAndShowPrd(id, sameSelection) : { ok: false, code: 'refresh-required' }
    }, sameSelection)
  }
  function exportPrd() {
    const revision = store.getSnapshot().selectedPrdRevisionId, request = ++exportRequest.current, sameSelection = capturePrdSelection()
    void run(() => store.downloadSelectedMarkdown(),
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
  const currentStep = naturalStage(state)
  const steps = ['导入材料', '确认优先级', '生成 PRD', '方案验证', '研发交付'] as const
  useEffect(() => { setActiveStage(currentStep) }, [state.selectedProjectId, currentStep])
  if (!state.isOpen) return null
  return <NativeDialog marker="overlay" heading="AI PM 工作台" onClose={close} restoreFocus={restoreFocus} workbench>
    <style>{workbenchCss}</style>
    <style>{validationCss}</style>
    <div className="pmwb-shell">
      <header className="pmwb-shell-header" data-dsh-pm-workbench="workbench-header">
        <div className="pmwb-brand">
          <PrismMark marker="brand-mark" className="pmwb-brand-mark" />
          <strong>AI PM 工作台</strong>
        </div>
        <ProjectList state={state} onNew={() => setCreateDialog(true)} onSelect={id => { if (id !== state.selectedProjectId) void run(() => store.selectProject(id)) }} />
        <nav className="pmwb-stepper" data-dsh-pm-workbench="stepper">{steps.map((label, index) => {
          const stage = index as 0 | 1 | 2 | 3 | 4
          const available = stage === 0 || stage === 1 && !!state.selectedProject?.analysis
            || stage === 2 && (!!state.selectedProject?.currentBaseline || (state.selectedProject?.prdSummaries.length ?? 0) > 0)
            || stage >= 3 && !!validationClient && (state.selectedProject?.prdSummaries.length ?? 0) > 0
          return <button key={label} type="button" data-dsh-pm-workbench={`step-${index}`}
            className={stage < currentStep ? 'is-complete' : undefined} aria-current={stage === activeStage ? 'step' : undefined}
            disabled={!available} onClick={() => setActiveStage(stage)}><span>{index + 1}</span>{label}</button>
        })}</nav>
        <div className="pmwb-header-actions">
          <p className={`pmwb-save-state pmwb-save-state--${state.saveState}`} data-dsh-pm-workbench="save-state" role="status">{saveText[state.saveState]}</p>
          {visibleError && <p className="pmwb-visually-hidden" role="alert">{visibleError}</p>}
          <button type="button" className="pmwb-quiet-action" data-dsh-pm-workbench="refresh-project" disabled={pending > 0} onClick={() => recover()}>刷新</button>
          {state.pendingRetry && <button type="button" data-dsh-pm-workbench="retry-uncertain" disabled={pending > 0} onClick={() => recover(true)}>重试原操作</button>}
          {canDiscard && <button type="button" data-dsh-pm-workbench="discard-drafts" onClick={() => setDiscardDialog(true)}>放弃修改</button>}
          {state.selectedProject && <button type="button" className="pmwb-danger-action" data-dsh-pm-workbench="delete-project"
            disabled={pending > 0 || state.saveState !== 'saved'} onClick={() => setDeleteDialog(true)}>删除</button>}
          <button type="button" className="pmwb-close" data-dsh-pm-workbench="close" onClick={close}>关闭</button>
        </div>
      </header>
      <main className="pmwb-spatial-stage">
        {visibleError && <p className="pmwb-toast" role="status">{visibleError}</p>}
        {recovery && <p className="pmwb-toast" role="status">{pending > 0 ? '正在根据已确认范围起草 PRD，请稍候…' : '基线已确认，PRD 尚未完成，请刷新继续'}</p>}
        {state.selectedProject ? <>
          {activeStage === 0 && <section className="pmwb-surface pmwb-material-surface">
            <header><div><span>研究材料</span><h2>导入访谈材料</h2></div>
              <p>{state.selectedProject.header.researchGoal || '导入访谈材料，开始形成有依据的产品需求。'}</p></header>
            <MaterialPane store={store} state={state} pending={pending > 0} onResult={report} onReading={setMaterialReading}
                onReadStart={() => { const update = ownAlert(); update(undefined); return {
                  onResult: result => report(result, update),
                  onReadError: () => update('材料读取失败，请检查 Word、TXT 或 Markdown 文件；文本请使用 UTF-8 编码，Word 文件请勿加密'),
                } }}
                onSave={() => mutate(async () => { const result = await store.importMaterial(); if (!result.ok) return result; return store.loadSource() })}
                onAnalyse={() => mutate(() => localCommand('analysis.runHarnessModel'))} onContinue={() => setActiveStage(1)} />
          </section>}
          {activeStage === 1 && <ReviewWorkspace store={store} state={state} confirmation={confirmation} pending={pending > 0}
            onResult={report} onSave={saveRequirements} onEvidence={() => { void run(() => store.loadSource()) }}
            onReview={() => { const token = store.prepareConfirmation(); displayConfirmation(token); report(token.ok ? done : { ok: false, code: token.reason }) }}
            onConfirm={confirm} />}
          {activeStage === 2 && <section className="pmwb-surface pmwb-prd-surface">
            <header><div><span>已确认的需求范围</span><h2>产品需求文档</h2></div><p>核对文档，下载 PRD，再选择一个核心场景进行验证。</p></header>
            <PrdPane state={state} onSelect={selectPrd} onDownload={exportPrd} onRegenerate={regeneratePrd} pending={pending > 0}
              onBack={() => setActiveStage(1)} onContinue={validationClient ? () => setActiveStage(3) : undefined}
              canContinue={!!state.selectedMarkdown && pending === 0 && !state.dirty} />
          </section>}
          {(activeStage === 3 || activeStage === 4) && validationClient && <ValidationPane key={state.selectedProjectId} state={state} client={validationClient}
            stage={activeStage === 3 ? 'validation' : 'handoff'} onStage={setActiveStage} onReview={() => setActiveStage(1)} onSelectPrd={selectPrd} onDownloadPrd={exportPrd} />}
        </> : <section className="pmwb-empty-state pmwb-surface" data-dsh-pm-workbench="empty-state">
            <PrismMark className="pmwb-empty-mark" />
            <h2>还没有项目</h2>
            <p>新建第一个项目，开始整理材料并形成有依据的产品需求。</p>
            <button type="button" className="pmwb-primary" data-dsh-pm-workbench="empty-new-project" onClick={() => setCreateDialog(true)}>新建第一个项目</button>
          </section>}
      </main>
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
        const result = store.discardDrafts(); report(result)
        if (result.ok) {
          displayConfirmation({ ok: false, reason: 'unsaved' })
          setDiscardDialog(false)
        }
      }}>确认放弃</button>
    </NativeDialog>}
  </NativeDialog>
}
