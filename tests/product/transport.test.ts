import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { expect, it, vi } from 'vitest'
import { ConnectionRpcWorkbenchTransport, type Stage3aProjectCommand } from '../../packages/workbench/src/client/workbench/transport.js'
import { PRODUCT_API_VERSION, PRODUCT_CAPABILITIES, parseProductInput, type ProductInput } from '../../packages/workbench/src/protocol/product.js'
import { projectViewOf } from '../../packages/workbench/src/application/project-views.js'
import { makeSmallActiveRecord, SMALL_PROJECT_ID, OTHER_PROJECT_ID } from './helpers/synthetic-records.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
const api = { apiVersion: PRODUCT_API_VERSION }
const command = parseProductInput('projects.command', { ...api, projectId: SMALL_PROJECT_ID, expectedVersion: 0,
  commandId: '20000000-0000-4000-8000-000000000001', payload: { kind: 'project.create', name: 'Synthetic', researchGoal: null, syntheticDataAttested: true } }) as Stage3aProjectCommand
const accepted = { ok: true, value: { status: 'accepted', projectId: command.projectId, commandId: command.commandId, value: { projectVersion: 1, contentVersion: 0 } } }
const health = { ok: true, value: { status: 'accepted', value: PRODUCT_CAPABILITIES } }
function transport(raw: unknown) {
  const call = vi.fn(async () => raw) as unknown as ClientConnectionRpc['call']
  return { call, transport: new ConnectionRpcWorkbenchTransport({ call }) }
}
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
it('validates the strict input, nested creation attestation and reserved command before invocation', async () => {
  const h = transport(accepted)
  for (const raw of [{ ...command, extra: true }, { ...command, payload: { ...command.payload, syntheticDataAttested: false } }]) {
    expect(await h.transport.command(raw as typeof command)).toEqual({ ok: false, error: { code: 'protocol-invalid', uncertain: false } })
  }
  expect(h.call).not.toHaveBeenCalled()
})
it('captures and deeply freezes input before queued caller mutation', async () => {
  const raw = structuredClone(command)
  const h = transport(accepted)
  const pending = h.transport.command(raw)
  Reflect.set(raw.payload, 'name', 'changed')
  await pending
  expect(h.call).toHaveBeenCalledWith('/dsh-pm-workbench-product-v1', 'projects.command', command, undefined)
  expect(Object.isFrozen((vi.mocked(h.call).mock.calls[0]![2] as typeof command).payload)).toBe(true)
})
it.each(['commandId', 'projectId', 'version', 'extra', 'replayed', 'current'])('rejects accepted command response with wrong %s after admission as uncertain', async mismatch => {
  const raw = structuredClone(accepted)
  if (mismatch === 'commandId') Reflect.set(raw.value, 'commandId', '20000000-0000-4000-8000-000000000002')
  else if (mismatch === 'projectId') raw.value.projectId = OTHER_PROJECT_ID
  else if (mismatch === 'version') raw.value.value.projectVersion = 2
  else Reflect.set(raw.value, mismatch, true)
  expect(await transport(raw).transport.command(command)).toEqual({ ok: false, error: { code: 'protocol-invalid', uncertain: true } })
})
it.each([['internal', 'transport-internal'], ['bad-request', 'protocol-invalid'], ['cancelled', 'cancelled'], ['unknown', 'protocol-invalid']])
('ignores raw carrier diagnostics and maps %s to %s with admitted mutation uncertainty', async (code, mapped) => {
  const h = transport({ ok: false, error: { code, message: 'private carrier text', details: { secret: 'private' } } })
  expect(await h.transport.command(command)).toEqual({ ok: false, error: { code: mapped, uncertain: true } })
  expect(await h.transport.health()).toEqual({ ok: false, error: { code: mapped, uncertain: false } })
})
it('keeps correlated business rejections inside ProductOutcome including cancelled', async () => {
  for (const code of ['cancelled', 'version-conflict']) {
    const value = { status: 'rejected', projectId: command.projectId, commandId: command.commandId, error: { code } }
    expect(await transport({ ok: true, value }).transport.command(command)).toEqual({ ok: true, value })
  }
})
it('maps thrown calls to host-unavailable and pre-call cancellation to definitely unsent', async () => {
  const call = vi.fn(async () => { throw new Error('private') })
  const t = new ConnectionRpcWorkbenchTransport({ call })
  expect(await t.command(command)).toEqual({ ok: false, error: { code: 'host-unavailable', uncertain: true } })
  const abort = new AbortController(); abort.abort()
  expect(await t.command(command, abort.signal)).toEqual({ ok: false, error: { code: 'cancelled', uncertain: false } })
  expect(call).toHaveBeenCalledTimes(1)
})
it('admits only eight FIFO calls, exposes admission and cancels queued calls without invocation', async () => {
  const releases: (() => void)[] = []
  const call = vi.fn(() => new Promise<any>(resolve => releases.push(() => resolve(health))))
  const t = new ConnectionRpcWorkbenchTransport({ call })
  const admitted: number[] = []
  const abort = new AbortController()
  const pending = Array.from({ length: 11 }, (_, i) => t.health(i === 8 ? abort.signal : undefined, { onAdmitted: () => admitted.push(i) }))
  await tick()
  expect(admitted).toEqual([0, 1, 2, 3, 4, 5, 6, 7]); expect(call).toHaveBeenCalledTimes(8)
  abort.abort()
  expect(await pending[8]).toEqual({ ok: false, error: { code: 'cancelled', uncertain: false } })
  releases.shift()!(); await tick(); expect(admitted).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 9])
  releases.shift()!(); await tick(); expect(admitted.at(-1)).toBe(10)
  releases.splice(0).forEach(release => release()); await Promise.all(pending)
  expect(call).toHaveBeenCalledTimes(10)
})
it('does not release an admitted slot on abort before its carrier settles', async () => {
  const releases: ((raw: any) => void)[] = []
  const call = vi.fn(() => new Promise<any>(resolve => releases.push(resolve)))
  const t = new ConnectionRpcWorkbenchTransport({ call }); const abort = new AbortController()
  const first = t.command(command, abort.signal)
  const others = Array.from({ length: 8 }, () => t.health())
  await tick(); abort.abort(); await tick(); expect(call).toHaveBeenCalledTimes(8)
  releases.shift()!(accepted); expect(await first).toMatchObject({ ok: false, error: { uncertain: true } })
  await tick(); expect(call).toHaveBeenCalledTimes(9)
  releases.forEach(resolve => resolve(health)); await Promise.all(others)
})
it('correlates project, source and PRD identities and verifies exact text bytes and hash', async () => {
  const view = projectViewOf(makeSmallActiveRecord({ projectId: OTHER_PROJECT_ID }))
  expect(await transport({ ok: true, value: { status: 'accepted', value: view } }).transport.getProject({ ...api, projectId: SMALL_PROJECT_ID })).toMatchObject({ ok: false })
  const sourceInput = parseProductInput('sources.get', { ...api, projectId: SMALL_PROJECT_ID, sourceRevisionId: '10000000-0000-4000-8000-000000000001' })
  const source = { projectId: SMALL_PROJECT_ID, sourceRevisionId: sourceInput.sourceRevisionId, revision: 1, displayName: 's.txt', format: 'text/plain', utf8Bytes: 3, text: 'abc', contentHash: nodeSha256Utf8('abc'), syntheticDataAttested: true }
  const mdInput = parseProductInput('artifacts.getMarkdown', { ...api, projectId: SMALL_PROJECT_ID, prdRevisionId: '10000000-0000-4000-8000-000000000002' })
  const markdown = { projectId: SMALL_PROJECT_ID, prdRevisionId: mdInput.prdRevisionId, sourceRevisionId: sourceInput.sourceRevisionId, baselineId: '10000000-0000-4000-8000-000000000003', baselineContentVersion: 1, rendererVersion: 'pmwb-prd-v1', contentHash: nodeSha256Utf8('abc'), utf8Bytes: 3, createdAt: '2026-09-07T00:00:00.000Z', markdown: 'abc' }
  for (const [value, method, input] of [[source, 'getSource', sourceInput], [markdown, 'getMarkdown', mdInput]] as const) {
    const invoke = (raw: unknown) => method === 'getSource'
      ? transport({ ok: true, value: { status: 'accepted', value: raw } }).transport.getSource(input as ProductInput<'sources.get'>)
      : transport({ ok: true, value: { status: 'accepted', value: raw } }).transport.getMarkdown(input as ProductInput<'artifacts.getMarkdown'>)
    expect(await invoke(value)).toMatchObject({ ok: true })
    for (const patch of [{ contentHash: '0'.repeat(64) }, { utf8Bytes: 4 }, { projectId: OTHER_PROJECT_ID },
      method === 'getSource' ? { sourceRevisionId: OTHER_PROJECT_ID } : { prdRevisionId: OTHER_PROJECT_ID }]) {
      expect(await invoke({ ...value, ...patch })).toEqual({ ok: false, error: { code: 'protocol-invalid', uncertain: false } })
    }
  }
})

it('observes synchronous throwing invocation as admitted', async () => {
  const admitted = vi.fn()
  const t = new ConnectionRpcWorkbenchTransport({ call: () => { throw new Error('lost synchronously') } })
  expect(await t.command(command, undefined, { onAdmitted: admitted })).toMatchObject({ ok: false, error: { uncertain: true } })
  expect(admitted).toHaveBeenCalledTimes(1)
})

it('never reads diagnostic carrier message or details accessors', async () => {
  const message = vi.fn(() => { throw new Error('do not inspect') })
  const error = { code: 'internal' }
  Object.defineProperties(error, { message: { get: message, enumerable: true }, details: { get: message, enumerable: true } })
  expect(await transport({ ok: false, error }).transport.command(command)).toEqual({ ok: false, error: { code: 'transport-internal', uncertain: true } })
  expect(message).not.toHaveBeenCalled()
})
it('rejects non-manifest import text before Connection invocation even through the generic command method', async () => {
  const h = transport(accepted)
  const input = parseProductInput('projects.command', { ...command, expectedVersion: 1, payload: {
    kind: 'source.importText', text: '陌生合成内容', displayName: 'synthetic.txt', format: 'pasted', syntheticDataAttested: true,
  } }) as Stage3aProjectCommand
  expect(await h.transport.command(input)).toEqual({ ok: false, error: { code: 'protocol-invalid', uncertain: false } })
  expect(h.call).not.toHaveBeenCalled()
})
it('preserves FIFO invocation order when an earlier source preflight awaits Web Crypto', async () => {
  const originalDigest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle)
  let release!: () => void
  const gate = new Promise<void>(resolve => { release = resolve })
  const spy = vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementationOnce(async (algorithm, data) => { await gate; return originalDigest(algorithm, data) })
  const { BUILT_IN_SYNTHETIC_TEXT } = await import('../../packages/workbench/src/analysis/fixture-manifest.js')
  const source = parseProductInput('projects.command', { ...command, expectedVersion: 1, payload: { kind: 'source.importText', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 's.txt', format: 'pasted', syntheticDataAttested: true } }) as Stage3aProjectCommand
  const h = transport(health)
  try {
    const first = h.transport.command(source), second = h.transport.health()
    await tick(); expect(h.call).not.toHaveBeenCalled()
    release(); await Promise.all([first, second])
    expect(vi.mocked(h.call).mock.calls.map(args => args[1])).toEqual(['projects.command', 'health'])
  } finally { release(); spy.mockRestore() }
})
