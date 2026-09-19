import { describe, expect, it, vi } from 'vitest'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { RpcValidationClient, ValidationSession } from '../../packages/workbench/src/client/workbench/validation-client.js'
import type { ValidationRequest, ValidationResponse } from '../../packages/workbench/src/validation/model.js'
import { makeValidationTask, validationId } from './helpers/validation-fixtures.js'

const task = makeValidationTask()
const accepted = (items = [task]): ValidationResponse => ({ ok: true, tasks: items, task: null, handoff: null })
const run: ValidationRequest = { action: 'run', projectId: task.projectId, taskId: task.id, expectedVersion: task.version, commandId: validationId(9), payload: {} }

describe('validation client request boundaries', () => {
  it('uses the validation RPC and rejects results belonging to another project or task', async () => {
    const call = vi.fn(async () => ({ ok: true, value: accepted() }))
    const client = new RpcValidationClient({ call } as unknown as ClientConnectionRpc)
    expect(await client.request({ action: 'list', projectId: task.projectId })).toEqual(accepted())
    expect(call).toHaveBeenCalledWith('/dsh-pm-validation-v1', 'request', { action: 'list', projectId: task.projectId })
    call.mockResolvedValue({ ok: true, value: accepted([makeValidationTask({ projectId: validationId(90) })]) })
    await expect(client.request({ action: 'list', projectId: task.projectId })).rejects.toThrow('mismatch')
    call.mockResolvedValue({ ok: true, value: { ok: true, tasks: [], task: makeValidationTask({ id: validationId(91) }), handoff: null } })
    await expect(client.request(run)).rejects.toThrow('mismatch')
  })
  it('does not publish a late response after a project session is disposed', async () => {
    let resolve!: (response: ValidationResponse) => void
    const request = vi.fn(() => new Promise<ValidationResponse>(done => { resolve = done }))
    const session = new ValidationSession({ request }, task.projectId), listener = vi.fn()
    session.subscribe(listener)
    const pending = session.load(); session.dispose(); listener.mockClear()
    resolve(accepted()); await pending
    expect(listener).not.toHaveBeenCalled()
    expect(session.getSnapshot().tasks).toEqual([])
  })
  it('prevents duplicate admission while a model run is pending', async () => {
    let resolve!: (response: ValidationResponse) => void
    const request = vi.fn(() => new Promise<ValidationResponse>(done => { resolve = done }))
    const session = new ValidationSession({ request }, task.projectId)
    const first = session.submit(run, 'running')
    await session.submit({ ...run, commandId: validationId(10) }, 'running')
    expect(request).toHaveBeenCalledTimes(1)
    resolve({ ok: true, tasks: [], task, handoff: null }); await first
    expect(session.getSnapshot().busy).toBeUndefined()
  })
  it('supports a React effect restart without admitting results from its previous lifetime', async () => {
    const resolve: ((response: ValidationResponse) => void)[] = []
    const request = vi.fn(() => new Promise<ValidationResponse>(done => { resolve.push(done) }))
    const session = new ValidationSession({ request }, task.projectId)
    const first = session.load(); session.dispose(); session.activate()
    const second = session.load()
    resolve[0]!(accepted()); await first
    expect(session.getSnapshot().tasks).toEqual([])
    expect(session.getSnapshot().busy).toBeDefined()
    resolve[1]!(accepted()); await second
    expect(session.getSnapshot().tasks).toEqual([task])
    expect(session.getSnapshot().busy).toBeUndefined()
  })
  it('retries an uncertain command with the original identity and blocks replacement commands', async () => {
    const request = vi.fn<(_: ValidationRequest) => Promise<ValidationResponse>>().mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true, tasks: [], task, handoff: null })
    const session = new ValidationSession({ request }, task.projectId)
    await session.submit(run, 'running')
    expect(session.getSnapshot().uncertainRequest).toEqual(run)
    await session.submit({ ...run, commandId: validationId(10) }, 'replacement')
    expect(request).toHaveBeenCalledTimes(1)
    await session.retry()
    expect(request.mock.calls[1]![0]).toEqual(run)
    expect(session.getSnapshot().uncertainRequest).toBeUndefined()
    expect(session.getSnapshot().selectedTaskId).toBe(task.id)
  })
  it('reads saved histories on a new session and retains selection after refresh', async () => {
    const session = new ValidationSession({ request: async () => accepted() }, task.projectId)
    await session.load(); session.select(task.id); await session.load()
    expect(session.getSnapshot().tasks).toEqual([task])
    expect(session.getSnapshot().selectedTaskId).toBe(task.id)
    session.select(validationId(89)); expect(session.getSnapshot().selectedTaskId).toBe(task.id)
  })
})
