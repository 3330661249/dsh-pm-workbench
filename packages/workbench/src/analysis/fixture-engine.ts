import type { Sha256Hex } from '../domain/ids.js'
import type { AnalysisCandidate } from '../domain/model.js'
import { validateAnalysisCandidate } from '../domain/evidence.js'
import type {
  AnalysisInput,
  FixtureManifest,
  InsightEngine,
} from './types.js'
import { deepFreeze, DomainFailure } from './types.js'

export class FixtureInsightEngine implements InsightEngine {
  constructor(
    private readonly manifest: FixtureManifest,
    private readonly sha256Utf8: (value: string) => Sha256Hex,
  ) {}

  async analyse(input: AnalysisInput, signal: AbortSignal): Promise<AnalysisCandidate> {
    signal.throwIfAborted()
    if (input.mode && input.mode !== 'fixture') throw new DomainFailure('stage-unavailable')
    const fixture = this.manifest.sources[input.source.contentHash]
    if (!fixture) throw new DomainFailure('fixture-not-allowed')

    const template = structuredClone(fixture.candidate)
    const candidate: AnalysisCandidate = {
      analysis: {
        ...template.analysis,
        id: input.analysisRevisionId,
        sourceRevisionId: input.source.id,
        generation: input.generation,
        baseProjectVersion: input.baseProjectVersion,
      },
      evidence: template.evidence.map(item => ({ ...item, sourceRevisionId: input.source.id })),
      generatedRequirements: template.generatedRequirements.map(item => ({
        ...item,
        analysisRevisionId: input.analysisRevisionId,
        sourceRevisionId: input.source.id,
      })),
    }
    validateAnalysisCandidate(input, candidate, this.sha256Utf8)
    signal.throwIfAborted()
    return deepFreeze(candidate)
  }
}
