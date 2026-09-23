import { describe, expect, it, vi } from 'vitest'
import { hashProjectCommandRequest } from '../../packages/workbench/src/application/receipts.js'
import { TableProjectRepository } from '../../packages/workbench/src/application/project-repository.js'
import { ProjectService } from '../../packages/workbench/src/application/project-service.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { FixtureInsightEngine } from '../../packages/workbench/src/analysis/fixture-engine.js'
import { FIXTURE_MANIFEST } from '../../packages/workbench/src/analysis/fixture-manifest.js'
import { projectIdSchema, commandIdSchema, sourceRevisionIdSchema, type ProjectId } from '../../packages/workbench/src/domain/ids.js'
import { storedProjectRecordSchema, type ActiveProjectRecord, type StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import { parseProductInput } from '../../packages/workbench/src/protocol/product.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import { SMALL_PROJECT_ID, makeSmallActiveRecord, makeTombstone } from './helpers/synthetic-records.js'

const uuid = (n: number) => `20000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const sourceRevisionId = sourceRevisionIdSchema.parse(uuid(999))
function input(n: number, payload: unknown = { kind: 'analysis.runHarnessModel', sourceRevisionId }, expectedVersion = 1, projectId = SMALL_PROJECT_ID) {
  return parseProductInput('projects.command', { apiVersion: 'pmwb-product-v1', projectId, commandId: uuid(n), expectedVersion, payload })
}
function setup(records: readonly StoredProjectRecord[] = [makeSmallActiveRecord()]) {
  const table = createFakeDomainTable<ProjectId, StoredProjectRecord>(records.map(record => [record.kind === 'active' ? record.header.id : record.projectId, record]))
  const clock = { now: vi.fn(() => '2026-09-07T08:00:00.000Z') }
  const newId = vi.fn(() => uuid(10000))
  const service = new ProjectService(new TableProjectRepository(table, { clock, newId, sha256Utf8: nodeSha256Utf8,
    engine: new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8) }))
  return { table, service, clock, newId }
}

describe('durable receipts and body-free tombstones', () => {
  it('hashes the complete strict request excluding only commandId and binds endpoint, kind, project and version', async () => {
    const request = input(1)
    const hash = hashProjectCommandRequest(request, nodeSha256Utf8)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    expect(hashProjectCommandRequest({ ...request, commandId: commandIdSchema.parse(uuid(2)) }, nodeSha256Utf8)).toBe(hash)
    expect(hashProjectCommandRequest(request, nodeSha256Utf8, 'other.endpoint')).not.toBe(hash)
    for (const changed of [
      { ...request, expectedVersion: 2 },
      { ...request, projectId: projectIdSchema.parse(uuid(2)) },
      { ...request, payload: { kind: 'project.delete' as const } },
      { ...request, payload: { kind: 'analysis.runHarnessModel' as const, sourceRevisionId: sourceRevisionIdSchema.parse(uuid(998)) } },
    ]) expect(hashProjectCommandRequest(changed, nodeSha256Utf8)).not.toBe(hash)
    const { service, table } = setup()
    const first = await service.command(request)
    expect(await service.command(request)).toEqual(first)
    for (const changed of [ { ...request, expectedVersion: 2 }, { ...request, payload: { kind: 'project.delete' } },
      { ...request, payload: { kind: 'analysis.runHarnessModel', sourceRevisionId: uuid(998) } } ]) {
      expect(await service.command(changed)).toMatchObject({ status: 'rejected', error: { code: 'idempotency-key-reused' } })
    }
    expect(table.writeCount).toBe(1)
  })

  it('replays business rejections after later versions without allocating time or IDs', async () => {
    const { service, table, clock, newId } = setup()
    const rejected = input(1, { kind: 'analysis.runFixture', sourceRevisionId })
    const first = await service.command(rejected)
    expect(first).toMatchObject({ status: 'rejected', error: { code: 'not-found' } })
    await service.command(input(2, { kind: 'source.importText', text: '合成材料', displayName: 's.txt', format: 'pasted', syntheticDataAttested: true }))
    const before = { writes: table.writeCount, clock: clock.now.mock.calls.length, ids: newId.mock.calls.length }
    expect(await service.command(rejected)).toEqual(first)
    expect(table.writeCount).toBe(before.writes)
    expect(clock.now).toHaveBeenCalledTimes(before.clock)
    expect(newId).toHaveBeenCalledTimes(before.ids)
    expect(table.get(SMALL_PROJECT_ID)).toMatchObject({ header: { projectVersion: 2, contentVersion: 1 } })
  })

  it('caps receipts without eviction, still replays old results, and always permits deletion at capacity', async () => {
    const { service, table } = setup()
    for (let i = 1; i <= 256; i++) expect(await service.command(input(i))).toMatchObject({ status: 'rejected', error: { code: 'not-found' } })
    expect((table.get(SMALL_PROJECT_ID) as ActiveProjectRecord).commandReceipts).toHaveLength(256)
    const before = table.writeCount
    expect(await service.command(input(257))).toMatchObject({ status: 'rejected', error: { code: 'receipt-capacity-reached' } })
    expect(await service.command(input(1))).toMatchObject({ status: 'rejected', error: { code: 'not-found' } })
    expect(table.writeCount).toBe(before)
    expect(await service.command(input(258, { kind: 'project.delete' }, 2))).toMatchObject({ status: 'rejected', error: { code: 'version-conflict' } })
    expect(table.writeCount).toBe(before)
    expect((await service.command(input(259, { kind: 'project.delete' }))).status).toBe('accepted')
    expect(table.get(SMALL_PROJECT_ID)?.kind).toBe('deleted')
  })

  it('replays the same delete exactly and rejects every later command against the tombstone', async () => {
    const { service, table, clock, newId } = setup()
    const request = input(1, { kind: 'project.delete' })
    const first = await service.command(request)
    expect(first).toEqual({ status: 'accepted', projectId: SMALL_PROJECT_ID, commandId: request.commandId, value: { projectVersion: 2 } })
    expect(await service.command(request)).toEqual(first)
    expect(await service.command({ ...request, expectedVersion: 2 })).toMatchObject({ status: 'rejected', error: { code: 'idempotency-key-reused' } })
    expect(await service.command(input(2))).toMatchObject({ status: 'rejected', error: { code: 'project-deleted' } })
    expect(await service.command(input(3, { kind: 'project.create', name: 'Reused', researchGoal: null, syntheticDataAttested: true }, 0))).toMatchObject({ status: 'rejected', error: { code: 'project-deleted' } })
    expect(table.writeCount).toBe(1)
    expect(clock.now).toHaveBeenCalledTimes(1)
    expect(newId).not.toHaveBeenCalled()
    const tombstone = table.get(SMALL_PROJECT_ID)!
    expect(storedProjectRecordSchema.safeParse(tombstone).success).toBe(true)
    expect(Object.keys(tombstone).sort()).toEqual(['deleteCommandId', 'deleteOutcome', 'deleteRequestHash', 'deletedAt', 'kind', 'projectId', 'schemaVersion'])
    expect(JSON.stringify(tombstone)).not.toContain('Synthetic project')
    expect(await service.list({ apiVersion: 'pmwb-product-v1' })).toEqual({ status: 'accepted', value: [] })
    expect(await service.get({ apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID })).toMatchObject({ status: 'rejected' })
  })

  it('forgets an old create outcome after deletion and preserves active data if deletion fails', async () => {
    const { service, table } = setup([])
    const create = input(1, { kind: 'project.create', name: 'Synthetic project', researchGoal: null, syntheticDataAttested: true }, 0)
    expect((await service.command(create)).status).toBe('accepted')
    const before = JSON.stringify(table.get(SMALL_PROJECT_ID))
    const deletion = input(2, { kind: 'project.delete' })
    table.rejectNextWrite(new Error('synthetic durable failure'))
    expect(await service.command(deletion)).toMatchObject({ status: 'rejected', error: { code: 'storage-failed' } })
    expect(JSON.stringify(table.get(SMALL_PROJECT_ID))).toBe(before)
    expect((await service.command(deletion)).status).toBe('accepted')
    expect(await service.command(create)).toMatchObject({ status: 'rejected', error: { code: 'project-deleted' } })
    expect(table.size).toBe(1)
  })

  it('blocks new IDs at 1024 tombstones yet permits all remaining 20 deletions through 1044 rows', async () => {
    const tombstones = Array.from({ length: 1024 }, (_, i) => ({ ...makeTombstone(), projectId: projectIdSchema.parse(uuid(i + 1)) }))
    const active = Array.from({ length: 20 }, (_, i) => makeSmallActiveRecord({ projectId: projectIdSchema.parse(uuid(2000 + i)) }))
    const { service, table } = setup([...tombstones, ...active])
    const createPayload = { kind: 'project.create', name: 'Synthetic', researchGoal: null, syntheticDataAttested: true }
    expect(await service.command(input(3000, createPayload, 0, projectIdSchema.parse(uuid(4000))))).toMatchObject({ status: 'rejected', error: { code: 'limit-exceeded' } })
    for (let i = 0; i < 20; i++) expect((await service.command(input(5000 + i, { kind: 'project.delete' }, 1, active[i]!.header.id))).status).toBe('accepted')
    expect(table.size).toBe(1044)
    expect([...table.entries()].every(([, record]) => record.kind === 'deleted')).toBe(true)
    expect(table.writeCount).toBe(20)
    expect(await service.command(input(3001, createPayload, 0, projectIdSchema.parse(uuid(4001))))).toMatchObject({ status: 'rejected', error: { code: 'limit-exceeded' } })
    expect(table.size).toBe(1044)
  })

  it('permits a fresh project immediately below the tombstone threshold without clearing older rows', async () => {
    const { service, table } = setup(Array.from({ length: 1023 }, (_, i) => ({ ...makeTombstone(), projectId: projectIdSchema.parse(uuid(i + 1)) })))
    expect((await service.command(input(5000, { kind: 'project.create', name: 'Synthetic', researchGoal: null, syntheticDataAttested: true }, 0))).status).toBe('accepted')
    expect(table.size).toBe(1024)
  })

  it('rejects corrupted receipt result correlation rather than returning another command kind as accepted', async () => {
    const request = input(1)
    const record: ActiveProjectRecord = { ...makeSmallActiveRecord(), commandReceipts: [{ commandId: request.commandId,
      requestHash: hashProjectCommandRequest(request, nodeSha256Utf8), outcome: { ok: true, projectVersion: 2, contentVersion: 1 } }] }
    const { service, table } = setup([record])
    await expect(service.command(request)).rejects.toThrow('invalid-outcome')
    expect(table.writeCount).toBe(0)
  })
})
