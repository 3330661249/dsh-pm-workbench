import { execFile as execFileCallback } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, cp, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rename, rm, symlink, truncate, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'
import { expect, test, vi } from 'vitest'
import { gzipSync } from 'node:zlib'
import * as verifier from '../../scripts/verify-package.mjs'

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

function packMetadata(artifact = syntheticArchive()) {
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
  expect(result.stdout).toContain('"kind": "static"')
  expect(result.stdout).not.toMatch(/tgzSha256|receiptSha256|releaseId/)
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
  const fixture = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-build-hash-drift-'))
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
  const fixture = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-package-file-limit-'))
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
  const fixture = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-pack-invocation-'))
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

test.each(['mkdir', 'config', 'spawn'] as const)('rejects C36 pack critical-section entry substitution with zero outside entries: %s', async variant => {
  const fixture = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-pack-critical-'))
  const operationRoot = path.join(fixture, 'operation')
  const stagedPackageRoot = path.join(fixture, 'package-source')
  const outside = path.join(fixture, 'outside')
  const npmCliPath = path.join(fixture, 'npm-cli.mjs')
  try {
    for (const directory of [operationRoot, stagedPackageRoot, outside]) await mkdir(directory)
    await writeFile(npmCliPath, "import { writeFileSync } from 'node:fs'; writeFileSync('npm-ran', 'unexpected'); process.stdout.write('[]')")
    let injected = false; let guards = 0
    await expect(runNpmPack({
      nodeExecutable: await realpath(process.execPath), npmCliPath, stagedPackageRoot, operationRoot,
      ownershipGuard: async createdDirectory => {
        guards++
        const atEntry = variant === 'mkdir' ? guards === 2
          : variant === 'config' ? createdDirectory === path.join(operationRoot, 'pack-output')
            : !createdDirectory && await lstat(path.join(operationRoot, 'global-npmrc')).then(() => true, () => false)
        if (!injected && atEntry) {
          const target = variant === 'spawn' ? stagedPackageRoot : operationRoot
          await rename(target, target + '.displaced'); await symlink(outside, target, 'dir'); injected = true
        }
      },
    })).rejects.toThrow()
    expect(injected).toBe(true)
    expect(await readdir(outside)).toEqual([])
  } finally { await rm(fixture, { recursive: true, force: true }) }
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
  const artifact = syntheticArchive()
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
  const fixture = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-artifact-'))
  const artifact = syntheticArchive()
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
  const fixture = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-artifact-limit-'))
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


// Real bounded ustar fixtures. A compressed hash cannot substitute for member validation.
function syntheticArchive(change?: (tar: Buffer) => Buffer | void): Buffer {
  const records: Buffer[] = []
  for (const [index, file] of exactFiles.entries()) {
    const header = Buffer.alloc(512)
    header.write(`package/${file}`, 0, 100, 'ascii')
    header.write('0000644\0', 100, 8, 'ascii')
    header.write('0000000\0', 108, 8, 'ascii'); header.write('0000000\0', 116, 8, 'ascii')
    header.write((index + 1).toString(8).padStart(11, '0') + '\0', 124, 12, 'ascii')
    header.write('00000000000\0', 136, 12, 'ascii')
    header.fill(32, 148, 156); header[156] = 48
    header.write('ustar\0', 257, 6, 'ascii'); header.write('00', 263, 2, 'ascii')
    fixTarChecksum(header)
    const body = Buffer.alloc(512); body.fill(index + 1, 0, index + 1)
    records.push(header, body)
  }
  records.push(Buffer.alloc(1024))
  const tar = Buffer.concat(records)
  return gzipSync(change?.(tar) ?? tar)
}
function fixTarChecksum(header: Buffer): void {
  header.fill(32, 148, 156)
  const sum = header.subarray(0, 512).reduce((n, byte) => n + byte, 0)
  header.write(sum.toString(8).padStart(6, '0') + '\0 ', 148, 8, 'ascii')
}
function api(name: string): any {
  const value = (verifier as unknown as Record<string, any>)[name]
  expect(value, `${name} implements the closed release contract`).toBeTypeOf('function')
  return value
}

test('parses real bounded gzip/ustar bytes and compares every body with npm and frozen inputs', () => {
  const inspect = api('inspectWorkbenchArchive')
  const archive = syntheticArchive()
  const metadata = validateNpmPackMetadata(packMetadata(archive))
  const members = inspect(archive, metadata)
  expect(members.map((m: any) => m.path)).toEqual(exactFiles)
  for (const [index, member] of members.entries()) {
    expect(member.bytes).toEqual(Buffer.alloc(index + 1, index + 1))
    expect(member.mode).toBe(420)
  }
  const frozen = members.map((m: any) => ({ ...m, bytes: Buffer.from(m.bytes) }))
  frozen[0].bytes[0] = 99
  expect(() => inspect(archive, metadata, frozen)).toThrow()
})

test.each([
  ['plain-string', () => Buffer.from('synthetic tgz bytes')],
  ['bad-checksum', () => syntheticArchive(t => { t[20] = 42 })],
  ['truncated-header', () => syntheticArchive(t => t.subarray(0, 100))],
  ['truncated-body', () => syntheticArchive(t => t.subarray(0, 514))],
  ['missing-end-block', () => syntheticArchive(t => t.subarray(0, -512))],
  ['header-padding', () => syntheticArchive(t => { t[511] = 1; fixTarChecksum(t.subarray(0, 512)) })],
  ...[100, 124, 257, 263].map(offset => [
    `high-bit-${offset}`, () => syntheticArchive(t => { t[offset] = t[offset]! | 0x80; fixTarChecksum(t.subarray(0, 512)) }),
  ]),
  ['nonzero-padding', () => syntheticArchive(t => { t[1023] = 1 })],
  ['nonzero-tail', () => syntheticArchive(t => Buffer.concat([t, Buffer.alloc(512, 1)]))],
  ['duplicate', () => syntheticArchive(t => { t.copy(t, 1024, 0, 512) })],
  ['extra', () => syntheticArchive(t => { t.fill(0, 0, 100); t.write('package/extra.js'); fixTarChecksum(t.subarray(0, 512)) })],
  ['traversal', () => syntheticArchive(t => { t.fill(0, 0, 100); t.write('package/../LICENSE'); fixTarChecksum(t.subarray(0, 512)) })],
  ['alias', () => syntheticArchive(t => { t.fill(0, 0, 100); t.write('package/./LICENSE'); fixTarChecksum(t.subarray(0, 512)) })],
  ['backslash', () => syntheticArchive(t => { t[7] = 92; fixTarChecksum(t.subarray(0, 512)) })],
  ['wrong-mode', () => syntheticArchive(t => { t.write('0000755\0', 100); fixTarChecksum(t.subarray(0, 512)) })],
  ['wrong-size', () => syntheticArchive(t => { t.write('00000000002\0', 124); fixTarChecksum(t.subarray(0, 512)) })],
  ['oversized-member', () => syntheticArchive(t => { t.write('00010000001\0', 124); fixTarChecksum(t.subarray(0, 512)) })],
  ...['1', '2', '3', '4', '5', '6', '7', 'x', 'g', 'L', 'S'].map(type => [
    `special-${type}`, () => syntheticArchive(t => { t[156] = type.charCodeAt(0); fixTarChecksum(t.subarray(0, 512)) }),
  ]),
  ['gzip-overflow', () => gzipSync(Buffer.alloc(9 * 2 * 1024 * 1024 + 65537))],
  ['compressed-overflow', () => Buffer.alloc(8 * 1024 * 1024 + 1)],
  ['concatenated-nonzero', () => Buffer.concat([syntheticArchive(), gzipSync(Buffer.from('extra'))])],
] as Array<[string, () => Buffer]>)('rejects malformed or non-exact archive: %s', (_name, make) => {
  const inspect = api('inspectWorkbenchArchive')
  expect(() => inspect(make(), validateNpmPackMetadata(packMetadata()))).toThrow()
})

test.each([['--unknown'], ['--release-root'], ['relative'], ['--release-root', '/x', '--release-root', '/y'], ['--release-root', '/x', 'extra']])(
  'rejects invalid verifier CLI arguments before creating output: %j', async (...args) => {
    const result = await execFile(process.execPath, ['--experimental-strip-types', path.join(repositoryRoot, 'scripts/verify-package.mjs'), ...args], {
      cwd: repositoryRoot, env: { npm_execpath: process.env.npm_execpath },
    }).then(r => ({ ...r, code: 0 }), (e: any) => ({ stdout: e.stdout, stderr: e.stderr, code: e.code }))
    expect(result.code).not.toBe(0)
    expect(result.stdout).toBe('')
    expect(result.stderr).toBe('package-verification-failed\n')
  },
)

test('refuses path strings or serialized objects as cleanup capabilities', async () => {
  const cleanup = api('cleanupWorkbenchRelease')
  await expect(cleanup('/unowned')).rejects.toThrow()
  await expect(cleanup({ releaseRoot: '/unowned', owner: '@knight/dsh-pm-workbench' })).rejects.toThrow()
})

test('rejects an opened FIFO through the production artifact reader within a bounded subprocess', async () => {
  const temp = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-release-fifo-'))
  try {
    const filename = path.join(temp, 'knight-dsh-pm-workbench-0.1.0.tgz')
    await execFile('mkfifo', [filename])
    const script = `
      const api = await import(${JSON.stringify(pathToFileURL(path.join(repositoryRoot, 'scripts/verify-package.mjs')).href)})
      try { await api.verifyPackedWorkbenchArtifact({ packOutputRoot: ${JSON.stringify(temp)}, metadata: ${JSON.stringify(validateNpmPackMetadata(packMetadata()))} }); process.stdout.write('accepted') }
      catch { process.stdout.write('rejected') }
    `
    const observed = await execFile(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { timeout: 1500 })
      .then(result => ({ completed: true, stdout: result.stdout }), () => ({ completed: false, stdout: '' }))
    expect(observed).toEqual({ completed: true, stdout: 'rejected' })
    expect((await lstat(filename)).isFIFO()).toBe(true)
  } finally { await rm(temp, { recursive: true, force: true }) }
}, 10_000)

async function releaseFixture(): Promise<{ temp: string; root: string; releaseRoot: string; module: any; git: (args: string[]) => Promise<string> }> {
  const temp = await mkdtemp(path.join(await realpath(os.tmpdir()), 'workbench-release-contract-'))
  const root = path.join(temp, 'repository')
  await mkdir(root)
  // Independent subprocess repository: production still derives its fixed root from import.meta.dirname.
  const sourceManifest = JSON.parse(await readFile(path.join(repositoryRoot, 'tests/fixtures/standalone-source-manifest.json'), 'utf8'))
  for (const relative of sourceManifest.files as string[]) {
    if (!relative.startsWith('packages/workbench/') && !['package-lock.json', 'tsconfig.json', 'scripts/pack-dry.mjs', 'scripts/verify-package.mjs', 'scripts/workspace-boundary.ts'].includes(relative)) continue
    const target = path.join(root, relative); await mkdir(path.dirname(target), { recursive: true })
    await writeFile(target, await readFile(path.join(repositoryRoot, relative)))
  }
  await writeFile(path.join(root, 'package.json'), '{"private":true,"type":"module"}\n')
  await writeFile(path.join(root, 'README.md'), '# Test repository\n')
  await writeFile(path.join(root, '.gitignore'), 'node_modules/\n.tmp/\n.superpowers/\npackages/workbench/lib/\n')
  for (const relative of ['node_modules/zod', 'node_modules/esbuild', `node_modules/@esbuild/${process.platform}-${process.arch}`]) {
    await mkdir(path.dirname(path.join(root, relative)), { recursive: true })
    await cp(path.join(repositoryRoot, relative), path.join(root, relative), { recursive: true })
  }
  const git = async (args: string[]) => (await execFile('git', args, { cwd: root, env: { PATH: process.env.PATH, HOME: temp, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } })).stdout.trim()
  await git(['init', '-q']); await git(['add', '.'])
  await git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'fixture source'])
  const releaseRoot = path.join(root, '.superpowers/sdd/2026-09-07-dsh-pm-workbench-stage-3a-core/task-11-release')
  await mkdir(path.dirname(releaseRoot), { recursive: true })
  const module = await import(pathToFileURL(path.join(root, 'scripts/verify-package.mjs')).href)
  return { temp, root, releaseRoot, module, git }
}

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1')('binds a real committed retained release, read-only reopen, all hashes, and obsolete-generation retirement', async () => {
  api('createWorkbenchRelease'); api('readWorkbenchRelease'); api('validateReleaseReceipt')
  const f = await releaseFixture()
  let capability: any
  try {
    const commit = await f.git(['rev-parse', 'HEAD'])
    const summary = await f.module.createWorkbenchRelease(f.releaseRoot)
    expect(Object.keys(summary).sort()).toEqual(['kind', 'receiptSha256', 'releaseId', 'sourceCommit', 'status', 'tgzSha256'])
    expect(summary).toMatchObject({ status: 'verified', kind: 'release', sourceCommit: commit })
    expect(await readdir(f.releaseRoot)).toEqual(['knight-dsh-pm-workbench-0.1.0.tgz', 'receipt.json'])
    expect((await lstat(f.releaseRoot)).mode & 0o777).toBe(0o700)
    const receiptPath = path.join(f.releaseRoot, 'receipt.json')
    const tgzPath = path.join(f.releaseRoot, 'knight-dsh-pm-workbench-0.1.0.tgz')
    const receiptBytes = await readFile(receiptPath); const tgzBytes = await readFile(tgzPath)
    expect(hash('sha256', receiptBytes)).toBe(summary.receiptSha256)
    expect(hash('sha256', tgzBytes)).toBe(summary.tgzSha256)
    for (const file of [receiptPath, tgzPath]) { const stat = await lstat(file); expect(stat.mode & 0o777).toBe(0o600); expect(stat.nlink).toBe(1) }
    const receipt = f.module.validateReleaseReceipt(receiptBytes)
    expect(receipt.sources.some((s: any) => s.path === 'README.md' || s.path === 'package.json')).toBe(false)
    expect(receipt.sources.some((s: any) => s.path === 'package-lock.json')).toBe(true)
    expect(receipt.members.map((m: any) => m.path)).toEqual(exactFiles)
    const read = () => f.module.readWorkbenchRelease({ releaseRoot: f.releaseRoot, sourceCommit: commit, receiptSha256: summary.receiptSha256 })
    capability = await read()
    expect(JSON.stringify(capability)).toBe('{}')
    const seen = await f.module.withWorkbenchReleaseTgz(capability, async (file: string) => hash('sha256', await readFile(file)))
    expect(seen).toBe(summary.tgzSha256)
    await expect(f.module.createWorkbenchRelease(f.releaseRoot)).rejects.toThrow()
    expect(await readFile(receiptPath)).toEqual(receiptBytes)
    await writeFile(path.join(f.root, 'README.md'), '# Allowed Task 12 documentation\n')
    await f.git(['add', 'README.md']); await f.git(['-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '-qm', 'root-only'])
    capability = await read()
    expect(await readFile(receiptPath)).toEqual(receiptBytes)
    for (const mutate of [
      (r: any) => { r.extra = true }, (r: any) => { r.package.extra = null },
      (r: any) => { r.sources[0].bytes = -1 }, (r: any) => { r.sources[0].sha256 = 'A'.repeat(64) },
      (r: any) => { r.sources.push(r.sources[0]) }, (r: any) => { r.members.reverse() },
      (r: any) => { r.graphs.host.inputs[0].imports.push(r.graphs.host.inputs[0].imports[0]) },
      (r: any) => { r.graphHashes.host = '0'.repeat(64) }, (r: any) => { r.outputHashes['lib/client.js'] = '0'.repeat(64) },
      (r: any) => { r.rootIdentity.ino = '00' }, (r: any) => { r.releaseId = r.releaseId.toUpperCase() },
    ]) {
      const changed = structuredClone(receipt); mutate(changed)
      expect(() => f.module.validateReleaseReceipt(Buffer.from(f.module.canonicalJson(changed)))).toThrow()
    }
    for (const changed of [Buffer.concat([receiptBytes, Buffer.from('\n')]), Buffer.from('{"schemaVersion":1,' + receiptBytes.toString().slice(1)), Buffer.from('\ufeff' + receiptBytes), Buffer.alloc(1024 * 1024 + 1)]) {
      expect(() => f.module.validateReleaseReceipt(changed)).toThrow()
    }
    await expect(f.module.readWorkbenchRelease({ releaseRoot: f.releaseRoot, sourceCommit: '0'.repeat(40), receiptSha256: summary.receiptSha256 })).rejects.toThrow()
    await expect(f.module.readWorkbenchRelease({ releaseRoot: f.releaseRoot, sourceCommit: commit, receiptSha256: '0'.repeat(64) })).rejects.toThrow()
    for (const wrong of [
      { releaseRoot: f.releaseRoot + '/.', sourceCommit: commit, receiptSha256: summary.receiptSha256 },
      { releaseRoot: f.releaseRoot, sourceCommit: '0'.repeat(40), receiptSha256: summary.receiptSha256 },
      { releaseRoot: f.releaseRoot, sourceCommit: commit, receiptSha256: '0'.repeat(64) },
    ]) await expect(f.module.readWorkbenchReleaseForCleanup(wrong)).rejects.toThrow()
    const beforeSwapCleanup = await f.module.readWorkbenchReleaseForCleanup({ releaseRoot: f.releaseRoot, sourceCommit: commit, receiptSha256: summary.receiptSha256 })
    const savedTgzPath = path.join(f.temp, 'saved-tgz')
    await rename(tgzPath, savedTgzPath); await writeFile(tgzPath, tgzBytes, { mode: 0o600 })
    await expect(f.module.withWorkbenchReleaseTgz(capability, async () => true)).rejects.toThrow()
    await expect(f.module.cleanupWorkbenchRelease(beforeSwapCleanup)).rejects.toThrow()
    expect(await readFile(tgzPath)).toEqual(tgzBytes)
    await rm(tgzPath); await rename(savedTgzPath, tgzPath)
    capability = await read()
    const quarantine = f.releaseRoot + '.cleanup-' + summary.releaseId
    await mkdir(quarantine)
    await expect(f.module.cleanupWorkbenchRelease(capability)).rejects.toThrow()
    expect(await readFile(receiptPath)).toEqual(receiptBytes)
    await rm(quarantine, { recursive: true })
    await writeFile(path.join(f.root, 'packages/workbench/README.md'), 'obsolete bytes\n')
    await expect(read()).rejects.toThrow()
    const cleanupCapability = await f.module.readWorkbenchReleaseForCleanup({ releaseRoot: f.releaseRoot, sourceCommit: commit, receiptSha256: summary.receiptSha256 })
    expect(Object.keys(cleanupCapability)).toEqual([])
    let consumed = false
    await expect(f.module.withWorkbenchReleaseTgz(cleanupCapability, async () => { consumed = true })).rejects.toThrow()
    expect(consumed).toBe(false)
    await f.module.cleanupWorkbenchRelease(cleanupCapability)
    await expect(lstat(f.releaseRoot)).rejects.toThrow()
    await f.git(['checkout', '--', 'packages/workbench/README.md'])
    const replacement = await f.module.createWorkbenchRelease(f.releaseRoot)
    expect(replacement.releaseId).not.toBe(summary.releaseId)
    const replacementCapability = await f.module.readWorkbenchRelease({ releaseRoot: f.releaseRoot, sourceCommit: replacement.sourceCommit, receiptSha256: replacement.receiptSha256 })
    await f.module.cleanupWorkbenchRelease(replacementCapability)
  } finally { await rm(f.temp, { recursive: true, force: true }) }
}, 120_000)

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1')('rejects dirty and unowned release generations without output or deletion', async () => {
  api('createWorkbenchRelease')
  const f = await releaseFixture()
  try {
    const source = path.join(f.root, 'packages/workbench/README.md')
    const original = await readFile(source)
    await writeFile(source, 'dirty')
    await expect(f.module.createWorkbenchRelease(f.releaseRoot)).rejects.toThrow()
    await expect(lstat(f.releaseRoot)).rejects.toThrow()
    await f.git(['add', 'packages/workbench/README.md'])
    await expect(f.module.createWorkbenchRelease(f.releaseRoot)).rejects.toThrow()
    await f.git(['reset', '--', 'packages/workbench/README.md']); await writeFile(source, original)
    await writeFile(path.join(f.root, 'unexpected'), 'untracked')
    await expect(f.module.createWorkbenchRelease(f.releaseRoot)).rejects.toThrow()
    await rm(path.join(f.root, 'unexpected'))
    await mkdir(f.releaseRoot)
    await writeFile(path.join(f.releaseRoot, '.owner.json'), '{"unowned":true}')
    await expect(f.module.createWorkbenchRelease(f.releaseRoot)).rejects.toThrow()
    expect(await readFile(path.join(f.releaseRoot, '.owner.json'), 'utf8')).toBe('{"unowned":true}')
    for (const wrong of [path.join(f.root, 'elsewhere'), f.releaseRoot + '/.', 'relative']) await expect(f.module.createWorkbenchRelease(wrong)).rejects.toThrow()
  } finally { await rm(f.temp, { recursive: true, force: true }) }
}, 120_000)

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1').each([
  'observe', 'pack-fail', 'finalize-fail', 'source-drift', 'ownership-substitution',
] as const)('owns actual subprocesses and safely handles release failure: %s', async variant => {
  const f = await releaseFixture()
  try {
    await mkdir(path.join(f.root, '.tmp'), { recursive: true })
    const script = `
      import fs from 'node:fs/promises'
      import { existsSync, readFileSync, renameSync, mkdirSync, writeFileSync } from 'node:fs'
      import childProcess, { ChildProcess } from 'node:child_process'
      import { syncBuiltinESMExports } from 'node:module'
      const releaseRoot = ${JSON.stringify(f.releaseRoot)}
      const variant = ${JSON.stringify(variant)}
      const originalSpawn = ChildProcess.prototype.spawn
      let packs = 0; let markerBeforePack = false; let offline = false; let noScripts = false
      const observePack = args => {
        if (args.includes('pack') && args.includes('--pack-destination')) {
          packs++
          const marker = JSON.parse(readFileSync(releaseRoot + '/.owner.json', 'utf8'))
          markerBeforePack = marker.owner === '@knight/dsh-pm-workbench' && existsSync(releaseRoot + '/.work/package/package.json')
          offline = args.includes('--offline'); noScripts = args.includes('--ignore-scripts')
          if (variant === 'pack-fail') throw new Error('synthetic pack syscall failure')
          if (variant === 'source-drift') writeFileSync(${JSON.stringify(path.join(f.root, 'packages/workbench/README.md'))}, 'source drift')
        }
      }
      ChildProcess.prototype.spawn = function(options) {
        observePack(options.args)
        return originalSpawn.call(this, options)
      }
      const originalSpawnSync = childProcess.spawnSync
      childProcess.spawnSync = function(file, args, options) {
        observePack(args)
        return originalSpawnSync.call(this, file, args, options)
      }
      const originalLstat = fs.lstat
      let finalizeInjected = false
      fs.lstat = async function(file, ...args) {
        const result = await originalLstat.call(this, file, ...args)
        if (!finalizeInjected && String(file) === releaseRoot + '/.owner.json'
          && existsSync(releaseRoot + '/knight-dsh-pm-workbench-0.1.0.tgz') && !existsSync(releaseRoot + '/.work')) {
          finalizeInjected = true
          if (variant === 'finalize-fail') throw new Error('synthetic finalization failure')
          if (variant === 'ownership-substitution') {
            renameSync(releaseRoot, releaseRoot + '.displaced')
            mkdirSync(releaseRoot); writeFileSync(releaseRoot + '/unowned', 'preserve')
          }
        }
        return result
      }
      syncBuiltinESMExports()
      const api = await import(${JSON.stringify(pathToFileURL(path.join(f.root, 'scripts/verify-package.mjs')).href)})
      let summary; let ok = false
      try { summary = await api.createWorkbenchRelease(releaseRoot); ok = true } catch {}
      process.stdout.write(JSON.stringify({ ok, packs, markerBeforePack, offline, noScripts, summary,
        rootExists: existsSync(releaseRoot), unownedPreserved: existsSync(releaseRoot + '/unowned') && readFileSync(releaseRoot + '/unowned', 'utf8') === 'preserve' }))
    `
    const childPath = path.join(f.root, '.tmp', 'fault.mjs')
    await writeFile(childPath, script)
    const result = await execFile(process.execPath, ['--experimental-strip-types', childPath], { cwd: f.root,
      env: { PATH: process.env.PATH, npm_execpath: process.env.npm_execpath }, timeout: 30_000,
    })
    expect(result.stderr).toBe('')
    const observed = JSON.parse(result.stdout)
    expect(observed).toMatchObject({ packs: 1, markerBeforePack: true, offline: true, noScripts: true })
    expect(observed.ok).toBe(variant === 'observe')
    if (variant === 'observe') {
      const capability = await f.module.readWorkbenchRelease({ releaseRoot: f.releaseRoot, sourceCommit: observed.summary.sourceCommit, receiptSha256: observed.summary.receiptSha256 })
      await f.module.cleanupWorkbenchRelease(capability)
    } else if (variant === 'ownership-substitution') expect(observed.unownedPreserved).toBe(true)
    else expect(observed.rootExists).toBe(false)
  } finally { await rm(f.temp, { recursive: true, force: true }) }
}, 60_000)

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1')('rejects deletion-phase same-byte inode replacement without unlinking the substituted file', async () => {
  const f = await releaseFixture()
  try {
    const summary = await f.module.createWorkbenchRelease(f.releaseRoot)
    const script = `
      import fs from 'node:fs/promises'
      import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
      import { syncBuiltinESMExports } from 'node:module'
      const root = ${JSON.stringify(f.releaseRoot)}
      const quarantine = root + '.cleanup-' + ${JSON.stringify(summary.releaseId)}
      const replacement = quarantine + '/receipt.json'
      const originalBytes = readFileSync(root + '/receipt.json')
      const originalOpen = fs.open
      let reads = 0; let injected = false
      fs.open = async function(file, ...args) {
        if (String(file) === replacement && ++reads === 3) {
          renameSync(replacement, ${JSON.stringify(path.join(f.temp, 'saved-receipt.json'))})
          writeFileSync(replacement, originalBytes, { mode: 0o600, flag: 'wx' })
          injected = true
        }
        return originalOpen.call(this, file, ...args)
      }
      syncBuiltinESMExports()
      const api = await import(${JSON.stringify(pathToFileURL(path.join(f.root, 'scripts/verify-package.mjs')).href)})
      const capability = await api.readWorkbenchRelease({ releaseRoot: root, sourceCommit: ${JSON.stringify(summary.sourceCommit)}, receiptSha256: ${JSON.stringify(summary.receiptSha256)} })
      let rejected = false
      try { await api.cleanupWorkbenchRelease(capability) } catch { rejected = true }
      process.stdout.write(JSON.stringify({ injected, rejected, replacementPreserved: existsSync(replacement) && readFileSync(replacement).equals(originalBytes) }))
    `
    const observed = await execFile(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { cwd: f.root, timeout: 30_000 })
    expect(JSON.parse(observed.stdout)).toEqual({ injected: true, rejected: true, replacementPreserved: true })
  } finally { await rm(f.temp, { recursive: true, force: true }) }
}, 60_000)

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1').each(['work', 'docs'] as const)('rejects staging directory substitution with zero writes outside the owned root: %s', async variant => {
  const f = await releaseFixture()
  try {
    const outside = path.join(f.temp, 'outside'); await mkdir(outside)
    const script = `
      import fs from 'node:fs/promises'
      import { renameSync, symlinkSync, readdirSync } from 'node:fs'
      import { syncBuiltinESMExports } from 'node:module'
      const root = ${JSON.stringify(f.releaseRoot)}
      const outside = ${JSON.stringify(outside)}
      const variant = ${JSON.stringify(variant)}
      const swapped = root + (variant === 'work' ? '/.work' : '/.work/package/docs')
      const originalLstat = fs.lstat
      let injected = false
      fs.lstat = async function(file, ...args) {
        const result = await originalLstat.call(this, file, ...args)
        if (!injected && String(file) === swapped) {
          renameSync(swapped, swapped + '.displaced')
          symlinkSync(outside, swapped, 'dir')
          injected = true
        }
        return result
      }
      syncBuiltinESMExports()
      const api = await import(${JSON.stringify(pathToFileURL(path.join(f.root, 'scripts/verify-package.mjs')).href)})
      let rejected = false
      try { await api.createWorkbenchRelease(root) } catch { rejected = true }
      process.stdout.write(JSON.stringify({ injected, rejected, outside: readdirSync(outside) }))
    `
    const observed = await execFile(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { cwd: f.root,
      env: { PATH: process.env.PATH, npm_execpath: process.env.npm_execpath }, timeout: 30_000,
    })
    expect(JSON.parse(observed.stdout)).toEqual({ injected: true, rejected: true, outside: [] })
  } finally { await rm(f.temp, { recursive: true, force: true }) }
}, 60_000)

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1').each(['mkdir', 'open'] as const)('rejects C36 staging critical-section entry substitution with zero outside entries: %s', async variant => {
  const f = await releaseFixture()
  try {
    const outside = path.join(f.temp, 'outside'); await mkdir(outside)
    const script = `
      import fs from 'node:fs/promises'
      import { existsSync, renameSync, symlinkSync, readdirSync } from 'node:fs'
      import { syncBuiltinESMExports } from 'node:module'
      const root = ${JSON.stringify(f.releaseRoot)}
      const outside = ${JSON.stringify(outside)}
      const variant = ${JSON.stringify(variant)}
      const swapped = root + (variant === 'mkdir' ? '/.work' : '/.work/package/docs')
      const originalLstat = fs.lstat
      let injected = false; let docsChecks = 0
      fs.lstat = async function(file, ...args) {
        const stack = new Error().stack
        const result = await originalLstat.call(this, file, ...args)
        // Substitute after the last asynchronous identity read returns, before the protected section.
        const mkdirEntry = variant === 'mkdir' && stack.includes('mkdirOwned') && !stack.includes('retainDirectory')
          && !existsSync(root + '/.work/package')
        const writeEntry = variant === 'open' && String(file) === swapped && stack.includes('writeStagedFile')
          && existsSync(root + '/.work/package/cordis.patch.yml') && !existsSync(root + '/.work/package/docs/compatibility.md')
          && ++docsChecks === 3
        if (!injected && String(file) === swapped && (mkdirEntry || writeEntry)) {
          renameSync(swapped, swapped + '.displaced')
          symlinkSync(outside, swapped, 'dir')
          injected = true
        }
        return result
      }
      syncBuiltinESMExports()
      const api = await import(${JSON.stringify(pathToFileURL(path.join(f.root, 'scripts/verify-package.mjs')).href)})
      let rejected = false
      try { await api.createWorkbenchRelease(root) } catch { rejected = true }
      process.stdout.write(JSON.stringify({ injected, rejected, outside: readdirSync(outside) }))
    `
    const observed = await execFile(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { cwd: f.root,
      env: { PATH: process.env.PATH, npm_execpath: process.env.npm_execpath }, timeout: 30_000,
    })
    expect(JSON.parse(observed.stdout)).toEqual({ injected: true, rejected: true, outside: [] })
  } finally { await rm(f.temp, { recursive: true, force: true }) }
}, 60_000)

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1')('preserves a C36 pack directory substituted before ownership transfer', async () => {
  const f = await releaseFixture()
  try {
    const script = `
      import fs from 'node:fs/promises'
      import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync } from 'node:fs'
      import { syncBuiltinESMExports } from 'node:module'
      const root = ${JSON.stringify(f.releaseRoot)}
      const target = root + '/.work/pack/home'
      const originalLstat = fs.lstat
      let injected = false
      fs.lstat = async function(file, ...args) {
        const result = await originalLstat.call(this, file, ...args)
        if (!injected && String(file) === target) {
          renameSync(target, ${JSON.stringify(path.join(f.temp, 'saved-pack-home'))})
          mkdirSync(target, { mode: 0o700 }); writeFileSync(target + '/unowned', 'preserve')
          injected = true
        }
        return result
      }
      syncBuiltinESMExports()
      const api = await import(${JSON.stringify(pathToFileURL(path.join(f.root, 'scripts/verify-package.mjs')).href)})
      let rejected = false
      try { await api.createWorkbenchRelease(root) } catch { rejected = true }
      process.stdout.write(JSON.stringify({ injected, rejected, replacementPreserved: existsSync(target + '/unowned') && readFileSync(target + '/unowned', 'utf8') === 'preserve' }))
    `
    const observed = await execFile(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { cwd: f.root,
      env: { PATH: process.env.PATH, npm_execpath: process.env.npm_execpath }, timeout: 30_000,
    })
    expect(JSON.parse(observed.stdout)).toEqual({ injected: true, rejected: true, replacementPreserved: true })
  } finally { await rm(f.temp, { recursive: true, force: true }) }
}, 60_000)

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1').each(['unlink', 'rmdir'] as const)('rejects C36 cleanup critical-section entry substitution and preserves the substitute: %s', async variant => {
  const f = await releaseFixture()
  try {
    const summary = await f.module.createWorkbenchRelease(f.releaseRoot)
    const script = `
      import fs from 'node:fs/promises'
      import { existsSync, readFileSync, renameSync, writeFileSync, mkdirSync, lstatSync } from 'node:fs'
      import { syncBuiltinESMExports } from 'node:module'
      const root = ${JSON.stringify(f.releaseRoot)}
      const quarantine = root + '.cleanup-' + ${JSON.stringify(summary.releaseId)}
      const variant = ${JSON.stringify(variant)}
      const target = quarantine + (variant === 'unlink' ? '/receipt.json' : '')
      const originalBytes = readFileSync(root + '/receipt.json')
      const seam = variant === 'unlink' ? 'lstat' : 'readdir'
      const originalRead = fs[seam]
      let injected = false; let replacementIdentity; let reads = 0
      fs[seam] = async function(file, ...args) {
        const result = await originalRead.call(this, file, ...args)
        const atEntry = variant === 'unlink' ? String(file) === target && ++reads === 7 : result.length === 0
        if (!injected && String(file) === target && atEntry) {
          renameSync(target, ${JSON.stringify(path.join(f.temp, 'saved-original'))})
          if (variant === 'unlink') writeFileSync(target, originalBytes, { mode: 0o600, flag: 'wx' })
          else mkdirSync(target, { mode: 0o700 })
          const stat = lstatSync(target)
          replacementIdentity = { dev: stat.dev, ino: stat.ino }
          injected = true
        }
        return result
      }
      syncBuiltinESMExports()
      const api = await import(${JSON.stringify(pathToFileURL(path.join(f.root, 'scripts/verify-package.mjs')).href)})
      const capability = await api.readWorkbenchRelease({ releaseRoot: root, sourceCommit: ${JSON.stringify(summary.sourceCommit)}, receiptSha256: ${JSON.stringify(summary.receiptSha256)} })
      let rejected = false
      try { await api.cleanupWorkbenchRelease(capability) } catch { rejected = true }
      const present = existsSync(target)
      const stat = present ? lstatSync(target) : undefined
      const replacementPreserved = present && stat.dev === replacementIdentity?.dev && stat.ino === replacementIdentity?.ino
        && (variant === 'rmdir' ? stat.isDirectory() : readFileSync(target).equals(originalBytes))
      process.stdout.write(JSON.stringify({ injected, rejected, replacementPreserved }))
    `
    const observed = await execFile(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { cwd: f.root, timeout: 30_000 })
    expect(JSON.parse(observed.stdout)).toEqual({ injected: true, rejected: true, replacementPreserved: true })
  } finally { await rm(f.temp, { recursive: true, force: true }) }
}, 60_000)

test('checks C34 source declaration and its frozen resolution, not only its serialized tuple', async () => {
  const build = await import('../../packages/workbench/build.mjs')
  const parent = 'packages/workbench/src/application/project-service.ts'
  const target = 'packages/workbench/src/application/project-repository.ts'
  const source = await readFile(path.join(repositoryRoot, parent))
  const snapshots = new Map([[parent, source], [target, Buffer.from('frozen target')]])
  expect(() => build.assertElidedProductTypeImport(snapshots)).not.toThrow()
  snapshots.set(parent, Buffer.from(source.toString().replace('type ProjectRepository,', 'ProjectRepository,')))
  expect(() => build.assertElidedProductTypeImport(snapshots)).toThrow()
  snapshots.set(parent, source); snapshots.delete(target)
  expect(() => build.assertElidedProductTypeImport(snapshots)).toThrow()
})
