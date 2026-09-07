import { describe, expect, it } from 'vitest'

import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { validateEvidence } from '../../packages/workbench/src/domain/evidence.js'
import {
  evidenceIdSchema,
  projectIdSchema,
  sourceRevisionIdSchema,
} from '../../packages/workbench/src/domain/ids.js'
import type { EvidenceExcerpt, SourceRevision } from '../../packages/workbench/src/domain/model.js'

const PROJECT_ID = projectIdSchema.parse('00000000-0000-4000-8000-000000000201')
const SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000201')
const OTHER_SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000202')
const EVIDENCE_ID = evidenceIdSchema.parse('30000000-0000-4000-8000-000000000201')

function makeSource(text: string): SourceRevision {
  return {
    id: SOURCE_ID,
    projectId: PROJECT_ID,
    revision: 1,
    displayName: '合成材料',
    format: 'pasted',
    text,
    utf8Bytes: new TextEncoder().encode(text).byteLength,
    contentHash: nodeSha256Utf8(text),
    syntheticDataAttested: true,
  }
}

function makeEvidence(source: SourceRevision, overrides: Partial<EvidenceExcerpt> = {}): EvidenceExcerpt {
  const quote = overrides.quote ?? source.text.slice(0, 1)
  return {
    id: EVIDENCE_ID,
    sourceRevisionId: SOURCE_ID,
    role: 'support',
    start: 0,
    end: 1,
    quote,
    quoteHash: nodeSha256Utf8(quote),
    ...overrides,
  }
}

describe('evidence validation', () => {
  const emojiSource = makeSource('A😀B')

  it.each([
    { start: -1, end: 1 },
    { start: 0.5, end: 1 },
    { start: 2, end: 2 },
    { start: 0, end: Number.NaN },
    { start: 0, end: Number.POSITIVE_INFINITY },
    { start: 0, end: Number.MAX_SAFE_INTEGER + 1 },
  ])('rejects unsafe evidence offsets %#', ({ start, end }) => {
    expect(() => validateEvidence(emojiSource, makeEvidence(emojiSource, { start, end }), nodeSha256Utf8))
      .toThrowError('invalid-evidence')
  })

  it.each([
    { start: 1, end: 2, quote: '\ud83d' },
    { start: 2, end: 3, quote: '\ude00' },
  ])('rejects a boundary that splits a surrogate pair %#', ({ start, end, quote }) => {
    expect(() => validateEvidence(emojiSource, makeEvidence(emojiSource, {
      start,
      end,
      quote,
      quoteHash: nodeSha256Utf8(quote),
    }), nodeSha256Utf8)).toThrowError('invalid-evidence')
  })

  it('accepts scalar-aligned UTF-16 half-open emoji offsets', () => {
    const evidence = makeEvidence(emojiSource, {
      start: 1,
      end: 3,
      quote: '😀',
      quoteHash: nodeSha256Utf8('😀'),
    })
    expect(validateEvidence(emojiSource, evidence, nodeSha256Utf8)).toBe(evidence)
  })

  it('rejects wrong source, quote slice, and lowercase quote hash', () => {
    expect(() => validateEvidence(emojiSource, makeEvidence(emojiSource, {
      sourceRevisionId: OTHER_SOURCE_ID,
    }), nodeSha256Utf8)).toThrowError('invalid-evidence')
    expect(() => validateEvidence(emojiSource, makeEvidence(emojiSource, {
      quote: 'B',
      quoteHash: nodeSha256Utf8('B'),
    }), nodeSha256Utf8)).toThrowError('invalid-evidence')
    expect(() => validateEvidence(emojiSource, makeEvidence(emojiSource, {
      quoteHash: nodeSha256Utf8('A').toUpperCase() as EvidenceExcerpt['quoteHash'],
    }), nodeSha256Utf8)).toThrowError('invalid-evidence')
    expect(() => validateEvidence(emojiSource, makeEvidence(emojiSource, {
      quoteHash: nodeSha256Utf8('B'),
    }), nodeSha256Utf8)).toThrowError('invalid-evidence')
  })

  it('accepts 4000 code points / 16000 UTF-8 bytes and rejects the next code point', () => {
    const exactText = '😀'.repeat(4_000)
    const exactSource = makeSource(exactText)
    expect(validateEvidence(exactSource, makeEvidence(exactSource, {
      end: exactText.length,
      quote: exactText,
      quoteHash: nodeSha256Utf8(exactText),
    }), nodeSha256Utf8).quote).toBe(exactText)

    const overText = `${exactText}x`
    const overSource = makeSource(overText)
    expect(() => validateEvidence(overSource, makeEvidence(overSource, {
      end: overText.length,
      quote: overText,
      quoteHash: nodeSha256Utf8(overText),
    }), nodeSha256Utf8)).toThrowError('invalid-evidence')
  })

  it('rejects quotes at and above the otherwise unreachable 16384-byte cap', () => {
    const exactByteText = '😀'.repeat(4_096)
    const exactByteSource = makeSource(exactByteText)
    expect(new TextEncoder().encode(exactByteText).byteLength).toBe(16_384)
    expect(() => validateEvidence(exactByteSource, makeEvidence(exactByteSource, {
      end: exactByteText.length,
      quote: exactByteText,
      quoteHash: nodeSha256Utf8(exactByteText),
    }), nodeSha256Utf8)).toThrowError('invalid-evidence')

    const overByteText = `${exactByteText}x`
    const overByteSource = makeSource(overByteText)
    expect(new TextEncoder().encode(overByteText).byteLength).toBe(16_385)
    expect(() => validateEvidence(overByteSource, makeEvidence(overByteSource, {
      end: overByteText.length,
      quote: overByteText,
      quoteHash: nodeSha256Utf8(overByteText),
    }), nodeSha256Utf8)).toThrowError('invalid-evidence')
  })
})
