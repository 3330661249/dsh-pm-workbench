import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, symlink, truncate, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { expect, test } from 'vitest'

import { buildPackableWorkbench } from '../../packages/workbench/build.mjs'
import {
  WORKBENCH_PACKAGE_FILES,
  validateNpmPackMetadata,
  verifyBuiltWorkbenchPackage,
  verifyPackedWorkbenchArtifact,
} from '../../scripts/verify-package.mjs'
import {
  createNpmPackInvocation,
  runNpmPack,
} from '../../scripts/pack-dry.mjs'

const execFile = promisify(execFileCallback)
const repositoryRoot = path.resolve(import.meta.dirname, '../..')
const maximumPackageFileBytes = 2 * 1024 * 1024
const maximumPackedArtifactBytes = 8 * 1024 * 1024

const exactFiles = [
  'LICENSE',
  'README.md',
  'cordis.patch.yml',
  'docs/compatibility.md',
  'docs/privacy.md',
  'docs/third-party.md',
  'lib/client.js',
  'lib/index.js',
  'package.json',
] as const

function hash(algorithm: string, bytes: string | Buffer): string {
  return createHash(algorithm).update(bytes).digest('hex')
}

function packMetadata(artifact = Buffer.from('synthetic tgz bytes')) {
  return [{
    id: '@knight/dsh-pm-workbench@0.1.0',
    name: '@knight/dsh-pm-workbench',
    version: '0.1.0',
    filename: 'knight-dsh-pm-workbench-0.1.0.tgz',
    size: artifact.byteLength,
    unpackedSize: 45,
    shasum: hash('sha1', artifact),
    integrity: `sha512-${createHash('sha512').update(artifact).digest('base64')}`,
    entryCount: exactFiles.length,
    bundled: [],
    files: exactFiles.map((file, index) => ({ path: file, size: index + 1, mode: 0o644 })),
  }]
}

test('package helper modules are import-safe', async () => {
  const verifier = pathToFileURL(path.resolve(import.meta.dirname, '../../scripts/verify-package.mjs')).href
  const packer = pathToFileURL(path.resolve(import.meta.dirname, '../../scripts/pack-dry.mjs')).href
  const script = `await import(${JSON.stringify(verifier)}); await import(${JSON.stringify(packer)}); process.stdout.write('imported\\n')`

  const result = await execFile(process.execPath, [
    '--experimental-strip-types',
    '--input-type=module',
    '--eval',
    script,
  ], {
    cwd: os.tmpdir(),
    env: {},
  })

  expect(result.stdout).toBe('imported\n')
  expect(result.stderr).toBe('')
})

test('the verify-package CLI completes without an ESM top-level-await cycle', async () => {
  const npmCliPath = process.env.npm_execpath
  expect(npmCliPath && path.isAbsolute(npmCliPath)).toBe(true)

  const result = await execFile(process.execPath, [
    '--experimental-strip-types',
    path.join(repositoryRoot, 'scripts/verify-package.mjs'),
  ], {
    cwd: repositoryRoot,
    env: { npm_execpath: npmCliPath },
  })

  expect(result.stdout).toContain('"status": "verified"')
  expect(result.stderr).toBe('')
})

test('builds only through the fixed packable entrypoint and verifies exact source bytes', async () => {
  expect(buildPackableWorkbench.length).toBe(0)
  const buildEvidence = await buildPackableWorkbench()

  const verified = await verifyBuiltWorkbenchPackage({ buildEvidence })

  expect(buildEvidence.outputHashes).toEqual({
    'lib/client.js': hash('sha256', await readFile(path.join(repositoryRoot, 'packages/workbench/lib/client.js'))),
    'lib/index.js': hash('sha256', await readFile(path.join(repositoryRoot, 'packages/workbench/lib/index.js'))),
  })
  expect(Object.isFrozen(buildEvidence.outputHashes)).toBe(true)

  expect(WORKBENCH_PACKAGE_FILES).toEqual(exactFiles)
  expect(Object.isFrozen(WORKBENCH_PACKAGE_FILES)).toBe(true)
  expect(verified).toMatchObject({
    name: '@knight/dsh-pm-workbench',
    version: '0.1.0',
    bundledZod: true,
    runtimeDependencies: 0,
  })
  expect(verified.files.map(({ path: file }) => file)).toEqual(exactFiles)
  expect(verified.files.every(({ bytes, size, sha256 }) =>
    bytes.byteLength === size && hash('sha256', Buffer.from(bytes)) === sha256)).toBe(true)
  expect(verified.sourceInventorySha256).toMatch(/^[a-f0-9]{64}$/u)
  expect(verified.outputHashes).toEqual(buildEvidence.outputHashes)
})

test('rejects a frozen lib whose bytes do not match the canonical build output hashes', async () => {
  const buildEvidence = await buildPackableWorkbench()
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'workbench-build-hash-drift-'))
  const canonicalPackageRoot = path.join(repositoryRoot, 'packages/workbench')

  try {
    for (const relative of exactFiles) {
      const target = path.join(fixture, relative)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, await readFile(path.join(canonicalPackageRoot, relative)))
    }
    const stagedHostPath = path.join(fixture, 'lib/index.js')
    await writeFile(stagedHostPath, Buffer.concat([await readFile(stagedHostPath), Buffer.from('\n// drift\n')]))
    await expect(verifyBuiltWorkbenchPackage({
      repositoryRoot,
      packageRoot: fixture,
      buildEvidence,
    }))
      .rejects.toThrow(/build output hash/u)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('rejects an oversized package source file instead of reading it into the frozen receipt', async () => {
  const buildEvidence = await buildPackableWorkbench()
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'workbench-package-file-limit-'))
  const canonicalPackageRoot = path.join(repositoryRoot, 'packages/workbench')

  try {
    for (const relative of exactFiles) {
      const target = path.join(fixture, relative)
      await mkdir(path.dirname(target), { recursive: true })
      await writeFile(target, await readFile(path.join(canonicalPackageRoot, relative)))
    }
    await truncate(path.join(fixture, 'README.md'), maximumPackageFileBytes + 1)

    await expect(verifyBuiltWorkbenchPackage({
      repositoryRoot,
      packageRoot: fixture,
      buildEvidence,
    })).rejects.toThrow(/maximum package file size/u)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('accepts only one exact npm package record with the immutable nine-file inventory', () => {
  const validated = validateNpmPackMetadata(packMetadata())

  expect(validated.filename).toBe('knight-dsh-pm-workbench-0.1.0.tgz')
  expect(validated.files.map(({ path: file }) => file)).toEqual(exactFiles)
  expect(validated.npmInventorySha256).toMatch(/^[a-f0-9]{64}$/u)

  const extra = packMetadata()
  ;(extra[0]!.files as Array<{ path: string; size: number; mode: number }>)
    .push({ path: 'src/escape.ts', size: 1, mode: 0o644 })
  expect(() => validateNpmPackMetadata(extra)).toThrow(/exact package file inventory/u)
  expect(() => validateNpmPackMetadata([])).toThrow(/exactly one package/u)
  expect(() => validateNpmPackMetadata([{ ...packMetadata()[0], filename: '../escape.tgz' }]))
    .toThrow(/filename/u)
  expect(() => validateNpmPackMetadata([{
    ...packMetadata()[0],
    size: maximumPackedArtifactBytes + 1,
  }])).toThrow(/maximum packed artifact size/u)
})

test('creates an explicit Node plus npm CLI invocation with a closed environment and owned paths', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'workbench-pack-invocation-'))
  const operationRoot = path.join(fixture, 'operation')
  const stagedPackageRoot = path.join(fixture, 'package-source')
  const npmCliPath = path.join(fixture, 'npm-cli.js')
  const nodeExecutable = await realpath(process.execPath)

  try {
    const invocation = createNpmPackInvocation({
      nodeExecutable,
      npmCliPath,
      stagedPackageRoot,
      operationRoot,
      dryRun: false,
    })

    expect(invocation.file).toBe(nodeExecutable)
    expect(invocation.args.slice(0, 4)).toEqual([npmCliPath, 'pack', '.', '--json'])
    expect(invocation.args).toContain('--ignore-scripts')
    expect(invocation.args).toContain('--offline')
    expect(invocation.options).toMatchObject({ cwd: stagedPackageRoot, shell: false })
    expect(Object.keys(invocation.options.env).sort()).toEqual([
      'HOME',
      'LANG',
      'LC_ALL',
      'TMPDIR',
      'npm_config_audit',
      'npm_config_cache',
      'npm_config_fund',
      'npm_config_globalconfig',
      'npm_config_ignore_scripts',
      'npm_config_offline',
      'npm_config_update_notifier',
      'npm_config_userconfig',
    ])
    expect(invocation.options.env).not.toHaveProperty('PATH')
    expect(invocation.options.env).not.toHaveProperty('NODE_OPTIONS')
    for (const value of Object.values(invocation.options.env)) {
      if (path.isAbsolute(value)) expect(path.relative(operationRoot, value)).not.toMatch(/^\.\.(?:\/|$)/u)
    }
    expect(() => createNpmPackInvocation({
      nodeExecutable: 'node',
      npmCliPath,
      stagedPackageRoot,
      operationRoot,
      dryRun: false,
    })).toThrow(/absolute Node executable/u)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test.each([
  'node-direct-link',
  'npm-direct-link',
  'node-linked-ancestor',
  'npm-linked-ancestor',
  'staged-linked-ancestor',
  'operation-linked-ancestor',
] as const)('rejects non-canonical or symlinked pack input: %s', async (variant) => {
  const canonicalTemp = await realpath(os.tmpdir())
  const fixture = await mkdtemp(path.join(canonicalTemp, 'workbench-pack-symlink-'))
  const realRoot = path.join(fixture, 'real')
  const linkedRoot = path.join(fixture, 'linked')
  const stagedPackageRoot = path.join(realRoot, 'package-source')
  const operationRoot = path.join(realRoot, 'operation')
  const fakeNode = path.join(realRoot, 'fake-node')
  const fakeNpm = path.join(realRoot, 'fake-npm-cli.mjs')
  const nodeLink = path.join(fixture, 'node-link')
  const npmLink = path.join(fixture, 'npm-link')

  try {
    await mkdir(realRoot)
    await Promise.all([
      mkdir(stagedPackageRoot),
      mkdir(operationRoot),
      writeFile(fakeNode, "#!/bin/sh\nprintf '[]'\n"),
      writeFile(fakeNpm, "process.stdout.write('[]')\n"),
    ])
    await chmod(fakeNode, 0o700)
    await Promise.all([
      symlink(realRoot, linkedRoot),
      symlink(await realpath(process.execPath), nodeLink),
      symlink(fakeNpm, npmLink),
    ])

    const options = {
      nodeExecutable: await realpath(process.execPath),
      npmCliPath: fakeNpm,
      stagedPackageRoot,
      operationRoot,
      dryRun: false,
    }
    if (variant === 'node-direct-link') options.nodeExecutable = nodeLink
    if (variant === 'npm-direct-link') options.npmCliPath = npmLink
    if (variant === 'node-linked-ancestor') options.nodeExecutable = path.join(linkedRoot, 'fake-node')
    if (variant === 'npm-linked-ancestor') options.npmCliPath = path.join(linkedRoot, 'fake-npm-cli.mjs')
    if (variant === 'staged-linked-ancestor') options.stagedPackageRoot = path.join(linkedRoot, 'package-source')
    if (variant === 'operation-linked-ancestor') options.operationRoot = path.join(linkedRoot, 'operation')

    await expect(runNpmPack(options)).rejects.toThrow(/canonical non-symlink/u)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('packs with the explicit CLI and returns the independently verified artifact hash', async () => {
  const fixture = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-real-pack-'))
  const operationRoot = path.join(fixture, 'operation')
  const stagedPackageRoot = path.join(fixture, 'package-source')
  const npmCliPath = path.join(fixture, 'fake-npm-cli.mjs')
  const artifact = Buffer.from('real frozen tgz bytes')
  const metadata = packMetadata(artifact)

  try {
    await Promise.all([
      mkdir(operationRoot),
      mkdir(stagedPackageRoot),
    ])
    await writeFile(npmCliPath, `
      import { writeFileSync } from 'node:fs'
      import path from 'node:path'
      const args = process.argv.slice(2)
      const destination = args[args.indexOf('--pack-destination') + 1]
      writeFileSync(path.join(destination, 'knight-dsh-pm-workbench-0.1.0.tgz'), Buffer.from(${JSON.stringify(artifact.toString('base64'))}, 'base64'))
      writeFileSync(path.join(process.env.HOME, 'capture.json'), JSON.stringify({ args, env: process.env }))
      process.stdout.write(${JSON.stringify(JSON.stringify(metadata))})
    `)

    const result = await runNpmPack({
      nodeExecutable: await realpath(process.execPath),
      npmCliPath,
      stagedPackageRoot,
      operationRoot,
      dryRun: false,
    })

    expect(result.metadata.files.map(({ path: file }) => file)).toEqual(exactFiles)
    expect(result.tgzAbsolutePath).toBe(path.join(
      await realpath(path.join(operationRoot, 'pack-output')),
      metadata[0]!.filename,
    ))
    expect(result.sha256).toBe(hash('sha256', artifact))
    const capture = JSON.parse(await readFile(path.join(operationRoot, 'home', 'capture.json'), 'utf8'))
    expect(capture.args).toContain('--ignore-scripts')
    expect(capture.args).toContain('--offline')
    expect(capture.env).not.toHaveProperty('PATH')
    expect(capture.env).not.toHaveProperty('NODE_OPTIONS')
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('verifies a sole regular tgz and rejects metadata hash drift', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'workbench-artifact-'))
  const artifact = Buffer.from('artifact bytes')
  const metadata = validateNpmPackMetadata(packMetadata(artifact))

  try {
    await writeFile(path.join(fixture, metadata.filename), artifact)
    const verified = await verifyPackedWorkbenchArtifact({ packOutputRoot: fixture, metadata })
    expect(verified).toMatchObject({
      tgzAbsolutePath: path.join(await realpath(fixture), metadata.filename),
      tgzBytes: artifact.byteLength,
      sha256: hash('sha256', artifact),
    })

    await writeFile(path.join(fixture, metadata.filename), 'changed')
    await expect(verifyPackedWorkbenchArtifact({ packOutputRoot: fixture, metadata }))
      .rejects.toThrow(/size|hash|integrity/u)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})

test('rejects an oversized opened tgz before reading its contents', async () => {
  const fixture = await mkdtemp(path.join(os.tmpdir(), 'workbench-artifact-limit-'))
  const artifact = Buffer.from('small declared artifact')
  const metadata = validateNpmPackMetadata(packMetadata(artifact))

  try {
    const artifactPath = path.join(fixture, metadata.filename)
    await writeFile(artifactPath, '')
    await truncate(artifactPath, maximumPackedArtifactBytes + 1)

    await expect(verifyPackedWorkbenchArtifact({
      packOutputRoot: fixture,
      metadata,
    })).rejects.toThrow(/maximum packed artifact size/u)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})
