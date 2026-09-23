import { createHash, randomUUID } from 'node:crypto'
import { constants, closeSync, fstatSync, lstatSync, mkdirSync, openSync, readSync, readdirSync, renameSync, rmdirSync, unlinkSync, writeSync } from 'node:fs'
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
import { execFile as execFileCallback, execFileSync } from 'node:child_process'
import { promisify } from 'node:util'
import { gunzipSync } from 'node:zlib'
import { pathToFileURL } from 'node:url'

import {
  assertClientProductBuildGraph,
  assertHostProductBuildGraph,
  buildPackableWorkbench,
  compileProductSnapshots, stopProductCompiler, PRODUCT_INPUT_PATHS, assertCanonicalProductGraph, assertElidedProductTypeImport, canonicalJson, wrapProductClient,
} from '../packages/workbench/build.mjs'

export { canonicalJson }
const execFile = promisify(execFileCallback)
const defaultRepositoryRoot = path.resolve(import.meta.dirname, '..')
const packageName = '@knight/dsh-pm-workbench'
const packageVersion = '0.1.0'
const packageFilename = 'knight-dsh-pm-workbench-0.1.0.tgz'
const buildOutputPaths = Object.freeze(['lib/client.js', 'lib/index.js'])
const sha256Pattern = /^[a-f0-9]{64}$/u
const MAX_PACKAGE_FILE_BYTES = 2 * 1024 * 1024
const MAX_PACKED_ARTIFACT_BYTES = 8 * 1024 * 1024
const ownershipLoss = Symbol.for('@knight/dsh-pm-workbench/ownership-loss')
function lostOwnership(error) {
  if (error?.[ownershipLoss]) return error
  const failure = new Error(error instanceof Error ? error.message : 'package-verification-failed', { cause: error })
  Object.defineProperty(failure, ownershipLoss, { value: true })
  return failure
}

export const WORKBENCH_PACKAGE_FILES = Object.freeze([
  'LICENSE',
  'README.md',
  'cordis.patch.yml',
  'docs/compatibility.md',
  'docs/privacy.md',
  'docs/third-party.md',
  'lib/client.js',
  'lib/index.js',
  'package.json',
  'skills/adversarial-product-review/SKILL.md',
  'skills/create-prd/SKILL.md',
  'skills/interview-intake/SKILL.md',
  'skills/interview-to-prd/SKILL.md',
  'skills/prd-drafting/SKILL.md',
  'skills/prioritization-review/SKILL.md',
  'skills/requirement-framing/SKILL.md',
  'skills/research-synthesis/SKILL.md',
])

export function assertNoStorageGateDiagnostics(bytes) {
  const text = bytes.toString('utf8')
  if (['@knight/dsh-pm-workbench-storage-gate', 'dsh-pm-workbench-storage-gate', 'dsh_pm_workbench_storage_gate', '/dsh-pm-workbench-stage3a-storage-gate-v1'].some(value => text.includes(value))) throw new Error('diagnostic-storage-gate-forbidden')
}

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function canonicalInventoryHash(files) {
  return sha256(Buffer.from(JSON.stringify({ schemaVersion: 1, files })))
}

function comparePath(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assertSameOpenFile(before, after, label) {
  for (const field of ['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) {
    if (before[field] !== after[field]) throw lostOwnership(new Error(`${label} changed while it was read`))
  }
}

async function assertRealDirectory(directory, label) {
  const stats = await lstat(directory)
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory`)
  }
}

async function readStablePackageFile(packageRoot, relative) {
  let value
  try { value = await stableRead(path.join(packageRoot, relative), MAX_PACKAGE_FILE_BYTES) }
  catch (error) {
    if (error.message === 'bounded-file-size-invalid') throw new Error(`package entry exceeds maximum package file size: ${relative}`)
    throw error
  }
  return { path: relative, mode: Number(value.stat.mode & 0o7777n), size: value.bytes.length, sha256: sha256(value.bytes), bytes: value.bytes }
}

function assertBuildEvidence(buildEvidence) {
  if (
    !isRecord(buildEvidence)
    || !buildEvidence.hostMetafile
    || !buildEvidence.clientMetafile
    || !isRecord(buildEvidence.outputHashes)
    || JSON.stringify(Object.keys(buildEvidence.outputHashes).sort(comparePath)) !== JSON.stringify(buildOutputPaths)
    || buildOutputPaths.some((output) => !sha256Pattern.test(buildEvidence.outputHashes[output]))
  ) {
    throw new Error('build did not return Host and Client graph evidence')
  }
  assertHostProductBuildGraph(buildEvidence.hostMetafile)
  assertClientProductBuildGraph(buildEvidence.clientMetafile)
  return Object.freeze(Object.fromEntries(
    buildOutputPaths.map((output) => [output, buildEvidence.outputHashes[output]]),
  ))
}

/**
 * @param {{
 *   repositoryRoot?: string,
 *   packageRoot?: string,
 *   buildEvidence: {
 *     hostMetafile: import('esbuild').Metafile,
 *     clientMetafile: import('esbuild').Metafile,
 *     outputHashes: Readonly<Record<'lib/client.js' | 'lib/index.js', string>>,
 *   },
 * }} options
 */
export async function verifyBuiltWorkbenchPackage({
  repositoryRoot = defaultRepositoryRoot,
  packageRoot = path.join(repositoryRoot, 'packages/workbench'),
  buildEvidence,
}) {
  if (!path.isAbsolute(repositoryRoot) || !path.isAbsolute(packageRoot)) {
    throw new Error('package verification roots must be absolute')
  }
  const outputHashes = assertBuildEvidence(buildEvidence)

  const files = []
  for (const relative of WORKBENCH_PACKAGE_FILES) {
    files.push(await readStablePackageFile(packageRoot, relative))
  }
  const byPath = new Map(files.map((file) => [file.path, file]))
  for (const output of buildOutputPaths) {
    if (byPath.get(output).sha256 !== outputHashes[output]) {
      throw new Error(`frozen ${output} bytes did not match the canonical build output hash`)
    }
  }
  const manifest = JSON.parse(byPath.get('package.json').bytes.toString('utf8'))
  if (manifest.name !== packageName || manifest.version !== packageVersion || manifest.private !== true) {
    throw new Error('invalid package identity')
  }
  assertPackageManifest(manifest)
  if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') {
    throw new Error('invalid dsh bundle patch metadata')
  }
  if (!Array.isArray(manifest.dsh?.client?.inject) || manifest.dsh.client.inject.length === 0) {
    throw new Error('missing dsh client inject graph')
  }
  if (Object.hasOwn(manifest, 'dependencies')) {
    throw new Error('published package must have zero runtime dependencies')
  }

  const repositoryBytes = Buffer.from(repositoryRoot)
  for (const file of files) {
    if (file.bytes.includes(repositoryBytes)) {
      throw new Error(`absolute repository path leaked into package file: ${file.path}`)
    }
    assertNoStorageGateDiagnostics(file.bytes)
    assertProductPackageBytes(file.bytes)
    const text = file.bytes.toString('utf8')
    if (/(?:file:\/\/|\/Users\/[^\s'"`]+|\/private\/tmp\/[^\s'"`]+)/u.test(text)) {
      throw new Error(`absolute filesystem path leaked into package file: ${file.path}`)
    }
  }

  const host = byPath.get('lib/index.js').bytes.toString('utf8')
  const client = byPath.get('lib/client.js').bytes.toString('utf8')
  if (!client.includes('window.__ModuleLoader__.load') || !client.includes("id:'@knight/dsh-pm-workbench'")) {
    throw new Error('invalid client wrapper')
  }
  if (/(?:from\s*['"]zod['"]|require\(\s*['"]zod['"]\s*\))/u.test(`${host}\n${client}`)) {
    throw new Error('bare Zod runtime import remained in output')
  }
  if (/\bBuffer\b|node:crypto|crypto-browserify|@deepseek-ai\/dsh-storage-domain/u.test(client)) throw new Error('client-node-storage-runtime-forbidden')
  const patch = byPath.get('cordis.patch.yml').bytes.toString('utf8')
  if ((patch.match(/^- insert:/gmu) ?? []).length !== 1) {
    throw new Error('patch must contain exactly one insert')
  }
  const expectedPatch = "- insert:\n"
    + "    - id: dsh-pm-workbench\n"
    + "      name: '@knight/dsh-pm-workbench'\n"
    + "    - id: dsh-pm-workbench-skills\n"
    + "      name: '@deepseek-ai/dsh-skill-filesystem'\n"
    + "      config:\n"
    + "        providerName: dsh-pm-workbench\n"
    + "        includeDefaultRoots: false\n"
    + "        bundledSkillDir: !!js \"process.getBuiltinModule('node:path').join(process.getBuiltinModule('node:path').dirname(process.getBuiltinModule('node:module').createRequire(baseUrl).resolve('@knight/dsh-pm-workbench/package.json')), 'skills')\"\n"
  if (patch !== expectedPatch) throw new Error('invalid Product patch identity')
  const zodLicense = (await readFile(path.join(repositoryRoot, 'node_modules/zod/LICENSE'), 'utf8')).trim()
  const thirdParty = byPath.get('docs/third-party.md').bytes.toString('utf8')
  await assertZodVersion()
  if (!thirdParty.includes('shared Product schemas') || !thirdParty.includes('Zod 4.4.3')) throw new Error('invalid Product Zod purpose')
  if (!thirdParty.includes(zodLicense)) {
    throw new Error('packed third-party notice does not contain the complete Zod license')
  }

  const inventory = files.map(({ path: file, mode, size, sha256: digest }) => ({
    path: file,
    mode,
    size,
    sha256: digest,
  }))
  return Object.freeze({
    name: packageName,
    version: packageVersion,
    files: Object.freeze(files.map((file) => Object.freeze(file))),
    outputHashes,
    sourceInventorySha256: canonicalInventoryHash(inventory),
    bundledZod: true,
    runtimeDependencies: 0,
  })
}

/** @typedef {{ path: string, size: number, mode: number }} NpmPackFile */
/**
 * @typedef {object} ValidatedNpmPackMetadata
 * @property {'knight-dsh-pm-workbench-0.1.0.tgz'} filename
 * @property {readonly NpmPackFile[]} files
 * @property {number} size
 * @property {string} shasum
 * @property {string} integrity
 * @property {string} npmInventorySha256
 */

/**
 * @param {unknown} value
 * @returns {ValidatedNpmPackMetadata}
 */
export function validateNpmPackMetadata(value) {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new Error('npm pack must return exactly one package record')
  }
  const record = value[0]
  if (record.id !== `${packageName}@${packageVersion}`
    || record.name !== packageName
    || record.version !== packageVersion) {
    throw new Error('npm pack returned the wrong package identity')
  }
  if (record.filename !== packageFilename || path.basename(record.filename) !== record.filename) {
    throw new Error('npm pack returned an invalid package filename')
  }
  if (!Number.isSafeInteger(record.size) || record.size < 1) {
    throw new Error('npm pack returned an invalid package size')
  }
  if (record.size > MAX_PACKED_ARTIFACT_BYTES) {
    throw new Error('npm pack exceeded the maximum packed artifact size')
  }
  if (typeof record.shasum !== 'string' || !/^[a-f0-9]{40}$/u.test(record.shasum)) {
    throw new Error('npm pack returned an invalid shasum')
  }
  if (typeof record.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/]+={0,2}$/u.test(record.integrity)) {
    throw new Error('npm pack returned an invalid integrity')
  }
  if (!Array.isArray(record.files) || record.files.length !== WORKBENCH_PACKAGE_FILES.length) {
    throw new Error('npm pack returned a non-exact package file inventory')
  }

  const files = record.files.map((item) => {
    if (!isRecord(item)
      || typeof item.path !== 'string'
      || !Number.isSafeInteger(item.size)
      || item.size < 0
      || !Number.isSafeInteger(item.mode)
      || item.mode < 0
      || item.mode !== 0o644
      || item.size > MAX_PACKAGE_FILE_BYTES
      || Object.is(item.size, -0)) {
      throw new Error('npm pack returned an invalid package file record')
    }
    return { path: item.path, size: item.size, mode: item.mode }
  }).sort((left, right) => comparePath(left.path, right.path))
  const paths = files.map((file) => file.path)
  if (new Set(paths).size !== paths.length
    || JSON.stringify(paths) !== JSON.stringify(WORKBENCH_PACKAGE_FILES)) {
    throw new Error('npm pack returned a non-exact package file inventory')
  }
  if (record.entryCount !== undefined && record.entryCount !== WORKBENCH_PACKAGE_FILES.length) {
    throw new Error('npm pack returned a non-exact package entry count')
  }
  if (record.bundled !== undefined && (!Array.isArray(record.bundled) || record.bundled.length !== 0)) {
    throw new Error('npm pack unexpectedly bundled dependencies')
  }

  return Object.freeze({
    filename: packageFilename,
    files: Object.freeze(files.map(Object.freeze)),
    size: record.size,
    shasum: record.shasum,
    integrity: record.integrity,
    npmInventorySha256: canonicalInventoryHash(files),
  })
}

/**
 * @param {{
 *   packOutputRoot: string,
 *   metadata: ReturnType<typeof validateNpmPackMetadata>,
 * }} options
 */
export async function verifyPackedWorkbenchArtifact({ packOutputRoot, metadata }) {
  if (!path.isAbsolute(packOutputRoot)) throw new Error('pack output root must be absolute')
  if (!Number.isSafeInteger(metadata?.size) || metadata.size < 1 || metadata.size > MAX_PACKED_ARTIFACT_BYTES) throw new Error('npm pack exceeded the maximum packed artifact size')
  await assertRealDirectory(packOutputRoot, 'pack output root')
  if (JSON.stringify((await readdir(packOutputRoot)).sort(comparePath)) !== JSON.stringify([metadata.filename])) throw new Error('pack output root must contain exactly one expected tgz')
  const outputPhysicalRoot = await realpath(packOutputRoot)
  const tgzAbsolutePath = path.join(outputPhysicalRoot, metadata.filename)
  if (path.dirname(tgzAbsolutePath) !== outputPhysicalRoot) throw new Error('package filename escaped the pack output root')
  let value
  try { value = await stableRead(tgzAbsolutePath, MAX_PACKED_ARTIFACT_BYTES) }
  catch (error) { if (error.message === 'bounded-file-size-invalid') throw new Error('packed artifact exceeds the maximum packed artifact size'); throw error }
  const bytes = value.bytes
  if (bytes.length !== metadata.size) throw new Error('packed artifact size differs from npm metadata')
  const shasum = createHash('sha1').update(bytes).digest('hex')
  if (shasum !== metadata.shasum) throw new Error('packed artifact shasum differs from npm metadata')
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  if (integrity !== metadata.integrity) throw new Error('packed artifact integrity differs from npm metadata')
  inspectWorkbenchArchive(bytes, metadata)
  if (JSON.stringify((await readdir(packOutputRoot)).sort(comparePath)) !== JSON.stringify([metadata.filename])) throw new Error('pack output root must contain exactly one expected tgz')
  assertSameOpenFile(value.stat, await lstat(tgzAbsolutePath, { bigint: true }), 'packed artifact')
  return Object.freeze({ tgzAbsolutePath, tgzBytes: bytes.length, sha256: sha256(bytes), shasum, integrity })
}

const exact = (a, b) => canonicalJson(a) === canonicalJson(b)
const failRelease = () => { throw new Error('package-verification-failed') }
const boundedNumber = (v, max = Number.MAX_SAFE_INTEGER) => {
  if (!Number.isSafeInteger(v) || v < 0 || v > max || Object.is(v, -0)) failRelease()
}
function closed(value, names) {
  if (!isRecord(value) || !exact(Object.keys(value).sort(comparePath), [...names].sort(comparePath))) failRelease()
}
function digest(value) { if (typeof value !== 'string' || !sha256Pattern.test(value)) failRelease() }
function commitHash(value) { if (typeof value !== 'string' || !/^[0-9a-f]{40}$/.test(value)) failRelease() }
function uuid(value) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) failRelease() }
function identity(value) {
  closed(value, ['dev', 'ino'])
  for (const part of Object.values(value)) if (typeof part !== 'string' || !/^(0|[1-9][0-9]*)$/.test(part) || BigInt(part) > 18446744073709551615n) failRelease()
}
const directoryIdentity = stat => ({ dev: stat.dev.toString(), ino: stat.ino.toString() })
const equalIdentity = (a, b) => a.dev === b.dev && a.ino === b.ino
const releaseRelative = '.superpowers/sdd/2026-09-07-dsh-pm-workbench-stage-3a-core/task-11-release'
const releaseCanonicalRoot = path.join(defaultRepositoryRoot, releaseRelative)
const MAX_RECEIPT_BYTES = 1024 * 1024
const MAX_TAR_BYTES = WORKBENCH_PACKAGE_FILES.length * MAX_PACKAGE_FILE_BYTES + 64 * 1024
export const WORKBENCH_RELEASE_SOURCE_PATHS = Object.freeze([...new Set([
  ...PRODUCT_INPUT_PATHS,
  'package-lock.json', 'tsconfig.json', 'packages/workbench/tsconfig.json',
  'packages/workbench/build.mjs', 'scripts/pack-dry.mjs', 'scripts/verify-package.mjs', 'scripts/workspace-boundary.ts',
  'packages/workbench/LICENSE', 'packages/workbench/README.md', 'packages/workbench/cordis.patch.yml',
  'packages/workbench/docs/compatibility.md', 'packages/workbench/docs/privacy.md', 'packages/workbench/docs/third-party.md',
  'packages/workbench/package.json', 'node_modules/zod/LICENSE', 'node_modules/zod/package.json',
  ...WORKBENCH_PACKAGE_FILES.filter(file => file.startsWith('skills/')).map(file => `packages/workbench/${file}`),
])].sort(comparePath))

function assertPackageManifest(manifest) {
  const peers = {
    '@deepseek-ai/cordis': '4.0.1', '@deepseek-ai/dsh-agent': '0.1.0-rc.6',
    '@deepseek-ai/dsh-agent-default-model': '0.1.0-rc.6', '@deepseek-ai/dsh-invariants': '0.1.0-rc.6',
    '@deepseek-ai/dsh-client-connection': '0.1.0-rc.6', '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
    '@deepseek-ai/dsh-client-ui-layout': '0.1.0-rc.6', '@deepseek-ai/dsh-client-ui-sidebar': '0.1.0-rc.6',
    '@deepseek-ai/dsh-client-ui-slots': '0.1.0-rc.6', '@deepseek-ai/dsh-skill-filesystem': '0.1.0-rc.6',
    '@deepseek-ai/dsh-session': '0.1.0-rc.6', '@deepseek-ai/dsh-storage-domain': '0.1.0-rc.6',
    '@deepseek-ai/dsh-subagent': '0.1.0-rc.6', '@deepseek-ai/dsh-tools': '0.1.0-rc.6',
    react: '18.3.1', 'react-dom': '18.3.1',
  }
  if (manifest.type !== 'module' || manifest.license !== 'MIT' || manifest.main !== './lib/index.js'
    || !exact(manifest.exports, { '.': './lib/index.js', './client': './lib/client.js', './package.json': './package.json' })
    || !exact(manifest.files, ['lib', 'skills', 'cordis.patch.yml', 'README.md', 'LICENSE', 'docs'])
    || !exact(manifest.dsh, { bundle: { patch: './cordis.patch.yml' }, client: { platform: 'web', inject: ['@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-client-ui-sidebar'] } })
    || !exact(manifest.peerDependencies, peers)
    || !exact(manifest.peerDependenciesMeta, Object.fromEntries(Object.keys(peers).map(name => [name, { optional: true }])))
    || Object.hasOwn(manifest, 'dependencies') || Object.hasOwn(manifest, 'optionalDependencies')) throw new Error('invalid Product package manifest')
}
function assertProductPackageBytes(bytes) {
  const text = bytes.toString('utf8')
  const forbidden = ['/dsh-pm-workbench-v1', 'counter.increment', 'pm-workbench-probe', 'workbench-probe-launcher', 'workbench-probe-overlay', 'src/client/probe/', 'src/probe/', 'probe-host.ts', 'src/demo/', 'DemoApp', 'runHarnessModel(', '@deepseek-ai/dsh-llm', 'dsh_pm_workbench_probe']
  if (forbidden.some(value => text.includes(value))) throw new Error('non-product-runtime-forbidden')
}
async function assertZodVersion(sources) {
  const installed = JSON.parse((sources?.get('node_modules/zod/package.json') ?? (await stableRead(path.join(defaultRepositoryRoot, 'node_modules/zod/package.json'), MAX_PACKAGE_FILE_BYTES)).bytes).toString('utf8'))
  const lock = JSON.parse((sources?.get('package-lock.json') ?? (await stableRead(path.join(defaultRepositoryRoot, 'package-lock.json'), MAX_PACKAGE_FILE_BYTES)).bytes).toString('utf8'))
  const occurrences = Object.entries(lock.packages).filter(([name]) => /(^|\/)node_modules\/zod$/.test(name))
  if (installed.name !== 'zod' || installed.version !== '4.4.3' || occurrences.length === 0 || occurrences.some(([, v]) => v.version !== '4.4.3')) failRelease()
}

async function holdDirectories(directory) {
  if (!path.isAbsolute(directory) || path.resolve(directory) !== directory || await realpath(directory) !== directory) failRelease()
  const entries = []
  try {
    let current = path.parse(directory).root
    for (const part of ['', ...directory.slice(current.length).split('/').filter(Boolean)]) {
      if (part) current = path.join(current, part)
      const handle = await open(current, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY)
      let retained = false
      try {
        const stat = await handle.stat({ bigint: true })
        if (!stat.isDirectory() || !equalIdentity(stat, await lstat(current, { bigint: true }))) failRelease()
        entries.push({ path: current, handle, stat }); retained = true
      } finally { if (!retained) await handle.close() }
    }
    return entries
  } catch (error) { await Promise.all(entries.map(e => e.handle.close())); throw error }
}
async function checkDirectories(entries) {
  try {
  for (const entry of entries) {
    const handle = entry.handle ? await entry.handle.stat({ bigint: true }) : fstatSync(entry.fd, { bigint: true }); const atPath = await lstat(entry.path, { bigint: true })
    if (!atPath.isDirectory() || atPath.isSymbolicLink() || !equalIdentity(entry.stat, handle) || !equalIdentity(entry.stat, atPath) || handle.mode !== entry.stat.mode) failRelease()
  }
  } catch (error) { throw lostOwnership(error) }
}
async function closeDirectories(entries) { await Promise.all(entries.map(e => e.handle ? e.handle.close() : closeSync(e.fd))) }
// C36: these trusted synchronous sections assume one exclusive controller, including its npm child.
// They close every asynchronous seam; they do not claim protection from a hostile same-UID syscall race.
function checkDirectoriesSync(entries) {
  try {
  for (const entry of entries) {
    const held = fstatSync(entry.handle ? entry.handle.fd : entry.fd, { bigint: true })
    const atPath = lstatSync(entry.path, { bigint: true })
    if (!held.isDirectory() || !atPath.isDirectory() || atPath.isSymbolicLink() || !equalIdentity(entry.stat, held)
      || !equalIdentity(entry.stat, atPath) || held.mode !== entry.stat.mode || atPath.mode !== entry.stat.mode) failRelease()
  }
  } catch (error) { throw lostOwnership(error) }
}
function reopenDirectoriesSync(entries) {
  const reopened = []
  try {
    for (const entry of entries) {
      const fd = openSync(entry.path, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
      reopened.push({ path: entry.path, fd, stat: entry.stat })
    }
    checkDirectoriesSync(reopened)
    return reopened
  } catch (error) {
    for (const entry of reopened) closeSync(entry.fd)
    throw lostOwnership(error)
  }
}
function absentSync(target) {
  try { lstatSync(target); failRelease() } catch (error) { if (error.code !== 'ENOENT') throw error }
}
function createDirectorySync(target, parents) {
  checkDirectoriesSync(parents)
  if (!parents.some(entry => entry.path === path.dirname(target))) failRelease()
  try { mkdirSync(target, { mode: 0o700 }) }
  catch (error) { throw lostOwnership(error) }
  const fd = openSync(target, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = fstatSync(fd, { bigint: true }); const atPath = lstatSync(target, { bigint: true })
    if (!stat.isDirectory() || !atPath.isDirectory() || !equalIdentity(stat, atPath) || Number(stat.mode & 0o7777n) !== 0o700) failRelease()
    checkDirectoriesSync(parents)
    return { path: target, fd, stat }
  } catch (error) { closeSync(fd); throw lostOwnership(error) }
}
function readCheckedFileSync(target, maxBytes, mode) {
  const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
  try {
    const stat = fstatSync(fd, { bigint: true })
    if (!stat.isFile() || stat.nlink !== 1n || stat.size < 0n || stat.size > BigInt(maxBytes) || (mode !== undefined && Number(stat.mode & 0o7777n) !== mode)) failRelease()
    const bytes = Buffer.alloc(Number(stat.size)); let offset = 0
    while (offset < bytes.length) { const count = readSync(fd, bytes, offset, bytes.length - offset, offset); if (!count) failRelease(); offset += count }
    if (readSync(fd, Buffer.alloc(1), 0, 1, offset)) failRelease()
    assertSameOpenFile(stat, fstatSync(fd, { bigint: true }), 'owned file')
    assertSameOpenFile(stat, lstatSync(target, { bigint: true }), 'owned file')
    return { bytes, stat }
  } finally { closeSync(fd) }
}
function openNewFileSync(target, mode, parents) {
  checkDirectoriesSync(parents)
  if (!parents.some(entry => entry.path === path.dirname(target))) failRelease()
  let fd
  try { fd = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK, mode) }
  catch (error) { if (['EEXIST', 'ELOOP', 'ENOENT', 'ENOTDIR'].includes(error.code)) throw lostOwnership(error); throw error }
  try {
    const stat = fstatSync(fd, { bigint: true })
    if (!stat.isFile() || stat.nlink !== 1n || stat.size !== 0n || Number(stat.mode & 0o7777n) !== mode) failRelease()
    assertSameOpenFile(stat, lstatSync(target, { bigint: true }), 'new file')
    checkDirectoriesSync(parents)
    return { fd, stat }
  } catch (error) { closeSync(fd); throw lostOwnership(error) }
}
function writeOpenedFileSync(target, file, bytes, parents) {
  try {
  checkDirectoriesSync(parents)
  assertSameOpenFile(file.stat, fstatSync(file.fd, { bigint: true }), 'new file')
  assertSameOpenFile(file.stat, lstatSync(target, { bigint: true }), 'new file')
  let offset = 0
  while (offset < bytes.length) { const count = writeSync(file.fd, bytes, offset, bytes.length - offset, offset); if (!count) failRelease(); offset += count }
  const stat = fstatSync(file.fd, { bigint: true })
  if (!equalIdentity(file.stat, stat) || stat.nlink !== 1n || stat.size !== BigInt(bytes.length) || stat.mode !== file.stat.mode) failRelease()
  assertSameOpenFile(stat, lstatSync(target, { bigint: true }), 'written file'); checkDirectoriesSync(parents)
  return stat
  } catch (error) { throw lostOwnership(error) }
}
function writeNewFileSync(target, bytes, mode, parents) {
  const file = openNewFileSync(target, mode, parents)
  try { return writeOpenedFileSync(target, file, bytes, parents) } finally { closeSync(file.fd) }
}
async function stableRead(file, maxBytes, mode, consume) {
  const ancestors = await holdDirectories(path.dirname(file))
  let handle
  try {
    // A FIFO must reach fstat without waiting for a writer.
    handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
    const before = await handle.stat({ bigint: true })
    if (!before.isFile() || before.nlink !== 1n) failRelease()
    if (before.size < 0n || before.size > BigInt(maxBytes)) throw new Error('bounded-file-size-invalid')
    if (mode !== undefined && Number(before.mode & 0o7777n) !== mode) failRelease()
    const bytes = Buffer.alloc(Number(before.size)); let offset = 0
    while (offset < bytes.length) {
      const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset)
      if (bytesRead === 0) failRelease()
      offset += bytesRead
    }
    const probe = Buffer.alloc(1)
    if ((await handle.read(probe, 0, 1, offset)).bytesRead !== 0) failRelease()
    const after = await handle.stat({ bigint: true }); const atPath = await lstat(file, { bigint: true })
    assertSameOpenFile(before, after, 'file'); assertSameOpenFile(before, atPath, 'file')
    await checkDirectories(ancestors)
    if (consume) await consume({ bytes, stat: before, ancestors, handle })
    return { bytes, stat: before }
  } finally { await handle?.close(); await closeDirectories(ancestors) }
}

function octal(bytes) {
  let result = 0; let digits = 0; let padding = false
  for (const byte of bytes) {
    if (!padding && byte >= 48 && byte <= 55) { result = result * 8 + byte - 48; digits++; continue }
    if (digits && (byte === 0 || byte === 32)) { padding = true; continue }
    failRelease()
  }
  if (!digits) failRelease()
  boundedNumber(result); return result
}
function fieldName(bytes) {
  const end = bytes.indexOf(0)
  if (end !== -1 && bytes.subarray(end).some(byte => byte !== 0)) failRelease()
  const used = end === -1 ? bytes : bytes.subarray(0, end)
  if (used.some(byte => byte < 32 || byte > 126)) failRelease()
  return used.toString('ascii')
}
export function inspectWorkbenchArchive(archive, metadata, frozenFiles) {
  if (!Buffer.isBuffer(archive) || archive.length < 18 || archive.length > MAX_PACKED_ARTIFACT_BYTES || archive[0] !== 31 || archive[1] !== 139) failRelease()
  let tar
  try { tar = gunzipSync(archive, { maxOutputLength: MAX_TAR_BYTES }) } catch { failRelease() }
  if (tar.length > MAX_TAR_BYTES || tar.length % 512 !== 0) failRelease()
  const members = new Map(); let offset = 0; let ended = false
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every(byte => byte === 0)) {
      if (offset + 1024 > tar.length || tar.subarray(offset).some(byte => byte !== 0)) failRelease()
      ended = true; break
    }
    const checksum = octal(header.subarray(148, 156))
    let calculated = 0
    for (let i = 0; i < 512; i++) calculated += i >= 148 && i < 156 ? 32 : header[i]
    if (checksum !== calculated || !header.subarray(257, 263).equals(Buffer.from('ustar\0')) || !header.subarray(263, 265).equals(Buffer.from('00'))) failRelease()
    const name = fieldName(header.subarray(0, 100))
    if (header.subarray(500, 512).some(byte => byte !== 0) || header.subarray(345, 500).some(byte => byte !== 0) || header.subarray(157, 257).some(byte => byte !== 0)) failRelease()
    const relative = WORKBENCH_PACKAGE_FILES.find(file => name === `package/${file}`)
    if (!relative || members.has(relative) || ![0, 48].includes(header[156])) failRelease()
    const mode = octal(header.subarray(100, 108)); const size = octal(header.subarray(124, 136))
    if (mode !== 0o644 || size > MAX_PACKAGE_FILE_BYTES) failRelease()
    const bodyStart = offset + 512; const bodyEnd = bodyStart + size
    const paddedEnd = bodyStart + Math.ceil(size / 512) * 512
    if (paddedEnd > tar.length || tar.subarray(bodyEnd, paddedEnd).some(byte => byte !== 0)) failRelease()
    const bytes = Buffer.from(tar.subarray(bodyStart, bodyEnd))
    const expected = metadata?.files.find(file => file.path === relative)
    if (metadata && (!expected || expected.size !== size || expected.mode !== mode)) failRelease()
    const frozen = frozenFiles?.find(file => file.path === relative)
    if (frozenFiles && (!frozen || !bytes.equals(frozen.bytes))) failRelease()
    members.set(relative, { path: relative, mode, size, sha256: sha256(bytes), bytes })
    offset = paddedEnd
  }
  if (!ended || !exact([...members.keys()].sort(comparePath), WORKBENCH_PACKAGE_FILES)) failRelease()
  return WORKBENCH_PACKAGE_FILES.map(name => members.get(name))
}

export function validateReleaseReceipt(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0 || bytes.length > MAX_RECEIPT_BYTES) failRelease()
  let receipt
  try { receipt = JSON.parse(bytes.toString('utf8')); if (!Buffer.from(canonicalJson(receipt)).equals(bytes)) failRelease() } catch { failRelease() }
  closed(receipt, ['schemaVersion', 'stage', 'owner', 'releaseId', 'sourceCommit', 'rootIdentity', 'package', 'sources', 'sourceInventorySha256', 'graphs', 'graphHashes', 'outputHashes', 'members', 'memberInventorySha256', 'tgz'])
  if (receipt.schemaVersion !== 1 || receipt.stage !== 'stage-3a' || receipt.owner !== packageName) failRelease()
  uuid(receipt.releaseId); commitHash(receipt.sourceCommit); identity(receipt.rootIdentity)
  closed(receipt.package, ['name', 'version', 'private'])
  if (!exact(receipt.package, { name: packageName, version: packageVersion, private: true })) failRelease()
  if (!Array.isArray(receipt.sources) || !exact(receipt.sources.map(s => s.path), WORKBENCH_RELEASE_SOURCE_PATHS)) failRelease()
  for (const source of receipt.sources) { closed(source, ['path', 'bytes', 'sha256']); boundedNumber(source.bytes, MAX_PACKAGE_FILE_BYTES); digest(source.sha256) }
  digest(receipt.sourceInventorySha256)
  if (receipt.sourceInventorySha256 !== sha256(canonicalJson(receipt.sources))) failRelease()
  closed(receipt.graphs, ['host', 'client']); closed(receipt.graphHashes, ['host', 'client'])
  for (const role of ['host', 'client']) {
    assertCanonicalProductGraph(receipt.graphs[role], role); digest(receipt.graphHashes[role])
    if (receipt.graphHashes[role] !== sha256(canonicalJson(receipt.graphs[role]))) failRelease()
    for (const input of receipt.graphs[role].inputs) {
      const source = receipt.sources.find(s => s.path === input.path)
      if (!source || source.bytes !== input.bytes || source.sha256 !== input.sha256) failRelease()
    }
  }
  closed(receipt.outputHashes, buildOutputPaths)
  if (!Array.isArray(receipt.members) || !exact(receipt.members.map(m => m.path), WORKBENCH_PACKAGE_FILES)) failRelease()
  for (const member of receipt.members) {
    closed(member, ['path', 'type', 'mode', 'bytes', 'sha256'])
    if (member.type !== 'file' || member.mode !== 420) failRelease()
    boundedNumber(member.bytes, MAX_PACKAGE_FILE_BYTES); digest(member.sha256)
    const source = receipt.sources.find(s => s.path === `packages/workbench/${member.path}`)
    if (source && (source.bytes !== member.bytes || source.sha256 !== member.sha256)) failRelease()
  }
  for (const output of buildOutputPaths) {
    digest(receipt.outputHashes[output]); const member = receipt.members.find(m => m.path === output)
    if (receipt.outputHashes[output] !== member.sha256) failRelease()
  }
  const host = receipt.members.find(m => m.path === 'lib/index.js')
  if (host.sha256 !== receipt.graphs.host.output.sha256 || host.bytes !== receipt.graphs.host.output.bytes) failRelease()
  digest(receipt.memberInventorySha256)
  if (receipt.memberInventorySha256 !== sha256(canonicalJson(receipt.members))) failRelease()
  closed(receipt.tgz, ['filename', 'bytes', 'sha256']); digest(receipt.tgz.sha256); boundedNumber(receipt.tgz.bytes, MAX_PACKED_ARTIFACT_BYTES)
  if (receipt.tgz.filename !== packageFilename || receipt.tgz.bytes < 1) failRelease()
  return receipt
}
function validateReceiptArchive(receipt, tgz) {
  if (tgz.length !== receipt.tgz.bytes || sha256(tgz) !== receipt.tgz.sha256) failRelease()
  const members = inspectWorkbenchArchive(tgz)
  for (const member of members) {
    const record = receipt.members.find(m => m.path === member.path)
    if (record.bytes !== member.size || record.sha256 !== member.sha256 || record.mode !== member.mode) failRelease()
    assertNoStorageGateDiagnostics(member.bytes); assertProductPackageBytes(member.bytes)
  }
  const client = members.find(m => m.path === 'lib/client.js').bytes
  const prefix = Buffer.from("window.__ModuleLoader__.load({ id:'@knight/dsh-pm-workbench', factory(require) { const module={exports:{}}; const exports=module.exports; ")
  const suffix = Buffer.from('; return module.exports; } });\n')
  if (!client.subarray(0, prefix.length).equals(prefix) || !client.subarray(-suffix.length).equals(suffix)) failRelease()
  const raw = client.subarray(prefix.length, -suffix.length)
  if (raw.length !== receipt.graphs.client.output.bytes || sha256(raw) !== receipt.graphs.client.output.sha256 || !wrapProductClient(raw).equals(client)) failRelease()
  return members
}

function gitInvocation(args) {
  return ['git', ['--no-optional-locks', '-c', 'core.fsmonitor=false', ...args], {
    cwd: defaultRepositoryRoot, env: { PATH: process.env.PATH ?? '/usr/bin:/bin', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' },
    encoding: 'buffer', timeout: 10_000, maxBuffer: 3 * 1024 * 1024, stdio: 'pipe',
  }]
}
async function gitRead(args, guard) {
  await guard?.()
  const result = await execFile(...gitInvocation(args))
  await guard?.()
  return Buffer.from(result.stdout)
}
async function cleanCommit(expected, guard) {
  if ((await gitRead(['rev-parse', '--show-toplevel'], guard)).toString().trim() !== defaultRepositoryRoot) failRelease()
  const commit = (await gitRead(['rev-parse', '--verify', 'HEAD'], guard)).toString().trim(); commitHash(commit)
  if (expected && commit !== expected) failRelease()
  if ((await gitRead(['status', '--porcelain=v1', '-z', '--untracked-files=all'], guard)).length !== 0) failRelease()
  return commit
}
async function snapshotSources(commit, guard) {
  const map = new Map(); const records = []; const identities = new Map()
  for (const name of WORKBENCH_RELEASE_SOURCE_PATHS) {
    await guard?.()
    const value = await stableRead(path.join(defaultRepositoryRoot, name), MAX_PACKAGE_FILE_BYTES)
    if (!name.startsWith('node_modules/zod/') && commit) {
      const committed = await gitRead(['show', `${commit}:${name}`], guard)
      if (!committed.equals(value.bytes)) failRelease()
    }
    map.set(name, value.bytes); identities.set(name, value.stat)
    records.push({ path: name, bytes: value.bytes.length, sha256: sha256(value.bytes) })
  }
  assertElidedProductTypeImport(map); await assertZodVersion(map)
  return { map, records, identities }
}
async function recheckSources(before, commit, guard) {
  const after = await snapshotSources(commit, guard)
  if (!exact(before.records, after.records)) failRelease()
  for (const [name, stat] of before.identities) assertSameOpenFile(stat, after.identities.get(name), 'source')
}
async function absent(target) {
  try { await lstat(target); failRelease() } catch (error) { if (error.code !== 'ENOENT') throw error }
}
// Promise continuations can run after an async reader's final seal. Recheck the
// original generation, source bytes and current ancestry at each public handoff.
function sealReleaseGenerationSync(data, checkSources = true) {
  const reopened = reopenDirectoriesSync(data.ancestors)
  const sourceParents = new Map()
  try {
    // HEAD can change without changing a source byte. Keep this bounded read-only
    // Git predicate in the same non-yielding seal, including cleanup capabilities.
    execFileSync(...gitInvocation(['merge-base', '--is-ancestor', data.sourceCommit, 'HEAD']))
    if (!exact(readdirSync(data.releaseRoot).sort(comparePath), [packageFilename, 'receipt.json'])) failRelease()
    for (const [name, file, bound] of [['receipt.json', data.receiptFile, MAX_RECEIPT_BYTES], [packageFilename, data.tgzFile, MAX_PACKED_ARTIFACT_BYTES]]) {
      const current = readCheckedFileSync(path.join(data.releaseRoot, name), bound, 0o600)
      assertSameOpenFile(file.stat, current.stat, 'retained file at handoff')
      if (!current.bytes.equals(file.bytes)) failRelease()
    }
    // C35 retirement intentionally skips only current checkout source equality.
    if (checkSources) for (const source of data.receipt.sources) {
      let parent = defaultRepositoryRoot
      for (const part of source.path.split('/').slice(0, -1)) {
        parent = path.join(parent, part)
        if (!sourceParents.has(parent)) {
          const fd = openSync(parent, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
          let retained = false
          try {
            const entry = { path: parent, fd, stat: fstatSync(fd, { bigint: true }) }
            checkDirectoriesSync([entry]); sourceParents.set(parent, entry); retained = true
          } finally { if (!retained) closeSync(fd) }
        }
      }
      const current = readCheckedFileSync(path.join(defaultRepositoryRoot, source.path), MAX_PACKAGE_FILE_BYTES)
      if (current.bytes.length !== source.bytes || sha256(current.bytes) !== source.sha256) failRelease()
    }
    checkDirectoriesSync([...reopened, ...sourceParents.values()])
  } finally { for (const entry of [...sourceParents.values(), ...reopened]) closeSync(entry.fd) }
}
const capabilities = new WeakMap()
function capabilityFor(data, purpose = 'consume') {
  sealReleaseGenerationSync(data, purpose === 'consume')
  const capability = Object.freeze(Object.create(null)); capabilities.set(capability, { ...data, purpose }); return capability
}
async function assertCommittedReceiptSources(receipt) {
  const committedSources = new Map()
  for (const source of receipt.sources) {
    if (source.path.startsWith('node_modules/zod/')) continue
    const bytes = await gitRead(['show', `${receipt.sourceCommit}:${source.path}`])
    if (bytes.length !== source.bytes || sha256(bytes) !== source.sha256) failRelease()
    committedSources.set(source.path, bytes)
  }
  assertElidedProductTypeImport(committedSources)
}
async function readReleaseGeneration({ releaseRoot, sourceCommit, receiptSha256 }, checkSources = true) {
  if (releaseRoot !== releaseCanonicalRoot) failRelease()
  commitHash(sourceCommit); digest(receiptSha256)
  const ancestors = await holdDirectories(releaseRoot)
  let result
  try {
    const rootStat = ancestors.at(-1).stat
    if (Number(rootStat.mode & 0o7777n) !== 0o700) failRelease()
    if (!exact((await readdir(releaseRoot)).sort(comparePath), [packageFilename, 'receipt.json'])) failRelease()
    const receiptFile = await stableRead(path.join(releaseRoot, 'receipt.json'), MAX_RECEIPT_BYTES, 0o600)
    if (sha256(receiptFile.bytes) !== receiptSha256) failRelease()
    const receipt = validateReleaseReceipt(receiptFile.bytes)
    if (receipt.sourceCommit !== sourceCommit || !exact(receipt.rootIdentity, directoryIdentity(rootStat))) failRelease()
    const tgzFile = await stableRead(path.join(releaseRoot, packageFilename), MAX_PACKED_ARTIFACT_BYTES, 0o600)
    validateReceiptArchive(receipt, tgzFile.bytes)
    await gitRead(['merge-base', '--is-ancestor', sourceCommit, 'HEAD'])
    if (checkSources) {
      const sources = await snapshotSources(sourceCommit)
      if (!exact(sources.records, receipt.sources)) failRelease()
    } else await assertCommittedReceiptSources(receipt)
    await checkDirectories(ancestors)
    if (!exact((await readdir(releaseRoot)).sort(comparePath), [packageFilename, 'receipt.json'])) failRelease()
    for (const [name, file] of [['receipt.json', receiptFile], [packageFilename, tgzFile]]) assertSameOpenFile(file.stat, await lstat(path.join(releaseRoot, name), { bigint: true }), 'retained file')
    result = { releaseRoot, sourceCommit, receiptSha256, receipt, rootStat, receiptFile, tgzFile, ancestors: ancestors.map(({ path, stat }) => ({ path, stat })) }
    return result
  } finally {
    await closeDirectories(ancestors)
    if (result) sealReleaseGenerationSync(result, checkSources)
  }
}
export async function readWorkbenchRelease(options) {
  try {
    closed(options, ['releaseRoot', 'sourceCommit', 'receiptSha256'])
    return capabilityFor(await readReleaseGeneration(options))
  } catch { failRelease() }
}
// Retirement may outlive a bound source edit, but cannot grant archive consumption.
export async function readWorkbenchReleaseForCleanup(options) {
  try {
    closed(options, ['releaseRoot', 'sourceCommit', 'receiptSha256'])
    return capabilityFor(await readReleaseGeneration(options, false), 'cleanup')
  } catch { failRelease() }
}
function requireCapability(capability) { const data = capabilities.get(capability); if (!data) failRelease(); return data }
async function revalidateCapability(capability, checkSources) {
  const before = requireCapability(capability)
  const after = await readReleaseGeneration({ releaseRoot: before.releaseRoot, sourceCommit: before.sourceCommit, receiptSha256: before.receiptSha256 }, checkSources)
  if (!equalIdentity(before.rootStat, after.rootStat)) failRelease()
  assertSameOpenFile(before.receiptFile.stat, after.receiptFile.stat, 'retained receipt')
  assertSameOpenFile(before.tgzFile.stat, after.tgzFile.stat, 'retained artifact')
  sealReleaseGenerationSync(before, checkSources)
  return after
}
export async function withWorkbenchReleaseTgz(capability, consume) {
  if (typeof consume !== 'function' || requireCapability(capability).purpose !== 'consume') failRelease()
  const data = await revalidateCapability(capability, true)
  const tgzPath = path.join(data.releaseRoot, packageFilename)
  sealReleaseGenerationSync(requireCapability(capability))
  const result = await consume(tgzPath)
  await revalidateCapability(capability, true)
  sealReleaseGenerationSync(requireCapability(capability))
  return result
}
async function inventoryTree(root) {
  const records = []
  async function visit(target, relative) {
    const stat = await lstat(target, { bigint: true })
    if (stat.isSymbolicLink()) failRelease()
    if (stat.isDirectory()) {
      records.push({ path: relative, directory: true, identity: directoryIdentity(stat), mode: Number(stat.mode & 0o7777n) })
      for (const name of (await readdir(target)).sort(comparePath)) await visit(path.join(target, name), relative ? `${relative}/${name}` : name)
    } else {
      const file = await stableRead(target, MAX_PACKED_ARTIFACT_BYTES)
      records.push({ path: relative, directory: false, identity: directoryIdentity(file.stat), mode: Number(file.stat.mode & 0o7777n), bytes: file.bytes.length, sha256: sha256(file.bytes), mtimeNs: file.stat.mtimeNs.toString(), ctimeNs: file.stat.ctimeNs.toString() })
    }
    if (records.length > 4096) failRelease()
  }
  await visit(root, '')
  return records
}
async function removeVerifiedTree(root, records) {
  if (!exact(await inventoryTree(root), records)) failRelease()
  for (const item of [...records].reverse()) {
    const target = item.path ? path.join(root, item.path) : root
    const stat = await lstat(target, { bigint: true })
    if (!exact(item.identity, directoryIdentity(stat)) || stat.isSymbolicLink()) failRelease()
    if (item.directory) {
      const parents = await holdDirectories(path.dirname(target))
      try {
        if ((await readdir(target)).length !== 0) failRelease()
        // The last async seam is above. Validate the held parents and target without yielding.
        checkDirectoriesSync(parents)
        for (const entry of parents) {
          const relative = path.relative(root, entry.path)
          if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
            const expected = records.find(record => record.directory && record.path === relative)
            if (!expected || !exact(expected.identity, directoryIdentity(entry.stat)) || expected.mode !== Number(entry.stat.mode & 0o7777n)) failRelease()
          }
        }
        const fd = openSync(target, constants.O_RDONLY | constants.O_DIRECTORY | constants.O_NOFOLLOW | constants.O_NONBLOCK)
        try {
          const held = fstatSync(fd, { bigint: true }); const current = lstatSync(target, { bigint: true })
          if (!held.isDirectory() || !current.isDirectory() || !exact(item.identity, directoryIdentity(held))
            || !equalIdentity(held, current) || Number(held.mode & 0o7777n) !== item.mode || readdirSync(target).length !== 0) failRelease()
          rmdirSync(target); absentSync(target); checkDirectoriesSync(parents)
        } finally { closeSync(fd) }
      } finally { await closeDirectories(parents) }
    }
    else {
      // Keep both the opened file and its no-follow parent handles alive until unlink.
      await stableRead(target, MAX_PACKED_ARTIFACT_BYTES, item.mode, async file => {
        if (!exact(item.identity, directoryIdentity(file.stat)) || file.stat.mtimeNs.toString() !== item.mtimeNs
          || file.stat.ctimeNs.toString() !== item.ctimeNs || file.bytes.length !== item.bytes || sha256(file.bytes) !== item.sha256) failRelease()
        for (const ancestor of file.ancestors) {
          const relative = path.relative(root, ancestor.path)
          if (relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))) {
            const expected = records.find(record => record.directory && record.path === relative)
            if (!expected || !exact(expected.identity, directoryIdentity(ancestor.stat)) || expected.mode !== Number(ancestor.stat.mode & 0o7777n)) failRelease()
          }
        }
        await checkDirectories(file.ancestors)
        assertSameOpenFile(file.stat, await lstat(target, { bigint: true }), 'cleanup file')
        checkDirectoriesSync(file.ancestors)
        assertSameOpenFile(file.stat, fstatSync(file.handle.fd, { bigint: true }), 'cleanup file')
        assertSameOpenFile(file.stat, lstatSync(target, { bigint: true }), 'cleanup file')
        unlinkSync(target)
        const removed = fstatSync(file.handle.fd, { bigint: true })
        if (!equalIdentity(file.stat, removed) || removed.nlink !== 0n) failRelease()
        absentSync(target); checkDirectoriesSync(file.ancestors)
      })
    }
  }
  await absent(root)
}
function quarantineTreeSync(root, quarantine, rootEntry, parents) {
  checkDirectoriesSync(parents)
  const rootStat = rootEntry.stat
  const held = fstatSync(rootEntry.handle ? rootEntry.handle.fd : rootEntry.fd, { bigint: true })
  const current = lstatSync(root, { bigint: true })
  if (!current.isDirectory() || !held.isDirectory() || !equalIdentity(rootStat, held) || held.mode !== rootStat.mode
    || !equalIdentity(rootStat, current) || current.mode !== rootStat.mode) failRelease()
  absentSync(quarantine)
  renameSync(root, quarantine)
  const moved = lstatSync(quarantine, { bigint: true })
  if (!moved.isDirectory() || !equalIdentity(rootStat, moved) || moved.mode !== rootStat.mode) failRelease()
  absentSync(root); checkDirectoriesSync(parents)
}
export async function cleanupWorkbenchRelease(capability) {
  const data = await revalidateCapability(capability, false)
  const records = await inventoryTree(data.releaseRoot)
  const quarantine = `${data.releaseRoot}.cleanup-${data.receipt.releaseId}`
  const held = await holdDirectories(data.releaseRoot)
  let removed = false
  try {
    const rootEntry = held.at(-1)
    if (!equalIdentity(data.rootStat, rootEntry.stat) || data.rootStat.mode !== rootEntry.stat.mode) failRelease()
    await absent(quarantine)
    await revalidateCapability(capability, false)
    sealReleaseGenerationSync(requireCapability(capability), false)
    quarantineTreeSync(data.releaseRoot, quarantine, rootEntry, held.slice(0, -1))
    if (!exact(await inventoryTree(quarantine), records)) failRelease()
    await removeVerifiedTree(quarantine, records)
    await absent(data.releaseRoot)
    removed = true
  } finally {
    await closeDirectories(held)
    if (removed) {
      const parents = reopenDirectoriesSync(held.slice(0, -1))
      try {
        absentSync(data.releaseRoot); absentSync(quarantine); checkDirectoriesSync(parents)
        capabilities.delete(capability)
      } finally { for (const entry of parents) closeSync(entry.fd) }
    }
  }
}

export async function createWorkbenchRelease(releaseRoot) {
  let owned; let ancestors
  try {
    if (releaseRoot !== releaseCanonicalRoot || await realpath(defaultRepositoryRoot) !== defaultRepositoryRoot) failRelease()
    ancestors = await holdDirectories(path.dirname(releaseRoot))
    await absent(releaseRoot)
    const sourceCommit = await cleanCommit()
    await gitRead(['check-ignore', '-q', releaseRelative])
    const sources = await snapshotSources(sourceCommit)
    await cleanCommit(sourceCommit)
    await checkDirectories(ancestors); await absent(releaseRoot)
    const rootEntry = createDirectorySync(releaseRoot, ancestors)
    const rootStat = rootEntry.stat
    const releaseId = randomUUID()
    const marker = { schemaVersion: 1, owner: packageName, releaseId, sourceCommit, rootIdentity: directoryIdentity(rootStat) }
    const markerBytes = Buffer.from(canonicalJson(marker))
    owned = { rootEntry, rootStat, releaseId, markerBytes, markerReady: false, directories: [], inventory: new Map() }
    const recordDirectory = entry => owned.inventory.set(path.relative(releaseRoot, entry.path), Object.freeze({
      path: path.relative(releaseRoot, entry.path), directory: true, identity: directoryIdentity(entry.stat), mode: Number(entry.stat.mode & 0o7777n),
    }))
    const recordFile = (target, stat, bytes) => owned.inventory.set(path.relative(releaseRoot, target), Object.freeze({
      path: path.relative(releaseRoot, target), directory: false, identity: directoryIdentity(stat), mode: Number(stat.mode & 0o7777n),
      bytes: bytes.length, sha256: sha256(bytes), mtimeNs: stat.mtimeNs.toString(), ctimeNs: stat.ctimeNs.toString(),
    }))
    const cleanupRecords = () => Object.freeze([...owned.inventory.values()].sort((left, right) => comparePath(left.path, right.path)))
    owned.cleanupRecords = cleanupRecords
    const checkRecordedPathsSync = () => {
      try {
        const records = cleanupRecords()
        for (const record of records) {
          const target = record.path ? path.join(releaseRoot, record.path) : releaseRoot
          const stat = lstatSync(target, { bigint: true })
          if (stat.isSymbolicLink() || !exact(record.identity, directoryIdentity(stat)) || Number(stat.mode & 0o7777n) !== record.mode
            || (record.directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1n || stat.size !== BigInt(record.bytes)
              || stat.mtimeNs.toString() !== record.mtimeNs || stat.ctimeNs.toString() !== record.ctimeNs)) failRelease()
          if (record.directory) {
            const children = records.filter(item => item.path !== record.path && path.posix.dirname(item.path) === (record.path || '.')).map(item => path.posix.basename(item.path)).sort(comparePath)
            if (!exact(readdirSync(target).sort(comparePath), children)) failRelease()
          }
        }
      } catch (error) { throw lostOwnership(error) }
    }
    owned.checkRecordedPathsSync = checkRecordedPathsSync
    recordDirectory(rootEntry)
    const ownedParents = () => [...ancestors, rootEntry, ...owned.directories]
    owned.markerStat = writeNewFileSync(path.join(releaseRoot, '.owner.json'), markerBytes, 0o600, ownedParents())
    recordFile(path.join(releaseRoot, '.owner.json'), owned.markerStat, markerBytes)
    owned.markerReady = true
    const assertOwned = async () => {
      try {
      await checkDirectories(ancestors)
      const current = await lstat(releaseRoot, { bigint: true }); const held = fstatSync(rootEntry.fd, { bigint: true })
      if (!current.isDirectory() || !equalIdentity(rootStat, current) || !equalIdentity(rootStat, held) || Number(current.mode & 0o7777n) !== 0o700) failRelease()
      const currentMarker = await stableRead(path.join(releaseRoot, '.owner.json'), 4096, 0o600)
      if (!currentMarker.bytes.equals(markerBytes)) failRelease()
      assertSameOpenFile(owned.markerStat, currentMarker.stat, 'owner marker')
      await checkDirectories(owned.directories)
      checkRecordedPathsSync()
      } catch (error) { throw lostOwnership(error) }
    }
    const assertOwnedSync = () => {
      try {
      checkDirectoriesSync(ownedParents())
      const marker = readCheckedFileSync(path.join(releaseRoot, '.owner.json'), 4096, 0o600)
      assertSameOpenFile(owned.markerStat, marker.stat, 'owner marker')
      if (!marker.bytes.equals(markerBytes)) failRelease()
      checkRecordedPathsSync()
      } catch (error) { throw lostOwnership(error) }
    }
    owned.assertOwned = assertOwned
    const retainDirectory = async (target, expectedStat) => {
      try {
      await assertOwned()
      if (path.resolve(target) !== target || owned.directories.some(entry => entry.path === target)
        || (path.dirname(target) !== releaseRoot && !owned.directories.some(entry => entry.path === path.dirname(target)))) failRelease()
      assertOwnedSync()
      const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_DIRECTORY | constants.O_NONBLOCK)
      let retained = false
      try {
        const stat = fstatSync(fd, { bigint: true }); const atPath = lstatSync(target, { bigint: true })
        if (!expectedStat || !equalIdentity(expectedStat, stat) || expectedStat.mode !== stat.mode
          || !stat.isDirectory() || !atPath.isDirectory() || atPath.isSymbolicLink() || !equalIdentity(stat, atPath) || Number(stat.mode & 0o7777n) !== 0o700) failRelease()
        const entry = { path: target, fd, stat }
        owned.directories.push(entry); recordDirectory(entry); retained = true
        await assertOwned()
      } catch (error) { throw lostOwnership(error) }
      finally { if (!retained) closeSync(fd) }
      } catch (error) { throw lostOwnership(error) }
    }
    const mkdirOwned = async target => {
      try {
      await assertOwned()
      assertOwnedSync()
      const entry = createDirectorySync(target, ownedParents())
      owned.directories.push(entry); recordDirectory(entry)
      } catch (error) { throw lostOwnership(error) }
    }
    const writeStagedFile = async (target, bytes) => {
      try {
      await assertOwned()
      if (!owned.directories.some(entry => entry.path === path.dirname(target))) failRelease()
      assertOwnedSync()
      const file = openNewFileSync(target, 0o644, ownedParents())
      recordFile(target, file.stat, Buffer.alloc(0))
      try {
        await assertOwned()
        assertOwnedSync()
        const after = writeOpenedFileSync(target, file, bytes, ownedParents())
        recordFile(target, after, bytes)
        await assertOwned()
        assertOwnedSync()
        assertSameOpenFile(after, fstatSync(file.fd, { bigint: true }), 'staged file')
        assertSameOpenFile(after, lstatSync(target, { bigint: true }), 'staged file')
      } catch (error) { throw lostOwnership(error) }
      finally { closeSync(file.fd) }
      } catch (error) { throw lostOwnership(error) }
    }
    const acceptPackRecordsSync = records => {
      try {
        if (!records) return
        // These records were frozen in the packer's trusted synchronous interval,
        // not discovered here. Transfer them before this callback's first await.
        for (const record of records) {
          const relative = path.relative(releaseRoot, record.path)
          if (relative !== '.work/pack' && !relative.startsWith('.work/pack/')) failRelease()
          const expected = Object.freeze({ ...record, path: relative })
          const prior = owned.inventory.get(relative)
          if (prior && !exact(prior, expected)) failRelease()
          owned.inventory.set(relative, expected)
        }
        assertOwnedSync()
      } catch (error) { throw lostOwnership(error) }
    }
    await assertOwned()
    const work = path.join(releaseRoot, '.work'); await mkdirOwned(work)
    owned.workStat = owned.directories.find(entry => entry.path === work).stat
    let buildEvidence
    try { buildEvidence = await compileProductSnapshots(sources.map, assertOwned) } finally { stopProductCompiler() }
    await assertOwned()
    const stagedRoot = path.join(work, 'package'); await mkdirOwned(stagedRoot)
    // Every directory is derived only from the fixed package inventory and goes
    // through the same owned-handle checks, including nested Skill resources.
    const stagedDirectories = [...new Set(WORKBENCH_PACKAGE_FILES.flatMap(name => {
      const segments = name.split('/').slice(0, -1)
      return segments.map((_segment, index) => segments.slice(0, index + 1).join('/'))
    }))].sort((left, right) => left.split('/').length - right.split('/').length || comparePath(left, right))
    for (const relative of stagedDirectories) await mkdirOwned(path.join(stagedRoot, relative))
    const frozen = []
    for (const name of WORKBENCH_PACKAGE_FILES) {
      await assertOwned()
      const bytes = buildEvidence.outputBytes[name] ?? sources.map.get(`packages/workbench/${name}`)
      if (!Buffer.isBuffer(bytes)) failRelease()
      await writeStagedFile(path.join(stagedRoot, name), bytes)
      frozen.push({ path: name, bytes })
    }
    await verifyBuiltWorkbenchPackage({ packageRoot: stagedRoot, buildEvidence })
    const operationRoot = path.join(work, 'pack'); await mkdirOwned(operationRoot)
    const npmCliPath = process.env.npm_execpath
    if (!npmCliPath || !path.isAbsolute(npmCliPath)) failRelease()
    const { runNpmPack } = await import('./pack-dry.mjs')
    await assertOwned()
    // Exactly one real offline/no-script pack of the fixed package files.
    const packed = await runNpmPack({ nodeExecutable: await realpath(process.execPath), npmCliPath: await realpath(npmCliPath), stagedPackageRoot: stagedRoot, operationRoot, dryRun: false,
      ownershipGuard: async (createdDirectory, createdStat, records) => { acceptPackRecordsSync(records); await assertOwned(); if (createdDirectory) await retainDirectory(createdDirectory, createdStat); await assertOwned() } })
    await assertOwned()
    const artifact = await stableRead(packed.tgzAbsolutePath, MAX_PACKED_ARTIFACT_BYTES)
    const members = inspectWorkbenchArchive(artifact.bytes, packed.metadata, frozen)
    for (const file of frozen) if (!(await stableRead(path.join(stagedRoot, file.path), MAX_PACKAGE_FILE_BYTES)).bytes.equals(file.bytes)) failRelease()
    await recheckSources(sources, sourceCommit, assertOwned)
    await cleanCommit(sourceCommit, assertOwned)
    const memberRecords = members.map(m => ({ path: m.path, type: 'file', mode: 420, bytes: m.size, sha256: m.sha256 }))
    const receipt = {
      schemaVersion: 1, stage: 'stage-3a', owner: packageName, releaseId, sourceCommit,
      rootIdentity: directoryIdentity(rootStat), package: { name: packageName, version: packageVersion, private: true },
      sources: sources.records, sourceInventorySha256: sha256(canonicalJson(sources.records)),
      graphs: buildEvidence.graphs, graphHashes: buildEvidence.graphHashes, outputHashes: buildEvidence.outputHashes,
      members: memberRecords, memberInventorySha256: sha256(canonicalJson(memberRecords)),
      tgz: { filename: packageFilename, bytes: artifact.bytes.length, sha256: sha256(artifact.bytes) },
    }
    const receiptBytes = Buffer.from(canonicalJson(receipt)); validateReleaseReceipt(receiptBytes); validateReceiptArchive(receipt, artifact.bytes)
    await assertOwned(); assertOwnedSync()
    recordFile(path.join(releaseRoot, packageFilename), writeNewFileSync(path.join(releaseRoot, packageFilename), artifact.bytes, 0o600, ownedParents()), artifact.bytes)
    if (!equalIdentity(owned.workStat, await lstat(work, { bigint: true }))) failRelease()
    const transient = cleanupRecords().filter(record => record.path === '.work' || record.path.startsWith('.work/')).map(record => ({ ...record, path: record.path === '.work' ? '' : record.path.slice('.work/'.length) }))
    await assertOwned(); await removeVerifiedTree(work, transient)
    for (const relative of owned.inventory.keys()) if (relative === '.work' || relative.startsWith('.work/')) owned.inventory.delete(relative)
    await closeDirectories(owned.directories); owned.directories = []
    // Source and HEAD binding are rechecked immediately before the closed receipt is published.
    await recheckSources(sources, sourceCommit, assertOwned); await cleanCommit(sourceCommit, assertOwned)
    await assertOwned(); assertOwnedSync()
    recordFile(path.join(releaseRoot, 'receipt.json'), writeNewFileSync(path.join(releaseRoot, 'receipt.json'), receiptBytes, 0o600, ownedParents()), receiptBytes)
    owned.finalEvidence = { releaseRoot, sourceCommit, receiptSha256: sha256(receiptBytes) }
    await assertOwned(); assertOwnedSync()
    unlinkSync(path.join(releaseRoot, '.owner.json')); absentSync(path.join(releaseRoot, '.owner.json'))
    owned.inventory.delete('.owner.json'); owned.final = true
    const receiptSha256 = sha256(receiptBytes)
    await readReleaseGeneration({ releaseRoot, sourceCommit, receiptSha256 })
    checkDirectoriesSync([...ancestors, rootEntry]); checkRecordedPathsSync()
    owned.completed = true
    return Object.freeze({ status: 'verified', kind: 'release', releaseId, sourceCommit, tgzSha256: receipt.tgz.sha256, receiptSha256 })
  } catch (error) {
    if (owned && error?.[ownershipLoss]) owned.ownershipLost = true
    if (owned?.markerReady && !owned.ownershipLost) {
      try {
        if (!owned.final) await owned.assertOwned()
        else { await checkDirectories([...ancestors, owned.rootEntry]); owned.checkRecordedPathsSync() }
        const records = owned.cleanupRecords()
        // A failure can only compare against earlier owned records, never create its authority.
        if (!exact(await inventoryTree(releaseRoot), records)) throw lostOwnership(new Error('owned inventory changed'))
        const quarantine = `${releaseRoot}.cleanup-${owned.releaseId}`
        await absent(quarantine)
        if (!owned.final) await owned.assertOwned()
        else await checkDirectories([...ancestors, owned.rootEntry])
        owned.checkRecordedPathsSync()
        quarantineTreeSync(releaseRoot, quarantine, owned.rootEntry, ancestors)
        await removeVerifiedTree(quarantine, records)
      } catch { owned.ownershipLost = true /* No new inventory is adopted after any failure. */ }
    }
    failRelease()
  } finally {
    if (owned) { await closeDirectories(owned.directories); closeSync(owned.rootEntry.fd) }
    if (ancestors) await closeDirectories(ancestors)
    if (owned?.completed) {
      // Async handle closure is also an ownership boundary. Reopen and compare
      // the original identities after the last await, then finish synchronously.
      let reopened = []
      try {
        reopened = reopenDirectoriesSync([...ancestors, owned.rootEntry])
        checkDirectoriesSync(reopened); owned.checkRecordedPathsSync()
      } catch { failRelease() }
      finally { for (const entry of reopened) closeSync(entry.fd) }
    }
  }
}

async function runVerifierCli() {
  const args = process.argv.slice(2)
  if (args.length !== 0 && !(args.length === 2 && args[0] === '--release-root' && path.isAbsolute(args[1]))) failRelease()
  if (args.length) { console.log(JSON.stringify(await createWorkbenchRelease(args[1]))); return }
  const npmCliPath = process.env.npm_execpath
  if (!npmCliPath || !path.isAbsolute(npmCliPath)) failRelease()
  const buildEvidence = await buildPackableWorkbench()
  const verified = await verifyBuiltWorkbenchPackage({ buildEvidence })
  const cacheParent = path.join(defaultRepositoryRoot, '.tmp', 'npm-cache'); await mkdir(cacheParent, { recursive: true })
  const operationRoot = await mkdtemp(path.join(cacheParent, 'verify-package-'))
  try {
    const { runNpmPack } = await import('./pack-dry.mjs')
    const packed = await runNpmPack({ nodeExecutable: await realpath(process.execPath), npmCliPath: await realpath(npmCliPath), stagedPackageRoot: path.join(defaultRepositoryRoot, 'packages/workbench'), operationRoot, dryRun: true })
    for (const file of verified.files) if (!(await readStablePackageFile(path.join(defaultRepositoryRoot, 'packages/workbench'), file.path)).bytes.equals(file.bytes)) failRelease()
    console.log(JSON.stringify({ files: packed.metadata.files.map(f => f.path), bundledZod: true, runtimeDependencies: 0, status: 'verified', kind: 'static' }, null, 2))
  } finally { await rm(operationRoot, { recursive: true, force: true }) }
}
const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) runVerifierCli().catch(() => { console.error('package-verification-failed'); process.exitCode = 1 })
