import type {
  ProbeInput,
  ProbeOutcome,
} from '../../probe/protocol.js'
import type {
  ProbeClientErrorCode,
  ProbeTransportResult,
} from './transport.js'

type ProbeRejectedOutcome = Extract<
  ProbeOutcome<'health'> | ProbeOutcome<'counter.increment'>,
  { readonly status: 'rejected' }
>

type ProbeHealthValue = Extract<
  ProbeOutcome<'health'>,
  { readonly status: 'accepted' }
>['value']

export type ProbeStoreErrorCode = ProbeClientErrorCode | ProbeRejectedOutcome['error']['code']
export type ProbeStorePhase = 'closed' | 'loading' | 'ready' | 'updating' | 'uncertain' | 'error'

export interface ProbeAuthoritativeSnapshot {
  readonly mode: 'gate-a-probe'
  readonly counter: number
  readonly aggregateVersion: number
  readonly pluginVersion: '0.1.0'
  readonly harnessTarget: '0.1.0-rc.6'
}

export interface ProbeStoreState {
  readonly isOpen: boolean
  readonly phase: ProbeStorePhase
  readonly authoritative?: ProbeAuthoritativeSnapshot
  readonly error?: ProbeStoreErrorCode
}

export interface ProbeFocusTarget {
  focus(): void
}

export interface ProbeStoreTransport {
  health(signal?: AbortSignal): Promise<ProbeTransportResult<'health'>>
  increment(
    input: ProbeInput<'counter.increment'>,
    signal?: AbortSignal,
  ): Promise<ProbeTransportResult<'counter.increment'>>
}

export interface ProbeStoreOptions {
  readonly createCommandId?: () => string
  readonly schedule?: (operation: () => void) => void
}

export interface ProbeStore {
  getSnapshot(): ProbeStoreState
  subscribe(listener: () => void): () => void
  open(focusTarget?: ProbeFocusTarget): Promise<void>
  close(): void
  refresh(): Promise<void>
  increment(): Promise<void>
  dispose(): void
}

function defaultCommandId(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error('random UUID unavailable')
  return globalThis.crypto.randomUUID()
}

const defaultSchedule = (operation: () => void) => { queueMicrotask(operation) }

function fromHealth(value: ProbeHealthValue): ProbeAuthoritativeSnapshot {
  return {
    mode: value.mode,
    counter: value.counter,
    aggregateVersion: value.aggregateVersion,
    pluginVersion: value.capabilities.pluginVersion,
    harnessTarget: value.capabilities.harnessTarget,
  }
}

export function createProbeStore(
  transport: ProbeStoreTransport,
  options: ProbeStoreOptions = {},
): ProbeStore {
  const createCommandId = options.createCommandId ?? defaultCommandId
  const schedule = options.schedule ?? defaultSchedule
  let state: ProbeStoreState = { isOpen: false, phase: 'closed' }
  let generation = 0
  let generationAbort: AbortController | undefined
  let focusTarget: ProbeFocusTarget | undefined
  let disposed = false
  const listeners = new Set<() => void>()

  function publish(next: ProbeStoreState): void {
    if (disposed) return
    state = next
    for (const listener of [...listeners]) listener()
  }

  function isCurrent(targetGeneration: number): boolean {
    return !disposed && state.isOpen && generation === targetGeneration
  }

  function acceptAuthoritative(
    next: ProbeAuthoritativeSnapshot,
  ): 'accepted' | 'ignored' | 'protocol-invalid' {
    const current = state.authoritative
    if (!current || next.aggregateVersion > current.aggregateVersion) return 'accepted'
    if (next.aggregateVersion < current.aggregateVersion) return 'ignored'
    return next.counter === current.counter ? 'ignored' : 'protocol-invalid'
  }

  function publishAccepted(next: ProbeAuthoritativeSnapshot): void {
    const decision = acceptAuthoritative(next)
    if (decision === 'protocol-invalid') {
      publish({ ...state, phase: 'error', error: 'protocol-invalid' })
      return
    }
    publish({
      ...state,
      phase: 'ready',
      authoritative: decision === 'accepted' ? next : state.authoritative,
      error: undefined,
    })
  }

  function publishFailure(error: ProbeClientErrorCode, uncertain: boolean): void {
    publish({ ...state, phase: uncertain ? 'uncertain' : 'error', error })
  }

  async function refresh(): Promise<void> {
    if (disposed || !state.isOpen || !generationAbort) return
    const targetGeneration = generation
    const signal = generationAbort.signal
    publish({ ...state, phase: 'loading', error: undefined })
    const result = await transport.health(signal)
    if (!isCurrent(targetGeneration)) return
    if (!result.ok) {
      publishFailure(result.error.code, result.error.uncertain)
      return
    }
    if (result.value.status === 'rejected') {
      publish({ ...state, phase: 'error', error: result.value.error.code })
      return
    }
    publishAccepted(fromHealth(result.value.value))
  }

  async function increment(): Promise<void> {
    if (disposed || !state.isOpen || !generationAbort || state.phase !== 'ready') return
    const authoritative = state.authoritative
    if (!authoritative) {
      publish({ ...state, phase: 'error', error: 'protocol-invalid' })
      return
    }

    let commandId: string
    try {
      commandId = createCommandId()
    } catch {
      publish({ ...state, phase: 'error', error: 'transport-internal' })
      return
    }

    const targetGeneration = generation
    const signal = generationAbort.signal
    publish({ ...state, phase: 'updating', error: undefined })
    const result = await transport.increment({
      apiVersion: 'pmwb-v1',
      expectedVersion: authoritative.aggregateVersion,
      commandId,
      delta: 1,
    }, signal)
    if (!isCurrent(targetGeneration)) return
    if (!result.ok) {
      publishFailure(result.error.code, result.error.uncertain)
      return
    }
    if (result.value.status === 'rejected') {
      publish({ ...state, phase: 'error', error: result.value.error.code })
      return
    }
    publishAccepted({
      ...authoritative,
      counter: result.value.value.counter,
      aggregateVersion: result.value.value.aggregateVersion,
    })
  }

  async function open(target?: ProbeFocusTarget): Promise<void> {
    if (disposed) return
    if (state.isOpen) return refresh()
    generationAbort?.abort()
    generationAbort = new AbortController()
    generation += 1
    focusTarget = target
    publish({ isOpen: true, phase: 'loading' })
    await refresh()
  }

  function close(): void {
    if (disposed || !state.isOpen) return
    generationAbort?.abort()
    generationAbort = undefined
    generation += 1
    const restore = focusTarget
    focusTarget = undefined
    publish({ isOpen: false, phase: 'closed' })
    const closedGeneration = generation
    if (restore) {
      schedule(() => {
        if (!disposed && !state.isOpen && generation === closedGeneration) restore.focus()
      })
    }
  }

  function dispose(): void {
    if (disposed) return
    disposed = true
    generationAbort?.abort()
    generationAbort = undefined
    generation += 1
    state = { isOpen: false, phase: 'closed' }
    focusTarget = undefined
    const pendingListeners = [...listeners]
    listeners.clear()
    for (const listener of pendingListeners) listener()
  }

  return {
    getSnapshot: () => state,
    subscribe(listener) {
      if (disposed) return () => {}
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    open,
    close,
    refresh,
    increment,
    dispose,
  }
}
