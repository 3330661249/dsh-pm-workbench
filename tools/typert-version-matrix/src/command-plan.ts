import path from 'node:path'
import type { CasePaths } from './boundaries.js'
import type { MatrixCase, MatrixConfig, OfficialPackageName } from './types.js'

export type LockMode = 'resolve' | 'frozen'
export type PlannedProgram = 'npm-cli' | 'typescript' | 'workspace-adapter' | 'tsdown'

export type PlannedStage =
    | 'registry'
    | 'resolve-lock'
    | 'install'
    | 'tree'
    | 'compile'
    | 'direct-generator'
    | 'tsdown'
    | 'pack-dry-run'

export interface PlannedCommand {
  readonly stage: PlannedStage
  readonly program: PlannedProgram
  readonly args: readonly string[]
  readonly shell: false
  readonly timeoutMs: number
}

const DEFAULT_TIMEOUT_MS = 180_000
const EXTENDED_NPM_TIMEOUT_MS = 900_000
const TIMEOUT_BY_STAGE: Readonly<Record<PlannedStage, number>> = Object.freeze({
  registry: DEFAULT_TIMEOUT_MS,
  'resolve-lock': EXTENDED_NPM_TIMEOUT_MS,
  install: EXTENDED_NPM_TIMEOUT_MS,
  tree: DEFAULT_TIMEOUT_MS,
  compile: DEFAULT_TIMEOUT_MS,
  'direct-generator': DEFAULT_TIMEOUT_MS,
  tsdown: DEFAULT_TIMEOUT_MS,
  'pack-dry-run': DEFAULT_TIMEOUT_MS,
})

export function timeoutMsForStage(stage: PlannedStage): number {
  return TIMEOUT_BY_STAGE[stage]
}

function planned(
  stage: PlannedStage,
  program: PlannedProgram,
  args: readonly string[],
): PlannedCommand {
  return Object.freeze({
    stage,
    program,
    args: Object.freeze([...args]),
    shell: false,
    timeoutMs: timeoutMsForStage(stage),
  })
}

const npmIsolationArgs = (config: MatrixConfig, paths: CasePaths): string[] => [
  `--registry=${config.registry}`,
  `--cache=${paths.npmCache}`,
  `--userconfig=${paths.npmrc}`,
]

export function registryCoordinates(matrixCase: MatrixCase): Array<[OfficialPackageName, string]> {
  return [
    ['@deepseek-ai/dsh', matrixCase.release['@deepseek-ai/dsh']],
    ['@deepseek-ai/dsh-typert-generator', matrixCase.packages['@deepseek-ai/dsh-typert-generator']],
    ['@deepseek-ai/dsh-typert-protocol', matrixCase.packages['@deepseek-ai/dsh-typert-protocol']],
    ['@deepseek-ai/dsh-invariants', matrixCase.packages['@deepseek-ai/dsh-invariants']],
    ['@deepseek-ai/cordis', matrixCase.packages['@deepseek-ai/cordis']],
  ]
}

export function buildCaseCommandPlan(
  config: MatrixConfig,
  matrixCase: MatrixCase,
  paths: CasePaths,
  lockMode: LockMode,
): readonly PlannedCommand[] {
  const isolated = npmIsolationArgs(config, paths)
  const registry: PlannedCommand[] = registryCoordinates(matrixCase).map(([name, version]) =>
    planned('registry', 'npm-cli', [
      'view',
      `${name}@${version}`,
      'name',
      'version',
      'dist.integrity',
      'dist.tarball',
      'repository',
      '--json',
      ...isolated,
    ]))
  const lock: PlannedCommand = lockMode === 'resolve'
    ? planned('resolve-lock', 'npm-cli', [
      'install', '--package-lock-only', '--ignore-scripts', '--no-audit', '--no-fund', ...isolated,
    ])
    : planned('resolve-lock', 'npm-cli', [
      'ci', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund', ...isolated,
    ])
  return [
    ...registry,
    lock,
    planned('install', 'npm-cli', [
      'ci', '--ignore-scripts=false', '--no-audit', '--no-fund', ...isolated,
    ]),
    planned('tree', 'npm-cli', ['ls', '--all', '--json']),
    planned('compile', 'typescript', ['-b', 'tsconfig.host.json', '--pretty', 'false']),
    planned('direct-generator', 'workspace-adapter', [
      '--workspace', paths.workspace,
      '--output', path.join(paths.logs, 'direct-generator.json'),
      '--case-root', paths.root,
    ]),
    planned('tsdown', 'tsdown', ['--config', 'tsdown.config.mjs']),
    planned('pack-dry-run', 'npm-cli', [
      'pack', '--dry-run', '--json', '--workspace', '@knight/dsh-typert-matrix-probe', ...isolated,
    ]),
  ]
}
