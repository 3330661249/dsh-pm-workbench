import { describe, expect, it, vi } from 'vitest'
import { HarnessModelInsightEngine, type StructuredAnalysisRunner } from '../../packages/workbench/src/analysis/harness-model-engine.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import {
  analysisRevisionIdSchema, projectIdSchema, sourceRevisionIdSchema,
} from '../../packages/workbench/src/domain/ids.js'
import type { AnalysisInput } from '../../packages/workbench/src/analysis/types.js'

const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const text = '用户：每周整理访谈要花三个小时。\n用户：我还经常找不到支持需求的原话。'
const input: AnalysisInput = {
  mode: 'harness-model',
  projectId: projectIdSchema.parse(uuid(1)),
  source: {
    id: sourceRevisionIdSchema.parse(uuid(2)), projectId: projectIdSchema.parse(uuid(1)), revision: 1,
    displayName: 'synthetic.txt', format: 'text/plain', text, utf8Bytes: Buffer.byteLength(text),
    contentHash: nodeSha256Utf8(text), syntheticDataAttested: true,
  },
  researchGoal: '降低访谈整理时间', analysisRevisionId: analysisRevisionIdSchema.parse(uuid(3)),
  generation: 1, baseProjectVersion: 2,
}

function runner(structured: unknown, stopReason = 'completed'): StructuredAnalysisRunner {
  return { run: vi.fn(async () => ({ stopReason, structured, provider: 'deepseek-official', model: 'deepseek-v4-flash' })) }
}

const valid = {
  requirements: [{
    title: '自动整理访谈', painPoint: '每周整理访谈耗时三小时', description: '提炼访谈中的需求并保留原文依据',
    suggestedPriority: 'high', rationale: '高频且耗时明确', assumptions: [], unknowns: ['需要确认每周访谈数量'],
    evidence: [{ role: 'support', quote: '每周整理访谈要花三个小时' }],
  }],
}

describe('HarnessModelInsightEngine', () => {
  it('turns a completed structured model result into an evidence-bound candidate', async () => {
    let next = 10
    const engine = new HarnessModelInsightEngine(runner(valid), nodeSha256Utf8, () => uuid(next++))
    const result = await engine.analyse(input, new AbortController().signal)

    expect(result.analysis).toMatchObject({ kind: 'harness-model', id: input.analysisRevisionId, sourceRevisionId: input.source.id,
      provider: 'deepseek-official', model: 'deepseek-v4-flash' })
    expect(result.generatedRequirements).toHaveLength(1)
    expect(result.generatedRequirements[0]).toMatchObject({ producer: 'ai', suggestedPriority: 'high' })
    expect(result.evidence[0]).toMatchObject({
      quote: '每周整理访谈要花三个小时',
      start: text.indexOf('每周整理访谈要花三个小时'),
      end: text.indexOf('每周整理访谈要花三个小时') + '每周整理访谈要花三个小时'.length,
    })
    expect(result.evidence[0]!.quoteHash).toBe(nodeSha256Utf8(result.evidence[0]!.quote))
    expect(result.generatedRequirements[0]!.evidenceIds).toEqual([result.evidence[0]!.id])
  })

  it('rejects a fabricated quote instead of repairing or accepting it', async () => {
    const fabricated = structuredClone(valid)
    fabricated.requirements[0]!.evidence[0]!.quote = '原文里不存在的用户原话'
    const engine = new HarnessModelInsightEngine(runner(fabricated), nodeSha256Utf8, () => uuid(20))
    await expect(engine.analyse(input, new AbortController().signal)).rejects.toThrow('invalid-evidence')
  })

  it.each(['error', 'max-tokens', 'refusal', 'aborted'])('fails closed for %s without synthesizing a fallback', async stopReason => {
    const engine = new HarnessModelInsightEngine(runner(valid, stopReason), nodeSha256Utf8, () => uuid(30))
    await expect(engine.analyse(input, new AbortController().signal)).rejects.toThrow('stage-unavailable')
  })

  it('rejects missing or malformed structured output', async () => {
    for (const value of [undefined, { requirements: [{ title: '缺少字段' }] }]) {
      const engine = new HarnessModelInsightEngine(runner(value), nodeSha256Utf8, () => uuid(40))
      await expect(engine.analyse(input, new AbortController().signal)).rejects.toThrow('invalid-evidence')
    }
  })
})
