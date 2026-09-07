import { describe, expect, it } from 'vitest'

import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import {
  decodeMaterialFile,
  validatePersistedSource,
} from '../../packages/workbench/src/domain/text.js'
import {
  projectIdSchema,
  sourceRevisionIdSchema,
} from '../../packages/workbench/src/domain/ids.js'
import type { SourceRevision } from '../../packages/workbench/src/domain/model.js'

const PROJECT_ID = projectIdSchema.parse('00000000-0000-4000-8000-000000000101')
const SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000101')

function source(text: string, overrides: Partial<SourceRevision> = {}): SourceRevision {
  return {
    id: SOURCE_ID,
    projectId: PROJECT_ID,
    revision: 1,
    displayName: '合成访谈.txt',
    format: 'text/plain',
    text,
    utf8Bytes: new TextEncoder().encode(text).byteLength,
    contentHash: nodeSha256Utf8(text),
    syntheticDataAttested: true,
    ...overrides,
  }
}

describe('material UTF-8 decoding', () => {
  it('accepts raw input at 262144 bytes but applies the independent final-string limit', () => {
    const bytes = new TextEncoder().encode('x'.repeat(262_144))
    expect(() => decodeMaterialFile(bytes, 'text/plain', 'boundary.txt')).toThrowError('source-too-long')
  })

  it('rejects raw input at 262145 bytes before decoding', () => {
    const invalidUtf8AfterLimit = new Uint8Array(262_145).fill(0x78)
    invalidUtf8AfterLimit[262_144] = 0xff
    expect(() => decodeMaterialFile(invalidUtf8AfterLimit, 'text/plain', 'over.txt'))
      .toThrowError('raw-source-too-large')
  })

  it('accepts exactly 80000 UTF-16 units and rejects 80001', () => {
    const accepted = decodeMaterialFile(new TextEncoder().encode('字'.repeat(80_000)), 'text/markdown', 'exact.md')
    expect(accepted.text.length).toBe(80_000)
    expect(() => decodeMaterialFile(new TextEncoder().encode('字'.repeat(80_001)), 'text/markdown', 'over.md'))
      .toThrowError('source-too-long')
  })

  it('decodes UTF-8 fatally', () => {
    expect(() => decodeMaterialFile(Uint8Array.from([0x66, 0x6f, 0x80]), 'text/plain', 'invalid.txt'))
      .toThrowError('invalid-utf8')
  })

  it('removes only one leading UTF-8 BOM and preserves interior BOM and line endings', () => {
    const text = '\ufeff\ufeff第一行\r\n第二行\n中\ufeff间'
    const decoded = decodeMaterialFile(new TextEncoder().encode(text), 'text/plain', 'bom.txt')
    expect(decoded.text).toBe('\ufeff第一行\r\n第二行\n中\ufeff间')
    expect(decoded.utf8Bytes).toBe(new TextEncoder().encode(decoded.text).byteLength)
  })

  it.each(['   \r\n\t', '有内容\0尾部'])('rejects blank-after-trim or NUL text %#', (text) => {
    expect(() => decodeMaterialFile(new TextEncoder().encode(text), 'text/plain', 'invalid.txt'))
      .toThrowError('invalid-source')
  })
})

describe('persisted source validation', () => {
  it('accepts an exact source without normalizing its text', () => {
    const value = source('第一行\r\n第二行\n中\ufeff间')
    expect(validatePersistedSource(value, nodeSha256Utf8)).toBe(value)
    expect(value.text).toBe('第一行\r\n第二行\n中\ufeff间')
  })

  it('allows the persisted byte-count field at 262144 and rejects 262145', () => {
    expect(() => validatePersistedSource(source('短文本', { utf8Bytes: 262_144 }), nodeSha256Utf8))
      .toThrowError('invalid-source')
    expect(() => validatePersistedSource(source('短文本', { utf8Bytes: 262_145 }), nodeSha256Utf8))
      .toThrowError('invalid-source')
  })

  it.each([
    source('   \n'),
    source('前\0后'),
    source('坏\ud800'),
    source('坏\udc00'),
  ])('rejects blank, NUL, and unpaired surrogate persisted text %#', (value) => {
    expect(() => validatePersistedSource(value, nodeSha256Utf8)).toThrowError('invalid-source')
  })

  it('rejects byte metadata and final UTF-8 hash that do not match the exact text', () => {
    expect(() => validatePersistedSource(source('原文', { utf8Bytes: 1 }), nodeSha256Utf8))
      .toThrowError('invalid-source')
    expect(() => validatePersistedSource(source('原文', { contentHash: nodeSha256Utf8('别的文本') }), nodeSha256Utf8))
      .toThrowError('invalid-source')
  })
})
