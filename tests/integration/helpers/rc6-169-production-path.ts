/**
 * Independent B2a helper for tests/integration/rc6-declaration-input.test.ts.
 *
 * It imports an exact source clone with only two fixture constants rewritten,
 * then calls its public prepareSelectedSource entrypoint with a complete
 * 169-record synthetic cacache-shaped source. It never calls npm, Harness,
 * the network, the user's cache, or the exported fixture-only writer.
 *
 * Suggested Vitest use:
 *
 *   await withSynthetic169ProductionPath(workspaceRoot, async (fixture) => {
 *     expect(fixture.result).toMatchObject({
 *       status: 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION',
 *     })
 *     expect(fixture.publication.indexFileCount).toBe(169)
 *     expect(fixture.publication.contentFileCount).toBe(169)
 *     expect(fixture.publication.contentBytes).toBe(fixture.selectedContentBytes)
 *   })
 */

import { createHash, randomUUID } from 'node:crypto'
import { constants as fsConstants, type BigIntStats } from 'node:fs'
import {
  chmod,
  copyFile,
  link,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

const PACKAGE_JSON_RELATIVE_PATH = 'tools/harness-rc6-declarations/package.json'
const PACKAGE_LOCK_RELATIVE_PATH = 'tools/harness-rc6-declarations/package-lock.json'
const PRODUCTION_SCRIPT_RELATIVE_PATH = 'scripts/accept-rc6-declaration-input.mjs'
const CANDIDATE_RELATIVE_PATH = '.tmp/dsh-pm-workbench/declaration-input-candidate'
const POINTER_RELATIVE_PATH = '.tmp/dsh-pm-workbench/declaration-input-source.json'
const BUNDLE_PARENT_RELATIVE_PATH = '.tmp/dsh-pm-workbench/declaration-input-source-bundles'
const LINK_FAULT_WRAPPER_RELATIVE_PATH = 'scripts/fs-promises-link-fault.mjs'
const FOREIGN_POINTER_TEMP_NAME =
  '.declaration-input-source-11111111111111111111111111111111.tmp'
const FOREIGN_BUNDLE_NAME = 'bundle-22222222222222222222222222222222'

const EXPECTED_LABEL = 'local-2026-09-05-rc6-declaration-lock-v1'
const EXPECTED_AUTHORIZATION_BASIS =
  'owner-continued-after-explicit-offline-rc6-preflight-update'
const EXPECTED_REGISTRY_COUNT = 169
const EXPECTED_DEEPSEEK_COUNT = 59
const EXPECTED_DSH_COUNT = 54
const EXPECTED_DSH_VERSION = '0.1.0-rc.6'
const EXPECTED_NESTED_COMMANDER_PATH = 'node_modules/katex/node_modules/commander'
const EXPECTED_NESTED_COMMANDER_VERSION = '8.3.0'
const EXPECTED_SELECTED_CONTENT_BYTES = 9_590_214
const EXPECTED_PACKAGE_JSON_RAW_SHA256 =
  '208bae9d2b2c0d67b2fa6b985d394cc1ce483e3a5cd226e391ca0a6b7f261cd1'
const EXPECTED_PACKAGE_JSON_CANONICAL_SHA256 =
  'ec3d67e9bcc952d225166c4290a0f4850038058b0ea62f1a9642ba8d6c7f593f'
const EXPECTED_PACKAGE_LOCK_RAW_SHA256 =
  'dde74c404cfbf8e7b1ec7cabece36d2aa2061f256770570f69c15f3064061ad1'
const EXPECTED_PACKAGE_LOCK_CANONICAL_SHA256 =
  'd99f9a20b594ca3bd825d33a17c5f4f3953de3589c2df7fd5d87e77cbea2ecd1'
const SOURCE_ONLY_METADATA_CANARY = 'dsh-source-only-metadata-canary-v1'
const SYNTHETIC_CONTENT_DOMAIN = 'dsh-pm-workbench/rc6-169-production-path/v1'
const CLIENT_COMPILER_OVERLAY_RELATIVE = 'tsconfig.surface.client.overlay.json'
const CLIENT_COMPILER_OVERLAY = {
  extends: './tsconfig.surface.client.json',
  compilerOptions: {
    paths: {
      react: ['./.compiler/node_modules/@types/react/index.d.ts'],
      'prop-types': ['./.compiler/node_modules/@types/prop-types/index.d.ts'],
      csstype: ['./.compiler/node_modules/csstype/index.d.ts'],
    },
  },
}

type JsonPrimitive = null | boolean | number | string
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }
type JsonObject = { [key: string]: JsonValue }

type SourceWitness = {
  path: string
  sha256: string
  size: string
  mode: number
  dev: string
  ino: string
  nlink: string
  mtimeNs: string
  ctimeNs: string
}

type StableSourceFile = {
  bytes: Buffer
  witness: SourceWitness
}

type SyntheticLockEntry = {
  lockPath: string
  name: string
  version: string
  resolved: string
  key: string
  integrity: string
  contentBytes: Buffer
}

type PrepareResult = {
  status: string
  [key: string]: unknown
}

type AcceptanceModule = {
  prepareSelectedSource(options: { workspaceRoot: string }): Promise<PrepareResult>
  stageRc6DeclarationInputV2(options: { workspaceRoot: string }): Promise<any>
  mapPublicInputError(error: unknown): { status: string; reasonCode: string }
}

type ReplayCallEvidence = {
  file: string
  args: string[]
  env: Record<string, string>
  cwd: string | null
  timeout: number | null
  maxBuffer: number | null
}

type ReplaySeamModule = {
  replayEvidence: { calls: ReplayCallEvidence[] }
  failNextReplay(): void
  failNextCompile(): void
  injectStorageOnNextCompile(
    surface: 'host' | 'client',
    packageName: 'dsh-storage' | 'dsh-storage-domain',
    nestedPath: string,
  ): void
  replaceClientOverlayWithSameBytesOnNextCompile(): void
  replaceCommittedFileWithSameBytesAfterReplay(path: string): void
  mutateAcceptanceSourceAfterImport(transform: (source: string) => string): Promise<void>
}

type ProposalFsFaultEvidence = {
  armedLinkAfterSuccessAsEexist: boolean
  armedIndependentPointerCopyAsEexist: boolean
  armedBoundaryFailureAfterSuccessfulLink: boolean
  armedLinkEioAndBoundaryFailureAfterSuccess: boolean
  armedAliasUnlinkAsEnoent: boolean
  proposalLinkCalls: number
  injectedLinkAfterSuccessAsEexist: boolean
  injectedIndependentPointerCopyAsEexist: boolean
  independentPointerHasDifferentInode: boolean
  successfulLinkBeforeBoundaryFailure: boolean
  injectedLinkEioAfterSuccess: boolean
  injectedBoundaryFailureAfterSuccessfulLink: boolean
  injectedAliasUnlinkAsEnoent: boolean
}

type ProposalFsFaultModule = {
  proposalFsFaultEvidence: ProposalFsFaultEvidence
  armProposalLinkAfterSuccessAsEexist(): void
  armProposalIndependentPointerCopyAsEexist(): void
  armProposalBoundaryFailureAfterSuccessfulLink(): void
  armProposalLinkEioAndBoundaryFailureAfterSuccess(): void
  armProposalAliasUnlinkAsEnoent(): void
}

export type Synthetic169BootstrapFixture = {
  workspaceRoot: string
  selectedContentBytes: number
  fakeNpmCliPath: string
  selectedSourceBundleRoot: string
  historicalInputsIsolated: true
  replayEvidence: { calls: ReplayCallEvidence[] }
  snapshotCommittedEvidence(): Promise<string>
  stageV2Proposal(): Promise<any>
  failNextReplay(): void
  failNextCompile(): void
  injectStorageOnNextCompile(
    surface: 'host' | 'client',
    packageName: 'dsh-storage' | 'dsh-storage-domain',
    nestedPath: string,
  ): void
  replaceClientOverlayWithSameBytesOnNextCompile(): void
  replaceCommittedFileWithSameBytesAfterReplay(path: string): void
  mutateAcceptanceSourceAfterImport(transform: (source: string) => string): Promise<void>
  proposalFsFaultEvidence?: ProposalFsFaultEvidence
  armProposalLinkAfterSuccessAsEexist?: () => void
  armProposalIndependentPointerCopyAsEexist?: () => void
  armProposalBoundaryFailureAfterSuccessfulLink?: () => void
  armProposalLinkEioAndBoundaryFailureAfterSuccess?: () => void
  armProposalAliasUnlinkAsEnoent?: () => void
}

type Synthetic169BootstrapOptions = {
  verifierSourceTransform?: (source: string) => string
  trustVerifierTransform?: boolean
  publishSyntheticProposal?: boolean
  enableProposalFsFaultSeam?: boolean
}

type LinkFaultMode = 'before-real-link' | 'after-real-link'

type LinkFaultEvidence = {
  wrapperCalls: number
  realLinkCalls: number
  injectedBeforeRealLink: boolean
  injectedAfterRealLink: boolean
  sameInodeAfterRealLink: boolean
  sourceNlinkAfterRealLink: string | null
  targetNlinkAfterRealLink: string | null
  targetDevAfterRealLink: string | null
  targetInoAfterRealLink: string | null
}

type LinkFaultModule = {
  linkFaultEvidence: LinkFaultEvidence
}

type CanaryFileIdentity = Omit<SourceWitness, 'path'>

type ForeignCanarySnapshot = {
  pointerTemporary: CanaryFileIdentity
  bundleDirectory: {
    dev: string
    ino: string
    mode: number
  }
  bundleFile: CanaryFileIdentity
}

export type Synthetic169BeforeLinkFaultFixture = {
  faultMode: 'before-real-link'
  outcome: {
    kind: 'rejected'
    reasonCode: 'POINTER_COMMIT_FAILED'
    publicError: {
      status: string
      reasonCode: string
    }
  }
  linkFaultEvidence: LinkFaultEvidence
  failureState: {
    stablePointerMissing: boolean
    pointerTemporaryNames: string[]
    bundleNames: string[]
    cleanupNames: string[]
    foreignCanaryBefore: ForeignCanarySnapshot
    foreignCanaryAfter: ForeignCanarySnapshot
  }
}

export type Synthetic169AfterLinkFaultFixture = {
  faultMode: 'after-real-link'
  outcome: { kind: 'fulfilled' }
  linkFaultEvidence: LinkFaultEvidence
  selectedContentBytes: number
  result: PrepareResult
  publication: Synthetic169Publication
}

export type Synthetic169LinkFaultFixture =
  | Synthetic169BeforeLinkFaultFixture
  | Synthetic169AfterLinkFaultFixture

export type Synthetic169Publication = {
  pointer: Record<string, unknown>
  pointerBytes: string
  pointerDev: string
  pointerIno: string
  pointerNlink: string
  descriptor: Record<string, unknown>
  receipt: Record<string, unknown>
  bundleCount: number
  pointerTemporaryCount: number
  indexFileCount: number
  contentFileCount: number
  contentBytes: number
  publishedFileCount: number
}

export type Synthetic169ProductionFixture = {
  workspaceRoot: string
  selectedContentBytes: number
  sourceCacheTreeWitnessSha256: string
  packageJsonCanonicalSha256: string
  packageLockCanonicalSha256: string
  result: PrepareResult
  publication: Synthetic169Publication
  prepareAgain: () => Promise<PrepareResult>
  prepareAgainAfterIsolatingSourceCache: () => Promise<{
    result: PrepareResult
    publication: Synthetic169Publication
    sourceIsolation: {
      originalPathMissing: true
      candidateStillPointsToOriginalPath: true
    }
  }>
  prepareAgainAfterAddingPointerTemporaryAlias: () => Promise<{
    result: PrepareResult
    publication: Synthetic169Publication
    crashResidue: {
      stableNlinkBeforeRecovery: '2'
      aliasSharedStableInode: true
      aliasRemoved: true
    }
  }>
  concurrentSettlements?: Array<
    | { status: 'fulfilled'; result: PrepareResult }
    | { status: 'rejected'; reasonCode: string }
  >
}

type OwnedTemporaryRoot = {
  root: string
  canonicalRoot: string
  dev: string
  ino: string
  marker: string
  markerPath: string
}

function fail(message: string): never {
  throw new Error(`[rc6-169 synthetic production fixture] ${message}`)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function compareUtf8(left: string, right: string): number {
  return Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8'))
}

function sha256(value: string | Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

function sha512Integrity(value: Buffer): string {
  return `sha512-${createHash('sha512').update(value).digest('base64')}`
}

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex')
}

/**
 * Sufficiently strict independent canonicalizer for JSON.parse results. It
 * intentionally does not import the production module merely to compute the
 * hashes that must be patched before that module can be imported.
 */
function canonicalJsonBytes(value: unknown): string {
  if (value === null) return 'null'
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'string') return JSON.stringify(value)
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Object.is(value, -0) || !Number.isSafeInteger(value)) {
      fail('fixture JSON contains a non-canonical number')
    }
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJsonBytes).join(',')}]`
  if (!isRecord(value) || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('fixture JSON contains a non-plain value')
  }
  return `{${Object.keys(value)
    .sort(compareUtf8)
    .map((key) => `${JSON.stringify(key)}:${canonicalJsonBytes(value[key])}`)
    .join(',')}}`
}

function prettyJsonBytes(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`
}

function parseJsonObject(bytes: Buffer, label: string): JsonObject {
  let parsed: unknown
  try {
    parsed = JSON.parse(bytes.toString('utf8'))
  } catch {
    fail(`${label} is not valid JSON`)
  }
  if (!isRecord(parsed) || Object.getPrototypeOf(parsed) !== Object.prototype) {
    fail(`${label} is not a JSON object`)
  }
  return parsed as JsonObject
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[], label: string): void {
  const actualKeys = Object.keys(value).sort(compareUtf8)
  const expectedKeys = [...expected].sort(compareUtf8)
  if (actualKeys.length !== expectedKeys.length
    || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    fail(`${label} keys are not exact: ${actualKeys.join(',')}`)
  }
}

function assertCanonicalEqual(actual: unknown, expected: unknown, label: string): void {
  if (canonicalJsonBytes(actual) !== canonicalJsonBytes(expected)) {
    fail(`${label} does not match the independently derived value`)
  }
}

function parseCanonicalJsonObject(bytes: Buffer, label: string): JsonObject {
  const parsed = parseJsonObject(bytes, label)
  if (bytes.toString('utf8') !== `${canonicalJsonBytes(parsed)}\n`) {
    fail(`${label} is not canonical JSON with exactly one trailing LF`)
  }
  return parsed
}

function statWitness(path: string, fileStat: BigIntStats, bytes: Buffer): SourceWitness {
  return {
    path,
    sha256: sha256(bytes),
    size: fileStat.size.toString(),
    mode: Number(fileStat.mode & 0o777n),
    dev: fileStat.dev.toString(),
    ino: fileStat.ino.toString(),
    nlink: fileStat.nlink.toString(),
    mtimeNs: fileStat.mtimeNs.toString(),
    ctimeNs: fileStat.ctimeNs.toString(),
  }
}

function sameOpenFileIdentity(
  before: BigIntStats,
  after: BigIntStats,
): boolean {
  return before.dev === after.dev
    && before.ino === after.ino
    && before.size === after.size
    && before.mode === after.mode
    && before.nlink === after.nlink
    && before.mtimeNs === after.mtimeNs
    && before.ctimeNs === after.ctimeNs
}

async function readStableRegularFile(path: string): Promise<StableSourceFile> {
  let handle
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
    const before = await handle.stat({ bigint: true })
    if (!before.isFile() || before.nlink !== 1n) fail(`expected single-link regular file: ${path}`)
    const bytes = await handle.readFile()
    const after = await handle.stat({ bigint: true })
    if (!sameOpenFileIdentity(before, after) || BigInt(bytes.length) !== before.size) {
      fail(`file identity changed during read: ${path}`)
    }
    return { bytes, witness: statWitness(path, before, bytes) }
  } finally {
    await handle?.close()
  }
}

function assertSameWitness(before: SourceWitness, after: SourceWitness): void {
  const fields: Array<keyof SourceWitness> = [
    'path', 'sha256', 'size', 'mode', 'dev', 'ino', 'nlink', 'mtimeNs', 'ctimeNs',
  ]
  for (const field of fields) {
    if (before[field] !== after[field]) {
      fail(`approved source changed at ${before.path}: ${field}`)
    }
  }
}

async function assertApprovedSourcesUnchanged(sources: StableSourceFile[]): Promise<void> {
  const after = await Promise.all(sources.map(({ witness }) => readStableRegularFile(witness.path)))
  for (let index = 0; index < sources.length; index += 1) {
    assertSameWitness(sources[index].witness, after[index].witness)
  }
}

async function createOwnedTemporaryRoot(): Promise<OwnedTemporaryRoot> {
  const root = await mkdtemp(resolve(tmpdir(), 'dsh-rc6-169-production-'))
  try {
    const rootStat = await lstat(root, { bigint: true })
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) fail('mkdtemp did not create a directory')
    const marker = `rc6-169-vitest:${randomUUID()}\n`
    const markerPath = resolve(root, '.synthetic-fixture-owner')
    await writeFile(markerPath, marker, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
    return {
      root,
      canonicalRoot: await realpath(root),
      dev: rootStat.dev.toString(),
      ino: rootStat.ino.toString(),
      marker,
      markerPath,
    }
  } catch (error) {
    await rm(root, { recursive: true, force: true }).catch(() => {})
    throw error
  }
}

async function assertOwnedRoot(owner: OwnedTemporaryRoot): Promise<void> {
  const rootStat = await lstat(owner.root, { bigint: true })
  if (!rootStat.isDirectory() || rootStat.isSymbolicLink()
    || rootStat.dev.toString() !== owner.dev || rootStat.ino.toString() !== owner.ino
    || await realpath(owner.root) !== owner.canonicalRoot) {
    fail('refusing cleanup because temporary-root identity changed')
  }
  const marker = await readStableRegularFile(owner.markerPath)
  if (marker.bytes.toString('utf8') !== owner.marker) {
    fail('refusing cleanup because the owner marker does not match')
  }
}

async function makeOwnedDirectoriesWritable(path: string): Promise<void> {
  const entry = await lstat(path)
  if (entry.isSymbolicLink() || entry.isFile()) return
  if (!entry.isDirectory()) fail(`unexpected special entry during owned cleanup: ${path}`)
  await chmod(path, 0o700)
  for (const name of await readdir(path)) {
    await makeOwnedDirectoriesWritable(resolve(path, name))
  }
}

async function cleanupOwnedTemporaryRoot(owner: OwnedTemporaryRoot): Promise<void> {
  await assertOwnedRoot(owner)
  // Only directories need their owner-write bit restored for unlink/rmdir.
  // Avoid chmod on regular files so an unexpected hardlink cannot change an
  // inode outside this owned tree.
  await makeOwnedDirectoriesWritable(owner.root)
  // Recheck immediately before removal. This protects ordinary test teardown
  // mistakes, but it deliberately does not claim protection from a hostile
  // same-user process racing pathname operations indefinitely; that requires
  // directory-fd-relative native primitives rather than Node path APIs.
  await assertOwnedRoot(owner)
  await rm(owner.root, { recursive: true, force: false })
  try {
    await stat(owner.root)
    fail('owned temporary root still exists after cleanup')
  } catch (error) {
    if (!isRecord(error) || error.code !== 'ENOENT') throw error
  }
}

function packageNameFromLockPath(lockPath: string): string {
  const marker = 'node_modules/'
  const index = lockPath.lastIndexOf(marker)
  if (index < 0) fail(`invalid lock path: ${lockPath}`)
  return lockPath.slice(index + marker.length)
}

function deterministicContentBytes(
  lockPath: string,
  record: Record<string, unknown>,
  ordinal: number,
): Buffer {
  const descriptor = {
    fixture: SYNTHETIC_CONTENT_DOMAIN,
    lockPath,
    ordinal,
    resolved: record.resolved,
    version: record.version,
  }
  return Buffer.from(`${canonicalJsonBytes(descriptor)}\n`, 'utf8')
}

function cloneLockWithSyntheticIntegrity(packageLock: JsonObject): {
  packageLock: JsonObject
  entries: SyntheticLockEntry[]
  selectedContentBytes: number
} {
  const clone = structuredClone(packageLock)
  const packages = clone.packages
  if (!isRecord(packages)) fail('package-lock packages map is missing')
  const records = Object.entries(packages)
    .filter(([lockPath]) => lockPath !== '')
    .sort(([left], [right]) => compareUtf8(left, right))
  if (records.length !== EXPECTED_REGISTRY_COUNT) {
    fail(`expected 169 registry records, received ${records.length}`)
  }

  const deepseekCount = records.filter(([lockPath]) =>
    packageNameFromLockPath(lockPath).startsWith('@deepseek-ai/')).length
  const dshCount = records.filter(([lockPath]) =>
    packageNameFromLockPath(lockPath).startsWith('@deepseek-ai/dsh-')).length
  if (deepseekCount !== EXPECTED_DEEPSEEK_COUNT || dshCount !== EXPECTED_DSH_COUNT) {
    fail(`unexpected DeepSeek cohort: ${deepseekCount}/${dshCount}`)
  }
  const nestedCommander = packages[EXPECTED_NESTED_COMMANDER_PATH]
  if (!isRecord(nestedCommander)
    || nestedCommander.version !== EXPECTED_NESTED_COMMANDER_VERSION) {
    fail('nested commander skeleton changed')
  }

  const entries = records.map(([lockPath, candidate], ordinal): SyntheticLockEntry => {
    if (!isRecord(candidate)
      || typeof candidate.version !== 'string'
      || typeof candidate.resolved !== 'string') {
      fail(`incomplete registry record: ${lockPath}`)
    }
    const parsedUrl = new URL(candidate.resolved)
    if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'registry.npmjs.org'
      || parsedUrl.username !== '' || parsedUrl.password !== ''
      || parsedUrl.search !== '' || parsedUrl.hash !== '') {
      fail(`non-public registry URL in skeleton: ${lockPath}`)
    }
    const contentBytes = deterministicContentBytes(lockPath, candidate, ordinal)
    const integrity = sha512Integrity(contentBytes)
    candidate.integrity = integrity
    return {
      lockPath,
      name: packageNameFromLockPath(lockPath),
      version: candidate.version,
      resolved: candidate.resolved,
      key: `make-fetch-happen:request-cache:${candidate.resolved}`,
      integrity,
      contentBytes,
    }
  })

  if (new Set(entries.map(({ key }) => key)).size !== EXPECTED_REGISTRY_COUNT) {
    fail('synthetic fixture does not have 169 unique cache keys')
  }
  if (new Set(entries.map(({ integrity }) => integrity)).size !== EXPECTED_REGISTRY_COUNT) {
    fail('deterministic synthetic contents did not produce 169 unique integrities')
  }
  const selectedContentBytes = entries.reduce(
    (total, entry) => total + entry.contentBytes.length,
    0,
  )
  if (!Number.isSafeInteger(selectedContentBytes) || selectedContentBytes <= 0) {
    fail('invalid synthetic selected-content byte total')
  }
  return { packageLock: clone, entries, selectedContentBytes }
}

function cacheIndexPath(cacheRoot: string, key: string): string {
  const digest = sha256(key)
  return resolve(cacheRoot, 'index-v5', digest.slice(0, 2), digest.slice(2, 4), digest.slice(4))
}

function cacheContentPath(cacheRoot: string, integrity: string): string {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity)
  if (!match) fail('generated integrity is not sha512')
  const digest = Buffer.from(match[1], 'base64')
  if (digest.length !== 64) fail('generated sha512 digest has the wrong length')
  const hex = digest.toString('hex')
  return resolve(cacheRoot, 'content-v2/sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4))
}

async function writeExclusiveFile(path: string, bytes: string | Buffer, mode = 0o600): Promise<void> {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, bytes, { flag: 'wx', mode })
}

async function makeTreeExactlyReadOnly(path: string): Promise<void> {
  const entry = await lstat(path)
  if (entry.isSymbolicLink()) fail(`fixture tree contains a symlink: ${path}`)
  if (entry.isDirectory()) {
    for (const name of await readdir(path)) await makeTreeExactlyReadOnly(resolve(path, name))
    await chmod(path, 0o555)
    return
  }
  if (!entry.isFile() || entry.nlink !== 1) fail(`fixture tree contains a special/hardlinked file: ${path}`)
  await chmod(path, 0o444)
}

async function assertTreeHasExactReadOnlyModes(path: string): Promise<void> {
  const entry = await lstat(path)
  if (entry.isSymbolicLink()) fail(`read-only fixture contains a symlink: ${path}`)
  if (entry.isDirectory()) {
    if ((entry.mode & 0o777) !== 0o555) fail(`fixture directory is not mode 0555: ${path}`)
    for (const name of await readdir(path)) await assertTreeHasExactReadOnlyModes(resolve(path, name))
    return
  }
  if (!entry.isFile() || entry.nlink !== 1 || (entry.mode & 0o777) !== 0o444) {
    fail(`fixture source file is not single-link mode 0444: ${path}`)
  }
}

async function snapshotReadOnlyTreeIdentity(
  root: string,
  path: string = root,
): Promise<Array<Record<string, JsonPrimitive>>> {
  const entry = await lstat(path, { bigint: true })
  const relativePath = relative(root, path).split(sep).join('/') || '.'
  if (entry.isSymbolicLink()) fail(`read-only fixture contains a symlink: ${relativePath}`)
  if (entry.isDirectory()) {
    if ((entry.mode & 0o777n) !== 0o555n) {
      fail(`fixture directory is not mode 0555: ${relativePath}`)
    }
    const records: Array<Record<string, JsonPrimitive>> = [{
      path: relativePath,
      type: 'directory',
      mode: 0o555,
      dev: entry.dev.toString(),
      ino: entry.ino.toString(),
    }]
    for (const name of (await readdir(path)).sort(compareUtf8)) {
      records.push(...await snapshotReadOnlyTreeIdentity(root, resolve(path, name)))
    }
    return records
  }
  const stable = await readStableRegularFile(path)
  if (stable.witness.mode !== 0o444) {
    fail(`fixture source file is not mode 0444: ${relativePath}`)
  }
  return [{
    path: relativePath,
    type: 'file',
    mode: stable.witness.mode,
    size: stable.witness.size,
    sha256: stable.witness.sha256,
    dev: stable.witness.dev,
    ino: stable.witness.ino,
    nlink: stable.witness.nlink,
    mtimeNs: stable.witness.mtimeNs,
    ctimeNs: stable.witness.ctimeNs,
  }]
}

async function snapshotPortableCompilerTree(
  root: string,
  path: string = root,
): Promise<Array<Record<string, JsonPrimitive>>> {
  const entry = await lstat(path)
  const logicalPath = relative(root, path).split(sep).join('/') || '.'
  if (entry.isSymbolicLink()) fail(`synthetic compiler tree contains a symlink: ${logicalPath}`)
  if (entry.isDirectory()) {
    const records: Array<Record<string, JsonPrimitive>> = [{
      path: logicalPath,
      type: 'directory',
      mode: entry.mode & 0o777,
    }]
    for (const name of (await readdir(path)).sort(compareUtf8)) {
      records.push(...await snapshotPortableCompilerTree(root, resolve(path, name)))
    }
    return records
  }
  if (!entry.isFile() || entry.nlink !== 1) {
    fail(`synthetic compiler tree contains a special or hardlinked file: ${logicalPath}`)
  }
  const source = await readStableRegularFile(path)
  return [{
    path: logicalPath,
    type: 'file',
    mode: source.witness.mode,
    size: Number(source.witness.size),
    sha256: source.witness.sha256,
  }]
}

async function syntheticCompilerSourceAggregate(
  workspaceRoot: string,
  rootPackageLock: JsonObject,
): Promise<string> {
  if (!isRecord(rootPackageLock.packages)) fail('root lock compiler packages map is missing')
  const specs = [
    ['node_modules/typescript', '6.0.3'],
    ['node_modules/@types/node', '24.13.3'],
    ['node_modules/undici-types', '7.18.2'],
    ['node_modules/@types/react', '18.3.31'],
    ['node_modules/@types/prop-types', '15.7.15'],
    ['node_modules/csstype', '3.2.3'],
  ] as const
  const packages = []
  for (const [lockPath, version] of specs) {
    const lock = rootPackageLock.packages[lockPath]
    if (!isRecord(lock) || lock.version !== version || typeof lock.integrity !== 'string') {
      fail(`root lock compiler identity changed: ${lockPath}`)
    }
    const inventory = (await snapshotPortableCompilerTree(resolve(workspaceRoot, lockPath)))
      .sort((left, right) => compareUtf8(String(left.path), String(right.path)))
    packages.push({
      lockPath,
      version,
      integrity: lock.integrity,
      inventoryCount: inventory.length,
      inventorySha256: sha256(canonicalJsonBytes(inventory)),
    })
  }
  packages.sort((left, right) => compareUtf8(left.lockPath, right.lockPath))
  return sha256(canonicalJsonBytes(packages))
}

async function materializeSyntheticCache(
  cacheRoot: string,
  entries: SyntheticLockEntry[],
): Promise<void> {
  await mkdir(cacheRoot, { recursive: true, mode: 0o700 })
  for (const [ordinal, entry] of entries.entries()) {
    const recordedAt = 1_725_000_000_000 + ordinal
    const indexRecord = {
      key: entry.key,
      integrity: entry.integrity,
      time: recordedAt,
      size: entry.contentBytes.length,
      metadata: {
        time: recordedAt,
        url: entry.resolved,
        reqHeaders: {
          accept: 'application/octet-stream',
          'accept-encoding': 'gzip,deflate',
          'accept-language': SOURCE_ONLY_METADATA_CANARY,
        },
        resHeaders: {
          'cache-control': 'public, max-age=300',
          'content-type': 'application/octet-stream',
          etag: `"${SOURCE_ONLY_METADATA_CANARY}"`,
        },
        options: { compress: true },
        // The normal 200/304 path omits metadata.status. make-fetch-happen may
        // add that optional field on other response-status branches; this
        // successful tarball-source fixture intentionally does not invent it.
      },
    }
    exactKeys(indexRecord, ['key', 'integrity', 'time', 'size', 'metadata'], 'cache index record')
    exactKeys(
      indexRecord.metadata,
      ['time', 'url', 'reqHeaders', 'resHeaders', 'options'],
      'cache index metadata',
    )
    exactKeys(
      indexRecord.metadata.reqHeaders,
      ['accept', 'accept-encoding', 'accept-language'],
      'cache request headers',
    )
    exactKeys(
      indexRecord.metadata.resHeaders,
      ['cache-control', 'content-type', 'etag'],
      'cache response headers',
    )
    exactKeys(indexRecord.metadata.options, ['compress'], 'cache options')
    const keyPrefix = 'make-fetch-happen:request-cache:'
    if (!indexRecord.key.startsWith(keyPrefix)
      || indexRecord.metadata.url !== indexRecord.key.slice(keyPrefix.length)) {
      fail(`cache metadata URL is not byte-bound to its key: ${entry.lockPath}`)
    }
    const json = canonicalJsonBytes(indexRecord)
    if (countSubstring(json, SOURCE_ONLY_METADATA_CANARY) !== 2) {
      fail(`source-only metadata canary is missing from source index: ${entry.lockPath}`)
    }
    const indexBytes = Buffer.from(`\n${sha1(json)}\t${json}`, 'utf8')
    await writeExclusiveFile(cacheIndexPath(cacheRoot, entry.key), indexBytes)
    await writeExclusiveFile(cacheContentPath(cacheRoot, entry.integrity), entry.contentBytes)
  }
  await makeTreeExactlyReadOnly(cacheRoot)
  await assertTreeHasExactReadOnlyModes(cacheRoot)
}

function countSubstring(haystack: string, needle: string): number {
  if (needle.length === 0) return 0
  let count = 0
  let offset = 0
  while ((offset = haystack.indexOf(needle, offset)) !== -1) {
    count += 1
    offset += needle.length
  }
  return count
}

function singleMatch(source: string, pattern: RegExp, label: string): RegExpMatchArray {
  const matches = [...source.matchAll(pattern)]
  if (matches.length !== 1) fail(`expected exactly one ${label} patch anchor; found ${matches.length}`)
  return matches[0]
}

function patchProductionScript(
  source: string,
  selectedContentBytes: number,
  packageLockCanonicalSha256: string,
): string {
  const selected = singleMatch(
    source,
    /^(  selectedContentBytes: )([0-9][0-9_]*)(,)$/gm,
    'EXPECTED.selectedContentBytes',
  )
  const expectedStart = source.indexOf('const EXPECTED = {')
  const expectedEnd = source.indexOf('\nconst EXPECTED_RUNTIME =', expectedStart)
  if (expectedStart < 0 || expectedEnd < 0
    || (selected.index ?? -1) <= expectedStart || (selected.index ?? -1) >= expectedEnd) {
    fail('selectedContentBytes anchor is no longer inside EXPECTED')
  }

  const packageHash = singleMatch(
    source,
    /^(const EXPECTED_ACCEPTED_PACKAGE_JSON_CANONICAL_SHA256 = ')([a-f0-9]{64})(')$/gm,
    'package JSON canonical hash constant',
  )
  const lockHash = singleMatch(
    source,
    /^(const EXPECTED_ACCEPTED_PACKAGE_LOCK_CANONICAL_SHA256 = ')([a-f0-9]{64})(')$/gm,
    'package-lock canonical hash constant',
  )

  if (selected[2].replaceAll('_', '') !== String(EXPECTED_SELECTED_CONTENT_BYTES)) {
    fail('production EXPECTED.selectedContentBytes changed before fixture patching')
  }
  if (packageHash[2] !== EXPECTED_PACKAGE_JSON_CANONICAL_SHA256) {
    fail('production package JSON canonical hash changed before fixture patching')
  }
  if (lockHash[2] !== EXPECTED_PACKAGE_LOCK_CANONICAL_SHA256) {
    fail('production package-lock canonical hash changed before fixture patching')
  }
  if (!Number.isSafeInteger(selectedContentBytes) || selectedContentBytes <= 0
    || selectedContentBytes === EXPECTED_SELECTED_CONTENT_BYTES) {
    fail('synthetic selected byte total is not a distinct positive safe integer')
  }
  if (!/^[a-f0-9]{64}$/.test(packageLockCanonicalSha256)
    || packageLockCanonicalSha256 === EXPECTED_PACKAGE_LOCK_CANONICAL_SHA256) {
    fail('synthetic package-lock canonical hash is invalid or unchanged')
  }

  // TODO(integration): if production introduces another raw copy of any value
  // patched here, review that new constant explicitly. Never broaden these
  // replacements or globally replace hashes/numbers.
  const selectedDigits = selected[2].replaceAll('_', '')
  const sameNumericLiterals = [...source.matchAll(/\b[0-9][0-9_]*\b/g)]
    .filter((match) => match[0].replaceAll('_', '') === selectedDigits)
  if (sameNumericLiterals.length !== 1) {
    fail(`TODO raw-constant review: selected byte total occurs ${sameNumericLiterals.length} times`)
  }
  for (const [label, rawHash] of [
    ['package JSON canonical hash', packageHash[2]],
    ['package-lock canonical hash', lockHash[2]],
  ] as const) {
    const occurrences = countSubstring(source, rawHash)
    if (occurrences !== 1) {
      fail(`TODO raw-constant review: ${label} occurs ${occurrences} times`)
    }
  }

  const selectedStart = selected.index
  const lockHashStart = lockHash.index
  if (selectedStart === undefined || lockHashStart === undefined) {
    fail('fixture patch anchors have no source offsets')
  }
  const edits = [
    {
      label: 'selected bytes',
      start: selectedStart,
      end: selectedStart + selected[0].length,
      before: selected[0],
      after: `${selected[1]}${selectedContentBytes}${selected[3]}`,
    },
    {
      label: 'lock hash',
      start: lockHashStart,
      end: lockHashStart + lockHash[0].length,
      before: lockHash[0],
      after: `${lockHash[1]}${packageLockCanonicalSha256}${lockHash[3]}`,
    },
  ].sort((left, right) => left.start - right.start)
  if (edits.length !== 2 || edits.some((edit) => edit.before === edit.after)) {
    fail('production fixture patch must contain exactly two effective edits')
  }

  let cursor = 0
  let patched = ''
  const patchedSpans: Array<{ start: number; end: number; before: string; after: string }> = []
  for (const edit of edits) {
    if (edit.start < cursor || source.slice(edit.start, edit.end) !== edit.before
      || countSubstring(source, edit.before) !== 1) {
      fail(`${edit.label} patch is overlapping or no longer exact`)
    }
    patched += source.slice(cursor, edit.start)
    const patchedStart = patched.length
    patched += edit.after
    patchedSpans.push({
      start: patchedStart,
      end: patched.length,
      before: edit.before,
      after: edit.after,
    })
    cursor = edit.end
  }
  patched += source.slice(cursor)

  let restored = patched
  for (const span of [...patchedSpans].reverse()) {
    if (restored.slice(span.start, span.end) !== span.after) {
      fail('patched production source changed outside an approved span')
    }
    restored = `${restored.slice(0, span.start)}${span.before}${restored.slice(span.end)}`
  }
  if (restored !== source) fail('production patch cannot be restored from exactly two approved edits')
  return patched
}

function patchFsPromisesImportForLinkFault(source: string): string {
  const before = "} from 'node:fs/promises'"
  const after = "} from './fs-promises-link-fault.mjs'"
  if (countSubstring(source, before) !== 1 || source.includes(after)) {
    fail('expected exactly one unmodified fs/promises import for link-fault redirection')
  }
  const patched = source.replace(before, after)
  if (countSubstring(patched, after) !== 1
    || patched.replace(after, before) !== source) {
    fail('link-fault import redirection is not unique and reversible')
  }
  return patched
}

function applyUniqueReversibleReplacements(
  source: string,
  replacements: Array<{ label: string; before: string; after: string }>,
): string {
  let patched = source
  const applied: Array<{ label: string; before: string; after: string }> = []
  for (const replacement of replacements) {
    if (replacement.before === replacement.after
      || countSubstring(patched, replacement.before) !== 1
      || countSubstring(patched, replacement.after) !== 0) {
      fail(`bootstrap ${replacement.label} patch is not one unique effective replacement`)
    }
    patched = patched.replace(replacement.before, replacement.after)
    if (countSubstring(patched, replacement.after) !== 1) {
      fail(`bootstrap ${replacement.label} patch did not produce one exact anchor`)
    }
    applied.push(replacement)
  }

  let restored = patched
  for (const replacement of [...applied].reverse()) {
    if (countSubstring(restored, replacement.after) !== 1) {
      fail(`bootstrap ${replacement.label} patch is not reversibly bound`)
    }
    restored = restored.replace(replacement.after, replacement.before)
  }
  if (restored !== source) fail('bootstrap production patch is not exactly reversible')
  return patched
}

function stampNormalizedAcceptanceSource(source: string): string {
  const pattern = /const EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256 = '[a-f0-9]{64}'/g
  const matches = [...source.matchAll(pattern)]
  if (matches.length !== 1) fail('expected exactly one acceptance source self-hash stamp')
  const placeholder = `const EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256 = '${'0'.repeat(64)}'`
  const normalized = source.replace(pattern, placeholder)
  const digest = sha256(Buffer.from(normalized, 'utf8'))
  const stamped = normalized.replace(
    placeholder,
    `const EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256 = '${digest}'`,
  )
  if (countSubstring(stamped, digest) !== 1
    || stamped.replace(digest, '0'.repeat(64)) !== normalized) {
    fail('acceptance source self-hash stamp is not unique and reversible')
  }
  return stamped
}

function patchBootstrapProductionScript({
  source,
  selectedContentBytes,
  packageLockRawSha256,
  packageLockCanonicalSha256,
  committedV1RawSha256,
  selectedCacheIndexSha256,
  selectedContentAggregateSha256,
  compilerSourceAggregateSha256,
  verifierSourceSha256,
  fakeNpmCliPath,
  publishSyntheticProposal = false,
  fsPromisesModuleSpecifier,
}: {
  source: string
  selectedContentBytes: number
  packageLockRawSha256: string
  packageLockCanonicalSha256: string
  committedV1RawSha256: string
  selectedCacheIndexSha256: string
  selectedContentAggregateSha256: string
  compilerSourceAggregateSha256: string
  verifierSourceSha256?: string
  fakeNpmCliPath: string
  publishSyntheticProposal?: boolean
  fsPromisesModuleSpecifier?: string
}): string {
  for (const [label, value] of Object.entries({
    packageLockRawSha256,
    committedV1RawSha256,
    selectedCacheIndexSha256,
    selectedContentAggregateSha256,
    compilerSourceAggregateSha256,
  })) {
    if (!/^[a-f0-9]{64}$/.test(value)) fail(`bootstrap ${label} is not a SHA-256`)
  }
  const selectedPatched = patchProductionScript(
    source,
    selectedContentBytes,
    packageLockCanonicalSha256,
  )
  const replacements = [
    {
      label: 'committed v1 raw hash',
      before: "const EXPECTED_COMMITTED_V1_INPUT_RAW_SHA256 = 'eaa89753953535e0a231ac99d3053de75d8fb67c2d73f7b9bcae9a2997d7e489'",
      after: `const EXPECTED_COMMITTED_V1_INPUT_RAW_SHA256 = '${committedV1RawSha256}'`,
    },
    {
      label: 'compiler source aggregate',
      before: "const EXPECTED_COMPILER_SOURCE_AGGREGATE_SHA256 = '44535345dd7a3448bac9206c60ad352f67c265708d410c4c5e20dad0de83d943'",
      after: `const EXPECTED_COMPILER_SOURCE_AGGREGATE_SHA256 = '${compilerSourceAggregateSha256}'`,
    },
    ...(verifierSourceSha256
      && verifierSourceSha256 !== '7e28949d1899df9dda79e765f342c559254ab67e45a77dca1b2abe329c5d9f8e'
      ? [{
          label: 'verifier source hash',
          before: "const EXPECTED_VERIFIER_SOURCE_SHA256 = '7e28949d1899df9dda79e765f342c559254ab67e45a77dca1b2abe329c5d9f8e'",
          after: `const EXPECTED_VERIFIER_SOURCE_SHA256 = '${verifierSourceSha256}'`,
        }]
      : []),
    {
      label: 'replay evidence kind',
      before: "const REPLAY_EVIDENCE_KIND = 'REAL_NPM_CLI'",
      after: "const REPLAY_EVIDENCE_KIND = 'SYNTHETIC_CHILD_PROCESS_SEAM'",
    },
    ...(publishSyntheticProposal
      ? [{
          label: 'synthetic proposal publication gate',
          before: "if (REPLAY_EVIDENCE_KIND !== 'REAL_NPM_CLI') {\n      await assertPreCommit()\n      return {",
          after: "if (REPLAY_EVIDENCE_KIND === 'SYNTHETIC_CHILD_PROCESS_SEAM' && false) {\n      await assertPreCommit()\n      return {",
        }]
      : []),
    {
      label: 'v2 selected-index hash',
      before: "const V2_SELECTED_INDEX_SHA256 = '73e76d127ab8188d8005e4becb750bbe9cfec30988e501185b13558f4c6cd3f6'",
      after: `const V2_SELECTED_INDEX_SHA256 = '${selectedCacheIndexSha256}'`,
    },
    {
      label: 'v2 selected-content hash',
      before: "const V2_SELECTED_CONTENT_AGGREGATE_SHA256 = '3a8c2e3ba2bb7e07d3cc51212e9ae3dd4925e522d9c9c87acac16fee122757dc'",
      after: `const V2_SELECTED_CONTENT_AGGREGATE_SHA256 = '${selectedContentAggregateSha256}'`,
    },
    {
      label: 'accepted package-lock raw hash',
      before: `inputManifest.packageLockSha256 !== '${EXPECTED_PACKAGE_LOCK_RAW_SHA256}'`,
      after: `inputManifest.packageLockSha256 !== '${packageLockRawSha256}'`,
    },
    {
      label: 'child-process import',
      before: "import { execFile } from 'node:child_process'",
      after: "import { execFile } from './child-process-replay-seam.mjs'",
    },
    ...(fsPromisesModuleSpecifier
      ? [{
          label: 'fs promises fault seam',
          before: "} from 'node:fs/promises'",
          after: `} from ${JSON.stringify(fsPromisesModuleSpecifier)}`,
        }]
      : []),
    {
      label: 'npm CLI location',
      before: "const NPM_CLI_RELATIVE_FROM_NODE = '../lib/node_modules/npm/bin/npm-cli.js'",
      after: `const NPM_CLI_RELATIVE_FROM_NODE = ${JSON.stringify(fakeNpmCliPath)}`,
    },
  ]
  return stampNormalizedAcceptanceSource(
    applyUniqueReversibleReplacements(selectedPatched, replacements),
  )
}

function proposalFsFaultSeamSource(): string {
  return `export * from 'node:fs/promises'

import { constants as fsConstants } from 'node:fs'
import {
  copyFile as realCopyFile,
  link as realLink,
  lstat as realLstat,
  unlink as realUnlink,
} from 'node:fs/promises'
import { basename } from 'node:path'

let injectLinkAfterSuccessAsEexist = false
let injectIndependentPointerCopyAsEexist = false
let injectBoundaryFailureAfterSuccessfulLink = false
let injectLinkEioAndBoundaryFailureAfterSuccess = false
let failNextBoundaryLstat = false
let injectAliasUnlinkAsEnoent = false

export const proposalFsFaultEvidence = {
  armedLinkAfterSuccessAsEexist: false,
  armedIndependentPointerCopyAsEexist: false,
  armedBoundaryFailureAfterSuccessfulLink: false,
  armedLinkEioAndBoundaryFailureAfterSuccess: false,
  armedAliasUnlinkAsEnoent: false,
  proposalLinkCalls: 0,
  injectedLinkAfterSuccessAsEexist: false,
  injectedIndependentPointerCopyAsEexist: false,
  independentPointerHasDifferentInode: false,
  successfulLinkBeforeBoundaryFailure: false,
  injectedLinkEioAfterSuccess: false,
  injectedBoundaryFailureAfterSuccessfulLink: false,
  injectedAliasUnlinkAsEnoent: false,
}

export function armProposalLinkAfterSuccessAsEexist() {
  if (injectLinkAfterSuccessAsEexist) throw new Error('proposal link fault already armed')
  injectLinkAfterSuccessAsEexist = true
  proposalFsFaultEvidence.armedLinkAfterSuccessAsEexist = true
}

export function armProposalIndependentPointerCopyAsEexist() {
  if (injectIndependentPointerCopyAsEexist) {
    throw new Error('proposal independent pointer copy fault already armed')
  }
  injectIndependentPointerCopyAsEexist = true
  proposalFsFaultEvidence.armedIndependentPointerCopyAsEexist = true
}

export function armProposalBoundaryFailureAfterSuccessfulLink() {
  if (injectBoundaryFailureAfterSuccessfulLink || failNextBoundaryLstat) {
    throw new Error('proposal post-link boundary fault already armed')
  }
  injectBoundaryFailureAfterSuccessfulLink = true
  proposalFsFaultEvidence.armedBoundaryFailureAfterSuccessfulLink = true
}

export function armProposalLinkEioAndBoundaryFailureAfterSuccess() {
  if (injectLinkEioAndBoundaryFailureAfterSuccess || failNextBoundaryLstat) {
    throw new Error('proposal combined link and boundary fault already armed')
  }
  injectLinkEioAndBoundaryFailureAfterSuccess = true
  proposalFsFaultEvidence.armedLinkEioAndBoundaryFailureAfterSuccess = true
}

export function armProposalAliasUnlinkAsEnoent() {
  if (injectAliasUnlinkAsEnoent) throw new Error('proposal unlink fault already armed')
  injectAliasUnlinkAsEnoent = true
  proposalFsFaultEvidence.armedAliasUnlinkAsEnoent = true
}

function isProposalPointerLink(source, target) {
  return /^\\.rc6-declaration-v2-proposal-[a-f0-9]{32}\\.tmp$/.test(basename(source))
    && basename(target) === 'rc6-declaration-v2-proposal.json'
}

function isProposalPointerTemporary(path) {
  return /^\\.rc6-declaration-v2-proposal-[a-f0-9]{32}\\.tmp$/.test(basename(path))
}

export async function link(source, target) {
  if (isProposalPointerLink(source, target)) {
    proposalFsFaultEvidence.proposalLinkCalls += 1
    if (injectLinkAfterSuccessAsEexist) {
      injectLinkAfterSuccessAsEexist = false
      await realLink(source, target)
      proposalFsFaultEvidence.injectedLinkAfterSuccessAsEexist = true
      throw Object.assign(new Error('synthetic EEXIST after successful proposal link'), {
        code: 'EEXIST',
      })
    }
    if (injectIndependentPointerCopyAsEexist) {
      injectIndependentPointerCopyAsEexist = false
      await realCopyFile(source, target, fsConstants.COPYFILE_EXCL)
      const [sourceStat, targetStat] = await Promise.all([
        realLstat(source, { bigint: true }),
        realLstat(target, { bigint: true }),
      ])
      proposalFsFaultEvidence.injectedIndependentPointerCopyAsEexist = true
      proposalFsFaultEvidence.independentPointerHasDifferentInode =
        sourceStat.dev !== targetStat.dev || sourceStat.ino !== targetStat.ino
      throw Object.assign(new Error('synthetic EEXIST after independent proposal pointer copy'), {
        code: 'EEXIST',
      })
    }
    if (injectBoundaryFailureAfterSuccessfulLink) {
      injectBoundaryFailureAfterSuccessfulLink = false
      await realLink(source, target)
      proposalFsFaultEvidence.successfulLinkBeforeBoundaryFailure = true
      failNextBoundaryLstat = true
      return
    }
    if (injectLinkEioAndBoundaryFailureAfterSuccess) {
      injectLinkEioAndBoundaryFailureAfterSuccess = false
      await realLink(source, target)
      proposalFsFaultEvidence.successfulLinkBeforeBoundaryFailure = true
      proposalFsFaultEvidence.injectedLinkEioAfterSuccess = true
      failNextBoundaryLstat = true
      throw Object.assign(new Error('synthetic EIO after successful proposal link'), {
        code: 'EIO',
      })
    }
  }
  return realLink(source, target)
}

export async function lstat(path, options) {
  if (failNextBoundaryLstat) {
    failNextBoundaryLstat = false
    proposalFsFaultEvidence.injectedBoundaryFailureAfterSuccessfulLink = true
    throw Object.assign(new Error('synthetic proposal post-link boundary failure'), {
      code: 'EIO',
    })
  }
  return realLstat(path, options)
}

export async function unlink(path) {
  if (injectAliasUnlinkAsEnoent && isProposalPointerTemporary(path)) {
    injectAliasUnlinkAsEnoent = false
    await realUnlink(path)
    proposalFsFaultEvidence.injectedAliasUnlinkAsEnoent = true
    throw Object.assign(new Error('synthetic ENOENT after raced proposal alias unlink'), {
      code: 'ENOENT',
    })
  }
  return realUnlink(path)
}
`
}

function linkFaultWrapperSource(mode: LinkFaultMode): string {
  return `export * from 'node:fs/promises'

import { link as realLink, lstat } from 'node:fs/promises'
import { basename } from 'node:path'

export const linkFaultEvidence = {
  wrapperCalls: 0,
  realLinkCalls: 0,
  injectedBeforeRealLink: false,
  injectedAfterRealLink: false,
  sameInodeAfterRealLink: false,
  sourceNlinkAfterRealLink: null,
  targetNlinkAfterRealLink: null,
  targetDevAfterRealLink: null,
  targetInoAfterRealLink: null,
}

function injectedError() {
  return Object.assign(new Error('synthetic non-EEXIST link fault'), { code: 'EIO' })
}

const mode = ${JSON.stringify(mode)}

export async function link(source, target) {
  linkFaultEvidence.wrapperCalls += 1
  if (!/^\\.declaration-input-source-[a-f0-9]{32}\\.tmp$/.test(basename(source))
    || basename(target) !== 'declaration-input-source.json') {
    throw new Error('unexpected link call reached fault wrapper')
  }
  if (mode === 'before-real-link') {
    linkFaultEvidence.injectedBeforeRealLink = true
    throw injectedError()
  }
  linkFaultEvidence.realLinkCalls += 1
  await realLink(source, target)
  const [sourceAfterLink, targetAfterLink] = await Promise.all([
    lstat(source, { bigint: true }),
    lstat(target, { bigint: true }),
  ])
  linkFaultEvidence.sameInodeAfterRealLink = sourceAfterLink.dev === targetAfterLink.dev
    && sourceAfterLink.ino === targetAfterLink.ino
  linkFaultEvidence.sourceNlinkAfterRealLink = sourceAfterLink.nlink.toString()
  linkFaultEvidence.targetNlinkAfterRealLink = targetAfterLink.nlink.toString()
  linkFaultEvidence.targetDevAfterRealLink = targetAfterLink.dev.toString()
  linkFaultEvidence.targetInoAfterRealLink = targetAfterLink.ino.toString()
  linkFaultEvidence.injectedAfterRealLink = true
  throw injectedError()
}
`
}

function withoutPath(witness: SourceWitness): CanaryFileIdentity {
  const { path: _path, ...identity } = witness
  return identity
}

async function snapshotForeignCanaries(owner: OwnedTemporaryRoot): Promise<ForeignCanarySnapshot> {
  const pointerParent = dirname(resolve(owner.root, POINTER_RELATIVE_PATH))
  const bundleParent = resolve(owner.root, BUNDLE_PARENT_RELATIVE_PATH)
  const bundleRoot = resolve(bundleParent, FOREIGN_BUNDLE_NAME)
  const bundleFilePath = resolve(bundleRoot, 'foreign-canary')
  const [pointerTemporary, bundleFile, bundleDirectory] = await Promise.all([
    readStableRegularFile(resolve(pointerParent, FOREIGN_POINTER_TEMP_NAME)),
    readStableRegularFile(bundleFilePath),
    lstat(bundleRoot, { bigint: true }),
  ])
  if (!bundleDirectory.isDirectory() || bundleDirectory.isSymbolicLink()) {
    fail('foreign bundle canary is not a directory')
  }
  return {
    pointerTemporary: withoutPath(pointerTemporary.witness),
    bundleDirectory: {
      dev: bundleDirectory.dev.toString(),
      ino: bundleDirectory.ino.toString(),
      mode: Number(bundleDirectory.mode & 0o777n),
    },
    bundleFile: withoutPath(bundleFile.witness),
  }
}

async function createForeignCanaries(owner: OwnedTemporaryRoot): Promise<ForeignCanarySnapshot> {
  const pointerParent = dirname(resolve(owner.root, POINTER_RELATIVE_PATH))
  const bundleParent = resolve(owner.root, BUNDLE_PARENT_RELATIVE_PATH)
  const bundleRoot = resolve(bundleParent, FOREIGN_BUNDLE_NAME)
  await mkdir(bundleRoot, { recursive: true, mode: 0o700 })
  await Promise.all([
    writeExclusiveFile(
      resolve(pointerParent, FOREIGN_POINTER_TEMP_NAME),
      Buffer.from('foreign pointer temporary canary\n', 'utf8'),
      0o444,
    ),
    writeExclusiveFile(
      resolve(bundleRoot, 'foreign-canary'),
      Buffer.from('foreign bundle canary\n', 'utf8'),
      0o444,
    ),
  ])
  await chmod(bundleRoot, 0o555)
  return snapshotForeignCanaries(owner)
}

async function pathIsMissing(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return false
  } catch (error) {
    if (isRecord(error) && error.code === 'ENOENT') return true
    throw error
  }
}

async function inspectFailedLinkPublication(
  owner: OwnedTemporaryRoot,
  foreignCanaryBefore: ForeignCanarySnapshot,
): Promise<Synthetic169BeforeLinkFaultFixture['failureState']> {
  const pointerPath = resolve(owner.root, POINTER_RELATIVE_PATH)
  const pointerParent = dirname(pointerPath)
  const bundleParent = resolve(owner.root, BUNDLE_PARENT_RELATIVE_PATH)
  const pointerTemporaryNames = (await readdir(pointerParent))
    .filter((name) => /^\.declaration-input-source-[a-f0-9]{32}\.tmp$/.test(name))
    .sort(compareUtf8)
  const bundleNames = (await readdir(bundleParent))
    .filter((name) => /^bundle-[a-f0-9]{32}$/.test(name))
    .sort(compareUtf8)
  const cleanupNames = (await readdir(bundleParent))
    .filter((name) => name.startsWith('.cleanup-'))
    .sort(compareUtf8)
  return {
    stablePointerMissing: await pathIsMissing(pointerPath),
    pointerTemporaryNames,
    bundleNames,
    cleanupNames,
    foreignCanaryBefore,
    foreignCanaryAfter: await snapshotForeignCanaries(owner),
  }
}

function makeStrictCandidate(
  sourceCacheRoot: string,
  npmCliPlaceholderPath: string,
  selectedContentBytes: number,
): JsonObject {
  const expected = {
    registryPackageCount: EXPECTED_REGISTRY_COUNT,
    deepseekPackageCount: EXPECTED_DEEPSEEK_COUNT,
    dshPackageCount: EXPECTED_DSH_COUNT,
    dshVersion: EXPECTED_DSH_VERSION,
    selectedContentBytes,
  }
  exactKeys(expected, [
    'registryPackageCount',
    'deepseekPackageCount',
    'dshPackageCount',
    'dshVersion',
    'selectedContentBytes',
  ], 'candidate.expected')
  const candidate = {
    schemaVersion: '1',
    label: EXPECTED_LABEL,
    authorizationBasis: EXPECTED_AUTHORIZATION_BASIS,
    sourceCacheRoot,
    npmCliPath: npmCliPlaceholderPath,
    expected,
  }
  exactKeys(candidate, [
    'schemaVersion', 'label', 'authorizationBasis', 'sourceCacheRoot', 'npmCliPath', 'expected',
  ], 'candidate')
  return candidate
}

type PublishedFile = {
  relativePath: string
  bytes: Buffer
  mode: number
  nlink: string
}

type PublishedDirectory = {
  relativePath: string
  mode: number
  nlink: string
}

type PublishedTree = {
  files: PublishedFile[]
  directories: PublishedDirectory[]
}

async function walkPublishedTree(
  root: string,
  path: string = root,
): Promise<PublishedTree> {
  const before = await lstat(path, { bigint: true })
  const relativePath = relative(root, path).split(sep).join('/') || '.'
  if (before.isSymbolicLink()) fail(`published bundle contains a symlink: ${relativePath}`)
  if (before.isDirectory()) {
    if ((before.mode & 0o777n) !== 0o555n || before.nlink < 1n) {
      fail(`published directory mode/nlink mismatch: ${relativePath}`)
    }
    const nested: PublishedTree = { files: [], directories: [] }
    for (const name of (await readdir(path)).sort(compareUtf8)) {
      const child = await walkPublishedTree(root, resolve(path, name))
      nested.files.push(...child.files)
      nested.directories.push(...child.directories)
    }
    const after = await lstat(path, { bigint: true })
    if (!sameOpenFileIdentity(before, after)) {
      fail(`published directory identity changed during traversal: ${relativePath}`)
    }
    nested.directories.push({
      relativePath,
      mode: Number(before.mode & 0o777n),
      nlink: before.nlink.toString(),
    })
    return nested
  }
  if (!before.isFile()) fail(`published bundle contains a special entry: ${relativePath}`)
  const stable = await readStableRegularFile(path)
  if (stable.witness.mode !== 0o444 || stable.witness.nlink !== '1') {
    fail(`published file mode/nlink mismatch: ${relativePath}`)
  }
  return {
    directories: [],
    files: [{
      relativePath,
      bytes: stable.bytes,
      mode: stable.witness.mode,
      nlink: stable.witness.nlink,
    }],
  }
}

function frozenIndexRecord(entry: SyntheticLockEntry): JsonObject {
  return {
    key: entry.key,
    integrity: entry.integrity,
    metadata: { url: entry.resolved },
    size: entry.contentBytes.length,
  }
}

function frozenIndexBytes(entry: SyntheticLockEntry): Buffer {
  const json = canonicalJsonBytes(frozenIndexRecord(entry))
  return Buffer.from(`\n${sha1(json)}\t${json}`, 'utf8')
}

function cacheIndexRelativePath(key: string): string {
  const digest = sha256(key)
  return `_cacache/index-v5/${digest.slice(0, 2)}/${digest.slice(2, 4)}/${digest.slice(4)}`
}

function cacheContentRelativePath(integrity: string): string {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity)
  if (!match) fail('synthetic integrity is not canonical sha512')
  const digest = Buffer.from(match[1], 'base64')
  if (digest.length !== 64 || digest.toString('base64') !== match[1]) {
    fail('synthetic integrity has a non-canonical digest')
  }
  const hex = digest.toString('hex')
  return `_cacache/content-v2/sha512/${hex.slice(0, 2)}/${hex.slice(2, 4)}/${hex.slice(4)}`
}

function addLogicalAncestors(paths: Set<string>, logicalPath: string): void {
  const parts = logicalPath.split('/')
  parts.pop()
  while (parts.length > 0) {
    paths.add(parts.join('/'))
    parts.pop()
  }
  paths.add('.')
}

function assertExactPathSet(actual: string[], expected: Set<string>, label: string): void {
  const actualSorted = [...actual].sort(compareUtf8)
  const expectedSorted = [...expected].sort(compareUtf8)
  if (actualSorted.length !== expectedSorted.length
    || actualSorted.some((path, index) => path !== expectedSorted[index])) {
    fail(`${label} is not exact; actual=${actualSorted.length}, expected=${expectedSorted.length}`)
  }
}

function buildExpectedDescriptor({
  packageJsonRawSha256,
  packageJsonCanonicalSha256,
  packageLockRawSha256,
  packageLockCanonicalSha256,
  entries,
  selectedContentBytes,
}: {
  packageJsonRawSha256: string
  packageJsonCanonicalSha256: string
  packageLockRawSha256: string
  packageLockCanonicalSha256: string
  entries: SyntheticLockEntry[]
  selectedContentBytes: number
}): JsonObject {
  const projection = entries.map((entry) => ({
    lockPath: entry.lockPath,
    name: entry.name,
    version: entry.version,
    integrity: entry.integrity,
    key: entry.key,
    contentDigest: entry.integrity,
  }))
  const selectedIndex = entries.map((entry) => ({
    lockPath: entry.lockPath,
    name: entry.name,
    version: entry.version,
    integrity: entry.integrity,
    key: entry.key,
    byteLength: entry.contentBytes.length,
    contentDigest: entry.integrity,
  }))
  const contentAggregate = entries.map((entry) => ({
    lockPath: entry.lockPath,
    contentDigest: entry.integrity,
    byteLength: entry.contentBytes.length,
  }))
  return {
    schemaVersion: '2',
    inputLabel: EXPECTED_LABEL,
    authorizationBasis: EXPECTED_AUTHORIZATION_BASIS,
    packageJsonRawSha256,
    packageJsonCanonicalSha256,
    packageLockRawSha256,
    packageLockCanonicalSha256,
    lockProjectionSha256: sha256(prettyJsonBytes(projection)),
    selectedCacheIndexSha256: sha256(prettyJsonBytes(selectedIndex)),
    selectedContentAggregateSha256: sha256(prettyJsonBytes(contentAggregate)),
    selectedCacheRelativePath: '_cacache',
    packageCounts: {
      registry: EXPECTED_REGISTRY_COUNT,
      deepseek: EXPECTED_DEEPSEEK_COUNT,
      dsh: EXPECTED_DSH_COUNT,
    },
    selectedCount: EXPECTED_REGISTRY_COUNT,
    selectedBytes: selectedContentBytes,
    uniqueIndexFileCount: EXPECTED_REGISTRY_COUNT,
    uniqueContentFileCount: EXPECTED_REGISTRY_COUNT,
  }
}

function knownLeakVariants(values: string[]): string[] {
  const variants = new Set<string>([SOURCE_ONLY_METADATA_CANARY])
  for (const value of values) {
    if (value === '') continue
    variants.add(value)
    variants.add(encodeURI(value))
    variants.add(encodeURIComponent(value))
    if (value.startsWith('/')) variants.add(pathToFileURL(value).href)
  }
  return [...variants].sort((left, right) => right.length - left.length)
}

function assertNoLocalPathLeak(
  value: string,
  label: string,
  bannedExactStrings: string[],
): void {
  for (const banned of bannedExactStrings) {
    if (banned !== '' && value.includes(banned)) fail(`${label} leaks fixture-local data`)
  }
  if (/(?:^|[\s"'=:[{,(])\/(?:Users|private|tmp|var|home|Volumes|opt|workspace|etc)\//.test(value)
    || /(?:^|[^A-Za-z0-9])file:/i.test(value)
    // Requiring a token boundary before the drive letter avoids treating the
    // `s:/` substring in `https://` as a Windows drive path.
    || /(?:^|[\s"'=:[{,(])[A-Za-z]:[\\/]/.test(value)
    || /(?:^|[\s"'=:[{,(])\\\\/.test(value)
    || /(?:^|[\s"'=:[{,(])~[\\/]/.test(value)) {
    fail(`${label} contains an absolute local path`)
  }
}

function independentPayloadInventory(tree: PublishedTree): JsonValue[] {
  const records: JsonValue[] = []
  for (const directory of tree.directories) {
    records.push({ path: directory.relativePath, type: 'directory', mode: directory.mode })
  }
  for (const file of tree.files) {
    if (file.relativePath === '.owner' || file.relativePath === 'receipt.json') continue
    records.push({
      path: file.relativePath,
      type: 'file',
      mode: file.mode,
      size: file.bytes.length,
      sha256: sha256(file.bytes),
    })
  }
  return records.sort((left, right) => {
    const leftPath = isRecord(left) && typeof left.path === 'string' ? left.path : ''
    const rightPath = isRecord(right) && typeof right.path === 'string' ? right.path : ''
    return compareUtf8(leftPath, rightPath)
  })
}

async function inspectPublication(
  owner: OwnedTemporaryRoot,
  result: PrepareResult,
  entries: SyntheticLockEntry[],
  expectedDescriptor: JsonObject,
  knownLocalValues: string[],
): Promise<Synthetic169Publication> {
  if (!isRecord(result)) fail('public prepare result is not an object')
  exactKeys(result, ['status', 'pointer', 'descriptor'], 'public prepare result')
  if (result.status !== 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION') {
    fail(`public prepare status is not PASS: ${String(result.status)}`)
  }

  const pointerPath = resolve(owner.root, POINTER_RELATIVE_PATH)
  const pointerFile = await readStableRegularFile(pointerPath)
  if (pointerFile.witness.mode !== 0o444 || pointerFile.witness.nlink !== '1') {
    fail('stable pointer mode/nlink mismatch')
  }
  const pointer = parseCanonicalJsonObject(pointerFile.bytes, 'published pointer')
  exactKeys(
    pointer,
    ['bundleRelativePath', 'receiptRelativePath', 'receiptSha256', 'schemaVersion'],
    'published pointer',
  )
  if (pointer.schemaVersion !== '2' || typeof pointer.receiptSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(pointer.receiptSha256)) {
    fail('published pointer version or receipt hash is invalid')
  }
  const bundleRelativePath = pointer.bundleRelativePath
  if (typeof bundleRelativePath !== 'string'
    || !/^declaration-input-source-bundles\/bundle-[a-f0-9]{32}$/.test(bundleRelativePath)) {
    fail('published pointer has an unsafe bundleRelativePath')
  }
  if (pointer.receiptRelativePath !== `${bundleRelativePath}/receipt.json`) {
    fail('published pointer receiptRelativePath is not bound to its bundle')
  }
  assertCanonicalEqual(result.pointer, pointer, 'public pointer result')

  const bundleParent = resolve(owner.root, BUNDLE_PARENT_RELATIVE_PATH)
  const bundleRoot = resolve(dirname(pointerPath), bundleRelativePath)
  const relativeBundle = relative(bundleParent, bundleRoot)
  if (relativeBundle === '' || relativeBundle === '..' || relativeBundle.startsWith(`..${sep}`)
    || relativeBundle.includes(sep)) {
    fail('published bundle escapes its fixed parent')
  }
  const bundleNames = (await readdir(bundleParent)).sort(compareUtf8)
  if (canonicalJsonBytes(bundleNames) !== canonicalJsonBytes([relativeBundle])) {
    fail('publication left a loser, quarantine, or unexpected sibling bundle')
  }
  const pointerTemporaryNames = (await readdir(dirname(pointerPath)))
    .filter((name) => /^\.declaration-input-source-[a-f0-9]{32}\.tmp$/.test(name))
  if (pointerTemporaryNames.length !== 0) fail('publication left a pointer temporary alias')

  const tree = await walkPublishedTree(bundleRoot)
  const expectedFilePaths = new Set<string>(['.owner', 'selected-source.json', 'receipt.json'])
  const expectedDirectoryPaths = new Set<string>(['.'])
  for (const entry of entries) {
    expectedFilePaths.add(cacheIndexRelativePath(entry.key))
    expectedFilePaths.add(cacheContentRelativePath(entry.integrity))
  }
  for (const path of expectedFilePaths) addLogicalAncestors(expectedDirectoryPaths, path)
  assertExactPathSet(tree.files.map(({ relativePath }) => relativePath), expectedFilePaths, 'published file paths')
  assertExactPathSet(
    tree.directories.map(({ relativePath }) => relativePath),
    expectedDirectoryPaths,
    'published directory paths',
  )
  if (tree.files.length !== 341) fail(`published ordinary file count is ${tree.files.length}, expected 341`)

  const fileByPath = new Map(tree.files.map((file) => [file.relativePath, file]))
  let contentBytes = 0
  for (const entry of entries) {
    const indexPath = cacheIndexRelativePath(entry.key)
    const contentPath = cacheContentRelativePath(entry.integrity)
    const indexFile = fileByPath.get(indexPath)
    const contentFile = fileByPath.get(contentPath)
    if (!indexFile || !contentFile) fail(`published cache entry is missing: ${entry.lockPath}`)

    const expectedIndexBytes = frozenIndexBytes(entry)
    if (!indexFile.bytes.equals(expectedIndexBytes)) {
      fail(`published minimal index bytes mismatch: ${entry.lockPath}`)
    }
    const match = /^\n([a-f0-9]{40})\t([^\n]+)$/.exec(indexFile.bytes.toString('utf8'))
    if (!match || sha1(match[2]) !== match[1]) {
      fail(`published index checksum/line shape mismatch: ${entry.lockPath}`)
    }
    const indexRecord = parseJsonObject(Buffer.from(match[2], 'utf8'), `published index ${entry.lockPath}`)
    exactKeys(indexRecord, ['integrity', 'key', 'metadata', 'size'], `published index ${entry.lockPath}`)
    if (!isRecord(indexRecord.metadata)) fail(`published index metadata is invalid: ${entry.lockPath}`)
    exactKeys(indexRecord.metadata, ['url'], `published index metadata ${entry.lockPath}`)
    assertCanonicalEqual(indexRecord, frozenIndexRecord(entry), `published index ${entry.lockPath}`)

    if (!contentFile.bytes.equals(entry.contentBytes)
      || sha512Integrity(contentFile.bytes) !== entry.integrity) {
      fail(`published content bytes/integrity mismatch: ${entry.lockPath}`)
    }
    contentBytes += contentFile.bytes.length
  }
  if (contentBytes !== expectedDescriptor.selectedBytes) {
    fail(`published content byte sum is ${contentBytes}, expected ${String(expectedDescriptor.selectedBytes)}`)
  }

  const descriptorFile = fileByPath.get('selected-source.json')
  const receiptFile = fileByPath.get('receipt.json')
  const ownerFile = fileByPath.get('.owner')
  if (!descriptorFile || !receiptFile || !ownerFile) fail('published control file is missing')
  const descriptor = parseCanonicalJsonObject(descriptorFile.bytes, 'published descriptor')
  const receipt = parseCanonicalJsonObject(receiptFile.bytes, 'published receipt')
  exactKeys(
    receipt,
    ['ownerMarker', 'payload', 'payloadIdentitySha256', 'result', 'selectedBytes', 'selectedCount'],
    'published receipt',
  )
  if (receipt.result !== 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION'
    || receipt.selectedCount !== EXPECTED_REGISTRY_COUNT
    || receipt.selectedBytes !== expectedDescriptor.selectedBytes
    || typeof receipt.ownerMarker !== 'string'
    || !/^[a-f0-9]{32}$/.test(receipt.ownerMarker)
    || ownerFile.bytes.toString('utf8') !== receipt.ownerMarker
    || !Array.isArray(receipt.payload)) {
    fail('published receipt summary or owner binding is invalid')
  }
  const expectedPayload = independentPayloadInventory(tree)
  assertCanonicalEqual(receipt.payload, expectedPayload, 'published receipt payload')
  const payloadIdentitySha256 = sha256(canonicalJsonBytes(expectedPayload))
  if (receipt.payloadIdentitySha256 !== payloadIdentitySha256) {
    fail('published receipt payload identity is invalid')
  }
  if (pointer.receiptSha256 !== sha256(receiptFile.bytes)) {
    fail('published pointer does not hash the exact receipt bytes')
  }
  assertCanonicalEqual(result.descriptor, descriptor, 'public descriptor result')

  const banned = knownLeakVariants([
    ...knownLocalValues,
    owner.root,
    owner.canonicalRoot,
    owner.marker.trim(),
    pointerPath,
    bundleParent,
    bundleRoot,
  ])
  assertNoLocalPathLeak(pointerFile.bytes.toString('utf8'), 'pointer', banned)
  assertNoLocalPathLeak(JSON.stringify(result), 'public prepare result', banned)
  for (const directory of tree.directories) {
    assertNoLocalPathLeak(directory.relativePath, `published directory ${directory.relativePath}`, banned)
  }
  for (const file of tree.files) {
    assertNoLocalPathLeak(file.relativePath, `published file name ${file.relativePath}`, banned)
    assertNoLocalPathLeak(file.bytes.toString('utf8'), `published ${file.relativePath}`, banned)
  }

  exactKeys(expectedDescriptor.packageCounts as Record<string, unknown>, ['registry', 'deepseek', 'dsh'], 'expected descriptor packageCounts')
  exactKeys(descriptor, [
    'schemaVersion',
    'inputLabel',
    'authorizationBasis',
    'packageJsonRawSha256',
    'packageJsonCanonicalSha256',
    'packageLockRawSha256',
    'packageLockCanonicalSha256',
    'lockProjectionSha256',
    'selectedCacheIndexSha256',
    'selectedContentAggregateSha256',
    'selectedCacheRelativePath',
    'packageCounts',
    'selectedCount',
    'selectedBytes',
    'uniqueIndexFileCount',
    'uniqueContentFileCount',
  ], 'published descriptor')
  if (!isRecord(descriptor.packageCounts)) fail('published descriptor packageCounts is invalid')
  exactKeys(descriptor.packageCounts, ['registry', 'deepseek', 'dsh'], 'published descriptor packageCounts')
  assertCanonicalEqual(descriptor, expectedDescriptor, 'published descriptor')

  return {
    pointer,
    pointerBytes: pointerFile.bytes.toString('utf8'),
    pointerDev: pointerFile.witness.dev,
    pointerIno: pointerFile.witness.ino,
    pointerNlink: pointerFile.witness.nlink,
    descriptor,
    receipt,
    bundleCount: bundleNames.length,
    pointerTemporaryCount: pointerTemporaryNames.length,
    indexFileCount: EXPECTED_REGISTRY_COUNT,
    contentFileCount: EXPECTED_REGISTRY_COUNT,
    contentBytes,
    publishedFileCount: tree.files.length,
  }
}

async function snapshotSyntheticInputs({
  inputRoot,
  candidateRoot,
  copiedProductionScriptPath,
  copiedLinkFaultWrapperPath,
}: {
  inputRoot: string
  candidateRoot: string
  copiedProductionScriptPath: string
  copiedLinkFaultWrapperPath?: string
}): Promise<string> {
  const [inputTree, candidateTree, copiedScript, copiedLinkFaultWrapper] = await Promise.all([
    snapshotReadOnlyTreeIdentity(inputRoot),
    snapshotReadOnlyTreeIdentity(candidateRoot),
    readStableRegularFile(copiedProductionScriptPath),
    copiedLinkFaultWrapperPath
      ? readStableRegularFile(copiedLinkFaultWrapperPath)
      : Promise.resolve(undefined),
  ])
  if (copiedScript.witness.mode !== 0o444 || copiedScript.witness.nlink !== '1') {
    fail('copied production script is not single-link mode 0444')
  }
  if (copiedLinkFaultWrapper
    && (copiedLinkFaultWrapper.witness.mode !== 0o444
      || copiedLinkFaultWrapper.witness.nlink !== '1')) {
    fail('copied link-fault wrapper is not single-link mode 0444')
  }
  return canonicalJsonBytes({
    inputTree,
    candidateTree,
    copiedProductionScript: copiedScript.witness,
    ...(copiedLinkFaultWrapper
      ? { copiedLinkFaultWrapper: copiedLinkFaultWrapper.witness }
      : {}),
  })
}

async function setupAndRun(
  owner: OwnedTemporaryRoot,
  repositoryRoot: string,
  packageJsonSource: StableSourceFile,
  packageLockSource: StableSourceFile,
  productionScriptSource: StableSourceFile,
  mode: 'single' | 'concurrent',
  faultMode?: undefined,
): Promise<Synthetic169ProductionFixture>
async function setupAndRun(
  owner: OwnedTemporaryRoot,
  repositoryRoot: string,
  packageJsonSource: StableSourceFile,
  packageLockSource: StableSourceFile,
  productionScriptSource: StableSourceFile,
  mode: 'single',
  faultMode: LinkFaultMode,
): Promise<Synthetic169LinkFaultFixture>
async function setupAndRun(
  owner: OwnedTemporaryRoot,
  repositoryRoot: string,
  packageJsonSource: StableSourceFile,
  packageLockSource: StableSourceFile,
  productionScriptSource: StableSourceFile,
  mode: 'single' | 'concurrent' = 'single',
  faultMode?: LinkFaultMode,
): Promise<Synthetic169ProductionFixture | Synthetic169LinkFaultFixture> {
  if (packageJsonSource.witness.sha256 !== EXPECTED_PACKAGE_JSON_RAW_SHA256) {
    fail('approved package.json raw SHA-256 changed')
  }
  if (packageLockSource.witness.sha256 !== EXPECTED_PACKAGE_LOCK_RAW_SHA256) {
    fail('approved package-lock.json raw SHA-256 changed')
  }
  const packageJson = structuredClone(parseJsonObject(packageJsonSource.bytes, 'approved package.json'))
  const originalPackageLock = parseJsonObject(packageLockSource.bytes, 'approved package-lock.json')
  const packageJsonCanonicalSha256 = sha256(canonicalJsonBytes(packageJson))
  const originalPackageLockCanonicalSha256 = sha256(canonicalJsonBytes(originalPackageLock))
  if (packageJsonCanonicalSha256 !== EXPECTED_PACKAGE_JSON_CANONICAL_SHA256) {
    fail('approved package.json canonical SHA-256 changed')
  }
  if (originalPackageLockCanonicalSha256 !== EXPECTED_PACKAGE_LOCK_CANONICAL_SHA256) {
    fail('approved package-lock.json canonical SHA-256 changed')
  }

  const synthetic = cloneLockWithSyntheticIntegrity(originalPackageLock)
  const syntheticPackageLockBytes = Buffer.from(prettyJsonBytes(synthetic.packageLock), 'utf8')
  const packageLockRawSha256 = sha256(syntheticPackageLockBytes)
  const packageLockCanonicalSha256 = sha256(canonicalJsonBytes(synthetic.packageLock))
  const expectedDescriptor = buildExpectedDescriptor({
    packageJsonRawSha256: packageJsonSource.witness.sha256,
    packageJsonCanonicalSha256,
    packageLockRawSha256,
    packageLockCanonicalSha256,
    entries: synthetic.entries,
    selectedContentBytes: synthetic.selectedContentBytes,
  })

  const inputRoot = resolve(owner.root, 'synthetic-inputs')
  const sourceCacheRoot = resolve(inputRoot, '_cacache')
  const npmCliPlaceholderPath = resolve(inputRoot, 'npm-cli-placeholder.mjs')
  await materializeSyntheticCache(sourceCacheRoot, synthetic.entries)
  // If production ever invokes this path, the fixture fails loudly. It is a
  // non-executable, read-only placeholder rather than an npm installation.
  await writeExclusiveFile(
    npmCliPlaceholderPath,
    "throw new Error('SYNTHETIC_NPM_PLACEHOLDER_MUST_NOT_RUN')\n",
  )
  await chmod(npmCliPlaceholderPath, 0o444)
  await chmod(inputRoot, 0o555)
  await assertTreeHasExactReadOnlyModes(inputRoot)
  const sourceCacheTreeBefore = await snapshotReadOnlyTreeIdentity(sourceCacheRoot)
  const sourceCacheTreeBeforeBytes = canonicalJsonBytes(sourceCacheTreeBefore)

  const candidateRoot = resolve(owner.root, CANDIDATE_RELATIVE_PATH)
  await mkdir(candidateRoot, { recursive: true, mode: 0o700 })
  const candidate = makeStrictCandidate(
    sourceCacheRoot,
    npmCliPlaceholderPath,
    synthetic.selectedContentBytes,
  )
  await Promise.all([
    writeExclusiveFile(
      resolve(candidateRoot, 'candidate.json'),
      `${JSON.stringify(candidate, null, 2)}\n`,
    ),
    writeExclusiveFile(resolve(candidateRoot, 'package.json'), packageJsonSource.bytes),
    writeExclusiveFile(resolve(candidateRoot, 'package-lock.json'), syntheticPackageLockBytes),
  ])
  await makeTreeExactlyReadOnly(candidateRoot)
  await assertTreeHasExactReadOnlyModes(candidateRoot)

  const copiedProductionScriptPath = resolve(owner.root, PRODUCTION_SCRIPT_RELATIVE_PATH)
  const syntheticPatchedScript = patchProductionScript(
    productionScriptSource.bytes.toString('utf8'),
    synthetic.selectedContentBytes,
    packageLockCanonicalSha256,
  )
  const copiedLinkFaultWrapperPath = faultMode
    ? resolve(owner.root, LINK_FAULT_WRAPPER_RELATIVE_PATH)
    : undefined
  const patchedScript = faultMode
    ? patchFsPromisesImportForLinkFault(syntheticPatchedScript)
    : syntheticPatchedScript
  if (copiedLinkFaultWrapperPath && faultMode) {
    await writeExclusiveFile(
      copiedLinkFaultWrapperPath,
      linkFaultWrapperSource(faultMode),
      0o444,
    )
  }
  await writeExclusiveFile(copiedProductionScriptPath, patchedScript, 0o444)
  const importUrl = pathToFileURL(copiedProductionScriptPath)
  importUrl.searchParams.set('syntheticFixtureOwner', owner.marker.trim())
  importUrl.searchParams.set('nonce', randomUUID())
  const syntheticInputsBefore = await snapshotSyntheticInputs({
    inputRoot,
    candidateRoot,
    copiedProductionScriptPath,
    copiedLinkFaultWrapperPath,
  })

  const imported: unknown = await import(importUrl.href)
  if (!isRecord(imported) || typeof imported.prepareSelectedSource !== 'function') {
    fail('copied production module does not export prepareSelectedSource')
  }
  const reviewedProductionExports = [
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
  ].sort(compareUtf8)
  const actualProductionExports = Object.keys(imported).sort(compareUtf8)
  if (canonicalJsonBytes(actualProductionExports) !== canonicalJsonBytes(reviewedProductionExports)) {
    fail('production module export surface differs from the reviewed allowlist')
  }
  const acceptance = imported as AcceptanceModule

  let linkFaultModule: LinkFaultModule | undefined
  let foreignCanaryBefore: ForeignCanarySnapshot | undefined
  if (copiedLinkFaultWrapperPath && faultMode) {
    const wrapperImported: unknown = await import(pathToFileURL(copiedLinkFaultWrapperPath).href)
    if (!isRecord(wrapperImported) || !isRecord(wrapperImported.linkFaultEvidence)) {
      fail('copied link-fault wrapper does not expose evidence')
    }
    linkFaultModule = wrapperImported as LinkFaultModule
    if (faultMode === 'before-real-link') {
      foreignCanaryBefore = await createForeignCanaries(owner)
    }
  }

  const invokeProduction = () => acceptance.prepareSelectedSource({ workspaceRoot: owner.root })
  if (faultMode === 'before-real-link') {
    let rejection: unknown
    try {
      await invokeProduction()
      fail('before-real-link fault unexpectedly passed')
    } catch (error) {
      rejection = error
    }
    const reasonCode = isRecord(rejection) && typeof rejection.code === 'string'
      ? rejection.code
      : 'UNEXPECTED_ERROR'
    if (reasonCode !== 'POINTER_COMMIT_FAILED') {
      throw rejection
    }
    if (!linkFaultModule || !foreignCanaryBefore) {
      fail('before-real-link fixture state was not initialized')
    }
    const sourceCacheTreeAfterBytes = canonicalJsonBytes(
      await snapshotReadOnlyTreeIdentity(sourceCacheRoot),
    )
    if (sourceCacheTreeAfterBytes !== sourceCacheTreeBeforeBytes) {
      fail('production preparation changed the synthetic source cache tree')
    }
    const syntheticInputsAfter = await snapshotSyntheticInputs({
      inputRoot,
      candidateRoot,
      copiedProductionScriptPath,
      copiedLinkFaultWrapperPath,
    })
    if (syntheticInputsAfter !== syntheticInputsBefore) {
      fail('production preparation changed a synthetic input, copied script, or fault wrapper')
    }
    return {
      faultMode,
      outcome: {
        kind: 'rejected',
        reasonCode,
        publicError: acceptance.mapPublicInputError(rejection),
      },
      linkFaultEvidence: structuredClone(linkFaultModule.linkFaultEvidence),
      failureState: await inspectFailedLinkPublication(owner, foreignCanaryBefore),
    }
  }
  const rawSettlements: PromiseSettledResult<PrepareResult>[] = mode === 'concurrent'
    ? await Promise.allSettled([invokeProduction(), invokeProduction()])
    : [{ status: 'fulfilled', value: await invokeProduction() }]
  const fulfilled = rawSettlements.filter(
    (settlement): settlement is PromiseFulfilledResult<PrepareResult> => settlement.status === 'fulfilled',
  )
  if (fulfilled.length === 0) fail('no concurrent producer published a result')
  const result: PrepareResult = fulfilled[0].value
  if (result.status !== 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION') {
    fail(`production preparation did not pass: ${JSON.stringify(result)}`)
  }
  const concurrentSettlements = mode === 'concurrent'
    ? rawSettlements.map((settlement) => settlement.status === 'fulfilled'
      ? { status: 'fulfilled' as const, result: settlement.value }
      : {
          status: 'rejected' as const,
          reasonCode: typeof (settlement.reason as { code?: unknown })?.code === 'string'
            ? String((settlement.reason as { code: string }).code)
            : 'UNEXPECTED_ERROR',
        })
    : undefined
  const sourceCacheTreeAfterBytes = canonicalJsonBytes(await snapshotReadOnlyTreeIdentity(sourceCacheRoot))
  if (sourceCacheTreeAfterBytes !== sourceCacheTreeBeforeBytes) {
    fail('production preparation changed the synthetic source cache tree')
  }
  const syntheticInputsAfter = await snapshotSyntheticInputs({
    inputRoot,
    candidateRoot,
    copiedProductionScriptPath,
    copiedLinkFaultWrapperPath,
  })
  if (syntheticInputsAfter !== syntheticInputsBefore) {
    fail('production preparation changed a synthetic input or copied script')
  }
  const repositoryCanonicalRoot = await realpath(repositoryRoot)
  const approvedCanonicalPaths = await Promise.all([
    packageJsonSource.witness.path,
    packageLockSource.witness.path,
    productionScriptSource.witness.path,
  ].map((path) => realpath(path)))
  const publication = await inspectPublication(
    owner,
    result,
    synthetic.entries,
    expectedDescriptor,
    [
      repositoryRoot,
      repositoryCanonicalRoot,
      packageJsonSource.witness.path,
      packageLockSource.witness.path,
      productionScriptSource.witness.path,
      ...approvedCanonicalPaths,
      inputRoot,
      sourceCacheRoot,
      npmCliPlaceholderPath,
      candidateRoot,
      copiedProductionScriptPath,
      ...(copiedLinkFaultWrapperPath ? [copiedLinkFaultWrapperPath] : []),
      importUrl.href,
    ],
  )
  if (faultMode === 'after-real-link') {
    if (!linkFaultModule) fail('after-real-link fixture state was not initialized')
    return {
      faultMode,
      outcome: { kind: 'fulfilled' },
      linkFaultEvidence: structuredClone(linkFaultModule.linkFaultEvidence),
      selectedContentBytes: synthetic.selectedContentBytes,
      result,
      publication,
    }
  }
  let sourceCacheIsolated = false
  const prepareAgainAfterIsolatingSourceCache = async () => {
    if (sourceCacheIsolated) fail('synthetic source cache was already isolated')
    sourceCacheIsolated = true

    const sourceBefore = await lstat(sourceCacheRoot, { bigint: true })
    if (!sourceBefore.isDirectory() || sourceBefore.isSymbolicLink()
      || Number(sourceBefore.mode & 0o777n) !== 0o555) {
      fail('synthetic source cache is not an owned read-only directory before isolation')
    }
    const isolatedSourceCacheRoot = resolve(
      inputRoot,
      `.isolated-source-cache-${randomUUID()}`,
    )
    const isolatedRelativePath = relative(owner.root, isolatedSourceCacheRoot)
    if (isolatedRelativePath === '' || isolatedRelativePath === '..'
      || isolatedRelativePath.startsWith(`..${sep}`)
      || resolve(dirname(isolatedSourceCacheRoot)) !== inputRoot) {
      fail('isolated source cache path escapes the owned temporary root')
    }
    try {
      await lstat(isolatedSourceCacheRoot)
      fail('isolated source cache target already exists')
    } catch (error) {
      if (!isRecord(error) || error.code !== 'ENOENT') throw error
    }

    await chmod(inputRoot, 0o755)
    try {
      await rename(sourceCacheRoot, isolatedSourceCacheRoot)
    } finally {
      await chmod(inputRoot, 0o555)
    }

    try {
      await lstat(sourceCacheRoot)
      fail('candidate source cache path still exists after isolation')
    } catch (error) {
      if (!isRecord(error) || error.code !== 'ENOENT') throw error
    }
    const isolatedAfter = await lstat(isolatedSourceCacheRoot, { bigint: true })
    if (!isolatedAfter.isDirectory() || isolatedAfter.isSymbolicLink()
      || isolatedAfter.dev !== sourceBefore.dev || isolatedAfter.ino !== sourceBefore.ino
      || Number(isolatedAfter.mode & 0o777n) !== 0o555) {
      fail('isolated source cache is not the renamed owned directory')
    }
    const isolatedTreeBytes = canonicalJsonBytes(
      await snapshotReadOnlyTreeIdentity(isolatedSourceCacheRoot),
    )
    if (isolatedTreeBytes !== sourceCacheTreeBeforeBytes) {
      fail('isolated source cache tree differs from the approved synthetic source')
    }
    const candidateAfterIsolation = parseJsonObject(
      (await readStableRegularFile(resolve(candidateRoot, 'candidate.json'))).bytes,
      'candidate after source isolation',
    )
    if (candidateAfterIsolation.sourceCacheRoot !== sourceCacheRoot) {
      fail('candidate no longer points to the original missing source cache path')
    }

    const recoveredResult = await invokeProduction()
    const recoveredPublication = await inspectPublication(
      owner,
      recoveredResult,
      synthetic.entries,
      expectedDescriptor,
      [
        repositoryRoot,
        repositoryCanonicalRoot,
        packageJsonSource.witness.path,
        packageLockSource.witness.path,
        productionScriptSource.witness.path,
        ...approvedCanonicalPaths,
        inputRoot,
        sourceCacheRoot,
        isolatedSourceCacheRoot,
        npmCliPlaceholderPath,
        candidateRoot,
        copiedProductionScriptPath,
        importUrl.href,
      ],
    )
    return {
      result: recoveredResult,
      publication: recoveredPublication,
      sourceIsolation: {
        originalPathMissing: true as const,
        candidateStillPointsToOriginalPath: true as const,
      },
    }
  }
  let pointerTemporaryAliasAdded = false
  const prepareAgainAfterAddingPointerTemporaryAlias = async () => {
    if (pointerTemporaryAliasAdded) fail('pointer temporary alias was already added')
    pointerTemporaryAliasAdded = true

    const pointerPath = resolve(owner.root, POINTER_RELATIVE_PATH)
    const pointerParent = dirname(pointerPath)
    const aliasName = `.declaration-input-source-${randomUUID().replaceAll('-', '')}.tmp`
    if (!/^\.declaration-input-source-[a-f0-9]{32}\.tmp$/.test(aliasName)) {
      fail('generated pointer temporary alias name is invalid')
    }
    const aliasPath = resolve(pointerParent, aliasName)
    if (dirname(aliasPath) !== pointerParent
      || relative(owner.root, aliasPath).startsWith(`..${sep}`)) {
      fail('pointer temporary alias escapes its owned parent')
    }
    try {
      await lstat(aliasPath)
      fail('pointer temporary alias target already exists')
    } catch (error) {
      if (!isRecord(error) || error.code !== 'ENOENT') throw error
    }

    await link(pointerPath, aliasPath)
    const [stableWithAlias, aliasWithStable] = await Promise.all([
      lstat(pointerPath, { bigint: true }),
      lstat(aliasPath, { bigint: true }),
    ])
    if (!stableWithAlias.isFile() || stableWithAlias.isSymbolicLink()
      || !aliasWithStable.isFile() || aliasWithStable.isSymbolicLink()
      || stableWithAlias.dev !== aliasWithStable.dev
      || stableWithAlias.ino !== aliasWithStable.ino
      || stableWithAlias.nlink !== 2n || aliasWithStable.nlink !== 2n
      || stableWithAlias.dev.toString() !== publication.pointerDev
      || stableWithAlias.ino.toString() !== publication.pointerIno
      || Number(stableWithAlias.mode & 0o777n) !== 0o444
      || stableWithAlias.size !== BigInt(Buffer.byteLength(publication.pointerBytes, 'utf8'))) {
      fail('pointer temporary alias is not a second link to the stable pointer')
    }
    let aliasHandle
    try {
      aliasHandle = await open(aliasPath, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
      const aliasBytes = await aliasHandle.readFile()
      const aliasAfterRead = await aliasHandle.stat({ bigint: true })
      if (!aliasBytes.equals(Buffer.from(publication.pointerBytes, 'utf8'))
        || aliasAfterRead.dev !== stableWithAlias.dev
        || aliasAfterRead.ino !== stableWithAlias.ino
        || aliasAfterRead.nlink !== 2n) {
        fail('pointer temporary alias bytes or identity changed before recovery')
      }
    } finally {
      await aliasHandle?.close()
    }

    const recoveredResult = await invokeProduction()
    try {
      await lstat(aliasPath)
      fail('pointer temporary alias remains after recovery')
    } catch (error) {
      if (!isRecord(error) || error.code !== 'ENOENT') throw error
    }
    const recoveredPublication = await inspectPublication(
      owner,
      recoveredResult,
      synthetic.entries,
      expectedDescriptor,
      [
        repositoryRoot,
        repositoryCanonicalRoot,
        packageJsonSource.witness.path,
        packageLockSource.witness.path,
        productionScriptSource.witness.path,
        ...approvedCanonicalPaths,
        inputRoot,
        sourceCacheRoot,
        npmCliPlaceholderPath,
        candidateRoot,
        copiedProductionScriptPath,
        importUrl.href,
        aliasPath,
      ],
    )
    return {
      result: recoveredResult,
      publication: recoveredPublication,
      crashResidue: {
        stableNlinkBeforeRecovery: '2' as const,
        aliasSharedStableInode: true as const,
        aliasRemoved: true as const,
      },
    }
  }
  return {
    workspaceRoot: owner.root,
    selectedContentBytes: synthetic.selectedContentBytes,
    sourceCacheTreeWitnessSha256: sha256(sourceCacheTreeBeforeBytes),
    packageJsonCanonicalSha256,
    packageLockCanonicalSha256,
    result,
    publication,
    prepareAgain: invokeProduction,
    prepareAgainAfterIsolatingSourceCache,
    prepareAgainAfterAddingPointerTemporaryAlias,
    ...(concurrentSettlements ? { concurrentSettlements } : {}),
  }
}

function parseProductionBoundaryFiles(source: string): Array<{ path: string; sha256: string }> {
  const match = singleMatch(
    source,
    /^const PRODUCTION_BOUNDARY_LINES = `([^`]*)`$/gm,
    'production-boundary file list',
  )
  const records = match[1].split('\n').map((line) => {
    const separator = line.lastIndexOf(' ')
    if (separator < 1) fail('invalid production-boundary fixture line')
    const path = line.slice(0, separator)
    const digest = line.slice(separator + 1)
    if (path.startsWith('/') || path.includes('\\') || path.split('/').includes('..')
      || !/^[a-f0-9]{64}$/.test(digest)) {
      fail('unsafe production-boundary fixture line')
    }
    return { path, sha256: digest }
  })
  if (records.length === 0
    || new Set(records.map(({ path }) => path)).size !== records.length) {
    fail('production-boundary fixture list is empty or duplicated')
  }
  return records
}

async function copyVerifiedFixtureFile({
  repositoryRoot,
  workspaceRoot,
  relativePath,
  expectedSha256,
}: {
  repositoryRoot: string
  workspaceRoot: string
  relativePath: string
  expectedSha256?: string
}): Promise<SourceWitness> {
  const source = await readStableRegularFile(resolve(repositoryRoot, relativePath))
  if (expectedSha256 && source.witness.sha256 !== expectedSha256) {
    fail(`committed fixture source hash changed: ${relativePath}`)
  }
  const destination = resolve(workspaceRoot, relativePath)
  const escaped = relative(workspaceRoot, destination)
  if (escaped === '' || escaped === '..' || escaped.startsWith(`..${sep}`)) {
    fail(`committed fixture destination escapes the owner root: ${relativePath}`)
  }
  await writeExclusiveFile(destination, source.bytes, source.witness.mode)
  const copied = await readStableRegularFile(destination)
  if (!copied.bytes.equals(source.bytes)) fail(`committed fixture copy changed bytes: ${relativePath}`)
  return source.witness
}

function buildSyntheticV1BootstrapManifest({
  committedInput,
  entries,
  packageLockRawSha256,
  selectedContentBytes,
}: {
  committedInput: JsonObject
  entries: SyntheticLockEntry[]
  packageLockRawSha256: string
  selectedContentBytes: number
}): JsonObject {
  const synthetic = structuredClone(committedInput)
  const selectedEntries = entries.map((entry) => {
    const indexJson = canonicalJsonBytes(frozenIndexRecord(entry))
    return {
      lockPath: entry.lockPath,
      name: entry.name,
      version: entry.version,
      integrity: entry.integrity,
      key: entry.key,
      indexChecksum: sha1(indexJson),
      byteLength: entry.contentBytes.length,
      contentDigest: entry.integrity,
    }
  })
  const legacyCollator = new Intl.Collator()
  const legacyContentAggregate = selectedEntries
    .map(({ contentDigest, byteLength }) => ({ contentDigest, byteLength }))
    .sort((left, right) => left.contentDigest === right.contentDigest
      ? left.byteLength - right.byteLength
      : legacyCollator.compare(left.contentDigest, right.contentDigest))
  synthetic.packageLockSha256 = packageLockRawSha256
  synthetic.selectedCache = {
    entries: selectedEntries,
    totalBytes: selectedContentBytes,
  }
  synthetic.selectedCacheIndexSha256 = sha256(prettyJsonBytes(selectedEntries))
  synthetic.selectedContentAggregateSha256 = sha256(prettyJsonBytes(legacyContentAggregate))
  return synthetic
}

function replayInstallPlan(packageLock: JsonObject): Array<{
  lockPath: string
  manifest: JsonObject
}> {
  if (!isRecord(packageLock.packages)) fail('synthetic replay lock packages map is missing')
  return Object.entries(packageLock.packages)
    .filter(([lockPath]) => lockPath !== '')
    .sort(([left], [right]) => compareUtf8(left, right))
    .map(([lockPath, value]) => {
      if (!isRecord(value) || typeof value.version !== 'string') {
        fail(`synthetic replay lock record is invalid: ${lockPath}`)
      }
      const manifest: JsonObject = {
        name: packageNameFromLockPath(lockPath),
        version: value.version,
      }
      for (const field of [
        'dependencies',
        'optionalDependencies',
        'peerDependencies',
        'peerDependenciesMeta',
      ] as const) {
        if (isRecord(value[field])) manifest[field] = structuredClone(value[field]) as JsonObject
      }
      return { lockPath, manifest }
    })
}

function replayChildProcessSeamSource(
  installPlan: ReturnType<typeof replayInstallPlan>,
): string {
  return `import { lstat, mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve, sep } from 'node:path'

const installPlan = ${JSON.stringify(installPlan)}
const expectedClientCompilerOverlayRelative = ${JSON.stringify(CLIENT_COMPILER_OVERLAY_RELATIVE)}
const expectedClientCompilerOverlayBytes = ${JSON.stringify(`${canonicalJsonBytes(CLIENT_COMPILER_OVERLAY)}\n`)}
let failNextCi = false
let failNextTsc = false
let storageCompileInjection = null
let replaceClientOverlayOnNextCompile = false
let replaceCommittedPathAfterCi = null

export const replayEvidence = { calls: [] }

export function failNextReplay() {
  if (failNextCi) throw new Error('synthetic replay failure is already armed')
  failNextCi = true
}

export function failNextCompile() {
  if (failNextTsc) throw new Error('synthetic compile failure is already armed')
  failNextTsc = true
}

export function injectStorageOnNextCompile(surface, packageName, nestedPath) {
  if (storageCompileInjection !== null
    || (surface !== 'host' && surface !== 'client')
    || (packageName !== 'dsh-storage' && packageName !== 'dsh-storage-domain')
    || typeof nestedPath !== 'string'
    || nestedPath === ''
    || nestedPath.split(/[\\/]/u).some((segment) => segment === '' || segment === '..')) {
    throw new Error('synthetic storage compile injection is already armed or invalid')
  }
  storageCompileInjection = { surface, packageName, nestedPath }
}

export function replaceClientOverlayWithSameBytesOnNextCompile() {
  if (replaceClientOverlayOnNextCompile) {
    throw new Error('synthetic client overlay replacement is already armed')
  }
  replaceClientOverlayOnNextCompile = true
}

export function replaceCommittedFileWithSameBytesAfterReplay(path) {
  if (replaceCommittedPathAfterCi !== null || typeof path !== 'string' || path === '') {
    throw new Error('synthetic committed replacement is already armed or invalid')
  }
  replaceCommittedPathAfterCi = path
}

function result(stdout = '') {
  return { stdout, stderr: '' }
}

function argumentValue(args, prefix) {
  const matches = args.filter((value) => value.startsWith(prefix))
  if (matches.length !== 1 || matches[0].length === prefix.length) {
    throw new Error('synthetic replay received an invalid ' + prefix + ' argument')
  }
  return matches[0].slice(prefix.length)
}

async function materializeInstall(prefix) {
  for (const entry of installPlan) {
    const packageRoot = resolve(prefix, entry.lockPath)
    const escaped = relative(prefix, packageRoot)
    if (escaped === '' || escaped === '..' || escaped.startsWith('..' + sep)) {
      throw new Error('synthetic install path escaped its replay root')
    }
    await mkdir(packageRoot, { recursive: true, mode: 0o700 })
    await writeFile(
      resolve(packageRoot, 'package.json'),
      JSON.stringify(entry.manifest, null, 2) + '\\n',
      { flag: 'wx', mode: 0o600 },
    )
    if (entry.lockPath === 'node_modules/typescript') {
      const tscPath = resolve(packageRoot, 'bin/tsc')
      await mkdir(dirname(tscPath), { recursive: true, mode: 0o700 })
      await writeFile(tscPath, "throw new Error('SYNTHETIC_TSC_MUST_NOT_EXECUTE')\\n", {
        flag: 'wx',
        mode: 0o600,
      })
    }
  }
}

export function execFile(file, args, options, callback) {
  if (typeof options === 'function') {
    callback = options
    options = {}
  }
  const capturedArgs = Array.isArray(args) ? args.map(String) : []
  const capturedEnv = {}
  for (const [key, value] of Object.entries(options?.env ?? {})) {
    if (typeof value === 'string') capturedEnv[key] = value
  }
  replayEvidence.calls.push({
    file: String(file),
    args: capturedArgs,
    env: capturedEnv,
    cwd: typeof options?.cwd === 'string' ? options.cwd : null,
    timeout: Number.isSafeInteger(options?.timeout) ? options.timeout : null,
    maxBuffer: Number.isSafeInteger(options?.maxBuffer) ? options.maxBuffer : null,
  })

  Promise.resolve().then(async () => {
    if (capturedArgs.length === 2 && capturedArgs[1] === '--version') {
      return result('11.9.0\\n')
    }
    if (capturedArgs[1] === 'ci') {
      if (failNextCi) {
        failNextCi = false
        throw Object.assign(new Error('synthetic npm ci failure'), { code: 1 })
      }
      await materializeInstall(argumentValue(capturedArgs, '--prefix='))
      if (replaceCommittedPathAfterCi !== null) {
        const target = replaceCommittedPathAfterCi
        replaceCommittedPathAfterCi = null
        const bytes = await readFile(target)
        const targetStat = await lstat(target)
        const temporary = target + '.byte-identical-replacement'
        await writeFile(temporary, bytes, { flag: 'wx', mode: targetStat.mode & 0o777 })
        await rename(temporary, target)
      }
      return result()
    }
    if (capturedArgs[0]?.endsWith('/node_modules/typescript/bin/tsc')
      || capturedArgs[0]?.endsWith('\\\\node_modules\\\\typescript\\\\bin\\\\tsc')) {
      if (capturedArgs[1] !== '-p' || typeof capturedArgs[2] !== 'string') {
        throw new Error('synthetic tsc received an invalid project argument')
      }
      const isClientCompile = capturedArgs[2].endsWith(sep + expectedClientCompilerOverlayRelative)
      const isHostCompile = capturedArgs[2].endsWith(sep + 'tsconfig.surface.host.json')
      if (!isClientCompile && !isHostCompile) {
        throw new Error('synthetic tsc received an unknown project path')
      }
      const compileSurface = isClientCompile ? 'client' : 'host'
      if (isClientCompile) {
        if (relative(options.cwd, capturedArgs[2]) !== expectedClientCompilerOverlayRelative) {
          throw new Error('synthetic client overlay escaped replay root')
        }
        const overlayBytes = await readFile(capturedArgs[2], 'utf8')
        if (overlayBytes !== expectedClientCompilerOverlayBytes
          || /(?:\\/Users\\/|\\/private\\/|file:|[A-Za-z]:[\\\\/])/.test(overlayBytes)) {
          throw new Error('synthetic client overlay bytes are not exact and path-free')
        }
      }
      if (failNextTsc) {
        failNextTsc = false
        throw Object.assign(new Error('synthetic tsc failure'), { code: 1 })
      }
      if (replaceClientOverlayOnNextCompile
        && isClientCompile) {
        replaceClientOverlayOnNextCompile = false
        const overlayBytes = await readFile(capturedArgs[2])
        const overlayStat = await lstat(capturedArgs[2])
        const temporary = capturedArgs[2] + '.byte-identical-replacement'
        await writeFile(temporary, overlayBytes, {
          flag: 'wx',
          mode: overlayStat.mode & 0o777,
        })
        await rename(temporary, capturedArgs[2])
      }
      const contractRelativePath = compileSurface === 'host'
        ? 'tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts'
        : 'tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts'
      const outputPaths = [resolve(options.cwd, contractRelativePath)]
      if (storageCompileInjection?.surface === compileSurface) {
        const injection = storageCompileInjection
        storageCompileInjection = null
        const storagePath = resolve(
          options.cwd,
          'node_modules/@deepseek-ai',
          injection.packageName,
          injection.nestedPath,
        )
        const storageRelative = relative(options.cwd, storagePath)
        if (storageRelative === ''
          || storageRelative === '..'
          || storageRelative.startsWith('..' + sep)) {
          throw new Error('synthetic storage compile injection escaped replay root')
        }
        await mkdir(dirname(storagePath), { recursive: true, mode: 0o700 })
        await writeFile(storagePath, 'export {}\\n', { flag: 'wx', mode: 0o600 })
        outputPaths.push(storagePath)
      }
      return result(outputPaths.join('\\n') + '\\n')
    }
    throw new Error('unexpected child-process invocation reached the synthetic replay seam')
  }).then(
    (value) => callback(null, value),
    (error) => callback(error),
  )
}
`
}

async function locateExactRuntimeNpmCli(expectedSha256: string): Promise<StableSourceFile> {
  const candidates = [
    process.env.npm_execpath,
    resolve(dirname(process.execPath), '../lib/node_modules/npm/bin/npm-cli.js'),
  ].filter((value): value is string => typeof value === 'string' && value !== '')
  const visited = new Set<string>()
  for (const candidate of candidates) {
    let canonical: string
    try {
      canonical = await realpath(candidate)
    } catch {
      continue
    }
    if (visited.has(canonical)) continue
    visited.add(canonical)
    const source = await readStableRegularFile(canonical).catch(() => undefined)
    if (source && source.witness.sha256 === expectedSha256
      && canonical.split(sep).at(-1) === 'npm-cli.js') {
      return source
    }
  }
  fail('exact npm CLI bytes required by the committed runtime were not found')
}

async function rewriteOwnedReadOnlyFile(path: string, bytes: Buffer): Promise<void> {
  const before = await lstat(path, { bigint: true })
  if (!before.isFile() || before.isSymbolicLink() || before.nlink !== 1n) {
    fail('refusing to rewrite a non-owned synthetic fixture file')
  }
  await chmod(path, 0o600)
  let handle
  try {
    handle = await open(
      path,
      fsConstants.O_WRONLY | fsConstants.O_TRUNC | fsConstants.O_NOFOLLOW,
    )
    await handle.writeFile(bytes)
  } finally {
    await handle?.close()
    await chmod(path, 0o444).catch(() => {})
  }
  const after = await readStableRegularFile(path)
  if (!after.bytes.equals(bytes) || after.witness.mode !== 0o444) {
    fail('rewritten synthetic fixture file does not match requested bytes')
  }
}

async function snapshotCommittedFixtureEvidence(
  workspaceRoot: string,
  relativePaths: string[],
  selectedSourceBundleRoot: string,
): Promise<string> {
  const records = []
  for (const relativePath of [...new Set(relativePaths)].sort(compareUtf8)) {
    const stable = await readStableRegularFile(resolve(workspaceRoot, relativePath))
    records.push({
      path: relativePath,
      sha256: stable.witness.sha256,
      size: stable.witness.size,
      mode: stable.witness.mode,
      nlink: stable.witness.nlink,
    })
  }
  const pointer = await readStableRegularFile(resolve(workspaceRoot, POINTER_RELATIVE_PATH))
  const { path: _pointerPath, ...pointerIdentity } = pointer.witness
  return canonicalJsonBytes({
    committedFiles: records,
    stablePointer: pointerIdentity,
    selectedSourceBundle: await snapshotReadOnlyTreeIdentity(selectedSourceBundleRoot),
  })
}

/**
 * Builds one owner-marked temporary workspace, performs exactly one successful
 * public prepareSelectedSource({ workspaceRoot }) call, exposes the verified
 * result to the Vitest assertion callback, then cleans only that owned root.
 * The approved working-tree package/lock skeletons and production script are
 * re-read after cleanup and must retain their raw hash, mode and identity.
 */
async function withSynthetic169ProductionMode<T>(
  repositoryRoot: string,
  inspect: (fixture: Synthetic169ProductionFixture) => T | Promise<T>,
  mode: 'single' | 'concurrent',
): Promise<T> {
  if (typeof inspect !== 'function') fail('an assertion callback is required')
  const approvedPaths = [
    resolve(repositoryRoot, PACKAGE_JSON_RELATIVE_PATH),
    resolve(repositoryRoot, PACKAGE_LOCK_RELATIVE_PATH),
    resolve(repositoryRoot, PRODUCTION_SCRIPT_RELATIVE_PATH),
  ]
  const approvedSources = await Promise.all(approvedPaths.map(readStableRegularFile))
  const [packageJsonSource, packageLockSource, productionScriptSource] = approvedSources
  const owner = await createOwnedTemporaryRoot()

  let callbackValue!: T
  let primaryError: unknown
  let failed = false
  try {
    const fixture = await setupAndRun(
      owner,
      repositoryRoot,
      packageJsonSource,
      packageLockSource,
      productionScriptSource,
      mode,
    )
    callbackValue = await inspect(fixture)
  } catch (error) {
    failed = true
    primaryError = error
  }

  const teardownErrors: unknown[] = []
  try {
    await cleanupOwnedTemporaryRoot(owner)
  } catch (error) {
    teardownErrors.push(error)
  }
  try {
    await assertApprovedSourcesUnchanged(approvedSources)
  } catch (error) {
    teardownErrors.push(error)
  }

  if (failed && teardownErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...teardownErrors],
      'synthetic production-path assertion and teardown both failed',
    )
  }
  if (failed) throw primaryError
  if (teardownErrors.length > 0) {
    throw new AggregateError(teardownErrors, 'synthetic production-path teardown failed')
  }
  return callbackValue
}

export async function withSynthetic169ProductionPath<T>(
  repositoryRoot: string,
  inspect: (fixture: Synthetic169ProductionFixture) => T | Promise<T>,
): Promise<T> {
  return withSynthetic169ProductionMode(repositoryRoot, inspect, 'single')
}

export async function withSynthetic169BootstrapProductionPath<T>(
  repositoryRoot: string,
  inspect: (fixture: Synthetic169BootstrapFixture) => T | Promise<T>,
  options: Synthetic169BootstrapOptions = {},
): Promise<T> {
  if (typeof inspect !== 'function') fail('a bootstrap assertion callback is required')
  const productionSource = await readStableRegularFile(
    resolve(repositoryRoot, PRODUCTION_SCRIPT_RELATIVE_PATH),
  )
  const boundaryFiles = parseProductionBoundaryFiles(
    productionSource.bytes.toString('utf8'),
  )
  const copiedCommittedPaths = [
    ...boundaryFiles.map(({ path }) => path),
    'tools/harness-rc6-declarations/input-manifest.json',
    PACKAGE_JSON_RELATIVE_PATH,
    PACKAGE_LOCK_RELATIVE_PATH,
    'tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts',
    'tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts',
    'tsconfig.surface.host.json',
    'tsconfig.surface.client.json',
    'research/2026-09-05-rc6-declaration-closure.json',
    PRODUCTION_SCRIPT_RELATIVE_PATH,
    'scripts/verify-rc6-declaration-closure.mjs',
  ]

  return withSynthetic169ProductionPath(repositoryRoot, async (baseFixture) => {
    // macOS exposes the temporary directory through /var while realpath uses
    // /private/var.  The production bootstrap compares compiler realpaths to
    // the supplied workspace root, so expose and consume the canonical owner
    // root rather than relying on those two spellings being interchangeable.
    const workspaceRoot = await realpath(baseFixture.workspaceRoot)
    const originalPackageLockSource = await readStableRegularFile(
      resolve(repositoryRoot, PACKAGE_LOCK_RELATIVE_PATH),
    )
    const originalPackageLock = parseJsonObject(
      originalPackageLockSource.bytes,
      'committed package-lock skeleton',
    )
    const rootCompilerPackageLock = parseJsonObject(
      (await readStableRegularFile(resolve(repositoryRoot, 'package-lock.json'))).bytes,
      'root compiler package-lock',
    )
    const synthetic = cloneLockWithSyntheticIntegrity(originalPackageLock)
    const syntheticPackageLockBytes = Buffer.from(prettyJsonBytes(synthetic.packageLock), 'utf8')
    const syntheticPackageLockRawSha256 = sha256(syntheticPackageLockBytes)
    const candidateLock = await readStableRegularFile(
      resolve(baseFixture.workspaceRoot, CANDIDATE_RELATIVE_PATH, 'package-lock.json'),
    )
    if (!candidateLock.bytes.equals(syntheticPackageLockBytes)
      || synthetic.selectedContentBytes !== baseFixture.selectedContentBytes) {
      fail('bootstrap fixture did not reuse the verified 169-entry synthetic preparation')
    }

    for (const boundary of boundaryFiles) {
      await copyVerifiedFixtureFile({
        repositoryRoot,
        workspaceRoot: baseFixture.workspaceRoot,
        relativePath: boundary.path,
        expectedSha256: boundary.sha256,
      })
    }
    await copyVerifiedFixtureFile({
      repositoryRoot,
      workspaceRoot: baseFixture.workspaceRoot,
      relativePath: PACKAGE_JSON_RELATIVE_PATH,
      expectedSha256: EXPECTED_PACKAGE_JSON_RAW_SHA256,
    })
    for (const relativePath of [
      'tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts',
      'tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts',
      'tsconfig.surface.host.json',
      'tsconfig.surface.client.json',
      'research/2026-09-05-rc6-declaration-closure.json',
      'scripts/verify-rc6-declaration-closure.mjs',
    ]) {
      await copyVerifiedFixtureFile({
        repositoryRoot,
        workspaceRoot: baseFixture.workspaceRoot,
        relativePath,
      })
    }
    let transformedVerifierSourceSha256
    if (options.verifierSourceTransform) {
      const verifierPath = resolve(
        baseFixture.workspaceRoot,
        'scripts/verify-rc6-declaration-closure.mjs',
      )
      const verifierSource = await readStableRegularFile(verifierPath)
      const transformed = options.verifierSourceTransform(verifierSource.bytes.toString('utf8'))
      if (typeof transformed !== 'string' || transformed === verifierSource.bytes.toString('utf8')) {
        fail('synthetic verifier transform must produce different source')
      }
      await rewriteOwnedReadOnlyFile(verifierPath, Buffer.from(transformed, 'utf8'))
      transformedVerifierSourceSha256 = sha256(Buffer.from(transformed, 'utf8'))
    }

    const committedInputSource = await readStableRegularFile(resolve(
      repositoryRoot,
      'tools/harness-rc6-declarations/input-manifest.json',
    ))
    const committedInput = parseJsonObject(committedInputSource.bytes, 'committed v1 input manifest')
    if (committedInput.schemaVersion !== '1'
      || !isRecord(committedInput.runtime)
      || !isRecord(committedInput.runtime.npm)
      || typeof committedInput.runtime.npm.cliSha256 !== 'string') {
      fail('committed bootstrap input no longer contains the expected v1 runtime')
    }
    const syntheticV1 = buildSyntheticV1BootstrapManifest({
      committedInput,
      entries: synthetic.entries,
      packageLockRawSha256: syntheticPackageLockRawSha256,
      selectedContentBytes: synthetic.selectedContentBytes,
    })
    const syntheticV1Bytes = Buffer.from(prettyJsonBytes(syntheticV1), 'utf8')
    await writeExclusiveFile(
      resolve(baseFixture.workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json'),
      syntheticV1Bytes,
      committedInputSource.witness.mode,
    )
    await writeExclusiveFile(
      resolve(baseFixture.workspaceRoot, PACKAGE_LOCK_RELATIVE_PATH),
      syntheticPackageLockBytes,
      originalPackageLockSource.witness.mode,
    )

    const exactNpmCli = await locateExactRuntimeNpmCli(
      committedInput.runtime.npm.cliSha256,
    )
    const runtimeRoot = resolve(workspaceRoot, 'synthetic-runtime')
    await mkdir(runtimeRoot, { mode: 0o700 })
    const fakeNpmCliPath = resolve(runtimeRoot, 'npm-cli.js')
    await copyFile(exactNpmCli.witness.path, fakeNpmCliPath, fsConstants.COPYFILE_EXCL)
    await chmod(fakeNpmCliPath, 0o444)
    const fakeNpmCli = await readStableRegularFile(fakeNpmCliPath)
    if (!fakeNpmCli.bytes.equals(exactNpmCli.bytes)
      || fakeNpmCli.witness.sha256 !== committedInput.runtime.npm.cliSha256
      || fakeNpmCli.witness.mode !== 0o444) {
      fail('synthetic npm CLI identity copy does not match the committed runtime')
    }
    const syntheticTscPath = resolve(
      workspaceRoot,
      'node_modules/typescript/bin/tsc',
    )
    await writeExclusiveFile(
      syntheticTscPath,
      "throw new Error('SYNTHETIC_WORKSPACE_TSC_MUST_NOT_EXECUTE')\n",
      0o444,
    )
    for (const [relativePath, manifest] of [
      [
        'node_modules/typescript/package.json',
        { name: 'typescript', version: '6.0.3' },
      ],
      [
        'node_modules/@types/node/package.json',
        { name: '@types/node', version: '24.13.3' },
      ],
      [
        'node_modules/undici-types/package.json',
        { name: 'undici-types', version: '7.18.2' },
      ],
      [
        'node_modules/@types/react/package.json',
        { name: '@types/react', version: '18.3.31' },
      ],
      [
        'node_modules/@types/prop-types/package.json',
        { name: '@types/prop-types', version: '15.7.15' },
      ],
      [
        'node_modules/csstype/package.json',
        { name: 'csstype', version: '3.2.3' },
      ],
    ] as const) {
      await writeExclusiveFile(
        resolve(workspaceRoot, relativePath),
        prettyJsonBytes(manifest),
        0o444,
      )
    }
    for (const relativePath of [
      'node_modules/@types/react/index.d.ts',
      'node_modules/@types/prop-types/index.d.ts',
      'node_modules/csstype/index.d.ts',
    ]) {
      await writeExclusiveFile(
        resolve(workspaceRoot, relativePath),
        'export {}\n',
        0o444,
      )
    }
    const compilerSourceAggregateSha256 = await syntheticCompilerSourceAggregate(
      workspaceRoot,
      rootCompilerPackageLock,
    )

    const descriptor = baseFixture.publication.descriptor
    const selectedCacheIndexSha256 = descriptor.selectedCacheIndexSha256
    const selectedContentAggregateSha256 = descriptor.selectedContentAggregateSha256
    if (typeof selectedCacheIndexSha256 !== 'string'
      || typeof selectedContentAggregateSha256 !== 'string') {
      fail('verified synthetic publication is missing logical selected-cache hashes')
    }
    let proposalFsFault: ProposalFsFaultModule | undefined
    let fsPromisesModuleSpecifier: string | undefined
    if (options.enableProposalFsFaultSeam) {
      const proposalFsFaultPath = resolve(
        workspaceRoot,
        'scripts/proposal-fs-promises-fault.mjs',
      )
      await writeExclusiveFile(
        proposalFsFaultPath,
        proposalFsFaultSeamSource(),
        0o444,
      )
      fsPromisesModuleSpecifier = pathToFileURL(proposalFsFaultPath).href
      const imported: unknown = await import(fsPromisesModuleSpecifier)
      if (!isRecord(imported)
        || !isRecord(imported.proposalFsFaultEvidence)
        || typeof imported.armProposalLinkAfterSuccessAsEexist !== 'function'
        || typeof imported.armProposalIndependentPointerCopyAsEexist !== 'function'
        || typeof imported.armProposalBoundaryFailureAfterSuccessfulLink !== 'function'
        || typeof imported.armProposalLinkEioAndBoundaryFailureAfterSuccess !== 'function'
        || typeof imported.armProposalAliasUnlinkAsEnoent !== 'function') {
        fail('proposal fs fault seam has an invalid public surface')
      }
      proposalFsFault = imported as ProposalFsFaultModule
    }
    const patchedProductionSource = patchBootstrapProductionScript({
      source: productionSource.bytes.toString('utf8'),
      selectedContentBytes: synthetic.selectedContentBytes,
      packageLockRawSha256: syntheticPackageLockRawSha256,
      packageLockCanonicalSha256: baseFixture.packageLockCanonicalSha256,
      committedV1RawSha256: sha256(syntheticV1Bytes),
      selectedCacheIndexSha256,
      selectedContentAggregateSha256,
      compilerSourceAggregateSha256,
      verifierSourceSha256: options.trustVerifierTransform
        ? transformedVerifierSourceSha256
        : undefined,
      fakeNpmCliPath,
      publishSyntheticProposal: options.publishSyntheticProposal,
      fsPromisesModuleSpecifier,
    })
    const copiedProductionPath = resolve(
      workspaceRoot,
      PRODUCTION_SCRIPT_RELATIVE_PATH,
    )
    await rewriteOwnedReadOnlyFile(
      copiedProductionPath,
      Buffer.from(patchedProductionSource, 'utf8'),
    )

    const wrapperPath = resolve(
      workspaceRoot,
      'scripts/child-process-replay-seam.mjs',
    )
    await writeExclusiveFile(
      wrapperPath,
      replayChildProcessSeamSource(replayInstallPlan(synthetic.packageLock)),
      0o444,
    )
    const wrapperImported: unknown = await import(pathToFileURL(wrapperPath).href)
    if (!isRecord(wrapperImported)
      || !isRecord(wrapperImported.replayEvidence)
      || !Array.isArray(wrapperImported.replayEvidence.calls)
      || typeof wrapperImported.failNextReplay !== 'function'
      || typeof wrapperImported.failNextCompile !== 'function'
      || typeof wrapperImported.injectStorageOnNextCompile !== 'function'
      || typeof wrapperImported.replaceClientOverlayWithSameBytesOnNextCompile !== 'function'
      || typeof wrapperImported.replaceCommittedFileWithSameBytesAfterReplay !== 'function') {
      fail('synthetic child-process replay seam has an invalid public surface')
    }
    const replaySeam = wrapperImported as ReplaySeamModule

    const acceptanceUrl = pathToFileURL(copiedProductionPath)
    acceptanceUrl.searchParams.set('syntheticBootstrapOwner', randomUUID())
    const acceptanceImported: unknown = await import(acceptanceUrl.href)
    if (!isRecord(acceptanceImported)
      || typeof acceptanceImported.stageRc6DeclarationInputV2 !== 'function') {
      fail('bootstrap production copy does not export stageRc6DeclarationInputV2')
    }
    const acceptance = acceptanceImported as AcceptanceModule
    const pointerBundleRelativePath = baseFixture.publication.pointer.bundleRelativePath
    if (typeof pointerBundleRelativePath !== 'string') {
      fail('verified synthetic pointer is missing its bundle-relative path')
    }
    const selectedSourceBundleRoot = resolve(
      dirname(resolve(workspaceRoot, POINTER_RELATIVE_PATH)),
      pointerBundleRelativePath,
    )
    if (relative(workspaceRoot, selectedSourceBundleRoot).startsWith(`..${sep}`)) {
      fail('verified synthetic bundle path escapes the owner root')
    }

    const candidateRoot = resolve(workspaceRoot, CANDIDATE_RELATIVE_PATH)
    const candidateParent = dirname(candidateRoot)
    const candidateParentMode = (await lstat(candidateParent)).mode & 0o777
    const isolatedCandidateRoot = resolve(
      candidateParent,
      `.isolated-declaration-input-candidate-${randomUUID()}`,
    )
    await chmod(candidateParent, 0o755)
    await chmod(candidateRoot, 0o755)
    try {
      await rename(candidateRoot, isolatedCandidateRoot)
    } finally {
      await chmod(candidateParent, candidateParentMode)
    }
    await chmod(isolatedCandidateRoot, 0o555)
    const inputRoot = resolve(workspaceRoot, 'synthetic-inputs')
    const sourceCacheRoot = resolve(inputRoot, '_cacache')
    const isolatedSourceCacheRoot = resolve(
      inputRoot,
      `.isolated-source-cache-${randomUUID()}`,
    )
    await chmod(inputRoot, 0o755)
    await chmod(sourceCacheRoot, 0o755)
    try {
      await rename(sourceCacheRoot, isolatedSourceCacheRoot)
    } finally {
      await chmod(inputRoot, 0o555)
    }
    await chmod(isolatedSourceCacheRoot, 0o555)
    if (!await pathIsMissing(candidateRoot) || !await pathIsMissing(sourceCacheRoot)) {
      fail('bootstrap fixture did not isolate candidate and source cache before stage')
    }

    const fixture: Synthetic169BootstrapFixture = {
      workspaceRoot,
      selectedContentBytes: baseFixture.selectedContentBytes,
      fakeNpmCliPath,
      selectedSourceBundleRoot,
      historicalInputsIsolated: true,
      replayEvidence: replaySeam.replayEvidence,
      snapshotCommittedEvidence: () => snapshotCommittedFixtureEvidence(
        workspaceRoot,
        copiedCommittedPaths,
        selectedSourceBundleRoot,
      ),
      stageV2Proposal: () => acceptance.stageRc6DeclarationInputV2({
        workspaceRoot,
      }),
      failNextReplay: () => replaySeam.failNextReplay(),
      failNextCompile: () => replaySeam.failNextCompile(),
      injectStorageOnNextCompile: (surface, packageName, nestedPath) =>
        replaySeam.injectStorageOnNextCompile(surface, packageName, nestedPath),
      replaceClientOverlayWithSameBytesOnNextCompile: () =>
        replaySeam.replaceClientOverlayWithSameBytesOnNextCompile(),
      replaceCommittedFileWithSameBytesAfterReplay: (path) =>
        replaySeam.replaceCommittedFileWithSameBytesAfterReplay(path),
      mutateAcceptanceSourceAfterImport: async (transform) => {
        const current = await readStableRegularFile(copiedProductionPath)
        const transformed = transform(current.bytes.toString('utf8'))
        if (typeof transformed !== 'string'
          || transformed === current.bytes.toString('utf8')) {
          fail('acceptance source mutation must produce different source')
        }
        await rewriteOwnedReadOnlyFile(
          copiedProductionPath,
          Buffer.from(transformed, 'utf8'),
        )
      },
      ...(proposalFsFault
        ? {
            proposalFsFaultEvidence: proposalFsFault.proposalFsFaultEvidence,
            armProposalLinkAfterSuccessAsEexist: () =>
              proposalFsFault?.armProposalLinkAfterSuccessAsEexist(),
            armProposalIndependentPointerCopyAsEexist: () =>
              proposalFsFault?.armProposalIndependentPointerCopyAsEexist(),
            armProposalBoundaryFailureAfterSuccessfulLink: () =>
              proposalFsFault?.armProposalBoundaryFailureAfterSuccessfulLink(),
            armProposalLinkEioAndBoundaryFailureAfterSuccess: () =>
              proposalFsFault?.armProposalLinkEioAndBoundaryFailureAfterSuccess(),
            armProposalAliasUnlinkAsEnoent: () =>
              proposalFsFault?.armProposalAliasUnlinkAsEnoent(),
          }
        : {}),
    }
    return inspect(fixture)
  })
}

export async function withSynthetic169ConcurrentProductionPath<T>(
  repositoryRoot: string,
  inspect: (fixture: Synthetic169ProductionFixture) => T | Promise<T>,
): Promise<T> {
  return withSynthetic169ProductionMode(repositoryRoot, inspect, 'concurrent')
}

export async function withSynthetic169LinkFaultProductionPath<T>(
  repositoryRoot: string,
  faultMode: 'before-real-link',
  inspect: (fixture: Synthetic169BeforeLinkFaultFixture) => T | Promise<T>,
): Promise<T>
export async function withSynthetic169LinkFaultProductionPath<T>(
  repositoryRoot: string,
  faultMode: 'after-real-link',
  inspect: (fixture: Synthetic169AfterLinkFaultFixture) => T | Promise<T>,
): Promise<T>
export async function withSynthetic169LinkFaultProductionPath<T>(
  repositoryRoot: string,
  faultMode: LinkFaultMode,
  inspect: (fixture: any) => T | Promise<T>,
): Promise<T> {
  if (typeof inspect !== 'function') fail('an assertion callback is required')
  const approvedPaths = [
    resolve(repositoryRoot, PACKAGE_JSON_RELATIVE_PATH),
    resolve(repositoryRoot, PACKAGE_LOCK_RELATIVE_PATH),
    resolve(repositoryRoot, PRODUCTION_SCRIPT_RELATIVE_PATH),
  ]
  const approvedSources = await Promise.all(approvedPaths.map(readStableRegularFile))
  const [packageJsonSource, packageLockSource, productionScriptSource] = approvedSources
  const owner = await createOwnedTemporaryRoot()

  let callbackValue!: T
  let primaryError: unknown
  let failed = false
  try {
    const fixture = await setupAndRun(
      owner,
      repositoryRoot,
      packageJsonSource,
      packageLockSource,
      productionScriptSource,
      'single',
      faultMode,
    )
    callbackValue = await inspect(fixture)
  } catch (error) {
    failed = true
    primaryError = error
  }

  const teardownErrors: unknown[] = []
  try {
    await cleanupOwnedTemporaryRoot(owner)
  } catch (error) {
    teardownErrors.push(error)
  }
  try {
    await assertApprovedSourcesUnchanged(approvedSources)
  } catch (error) {
    teardownErrors.push(error)
  }

  if (failed && teardownErrors.length > 0) {
    throw new AggregateError(
      [primaryError, ...teardownErrors],
      'synthetic link-fault assertion and teardown both failed',
    )
  }
  if (failed) throw primaryError
  if (teardownErrors.length > 0) {
    throw new AggregateError(teardownErrors, 'synthetic link-fault teardown failed')
  }
  return callbackValue
}
