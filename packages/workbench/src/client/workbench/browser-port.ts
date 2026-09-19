import type { MarkdownView } from '../../application/project-views.js'
import { isVerifiedMarkdown } from './transport.js'

const WORD_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
const PACKAGE_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'
const OFFICE_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const XML_HEADER = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'

function xmlText(value: string): string {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '\ufffd')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Decode only the literal escapes emitted by pmwb-prd-v1, never source HTML. */
function rendererText(value: string): string {
  return value.replace(/\\([\\`*_{}\[\]()#+.!|^~-])/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&')
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Small, uncompressed OPC ZIP: no network calls, macros, external links or dependencies. */
function wordZip(parts: Readonly<Record<string, string>>): Uint8Array<ArrayBuffer> {
  const encoder = new TextEncoder()
  const entries = Object.entries(parts).map(([name, content]) => ({ name: encoder.encode(name), bytes: encoder.encode(XML_HEADER + content) }))
  const localSize = entries.reduce((sum, entry) => sum + 30 + entry.name.length + entry.bytes.length, 0)
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.name.length, 0)
  const output = new Uint8Array(new ArrayBuffer(localSize + centralSize + 22)), view = new DataView(output.buffer)
  let local = 0, central = localSize
  for (const entry of entries) {
    const crc = crc32(entry.bytes), size = entry.bytes.length
    view.setUint32(local, 0x04034b50, true)
    view.setUint16(local + 4, 20, true); view.setUint16(local + 6, 0x0800, true)
    view.setUint16(local + 12, 33, true); view.setUint32(local + 14, crc, true)
    view.setUint32(local + 18, size, true); view.setUint32(local + 22, size, true)
    view.setUint16(local + 26, entry.name.length, true)
    output.set(entry.name, local + 30); output.set(entry.bytes, local + 30 + entry.name.length)
    view.setUint32(central, 0x02014b50, true)
    view.setUint16(central + 4, 20, true); view.setUint16(central + 6, 20, true)
    view.setUint16(central + 8, 0x0800, true); view.setUint16(central + 14, 33, true)
    view.setUint32(central + 16, crc, true); view.setUint32(central + 20, size, true); view.setUint32(central + 24, size, true)
    view.setUint16(central + 28, entry.name.length, true); view.setUint32(central + 42, local, true)
    output.set(entry.name, central + 46)
    local += 30 + entry.name.length + size; central += 46 + entry.name.length
  }
  view.setUint32(central, 0x06054b50, true)
  view.setUint16(central + 8, entries.length, true); view.setUint16(central + 10, entries.length, true)
  view.setUint32(central + 12, centralSize, true); view.setUint32(central + 16, localSize, true)
  return output
}

/** Format the current renderer's headings, flat lists and literal text as native Word paragraphs. */
function wordDocument(markdown: string): Blob {
  const title = rendererText(markdown.match(/^- 项目名称：(.*)$/m)?.[1]?.trim() || '产品需求文档')
  const paragraph = (text: string, style = 'Normal', bullet = false, pageBreak = false) =>
    `<w:p><w:pPr><w:pStyle w:val="${style}"/>${pageBreak ? '<w:pageBreakBefore/>' : ''}${bullet ? '<w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>' : ''}</w:pPr><w:r><w:t xml:space="preserve">${xmlText(text)}</w:t></w:r></w:p>`
  const body = [paragraph(title, 'Title')]
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = line.match(/^(#{1,6}) (.*)$/)
    if (heading) {
      const level = Math.max(1, heading[1]!.length - 1), text = rendererText(heading[2]!)
      body.push(paragraph(text, `Heading${level}`, false, text === '可追溯信息'))
    } else if (line.startsWith('- ')) body.push(paragraph(rendererText(line.slice(2)), 'Normal', true))
    else if (line.trim()) body.push(paragraph(rendererText(line)))
  }
  const styles = [
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:after="120" w:line="360" w:lineRule="auto"/></w:pPr><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:eastAsia="宋体"/><w:color w:val="222222"/><w:sz w:val="22"/></w:rPr></w:style>',
    '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:after="360"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style>',
    ...Array.from({ length: 5 }, (_, index) => `<w:style w:type="paragraph" w:styleId="Heading${index + 1}"><w:name w:val="heading ${index + 1}"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120"/><w:outlineLvl w:val="${index}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${index === 0 ? 32 : 26}"/></w:rPr></w:style>`),
  ].join('')
  const bytes = wordZip({
    '[Content_Types].xml': '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/word/numbering.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml"/></Types>',
    '_rels/.rels': `<Relationships xmlns="${PACKAGE_NS}"><Relationship Id="rId1" Type="${OFFICE_NS}/officeDocument" Target="word/document.xml"/></Relationships>`,
    'word/document.xml': `<w:document xmlns:w="${WORD_NS}"><w:body>${body.join('')}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`,
    'word/_rels/document.xml.rels': `<Relationships xmlns="${PACKAGE_NS}"><Relationship Id="rId1" Type="${OFFICE_NS}/styles" Target="styles.xml"/><Relationship Id="rId2" Type="${OFFICE_NS}/numbering" Target="numbering.xml"/></Relationships>`,
    'word/styles.xml': `<w:styles xmlns:w="${WORD_NS}">${styles}</w:styles>`,
    'word/numbering.xml': `<w:numbering xmlns:w="${WORD_NS}"><w:abstractNum w:abstractNumId="0"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="bullet"/><w:lvlText w:val="•"/><w:lvlJc w:val="left"/><w:pPr><w:tabs><w:tab w:val="num" w:pos="360"/></w:tabs><w:ind w:left="360" w:hanging="180"/></w:pPr></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="0"/></w:num></w:numbering>`,
  })
  return new Blob([bytes], { type: WORD_MIME })
}

export interface WorkbenchBrowserDependencies {
  writeClipboard(text: string): Promise<void>
  createObjectURL(blob: Blob): string
  clickDownload(ownedUrl: string, downloadName: string): void | Promise<void>
  revokeObjectURL(ownedUrl: string): void
  pickSaveFile?(options: { startIn: 'desktop'; suggestedName: string; types: { description: string; accept: Record<string, string[]> }[] }): Promise<{
    createWritable(): Promise<{ write(blob: Blob): Promise<void>; close(): Promise<void>; abort(): Promise<void> }>
  }>
}
/** Owns every export resource; consumers provide validated text, never a URL. */
export class WorkbenchBrowserPort {
  private readonly owned = new Set<string>()
  private disposed = false
  private generation = 0
  constructor(private readonly browser: WorkbenchBrowserDependencies) {}
  private assert(value: MarkdownView): void {
    if (this.disposed) throw new Error('disposed')
    if (!isVerifiedMarkdown(value)) throw new Error('unverified-markdown')
  }
  async copy(value: MarkdownView): Promise<void> {
    this.assert(value)
    await this.browser.writeClipboard(value.markdown)
  }
  async download(value: MarkdownView): Promise<void> {
    this.assert(value)
    const generation = this.generation
    const current = () => !this.disposed && generation === this.generation
    const blob = wordDocument(value.markdown), name = `prd-${value.prdRevisionId}.docx`
    if (this.browser.pickSaveFile) {
      let file: Awaited<ReturnType<NonNullable<WorkbenchBrowserDependencies['pickSaveFile']>>>
      try {
        file = await this.browser.pickSaveFile({ startIn: 'desktop', suggestedName: name,
          types: [{ description: 'Word PRD', accept: { [WORD_MIME]: ['.docx'] } }] })
      } catch (error) {
        // Cancellation is final: never start a second download or write elsewhere.
        if (error instanceof DOMException && error.name === 'AbortError') return
        throw error
      }
      if (!current()) return
      const writer = await file.createWritable()
      try {
        if (!current()) { await writer.abort(); return }
        await writer.write(blob)
        if (current()) await writer.close(); else await writer.abort()
      } catch (error) { try { await writer.abort() } catch { /* preserve the write failure */ } throw error }
      return
    }
    const url = this.browser.createObjectURL(blob)
    this.owned.add(url)
    try {
      if (current()) await this.browser.clickDownload(url, name)
    } finally { this.revoke(url) }
  }
  private revoke(url: string): void {
    if (this.owned.delete(url)) this.browser.revokeObjectURL(url)
  }
  close(): void {
    this.generation++
    for (const url of [...this.owned]) {
      try { this.revoke(url) } catch { /* continue cleaning remaining owned resources */ }
    }
  }
  dispose(): void { this.disposed = true; this.close() }
}
