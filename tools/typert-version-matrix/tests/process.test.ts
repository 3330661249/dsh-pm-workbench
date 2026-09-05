import { access, mkdtemp, readFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import {
  approvedRuntimeNode,
  assertProcessTreeTerminationSupported,
  runProcess,
} from '../src/process.js'

describe('runProcess', () => {
  test('fails closed where bounded process-group termination is unavailable', () => {
    expect(() => assertProcessTreeTerminationSupported('win32')).toThrow(/process.*group|POSIX/i)
    expect(() => assertProcessTreeTerminationSupported('darwin')).not.toThrow()
    expect(() => assertProcessTreeTerminationSupported('linux')).not.toThrow()
  })

  test('passes argv literally, writes bounded case-local logs, and returns hashes', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'typert-process-'))
    const stdoutFile = path.join(root, 'stdout.log')
    const stderrFile = path.join(root, 'stderr.log')
    const suspicious = 'literal; touch never-created'

    const evidence = await runProcess({
      program: approvedRuntimeNode(),
      args: ['-e', 'console.log(process.argv[1]); console.error("stderr")', suspicious],
      cwd: root,
      env: { PATH: process.env.PATH ?? '' },
      timeoutMs: 2_000,
      stdoutFile,
      stderrFile,
      maxLogBytes: 1_024,
    })

    expect(evidence).toMatchObject({ exitCode: 0, signal: null, timedOut: false })
    expect(evidence).toMatchObject({
      stdoutBytes: Buffer.byteLength(`${suspicious}\n`),
      stderrBytes: Buffer.byteLength('stderr\n'),
    })
    expect(evidence.stdoutSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(evidence.stderrSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(await readFile(stdoutFile, 'utf8')).toBe(`${suspicious}\n`)
    expect(await readFile(stderrFile, 'utf8')).toBe('stderr\n')
  })

  test('truncates logs without treating output text as success evidence', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'typert-process-'))
    const stdoutFile = path.join(root, 'stdout.log')
    const stderrFile = path.join(root, 'stderr.log')

    const evidence = await runProcess({
      program: approvedRuntimeNode(),
      args: ['-e', 'process.stdout.write("x".repeat(4096))'],
      cwd: root,
      env: {},
      timeoutMs: 2_000,
      stdoutFile,
      stderrFile,
      maxLogBytes: 128,
    })

    expect(evidence.stdoutTruncated).toBe(true)
    expect(evidence.stdoutBytes).toBe(128)
    expect(evidence.stderrBytes).toBe(0)
    expect(Buffer.byteLength(await readFile(stdoutFile))).toBe(128)
  })

  test('marks a timed-out child as infrastructure evidence', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'typert-process-'))

    const evidence = await runProcess({
      program: approvedRuntimeNode(),
      args: ['-e', 'setInterval(() => {}, 1000)'],
      cwd: root,
      env: {},
      timeoutMs: 30,
      stdoutFile: path.join(root, 'stdout.log'),
      stderrFile: path.join(root, 'stderr.log'),
      maxLogBytes: 128,
    })

    expect(evidence.timedOut).toBe(true)
    expect(evidence.exitCode).toBeNull()
    expect(evidence.signal).toMatch(/^SIG/)
  })

  test.skipIf(process.platform === 'win32')(
    'terminates the timed-out child process group before descendants can outlive the bound',
    async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), 'typert-process-group-'))
      const marker = path.join(root, 'grandchild-survived')
      const grandchild = [
        'const { writeFileSync } = require("node:fs")',
        'setTimeout(() => writeFileSync(process.argv[1], "survived"), 700)',
      ].join(';')
      const parent = [
        'const { spawn } = require("node:child_process")',
        'spawn(process.execPath, ["-e", process.argv[1], process.argv[2]], { stdio: "inherit" })',
        'setInterval(() => {}, 1000)',
      ].join(';')

      const evidence = await runProcess({
        program: approvedRuntimeNode(),
        args: ['-e', parent, grandchild, marker],
        cwd: root,
        env: { PATH: process.env.PATH ?? '' },
        timeoutMs: 80,
        stdoutFile: path.join(root, 'stdout.log'),
        stderrFile: path.join(root, 'stderr.log'),
        maxLogBytes: 128,
      })

      expect(evidence.timedOut).toBe(true)
      expect(evidence.durationMs).toBeLessThan(400)
      await new Promise((resolve) => setTimeout(resolve, 750))
      await expect(access(marker)).rejects.toMatchObject({ code: 'ENOENT' })
    },
  )
})
