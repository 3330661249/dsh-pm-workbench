import { createHash } from 'node:crypto'
import {
  aggregateMatrix,
  assertSupportedRuntimeMetadata,
  type MatrixReport,
} from './aggregate.js'
import { REQUIRED_ARTIFACTS } from './assertions/artifacts.js'
import {
  assertDerivedFailureAssertion,
  assertDerivedPassAssertions,
  buildDirectGeneratorSummary,
  deriveFailureAssertion,
  derivePassAssertions,
  type DirectGeneratorSummary,
  type PassAssertionContext,
  type PassAssertionId,
} from './assertion-results.js'
import { parseMatrixConfig } from './config.js'
import { isCanonicalSha512Integrity } from './integrity.js'
import { assertRunProvenance } from './provenance.js'
import { REVIEWED_LOCK_SET_CASE_COUNT } from './reviewed-locks.js'
import {
  INSTALLED_PACKAGE_NAMES,
  OFFICIAL_PACKAGE_NAMES,
  type AssertionResult,
  type CaseValidationEvidence,
  type CaseEvidence,
  type CaseStatus,
  type MatrixCase,
  type MatrixConfig,
} from './types.js'

function stable(value: unknown, indent = 0): string {
  if (Array.isArray(value)) return `[${value.map((item) => stable(item, indent + 1)).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stable(nested, indent + 1)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function serializeMatrixReport(report: MatrixReport): string {
  const projected = {
    ...report,
    cases: report.cases.map((item) => projectCanonicalCase(item, report.config)),
  }
  verifyProjectedReport(projected)
  return `${stable(projected)}\n`
}

const SHA256 = /^[a-f0-9]{64}$/
const EMPTY_SHA256 = createHash('sha256').update('').digest('hex')

function digest(value: unknown): string {
  return createHash('sha256').update(stable(value)).digest('hex')
}

function canonicalEvidenceRefs(value: Record<string, unknown>): string[] {
  const refs: string[] = []
  if (value.provenance !== undefined) refs.push(`provenance:sha256:${digest(value.provenance)}`)
  if (value.fixtureSha256 !== undefined) {
    refs.push(`fixture:sha256:${String(value.fixtureSha256)}`)
  }
  if (value.lockSha256 !== undefined) refs.push(`lock:sha256:${String(value.lockSha256)}`)
  if (value.installedGraphSha256 !== undefined) {
    refs.push(`installed-graph:sha256:${String(value.installedGraphSha256)}`)
  }
  if (value.reviewedLock !== undefined) {
    refs.push(`reviewed-lock:sha256:${digest(value.reviewedLock)}`)
  }
  if (value.registry !== undefined) refs.push(`registry:sha256:${digest(value.registry)}`)
  if (value.stages !== undefined) refs.push(`stages:sha256:${digest(value.stages)}`)
  if (value.directGeneratorSummary !== undefined) {
    refs.push(`direct-generator:sha256:${digest(value.directGeneratorSummary)}`)
  }
  if (value.nonDecisiveDiagnostics !== undefined) {
    refs.push(`diagnostic:sha256:${digest(value.nonDecisiveDiagnostics)}`)
  }
  if (value.validationEvidence !== undefined) {
    refs.push(`validation:sha256:${digest(value.validationEvidence)}`)
  }
  refs.push(`artifacts:sha256:${digest(value.artifacts)}`)
  return refs
}

function passEvidenceRefs(value: Record<string, unknown>, id: PassAssertionId): string[] {
  const all = canonicalEvidenceRefs(value)
  const prefixes: Record<string, readonly string[]> = {
    A01: ['registry:'], A02: ['registry:'], A03: ['lock:', 'registry:', 'validation:'],
    A04: ['stages:'], A05: ['stages:', 'installed-graph:', 'validation:'], A06: ['validation:'],
    A07: ['installed-graph:', 'validation:'], A08: ['fixture:', 'provenance:', 'validation:'], A09: ['validation:'],
    B01: ['stages:'], B02: ['direct-generator:'], B03: ['direct-generator:'],
    B04: ['direct-generator:'], B05: ['direct-generator:'], B06: ['stages:'], B07: ['stages:', 'diagnostic:'],
    C01: ['artifacts:', 'validation:'], C02: ['artifacts:', 'validation:'],
    C03: ['artifacts:', 'validation:'], C04: ['artifacts:', 'validation:'], C05: ['artifacts:', 'validation:'],
    C06: ['validation:'], C07: ['validation:'],
    C08: ['artifacts:', 'direct-generator:', 'validation:'], C09: ['validation:'],
    C10: ['stages:', 'validation:'],
    D01: ['validation:'], D02: ['validation:'], D03: ['validation:'], D04: ['validation:'],
    D05: ['validation:'], D06: ['validation:'], D07: ['validation:'], D08: ['validation:'],
    D09: ['validation:'], D10: ['validation:'],
  }
  return all.filter((ref) => prefixes[id]!.some((prefix) => ref.startsWith(prefix)))
}

function passContext(
  input: CaseEvidence,
  config: MatrixReport['config'],
  directGeneratorSummary: DirectGeneratorSummary,
): PassAssertionContext {
  if (
    input.lockSha256 === undefined
    || input.installedGraphSha256 === undefined
    || input.registry === undefined
    || input.stages === undefined
    || input.nonDecisiveDiagnostics?.ordinaryBundle === undefined
    || input.validationEvidence === undefined
    || input.validationEvidence.fixtureCopy === undefined
    || input.validationEvidence.lock === undefined
    || input.validationEvidence.installedGraph === undefined
    || input.validationEvidence.workspaceLink === undefined
    || input.validationEvidence.preseed === undefined
    || input.validationEvidence.generatedArtifacts === undefined
    || input.validationEvidence.descriptors === undefined
  ) throw new Error('PASS case is missing assertion derivation evidence')
  return {
    config,
    matrixCase: input.case,
    fixtureSha256: input.fixtureSha256,
    lockSha256: input.lockSha256,
    installedGraphSha256: input.installedGraphSha256,
    registry: input.registry,
    stages: input.stages,
    artifacts: input.artifacts,
    directGeneratorSummary,
    nonDecisiveDiagnostics: input.nonDecisiveDiagnostics,
    validationEvidence: input.validationEvidence as Required<CaseValidationEvidence>,
  }
}

function projectCanonicalCase(input: CaseEvidence, config: MatrixReport['config']): Record<string, unknown> {
  const value = { ...input } as Record<string, unknown>
  delete value.directGenerator
  const existingSummary = (input as unknown as { directGeneratorSummary?: unknown }).directGeneratorSummary
  delete value.directGeneratorSummary
  const summary = input.directGenerator === undefined && existingSummary !== undefined
    ? validateDirectGeneratorSummary(existingSummary)
    : buildDirectGeneratorSummary(input.directGenerator, input.status === 'PASS')
  if (summary !== undefined) value.directGeneratorSummary = summary
  if (input.status === 'PASS') {
    if (summary === undefined) throw new Error('PASS case is missing direct-generator summary')
    const derived = derivePassAssertions(
      passContext(input, config, summary),
      (id) => passEvidenceRefs(value, id),
    )
    assertDerivedPassAssertions(input.assertions, derived, true)
    value.assertions = derived
  } else {
    const refs = canonicalEvidenceRefs(value)
    if (input.failure === undefined) throw new Error('non-PASS case is missing typed failure evidence')
    const derived = deriveFailureAssertion(input.status, input.failure, refs)
    assertDerivedFailureAssertion(input.assertions, derived, true)
    value.assertions = [derived]
  }
  return value
}

const SENSITIVE_KEY = /(?:api.?key|token|secret|password|credential|authorization|cookie|private.?key|access.?key|session.?key)/i
const TOKEN_VALUE = /(?:\bgh[pousr]_[A-Za-z0-9_]{20,}\b|\bnpm_[A-Za-z0-9]{20,}\b|\bsk-[A-Za-z0-9_-]{16,}\b|\bBearer\s+[A-Za-z0-9._~+/=-]{16,}|\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|\b[A-Za-z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)=[^\s]+|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i
const GENERATED_SOURCE_VALUE = /(?:\/\*\s*Generated by @deepseek-ai\/dsh-typert-generator|^(?:export|import)\s+(?:declare\s+)?(?:const|type|interface|class|function|\{))/m

function containsLocalPath(value: string): boolean {
  if (/\bfile:/i.test(value)) return true
  if (/(?<![A-Za-z0-9.\/>])\/(?![\/<>])[^\s"'`<>]*/.test(value)) return true
  return /(?<![A-Za-z0-9])(?:[A-Za-z]:[\\/][^\s"'`<>]*|\\\\[^\\/\s"'`<>]+[\\/][^\s"'`<>]*)/.test(value)
}

function assertCanonicalSafety(value: unknown, at = 'report'): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertCanonicalSafety(item, `${at}[${index}]`))
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      if (key === 'directGenerator' || (key !== 'cwdToken' && SENSITIVE_KEY.test(key))) {
        throw new Error(`report contains sensitive or forbidden canonical field ${at}.${key}`)
      }
      assertCanonicalSafety(nested, `${at}.${key}`)
    }
    return
  }
  if (
    typeof value === 'number'
    && (!Number.isFinite(value) || Math.abs(value) > Number.MAX_SAFE_INTEGER)
  ) {
    throw new Error(`report contains a non-canonical number at ${at}`)
  }
  if (typeof value === 'string') {
    if (TOKEN_VALUE.test(value)) throw new Error(`report contains a token-shaped value at ${at}`)
    const registryIntegrity = /^report\.cases\[\d+\]\.registry\[\d+\]\.integrity$/.test(at)
    if (registryIntegrity) {
      if (!isCanonicalSha512Integrity(value)) {
        throw new Error(`report contains invalid registry integrity at ${at}`)
      }
    } else if (containsLocalPath(value)) {
      throw new Error(`report contains an absolute local path at ${at}`)
    }
    if (GENERATED_SOURCE_VALUE.test(value) || /[\r\n]/.test(value)) {
      throw new Error(`report contains sensitive raw source or log text at ${at}`)
    }
  }
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`report ${label} must be an object`)
  }
  return value as Record<string, unknown>
}

const STATUSES = new Set<CaseStatus>([
  'PASS',
  'FAIL_COMPATIBILITY',
  'INCONCLUSIVE_REGISTRY',
  'INCONCLUSIVE_LOCK',
  'INCONCLUSIVE_ADAPTER',
  'INFRA_ERROR',
])

function parseCases(value: unknown, config: ReturnType<typeof parseMatrixConfig>): CaseEvidence[] {
  if (!Array.isArray(value)) throw new Error('report cases must be an array')
  return value.map((input) => {
    const item = object(input, 'case')
    exactKeys(item, [
      'schemaVersion', 'case', 'fixtureSha256', 'status', 'assertions', 'artifacts', 'lockSha256',
      'installedGraphSha256', 'reviewedLock', 'registry', 'failure', 'nonDecisiveDiagnostics',
      'stages', 'directGeneratorSummary', 'provenance',
      'validationEvidence',
    ], 'case')
    if (item.schemaVersion !== '1') throw new Error('report case schemaVersion is invalid')
    const matrixCase = object(item.case, 'matrix case')
    exactKeys(matrixCase, ['id', 'role', 'release', 'packages'], 'matrix case')
    if (typeof matrixCase.id !== 'string' || typeof matrixCase.role !== 'string') {
      throw new Error('report matrix case identity is invalid')
    }
    const release = object(matrixCase.release, 'matrix case release')
    exactKeys(release, ['@deepseek-ai/dsh'], 'matrix case release')
    if (typeof release['@deepseek-ai/dsh'] !== 'string') {
      throw new Error('report matrix case release is invalid')
    }
    const packages = object(matrixCase.packages, 'matrix case packages')
    exactKeys(packages, INSTALLED_PACKAGE_NAMES, 'matrix case packages')
    if (INSTALLED_PACKAGE_NAMES.some((name) => typeof packages[name] !== 'string')) {
      throw new Error('report matrix case packages are invalid')
    }
    if (!STATUSES.has(item.status as CaseStatus)) throw new Error('report case status is invalid')
    if (!Array.isArray(item.assertions) || !Array.isArray(item.artifacts)) {
      throw new Error('report case evidence arrays are invalid')
    }
    if (item.assertions.length === 0) throw new Error('report case must contain an assertion')
    for (const assertion of item.assertions) {
      const entry = object(assertion, 'assertion')
      exactKeys(entry, ['id', 'status', 'expected', 'actualSummary', 'evidenceRefs'], 'assertion')
      if (
        typeof entry.id !== 'string'
        || !['PASS', 'FAIL', 'BLOCKED'].includes(String(entry.status))
        || !Array.isArray(entry.evidenceRefs)
        || entry.evidenceRefs.some((ref) => typeof ref !== 'string')
      ) throw new Error('report assertion is invalid')
    }
    for (const artifact of item.artifacts) {
      const entry = object(artifact, 'artifact')
      exactKeys(entry, ['path', 'size', 'sha256', 'createdAtMs'], 'artifact')
      if (
        typeof entry.path !== 'string'
        || !Number.isSafeInteger(entry.size)
        || (entry.size as number) <= 0
        || typeof entry.sha256 !== 'string'
        || !/^[a-f0-9]{64}$/.test(entry.sha256)
        || typeof entry.createdAtMs !== 'number'
        || !Number.isFinite(entry.createdAtMs)
        || entry.createdAtMs < 0
        || entry.createdAtMs > Number.MAX_SAFE_INTEGER
      ) throw new Error('report artifact is invalid')
    }
    validateOptionalCaseProvenance(item)
    validateCaseValidationEvidence(item.validationEvidence, item, config, item.status === 'PASS')
    if (typeof item.fixtureSha256 !== 'string' || !SHA256.test(item.fixtureSha256)) {
      throw new Error('report case fixtureSha256 provenance is invalid')
    }
    const provenance = item.provenance
    assertRunProvenance(provenance, config)
    validateReviewedLockBinding(item)
    if (item.fixtureSha256 !== provenance.fixtureSha256) {
      throw new Error('report case fixture SHA differs from run provenance')
    }
    const summary = item.directGeneratorSummary === undefined
      ? undefined
      : validateDirectGeneratorSummary(item.directGeneratorSummary)
    validateTypedFailure(item, summary)
    validateFailureProvenance(item, summary, config)
    validateEvidenceRefs(item)
    if (item.status === 'PASS') validatePassProvenance(item, summary, config)
    return item as unknown as CaseEvidence
  })
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const extra = Object.keys(value).find((key) => !allowed.includes(key))
  if (extra !== undefined) throw new Error(`report ${label} has unknown key ${extra}`)
}

function validateReviewedLockBinding(item: Record<string, unknown>): void {
  const provenance = object(item.provenance, 'case provenance')
  if (provenance.lockMode === 'resolve') {
    if (item.reviewedLock !== undefined) {
      throw new Error('report resolve case cannot contain reviewed lock evidence')
    }
    return
  }
  if (provenance.lockMode !== 'frozen') {
    throw new Error('report case lock mode is invalid')
  }
  const reviewed = object(item.reviewedLock, 'reviewed lock evidence')
  exactKeys(reviewed, [
    'schemaVersion', 'platformKey', 'manifestSha256', 'manifestCaseCount',
    'lockSha256', 'installedGraphSha256',
  ], 'reviewed lock evidence')
  if (
    reviewed.schemaVersion !== '1'
    || reviewed.platformKey !== provenance.platformKey
    || typeof reviewed.manifestSha256 !== 'string'
    || !SHA256.test(reviewed.manifestSha256)
    || reviewed.manifestCaseCount !== REVIEWED_LOCK_SET_CASE_COUNT
    || typeof reviewed.lockSha256 !== 'string'
    || !SHA256.test(reviewed.lockSha256)
    || typeof reviewed.installedGraphSha256 !== 'string'
    || !SHA256.test(reviewed.installedGraphSha256)
  ) throw new Error('report frozen reviewed lock evidence is invalid')
  if (item.lockSha256 !== undefined && item.lockSha256 !== reviewed.lockSha256) {
    throw new Error('report frozen lock SHA differs from reviewed lock manifest')
  }
  if (
    item.installedGraphSha256 !== undefined
    && item.installedGraphSha256 !== reviewed.installedGraphSha256
  ) throw new Error('report frozen installed graph SHA differs from reviewed lock manifest')
}

function validateReviewedLockSetIdentity(cases: readonly CaseEvidence[]): void {
  const first = cases[0]
  if (first === undefined || first.provenance?.lockMode !== 'frozen') return
  const expected = stable({
    platformKey: first.reviewedLock?.platformKey,
    manifestSha256: first.reviewedLock?.manifestSha256,
    manifestCaseCount: first.reviewedLock?.manifestCaseCount,
  })
  for (const item of cases) {
    if (item.provenance?.lockMode !== 'frozen' || item.reviewedLock === undefined) {
      throw new Error('report frozen cases do not share reviewed lock evidence')
    }
    const observed = stable({
      platformKey: item.reviewedLock.platformKey,
      manifestSha256: item.reviewedLock.manifestSha256,
      manifestCaseCount: item.reviewedLock.manifestCaseCount,
    })
    if (observed !== expected) {
      throw new Error('report frozen cases do not share one reviewed lock manifest')
    }
  }
}

function hashRecord(value: unknown, label: string): Record<string, unknown> {
  const result = object(value, label)
  exactKeys(result, REQUIRED_ARTIFACTS, label)
  for (const artifact of REQUIRED_ARTIFACTS) {
    if (typeof result[artifact] !== 'string' || !SHA256.test(result[artifact])) {
      throw new Error(`report ${label} has invalid artifact hash`)
    }
  }
  return result
}

function validateArtifactStateRecord(value: unknown, label: string): {
  readonly completeAndNonEmpty: boolean
  readonly states: Record<string, Record<string, unknown>>
} {
  const states = object(value, label)
  exactKeys(states, REQUIRED_ARTIFACTS, label)
  let completeAndNonEmpty = true
  const parsed: Record<string, Record<string, unknown>> = {}
  for (const artifact of REQUIRED_ARTIFACTS) {
    const state = object(states[artifact], `${label} ${artifact}`)
    exactKeys(state, ['present', 'bytes', 'sha256'], `${label} ${artifact}`)
    if (typeof state.present !== 'boolean' || !Number.isSafeInteger(state.bytes)) {
      throw new Error(`report ${label} has an invalid artifact state`)
    }
    if (state.present) {
      if (
        (state.bytes as number) < 0
        || typeof state.sha256 !== 'string'
        || !SHA256.test(state.sha256)
      ) throw new Error(`report ${label} has invalid present artifact evidence`)
      if (state.bytes === 0) completeAndNonEmpty = false
    } else {
      if (state.bytes !== 0 || state.sha256 !== null) {
        throw new Error(`report ${label} has inconsistent missing artifact evidence`)
      }
      completeAndNonEmpty = false
    }
    parsed[artifact] = state
  }
  return { completeAndNonEmpty, states: parsed }
}

function validateDirectGeneratorSummary(value: unknown): DirectGeneratorSummary {
  const summary = object(value, 'direct-generator summary')
  exactKeys(summary, [
    'schemaVersion', 'rawSourceIncluded', 'discovery', 'automaticCount', 'forcedCount',
    'automaticIdentity', 'forcedIdentity',
    'automaticArtifactState', 'forcedArtifactState',
    'automaticArtifactSha256', 'forcedArtifactSha256',
    'automaticArtifactBytes', 'forcedArtifactBytes',
  ], 'direct-generator summary')
  if (summary.schemaVersion !== '1' || summary.rawSourceIncluded !== false) {
    throw new Error('report direct-generator summary safety marker is invalid')
  }
  if (!Array.isArray(summary.discovery)) {
    throw new Error('report direct-generator discovery summary is invalid')
  }
  for (const discoveryInput of summary.discovery) {
    const discovery = object(discoveryInput, 'direct-generator discovery')
    exactKeys(discovery, ['package', 'root', 'faces'], 'direct-generator discovery')
    if (
      typeof discovery.package !== 'string'
      || typeof discovery.root !== 'string'
      || !Array.isArray(discovery.faces)
      || discovery.faces.some((face) => typeof face !== 'string')
    ) throw new Error('report direct-generator discovery summary is invalid')
  }
  for (const key of ['automaticCount', 'forcedCount'] as const) {
    if (!Number.isSafeInteger(summary[key]) || (summary[key] as number) < 0) {
      throw new Error(`report direct-generator ${key} is invalid`)
    }
  }
  for (const [countKey, identityKey, stateKey, hashKey, bytesKey] of [
    [
      'automaticCount', 'automaticIdentity', 'automaticArtifactState',
      'automaticArtifactSha256', 'automaticArtifactBytes',
    ],
    [
      'forcedCount', 'forcedIdentity', 'forcedArtifactState',
      'forcedArtifactSha256', 'forcedArtifactBytes',
    ],
  ] as const) {
    const singletonFields = [summary[identityKey], summary[stateKey]]
    const completeFields = [summary[hashKey], summary[bytesKey]]
    if (summary[countKey] === 1) {
      if (singletonFields.some((field) => field === undefined)) {
        throw new Error(`report ${identityKey} source-free evidence is incomplete for one generation result`)
      }
      const identity = object(summary[identityKey], `${identityKey}`)
      exactKeys(identity, ['package', 'packageRoot', 'face', 'exports'], `${identityKey}`)
      if (
        (identity.package !== null && typeof identity.package !== 'string')
        || (identity.packageRoot !== null && typeof identity.packageRoot !== 'string')
        || (identity.face !== null && typeof identity.face !== 'string')
        || (
          identity.exports !== null
          && (!Array.isArray(identity.exports) || identity.exports.some((entry) => typeof entry !== 'string'))
        )
      ) throw new Error(`report ${identityKey} is invalid`)
      const artifactState = validateArtifactStateRecord(summary[stateKey], stateKey)
      if (artifactState.completeAndNonEmpty) {
        if (completeFields.some((field) => field === undefined)) {
          throw new Error(`report ${identityKey} complete artifact evidence is missing`)
        }
        const hashes = hashRecord(summary[hashKey], hashKey)
        const bytes = object(summary[bytesKey], bytesKey)
        exactKeys(bytes, REQUIRED_ARTIFACTS, bytesKey)
        for (const artifact of REQUIRED_ARTIFACTS) {
          const state = artifactState.states[artifact]!
          if (
            !Number.isSafeInteger(bytes[artifact])
            || (bytes[artifact] as number) <= 0
            || bytes[artifact] !== state.bytes
            || hashes[artifact] !== state.sha256
          ) throw new Error(`report ${bytesKey} differs from the source-free artifact state`)
        }
      } else if (completeFields.some((field) => field !== undefined)) {
        throw new Error(`report ${identityKey} incomplete result cannot claim complete artifact maps`)
      }
    } else if ([...singletonFields, ...completeFields].some((field) => field !== undefined)) {
      throw new Error(`report ${identityKey} evidence requires exactly one generation result`)
    }
  }
  return summary as unknown as DirectGeneratorSummary
}

type DirectGeneratorClassification =
  | 'DISCOVERY_MISMATCH'
  | 'GENERATION_EMPTY'
  | 'GENERATION_IDENTITY'
  | 'REMOTE_GENERATION_EMPTY'
  | 'GENERATION_DISAGREEMENT'
  | 'SUCCESS'

function singletonFailure(
  summary: DirectGeneratorSummary,
  side: 'automatic' | 'forced',
): 'GENERATION_IDENTITY' | 'REMOTE_GENERATION_EMPTY' | undefined {
  const identity = side === 'automatic' ? summary.automaticIdentity : summary.forcedIdentity
  if (
    identity === undefined
    || identity.package !== '@knight/dsh-typert-matrix-probe'
    || identity.packageRoot !== 'packages/probe'
    || identity.face !== 'host'
  ) return 'GENERATION_IDENTITY'
  const state = side === 'automatic'
    ? summary.automaticArtifactState
    : summary.forcedArtifactState
  if (
    state === undefined
    || REQUIRED_ARTIFACTS.some((artifact) => (
      state[artifact].present !== true || state[artifact].bytes <= 0
    ))
  ) return 'REMOTE_GENERATION_EMPTY'
  return undefined
}

function classifyDirectGeneratorSummary(
  summary: DirectGeneratorSummary,
): DirectGeneratorClassification {
  const expectedDiscovery = [{
    package: '@knight/dsh-typert-matrix-probe',
    root: 'packages/probe',
    faces: ['host'],
  }]
  if (stable(summary.discovery) !== stable(expectedDiscovery)) return 'DISCOVERY_MISMATCH'
  if (summary.automaticCount !== 1 || summary.forcedCount !== 1) return 'GENERATION_EMPTY'
  const automaticFailure = singletonFailure(summary, 'automatic')
  if (automaticFailure !== undefined) return automaticFailure
  const forcedFailure = singletonFailure(summary, 'forced')
  if (forcedFailure !== undefined) return forcedFailure
  if (
    stable(summary.automaticIdentity) !== stable(summary.forcedIdentity)
    || stable(summary.automaticArtifactState) !== stable(summary.forcedArtifactState)
  ) {
    return 'GENERATION_DISAGREEMENT'
  }
  return 'SUCCESS'
}

const KNOWN_FAILURE_STAGES = new Set([
  'preflight', 'workspace', 'registry', 'lock', 'install', 'compile',
  'direct-generator', 'tsdown', 'pack-dry-run', 'descriptors',
])

const COMPATIBILITY_FAILURE_STAGE = new Map<string, string>([
  ['PRESEEDED_ARTIFACT', 'install'],
  ['TYPESCRIPT_FAILED', 'compile'],
  ['DISCOVERY_MISMATCH', 'direct-generator'],
  ['GENERATION_EMPTY', 'direct-generator'],
  ['GENERATION_IDENTITY', 'direct-generator'],
  ['REMOTE_GENERATION_EMPTY', 'direct-generator'],
  ['GENERATION_DISAGREEMENT', 'direct-generator'],
  ['TSDOWN_FAILED', 'tsdown'],
  ['PACK_DRY_RUN_FAILED', 'pack-dry-run'],
  ['PACK_OUTPUT_INVALID', 'pack-dry-run'],
  ['ARTIFACT_MISSING', 'pack-dry-run'],
  ['ARTIFACT_SYMLINK', 'pack-dry-run'],
  ['ARTIFACT_NOT_REGULAR', 'pack-dry-run'],
  ['ARTIFACT_BOUNDARY', 'pack-dry-run'],
  ['ARTIFACT_EMPTY', 'pack-dry-run'],
  ['ARTIFACT_STALE', 'pack-dry-run'],
  ['ARTIFACT_HASH_MISMATCH', 'pack-dry-run'],
  ['ARTIFACT_HEADER', 'pack-dry-run'],
  ['SOURCE_MAP_INVALID', 'pack-dry-run'],
  ['SOURCE_MAP_ABSOLUTE', 'pack-dry-run'],
  ['PACKAGE_EXPORTS', 'pack-dry-run'],
  ['PACKAGE_FILES', 'pack-dry-run'],
  ['PACK_ARTIFACT_MISSING', 'pack-dry-run'],
  ['PACK_FORBIDDEN_FILE', 'pack-dry-run'],
  ['DESCRIPTOR_SHAPE', 'descriptors'],
  ['CODEC_PERMISSIVE', 'descriptors'],
  ['CODEC_TYPE_SYMBOL', 'descriptors'],
  ['CODEC_SCHEMA', 'descriptors'],
  ['CODEC_VALID_REJECTED', 'descriptors'],
  ['CODEC_INVALID_ACCEPTED', 'descriptors'],
  ['METHOD_INVENTORY', 'descriptors'],
  ['REMOTE_IDENTITY', 'descriptors'],
  ['HOST_IDENTITY', 'descriptors'],
  ['REMOTE_PACKAGE', 'descriptors'],
  ['METHOD_MISMATCH', 'descriptors'],
  ['PARAMETER_INVENTORY', 'descriptors'],
  ['CODEC_SYMBOL_MISMATCH', 'descriptors'],
])

function validateTypedFailure(
  item: Record<string, unknown>,
  directSummary: DirectGeneratorSummary | undefined,
): void {
  const status = item.status as CaseStatus
  if (status === 'PASS') {
    if (item.failure !== undefined) throw new Error('report PASS case cannot contain failure evidence')
    return
  }
  const failure = object(item.failure, 'failure')
  exactKeys(failure, ['code', 'stage'], 'failure')
  if (
    typeof failure.code !== 'string'
    || typeof failure.stage !== 'string'
    || !KNOWN_FAILURE_STAGES.has(failure.stage)
  ) throw new Error('report failure code or stage is invalid')

  const typed = status === 'INCONCLUSIVE_REGISTRY'
    ? failure.code === 'REGISTRY_EVIDENCE' && failure.stage === 'registry'
    : status === 'INCONCLUSIVE_LOCK'
      ? failure.code === 'LOCK_EVIDENCE' && (failure.stage === 'lock' || failure.stage === 'install')
      : status === 'INCONCLUSIVE_ADAPTER'
        ? failure.code === 'ADAPTER_EVIDENCE' && failure.stage === 'direct-generator'
        : status === 'INFRA_ERROR'
          ? failure.code === 'RUNNER_OR_INFRA_ERROR'
          : COMPATIBILITY_FAILURE_STAGE.get(failure.code) === failure.stage
  if (!typed) throw new Error('report failure type does not match case status or stage')

  const derived = deriveFailureAssertion(
    status as Exclude<CaseStatus, 'PASS'>,
    { code: failure.code, stage: failure.stage },
    canonicalEvidenceRefs(item),
  )
  assertDerivedFailureAssertion(
    item.assertions as unknown as AssertionResult[],
    derived,
    false,
  )

  if (
    status === 'FAIL_COMPATIBILITY'
    && ['direct-generator', 'tsdown', 'pack-dry-run', 'descriptors'].includes(failure.stage)
    && directSummary === undefined
  ) throw new Error('report compatibility failure is missing direct-generator summary')
}

function validateRegistry(value: unknown): void {
  if (!Array.isArray(value)) throw new Error('report registry provenance is invalid')
  for (const input of value) {
    const entry = object(input, 'registry provenance')
    exactKeys(entry, [
      'name', 'requestedVersion', 'returnedVersion', 'integrity', 'tarballOrigin',
      'repositoryUrl', 'observedAt',
    ], 'registry provenance')
    if (
      !OFFICIAL_PACKAGE_NAMES.includes(entry.name as never)
      || typeof entry.requestedVersion !== 'string'
      || typeof entry.returnedVersion !== 'string'
      || !isCanonicalSha512Integrity(entry.integrity)
      || entry.tarballOrigin !== 'https://registry.npmjs.org'
      || (entry.repositoryUrl !== undefined && typeof entry.repositoryUrl !== 'string')
      || typeof entry.observedAt !== 'string'
    ) throw new Error('report registry provenance is invalid')
  }
}

function validateStages(value: unknown): void {
  if (!Array.isArray(value)) throw new Error('report stage provenance is invalid')
  for (const input of value) {
    const entry = object(input, 'stage provenance')
    exactKeys(entry, [
      'program', 'args', 'cwdToken', 'startedAt', 'durationMs', 'exitCode', 'signal',
      'timedOut', 'stdoutSha256', 'stderrSha256', 'stdoutBytes', 'stderrBytes',
      'stdoutTruncated', 'stderrTruncated',
    ], 'stage provenance')
    if (
      typeof entry.program !== 'string'
      || !Array.isArray(entry.args)
      || entry.args.some((arg) => typeof arg !== 'string')
      || (entry.cwdToken !== '<case-root>' && entry.cwdToken !== '<workspace>')
      || typeof entry.startedAt !== 'string'
      || !Number.isSafeInteger(entry.durationMs)
      || (entry.durationMs as number) < 0
      || (entry.exitCode !== null && !Number.isSafeInteger(entry.exitCode))
      || (entry.signal !== null && typeof entry.signal !== 'string')
      || typeof entry.timedOut !== 'boolean'
      || typeof entry.stdoutSha256 !== 'string'
      || !SHA256.test(entry.stdoutSha256)
      || typeof entry.stderrSha256 !== 'string'
      || !SHA256.test(entry.stderrSha256)
      || !Number.isSafeInteger(entry.stdoutBytes)
      || (entry.stdoutBytes as number) < 0
      || !Number.isSafeInteger(entry.stderrBytes)
      || (entry.stderrBytes as number) < 0
      || typeof entry.stdoutTruncated !== 'boolean'
      || typeof entry.stderrTruncated !== 'boolean'
    ) throw new Error('report stage provenance is invalid')
    if (
      (entry.stdoutBytes === 0 && entry.stdoutSha256 !== EMPTY_SHA256)
      || (entry.stderrBytes === 0 && entry.stderrSha256 !== EMPTY_SHA256)
    ) throw new Error('report zero-byte stage provenance has a non-empty digest')
  }
}

interface ExpectedStage {
  readonly program: 'npm-cli' | 'typescript' | 'workspace-adapter' | 'tsdown'
  readonly args: readonly string[]
}

function exactCoordinates(matrixCase: MatrixCase): Array<[string, string]> {
  return [
    ['@deepseek-ai/dsh', matrixCase.release['@deepseek-ai/dsh']],
    ...INSTALLED_PACKAGE_NAMES.map((name) => [name, matrixCase.packages[name]] as [string, string]),
  ]
}

function validateExactRegistry(value: unknown, matrixCase: MatrixCase): void {
  if (!Array.isArray(value) || value.length !== OFFICIAL_PACKAGE_NAMES.length) {
    throw new Error('report conclusive case registry must contain exactly five official coordinates')
  }
  const expected = exactCoordinates(matrixCase)
  const names = new Set<string>()
  for (let index = 0; index < expected.length; index += 1) {
    const entry = object(value[index], 'registry provenance')
    const [name, version] = expected[index]!
    if (
      entry.name !== name
      || names.has(name)
      || entry.requestedVersion !== version
      || entry.returnedVersion !== version
      || !isCanonicalSha512Integrity(entry.integrity)
      || entry.tarballOrigin !== 'https://registry.npmjs.org'
    ) throw new Error('report conclusive case registry coordinate does not match the exact case')
    names.add(name)
  }
}

function expectedStagePlan(
  config: MatrixConfig,
  matrixCase: MatrixCase,
  lockMode: 'resolve' | 'frozen',
): readonly ExpectedStage[] {
  const npm = '<repo>/tools/typert-version-matrix/node_modules/npm/bin/npm-cli.js'
  const isolated = [
    `--registry=${config.registry}`,
    '--cache=<case-root>/npm-cache',
    '--userconfig=<case-root>/npmrc',
  ]
  const registry = exactCoordinates(matrixCase).map(([name, version]) => ({
    program: 'npm-cli' as const,
    args: [
      npm, 'view', `${name}@${version}`, 'name', 'version', 'dist.integrity', 'dist.tarball',
      'repository', '--json', ...isolated,
    ],
  }))
  const lock = lockMode === 'resolve'
    ? ['install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', ...isolated]
    : ['ci', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund', ...isolated]
  return [
    ...registry,
    { program: 'npm-cli', args: [npm, ...lock] },
    { program: 'npm-cli', args: [npm, 'ci', '--ignore-scripts=false', '--no-audit', '--no-fund', ...isolated] },
    { program: 'npm-cli', args: [npm, 'ls', '--all', '--json'] },
    { program: 'typescript', args: ['<workspace>/node_modules/typescript/bin/tsc', '-b', 'tsconfig.host.json', '--pretty', 'false'] },
    {
      program: 'workspace-adapter',
      args: [
        '<repo>/tools/typert-version-matrix/dist/adapters/workspace-v1.js',
        '--workspace', '<workspace>', '--output', '<case-root>/logs/direct-generator.json',
        '--case-root', '<case-root>',
      ],
    },
    { program: 'tsdown', args: ['<workspace>/node_modules/tsdown/dist/run.mjs', '--config', 'tsdown.config.mjs'] },
    {
      program: 'npm-cli',
      args: [
        npm, 'pack', '--dry-run', '--json', '--workspace', '@knight/dsh-typert-matrix-probe',
        ...isolated,
      ],
    },
  ]
}

function validateStageOutcome(entry: Record<string, unknown>, shouldSucceed: boolean): void {
  if (
    entry.signal !== null
    || entry.timedOut !== false
    || entry.stdoutTruncated !== false
    || entry.stderrTruncated !== false
    || (shouldSucceed ? entry.exitCode !== 0 : !Number.isSafeInteger(entry.exitCode) || entry.exitCode === 0)
  ) throw new Error('report conclusive case stage outcome is invalid or truncated')
}

function validateExactStageChain(
  value: unknown,
  config: MatrixConfig,
  matrixCase: MatrixCase,
  lockMode: 'resolve' | 'frozen',
  expectedCount: number,
  finalProcessMustFail = false,
): void {
  if (!Array.isArray(value) || value.length !== expectedCount) {
    throw new Error(`report conclusive case stage chain must contain exactly ${expectedCount} processes`)
  }
  const expected = expectedStagePlan(config, matrixCase, lockMode).slice(0, expectedCount)
  for (let index = 0; index < expected.length; index += 1) {
    const entry = object(value[index], 'stage provenance')
    const planned = expected[index]!
    if (
      entry.program !== planned.program
      || entry.cwdToken !== '<workspace>'
      || stable(entry.args) !== stable(planned.args)
    ) throw new Error(`report conclusive case stage ${index + 1} does not match reviewed program and argv`)
    validateStageOutcome(entry, !(finalProcessMustFail && index === expected.length - 1))
  }
}

function validateOptionalCaseProvenance(item: Record<string, unknown>): void {
  for (const key of ['lockSha256', 'installedGraphSha256'] as const) {
    if (item[key] !== undefined && (typeof item[key] !== 'string' || !SHA256.test(item[key]))) {
      throw new Error(`report case ${key} provenance is invalid`)
    }
  }
  if (item.registry !== undefined) validateRegistry(item.registry)
  if (item.stages !== undefined) validateStages(item.stages)
  if (item.nonDecisiveDiagnostics !== undefined) {
    const diagnostics = object(item.nonDecisiveDiagnostics, 'non-decisive diagnostics')
    exactKeys(diagnostics, ['ordinaryBundle'], 'non-decisive diagnostics')
    const ordinary = object(diagnostics.ordinaryBundle, 'ordinary bundle diagnostic')
    exactKeys(ordinary, ['path', 'decisive', 'state', 'size', 'sha256'], 'ordinary bundle diagnostic')
    if (
      ordinary.path !== 'lib/index.js'
      || ordinary.decisive !== false
      || !['missing', 'regular-file', 'symlink', 'other'].includes(String(ordinary.state))
    ) throw new Error('report ordinary bundle diagnostic is invalid or decisive')
    if (ordinary.state === 'regular-file') {
      if (
        !Number.isSafeInteger(ordinary.size)
        || (ordinary.size as number) < 0
        || typeof ordinary.sha256 !== 'string'
        || !SHA256.test(ordinary.sha256)
      ) throw new Error('report regular ordinary bundle diagnostic is incomplete')
    } else if (ordinary.size !== undefined || ordinary.sha256 !== undefined) {
      throw new Error('report non-file ordinary bundle diagnostic cannot contain file evidence')
    }
  }
}

function expectedDirectVersions(matrixCase: MatrixCase, config: MatrixConfig): Record<string, string> {
  return {
    ...Object.fromEntries(INSTALLED_PACKAGE_NAMES.map((name) => [name, matrixCase.packages[name]])),
    typescript: config.toolchain.typescript,
    tsdown: config.toolchain.tsdown,
    zod: config.toolchain.zod,
  }
}

function validateDirectVersionRecord(
  value: unknown,
  matrixCase: MatrixCase,
  config: MatrixConfig,
  label: string,
): void {
  const direct = object(value, label)
  const expected = expectedDirectVersions(matrixCase, config)
  exactKeys(direct, Object.keys(expected), label)
  if (stable(direct) !== stable(expected)) {
    throw new Error(`report ${label} does not match exact case/toolchain versions`)
  }
}

function validateCodecEvidence(value: unknown, label: string, invalidCount: number): void {
  const codec = object(value, label)
  exactKeys(codec, [
    'hostMode', 'remoteMode', 'hostHasSafeParse', 'remoteHasSafeParse',
    'typeSymbolBytes', 'typeSymbolSha256', 'symbolsAgree', 'validAcceptedCount',
    'requiredInvalidRejectedCount', 'extraKeyRejectedCount',
  ], label)
  if (
    codec.hostMode !== 'strict'
    || codec.remoteMode !== 'strict'
    || codec.hostHasSafeParse !== true
    || codec.remoteHasSafeParse !== true
    || !Number.isSafeInteger(codec.typeSymbolBytes)
    || (codec.typeSymbolBytes as number) < 1
    || typeof codec.typeSymbolSha256 !== 'string'
    || !SHA256.test(codec.typeSymbolSha256)
    || codec.symbolsAgree !== true
    || codec.validAcceptedCount !== 2
    || codec.requiredInvalidRejectedCount !== invalidCount
    || codec.extraKeyRejectedCount !== 2
  ) throw new Error(`report ${label} validation evidence is invalid`)
}

function validateDescriptorEvidence(value: unknown): void {
  const descriptors = object(value, 'descriptor validation evidence')
  exactKeys(descriptors, [
    'host', 'remote', 'method', 'requestCodec', 'resultCodec', 'unknownLookup',
  ], 'descriptor validation evidence')
  const host = object(descriptors.host, 'descriptor host evidence')
  exactKeys(host, ['exportName', 'package', 'face', 'methodIds', 'invocationCount'], 'descriptor host evidence')
  if (
    host.exportName !== 'TYPERT'
    || host.package !== '@knight/dsh-typert-matrix-probe'
    || host.face !== 'host'
    || host.invocationCount !== 1
    || stable(host.methodIds) !== stable(['matrixProbe/health'])
  ) throw new Error('report descriptor Host evidence is invalid')
  const remote = object(descriptors.remote, 'descriptor remote evidence')
  exactKeys(remote, [
    'exportName', 'package', 'defaultIdentity', 'methodIds', 'descriptorCount',
  ], 'descriptor remote evidence')
  if (
    remote.exportName !== 'TYPERT_REMOTE'
    || remote.package !== '@knight/dsh-typert-matrix-probe'
    || remote.defaultIdentity !== true
    || remote.descriptorCount !== 1
    || stable(remote.methodIds) !== stable(['matrixProbe/health'])
  ) throw new Error('report descriptor Remote evidence is invalid')
  const method = object(descriptors.method, 'descriptor method evidence')
  exactKeys(method, [
    'id', 'service', 'namespace', 'method', 'hostParameterCount', 'remoteParameterCount',
    'fieldsAgree',
  ], 'descriptor method evidence')
  if (
    method.id !== 'matrixProbe/health'
    || method.service !== 'matrixProbe'
    || method.namespace !== 'matrixProbe'
    || method.method !== 'health'
    || method.hostParameterCount !== 1
    || method.remoteParameterCount !== 1
    || method.fieldsAgree !== true
  ) throw new Error('report descriptor method evidence is invalid')
  validateCodecEvidence(descriptors.requestCodec, 'request codec evidence', 10)
  validateCodecEvidence(descriptors.resultCodec, 'result codec evidence', 12)
  const unknown = object(descriptors.unknownLookup, 'unknown descriptor lookup evidence')
  exactKeys(unknown, ['id', 'hostMatchCount', 'remoteMatchCount'], 'unknown descriptor lookup evidence')
  if (
    unknown.id !== 'matrixProbe/unknown'
    || unknown.hostMatchCount !== 0
    || unknown.remoteMatchCount !== 0
  ) throw new Error('report unknown descriptor lookup evidence is invalid')
}

function validateGeneratedArtifactsEvidence(
  value: unknown,
  item: Record<string, unknown>,
): void {
  const generated = object(value, 'generated artifact validation evidence')
  exactKeys(generated, [
    'files', 'packageExports', 'generatedHeaders', 'sourceMap', 'pack',
  ], 'generated artifact validation evidence')
  if (!Array.isArray(generated.files) || generated.files.length !== REQUIRED_ARTIFACTS.length) {
    throw new Error('report generated artifact validation files are incomplete')
  }
  const artifacts = item.artifacts as Array<Record<string, unknown>>
  for (let index = 0; index < REQUIRED_ARTIFACTS.length; index += 1) {
    const file = object(generated.files[index], 'generated file validation evidence')
    exactKeys(file, [
      'path', 'size', 'sha256', 'createdAtMs', 'fileType', 'symlink', 'withinProbe', 'fresh',
    ], 'generated file validation evidence')
    const artifact = artifacts[index]
    if (
      file.path !== REQUIRED_ARTIFACTS[index]
      || file.fileType !== 'regular'
      || file.symlink !== false
      || file.withinProbe !== true
      || file.fresh !== true
      || artifact === undefined
      || file.path !== artifact.path
      || file.size !== artifact.size
      || file.sha256 !== artifact.sha256
      || file.createdAtMs !== artifact.createdAtMs
    ) throw new Error('report generated file validation evidence differs from artifacts')
  }
  const exportsValue = object(generated.packageExports, 'package exports validation evidence')
  exactKeys(exportsValue, ['./typert', './remote'], 'package exports validation evidence')
  const typert = object(exportsValue['./typert'], 'typert export validation evidence')
  const remote = object(exportsValue['./remote'], 'remote export validation evidence')
  exactKeys(typert, ['types', 'default'], 'typert export validation evidence')
  exactKeys(remote, ['types', 'default'], 'remote export validation evidence')
  if (stable(exportsValue) !== stable({
    './typert': { types: './lib/typert.host.d.ts', default: './lib/typert.host.js' },
    './remote': { types: './lib/typert.remote-client.d.ts', default: './lib/typert.remote-client.js' },
  })) throw new Error('report package exports validation evidence is invalid')
  const headers = object(generated.generatedHeaders, 'generated header validation evidence')
  exactKeys(headers, ['checkedArtifactCount', 'matchingHeaderCount'], 'generated header validation evidence')
  if (headers.checkedArtifactCount !== 4 || headers.matchingHeaderCount !== 4) {
    throw new Error('report generated header validation evidence is invalid')
  }
  const sourceMap = object(generated.sourceMap, 'source map validation evidence')
  exactKeys(sourceMap, ['file', 'sourceCount', 'absoluteSourceCount'], 'source map validation evidence')
  if (
    sourceMap.file !== 'typert.remote-client.d.ts'
    || !Number.isSafeInteger(sourceMap.sourceCount)
    || (sourceMap.sourceCount as number) < 1
    || sourceMap.absoluteSourceCount !== 0
  ) throw new Error('report source map validation evidence is invalid')
  const pack = object(generated.pack, 'pack validation evidence')
  exactKeys(pack, [
    'inventorySha256', 'totalFileCount', 'includedRequiredArtifacts', 'forbiddenFileCount',
    'absolutePathCount', 'manifestRequiredArtifactCount',
  ], 'pack validation evidence')
  if (
    typeof pack.inventorySha256 !== 'string'
    || !SHA256.test(pack.inventorySha256)
    || !Number.isSafeInteger(pack.totalFileCount)
    || (pack.totalFileCount as number) < REQUIRED_ARTIFACTS.length
    || stable(pack.includedRequiredArtifacts) !== stable(REQUIRED_ARTIFACTS)
    || pack.forbiddenFileCount !== 0
    || pack.absolutePathCount !== 0
    || pack.manifestRequiredArtifactCount !== REQUIRED_ARTIFACTS.length
  ) throw new Error('report pack validation evidence is invalid')
}

function validateCaseValidationEvidence(
  value: unknown,
  item: Record<string, unknown>,
  config: MatrixConfig,
  requireComplete: boolean,
): void {
  if (value === undefined) {
    if (requireComplete) throw new Error('report PASS case is missing validationEvidence')
    return
  }
  const validation = object(value, 'validationEvidence')
  const keys = [
    'fixtureCopy', 'lock', 'installedGraph', 'workspaceLink', 'preseed',
    'generatedArtifacts', 'descriptors',
  ] as const
  exactKeys(validation, keys, 'validationEvidence')
  if (requireComplete && keys.some((key) => validation[key] === undefined)) {
    throw new Error('report PASS case validationEvidence is incomplete')
  }
  const matrixCase = item.case as unknown as MatrixCase
  if (validation.fixtureCopy !== undefined) {
    const fixture = object(validation.fixtureCopy, 'fixture copy validation evidence')
    exactKeys(fixture, [
      'fixture', 'fileCount', 'sourceSha256', 'copiedSha256',
    ], 'fixture copy validation evidence')
    if (
      fixture.fixture !== config.fixture
      || !Number.isSafeInteger(fixture.fileCount)
      || (fixture.fileCount as number) < 1
      || fixture.sourceSha256 !== item.fixtureSha256
      || fixture.copiedSha256 !== item.fixtureSha256
    ) throw new Error('report fixture copy validation evidence is invalid')
  }
  if (validation.lock !== undefined) {
    const lock = object(validation.lock, 'lock validation evidence')
    exactKeys(lock, ['lockfileVersion', 'directVersions'], 'lock validation evidence')
    if (lock.lockfileVersion !== 3) throw new Error('report lock validation evidence is invalid')
    validateDirectVersionRecord(lock.directVersions, matrixCase, config, 'lock direct versions')
  }
  if (validation.installedGraph !== undefined) {
    const graph = object(validation.installedGraph, 'installed graph validation evidence')
    exactKeys(graph, ['problemCount', 'directVersions'], 'installed graph validation evidence')
    if (graph.problemCount !== 0) throw new Error('report installed graph validation evidence has problems')
    validateDirectVersionRecord(graph.directVersions, matrixCase, config, 'installed graph direct versions')
  }
  if (validation.workspaceLink !== undefined) {
    const link = object(validation.workspaceLink, 'workspace link validation evidence')
    exactKeys(link, ['entryKind', 'resolvesTo'], 'workspace link validation evidence')
    if (link.entryKind !== 'symlink' || link.resolvesTo !== 'packages/probe') {
      throw new Error('report workspace link validation evidence is invalid')
    }
  }
  if (validation.preseed !== undefined) {
    const preseed = object(validation.preseed, 'preseed validation evidence')
    exactKeys(preseed, ['checkedPaths', 'presentPaths'], 'preseed validation evidence')
    if (
      stable(preseed.checkedPaths) !== stable(REQUIRED_ARTIFACTS)
      || stable(preseed.presentPaths) !== stable([])
    ) throw new Error('report preseed validation evidence is invalid')
  }
  if (validation.generatedArtifacts !== undefined) {
    validateGeneratedArtifactsEvidence(validation.generatedArtifacts, item)
  }
  if (validation.descriptors !== undefined) validateDescriptorEvidence(validation.descriptors)
}

function conclusiveContext(item: Record<string, unknown>): {
  matrixCase: MatrixCase
  lockMode: 'resolve' | 'frozen'
} {
  if (typeof item.lockSha256 !== 'string' || !SHA256.test(item.lockSha256)) {
    throw new Error('report conclusive case lockSha256 provenance is invalid')
  }
  if (typeof item.installedGraphSha256 !== 'string' || !SHA256.test(item.installedGraphSha256)) {
    throw new Error('report conclusive case installedGraphSha256 provenance is invalid')
  }
  const provenance = object(item.provenance, 'case provenance')
  if (provenance.lockMode !== 'resolve' && provenance.lockMode !== 'frozen') {
    throw new Error('report conclusive case lock mode is invalid')
  }
  const matrixCase = item.case as unknown as MatrixCase
  validateExactRegistry(item.registry, matrixCase)
  return { matrixCase, lockMode: provenance.lockMode }
}

const EARLY_VALIDATION_KEYS = [
  'fixtureCopy', 'lock', 'installedGraph', 'workspaceLink', 'preseed',
] as const

function requireValidationEvidence(
  item: Record<string, unknown>,
  label: string,
  keys: readonly string[],
): Record<string, unknown> {
  const validation = object(item.validationEvidence, `${label} validationEvidence`)
  for (const key of keys) {
    if (validation[key] === undefined) {
      throw new Error(`report ${label} is missing completed ${key} validation evidence`)
    }
  }
  return validation
}

function requireOrdinaryBundleObservation(item: Record<string, unknown>, label: string): void {
  if (item.nonDecisiveDiagnostics === undefined) {
    throw new Error(`report ${label} is missing the non-decisive ordinary bundle observation`)
  }
}

function validateSuccessfulDirectSummary(summary: DirectGeneratorSummary | undefined): void {
  if (summary === undefined) throw new Error('report later failure is missing direct-generator summary')
  if (classifyDirectGeneratorSummary(summary) !== 'SUCCESS') {
    throw new Error('report later failure lacks a successful direct-generator prerequisite')
  }
}

function validateFailureProvenance(
  item: Record<string, unknown>,
  summary: DirectGeneratorSummary | undefined,
  config: MatrixConfig,
): void {
  if (item.status !== 'FAIL_COMPATIBILITY') return
  const { matrixCase, lockMode } = conclusiveContext(item)
  const failure = item.failure as { code: string; stage: string }
  if (failure.code === 'PRESEEDED_ARTIFACT') {
    validateExactStageChain(item.stages, config, matrixCase, lockMode, 8)
    requireValidationEvidence(item, 'PRESEEDED_ARTIFACT failure', EARLY_VALIDATION_KEYS.slice(0, -1))
    return
  }
  if (failure.code === 'TYPESCRIPT_FAILED') {
    validateExactStageChain(item.stages, config, matrixCase, lockMode, 9, true)
    requireValidationEvidence(item, 'TYPESCRIPT_FAILED failure', EARLY_VALIDATION_KEYS)
    return
  }
  if (failure.stage === 'direct-generator') {
    validateExactStageChain(item.stages, config, matrixCase, lockMode, 11)
    requireValidationEvidence(item, 'direct-generator failure', EARLY_VALIDATION_KEYS)
    requireOrdinaryBundleObservation(item, 'direct-generator failure')
    if (summary === undefined) {
      throw new Error('report direct-generator failure has no source-free direct summary')
    }
    if (classifyDirectGeneratorSummary(summary) !== failure.code) {
      throw new Error('report direct-generator failure code contradicts its source-free summary')
    }
    return
  }
  if (failure.code === 'TSDOWN_FAILED') {
    validateExactStageChain(item.stages, config, matrixCase, lockMode, 11, true)
    requireValidationEvidence(item, 'TSDOWN_FAILED failure', EARLY_VALIDATION_KEYS)
    return
  }
  if (failure.stage === 'pack-dry-run') {
    validateExactStageChain(
      item.stages,
      config,
      matrixCase,
      lockMode,
      12,
      failure.code === 'PACK_DRY_RUN_FAILED',
    )
    requireValidationEvidence(item, 'pack-dry-run failure', EARLY_VALIDATION_KEYS)
    requireOrdinaryBundleObservation(item, 'pack-dry-run failure')
    validateSuccessfulDirectSummary(summary)
    return
  }
  if (failure.stage === 'descriptors') {
    validateExactStageChain(item.stages, config, matrixCase, lockMode, 12)
    requireValidationEvidence(item, 'descriptor failure', [
      ...EARLY_VALIDATION_KEYS,
      'generatedArtifacts',
    ])
    requireOrdinaryBundleObservation(item, 'descriptor failure')
    validateSuccessfulDirectSummary(summary)
    return
  }
  throw new Error('report compatibility failure has no reviewed evidence-chain rule')
}

function validateEvidenceRefs(item: Record<string, unknown>): void {
  for (const assertion of item.assertions as Array<Record<string, unknown>>) {
    const expectedRefs = item.status === 'PASS'
      ? passEvidenceRefs(item, assertion.id as PassAssertionId)
      : canonicalEvidenceRefs(item)
    if (stable(assertion.evidenceRefs) !== stable(expectedRefs)) {
      throw new Error('report assertion evidence reference does not close over case provenance')
    }
  }
}

function validatePassProvenance(
  item: Record<string, unknown>,
  summary: DirectGeneratorSummary | undefined,
  config: MatrixConfig,
): void {
  const { matrixCase, lockMode } = conclusiveContext(item)
  validateExactStageChain(item.stages, config, matrixCase, lockMode, 12)
  const compile = object((item.stages as unknown[])[8], 'compile stage provenance')
  if (compile.stdoutBytes !== 0 || compile.stderrBytes !== 0) {
    throw new Error('report PASS TypeScript compile must have zero stdout/stderr diagnostic bytes')
  }
  if (summary === undefined) throw new Error('report PASS case direct-generator summary is missing')
  if (
    stable(summary.discovery) !== stable([{
      package: '@knight/dsh-typert-matrix-probe',
      root: 'packages/probe',
      faces: ['host'],
    }])
    || summary.automaticCount !== 1
    || summary.forcedCount !== 1
  ) throw new Error('report direct-generator discovery provenance is invalid')
  const automatic = hashRecord(summary.automaticArtifactSha256, 'automatic artifact hashes')
  const forced = hashRecord(summary.forcedArtifactSha256, 'forced artifact hashes')
  const expectedIdentity = {
    package: '@knight/dsh-typert-matrix-probe',
    packageRoot: 'packages/probe',
    face: 'host',
  }
  for (const identity of [summary.automaticIdentity, summary.forcedIdentity]) {
    if (
      identity === undefined
      || identity.package !== expectedIdentity.package
      || identity.packageRoot !== expectedIdentity.packageRoot
      || identity.face !== expectedIdentity.face
    ) throw new Error('report PASS case generation identity is invalid')
  }
  if (stable(summary.automaticIdentity) !== stable(summary.forcedIdentity)) {
    throw new Error('report PASS case automatic and forced generation identities differ')
  }
  if (stable(automatic) !== stable(forced)) {
    throw new Error('report PASS case automatic and forced generation hashes differ')
  }
  const artifacts = item.artifacts as Array<Record<string, unknown>>
  for (const artifact of REQUIRED_ARTIFACTS) {
    const observed = artifacts.find(({ path }) => path === artifact)
    if (
      observed === undefined
      || automatic[artifact] !== observed.sha256
      || forced[artifact] !== observed.sha256
    ) throw new Error(`report PASS case direct-generator provenance does not match ${artifact}`)
  }
  const context = passContext(item as unknown as CaseEvidence, config, summary)
  const derived = derivePassAssertions(context, (id) => passEvidenceRefs(item, id))
  assertDerivedPassAssertions(item.assertions as unknown as AssertionResult[], derived, false)
}

function verifyProjectedReport(input: unknown): MatrixReport {
  const value = object(input, 'root')
  assertCanonicalSafety(value)
  exactKeys(value, [
    'schemaVersion', 'runId', 'config', 'environment', 'cases', 'eligibleCandidateIds',
    'incompleteCaseIds', 'exitCode', 'exitReason', 'decision', 'humanDecisionRequired',
    'evidenceBoundary',
  ], 'root')
  if (value.schemaVersion !== '1' || typeof value.runId !== 'string') {
    throw new Error('report identity is invalid')
  }
  const config = parseMatrixConfig(value.config)
  const cases = parseCases(value.cases, config)
  validateReviewedLockSetIdentity(cases)
  const environment = object(value.environment, 'environment')
  exactKeys(environment, ['platform', 'arch', 'node', 'npmCli', 'provenance'], 'environment')
  if (['platform', 'arch', 'node', 'npmCli'].some((key) => typeof environment[key] !== 'string')) {
    throw new Error('report environment is invalid')
  }
  assertSupportedRuntimeMetadata(config, {
    platform: environment.platform as string,
    arch: environment.arch as string,
    node: environment.node as string,
    npmCli: environment.npmCli as string,
  })
  assertRunProvenance(environment.provenance, config)
  if (cases.some((entry) => stable(entry.provenance) !== stable(environment.provenance))) {
    throw new Error('report environment provenance differs from case provenance')
  }
  const recomputed = aggregateMatrix(config, cases, {
    runId: value.runId,
    platform: String(environment.platform),
    arch: String(environment.arch),
    node: String(environment.node),
    npmCli: String(environment.npmCli),
  })
  for (const field of [
    'exitCode',
    'exitReason',
    'decision',
    'humanDecisionRequired',
    'evidenceBoundary',
  ] as const) {
    if (stable(value[field]) !== stable(recomputed[field])) {
      throw new Error(`report aggregate mismatch for ${field}`)
    }
  }
  if (
    stable(value.eligibleCandidateIds) !== stable(recomputed.eligibleCandidateIds)
    || stable(value.incompleteCaseIds) !== stable(recomputed.incompleteCaseIds)
  ) throw new Error('report aggregate mismatch for case lists')
  return recomputed
}

export function parseAndVerifyReport(raw: string): MatrixReport {
  return verifyProjectedReport(JSON.parse(raw))
}
