import { describe, expect, it } from 'vitest'
import { verifyStage3aStorageSurfaceResult, renderStorageGateMarkdown } from '../../scripts/verify-stage-3a-storage-surface-result.mjs'

describe('closed storage gate evidence', () => {
  it('requires every real table witness before PASS', () => {
    expect(() => verifyStage3aStorageSurfaceResult(makeStorageGateResult({ nearLimitHashAfterRestart: null })))
      .toThrowError('missing-near-limit-restart-witness')
  })
  it('rejects leaked paths and material payloads', () => {
    expect(() => verifyStage3aStorageSurfaceResult(makeStorageGateResult({ note: ['', 'private', 'profile', 'source text'].join('/') })))
      .toThrowError('unsafe-result-field')
  })
  it.each([
    { smallHashAfterRestart: 'b'.repeat(64) }, { tombstoneHiddenAfterRestart: false },
    { nearLimitHashAfterRestart: 'b'.repeat(64) }, { overLimitBackendCalls: 1 },
    { listenerCountAfterCleanup: 1 }, { childCountAfterCleanup: 1 }, { runRootExistsAfterCleanup: true },
    { externalAttempts: 1 }, { port3080Touched: true }, { restartCount: 5 }, { nearLimitBytes: 4194303 },
    { outcome: 'INCONCLUSIVE' }, { hostMetafileSha256: null }, { packageFiles: ['package/source.txt'] },
  ])('rejects incomplete or conflicting evidence %j', override => {
    expect(() => verifyStage3aStorageSurfaceResult(makeStorageGateResult(override))).toThrow()
  })
  it('renders only the closed verified receipt', () => {
    const result = makeStorageGateResult()
    expect(verifyStage3aStorageSurfaceResult(result)).toEqual(result)
    const markdown = renderStorageGateMarkdown(result)
    expect(markdown).toContain('STAGE3A_STORAGE_SURFACE=PASS')
    expect(markdown).toContain('generic public table')
    expect(markdown).not.toMatch(/\/Users\/|\/private\/|source text/)
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
