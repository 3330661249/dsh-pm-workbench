import { mkdtemp, mkdir, realpath, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, test } from 'vitest'
import { allocateCasePaths, resolveNewRunRoot } from '../src/boundaries.js'

async function repositoryFixture(): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'typert-boundary-'))
  await mkdir(path.join(root, '.tmp/dsh-pm-workbench/version-matrix/runs'), {
    recursive: true,
  })
  return root
}

describe('matrix filesystem boundaries', () => {
  test('accepts one new relative run path under the dedicated runs root', async () => {
    const root = await repositoryFixture()
    const rootReal = await realpath(root)

    expect(await resolveNewRunRoot(root, '.tmp/dsh-pm-workbench/version-matrix/runs/run-001'))
      .toBe(path.join(rootReal, '.tmp/dsh-pm-workbench/version-matrix/runs/run-001'))
  })

  test.each(['../escape', '/tmp/absolute', '.tmp/dsh-pm-workbench/version-matrix/runs/../escape'])
  ('rejects traversal or absolute output %s', async (requested) => {
    const root = await repositoryFixture()

    await expect(resolveNewRunRoot(root, requested)).rejects.toThrow(/output path/)
  })

  test('rejects an existing run even when it is empty', async () => {
    const root = await repositoryFixture()
    const relative = '.tmp/dsh-pm-workbench/version-matrix/runs/reused'
    await mkdir(path.join(root, relative))

    await expect(resolveNewRunRoot(root, relative)).rejects.toThrow(/already exists/)
  })

  test('rejects an output routed through a symlink outside the runs root', async () => {
    const root = await repositoryFixture()
    const outside = await mkdtemp(path.join(os.tmpdir(), 'typert-outside-'))
    await symlink(
      outside,
      path.join(root, '.tmp/dsh-pm-workbench/version-matrix/runs/escape'),
    )

    await expect(resolveNewRunRoot(
      root,
      '.tmp/dsh-pm-workbench/version-matrix/runs/escape/run-001',
    )).rejects.toThrow(/symlink|outside/)
  })

  test('allocates independent workspace, cache, npmrc, node_modules, and logs', () => {
    const runRoot = '/safe/run'
    const first = allocateCasePaths(runRoot, 'case-one')
    const second = allocateCasePaths(runRoot, 'case-two')

    for (const key of ['root', 'workspace', 'npmCache', 'npmrc', 'nodeModules', 'logs'] as const) {
      expect(first[key]).not.toBe(second[key])
      expect(first[key]).toContain('/case-one')
      expect(second[key]).toContain('/case-two')
    }
  })
})
