#!/usr/bin/env node
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { aggregateMatrix } from './aggregate.js'
import { allocateCasePaths, assertLexicallyWithin, resolveNewRunRoot } from './boundaries.js'
import { parseCliArguments } from './cli-args.js'
import { parseMatrixConfig } from './config.js'
import { verifyFixture } from './fixture.js'
import {
  assertRunStateUnchanged,
  collectCleanRunnerGitProvenance,
  collectRunnerArtifactProvenance,
  createRunProvenance,
  expectedFrozenPlatformKey,
  hashConfigFileBytes,
  hashMatrixConfig,
} from './provenance.js'
import { renderJUnit } from './report-junit.js'
import { parseAndVerifyReport, serializeMatrixReport } from './report-json.js'
import { renderMarkdown } from './report-markdown.js'
import { verifyReviewedLockSet } from './reviewed-locks.js'
import { runCase } from './run-case.js'
import type { ReviewedLockEvidence } from './types.js'

const FROZEN_CONFIG_FILES = [
  'matrix.official.json',
  'matrix.official-experimental.json',
] as const

async function atomicWrite(target: string, content: string): Promise<void> {
  const temporary = `${target}.tmp-${process.pid}`
  await writeFile(temporary, content, { flag: 'wx' })
  await rename(temporary, target)
}

function resolveInput(repositoryRoot: string, input: string): string {
  if (path.isAbsolute(input) || input.split(/[\\/]/u).includes('..')) {
    throw new Error('input path must be relative and traversal-free')
  }
  const resolved = path.resolve(repositoryRoot, input)
  assertLexicallyWithin(repositoryRoot, resolved, 'input path')
  return resolved
}

async function loadConfig(repositoryRoot: string, toolRoot: string, input: string) {
  const resolved = resolveInput(repositoryRoot, input)
  assertLexicallyWithin(path.join(toolRoot, 'config'), resolved, 'matrix config')
  const raw = await readFile(resolved)
  const config = parseMatrixConfig(JSON.parse(raw.toString('utf8')))
  return {
    config,
    configFileSha256: hashConfigFileBytes(raw),
    resolved,
  }
}

export async function verifyFrozenLockInputs(
  repositoryRoot: string,
  toolRoot: string,
  platformKey: string,
) {
  const configs = await Promise.all(FROZEN_CONFIG_FILES.map(async (fileName) => ({
    fileName,
    config: (await loadConfig(
      repositoryRoot,
      toolRoot,
      `tools/typert-version-matrix/config/${fileName}`,
    )).config,
  })))
  return verifyReviewedLockSet({
    platformDirectory: path.join(toolRoot, 'locks', platformKey),
    configs,
  })
}

async function runCli(): Promise<number> {
  const args = parseCliArguments(process.argv.slice(2))
  const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const repositoryRoot = path.resolve(toolRoot, '../..')
  const fixtureRoot = path.join(toolRoot, 'fixtures/strict-remote-v1')

  if (args.command === 'validate') {
    const loaded = await loadConfig(repositoryRoot, toolRoot, args.matrix)
    const fixture = await verifyFixture(fixtureRoot)
    process.stdout.write(
      `VALID ${loaded.config.cases.length} cases config=${hashMatrixConfig(loaded.config)} configFile=${loaded.configFileSha256} fixture=${fixture.aggregateSha256}\n`,
    )
    return 0
  }

  if (args.command === 'verify-report') {
    const input = resolveInput(repositoryRoot, args.input)
    const report = parseAndVerifyReport(await readFile(input, 'utf8'))
    process.stdout.write(`VALID_REPORT ${report.runId} exit=${report.exitCode}\n`)
    return 0
  }

  if (args.command === 'verify-locks') {
    const result = await verifyFrozenLockInputs(repositoryRoot, toolRoot, args.platformKey)
    process.stdout.write(`VALID_LOCK_SET platform=${result.platformKey} cases=${result.caseCount}\n`)
    return 0
  }

  const initialConfig = await loadConfig(repositoryRoot, toolRoot, args.matrix)
  const config = initialConfig.config
  let reviewedCases: Readonly<Record<string, ReviewedLockEvidence>> | undefined
  if (args.lockMode === 'frozen') {
    const expectedPlatformKey = expectedFrozenPlatformKey(process.platform, process.arch, config)
    if (args.platformKey !== expectedPlatformKey) {
      throw new Error(`--platform-key must equal current runtime key ${expectedPlatformKey}`)
    }
    const selectedConfig = FROZEN_CONFIG_FILES.find((fileName) => (
      initialConfig.resolved === path.join(toolRoot, 'config', fileName)
    ))
    if (selectedConfig === undefined) {
      throw new Error('frozen mode only accepts the reviewed selection or experimental config')
    }
    const reviewed = await verifyFrozenLockInputs(repositoryRoot, toolRoot, args.platformKey)
    reviewedCases = Object.freeze(Object.fromEntries(config.cases.map((matrixCase) => {
      const hashes = reviewed.cases[matrixCase.id]
      if (hashes === undefined) {
        throw new Error(`reviewed lock set is missing selected case ${matrixCase.id}`)
      }
      return [matrixCase.id, Object.freeze({
        schemaVersion: '1' as const,
        platformKey: reviewed.platformKey,
        manifestSha256: reviewed.manifestSha256,
        manifestCaseCount: reviewed.caseCount,
        lockSha256: hashes.lockSha256,
        installedGraphSha256: hashes.installedGraphSha256,
      })]
    })))
  }
  if (process.versions.node !== config.runtime.node) {
    throw new Error(`Node version mismatch: expected ${config.runtime.node}`)
  }
  const npmManifest = JSON.parse(await readFile(path.join(toolRoot, 'node_modules/npm/package.json'), 'utf8')) as { version?: unknown }
  if (npmManifest.version !== config.runtime.npmCli) {
    throw new Error(`npm CLI version mismatch: expected ${config.runtime.npmCli}`)
  }
  const fixture = await verifyFixture(fixtureRoot)
  const runnerGit = collectCleanRunnerGitProvenance(repositoryRoot)
  const runnerArtifacts = await collectRunnerArtifactProvenance(toolRoot)
  const initialRunState = {
    configSha256: hashMatrixConfig(config),
    configFileSha256: initialConfig.configFileSha256,
    fixtureSha256: fixture.aggregateSha256,
    runnerGit,
    runnerArtifacts,
  }
  const runStartedAt = new Date().toISOString()
  await mkdir(
    path.join(repositoryRoot, '.tmp/dsh-pm-workbench/version-matrix/runs'),
    { recursive: true },
  )
  const runRoot = await resolveNewRunRoot(repositoryRoot, args.output)
  await mkdir(runRoot)
  const runId = path.basename(runRoot)
  await writeFile(
    path.join(runRoot, 'run.json'),
    `${JSON.stringify({ schemaVersion: '1', runId, state: 'RUNNING' }, null, 2)}\n`,
    { flag: 'wx' },
  )

  const caseRuns = []
  for (const matrixCase of config.cases) {
    const paths = allocateCasePaths(runRoot, matrixCase.id)
    const common = {
      repositoryRoot,
      toolRoot,
      fixtureRoot,
      locksRoot: path.join(toolRoot, 'locks'),
      config,
      matrixCase,
      paths,
      expectedFixtureSha256: fixture.aggregateSha256,
    }
    const evidence = args.lockMode === 'frozen'
      ? await runCase({
        ...common,
        lockMode: 'frozen',
        platformKey: args.platformKey!,
        reviewedLock: reviewedCases![matrixCase.id]!,
      })
      : await runCase({ ...common, lockMode: 'resolve' })
    caseRuns.push({ evidence, paths })
  }
  const finalFixture = await verifyFixture(fixtureRoot)
  if (finalFixture.aggregateSha256 !== fixture.aggregateSha256) {
    throw new Error('fixture changed during the run; final report is not admissible')
  }
  const finalConfig = await loadConfig(repositoryRoot, toolRoot, args.matrix)
  const finalRunnerGit = collectCleanRunnerGitProvenance(repositoryRoot)
  const finalRunnerArtifacts = await collectRunnerArtifactProvenance(toolRoot)
  assertRunStateUnchanged(initialRunState, {
    configSha256: hashMatrixConfig(finalConfig.config),
    configFileSha256: finalConfig.configFileSha256,
    fixtureSha256: finalFixture.aggregateSha256,
    runnerGit: finalRunnerGit,
    runnerArtifacts: finalRunnerArtifacts,
  })
  const provenance = createRunProvenance({
    config,
    configFileSha256: initialConfig.configFileSha256,
    fixtureSha256: fixture.aggregateSha256,
    runnerGit,
    runnerArtifacts,
    lockMode: args.lockMode,
    ...(args.platformKey === undefined ? {} : { platformKey: args.platformKey }),
    runStartedAt,
    runCompletedAt: new Date().toISOString(),
    env: process.env,
  })
  const cases = caseRuns.map(({ evidence }) => ({ ...evidence, provenance }))
  for (const [index, evidence] of cases.entries()) {
    const paths = caseRuns[index]!.paths
    await atomicWrite(paths.evidence, `${JSON.stringify(evidence, null, 2)}\n`)
    await atomicWrite(paths.report, `# ${evidence.case.id}\n\nResult: \`${evidence.status}\`\n`)
  }
  const report = aggregateMatrix(config, cases, {
    runId,
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    npmCli: String(npmManifest.version),
  })
  const canonical = serializeMatrixReport(report)
  const verified = parseAndVerifyReport(canonical)
  await atomicWrite(path.join(runRoot, 'matrix.json'), canonical)
  await atomicWrite(path.join(runRoot, 'matrix.md'), renderMarkdown(verified))
  await atomicWrite(path.join(runRoot, 'junit.xml'), renderJUnit(verified))
  await atomicWrite(
    path.join(runRoot, 'run.final.json'),
    `${JSON.stringify({ schemaVersion: '1', runId, state: 'FINAL', exitCode: verified.exitCode }, null, 2)}\n`,
  )
  process.stdout.write(`MATRIX ${runId} decision=${verified.decision} exit=${verified.exitCode}\n`)
  return verified.exitCode
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().then(
    (exitCode) => { process.exitCode = exitCode },
    (error: unknown) => {
      process.stderr.write(`matrix command failed: ${error instanceof Error ? error.message : String(error)}\n`)
      process.exitCode = 2
    },
  )
}

export { runCli }
