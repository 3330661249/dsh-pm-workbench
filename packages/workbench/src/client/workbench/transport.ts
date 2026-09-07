import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { FIXTURE_MANIFEST } from '../../analysis/fixture-manifest.js'
import {
  PRODUCT_API_VERSION, PRODUCT_CAPABILITIES, PRODUCT_RPC_CHANNEL, parseProductInput, parseProductOutcome,
  type ProductEndpoint, type ProductInput, type ProductOutcome, type ProjectCommand,
  type GetProjectInput, type GetSourceInput, type GetMarkdownInput,
} from '../../protocol/product.js'
import type { MarkdownView } from '../../application/project-views.js'
import { webSha256Utf8 } from './web-sha256.js'

export type Stage3aProjectCommand = Omit<ProjectCommand, 'payload'> & {
  readonly payload: Exclude<ProjectCommand['payload'], { readonly kind: 'analysis.runHarnessModel' }>
}
export type WorkbenchTransportErrorCode = 'cancelled' | 'host-unavailable' | 'protocol-invalid' | 'transport-internal'
export type WorkbenchResult<E extends ProductEndpoint> =
  | { readonly ok: true; readonly value: ProductOutcome<E> }
  | { readonly ok: false; readonly error: { readonly code: WorkbenchTransportErrorCode; readonly uncertain: boolean } }
export interface AdmissionOptions { readonly onAdmitted?: () => void }
export interface WorkbenchTransport {
  health(signal?: AbortSignal, options?: AdmissionOptions): Promise<WorkbenchResult<'health'>>
  listProjects(signal?: AbortSignal, options?: AdmissionOptions): Promise<WorkbenchResult<'projects.list'>>
  getProject(input: GetProjectInput, signal?: AbortSignal, options?: AdmissionOptions): Promise<WorkbenchResult<'projects.get'>>
  getSource(input: GetSourceInput, signal?: AbortSignal, options?: AdmissionOptions): Promise<WorkbenchResult<'sources.get'>>
  getMarkdown(input: GetMarkdownInput, signal?: AbortSignal, options?: AdmissionOptions): Promise<WorkbenchResult<'artifacts.getMarkdown'>>
  command(input: Stage3aProjectCommand, signal?: AbortSignal, options?: AdmissionOptions): Promise<WorkbenchResult<'projects.command'>>
}
const verifiedMarkdown = new WeakSet<object>()
/** Only frozen, correlated, hash-checked transport results can cross the export port. */
export function isVerifiedMarkdown(value: unknown): value is MarkdownView {
  return typeof value === 'object' && value !== null && verifiedMarkdown.has(value)
}
function carrierEnvelope(raw: unknown): { ok: true; value: unknown } | { ok: false; code: string } {
  const fields = (value: unknown, names: string[]) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid-carrier')
    const descriptors = Object.getOwnPropertyDescriptors(value)
    if (Reflect.ownKeys(value).length !== names.length || names.some(name => !Object.hasOwn(descriptors, name))) throw new Error('invalid-carrier')
    return descriptors
  }
  if (!raw || typeof raw !== 'object') throw new Error('invalid-carrier')
  const ok = Object.getOwnPropertyDescriptor(raw, 'ok')?.value
  if (ok === true) {
    const envelope = fields(raw, ['ok', 'value'])
    if (!Object.hasOwn(envelope.value!, 'value')) throw new Error('invalid-carrier')
    return { ok: true, value: envelope.value!.value }
  }
  if (ok !== false) throw new Error('invalid-carrier')
  const envelope = fields(raw, ['ok', 'error'])
  const error = fields(envelope.error!.value, ['code', 'message', 'details'])
  if (typeof error.code!.value !== 'string') throw new Error('invalid-carrier')
  // Diagnostic descriptors are ignored; even getters are never evaluated.
  return { ok: false, code: error.code!.value }
}
const failed = (code: WorkbenchTransportErrorCode, uncertain: boolean) => ({ ok: false, error: { code, uncertain } } as const)
type Release = () => void
type Admission = { readonly kind: 'admitted'; readonly release: Release } | { readonly kind: 'cancelled' | 'invalid' }
interface Waiter {
  readonly signal?: AbortSignal
  readonly prepare: () => Promise<boolean>
  readonly resolve: (result: Admission) => void
  readonly abort: () => void
  readonly cancelled: Promise<boolean>
}
/** Preparation and invocation share the same FIFO, so asynchronous hashing cannot overtake a caller. */
class AdmissionQueue {
  private active = 0
  private pumping = false
  private readonly waiters: Waiter[] = []
  acquire(signal: AbortSignal | undefined, prepare: () => Promise<boolean>): Promise<Admission> {
    if (signal?.aborted) return Promise.resolve({ kind: 'cancelled' })
    return new Promise(resolve => {
      let cancel!: (value: boolean) => void
      const cancelled = new Promise<boolean>(r => { cancel = r })
      const waiter: Waiter = { signal, prepare, resolve, cancelled, abort: () => {
        const index = this.waiters.indexOf(waiter)
        if (index >= 0) this.waiters.splice(index, 1)
        signal?.removeEventListener('abort', waiter.abort)
        cancel(false)
        resolve({ kind: 'cancelled' })
      } }
      this.waiters.push(waiter)
      signal?.addEventListener('abort', waiter.abort, { once: true })
      void this.pump()
    })
  }
  private async pump(): Promise<void> {
    if (this.pumping) return
    this.pumping = true
    try {
      while (this.active < PRODUCT_CAPABILITIES.maxClientInflightRequests) {
        const next = this.waiters[0]
        if (!next) break
        const valid = await Promise.race([next.prepare().catch(() => false), next.cancelled])
        const index = this.waiters.indexOf(next)
        if (index < 0) continue
        this.waiters.splice(index, 1)
        next.signal?.removeEventListener('abort', next.abort)
        if (next.signal?.aborted) { next.resolve({ kind: 'cancelled' }); continue }
        if (!valid) { next.resolve({ kind: 'invalid' }); continue }
        this.active++
        let released = false
        next.resolve({ kind: 'admitted', release: () => {
          if (released) return
          released = true
          this.active--
          void this.pump()
        } })
      }
    } finally { this.pumping = false }
  }
}
export class ConnectionRpcWorkbenchTransport implements WorkbenchTransport {
  private readonly admission = new AdmissionQueue()
  constructor(private readonly rpc: ClientConnectionRpc) {}
  health(signal?: AbortSignal, options?: AdmissionOptions) { return this.call('health', { apiVersion: PRODUCT_API_VERSION }, signal, options) }
  listProjects(signal?: AbortSignal, options?: AdmissionOptions) { return this.call('projects.list', { apiVersion: PRODUCT_API_VERSION }, signal, options) }
  getProject(input: GetProjectInput, signal?: AbortSignal, options?: AdmissionOptions) { return this.call('projects.get', input, signal, options) }
  getSource(input: GetSourceInput, signal?: AbortSignal, options?: AdmissionOptions) { return this.call('sources.get', input, signal, options) }
  getMarkdown(input: GetMarkdownInput, signal?: AbortSignal, options?: AdmissionOptions) { return this.call('artifacts.getMarkdown', input, signal, options) }
  command(input: Stage3aProjectCommand, signal?: AbortSignal, options?: AdmissionOptions) { return this.call('projects.command', input, signal, options) }
  private async call<E extends ProductEndpoint>(endpoint: E, rawInput: unknown, signal?: AbortSignal, options?: AdmissionOptions): Promise<WorkbenchResult<E>> {
    let input: ProductInput<E>
    try {
      input = parseProductInput(endpoint, rawInput)
      if (endpoint === 'projects.command' && (input as ProjectCommand).payload.kind === 'analysis.runHarnessModel') return failed('protocol-invalid', false)
    } catch { return failed('protocol-invalid', false) }
    if (signal?.aborted) return failed('cancelled', false)
    const admitted = await this.admission.acquire(signal, async () => {
      if (endpoint !== 'projects.command') return true
      const command = input as ProjectCommand
      return command.payload.kind !== 'source.importText'
        || Object.hasOwn(FIXTURE_MANIFEST.sources, await webSha256Utf8(command.payload.text))
    })
    if (admitted.kind !== 'admitted') return failed(admitted.kind === 'cancelled' ? 'cancelled' : 'protocol-invalid', false)
    const release = admitted.release
    const mutation = endpoint === 'projects.command'
    try {
      if (signal?.aborted) return failed('cancelled', false)
      let raw: unknown
      try {
        // Invocation precedes the observable callback. A reentrant callback cannot make a sent call unsent.
        let pending: ReturnType<ClientConnectionRpc['call']>
        try { pending = this.rpc.call(PRODUCT_RPC_CHANNEL, endpoint, input, signal) }
        finally { try { options?.onAdmitted?.() } catch { /* observers do not own carrier completion */ } }
        raw = await pending
      } catch { return failed('host-unavailable', mutation) }
      if (signal?.aborted) return failed('cancelled', mutation)
      try {
        const carrier = carrierEnvelope(raw)
        if (!carrier.ok) {
          const code = carrier.code
          return failed(code === 'internal' ? 'transport-internal' : code === 'cancelled' ? 'cancelled' : 'protocol-invalid', mutation)
        }
        const outcome = parseProductOutcome(endpoint, carrier.value, input)
        if (outcome.status === 'accepted' && (endpoint === 'sources.get' || endpoint === 'artifacts.getMarkdown')) {
          const value = outcome.value as Extract<ProductOutcome<'sources.get'>, { status: 'accepted' }>['value'] | MarkdownView
          const text = 'text' in value ? value.text : value.markdown
          if (await webSha256Utf8(text) !== value.contentHash) return failed('protocol-invalid', mutation)
          if (signal?.aborted) return failed('cancelled', mutation)
          if (endpoint === 'artifacts.getMarkdown') verifiedMarkdown.add(value)
        }
        return { ok: true, value: outcome }
      } catch { return failed('protocol-invalid', mutation) }
    } finally { release() }
  }
}
