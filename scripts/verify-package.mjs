import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, mkdtemp, open, readFile, readdir, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import {
  assertClientProbeBuildGraph,
  assertHostProbeBuildGraph,
  buildPackableWorkbench,
} from '../packages/workbench/build.mjs'

const defaultRepositoryRoot = path.resolve(import.meta.dirname, '..')
const packageName = '@knight/dsh-pm-workbench'
const packageVersion = '0.1.0'
const packageFilename = 'knight-dsh-pm-workbench-0.1.0.tgz'
const buildOutputPaths = Object.freeze(['lib/client.js', 'lib/index.js'])
const sha256Pattern = /^[a-f0-9]{64}$/u
const MAX_PACKAGE_FILE_BYTES = 2 * 1024 * 1024
const MAX_PACKED_ARTIFACT_BYTES = 8 * 1024 * 1024

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
    if (before[field] !== after[field]) throw new Error(`${label} changed while it was read`)
  }
}

async function assertRealDirectory(directory, label) {
  const stats = await lstat(directory)
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a real directory`)
  }
}

async function readStablePackageFile(packageRoot, relative) {
  let ancestor = packageRoot
  await assertRealDirectory(ancestor, 'package root')
  const segments = relative.split('/')
  for (const segment of segments.slice(0, -1)) {
    ancestor = path.join(ancestor, segment)
    await assertRealDirectory(ancestor, `package ancestor for ${relative}`)
  }

  const absolute = path.join(packageRoot, ...segments)
  const handle = await open(absolute, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  try {
    const before = await handle.stat({ bigint: true })
    if (!before.isFile()) throw new Error(`package entry must be a regular file: ${relative}`)
    if (before.size < 0n || before.size > BigInt(MAX_PACKAGE_FILE_BYTES)) {
      throw new Error(`package entry exceeds maximum package file size: ${relative}`)
    }
    const bytes = await handle.readFile()
    if (bytes.byteLength > MAX_PACKAGE_FILE_BYTES) {
      throw new Error(`package entry grew beyond maximum package file size while read: ${relative}`)
    }
    const after = await handle.stat({ bigint: true })
    assertSameOpenFile(before, after, `package entry ${relative}`)
    if (BigInt(bytes.byteLength) !== before.size) {
      throw new Error(`package entry size changed while it was read: ${relative}`)
    }
    return {
      path: relative,
      mode: Number(before.mode & 0o7777n),
      size: bytes.byteLength,
      sha256: sha256(bytes),
      bytes,
    }
  } finally {
    await handle.close()
  }
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
  assertHostProbeBuildGraph(buildEvidence.hostMetafile)
  assertClientProbeBuildGraph(buildEvidence.clientMetafile)
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
  if (manifest.name !== packageName || manifest.version !== packageVersion) {
    throw new Error('invalid package identity')
  }
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
  const patch = byPath.get('cordis.patch.yml').bytes.toString('utf8')
  if ((patch.match(/^- insert:/gmu) ?? []).length !== 1) {
    throw new Error('patch must contain exactly one insert')
  }
  const zodLicense = (await readFile(path.join(repositoryRoot, 'node_modules/zod/LICENSE'), 'utf8')).trim()
  const thirdParty = byPath.get('docs/third-party.md').bytes.toString('utf8')
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
      || item.mode > 0o7777) {
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
  if (!Number.isSafeInteger(metadata?.size) || metadata.size < 1 || metadata.size > MAX_PACKED_ARTIFACT_BYTES) {
    throw new Error('npm pack exceeded the maximum packed artifact size')
  }
  await assertRealDirectory(packOutputRoot, 'pack output root')
  const entries = (await readdir(packOutputRoot)).sort(comparePath)
  if (JSON.stringify(entries) !== JSON.stringify([metadata?.filename])) {
    throw new Error('pack output root must contain exactly one expected tgz')
  }
  const outputPhysicalRoot = await realpath(packOutputRoot)
  const tgzAbsolutePath = path.join(outputPhysicalRoot, metadata.filename)
  if (path.dirname(tgzAbsolutePath) !== outputPhysicalRoot) {
    throw new Error('package filename escaped the pack output root')
  }

  const handle = await open(tgzAbsolutePath, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0))
  let bytes
  try {
    const before = await handle.stat({ bigint: true })
    if (!before.isFile() || before.nlink !== 1n) {
      throw new Error('packed artifact must be one regular single-link file')
    }
    if (before.size < 0n || before.size > BigInt(MAX_PACKED_ARTIFACT_BYTES)) {
      throw new Error('packed artifact exceeds the maximum packed artifact size')
    }
    if (before.size !== BigInt(metadata.size)) {
      throw new Error('packed artifact size differs from npm metadata')
    }
    bytes = await handle.readFile()
    if (bytes.byteLength > MAX_PACKED_ARTIFACT_BYTES) {
      throw new Error('packed artifact grew beyond the maximum packed artifact size while read')
    }
    const after = await handle.stat({ bigint: true })
    assertSameOpenFile(before, after, 'packed artifact')
  } finally {
    await handle.close()
  }

  if (bytes.byteLength !== metadata.size) throw new Error('packed artifact size differs from npm metadata')
  const shasum = createHash('sha1').update(bytes).digest('hex')
  if (shasum !== metadata.shasum) throw new Error('packed artifact shasum differs from npm metadata')
  const integrity = `sha512-${createHash('sha512').update(bytes).digest('base64')}`
  if (integrity !== metadata.integrity) throw new Error('packed artifact integrity differs from npm metadata')

  return Object.freeze({
    tgzAbsolutePath,
    tgzBytes: bytes.byteLength,
    sha256: sha256(bytes),
    shasum,
    integrity,
  })
}

async function runVerifierCli() {
  const npmCliPath = process.env.npm_execpath
  if (typeof npmCliPath !== 'string' || !path.isAbsolute(npmCliPath)) {
    throw new Error('npm run verify:package requires an absolute npm CLI entry')
  }
  const buildEvidence = await buildPackableWorkbench()
  const verified = await verifyBuiltWorkbenchPackage({ buildEvidence })
  const cacheParent = path.join(defaultRepositoryRoot, '.tmp', 'npm-cache')
  await mkdir(cacheParent, { recursive: true })
  const operationRoot = await mkdtemp(path.join(cacheParent, 'verify-package-'))
  try {
    const { runNpmPack } = await import('./pack-dry.mjs')
    const packed = await runNpmPack({
      nodeExecutable: process.execPath,
      npmCliPath,
      stagedPackageRoot: path.join(defaultRepositoryRoot, 'packages/workbench'),
      operationRoot,
      dryRun: true,
    })
    console.log(JSON.stringify({
      files: packed.metadata.files.map((file) => file.path),
      bundledZod: verified.bundledZod,
      runtimeDependencies: verified.runtimeDependencies,
      status: 'verified',
    }, null, 2))
  } finally {
    await rm(operationRoot, { recursive: true, force: true })
  }
}

const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) {
  runVerifierCli().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
