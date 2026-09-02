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

export interface CaseEvidence {
  readonly schemaVersion: '1'
  readonly case: MatrixCase
  readonly status: CaseStatus
  readonly assertions: readonly AssertionResult[]
  readonly artifacts: readonly ArtifactEvidence[]
  readonly lockSha256?: string
  readonly installedGraphSha256?: string
  readonly registry?: readonly RegistryEvidence[]
  readonly failure?: { readonly code: string; readonly stage: string }
  readonly nonDecisiveDiagnostics?: Readonly<Record<string, unknown>>
  readonly stages?: readonly ProcessEvidence[]
  readonly directGenerator?: DirectGeneratorEvidence
}

export const CONCLUSIVE_STATUSES = new Set<CaseStatus>([
  'PASS',
  'FAIL_COMPATIBILITY',
])
