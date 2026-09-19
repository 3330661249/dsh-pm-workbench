import { randomUUID } from 'node:crypto'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { InsightEngine } from '../analysis/types.js'
import {
  analysisRevisionIdSchema, baselineIdSchema, prdRevisionIdSchema, requirementRevisionIdSchema,
  sourceRevisionIdSchema, type ProjectId, type Sha256Hex,
} from '../domain/ids.js'
import {
  MAX_ACTIVE_PROJECTS, MAX_COMMAND_RECEIPTS_PER_PROJECT, MAX_TOMBSTONES_BEFORE_CREATE_BLOCKED,
  MAX_PROJECT_ROWS, MAX_BASELINES_PER_PROJECT, MAX_PRD_REVISIONS_PER_PROJECT,
  MAX_PROFILE_ACTIVE_RECORD_UTF8_BYTES, utf8ByteLength,
} from '../domain/limits.js'
import {
  assertStoredRecordBudget, deepFreeze, PROJECT_BUSINESS_ERROR_CODES,
  type ActiveProjectRecord, type StoredProjectRecord, type ProjectBusinessErrorCode,
} from '../domain/model.js'
import { applyRequirementUpdate, applyRequirementOrder } from '../domain/requirements.js'
import { publishRequirementBaseline } from '../domain/baseline.js'
import { DeterministicPrdRenderer, type PrdRenderer } from '../domain/prd.js'
import { validatePersistedSource } from '../domain/text.js'
import { validateAnalysisCandidate } from '../domain/evidence.js'
import { canonicalJson, canonicalJsonUtf8Bytes } from '../protocol/canonical-json.js'
import {
  parseProductInput, parseProductOutcome, type ProjectCommand, type ProjectCommandOutcome,
} from '../protocol/product.js'
import { type Clock, systemClock } from './clock.js'
import {
  assertProjectAggregate, projectSummaryOf, projectViewOf, sourceViewOf, markdownViewOf, type ProjectSummary,
} from './project-views.js'
import { hashProjectCommandRequest, receiptFor, rejectProjectCommand, replayReceipt, replayTombstone } from './receipts.js'

type CommandOf<K extends ProjectCommand['payload']['kind']> = Omit<ProjectCommand, 'payload'> & {
  readonly payload: Extract<ProjectCommand['payload'], { kind: K }>
}
export type CreateProjectCommand = CommandOf<'project.create'>
export type DeleteProjectCommand = CommandOf<'project.delete'>
export type ExistingProjectCommand = CommandOf<Exclude<ProjectCommand['payload']['kind'], 'project.create' | 'project.delete'>>

export interface ProjectRepository {
  list(signal?: AbortSignal): Promise<readonly ProjectSummary[]>
  /** Deleted bodies never leave the repository, including through this internal read. */
  get(projectId: ProjectId, signal?: AbortSignal): Promise<StoredProjectRecord | undefined>
  create(command: CreateProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome>
  mutate(command: ExistingProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome>
  deleteProject(command: DeleteProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome>
  close(): Promise<void>
}

export interface ProjectRepositoryDependencies {
  readonly engine: InsightEngine
  readonly sha256Utf8: (value: string) => Sha256Hex
  readonly clock?: Clock
  readonly newId?: () => string
  readonly renderer?: PrdRenderer
}

type PreparedMutation = {
  readonly candidate?: ActiveProjectRecord
  readonly error?: ProjectBusinessErrorCode
  readonly outcome: ProjectCommandOutcome
}

/** Returning current from a table transform would still write. Throw to abandon admission instead. */
class WithoutWrite extends Error {
  constructor(readonly outcome: ProjectCommandOutcome) { super('without-write') }
}

function bodyIdentity(record: ActiveProjectRecord): string {
  return canonicalJson({ ...record, commandReceipts: [] })
}

function businessCode(error: unknown): ProjectBusinessErrorCode | undefined {
  if (!(error instanceof Error)) return undefined
  if (PROJECT_BUSINESS_ERROR_CODES.some(code => code === error.message)) return error.message as ProjectBusinessErrorCode
  if (error.message === 'invalid-analysis-candidate' || error.message === 'invalid-source') return 'invalid-evidence'
  return undefined
}

/** Input-less parsing is confined to Host candidate preflight, never actual responses. */
export function assertProjectReadable(project: ActiveProjectRecord): void {
  assertProjectAggregate(project)
  parseProductOutcome('projects.list', { status: 'accepted', value: [projectSummaryOf(project)] })
  parseProductOutcome('projects.get', { status: 'accepted', value: projectViewOf(project) })
  if (project.source) parseProductOutcome('sources.get', { status: 'accepted', value: sourceViewOf(project, project.source.id) })
  for (const prd of project.prdRevisions) {
    parseProductOutcome('artifacts.getMarkdown', { status: 'accepted', value: markdownViewOf(project, prd.id) })
  }
}

/** A single Host-owned repository is the exclusive writer of this table.
 * Create/delete acquire membership first, then project; mutations only acquire project.
 * The backend's update callback is synchronous and may run later than invocation.
 */
export class TableProjectRepository implements ProjectRepository {
  readonly #table: KvTable<ProjectId, StoredProjectRecord>
  readonly #clock: Clock
  readonly #newId: () => string
  readonly #renderer: PrdRenderer
  readonly #dependencies: ProjectRepositoryDependencies
  readonly #projects = new Map<ProjectId, Promise<void>>()
  readonly #pending = new Set<Promise<unknown>>()
  #membership: Promise<void> = Promise.resolve()
  #closing = false
  #closed: Promise<void> | undefined

  constructor(table: KvTable<ProjectId, StoredProjectRecord>, dependencies: ProjectRepositoryDependencies) {
    this.#table = table
    this.#dependencies = dependencies
    this.#clock = dependencies.clock ?? systemClock
    this.#newId = dependencies.newId ?? randomUUID
    this.#renderer = dependencies.renderer ?? new DeterministicPrdRenderer(dependencies.sha256Utf8)
  }

  async list(signal?: AbortSignal): Promise<readonly ProjectSummary[]> {
    this.#assertReadable(signal)
    const summaries = [...this.#table.entries()].flatMap(([, record]) => record.kind === 'active' ? [projectSummaryOf(record)] : [])
    summaries.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)
      || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))
    return deepFreeze(summaries)
  }

  async get(projectId: ProjectId, signal?: AbortSignal): Promise<StoredProjectRecord | undefined> {
    this.#assertReadable(signal)
    const record = this.#table.get(projectId)
    return record?.kind === 'active' ? deepFreeze(structuredClone(record)) : undefined
  }

  create(command: CreateProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    return this.#submit(command, 'create', signal)
  }

  mutate(command: ExistingProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    return this.#submit(command, 'mutate', signal)
  }

  deleteProject(command: DeleteProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    return this.#submit(command, 'delete', signal)
  }

  close(): Promise<void> {
    if (!this.#closed) {
      this.#closing = true
      // The Host owns the storage domain. Drain repository work before Host closes it.
      this.#closed = Promise.allSettled([...this.#pending]).then(() => undefined)
    }
    return this.#closed
  }

  #assertReadable(signal?: AbortSignal): void {
    if (this.#closing || signal?.aborted) throw new Error('cancelled')
  }

  async #submit(input: ProjectCommand, operation: 'create' | 'mutate' | 'delete', signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    const command = parseProductInput('projects.command', input)
    if ((operation === 'create') !== (command.payload.kind === 'project.create')
      || (operation === 'delete') !== (command.payload.kind === 'project.delete')) throw new Error('invalid-repository-command')
    if (this.#closing || signal?.aborted) return rejectProjectCommand(command, 'cancelled')
    const requestHash = hashProjectCommandRequest(command, this.#dependencies.sha256Utf8)
    const inProject = () => this.#enqueueProject(command.projectId, () => this.#execute(command, requestHash, signal))
    let pending: Promise<ProjectCommandOutcome>
    if (operation === 'mutate') pending = inProject()
    else {
      pending = this.#membership.then(inProject)
      this.#membership = pending.then(() => undefined, () => undefined)
    }
    this.#pending.add(pending)
    void pending.then(() => this.#pending.delete(pending), () => this.#pending.delete(pending))
    return parseProductOutcome('projects.command', await pending, command)
  }

  #enqueueProject<T>(projectId: ProjectId, operation: () => Promise<T>): Promise<T> {
    const pending = (this.#projects.get(projectId) ?? Promise.resolve()).then(operation)
    const tail = pending.then(() => undefined, () => undefined)
    this.#projects.set(projectId, tail)
    void tail.then(() => { if (this.#projects.get(projectId) === tail) this.#projects.delete(projectId) })
    return pending
  }

  #replay(record: StoredProjectRecord, command: ProjectCommand, hash: Sha256Hex): ProjectCommandOutcome | undefined {
    if (record.kind === 'deleted') return replayTombstone(command, hash, record)
    const receipts = record.commandReceipts.filter(receipt => receipt.commandId === command.commandId)
    if (receipts.length > 1) throw new Error('invalid-receipt-record')
    return receipts[0] ? replayReceipt(command, hash, receipts[0]) : undefined
  }

  #precondition(record: ActiveProjectRecord, command: ProjectCommand): ProjectBusinessErrorCode | undefined {
    if (command.payload.kind !== 'project.delete' && record.commandReceipts.length >= MAX_COMMAND_RECEIPTS_PER_PROJECT) {
      return 'receipt-capacity-reached'
    }
    // A content change invalidates the original confirmation, even if the Client supplied its older CAS.
    if (command.payload.kind === 'baseline.publish' || command.payload.kind === 'prd.render') {
      if (command.payload.confirmedContentVersion !== record.header.contentVersion) return 'baseline-stale'
    }
    if (command.payload.kind === 'prd.render') {
      const baselineId = command.payload.baselineId
      const baseline = record.baselines.find(item => item.id === baselineId)
      if (!baseline || record.currentBaselineId !== baselineId || baseline.contentVersion !== record.header.contentVersion) return 'baseline-stale'
    }
    if (command.expectedVersion !== record.header.projectVersion) return 'version-conflict'
    if (record.header.projectVersion === Number.MAX_SAFE_INTEGER) return 'limit-exceeded'
    return undefined
  }

  async #execute(command: ProjectCommand, hash: Sha256Hex, signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    if (signal?.aborted) return rejectProjectCommand(command, 'cancelled')
    let stored: StoredProjectRecord | undefined
    try { stored = this.#table.get(command.projectId) }
    catch { return rejectProjectCommand(command, 'storage-failed') }
    if (stored) {
      const replay = this.#replay(stored, command, hash)
      if (replay) return replay
    }
    if (!stored) {
      return command.payload.kind === 'project.create'
        ? this.#create(command as CreateProjectCommand, hash, signal)
        : rejectProjectCommand(command, 'not-found')
    }
    if (stored.kind !== 'active') return rejectProjectCommand(command, 'project-deleted')
    const record = deepFreeze(structuredClone(stored))
    const precondition = this.#precondition(record, command)
    if (precondition === 'receipt-capacity-reached' || precondition === 'limit-exceeded') return rejectProjectCommand(command, precondition)
    if (command.payload.kind === 'project.delete' && !precondition) return this.#delete(record, command, hash, signal)

    let prepared: PreparedMutation
    try {
      prepared = precondition
        ? { error: precondition, outcome: rejectProjectCommand(command, precondition) }
        : await this.#prepare(record, command, signal ?? new AbortController().signal)
    } catch (error) {
      if (signal?.aborted) return rejectProjectCommand(command, 'cancelled')
      const code = businessCode(error)
      if (!code) throw error
      prepared = { error: code, outcome: rejectProjectCommand(command, code) }
    }
    if (signal?.aborted) return rejectProjectCommand(command, 'cancelled')
    if (prepared.error === 'limit-exceeded') return prepared.outcome
    return this.#commit(record, command, hash, prepared, signal)
  }

  async #create(command: CreateProjectCommand, hash: Sha256Hex, signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    const rows = [...this.#table.entries()]
    if (rows.filter(([, record]) => record.kind === 'deleted').length >= MAX_TOMBSTONES_BEFORE_CREATE_BLOCKED
      || rows.length >= MAX_PROJECT_ROWS) return rejectProjectCommand(command, 'limit-exceeded')
    if (rows.filter(([, record]) => record.kind === 'active').length >= MAX_ACTIVE_PROJECTS) return rejectProjectCommand(command, 'project-limit-reached')
    const outcome = this.#accepted(command, { projectVersion: 1, contentVersion: 0 })
    const candidate: ActiveProjectRecord = {
      kind: 'active', schemaVersion: 1,
      header: { id: command.projectId, name: command.payload.name, researchGoal: command.payload.researchGoal,
        projectVersion: 1, contentVersion: 0, reviewStarted: false, updatedAt: this.#clock.now() },
      source: null, analyses: [], currentAnalysisRevisionId: null, evidence: [], generatedRequirements: [],
      humanRevisions: [], humanDecisions: [], requirementOrder: [], baselines: [], currentBaselineId: null,
      prdRevisions: [], commandReceipts: [receiptFor(command, hash, outcome)],
    }
    try { this.#validateCandidate(candidate) }
    catch { return rejectProjectCommand(command, 'limit-exceeded') }
    if (signal?.aborted) return rejectProjectCommand(command, 'cancelled')
    // There is no await between the membership-protected absence check and put admission.
    if (this.#table.get(command.projectId) !== undefined) return rejectProjectCommand(command, 'version-conflict')
    try { await this.#table.put(command.projectId, deepFreeze(structuredClone(candidate))) }
    catch { return rejectProjectCommand(command, 'storage-failed') }
    return outcome
  }

  #accepted(command: ProjectCommand, value: Extract<ProjectCommandOutcome, { status: 'accepted' }>['value']): ProjectCommandOutcome {
    return parseProductOutcome('projects.command', { status: 'accepted', projectId: command.projectId, commandId: command.commandId, value }, command)
  }

  async #prepare(record: ActiveProjectRecord, command: ProjectCommand, signal: AbortSignal): Promise<PreparedMutation> {
    const payload = command.payload
    const fail = (code: ProjectBusinessErrorCode): never => { throw new Error(code) }
    let candidate = record
    let contentChanged = false
    let identities: Partial<Extract<ProjectCommandOutcome, { status: 'accepted' }>['value']> = {}
    switch (payload.kind) {
      case 'project.create':
      case 'project.delete': return { error: 'version-conflict', outcome: rejectProjectCommand(command, 'version-conflict') }
      case 'source.importText': {
        if (record.source) fail('source-locked')
        const syntheticDataAttested = payload.syntheticDataAttested === true || payload.dataClassification === 'synthetic'
        const source = validatePersistedSource({ id: sourceRevisionIdSchema.parse(this.#newId()), projectId: record.header.id,
          revision: 1, displayName: payload.displayName, format: payload.format, text: payload.text,
          utf8Bytes: utf8ByteLength(payload.text), contentHash: this.#dependencies.sha256Utf8(payload.text), syntheticDataAttested }, this.#dependencies.sha256Utf8)
        candidate = { ...record, source }
        contentChanged = true
        identities = { sourceRevisionId: source.id }
        break
      }
      case 'analysis.runFixture':
      case 'analysis.runHarnessModel': {
        if (record.header.reviewStarted || record.baselines.length || record.prdRevisions.length) fail('analysis-already-reviewed')
        if (!record.source || record.source.id !== payload.sourceRevisionId) fail('not-found')
        const input = deepFreeze({ mode: payload.kind === 'analysis.runHarnessModel' ? 'harness-model' as const : 'fixture' as const,
          projectId: record.header.id, source: record.source!, researchGoal: record.header.researchGoal,
          analysisRevisionId: analysisRevisionIdSchema.parse(this.#newId()),
          generation: Math.max(0, ...record.analyses.map(item => item.generation)) + 1,
          baseProjectVersion: record.header.projectVersion })
        const analysed = await this.#dependencies.engine.analyse(input, signal)
        validateAnalysisCandidate(input, analysed, this.#dependencies.sha256Utf8)
        const expectedKind = payload.kind === 'analysis.runHarnessModel' ? 'harness-model' : 'fixture'
        if (analysed.analysis.kind !== expectedKind) fail('invalid-evidence')
        candidate = { ...record, analyses: [...record.analyses.map(item => ({ ...item, status: 'superseded' as const })), analysed.analysis],
          currentAnalysisRevisionId: analysed.analysis.id, evidence: analysed.evidence, generatedRequirements: analysed.generatedRequirements,
          humanRevisions: [], humanDecisions: analysed.generatedRequirements.map(draft => ({ requirementId: draft.requirementId,
            selectedText: { kind: 'generated', draftId: draft.id }, priority: draft.suggestedPriority, decision: 'pending', humanReason: '' })),
          requirementOrder: analysed.generatedRequirements.map(draft => draft.requirementId) }
        identities = { analysisRevisionId: analysed.analysis.id }
        contentChanged = true
        break
      }
      case 'requirement.update': {
        const { kind: _kind, ...update } = payload
        const editsText = update.title !== undefined || update.painPoint !== undefined || update.description !== undefined
        candidate = applyRequirementUpdate(record, { ...update,
          ...(editsText ? { humanRevisionId: requirementRevisionIdSchema.parse(this.#newId()) } : {}) },
        { sha256Utf8: this.#dependencies.sha256Utf8 })
        contentChanged = true
        break
      }
      case 'requirements.reorder':
        candidate = applyRequirementOrder(record, payload.requirementIds)
        contentChanged = true
        break
      case 'baseline.publish': {
        if (record.baselines.length >= MAX_BASELINES_PER_PROJECT) fail('limit-exceeded')
        const baseline = publishRequirementBaseline(record, { baselineId: baselineIdSchema.parse(this.#newId()),
          createdAt: this.#clock.now(), sha256Utf8: this.#dependencies.sha256Utf8 })
        candidate = { ...record, header: { ...record.header, reviewStarted: true },
          baselines: [...record.baselines, baseline], currentBaselineId: baseline.id }
        identities = { baselineId: baseline.id }
        break
      }
      case 'prd.render': {
        if (record.prdRevisions.length >= MAX_PRD_REVISIONS_PER_PROJECT) fail('limit-exceeded')
        const baseline = record.baselines.find(item => item.id === payload.baselineId) ?? fail('baseline-stale')
        const prdRevisionId = prdRevisionIdSchema.parse(this.#newId())
        const rendered = this.#renderer.render({ baseline, prdRevisionId, createdAt: this.#clock.now(),
          currentBaselineId: record.currentBaselineId!, currentContentVersion: payload.confirmedContentVersion,
          existingPrdCount: record.prdRevisions.length }, signal)
        // Own synchronous results before yielding; async renderers must return their completed snapshot.
        const prd = structuredClone(rendered instanceof Promise ? await rendered : rendered)
        if (prd.id !== prdRevisionId || prd.baselineId !== baseline.id
          || prd.baselineContentVersion !== baseline.contentVersion || prd.projectId !== record.header.id
          || prd.sourceRevisionId !== record.source?.id
          || prd.contentHash !== this.#dependencies.sha256Utf8(prd.markdown)) fail('invalid-evidence')
        candidate = { ...record, header: { ...record.header, reviewStarted: true }, prdRevisions: [...record.prdRevisions, prd] }
        identities = { baselineId: baseline.id, prdRevisionId: prd.id }
        break
      }
    }
    candidate = { ...candidate, header: { ...candidate.header, projectVersion: record.header.projectVersion + 1,
      contentVersion: record.header.contentVersion + (contentChanged ? 1 : 0), updatedAt: this.#clock.now() } }
    return { candidate: deepFreeze(structuredClone(candidate)), outcome: this.#accepted(command, {
      projectVersion: candidate.header.projectVersion, contentVersion: candidate.header.contentVersion, ...identities,
    }) }
  }

  #validateCandidate(candidate: ActiveProjectRecord): void {
    assertProjectReadable(candidate)
    const active = [...this.#table.entries()].flatMap(([id, record]) =>
      id !== candidate.header.id && record.kind === 'active' ? [record] : [])
    active.push(candidate)
    if (active.length > MAX_ACTIVE_PROJECTS
      || active.reduce((sum, record) => sum + canonicalJsonUtf8Bytes(record), 0) > MAX_PROFILE_ACTIVE_RECORD_UTF8_BYTES) throw new Error('limit-exceeded')
    parseProductOutcome('projects.list', { status: 'accepted', value: active.map(projectSummaryOf) })
  }

  #receipted(current: ActiveProjectRecord, command: ProjectCommand, hash: Sha256Hex, prepared: PreparedMutation): ActiveProjectRecord {
    const candidate = { ...(prepared.candidate ?? current), commandReceipts: [...current.commandReceipts, receiptFor(command, hash, prepared.outcome)] }
    this.#validateCandidate(candidate)
    return deepFreeze(structuredClone(candidate))
  }

  async #commit(record: ActiveProjectRecord, command: ProjectCommand, hash: Sha256Hex,
    prepared: PreparedMutation, signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    if (record.commandReceipts.length >= MAX_COMMAND_RECEIPTS_PER_PROJECT) {
      return command.payload.kind === 'project.delete' ? prepared.outcome : rejectProjectCommand(command, 'receipt-capacity-reached')
    }
    try { this.#receipted(record, command, hash, prepared) }
    catch { return rejectProjectCommand(command, 'limit-exceeded') }
    const identity = bodyIdentity(record)
    let outcome = prepared.outcome
    let callbackFailure: unknown
    try {
      await this.#table.update(command.projectId, current => {
        try {
          if (signal?.aborted) throw new WithoutWrite(rejectProjectCommand(command, 'cancelled'))
          const replay = this.#replay(current, command, hash)
          if (replay) throw new WithoutWrite(replay)
          if (current.kind !== 'active') throw new WithoutWrite(rejectProjectCommand(command, 'project-deleted'))
          let code = this.#precondition(current, command)
          if (!code && bodyIdentity(current) !== identity) code = 'version-conflict'
          if (code === 'receipt-capacity-reached' || code === 'limit-exceeded') throw new WithoutWrite(rejectProjectCommand(command, code))
          const atSlot = code ? { error: code, outcome: rejectProjectCommand(command, code) } : prepared
          outcome = parseProductOutcome('projects.command', atSlot.outcome, command)
          try { return this.#receipted(current, command, hash, atSlot) }
          catch { throw new WithoutWrite(rejectProjectCommand(command, 'limit-exceeded')) }
        } catch (error) { callbackFailure = error; throw error }
      })
    } catch (error) {
      if (error instanceof WithoutWrite) return error.outcome
      if (callbackFailure !== undefined) throw callbackFailure
      return rejectProjectCommand(command, 'storage-failed')
    }
    return outcome
  }

  async #delete(record: ActiveProjectRecord, command: ProjectCommand, hash: Sha256Hex, signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    const outcome = this.#accepted(command, { projectVersion: record.header.projectVersion + 1 })
    const tombstone: StoredProjectRecord = { kind: 'deleted', schemaVersion: 1, projectId: command.projectId,
      deletedAt: this.#clock.now(), deleteCommandId: command.commandId, deleteRequestHash: hash,
      deleteOutcome: { ok: true, projectVersion: record.header.projectVersion + 1 } }
    assertStoredRecordBudget(tombstone)
    const identity = bodyIdentity(record)
    let result = outcome
    let callbackFailure: unknown
    try {
      await this.#table.update(command.projectId, current => {
        try {
          if (signal?.aborted) throw new WithoutWrite(rejectProjectCommand(command, 'cancelled'))
          const replay = this.#replay(current, command, hash)
          if (replay) throw new WithoutWrite(replay)
          if (current.kind !== 'active') throw new WithoutWrite(rejectProjectCommand(command, 'project-deleted'))
          const code = this.#precondition(current, command) ?? (bodyIdentity(current) !== identity ? 'version-conflict' : undefined)
          if (code) {
            result = rejectProjectCommand(command, code)
            if (code === 'limit-exceeded' || current.commandReceipts.length >= MAX_COMMAND_RECEIPTS_PER_PROJECT) throw new WithoutWrite(result)
            try { return this.#receipted(current, command, hash, { error: code, outcome: result }) }
            catch { throw new WithoutWrite(rejectProjectCommand(command, 'limit-exceeded')) }
          }
          assertStoredRecordBudget(tombstone)
          parseProductOutcome('projects.command', outcome, command)
          return deepFreeze(structuredClone(tombstone))
        } catch (error) { callbackFailure = error; throw error }
      })
    } catch (error) {
      if (error instanceof WithoutWrite) return error.outcome
      if (callbackFailure !== undefined) throw callbackFailure
      return rejectProjectCommand(command, 'storage-failed')
    }
    return result
  }
}
