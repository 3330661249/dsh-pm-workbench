import { execFile as execFileCallback } from 'node:child_process'
import {
  mkdtemp,
  open as openFile,
  realpath,
  rename,
  rm,
  symlink,
  truncate,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { afterEach, expect, test, vi } from 'vitest'

import {
  canonicalStage2Result,
  readBoundedStage2ResultHandle,
  readBoundedStage2ResultFile,
} from '../../scripts/verify-stage-2-smoke-result.mjs'

const execFile = promisify(execFileCallback)
const repositoryRoot = path.resolve(import.meta.dirname, '../..')
const verifierPath = path.join(repositoryRoot, 'scripts/verify-stage-2-smoke-result.mjs')
const maximumResultBytes = 1024 * 1024
const temporaryRoots: string[] = []

function closedSafetyAbortResult() {
  return {
    schemaVersion: '1',
    outcome: 'SAFETY_ABORT',
    harnessTarget: '0.1.0-rc.6',
    plugin: {
      name: '@knight/dsh-pm-workbench',
      version: '0.1.0',
      tgzSha256: null,
    },
    phases: [],
    process: {
      spawnReceipts: 0,
      listenerWitnesses: 0,
      allLoopback: true,
      allStopped: true,
      freshBrowserProfiles: 0,
    },
    network: {
      scope: 'browser-page-target',
      externalAttempts: 0,
    },
    cleanup: {
      renamed: false,
      revalidated: false,
      removed: false,
    },
    failure: { code: 'STAGE2_INPUT_INVALID' },
  }
}

async function makeTemporaryRoot() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'stage-2-result-boundary-'))
  const canonicalRoot = await realpath(root)
  temporaryRoots.push(canonicalRoot)
  return canonicalRoot
}

async function runVerifier(resultPath: string) {
  return execFile(process.execPath, [verifierPath, '--result', resultPath], {
    cwd: repositoryRoot,
    env: {},
  })
}

function regularStats(size: bigint) {
  return {
    dev: 1n,
    ino: 2n,
    mode: 0o100600n,
    nlink: 1n,
    size,
    mtimeNs: 3n,
    ctimeNs: 4n,
    isFile: () => true,
    isSymbolicLink: () => false,
  }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })))
})

test('the opened handle rejects an oversized result before reading any bytes', async () => {
  const readFile = vi.fn(async () => Buffer.from('{}\n'))
  const handle = {
    stat: vi.fn(async () => regularStats(BigInt(maximumResultBytes + 1))),
    readFile,
  }

  await expect(readBoundedStage2ResultHandle(handle as never)).rejects.toThrow(/STAGE2_RESULT_INVALID/u)
  expect(readFile).not.toHaveBeenCalled()
})

test('the bounded reader rejects a pathname swapped immediately before open', async () => {
  const root = await makeTemporaryRoot()
  const resultPath = path.join(root, 'result.json')
  const replacementPath = path.join(root, 'replacement.json')
  const bytes = canonicalStage2Result(closedSafetyAbortResult())
  await Promise.all([
    writeFile(resultPath, bytes),
    writeFile(replacementPath, bytes),
  ])

  await expect(readBoundedStage2ResultFile(resultPath, {
    openFile: async (candidate: string, flags: number) => {
      await rename(replacementPath, resultPath)
      return openFile(candidate, flags)
    },
  } as never)).rejects.toThrow(/STAGE2_RESULT_INVALID/u)
})

test('the bounded reader rejects a pathname swapped after the handle is read', async () => {
  const root = await makeTemporaryRoot()
  const resultPath = path.join(root, 'result.json')
  const replacementPath = path.join(root, 'replacement.json')
  const bytes = canonicalStage2Result(closedSafetyAbortResult())
  await Promise.all([
    writeFile(resultPath, bytes),
    writeFile(replacementPath, bytes),
  ])

  await expect(readBoundedStage2ResultFile(resultPath, {
    openFile: async (candidate: string, flags: number) => {
      const handle = await openFile(candidate, flags)
      return {
        stat: handle.stat.bind(handle),
        readFile: async () => {
          const read = await handle.readFile()
          await rename(replacementPath, resultPath)
          return read
        },
        close: handle.close.bind(handle),
      }
    },
  } as never)).rejects.toThrow(/STAGE2_RESULT_INVALID/u)
})

test('the verifier CLI accepts one exact canonical result file', async () => {
  const root = await makeTemporaryRoot()
  const resultPath = path.join(root, 'result.json')
  await writeFile(resultPath, canonicalStage2Result(closedSafetyAbortResult()))

  const result = await runVerifier(resultPath)

  expect(result.stderr).toBe('')
  expect(result.stdout).toContain('outcome SAFETY_ABORT')
})

test('the verifier CLI rejects a result file larger than one MiB', async () => {
  const root = await makeTemporaryRoot()
  const resultPath = path.join(root, 'result.json')
  await writeFile(resultPath, '')
  await truncate(resultPath, maximumResultBytes + 1)

  await expect(runVerifier(resultPath)).rejects.toMatchObject({
    code: 1,
    stdout: '',
    stderr: 'STAGE2_RESULT_INVALID\n',
  })
})

test('the verifier CLI rejects a symlink even when its target is canonical', async () => {
  const root = await makeTemporaryRoot()
  const targetPath = path.join(root, 'target.json')
  const resultPath = path.join(root, 'result.json')
  await writeFile(targetPath, canonicalStage2Result(closedSafetyAbortResult()))
  await symlink(targetPath, resultPath)

  await expect(runVerifier(resultPath)).rejects.toMatchObject({
    code: 1,
    stdout: '',
    stderr: 'STAGE2_RESULT_INVALID\n',
  })
})

test('the verifier CLI rejects valid data serialized with noncanonical bytes', async () => {
  const root = await makeTemporaryRoot()
  const resultPath = path.join(root, 'result.json')
  await writeFile(resultPath, `${JSON.stringify(closedSafetyAbortResult(), null, 2)}\n`)

  await expect(runVerifier(resultPath)).rejects.toMatchObject({
    code: 1,
    stdout: '',
    stderr: 'STAGE2_RESULT_INVALID\n',
  })
})
