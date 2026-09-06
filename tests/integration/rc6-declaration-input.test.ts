import { createHash } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { chmod, copyFile, link, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, symlink, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { tmpdir } from 'node:os'
import { execFile } from 'node:child_process'
import { createRequire } from 'node:module'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { describe, expect, test } from 'vitest'
import {
  withSynthetic169ConcurrentProductionPath,
  withSynthetic169BootstrapProductionPath,
  withSynthetic169LinkFaultProductionPath,
  withSynthetic169ProductionPath,
} from './helpers/rc6-169-production-path.js'

const workspaceRoot = resolve(import.meta.dirname, '../..')
const legacyBoundaryFixtureRelativePath =
  'tests/fixtures/rc6-legacy-production-boundary.json'

const acceptance = await import('../../scripts/accept-rc6-declaration-input.mjs')
const execFileAsync = promisify(execFile)
const require = createRequire(import.meta.url)

async function readJson(relativePath: string) {
  return JSON.parse(await readFile(resolve(workspaceRoot, relativePath), 'utf8'))
}

type LegacyBoundaryFixture = {
  schemaVersion: 1
  sourceCommit: string
  files: Array<{ path: string; sha256: string; bytesBase64: string }>
}

async function readLegacyBoundaryFixture(): Promise<LegacyBoundaryFixture> {
  const fixture = await readJson(legacyBoundaryFixtureRelativePath) as LegacyBoundaryFixture
  expect(Object.keys(fixture).sort()).toEqual(['files', 'schemaVersion', 'sourceCommit'])
  expect(fixture.schemaVersion).toBe(1)
  expect(fixture.sourceCommit).toBe('7044c6d3a342954fce9469473421b27b1ce91575')
  expect(fixture.files).toHaveLength(33)

  const expectedFiles = acceptance.expectedProductionBoundary.files as Array<{
    path: string
    sha256: string
  }>
  expect(fixture.files.map(({ path, sha256 }) => ({ path, sha256 }))).toEqual(expectedFiles)
  expect(new Set(fixture.files.map(({ path }) => path)).size).toBe(fixture.files.length)

  for (const file of fixture.files) {
    expect(Object.keys(file).sort()).toEqual(['bytesBase64', 'path', 'sha256'])
    expect(file.path.startsWith('/')).toBe(false)
    expect(file.path.includes('\\')).toBe(false)
    expect(file.path.split('/')).not.toContain('..')
    const bytes = Buffer.from(file.bytesBase64, 'base64')
    expect(bytes.toString('base64')).toBe(file.bytesBase64)
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.sha256)
  }

  return fixture
}

async function withProposalReceiptBuilderForTest<T>(
  inspect: (buildReceipt: (options: Record<string, unknown>) => Record<string, unknown>) => T | Promise<T>,
): Promise<T> {
  const root = await mkdtemp(resolve(tmpdir(), 'rc6-proposal-receipt-'))
  const script = resolve(root, 'accept-rc6-declaration-input.mjs')
  const source = await readFile(
    resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'),
    'utf8',
  )
  await writeFile(
    script,
    `${source}\nexport { expectedProposalReceipt as __testExpectedProposalReceipt }\n`,
    'utf8',
  )
  try {
    const imported = await import(`${pathToFileURL(script).href}?receipt-test=${Date.now()}`)
    return await inspect(imported.__testExpectedProposalReceipt)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function withCompilerEvidenceHelpersForTest<T>(
  inspect: (helpers: {
    isStorageDeclarationRelativePath: (relativePath: string) => boolean
  }) => T | Promise<T>,
): Promise<T> {
  const root = await mkdtemp(resolve(tmpdir(), 'rc6-compiler-evidence-'))
  const script = resolve(root, 'accept-rc6-declaration-input.mjs')
  const source = await readFile(
    resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'),
    'utf8',
  )
  await writeFile(
    script,
    `${source}\nexport { isStorageDeclarationRelativePath as __testIsStorageDeclarationRelativePath }\n`,
    'utf8',
  )
  try {
    const imported = await import(`${pathToFileURL(script).href}?compiler-evidence-test=${Date.now()}`)
    return await inspect({
      isStorageDeclarationRelativePath: imported.__testIsStorageDeclarationRelativePath,
    })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

const hostContractRelativePath =
  'tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts'
const clientContractRelativePath =
  'tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts'

function compileResultsFixture(): Record<string, unknown> {
  return {
    host: {
      surface: 'host',
      contractRelativePath: hostContractRelativePath,
      relativeFileCount: 11,
      relativeFileListSha256: '6'.repeat(64),
      realpathsWithinReplayRoot: true,
      contractListed: true,
      storageDeclarationFilesListed: false,
    },
    client: {
      surface: 'client',
      contractRelativePath: clientContractRelativePath,
      relativeFileCount: 13,
      relativeFileListSha256: '7'.repeat(64),
      realpathsWithinReplayRoot: true,
      contractListed: true,
      storageDeclarationFilesListed: false,
    },
  }
}

function proposalEvidenceFixture(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const compileResults = compileResultsFixture()
  return {
    acceptanceSourceSha256: '1'.repeat(64),
    verifierSourceSha256: '2'.repeat(64),
    compilerSourceAggregateSha256: '3'.repeat(64),
    compilerSealedAggregateSha256: '4'.repeat(64),
    verifierResultSha256: '5'.repeat(64),
    compileResults,
    compilerResultSha256: createHash('sha256')
      .update(acceptance.canonicalJsonBytes(compileResults))
      .digest('hex'),
    ...overrides,
  }
}

async function withRuntimeIdentityForTest<T>(
  inspect: (
    readRuntimeIdentity: (nodePath: string, npmCliPath: string) => Promise<Record<string, unknown>>,
  ) => T | Promise<T>,
  { expectedNpmCliSha256 }: { expectedNpmCliSha256?: string } = {},
): Promise<T> {
  const root = await mkdtemp(resolve(tmpdir(), 'rc6-runtime-identity-'))
  const script = resolve(root, 'accept-rc6-declaration-input.mjs')
  let source = await readFile(
    resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'),
    'utf8',
  )
  if (expectedNpmCliSha256) {
    if (!/^[a-f0-9]{64}$/.test(expectedNpmCliSha256)) {
      throw new Error('test npm CLI hash must be a SHA-256')
    }
    const expected = '8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7'
    if (source.split(expected).length !== 2) {
      throw new Error('production npm CLI hash fixture is not unique')
    }
    source = source.replace(expected, expectedNpmCliSha256)
  }
  await writeFile(
    script,
    `${source}\nexport { readRuntimeIdentity as __testReadRuntimeIdentity }\n`,
    'utf8',
  )
  try {
    const imported = await import(`${pathToFileURL(script).href}?runtime-test=${Date.now()}`)
    return await inspect(imported.__testReadRuntimeIdentity)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

function makeSyntheticV2Input({
  currentInput,
  packageJson: _packageJson,
  packageLock,
}: {
  currentInput: Record<string, unknown>
  packageJson?: Record<string, unknown>
  packageLock: Record<string, unknown>
}): any {
  const projection = acceptance.deriveCanonicalLockInput({
    name: 'dsh-rc6-prune-lock-probe',
    version: '0.0.0',
    private: true,
    type: 'module',
    devDependencies: (currentInput.acceptedRootPackage as any).devDependencies,
  }, packageLock)
  const selectedEntries = (currentInput.selectedCache as any).entries.map((entry: any) => {
    const { indexChecksum: _legacyPhysicalIndexChecksum, ...logicalEntry } = entry
    return logicalEntry
  })
  const selectedHashes = acceptance.computeSelectedCacheHashes(selectedEntries)
  return {
    schemaVersion: '2',
    inputLabel: currentInput.inputLabel,
    authorizationBasis: currentInput.authorizationBasis,
    packageJsonSha256: currentInput.packageJsonSha256,
    packageLockSha256: currentInput.packageLockSha256,
    lockfileVersion: 3,
    acceptedRootPackage: {
      ...(currentInput.acceptedRootPackage as Record<string, unknown>),
      private: true,
    },
    packageCounts: currentInput.packageCounts,
    dshVersion: currentInput.dshVersion,
    nestedCommander: currentInput.nestedCommander,
    selectedCache: { entries: selectedEntries, totalBytes: (currentInput.selectedCache as any).totalBytes },
    ...selectedHashes,
    proposalStage: {
      command: 'stageRc6DeclarationInputV2({ workspaceRoot })',
      result: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
    },
    runtime: currentInput.runtime,
    compilerToolchain: acceptance.expectedCompilerToolchain,
    productionBoundary: acceptance.expectedProductionBoundary,
    lockProjectionSha256: projection.sha256,
  }
}

async function createBoundaryFixture() {
  const fixture = await readLegacyBoundaryFixture()
  const root = await mkdtemp(resolve(tmpdir(), 'rc6-boundary-'))
  try {
    for (const file of fixture.files) {
      const destination = resolve(root, file.path)
      await mkdir(dirname(destination), { recursive: true, mode: 0o700 })
      const handle = await open(
        destination,
        fsConstants.O_CREAT
          | fsConstants.O_EXCL
          | fsConstants.O_WRONLY
          | fsConstants.O_NOFOLLOW,
        0o600,
      )
      try {
        await handle.writeFile(Buffer.from(file.bytesBase64, 'base64'))
        const stats = await handle.stat()
        if (!stats.isFile() || stats.nlink !== 1) {
          throw new Error(`legacy boundary fixture destination is unsafe: ${file.path}`)
        }
        await handle.chmod(0o644)
      } finally {
        await handle.close()
      }
    }
    return root
  } catch (error) {
    await rm(root, { recursive: true, force: true })
    throw error
  }
}

async function createInspectorFixture() {
  const root = await createBoundaryFixture()
  for (const relativePath of [
    'tools/harness-rc6-declarations/package.json',
    'tools/harness-rc6-declarations/package-lock.json',
  ]) {
    const destination = resolve(root, relativePath)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(resolve(workspaceRoot, relativePath), destination)
  }
  const [currentInput, packageJson, packageLock] = await Promise.all([
    readJson('tools/harness-rc6-declarations/input-manifest.json'),
    readJson('tools/harness-rc6-declarations/package.json'),
    readJson('tools/harness-rc6-declarations/package-lock.json'),
  ])
  await mkdir(resolve(root, 'tools/harness-rc6-declarations'), { recursive: true })
  const v2Input = makeSyntheticV2Input({ currentInput, packageLock, packageJson })
  await writeFile(
    resolve(root, 'tools/harness-rc6-declarations/input-manifest.json'),
    `${acceptance.canonicalJsonBytes(v2Input)}\n`,
    'utf8',
  )
  return root
}

async function createBootstrapFixture() {
  const root = await createBoundaryFixture()
  for (const relativePath of [
    'tools/harness-rc6-declarations/package.json',
    'tools/harness-rc6-declarations/package-lock.json',
    'tools/harness-rc6-declarations/input-manifest.json',
    'research/2026-09-05-rc6-declaration-closure.json',
  ]) {
    const destination = resolve(root, relativePath)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(resolve(workspaceRoot, relativePath), destination)
  }
  return root
}

async function createAcceptanceCliFixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'rc6-retired-acceptance-cli-'))
  const script = resolve(root, 'scripts/accept-rc6-declaration-input.mjs')
  await mkdir(dirname(script), { recursive: true })
  await copyFile(resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'), script)
  return root
}

async function runFixtureCli(root: string, argv: string[] = []) {
  const script = resolve(root, 'scripts/accept-rc6-declaration-input.mjs')
  return execFileAsync(process.execPath, [script, ...argv], { cwd: root })
}

async function fixtureFingerprint(root: string) {
  const rows: string[] = []
  async function visit(current: string) {
    const entries = await readdir(current, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = resolve(current, entry.name)
      const relativePath = path.slice(root.length + 1)
      if (entry.isDirectory()) {
        rows.push(`directory:${relativePath}`)
        await visit(path)
      } else if (entry.isFile()) {
        rows.push(`file:${relativePath}:${createHash('sha256').update(await readFile(path)).digest('hex')}`)
      } else {
        rows.push(`other:${relativePath}`)
      }
    }
  }
  await visit(root)
  return createHash('sha256').update(rows.join('\n')).digest('hex')
}

async function writeSyntheticCandidate(root: string, {
  sourceCacheRoot,
  npmCliPath,
}: {
  sourceCacheRoot: string
  npmCliPath: string
}) {
  const candidateRoot = resolve(root, '.tmp/dsh-pm-workbench/declaration-input-candidate')
  await mkdir(candidateRoot, { recursive: true })
  await writeFile(resolve(candidateRoot, 'candidate.json'), `${JSON.stringify({
    schemaVersion: '1',
    label: 'local-2026-09-05-rc6-declaration-lock-v1',
    authorizationBasis: 'owner-continued-after-explicit-offline-rc6-preflight-update',
    sourceCacheRoot,
    npmCliPath,
    expected: {
      registryPackageCount: 169,
      deepseekPackageCount: 59,
      dshPackageCount: 54,
      dshVersion: '0.1.0-rc.6',
      selectedContentBytes: 9_590_214,
    },
  })}\n`, 'utf8')
  await Promise.all([
    copyFile(resolve(workspaceRoot, 'tools/harness-rc6-declarations/package.json'), resolve(candidateRoot, 'package.json')),
    copyFile(resolve(workspaceRoot, 'tools/harness-rc6-declarations/package-lock.json'), resolve(candidateRoot, 'package-lock.json')),
  ])
}

function cacheIndexPathForTest(cacheRoot: string, key: string) {
  const digest = createHash('sha256').update(key).digest('hex')
  return resolve(cacheRoot, 'index-v5', digest.slice(0, 2), digest.slice(2, 4), digest.slice(4))
}

function contentPathForTest(cacheRoot: string, integrity: string) {
  const hex = Buffer.from(integrity.slice('sha512-'.length), 'base64').toString('hex')
  return resolve(cacheRoot, 'content-v2/sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4))
}

function appendIndexLine(record: unknown, checksum?: string) {
  const json = JSON.stringify(record)
  return `${checksum ?? createHash('sha1').update(json).digest('hex')}\t${json}`
}

function npmShapedIndexRecord({ key, integrity, size, url }: {
  key: string
  integrity: string
  size: number
  url: string
}) {
  return {
    key,
    integrity,
    time: 1_725_000_000_000,
    size,
    metadata: {
      time: 1_725_000_000_000,
      url,
      reqHeaders: {
        accept: 'application/octet-stream',
        'accept-encoding': 'gzip,deflate',
      },
      resHeaders: {
        'cache-control': 'public, max-age=300',
        'content-type': 'application/octet-stream',
      },
      options: { compress: true },
    },
  }
}

function appendIndexLineWithExactBytes(record: any, targetBytes: number) {
  const changed = structuredClone(record)
  changed.metadata.reqHeaders.accept = ''
  const emptyLength = Buffer.byteLength(appendIndexLine(changed), 'utf8')
  if (emptyLength > targetBytes) throw new Error('target line is smaller than the npm-shaped fixture')
  changed.metadata.reqHeaders.accept = 'x'.repeat(targetBytes - emptyLength)
  const line = appendIndexLine(changed)
  if (Buffer.byteLength(line, 'utf8') !== targetBytes) throw new Error('failed to build exact index line')
  return line
}

function appendLogWithExactBytes(selectedLine: string, targetBytes: number) {
  const selectedBytes = Buffer.byteLength(selectedLine, 'utf8')
  if (selectedBytes > targetBytes) throw new Error('selected line exceeds target append-log size')
  const remaining = targetBytes - selectedBytes
  if (remaining === 0) return selectedLine
  const maximumLineBytes = 1024 * 1024
  const fillerCount = Math.ceil(remaining / (maximumLineBytes + 1))
  const fillerBytes = remaining - fillerCount
  if (fillerBytes < 0 || fillerBytes > fillerCount * maximumLineBytes) {
    throw new Error('failed to distribute append-log filler')
  }
  const fillers: string[] = []
  let undistributed = fillerBytes
  for (let index = 0; index < fillerCount; index += 1) {
    const length = Math.min(maximumLineBytes, undistributed)
    fillers.push('x'.repeat(length))
    undistributed -= length
  }
  const raw = `${fillers.join('\n')}\n${selectedLine}`
  if (Buffer.byteLength(raw, 'utf8') !== targetBytes) throw new Error('failed to build exact append-log')
  return raw
}

async function chmodReadOnlyTree(path: string): Promise<void> {
  const entry = await lstat(path)
  if (entry.isDirectory()) {
    for (const name of await readdir(path)) await chmodReadOnlyTree(resolve(path, name))
    await chmod(path, 0o555)
  } else {
    await chmod(path, 0o444)
  }
}

async function chmodWritableTree(path: string): Promise<void> {
  const entry = await lstat(path)
  if (entry.isSymbolicLink()) return
  if (entry.isDirectory()) {
    await chmod(path, 0o755)
    for (const name of await readdir(path)) await chmodWritableTree(resolve(path, name))
  } else {
    await chmod(path, 0o644)
  }
}

async function makeTinyCache({ indexLines }: { indexLines?: string[] } = {}) {
  const cacheRoot = await mkdtemp(resolve(tmpdir(), 'rc6-b2a-cache-'))
  const bytes = Buffer.from('tiny selected content')
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  const resolved = 'https://registry.npmjs.org/tiny/-/tiny-1.0.0.tgz'
  const key = `make-fetch-happen:request-cache:${resolved}`
  const entry = {
    lockPath: 'node_modules/tiny',
    name: 'tiny',
    version: '1.0.0',
    integrity,
    key,
    contentDigest: integrity,
  }
  const indexRecord = npmShapedIndexRecord({ key, integrity, size: bytes.length, url: resolved })
  const indexPath = cacheIndexPathForTest(cacheRoot, key)
  const contentPath = contentPathForTest(cacheRoot, integrity)
  await mkdir(resolve(indexPath, '..'), { recursive: true })
  await mkdir(resolve(contentPath, '..'), { recursive: true })
  await writeFile(indexPath, `${(indexLines ?? [appendIndexLine(indexRecord)]).join('\n')}\n`, 'utf8')
  await writeFile(contentPath, bytes)
  await chmodReadOnlyTree(cacheRoot)
  return {
    cacheRoot,
    entry,
    indexRecord,
    indexPath,
    contentPath,
    lockModel: { entries: [entry], expected: { count: 1, totalBytes: bytes.length } },
  }
}

describe('rc.6 accepted declaration input', () => {
  test('serializes canonical JSON with UTF-8 key order independent of insertion order', () => {
    const left = { '2': 'two', '10': 'ten', a: 'ascii', é: 'utf8', list: [3, { b: true, a: null }] }
    const right = { list: [3, { a: null, b: true }], é: 'utf8', a: 'ascii', '10': 'ten', '2': 'two' }
    const expected = '{"10":"ten","2":"two","a":"ascii","list":[3,{"a":null,"b":true}],"é":"utf8"}'
    expect(acceptance.canonicalJsonBytes(left)).toBe(expected)
    expect(acceptance.canonicalJsonBytes(right)).toBe(expected)
    expect(acceptance.canonicalJsonBytes({ emoji: '😀' })).toBe('{"emoji":"😀"}')
  })

  test.each([
    ['lone surrogate value', String.fromCharCode(0xd800)],
    ['lone surrogate key', { [String.fromCharCode(0xd800)]: true }],
    ['negative zero', -0],
    ['infinity', Infinity],
    ['parsed exponent infinity', JSON.parse('1e400')],
    ['unsafe integer', Number.MAX_SAFE_INTEGER + 1],
    ['undefined', undefined],
    ['function', () => {}],
    ['symbol', Symbol('forged')],
    ['bigint', 1n],
    ['sparse array', new Array(1)],
    ['non-plain object', new Date()],
  ])('rejects non-canonical JSON input: %s', (_label, value) => {
    expect(() => acceptance.canonicalJsonBytes(value)).toThrow('INVALID_CANONICAL_JSON')
  })

  test('rejects cycles without rejecting shared acyclic references', () => {
    const shared = { stable: true }
    expect(acceptance.canonicalJsonBytes({ first: shared, second: shared })).toBe('{"first":{"stable":true},"second":{"stable":true}}')
    const direct: any = {}; direct.self = direct
    const nested: any = { child: {} }; nested.child.parent = nested
    expect(() => acceptance.canonicalJsonBytes(direct)).toThrow('INVALID_CANONICAL_JSON')
    expect(() => acceptance.canonicalJsonBytes(nested)).toThrow('INVALID_CANONICAL_JSON')
  })

  test.each([
    ['symbol object key', (() => { const value: any = {}; value[Symbol('x')] = true; return value })()],
    ['non-enumerable object property', (() => { const value: any = {}; Object.defineProperty(value, 'hidden', { value: true }); return value })()],
    ['accessor object property', (() => { const value: any = {}; Object.defineProperty(value, 'computed', { enumerable: true, get: () => true }); return value })()],
    ['array extra property', (() => { const value: any = [1]; value.extra = true; return value })()],
    ['array symbol property', (() => { const value: any = [1]; value[Symbol('x')] = true; return value })()],
    ['array accessor index', (() => { const value: any[] = []; Object.defineProperty(value, '0', { enumerable: true, get: () => 1 }); value.length = 1; return value })()],
    ['array non-enumerable index', (() => { const value: any[] = []; Object.defineProperty(value, '0', { enumerable: false, value: 1 }); value.length = 1; return value })()],
    ['proxy', new Proxy({ stable: true }, {})],
  ])('rejects descriptor or proxy ambiguity: %s', (_label, value) => {
    expect(() => acceptance.canonicalJsonBytes(value)).toThrow('INVALID_CANONICAL_JSON')
  })

  test('never executes a getter while rejecting a stateful derive input', async () => {
    const [packageJson, packageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
    ])
    let reads = 0
    Object.defineProperty(packageJson, 'version', { enumerable: true, get: () => { reads += 1; return '0.0.0' } })
    expect(() => acceptance.deriveCanonicalLockInput(packageJson, packageLock)).toThrow('INVALID_CANONICAL_JSON')
    expect(reads).toBe(0)
  })

  test.each([
    ['hidden package field', (packageJson: any, _lock: any) => Object.defineProperty(packageJson, 'hidden', { value: true })],
    ['symbol package field', (packageJson: any, _lock: any) => { packageJson[Symbol('hidden')] = true }],
    ['hidden non-root lock field', (_packageJson: any, lock: any) => Object.defineProperty(lock.packages['node_modules/@deepseek-ai/cordis'], 'hidden', { value: true })],
  ])('rejects hidden parsed-input state: %s', async (_label, mutate) => {
    const [packageJson, packageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
    ])
    mutate(packageJson, packageLock)
    expect(() => acceptance.deriveCanonicalLockInput(packageJson, packageLock)).toThrow('INVALID_CANONICAL_JSON')
  })
  test('records historical v1 self-hash diagnostics without treating them as a clean-clone PASS', async () => {
    const audit = await acceptance.inspectCommittedDeclarationInput({ workspaceRoot })
    const input = audit.inputManifest
    const lock = audit.packageLock
    const packageJson = audit.packageJson
    const serializedInput = await readFile(
      resolve(
        workspaceRoot,
        'tools/harness-rc6-declarations/input-manifest.json',
      ),
      'utf8',
    )

    expect(audit.packageJsonSha256).toBe(input.packageJsonSha256)
    expect(audit.packageLockSha256).toBe(input.packageLockSha256)
    expect(audit.selectedCacheIndexSha256).toBe(input.selectedCacheIndexSha256)
    expect(audit.selectedContentAggregateSha256).toBe(
      input.selectedContentAggregateSha256,
    )
    expect(packageJson.devDependencies).toEqual({
      '@deepseek-ai/cordis': '4.0.1',
      '@deepseek-ai/dsh-client-connection': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-layout': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-sidebar': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-slots': '0.1.0-rc.6',
      '@deepseek-ai/dsh-invariants': '0.1.0-rc.6',
      react: '18.3.1',
    })
    expect(Object.keys(lock.packages)).toHaveLength(170)
    expect(input.packageCounts).toEqual({
      registry: 169,
      deepseek: 59,
      dsh: 54,
    })
    expect(input.selectedCache.entries).toHaveLength(169)
    expect(input.selectedCache.totalBytes).toBe(9_590_214)
    expect(input.nestedCommander).toEqual({
      lockPath: 'node_modules/katex/node_modules/commander',
      name: 'commander',
      parent: 'katex',
      version: '8.3.0',
    })
    expect(input.selectedCache.entries).toEqual(
      [...input.selectedCache.entries].sort((left, right) =>
        Buffer.from(left.lockPath, 'utf8').compare(Buffer.from(right.lockPath, 'utf8')),
      ),
    )
    expect(serializedInput).not.toContain('/Users/')
    expect(serializedInput).not.toContain('/private/')
    expect(serializedInput).not.toContain('file:')
  })

  test('makes the current v1 snapshot explicitly pending B2 instead of treating it as a v2 acceptance', async () => {
    const audit = await acceptance.inspectCommittedDeclarationInput({ workspaceRoot })

    expect(audit.status).toBe('CHANGES_REQUIRED_REVIEW')
    expect((audit as { reason?: string }).reason).toBe('INPUT_MANIFEST_V2_PENDING_B2')
  })

  test('inspects a clean v2 fixture only after byte and production-boundary validation', async () => {
    const root = await createInspectorFixture()
    try {
      const audit = await acceptance.inspectCommittedDeclarationInput({ workspaceRoot: root })
      expect(audit.status).toBe('PASS_STATIC_METADATA')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each([
    ['pretty JSON', (canonical: string) => `${JSON.stringify(JSON.parse(canonical), null, 2)}\n`],
    ['reordered JSON keys', (canonical: string) => {
      const value = JSON.parse(canonical)
      return `${JSON.stringify(Object.fromEntries(Object.entries(value).reverse()))}\n`
    }],
    ['extra trailing newline', (canonical: string) => `${canonical}\n\n`],
    ['duplicate schema key', (canonical: string) => canonical.replace('{', '{"schemaVersion":"2",')],
  ])('rejects a semantically valid noncanonical committed schema2 document: %s', async (_label, encode) => {
    const root = await createInspectorFixture()
    try {
      const path = resolve(root, 'tools/harness-rc6-declarations/input-manifest.json')
      const canonical = await readFile(path, 'utf8')
      await writeFile(path, encode(canonical), 'utf8')
      await expect(acceptance.inspectCommittedDeclarationInput({ workspaceRoot: root }))
        .rejects.toThrow('COMMITTED_INPUT_CANONICAL_MISMATCH')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each([
    ['raw package byte drift', async (root: string) => writeFile(resolve(root, 'tools/harness-rc6-declarations/package.json'), '\n', { encoding: 'utf8', flag: 'a' })],
    ['missing production tree', async (root: string) => rm(resolve(root, 'packages/workbench'), { recursive: true, force: true })],
    ['changed production source', async (root: string) => writeFile(resolve(root, 'packages/workbench/src/config.ts'), 'forged\n', 'utf8')],
  ])('rejects v2 inspection with %s', async (_label, mutate) => {
    const root = await createInspectorFixture()
    try {
      await mutate(root)
      await expect(acceptance.inspectCommittedDeclarationInput({ workspaceRoot: root })).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each(['unknown', undefined, 2, null])('fails closed for a %s input-manifest schema version', async (schemaVersion) => {
    const root = await createInspectorFixture()
    try {
      const path = resolve(root, 'tools/harness-rc6-declarations/input-manifest.json')
      const manifest = JSON.parse(await readFile(path, 'utf8'))
      if (schemaVersion === undefined) delete manifest.schemaVersion
      else manifest.schemaVersion = schemaVersion
      await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
      await expect(acceptance.inspectCommittedDeclarationInput({ workspaceRoot: root })).rejects.toThrow('UNSUPPORTED_INPUT_MANIFEST_SCHEMA')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('maps unknown internal errors to an explicit stable fallback', () => {
    const error = Object.assign(new Error('untrusted internal detail'), { code: 'NOT_ALLOWLISTED' })
    expect(acceptance.mapPublicInputError(error)).toEqual({
      status: 'FAIL_INPUT_INTERNAL',
      reasonCode: 'UNEXPECTED_INPUT_ERROR',
    })
  })

  test('maps every owned validation mismatch instead of relabeling it as an internal error', () => {
    const error = Object.assign(new Error('untrusted detail'), { code: 'PRODUCTION_BOUNDARY_SYMLINK' })
    expect(acceptance.mapPublicInputError(error)).toEqual({
      status: 'FAIL_INPUT_MISMATCH',
      reasonCode: 'PRODUCTION_BOUNDARY_SYMLINK',
    })
  })

  test.each(acceptance.dynamicOwnedInputErrorCodes)('maps dynamic owned code %s as an exact mismatch', (code) => {
    const error = Object.assign(new Error('untrusted detail'), { code })
    expect(acceptance.mapPublicInputError(error)).toEqual({
      status: 'FAIL_INPUT_MISMATCH',
      reasonCode: code,
    })
  })

  test('maps the retired acceptance writer code to exact input-policy JSON', () => {
    const error = Object.assign(new Error('untrusted detail'), { code: 'LEGACY_ACCEPT_DISABLED' })
    expect(acceptance.mapPublicInputError(error)).toEqual({
      status: 'FAIL_INPUT_POLICY',
      reasonCode: 'LEGACY_ACCEPT_DISABLED',
    })
  })

  test('keeps public code registries duplicate-free before converting them to sets', () => {
    const registries = [
      acceptance.dynamicOwnedInputErrorCodes,
      acceptance.publicInputSchemaCodes,
      acceptance.publicInputMismatchCodes,
      acceptance.publicInputOperationalCodes,
    ]
    for (const registry of registries) expect(new Set(registry).size).toBe(registry.length)
    const publicCodes = [
      ...acceptance.publicInputSchemaCodes,
      ...acceptance.publicInputMismatchCodes,
      ...acceptance.publicInputOperationalCodes,
    ]
    expect(new Set(publicCodes).size).toBe(publicCodes.length)
  })

  test.each([
    'BUNDLE_DIRECTORY_COLLISION',
    'BUNDLE_TARGET_WRITE_FAILED',
    'POINTER_SIZE_LIMIT',
    'POINTER_TEMP_WRITE_FAILED',
  ])('classifies local publication operation %s as internal rather than input mismatch', (code) => {
    expect(acceptance.publicInputMismatchCodes).not.toContain(code)
    expect(acceptance.publicInputOperationalCodes).toContain(code)
    expect(acceptance.mapPublicInputError(Object.assign(new Error('untrusted detail'), { code }))).toEqual({
      status: 'FAIL_INPUT_INTERNAL',
      reasonCode: code,
    })
  })

  test.each([
    'CACHE_SNAPSHOT_MISMATCH',
    'FINAL_SOURCE_ALREADY_EXISTS',
    'INVALID_CACHE_HEADERS',
    'INVALID_CACHE_INDEX_CHECKSUM',
    'INVALID_CACHE_INDEX_RECORD',
    'MISSING_CACHE_INDEX_METADATA',
    'NON_PUBLIC_REGISTRY_URL',
    'SENSITIVE_CACHE_HEADER',
    'STAGE_SOURCE_COPY_FAILED',
    'TEST_PREPARE_FAILURE',
  ])('does not publicly classify unreachable superseded code %s', (code) => {
    expect(acceptance.publicInputSchemaCodes).not.toContain(code)
    expect(acceptance.publicInputMismatchCodes).not.toContain(code)
    expect(acceptance.publicInputOperationalCodes).not.toContain(code)
    expect(acceptance.mapPublicInputError(Object.assign(new Error('untrusted detail'), { code }))).toEqual({
      status: 'FAIL_INPUT_INTERNAL',
      reasonCode: 'UNEXPECTED_INPUT_ERROR',
    })
  })

  test('does not retry loser cleanup after an adopted publication cleanup failure', async () => {
    const source = await readFile(resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'), 'utf8')
    const catchBoundary = source.match(/\} catch \(error\) \{\n    if \(!\[[\s\S]+?\n    throw error\n  \} finally \{/)
    expect(catchBoundary).not.toBeNull()
    expect(catchBoundary?.[0]).toContain("'ADOPTED_EXISTING'")
  })

  test('registers every literal and dynamic owned failure code for public classification', async () => {
    const source = await readFile(resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'), 'utf8')
    const literalCodes = [...source.matchAll(/fail\('([A-Z0-9_]+)'/g)].map((match) => match[1])
    const ownedCodes = [...new Set([...literalCodes, ...acceptance.dynamicOwnedInputErrorCodes])]
    for (const code of ownedCodes) {
      const result = acceptance.mapPublicInputError(Object.assign(new Error('untrusted detail'), { code }))
      expect(result.reasonCode).toBe(code)
      expect(['FAIL_INPUT_SCHEMA', 'FAIL_INPUT_MISMATCH', 'FAIL_INPUT_INTERNAL', 'FAIL_INPUT_POLICY']).toContain(result.status)
      if (acceptance.publicInputOperationalCodes.includes(code)) {
        expect(result.status).toBe('FAIL_INPUT_INTERNAL')
      } else if (code === 'LEGACY_ACCEPT_DISABLED') {
        expect(result.status).toBe('FAIL_INPUT_POLICY')
      }
    }
  })

  test.each(['missing', 'dangling'])('maps Node realpath %s through its supplied stable code', async (kind) => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-realpath-'))
    try {
      const absent = resolve(root, 'absent-node')
      const path = kind === 'dangling' ? resolve(root, 'dangling-node') : absent
      if (kind === 'dangling') await symlink(absent, path)
      await expect(acceptance.realpathWithStableMissingCode(path, 'INVALID_NODE_EXECUTABLE')).rejects.toMatchObject({ code: 'INVALID_NODE_EXECUTABLE' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects an unpinned npm CLI before any child process execution', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-unpinned-npm-cli-'))
    const fakeCli = resolve(root, 'npm-cli.js')
    const executionSentinel = resolve(root, 'executed')
    try {
      await writeFile(
        fakeCli,
        `import { writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(executionSentinel)}, 'executed')\nprocess.stdout.write('11.9.0\\n')\n`,
        { mode: 0o444 },
      )
      await withRuntimeIdentityForTest(async (readRuntimeIdentity) => {
        await expect(readRuntimeIdentity(process.execPath, fakeCli)).rejects.toMatchObject({
          code: 'INVALID_NPM_CLI',
        })
      })
      await expect(stat(executionSentinel)).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('rejects npm CLI identity drift after version execution', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-drifting-npm-cli-'))
    const fakeCli = resolve(root, 'npm-cli.js')
    const executionSentinel = resolve(root, 'executed')
    try {
      const fakeCliBytes = Buffer.from(
        `import { appendFileSync, chmodSync, writeFileSync } from 'node:fs'\nwriteFileSync(${JSON.stringify(executionSentinel)}, 'executed')\nchmodSync(process.argv[1], 0o600)\nappendFileSync(process.argv[1], '\\n// drifted after execution\\n')\nchmodSync(process.argv[1], 0o444)\nprocess.stdout.write('11.9.0\\n')\n`,
        'utf8',
      )
      const fakeCliSha256 = createHash('sha256').update(fakeCliBytes).digest('hex')
      await writeFile(fakeCli, fakeCliBytes, { mode: 0o444 })
      await withRuntimeIdentityForTest(async (readRuntimeIdentity) => {
        await expect(readRuntimeIdentity(process.execPath, fakeCli)).rejects.toMatchObject({
          code: 'INVALID_NPM_CLI',
        })
      }, { expectedNpmCliSha256: fakeCliSha256 })
      await expect(stat(executionSentinel)).resolves.toMatchObject({ size: 8 })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('keeps an absent target directory permitted for deferred acceptance setup', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-empty-target-'))
    const absent = resolve(root, 'absent')
    try {
      await expect(acceptance.assertDirectoryEmptyOrAbsent(absent)).resolves.toBeUndefined()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('turns missing and malformed cache source records into stable codes without acceptance', async () => {
    const cacheRoot = await mkdtemp(resolve(tmpdir(), 'rc6-cache-source-'))
    const bytes = Buffer.from('fixture')
    const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
    const resolved = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz'
    const key = `make-fetch-happen:request-cache:${resolved}`
    const digest = createHash('sha256').update(key).digest('hex')
    const indexPath = resolve(cacheRoot, 'index-v5', digest.slice(0, 2), digest.slice(2, 4), digest.slice(4))
    const record = { version: '1.0.0', integrity, resolved }
    const args = { cacheRoot, lockPath: 'node_modules/example', record }
    try {
      await expect(acceptance.readSelectedCacheRecord(args)).rejects.toMatchObject({ code: 'MISSING_CACHE_INDEX' })
      await mkdir(resolve(indexPath, '..'), { recursive: true })
      await writeFile(indexPath, 'checksum\t{\n', 'utf8')
      await expect(acceptance.readSelectedCacheRecord(args)).rejects.toMatchObject({ code: 'INVALID_CACHE_INDEX_JSON' })
      const indexRecord = { key, integrity, size: bytes.length, metadata: { url: resolved } }
      await writeFile(indexPath, `checksum\t${JSON.stringify(indexRecord)}\n`, 'utf8')
      await expect(acceptance.readSelectedCacheRecord(args)).rejects.toMatchObject({ code: 'MISSING_CACHE_CONTENT' })
      await expect(acceptance.readCacheContentBytes(resolve(cacheRoot, 'content-v2/sha512/missing'))).rejects.toMatchObject({ code: 'MISSING_CACHE_CONTENT' })
    } finally {
      await rm(cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: append-log selects the last valid matching live line and freezes LF plus that raw line', async () => {
    const fixture = await makeTinyCache()
    try {
      const unrelated = { ...fixture.indexRecord, key: 'make-fetch-happen:request-cache:https://registry.npmjs.org/unrelated/-/x.tgz' }
      const earlier = { ...fixture.indexRecord }
      const newer = { ...fixture.indexRecord }
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      await writeFile(fixture.indexPath, `${appendIndexLine(unrelated)}\n${appendIndexLine(earlier)}\n${appendIndexLine(newer)}\n`, 'utf8')
      await chmodReadOnlyTree(fixture.cacheRoot)
      const selected = await acceptance.selectCacheIndexRecord({ indexPath: fixture.indexPath, expectedKey: fixture.entry.key, expectedIntegrity: fixture.entry.integrity })
      const minimal = { key: fixture.entry.key, integrity: fixture.entry.integrity, metadata: { url: fixture.indexRecord.metadata.url }, size: fixture.indexRecord.size }
      const json = acceptance.canonicalJsonBytes(minimal)
      expect(selected.frozenIndexRaw).toBe(`\n${createHash('sha1').update(json).digest('hex')}\t${json}`)
      expect(selected.record).toEqual(minimal)
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test.each([
    ['last tombstone', (fixture: any) => appendIndexLine({ ...fixture.indexRecord, integrity: null })],
    ['last wrong integrity', (fixture: any) => appendIndexLine({ ...fixture.indexRecord, integrity: 'sha512-wrong' })],
  ])('B2a rewrite: append-log rejects %s without a live exact record', async (_label, makeLine) => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      const line = makeLine(fixture)
      await writeFile(fixture.indexPath, `${appendIndexLine(fixture.indexRecord)}\n${line}\n`, 'utf8')
      await chmodReadOnlyTree(fixture.cacheRoot)
      await expect(acceptance.selectCacheIndexRecord({ indexPath: fixture.indexPath, expectedKey: fixture.entry.key, expectedIntegrity: fixture.entry.integrity })).rejects.toMatchObject({
        code: 'INCONCLUSIVE_CACHE_MISS',
      })
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: append-log ignores invalid checksum, JSON, null, and other-key lines before a live match', async () => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      const live = appendIndexLine(fixture.indexRecord)
      await writeFile(fixture.indexPath, `${live}\nbad\t{}\n${appendIndexLine(null)}\n`, 'utf8')
      await chmodReadOnlyTree(fixture.cacheRoot)
      const selected = await acceptance.selectCacheIndexRecord({ indexPath: fixture.indexPath, expectedKey: fixture.entry.key, expectedIntegrity: fixture.entry.integrity })
      const minimal = { key: fixture.entry.key, integrity: fixture.entry.integrity, metadata: { url: fixture.indexRecord.metadata.url }, size: fixture.indexRecord.size }
      const json = acceptance.canonicalJsonBytes(minimal)
      expect(selected.frozenIndexRaw).toBe(`\n${createHash('sha1').update(json).digest('hex')}\t${json}`)
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: append-log rejects CRLF and a physical line above its fixed bound', async () => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      const live = appendIndexLine(fixture.indexRecord)
      await writeFile(fixture.indexPath, `\n${live}\r\n`, 'utf8')
      await expect(acceptance.selectCacheIndexRecord({ indexPath: fixture.indexPath, expectedKey: fixture.entry.key, expectedIntegrity: fixture.entry.integrity })).rejects.toMatchObject({ code: 'CACHE_INDEX_CRLF_FORBIDDEN' })
      await writeFile(fixture.indexPath, `${'x'.repeat(1_048_577)}\n`, 'utf8')
      await expect(acceptance.selectCacheIndexRecord({ indexPath: fixture.indexPath, expectedKey: fixture.entry.key, expectedIntegrity: fixture.entry.integrity })).rejects.toMatchObject({ code: 'CACHE_INDEX_LINE_LIMIT' })
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: accepts the standard npm cache source shape but freezes only the bound minimal record', async () => {
    const fixture = await makeTinyCache()
    try {
      const selected = await acceptance.selectCacheIndexRecord({
        indexPath: fixture.indexPath,
        expectedKey: fixture.entry.key,
        expectedIntegrity: fixture.entry.integrity,
      })
      expect(selected.record).toEqual({
        key: fixture.entry.key,
        integrity: fixture.entry.integrity,
        metadata: { url: fixture.indexRecord.metadata.url },
        size: fixture.indexRecord.size,
      })
      const serialized = JSON.stringify(selected)
      expect(serialized).not.toContain('reqHeaders')
      expect(serialized).not.toContain('resHeaders')
      expect(serialized).not.toContain('compress')
      expect(serialized).not.toContain('1725000000000')
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: rejects status metadata on a selected content record', async () => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      const changed: any = structuredClone(fixture.indexRecord)
      changed.metadata.status = 301
      await writeFile(fixture.indexPath, appendIndexLine(changed), 'utf8')
      await expect(acceptance.selectCacheIndexRecord({
        indexPath: fixture.indexPath,
        expectedKey: fixture.entry.key,
        expectedIntegrity: fixture.entry.integrity,
      })).rejects.toMatchObject({ code: 'CACHE_INDEX_SCHEMA_MISMATCH' })
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: accepts a safe request header named by the response Vary policy', async () => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      const changed: any = structuredClone(fixture.indexRecord)
      changed.metadata.reqHeaders['user-agent'] = 'fixture-agent/1.0'
      changed.metadata.resHeaders.vary = 'user-agent'
      await writeFile(fixture.indexPath, appendIndexLine(changed), 'utf8')
      const selected = await acceptance.selectCacheIndexRecord({
        indexPath: fixture.indexPath,
        expectedKey: fixture.entry.key,
        expectedIntegrity: fixture.entry.integrity,
      })
      expect(selected.record.metadata).toEqual({ url: fixture.indexRecord.metadata.url })
      expect(JSON.stringify(selected)).not.toContain('fixture-agent')
      expect(JSON.stringify(selected)).not.toContain('vary')
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: accepts an offline record generated by the bundled make-fetch-happen Vary path', async () => {
    const bundledRoot = resolve(dirname(process.execPath), '../lib/node_modules/npm/node_modules')
    const CacheEntry = require(resolve(bundledRoot, 'make-fetch-happen/lib/cache/entry.js'))
    const { Request, Response } = require(resolve(bundledRoot, 'minipass-fetch'))
    const { Minipass } = require(resolve(bundledRoot, 'minipass'))
    const cacheRoot = await mkdtemp(resolve(tmpdir(), 'rc6-mfh-vary-oracle-'))
    try {
      const url = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz'
      const bodyBytes = Buffer.from('offline make-fetch-happen fixture')
      const body = new Minipass()
      body.end(bodyBytes)
      const request = new Request(url, {
        method: 'GET',
        headers: { accept: 'application/octet-stream', 'user-agent': 'fixture-agent/1.0' },
      })
      const response = new Response(body, {
        url,
        status: 200,
        headers: {
          'cache-control': 'public, max-age=300',
          'content-length': String(bodyBytes.length),
          'content-type': 'application/octet-stream',
          vary: 'user-agent',
        },
      })
      const cacheEntry = new CacheEntry({
        request,
        response,
        options: {
          algorithms: ['sha512'],
          cacheAdditionalHeaders: [],
          cachePath: cacheRoot,
          compress: true,
        },
      })
      const stored = await cacheEntry.store('miss')
      await stored.buffer()

      const key = `make-fetch-happen:request-cache:${url}`
      const indexPath = cacheIndexPathForTest(cacheRoot, key)
      const raw = await readFile(indexPath, 'utf8')
      const line = raw.trim().split('\n').at(-1)!
      const sourceRecord = JSON.parse(line.slice(line.indexOf('\t') + 1))
      expect(sourceRecord.metadata.reqHeaders).toMatchObject({
        accept: 'application/octet-stream',
        'user-agent': 'fixture-agent/1.0',
      })
      expect(sourceRecord.metadata.resHeaders.vary).toBe('user-agent')

      const selected = await acceptance.selectCacheIndexRecord({
        indexPath,
        expectedKey: key,
        expectedIntegrity: sourceRecord.integrity,
      })
      expect(selected.record).toEqual({
        key,
        integrity: sourceRecord.integrity,
        metadata: { url },
        size: bodyBytes.length,
      })
    } finally {
      await rm(cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: does not mistake harmless token words in source-only headers for credentials', async () => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      const changed: any = structuredClone(fixture.indexRecord)
      changed.metadata.reqHeaders.accept = 'application/token+json'
      changed.metadata.resHeaders.link = '<https://example.test/token>; rel=alternate'
      await writeFile(fixture.indexPath, appendIndexLine(changed), 'utf8')
      const selected = await acceptance.selectCacheIndexRecord({
        indexPath: fixture.indexPath,
        expectedKey: fixture.entry.key,
        expectedIntegrity: fixture.entry.integrity,
      })
      expect(selected.record.metadata).toEqual({ url: fixture.indexRecord.metadata.url })
      expect(JSON.stringify(selected)).not.toContain('application/token+json')
      expect(JSON.stringify(selected)).not.toContain('example.test/token')
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test.each([
    [1024 * 1024 - 1, true],
    [1024 * 1024, true],
    [1024 * 1024 + 1, false],
  ])('B2a rewrite: enforces the physical index line byte boundary at %i bytes', async (lineBytes, accepted) => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      await writeFile(fixture.indexPath, appendIndexLineWithExactBytes(fixture.indexRecord, lineBytes), 'utf8')
      const result = acceptance.selectCacheIndexRecord({
        indexPath: fixture.indexPath,
        expectedKey: fixture.entry.key,
        expectedIntegrity: fixture.entry.integrity,
      })
      if (accepted) {
        await expect(result).resolves.toMatchObject({ record: { key: fixture.entry.key } })
      } else {
        await expect(result).rejects.toMatchObject({ code: 'CACHE_INDEX_LINE_LIMIT' })
      }
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test.each([
    [8 * 1024 * 1024 - 1, true],
    [8 * 1024 * 1024, true],
    [8 * 1024 * 1024 + 1, false],
  ])('B2a rewrite: enforces the complete append-log byte boundary at %i bytes', async (totalBytes, accepted) => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      const selectedLine = appendIndexLine(fixture.indexRecord)
      await writeFile(fixture.indexPath, appendLogWithExactBytes(selectedLine, totalBytes), 'utf8')
      const result = acceptance.selectCacheIndexRecord({
        indexPath: fixture.indexPath,
        expectedKey: fixture.entry.key,
        expectedIntegrity: fixture.entry.integrity,
      })
      if (accepted) {
        await expect(result).resolves.toMatchObject({ record: { key: fixture.entry.key } })
      } else {
        await expect(result).rejects.toMatchObject({ code: 'CACHE_INDEX_TOTAL_BYTES_LIMIT' })
      }
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  }, 15_000)

  test('B2a rewrite: binds source metadata URL byte-for-byte to the lock-derived cache key', async () => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      const changed = structuredClone(fixture.indexRecord)
      changed.metadata.url = 'https://registry.npmjs.org//private/Users/token-canary'
      await writeFile(fixture.indexPath, appendIndexLine(changed), 'utf8')
      await expect(acceptance.selectCacheIndexRecord({
        indexPath: fixture.indexPath,
        expectedKey: fixture.entry.key,
        expectedIntegrity: fixture.entry.integrity,
      })).rejects.toMatchObject({ code: 'CACHE_INDEX_IDENTITY_MISMATCH' })
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: rejects an unsafe public selector key before touching the supplied path', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-b2a-public-key-'))
    const canaryPath = resolve(root, 'private-path-canary')
    try {
      await expect(acceptance.selectCacheIndexRecord({
        indexPath: canaryPath,
        expectedKey: 'make-fetch-happen:request-cache:file:///private/Users/key-token-canary',
        expectedIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
      })).rejects.toMatchObject({ code: 'CACHE_INDEX_SCHEMA_MISMATCH' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each([
    'sha512-wrong',
    `sha512-${Buffer.alloc(63).toString('base64')}`,
    `sha512-${Buffer.alloc(64).toString('base64').replace(/==$/, '')}`,
  ])('B2a rewrite: rejects non-canonical public selector integrity before touching the supplied path', async (expectedIntegrity) => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-b2a-public-integrity-'))
    const canaryPath = resolve(root, 'private-path-canary')
    const resolved = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz'
    try {
      await expect(acceptance.selectCacheIndexRecord({
        indexPath: canaryPath,
        expectedKey: `make-fetch-happen:request-cache:${resolved}`,
        expectedIntegrity,
      })).rejects.toMatchObject({ code: 'CACHE_INDEX_SCHEMA_MISMATCH' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: keeps a missing source path out of the public selector error', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-b2a-public-error-'))
    const canaryPath = resolve(root, 'private-path-canary')
    const resolved = 'https://registry.npmjs.org/example/-/example-1.0.0.tgz'
    try {
      await expect(acceptance.selectCacheIndexRecord({
        indexPath: canaryPath,
        expectedKey: `make-fetch-happen:request-cache:${resolved}`,
        expectedIntegrity: `sha512-${Buffer.alloc(64).toString('base64')}`,
      })).rejects.toSatisfy((error: any) => error?.code === 'MISSING_CACHE_INDEX'
        && !String(error?.message).includes(root)
        && !String(error?.message).includes('private-path-canary'))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each([
    ['nested object', (record: any) => ({ ...record, metadata: { ...record.metadata, nested: { sourcePath: '/private/canary' } } })],
    ['array field', (record: any) => ({ ...record, metadata: { ...record.metadata, headers: ['Bearer secret'] } })],
    ['innocuous header with token', (record: any) => ({ ...record, metadata: { ...record.metadata, headers: { accept: 'Bearer token-canary' } } })],
    ['allowed request header carrying a credential', (record: any) => ({
      ...record,
      metadata: {
        ...record.metadata,
        reqHeaders: { ...record.metadata.reqHeaders, accept: 'Bearer token-canary' },
      },
    })],
    ['allowed response header carrying a local path', (record: any) => ({
      ...record,
      metadata: {
        ...record.metadata,
        resHeaders: { ...record.metadata.resHeaders, location: 'file:///private/cache/canary' },
      },
    })],
    ['allowed response header carrying a signed credential URL', (record: any) => ({
      ...record,
      metadata: {
        ...record.metadata,
        resHeaders: {
          ...record.metadata.resHeaders,
          location: 'https://example.test/file?X-Amz-Credential=canary&X-Amz-Signature=canary',
        },
      },
    })],
    ['allowed response header carrying a local volume path', (record: any) => ({
      ...record,
      metadata: {
        ...record.metadata,
        resHeaders: { ...record.metadata.resHeaders, location: '/Volumes/private-cache/canary' },
      },
    })],
    ['unknown request header name', (record: any) => ({
      ...record,
      metadata: {
        ...record.metadata,
        reqHeaders: { ...record.metadata.reqHeaders, authorization: 'opaque' },
      },
    })],
    ['URL userinfo', (record: any) => ({ ...record, metadata: { url: 'https://token@registry.npmjs.org/example/-/example-1.0.0.tgz' } })],
    ['URL query', (record: any) => ({ ...record, metadata: { url: `${record.metadata.url}?token=canary` } })],
    ['file URL', (record: any) => ({ ...record, metadata: { url: 'file:///private/cache/canary' } })],
    ['Windows path', (record: any) => ({ ...record, metadata: { url: 'C:\\Users\\canary' } })],
  ])('B2a rewrite: selector rejects unsafe source index %s without freezing source fields', async (_label, mutate) => {
    const fixture = await makeTinyCache()
    try {
      await chmod(resolve(fixture.indexPath, '..'), 0o755)
      await chmod(fixture.indexPath, 0o644)
      await writeFile(fixture.indexPath, `${appendIndexLine(mutate(fixture.indexRecord))}\n`, 'utf8')
      await expect(acceptance.selectCacheIndexRecord({ indexPath: fixture.indexPath, expectedKey: fixture.entry.key, expectedIntegrity: fixture.entry.integrity })).rejects.toMatchObject({ code: 'CACHE_INDEX_SCHEMA_MISMATCH' })
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: selected-only reader ignores unrelated unreadable cache canaries', async () => {
    const fixture = await makeTinyCache()
    const canary = resolve(fixture.cacheRoot, 'unrelated', 'deep', 'canary')
    try {
      await chmodWritableTree(fixture.cacheRoot)
      await mkdir(dirname(canary), { recursive: true })
      await writeFile(canary, 'unrelated-canary')
      await chmod(canary, 0o000)
      const snapshot = await acceptance.snapshotSelectedCacheSelectedOnlyForTest({ cacheRoot: fixture.cacheRoot, lockModel: fixture.lockModel })
      expect(snapshot.entries).toHaveLength(1)
      expect(JSON.stringify(snapshot)).not.toContain('unrelated-canary')
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: selected-only reader rejects a symlink in a selected source ancestor', async () => {
    const fixture = await makeTinyCache()
    const selectedLeaf = dirname(fixture.indexPath)
    const selectedParent = dirname(selectedLeaf)
    const relocatedLeaf = resolve(selectedParent, `${basename(selectedLeaf)}-relocated`)
    try {
      await chmod(selectedParent, 0o755)
      await rename(selectedLeaf, relocatedLeaf)
      await symlink(relocatedLeaf, selectedLeaf, 'dir')
      await chmod(selectedParent, 0o555)
      await expect(acceptance.snapshotSelectedCacheSelectedOnlyForTest({
        cacheRoot: fixture.cacheRoot,
        lockModel: fixture.lockModel,
      })).rejects.toMatchObject({ code: 'CACHE_SOURCE_PATH_CHAIN_INVALID' })
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: production preparation rejects a symlinked source-cache root', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-b2a-source-root-'))
    const physicalSource = resolve(root, 'physical-source-cache')
    const linkedSource = resolve(root, 'linked-source-cache')
    try {
      await mkdir(physicalSource)
      await symlink(physicalSource, linkedSource, 'dir')
      await writeSyntheticCandidate(root, { sourceCacheRoot: linkedSource, npmCliPath: process.execPath })
      await expect(acceptance.prepareSelectedSource({ workspaceRoot: root })).rejects.toMatchObject({
        code: 'INVALID_SOURCE_CACHE',
      })
      await expect(stat(resolve(root, '.tmp/dsh-pm-workbench/declaration-input-source.json'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(stat(resolve(root, '.tmp/dsh-pm-workbench/declaration-input-source-bundles'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: production preparation rejects a symlinked workspace ancestor before candidate reads or target writes', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-b2a-target-parent-'))
    const realTemporaryRoot = resolve(root, 'real-temporary-root')
    const physicalCandidateRoot = resolve(realTemporaryRoot, 'dsh-pm-workbench/declaration-input-candidate')
    try {
      await mkdir(physicalCandidateRoot, { recursive: true })
      await symlink(realTemporaryRoot, resolve(root, '.tmp'), 'dir')
      await expect(acceptance.prepareSelectedSource({ workspaceRoot: root })).rejects.toMatchObject({
        code: 'BUNDLE_PATH_CONTAINMENT',
      })
      await expect(stat(resolve(realTemporaryRoot, 'dsh-pm-workbench/declaration-input-source.json'))).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(stat(resolve(realTemporaryRoot, 'dsh-pm-workbench/declaration-input-source-bundles'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: final publication inventory derives file mode and bytes from one bound descriptor read', async () => {
    const source = await readFile(resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'), 'utf8')
    const inventory = source.match(/async function inventoryBundlePayload\([\s\S]+?\n}\n\nfunction safeBundleSegment/)
    expect(inventory).not.toBeNull()
    expect(inventory?.[0]).toContain('readBoundSourceFile(')
    expect(inventory?.[0]).toContain('identity.mode')
    expect(inventory?.[0]).toContain('size: identity.size')
    expect(inventory?.[0]).not.toContain('readNoFollow(')
  })

  test('B2a rewrite: directory and selected-source ancestry checks close both observed path windows', async () => {
    const source = await readFile(resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'), 'utf8')
    const boundDirectory = source.match(/async function assertBoundDirectory\([\s\S]+?\n}\n\nasync function assertDescendantDirectoryChain/)
    const transfer = source.match(/async function snapshotSelectedCacheForTransfer\([\s\S]+?\n}\n\nexport async function snapshotSelectedCacheSelectedOnlyForTest/)
    expect(boundDirectory).not.toBeNull()
    expect(transfer).not.toBeNull()
    expect(boundDirectory?.[0].match(/boundary\.handle\.stat\(\)/g)).toHaveLength(2)
    expect(boundDirectory?.[0].match(/lstat\(boundary\.path\)/g)).toHaveLength(2)
    expect(boundDirectory?.[0].match(/realpath\(boundary\.path\)/g)).toHaveLength(2)
    expect(transfer?.[0].match(/assertDescendantDirectoryChain\(sourceBoundary, indexPath/g)).toHaveLength(2)
    expect(transfer?.[0].match(/assertDescendantDirectoryChain\(sourceBoundary, contentPath/g)).toHaveLength(2)
  })

  test('B2a rewrite: bound inventory classifies writable files before hardlinks', async () => {
    const source = await readFile(resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'), 'utf8')
    const reader = source.match(/async function readBoundSourceFile\([\s\S]+?\n}\n\nfunction cacheFileIdentity/)
    expect(reader).not.toBeNull()
    expect(reader?.[0].indexOf("fail(writableCode, logicalLabel)")).toBeGreaterThan(-1)
    expect(reader?.[0].indexOf("fail(hardlinkCode, logicalLabel)")).toBeGreaterThan(-1)
    expect(reader?.[0].indexOf("fail(writableCode, logicalLabel)")).toBeLessThan(
      reader?.[0].indexOf("fail(hardlinkCode, logicalLabel)") ?? -1,
    )
  })

  test('B2a rewrite: public production preparation rejects unknown request fields before candidate access', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-b2a-options-'))
    try {
      await expect(acceptance.prepareSelectedSource({ workspaceRoot: root, syntheticPolicy: true } as any)).rejects.toMatchObject({ code: 'PREPARE_OPTIONS_MISMATCH' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('B2a rewrite: production module exposes only the reviewed public surface', () => {
    expect(Object.keys(acceptance).sort()).toEqual([
      'acceptRc6DeclarationInput',
      'assertDirectoryEmptyOrAbsent',
      'canonicalJsonBytes',
      'compareCacheSnapshots',
      'computeSelectedCacheHashes',
      'deriveCanonicalLockInput',
      'dynamicOwnedInputErrorCodes',
      'expectedCompilerToolchain',
      'expectedProductionBoundary',
      'inspectCommittedDeclarationInput',
      'mapPublicInputError',
      'prepareSelectedSource',
      'publicInputMismatchCodes',
      'publicInputOperationalCodes',
      'publicInputSchemaCodes',
      'readCacheContentBytes',
      'readSelectedCacheRecord',
      'realpathWithStableMissingCode',
      'selectCacheIndexRecord',
      'snapshotSelectedCacheFixtureOnly',
      'snapshotSelectedCacheSelectedOnlyForTest',
      'stageRc6DeclarationInputV2',
      'validateInputManifest',
      'validateProductionBoundary',
    ].sort())
  })

  test('B2b bootstrap pins the complete host and client compiler toolchain', () => {
    expect(acceptance.expectedCompilerToolchain).toEqual({
      typescript: {
        lockPath: 'node_modules/typescript',
        version: '6.0.3',
        integrity: 'sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==',
      },
      nodeTypes: {
        lockPath: 'node_modules/@types/node',
        version: '24.13.3',
        integrity: 'sha512-Dh8vAsV36ig5wa9OX4pXvMc9D3Veibfw2wix0CUwYODLD8nkj9UsLjASr49nPg+2eKzxhBV+v7L8pXvT4e639Q==',
      },
      undiciTypes: {
        lockPath: 'node_modules/undici-types',
        version: '7.18.2',
        integrity: 'sha512-AsuCzffGHJybSaRrmr5eHr81mwJU3kjw6M+uprWvCXiNeN9SOGwQ3Jn8jb8m3Z6izVgknn1R0FTCEAP2QrLY/w==',
      },
      reactTypes: {
        lockPath: 'node_modules/@types/react',
        version: '18.3.31',
        integrity: 'sha512-vfEqpXTvwT91yhmwdfouStN2hSKwTvyRs8qpLfADyrq/kxDw0hZM7Wk9Ug1FELj8hIby+S/+kQCSRFF32nv2Qw==',
      },
      propTypes: {
        lockPath: 'node_modules/@types/prop-types',
        version: '15.7.15',
        integrity: 'sha512-F6bEyamV9jKGAFBEmlQnesRPGOQqS2+Uwi0Em15xenOxHaf2hv6L8YCVn3rPdPJOiJfPiCnLIRyvwVaqMY3MIw==',
      },
      csstype: {
        lockPath: 'node_modules/csstype',
        version: '3.2.3',
        integrity: 'sha512-z1HGKcYy2xA8AGQfwrn0PAy+PB7X/GSj3UVJW9qKyn43xWa+gl5nXmU4qqLMRzWVLFC8KusUX8T/0kCiOYpAIQ==',
      },
    })
  })

  test('B2a rewrite: public production path publishes the complete 169-entry path-free receipt chain', async () => {
    await withSynthetic169ProductionPath(workspaceRoot, async (fixture) => {
      expect(fixture.publication).toMatchObject({
        indexFileCount: 169,
        contentFileCount: 169,
        publishedFileCount: 341,
        contentBytes: fixture.selectedContentBytes,
      })
      expect(fixture.result.status).toBe('PASS_SELECTED_SOURCE_BUNDLE_PREPARATION')
    })
  }, 120_000)

  test('B2a-R2: a repeated producer recovers the already verified publication idempotently', async () => {
    await withSynthetic169ProductionPath(workspaceRoot, async (fixture) => {
      const repeated = await fixture.prepareAgain()
      expect(repeated).toEqual(fixture.result)
    })
  }, 120_000)

  test('B2a-R2: a repeated producer recovers solely from the published bundle after its candidate source disappears', async () => {
    await withSynthetic169ProductionPath(workspaceRoot, async (fixture) => {
      const recovered = await fixture.prepareAgainAfterIsolatingSourceCache()

      expect(recovered.sourceIsolation).toEqual({
        originalPathMissing: true,
        candidateStillPointsToOriginalPath: true,
      })
      expect(recovered.result).toEqual(fixture.result)
      expect(recovered.publication.pointerBytes).toBe(fixture.publication.pointerBytes)
      expect(recovered.publication.pointerDev).toBe(fixture.publication.pointerDev)
      expect(recovered.publication.pointerIno).toBe(fixture.publication.pointerIno)
      expect(recovered.publication.bundleCount).toBe(1)
      expect(recovered.publication.pointerTemporaryCount).toBe(0)
    })
  }, 120_000)

  test('B2a-R2: a repeated producer removes a crash-left pointer temporary hard link before recovery', async () => {
    await withSynthetic169ProductionPath(workspaceRoot, async (fixture) => {
      const recovered = await fixture.prepareAgainAfterAddingPointerTemporaryAlias()

      expect(recovered.crashResidue).toEqual({
        stableNlinkBeforeRecovery: '2',
        aliasSharedStableInode: true,
        aliasRemoved: true,
      })
      expect(recovered.result).toEqual(fixture.result)
      expect(recovered.publication.pointerBytes).toBe(fixture.publication.pointerBytes)
      expect(recovered.publication.pointerDev).toBe(fixture.publication.pointerDev)
      expect(recovered.publication.pointerIno).toBe(fixture.publication.pointerIno)
      expect(recovered.publication.pointerNlink).toBe('1')
      expect(recovered.publication.bundleCount).toBe(1)
      expect(recovered.publication.pointerTemporaryCount).toBe(0)
    })
  }, 120_000)

  test('B2a-R2: two concurrent producers converge on one verified public pointer', async () => {
    await withSynthetic169ConcurrentProductionPath(workspaceRoot, async (fixture) => {
      expect(fixture.concurrentSettlements).toHaveLength(2)
      expect(fixture.concurrentSettlements?.every((settlement) => settlement.status === 'fulfilled')).toBe(true)
      const results = fixture.concurrentSettlements?.flatMap((settlement) =>
        settlement.status === 'fulfilled' ? [settlement.result] : []) ?? []
      expect(results).toHaveLength(2)
      expect(results[0]).toEqual(results[1])
      expect(results[0]).toEqual(fixture.result)
    })
  }, 120_000)

  test('B2a-R2: a non-EEXIST failure before the real pointer link reports POINTER_COMMIT_FAILED and cleans only owned residue', async () => {
    await withSynthetic169LinkFaultProductionPath(
      workspaceRoot,
      'before-real-link',
      async (fixture) => {
        expect(fixture.outcome).toEqual({
          kind: 'rejected',
          reasonCode: 'POINTER_COMMIT_FAILED',
          publicError: {
            status: 'FAIL_INPUT_INTERNAL',
            reasonCode: 'POINTER_COMMIT_FAILED',
          },
        })
        expect(fixture.linkFaultEvidence).toMatchObject({
          wrapperCalls: 1,
          realLinkCalls: 0,
          injectedBeforeRealLink: true,
          injectedAfterRealLink: false,
        })
        expect(fixture.failureState).toMatchObject({
          stablePointerMissing: true,
          pointerTemporaryNames: [
            '.declaration-input-source-11111111111111111111111111111111.tmp',
          ],
          bundleNames: ['bundle-22222222222222222222222222222222'],
          cleanupNames: [],
        })
        expect(fixture.failureState.foreignCanaryAfter).toEqual(
          fixture.failureState.foreignCanaryBefore,
        )
      },
    )
  }, 120_000)

  test('B2a-R2: a non-EEXIST wrapper failure after the real pointer link is recovered as the published result', async () => {
    await withSynthetic169LinkFaultProductionPath(
      workspaceRoot,
      'after-real-link',
      async (fixture) => {
        expect(fixture.outcome).toEqual({ kind: 'fulfilled' })
        expect(fixture.linkFaultEvidence).toMatchObject({
          wrapperCalls: 1,
          realLinkCalls: 1,
          injectedBeforeRealLink: false,
          injectedAfterRealLink: true,
          sameInodeAfterRealLink: true,
          sourceNlinkAfterRealLink: '2',
          targetNlinkAfterRealLink: '2',
        })
        expect(fixture.result.status).toBe('PASS_SELECTED_SOURCE_BUNDLE_PREPARATION')
        expect(fixture.publication).toMatchObject({
          bundleCount: 1,
          pointerTemporaryCount: 0,
          pointerNlink: '1',
          indexFileCount: 169,
          contentFileCount: 169,
          publishedFileCount: 341,
          contentBytes: fixture.selectedContentBytes,
        })
        expect(fixture.publication.pointerDev).toBe(
          fixture.linkFaultEvidence.targetDevAfterRealLink,
        )
        expect(fixture.publication.pointerIno).toBe(
          fixture.linkFaultEvidence.targetInoAfterRealLink,
        )
      },
    )
  }, 120_000)

  test.each([
    ['extra candidate field', (candidate: any) => { candidate.extra = true }, 'CANDIDATE_SCHEMA_MISMATCH'],
    ['missing authorization basis', (candidate: any) => { delete candidate.authorizationBasis }, 'CANDIDATE_SCHEMA_MISMATCH'],
    ['forged authorization basis', (candidate: any) => { candidate.authorizationBasis = 'forged' }, 'CANDIDATE_AUTHORIZATION_MISMATCH'],
    ['extra expected field', (candidate: any) => { candidate.expected.extra = true }, 'CANDIDATE_SCHEMA_MISMATCH'],
  ])('B2a rewrite: production candidate rejects %s before source-cache access', async (_label, mutate, code) => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-b2a-candidate-schema-'))
    const absentSource = resolve(root, 'source-cache-must-not-be-opened')
    try {
      await writeSyntheticCandidate(root, { sourceCacheRoot: absentSource, npmCliPath: process.execPath })
      const candidatePath = resolve(root, '.tmp/dsh-pm-workbench/declaration-input-candidate/candidate.json')
      const candidate = JSON.parse(await readFile(candidatePath, 'utf8'))
      mutate(candidate)
      await writeFile(candidatePath, `${JSON.stringify(candidate)}\n`, 'utf8')
      await expect(acceptance.prepareSelectedSource({ workspaceRoot: root })).rejects.toMatchObject({ code })
      await expect(stat(absentSource)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(stat(resolve(root, '.tmp/dsh-pm-workbench/declaration-input-source.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each([
    ['extra file', 'CACHE_INVENTORY_EXTRA', async (fixture: any) => writeFile(resolve(fixture.cacheRoot, 'unexpected'), 'x')],
    ['missing content', 'MISSING_CACHE_CONTENT', async (fixture: any) => { await chmod(resolve(fixture.contentPath, '..'), 0o755); await unlink(fixture.contentPath) }],
    ['symlink', 'CACHE_INVENTORY_SYMLINK', async (fixture: any) => symlink(fixture.contentPath, resolve(fixture.cacheRoot, 'linked'))],
    ['writable content', 'CACHE_READONLY_REQUIRED', async (fixture: any) => chmod(fixture.contentPath, 0o644)],
    ['hardlink', 'CACHE_HARDLINK_FORBIDDEN', async (fixture: any) => { await chmod(resolve(fixture.contentPath, '..'), 0o755); await link(fixture.contentPath, resolve(fixture.cacheRoot, 'hardlink')) }],
  ])('rejects exact snapshot inventory attack: %s', async (_label, code, mutate) => {
    const fixture = await makeTinyCache()
    try {
      await chmodWritableTree(fixture.cacheRoot)
      await mutate(fixture)
      if (_label !== 'writable content') await chmodReadOnlyTree(fixture.cacheRoot)
      await expect(acceptance.snapshotSelectedCacheFixtureOnly({ cacheRoot: fixture.cacheRoot, lockModel: fixture.lockModel, requireReadOnly: true, requireExactInventory: true })).rejects.toMatchObject({ code })
    } finally {
      await chmodWritableTree(fixture.cacheRoot)
      await rm(fixture.cacheRoot, { recursive: true, force: true })
    }
  })

  test('inspects v1 committed input before candidate/cache/root writes', async () => {
    const root = await createInspectorFixture()
    try {
      await copyFile(
        resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json'),
        resolve(root, 'tools/harness-rc6-declarations/input-manifest.json'),
      )
      const result = await acceptance.inspectCommittedDeclarationInput({ workspaceRoot: root })
      expect(result).toMatchObject({ status: 'CHANGES_REQUIRED_REVIEW', reason: 'INPUT_MANIFEST_V2_PENDING_B2' })
      await expect(stat(resolve(root, '.tmp/dsh-pm-workbench'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('B2b bootstrap exposes only the exact workspaceRoot request shape', async () => {
    const root = await createBootstrapFixture()
    try {
      expect(typeof acceptance.stageRc6DeclarationInputV2).toBe('function')
      await expect(acceptance.stageRc6DeclarationInputV2(null as any))
        .rejects.toMatchObject({ code: 'STAGE_OPTIONS_MISMATCH' })
      await expect(acceptance.stageRc6DeclarationInputV2({
        workspaceRoot: root,
        replay: false,
      } as any)).rejects.toMatchObject({ code: 'STAGE_OPTIONS_MISMATCH' })
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('B2b bootstrap rejects any committed schema-v1 byte drift before temporary writes', async () => {
    const root = await createBootstrapFixture()
    const manifestPath = resolve(root, 'tools/harness-rc6-declarations/input-manifest.json')
    try {
      const before = await readFile(manifestPath)
      await writeFile(manifestPath, Buffer.concat([before, Buffer.from('\n')]))
      const changed = await readFile(manifestPath)

      await expect(acceptance.stageRc6DeclarationInputV2({ workspaceRoot: root }))
        .rejects.toMatchObject({ code: 'COMMITTED_V1_BOOTSTRAP_MISMATCH' })
      expect(await readFile(manifestPath)).toEqual(changed)
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('B2b bootstrap reuses one bound committed-input snapshot instead of reopening schema v1', async () => {
    const source = await readFile(resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'), 'utf8')
    const stage = source.match(/export async function stageRc6DeclarationInputV2\([\s\S]+?\n}\n\nexport async function acceptRc6DeclarationInput/)
    expect(stage).not.toBeNull()
    expect(stage?.[0]).toContain('readCommittedDeclarationFiles(workspaceRoot)')
    expect(stage?.[0]).toContain('inspectCommittedV1Bootstrap(workspaceRoot, files)')
    expect(stage?.[0]).not.toContain('inspectCommittedDeclarationInput({ workspaceRoot })')
    const bootstrap = source.match(/async function inspectCommittedV1Bootstrap\([\s\S]+?\n}\n\nexport async function stageRc6DeclarationInputV2/)
    expect(bootstrap?.[0]).toContain('inspectCommittedDeclarationInputSnapshot({ workspaceRoot, files })')
  })

  test('B2b bootstrap is a strict consumer and never creates a missing selected-source publication', async () => {
    const root = await createBootstrapFixture()
    try {
      await expect(acceptance.stageRc6DeclarationInputV2({ workspaceRoot: root }))
        .rejects.toMatchObject({ code: 'STABLE_POINTER_REQUIRED' })
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('B2b compiler evidence matches only exact storage package path segments', async () => {
    await withCompilerEvidenceHelpersForTest(({ isStorageDeclarationRelativePath }) => {
      for (const relativePath of [
        'node_modules/@deepseek-ai/dsh-storage',
        'node_modules/@deepseek-ai/dsh-storage/index.d.ts',
        'packages/workbench/node_modules/@deepseek-ai/dsh-storage-domain',
        'packages/workbench/node_modules/@deepseek-ai/dsh-storage-domain/dist/index.d.ts',
      ]) {
        expect(isStorageDeclarationRelativePath(relativePath)).toBe(true)
      }
      for (const relativePath of [
        'node_modules/@deepseek-ai/dsh-storage-extra/index.d.ts',
        'node_modules/@deepseek-ai/dsh-storage-domain-extra/index.d.ts',
        'node_modules/@deepseek-ai/not-dsh-storage/index.d.ts',
        'node_modules/@other/dsh-storage/index.d.ts',
        'src/dsh-storage/index.d.ts',
      ]) {
        expect(isStorageDeclarationRelativePath(relativePath)).toBe(false)
      }
    })
  })

  test.each([
    ['host', 'dsh-storage', 'index.d.ts', 3],
    ['client', 'dsh-storage-domain', 'dist/nested.d.ts', 4],
  ] as const)(
    'B2b bootstrap rejects %s compile output that imports %s and publishes no proposal',
    async (surface, packageName, nestedPath, expectedCallCount) => {
      await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
        const before = await fixture.snapshotCommittedEvidence()
        fixture.injectStorageOnNextCompile(surface, packageName, nestedPath)

        await expect(fixture.stageV2Proposal()).rejects.toMatchObject({
          code: 'STORAGE_SELECTED_OR_IMPORTED',
        })

        expect(fixture.replayEvidence.calls).toHaveLength(expectedCallCount)
        expect(await fixture.snapshotCommittedEvidence()).toBe(before)
        await expect(stat(resolve(
          fixture.workspaceRoot,
          '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
        ))).rejects.toMatchObject({ code: 'ENOENT' })
      })
    },
    30_000,
  )

  test('B2b proposal receipt binds replay compile results and the sealed compiler type-root policy', async () => {
    await withProposalReceiptBuilderForTest((buildReceipt) => {
      const proposalEvidence = proposalEvidenceFixture()
      const receipt = buildReceipt({
        ownerMarker: 'a'.repeat(32),
        inputBytes: Buffer.from('input', 'utf8'),
        closureBytes: Buffer.from('closure', 'utf8'),
        sourcePublication: {
          pointerBytes: Buffer.from('pointer', 'utf8'),
          pointer: { receiptSha256: 'b'.repeat(64) },
          receipt: { payloadIdentitySha256: 'c'.repeat(64) },
        },
        runtime: { node: 'fixture' },
        proposalEvidence,
      })
      const expectedCompilePolicy = {
        compiler: 'typescript/bin/tsc',
        invocations: [
          {
            surface: 'host',
            configRelativePath: 'tsconfig.surface.host.json',
            args: [
              '-p', '<host-config>', '--noEmit', '--types', 'node',
              '--typeRoots', '<sealed-compiler-types>', '--listFiles', '--pretty', 'false',
            ],
          },
          {
            surface: 'client',
            configRelativePath: 'tsconfig.surface.client.overlay.json',
            args: [
              '-p', '<client-overlay>', '--noEmit', '--types', 'node',
              '--typeRoots', '<sealed-compiler-types>', '--listFiles', '--pretty', 'false',
            ],
          },
        ],
        clientOverlay: {
          relativePath: 'tsconfig.surface.client.overlay.json',
          sha256: 'ccc1578a3ed59a72264d3d468af7968b2a0771b693875d9ea9ee8fda4b1a2d24',
          extends: './tsconfig.surface.client.json',
          compilerOptions: {
            paths: {
              react: ['./.compiler/node_modules/@types/react/index.d.ts'],
              'prop-types': ['./.compiler/node_modules/@types/prop-types/index.d.ts'],
              csstype: ['./.compiler/node_modules/csstype/index.d.ts'],
            },
          },
        },
        envKeys: ['HOME', 'TMPDIR'],
      }

      expect(Object.keys(receipt).sort()).toEqual([
        'acceptanceSourceSha256',
        'closureSha256',
        'compilePolicySha256',
        'compileResults',
        'compilerSealedAggregateSha256',
        'compilerResultSha256',
        'compilerSourceAggregateSha256',
        'inputManifestSha256',
        'npmPolicySha256',
        'ownerMarker',
        'payload',
        'payloadIdentitySha256',
        'result',
        'runtime',
        'schemaVersion',
        'selectedSourcePayloadIdentitySha256',
        'selectedSourcePointerSha256',
        'selectedSourceReceiptSha256',
        'verifierResultSha256',
        'verifierSourceSha256',
      ].sort())
      expect(receipt).toMatchObject(proposalEvidence)
      expect(receipt.compilerResultSha256).toBe(
        createHash('sha256')
          .update(acceptance.canonicalJsonBytes(receipt.compileResults))
          .digest('hex'),
      )
      const overlayPaths = expectedCompilePolicy.clientOverlay.compilerOptions.paths
      expect(Object.keys(overlayPaths).sort()).toEqual(['csstype', 'prop-types', 'react'])
      for (const targets of Object.values(overlayPaths)) {
        expect(targets).toHaveLength(1)
        expect(targets[0].startsWith('./.compiler/')).toBe(true)
        expect(targets[0].split('/')).not.toContain('..')
      }
      expect(receipt.compilePolicySha256).toBe(
        createHash('sha256')
          .update(acceptance.canonicalJsonBytes(expectedCompilePolicy))
          .digest('hex'),
      )
      expect(JSON.stringify(receipt)).not.toMatch(/(?:\/Users\/|\/private\/|file:|[A-Za-z]:[\\/])/)
    })
  })

  test('B2b proposal receipt rejects malformed replay evidence hashes', async () => {
    await withProposalReceiptBuilderForTest((buildReceipt) => {
      expect(() => buildReceipt({
        ownerMarker: 'a'.repeat(32),
        inputBytes: Buffer.from('input', 'utf8'),
        closureBytes: Buffer.from('closure', 'utf8'),
        sourcePublication: {
          pointerBytes: Buffer.from('pointer', 'utf8'),
          pointer: { receiptSha256: 'b'.repeat(64) },
          receipt: { payloadIdentitySha256: 'c'.repeat(64) },
        },
        runtime: { node: 'fixture' },
        proposalEvidence: proposalEvidenceFixture({ verifierSourceSha256: 'not-a-sha256' }),
      })).toThrowError(expect.objectContaining({ code: 'PROPOSAL_CONFLICT' }))
    })
  })

  test('B2b proposal receipt rejects compile evidence shape, hash, count, boolean, and extra-key drift', async () => {
    await withProposalReceiptBuilderForTest((buildReceipt) => {
      const build = (proposalEvidence: Record<string, unknown>) => buildReceipt({
        ownerMarker: 'a'.repeat(32),
        inputBytes: Buffer.from('input', 'utf8'),
        closureBytes: Buffer.from('closure', 'utf8'),
        sourcePublication: {
          pointerBytes: Buffer.from('pointer', 'utf8'),
          pointer: { receiptSha256: 'b'.repeat(64) },
          receipt: { payloadIdentitySha256: 'c'.repeat(64) },
        },
        runtime: { node: 'fixture' },
        proposalEvidence,
      })
      const cases: Record<string, unknown>[] = []

      const missingClient = compileResultsFixture() as any
      delete missingClient.client
      cases.push(proposalEvidenceFixture({
        compileResults: missingClient,
        compilerResultSha256: createHash('sha256')
          .update(acceptance.canonicalJsonBytes(missingClient)).digest('hex'),
      }))

      cases.push(proposalEvidenceFixture({ compilerResultSha256: 'f'.repeat(64) }))

      const zeroCount = compileResultsFixture() as any
      zeroCount.host.relativeFileCount = 0
      cases.push(proposalEvidenceFixture({
        compileResults: zeroCount,
        compilerResultSha256: createHash('sha256')
          .update(acceptance.canonicalJsonBytes(zeroCount)).digest('hex'),
      }))

      const storageSeen = compileResultsFixture() as any
      storageSeen.client.storageDeclarationFilesListed = true
      cases.push(proposalEvidenceFixture({
        compileResults: storageSeen,
        compilerResultSha256: createHash('sha256')
          .update(acceptance.canonicalJsonBytes(storageSeen)).digest('hex'),
      }))

      const extraKey = compileResultsFixture() as any
      extraKey.host.absoluteFiles = ['/private/forbidden.d.ts']
      cases.push(proposalEvidenceFixture({
        compileResults: extraKey,
        compilerResultSha256: createHash('sha256')
          .update(acceptance.canonicalJsonBytes(extraKey)).digest('hex'),
      }))

      for (const proposalEvidence of cases) {
        expect(() => build(proposalEvidence)).toThrowError(
          expect.objectContaining({ code: 'PROPOSAL_CONFLICT' }),
        )
      }
    })
  })

  test('B2b stage captures proposal evidence before replay cleanup and passes it to publication', async () => {
    const source = await readFile(resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'), 'utf8')
    const stage = source.match(/export async function stageRc6DeclarationInputV2\([\s\S]+?\n}\n\nexport async function acceptRc6DeclarationInput/)
    expect(stage).not.toBeNull()
    const stageSource = stage?.[0] ?? ''
    const finalVerifierCheck = stageSource.lastIndexOf(
      'await assertReplayVerificationSourcesUnchanged(verificationSnapshot)',
    )
    const evidenceCapture = stageSource.indexOf('const proposalEvidence = {')
    const replayCleanup = stageSource.indexOf('await cleanupOwnedDirectory({', evidenceCapture)
    const publication = stageSource.indexOf('await publishV2ProposalBundle({', replayCleanup)

    expect(finalVerifierCheck).toBeGreaterThan(-1)
    expect(evidenceCapture).toBeGreaterThan(finalVerifierCheck)
    expect(replayCleanup).toBeGreaterThan(evidenceCapture)
    expect(publication).toBeGreaterThan(replayCleanup)
    expect(stageSource.slice(evidenceCapture, replayCleanup)).toContain(
      'verifierResultSha256: sha256(canonicalJsonBytes(verifiedAfterCompileIdentity))',
    )
    expect(stageSource.slice(publication, publication + 500)).toContain('proposalEvidence,')
  })

  test('B2b bootstrap derives path-free v2 candidates but stays inconclusive under the synthetic replay seam', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      expect(fixture.historicalInputsIsolated).toBe(true)
      const dangerousEnvironment = {
        NODE_OPTIONS: process.env.NODE_OPTIONS,
        NODE_PATH: process.env.NODE_PATH,
        npm_config_registry: process.env.npm_config_registry,
        npm_package_name: process.env.npm_package_name,
        INIT_CWD: process.env.INIT_CWD,
        HTTPS_PROXY: process.env.HTTPS_PROXY,
        TOKEN: process.env.TOKEN,
      }
      Object.assign(process.env, {
        NODE_OPTIONS: '--require=/must-not-run.cjs',
        NODE_PATH: '/must-not-load',
        npm_config_registry: 'https://must-not-contact.invalid',
        npm_package_name: 'must-not-inherit',
        INIT_CWD: '/must-not-inherit',
        HTTPS_PROXY: 'http://credential:secret@must-not-inherit.invalid',
        TOKEN: 'must-not-inherit',
      })
      try {
        const before = await fixture.snapshotCommittedEvidence()
        const result = await fixture.stageV2Proposal()
        const after = await fixture.snapshotCommittedEvidence()
        const serialized = JSON.stringify(result)

        expect(result).toEqual({
          status: 'INCONCLUSIVE_SYNTHETIC_REPLAY',
          evidenceKind: 'SYNTHETIC_CHILD_PROCESS_SEAM',
          selectedCount: 169,
          selectedBytes: fixture.selectedContentBytes,
          fullDeepseekCount: 59,
          selectedDeclarationCount: 5,
          candidateInputManifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          candidateClosureSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        })
        for (const retiredValue of [
          'node scripts/accept-rc6-declaration-input.mjs',
          'PASS_ACCEPTED_INPUT',
          'PASS_OFFLINE_INSTALL',
        ]) expect(serialized).not.toContain(retiredValue)
        expect(serialized).not.toContain(fixture.workspaceRoot)
        expect(serialized).not.toMatch(/(?:\/Users\/|\/private\/|file:|[A-Za-z]:[\\/])/)
        expect(after).toBe(before)
        await expect(stat(resolve(fixture.workspaceRoot, '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json')))
          .rejects.toMatchObject({ code: 'ENOENT' })
        expect(fixture.replayEvidence.calls).toHaveLength(5)
        const [beforeVersion, npmCi, hostCompile, clientCompile, afterVersion] = fixture.replayEvidence.calls
        expect(beforeVersion).toEqual({
          file: beforeVersion.file,
          args: [fixture.fakeNpmCliPath, '--version'],
          env: {},
          cwd: null,
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
        })
        expect(afterVersion).toEqual({
          file: beforeVersion.file,
          args: [fixture.fakeNpmCliPath, '--version'],
          env: {},
          cwd: null,
          timeout: 30_000,
          maxBuffer: 1024 * 1024,
        })
        const replayRoot = npmCi.args.find((value: string) => value.startsWith('--prefix='))
          ?.slice('--prefix='.length) ?? ''
        expect(replayRoot).not.toBe('')
        expect(npmCi).toEqual({
          file: beforeVersion.file,
          args: [
          fixture.fakeNpmCliPath,
          'ci',
          '--ignore-scripts',
          '--offline',
          '--audit=false',
          '--fund=false',
          '--update-notifier=false',
          `--cache=${fixture.selectedSourceBundleRoot}`,
          `--prefix=${replayRoot}`,
          `--logs-dir=${resolve(replayRoot, '.logs')}`,
          `--userconfig=${resolve(replayRoot, 'user.npmrc')}`,
          `--globalconfig=${resolve(replayRoot, 'global.npmrc')}`,
          ],
          env: { HOME: resolve(replayRoot, '.home'), TMPDIR: resolve(replayRoot, '.tmp') },
          cwd: replayRoot,
          timeout: 120_000,
          maxBuffer: 10 * 1024 * 1024,
        })
        for (const [call, config] of [
          [hostCompile, 'tsconfig.surface.host.json'],
          [clientCompile, 'tsconfig.surface.client.overlay.json'],
        ] as const) {
          expect(call).toEqual({
            file: beforeVersion.file,
            args: [
            resolve(replayRoot, '.compiler/node_modules/typescript/bin/tsc'),
            '-p',
            resolve(replayRoot, config),
            '--noEmit',
            '--types',
            'node',
            '--typeRoots',
            resolve(replayRoot, '.compiler/node_modules/@types'),
            '--listFiles',
            '--pretty',
            'false',
            ],
            env: { HOME: resolve(replayRoot, '.home'), TMPDIR: resolve(replayRoot, '.tmp') },
            cwd: replayRoot,
            timeout: 60_000,
            maxBuffer: 10 * 1024 * 1024,
          })
        }
        for (const call of fixture.replayEvidence.calls) {
          expect(call.env).not.toHaveProperty('NODE_OPTIONS')
          expect(call.env).not.toHaveProperty('NODE_PATH')
          expect(call.env).not.toHaveProperty('npm_config_registry')
          expect(call.env).not.toHaveProperty('npm_package_name')
          expect(call.env).not.toHaveProperty('INIT_CWD')
          expect(call.env).not.toHaveProperty('HTTPS_PROXY')
          expect(call.env).not.toHaveProperty('TOKEN')
        }
      } finally {
        for (const [key, value] of Object.entries(dangerousEnvironment)) {
          if (value === undefined) delete process.env[key]
          else process.env[key] = value
        }
      }
    })
  }, 30_000)

  test('B2b synthetic publisher seam produces one canonical, independently checkable proposal and adopts it on retry', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      const before = await fixture.snapshotCommittedEvidence()
      const first = await fixture.stageV2Proposal()
      expect(first).toMatchObject({
        status: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
        replayStatus: 'PASS_STAGED_REPLAY',
        publicationStatus: 'PUBLISHED',
      })

      const pointerPath = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      )
      const pointerBytes = await readFile(pointerPath)
      const pointer = JSON.parse(pointerBytes.toString('utf8'))
      expect(pointerBytes.toString('utf8')).toBe(
        `${acceptance.canonicalJsonBytes(pointer)}\n`,
      )
      expect(await lstat(pointerPath)).toMatchObject({ nlink: 1 })

      const bundleRoot = resolve(
        dirname(pointerPath),
        pointer.bundleRelativePath,
      )
      const [inputManifestBytes, receiptBytes, closureBytes] = await Promise.all([
        readFile(resolve(bundleRoot, 'input-manifest.v2.json')),
        readFile(resolve(bundleRoot, 'receipt.json')),
        readFile(resolve(bundleRoot, 'rc6-declaration-closure.v2.json')),
      ])
      const inputManifest = JSON.parse(inputManifestBytes.toString('utf8'))
      const receipt = JSON.parse(receiptBytes.toString('utf8'))
      const closure = JSON.parse(closureBytes.toString('utf8'))
      expect(inputManifestBytes.toString('utf8')).toBe(
        `${acceptance.canonicalJsonBytes(inputManifest)}\n`,
      )
      expect(inputManifest.proposalStage).toEqual({
        command: 'stageRc6DeclarationInputV2({ workspaceRoot })',
        result: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
      })
      expect(inputManifest).not.toHaveProperty('acceptance')
      for (const retiredValue of [
        'node scripts/accept-rc6-declaration-input.mjs',
        'PASS_ACCEPTED_INPUT',
        'PASS_OFFLINE_INSTALL',
      ]) expect(JSON.stringify(inputManifest)).not.toContain(retiredValue)
      expect(receiptBytes.toString('utf8')).toBe(
        `${acceptance.canonicalJsonBytes(receipt)}\n`,
      )
      expect(Object.keys(receipt).sort()).toEqual([
        'acceptanceSourceSha256',
        'closureSha256',
        'compilePolicySha256',
        'compileResults',
        'compilerSealedAggregateSha256',
        'compilerResultSha256',
        'compilerSourceAggregateSha256',
        'inputManifestSha256',
        'npmPolicySha256',
        'ownerMarker',
        'payload',
        'payloadIdentitySha256',
        'result',
        'runtime',
        'schemaVersion',
        'selectedSourcePayloadIdentitySha256',
        'selectedSourcePointerSha256',
        'selectedSourceReceiptSha256',
        'verifierResultSha256',
        'verifierSourceSha256',
      ].sort())
      const verifierIdentity = {
        status: 'PASS_STAGED_REPLAY',
        realpathsWithinStagingRoot: true,
        storageSelectedOrImported: false,
        fullDeepseekCount: closure.fullDeepseekCohort.length,
        selectedDeclarationCount: closure.selectedDeclarationSubgraph.records.length,
        verifierClosureSha256: createHash('sha256').update(acceptance.canonicalJsonBytes({
          fullDeepseekCohort: closure.fullDeepseekCohort,
          selectedDeclarationSubgraph: closure.selectedDeclarationSubgraph,
        })).digest('hex'),
        selectedDeclarationManifestsSha256: createHash('sha256').update(
          acceptance.canonicalJsonBytes(closure.selectedDeclarationSubgraph.records),
        ).digest('hex'),
      }
      expect(receipt.verifierResultSha256).toBe(
        createHash('sha256')
          .update(acceptance.canonicalJsonBytes(verifierIdentity))
          .digest('hex'),
      )
      expect(receipt.compileResults).toEqual({
        host: {
          surface: 'host',
          contractRelativePath: hostContractRelativePath,
          relativeFileCount: 1,
          relativeFileListSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          realpathsWithinReplayRoot: true,
          contractListed: true,
          storageDeclarationFilesListed: false,
        },
        client: {
          surface: 'client',
          contractRelativePath: clientContractRelativePath,
          relativeFileCount: 1,
          relativeFileListSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
          realpathsWithinReplayRoot: true,
          contractListed: true,
          storageDeclarationFilesListed: false,
        },
      })
      expect(receipt.compileResults.host.relativeFileListSha256).toBe(
        createHash('sha256')
          .update(acceptance.canonicalJsonBytes([hostContractRelativePath]))
          .digest('hex'),
      )
      expect(receipt.compileResults.client.relativeFileListSha256).toBe(
        createHash('sha256')
          .update(acceptance.canonicalJsonBytes([clientContractRelativePath]))
          .digest('hex'),
      )
      expect(receipt.compilerResultSha256).toBe(
        createHash('sha256')
          .update(acceptance.canonicalJsonBytes(receipt.compileResults))
          .digest('hex'),
      )
      expect(JSON.stringify({ first, pointer, receipt, closure }))
        .not.toMatch(/(?:\/Users\/|\/private\/|file:|[A-Za-z]:[\\/])/)

      const second = await fixture.stageV2Proposal()
      expect(second).toMatchObject({
        status: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
        publicationStatus: 'ADOPTED_EXISTING',
      })
      expect(await readFile(pointerPath)).toEqual(pointerBytes)
      expect((await lstat(pointerPath)).nlink).toBe(1)
      expect(await fixture.snapshotCommittedEvidence()).toBe(before)
    }, { publishSyntheticProposal: true })
  }, 60_000)

  test.skipIf(process.platform === 'win32')(
    'B2b proposal pointer publishes and remains adoptable under a strict process umask',
    async () => {
      const childScript = resolve(
        workspaceRoot,
        'tests/integration/helpers/rc6-strict-umask-proposal-child.mjs',
      )
      const { stdout, stderr } = await execFileAsync(
        process.execPath,
        ['--experimental-strip-types', childScript, workspaceRoot],
        {
          cwd: workspaceRoot,
          timeout: 60_000,
          maxBuffer: 1024 * 1024,
        },
      )
      expect(stderr).toBe('')
      const evidence = JSON.parse(stdout)
      expect(evidence).toEqual({
        strictUmask: '0077',
        firstPublicationStatus: 'PUBLISHED',
        firstPointer: {
          mode: 0o400,
          nlink: '1',
          sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        },
        secondPublicationStatus: 'ADOPTED_EXISTING',
        finalPointer: {
          mode: 0o400,
          nlink: '1',
          sha256: evidence.firstPointer.sha256,
          sameIdentity: true,
        },
      })
      expect(evidence.firstPointer.mode & 0o222).toBe(0)
      expect(evidence.finalPointer.mode & 0o222).toBe(0)
    },
    70_000,
  )

  test('B2b synthetic publisher seam converges concurrent producers onto one live proposal bundle', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      const before = await fixture.snapshotCommittedEvidence()
      const settlements = await Promise.allSettled([
        fixture.stageV2Proposal(),
        fixture.stageV2Proposal(),
      ])
      expect(settlements.every((entry) => entry.status === 'fulfilled')).toBe(true)
      const results = settlements.map((entry) => (
        entry.status === 'fulfilled' ? entry.value : undefined
      ))
      expect(results.map((result) => result?.publicationStatus).sort()).toEqual([
        'ADOPTED_EXISTING',
        'PUBLISHED',
      ])

      const pointerPath = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      )
      const pointer = JSON.parse(await readFile(pointerPath, 'utf8'))
      expect((await lstat(pointerPath)).nlink).toBe(1)
      const bundleParent = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal-bundles',
      )
      const names = await readdir(bundleParent)
      const liveBundles = names.filter((name) => /^bundle-[a-f0-9]{32}$/.test(name))
      expect(liveBundles).toEqual([basename(pointer.bundleRelativePath)])
      expect(await stat(resolve(bundleParent, liveBundles[0]))).toMatchObject({
        mode: expect.any(Number),
      })
      expect(await fixture.snapshotCommittedEvidence()).toBe(before)
    }, { publishSyntheticProposal: true })
  }, 60_000)

  test('B2b proposal publisher treats EEXIST reported after its real hardlink as its own publication', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      expect(fixture.armProposalLinkAfterSuccessAsEexist).toBeTypeOf('function')
      fixture.armProposalLinkAfterSuccessAsEexist?.()

      const result = await fixture.stageV2Proposal()
      expect(result).toMatchObject({
        status: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
        publicationStatus: 'PUBLISHED',
      })
      expect(fixture.proposalFsFaultEvidence).toMatchObject({
        injectedLinkAfterSuccessAsEexist: true,
      })

      const pointerPath = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      )
      const pointer = JSON.parse(await readFile(pointerPath, 'utf8'))
      expect((await lstat(pointerPath)).nlink).toBe(1)
      await expect(stat(resolve(dirname(pointerPath), pointer.bundleRelativePath)))
        .resolves.toMatchObject({ mode: expect.any(Number) })
      expect((await readdir(dirname(pointerPath))).filter(
        (name) => /^\.rc6-declaration-v2-proposal-[a-f0-9]{32}\.tmp$/.test(name),
      )).toEqual([])
    }, {
      publishSyntheticProposal: true,
      enableProposalFsFaultSeam: true,
    })
  }, 60_000)

  test('B2b proposal publisher treats an independently copied same-byte pointer followed by EEXIST as its own publication', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      expect(fixture.armProposalIndependentPointerCopyAsEexist).toBeTypeOf('function')
      fixture.armProposalIndependentPointerCopyAsEexist?.()

      const result = await fixture.stageV2Proposal()
      expect(result).toMatchObject({
        status: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
        publicationStatus: 'PUBLISHED',
      })
      expect(fixture.proposalFsFaultEvidence).toMatchObject({
        injectedIndependentPointerCopyAsEexist: true,
        independentPointerHasDifferentInode: true,
      })

      const pointerPath = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      )
      const pointer = JSON.parse(await readFile(pointerPath, 'utf8'))
      expect((await lstat(pointerPath)).nlink).toBe(1)
      await expect(stat(resolve(dirname(pointerPath), pointer.bundleRelativePath)))
        .resolves.toMatchObject({ mode: expect.any(Number) })
      expect((await readdir(dirname(pointerPath))).filter(
        (name) => /^\.rc6-declaration-v2-proposal-[a-f0-9]{32}\.tmp$/.test(name),
      )).toEqual([])
    }, {
      publishSyntheticProposal: true,
      enableProposalFsFaultSeam: true,
    })
  }, 60_000)

  test('B2b proposal publisher reports an uncertain commit when its first post-link boundary check fails and recovers by adoption', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      expect(fixture.armProposalBoundaryFailureAfterSuccessfulLink).toBeTypeOf('function')
      fixture.armProposalBoundaryFailureAfterSuccessfulLink?.()

      let firstError: unknown
      try {
        await fixture.stageV2Proposal()
      } catch (error) {
        firstError = error
      }
      expect(fixture.proposalFsFaultEvidence).toMatchObject({
        successfulLinkBeforeBoundaryFailure: true,
        injectedBoundaryFailureAfterSuccessfulLink: true,
      })

      const pointerPath = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      )
      const firstPointerBytes = await readFile(pointerPath)
      const pointer = JSON.parse(firstPointerBytes.toString('utf8'))
      const bundleRoot = resolve(dirname(pointerPath), pointer.bundleRelativePath)
      await expect(stat(bundleRoot)).resolves.toMatchObject({ mode: expect.any(Number) })
      expect((await lstat(pointerPath)).nlink).toBeGreaterThanOrEqual(1)

      const recovered = await fixture.stageV2Proposal()
      expect(recovered).toMatchObject({
        status: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
        publicationStatus: 'ADOPTED_EXISTING',
      })
      expect(await readFile(pointerPath)).toEqual(firstPointerBytes)
      expect((await lstat(pointerPath)).nlink).toBe(1)
      await expect(stat(bundleRoot)).resolves.toMatchObject({ mode: expect.any(Number) })
      expect((await readdir(dirname(pointerPath))).filter(
        (name) => /^\.rc6-declaration-v2-proposal-[a-f0-9]{32}\.tmp$/.test(name),
      )).toEqual([])

      expect(firstError).toMatchObject({ code: 'PROPOSAL_COMMIT_UNCERTAIN' })
    }, {
      publishSyntheticProposal: true,
      enableProposalFsFaultSeam: true,
    })
  }, 60_000)

  test('B2b proposal publisher preserves a real link when both its wrapper and first post-link boundary check fail', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      expect(fixture.armProposalLinkEioAndBoundaryFailureAfterSuccess).toBeTypeOf('function')
      fixture.armProposalLinkEioAndBoundaryFailureAfterSuccess?.()

      let firstError: unknown
      try {
        await fixture.stageV2Proposal()
      } catch (error) {
        firstError = error
      }
      expect(firstError).toMatchObject({ code: 'PROPOSAL_COMMIT_UNCERTAIN' })
      expect(fixture.proposalFsFaultEvidence).toMatchObject({
        successfulLinkBeforeBoundaryFailure: true,
        injectedLinkEioAfterSuccess: true,
        injectedBoundaryFailureAfterSuccessfulLink: true,
      })

      const pointerPath = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      )
      const firstPointerBytes = await readFile(pointerPath)
      const pointer = JSON.parse(firstPointerBytes.toString('utf8'))
      const bundleRoot = resolve(dirname(pointerPath), pointer.bundleRelativePath)
      await expect(stat(bundleRoot)).resolves.toMatchObject({ mode: expect.any(Number) })
      expect((await lstat(pointerPath)).nlink).toBe(2)
      expect((await readdir(dirname(pointerPath))).filter(
        (name) => /^\.rc6-declaration-v2-proposal-[a-f0-9]{32}\.tmp$/.test(name),
      )).toHaveLength(1)

      const recovered = await fixture.stageV2Proposal()
      expect(recovered).toMatchObject({
        status: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
        publicationStatus: 'ADOPTED_EXISTING',
      })
      expect(await readFile(pointerPath)).toEqual(firstPointerBytes)
      expect((await lstat(pointerPath)).nlink).toBe(1)
      await expect(stat(bundleRoot)).resolves.toMatchObject({ mode: expect.any(Number) })
      expect((await readdir(dirname(pointerPath))).filter(
        (name) => /^\.rc6-declaration-v2-proposal-[a-f0-9]{32}\.tmp$/.test(name),
      )).toEqual([])
    }, {
      publishSyntheticProposal: true,
      enableProposalFsFaultSeam: true,
    })
  }, 60_000)

  test('B2b proposal pointer convergence accepts an ENOENT race after another producer removes its alias', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      await fixture.stageV2Proposal()
      const pointerPath = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      )
      const aliasPath = resolve(
        dirname(pointerPath),
        '.rc6-declaration-v2-proposal-11111111111111111111111111111111.tmp',
      )
      await link(pointerPath, aliasPath)
      expect((await lstat(pointerPath)).nlink).toBe(2)
      expect(fixture.armProposalAliasUnlinkAsEnoent).toBeTypeOf('function')
      fixture.armProposalAliasUnlinkAsEnoent?.()

      const result = await fixture.stageV2Proposal()
      expect(result).toMatchObject({
        status: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
        publicationStatus: 'ADOPTED_EXISTING',
      })
      expect(fixture.proposalFsFaultEvidence).toMatchObject({
        injectedAliasUnlinkAsEnoent: true,
      })
      await expect(stat(aliasPath)).rejects.toMatchObject({ code: 'ENOENT' })
      expect((await lstat(pointerPath)).nlink).toBe(1)
      const pointer = JSON.parse(await readFile(pointerPath, 'utf8'))
      await expect(stat(resolve(dirname(pointerPath), pointer.bundleRelativePath)))
        .resolves.toMatchObject({ mode: expect.any(Number) })
    }, {
      publishSyntheticProposal: true,
      enableProposalFsFaultSeam: true,
    })
  }, 60_000)

  test('B2b bootstrap rejects verifier source bytes outside the pinned implementation', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      await expect(fixture.stageV2Proposal()).rejects.toMatchObject({
        code: 'VERIFIER_SOURCE_MISMATCH',
      })
      await expect(stat(resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      ))).rejects.toMatchObject({ code: 'ENOENT' })
    }, {
      verifierSourceTransform: (source) => `${source}\n// harmless but untrusted verifier drift\n`,
    })
  }, 30_000)

  test('B2b bootstrap rejects acceptance source drift after module import before copied code can execute', async () => {
    const sentinel = '__dshAcceptanceSourceDriftExecuted'
    delete (globalThis as Record<string, unknown>)[sentinel]
    try {
      await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
        await fixture.mutateAcceptanceSourceAfterImport((source) => (
          `${source}\nglobalThis.${sentinel} = true\n`
        ))
        await expect(fixture.stageV2Proposal()).rejects.toMatchObject({
          code: 'VERIFIER_SOURCE_MISMATCH',
        })
        expect((globalThis as Record<string, unknown>)[sentinel]).toBeUndefined()
        await expect(stat(resolve(
          fixture.workspaceRoot,
          '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
        ))).rejects.toMatchObject({ code: 'ENOENT' })
      })
    } finally {
      delete (globalThis as Record<string, unknown>)[sentinel]
    }
  }, 30_000)

  test('B2b bootstrap rejects a byte-identical verifier inode replacement after preflight', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      fixture.replaceCommittedFileWithSameBytesAfterReplay(resolve(
        fixture.workspaceRoot,
        'scripts/verify-rc6-declaration-closure.mjs',
      ))
      await expect(fixture.stageV2Proposal()).rejects.toMatchObject({
        code: 'VERIFIER_SOURCE_MISMATCH',
      })
      await expect(stat(resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      ))).rejects.toMatchObject({ code: 'ENOENT' })
    })
  }, 30_000)

  test('B2b bootstrap publishes neither proposal when the injected replay seam fails', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      const before = await fixture.snapshotCommittedEvidence()
      fixture.failNextReplay()
      await expect(fixture.stageV2Proposal()).rejects.toMatchObject({ code: 'OFFLINE_REPLAY_FAILED' })
      expect(await fixture.snapshotCommittedEvidence()).toBe(before)
      await expect(stat(resolve(fixture.workspaceRoot, '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json')))
        .rejects.toMatchObject({ code: 'ENOENT' })
    })
  }, 30_000)

  test('B2b bootstrap publishes neither proposal when declaration compilation fails', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      const before = await fixture.snapshotCommittedEvidence()
      fixture.failNextCompile()

      await expect(fixture.stageV2Proposal()).rejects.toMatchObject({
        code: 'DECLARATION_COMPILE_FAILED',
      })

      expect(fixture.historicalInputsIsolated).toBe(true)
      expect(fixture.replayEvidence.calls).toHaveLength(3)
      expect(fixture.replayEvidence.calls[0].args).toEqual([
        fixture.fakeNpmCliPath,
        '--version',
      ])
      expect(fixture.replayEvidence.calls[1].args[1]).toBe('ci')
      expect(fixture.replayEvidence.calls[2].args[0]).toBe(
        resolve(
          fixture.replayEvidence.calls[1].cwd ?? '',
          '.compiler/node_modules/typescript/bin/tsc',
        ),
      )
      expect(await fixture.snapshotCommittedEvidence()).toBe(before)
      await expect(stat(resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      ))).rejects.toMatchObject({ code: 'ENOENT' })
    })
  }, 30_000)

  test('B2b bootstrap rejects a byte-identical client overlay inode replacement during compile', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      const before = await fixture.snapshotCommittedEvidence()
      fixture.replaceClientOverlayWithSameBytesOnNextCompile()

      await expect(fixture.stageV2Proposal()).rejects.toMatchObject({
        code: 'COMPILER_PATH_CONTAINMENT',
      })

      expect(fixture.replayEvidence.calls).toHaveLength(4)
      expect(fixture.replayEvidence.calls[3].args[2]).toBe(
        resolve(
          fixture.replayEvidence.calls[1].cwd ?? '',
          'tsconfig.surface.client.overlay.json',
        ),
      )
      expect(await fixture.snapshotCommittedEvidence()).toBe(before)
      await expect(stat(resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      ))).rejects.toMatchObject({ code: 'ENOENT' })
    })
  }, 30_000)

  test('B2b bootstrap rejects a byte-identical committed evidence inode replacement', async () => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      const before = await fixture.snapshotCommittedEvidence()
      fixture.replaceCommittedFileWithSameBytesAfterReplay(resolve(
        fixture.workspaceRoot,
        'tools/harness-rc6-declarations/input-manifest.json',
      ))

      await expect(fixture.stageV2Proposal()).rejects.toMatchObject({
        code: 'COMMITTED_EVIDENCE_CHANGED',
      })

      expect(await fixture.snapshotCommittedEvidence()).toBe(before)
      await expect(stat(resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      ))).rejects.toMatchObject({ code: 'ENOENT' })
    })
  }, 30_000)

  test.each([
    ['status', (source: string) => source.replace(
      "return {\n    status: 'PASS_STAGED_REPLAY',",
      "return {\n    status: 'FAIL_SYNTHETIC_VERIFIER',",
    )],
    ['realpath locality', (source: string) => source.replace(
      'realpathsWithinStagingRoot: true,',
      'realpathsWithinStagingRoot: false,',
    )],
    ['storage selection', (source: string) => source.replace(
      "realpathsWithinStagingRoot: true,\n    storage,",
      "realpathsWithinStagingRoot: true,\n    storage: { selectedOrImported: true },",
    )],
    ['selected manifests', (source: string) => source.replace(
      'selectedDeclarationManifests: closure.selectedDeclarationSubgraph.records,\n    realpathsWithinStagingRoot: true,',
      'selectedDeclarationManifests: [],\n    realpathsWithinStagingRoot: true,',
    )],
  ])('B2b bootstrap rejects a non-success verifier %s result before proposal publication', async (_label, transform) => {
    await withSynthetic169BootstrapProductionPath(workspaceRoot, async (fixture) => {
      await expect(fixture.stageV2Proposal()).rejects.toMatchObject({
        code: 'STAGED_REPLAY_VERIFICATION_FAILED',
      })
      await expect(stat(resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      ))).rejects.toMatchObject({ code: 'ENOENT' })
    }, { verifierSourceTransform: transform, trustVerifierTransform: true })
  }, 30_000)

  test('rejects the retired acceptance writer without observing caller input or creating a missing workspace temp path', async () => {
    const root = await mkdtemp(resolve(tmpdir(), 'rc6-retired-acceptance-writer-'))
    const missingWorkspace = resolve(root, 'missing-workspace')
    const explosiveInput = new Proxy({}, {
      get() {
        throw new Error('caller input must remain unobserved')
      },
    })

    try {
      await expect(stat(missingWorkspace)).rejects.toMatchObject({ code: 'ENOENT' })
      const proxyOutcome = await acceptance.acceptRc6DeclarationInput(explosiveInput).then(
        () => 'RESOLVED',
        (error) => error,
      )
      const missingWorkspaceOutcome = await acceptance.acceptRc6DeclarationInput({ workspaceRoot: missingWorkspace }).then(
        () => 'RESOLVED',
        (error) => error,
      )

      await expect(stat(missingWorkspace)).rejects.toMatchObject({ code: 'ENOENT' })
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(proxyOutcome).toMatchObject({
        code: 'LEGACY_ACCEPT_DISABLED',
      })
      expect(missingWorkspaceOutcome).toMatchObject({
        code: 'LEGACY_ACCEPT_DISABLED',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each([
    { label: 'empty', argv: [] },
    { label: 'verify-and-compile', argv: ['--verify-and-compile'] },
    { label: 'replay-arbitrary-path', argv: ['--replay-arbitrary-path'] },
    { label: 'help', argv: ['--help'] },
    { label: 'unknown', argv: ['--unknown'] },
  ])('rejects retired acceptance CLI argv $label with fixed policy JSON only', async ({ argv }) => {
    const root = await createAcceptanceCliFixture()
    try {
      const before = await fixtureFingerprint(root)
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
      const outcome = await runFixtureCli(root, argv).then(
        () => 'RESOLVED',
        (error) => error,
      )
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await fixtureFingerprint(root)).toBe(before)
      expect(outcome).toMatchObject({
        code: 1,
        stdout: `${JSON.stringify({
          status: 'FAIL_INPUT_POLICY',
          reasonCode: 'LEGACY_ACCEPT_DISABLED',
        }, null, 2)}\n`,
        stderr: '',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test.each([
    { label: 'empty', argv: [] },
    { label: 'verify-and-compile', argv: ['--verify-and-compile'] },
    { label: 'replay-arbitrary-path', argv: ['--replay-arbitrary-path'] },
    { label: 'help', argv: ['--help'] },
    { label: 'unknown', argv: ['--unknown'] },
  ])('runs retired acceptance CLI through a differently named symlink for argv $label', async ({ argv }) => {
    const root = await createAcceptanceCliFixture()
    const alias = resolve(root, 'scripts/retired-acceptance-alias.mjs')
    try {
      await symlink('accept-rc6-declaration-input.mjs', alias)
      const before = await fixtureFingerprint(root)
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
      const outcome = await execFileAsync(process.execPath, [alias, ...argv], { cwd: root }).then(
        () => 'RESOLVED',
        (error) => error,
      )
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await fixtureFingerprint(root)).toBe(before)
      expect(outcome).toMatchObject({
        code: 1,
        stdout: `${JSON.stringify({
          status: 'FAIL_INPUT_POLICY',
          reasonCode: 'LEGACY_ACCEPT_DISABLED',
        }, null, 2)}\n`,
        stderr: '',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('does not execute retired acceptance main when a same-basename driver imports the copied implementation', async () => {
    const root = await createAcceptanceCliFixture()
    const driver = resolve(root, 'scripts/accept-rc6-declaration-input.mjs')
    const implementation = resolve(root, 'scripts/retired-acceptance-implementation.mjs')
    try {
      await rename(driver, implementation)
      await writeFile(driver, "await import('./retired-acceptance-implementation.mjs')\n", 'utf8')
      const before = await fixtureFingerprint(root)
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
      const outcome = await execFileAsync(process.execPath, [driver], { cwd: root })
      await expect(stat(resolve(root, '.tmp'))).rejects.toMatchObject({ code: 'ENOENT' })
      expect(await fixtureFingerprint(root)).toBe(before)
      expect(outcome).toEqual({ stdout: '', stderr: '' })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('derives a complete ASCII/UTF-8 ordered lock projection and validates an exact staged-proposal v2 snapshot', async () => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const projection = acceptance.deriveCanonicalLockInput(packageJson, packageLock)
    const input = makeSyntheticV2Input({ currentInput, packageLock })

    expect(projection.entries).toHaveLength(169)
    expect(projection.expected).toEqual({
      count: 169,
      totalBytes: 9_590_214,
      uniqueIndexFileCount: 169,
      uniqueContentFileCount: 169,
    })
    expect(projection.entries.map((entry: { lockPath: string }) => entry.lockPath)).toEqual(
      [...projection.entries.map((entry: { lockPath: string }) => entry.lockPath)].sort((left, right) =>
        Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8')),
      ),
    )
    expect(input.proposalStage).toEqual({
      command: 'stageRc6DeclarationInputV2({ workspaceRoot })',
      result: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
    })
    expect(input).not.toHaveProperty('acceptance')
    expect(() =>
      acceptance.validateInputManifest({
        inputManifest: input,
        packageJson,
        packageLock,
        rootPackageLock,
      }),
    ).not.toThrow()
  })

  test.each([
    ['retired top-level acceptance claim', (input: Record<string, any>) => {
      input.acceptance = {
        command: 'node scripts/accept-rc6-declaration-input.mjs',
        result: 'PASS_OFFLINE_INSTALL',
      }
    }, 'SCHEMA_KEY_MISMATCH'],
    ['retired acceptance CLI command', (input: Record<string, any>) => {
      input.proposalStage.command = 'node scripts/accept-rc6-declaration-input.mjs'
    }, 'PROPOSAL_STAGE_RESULT_MISMATCH'],
    ['retired accepted-input result', (input: Record<string, any>) => {
      input.proposalStage.result = 'PASS_ACCEPTED_INPUT'
    }, 'PROPOSAL_STAGE_RESULT_MISMATCH'],
    ['retired offline-install result', (input: Record<string, any>) => {
      input.proposalStage.result = 'PASS_OFFLINE_INSTALL'
    }, 'PROPOSAL_STAGE_RESULT_MISMATCH'],
    ['missing proposal-stage command', (input: Record<string, any>) => {
      delete input.proposalStage.command
    }, 'SCHEMA_KEY_MISMATCH'],
    ['extra proposal-stage key', (input: Record<string, any>) => {
      input.proposalStage.extra = true
    }, 'SCHEMA_KEY_MISMATCH'],
  ])('rejects %s from the exact staged-proposal schema', async (_label, mutate, code) => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const input = makeSyntheticV2Input({ currentInput, packageLock })
    mutate(input)

    expect(() => acceptance.validateInputManifest({ inputManifest: input, packageJson, packageLock, rootPackageLock }))
      .toThrow(expect.objectContaining({ code }))
  })

  test('B2b v2 identity keeps only the seven logical selected-entry fields and excludes physical index checksums', async () => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const input = makeSyntheticV2Input({ currentInput, packageLock })
    expect(input.selectedCache.entries).toHaveLength(169)
    expect(input.selectedCache.entries.every((entry: any) => (
      Object.keys(entry).sort().join(',') === 'byteLength,contentDigest,integrity,key,lockPath,name,version'
      && !Object.hasOwn(entry, 'indexChecksum')
    ))).toBe(true)
    expect(input.selectedCacheIndexSha256).toBe('73e76d127ab8188d8005e4becb750bbe9cfec30988e501185b13558f4c6cd3f6')
    expect(input.selectedContentAggregateSha256).toBe('3a8c2e3ba2bb7e07d3cc51212e9ae3dd4925e522d9c9c87acac16fee122757dc')
    expect(() => acceptance.validateInputManifest({ inputManifest: input, packageJson, packageLock, rootPackageLock })).not.toThrow()
  })

  test.each([
    ['forged package JSON top-level field', (_lock: any, packageJson: any) => { packageJson.forged = true }],
    ['forged package-lock top-level field', (lock: any) => { lock.forged = true }],
    ['forged root lock name', (lock: any) => { lock.packages[''].name = 'forged' }],
    ['storage package in package and root dependencies', (lock: any, packageJson: any) => { packageJson.dependencies = { '@deepseek-ai/dsh-storage-domain': '0.1.0-rc.6' }; lock.packages[''].dependencies = { '@deepseek-ai/dsh-storage-domain': '0.1.0-rc.6' } }],
    ['storage package in optional dependencies', (lock: any) => { lock.packages[''].optionalDependencies = { '@deepseek-ai/dsh-storage-domain': '0.1.0-rc.6' } }],
    ['unprojected non-root dependency metadata', (lock: any) => { lock.packages['node_modules/@deepseek-ai/cordis'].dependencies.forged = '1.0.0' }],
    ['rc.8 declaration record', (lock: any) => { lock.packages['node_modules/@deepseek-ai/dsh-agent'].version = '0.1.0-rc.8' }],
    ['commander 9 nested record', (lock: any) => { lock.packages['node_modules/katex/node_modules/commander'].version = '9.0.0' }],
    ['storage root', (lock: any, packageJson: any) => { packageJson.devDependencies['@deepseek-ai/dsh-storage-domain'] = '0.1.0-rc.6' }],
    ['unprojected root metadata', (lock: any) => { lock.packages[''].devDependencies.extra = '1.0.0' }],
  ])('rejects lock-derived projection with %s', async (_label, mutate) => {
    const [packageJson, packageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
    ])
    const changed = structuredClone(packageLock)
    const changedPackageJson = structuredClone(packageJson)
    mutate(changed, changedPackageJson)
    expect(() => acceptance.deriveCanonicalLockInput(changedPackageJson, changed)).toThrow()
  })

  test.each([
    ['name', 'forged-name'],
    ['version', '9.9.9'],
    ['key', 'make-fetch-happen:request-cache:https://registry.npmjs.org/forged.tgz'],
    ['integrity', 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='],
    ['contentDigest', 'sha512-AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=='],
    ['lockPath', 'node_modules/forged'],
  ])('rejects a forged lock-derived entry %s', async (field, value) => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const input = makeSyntheticV2Input({ currentInput, packageLock })
    ;(input.selectedCache.entries[0] as Record<string, unknown>)[field] = value

    expect(() =>
      acceptance.validateInputManifest({ inputManifest: input, packageJson, packageLock, rootPackageLock }),
    ).toThrow()
  })

  test.each(['duplicate', 'missing', 'extra'])('rejects a %s selected-cache entry', async (kind) => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const input = makeSyntheticV2Input({ currentInput, packageLock })
    if (kind === 'duplicate') input.selectedCache.entries.splice(1, 0, structuredClone(input.selectedCache.entries[0]))
    if (kind === 'missing') input.selectedCache.entries.pop()
    if (kind === 'extra') input.selectedCache.entries.push(structuredClone(input.selectedCache.entries[0]))

    expect(() =>
      acceptance.validateInputManifest({ inputManifest: input, packageJson, packageLock, rootPackageLock }),
    ).toThrow()
  })

  test.each([
    ['byteLength', 1],
  ])('binds acceptance-derived %s to its frozen aggregate even after self-hash recomputation', async (field, value) => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const input = makeSyntheticV2Input({ currentInput, packageLock })
    ;(input.selectedCache.entries[0] as Record<string, unknown>)[field] = value
    Object.assign(input, acceptance.computeSelectedCacheHashes(input.selectedCache.entries))

    expect(() =>
      acceptance.validateInputManifest({ inputManifest: input, packageJson, packageLock, rootPackageLock }),
    ).toThrow()
  })

  test.each([
    ['extra top-level key', (input: Record<string, unknown>) => { input.extra = true }],
    ['extra entry key', (input: Record<string, unknown>) => { (input.selectedCache as { entries: Array<Record<string, unknown>> }).entries[0].extra = true }],
    ['legacy physical index checksum', (input: Record<string, unknown>) => { (input.selectedCache as { entries: Array<Record<string, unknown>> }).entries[0].indexChecksum = '0'.repeat(40) }],
    ['absolute path field', (input: Record<string, unknown>) => { input.sourcePath = '/private/forged' }],
    ['file URL cache key', (input: Record<string, unknown>) => { (input.selectedCache as { entries: Array<Record<string, unknown>> }).entries[0].key = 'file:///forged' }],
  ])('rejects %s', async (_label, mutate) => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const input = makeSyntheticV2Input({ currentInput, packageLock })
    mutate(input)

    expect(() =>
      acceptance.validateInputManifest({ inputManifest: input, packageJson, packageLock, rootPackageLock }),
    ).toThrow()
  })

  test('reconstructs the frozen historical production boundary under a strict umask without a runtime git dependency', async () => {
    const [currentInput, packageJson, packageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
    ])
    const input = makeSyntheticV2Input({ currentInput, packageLock })
    const previousUmask = process.umask(0o077)
    let root: string
    try {
      root = await createBoundaryFixture()
    } finally {
      process.umask(previousUmask)
    }
    try {
      const boundary = await acceptance.validateProductionBoundary({ workspaceRoot: root, inputManifest: input })
      const historicalRootPackageLock = JSON.parse(
        await readFile(resolve(root, 'package-lock.json'), 'utf8'),
      )

      expect(boundary.files).toHaveLength(33)
      expect(() => acceptance.validateInputManifest({
        inputManifest: input,
        packageJson,
        packageLock,
        rootPackageLock: historicalRootPackageLock,
      })).not.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  test('keeps the current Stage 2 workspace outside the frozen historical boundary', async () => {
    const [currentInput, packageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
    ])

    const boundaryError = await acceptance.validateProductionBoundary({
      workspaceRoot,
      inputManifest: makeSyntheticV2Input({ currentInput, packageLock }),
    }).then(
      () => undefined,
      (error: unknown) => error,
    )
    expect(boundaryError).toBeInstanceOf(Error)
    expect([
      'PRODUCTION_BOUNDARY_FILE_LIST_MISMATCH',
      'PRODUCTION_BOUNDARY_HASH_MISMATCH',
    ]).toContain((boundaryError as { code?: unknown }).code)
  })

  test.each([
    ['noncanonical selected-cache order', (input: Record<string, any>) => { [input.selectedCache.entries[0], input.selectedCache.entries[1]] = [input.selectedCache.entries[1], input.selectedCache.entries[0]] }],
    ['same-count duplicate plus omission', (input: Record<string, any>) => { input.selectedCache.entries[1] = structuredClone(input.selectedCache.entries[0]) }],
    ['recomputed self-hash forged name', (input: Record<string, any>) => { input.selectedCache.entries[0].name = 'forged'; Object.assign(input, acceptance.computeSelectedCacheHashes(input.selectedCache.entries)) }],
    ['missing nested root-package key', (input: Record<string, any>) => { delete input.acceptedRootPackage.private }],
    ['extra runtime key', (input: Record<string, any>) => { input.runtime.node.path = 'node' }],
    ['wrong selected-cache type', (input: Record<string, any>) => { input.selectedCache.totalBytes = '9590214' }],
    ['wrong lockfile version', (input: Record<string, any>) => { input.lockfileVersion = 2 }],
    ['wrong package count', (input: Record<string, any>) => { input.packageCounts.registry = 168 }],
    ['wrong nested commander', (input: Record<string, any>) => { input.nestedCommander.version = '9.0.0' }],
    ['storage-root leakage', (input: Record<string, any>) => { input.storageRoot = '/private/cache' }],
    ['windows path leakage', (input: Record<string, any>) => { input.runtime.node.basename = 'C:\\cache\\node' }],
    ['unc path leakage', (input: Record<string, any>) => { input.runtime.node.basename = '\\\\host\\cache' }],
    ['home path leakage', (input: Record<string, any>) => { input.runtime.node.basename = '~/cache' }],
    ['extra toolchain key', (input: Record<string, any>) => { input.compilerToolchain.extra = true }],
    ['production-boundary changed manifest', (input: Record<string, any>) => { input.productionBoundary.files[0].sha256 = '0'.repeat(64) }],
  ])('rejects %s in the v2 static metadata model', async (_label, mutate) => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const input = structuredClone(makeSyntheticV2Input({ currentInput, packageLock }))
    mutate(input)
    expect(() => acceptance.validateInputManifest({ inputManifest: input, packageJson, packageLock, rootPackageLock })).toThrow()
  })

  test.each([
    ['forged label', (input: any) => { input.inputLabel = 'forged' }],
    ['forged authorization', (input: any) => { input.authorizationBasis = 'forged' }],
    ['forged node hash', (input: any) => { input.runtime.node.sha256 = '0'.repeat(64) }],
    ['forged npm hash', (input: any) => { input.runtime.npm.cliSha256 = '0'.repeat(64) }],
    ['traversal basename', (input: any) => { input.runtime.node.basename = '../node' }],
    ['embedded home path', (input: any) => { input.authorizationBasis = 'owner /home/user evidence' }],
  ])('rejects pinned metadata with %s', async (_label, mutate) => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const input = makeSyntheticV2Input({ currentInput, packageLock })
    mutate(input)
    expect(() => acceptance.validateInputManifest({ inputManifest: input, packageJson, packageLock, rootPackageLock })).toThrow()
  })

  test('rejects a changed root lock compiler-toolchain identity', async () => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const changedRootLock = structuredClone(rootPackageLock)
    changedRootLock.packages['node_modules/typescript'].integrity = 'sha512-forged'
    expect(() => acceptance.validateInputManifest({
      inputManifest: makeSyntheticV2Input({ currentInput, packageLock }), packageJson, packageLock, rootPackageLock: changedRootLock,
    })).toThrow()
  })

  test('rejects changed client compiler dependency metadata in the root lock', async () => {
    const [currentInput, packageJson, packageLock, rootPackageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
      readJson('package-lock.json'),
    ])
    const changedRootLock = structuredClone(rootPackageLock)
    changedRootLock.packages['node_modules/@types/react'].dependencies.csstype = '*'
    expect(() => acceptance.validateInputManifest({
      inputManifest: makeSyntheticV2Input({ currentInput, packageLock }),
      packageJson,
      packageLock,
      rootPackageLock: changedRootLock,
    })).toThrowError(expect.objectContaining({ code: 'ROOT_LOCK_TOOLCHAIN_MISMATCH' }))
  })

  test.each([
    ['changed source', async (root: string) => writeFile(resolve(root, 'packages/workbench/src/config.ts'), 'forged\n', 'utf8')],
    ['deleted source', async (root: string) => unlink(resolve(root, 'packages/workbench/src/config.ts'))],
    ['new untracked source', async (root: string) => writeFile(resolve(root, 'packages/workbench/src/forged.ts'), 'export {}\n', 'utf8')],
    ['changed root lock toolchain input', async (root: string) => writeFile(resolve(root, 'package-lock.json'), 'forged\n', 'utf8')],
  ])('rejects a production boundary with %s', async (_label, mutate) => {
    const [currentInput, packageJson, packageLock] = await Promise.all([
      readJson('tools/harness-rc6-declarations/input-manifest.json'),
      readJson('tools/harness-rc6-declarations/package.json'),
      readJson('tools/harness-rc6-declarations/package-lock.json'),
    ])
    const root = await createBoundaryFixture()
    try {
      await mutate(root)
      await expect(acceptance.validateProductionBoundary({
        workspaceRoot: root,
        inputManifest: makeSyntheticV2Input({ currentInput, packageLock }),
      })).rejects.toThrow()
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
