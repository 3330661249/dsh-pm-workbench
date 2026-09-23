import { expect, it, vi } from 'vitest'
import { crc32, deflateRawSync } from 'node:zlib'
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

// Small, independently generated OOXML ZIP fixtures exercise the actual browser importer.
function wordFile(xml: string, options: { method?: number; name?: string; declaredXmlSize?: number; badCrc?: boolean; duplicate?: boolean } = {}) {
  const xmlBytes = Buffer.from(xml), method = options.method ?? 8
  const data = method === 8 ? deflateRawSync(xmlBytes) : xmlBytes
  const path = Buffer.from(options.name ?? 'word/document.xml')
  const local = Buffer.alloc(30 + path.length), central = Buffer.alloc(46 + path.length), end = Buffer.alloc(22)
  local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(method, 8)
  const checksum = options.badCrc ? 0 : crc32(xmlBytes), declaredSize = options.declaredXmlSize ?? xmlBytes.length
  local.writeUInt32LE(checksum, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(declaredSize, 22)
  local.writeUInt16LE(path.length, 26); path.copy(local, 30)
  central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6)
  central.writeUInt16LE(method, 10); central.writeUInt32LE(checksum, 16); central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(declaredSize, 24); central.writeUInt16LE(path.length, 28); path.copy(central, 46)
  const directory = options.duplicate ? Buffer.concat([central, central]) : central
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(options.duplicate ? 2 : 1, 8); end.writeUInt16LE(options.duplicate ? 2 : 1, 10)
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(local.length + data.length, 16)
  const bytes = new Uint8Array(Buffer.concat([local, data, directory, end]))
  return { name: '访谈.DOCX', type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', size: bytes.length,
    arrayBuffer: vi.fn(async () => bytes.buffer) }
}
const wordXml = (body: string) => `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}</w:body></w:document>`

it.each([0, 8])('imports Word paragraphs, table cells and line breaks from compression method %s', async method => {
  const input = wordFile(wordXml('<w:p><w:r><w:t>访谈 &amp; 需求</w:t></w:r></w:p><w:p><w:r><w:t>第一行</w:t><w:br/><w:t>第二行</w:t><w:tab/><w:t>&#x1F40B;</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>问题</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>回答</w:t></w:r></w:p></w:tc></w:tr></w:tbl>'), { method })
  const result = await readMaterialDraft({ kind: 'file', file: input })
  expect(result.text).toBe('访谈 & 需求\n第一行\n第二行\t🐋\n问题\t回答')
  expect(result.displayName).toBe('访谈.DOCX')
  expect(result.format).toBe('text/plain')
  expect(result.dataClassification).toBe('authorized-real')
})
it('keeps document text only, excluding field instructions and removed revision text', async () => {
  const input = wordFile(wordXml('<w:p><w:r><w:instrText>EXTERNAL COMMAND</w:instrText><w:t>保留内容</w:t></w:r><w:del><w:r><w:delText>删除内容</w:delText></w:r></w:del><w:ins><w:r><w:t>新增内容</w:t></w:r></w:ins></w:p>'))
  expect((await readMaterialDraft({ kind: 'file', file: input })).text).toBe('保留内容新增内容')
})
it('does not turn paragraph tab-stop formatting into content', async () => {
  const input = wordFile(wordXml('<w:p><w:pPr><w:tabs><w:tab w:val="left" w:pos="360"/></w:tabs></w:pPr><w:r><w:t>正文</w:t><w:tab/><w:t>制表</w:t></w:r></w:p>'))
  expect((await readMaterialDraft({ kind: 'file', file: input })).text).toBe('正文\t制表')
})
it('handles OOXML namespaces independently of the chosen prefix', async () => {
  const input = wordFile(wordXml('<w:p><w:r><w:t>前缀可变</w:t></w:r></w:p>').replaceAll('w:', 'doc:').replace('xmlns:w=', 'xmlns:doc='))
  expect((await readMaterialDraft({ kind: 'file', file: input })).text).toBe('前缀可变')
})
it.each([
  '<!DOCTYPE x [<!ENTITY leak SYSTEM "file:///private/key">]><w:p><w:r><w:t>&leak;</w:t></w:r></w:p>',
  '<w:p><w:r><w:t>断裂 XML</w:r></w:p>',
  '<w:p><w:r><w:t>&undefined;</w:t></w:r></w:p>',
])('rejects unsafe or malformed Word XML without recovering a partial draft', async body => {
  await expect(readMaterialDraft({ kind: 'file', file: wordFile(wordXml(body)) })).rejects.toThrow('invalid-docx')
})
it.each([
  { badCrc: true }, { duplicate: true }, { name: 'other/document.xml' }, { declaredXmlSize: 2_097_153 }, { declaredXmlSize: 1 },
])('rejects corrupt, missing, duplicate or oversized Word bodies %j', async options => {
  await expect(readMaterialDraft({ kind: 'file', file: wordFile(wordXml('<w:p><w:r><w:t>正文</w:t></w:r></w:p>'), options) })).rejects.toThrow('invalid-docx')
})
it('checks Word file size before reading and retains the existing decoded text limit', async () => {
  const tooLarge = { ...wordFile(wordXml('<w:p/>')), size: 10_485_761 }
  await expect(readMaterialDraft({ kind: 'file', file: tooLarge })).rejects.toThrow('invalid-file-size')
  expect(tooLarge.arrayBuffer).not.toHaveBeenCalled()
  await expect(readMaterialDraft({ kind: 'file', file: wordFile(wordXml(`<w:p><w:r><w:t>${'文字'.repeat(40_001)}</w:t></w:r></w:p>`), { method: 0 }) })).rejects.toThrow('invalid-source')
})
