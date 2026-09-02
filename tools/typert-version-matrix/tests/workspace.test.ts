import { lstat, mkdir, mkdtemp, readFile, realpath, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { allocateCasePaths } from '../src/boundaries.js'
import { parseMatrixConfig } from '../src/config.js'
import { materializeCaseWorkspace, verifyWorkspaceLink } from '../src/workspace.js'
import type { MatrixConfig } from '../src/types.js'

const fixtureRoot = fileURLToPath(new URL('../fixtures/strict-remote-v1/', import.meta.url))
let config: MatrixConfig

beforeAll(async () => {
  const file = fileURLToPath(new URL('../config/matrix.official.json', import.meta.url))
  config = parseMatrixConfig(JSON.parse(await readFile(file, 'utf8')))
})

describe('case workspace materialization', () => {
  test('copies the frozen source and renders exact script-free manifests', async () => {
    const runRoot = await mkdtemp(path.join(os.tmpdir(), 'typert-workspace-'))
    const paths = allocateCasePaths(runRoot, config.cases[1]!.id)
    const evidence = await materializeCaseWorkspace(fixtureRoot, paths, config, config.cases[1]!)
    const rootManifest = JSON.parse(await readFile(path.join(paths.workspace, 'package.json'), 'utf8'))
    const probeManifest = JSON.parse(await readFile(path.join(paths.workspace, 'packages/probe/package.json'), 'utf8'))

    expect(evidence.fixtureSha256).toMatch(/^[a-f0-9]{64}$/)
    expect(rootManifest.scripts).toBeUndefined()
    expect(rootManifest.devDependencies['@deepseek-ai/dsh']).toBeUndefined()
    expect(rootManifest.devDependencies['@deepseek-ai/dsh-typert-generator']).toBe('0.1.0-rc.7')
    expect(probeManifest.dependencies).toEqual({
      '@deepseek-ai/dsh-typert-protocol': '0.1.0-rc.7',
      zod: '4.4.3',
    })
    expect(probeManifest.peerDependencies).toEqual({ '@deepseek-ai/cordis': '4.0.1' })
    expect(await lstat(paths.npmCache)).toMatchObject({})
    expect(await readFile(paths.npmrc, 'utf8')).not.toMatch(/auth|token|password/i)
  })

  test('requires the installed workspace link to realpath to packages/probe', async () => {
    const runRoot = await mkdtemp(path.join(os.tmpdir(), 'typert-workspace-'))
    const paths = allocateCasePaths(runRoot, config.cases[1]!.id)
    await materializeCaseWorkspace(fixtureRoot, paths, config, config.cases[1]!)
    await mkdir(path.join(paths.nodeModules, '@knight'), { recursive: true })
    await symlink(
      path.join(paths.workspace, 'packages/probe'),
      path.join(paths.nodeModules, '@knight/dsh-typert-matrix-probe'),
      'dir',
    )

    await expect(verifyWorkspaceLink(paths.workspace)).resolves.toBe(await realpath(path.join(paths.workspace, 'packages/probe')))
  })
})
