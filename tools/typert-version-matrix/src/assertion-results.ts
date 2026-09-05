import { createHash } from 'node:crypto'
import { REQUIRED_ARTIFACTS } from './assertions/artifacts.js'
import type { DirectGeneratorEvidence, NormalizedEmitResult } from './assertions/generation.js'
import type {
  ArtifactEvidence,
  AssertionResult,
  CaseValidationEvidence,
  CaseStatus,
  MatrixCase,
  MatrixConfig,
  NonDecisiveDiagnostics,
  RegistryEvidence,
} from './types.js'
import { INSTALLED_PACKAGE_NAMES } from './types.js'
import type { ProcessEvidence } from './process.js'

const assertionRange = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`)

export const REQUIRED_PASS_ASSERTIONS = [
  ...assertionRange('A', 9),
  ...assertionRange('B', 7),
  ...assertionRange('C', 10),
  ...assertionRange('D', 10),
] as const

export type PassAssertionId = (typeof REQUIRED_PASS_ASSERTIONS)[number]

export interface DirectGeneratorSummary {
  readonly schemaVersion: '1'
  readonly rawSourceIncluded: false
  readonly discovery: readonly {
    readonly package: string
    readonly root: string
    readonly faces: readonly string[]
  }[]
  readonly automaticCount: number
  readonly forcedCount: number
  readonly automaticIdentity?: EmitIdentity
  readonly forcedIdentity?: EmitIdentity
  readonly automaticArtifactState?: ArtifactStateRecord
  readonly forcedArtifactState?: ArtifactStateRecord
  readonly automaticArtifactSha256?: Readonly<Record<(typeof REQUIRED_ARTIFACTS)[number], string>>
  readonly forcedArtifactSha256?: Readonly<Record<(typeof REQUIRED_ARTIFACTS)[number], string>>
  readonly automaticArtifactBytes?: Readonly<Record<(typeof REQUIRED_ARTIFACTS)[number], number>>
  readonly forcedArtifactBytes?: Readonly<Record<(typeof REQUIRED_ARTIFACTS)[number], number>>
}

interface EmitIdentity {
  readonly package: string | null
  readonly packageRoot: string | null
  readonly face: string | null
  readonly exports: readonly string[] | null
}

interface ArtifactContentState {
  readonly present: boolean
  readonly bytes: number
  readonly sha256: string | null
}

type ArtifactStateRecord = Readonly<Record<
  (typeof REQUIRED_ARTIFACTS)[number],
  ArtifactContentState
>>

function emitContents(emit: NormalizedEmitResult | undefined): Record<string, string> | undefined {
  if (emit === undefined || emit.remote === undefined) return undefined
  const contents = {
    'lib/typert.host.js': emit.js,
    'lib/typert.host.d.ts': emit.dts,
    'lib/typert.remote-client.js': emit.remote.js,
    'lib/typert.remote-client.d.ts': emit.remote.dts,
    'lib/typert.remote-client.d.ts.map': emit.remote.dtsMap,
  }
  if (Object.values(contents).some((source) => (
    typeof source !== 'string' || Buffer.byteLength(source) <= 0
  ))) return undefined
  return contents
}

function artifactMap<T>(contents: Record<string, string>, project: (source: string) => T) {
  return Object.fromEntries(REQUIRED_ARTIFACTS.map((artifact) => [
    artifact,
    project(contents[artifact]!),
  ])) as Record<(typeof REQUIRED_ARTIFACTS)[number], T>
}

function identity(emit: NormalizedEmitResult): EmitIdentity {
  return {
    package: typeof emit.package === 'string' ? emit.package : null,
    packageRoot: typeof emit.packageRoot === 'string' ? emit.packageRoot : null,
    face: typeof emit.face === 'string' ? emit.face : null,
    exports: Array.isArray(emit.exports) && emit.exports.every((entry) => typeof entry === 'string')
      ? [...emit.exports]
      : null,
  }
}

function artifactState(emit: NormalizedEmitResult): ArtifactStateRecord {
  const remote = typeof emit.remote === 'object' && emit.remote !== null ? emit.remote : undefined
  const values: Record<(typeof REQUIRED_ARTIFACTS)[number], unknown> = {
    'lib/typert.host.js': emit.js,
    'lib/typert.host.d.ts': emit.dts,
    'lib/typert.remote-client.js': remote?.js,
    'lib/typert.remote-client.d.ts': remote?.dts,
    'lib/typert.remote-client.d.ts.map': remote?.dtsMap,
  }
  return Object.fromEntries(REQUIRED_ARTIFACTS.map((artifact) => {
    const source = values[artifact]
    if (typeof source !== 'string') {
      return [artifact, { present: false, bytes: 0, sha256: null }]
    }
    return [artifact, {
      present: true,
      bytes: Buffer.byteLength(source),
      sha256: createHash('sha256').update(source).digest('hex'),
    }]
  })) as ArtifactStateRecord
}

function completeIdentity(value: EmitIdentity): boolean {
  return typeof value.package === 'string'
    && typeof value.packageRoot === 'string'
    && typeof value.face === 'string'
    && Array.isArray(value.exports)
}

export function buildDirectGeneratorSummary(
  value: DirectGeneratorEvidence | undefined,
  requireComplete: boolean,
): DirectGeneratorSummary | undefined {
  if (value === undefined) {
    if (requireComplete) throw new Error('PASS case is missing direct-generator provenance')
    return undefined
  }
  const automaticEmit = value.automatic.length === 1 ? value.automatic[0] : undefined
  const forcedEmit = value.forced.length === 1 ? value.forced[0] : undefined
  const automatic = emitContents(automaticEmit)
  const automaticIdentity = automaticEmit === undefined ? undefined : identity(automaticEmit)
  const automaticState = automaticEmit === undefined ? undefined : artifactState(automaticEmit)
  const forced = emitContents(forcedEmit)
  const forcedIdentity = forcedEmit === undefined ? undefined : identity(forcedEmit)
  const forcedState = forcedEmit === undefined ? undefined : artifactState(forcedEmit)
  if (requireComplete && (
    value.discover.length !== 1
    || automatic === undefined
    || automaticIdentity === undefined
    || !completeIdentity(automaticIdentity)
    || forced === undefined
    || forcedIdentity === undefined
    || !completeIdentity(forcedIdentity)
  )) throw new Error('PASS case is missing complete direct-generator provenance')
  return {
    schemaVersion: '1',
    rawSourceIncluded: false,
    discovery: value.discover.map((entry) => ({
      package: entry.package,
      root: entry.root,
      faces: [...entry.faces],
    })),
    automaticCount: value.automatic.length,
    forcedCount: value.forced.length,
    ...(automaticEmit === undefined ? {} : {
      automaticIdentity: automaticIdentity!,
      automaticArtifactState: automaticState!,
      ...(automatic === undefined ? {} : {
      automaticArtifactSha256: artifactMap(automatic, (source) => (
        createHash('sha256').update(source).digest('hex')
      )),
      automaticArtifactBytes: artifactMap(automatic, (source) => Buffer.byteLength(source)),
      }),
    }),
    ...(forcedEmit === undefined ? {} : {
      forcedIdentity: forcedIdentity!,
      forcedArtifactState: forcedState!,
      ...(forced === undefined ? {} : {
      forcedArtifactSha256: artifactMap(forced, (source) => (
        createHash('sha256').update(source).digest('hex')
      )),
      forcedArtifactBytes: artifactMap(forced, (source) => Buffer.byteLength(source)),
      }),
    }),
  }
}

export interface PassAssertionContext {
  readonly config: MatrixConfig
  readonly matrixCase: MatrixCase
  readonly fixtureSha256: string
  readonly lockSha256: string
  readonly installedGraphSha256: string
  readonly registry: readonly RegistryEvidence[]
  readonly stages: readonly ProcessEvidence[]
  readonly artifacts: readonly ArtifactEvidence[]
  readonly directGeneratorSummary: DirectGeneratorSummary
  readonly nonDecisiveDiagnostics: NonDecisiveDiagnostics
  readonly validationEvidence: Required<CaseValidationEvidence>
}

function coordinates(context: PassAssertionContext) {
  return [
    { name: '@deepseek-ai/dsh', version: context.matrixCase.release['@deepseek-ai/dsh'] },
    ...INSTALLED_PACKAGE_NAMES.map((name) => ({ name, version: context.matrixCase.packages[name] })),
  ]
}

function processOutcome(stage: ProcessEvidence | undefined) {
  if (stage === undefined) throw new Error('PASS assertion derivation is missing a stage')
  return {
    program: stage.program,
    exitCode: stage.exitCode,
    signal: stage.signal,
    timedOut: stage.timedOut,
    stdoutTruncated: stage.stdoutTruncated,
    stderrTruncated: stage.stderrTruncated,
  }
}

function artifactOutcome(context: PassAssertionContext, index: number) {
  const path = REQUIRED_ARTIFACTS[index]!
  const artifact = context.validationEvidence.generatedArtifacts.files.find((entry) => entry.path === path)
  if (artifact === undefined) throw new Error(`PASS assertion derivation is missing ${path}`)
  return { ...artifact }
}

function descriptorSummary(
  id: PassAssertionId,
  context: PassAssertionContext,
): { expected: object; actualSummary: object } {
  const method = {
    id: 'matrixProbe/health',
    service: 'matrixProbe',
    namespace: 'matrixProbe',
    method: 'health',
  }
  const values: Partial<Record<PassAssertionId, { expected: object; actualSummary: object }>> = {
    D01: {
      expected: { exportName: 'TYPERT', package: '@knight/dsh-typert-matrix-probe', face: 'host' },
      actualSummary: {
        exportName: context.validationEvidence.descriptors.host.exportName,
        package: context.validationEvidence.descriptors.host.package,
        face: context.validationEvidence.descriptors.host.face,
      },
    },
    D02: {
      expected: { invocationCount: 1, methodIds: ['matrixProbe/health'] },
      actualSummary: {
        invocationCount: context.validationEvidence.descriptors.host.invocationCount,
        methodIds: context.validationEvidence.descriptors.host.methodIds,
        unexpectedMethodCount: context.validationEvidence.descriptors.host.methodIds.length - 1,
      },
    },
    D03: {
      expected: { exportName: 'TYPERT_REMOTE', package: '@knight/dsh-typert-matrix-probe' },
      actualSummary: {
        exportName: context.validationEvidence.descriptors.remote.exportName,
        package: context.validationEvidence.descriptors.remote.package,
        defaultIdentity: context.validationEvidence.descriptors.remote.defaultIdentity,
      },
    },
    D04: {
      expected: { descriptorCount: 1, methodIds: ['matrixProbe/health'] },
      actualSummary: {
        descriptorCount: context.validationEvidence.descriptors.remote.descriptorCount,
        methodIds: context.validationEvidence.descriptors.remote.methodIds,
        unexpectedMethodCount: context.validationEvidence.descriptors.remote.methodIds.length - 1,
      },
    },
    D05: {
      expected: { hostRemoteFieldsEqual: ['id', 'service', 'namespace', 'method'] },
      actualSummary: {
        id: context.validationEvidence.descriptors.method.id,
        service: context.validationEvidence.descriptors.method.service,
        namespace: context.validationEvidence.descriptors.method.namespace,
        method: context.validationEvidence.descriptors.method.method,
        hostRemoteFieldsAgree: context.validationEvidence.descriptors.method.fieldsAgree,
      },
    },
    D06: {
      expected: { codec: 'request', mode: 'strict', nonEmptyTypeSymbol: true, safeParse: true },
      actualSummary: { codec: 'request', ...context.validationEvidence.descriptors.requestCodec },
    },
    D07: {
      expected: { codec: 'result', mode: 'strict', nonEmptyTypeSymbol: true, safeParse: true },
      actualSummary: { codec: 'result', ...context.validationEvidence.descriptors.resultCodec },
    },
    D08: {
      expected: { validAcceptedCount: 2, requiredInvalidRejectedCount: 10 },
      actualSummary: {
        validAcceptedCount: context.validationEvidence.descriptors.requestCodec.validAcceptedCount,
        requiredInvalidRejectedCount: context.validationEvidence.descriptors.requestCodec.requiredInvalidRejectedCount,
        extraKeyRejectedCount: context.validationEvidence.descriptors.requestCodec.extraKeyRejectedCount,
      },
    },
    D09: {
      expected: { validAcceptedCount: 2, requiredInvalidRejectedCount: 12 },
      actualSummary: {
        validAcceptedCount: context.validationEvidence.descriptors.resultCodec.validAcceptedCount,
        requiredInvalidRejectedCount: context.validationEvidence.descriptors.resultCodec.requiredInvalidRejectedCount,
        extraKeyRejectedCount: context.validationEvidence.descriptors.resultCodec.extraKeyRejectedCount,
      },
    },
    D10: {
      expected: { exactMethodIds: ['matrixProbe/health'], unknownMethodId: 'matrixProbe/unknown' },
      actualSummary: {
        hostMethodIds: context.validationEvidence.descriptors.host.methodIds,
        remoteMethodIds: context.validationEvidence.descriptors.remote.methodIds,
        unknownId: context.validationEvidence.descriptors.unknownLookup.id,
        hostMatchCount: context.validationEvidence.descriptors.unknownLookup.hostMatchCount,
        remoteMatchCount: context.validationEvidence.descriptors.unknownLookup.remoteMatchCount,
      },
    },
  }
  const result = values[id]
  if (result === undefined) throw new Error(`no descriptor assertion mapping for ${id}`)
  return result
}

function expectedAndActual(
  id: PassAssertionId,
  context: PassAssertionContext,
): { expected: object; actualSummary: object } {
  const direct = context.directGeneratorSummary
  const expectedCoordinates = coordinates(context)
  const actualCoordinates = context.registry.map((entry) => ({
    name: entry.name,
    requestedVersion: entry.requestedVersion,
    returnedVersion: entry.returnedVersion,
  }))
  const artifactIndex = /^C0([1-5])$/.exec(id)?.[1]
  if (artifactIndex !== undefined) {
    return {
      expected: {
        path: REQUIRED_ARTIFACTS[Number(artifactIndex) - 1],
        fileType: 'regular',
        symlink: false,
        withinProbe: true,
        minBytes: 1,
        fresh: true,
      },
      actualSummary: artifactOutcome(context, Number(artifactIndex) - 1),
    }
  }
  if (id.startsWith('D')) return descriptorSummary(id, context)
  switch (id) {
    case 'A01': return {
      expected: { coordinates: expectedCoordinates },
      actualSummary: { recordCount: context.registry.length, coordinates: actualCoordinates },
    }
    case 'A02': return {
      expected: { recordCount: 5, integrityAlgorithm: 'sha512', tarballOrigin: 'https://registry.npmjs.org' },
      actualSummary: {
        recordCount: context.registry.length,
        sha512IntegrityCount: context.registry.filter(({ integrity }) => integrity.startsWith('sha512-')).length,
        approvedOriginCount: context.registry.filter(({ tarballOrigin }) => tarballOrigin === 'https://registry.npmjs.org').length,
      },
    }
    case 'A03': return {
      expected: { exactCaseVersions: expectedCoordinates, lockSha256: 'recorded-sha256' },
      actualSummary: {
        lockfileVersion: context.validationEvidence.lock.lockfileVersion,
        directVersions: context.validationEvidence.lock.directVersions,
        lockSha256: context.lockSha256,
      },
    }
    case 'A04': return {
      expected: { stage: 'install', program: 'npm-cli', exitCode: 0, signal: null, timedOut: false },
      actualSummary: { stage: 'install', ...processOutcome(context.stages[6]) },
    }
    case 'A05': return {
      expected: { stage: 'tree', program: 'npm-cli', exitCode: 0, dependencyProblemCount: 0 },
      actualSummary: {
        stage: 'tree',
        ...processOutcome(context.stages[7]),
        dependencyProblemCount: context.validationEvidence.installedGraph.problemCount,
        directVersions: context.validationEvidence.installedGraph.directVersions,
        installedGraphSha256: context.installedGraphSha256,
      },
    }
    case 'A06': return {
      expected: { entryKind: 'symlink', resolvesTo: 'packages/probe' },
      actualSummary: { ...context.validationEvidence.workspaceLink },
    }
    case 'A07': return {
      expected: { directVersions: { ...context.matrixCase.packages, ...context.config.toolchain } },
      actualSummary: {
        directVersions: context.validationEvidence.installedGraph.directVersions,
        installedGraphSha256: context.installedGraphSha256,
      },
    }
    case 'A08': return {
      expected: { fixture: context.config.fixture, frozenManifestSha256: context.fixtureSha256 },
      actualSummary: {
        ...context.validationEvidence.fixtureCopy,
        caseFixtureSha256: context.fixtureSha256,
      },
    }
    case 'A09': return {
      expected: { checkedPaths: [...REQUIRED_ARTIFACTS], presentPaths: [] },
      actualSummary: { ...context.validationEvidence.preseed },
    }
    case 'B01': return {
      expected: { stage: 'compile', program: 'typescript', exitCode: 0, stdoutBytes: 0, stderrBytes: 0 },
      actualSummary: {
        stage: 'compile',
        ...processOutcome(context.stages[8]),
        stdoutBytes: context.stages[8]?.stdoutBytes,
        stderrBytes: context.stages[8]?.stderrBytes,
      },
    }
    case 'B02': return {
      expected: { discovery: [{ package: '@knight/dsh-typert-matrix-probe', root: 'packages/probe', faces: ['host'] }] },
      actualSummary: { discovery: direct.discovery },
    }
    case 'B03': return {
      expected: { automaticCount: 1, package: '@knight/dsh-typert-matrix-probe', packageRoot: 'packages/probe', face: 'host' },
      actualSummary: { automaticCount: direct.automaticCount, identity: direct.automaticIdentity },
    }
    case 'B04': return {
      expected: { forcedCount: 1, normalizedEqualToAutomatic: true },
      actualSummary: {
        forcedCount: direct.forcedCount,
        identity: direct.forcedIdentity,
        normalizedEqualToAutomatic: (
          stableAssertionValue(direct.automaticIdentity) === stableAssertionValue(direct.forcedIdentity)
          && stableAssertionValue(direct.automaticArtifactSha256) === stableAssertionValue(direct.forcedArtifactSha256)
        ),
      },
    }
    case 'B05': return {
      expected: { automaticNonEmptyArtifacts: 5, forcedNonEmptyArtifacts: 5 },
      actualSummary: {
        automaticArtifactBytes: direct.automaticArtifactBytes,
        forcedArtifactBytes: direct.forcedArtifactBytes,
      },
    }
    case 'B06': return {
      expected: { stage: 'tsdown', program: 'tsdown', exitCode: 0, signal: null, timedOut: false },
      actualSummary: { stage: 'tsdown', ...processOutcome(context.stages[10]) },
    }
    case 'B07': return {
      expected: { ordinaryBundlePath: 'lib/index.js', recorded: true, decisive: false },
      actualSummary: { ...context.nonDecisiveDiagnostics.ordinaryBundle },
    }
    case 'C06': return {
      expected: {
        './typert': { types: './lib/typert.host.d.ts', default: './lib/typert.host.js' },
        './remote': { types: './lib/typert.remote-client.d.ts', default: './lib/typert.remote-client.js' },
      },
      actualSummary: { packageExports: context.validationEvidence.generatedArtifacts.packageExports },
    }
    case 'C07': return {
      expected: { generator: '@deepseek-ai/dsh-typert-generator', checkedArtifactCount: 4 },
      actualSummary: { ...context.validationEvidence.generatedArtifacts.generatedHeaders },
    }
    case 'C08': return {
      expected: { matchedPaths: [...REQUIRED_ARTIFACTS] },
      actualSummary: {
        matchedPaths: [...REQUIRED_ARTIFACTS],
        automaticArtifactSha256: direct.automaticArtifactSha256,
        forcedArtifactSha256: direct.forcedArtifactSha256,
      },
    }
    case 'C09': return {
      expected: { file: 'typert.remote-client.d.ts', minimumSourceCount: 1, absoluteSourceCount: 0 },
      actualSummary: { ...context.validationEvidence.generatedArtifacts.sourceMap },
    }
    case 'C10': return {
      expected: { stage: 'pack-dry-run', requiredArtifactCount: 5, forbiddenFileCount: 0, absolutePathCount: 0 },
      actualSummary: {
        stage: 'pack-dry-run',
        ...processOutcome(context.stages[11]),
        ...context.validationEvidence.generatedArtifacts.pack,
      },
    }
  }
  throw new Error(`no PASS assertion mapping for ${id}`)
}

export function derivePassAssertions(
  context: PassAssertionContext,
  evidenceRefsFor: (id: PassAssertionId) => readonly string[] = () => [],
): AssertionResult[] {
  return REQUIRED_PASS_ASSERTIONS.map((id) => {
    const { expected, actualSummary } = expectedAndActual(id, context)
    return { id, status: 'PASS', expected, actualSummary, evidenceRefs: [...evidenceRefsFor(id)] }
  })
}

export function stableAssertionValue(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableAssertionValue).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => `${JSON.stringify(key)}:${stableAssertionValue(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

export function assertExactPassAssertionInventory(assertions: readonly AssertionResult[]): void {
  if (
    assertions.length !== REQUIRED_PASS_ASSERTIONS.length
    || assertions.some((entry, index) => (
      entry.id !== REQUIRED_PASS_ASSERTIONS[index]
      || entry.status !== 'PASS'
      || typeof entry.expected !== 'object'
      || entry.expected === null
      || Array.isArray(entry.expected)
      || typeof entry.actualSummary !== 'object'
      || entry.actualSummary === null
      || Array.isArray(entry.actualSummary)
    ))
  ) throw new Error('PASS case assertion inventory is not the exact ordered A01-D10 contract')
}

export function assertDerivedPassAssertions(
  actual: readonly AssertionResult[],
  expected: readonly AssertionResult[],
  allowEmptyEvidenceRefs: boolean,
): void {
  assertExactPassAssertionInventory(actual)
  if (actual.length !== expected.length) throw new Error('PASS assertion inventory differs from derived evidence')
  for (let index = 0; index < expected.length; index += 1) {
    const observed = actual[index]!
    const derived = expected[index]!
    if (observed.id !== derived.id || observed.status !== derived.status) {
      throw new Error(`PASS assertion ${derived.id} identity differs from canonical evidence`)
    }
    if (stableAssertionValue(observed.expected) !== stableAssertionValue(derived.expected)) {
      throw new Error(`PASS assertion ${derived.id} expected value differs from canonical evidence`)
    }
    if (stableAssertionValue(observed.actualSummary) !== stableAssertionValue(derived.actualSummary)) {
      throw new Error(`PASS assertion ${derived.id} actual summary differs from canonical evidence`)
    }
    if (
      !(allowEmptyEvidenceRefs && observed.evidenceRefs.length === 0)
      && stableAssertionValue(observed.evidenceRefs) !== stableAssertionValue(derived.evidenceRefs)
    ) throw new Error(`PASS assertion ${derived.id} references differ from canonical evidence`)
  }
}

export interface FailureDescriptor {
  readonly code: string
  readonly stage: string
}

const FAILURE_ASSERTION_ID_BY_CODE: Readonly<Record<string, string>> = {
  PRESEEDED_ARTIFACT: 'A09',
  TYPESCRIPT_FAILED: 'B01',
  DISCOVERY_MISMATCH: 'B02',
  GENERATION_EMPTY: 'B03',
  GENERATION_IDENTITY: 'B03',
  GENERATION_DISAGREEMENT: 'B04',
  REMOTE_GENERATION_EMPTY: 'B05',
  TSDOWN_FAILED: 'B06',
  PACKAGE_EXPORTS: 'C06',
  ARTIFACT_HEADER: 'C07',
  ARTIFACT_HASH_MISMATCH: 'C08',
  SOURCE_MAP_INVALID: 'C09',
  SOURCE_MAP_ABSOLUTE: 'C09',
  PACK_DRY_RUN_FAILED: 'C10',
  PACK_OUTPUT_INVALID: 'C10',
  ARTIFACT_MISSING: 'C10',
  ARTIFACT_SYMLINK: 'C10',
  ARTIFACT_NOT_REGULAR: 'C10',
  ARTIFACT_BOUNDARY: 'C10',
  ARTIFACT_EMPTY: 'C10',
  ARTIFACT_STALE: 'C10',
  PACKAGE_FILES: 'C10',
  PACK_ARTIFACT_MISSING: 'C10',
  PACK_FORBIDDEN_FILE: 'C10',
  HOST_IDENTITY: 'D01',
  METHOD_INVENTORY: 'D02',
  REMOTE_IDENTITY: 'D03',
  REMOTE_PACKAGE: 'D03',
  METHOD_MISMATCH: 'D05',
  CODEC_PERMISSIVE: 'D06',
  CODEC_TYPE_SYMBOL: 'D06',
  CODEC_SCHEMA: 'D06',
  CODEC_VALID_REJECTED: 'D08',
  CODEC_INVALID_ACCEPTED: 'D08',
  PARAMETER_INVENTORY: 'D10',
  CODEC_SYMBOL_MISMATCH: 'D10',
  DESCRIPTOR_SHAPE: 'D10',
}

/**
 * Project the runner's typed failure into the sole canonical non-PASS assertion.
 * No exception/log message is accepted here: every value is derived from the
 * finite status/code/stage record that the report verifier checks separately.
 */
export function deriveFailureAssertion(
  status: Exclude<CaseStatus, 'PASS'>,
  failure: FailureDescriptor,
  evidenceRefs: readonly string[] = [],
): AssertionResult {
  const assertionId = FAILURE_ASSERTION_ID_BY_CODE[failure.code] ?? 'EVIDENCE'
  const assertionStatus = status === 'FAIL_COMPATIBILITY' ? 'FAIL' : 'BLOCKED'
  return {
    id: assertionId,
    status: assertionStatus,
    expected: {
      assertionId,
      stage: failure.stage,
      outcome: 'pass',
      evidenceContract: 'reviewed',
    },
    actualSummary: {
      caseStatus: status,
      failureCode: failure.code,
      stage: failure.stage,
      outcome: assertionStatus === 'FAIL' ? 'failed' : 'blocked',
    },
    evidenceRefs: [...evidenceRefs],
  }
}

export function assertDerivedFailureAssertion(
  actual: readonly AssertionResult[],
  expected: AssertionResult,
  allowEmptyEvidenceRefs: boolean,
): void {
  if (actual.length !== 1) throw new Error('non-PASS case must contain exactly one derived assertion')
  const observed = actual[0]!
  if (
    observed.id !== expected.id
    || observed.status !== expected.status
    || stableAssertionValue(observed.expected) !== stableAssertionValue(expected.expected)
    || stableAssertionValue(observed.actualSummary) !== stableAssertionValue(expected.actualSummary)
    || (
      !(allowEmptyEvidenceRefs && observed.evidenceRefs.length === 0)
      && stableAssertionValue(observed.evidenceRefs) !== stableAssertionValue(expected.evidenceRefs)
    )
  ) throw new Error('non-PASS assertion differs from the typed canonical failure')
}
