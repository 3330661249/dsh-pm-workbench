import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import { createElement, type ComponentType } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  mountProbeClient,
  type ProbeClientContext,
} from '../../packages/workbench/src/client/probe/index.js'
import type { ProbeStore } from '../../packages/workbench/src/client/probe/store.js'

type SlotComponent = ComponentType<Record<string, unknown>>
type LiveSlotRegistry = Map<string, SlotComponent>
type SlotCleanupFailures = Partial<Record<string, Error>>

function createStore(events: string[], disposeFailure?: Error): ProbeStore {
  const snapshot = { isOpen: false, phase: 'closed' } as const
  return {
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    open: vi.fn(async () => {}),
    close: vi.fn(() => {}),
    refresh: vi.fn(async () => {}),
    increment: vi.fn(async () => {}),
    dispose: vi.fn(() => {
      events.push('store.dispose')
      if (disposeFailure) throw disposeFailure
    }),
  } as unknown as ProbeStore
}

function createContext(
  events: string[],
  live: LiveSlotRegistry = new Map(),
  cleanupFailures: SlotCleanupFailures = {},
) {
  const registrations: Array<{
    name: string
    id: string
    component: SlotComponent
  }> = []
  const slots = {
    inject: vi.fn((name: string, callback: () => () => void) => {
      events.push(`inject:${name}`)
      const disposeRegistration = callback()
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        events.push(`inject.dispose:${name}`)
        disposeRegistration()
        const failure = cleanupFailures[name]
        if (failure) throw failure
      }
    }),
    register: vi.fn((options: { name: string; id: string }, component: SlotComponent) => {
      const key = `${options.name}:${options.id}`
      if (live.has(key)) throw new Error(`duplicate live slot: ${key}`)
      live.set(key, component)
      registrations.push({ ...options, component })
      events.push(`register:${options.name}:${options.id}`)
      let disposed = false
      return () => {
        if (disposed) return
        disposed = true
        events.push(`register.dispose:${options.name}:${options.id}`)
        live.delete(key)
      }
    }),
  }
  const ctx = {
    connection: { rpc: { call: vi.fn() } },
    slots,
  } as unknown as ProbeClientContext
  return { ctx, slots, registrations, live }
}

describe('Probe Client lifecycle', () => {
  it('contributes exactly one additive launcher and one additive overlay', () => {
    const events: string[] = []
    const store = createStore(events)
    const { ctx, slots, registrations } = createContext(events)

    const dispose = mountProbeClient(ctx, store)

    expect(slots.inject.mock.calls.map(([name]) => name)).toEqual([
      'sidebar.footer.action',
      'shell.overlay',
    ])
    expect(registrations.map(({ name, id }) => ({ name, id }))).toEqual([
      { name: 'sidebar.footer.action', id: 'pm-workbench-probe-launcher' },
      { name: 'shell.overlay', id: 'pm-workbench-probe-overlay' },
    ])
    expect(registrations.some(({ name }) => name === 'root')).toBe(false)

    const launcher = createElement(registrations[0]!.component, { wide: true })
    const overlay = createElement(registrations[1]!.component, {})
    expect(renderToStaticMarkup(launcher)).toContain('data-dsh-pm-workbench="launcher"')
    expect(renderToStaticMarkup(overlay)).toBe('')

    dispose()
  })

  it('tears down both slot controllers before the store and remains idempotent', () => {
    const events: string[] = []
    const store = createStore(events)
    const { ctx } = createContext(events)
    const dispose = mountProbeClient(ctx, store)

    events.length = 0
    dispose()
    dispose()

    expect(events).toEqual([
      'inject.dispose:shell.overlay',
      'register.dispose:shell.overlay:pm-workbench-probe-overlay',
      'inject.dispose:sidebar.footer.action',
      'register.dispose:sidebar.footer.action:pm-workbench-probe-launcher',
      'store.dispose',
    ])
    expect(store.dispose).toHaveBeenCalledOnce()
  })

  it('can remount after disposal without leaving duplicate live registrations', () => {
    const events: string[] = []
    const live: LiveSlotRegistry = new Map()
    const firstStore = createStore(events)
    const shared = createContext(events, live)
    const disposeFirst = mountProbeClient(shared.ctx, firstStore)
    const liveCounts = [live.size]
    disposeFirst()
    liveCounts.push(live.size)

    const secondStore = createStore(events)
    const disposeSecond = mountProbeClient(shared.ctx, secondStore)
    liveCounts.push(live.size)

    expect(shared.registrations).toHaveLength(4)
    expect(shared.slots.register).toHaveBeenCalledTimes(4)
    disposeSecond()
    liveCounts.push(live.size)
    expect(liveCounts).toEqual([2, 0, 2, 0])
  })

  it('keeps setup failure primary while cleanup failures remain best effort', () => {
    const events: string[] = []
    const setupFailure = new Error('overlay-registration-canary')
    const launcherCleanupFailure = new Error('launcher-cleanup-canary')
    const storeCleanupFailure = new Error('store-cleanup-canary')
    const live: LiveSlotRegistry = new Map()
    const store = createStore(events, storeCleanupFailure)
    const { ctx } = createContext(events, live, {
      'sidebar.footer.action': launcherCleanupFailure,
    })
    let calls = 0
    const originalInject = ctx.slots.inject.bind(ctx.slots)
    ctx.slots.inject = ((...args: Parameters<ClientContext['slots']['inject']>) => {
      calls += 1
      if (calls === 2) throw setupFailure
      return originalInject(...args)
    }) as ClientContext['slots']['inject']

    let thrown: unknown
    try {
      mountProbeClient(ctx, store)
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(setupFailure)
    expect(events).toContain('inject.dispose:sidebar.footer.action')
    expect(events.at(-1)).toBe('store.dispose')
    expect(store.dispose).toHaveBeenCalledOnce()
    expect(live.size).toBe(0)
  })

  it('teardown runs every cleanup and then throws the first failure', () => {
    const events: string[] = []
    const overlayFailure = new Error('overlay-cleanup-canary')
    const launcherFailure = new Error('launcher-cleanup-canary')
    const storeFailure = new Error('store-cleanup-canary')
    const live: LiveSlotRegistry = new Map()
    const store = createStore(events, storeFailure)
    const { ctx } = createContext(events, live, {
      'shell.overlay': overlayFailure,
      'sidebar.footer.action': launcherFailure,
    })
    const dispose = mountProbeClient(ctx, store)

    events.length = 0
    let thrown: unknown
    try {
      dispose()
    } catch (error) {
      thrown = error
    }

    expect(thrown).toBe(overlayFailure)
    expect(events).toEqual([
      'inject.dispose:shell.overlay',
      'register.dispose:shell.overlay:pm-workbench-probe-overlay',
      'inject.dispose:sidebar.footer.action',
      'register.dispose:sidebar.footer.action:pm-workbench-probe-launcher',
      'store.dispose',
    ])
    expect(store.dispose).toHaveBeenCalledOnce()
    expect(live.size).toBe(0)
    expect(() => { dispose() }).not.toThrow()
  })
})
