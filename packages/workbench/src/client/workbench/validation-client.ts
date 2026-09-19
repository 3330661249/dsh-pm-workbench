import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { VALIDATION_RPC_CHANNEL, VALIDATION_RPC_ENDPOINT, validationRequestSchema, validationResponseSchema,
  type ValidationRequest, type ValidationResponse, type ValidationTask } from '../../validation/model.js'

export interface ValidationClient { request(input: ValidationRequest): Promise<ValidationResponse> }

export class RpcValidationClient implements ValidationClient {
  constructor(private readonly rpc: ClientConnectionRpc) {}
  async request(input: ValidationRequest): Promise<ValidationResponse> {
    const request = validationRequestSchema.parse(input)
    const carrier = await this.rpc.call(VALIDATION_RPC_CHANNEL, VALIDATION_RPC_ENDPOINT, request)
    if (!carrier.ok) throw new Error('validation-unavailable')
    const response = validationResponseSchema.parse(carrier.value)
    if (response.ok && (response.tasks.some(task => task.projectId !== input.projectId)
      || response.task && (response.task.projectId !== input.projectId || input.action !== 'list' && response.task.id !== input.taskId))) {
      throw new Error('validation-response-mismatch')
    }
    return response
  }
}

export interface ValidationSnapshot {
  readonly tasks: readonly ValidationTask[]
  readonly selectedTaskId?: string
  readonly busy?: string
  readonly error?: string
  readonly uncertainRequest?: ValidationRequest
}

/** A session belongs to one project; an unmounted session cannot publish late RPC results. */
export class ValidationSession {
  private state: ValidationSnapshot = { tasks: [] }
  private listeners = new Set<() => void>()
  private disposed = false
  private admitted = false
  private generation = 0
  constructor(private readonly client: ValidationClient, readonly projectId: string) {}
  getSnapshot = (): ValidationSnapshot => this.state
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener) } }
  activate() { if (this.disposed) { this.disposed = false; this.publish({ busy: undefined }) } }
  private publish(patch: Partial<ValidationSnapshot>) {
    if (this.disposed) return
    this.state = { ...this.state, ...patch }
    for (const listener of this.listeners) listener()
  }
  select(id?: string) {
    if (!this.admitted && (!id || this.state.tasks.some(task => task.id === id))) this.publish({ selectedTaskId: id, error: undefined })
  }
  async load() { return this.submit({ action: 'list', projectId: this.projectId }, '正在读取验证记录…') }
  async retry() {
    const request = this.state.uncertainRequest
    return request ? this.submit(request, '正在核对上次操作…') : undefined
  }
  async submit(request: ValidationRequest, busy: string): Promise<ValidationResponse | undefined> {
    if (this.disposed || this.admitted || request.projectId !== this.projectId) return
    // Until a sent command has been reconciled, only reads or its exact retry are allowed.
    if (this.state.uncertainRequest && request.action !== 'list'
      && JSON.stringify(request) !== JSON.stringify(this.state.uncertainRequest)) return
    this.admitted = true
    const generation = this.generation
    const current = () => !this.disposed && this.generation === generation
    this.publish({ busy, error: undefined })
    try {
      const result = await this.client.request(request)
      if (!current()) return
      if (!result.ok) { this.publish({ error: result.message, uncertainRequest: request.action === 'list' ? this.state.uncertainRequest : undefined }); return result }
      if (result.tasks.some(task => task.projectId !== this.projectId) || result.task && result.task.projectId !== this.projectId) {
        throw new Error('validation-response-mismatch')
      }
      const tasks = request.action === 'list' ? result.tasks : result.task
        ? [result.task, ...this.state.tasks.filter(task => task.id !== result.task!.id)] : [...this.state.tasks]
      tasks.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      this.publish({ tasks, selectedTaskId: request.action !== 'list' && result.task ? result.task.id
        : tasks.some(task => task.id === this.state.selectedTaskId) ? this.state.selectedTaskId : undefined,
        uncertainRequest: request.action === 'list' ? this.state.uncertainRequest : undefined })
      return result
    } catch {
      if (current()) this.publish({ error: request.action === 'list' ? '验证记录暂时无法读取，请刷新重试。'
        : '尚未收到操作结果。请重试原操作或刷新记录核对，不会重复发起已完成的模型任务。',
        uncertainRequest: request.action === 'list' ? this.state.uncertainRequest : request })
      return undefined
    } finally { if (current()) { this.admitted = false; this.publish({ busy: undefined }) } }
  }
  dispose() { this.disposed = true; this.admitted = false; this.generation++; this.listeners.clear() }
}
