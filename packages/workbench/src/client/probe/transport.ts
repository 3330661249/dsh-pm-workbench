import { z } from 'zod'

import {
  PROBE_CAPABILITIES,
  PROBE_RPC_CHANNEL,
  parseProbeInput,
  parseProbeOutcome,
  type ProbeEndpoint,
  type ProbeInput,
  type ProbeOutcome,
} from '../../probe/protocol.js'

export interface ProbeRpcCaller {
  call(
    channel: string,
    endpoint: string,
    payload: unknown,
    signal?: AbortSignal,
  ): Promise<unknown>
}

export type ProbeClientErrorCode =
  | 'cancelled'
  | 'host-unavailable'
  | 'protocol-invalid'
  | 'transport-internal'

export type ProbeTransportError = {
  readonly code: ProbeClientErrorCode
  readonly uncertain: boolean
}

export type ProbeTransportResult<E extends ProbeEndpoint> =
  | { readonly ok: true; readonly value: ProbeOutcome<E> }
  | { readonly ok: false; readonly error: ProbeTransportError }

const outerResultSchema = z.union([
  z.object({
    ok: z.literal(true),
    value: z.unknown(),
  }).strict(),
  z.object({
    ok: z.literal(false),
    error: z.object({
      code: z.string(),
      message: z.string(),
      details: z.record(z.string(), z.unknown()),
    }).strict(),
  }).strict(),
])

type Release = () => void

interface Waiter {
  readonly signal?: AbortSignal
  readonly resolve: (release: Release | undefined) => void
  readonly abort: () => void
}

class ClientAdmission {
  private active = 0
  private readonly waiters: Waiter[] = []

  constructor(private readonly limit: number) {}

  acquire(signal?: AbortSignal): Promise<Release | undefined> {
    if (signal?.aborted) return Promise.resolve(undefined)
    if (this.active < this.limit) {
      this.active += 1
      return Promise.resolve(this.createRelease())
    }

    return new Promise((resolve) => {
      const waiter: Waiter = {
        signal,
        resolve,
        abort: () => {
          const index = this.waiters.indexOf(waiter)
          if (index >= 0) this.waiters.splice(index, 1)
          resolve(undefined)
        },
      }
      this.waiters.push(waiter)
      signal?.addEventListener('abort', waiter.abort, { once: true })
    })
  }

  private createRelease(): Release {
    let released = false
    return () => {
      if (released) return
      released = true
      this.active -= 1
      this.admitNext()
    }
  }

  private admitNext(): void {
    while (this.active < this.limit) {
      const waiter = this.waiters.shift()
      if (!waiter) return
      waiter.signal?.removeEventListener('abort', waiter.abort)
      if (waiter.signal?.aborted) {
        waiter.resolve(undefined)
        continue
      }
      this.active += 1
      waiter.resolve(this.createRelease())
    }
  }
}

function failed(
  code: ProbeClientErrorCode,
  uncertain: boolean,
): { readonly ok: false; readonly error: ProbeTransportError } {
  return { ok: false, error: { code, uncertain } }
}

export class ConnectionRpcProbeTransport {
  private readonly admission = new ClientAdmission(PROBE_CAPABILITIES.maxClientInflightRequests)

  constructor(private readonly rpc: ProbeRpcCaller) {}

  health(signal?: AbortSignal): Promise<ProbeTransportResult<'health'>> {
    const parsed = parseProbeInput('health', {})
    if (!parsed.ok) return Promise.resolve(failed('protocol-invalid', false))
    return this.call('health', parsed.value, signal, false)
  }

  increment(
    input: ProbeInput<'counter.increment'>,
    signal?: AbortSignal,
  ): Promise<ProbeTransportResult<'counter.increment'>> {
    const parsed = parseProbeInput('counter.increment', input)
    if (!parsed.ok) return Promise.resolve(failed('protocol-invalid', false))
    return this.call('counter.increment', parsed.value, signal, true)
  }

  private async call<E extends ProbeEndpoint>(
    endpoint: E,
    input: ProbeInput<E>,
    signal: AbortSignal | undefined,
    mutation: boolean,
  ): Promise<ProbeTransportResult<E>> {
    if (signal?.aborted) return failed('cancelled', false)
    const release = await this.admission.acquire(signal)
    if (!release) return failed('cancelled', false)

    try {
      if (signal?.aborted) return failed('cancelled', false)

      let rawResult: unknown
      try {
        rawResult = await this.rpc.call(PROBE_RPC_CHANNEL, endpoint, input, signal)
      } catch {
        if (signal?.aborted) return failed('cancelled', mutation)
        return failed('host-unavailable', mutation)
      }

      if (signal?.aborted) return failed('cancelled', mutation)
      const outer = (() => {
        try {
          return outerResultSchema.safeParse(rawResult)
        } catch {
          return undefined
        }
      })()
      if (!outer?.success) return failed('protocol-invalid', mutation)
      if (!outer.data.ok) {
        switch (outer.data.error.code) {
          case 'bad-request':
            return failed('protocol-invalid', false)
          case 'cancelled':
            return failed('cancelled', mutation)
          case 'internal':
            return failed('transport-internal', mutation)
          default:
            return failed('protocol-invalid', mutation)
        }
      }

      const outcome = parseProbeOutcome(endpoint, input, outer.data.value)
      if (!outcome.ok) return failed('protocol-invalid', mutation)
      return { ok: true, value: outcome.value }
    } finally {
      release()
    }
  }
}
