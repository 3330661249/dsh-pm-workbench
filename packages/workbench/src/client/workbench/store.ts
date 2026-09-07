import {
  PRODUCT_API_VERSION, parseProductInput, parseProductOutcome,
  type ProductErrorCode, type ProjectCommandOutcome,
} from '../../protocol/product.js'
import { canonicalJson } from '../../protocol/canonical-json.js'
import { projectIdSchema, type ProjectId, type RequirementId, type PrdRevisionId, type BaselineId } from '../../domain/ids.js'
import type { ProjectView, ProjectSummary, SourceView, MarkdownView } from '../../application/project-views.js'
import type { WorkbenchTransport, WorkbenchTransportErrorCode, WorkbenchResult, Stage3aProjectCommand } from './transport.js'
import { isVerifiedMarkdown } from './transport.js'
import type { WorkbenchBrowserPort } from './browser-port.js'
import { canPersistFixtureDraft, type MaterialDraft } from './material-input.js'

type Payload = Stage3aProjectCommand['payload']
type RequirementPatch = Omit<Extract<Payload, { kind: 'requirement.update' }>, 'kind' | 'requirementId'>
type Accepted = Extract<ProjectCommandOutcome, { status: 'accepted' }>
export type SaveState = 'unsaved' | 'saving' | 'saved' | 'failed' | 'uncertain'
export type StoreErrorCode = WorkbenchTransportErrorCode | ProductErrorCode | 'unsaved' | 'saving' | 'failed' | 'uncertain'
  | 'closed' | 'disposed' | 'project-switch-blocked' | 'confirmation-stale' | 'refresh-required'
export type StoreResult<T = void> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly code: StoreErrorCode }
export type ConfirmationSnapshot = { readonly ok: false; readonly reason: 'unsaved' | 'saving' | 'failed' | 'uncertain' }
  | { readonly ok: true; readonly projectVersion: number; readonly contentVersion: number; readonly project: ProjectView }
export interface BaselineChain {
  readonly projectId: ProjectId
  readonly baselineId: BaselineId
  readonly confirmedContentVersion: number
  readonly acceptedProjectVersion: number
}
export interface DraftIntent {
  readonly projectId: ProjectId
  readonly selectionGeneration: number
  readonly revision: number
  readonly payload: Payload
}
export interface WorkbenchState {
  readonly isOpen: boolean
  readonly projects: readonly ProjectSummary[]
  readonly selectedProjectId?: ProjectId
  readonly selectedProject?: ProjectView
  readonly selectedSource?: SourceView
  readonly selectedPrdRevisionId?: PrdRevisionId
  readonly selectedMarkdown?: MarkdownView
  readonly materialDraft?: MaterialDraft
  readonly importAttested: boolean
  readonly materialDirty: boolean
  readonly drafts: readonly DraftIntent[]
  readonly dirtyRevision: number
  readonly savedDraftRevision: number
  readonly dirty: boolean
  readonly saveState: SaveState
  readonly acceptedVersionFloor: number
  readonly pendingRetry?: Stage3aProjectCommand
  readonly acceptedReceipt?: Accepted
  readonly baselineChain?: BaselineChain
  readonly error?: StoreErrorCode
}
export interface WorkbenchClientIds { createCommandId(): string; createProjectId(): string }
export interface WorkbenchStore {
  getSnapshot(): WorkbenchState
  subscribe(listener: () => void): () => void
  open(): Promise<StoreResult>
  close(): void
  dispose(): void
  refresh(): Promise<StoreResult<ProjectView | undefined>>
  selectProject(id: ProjectId): Promise<StoreResult<ProjectView | undefined>>
  editRequirement(id: RequirementId, patch: RequirementPatch): StoreResult<number>
  reorderRequirements(ids: readonly RequirementId[]): StoreResult<number>
  discardDrafts(): StoreResult
  flushProjectEdits(): Promise<StoreResult<ProjectView>>
  command(input: Stage3aProjectCommand): Promise<StoreResult<ProjectView | null>>
  retryUncertain(): Promise<StoreResult<ProjectView | null>>
  getConfirmationSnapshot(): ConfirmationSnapshot
  prepareConfirmation(): ConfirmationSnapshot
  publishConfirmedBaseline(token: ConfirmationSnapshot): Promise<
    { readonly ok: true; readonly projectVersion: number; readonly baselineId: BaselineId } | { readonly ok: false; readonly code: StoreErrorCode }>
  renderPublishedBaseline(): Promise<
    { readonly ok: true; readonly projectVersion: number; readonly baselineId: BaselineId; readonly prdRevisionId: PrdRevisionId; readonly current: boolean } | { readonly ok: false; readonly code: StoreErrorCode }>
  createProject(input: { readonly name: string; readonly researchGoal: string | null }, creationAttested: boolean): Promise<StoreResult<ProjectView | null>>
  setMaterialDraft(draft: MaterialDraft, importAttested: boolean): StoreResult
  importMaterial(): Promise<StoreResult<ProjectView | null>>
  loadSource(): Promise<StoreResult<SourceView>>
  selectPrd(id: PrdRevisionId): Promise<StoreResult<MarkdownView>>
  copySelectedMarkdown(): Promise<StoreResult>
  downloadSelectedMarkdown(): Promise<StoreResult>
}
interface Intent extends DraftIntent { command?: Stage3aProjectCommand; accepted?: Accepted; failure?: StoreErrorCode; material?: MaterialDraft }
interface Active { readonly intent: Intent; admitted: boolean }
const api = { apiVersion: PRODUCT_API_VERSION }
const fail = (code: StoreErrorCode) => ({ ok: false, code } as const)
const success = <T>(value: T) => ({ ok: true, value } as const)
const affectsContent = (payload: Payload) => ['source.importText', 'analysis.runFixture', 'requirement.update', 'requirements.reorder'].includes(payload.kind)
const emptyState = (): WorkbenchState => Object.freeze({ isOpen: false, projects: [], drafts: [], dirtyRevision: 0,
  savedDraftRevision: 0, dirty: false, saveState: 'unsaved', acceptedVersionFloor: 0, importAttested: false, materialDirty: false, selectedProject: undefined, pendingRetry: undefined })

/** One selected-project queue: switching is refused until its complete barrier is clean. */
export function createWorkbenchStore(transport: WorkbenchTransport, ids: WorkbenchClientIds, browser: WorkbenchBrowserPort): WorkbenchStore {
  let state = emptyState()
  let disposed = false, selectionGeneration = 0, observationGeneration = 0, prdGeneration = 0
  let observation = new AbortController(), prdAbort = new AbortController()
  let intents: Intent[] = [], active: Active | undefined, running = 0
  let tail: Promise<unknown> = Promise.resolve()
  let readbackFailed = false, reviewRequired = false
  const listeners = new Set<() => void>()
  let confirmations = new WeakMap<object, { selection: number; observation: number; revision: number; saved: number; project: ProjectView }>()
  function publish(patch: Partial<WorkbenchState> = {}): void {
    if (disposed) return
    const next = { ...state, ...patch }
    const dirty = next.dirtyRevision !== next.savedDraftRevision || next.materialDirty
    const saveState: SaveState = next.pendingRetry ? 'uncertain' : intents.some(i => i.failure) || readbackFailed ? 'failed'
      : active?.admitted ? 'saving' : dirty || running > 0 || !next.selectedProject ? 'unsaved' : 'saved'
    state = Object.freeze({ ...next, dirty, saveState, drafts: Object.freeze(intents.map(i => Object.freeze({
      projectId: i.projectId, selectionGeneration: i.selectionGeneration, revision: i.revision, payload: i.payload,
    }))) })
    for (const listener of [...listeners]) { try { listener() } catch { /* isolate observers */ } }
  }
  function available(): StoreErrorCode | undefined { return disposed ? 'disposed' : !state.isOpen ? 'closed' : undefined }
  function current(selection: number, observationId: number): boolean {
    return !disposed && state.isOpen && selection === selectionGeneration && observationId === observationGeneration
  }
  function blocked(): boolean {
    return state.dirty || running > 0 || !!active || state.saveState === 'failed' || state.saveState === 'uncertain'
  }
  function invalidateChain(): void {
    if (state.baselineChain) { reviewRequired = true; publish({ baselineChain: undefined }) }
  }
  function settleAcceptedDrafts(): void {
    if (state.pendingRetry || !state.selectedProject || state.selectedProject.header.projectVersion < state.acceptedVersionFloor) return
    let saved = state.savedDraftRevision
    for (const intent of intents) {
      if (!intent.accepted || intent.revision !== saved + 1) break
      saved = intent.revision
      if (intent.payload.kind === 'source.importText' && intent.material === state.materialDraft) {
        publish({ materialDirty: false })
      }
    }
    intents = intents.filter(intent => intent.revision > saved)
    readbackFailed = false
    publish({ savedDraftRevision: saved, error: intents.find(i => i.failure)?.failure })
  }
  async function readProject(): Promise<StoreResult<ProjectView>> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    const id = state.selectedProjectId; if (!id) return fail('not-found')
    const selection = selectionGeneration, observationId = observationGeneration
    let result: WorkbenchResult<'projects.get'>
    try { result = await transport.getProject({ ...api, projectId: id }, observation.signal) }
    catch { result = { ok: false, error: { code: 'host-unavailable', uncertain: false } } }
    if (!current(selection, observationId)) return fail('cancelled')
    if (!result.ok) { readbackFailed = true; publish({ error: result.error.code }); return fail(result.error.code) }
    let outcome
    try { outcome = parseProductOutcome('projects.get', result.value, { ...api, projectId: id }) }
    catch { readbackFailed = true; publish({ error: 'protocol-invalid' }); return fail('protocol-invalid') }
    if (outcome.status === 'rejected') { readbackFailed = true; publish({ error: outcome.error.code }); return fail(outcome.error.code) }
    const view = outcome.value
    if (state.selectedProject?.header.projectVersion === view.header.projectVersion && canonicalJson(view) !== canonicalJson(state.selectedProject)) {
      readbackFailed = true; publish({ error: 'protocol-invalid' }); return fail('protocol-invalid')
    }
    if (view.header.projectVersion < state.acceptedVersionFloor) {
      readbackFailed = true; publish({ error: 'refresh-required' }); return fail('refresh-required')
    }
    if (!state.selectedProject || view.header.projectVersion >= state.selectedProject.header.projectVersion) {
      const chain = state.baselineChain
      if (chain && (view.header.contentVersion !== chain.confirmedContentVersion || view.currentBaseline?.id !== chain.baselineId)) invalidateChain()
      const selectedSummary = view.prdSummaries.find(p => p.prdRevisionId === state.selectedPrdRevisionId)
      const retainMarkdown = state.selectedMarkdown && selectedSummary && state.selectedMarkdown.contentHash === selectedSummary.contentHash
      const projects = [...state.projects.filter(project => project.id !== view.header.id), view.header]
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id))
      publish({ projects: Object.freeze(projects), selectedProject: view, selectedMarkdown: retainMarkdown ? state.selectedMarkdown : undefined })
    }
    settleAcceptedDrafts()
    return success(state.selectedProject!)
  }
  async function refresh(): Promise<StoreResult<ProjectView | undefined>> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    const selection = selectionGeneration, observationId = observationGeneration
    // Project reads remain independent from the mutation queue. They cannot resolve an unknown receipt.
    if (state.selectedProjectId) return readProject()
    let result: WorkbenchResult<'projects.list'>
    try { result = await transport.listProjects(observation.signal) }
    catch { return fail('host-unavailable') }
    if (!current(selection, observationId)) return fail('cancelled')
    if (!result.ok) { publish({ error: result.error.code }); return fail(result.error.code) }
    if (result.value.status === 'rejected') { publish({ error: result.value.error.code }); return fail(result.value.error.code) }
    publish({ projects: result.value.value, error: undefined }); return success(undefined)
  }
  function beginSelection(id: ProjectId): void {
    observation.abort(); prdAbort.abort()
    observation = new AbortController(); prdAbort = new AbortController()
    selectionGeneration++; observationGeneration++; prdGeneration++
    intents = []; active = undefined; running = 0; tail = Promise.resolve(); readbackFailed = false; reviewRequired = false
    publish({ selectedProjectId: id, selectedProject: undefined, selectedSource: undefined, selectedPrdRevisionId: undefined,
      selectedMarkdown: undefined, materialDraft: undefined, importAttested: false, materialDirty: false, dirtyRevision: 0, savedDraftRevision: 0,
      acceptedVersionFloor: 0, acceptedReceipt: undefined, pendingRetry: undefined, baselineChain: undefined, error: undefined })
  }
  async function selectProject(id: ProjectId): Promise<StoreResult<ProjectView | undefined>> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    if (blocked()) return fail('project-switch-blocked')
    try { projectIdSchema.parse(id) } catch { return fail('protocol-invalid') }
    beginSelection(id)
    return readProject()
  }
  function enqueue(payload: Payload, command?: Stage3aProjectCommand): StoreResult<number> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    const id = state.selectedProjectId; if (!id) return fail('not-found')
    // Validate the payload immediately, while version and identity are frozen only when dispatched.
    try {
      const checked = parseProductInput('projects.command', command ?? { ...api, projectId: id, commandId: '00000000-0000-4000-8000-000000000001',
        expectedVersion: payload.kind === 'project.create' ? 0 : Math.max(1, state.selectedProject?.header.projectVersion ?? 1), payload })
      if (checked.payload.kind === 'analysis.runHarnessModel') return fail('stage-unavailable')
      const revision = state.dirtyRevision + 1
      intents.push({ projectId: id, selectionGeneration, revision, payload: checked.payload, command, ...(checked.payload.kind === 'source.importText' ? { material: state.materialDraft } : {}) })
      if (affectsContent(checked.payload)) invalidateChain()
      publish({ dirtyRevision: revision })
      return success(revision)
    } catch { return fail('protocol-invalid') }
  }
  async function execute(intent: Intent, retry = false): Promise<StoreResult<Accepted>> {
    const selection = selectionGeneration, observationId = observationGeneration
    if (intent.projectId !== state.selectedProjectId || intent.selectionGeneration !== selection) return fail('cancelled')
    if (!intent.command) {
      try {
        intent.command = parseProductInput('projects.command', { ...api, projectId: intent.projectId,
          commandId: ids.createCommandId(), expectedVersion: Math.max(state.acceptedVersionFloor, state.selectedProject?.header.projectVersion ?? 0),
          payload: intent.payload }) as Stage3aProjectCommand
      } catch { intent.failure = 'protocol-invalid'; publish({ error: 'protocol-invalid' }); return fail('protocol-invalid') }
    }
    const command = intent.command
    const operation: Active = { intent, admitted: false }
    active = operation; publish()
    let result: WorkbenchResult<'projects.command'>
    try { result = await transport.command(command, observation.signal, { onAdmitted: () => {
      operation.admitted = true
      if (current(selection, observationId)) publish()
      else if (!disposed && selection === selectionGeneration && intents.includes(intent)) publish({ pendingRetry: command, error: 'cancelled' })
    } }) } catch { result = { ok: false, error: { code: 'host-unavailable', uncertain: operation.admitted } } }
    if (!current(selection, observationId)) return fail('cancelled')
    if (active === operation) active = undefined
    if (result.ok) {
      try { result = { ok: true, value: parseProductOutcome('projects.command', result.value, command) } }
      catch { result = { ok: false, error: { code: 'protocol-invalid', uncertain: operation.admitted } } }
    }
    const cancelledBusiness = result.ok && result.value.status === 'rejected' && result.value.error.code === 'cancelled'
    if (!result.ok || cancelledBusiness) {
      const code = result.ok ? 'cancelled' : result.error.code
      const uncertain = retry || operation.admitted && (cancelledBusiness || !result.ok)
      if (uncertain) publish({ pendingRetry: command, error: code })
      else { publish({ error: code }); /* unsent intent remains available with its existing identity */ }
      return fail(uncertain ? 'uncertain' : code)
    }
    if (result.value.status === 'rejected') {
      intent.failure = result.value.error.code
      if (result.value.error.code === 'baseline-stale') { reviewRequired = true; publish({ baselineChain: undefined }) }
      publish({ pendingRetry: undefined, error: result.value.error.code })
      if (result.value.error.code === 'version-conflict' || result.value.error.code === 'baseline-stale') await readProject()
      return fail(result.value.error.code)
    }
    intent.accepted = result.value
    intent.failure = undefined
    const receipt = result.value
    const patch: { -readonly [K in keyof WorkbenchState]?: WorkbenchState[K] } = { pendingRetry: undefined, acceptedReceipt: receipt,
      acceptedVersionFloor: Math.max(state.acceptedVersionFloor, receipt.value.projectVersion), error: undefined }
    if (command.payload.kind === 'baseline.publish' && !intents.some(later => later.revision > intent.revision && affectsContent(later.payload))) {
      patch.baselineChain = Object.freeze({ projectId: command.projectId, baselineId: receipt.value.baselineId!,
        confirmedContentVersion: command.payload.confirmedContentVersion, acceptedProjectVersion: receipt.value.projectVersion })
    } else if (command.payload.kind === 'baseline.publish') {
      reviewRequired = true
      patch.baselineChain = undefined
    } else if (command.payload.kind === 'prd.render' && state.baselineChain) {
      // Retain original confirmation and baseline identity; advance only by this exact receipt.
      patch.baselineChain = Object.freeze({ ...state.baselineChain, acceptedProjectVersion: receipt.value.projectVersion })
    }
    publish(patch)
    return success(receipt)
  }
  async function drain(barrier: number): Promise<StoreResult<ProjectView>> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    if (state.pendingRetry) return fail('uncertain')
    for (const intent of intents.filter(i => i.revision <= barrier)) {
      if (intent.failure) return fail(intent.failure)
      if (!intent.accepted) {
        const result = await execute(intent)
        if (!result.ok) return result
      }
    }
    if (intents.some(i => i.revision <= barrier && i.accepted)) {
      const result = await readProject()
      if (!result.ok) return result
    }
    if (state.savedDraftRevision < barrier || !state.selectedProject) return fail('refresh-required')
    return success(state.selectedProject)
  }
  function serialized<T>(work: () => Promise<T>, stale: T): Promise<T> {
    const selection = selectionGeneration, observationId = observationGeneration
    running++; publish()
    const task = tail.then(() => current(selection, observationId) ? work() : stale)
    tail = task.catch(() => {})
    return task.finally(() => { if (current(selection, observationId)) { running--; publish() } })
  }
  function flushProjectEdits(): Promise<StoreResult<ProjectView>> {
    const barrier = state.dirtyRevision
    return serialized(() => drain(barrier), fail('cancelled'))
  }
  async function command(input: Stage3aProjectCommand): Promise<StoreResult<ProjectView | null>> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    if (state.dirtyRevision !== state.savedDraftRevision || running || active || state.pendingRetry || intents.some(i => i.failure) || readbackFailed) return fail(state.saveState === 'saved' ? 'unsaved' : state.saveState)
    let captured: Stage3aProjectCommand
    try {
      captured = parseProductInput('projects.command', input) as Stage3aProjectCommand
      if (captured.payload.kind === 'analysis.runHarnessModel' as string) return fail('stage-unavailable')
    } catch { return fail('protocol-invalid') }
    if (captured.payload.kind === 'project.create') beginSelection(captured.projectId)
    else if (captured.projectId !== state.selectedProjectId) return fail('project-switch-blocked')
    const enqueued = enqueue(captured.payload, captured); if (!enqueued.ok) return enqueued
    if (captured.payload.kind !== 'project.delete') return flushProjectEdits()
    const intent = intents[intents.length - 1]!
    return serialized(async () => {
      const result = await execute(intent); if (!result.ok) return result
      intents = []
      publish({ selectedProject: undefined, selectedProjectId: undefined, selectedSource: undefined, selectedMarkdown: undefined,
        selectedPrdRevisionId: undefined, baselineChain: undefined, materialDraft: undefined, importAttested: false,
        savedDraftRevision: state.dirtyRevision, projects: state.projects.filter(project => project.id !== captured.projectId) })
      return success(null)
    }, fail('cancelled'))
  }
  async function retryUncertain(): Promise<StoreResult<ProjectView | null>> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    const retry = state.pendingRetry
    if (!retry || running > 0 || active) return fail('unsaved')
    const intent = intents.find(i => i.command === retry)
    if (!intent) return fail('protocol-invalid')
    return serialized(async () => {
      const outcome = await execute(intent, true); if (!outcome.ok) return outcome
      if (retry.payload.kind === 'project.delete') {
        intents = []; publish({ selectedProject: undefined, selectedProjectId: undefined, savedDraftRevision: state.dirtyRevision,
          selectedSource: undefined, selectedMarkdown: undefined, selectedPrdRevisionId: undefined, baselineChain: undefined })
        return success(null)
      }
      return readProject()
    }, fail('cancelled'))
  }
  function confirmationReason(): 'unsaved' | 'saving' | 'failed' | 'uncertain' | undefined {
    if (state.pendingRetry) return 'uncertain'
    if (state.saveState === 'failed') return 'failed'
    if (active?.admitted) return 'saving'
    if (available() || state.dirty || intents.length || running || !state.selectedProject || state.saveState !== 'saved') return 'unsaved'
    return undefined
  }
  function getConfirmationSnapshot(): ConfirmationSnapshot {
    const reason = confirmationReason() ?? (reviewRequired ? 'unsaved' : undefined)
    if (reason) return Object.freeze({ ok: false, reason })
    const project = state.selectedProject!
    const token = Object.freeze({ ok: true as const, projectVersion: project.header.projectVersion, contentVersion: project.header.contentVersion, project })
    confirmations.set(token, { selection: selectionGeneration, observation: observationGeneration, revision: state.dirtyRevision,
      saved: state.savedDraftRevision, project })
    return token
  }
  function prepareConfirmation(): ConfirmationSnapshot {
    // An explicit reopened summary can acknowledge a rejected obsolete continuation.
    // Content drafts and uncertain commands are never discarded by this action.
    if (reviewRequired && !readbackFailed && !active && !running && !state.pendingRetry && intents.length
      && intents.every(intent => !!intent.failure && ['baseline.publish', 'prd.render'].includes(intent.payload.kind))) {
      intents = []
      publish({ savedDraftRevision: state.dirtyRevision, error: undefined })
    }
    if (!confirmationReason()) reviewRequired = false
    return getConfirmationSnapshot()
  }
  async function publishConfirmedBaseline(token: ConfirmationSnapshot) {
    if (!token.ok) return fail(token.reason)
    const captured = confirmations.get(token)
    if (!captured || captured.selection !== selectionGeneration || captured.observation !== observationGeneration
      || captured.revision !== state.dirtyRevision || captured.saved !== state.savedDraftRevision || captured.project !== state.selectedProject
      || token.projectVersion !== state.selectedProject?.header.projectVersion || token.contentVersion !== state.selectedProject?.header.contentVersion
      || confirmationReason() || reviewRequired) return fail('confirmation-stale')
    // A displayed token is one-shot; failed continuation resumes the accepted chain instead.
    confirmations.delete(token)
    if (state.baselineChain) return fail('confirmation-stale')
    let input: Stage3aProjectCommand
    try { input = parseProductInput('projects.command', { ...api, projectId: token.project.header.id, expectedVersion: token.projectVersion,
      commandId: ids.createCommandId(), payload: { kind: 'baseline.publish', confirmedContentVersion: token.contentVersion } }) as Stage3aProjectCommand }
    catch { return fail('protocol-invalid') }
    const result = await command(input)
    if (!result.ok) return result
    const chain = (state as WorkbenchState).baselineChain
    if (!chain) return fail('baseline-stale')
    return { ok: true as const, projectVersion: chain.acceptedProjectVersion, baselineId: chain.baselineId }
  }
  async function renderPublishedBaseline() {
    const chain = state.baselineChain
    if (!chain) return fail('baseline-stale')
    if (confirmationReason()) return fail(confirmationReason()!)
    // Re-read before continuation so an observed content change rebuilds the summary without substituting it.
    const view = await readProject()
    if (!view.ok) return view
    if (state.baselineChain !== chain || view.value.header.contentVersion !== chain.confirmedContentVersion
      || view.value.currentBaseline?.id !== chain.baselineId) return fail('baseline-stale')
    let input: Stage3aProjectCommand
    try { input = parseProductInput('projects.command', { ...api, projectId: chain.projectId, expectedVersion: chain.acceptedProjectVersion,
      commandId: ids.createCommandId(), payload: { kind: 'prd.render', baselineId: chain.baselineId, confirmedContentVersion: chain.confirmedContentVersion } }) as Stage3aProjectCommand }
    catch { return fail('protocol-invalid') }
    const result = await command(input)
    if (!result.ok) return result
    const receipt = state.acceptedReceipt!
    const summary = state.selectedProject?.prdSummaries.find(p => p.prdRevisionId === receipt.value.prdRevisionId)
    if (!summary || summary.baselineId !== chain.baselineId) return fail('refresh-required')
    return { ok: true as const, projectVersion: receipt.value.projectVersion, baselineId: chain.baselineId,
      prdRevisionId: summary.prdRevisionId, current: summary.status === 'current' }
  }
  async function selectPrd(id: PrdRevisionId): Promise<StoreResult<MarkdownView>> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    const projectId = state.selectedProjectId
    const summary = state.selectedProject?.prdSummaries.find(p => p.prdRevisionId === id)
    if (!projectId || !summary) return fail('not-found')
    prdAbort.abort(); prdAbort = new AbortController()
    const request = ++prdGeneration, selection = selectionGeneration, observationId = observationGeneration
    publish({ selectedPrdRevisionId: id, selectedMarkdown: undefined })
    let result: WorkbenchResult<'artifacts.getMarkdown'>
    try { result = await transport.getMarkdown({ ...api, projectId, prdRevisionId: id }, prdAbort.signal) }
    catch { return fail('host-unavailable') }
    if (!current(selection, observationId) || request !== prdGeneration) return fail('cancelled')
    if (!result.ok) return fail(result.error.code)
    if (result.value.status === 'rejected') return fail(result.value.error.code)
    const value = result.value.value
    const currentSummary = state.selectedProject?.prdSummaries.find(p => p.prdRevisionId === id)
    if (!isVerifiedMarkdown(value) || value.projectId !== projectId || value.prdRevisionId !== id || value.contentHash !== currentSummary?.contentHash
      || value.baselineId !== currentSummary.baselineId || value.sourceRevisionId !== currentSummary.sourceRevisionId
      || value.baselineContentVersion !== currentSummary.baselineContentVersion) return fail('protocol-invalid')
    publish({ selectedMarkdown: value }); return success(value)
  }
  async function exportSelected(download: boolean): Promise<StoreResult> {
    const unavailable = available(); if (unavailable) return fail(unavailable)
    const value = state.selectedMarkdown
    if (!value || value.prdRevisionId !== state.selectedPrdRevisionId
      || value.contentHash !== state.selectedProject?.prdSummaries.find(p => p.prdRevisionId === state.selectedPrdRevisionId)?.contentHash) return fail('protocol-invalid')
    try { if (download) await browser.download(value); else await browser.copy(value); return success(undefined) }
    catch { return fail('transport-internal') }
  }
  function close(): void {
    if (disposed || !state.isOpen) return
    const pendingRetry = active?.admitted ? active.intent.command : state.pendingRetry
    observationGeneration++; prdGeneration++; observation.abort(); prdAbort.abort()
    active = undefined; running = 0; tail = Promise.resolve()
    browser.close()
    publish({ isOpen: false, pendingRetry, selectedMarkdown: undefined })
  }
  return {
    getSnapshot: () => state,
    subscribe(listener) { if (disposed) return () => {}; listeners.add(listener); return () => { listeners.delete(listener) } },
    async open() {
      if (disposed) return fail('disposed')
      if (!state.isOpen) { observationGeneration++; observation = new AbortController(); publish({ isOpen: true }) }
      const result = await refresh(); return result.ok ? success(undefined) : result
    },
    close,
    dispose() {
      if (disposed) return
      close(); disposed = true; observation.abort(); prdAbort.abort(); browser.dispose()
      intents = []; active = undefined; tail = Promise.resolve(); confirmations = new WeakMap(); state = emptyState(); listeners.clear()
    },
    refresh, selectProject, command, retryUncertain, flushProjectEdits,
    discardDrafts() {
      const unavailable = available(); if (unavailable) return fail(unavailable)
      if (running || active) return fail('saving')
      if (state.pendingRetry) return fail('uncertain')
      if (intents.some(intent => intent.accepted) || readbackFailed) return fail('refresh-required')
      intents = []
      reviewRequired = false
      publish({ materialDraft: undefined, materialDirty: false, importAttested: false, baselineChain: undefined,
        savedDraftRevision: state.dirtyRevision, error: undefined })
      return success(undefined)
    },
    editRequirement: (id, patch) => enqueue({ kind: 'requirement.update', requirementId: id, ...patch }),
    reorderRequirements: requirementIds => enqueue({ kind: 'requirements.reorder', requirementIds }),
    getConfirmationSnapshot, prepareConfirmation, publishConfirmedBaseline, renderPublishedBaseline,
    async createProject(input, creationAttested) {
      if (creationAttested !== true) return fail('synthetic-attestation-required')
      if (blocked()) return fail('project-switch-blocked')
      try { return await command(parseProductInput('projects.command', { ...api, projectId: ids.createProjectId(), commandId: ids.createCommandId(),
        expectedVersion: 0, payload: { kind: 'project.create', ...input, syntheticDataAttested: true } }) as Stage3aProjectCommand) }
      catch { return fail('protocol-invalid') }
    },
    setMaterialDraft(draft, importAttested) {
      const unavailable = available(); if (unavailable) return fail(unavailable)
      if (!state.selectedProjectId) return fail('not-found')
      publish({ materialDraft: draft, importAttested: importAttested === true, materialDirty: true }); return success(undefined)
    },
    async importMaterial() {
      const draft = state.materialDraft
      if (!state.importAttested) return fail('synthetic-attestation-required')
      if (!draft || !canPersistFixtureDraft(draft, state.importAttested)) return fail('fixture-not-allowed')
      try { return await command(parseProductInput('projects.command', { ...api, projectId: state.selectedProjectId,
        expectedVersion: state.selectedProject?.header.projectVersion, commandId: ids.createCommandId(), payload: {
          kind: 'source.importText', text: draft.text, displayName: draft.displayName, format: draft.format, syntheticDataAttested: true,
        } }) as Stage3aProjectCommand) } catch { return fail('protocol-invalid') }
    },
    async loadSource() {
      const unavailable = available(); if (unavailable) return fail(unavailable)
      const source = state.selectedProject?.source; if (!source) return fail('not-found')
      const selection = selectionGeneration, observationId = observationGeneration
      const result = await transport.getSource({ ...api, projectId: source.projectId, sourceRevisionId: source.sourceRevisionId }, observation.signal)
      if (!current(selection, observationId)) return fail('cancelled')
      if (!result.ok) return fail(result.error.code)
      if (result.value.status === 'rejected') return fail(result.value.error.code)
      const value = result.value.value
      if (value.projectId !== source.projectId || value.sourceRevisionId !== source.sourceRevisionId || value.contentHash !== source.contentHash) return fail('protocol-invalid')
      publish({ selectedSource: value }); return success(value)
    },
    selectPrd, copySelectedMarkdown: () => exportSelected(false), downloadSelectedMarkdown: () => exportSelected(true),
  }
}
