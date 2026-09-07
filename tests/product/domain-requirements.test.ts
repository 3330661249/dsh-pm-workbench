import { describe, expect, it } from 'vitest'

import {
  analysisRevisionIdSchema,
  evidenceIdSchema,
  generatedDraftIdSchema,
  projectIdSchema,
  requirementIdSchema,
  requirementRevisionIdSchema,
  sha256HexSchema,
  sourceRevisionIdSchema,
} from '../../packages/workbench/src/domain/ids.js'
import {
  MAX_HUMAN_REASON_CODE_POINTS,
  MAX_HUMAN_REASON_UTF8_BYTES,
} from '../../packages/workbench/src/domain/limits.js'
import type { ActiveProjectRecord } from '../../packages/workbench/src/domain/model.js'
import {
  applyRequirementOrder,
  applyRequirementUpdate,
} from '../../packages/workbench/src/domain/requirements.js'

const PROJECT_ID = projectIdSchema.parse('00000000-0000-4000-8000-000000000501')
const SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000501')
const ANALYSIS_ID = analysisRevisionIdSchema.parse('20000000-0000-4000-8000-000000000501')
const REQUIREMENT_A = requirementIdSchema.parse('40000000-0000-4000-8000-000000000501')
const REQUIREMENT_B = requirementIdSchema.parse('40000000-0000-4000-8000-000000000502')
const DRAFT_A = generatedDraftIdSchema.parse('50000000-0000-4000-8000-000000000501')
const DRAFT_B = generatedDraftIdSchema.parse('50000000-0000-4000-8000-000000000502')
const REVISION_A = requirementRevisionIdSchema.parse('60000000-0000-4000-8000-000000000501')
const EVIDENCE_A = evidenceIdSchema.parse('30000000-0000-4000-8000-000000000501')
const HASH = sha256HexSchema.parse('0'.repeat(64))

function reviewableProject(): ActiveProjectRecord {
  return {
    kind: 'active', schemaVersion: 1,
    header: {
      id: PROJECT_ID, name: '审阅项目', researchGoal: null, projectVersion: 3,
      contentVersion: 2, reviewStarted: false, updatedAt: '2026-09-07T00:00:00.000Z',
    },
    source: {
      id: SOURCE_ID, projectId: PROJECT_ID, revision: 1, displayName: '合成访谈.txt',
      format: 'text/plain', text: '支持证据', utf8Bytes: 12, contentHash: HASH,
      syntheticDataAttested: true,
    },
    analyses: [{
      id: ANALYSIS_ID, sourceRevisionId: SOURCE_ID, kind: 'fixture', generation: 1,
      baseProjectVersion: 2, status: 'draft',
    }],
    currentAnalysisRevisionId: ANALYSIS_ID,
    evidence: [{
      id: EVIDENCE_A, sourceRevisionId: SOURCE_ID, role: 'support', start: 0, end: 4,
      quote: '支持证据', quoteHash: HASH,
    }],
    generatedRequirements: [
      {
        id: DRAFT_A, requirementId: REQUIREMENT_A, analysisRevisionId: ANALYSIS_ID,
        sourceRevisionId: SOURCE_ID, producer: 'fixture', title: '生成标题 A', painPoint: '生成痛点 A',
        description: '生成描述 A', evidenceIds: [EVIDENCE_A], rationale: '不可覆盖的生成理由 A',
        assumptions: [], unknowns: [], suggestedPriority: 'high',
      },
      {
        id: DRAFT_B, requirementId: REQUIREMENT_B, analysisRevisionId: ANALYSIS_ID,
        sourceRevisionId: SOURCE_ID, producer: 'fixture', title: '生成标题 B', painPoint: '生成痛点 B',
        description: '生成描述 B', evidenceIds: [EVIDENCE_A], rationale: '不可覆盖的生成理由 B',
        assumptions: [], unknowns: [], suggestedPriority: 'medium',
      },
    ],
    humanRevisions: [],
    humanDecisions: [
      { requirementId: REQUIREMENT_A, selectedText: { kind: 'generated', draftId: DRAFT_A }, priority: 'high', decision: 'pending', humanReason: '' },
      { requirementId: REQUIREMENT_B, selectedText: { kind: 'generated', draftId: DRAFT_B }, priority: 'medium', decision: 'pending', humanReason: '' },
    ],
    requirementOrder: [REQUIREMENT_A, REQUIREMENT_B], baselines: [], currentBaselineId: null,
    prdRevisions: [], commandReceipts: [],
  }
}

describe('human requirement review', () => {
  it('creates a human revision without overwriting generated evidence or rationale', () => {
    const project = reviewableProject()
    const next = applyRequirementUpdate(project, {
      requirementId: REQUIREMENT_A,
      humanRevisionId: REVISION_A,
      title: '新的人工标题',
    })

    expect(next).not.toBe(project)
    expect(next.generatedRequirements[0]).toEqual(project.generatedRequirements[0])
    expect(next.generatedRequirements[0]).not.toBe(project.generatedRequirements[0])
    expect(next.humanRevisions.at(-1)).toMatchObject({
      id: REVISION_A, requirementId: REQUIREMENT_A, basedOnDraftId: DRAFT_A,
      title: '新的人工标题', painPoint: '生成痛点 A', description: '生成描述 A',
    })
    expect(next.humanDecisions[0]?.selectedText).toEqual({ kind: 'human-revision', revisionId: REVISION_A })
    expect(next.header.reviewStarted).toBe(true)
    expect(project.header.reviewStarted).toBe(false)
    expect(Object.isFrozen(next)).toBe(true)
    expect(Object.isFrozen(next.humanRevisions)).toBe(true)
  })

  it.each([
    { patch: { priority: 'low' as const }, expected: { priority: 'low' } },
    { patch: { decision: 'include' as const }, expected: { decision: 'include' } },
    { patch: { humanReason: '人工理由' }, expected: { humanReason: '人工理由' } },
    { patch: { selectedText: { kind: 'generated' as const, draftId: DRAFT_A } }, expected: { selectedText: { kind: 'generated', draftId: DRAFT_A } } },
  ])('locks reanalysis for review action %#', ({ patch, expected }) => {
    const next = applyRequirementUpdate(reviewableProject(), { requirementId: REQUIREMENT_A, ...patch })
    expect(next.header.reviewStarted).toBe(true)
    expect(next.humanDecisions[0]).toMatchObject(expected)
  })

  it.each(['high', 'medium', 'low'] as const)('accepts the exact priority %s', (priority) => {
    expect(applyRequirementUpdate(reviewableProject(), { requirementId: REQUIREMENT_A, priority })
      .humanDecisions[0]?.priority).toBe(priority)
  })

  it.each(['pending', 'include', 'defer', 'reject'] as const)('accepts the exact decision %s', (decision) => {
    expect(applyRequirementUpdate(reviewableProject(), { requirementId: REQUIREMENT_A, decision })
      .humanDecisions[0]?.decision).toBe(decision)
  })

  it('rejects invalid enums, human reason boundaries, duplicate revision ids, and stale selected text identities', () => {
    const project = reviewableProject()
    expect(() => applyRequirementUpdate(project, { requirementId: REQUIREMENT_A, priority: 'urgent' as 'high' }))
      .toThrowError('baseline-stale')
    expect(() => applyRequirementUpdate(project, { requirementId: REQUIREMENT_A, decision: 'accept' as 'include' }))
      .toThrowError('baseline-stale')
    expect(() => applyRequirementUpdate(project, {
      requirementId: REQUIREMENT_A, humanReason: '理'.repeat(MAX_HUMAN_REASON_CODE_POINTS + 1),
    })).toThrowError('limit-exceeded')
    expect(() => applyRequirementUpdate(project, {
      requirementId: REQUIREMENT_A, humanReason: '😀'.repeat(Math.floor(MAX_HUMAN_REASON_UTF8_BYTES / 4) + 1),
    })).toThrowError('limit-exceeded')
    expect(() => applyRequirementUpdate({
      ...project,
      humanRevisions: [{ id: REVISION_A, requirementId: REQUIREMENT_A, basedOnDraftId: DRAFT_A, title: '旧', painPoint: '旧', description: '旧' }],
    }, { requirementId: REQUIREMENT_A, humanRevisionId: REVISION_A, title: '重复' }))
      .toThrowError('baseline-stale')
    expect(() => applyRequirementUpdate(project, {
      requirementId: REQUIREMENT_A,
      selectedText: { kind: 'generated', draftId: DRAFT_B },
    })).toThrowError('baseline-stale')
    expect(() => applyRequirementUpdate(project, {
      requirementId: REQUIREMENT_A,
      selectedText: { kind: 'human-revision', revisionId: REVISION_A },
    })).toThrowError('baseline-stale')
  })

  it('rejects inclusion before review state is created when the current draft lacks support evidence', () => {
    const project = reviewableProject()
    expect(() => applyRequirementUpdate({
      ...project,
      evidence: project.evidence.map(item => ({ ...item, role: 'context' as const })),
    }, { requirementId: REQUIREMENT_A, decision: 'include' })).toThrowError('invalid-evidence')
    expect(() => applyRequirementUpdate({
      ...project,
      evidence: [],
    }, { requirementId: REQUIREMENT_A, decision: 'include' })).toThrowError('invalid-evidence')
    expect(project.header.reviewStarted).toBe(false)
  })

  it('requires a new revision id for text edits and validates all human text fields without partial output', () => {
    const project = reviewableProject()
    expect(() => applyRequirementUpdate(project, { requirementId: REQUIREMENT_A, title: '缺少 ID' }))
      .toThrowError('baseline-stale')
    expect(() => applyRequirementUpdate(project, { requirementId: REQUIREMENT_A, humanRevisionId: REVISION_A, title: '' }))
      .toThrowError('baseline-stale')
    expect(project.humanRevisions).toEqual([])
  })
})

describe('human requirement order', () => {
  it('accepts only an exact duplicate-free permutation and locks reanalysis', () => {
    const project = reviewableProject()
    const next = applyRequirementOrder(project, [REQUIREMENT_B, REQUIREMENT_A])
    expect(next.requirementOrder).toEqual([REQUIREMENT_B, REQUIREMENT_A])
    expect(next.header.reviewStarted).toBe(true)
    expect(project.requirementOrder).toEqual([REQUIREMENT_A, REQUIREMENT_B])
    expect(Object.isFrozen(next.requirementOrder)).toBe(true)

    expect(() => applyRequirementOrder(project, [REQUIREMENT_A, REQUIREMENT_A]))
      .toThrowError('baseline-stale')
    expect(() => applyRequirementOrder(project, [REQUIREMENT_A]))
      .toThrowError('baseline-stale')
    expect(() => applyRequirementOrder(project, [REQUIREMENT_A, requirementIdSchema.parse('40000000-0000-4000-8000-000000000599')]))
      .toThrowError('baseline-stale')
  })
})
