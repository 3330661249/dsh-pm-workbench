import { REQUIRED_ARTIFACTS } from './assertions/artifacts.js'
import {
  assertExactPassAssertionInventory,
  REQUIRED_PASS_ASSERTIONS,
} from './assertion-results.js'
import { assertRunProvenance, expectedFrozenPlatformKey } from './provenance.js'
import {
  CONCLUSIVE_STATUSES,
  type CaseEvidence,
  type MatrixConfig,
  type RunProvenance,
} from './types.js'

export { REQUIRED_PASS_ASSERTIONS } from './assertion-results.js'

export type MatrixDecision =
  | 'ELIGIBLE_FOR_NEXT_ISOLATED_MOUNT_PROBE'
  | 'NO_ELIGIBLE_CANDIDATE'
  | 'EXPLORATORY_ONLY'
  | 'INCONCLUSIVE'

export interface MatrixReport {
  readonly schemaVersion: '1'
  readonly runId: string
  readonly config: MatrixConfig
  readonly environment: {
    readonly platform: string
    readonly arch: string
    readonly node: string
    readonly npmCli: string
    readonly provenance: RunProvenance
  }
  readonly cases: readonly CaseEvidence[]
  readonly eligibleCandidateIds: readonly string[]
  readonly incompleteCaseIds: readonly string[]
  readonly exitCode: 0 | 1 | 2
  readonly exitReason: string
  readonly decision: MatrixDecision
  readonly humanDecisionRequired: true
  readonly evidenceBoundary: 'This result does not prove full DeepSeek Harness compatibility.'
}

export class ReportValidationError extends Error {
  override name = 'ReportValidationError'
}

function validatePass(caseEvidence: CaseEvidence): void {
  try {
    assertExactPassAssertionInventory(caseEvidence.assertions)
  } catch {
    throw new ReportValidationError(`PASS case ${caseEvidence.case.id} is missing required A-D assertions`)
  }
  const paths = new Set(caseEvidence.artifacts.map(({ path }) => path))
  if (REQUIRED_ARTIFACTS.some((path) => !paths.has(path)) || paths.size !== REQUIRED_ARTIFACTS.length) {
    throw new ReportValidationError(`PASS case ${caseEvidence.case.id} is missing exact artifact evidence`)
  }
}

export interface AggregateMetadata {
  readonly runId: string
  readonly platform: string
  readonly arch: string
  readonly node: string
  readonly npmCli: string
}

type RuntimeMetadata = Pick<AggregateMetadata, 'platform' | 'arch' | 'node' | 'npmCli'>

export function assertSupportedRuntimeMetadata(
  config: MatrixConfig,
  metadata: RuntimeMetadata,
): void {
  if (!['darwin', 'linux'].includes(metadata.platform)) {
    throw new ReportValidationError('runtime platform is unsupported')
  }
  if (!['arm64', 'x64'].includes(metadata.arch)) {
    throw new ReportValidationError('runtime architecture is unsupported')
  }
  if (metadata.node !== config.runtime.node || metadata.npmCli !== config.runtime.npmCli) {
    throw new ReportValidationError('runtime versions differ from matrix config')
  }
}

function provenanceIdentity(value: RunProvenance): string {
  return JSON.stringify([
    value.schemaVersion,
    value.configSha256,
    value.configFileSha256,
    value.fixtureSha256,
    value.runnerGit.sourceGitCommit,
    value.runnerGit.worktreeClean,
    value.runnerArtifacts.sourceTreeSha256,
    value.runnerArtifacts.distJsSha256,
    value.runnerArtifacts.toolPackageLockSha256,
    value.lockMode,
    value.platformKey,
    value.runStartedAt,
    value.runCompletedAt,
    value.ci === null
      ? null
      : [
        value.ci.provider,
        value.ci.repository,
        value.ci.workflow,
        value.ci.runId,
        value.ci.runAttempt,
        value.ci.commit,
      ],
  ])
}

function sharedProvenance(
  config: MatrixConfig,
  cases: readonly CaseEvidence[],
): RunProvenance {
  for (const item of cases) {
    try {
      assertRunProvenance(item.provenance, config)
    } catch (error) {
      throw new ReportValidationError(
        `case ${item.case.id} provenance is invalid: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
    if (
      !/^[a-f0-9]{64}$/.test(item.fixtureSha256)
      || item.fixtureSha256 !== item.provenance!.fixtureSha256
    ) {
      throw new ReportValidationError(
        `case ${item.case.id} fixture SHA differs from run provenance`,
      )
    }
  }
  const first = cases[0]!.provenance!
  const identity = provenanceIdentity(first)
  for (const item of cases.slice(1)) {
    if (provenanceIdentity(item.provenance!) !== identity) {
      throw new ReportValidationError(`case ${item.case.id} provenance differs across cases`)
    }
  }
  return first
}

export function aggregateMatrix(
  config: MatrixConfig,
  cases: readonly CaseEvidence[],
  metadata: AggregateMetadata,
): MatrixReport {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(metadata.runId)) {
    throw new ReportValidationError('runId is invalid')
  }
  assertSupportedRuntimeMetadata(config, metadata)
  if (cases.length !== config.cases.length) {
    throw new ReportValidationError('case evidence inventory differs from config')
  }
  if (cases.length === 0) throw new ReportValidationError('case evidence inventory is empty')
  const provenance = sharedProvenance(config, cases)
  if (provenance.lockMode === 'frozen') {
    const expectedPlatformKey = expectedFrozenPlatformKey(
      metadata.platform,
      metadata.arch,
      config,
    )
    if (provenance.platformKey !== expectedPlatformKey) {
      throw new ReportValidationError(
        `frozen platformKey must equal reported runtime key ${expectedPlatformKey}`,
      )
    }
  }
  const byId = new Map(cases.map((entry) => [entry.case.id, entry]))
  if (byId.size !== cases.length) throw new ReportValidationError('case evidence ids are duplicated')
  for (const expected of config.cases) {
    const observed = byId.get(expected.id)
    if (
      observed === undefined
      || observed.case.role !== expected.role
      || observed.case.release['@deepseek-ai/dsh'] !== expected.release['@deepseek-ai/dsh']
      || Object.entries(expected.packages).some(([name, version]) =>
        observed.case.packages[name as keyof typeof expected.packages] !== version)
    ) {
      throw new ReportValidationError(`case evidence missing or role mismatch for ${expected.id}`)
    }
    if (observed.status === 'PASS') validatePass(observed)
  }
  const ordered = config.cases.map(({ id }) => byId.get(id)!)
  const incompleteCaseIds = ordered
    .filter(({ status }) => !CONCLUSIVE_STATUSES.has(status))
    .map(({ case: matrixCase }) => matrixCase.id)

  let exitCode: 0 | 1 | 2
  let decision: MatrixDecision
  let exitReason: string
  let eligibleCandidateIds: string[] = []
  if (incompleteCaseIds.length > 0) {
    exitCode = 2
    decision = 'INCONCLUSIVE'
    exitReason = 'One or more cases are inconclusive or encountered an infrastructure error.'
  } else if (config.decisionMode === 'exploratory') {
    exitCode = 1
    decision = 'EXPLORATORY_ONLY'
    exitReason = 'Exploratory evidence is complete but is not eligible for automatic selection.'
  } else {
    eligibleCandidateIds = ordered
      .filter(({ case: matrixCase, status }) => matrixCase.role === 'candidate' && status === 'PASS')
      .map(({ case: matrixCase }) => matrixCase.id)
    if (eligibleCandidateIds.length > 0) {
      exitCode = 0
      decision = 'ELIGIBLE_FOR_NEXT_ISOLATED_MOUNT_PROBE'
      exitReason = 'At least one exact candidate passed every Remote-generation assertion.'
    } else {
      exitCode = 1
      decision = 'NO_ELIGIBLE_CANDIDATE'
      exitReason = 'The complete selection matrix contains no passing candidate.'
    }
  }

  return {
    schemaVersion: '1',
    runId: metadata.runId,
    config,
    environment: {
      platform: metadata.platform,
      arch: metadata.arch,
      node: metadata.node,
      npmCli: metadata.npmCli,
      provenance,
    },
    cases: ordered,
    eligibleCandidateIds,
    incompleteCaseIds,
    exitCode,
    exitReason,
    decision,
    humanDecisionRequired: true,
    evidenceBoundary: 'This result does not prove full DeepSeek Harness compatibility.',
  }
}
