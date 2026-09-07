import { sha256HexSchema, type Sha256Hex } from '../../domain/ids.js'
import { hasUnpairedSurrogate } from '../../domain/limits.js'

export async function webSha256Utf8(text: string): Promise<Sha256Hex> {
  if (hasUnpairedSurrogate(text)) throw new Error('invalid-text')
  const hash = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return sha256HexSchema.parse(Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join(''))
}
