import { describe, expect, it } from 'vitest'
import {
  PRODUCT_RPC_CHANNEL, PRODUCT_API_VERSION, PRODUCT_CAPABILITIES, PRODUCT_ERROR_CODES,
  PRODUCT_COMMAND_SCHEMA_KINDS, STAGE3A_COMMAND_KINDS, productEndpointRegistry,
  parseProductInput, parseProductOutcome, productOuterErrorSchema, safeProductOuterError,
} from '../../packages/workbench/src/protocol/product.js'
import { canonicalJson, canonicalEnvelopeUtf8Bytes } from '../../packages/workbench/src/protocol/canonical-json.js'
import { projectViewOf, markdownViewOf } from '../../packages/workbench/src/application/project-views.js'
import { makeSmallActiveRecord } from './helpers/synthetic-records.js'
import { prdRevisionIdSchema, baselineIdSchema, sourceRevisionIdSchema, sha256HexSchema } from '../../packages/workbench/src/domain/ids.js'

const ID = '00000000-0000-4000-8000-000000000001'
const OTHER = '00000000-0000-4000-8000-000000000002'
const common = { apiVersion: 'pmwb-product-v1', projectId: ID, commandId: ID, expectedVersion: 1 }
const flatInputs = [
  { ...common, kind: 'project.create', expectedVersion: 0, name: 'Synthetic project', researchGoal: null, syntheticDataAttested: true },
  { ...common, kind: 'project.delete' },
  { ...common, kind: 'source.importText', text: 'Synthetic material', displayName: 'synthetic.txt', format: 'text/plain', syntheticDataAttested: true },
  { ...common, kind: 'analysis.runFixture', sourceRevisionId: ID },
  { ...common, kind: 'requirement.update', requirementId: ID, priority: 'high' },
  { ...common, kind: 'requirements.reorder', requirementIds: [ID, OTHER] },
  { ...common, kind: 'baseline.publish', confirmedContentVersion: 1 },
  { ...common, kind: 'prd.render', baselineId: ID, confirmedContentVersion: 1 },
  { ...common, kind: 'analysis.runHarnessModel', sourceRevisionId: ID },
] as const
const inputs = flatInputs.map(({ apiVersion, projectId, commandId, expectedVersion, ...payload }) => ({ apiVersion, projectId, commandId, expectedVersion, payload }))
const accepted = (value: unknown) => ({ status: 'accepted', value })

function markdownOutcome(markdown: string) {
  return accepted(markdownViewOf({
    ...makeSmallActiveRecord(),
    prdRevisions: [{ id: prdRevisionIdSchema.parse(ID), projectId: makeSmallActiveRecord().header.id,
      sourceRevisionId: sourceRevisionIdSchema.parse(ID), baselineId: baselineIdSchema.parse(ID),
      baselineContentVersion: 0, rendererVersion: 'pmwb-prd-v1', contentHash: sha256HexSchema.parse('0'.repeat(64)),
      markdown, createdAt: '2026-09-07T00:00:00.000Z' }],
  }, prdRevisionIdSchema.parse(ID)))
}

describe('strict Product protocol', () => {
  it('exposes the six endpoints, nine schemas and eight executable commands in contract order', () => {
    expect(PRODUCT_RPC_CHANNEL).toBe('/dsh-pm-workbench-product-v1')
    expect(PRODUCT_API_VERSION).toBe('pmwb-product-v1')
    expect(Object.keys(productEndpointRegistry)).toEqual(['health', 'projects.list', 'projects.get', 'sources.get', 'artifacts.getMarkdown', 'projects.command'])
    expect(STAGE3A_COMMAND_KINDS).toEqual(inputs.slice(0, 8).map(input => input.payload.kind))
    expect(PRODUCT_COMMAND_SCHEMA_KINDS).toEqual(inputs.map(input => input.payload.kind))
    expect(PRODUCT_CAPABILITIES).toEqual({ wireSchemaVersion: '1', dataSchemaVersion: '1', analysisMode: 'hybrid', modelAnalysis: true, realDataAllowed: false, maxHostInflightRequests: 16, maxClientInflightRequests: 8 })
  })

  it.each(inputs)('validates the complete strict command payload', input => {
    expect(parseProductInput('projects.command', input)).toEqual(input)
    expect(() => parseProductInput('projects.command', { ...input, arbitraryPayload: {} })).toThrowError('invalid-request')
    for (const key of Object.keys(input)) {
      const missing = { ...input } as Record<string, unknown>
      delete missing[key]
      // Requirement updates are patches, but their one mutation must be present.
      expect(() => parseProductInput('projects.command', missing)).toThrowError('invalid-request')
    }
    for (const key of Object.keys(input.payload)) {
      const payload = { ...input.payload } as Record<string, unknown>
      delete payload[key]
      expect(() => parseProductInput('projects.command', { ...input, payload })).toThrowError('invalid-request')
    }
    expect(() => parseProductInput('projects.command', { ...input, payload: { ...input.payload, extra: true } })).toThrowError('invalid-request')
  })

  it('requires independent literal attestation for creation and material import', () => {
    for (const input of [inputs[0], inputs[2]]) {
      expect(() => parseProductInput('projects.command', { ...input, payload: { ...input.payload, syntheticDataAttested: false } })).toThrowError('invalid-request')
    }
    expect(() => parseProductInput('projects.command', { ...inputs[0], expectedVersion: 1 })).toThrowError('invalid-request')
  })

  it('rejects invalid versions, canonical IDs and unsafe numeric fields', () => {
    for (const overrides of [{ apiVersion: 'v2' }, { projectId: 'AAAAAAAA-0000-4000-8000-000000000001' }, { commandId: 'bad' }, { expectedVersion: -1 }, { expectedVersion: 1.5 }, { expectedVersion: Number.MAX_SAFE_INTEGER + 1 }, { expectedVersion: 0 }]) {
      expect(() => parseProductInput('projects.command', { ...inputs[1], ...overrides })).toThrowError('invalid-request')
    }
    expect(() => parseProductInput('projects.command', { ...inputs[7], payload: { ...inputs[7]!.payload, confirmedContentVersion: Number.MAX_SAFE_INTEGER + 1 } })).toThrowError('invalid-request')
    expect(() => parseProductInput('projects.command', { ...inputs[5], payload: { ...inputs[5]!.payload, requirementIds: [ID, ID] } })).toThrowError('invalid-request')
    expect(() => parseProductInput('projects.command', { ...inputs[5], payload: { ...inputs[5]!.payload, requirementIds: Array.from({ length: 25 }, (_, i) => ID.slice(0, -3) + i.toString().padStart(3, '0')) } })).toThrowError('invalid-request')
  })

  it('validates safe display names, complete text and strict requirement patches', () => {
    for (const displayName of ['/private/material.txt', '../material.txt', 'C:\\data.txt', 'blob:secret', 'bad\nname']) {
      expect(() => parseProductInput('projects.command', { ...inputs[2], payload: { ...inputs[2]!.payload, displayName } })).toThrowError('invalid-request')
    }
    for (const text of ['', ' \n ', 'bad\0text', '\ud800', 'x'.repeat(80_001)]) {
      expect(() => parseProductInput('projects.command', { ...inputs[2], payload: { ...inputs[2]!.payload, text } })).toThrowError('invalid-request')
    }
    const update = { ...inputs[4], payload: { ...inputs[4]!.payload, title: 'Human text', painPoint: 'Pain', description: 'Description', decision: 'include', humanReason: '', selectedText: { kind: 'generated', draftId: ID } } }
    expect(parseProductInput('projects.command', update)).toEqual(update)
    expect(() => parseProductInput('projects.command', { ...update, payload: { ...update.payload, selectedText: { ...update.payload.selectedText, extra: true } } })).toThrowError('invalid-request')
    expect(() => parseProductInput('projects.command', { ...update, payload: { ...update.payload, title: 'x'.repeat(2_001) } })).toThrowError('invalid-request')
  })

  it('requires strict read inputs and exact project/source/PRD correlation', () => {
    const simple = { apiVersion: PRODUCT_API_VERSION }
    expect(parseProductOutcome('health', accepted(PRODUCT_CAPABILITIES), simple)).toEqual(accepted(PRODUCT_CAPABILITIES))
    for (const endpoint of ['health', 'projects.list'] as const) {
      expect(parseProductInput(endpoint, simple)).toEqual(simple)
      expect(() => parseProductInput(endpoint, {})).toThrowError('invalid-request')
      expect(() => parseProductInput(endpoint, { ...simple, projectId: ID })).toThrowError('invalid-request')
    }
    const view = projectViewOf(makeSmallActiveRecord())
    expect(parseProductOutcome('projects.get', accepted(view), { ...simple, projectId: ID })).toEqual(accepted(view))
    expect(() => parseProductOutcome('projects.get', accepted(view), { ...simple, projectId: OTHER })).toThrowError('invalid-outcome')
    const source = { projectId: ID, sourceRevisionId: ID, revision: 1, displayName: 'synthetic.txt', format: 'pasted', syntheticDataAttested: true, text: '完整😀', utf8Bytes: 10, contentHash: 'a'.repeat(64) }
    const sourceInput = { ...simple, projectId: ID, sourceRevisionId: ID }
    expect(parseProductOutcome('sources.get', accepted(source), sourceInput)).toEqual(accepted(source))
    for (const overrides of [{ projectId: OTHER }, { sourceRevisionId: OTHER }, { contentHash: 'A'.repeat(64) }, { utf8Bytes: 9 }, { extra: 'secret' }]) {
      expect(() => parseProductOutcome('sources.get', accepted({ ...source, ...overrides }), sourceInput)).toThrowError('invalid-outcome')
    }
    const md = markdownOutcome('完整😀')
    expect(parseProductOutcome('artifacts.getMarkdown', md, { ...simple, projectId: ID, prdRevisionId: ID })).toEqual(md)
    for (const field of ['projectId', 'prdRevisionId']) {
      expect(() => parseProductOutcome('artifacts.getMarkdown', md, { ...simple, projectId: ID, prdRevisionId: ID, [field]: OTHER })).toThrowError('invalid-outcome')
    }
  })

  it('correlates command identity, version and kind-specific result fields', () => {
    const response = { ...accepted({ projectVersion: 2, contentVersion: 0 }), projectId: ID, commandId: ID }
    expect(parseProductOutcome('projects.command', response, inputs[4])).toEqual(response)
    for (const overrides of [{ projectId: OTHER }, { commandId: OTHER }, { value: { projectVersion: 3, contentVersion: 0 } }, { value: { projectVersion: Number.MAX_SAFE_INTEGER + 1, contentVersion: 0 } }]) {
      expect(() => parseProductOutcome('projects.command', { ...response, ...overrides }, inputs[4])).toThrowError('invalid-outcome')
    }
    const baseline = { ...response, value: { projectVersion: 2, contentVersion: 1, baselineId: ID } }
    expect(parseProductOutcome('projects.command', baseline, inputs[6])).toEqual(baseline)
    expect(() => parseProductOutcome('projects.command', response, inputs[6])).toThrowError('invalid-outcome')
    expect(() => parseProductOutcome('projects.command', { ...baseline, value: { ...baseline.value, contentVersion: 2 } }, inputs[6])).toThrowError('invalid-outcome')
    const modelAccepted = { ...response, value: { projectVersion: 2, contentVersion: 1, analysisRevisionId: ID } }
    expect(parseProductOutcome('projects.command', modelAccepted, inputs[8])).toEqual(modelAccepted)
    expect(() => parseProductOutcome('projects.command', response, inputs[8])).toThrowError('invalid-outcome')
    expect(() => parseProductOutcome('projects.command', { ...modelAccepted, commandId: OTHER }, inputs[8])).toThrowError('invalid-outcome')
  })


  it('correlates every accepted command result without permitting unrelated revision fields', () => {
    const values = [
      { projectVersion: 1, contentVersion: 0 },
      { projectVersion: 2 },
      { projectVersion: 2, contentVersion: 1, sourceRevisionId: ID },
      { projectVersion: 2, contentVersion: 1, analysisRevisionId: ID },
      { projectVersion: 2, contentVersion: 1 },
      { projectVersion: 2, contentVersion: 1 },
      { projectVersion: 2, contentVersion: 1, baselineId: ID },
      { projectVersion: 2, contentVersion: 1, baselineId: ID, prdRevisionId: ID },
      { projectVersion: 2, contentVersion: 1, analysisRevisionId: ID },
    ]
    values.forEach((value, index) => {
      const response = { status: 'accepted', projectId: ID, commandId: ID, value }
      expect(parseProductOutcome('projects.command', response, inputs[index])).toEqual(response)
      expect(() => parseProductOutcome('projects.command', { ...response, value: { ...value, unrelated: ID } }, inputs[index])).toThrowError('invalid-outcome')
    })
    const rendered = { status: 'accepted', projectId: ID, commandId: ID, value: { ...values[7], baselineId: OTHER } }
    expect(() => parseProductOutcome('projects.command', rendered, inputs[7])).toThrowError('invalid-outcome')
    expect(() => parseProductInput('projects.command', { ...inputs[4], payload: { ...inputs[4]!.payload, humanRevisionId: ID } })).toThrowError('invalid-request')
    expect(() => parseProductInput('projects.command', flatInputs[0])).toThrowError('invalid-request')
  })

  it('rejects schema-valid-shaped requests beyond the complete request budget without truncation', () => {
    const source = { ...inputs[2], payload: { ...inputs[2]!.payload, text: 'x'.repeat(786432) } }
    expect(() => parseProductInput('projects.command', source)).toThrowError('limit-exceeded')
    for (const endpoint of Object.keys(productEndpointRegistry) as (keyof typeof productEndpointRegistry)[]) {
      const extra = { apiVersion: PRODUCT_API_VERSION, text: 'x'.repeat(productEndpointRegistry[endpoint].maxRequestUtf8Bytes) }
      expect(() => parseProductInput(endpoint, extra)).toThrowError('limit-exceeded')
    }
    expect(() => parseProductOutcome('health', accepted({ ...PRODUCT_CAPABILITIES, realDataAllowed: true }))).toThrowError('invalid-outcome')
  })

  it('keeps all business and outer errors closed and does not echo thrown data', () => {
    expect(PRODUCT_ERROR_CODES).toEqual(['not-found', 'project-deleted', 'project-limit-reached', 'version-conflict', 'idempotency-key-reused', 'receipt-capacity-reached', 'limit-exceeded', 'synthetic-attestation-required', 'fixture-not-allowed', 'source-locked', 'analysis-already-reviewed', 'invalid-evidence', 'no-included-requirements', 'baseline-stale', 'stage-unavailable', 'cancelled', 'storage-failed'])
    for (const code of PRODUCT_ERROR_CODES) expect(parseProductOutcome('health', { status: 'rejected', error: { code } })).toEqual({ status: 'rejected', error: { code } })
    for (const error of [{ code: 'unknown' }, { code: 'storage-failed', message: 'secret quote/path' }]) expect(() => parseProductOutcome('health', { status: 'rejected', error })).toThrowError('invalid-outcome')
    const outer = safeProductOuterError(new Error('secret material /private/path stack'))
    expect(outer).toEqual({ code: 'internal-error', details: {} })
    expect(productOuterErrorSchema.safeParse({ ...outer, details: { input: 'secret' } }).success).toBe(false)
    expect(productOuterErrorSchema.safeParse({ code: 'unknown', details: {} }).success).toBe(false)
    expect(() => parseProductInput('health', { apiVersion: 'secret source quote' })).toThrowError(/^invalid-request$/)
  })

  it('measures complete canonical endpoint envelopes against each fixed budget', () => {
    expect(Object.values(productEndpointRegistry).map(item => [item.maxRequestUtf8Bytes, item.maxOutcomeUtf8Bytes])).toEqual([[4096, 16384], [4096, 131072], [4096, 1048576], [4096, 786432], [4096, 786432], [786432, 262144]])
    const tiny = markdownOutcome('x')
    const overhead = canonicalEnvelopeUtf8Bytes('artifacts.getMarkdown', 'outcome', tiny) - 1
    // The utf8Bytes number grows from one to six digits at this boundary.
    const contentBudget = 786432 - overhead - 5
    const escaped = '\u0001'.repeat(Math.floor(contentBudget / 6)) + 'x'.repeat(contentBudget % 6)
    const atLimit = markdownOutcome(escaped)
    expect(canonicalEnvelopeUtf8Bytes('artifacts.getMarkdown', 'outcome', atLimit)).toBe(786432)
    expect(parseProductOutcome('artifacts.getMarkdown', atLimit)).toEqual(atLimit)
    expect(() => parseProductOutcome('artifacts.getMarkdown', markdownOutcome(escaped + 'x'))).toThrowError('limit-exceeded')
  })

  it('rejects hidden properties, getters, unsafe numbers and excessive nesting before schema evaluation', () => {
    const value = Object.defineProperty({ apiVersion: PRODUCT_API_VERSION }, 'secret', { value: 'hidden' })
    expect(() => parseProductInput('health', value)).toThrowError('invalid-request')
    let calls = 0
    expect(() => parseProductInput('health', { get apiVersion() { calls++; throw new Error('private') } })).toThrowError('invalid-request')
    expect(calls).toBe(0)
    expect(() => canonicalJson(Number.MAX_SAFE_INTEGER + 1)).toThrowError('non-json-value')
    let deep: unknown = null
    for (let i = 0; i < 70; i++) deep = [deep]
    expect(() => canonicalJson(deep)).toThrowError('non-json-value')
  })
})
