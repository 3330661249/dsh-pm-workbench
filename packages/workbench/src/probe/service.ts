import { createHash } from 'node:crypto'

import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'

import {
  MAX_PROBE_COMMAND_RECEIPTS,
  MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES,
  PROBE_CAPABILITIES,
  canonicalJson,
  canonicalJsonUtf8Bytes,
  initialProbeState,
  isProbeEndpoint,
  parseProbeInput,
  parseProbeOutcome,
  probeStateSchema,
  type IncrementCounterInput,
  type IncrementCounterReceiptOutcome,
  type ProbeEndpoint,
  type ProbeInput,
  type ProbeOutcome,
  type ProbeState,
} from './protocol.js'

export { initialProbeState, probeStateSchema } from './protocol.js'
export type { ProbeState } from './protocol.js'

export interface ProbeGlobal {
  get(): unknown
  set(value: ProbeState): Promise<void>
}

export type ProbeTransactionDecision<T> =
  | { readonly commit: false; readonly result: T }
  | { readonly commit: true; readonly next: ProbeState; readonly result: T }

export interface ProbeRepository {
  read(signal?: AbortSignal): Promise<ProbeState>
  transact<T>(
    signal: AbortSignal | undefined,
    operation: (current: ProbeState) => ProbeTransactionDecision<T>,
  ): Promise<T>
  close(): Promise<void>
}

export class ProbeCancelledError extends Error {
  override readonly name = 'ProbeCancelledError'

  constructor() {
    super('Probe operation cancelled')
  }
}

export class ProbeRepositoryClosedError extends Error {
  override readonly name = 'ProbeRepositoryClosedError'

  constructor() {
    super('Probe repository closed')
  }
}

function throwIfCancelled(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new ProbeCancelledError()
}

/**
 * Wrap the public storageDomain global handle without importing its private
 * implementation. Every operation joins one settled tail, so a rejected
 * read/write cannot poison later work.
 */
export function createProbeRepository(global: ProbeGlobal): ProbeRepository {
  let accepting = true
  let tail: Promise<void> = Promise.resolve()
  let closePromise: Promise<void> | undefined

  function enqueue<T>(signal: AbortSignal | undefined, operation: () => Promise<T> | T): Promise<T> {
    if (!accepting) return Promise.reject(new ProbeRepositoryClosedError())
    try {
      throwIfCancelled(signal)
    } catch (error) {
      return Promise.reject(error)
    }

    const result = tail.then(async () => {
      throwIfCancelled(signal)
      return operation()
    })
    tail = result.then(
      () => undefined,
      () => undefined,
    )
    return result
  }

  const repository: ProbeRepository = {
    read(signal) {
      return enqueue(signal, () => probeStateSchema.parse(global.get()))
    },

    transact(signal, operation) {
      return enqueue(signal, async () => {
        const current = probeStateSchema.parse(global.get())
        const decision = operation(current)
        throwIfCancelled(signal)
        if (!decision.commit) return decision.result

        const candidate = probeStateSchema.parse(decision.next)
        throwIfCancelled(signal)
        const durableWrite = global.set(candidate)
        await durableWrite
        return decision.result
      })
    },

    close() {
      if (closePromise) return closePromise
      accepting = false
      closePromise = tail.then(() => undefined)
      return closePromise
    },
  }

  return repository
}

export function hashProbeIncrementRequest(input: IncrementCounterInput): string {
  const canonicalRequest = canonicalJson({
    endpoint: 'counter.increment',
    input: {
      apiVersion: input.apiVersion,
      expectedVersion: input.expectedVersion,
      delta: input.delta,
    },
  })
  return createHash('sha256').update(canonicalRequest, 'utf8').digest('hex')
}

function rejected<C extends 'limit-exceeded' | 'version-conflict' | 'idempotency-key-reused'>(
  code: C,
): {
    readonly status: 'rejected'
    readonly error: { readonly code: C; readonly messageKey: `workbench.error.${C}` }
  } {
  return {
    status: 'rejected',
    error: { code, messageKey: `workbench.error.${code}` },
  }
}

function health(repository: ProbeRepository, signal: AbortSignal): Promise<ProbeOutcome<'health'>> {
  return repository.read(signal).then<ProbeOutcome<'health'>>((state) => ({
    status: 'accepted',
    value: {
      mode: 'gate-a-probe',
      capabilities: PROBE_CAPABILITIES,
      counter: state.syntheticCounter,
      aggregateVersion: state.aggregateVersion,
    },
  }))
}

function increment(
  repository: ProbeRepository,
  input: IncrementCounterInput,
  signal: AbortSignal,
): Promise<ProbeOutcome<'counter.increment'>> {
  const canonicalRequestHash = hashProbeIncrementRequest(input)

  return repository.transact<ProbeOutcome<'counter.increment'>>(signal, (current) => {
    const existing = Object.hasOwn(current.commandReceipts, input.commandId)
      ? current.commandReceipts[input.commandId]
      : undefined
    if (existing) {
      if (existing.canonicalRequestHash === canonicalRequestHash) {
        return { commit: false, result: existing.outcome }
      }
      return { commit: false, result: rejected('idempotency-key-reused') }
    }

    if (Object.keys(current.commandReceipts).length >= MAX_PROBE_COMMAND_RECEIPTS) {
      return { commit: false, result: rejected('limit-exceeded') }
    }

    let outcome: IncrementCounterReceiptOutcome
    let syntheticCounter = current.syntheticCounter
    let aggregateVersion = current.aggregateVersion
    if (input.expectedVersion !== current.aggregateVersion) {
      outcome = rejected('version-conflict')
    } else {
      if (current.aggregateVersion >= Number.MAX_SAFE_INTEGER) {
        return { commit: false, result: rejected('limit-exceeded') }
      }
      syntheticCounter += input.delta
      aggregateVersion += 1
      outcome = {
        status: 'accepted',
        value: { counter: syntheticCounter, aggregateVersion },
      }
    }

    const commandReceipts = {
      ...current.commandReceipts,
      [input.commandId]: { canonicalRequestHash, outcome },
    }
    if (canonicalJsonUtf8Bytes(commandReceipts) > MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES) {
      return { commit: false, result: rejected('limit-exceeded') }
    }

    return {
      commit: true,
      next: {
        schemaVersion: 1,
        syntheticCounter,
        aggregateVersion,
        commandReceipts,
      },
      result: outcome,
    }
  })
}

type ProbeConnectionResult = Awaited<ReturnType<ConnectionRpcHandler>>

function badRequestResult(): ProbeConnectionResult {
  return {
    ok: false,
    error: {
      code: 'bad-request',
      message: 'Invalid probe request.',
      details: { issues: [] },
    },
  }
}

function cancelledResult(): ProbeConnectionResult {
  return {
    ok: false,
    error: {
      code: 'cancelled',
      message: 'Probe request cancelled.',
      details: {},
    },
  }
}

export function internalProbeResult(): ProbeConnectionResult {
  return {
    ok: false,
    error: {
      code: 'internal',
      message: 'Probe request failed.',
      details: {},
    },
  }
}

async function execute<E extends ProbeEndpoint>(
  repository: ProbeRepository,
  endpoint: E,
  input: ProbeInput<E>,
  signal: AbortSignal,
): Promise<ProbeOutcome<E>> {
  if (endpoint === 'health') {
    return health(repository, signal) as Promise<ProbeOutcome<E>>
  }
  return increment(repository, input as IncrementCounterInput, signal) as Promise<ProbeOutcome<E>>
}

/**
 * Build the closed public Connection RPC handler. Invalid requests and all
 * unexpected failures are reduced to fixed, bounded envelopes; no thrown
 * value, schema issue, payload, path, or storage detail crosses the channel.
 */
export function createProbeHandler(repository: ProbeRepository): ConnectionRpcHandler {
  return async (endpoint, payload, signal) => {
    try {
      if (!isProbeEndpoint(endpoint)) return badRequestResult()
      const parsedInput = parseProbeInput(endpoint, payload)
      if (!parsedInput.ok) return badRequestResult()
      if (signal.aborted) return cancelledResult()

      const outcome = await execute(repository, endpoint, parsedInput.value, signal)
      const parsedOutcome = parseProbeOutcome(endpoint, parsedInput.value, outcome)
      if (!parsedOutcome.ok) return internalProbeResult()
      return { ok: true, value: parsedOutcome.value }
    } catch (error) {
      if (error instanceof ProbeCancelledError) return cancelledResult()
      return internalProbeResult()
    }
  }
}
