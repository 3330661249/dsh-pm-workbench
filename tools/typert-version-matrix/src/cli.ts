#!/usr/bin/env node
import { mkdir, readFile, realpath, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { aggregateMatrix } from './aggregate.js'
import { allocateCasePaths, assertLexicallyWithin, resolveNewRunRoot } from './boundaries.js'
import { parseCliArguments } from './cli-args.js'
import { parseMatrixConfig } from './config.js'
import { verifyFixture } from './fixture.js'
import { renderJUnit } from './report-junit.js'
import { parseAndVerifyReport, serializeMatrixReport } from './report-json.js'
import { renderMarkdown } from './report-markdown.js'
import { runCase } from './run-case.js'

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
  return parseMatrixConfig(JSON.parse(await readFile(resolved, 'utf8')))
}

async function runCli(): Promise<number> {
  const args = parseCliArguments(process.argv.slice(2))
  const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const repositoryRoot = path.resolve(toolRoot, '../..')
  const fixtureRoot = path.join(toolRoot, 'fixtures/strict-remote-v1')

  if (args.command === 'validate') {
    const config = await loadConfig(repositoryRoot, toolRoot, args.matrix)
    const fixture = await verifyFixture(fixtureRoot)
    process.stdout.write(`VALID ${config.cases.length} cases fixture=${fixture.aggregateSha256}\n`)
    return 0
  }

  if (args.command === 'verify-report') {
    const input = resolveInput(repositoryRoot, args.input)
    const report = parseAndVerifyReport(await readFile(input, 'utf8'))
    process.stdout.write(`VALID_REPORT ${report.runId} exit=${report.exitCode}\n`)
    return 0
  }

  const config = await loadConfig(repositoryRoot, toolRoot, args.matrix)
  if (process.versions.node !== config.runtime.node) {
    throw new Error(`Node version mismatch: expected ${config.runtime.node}`)
  }
  const npmManifest = JSON.parse(await readFile(path.join(toolRoot, 'node_modules/npm/package.json'), 'utf8')) as { version?: unknown }
  if (npmManifest.version !== config.runtime.npmCli) {
    throw new Error(`npm CLI version mismatch: expected ${config.runtime.npmCli}`)
  }
  await verifyFixture(fixtureRoot)
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

  const cases = []
  for (const matrixCase of config.cases) {
    const paths = allocateCasePaths(runRoot, matrixCase.id)
    const evidence = await runCase({
      repositoryRoot,
      toolRoot,
      fixtureRoot,
      locksRoot: path.join(toolRoot, 'locks'),
      config,
      matrixCase,
      paths,
      lockMode: args.lockMode,
      ...(args.platformKey === undefined ? {} : { platformKey: args.platformKey }),
    })
    cases.push(evidence)
    await atomicWrite(paths.evidence, `${JSON.stringify(evidence, null, 2)}\n`)
    await atomicWrite(paths.report, `# ${matrixCase.id}\n\nResult: \`${evidence.status}\`\n`)
  }
  const report = aggregateMatrix(config, cases, {
    runId,
    platform: process.platform,
    arch: process.arch,
    node: process.versions.node,
    npmCli: String(npmManifest.version),
  })
  const canonical = serializeMatrixReport(report)
  parseAndVerifyReport(canonical)
  await atomicWrite(path.join(runRoot, 'matrix.json'), canonical)
  await atomicWrite(path.join(runRoot, 'matrix.md'), renderMarkdown(report))
  await atomicWrite(path.join(runRoot, 'junit.xml'), renderJUnit(report))
  await atomicWrite(
    path.join(runRoot, 'run.final.json'),
    `${JSON.stringify({ schemaVersion: '1', runId, state: 'FINAL', exitCode: report.exitCode }, null, 2)}\n`,
  )
  process.stdout.write(`MATRIX ${runId} decision=${report.decision} exit=${report.exitCode}\n`)
  return report.exitCode
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
