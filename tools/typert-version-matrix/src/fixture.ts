import { createHash } from 'node:crypto'
import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'

export interface FixtureVerification {
  readonly fixture: 'strict-remote-v1'
  readonly files: readonly { readonly path: string; readonly sha256: string }[]
  readonly aggregateSha256: string
}

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex')
}

async function inventory(root: string, current = root): Promise<string[]> {
  const entries = await readdir(current, { withFileTypes: true })
  const result: string[] = []
  for (const entry of entries) {
    const absolute = path.join(current, entry.name)
    const info = await lstat(absolute)
    if (info.isSymbolicLink()) throw new Error(`fixture symlink is forbidden: ${entry.name}`)
    if (info.isDirectory()) result.push(...await inventory(root, absolute))
    else if (info.isFile()) result.push(path.relative(root, absolute).split(path.sep).join('/'))
    else throw new Error(`fixture contains a non-regular entry: ${entry.name}`)
  }
  return result.sort()
}

function manifestRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('fixture manifest must be an object')
  }
  return value as Record<string, unknown>
}

export async function verifyFixture(root: string): Promise<FixtureVerification> {
  const manifestPath = path.join(root, 'fixture.manifest.json')
  const manifest = manifestRecord(JSON.parse(await readFile(manifestPath, 'utf8')))
  if (manifest.schemaVersion !== '1' || manifest.fixture !== 'strict-remote-v1') {
    throw new Error('fixture manifest identity mismatch')
  }
  const declared = manifestRecord(manifest.files)
  const actual = (await inventory(root)).filter((entry) => entry !== 'fixture.manifest.json')
  const declaredPaths = Object.keys(declared).sort()
  if (JSON.stringify(actual) !== JSON.stringify(declaredPaths)) {
    throw new Error('fixture file inventory differs from manifest')
  }

  const files: Array<{ path: string; sha256: string }> = []
  for (const relative of declaredPaths) {
    if (
      path.isAbsolute(relative)
      || relative.split('/').includes('..')
      || !/^[a-f0-9]{64}$/.test(String(declared[relative]))
    ) throw new Error(`fixture manifest contains unsafe entry ${relative}`)
    const actualHash = sha256(await readFile(path.join(root, relative)))
    if (actualHash !== declared[relative]) {
      throw new Error(`fixture hash mismatch for ${relative}`)
    }
    files.push({ path: relative, sha256: actualHash })
  }
  const canonical = files.map((entry) => `${entry.path}\0${entry.sha256}\n`).join('')
  return {
    fixture: 'strict-remote-v1',
    files,
    aggregateSha256: sha256(canonical),
  }
}
