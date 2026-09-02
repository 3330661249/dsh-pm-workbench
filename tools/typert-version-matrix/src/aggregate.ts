import { REQUIRED_ARTIFACTS } from './assertions/artifacts.js'
import { CONCLUSIVE_STATUSES, type CaseEvidence, type MatrixConfig } from './types.js'

const assertionRange = (prefix: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `${prefix}${String(index + 1).padStart(2, '0')}`)

export const REQUIRED_PASS_ASSERTIONS = [
  ...assertionRange('A', 9),
  ...assertionRange('B', 6),
  ...assertionRange('C', 10),
  ...assertionRange('D', 10),
] as const

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
  const assertions = new Map(caseEvidence.assertions.map((entry) => [entry.id, entry.status]))
  if (REQUIRED_PASS_ASSERTIONS.some((id) => assertions.get(id) !== 'PASS')) {
    throw new ReportValidationError(`PASS case ${caseEvidence.case.id} is missing required A-D assertions`)
  }
  const paths = new Set(caseEvidence.artifacts.map(({ path }) => path))
  if (REQUIRED_ARTIFACTS.some((path) => !paths.has(path)) || paths.size !== REQUIRED_ARTIFACTS.length) {
    throw new ReportValidationError(`PASS case ${caseEvidence.case.id} is missing exact artifact evidence`)
  }
}

export interface AggregateMetadata {
  readonly runId: string
  readonly platform?: string
  readonly arch?: string
  readonly node?: string
  readonly npmCli?: string
}

export function aggregateMatrix(
  config: MatrixConfig,
  cases: readonly CaseEvidence[],
  metadata: AggregateMetadata,
): MatrixReport {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,127}$/.test(metadata.runId)) {
    throw new ReportValidationError('runId is invalid')
  }
  if (cases.length !== config.cases.length) {
    throw new ReportValidationError('case evidence inventory differs from config')
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
      platform: metadata.platform ?? 'unknown',
      arch: metadata.arch ?? 'unknown',
      node: metadata.node ?? config.runtime.node,
      npmCli: metadata.npmCli ?? config.runtime.npmCli,
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
