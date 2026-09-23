import { z } from 'zod'
import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import {
  evidenceIdSchema, generatedDraftIdSchema, requirementIdSchema, type Sha256Hex,
} from '../domain/ids.js'
import { validateAnalysisCandidate } from '../domain/evidence.js'
import {
  MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES,
  MAX_ASSUMPTIONS_PER_REQUIREMENT, MAX_ASSUMPTIONS_UTF8_BYTES_PER_REQUIREMENT,
  MAX_ASSUMPTION_OR_UNKNOWN_CODE_POINTS, MAX_ASSUMPTION_OR_UNKNOWN_UTF8_BYTES,
  MAX_EVIDENCE_PER_ANALYSIS, MAX_EVIDENCE_QUOTE_CODE_POINTS, MAX_EVIDENCE_QUOTE_UTF8_BYTES,
  MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES, MAX_REQUIREMENTS_PER_ANALYSIS,
  MAX_REQUIREMENT_TEXT_CODE_POINTS, MAX_REQUIREMENT_TEXT_UTF8_BYTES,
  MAX_UNKNOWNS_PER_REQUIREMENT, MAX_UNKNOWNS_UTF8_BYTES_PER_REQUIREMENT,
  unicodeCodePointLength, utf8ByteLength,
} from '../domain/limits.js'
import type { AnalysisCandidate, EvidenceExcerpt } from '../domain/model.js'
import type { AnalysisInput, InsightEngine } from './types.js'
import { deepFreeze, DomainFailure } from './types.js'
import { sourceSegments } from './source-segments.js'

const quotedEvidenceResult = z.strictObject({
  role: z.enum(['support', 'counterexample', 'context']),
  quote: z.string().min(1),
})
// Legacy adapters may still return verbatim quotes; never repair their text.
const evidenceResult = z.union([quotedEvidenceResult, z.strictObject({
  role: z.enum(['support', 'counterexample', 'context']), segmentId: z.string().min(1),
})])
const requirementResult = z.strictObject({
  title: z.string().min(1),
  painPoint: z.string().min(1),
  description: z.string().min(1),
  evidence: z.array(evidenceResult),
  rationale: z.string().min(1),
  assumptions: z.array(z.string().min(1)),
  unknowns: z.array(z.string().min(1)),
  suggestedPriority: z.enum(['high', 'medium', 'low']),
})
const structuredAnalysis = z.strictObject({ requirements: z.array(requirementResult) })

// rc.6 supports description annotations but not maxItems/maxLength. The engine
// independently enforces these same domain budgets before compiling a candidate.
export const STRUCTURED_ANALYSIS_LIMITS_DESCRIPTION = `输出预算（所有限制同时满足）：
- requirements 最多 ${MAX_REQUIREMENTS_PER_ANALYSIS} 条；所有需求的 evidence 合计最多 ${MAX_EVIDENCE_PER_ANALYSIS} 条。
- title、painPoint、description、rationale 各自非空，最多 ${MAX_REQUIREMENT_TEXT_CODE_POINTS} 个 Unicode 码点且不超过 ${MAX_REQUIREMENT_TEXT_UTF8_BYTES} 个 UTF-8 字节。
- 系统从 segmentId 提取的每条引用非空，最多 ${MAX_EVIDENCE_QUOTE_CODE_POINTS} 个 Unicode 码点且不超过 ${MAX_EVIDENCE_QUOTE_UTF8_BYTES} 个 UTF-8 字节；所有引用合计不超过 ${MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES} 个 UTF-8 字节。
- 每项需求的 assumptions 最多 ${MAX_ASSUMPTIONS_PER_REQUIREMENT} 条，unknowns 最多 ${MAX_UNKNOWNS_PER_REQUIREMENT} 条；每条非空，最多 ${MAX_ASSUMPTION_OR_UNKNOWN_CODE_POINTS} 个 Unicode 码点且不超过 ${MAX_ASSUMPTION_OR_UNKNOWN_UTF8_BYTES} 个 UTF-8 字节，各数组内不得重复。
- 每项需求的 assumptions 合计不超过 ${MAX_ASSUMPTIONS_UTF8_BYTES_PER_REQUIREMENT} 个 UTF-8 字节，unknowns 合计不超过 ${MAX_UNKNOWNS_UTF8_BYTES_PER_REQUIREMENT} 个 UTF-8 字节；本次分析的假设与未知项合计不超过 ${MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES} 个 UTF-8 字节。
只聚合真正同类的问题并保留不同意见；超限结果会被明确拒绝，系统不会截断结果或自动追加模型请求。`

export const STRUCTURED_ANALYSIS_OUTPUT_SCHEMA: ObjectJsonSchema = {
  type: 'object', additionalProperties: false, required: ['requirements'],
  description: STRUCTURED_ANALYSIS_LIMITS_DESCRIPTION,
  properties: {
    requirements: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['title', 'painPoint', 'description', 'evidence', 'rationale', 'assumptions', 'unknowns', 'suggestedPriority'],
      properties: {
        title: { type: 'string' }, painPoint: { type: 'string' }, description: { type: 'string' },
        evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['role', 'segmentId'],
          properties: { role: { type: 'string', enum: ['support', 'counterexample', 'context'] },
            segmentId: { type: 'string', description: '从本次材料提供的片段中选择编号，如 S1；系统按编号提取原话，不输出 quote，不创造编号。' } } } },
        rationale: { type: 'string' }, assumptions: { type: 'array', items: { type: 'string' } },
        unknowns: { type: 'array', items: { type: 'string' } },
        suggestedPriority: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    } },
  },
}

function checkTextBudget(value: string, codePoints: number, utf8Bytes: number): number {
  const bytes = utf8ByteLength(value)
  if (unicodeCodePointLength(value) > codePoints || bytes > utf8Bytes) throw new DomainFailure('limit-exceeded')
  return bytes
}

type ResolvedAnalysis = { requirements: (Omit<z.infer<typeof requirementResult>, 'evidence'> & {
  evidence: { role: 'support' | 'counterexample' | 'context'; quote: string; start: number }[]
})[] }

function validateOutputBudget(result: ResolvedAnalysis): void {
  if (result.requirements.length > MAX_REQUIREMENTS_PER_ANALYSIS) throw new DomainFailure('limit-exceeded')
  let evidenceCount = 0, evidenceBytes = 0, assumptionAndUnknownBytes = 0
  for (const requirement of result.requirements) {
    evidenceCount += requirement.evidence.length
    if (evidenceCount > MAX_EVIDENCE_PER_ANALYSIS
      || requirement.assumptions.length > MAX_ASSUMPTIONS_PER_REQUIREMENT
      || requirement.unknowns.length > MAX_UNKNOWNS_PER_REQUIREMENT) throw new DomainFailure('limit-exceeded')
    for (const value of [requirement.title, requirement.painPoint, requirement.description, requirement.rationale]) {
      checkTextBudget(value, MAX_REQUIREMENT_TEXT_CODE_POINTS, MAX_REQUIREMENT_TEXT_UTF8_BYTES)
    }
    for (const item of requirement.evidence) {
      evidenceBytes += checkTextBudget(item.quote, MAX_EVIDENCE_QUOTE_CODE_POINTS, MAX_EVIDENCE_QUOTE_UTF8_BYTES)
    }
    const assumptionBytes = requirement.assumptions.reduce((sum, item) => sum
      + checkTextBudget(item, MAX_ASSUMPTION_OR_UNKNOWN_CODE_POINTS, MAX_ASSUMPTION_OR_UNKNOWN_UTF8_BYTES), 0)
    const unknownBytes = requirement.unknowns.reduce((sum, item) => sum
      + checkTextBudget(item, MAX_ASSUMPTION_OR_UNKNOWN_CODE_POINTS, MAX_ASSUMPTION_OR_UNKNOWN_UTF8_BYTES), 0)
    assumptionAndUnknownBytes += assumptionBytes + unknownBytes
    if (assumptionBytes > MAX_ASSUMPTIONS_UTF8_BYTES_PER_REQUIREMENT
      || unknownBytes > MAX_UNKNOWNS_UTF8_BYTES_PER_REQUIREMENT
      || assumptionAndUnknownBytes > MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES
      || evidenceBytes > MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES) throw new DomainFailure('limit-exceeded')
  }
}

export interface StructuredAnalysisRunResult {
  readonly stopReason: string
  readonly structured?: unknown
  readonly provider: string
  readonly model: string
}

export interface StructuredAnalysisRunner {
  run(input: { readonly sourceText: string; readonly researchGoal: string | null }, signal: AbortSignal): Promise<StructuredAnalysisRunResult>
}

/** Compiles only a completed, schema-valid model result whose quotes exist verbatim in the frozen source. */
export class HarnessModelInsightEngine implements InsightEngine {
  constructor(
    private readonly runner: StructuredAnalysisRunner,
    private readonly sha256Utf8: (value: string) => Sha256Hex,
    private readonly newId: () => string,
  ) {}

  async analyse(input: AnalysisInput, signal: AbortSignal): Promise<AnalysisCandidate> {
    signal.throwIfAborted()
    if (input.mode !== 'harness-model') throw new DomainFailure('stage-unavailable')
    const result = await this.runner.run({ sourceText: input.source.text, researchGoal: input.researchGoal ?? null }, signal)
    signal.throwIfAborted()
    if (result.stopReason === 'max-tokens') throw new DomainFailure('model-output-incomplete')
    if (result.stopReason !== 'completed') throw new DomainFailure('stage-unavailable')
    let parsed: z.infer<typeof structuredAnalysis>
    try { parsed = structuredAnalysis.parse(result.structured) }
    catch { throw new DomainFailure('invalid-evidence') }
    const segments = new Map(sourceSegments(input.source.text).map(segment => [segment.segmentId, segment]))
    const resolved: ResolvedAnalysis = { requirements: parsed.requirements.map(requirement => ({ ...requirement,
      evidence: requirement.evidence.map(item => {
        if ('segmentId' in item) {
          const segment = segments.get(item.segmentId)
          if (!segment) throw new DomainFailure('invalid-evidence')
          return { role: item.role, quote: segment.text, start: segment.start }
        }
        const start = input.source.text.indexOf(item.quote)
        if (start < 0 || input.source.text.indexOf(item.quote, start + 1) >= 0) throw new DomainFailure('invalid-evidence')
        return { ...item, start }
      }),
    })) }
    validateOutputBudget(resolved)

    const evidence: EvidenceExcerpt[] = []
    const generatedRequirements = resolved.requirements.map(requirement => {
      const evidenceIds = requirement.evidence.map(item => {
        const start = item.start
        const excerpt: EvidenceExcerpt = {
          id: evidenceIdSchema.parse(this.newId()), sourceRevisionId: input.source.id, role: item.role,
          start, end: start + item.quote.length, quote: item.quote, quoteHash: this.sha256Utf8(item.quote),
        }
        evidence.push(excerpt)
        return excerpt.id
      })
      return {
        id: generatedDraftIdSchema.parse(this.newId()), requirementId: requirementIdSchema.parse(this.newId()),
        analysisRevisionId: input.analysisRevisionId, sourceRevisionId: input.source.id, producer: 'ai' as const,
        title: requirement.title, painPoint: requirement.painPoint, description: requirement.description,
        evidenceIds, rationale: requirement.rationale, assumptions: requirement.assumptions,
        unknowns: requirement.unknowns, suggestedPriority: requirement.suggestedPriority,
      }
    })
    const candidate: AnalysisCandidate = {
      analysis: { id: input.analysisRevisionId, sourceRevisionId: input.source.id, kind: 'harness-model',
        provider: result.provider, model: result.model,
        generation: input.generation, baseProjectVersion: input.baseProjectVersion, status: 'draft' },
      evidence, generatedRequirements,
    }
    try { validateAnalysisCandidate(input, candidate, this.sha256Utf8) }
    catch { throw new DomainFailure('invalid-evidence') }
    signal.throwIfAborted()
    return deepFreeze(candidate)
  }
}
