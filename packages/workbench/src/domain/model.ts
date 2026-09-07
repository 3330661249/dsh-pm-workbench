import { z } from 'zod'

import {
  analysisRevisionIdSchema,
  baselineIdSchema,
  commandIdSchema,
  evidenceIdSchema,
  generatedDraftIdSchema,
  prdRevisionIdSchema,
  projectIdSchema,
  requirementIdSchema,
  requirementRevisionIdSchema,
  sha256HexSchema,
  sourceRevisionIdSchema,
  type AnalysisRevisionId,
  type BaselineId,
  type CommandId,
  type EvidenceId,
  type GeneratedDraftId,
  type PrdRevisionId,
  type ProjectId,
  type RequirementId,
  type RequirementRevisionId,
  type Sha256Hex,
  type SourceRevisionId,
} from './ids.js'
import {
  MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES,
  MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES,
  MAX_ASSUMPTIONS_PER_REQUIREMENT,
  MAX_ASSUMPTIONS_UTF8_BYTES_PER_REQUIREMENT,
  MAX_BASELINES_PER_PROJECT,
  MAX_COMMAND_RECEIPTS_PER_PROJECT,
  MAX_EVIDENCE_PER_ANALYSIS,
  MAX_EVIDENCE_QUOTE_CODE_POINTS,
  MAX_EVIDENCE_QUOTE_UTF8_BYTES,
  MAX_HUMAN_REASON_CODE_POINTS,
  MAX_HUMAN_REASON_UTF8_BYTES,
  MAX_PRD_MARKDOWN_UTF8_BYTES,
  MAX_PRD_REVISIONS_PER_PROJECT,
  MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES,
  MAX_PROJECT_NAME_CODE_POINTS,
  MAX_PROJECT_NAME_UTF8_BYTES,
  MAX_REQUIREMENTS_PER_ANALYSIS,
  MAX_REQUIREMENT_TEXT_CODE_POINTS,
  MAX_REQUIREMENT_TEXT_UTF8_BYTES,
  MAX_RESEARCH_GOAL_CODE_POINTS,
  MAX_RESEARCH_GOAL_UTF8_BYTES,
  MAX_SOURCE_PERSISTED_UTF8_BYTES,
  MAX_SOURCE_UTF16_CODE_UNITS,
  MAX_TOMBSTONE_UTF8_BYTES,
  MAX_UNKNOWNS_PER_REQUIREMENT,
  MAX_UNKNOWNS_UTF8_BYTES_PER_REQUIREMENT,
  MAX_ASSUMPTION_OR_UNKNOWN_CODE_POINTS,
  MAX_ASSUMPTION_OR_UNKNOWN_UTF8_BYTES,
  hasUnpairedSurrogate,
  unicodeCodePointLength,
  utf8ByteLength,
} from './limits.js'
import { canonicalJsonUtf8Bytes } from '../protocol/canonical-json.js'

export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor && 'value' in descriptor) deepFreeze(descriptor.value)
  }
  return Object.freeze(value)
}

export interface ProjectHeader {
  readonly id: ProjectId
  readonly name: string
  readonly researchGoal: string | null
  readonly projectVersion: number
  readonly contentVersion: number
  readonly reviewStarted: boolean
  readonly updatedAt: string
}

export interface SourceRevision {
  readonly id: SourceRevisionId
  readonly projectId: ProjectId
  readonly revision: 1
  readonly displayName: string
  readonly format: 'pasted' | 'text/plain' | 'text/markdown'
  readonly text: string
  readonly utf8Bytes: number
  readonly contentHash: Sha256Hex
  readonly syntheticDataAttested: true
}

export interface EvidenceExcerpt {
  readonly id: EvidenceId
  readonly sourceRevisionId: SourceRevisionId
  readonly role: 'support' | 'counterexample' | 'context'
  readonly start: number
  readonly end: number
  readonly quote: string
  readonly quoteHash: Sha256Hex
}

export interface AnalysisRevision {
  readonly id: AnalysisRevisionId
  readonly sourceRevisionId: SourceRevisionId
  readonly kind: 'fixture' | 'harness-model'
  readonly generation: number
  readonly baseProjectVersion: number
  readonly status: 'draft' | 'superseded'
}

export interface GeneratedRequirementDraft {
  readonly id: GeneratedDraftId
  readonly requirementId: RequirementId
  readonly analysisRevisionId: AnalysisRevisionId
  readonly sourceRevisionId: SourceRevisionId
  readonly producer: 'fixture' | 'ai'
  readonly title: string
  readonly painPoint: string
  readonly description: string
  readonly evidenceIds: readonly EvidenceId[]
  readonly rationale: string
  readonly assumptions: readonly string[]
  readonly unknowns: readonly string[]
  readonly suggestedPriority: 'high' | 'medium' | 'low'
}

export interface AnalysisCandidate {
  readonly analysis: AnalysisRevision
  readonly evidence: readonly EvidenceExcerpt[]
  readonly generatedRequirements: readonly GeneratedRequirementDraft[]
}

export interface HumanRequirementRevision {
  readonly id: RequirementRevisionId
  readonly requirementId: RequirementId
  readonly basedOnDraftId: GeneratedDraftId
  readonly title: string
  readonly painPoint: string
  readonly description: string
}

export interface HumanDecision {
  readonly requirementId: RequirementId
  readonly selectedText:
    | { readonly kind: 'generated'; readonly draftId: GeneratedDraftId }
    | { readonly kind: 'human-revision'; readonly revisionId: RequirementRevisionId }
  readonly priority: 'high' | 'medium' | 'low'
  readonly decision: 'pending' | 'include' | 'defer' | 'reject'
  readonly humanReason: string
}

export interface RequirementBaselineItem {
  readonly rank: number
  readonly requirementId: RequirementId
  readonly textSource:
    | {
        readonly kind: 'generated'
        readonly draftId: GeneratedDraftId
        readonly producer: 'fixture' | 'ai'
      }
    | {
        readonly kind: 'human-revision'
        readonly draftId: GeneratedDraftId
        readonly revisionId: RequirementRevisionId
      }
  readonly title: string
  readonly painPoint: string
  readonly description: string
  readonly priority: 'high' | 'medium' | 'low'
  readonly humanReason: string
  readonly evidence: readonly EvidenceExcerpt[]
}

export interface RequirementBaseline {
  readonly id: BaselineId
  readonly projectId: ProjectId
  readonly projectName: string
  readonly researchGoal: string | null
  readonly sourceRevisionId: SourceRevisionId
  readonly sourceContentHash: Sha256Hex
  readonly projectVersion: number
  readonly contentVersion: number
  readonly items: readonly RequirementBaselineItem[]
  readonly createdAt: string
}

export interface PrdRevision {
  readonly id: PrdRevisionId
  readonly projectId: ProjectId
  readonly sourceRevisionId: SourceRevisionId
  readonly baselineId: BaselineId
  readonly baselineContentVersion: number
  readonly rendererVersion: 'pmwb-prd-v1'
  readonly contentHash: Sha256Hex
  readonly markdown: string
  readonly createdAt: string
}

export const PROJECT_BUSINESS_ERROR_CODES = Object.freeze([
  'not-found',
  'project-deleted',
  'project-limit-reached',
  'version-conflict',
  'idempotency-key-reused',
  'receipt-capacity-reached',
  'limit-exceeded',
  'synthetic-attestation-required',
  'fixture-not-allowed',
  'source-locked',
  'analysis-already-reviewed',
  'invalid-evidence',
  'no-included-requirements',
  'baseline-stale',
  'stage-unavailable',
] as const)

export type ProjectBusinessErrorCode = typeof PROJECT_BUSINESS_ERROR_CODES[number]

export interface AcceptedProjectCommandReceiptOutcome {
  readonly ok: true
  readonly projectVersion: number
  readonly contentVersion: number
  readonly sourceRevisionId?: SourceRevisionId
  readonly analysisRevisionId?: AnalysisRevisionId
  readonly baselineId?: BaselineId
  readonly prdRevisionId?: PrdRevisionId
}

export interface RejectedProjectCommandReceiptOutcome {
  readonly ok: false
  readonly code: ProjectBusinessErrorCode
}

export interface ProjectCommandReceipt {
  readonly commandId: CommandId
  readonly requestHash: Sha256Hex
  readonly outcome: AcceptedProjectCommandReceiptOutcome | RejectedProjectCommandReceiptOutcome
}

export interface DeleteProjectAcceptedOutcome {
  readonly ok: true
  readonly projectVersion: number
}

export interface ActiveProjectRecord {
  readonly kind: 'active'
  readonly schemaVersion: 1
  readonly header: ProjectHeader
  readonly source: SourceRevision | null
  readonly analyses: readonly AnalysisRevision[]
  readonly currentAnalysisRevisionId: AnalysisRevisionId | null
  readonly evidence: readonly EvidenceExcerpt[]
  readonly generatedRequirements: readonly GeneratedRequirementDraft[]
  readonly humanRevisions: readonly HumanRequirementRevision[]
  readonly humanDecisions: readonly HumanDecision[]
  readonly requirementOrder: readonly RequirementId[]
  readonly baselines: readonly RequirementBaseline[]
  readonly currentBaselineId: BaselineId | null
  readonly prdRevisions: readonly PrdRevision[]
  readonly commandReceipts: readonly ProjectCommandReceipt[]
}

export interface DeletedProjectTombstone {
  readonly kind: 'deleted'
  readonly schemaVersion: 1
  readonly projectId: ProjectId
  readonly deletedAt: string
  readonly deleteCommandId: CommandId
  readonly deleteRequestHash: Sha256Hex
  readonly deleteOutcome: DeleteProjectAcceptedOutcome
}

export type StoredProjectRecord = ActiveProjectRecord | DeletedProjectTombstone

interface TextLimit {
  readonly codePoints?: number
  readonly utf8Bytes?: number
  readonly utf16CodeUnits?: number
  readonly nonEmpty?: boolean
  readonly rejectNul?: boolean
}

function boundedText(limit: TextLimit): z.ZodType<string> {
  return z.string().superRefine((value, context) => {
    if (hasUnpairedSurrogate(value)) {
      context.addIssue({ code: 'custom', message: 'unpaired-surrogate' })
      return
    }
    if (limit.nonEmpty && value.length === 0) context.addIssue({ code: 'custom', message: 'empty-text' })
    if (limit.rejectNul && value.includes('\0')) context.addIssue({ code: 'custom', message: 'nul-not-allowed' })
    if (limit.codePoints !== undefined && unicodeCodePointLength(value) > limit.codePoints) {
      context.addIssue({ code: 'custom', message: 'limit-exceeded' })
    }
    if (limit.utf16CodeUnits !== undefined && value.length > limit.utf16CodeUnits) {
      context.addIssue({ code: 'custom', message: 'limit-exceeded' })
    }
    if (limit.utf8Bytes !== undefined && utf8ByteLength(value) > limit.utf8Bytes) {
      context.addIssue({ code: 'custom', message: 'limit-exceeded' })
    }
  })
}

const safeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const positiveSafeIntegerSchema = safeIntegerSchema.min(1)
const dateTimeSchema = boundedText({ nonEmpty: true }).refine((value) => {
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) && new Date(milliseconds).toISOString() === value
}, 'invalid-date-time')
const projectNameSchema = boundedText({
  codePoints: MAX_PROJECT_NAME_CODE_POINTS,
  utf8Bytes: MAX_PROJECT_NAME_UTF8_BYTES,
  nonEmpty: true,
})
const researchGoalSchema = boundedText({
  codePoints: MAX_RESEARCH_GOAL_CODE_POINTS,
  utf8Bytes: MAX_RESEARCH_GOAL_UTF8_BYTES,
})
const requirementTextSchema = boundedText({
  codePoints: MAX_REQUIREMENT_TEXT_CODE_POINTS,
  utf8Bytes: MAX_REQUIREMENT_TEXT_UTF8_BYTES,
  nonEmpty: true,
})
const humanReasonSchema = boundedText({
  codePoints: MAX_HUMAN_REASON_CODE_POINTS,
  utf8Bytes: MAX_HUMAN_REASON_UTF8_BYTES,
})
const assumptionOrUnknownSchema = boundedText({
  codePoints: MAX_ASSUMPTION_OR_UNKNOWN_CODE_POINTS,
  utf8Bytes: MAX_ASSUMPTION_OR_UNKNOWN_UTF8_BYTES,
  nonEmpty: true,
})
const prioritySchema = z.enum(['high', 'medium', 'low'])

export const projectHeaderSchema: z.ZodType<ProjectHeader> = z.strictObject({
  id: projectIdSchema,
  name: projectNameSchema,
  researchGoal: researchGoalSchema.nullable(),
  projectVersion: positiveSafeIntegerSchema,
  contentVersion: safeIntegerSchema,
  reviewStarted: z.boolean(),
  updatedAt: dateTimeSchema,
})

export const sourceRevisionSchema: z.ZodType<SourceRevision> = z.strictObject({
  id: sourceRevisionIdSchema,
  projectId: projectIdSchema,
  revision: z.literal(1),
  displayName: requirementTextSchema,
  format: z.enum(['pasted', 'text/plain', 'text/markdown']),
  text: boundedText({
    utf16CodeUnits: MAX_SOURCE_UTF16_CODE_UNITS,
    utf8Bytes: MAX_SOURCE_PERSISTED_UTF8_BYTES,
    nonEmpty: true,
    rejectNul: true,
  }),
  utf8Bytes: safeIntegerSchema.max(MAX_SOURCE_PERSISTED_UTF8_BYTES),
  contentHash: sha256HexSchema,
  syntheticDataAttested: z.literal(true),
})

export const evidenceExcerptSchema: z.ZodType<EvidenceExcerpt> = z.strictObject({
  id: evidenceIdSchema,
  sourceRevisionId: sourceRevisionIdSchema,
  role: z.enum(['support', 'counterexample', 'context']),
  start: safeIntegerSchema,
  end: positiveSafeIntegerSchema,
  quote: boundedText({
    codePoints: MAX_EVIDENCE_QUOTE_CODE_POINTS,
    utf8Bytes: MAX_EVIDENCE_QUOTE_UTF8_BYTES,
    nonEmpty: true,
  }),
  quoteHash: sha256HexSchema,
})

export const analysisRevisionSchema: z.ZodType<AnalysisRevision> = z.strictObject({
  id: analysisRevisionIdSchema,
  sourceRevisionId: sourceRevisionIdSchema,
  kind: z.enum(['fixture', 'harness-model']),
  generation: positiveSafeIntegerSchema,
  baseProjectVersion: positiveSafeIntegerSchema,
  status: z.enum(['draft', 'superseded']),
})

const generatedRequirementDraftDefinition = z.strictObject({
  id: generatedDraftIdSchema,
  requirementId: requirementIdSchema,
  analysisRevisionId: analysisRevisionIdSchema,
  sourceRevisionId: sourceRevisionIdSchema,
  producer: z.enum(['fixture', 'ai']),
  title: requirementTextSchema,
  painPoint: requirementTextSchema,
  description: requirementTextSchema,
  evidenceIds: z.array(evidenceIdSchema).max(MAX_EVIDENCE_PER_ANALYSIS),
  rationale: requirementTextSchema,
  assumptions: z.array(assumptionOrUnknownSchema).max(MAX_ASSUMPTIONS_PER_REQUIREMENT),
  unknowns: z.array(assumptionOrUnknownSchema).max(MAX_UNKNOWNS_PER_REQUIREMENT),
  suggestedPriority: prioritySchema,
}).superRefine((value, context) => {
  const assumptionBytes = value.assumptions.reduce((sum, item) => sum + utf8ByteLength(item), 0)
  const unknownBytes = value.unknowns.reduce((sum, item) => sum + utf8ByteLength(item), 0)
  if (assumptionBytes > MAX_ASSUMPTIONS_UTF8_BYTES_PER_REQUIREMENT) {
    context.addIssue({ code: 'custom', path: ['assumptions'], message: 'limit-exceeded' })
  }
  if (unknownBytes > MAX_UNKNOWNS_UTF8_BYTES_PER_REQUIREMENT) {
    context.addIssue({ code: 'custom', path: ['unknowns'], message: 'limit-exceeded' })
  }
})
export const generatedRequirementDraftSchema: z.ZodType<GeneratedRequirementDraft> = generatedRequirementDraftDefinition

export const analysisCandidateSchema: z.ZodType<AnalysisCandidate> = z.strictObject({
  analysis: analysisRevisionSchema,
  evidence: z.array(evidenceExcerptSchema).max(MAX_EVIDENCE_PER_ANALYSIS),
  generatedRequirements: z.array(generatedRequirementDraftSchema).max(MAX_REQUIREMENTS_PER_ANALYSIS),
})

export const humanRequirementRevisionSchema: z.ZodType<HumanRequirementRevision> = z.strictObject({
  id: requirementRevisionIdSchema,
  requirementId: requirementIdSchema,
  basedOnDraftId: generatedDraftIdSchema,
  title: requirementTextSchema,
  painPoint: requirementTextSchema,
  description: requirementTextSchema,
})

const selectedTextSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('generated'), draftId: generatedDraftIdSchema }),
  z.strictObject({ kind: z.literal('human-revision'), revisionId: requirementRevisionIdSchema }),
])
export const humanDecisionSchema: z.ZodType<HumanDecision> = z.strictObject({
  requirementId: requirementIdSchema,
  selectedText: selectedTextSchema,
  priority: prioritySchema,
  decision: z.enum(['pending', 'include', 'defer', 'reject']),
  humanReason: humanReasonSchema,
})

const baselineTextSourceSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('generated'),
    draftId: generatedDraftIdSchema,
    producer: z.enum(['fixture', 'ai']),
  }),
  z.strictObject({
    kind: z.literal('human-revision'),
    draftId: generatedDraftIdSchema,
    revisionId: requirementRevisionIdSchema,
  }),
])
export const requirementBaselineItemSchema: z.ZodType<RequirementBaselineItem> = z.strictObject({
  rank: positiveSafeIntegerSchema,
  requirementId: requirementIdSchema,
  textSource: baselineTextSourceSchema,
  title: requirementTextSchema,
  painPoint: requirementTextSchema,
  description: requirementTextSchema,
  priority: prioritySchema,
  humanReason: humanReasonSchema,
  evidence: z.array(evidenceExcerptSchema).max(MAX_EVIDENCE_PER_ANALYSIS),
})

const requirementBaselineDefinition = z.strictObject({
  id: baselineIdSchema,
  projectId: projectIdSchema,
  projectName: projectNameSchema,
  researchGoal: researchGoalSchema.nullable(),
  sourceRevisionId: sourceRevisionIdSchema,
  sourceContentHash: sha256HexSchema,
  projectVersion: positiveSafeIntegerSchema,
  contentVersion: safeIntegerSchema,
  items: z.array(requirementBaselineItemSchema).min(1).max(MAX_REQUIREMENTS_PER_ANALYSIS),
  createdAt: dateTimeSchema,
}).superRefine((value, context) => {
  if (new Set(value.items.map(item => item.requirementId)).size !== value.items.length) {
    context.addIssue({ code: 'custom', path: ['items'], message: 'duplicate-requirement' })
  }
  value.items.forEach((item, index) => {
    if (item.rank !== index + 1) {
      context.addIssue({ code: 'custom', path: ['items', index, 'rank'], message: 'invalid-rank' })
    }
    if (new Set(item.evidence.map(evidence => evidence.id)).size !== item.evidence.length) {
      context.addIssue({ code: 'custom', path: ['items', index, 'evidence'], message: 'duplicate-evidence' })
    }
    if (item.evidence.some(evidence => evidence.sourceRevisionId !== value.sourceRevisionId)) {
      context.addIssue({ code: 'custom', path: ['items', index, 'evidence'], message: 'source-revision-mismatch' })
    }
  })
})
export const requirementBaselineSchema: z.ZodType<RequirementBaseline> = requirementBaselineDefinition

export const prdRevisionSchema: z.ZodType<PrdRevision> = z.strictObject({
  id: prdRevisionIdSchema,
  projectId: projectIdSchema,
  sourceRevisionId: sourceRevisionIdSchema,
  baselineId: baselineIdSchema,
  baselineContentVersion: safeIntegerSchema,
  rendererVersion: z.literal('pmwb-prd-v1'),
  contentHash: sha256HexSchema,
  markdown: boundedText({ utf8Bytes: MAX_PRD_MARKDOWN_UTF8_BYTES, nonEmpty: true }),
  createdAt: dateTimeSchema,
})

const acceptedReceiptOutcomeSchema = z.strictObject({
  ok: z.literal(true),
  projectVersion: positiveSafeIntegerSchema,
  contentVersion: safeIntegerSchema,
  sourceRevisionId: sourceRevisionIdSchema.optional(),
  analysisRevisionId: analysisRevisionIdSchema.optional(),
  baselineId: baselineIdSchema.optional(),
  prdRevisionId: prdRevisionIdSchema.optional(),
}) satisfies z.ZodType<AcceptedProjectCommandReceiptOutcome>
const rejectedReceiptOutcomeSchema = z.strictObject({
  ok: z.literal(false),
  code: z.enum(PROJECT_BUSINESS_ERROR_CODES),
}) satisfies z.ZodType<RejectedProjectCommandReceiptOutcome>
export const projectCommandReceiptSchema = z.strictObject({
  commandId: commandIdSchema,
  requestHash: sha256HexSchema,
  outcome: z.discriminatedUnion('ok', [acceptedReceiptOutcomeSchema, rejectedReceiptOutcomeSchema]),
}) satisfies z.ZodType<ProjectCommandReceipt>

export const deleteProjectAcceptedOutcomeSchema: z.ZodType<DeleteProjectAcceptedOutcome> = z.strictObject({
  ok: z.literal(true),
  projectVersion: positiveSafeIntegerSchema,
})

const activeProjectRecordShapeSchema = z.strictObject({
  kind: z.literal('active'),
  schemaVersion: z.literal(1),
  header: projectHeaderSchema,
  source: sourceRevisionSchema.nullable(),
  analyses: z.array(analysisRevisionSchema),
  currentAnalysisRevisionId: analysisRevisionIdSchema.nullable(),
  evidence: z.array(evidenceExcerptSchema).max(MAX_EVIDENCE_PER_ANALYSIS),
  generatedRequirements: z.array(generatedRequirementDraftSchema).max(MAX_REQUIREMENTS_PER_ANALYSIS),
  humanRevisions: z.array(humanRequirementRevisionSchema),
  humanDecisions: z.array(humanDecisionSchema).max(MAX_REQUIREMENTS_PER_ANALYSIS),
  requirementOrder: z.array(requirementIdSchema).max(MAX_REQUIREMENTS_PER_ANALYSIS),
  baselines: z.array(requirementBaselineSchema).max(MAX_BASELINES_PER_PROJECT),
  currentBaselineId: baselineIdSchema.nullable(),
  prdRevisions: z.array(prdRevisionSchema).max(MAX_PRD_REVISIONS_PER_PROJECT),
  commandReceipts: z.array(projectCommandReceiptSchema).max(MAX_COMMAND_RECEIPTS_PER_PROJECT),
}) satisfies z.ZodType<ActiveProjectRecord>

const deletedProjectTombstoneShapeSchema = z.strictObject({
  kind: z.literal('deleted'),
  schemaVersion: z.literal(1),
  projectId: projectIdSchema,
  deletedAt: dateTimeSchema,
  deleteCommandId: commandIdSchema,
  deleteRequestHash: sha256HexSchema,
  deleteOutcome: deleteProjectAcceptedOutcomeSchema,
}) satisfies z.ZodType<DeletedProjectTombstone>

const storedProjectRecordDefinition = z.discriminatedUnion('kind', [
  activeProjectRecordShapeSchema,
  deletedProjectTombstoneShapeSchema,
]).superRefine((record, context) => {
  const maximum = record.kind === 'active'
    ? MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES
    : MAX_TOMBSTONE_UTF8_BYTES
  try {
    if (canonicalJsonUtf8Bytes(record) > maximum) {
      context.addIssue({ code: 'custom', message: 'limit-exceeded' })
    }
  } catch (error) {
    context.addIssue({
      code: 'custom',
      message: error instanceof Error ? error.message : 'non-json-value',
    })
  }
  if (record.kind === 'active') {
    const evidenceBytes = record.evidence.reduce((sum, item) => sum + utf8ByteLength(item.quote), 0)
    if (evidenceBytes > MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES) {
      context.addIssue({ code: 'custom', path: ['evidence'], message: 'limit-exceeded' })
    }
    const analysisTextBytes = record.generatedRequirements.reduce((sum, requirement) =>
      sum
      + requirement.assumptions.reduce((subtotal, item) => subtotal + utf8ByteLength(item), 0)
      + requirement.unknowns.reduce((subtotal, item) => subtotal + utf8ByteLength(item), 0), 0)
    if (analysisTextBytes > MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES) {
      context.addIssue({ code: 'custom', path: ['generatedRequirements'], message: 'limit-exceeded' })
    }
  }
})

export const storedProjectRecordSchema: z.ZodType<StoredProjectRecord> = storedProjectRecordDefinition

export function assertStoredRecordBudget(value: unknown): asserts value is StoredProjectRecord {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    const kind = Reflect.get(value, 'kind')
    const maximum = kind === 'active'
      ? MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES
      : kind === 'deleted'
        ? MAX_TOMBSTONE_UTF8_BYTES
        : undefined
    if (maximum !== undefined && canonicalJsonUtf8Bytes(value) > maximum) throw new Error('limit-exceeded')
  }
  storedProjectRecordSchema.parse(value)
}
