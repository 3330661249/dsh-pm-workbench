import { z } from 'zod'
import type { ObjectJsonSchema } from '@deepseek-ai/dsh-tools'
import {
  evidenceIdSchema, generatedDraftIdSchema, requirementIdSchema, type Sha256Hex,
} from '../domain/ids.js'
import { validateAnalysisCandidate } from '../domain/evidence.js'
import type { AnalysisCandidate, EvidenceExcerpt } from '../domain/model.js'
import type { AnalysisInput, InsightEngine } from './types.js'
import { deepFreeze, DomainFailure } from './types.js'

const evidenceResult = z.strictObject({
  role: z.enum(['support', 'counterexample', 'context']),
  quote: z.string().min(1),
})
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

export const STRUCTURED_ANALYSIS_OUTPUT_SCHEMA: ObjectJsonSchema = {
  type: 'object', additionalProperties: false, required: ['requirements'],
  properties: {
    requirements: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['title', 'painPoint', 'description', 'evidence', 'rationale', 'assumptions', 'unknowns', 'suggestedPriority'],
      properties: {
        title: { type: 'string' }, painPoint: { type: 'string' }, description: { type: 'string' },
        evidence: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['role', 'quote'],
          properties: { role: { type: 'string', enum: ['support', 'counterexample', 'context'] }, quote: { type: 'string' } } } },
        rationale: { type: 'string' }, assumptions: { type: 'array', items: { type: 'string' } },
        unknowns: { type: 'array', items: { type: 'string' } },
        suggestedPriority: { type: 'string', enum: ['high', 'medium', 'low'] },
      },
    } },
  },
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
    if (result.stopReason !== 'completed') throw new DomainFailure('stage-unavailable')
    let parsed: z.infer<typeof structuredAnalysis>
    try { parsed = structuredAnalysis.parse(result.structured) }
    catch { throw new DomainFailure('invalid-evidence') }

    const evidence: EvidenceExcerpt[] = []
    const generatedRequirements = parsed.requirements.map(requirement => {
      const evidenceIds = requirement.evidence.map(item => {
        const start = input.source.text.indexOf(item.quote)
        if (start < 0) throw new DomainFailure('invalid-evidence')
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
