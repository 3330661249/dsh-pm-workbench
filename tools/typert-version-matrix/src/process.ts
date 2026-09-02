import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'

declare const approvedProgramBrand: unique symbol

export type ApprovedProgramKind =
  | 'node-runtime'
  | 'npm-cli'
  | 'typescript'
  | 'tsdown'
  | 'workspace-adapter'
  | 'assertion-child'

export interface ApprovedProgram {
  readonly kind: ApprovedProgramKind
  readonly executable: string
  readonly prefixArgs: readonly string[]
  readonly [approvedProgramBrand]: true
}

const approvedPrograms = new WeakSet<object>()

function approved(
  kind: ApprovedProgramKind,
  executable: string,
  prefixArgs: readonly string[],
): ApprovedProgram {
  const value = { kind, executable, prefixArgs } as ApprovedProgram
  approvedPrograms.add(value)
  return Object.freeze(value)
}

export function approvedRuntimeNode(): ApprovedProgram {
  return approved('node-runtime', process.execPath, [])
}

function within(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

export async function approveNodeScript(
  kind: Exclude<ApprovedProgramKind, 'node-runtime'>,
  scriptPath: string,
  allowedRoots: readonly string[],
): Promise<ApprovedProgram> {
  const scriptReal = await realpath(scriptPath)
  const roots = await Promise.all(allowedRoots.map((root) => realpath(root)))
  if (!roots.some((root) => within(root, scriptReal))) {
    throw new Error(`program ${kind} resolves outside approved roots`)
  }
  return approved(kind, process.execPath, [scriptReal])
}

export interface ProcessRequest {
  readonly program: ApprovedProgram
  readonly args: readonly string[]
  readonly cwd: string
  readonly cwdToken?: '<case-root>' | '<workspace>'
  readonly env: Readonly<Record<string, string>>
  readonly timeoutMs: number
  readonly stdoutFile: string
  readonly stderrFile: string
  readonly maxLogBytes?: number
}

export interface ProcessEvidence {
  readonly program: ApprovedProgramKind
  readonly args: readonly string[]
  readonly cwdToken: '<case-root>' | '<workspace>'
  readonly startedAt: string
  readonly durationMs: number
  readonly exitCode: number | null
  readonly signal: NodeJS.Signals | null
  readonly timedOut: boolean
  readonly stdoutSha256: string
  readonly stderrSha256: string
  readonly stdoutTruncated: boolean
  readonly stderrTruncated: boolean
}

interface BoundedCollector {
  readonly chunks: Buffer[]
  bytes: number
  truncated: boolean
}

function append(collector: BoundedCollector, chunk: Buffer, limit: number): void {
  const remaining = limit - collector.bytes
  if (remaining <= 0) {
    collector.truncated = true
    return
  }
  const kept = chunk.subarray(0, remaining)
  collector.chunks.push(kept)
  collector.bytes += kept.length
  if (kept.length < chunk.length) collector.truncated = true
}

function digest(value: Buffer): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function runProcess(request: ProcessRequest): Promise<ProcessEvidence> {
  if (!approvedPrograms.has(request.program)) throw new Error('program is not approved')
  if (!Number.isSafeInteger(request.timeoutMs) || request.timeoutMs < 1) {
    throw new Error('timeoutMs must be a positive integer')
  }
  const maxLogBytes = request.maxLogBytes ?? 1_048_576
  if (!Number.isSafeInteger(maxLogBytes) || maxLogBytes < 1) {
    throw new Error('maxLogBytes must be a positive integer')
  }
  await Promise.all([
    mkdir(path.dirname(request.stdoutFile), { recursive: true }),
    mkdir(path.dirname(request.stderrFile), { recursive: true }),
  ])

  const stdout: BoundedCollector = { chunks: [], bytes: 0, truncated: false }
  const stderr: BoundedCollector = { chunks: [], bytes: 0, truncated: false }
  const startedAt = new Date().toISOString()
  const start = Date.now()
  let timedOut = false

  const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
    (resolve, reject) => {
      const child = spawn(
        request.program.executable,
        [...request.program.prefixArgs, ...request.args],
        {
          shell: false,
          cwd: request.cwd,
          env: { ...request.env },
          stdio: ['ignore', 'pipe', 'pipe'],
        },
      )
      child.stdout.on('data', (chunk: Buffer) => append(stdout, chunk, maxLogBytes))
      child.stderr.on('data', (chunk: Buffer) => append(stderr, chunk, maxLogBytes))
      child.once('error', reject)
      const timeout = setTimeout(() => {
        timedOut = true
        child.kill('SIGTERM')
        const force = setTimeout(() => child.kill('SIGKILL'), 5_000)
        force.unref()
      }, request.timeoutMs)
      timeout.unref()
      child.once('close', (code, signal) => {
        clearTimeout(timeout)
        resolve({ code, signal })
      })
    },
  )

  const stdoutBuffer = Buffer.concat(stdout.chunks)
  const stderrBuffer = Buffer.concat(stderr.chunks)
  await Promise.all([
    writeFile(request.stdoutFile, stdoutBuffer, { flag: 'wx' }),
    writeFile(request.stderrFile, stderrBuffer, { flag: 'wx' }),
  ])
  return {
    program: request.program.kind,
    args: [...request.program.prefixArgs, ...request.args],
    cwdToken: request.cwdToken ?? '<case-root>',
    startedAt,
    durationMs: Date.now() - start,
    exitCode: outcome.code,
    signal: outcome.signal,
    timedOut,
    stdoutSha256: digest(stdoutBuffer),
    stderrSha256: digest(stderrBuffer),
    stdoutTruncated: stdout.truncated,
    stderrTruncated: stderr.truncated,
  }
}
