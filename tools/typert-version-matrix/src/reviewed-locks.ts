import { createHash } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { isCanonicalSha512Integrity } from './integrity.js'
import { validatePackageLock } from './lockfile.js'
import { INSTALLED_PACKAGE_NAMES, type MatrixCase, type MatrixConfig } from './types.js'

const SHA256 = /^[a-f0-9]{64}$/u
const SAFE_TOKEN = /^[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?$/u
const REGISTRY_ORIGIN = 'https://registry.npmjs.org/'
const START = '<!-- reviewed-lock-manifest:start -->\n```json\n'
const END = '\n```\n<!-- reviewed-lock-manifest:end -->'

export const REVIEWED_LOCK_SET_CASE_COUNT = 8
const REVIEWED_MATRIX_CONFIG_FILES = [
  'matrix.official.json',
  'matrix.official-experimental.json',
] as const

const DIRECT_PACKAGE_NAMES = [
  ...INSTALLED_PACKAGE_NAMES,
  'typescript',
  'tsdown',
  'zod',
] as const

type DirectPackageName = typeof DIRECT_PACKAGE_NAMES[number]

interface ManifestPackage {
  readonly version: string
  readonly resolved: string
  readonly integrity: string
}

interface ManifestCase {
  readonly id: string
  readonly matrixConfig: string
  readonly lockFile: string
  readonly lockSha256: string
  readonly installedGraphSha256: string
  readonly sourceRunId: string
  readonly directPackages: Readonly<Record<DirectPackageName, ManifestPackage>>
}

interface ReviewedLockManifest {
  readonly schemaVersion: '1'
  readonly platformKey: string
  readonly platform: string
  readonly arch: string
  readonly node: string
  readonly npmCli: string
  readonly registry: typeof REGISTRY_ORIGIN
  readonly cases: readonly ManifestCase[]
}

export interface ReviewedCaseHashes {
  readonly lockSha256: string
  readonly installedGraphSha256: string
}

export interface VerifiedReviewedLockSet {
  readonly platformKey: string
  readonly caseCount: number
  readonly manifestSha256: string
  readonly cases: Readonly<Record<string, ReviewedCaseHashes>>
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} keys must equal ${expected.join(', ')}`)
  }
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new Error(`${label} must be a string`)
  return value
}

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

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

function expectedDirect(matrixCase: MatrixCase, toolchain: MatrixConfig['toolchain']): Record<DirectPackageName, string> {
  return {
    ...matrixCase.packages,
    typescript: toolchain.typescript,
    tsdown: toolchain.tsdown,
    zod: toolchain.zod,
  }
}

function parsePackage(value: unknown, label: string): ManifestPackage {
  const item = object(value, label)
  exactKeys(item, ['version', 'resolved', 'integrity'], label)
  const version = requiredString(item.version, `${label}.version`)
  const resolved = requiredString(item.resolved, `${label}.resolved`)
  const integrity = requiredString(item.integrity, `${label}.integrity`)
  if (!resolved.startsWith(REGISTRY_ORIGIN)) throw new Error(`${label} resolved origin is not public npm`)
  if (!isCanonicalSha512Integrity(integrity)) throw new Error(`${label} integrity is invalid`)
  return { version, resolved, integrity }
}

function parseManifestCase(value: unknown): ManifestCase {
  const item = object(value, 'reviewed lock manifest case')
  exactKeys(item, [
    'id', 'matrixConfig', 'lockFile', 'lockSha256', 'installedGraphSha256',
    'sourceRunId', 'directPackages',
  ], 'reviewed lock manifest case')
  const id = requiredString(item.id, 'manifest case id')
  const matrixConfig = requiredString(item.matrixConfig, `manifest ${id} matrix config`)
  const lockFile = requiredString(item.lockFile, `manifest ${id} lock file`)
  const lockSha256 = requiredString(item.lockSha256, `manifest ${id} lock SHA-256`)
  const installedGraphSha256 = requiredString(
    item.installedGraphSha256,
    `manifest ${id} installed graph SHA-256`,
  )
  const sourceRunId = requiredString(item.sourceRunId, `manifest ${id} source run`)
  if (!SAFE_TOKEN.test(id) || !SAFE_TOKEN.test(sourceRunId)) throw new Error(`manifest ${id} has an unsafe token`)
  if (lockFile !== `${id}.package-lock.json`) throw new Error(`manifest ${id} lock file name is not canonical`)
  if (!SHA256.test(lockSha256)) throw new Error(`manifest ${id} lock SHA-256 is invalid`)
  if (!SHA256.test(installedGraphSha256)) throw new Error(`manifest ${id} installed graph SHA-256 is invalid`)
  if (!/^matrix\.[a-z0-9.-]+\.json$/u.test(matrixConfig)) {
    throw new Error(`manifest ${id} matrix config name is invalid`)
  }
  const packagesInput = object(item.directPackages, `manifest ${id} direct packages`)
  exactKeys(packagesInput, DIRECT_PACKAGE_NAMES, `manifest ${id} direct packages`)
  const directPackages = Object.fromEntries(DIRECT_PACKAGE_NAMES.map((name) => [
    name,
    parsePackage(packagesInput[name], `manifest ${id} direct package ${name}`),
  ])) as Record<DirectPackageName, ManifestPackage>
  return {
    id, matrixConfig, lockFile, lockSha256, installedGraphSha256, sourceRunId, directPackages,
  }
}

export function parseReviewedLockManifest(readme: string): ReviewedLockManifest {
  const start = readme.indexOf(START)
  const end = readme.indexOf(END, start + START.length)
  if (start < 0 || end < 0 || readme.indexOf(START, start + START.length) >= 0) {
    throw new Error('README must contain exactly one reviewed lock manifest block')
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(readme.slice(start + START.length, end))
  } catch {
    throw new Error('README reviewed lock manifest is not valid JSON')
  }
  const value = object(parsed, 'reviewed lock manifest')
  exactKeys(value, [
    'schemaVersion', 'platformKey', 'platform', 'arch', 'node', 'npmCli', 'registry', 'cases',
  ], 'reviewed lock manifest')
  if (value.schemaVersion !== '1') throw new Error('reviewed lock manifest schemaVersion must equal 1')
  const platformKey = requiredString(value.platformKey, 'manifest platform key')
  const platform = requiredString(value.platform, 'manifest platform')
  const arch = requiredString(value.arch, 'manifest architecture')
  const node = requiredString(value.node, 'manifest Node version')
  const npmCli = requiredString(value.npmCli, 'manifest npm CLI version')
  if (value.registry !== REGISTRY_ORIGIN) throw new Error('manifest registry must be public npm')
  if (!Array.isArray(value.cases)) throw new Error('manifest cases must be an array')
  const cases = value.cases.map(parseManifestCase)
  if (new Set(cases.map(({ id }) => id)).size !== cases.length) {
    throw new Error('reviewed lock manifest has duplicate case ids')
  }
  return {
    schemaVersion: '1', platformKey, platform, arch, node, npmCli,
    registry: REGISTRY_ORIGIN, cases,
  }
}

function verifyTable(readme: string, manifest: ReviewedLockManifest): void {
  const rows = readme.split('\n').filter((line) => /^\| `typert-/u.test(line))
  const expected = manifest.cases.map((item) => (
    `| \`${item.id}\` | \`${item.matrixConfig}\` | \`${item.lockSha256}\` | \`${item.installedGraphSha256}\` | \`${item.sourceRunId}\` |`
  ))
  if (JSON.stringify(rows) !== JSON.stringify(expected)) {
    throw new Error('README reviewed lock table does not match its embedded manifest')
  }
}

function assertRoot(lock: Record<string, unknown>, expected: Record<DirectPackageName, string>): Record<string, unknown> {
  exactKeys(lock, ['name', 'version', 'lockfileVersion', 'requires', 'packages'], 'package lock root document')
  if (
    lock.name !== '@knight/dsh-typert-matrix-root'
    || lock.version !== '0.0.0'
    || lock.lockfileVersion !== 3
    || lock.requires !== true
  ) throw new Error('package lock root document identity drifted')
  const packages = object(lock.packages, 'package lock packages')
  const root = object(packages[''], 'package lock root package')
  const expectedRoot = {
    name: '@knight/dsh-typert-matrix-root',
    version: '0.0.0',
    license: 'UNLICENSED',
    workspaces: ['packages/*'],
    devDependencies: expected,
  }
  if (stable(root) !== stable(expectedRoot)) throw new Error('package lock root package drifted')
  return packages
}

function verifyAllPackageOrigins(packages: Record<string, unknown>, caseId: string): void {
  for (const [location, raw] of Object.entries(packages)) {
    if (!location.startsWith('node_modules/')) continue
    const item = object(raw, `${caseId} package ${location}`)
    if (item.link === true) {
      if (location !== 'node_modules/@knight/dsh-typert-matrix-probe') {
        throw new Error(`${caseId} has an unexpected lock graph link`)
      }
      continue
    }
    if (typeof item.version !== 'string' || item.version.length === 0) {
      throw new Error(`${caseId} package ${location} has no version`)
    }
    if (typeof item.resolved !== 'string' || !item.resolved.startsWith(REGISTRY_ORIGIN)) {
      throw new Error(`${caseId} package ${location} has an unapproved resolved origin`)
    }
    if (!isCanonicalSha512Integrity(item.integrity)) {
      throw new Error(`${caseId} package ${location} has invalid integrity`)
    }
  }
}

function verifyDirectAndCohort(
  packages: Record<string, unknown>,
  manifestCase: ManifestCase,
  matrixCase: MatrixCase,
  expected: Record<DirectPackageName, string>,
): void {
  for (const name of DIRECT_PACKAGE_NAMES) {
    const location = `node_modules/${name}`
    const item = object(packages[location], `${manifestCase.id} direct package ${name}`)
    const observed = {
      version: item.version,
      resolved: item.resolved,
      integrity: item.integrity,
    }
    if (stable(observed) !== stable(manifestCase.directPackages[name])) {
      throw new Error(`${manifestCase.id} direct package ${name} differs from README manifest`)
    }
    if (item.version !== expected[name]) {
      throw new Error(`${manifestCase.id} direct package ${name} version differs from config`)
    }
  }
  const expectedCohort = Object.keys(matrixCase.packages)
    .filter((name) => name.startsWith('@deepseek-ai/dsh'))
    .map((name) => `node_modules/${name}`)
    .sort()
  const actualCohort = Object.keys(packages)
    .filter((location) => location.startsWith('node_modules/@deepseek-ai/dsh'))
    .sort()
  if (JSON.stringify(actualCohort) !== JSON.stringify(expectedCohort)) {
    throw new Error(`${manifestCase.id} DSH cohort inventory drifted`)
  }
}

export async function verifyReviewedLockSet(input: {
  readonly platformDirectory: string
  readonly configs: readonly { readonly fileName: string; readonly config: MatrixConfig }[]
}): Promise<VerifiedReviewedLockSet> {
  if (stable(input.configs.map(({ fileName }) => fileName)) !== stable(REVIEWED_MATRIX_CONFIG_FILES)) {
    throw new Error('reviewed lock verification requires the closed selection and experimental configs')
  }
  const platformKey = path.basename(input.platformDirectory)
  const readme = await readFile(path.join(input.platformDirectory, 'README.md'), 'utf8')
  const manifest = parseReviewedLockManifest(readme)
  if (manifest.platformKey !== platformKey) throw new Error('README manifest platform key differs from directory')
  const platformMatch = platformKey.match(/^([a-z0-9]+)-([a-z0-9]+)-node([0-9]+)-npm([0-9]+)$/u)
  if (platformMatch === null) throw new Error('reviewed lock platform key is invalid')
  if (manifest.platform !== platformMatch[1] || manifest.arch !== platformMatch[2]) {
    throw new Error('README manifest platform identity differs from directory')
  }

  const expectedCases = new Map<string, {
    readonly matrixConfig: string
    readonly matrixCase: MatrixCase
    readonly config: MatrixConfig
  }>()
  for (const configEntry of input.configs) {
    for (const matrixCase of configEntry.config.cases) {
      if (expectedCases.has(matrixCase.id)) throw new Error(`config case ${matrixCase.id} is duplicated`)
      expectedCases.set(matrixCase.id, {
        matrixConfig: configEntry.fileName,
        matrixCase,
        config: configEntry.config,
      })
    }
  }
  const firstConfig = input.configs[0]?.config
  if (firstConfig === undefined) throw new Error('at least one matrix config is required')
  if (
    manifest.node !== firstConfig.runtime.node
    || manifest.npmCli !== firstConfig.runtime.npmCli
    || manifest.registry !== firstConfig.registry
    || Number(platformMatch[3]) !== Number(firstConfig.runtime.node.split('.')[0])
    || Number(platformMatch[4]) !== Number(firstConfig.runtime.npmCli.split('.')[0])
  ) throw new Error('README manifest runtime differs from reviewed configs or platform key')
  for (const { config } of expectedCases.values()) {
    if (stable(config.runtime) !== stable(firstConfig.runtime) || stable(config.toolchain) !== stable(firstConfig.toolchain)) {
      throw new Error('reviewed configs do not share one runtime and toolchain')
    }
  }

  if (
    expectedCases.size !== REVIEWED_LOCK_SET_CASE_COUNT
    || manifest.cases.length !== REVIEWED_LOCK_SET_CASE_COUNT
  ) throw new Error('README manifest case inventory is incomplete')
  for (const item of manifest.cases) {
    const expectedCase = expectedCases.get(item.id)
    if (expectedCase === undefined) throw new Error(`README manifest has an unexpected case ${item.id}`)
    if (item.matrixConfig !== expectedCase.matrixConfig) {
      throw new Error(`README manifest case ${item.id} refers to the wrong config`)
    }
  }
  verifyTable(readme, manifest)

  const expectedFiles = ['README.md', ...manifest.cases.map(({ lockFile }) => lockFile)].sort()
  const entries = await readdir(input.platformDirectory, { withFileTypes: true })
  const actualFiles = entries.map(({ name }) => name).sort()
  if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles) || entries.some((entry) => !entry.isFile() || entry.isSymbolicLink())) {
    throw new Error('reviewed lock platform directory inventory differs from README manifest')
  }

  for (const manifestCase of manifest.cases) {
    const expectedCase = expectedCases.get(manifestCase.id)!
    const raw = await readFile(path.join(input.platformDirectory, manifestCase.lockFile), 'utf8')
    if (sha256(raw) !== manifestCase.lockSha256) {
      throw new Error(`${manifestCase.id} lock SHA-256 differs from README manifest`)
    }
    validatePackageLock(raw, expectedCase.matrixCase, expectedCase.config.toolchain)
    const lock = object(JSON.parse(raw), `${manifestCase.id} package lock`)
    const expected = expectedDirect(expectedCase.matrixCase, expectedCase.config.toolchain)
    const packages = assertRoot(lock, expected)
    verifyAllPackageOrigins(packages, manifestCase.id)
    verifyDirectAndCohort(packages, manifestCase, expectedCase.matrixCase, expected)
  }
  const cases = Object.fromEntries(manifest.cases.map((item) => [
    item.id,
    Object.freeze({
      lockSha256: item.lockSha256,
      installedGraphSha256: item.installedGraphSha256,
    }),
  ]))
  return Object.freeze({
    platformKey,
    caseCount: manifest.cases.length,
    manifestSha256: sha256(stable(manifest)),
    cases: Object.freeze(cases),
  })
}
