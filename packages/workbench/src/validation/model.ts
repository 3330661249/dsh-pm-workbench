import { z } from 'zod'

export const VALIDATION_RPC_CHANNEL = '/dsh-pm-validation-v1' as const
export const VALIDATION_RPC_ENDPOINT = 'request' as const
const id = z.string().uuid()
const text = (max = 6000) => z.string().trim().min(1).max(max)
export const validationModeSchema = z.enum(['demo', 'capability', 'poc'])
export type ValidationMode = z.infer<typeof validationModeSchema>
export const validationCaseSchema = z.strictObject({ id: text(80), input: text(20000), expected: text(6000) })
export const validationPlanSchema = z.strictObject({
  title: text(160), goal: text(), criteria: z.array(text(1000)).min(1).max(12),
  cases: z.array(validationCaseSchema).min(3).max(20),
}).refine(plan => new Set(plan.cases.map(item => item.id)).size === plan.cases.length, 'duplicate-case-id')
export type ValidationPlan = z.infer<typeof validationPlanSchema>
export const validationProvenanceSchema = z.strictObject({
  kind: z.enum(['harness-model', 'controlled-demo', 'template']), provider: z.string().max(200), model: z.string().max(200),
})
export type ValidationProvenance = z.infer<typeof validationProvenanceSchema>
export const validationResultSchema = z.strictObject({
  caseId: text(80), input: text(20000), expected: text(6000), actual: z.string().max(40000),
  status: z.enum(['completed', 'failed']), checks: z.array(z.strictObject({ label: text(200), passed: z.boolean() })).max(30),
  error: z.string().max(500).nullable(), provenance: validationProvenanceSchema,
})
export const demoConfigSchema = z.strictObject({ title: text(160), inputLabel: text(160), actionLabel: text(80),
  steps: z.array(text(300)).min(1).max(8), sampleOutput: text(12000) })
export const verdictSchema = z.enum(['pass', 'partial', 'fail', 'hold'])
export type ValidationVerdict = z.infer<typeof verdictSchema>
const humanVerdictSchema = z.strictObject({ value: verdictSchema, note: z.string().max(6000), runId: id, judgedAt: z.string() })
export const validationRunSchema = z.strictObject({
  id, planVersion: z.number().int().positive(), plan: validationPlanSchema,
  status: z.enum(['running', 'completed', 'failed']), startedAt: z.string(), completedAt: z.string().nullable(),
  results: z.array(validationResultSchema).max(20), demo: demoConfigSchema.nullable(), error: z.string().max(500).nullable(),
  verdict: humanVerdictSchema.nullable().default(null),
})
export type ValidationRun = z.infer<typeof validationRunSchema>
export const validationTaskSchema = z.strictObject({
  id, projectId: id, version: z.number().int().positive(), mode: validationModeSchema,
  prdRevisionId: id, prdContentHash: z.string().regex(/^[a-f0-9]{64}$/), baselineId: id,
  baselineContentVersion: z.number().int().nonnegative(), requirementIds: z.array(id).min(1).max(100),
  requirementTitles: z.array(text(1000)).min(1).max(100),
  status: z.enum(['draft', 'confirmed', 'running', 'completed', 'failed', 'judged']),
  plan: validationPlanSchema, planVersion: z.number().int().positive(), confirmedPlanVersion: z.number().int().positive().nullable(),
  planProvenance: validationProvenanceSchema, allowModelUse: z.boolean(),
  runs: z.array(validationRunSchema).max(20),
  verdict: humanVerdictSchema.nullable(),
  createdAt: z.string(), updatedAt: z.string(), lastError: z.string().max(500).nullable(), stale: z.boolean(),
})
export type ValidationTask = z.infer<typeof validationTaskSchema>
export const validationRecordSchema = z.strictObject({
  task: validationTaskSchema,
  receipts: z.array(z.strictObject({ commandId: id, requestHash: z.string().length(64) })).max(300),
})
export type ValidationRecord = z.infer<typeof validationRecordSchema>
const mutation = { projectId: id, taskId: id, commandId: id, expectedVersion: z.number().int().positive() }
export const validationRequestSchema = z.discriminatedUnion('action', [
  z.strictObject({ action: z.literal('list'), projectId: id }),
  z.strictObject({ ...mutation, action: z.literal('create'), expectedVersion: z.literal(0), payload: z.strictObject({
    prdRevisionId: id, requirementIds: z.array(id).min(1).max(100).refine(ids => new Set(ids).size === ids.length), mode: validationModeSchema,
  }) }),
  z.strictObject({ ...mutation, action: z.literal('updatePlan'), payload: validationPlanSchema }),
  z.strictObject({ ...mutation, action: z.literal('confirm'), payload: z.strictObject({ allowModelUse: z.boolean() }) }),
  z.strictObject({ ...mutation, action: z.literal('run'), payload: z.strictObject({ input: text(20000).optional() }) }),
  z.strictObject({ ...mutation, action: z.literal('judge'), payload: z.strictObject({ verdict: verdictSchema, note: z.string().max(6000) }) }),
  z.strictObject({ ...mutation, action: z.literal('handoff') }),
])
export type ValidationRequest = z.infer<typeof validationRequestSchema>
export const validationHandoffSchema = z.strictObject({ filename: text(200), markdown: text(400000), configuration: text(300000) })
export type ValidationHandoff = z.infer<typeof validationHandoffSchema>
export const validationResponseSchema = z.discriminatedUnion('ok', [
  z.strictObject({ ok: z.literal(true), tasks: z.array(validationTaskSchema).max(50), task: validationTaskSchema.nullable(), handoff: validationHandoffSchema.nullable() }),
  z.strictObject({ ok: z.literal(false), code: z.enum(['invalid-request', 'not-found', 'version-conflict', 'idempotency-key-reused', 'source-stale', 'plan-unconfirmed', 'stage-unavailable', 'model-not-authorized', 'run-failed', 'limit-exceeded', 'storage-failed', 'cancelled']), message: z.string().max(500) }),
])
export type ValidationResponse = z.infer<typeof validationResponseSchema>
export type ValidationErrorCode = Extract<ValidationResponse, { ok: false }>['code']
