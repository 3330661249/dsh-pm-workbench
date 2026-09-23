import { describe, expect, it, vi } from 'vitest'
import { assertObjectJsonSchema, validateJsonSchemaValue } from '@deepseek-ai/dsh-tools'
import { HarnessModelInsightEngine, STRUCTURED_ANALYSIS_OUTPUT_SCHEMA, type StructuredAnalysisRunner } from '../../packages/workbench/src/analysis/harness-model-engine.js'
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
    suggestedPriority: 'high', rationale: '高频且耗时明确', assumptions: [] as string[], unknowns: ['需要确认每周访谈数量'],
    evidence: [{ role: 'support', quote: '每周整理访谈要花三个小时' }],
  }],
}

function withSource(sourceText: string): AnalysisInput {
  return { ...input, source: { ...input.source, text: sourceText, utf8Bytes: Buffer.byteLength(sourceText),
    contentHash: nodeSha256Utf8(sourceText) } }
}

const entries = (count: number) => Array.from({ length: count }, (_, index) => `${index}${'甲'.repeat(499)}`)

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

  it('resolves a segment identity to its exact source span, even when text repeats', async () => {
    const source = '同一句话。\r\n\r\n同一句话。'
    const model = runner({ requirements: [{ ...valid.requirements[0], evidence: [{ role: 'support', segmentId: 'S2' }] }] })
    let next = 200
    const result = await new HarnessModelInsightEngine(model, nodeSha256Utf8, () => uuid(next++)).analyse(withSource(source), new AbortController().signal)
    expect(result.evidence[0]).toMatchObject({ quote: '同一句话。', start: 9, end: 14, quoteHash: nodeSha256Utf8('同一句话。') })
    expect(model.run).toHaveBeenCalledOnce()
  })

  it('splits long source lines without dropping text or cutting astral characters', async () => {
    const source = '😀'.repeat(4000) + '乙：必须保留人工确认。'
    let next = 210
    const model = runner({ requirements: [{ ...valid.requirements[0], evidence: [{ role: 'support', segmentId: 'S2' }] }] })
    const result = await new HarnessModelInsightEngine(model, nodeSha256Utf8, () => uuid(next++)).analyse(withSource(source), new AbortController().signal)
    expect(result.evidence[0]).toMatchObject({ quote: '乙：必须保留人工确认。', start: 8000, end: source.length })
  })

  it.each([{ role: 'support', segmentId: 'S9999' }, { role: 'support', segmentId: 'S1', quote: '伪造' }])('rejects unknown or mixed evidence identities', async evidence => {
    const model = runner({ requirements: [{ ...valid.requirements[0], evidence: [evidence] }] })
    await expect(new HarnessModelInsightEngine(model, nodeSha256Utf8, () => uuid(220)).analyse(input, new AbortController().signal)).rejects.toThrow('invalid-evidence')
    expect(model.run).toHaveBeenCalledOnce()
  })

  it('rejects a fabricated quote instead of repairing or accepting it', async () => {
    const fabricated = structuredClone(valid)
    fabricated.requirements[0]!.evidence[0]!.quote = '原文里不存在的用户原话'
    const engine = new HarnessModelInsightEngine(runner(fabricated), nodeSha256Utf8, () => uuid(20))
    await expect(engine.analyse(input, new AbortController().signal)).rejects.toThrow('invalid-evidence')
  })

  it.each([
    { source: '甲：要自动审批吗？\n甲：需要。\n乙：要保留人工审批吗？\n乙：需要。', quote: '需要。' },
    { source: '哈哈哈', quote: '哈哈' },
  ])('rejects ambiguous quotations, including overlapping matches', async ({ source, quote }) => {
    const ambiguous = structuredClone(valid)
    ambiguous.requirements[0]!.evidence[0]!.quote = quote
    const model = runner(ambiguous), newId = vi.fn(() => uuid(20))
    const engine = new HarnessModelInsightEngine(model, nodeSha256Utf8, newId)
    await expect(engine.analyse(withSource(source), new AbortController().signal)).rejects.toThrow('invalid-evidence')
    expect(newId).not.toHaveBeenCalled()
    expect(model.run).toHaveBeenCalledOnce()
  })

  it('binds a repeated answer to the correct speaker when the quote includes unique context', async () => {
    const source = '甲：需要。\n乙：需要。', quote = '乙：需要。'
    const contextual = structuredClone(valid)
    contextual.requirements[0]!.evidence[0]!.quote = quote
    let next = 50
    const engine = new HarnessModelInsightEngine(runner(contextual), nodeSha256Utf8, () => uuid(next++))
    const result = await engine.analyse(withSource(source), new AbortController().signal)
    expect(result.evidence[0]).toMatchObject({ start: 6, end: 11, quote })
  })

  it.each([
    ['requirements', (value: typeof valid) => { value.requirements = Array.from({ length: 25 }, () => structuredClone(valid.requirements[0]!)) }],
    ['total evidence', (value: typeof valid) => {
      value.requirements = Array.from({ length: 2 }, () => structuredClone(valid.requirements[0]!))
      value.requirements[0]!.evidence = Array.from({ length: 49 }, () => ({ role: 'support', quote: '每周整理访谈要花三个小时' }))
      value.requirements[1]!.evidence = Array.from({ length: 48 }, () => ({ role: 'support', quote: '每周整理访谈要花三个小时' }))
    }],
    ['assumptions count', (value: typeof valid) => { value.requirements[0]!.assumptions = Array.from({ length: 21 }, (_, i) => `假设${i}`) }],
    ['unknowns count', (value: typeof valid) => { value.requirements[0]!.unknowns = Array.from({ length: 21 }, (_, i) => `待确认${i}`) }],
    ['assumption length', (value: typeof valid) => { value.requirements[0]!.assumptions = ['甲'.repeat(501)] }],
    ['unknown length', (value: typeof valid) => { value.requirements[0]!.unknowns = ['甲'.repeat(501)] }],
    ['assumptions bytes per requirement', (value: typeof valid) => { value.requirements[0]!.assumptions = entries(6) }],
    ['unknowns bytes per requirement', (value: typeof valid) => { value.requirements[0]!.unknowns = entries(6) }],
    ['analysis assumptions and unknowns bytes', (value: typeof valid) => {
      value.requirements = Array.from({ length: 5 }, () => ({ ...structuredClone(valid.requirements[0]!), assumptions: entries(5), unknowns: entries(5) }))
    }],
  ] as const)('reports %s overflow as limit-exceeded without truncating or retrying', async (_label, overflow) => {
    const value = structuredClone(valid)
    overflow(value)
    let next = 60
    const before = structuredClone(value), model = runner(value), newId = vi.fn(() => uuid(next++))
    const engine = new HarnessModelInsightEngine(model, nodeSha256Utf8, newId)
    // rc.6 only enforces its supported structural subset; local capacity checks are essential.
    expect(() => assertObjectJsonSchema(STRUCTURED_ANALYSIS_OUTPUT_SCHEMA)).not.toThrow()
    expect(validateJsonSchemaValue(STRUCTURED_ANALYSIS_OUTPUT_SCHEMA, { requirements: value.requirements.map(requirement => ({ ...requirement, evidence: requirement.evidence.map(item => ({ role: item.role, segmentId: 'S1' })) })) })).toEqual([])
    await expect(engine.analyse(input, new AbortController().signal)).rejects.toThrow('limit-exceeded')
    expect(value).toEqual(before)
    expect(newId).not.toHaveBeenCalled()
    expect(model.run).toHaveBeenCalledOnce()
  })

  it.each(['title', 'painPoint', 'description', 'rationale'] as const)('applies the actual text limit to %s', async field => {
    const value = structuredClone(valid)
    value.requirements[0]![field] = '😀'.repeat(2001)
    const engine = new HarnessModelInsightEngine(runner(value), nodeSha256Utf8, () => uuid(70))
    await expect(engine.analyse(input, new AbortController().signal)).rejects.toThrow('limit-exceeded')
  })

  it.each([
    { quote: '甲'.repeat(4001), count: 1 },
    { quote: '甲'.repeat(4000), count: 11 },
  ])('reports individual or aggregate quote overflow as a capacity failure', async ({ quote, count }) => {
    const value = structuredClone(valid)
    value.requirements[0]!.evidence = Array.from({ length: count }, () => ({ role: 'support', quote }))
    let next = 80
    const engine = new HarnessModelInsightEngine(runner(value), nodeSha256Utf8, () => uuid(next++))
    await expect(engine.analyse(withSource(quote), new AbortController().signal)).rejects.toThrow('limit-exceeded')
  })

  it('accepts the exact count limits and counts astral text as Unicode code points', async () => {
    const value = structuredClone(valid)
    value.requirements = Array.from({ length: 24 }, () => ({ ...structuredClone(valid.requirements[0]!),
      title: '😀'.repeat(2000), evidence: Array.from({ length: 4 }, () => ({ role: 'support', quote: '每周整理访谈要花三个小时' })) }))
    let next = 100
    const engine = new HarnessModelInsightEngine(runner(value), nodeSha256Utf8, () => uuid(next++))
    const result = await engine.analyse(input, new AbortController().signal)
    expect(result.generatedRequirements).toHaveLength(24)
    expect(result.evidence).toHaveLength(96)
    expect(result.generatedRequirements[0]!.title).toBe('😀'.repeat(2000))
  })

  it.each(['error', 'max-tokens', 'refusal', 'aborted'])('fails closed for %s without synthesizing a fallback', async stopReason => {
    const engine = new HarnessModelInsightEngine(runner(valid, stopReason), nodeSha256Utf8, () => uuid(30))
    await expect(engine.analyse(input, new AbortController().signal)).rejects.toThrow(stopReason === 'max-tokens' ? 'model-output-incomplete' : 'stage-unavailable')
  })

  it('rejects missing or malformed structured output', async () => {
    for (const value of [undefined, { requirements: [{ title: '缺少字段' }] }]) {
      const engine = new HarnessModelInsightEngine(runner(value), nodeSha256Utf8, () => uuid(40))
      await expect(engine.analyse(input, new AbortController().signal)).rejects.toThrow('invalid-evidence')
    }
  })
})
