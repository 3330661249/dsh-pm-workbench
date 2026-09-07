import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import {
  MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES,
  MAX_PROJECT_NAME_CODE_POINTS,
  MAX_PROJECT_NAME_UTF8_BYTES,
  MAX_RESEARCH_GOAL_CODE_POINTS,
  MAX_RESEARCH_GOAL_UTF8_BYTES,
  MAX_TOMBSTONE_UTF8_BYTES,
  utf8ByteLength,
} from '../../packages/workbench/src/domain/limits.js'
import {
  assertStoredRecordBudget,
  storedProjectRecordSchema,
} from '../../packages/workbench/src/domain/model.js'
import {
  canonicalJson,
  canonicalJsonUtf8Bytes,
} from '../../packages/workbench/src/protocol/canonical-json.js'
import {
  makeNearLimitActiveRecord,
  makeOverLimitActiveRecord,
  makeSmallActiveRecord,
  makeTombstone,
} from './helpers/synthetic-records.js'

function compileOnlyParsedRecordReadonlyGuards(): void {
  const parsed = storedProjectRecordSchema.parse(makeSmallActiveRecord())
  if (parsed.kind !== 'active') return
  // @ts-expect-error Parsed stored records expose readonly properties.
  parsed.source = null
  // @ts-expect-error Parsed stored record arrays do not expose mutating methods.
  parsed.analyses.splice(0)
  // @ts-expect-error Nested parsed record properties are readonly.
  parsed.header.name = 'changed'
}

void compileOnlyParsedRecordReadonlyGuards

describe('stored project record boundary', () => {
  it('accepts a schema-valid synthetic active record', () => {
    expect(storedProjectRecordSchema.parse(makeSmallActiveRecord()).kind).toBe('active')
  })

  it('uses strict discriminants and rejects extra fields at every persisted boundary', () => {
    const active = makeSmallActiveRecord()
    expect(storedProjectRecordSchema.safeParse({ ...active, kind: 'unknown' }).success).toBe(false)
    expect(storedProjectRecordSchema.safeParse({ ...active, extra: true }).success).toBe(false)
    expect(storedProjectRecordSchema.safeParse({
      ...active,
      header: { ...active.header, extra: true },
    }).success).toBe(false)
    expect(storedProjectRecordSchema.safeParse({ ...makeTombstone(), extra: true }).success).toBe(false)
  })

  it('rejects non-canonical UUIDs, hashes, and calendar dates', () => {
    const active = makeSmallActiveRecord()
    expect(storedProjectRecordSchema.safeParse({
      ...active,
      header: { ...active.header, id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' },
    }).success).toBe(false)
    expect(storedProjectRecordSchema.safeParse({
      ...active,
      header: { ...active.header, updatedAt: '2026-02-30T00:00:00.000Z' },
    }).success).toBe(false)
    expect(storedProjectRecordSchema.safeParse({
      ...makeTombstone(),
      deleteRequestHash: 'A'.repeat(64),
    }).success).toBe(false)
  })

  it('enforces project-name code-point and UTF-8 limits without truncation', () => {
    expect(MAX_PROJECT_NAME_CODE_POINTS).toBe(120)
    expect(MAX_PROJECT_NAME_UTF8_BYTES).toBe(512)
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ name: '名'.repeat(120) })).success).toBe(true)
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ name: '名'.repeat(121) })).success).toBe(false)
    expect(utf8ByteLength('😀'.repeat(128))).toBe(512)
    expect(utf8ByteLength('😀'.repeat(129))).toBe(516)
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ name: '😀'.repeat(128) })).success).toBe(false)
  })

  it('accepts a null research goal and enforces its code-point and UTF-8 limits', () => {
    expect(MAX_RESEARCH_GOAL_CODE_POINTS).toBe(500)
    expect(MAX_RESEARCH_GOAL_UTF8_BYTES).toBe(2_048)
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ researchGoal: null })).success).toBe(true)
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ researchGoal: '研'.repeat(500) })).success).toBe(true)
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ researchGoal: '研'.repeat(501) })).success).toBe(false)
    expect(utf8ByteLength('😀'.repeat(512))).toBe(2_048)
    expect(utf8ByteLength('😀'.repeat(513))).toBe(2_052)
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ researchGoal: '😀'.repeat(512) })).success).toBe(false)
  })

  it('rejects unpaired surrogates in persisted strings', () => {
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ name: 'invalid\ud800' })).success).toBe(false)
    expect(storedProjectRecordSchema.safeParse(makeSmallActiveRecord({ researchGoal: 'invalid\udc00' })).success).toBe(false)
  })

  it('replaces an active record with a body-free tombstone shape', () => {
    const tombstone = makeTombstone()
    expect(storedProjectRecordSchema.parse(tombstone)).toEqual(tombstone)
    expect(Object.keys(tombstone)).toEqual([
      'kind',
      'schemaVersion',
      'projectId',
      'deletedAt',
      'deleteCommandId',
      'deleteRequestHash',
      'deleteOutcome',
    ])
    expect(JSON.stringify(tombstone)).not.toMatch(/project name|source|evidence|markdown/i)
    expect(canonicalJsonUtf8Bytes(tombstone)).toBeLessThanOrEqual(MAX_TOMBSTONE_UTF8_BYTES)
    expect(() => assertStoredRecordBudget({
      ...tombstone,
      padding: 'x'.repeat(MAX_TOMBSTONE_UTF8_BYTES),
    })).toThrowError('limit-exceeded')
  })

  it('accepts the generated record within 4096 bytes of 4194304 and rejects the next byte budget', () => {
    const near = makeNearLimitActiveRecord()
    const nearBytes = canonicalJsonUtf8Bytes(near)
    expect(storedProjectRecordSchema.parse(near)).toEqual(near)
    expect(nearBytes).toBeGreaterThanOrEqual(MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES - 4_096)
    expect(nearBytes).toBeLessThanOrEqual(MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES)
    expect(() => assertStoredRecordBudget(makeOverLimitActiveRecord())).toThrowError('limit-exceeded')
  })
})

describe('canonical JSON', () => {
  it('sorts object keys recursively while preserving array order', () => {
    expect(canonicalJson({ z: 1, a: { d: 4, b: 2 }, items: ['b', 'a'] })).toBe(
      '{"a":{"b":2,"d":4},"items":["b","a"],"z":1}',
    )
  })

  it.each([
    undefined,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    1n,
    Symbol('not-json'),
    () => undefined,
    new Date('2026-09-07T00:00:00.000Z'),
    { value: undefined },
    ['valid', undefined],
  ])('rejects non-JSON value %#', (value) => {
    expect(() => canonicalJson(value)).toThrowError('non-json-value')
  })

  it('rejects unpaired surrogates in keys and values', () => {
    expect(() => canonicalJson('\ud800')).toThrowError('unpaired-surrogate')
    expect(() => canonicalJson({ ['bad\udc00']: 'value' })).toThrowError('unpaired-surrogate')
  })

  it('rejects arrays with symbol values, symbol properties, or extra string properties', () => {
    const symbolProperty = ['value']
    Object.defineProperty(symbolProperty, Symbol('metadata'), { value: 'distinct' })
    const extraProperty = ['value']
    Object.defineProperty(extraProperty, 'metadata', { enumerable: true, value: 'distinct' })

    expect(() => canonicalJson([Symbol('value')])).toThrowError('non-json-value')
    expect(() => canonicalJson(symbolProperty)).toThrowError('non-json-value')
    expect(() => canonicalJson(extraProperty)).toThrowError('non-json-value')
  })

  it('rejects indexed array accessors without invoking their getters', () => {
    let getterCalls = 0
    const accessor = new Array<unknown>(1)
    Object.defineProperty(accessor, '0', {
      enumerable: true,
      get: () => {
        getterCalls += 1
        return 'value'
      },
    })

    expect(() => canonicalJson(accessor)).toThrowError('non-json-value')
    expect(getterCalls).toBe(0)
  })

  it('rejects array subclasses, sparse arrays, and cyclic arrays', () => {
    class ArraySubclass extends Array<unknown> {}
    const subclass = new ArraySubclass()
    subclass.push('value')
    const sparse = new Array<unknown>(1)
    const cyclic: unknown[] = []
    cyclic.push(cyclic)

    expect(() => canonicalJson(subclass)).toThrowError('non-json-value')
    expect(() => canonicalJson(sparse)).toThrowError('non-json-value')
    expect(() => canonicalJson(cyclic)).toThrowError('non-json-value')
  })

  it('measures canonical UTF-8 bytes and provides Host-only SHA-256', () => {
    expect(canonicalJsonUtf8Bytes({ value: '名' })).toBe(new TextEncoder().encode('{"value":"名"}').byteLength)
    expect(nodeSha256Utf8('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('keeps the canonical serializer browser-safe and isolates the Node hash import', async () => {
    const root = path.resolve(import.meta.dirname, '../../packages/workbench/src')
    const canonicalSource = await readFile(path.join(root, 'protocol/canonical-json.ts'), 'utf8')
    const nodeHashSource = await readFile(path.join(root, 'application/node-sha256.ts'), 'utf8')
    expect(canonicalSource).not.toMatch(/\bBuffer\b|node:crypto|crypto\.subtle|\bwindow\b|\bprocess\b/)
    expect(nodeHashSource).toContain("from 'node:crypto'")
  })
})
