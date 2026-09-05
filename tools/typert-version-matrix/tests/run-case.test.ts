import { expect, test } from 'vitest'
import { AdapterEvidenceError, CompatibilityEvidenceError } from '../src/assertions/errors.js'
import { LockEvidenceError } from '../src/lockfile.js'
import { RegistryEvidenceError } from '../src/registry.js'
import { approveNodeScript, approvedRuntimeNode, type ProcessEvidence } from '../src/process.js'
import {
  assertReviewedCaseHash,
  buildProcessRequest,
  classifyCaseFailure,
  ensureProcessSuccess,
  executeFrozenLockPreflight,
  inspectOrdinaryBundleDiagnostic,
} from '../src/run-case.js'
import type { PlannedCommand } from '../src/command-plan.js'

test('classifies evidence gaps separately from compatibility failures', () => {
  expect(classifyCaseFailure(new RegistryEvidenceError('offline'))).toEqual({
    status: 'INCONCLUSIVE_REGISTRY', code: 'REGISTRY_EVIDENCE',
  })
  expect(classifyCaseFailure(new LockEvidenceError('drift'))).toEqual({
    status: 'INCONCLUSIVE_LOCK', code: 'LOCK_EVIDENCE',
  })
  expect(classifyCaseFailure(new AdapterEvidenceError('shape'))).toEqual({
    status: 'INCONCLUSIVE_ADAPTER', code: 'ADAPTER_EVIDENCE',
  })
  expect(classifyCaseFailure(new CompatibilityEvidenceError('ARTIFACT_MISSING', 'missing'))).toEqual({
    status: 'FAIL_COMPATIBILITY', code: 'ARTIFACT_MISSING',
  })
  expect(classifyCaseFailure(new Error('disk'))).toEqual({
    status: 'INFRA_ERROR', code: 'RUNNER_OR_INFRA_ERROR',
  })
})

test('execution request uses only the timeout carried by a reviewed planned command', () => {
  const command: PlannedCommand = {
    stage: 'resolve-lock',
    program: 'npm-cli',
    args: ['install', '--package-lock-only'],
    shell: false,
    timeoutMs: 900_000,
  }
  const request = buildProcessRequest(command, {
    program: approvedRuntimeNode(),
    cwd: '/tmp/reviewed-workspace',
    cwdToken: '<workspace>',
    env: {},
    stdoutFile: '/tmp/reviewed-stdout.log',
    stderrFile: '/tmp/reviewed-stderr.log',
  })

  expect(request.timeoutMs).toBe(900_000)
  expect(request.args).toEqual(['install', '--package-lock-only'])
  expect(() => buildProcessRequest({ ...command, timeoutMs: 1 }, {
    program: approvedRuntimeNode(),
    cwd: '/tmp/reviewed-workspace',
    cwdToken: '<workspace>',
    env: {},
    stdoutFile: '/tmp/reviewed-stdout.log',
    stderrFile: '/tmp/reviewed-stderr.log',
  })).toThrow(/timeout policy/i)
})

test('keeps a timed-out lock subprocess fail-closed as infrastructure evidence', () => {
  const timedOut: ProcessEvidence = {
    program: 'npm-cli',
    args: ['install', '--package-lock-only'],
    cwdToken: '<workspace>',
    startedAt: '2026-09-02T00:00:00.000Z',
    durationMs: 900_001,
    exitCode: null,
    signal: 'SIGTERM',
    timedOut: true,
    stdoutSha256: 'a'.repeat(64),
    stderrSha256: 'b'.repeat(64),
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutTruncated: false,
    stderrTruncated: false,
  }
  let error: unknown
  try {
    ensureProcessSuccess(timedOut, 'lock', 'LOCK_RESOLUTION_FAILED')
  } catch (caught) {
    error = caught
  }

  expect(classifyCaseFailure(error)).toEqual({
    status: 'INFRA_ERROR',
    code: 'RUNNER_OR_INFRA_ERROR',
  })

  let ordinaryNonzero: unknown
  try {
    ensureProcessSuccess(
      { ...timedOut, durationMs: 1, exitCode: 1, signal: null, timedOut: false },
      'lock',
      'LOCK_RESOLUTION_FAILED',
    )
  } catch (caught) {
    ordinaryNonzero = caught
  }
  expect(classifyCaseFailure(ordinaryNonzero)).toEqual({
    status: 'INCONCLUSIVE_LOCK',
    code: 'LOCK_EVIDENCE',
  })
})

test('executes the reviewed frozen npm ci dry-run before installation can continue', async () => {
  const command: PlannedCommand = {
    stage: 'resolve-lock',
    program: 'npm-cli',
    args: ['ci', '--dry-run', '--ignore-scripts', '--no-audit', '--no-fund'],
    shell: false,
    timeoutMs: 900_000,
  }
  const npm = await approveNodeScript(
    'npm-cli',
    path.resolve('node_modules/npm/bin/npm-cli.js'),
    [path.resolve('node_modules')],
  )
  const calls: Array<{ command: PlannedCommand; ordinal: number }> = []
  const evidence: ProcessEvidence = {
    program: 'npm-cli',
    args: [...command.args],
    cwdToken: '<workspace>',
    startedAt: '2026-09-02T00:00:00.000Z',
    durationMs: 1,
    exitCode: 0,
    signal: null,
    timedOut: false,
    stdoutSha256: 'a'.repeat(64),
    stderrSha256: 'b'.repeat(64),
    stdoutBytes: 0,
    stderrBytes: 0,
    stdoutTruncated: false,
    stderrTruncated: false,
  }

  await executeFrozenLockPreflight(command, npm, async (observed, _program, ordinal) => {
    calls.push({ command: observed, ordinal })
    return evidence
  })

  expect(calls).toEqual([{ command, ordinal: 5 }])
})

test('rejects frozen lock or installed-graph drift from the reviewed case manifest', () => {
  const reviewedLockSha256 = createHash('sha256').update('reviewed-lock').digest('hex')
  const reviewedGraphSha256 = createHash('sha256').update('reviewed-graph').digest('hex')

  expect(() => assertReviewedCaseHash(
    'lock',
    createHash('sha256').update('tampered-transitive-lock').digest('hex'),
    reviewedLockSha256,
  )).toThrow(LockEvidenceError)
  expect(() => assertReviewedCaseHash(
    'installed graph',
    createHash('sha256').update('different-installed-graph').digest('hex'),
    reviewedGraphSha256,
  )).toThrow(LockEvidenceError)
  expect(() => assertReviewedCaseHash('lock', reviewedLockSha256, reviewedLockSha256))
    .not.toThrow()
})

test('observes the ordinary bundle without making it decisive or exposing a path target', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'typert-ordinary-bundle-'))
  await mkdir(path.join(root, 'lib'))
  await expect(inspectOrdinaryBundleDiagnostic(root)).resolves.toEqual({
    path: 'lib/index.js', decisive: false, state: 'missing',
  })

  const content = 'ordinary bundle\n'
  await writeFile(path.join(root, 'lib/index.js'), content)
  await expect(inspectOrdinaryBundleDiagnostic(root)).resolves.toEqual({
    path: 'lib/index.js',
    decisive: false,
    state: 'regular-file',
    size: Buffer.byteLength(content),
    sha256: createHash('sha256').update(content).digest('hex'),
  })

  const symlinkRoot = await mkdtemp(path.join(os.tmpdir(), 'typert-ordinary-bundle-link-'))
  await mkdir(path.join(symlinkRoot, 'lib'))
  await symlink('/private/never-report-this-target', path.join(symlinkRoot, 'lib/index.js'))
  const observed = await inspectOrdinaryBundleDiagnostic(symlinkRoot)
  expect(observed).toEqual({ path: 'lib/index.js', decisive: false, state: 'symlink' })
  expect(JSON.stringify(observed)).not.toContain('/private/never-report-this-target')
})
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, symlink, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
