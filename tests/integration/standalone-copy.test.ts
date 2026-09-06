import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  access,
  chmod,
  cp,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  readlink,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(import.meta.dirname, '../..')
const sourceManifestRelative = 'tests/fixtures/standalone-source-manifest.json'

type SourceFileRecord = {
  readonly path: string
  readonly type: 'file'
  readonly mode: number
  readonly size: number
  readonly sha256: string
}

type SourceSnapshot = SourceFileRecord & { readonly bytes: Buffer }

type SourceTreeRecord =
  | SourceFileRecord
  | { readonly path: string; readonly type: 'directory' }

type DependencyRecord =
  | SourceFileRecord
  | { readonly path: string; readonly type: 'directory'; readonly mode: number }
  | { readonly path: string; readonly type: 'symlink'; readonly target: string; readonly logicalTarget: string }

class SafeRelocationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SafeRelocationError'
    this.stack = `${this.name}: ${message}`
  }
}

function sanitizeRelocationError(error: unknown, phase = 'verification'): SafeRelocationError {
  return error instanceof SafeRelocationError
    ? error
    : new SafeRelocationError(`standalone relocation failed during ${phase}`)
}

function sha256(bytes: string | Buffer): string {
  return createHash('sha256').update(bytes).digest('hex')
}

function portableRelative(root: string, target: string): string {
  const relative = path.relative(root, target)
  return relative ? relative.split(path.sep).join('/') : '.'
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
}

function assertSameInventory(
  expected: readonly (SourceTreeRecord | DependencyRecord)[],
  actual: readonly (SourceTreeRecord | DependencyRecord)[],
  label: string,
): void {
  if (expected.length !== actual.length || sha256(JSON.stringify(expected)) !== sha256(JSON.stringify(actual))) {
    throw new Error(`${label} inventory changed`)
  }
}

function assertManifestPath(relative: unknown): asserts relative is string {
  if (typeof relative !== 'string'
    || relative.length === 0
    || relative.includes('\\')
    || path.posix.isAbsolute(relative)
    || path.posix.normalize(relative) !== relative
    || relative === '.'
    || relative.startsWith('../')
    || relative.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')) {
    throw new Error('standalone source manifest contains an invalid relative path')
  }
  if (relative === 'node_modules'
    || relative.startsWith('node_modules/')
    || relative === '.tmp'
    || relative.startsWith('.tmp/')
    || relative === 'packages/workbench/lib'
    || relative.startsWith('packages/workbench/lib/')) {
    throw new Error('standalone source manifest contains generated or local state')
  }
}

async function loadSourceManifest(): Promise<readonly string[]> {
  const value: unknown = JSON.parse(await readFile(path.join(repositoryRoot, sourceManifestRelative), 'utf8'))
  if (typeof value !== 'object' || value === null || Array.isArray(value)
    || Object.keys(value).sort().join(',') !== 'files,schemaVersion') {
    throw new Error('standalone source manifest has an invalid schema')
  }
  const manifest = value as { schemaVersion?: unknown; files?: unknown }
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files)) {
    throw new Error('standalone source manifest has an invalid schema')
  }
  for (const relative of manifest.files) assertManifestPath(relative)
  const files = manifest.files as string[]
  const sorted = [...files].sort()
  if (files.length === 0
    || new Set(files).size !== files.length
    || files.some((relative, index) => relative !== sorted[index])
    || !files.includes(sourceManifestRelative)) {
    throw new Error('standalone source manifest must be non-empty, unique, sorted, and self-contained')
  }
  return files
}

async function snapshotManifestFiles(sourceRoot: string, files: readonly string[]): Promise<SourceSnapshot[]> {
  const root = await lstat(sourceRoot)
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error('manifest source root must be a real directory')
  const snapshots: SourceSnapshot[] = []

  for (const relative of files) {
    assertManifestPath(relative)
    const segments = relative.split('/')
    let ancestor = sourceRoot
    for (const segment of segments.slice(0, -1)) {
      ancestor = path.join(ancestor, segment)
      const stats = await lstat(ancestor)
      if (!stats.isDirectory() || stats.isSymbolicLink()) {
        throw new Error(`manifest source ancestor must be a real directory: ${relative}`)
      }
    }

    const absolute = path.join(sourceRoot, ...segments)
    const before = await lstat(absolute)
    if (!before.isFile() || before.isSymbolicLink()) {
      throw new Error(`manifest source must be a regular file: ${relative}`)
    }
    const bytes = await readFile(absolute)
    const after = await lstat(absolute)
    if (!after.isFile()
      || after.isSymbolicLink()
      || before.dev !== after.dev
      || before.ino !== after.ino
      || before.size !== after.size
      || after.size !== bytes.length) {
      throw new Error(`manifest source changed while it was read: ${relative}`)
    }
    snapshots.push({
      path: relative,
      type: 'file',
      mode: after.mode & 0o777,
      size: bytes.length,
      sha256: sha256(bytes),
      bytes,
    })
  }

  return snapshots
}

function sourceRecords(snapshots: readonly SourceSnapshot[]): SourceFileRecord[] {
  return snapshots.map(({ bytes: _bytes, ...record }) => record)
}

function expectedSourceTree(files: readonly SourceFileRecord[]): SourceTreeRecord[] {
  const records = new Map<string, SourceTreeRecord>([['.', { path: '.', type: 'directory' }]])
  for (const file of files) {
    let directory = path.posix.dirname(file.path)
    while (directory !== '.') {
      records.set(directory, { path: directory, type: 'directory' })
      directory = path.posix.dirname(directory)
    }
    records.set(file.path, file)
  }
  return [...records.values()].sort((left, right) => left.path.localeCompare(right.path))
}

async function inventorySourceTree(root: string): Promise<SourceTreeRecord[]> {
  const records: SourceTreeRecord[] = []

  async function visit(absolute: string): Promise<void> {
    const relative = portableRelative(root, absolute)
    const stats = await lstat(absolute)
    if (stats.isDirectory() && !stats.isSymbolicLink()) {
      records.push({ path: relative, type: 'directory' })
      for (const name of (await readdir(absolute)).sort()) await visit(path.join(absolute, name))
      return
    }
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`standalone destination contains a non-regular source entry: ${relative}`)
    }
    const bytes = await readFile(absolute)
    records.push({
      path: relative,
      type: 'file',
      mode: stats.mode & 0o777,
      size: bytes.length,
      sha256: sha256(bytes),
    })
  }

  await visit(root)
  return records.sort((left, right) => left.path.localeCompare(right.path))
}

async function copyManifestFiles(
  sourceRoot: string,
  destinationRoot: string,
  files: readonly string[],
): Promise<SourceFileRecord[]> {
  const snapshots = await snapshotManifestFiles(sourceRoot, files)
  const records = sourceRecords(snapshots)
  await mkdir(destinationRoot)
  for (const snapshot of snapshots) {
    const target = path.join(destinationRoot, ...snapshot.path.split('/'))
    await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, snapshot.bytes, { flag: 'wx', mode: snapshot.mode })
    await chmod(target, snapshot.mode)
  }
  assertSameInventory(expectedSourceTree(records), await inventorySourceTree(destinationRoot), 'standalone destination')
  return records
}

async function inventoryDependencyTree(nodeModulesRoot: string, workspaceRoot: string): Promise<DependencyRecord[]> {
  const records: DependencyRecord[] = []
  const physicalWorkspaceRoot = await realpath(workspaceRoot)

  async function visit(absolute: string): Promise<void> {
    const relative = portableRelative(nodeModulesRoot, absolute)
    const stats = await lstat(absolute)
    if (stats.isSymbolicLink()) {
      const target = await readlink(absolute)
      if (path.isAbsolute(target)) throw new Error(`dependency symlink must be relative: ${relative}`)
      const logicalTarget = path.resolve(path.dirname(absolute), target)
      if (!isWithin(workspaceRoot, logicalTarget)) {
        throw new Error(`dependency symlink must stay within the workspace: ${relative}`)
      }
      const physicalTarget = await realpath(absolute)
      if (!isWithin(physicalWorkspaceRoot, physicalTarget)) {
        throw new Error(`dependency symlink must stay within the workspace: ${relative}`)
      }
      records.push({
        path: relative,
        type: 'symlink',
        target,
        logicalTarget: portableRelative(workspaceRoot, logicalTarget),
      })
      return
    }
    if (stats.isDirectory()) {
      records.push({ path: relative, type: 'directory', mode: stats.mode & 0o777 })
      for (const name of (await readdir(absolute)).sort()) await visit(path.join(absolute, name))
      return
    }
    if (!stats.isFile()) throw new Error(`dependency tree contains a special entry: ${relative}`)
    const bytes = await readFile(absolute)
    const after = await lstat(absolute)
    if (!after.isFile()
      || after.isSymbolicLink()
      || stats.dev !== after.dev
      || stats.ino !== after.ino
      || stats.size !== after.size
      || after.size !== bytes.length) {
      throw new Error(`dependency entry changed while it was read: ${relative}`)
    }
    records.push({
      path: relative,
      type: 'file',
      mode: after.mode & 0o777,
      size: bytes.length,
      sha256: sha256(bytes),
    })
  }

  await visit(nodeModulesRoot)
  return records.sort((left, right) => left.path.localeCompare(right.path))
}

function containsForbiddenValue(value: string, forbiddenValues: readonly string[]): boolean {
  return forbiddenValues.some((forbidden) => forbidden.length > 0 && value.includes(forbidden))
}

function assertNoForbiddenValues(label: string, value: string | Buffer, forbiddenValues: readonly string[]): void {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(value)
  if (forbiddenValues.some((forbidden) => forbidden.length > 0 && bytes.includes(Buffer.from(forbidden)))) {
    throw new Error(`sensitive relocation value leaked in ${label}`)
  }
}

function makeChildEnvironment(
  sourceEnvironment: NodeJS.ProcessEnv,
  forbiddenValues: readonly string[],
  cloneRoot: string,
  isolationRoot: string,
  cloneCache: string,
  cloneNpmrc: string,
): NodeJS.ProcessEnv {
  const safePath = (sourceEnvironment.PATH ?? '')
    .split(path.delimiter)
    .filter((entry) => entry && !containsForbiddenValue(entry, forbiddenValues))
    .join(path.delimiter)
  if (!safePath) throw new Error('standalone child PATH allowlist is empty')
  return {
    PATH: safePath,
    HOME: path.join(isolationRoot, 'home'),
    TMPDIR: path.join(isolationRoot, 'runtime'),
    LANG: 'C',
    PWD: cloneRoot,
    WORKBENCH_STANDALONE_COPY_CHILD: '1',
    npm_config_cache: cloneCache,
    npm_config_userconfig: cloneNpmrc,
    npm_config_offline: 'true',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  }
}

async function scanTreeForForbiddenValues(root: string, forbiddenValues: readonly string[]): Promise<void> {
  async function visit(absolute: string): Promise<void> {
    const relative = portableRelative(root, absolute)
    if (containsForbiddenValue(relative, forbiddenValues)) {
      throw new Error('sensitive relocation value leaked in a relocated path')
    }
    const stats = await lstat(absolute)
    if (stats.isSymbolicLink()) {
      assertNoForbiddenValues(`symlink ${relative}`, await readlink(absolute), forbiddenValues)
      return
    }
    if (stats.isDirectory()) {
      for (const name of (await readdir(absolute)).sort()) await visit(path.join(absolute, name))
      return
    }
    if (!stats.isFile()) throw new Error(`relocated tree contains a special entry: ${relative}`)
    assertNoForbiddenValues(`file ${relative}`, await readFile(absolute), forbiddenValues)
  }

  await visit(root)
}

test('manifest copying rejects selected symlinks, non-file leaves, and symlinked ancestors', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-pm-manifest-source-'))
  const sourceRoot = path.join(fixtureRoot, 'source')
  const realDirectory = path.join(sourceRoot, 'real-directory')

  try {
    await mkdir(sourceRoot)
    await writeFile(path.join(sourceRoot, 'real.txt'), 'source\n')
    await symlink('real.txt', path.join(sourceRoot, 'selected.txt'))
    await mkdir(realDirectory)
    await writeFile(path.join(realDirectory, 'nested.txt'), 'nested\n')
    await symlink('real-directory', path.join(sourceRoot, 'linked-directory'))
    await expect(copyManifestFiles(sourceRoot, path.join(fixtureRoot, 'leaf-link'), ['selected.txt'])).rejects.toThrow(/regular file/u)
    await expect(copyManifestFiles(sourceRoot, path.join(fixtureRoot, 'directory-leaf'), ['real-directory'])).rejects.toThrow(/regular file/u)
    await expect(copyManifestFiles(sourceRoot, path.join(fixtureRoot, 'ancestor-link'), ['linked-directory/nested.txt'])).rejects.toThrow(/real directory/u)
    for (const destination of ['leaf-link', 'directory-leaf', 'ancestor-link']) {
      await expect(access(path.join(fixtureRoot, destination))).rejects.toThrow()
    }

    const exactRoot = path.join(fixtureRoot, 'exact')
    const copied = await copyManifestFiles(sourceRoot, exactRoot, ['real.txt'])
    await writeFile(path.join(exactRoot, 'unlisted.txt'), 'unlisted\n')
    const inventoryWithExtra = await inventorySourceTree(exactRoot)
    expect(() => assertSameInventory(expectedSourceTree(copied), inventoryWithExtra, 'test destination')).toThrow(/inventory changed/u)
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
})

test('dependency inventory rejects a relative symlink that escapes its workspace', async () => {
  const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-pm-dependency-link-'))
  const workspaceRoot = path.join(fixtureRoot, 'workspace')
  const nodeModulesRoot = path.join(workspaceRoot, 'node_modules')

  try {
    await mkdir(nodeModulesRoot, { recursive: true })
    await writeFile(path.join(fixtureRoot, 'outside.txt'), 'outside\n')
    await symlink('../../outside.txt', path.join(nodeModulesRoot, 'escape'))
    await expect(inventoryDependencyTree(nodeModulesRoot, workspaceRoot)).rejects.toThrow(/stay within the workspace/u)
  } finally {
    await rm(fixtureRoot, { recursive: true, force: true })
  }
})

test('relocated commands receive only an explicit environment allowlist', () => {
  const canary = sha256('standalone-environment-canary')
  const environment = makeChildEnvironment({
    PATH: `/usr/bin${path.delimiter}/bin`,
    NODE_OPTIONS: '--require=/tmp/injected.js',
    HTTP_PROXY: 'http://proxy.invalid',
    AUTH: canary,
  }, [canary], '/relocated', '/isolated', '/relocated/.tmp/cache', '/relocated/.tmp/npmrc')

  expect(Object.keys(environment).sort()).toEqual([
    'HOME',
    'LANG',
    'PATH',
    'PWD',
    'TMPDIR',
    'WORKBENCH_STANDALONE_COPY_CHILD',
    'npm_config_audit',
    'npm_config_cache',
    'npm_config_fund',
    'npm_config_offline',
    'npm_config_update_notifier',
    'npm_config_userconfig',
  ])
  assertNoForbiddenValues('test child environment', Object.values(environment).join('\0'), [canary])
})

test('safe relocation errors omit original values from both message and stack', () => {
  const canary = sha256('standalone-error-canary')
  const fixtureRoot = path.join(os.tmpdir(), 'standalone-sensitive-fixture')
  const forbiddenEnvironmentValue = 'forbidden-environment-value'
  const forbiddenValues = [repositoryRoot, fixtureRoot, canary, forbiddenEnvironmentValue]
  const unsafe = Object.assign(
    new Error(`${repositoryRoot}:${fixtureRoot}`),
    { stdout: canary, stderr: forbiddenEnvironmentValue },
  )
  const safe = sanitizeRelocationError(unsafe)
  assertNoForbiddenValues('safe error', `${safe.message}\n${safe.stack ?? ''}`, forbiddenValues)
})

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1')(
  'verifies a fixed source manifest and the current-platform dependency tree after arbitrary absolute-path relocation',
  async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-pm-standalone-'))
    const cloneRoot = path.join(fixtureRoot, 'renamed-repository')
    const sentinel = path.join(fixtureRoot, 'outside-copy-sentinel.txt')
    const cloneCache = path.join(cloneRoot, '.tmp', 'npm-cache')
    const cloneNpmrc = path.join(cloneRoot, '.tmp', 'npmrc')

    let forbiddenValues: readonly string[] = [repositoryRoot]
    let phase = 'initialization'
    try {
      const sourcePhysicalRoot = await realpath(repositoryRoot)
      const secretCanary = sha256(`${fixtureRoot}:${process.pid}:standalone-copy-canary`)
      forbiddenValues = [...new Set([repositoryRoot, sourcePhysicalRoot, secretCanary])]
      phase = 'source-copy'
      const manifestFiles = await loadSourceManifest()
      const sourceBefore = await copyManifestFiles(repositoryRoot, cloneRoot, manifestFiles)
      phase = 'dependency-copy'
      const dependenciesBefore = await inventoryDependencyTree(path.join(repositoryRoot, 'node_modules'), repositoryRoot)
      await writeFile(sentinel, 'must remain unchanged\n')
      await cp(path.join(repositoryRoot, 'node_modules'), path.join(cloneRoot, 'node_modules'), {
        recursive: true,
        force: false,
        errorOnExist: true,
        verbatimSymlinks: true,
      })
      const relocatedDependencies = await inventoryDependencyTree(path.join(cloneRoot, 'node_modules'), cloneRoot)
      assertSameInventory(dependenciesBefore, relocatedDependencies, 'relocated dependency')

      phase = 'environment-setup'
      await mkdir(path.dirname(cloneNpmrc), { recursive: true })
      await writeFile(cloneNpmrc, 'offline=true\naudit=false\nfund=false\nupdate-notifier=false\n')
      const sourceEnvironment = {
        ...process.env,
        STANDALONE_COPY_SECRET_CANARY: secretCanary,
      }
      const childEnv = makeChildEnvironment(sourceEnvironment, forbiddenValues, cloneRoot, fixtureRoot, cloneCache, cloneNpmrc)
      await Promise.all([
        mkdir(childEnv.HOME as string, { recursive: true }),
        mkdir(childEnv.TMPDIR as string, { recursive: true }),
      ])
      assertNoForbiddenValues('child environment', Object.values(childEnv).join('\0'), forbiddenValues)

      const runNpm = async (args: string[]) => {
        let result
        try {
          result = await execFileAsync('npm', args, {
            cwd: cloneRoot,
            env: childEnv,
            maxBuffer: 20 * 1024 * 1024,
          })
        } catch (error) {
          if (typeof error === 'object' && error !== null) {
            const output = error as { stdout?: unknown; stderr?: unknown }
            if (typeof output.stdout === 'string') assertNoForbiddenValues('failed command stdout', output.stdout, forbiddenValues)
            if (typeof output.stderr === 'string') assertNoForbiddenValues('failed command stderr', output.stderr, forbiddenValues)
          }
          throw new SafeRelocationError(`relocated npm command failed: ${args.join(' ')}`)
        }
        assertNoForbiddenValues('command stdout', result.stdout, forbiddenValues)
        assertNoForbiddenValues('command stderr', result.stderr, forbiddenValues)
        return result
      }

      await runNpm(['run', 'typecheck'])
      await runNpm(['test', '--', '--no-cache'])
      await runNpm(['run', 'build'])
      const verified = await runNpm(['run', 'verify:package'])
      await runNpm(['run', 'pack:dry'])

      phase = 'package-status-check'
      if (!verified.stdout.includes('"status": "verified"')) throw new Error('package verification did not report success')
      phase = 'generated-output-check'
      await expect(access(path.join(cloneRoot, 'packages', 'workbench', 'lib', 'index.js'))).resolves.toBeUndefined()
      await expect(access(path.join(cloneRoot, 'packages', 'workbench', 'lib', 'client.js'))).resolves.toBeUndefined()
      await expect(access(cloneCache)).resolves.toBeUndefined()

      phase = 'original-source-inventory-check'
      assertSameInventory(sourceBefore, sourceRecords(await snapshotManifestFiles(repositoryRoot, manifestFiles)), 'original source')
      phase = 'relocated-source-inventory-check'
      assertSameInventory(sourceBefore, sourceRecords(await snapshotManifestFiles(cloneRoot, manifestFiles)), 'relocated source')
      phase = 'original-dependency-inventory-check'
      assertSameInventory(dependenciesBefore, await inventoryDependencyTree(path.join(repositoryRoot, 'node_modules'), repositoryRoot), 'original dependency')
      phase = 'relocated-dependency-inventory-check'
      assertSameInventory(dependenciesBefore, await inventoryDependencyTree(path.join(cloneRoot, 'node_modules'), cloneRoot), 'relocated dependency')
      phase = 'leak-scan'
      await scanTreeForForbiddenValues(fixtureRoot, forbiddenValues)

      phase = 'containment-check'
      expect(await readFile(sentinel, 'utf8')).toBe('must remain unchanged\n')
      expect((await readdir(fixtureRoot)).sort()).toEqual(['home', 'outside-copy-sentinel.txt', 'renamed-repository', 'runtime'])
    } catch (error) {
      throw sanitizeRelocationError(error, phase)
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  },
  // The relocated child runs the complete suite before its build and package checks.
  600_000,
)
