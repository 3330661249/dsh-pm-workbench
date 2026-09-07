import { execFile as execFileCallback } from 'node:child_process'
import { lstat, mkdir, mkdtemp, realpath, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'
import { pathToFileURL } from 'node:url'

import { buildPackableWorkbench } from '../packages/workbench/build.mjs'
import {
  validateNpmPackMetadata,
  verifyPackedWorkbenchArtifact,
} from './verify-package.mjs'

const execFile = promisify(execFileCallback)
const defaultRepositoryRoot = path.resolve(import.meta.dirname, '..')

function requireAbsolute(value, label) {
  if (typeof value !== 'string' || !path.isAbsolute(value)) {
    throw new Error(`${label} must be absolute`)
  }
}

function operationPath(operationRoot, name) {
  const target = path.join(operationRoot, name)
  const relative = path.relative(operationRoot, target)
  if (relative === '' || relative.startsWith(`..${path.sep}`) || relative === '..' || path.isAbsolute(relative)) {
    throw new Error('npm pack operation path escaped its root')
  }
  return target
}

/**
 * @typedef {object} NpmPackOptions
 * @property {string} nodeExecutable
 * @property {string} npmCliPath
 * @property {string} stagedPackageRoot
 * @property {string} operationRoot
 * @property {boolean} [dryRun]
 * @property {AbortSignal} [signal]
 * @property {(createdDirectory?: string) => Promise<void>} [ownershipGuard]
 */

/** @param {NpmPackOptions} options */
export function createNpmPackInvocation({
  nodeExecutable,
  npmCliPath,
  stagedPackageRoot,
  operationRoot,
  dryRun = false,
  signal,
}) {
  requireAbsolute(nodeExecutable, 'absolute Node executable')
  requireAbsolute(npmCliPath, 'absolute npm CLI entry')
  requireAbsolute(stagedPackageRoot, 'staged package root')
  requireAbsolute(operationRoot, 'npm pack operation root')

  const homeRoot = operationPath(operationRoot, 'home')
  const tempRoot = operationPath(operationRoot, 'tmp')
  const cacheRoot = operationPath(operationRoot, 'cache')
  const userConfig = operationPath(operationRoot, 'user-npmrc')
  const globalConfig = operationPath(operationRoot, 'global-npmrc')
  const packOutputRoot = operationPath(operationRoot, 'pack-output')
  const environment = Object.freeze({
    HOME: homeRoot,
    TMPDIR: tempRoot,
    LANG: 'C',
    LC_ALL: 'C',
    npm_config_cache: cacheRoot,
    npm_config_userconfig: userConfig,
    npm_config_globalconfig: globalConfig,
    npm_config_offline: 'true',
    npm_config_ignore_scripts: 'true',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  })
  const args = [
    npmCliPath,
    'pack',
    '.',
    '--json',
    '--ignore-scripts',
    '--offline',
    '--pack-destination',
    packOutputRoot,
    '--cache',
    cacheRoot,
    '--userconfig',
    userConfig,
    '--globalconfig',
    globalConfig,
    '--audit=false',
    '--fund=false',
    '--update-notifier=false',
    '--loglevel=error',
  ]
  if (dryRun) args.push('--dry-run')
  return Object.freeze({
    file: nodeExecutable,
    args: Object.freeze(args),
    packOutputRoot,
    options: Object.freeze({
      cwd: stagedPackageRoot,
      shell: false,
      env: environment,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      timeout: 30_000,
      ...(signal ? { signal } : {}),
    }),
  })
}

async function requireRealDirectory(directory, label) {
  const stats = await lstat(directory)
  if (!stats.isDirectory() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a canonical non-symlink directory`)
  }
  if (await realpath(directory) !== directory) {
    throw new Error(`${label} must be a canonical non-symlink directory`)
  }
  return directory
}

async function requireRealFile(file, label) {
  const stats = await lstat(file)
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} must be a canonical non-symlink regular file`)
  }
  if (await realpath(file) !== file) {
    throw new Error(`${label} must be a canonical non-symlink regular file`)
  }
  return file
}

/** @param {NpmPackOptions} options */
export async function runNpmPack(options) {
  await options.ownershipGuard?.()
  const requested = createNpmPackInvocation(options)
  await requireRealDirectory(options.operationRoot, 'npm pack operation root')
  await requireRealDirectory(options.stagedPackageRoot, 'staged package root')
  const nodeExecutable = await requireRealFile(options.nodeExecutable, 'Node executable')
  const npmCliPath = await requireRealFile(options.npmCliPath, 'npm CLI entry')

  for (const directory of [
    requested.options.env.HOME,
    requested.options.env.TMPDIR,
    requested.options.env.npm_config_cache,
    requested.packOutputRoot,
  ]) {
    await options.ownershipGuard?.()
    await mkdir(directory, { mode: 0o700 })
    await requireRealDirectory(directory, 'npm pack owned directory')
    await options.ownershipGuard?.(directory)
  }
  await writeFile(requested.options.env.npm_config_userconfig, '', { flag: 'wx', mode: 0o600 })
  await writeFile(requested.options.env.npm_config_globalconfig, '', { flag: 'wx', mode: 0o600 })

  const invocation = createNpmPackInvocation({
    ...options,
    nodeExecutable,
    npmCliPath,
  })
  await options.ownershipGuard?.()
  const result = await execFile(invocation.file, invocation.args, invocation.options)
  await options.ownershipGuard?.()
  const metadata = validateNpmPackMetadata(JSON.parse(result.stdout))
  if (options.dryRun) {
    return Object.freeze({
      metadata,
      tgzAbsolutePath: undefined,
      sha256: undefined,
      stdout: result.stdout,
      stderr: result.stderr,
    })
  }
  const artifact = await verifyPackedWorkbenchArtifact({
    packOutputRoot: invocation.packOutputRoot,
    metadata,
  })
  return Object.freeze({
    metadata,
    tgzAbsolutePath: artifact.tgzAbsolutePath,
    sha256: artifact.sha256,
    stdout: result.stdout,
    stderr: result.stderr,
  })
}

async function runPackDryCli() {
  const npmCliPath = process.env.npm_execpath
  if (typeof npmCliPath !== 'string' || !path.isAbsolute(npmCliPath)) {
    throw new Error('npm run pack:dry requires an absolute npm CLI entry')
  }
  await buildPackableWorkbench()
  const cacheParent = path.join(defaultRepositoryRoot, '.tmp', 'npm-cache')
  await mkdir(cacheParent, { recursive: true })
  const operationRoot = await mkdtemp(path.join(cacheParent, 'pack-dry-'))
  try {
    const result = await runNpmPack({
      nodeExecutable: process.execPath,
      npmCliPath,
      stagedPackageRoot: path.join(defaultRepositoryRoot, 'packages/workbench'),
      operationRoot,
      dryRun: true,
    })
    if (result.stderr) process.stderr.write(result.stderr)
    process.stdout.write(result.stdout)
  } finally {
    await rm(operationRoot, { recursive: true, force: true })
  }
}

const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) await runPackDryCli()
