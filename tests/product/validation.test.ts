import { describe, expect, it, vi } from 'vitest'
import { ValidationService } from '../../packages/workbench/src/validation/service.js'
import { defaultValidationPlan, type ValidationRunner } from '../../packages/workbench/src/validation/runner.js'
import { validationRecordSchema, validationHandoffSchema, parseValidationHandoffConfiguration, type ValidationRecord, type ValidationTask } from '../../packages/workbench/src/validation/model.js'
import { makeSmallActiveRecord } from './helpers/synthetic-records.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import type { ActiveProjectRecord } from '../../packages/workbench/src/domain/model.js'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const at = '2026-09-19T10:00:00.000Z'
function setup(title = '提炼需求') {
  const project = makeSmallActiveRecord()
  const baseline = { id: uuid(2), projectId: project.header.id, projectName: project.header.name, researchGoal: null,
    sourceRevisionId: uuid(3), sourceContentHash: '0'.repeat(64), projectVersion: 4, contentVersion: 3, createdAt: at,
    items: [{ rank: 1, requirementId: uuid(4), textSource: { kind: 'generated', draftId: uuid(5), producer: 'ai' },
      title, painPoint: '整理耗时', description: '分析访谈并保留原文', priority: 'high', humanReason: '', evidence: [] }] }
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

async function fillGlobalBytes(s: ReturnType<typeof setup>, bytes: number) {
  const records = [...s.table.entries()].map(([, record]) => record)
  const template = records[0]!, remaining = bytes - records.reduce((sum, record) => sum + Buffer.byteLength(JSON.stringify(record)), 0)
  const count = Math.ceil(remaining / (4 * 1024 * 1024)), size = Math.floor(remaining / count)
  for (let index = 0; index < count; index++) {
    const plan = { ...template.task.plan, cases: Array.from({ length: 20 }, (_, item) => ({ ...template.task.plan.cases[0]!, id: `case-${item}` })) }
    const record: ValidationRecord = { ...template, task: { ...template.task, id: uuid(800 + index), plan,
      runs: Array.from({ length: 6 }, (_, run) => ({ id: uuid(900 + run), planVersion: 1, plan, status: 'completed' as const,
        startedAt: at, completedAt: at, demo: null, error: null, verdict: null,
        results: plan.cases.map(item => ({ caseId: item.id, input: item.input, expected: item.expected, actual: '', status: 'completed' as const,
          checks: [], error: null, provenance: { kind: 'harness-model' as const, provider: 'synthetic', model: 'synthetic' } })) })) } }
    let padding = size + (index === count - 1 ? remaining % count : 0) - Buffer.byteLength(JSON.stringify(record))
    for (const result of record.task.runs.flatMap(run => run.results)) {
      const length = Math.min(padding, 40000)
      result.actual = 'x'.repeat(length); padding -= length
    }
    expect(padding).toBe(0)
    await s.table.put(record.task.id, validationRecordSchema.parse(record))
  }
}
const globalBytes = (s: ReturnType<typeof setup>) => [...s.table.entries()].reduce((sum, [, record]) => sum + Buffer.byteLength(JSON.stringify(record)), 0)

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
  it('exports full long-input history once and reads both current and legacy configuration', async () => {
    const s = setup(), draft = s.taskOf(await s.create())
    const plan = { ...draft.plan, cases: draft.plan.cases.map(item => ({ ...item, input: '长'.repeat(20000) })) }
    let task = await s.confirm(s.taskOf(await s.service.request(s.request('updatePlan', draft.version, plan))))
    for (let round = 0; round < 3; round++) task = s.taskOf(await s.service.request(s.request('run', task.version, {})))
    task = s.taskOf(await s.service.request(s.request('judge', task.version, { verdict: 'pass', note: '人工确认' })))
    const response = await s.service.request(s.request('handoff', task.version))
    expect(response.ok).toBe(true)
    if (!response.ok || !response.handoff) throw new Error('missing handoff')
    const config = JSON.parse(response.handoff.configuration)
    expect(config).not.toHaveProperty('run')
    const parsed = parseValidationHandoffConfiguration(response.handoff.configuration)
    expect(parsed.task.runs).toHaveLength(3)
    expect(parsed.run.results[0]!.input).toBe('长'.repeat(20000))
    expect(parsed.run.id).toBe(task.runs.at(-1)!.id)
    const legacy = parseValidationHandoffConfiguration(JSON.stringify({ format: 'pmwb-validation-handoff-v1', task, run: task.runs.at(-1) }))
    expect(legacy.run).toEqual(parsed.run)
    expect(validationHandoffSchema.safeParse(response.handoff).success).toBe(true)
  })
  it('rejects an over-budget next run before execution while the approved history remains exportable', async () => {
    const s = setup(), draft = s.taskOf(await s.create())
    const plan = { ...draft.plan, cases: draft.plan.cases.map(item => ({ ...item, input: 'x'.repeat(20000) })) }
    let task = await s.confirm(s.taskOf(await s.service.request(s.request('updatePlan', draft.version, plan))))
    task = s.taskOf(await s.service.request(s.request('run', task.version, {})))
    task = s.taskOf(await s.service.request(s.request('judge', task.version, { verdict: 'pass', note: '' })))
    const stored = s.table.get(task.id)!, exemplar = task.runs[0]!
    const runs = Array.from({ length: 16 }, (_, index) => ({ ...exemplar, id: index === 15 ? exemplar.id : uuid(500 + index),
      results: exemplar.results.map(result => ({ ...result, actual: 'y'.repeat(40000) })) }))
    await s.table.put(task.id, validationRecordSchema.parse({ ...stored, task: { ...task, runs } }))
    const bytes = Buffer.byteLength(JSON.stringify(s.table.get(task.id)))
    expect(bytes).toBeGreaterThan(3 * 1024 * 1024)
    expect(bytes).toBeLessThan(4 * 1024 * 1024)
    const calls = vi.mocked(s.runner.execute).mock.calls.length
    expect(await s.service.request(s.request('run', task.version, {}))).toMatchObject({ ok: false, code: 'limit-exceeded' })
    expect(s.runner.execute).toHaveBeenCalledTimes(calls)
    const response = await s.service.request(s.request('handoff', task.version))
    expect(response.ok).toBe(true)
    if (!response.ok || !response.handoff) throw new Error('missing handoff')
    expect(Buffer.byteLength(response.handoff.configuration)).toBeLessThanOrEqual(4 * 1024 * 1024)
    expect(parseValidationHandoffConfiguration(response.handoff.configuration).task.runs).toHaveLength(16)
  })
  it('checkpoints each finished case before abort and never replays the interrupted command', async () => {
    const s = setup(), task = await s.confirm(s.taskOf(await s.create()))
    const original = vi.mocked(s.runner.execute).getMockImplementation()!
    const abort = new AbortController()
    vi.mocked(s.runner.execute).mockImplementationOnce(async (source, mode, plan, input, signal, onProgress) => {
      const output = await original(source, mode, plan, input, signal)
      await onProgress?.({ results: output.results.slice(0, 1), demo: null })
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }))
      return output
    })
    const command = s.request('run', task.version, {})
    const pending = s.service.request(command, abort.signal)
    await vi.waitFor(() => expect(s.table.get(task.id)!.task.runs[0]!.results).toHaveLength(1))
    expect(s.table.get(task.id)!.task.runs[0]!.status).toBe('running')
    abort.abort()
    const failed = s.taskOf(await pending)
    expect(failed.status).toBe('failed')
    expect(failed.runs[0]!.results[0]!.actual).toBe('{"summary":"result"}')
    await s.service.initialize()
    expect(s.taskOf(await s.service.request(command)).runs[0]!.results).toHaveLength(1)
    expect(s.runner.execute).toHaveBeenCalledTimes(1)
    const rerun = s.taskOf(await s.service.request(s.request('run', failed.version, {})))
    expect(rerun.runs).toHaveLength(2)
    expect(rerun.runs[0]!.results).toHaveLength(1)
    expect(rerun.runs[1]!.results).toHaveLength(3)
  })
  it.each(['demo', 'capability', 'poc'])('accepts a 2000 code point source title in %s without splitting emoji', async mode => {
    const title = '😀'.repeat(1999) + '终', s = setup(title)
    const task = s.taskOf(await s.create(mode))
    expect(task.requirementTitles).toEqual([title])
    expect(task.plan.title.length).toBeLessThanOrEqual(160)
    expect(task.plan.title).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u)
    expect(task.plan.goal).toContain(title)
    expect(task.planProvenance.kind).toBe('harness-model')
  })

  it('preserves the source title verbatim including allowed outer whitespace', async () => {
    const title = ' ' + '😀'.repeat(1998) + ' ', s = setup(title)
    expect(s.taskOf(await s.create()).requirementTitles).toEqual([title])
  })
  it('admits twenty ordinary cases within the output reservation budget', async () => {
    const s = setup(), draft = s.taskOf(await s.create())
    const plan = { ...draft.plan, cases: Array.from({ length: 20 }, (_, index) => ({ id: `case-${index}`, input: '合成输入', expected: '合成预期' })) }
    const task = await s.confirm(s.taskOf(await s.service.request(s.request('updatePlan', draft.version, plan))))
    const result = s.taskOf(await s.service.request(s.request('run', task.version, {})))
    expect(result.status).toBe('completed')
    expect(result.runs[0]!.results).toHaveLength(20)
  })
  it('retains completed output when the checkpoint write fails and stops the rest of the round', async () => {
    const s = setup(), task = await s.confirm(s.taskOf(await s.create()))
    const original = vi.mocked(s.runner.execute).getMockImplementation()!
    let laterCasesStarted = false
    vi.mocked(s.runner.execute).mockImplementationOnce(async (source, mode, plan, input, signal, onProgress) => {
      const output = await original(source, mode, plan, input, signal)
      s.table.rejectNextWrite(new Error('disk-full'))
      await onProgress?.({ results: output.results.slice(0, 1), demo: null })
      laterCasesStarted = true
      return output
    })
    const command = s.request('run', task.version, {})
    const result = s.taskOf(await s.service.request(command))
    expect(result.status).toBe('failed')
    expect(result.runs[0]!.results).toHaveLength(1)
    expect(laterCasesStarted).toBe(false)
    expect(s.taskOf(await s.service.request(command)).runs[0]!.results).toHaveLength(1)
    expect(s.runner.execute).toHaveBeenCalledOnce()
  })
  it('reads and recovers legacy running records without dropping checkpoint results', async () => {
    const s = setup(), task = await s.confirm(s.taskOf(await s.create()))
    const command = s.request('run', task.version, {})
    await s.service.request(command)
    const stored = s.table.get(task.id)!, { verdict: _verdict, ...legacyRun } = stored.task.runs[0]!
    const legacyRecord = { ...stored, task: { ...stored.task, status: 'running', runs: [{ ...legacyRun, status: 'running',
      completedAt: null, results: legacyRun.results.slice(0, 1) }] } } as unknown as ValidationRecord
    await s.table.put(task.id, legacyRecord)
    await s.service.initialize()
    const recovered = s.taskOf(await s.service.request(command))
    expect(recovered.status).toBe('failed')
    expect(recovered.runs[0]!.results).toHaveLength(1)
    expect(recovered.runs[0]!.verdict).toBeNull()
    expect(s.runner.execute).toHaveBeenCalledOnce()
  })
  it('uses UTF-8 bytes rather than JavaScript string length for the handoff limit', () => {
    const atLimit = '😀'.repeat(1024 * 1024)
    expect(validationHandoffSchema.safeParse({ filename: 'package.md', markdown: '报告', configuration: atLimit }).success).toBe(true)
    expect(validationHandoffSchema.safeParse({ filename: 'package.md', markdown: '报告', configuration: atLimit + 'x' }).success).toBe(false)
  })

  it('shortens display titles at a complete joined-emoji boundary', async () => {
    const family = '👨‍👩‍👧‍👦', s = setup(family.repeat(285))
    const task = s.taskOf(await s.create())
    expect(task.plan.title.split(' · ')[0]!.replaceAll(family, '')).toBe('…')
    expect(task.requirementTitles[0]).toBe(family.repeat(285))
  })

  it('serializes capacity checks with writes so simultaneous edits cannot exceed the global budget', async () => {
    const s = setup(), first = await s.confirm(s.taskOf(await s.create())), original = s.table.get(first.id)!
    const second = { ...original.task, id: uuid(71) }
    await s.table.put(second.id, { ...original, task: second })
    await fillGlobalBytes(s, 32 * 1024 * 1024 - 25000)
    let release!: () => void
    s.table.deferNextWrite(new Promise<void>(resolve => { release = resolve }))
    const plan = { ...first.plan, cases: first.plan.cases.map((item, index) => index === 0 ? { ...item, input: 'x'.repeat(20000) } : item) }
    const beforeWrites = s.table.writeCount
    const firstPending = s.service.request(s.request('updatePlan', first.version, plan))
    const secondPending = s.service.request({ ...s.request('updatePlan', second.version, plan), taskId: second.id })
    await vi.waitFor(() => expect(s.table.writeCount).toBeGreaterThan(beforeWrites))
    release()
    const results = await Promise.all([firstPending, secondPending])
    expect(results.filter(result => result.ok)).toHaveLength(1)
    expect(results.find(result => !result.ok)).toMatchObject({ code: 'limit-exceeded' })
    expect(globalBytes(s)).toBeLessThanOrEqual(32 * 1024 * 1024)
  })
  it.each(['completed', 'cancelled', 'save-failed'] as const)('reserves in-flight output and releases it after %s', async ending => {
    const s = setup(), first = await s.confirm(s.taskOf(await s.create())), original = s.table.get(first.id)!
    const second = { ...original.task, id: uuid(72) }
    await s.table.put(second.id, { ...original, task: second })
    await fillGlobalBytes(s, 32 * 1024 * 1024 - 700000)
    const execute = vi.mocked(s.runner.execute).getMockImplementation()!, controller = new AbortController()
    let release!: () => void
    vi.mocked(s.runner.execute).mockImplementationOnce(async (source, mode, plan, input, signal, checkpoint) => {
      const output = await execute(source, mode, plan, input, signal)
      await new Promise<void>((resolve, reject) => { release = resolve; signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true }) })
      if (ending === 'save-failed') {
        s.table.rejectNextWrite(new Error('disk-full')); s.table.rejectNextWrite(new Error('disk-full'))
        await checkpoint?.({ results: output.results.slice(0, 1), demo: null })
      }
      return output
    })
    const firstPending = s.service.request(s.request('run', first.version, {}), controller.signal)
    await vi.waitFor(() => expect(s.runner.execute).toHaveBeenCalledOnce())
    const secondCommand = { ...s.request('run', second.version, {}), taskId: second.id }
    const rejected = await s.service.request(secondCommand)
    const callsWhileRunning = vi.mocked(s.runner.execute).mock.calls.length
    if (ending === 'cancelled') controller.abort()
    else release()
    const ended = await firstPending
    expect(rejected).toMatchObject({ ok: false, code: 'limit-exceeded' })
    expect(callsWhileRunning).toBe(1)
    if (ending === 'save-failed') expect(ended).toMatchObject({ ok: false, code: 'storage-failed' })
    else expect(s.taskOf(ended).status).toBe(ending === 'completed' ? 'completed' : 'failed')
    expect(s.taskOf(await s.service.request(secondCommand)).status).toBe('completed')
    expect(s.runner.execute).toHaveBeenCalledTimes(2)
    expect(globalBytes(s)).toBeLessThanOrEqual(32 * 1024 * 1024)
  })
  it.each([0, 512])('recovers interrupted records without adding bytes when global capacity is exceeded by %i', async excess => {
    const s = setup(), first = await s.confirm(s.taskOf(await s.create()))
    await s.service.request(s.request('run', first.version, {}))
    const record = s.table.get(first.id)!, result = record.task.runs[0]!.results[0]!
    await s.table.put(first.id, { ...record, task: { ...record.task, status: 'running', runs: record.task.runs.map(run => ({ ...run, status: 'running', completedAt: null })) } })
    await fillGlobalBytes(s, 32 * 1024 * 1024 + excess)
    const before = globalBytes(s)
    await expect(s.service.initialize()).resolves.toBeUndefined()
    const recovered = s.table.get(first.id)!
    expect(recovered.task.status).toBe('failed')
    expect(recovered.task.runs[0]!.status).toBe('failed')
    expect(recovered.task.runs[0]!.results[0]).toEqual(result)
    expect(recovered.receipts).toEqual(record.receipts)
    expect(globalBytes(s)).toBeLessThanOrEqual(before)
  })

  it('keeps unrelated edits inside the capacity left after an active run reservation', async () => {
    const s = setup(), first = await s.confirm(s.taskOf(await s.create())), original = s.table.get(first.id)!
    const second = { ...original.task, id: uuid(73) }
    await s.table.put(second.id, { ...original, task: second })
    await fillGlobalBytes(s, 32 * 1024 * 1024 - 700000)
    const controller = new AbortController()
    vi.mocked(s.runner.execute).mockImplementationOnce(async (_source, _mode, _plan, _input, signal) =>
      new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('cancelled')), { once: true })))
    const running = s.service.request(s.request('run', first.version, {}), controller.signal)
    await vi.waitFor(() => expect(s.runner.execute).toHaveBeenCalledOnce())
    const command = { ...s.request('updatePlan', second.version, { ...second.plan,
      cases: second.plan.cases.map(item => ({ ...item, input: '长'.repeat(20000) })) }), taskId: second.id }
    const denied = await s.service.request(command)
    controller.abort(); await running
    expect(denied).toMatchObject({ ok: false, code: 'limit-exceeded' })
    expect(s.taskOf(await s.service.request(command)).plan.cases[0]!.input).toBe('长'.repeat(20000))
    expect(globalBytes(s)).toBeLessThanOrEqual(32 * 1024 * 1024)
  })
  it('allows concurrent model work when both output reservations fit', async () => {
    const s = setup(), first = await s.confirm(s.taskOf(await s.create())), original = s.table.get(first.id)!
    const second = { ...original.task, id: uuid(74) }
    await s.table.put(second.id, { ...original, task: second })
    const execute = vi.mocked(s.runner.execute).getMockImplementation()!, releases: Array<() => void> = []
    vi.mocked(s.runner.execute).mockImplementation(async (source, mode, plan, input, signal) => {
      await new Promise<void>(resolve => { releases.push(resolve) })
      return execute(source, mode, plan, input, signal)
    })
    const firstPending = s.service.request(s.request('run', first.version, {}))
    const secondPending = s.service.request({ ...s.request('run', second.version, {}), taskId: second.id })
    await vi.waitFor(() => expect(releases).toHaveLength(2))
    releases.forEach(release => release())
    expect((await Promise.all([firstPending, secondPending])).map(result => s.taskOf(result).status)).toEqual(['completed', 'completed'])
  })
  it('does not retain a capacity reservation or receipt when admission itself cannot be saved', async () => {
    const s = setup(), first = await s.confirm(s.taskOf(await s.create())), original = s.table.get(first.id)!
    const second = { ...original.task, id: uuid(75) }
    await s.table.put(second.id, { ...original, task: second })
    await fillGlobalBytes(s, 32 * 1024 * 1024 - 700000)
    s.table.rejectNextWrite(new Error('disk-full'))
    expect(await s.service.request(s.request('run', first.version, {}))).toMatchObject({ ok: false, code: 'storage-failed' })
    expect(s.table.get(first.id)!.receipts).toEqual(original.receipts)
    expect(s.table.get(first.id)!.task.runs).toHaveLength(0)
    expect(s.runner.execute).not.toHaveBeenCalled()
    const secondCommand = { ...s.request('run', second.version, {}), taskId: second.id }
    expect(s.taskOf(await s.service.request(secondCommand)).status).toBe('completed')
    expect(s.runner.execute).toHaveBeenCalledOnce()
  })

})
