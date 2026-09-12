import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { apply, inject, projectDomainSpec } from '../../packages/workbench/src/integration/harness-rc6/product-host.js'
import { internalProductResult } from '../../packages/workbench/src/application/product-handler.js'
import { ProjectService } from '../../packages/workbench/src/application/project-service.js'
import { TableProjectRepository } from '../../packages/workbench/src/application/project-repository.js'
import type { ProjectId } from '../../packages/workbench/src/domain/ids.js'
import type { StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import { SMALL_PROJECT_ID, OTHER_PROJECT_ID } from './helpers/synthetic-records.js'

const api = { apiVersion: 'pmwb-product-v1' }
const command = { ...api, projectId: SMALL_PROJECT_ID, commandId: '10000000-0000-4000-8000-000000000001', expectedVersion: 0,
  payload: { kind: 'project.create', name: 'Synthetic lifecycle', researchGoal: null, syntheticDataAttested: true } }
function deferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  const promise = new Promise<T>(done => { resolve = done })
  return { promise, resolve }
}
function makeHostContext(options: { openError?: unknown; tableError?: unknown; registrationError?: unknown;
  routeDispose?: () => Promise<void>; closeError?: unknown; duringRegistration?: (handler: ConnectionRpcHandler) => void } = {}) {
  const events: string[] = []
  const table = createFakeDomainTable<ProjectId, StoredProjectRecord>()
  let handler!: ConnectionRpcHandler
  const domain = { closed: false,
    table(name: string) { expect(name).toBe('projects'); if (options.tableError) throw options.tableError; return table },
    async close() { events.push('domain.close'); await table.close(); domain.closed = true; if (options.closeError) throw options.closeError },
  }
  const ctx = { storageDomain: { async open(spec: unknown) {
    events.push('domain.open'); expect(spec).toBe(projectDomainSpec)
    if (options.openError) throw options.openError
    return domain
  } }, connection: { rpc: { handle(channel: string, registered: ConnectionRpcHandler, routeOptions: unknown) {
    events.push('route.handle')
    expect(channel).toBe('/dsh-pm-workbench-product-v1')
    expect(routeOptions).toEqual({ authority: 'loopback' })
    handler = registered
    options.duringRegistration?.(registered)
    if (options.registrationError) throw options.registrationError
    return () => { events.push('route.dispose'); return options.routeDispose?.() ?? Promise.resolve() }
  } } } } as unknown as Context
  const call = (endpoint = 'health', payload: unknown = api, signal = new AbortController().signal) => handler(endpoint, payload, signal)
  return { ctx, events, table, domain, call }
}
function observeRepositoryClose(events: string[], error?: unknown) {
  const close = TableProjectRepository.prototype.close
  return vi.spyOn(TableProjectRepository.prototype, 'close').mockImplementation(async function (this: TableProjectRepository) {
    events.push('repository.close')
    await close.call(this)
    if (error) throw error
  })
}
afterEach(() => vi.restoreAllMocks())

describe('Product Host ownership and lifecycle', () => {
  it('opens before its single loopback registration and exposes the Product injection contract', async () => {
    const host = makeHostContext()
    const close = observeRepositoryClose(host.events)
    const dispose = await apply(host.ctx)
    expect(inject).toEqual(['connection', 'storageDomain', 'agents', 'subagents', 'agentDefaultModel', 'tools'])
    expect(host.events).toEqual(['domain.open', 'route.handle'])
    expect(await host.call()).toMatchObject({ ok: true, value: { status: 'accepted', value: { analysisMode: 'hybrid', modelAnalysis: true, realDataAllowed: true } } })
    await dispose()
    expect(host.events).toEqual(['domain.open', 'route.handle', 'route.dispose', 'repository.close', 'domain.close'])
    expect(close).toHaveBeenCalledTimes(1)
  })

  it('freezes the original command identity and nested payload before the registered route returns', async () => {
    const host = makeHostContext()
    const dispose = await apply(host.ctx)
    try {
      const input = { ...command, payload: { ...command.payload, name: 'Synthetic original A' } }
      const request = host.call('projects.command', input)
      input.projectId = OTHER_PROJECT_ID
      input.commandId = '20000000-0000-4000-8000-000000000002'
      input.payload.name = 'Synthetic replacement B'
      expect(await request).toEqual({ ok: true, value: {
        status: 'accepted', projectId: SMALL_PROJECT_ID, commandId: command.commandId,
        value: { projectVersion: 1, contentVersion: 0 },
      } })
      expect(host.table.get(SMALL_PROJECT_ID)).toMatchObject({
        kind: 'active', header: { id: SMALL_PROJECT_ID, name: 'Synthetic original A' },
        commandReceipts: [{ commandId: command.commandId }],
      })
      expect(host.table.get(OTHER_PROJECT_ID)).toBeUndefined()
      expect(host.table.size).toBe(1)
      expect(host.table.writeCount).toBe(1)
    } finally { await dispose() }
  })

  it('counts the originating request before synchronous service reentry can admit nested calls', async () => {
    const host = makeHostContext()
    const nested: ReturnType<ConnectionRpcHandler>[] = []
    let entered = false
    const dispatch = vi.spyOn(ProjectService.prototype, 'list').mockImplementation(async () => {
      if (!entered) {
        entered = true
        for (let i = 0; i < 16; i++) nested.push(host.call('projects.list'))
      }
      return { status: 'accepted', value: [] }
    })
    const dispose = await apply(host.ctx)
    try {
      const original = host.call('projects.list')
      // Execution and admission occur before the outer call returns.
      expect(nested).toHaveLength(16)
      expect(dispatch).toHaveBeenCalledTimes(16)
      expect(await nested[15]).toEqual(internalProductResult())
      const accepted = { ok: true, value: { status: 'accepted', value: [] } }
      expect(await original).toEqual(accepted)
      expect(await Promise.all(nested.slice(0, 15))).toEqual(Array.from({ length: 15 }, () => accepted))
    } finally { await dispose() }
  })

  it('settles synchronous signal-composition failures safely and releases their admission slots', async () => {
    const host = makeHostContext()
    const dispose = await apply(host.ctx)
    try {
      vi.spyOn(AbortSignal, 'any').mockImplementationOnce(() => { throw new Error('synthetic private signal failure') })
      expect(await host.call()).toEqual({ ok: false, error: { code: 'internal', message: 'Product request failed.', details: {} } })
      const requests = await Promise.all(Array.from({ length: 16 }, () => host.call()))
      expect(requests.every(result => result.ok)).toBe(true)
    } finally { await dispose() }
  })

  it('does not register a route or close an unowned domain when open fails', async () => {
    const error = new Error('synthetic open failure')
    const host = makeHostContext({ openError: error })
    await expect(apply(host.ctx)).rejects.toBe(error)
    expect(host.events).toEqual(['domain.open'])
  })

  it('closes an opened domain if table extraction fails and retains the original setup failure', async () => {
    const error = new Error('synthetic table failure')
    const host = makeHostContext({ tableError: error, closeError: new Error('synthetic close failure') })
    await expect(apply(host.ctx)).rejects.toBe(error)
    expect(host.events).toEqual(['domain.open', 'domain.close'])
    expect(host.domain.closed).toBe(true)
  })

  it('closes repository then domain if route registration fails despite cleanup failures', async () => {
    const error = new Error('synthetic registration failure')
    const host = makeHostContext({ registrationError: error, closeError: new Error('domain failure') })
    observeRepositoryClose(host.events, new Error('repository failure'))
    await expect(apply(host.ctx)).rejects.toBe(error)
    expect(host.events).toEqual(['domain.open', 'route.handle', 'repository.close', 'domain.close'])
    expect(host.domain.closed).toBe(true)
    expect(await host.call('projects.command', command)).toEqual(internalProductResult())
  })

  it('drains a request admitted synchronously during a failing registration before closing storage', async () => {
    const gate = deferred<Awaited<ReturnType<ProjectService['list']>>>()
    vi.spyOn(ProjectService.prototype, 'list').mockReturnValue(gate.promise)
    let request!: ReturnType<ConnectionRpcHandler>
    const error = new Error('registration failure')
    const host = makeHostContext({ registrationError: error,
      duringRegistration: handler => { request = handler('projects.list', api, new AbortController().signal) } })
    observeRepositoryClose(host.events)
    const mounting = apply(host.ctx)
    const failed = expect(mounting).rejects.toBe(error)
    await Promise.resolve(); await Promise.resolve()
    expect(host.domain.closed).toBe(false)
    gate.resolve({ status: 'accepted', value: [] })
    expect(await request).toMatchObject({ ok: true, value: { status: 'rejected', error: { code: 'cancelled' } } })
    await failed
    expect(host.events.at(-1)).toBe('domain.close')
  })

  it('rejects the seventeenth request and drains the sixteen admitted requests on dispose', async () => {
    const gate = deferred<Awaited<ReturnType<ProjectService['list']>>>()
    let signal: AbortSignal | undefined
    const dispatch = vi.spyOn(ProjectService.prototype, 'list').mockImplementation((_input, currentSignal) => {
      signal = currentSignal
      return gate.promise
    })
    const host = makeHostContext()
    const dispose = await apply(host.ctx)
    const requests = Array.from({ length: 17 }, () => host.call('projects.list'))
    expect(await requests[16]).toEqual(internalProductResult())
    expect(dispatch).toHaveBeenCalledTimes(16)
    const closing = dispose()
    await Promise.resolve(); await Promise.resolve()
    expect(signal?.aborted).toBe(true)
    expect(host.domain.closed).toBe(false)
    expect(await host.call('projects.command', command)).toEqual(internalProductResult())
    gate.resolve({ status: 'accepted', value: [] })
    expect(await Promise.all(requests.slice(0, 16))).toEqual(Array.from({ length: 16 }, () => ({ ok: true, value: { status: 'rejected', error: { code: 'cancelled' } } })))
    await closing
    expect(host.domain.closed).toBe(true)
  })

  it('releases admission slots after completed requests', async () => {
    const host = makeHostContext()
    const dispose = await apply(host.ctx)
    const results = await Promise.all(Array.from({ length: 16 }, () => host.call()))
    expect(results.every(result => result.ok)).toBe(true)
    expect((await host.call()).ok).toBe(true)
    await dispose()
  })

  it('returns the same promise for repeated and synchronous reentrant disposal and stops admission immediately', async () => {
    let dispose!: () => Promise<void>
    let reentrant!: Promise<void>
    let lateRequest!: ReturnType<ConnectionRpcHandler>
    const host = makeHostContext({ routeDispose: () => {
      reentrant = dispose()
      lateRequest = host.call('projects.command', command)
      return Promise.resolve()
    } })
    dispose = await apply(host.ctx)
    const first = dispose()
    expect(dispose()).toBe(first)
    expect(await host.call('projects.command', command)).toEqual(internalProductResult())
    await first
    expect(reentrant).toBe(first)
    expect(dispose()).toBe(first)
    expect(await lateRequest).toEqual(internalProductResult())
    expect(host.events.filter(event => event === 'route.dispose')).toHaveLength(1)
    expect(host.table.writeCount).toBe(0)
  })

  it.each(['route', 'repository', 'domain'] as const)('retains the first %s teardown failure after attempting every cleanup', async first => {
    const errors = { route: new Error('route failure'), repository: new Error('repository failure'), domain: new Error('domain failure') }
    const gate = deferred<Awaited<ReturnType<ProjectService['list']>>>()
    let signal: AbortSignal | undefined
    vi.spyOn(ProjectService.prototype, 'list').mockImplementation((_input, inputSignal) => { signal = inputSignal; return gate.promise })
    const host = makeHostContext({ routeDispose: () => { if (first === 'route') throw errors.route; return Promise.resolve() }, closeError: errors.domain })
    observeRepositoryClose(host.events, first !== 'domain' ? errors.repository : undefined)
    const dispose = await apply(host.ctx)
    const request = host.call('projects.list')
    const closing = dispose()
    const failed = expect(closing).rejects.toBe(errors[first])
    await Promise.resolve(); await Promise.resolve()
    expect(signal?.aborted).toBe(true)
    expect(host.domain.closed).toBe(false)
    gate.resolve({ status: 'accepted', value: [] })
    await request
    await failed
    expect(dispose()).toBe(closing)
    expect(host.events).toEqual(['domain.open', 'route.handle', 'route.dispose', 'repository.close', 'domain.close'])
    expect(host.domain.closed).toBe(true)
  })

  it('drains an already admitted durable write and suppresses its success before awaited teardown', async () => {
    const host = makeHostContext()
    const durable = deferred()
    host.table.deferNextWrite(durable.promise)
    const writeStarted = deferred()
    const put = host.table.put.bind(host.table)
    vi.spyOn(host.table, 'put').mockImplementation((key, value) => { const write = put(key, value); writeStarted.resolve(); return write })
    observeRepositoryClose(host.events)
    const dispose = await apply(host.ctx)
    const observed: unknown[] = []
    const request = host.call('projects.command', command).then(result => { observed.push(result); return result })
    await writeStarted.promise
    const closing = dispose()
    let finished = false
    void closing.then(() => { finished = true })
    await Promise.resolve(); await Promise.resolve()
    expect(finished).toBe(false)
    expect(host.domain.closed).toBe(false)
    durable.resolve()
    expect(await request).toEqual({ ok: true, value: { status: 'rejected', projectId: SMALL_PROJECT_ID, commandId: command.commandId, error: { code: 'cancelled' } } })
    await closing
    expect(host.table.writeCount).toBe(1)
    expect(observed).toHaveLength(1)
    expect(host.domain.closed).toBe(true)
    const frozenObservations = [...observed]
    await Promise.resolve(); await Promise.resolve()
    expect(observed).toEqual(frozenObservations)
    expect(await host.call('projects.command', command)).toEqual(internalProductResult())
    expect(host.table.writeCount).toBe(1)
  })
})
