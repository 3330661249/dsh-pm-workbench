import { expect, it, vi } from 'vitest'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { readMaterialDraft } from '../../packages/workbench/src/client/workbench/material-input.js'
import { createWorkbenchStore } from '../../packages/workbench/src/client/workbench/store.js'
import { ConnectionRpcWorkbenchTransport, type Stage3aProjectCommand } from '../../packages/workbench/src/client/workbench/transport.js'
import { WorkbenchBrowserPort } from '../../packages/workbench/src/client/workbench/browser-port.js'
import { ProjectService } from '../../packages/workbench/src/application/project-service.js'
import { TableProjectRepository } from '../../packages/workbench/src/application/project-repository.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { FixtureInsightEngine } from '../../packages/workbench/src/analysis/fixture-engine.js'
import { BUILT_IN_SYNTHETIC_TEXT, FIXTURE_MANIFEST } from '../../packages/workbench/src/analysis/fixture-manifest.js'
import { PRODUCT_API_VERSION, PRODUCT_CAPABILITIES, parseProductInput, type StrictProjectCommandPayload } from '../../packages/workbench/src/protocol/product.js'
import type { ActiveProjectRecord, StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import type { ProjectId } from '../../packages/workbench/src/domain/ids.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import { makeSmallActiveRecord, SMALL_PROJECT_ID, OTHER_PROJECT_ID } from './helpers/synthetic-records.js'
const api = { apiVersion: PRODUCT_API_VERSION }
const uuid = (n: number) => `20000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
function deferred<T = void>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
async function setup() {
  const table = createFakeDomainTable<ProjectId, StoredProjectRecord>([[SMALL_PROJECT_ID, makeSmallActiveRecord()], [OTHER_PROJECT_ID, makeSmallActiveRecord({ projectId: OTHER_PROJECT_ID })]])
  let hostId = 1000, clientId = 3000
  const service = new ProjectService(new TableProjectRepository(table, {
    engine: new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8), sha256Utf8: nodeSha256Utf8,
    clock: { now: () => '2026-09-07T08:00:00.000Z' }, newId: () => uuid(hostId++),
  }))
  const record = () => table.get(SMALL_PROJECT_ID) as ActiveProjectRecord
  const external = (payload: StrictProjectCommandPayload) => service.command({ ...api, projectId: SMALL_PROJECT_ID, expectedVersion: record().header.projectVersion, commandId: uuid(clientId++), payload })
  await external({ kind: 'source.importText', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt', format: 'pasted', syntheticDataAttested: true })
  await external({ kind: 'analysis.runFixture', sourceRevisionId: record().source!.id })
  const commands: Stage3aProjectCommand[] = []
  let intercept: ((endpoint: string, input: unknown, next: () => Promise<unknown>) => Promise<unknown>) | undefined
  const call: ClientConnectionRpc['call'] = async (_channel, endpoint, input) => {
    if (endpoint === 'projects.command') commands.push(input as Stage3aProjectCommand)
    const next = async () => ({ ok: true, value: endpoint === 'health' ? { status: 'accepted', value: PRODUCT_CAPABILITIES }
      : endpoint === 'projects.list' ? await service.list(input)
      : endpoint === 'projects.get' ? await service.get(input)
      : endpoint === 'sources.get' ? await service.getSource(input)
      : endpoint === 'artifacts.getMarkdown' ? await service.getMarkdown(input) : await service.command(input) })
    return (intercept ? await intercept(endpoint, input, next) : await next()) as Awaited<ReturnType<ClientConnectionRpc['call']>>
  }
  const browser = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: () => 'owned', clickDownload: () => {}, revokeObjectURL: () => {} })
  const t = new ConnectionRpcWorkbenchTransport({ call })
  const ids = { createCommandId: vi.fn(() => uuid(clientId++)), createProjectId: () => uuid(clientId++) }
  const store = createWorkbenchStore(t, ids, browser)
  await store.open(); await store.selectProject(SMALL_PROJECT_ID)
  return { store, t, ids, commands, service, external, record, requirementId: record().requirementOrder[0]!,
    intercept: (fn?: typeof intercept) => { intercept = fn } }
}
it('serializes text, priority, decision, reason and reorder intents using each accepted version', async () => {
  const h = await setup()
  h.store.editRequirement(h.requirementId, { title: '人工标题' })
  h.store.editRequirement(h.requirementId, { priority: 'low', decision: 'include', humanReason: '核对原文' })
  h.store.reorderRequirements([h.requirementId])
  expect(h.store.getConfirmationSnapshot()).toEqual({ ok: false, reason: 'unsaved' })
  const result = await h.store.flushProjectEdits()
  expect(result.ok).toBe(true)
  expect(h.commands.map(c => c.expectedVersion)).toEqual([3, 4, 5])
  expect(h.commands.every(c => !('humanRevisionId' in c.payload))).toBe(true)
  expect(h.store.getSnapshot()).toMatchObject({ dirty: false, saveState: 'saved', selectedProject: { header: { projectVersion: 6, contentVersion: 5 }, selectedHumanRevisions: [{ title: '人工标题' }] } })
  expect(h.store.getConfirmationSnapshot()).toMatchObject({ ok: true, projectVersion: 6, contentVersion: 5 })
})
it('captures the flush revision; an older save never consumes or waits for a newer edit', async () => {
  const h = await setup(); const gate = deferred(); const entered = deferred()
  h.intercept(async (endpoint, _input, next) => { if (endpoint === 'projects.command') { entered.resolve(); await gate.promise } return next() })
  h.store.editRequirement(h.requirementId, { title: '第一次修改' }); const first = h.store.flushProjectEdits()
  await entered.promise
  expect(h.store.getConfirmationSnapshot()).toEqual({ ok: false, reason: 'saving' })
  h.store.editRequirement(h.requirementId, { title: '第二次修改' }); gate.resolve()
  expect((await first).ok).toBe(true)
  expect(h.commands).toHaveLength(1)
  expect(h.store.getSnapshot()).toMatchObject({ dirty: true, saveState: 'unsaved', drafts: [{ payload: { title: '第二次修改' } }] })
  await h.store.flushProjectEdits(); expect(h.commands.map(c => c.expectedVersion)).toEqual([3, 4])
})
it('does not enter saving until the Connection invocation is admitted', async () => {
  const h = await setup(); const gate = deferred()
  h.intercept(async (endpoint, _input, next) => { if (endpoint === 'health') await gate.promise; return next() })
  const reads = Array.from({ length: 8 }, () => h.t.health()); await tick()
  h.store.editRequirement(h.requirementId, { title: '排队修改' }); const flush = h.store.flushProjectEdits(); await tick()
  expect(h.store.getSnapshot().saveState).toBe('unsaved'); expect(h.commands).toHaveLength(0)
  gate.resolve(); await Promise.all(reads); await flush; expect(h.commands).toHaveLength(1)
})
it.each(['lower', 'wrong', 'failed'] as const)('accepted receipt waits for correlated read-back at its floor: %s', async mode => {
  const h = await setup(); const old = await h.service.get({ ...api, projectId: SMALL_PROJECT_ID })
  h.intercept(async (endpoint, _input, next) => endpoint === 'projects.get'
    ? mode === 'failed' ? { ok: false, error: { code: 'internal', message: 'private', details: {} } }
      : { ok: true, value: mode === 'lower' ? old : await h.service.get({ ...api, projectId: OTHER_PROJECT_ID }) }
    : next())
  h.store.editRequirement(h.requirementId, { title: '已接受但还未读回' })
  expect(await h.store.flushProjectEdits()).toMatchObject({ ok: false })
  expect(h.store.getSnapshot()).toMatchObject({ dirty: true, saveState: 'failed', acceptedVersionFloor: 4 })
  expect(h.store.getConfirmationSnapshot()).toEqual({ ok: false, reason: 'failed' })
  h.intercept(); await h.store.refresh()
  expect(h.commands).toHaveLength(1)
  expect(h.store.getSnapshot()).toMatchObject({ dirty: false, saveState: 'saved', selectedProject: { header: { projectVersion: 4 } } })
})
it.each(['cancelled', 'carrier', 'malformed', 'throw'] as const)('keeps immutable exact retry after admitted %s and refresh never resolves uncertainty', async mode => {
  const h = await setup()
  h.intercept(async (endpoint, input, next) => {
    if (endpoint !== 'projects.command') return next()
    await next(); const command = input as Stage3aProjectCommand
    if (mode === 'throw') throw new Error('lost')
    if (mode === 'malformed') return { ok: true, value: {} }
    if (mode === 'carrier') return { ok: false, error: { code: 'internal', message: 'private', details: {} } }
    return { ok: true, value: { status: 'rejected', projectId: command.projectId, commandId: command.commandId, error: { code: 'cancelled' } } }
  })
  h.store.editRequirement(h.requirementId, { title: '精确重试' }); h.store.editRequirement(h.requirementId, { priority: 'high' })
  await h.store.flushProjectEdits()
  const retry = h.store.getSnapshot().pendingRetry!
  expect(h.store.getSnapshot()).toMatchObject({ saveState: 'uncertain', dirty: true })
  expect(Object.isFrozen(retry)).toBe(true); expect(Object.isFrozen(retry.payload)).toBe(true)
  expect(h.commands).toHaveLength(1)
  h.intercept(); await h.store.refresh()
  expect(h.store.getSnapshot().pendingRetry).toBe(retry)
  expect(h.store.getConfirmationSnapshot()).toEqual({ ok: false, reason: 'uncertain' })
  await h.store.retryUncertain()
  expect(h.commands[1]).toEqual(retry); expect(h.ids.createCommandId).toHaveBeenCalledTimes(1)
  await h.store.flushProjectEdits(); expect(h.commands.map(c => c.expectedVersion)).toEqual([3, 3, 4])
  expect(h.store.getSnapshot()).toMatchObject({ saveState: 'saved', pendingRetry: undefined, dirty: false })
})
it('business rejection retains drafts and stops dependents; conflict refresh never rebases the failed command', async () => {
  const h = await setup()
  h.store.editRequirement(h.requirementId, { title: '保留草稿' }); h.store.editRequirement(h.requirementId, { priority: 'low' })
  await h.external({ kind: 'requirement.update', requirementId: h.requirementId, title: '外部修改' })
  expect(await h.store.flushProjectEdits()).toMatchObject({ ok: false, code: 'version-conflict' })
  expect(h.commands).toHaveLength(1)
  expect(h.store.getSnapshot()).toMatchObject({ saveState: 'failed', dirty: true, drafts: [{ payload: { title: '保留草稿' } }, { payload: { priority: 'low' } }] })
  await h.store.refresh(); await h.store.flushProjectEdits()
  expect(h.commands).toHaveLength(1); expect(h.store.getConfirmationSnapshot().ok).toBe(false)
})
it('ordinary lower-version receipt replay never lowers newer authority', async () => {
  const h = await setup()
  h.intercept(async (endpoint, _input, next) => { const result = await next(); if (endpoint === 'projects.command') throw new Error('lost'); return result })
  h.store.editRequirement(h.requirementId, { title: '本地已提交' }); await h.store.flushProjectEdits()
  await h.external({ kind: 'requirement.update', requirementId: h.requirementId, humanReason: '新的外部编辑' })
  h.intercept(); await h.store.refresh(); expect(h.store.getSnapshot().selectedProject!.header.projectVersion).toBe(5)
  await h.store.retryUncertain(); expect(h.store.getSnapshot().selectedProject!.header.projectVersion).toBe(5)
})
it('refuses blocked selection and ignores stale clean-selection reads', async () => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { title: '未保存' })
  expect(await h.store.selectProject(OTHER_PROJECT_ID)).toEqual({ ok: false, code: 'project-switch-blocked' })
  await h.store.flushProjectEdits()
  const gate = deferred(); const entered = deferred()
  h.intercept(async (endpoint, input, next) => { const result = await next(); if (endpoint === 'projects.get' && (input as any).projectId === SMALL_PROJECT_ID) { entered.resolve(); await gate.promise } return result })
  const stale = h.store.refresh(); await entered.promise
  expect(await h.store.selectProject(OTHER_PROJECT_ID)).toMatchObject({ ok: true })
  gate.resolve(); await stale; expect(h.store.getSnapshot().selectedProject!.header.id).toBe(OTHER_PROJECT_ID)
})
it('close retains draft and uncertain command, reopen refreshes without duplicate listeners, dispose clears memory', async () => {
  const h = await setup(); const gate = deferred(); const entered = deferred()
  const listener = vi.fn(); const unsubscribe = h.store.subscribe(listener)
  h.intercept(async (endpoint, _input, next) => { const result = await next(); if (endpoint === 'projects.command') { entered.resolve(); await gate.promise } return result })
  h.store.editRequirement(h.requirementId, { title: '关闭时保留' }); const flush = h.store.flushProjectEdits(); await entered.promise
  h.store.close(); const retry = h.store.getSnapshot().pendingRetry
  expect(retry).toBeDefined(); expect(h.store.getSnapshot()).toMatchObject({ isOpen: false, saveState: 'uncertain', dirty: true })
  gate.resolve(); await flush; expect(h.store.getSnapshot().pendingRetry).toBe(retry)
  h.intercept(); await h.store.open(); expect(h.store.getSnapshot().pendingRetry).toBe(retry)
  unsubscribe(); const calls = listener.mock.calls.length
  await h.store.retryUncertain(); expect(listener).toHaveBeenCalledTimes(calls)
  h.store.dispose(); expect(h.store.getSnapshot()).toMatchObject({ isOpen: false, selectedProject: undefined, drafts: [], pendingRetry: undefined })
  expect(await h.store.open()).toEqual({ ok: false, code: 'disposed' })
})
it('close before global admission sends nothing and retains the unsent draft', async () => {
  const h = await setup(); const gate = deferred()
  h.intercept(async (endpoint, _input, next) => { if (endpoint === 'health') await gate.promise; return next() })
  const reads = Array.from({ length: 8 }, () => h.t.health()); await tick()
  h.store.editRequirement(h.requirementId, { title: '未发送' }); const flush = h.store.flushProjectEdits(); await tick(); h.store.close()
  await flush; expect(h.commands).toHaveLength(0); expect(h.store.getSnapshot()).toMatchObject({ dirty: true, saveState: 'unsaved', pendingRetry: undefined })
  gate.resolve(); await Promise.all(reads)
})
it('publishes and renders two distinct commands with Host-returned IDs, frozen content and refreshed PRD status', async () => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { decision: 'include' }); await h.store.flushProjectEdits()
  const confirmed = h.store.getConfirmationSnapshot(); expect(confirmed).toMatchObject({ ok: true, projectVersion: 4, contentVersion: 3 })
  const baseline = await h.store.publishConfirmedBaseline(h.store.getConfirmationSnapshot()); expect(baseline).toMatchObject({ ok: true, projectVersion: 5 })
  if (!baseline.ok) throw new Error('baseline failed')
  expect(h.store.getSnapshot().baselineChain).toEqual({ projectId: SMALL_PROJECT_ID, baselineId: baseline.baselineId, confirmedContentVersion: 3, acceptedProjectVersion: 5 })
  const prd = await h.store.renderPublishedBaseline()
  expect(prd).toMatchObject({ ok: true, projectVersion: 6, baselineId: baseline.baselineId, current: true })
  expect(h.commands.slice(-2).map(c => [c.expectedVersion, c.payload])).toEqual([[4, { kind: 'baseline.publish', confirmedContentVersion: 3 }], [5, { kind: 'prd.render', baselineId: baseline.baselineId, confirmedContentVersion: 3 }]])
})
it.each(['local', 'external', 'baseline-stale'] as const)('invalidates the baseline chain on %s content change and requires explicit confirmation', async mode => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { decision: 'include' }); await h.store.flushProjectEdits(); await h.store.publishConfirmedBaseline(h.store.getConfirmationSnapshot())
  if (mode === 'local') { h.store.editRequirement(h.requirementId, { title: '新标题' }); await h.store.flushProjectEdits() }
  else { await h.external({ kind: 'requirement.update', requirementId: h.requirementId, humanReason: '新的理由' }); if (mode === 'external') await h.store.refresh() }
  expect(await h.store.renderPublishedBaseline()).toMatchObject({ ok: false, code: 'baseline-stale' })
  expect(h.store.getSnapshot().baselineChain).toBeUndefined()
  expect(h.store.getConfirmationSnapshot().ok).toBe(false)
  expect(h.store.getSnapshot().selectedProject!.header.contentVersion).toBe(4)
  expect(await h.store.publishConfirmedBaseline(h.store.prepareConfirmation())).toMatchObject({ ok: true })
})
it('blocks immediate confirmation before flush, after failed save and during admitted save', async () => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { title: '等待保存' })
  expect(await h.store.publishConfirmedBaseline(h.store.getConfirmationSnapshot())).toMatchObject({ ok: false, code: 'unsaved' })
  expect(h.commands).toHaveLength(0)
})
it('creation requires its own literal attestation even when material has import attestation', async () => {
  const h = await setup()
  expect(await h.store.createProject({ name: 'Synthetic new', researchGoal: null }, false)).toMatchObject({ ok: false, code: 'data-use-attestation-required' })
  expect(h.commands).toHaveLength(0)
  expect(await h.store.createProject({ name: 'Synthetic new', researchGoal: null }, true)).toMatchObject({ ok: true })
  expect(h.commands[0]).toMatchObject({ expectedVersion: 0, payload: { kind: 'project.create', dataUseAttested: true } })
})

it('rejects the displayed confirmation token after even a clean authoritative version change', async () => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { decision: 'include' }); await h.store.flushProjectEdits()
  const displayed = h.store.getConfirmationSnapshot(); expect(Object.isFrozen(displayed)).toBe(true)
  await h.external({ kind: 'requirement.update', requirementId: h.requirementId, humanReason: '外部理由' }); await h.store.refresh()
  const count = h.commands.length
  expect(await h.store.publishConfirmedBaseline(displayed)).toMatchObject({ ok: false, code: 'confirmation-stale' })
  expect(h.commands).toHaveLength(count)
  expect(await h.store.publishConfirmedBaseline({ ...h.store.prepareConfirmation() })).toMatchObject({ ok: false, code: 'confirmation-stale' })
})
it('retains accepted baseline chain across failed read-back and resumes rendering without duplicate publication', async () => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { decision: 'include' }); await h.store.flushProjectEdits()
  const displayed = h.store.getConfirmationSnapshot()
  h.intercept(async (endpoint, _input, next) => endpoint === 'projects.get' ? { ok: false, error: { code: 'internal', message: 'private', details: {} } } : next())
  expect(await h.store.publishConfirmedBaseline(displayed)).toMatchObject({ ok: false })
  const chain = h.store.getSnapshot().baselineChain; expect(chain).toMatchObject({ acceptedProjectVersion: 5, confirmedContentVersion: 3 })
  h.intercept(); await h.store.refresh()
  expect(h.store.getSnapshot().baselineChain).toBe(chain)
  expect(await h.store.renderPublishedBaseline()).toMatchObject({ ok: true, projectVersion: 6 })
  expect(h.commands.filter(c => c.payload.kind === 'baseline.publish')).toHaveLength(1)
})
it('binds PRD preview to current selection generation and authoritative summary hash', async () => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { decision: 'include' }); await h.store.flushProjectEdits()
  await h.store.publishConfirmedBaseline(h.store.getConfirmationSnapshot()); await h.store.renderPublishedBaseline()
  const first = h.record().prdRevisions[0]!
  await h.store.renderPublishedBaseline(); const second = h.record().prdRevisions[1]!
  const gate = deferred(); const entered = deferred()
  h.intercept(async (endpoint, input, next) => { const result = await next(); if (endpoint === 'artifacts.getMarkdown' && (input as any).prdRevisionId === first.id) { entered.resolve(); await gate.promise } return result })
  const pending = h.store.selectPrd(first.id); await entered.promise
  await h.store.selectPrd(second.id); gate.resolve(); await pending
  expect(h.store.getSnapshot()).toMatchObject({ selectedPrdRevisionId: second.id, selectedMarkdown: { prdRevisionId: second.id, contentHash: second.contentHash } })
  h.intercept(async (endpoint, _input, next) => { const result = await next() as any; if (endpoint === 'artifacts.getMarkdown') return { ...result, value: { ...result.value, value: { ...result.value.value, markdown: 'different', utf8Bytes: 9, contentHash: nodeSha256Utf8('different') } } }; return result })
  expect(await h.store.selectPrd(first.id)).toMatchObject({ ok: false, code: 'protocol-invalid' })
  expect(h.store.getSnapshot().selectedMarkdown).toBeUndefined()
})

it('retains unsubmitted material across close and refuses a project switch until explicit import', async () => {
  const h = await setup(); const draft = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt' })
  h.store.setMaterialDraft(draft, false)
  expect(h.store.getConfirmationSnapshot()).toMatchObject({ ok: false, reason: 'unsaved' })
  expect(await h.store.selectProject(OTHER_PROJECT_ID)).toMatchObject({ ok: false, code: 'project-switch-blocked' })
  h.store.close(); await h.store.open(); expect(h.store.getSnapshot().materialDraft).toBe(draft)
  expect(await h.store.importMaterial()).toMatchObject({ ok: false, code: 'data-use-attestation-required' })
})
it('imports a separately attested Fixture into a created empty project and clears only its saved form', async () => {
  const h = await setup(); await h.store.createProject({ name: 'Synthetic', researchGoal: null }, true)
  const draft = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt' })
  h.store.setMaterialDraft(draft, true)
  expect(await h.store.importMaterial()).toMatchObject({ ok: true })
  expect(h.store.getSnapshot()).toMatchObject({ saveState: 'saved', dirty: false, materialDirty: false })
  expect(await h.store.loadSource()).toMatchObject({ ok: true, value: { text: BUILT_IN_SYNTHETIC_TEXT } })
})
it('imports separately authorized real text with an explicit data classification', async () => {
  const h = await setup(); await h.store.createProject({ name: 'Authorized interview', researchGoal: null }, true)
  const draft = await readMaterialDraft({ kind: 'paste', text: '受访者：每次整理审批记录都要来回核对。', displayName: 'interview.txt' })
  h.store.setMaterialDraft(draft, true)
  expect(await h.store.importMaterial()).toMatchObject({ ok: true })
  expect(h.commands.at(-1)?.payload).toEqual({ kind: 'source.importText', text: draft.text,
    displayName: 'interview.txt', format: 'pasted', dataClassification: 'authorized-real', dataUseAttested: true })
  expect(h.store.getSnapshot().selectedProject?.source?.syntheticDataAttested).toBe(false)
})
it('a synchronous reentrant close during invocation retains the exact uncertain command', async () => {
  const h = await setup()
  h.intercept(async (endpoint, _input, next) => { if (endpoint === 'projects.command') h.store.close(); return next() })
  h.store.editRequirement(h.requirementId, { title: '重入关闭' }); await h.store.flushProjectEdits()
  expect(h.store.getSnapshot()).toMatchObject({ isOpen: false, saveState: 'uncertain' })
  expect(h.store.getSnapshot().pendingRetry).toEqual(h.commands[0])
})

it('an authoritative baseline-stale rejection refreshes then permits a new explicitly displayed confirmation', async () => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { decision: 'include' }); await h.store.flushProjectEdits()
  await h.store.publishConfirmedBaseline(h.store.getConfirmationSnapshot())
  h.intercept(async (endpoint, input, next) => {
    const command = input as Stage3aProjectCommand
    if (endpoint === 'projects.command' && command.payload.kind === 'prd.render') return { ok: true, value: {
      status: 'rejected', projectId: command.projectId, commandId: command.commandId, error: { code: 'baseline-stale' },
    } }
    return next()
  })
  expect(await h.store.renderPublishedBaseline()).toMatchObject({ ok: false, code: 'baseline-stale' })
  expect(h.store.getSnapshot().baselineChain).toBeUndefined()
  expect(h.store.getConfirmationSnapshot().ok).toBe(false)
  h.intercept()
  const rebuilt = h.store.prepareConfirmation(); expect(rebuilt.ok).toBe(true)
  expect(await h.store.publishConfirmedBaseline(rebuilt)).toMatchObject({ ok: true })
})
it('a newer draft arriving during baseline publication invalidates the accepted chain', async () => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { decision: 'include' }); await h.store.flushProjectEdits()
  const gate = deferred(); const entered = deferred()
  h.intercept(async (endpoint, _input, next) => { const result = await next(); if (endpoint === 'projects.command') { entered.resolve(); await gate.promise } return result })
  const pending = h.store.publishConfirmedBaseline(h.store.getConfirmationSnapshot()); await entered.promise
  h.store.editRequirement(h.requirementId, { title: '较新草稿' }); gate.resolve(); await pending
  expect(h.store.getSnapshot().baselineChain).toBeUndefined()
  expect(await h.store.renderPublishedBaseline()).toMatchObject({ ok: false, code: 'baseline-stale' })
})
it('does not clear a newer material draft when an older import finishes', async () => {
  const h = await setup(); await h.store.createProject({ name: 'Synthetic', researchGoal: null }, true)
  const first = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'first.txt' })
  const second = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'second.txt' })
  h.store.setMaterialDraft(first, true)
  const gate = deferred(); const entered = deferred()
  h.intercept(async (endpoint, _input, next) => { const result = await next(); if (endpoint === 'projects.command') { entered.resolve(); await gate.promise } return result })
  const pending = h.store.importMaterial(); await entered.promise; h.store.setMaterialDraft(second, false); gate.resolve(); await pending
  expect(h.store.getSnapshot()).toMatchObject({ materialDraft: second, materialDirty: true, dirty: true, saveState: 'unsaved' })
})
it('retains authority and fails a same-version view with different content', async () => {
  const h = await setup(); const initial = h.store.getSnapshot().selectedProject
  h.intercept(async (endpoint, _input, next) => { const result = await next() as any
    return endpoint === 'projects.get' ? { ok: true, value: { status: 'accepted', value: { ...result.value.value, header: { ...result.value.value.header, name: 'conflicting same version' } } } } : result
  })
  expect(await h.store.refresh()).toMatchObject({ ok: false, code: 'protocol-invalid' })
  expect(h.store.getSnapshot().selectedProject).toBe(initial)
})
it('keeps the project list current after accepted creation and deletion', async () => {
  const h = await setup(); await h.store.createProject({ name: 'New synthetic', researchGoal: null }, true)
  const created = h.store.getSnapshot().selectedProject!
  expect(h.store.getSnapshot().projects.find(p => p.id === created.header.id)).toEqual(created.header)
  const input = parseProductInput('projects.command', { ...api, projectId: created.header.id, expectedVersion: 1,
    commandId: uuid(9000), payload: { kind: 'project.delete' } }) as Stage3aProjectCommand
  expect(await h.store.command(input)).toMatchObject({ ok: true, value: null })
  expect(h.store.getSnapshot().projects.some(p => p.id === created.header.id)).toBe(false)
})
it('explicitly discards unsent or known rejected drafts without a Host call and permits a clean switch', async () => {
  for (const rejected of [false, true]) {
    const h = await setup(); h.store.editRequirement(h.requirementId, { title: '准备放弃' })
    if (rejected) { await h.external({ kind: 'requirement.update', requirementId: h.requirementId, title: '外部权威标题' }); await h.store.flushProjectEdits() }
    const before = h.store.getSnapshot().selectedProject; const count = h.commands.length; const calls = vi.fn()
    h.intercept(async (_endpoint, _input, next) => { calls(); return next() })
    expect(h.store.discardDrafts()).toMatchObject({ ok: true })
    expect(calls).not.toHaveBeenCalled(); expect(h.commands).toHaveLength(count)
    expect(h.store.getSnapshot()).toMatchObject({ selectedProject: before, dirty: false, saveState: 'saved', drafts: [] })
    expect(await h.store.selectProject(OTHER_PROJECT_ID)).toMatchObject({ ok: true })
  }
})
it('refuses explicit discard for queued, admitted, uncertain and accepted-unread intents', async () => {
  for (const mode of ['queued', 'active', 'uncertain', 'accepted-unread']) {
    const h = await setup(); const gate = deferred(); const entered = deferred()
    h.intercept(async (endpoint, _input, next) => {
      if (mode === 'queued' && endpoint === 'health') await gate.promise
      if (mode === 'active' && endpoint === 'projects.command') { entered.resolve(); await gate.promise }
      const result = await next()
      if (mode === 'uncertain' && endpoint === 'projects.command') throw new Error('lost')
      if (mode === 'accepted-unread' && endpoint === 'projects.get') throw new Error('read lost')
      return result
    })
    const reads = mode === 'queued' ? Array.from({ length: 8 }, () => h.t.health()) : []
    await tick(); h.store.editRequirement(h.requirementId, { title: '禁止丢弃' }); const pending = h.store.flushProjectEdits()
    if (mode === 'active') await entered.promise
    else if (mode === 'queued') await tick()
    else await pending
    expect(h.store.discardDrafts().ok).toBe(false)
    expect(h.store.getSnapshot().dirty).toBe(true)
    gate.resolve(); await Promise.all(reads); await pending
  }
})
it('rejects a late closed or disposed flush without leaking queue state across reopen', async () => {
  const h = await setup(); const before = h.store.getSnapshot().selectedProject
  h.store.close()
  expect(await h.store.flushProjectEdits()).toEqual({ ok: false, code: 'closed' })
  await h.store.open()
  expect(h.store.getSnapshot()).toMatchObject({ dirty: false, saveState: 'saved', selectedProject: before })
  expect(h.store.getConfirmationSnapshot().ok).toBe(true)
  expect(await h.store.selectProject(OTHER_PROJECT_ID)).toMatchObject({ ok: true })
  h.store.dispose()
  expect(await h.store.flushProjectEdits()).toEqual({ ok: false, code: 'disposed' })
  expect(h.commands).toHaveLength(0)
})
it.each([false, true])('exact delete retry clears the deleted selection and inventory after intervening failed refresh: %s', async refreshDuringUncertainty => {
  const h = await setup(); await h.store.loadSource()
  const material = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'unsent.txt' })
  h.store.setMaterialDraft(material, true)
  const input = parseProductInput('projects.command', { ...api, projectId: SMALL_PROJECT_ID, expectedVersion: 3,
    commandId: uuid(9001), payload: { kind: 'project.delete' } }) as Stage3aProjectCommand
  h.intercept(async (endpoint, _input, next) => { const result = await next(); if (endpoint === 'projects.command') throw new Error('delete response lost'); return result })
  expect(await h.store.command(input)).toMatchObject({ ok: false, code: 'uncertain' })
  const retry = h.store.getSnapshot().pendingRetry
  if (refreshDuringUncertainty) expect(await h.store.refresh()).toEqual({ ok: false, code: 'not-found' })
  h.intercept()
  expect(await h.store.retryUncertain()).toEqual({ ok: true, value: null })
  expect(h.commands).toHaveLength(2); expect(h.commands[1]).toEqual(retry)
  const snapshot = h.store.getSnapshot()
  expect(snapshot.projects.some(project => project.id === SMALL_PROJECT_ID)).toBe(false)
  expect(snapshot).toMatchObject({ selectedProjectId: undefined, selectedProject: undefined, selectedSource: undefined,
    selectedPrdRevisionId: undefined, selectedMarkdown: undefined, materialDraft: undefined, importAttested: false,
    materialDirty: false, dirty: false, drafts: [], pendingRetry: undefined, baselineChain: undefined,
    saveState: 'saved', error: undefined, acceptedVersionFloor: 4, acceptedReceipt: { projectId: SMALL_PROJECT_ID, commandId: input.commandId, value: { projectVersion: 4 } } })
  expect(await h.store.selectProject(OTHER_PROJECT_ID)).toMatchObject({ ok: true })
})
it('normal accepted deletion clears an unsent material form and leaves a clean inventory', async () => {
  const h = await setup()
  h.store.setMaterialDraft(await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'unsent.txt' }), true)
  const input = parseProductInput('projects.command', { ...api, projectId: SMALL_PROJECT_ID, expectedVersion: 3,
    commandId: uuid(9002), payload: { kind: 'project.delete' } }) as Stage3aProjectCommand
  expect(await h.store.command(input)).toEqual({ ok: true, value: null })
  expect(h.store.getSnapshot()).toMatchObject({ selectedProjectId: undefined, dirty: false, materialDirty: false,
    importAttested: false, materialDraft: undefined, saveState: 'saved', drafts: [] })
  expect(await h.store.selectProject(OTHER_PROJECT_ID)).toMatchObject({ ok: true })
})
it('accepted deletion invalidates delayed source observations before they can restore deleted material', async () => {
  const h = await setup(); const gate = deferred(); const entered = deferred()
  h.intercept(async (endpoint, _input, next) => { const result = await next(); if (endpoint === 'sources.get') { entered.resolve(); await gate.promise } return result })
  const pendingSource = h.store.loadSource(); await entered.promise
  const input = parseProductInput('projects.command', { ...api, projectId: SMALL_PROJECT_ID, expectedVersion: 3,
    commandId: uuid(9003), payload: { kind: 'project.delete' } }) as Stage3aProjectCommand
  await h.store.command(input)
  gate.resolve()
  expect(await pendingSource).toEqual({ ok: false, code: 'cancelled' })
  expect(h.store.getSnapshot().selectedSource).toBeUndefined()
  expect(await h.store.selectProject(OTHER_PROJECT_ID)).toMatchObject({ ok: true })
})
it.each([false, true])('allows explicit discard after an ordinary failed refresh with known rejected edits: %s', async knownRejected => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { title: '可主动放弃的修改' })
  if (knownRejected) {
    await h.external({ kind: 'requirement.update', requirementId: h.requirementId, title: '外部权威文本' })
    expect(await h.store.flushProjectEdits()).toMatchObject({ ok: false, code: 'version-conflict' })
  }
  const authority = h.store.getSnapshot().selectedProject
  const previousMutations = h.commands.length
  h.intercept(async (endpoint, _input, next) => { if (endpoint === 'projects.get') throw new Error('read unavailable'); return next() })
  expect(await h.store.refresh()).toEqual({ ok: false, code: 'host-unavailable' })
  const calls = vi.fn()
  h.intercept(async (_endpoint, _input, next) => { calls(); return next() })
  expect(h.store.discardDrafts()).toEqual({ ok: true, value: undefined })
  expect(calls).not.toHaveBeenCalled(); expect(h.commands).toHaveLength(previousMutations)
  if (!knownRejected) expect(h.commands).toHaveLength(0)
  expect(h.store.getSnapshot()).toMatchObject({ dirty: false, saveState: 'saved', error: undefined, drafts: [], selectedProject: authority })
  expect(h.store.getConfirmationSnapshot().ok).toBe(true)
  expect(await h.store.selectProject(OTHER_PROJECT_ID)).toMatchObject({ ok: true })
})
it.each(['baselineId', 'baselineContentVersion', 'createdAt'] as const)('refresh invalidates same-ID/hash Markdown when authoritative %s changes', async changedField => {
  const h = await setup(); h.store.editRequirement(h.requirementId, { decision: 'include' }); await h.store.flushProjectEdits()
  await h.store.publishConfirmedBaseline(h.store.getConfirmationSnapshot()); await h.store.renderPublishedBaseline()
  const prd = h.record().prdRevisions[0]!
  await h.store.selectPrd(prd.id)
  expect(h.store.getSnapshot().selectedMarkdown?.contentHash).toBe(prd.contentHash)
  h.intercept(async (endpoint, _input, next) => {
    const result = await next() as any
    if (endpoint !== 'projects.get') return result
    const project = result.value.value
    const summary = project.prdSummaries[0]
    const patch = changedField === 'baselineId' ? { baselineId: uuid(9010), status: 'stale' }
      : changedField === 'baselineContentVersion' ? { baselineContentVersion: summary.baselineContentVersion + 1, status: 'stale' }
      : { createdAt: '2026-09-08T08:00:00.000Z' }
    return { ok: true, value: { status: 'accepted', value: { ...project,
      header: { ...project.header, projectVersion: project.header.projectVersion + 1 }, prdSummaries: [{ ...summary, ...patch }],
    } } }
  })
  expect(await h.store.refresh()).toMatchObject({ ok: true })
  expect(h.store.getSnapshot().selectedMarkdown).toBeUndefined()
  expect(await h.store.copySelectedMarkdown()).toEqual({ ok: false, code: 'protocol-invalid' })
  expect(await h.store.downloadSelectedMarkdown()).toEqual({ ok: false, code: 'protocol-invalid' })
})
