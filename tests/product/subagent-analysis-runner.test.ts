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

describe('task-local compact PRD reasoning', () => {
  it.each([true, false])('sets the request waterfall only for an advertised effort, without mutating global selection (supported=%s)', async supported => {
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
    const port = new CordisAnalysisSubagentPort(ctx, 'spawn', { label: 'PRD', persona: 'PRD', maxTokens: 12000, compactReasoning: true })
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
