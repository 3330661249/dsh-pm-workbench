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
async function verified(markdown = raw.markdown) {
  const document = { ...raw, markdown, contentHash: nodeSha256Utf8(markdown), utf8Bytes: Buffer.byteLength(markdown) }
  const t = new ConnectionRpcWorkbenchTransport({ call: async () => ({ ok: true, value: { status: 'accepted', value: document } }) })
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
function wordParts(bytes: ArrayBuffer): Record<string, string> {
  const buffer = Buffer.from(bytes), parts: Record<string, string> = {}
  let offset = 0
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    expect(buffer.readUInt16LE(offset + 8)).toBe(0)
    const size = buffer.readUInt32LE(offset + 18), nameLength = buffer.readUInt16LE(offset + 26), extraLength = buffer.readUInt16LE(offset + 28)
    const name = buffer.subarray(offset + 30, offset + 30 + nameLength).toString('utf8')
    const start = offset + 30 + nameLength + extraLength
    parts[name] = buffer.subarray(start, start + size).toString('utf8')
    offset = start + size
  }
  expect(buffer.readUInt32LE(offset)).toBe(0x02014b50)
  expect(buffer.readUInt32LE(buffer.length - 22)).toBe(0x06054b50)
  return parts
}
it.each(['success', 'throw', 'close', 'dispose'] as const)('owns a native Word Blob and revokes once on download %s', async mode => {
  const value = await verified(); const blobs: Blob[] = []
  const revoke = vi.fn(); const click = vi.fn(() => { if (mode === 'throw') throw new Error('click failed'); if (mode === 'close') port.close(); if (mode === 'dispose') port.dispose() })
  const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: blob => { blobs.push(blob); return 'owned-by-port' }, clickDownload: click, revokeObjectURL: revoke })
  const operation = port.download(value)
  if (mode === 'throw') await expect(operation).rejects.toThrow('click failed'); else await operation
  port.close(); port.dispose()
  expect(blobs).toHaveLength(1)
  expect(blobs[0]!.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
  const parts = wordParts(await blobs[0]!.arrayBuffer())
  expect(parts['word/document.xml']).toContain('中文😀')
  expect(parts['[Content_Types].xml']).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml')
  expect(parts['_rels/.rels']).toContain('word/document.xml')
  expect(click).toHaveBeenCalledWith('owned-by-port', `prd-${input.prdRevisionId}.docx`)
  expect(revoke.mock.calls).toEqual([['owned-by-port']])
})
it('formats renderer headings and lists as editable Word content and keeps escaped source text inert', async () => {
  const markdown = '## 功能需求\n### 审批意见\n- 中文😀 &amp; &lt;script&gt;\n- 字面\\*星号\\*\n\n### 可追溯信息\n- quoteHash=abc123'
  const value = await verified(markdown); let blob!: Blob
  const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: value => { blob = value; return 'owned' }, clickDownload: () => {}, revokeObjectURL: () => {} })
  await port.download(value)
  const parts = wordParts(await blob.arrayBuffer()), xml = parts['word/document.xml']!
  expect(xml).toContain('<w:pStyle w:val="Heading1"/>')
  expect(xml).toContain('<w:pStyle w:val="Heading2"/>')
  expect(xml).toContain('<w:numPr>')
  expect(xml).toContain('中文😀 &amp; &lt;script&gt;')
  expect(xml).toContain('字面*星号*')
  expect(xml).toContain('quoteHash=abc123')
  expect(xml).not.toContain('<script>')
  expect(xml).not.toContain('## 功能需求')
  expect(parts['word/styles.xml']).toContain('Heading1')
  // OpenXML's run-property sequence requires color before size; reversing it violates the WordprocessingML schema.
  expect(parts['word/styles.xml']).toContain('<w:color w:val="222222"/><w:sz w:val="22"/>')
  expect(parts['word/numbering.xml']).toContain('bullet')
  for (const [name, content] of Object.entries(parts)) if (name.endsWith('.rels')) expect(content).not.toContain('TargetMode="External"')
})
it('revokes a pending asynchronous download on close without double revocation after completion', async () => {
  const value = await verified(); let resolve!: () => void; const gate = new Promise<void>(r => { resolve = r })
  const revoke = vi.fn(); const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: () => 'owned', clickDownload: () => gate, revokeObjectURL: revoke })
  const pending = port.download(value); port.close(); expect(revoke).toHaveBeenCalledTimes(1)
  resolve(); await pending; expect(revoke).toHaveBeenCalledTimes(1)
})
it('saves a verified Word PRD through a desktop file picker without using a browser download URL', async () => {
  const write = vi.fn(), close = vi.fn(), abort = vi.fn()
  const pickSaveFile = vi.fn(async () => ({ createWritable: async () => ({ write, close, abort }) }))
  const createObjectURL = vi.fn(), clickDownload = vi.fn(), revokeObjectURL = vi.fn()
  const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL, clickDownload, revokeObjectURL, pickSaveFile })
  const value = await verified(); await port.download(value)
  expect(pickSaveFile).toHaveBeenCalledWith({ startIn: 'desktop', suggestedName: `prd-${value.prdRevisionId}.docx`,
    types: [{ description: 'Word PRD', accept: { 'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'] } }] })
  expect(write).toHaveBeenCalledTimes(1)
  expect(wordParts(await (write.mock.calls[0]![0] as Blob).arrayBuffer())['word/document.xml']).toContain('中文😀')
  expect(close).toHaveBeenCalledOnce(); expect(abort).not.toHaveBeenCalled()
  expect(createObjectURL).not.toHaveBeenCalled(); expect(clickDownload).not.toHaveBeenCalled(); expect(revokeObjectURL).not.toHaveBeenCalled()
})
it.each(['cancel', 'closed', 'closed-during-write', 'write-failed'] as const)('does not fall back to another download when desktop save is %s', async mode => {
  const write = vi.fn(async () => { if (mode === 'write-failed') throw new Error('WRITE_FAILED'); if (mode === 'closed-during-write') port.close() }), close = vi.fn(), abort = vi.fn(), createWritable = vi.fn(async () => ({ write, close, abort }))
  const clickDownload = vi.fn()
  const port = new WorkbenchBrowserPort({ writeClipboard: async () => {}, createObjectURL: () => 'owned', clickDownload, revokeObjectURL: () => {},
    pickSaveFile: async () => { if (mode === 'cancel') throw new DOMException('cancel', 'AbortError'); if (mode === 'closed') port.close(); return { createWritable } } })
  const operation = port.download(await verified())
  if (mode === 'write-failed') await expect(operation).rejects.toThrow('WRITE_FAILED'); else await operation
  expect(clickDownload).not.toHaveBeenCalled(); expect(close).not.toHaveBeenCalled()
  if (mode === 'write-failed' || mode === 'closed-during-write') expect(abort).toHaveBeenCalledOnce(); else expect(createWritable).not.toHaveBeenCalled()
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
