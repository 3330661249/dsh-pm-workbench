import type { Sha256Hex } from './ids.js'
import {
  MAX_SOURCE_RAW_UTF8_BYTES,
  MAX_SOURCE_UTF16_CODE_UNITS,
  utf8ByteLength,
} from './limits.js'
import {
  sourceRevisionSchema,
  type SourceRevision,
} from './model.js'

export interface DecodedMaterialFile {
  readonly format: 'text/plain' | 'text/markdown'
  readonly displayName: string
  readonly text: string
  readonly utf8Bytes: number
}

function invalidSource(): never {
  throw new Error('invalid-source')
}

function assertFinalText(text: string): void {
  if (text.length > MAX_SOURCE_UTF16_CODE_UNITS) throw new Error('source-too-long')
  if (text.includes('\0') || text.trim().length === 0) invalidSource()
}

export function decodeMaterialFile(
  bytes: Uint8Array,
  format: 'text/plain' | 'text/markdown',
  displayName: string,
): DecodedMaterialFile {
  if (bytes.byteLength > MAX_SOURCE_RAW_UTF8_BYTES) throw new Error('raw-source-too-large')

  let decoded: string
  try {
    decoded = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes)
  } catch {
    throw new Error('invalid-utf8')
  }
  const text = decoded.startsWith('\ufeff') ? decoded.slice(1) : decoded
  assertFinalText(text)

  return Object.freeze({
    format,
    displayName,
    text,
    utf8Bytes: utf8ByteLength(text),
  })
}

export function validatePersistedSource(
  source: SourceRevision,
  sha256Utf8: (value: string) => Sha256Hex,
): SourceRevision {
  try {
    sourceRevisionSchema.parse(source)
    assertFinalText(source.text)
    if (utf8ByteLength(source.text) !== source.utf8Bytes) invalidSource()
    if (sha256Utf8(source.text) !== source.contentHash) invalidSource()
    return source
  } catch {
    return invalidSource()
  }
}
