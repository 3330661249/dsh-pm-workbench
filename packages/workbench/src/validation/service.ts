import { createHash, randomUUID } from 'node:crypto'
import type { KvTable } from '@deepseek-ai/dsh-storage-domain'
import type { ProjectRepository } from '../application/project-repository.js'
import { projectIdSchema } from '../domain/ids.js'
import type { ActiveProjectRecord } from '../domain/model.js'
import { canonicalJson } from '../protocol/canonical-json.js'
import { defaultValidationPlan, type ValidationRunner, type ValidationSource } from './runner.js'
import {
  validationRecordSchema, validationRequestSchema, validationResponseSchema,
  type ValidationErrorCode, type ValidationRecord, type ValidationRequest, type ValidationResponse, type ValidationTask,
  type ValidationHandoff, type ValidationRun,
} from './model.js'

type Mutation = Exclude<ValidationRequest, { action: 'list' }>
const messages: Record<ValidationErrorCode, string> = {
  'invalid-request': '操作内容不完整或格式不符合要求。', 'not-found': '未找到对应项目、PRD 或验证任务。',
  'version-conflict': '内容已更新，请刷新后重试。', 'idempotency-key-reused': '操作标识已用于另一项操作，请刷新。',
  'source-stale': '需求或 PRD 来源已更新，请基于当前版本新建验证任务。',
  'plan-unconfirmed': '请先确认当前验证计划。', 'stage-unavailable': '当前状态不能执行此操作。',
  'model-not-authorized': '执行前请确认允许使用当前模型处理测试输入。',
  'run-failed': '验证执行未完成，请查看记录后决定是否重试。', 'limit-exceeded': '验证内容或历史记录已达到当前上限。',
  'storage-failed': '保存未完成，请刷新核对记录。', 'cancelled': '执行已中断，请查看记录后决定是否重试。',
}
class ValidationFailure extends Error { constructor(readonly code: ValidationErrorCode) { super(code) } }
const fail = (code: ValidationErrorCode): never => { throw new ValidationFailure(code) }
const accepted = (task: ValidationTask | null = null, tasks: ValidationTask[] = [], handoff: ValidationHandoff | null = null): ValidationResponse => ({ ok: true, task, tasks, handoff })
const hash = (value: unknown) => createHash('sha256').update(canonicalJson(value)).digest('hex')

/** A separate durable aggregate leaves existing project histories untouched. */
export class ValidationService {
  private readonly queues = new Map<string, Promise<unknown>>()
  private readonly pending = new Set<Promise<unknown>>()
  private readonly creating = new Map<string, string>()
  private readonly projectOperations = new Map<string, Set<Promise<unknown>>>()
  private readonly projectControllers = new Map<string, Set<AbortController>>()
  private readonly deletingProjects = new Set<string>()
  private closing = false
  constructor(private readonly table: KvTable<string, ValidationRecord>, private readonly projects: Pick<ProjectRepository, 'get'>,
    private readonly runner: ValidationRunner, private readonly clock = { now: () => new Date().toISOString() }) {}

  async initialize(): Promise<void> {
    // A process restart cannot know whether an interrupted provider request completed.
    // Preserve its receipt so refreshing/replaying never starts another paid call.
    for (const [id, record] of this.table.entries()) {
      const owner = await this.projects.get(projectIdSchema.parse(record.task.projectId))
      if (!owner || owner.kind !== 'active') { await this.table.delete(id); continue }
      if (record.task.status === 'draft' && record.task.planProvenance.kind === 'template' && record.task.lastError?.startsWith('正在生成')) {
        await this.save({ ...record, task: { ...record.task, version: record.task.version + 1,
          lastError: '计划生成在服务重启时中断；当前为可编辑通用模板，请修改后确认。', updatedAt: this.clock.now() } })
        continue
      }
      if (record.task.status !== 'running') continue
      const task = record.task
      await this.save({ ...record, task: { ...task, version: task.version + 1, status: 'failed', updatedAt: this.clock.now(),
        lastError: '上次运行在服务重启前中断；结果未知。请检查后显式重试。',
        runs: task.runs.map(run => run.status === 'running' ? { ...run, status: 'failed', completedAt: this.clock.now(), error: '运行中断，结果未知' } : run) } })
    }
  }

  async close(): Promise<void> { this.closing = true; await Promise.allSettled([...this.pending]) }

  async deleteProject(projectId: string): Promise<void> {
    this.deletingProjects.add(projectId)
    for (const controller of this.projectControllers.get(projectId) ?? []) controller.abort()
    await Promise.allSettled([...(this.projectOperations.get(projectId) ?? [])])
    for (const [id, record] of this.table.entries()) if (record.task.projectId === projectId) await this.table.delete(id)
  }

  async request(raw: unknown, signal = new AbortController().signal): Promise<ValidationResponse> {
    try {
      const parsed = validationRequestSchema.safeParse(raw)
      if (!parsed.success) return { ok: false, code: 'invalid-request', message: messages['invalid-request'] }
      const input = parsed.data
      if (this.closing || signal.aborted) fail('cancelled')
      if (this.deletingProjects.has(input.projectId)) fail('not-found')
      if (input.action === 'list') {
        const project = await this.project(input.projectId)
        const tasks = [...this.table.entries()].map(([, record]) => record.task).filter(task => task.projectId === input.projectId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(task => this.view(task, project))
        return validationResponseSchema.parse(accepted(null, tasks))
      }
      const before = this.queues.get(input.taskId) ?? Promise.resolve()
      const controller = new AbortController()
      const controllers = this.projectControllers.get(input.projectId) ?? new Set<AbortController>()
      controllers.add(controller); this.projectControllers.set(input.projectId, controllers)
      const runSignal = AbortSignal.any([signal, controller.signal])
      const operation = before.catch(() => undefined).then(() => this.mutate(input, runSignal))
      this.queues.set(input.taskId, operation); this.pending.add(operation)
      const projectPending = this.projectOperations.get(input.projectId) ?? new Set<Promise<unknown>>()
      projectPending.add(operation); this.projectOperations.set(input.projectId, projectPending)
      try { return validationResponseSchema.parse(await operation) }
      finally {
        this.pending.delete(operation); projectPending.delete(operation); controllers.delete(controller)
        if (!projectPending.size) this.projectOperations.delete(input.projectId)
        if (!controllers.size) this.projectControllers.delete(input.projectId)
        if (this.queues.get(input.taskId) === operation) this.queues.delete(input.taskId)
      }
    } catch (error) {
      const code = error instanceof ValidationFailure ? error.code : signal.aborted ? 'cancelled' : 'storage-failed'
      return { ok: false, code, message: messages[code] }
    }
  }

  private async project(projectId: string): Promise<ActiveProjectRecord> {
    const record = await this.projects.get(projectIdSchema.parse(projectId))
    if (!record || record.kind !== 'active') return fail('not-found')
    return record
  }

  private source(project: ActiveProjectRecord, prdRevisionId: string, requirementIds: readonly string[]): ValidationSource {
    const prd = project.prdRevisions.find(item => item.id === prdRevisionId)
    const baseline = project.baselines.find(item => item.id === prd?.baselineId)
    if (!prd || !baseline || requirementIds.some(id => !baseline.items.some(item => item.requirementId === id))) return fail('not-found')
    return { prd, baseline, requirementIds }
  }

  private view(task: ValidationTask, project: ActiveProjectRecord): ValidationTask {
    const prd = project.prdRevisions.find(item => item.id === task.prdRevisionId)
    const baseline = project.baselines.find(item => item.id === task.baselineId)
    const stale = !prd || !baseline || prd.contentHash !== task.prdContentHash || prd.baselineId !== task.baselineId
      || baseline.contentVersion !== task.baselineContentVersion || project.header.contentVersion !== task.baselineContentVersion
      || project.currentBaselineId !== task.baselineId
    return structuredClone({ ...task, stale })
  }

  private async save(record: ValidationRecord): Promise<void> {
    if (this.deletingProjects.has(record.task.projectId)) fail('cancelled')
    const valid = validationRecordSchema.parse(record)
    if (Buffer.byteLength(JSON.stringify(valid)) > 4 * 1024 * 1024) fail('limit-exceeded')
    const total = [...this.table.entries()].reduce((sum, [id, stored]) => sum + (id === valid.task.id ? 0 : Buffer.byteLength(JSON.stringify(stored))), 0)
    if (total + Buffer.byteLength(JSON.stringify(valid)) > 32 * 1024 * 1024) fail('limit-exceeded')
    await this.table.put(valid.task.id, structuredClone(valid))
  }

  private async mutate(input: Mutation, signal: AbortSignal): Promise<ValidationResponse> {
    if (this.closing || signal.aborted) return fail('cancelled')
    const project = await this.project(input.projectId)
    const previous = this.table.get(input.taskId)
    if (previous && previous.task.projectId !== input.projectId) return fail('not-found')
    const requestHash = hash(input)
    const receipt = previous?.receipts.find(item => item.commandId === input.commandId)
    if (receipt) {
      if (receipt.requestHash !== requestHash) return fail('idempotency-key-reused')
      return accepted(this.view(previous!.task, project))
    }
    if (input.action === 'create') {
      if (previous) return fail('version-conflict')
      return this.create(input, project, requestHash, signal)
    }
    if (!previous) return fail('not-found')
    if (previous.task.version !== input.expectedVersion) return fail('version-conflict')
    const task = this.view(previous.task, project)
    if (task.stale) return fail('source-stale')
    if (task.status === 'running') return fail('stage-unavailable')
    if (previous.receipts.length >= 300) return fail('limit-exceeded')
    const source = this.source(project, task.prdRevisionId, task.requirementIds)
    const changed = (patch: Partial<ValidationTask>): ValidationRecord => ({
      task: { ...task, ...patch, version: task.version + 1, updatedAt: this.clock.now() },
      receipts: [...previous.receipts, { commandId: input.commandId, requestHash }],
    })
    let next: ValidationRecord
    switch (input.action) {
      case 'updatePlan':
        next = changed({ plan: input.payload, planVersion: task.planVersion + 1, confirmedPlanVersion: null,
          allowModelUse: false, verdict: null, status: 'draft', lastError: null })
        break
      case 'confirm':
        if (task.mode !== 'demo' && !input.payload.allowModelUse) return fail('model-not-authorized')
        next = changed({ confirmedPlanVersion: task.planVersion, allowModelUse: input.payload.allowModelUse,
          status: 'confirmed', verdict: null, lastError: null })
        break
      case 'run': {
        if (task.confirmedPlanVersion !== task.planVersion) return fail('plan-unconfirmed')
        if (task.mode !== 'demo' && !task.allowModelUse) return fail('model-not-authorized')
        if (task.runs.length >= 20) return fail('limit-exceeded')
        const run: ValidationRun = { id: randomUUID(), planVersion: task.planVersion, plan: structuredClone(task.plan), status: 'running',
          startedAt: this.clock.now(), completedAt: null, results: [], demo: null, error: null, verdict: null }
        next = changed({ status: 'running', runs: [...task.runs, run], verdict: null, lastError: null })
        // Persist admission and receipt before making any external model request.
        await this.save(next)
        try {
          const output = await this.runner.execute(source, task.mode, run.plan, input.payload.input, signal)
          signal.throwIfAborted()
          const expectedIds = task.mode === 'poc' ? ['poc-input'] : run.plan.cases.map(item => item.id)
          const completed = task.mode === 'demo' ? output.demo !== null && output.results.length === 0
            : output.results.length === expectedIds.length && new Set(output.results.map(item => item.caseId)).size === expectedIds.length
              && output.results.every(item => item.status === 'completed' && item.provenance.kind === 'harness-model' && expectedIds.includes(item.caseId))
          const ended: ValidationRun = { ...run, ...output, status: completed ? 'completed' : 'failed', completedAt: this.clock.now(),
            error: completed ? null : messages['run-failed'] }
          next = { ...next, task: { ...next.task, version: next.task.version + 1, status: ended.status, updatedAt: this.clock.now(),
            lastError: ended.error, runs: [...task.runs, ended] } }
          await this.save(next)
        } catch {
          next = { ...next, task: { ...next.task, version: next.task.version + 1, status: 'failed', updatedAt: this.clock.now(),
            lastError: signal.aborted ? messages.cancelled : messages['run-failed'],
            runs: [...task.runs, { ...run, status: 'failed', completedAt: this.clock.now(), error: signal.aborted ? messages.cancelled : messages['run-failed'] }] } }
          await this.save(next)
        }
        return accepted(this.view(next.task, await this.project(input.projectId)))
      }
      case 'judge': {
        const run = task.runs.at(-1)
        if (!run || run.status !== 'completed' || run.planVersion !== task.planVersion
          || task.confirmedPlanVersion !== task.planVersion) return fail('stage-unavailable')
        const verdict = { value: input.payload.verdict, note: input.payload.note, runId: run.id, judgedAt: this.clock.now() }
        next = changed({ status: 'judged', verdict, runs: task.runs.map(item => item.id === run.id ? { ...item, verdict } : item), lastError: null })
        break
      }
      case 'handoff': {
        const run = task.runs.at(-1)
        if (task.verdict?.value !== 'pass' || !run || run.status !== 'completed' || task.verdict.runId !== run.id
          || run.planVersion !== task.planVersion || task.confirmedPlanVersion !== task.planVersion) return fail('stage-unavailable')
        return accepted(task, [], this.handoff(task, source, run))
      }
    }
    await this.save(next)
    return accepted(this.view(next.task, await this.project(input.projectId)))
  }

  private async create(input: Extract<Mutation, { action: 'create' }>, project: ActiveProjectRecord, requestHash: string, signal: AbortSignal) {
    const count = [...this.table.entries()].filter(([, value]) => value.task.projectId === input.projectId).length
      + [...this.creating.values()].filter(id => id === input.projectId).length
    if (count >= 50) return fail('limit-exceeded')
    this.creating.set(input.taskId, input.projectId)
    try {
      const source = this.source(project, input.payload.prdRevisionId, input.payload.requirementIds)
      const now = this.clock.now()
      let task: ValidationTask = { id: input.taskId, projectId: input.projectId, version: 1, mode: input.payload.mode,
        prdRevisionId: source.prd.id, prdContentHash: source.prd.contentHash, baselineId: source.baseline.id,
        baselineContentVersion: source.baseline.contentVersion, requirementIds: [...input.payload.requirementIds],
        requirementTitles: input.payload.requirementIds.map(id => source.baseline.items.find(item => item.requirementId === id)!.title),
        status: 'draft', plan: defaultValidationPlan(source, input.payload.mode), planVersion: 1, confirmedPlanVersion: null,
        planProvenance: { kind: 'template', provider: '', model: '' }, allowModelUse: false, runs: [], verdict: null,
        createdAt: now, updatedAt: now, lastError: '正在生成 AI 验证计划；完成前请等待。', stale: false }
      if (this.view(task, project).stale) return fail('source-stale')
      const receipts = [{ commandId: input.commandId, requestHash }]
      await this.save({ task, receipts })
      try {
        const generated = await this.runner.plan(source, input.payload.mode, signal)
        signal.throwIfAborted()
        task = { ...task, plan: generated.plan, planProvenance: generated.provenance, version: 2, updatedAt: this.clock.now(), lastError: null }
      } catch {
        task = { ...task, version: 2, updatedAt: this.clock.now(), lastError: 'AI 计划未生成，当前显示可编辑的通用模板。请按实际需求修改后确认。' }
      }
      await this.save({ task, receipts })
      return accepted(this.view(task, await this.project(input.projectId)))
    } finally { this.creating.delete(input.taskId) }
  }

  private handoff(task: ValidationTask, source: ValidationSource, run: ValidationRun): ValidationHandoff {
    const selected = source.baseline.items.filter(item => task.requirementIds.includes(item.requirementId))
    const remaining = source.baseline.items.filter(item => !task.requirementIds.includes(item.requirementId))
    const lines = [ `# ${source.baseline.projectName} · 研发交付包`, '',
      '> 本次通过仅覆盖下列需求和测试范围；其余功能、性能、安全性及真实用户认可仍需另行验证。', '',
      `验证方式：${task.mode === 'demo' ? '交互 Demo（模拟数据）' : task.mode === 'poc' ? '可运行 POC（工作台受控模板）' : '核心能力验证'}`,
      `人工结论：通过；${task.verdict?.note || '未补充说明'}`, '', '## 本次确认范围',
      ...selected.map(item => `- ${item.title}（${item.priority}）：${item.description}`), '', '## 尚未覆盖的需求',
      ...(remaining.length ? remaining.map(item => `- ${item.title}`) : ['- 本次已选择全部需求；每条需求仍仅验证本计划列明的场景。']),
      '', '## 验证目标与验收标准', task.plan.goal, ...task.plan.criteria.map(item => `- ${item}`), '', '## 运行记录',
      ...run.results.flatMap(result => [`### ${result.caseId}`, `输入：${result.input}`, `预期：${result.expected}`, `实际：\n${result.actual}`,
        `模型：${result.provenance.provider}/${result.provenance.model}`, ...result.checks.map(check => `- ${check.passed ? '满足' : '需复核'}：${check.label}`)]),
      ...(run.demo ? ['Demo 为模拟交互，不包含真实模型处理。', `模拟结果：${run.demo.sampleOutput}`] : []),
      '', '## 运行与交接说明', '在 DeepSeek Harness 的 AI PM 工作台打开本项目 → 方案验证 → 选择该任务。POC 可输入新材料并显式运行，使用宿主配置的模型；下载的配置保留计划与结果，不能脱离宿主直接调用模型。',
      '', '## 开发任务建议（待研发估算）', ...selected.map(item => `- 实现“${item.title}”；先确认输入输出及异常路径，再按本次验收标准增加测试。`),
      '', '## 风险与待确认', '- 小样本验证不证明生产可用；上线前需补充真实用户反馈、数据权限、失败兜底、成本与性能评估。',
      '- 自动检查仅核对结构与引用，不替代人工判断业务正确性。', '', '## 绑定的 PRD', source.prd.markdown,
      '', '## 版本追溯', `PRD：${task.prdRevisionId}；验证任务：${task.id}；运行：${run.id}；计划版本：${run.planVersion}`,
    ]
    return { filename: `${source.baseline.projectName.replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_').slice(0, 80)}-研发交付包.md`,
      markdown: lines.join('\n\n'), configuration: JSON.stringify({ format: 'pmwb-validation-handoff-v1', task, run }, null, 2) }
  }
}
