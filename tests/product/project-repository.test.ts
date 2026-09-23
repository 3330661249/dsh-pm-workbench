import { describe, expect, it, vi } from 'vitest'
import { TableProjectRepository } from '../../packages/workbench/src/application/project-repository.js'
import { systemClock } from '../../packages/workbench/src/application/clock.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { ProjectService } from '../../packages/workbench/src/application/project-service.js'
import { FixtureInsightEngine } from '../../packages/workbench/src/analysis/fixture-engine.js'
import { FIXTURE_MANIFEST, BUILT_IN_SYNTHETIC_TEXT } from '../../packages/workbench/src/analysis/fixture-manifest.js'
import { projectIdSchema, type ProjectId } from '../../packages/workbench/src/domain/ids.js'
import type { StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import { parseProductInput } from '../../packages/workbench/src/protocol/product.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import { makeSmallActiveRecord, SMALL_PROJECT_ID } from './helpers/synthetic-records.js'
import * as canonical from '../../packages/workbench/src/protocol/canonical-json.js'

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const at = '2026-09-07T08:00:00.000Z'
function setup(records: readonly StoredProjectRecord[] = []) {
  const table = createFakeDomainTable<ProjectId, StoredProjectRecord>(records.map(record =>
    [record.kind === 'active' ? record.header.id : record.projectId, record]))
  const clock = { now: vi.fn(() => at) }
  let ordinal = 10000
  const newId = vi.fn(() => uuid(ordinal++))
  const sha256Utf8 = vi.fn(nodeSha256Utf8)
  const engine = new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8)
  const repository = new TableProjectRepository(table, {
    clock, newId, sha256Utf8,
    engine,
  })
  return { table, clock, newId, sha256Utf8, engine, repository, service: new ProjectService(repository) }
}
function command(n: number, expectedVersion: number, payload: unknown, projectId = SMALL_PROJECT_ID) {
  return parseProductInput('projects.command', {
    apiVersion: 'pmwb-product-v1', projectId, commandId: uuid(n), expectedVersion, payload,
  })
}
const create = (n: number, projectId = projectIdSchema.parse(uuid(n))) => command(n + 100, 0,
  { kind: 'project.create', name: 'Synthetic project', researchGoal: null, syntheticDataAttested: true }, projectId)
const imported = (n: number, expectedVersion = 1) => command(n, expectedVersion,
  { kind: 'source.importText', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt', format: 'pasted', syntheticDataAttested: true })
function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>(done => { resolve = done })
  return { promise, resolve }
}

describe('durable project repository', () => {
  it('reuses immutable unrelated record sizes but remeasures a replacement with the same version', async () => {
    const otherId = projectIdSchema.parse(uuid(90))
    const unrelated = makeSmallActiveRecord({ projectId: otherId })
    const { service, table } = setup([makeSmallActiveRecord(), unrelated])
    const measure = vi.spyOn(canonical, 'canonicalJsonUtf8Bytes')
    try {
      expect((await service.command(imported(101))).status).toBe('accepted')
      expect(measure.mock.calls.filter(([value]) => value === unrelated)).toHaveLength(1)
      measure.mockClear()
      await service.command(imported(102, 2))
      expect(measure.mock.calls.filter(([value]) => value === unrelated)).toHaveLength(0)
      const replacement = { ...unrelated, header: { ...unrelated.header, name: 'a different snapshot at the same version' } }
      await table.put(otherId, replacement)
      await service.command(imported(103, 2))
      expect(measure.mock.calls.filter(([value]) => value === replacement)).toHaveLength(1)
    } finally { measure.mockRestore() }
  })

  it('allows exactly one of concurrent twentieth and twenty-first creates', async () => {
    const records = Array.from({ length: 19 }, (_, index) => makeSmallActiveRecord({ projectId: projectIdSchema.parse(uuid(index + 1)) }))
    const { service, table } = setup(records)
    const outcomes = await Promise.all([service.command(create(20)), service.command(create(21))])
    expect(outcomes.filter(outcome => outcome.status === 'accepted')).toHaveLength(1)
    expect(outcomes.filter(outcome => outcome.status === 'rejected' && outcome.error.code === 'project-limit-reached')).toHaveLength(1)
    expect(table.writeCount).toBe(1)
    expect(table.size).toBe(20)
  })

  it('uses client create identities, a same-record receipt, and prevents put overwrites', async () => {
    const { service, table, clock, newId } = setup()
    const input = create(1)
    const accepted = await service.command(input)
    expect(accepted).toEqual({ status: 'accepted', projectId: input.projectId, commandId: input.commandId,
      value: { projectVersion: 1, contentVersion: 0 } })
    const saved = table.get(input.projectId)
    expect(saved).toMatchObject({ kind: 'active', header: { id: input.projectId, projectVersion: 1, contentVersion: 0, updatedAt: at },
      commandReceipts: [{ commandId: input.commandId, outcome: { ok: true, projectVersion: 1, contentVersion: 0 } }] })
    expect(saved && 'header' in saved && Reflect.has(saved.header, 'syntheticDataAttested')).toBe(false)
    expect(await service.command(input)).toEqual(accepted)
    expect(clock.now).toHaveBeenCalledTimes(1)
    expect(newId).not.toHaveBeenCalled()
    expect(table.writeCount).toBe(1)
    expect(await service.command(create(2, input.projectId))).toMatchObject({ status: 'rejected', error: { code: 'version-conflict' } })
    expect(table.get(input.projectId)).toMatchObject({ header: { projectVersion: 1 }, commandReceipts: expect.arrayContaining([expect.objectContaining({ commandId: input.commandId })]) })
  })

  it.each([false, undefined])('rejects create attestation %s before storage', async attestation => {
    const { service, table } = setup()
    const input = create(1)
    const payload = { ...input.payload, syntheticDataAttested: attestation }
    if (attestation === undefined) Reflect.deleteProperty(payload, 'syntheticDataAttested')
    await expect(service.command({ ...input, payload })).rejects.toThrow('invalid-request')
    expect(table.writeCount).toBe(0)
  })

  it.each([1, -1])('rejects create expectedVersion %s and noncanonical IDs before storage', async expectedVersion => {
    const { service, table } = setup()
    await expect(service.command({ ...create(1), expectedVersion })).rejects.toThrow('invalid-request')
    await expect(service.command({ ...create(1), projectId: 'INVALID-ID' })).rejects.toThrow('invalid-request')
    expect(table.writeCount).toBe(0)
  })

  it('does not resolve create before durable completion and serializes membership while it is pending', async () => {
    const { service, table } = setup()
    const gate = deferred()
    table.deferNextWrite(gate.promise)
    let completed = false
    const first = service.command(create(1)).then(value => { completed = true; return value })
    const second = service.command(create(2))
    await vi.waitFor(() => expect(table.writeCount).toBe(1))
    expect(completed).toBe(false)
    expect(table.size).toBe(0)
    gate.resolve()
    expect((await first).status).toBe('accepted')
    expect((await second).status).toBe('accepted')
    expect(table.size).toBe(2)
  })

  it('orders create and delete membership before project locks without losing the freed slot', async () => {
    const records = Array.from({ length: 20 }, (_, index) => makeSmallActiveRecord({ projectId: projectIdSchema.parse(uuid(index + 1)) }))
    const { service, table } = setup(records)
    const [deleted, created, overflow] = await Promise.all([
      service.command(command(1000, 1, { kind: 'project.delete' })),
      service.command(create(21)), service.command(create(22)),
    ])
    expect(deleted.status).toBe('accepted')
    expect(created.status).toBe('accepted')
    expect(overflow).toMatchObject({ status: 'rejected', error: { code: 'project-limit-reached' } })
    expect([...table.entries()].filter(([, value]) => value.kind === 'active')).toHaveLength(20)
  })

  it('accepts only one same-version mutation and receipts the losing CAS without changing content', async () => {
    const { service, table } = setup([makeSmallActiveRecord()])
    const [first, second] = await Promise.all([service.command(imported(101)), service.command(imported(102))])
    expect(first).toMatchObject({ status: 'accepted', value: { projectVersion: 2, contentVersion: 1 } })
    expect(second).toMatchObject({ status: 'rejected', error: { code: 'version-conflict' } })
    expect(table.get(SMALL_PROJECT_ID)).toMatchObject({ header: { projectVersion: 2, contentVersion: 1 }, commandReceipts: [{ outcome: { ok: true } }, { outcome: { ok: false, code: 'version-conflict' } }] })
  })

  it('rechecks table slot CAS and preserves concurrent durable changes and their receipts', async () => {
    const { service, table } = setup([makeSmallActiveRecord()])
    const gate = deferred()
    table.deferNextWrite(gate.promise)
    const advanced = { ...makeSmallActiveRecord(), header: { ...makeSmallActiveRecord().header, projectVersion: 2 } }
    const external = table.put(SMALL_PROJECT_ID, advanced)
    const pending = service.command(imported(101))
    await Promise.resolve()
    gate.resolve()
    await external
    expect(await pending).toMatchObject({ status: 'rejected', error: { code: 'version-conflict' } })
    expect(table.get(SMALL_PROJECT_ID)).toMatchObject({ header: { projectVersion: 2, contentVersion: 0 }, source: null })
  })

  it('recovers both queues after durable failure without publishing the failed candidate', async () => {
    const { service, table } = setup()
    table.rejectNextWrite(new Error('synthetic write failure'))
    expect(await service.command(create(1))).toMatchObject({ status: 'rejected', error: { code: 'storage-failed' } })
    expect(table.get(SMALL_PROJECT_ID)).toBeUndefined()
    expect((await service.command(create(1))).status).toBe('accepted')
    table.rejectNextWrite(new Error('synthetic update failure'))
    expect(await service.command(imported(201))).toMatchObject({ status: 'rejected', error: { code: 'storage-failed' } })
    expect(table.get(SMALL_PROJECT_ID)).toMatchObject({ source: null, header: { projectVersion: 1 } })
    expect((await service.command(imported(201))).status).toBe('accepted')
  })

  it('cancels before queue admission without writes, but drains a write already started', async () => {
    const { service, table, repository } = setup()
    const before = new AbortController()
    before.abort()
    expect(await service.command(create(1), before.signal)).toMatchObject({ status: 'rejected', error: { code: 'cancelled' } })
    expect(table.writeCount).toBe(0)
    const gate = deferred()
    table.deferNextWrite(gate.promise)
    const started = new AbortController()
    const first = service.command(create(1), started.signal)
    const queued = new AbortController()
    const second = service.command(create(2), queued.signal)
    await vi.waitFor(() => expect(table.writeCount).toBe(1))
    started.abort(); queued.abort()
    let closed = false
    const close = repository.close().then(() => { closed = true })
    await Promise.resolve()
    expect(closed).toBe(false)
    gate.resolve()
    expect((await first).status).toBe('accepted')
    expect(await second).toMatchObject({ status: 'rejected', error: { code: 'cancelled' } })
    await close
    expect(table.writeCount).toBe(1)
    expect(table.size).toBe(1)
  })

  it('sorts fixed-clock ties by project ID and reconstructs identical reads after repository restart', async () => {
    const { service, table, repository } = setup()
    await service.command(create(2)); await service.command(create(1))
    const input = { apiVersion: 'pmwb-product-v1' }
    const before = await service.list(input)
    expect(before).toMatchObject({ status: 'accepted', value: [{ id: uuid(1) }, { id: uuid(2) }] })
    await repository.close()
    const restarted = setup([...table.entries()].map(([, record]) => JSON.parse(JSON.stringify(record)) as StoredProjectRecord))
    expect(await restarted.service.list(input)).toEqual(before)
    expect(new Date(systemClock.now()).toISOString()).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('deduplicates concurrent identical requests before allocating a second clock value or source ID', async () => {
    const { table, service, clock, newId } = setup([makeSmallActiveRecord()])
    const gate = deferred()
    table.deferNextWrite(gate.promise)
    const first = service.command(imported(101))
    const second = service.command(imported(101))
    await vi.waitFor(() => expect(table.writeCount).toBe(1))
    gate.resolve()
    expect(await second).toEqual(await first)
    expect(clock.now).toHaveBeenCalledTimes(1)
    expect(newId).toHaveBeenCalledTimes(1)
    expect(table.writeCount).toBe(1)
  })

  it('calls only synchronous validation in table.update and admits cancellation before a delayed callback', async () => {
    const { table, service, clock, newId, sha256Utf8 } = setup([makeSmallActiveRecord()])
    const gate = deferred()
    const entered = deferred()
    table.deferNextWrite(gate.promise)
    const otherId = projectIdSchema.parse(uuid(2))
    const barrier = table.put(otherId, makeSmallActiveRecord({ projectId: otherId }))
    const originalUpdate = table.update.bind(table)
    let inCallback = false
    clock.now.mockImplementation(() => { if (inCallback) throw new Error('clock-in-callback'); return at })
    newId.mockImplementation(() => { if (inCallback) throw new Error('id-in-callback'); return uuid(10000) })
    sha256Utf8.mockImplementation(value => { if (inCallback) throw new Error('hash-in-callback'); return nodeSha256Utf8(value) })
    vi.spyOn(table, 'update').mockImplementation((id, transform) => {
      entered.resolve()
      return originalUpdate(id, current => {
        inCallback = true
        try {
          const next = transform(current)
          expect(next).not.toBeInstanceOf(Promise)
          return next
        } finally { inCallback = false }
      })
    })
    const controller = new AbortController()
    const pending = service.command(imported(101), controller.signal)
    await entered.promise
    controller.abort()
    gate.resolve()
    await barrier
    expect(await pending).toMatchObject({ status: 'rejected', error: { code: 'cancelled' } })
    expect(table.writeCount).toBe(1)
    expect(table.get(SMALL_PROJECT_ID)).toEqual(makeSmallActiveRecord())
    expect((await service.command(imported(101))).status).toBe('accepted')
    expect(table.writeCount).toBe(2)
  })

  it('replays a receipt newly visible at the backend slot without rewriting it', async () => {
    const { table, service } = setup([makeSmallActiveRecord()])
    const gate = deferred()
    const entered = deferred()
    const request = imported(101)
    const outcome = { ok: false as const, code: 'source-locked' as const }
    const { hashProjectCommandRequest } = await import('../../packages/workbench/src/application/receipts.js')
    const advanced = { ...makeSmallActiveRecord(), commandReceipts: [{ commandId: request.commandId,
      requestHash: hashProjectCommandRequest(request, nodeSha256Utf8), outcome }] }
    table.deferNextWrite(gate.promise)
    const external = table.put(SMALL_PROJECT_ID, advanced)
    const originalUpdate = table.update.bind(table)
    vi.spyOn(table, 'update').mockImplementation((id, transform) => { entered.resolve(); return originalUpdate(id, transform) })
    const pending = service.command(request)
    await entered.promise
    gate.resolve()
    await external
    expect(await pending).toMatchObject({ status: 'rejected', error: { code: 'source-locked' } })
    expect(table.get(SMALL_PROJECT_ID)).toEqual(advanced)
    expect(table.writeCount).toBe(1)
  })

  it('changes updatedAt only for accepted mutations and never rolls storage back when replaying an older accepted receipt', async () => {
    const { table, service, clock, newId } = setup()
    const first = await service.command(create(1))
    clock.now.mockReturnValue('2026-09-08T08:00:00.000Z')
    await service.command(imported(201))
    const before = JSON.stringify(table.get(SMALL_PROJECT_ID))
    const calls = { clock: clock.now.mock.calls.length, ids: newId.mock.calls.length }
    expect(await service.command(create(1))).toEqual(first)
    expect(JSON.stringify(table.get(SMALL_PROJECT_ID))).toBe(before)
    expect(clock.now).toHaveBeenCalledTimes(calls.clock)
    expect(newId).toHaveBeenCalledTimes(calls.ids)
    expect(table.get(SMALL_PROJECT_ID)).toMatchObject({ header: { projectVersion: 2, contentVersion: 1, updatedAt: '2026-09-08T08:00:00.000Z' } })
    clock.now.mockReturnValue('2026-09-09T08:00:00.000Z')
    await service.command(imported(202, 2))
    expect(table.get(SMALL_PROJECT_ID)).toMatchObject({ header: { projectVersion: 2, contentVersion: 1, updatedAt: '2026-09-08T08:00:00.000Z' } })
  })

  it('allows another project mutation while delete holds membership waiting for an analysis project lock', async () => {
    const otherId = projectIdSchema.parse(uuid(2))
    const { table, service, engine } = setup([makeSmallActiveRecord(), makeSmallActiveRecord({ projectId: otherId })])
    await service.command(imported(101))
    const sourced = table.get(SMALL_PROJECT_ID)
    if (sourced?.kind !== 'active' || !sourced.source) throw new Error('missing synthetic source')
    const started = deferred()
    const gate = deferred()
    const originalAnalyse = engine.analyse.bind(engine)
    vi.spyOn(engine, 'analyse').mockImplementation(async (input, signal) => {
      started.resolve()
      await gate.promise
      return originalAnalyse(input, signal)
    })
    const analysis = service.command(command(102, 2, { kind: 'analysis.runFixture', sourceRevisionId: sourced.source.id }))
    await started.promise
    const deletion = service.command(command(103, 3, { kind: 'project.delete' }))
    const creation = service.command(create(3))
    const ordinary = service.command(command(104, 1, { kind: 'source.importText', text: BUILT_IN_SYNTHETIC_TEXT,
      displayName: 'other-synthetic.txt', format: 'pasted', syntheticDataAttested: true }, otherId))
    let ordinaryCompleted = false
    void ordinary.then(() => { ordinaryCompleted = true })
    try { await vi.waitFor(() => expect(ordinaryCompleted).toBe(true), { timeout: 1000 }) }
    finally { gate.resolve() }
    expect(await ordinary).toMatchObject({ status: 'accepted' })
    expect((await analysis).status).toBe('accepted')
    expect((await deletion).status).toBe('accepted')
    expect((await creation).status).toBe('accepted')
    expect(table.get(SMALL_PROJECT_ID)?.kind).toBe('deleted')
    expect([...table.entries()].filter(([, record]) => record.kind === 'active')).toHaveLength(2)
  })

  it('discards a valid late analysis candidate when its source snapshot changes before commit', async () => {
    const { table, service, engine } = setup([makeSmallActiveRecord()])
    await service.command(imported(101))
    const sourced = table.get(SMALL_PROJECT_ID)
    if (sourced?.kind !== 'active' || !sourced.source) throw new Error('missing synthetic source')
    const started = deferred()
    const gate = deferred()
    const originalAnalyse = engine.analyse.bind(engine)
    vi.spyOn(engine, 'analyse').mockImplementation(async (input, signal) => {
      started.resolve()
      await gate.promise
      return originalAnalyse(input, signal)
    })
    const pending = service.command(command(102, 2, { kind: 'analysis.runFixture', sourceRevisionId: sourced.source.id }))
    await started.promise
    const changed = { ...sourced, header: { ...sourced.header, projectVersion: 3, contentVersion: 2, reviewStarted: true } }
    await table.put(SMALL_PROJECT_ID, changed)
    gate.resolve()
    expect(await pending).toMatchObject({ status: 'rejected', error: { code: 'version-conflict' } })
    expect(table.get(SMALL_PROJECT_ID)).toMatchObject({ header: { projectVersion: 3, contentVersion: 2, reviewStarted: true },
      analyses: [], generatedRequirements: [], evidence: [], currentAnalysisRevisionId: null })
  })
})
