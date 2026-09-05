import { parseExactVersion } from './exact-version.js'
import {
  INSTALLED_PACKAGE_NAMES,
  type DecisionMode,
  type InstalledPackageName,
  type MatrixCase,
  type MatrixConfig,
  type MatrixPurpose,
  type MatrixRole,
} from './types.js'

const TOP_LEVEL_KEYS = [
  'schemaVersion',
  'decisionMode',
  'purpose',
  'runtime',
  'toolchain',
  'registry',
  'generatorAdapter',
  'fixture',
  'policy',
  'cases',
] as const

const CASE_KEYS = ['id', 'role', 'release', 'packages'] as const
const CASE_ID = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/

interface ReviewedCase {
  readonly id: string
  readonly role: MatrixRole
  readonly release: string
  readonly packages: Readonly<Record<InstalledPackageName, string>>
}

function reviewedCase(
  id: string,
  role: MatrixRole,
  release: string,
  cordis: string,
): ReviewedCase {
  return {
    id,
    role,
    release,
    packages: {
      '@deepseek-ai/dsh-typert-generator': release,
      '@deepseek-ai/dsh-typert-protocol': release,
      '@deepseek-ai/dsh-invariants': release,
      '@deepseek-ai/cordis': cordis,
    },
  }
}

const OFFICIAL_CASE_INVENTORY: Readonly<Record<MatrixPurpose, readonly ReviewedCase[]>> = {
  selection: [
    reviewedCase('typert-0.1.0-rc.6-control', 'control', '0.1.0-rc.6', '4.0.1'),
    reviewedCase('typert-0.1.0-rc.7', 'candidate', '0.1.0-rc.7', '4.0.1'),
    reviewedCase('typert-0.1.0-rc.8', 'candidate', '0.1.0-rc.8', '4.0.1'),
    reviewedCase('typert-0.1.1-rc.1', 'candidate', '0.1.1-rc.1', '4.0.1'),
    reviewedCase('typert-0.1.1-rc.2', 'candidate', '0.1.1-rc.2', '4.0.1'),
  ],
  experimental: [
    reviewedCase('typert-0.1.2-alpha.2', 'experimental', '0.1.2-alpha.2', '4.0.2'),
    reviewedCase('typert-0.1.2-alpha.3', 'experimental', '0.1.2-alpha.3', '4.0.2'),
    reviewedCase('typert-0.1.2-alpha.4', 'experimental', '0.1.2-alpha.4', '4.0.2'),
  ],
  diagnostic: [
    reviewedCase('typert-0.0.1-rc.5-legacy', 'diagnostic', '0.0.1-rc.5', '4.0.1-rc.4'),
    reviewedCase('typert-0.1.0-rc.2-legacy', 'diagnostic', '0.1.0-rc.2', '4.0.1'),
    reviewedCase('typert-0.1.0-rc.3-legacy', 'diagnostic', '0.1.0-rc.3', '4.0.1'),
  ],
}

function assertReviewedCases(purpose: MatrixPurpose, cases: readonly MatrixCase[]): void {
  const expectedCases = OFFICIAL_CASE_INVENTORY[purpose]
  if (cases.length !== expectedCases.length) {
    throw new Error(
      `official case inventory for ${purpose} must contain exactly ${expectedCases.length} cases`,
    )
  }
  const expectedById = new Map(expectedCases.map((item) => [item.id, item]))
  for (const item of cases) {
    const expected = expectedById.get(item.id)
    if (expected === undefined) {
      throw new Error(`official case inventory for ${purpose} has unexpected case ${item.id}`)
    }
    if (item.role !== expected.role) {
      throw new Error(
        `official case inventory case ${item.id} role must equal ${expected.role}`,
      )
    }
    if (item.release['@deepseek-ai/dsh'] !== expected.release) {
      throw new Error(
        `official case inventory case ${item.id} release is outside the reviewed cohort ${expected.release}`,
      )
    }
    for (const packageName of INSTALLED_PACKAGE_NAMES) {
      if (item.packages[packageName] !== expected.packages[packageName]) {
        const boundaryName = packageName === '@deepseek-ai/cordis' ? 'Cordis' : packageName
        throw new Error(
          `official case inventory case ${item.id} reviewed boundary for ${boundaryName} must equal ${expected.packages[packageName]}`,
        )
      }
    }
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function exactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  label: string,
): void {
  const unknown = Object.keys(value).find((key) => !allowed.includes(key))
  if (unknown !== undefined) throw new Error(`${label} has unknown key ${unknown}`)
  const missing = allowed.find((key) => !(key in value))
  if (missing !== undefined) throw new Error(`${label} is missing key ${missing}`)
}

function literal<T extends string>(value: unknown, expected: T, label: string): T {
  if (value !== expected) throw new Error(`${label} must equal ${expected}`)
  return expected
}

function parsePurpose(value: unknown): MatrixPurpose {
  if (value === 'selection' || value === 'experimental' || value === 'diagnostic') {
    return value
  }
  throw new Error('purpose must be selection, experimental, or diagnostic')
}

function parseDecisionMode(value: unknown): DecisionMode {
  if (value === 'selection' || value === 'exploratory') return value
  throw new Error('decisionMode must be selection or exploratory')
}

function parseRole(value: unknown): MatrixRole {
  if (
    value === 'control'
    || value === 'candidate'
    || value === 'experimental'
    || value === 'diagnostic'
  ) return value
  throw new Error('case role is invalid')
}

function parseCase(input: unknown): MatrixCase {
  const value = record(input, 'case')
  exactKeys(value, CASE_KEYS, 'case')

  if (typeof value.id !== 'string' || !CASE_ID.test(value.id)) {
    throw new Error('case id must match the fixed safe slug grammar')
  }
  const role = parseRole(value.role)

  const release = record(value.release, 'case.release')
  exactKeys(release, ['@deepseek-ai/dsh'], 'case.release')
  const releaseVersion = parseExactVersion(
    release['@deepseek-ai/dsh'],
    'case.release @deepseek-ai/dsh',
  )

  const packagesInput = record(value.packages, 'case.packages')
  exactKeys(packagesInput, INSTALLED_PACKAGE_NAMES, 'case.packages')
  const packages = Object.fromEntries(
    INSTALLED_PACKAGE_NAMES.map((name) => [
      name,
      parseExactVersion(packagesInput[name], `case package ${name}`),
    ]),
  ) as Record<InstalledPackageName, ReturnType<typeof parseExactVersion>>

  const cohortVersions = [
    releaseVersion,
    packages['@deepseek-ai/dsh-typert-generator'],
    packages['@deepseek-ai/dsh-typert-protocol'],
    packages['@deepseek-ai/dsh-invariants'],
  ]
  if (new Set(cohortVersions).size !== 1) {
    throw new Error(`case ${value.id} must use one aligned DSH cohort`)
  }

  return { id: value.id, role, release: { '@deepseek-ai/dsh': releaseVersion }, packages }
}

function assertPurposeRoles(config: {
  decisionMode: DecisionMode
  purpose: MatrixPurpose
  cases: readonly MatrixCase[]
  requireCandidate: boolean
}): void {
  const roles = new Set(config.cases.map(({ role }) => role))
  if (config.purpose === 'selection') {
    if (config.decisionMode !== 'selection') {
      throw new Error('selection purpose requires decisionMode selection')
    }
    if (!roles.has('control')) throw new Error('selection matrix requires a control case')
    if (!roles.has('candidate')) throw new Error('selection matrix requires a candidate case')
    if ([...roles].some((role) => role !== 'control' && role !== 'candidate')) {
      throw new Error('selection matrix accepts only control and candidate roles')
    }
    if (!config.requireCandidate) {
      throw new Error('selection policy must require at least one candidate pass')
    }
    return
  }

  const expected = config.purpose === 'experimental' ? 'experimental' : 'diagnostic'
  if (config.decisionMode !== 'exploratory') {
    throw new Error(`${config.purpose} purpose requires decisionMode exploratory`)
  }
  if (config.requireCandidate) {
    throw new Error(`${config.purpose} policy cannot require a candidate pass`)
  }
  if ([...roles].some((role) => role !== expected)) {
    throw new Error(`${config.purpose} matrix accepts only ${expected} role cases`)
  }
}

export function parseMatrixConfig(input: unknown): MatrixConfig {
  const value = record(input, 'matrix')
  exactKeys(value, TOP_LEVEL_KEYS, 'matrix')

  const runtime = record(value.runtime, 'runtime')
  exactKeys(runtime, ['node', 'npmCli'], 'runtime')
  const toolchain = record(value.toolchain, 'toolchain')
  exactKeys(toolchain, ['typescript', 'tsdown', 'zod'], 'toolchain')
  const policy = record(value.policy, 'policy')
  exactKeys(
    policy,
    ['requireAllCasesConclusive', 'requireAtLeastOneCandidatePass'],
    'policy',
  )

  literal(value.schemaVersion, '1', 'schemaVersion')
  const decisionMode = parseDecisionMode(value.decisionMode)
  const purpose = parsePurpose(value.purpose)
  const node = parseExactVersion(runtime.node, 'runtime.node')
  const npmCli = parseExactVersion(runtime.npmCli, 'runtime.npmCli')
  const typescript = parseExactVersion(toolchain.typescript, 'toolchain.typescript')
  const tsdown = parseExactVersion(toolchain.tsdown, 'toolchain.tsdown')
  const zod = parseExactVersion(toolchain.zod, 'toolchain.zod')
  literal(node, '24.14.0', 'runtime.node')
  literal(npmCli, '11.9.0', 'runtime.npmCli')
  literal(typescript, '6.0.3', 'toolchain.typescript')
  literal(tsdown, '0.22.2', 'toolchain.tsdown')
  literal(zod, '4.4.3', 'toolchain.zod')
  literal(value.registry, 'https://registry.npmjs.org/', 'registry')
  literal(value.generatorAdapter, 'workspace-v1', 'generator adapter')
  literal(value.fixture, 'strict-remote-v1', 'fixture')
  if (policy.requireAllCasesConclusive !== true) {
    throw new Error('policy must require all cases conclusive')
  }
  if (typeof policy.requireAtLeastOneCandidatePass !== 'boolean') {
    throw new Error('policy requireAtLeastOneCandidatePass must be boolean')
  }
  if (!Array.isArray(value.cases) || value.cases.length === 0) {
    throw new Error('cases must be a non-empty array')
  }

  const cases = value.cases.map(parseCase)
  const ids = new Set<string>()
  for (const item of cases) {
    if (ids.has(item.id)) throw new Error(`duplicate case id ${item.id}`)
    ids.add(item.id)
  }
  assertPurposeRoles({
    decisionMode,
    purpose,
    cases,
    requireCandidate: policy.requireAtLeastOneCandidatePass,
  })
  assertReviewedCases(purpose, cases)

  return {
    schemaVersion: '1',
    decisionMode,
    purpose,
    runtime: { node, npmCli },
    toolchain: { typescript, tsdown, zod },
    registry: 'https://registry.npmjs.org/',
    generatorAdapter: 'workspace-v1',
    fixture: 'strict-remote-v1',
    policy: {
      requireAllCasesConclusive: true,
      requireAtLeastOneCandidatePass: policy.requireAtLeastOneCandidatePass,
    },
    cases,
  }
}
