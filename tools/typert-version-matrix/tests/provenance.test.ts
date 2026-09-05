import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { parseMatrixConfig } from '../src/config.js'
import {
  assertRunProvenance,
  assertRunStateUnchanged,
  collectCleanRunnerGitProvenance,
  collectRunnerArtifactProvenance,
  createRunProvenance,
  expectedFrozenPlatformKey,
  hashConfigFileBytes,
  hashMatrixConfig,
} from '../src/provenance.js'

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, {
    recursive: true,
    force: true,
  })))
})

function config() {
  return parseMatrixConfig({
    schemaVersion: '1',
    decisionMode: 'selection',
    purpose: 'selection',
    runtime: { node: '24.14.0', npmCli: '11.9.0' },
    toolchain: { typescript: '6.0.3', tsdown: '0.22.2', zod: '4.4.3' },
    registry: 'https://registry.npmjs.org/',
    generatorAdapter: 'workspace-v1',
    fixture: 'strict-remote-v1',
    policy: { requireAllCasesConclusive: true, requireAtLeastOneCandidatePass: true },
    cases: [
      {
        id: 'typert-0.1.0-rc.6-control',
        role: 'control',
        release: { '@deepseek-ai/dsh': '0.1.0-rc.6' },
        packages: {
          '@deepseek-ai/dsh-typert-generator': '0.1.0-rc.6',
          '@deepseek-ai/dsh-typert-protocol': '0.1.0-rc.6',
          '@deepseek-ai/dsh-invariants': '0.1.0-rc.6',
          '@deepseek-ai/cordis': '4.0.1',
        },
      },
      ...['0.1.0-rc.7', '0.1.0-rc.8', '0.1.1-rc.1', '0.1.1-rc.2'].map((version) => ({
        id: `typert-${version}`,
        role: 'candidate',
        release: { '@deepseek-ai/dsh': version },
        packages: {
          '@deepseek-ai/dsh-typert-generator': version,
          '@deepseek-ai/dsh-typert-protocol': version,
          '@deepseek-ai/dsh-invariants': version,
          '@deepseek-ai/cordis': '4.0.1',
        },
      })),
    ],
  })
}

describe('run provenance', () => {
  test('hashes the normalized closed config deterministically', () => {
    const first = config()
    const second = structuredClone(first)

    expect(hashMatrixConfig(first)).toMatch(/^[a-f0-9]{64}$/)
    expect(hashMatrixConfig(second)).toBe(hashMatrixConfig(first))
    expect(hashConfigFileBytes('raw config\n')).toMatch(/^[a-f0-9]{64}$/)
    expect(expectedFrozenPlatformKey('darwin', 'arm64', first)).toBe(
      'darwin-arm64-node24-npm11',
    )
  })

  test('builds and strictly validates lock, time, Git, and safe CI provenance', () => {
    const matrixConfig = config()
    const provenance = createRunProvenance({
      config: matrixConfig,
      configFileSha256: hashConfigFileBytes('raw config\n'),
      fixtureSha256: 'f'.repeat(64),
      runnerGit: { sourceGitCommit: 'a'.repeat(40), worktreeClean: true },
      runnerArtifacts: {
        sourceTreeSha256: '1'.repeat(64),
        distJsSha256: '2'.repeat(64),
        toolPackageLockSha256: '3'.repeat(64),
      },
      lockMode: 'frozen',
      platformKey: 'darwin-arm64-node24-npm11',
      runStartedAt: '2026-09-02T00:00:00.000Z',
      runCompletedAt: '2026-09-02T00:01:00.000Z',
      env: {
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'knight/dsh-pm-workbench',
        GITHUB_WORKFLOW: 'Typert matrix',
        GITHUB_RUN_ID: '1234',
        GITHUB_RUN_ATTEMPT: '2',
        GITHUB_SHA: 'a'.repeat(40),
      },
    })

    expect(() => assertRunProvenance(provenance, matrixConfig)).not.toThrow()
    expect(provenance).toMatchObject({
      lockMode: 'frozen',
      platformKey: 'darwin-arm64-node24-npm11',
      ci: { provider: 'github-actions', runId: '1234' },
    })
    expect(() => assertRunProvenance(
      { ...provenance, injected: true },
      matrixConfig,
    )).toThrow(/exact provenance schema/i)
    expect(() => createRunProvenance({
      config: matrixConfig,
      configFileSha256: provenance.configFileSha256,
      fixtureSha256: provenance.fixtureSha256,
      runnerGit: provenance.runnerGit,
      runnerArtifacts: provenance.runnerArtifacts,
      lockMode: 'frozen',
      runStartedAt: provenance.runStartedAt,
      runCompletedAt: provenance.runCompletedAt,
      env: {},
    })).toThrow(/frozen.*platformKey/i)
    expect(() => createRunProvenance({
      config: matrixConfig,
      configFileSha256: provenance.configFileSha256,
      fixtureSha256: provenance.fixtureSha256,
      runnerGit: provenance.runnerGit,
      runnerArtifacts: provenance.runnerArtifacts,
      lockMode: 'resolve',
      runStartedAt: provenance.runStartedAt,
      runCompletedAt: provenance.runCompletedAt,
      env: { GITHUB_ACTIONS: 'true', GITHUB_WORKFLOW: 'unsafe\nworkflow' },
    })).toThrow(/unsafe GitHub Actions provenance/i)
  })

  test('fails closed when any preflight input changes before final reporting', () => {
    const initial = {
      configSha256: 'a'.repeat(64),
      configFileSha256: 'b'.repeat(64),
      fixtureSha256: 'c'.repeat(64),
      runnerGit: { sourceGitCommit: 'd'.repeat(40), worktreeClean: true as const },
      runnerArtifacts: {
        sourceTreeSha256: '1'.repeat(64),
        distJsSha256: '2'.repeat(64),
        toolPackageLockSha256: '3'.repeat(64),
      },
    }

    expect(() => assertRunStateUnchanged(initial, structuredClone(initial))).not.toThrow()
    for (const changed of [
      { ...initial, configSha256: 'e'.repeat(64) },
      { ...initial, configFileSha256: 'e'.repeat(64) },
      { ...initial, fixtureSha256: 'e'.repeat(64) },
      {
        ...initial,
        runnerGit: { sourceGitCommit: 'e'.repeat(40), worktreeClean: true as const },
      },
      {
        ...initial,
        runnerArtifacts: { ...initial.runnerArtifacts, distJsSha256: 'e'.repeat(64) },
      },
    ]) {
      expect(() => assertRunStateUnchanged(initial, changed)).toThrow(/changed during the run/i)
    }
  })

  test('records the actual clean Git commit and fails closed for a dirty worktree', async () => {
    const repositoryRoot = await mkdtemp(path.join(tmpdir(), 'typert-runner-git-'))
    temporaryRoots.push(repositoryRoot)
    execFileSync('git', ['init', '--quiet'], { cwd: repositoryRoot })
    execFileSync('git', ['config', 'user.name', 'Matrix Test'], { cwd: repositoryRoot })
    execFileSync('git', ['config', 'user.email', 'matrix@example.invalid'], { cwd: repositoryRoot })
    await writeFile(path.join(repositoryRoot, 'tracked.txt'), 'tracked\n')
    execFileSync('git', ['add', 'tracked.txt'], { cwd: repositoryRoot })
    execFileSync('git', ['commit', '--quiet', '-m', 'fixture'], { cwd: repositoryRoot })

    const clean = collectCleanRunnerGitProvenance(repositoryRoot)
    expect(clean.sourceGitCommit).toMatch(/^[a-f0-9]{40,64}$/)
    expect(clean.worktreeClean).toBe(true)

    await writeFile(path.join(repositoryRoot, 'untracked.txt'), 'dirty\n')
    expect(() => collectCleanRunnerGitProvenance(repositoryRoot)).toThrow(/worktree.*dirty/i)
  })

  test('hashes executed dist JS separately from source and the tool lockfile', async () => {
    const toolRoot = await mkdtemp(path.join(tmpdir(), 'typert-runner-artifacts-'))
    temporaryRoots.push(toolRoot)
    await Promise.all([
      mkdir(path.join(toolRoot, 'src/nested'), { recursive: true }),
      mkdir(path.join(toolRoot, 'dist/adapters'), { recursive: true }),
    ])
    await Promise.all([
      writeFile(path.join(toolRoot, 'src/main.ts'), 'export const source = 1\n'),
      writeFile(path.join(toolRoot, 'src/nested/helper.ts'), 'export const helper = 1\n'),
      writeFile(path.join(toolRoot, 'dist/cli.js'), 'export const cli = 1\n'),
      writeFile(
        path.join(toolRoot, 'dist/adapters/workspace-v1.js'),
        'export const adapter = 1\n',
      ),
      writeFile(path.join(toolRoot, 'package.json'), '{}\n'),
      writeFile(path.join(toolRoot, 'package-lock.json'), '{"lockfileVersion":3}\n'),
      writeFile(path.join(toolRoot, 'tsconfig.json'), '{}\n'),
      writeFile(path.join(toolRoot, 'tsconfig.build.json'), '{}\n'),
    ])

    const initial = await collectRunnerArtifactProvenance(toolRoot)
    await writeFile(path.join(toolRoot, 'dist/cli.js'), 'export const cli = 2\n')
    const changed = await collectRunnerArtifactProvenance(toolRoot)

    expect(initial.sourceTreeSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(initial.toolPackageLockSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(changed.sourceTreeSha256).toBe(initial.sourceTreeSha256)
    expect(changed.toolPackageLockSha256).toBe(initial.toolPackageLockSha256)
    expect(changed.distJsSha256).not.toBe(initial.distJsSha256)
  })
})
