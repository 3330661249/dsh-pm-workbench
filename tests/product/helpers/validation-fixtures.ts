import { validationTaskSchema, validationRunSchema, type ValidationTask } from '../../../packages/workbench/src/validation/model.js'

export const validationId = (n: number) => `40000000-0000-4000-8000-${n.toString().padStart(12, '0')}`
export const validationPlan = { title: '验证访谈需求提炼', goal: '需求有原文依据', criteria: ['不能伪造引用'],
  cases: [1, 2, 3].map(n => ({ id: `case-${n}`, input: `虚构访谈材料 ${n}`, expected: `准确提炼需求 ${n}` })) }
export const validationRun = validationRunSchema.parse({ id: validationId(8), planVersion: 1, plan: validationPlan,
  status: 'completed', startedAt: '2026-09-19T10:00:00.000Z', completedAt: '2026-09-19T10:01:00.000Z', error: null, demo: null,
  results: [{ caseId: 'case-1', input: '虚构材料', expected: '引用原文', actual: '<script>unsafe()</script>实际输出', status: 'completed', checks: [{ label: '输出结构正确', passed: true }], error: null,
    provenance: { kind: 'harness-model', provider: 'fixture-provider', model: 'fixture-model' } }] })
export function makeValidationTask(patch: Partial<ValidationTask> = {}): ValidationTask {
  return validationTaskSchema.parse({ id: validationId(2), projectId: validationId(1), version: 1, mode: 'capability', prdRevisionId: validationId(3),
    prdContentHash: 'a'.repeat(64), baselineId: validationId(4), baselineContentVersion: 2, requirementIds: [validationId(5)], requirementTitles: ['提炼有依据的需求'],
    status: 'draft', plan: validationPlan, planVersion: 1, confirmedPlanVersion: null, planProvenance: { kind: 'harness-model', provider: 'fixture-provider', model: 'fixture-model' },
    allowModelUse: false, runs: [], verdict: null, createdAt: '2026-09-19T10:00:00.000Z', updatedAt: '2026-09-19T10:00:00.000Z', lastError: null, stale: false, ...patch })
}
