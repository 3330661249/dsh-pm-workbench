import { CompatibilityEvidenceError } from './errors.js'

export interface NormalizedDiscovery {
  readonly package: string
  readonly root: string
  readonly faces: readonly string[]
}

export interface NormalizedEmitResult {
  readonly package: string
  readonly packageRoot: string
  readonly face: string
  readonly exports: readonly string[]
  readonly js: string
  readonly dts: string
  readonly remote?: {
    readonly js: string
    readonly dts: string
    readonly dtsMap: string
  }
}

export interface DirectGeneratorEvidence {
  readonly discover: readonly NormalizedDiscovery[]
  readonly automatic: readonly NormalizedEmitResult[]
  readonly forced: readonly NormalizedEmitResult[]
}

export type ExpectedArtifactContents = Record<
  | 'lib/typert.host.js'
  | 'lib/typert.host.d.ts'
  | 'lib/typert.remote-client.js'
  | 'lib/typert.remote-client.d.ts'
  | 'lib/typert.remote-client.d.ts.map',
  string
>

const PACKAGE = '@knight/dsh-typert-matrix-probe'

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stable(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function requireEmit(result: NormalizedEmitResult | undefined, label: string): NormalizedEmitResult {
  if (result === undefined) {
    throw new CompatibilityEvidenceError('GENERATION_EMPTY', `${label} generation is empty`)
  }
  if (result.package !== PACKAGE || result.packageRoot !== 'packages/probe' || result.face !== 'host') {
    throw new CompatibilityEvidenceError('GENERATION_IDENTITY', `${label} generation identity mismatch`)
  }
  if (
    result.js.length === 0
    || result.dts.length === 0
    || result.remote === undefined
    || result.remote.js.length === 0
    || result.remote.dts.length === 0
    || result.remote.dtsMap.length === 0
  ) {
    throw new CompatibilityEvidenceError(
      'REMOTE_GENERATION_EMPTY',
      `${label} must contain non-empty Remote and Host artifact strings`,
    )
  }
  return result
}

export function validateDirectGeneration(
  evidence: DirectGeneratorEvidence,
): ExpectedArtifactContents {
  if (
    evidence.discover.length !== 1
    || evidence.discover[0]?.package !== PACKAGE
    || evidence.discover[0]?.root !== 'packages/probe'
    || stable(evidence.discover[0]?.faces) !== stable(['host'])
  ) {
    throw new CompatibilityEvidenceError(
      'DISCOVERY_MISMATCH',
      'discover must return exactly the probe package root and host face',
    )
  }
  if (evidence.automatic.length !== 1 || evidence.forced.length !== 1) {
    throw new CompatibilityEvidenceError(
      'GENERATION_EMPTY',
      'automatic and forced generation must each return exactly one result; generation is empty or ambiguous',
    )
  }
  const automatic = requireEmit(evidence.automatic[0], 'automatic')
  const forced = requireEmit(evidence.forced[0], 'forced')
  if (stable(automatic) !== stable(forced)) {
    throw new CompatibilityEvidenceError(
      'GENERATION_DISAGREEMENT',
      'automatic and forced generation results disagree',
    )
  }
  return {
    'lib/typert.host.js': automatic.js,
    'lib/typert.host.d.ts': automatic.dts,
    'lib/typert.remote-client.js': automatic.remote!.js,
    'lib/typert.remote-client.d.ts': automatic.remote!.dts,
    'lib/typert.remote-client.d.ts.map': automatic.remote!.dtsMap,
  }
}
