import type {
  AnalysisInput,
} from '../analysis/types.js'
import type { Sha256Hex } from './ids.js'
import {
  MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES,
  MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES,
  utf8ByteLength,
} from './limits.js'
import {
  analysisCandidateSchema,
  evidenceExcerptSchema,
  type AnalysisCandidate,
  type EvidenceExcerpt,
  type SourceRevision,
} from './model.js'
import { validatePersistedSource } from './text.js'

function failEvidence(): never {
  throw new Error('invalid-evidence')
}

function isScalarBoundary(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return true
  const before = text.charCodeAt(offset - 1)
  const after = text.charCodeAt(offset)
  return !(before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff)
}

export function validateEvidence(
  source: SourceRevision,
  evidence: EvidenceExcerpt,
  sha256Utf8: (value: string) => Sha256Hex,
): EvidenceExcerpt {
  try {
    validatePersistedSource(source, sha256Utf8)
    evidenceExcerptSchema.parse(evidence)
  } catch {
    return failEvidence()
  }
  const { start, end } = evidence
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) failEvidence()
  if (start < 0 || start >= end || end > source.text.length) failEvidence()
  if (!isScalarBoundary(source.text, start) || !isScalarBoundary(source.text, end)) failEvidence()
  if (evidence.sourceRevisionId !== source.id) failEvidence()
  if (source.text.slice(start, end) !== evidence.quote) failEvidence()
  if (sha256Utf8(evidence.quote) !== evidence.quoteHash) failEvidence()
  return evidence
}

function duplicate(values: readonly string[]): boolean {
  return new Set(values).size !== values.length
}

function failCandidate(): never {
  throw new Error('invalid-analysis-candidate')
}

export function validateAnalysisCandidate(
  input: AnalysisInput,
  candidate: AnalysisCandidate,
  sha256Utf8: (value: string) => Sha256Hex,
): AnalysisCandidate {
  try {
    validatePersistedSource(input.source, sha256Utf8)
    analysisCandidateSchema.parse(candidate)
  } catch {
    return failCandidate()
  }

  if (input.projectId !== input.source.projectId) failCandidate()
  if (!Number.isSafeInteger(input.generation) || input.generation < 1) failCandidate()
  if (!Number.isSafeInteger(input.baseProjectVersion) || input.baseProjectVersion < 1) failCandidate()
  if (candidate.analysis.id !== input.analysisRevisionId
    || candidate.analysis.sourceRevisionId !== input.source.id
    || candidate.analysis.generation !== input.generation
    || candidate.analysis.baseProjectVersion !== input.baseProjectVersion
    || candidate.analysis.status !== 'draft') failCandidate()

  const evidenceIds = candidate.evidence.map(item => item.id)
  if (duplicate(evidenceIds)) failCandidate()
  let evidenceQuoteBytes = 0
  for (const evidence of candidate.evidence) {
    validateEvidence(input.source, evidence, sha256Utf8)
    evidenceQuoteBytes += utf8ByteLength(evidence.quote)
  }
  if (evidenceQuoteBytes > MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES) failCandidate()

  const evidenceIdSet = new Set(evidenceIds)
  const draftIds = candidate.generatedRequirements.map(item => item.id)
  const requirementIds = candidate.generatedRequirements.map(item => item.requirementId)
  if (duplicate(draftIds) || duplicate(requirementIds)) failCandidate()

  let analysisAssumptionAndUnknownBytes = 0
  for (const requirement of candidate.generatedRequirements) {
    if (requirement.analysisRevisionId !== candidate.analysis.id
      || requirement.sourceRevisionId !== input.source.id) failCandidate()
    if (candidate.analysis.kind === 'fixture' ? requirement.producer !== 'fixture' : requirement.producer !== 'ai') {
      failCandidate()
    }
    if (duplicate(requirement.evidenceIds) || requirement.evidenceIds.some(id => !evidenceIdSet.has(id))) {
      failCandidate()
    }
    if (duplicate(requirement.assumptions) || duplicate(requirement.unknowns)) failCandidate()
    analysisAssumptionAndUnknownBytes += requirement.assumptions.reduce(
      (sum, item) => sum + utf8ByteLength(item), 0,
    )
    analysisAssumptionAndUnknownBytes += requirement.unknowns.reduce(
      (sum, item) => sum + utf8ByteLength(item), 0,
    )
  }
  if (analysisAssumptionAndUnknownBytes > MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES) {
    failCandidate()
  }
  return candidate
}
