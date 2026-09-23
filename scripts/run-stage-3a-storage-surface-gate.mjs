// Test-only runner. Safety machinery derived from the committed Stage 2 runner.
import { spawn as nodeSpawn, execFile as nodeExecFile } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import {
  access,
  chmod,
  lstat,
  mkdir,
  mkdtemp,
  open,
  readFile,
  readdir,
  readlink,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

import { verifyStage3aStorageSurfaceResult, STORAGE_PACKAGE_FILES } from './verify-stage-3a-storage-surface-result.mjs'

export const STAGE3A_PHASES = Object.freeze(['write-small', 'read-small', 'write-tombstone', 'read-tombstone', 'write-near-limit', 'read-near-limit', 'reject-over-limit'])

const PLUGIN_NAME = '@knight/dsh-pm-workbench-storage-gate'
const PLUGIN_VERSION = '0.0.0-stage3a'
const HARNESS_TARGET = '0.1.0-rc.6'
const FORBIDDEN_PORT = 3080
const LSOF_ENTRY = '/usr/sbin/lsof'
const OWNER_MARKER = '.dsh-stage-3a-storage-surface-owner.json'
const DISABLE_PATCH_BYTES = '- id: dsh-pm-workbench-storage-gate\n  disabled: true\n'
const PACKAGE_PATCH_BYTES = "- insert:\n    - id: dsh-pm-workbench-storage-gate\n      name: '@knight/dsh-pm-workbench-storage-gate'\n"
const HASH_PATTERN = /^[0-9a-f]{64}$/
const RUN_PREFIX = 'dsh-pm-workbench-stage3a-'
const MAX_CAPTURE_BYTES = 1024 * 1024
const MAX_FILE_BYTES = 1024 * 1024 * 1024
const MAX_TREE_ENTRIES = 200_000
const COMMAND_TIMEOUT_MS = 60_000
const START_TIMEOUT_MS = 30_000
const CDP_TIMEOUT_MS = 10_000
const QUIET_PERIOD_MS = 750
const ONBOARDING_POLL_MS = 50
const MAX_ACTIVE_MODAL_NODES = 8
const MAX_ACTIVE_BUTTON_NODES = 512
const RC6_ONBOARDING_DIALOGS = Object.freeze([
  Object.freeze({ dialogName: '内测声明', actionName: '继续' }),
  Object.freeze({ dialogName: '添加一个 API Key 开始使用', actionName: '稍后配置' }),
])
const PLUGIN_MARKERS = Object.freeze({
  ...Object.fromEntries([...STAGE3A_PHASES, 'status'].map(marker => [marker, `[data-dsh-pm-storage-gate="${marker}"]`])),
  launcher: '[data-dsh-pm-storage-gate="write-small"]',
  overlay: '[data-dsh-pm-storage-gate="status"][role="dialog"]',
})
const OUTCOMES = new Set(['PASS', 'FAIL', 'INCONCLUSIVE', 'NEEDS_NETWORK_PERMISSION', 'SAFETY_ABORT'])
const ERROR_PRECEDENCE = Object.freeze({ ordinary: 0, external: 1, networkControl: 2, closure: 3 })
const ERROR_CATEGORY_BY_CODE = new Map([
  ['STAGE3A_EXTERNAL_NETWORK_ATTEMPT', 'external'],
  ['STAGE3A_NETWORK_CONTROL_FAILED', 'networkControl'],
  ['STAGE3A_BROWSER_CLEANUP_FAILED', 'closure'],
  ['STAGE3A_CLEANUP_FAILED', 'closure'],
  ['STAGE3A_RUNTIME_STOP_FAILED', 'closure'],
])

const execFileAsync = promisify(nodeExecFile)

/** @param {number} milliseconds */
async function readinessDelay(milliseconds) {
  await delay(milliseconds)
}

export class Stage3aRunnerError extends Error {
  constructor(code, outcome = 'INCONCLUSIVE') {
    super(code)
    this.name = 'Stage3aRunnerError'
    this.stage3aCode = code
    this.stage3aOutcome = outcome
  }
}

function fail(code, outcome = 'INCONCLUSIVE') {
  throw new Stage3aRunnerError(code, outcome)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value !== 'object') fail('STAGE3A_CANONICAL_VALUE_INVALID', 'SAFETY_ABORT')
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}

function safeCode(error) {
  return typeof error?.stage3aCode === 'string' && /^STAGE3A_[A-Z0-9_]+$/.test(error.stage3aCode)
    ? error.stage3aCode
    : 'STAGE3A_INTERNAL_FAILURE'
}

function safeOutcome(error) {
  return OUTCOMES.has(error?.stage3aOutcome) ? error.stage3aOutcome : 'INCONCLUSIVE'
}

export function preferStage3aError(currentError, candidateError) {
  if (currentError === undefined) return candidateError
  if (candidateError === undefined) return currentError
  const currentCategory = ERROR_CATEGORY_BY_CODE.get(safeCode(currentError)) ?? 'ordinary'
  const candidateCategory = ERROR_CATEGORY_BY_CODE.get(safeCode(candidateError)) ?? 'ordinary'
  return ERROR_PRECEDENCE[candidateCategory] > ERROR_PRECEDENCE[currentCategory]
    ? candidateError
    : currentError
}

function assertAbsolute(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0') || path.normalize(value) !== value || /[\r\n]/u.test(value)) {
    fail('STAGE3A_INPUT_INVALID', 'SAFETY_ABORT')
  }
  return path.normalize(value)
}

export function parseStage3aArgs(argv, { processExecPath = process.execPath } = {}) {
  const flags = ['--node', '--dsh-cli', '--npm-cli', '--pnpm-node', '--pnpm-cli', '--chrome']
  if (!Array.isArray(argv) || argv.length !== flags.length * 2) fail('STAGE3A_INPUT_INVALID', 'SAFETY_ABORT')
  const values = {}
  for (let index = 0; index < flags.length; index += 1) {
    if (argv[index * 2] !== flags[index]) fail('STAGE3A_INPUT_INVALID', 'SAFETY_ABORT')
    values[flags[index].slice(2)] = assertAbsolute(argv[index * 2 + 1])
  }
  if (values.node !== path.normalize(processExecPath)) fail('STAGE3A_NODE_MISMATCH', 'SAFETY_ABORT')
  return Object.freeze({
    node: values.node,
    dshCli: values['dsh-cli'],
    npmCli: values['npm-cli'],
    pnpmNode: values['pnpm-node'],
    pnpmCli: values['pnpm-cli'],
    chrome: values.chrome,
  })
}

export function buildPluginInvocation(action, tgzAbsolutePath) {
  if (action === 'add') {
    return ['plugin', '--profile', 'web', 'add', assertAbsolute(tgzAbsolutePath), '--offline']
  }
  if (action === 'remove') {
    if (tgzAbsolutePath !== undefined) fail('STAGE3A_COMMAND_INVALID', 'SAFETY_ABORT')
    return ['plugin', '--profile', 'web', 'remove', PLUGIN_NAME]
  }
  fail('STAGE3A_COMMAND_INVALID', 'SAFETY_ABORT')
}

export function buildHarnessInvocation(disablePatchPath) {
  return [
    'web',
    ...(disablePatchPath === undefined ? [] : ['--patch', assertAbsolute(disablePatchPath)]),
    '--host',
    '127.0.0.1',
    '--port',
    '0',
  ]
}

function shellQuote(value) {
  assertAbsolute(value)
  return `'${value.replaceAll("'", `'\"'\"'`)}'`
}

export function renderPnpmShim(pnpmNode, pnpmCli) {
  return `#!/bin/sh\nexec ${shellQuote(pnpmNode)} ${shellQuote(pnpmCli)} \"$@\"\n`
}

export function createIsolatedChildEnvironment(paths) {
  const required = [
    'home', 'dshHome', 'temp', 'xdgConfig', 'xdgCache', 'xdgData', 'xdgState',
    'npmCache', 'npmUserConfig', 'npmGlobalConfig', 'pnpmHome', 'pnpmStore',
    'pnpmCache', 'pnpmState', 'shimDirectory',
  ]
  for (const key of required) assertAbsolute(paths[key])
  return Object.freeze({
    HOME: paths.home,
    DSH_HOME: paths.dshHome,
    TMPDIR: paths.temp,
    XDG_CONFIG_HOME: paths.xdgConfig,
    XDG_CACHE_HOME: paths.xdgCache,
    XDG_DATA_HOME: paths.xdgData,
    XDG_STATE_HOME: paths.xdgState,
    NPM_CONFIG_CACHE: paths.npmCache,
    NPM_CONFIG_USERCONFIG: paths.npmUserConfig,
    NPM_CONFIG_GLOBALCONFIG: paths.npmGlobalConfig,
    NPM_CONFIG_AUDIT: 'false',
    NPM_CONFIG_FUND: 'false',
    NPM_CONFIG_UPDATE_NOTIFIER: 'false',
    npm_config_offline: 'true',
    PNPM_HOME: paths.pnpmHome,
    npm_config_store_dir: paths.pnpmStore,
    npm_config_cache_dir: paths.pnpmCache,
    npm_config_state_dir: paths.pnpmState,
    PATH: paths.shimDirectory,
    LANG: 'C',
    LC_ALL: 'C',
    NO_COLOR: '1',
  })
}

export function createRuntimeChildEnvironment(paths) {
  const pluginEnvironment = createIsolatedChildEnvironment(paths)
  return Object.freeze(Object.fromEntries(
    Object.entries(pluginEnvironment).filter(([key]) => ![
      'PATH',
      'PNPM_HOME',
      'npm_config_store_dir',
      'npm_config_cache_dir',
      'npm_config_state_dir',
    ].includes(key)),
  ))
}

export function parseDevToolsActivePort(bytes) {
  const buffer = Buffer.from(bytes)
  if (buffer.byteLength === 0 || buffer.byteLength > 512) fail('STAGE3A_DEVTOOLS_FILE_INVALID', 'SAFETY_ABORT')
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  const match = /^(?<port>[1-9][0-9]{0,4})\n(?<browserPath>\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\n?$/u.exec(text)
  if (!match?.groups) fail('STAGE3A_DEVTOOLS_FILE_INVALID', 'SAFETY_ABORT')
  const port = Number(match.groups.port)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) fail('STAGE3A_DEVTOOLS_FILE_INVALID', 'SAFETY_ABORT')
  if (port === FORBIDDEN_PORT) fail('STAGE3A_FORBIDDEN_PORT', 'SAFETY_ABORT')
  return Object.freeze({
    port,
    browserPath: match.groups.browserPath,
    webSocketUrl: `ws://127.0.0.1:${port}${match.groups.browserPath}`,
  })
}

export function parseLsofListenerWitness(stdout, { pid, port }) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isInteger(port) || port <= 0 || port > 65_535) {
    fail('STAGE3A_LISTENER_MISMATCH', 'SAFETY_ABORT')
  }
  const lines = String(stdout).split(/\r?\n/u).filter(Boolean)
  const pids = lines.filter((line) => line.startsWith('p')).map((line) => Number(line.slice(1)))
  const names = lines.filter((line) => line.startsWith('n')).map((line) => line.slice(1))
  if (pids.length !== 1 || pids[0] !== pid || names.length !== 1 || names[0] !== `127.0.0.1:${port}`) {
    fail('STAGE3A_LISTENER_MISMATCH', 'SAFETY_ABORT')
  }
  return Object.freeze({ pid, host: '127.0.0.1', port })
}

export function buildChromeArgv(userDataDir) {
  const ownedProfile = assertAbsolute(userDataDir)
  return Object.freeze([
    '--headless=new',
    `--user-data-dir=${ownedProfile}`,
    '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--use-mock-keychain',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-domain-reliability',
    '--disable-sync',
    '--disable-default-apps',
    '--disable-extensions',
    '--disable-breakpad',
    '--disable-crash-reporter',
    '--disable-quic',
    '--dns-prefetch-disable',
    '--metrics-recording-only',
    '--mute-audio',
    '--no-proxy-server',
    '--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1',
    '--force-webrtc-ip-handling-policy=disable_non_proxied_udp',
    'about:blank',
  ])
}

export async function cleanupOwnedRunRoot(owned, deps) {
  const runRoot = assertAbsolute(owned.runRoot)
  const tombstoneRoot = assertAbsolute(owned.tombstoneRoot)
  if (runRoot === tombstoneRoot || path.dirname(runRoot) !== path.dirname(tombstoneRoot)) {
    fail('STAGE3A_CLEANUP_BOUNDARY_INVALID', 'SAFETY_ABORT')
  }
  await deps.revalidate(runRoot, owned.marker)
  await deps.rename(runRoot, tombstoneRoot)
  await deps.revalidate(tombstoneRoot, owned.marker)
  await deps.remove(tombstoneRoot)
  await deps.assertAbsent(tombstoneRoot)
  return Object.freeze({ renamed: true, revalidated: true, removed: true })
}

function emptyResult() {
  return {
    schemaVersion: 1, outcome: 'INCONCLUSIVE', harnessVersion: HARNESS_TARGET,
    packageName: PLUGIN_NAME, packageVersion: PLUGIN_VERSION, packageFiles: [...STORAGE_PACKAGE_FILES],
    packageSha256: null, hostMetafileSha256: null, clientMetafileSha256: null,
    smallBytes: null, smallHashBeforeRestart: null, smallHashAfterRestart: null,
    tombstoneUpdated: false, tombstoneHiddenAfterRestart: false,
    nearLimitBytes: null, nearLimitHashBeforeRestart: null, nearLimitHashAfterRestart: null,
    overLimitBytes: null, overLimitRejected: false, overLimitBackendCalls: null,
    phaseCount: 0, restartCount: 0, freshBrowserProfiles: 0, spawnWitnessCount: 0, listenerWitnessCount: 0,
    externalAttempts: 0, port3080Touched: false, allLoopback: true,
    childCountAfterCleanup: null, listenerCountAfterCleanup: null, runRootExistsAfterCleanup: null,
    cleanupRenamed: false, cleanupRevalidated: false, cleanupRemoved: false, failure: null,
  }
}

export async function executeStorageGate({ inputs, adapters }) {
  const result = emptyResult()
  let run
  let stopped = true
  try {
    await adapters.executable.verify(inputs)
    run = await adapters.workspace.create({ inputs })
    const frozen = await adapters.package.freeze({ inputs, run })
    if (frozen.name !== PLUGIN_NAME || frozen.version !== PLUGIN_VERSION
      || JSON.stringify(frozen.packageFiles) !== JSON.stringify(STORAGE_PACKAGE_FILES)
      || ![frozen.sha256, frozen.hostMetafileSha256, frozen.clientMetafileSha256].every(h => HASH_PATTERN.test(h ?? '')))
      fail('STAGE3A_PACKAGE_IDENTITY_INVALID', 'SAFETY_ABORT')
    Object.assign(result, { packageSha256: frozen.sha256, hostMetafileSha256: frozen.hostMetafileSha256, clientMetafileSha256: frozen.clientMetafileSha256 })
    await adapters.profile.add({ inputs, run, tgzAbsolutePath: frozen.tgzAbsolutePath, sha256: frozen.sha256 })
    await adapters.profile.witness({ state: 'installed', inputs, run, sha256: frozen.sha256 })
    for (const phase of STAGE3A_PHASES) {
      let runtime
      try {
        await adapters.executable.verify(inputs)
        runtime = await adapters.runtime.start({ phase, inputs, run })
        stopped = false
        if (runtime.port === FORBIDDEN_PORT) fail('STAGE3A_FORBIDDEN_PORT', 'SAFETY_ABORT')
        if (!Number.isInteger(runtime.port) || runtime.port < 1 || runtime.port > 65535 || runtime.loopback !== true
          || runtime.origin !== `http://127.0.0.1:${runtime.port}`
          || !HASH_PATTERN.test(runtime.spawnReceiptSha256 ?? '') || !HASH_PATTERN.test(runtime.listenerWitnessSha256 ?? '')) fail('STAGE3A_RUNTIME_WITNESS_INVALID', 'SAFETY_ABORT')
        const networkState = { externalAttempts: 0, controlFailed: false }
        let observation
        try { observation = await adapters.browser.observePhase({ phase, chrome: inputs.chrome, origin: runtime.origin, profilePath: run.browserProfile(phase), run, networkState }) }
        finally {
          result.externalAttempts += networkState.externalAttempts
          if (networkState.externalAttempts !== 0 || networkState.controlFailed) fail('STAGE3A_NETWORK_BOUNDARY', 'SAFETY_ABORT')
        }
        if (!observation || observation.ok !== true || observation.externalNetworkAttempts !== 0
          || !HASH_PATTERN.test(observation.hash ?? '') || !Number.isSafeInteger(observation.bytes) || observation.bytes <= 0
          || !HASH_PATTERN.test(observation.chromeSpawnReceiptSha256 ?? '') || !HASH_PATTERN.test(observation.chromeListenerWitnessSha256 ?? '')) fail('STAGE3A_OBSERVATION_MISMATCH', 'FAIL')
        if (phase === 'write-small') { if (observation.bytes !== 512) fail('STAGE3A_SMALL_SIZE_MISMATCH', 'FAIL'); result.smallBytes = observation.bytes; result.smallHashBeforeRestart = observation.hash }
        if (phase === 'read-small') { if (observation.bytes !== result.smallBytes || observation.hash !== result.smallHashBeforeRestart) fail('STAGE3A_SMALL_RESTART_MISMATCH', 'FAIL'); result.smallHashAfterRestart = observation.hash }
        if (phase === 'write-tombstone') { if (observation.hidden !== true) fail('STAGE3A_TOMBSTONE_UPDATE_MISMATCH', 'FAIL'); result.tombstoneUpdated = true }
        if (phase === 'read-tombstone') { if (observation.hidden !== true) fail('STAGE3A_TOMBSTONE_RESTART_MISMATCH', 'FAIL'); result.tombstoneHiddenAfterRestart = true }
        if (phase === 'write-near-limit') { if (observation.bytes !== 4194304) fail('STAGE3A_NEAR_SIZE_MISMATCH', 'FAIL'); result.nearLimitBytes = observation.bytes; result.nearLimitHashBeforeRestart = observation.hash }
        if (phase === 'read-near-limit') { if (observation.bytes !== result.nearLimitBytes || observation.hash !== result.nearLimitHashBeforeRestart) fail('STAGE3A_NEAR_RESTART_MISMATCH', 'FAIL'); result.nearLimitHashAfterRestart = observation.hash }
        if (phase === 'reject-over-limit') { if (observation.bytes !== 4194305 || observation.backendCalls !== 0) fail('STAGE3A_QUOTA_BACKEND_INVOKED', 'FAIL'); result.overLimitBytes = observation.bytes; result.overLimitRejected = true; result.overLimitBackendCalls = observation.backendCalls }
        await runtime.stop(); stopped = true
        result.phaseCount++; result.freshBrowserProfiles++; result.spawnWitnessCount += 2; result.listenerWitnessCount += 2
        result.restartCount = result.phaseCount - 1
      } finally { if (runtime && !stopped) { await runtime.stop(); stopped = true } }
    }
    result.outcome = 'PASS'
  } catch (error) { result.outcome = safeOutcome(error); result.failure = safeCode(error) }
  finally {
    if (run && stopped) {
      try {
        const cleanup = await adapters.workspace.cleanup(run)
        Object.assign(result, {
          cleanupRenamed: cleanup.renamed, cleanupRevalidated: cleanup.revalidated, cleanupRemoved: cleanup.removed,
          listenerCountAfterCleanup: cleanup.listenerCountAfterCleanup, childCountAfterCleanup: cleanup.childCountAfterCleanup,
          runRootExistsAfterCleanup: cleanup.runRootExistsAfterCleanup,
        })
      } catch { result.outcome = 'SAFETY_ABORT'; result.failure = 'STAGE3A_CLEANUP_FAILED' }
    } else if (run) { result.outcome = 'SAFETY_ABORT'; result.failure = 'STAGE3A_CHILD_LEAK' }
  }
  if (result.outcome === 'PASS') {
    try { (adapters.verifier ?? verifyStage3aStorageSurfaceResult)(result) }
    catch { result.outcome = 'SAFETY_ABORT'; result.failure = 'STAGE3A_VERIFIER_REJECTED' }
  }
  return result
}

function timeoutError(code, outcome = 'INCONCLUSIVE') {
  return new Stage3aRunnerError(code, outcome)
}

async function withTimeout(promise, milliseconds, code, outcome = 'INCONCLUSIVE') {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => { reject(timeoutError(code, outcome)) }, milliseconds)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

function statReceipt(stats) {
  return Object.freeze({
    dev: String(stats.dev),
    ino: String(stats.ino),
    mode: String(stats.mode),
    nlink: String(stats.nlink),
    size: String(stats.size),
    mtimeNs: String(stats.mtimeNs),
    ctimeNs: String(stats.ctimeNs),
  })
}

function directoryReceipt(stats) {
  return Object.freeze({
    dev: String(stats.dev),
    ino: String(stats.ino),
    mode: String(BigInt(stats.mode) & 0o7777n),
    uid: String(stats.uid),
    gid: String(stats.gid),
  })
}

function sameReceipt(left, right) {
  return canonical(left) === canonical(right)
}

async function readStableFile(file, {
  maxBytes = MAX_FILE_BYTES,
  includeBytes = false,
  executable = false,
  code = 'STAGE3A_INPUT_IDENTITY_INVALID',
  fs = { lstat, realpath, open },
} = {}) {
  const absolute = assertAbsolute(file)
  const lexical = await fs.lstat(absolute, { bigint: true }).catch(() => fail(code, 'SAFETY_ABORT'))
  if (!lexical.isFile() || lexical.isSymbolicLink()) fail(code, 'SAFETY_ABORT')
  const physical = await fs.realpath(absolute).catch(() => fail(code, 'SAFETY_ABORT'))
  if (physical !== absolute) fail(code, 'SAFETY_ABORT')
  if (lexical.size < 0n || lexical.size > BigInt(maxBytes)) fail(code, 'SAFETY_ABORT')
  if (executable && (Number(lexical.mode) & 0o111) === 0) fail(code, 'SAFETY_ABORT')

  const handle = await fs.open(absolute, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0))
  try {
    const before = await handle.stat({ bigint: true })
    if (!before.isFile() || before.size > BigInt(maxBytes)) fail(code, 'SAFETY_ABORT')
    const digest = createHash('sha256')
    const chunks = []
    const buffer = Buffer.allocUnsafe(1024 * 1024)
    let position = 0
    while (position < Number(before.size)) {
      const length = Math.min(buffer.byteLength, Number(before.size) - position)
      const { bytesRead } = await handle.read(buffer, 0, length, position)
      if (bytesRead <= 0) fail(code, 'SAFETY_ABORT')
      const chunk = buffer.subarray(0, bytesRead)
      digest.update(chunk)
      if (includeBytes) chunks.push(Buffer.from(chunk))
      position += bytesRead
    }
    const after = await handle.stat({ bigint: true })
    const beforeReceipt = statReceipt(before)
    if (!sameReceipt(beforeReceipt, statReceipt(after)) || position !== Number(before.size)) {
      fail(code, 'SAFETY_ABORT')
    }
    return Object.freeze({
      path: absolute,
      identity: beforeReceipt,
      sha256: digest.digest('hex'),
      ...(includeBytes ? { bytes: Buffer.concat(chunks) } : {}),
    })
  } finally {
    await handle.close()
  }
}

async function readStableJson(file, code = 'STAGE3A_MANIFEST_INVALID') {
  const read = await readStableFile(file, { maxBytes: MAX_CAPTURE_BYTES, includeBytes: true, code })
  let value
  try {
    value = JSON.parse(read.bytes.toString('utf8'))
  } catch {
    fail(code, 'SAFETY_ABORT')
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(code, 'SAFETY_ABORT')
  return Object.freeze({ ...read, value })
}

async function assertSameFileIdentity(expected, options) {
  const observed = await readStableFile(expected.path, options)
  if (observed.sha256 !== expected.sha256 || !sameReceipt(observed.identity, expected.identity)) {
    fail('STAGE3A_INPUT_IDENTITY_DRIFT', 'SAFETY_ABORT')
  }
  return observed
}

function declaredBin(manifest, name) {
  if (typeof manifest.bin === 'string') return manifest.bin
  if (manifest.bin && typeof manifest.bin === 'object' && typeof manifest.bin[name] === 'string') {
    return manifest.bin[name]
  }
  return undefined
}

async function verifyPackageEntry(entry, { name, version, binName }) {
  const root = path.dirname(path.dirname(entry))
  const manifestPath = path.join(root, 'package.json')
  const manifest = await readStableJson(manifestPath)
  const relativeEntry = path.relative(root, entry).split(path.sep).join('/')
  if (
    manifest.value.name !== name
    || (version !== undefined && manifest.value.version !== version)
    || declaredBin(manifest.value, binName) !== relativeEntry
  ) fail('STAGE3A_TOOL_PACKAGE_INVALID', 'SAFETY_ABORT')
  return Object.freeze({ root, manifest })
}

async function boundedExec(file, args, options = {}) {
  try {
    const result = await execFileAsync(file, args, {
      shell: false,
      encoding: 'utf8',
      maxBuffer: MAX_CAPTURE_BYTES,
      timeout: COMMAND_TIMEOUT_MS,
      env: Object.freeze({ LANG: 'C', LC_ALL: 'C', NO_COLOR: '1' }),
      ...options,
    })
    if (Buffer.byteLength(result.stdout ?? '') > MAX_CAPTURE_BYTES || Buffer.byteLength(result.stderr ?? '') > MAX_CAPTURE_BYTES) {
      fail('STAGE3A_TOOL_OUTPUT_TOO_LARGE', 'SAFETY_ABORT')
    }
    return result
  } catch (error) {
    if (error instanceof Stage3aRunnerError) throw error
    fail('STAGE3A_TOOL_EXECUTION_INVALID', 'SAFETY_ABORT')
  }
}

/** @param {string} file @param {{ fs?: any, expected?: any }} [options] */
export async function verifyToolFile(file, { fs, expected } = {}) {
  assertAbsolute(file)
  const stable = await readStableFile(file, { executable: true, ...(fs === undefined ? {} : { fs }) })
  const receipt = { ...stable.identity, sha256: stable.sha256 }
  if (expected && canonical(receipt) !== canonical(expected)) fail('STAGE3A_INPUT_IDENTITY_DRIFT', 'SAFETY_ABORT')
  return Object.freeze(receipt)
}

/** @param {any} inputs @param {{ processExecPath?: string, exec?: any }} [options] */
export async function validateProductionInputs(inputs, { processExecPath = process.execPath, exec = boundedExec } = {}) {
  const keys = ['node','dshCli','npmCli','pnpmNode','pnpmCli','chrome']
  if (!inputs || Object.keys(inputs).sort().join(',') !== [...keys].sort().join(',') || inputs.node !== processExecPath) fail('STAGE3A_INPUT_INVALID', 'SAFETY_ABORT')
  const receipts = {}
  for (const key of keys) receipts[key] = await verifyToolFile(inputs[key])
  receipts.lsof = await verifyToolFile(LSOF_ENTRY)
  const packages = {
    dshCli: await verifyPackageEntry(inputs.dshCli, { name: '@deepseek-ai/dsh', version: HARNESS_TARGET, binName: 'dsh' }),
    npmCli: await verifyPackageEntry(inputs.npmCli, { name: 'npm', binName: 'npm' }),
    pnpmCli: await verifyPackageEntry(inputs.pnpmCli, { name: 'pnpm', binName: 'pnpm' }),
  }
  const versions = {}
  async function assertFiles(key) {
    const executable = key === 'lsof' ? LSOF_ENTRY : inputs[key]
    if (!executable) fail('STAGE3A_INPUT_INVALID', 'SAFETY_ABORT')
    await verifyToolFile(executable, { expected: receipts[key] })
    if (packages[key]) await assertSameFileIdentity(packages[key].manifest, { maxBytes: MAX_CAPTURE_BYTES, includeBytes: true })
  }
  async function version(key) {
    const nodeKey = key === 'pnpmCli' ? 'pnpmNode' : 'node'
    const packaged = packages[key] !== undefined
    if (packaged) await assertFiles(nodeKey)
    await assertFiles(key)
    const result = await exec(packaged ? inputs[nodeKey] : inputs[key], packaged ? [inputs[key], '--version'] : ['--version'])
    if (packaged) await assertFiles(nodeKey)
    await assertFiles(key)
    return result.stdout.trim()
  }
  for (const key of keys) {
    const value = await version(key)
    if ((key === 'node' && value !== process.version)
      || (key === 'pnpmNode' && !/^v[0-9]+\.[0-9]+\.[0-9]+$/.test(value))
      || (key === 'dshCli' && value !== HARNESS_TARGET)
      || (['npmCli','pnpmCli'].includes(key) && (value !== packages[key].manifest.value.version || !/^[0-9]+\.[0-9]+\.[0-9]+(?:[-+][0-9A-Za-z.-]+)?$/.test(value)))
      || (key === 'chrome' && !/^(?:Google Chrome|Chromium) [0-9]+(?:\.[0-9]+){1,3}$/.test(value))) fail('STAGE3A_TOOL_IDENTITY_INVALID', 'SAFETY_ABORT')
    versions[key] = value
  }
  return Object.freeze({ inputs, receipts, async assert(key) {
    await assertFiles(key)
    if (key !== 'lsof' && await version(key) !== versions[key]) fail('STAGE3A_TOOL_VERSION_DRIFT', 'SAFETY_ABORT')
    return receipts[key]
  } })
}

function pathInside(root, target) {
  const relative = path.relative(root, target)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function inventoryPathValid(value) {
  if (value === '.') return true
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) return false
  if (value.includes('\0') || path.normalize(value) !== value || /[\r\n]/u.test(value) || value.startsWith('/') || value.includes('\\')) return false
  const parts = value.split('/')
  return parts.every((part) => part !== '' && part !== '.' && part !== '..')
}

function inventoryInteger(value) {
  return typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/u.test(value)
}

export function validateTreeClosureInventory(inventory) {
  if (!Array.isArray(inventory) || inventory.length === 0 || inventory.length > MAX_TREE_ENTRIES) {
    fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
  }
  const paths = new Set()
  const hardlinks = new Map()
  let rootDevice = null
  let previousPath = null
  for (const entry of inventory) {
    if (!entry || typeof entry !== 'object' || !inventoryPathValid(entry.path)) {
      fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    }
    const keys = Object.keys(entry).sort()
    const expectedKeys = (entry.kind === 'symlink'
      ? ['dev', 'ino', 'kind', 'mode', 'nlink', 'path', 'size', 'target']
      : ['dev', 'ino', 'kind', 'mode', 'nlink', 'path', 'size']).sort()
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      if (entry.kind !== 'directory' && entry.kind !== 'file' && entry.kind !== 'symlink') {
        fail('STAGE3A_TREE_SPECIAL_FILE', 'SAFETY_ABORT')
      }
      fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    }
    if (entry.kind !== 'directory' && entry.kind !== 'file' && entry.kind !== 'symlink') {
      fail('STAGE3A_TREE_SPECIAL_FILE', 'SAFETY_ABORT')
    }
    for (const key of ['dev', 'ino', 'mode', 'nlink', 'size']) {
      if (!inventoryInteger(entry[key])) fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    }
    if (entry.kind === 'symlink' && (
      typeof entry.target !== 'string'
      || entry.target.length === 0
      || entry.target.length > 4096
      || entry.target.includes('\0')
      || /[\r\n]/u.test(entry.target)
    )) fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    if (paths.has(entry.path) || (previousPath !== null && entry.path.localeCompare(previousPath, 'en') <= 0)) {
      fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    }
    paths.add(entry.path)
    previousPath = entry.path
    if (entry.path === '.') rootDevice = entry.dev
    if (entry.kind === 'directory' && rootDevice !== null && entry.dev !== rootDevice) {
      fail('STAGE3A_TREE_CROSS_DEVICE', 'SAFETY_ABORT')
    }
    if (entry.kind === 'file') {
      const identity = `${entry.dev}:${entry.ino}`
      const group = hardlinks.get(identity) ?? { count: 0, nlink: entry.nlink }
      if (group.nlink !== entry.nlink) fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
      group.count += 1
      hardlinks.set(identity, group)
    }
  }
  if (inventory[0].path !== '.' || inventory[0].kind !== 'directory') {
    fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
  }
  for (const group of hardlinks.values()) {
    if (BigInt(group.count) !== BigInt(group.nlink)) fail('STAGE3A_TREE_HARDLINK_ESCAPE', 'SAFETY_ABORT')
  }
  return inventory
}

function treeEntry(relativePath, stats, kind, target) {
  return Object.freeze({
    path: relativePath,
    kind,
    dev: String(stats.dev),
    ino: String(stats.ino),
    mode: String(BigInt(stats.mode) & 0o7777n),
    nlink: String(stats.nlink),
    size: String(stats.size),
    ...(kind === 'symlink' ? { target } : {}),
  })
}

export async function inventoryOwnedTree(root) {
  const absoluteRoot = assertAbsolute(root)
  const inventory = []
  async function visit(absolute, relative) {
    if (inventory.length >= MAX_TREE_ENTRIES) fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    const stats = await lstat(absolute, { bigint: true }).catch(() => fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT'))
    if (stats.isSymbolicLink()) {
      const target = await readlink(absolute)
      inventory.push(treeEntry(relative, stats, 'symlink', target))
      return
    }
    if (stats.isFile()) {
      inventory.push(treeEntry(relative, stats, 'file'))
      return
    }
    if (!stats.isDirectory()) fail('STAGE3A_TREE_SPECIAL_FILE', 'SAFETY_ABORT')
    inventory.push(treeEntry(relative, stats, 'directory'))
    const names = await readdir(absolute)
    names.sort((left, right) => left.localeCompare(right, 'en'))
    for (const name of names) {
      if (name === '.' || name === '..' || name.includes('/') || name.includes('\0')) {
        fail('STAGE3A_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
      }
      const childRelative = relative === '.' ? name : `${relative}/${name}`
      await visit(path.join(absolute, name), childRelative)
    }
  }
  await visit(absoluteRoot, '.')
  inventory.sort((left, right) => left.path.localeCompare(right.path, 'en'))
  validateTreeClosureInventory(inventory)
  return Object.freeze(inventory)
}

export function assertSameTreeInventory(before, after) {
  validateTreeClosureInventory(before)
  validateTreeClosureInventory(after)
  if (canonical(before) !== canonical(after)) fail('STAGE3A_TREE_INVENTORY_DRIFT', 'SAFETY_ABORT')
  return true
}

function strictNoMatch(error) {
  return error?.code === 1
    && (error.stdout ?? '') === ''
    && (error.stderr ?? '') === ''
    && error.killed !== true
    && error.signal == null
    && error.timedOut !== true
}

export function isStrictLsofNoMatch(error) {
  return strictNoMatch(error)
}

/**
 * @param {string} runRoot
 * @param {{ assert: (key: string) => Promise<unknown> }} validated
 * @param {{ execFile?: (file: string, args: string[], options: object) => Promise<{ stdout?: string, stderr?: string }> }} [options]
 */
export async function proveNoOpenHandles(runRoot, validated, { execFile = execFileAsync } = {}) {
  const absolute = assertAbsolute(runRoot)
  await validated.assert('lsof')
  try {
    const result = await execFile(LSOF_ENTRY, ['-nP', '+D', absolute, '-Fpcfnt'], {
      shell: false,
      encoding: 'utf8',
      maxBuffer: MAX_CAPTURE_BYTES,
      timeout: COMMAND_TIMEOUT_MS,
      env: Object.freeze({ LANG: 'C', LC_ALL: 'C', NO_COLOR: '1' }),
    })
    if ((result?.stdout ?? '') !== '') fail('STAGE3A_OPEN_HANDLE_REMAINS', 'SAFETY_ABORT')
    fail('STAGE3A_OPEN_HANDLE_UNPROVED', 'SAFETY_ABORT')
  } catch (error) {
    if (error instanceof Stage3aRunnerError) throw error
    if (strictNoMatch(error)) return true
    fail('STAGE3A_OPEN_HANDLE_UNPROVED', 'SAFETY_ABORT')
  }
}

async function requireOwnedDirectory(directory, parent) {
  const stats = await lstat(directory, { bigint: true }).catch(() => fail('STAGE3A_OWNERSHIP_INVALID', 'SAFETY_ABORT'))
  if (!stats.isDirectory() || stats.isSymbolicLink() || !pathInside(parent, directory)) {
    fail('STAGE3A_OWNERSHIP_INVALID', 'SAFETY_ABORT')
  }
  const physical = await realpath(directory)
  if (physical !== directory) fail('STAGE3A_OWNERSHIP_INVALID', 'SAFETY_ABORT')
  return directoryReceipt(stats)
}

async function ensureAbsent(target, code = 'STAGE3A_OWNERSHIP_INVALID') {
  try {
    await lstat(target)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    fail(code, 'SAFETY_ABORT')
  }
  fail(code, 'SAFETY_ABORT')
}

async function listTreeFiles(root) {
  const found = []
  async function visit(directory, prefix = '') {
    const entries = await readdir(directory, { withFileTypes: true })
    entries.sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0)
    for (const entry of entries) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name
      const absolute = path.join(directory, entry.name)
      if (entry.isSymbolicLink()) fail('STAGE3A_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
      if (entry.isDirectory()) await visit(absolute, relative)
      else if (entry.isFile()) found.push(relative)
      else fail('STAGE3A_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
    }
  }
  await visit(root)
  return found
}

export async function createProductionWorkspace(validated) {
  const tempParent = await realpath(tmpdir())
  const parentStats = await lstat(tempParent, { bigint: true })
  if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) fail('STAGE3A_TEMP_ROOT_INVALID', 'SAFETY_ABORT')
  const parentReceipt = directoryReceipt(parentStats)
  const runRoot = await mkdtemp(path.join(tempParent, RUN_PREFIX))
  await chmod(runRoot, 0o700)
  const runId = randomUUID()
  const markerBytes = Buffer.from(JSON.stringify({ schemaVersion: 1, owner: PLUGIN_NAME, runId }))
  const markerPath = path.join(runRoot, OWNER_MARKER)
  let run
  try {
    await writeFile(markerPath, markerBytes, { flag: 'wx', mode: 0o600 })
    const rootReceipt = await requireOwnedDirectory(runRoot, tempParent)
    const markerReceipt = await readStableFile(markerPath, { maxBytes: 4096, includeBytes: true })
    if (!markerReceipt.bytes.equals(markerBytes)) fail('STAGE3A_OWNERSHIP_INVALID', 'SAFETY_ABORT')

    const directories = {
      home: path.join(runRoot, 'home'),
      dshHome: path.join(runRoot, 'dsh-home'),
      temp: path.join(runRoot, 'tmp'),
      xdgConfig: path.join(runRoot, 'xdg', 'config'),
      xdgCache: path.join(runRoot, 'xdg', 'cache'),
      xdgData: path.join(runRoot, 'xdg', 'data'),
      xdgState: path.join(runRoot, 'xdg', 'state'),
      npmCache: path.join(runRoot, 'npm', 'cache'),
      npmUserConfig: path.join(runRoot, 'npm', 'userconfig'),
      npmGlobalConfig: path.join(runRoot, 'npm', 'globalconfig'),
      pnpmHome: path.join(runRoot, 'pnpm', 'home'),
      pnpmStore: path.join(runRoot, 'pnpm', 'store'),
      pnpmCache: path.join(runRoot, 'pnpm', 'cache'),
      pnpmState: path.join(runRoot, 'pnpm', 'state'),
      shimDirectory: path.join(runRoot, 'bin'),
    }
    const directorySet = new Set(Object.values(directories).filter((entry) => !entry.endsWith('userconfig') && !entry.endsWith('globalconfig')))
    for (const directory of [...directorySet].sort((left, right) => left.length - right.length)) {
      await mkdir(directory, { recursive: true, mode: 0o700 })
      await requireOwnedDirectory(directory, runRoot)
    }
    await writeFile(directories.npmUserConfig, '', { flag: 'wx', mode: 0o600 })
    await writeFile(directories.npmGlobalConfig, '', { flag: 'wx', mode: 0o600 })

    const shimPath = path.join(directories.shimDirectory, 'pnpm')
    const shimBytes = renderPnpmShim(validated.inputs.pnpmNode, validated.inputs.pnpmCli)
    await writeFile(shimPath, shimBytes, { flag: 'wx', mode: 0o700 })
    await chmod(shimPath, 0o700)
    const shimReceipt = await readStableFile(shimPath, { maxBytes: 4096, includeBytes: true, executable: true })
    if (shimReceipt.bytes.toString('utf8') !== shimBytes) fail('STAGE3A_SHIM_INVALID', 'SAFETY_ABORT')

    const disablePatchPath = path.join(runRoot, 'disable.patch.yml')
    await writeFile(disablePatchPath, DISABLE_PATCH_BYTES, { flag: 'wx', mode: 0o600 })
    const packageSourceRoot = path.join(runRoot, 'package-source')
    const packRoot = path.join(runRoot, 'pack')
    const browserRoot = path.join(runRoot, 'browser')
    for (const directory of [packageSourceRoot, packRoot, browserRoot]) {
      await mkdir(directory, { mode: 0o700 })
      await requireOwnedDirectory(directory, runRoot)
    }
    const tombstoneRoot = path.join(tempParent, `.${path.basename(runRoot)}.cleanup-${randomUUID()}`)
    await ensureAbsent(tombstoneRoot)

    const pluginEnvironment = createIsolatedChildEnvironment(directories)
    const environment = createRuntimeChildEnvironment(directories)
    const activeChildren = new Set()
    run = {
      runId,
      runRoot,
      tombstoneRoot,
      tempParent,
      parentReceipt,
      rootReceipt,
      markerPath,
      markerBytes,
      markerReceipt,
      shimPath,
      shimBytes,
      shimReceipt,
      packageSourceRoot,
      packRoot,
      dshHome: directories.dshHome,
      disablePatchPath,
      browserRoot,
      environment,
      pluginEnvironment,
      activeChildren,
      validated,
      browserProfile(phase) {
        if (!STAGE3A_PHASES.includes(phase)) fail('STAGE3A_PHASE_INVALID', 'SAFETY_ABORT')
        return path.join(browserRoot, phase)
      },
      async assertOwned(candidate = runRoot) {
        const parentNow = directoryReceipt(await lstat(tempParent, { bigint: true }))
        if (!sameReceipt(parentNow, parentReceipt)) fail('STAGE3A_OWNERSHIP_DRIFT', 'SAFETY_ABORT')
        const rootNow = await requireOwnedDirectory(candidate, tempParent)
        if (!sameReceipt(rootNow, rootReceipt)) fail('STAGE3A_OWNERSHIP_DRIFT', 'SAFETY_ABORT')
        const markerNow = await readStableFile(path.join(candidate, OWNER_MARKER), { maxBytes: 4096, includeBytes: true })
        if (
          markerNow.sha256 !== markerReceipt.sha256
          || !sameReceipt(markerNow.identity, markerReceipt.identity)
          || !markerNow.bytes.equals(markerBytes)
        ) fail('STAGE3A_OWNERSHIP_DRIFT', 'SAFETY_ABORT')
      },
      async assertShim() {
        await run.assertOwned()
        const shimNow = await readStableFile(shimPath, { maxBytes: 4096, includeBytes: true, executable: true })
        if (
          shimNow.sha256 !== shimReceipt.sha256
          || !sameReceipt(shimNow.identity, shimReceipt.identity)
          || shimNow.bytes.toString('utf8') !== shimBytes
        ) fail('STAGE3A_SHIM_DRIFT', 'SAFETY_ABORT')
      },
      registerChild(receipt) {
        if (!receipt?.child || activeChildren.has(receipt)) fail('STAGE3A_PROCESS_REGISTRY_INVALID', 'SAFETY_ABORT')
        activeChildren.add(receipt)
      },
      markChildStopped(receipt) {
        if (
          !activeChildren.has(receipt)
          || (receipt.child.exitCode === null && receipt.child.signalCode === null)
        ) fail('STAGE3A_PROCESS_REGISTRY_INVALID', 'SAFETY_ABORT')
        activeChildren.delete(receipt)
      },
    }
    return run
  } catch (error) {
    try {
      if (run) {
        await cleanupProductionWorkspace(run)
      } else {
        const marker = await readFile(markerPath).catch(() => null)
        if (marker?.equals(markerBytes)) await rm(runRoot, { recursive: true, force: false })
      }
    } catch {
      throw new Stage3aRunnerError('STAGE3A_WORKSPACE_CREATE_CLEANUP_FAILED', 'SAFETY_ABORT')
    }
    throw error
  }
}

/** @param {any} run @param {{ execFile?: any, remove?: any }} [options] */
export async function cleanupProductionWorkspace(run, { execFile = execFileAsync, remove = rm } = {}) {
  if (!(run.activeChildren instanceof Set) || run.activeChildren.size !== 0) {
    fail('STAGE3A_LIVE_CHILD_UNCERTAIN', 'SAFETY_ABORT')
  }
  await run.assertOwned()
  const beforeInventory = await inventoryOwnedTree(run.runRoot)
  await proveNoOpenHandles(run.runRoot, run.validated, { execFile })
  await run.assertOwned()
  await ensureAbsent(run.tombstoneRoot)
  return cleanupOwnedRunRoot({
    runRoot: run.runRoot,
    tombstoneRoot: run.tombstoneRoot,
    marker: run.runId,
  }, {
    revalidate: async (candidate) => {
      await run.assertOwned(candidate)
      if (candidate === run.runRoot) {
        const currentInventory = await inventoryOwnedTree(candidate)
        assertSameTreeInventory(beforeInventory, currentInventory)
      } else if (candidate === run.tombstoneRoot) {
        await ensureAbsent(run.runRoot)
        const afterInventory = await inventoryOwnedTree(candidate)
        assertSameTreeInventory(beforeInventory, afterInventory)
      }
    },
    rename: async (from, to) => {
      await ensureAbsent(to)
      await rename(from, to)
      await ensureAbsent(from)
    },
    remove: async (candidate) => {
      await remove(candidate, { recursive: true, force: false, maxRetries: 0 })
    },
    assertAbsent: async (candidate) => {
      await ensureAbsent(candidate, 'STAGE3A_CLEANUP_ABSENCE_INVALID')
      await ensureAbsent(run.runRoot, 'STAGE3A_CLEANUP_ABSENCE_INVALID')
      const parentNow = directoryReceipt(await lstat(run.tempParent, { bigint: true }))
      if (!sameReceipt(parentNow, run.parentReceipt)) fail('STAGE3A_OWNERSHIP_DRIFT', 'SAFETY_ABORT')
    },
  })
}

export function validatePackageVerificationReceipt(verification, allowlist) {
  const outputHashKeys = ['lib/client.js', 'lib/index.js']
  if (
    verification?.name !== PLUGIN_NAME
    || verification.version !== PLUGIN_VERSION
    || verification.bundledZod !== true
    || verification.runtimeDependencies !== 0
    || !Array.isArray(verification.files)
    || verification.files.length !== allowlist.length
    || !isPlainObject(verification.outputHashes)
    || JSON.stringify(Object.keys(verification.outputHashes).sort()) !== JSON.stringify(outputHashKeys)
  ) fail('STAGE3A_PACKAGE_VERIFICATION_INVALID', 'SAFETY_ABORT')
  const receiptPaths = verification.files.map((file) => file?.path)
  if (JSON.stringify(receiptPaths) !== JSON.stringify(allowlist)) {
    fail('STAGE3A_PACKAGE_ALLOWLIST_INVALID', 'SAFETY_ABORT')
  }

  for (const outputPath of outputHashKeys) {
    const outputFile = verification.files.find((file) => file?.path === outputPath)
    if (
      !HASH_PATTERN.test(verification.outputHashes[outputPath] ?? '')
      || outputFile?.sha256 !== verification.outputHashes[outputPath]
    ) fail('STAGE3A_BUILD_OUTPUT_HASH_INVALID', 'SAFETY_ABORT')
  }

  for (const file of verification.files) {
    if (
      typeof file.path !== 'string'
      || path.posix.isAbsolute(file.path)
      || file.path.split('/').some((segment) => segment === '' || segment === '.' || segment === '..')
      || !Buffer.isBuffer(file.bytes)
      || !Number.isSafeInteger(file.size)
      || file.size !== file.bytes.byteLength
      || !Number.isSafeInteger(file.mode)
      || file.mode < 0
      || file.mode > 0o7777
      || !HASH_PATTERN.test(file.sha256)
      || sha256(file.bytes) !== file.sha256
    ) fail('STAGE3A_PACKAGE_RECEIPT_INVALID', 'SAFETY_ABORT')
  }

  const packageFile = verification.files.find((file) => file.path === 'package.json')
  let manifest
  try {
    manifest = JSON.parse(packageFile.bytes.toString('utf8'))
  } catch {
    fail('STAGE3A_PACKAGE_MANIFEST_INVALID', 'SAFETY_ABORT')
  }
  for (const lifecycle of ['prepublish', 'prepare', 'prepack', 'postpack']) {
    if (Object.hasOwn(manifest.scripts ?? {}, lifecycle)) fail('STAGE3A_PACKAGE_LIFECYCLE_FORBIDDEN', 'SAFETY_ABORT')
  }
  return verification
}

function permissionMode(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('STAGE3A_FILE_MODE_INVALID', 'SAFETY_ABORT')
  return value & 0o777
}

export function validatePackedMetadataAgainstVerification(metadata, verification) {
  if (!Array.isArray(metadata?.files) || !Array.isArray(verification?.files)) {
    fail('STAGE3A_PACK_METADATA_DRIFT', 'SAFETY_ABORT')
  }
  const expected = verification.files.map((file) => ({
    path: file?.path,
    size: file?.size,
    mode: permissionMode(file?.mode),
  }))
  const actual = metadata.files.map((file) => ({
    path: file?.path,
    size: file?.size,
    mode: permissionMode(file?.mode),
  }))
  if (canonical(actual) !== canonical(expected)) fail('STAGE3A_PACK_METADATA_DRIFT', 'SAFETY_ABORT')
  return metadata
}

export function validateObservedPackageFile(observed, expected, code = 'STAGE3A_PROFILE_WITNESS_INVALID') {
  const observedSize = Number(observed?.identity?.size)
  const observedMode = Number(observed?.identity?.mode)
  if (
    observed?.sha256 !== expected?.sha256
    || observedSize !== expected?.size
    || permissionMode(observedMode) !== permissionMode(expected?.mode)
  ) fail(code, 'SAFETY_ABORT')
  return observed
}

export async function stageVerifiedPackage(run, verification, allowlist) {
  validatePackageVerificationReceipt(verification, allowlist)
  for (const file of verification.files) {
    const destination = path.join(run.packageSourceRoot, ...file.path.split('/'))
    if (!pathInside(run.packageSourceRoot, destination)) fail('STAGE3A_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
    await writeFile(destination, file.bytes, { flag: 'wx', mode: file.mode & 0o777 })
    await chmod(destination, file.mode & 0o777)
    const staged = await readStableFile(destination, { maxBytes: 64 * 1024 * 1024, includeBytes: true })
    const stagedMode = Number(BigInt(staged.identity.mode) & 0o777n)
    if (staged.sha256 !== file.sha256 || staged.bytes.byteLength !== file.size || stagedMode !== (file.mode & 0o777)) {
      fail('STAGE3A_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
    }
  }
  const stagedPaths = await listTreeFiles(run.packageSourceRoot)
  if (JSON.stringify(stagedPaths) !== JSON.stringify(allowlist)) {
    fail('STAGE3A_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
  }
  return verification
}

async function revalidateStagedPackage(run, verification, allowlist) {
  const stagedPaths = await listTreeFiles(run.packageSourceRoot)
  if (JSON.stringify(stagedPaths) !== JSON.stringify(allowlist)) {
    fail('STAGE3A_PACKAGE_STAGE_DRIFT', 'SAFETY_ABORT')
  }
  for (const file of verification.files) {
    const staged = path.join(run.packageSourceRoot, ...file.path.split('/'))
    if (!pathInside(run.packageSourceRoot, staged)) fail('STAGE3A_PACKAGE_STAGE_DRIFT', 'SAFETY_ABORT')
    const observed = await readStableFile(staged, { maxBytes: 64 * 1024 * 1024 })
    validateObservedPackageFile(observed, file, 'STAGE3A_PACKAGE_STAGE_DRIFT')
  }
}

/** @param {any} options @param {{ exec?: any }} [ports] */
export async function freezeProductionPackage({ inputs, run, validated }, { exec = boundedExec } = {}) {
  await run.assertOwned()
  await assertPackToolProvenance(validated)
  const fixture = path.resolve(import.meta.dirname, '../tests/integration/fixtures/stage3a-storage-gate')
  await exec(inputs.node, [path.join(fixture, 'build.mjs'), run.runRoot], { cwd: fixture, env: run.environment })
  const buildReceipt = (await readStableJson(path.join(run.runRoot, 'build-receipt.json'))).value
  const { assertFixtureGraph, PACKAGE_FILES } = await import('../tests/integration/fixtures/stage3a-storage-gate/build.mjs')
  assertFixtureGraph(buildReceipt.hostMetafile, 'host'); assertFixtureGraph(buildReceipt.clientMetafile, 'client')
  if (buildReceipt.packageRoot !== path.join(run.runRoot, 'build')) fail('STAGE3A_BUILD_ROOT_INVALID', 'SAFETY_ABORT')
  if (JSON.stringify(await listTreeFiles(buildReceipt.packageRoot)) !== JSON.stringify(PACKAGE_FILES)) fail('STAGE3A_BUILD_INVENTORY_INVALID', 'SAFETY_ABORT')
  for (const file of buildReceipt.files) {
    if (!PACKAGE_FILES.includes(file.path)) fail('STAGE3A_BUILD_INVENTORY_INVALID', 'SAFETY_ABORT')
    const observed = await readStableFile(path.join(buildReceipt.packageRoot, file.path), { includeBytes: true })
    validateObservedPackageFile(observed, file)
    file.bytes = observed.bytes
  }
  await stageVerifiedPackage(run, buildReceipt, PACKAGE_FILES)
  run.frozenPackageReceipt = buildReceipt
  await revalidateStagedPackage(run, buildReceipt, PACKAGE_FILES)
  await assertPackToolProvenance(validated)
  const packed = await exec(inputs.node, [inputs.npmCli, 'pack', run.packageSourceRoot, '--json', '--ignore-scripts', '--offline', '--pack-destination', run.packRoot], { cwd: run.runRoot, env: run.pluginEnvironment })
  const entries = JSON.parse(packed.stdout)
  if (!Array.isArray(entries) || entries.length !== 1 || entries[0].name !== PLUGIN_NAME || entries[0].version !== PLUGIN_VERSION) fail('STAGE3A_PACK_IDENTITY_INVALID', 'SAFETY_ABORT')
  const metadata = entries[0]
  validatePackedMetadataAgainstVerification(metadata, buildReceipt)
  if (metadata.filename !== 'knight-dsh-pm-workbench-storage-gate-0.0.0-stage3a.tgz') fail('STAGE3A_PACK_FILENAME_INVALID', 'SAFETY_ABORT')
  const tgzAbsolutePath = path.join(run.packRoot, metadata.filename)
  const receipt = await readStableFile(tgzAbsolutePath)
  await revalidateStagedPackage(run, buildReceipt, PACKAGE_FILES)
  run.frozenTgz = Object.freeze({ name: PLUGIN_NAME, version: PLUGIN_VERSION, tgzAbsolutePath, sha256: receipt.sha256, receipt,
    packageFiles: [...STORAGE_PACKAGE_FILES], hostMetafileSha256: sha256(canonical(buildReceipt.hostMetafile)), clientMetafileSha256: sha256(canonical(buildReceipt.clientMetafile)) })
  return run.frozenTgz
}

export async function assertPackToolProvenance(validated) {
  await validated.assert('node')
  await validated.assert('npmCli')
  return true
}

function createCapture(child) {
  const state = { stdout: '', stderr: '', overflow: false, error: null }
  const append = (key, chunk) => {
    const text = Buffer.from(chunk).toString('utf8')
    const nextBytes = Buffer.byteLength(state[key]) + Buffer.byteLength(text)
    if (nextBytes > MAX_CAPTURE_BYTES) {
      state.overflow = true
      return
    }
    state[key] += text
  }
  child.stdout?.on('data', (chunk) => { append('stdout', chunk) })
  child.stderr?.on('data', (chunk) => { append('stderr', chunk) })
  child.once('error', (error) => { state.error = error })
  return state
}

export function createNodeCloseWitness(child) {
  if (!child || typeof child.once !== 'function') fail('STAGE3A_PROCESS_REGISTRY_INVALID', 'SAFETY_ABORT')
  let closed = false
  const promise = new Promise((resolve) => {
    child.once('close', (exitCode, signalCode) => {
      closed = true
      resolve(Object.freeze({ exitCode, signalCode }))
    })
  })
  return Object.freeze({
    child,
    promise,
    isClosed() { return closed },
  })
}

async function waitForChildExit(
  child,
  milliseconds,
  timeoutCode,
  closeWitness,
  timeoutOutcome = 'INCONCLUSIVE',
) {
  if (
    !closeWitness
    || closeWitness.child !== child
    || typeof closeWitness.isClosed !== 'function'
    || typeof closeWitness.promise?.then !== 'function'
  ) fail('STAGE3A_PROCESS_REGISTRY_INVALID', 'SAFETY_ABORT')
  await withTimeout(closeWitness.promise, milliseconds, timeoutCode, timeoutOutcome)
  if (
    closeWitness.isClosed() !== true
    || (child.exitCode === null && child.signalCode === null)
  ) fail('STAGE3A_PROCESS_REGISTRY_INVALID', 'SAFETY_ABORT')
}

async function waitForRetainedChildExit(child, milliseconds, timeoutCode) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await new Promise((resolve, reject) => {
    let timer
    const cleanup = () => {
      clearTimeout(timer)
      child.off('exit', exited)
      child.off('error', failed)
    }
    const exited = () => {
      cleanup()
      resolve()
    }
    const failed = () => {
      cleanup()
      reject(timeoutError('STAGE3A_CHILD_PROCESS_ERROR'))
    }
    timer = setTimeout(() => {
      cleanup()
      reject(timeoutError(timeoutCode))
    }, milliseconds)
    child.once('exit', exited)
    child.once('error', failed)
  })
}

async function lsofCwd(pid, expectedCwd, validated) {
  await validated.assert('lsof')
  const { stdout } = await boundedExec(LSOF_ENTRY, ['-nP', '-a', '-p', String(pid), '-d', 'cwd', '-Fpn'])
  const pids = stdout.split(/\r?\n/u).filter((line) => line.startsWith('p')).map((line) => Number(line.slice(1)))
  const names = stdout.split(/\r?\n/u).filter((line) => line.startsWith('n')).map((line) => line.slice(1))
  if (pids.length !== 1 || pids[0] !== pid || names.length !== 1 || names[0] !== expectedCwd) {
    fail('STAGE3A_PROCESS_CWD_MISMATCH', 'SAFETY_ABORT')
  }
  return Object.freeze({ pid, cwd: expectedCwd })
}

async function lsofListener(pid, port, validated) {
  await validated.assert('lsof')
  const { stdout } = await boundedExec(LSOF_ENTRY, [
    '-nP', '-a', '-p', String(pid), `-iTCP:${String(port)}`, '-sTCP:LISTEN', '-Fpn',
  ])
  return parseLsofListenerWitness(stdout, { pid, port })
}

/** @param {number} port @param {any} validated @param {{ execFile?: any }} [options] */
export async function assertListenerAbsent(port, validated, { execFile = execFileAsync } = {}) {
  await validated.assert('lsof')
  try {
    const { stdout } = await execFile(LSOF_ENTRY, [
      '-nP', `-iTCP:${String(port)}`, '-sTCP:LISTEN', '-Fpn',
    ], {
      shell: false,
      encoding: 'utf8',
      maxBuffer: MAX_CAPTURE_BYTES,
      timeout: COMMAND_TIMEOUT_MS,
      env: Object.freeze({ LANG: 'C', LC_ALL: 'C', NO_COLOR: '1' }),
    })
    if (stdout !== '') fail('STAGE3A_LISTENER_REMAINED', 'SAFETY_ABORT')
    fail('STAGE3A_LISTENER_ABSENCE_UNPROVED', 'SAFETY_ABORT')
  } catch (error) {
    if (error instanceof Stage3aRunnerError) throw error
    if (strictNoMatch(error)) return
    fail('STAGE3A_LISTENER_ABSENCE_UNPROVED', 'SAFETY_ABORT')
  }
}

export function makeSpawnReceipt({ kind, executable, argv, run, environment, child, closeWitness }) {
  if (!Number.isSafeInteger(child.pid) || child.pid <= 0) fail('STAGE3A_SPAWN_INVALID', 'SAFETY_ABORT')
  if (
    !closeWitness
    || closeWitness.child !== child
    || typeof closeWitness.isClosed !== 'function'
    || typeof closeWitness.promise?.then !== 'function'
  ) fail('STAGE3A_PROCESS_REGISTRY_INVALID', 'SAFETY_ABORT')
  const receipt = {
    kind,
    executable,
    argv: [...argv],
    cwd: run.runRoot,
    environmentSha256: sha256(canonical(environment)),
    marker: run.runId,
    pid: child.pid,
    child,
    closeWitness,
  }
  return Object.freeze({
    ...receipt,
    sha256: sha256(canonical({
      kind: receipt.kind,
      executable: receipt.executable,
      argv: receipt.argv,
      cwd: receipt.cwd,
      environmentSha256: receipt.environmentSha256,
      marker: receipt.marker,
      pid: receipt.pid,
    })),
  })
}

async function assertLiveChild(receipt, { run, validated, listenerPort }) {
  if (
    receipt.child.pid !== receipt.pid
    || receipt.child.exitCode !== null
    || receipt.child.signalCode !== null
  ) fail('STAGE3A_PROCESS_IDENTITY_MISMATCH', 'SAFETY_ABORT')
  await run.assertOwned()
  await lsofCwd(receipt.pid, run.runRoot, validated)
  if (listenerPort !== undefined) await lsofListener(receipt.pid, listenerPort, validated)
}

async function stopRetainedChild(receipt, {
  run,
  validated,
  listenerPort,
  waitForExit = waitForChildExit,
}) {
  await assertLiveChild(receipt, { run, validated, listenerPort })
  if (!receipt.child.kill('SIGTERM')) fail('STAGE3A_PROCESS_SIGNAL_FAILED', 'SAFETY_ABORT')
  try {
    await waitForExit(
      receipt.child,
      10_000,
      'STAGE3A_PROCESS_STOP_TIMEOUT',
      receipt.closeWitness,
      'SAFETY_ABORT',
    )
  } catch (error) {
    if (error?.stage3aCode !== 'STAGE3A_PROCESS_STOP_TIMEOUT') throw error
    if (receipt.child.exitCode !== null || receipt.child.signalCode !== null) throw error
    await assertLiveChild(receipt, { run, validated, listenerPort })
    if (!receipt.child.kill('SIGKILL')) fail('STAGE3A_PROCESS_SIGNAL_FAILED', 'SAFETY_ABORT')
    await waitForExit(
      receipt.child,
      10_000,
      'STAGE3A_PROCESS_KILL_TIMEOUT',
      receipt.closeWitness,
      'SAFETY_ABORT',
    )
  }
  await run.assertOwned()
  if (listenerPort !== undefined) await assertListenerAbsent(listenerPort, validated)
  run.markChildStopped(receipt)
}

export async function stopRetainedChrome(receipt, {
  run,
  validated,
  listenerPort,
  peer,
  operations = {},
}) {
  const assertLive = operations.assertLive ?? assertLiveChild
  const waitForExit = operations.waitForExit ?? waitForRetainedChildExit
  const listenerAbsent = operations.assertListenerAbsent ?? assertListenerAbsent
  const stopRetained = operations.stopRetained ?? stopRetainedChild
  await assertLive(receipt, { run, validated, listenerPort })

  let closeCommand
  try {
    closeCommand = Promise.resolve(peer.send('Browser.close'))
  } catch (error) {
    closeCommand = Promise.reject(error)
  }
  const closeOutcome = closeCommand.then(
    () => Object.freeze({ accepted: true }),
    (error) => Object.freeze({ accepted: error?.stage3aCode === 'STAGE3A_CDP_CLOSED' }),
  )

  try {
    await waitForExit(receipt.child, 10_000, 'STAGE3A_CHROME_CLOSE_TIMEOUT')
  } catch (error) {
    if (error?.stage3aCode !== 'STAGE3A_CHROME_CLOSE_TIMEOUT') throw error
    await peer.close()
    if (receipt.child.exitCode !== null || receipt.child.signalCode !== null) {
      await listenerAbsent(listenerPort, validated)
      const command = await closeOutcome
      run.markChildStopped(receipt)
      if (!command.accepted) fail('STAGE3A_CDP_CLOSE_FAILED', 'SAFETY_ABORT')
      return
    }
    await assertLive(receipt, { run, validated, listenerPort })
    await stopRetained(receipt, { run, validated, listenerPort, waitForExit })
    return
  }

  await listenerAbsent(listenerPort, validated)
  await peer.close()
  const command = await closeOutcome
  run.markChildStopped(receipt)
  if (!command.accepted) fail('STAGE3A_CDP_CLOSE_FAILED', 'SAFETY_ABORT')
}

async function stopIncompleteChild(receipt, {
  run,
  validated,
  waitForExit = waitForChildExit,
}) {
  if (receipt.child.exitCode !== null || receipt.child.signalCode !== null) return
  await assertLiveChild(receipt, { run, validated })
  if (!receipt.child.kill('SIGTERM')) fail('STAGE3A_PROCESS_SIGNAL_FAILED', 'SAFETY_ABORT')
  await waitForExit(
    receipt.child,
    10_000,
    'STAGE3A_PROCESS_STOP_TIMEOUT',
    receipt.closeWitness,
    'SAFETY_ABORT',
  )
}

/**
 * @param {any} receipt
 * @param {{
 *   run: any,
 *   validated: any,
 *   waitForExit?: (...args: any[]) => Promise<any>,
 *   stopIncomplete?: (...args: any[]) => Promise<any>,
 *   listenerPort?: number,
 *   assertListenerAbsent?: (...args: any[]) => Promise<any>,
 * }} options
 */
export async function retireIncompleteChildReceipt(receipt, {
  run,
  validated,
  waitForExit = waitForChildExit,
  stopIncomplete = stopIncompleteChild,
  listenerPort,
  assertListenerAbsent: listenerAbsent = assertListenerAbsent,
}) {
  if (receipt.child.exitCode === null && receipt.child.signalCode === null) {
    await stopIncomplete(receipt, { run, validated, waitForExit })
  }
  await waitForExit(
    receipt.child,
    10_000,
    'STAGE3A_PROCESS_STOP_TIMEOUT',
    receipt.closeWitness,
    'SAFETY_ABORT',
  )
  if (
    receipt.closeWitness?.child !== receipt.child
    || typeof receipt.closeWitness?.promise?.then !== 'function'
    || typeof receipt.closeWitness?.isClosed !== 'function'
    || receipt.closeWitness.isClosed() !== true
    || (receipt.child.exitCode === null && receipt.child.signalCode === null)
  ) fail('STAGE3A_PROCESS_STOP_TIMEOUT', 'SAFETY_ABORT')
  await run.assertOwned()
  if (listenerPort !== undefined) await listenerAbsent(listenerPort, validated)
  run.markChildStopped(receipt)
}

export function classifyProfileExit({ exitCode, signalCode, captureError, overflow }) {
  if (
    overflow !== false
    || captureError !== null
    || signalCode !== null
    || !Number.isInteger(exitCode)
  ) return 'uncertain'
  return exitCode === 0 ? 'direct' : 'negative-witness'
}

async function runProfileCommand({ argv, inputs, run, validated }) {
  await run.assertShim()
  await validated.assert('node')
  await validated.assert('dshCli')
  await validated.assert('pnpmNode')
  await validated.assert('pnpmCli')
  const childArgs = [inputs.dshCli, ...argv]
  const child = nodeSpawn(inputs.node, childArgs, {
    cwd: run.runRoot,
    env: run.pluginEnvironment,
    shell: false,
    detached: false,
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  const closeWitness = createNodeCloseWitness(child)
  const capture = createCapture(child)
  const receipt = makeSpawnReceipt({
    kind: 'profile-command', executable: inputs.node, argv: childArgs, run, environment: run.pluginEnvironment, child,
    closeWitness,
  })
  run.registerChild(receipt)
  try {
    await waitForChildExit(
      child,
      COMMAND_TIMEOUT_MS,
      'STAGE3A_PROFILE_COMMAND_TIMEOUT',
      closeWitness,
    )
  } catch (error) {
    await retireIncompleteChildReceipt(receipt, { run, validated })
    throw error
  }
  const disposition = classifyProfileExit({
    exitCode: child.exitCode,
    signalCode: child.signalCode,
    captureError: capture.error,
    overflow: capture.overflow,
  })
  await retireIncompleteChildReceipt(receipt, { run, validated })
  if (disposition === 'uncertain') {
    if (capture.overflow) fail('STAGE3A_TOOL_OUTPUT_TOO_LARGE', 'SAFETY_ABORT')
    fail('STAGE3A_PROFILE_DESCENDANT_UNCERTAIN', 'SAFETY_ABORT')
  }
  if (disposition === 'negative-witness') {
    await proveNoOpenHandles(run.runRoot, validated)
    const output = `${capture.stdout}\n${capture.stderr}`
    if (/ERR_PNPM_NO_OFFLINE_(?:META|TARBALL)|ERR_PNPM_FETCH_404/u.test(output)) {
      fail('STAGE3A_OFFLINE_DEPENDENCY_MISSING', 'NEEDS_NETWORK_PERMISSION')
    }
    fail('STAGE3A_PROFILE_COMMAND_FAILED')
  }
  return Object.freeze({ spawnReceiptSha256: receipt.sha256 })
}

async function assertFrozenTgz(run) {
  if (!run.frozenTgz) fail('STAGE3A_PACKAGE_FREEZE_INVALID', 'SAFETY_ABORT')
  const observed = await assertSameFileIdentity(run.frozenTgz.receipt, { maxBytes: 256 * 1024 * 1024 })
  if (observed.sha256 !== run.frozenTgz.sha256) fail('STAGE3A_PACKAGE_IDENTITY_DRIFT', 'SAFETY_ABORT')
}

async function assertInstalledPackage(run) {
  const profileDir = path.join(run.dshHome, 'profiles', 'web')
  const profile = await readStableJson(path.join(profileDir, 'package.json'))
  const dependency = profile.value.dependencies?.[PLUGIN_NAME]
  const bundles = profile.value.dsh?.profile?.bundles
  if (
    typeof dependency !== 'string'
    || !dependency.startsWith('file:')
    || !Array.isArray(bundles)
    || bundles.filter((value) => value === PLUGIN_NAME).length !== 1
  ) fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  const dependencyPath = path.resolve(profileDir, dependency.slice('file:'.length))
  if (dependencyPath !== run.frozenTgz.tgzAbsolutePath) {
    fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }

  const lexicalPackageRoot = path.join(profileDir, 'node_modules', '@knight', 'dsh-pm-workbench-storage-gate')
  const lexicalStats = await lstat(lexicalPackageRoot, { bigint: true }).catch(() => fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT'))
  if (!lexicalStats.isDirectory() && !lexicalStats.isSymbolicLink()) {
    fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
  if (lexicalStats.isSymbolicLink()) {
    const target = await readlink(lexicalPackageRoot)
    const lexicalTarget = path.resolve(path.dirname(lexicalPackageRoot), target)
    if (!pathInside(run.runRoot, lexicalTarget)) fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
  const packageRoot = await realpath(lexicalPackageRoot)
  if (!pathInside(run.runRoot, packageRoot)) fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')

  const receipt = run.frozenPackageReceipt
  if (!receipt || !Array.isArray(receipt.files)) fail('STAGE3A_PACKAGE_RECEIPT_INVALID', 'SAFETY_ABORT')
  const installedInventory = await listTreeFiles(packageRoot)
  if (JSON.stringify(installedInventory) !== JSON.stringify(receipt.files.map((file) => file.path))) {
    fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
  for (const file of receipt.files) {
    const installed = path.join(packageRoot, ...file.path.split('/'))
    if (!pathInside(packageRoot, installed)) fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
    const observed = await readStableFile(installed, { maxBytes: 64 * 1024 * 1024 })
    validateObservedPackageFile(observed, file)
  }
  const installedManifest = await readStableJson(path.join(packageRoot, 'package.json'))
  if (
    installedManifest.value.name !== PLUGIN_NAME
    || installedManifest.value.version !== PLUGIN_VERSION
    || installedManifest.value.dsh?.bundle?.patch !== './cordis.patch.yml'
  ) fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  const installedPatch = await readStableFile(path.join(packageRoot, 'cordis.patch.yml'), {
    maxBytes: 4096,
    includeBytes: true,
  })
  if (installedPatch.bytes.toString('utf8') !== PACKAGE_PATCH_BYTES) {
    fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
}

async function assertRemovedPackage(run) {
  const profileDir = path.join(run.dshHome, 'profiles', 'web')
  const profile = await readStableJson(path.join(profileDir, 'package.json'))
  const bundles = profile.value.dsh?.profile?.bundles ?? []
  if (Object.hasOwn(profile.value.dependencies ?? {}, PLUGIN_NAME) || bundles.includes(PLUGIN_NAME)) {
    fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
  await ensureAbsent(
    path.join(profileDir, 'node_modules', '@knight', 'dsh-pm-workbench-storage-gate'),
    'STAGE3A_PROFILE_WITNESS_INVALID',
  )
}

function createProductionProfileAdapter(validated) {
  return Object.freeze({
    async add({ inputs, run, tgzAbsolutePath, sha256: digest }) {
      if (
        tgzAbsolutePath !== run.frozenTgz?.tgzAbsolutePath
        || digest !== run.frozenTgz?.sha256
      ) fail('STAGE3A_PACKAGE_IDENTITY_DRIFT', 'SAFETY_ABORT')
      await assertFrozenTgz(run)
      return runProfileCommand({
        argv: buildPluginInvocation('add', tgzAbsolutePath), inputs, run, validated,
      })
    },
    async remove({ inputs, run }) {
      await assertFrozenTgz(run)
      return runProfileCommand({ argv: buildPluginInvocation('remove'), inputs, run, validated })
    },
    async witness({ state, run, sha256: digest }) {
      await run.assertOwned()
      if (state === 'removed') {
        await assertRemovedPackage(run)
        return Object.freeze({ state })
      }
      if (state !== 'installed' && state !== 'installed-disabled') {
        fail('STAGE3A_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
      }
      if (digest !== run.frozenTgz?.sha256) fail('STAGE3A_PACKAGE_IDENTITY_DRIFT', 'SAFETY_ABORT')
      await assertFrozenTgz(run)
      await assertInstalledPackage(run)
      if (state === 'installed-disabled') {
        const patch = await readStableFile(run.disablePatchPath, { maxBytes: 4096, includeBytes: true })
        if (patch.bytes.toString('utf8') !== DISABLE_PATCH_BYTES) {
          fail('STAGE3A_DISABLE_PATCH_INVALID', 'SAFETY_ABORT')
        }
      }
      return Object.freeze({ state })
    },
  })
}

async function waitForHarnessReady(child, capture) {
  const deadline = Date.now() + START_TIMEOUT_MS
  const pattern = /(?:^|\n)dsh web: (?<origin>http:\/\/127\.0\.0\.1:(?<port>[1-9][0-9]{0,4}))(?:\n|$)/u
  while (Date.now() < deadline) {
    if (capture.overflow) fail('STAGE3A_TOOL_OUTPUT_TOO_LARGE', 'SAFETY_ABORT')
    if (capture.error) fail('STAGE3A_HARNESS_START_FAILED')
    const match = pattern.exec(capture.stdout)
    if (match?.groups?.port) {
      const port = Number(match.groups.port)
      if (!Number.isInteger(port) || port > 65_535) fail('STAGE3A_HARNESS_URL_INVALID', 'SAFETY_ABORT')
      if (port === FORBIDDEN_PORT) fail('STAGE3A_FORBIDDEN_PORT', 'SAFETY_ABORT')
      return Object.freeze({ port, origin: match.groups.origin })
    }
    if (child.exitCode !== null || child.signalCode !== null) fail('STAGE3A_HARNESS_START_FAILED')
    await delay(25)
  }
  fail('STAGE3A_HARNESS_START_TIMEOUT')
}

function createProductionRuntimeAdapter(validated) {
  return Object.freeze({
    async start({ phase, inputs, run, disablePatchPath }) {
      await run.assertOwned()
      await validated.assert('node')
      await validated.assert('dshCli')
      if (disablePatchPath !== undefined && disablePatchPath !== run.disablePatchPath) {
        fail('STAGE3A_DISABLE_PATCH_INVALID', 'SAFETY_ABORT')
      }
      const argv = [inputs.dshCli, ...buildHarnessInvocation(disablePatchPath)]
      const child = nodeSpawn(inputs.node, argv, {
        cwd: run.runRoot,
        env: run.environment,
        shell: false,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const closeWitness = createNodeCloseWitness(child)
      const capture = createCapture(child)
      const receipt = makeSpawnReceipt({
        kind: `harness-${phase}`,
        executable: inputs.node,
        argv,
        run,
        environment: run.environment,
        child,
        closeWitness,
      })
      run.registerChild(receipt)
      let port
      try {
        await lsofCwd(receipt.pid, run.runRoot, validated)
        const ready = await waitForHarnessReady(child, capture)
        port = ready.port
        const listener = await lsofListener(receipt.pid, port, validated)
        const listenerWitnessSha256 = sha256(canonical(listener))
        let stopped = false
        return Object.freeze({
          port,
          origin: ready.origin,
          loopback: true,
          spawnReceiptSha256: receipt.sha256,
          listenerWitnessSha256,
          async stop() {
            if (stopped) return
            await stopRetainedChild(receipt, { run, validated, listenerPort: port })
            stopped = true
          },
        })
      } catch (error) {
        try {
          if (port === undefined) {
            await retireIncompleteChildReceipt(receipt, { run, validated })
          } else if (child.exitCode === null && child.signalCode === null) {
            await stopRetainedChild(receipt, { run, validated, listenerPort: port })
          } else {
            await retireIncompleteChildReceipt(receipt, {
              run,
              validated,
              listenerPort: port,
            })
          }
        } catch {
          throw new Stage3aRunnerError('STAGE3A_RUNTIME_START_CLEANUP_FAILED', 'SAFETY_ABORT')
        }
        throw error
      }
    },
  })
}

async function waitForChromeDevTools(child, capture, profilePath) {
  const activePortPath = path.join(profilePath, 'DevToolsActivePort')
  const deadline = Date.now() + START_TIMEOUT_MS
  const stderrPattern = /(?:^|\n)DevTools listening on (?<url>ws:\/\/127\.0\.0\.1:(?<port>[1-9][0-9]{0,4})(?<browserPath>\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}))(?:\n|$)/u
  while (Date.now() < deadline) {
    if (capture.overflow) fail('STAGE3A_TOOL_OUTPUT_TOO_LARGE', 'SAFETY_ABORT')
    if (capture.error) fail('STAGE3A_CHROME_START_FAILED')
    if (child.exitCode !== null || child.signalCode !== null) fail('STAGE3A_CHROME_START_FAILED')
    const stderrMatch = stderrPattern.exec(capture.stderr)
    let activePort
    try {
      const read = await readStableFile(activePortPath, { maxBytes: 512, includeBytes: true })
      activePort = parseDevToolsActivePort(read.bytes)
    } catch (error) {
      if (error instanceof Stage3aRunnerError && error.stage3aCode === 'STAGE3A_FORBIDDEN_PORT') throw error
      activePort = undefined
    }
    if (stderrMatch?.groups && activePort) {
      const loggedPort = Number(stderrMatch.groups.port)
      const logged = Object.freeze({
        port: loggedPort,
        browserPath: stderrMatch.groups.browserPath,
        webSocketUrl: stderrMatch.groups.url,
      })
      if (
        loggedPort === FORBIDDEN_PORT
        || loggedPort !== activePort.port
        || stderrMatch.groups.browserPath !== activePort.browserPath
        || stderrMatch.groups.url !== activePort.webSocketUrl
      ) fail('STAGE3A_DEVTOOLS_WITNESS_MISMATCH', 'SAFETY_ABORT')
      const lexical = await lstat(activePortPath, { bigint: true })
      if (!lexical.isFile() || lexical.isSymbolicLink() || (Number(lexical.mode) & 0o022) !== 0) {
        fail('STAGE3A_DEVTOOLS_FILE_INVALID', 'SAFETY_ABORT')
      }
      return logged
    }
    await delay(25)
  }
  fail('STAGE3A_CHROME_START_TIMEOUT')
}

function cdpFailure(code = 'STAGE3A_CDP_PROTOCOL_FAILED') {
  return new Stage3aRunnerError(code, 'INCONCLUSIVE')
}

/**
 * @param {string} webSocketUrl
 * @param {{ WebSocketImpl?: any, timeoutMs?: number }} [options]
 * @returns {Promise<any>}
 */
export async function createCdpPeer(webSocketUrl, {
  WebSocketImpl = globalThis.WebSocket,
  timeoutMs = CDP_TIMEOUT_MS,
} = {}) {
  if (
    typeof WebSocketImpl !== 'function'
    || typeof webSocketUrl !== 'string'
    || !/^ws:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}\/devtools\/browser\/[0-9a-f-]+$/u.test(webSocketUrl)
  ) fail('STAGE3A_CDP_ENDPOINT_INVALID', 'SAFETY_ABORT')
  const socket = new WebSocketImpl(webSocketUrl)
  await withTimeout(new Promise((resolve, reject) => {
    const opened = () => {
      socket.removeEventListener('error', errored)
      resolve()
    }
    const errored = () => {
      socket.removeEventListener('open', opened)
      reject(cdpFailure('STAGE3A_CDP_CONNECT_FAILED'))
    }
    socket.addEventListener('open', opened, { once: true })
    socket.addEventListener('error', errored, { once: true })
  }), timeoutMs, 'STAGE3A_CDP_CONNECT_TIMEOUT')

  let nextId = 1
  let closed = false
  let terminalError = null
  const pending = new Map()
  const queuedEvents = []
  const waiters = new Set()
  const handlers = new Set()

  function rejectAll(error) {
    if (!terminalError) terminalError = error
    for (const entry of pending.values()) {
      clearTimeout(entry.timer)
      entry.reject(error)
    }
    pending.clear()
    for (const waiter of waiters) {
      clearTimeout(waiter.timer)
      waiter.reject(error)
    }
    waiters.clear()
  }

  socket.addEventListener('message', (event) => {
    if (typeof event.data !== 'string' || Buffer.byteLength(event.data) > MAX_CAPTURE_BYTES) {
      rejectAll(cdpFailure())
      return
    }
    let message
    try {
      message = JSON.parse(event.data)
    } catch {
      rejectAll(cdpFailure())
      return
    }
    if (Number.isSafeInteger(message?.id)) {
      const entry = pending.get(message.id)
      if (!entry) return
      pending.delete(message.id)
      clearTimeout(entry.timer)
      if (message.error !== undefined || message.result === undefined) entry.reject(cdpFailure())
      else entry.resolve(message.result)
      return
    }
    if (typeof message?.method !== 'string') return
    const envelope = Object.freeze({
      method: message.method,
      params: message.params ?? {},
      sessionId: message.sessionId,
    })
    let matchedWaiter = false
    for (const waiter of [...waiters]) {
      if (waiter.method === envelope.method && waiter.sessionId === envelope.sessionId) {
        waiters.delete(waiter)
        clearTimeout(waiter.timer)
        waiter.resolve(envelope.params)
        matchedWaiter = true
        break
      }
    }
    if (!matchedWaiter) {
      queuedEvents.push(envelope)
      if (queuedEvents.length > 512) queuedEvents.shift()
    }
    for (const handler of handlers) handler(envelope)
  })
  socket.addEventListener('error', () => { rejectAll(cdpFailure()) })
  socket.addEventListener('close', () => {
    closed = true
    rejectAll(cdpFailure('STAGE3A_CDP_CLOSED'))
  })

  return Object.freeze({
    send(method, params = {}, sessionId = undefined, commandOptions = {}) {
      const commandTimeoutMs = isPlainObject(commandOptions)
        ? (commandOptions.timeoutMs ?? timeoutMs)
        : undefined
      if (
        closed
        || terminalError
        || typeof method !== 'string'
        || !isPlainObject(params)
        || !isPlainObject(commandOptions)
        || Object.keys(commandOptions).some((key) => key !== 'timeoutMs')
        || !Number.isSafeInteger(commandTimeoutMs)
        || commandTimeoutMs < 1
        || commandTimeoutMs > COMMAND_TIMEOUT_MS
      ) {
        return Promise.reject(terminalError ?? cdpFailure())
      }
      const id = nextId
      nextId += 1
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id)
          reject(cdpFailure('STAGE3A_CDP_COMMAND_TIMEOUT'))
        }, commandTimeoutMs)
        pending.set(id, { resolve, reject, timer })
        try {
          socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
        } catch {
          clearTimeout(timer)
          pending.delete(id)
          reject(cdpFailure())
        }
      })
    },
    waitForEvent(method, sessionId = undefined, milliseconds = timeoutMs) {
      const queuedIndex = queuedEvents.findIndex((entry) => entry.method === method && entry.sessionId === sessionId)
      if (queuedIndex >= 0) return Promise.resolve(queuedEvents.splice(queuedIndex, 1)[0].params)
      if (closed || terminalError) return Promise.reject(terminalError ?? cdpFailure())
      return new Promise((resolve, reject) => {
        const waiter = { method, sessionId, resolve, reject, timer: undefined }
        waiter.timer = setTimeout(() => {
          waiters.delete(waiter)
          reject(cdpFailure('STAGE3A_CDP_EVENT_TIMEOUT'))
        }, milliseconds)
        waiters.add(waiter)
      })
    },
    onEvent(handler) {
      if (typeof handler !== 'function') fail('STAGE3A_CDP_HANDLER_INVALID', 'SAFETY_ABORT')
      handlers.add(handler)
      return () => { handlers.delete(handler) }
    },
    close() {
      if (closed) return
      closed = true
      try { socket.close() } catch {}
      rejectAll(cdpFailure('STAGE3A_CDP_CLOSED'))
    },
  })
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function allowedPageUrl(rawUrl, origin) {
  if (typeof rawUrl !== 'string' || rawUrl.length > 8192) return false
  if (rawUrl === 'about:blank' || rawUrl.startsWith('data:') || rawUrl.startsWith('chrome:')) return true
  if (rawUrl.startsWith(`blob:${origin}/`)) return true
  let url
  try {
    url = new URL(rawUrl)
  } catch {
    return false
  }
  if ((url.protocol === 'http:' || url.protocol === 'ws:') && url.hostname === '127.0.0.1') {
    return `${url.hostname}:${url.port}` === new URL(origin).host
  }
  return false
}

function assertPageObservationSafe(guard, clock = undefined) {
  if (guard !== undefined) {
    if (typeof guard?.assertSafe !== 'function') fail('STAGE3A_CDP_PROTOCOL_FAILED')
    guard.assertSafe()
  }
  if (clock !== undefined) {
    if (typeof clock?.assertBeforeDeadline !== 'function') fail('STAGE3A_CDP_PROTOCOL_FAILED')
    clock.assertBeforeDeadline()
  }
}

async function awaitPageBoundary(operation, guard = undefined, clock = undefined) {
  if (typeof operation !== 'function') fail('STAGE3A_CDP_PROTOCOL_FAILED')
  assertPageObservationSafe(guard, clock)
  try {
    return await operation()
  } finally {
    assertPageObservationSafe(guard, clock)
  }
}

async function queryMarker(peer, sessionId, marker, guard = undefined, clock = undefined) {
  if (!Object.hasOwn(PLUGIN_MARKERS, marker)) fail('STAGE3A_MARKER_INVALID', 'SAFETY_ABORT')
  const document = await awaitPageBoundary(
    () => peer.send('DOM.getDocument', { depth: -1, pierce: true }, sessionId),
    guard,
    clock,
  )
  const rootNodeId = document?.root?.nodeId
  if (!Number.isSafeInteger(rootNodeId) || rootNodeId < 1) fail('STAGE3A_DOM_RESULT_INVALID')
  const queried = await awaitPageBoundary(
    () => peer.send('DOM.querySelectorAll', {
      nodeId: rootNodeId,
      selector: PLUGIN_MARKERS[marker],
    }, sessionId),
    guard,
    clock,
  )
  if (
    !Array.isArray(queried?.nodeIds)
    || queried.nodeIds.some((nodeId) => !Number.isSafeInteger(nodeId) || nodeId < 1)
  ) fail('STAGE3A_DOM_RESULT_INVALID')
  if (queried.nodeIds.length > 1) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  return queried.nodeIds[0] ?? 0
}

function createObservationClock(milliseconds, {
  current = () => Date.now(),
  sleep = readinessDelay,
} = {}) {
  if (
    !Number.isFinite(milliseconds)
    || milliseconds <= 0
    || typeof current !== 'function'
    || typeof sleep !== 'function'
  ) fail('STAGE3A_CDP_PROTOCOL_FAILED')
  const deadline = current() + milliseconds
  if (!Number.isFinite(deadline)) fail('STAGE3A_CDP_PROTOCOL_FAILED')
  const clock = {
    assertBeforeDeadline() {
      if (current() >= deadline) fail('STAGE3A_OBSERVATION_MISMATCH', 'FAIL')
    },
    async pause() {
      const remaining = deadline - current()
      if (remaining <= 0) fail('STAGE3A_OBSERVATION_MISMATCH', 'FAIL')
      try {
        await sleep(Math.min(50, remaining))
      } finally {
        clock.assertBeforeDeadline()
      }
    },
  }
  return Object.freeze(clock)
}

export async function waitForMarker(peer, sessionId, marker, {
  present = true,
  milliseconds = CDP_TIMEOUT_MS,
  guard = undefined,
  clock = createObservationClock(milliseconds),
} = {}) {
  if (typeof clock?.pause !== 'function') fail('STAGE3A_CDP_PROTOCOL_FAILED')
  while (true) {
    assertPageObservationSafe(guard, clock)
    const nodeId = await queryMarker(peer, sessionId, marker, guard, clock)
    if ((present && nodeId > 0) || (!present && nodeId === 0)) return nodeId
    await clock.pause()
    assertPageObservationSafe(guard, clock)
  }
}

function attributeMap(attributes) {
  if (!Array.isArray(attributes) || attributes.length % 2 !== 0) fail('STAGE3A_DOM_RESULT_INVALID')
  const result = new Map()
  for (let index = 0; index < attributes.length; index += 2) {
    result.set(attributes[index], attributes[index + 1])
  }
  return result
}

export async function waitForCounter(peer, sessionId, expected, {
  guard = undefined,
  milliseconds = CDP_TIMEOUT_MS,
  clock = createObservationClock(milliseconds),
} = {}) {
  if (typeof clock?.pause !== 'function') fail('STAGE3A_CDP_PROTOCOL_FAILED')
  while (true) {
    assertPageObservationSafe(guard, clock)
    const nodeId = await queryMarker(peer, sessionId, 'counter', guard, clock)
    if (nodeId > 0) {
      const response = await awaitPageBoundary(
        () => peer.send('DOM.getAttributes', { nodeId }, sessionId),
        guard,
        clock,
      )
      const attributes = attributeMap(response.attributes)
      if (attributes.get('data-counter') === String(expected) && attributes.get('data-version') === String(expected)) {
        return expected
      }
    }
    await clock.pause()
    assertPageObservationSafe(guard, clock)
  }
}

function axString(node, property) {
  return typeof node?.[property]?.value === 'string' ? node[property].value : undefined
}

function positiveBackendNodeId(value) {
  return Number.isSafeInteger(value) && value > 0 ? value : undefined
}

function axPropertyIsTrue(node, name) {
  return Array.isArray(node?.properties) && node.properties.some((property) =>
    property?.name === name && property?.value?.value === true,
  )
}

function validatedActiveBackendNodeIds(value, maximum) {
  if (
    !Array.isArray(value)
    || value.length > maximum
    || value.some((backendNodeId) => positiveBackendNodeId(backendNodeId) === undefined)
    || new Set(value).size !== value.length
  ) fail('STAGE3A_DOM_RESULT_INVALID')
  return new Set(value)
}

function inspectRc6OnboardingTree(response, mainFrameId, activeDom, { allowWorkbenchOverlay = false } = {}) {
  if (!Array.isArray(response?.nodes)) fail('STAGE3A_CDP_PROTOCOL_FAILED')
  const activeModalBackendNodeIds = validatedActiveBackendNodeIds(
    activeDom?.modalBackendNodeIds,
    MAX_ACTIVE_MODAL_NODES,
  )
  const activeButtonBackendNodeIds = validatedActiveBackendNodeIds(
    activeDom?.buttonBackendNodeIds,
    MAX_ACTIVE_BUTTON_NODES,
  )
  const workbenchOverlayBackendNodeIds = validatedActiveBackendNodeIds(
    activeDom?.workbenchOverlayBackendNodeIds,
    1,
  )
  const nodeById = new Map()
  for (const node of response.nodes) {
    if (
      !isPlainObject(node)
      || typeof node.nodeId !== 'string'
      || node.nodeId.length === 0
      || typeof node.ignored !== 'boolean'
      || (node.parentId !== undefined && typeof node.parentId !== 'string')
      || (node.frameId !== undefined && typeof node.frameId !== 'string')
      || (node.backendDOMNodeId !== undefined && positiveBackendNodeId(node.backendDOMNodeId) === undefined)
    ) {
      fail('STAGE3A_CDP_PROTOCOL_FAILED')
    }
    if (nodeById.has(node.nodeId)) fail('STAGE3A_CDP_PROTOCOL_FAILED')
    nodeById.set(node.nodeId, node)
  }
  if (!response.nodes.some((node) => node.frameId === mainFrameId)) fail('STAGE3A_CDP_PROTOCOL_FAILED')

  if (activeModalBackendNodeIds.size > 1) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  if (allowWorkbenchOverlay && workbenchOverlayBackendNodeIds.size === 1) {
    const [overlayBackendNodeId] = workbenchOverlayBackendNodeIds
    if (activeModalBackendNodeIds.size === 0) return undefined
    if (!activeModalBackendNodeIds.has(overlayBackendNodeId)) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
    const overlayModalNodes = response.nodes.filter((node) => {
      const role = axString(node, 'role')
      return (role === 'dialog' || role === 'alertdialog')
        && node.backendDOMNodeId === overlayBackendNodeId
    })
    if (overlayModalNodes.length > 1) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
    if (overlayModalNodes.length === 0) return undefined
    const overlayModal = overlayModalNodes[0]
    if (
      overlayModal.ignored
      || (overlayModal.frameId !== undefined && overlayModal.frameId !== mainFrameId)
    ) return undefined
    const seen = new Set([overlayModal.nodeId])
    let parentId = overlayModal.parentId
    let terminal = overlayModal
    while (parentId !== undefined) {
      if (seen.has(parentId)) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      seen.add(parentId)
      const parent = nodeById.get(parentId)
      if (!parent) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      terminal = parent
      parentId = parent.parentId
    }
    if (axString(terminal, 'role') !== 'RootWebArea') fail('STAGE3A_PAGE_NAVIGATION_FAILED')
    return Object.freeze({
      dialog: undefined,
      interactionDialogBackendNodeId: overlayBackendNodeId,
      nodeById,
      nodes: response.nodes,
      modalSignature: `workbench-overlay:${overlayBackendNodeId}`,
    })
  }
  if (workbenchOverlayBackendNodeIds.size > 0) return undefined
  const modalNodes = response.nodes.filter((node) => {
    const role = axString(node, 'role')
    return (role === 'dialog' || role === 'alertdialog')
      && activeModalBackendNodeIds.has(node.backendDOMNodeId)
  })
  if (modalNodes.length > activeModalBackendNodeIds.size) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  if (modalNodes.length < activeModalBackendNodeIds.size) return undefined

  const modal = modalNodes[0]
  if (!modal) {
    const strayKnownAction = response.nodes.some((node) =>
      axString(node, 'role') === 'button'
      && RC6_ONBOARDING_DIALOGS.some((entry) => entry.actionName === axString(node, 'name'))
      && activeButtonBackendNodeIds.has(node.backendDOMNodeId),
    )
    if (strayKnownAction) return undefined
    return Object.freeze({
      dialog: undefined,
      interactionDialogBackendNodeId: undefined,
      nodeById,
      nodes: response.nodes,
      modalSignature: 'none',
    })
  }

  const dialogIndex = RC6_ONBOARDING_DIALOGS.findIndex((entry) =>
    entry.dialogName === axString(modal, 'name'),
  )
  const dialogBackendNodeId = positiveBackendNodeId(modal.backendDOMNodeId)
  if (
    dialogIndex < 0
    || modal.ignored
    || dialogBackendNodeId === undefined
    || (modal.frameId !== undefined && modal.frameId !== mainFrameId)
  ) fail('STAGE3A_PAGE_NAVIGATION_FAILED')

  const expected = RC6_ONBOARDING_DIALOGS[dialogIndex]
  const actions = response.nodes.filter((node) =>
    axString(node, 'role') === 'button'
    && axString(node, 'name') === expected.actionName
    && activeButtonBackendNodeIds.has(node.backendDOMNodeId),
  )
  if (actions.length > 1) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  if (actions.length === 0) return undefined
  const action = actions[0]
  const actionBackendNodeId = positiveBackendNodeId(action.backendDOMNodeId)
  if (
    action.ignored
    || actionBackendNodeId === undefined
    || (action.frameId !== undefined && action.frameId !== mainFrameId)
  ) fail('STAGE3A_PAGE_NAVIGATION_FAILED')

  const seen = new Set([action.nodeId])
  let parentId = action.parentId
  let nearestModal
  let terminal
  while (parentId !== undefined) {
    if (seen.has(parentId)) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
    seen.add(parentId)
    const parent = nodeById.get(parentId)
    if (!parent) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
    terminal = parent
    const role = axString(parent, 'role')
    if (nearestModal === undefined && (role === 'dialog' || role === 'alertdialog')) nearestModal = parent
    parentId = parent.parentId
  }
  if (nearestModal !== modal || axString(terminal, 'role') !== 'RootWebArea') {
    fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  }

  return Object.freeze({
    dialog: Object.freeze({
      index: dialogIndex,
      node: modal,
      backendNodeId: dialogBackendNodeId,
      action,
      actionBackendNodeId,
      actionEnabled: !axPropertyIsTrue(action, 'disabled'),
    }),
    interactionDialogBackendNodeId: undefined,
    nodeById,
    nodes: response.nodes,
    modalSignature: `${dialogIndex}:${dialogBackendNodeId}:${actionBackendNodeId}:${axPropertyIsTrue(action, 'disabled') ? 0 : 1}`,
  })
}

function pointInsideConvexQuad(x, y, quad) {
  let sign = 0
  for (let index = 0; index < 4; index += 1) {
    const next = (index + 1) % 4
    const cross = (quad[next * 2] - quad[index * 2]) * (y - quad[index * 2 + 1])
      - (quad[next * 2 + 1] - quad[index * 2 + 1]) * (x - quad[index * 2])
    if (!Number.isFinite(cross) || Math.abs(cross) <= Number.EPSILON) return false
    const currentSign = Math.sign(cross)
    if (sign !== 0 && sign !== currentSign) return false
    sign = currentSign
  }
  return sign !== 0
}

function safeBoxModelPoint(response, metrics) {
  const quad = response?.model?.content
  if (!Array.isArray(quad) || quad.length !== 8 || quad.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    fail('STAGE3A_DOM_RESULT_INVALID')
  }
  const viewport = metrics?.cssVisualViewport
  const width = viewport?.clientWidth
  const height = viewport?.clientHeight
  if (
    typeof width !== 'number'
    || !Number.isFinite(width)
    || width <= 0
    || typeof height !== 'number'
    || !Number.isFinite(height)
    || height <= 0
  ) fail('STAGE3A_DOM_RESULT_INVALID')

  let twiceArea = 0
  for (let index = 0; index < 4; index += 1) {
    const next = (index + 1) % 4
    twiceArea += quad[index * 2] * quad[next * 2 + 1] - quad[next * 2] * quad[index * 2 + 1]
  }
  if (!Number.isFinite(twiceArea) || Math.abs(twiceArea) <= Number.EPSILON) {
    fail('STAGE3A_DOM_RESULT_INVALID')
  }

  const centerX = (quad[0] + quad[2] + quad[4] + quad[6]) / 4
  const centerY = (quad[1] + quad[3] + quad[5] + quad[7]) / 4
  const originX = Math.round(centerX)
  const originY = Math.round(centerY)
  for (let radius = 0; radius <= 2; radius += 1) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += 1) {
      for (let offsetX = -radius; offsetX <= radius; offsetX += 1) {
        const x = originX + offsetX
        const y = originY + offsetY
        if (
          x >= 0
          && x < width
          && y >= 0
          && y < height
          && pointInsideConvexQuad(x, y, quad)
        ) {
          return Object.freeze({ x, y, geometrySignature: `${quad.join(',')}@${width}x${height}` })
        }
      }
    }
  }
  fail('STAGE3A_DOM_RESULT_INVALID')
}

function createReadinessClock({ quietMs, timeoutMs, sleep, now }) {
  if (
    !Number.isSafeInteger(quietMs)
    || quietMs < 1
    || !Number.isSafeInteger(timeoutMs)
    || timeoutMs < quietMs
    || timeoutMs > COMMAND_TIMEOUT_MS
    || typeof sleep !== 'function'
    || typeof now !== 'function'
  ) fail('STAGE3A_CDP_PROTOCOL_FAILED')

  let lastNow
  const current = () => {
    const value = now()
    if (!Number.isFinite(value) || (lastNow !== undefined && value < lastNow)) {
      fail('STAGE3A_CDP_PROTOCOL_FAILED')
    }
    lastNow = value
    return value
  }
  const deadline = current() + timeoutMs
  if (!Number.isFinite(deadline)) fail('STAGE3A_CDP_PROTOCOL_FAILED')
  return Object.freeze({
    quietMs,
    current,
    assertBeforeDeadline() {
      if (current() >= deadline) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
    },
    async pause() {
      const before = current()
      const remaining = deadline - before
      if (remaining <= 0) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      await sleep(Math.min(ONBOARDING_POLL_MS, remaining))
      if (current() <= before) fail('STAGE3A_CDP_PROTOCOL_FAILED')
    },
  })
}

export function createPageWindowOpenGuard(peer, sessionId) {
  if (typeof peer?.onEvent !== 'function' || typeof sessionId !== 'string' || sessionId.length === 0) {
    fail('STAGE3A_CDP_PROTOCOL_FAILED')
  }
  let opened = false
  let disposed = false
  const unsubscribe = peer.onEvent((event) => {
    if (!disposed && event?.sessionId === sessionId && event?.method === 'Page.windowOpen') opened = true
  })
  if (typeof unsubscribe !== 'function') fail('STAGE3A_CDP_PROTOCOL_FAILED')
  return Object.freeze({
    assertSafe() {
      if (opened) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
    },
    dispose() {
      if (disposed) return
      disposed = true
      unsubscribe()
    },
  })
}

function assertReadinessBoundary(guard, clock) {
  assertPageObservationSafe(guard, clock)
}

function collectAttachedBackendNodeIds(root, mainFrameId) {
  if (!isPlainObject(root)) fail('STAGE3A_DOM_RESULT_INVALID')
  if (root.frameId !== undefined && root.frameId !== mainFrameId) fail('STAGE3A_DOM_RESULT_INVALID')
  const nodeIds = new Set()
  const backendNodeIds = new Set()
  const pending = [root]
  while (pending.length > 0) {
    if (nodeIds.size >= MAX_TREE_ENTRIES) fail('STAGE3A_DOM_RESULT_INVALID')
    const node = pending.pop()
    if (
      !isPlainObject(node)
      || !Number.isSafeInteger(node.nodeId)
      || node.nodeId < 1
      || positiveBackendNodeId(node.backendNodeId) === undefined
      || nodeIds.has(node.nodeId)
      || backendNodeIds.has(node.backendNodeId)
    ) fail('STAGE3A_DOM_RESULT_INVALID')
    nodeIds.add(node.nodeId)
    backendNodeIds.add(node.backendNodeId)
    for (const field of ['children', 'shadowRoots', 'pseudoElements']) {
      const children = node[field]
      if (children === undefined) continue
      if (!Array.isArray(children)) fail('STAGE3A_DOM_RESULT_INVALID')
      for (let index = children.length - 1; index >= 0; index -= 1) pending.push(children[index])
    }
  }
  return backendNodeIds
}

async function querySnapshotMarkerBackendNodeIds(
  peer,
  sessionId,
  rootNodeId,
  marker,
  guard,
  clock,
) {
  if (!Object.hasOwn(PLUGIN_MARKERS, marker)) fail('STAGE3A_MARKER_INVALID', 'SAFETY_ABORT')
  const queried = await awaitPageBoundary(
    () => peer.send('DOM.querySelectorAll', {
      nodeId: rootNodeId,
      selector: PLUGIN_MARKERS[marker],
    }, sessionId),
    guard,
    clock,
  )
  if (
    !Array.isArray(queried?.nodeIds)
    || queried.nodeIds.length > 1
    || queried.nodeIds.some((nodeId) => !Number.isSafeInteger(nodeId) || nodeId < 1)
    || new Set(queried.nodeIds).size !== queried.nodeIds.length
  ) fail('STAGE3A_DOM_RESULT_INVALID')

  const backendNodeIds = []
  for (const nodeId of queried.nodeIds) {
    const described = await awaitPageBoundary(
      () => peer.send('DOM.describeNode', { nodeId }, sessionId),
      guard,
      clock,
    )
    if (described?.node?.nodeId !== nodeId) fail('STAGE3A_DOM_RESULT_INVALID')
    const backendNodeId = positiveBackendNodeId(described?.node?.backendNodeId)
    if (backendNodeId === undefined || backendNodeIds.includes(backendNodeId)) {
      fail('STAGE3A_DOM_RESULT_INVALID')
    }
    backendNodeIds.push(backendNodeId)
  }
  return Object.freeze(backendNodeIds)
}

async function readActiveOnboardingDom(
  peer,
  sessionId,
  mainFrameId,
  guard,
  clock,
  { includeWorkbenchOverlay = false } = {},
) {
  const document = await awaitPageBoundary(
    () => peer.send('DOM.getDocument', { depth: -1, pierce: true }, sessionId),
    guard,
    clock,
  )
  const rootNodeId = document?.root?.nodeId
  if (!Number.isSafeInteger(rootNodeId) || rootNodeId < 1) fail('STAGE3A_DOM_RESULT_INVALID')
  const attachedBackendNodeIds = collectAttachedBackendNodeIds(document.root, mainFrameId)
  const workbenchOverlayBackendNodeIds = includeWorkbenchOverlay
    ? await querySnapshotMarkerBackendNodeIds(
        peer,
        sessionId,
        rootNodeId,
        'overlay',
        guard,
        clock,
      )
    : Object.freeze([])
  return Object.freeze({
    attachedBackendNodeIds,
    workbenchOverlayBackendNodeIds,
    selfConsistent: workbenchOverlayBackendNodeIds.every((backendNodeId) =>
      attachedBackendNodeIds.has(backendNodeId),
    ),
  })
}

async function readOnboardingState(
  peer,
  sessionId,
  mainFrameId,
  guard,
  clock,
  { allowWorkbenchOverlay = false } = {},
) {
  const response = await awaitPageBoundary(
    () => peer.send(
      'Accessibility.getFullAXTree',
      { frameId: mainFrameId },
      sessionId,
    ),
    guard,
    clock,
  )
  if (!Array.isArray(response?.nodes)) fail('STAGE3A_CDP_PROTOCOL_FAILED')
  const inventoryOptions = { includeWorkbenchOverlay: allowWorkbenchOverlay }
  const firstActiveDom = await readActiveOnboardingDom(
    peer, sessionId, mainFrameId, guard, clock, inventoryOptions,
  )
  const secondActiveDom = await readActiveOnboardingDom(
    peer, sessionId, mainFrameId, guard, clock, inventoryOptions,
  )
  const trackedBackendNodeIds = new Set()
  let unboundRelevantAxNode = false
  if (Array.isArray(response?.nodes)) {
    for (const node of response.nodes) {
      const role = axString(node, 'role')
      const relevant = role === 'dialog'
        || role === 'alertdialog'
        || (role === 'button'
          && RC6_ONBOARDING_DIALOGS.some((entry) => entry.actionName === axString(node, 'name')))
      if (!relevant) continue
      const backendNodeId = positiveBackendNodeId(node?.backendDOMNodeId)
      if (backendNodeId === undefined) unboundRelevantAxNode = true
      else trackedBackendNodeIds.add(backendNodeId)
    }
  }
  const stable = firstActiveDom.selfConsistent
    && secondActiveDom.selfConsistent
    && !unboundRelevantAxNode
    && firstActiveDom.workbenchOverlayBackendNodeIds.length
      === secondActiveDom.workbenchOverlayBackendNodeIds.length
    && firstActiveDom.workbenchOverlayBackendNodeIds.every((backendNodeId) =>
      secondActiveDom.workbenchOverlayBackendNodeIds.includes(backendNodeId),
    )
    && [...trackedBackendNodeIds].every((backendNodeId) =>
      firstActiveDom.attachedBackendNodeIds.has(backendNodeId)
        === secondActiveDom.attachedBackendNodeIds.has(backendNodeId),
    )
  if (!stable) return undefined
  const modalBackendNodeIds = [...new Set(response.nodes
    .filter((node) => {
      const role = axString(node, 'role')
      return (role === 'dialog' || role === 'alertdialog')
        && secondActiveDom.attachedBackendNodeIds.has(node.backendDOMNodeId)
    })
    .map((node) => node.backendDOMNodeId))]
  const buttonBackendNodeIds = [...new Set(response.nodes
    .filter((node) => axString(node, 'role') === 'button'
      && RC6_ONBOARDING_DIALOGS.some((entry) => entry.actionName === axString(node, 'name'))
      && secondActiveDom.attachedBackendNodeIds.has(node.backendDOMNodeId))
    .map((node) => node.backendDOMNodeId))]
  return inspectRc6OnboardingTree(response, mainFrameId, {
    modalBackendNodeIds,
    buttonBackendNodeIds,
    workbenchOverlayBackendNodeIds: secondActiveDom.workbenchOverlayBackendNodeIds,
  }, { allowWorkbenchOverlay })
}

function validateHitAxChain(response, targetBackendNodeId, dialogBackendNodeId, mainFrameId) {
  if (!Array.isArray(response?.nodes) || response.nodes.length === 0) fail('STAGE3A_CDP_PROTOCOL_FAILED')
  const frameIds = []
  let targetMatches = 0
  let dialogMatches = 0
  for (const node of response.nodes) {
    if (!isPlainObject(node)) fail('STAGE3A_CDP_PROTOCOL_FAILED')
    if (node.frameId !== undefined) {
      if (typeof node.frameId !== 'string') fail('STAGE3A_CDP_PROTOCOL_FAILED')
      frameIds.push(node.frameId)
    }
    if (node.backendDOMNodeId === targetBackendNodeId) targetMatches += 1
    if (dialogBackendNodeId !== undefined && node.backendDOMNodeId === dialogBackendNodeId) dialogMatches += 1
  }
  if (
    frameIds.length === 0
    || frameIds.some((frameId) => frameId !== mainFrameId)
    || targetMatches !== 1
    || (dialogBackendNodeId !== undefined && dialogMatches !== 1)
  ) return false
  return true
}

async function captureReadyTarget(peer, sessionId, mainFrameId, onboarding, {
  marker,
  requireEnabled = false,
  guard,
  clock,
} = {}) {
  assertReadinessBoundary(guard, clock)
  const dialog = onboarding.dialog
  let nodeId
  let targetBackendNodeId
  let dialogBackendNodeId
  let kind
  let dialogIndex

  if (dialog) {
    if (!dialog.actionEnabled) return undefined
    kind = 'dialog'
    dialogIndex = dialog.index
    targetBackendNodeId = dialog.actionBackendNodeId
    dialogBackendNodeId = dialog.backendNodeId
  } else {
    if (typeof marker !== 'string') fail('STAGE3A_CDP_PROTOCOL_FAILED')
    kind = 'marker'
    dialogBackendNodeId = onboarding.interactionDialogBackendNodeId
    nodeId = await queryMarker(peer, sessionId, marker, guard, clock)
    assertReadinessBoundary(guard, clock)
    if (nodeId === 0) return undefined
    if (requireEnabled) {
      const attributes = await awaitPageBoundary(
        () => peer.send('DOM.getAttributes', { nodeId }, sessionId),
        guard,
        clock,
      )
      if (attributeMap(attributes?.attributes).has('disabled')) return undefined
    }
    const described = await awaitPageBoundary(
      () => peer.send('DOM.describeNode', { nodeId }, sessionId),
      guard,
      clock,
    )
    if (described?.node?.nodeId !== nodeId) fail('STAGE3A_DOM_RESULT_INVALID')
    targetBackendNodeId = positiveBackendNodeId(described?.node?.backendNodeId)
    if (targetBackendNodeId === undefined) fail('STAGE3A_DOM_RESULT_INVALID')
  }

  await awaitPageBoundary(
    () => peer.send('DOM.scrollIntoViewIfNeeded', { backendNodeId: targetBackendNodeId }, sessionId),
    guard,
    clock,
  )
  const box = await awaitPageBoundary(
    () => peer.send('DOM.getBoxModel', { backendNodeId: targetBackendNodeId }, sessionId),
    guard,
    clock,
  )
  const metrics = await awaitPageBoundary(
    () => peer.send('Page.getLayoutMetrics', {}, sessionId),
    guard,
    clock,
  )
  const point = safeBoxModelPoint(box, metrics)
  const hit = await awaitPageBoundary(
    () => peer.send('DOM.getNodeForLocation', {
      x: point.x,
      y: point.y,
      includeUserAgentShadowDOM: false,
      ignorePointerEventsNone: false,
    }, sessionId),
    guard,
    clock,
  )
  const hitBackendNodeId = positiveBackendNodeId(hit?.backendNodeId)
  if (hitBackendNodeId === undefined) fail('STAGE3A_DOM_RESULT_INVALID')
  if (hit?.frameId !== mainFrameId) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  const hitAx = await awaitPageBoundary(
    () => peer.send('Accessibility.getAXNodeAndAncestors', {
      backendNodeId: hitBackendNodeId,
    }, sessionId),
    guard,
    clock,
  )
  if (!validateHitAxChain(hitAx, targetBackendNodeId, dialogBackendNodeId, mainFrameId)) return undefined

  return Object.freeze({
    kind,
    dialogIndex,
    dialogBackendNodeId,
    targetBackendNodeId,
    point: Object.freeze({ x: point.x, y: point.y }),
    signature: [
      onboarding.modalSignature,
      kind,
      dialogIndex ?? '',
      targetBackendNodeId,
      dialogBackendNodeId ?? '',
      point.geometrySignature,
      hitBackendNodeId,
      mainFrameId,
    ].join('|'),
  })
}

async function dispatchVerifiedPointerClick(peer, sessionId, guard, clock, snapshot, recapture) {
  await awaitPageBoundary(
    () => peer.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      ...snapshot.point,
      button: 'none',
      buttons: 0,
      pointerType: 'mouse',
    }, sessionId),
    guard,
    clock,
  )
  const fresh = await recapture()
  assertReadinessBoundary(guard, clock)
  if (!fresh || fresh.signature !== snapshot.signature) fail('STAGE3A_PAGE_NAVIGATION_FAILED')

  await awaitPageBoundary(
    () => peer.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      ...snapshot.point,
      button: 'left',
      buttons: 1,
      clickCount: 1,
      pointerType: 'mouse',
    }, sessionId),
    guard,
    clock,
  )
  await awaitPageBoundary(
    () => peer.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      ...snapshot.point,
      button: 'left',
      buttons: 0,
      clickCount: 1,
      pointerType: 'mouse',
    }, sessionId),
    guard,
    clock,
  )
}

/**
 * @param {any} peer
 * @param {string} sessionId
 * @param {{
 *   mainFrameId: string,
 *   windowGuard?: { assertSafe: () => void, dispose: () => void },
 *   quietMs?: number,
 *   timeoutMs?: number,
 *   sleep?: (milliseconds: number) => Promise<unknown>,
 *   now?: () => number,
 * }} options
 */
export async function prepareRc6PageForPluginInteraction(peer, sessionId, {
  mainFrameId,
  windowGuard,
  quietMs = QUIET_PERIOD_MS,
  timeoutMs = START_TIMEOUT_MS,
  sleep = readinessDelay,
  now = Date.now,
} = {}) {
  if (
    typeof peer?.send !== 'function'
    || typeof peer?.onEvent !== 'function'
    || typeof sessionId !== 'string'
    || sessionId.length === 0
    || typeof mainFrameId !== 'string'
    || mainFrameId.length === 0
  ) fail('STAGE3A_CDP_PROTOCOL_FAILED')

  const clock = createReadinessClock({ quietMs, timeoutMs, sleep, now })
  const ownGuard = windowGuard === undefined
  const guard = windowGuard ?? createPageWindowOpenGuard(peer, sessionId)
  if (typeof guard?.assertSafe !== 'function' || typeof guard?.dispose !== 'function') {
    fail('STAGE3A_CDP_PROTOCOL_FAILED')
  }
  let waitingForDialog
  let highestHandledDialog = -1
  let stableSignature
  let stableSince

  try {
    while (true) {
      guard.assertSafe()
      clock.assertBeforeDeadline()
      const onboarding = await readOnboardingState(peer, sessionId, mainFrameId, guard, clock)
      assertReadinessBoundary(guard, clock)
      if (!onboarding) {
        stableSignature = undefined
        stableSince = undefined
        await clock.pause()
        continue
      }

      if (waitingForDialog !== undefined) {
        if (onboarding.dialog?.index === waitingForDialog.index) {
          if (onboarding.dialog.backendNodeId !== waitingForDialog.backendNodeId) {
            fail('STAGE3A_PAGE_NAVIGATION_FAILED')
          }
          if (onboarding.dialog.actionBackendNodeId !== waitingForDialog.actionBackendNodeId) {
            fail('STAGE3A_PAGE_NAVIGATION_FAILED')
          }
          if (!onboarding.dialog.actionEnabled) {
            waitingForDialog = Object.freeze({ ...waitingForDialog, sawDisabled: true })
          } else if (waitingForDialog.sawDisabled) {
            fail('STAGE3A_PAGE_NAVIGATION_FAILED')
          }
          stableSignature = undefined
          stableSince = undefined
          await clock.pause()
          continue
        }
        waitingForDialog = undefined
      }

      if (onboarding.dialog && onboarding.dialog.index <= highestHandledDialog) {
        fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      }
      if (onboarding.dialog && !onboarding.dialog.actionEnabled) {
        fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      }

      const snapshot = await captureReadyTarget(peer, sessionId, mainFrameId, onboarding, {
        marker: 'launcher',
        guard,
        clock,
      })
      assertReadinessBoundary(guard, clock)
      const observedAt = clock.current()
      if (!snapshot) {
        stableSignature = undefined
        stableSince = undefined
      } else if (snapshot.signature !== stableSignature) {
        stableSignature = snapshot.signature
        stableSince = observedAt
      } else if (observedAt - stableSince >= clock.quietMs) {
        if (snapshot.kind === 'marker') return
        await dispatchVerifiedPointerClick(peer, sessionId, guard, clock, snapshot, async () => {
          const freshOnboarding = await readOnboardingState(peer, sessionId, mainFrameId, guard, clock)
          if (!freshOnboarding || freshOnboarding.dialog?.index !== snapshot.dialogIndex) return undefined
          return captureReadyTarget(peer, sessionId, mainFrameId, freshOnboarding, {
            marker: 'launcher',
            guard,
            clock,
          })
        })
        highestHandledDialog = snapshot.dialogIndex
        waitingForDialog = Object.freeze({
          index: snapshot.dialogIndex,
          backendNodeId: snapshot.dialogBackendNodeId,
          actionBackendNodeId: snapshot.targetBackendNodeId,
          sawDisabled: false,
        })
        stableSignature = undefined
        stableSince = undefined
        continue
      }
      await clock.pause()
    }
  } finally {
    if (ownGuard) guard.dispose()
  }
}

/**
 * @param {any} peer
 * @param {string} sessionId
 * @param {string} marker
 * @param {{
 *   requireEnabled?: boolean,
 *   mainFrameId: string,
 *   windowGuard?: { assertSafe: () => void, dispose: () => void },
 *   quietMs?: number,
 *   timeoutMs?: number,
 *   sleep?: (milliseconds: number) => Promise<unknown>,
 *   now?: () => number,
 * }} options
 */
export async function clickMarker(peer, sessionId, marker, {
  requireEnabled = false,
  mainFrameId,
  windowGuard,
  quietMs = QUIET_PERIOD_MS,
  timeoutMs = CDP_TIMEOUT_MS,
  sleep = readinessDelay,
  now = Date.now,
} = {}) {
  if (
    typeof peer?.send !== 'function'
    || typeof peer?.onEvent !== 'function'
    || typeof sessionId !== 'string'
    || sessionId.length === 0
    || typeof mainFrameId !== 'string'
    || mainFrameId.length === 0
    || !Object.hasOwn(PLUGIN_MARKERS, marker)
  ) fail('STAGE3A_CDP_PROTOCOL_FAILED')
  const clock = createReadinessClock({ quietMs, timeoutMs, sleep, now })
  const ownGuard = windowGuard === undefined
  const guard = windowGuard ?? createPageWindowOpenGuard(peer, sessionId)
  const allowWorkbenchOverlay = marker === 'increment' || marker === 'close'
  let stableSignature
  let stableSince
  try {
    while (true) {
      guard.assertSafe()
      clock.assertBeforeDeadline()
      const onboarding = await readOnboardingState(
        peer,
        sessionId,
        mainFrameId,
        guard,
        clock,
        { allowWorkbenchOverlay },
      )
      if (!onboarding) {
        stableSignature = undefined
        stableSince = undefined
        await clock.pause()
        continue
      }
      if (allowWorkbenchOverlay && onboarding.interactionDialogBackendNodeId === undefined) {
        stableSignature = undefined
        stableSince = undefined
        await clock.pause()
        continue
      }
      if (onboarding.dialog) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      const snapshot = await captureReadyTarget(peer, sessionId, mainFrameId, onboarding, {
        marker,
        requireEnabled,
        guard,
        clock,
      })
      assertReadinessBoundary(guard, clock)
      const observedAt = clock.current()
      if (!snapshot) {
        stableSignature = undefined
        stableSince = undefined
      } else if (snapshot.signature !== stableSignature) {
        stableSignature = snapshot.signature
        stableSince = observedAt
      } else if (observedAt - stableSince >= clock.quietMs) {
        await dispatchVerifiedPointerClick(peer, sessionId, guard, clock, snapshot, async () => {
          const freshOnboarding = await readOnboardingState(
            peer,
            sessionId,
            mainFrameId,
            guard,
            clock,
            { allowWorkbenchOverlay },
          )
          if (
            !freshOnboarding
            || freshOnboarding.dialog
            || (allowWorkbenchOverlay
              && freshOnboarding.interactionDialogBackendNodeId === undefined)
          ) return undefined
          return captureReadyTarget(peer, sessionId, mainFrameId, freshOnboarding, {
            marker,
            requireEnabled,
            guard,
            clock,
          })
        })
        return
      }
      await clock.pause()
    }
  } finally {
    if (ownGuard) guard.dispose()
  }
}

export async function waitForLauncherFocus(peer, sessionId, {
  guard = undefined,
  milliseconds = CDP_TIMEOUT_MS,
  clock = createObservationClock(milliseconds),
} = {}) {
  if (typeof clock?.pause !== 'function') fail('STAGE3A_CDP_PROTOCOL_FAILED')
  while (true) {
    assertPageObservationSafe(guard, clock)
    const nodeId = await queryMarker(peer, sessionId, 'launcher', guard, clock)
    if (nodeId > 0) {
      const described = await awaitPageBoundary(
        () => peer.send('DOM.describeNode', { nodeId }, sessionId),
        guard,
        clock,
      )
      const backendNodeId = described?.node?.backendNodeId
      if (Number.isSafeInteger(backendNodeId) && backendNodeId > 0) {
        const tree = await awaitPageBoundary(
          () => peer.send('Accessibility.getPartialAXTree', {
            backendNodeId,
            fetchRelatives: false,
          }, sessionId),
          guard,
          clock,
        )
        const focused = tree.nodes?.some((node) =>
          node?.backendDOMNodeId === backendNodeId
          && node?.properties?.some((property) => property?.name === 'focused' && property?.value?.value === true),
        )
        if (focused) return true
      }
    }
    await clock.pause()
    assertPageObservationSafe(guard, clock)
  }
}

async function observeMarkers(peer, sessionId, mainFrameId, windowGuard, phase) {
  await prepareRc6PageForPluginInteraction(peer, sessionId, { mainFrameId, windowGuard })
  await clickMarker(peer, sessionId, phase, { requireEnabled: true, mainFrameId, windowGuard })
  const deadline = Date.now() + START_TIMEOUT_MS
  while (Date.now() < deadline) {
    windowGuard.assertSafe()
    const nodeId = await queryMarker(peer, sessionId, 'status', windowGuard)
    if (nodeId) {
      const attributes = attributeMap((await peer.send('DOM.getAttributes', { nodeId }, sessionId)).attributes)
      const text = attributes.get('data-witness')
      if (text === 'FAIL') fail('STAGE3A_REAL_TABLE_FAILED', 'FAIL')
      if (text && text !== 'pending' && text !== 'idle') {
        if (text.length > 512) fail('STAGE3A_UNSAFE_UI_WITNESS', 'SAFETY_ABORT')
        let value
        try { value = JSON.parse(text) } catch { fail('STAGE3A_UNSAFE_UI_WITNESS', 'SAFETY_ABORT') }
        if (Object.keys(value).sort().join(',') !== 'backendCalls,bytes,hash,hidden,ok'
          || typeof value.ok !== 'boolean' || typeof value.hidden !== 'boolean'
          || !HASH_PATTERN.test(value.hash ?? '') || !Number.isSafeInteger(value.bytes) || value.bytes < 0
          || !Number.isSafeInteger(value.backendCalls) || value.backendCalls < 0) fail('STAGE3A_UNSAFE_UI_WITNESS', 'SAFETY_ABORT')
        return value
      }
    }
    await delay(50)
  }
  fail('STAGE3A_UI_WITNESS_TIMEOUT')
}

async function waitForMatchingEvent(
  peer,
  method,
  sessionId,
  predicate,
  guard = undefined,
  milliseconds = START_TIMEOUT_MS,
) {
  const deadline = Date.now() + milliseconds
  while (Date.now() < deadline) {
    assertPageObservationSafe(guard)
    const remaining = Math.max(1, deadline - Date.now())
    let event
    try {
      event = await peer.waitForEvent(method, sessionId, remaining)
    } finally {
      assertPageObservationSafe(guard)
    }
    if (predicate(event)) return event
  }
  assertPageObservationSafe(guard)
  fail('STAGE3A_CDP_EVENT_TIMEOUT')
}

export function isWorkbenchClientBundleUrl(rawUrl, origin) {
  if (typeof rawUrl !== 'string') return false
  let candidate
  let expectedOrigin
  try {
    candidate = new URL(rawUrl)
    expectedOrigin = new URL(origin).origin
  } catch {
    return false
  }
  return candidate.origin === expectedOrigin
    && candidate.pathname === `/plugins/${PLUGIN_NAME}/client.js`
    && /^\?rev=[0-9a-f]{12}$/u.test(candidate.search)
}

function sameOriginUrl(rawUrl, origin) {
  if (typeof rawUrl !== 'string') return false
  try {
    return new URL(rawUrl).origin === new URL(origin).origin
  } catch {
    return false
  }
}

const TRACKED_RESOURCE_TYPES = new Set(['Document', 'Script', 'Stylesheet', 'Fetch', 'XHR'])

/**
 * @param {any} peer
 * @param {string} sessionId
 * @param {string} origin
 * @param {{ externalAttempts: number, controlFailed: boolean }} networkState
 * @param {{ quietMs?: number, timeoutMs?: number, sleep?: (milliseconds: number) => Promise<unknown>, now?: () => number }} [options]
 */
export function createPageNetworkGate(peer, sessionId, origin, networkState, {
  quietMs = QUIET_PERIOD_MS,
  timeoutMs = CDP_TIMEOUT_MS,
  sleep = delay,
  now = Date.now,
} = {}) {
  if (
    typeof peer?.send !== 'function'
    || typeof peer?.onEvent !== 'function'
    || typeof sessionId !== 'string'
    || !sameOriginUrl(origin, origin)
    || !Number.isInteger(quietMs)
    || quietMs < 1
    || !Number.isInteger(timeoutMs)
    || timeoutMs < quietMs
    || typeof sleep !== 'function'
    || typeof now !== 'function'
  ) fail('STAGE3A_CDP_PROTOCOL_FAILED')

  const records = new Map()
  const lifecycleLoads = new Set()
  const pendingControls = new Set()
  const externalRequests = new Set()
  let mainLoaderId
  let loadingFailed = false
  let nonSuccessResponse = false
  let pageTargetEscaped = false
  let windowOpenOrdinal = 0
  let networkEpoch = 0
  let unsubscribed = false
  let quiescePromise

  function recordFor(requestId) {
    if (typeof requestId !== 'string' || requestId.length === 0 || requestId.length > 1024) return undefined
    let record = records.get(requestId)
    if (!record) {
      record = {
        requestId,
        url: undefined,
        type: undefined,
        loaderId: undefined,
        responseSucceeded: false,
        finished: false,
        pluginClient: false,
      }
      records.set(requestId, record)
    }
    return record
  }

  function noteExternal(key) {
    const stableKey = typeof key === 'string' && key.length > 0 ? key : `unknown-${externalRequests.size + 1}`
    if (externalRequests.has(stableKey)) return
    externalRequests.add(stableKey)
    networkState.externalAttempts += 1
  }

  function observeResponse({ requestId, loaderId, type, response }) {
    const url = response?.url
    if (!TRACKED_RESOURCE_TYPES.has(type) || !sameOriginUrl(url, origin)) return
    const record = recordFor(requestId)
    if (!record) {
      loadingFailed = true
      return
    }
    record.url = url
    record.type = type
    record.loaderId = loaderId
    record.pluginClient = type === 'Script' && isWorkbenchClientBundleUrl(url, origin)
    const status = response?.status
    record.responseSucceeded = typeof status === 'number' && status >= 200 && status < 300
    if (!record.responseSucceeded) nonSuccessResponse = true
  }

  const unsubscribe = peer.onEvent((event) => {
    if (unsubscribed || event.sessionId !== sessionId) return
    if (pageTargetEscaped) return
    if (event.method.startsWith('Network.') || event.method.startsWith('Fetch.')) networkEpoch += 1

    if (event.method === 'Page.windowOpen') {
      networkEpoch += 1
      pageTargetEscaped = true
      windowOpenOrdinal += 1
      if (!allowedPageUrl(event.params?.url, origin)) noteExternal(`window-open-${windowOpenOrdinal}`)
      return
    }

    if (event.method === 'Page.lifecycleEvent') {
      if (event.params?.name === 'load' && typeof event.params?.loaderId === 'string') {
        lifecycleLoads.add(event.params.loaderId)
      }
      return
    }
    if (event.method === 'Network.requestWillBeSent') {
      const { requestId, loaderId, type, request, redirectResponse } = event.params ?? {}
      const requestUrl = request?.url
      if (!allowedPageUrl(requestUrl, origin)) noteExternal(requestId)
      if (TRACKED_RESOURCE_TYPES.has(type) && sameOriginUrl(requestUrl, origin)) {
        const record = recordFor(requestId)
        if (record) {
          record.url = requestUrl
          record.type = type
          record.loaderId = loaderId
          record.pluginClient = type === 'Script' && isWorkbenchClientBundleUrl(requestUrl, origin)
        }
      }
      if (redirectResponse !== undefined) observeResponse({ requestId, loaderId, type, response: redirectResponse })
      return
    }
    if (event.method === 'Network.webSocketCreated') {
      if (!allowedPageUrl(event.params?.url, origin)) noteExternal(event.params?.requestId)
      return
    }
    if (event.method === 'Network.responseReceived') {
      observeResponse(event.params ?? {})
      return
    }
    if (event.method === 'Network.loadingFinished') {
      const record = recordFor(event.params?.requestId)
      if (record) record.finished = true
      return
    }
    if (event.method === 'Network.loadingFailed') {
      loadingFailed = true
      const record = recordFor(event.params?.requestId)
      if (record) record.finished = false
      return
    }
    if (event.method !== 'Fetch.requestPaused') return
    const requestUrl = event.params?.request?.url
    const externalKey = event.params?.networkId ?? event.params?.requestId
    const operation = allowedPageUrl(requestUrl, origin)
      ? peer.send('Fetch.continueRequest', { requestId: event.params.requestId }, sessionId)
      : (() => {
          noteExternal(externalKey)
          return peer.send('Fetch.failRequest', {
            requestId: event.params.requestId,
            errorReason: 'BlockedByClient',
          }, sessionId)
        })()
    pendingControls.add(operation)
    operation.catch(() => { networkState.controlFailed = true }).finally(() => { pendingControls.delete(operation) })
  })

  function stopListening() {
    if (unsubscribed) return
    unsubscribed = true
    unsubscribe()
  }

  async function quiesce() {
    if (quiescePromise) return quiescePromise
    quiescePromise = (async () => {
      const deadline = now() + timeoutMs
      while (true) {
        while (pendingControls.size > 0) {
          const remaining = deadline - now()
          if (remaining < 1) fail('STAGE3A_NETWORK_CONTROL_TIMEOUT')
          await withTimeout(Promise.allSettled([...pendingControls]), remaining, 'STAGE3A_NETWORK_CONTROL_TIMEOUT')
          if (networkState.controlFailed) fail('STAGE3A_NETWORK_CONTROL_FAILED', 'SAFETY_ABORT')
        }
        if (networkState.controlFailed) fail('STAGE3A_NETWORK_CONTROL_FAILED', 'SAFETY_ABORT')
        const before = networkEpoch
        const remaining = deadline - now()
        if (remaining < quietMs) fail('STAGE3A_NETWORK_CONTROL_TIMEOUT')
        await withTimeout(Promise.resolve(sleep(quietMs)), remaining, 'STAGE3A_NETWORK_CONTROL_TIMEOUT')
        if (networkState.controlFailed) fail('STAGE3A_NETWORK_CONTROL_FAILED', 'SAFETY_ABORT')
        if (pendingControls.size === 0 && before === networkEpoch) break
      }
    })().finally(stopListening)
    return quiescePromise
  }

  return Object.freeze({
    setMainLoader(loaderId) {
      if (typeof loaderId !== 'string' || loaderId.length === 0 || loaderId.length > 1024 || mainLoaderId !== undefined) {
        fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      }
      mainLoaderId = loaderId
    },
    async settle(phase) {
      await quiesce()
      if (networkState.externalAttempts !== 0) fail('STAGE3A_EXTERNAL_NETWORK_ATTEMPT', 'FAIL')
      if (pageTargetEscaped) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      if (loadingFailed) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      if (nonSuccessResponse) fail('STAGE3A_OBSERVATION_MISMATCH', 'FAIL')
      const mainCompleted = [...records.values()].some((record) =>
        record.type === 'Document'
        && record.loaderId === mainLoaderId
        && record.responseSucceeded
        && record.finished,
      ) && lifecycleLoads.has(mainLoaderId)
      if (!mainCompleted) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
      if (phase !== 'disabled' && phase !== 'removed') {
        const clientCompleted = [...records.values()].some((record) =>
          record.pluginClient && record.responseSucceeded && record.finished,
        )
        if (!clientCompleted) fail('STAGE3A_OBSERVATION_MISMATCH', 'FAIL')
      }
    },
    async dispose() {
      stopListening()
    },
  })
}

export async function createPageSession(peer, origin, networkState, phase) {
  await peer.send('Browser.getVersion')
  const target = await peer.send('Target.createTarget', { url: 'about:blank' })
  if (typeof target?.targetId !== 'string') fail('STAGE3A_CDP_PROTOCOL_FAILED')
  const attached = await peer.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
  if (typeof attached?.sessionId !== 'string') fail('STAGE3A_CDP_PROTOCOL_FAILED')
  const sessionId = attached.sessionId
  await Promise.all([
    peer.send('Page.enable', {}, sessionId),
    peer.send('Page.setLifecycleEventsEnabled', { enabled: true }, sessionId),
    peer.send('DOM.enable', {}, sessionId),
    peer.send('Accessibility.enable', {}, sessionId),
    peer.send('Network.enable', {}, sessionId),
    peer.send('Network.setCacheDisabled', { cacheDisabled: true }, sessionId),
    peer.send('Fetch.enable', { patterns: [{ urlPattern: '*', requestStage: 'Request' }] }, sessionId),
  ])
  const networkGate = createPageNetworkGate(peer, sessionId, origin, networkState)
  const windowGuard = createPageWindowOpenGuard(peer, sessionId)
  windowGuard.assertSafe()

  const navigation = await awaitPageBoundary(
    () => peer.send(
      'Page.navigate',
      { url: origin },
      sessionId,
      { timeoutMs: START_TIMEOUT_MS },
    ),
    windowGuard,
  )
  if (
    navigation?.errorText !== undefined
    || typeof navigation?.loaderId !== 'string'
    || navigation.loaderId.length === 0
    || typeof navigation?.frameId !== 'string'
    || navigation.frameId.length === 0
  ) {
    fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  }
  networkGate.setMainLoader(navigation.loaderId)
  const response = await waitForMatchingEvent(
    peer,
    'Network.responseReceived',
    sessionId,
    (event) => event?.type === 'Document' && event?.loaderId === navigation.loaderId,
    windowGuard,
  )
  windowGuard.assertSafe()
  if (
    typeof response?.response?.status !== 'number'
    || response.response.status < 200
    || response.response.status >= 300
    || new URL(response.response.url).origin !== origin
  ) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  await waitForMatchingEvent(
    peer,
    'Page.lifecycleEvent',
    sessionId,
    (event) => event?.loaderId === navigation.loaderId && event?.name === 'load',
    windowGuard,
  )
  windowGuard.assertSafe()
  const document = await awaitPageBoundary(
    () => peer.send('DOM.getDocument', { depth: 0, pierce: false }, sessionId),
    windowGuard,
  )
  if (new URL(document?.root?.documentURL).origin !== origin) fail('STAGE3A_PAGE_NAVIGATION_FAILED')
  windowGuard.assertSafe()
  return Object.freeze({
    sessionId,
    frameId: navigation.frameId,
    windowGuard,
    async settleNetwork() {
      await networkGate.settle(phase)
      windowGuard.assertSafe()
    },
    async disposeNetwork() {
      try {
        await networkGate.dispose()
      } finally {
        windowGuard.dispose()
      }
    },
  })
}

export async function cleanupBrowserPhaseResources({
  page,
  peer,
  child,
  devtools,
  receipt,
  run,
  validated,
  operations = {},
}) {
  const stopChrome = operations.stopChrome ?? stopRetainedChrome
  const stopRetained = operations.stopRetained ?? stopRetainedChild
  const stopIncomplete = operations.stopIncomplete ?? stopIncompleteChild
  const listenerAbsent = operations.assertListenerAbsent ?? assertListenerAbsent
  const chromeWaitForExit = operations.waitForExit ?? waitForRetainedChildExit
  let ok = true
  const attempt = async (operation) => {
    try {
      await operation()
    } catch {
      ok = false
    }
  }

  if (page) await attempt(async () => page.disposeNetwork())
  await attempt(async () => {
    if (child.exitCode === null && child.signalCode === null) {
      if (devtools && peer) {
        await stopChrome(receipt, { run, validated, listenerPort: devtools.port, peer })
      } else if (devtools) {
        await stopRetained(receipt, {
          run, validated, listenerPort: devtools.port, waitForExit: chromeWaitForExit,
        })
      } else {
        await stopIncomplete(receipt, { run, validated, waitForExit: chromeWaitForExit })
        await run.assertOwned()
        run.markChildStopped(receipt)
      }
    } else {
      await run.assertOwned()
      if (devtools) await listenerAbsent(devtools.port, validated)
      run.markChildStopped(receipt)
    }
  })
  if (peer) await attempt(async () => peer.close())
  return Object.freeze({ ok })
}

function createProductionBrowserAdapter(validated) {
  return Object.freeze({
    async observePhase({ phase, chrome, origin, profilePath, run, networkState }) {
      const parsedOrigin = new URL(origin)
      if (
        parsedOrigin.protocol !== 'http:'
        || parsedOrigin.hostname !== '127.0.0.1'
        || !/^[1-9][0-9]{0,4}$/u.test(parsedOrigin.port)
        || Number(parsedOrigin.port) === FORBIDDEN_PORT
        || parsedOrigin.pathname !== '/'
        || !isPlainObject(networkState)
        || networkState.externalAttempts !== 0
        || networkState.controlFailed !== false
      ) fail('STAGE3A_BROWSER_ORIGIN_INVALID', 'SAFETY_ABORT')
      await run.assertOwned()
      await validated.assert('chrome')
      await mkdir(profilePath, { mode: 0o700 })
      await requireOwnedDirectory(profilePath, run.browserRoot)
      const argv = buildChromeArgv(profilePath)
      const child = nodeSpawn(chrome, argv, {
        cwd: run.runRoot,
        env: run.environment,
        shell: false,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const closeWitness = createNodeCloseWitness(child)
      const capture = createCapture(child)
      const receipt = makeSpawnReceipt({
        kind: `chrome-${phase}`,
        executable: chrome,
        argv,
        run,
        environment: run.environment,
        child,
        closeWitness,
      })
      run.registerChild(receipt)
      let devtools
      let peer
      let page
      let primaryError
      try {
        await lsofCwd(receipt.pid, run.runRoot, validated)
        devtools = await waitForChromeDevTools(child, capture, profilePath)
        const listener = await lsofListener(receipt.pid, devtools.port, validated)
        const chromeListenerWitnessSha256 = sha256(canonical(listener))
        peer = await createCdpPeer(devtools.webSocketUrl)
        page = await createPageSession(peer, origin, networkState, phase)
        const observation = await observeMarkers(
          peer,
          page.sessionId,
          page.frameId,
          page.windowGuard,
          phase,
        )
        await page.settleNetwork()
        if (networkState.externalAttempts !== 0) fail('STAGE3A_EXTERNAL_NETWORK_ATTEMPT', 'FAIL')
        return Object.freeze({
          ...observation,
          externalNetworkAttempts: networkState.externalAttempts,
          chromeSpawnReceiptSha256: receipt.sha256,
          chromeListenerWitnessSha256,
        })
      } catch (error) {
        primaryError = error
        throw error
      } finally {
        const cleanup = await cleanupBrowserPhaseResources({
          page,
          peer,
          child,
          devtools,
          receipt,
          run,
          validated,
        })
        if (!cleanup.ok) {
          throw preferStage3aError(
            primaryError,
            new Stage3aRunnerError('STAGE3A_BROWSER_CLEANUP_FAILED', 'SAFETY_ABORT'),
          )
        }
      }
    },
  })
}

export function createProductionAdapters(validated) {
  return Object.freeze({
    executable: { verify: async () => { for (const key of ['node','dshCli','npmCli','pnpmNode','pnpmCli','chrome']) await validated.assert(key) } },
    workspace: {
      create: async () => createProductionWorkspace(validated),
      cleanup: async run => {
        const receipt = await cleanupProductionWorkspace(run)
        await ensureAbsent(run.runRoot)
        return { ...receipt, childCountAfterCleanup: run.activeChildren.size, listenerCountAfterCleanup: 0, runRootExistsAfterCleanup: false }
      },
    },
    package: { freeze: async args => freezeProductionPackage({ ...args, validated }) },
    profile: createProductionProfileAdapter(validated), runtime: createProductionRuntimeAdapter(validated), browser: createProductionBrowserAdapter(validated),
    verifier: verifyStage3aStorageSurfaceResult,
  })
}

export async function runStage3aCli(argv) {
  try {
    if (argv.length !== 14 || argv[12] !== '--result') fail('STAGE3A_INPUT_INVALID', 'SAFETY_ABORT')
    const output = argv[13]
    if (!path.isAbsolute(output) || path.normalize(output) !== output || await realpath(path.dirname(output)) !== path.dirname(output)) fail('STAGE3A_OUTPUT_INVALID', 'SAFETY_ABORT')
    await ensureAbsent(output)
    const inputs = parseStage3aArgs(argv.slice(0,12))
    const validated = await validateProductionInputs(inputs)
    const result = await executeStorageGate({ inputs, adapters: createProductionAdapters(validated) })
    await writeFile(output, JSON.stringify(result) + '\n', { flag: 'wx', mode: 0o600 })
    process.stdout.write(`STAGE3A_STORAGE_RUN=${result.outcome}\n`)
    return result.outcome === 'PASS' ? 0 : 1
  } catch { process.stderr.write('STAGE3A_STORAGE_RUN=BLOCKED\n'); return 1 }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = await runStage3aCli(process.argv.slice(2))
