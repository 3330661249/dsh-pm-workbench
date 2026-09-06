import { createHash } from 'node:crypto'
import { constants as fsConstants } from 'node:fs'
import { lstat, open, readdir, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import {
  inspectCommittedDeclarationInput,
  validateInputManifest,
  validateProductionBoundary,
} from './accept-rc6-declaration-input.mjs'

const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const DEFAULT_WORKSPACE_ROOT = resolve(moduleDirectory, '..')
const ACCEPTED_ROOT_RELATIVE = '.tmp/dsh-pm-workbench/rc6-declarations/accepted'
const ACCEPTED_CACHE_RELATIVE = '.tmp/dsh-pm-workbench/declaration-input-cache'
const CLOSURE_RELATIVE = 'research/2026-09-05-rc6-declaration-closure.json'
const SELECTED_DECLARATION_ROOTS = [
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-ui-slots',
]
const NESTED_COMMANDER_PATH = 'node_modules/katex/node_modules/commander'
const INSTALLED_LOCK_DEPENDENCY_FIELDS = [
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
  'peerDependenciesMeta',
]
const ACCEPTED_CACHE_INDEX_MAX_BYTES = 8 * 1024 * 1024

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`)
  error.code = code
  throw error
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function canonicalDeepJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalDeepJson).join(',')}]`
  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalDeepJson(value[key])}`)
      .join(',')}}`
  }
  return JSON.stringify(value)
}

function canonicalDependencyField(manifest, field) {
  return canonicalDeepJson(Object.hasOwn(manifest, field) ? manifest[field] : {})
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function readJsonSnapshot(path, {
  code = 'INVALID_JSON_OBJECT',
  maximumBytes = 32 * 1024 * 1024,
  containmentRoot,
} = {}) {
  let handle
  try {
    const preflight = await lstat(path)
    if (!preflight.isFile() || preflight.isSymbolicLink()
      || preflight.nlink !== 1 || preflight.size > maximumBytes) {
      fail(code, 'json input')
    }
    handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK,
    )
    const before = await handle.stat()
    const pathBefore = await lstat(path)
    const canonicalBefore = await realpath(path)
    if (!before.isFile() || !pathBefore.isFile() || pathBefore.isSymbolicLink()
      || before.dev !== pathBefore.dev || before.ino !== pathBefore.ino
      || before.nlink !== 1 || pathBefore.nlink !== 1
      || before.size > maximumBytes
      || (containmentRoot && !isWithin(containmentRoot, canonicalBefore))) {
      fail(code, 'json input')
    }
    for (const field of ['dev', 'ino', 'size', 'nlink', 'mode', 'mtimeMs', 'ctimeMs']) {
      if (preflight[field] !== before[field] || preflight[field] !== pathBefore[field]) {
        fail(code, 'json input changed')
      }
    }
    const bytes = await handle.readFile()
    const after = await handle.stat()
    const pathAfter = await lstat(path)
    const canonicalAfter = await realpath(path)
    for (const field of ['dev', 'ino', 'size', 'nlink', 'mode', 'mtimeMs', 'ctimeMs']) {
      if (before[field] !== after[field] || before[field] !== pathAfter[field]) {
        fail(code, 'json input changed')
      }
    }
    if (!pathAfter.isFile() || pathAfter.isSymbolicLink()
      || canonicalBefore !== canonicalAfter
      || (containmentRoot && !isWithin(containmentRoot, canonicalAfter))
      || bytes.length !== before.size) {
      fail(code, 'json input changed')
    }
    let value
    try {
      value = JSON.parse(bytes.toString('utf8'))
    } catch {
      fail(code, 'json parse')
    }
    if (!isObject(value)) fail(code, 'json object')
    return {
      value,
      bytes,
      sha256: sha256(bytes),
      canonicalPath: canonicalBefore,
      identity: { dev: before.dev, ino: before.ino, size: before.size },
    }
  } catch (error) {
    if (error?.code === code) throw error
    fail(code, 'json input')
  } finally {
    await handle?.close().catch(() => {})
  }
}

async function readBinarySnapshot(path, {
  code,
  maximumBytes,
  expectedBytes,
  containmentRoot,
}) {
  let handle
  try {
    if (typeof code !== 'string'
      || !Number.isSafeInteger(maximumBytes)
      || maximumBytes < 0
      || (expectedBytes !== undefined
        && (!Number.isSafeInteger(expectedBytes)
          || expectedBytes < 0
          || expectedBytes > maximumBytes))
      || typeof containmentRoot !== 'string') {
      fail(code ?? 'INVALID_BINARY_SNAPSHOT', 'binary input options')
    }
    const preflight = await lstat(path)
    if (!preflight.isFile() || preflight.isSymbolicLink()
      || preflight.nlink !== 1
      || (preflight.mode & 0o222) !== 0
      || preflight.size > maximumBytes
      || (expectedBytes !== undefined && preflight.size !== expectedBytes)) {
      fail(code, 'binary input')
    }
    handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK,
    )
    const before = await handle.stat()
    const pathBefore = await lstat(path)
    const canonicalBefore = await realpath(path)
    if (!before.isFile() || !pathBefore.isFile() || pathBefore.isSymbolicLink()
      || before.dev !== pathBefore.dev || before.ino !== pathBefore.ino
      || before.nlink !== 1 || pathBefore.nlink !== 1
      || (before.mode & 0o222) !== 0 || (pathBefore.mode & 0o222) !== 0
      || before.size > maximumBytes
      || (expectedBytes !== undefined && before.size !== expectedBytes)
      || !isWithin(containmentRoot, canonicalBefore)) {
      fail(code, 'binary input')
    }
    for (const field of ['dev', 'ino', 'size', 'nlink', 'mode', 'mtimeMs', 'ctimeMs']) {
      if (preflight[field] !== before[field] || preflight[field] !== pathBefore[field]) {
        fail(code, 'binary input changed')
      }
    }
    const bytes = await handle.readFile()
    const after = await handle.stat()
    const pathAfter = await lstat(path)
    const canonicalAfter = await realpath(path)
    for (const field of ['dev', 'ino', 'size', 'nlink', 'mode', 'mtimeMs', 'ctimeMs']) {
      if (before[field] !== after[field] || before[field] !== pathAfter[field]) {
        fail(code, 'binary input changed')
      }
    }
    if (!pathAfter.isFile() || pathAfter.isSymbolicLink()
      || canonicalBefore !== canonicalAfter
      || !isWithin(containmentRoot, canonicalAfter)
      || bytes.length !== before.size) {
      fail(code, 'binary input changed')
    }
    return {
      bytes,
      sha256: sha256(bytes),
      canonicalPath: canonicalBefore,
      identity: { dev: before.dev, ino: before.ino, size: before.size },
    }
  } catch (error) {
    if (error?.code === code) throw error
    fail(code, 'binary input')
  } finally {
    await handle?.close().catch(() => {})
  }
}

async function assertSelectedCacheAncestorChain({
  cacheRoot,
  canonicalCacheRoot,
  selectedPath,
  code,
}) {
  if (!isWithin(cacheRoot, selectedPath) || selectedPath === cacheRoot) {
    fail(code, 'selected cache path')
  }
  let current = dirname(selectedPath)
  while (true) {
    const entry = await lstat(current)
    const canonical = await realpath(current)
    if (!entry.isDirectory() || entry.isSymbolicLink()
      || (entry.mode & 0o222) !== 0
      || !isWithin(canonicalCacheRoot, canonical)) {
      fail(code, 'selected cache ancestor')
    }
    if (current === cacheRoot) {
      if (canonical !== canonicalCacheRoot) fail(code, 'selected cache root')
      return
    }
    const parent = dirname(current)
    if (parent === current || !isWithin(cacheRoot, parent)) {
      fail(code, 'selected cache ancestor')
    }
    current = parent
  }
}

async function readJson(path) {
  return (await readJsonSnapshot(path)).value
}

async function pathExists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error && error.code === 'ENOENT') return false
    throw error
  }
}

async function assertRegularFile(path, code) {
  const entry = await lstat(path)
  if (!entry.isFile() || entry.isSymbolicLink()) fail(code, path)
  return entry
}

async function assertReadOnlyDirectory(path) {
  const entry = await lstat(path)
  if (!entry.isDirectory() || entry.isSymbolicLink() || (entry.mode & 0o222) !== 0) {
    fail('ACCEPTED_CACHE_NOT_READ_ONLY', path)
  }
}

function isWithin(root, candidate) {
  const remainder = relative(root, candidate)
  return remainder === '' || (!remainder.startsWith(`..${sep}`) && remainder !== '..' && !remainder.startsWith('/'))
}

function packageNameFromLockPath(lockPath) {
  const marker = 'node_modules/'
  const index = lockPath.lastIndexOf(marker)
  if (index === -1) fail('INVALID_LOCK_PATH', lockPath)
  return lockPath.slice(index + marker.length)
}

function lockRecordMap(packageLock) {
  if (!isObject(packageLock.packages)) fail('INVALID_LOCK_PACKAGES', 'packages')
  const records = new Map()
  for (const [lockPath, record] of Object.entries(packageLock.packages)) {
    if (lockPath === '') continue
    if (!isObject(record) || typeof record.integrity !== 'string' || typeof record.version !== 'string') {
      fail('INVALID_LOCK_RECORD', lockPath)
    }
    records.set(lockPath, record)
  }
  return records
}

function optionalPeerNames(manifest) {
  const optional = new Set()
  if (!isObject(manifest.peerDependenciesMeta)) return optional
  for (const [name, meta] of Object.entries(manifest.peerDependenciesMeta)) {
    if (isObject(meta) && meta.optional === true) optional.add(name)
  }
  return optional
}

function dependencyNames(manifest) {
  const names = new Set()
  for (const field of ['dependencies', 'optionalDependencies', 'peerDependencies']) {
    if (!isObject(manifest[field])) continue
    for (const name of Object.keys(manifest[field])) {
      if (field === 'peerDependencies' && optionalPeerNames(manifest).has(name)) continue
      names.add(name)
    }
  }
  return [...names].sort()
}

async function resolveInstalledDependency({ acceptedRoot, fromManifest, dependencyName }) {
  let cursor = dirname(fromManifest)
  while (isWithin(acceptedRoot, cursor)) {
    const candidate = resolve(cursor, 'node_modules', dependencyName, 'package.json')
    if (await pathExists(candidate)) return candidate
    if (cursor === acceptedRoot) break
    cursor = dirname(cursor)
  }
  return undefined
}

async function scanInstalledPackages({ acceptedRoot }) {
  const nodeModulesRoot = resolve(acceptedRoot, 'node_modules')
  const discovered = []
  async function visitNodeModules(directory, lockPrefix) {
    const entries = await readdir(directory, { withFileTypes: true })
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      if (entry.name === '.bin' || entry.name === '.package-lock.json') continue
      const entryPath = resolve(directory, entry.name)
      if (!entry.isDirectory() || entry.isSymbolicLink()) fail('INSTALLED_SYMLINK_OR_NON_DIRECTORY', entryPath)
      if (entry.name.startsWith('@')) {
        const scopedEntries = await readdir(entryPath, { withFileTypes: true })
        for (const scoped of scopedEntries.sort((left, right) => left.name.localeCompare(right.name))) {
          if (!scoped.isDirectory() || scoped.isSymbolicLink()) fail('INVALID_SCOPED_PACKAGE', resolve(entryPath, scoped.name))
          await visitPackage(resolve(entryPath, scoped.name), `${lockPrefix}/${entry.name}/${scoped.name}`)
        }
      } else {
        await visitPackage(entryPath, `${lockPrefix}/${entry.name}`)
      }
    }
  }
  async function visitPackage(packageDirectory, lockPath) {
    const manifestPath = resolve(packageDirectory, 'package.json')
    const manifestSnapshot = await readJsonSnapshot(manifestPath, {
      code: 'MISSING_INSTALLED_PACKAGE_MANIFEST',
      maximumBytes: 1024 * 1024,
      containmentRoot: acceptedRoot,
    })
    if (!isWithin(acceptedRoot, manifestSnapshot.canonicalPath)) {
      fail('REALPATH_ESCAPE', 'installed manifest')
    }
    const canonicalManifestPath = manifestSnapshot.canonicalPath
    discovered.push({ lockPath, manifestPath: canonicalManifestPath, manifest: manifestSnapshot.value })
    const nestedNodeModules = resolve(packageDirectory, 'node_modules')
    if (await pathExists(nestedNodeModules)) await visitNodeModules(nestedNodeModules, `${lockPath}/node_modules`)
  }
  await visitNodeModules(nodeModulesRoot, 'node_modules')
  return discovered.sort((left, right) => left.lockPath.localeCompare(right.lockPath))
}

export function assertInstalledPlacement({ packageLock, installed }) {
  const records = lockRecordMap(packageLock)
  if (installed.length !== records.size) fail('UNDECLARED_OR_MISSING_INSTALLED_PACKAGE', `${installed.length}/${records.size}`)
  const logical = new Map()
  const nested = []
  for (const entry of installed) {
    const lock = records.get(entry.lockPath)
    if (!lock) fail('UNDECLARED_INSTALLED_PACKAGE', entry.lockPath)
    const expectedName = packageNameFromLockPath(entry.lockPath)
    if (entry.manifest.name !== expectedName || entry.manifest.version !== lock.version) {
      fail('INSTALLED_LOCK_MISMATCH', entry.lockPath)
    }
    for (const field of INSTALLED_LOCK_DEPENDENCY_FIELDS) {
      if (canonicalDependencyField(entry.manifest, field) !== canonicalDependencyField(lock, field)) {
        fail('INSTALLED_LOCK_DEPENDENCY_METADATA_MISMATCH', `${entry.lockPath}:${field}`)
      }
    }
    const logicalKey = `${entry.manifest.name}@${entry.manifest.version}`
    if (logical.has(logicalKey)) fail('DUPLICATE_LOGICAL_PACKAGE_VERSION', logicalKey)
    logical.set(logicalKey, entry.lockPath)
    if (entry.lockPath.slice('node_modules/'.length).includes('/node_modules/')) nested.push(entry)
  }
  if (nested.length !== 1 || nested[0].lockPath !== NESTED_COMMANDER_PATH || nested[0].manifest.name !== 'commander' || nested[0].manifest.version !== '8.3.0') {
    fail('UNRECORDED_NESTED_PLACEMENT', nested.map((entry) => entry.lockPath).join(','))
  }
  const cordis = installed.find((entry) => entry.manifest.name === '@deepseek-ai/cordis')
  const schemastery = installed.find((entry) => entry.manifest.name === '@deepseek-ai/schemastery')
  if (!cordis || cordis.manifest.version !== '4.0.1') fail('CORDIS_VERSION_MISMATCH', String(cordis?.manifest.version))
  if (!schemastery || schemastery.manifest.version !== '3.18.1') fail('SCHEMASTERY_VERSION_MISMATCH', String(schemastery?.manifest.version))
  for (const entry of installed) {
    if (entry.manifest.name.startsWith('@deepseek-ai/dsh-') && entry.manifest.version !== '0.1.0-rc.6') {
      fail('MIXED_COHORT', `${entry.manifest.name}@${entry.manifest.version}`)
    }
  }
  return records
}

async function buildDeepseekClosure({ acceptedRoot, packageJson, packageLock, installed }) {
  const byManifestPath = new Map(installed.map((entry) => [entry.manifestPath, entry]))
  const rootManifestPath = resolve(acceptedRoot, 'package.json')
  const rootManifest = packageJson
  const queue = [{ manifestPath: rootManifestPath, manifest: rootManifest, parentKey: '<accepted-root>' }]
  const visited = new Set()
  const parents = new Map()
  const reachable = new Set()
  while (queue.length > 0) {
    const current = queue.shift()
    const currentKey = current.manifestPath
    if (visited.has(currentKey)) continue
    visited.add(currentKey)
    const currentDependencies = new Set(dependencyNames(current.manifest))
    if (current.manifestPath === rootManifestPath && isObject(current.manifest.devDependencies)) {
      for (const name of Object.keys(current.manifest.devDependencies)) currentDependencies.add(name)
    }
    for (const dependencyName of [...currentDependencies].sort()) {
      const childPath = await resolveInstalledDependency({ acceptedRoot, fromManifest: current.manifestPath, dependencyName })
      if (!childPath) fail('UNRESOLVED_INSTALLED_DEPENDENCY', `${current.parentKey} -> ${dependencyName}`)
      const child = byManifestPath.get(childPath)
      if (!child) fail('UNRECORDED_INSTALLED_DEPENDENCY', childPath)
      reachable.add(childPath)
      if (child.manifest.name.startsWith('@deepseek-ai/')) {
        const parentSet = parents.get(childPath) ?? new Set()
        parentSet.add(current.manifestPath === rootManifestPath ? '<accepted-root>' : `${current.manifest.name}@${current.manifest.version}`)
        parents.set(childPath, parentSet)
      }
      queue.push({ manifestPath: childPath, manifest: child.manifest, parentKey: `${current.manifest.name ?? 'root'}@${current.manifest.version ?? ''}` })
    }
  }
  const records = lockRecordMap(packageLock)
  const fullDeepseekCohort = [...reachable]
    .map((manifestPath) => byManifestPath.get(manifestPath))
    .filter((entry) => entry.manifest.name.startsWith('@deepseek-ai/'))
    .map((entry) => {
      const lock = records.get(entry.lockPath)
      return {
        name: entry.manifest.name,
        version: entry.manifest.version,
        integrity: lock.integrity,
        manifestPath: relative(acceptedRoot, entry.manifestPath).split(sep).join('/'),
        parents: [...(parents.get(entry.manifestPath) ?? new Set())].sort(),
      }
    })
    .sort((left, right) => left.manifestPath.localeCompare(right.manifestPath))
  if (fullDeepseekCohort.length !== 59) fail('FULL_COHORT_COUNT_MISMATCH', String(fullDeepseekCohort.length))
  const selectedRecords = SELECTED_DECLARATION_ROOTS.map((name) => {
    const entry = installed.find((candidate) => candidate.manifest.name === name && candidate.lockPath === `node_modules/${name}`)
    if (!entry) fail('MISSING_SELECTED_DECLARATION_MANIFEST', name)
    const lock = records.get(entry.lockPath)
    return {
      name,
      version: entry.manifest.version,
      integrity: lock.integrity,
      manifestPath: relative(acceptedRoot, entry.manifestPath).split(sep).join('/'),
      parents: ['<accepted-root>'],
    }
  })
  return { fullDeepseekCohort, selectedDeclarationSubgraph: { roots: SELECTED_DECLARATION_ROOTS, records: selectedRecords } }
}

async function verifySelectedCache({ workspaceRoot, inputManifest }) {
  const cacheRoot = resolve(workspaceRoot, ACCEPTED_CACHE_RELATIVE, '_cacache')
  const canonicalCacheRoot = await realpath(cacheRoot)
  for (const entry of inputManifest.selectedCache.entries) {
    const keyDigest = sha256(entry.key)
    const indexPath = resolve(cacheRoot, 'index-v5', keyDigest.slice(0, 2), keyDigest.slice(2, 4), keyDigest.slice(4))
    await assertSelectedCacheAncestorChain({
      cacheRoot,
      canonicalCacheRoot,
      selectedPath: indexPath,
      code: 'MISSING_ACCEPTED_CACHE_INDEX',
    })
    const indexSnapshot = await readBinarySnapshot(indexPath, {
      code: 'MISSING_ACCEPTED_CACHE_INDEX',
      maximumBytes: ACCEPTED_CACHE_INDEX_MAX_BYTES,
      containmentRoot: canonicalCacheRoot,
    })
    await assertSelectedCacheAncestorChain({
      cacheRoot,
      canonicalCacheRoot,
      selectedPath: indexPath,
      code: 'MISSING_ACCEPTED_CACHE_INDEX',
    })
    const line = indexSnapshot.bytes.toString('utf8').trimEnd()
    const tab = line.indexOf('\t')
    if (tab < 1) fail('INVALID_ACCEPTED_CACHE_INDEX', entry.lockPath)
    let indexRecord
    try {
      indexRecord = JSON.parse(line.slice(tab + 1))
    } catch {
      fail('INVALID_ACCEPTED_CACHE_INDEX', entry.lockPath)
    }
    if (indexRecord.key !== entry.key || indexRecord.integrity !== entry.integrity || indexRecord.size !== entry.byteLength) {
      fail('ACCEPTED_CACHE_INDEX_MISMATCH', entry.lockPath)
    }
    const encoded = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(entry.integrity)
    if (!encoded) fail('INVALID_ACCEPTED_CACHE_INTEGRITY', entry.lockPath)
    const hex = Buffer.from(encoded[1], 'base64').toString('hex')
    const contentPath = resolve(cacheRoot, 'content-v2/sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4))
    await assertSelectedCacheAncestorChain({
      cacheRoot,
      canonicalCacheRoot,
      selectedPath: contentPath,
      code: 'ACCEPTED_CACHE_CONTENT_MISMATCH',
    })
    const { bytes: content } = await readBinarySnapshot(contentPath, {
      code: 'ACCEPTED_CACHE_CONTENT_MISMATCH',
      maximumBytes: entry.byteLength,
      expectedBytes: entry.byteLength,
      containmentRoot: canonicalCacheRoot,
    })
    await assertSelectedCacheAncestorChain({
      cacheRoot,
      canonicalCacheRoot,
      selectedPath: contentPath,
      code: 'ACCEPTED_CACHE_CONTENT_MISMATCH',
    })
    if (content.length !== entry.byteLength || `sha512-${createHash('sha512').update(content).digest('base64')}` !== entry.integrity) {
      fail('ACCEPTED_CACHE_CONTENT_MISMATCH', entry.lockPath)
    }
  }
}

export async function getLocalReplayEligibility({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
  const inputPath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json')
  const acceptedRoot = resolve(workspaceRoot, ACCEPTED_ROOT_RELATIVE)
  const cacheRoot = resolve(workspaceRoot, ACCEPTED_CACHE_RELATIVE)
  if (!(await pathExists(inputPath)) || !(await pathExists(acceptedRoot)) || !(await pathExists(cacheRoot))) {
    return { eligible: false, reason: 'SKIP_ACCEPTED_CACHE_OR_ROOT_ABSENT' }
  }
  return { eligible: true, acceptedRoot, cacheRoot }
}

export async function inspectCommittedDeclarationClosure({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
  const inputAudit = await inspectCommittedDeclarationInput({ workspaceRoot })
  const closurePath = resolve(workspaceRoot, CLOSURE_RELATIVE)
  const [closureSnapshot, inputSnapshot] = await Promise.all([
    readJsonSnapshot(closurePath, { containmentRoot: workspaceRoot }),
    readJsonSnapshot(
      resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json'),
      { containmentRoot: workspaceRoot },
    ),
  ])
  const closure = closureSnapshot.value
  if (closure.schemaVersion !== '1' || closure.inputManifestSha256 !== inputSnapshot.sha256) {
    fail('COMMITTED_CLOSURE_INPUT_HASH_MISMATCH', closurePath)
  }
  if (closure.packageLockSha256 !== inputAudit.packageLockSha256) fail('COMMITTED_CLOSURE_LOCK_HASH_MISMATCH', closurePath)
  if (!Array.isArray(closure.fullDeepseekCohort) || closure.fullDeepseekCohort.length !== 59 || !isObject(closure.selectedDeclarationSubgraph)) {
    fail('INVALID_COMMITTED_CLOSURE_SHAPE', closurePath)
  }
  const serialized = JSON.stringify(closure)
  if (serialized.includes('/Users/') || serialized.includes('/private/')) fail('ABSOLUTE_PATH_IN_CLOSURE', closurePath)
  return { ...inputAudit, packageCounts: inputAudit.inputManifest.packageCounts, closure }
}

export async function verifyLocalAcceptedDeclarationClosure({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
  const eligibility = await getLocalReplayEligibility({ workspaceRoot })
  if (!eligibility.eligible) return { status: eligibility.reason }
  const inputAudit = await inspectCommittedDeclarationInput({ workspaceRoot })
  const { inputManifest } = inputAudit
  const acceptedPackagePath = resolve(eligibility.acceptedRoot, 'package.json')
  const acceptedLockPath = resolve(eligibility.acceptedRoot, 'package-lock.json')
  const [acceptedPackageSnapshot, acceptedLockSnapshot] = await Promise.all([
    readJsonSnapshot(acceptedPackagePath, {
      code: 'ACCEPTED_ROOT_INPUT_HASH_MISMATCH',
      containmentRoot: eligibility.acceptedRoot,
    }),
    readJsonSnapshot(acceptedLockPath, {
      code: 'ACCEPTED_ROOT_INPUT_HASH_MISMATCH',
      containmentRoot: eligibility.acceptedRoot,
    }),
  ])
  if (acceptedPackageSnapshot.sha256 !== inputManifest.packageJsonSha256
    || acceptedLockSnapshot.sha256 !== inputManifest.packageLockSha256) {
    fail('ACCEPTED_ROOT_INPUT_HASH_MISMATCH', eligibility.acceptedRoot)
  }
  const packageJson = acceptedPackageSnapshot.value
  const packageLock = acceptedLockSnapshot.value
  await assertReadOnlyDirectory(eligibility.cacheRoot)
  await assertReadOnlyDirectory(resolve(eligibility.cacheRoot, '_cacache'))
  await verifySelectedCache({ workspaceRoot, inputManifest })
  const installed = await scanInstalledPackages({ acceptedRoot: eligibility.acceptedRoot })
  assertInstalledPlacement({ packageLock, installed })
  const closure = await buildDeepseekClosure({ acceptedRoot: eligibility.acceptedRoot, packageJson, packageLock, installed })
  const selectedNames = new Set(closure.selectedDeclarationSubgraph.records.map((entry) => entry.name))
  const storage = { selectedOrImported: [...selectedNames].some((name) => /storage/i.test(name)) }
  if (storage.selectedOrImported) fail('STORAGE_SELECTED_OR_IMPORTED', 'selected declaration graph')
  return {
    status: 'PASS_LOCAL_REPLAY',
    closure,
    selectedDeclarationManifests: closure.selectedDeclarationSubgraph.records,
    selectedCacheReadOnly: true,
    realpathsWithinAcceptedRoot: true,
    storage,
  }
}

export async function verifyStagedDeclarationClosure({ workspaceRoot, inputManifest, stagingRoot } = {}) {
  const options = arguments[0]
  if (!isObject(options)
    || Object.keys(options).sort().join(',') !== 'inputManifest,stagingRoot,workspaceRoot'
    || typeof workspaceRoot !== 'string'
    || typeof stagingRoot !== 'string'
    || !isObject(inputManifest)) {
    fail('STAGED_CLOSURE_OPTIONS_MISMATCH', 'options')
  }
  const [canonicalWorkspace, canonicalStaging] = await Promise.all([
    realpath(workspaceRoot),
    realpath(stagingRoot),
  ])
  if (canonicalStaging === canonicalWorkspace || !isWithin(canonicalWorkspace, canonicalStaging)) {
    fail('STAGED_ROOT_OUTSIDE_WORKSPACE', 'staging root')
  }
  const stagingStat = await lstat(stagingRoot)
  if (!stagingStat.isDirectory() || stagingStat.isSymbolicLink()) {
    fail('INVALID_STAGED_ROOT', 'staging root')
  }
  const [packageSnapshot, lockSnapshot, rootLockSnapshot] = await Promise.all([
    readJsonSnapshot(resolve(stagingRoot, 'package.json'), {
      code: 'STAGED_ROOT_INPUT_HASH_MISMATCH',
      containmentRoot: canonicalStaging,
    }),
    readJsonSnapshot(resolve(stagingRoot, 'package-lock.json'), {
      code: 'STAGED_ROOT_INPUT_HASH_MISMATCH',
      containmentRoot: canonicalStaging,
    }),
    readJsonSnapshot(resolve(workspaceRoot, 'package-lock.json'), {
      code: 'INVALID_ROOT_LOCKFILE',
      containmentRoot: canonicalWorkspace,
    }),
  ])
  if (packageSnapshot.sha256 !== inputManifest.packageJsonSha256
    || lockSnapshot.sha256 !== inputManifest.packageLockSha256) {
    fail('STAGED_ROOT_INPUT_HASH_MISMATCH', 'package inputs')
  }
  const packageJson = packageSnapshot.value
  const packageLock = lockSnapshot.value
  const rootPackageLock = rootLockSnapshot.value
  validateInputManifest({ inputManifest, packageJson, packageLock, rootPackageLock })
  await validateProductionBoundary({ workspaceRoot, inputManifest })
  const installed = await scanInstalledPackages({ acceptedRoot: canonicalStaging })
  assertInstalledPlacement({ packageLock, installed })
  const closure = await buildDeepseekClosure({
    acceptedRoot: canonicalStaging,
    packageJson,
    packageLock,
    installed,
  })
  const selectedNames = new Set(closure.selectedDeclarationSubgraph.records.map((entry) => entry.name))
  const storage = { selectedOrImported: [...selectedNames].some((name) => /storage/i.test(name)) }
  if (storage.selectedOrImported) fail('STORAGE_SELECTED_OR_IMPORTED', 'selected declaration graph')
  const stagingAfter = await lstat(stagingRoot)
  const canonicalStagingAfter = await realpath(stagingRoot)
  if (!stagingAfter.isDirectory() || stagingAfter.isSymbolicLink()
    || stagingAfter.dev !== stagingStat.dev || stagingAfter.ino !== stagingStat.ino
    || canonicalStagingAfter !== canonicalStaging) {
    fail('INVALID_STAGED_ROOT', 'staging root changed')
  }
  return {
    status: 'PASS_STAGED_REPLAY',
    closure,
    selectedDeclarationManifests: closure.selectedDeclarationSubgraph.records,
    realpathsWithinStagingRoot: true,
    storage,
  }
}

export async function writeCommittedDeclarationClosure({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
  const replay = await verifyLocalAcceptedDeclarationClosure({ workspaceRoot })
  if (replay.status !== 'PASS_LOCAL_REPLAY') fail('LOCAL_REPLAY_UNAVAILABLE', replay.status)
  const inputManifestPath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json')
  const inputSnapshot = await readJsonSnapshot(inputManifestPath, { containmentRoot: workspaceRoot })
  const inputManifest = inputSnapshot.value
  const closure = {
    schemaVersion: '1',
    generationCommand: 'node scripts/verify-rc6-declaration-closure.mjs --write',
    inputManifestSha256: inputSnapshot.sha256,
    packageLockSha256: inputManifest.packageLockSha256,
    packageCounts: inputManifest.packageCounts,
    runtime: inputManifest.runtime,
    fullDeepseekCohort: replay.closure.fullDeepseekCohort,
    selectedDeclarationSubgraph: replay.closure.selectedDeclarationSubgraph,
  }
  await writeFile(resolve(workspaceRoot, CLOSURE_RELATIVE), canonicalJson(closure), 'utf8')
  return closure
}

async function main() {
  const closure = await writeCommittedDeclarationClosure()
  process.stdout.write(`${canonicalJson({ status: 'PASS_LOCAL_REPLAY', fullDeepseekCount: closure.fullDeepseekCohort.length, selectedDeclarationCount: closure.selectedDeclarationSubgraph.records.length })}`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`)
    process.exitCode = 1
  })
}
