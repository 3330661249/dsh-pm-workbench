import { describe, expect, it, vi } from 'vitest'
import { ProjectService } from '../../packages/workbench/src/application/project-service.js'
import { TableProjectRepository, assertProjectReadable } from '../../packages/workbench/src/application/project-repository.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { projectViewOf } from '../../packages/workbench/src/application/project-views.js'
import { FixtureInsightEngine } from '../../packages/workbench/src/analysis/fixture-engine.js'
import { FIXTURE_MANIFEST } from '../../packages/workbench/src/analysis/fixture-manifest.js'
import * as ids from '../../packages/workbench/src/domain/ids.js'
import { utf8ByteLength } from '../../packages/workbench/src/domain/limits.js'
import { storedProjectRecordSchema, type ActiveProjectRecord, type StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import { type PrdRenderer } from '../../packages/workbench/src/domain/prd.js'
import { canonicalEnvelopeUtf8Bytes, canonicalJsonUtf8Bytes } from '../../packages/workbench/src/protocol/canonical-json.js'
import { parseProductInput, parseProductOutcome } from '../../packages/workbench/src/protocol/product.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import { makeSmallActiveRecord, SMALL_PROJECT_ID } from './helpers/synthetic-records.js'

const uuid = (n: number) => `30000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const at = '2026-09-07T08:00:00.000Z'
function richProject(size: number): ActiveProjectRecord {
  const initial = makeSmallActiveRecord()
  const sourceId = ids.sourceRevisionIdSchema.parse(uuid(1))
  const analysisId = ids.analysisRevisionIdSchema.parse(uuid(2))
  const sourceText = '中'.repeat(79_968) + 'x'.repeat(32)
  const text = '😀'.repeat(size)
  const exact8192 = [...Array.from({ length: 16 }, (_, i) => `${String(i).padStart(2, '0')}${'a'.repeat(498)}`), 'b'.repeat(192)]
  const evidence = Array.from({ length: 96 }, (_, i) => {
    const quote = '中'.repeat(455) + (i === 95 ? 'x'.repeat(32) : '')
    const start = i === 95 ? 79_968 - 455 : 0
    return { id: ids.evidenceIdSchema.parse(uuid(100 + i)), sourceRevisionId: sourceId,
      role: 'support' as const, start, end: start + quote.length, quote, quoteHash: nodeSha256Utf8(quote) }
  })
  const drafts = Array.from({ length: 24 }, (_, i) => ({
    id: ids.generatedDraftIdSchema.parse(uuid(200 + i)), requirementId: ids.requirementIdSchema.parse(uuid(300 + i)),
    analysisRevisionId: analysisId, sourceRevisionId: sourceId, producer: 'fixture' as const,
    title: text, painPoint: text, description: text, rationale: text, suggestedPriority: 'medium' as const,
    evidenceIds: evidence.slice(i * 4, i * 4 + 4).map(item => item.id),
    assumptions: i < 4 ? exact8192 : [], unknowns: i < 4 ? exact8192 : [],
  }))
  const revisions = drafts.map((draft, i) => ({ id: ids.requirementRevisionIdSchema.parse(uuid(400 + i)), requirementId: draft.requirementId,
    basedOnDraftId: draft.id, title: text, painPoint: text, description: text }))
  const historical = drafts.map((draft, i) => ({ id: ids.requirementRevisionIdSchema.parse(uuid(700 + i)), requirementId: draft.requirementId,
    basedOnDraftId: draft.id, title: '历史人工标题', painPoint: '历史人工痛点', description: '历史人工描述' }))
  const baselines = Array.from({ length: 8 }, (_, i) => ({
    id: ids.baselineIdSchema.parse(uuid(500 + i)), projectId: SMALL_PROJECT_ID,
    projectName: initial.header.name, researchGoal: null, sourceRevisionId: sourceId,
    sourceContentHash: nodeSha256Utf8(sourceText), projectVersion: 20 + i, contentVersion: 10 + i, createdAt: at,
    items: drafts.map((draft, index) => ({ rank: index + 1, requirementId: draft.requirementId,
      textSource: { kind: 'human-revision' as const, draftId: draft.id, revisionId: historical[index]!.id },
      title: historical[index]!.title, painPoint: historical[index]!.painPoint, description: historical[index]!.description,
      priority: 'medium' as const, humanReason: '历史人工理由', evidence: [evidence[index * 4]!] })),
  }))
  const markdown = 'x'.repeat(262_144)
  return {
    ...initial, header: { ...initial.header, projectVersion: 100, contentVersion: 90, reviewStarted: true, updatedAt: at },
    source: { id: sourceId, projectId: SMALL_PROJECT_ID, revision: 1, text: sourceText, utf8Bytes: utf8ByteLength(sourceText),
      contentHash: nodeSha256Utf8(sourceText), displayName: '😀'.repeat(2000), format: 'pasted', syntheticDataAttested: true },
    analyses: [{ id: analysisId, sourceRevisionId: sourceId, generation: 1, baseProjectVersion: 2, kind: 'fixture', status: 'draft' }],
    currentAnalysisRevisionId: analysisId, evidence, generatedRequirements: drafts, humanRevisions: [...historical, ...revisions],
    humanDecisions: drafts.map((draft, i) => ({ requirementId: draft.requirementId,
      selectedText: { kind: 'human-revision', revisionId: revisions[i]!.id }, priority: 'medium', decision: 'include', humanReason: text })),
    requirementOrder: drafts.map(draft => draft.requirementId), baselines, currentBaselineId: baselines[7]!.id,
    prdRevisions: baselines.map((baseline, i) => ({ id: ids.prdRevisionIdSchema.parse(uuid(600 + i)),
      projectId: SMALL_PROJECT_ID, sourceRevisionId: sourceId, baselineId: baseline.id, baselineContentVersion: baseline.contentVersion,
      rendererVersion: 'pmwb-prd-v1', markdown, contentHash: nodeSha256Utf8(markdown), createdAt: at })),
  }
}
function setup(record: ActiveProjectRecord, renderer?: PrdRenderer) {
  const table = createFakeDomainTable<ids.ProjectId, StoredProjectRecord>([[SMALL_PROJECT_ID, record]])
  let ordinal = 10000
  const service = new ProjectService(new TableProjectRepository(table, { clock: { now: () => at }, newId: () => uuid(ordinal++),
    sha256Utf8: nodeSha256Utf8, engine: new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8), ...(renderer ? { renderer } : {}) }))
  return { service, table }
}
let largest: ActiveProjectRecord | undefined
function largestReadable(): ActiveProjectRecord {
  if (largest) return largest
  let low = 1; let high = 2000
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const outcome = { status: 'accepted', value: projectViewOf(richProject(middle)) }
    if (canonicalEnvelopeUtf8Bytes('projects.get', 'outcome', outcome) <= 1_048_576) low = middle
    else high = middle - 1
  }
  const candidate = richProject(low)
  const remainder = 1_048_576 - canonicalEnvelopeUtf8Bytes('projects.get', 'outcome', { status: 'accepted', value: projectViewOf(candidate) })
  largest = { ...candidate, humanRevisions: candidate.humanRevisions.map((revision, i) =>
    i === 24 ? { ...revision, description: revision.description + 'x'.repeat(remainder) } : revision) }
  return largest
}

describe('durable write implies complete readable projections', () => {
  it('reads the maximum current envelope with 24 requirements, 96 evidence, maximum aggregates, eight deep baselines and eight maximum PRDs', async () => {
    const record = largestReadable()
    expect(record.source!.text).toHaveLength(80_000)
    expect(record.evidence.reduce((sum, item) => sum + utf8ByteLength(item.quote), 0)).toBe(131_072)
    expect(record.generatedRequirements.reduce((sum, draft) => sum + [...draft.assumptions, ...draft.unknowns].reduce((n, value) => n + utf8ByteLength(value), 0), 0)).toBe(65_536)
    expect(record.baselines).toHaveLength(8)
    expect(record.baselines.every(baseline => baseline.items.length === 24)).toBe(true)
    expect(record.prdRevisions.every(prd => utf8ByteLength(prd.markdown) === 262_144)).toBe(true)
    expect(storedProjectRecordSchema.safeParse(record).success).toBe(true)
    expect(canonicalJsonUtf8Bytes(record)).toBeLessThanOrEqual(4_194_304)
    expect(() => assertProjectReadable(record)).not.toThrow()
    const { service } = setup(record)
    const input = { apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID }
    const project = await service.get(input)
    expect(canonicalEnvelopeUtf8Bytes('projects.get', 'outcome', project)).toBe(1_048_576)
    expect(parseProductOutcome('projects.get', project, input)).toEqual(project)
    const sourceInput = { ...input, sourceRevisionId: record.source!.id }
    expect(parseProductOutcome('sources.get', await service.getSource(sourceInput), sourceInput).status).toBe('accepted')
    for (const prd of record.prdRevisions) {
      const prdInput = { ...input, prdRevisionId: prd.id }
      const outcome = await service.getMarkdown(prdInput)
      expect(parseProductOutcome('artifacts.getMarkdown', outcome, prdInput).status).toBe('accepted')
      expect(canonicalEnvelopeUtf8Bytes('artifacts.getMarkdown', 'outcome', outcome)).toBeLessThanOrEqual(786_432)
    }
  }, 20000)

  it('rejects the first one-byte current-view overflow before table.update without a receipt or truncation', async () => {
    const record = largestReadable()
    const { service, table } = setup(record)
    const update = vi.spyOn(table, 'update')
    const input = parseProductInput('projects.command', { apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID,
      commandId: uuid(900), expectedVersion: 100, payload: { kind: 'requirement.update', requirementId: record.requirementOrder[0], title: record.generatedRequirements[0]!.title + 'x' } })
    const before = JSON.stringify(table.get(SMALL_PROJECT_ID))
    expect(await service.command(input)).toMatchObject({ status: 'rejected', error: { code: 'limit-exceeded' } })
    expect(table.writeCount).toBe(0)
    expect(update).not.toHaveBeenCalled()
    expect(JSON.stringify(table.get(SMALL_PROJECT_ID))).toBe(before)
  }, 20000)

  it('rejects schema-valid Markdown whose canonical outcome escapes exceed the future read budget', async () => {
    const full = richProject(1)
    const baseline = { ...full.baselines[0]!, contentVersion: 90 }
    const record = { ...full, baselines: [baseline], currentBaselineId: baseline.id, prdRevisions: [] }
    const markdown = '\u0001'.repeat(140_000)
    const renderer: PrdRenderer = { render: input => ({ id: input.prdRevisionId, projectId: SMALL_PROJECT_ID,
      sourceRevisionId: baseline.sourceRevisionId, baselineId: baseline.id, baselineContentVersion: 90,
      rendererVersion: 'pmwb-prd-v1', markdown, contentHash: nodeSha256Utf8(markdown), createdAt: at }) }
    const { service, table } = setup(record, renderer)
    const input = { apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID, commandId: uuid(900), expectedVersion: 100,
      payload: { kind: 'prd.render', baselineId: baseline.id, confirmedContentVersion: 90 } }
    expect(await service.command(input)).toMatchObject({ status: 'rejected', error: { code: 'limit-exceeded' } })
    expect(table.writeCount).toBe(0)
    expect(table.get(SMALL_PROJECT_ID)).toEqual(record)
  })

  it('rejects aggregate source/baseline/PRD ownership and duplicate identities that isolated record schemas permit', () => {
    const record = richProject(1)
    const bad = [
      { ...record, baselines: record.baselines.map((baseline, i) => i === 0 ? { ...baseline, projectId: ids.projectIdSchema.parse(uuid(999)) } : baseline) },
      { ...record, prdRevisions: record.prdRevisions.map((prd, i) => i === 0 ? { ...prd, baselineContentVersion: 99 } : prd) },
      { ...record, prdRevisions: [record.prdRevisions[0]!, record.prdRevisions[0]!] },
      { ...record, baselines: [record.baselines[0]!, record.baselines[0]!] },
      { ...record, currentBaselineId: ids.baselineIdSchema.parse(uuid(999)) },
    ]
    for (const candidate of bad) expect(() => assertProjectReadable(candidate)).toThrow()
  })

  it('refuses a receipt that would cross the exact 4-MiB record boundary while preserving deletion', async () => {
    let record = richProject(1)
    let ordinal = 1000
    for (;;) {
      const revision = { id: ids.requirementRevisionIdSchema.parse(uuid(ordinal++)), requirementId: record.requirementOrder[0]!,
        basedOnDraftId: record.generatedRequirements[0]!.id, title: 'x'.repeat(2000), painPoint: 'x'.repeat(2000), description: 'x'.repeat(2000) }
      const next = { ...record, humanRevisions: [...record.humanRevisions, revision] }
      if (canonicalJsonUtf8Bytes(next) > 4_194_304) break
      record = next
    }
    let remainder = 4_194_304 - canonicalJsonUtf8Bytes(record)
    // Preserve code-point count while independently adding exact UTF-8 bytes to unselected history.
    const expand = () => {
      const extra = Math.min(6000, remainder)
      remainder -= extra
      const emojiCount = Math.floor(extra / 3)
      const tail = extra % 3 === 1 ? 'é' : extra % 3 === 2 ? '中' : ''
      return '😀'.repeat(emojiCount) + tail + 'x'.repeat(2000 - emojiCount - (tail ? 1 : 0))
    }
    const last = record.humanRevisions.at(-1)!
    record = { ...record, humanRevisions: [...record.humanRevisions.slice(0, -1), { ...last, title: expand(), painPoint: expand(), description: expand() }] }
    expect(remainder).toBe(0)
    expect(canonicalJsonUtf8Bytes(record)).toBe(4_194_304)
    expect(() => assertProjectReadable(record)).not.toThrow()
    const { service, table } = setup(record)
    const command = { apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID, commandId: uuid(9000), expectedVersion: 100,
      payload: { kind: 'analysis.runHarnessModel', sourceRevisionId: record.source!.id } }
    expect(await service.command(command)).toMatchObject({ status: 'rejected', error: { code: 'limit-exceeded' } })
    expect(table.writeCount).toBe(0)
    expect(await service.command({ ...command, commandId: uuid(9001), payload: { kind: 'project.delete' } })).toMatchObject({ status: 'accepted', value: { projectVersion: 101 } })
    expect(table.writeCount).toBe(1)
    expect(table.get(SMALL_PROJECT_ID)?.kind).toBe('deleted')
    expect(canonicalJsonUtf8Bytes(table.get(SMALL_PROJECT_ID))).toBeLessThanOrEqual(2048)
  }, 20000)
})
