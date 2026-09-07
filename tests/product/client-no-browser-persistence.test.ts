import { afterEach, expect, it, vi } from 'vitest'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { ConnectionRpcWorkbenchTransport } from '../../packages/workbench/src/client/workbench/transport.js'
import { createWorkbenchStore } from '../../packages/workbench/src/client/workbench/store.js'
import { WorkbenchBrowserPort } from '../../packages/workbench/src/client/workbench/browser-port.js'
import { PRODUCT_API_VERSION, PRODUCT_CAPABILITIES, parseProductInput } from '../../packages/workbench/src/protocol/product.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { SMALL_PROJECT_ID } from './helpers/synthetic-records.js'
const api = { apiVersion: PRODUCT_API_VERSION }
const input = parseProductInput('artifacts.getMarkdown', { ...api, projectId: SMALL_PROJECT_ID, prdRevisionId: '10000000-0000-4000-8000-000000000002' })
const raw = { projectId: SMALL_PROJECT_ID, prdRevisionId: input.prdRevisionId, sourceRevisionId: '10000000-0000-4000-8000-000000000003', baselineId: '10000000-0000-4000-8000-000000000004', baselineContentVersion: 1, rendererVersion: 'pmwb-prd-v1', contentHash: nodeSha256Utf8('中文😀'), utf8Bytes: 10, createdAt: '2026-09-07T00:00:00.000Z', markdown: '中文😀' }
async function verified() {
  const t = new ConnectionRpcWorkbenchTransport({ call: async () => ({ ok: true, value: { status: 'accepted', value: raw } }) })
  const result = await t.getMarkdown(input)
  if (!result.ok || result.value.status !== 'accepted') throw new Error('verification failed')
  return result.value.value
}
afterEach(() => vi.unstubAllGlobals())
it('copy/download reject caller-created views and arbitrary URL-like input before any side effects', async () => {
  const deps = { writeClipboard: vi.fn(async () => {}), createObjectURL: vi.fn(() => 'owned'), clickDownload: vi.fn(), revokeObjectURL: vi.fn() }
  const port = new WorkbenchBrowserPort(deps)
  await expect(port.copy(raw as any)).rejects.toThrow('unverified-markdown')
  await expect(port.download('https://example.invalid' as any)).rejects.toThrow('unverified-markdown')
  expect(deps.createObjectURL).not.toHaveBeenCalled(); expect(deps.writeClipboard).not.toHaveBeenCalled()
  const value = await verified(); await port.copy(value); expect(deps.writeClipboard).toHaveBeenCalledWith('中文😀')
  await expect(port.copy({ ...value })).rejects.toThrow('unverified-markdown')
})
it.each(['success', 'throw', 'close', 'dispose'] as const)('owns exact UTF-8 Blob and revokes once on download %s', async mode => {
  const value = await verified(); const blobs: Blob[] = []
  const revoke = vi.fn(); const click = vi.fn(() => { if (mode === 'throw') throw new Error('click failed'); if (mode === 'close') port.close(); if (mode === 'dispose') port.dispose() })
  const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: blob => { blobs.push(blob); return 'owned-by-port' }, clickDownload: click, revokeObjectURL: revoke })
  const operation = port.download(value)
  if (mode === 'throw') await expect(operation).rejects.toThrow('click failed'); else await operation
  port.close(); port.dispose()
  expect(blobs).toHaveLength(1); expect(await blobs[0]!.text()).toBe('中文😀'); expect(blobs[0]!.size).toBe(10)
  expect(click).toHaveBeenCalledWith('owned-by-port', `prd-${input.prdRevisionId}.md`)
  expect(revoke.mock.calls).toEqual([['owned-by-port']])
})
it('revokes a pending asynchronous download on close without double revocation after completion', async () => {
  const value = await verified(); let resolve!: () => void; const gate = new Promise<void>(r => { resolve = r })
  const revoke = vi.fn(); const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: () => 'owned', clickDownload: () => gate, revokeObjectURL: revoke })
  const pending = port.download(value); port.close(); expect(revoke).toHaveBeenCalledTimes(1)
  resolve(); await pending; expect(revoke).toHaveBeenCalledTimes(1)
})
it('store lifecycle touches no browser persistence and final disposal rejects export', async () => {
  const persistence = vi.fn(() => { throw new Error('browser persistence forbidden') })
  for (const key of ['localStorage', 'sessionStorage', 'indexedDB']) vi.stubGlobal(key, new Proxy({}, { get: persistence }))
  const call: ClientConnectionRpc['call'] = async (_channel, endpoint) => ({ ok: true, value: { status: 'accepted', value: endpoint === 'health' ? PRODUCT_CAPABILITIES : [] } })
  const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: () => 'owned', clickDownload: () => {}, revokeObjectURL: () => {} })
  const store = createWorkbenchStore(new ConnectionRpcWorkbenchTransport({ call }), { createCommandId: () => SMALL_PROJECT_ID, createProjectId: () => SMALL_PROJECT_ID }, port)
  await store.open(); store.close(); await store.open(); store.dispose()
  expect(persistence).not.toHaveBeenCalled()
  await expect(port.copy(await verified())).rejects.toThrow('disposed')
})

it('reentrant close during owned URL creation prevents click and still revokes the created resource', async () => {
  const value = await verified(); const revoke = vi.fn(), click = vi.fn()
  const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: () => { port.close(); return 'owned' }, clickDownload: click, revokeObjectURL: revoke })
  await port.download(value)
  expect(click).not.toHaveBeenCalled(); expect(revoke.mock.calls).toEqual([['owned']])
})
