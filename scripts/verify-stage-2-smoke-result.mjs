import { constants as fsConstants } from 'node:fs'
import { lstat, open, realpath } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const OUTCOMES = new Set(['PASS', 'FAIL', 'INCONCLUSIVE', 'NEEDS_NETWORK_PERMISSION', 'SAFETY_ABORT'])
const PHASE_IDS = [
  'initial-enabled',
  'restart-enabled',
  'disabled',
  'removed',
  'readded',
]
const PHASE_EXPECTATIONS = [
  { markerState: 'present', counters: [0, 1], focusRestored: true, configWitness: 'none', inventoryWitness: 'installed' },
  { markerState: 'present', counters: [1], focusRestored: true, configWitness: 'none', inventoryWitness: 'installed' },
  { markerState: 'absent', counters: [], focusRestored: false, configWitness: 'disabled-patch', inventoryWitness: 'installed-disabled' },
  { markerState: 'absent', counters: [], focusRestored: false, configWitness: 'none', inventoryWitness: 'removed' },
  { markerState: 'present', counters: [1, 2], focusRestored: true, configWitness: 'none', inventoryWitness: 'installed' },
]
const FAILURE_CODES_BY_OUTCOME = Object.freeze({
  FAIL: new Set([
    'STAGE2_OBSERVATION_MISMATCH',
    'STAGE2_EXTERNAL_NETWORK_ATTEMPT',
  ]),
  NEEDS_NETWORK_PERMISSION: new Set([
    'STAGE2_OFFLINE_DEPENDENCY_MISSING',
  ]),
  INCONCLUSIVE: new Set([
    'STAGE2_INTERNAL_FAILURE',
    'STAGE2_PACKAGE_ADAPTER_UNAVAILABLE',
    'STAGE2_PACKAGE_FREEZE_FAILED',
    'STAGE2_NPM_PACK_FAILED',
    'STAGE2_PROFILE_COMMAND_FAILED',
    'STAGE2_PROFILE_COMMAND_TIMEOUT',
    'STAGE2_CHILD_PROCESS_ERROR',
    'STAGE2_PROCESS_STOP_TIMEOUT',
    'STAGE2_PROCESS_KILL_TIMEOUT',
    'STAGE2_HARNESS_START_FAILED',
    'STAGE2_HARNESS_START_TIMEOUT',
    'STAGE2_CHROME_START_FAILED',
    'STAGE2_CHROME_START_TIMEOUT',
    'STAGE2_CDP_PROTOCOL_FAILED',
    'STAGE2_CDP_EVENT_TIMEOUT',
    'STAGE2_CDP_CLOSED',
    'STAGE2_CDP_COMMAND_TIMEOUT',
    'STAGE2_CDP_CONNECT_FAILED',
    'STAGE2_CDP_CONNECT_TIMEOUT',
    'STAGE2_NETWORK_CONTROL_TIMEOUT',
    'STAGE2_DOM_RESULT_INVALID',
    'STAGE2_PAGE_NAVIGATION_FAILED',
  ]),
  SAFETY_ABORT: new Set([
    'STAGE2_CANONICAL_VALUE_INVALID',
    'STAGE2_INPUT_INVALID',
    'STAGE2_NODE_MISMATCH',
    'STAGE2_COMMAND_INVALID',
    'STAGE2_DEVTOOLS_FILE_INVALID',
    'STAGE2_FORBIDDEN_PORT',
    'STAGE2_LISTENER_MISMATCH',
    'STAGE2_CLEANUP_BOUNDARY_INVALID',
    'STAGE2_CLEANUP_ABSENCE_INVALID',
    'STAGE2_PACKAGE_FREEZE_INVALID',
    'STAGE2_RUNTIME_WITNESS_INVALID',
    'STAGE2_BROWSER_WITNESS_INVALID',
    'STAGE2_TOOL_OUTPUT_TOO_LARGE',
    'STAGE2_TOOL_EXECUTION_INVALID',
    'STAGE2_INPUT_IDENTITY_DRIFT',
    'STAGE2_INPUT_IDENTITY_INVALID',
    'STAGE2_MANIFEST_INVALID',
    'STAGE2_TOOL_PACKAGE_INVALID',
    'STAGE2_NODE_VERSION_INVALID',
    'STAGE2_DSH_VERSION_INVALID',
    'STAGE2_NPM_VERSION_INVALID',
    'STAGE2_PNPM_VERSION_INVALID',
    'STAGE2_CHROME_VERSION_INVALID',
    'STAGE2_TOOL_VERSION_DRIFT',
    'STAGE2_OWNERSHIP_INVALID',
    'STAGE2_TEMP_ROOT_INVALID',
    'STAGE2_PACKAGE_STAGE_INVALID',
    'STAGE2_SHIM_INVALID',
    'STAGE2_PHASE_INVALID',
    'STAGE2_OWNERSHIP_DRIFT',
    'STAGE2_SHIM_DRIFT',
    'STAGE2_PROCESS_REGISTRY_INVALID',
    'STAGE2_WORKSPACE_CREATE_CLEANUP_FAILED',
    'STAGE2_LIVE_CHILD_UNCERTAIN',
    'STAGE2_PACKAGE_VERIFICATION_INVALID',
    'STAGE2_PACKAGE_ALLOWLIST_INVALID',
    'STAGE2_BUILD_OUTPUT_HASH_INVALID',
    'STAGE2_PACKAGE_RECEIPT_INVALID',
    'STAGE2_PACKAGE_MANIFEST_INVALID',
    'STAGE2_PACKAGE_LIFECYCLE_FORBIDDEN',
    'STAGE2_FILE_MODE_INVALID',
    'STAGE2_PACK_METADATA_DRIFT',
    'STAGE2_PACKAGE_STAGE_DRIFT',
    'STAGE2_PROCESS_CWD_MISMATCH',
    'STAGE2_LISTENER_REMAINED',
    'STAGE2_LISTENER_ABSENCE_UNPROVED',
    'STAGE2_SPAWN_INVALID',
    'STAGE2_PROCESS_IDENTITY_MISMATCH',
    'STAGE2_PROCESS_SIGNAL_FAILED',
    'STAGE2_PROFILE_DESCENDANT_UNCERTAIN',
    'STAGE2_PROFILE_WITNESS_INVALID',
    'STAGE2_PACKAGE_IDENTITY_DRIFT',
    'STAGE2_DISABLE_PATCH_INVALID',
    'STAGE2_HARNESS_URL_INVALID',
    'STAGE2_RUNTIME_START_CLEANUP_FAILED',
    'STAGE2_DEVTOOLS_WITNESS_MISMATCH',
    'STAGE2_CDP_ENDPOINT_INVALID',
    'STAGE2_CDP_HANDLER_INVALID',
    'STAGE2_MARKER_INVALID',
    'STAGE2_NETWORK_CONTROL_FAILED',
    'STAGE2_BROWSER_ORIGIN_INVALID',
    'STAGE2_BROWSER_CLEANUP_FAILED',
    'STAGE2_TREE_INVENTORY_INVALID',
    'STAGE2_TREE_SPECIAL_FILE',
    'STAGE2_TREE_HARDLINK_ESCAPE',
    'STAGE2_TREE_CROSS_DEVICE',
    'STAGE2_TREE_INVENTORY_DRIFT',
    'STAGE2_OPEN_HANDLE_REMAINS',
    'STAGE2_OPEN_HANDLE_UNPROVED',
    'STAGE2_CLEANUP_FAILED',
    'STAGE2_RUNTIME_STOP_FAILED',
    'STAGE2_CLOSURE_INCOMPLETE',
  ]),
})
const HASH_PATTERN = /^[0-9a-f]{64}$/
const CODE_PATTERN = /^STAGE2_[A-Z0-9_]+$/
const FORBIDDEN_TEXT = /(?:\/Users\/|\/private\/|\/var\/folders\/|(?:^|[^a-z])\/tmp\/|[A-Za-z]:[\\/]|file:|https?:\/\/|wss?:\/\/|CANARY|(?:api[_-]?)?token|secret|password|cookie|credential|provider|node_options|-----BEGIN)/i
const MAX_RESULT_FILE_BYTES = 1024 * 1024
const RESULT_FILE_IDENTITY_FIELDS = Object.freeze([
  'dev',
  'ino',
  'mode',
  'nlink',
  'size',
  'mtimeNs',
  'ctimeNs',
])

function invalid() {
  throw new Error('STAGE2_RESULT_INVALID')
}

function assertResultFileReceipt(receipt) {
  if (
    !receipt.isFile()
    || receipt.isSymbolicLink()
    || receipt.size <= 0n
    || receipt.size > BigInt(MAX_RESULT_FILE_BYTES)
  ) invalid()
}

function assertSameResultFileReceipt(expected, actual) {
  for (const field of RESULT_FILE_IDENTITY_FIELDS) {
    if (expected[field] !== actual[field]) invalid()
  }
}

export async function readBoundedStage2ResultHandle(handle, pathnameReceipt) {
  const before = await handle.stat({ bigint: true })
  assertResultFileReceipt(before)
  if (pathnameReceipt !== undefined) {
    assertResultFileReceipt(pathnameReceipt)
    assertSameResultFileReceipt(pathnameReceipt, before)
  }

  const bytes = await handle.readFile()
  if (bytes.byteLength === 0 || bytes.byteLength > MAX_RESULT_FILE_BYTES) invalid()

  const after = await handle.stat({ bigint: true })
  assertResultFileReceipt(after)
  assertSameResultFileReceipt(before, after)
  if (BigInt(bytes.byteLength) !== before.size) invalid()
  return bytes
}

export async function readBoundedStage2ResultFile(resultPath, {
  lstatPath = lstat,
  openFile = open,
  realpathPath = realpath,
} = {}) {
  const pathnameReceipt = await lstatPath(resultPath, { bigint: true })
  assertResultFileReceipt(pathnameReceipt)
  if (await realpathPath(resultPath) !== resultPath) invalid()

  const handle = await openFile(resultPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW ?? 0))
  try {
    const bytes = await readBoundedStage2ResultHandle(handle, pathnameReceipt)
    const pathnameAfter = await lstatPath(resultPath, { bigint: true })
    assertResultFileReceipt(pathnameAfter)
    assertSameResultFileReceipt(pathnameReceipt, pathnameAfter)
    if (await realpathPath(resultPath) !== resultPath) invalid()
    return bytes
  } finally {
    await handle.close()
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function exactKeys(value, keys) {
  if (!isRecord(value)) invalid()
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) invalid()
}

function safeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0
}

function assertSanitized(value) {
  if (typeof value === 'string') {
    if (FORBIDDEN_TEXT.test(value) || /[\u0000-\u001f\u007f]/u.test(value)) invalid()
    return
  }
  if (Array.isArray(value)) {
    for (const entry of value) assertSanitized(entry)
    return
  }
  if (isRecord(value)) {
    for (const [key, entry] of Object.entries(value)) {
      assertSanitized(key)
      assertSanitized(entry)
    }
  }
}

function expectedFailureOutcome(code) {
  for (const [outcome, codes] of Object.entries(FAILURE_CODES_BY_OUTCOME)) {
    if (codes.has(code)) return outcome
  }
  invalid()
}

function validatePhase(phase, index) {
  exactKeys(phase, [
    'id',
    'markerState',
    'counters',
    'focusRestored',
    'configWitness',
    'inventoryWitness',
    'externalNetworkAttempts',
    'harnessSpawnReceiptSha256',
    'harnessListenerWitnessSha256',
    'chromeSpawnReceiptSha256',
    'chromeListenerWitnessSha256',
    'loopback',
    'stopped',
    'browserProfileOrdinal',
  ])
  if (phase.id !== PHASE_IDS[index]) invalid()
  if (phase.markerState !== 'present' && phase.markerState !== 'absent') invalid()
  if (!Array.isArray(phase.counters) || phase.counters.some((counter) => !safeInteger(counter))) invalid()
  if (typeof phase.focusRestored !== 'boolean') invalid()
  if (!['none', 'disabled-patch'].includes(phase.configWitness)) invalid()
  if (!['installed', 'installed-disabled', 'removed'].includes(phase.inventoryWitness)) invalid()
  if (!safeInteger(phase.externalNetworkAttempts)) invalid()
  if (
    !HASH_PATTERN.test(phase.harnessSpawnReceiptSha256)
    || !HASH_PATTERN.test(phase.harnessListenerWitnessSha256)
    || !HASH_PATTERN.test(phase.chromeSpawnReceiptSha256)
    || !HASH_PATTERN.test(phase.chromeListenerWitnessSha256)
  ) invalid()
  if (phase.loopback !== true || phase.stopped !== true) invalid()
  if (phase.browserProfileOrdinal !== index + 1) invalid()
  const expected = PHASE_EXPECTATIONS[index]
  if (
    phase.markerState !== expected.markerState
    || JSON.stringify(phase.counters) !== JSON.stringify(expected.counters)
    || phase.focusRestored !== expected.focusRestored
    || phase.configWitness !== expected.configWitness
    || phase.inventoryWitness !== expected.inventoryWitness
    || phase.externalNetworkAttempts !== 0
  ) invalid()
}

function assertPassInvariants(result) {
  if (result.failure !== null) invalid()
  if (!HASH_PATTERN.test(result.plugin.tgzSha256)) invalid()
  if (result.phases.length !== PHASE_IDS.length) invalid()
  if (
    result.process.spawnReceipts !== 10
    || result.process.listenerWitnesses !== 10
    || result.process.allLoopback !== true
    || result.process.allStopped !== true
    || result.process.freshBrowserProfiles !== 5
    || result.network.externalAttempts !== 0
    || result.cleanup.renamed !== true
    || result.cleanup.revalidated !== true
    || result.cleanup.removed !== true
  ) invalid()
}

export function validateStage2SmokeResult(value) {
  exactKeys(value, [
    'schemaVersion',
    'outcome',
    'harnessTarget',
    'plugin',
    'phases',
    'process',
    'network',
    'cleanup',
    'failure',
  ])
  if (value.schemaVersion !== '1' || !OUTCOMES.has(value.outcome) || value.harnessTarget !== '0.1.0-rc.6') invalid()

  exactKeys(value.plugin, ['name', 'version', 'tgzSha256'])
  if (value.plugin.name !== '@knight/dsh-pm-workbench' || value.plugin.version !== '0.1.0') invalid()
  if (value.plugin.tgzSha256 !== null && !HASH_PATTERN.test(value.plugin.tgzSha256)) invalid()

  if (!Array.isArray(value.phases) || value.phases.length > PHASE_IDS.length) invalid()
  value.phases.forEach(validatePhase)

  exactKeys(value.process, [
    'spawnReceipts',
    'listenerWitnesses',
    'allLoopback',
    'allStopped',
    'freshBrowserProfiles',
  ])
  if (
    !safeInteger(value.process.spawnReceipts)
    || !safeInteger(value.process.listenerWitnesses)
    || typeof value.process.allLoopback !== 'boolean'
    || typeof value.process.allStopped !== 'boolean'
    || !safeInteger(value.process.freshBrowserProfiles)
  ) invalid()

  exactKeys(value.network, ['scope', 'externalAttempts'])
  if (value.network.scope !== 'browser-page-target' || !safeInteger(value.network.externalAttempts)) invalid()

  exactKeys(value.cleanup, ['renamed', 'revalidated', 'removed'])
  if (
    typeof value.cleanup.renamed !== 'boolean'
    || typeof value.cleanup.revalidated !== 'boolean'
    || typeof value.cleanup.removed !== 'boolean'
  ) invalid()

  if (value.failure !== null) {
    exactKeys(value.failure, ['code'])
    if (!CODE_PATTERN.test(value.failure.code) || value.failure.code.length > 80) invalid()
  }
  if (value.outcome === 'PASS') assertPassInvariants(value)
  else {
    if (value.failure === null) invalid()
    if (expectedFailureOutcome(value.failure.code) !== value.outcome) invalid()
  }

  const completedPhases = value.phases.length
  if (
    value.process.spawnReceipts !== completedPhases * 2
    || value.process.listenerWitnesses !== completedPhases * 2
    || value.process.freshBrowserProfiles !== completedPhases
    || value.process.allLoopback !== true
  ) invalid()
  if (value.failure?.code === 'STAGE2_EXTERNAL_NETWORK_ATTEMPT') {
    if (value.network.externalAttempts <= 0) invalid()
  } else if (value.outcome !== 'SAFETY_ABORT' && value.network.externalAttempts !== 0) invalid()
  if (completedPhases > 0 && !HASH_PATTERN.test(value.plugin.tgzSha256 ?? '')) invalid()
  const cleanupValues = [value.cleanup.renamed, value.cleanup.revalidated, value.cleanup.removed]
  if (!cleanupValues.every((entry) => entry === cleanupValues[0])) invalid()
  if (value.cleanup.removed && value.process.allStopped !== true) invalid()
  if (value.process.allStopped === false && (
    value.outcome !== 'SAFETY_ABORT'
    || value.cleanup.renamed
    || value.cleanup.revalidated
    || value.cleanup.removed
  )) invalid()
  if (
    (value.failure?.code === 'STAGE2_CLEANUP_FAILED' || value.failure?.code === 'STAGE2_RUNTIME_STOP_FAILED')
    && value.process.allStopped !== false
  ) invalid()

  assertSanitized(value)
  return value
}

export function canonicalStage2Result(value) {
  const result = validateStage2SmokeResult(value)
  const normalized = {
    schemaVersion: result.schemaVersion,
    outcome: result.outcome,
    harnessTarget: result.harnessTarget,
    plugin: {
      name: result.plugin.name,
      version: result.plugin.version,
      tgzSha256: result.plugin.tgzSha256,
    },
    phases: result.phases.map((phase) => ({
      id: phase.id,
      markerState: phase.markerState,
      counters: [...phase.counters],
      focusRestored: phase.focusRestored,
      configWitness: phase.configWitness,
      inventoryWitness: phase.inventoryWitness,
      externalNetworkAttempts: phase.externalNetworkAttempts,
      harnessSpawnReceiptSha256: phase.harnessSpawnReceiptSha256,
      harnessListenerWitnessSha256: phase.harnessListenerWitnessSha256,
      chromeSpawnReceiptSha256: phase.chromeSpawnReceiptSha256,
      chromeListenerWitnessSha256: phase.chromeListenerWitnessSha256,
      loopback: phase.loopback,
      stopped: phase.stopped,
      browserProfileOrdinal: phase.browserProfileOrdinal,
    })),
    process: {
      spawnReceipts: result.process.spawnReceipts,
      listenerWitnesses: result.process.listenerWitnesses,
      allLoopback: result.process.allLoopback,
      allStopped: result.process.allStopped,
      freshBrowserProfiles: result.process.freshBrowserProfiles,
    },
    network: {
      scope: result.network.scope,
      externalAttempts: result.network.externalAttempts,
    },
    cleanup: {
      renamed: result.cleanup.renamed,
      revalidated: result.cleanup.revalidated,
      removed: result.cleanup.removed,
    },
    failure: result.failure === null ? null : { code: result.failure.code },
  }
  const bytes = `${JSON.stringify(normalized)}\n`
  if (Buffer.byteLength(bytes) > 65_536) invalid()
  return bytes
}

export function renderStage2SmokeMarkdown(value) {
  const result = validateStage2SmokeResult(value)
  const statusSentence = result.outcome === 'PASS'
    ? 'The Stage 2 isolated smoke passed for the recorded rc.6 combination.'
    : `The Stage 2 isolated smoke finished with outcome ${result.outcome}.`
  const phaseRows = result.phases.map((phase) =>
    `| ${phase.id} | ${phase.markerState} | ${phase.counters.join(' → ') || 'none'} | ${phase.inventoryWitness} |`,
  )
  return [
    '# Stage 2 isolated smoke',
    '',
    statusSentence,
    '',
    `- Harness target: ${result.harnessTarget}`,
    `- Plugin: ${result.plugin.name}@${result.plugin.version}`,
    `- Package SHA-256: ${result.plugin.tgzSha256 ?? 'unavailable'}`,
    `- Network observation scope: ${result.network.scope}`,
    `- External-network attempts within attached browser page target: ${result.network.externalAttempts}`,
    `- Cleanup removed owned run root: ${result.cleanup.removed ? 'yes' : 'no'}`,
    '',
    '| Phase | Plugin markers | Counters | Inventory witness |',
    '| --- | --- | --- | --- |',
    ...phaseRows,
    '',
  ].join('\n')
}

function parseVerifierArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--result' || !path.isAbsolute(argv[1])) invalid()
  return argv[1]
}

async function main() {
  const resultPath = parseVerifierArgs(process.argv.slice(2))
  const bytes = await readBoundedStage2ResultFile(resultPath)
  const text = bytes.toString('utf8')
  const value = JSON.parse(text)
  if (canonicalStage2Result(value) !== text) invalid()
  process.stdout.write(renderStage2SmokeMarkdown(value))
}

const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) {
  await main().catch(() => {
    process.stderr.write('STAGE2_RESULT_INVALID\n')
    process.exitCode = 1
  })
}
