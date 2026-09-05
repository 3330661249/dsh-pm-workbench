import { access, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { buildWorkbench } from '../../packages/workbench/build.mjs'
import { assertWorkbenchWritePath } from '../../scripts/workspace-boundary.ts'

const repositoryRoot = path.resolve(import.meta.dirname, '../..')

test('rejects repository root and symlink escape output before writing', async () => {
  const safeRejectedTarget = path.join(repositoryRoot, 'packages', 'workbench', 'generated')
  await rm(safeRejectedTarget, { recursive: true, force: true })
  await expect(buildWorkbench({ outdir: safeRejectedTarget })).rejects.toThrow()
  await expect(access(safeRejectedTarget)).rejects.toThrow()

  await mkdir(path.join(repositoryRoot, '.tmp'), { recursive: true })
  const temp = await mkdtemp(path.join(repositoryRoot, '.tmp', 'boundary-'))
  const link = path.join(temp, 'escape')
  const escapedParent = await mkdtemp(path.join(os.tmpdir(), 'workbench-symlink-output-'))
  const escapedTarget = path.join(escapedParent, 'lib')
  await symlink(escapedParent, link)
  try {
    await expect(buildWorkbench({ outdir: path.join(link, path.basename(escapedTarget)) })).rejects.toThrow()
    await expect(access(escapedTarget)).rejects.toThrow()
  } finally {
    await rm(temp, { recursive: true, force: true })
    await rm(escapedParent, { recursive: true, force: true })
  }
})

test('checks the boundary immediately before every explicit filesystem mutation', async () => {
  const tempRoot = path.join(repositoryRoot, '.tmp')
  await mkdir(tempRoot, { recursive: true })
  const temp = await mkdtemp(path.join(tempRoot, 'writer-guard-'))
  const outdir = path.join(temp, 'lib')
  const guardedTargets: string[] = []

  try {
    await buildWorkbench({
      outdir,
      guard(target) {
        assertWorkbenchWritePath(target)
        guardedTargets.push(path.resolve(target))
      },
    })

    expect(guardedTargets).toEqual([
      outdir,
      outdir,
      path.join(outdir, 'index.js'),
      path.join(outdir, 'client.js'),
    ])
  } finally {
    await rm(temp, { recursive: true, force: true })
  }
})
