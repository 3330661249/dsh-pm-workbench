import { cp, lstat, mkdir, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { CasePaths } from './boundaries.js'
import { renderNpmrc } from './environment.js'
import { verifyFixture } from './fixture.js'
import type { MatrixCase, MatrixConfig } from './types.js'

export async function materializeCaseWorkspace(
  fixtureRoot: string,
  paths: CasePaths,
  config: MatrixConfig,
  matrixCase: MatrixCase,
): Promise<{ readonly fixtureSha256: string }> {
  const fixture = await verifyFixture(fixtureRoot)
  await mkdir(paths.root, { recursive: true })
  await Promise.all([
    mkdir(paths.npmCache, { recursive: true }),
    mkdir(paths.logs, { recursive: true }),
    mkdir(paths.proposedLock, { recursive: true }),
  ])
  await cp(fixtureRoot, paths.workspace, {
    recursive: true,
    force: false,
    errorOnExist: true,
    dereference: false,
  })
  const copied = await verifyFixture(paths.workspace)
  if (copied.aggregateSha256 !== fixture.aggregateSha256) {
    throw new Error('copied fixture differs from frozen source')
  }

  const templatePath = path.join(paths.workspace, 'packages/probe/package.template.json')
  const template = JSON.parse(await readFile(templatePath, 'utf8')) as Record<string, unknown>
  const probeManifest = {
    ...template,
    dependencies: {
      '@deepseek-ai/dsh-typert-protocol': matrixCase.packages['@deepseek-ai/dsh-typert-protocol'],
      zod: config.toolchain.zod,
    },
    peerDependencies: {
      '@deepseek-ai/cordis': matrixCase.packages['@deepseek-ai/cordis'],
    },
  }
  const rootManifest = {
    name: '@knight/dsh-typert-matrix-root',
    version: '0.0.0',
    private: true,
    license: 'UNLICENSED',
    type: 'module',
    workspaces: ['packages/*'],
    devDependencies: {
      ...matrixCase.packages,
      typescript: config.toolchain.typescript,
      tsdown: config.toolchain.tsdown,
      zod: config.toolchain.zod,
    },
  }
  await Promise.all([
    writeFile(
      path.join(paths.workspace, 'package.json'),
      `${JSON.stringify(rootManifest, null, 2)}\n`,
      { flag: 'wx' },
    ),
    writeFile(
      path.join(paths.workspace, 'packages/probe/package.json'),
      `${JSON.stringify(probeManifest, null, 2)}\n`,
      { flag: 'wx' },
    ),
    writeFile(paths.npmrc, renderNpmrc(), { flag: 'wx', mode: 0o600 }),
  ])
  await Promise.all([
    rm(templatePath),
    rm(path.join(paths.workspace, 'fixture.manifest.json')),
  ])
  return { fixtureSha256: fixture.aggregateSha256 }
}

export async function verifyWorkspaceLink(workspaceRoot: string): Promise<string> {
  const linkPath = path.join(
    workspaceRoot,
    'node_modules/@knight/dsh-typert-matrix-probe',
  )
  const info = await lstat(linkPath)
  if (!info.isSymbolicLink()) throw new Error('workspace link is missing or not a symlink')
  const linkReal = await realpath(linkPath)
  const expected = await realpath(path.join(workspaceRoot, 'packages/probe'))
  if (linkReal !== expected) throw new Error('workspace link resolves outside packages/probe')
  return linkReal
}
