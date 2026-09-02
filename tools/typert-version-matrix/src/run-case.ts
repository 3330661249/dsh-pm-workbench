import { createRequire } from 'node:module'
import { constants as fsConstants } from 'node:fs'
import { copyFile, readFile, realpath, rm, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import type { CasePaths } from './boundaries.js'
import {
  buildCaseCommandPlan,
  timeoutMsForStage,
  type LockMode,
  type PlannedCommand,
} from './command-plan.js'
import { buildChildEnvironment } from './environment.js'
import { validateInstalledGraph, validatePackageLock, LockEvidenceError } from './lockfile.js'
import {
  approveNodeScript,
  runProcess,
  type ApprovedProgram,
  type ProcessEvidence,
  type ProcessRequest,
} from './process.js'
import { parseRegistryMetadata, RegistryEvidenceError } from './registry.js'
import { validateStrictDescriptors } from './assertions/descriptors.js'
import { AdapterEvidenceError, CompatibilityEvidenceError } from './assertions/errors.js'
import {
  assertArtifactsAbsent,
  inspectGeneratedArtifacts,
} from './assertions/artifacts.js'
import {
  validateDirectGeneration,
  type DirectGeneratorEvidence,
} from './assertions/generation.js'
import type {
  AssertionResult,
  CaseEvidence,
  CaseStatus,
  MatrixCase,
  MatrixConfig,
  RegistryEvidence,
} from './types.js'
import { materializeCaseWorkspace, verifyWorkspaceLink } from './workspace.js'
import { REQUIRED_PASS_ASSERTIONS } from './aggregate.js'

export function classifyCaseFailure(error: unknown): { status: CaseStatus; code: string } {
  if (error instanceof RegistryEvidenceError) {
    return { status: 'INCONCLUSIVE_REGISTRY', code: 'REGISTRY_EVIDENCE' }
  }
  if (error instanceof LockEvidenceError) {
    return { status: 'INCONCLUSIVE_LOCK', code: 'LOCK_EVIDENCE' }
  }
  if (error instanceof AdapterEvidenceError) {
    return { status: 'INCONCLUSIVE_ADAPTER', code: 'ADAPTER_EVIDENCE' }
  }
  if (error instanceof CompatibilityEvidenceError) {
    return { status: 'FAIL_COMPATIBILITY', code: error.code }
  }
  return { status: 'INFRA_ERROR', code: 'RUNNER_OR_INFRA_ERROR' }
}

function safeStage(evidence: ProcessEvidence, paths: CasePaths, repositoryRoot: string): ProcessEvidence {
  const replacements: Array<[string, string]> = [
    [paths.workspace, '<workspace>'],
    [paths.root, '<case-root>'],
    [path.dirname(path.dirname(paths.root)), '<run-root>'],
    [repositoryRoot, '<repo>'],
  ]
  const safeArg = (input: string) => replacements.reduce(
    (value, [root, token]) => value.replaceAll(root, token),
    input,
  )
  return { ...evidence, args: evidence.args.map(safeArg) }
}

async function packageBin(
  workspaceRoot: string,
  packageName: string,
  binName: string,
  kind: 'typescript' | 'tsdown',
): Promise<ApprovedProgram> {
  const require = createRequire(path.join(workspaceRoot, 'package.json'))
  const manifestPath = require.resolve(`${packageName}/package.json`)
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8')) as {
    bin?: string | Record<string, string>
  }
  const relative = typeof manifest.bin === 'string' ? manifest.bin : manifest.bin?.[binName]
  if (relative === undefined) throw new Error(`${packageName} has no reviewed ${binName} bin`)
  return approveNodeScript(kind, path.resolve(path.dirname(manifestPath), relative), [
    path.join(workspaceRoot, 'node_modules'),
  ])
}

async function npmProgram(toolRoot: string): Promise<ApprovedProgram> {
  return approveNodeScript(
    'npm-cli',
    path.join(toolRoot, 'node_modules/npm/bin/npm-cli.js'),
    [path.join(toolRoot, 'node_modules')],
  )
}

function stageLogName(command: PlannedCommand, ordinal: number): string {
  return `${String(ordinal).padStart(2, '0')}-${command.stage}`
}

export function ensureProcessSuccess(
  evidence: ProcessEvidence,
  kind: 'registry' | 'lock' | 'compatibility' | 'adapter',
  code: string,
): void {
  if (evidence.timedOut || evidence.signal !== null) throw new Error(`${code}: process timed out or was signalled`)
  if (evidence.exitCode === 0) return
  if (kind === 'registry') throw new RegistryEvidenceError(`${code}: npm registry command failed`)
  if (kind === 'lock') throw new LockEvidenceError(`${code}: dependency command failed`)
  if (kind === 'adapter') throw new AdapterEvidenceError(`${code}: reviewed adapter process failed`)
  throw new CompatibilityEvidenceError(code, `${code}: compatibility stage failed`)
}

function packFileInventory(value: unknown): string[] {
  const entry = Array.isArray(value) ? value[0] : value
  if (typeof entry !== 'object' || entry === null || !Array.isArray((entry as { files?: unknown }).files)) {
    throw new CompatibilityEvidenceError('PACK_OUTPUT_INVALID', 'npm pack dry-run output is invalid')
  }
  return (entry as { files: Array<{ path?: unknown }> }).files.map(({ path: file }) => {
    if (typeof file !== 'string') throw new CompatibilityEvidenceError('PACK_OUTPUT_INVALID', 'pack file path is invalid')
    return file
  })
}

export interface RunCaseRequest {
  readonly repositoryRoot: string
  readonly toolRoot: string
  readonly fixtureRoot: string
  readonly locksRoot: string
  readonly config: MatrixConfig
  readonly matrixCase: MatrixCase
  readonly paths: CasePaths
  readonly lockMode: LockMode
  readonly platformKey?: string
}

export function buildProcessRequest(
  command: PlannedCommand,
  request: Omit<ProcessRequest, 'args' | 'timeoutMs'>,
): ProcessRequest {
  const reviewedTimeoutMs = timeoutMsForStage(command.stage)
  if (command.timeoutMs !== reviewedTimeoutMs) {
    throw new Error(`planned command violates timeout policy for ${command.stage}`)
  }
  return {
    ...request,
    args: command.args,
    timeoutMs: reviewedTimeoutMs,
  }
}

export async function runCase(request: RunCaseRequest): Promise<CaseEvidence> {
  let stage = 'preflight'
  const stages: ProcessEvidence[] = []
  const registry: RegistryEvidence[] = []
  let lockSha256: string | undefined
  let installedGraphSha256: string | undefined
  let directGenerator: DirectGeneratorEvidence | undefined
  let artifacts: CaseEvidence['artifacts'] = []
  const execute = async (
    command: PlannedCommand,
    program: ApprovedProgram,
    ordinal: number,
  ): Promise<ProcessEvidence> => {
    const log = stageLogName(command, ordinal)
    const raw = await runProcess(buildProcessRequest(command, {
      program,
      cwd: request.paths.workspace,
      cwdToken: '<workspace>',
      env: buildChildEnvironment(process.env, request.paths),
      stdoutFile: path.join(request.paths.logs, `${log}.stdout.log`),
      stderrFile: path.join(request.paths.logs, `${log}.stderr.log`),
    }))
    const safe = safeStage(raw, request.paths, request.repositoryRoot)
    stages.push(safe)
    return raw
  }

  try {
    stage = 'workspace'
    await materializeCaseWorkspace(
      request.fixtureRoot,
      request.paths,
      request.config,
      request.matrixCase,
    )
    const plan = buildCaseCommandPlan(
      request.config,
      request.matrixCase,
      request.paths,
      request.lockMode,
    )
    const npm = await npmProgram(request.toolRoot)

    stage = 'registry'
    for (let index = 0; index < 5; index += 1) {
      const command = plan[index]!
      const processEvidence = await execute(command, npm, index)
      ensureProcessSuccess(processEvidence, 'registry', 'REGISTRY_QUERY_FAILED')
      const raw = JSON.parse(await readFile(
        path.join(request.paths.logs, `${stageLogName(command, index)}.stdout.log`),
        'utf8',
      ))
      const coordinate = command.args[1]!
      const at = coordinate.lastIndexOf('@')
      const name = coordinate.slice(0, at) as RegistryEvidence['name']
      const version = coordinate.slice(at + 1)
      registry.push(parseRegistryMetadata(name, version, raw, new Date().toISOString()))
    }

    stage = 'lock'
    const lockCommand = plan[5]!
    const workspaceLock = path.join(request.paths.workspace, 'package-lock.json')
    if (request.lockMode === 'resolve') {
      const resolved = await execute(lockCommand, npm, 5)
      ensureProcessSuccess(resolved, 'lock', 'LOCK_RESOLUTION_FAILED')
      const rawLock = await readFile(workspaceLock, 'utf8')
      lockSha256 = validatePackageLock(rawLock, request.matrixCase, request.config.toolchain).lockSha256
      await copyFile(
        workspaceLock,
        path.join(request.paths.proposedLock, `${request.matrixCase.id}.package-lock.json`),
        fsConstants.COPYFILE_EXCL,
      )
    } else {
      if (request.platformKey === undefined) throw new LockEvidenceError('frozen mode has no platform key')
      const frozen = path.join(
        request.locksRoot,
        request.platformKey,
        `${request.matrixCase.id}.package-lock.json`,
      )
      try {
        await copyFile(frozen, workspaceLock, fsConstants.COPYFILE_EXCL)
      } catch (error) {
        throw new LockEvidenceError(`frozen lock is unavailable: ${String(error)}`)
      }
      lockSha256 = validatePackageLock(
        await readFile(workspaceLock, 'utf8'),
        request.matrixCase,
        request.config.toolchain,
      ).lockSha256
    }

    stage = 'install'
    const install = await execute(plan[6]!, npm, 6)
    ensureProcessSuccess(install, 'lock', 'NPM_CI_FAILED')
    const tree = await execute(plan[7]!, npm, 7)
    ensureProcessSuccess(tree, 'lock', 'NPM_LS_FAILED')
    const treeJson = JSON.parse(await readFile(
      path.join(request.paths.logs, `${stageLogName(plan[7]!, 7)}.stdout.log`),
      'utf8',
    ))
    installedGraphSha256 = validateInstalledGraph(
      treeJson,
      request.matrixCase,
      request.config.toolchain,
    ).installedGraphSha256
    await verifyWorkspaceLink(request.paths.workspace)

    const probeRoot = path.join(request.paths.workspace, 'packages/probe')
    await rm(path.join(probeRoot, 'lib'), { recursive: true, force: true })
    await mkdir(path.join(probeRoot, 'lib'), { recursive: true })
    await assertArtifactsAbsent(probeRoot)
    const generationStartedAtMs = Date.now()

    stage = 'compile'
    const tsc = await packageBin(request.paths.workspace, 'typescript', 'tsc', 'typescript')
    const compile = await execute(plan[8]!, tsc, 8)
    ensureProcessSuccess(compile, 'compatibility', 'TYPESCRIPT_FAILED')

    stage = 'direct-generator'
    const adapter = await approveNodeScript(
      'workspace-adapter',
      path.join(request.toolRoot, 'dist/adapters/workspace-v1.js'),
      [path.join(request.toolRoot, 'dist')],
    )
    const directProcess = await execute(plan[9]!, adapter, 9)
    ensureProcessSuccess(directProcess, 'adapter', 'ADAPTER_FAILED')
    directGenerator = JSON.parse(await readFile(
      path.join(request.paths.logs, 'direct-generator.json'),
      'utf8',
    )) as DirectGeneratorEvidence
    let directFailure: unknown
    let expected: ReturnType<typeof validateDirectGeneration> | undefined
    try {
      expected = validateDirectGeneration(directGenerator)
    } catch (error) {
      directFailure = error
    }

    stage = 'tsdown'
    const tsdown = await packageBin(request.paths.workspace, 'tsdown', 'tsdown', 'tsdown')
    const tsdownProcess = await execute(plan[10]!, tsdown, 10)
    ensureProcessSuccess(tsdownProcess, 'compatibility', 'TSDOWN_FAILED')
    if (directFailure !== undefined) {
      stage = 'direct-generator'
      throw directFailure
    }
    if (expected === undefined) throw new Error('direct generation result was not classified')

    stage = 'pack-dry-run'
    const pack = await execute(plan[11]!, npm, 11)
    ensureProcessSuccess(pack, 'compatibility', 'PACK_DRY_RUN_FAILED')
    const packJson = JSON.parse(await readFile(
      path.join(request.paths.logs, `${stageLogName(plan[11]!, 11)}.stdout.log`),
      'utf8',
    ))
    const manifest = JSON.parse(await readFile(path.join(probeRoot, 'package.json'), 'utf8'))
    artifacts = await inspectGeneratedArtifacts({
      probeRoot,
      expected,
      startedAtMs: generationStartedAtMs,
      manifest,
      packFiles: packFileInventory(packJson),
    })

    stage = 'descriptors'
    const nonce = encodeURIComponent(`${request.matrixCase.id}-${Date.now()}`)
    const host = await import(`${pathToFileURL(path.join(probeRoot, 'lib/typert.host.js')).href}?matrix=${nonce}`)
    const remote = await import(`${pathToFileURL(path.join(probeRoot, 'lib/typert.remote-client.js')).href}?matrix=${nonce}`)
    validateStrictDescriptors(host, remote)

    const assertions: AssertionResult[] = REQUIRED_PASS_ASSERTIONS.map((id) => ({
      id,
      status: 'PASS',
      expected: true,
      actualSummary: true,
      evidenceRefs: [],
    }))
    return {
      schemaVersion: '1',
      case: request.matrixCase,
      status: 'PASS',
      assertions,
      artifacts,
      lockSha256,
      installedGraphSha256,
      registry,
      stages,
      directGenerator,
      nonDecisiveDiagnostics: { ordinaryBundleIsDecisive: false },
    }
  } catch (error) {
    const failure = classifyCaseFailure(error)
    return {
      schemaVersion: '1',
      case: request.matrixCase,
      status: failure.status,
      assertions: [{
        id: stage === 'direct-generator' ? 'B03' : 'EVIDENCE',
        status: 'FAIL',
        expected: 'reviewed stage evidence',
        actualSummary: failure.code,
        evidenceRefs: [],
      }],
      artifacts,
      ...(lockSha256 === undefined ? {} : { lockSha256 }),
      ...(installedGraphSha256 === undefined ? {} : { installedGraphSha256 }),
      ...(registry.length === 0 ? {} : { registry }),
      stages,
      ...(directGenerator === undefined ? {} : { directGenerator }),
      failure: { code: failure.code, stage },
      nonDecisiveDiagnostics: { ordinaryBundleIsDecisive: false },
    }
  }
}
