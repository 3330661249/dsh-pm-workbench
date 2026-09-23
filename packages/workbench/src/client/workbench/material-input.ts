import { FIXTURE_MANIFEST } from '../../analysis/fixture-manifest.js'
import { sourceDisplayNameSchema } from '../../domain/model.js'
import { MAX_SOURCE_RAW_UTF8_BYTES, MAX_SOURCE_UTF16_CODE_UNITS, hasUnpairedSurrogate, utf8ByteLength } from '../../domain/limits.js'
import { decodeMaterialFile } from '../../domain/text.js'
import type { Sha256Hex } from '../../domain/ids.js'
import { webSha256Utf8 } from './web-sha256.js'
import { MAX_DOCX_FILE_BYTES, readDocxText } from './docx-input.js'

export interface MaterialFile {
  readonly name: string
  readonly type: string
  readonly size: number
  arrayBuffer(): Promise<ArrayBuffer>
}
export type MaterialInput = { readonly kind: 'file'; readonly file: MaterialFile }
  | { readonly kind: 'paste'; readonly text: string; readonly displayName: string }
export interface MaterialDraft {
  readonly text: string
  readonly displayName: string
  readonly format: 'pasted' | 'text/plain' | 'text/markdown'
  readonly utf8Bytes: number
  readonly contentHash: Sha256Hex
  readonly dataClassification: 'synthetic' | 'authorized-real'
}
const verifiedDrafts = new WeakSet<object>()
export async function readMaterialDraft(input: MaterialInput): Promise<MaterialDraft> {
  let text: string, displayName: string, format: MaterialDraft['format']
  if (input.kind === 'file') {
    const file = input.file
    const declaredSize = file.size
    displayName = sourceDisplayNameSchema.parse(file.name)
    const extension = /\.(txt|md|docx)$/i.exec(displayName)?.[1]?.toLowerCase()
    const isWord = extension === 'docx'
    const allowedMime = isWord ? ['', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'] : ['', 'text/plain', 'text/markdown']
    if (!extension || !allowedMime.includes(file.type)) throw new Error('unsupported-file')
    const maximumFileSize = isWord ? MAX_DOCX_FILE_BYTES : MAX_SOURCE_RAW_UTF8_BYTES
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 1 || declaredSize > maximumFileSize) throw new Error('invalid-file-size')
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength !== declaredSize || bytes.byteLength > maximumFileSize) throw new Error('invalid-file-size')
    format = extension === 'md' ? 'text/markdown' : 'text/plain'
    text = isWord ? await readDocxText(bytes) : decodeMaterialFile(bytes, format, displayName).text
  } else {
    displayName = sourceDisplayNameSchema.parse(input.displayName)
    text = input.text
    format = 'pasted'
  }
  if (hasUnpairedSurrogate(text) || text.includes('\0') || !text.trim() || text.length > MAX_SOURCE_UTF16_CODE_UNITS
    || utf8ByteLength(text) > MAX_SOURCE_RAW_UTF8_BYTES) throw new Error('invalid-source')
  const contentHash = await webSha256Utf8(text)
  const dataClassification = Object.hasOwn(FIXTURE_MANIFEST.sources, contentHash) ? 'synthetic' as const : 'authorized-real' as const
  const draft = Object.freeze({ text, displayName, format, utf8Bytes: utf8ByteLength(text), contentHash, dataClassification })
  verifiedDrafts.add(draft)
  return draft
}
/** Attestation is supplied independently for this import; object ownership prevents hash substitution. */
export function canPersistFixtureDraft(draft: MaterialDraft, importAttested: boolean): boolean {
  return importAttested === true && verifiedDrafts.has(draft) && draft.dataClassification === 'synthetic'
    && Object.hasOwn(FIXTURE_MANIFEST.sources, draft.contentHash)
}
/** Real text is accepted only from the exact verified browser-owned draft after a separate user attestation. */
export function canPersistMaterialDraft(draft: MaterialDraft, importAttested: boolean): boolean {
  return importAttested === true && verifiedDrafts.has(draft)
}
