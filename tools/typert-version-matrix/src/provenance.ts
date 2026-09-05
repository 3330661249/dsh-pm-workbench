import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { realpathSync } from 'node:fs'
import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import type {
  MatrixConfig,
  RunProvenance,
  SafeCiMetadata,
} from './types.js'

const SHA256 = /^[a-f0-9]{64}$/
const GIT_COMMIT = /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/
const PLATFORM_KEY = /^[a-z0-9][a-z0-9.-]{0,63}$/

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value === 'object' && value !== null) {
    return `{${Object.entries(value as Record<string, unknown>)
      .filter(([, nested]) => nested !== undefined)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, nested]) => `${JSON.stringify(key)}:${canonical(nested)}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hashConfigFileBytes(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export function hashMatrixConfig(config: MatrixConfig): string {
  return sha256(canonical(config))
}

export function expectedFrozenPlatformKey(
  platform: string,
  arch: string,
  config: MatrixConfig,
): string {
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(platform)) {
    throw new Error('runtime platform is unsafe for a frozen lock key')
  }
  if (!/^[a-z0-9][a-z0-9-]{0,31}$/.test(arch)) {
    throw new Error('runtime architecture is unsafe for a frozen lock key')
  }
  const nodeMajor = config.runtime.node.split('.')[0]!
  const npmMajor = config.runtime.npmCli.split('.')[0]!
  return `${platform}-${arch}-node${nodeMajor}-npm${npmMajor}`
}

function git(repositoryRoot: string, args: readonly string[]): string {
  const result = spawnSync('git', [...args], {
    cwd: repositoryRoot,
    encoding: 'utf8',
    env: { PATH: '/usr/bin:/bin', LC_ALL: 'C' },
    maxBuffer: 1024 * 1024,
    shell: false,
  })
  if (result.error !== undefined || result.signal !== null || result.status !== 0) {
    throw new Error(`runner Git provenance command failed: git ${args[0] ?? ''}`)
  }
  return result.stdout.trim()
}

export interface CleanRunnerGitProvenance {
  readonly sourceGitCommit: string
  readonly worktreeClean: true
}

export interface RunnerArtifactProvenance {
  readonly sourceTreeSha256: string
  readonly distJsSha256: string
  readonly toolPackageLockSha256: string
}

export interface RunStateFingerprint {
  readonly configSha256: string
  readonly configFileSha256: string
  readonly fixtureSha256: string
  readonly runnerGit: CleanRunnerGitProvenance
  readonly runnerArtifacts: RunnerArtifactProvenance
}

export function assertRunStateUnchanged(
  initial: RunStateFingerprint,
  final: RunStateFingerprint,
): void {
  if (
    initial.configSha256 !== final.configSha256
    || initial.configFileSha256 !== final.configFileSha256
    || initial.fixtureSha256 !== final.fixtureSha256
    || initial.runnerGit.sourceGitCommit !== final.runnerGit.sourceGitCommit
    || initial.runnerGit.worktreeClean !== final.runnerGit.worktreeClean
    || initial.runnerArtifacts.sourceTreeSha256 !== final.runnerArtifacts.sourceTreeSha256
    || initial.runnerArtifacts.distJsSha256 !== final.runnerArtifacts.distJsSha256
    || initial.runnerArtifacts.toolPackageLockSha256
      !== final.runnerArtifacts.toolPackageLockSha256
  ) throw new Error('config, fixture, or runner Git state changed during the run')
}

export function collectCleanRunnerGitProvenance(
  repositoryRoot: string,
): CleanRunnerGitProvenance {
  const observedRoot = git(repositoryRoot, ['rev-parse', '--show-toplevel'])
  if (realpathSync(observedRoot) !== realpathSync(repositoryRoot)) {
    throw new Error('runner Git provenance root does not match repository root')
  }
  const commit = git(repositoryRoot, ['rev-parse', '--verify', 'HEAD^{commit}'])
  if (!GIT_COMMIT.test(commit)) {
    throw new Error('runner Git provenance commit is invalid')
  }
  const status = git(repositoryRoot, ['status', '--porcelain=v1', '--untracked-files=all'])
  if (status.length !== 0) {
    throw new Error('runner Git worktree is dirty; provenance requires a clean checkout')
  }
  return { sourceGitCommit: commit, worktreeClean: true }
}

async function fileInventory(
  root: string,
  current: string,
  include: (relative: string) => boolean,
): Promise<string[]> {
  const result: string[] = []
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const absolute = path.join(current, entry.name)
    const info = await lstat(absolute)
    if (info.isSymbolicLink()) throw new Error('runner artifact inventory forbids symlinks')
    if (info.isDirectory()) {
      result.push(...await fileInventory(root, absolute, include))
    } else if (info.isFile()) {
      const relative = path.relative(root, absolute).split(path.sep).join('/')
      if (include(relative)) result.push(relative)
    } else {
      throw new Error('runner artifact inventory contains a non-regular entry')
    }
  }
  return result.sort()
}

async function aggregateFiles(toolRoot: string, relativePaths: readonly string[]): Promise<string> {
  const entries: string[] = []
  for (const relative of relativePaths) {
    const absolute = path.join(toolRoot, relative)
    const info = await lstat(absolute)
    if (!info.isFile() || info.isSymbolicLink()) {
      throw new Error(`runner provenance file is not regular: ${relative}`)
    }
    entries.push(`${relative}\0${hashConfigFileBytes(await readFile(absolute))}\n`)
  }
  return sha256(entries.join(''))
}

export async function collectRunnerArtifactProvenance(
  toolRoot: string,
): Promise<RunnerArtifactProvenance> {
  const sourceFiles = await fileInventory(
    toolRoot,
    path.join(toolRoot, 'src'),
    (relative) => relative.startsWith('src/') && relative.endsWith('.ts'),
  )
  const sourceInventory = [
    ...sourceFiles,
    'package.json',
    'tsconfig.json',
    'tsconfig.build.json',
  ].sort()
  const distFiles = await fileInventory(
    toolRoot,
    path.join(toolRoot, 'dist'),
    (relative) => relative.startsWith('dist/') && relative.endsWith('.js'),
  )
  for (const required of ['dist/cli.js', 'dist/adapters/workspace-v1.js']) {
    if (!distFiles.includes(required)) {
      throw new Error(`runner dist JS inventory is missing ${required}`)
    }
  }
  if (sourceFiles.length === 0) throw new Error('runner source inventory is empty')
  return {
    sourceTreeSha256: await aggregateFiles(toolRoot, sourceInventory),
    distJsSha256: await aggregateFiles(toolRoot, distFiles),
    toolPackageLockSha256: hashConfigFileBytes(
      await readFile(path.join(toolRoot, 'package-lock.json')),
    ),
  }
}

function optionalCiValue(
  env: NodeJS.ProcessEnv,
  name: string,
  predicate: (value: string) => boolean,
): string | null {
  const value = env[name]
  if (value === undefined || value === '') return null
  if (!predicate(value)) throw new Error(`unsafe GitHub Actions provenance field ${name}`)
  return value
}

export function collectSafeCiMetadata(env: NodeJS.ProcessEnv): SafeCiMetadata | null {
  if (env.GITHUB_ACTIONS !== 'true') return null
  const display = (value: string) => value.length <= 128 && !/[\0\r\n]/.test(value)
  return {
    provider: 'github-actions',
    repository: optionalCiValue(
      env,
      'GITHUB_REPOSITORY',
      (value) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value),
    ),
    workflow: optionalCiValue(env, 'GITHUB_WORKFLOW', display),
    runId: optionalCiValue(env, 'GITHUB_RUN_ID', (value) => /^\d{1,32}$/.test(value)),
    runAttempt: optionalCiValue(
      env,
      'GITHUB_RUN_ATTEMPT',
      (value) => /^\d{1,10}$/.test(value),
    ),
    commit: optionalCiValue(env, 'GITHUB_SHA', (value) => GIT_COMMIT.test(value)),
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (canonical(actual) !== canonical(expected)) {
    throw new Error(`${label} must use the exact provenance schema`)
  }
}

function assertIsoInstant(value: unknown, label: string): asserts value is string {
  if (
    typeof value !== 'string'
    || Number.isNaN(Date.parse(value))
    || new Date(value).toISOString() !== value
  ) throw new Error(`${label} must be a canonical UTC timestamp`)
}

function assertSafeCi(value: unknown): asserts value is SafeCiMetadata | null {
  if (value === null) return
  const ci = record(value, 'provenance.ci')
  exactKeys(
    ci,
    ['provider', 'repository', 'workflow', 'runId', 'runAttempt', 'commit'],
    'provenance.ci',
  )
  if (ci.provider !== 'github-actions') throw new Error('provenance.ci provider is invalid')
  const nullable = (field: string, predicate: (value: string) => boolean): void => {
    const observed = ci[field]
    if (observed !== null && (typeof observed !== 'string' || !predicate(observed))) {
      throw new Error(`provenance.ci ${field} is invalid`)
    }
  }
  nullable('repository', (entry) => /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(entry))
  nullable('workflow', (entry) => entry.length <= 128 && !/[\0\r\n]/.test(entry))
  nullable('runId', (entry) => /^\d{1,32}$/.test(entry))
  nullable('runAttempt', (entry) => /^\d{1,10}$/.test(entry))
  nullable('commit', (entry) => GIT_COMMIT.test(entry))
}

export function assertRunProvenance(
  value: unknown,
  config: MatrixConfig,
): asserts value is RunProvenance {
  const provenance = record(value, 'case provenance')
  exactKeys(provenance, [
    'schemaVersion',
    'configSha256',
    'configFileSha256',
    'fixtureSha256',
    'runnerGit',
    'runnerArtifacts',
    'lockMode',
    'platformKey',
    'runStartedAt',
    'runCompletedAt',
    'ci',
  ], 'case provenance')
  if (provenance.schemaVersion !== '1') throw new Error('case provenance schema is invalid')
  if (
    typeof provenance.configSha256 !== 'string'
    || !SHA256.test(provenance.configSha256)
    || provenance.configSha256 !== hashMatrixConfig(config)
  ) throw new Error('case provenance config SHA does not match the normalized config')
  if (
    typeof provenance.configFileSha256 !== 'string'
    || !SHA256.test(provenance.configFileSha256)
  ) throw new Error('case provenance config file SHA is invalid')
  if (typeof provenance.fixtureSha256 !== 'string' || !SHA256.test(provenance.fixtureSha256)) {
    throw new Error('case provenance fixture SHA is invalid')
  }
  const runnerGit = record(provenance.runnerGit, 'case provenance runnerGit')
  exactKeys(runnerGit, ['sourceGitCommit', 'worktreeClean'], 'case provenance runnerGit')
  if (
    typeof runnerGit.sourceGitCommit !== 'string'
    || !GIT_COMMIT.test(runnerGit.sourceGitCommit)
  ) {
    throw new Error('case provenance runner Git commit is invalid')
  }
  if (runnerGit.worktreeClean !== true) {
    throw new Error('case provenance runner Git worktree must be clean')
  }
  const runnerArtifacts = record(
    provenance.runnerArtifacts,
    'case provenance runnerArtifacts',
  )
  exactKeys(
    runnerArtifacts,
    ['sourceTreeSha256', 'distJsSha256', 'toolPackageLockSha256'],
    'case provenance runnerArtifacts',
  )
  for (const key of [
    'sourceTreeSha256',
    'distJsSha256',
    'toolPackageLockSha256',
  ] as const) {
    if (typeof runnerArtifacts[key] !== 'string' || !SHA256.test(runnerArtifacts[key])) {
      throw new Error(`case provenance runnerArtifacts ${key} is invalid`)
    }
  }
  if (provenance.lockMode !== 'resolve' && provenance.lockMode !== 'frozen') {
    throw new Error('case provenance lockMode is invalid')
  }
  if (
    provenance.platformKey !== null
    && (typeof provenance.platformKey !== 'string' || !PLATFORM_KEY.test(provenance.platformKey))
  ) throw new Error('case provenance platformKey is invalid')
  if (provenance.lockMode === 'frozen' && provenance.platformKey === null) {
    throw new Error('case provenance frozen lockMode requires platformKey')
  }
  assertIsoInstant(provenance.runStartedAt, 'case provenance runStartedAt')
  assertIsoInstant(provenance.runCompletedAt, 'case provenance runCompletedAt')
  if (Date.parse(provenance.runCompletedAt) < Date.parse(provenance.runStartedAt)) {
    throw new Error('case provenance completion predates start')
  }
  assertSafeCi(provenance.ci)
  if (
    provenance.ci !== null
    && provenance.ci.commit !== null
    && provenance.ci.commit !== runnerGit.sourceGitCommit
  ) {
    throw new Error('case provenance CI commit differs from runner Git commit')
  }
}

export interface RunProvenanceInput {
  readonly config: MatrixConfig
  readonly configFileSha256: string
  readonly fixtureSha256: string
  readonly runnerGit: CleanRunnerGitProvenance
  readonly runnerArtifacts: RunnerArtifactProvenance
  readonly lockMode: 'resolve' | 'frozen'
  readonly platformKey?: string
  readonly runStartedAt: string
  readonly runCompletedAt: string
  readonly env: NodeJS.ProcessEnv
}

export function createRunProvenance(input: RunProvenanceInput): RunProvenance {
  const provenance: RunProvenance = {
    schemaVersion: '1',
    configSha256: hashMatrixConfig(input.config),
    configFileSha256: input.configFileSha256,
    fixtureSha256: input.fixtureSha256,
    runnerGit: input.runnerGit,
    runnerArtifacts: input.runnerArtifacts,
    lockMode: input.lockMode,
    platformKey: input.platformKey ?? null,
    runStartedAt: input.runStartedAt,
    runCompletedAt: input.runCompletedAt,
    ci: collectSafeCiMetadata(input.env),
  }
  assertRunProvenance(provenance, input.config)
  return provenance
}
