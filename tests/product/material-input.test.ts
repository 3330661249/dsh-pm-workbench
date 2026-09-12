import { expect, it, vi } from 'vitest'
import { readMaterialDraft, canPersistFixtureDraft } from '../../packages/workbench/src/client/workbench/material-input.js'
import { BUILT_IN_SYNTHETIC_TEXT } from '../../packages/workbench/src/analysis/fixture-manifest.js'
function file(text: string, name = 'SYNTHETIC.MD', type = 'text/markdown') {
  const bytes = new TextEncoder().encode(text)
  return { name, type, size: bytes.length, arrayBuffer: vi.fn(async () => bytes.buffer as ArrayBuffer) }
}
it('allows only the exact Fixture hash plus a separate import attestation', async () => {
  const draft = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt' })
  expect(draft.dataClassification).toBe('synthetic')
  expect(canPersistFixtureDraft(draft, false)).toBe(false)
  expect(canPersistFixtureDraft(draft, true)).toBe(true)
  const stranger = await readMaterialDraft({ kind: 'paste', text: '新写的陌生合成文字', displayName: 'sample.txt' })
  expect(stranger.dataClassification).toBe('authorized-real')
  expect(stranger.text).toBe('新写的陌生合成文字')
  expect(canPersistFixtureDraft(stranger, true)).toBe(false)
  expect(canPersistFixtureDraft({ ...stranger, contentHash: draft.contentHash }, true)).toBe(false)
})
it('accepts mixed-case extensions and empty/plain/markdown MIME without normalizing content', async () => {
  for (const name of ['demo.TXT', 'demo.mD']) for (const type of ['', 'text/plain', 'text/markdown']) {
    const draft = await readMaterialDraft({ kind: 'file', file: file('\ufeffa\r\nb\ufeffe\u0301', name, type) })
    expect(draft.text).toBe('a\r\nb\ufeffe\u0301')
    expect(draft.format).toBe(name.endsWith('TXT') ? 'text/plain' : 'text/markdown')
  }
  expect((await readMaterialDraft({ kind: 'file', file: file('\ufeff\ufeffa') })).text).toBe('\ufeffa')
  expect((await readMaterialDraft({ kind: 'paste', text: '\ufeffa', displayName: 'pasted.txt' })).text).toBe('\ufeffa')
})
it.each([['demo.pdf', 'text/plain'], ['demo.txt', 'application/octet-stream'], ['../demo.txt', ''], ['demo.txt', 'text/html']])
('rejects unsafe name/extension or conflicting MIME before reading %s %s', async (name, type) => {
  const input = file('abc', name, type)
  await expect(readMaterialDraft({ kind: 'file', file: input })).rejects.toThrow()
  expect(input.arrayBuffer).not.toHaveBeenCalled()
})
it('checks declared size before reading and actual byte count after reading', async () => {
  const oversized = { ...file('a'), size: 262145 }
  await expect(readMaterialDraft({ kind: 'file', file: oversized })).rejects.toThrow()
  expect(oversized.arrayBuffer).not.toHaveBeenCalled()
  for (const size of [-1, NaN, 0.5, 0, 2]) {
    await expect(readMaterialDraft({ kind: 'file', file: { ...file('a'), size } })).rejects.toThrow()
  }
  await expect(readMaterialDraft({ kind: 'file', file: { ...file('a'), arrayBuffer: async () => new ArrayBuffer(262145) } })).rejects.toThrow()
})
it('uses fatal UTF-8 and rejects NUL, whitespace, malformed Unicode and decoded overflow', async () => {
  await expect(readMaterialDraft({ kind: 'file', file: { ...file('a'), size: 2, arrayBuffer: async () => new Uint8Array([0xc3, 0x28]).buffer } })).rejects.toThrow('invalid-utf8')
  for (const text of ['\0', ' \n', 'a'.repeat(80001), '\ud800']) {
    await expect(readMaterialDraft({ kind: 'paste', text, displayName: 'sample.txt' })).rejects.toThrow()
  }
})
it('captures declared file metadata before the asynchronous byte read', async () => {
  const input = file('abc', 'first.txt', 'text/plain')
  input.arrayBuffer.mockImplementation(async () => { input.size = 200; input.name = 'changed.md'; return new TextEncoder().encode('abc').buffer as ArrayBuffer })
  expect(await readMaterialDraft({ kind: 'file', file: input })).toMatchObject({ text: 'abc', displayName: 'first.txt', format: 'text/plain', utf8Bytes: 3 })
})
