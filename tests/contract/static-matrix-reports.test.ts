import { mkdtemp, mkdir, readFile, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import { describe, expect, test } from 'vitest'

const repositoryRoot = fileURLToPath(new URL('../..', import.meta.url))
const verifier = path.join(repositoryRoot, 'scripts/verify-committed-matrix-reports.mjs')

async function fixture(): Promise<{
  readonly root: string
  readonly results: string
  readonly log: string
  readonly fakeRunner: string
}> {
  const root = await mkdtemp(path.join(tmpdir(), 'committed-matrix-reports-'))
  const results = path.join(root, 'docs/matrix-results')
  const log = path.join(root, 'verified.log')
  const runnerDirectory = path.join(root, 'runner')
  const fakeRunner = path.join(runnerDirectory, 'cli.js')
  await Promise.all([mkdir(results, { recursive: true }), mkdir(runnerDirectory)])
  await Promise.all([
    writeFile(path.join(runnerDirectory, 'package.json'), '{"type":"module"}\n'),
    writeFile(
      fakeRunner,
      [
        "import { appendFileSync } from 'node:fs'",
        "if (process.argv[2] !== 'verify-report' || process.argv[3] !== '--input' || process.argv.length !== 5) process.exit(9)",
        "appendFileSync(process.env.VERIFIED_LOG, `${process.argv[4]}\\n`)",
      ].join('\n'),
    ),
    writeFile(
      path.join(runnerDirectory, 'report-json.js'),
      'export const parseAndVerifyReport = (raw) => JSON.parse(raw)\n',
    ),
    writeFile(
      path.join(runnerDirectory, 'report-markdown.js'),
      'export const renderMarkdown = (report) => `# ${report.name}\\n`\n',
    ),
    writeFile(
      path.join(runnerDirectory, 'report-junit.js'),
      'export const renderJUnit = (report) => `<testsuites name="${report.name}"/>\\n`\n',
    ),
  ])
  return { root, results, log, fakeRunner }
}

function run(root: string, fakeRunner: string, log: string) {
  return spawnSync(process.execPath, [
    verifier,
    '--repository-root', root,
    '--results-root', 'docs/matrix-results',
    '--runner', path.relative(root, fakeRunner),
  ], {
    cwd: root,
    encoding: 'utf8',
    env: { ...process.env, VERIFIED_LOG: log },
  })
}

async function writeReportSet(results: string, stem: string): Promise<void> {
  const directory = path.join(results, '2026-09-02-darwin-arm64')
  await mkdir(directory, { recursive: true })
  await Promise.all([
    writeFile(path.join(directory, `${stem}-matrix.json`), `${JSON.stringify({ name: stem })}\n`),
    writeFile(path.join(directory, `${stem}-matrix.md`), `# ${stem}\n`),
    writeFile(path.join(directory, `${stem}-junit.xml`), `<testsuites name="${stem}"/>\n`),
  ])
}

describe('committed matrix report verification', () => {
  test('explicitly succeeds when no report set is committed', async () => {
    const { root, fakeRunner, log } = await fixture()
    const result = run(root, fakeRunner, log)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('NO_COMMITTED_MATRIX_REPORTS count=0')
  })

  test('enumerates every canonical JSON report once in stable order', async () => {
    const { root, results, fakeRunner, log } = await fixture()
    await writeReportSet(results, 'selection')
    await writeReportSet(results, 'experimental')

    const result = run(root, fakeRunner, log)

    expect(result.status).toBe(0)
    expect(result.stdout).toContain('VERIFIED_COMMITTED_MATRIX_REPORTS count=2')
    expect((await readFile(log, 'utf8')).trim().split('\n')).toEqual([
      'docs/matrix-results/2026-09-02-darwin-arm64/experimental-matrix.json',
      'docs/matrix-results/2026-09-02-darwin-arm64/selection-matrix.json',
    ])
  })

  test('fails closed on abnormal JSON names, incomplete report triples, and symlinks', async () => {
    const abnormal = await fixture()
    await writeFile(path.join(abnormal.results, 'selection.json'), '{}\n')
    expect(run(abnormal.root, abnormal.fakeRunner, abnormal.log).status).not.toBe(0)

    const incomplete = await fixture()
    const incompleteDir = path.join(incomplete.results, '2026-09-02-darwin-arm64')
    await mkdir(incompleteDir)
    await writeFile(path.join(incompleteDir, 'selection-matrix.json'), '{}\n')
    expect(run(incomplete.root, incomplete.fakeRunner, incomplete.log).status).not.toBe(0)

    const linked = await fixture()
    await symlink(linked.fakeRunner, path.join(linked.results, 'linked-matrix.json'))
    expect(run(linked.root, linked.fakeRunner, linked.log).status).not.toBe(0)
  })

  test('rejects a Markdown or JUnit companion that was not rendered from the verified JSON', async () => {
    for (const [fileName, tampered] of [
      ['selection-matrix.md', '# tampered\n'],
      ['selection-junit.xml', '<testsuites name="tampered"/>\n'],
    ] as const) {
      const candidate = await fixture()
      await writeReportSet(candidate.results, 'selection')
      await writeFile(
        path.join(candidate.results, '2026-09-02-darwin-arm64', fileName),
        tampered,
      )

      const result = run(candidate.root, candidate.fakeRunner, candidate.log)
      expect(result.status).not.toBe(0)
      expect(result.stderr).toMatch(/does not match the verified JSON/u)
    }
  })

  test('static workflow runs enumeration after the current runner is built', async () => {
    const workflow = await readFile(
      path.join(repositoryRoot, '.github/workflows/static-verification.yml'),
      'utf8',
    )
    const build = workflow.indexOf('node node_modules/npm/bin/npm-cli.js run check')
    const verify = workflow.indexOf('scripts/verify-committed-matrix-reports.mjs')

    expect(build).toBeGreaterThan(-1)
    expect(verify).toBeGreaterThan(build)
    expect(workflow).toContain('dist/cli.js verify-locks')
    expect(workflow).toContain('--platform-key darwin-arm64-node24-npm11')
    expect(workflow).toContain('--runner tools/typert-version-matrix/dist/cli.js')
  })
})
