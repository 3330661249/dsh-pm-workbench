import { describe, expect, it } from 'vitest'

import {
  ConnectionRpcProbeTransport,
  type ProbeRpcCaller,
} from '../../packages/workbench/src/client/probe/transport.js'

const HEALTH_VALUE = {
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
  counter: 0,
  aggregateVersion: 0,
}

const INCREMENT_INPUT = {
  apiVersion: 'pmwb-v1' as const,
  expectedVersion: 0,
  commandId: '00000000-0000-4000-8000-000000000001',
  delta: 1 as const,
}

function caller(
  implementation: ProbeRpcCaller['call'],
): ProbeRpcCaller {
  return { call: implementation }
}

describe('ConnectionRpcProbeTransport', () => {
  it('calls only the Probe channel and returns a revalidated health outcome', async () => {
    const calls: unknown[][] = []
    const transport = new ConnectionRpcProbeTransport(caller(async (...args) => {
      calls.push(args)
      return { ok: true, value: { status: 'accepted', value: HEALTH_VALUE } }
    }))

    await expect(transport.health()).resolves.toEqual({
      ok: true,
      value: { status: 'accepted', value: HEALTH_VALUE },
    })
    expect(calls).toHaveLength(1)
    expect(calls[0]?.slice(0, 3)).toEqual(['/dsh-pm-workbench-v1', 'health', {}])
  })

  it('preserves a validated Host business rejection without treating it as transport success data', async () => {
    const rejection = {
      status: 'rejected' as const,
      error: {
        code: 'version-conflict' as const,
        messageKey: 'workbench.error.version-conflict' as const,
      },
    }
    const transport = new ConnectionRpcProbeTransport(caller(async () => ({ ok: true, value: rejection })))

    await expect(transport.increment(INCREMENT_INPUT)).resolves.toEqual({ ok: true, value: rejection })
  })

  it('fails closed on malformed success output and marks a mutation result uncertain', async () => {
    const transport = new ConnectionRpcProbeTransport(caller(async () => ({
      ok: true,
      value: {
        status: 'accepted',
        value: { counter: 99, aggregateVersion: 1, leaked: true },
      },
    })))

    await expect(transport.increment(INCREMENT_INPUT)).resolves.toEqual({
      ok: false,
      error: { code: 'protocol-invalid', uncertain: true },
    })
  })

  it('maps the closed outer carrier errors without returning message or details', async () => {
    for (const [outerCode, expectedCode] of [
      ['bad-request', 'protocol-invalid'],
      ['cancelled', 'cancelled'],
      ['internal', 'transport-internal'],
      ['not-found', 'protocol-invalid'],
    ] as const) {
      const transport = new ConnectionRpcProbeTransport(caller(async () => ({
        ok: false,
        error: {
          code: outerCode,
          message: 'CANARY_TOKEN_sk-fake-91f7',
          details: { path: '/Users/example/private/transcript.md' },
        },
      })))

      const result = await transport.health()
      expect(result).toEqual({ ok: false, error: { code: expectedCode, uncertain: false } })
      expect(JSON.stringify(result)).not.toContain('CANARY')
      expect(JSON.stringify(result)).not.toContain('/Users/')
    }
  })

  it('maps a transport exception to host-unavailable without leaking it', async () => {
    const transport = new ConnectionRpcProbeTransport(caller(async () => {
      throw new Error('CANARY_INTERVIEW_BODY_91f7 /Users/example/private/transcript.md')
    }))

    const result = await transport.health()
    expect(result).toEqual({ ok: false, error: { code: 'host-unavailable', uncertain: false } })
    expect(JSON.stringify(result)).not.toContain('CANARY')
  })

  it('contains a hostile carrier envelope whose property getter throws', async () => {
    const hostile = Object.defineProperty({}, 'ok', {
      enumerable: true,
      get() { throw new Error('CANARY_TOKEN_sk-fake-91f7') },
    })
    const transport = new ConnectionRpcProbeTransport(caller(async () => hostile))

    await expect(transport.health()).resolves.toEqual({
      ok: false,
      error: { code: 'protocol-invalid', uncertain: false },
    })
  })

  it('does not call the carrier for a pre-cancelled request', async () => {
    let calls = 0
    const transport = new ConnectionRpcProbeTransport(caller(async () => {
      calls += 1
      return { ok: true, value: { status: 'accepted', value: HEALTH_VALUE } }
    }))
    const controller = new AbortController()
    controller.abort()

    await expect(transport.health(controller.signal)).resolves.toEqual({
      ok: false,
      error: { code: 'cancelled', uncertain: false },
    })
    expect(calls).toBe(0)
  })

  it('treats cancellation after mutation admission as an uncertain result', async () => {
    const controller = new AbortController()
    const transport = new ConnectionRpcProbeTransport(caller(async () => {
      controller.abort()
      throw new Error('carrier aborted after send')
    }))

    await expect(transport.increment(INCREMENT_INPUT, controller.signal)).resolves.toEqual({
      ok: false,
      error: { code: 'cancelled', uncertain: true },
    })
  })

  it('strictly rejects invalid requests before calling the carrier', async () => {
    let calls = 0
    const transport = new ConnectionRpcProbeTransport(caller(async () => {
      calls += 1
      return { ok: true, value: { status: 'accepted', value: { counter: 1, aggregateVersion: 1 } } }
    }))

    const result = await transport.increment({ ...INCREMENT_INPUT, delta: 2 } as never)
    expect(result).toEqual({ ok: false, error: { code: 'protocol-invalid', uncertain: false } })
    expect(calls).toBe(0)
  })

  it('limits carrier concurrency to eight and lets an aborted waiter leave without a ninth call', async () => {
    const releases: Array<() => void> = []
    let calls = 0
    const transport = new ConnectionRpcProbeTransport(caller(async () => {
      calls += 1
      await new Promise<void>((resolve) => releases.push(resolve))
      return { ok: true, value: { status: 'accepted', value: HEALTH_VALUE } }
    }))

    const active = Array.from({ length: 8 }, () => transport.health())
    await Promise.resolve()
    const ninthAbort = new AbortController()
    const ninth = transport.health(ninthAbort.signal)
    await Promise.resolve()
    expect(calls).toBe(8)

    ninthAbort.abort()
    await expect(ninth).resolves.toEqual({
      ok: false,
      error: { code: 'cancelled', uncertain: false },
    })
    expect(calls).toBe(8)

    releases.splice(0).forEach((release) => release())
    await Promise.all(active)
  })
})
