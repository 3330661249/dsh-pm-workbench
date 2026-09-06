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

import { canonicalStage2Result } from './verify-stage-2-smoke-result.mjs'

export const STAGE2_PHASES = Object.freeze([
  'initial-enabled',
  'restart-enabled',
  'disabled',
  'removed',
  'readded',
])

const PLUGIN_NAME = '@knight/dsh-pm-workbench'
const PLUGIN_VERSION = '0.1.0'
const HARNESS_TARGET = '0.1.0-rc.6'
const FORBIDDEN_PORT = 3080
const LSOF_ENTRY = '/usr/sbin/lsof'
const OWNER_MARKER = '.dsh-stage-2-owner.json'
const DISABLE_PATCH_BYTES = '- id: dsh-pm-workbench\n  disabled: true\n'
const PACKAGE_PATCH_BYTES = "- insert:\n    - id: dsh-pm-workbench\n      name: '@knight/dsh-pm-workbench'\n"
const HASH_PATTERN = /^[0-9a-f]{64}$/
const RUN_PREFIX = 'dsh-pm-workbench-stage2-'
const MAX_CAPTURE_BYTES = 1024 * 1024
const MAX_FILE_BYTES = 1024 * 1024 * 1024
const MAX_TREE_ENTRIES = 200_000
const COMMAND_TIMEOUT_MS = 60_000
const START_TIMEOUT_MS = 30_000
const CDP_TIMEOUT_MS = 10_000
const QUIET_PERIOD_MS = 750
const PLUGIN_MARKERS = Object.freeze({
  launcher: '[data-dsh-pm-workbench="launcher"]',
  overlay: '[data-dsh-pm-workbench="overlay"]',
  increment: '[data-dsh-pm-workbench="increment"]',
  close: '[data-dsh-pm-workbench="close"]',
  counter: '[data-dsh-pm-workbench="counter"]',
})
const PHASE_EXPECTATIONS = Object.freeze({
  'initial-enabled': Object.freeze({ markerState: 'present', counters: [0, 1], focusRestored: true }),
  'restart-enabled': Object.freeze({ markerState: 'present', counters: [1], focusRestored: true }),
  disabled: Object.freeze({ markerState: 'absent', counters: [], focusRestored: false }),
  removed: Object.freeze({ markerState: 'absent', counters: [], focusRestored: false }),
  readded: Object.freeze({ markerState: 'present', counters: [1, 2], focusRestored: true }),
})
const OUTCOMES = new Set(['PASS', 'FAIL', 'INCONCLUSIVE', 'NEEDS_NETWORK_PERMISSION', 'SAFETY_ABORT'])

const execFileAsync = promisify(nodeExecFile)

export class Stage2RunnerError extends Error {
  constructor(code, outcome = 'INCONCLUSIVE') {
    super(code)
    this.name = 'Stage2RunnerError'
    this.stage2Code = code
    this.stage2Outcome = outcome
  }
}

function fail(code, outcome = 'INCONCLUSIVE') {
  throw new Stage2RunnerError(code, outcome)
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function canonical(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (typeof value !== 'object') fail('STAGE2_CANONICAL_VALUE_INVALID', 'SAFETY_ABORT')
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
}

function safeCode(error) {
  return typeof error?.stage2Code === 'string' && /^STAGE2_[A-Z0-9_]+$/.test(error.stage2Code)
    ? error.stage2Code
    : 'STAGE2_INTERNAL_FAILURE'
}

function safeOutcome(error) {
  return OUTCOMES.has(error?.stage2Outcome) ? error.stage2Outcome : 'INCONCLUSIVE'
}

function assertAbsolute(value) {
  if (typeof value !== 'string' || !path.isAbsolute(value) || value.includes('\0') || /[\r\n]/u.test(value)) {
    fail('STAGE2_INPUT_INVALID', 'SAFETY_ABORT')
  }
  return path.normalize(value)
}

export function parseStage2Args(argv, { processExecPath = process.execPath } = {}) {
  const flags = ['--node', '--dsh-cli', '--npm-cli', '--pnpm-node', '--pnpm-cli', '--chrome']
  if (!Array.isArray(argv) || argv.length !== flags.length * 2) fail('STAGE2_INPUT_INVALID', 'SAFETY_ABORT')
  const values = {}
  for (let index = 0; index < flags.length; index += 1) {
    if (argv[index * 2] !== flags[index]) fail('STAGE2_INPUT_INVALID', 'SAFETY_ABORT')
    values[flags[index].slice(2)] = assertAbsolute(argv[index * 2 + 1])
  }
  if (values.node !== path.normalize(processExecPath)) fail('STAGE2_NODE_MISMATCH', 'SAFETY_ABORT')
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
    if (tgzAbsolutePath !== undefined) fail('STAGE2_COMMAND_INVALID', 'SAFETY_ABORT')
    return ['plugin', '--profile', 'web', 'remove', PLUGIN_NAME]
  }
  fail('STAGE2_COMMAND_INVALID', 'SAFETY_ABORT')
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
  if (buffer.byteLength === 0 || buffer.byteLength > 512) fail('STAGE2_DEVTOOLS_FILE_INVALID', 'SAFETY_ABORT')
  const text = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  const match = /^(?<port>[1-9][0-9]{0,4})\n(?<browserPath>\/devtools\/browser\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\n?$/u.exec(text)
  if (!match?.groups) fail('STAGE2_DEVTOOLS_FILE_INVALID', 'SAFETY_ABORT')
  const port = Number(match.groups.port)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) fail('STAGE2_DEVTOOLS_FILE_INVALID', 'SAFETY_ABORT')
  if (port === FORBIDDEN_PORT) fail('STAGE2_FORBIDDEN_PORT', 'SAFETY_ABORT')
  return Object.freeze({
    port,
    browserPath: match.groups.browserPath,
    webSocketUrl: `ws://127.0.0.1:${port}${match.groups.browserPath}`,
  })
}

export function parseLsofListenerWitness(stdout, { pid, port }) {
  if (!Number.isSafeInteger(pid) || pid <= 0 || !Number.isInteger(port) || port <= 0 || port > 65_535) {
    fail('STAGE2_LISTENER_MISMATCH', 'SAFETY_ABORT')
  }
  const lines = String(stdout).split(/\r?\n/u).filter(Boolean)
  const pids = lines.filter((line) => line.startsWith('p')).map((line) => Number(line.slice(1)))
  const names = lines.filter((line) => line.startsWith('n')).map((line) => line.slice(1))
  if (pids.length !== 1 || pids[0] !== pid || names.length !== 1 || names[0] !== `127.0.0.1:${port}`) {
    fail('STAGE2_LISTENER_MISMATCH', 'SAFETY_ABORT')
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
    fail('STAGE2_CLEANUP_BOUNDARY_INVALID', 'SAFETY_ABORT')
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
    schemaVersion: '1',
    outcome: 'INCONCLUSIVE',
    harnessTarget: HARNESS_TARGET,
    plugin: { name: PLUGIN_NAME, version: PLUGIN_VERSION, tgzSha256: null },
    phases: [],
    process: {
      spawnReceipts: 0,
      listenerWitnesses: 0,
      allLoopback: true,
      allStopped: true,
      freshBrowserProfiles: 0,
    },
    network: { scope: 'browser-page-target', externalAttempts: 0 },
    cleanup: { renamed: false, revalidated: false, removed: false },
    failure: null,
  }
}

function validateObservation(phase, observation) {
  const expected = PHASE_EXPECTATIONS[phase]
  if (
    observation?.markerState !== expected.markerState
    || JSON.stringify(observation?.counters) !== JSON.stringify(expected.counters)
    || observation?.focusRestored !== expected.focusRestored
    || !Number.isSafeInteger(observation?.externalNetworkAttempts)
    || observation.externalNetworkAttempts < 0
  ) fail('STAGE2_OBSERVATION_MISMATCH', 'FAIL')
  if (observation.externalNetworkAttempts !== 0) fail('STAGE2_EXTERNAL_NETWORK_ATTEMPT', 'FAIL')
}

async function observeRuntimePhase({ phase, run, inputs, adapters, result, inventoryWitness, disable }) {
  let runtime
  let stopped = false
  try {
    runtime = await adapters.runtime.start({
      phase,
      inputs,
      run,
      disablePatchPath: disable ? run.disablePatchPath : undefined,
    })
    if (runtime?.port === FORBIDDEN_PORT) fail('STAGE2_FORBIDDEN_PORT', 'SAFETY_ABORT')
    if (
      !Number.isInteger(runtime?.port)
      || runtime.port < 1
      || runtime.port > 65_535
      || runtime.loopback !== true
      || !HASH_PATTERN.test(runtime.spawnReceiptSha256 ?? '')
      || !HASH_PATTERN.test(runtime.listenerWitnessSha256 ?? '')
      || runtime.origin !== `http://127.0.0.1:${String(runtime.port)}`
    ) fail('STAGE2_RUNTIME_WITNESS_INVALID', 'SAFETY_ABORT')

    const observation = await adapters.browser.observePhase({
      phase,
      chrome: inputs.chrome,
      origin: runtime.origin,
      profilePath: run.browserProfile(phase),
      run,
    })
    if (
      !HASH_PATTERN.test(observation?.chromeSpawnReceiptSha256 ?? '')
      || !HASH_PATTERN.test(observation?.chromeListenerWitnessSha256 ?? '')
    ) fail('STAGE2_BROWSER_WITNESS_INVALID', 'SAFETY_ABORT')
    result.network.externalAttempts += observation.externalNetworkAttempts
    validateObservation(phase, observation)

    await runtime.stop()
    stopped = true
    result.process.spawnReceipts += 2
    result.process.listenerWitnesses += 2
    result.phases.push({
      id: phase,
      markerState: observation.markerState,
      counters: [...observation.counters],
      focusRestored: observation.focusRestored,
      configWitness: disable ? 'disabled-patch' : 'none',
      inventoryWitness,
      externalNetworkAttempts: observation.externalNetworkAttempts,
      harnessSpawnReceiptSha256: runtime.spawnReceiptSha256,
      harnessListenerWitnessSha256: runtime.listenerWitnessSha256,
      chromeSpawnReceiptSha256: observation.chromeSpawnReceiptSha256,
      chromeListenerWitnessSha256: observation.chromeListenerWitnessSha256,
      loopback: true,
      stopped: true,
      browserProfileOrdinal: STAGE2_PHASES.indexOf(phase) + 1,
    })
    result.process.freshBrowserProfiles += 1
  } finally {
    if (runtime && !stopped) {
      try {
        await runtime.stop()
        stopped = true
      } catch {
        result.process.allStopped = false
        if (!result.failure) {
          result.outcome = 'SAFETY_ABORT'
          result.failure = { code: 'STAGE2_RUNTIME_STOP_FAILED' }
        }
      }
    }
  }
}

/**
 * @param {{
 *   inputs: Record<string, string>,
 *   adapters: any,
 *   emit?: (bytes: string) => void,
 * }} options
 */
export async function executeStage2Smoke({ inputs, adapters, emit = undefined }) {
  const result = emptyResult()
  let run
  try {
    run = await adapters.workspace.create({ inputs })
    const frozen = await adapters.package.freeze({ inputs, run })
    if (!HASH_PATTERN.test(frozen?.sha256 ?? '') || !path.isAbsolute(frozen?.tgzAbsolutePath ?? '')) {
      fail('STAGE2_PACKAGE_FREEZE_INVALID', 'SAFETY_ABORT')
    }
    result.plugin.tgzSha256 = frozen.sha256

    await adapters.profile.add({ inputs, run, tgzAbsolutePath: frozen.tgzAbsolutePath, sha256: frozen.sha256 })
    await adapters.profile.witness({ state: 'installed', inputs, run, sha256: frozen.sha256 })
    await observeRuntimePhase({
      phase: 'initial-enabled', run, inputs, adapters, result, inventoryWitness: 'installed', disable: false,
    })
    await observeRuntimePhase({
      phase: 'restart-enabled', run, inputs, adapters, result, inventoryWitness: 'installed', disable: false,
    })

    await adapters.profile.witness({ state: 'installed-disabled', inputs, run, sha256: frozen.sha256 })
    await observeRuntimePhase({
      phase: 'disabled', run, inputs, adapters, result, inventoryWitness: 'installed-disabled', disable: true,
    })

    await adapters.profile.remove({ inputs, run })
    await adapters.profile.witness({ state: 'removed', inputs, run })
    await observeRuntimePhase({
      phase: 'removed', run, inputs, adapters, result, inventoryWitness: 'removed', disable: false,
    })

    await adapters.profile.add({
      inputs,
      run,
      tgzAbsolutePath: frozen.tgzAbsolutePath,
      sha256: frozen.sha256,
      readd: true,
    })
    await adapters.profile.witness({ state: 'installed', inputs, run, sha256: frozen.sha256 })
    await observeRuntimePhase({
      phase: 'readded', run, inputs, adapters, result, inventoryWitness: 'installed', disable: false,
    })
    result.outcome = 'PASS'
  } catch (error) {
    if (result.failure === null) {
      result.outcome = safeOutcome(error)
      result.failure = { code: safeCode(error) }
    }
  } finally {
    if (run && result.process.allStopped) {
      try {
        result.cleanup = await adapters.workspace.cleanup(run)
      } catch {
        result.outcome = 'SAFETY_ABORT'
        result.failure = { code: 'STAGE2_CLEANUP_FAILED' }
        result.process.allStopped = false
        result.cleanup = { renamed: false, revalidated: false, removed: false }
      }
    } else if (run) {
      result.outcome = 'SAFETY_ABORT'
      result.failure = { code: 'STAGE2_RUNTIME_STOP_FAILED' }
      result.cleanup = { renamed: false, revalidated: false, removed: false }
    }
    if (result.outcome === 'PASS' && (
      result.process.spawnReceipts !== 10
      || result.process.listenerWitnesses !== 10
      || result.process.freshBrowserProfiles !== 5
      || result.cleanup.removed !== true
    )) {
      result.outcome = 'SAFETY_ABORT'
      result.failure = { code: 'STAGE2_CLOSURE_INCOMPLETE' }
    }
  }

  if (emit) emit(canonicalStage2Result(result))
  return result
}

function timeoutError(code, outcome = 'INCONCLUSIVE') {
  return new Stage2RunnerError(code, outcome)
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
  code = 'STAGE2_INPUT_IDENTITY_INVALID',
} = {}) {
  const absolute = assertAbsolute(file)
  const lexical = await lstat(absolute, { bigint: true }).catch(() => fail(code, 'SAFETY_ABORT'))
  if (!lexical.isFile() || lexical.isSymbolicLink()) fail(code, 'SAFETY_ABORT')
  const physical = await realpath(absolute).catch(() => fail(code, 'SAFETY_ABORT'))
  if (physical !== absolute) fail(code, 'SAFETY_ABORT')
  if (lexical.size < 0n || lexical.size > BigInt(maxBytes)) fail(code, 'SAFETY_ABORT')
  if (executable && (Number(lexical.mode) & 0o111) === 0) fail(code, 'SAFETY_ABORT')

  const handle = await open(absolute, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0))
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

async function readStableJson(file, code = 'STAGE2_MANIFEST_INVALID') {
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
    fail('STAGE2_INPUT_IDENTITY_DRIFT', 'SAFETY_ABORT')
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
  ) fail('STAGE2_TOOL_PACKAGE_INVALID', 'SAFETY_ABORT')
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
      fail('STAGE2_TOOL_OUTPUT_TOO_LARGE', 'SAFETY_ABORT')
    }
    return result
  } catch (error) {
    if (error instanceof Stage2RunnerError) throw error
    fail('STAGE2_TOOL_EXECUTION_INVALID', 'SAFETY_ABORT')
  }
}

export async function validateProductionInputs(inputs) {
  const expectedKeys = ['node', 'dshCli', 'npmCli', 'pnpmNode', 'pnpmCli', 'chrome']
  if (!inputs || Object.keys(inputs).sort().join(',') !== [...expectedKeys].sort().join(',')) {
    fail('STAGE2_INPUT_INVALID', 'SAFETY_ABORT')
  }
  if (inputs.node !== path.normalize(process.execPath)) fail('STAGE2_NODE_MISMATCH', 'SAFETY_ABORT')

  const receipts = Object.create(null)
  for (const key of expectedKeys) {
    receipts[key] = await readStableFile(inputs[key], {
      executable: key === 'node' || key === 'pnpmNode' || key === 'chrome',
      maxBytes: key === 'chrome' || key === 'node' || key === 'pnpmNode' ? MAX_FILE_BYTES : 64 * 1024 * 1024,
    })
  }
  receipts.lsof = await readStableFile(LSOF_ENTRY, { executable: true, maxBytes: 64 * 1024 * 1024 })

  const toolPackages = Object.freeze({
    dshCli: await verifyPackageEntry(inputs.dshCli, {
      name: '@deepseek-ai/dsh', version: HARNESS_TARGET, binName: 'dsh',
    }),
    npmCli: await verifyPackageEntry(inputs.npmCli, { name: 'npm', binName: 'npm' }),
    pnpmCli: await verifyPackageEntry(inputs.pnpmCli, { name: 'pnpm', binName: 'pnpm' }),
  })

  const [nodeVersion, pnpmNodeVersion, dshVersion, npmVersion, pnpmVersion, chromeVersion] = await Promise.all([
    boundedExec(inputs.node, ['--version']),
    boundedExec(inputs.pnpmNode, ['--version']),
    boundedExec(inputs.node, [inputs.dshCli, '--version']),
    boundedExec(inputs.node, [inputs.npmCli, '--version']),
    boundedExec(inputs.pnpmNode, [inputs.pnpmCli, '--version']),
    boundedExec(inputs.chrome, ['--version']),
  ])
  if (nodeVersion.stdout.trim() !== process.version || !/^v\d+\.\d+\.\d+/u.test(pnpmNodeVersion.stdout.trim())) {
    fail('STAGE2_NODE_VERSION_INVALID', 'SAFETY_ABORT')
  }
  if (dshVersion.stdout.trim() !== HARNESS_TARGET) fail('STAGE2_DSH_VERSION_INVALID', 'SAFETY_ABORT')
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(npmVersion.stdout.trim())) {
    fail('STAGE2_NPM_VERSION_INVALID', 'SAFETY_ABORT')
  }
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/u.test(pnpmVersion.stdout.trim())) {
    fail('STAGE2_PNPM_VERSION_INVALID', 'SAFETY_ABORT')
  }
  if (!/^(?:Google Chrome|Chromium) \d+(?:\.\d+){1,3}$/u.test(chromeVersion.stdout.trim())) {
    fail('STAGE2_CHROME_VERSION_INVALID', 'SAFETY_ABORT')
  }

  const versions = Object.freeze({
    node: nodeVersion.stdout.trim(),
    pnpmNode: pnpmNodeVersion.stdout.trim(),
    dshCli: dshVersion.stdout.trim(),
    npmCli: npmVersion.stdout.trim(),
    pnpmCli: pnpmVersion.stdout.trim(),
    chrome: chromeVersion.stdout.trim(),
  })

  return Object.freeze({
    inputs,
    receipts: Object.freeze(receipts),
    async assert(key) {
      const expected = receipts[key]
      if (!expected) fail('STAGE2_INPUT_INVALID', 'SAFETY_ABORT')
      const observed = await assertSameFileIdentity(expected, {
        executable: key === 'node' || key === 'pnpmNode' || key === 'chrome' || key === 'lsof',
        maxBytes: key === 'chrome' || key === 'node' || key === 'pnpmNode' ? MAX_FILE_BYTES : 64 * 1024 * 1024,
      })
      if (toolPackages[key]) {
        await assertSameFileIdentity(toolPackages[key].manifest, {
          maxBytes: MAX_CAPTURE_BYTES,
          includeBytes: true,
        })
      }
      let version
      if (key === 'node') version = (await boundedExec(inputs.node, ['--version'])).stdout.trim()
      else if (key === 'pnpmNode') version = (await boundedExec(inputs.pnpmNode, ['--version'])).stdout.trim()
      else if (key === 'dshCli') version = (await boundedExec(inputs.node, [inputs.dshCli, '--version'])).stdout.trim()
      else if (key === 'npmCli') version = (await boundedExec(inputs.node, [inputs.npmCli, '--version'])).stdout.trim()
      else if (key === 'pnpmCli') version = (await boundedExec(inputs.pnpmNode, [inputs.pnpmCli, '--version'])).stdout.trim()
      else if (key === 'chrome') version = (await boundedExec(inputs.chrome, ['--version'])).stdout.trim()
      if (version !== undefined && version !== versions[key]) fail('STAGE2_TOOL_VERSION_DRIFT', 'SAFETY_ABORT')
      return observed
    },
  })
}

function pathInside(root, target) {
  const relative = path.relative(root, target)
  return relative !== '' && relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
}

function inventoryPathValid(value) {
  if (value === '.') return true
  if (typeof value !== 'string' || value.length === 0 || value.length > 4096) return false
  if (value.includes('\0') || /[\r\n]/u.test(value) || value.startsWith('/') || value.includes('\\')) return false
  const parts = value.split('/')
  return parts.every((part) => part !== '' && part !== '.' && part !== '..')
}

function inventoryInteger(value) {
  return typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/u.test(value)
}

export function validateTreeClosureInventory(inventory) {
  if (!Array.isArray(inventory) || inventory.length === 0 || inventory.length > MAX_TREE_ENTRIES) {
    fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
  }
  const paths = new Set()
  const hardlinks = new Map()
  let rootDevice = null
  let previousPath = null
  for (const entry of inventory) {
    if (!entry || typeof entry !== 'object' || !inventoryPathValid(entry.path)) {
      fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    }
    const keys = Object.keys(entry).sort()
    const expectedKeys = (entry.kind === 'symlink'
      ? ['dev', 'ino', 'kind', 'mode', 'nlink', 'path', 'size', 'target']
      : ['dev', 'ino', 'kind', 'mode', 'nlink', 'path', 'size']).sort()
    if (keys.length !== expectedKeys.length || keys.some((key, index) => key !== expectedKeys[index])) {
      if (entry.kind !== 'directory' && entry.kind !== 'file' && entry.kind !== 'symlink') {
        fail('STAGE2_TREE_SPECIAL_FILE', 'SAFETY_ABORT')
      }
      fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    }
    if (entry.kind !== 'directory' && entry.kind !== 'file' && entry.kind !== 'symlink') {
      fail('STAGE2_TREE_SPECIAL_FILE', 'SAFETY_ABORT')
    }
    for (const key of ['dev', 'ino', 'mode', 'nlink', 'size']) {
      if (!inventoryInteger(entry[key])) fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    }
    if (entry.kind === 'symlink' && (
      typeof entry.target !== 'string'
      || entry.target.length === 0
      || entry.target.length > 4096
      || entry.target.includes('\0')
      || /[\r\n]/u.test(entry.target)
    )) fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    if (paths.has(entry.path) || (previousPath !== null && entry.path.localeCompare(previousPath, 'en') <= 0)) {
      fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    }
    paths.add(entry.path)
    previousPath = entry.path
    if (entry.path === '.') rootDevice = entry.dev
    if (entry.kind === 'directory' && rootDevice !== null && entry.dev !== rootDevice) {
      fail('STAGE2_TREE_CROSS_DEVICE', 'SAFETY_ABORT')
    }
    if (entry.kind === 'file') {
      const identity = `${entry.dev}:${entry.ino}`
      const group = hardlinks.get(identity) ?? { count: 0, nlink: entry.nlink }
      if (group.nlink !== entry.nlink) fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
      group.count += 1
      hardlinks.set(identity, group)
    }
  }
  if (inventory[0].path !== '.' || inventory[0].kind !== 'directory') {
    fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
  }
  for (const group of hardlinks.values()) {
    if (BigInt(group.count) !== BigInt(group.nlink)) fail('STAGE2_TREE_HARDLINK_ESCAPE', 'SAFETY_ABORT')
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
    if (inventory.length >= MAX_TREE_ENTRIES) fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
    const stats = await lstat(absolute, { bigint: true }).catch(() => fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT'))
    if (stats.isSymbolicLink()) {
      const target = await readlink(absolute)
      inventory.push(treeEntry(relative, stats, 'symlink', target))
      return
    }
    if (stats.isFile()) {
      inventory.push(treeEntry(relative, stats, 'file'))
      return
    }
    if (!stats.isDirectory()) fail('STAGE2_TREE_SPECIAL_FILE', 'SAFETY_ABORT')
    inventory.push(treeEntry(relative, stats, 'directory'))
    const names = await readdir(absolute)
    names.sort((left, right) => left.localeCompare(right, 'en'))
    for (const name of names) {
      if (name === '.' || name === '..' || name.includes('/') || name.includes('\0')) {
        fail('STAGE2_TREE_INVENTORY_INVALID', 'SAFETY_ABORT')
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
  if (canonical(before) !== canonical(after)) fail('STAGE2_TREE_INVENTORY_DRIFT', 'SAFETY_ABORT')
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
    if ((result?.stdout ?? '') !== '') fail('STAGE2_OPEN_HANDLE_REMAINS', 'SAFETY_ABORT')
    fail('STAGE2_OPEN_HANDLE_UNPROVED', 'SAFETY_ABORT')
  } catch (error) {
    if (error instanceof Stage2RunnerError) throw error
    if (strictNoMatch(error)) return true
    fail('STAGE2_OPEN_HANDLE_UNPROVED', 'SAFETY_ABORT')
  }
}

async function requireOwnedDirectory(directory, parent) {
  const stats = await lstat(directory, { bigint: true }).catch(() => fail('STAGE2_OWNERSHIP_INVALID', 'SAFETY_ABORT'))
  if (!stats.isDirectory() || stats.isSymbolicLink() || !pathInside(parent, directory)) {
    fail('STAGE2_OWNERSHIP_INVALID', 'SAFETY_ABORT')
  }
  const physical = await realpath(directory)
  if (physical !== directory) fail('STAGE2_OWNERSHIP_INVALID', 'SAFETY_ABORT')
  return directoryReceipt(stats)
}

async function ensureAbsent(target, code = 'STAGE2_OWNERSHIP_INVALID') {
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
      if (entry.isSymbolicLink()) fail('STAGE2_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
      if (entry.isDirectory()) await visit(absolute, relative)
      else if (entry.isFile()) found.push(relative)
      else fail('STAGE2_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
    }
  }
  await visit(root)
  return found
}

async function createProductionWorkspace(validated) {
  const tempParent = await realpath(tmpdir())
  const parentStats = await lstat(tempParent, { bigint: true })
  if (!parentStats.isDirectory() || parentStats.isSymbolicLink()) fail('STAGE2_TEMP_ROOT_INVALID', 'SAFETY_ABORT')
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
    if (!markerReceipt.bytes.equals(markerBytes)) fail('STAGE2_OWNERSHIP_INVALID', 'SAFETY_ABORT')

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
    if (shimReceipt.bytes.toString('utf8') !== shimBytes) fail('STAGE2_SHIM_INVALID', 'SAFETY_ABORT')

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
        if (!STAGE2_PHASES.includes(phase)) fail('STAGE2_PHASE_INVALID', 'SAFETY_ABORT')
        return path.join(browserRoot, phase)
      },
      async assertOwned(candidate = runRoot) {
        const parentNow = directoryReceipt(await lstat(tempParent, { bigint: true }))
        if (!sameReceipt(parentNow, parentReceipt)) fail('STAGE2_OWNERSHIP_DRIFT', 'SAFETY_ABORT')
        const rootNow = await requireOwnedDirectory(candidate, tempParent)
        if (!sameReceipt(rootNow, rootReceipt)) fail('STAGE2_OWNERSHIP_DRIFT', 'SAFETY_ABORT')
        const markerNow = await readStableFile(path.join(candidate, OWNER_MARKER), { maxBytes: 4096, includeBytes: true })
        if (
          markerNow.sha256 !== markerReceipt.sha256
          || !sameReceipt(markerNow.identity, markerReceipt.identity)
          || !markerNow.bytes.equals(markerBytes)
        ) fail('STAGE2_OWNERSHIP_DRIFT', 'SAFETY_ABORT')
      },
      async assertShim() {
        await run.assertOwned()
        const shimNow = await readStableFile(shimPath, { maxBytes: 4096, includeBytes: true, executable: true })
        if (
          shimNow.sha256 !== shimReceipt.sha256
          || !sameReceipt(shimNow.identity, shimReceipt.identity)
          || shimNow.bytes.toString('utf8') !== shimBytes
        ) fail('STAGE2_SHIM_DRIFT', 'SAFETY_ABORT')
      },
      registerChild(receipt) {
        if (!receipt?.child || activeChildren.has(receipt)) fail('STAGE2_PROCESS_REGISTRY_INVALID', 'SAFETY_ABORT')
        activeChildren.add(receipt)
      },
      markChildStopped(receipt) {
        if (
          !activeChildren.has(receipt)
          || (receipt.child.exitCode === null && receipt.child.signalCode === null)
        ) fail('STAGE2_PROCESS_REGISTRY_INVALID', 'SAFETY_ABORT')
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
      throw new Stage2RunnerError('STAGE2_WORKSPACE_CREATE_CLEANUP_FAILED', 'SAFETY_ABORT')
    }
    throw error
  }
}

async function cleanupProductionWorkspace(run) {
  if (!(run.activeChildren instanceof Set) || run.activeChildren.size !== 0) {
    fail('STAGE2_LIVE_CHILD_UNCERTAIN', 'SAFETY_ABORT')
  }
  await run.assertOwned()
  const beforeInventory = await inventoryOwnedTree(run.runRoot)
  await proveNoOpenHandles(run.runRoot, run.validated)
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
      await rm(candidate, { recursive: true, force: false, maxRetries: 0 })
    },
    assertAbsent: async (candidate) => {
      await ensureAbsent(candidate, 'STAGE2_CLEANUP_ABSENCE_INVALID')
      await ensureAbsent(run.runRoot, 'STAGE2_CLEANUP_ABSENCE_INVALID')
      const parentNow = directoryReceipt(await lstat(run.tempParent, { bigint: true }))
      if (!sameReceipt(parentNow, run.parentReceipt)) fail('STAGE2_OWNERSHIP_DRIFT', 'SAFETY_ABORT')
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
  ) fail('STAGE2_PACKAGE_VERIFICATION_INVALID', 'SAFETY_ABORT')
  const receiptPaths = verification.files.map((file) => file?.path)
  if (JSON.stringify(receiptPaths) !== JSON.stringify(allowlist)) {
    fail('STAGE2_PACKAGE_ALLOWLIST_INVALID', 'SAFETY_ABORT')
  }

  for (const outputPath of outputHashKeys) {
    const outputFile = verification.files.find((file) => file?.path === outputPath)
    if (
      !HASH_PATTERN.test(verification.outputHashes[outputPath] ?? '')
      || outputFile?.sha256 !== verification.outputHashes[outputPath]
    ) fail('STAGE2_BUILD_OUTPUT_HASH_INVALID', 'SAFETY_ABORT')
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
    ) fail('STAGE2_PACKAGE_RECEIPT_INVALID', 'SAFETY_ABORT')
  }

  const packageFile = verification.files.find((file) => file.path === 'package.json')
  let manifest
  try {
    manifest = JSON.parse(packageFile.bytes.toString('utf8'))
  } catch {
    fail('STAGE2_PACKAGE_MANIFEST_INVALID', 'SAFETY_ABORT')
  }
  for (const lifecycle of ['prepublish', 'prepare', 'prepack', 'postpack']) {
    if (Object.hasOwn(manifest.scripts ?? {}, lifecycle)) fail('STAGE2_PACKAGE_LIFECYCLE_FORBIDDEN', 'SAFETY_ABORT')
  }
  return verification
}

function permissionMode(value) {
  if (!Number.isSafeInteger(value) || value < 0) fail('STAGE2_FILE_MODE_INVALID', 'SAFETY_ABORT')
  return value & 0o777
}

export function validatePackedMetadataAgainstVerification(metadata, verification) {
  if (!Array.isArray(metadata?.files) || !Array.isArray(verification?.files)) {
    fail('STAGE2_PACK_METADATA_DRIFT', 'SAFETY_ABORT')
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
  if (canonical(actual) !== canonical(expected)) fail('STAGE2_PACK_METADATA_DRIFT', 'SAFETY_ABORT')
  return metadata
}

export function validateObservedPackageFile(observed, expected, code = 'STAGE2_PROFILE_WITNESS_INVALID') {
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
    if (!pathInside(run.packageSourceRoot, destination)) fail('STAGE2_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
    await writeFile(destination, file.bytes, { flag: 'wx', mode: file.mode & 0o777 })
    await chmod(destination, file.mode & 0o777)
    const staged = await readStableFile(destination, { maxBytes: 64 * 1024 * 1024, includeBytes: true })
    const stagedMode = Number(BigInt(staged.identity.mode) & 0o777n)
    if (staged.sha256 !== file.sha256 || staged.bytes.byteLength !== file.size || stagedMode !== (file.mode & 0o777)) {
      fail('STAGE2_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
    }
  }
  const stagedPaths = await listTreeFiles(run.packageSourceRoot)
  if (JSON.stringify(stagedPaths) !== JSON.stringify(allowlist)) {
    fail('STAGE2_PACKAGE_STAGE_INVALID', 'SAFETY_ABORT')
  }
  return verification
}

async function revalidateStagedPackage(run, verification, allowlist) {
  const stagedPaths = await listTreeFiles(run.packageSourceRoot)
  if (JSON.stringify(stagedPaths) !== JSON.stringify(allowlist)) {
    fail('STAGE2_PACKAGE_STAGE_DRIFT', 'SAFETY_ABORT')
  }
  for (const file of verification.files) {
    const staged = path.join(run.packageSourceRoot, ...file.path.split('/'))
    if (!pathInside(run.packageSourceRoot, staged)) fail('STAGE2_PACKAGE_STAGE_DRIFT', 'SAFETY_ABORT')
    const observed = await readStableFile(staged, { maxBytes: 64 * 1024 * 1024 })
    validateObservedPackageFile(observed, file, 'STAGE2_PACKAGE_STAGE_DRIFT')
  }
}

async function freezeProductionPackage({ inputs, run, validated }) {
  await run.assertOwned()
  await assertPackToolProvenance(validated)
  let buildModule
  let verifierModule
  let packModule
  try {
    [buildModule, verifierModule, packModule] = await Promise.all([
      import('../packages/workbench/build.mjs'),
      import('./verify-package.mjs'),
      import('./pack-dry.mjs'),
    ])
  } catch {
    fail('STAGE2_PACKAGE_ADAPTER_UNAVAILABLE')
  }
  const {
    buildPackableWorkbench,
  } = buildModule
  const {
    WORKBENCH_PACKAGE_FILES,
    verifyBuiltWorkbenchPackage,
  } = verifierModule
  const { runNpmPack } = packModule
  if (
    typeof buildPackableWorkbench !== 'function'
    || typeof verifyBuiltWorkbenchPackage !== 'function'
    || typeof runNpmPack !== 'function'
    || !Array.isArray(WORKBENCH_PACKAGE_FILES)
  ) fail('STAGE2_PACKAGE_ADAPTER_UNAVAILABLE')

  let buildEvidence
  let verification
  try {
    buildEvidence = await buildPackableWorkbench()
    verification = await verifyBuiltWorkbenchPackage({ buildEvidence })
    await stageVerifiedPackage(run, verification, WORKBENCH_PACKAGE_FILES)
    await revalidateStagedPackage(run, verification, WORKBENCH_PACKAGE_FILES)
  } catch (error) {
    if (error instanceof Stage2RunnerError) throw error
    fail('STAGE2_PACKAGE_FREEZE_FAILED')
  }
  run.frozenPackageReceipt = verification

  let packed
  try {
    await assertPackToolProvenance(validated)
    packed = await runNpmPack({
      nodeExecutable: inputs.node,
      npmCliPath: inputs.npmCli,
      stagedPackageRoot: run.packageSourceRoot,
      operationRoot: run.packRoot,
      dryRun: false,
    })
  } catch (error) {
    if (error instanceof Stage2RunnerError) throw error
    fail('STAGE2_NPM_PACK_FAILED')
  }
  await revalidateStagedPackage(run, verification, WORKBENCH_PACKAGE_FILES)
  if (
    !packed
    || !path.isAbsolute(packed.tgzAbsolutePath ?? '')
    || !HASH_PATTERN.test(packed.sha256 ?? '')
    || !packed.metadata
  ) fail('STAGE2_PACKAGE_FREEZE_INVALID', 'SAFETY_ABORT')
  validatePackedMetadataAgainstVerification(packed.metadata, verification)
  const physicalRunRoot = await realpath(run.runRoot)
  const physicalTgz = await realpath(packed.tgzAbsolutePath).catch(() => fail('STAGE2_PACKAGE_FREEZE_INVALID', 'SAFETY_ABORT'))
  if (!pathInside(physicalRunRoot, physicalTgz) || physicalTgz !== packed.tgzAbsolutePath) {
    fail('STAGE2_PACKAGE_FREEZE_INVALID', 'SAFETY_ABORT')
  }
  const tgzReceipt = await readStableFile(physicalTgz, { maxBytes: 256 * 1024 * 1024 })
  if (tgzReceipt.sha256 !== packed.sha256) fail('STAGE2_PACKAGE_FREEZE_INVALID', 'SAFETY_ABORT')
  run.frozenTgz = Object.freeze({
    tgzAbsolutePath: physicalTgz,
    sha256: packed.sha256,
    receipt: tgzReceipt,
  })
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

async function waitForChildExit(child, milliseconds, timeoutCode) {
  if (child.exitCode !== null || child.signalCode !== null) return
  await withTimeout(new Promise((resolve, reject) => {
    const done = () => { resolve() }
    const failed = () => { reject(timeoutError('STAGE2_CHILD_PROCESS_ERROR')) }
    child.once('close', done)
    child.once('error', failed)
  }), milliseconds, timeoutCode)
}

async function lsofCwd(pid, expectedCwd, validated) {
  await validated.assert('lsof')
  const { stdout } = await boundedExec(LSOF_ENTRY, ['-nP', '-a', '-p', String(pid), '-d', 'cwd', '-Fpn'])
  const pids = stdout.split(/\r?\n/u).filter((line) => line.startsWith('p')).map((line) => Number(line.slice(1)))
  const names = stdout.split(/\r?\n/u).filter((line) => line.startsWith('n')).map((line) => line.slice(1))
  if (pids.length !== 1 || pids[0] !== pid || names.length !== 1 || names[0] !== expectedCwd) {
    fail('STAGE2_PROCESS_CWD_MISMATCH', 'SAFETY_ABORT')
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

async function assertListenerAbsent(port, validated) {
  await validated.assert('lsof')
  try {
    const { stdout } = await execFileAsync(LSOF_ENTRY, [
      '-nP', `-iTCP:${String(port)}`, '-sTCP:LISTEN', '-Fpn',
    ], {
      shell: false,
      encoding: 'utf8',
      maxBuffer: MAX_CAPTURE_BYTES,
      timeout: COMMAND_TIMEOUT_MS,
      env: Object.freeze({ LANG: 'C', LC_ALL: 'C', NO_COLOR: '1' }),
    })
    if (stdout !== '') fail('STAGE2_LISTENER_REMAINED', 'SAFETY_ABORT')
    fail('STAGE2_LISTENER_ABSENCE_UNPROVED', 'SAFETY_ABORT')
  } catch (error) {
    if (error instanceof Stage2RunnerError) throw error
    if (strictNoMatch(error)) return
    fail('STAGE2_LISTENER_ABSENCE_UNPROVED', 'SAFETY_ABORT')
  }
}

function makeSpawnReceipt({ kind, executable, argv, run, environment, child }) {
  if (!Number.isSafeInteger(child.pid) || child.pid <= 0) fail('STAGE2_SPAWN_INVALID', 'SAFETY_ABORT')
  const receipt = {
    kind,
    executable,
    argv: [...argv],
    cwd: run.runRoot,
    environmentSha256: sha256(canonical(environment)),
    marker: run.runId,
    pid: child.pid,
    child,
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
  ) fail('STAGE2_PROCESS_IDENTITY_MISMATCH', 'SAFETY_ABORT')
  await run.assertOwned()
  await lsofCwd(receipt.pid, run.runRoot, validated)
  if (listenerPort !== undefined) await lsofListener(receipt.pid, listenerPort, validated)
}

async function stopRetainedChild(receipt, { run, validated, listenerPort }) {
  await assertLiveChild(receipt, { run, validated, listenerPort })
  if (!receipt.child.kill('SIGTERM')) fail('STAGE2_PROCESS_SIGNAL_FAILED', 'SAFETY_ABORT')
  try {
    await waitForChildExit(receipt.child, 10_000, 'STAGE2_PROCESS_STOP_TIMEOUT')
  } catch (error) {
    if (error?.stage2Code !== 'STAGE2_PROCESS_STOP_TIMEOUT') throw error
    await assertLiveChild(receipt, { run, validated, listenerPort })
    if (!receipt.child.kill('SIGKILL')) fail('STAGE2_PROCESS_SIGNAL_FAILED', 'SAFETY_ABORT')
    await waitForChildExit(receipt.child, 10_000, 'STAGE2_PROCESS_KILL_TIMEOUT')
  }
  if (listenerPort !== undefined) await assertListenerAbsent(listenerPort, validated)
  run.markChildStopped(receipt)
}

async function stopIncompleteChild(receipt, { run, validated }) {
  if (receipt.child.exitCode !== null || receipt.child.signalCode !== null) return
  await assertLiveChild(receipt, { run, validated })
  if (!receipt.child.kill('SIGTERM')) fail('STAGE2_PROCESS_SIGNAL_FAILED', 'SAFETY_ABORT')
  await waitForChildExit(receipt.child, 10_000, 'STAGE2_PROCESS_STOP_TIMEOUT')
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
  const capture = createCapture(child)
  const receipt = makeSpawnReceipt({
    kind: 'profile-command', executable: inputs.node, argv: childArgs, run, environment: run.pluginEnvironment, child,
  })
  run.registerChild(receipt)
  try {
    await waitForChildExit(child, COMMAND_TIMEOUT_MS, 'STAGE2_PROFILE_COMMAND_TIMEOUT')
  } catch (error) {
    if (child.exitCode === null && child.signalCode === null) {
      await stopIncompleteChild(receipt, { run, validated })
    }
    throw error
  }
  const disposition = classifyProfileExit({
    exitCode: child.exitCode,
    signalCode: child.signalCode,
    captureError: capture.error,
    overflow: capture.overflow,
  })
  if (disposition === 'uncertain') {
    if (capture.overflow) fail('STAGE2_TOOL_OUTPUT_TOO_LARGE', 'SAFETY_ABORT')
    fail('STAGE2_PROFILE_DESCENDANT_UNCERTAIN', 'SAFETY_ABORT')
  }
  if (disposition === 'negative-witness') {
    await proveNoOpenHandles(run.runRoot, validated)
    run.markChildStopped(receipt)
    const output = `${capture.stdout}\n${capture.stderr}`
    if (/ERR_PNPM_NO_OFFLINE_(?:META|TARBALL)|ERR_PNPM_FETCH_404/u.test(output)) {
      fail('STAGE2_OFFLINE_DEPENDENCY_MISSING', 'NEEDS_NETWORK_PERMISSION')
    }
    fail('STAGE2_PROFILE_COMMAND_FAILED')
  }
  run.markChildStopped(receipt)
  return Object.freeze({ spawnReceiptSha256: receipt.sha256 })
}

async function assertFrozenTgz(run) {
  if (!run.frozenTgz) fail('STAGE2_PACKAGE_FREEZE_INVALID', 'SAFETY_ABORT')
  const observed = await assertSameFileIdentity(run.frozenTgz.receipt, { maxBytes: 256 * 1024 * 1024 })
  if (observed.sha256 !== run.frozenTgz.sha256) fail('STAGE2_PACKAGE_IDENTITY_DRIFT', 'SAFETY_ABORT')
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
  ) fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  const dependencyPath = path.resolve(profileDir, dependency.slice('file:'.length))
  if (dependencyPath !== run.frozenTgz.tgzAbsolutePath) {
    fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }

  const lexicalPackageRoot = path.join(profileDir, 'node_modules', '@knight', 'dsh-pm-workbench')
  const lexicalStats = await lstat(lexicalPackageRoot, { bigint: true }).catch(() => fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT'))
  if (!lexicalStats.isDirectory() && !lexicalStats.isSymbolicLink()) {
    fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
  if (lexicalStats.isSymbolicLink()) {
    const target = await readlink(lexicalPackageRoot)
    const lexicalTarget = path.resolve(path.dirname(lexicalPackageRoot), target)
    if (!pathInside(run.runRoot, lexicalTarget)) fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
  const packageRoot = await realpath(lexicalPackageRoot)
  if (!pathInside(run.runRoot, packageRoot)) fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')

  const receipt = run.frozenPackageReceipt
  if (!receipt || !Array.isArray(receipt.files)) fail('STAGE2_PACKAGE_RECEIPT_INVALID', 'SAFETY_ABORT')
  const installedInventory = await listTreeFiles(packageRoot)
  if (JSON.stringify(installedInventory) !== JSON.stringify(receipt.files.map((file) => file.path))) {
    fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
  for (const file of receipt.files) {
    const installed = path.join(packageRoot, ...file.path.split('/'))
    if (!pathInside(packageRoot, installed)) fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
    const observed = await readStableFile(installed, { maxBytes: 64 * 1024 * 1024 })
    validateObservedPackageFile(observed, file)
  }
  const installedManifest = await readStableJson(path.join(packageRoot, 'package.json'))
  if (
    installedManifest.value.name !== PLUGIN_NAME
    || installedManifest.value.version !== PLUGIN_VERSION
    || installedManifest.value.dsh?.bundle?.patch !== './cordis.patch.yml'
  ) fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  const installedPatch = await readStableFile(path.join(packageRoot, 'cordis.patch.yml'), {
    maxBytes: 4096,
    includeBytes: true,
  })
  if (installedPatch.bytes.toString('utf8') !== PACKAGE_PATCH_BYTES) {
    fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
}

async function assertRemovedPackage(run) {
  const profileDir = path.join(run.dshHome, 'profiles', 'web')
  const profile = await readStableJson(path.join(profileDir, 'package.json'))
  const bundles = profile.value.dsh?.profile?.bundles ?? []
  if (Object.hasOwn(profile.value.dependencies ?? {}, PLUGIN_NAME) || bundles.includes(PLUGIN_NAME)) {
    fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
  }
  await ensureAbsent(
    path.join(profileDir, 'node_modules', '@knight', 'dsh-pm-workbench'),
    'STAGE2_PROFILE_WITNESS_INVALID',
  )
}

function createProductionProfileAdapter(validated) {
  return Object.freeze({
    async add({ inputs, run, tgzAbsolutePath, sha256: digest }) {
      if (
        tgzAbsolutePath !== run.frozenTgz?.tgzAbsolutePath
        || digest !== run.frozenTgz?.sha256
      ) fail('STAGE2_PACKAGE_IDENTITY_DRIFT', 'SAFETY_ABORT')
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
        fail('STAGE2_PROFILE_WITNESS_INVALID', 'SAFETY_ABORT')
      }
      if (digest !== run.frozenTgz?.sha256) fail('STAGE2_PACKAGE_IDENTITY_DRIFT', 'SAFETY_ABORT')
      await assertFrozenTgz(run)
      await assertInstalledPackage(run)
      if (state === 'installed-disabled') {
        const patch = await readStableFile(run.disablePatchPath, { maxBytes: 4096, includeBytes: true })
        if (patch.bytes.toString('utf8') !== DISABLE_PATCH_BYTES) {
          fail('STAGE2_DISABLE_PATCH_INVALID', 'SAFETY_ABORT')
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
    if (capture.overflow) fail('STAGE2_TOOL_OUTPUT_TOO_LARGE', 'SAFETY_ABORT')
    if (capture.error) fail('STAGE2_HARNESS_START_FAILED')
    const match = pattern.exec(capture.stdout)
    if (match?.groups?.port) {
      const port = Number(match.groups.port)
      if (!Number.isInteger(port) || port > 65_535) fail('STAGE2_HARNESS_URL_INVALID', 'SAFETY_ABORT')
      if (port === FORBIDDEN_PORT) fail('STAGE2_FORBIDDEN_PORT', 'SAFETY_ABORT')
      return Object.freeze({ port, origin: match.groups.origin })
    }
    if (child.exitCode !== null || child.signalCode !== null) fail('STAGE2_HARNESS_START_FAILED')
    await delay(25)
  }
  fail('STAGE2_HARNESS_START_TIMEOUT')
}

function createProductionRuntimeAdapter(validated) {
  return Object.freeze({
    async start({ phase, inputs, run, disablePatchPath }) {
      await run.assertOwned()
      await validated.assert('node')
      await validated.assert('dshCli')
      if (disablePatchPath !== undefined && disablePatchPath !== run.disablePatchPath) {
        fail('STAGE2_DISABLE_PATCH_INVALID', 'SAFETY_ABORT')
      }
      const argv = [inputs.dshCli, ...buildHarnessInvocation(disablePatchPath)]
      const child = nodeSpawn(inputs.node, argv, {
        cwd: run.runRoot,
        env: run.environment,
        shell: false,
        detached: false,
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      const capture = createCapture(child)
      const receipt = makeSpawnReceipt({
        kind: `harness-${phase}`,
        executable: inputs.node,
        argv,
        run,
        environment: run.environment,
        child,
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
        if (child.exitCode === null && child.signalCode === null) {
          try {
            if (port !== undefined) await stopRetainedChild(receipt, { run, validated, listenerPort: port })
            else await stopIncompleteChild(receipt, { run, validated })
          } catch {
            throw new Stage2RunnerError('STAGE2_RUNTIME_START_CLEANUP_FAILED', 'SAFETY_ABORT')
          }
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
    if (capture.overflow) fail('STAGE2_TOOL_OUTPUT_TOO_LARGE', 'SAFETY_ABORT')
    if (capture.error) fail('STAGE2_CHROME_START_FAILED')
    if (child.exitCode !== null || child.signalCode !== null) fail('STAGE2_CHROME_START_FAILED')
    const stderrMatch = stderrPattern.exec(capture.stderr)
    let activePort
    try {
      const read = await readStableFile(activePortPath, { maxBytes: 512, includeBytes: true })
      activePort = parseDevToolsActivePort(read.bytes)
    } catch (error) {
      if (error instanceof Stage2RunnerError && error.stage2Code === 'STAGE2_FORBIDDEN_PORT') throw error
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
      ) fail('STAGE2_DEVTOOLS_WITNESS_MISMATCH', 'SAFETY_ABORT')
      const lexical = await lstat(activePortPath, { bigint: true })
      if (!lexical.isFile() || lexical.isSymbolicLink() || (Number(lexical.mode) & 0o022) !== 0) {
        fail('STAGE2_DEVTOOLS_FILE_INVALID', 'SAFETY_ABORT')
      }
      return logged
    }
    await delay(25)
  }
  fail('STAGE2_CHROME_START_TIMEOUT')
}

function cdpFailure(code = 'STAGE2_CDP_PROTOCOL_FAILED') {
  return new Stage2RunnerError(code, 'INCONCLUSIVE')
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
  ) fail('STAGE2_CDP_ENDPOINT_INVALID', 'SAFETY_ABORT')
  const socket = new WebSocketImpl(webSocketUrl)
  await withTimeout(new Promise((resolve, reject) => {
    const opened = () => {
      socket.removeEventListener('error', errored)
      resolve()
    }
    const errored = () => {
      socket.removeEventListener('open', opened)
      reject(cdpFailure('STAGE2_CDP_CONNECT_FAILED'))
    }
    socket.addEventListener('open', opened, { once: true })
    socket.addEventListener('error', errored, { once: true })
  }), timeoutMs, 'STAGE2_CDP_CONNECT_TIMEOUT')

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
    rejectAll(cdpFailure('STAGE2_CDP_CLOSED'))
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
          reject(cdpFailure('STAGE2_CDP_COMMAND_TIMEOUT'))
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
          reject(cdpFailure('STAGE2_CDP_EVENT_TIMEOUT'))
        }, milliseconds)
        waiters.add(waiter)
      })
    },
    onEvent(handler) {
      if (typeof handler !== 'function') fail('STAGE2_CDP_HANDLER_INVALID', 'SAFETY_ABORT')
      handlers.add(handler)
      return () => { handlers.delete(handler) }
    },
    close() {
      if (closed) return
      closed = true
      try { socket.close() } catch {}
      rejectAll(cdpFailure('STAGE2_CDP_CLOSED'))
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

async function queryMarker(peer, sessionId, marker) {
  if (!Object.hasOwn(PLUGIN_MARKERS, marker)) fail('STAGE2_MARKER_INVALID', 'SAFETY_ABORT')
  const document = await peer.send('DOM.getDocument', { depth: -1, pierce: true }, sessionId)
  const queried = await peer.send('DOM.querySelector', {
    nodeId: document.root.nodeId,
    selector: PLUGIN_MARKERS[marker],
  }, sessionId)
  return queried.nodeId ?? 0
}

async function waitForMarker(peer, sessionId, marker, { present = true, milliseconds = CDP_TIMEOUT_MS } = {}) {
  const deadline = Date.now() + milliseconds
  while (Date.now() < deadline) {
    const nodeId = await queryMarker(peer, sessionId, marker)
    if ((present && nodeId > 0) || (!present && nodeId === 0)) return nodeId
    await delay(50)
  }
  fail('STAGE2_OBSERVATION_MISMATCH', 'FAIL')
}

function attributeMap(attributes) {
  if (!Array.isArray(attributes) || attributes.length % 2 !== 0) fail('STAGE2_DOM_RESULT_INVALID')
  const result = new Map()
  for (let index = 0; index < attributes.length; index += 2) {
    result.set(attributes[index], attributes[index + 1])
  }
  return result
}

async function waitForCounter(peer, sessionId, expected) {
  const deadline = Date.now() + CDP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const nodeId = await queryMarker(peer, sessionId, 'counter')
    if (nodeId > 0) {
      const response = await peer.send('DOM.getAttributes', { nodeId }, sessionId)
      const attributes = attributeMap(response.attributes)
      if (attributes.get('data-counter') === String(expected) && attributes.get('data-version') === String(expected)) {
        return expected
      }
    }
    await delay(50)
  }
  fail('STAGE2_OBSERVATION_MISMATCH', 'FAIL')
}

async function waitForEnabledMarker(peer, sessionId, marker) {
  const deadline = Date.now() + CDP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const nodeId = await queryMarker(peer, sessionId, marker)
    if (nodeId > 0) {
      const response = await peer.send('DOM.getAttributes', { nodeId }, sessionId)
      if (!attributeMap(response.attributes).has('disabled')) return nodeId
    }
    await delay(50)
  }
  fail('STAGE2_OBSERVATION_MISMATCH', 'FAIL')
}

async function clickMarker(peer, sessionId, marker, { requireEnabled = false } = {}) {
  const nodeId = requireEnabled
    ? await waitForEnabledMarker(peer, sessionId, marker)
    : await waitForMarker(peer, sessionId, marker)
  await peer.send('DOM.scrollIntoViewIfNeeded', { nodeId }, sessionId)
  const model = await peer.send('DOM.getBoxModel', { nodeId }, sessionId)
  const quad = model?.model?.content
  if (!Array.isArray(quad) || quad.length !== 8 || quad.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    fail('STAGE2_DOM_RESULT_INVALID')
  }
  const x = (quad[0] + quad[2] + quad[4] + quad[6]) / 4
  const y = (quad[1] + quad[3] + quad[5] + quad[7]) / 4
  await peer.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y }, sessionId)
  await peer.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 }, sessionId)
  await peer.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 }, sessionId)
}

async function waitForLauncherFocus(peer, sessionId) {
  const deadline = Date.now() + CDP_TIMEOUT_MS
  while (Date.now() < deadline) {
    const nodeId = await queryMarker(peer, sessionId, 'launcher')
    if (nodeId > 0) {
      const described = await peer.send('DOM.describeNode', { nodeId }, sessionId)
      const backendNodeId = described?.node?.backendNodeId
      if (Number.isSafeInteger(backendNodeId) && backendNodeId > 0) {
        const tree = await peer.send('Accessibility.getPartialAXTree', {
          backendNodeId,
          fetchRelatives: false,
        }, sessionId)
        const focused = tree.nodes?.some((node) =>
          node?.backendDOMNodeId === backendNodeId
          && node?.properties?.some((property) => property?.name === 'focused' && property?.value?.value === true),
        )
        if (focused) return true
      }
    }
    await delay(50)
  }
  return false
}

async function observeMarkers(peer, sessionId, phase) {
  if (phase === 'disabled' || phase === 'removed') {
    await delay(QUIET_PERIOD_MS)
    for (const marker of Object.keys(PLUGIN_MARKERS)) {
      if (await queryMarker(peer, sessionId, marker) !== 0) fail('STAGE2_OBSERVATION_MISMATCH', 'FAIL')
    }
    await delay(QUIET_PERIOD_MS)
    for (const marker of Object.keys(PLUGIN_MARKERS)) {
      if (await queryMarker(peer, sessionId, marker) !== 0) fail('STAGE2_OBSERVATION_MISMATCH', 'FAIL')
    }
    return { markerState: 'absent', counters: [], focusRestored: false }
  }

  const start = phase === 'initial-enabled' ? 0 : 1
  const increment = phase === 'initial-enabled' || phase === 'readded'
  await waitForMarker(peer, sessionId, 'launcher')
  await clickMarker(peer, sessionId, 'launcher')
  await waitForMarker(peer, sessionId, 'overlay')
  await waitForCounter(peer, sessionId, start)
  const counters = [start]
  if (increment) {
    await clickMarker(peer, sessionId, 'increment', { requireEnabled: true })
    counters.push(await waitForCounter(peer, sessionId, start + 1))
  }
  await clickMarker(peer, sessionId, 'close')
  await waitForMarker(peer, sessionId, 'overlay', { present: false })
  const focusRestored = await waitForLauncherFocus(peer, sessionId)
  return { markerState: 'present', counters, focusRestored }
}

async function waitForMatchingEvent(peer, method, sessionId, predicate, milliseconds = START_TIMEOUT_MS) {
  const deadline = Date.now() + milliseconds
  while (Date.now() < deadline) {
    const remaining = Math.max(1, deadline - Date.now())
    const event = await peer.waitForEvent(method, sessionId, remaining)
    if (predicate(event)) return event
  }
  fail('STAGE2_CDP_EVENT_TIMEOUT')
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
  ) fail('STAGE2_CDP_PROTOCOL_FAILED')

  const records = new Map()
  const lifecycleLoads = new Set()
  const pendingControls = new Set()
  const externalRequests = new Set()
  let mainLoaderId
  let loadingFailed = false
  let nonSuccessResponse = false
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
    if (event.method.startsWith('Network.') || event.method.startsWith('Fetch.')) networkEpoch += 1

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
          if (remaining < 1) fail('STAGE2_NETWORK_CONTROL_TIMEOUT')
          await withTimeout(Promise.allSettled([...pendingControls]), remaining, 'STAGE2_NETWORK_CONTROL_TIMEOUT')
          if (networkState.controlFailed) fail('STAGE2_NETWORK_CONTROL_FAILED', 'SAFETY_ABORT')
        }
        if (networkState.controlFailed) fail('STAGE2_NETWORK_CONTROL_FAILED', 'SAFETY_ABORT')
        const before = networkEpoch
        const remaining = deadline - now()
        if (remaining < quietMs) fail('STAGE2_NETWORK_CONTROL_TIMEOUT')
        await withTimeout(Promise.resolve(sleep(quietMs)), remaining, 'STAGE2_NETWORK_CONTROL_TIMEOUT')
        if (networkState.controlFailed) fail('STAGE2_NETWORK_CONTROL_FAILED', 'SAFETY_ABORT')
        if (pendingControls.size === 0 && before === networkEpoch) break
      }
    })().finally(stopListening)
    return quiescePromise
  }

  return Object.freeze({
    setMainLoader(loaderId) {
      if (typeof loaderId !== 'string' || loaderId.length === 0 || loaderId.length > 1024 || mainLoaderId !== undefined) {
        fail('STAGE2_PAGE_NAVIGATION_FAILED')
      }
      mainLoaderId = loaderId
    },
    async settle(phase) {
      await quiesce()
      if (networkState.externalAttempts !== 0) fail('STAGE2_EXTERNAL_NETWORK_ATTEMPT', 'FAIL')
      if (loadingFailed) fail('STAGE2_PAGE_NAVIGATION_FAILED')
      if (nonSuccessResponse) fail('STAGE2_OBSERVATION_MISMATCH', 'FAIL')
      const mainCompleted = [...records.values()].some((record) =>
        record.type === 'Document'
        && record.loaderId === mainLoaderId
        && record.responseSucceeded
        && record.finished,
      ) && lifecycleLoads.has(mainLoaderId)
      if (!mainCompleted) fail('STAGE2_PAGE_NAVIGATION_FAILED')
      if (phase !== 'disabled' && phase !== 'removed') {
        const clientCompleted = [...records.values()].some((record) =>
          record.pluginClient && record.responseSucceeded && record.finished,
        )
        if (!clientCompleted) fail('STAGE2_OBSERVATION_MISMATCH', 'FAIL')
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
  if (typeof target?.targetId !== 'string') fail('STAGE2_CDP_PROTOCOL_FAILED')
  const attached = await peer.send('Target.attachToTarget', { targetId: target.targetId, flatten: true })
  if (typeof attached?.sessionId !== 'string') fail('STAGE2_CDP_PROTOCOL_FAILED')
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

  const navigation = await peer.send(
    'Page.navigate',
    { url: origin },
    sessionId,
    { timeoutMs: START_TIMEOUT_MS },
  )
  if (navigation?.errorText !== undefined || typeof navigation?.loaderId !== 'string') {
    fail('STAGE2_PAGE_NAVIGATION_FAILED')
  }
  networkGate.setMainLoader(navigation.loaderId)
  const response = await waitForMatchingEvent(
    peer,
    'Network.responseReceived',
    sessionId,
    (event) => event?.type === 'Document' && event?.loaderId === navigation.loaderId,
  )
  if (
    typeof response?.response?.status !== 'number'
    || response.response.status < 200
    || response.response.status >= 300
    || new URL(response.response.url).origin !== origin
  ) fail('STAGE2_PAGE_NAVIGATION_FAILED')
  await waitForMatchingEvent(
    peer,
    'Page.lifecycleEvent',
    sessionId,
    (event) => event?.loaderId === navigation.loaderId && event?.name === 'load',
  )
  const document = await peer.send('DOM.getDocument', { depth: 0, pierce: false }, sessionId)
  if (new URL(document?.root?.documentURL).origin !== origin) fail('STAGE2_PAGE_NAVIGATION_FAILED')
  return Object.freeze({
    sessionId,
    async settleNetwork() {
      await networkGate.settle(phase)
    },
    async disposeNetwork() {
      await networkGate.dispose()
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
  const stopRetained = operations.stopRetained ?? stopRetainedChild
  const stopIncomplete = operations.stopIncomplete ?? stopIncompleteChild
  const listenerAbsent = operations.assertListenerAbsent ?? assertListenerAbsent
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
      if (devtools) await stopRetained(receipt, { run, validated, listenerPort: devtools.port })
      else await stopIncomplete(receipt, { run, validated })
    } else if (devtools) {
      await listenerAbsent(devtools.port, validated)
      run.markChildStopped(receipt)
    }
  })
  if (peer) await attempt(async () => peer.close())
  return Object.freeze({ ok })
}

function createProductionBrowserAdapter(validated) {
  return Object.freeze({
    async observePhase({ phase, chrome, origin, profilePath, run }) {
      const parsedOrigin = new URL(origin)
      if (
        parsedOrigin.protocol !== 'http:'
        || parsedOrigin.hostname !== '127.0.0.1'
        || !/^[1-9][0-9]{0,4}$/u.test(parsedOrigin.port)
        || Number(parsedOrigin.port) === FORBIDDEN_PORT
        || parsedOrigin.pathname !== '/'
      ) fail('STAGE2_BROWSER_ORIGIN_INVALID', 'SAFETY_ABORT')
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
      const capture = createCapture(child)
      const receipt = makeSpawnReceipt({
        kind: `chrome-${phase}`,
        executable: chrome,
        argv,
        run,
        environment: run.environment,
        child,
      })
      run.registerChild(receipt)
      let devtools
      let peer
      let page
      const networkState = { externalAttempts: 0, controlFailed: false }
      let primaryError
      try {
        await lsofCwd(receipt.pid, run.runRoot, validated)
        devtools = await waitForChromeDevTools(child, capture, profilePath)
        const listener = await lsofListener(receipt.pid, devtools.port, validated)
        const chromeListenerWitnessSha256 = sha256(canonical(listener))
        peer = await createCdpPeer(devtools.webSocketUrl)
        page = await createPageSession(peer, origin, networkState, phase)
        const observation = await observeMarkers(peer, page.sessionId, phase)
        await page.settleNetwork()
        if (networkState.externalAttempts !== 0) fail('STAGE2_EXTERNAL_NETWORK_ATTEMPT', 'FAIL')
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
          if (!primaryError || primaryError.stage2Outcome !== 'SAFETY_ABORT') {
            throw new Stage2RunnerError('STAGE2_BROWSER_CLEANUP_FAILED', 'SAFETY_ABORT')
          }
        }
      }
    },
  })
}

export function createProductionAdapters(validated) {
  if (!validated?.inputs || typeof validated.assert !== 'function') {
    fail('STAGE2_INPUT_INVALID', 'SAFETY_ABORT')
  }
  return Object.freeze({
    workspace: Object.freeze({
      create: async () => createProductionWorkspace(validated),
      cleanup: async (run) => cleanupProductionWorkspace(run),
    }),
    package: Object.freeze({
      freeze: async ({ inputs, run }) => freezeProductionPackage({ inputs, run, validated }),
    }),
    profile: createProductionProfileAdapter(validated),
    runtime: createProductionRuntimeAdapter(validated),
    browser: createProductionBrowserAdapter(validated),
  })
}

function closedFailure(error) {
  const result = emptyResult()
  result.outcome = safeOutcome(error)
  result.failure = { code: safeCode(error) }
  return result
}

export async function runStage2Cli(argv, {
  emit = (bytes) => { process.stdout.write(bytes) },
  validateInputs = validateProductionInputs,
  makeAdapters = createProductionAdapters,
} = {}) {
  let result
  try {
    const inputs = parseStage2Args(argv)
    const validated = await validateInputs(inputs)
    const adapters = makeAdapters(validated)
    result = await executeStage2Smoke({ inputs, adapters, emit })
  } catch (error) {
    result = closedFailure(error)
    emit(canonicalStage2Result(result))
  }
  return result.outcome === 'PASS' ? 0 : 1
}

const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) {
  process.exitCode = await runStage2Cli(process.argv.slice(2))
}
