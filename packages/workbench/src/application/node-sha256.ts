import { createHash } from 'node:crypto'

import type { Sha256Hex } from '../domain/ids.js'
import { sha256HexSchema } from '../domain/ids.js'

export function nodeSha256Utf8(value: string): Sha256Hex {
  return sha256HexSchema.parse(createHash('sha256').update(value, 'utf8').digest('hex'))
}
