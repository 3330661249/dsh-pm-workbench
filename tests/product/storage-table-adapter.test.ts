import type { Context } from '@deepseek-ai/cordis'
import type { Domain } from '@deepseek-ai/dsh-storage-domain'
import { describe, expect, it, vi } from 'vitest'

import type { ProjectId } from '../../packages/workbench/src/domain/ids.js'
import type { StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import {
  openProjectsTable,
  projectDomainSpec,
} from '../../packages/workbench/src/integration/harness-rc6/project-domain.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import {
  OTHER_PROJECT_ID,
  SMALL_PROJECT_ID,
  makeSmallActiveRecord,
  makeTombstone,
} from './helpers/synthetic-records.js'

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

describe('rc.6 project table adapter', () => {
  it('defines exactly one projects table and returns a frozen handle pair', async () => {
    const table = createFakeDomainTable<ProjectId, StoredProjectRecord>()
    const domain = {
      name: projectDomainSpec.name,
      global: undefined as never,
      table: vi.fn(() => table),
      close: vi.fn(async () => {}),
    } as unknown as Domain<typeof projectDomainSpec>
    const open = vi.fn(async () => domain)
    const ctx = { storageDomain: { open } } as unknown as Context

    const opened = await openProjectsTable(ctx)

    expect(projectDomainSpec).toMatchObject({
      name: 'dsh_pm_workbench_projects',
      version: 1,
    })
    expect(Object.keys(projectDomainSpec.tables)).toEqual(['projects'])
    expect(projectDomainSpec).not.toHaveProperty('global')
    expect(open).toHaveBeenCalledWith(projectDomainSpec)
    expect(domain.table).toHaveBeenCalledWith('projects')
    expect(opened).toEqual({ domain, table })
    expect(Object.isFrozen(opened)).toBe(true)
  })
})

describe('faithful rc.6 table fake', () => {
  it('keeps a rejected durable write out of visible memory and preserves the queue', async () => {
    const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>()
    fake.rejectNextWrite(new Error('synthetic durable failure'))
    await expect(fake.put(SMALL_PROJECT_ID, makeSmallActiveRecord())).rejects.toThrow('synthetic durable failure')
    expect(fake.get(SMALL_PROJECT_ID)).toBeUndefined()
    await fake.put(SMALL_PROJECT_ID, makeSmallActiveRecord())
    expect(fake.get(SMALL_PROJECT_ID)?.kind).toBe('active')
  })

  it('does not expose a write before its durable operation resolves', async () => {
    const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>()
    const durability = deferred()
    fake.deferNextWrite(durability.promise)
    const record = makeSmallActiveRecord()
    const write = fake.put(SMALL_PROJECT_ID, record)
    await Promise.resolve()
    expect(fake.get(SMALL_PROJECT_ID)).toBeUndefined()
    durability.resolve()
    await write
    expect(fake.get(SMALL_PROJECT_ID)).toBe(record)
  })

  it('replaces an active record with a body-free tombstone in one update', async () => {
    const original = makeSmallActiveRecord()
    const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>([[SMALL_PROJECT_ID, original]])
    const tombstone = makeTombstone()
    const updated = await fake.update(SMALL_PROJECT_ID, current => {
      expect(current).toBe(original)
      return tombstone
    })
    expect(updated).toBe(tombstone)
    expect(fake.get(SMALL_PROJECT_ID)).toBe(tombstone)
  })

  it('returns stored object identities and stable iterator snapshots without deep copying', async () => {
    const first = makeSmallActiveRecord()
    const second = makeSmallActiveRecord({ projectId: OTHER_PROJECT_ID })
    const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>([[SMALL_PROJECT_ID, first]])
    const entries = fake.entries()
    const keys = fake.keys()
    await fake.put(OTHER_PROJECT_ID, second)
    expect(fake.get(SMALL_PROJECT_ID)).toBe(first)
    expect(fake.get(OTHER_PROJECT_ID)).toBe(second)
    expect([...entries]).toEqual([[SMALL_PROJECT_ID, first]])
    expect([...entries]).toHaveLength(0)
    expect([...keys]).toEqual([SMALL_PROJECT_ID])
    expect(fake.size).toBe(2)
  })

  it('runs update transforms against the value current at each queue slot', async () => {
    type Counter = { readonly value: number }
    const fake = createFakeDomainTable<ProjectId, Counter>([[SMALL_PROJECT_ID, { value: 0 }]])
    const durability = deferred()
    fake.deferNextWrite(durability.promise)
    const seen: number[] = []
    const first = fake.update(SMALL_PROJECT_ID, current => {
      seen.push(current.value)
      return { value: current.value + 1 }
    })
    const second = fake.update(SMALL_PROJECT_ID, current => {
      seen.push(current.value)
      return { value: current.value + 1 }
    })
    await Promise.resolve()
    expect(seen).toEqual([0])
    durability.resolve()
    await expect(Promise.all([first, second])).resolves.toEqual([{ value: 1 }, { value: 2 }])
    expect(seen).toEqual([0, 1])
    expect(fake.get(SMALL_PROJECT_ID)).toEqual({ value: 2 })
  })

  it('rejects a missing update without poisoning the queue', async () => {
    const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>()
    await expect(fake.update(SMALL_PROJECT_ID, current => current)).rejects.toThrow('missing-key')
    await expect(fake.put(SMALL_PROJECT_ID, makeSmallActiveRecord())).resolves.toBeUndefined()
  })

  it('matches durable delete behavior for present and absent keys', async () => {
    const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>([[SMALL_PROJECT_ID, makeSmallActiveRecord()]])
    await expect(fake.delete(SMALL_PROJECT_ID)).resolves.toBe(true)
    await expect(fake.delete(SMALL_PROJECT_ID)).resolves.toBe(false)
    expect(fake.get(SMALL_PROJECT_ID)).toBeUndefined()
  })

  it('rejects new writes once close begins and drains accepted writes before resolving', async () => {
    const fake = createFakeDomainTable<ProjectId, StoredProjectRecord>()
    const durability = deferred()
    fake.deferNextWrite(durability.promise)
    const record = makeSmallActiveRecord()
    const accepted = fake.put(SMALL_PROJECT_ID, record)
    const close = fake.close()
    expect(fake.close()).toBe(close)
    await expect(fake.put(OTHER_PROJECT_ID, makeSmallActiveRecord({ projectId: OTHER_PROJECT_ID }))).rejects.toThrow('closed')
    let closeResolved = false
    void close.then(() => { closeResolved = true })
    await Promise.resolve()
    expect(closeResolved).toBe(false)
    durability.resolve()
    await accepted
    await close
    expect(() => fake.get(SMALL_PROJECT_ID)).toThrow('closed')
  })
})
