import type {
  AnalysisRevisionId,
  ProjectId,
  Sha256Hex,
} from '../domain/ids.js'
import type {
  AnalysisCandidate,
  SourceRevision,
} from '../domain/model.js'

export interface AnalysisInput {
  readonly projectId: ProjectId
  readonly source: SourceRevision
  readonly analysisRevisionId: AnalysisRevisionId
  readonly generation: number
  readonly baseProjectVersion: number
}

export interface FixtureManifestSource {
  readonly candidate: AnalysisCandidate
}

export interface FixtureManifest {
  readonly schemaVersion: 1
  readonly sources: Readonly<Partial<Record<Sha256Hex, FixtureManifestSource>>>
}

export interface InsightEngine {
  analyse(input: AnalysisInput, signal: AbortSignal): Promise<AnalysisCandidate>
}

export class DomainFailure extends Error {
  readonly code: string

  constructor(code: string) {
    super(code)
    this.name = 'DomainFailure'
    this.code = code
  }
}

export function deepFreeze<T>(value: T): T {
  if (typeof value !== 'object' || value === null || Object.isFrozen(value)) return value
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key)
    if (descriptor && 'value' in descriptor) deepFreeze(descriptor.value)
  }
  return Object.freeze(value)
}
