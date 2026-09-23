import { z } from 'zod'
import {
  analysisRevisionIdSchema, baselineIdSchema, commandIdSchema, generatedDraftIdSchema,
  prdRevisionIdSchema, projectIdSchema, requirementIdSchema, requirementRevisionIdSchema,
  sourceRevisionIdSchema,
} from '../domain/ids.js'
import { deepFreeze, sourceDisplayNameSchema } from '../domain/model.js'
import {
  MAX_ACTIVE_PROJECTS, MAX_REQUIREMENTS_PER_ANALYSIS, MAX_REQUIREMENT_TEXT_CODE_POINTS,
  MAX_REQUIREMENT_TEXT_UTF8_BYTES, MAX_PROJECT_NAME_CODE_POINTS, MAX_PROJECT_NAME_UTF8_BYTES,
  MAX_RESEARCH_GOAL_CODE_POINTS, MAX_RESEARCH_GOAL_UTF8_BYTES, MAX_SOURCE_UTF16_CODE_UNITS,
  MAX_SOURCE_PERSISTED_UTF8_BYTES, hasUnpairedSurrogate, unicodeCodePointLength, utf8ByteLength,
} from '../domain/limits.js'
import {
  projectSummarySchema, projectViewSchema, sourceViewSchema, markdownViewSchema,
  type ReadonlyValue,
} from '../application/project-views.js'
import { canonicalEnvelopeUtf8Bytes } from './canonical-json.js'

export const PRODUCT_RPC_CHANNEL = '/dsh-pm-workbench-product-v1' as const
export const PRODUCT_API_VERSION = 'pmwb-product-v1' as const
export const PRODUCT_CAPABILITIES = Object.freeze({
  wireSchemaVersion: '1', dataSchemaVersion: '1', analysisMode: 'hybrid', modelAnalysis: true,
  realDataAllowed: true, maxHostInflightRequests: 16, maxClientInflightRequests: 8,
} as const)
export const PRODUCT_ERROR_CODES = Object.freeze([
  'not-found', 'project-deleted', 'project-limit-reached', 'version-conflict',
  'idempotency-key-reused', 'receipt-capacity-reached', 'limit-exceeded',
  'synthetic-attestation-required', 'fixture-not-allowed', 'source-locked',
  'analysis-already-reviewed', 'invalid-evidence', 'no-included-requirements',
  'baseline-stale', 'stage-unavailable', 'model-output-incomplete', 'cancelled', 'storage-failed',
] as const)
export type ProductErrorCode = typeof PRODUCT_ERROR_CODES[number]
export const STAGE3A_COMMAND_KINDS = Object.freeze([
  'project.create', 'project.delete', 'source.importText', 'analysis.runFixture',
  'requirement.update', 'requirements.reorder', 'baseline.publish', 'prd.render',
] as const)
export const PRODUCT_COMMAND_SCHEMA_KINDS = Object.freeze([...STAGE3A_COMMAND_KINDS, 'analysis.runHarnessModel'] as const)
const integer = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
const positive = integer.min(1)
const api = { apiVersion: z.literal(PRODUCT_API_VERSION) }
function boundedText(codePoints: number, bytes: number, nonEmpty = true) {
  return z.string().refine(value => !hasUnpairedSurrogate(value)
    && (!nonEmpty || value.trim().length > 0)
    && unicodeCodePointLength(value) <= codePoints && utf8ByteLength(value) <= bytes)
}
const requirementText = boundedText(MAX_REQUIREMENT_TEXT_CODE_POINTS, MAX_REQUIREMENT_TEXT_UTF8_BYTES)
const selectedText = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('generated'), draftId: generatedDraftIdSchema }),
  z.strictObject({ kind: z.literal('human-revision'), revisionId: requirementRevisionIdSchema }),
])
const requirementUpdate = z.strictObject({
  kind: z.literal('requirement.update'), requirementId: requirementIdSchema,
  title: requirementText.optional(), painPoint: requirementText.optional(), description: requirementText.optional(),
  selectedText: selectedText.optional(), priority: z.enum(['high', 'medium', 'low']).optional(),
  decision: z.enum(['pending', 'include', 'defer', 'reject']).optional(),
  humanReason: boundedText(MAX_REQUIREMENT_TEXT_CODE_POINTS, MAX_REQUIREMENT_TEXT_UTF8_BYTES, false).optional(),
}).refine(payload => Object.keys(payload).some(key => key !== 'kind' && key !== 'requirementId'))

export const productCommandPayloadSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('project.create'),
    name: boundedText(MAX_PROJECT_NAME_CODE_POINTS, MAX_PROJECT_NAME_UTF8_BYTES),
    researchGoal: boundedText(MAX_RESEARCH_GOAL_CODE_POINTS, MAX_RESEARCH_GOAL_UTF8_BYTES, false).nullable(),
    syntheticDataAttested: z.literal(true).optional(), dataUseAttested: z.literal(true).optional(),
  }),
  z.strictObject({ kind: z.literal('project.delete') }),
  z.strictObject({ kind: z.literal('source.importText'),
    text: z.string().min(1).max(MAX_SOURCE_UTF16_CODE_UNITS).refine(value =>
      !hasUnpairedSurrogate(value) && !value.includes('\0') && value.trim().length > 0
      && utf8ByteLength(value) <= MAX_SOURCE_PERSISTED_UTF8_BYTES),
    displayName: sourceDisplayNameSchema,
    format: z.enum(['pasted', 'text/plain', 'text/markdown']),
    syntheticDataAttested: z.literal(true).optional(), dataUseAttested: z.literal(true).optional(),
    dataClassification: z.enum(['synthetic', 'authorized-real']).optional(),
  }),
  z.strictObject({ kind: z.literal('analysis.runFixture'), sourceRevisionId: sourceRevisionIdSchema }),
  requirementUpdate,
  z.strictObject({ kind: z.literal('requirements.reorder'),
    requirementIds: z.array(requirementIdSchema).min(1).max(MAX_REQUIREMENTS_PER_ANALYSIS)
      .refine(ids => new Set(ids).size === ids.length),
  }),
  z.strictObject({ kind: z.literal('baseline.publish'), confirmedContentVersion: integer }),
  z.strictObject({ kind: z.literal('prd.render'), baselineId: baselineIdSchema, confirmedContentVersion: integer }),
  // Reserved wire shape only. No Stage 3A execution path exists.
  z.strictObject({ kind: z.literal('analysis.runHarnessModel'), sourceRevisionId: sourceRevisionIdSchema }),
]).superRefine((payload, context) => {
  if (payload.kind !== 'project.create' && payload.kind !== 'source.importText') return
  const legacy = payload.syntheticDataAttested === true && payload.dataUseAttested === undefined
    && (payload.kind !== 'source.importText' || payload.dataClassification === undefined)
  const current = payload.syntheticDataAttested === undefined && payload.dataUseAttested === true
    && (payload.kind !== 'source.importText' || payload.dataClassification !== undefined)
  if (!legacy && !current) context.addIssue({ code: 'custom', message: 'data-use-attestation-required' })
})
export type StrictProjectCommandPayload = ReadonlyValue<z.infer<typeof productCommandPayloadSchema>>
export const projectCommandSchema = z.strictObject({
  ...api, projectId: projectIdSchema, commandId: commandIdSchema, expectedVersion: integer,
  payload: productCommandPayloadSchema,
}).refine(command => command.payload.kind === 'project.create' ? command.expectedVersion === 0 : command.expectedVersion > 0)
export type ProjectCommand = ReadonlyValue<z.infer<typeof projectCommandSchema>>
export const healthInputSchema = z.strictObject(api)
export const listProjectsInputSchema = z.strictObject(api)
export const getProjectInputSchema = z.strictObject({ ...api, projectId: projectIdSchema })
export const getSourceInputSchema = z.strictObject({ ...api, projectId: projectIdSchema, sourceRevisionId: sourceRevisionIdSchema })
export const getMarkdownInputSchema = z.strictObject({ ...api, projectId: projectIdSchema, prdRevisionId: prdRevisionIdSchema })
export type GetProjectInput = ReadonlyValue<z.infer<typeof getProjectInputSchema>>
export type GetSourceInput = ReadonlyValue<z.infer<typeof getSourceInputSchema>>
export type GetMarkdownInput = ReadonlyValue<z.infer<typeof getMarkdownInputSchema>>
export const productCapabilitiesSchema = z.strictObject({
  wireSchemaVersion: z.literal('1'), dataSchemaVersion: z.literal('1'), analysisMode: z.literal('hybrid'),
  modelAnalysis: z.literal(true), realDataAllowed: z.literal(true),
  maxHostInflightRequests: z.literal(16), maxClientInflightRequests: z.literal(8),
})
export const productBusinessErrorSchema = z.strictObject({ code: z.enum(PRODUCT_ERROR_CODES) })
function outcomeSchema<T extends z.ZodType>(value: T) {
  return z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('accepted'), value }),
    z.strictObject({ status: z.literal('rejected'), error: productBusinessErrorSchema }),
  ])
}
export const projectCommandOutcomeSchema = z.discriminatedUnion('status', [
  z.strictObject({ status: z.literal('accepted'), projectId: projectIdSchema, commandId: commandIdSchema,
    value: z.strictObject({ projectVersion: positive, contentVersion: integer.optional(),
      sourceRevisionId: sourceRevisionIdSchema.optional(), analysisRevisionId: analysisRevisionIdSchema.optional(),
      baselineId: baselineIdSchema.optional(), prdRevisionId: prdRevisionIdSchema.optional() }),
  }),
  z.strictObject({ status: z.literal('rejected'), projectId: projectIdSchema, commandId: commandIdSchema, error: productBusinessErrorSchema }),
])
export type ProjectCommandOutcome = ReadonlyValue<z.infer<typeof projectCommandOutcomeSchema>>
export const productOuterErrorSchema = z.strictObject({
  code: z.enum(['invalid-request', 'invalid-outcome', 'limit-exceeded', 'internal-error']), details: z.strictObject({}),
})
export type ProductOuterError = ReadonlyValue<z.infer<typeof productOuterErrorSchema>>
class ProductProtocolError extends Error {
  constructor(readonly code: ProductOuterError['code']) { super(code) }
}
/** Never inspect arbitrary error messages, stacks, input or nested details. */
export function safeProductOuterError(error: unknown): ProductOuterError {
  return Object.freeze({ code: error instanceof ProductProtocolError ? error.code : 'internal-error', details: Object.freeze({}) })
}

function commandCorrelates(input: ProjectCommand, outcome: ProjectCommandOutcome): boolean {
  if (input.projectId !== outcome.projectId || input.commandId !== outcome.commandId) return false
  if (outcome.status === 'rejected') return true
  if (input.expectedVersion === Number.MAX_SAFE_INTEGER || outcome.value.projectVersion !== input.expectedVersion + 1) return false
  const value = outcome.value
  const fields = Object.keys(value).sort().join(',')
  const expectFields = (...keys: string[]) => fields === keys.sort().join(',')
  switch (input.payload.kind) {
    case 'project.delete': return expectFields('projectVersion')
    case 'project.create': return expectFields('projectVersion', 'contentVersion') && value.contentVersion === 0
    case 'source.importText': return expectFields('projectVersion', 'contentVersion', 'sourceRevisionId')
    case 'analysis.runFixture':
    case 'analysis.runHarnessModel': return expectFields('projectVersion', 'contentVersion', 'analysisRevisionId')
    case 'requirement.update':
    case 'requirements.reorder': return expectFields('projectVersion', 'contentVersion')
    case 'baseline.publish': return expectFields('projectVersion', 'contentVersion', 'baselineId')
      && value.contentVersion === input.payload.confirmedContentVersion
    case 'prd.render': return expectFields('projectVersion', 'contentVersion', 'baselineId', 'prdRevisionId')
      && value.contentVersion === input.payload.confirmedContentVersion && value.baselineId === input.payload.baselineId
    default: return false
  }
}
function entry<I extends z.ZodType, O extends z.ZodType>(inputSchema: I, outcomeSchema: O,
  maxRequestUtf8Bytes: number, maxOutcomeUtf8Bytes: number,
  validateOutcome: (input: z.infer<I>, outcome: z.infer<O>) => boolean) {
  return Object.freeze({ inputSchema, outcomeSchema, maxRequestUtf8Bytes, maxOutcomeUtf8Bytes, validateOutcome })
}
const registry = {
  health: entry(healthInputSchema, outcomeSchema(productCapabilitiesSchema), 4096, 16384, () => true),
  'projects.list': entry(listProjectsInputSchema, outcomeSchema(z.array(projectSummarySchema).max(MAX_ACTIVE_PROJECTS)
    .refine(projects => new Set(projects.map(project => project.id)).size === projects.length)), 4096, 131072, () => true),
  'projects.get': entry(getProjectInputSchema, outcomeSchema(projectViewSchema), 4096, 1048576,
    (input, outcome) => outcome.status === 'rejected' || input.projectId === outcome.value.header.id),
  'sources.get': entry(getSourceInputSchema, outcomeSchema(sourceViewSchema), 4096, 786432,
    (input, outcome) => outcome.status === 'rejected' || (input.projectId === outcome.value.projectId && input.sourceRevisionId === outcome.value.sourceRevisionId)),
  'artifacts.getMarkdown': entry(getMarkdownInputSchema, outcomeSchema(markdownViewSchema), 4096, 786432,
    (input, outcome) => outcome.status === 'rejected' || (input.projectId === outcome.value.projectId && input.prdRevisionId === outcome.value.prdRevisionId)),
  'projects.command': entry(projectCommandSchema, projectCommandOutcomeSchema, 786432, 262144, commandCorrelates),
}
export const productEndpointRegistry = Object.freeze(registry)
export type ProductEndpoint = keyof typeof registry
export type ProductInput<E extends ProductEndpoint> = ReadonlyValue<z.infer<typeof registry[E]['inputSchema']>>
export type ProductOutcome<E extends ProductEndpoint> = ReadonlyValue<z.infer<typeof registry[E]['outcomeSchema']>>
export function isProductEndpoint(endpoint: string): endpoint is ProductEndpoint {
  return Object.hasOwn(productEndpointRegistry, endpoint)
}

function parseBounded(endpoint: ProductEndpoint, field: 'input' | 'outcome', value: unknown): unknown {
  const failure = field === 'input' ? 'invalid-request' : 'invalid-outcome'
  if (!isProductEndpoint(endpoint)) throw new ProductProtocolError(failure)
  const definition = productEndpointRegistry[endpoint]
  let bytes: number
  try { bytes = canonicalEnvelopeUtf8Bytes(endpoint, field, value) }
  catch { throw new ProductProtocolError(failure) }
  if (bytes > (field === 'input' ? definition.maxRequestUtf8Bytes : definition.maxOutcomeUtf8Bytes)) {
    throw new ProductProtocolError('limit-exceeded')
  }
  try {
    const schema = field === 'input' ? definition.inputSchema : definition.outcomeSchema
    const parsed = schema.safeParse(value)
    if (!parsed.success) throw new ProductProtocolError(failure)
    return deepFreeze(parsed.data)
  } catch { throw new ProductProtocolError(failure) }
}
export function parseProductInput<E extends ProductEndpoint>(endpoint: E, input: unknown): ProductInput<E> {
  return parseBounded(endpoint, 'input', input) as ProductInput<E>
}
/** Omit input only for Host preflight; callers receiving a response must supply the originating input. */
export function parseProductOutcome<E extends ProductEndpoint>(endpoint: E, outcome: unknown, input?: unknown): ProductOutcome<E> {
  const parsed = parseBounded(endpoint, 'outcome', outcome) as ProductOutcome<E>
  if (input !== undefined) {
    const parsedInput = parseProductInput(endpoint, input)
    const correlate = productEndpointRegistry[endpoint].validateOutcome as (input: unknown, outcome: unknown) => boolean
    if (!correlate(parsedInput, parsed)) throw new ProductProtocolError('invalid-outcome')
  }
  return parsed
}
