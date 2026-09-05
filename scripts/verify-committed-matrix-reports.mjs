#!/usr/bin/env node
import { lstat, readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const REPORT_JSON = /^([a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?)-matrix\.json$/u
const REPORT_MARKDOWN = /^([a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?)-matrix\.md$/u
const REPORT_JUNIT = /^([a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?)-junit\.xml$/u
const DIRECTORY = /^[a-z0-9](?:[a-z0-9.-]{0,126}[a-z0-9])?$/u

function parseArguments(argv) {
  if (argv.length % 2 !== 0) throw new Error('every flag requires one value')
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (!['--repository-root', '--results-root', '--runner'].includes(flag)) {
      throw new Error(`unknown flag ${flag ?? ''}`)
    }
    if (values.has(flag)) throw new Error(`duplicate flag ${flag}`)
    if (value === undefined || value.length === 0) throw new Error(`missing value for ${flag}`)
    values.set(flag, value)
  }
  return {
    repositoryRoot: path.resolve(values.get('--repository-root') ?? process.cwd()),
    resultsRoot: values.get('--results-root') ?? 'docs/matrix-results',
    runner: values.get('--runner') ?? 'tools/typert-version-matrix/dist/cli.js',
  }
}

function resolveRepositoryPath(repositoryRoot, candidate, label) {
  if (path.isAbsolute(candidate) || candidate.split(/[\\/]/u).includes('..')) {
    throw new Error(`${label} must be a repository-relative traversal-free path`)
  }
  const resolved = path.resolve(repositoryRoot, candidate)
  const relative = path.relative(repositoryRoot, resolved)
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`${label} must be below the repository root`)
  }
  return resolved
}

async function walk(directory, root, files) {
  const entries = await readdir(directory, { withFileTypes: true })
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const target = path.join(directory, entry.name)
    const relative = path.relative(root, target).split(path.sep).join('/')
    if (entry.isSymbolicLink()) throw new Error(`matrix results contain a symlink: ${relative}`)
    if (entry.isDirectory()) {
      if (!DIRECTORY.test(entry.name)) throw new Error(`matrix result directory has an abnormal name: ${relative}`)
      await walk(target, root, files)
      continue
    }
    if (!entry.isFile()) throw new Error(`matrix results contain a non-regular entry: ${relative}`)
    files.push(relative)
  }
}

export async function enumerateCommittedMatrixReports(resultsRoot) {
  let rootInfo
  try {
    rootInfo = await lstat(resultsRoot)
  } catch (error) {
    if (error && typeof error === 'object' && error.code === 'ENOENT') return []
    throw error
  }
  if (rootInfo.isSymbolicLink() || !rootInfo.isDirectory()) {
    throw new Error('matrix results root must be a real directory')
  }

  const files = []
  await walk(resultsRoot, resultsRoot, files)
  const groups = new Map()
  for (const relative of files) {
    const base = path.posix.basename(relative)
    if (base === 'README.md') continue
    const directory = path.posix.dirname(relative)
    const json = base.match(REPORT_JSON)
    const markdown = base.match(REPORT_MARKDOWN)
    const junit = base.match(REPORT_JUNIT)
    const match = json ?? markdown ?? junit
    if (match === null) throw new Error(`matrix results contain an abnormal file name: ${relative}`)
    const key = `${directory}/${match[1]}`
    const group = groups.get(key) ?? { directory, stem: match[1], json: false, markdown: false, junit: false }
    if (json !== null) group.json = true
    if (markdown !== null) group.markdown = true
    if (junit !== null) group.junit = true
    groups.set(key, group)
  }

  const reports = []
  for (const group of [...groups.values()].sort((left, right) => {
    return `${left.directory}/${left.stem}`.localeCompare(`${right.directory}/${right.stem}`)
  })) {
    if (!group.json || !group.markdown || !group.junit) {
      throw new Error(`matrix report set is incomplete: ${group.directory}/${group.stem}`)
    }
    reports.push(path.posix.join(group.directory, `${group.stem}-matrix.json`))
  }
  return reports
}

export async function verifyCommittedMatrixReports(options) {
  const resultsRoot = resolveRepositoryPath(options.repositoryRoot, options.resultsRoot, 'results root')
  const runner = resolveRepositoryPath(options.repositoryRoot, options.runner, 'runner')
  const runnerInfo = await lstat(runner)
  if (runnerInfo.isSymbolicLink() || !runnerInfo.isFile()) {
    throw new Error('matrix runner must be a real regular file')
  }
  const reports = await enumerateCommittedMatrixReports(resultsRoot)
  if (reports.length === 0) {
    process.stdout.write('NO_COMMITTED_MATRIX_REPORTS count=0\n')
    return 0
  }

  const runnerDirectory = path.dirname(runner)
  const modulePaths = {
    json: path.join(runnerDirectory, 'report-json.js'),
    markdown: path.join(runnerDirectory, 'report-markdown.js'),
    junit: path.join(runnerDirectory, 'report-junit.js'),
  }
  for (const [label, modulePath] of Object.entries(modulePaths)) {
    const info = await lstat(modulePath)
    if (info.isSymbolicLink() || !info.isFile()) {
      throw new Error(`matrix runner ${label} renderer must be a real regular file`)
    }
  }
  const [jsonModule, markdownModule, junitModule] = await Promise.all([
    import(pathToFileURL(modulePaths.json).href),
    import(pathToFileURL(modulePaths.markdown).href),
    import(pathToFileURL(modulePaths.junit).href),
  ])
  if (
    typeof jsonModule.parseAndVerifyReport !== 'function'
    || typeof markdownModule.renderMarkdown !== 'function'
    || typeof junitModule.renderJUnit !== 'function'
  ) throw new Error('matrix runner report renderer exports are invalid')

  for (const reportWithinResults of reports) {
    const input = path.posix.join(options.resultsRoot.split(path.sep).join('/'), reportWithinResults)
    const result = spawnSync(process.execPath, [runner, 'verify-report', '--input', input], {
      cwd: options.repositoryRoot,
      stdio: 'inherit',
      env: { ...process.env, npm_config_offline: 'true' },
    })
    if (result.error !== undefined) throw result.error
    if (result.status !== 0) {
      throw new Error(`matrix report verifier rejected ${input} with exit ${String(result.status)}`)
    }
    const jsonPath = path.join(resultsRoot, ...reportWithinResults.split('/'))
    const markdownPath = jsonPath.replace(/-matrix\.json$/u, '-matrix.md')
    const junitPath = jsonPath.replace(/-matrix\.json$/u, '-junit.xml')
    const canonical = await readFile(jsonPath, 'utf8')
    const verified = jsonModule.parseAndVerifyReport(canonical)
    const expectedMarkdown = markdownModule.renderMarkdown(verified)
    const expectedJUnit = junitModule.renderJUnit(verified)
    if (typeof expectedMarkdown !== 'string' || typeof expectedJUnit !== 'string') {
      throw new Error('matrix runner report renderer returned a non-string value')
    }
    const [committedMarkdown, committedJUnit] = await Promise.all([
      readFile(markdownPath, 'utf8'),
      readFile(junitPath, 'utf8'),
    ])
    if (committedMarkdown !== expectedMarkdown) {
      throw new Error(`${path.relative(options.repositoryRoot, markdownPath)} does not match the verified JSON`)
    }
    if (committedJUnit !== expectedJUnit) {
      throw new Error(`${path.relative(options.repositoryRoot, junitPath)} does not match the verified JSON`)
    }
  }
  process.stdout.write(`VERIFIED_COMMITTED_MATRIX_REPORTS count=${reports.length}\n`)
  return reports.length
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  await verifyCommittedMatrixReports(options)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`committed matrix report verification failed: ${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
