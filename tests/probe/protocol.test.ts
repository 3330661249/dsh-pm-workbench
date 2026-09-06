import { describe, expect, it } from 'vitest'

import {
  MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES,
  PROBE_CAPABILITIES,
  PROBE_RPC_CHANNEL,
  canonicalJson,
  canonicalJsonUtf8Bytes,
  isProbeEndpoint,
  parseProbeInput,
  parseProbeOutcome,
  probeRegistry,
  probeStateSchema,
} from '../../packages/workbench/src/probe/protocol.js'

const COMMAND_ID = '00000000-0000-4000-8000-000000000001'

const incrementInput = {
  apiVersion: 'pmwb-v1' as const,
  expectedVersion: 0,
  commandId: COMMAND_ID,
  delta: 1 as const,
}

const conflictReceipt = {
  canonicalRequestHash: 'a'.repeat(64),
  outcome: {
    status: 'rejected' as const,
    error: {
      code: 'version-conflict' as const,
      messageKey: 'workbench.error.version-conflict' as const,
    },
  },
}

function acceptedReceipt(version: number) {
  return {
    canonicalRequestHash: 'b'.repeat(64),
    outcome: {
      status: 'accepted' as const,
      value: { counter: version, aggregateVersion: version },
    },
  }
}

describe('Probe protocol', () => {
  it('exposes only the approved channel, endpoints, and exact capability constants', () => {
    expect(PROBE_RPC_CHANNEL).toBe('/dsh-pm-workbench-v1')
    expect(Object.getPrototypeOf(probeRegistry)).toBeNull()
    expect(Object.isFrozen(probeRegistry)).toBe(true)
    expect(Object.keys(probeRegistry)).toEqual(['counter.increment', 'health'])
    expect(isProbeEndpoint('counter.increment')).toBe(true)
    expect(isProbeEndpoint('health')).toBe(true)
    expect(isProbeEndpoint('__proto__')).toBe(false)
    expect(isProbeEndpoint('constructor')).toBe(false)
    expect(PROBE_CAPABILITIES).toEqual({
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
    })
  })

  it('accepts only a strict empty health request', () => {
    expect(parseProbeInput('health', {})).toEqual({ ok: true, value: {} })
    for (const input of [{ extra: true }, null, [], '', { toString: 'x' }]) {
      expect(parseProbeInput('health', input)).toEqual({ ok: false })
    }
  })

  it('accepts only the strict increment shape and canonical lowercase RFC 4122 UUID v4 IDs', () => {
    expect(parseProbeInput('counter.increment', incrementInput)).toEqual({
      ok: true,
      value: incrementInput,
    })

    const invalidIds = [
      '00000000-0000-4000-8000-00000000000A',
      '00000000-0000-3000-8000-000000000001',
      '00000000-0000-4000-7000-000000000001',
      '00000000000040008000000000000001',
      ` ${COMMAND_ID}`,
      `${COMMAND_ID}/x`,
      '００００００００-００００-４０００-８０００-０００００００００００１',
    ]
    for (const commandId of invalidIds) {
      expect(parseProbeInput('counter.increment', { ...incrementInput, commandId })).toEqual({ ok: false })
    }
  })

  it('rejects missing, extra, unsupported, and unsafe increment fields', () => {
    const { commandId: _omitted, ...withoutCommandId } = incrementInput
    const invalid = [
      withoutCommandId,
      { ...incrementInput, extra: true },
      { ...incrementInput, apiVersion: 'pmwb-v2' },
      { ...incrementInput, delta: 0 },
      { ...incrementInput, delta: 2 },
      { ...incrementInput, expectedVersion: -1 },
      { ...incrementInput, expectedVersion: 0.5 },
      { ...incrementInput, expectedVersion: Number.MAX_SAFE_INTEGER + 1 },
      { ...incrementInput, expectedVersion: Number.POSITIVE_INFINITY },
    ]
    for (const input of invalid) {
      expect(parseProbeInput('counter.increment', input)).toEqual({ ok: false })
    }
  })

  it('canonicalizes JSON deterministically and measures UTF-8 bytes', () => {
    expect(canonicalJson({ z: 1, a: { d: '界', c: true }, b: null })).toBe(
      '{"a":{"c":true,"d":"界"},"b":null,"z":1}',
    )
    expect(canonicalJson(Object.assign(Object.create(null), { b: 2, a: 1 }))).toBe('{"a":1,"b":2}')
    expect(canonicalJsonUtf8Bytes('é')).toBe(4)
    expect(canonicalJsonUtf8Bytes('界')).toBe(5)
  })

  it('rejects non-JSON, cyclic, accessor, symbolic, and non-plain canonical values', () => {
    const cyclic: { self?: unknown } = {}
    cyclic.self = cyclic
    const accessor = Object.defineProperty({}, 'secret', { enumerable: true, get: () => 'canary' })
    const symbolic = { okay: true } as Record<PropertyKey, unknown>
    symbolic[Symbol('secret')] = 'canary'
    class Box { value = 1 }

    for (const value of [undefined, Number.NaN, Number.POSITIVE_INFINITY, 1n, new Date(), new Map(), cyclic, accessor, symbolic, new Box()]) {
      expect(() => canonicalJson(value)).toThrow()
    }
  })

  it('validates accepted health output strictly and correlates counter with version', () => {
    const accepted = {
      status: 'accepted' as const,
      value: {
        mode: 'gate-a-probe' as const,
        capabilities: PROBE_CAPABILITIES,
        counter: 3,
        aggregateVersion: 3,
      },
    }
    expect(parseProbeOutcome('health', {}, accepted)).toEqual({ ok: true, value: accepted })
    expect(parseProbeOutcome('health', {}, { ...accepted, extra: true })).toEqual({ ok: false })
    expect(parseProbeOutcome('health', {}, {
      ...accepted,
      value: { ...accepted.value, aggregateVersion: 2 },
    })).toEqual({ ok: false })
    expect(parseProbeOutcome('health', {}, {
      ...accepted,
      value: { ...accepted.value, capabilities: { ...PROBE_CAPABILITIES, maxHostInflightRequests: 17 } },
    })).toEqual({ ok: false })
  })

  it('validates increment outcomes strictly and correlates accepted versions to the request', () => {
    const accepted = { status: 'accepted' as const, value: { counter: 1, aggregateVersion: 1 } }
    expect(parseProbeOutcome('counter.increment', incrementInput, accepted)).toEqual({ ok: true, value: accepted })
    for (const value of [
      { counter: 2, aggregateVersion: 1 },
      { counter: 1, aggregateVersion: 2 },
      { counter: 1, aggregateVersion: 1, extra: true },
    ]) {
      expect(parseProbeOutcome('counter.increment', incrementInput, { status: 'accepted', value })).toEqual({ ok: false })
    }

    const conflict = {
      status: 'rejected' as const,
      error: { code: 'version-conflict' as const, messageKey: 'workbench.error.version-conflict' as const },
    }
    expect(parseProbeOutcome('counter.increment', incrementInput, conflict)).toEqual({ ok: true, value: conflict })
    expect(parseProbeOutcome('counter.increment', incrementInput, {
      ...conflict,
      error: { ...conflict.error, messageKey: 'workbench.error.limit-exceeded' },
    })).toEqual({ ok: false })
    expect(parseProbeOutcome('counter.increment', incrementInput, {
      status: 'rejected', error: { code: 'future-code', messageKey: 'workbench.error.future-code' },
    })).toEqual({ ok: false })
  })

  it('enforces strict complete stored state, receipt count, and canonical ledger byte budget', () => {
    const commandReceipts = Object.fromEntries(
      Array.from({ length: 256 }, (_, index) => [
        `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`,
        conflictReceipt,
      ]),
    )
    const state = { schemaVersion: 1, syntheticCounter: 0, aggregateVersion: 0, commandReceipts }
    expect(probeStateSchema.safeParse(state).success).toBe(true)
    expect(probeStateSchema.safeParse({ ...state, extra: true }).success).toBe(false)
    expect(probeStateSchema.safeParse({ ...state, syntheticCounter: 1 }).success).toBe(false)
    expect(probeStateSchema.safeParse({ ...state, schemaVersion: 2 }).success).toBe(false)
    expect(probeStateSchema.safeParse({
      ...state,
      commandReceipts: {
        ...commandReceipts,
        '00000000-0000-4000-8000-000000000100': conflictReceipt,
      },
    }).success).toBe(false)

    expect(canonicalJsonUtf8Bytes('a'.repeat(MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES - 2))).toBe(
      MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES,
    )
    expect(canonicalJsonUtf8Bytes('a'.repeat(MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES - 1))).toBe(
      MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES + 1,
    )
  })

  it('requires accepted receipt versions to be the complete unique 1..aggregateVersion history', () => {
    const id = (suffix: number) => `00000000-0000-4000-8000-${suffix.toString(16).padStart(12, '0')}`
    const state = (aggregateVersion: number, commandReceipts: Record<string, unknown>) => ({
      schemaVersion: 1,
      syntheticCounter: aggregateVersion,
      aggregateVersion,
      commandReceipts,
    })

    expect(probeStateSchema.safeParse(state(2, {
      [id(1)]: acceptedReceipt(2),
      [id(2)]: acceptedReceipt(1),
      [id(3)]: conflictReceipt,
    })).success).toBe(true)

    for (const corrupt of [
      state(0, { [id(1)]: acceptedReceipt(1) }),
      state(2, { [id(1)]: acceptedReceipt(2) }),
      state(2, { [id(1)]: acceptedReceipt(1), [id(2)]: acceptedReceipt(1) }),
      state(1, { [id(1)]: conflictReceipt }),
    ]) {
      expect(probeStateSchema.safeParse(corrupt).success).toBe(false)
    }
  })
})
