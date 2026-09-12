import { describe, expect, it, vi } from 'vitest'
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
