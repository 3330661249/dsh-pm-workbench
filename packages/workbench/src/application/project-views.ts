import { z } from 'zod'
import {
  analysisRevisionIdSchema, baselineIdSchema, prdRevisionIdSchema, projectIdSchema,
  requirementIdSchema, sha256HexSchema, sourceRevisionIdSchema,
  type PrdRevisionId, type SourceRevisionId,
} from '../domain/ids.js'
import {
  analysisRevisionSchema, deepFreeze, evidenceExcerptSchema, generatedRequirementDraftSchema,
  humanDecisionSchema, humanRequirementRevisionSchema, projectHeaderSchema, sourceRevisionSchema,
  prdRevisionSchema, requirementBaselineSchema, type ActiveProjectRecord, type ProjectHeader,
} from '../domain/model.js'
import {
  MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES, MAX_EVIDENCE_PER_ANALYSIS,
  MAX_PRD_REVISIONS_PER_PROJECT, MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES,
  MAX_REQUIREMENTS_PER_ANALYSIS, MAX_SOURCE_PERSISTED_UTF8_BYTES, MAX_SOURCE_UTF16_CODE_UNITS,
  MAX_PRD_MARKDOWN_UTF8_BYTES, hasUnpairedSurrogate, utf8ByteLength,
} from '../domain/limits.js'

export type ReadonlyValue<T> = T extends readonly unknown[]
  ? { readonly [K in keyof T]: ReadonlyValue<T[K]> }
  : T extends object ? { readonly [K in keyof T]: ReadonlyValue<T[K]> } : T
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const positive = integer.min(1)
const timestamp = z.string().refine(value => {
  const time = Date.parse(value)
  return Number.isFinite(time) && new Date(time).toISOString() === value
})
const displayName = z.string().min(1).max(2000).refine(value =>
  !hasUnpairedSurrogate(value) && utf8ByteLength(value) <= 8192
  && !/[\\/:\u0000-\u001f\u007f]/.test(value) && value !== '.' && value !== '..')
const sourceMetadataShape = {
  projectId: projectIdSchema, sourceRevisionId: sourceRevisionIdSchema, revision: z.literal(1),
  displayName, format: z.enum(['pasted', 'text/plain', 'text/markdown']),
  utf8Bytes: integer.max(MAX_SOURCE_PERSISTED_UTF8_BYTES), contentHash: sha256HexSchema,
  syntheticDataAttested: z.literal(true),
}
export const sourceMetadataSchema = z.strictObject(sourceMetadataShape)
export const sourceViewSchema = z.strictObject({
  ...sourceMetadataShape,
  text: z.string().min(1).max(MAX_SOURCE_UTF16_CODE_UNITS).refine(value =>
    !hasUnpairedSurrogate(value) && !value.includes('\0') && value.trim().length > 0
    && utf8ByteLength(value) <= MAX_SOURCE_PERSISTED_UTF8_BYTES),
}).refine(value => value.utf8Bytes === utf8ByteLength(value.text))
export type SourceView = ReadonlyValue<z.infer<typeof sourceViewSchema>>
const prdMetadataShape = {
  projectId: projectIdSchema, prdRevisionId: prdRevisionIdSchema, sourceRevisionId: sourceRevisionIdSchema,
  baselineId: baselineIdSchema, baselineContentVersion: integer,
  rendererVersion: z.literal('pmwb-prd-v1'), contentHash: sha256HexSchema,
  utf8Bytes: positive.max(MAX_PRD_MARKDOWN_UTF8_BYTES), createdAt: timestamp,
}
export const markdownViewSchema = z.strictObject({
  ...prdMetadataShape,
  markdown: z.string().min(1).refine(value => !hasUnpairedSurrogate(value) && utf8ByteLength(value) <= MAX_PRD_MARKDOWN_UTF8_BYTES),
}).refine(value => value.utf8Bytes === utf8ByteLength(value.markdown))
export type MarkdownView = ReadonlyValue<z.infer<typeof markdownViewSchema>>
export const prdSummarySchema = z.strictObject({ ...prdMetadataShape, status: z.enum(['current', 'stale']) })
export const baselineSummarySchema = z.strictObject({
  id: baselineIdSchema, projectId: projectIdSchema, sourceRevisionId: sourceRevisionIdSchema,
  sourceContentHash: sha256HexSchema, projectVersion: positive, contentVersion: integer,
  itemCount: positive.max(MAX_REQUIREMENTS_PER_ANALYSIS), createdAt: timestamp,
})
export type ProjectSummary = ProjectHeader
export const projectSummarySchema = projectHeaderSchema

const projectViewDefinition = z.strictObject({
  header: projectHeaderSchema,
  source: sourceMetadataSchema.nullable(),
  analysis: analysisRevisionSchema.nullable(),
  generatedRequirements: z.array(generatedRequirementDraftSchema).max(MAX_REQUIREMENTS_PER_ANALYSIS),
  selectedHumanRevisions: z.array(humanRequirementRevisionSchema).max(MAX_REQUIREMENTS_PER_ANALYSIS),
  humanDecisions: z.array(humanDecisionSchema).max(MAX_REQUIREMENTS_PER_ANALYSIS),
  requirementOrder: z.array(requirementIdSchema).max(MAX_REQUIREMENTS_PER_ANALYSIS),
  evidence: z.array(evidenceExcerptSchema).max(MAX_EVIDENCE_PER_ANALYSIS),
  currentBaseline: baselineSummarySchema.nullable(),
  prdSummaries: z.array(prdSummarySchema).max(MAX_PRD_REVISIONS_PER_PROJECT),
}).superRefine((view, context) => {
  const invalid = () => context.addIssue({ code: 'custom', message: 'invalid-project-view' })
  const unique = (values: readonly string[]) => new Set(values).size === values.length
  const requirements = view.generatedRequirements.map(draft => draft.requirementId)
  if (!unique(requirements) || !unique(view.generatedRequirements.map(draft => draft.id))
    || !unique(view.selectedHumanRevisions.map(revision => revision.id))
    || !unique(view.humanDecisions.map(decision => decision.requirementId))
    || !unique(view.evidence.map(evidence => evidence.id))
    || !unique(view.prdSummaries.map(prd => prd.prdRevisionId))
    || !unique(view.requirementOrder) || view.requirementOrder.length !== requirements.length
    || view.requirementOrder.some(id => !requirements.includes(id))) invalid()
  if (view.source && view.source.projectId !== view.header.id) invalid()
  if (view.analysis && (view.analysis.sourceRevisionId !== view.source?.sourceRevisionId
    || view.analysis.status !== 'draft' || view.analysis.kind !== 'fixture')) invalid()
  for (const draft of view.generatedRequirements) {
    if (draft.analysisRevisionId !== view.analysis?.id || draft.sourceRevisionId !== view.source?.sourceRevisionId
      || draft.producer !== 'fixture' || !unique(draft.evidenceIds)
      || draft.evidenceIds.some(id => !view.evidence.some(item => item.id === id))) invalid()
  }
  for (const evidence of view.evidence) {
    if (evidence.sourceRevisionId !== view.source?.sourceRevisionId || evidence.start >= evidence.end) invalid()
  }
  const selected = new Set<string>()
  for (const decision of view.humanDecisions) {
    const draft = view.generatedRequirements.find(item => item.requirementId === decision.requirementId)
    if (!draft) { invalid(); continue }
    if (decision.selectedText.kind === 'generated') {
      if (decision.selectedText.draftId !== draft.id) invalid()
    } else {
      const revisionId = decision.selectedText.revisionId
      selected.add(revisionId)
      const revision = view.selectedHumanRevisions.find(item => item.id === revisionId)
      if (!revision || revision.requirementId !== draft.requirementId || revision.basedOnDraftId !== draft.id) invalid()
    }
  }
  if (view.selectedHumanRevisions.some(revision => !selected.has(revision.id))) invalid()
  if (view.currentBaseline && (view.currentBaseline.projectId !== view.header.id
    || view.currentBaseline.sourceRevisionId !== view.source?.sourceRevisionId)) invalid()
  for (const prd of view.prdSummaries) {
    const current = prd.baselineId === view.currentBaseline?.id && prd.baselineContentVersion === view.header.contentVersion
      && view.currentBaseline.contentVersion === view.header.contentVersion
    if (prd.projectId !== view.header.id || prd.sourceRevisionId !== view.source?.sourceRevisionId
      || prd.status !== (current ? 'current' : 'stale')) invalid()
  }
  if (view.evidence.reduce((sum, evidence) => sum + utf8ByteLength(evidence.quote), 0) > MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES
    || view.generatedRequirements.reduce((sum, draft) => sum + [...draft.assumptions, ...draft.unknowns]
      .reduce((bytes, item) => bytes + utf8ByteLength(item), 0), 0) > MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES) {
    context.addIssue({ code: 'custom', message: 'limit-exceeded' })
  }
})
export type ProjectView = ReadonlyValue<z.infer<typeof projectViewDefinition>>
export const projectViewSchema: z.ZodType<ProjectView> = projectViewDefinition

export function projectSummaryOf(project: ActiveProjectRecord): ProjectSummary {
  return deepFreeze(projectSummarySchema.parse(project.header))
}

export function sourceViewOf(project: ActiveProjectRecord, sourceRevisionId: SourceRevisionId): SourceView {
  if (!project.source || project.source.id !== sourceRevisionId) throw new Error('not-found')
  const { id, ...source } = sourceRevisionSchema.parse(project.source)
  if (source.projectId !== project.header.id) throw new Error('invalid-project-view')
  return deepFreeze(sourceViewSchema.parse({ ...source, sourceRevisionId: id }))
}

export function markdownViewOf(project: ActiveProjectRecord, prdRevisionId: PrdRevisionId): MarkdownView {
  const prds = project.prdRevisions.filter(item => item.id === prdRevisionId)
  if (prds.length !== 1) throw new Error('not-found')
  const { id, ...prd } = prdRevisionSchema.parse(prds[0])
  if (prd.projectId !== project.header.id) throw new Error('invalid-project-view')
  return deepFreeze(markdownViewSchema.parse({ ...prd, prdRevisionId: id, utf8Bytes: utf8ByteLength(prd.markdown) }))
}

export function projectViewOf(project: ActiveProjectRecord): ProjectView {
  let source = null
  if (project.source) {
    const { text: _text, ...metadata } = sourceViewOf(project, project.source.id)
    source = metadata
  }
  const analysis = project.analyses.find(item => item.id === project.currentAnalysisRevisionId) ?? null
  const generatedRequirements = project.generatedRequirements.filter(item => item.analysisRevisionId === analysis?.id)
  const requirementIds = new Set(generatedRequirements.map(item => item.requirementId))
  const humanDecisions = project.humanDecisions.filter(item => requirementIds.has(item.requirementId))
  const selectedIds = new Set(humanDecisions.flatMap(item => item.selectedText.kind === 'human-revision' ? [item.selectedText.revisionId] : []))
  const baseline = project.baselines.find(item => item.id === project.currentBaselineId)
  let currentBaseline = null
  if (baseline) {
    const parsed = requirementBaselineSchema.parse(baseline)
    currentBaseline = { id: parsed.id, projectId: parsed.projectId, sourceRevisionId: parsed.sourceRevisionId,
      sourceContentHash: parsed.sourceContentHash, projectVersion: parsed.projectVersion,
      contentVersion: parsed.contentVersion, itemCount: parsed.items.length, createdAt: parsed.createdAt }
  }
  return deepFreeze(projectViewSchema.parse({
    header: project.header, source, analysis, generatedRequirements,
    selectedHumanRevisions: project.humanRevisions.filter(item => selectedIds.has(item.id)), humanDecisions,
    requirementOrder: project.requirementOrder,
    evidence: analysis ? project.evidence.filter(item => item.sourceRevisionId === analysis.sourceRevisionId) : [],
    currentBaseline,
    prdSummaries: project.prdRevisions.map(prd => ({
      projectId: prd.projectId, prdRevisionId: prd.id, sourceRevisionId: prd.sourceRevisionId,
      baselineId: prd.baselineId, baselineContentVersion: prd.baselineContentVersion,
      rendererVersion: prd.rendererVersion, contentHash: prd.contentHash, utf8Bytes: utf8ByteLength(prd.markdown),
      createdAt: prd.createdAt,
      status: prd.baselineId === currentBaseline?.id && prd.baselineContentVersion === project.header.contentVersion
        && currentBaseline.contentVersion === project.header.contentVersion ? 'current' : 'stale',
    })),
  }))
}
