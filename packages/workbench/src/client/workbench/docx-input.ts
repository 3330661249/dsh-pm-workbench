/** Local-only DOCX text extraction. Relationships, external resources and embedded files are never opened. */
export const MAX_DOCX_FILE_BYTES = 10 * 1024 * 1024
const MAX_XML_BYTES = 2 * 1024 * 1024
const MAX_ZIP_ENTRIES = 2048
const decoder = new TextDecoder('utf-8', { fatal: true })
function invalid(): never { throw new Error('invalid-docx') }

function checksum(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

async function documentXml(bytes: Uint8Array): Promise<string> {
  if (bytes.length > MAX_DOCX_FILE_BYTES || bytes.length < 22) invalid()
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let end = -1
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length) { end = offset; break }
  }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) invalid()
  const count = view.getUint16(end + 10, true), directorySize = view.getUint32(end + 12, true), directoryStart = view.getUint32(end + 16, true)
  if (!count || count > MAX_ZIP_ENTRIES || count !== view.getUint16(end + 8, true) || directoryStart + directorySize !== end) invalid()
  let cursor = directoryStart, totalSize = 0
  let document: { data: Uint8Array; size: number; crc: number; method: number } | undefined
  const names = new Set<string>()
  for (let index = 0; index < count; index++) {
    if (cursor + 46 > end || view.getUint32(cursor, true) !== 0x02014b50) invalid()
    const flags = view.getUint16(cursor + 8, true), method = view.getUint16(cursor + 10, true)
    const crc = view.getUint32(cursor + 16, true), compressedSize = view.getUint32(cursor + 20, true), size = view.getUint32(cursor + 24, true)
    const nameLength = view.getUint16(cursor + 28, true), extraLength = view.getUint16(cursor + 30, true), commentLength = view.getUint16(cursor + 32, true)
    const local = view.getUint32(cursor + 42, true), next = cursor + 46 + nameLength + extraLength + commentLength
    if (next > end || !nameLength || flags & 0x2041 || view.getUint16(cursor + 34, true) || size === 0xffffffff || compressedSize === 0xffffffff) invalid()
    totalSize += size
    if (totalSize > 64 * 1024 * 1024) invalid()
    const name = decoder.decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength))
    if (names.has(name) || name.includes('\0')) invalid()
    names.add(name)
    if (name === 'word/document.xml') {
      if (!size || size > MAX_XML_BYTES || size > Math.max(65536, compressedSize * 200) || ![0, 8].includes(method)) invalid()
      if (local + 30 > directoryStart || view.getUint32(local, true) !== 0x04034b50
        || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method) invalid()
      const localNameLength = view.getUint16(local + 26, true), localExtraLength = view.getUint16(local + 28, true)
      const start = local + 30 + localNameLength + localExtraLength
      if (start + compressedSize > directoryStart || decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) invalid()
      if (!(flags & 8) && (view.getUint32(local + 14, true) !== crc || view.getUint32(local + 18, true) !== compressedSize || view.getUint32(local + 22, true) !== size)) invalid()
      document = { data: bytes.slice(start, start + compressedSize), size, crc, method }
    }
    cursor = next
  }
  if (cursor !== end || !document) invalid()
  let xml: Uint8Array
  if (document.method === 0) xml = document.data
  else {
    // Streaming bounds protect against a forged central-directory size and ZIP expansion.
    const stream = new Blob([new Uint8Array(document.data)]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const reader = stream.getReader(), chunks: Uint8Array[] = []
    let received = 0
    try {
      while (true) {
        const chunk = await reader.read()
        if (chunk.done) break
        received += chunk.value.length
        if (received > document.size || received > MAX_XML_BYTES) { await reader.cancel(); invalid() }
        chunks.push(chunk.value)
      }
    } finally { reader.releaseLock() }
    xml = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) { xml.set(chunk, offset); offset += chunk.length }
  }
  if (xml.length !== document.size || checksum(xml) !== document.crc) invalid()
  return decoder.decode(xml)
}

const WORD_NAMESPACES = new Set(['http://schemas.openxmlformats.org/wordprocessingml/2006/main', 'http://purl.oclc.org/ooxml/wordprocessingml/main'])
function entities(value: string): string {
  return value.replace(/&([^;\s<&]*);|&/g, (whole, entity: string | undefined) => {
    const predefined: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
    if (entity && Object.hasOwn(predefined, entity)) return predefined[entity]!
    if (!entity || !/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity)) return invalid()
    const code = entity.startsWith('#x') ? parseInt(entity.slice(2), 16) : Number(entity.slice(1))
    if (!Number.isSafeInteger(code) || code > 0x10ffff || code < 0x20 && ![9, 10, 13].includes(code)
      || code >= 0xd800 && code <= 0xdfff || code === 0xfffe || code === 0xffff) return invalid()
    return String.fromCodePoint(code)
  })
}

interface ElementState { name: string; wordName: string; namespaces: Record<string, string>; body: boolean; omitted: boolean }
/** A bounded XML tokenizer avoids browser/Node parser differences and never resolves entities. */
function bodyText(xml: string): string {
  if (/<!DOCTYPE|<!ENTITY/i.test(xml) || /[\x00-\x08\x0b\x0c\x0e-\x1f\ufffe\uffff]/.test(xml)) invalid()
  const tokens = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<!\[CDATA\[[\s\S]*?\]\]>|<\/?[A-Za-z_](?:[^<>"']|"[^"<]*"|'[^'<]*')*>|[^<]+/gy
  const stack: ElementState[] = []
  let text = '', cursor = 0, count = 0, rootSeen = false, bodySeen = false
  function append(value: string) { text += value }
  function close(element: ElementState) {
    if (!element.body || element.omitted) return
    if (element.wordName === 'p') append('\n')
    if (element.wordName === 'tc') { text = text.replace(/\n+$/, ''); append('\t') }
    if (element.wordName === 'tr') { text = text.replace(/\t+$/, ''); append('\n') }
  }
  for (let match = tokens.exec(xml); match; match = tokens.exec(xml)) {
    if (++count > 150000 || match.index !== cursor) invalid()
    const token = match[0], parent = stack[stack.length - 1]
    cursor = tokens.lastIndex
    if (token.startsWith('<!--') || token.startsWith('<?')) continue
    if (token.startsWith('<![CDATA[') || !token.startsWith('<')) {
      const value = token.startsWith('<![CDATA[') ? token.slice(9, -3) : entities(token)
      if (!parent && value.trim()) invalid()
      if (parent?.body && !parent.omitted && parent.wordName === 't') append(value)
      continue
    }
    if (token.startsWith('</')) {
      const name = /^<\/([A-Za-z_][\w.:-]*)\s*>$/.exec(token)?.[1]
      if (!parent || parent.name !== name) invalid()
      close(parent); stack.pop(); continue
    }
    const parsed = /^<([A-Za-z_][\w.:-]*)([\s\S]*?)(\/?)>$/.exec(token)
    if (!parsed || stack.length >= 128) invalid()
    const name = parsed[1]!, selfClosing = !!parsed[3], namespaces = { ...parent?.namespaces }
    let attributes = parsed[2]!, attributeCount = 0
    const seenAttributes = new Set<string>()
    while (attributes.trim()) {
      const attr = /^\s+([A-Za-z_][\w.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/.exec(attributes)
      if (!attr || ++attributeCount > 256 || seenAttributes.has(attr[1]!)) invalid()
      seenAttributes.add(attr[1]!)
      const value = entities(attr[2] ?? attr[3] ?? '')
      if (attr[1] === 'xmlns') namespaces[''] = value
      else if (attr[1]!.startsWith('xmlns:')) namespaces[attr[1]!.slice(6)] = value
      attributes = attributes.slice(attr[0].length)
    }
    const parts = name.split(':')
    if (parts.length > 2) invalid()
    const namespace = namespaces[parts.length === 2 ? parts[0]! : '']
    if (parts.length === 2 && !namespace) invalid()
    const wordName = namespace && WORD_NAMESPACES.has(namespace) ? parts[parts.length - 1]! : ''
    if (!parent) {
      if (rootSeen || wordName !== 'document') invalid()
      rootSeen = true
    }
    if (wordName === 'body') {
      if (bodySeen || parent?.wordName !== 'document') invalid()
      bodySeen = true
    }
    const element = { name, wordName, namespaces, body: parent?.body === true || wordName === 'body',
      omitted: parent?.omitted === true || ['del', 'moveFrom'].includes(wordName) }
    if (element.body && !element.omitted && parent?.wordName === 'r') {
      if (wordName === 'tab') append('\t')
      if (wordName === 'br' || wordName === 'cr') append('\n')
    }
    if (selfClosing) close(element)
    else stack.push(element)
  }
  if (cursor !== xml.length || stack.length || !rootSeen || !bodySeen) invalid()
  return text.replace(/\n+$/, '')
}

export async function readDocxText(bytes: Uint8Array): Promise<string> {
  try { return bodyText(await documentXml(bytes)) }
  catch { return invalid() }
}
