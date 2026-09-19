import { describe, expect, it, vi } from 'vitest'
import { ValidationService } from '../../packages/workbench/src/validation/service.js'
import { defaultValidationPlan, type ValidationRunner } from '../../packages/workbench/src/validation/runner.js'
import type { ValidationRecord, ValidationTask } from '../../packages/workbench/src/validation/model.js'
import { makeSmallActiveRecord } from './helpers/synthetic-records.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import type { ActiveProjectRecord } from '../../packages/workbench/src/domain/model.js'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const at = '2026-09-19T10:00:00.000Z'
function setup() {
  const project = makeSmallActiveRecord()
  const baseline = { id: uuid(2), projectId: project.header.id, projectName: project.header.name, researchGoal: null,
    sourceRevisionId: uuid(3), sourceContentHash: '0'.repeat(64), projectVersion: 4, contentVersion: 3, createdAt: at,
    items: [{ rank: 1, requirementId: uuid(4), textSource: { kind: 'generated', draftId: uuid(5), producer: 'ai' },
      title: '提炼需求', painPoint: '整理耗时', description: '分析访谈并保留原文', priority: 'high', humanReason: '', evidence: [] }] }
  let current = { ...project, header: { ...project.header, projectVersion: 6, contentVersion: 3, reviewStarted: true },
    currentBaselineId: baseline.id, baselines: [baseline], prdRevisions: [{ id: uuid(6), projectId: project.header.id,
      sourceRevisionId: uuid(3), baselineId: baseline.id, baselineContentVersion: 3, rendererVersion: 'pmwb-create-prd-v1',
      contentHash: '1'.repeat(64), markdown: '# PRD\n确认需求', createdAt: at }] } as unknown as ActiveProjectRecord
  const table = createFakeDomainTable<string, ValidationRecord>([])
  const runner: ValidationRunner = {
    plan: vi.fn<ValidationRunner['plan']>(async (source, mode) => ({ plan: defaultValidationPlan(source, mode), provenance: { kind: 'harness-model', provider: 'test', model: 'stub' } })),
    execute: vi.fn<ValidationRunner['execute']>(async (_source, mode, plan, input) => mode === 'demo' ? ({ results: [], demo: { title: plan.title, inputLabel: '材料', actionLabel: '模拟', steps: ['输入', '确认'], sampleOutput: '模拟' } })
      : ({ results: (mode === 'poc' ? [{ ...plan.cases[0]!, id: 'poc-input', input: input ?? plan.cases[0]!.input }] : plan.cases)
        .map(test => ({ caseId: test.id, input: test.input, expected: test.expected,
          actual: '{"summary":"result"}', status: 'completed' as const, checks: [], error: null, provenance: { kind: 'harness-model' as const, provider: 'test', model: 'stub' } })), demo: null })),
  }
  const service = new ValidationService(table, { get: async () => current }, runner, { now: () => at })
  let n = 100
  const request = (action: string, version: number, payload?: unknown, commandId = uuid(n++)) => ({ action,
    projectId: project.header.id, taskId: uuid(7), commandId, expectedVersion: version, ...(payload === undefined ? {} : { payload }) })
  const create = async (mode = 'capability') => service.request(request('create', 0, { prdRevisionId: uuid(6), requirementIds: [uuid(4)], mode }))
  const taskOf = (result: Awaited<ReturnType<typeof service.request>>) => { if (!result.ok || !result.task) throw new Error(JSON.stringify(result)); return result.task }
  const confirm = async (task: ValidationTask) => taskOf(await service.request(request('confirm', task.version, { allowModelUse: true })))
  return { service, table, runner, request, create, taskOf, confirm, stale: () => { current = { ...current, header: { ...current.header, contentVersion: 4 } } } }
}

describe('validation chain', () => {
  it('persists plan confirmation, runs, judgment and scoped handoff without duplicate model calls', async () => {
    const s = setup(); const task = await s.confirm(s.taskOf(await s.create()))
    const command = s.request('run', task.version, {})
    const run = s.taskOf(await s.service.request(command))
    expect(run.status).toBe('completed'); expect(run.runs).toHaveLength(1)
    expect(s.taskOf(await s.service.request(command)).runs).toHaveLength(1)
    expect(s.runner.execute).toHaveBeenCalledTimes(1)
    const judged = s.taskOf(await s.service.request(s.request('judge', run.version, { verdict: 'pass', note: '已人工核验' })))
    const output = await s.service.request(s.request('handoff', judged.version))
    expect(output.ok && output.handoff?.markdown).toContain('仅覆盖')
    expect(output.ok && output.handoff?.markdown).toContain('已人工核验')
  })
  it('invalidates confirmation after plan edits and blocks execution/export on stale source', async () => {
    const s = setup(); const task = await s.confirm(s.taskOf(await s.create()))
    const edit = s.taskOf(await s.service.request(s.request('updatePlan', task.version, { ...task.plan, goal: '修改后的目标' })))
    expect(edit.confirmedPlanVersion).toBeNull()
    expect(await s.service.request(s.request('run', edit.version, {}))).toMatchObject({ ok: false, code: 'plan-unconfirmed' })
    const confirmed = await s.confirm(edit); s.stale()
    expect(await s.service.request(s.request('run', confirmed.version, {}))).toMatchObject({ ok: false, code: 'source-stale' })
  })
  it('does not accept a failed model run as a human pass', async () => {
    const s = setup(); vi.mocked(s.runner.execute).mockRejectedValue(new Error('provider-down'))
    const task = await s.confirm(s.taskOf(await s.create()))
    const failed = s.taskOf(await s.service.request(s.request('run', task.version, {})))
    expect(failed.status).toBe('failed')
    expect(await s.service.request(s.request('judge', failed.version, { verdict: 'pass', note: '' }))).toMatchObject({ ok: false, code: 'stage-unavailable' })
  })
  it.each(['demo', 'poc'])('executes the distinct %s output and preserves its exact plan snapshot', async mode => {
    const s = setup(); const task = await s.confirm(s.taskOf(await s.create(mode)))
    const done = s.taskOf(await s.service.request(s.request('run', task.version, mode === 'poc' ? { input: '新的输入材料' } : {})))
    expect(done.runs[0]!.plan).toEqual(task.plan)
    if (mode === 'demo') expect(done.runs[0]!.demo).not.toBeNull()
    else expect(done.runs[0]!.results[0]!.input).toBe('新的输入材料')
  })
  it('keeps a durable run receipt across restart and never repeats an interrupted model request', async () => {
    const s = setup(); const task = await s.confirm(s.taskOf(await s.create()))
    const command = s.request('run', task.version, {})
    await s.service.request(command)
    const stored = s.table.get(task.id)!
    await s.table.put(task.id, { ...stored, task: { ...stored.task, status: 'running', runs: stored.task.runs.map(run => ({ ...run, status: 'running', completedAt: null })) } })
    await s.service.initialize()
    expect(s.taskOf(await s.service.request(command)).status).toBe('failed')
    expect(s.runner.execute).toHaveBeenCalledTimes(1)
  })
  it('rejects reused operation identity and blocks a stale approved export', async () => {
    const s = setup(); const task = await s.confirm(s.taskOf(await s.create()))
    const command = s.request('run', task.version, {})
    const run = s.taskOf(await s.service.request(command))
    expect(await s.service.request({ ...command, payload: { input: 'changed' } })).toMatchObject({ ok: false, code: 'idempotency-key-reused' })
    const judged = s.taskOf(await s.service.request(s.request('judge', run.version, { verdict: 'pass', note: 'approved' })))
    s.stale()
    expect(await s.service.request(s.request('handoff', judged.version))).toMatchObject({ ok: false, code: 'source-stale' })
  })
  it('labels planning failures as a template and keeps a partial verdict out of approved handoff', async () => {
    const s = setup(); vi.mocked(s.runner.plan).mockRejectedValue(new Error('model-down'))
    const draft = s.taskOf(await s.create())
    expect(draft.planProvenance.kind).toBe('template'); expect(draft.lastError).toContain('AI 计划未生成')
    const task = await s.confirm(draft), run = s.taskOf(await s.service.request(s.request('run', task.version, {})))
    const judged = s.taskOf(await s.service.request(s.request('judge', run.version, { verdict: 'partial', note: '需调整' })))
    expect(await s.service.request(s.request('handoff', judged.version))).toMatchObject({ ok: false, code: 'stage-unavailable' })
  })
  it('preserves earlier human judgments after plan editing and a new run', async () => {
    const s = setup(); const task = await s.confirm(s.taskOf(await s.create()))
    const first = s.taskOf(await s.service.request(s.request('run', task.version, {})))
    const judged = s.taskOf(await s.service.request(s.request('judge', first.version, { verdict: 'partial', note: '首轮需补充边界' })))
    const edited = s.taskOf(await s.service.request(s.request('updatePlan', judged.version, { ...judged.plan, goal: '第二轮目标' })))
    const confirmed = await s.confirm(edited)
    const next = s.taskOf(await s.service.request(s.request('run', confirmed.version, {})))
    expect(next.verdict).toBeNull()
    expect(next.runs[0]!.verdict).toMatchObject({ value: 'partial', note: '首轮需补充边界' })
    expect(next.runs[1]!.verdict).toBeNull()
    expect(next.runs[0]!.plan.goal).not.toBe(next.runs[1]!.plan.goal)
  })
  it('deletes validation data after aborting an in-flight run and prevents late result resurrection', async () => {
    const s = setup(); const task = await s.confirm(s.taskOf(await s.create()))
    let release!: (output: Awaited<ReturnType<ValidationRunner['execute']>>) => void
    let runSignal!: AbortSignal
    vi.mocked(s.runner.execute).mockImplementation((_source, _mode, _plan, _input, signal) => {
      runSignal = signal; return new Promise(resolve => { release = resolve })
    })
    const running = s.service.request(s.request('run', task.version, {}))
    await vi.waitFor(() => expect(s.runner.execute).toHaveBeenCalledOnce())
    const deleting = s.service.deleteProject(task.projectId)
    expect(runSignal.aborted).toBe(true)
    release({ results: [], demo: null })
    await deleting
    expect(await running).toMatchObject({ ok: false, code: 'cancelled' })
    expect(s.table.size).toBe(0)
    expect(await s.create()).toMatchObject({ ok: false, code: 'not-found' })
  })
})
