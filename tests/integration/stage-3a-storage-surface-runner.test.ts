import { apply as applyGateHost } from './fixtures/stage3a-storage-gate/host.js'
import { assertNoStorageGateDiagnostics } from '../../scripts/verify-package.mjs'
import { describe, expect, it } from 'vitest'
import { mkdtemp, realpath, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { buildStorageGateFixture } from './fixtures/stage3a-storage-gate/build.mjs'
import { executeStorageGate, STAGE3A_PHASES, verifyToolFile, parseStage3aArgs } from '../../scripts/run-stage-3a-storage-surface-gate.mjs'
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
  it.each(['symlink', 'noncanonical', 'nonexecutable', 'drift'])('rejects %s tool input through the filesystem port', async mode => {
    const stats = { isFile: () => true, isSymbolicLink: () => mode === 'symlink', mode: mode === 'nonexecutable' ? 0o644 : 0o755, dev: 1, ino: 2, size: 4, mtimeMs: 1, ctimeMs: 1 }
    let reads = 0
    const fs = { lstat: async () => stats, realpath: async () => mode === 'noncanonical' ? '/other/tool' : '/accepted/tool', readFile: async () => Buffer.from(mode === 'drift' && reads++ > 0 ? 'evil' : 'safe') }
    await expect(verifyToolFile('/accepted/tool', { fs, expected: mode === 'drift' ? { ...stats, sha256: hash } : undefined })).rejects.toThrow()
  })
  it('rejects noncanonical lexical inputs instead of normalizing them', () => {
    expect(() => parseStage3aArgs(['--node', '/accepted/../node'], { processExecPath: '/node' })).toThrow()
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
