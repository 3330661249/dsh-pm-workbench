import { createHash } from 'node:crypto'
import type { MatrixCase, MatrixConfig } from './types.js'

export class LockEvidenceError extends Error {
  readonly status = 'INCONCLUSIVE_LOCK' as const
  override name = 'LockEvidenceError'
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new LockEvidenceError(`${label} must be an object`)
  }
  return value as Record<string, unknown>
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

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function expectedDirect(
  matrixCase: MatrixCase,
  toolchain: MatrixConfig['toolchain'],
): Record<string, string> {
  return {
    ...matrixCase.packages,
    typescript: toolchain.typescript,
    tsdown: toolchain.tsdown,
    zod: toolchain.zod,
  }
}

export function validatePackageLock(
  rawText: string,
  matrixCase: MatrixCase,
  toolchain: MatrixConfig['toolchain'],
): { readonly lockSha256: string; readonly directVersions: Readonly<Record<string, string>> } {
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new LockEvidenceError('package lock is not valid JSON')
  }
  const lock = object(parsed, 'package lock')
  if (lock.lockfileVersion !== 3) throw new LockEvidenceError('package lock version must be 3')
  const packages = object(lock.packages, 'package lock packages')
  const root = object(packages[''], 'package lock root')
  const declared = object(root.devDependencies, 'package lock root devDependencies')
  const expected = expectedDirect(matrixCase, toolchain)
  for (const [name, version] of Object.entries(expected)) {
    if (declared[name] !== version) {
      throw new LockEvidenceError(`direct declaration version mismatch for ${name}`)
    }
    const entry = object(packages[`node_modules/${name}`], `installed lock entry ${name}`)
    if (entry.version !== version) throw new LockEvidenceError(`installed version mismatch for ${name}`)
    if (typeof entry.integrity !== 'string' || !entry.integrity.startsWith('sha512-')) {
      throw new LockEvidenceError(`missing integrity for ${name}`)
    }
    if (typeof entry.resolved !== 'string' || !entry.resolved.startsWith('https://registry.npmjs.org/')) {
      throw new LockEvidenceError(`unapproved resolved origin for ${name}`)
    }
  }

  const probe = object(packages['packages/probe'], 'probe workspace entry')
  if (probe.name !== '@knight/dsh-typert-matrix-probe' || probe.version !== '0.0.0') {
    throw new LockEvidenceError('probe workspace identity mismatch')
  }
  const link = object(
    packages['node_modules/@knight/dsh-typert-matrix-probe'],
    'workspace link',
  )
  if (link.link !== true || link.resolved !== 'packages/probe') {
    throw new LockEvidenceError('workspace link must resolve to packages/probe')
  }

  const cohort = matrixCase.release['@deepseek-ai/dsh']
  for (const [location, candidate] of Object.entries(packages)) {
    if (!location.startsWith('node_modules/@deepseek-ai/dsh')) continue
    const entry = object(candidate, `DSH graph entry ${location}`)
    if (entry.version !== cohort) {
      throw new LockEvidenceError(`mixed DSH cohort at ${location}`)
    }
  }
  return { lockSha256: sha256(rawText), directVersions: expected }
}

function findProblems(value: unknown, at = 'root'): string[] {
  if (typeof value !== 'object' || value === null) return []
  if (Array.isArray(value)) return value.flatMap((item, index) => findProblems(item, `${at}[${index}]`))
  const record = value as Record<string, unknown>
  const result: string[] = []
  if (Array.isArray(record.problems) && record.problems.length > 0) result.push(`${at}:problems`)
  for (const marker of ['missing', 'invalid', 'extraneous']) {
    if (record[marker] === true) result.push(`${at}:${marker}`)
  }
  for (const [key, nested] of Object.entries(record)) {
    if (key !== 'problems') result.push(...findProblems(nested, `${at}.${key}`))
  }
  return result
}

function graphVersion(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'object' && value !== null && typeof (value as { version?: unknown }).version === 'string') {
    return (value as { version: string }).version
  }
  return undefined
}

export function validateInstalledGraph(
  raw: unknown,
  matrixCase: MatrixCase,
  toolchain: MatrixConfig['toolchain'],
): { readonly installedGraphSha256: string } {
  const graph = object(raw, 'npm ls graph')
  const problems = findProblems(graph)
  if (problems.length > 0) throw new LockEvidenceError(`npm ls problems: ${problems.join(', ')}`)
  const dependencies = object(graph.dependencies, 'npm ls dependencies')
  for (const [name, version] of Object.entries(expectedDirect(matrixCase, toolchain))) {
    if (graphVersion(dependencies[name]) !== version) {
      throw new LockEvidenceError(`npm ls direct version mismatch for ${name}`)
    }
  }
  return { installedGraphSha256: sha256(stable(graph)) }
}
