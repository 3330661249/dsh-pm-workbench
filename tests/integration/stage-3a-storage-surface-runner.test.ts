import { apply as applyGateHost } from './fixtures/stage3a-storage-gate/host.js'
import { assertNoStorageGateDiagnostics } from '../../scripts/verify-package.mjs'
import { describe, expect, it, vi } from 'vitest'
import { EventEmitter } from 'node:events'
import { createHash } from 'node:crypto'
import * as filesystem from 'node:fs/promises'
import { mkdtemp, realpath, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildStorageGateFixture } from './fixtures/stage3a-storage-gate/build.mjs'
import { createPageNetworkGate, validateProductionInputs, createProductionWorkspace, cleanupProductionWorkspace, freezeProductionPackage, assertListenerAbsent, makeSpawnReceipt, createNodeCloseWitness, retireIncompleteChildReceipt, parseDevToolsActivePort, parseLsofListenerWitness, waitForMarker, executeStorageGate, STAGE3A_PHASES, verifyToolFile, parseStage3aArgs } from '../../scripts/run-stage-3a-storage-surface-gate.mjs'
import { verifyStage3aStorageSurfaceResult } from '../../scripts/verify-stage-3a-storage-surface-result.mjs'

const hash = 'a'.repeat(64)
const inputs = { node: '/accepted/node', dshCli: '/accepted/dsh/lib/bin.js', npmCli: '/accepted/npm/bin/npm-cli.js', pnpmNode: '/accepted/pnpm-node', pnpmCli: '/accepted/pnpm/bin/pnpm.cjs', chrome: '/accepted/chrome' }

function fakePorts(mode = 'pass') {
  let listeners = 0
  let exists = false
  let starts = 0
  const events: string[] = []
  const ports = {
    executable: { verify: async () => { events.push('verify'); if (mode === 'tool') throw Error('tool-identity') } },
    workspace: {
      create: async () => { exists = true; return { browserProfile: (phase: string) => `/owned/${phase}` } },
      cleanup: async () => { if (mode === 'cleanup') throw Error('cleanup'); exists = false; return { renamed: true, revalidated: true, removed: true, runRootExistsAfterCleanup: false, listenerCountAfterCleanup: listeners, childCountAfterCleanup: listeners } },
    },
    package: { freeze: async () => ({ name: mode === 'package' ? 'wrong' : '@knight/dsh-pm-workbench-storage-gate', version: '0.0.0-stage3a', sha256: hash, hostMetafileSha256: hash, clientMetafileSha256: hash, packageFiles: makeStorageGateResult().packageFiles, tgzAbsolutePath: '/owned/package.tgz' }) },
    profile: { add: async () => {}, witness: async () => {} },
    runtime: { start: async () => {
      listeners++; starts++
      const port = mode === '3080' ? 3080 : 32000 + starts
      return { port, origin: `http://127.0.0.1:${port}`, loopback: true, spawnReceiptSha256: hash, listenerWitnessSha256: hash,
        stop: async () => { events.push('stop'); if (mode === 'child') throw Error('child'); if (mode !== 'listener') listeners-- } }
    } },
    browser: { observePhase: async ({ phase, networkState }: { phase: string; networkState: { externalAttempts: number } }) => {
      if (mode === 'external') networkState.externalAttempts = 1
      const near = phase.includes('near-limit')
      const deleted = phase.includes('tombstone')
      return { ok: !(mode === 'write' && phase === 'write-small'), bytes: phase === 'reject-over-limit' ? 4194305 : near ? 4194304 : 512,
        hash: (mode === 'restart' && phase === 'read-small') || (mode === 'near' && phase === 'read-near-limit') ? 'b'.repeat(64) : hash,
        hidden: deleted && mode !== 'tombstone', backendCalls: phase === 'reject-over-limit' ? (mode === 'quota' ? 1 : 0) : 1,
        externalNetworkAttempts: networkState.externalAttempts, chromeSpawnReceiptSha256: hash, chromeListenerWitnessSha256: hash }
    } },
    verifier: mode === 'verifier' ? () => { throw Error('verifier') } : verifyStage3aStorageSurfaceResult,
  }
  return { ports, state: () => ({ listeners, exists, starts, events }) }
}

describe('isolated storage runner', () => {
  it('diagnostic Host measures bytes and rejects quota before calling its table', async () => {
    const rows = new Map<string, any>()
    let writes = 0
    let handler: any
    const table = { get: (id: string) => rows.get(id), entries: () => rows.entries(),
      put: async (id: string, value: unknown) => { writes++; rows.set(id, value) },
      update: async (id: string, change: (value: unknown) => unknown) => { writes++; rows.set(id, change(rows.get(id))); return true },
    }
    const context = { storageDomain: { open: async () => ({ table: () => table, close: async () => {} }) }, connection: { rpc: { handle: (_channel: string, value: unknown) => { handler = value; return async () => {} } } } }
    const dispose = await applyGateHost(context as unknown as Parameters<typeof applyGateHost>[0])
    try {
      const small = await handler('write-small', {})
      expect(small.value.bytes).toBe(512)
      expect((await handler('read-small', {})).value.hash).toBe(small.value.hash)
      expect((await handler('write-tombstone', {})).value.hidden).toBe(true)
      expect((await handler('read-tombstone', {})).value.hidden).toBe(true)
      const near = await handler('write-near-limit', {})
      expect(near.value.bytes).toBe(4194304)
      const before = writes
      const over = await handler('reject-over-limit', {})
      expect(over.value).toMatchObject({ ok: true, bytes: 4194305, backendCalls: 0 })
      expect(writes).toBe(before)
      expect(JSON.stringify(near).includes('padding')).toBe(false)
    } finally { await dispose() }
  })

  it.each(['@knight/dsh-pm-workbench-storage-gate', 'dsh-pm-workbench-storage-gate', 'dsh_pm_workbench_storage_gate', '/dsh-pm-workbench-stage3a-storage-gate-v1'])('production verifier rejects diagnostic %s', value => {
    expect(() => assertNoStorageGateDiagnostics(Buffer.from(value))).toThrow('diagnostic-storage-gate-forbidden')
  })
  it('freezes a self-contained package with no Product-source imports', async () => {
    const root = await mkdtemp(path.join(await realpath(tmpdir()), 'storage-fixture-test-'))
    try {
      const receipt = await buildStorageGateFixture({ outputRoot: root })
      expect((await readFile(path.join(receipt.packageRoot, 'lib/client.js'), 'utf8')).includes("window.__ModuleLoader__.load({ id:'@knight/dsh-pm-workbench-storage-gate'")).toBe(true)
      expect(receipt.packageFiles).toEqual(['package/cordis.patch.yml', 'package/lib/client.js', 'package/lib/index.js', 'package/package.json'])
      expect(Object.keys(receipt.hostMetafile.inputs).join('\n')).not.toContain('packages/workbench/src/')
      expect(Object.keys(receipt.clientMetafile.inputs).join('\n')).not.toContain('packages/workbench/src/')
    } finally { await rm(root, { recursive: true, force: true }) }
  })
  it('always removes a marker-owned run root after child shutdown', async () => {
    const f = fakePorts()
    const run = await executeStorageGate({ inputs, adapters: f.ports })
    expect(run.outcome).toBe('PASS')
    expect(run.listenerCountAfterCleanup).toBe(0)
    expect(run.runRootExistsAfterCleanup).toBe(false)
    expect(f.state().starts).toBe(STAGE3A_PHASES.length)
    expect(f.state().events.at(-1)).toBe('stop')
  })
  it.each(['tool', 'package', '3080', 'external', 'write', 'restart', 'tombstone', 'near', 'quota', 'verifier', 'child', 'listener', 'cleanup'])('fails closed for %s', async mode => {
    const f = fakePorts(mode)
    const result = await executeStorageGate({ inputs, adapters: f.ports })
    expect(result.outcome).not.toBe('PASS')
    if (!['child', 'listener', 'cleanup'].includes(mode)) expect(f.state().exists).toBe(false)
  })
  it('rejects noncanonical lexical inputs instead of normalizing them', () => {
    expect(() => parseStage3aArgs(['--node', '/accepted/../node', '--dsh-cli', inputs.dshCli, '--npm-cli', inputs.npmCli, '--pnpm-node', inputs.pnpmNode, '--pnpm-cli', inputs.pnpmCli, '--chrome', inputs.chrome], { processExecPath: '/node' })).toThrow()
  })
})

// Synthetic receipts for verifier tests only; never used by the real runner.
function makeStorageGateResult(override: Record<string, unknown> = {}) {
  const hash = 'a'.repeat(64)
  return {
    schemaVersion: 1, outcome: 'PASS', harnessVersion: '0.1.0-rc.6',
    packageName: '@knight/dsh-pm-workbench-storage-gate', packageVersion: '0.0.0-stage3a',
    packageFiles: ['package/cordis.patch.yml', 'package/lib/client.js', 'package/lib/index.js', 'package/package.json'],
    packageSha256: hash, hostMetafileSha256: hash, clientMetafileSha256: hash,
    smallBytes: 512, smallHashBeforeRestart: hash, smallHashAfterRestart: hash,
    tombstoneUpdated: true, tombstoneHiddenAfterRestart: true,
    nearLimitBytes: 4194304, nearLimitHashBeforeRestart: hash, nearLimitHashAfterRestart: hash,
    overLimitBytes: 4194305, overLimitRejected: true, overLimitBackendCalls: 0,
    phaseCount: 7, restartCount: 6, freshBrowserProfiles: 7, spawnWitnessCount: 14, listenerWitnessCount: 14,
    externalAttempts: 0, port3080Touched: false, allLoopback: true,
    childCountAfterCleanup: 0, listenerCountAfterCleanup: 0, runRootExistsAfterCleanup: false,
    cleanupRenamed: true, cleanupRevalidated: true, cleanupRemoved: true, failure: null,
    ...override,
  }
}


const noMatches = async () => { throw Object.assign(Error('no-match'), { code: 1, stdout: '', stderr: '', killed: false, signal: null }) }
const noopValidated = () => ({ inputs, assert: vi.fn(async () => {}) })
async function withGateWorkspace(operation: (run: any, validated: any) => Promise<void>) {
  const validated = noopValidated()
  const run = await createProductionWorkspace(validated)
  try { await operation(run, validated) }
  finally {
    // Test-owned synthetic roots only; no process is started in these tests.
    await rm(run.runRoot, { recursive: true, force: true })
    await rm(run.tombstoneRoot, { recursive: true, force: true })
  }
}

async function withTools(operation: (toolInputs: typeof inputs, execute: any, root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), 'storage-tools-test-'))
  const toolInputs = { ...inputs, node: path.join(root, 'node'), pnpmNode: path.join(root, 'pnpm-node'), chrome: path.join(root, 'chrome') }
  const specs = [['dshCli','dsh','@deepseek-ai/dsh','0.1.0-rc.6'], ['npmCli','npm','npm','11.9.0'], ['pnpmCli','pnpm','pnpm','11.19.0']] as const
  try {
    for (const [key, bin, name, version] of specs) {
      const directory = path.join(root, key)
      await filesystem.mkdir(path.join(directory, 'bin'), { recursive: true })
      toolInputs[key] = path.join(directory, 'bin', 'cli.mjs')
      await filesystem.writeFile(path.join(directory, 'package.json'), JSON.stringify({ name, version, bin: { [bin]: 'bin/cli.mjs' } }))
    }
    for (const file of Object.values(toolInputs)) await filesystem.writeFile(file, 'synthetic executable', { mode: 0o755 })
    const execute = vi.fn(async (file: string, argv: string[]) => ({ stdout: file === toolInputs.chrome ? 'Google Chrome 140.0.0.0' : argv.length === 1 ? process.version : argv[0] === toolInputs.dshCli ? '0.1.0-rc.6' : argv[0] === toolInputs.npmCli ? '11.9.0' : '11.19.0', stderr: '' }))
    await operation(toolInputs, execute, root)
  } finally { await rm(root, { recursive: true, force: true }) }
}

describe('production storage gate boundary mechanisms', () => {
  it.each(['pass', 'backend-failure', 'restart-change', 'tombstone-visible', 'near-change'])('observes actual diagnostic Host behavior through the orchestration port: %s', async mode => {
    const rows = new Map<string, any>()
    let handler: any
    let dispose: () => Promise<void> = async () => {}
    const table = {
      get: (id: string) => rows.get(id), entries: () => rows.entries(),
      put: async (id: string, value: unknown) => { if (mode === 'backend-failure') throw Error('injected-table-write'); rows.set(id, value) },
      update: async (id: string, change: (value: any) => unknown) => { if (mode !== 'tombstone-visible') rows.set(id, change(rows.get(id))); return true },
    }
    const context = { storageDomain: { open: async () => ({ table: () => table, close: async () => {} }) }, connection: { rpc: { handle: (_channel: string, value: unknown) => { handler = value; return async () => {} } } } }
    const f = fakePorts()
    const start = f.ports.runtime.start
    f.ports.runtime.start = async () => {
      await dispose()
      dispose = await applyGateHost(context as unknown as Parameters<typeof applyGateHost>[0])
      return start()
    }
    f.ports.browser.observePhase = async ({ phase }) => {
      if (mode === 'restart-change' && phase === 'read-small') rows.set('small', { ...rows.get('small'), id: 'other' })
      if (mode === 'near-change' && phase === 'read-near-limit') rows.set('near', { ...rows.get('near'), id: 'xxxx' })
      // The witness is produced by the real diagnostic Host, never a fabricated ok/hash value.
      const response = await handler(phase, {})
      return { ...response.value, externalNetworkAttempts: 0, chromeSpawnReceiptSha256: hash, chromeListenerWitnessSha256: hash }
    }
    try {
      const result = await executeStorageGate({ inputs, adapters: f.ports })
      if (mode === 'pass') expect(result.outcome).toBe('PASS')
      else expect(result.failure).toBe(mode === 'backend-failure' ? 'STAGE3A_OBSERVATION_MISMATCH' : mode === 'tombstone-visible' ? 'STAGE3A_TOMBSTONE_UPDATE_MISMATCH' : mode === 'restart-change' ? 'STAGE3A_SMALL_RESTART_MISMATCH' : 'STAGE3A_NEAR_RESTART_MISMATCH')
    } finally { await dispose() }
  })

  it('verifies actual canonical tool files and version identity through the process port', async () => {
    await withTools(async (toolInputs, exec) => {
      const validated = await validateProductionInputs(toolInputs, { processExecPath: toolInputs.node, exec })
      expect(exec.mock.calls.length).toBe(6)
      await validated.assert('pnpmCli')
      expect(exec.mock.calls.at(-1)?.slice(0,2)).toEqual([toolInputs.pnpmNode, [toolInputs.pnpmCli, '--version']])
    })
  })
  it.each(['symlink','ancestor-symlink','nonexecutable','drift','companion-drift','manifest','version','bin'])('rejects actual tool %s at the production boundary', async mode => {
    await withTools(async (toolInputs, exec, root) => {
      if (mode === 'symlink') {
        const target = path.join(root, 'target'); await filesystem.rename(toolInputs.dshCli, target); await filesystem.symlink(target, toolInputs.dshCli)
      } else if (mode === 'ancestor-symlink') {
        const alias = path.join(root, 'alias'); await filesystem.symlink(path.dirname(toolInputs.dshCli), alias); toolInputs.dshCli = path.join(alias, 'cli.mjs')
      } else if (mode === 'nonexecutable') await filesystem.chmod(toolInputs.dshCli, 0o644)
      else if (mode === 'manifest' || mode === 'bin') {
        const manifest = path.join(path.dirname(path.dirname(toolInputs.dshCli)), 'package.json')
        const value = JSON.parse(await readFile(manifest, 'utf8'))
        if (mode === 'manifest') value.name = 'wrong-package'; else value.bin.dsh = 'bin/wrong.mjs'
        await filesystem.writeFile(manifest, JSON.stringify(value))
      } else if (mode === 'version') exec.mockImplementation(async () => ({ stdout: 'wrong-version', stderr: '' }))
      if (mode === 'drift' || mode === 'companion-drift') {
        const validated = await validateProductionInputs(toolInputs, { processExecPath: toolInputs.node, exec })
        await filesystem.writeFile(mode === 'companion-drift' ? toolInputs.pnpmNode : toolInputs.dshCli, 'changed executable')
        const calls = exec.mock.calls.length
        await expect(validated.assert(mode === 'companion-drift' ? 'pnpmCli' : 'dshCli')).rejects.toThrow('STAGE3A_INPUT_IDENTITY_DRIFT')
        expect(exec.mock.calls.length).toBe(calls)
      } else await expect(validateProductionInputs(toolInputs, { processExecPath: toolInputs.node, exec })).rejects.toThrow(/STAGE3A_(INPUT_IDENTITY_INVALID|TOOL_PACKAGE_INVALID|TOOL_IDENTITY_INVALID)/)
    })
  })
  it('uses the same stable file reader when filesystem operations are injected', async () => {
    await withTools(async toolInputs => {
      const opened = vi.fn(filesystem.open)
      await verifyToolFile(toolInputs.node, { fs: { ...filesystem, open: opened } })
      expect(opened).toHaveBeenCalledTimes(1)
    })
  })
  it('rejects forbidden Chrome port and mismatched listener ownership at their parsers', () => {
    expect(() => parseDevToolsActivePort('3080\n/devtools/browser/00000000-0000-4000-8000-000000000000\n')).toThrow('STAGE3A_FORBIDDEN_PORT')
    expect(() => parseLsofListenerWitness('p2\nn127.0.0.1:32001\n', { pid: 1, port: 32001 })).toThrow('STAGE3A_LISTENER_MISMATCH')
    expect(() => parseLsofListenerWitness('p1\nn*:32001\n', { pid: 1, port: 32001 })).toThrow('STAGE3A_LISTENER_MISMATCH')
  })
  it('receives an external page request through CDP and blocks it before returning failure', async () => {
    let listener: (event: any) => void = () => {}
    const unsubscribe = vi.fn()
    const peer = { send: vi.fn(async () => ({})), onEvent: (callback: typeof listener) => { listener = callback; return unsubscribe } }
    const networkState = { externalAttempts: 0, controlFailed: false }
    let clock = 0
    const gate = createPageNetworkGate(peer, 'session', 'http://127.0.0.1:32001', networkState, { quietMs: 1, timeoutMs: 10, now: () => clock, sleep: async ms => { clock += ms } })
    listener({ method: 'Fetch.requestPaused', sessionId: 'session', params: { requestId: 'external', request: { url: 'https://example.invalid/data' } } })
    await expect(gate.settle('write-small')).rejects.toThrow('STAGE3A_EXTERNAL_NETWORK_ATTEMPT')
    expect(peer.send.mock.calls).toEqual([['Fetch.failRequest', { requestId: 'external', errorReason: 'BlockedByClient' }, 'session']])
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
  it('rejects duplicate test-owned marker nodes returned by CDP', async () => {
    const peer = { send: vi.fn(async (method: string) => method === 'DOM.getDocument' ? { root: { nodeId: 1 } } : { nodeIds: [2,3] }) }
    await expect(waitForMarker(peer, 'session', 'status')).rejects.toThrow('STAGE3A_PAGE_NAVIGATION_FAILED')
  })
  it.each(['pass','marker','child','handle','delete'])('runs actual marker-owned cleanup with %s', async mode => {
    await withGateWorkspace(async (run, validated) => {
      if (mode === 'marker') await filesystem.writeFile(run.markerPath, 'wrong-owner')
      if (mode === 'child') run.activeChildren.add({ child: {} })
      const execFile = mode === 'handle' ? async () => ({ stdout: 'p1\nfcwd\nnowned-file\n', stderr: '' }) : noMatches
      const remove = mode === 'delete' ? async () => { throw Error('injected-delete-failure') } : filesystem.rm
      const cleanup = cleanupProductionWorkspace(run, { execFile, remove })
      if (mode === 'pass') {
        expect(await cleanup).toEqual({ renamed: true, revalidated: true, removed: true })
        await expect(filesystem.lstat(run.runRoot)).rejects.toMatchObject({ code: 'ENOENT' })
        await expect(filesystem.lstat(run.tombstoneRoot)).rejects.toMatchObject({ code: 'ENOENT' })
        expect(validated.assert).toHaveBeenCalledWith('lsof')
      } else await expect(cleanup).rejects.toThrow(mode === 'marker' ? 'STAGE3A_OWNERSHIP_DRIFT' : mode === 'child' ? 'STAGE3A_LIVE_CHILD_UNCERTAIN' : mode === 'handle' ? 'STAGE3A_OPEN_HANDLE_REMAINS' : 'injected-delete-failure')
    })
  })
  it.each(['pass','open','uncertain'])('checks listener absence from tool exit semantics: %s', async mode => {
    const validated = noopValidated()
    const execFile = mode === 'pass' ? noMatches : mode === 'open' ? async () => ({ stdout: 'p123\nn127.0.0.1:32001\n' }) : async () => ({ stdout: '' })
    const operation = assertListenerAbsent(32001, validated, { execFile })
    if (mode === 'pass') await expect(operation).resolves.toBeUndefined()
    else await expect(operation).rejects.toThrow(mode === 'open' ? 'STAGE3A_LISTENER_REMAINED' : 'STAGE3A_LISTENER_ABSENCE_UNPROVED')
  })
  it.each(['pass','unclosed','listener'])('retires real registered child receipts only after %s proof', async mode => {
    await withGateWorkspace(async (run, validated) => {
      const child = Object.assign(new EventEmitter(), { pid: 123, exitCode: 0, signalCode: null })
      const closeWitness = createNodeCloseWitness(child)
      const receipt = makeSpawnReceipt({ kind: 'test', executable: inputs.node, argv: [], run, environment: {}, child, closeWitness })
      run.registerChild(receipt)
      if (mode !== 'unclosed') child.emit('close', 0, null)
      const execFile = mode === 'listener' ? async () => ({ stdout: 'p123\nn127.0.0.1:32001\n' }) : noMatches
      const operation = retireIncompleteChildReceipt(receipt, { run, validated, listenerPort: 32001, waitForExit: async () => {}, assertListenerAbsent: (port: number, identity: any) => assertListenerAbsent(port, identity, { execFile }) })
      if (mode === 'pass') { await operation; expect(run.activeChildren.size).toBe(0) }
      else { await expect(operation).rejects.toThrow(mode === 'unclosed' ? 'STAGE3A_PROCESS_STOP_TIMEOUT' : 'STAGE3A_LISTENER_REMAINED'); expect(run.activeChildren.size).toBe(1) }
    })
  })
  it.each(['pass','identity','inventory','staged-drift'])('freezes through the actual pack/filesystem boundary: %s', async mode => {
    await withGateWorkspace(async (run, validated) => {
      let buildReceipt: any
      const exec = vi.fn(async (_file: string, argv: string[]) => {
        if (argv[0]?.endsWith('build.mjs')) {
          buildReceipt = await buildStorageGateFixture({ outputRoot: run.runRoot })
          await filesystem.writeFile(path.join(run.runRoot, 'build-receipt.json'), JSON.stringify(buildReceipt))
          return { stdout: '', stderr: '' }
        }
        const metadata = { name: mode === 'identity' ? 'wrong-package' : buildReceipt.name, version: buildReceipt.version, filename: 'knight-dsh-pm-workbench-storage-gate-0.0.0-stage3a.tgz', files: buildReceipt.files.map(({ path, size, mode }: any) => ({ path, size, mode })) }
        if (mode === 'inventory') metadata.files.pop()
        if (mode === 'staged-drift') await filesystem.writeFile(path.join(run.packageSourceRoot, 'lib/index.js'), 'tampered')
        await filesystem.writeFile(path.join(run.packRoot, metadata.filename), 'synthetic pack bytes')
        return { stdout: JSON.stringify([metadata]), stderr: '' }
      })
      const operation = freezeProductionPackage({ inputs, run, validated }, { exec })
      if (mode === 'pass') {
        const frozen = await operation
        expect(frozen.sha256).toBe(createHash('sha256').update('synthetic pack bytes').digest('hex'))
        expect(exec.mock.calls.at(-1)?.[1]).toContain('--offline')
        expect(exec.mock.calls.at(-1)?.[1]).toContain('--ignore-scripts')
        expect(validated.assert.mock.calls.filter(([key]: string[]) => key === 'npmCli').length).toBe(2)
      } else await expect(operation).rejects.toThrow(mode === 'identity' ? 'STAGE3A_PACK_IDENTITY_INVALID' : mode === 'inventory' ? 'STAGE3A_PACK_METADATA_DRIFT' : 'STAGE3A_PACKAGE_STAGE_DRIFT')
    })
  })
})
