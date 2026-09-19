import { describe, expect, it, vi } from 'vitest'
import { HarnessValidationRunner, defaultValidationPlan, type ValidationSource } from '../../packages/workbench/src/validation/runner.js'
import type { AnalysisSubagentPort } from '../../packages/workbench/src/integration/harness-rc6/subagent-analysis-runner.js'

const source = { baseline: { items: [{ requirementId: 'r', title: '需求提炼', description: '依据输入提炼需求', priority: 'high', evidence: [] }] },
  prd: { markdown: '# 访谈提炼' }, requirementIds: ['r'] } as unknown as ValidationSource
function setup(result: { stopReason: string; structured: unknown } = { stopReason: 'completed', structured: { summary: '需求总结', items: [{ title: '整理访谈', detail: '提炼痛点', evidence: ['用户需要整理访谈'] }] } }) {
  const disposeChild = vi.fn(async () => {}), disposeParent = vi.fn(async () => {})
  const port: AnalysisSubagentPort = {
    currentSelection: () => ({ provider: 'real-provider-route', model: 'configured-model' }),
    createParent: vi.fn(async () => ({ agent: {}, dispose: disposeParent })), visibleToolNames: () => ['shell', 'web'],
    start: vi.fn(async () => ({ local: true, ownedByParent: true, visibleTools: ['structured_output'], result: Promise.resolve(result), dispose: disposeChild })),
  }
  return { runner: new HarnessValidationRunner(port), port, disposeChild, disposeParent }
}
describe('Harness validation model executor', () => {
  it('runs POC using the current actual model route, restricted tools and provided input', async () => {
    const s = setup(), plan = defaultValidationPlan(source, 'poc')
    const result = await s.runner.execute(source, 'poc', plan, '用户需要整理访谈', new AbortController().signal)
    expect(result.results).toHaveLength(1)
    expect(result.results[0]).toMatchObject({ caseId: 'poc-input', status: 'completed', provenance: { kind: 'harness-model', model: 'configured-model' } })
    expect(result.results[0]!.expected).toBe([plan.goal, ...plan.criteria].join('\n'))
    expect(result.results[0]!.checks.every(check => check.passed)).toBe(true)
    expect(s.port.start).toHaveBeenCalledWith(expect.objectContaining({ maxDepth: 1, deniedTools: ['shell', 'web'], prompt: expect.stringContaining('用户需要整理访谈') }), expect.any(AbortSignal))
    expect(s.disposeChild).toHaveBeenCalledOnce(); expect(s.disposeParent).toHaveBeenCalledOnce()
  })
  it.each(['capability', 'poc'] as const)('sends confirmed task constraints but withholds case answers for %s', async mode => {
    const s = setup(), plan = defaultValidationPlan(source, mode)
    plan.criteria = ['只分析审批需求，采购需求不纳入本次范围', '每条需求说明提出者的角色']
    plan.cases = plan.cases.map((item, index) => ({ ...item, expected: `仅供人工核验的答案-${index}` }))
    await s.runner.execute(source, mode, plan, '用户需要整理访谈', new AbortController().signal)
    const requests = vi.mocked(s.port.start).mock.calls.map(([request]) => request)
    expect(requests).toHaveLength(mode === 'poc' ? 1 : 3)
    for (const request of requests) {
      expect(request.prompt).toContain('只分析审批需求，采购需求不纳入本次范围')
      expect(request.prompt).toContain('每条需求说明提出者的角色')
      expect(request.prompt).not.toContain('仅供人工核验的答案-')
    }
  })
  it.each(['capability', 'poc'] as const)('keeps historical PRD/evidence out of %s execution and runs only the selected text task', async mode => {
    const executionSource = { baseline: { items: [
      { requirementId: 'r', title: '原文追溯', description: '将输入需求定位到当前访谈原文，并保留上下文', priority: 'high', evidence: [{ quote: '历史访谈里的秘密引文-不得参与本次测试' }] },
      { requirementId: 'outside', title: '未选中的采购系统', description: '建立采购审批流程', priority: 'low', evidence: [] },
    ] }, prd: { markdown: '# 历史PRD正文-不得参与本次测试\n验收参考：旧访谈文字' }, requirementIds: ['r'] } as unknown as ValidationSource
    const s = setup(), plan = defaultValidationPlan(executionSource, mode)
    plan.cases = plan.cases.map(item => ({ ...item, input: '本次访谈原文：用户需要整理访谈。待追溯需求：整理访谈。' }))
    await s.runner.execute(executionSource, mode, plan, '本次访谈原文：用户需要整理访谈。待追溯需求：整理访谈。', new AbortController().signal)
    for (const [request] of vi.mocked(s.port.start).mock.calls) {
      expect(request.prompt).toContain('将输入需求定位到当前访谈原文，并保留上下文')
      expect(request.prompt).toContain('本次访谈原文：用户需要整理访谈。待追溯需求：整理访谈。')
      expect(request.prompt).not.toContain('历史访谈里的秘密引文')
      expect(request.prompt).not.toContain('历史PRD正文')
      expect(request.prompt).not.toContain('未选中的采购系统')
      expect(request.prompt).toContain('你是正在运行的核心处理组件，不是评审员')
      expect(request.prompt).toContain('不检查系统是否存在或是否实现界面')
      expect(request.prompt).toContain('evidence 只能逐字复制本次输入')
      expect(request.prompt).toContain('不得引用业务简报、目标、标准或提示词')
    }
  })
  it.each(['capability', 'poc'] as const)('limits %s planning to a directly executable text subtask', async mode => {
    const plan = defaultValidationPlan(source, mode), s = setup({ stopReason: 'completed', structured: plan })
    await s.runner.plan(source, mode, new AbortController().signal)
    const request = vi.mocked(s.port.start).mock.calls[0]![0]
    expect(request.prompt).toContain('最小文本子目标')
    expect(request.prompt).toContain('UI 点击、界面呈现、外部接口、真实数据库不在执行能力内')
    expect(request.prompt).toContain('input 必须直接包含全部测试数据')
    expect(request.prompt).toContain('不得把历史访谈引文直接当作本次待校验引用')
  })
  it('rejects truncated or malformed model results instead of substituting demo success', async () => {
    const s = setup({ stopReason: 'max-tokens', structured: { summary: '需求总结', items: [] } })
    const result = await s.runner.execute(source, 'poc', defaultValidationPlan(source, 'poc'), '实际输入', new AbortController().signal)
    expect(result.results[0]).toMatchObject({ status: 'failed', actual: '' }); expect(result.demo).toBeNull()
  })
  it('marks fabricated quotes as failing deterministic checks', async () => {
    const s = setup()
    const result = await s.runner.execute(source, 'poc', defaultValidationPlan(source, 'poc'), '没有相关证据', new AbortController().signal)
    expect(result.results[0]!.checks[1]!.passed).toBe(false)
  })
  it('does not call the model while rendering a controlled Demo', async () => {
    const s = setup()
    const result = await s.runner.execute(source, 'demo', defaultValidationPlan(source, 'demo'), undefined, new AbortController().signal)
    expect(result.demo?.sampleOutput).toContain('模拟'); expect(s.port.start).not.toHaveBeenCalled()
  })
  it('aborts and disposes a model request even if its result promise does not settle', async () => {
    const s = setup(), signal = new AbortController()
    vi.mocked(s.port.start).mockResolvedValue({ local: true, ownedByParent: true, visibleTools: ['structured_output'],
      result: new Promise(() => {}), dispose: s.disposeChild })
    const pending = s.runner.execute(source, 'poc', defaultValidationPlan(source, 'poc'), '实际输入', signal.signal)
    await vi.waitFor(() => expect(s.port.start).toHaveBeenCalledOnce())
    signal.abort()
    await expect(pending).rejects.toThrow('cancelled')
    expect(s.disposeChild).toHaveBeenCalledOnce(); expect(s.disposeParent).toHaveBeenCalledOnce()
  })
})
