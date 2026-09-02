import type { ExactVersion } from './exact-version.js'
import type { DirectGeneratorEvidence } from './assertions/generation.js'
import type { ProcessEvidence } from './process.js'

export const INSTALLED_PACKAGE_NAMES = [
  '@deepseek-ai/dsh-typert-generator',
  '@deepseek-ai/dsh-typert-protocol',
  '@deepseek-ai/dsh-invariants',
  '@deepseek-ai/cordis',
] as const

export const OFFICIAL_PACKAGE_NAMES = [
  '@deepseek-ai/dsh',
  ...INSTALLED_PACKAGE_NAMES,
] as const

export type InstalledPackageName = (typeof INSTALLED_PACKAGE_NAMES)[number]
export type OfficialPackageName = (typeof OFFICIAL_PACKAGE_NAMES)[number]
export type MatrixPurpose = 'selection' | 'experimental' | 'diagnostic'
export type DecisionMode = 'selection' | 'exploratory'
export type MatrixRole = 'control' | 'candidate' | 'experimental' | 'diagnostic'

export type CaseStatus =
  | 'PASS'
  | 'FAIL_COMPATIBILITY'
  | 'INCONCLUSIVE_REGISTRY'
  | 'INCONCLUSIVE_LOCK'
  | 'INCONCLUSIVE_ADAPTER'
  | 'INFRA_ERROR'

export type CheckStatus = 'PASS' | 'FAIL' | 'BLOCKED'

export interface MatrixCase {
  readonly id: string
  readonly role: MatrixRole
  readonly release: { readonly '@deepseek-ai/dsh': ExactVersion }
  readonly packages: Readonly<Record<InstalledPackageName, ExactVersion>>
}

export interface MatrixConfig {
  readonly schemaVersion: '1'
  readonly decisionMode: DecisionMode
  readonly purpose: MatrixPurpose
  readonly runtime: {
    readonly node: ExactVersion
    readonly npmCli: ExactVersion
  }
  readonly toolchain: {
    readonly typescript: ExactVersion
    readonly tsdown: ExactVersion
    readonly zod: ExactVersion
  }
  readonly registry: 'https://registry.npmjs.org/'
  readonly generatorAdapter: 'workspace-v1'
  readonly fixture: 'strict-remote-v1'
  readonly policy: {
    readonly requireAllCasesConclusive: true
    readonly requireAtLeastOneCandidatePass: boolean
  }
  readonly cases: readonly MatrixCase[]
}

export interface RegistryEvidence {
  readonly name: OfficialPackageName
  readonly requestedVersion: string
  readonly returnedVersion: string
  readonly integrity: `sha512-${string}`
  readonly tarballOrigin: 'https://registry.npmjs.org'
  readonly repositoryUrl?: string
  readonly observedAt: string
}

export interface AssertionResult {
  readonly id: string
  readonly status: CheckStatus
  readonly expected: unknown
  readonly actualSummary: unknown
  readonly evidenceRefs: readonly string[]
}

export interface ArtifactEvidence {
  readonly path: string
  readonly size: number
  readonly sha256: string
  readonly createdAtMs: number
}

export type OrdinaryBundleEvidence = {
  readonly path: 'lib/index.js'
  readonly decisive: false
  readonly state: 'missing' | 'symlink' | 'other'
} | {
  readonly path: 'lib/index.js'
  readonly decisive: false
  readonly state: 'regular-file'
  readonly size: number
  readonly sha256: string
}

export interface NonDecisiveDiagnostics {
  readonly ordinaryBundle: OrdinaryBundleEvidence
}

export interface FixtureCopyValidationEvidence {
  readonly fixture: 'strict-remote-v1'
  readonly fileCount: number
  readonly sourceSha256: string
  readonly copiedSha256: string
}

export interface LockValidationEvidence {
  readonly lockfileVersion: 3
  readonly directVersions: Readonly<Record<string, string>>
}

export interface InstalledGraphValidationEvidence {
  readonly problemCount: 0
  readonly directVersions: Readonly<Record<string, string>>
}

export interface WorkspaceLinkValidationEvidence {
  readonly entryKind: 'symlink'
  readonly resolvesTo: 'packages/probe'
}

export interface PreseedValidationEvidence {
  readonly checkedPaths: readonly string[]
  readonly presentPaths: readonly string[]
}

export interface GeneratedFileValidationEvidence extends ArtifactEvidence {
  readonly fileType: 'regular'
  readonly symlink: false
  readonly withinProbe: true
  readonly fresh: true
}

export interface GeneratedArtifactsValidationEvidence {
  readonly files: readonly GeneratedFileValidationEvidence[]
  readonly packageExports: {
    readonly './typert': { readonly types: string; readonly default: string }
    readonly './remote': { readonly types: string; readonly default: string }
  }
  readonly generatedHeaders: {
    readonly checkedArtifactCount: number
    readonly matchingHeaderCount: number
  }
  readonly sourceMap: {
    readonly file: string
    readonly sourceCount: number
    readonly absoluteSourceCount: number
  }
  readonly pack: {
    readonly inventorySha256: string
    readonly totalFileCount: number
    readonly includedRequiredArtifacts: readonly string[]
    readonly forbiddenFileCount: number
    readonly absolutePathCount: number
    readonly manifestRequiredArtifactCount: number
  }
}

export interface CodecValidationEvidence {
  readonly hostMode: 'strict'
  readonly remoteMode: 'strict'
  readonly hostHasSafeParse: true
  readonly remoteHasSafeParse: true
  readonly typeSymbolBytes: number
  readonly typeSymbolSha256: string
  readonly symbolsAgree: true
  readonly validAcceptedCount: number
  readonly requiredInvalidRejectedCount: number
  readonly extraKeyRejectedCount: number
}

export interface DescriptorValidationEvidence {
  readonly host: {
    readonly exportName: 'TYPERT'
    readonly package: '@knight/dsh-typert-matrix-probe'
    readonly face: 'host'
    readonly methodIds: readonly string[]
    readonly invocationCount: number
  }
  readonly remote: {
    readonly exportName: 'TYPERT_REMOTE'
    readonly package: '@knight/dsh-typert-matrix-probe'
    readonly defaultIdentity: true
    readonly methodIds: readonly string[]
    readonly descriptorCount: number
  }
  readonly method: {
    readonly id: string
    readonly service: string
    readonly namespace: string
    readonly method: string
    readonly hostParameterCount: number
    readonly remoteParameterCount: number
    readonly fieldsAgree: true
  }
  readonly requestCodec: CodecValidationEvidence
  readonly resultCodec: CodecValidationEvidence
  readonly unknownLookup: {
    readonly id: 'matrixProbe/unknown'
    readonly hostMatchCount: number
    readonly remoteMatchCount: number
  }
}

export interface CaseValidationEvidence {
  readonly fixtureCopy?: FixtureCopyValidationEvidence
  readonly lock?: LockValidationEvidence
  readonly installedGraph?: InstalledGraphValidationEvidence
  readonly workspaceLink?: WorkspaceLinkValidationEvidence
  readonly preseed?: PreseedValidationEvidence
  readonly generatedArtifacts?: GeneratedArtifactsValidationEvidence
  readonly descriptors?: DescriptorValidationEvidence
}

export interface ReviewedLockEvidence {
  readonly schemaVersion: '1'
  readonly platformKey: string
  readonly manifestSha256: string
  readonly manifestCaseCount: number
  readonly lockSha256: string
  readonly installedGraphSha256: string
}

export interface SafeCiMetadata {
  readonly provider: 'github-actions'
  readonly repository: string | null
  readonly workflow: string | null
  readonly runId: string | null
  readonly runAttempt: string | null
  readonly commit: string | null
}

export interface RunProvenance {
  readonly schemaVersion: '1'
  readonly configSha256: string
  readonly configFileSha256: string
  readonly fixtureSha256: string
  readonly runnerGit: {
    readonly sourceGitCommit: string
    readonly worktreeClean: true
  }
  readonly runnerArtifacts: {
    readonly sourceTreeSha256: string
    readonly distJsSha256: string
    readonly toolPackageLockSha256: string
  }
  readonly lockMode: 'resolve' | 'frozen'
  readonly platformKey: string | null
  readonly runStartedAt: string
  readonly runCompletedAt: string
  readonly ci: SafeCiMetadata | null
}

export interface CaseEvidence {
  readonly schemaVersion: '1'
  readonly case: MatrixCase
  readonly fixtureSha256: string
  readonly status: CaseStatus
  readonly assertions: readonly AssertionResult[]
  readonly artifacts: readonly ArtifactEvidence[]
  readonly lockSha256?: string
  readonly installedGraphSha256?: string
  readonly reviewedLock?: ReviewedLockEvidence
  readonly registry?: readonly RegistryEvidence[]
  readonly failure?: { readonly code: string; readonly stage: string }
  readonly nonDecisiveDiagnostics?: NonDecisiveDiagnostics
  readonly stages?: readonly ProcessEvidence[]
  readonly directGenerator?: DirectGeneratorEvidence
  readonly validationEvidence?: CaseValidationEvidence
  /** Added by the CLI after all cases finish; aggregation rejects its absence. */
  readonly provenance?: RunProvenance
}

export const CONCLUSIVE_STATUSES = new Set<CaseStatus>([
  'PASS',
  'FAIL_COMPATIBILITY',
])
