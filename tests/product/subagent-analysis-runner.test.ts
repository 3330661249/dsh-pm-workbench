import { describe, expect, it, vi } from 'vitest'
import { SubagentStructuredPrdRunner } from '../../packages/workbench/src/integration/harness-rc6/subagent-prd-runner.js'
import { CordisAnalysisSubagentPort } from '../../packages/workbench/src/integration/harness-rc6/cordis-analysis-port.js'
import type { Context } from '@deepseek-ai/cordis'
import type { RequirementBaseline } from '../../packages/workbench/src/domain/model.js'
import {
  SubagentStructuredAnalysisRunner, type AnalysisSubagentPort,
} from '../../packages/workbench/src/integration/harness-rc6/subagent-analysis-runner.js'

function setup(overrides: Partial<AnalysisSubagentPort> = {}) {
  const parent = { agent: { id: 'parent' }, dispose: vi.fn(async () => {}) }
  const child = {
    local: true, ownedByParent: true, visibleTools: ['structured_output'],
    result: Promise.resolve({ stopReason: 'completed', structured: { requirements: [] } }),
    dispose: vi.fn(async () => {}),
  }
  const port: AnalysisSubagentPort = {
    currentSelection: () => ({ provider: 'deepseek-official', model: 'deepseek-v4-flash' }),
    createParent: vi.fn(async () => parent),
    visibleToolNames: vi.fn(() => ['bash', 'web_search']),
    start: vi.fn(async () => child),
    ...overrides,
  }
  return { port, parent, child, runner: new SubagentStructuredAnalysisRunner(port) }
}

describe('SubagentStructuredAnalysisRunner', () => {
  it('runs a fresh child with structured output and denies every inherited tool', async () => {
    const h = setup()
    const result = await h.runner.run({ sourceText: '合成访谈', researchGoal: '识别需求' }, new AbortController().signal)
    expect(result).toEqual({ stopReason: 'completed', structured: { requirements: [] }, provider: 'deepseek-official', model: 'deepseek-v4-flash' })
    expect(h.port.start).toHaveBeenCalledWith(expect.objectContaining({
      parent: h.parent.agent, deniedTools: ['bash', 'web_search'], maxDepth: 1,
      outputSchema: expect.objectContaining({ type: 'object' }),
      prompt: expect.stringContaining('合成访谈'),
    }), expect.any(AbortSignal))
    const request = vi.mocked(h.port.start).mock.calls[0]![0]
    expect(request.prompt).toContain('只分析下面的访谈材料')
    expect(request.prompt).not.toContain('只分析下面的合成访谈材料')
    expect(h.child.dispose).toHaveBeenCalledOnce()
    expect(h.parent.dispose).toHaveBeenCalledOnce()
  })

  it('sends source-identity guidance and actual output budgets before requesting analysis', async () => {
    const h = setup()
    await h.runner.run({ sourceText: '甲：需要。乙：需要。', researchGoal: null }, new AbortController().signal)
    const { prompt, outputSchema } = vi.mocked(h.port.start).mock.calls[0]![0]
    expect(prompt).toContain('evidence.segmentId')
    expect(prompt).toContain('受访者')
    for (const constraint of [
      'requirements 最多 24 条', 'evidence 合计最多 96 条',
      '2000 个 Unicode 码点且不超过 8192 个 UTF-8 字节',
      '4000 个 Unicode 码点且不超过 16384 个 UTF-8 字节',
      '引用合计不超过 131072 个 UTF-8 字节',
      'assumptions 最多 20 条', 'unknowns 最多 20 条',
      '500 个 Unicode 码点且不超过 2048 个 UTF-8 字节',
      'assumptions 合计不超过 8192 个 UTF-8 字节', 'unknowns 合计不超过 8192 个 UTF-8 字节',
      '假设与未知项合计不超过 65536 个 UTF-8 字节',
    ]) {
      expect(prompt).toContain(constraint)
      expect(outputSchema.description).toContain(constraint)
    }
    expect(h.port.start).toHaveBeenCalledOnce()
  })

  it('presents deterministic source segment identities instead of asking the model to copy quotes', async () => {
    const h = setup()
    await h.runner.run({ sourceText: '甲：原话。\n\n乙：原话。', researchGoal: null }, new AbortController().signal)
    const { prompt, outputSchema } = vi.mocked(h.port.start).mock.calls[0]![0]
    const catalog = JSON.parse(prompt.split('<source_segments_untrusted_json>\n')[1]!.split('\n</source_segments_untrusted_json>')[0]!)
    expect(catalog).toEqual([{ segmentId: 'S1', text: '甲：原话。' }, { segmentId: 'S2', text: '乙：原话。' }])
    expect(prompt).toContain('evidence.segmentId')
    expect(JSON.stringify(outputSchema)).not.toContain('"quote":')
  })

  it('fails before sending when the selected route is absent', async () => {
    const h = setup({ currentSelection: () => undefined })
    await expect(h.runner.run({ sourceText: '合成访谈', researchGoal: null }, new AbortController().signal)).rejects.toThrow('stage-unavailable')
    expect(h.port.createParent).not.toHaveBeenCalled()
  })

  it.each([
    { local: false }, { ownedByParent: false }, { visibleTools: ['structured_output', 'bash'] },
  ])('fails closed when child isolation is not proved: $patch', async patch => {
    const h = setup({ start: vi.fn(async () => ({
      local: true, ownedByParent: true, visibleTools: ['structured_output'],
      result: Promise.resolve({ stopReason: 'completed', structured: { requirements: [] } }),
      dispose: vi.fn(async () => {}), ...patch,
    })) })
    await expect(h.runner.run({ sourceText: '合成访谈', researchGoal: null }, new AbortController().signal)).rejects.toThrow('stage-unavailable')
    expect(h.parent.dispose).toHaveBeenCalledOnce()
  })

  it('always disposes child and parent after a model failure', async () => {
    const h = setup({ start: vi.fn(async () => ({
      local: true, ownedByParent: true, visibleTools: ['structured_output'],
      result: Promise.reject(new Error('provider failed')), dispose: vi.fn(async () => {}),
    })) })
    await expect(h.runner.run({ sourceText: '合成访谈', researchGoal: null }, new AbortController().signal)).rejects.toThrow('stage-unavailable')
    const child = await vi.mocked(h.port.start).mock.results[0]!.value
    expect(child.dispose).toHaveBeenCalledOnce()
    expect(h.parent.dispose).toHaveBeenCalledOnce()
  })
})

describe('SubagentStructuredPrdRunner', () => {
  const baseline = { projectName: '合成 PRD 验证', researchGoal: '定位原文', id: 'PRIVATE_BASELINE_ID',
    sourceContentHash: 'PRIVATE_HASH', items: [{ rank: 1, requirementId: 'PRIVATE_REQUIREMENT_ID', title: '查看原文',
      painPoint: '原文难查找', description: '从记录进入原文', priority: 'high', humanReason: '先解决核对任务',
      evidence: [{ role: 'support', quote: '我找不到原话。', id: 'PRIVATE_EVIDENCE_ID' }] }] } as unknown as RequirementBaseline
  it('sends excluded scope with human reasons, without leaking internal identities', async () => {
    const h = setup()
    const withExclusions = { ...baseline, excludedRequirements: [{
      requirementId: baseline.items[0]!.requirementId, title: '自动排期', description: '自动安排时间',
      decision: 'defer' as const, humanReason: '本期不做排期' }] }
    await new SubagentStructuredPrdRunner(h.port, 'approved skill').run({ baseline: withExclusions }, new AbortController().signal)
    const prompt = vi.mocked(h.port.start).mock.calls[0]![0].prompt
    const material = JSON.parse(prompt.split('<confirmed_baseline_untrusted_json>\n')[1]!.split('\n</confirmed_baseline_untrusted_json>')[0]!)
    expect(material.excludedRequirements).toEqual([{ title: '自动排期', description: '自动安排时间', decision: 'defer', humanReason: '本期不做排期' }])
    expect(prompt).not.toContain('PRIVATE_')
  })
  it('sends analysis assumptions and unknowns with their requirement context', async () => {
    const h = setup()
    const withContext = { ...baseline, items: [{ ...baseline.items[0]!,
      assumptions: ['审批人拥有对应权限'], unknowns: ['尚未确认 37 号接口的并发容量'],
    }] }
    await new SubagentStructuredPrdRunner(h.port, 'approved skill').run({ baseline: withContext }, new AbortController().signal)
    const prompt = vi.mocked(h.port.start).mock.calls[0]![0].prompt
    const material = JSON.parse(prompt.split('<confirmed_baseline_untrusted_json>\n')[1]!.split('\n</confirmed_baseline_untrusted_json>')[0]!)
    expect(material.requirements[0]).toMatchObject({ key: 'R1',
      assumptions: ['审批人拥有对应权限'], unknowns: ['尚未确认 37 号接口的并发容量'],
    })
    expect(material.knownContext.assumptions).toEqual([{ key: 'A1.1', text: '审批人拥有对应权限' }])
    expect(material.knownContext.openQuestions).toContainEqual({ key: 'Q1.1', text: '尚未确认 37 号接口的并发容量' })
    const schema = vi.mocked(h.port.start).mock.calls[0]![0].outputSchema
    expect(schema.properties?.openQuestions).toMatchObject({ items: { type: 'object', required: ['existingKey', 'newText'] } })

  })
  it('requires polarity and time distinctions throughout PRD examples, without losing evidence roles', async () => {
    const h = setup()
    const polarityBaseline = { ...baseline, items: [{ ...baseline.items[0]!, evidence: [
      { ...baseline.items[0]!.evidence[0]!, role: 'counterexample' as const, quote: '速度可以，但数据不对' },
    ] }] }
    await new SubagentStructuredPrdRunner(h.port, 'approved skill').run({ baseline: polarityBaseline }, new AbortController().signal)
    const prompt = vi.mocked(h.port.start).mock.calls[0]![0].prompt
    expect(prompt).toContain('只有数据错误一个问题')
    expect(prompt).toContain('以前慢，现在好了')
    expect(prompt).toContain('技术原因未知不等于问题现象未知')
    const material = JSON.parse(prompt.split('<confirmed_baseline_untrusted_json>\n')[1]!.split('\n</confirmed_baseline_untrusted_json>')[0]!)
    expect(material.requirements[0].evidence[0]).toMatchObject({ role: 'counterexample', quote: '速度可以，但数据不对' })
  })
  it('uses approved Skill guidance and only the confirmed scope, without sending internal identities', async () => {
    const h = setup()
    await new SubagentStructuredPrdRunner(h.port, 'APPROVED_CREATE_PRD_SKILL').run({ baseline }, new AbortController().signal)
    const request = vi.mocked(h.port.start).mock.calls[0]![0]
    expect(request.prompt).toContain('APPROVED_CREATE_PRD_SKILL')
    expect(request.prompt).toContain('R1'); expect(request.prompt).toContain('我找不到原话。')
    expect(request.prompt).not.toContain('PRIVATE_')
    expect(request.deniedTools).toEqual(['bash', 'web_search'])
    expect(request.maxDepth).toBe(1)
    expect(h.child.dispose).toHaveBeenCalledOnce(); expect(h.parent.dispose).toHaveBeenCalledOnce()
  })
  it('refuses an unisolated model and cleans up its owned parent', async () => {
    const h = setup({ start: vi.fn(async () => ({ local: true, ownedByParent: false, visibleTools: ['bash'],
      result: Promise.resolve({ stopReason: 'completed' }), dispose: vi.fn(async () => {}) })) })
    await expect(new SubagentStructuredPrdRunner(h.port, 'approved skill').run({ baseline }, new AbortController().signal)).rejects.toThrow('stage-unavailable')
    expect(h.parent.dispose).toHaveBeenCalledOnce()
  })
  it('stops on caller cancellation and never creates an agent for an already aborted request', async () => {
    const h = setup(), controller = new AbortController(); controller.abort()
    await expect(new SubagentStructuredPrdRunner(h.port, 'approved skill').run({ baseline }, controller.signal)).rejects.toThrow()
    expect(h.port.createParent).not.toHaveBeenCalled()
  })
})

describe('task-local compact model reasoning', () => {
  it.each([{ supported: true, task: 'analysis' }, { supported: false, task: 'analysis' }, { supported: true, task: 'prd' }, { supported: false, task: 'prd' }])('sets task-local reasoning without mutating global selection ($task, supported=$supported)', async ({ supported, task }) => {
    let override: ((payload: unknown, next: () => Promise<unknown>) => Promise<unknown>) | undefined
    const parentAgent = { id: 'parent' }, ownedChild = { id: 'owned-child' }, unrelated = { id: 'unrelated' }
    const scope = { agent: parentAgent, tools: { guard: vi.fn() },
      llm: { resolveModelInfo: vi.fn(async () => ({ reasoning: { efforts: supported ? [{ id: 'off' }, { id: 'high' }] : [{ id: 'high' }] } })) },
      on: vi.fn((event, listener, options) => {
        expect(event).toBe('agent/request')
        // The existing model-selection listener wraps next() and restores High.
        // Our task override must wrap that listener, rather than be overwritten by it.
        expect(options).toEqual({ prepend: true, global: true })
        override = listener
      }) }
    const create = vi.fn(async options => { await options.setup(scope); return { agent: { options: options.agentOptions }, dispose: async () => {} } })
    const ctx = { agents: { create, isOwnedBy: (id: string, owner: unknown) => id === ownedChild.id && owner === parentAgent } } as unknown as Context
    const port = task === 'analysis' ? new CordisAnalysisSubagentPort(ctx) : new CordisAnalysisSubagentPort(ctx, 'spawn', { label: 'PRD', persona: 'PRD', maxTokens: 12000, compactReasoning: true })
    await port.createParent({ provider: 'test-provider', model: 'test-model' }, new AbortController().signal)
    const global = { provider: 'test-provider', model: 'test-model', reasoningEffort: 'high' }
    const proposed = override ? await override({ agent: ownedChild }, async () => global) : global
    expect(proposed).toMatchObject({ reasoningEffort: supported ? 'off' : 'high' })
    expect(global.reasoningEffort).toBe('high')
    expect(override ? await override({ agent: unrelated }, async () => global) : global).toBe(global)
    // rc.6 ignores unknown AgentOptions fields; effort belongs in the request waterfall.
    expect(create.mock.calls[0]![0].agentOptions).not.toHaveProperty('reasoningEffort')
  })
})
