import { expect, test } from 'vitest'
import { AdapterEvidenceError, CompatibilityEvidenceError } from '../src/assertions/errors.js'
import { LockEvidenceError } from '../src/lockfile.js'
import { RegistryEvidenceError } from '../src/registry.js'
import { approvedRuntimeNode, type ProcessEvidence } from '../src/process.js'
import {
  buildProcessRequest,
  classifyCaseFailure,
  ensureProcessSuccess,
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
