import { createHash } from 'node:crypto'
import { lstat, readFile, readdir, realpath, writeFile } from 'node:fs/promises'
import { basename, dirname, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { inspectCommittedDeclarationInput } from './accept-rc6-declaration-input.mjs'

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

function fail(code, detail) {
  throw new Error(`${code}: ${detail}`)
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

async function sha256File(path) {
  return sha256(await readFile(path))
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8')
  const value = JSON.parse(raw)
  if (!isObject(value)) fail('INVALID_JSON_OBJECT', path)
  return value
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
    await assertRegularFile(manifestPath, 'MISSING_INSTALLED_PACKAGE_MANIFEST')
    const resolvedManifest = await realpath(manifestPath)
    if (!isWithin(acceptedRoot, resolvedManifest)) fail('REALPATH_ESCAPE', manifestPath)
    const manifest = await readJson(manifestPath)
    discovered.push({ lockPath, manifestPath, manifest })
    const nestedNodeModules = resolve(packageDirectory, 'node_modules')
    if (await pathExists(nestedNodeModules)) await visitNodeModules(nestedNodeModules, `${lockPath}/node_modules`)
  }
  await visitNodeModules(nodeModulesRoot, 'node_modules')
  return discovered.sort((left, right) => left.lockPath.localeCompare(right.lockPath))
}

function assertInstalledPlacement({ packageLock, installed }) {
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
  for (const entry of inputManifest.selectedCache.entries) {
    const keyDigest = sha256(entry.key)
    const indexPath = resolve(cacheRoot, 'index-v5', keyDigest.slice(0, 2), keyDigest.slice(2, 4), keyDigest.slice(4))
    await assertRegularFile(indexPath, 'MISSING_ACCEPTED_CACHE_INDEX')
    const line = (await readFile(indexPath, 'utf8')).trimEnd()
    const tab = line.indexOf('\t')
    if (tab < 1) fail('INVALID_ACCEPTED_CACHE_INDEX', entry.lockPath)
    const indexRecord = JSON.parse(line.slice(tab + 1))
    if (indexRecord.key !== entry.key || indexRecord.integrity !== entry.integrity || indexRecord.size !== entry.byteLength) {
      fail('ACCEPTED_CACHE_INDEX_MISMATCH', entry.lockPath)
    }
    const encoded = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(entry.integrity)
    if (!encoded) fail('INVALID_ACCEPTED_CACHE_INTEGRITY', entry.lockPath)
    const hex = Buffer.from(encoded[1], 'base64').toString('hex')
    const contentPath = resolve(cacheRoot, 'content-v2/sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4))
    const content = await readFile(contentPath)
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
  const closure = await readJson(closurePath)
  if (closure.schemaVersion !== '1' || closure.inputManifestSha256 !== await sha256File(resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json'))) {
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
  const { inputManifest, packageJson, packageLock } = inputAudit
  const acceptedPackagePath = resolve(eligibility.acceptedRoot, 'package.json')
  const acceptedLockPath = resolve(eligibility.acceptedRoot, 'package-lock.json')
  if ((await sha256File(acceptedPackagePath)) !== inputManifest.packageJsonSha256 || (await sha256File(acceptedLockPath)) !== inputManifest.packageLockSha256) {
    fail('ACCEPTED_ROOT_INPUT_HASH_MISMATCH', eligibility.acceptedRoot)
  }
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
    cacheReadOnly: true,
    realpathsWithinAcceptedRoot: true,
    storage,
  }
}

export async function writeCommittedDeclarationClosure({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
  const replay = await verifyLocalAcceptedDeclarationClosure({ workspaceRoot })
  if (replay.status !== 'PASS_LOCAL_REPLAY') fail('LOCAL_REPLAY_UNAVAILABLE', replay.status)
  const inputManifestPath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json')
  const inputManifest = await readJson(inputManifestPath)
  const closure = {
    schemaVersion: '1',
    generationCommand: 'node scripts/verify-rc6-declaration-closure.mjs --write',
    inputManifestSha256: await sha256File(inputManifestPath),
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
