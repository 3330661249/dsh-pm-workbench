import { describe, expect, it } from 'vitest'

import {
  initialProbeState,
  type ProbeState,
} from '../../packages/workbench/src/probe/protocol.js'
import {
  ProbeCancelledError,
  createProbeHandler,
  createProbeRepository,
  hashProbeIncrementRequest,
  type ProbeGlobal,
} from '../../packages/workbench/src/probe/service.js'

const FIRST_ID = '00000000-0000-4000-8000-000000000001'
const SECOND_ID = '00000000-0000-4000-8000-000000000002'

function increment(commandId = FIRST_ID, expectedVersion = 0) {
  return {
    apiVersion: 'pmwb-v1' as const,
    expectedVersion,
    commandId,
    delta: 1 as const,
  }
}

function cloneState(state: ProbeState): ProbeState {
  return structuredClone(state)
}

class MemoryGlobal implements ProbeGlobal {
  state: unknown
  setCalls = 0
  setHook?: (value: ProbeState) => Promise<void>

  constructor(state: unknown = initialProbeState) {
    this.state = structuredClone(state)
  }

  get(): unknown {
    return this.state
  }

  async set(value: ProbeState): Promise<void> {
    this.setCalls += 1
    if (this.setHook) return this.setHook(value)
    this.state = cloneState(value)
  }
}

function makeHarness(state?: unknown) {
  const global = new MemoryGlobal(state)
  const repository = createProbeRepository(global)
  const handler = createProbeHandler(repository)
  return { global, repository, handler }
}

function acceptedCounter(value: number) {
  return {
    ok: true,
    value: { status: 'accepted', value: { counter: value, aggregateVersion: value } },
  }
}

describe('Probe repository and service', () => {
  it('returns the exact initial health snapshot without writing', async () => {
    const { global, handler } = makeHarness()
    const result = await handler('health', {}, new AbortController().signal)

    expect(result).toEqual({
      ok: true,
      value: {
        status: 'accepted',
        value: {
          mode: 'gate-a-probe',
          capabilities: {
            apiVersion: 'pmwb-v1',
            wireSchemaVersion: '1',
            dataSchemaVersion: '1',
            pluginVersion: '0.1.0',
            harnessTarget: '0.1.0-rc.6',
            maxRpcPayloadUtf8Bytes: 4096,
            maxTextUtf8Bytes: 0,
            maxReadPageUtf8Bytes: 4096,
            maxCommandReceiptsPerAggregate: 256,
            maxReceiptLedgerPersistedBytes: 1_048_576,
            maxClientInflightRequests: 8,
            maxHostInflightRequests: 16,
            supportedFeatures: ['health', 'synthetic-counter'],
            storage: 'synthetic-counter-only',
            analysis: 'none',
          },
          counter: 0,
          aggregateVersion: 0,
        },
      },
    })
    expect(global.setCalls).toBe(0)
  })

  it('increments once and persists counter, version, hash, and accepted receipt atomically', async () => {
    const { global, handler } = makeHarness()
    const result = await handler('counter.increment', increment(), new AbortController().signal)

    expect(result).toEqual(acceptedCounter(1))
    expect(global.setCalls).toBe(1)
    expect(global.state).toMatchObject({ schemaVersion: 1, syntheticCounter: 1, aggregateVersion: 1 })
    const state = global.state as ProbeState
    expect(Object.keys(state.commandReceipts)).toEqual([FIRST_ID])
    expect(state.commandReceipts[FIRST_ID].canonicalRequestHash).toMatch(/^[0-9a-f]{64}$/)
    expect(state.commandReceipts[FIRST_ID].outcome).toEqual(acceptedCounter(1).value)
  })

  it('replays the first outcome for the same command and hash without another write', async () => {
    const { global, handler } = makeHarness()
    const request = increment()
    const first = await handler('counter.increment', request, new AbortController().signal)
    const replay = await handler('counter.increment', { ...request }, new AbortController().signal)

    expect(replay).toEqual(first)
    expect(global.setCalls).toBe(1)
    expect((global.state as ProbeState).syntheticCounter).toBe(1)
  })

  it('hashes the endpoint and strict intent while excluding only commandId', () => {
    expect(hashProbeIncrementRequest(increment(FIRST_ID, 0))).toBe(
      '6494739485e64c67aae0ec1fff72a081cc0be7a753748413e2710cb4b70f37e1',
    )
    expect(hashProbeIncrementRequest(increment(SECOND_ID, 0))).toBe(
      hashProbeIncrementRequest(increment(FIRST_ID, 0)),
    )
    expect(hashProbeIncrementRequest(increment(FIRST_ID, 1))).not.toBe(
      hashProbeIncrementRequest(increment(FIRST_ID, 0)),
    )
  })

  it('rejects a reused command ID with a different hash and preserves the original receipt', async () => {
    const { global, handler } = makeHarness()
    await handler('counter.increment', increment(FIRST_ID, 0), new AbortController().signal)
    const before = cloneState(global.state as ProbeState)
    const result = await handler('counter.increment', increment(FIRST_ID, 1), new AbortController().signal)

    expect(result).toEqual({
      ok: true,
      value: {
        status: 'rejected',
        error: {
          code: 'idempotency-key-reused',
          messageKey: 'workbench.error.idempotency-key-reused',
        },
      },
    })
    expect(global.setCalls).toBe(1)
    expect(global.state).toEqual(before)
  })

  it('stores the first version conflict and replays it before a later CAS check', async () => {
    const { global, handler } = makeHarness()
    const stale = increment(FIRST_ID, 1)
    const conflict = await handler('counter.increment', stale, new AbortController().signal)
    expect(conflict).toEqual({
      ok: true,
      value: {
        status: 'rejected',
        error: { code: 'version-conflict', messageKey: 'workbench.error.version-conflict' },
      },
    })
    expect(global.setCalls).toBe(1)

    expect(await handler('counter.increment', increment(SECOND_ID, 0), new AbortController().signal)).toEqual(acceptedCounter(1))
    expect(await handler('counter.increment', stale, new AbortController().signal)).toEqual(conflict)
    expect(global.setCalls).toBe(2)
    expect((global.state as ProbeState).syntheticCounter).toBe(1)
  })

  it('serializes racing version-zero commands so exactly one increments', async () => {
    const { global, handler } = makeHarness()
    const [first, second] = await Promise.all([
      handler('counter.increment', increment(FIRST_ID, 0), new AbortController().signal),
      handler('counter.increment', increment(SECOND_ID, 0), new AbortController().signal),
    ])

    expect([first, second].filter((result) => result.ok && (result.value as { status?: string }).status === 'accepted')).toHaveLength(1)
    expect([first, second].filter((result) => result.ok && (result.value as { status?: string }).status === 'rejected')).toHaveLength(1)
    expect((global.state as ProbeState).syntheticCounter).toBe(1)
    expect((global.state as ProbeState).aggregateVersion).toBe(1)
    expect(Object.keys((global.state as ProbeState).commandReceipts)).toHaveLength(2)
  })

  it('refuses a 257th new receipt while keeping all existing receipts replayable', async () => {
    const conflictOutcome = {
      status: 'rejected' as const,
      error: { code: 'version-conflict' as const, messageKey: 'workbench.error.version-conflict' as const },
    }
    const commandReceipts = Object.fromEntries(
      Array.from({ length: 256 }, (_, index) => [
        `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
        { canonicalRequestHash: 'a'.repeat(64), outcome: conflictOutcome },
      ]),
    )
    commandReceipts[FIRST_ID] = {
      canonicalRequestHash: hashProbeIncrementRequest(increment(FIRST_ID, 0)),
      outcome: conflictOutcome,
    }
    const state: ProbeState = { schemaVersion: 1, syntheticCounter: 0, aggregateVersion: 0, commandReceipts }
    const { global, handler } = makeHarness(state)
    const rejected = await handler(
      'counter.increment',
      increment('00000000-0000-4000-8000-000000000100', 0),
      new AbortController().signal,
    )
    expect(rejected).toEqual({
      ok: true,
      value: {
        status: 'rejected',
        error: { code: 'limit-exceeded', messageKey: 'workbench.error.limit-exceeded' },
      },
    })
    expect(global.setCalls).toBe(0)

    const existingRequest = increment(FIRST_ID, 0)
    const existingReplay = await handler('counter.increment', existingRequest, new AbortController().signal)
    expect(existingReplay).toMatchObject({
      ok: true,
      value: { status: 'rejected', error: { code: 'version-conflict' } },
    })
    expect(global.setCalls).toBe(0)
  })

  it('does not mutate the object returned by global.get()', async () => {
    const frozen = Object.freeze({
      ...initialProbeState,
      commandReceipts: Object.freeze({}),
    })
    const { global, handler } = makeHarness(frozen)
    global.state = frozen
    await handler('counter.increment', increment(), new AbortController().signal)

    expect(frozen).toEqual(initialProbeState)
    expect(global.state).not.toBe(frozen)
    expect((global.state as ProbeState).syntheticCounter).toBe(1)
  })

  it('keeps the queue usable after a rejected write', async () => {
    const { global, handler } = makeHarness()
    let rejectOnce = true
    global.setHook = async (value) => {
      if (rejectOnce) {
        rejectOnce = false
        throw new Error('private storage canary')
      }
      global.state = cloneState(value)
    }

    const failed = await handler('counter.increment', increment(FIRST_ID), new AbortController().signal)
    const succeeded = await handler('counter.increment', increment(SECOND_ID), new AbortController().signal)
    expect(failed).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Probe request failed.', details: {} },
    })
    expect(JSON.stringify(failed)).not.toContain('private storage canary')
    expect(succeeded).toEqual(acceptedCounter(1))
  })

  it('validates every read and candidate write without touching corrupt storage', async () => {
    const corrupt = { ...initialProbeState, syntheticCounter: 2, aggregateVersion: 1 }
    const readHarness = makeHarness(corrupt)
    expect(await readHarness.handler('health', {}, new AbortController().signal)).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Probe request failed.', details: {} },
    })

    const { global, repository } = makeHarness()
    await expect(repository.transact(undefined, () => ({
      commit: true as const,
      next: corrupt as ProbeState,
      result: 'should-not-land',
    }))).rejects.toThrow()
    expect(global.setCalls).toBe(0)

    const aheadReceipt = {
      schemaVersion: 1,
      syntheticCounter: 0,
      aggregateVersion: 0,
      commandReceipts: {
        [FIRST_ID]: {
          canonicalRequestHash: hashProbeIncrementRequest(increment(FIRST_ID, 0)),
          outcome: {
            status: 'accepted',
            value: { counter: 1, aggregateVersion: 1 },
          },
        },
      },
    }
    const aheadHarness = makeHarness(aheadReceipt)
    expect(await aheadHarness.handler(
      'counter.increment',
      increment(FIRST_ID, 0),
      new AbortController().signal,
    )).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Probe request failed.', details: {} },
    })
    expect(aheadHarness.global.setCalls).toBe(0)
  })

  it('cancels before enqueue and while queued without creating a receipt', async () => {
    const pre = makeHarness()
    const preController = new AbortController()
    preController.abort()
    expect(await pre.handler('counter.increment', increment(), preController.signal)).toEqual({
      ok: false,
      error: { code: 'cancelled', message: 'Probe request cancelled.', details: {} },
    })
    expect(pre.global.setCalls).toBe(0)

    const queued = makeHarness()
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    queued.global.setHook = async (value) => {
      await barrier
      queued.global.state = cloneState(value)
    }
    const first = queued.handler('counter.increment', increment(FIRST_ID), new AbortController().signal)
    await Promise.resolve()
    const controller = new AbortController()
    const second = queued.handler('counter.increment', increment(SECOND_ID), controller.signal)
    controller.abort()
    release()

    expect(await first).toEqual(acceptedCounter(1))
    expect(await second).toEqual({
      ok: false,
      error: { code: 'cancelled', message: 'Probe request cancelled.', details: {} },
    })
    expect(queued.global.setCalls).toBe(1)
    expect(Object.keys((queued.global.state as ProbeState).commandReceipts)).toEqual([FIRST_ID])
  })

  it('checks cancellation after acquiring the queue but lets an already-started set finish', async () => {
    const beforeCommit = makeHarness()
    const beforeController = new AbortController()
    await expect(beforeCommit.repository.transact(beforeController.signal, (current) => {
      beforeController.abort()
      return { commit: true as const, next: current, result: 'no-write' }
    })).rejects.toBeInstanceOf(ProbeCancelledError)
    expect(beforeCommit.global.setCalls).toBe(0)

    const duringCommit = makeHarness()
    const duringController = new AbortController()
    duringCommit.global.setHook = async (value) => {
      duringController.abort()
      duringCommit.global.state = cloneState(value)
    }
    expect(await duringCommit.handler('counter.increment', increment(), duringController.signal)).toEqual(acceptedCounter(1))
    expect((duringCommit.global.state as ProbeState).syntheticCounter).toBe(1)
  })

  it('uses strict bounded safe outer failures for unknown or malformed calls', async () => {
    const { global, handler } = makeHarness()
    const canary = '/Users/private/API_TOKEN=secret transcript-canary'
    const invalidCalls: Array<[string, unknown]> = [
      ['unknown', { canary }],
      ['__proto__', {}],
      ['health', { canary }],
      ['counter.increment', { ...increment(), delta: 2, canary }],
      ['counter.increment', { ...increment(), apiVersion: 'pmwb-v2', canary }],
    ]
    for (const [endpoint, payload] of invalidCalls) {
      const result = await handler(endpoint, payload, new AbortController().signal)
      expect(result).toEqual({
        ok: false,
        error: { code: 'bad-request', message: 'Invalid probe request.', details: { issues: [] } },
      })
      expect(JSON.stringify(result)).not.toContain(canary)
    }
    expect(global.setCalls).toBe(0)
  })

  it('returns only fixed internal details when repository code throws arbitrary values', async () => {
    const repository = createProbeRepository({
      get() { throw { message: 'token=private-canary', stack: '/private/path' } },
      async set() { throw new Error('unreachable') },
    })
    const result = await createProbeHandler(repository)('health', {}, new AbortController().signal)
    expect(result).toEqual({
      ok: false,
      error: { code: 'internal', message: 'Probe request failed.', details: {} },
    })
    expect(JSON.stringify(result)).not.toMatch(/private-canary|private\/path|stack|token/)
    expect(new TextEncoder().encode(JSON.stringify(result)).byteLength).toBeLessThan(4096)
  })

  it('closes idempotently after draining accepted work and rejects new operations', async () => {
    const { global, repository, handler } = makeHarness()
    let release!: () => void
    const barrier = new Promise<void>((resolve) => { release = resolve })
    global.setHook = async (value) => {
      await barrier
      global.state = cloneState(value)
    }
    const pending = handler('counter.increment', increment(), new AbortController().signal)
    await Promise.resolve()
    const firstClose = repository.close()
    const secondClose = repository.close()
    expect(secondClose).toBe(firstClose)
    await expect(repository.read()).rejects.toThrow()
    release()
    expect(await pending).toEqual(acceptedCounter(1))
    await firstClose
    expect((global.state as ProbeState).syntheticCounter).toBe(1)
  })
})
