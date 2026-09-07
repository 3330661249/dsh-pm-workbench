import { FIXTURE_MANIFEST } from '../../analysis/fixture-manifest.js'
import { sourceDisplayNameSchema } from '../../domain/model.js'
import { MAX_SOURCE_RAW_UTF8_BYTES, MAX_SOURCE_UTF16_CODE_UNITS, hasUnpairedSurrogate, utf8ByteLength } from '../../domain/limits.js'
import { decodeMaterialFile } from '../../domain/text.js'
import type { Sha256Hex } from '../../domain/ids.js'
import { webSha256Utf8 } from './web-sha256.js'

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
}
const verifiedDrafts = new WeakSet<object>()
export async function readMaterialDraft(input: MaterialInput): Promise<MaterialDraft> {
  let text: string, displayName: string, format: MaterialDraft['format']
  if (input.kind === 'file') {
    const file = input.file
    const declaredSize = file.size
    displayName = sourceDisplayNameSchema.parse(file.name)
    const extension = /\.(txt|md)$/i.exec(displayName)?.[1]?.toLowerCase()
    if (!extension || !['', 'text/plain', 'text/markdown'].includes(file.type)) throw new Error('unsupported-file')
    if (!Number.isSafeInteger(declaredSize) || declaredSize < 1 || declaredSize > MAX_SOURCE_RAW_UTF8_BYTES) throw new Error('invalid-file-size')
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (bytes.byteLength !== declaredSize || bytes.byteLength > MAX_SOURCE_RAW_UTF8_BYTES) throw new Error('invalid-file-size')
    format = extension === 'txt' ? 'text/plain' : 'text/markdown'
    text = decodeMaterialFile(bytes, format, displayName).text
  } else {
    displayName = sourceDisplayNameSchema.parse(input.displayName)
    text = input.text
    format = 'pasted'
  }
  if (hasUnpairedSurrogate(text) || text.includes('\0') || !text.trim() || text.length > MAX_SOURCE_UTF16_CODE_UNITS
    || utf8ByteLength(text) > MAX_SOURCE_RAW_UTF8_BYTES) throw new Error('invalid-source')
  const draft = Object.freeze({ text, displayName, format, utf8Bytes: utf8ByteLength(text), contentHash: await webSha256Utf8(text) })
  verifiedDrafts.add(draft)
  return draft
}
/** Attestation is supplied independently for this import; object ownership prevents hash substitution. */
export function canPersistFixtureDraft(draft: MaterialDraft, importAttested: boolean): boolean {
  return importAttested === true && verifiedDrafts.has(draft) && Object.hasOwn(FIXTURE_MANIFEST.sources, draft.contentHash)
}
