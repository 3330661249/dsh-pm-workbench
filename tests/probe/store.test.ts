import { describe, expect, it, vi } from 'vitest'

import {
  createProbeStore,
  type ProbeStoreTransport,
} from '../../packages/workbench/src/client/probe/store.js'

const health = (counter: number, aggregateVersion = counter) => ({
  status: 'accepted' as const,
  value: {
    mode: 'gate-a-probe' as const,
    capabilities: {
      apiVersion: 'pmwb-v1' as const,
      wireSchemaVersion: '1' as const,
      dataSchemaVersion: '1' as const,
      pluginVersion: '0.1.0' as const,
      harnessTarget: '0.1.0-rc.6' as const,
      maxRpcPayloadUtf8Bytes: 4096 as const,
      maxTextUtf8Bytes: 0 as const,
      maxReadPageUtf8Bytes: 4096 as const,
      maxCommandReceiptsPerAggregate: 256 as const,
      maxReceiptLedgerPersistedBytes: 1_048_576 as const,
      maxClientInflightRequests: 8 as const,
      maxHostInflightRequests: 16 as const,
      supportedFeatures: ['health', 'synthetic-counter'] as const,
      storage: 'synthetic-counter-only' as const,
      analysis: 'none' as const,
    },
    counter,
    aggregateVersion,
  },
})

const acceptedIncrement = (counter: number, aggregateVersion = counter) => ({
  status: 'accepted' as const,
  value: { counter, aggregateVersion },
})

const rejectedIncrement = {
  status: 'rejected' as const,
  error: {
    code: 'version-conflict' as const,
    messageKey: 'workbench.error.version-conflict' as const,
  },
}

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((resolvePromise) => { resolve = resolvePromise })
  return { promise, resolve }
}

function scriptedTransport(overrides: Partial<ProbeStoreTransport> = {}): ProbeStoreTransport {
  return {
    health: async () => ({ ok: true, value: health(0) }),
    increment: async () => ({ ok: true, value: acceptedIncrement(1) }),
    ...overrides,
  }
}

describe('Probe store', () => {
  it('opens a fresh generation and immediately refreshes the authoritative health snapshot', async () => {
    let seenSignal: AbortSignal | undefined
    const store = createProbeStore(scriptedTransport({
      health: async (signal) => {
        seenSignal = signal
        return { ok: true, value: health(3) }
      },
    }))

    await store.open()

    expect(seenSignal?.aborted).toBe(false)
    expect(store.getSnapshot()).toMatchObject({
      isOpen: true,
      phase: 'ready',
      authoritative: { counter: 3, aggregateVersion: 3 },
    })
  })

  it('keeps the authoritative snapshot after business rejection, malformed output, failure, or cancellation', async () => {
    const responses = [
      { ok: true as const, value: rejectedIncrement },
      { ok: false as const, error: { code: 'protocol-invalid' as const, uncertain: true } },
      { ok: false as const, error: { code: 'host-unavailable' as const, uncertain: true } },
      { ok: false as const, error: { code: 'cancelled' as const, uncertain: true } },
    ]
    for (const response of responses) {
      const store = createProbeStore(scriptedTransport({
        health: async () => ({ ok: true, value: health(4) }),
        increment: async () => response,
      }), { createCommandId: () => '00000000-0000-4000-8000-000000000010' })
      await store.open()
      await store.increment()
      expect(store.getSnapshot().authoritative).toMatchObject({ counter: 4, aggregateVersion: 4 })
    }
  })

  it('blocks another write after conflict until a successful refresh establishes a new version', async () => {
    const increment = vi.fn()
      .mockResolvedValueOnce({ ok: true as const, value: rejectedIncrement })
      .mockResolvedValueOnce({ ok: true as const, value: acceptedIncrement(6) })
    const healthResponses = [health(4), health(5)]
    const commandIds = [
      '00000000-0000-4000-8000-000000000010',
      '00000000-0000-4000-8000-000000000011',
    ]
    const store = createProbeStore(scriptedTransport({
      health: async () => ({ ok: true, value: healthResponses.shift()! }),
      increment,
    }), { createCommandId: () => commandIds.shift()! })
    await store.open()

    await store.increment()
    expect(store.getSnapshot()).toMatchObject({ phase: 'error', error: 'version-conflict' })

    await store.increment()
    expect(increment).toHaveBeenCalledTimes(1)

    await store.refresh()
    expect(store.getSnapshot()).toMatchObject({
      phase: 'ready',
      authoritative: { counter: 5, aggregateVersion: 5 },
    })

    await store.increment()
    expect(increment).toHaveBeenCalledTimes(2)
    expect(increment).toHaveBeenLastCalledWith({
      apiVersion: 'pmwb-v1',
      expectedVersion: 5,
      commandId: '00000000-0000-4000-8000-000000000011',
      delta: 1,
    }, expect.any(AbortSignal))
    expect(store.getSnapshot()).toMatchObject({
      phase: 'ready',
      authoritative: { counter: 6, aggregateVersion: 6 },
    })
  })

  it('ignores lower versions and rejects same-version snapshots with a different counter', async () => {
    const healthResponses = [health(5), health(4), health(7, 5)]
    const store = createProbeStore(scriptedTransport({
      health: async () => ({ ok: true, value: healthResponses.shift()! }),
    }))

    await store.open()
    await store.refresh()
    expect(store.getSnapshot()).toMatchObject({
      phase: 'ready',
      authoritative: { counter: 5, aggregateVersion: 5 },
    })

    await store.refresh()
    expect(store.getSnapshot()).toMatchObject({
      phase: 'error',
      error: 'protocol-invalid',
      authoritative: { counter: 5, aggregateVersion: 5 },
    })
  })

  it('uses the authoritative version for +1 and accepts only the validated accepted result', async () => {
    const increment = vi.fn(async () => ({ ok: true as const, value: acceptedIncrement(2) }))
    const store = createProbeStore(scriptedTransport({
      health: async () => ({ ok: true, value: health(1) }),
      increment,
    }), { createCommandId: () => '00000000-0000-4000-8000-000000000011' })
    await store.open()

    await store.increment()

    expect(increment).toHaveBeenCalledWith({
      apiVersion: 'pmwb-v1',
      expectedVersion: 1,
      commandId: '00000000-0000-4000-8000-000000000011',
      delta: 1,
    }, expect.any(AbortSignal))
    expect(store.getSnapshot()).toMatchObject({
      phase: 'ready',
      authoritative: { counter: 2, aggregateVersion: 2 },
    })
  })

  it('ignores completion from a closed generation and refreshes again after reopen', async () => {
    const first = deferred<ReturnType<typeof health>>()
    const second = deferred<ReturnType<typeof health>>()
    const signals: AbortSignal[] = []
    let call = 0
    const store = createProbeStore(scriptedTransport({
      health: async (signal) => {
        signals.push(signal ?? new AbortController().signal)
        return { ok: true, value: await (++call === 1 ? first.promise : second.promise) }
      },
    }))

    const firstOpen = store.open()
    store.close()
    expect(signals[0]?.aborted).toBe(true)
    const secondOpen = store.open()
    first.resolve(health(8))
    await firstOpen
    expect(store.getSnapshot().authoritative).toBeUndefined()
    second.resolve(health(2))
    await secondOpen
    expect(store.getSnapshot().authoritative).toMatchObject({ counter: 2, aggregateVersion: 2 })
    expect(signals[1]?.aborted).toBe(false)
  })

  it('aborts on close and queues focus restoration to the launcher target', async () => {
    const queued: Array<() => void> = []
    let signal: AbortSignal | undefined
    const focus = vi.fn()
    const store = createProbeStore(scriptedTransport({
      health: async (receivedSignal) => {
        signal = receivedSignal
        return new Promise(() => {})
      },
    }), { schedule: (operation) => queued.push(operation) })

    void store.open({ focus })
    store.close()

    expect(signal?.aborted).toBe(true)
    expect(focus).not.toHaveBeenCalled()
    expect(queued).toHaveLength(1)
    queued[0]?.()
    expect(focus).toHaveBeenCalledOnce()
    expect(store.getSnapshot()).toMatchObject({ isOpen: false, phase: 'closed' })
  })

  it('disposes idempotently, aborts work, and stops listener delivery', async () => {
    const controllerSeen = deferred<AbortSignal>()
    const store = createProbeStore(scriptedTransport({
      health: async (signal) => {
        controllerSeen.resolve(signal!)
        return new Promise(() => {})
      },
    }))
    const listener = vi.fn()
    store.subscribe(listener)
    void store.open()
    const signal = await controllerSeen.promise

    store.dispose()
    store.dispose()

    expect(signal.aborted).toBe(true)
    const callsAfterDispose = listener.mock.calls.length
    store.close()
    expect(listener).toHaveBeenCalledTimes(callsAfterDispose)
    expect(store.getSnapshot()).toMatchObject({ isOpen: false, phase: 'closed' })
  })

  it('marks itself disposed before notifying listeners so synchronous reentry cannot restart work', async () => {
    const healthCall = vi.fn(async () => ({ ok: true as const, value: health(0) }))
    const incrementCall = vi.fn(async () => ({ ok: true as const, value: acceptedIncrement(1) }))
    const store = createProbeStore(scriptedTransport({
      health: healthCall,
      increment: incrementCall,
    }))
    await store.open()
    let notifications = 0
    store.subscribe(() => {
      notifications += 1
      void store.open()
      void store.increment()
      store.dispose()
    })

    store.dispose()
    await Promise.resolve()

    expect(notifications).toBe(1)
    expect(healthCall).toHaveBeenCalledOnce()
    expect(incrementCall).not.toHaveBeenCalled()
    expect(store.getSnapshot()).toEqual({ isOpen: false, phase: 'closed' })
  })
})
