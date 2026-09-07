import { describe, expect, it } from 'vitest'
import { projectSummaryOf, projectViewOf, sourceViewOf, markdownViewOf, projectViewSchema } from '../../packages/workbench/src/application/project-views.js'
import { parseProductOutcome } from '../../packages/workbench/src/protocol/product.js'
import { canonicalEnvelopeUtf8Bytes } from '../../packages/workbench/src/protocol/canonical-json.js'
import { storedProjectRecordSchema, type ActiveProjectRecord } from '../../packages/workbench/src/domain/model.js'
import { makeSmallActiveRecord } from './helpers/synthetic-records.js'
import * as ids from '../../packages/workbench/src/domain/ids.js'
import { utf8ByteLength } from '../../packages/workbench/src/domain/limits.js'

const uuid = (n: number) => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const sourceId = ids.sourceRevisionIdSchema.parse(uuid(100))
const analysisId = ids.analysisRevisionIdSchema.parse(uuid(101))
const hash = ids.sha256HexSchema.parse('0'.repeat(64))

function richProject(textSize = 20): ActiveProjectRecord {
  const initial = makeSmallActiveRecord()
  const text = '😀'.repeat(textSize)
  const prefix = 'Synthetic full source: '
  const sourceText = prefix + '😀'.repeat(Math.floor((80_000 - prefix.length) / 2))
  const drafts = Array.from({ length: 24 }, (_, i) => ({
    id: ids.generatedDraftIdSchema.parse(uuid(200 + i)), requirementId: ids.requirementIdSchema.parse(uuid(300 + i)),
    analysisRevisionId: analysisId, sourceRevisionId: sourceId, producer: 'fixture' as const,
    title: text, painPoint: text, description: text, rationale: text, suggestedPriority: 'medium' as const,
    evidenceIds: [], assumptions: [], unknowns: [],
  }))
  const revisions = drafts.map((draft, i) => ({ id: ids.requirementRevisionIdSchema.parse(uuid(400 + i)),
    requirementId: draft.requirementId, basedOnDraftId: draft.id, title: text, painPoint: text, description: text }))
  const baselines = Array.from({ length: 8 }, (_, i) => ({
    id: ids.baselineIdSchema.parse(uuid(500 + i)), projectId: initial.header.id, projectName: initial.header.name,
    researchGoal: null, sourceRevisionId: sourceId, sourceContentHash: hash, projectVersion: i + 3,
    contentVersion: i + 1, createdAt: initial.header.updatedAt,
    items: [{ rank: 1, requirementId: drafts[0]!.requirementId,
      textSource: { kind: 'generated' as const, draftId: drafts[0]!.id, producer: 'fixture' as const },
      title: 'Historical baseline title', painPoint: 'Historical baseline pain', description: 'Historical baseline description',
      priority: 'medium' as const, humanReason: '', evidence: [] }],
  }))
  return {
    ...initial,
    header: { ...initial.header, projectVersion: 10, contentVersion: 8, reviewStarted: true },
    source: { id: sourceId, projectId: initial.header.id, revision: 1, text: sourceText, utf8Bytes: utf8ByteLength(sourceText),
      contentHash: hash, displayName: 'synthetic.txt', format: 'pasted', syntheticDataAttested: true },
    analyses: [{ id: analysisId, sourceRevisionId: sourceId, kind: 'fixture', generation: 1, baseProjectVersion: 2, status: 'draft' }],
    currentAnalysisRevisionId: analysisId, generatedRequirements: drafts,
    humanRevisions: [{ ...revisions[0]!, id: ids.requirementRevisionIdSchema.parse(uuid(999)), title: 'Unselected historical revision' }, ...revisions],
    humanDecisions: drafts.map((draft, i) => ({ requirementId: draft.requirementId,
      selectedText: { kind: 'human-revision', revisionId: revisions[i]!.id }, priority: 'medium', decision: 'pending', humanReason: text })),
    requirementOrder: drafts.map(draft => draft.requirementId), baselines, currentBaselineId: baselines[7]!.id,
    prdRevisions: baselines.map((baseline, i) => ({ id: ids.prdRevisionIdSchema.parse(uuid(600 + i)),
      projectId: initial.header.id, sourceRevisionId: sourceId, baselineId: baseline.id,
      baselineContentVersion: baseline.contentVersion, rendererVersion: 'pmwb-prd-v1', contentHash: hash,
      markdown: 'Synthetic complete Markdown ' + 'x'.repeat(262_116), createdAt: initial.header.updatedAt })),
  }
}

describe('bounded project projections', () => {
  it('projects empty projects and summaries without inventing source or analysis', () => {
    const project = makeSmallActiveRecord()
    expect(projectSummaryOf(project)).toEqual(project.header)
    expect(projectViewOf(project)).toEqual({ header: project.header, source: null, analysis: null,
      generatedRequirements: [], selectedHumanRevisions: [], humanDecisions: [], requirementOrder: [],
      evidence: [], currentBaseline: null, prdSummaries: [] })
  })

  it('keeps complete source, Markdown, historical baseline items and unselected human revisions out of ProjectView', () => {
    const project = richProject()
    expect(storedProjectRecordSchema.safeParse(project).success).toBe(true)
    const view = projectViewOf(project)
    const serialized = JSON.stringify(view)
    for (const secret of [project.source!.text, project.prdRevisions[0]!.markdown,
      'Historical baseline description', 'Unselected historical revision']) expect(serialized).not.toContain(secret)
    expect(view.selectedHumanRevisions).toHaveLength(24)
    expect(view.prdSummaries).toHaveLength(8)
    expect(view.prdSummaries.map(prd => prd.status)).toEqual(['stale', 'stale', 'stale', 'stale', 'stale', 'stale', 'stale', 'current'])
    expect(view.currentBaseline).toMatchObject({ id: project.currentBaselineId, itemCount: 1, contentVersion: 8 })
    expect(view.header).not.toBe(project.header)
    expect(view.generatedRequirements[0]).not.toBe(project.generatedRequirements[0])
    expect(Object.isFrozen(view.generatedRequirements[0])).toBe(true)
    expect(projectViewSchema.safeParse({ ...view, source: { ...view.source, text: 'leak' } }).success).toBe(false)
    expect(projectViewSchema.safeParse({ ...view, prdSummaries: [...view.prdSummaries, view.prdSummaries[0]] }).success).toBe(false)
  })

  it('returns complete bounded source and selected Markdown with identities, byte witnesses and hashes', () => {
    const project = richProject()
    const source = sourceViewOf(project, sourceId)
    expect(source).toMatchObject({ sourceRevisionId: sourceId, projectId: project.header.id,
      text: project.source!.text, utf8Bytes: utf8ByteLength(project.source!.text), contentHash: hash })
    const prd = project.prdRevisions[0]!
    const markdown = markdownViewOf(project, prd.id)
    expect(markdown).toMatchObject({ prdRevisionId: prd.id, projectId: project.header.id,
      markdown: prd.markdown, utf8Bytes: utf8ByteLength(prd.markdown), contentHash: hash })
    expect(parseProductOutcome('sources.get', { status: 'accepted', value: source })).toMatchObject({ status: 'accepted' })
    expect(parseProductOutcome('artifacts.getMarkdown', { status: 'accepted', value: markdown })).toMatchObject({ status: 'accepted' })
    expect(() => sourceViewOf(project, ids.sourceRevisionIdSchema.parse(uuid(999)))).toThrowError('not-found')
    expect(() => markdownViewOf(project, ids.prdRevisionIdSchema.parse(uuid(999)))).toThrowError('not-found')
  })

  it('retains eight PRDs while bounding the largest readable current projection without truncation', () => {
    let low = 1
    let high = 2000
    while (low < high) {
      const middle = Math.ceil((low + high) / 2)
      const view = projectViewOf(richProject(middle))
      if (canonicalEnvelopeUtf8Bytes('projects.get', 'outcome', { status: 'accepted', value: view }) <= 1048576) low = middle
      else high = middle - 1
    }
    const project = richProject(low)
    expect(storedProjectRecordSchema.safeParse(project).success).toBe(true)
    const outcome = { status: 'accepted', value: projectViewOf(project) }
    expect(canonicalEnvelopeUtf8Bytes('projects.get', 'outcome', outcome)).toBeGreaterThan(1048576 - 1000)
    expect(parseProductOutcome('projects.get', outcome)).toEqual(outcome)
    const oversized = { status: 'accepted', value: projectViewOf(richProject(low + 1)) }
    expect(projectViewSchema.safeParse(oversized.value).success).toBe(true)
    expect(() => parseProductOutcome('projects.get', oversized)).toThrowError('limit-exceeded')
  })

  it('filters superseded analysis and evidence while rejecting duplicate current projection identities', () => {
    const project = richProject()
    const view = projectViewOf({ ...project, currentAnalysisRevisionId: null, humanDecisions: [], requirementOrder: [] })
    expect(view.generatedRequirements).toEqual([])
    expect(view.selectedHumanRevisions).toEqual([])
    const valid = projectViewOf(project)
    expect(projectViewSchema.safeParse({ ...valid, requirementOrder: [valid.requirementOrder[0], valid.requirementOrder[0]] }).success).toBe(false)
    expect(projectViewSchema.safeParse({ ...valid, header: { ...valid.header, syntheticDataAttested: true } }).success).toBe(false)
  })
})
