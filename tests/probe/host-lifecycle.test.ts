import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { describe, expect, it, vi } from 'vitest'

import {
  apply,
  inject,
  probeDomainSpec,
} from '../../packages/workbench/src/integration/harness-rc6/probe-host.js'

type ProbeDomain = Awaited<ReturnType<Context['storageDomain']['open']>>

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function createDomain(options: {
  onSet?: (next: typeof probeDomainSpec.global.initial) => Promise<void>
  onClose?: () => void
} = {}) {
  let state = structuredClone(probeDomainSpec.global.initial)
  const close = vi.fn(async () => { options.onClose?.() })
  const set = vi.fn(async (next: typeof state) => {
    await options.onSet?.(next)
    state = structuredClone(next)
  })
  const domain = {
    name: probeDomainSpec.name,
    global: {
      get: () => state,
      set,
    },
    table: vi.fn(() => { throw new Error('Probe declares no tables') }),
    close,
  } as unknown as ProbeDomain
  return { domain, close, set, getState: () => structuredClone(state) }
}

function createContext(options: {
  domain: ProbeDomain
  handle: (channel: string, handler: ConnectionRpcHandler, options: { authority: 'trusted-host' | 'loopback' }) => () => Promise<void>
}) {
  const open = vi.fn(async () => options.domain)
  const handle = vi.fn(options.handle)
  const ctx = {
    storageDomain: { open },
    connection: { rpc: { handle } },
  } as unknown as Context
  return { ctx, handle, open }
}

function incrementInput(index: number, expectedVersion = 0) {
  return {
    apiVersion: 'pmwb-v1',
    expectedVersion,
    commandId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
    delta: 1,
  }
}

describe('Probe Host lifecycle', () => {
  it('closes the opened Domain when route registration fails', async () => {
    const { domain, close } = createDomain()
    const routeFailure = new Error('route-registration-canary')
    const { ctx } = createContext({
      domain,
      handle: () => { throw routeFailure },
    })

    await expect(apply(ctx)).rejects.toBe(routeFailure)
    expect(close).toHaveBeenCalledOnce()
  })

  it('opens the exact synthetic Domain and registers one loopback-only channel', async () => {
    const { domain, close } = createDomain()
    const disposeRoute = vi.fn(async () => {})
    const { ctx, handle, open } = createContext({ domain, handle: () => disposeRoute })

    const dispose = await apply(ctx)

    expect(inject).toEqual(['connection', 'storageDomain'])
    expect(probeDomainSpec).toMatchObject({
      name: 'dsh_pm_workbench_probe',
      version: 1,
      tables: {},
    })
    expect(probeDomainSpec.global.schema.safeParse(probeDomainSpec.global.initial).success).toBe(true)
    expect(open).toHaveBeenCalledOnce()
    expect(open).toHaveBeenCalledWith(probeDomainSpec)
    expect(handle).toHaveBeenCalledOnce()
    expect(handle).toHaveBeenCalledWith(
      '/dsh-pm-workbench-v1',
      expect.any(Function),
      { authority: 'loopback' },
    )

    await dispose()
    expect(disposeRoute).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('admits at most sixteen handlers and refuses the seventeenth before storage work', async () => {
    const commitBarrier = deferred()
    let firstSet = true
    const { domain, set, getState } = createDomain({
      onSet: async () => {
        if (!firstSet) return
        firstSet = false
        await commitBarrier.promise
      },
    })
    let routeHandler: ConnectionRpcHandler | undefined
    const { ctx } = createContext({
      domain,
      handle: (_channel, handler) => {
        routeHandler = handler
        return async () => {}
      },
    })
    const dispose = await apply(ctx)
    if (!routeHandler) throw new Error('Route handler was not registered')

    const requests = Array.from({ length: 16 }, (_, index) =>
      routeHandler!('counter.increment', incrementInput(index + 1), new AbortController().signal),
    )
    await vi.waitFor(() => expect(set).toHaveBeenCalledOnce())
    const writesBeforeRefusal = set.mock.calls.length
    const refused = await routeHandler(
      'counter.increment',
      incrementInput(17),
      new AbortController().signal,
    )

    expect(refused).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Probe request failed.', details: {} },
    })
    expect(set).toHaveBeenCalledTimes(writesBeforeRefusal)
    commitBarrier.resolve()
    await Promise.all(requests)
    expect(Object.keys(getState().commandReceipts)).toHaveLength(16)
    expect(getState().commandReceipts).not.toHaveProperty(incrementInput(17).commandId)
    await dispose()
  })

  it('reduces arbitrary storage failures to the fixed safe carrier envelope', async () => {
    const { domain } = createDomain()
    const canary = 'CANARY_TOKEN_sk-fake-91f7 /Users/private/transcript.md'
    Object.defineProperty(domain.global, 'get', {
      value: () => { throw new Error(canary) },
    })
    let routeHandler: ConnectionRpcHandler | undefined
    const { ctx } = createContext({
      domain,
      handle: (_channel, handler) => {
        routeHandler = handler
        return async () => {}
      },
    })
    const dispose = await apply(ctx)
    if (!routeHandler) throw new Error('Route handler was not registered')

    const result = await routeHandler('health', {}, new AbortController().signal)
    expect(result).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Probe request failed.', details: {} },
    })
    expect(JSON.stringify(result)).not.toMatch(/CANARY|Users|transcript|token/i)
    await dispose()
  })

  it('stops admission synchronously and disposes in one ordered idempotent operation', async () => {
    const events: string[] = []
    const routeBarrier = deferred()
    const commitBarrier = deferred()
    let firstSet = true
    const { domain } = createDomain({
      onSet: async () => {
        events.push('set:start')
        if (firstSet) {
          firstSet = false
          await commitBarrier.promise
        }
        events.push('set:end')
      },
      onClose: () => events.push('domain:close'),
    })
    let routeHandler: ConnectionRpcHandler | undefined
    const { ctx } = createContext({
      domain,
      handle: (_channel, handler) => {
        routeHandler = handler
        return async () => {
          events.push('route:start')
          await routeBarrier.promise
          events.push('route:end')
        }
      },
    })
    const dispose = await apply(ctx)
    if (!routeHandler) throw new Error('Route handler was not registered')

    const committing = routeHandler(
      'counter.increment',
      incrementInput(1),
      new AbortController().signal,
    )
    const queued = routeHandler(
      'counter.increment',
      incrementInput(2),
      new AbortController().signal,
    )
    await Promise.resolve()

    const firstDispose = dispose()
    const secondDispose = dispose()
    expect(secondDispose).toBe(firstDispose)
    await Promise.resolve()
    expect(events).toContain('route:start')
    expect(await routeHandler('health', {}, new AbortController().signal)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Probe request failed.', details: {} },
    })

    routeBarrier.resolve()
    await Promise.resolve()
    expect(events).toContain('route:end')
    expect(events).not.toContain('domain:close')
    commitBarrier.resolve()

    await expect(committing).resolves.toMatchObject({ ok: true })
    await expect(queued).resolves.toEqual({
      ok: false,
      error: { code: 'cancelled', message: 'Probe request cancelled.', details: {} },
    })
    await firstDispose
    expect(events.at(-1)).toBe('domain:close')
  })

  it('still drains handlers and closes the Domain when route removal fails', async () => {
    const routeFailure = new Error('route-disposal-canary')
    const { domain, close } = createDomain()
    const disposeRoute = vi.fn(async () => { throw routeFailure })
    const { ctx } = createContext({ domain, handle: () => disposeRoute })
    const dispose = await apply(ctx)

    const first = dispose()
    const second = dispose()
    expect(second).toBe(first)
    await expect(first).rejects.toBe(routeFailure)
    expect(disposeRoute).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('publishes the stable disposal promise before route cleanup can synchronously reenter', async () => {
    const { domain, close } = createDomain()
    let dispose: (() => Promise<void>) | undefined
    let reentered: Promise<void> | undefined
    const disposeRoute = vi.fn(async () => {
      reentered = dispose?.()
    })
    const { ctx } = createContext({ domain, handle: () => disposeRoute })
    dispose = await apply(ctx)

    const first = dispose()
    await first

    expect(reentered).toBe(first)
    expect(disposeRoute).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })
})
