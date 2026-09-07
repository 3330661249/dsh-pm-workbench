import { spawnSync } from 'node:child_process'
import { closeSync, constants, fstatSync, lstatSync, mkdirSync, openSync, realpathSync } from 'node:fs'
import { lstat, mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { buildPackableWorkbench } from '../packages/workbench/build.mjs'
import {
  validateNpmPackMetadata,
  verifyPackedWorkbenchArtifact,
} from './verify-package.mjs'

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
 * @property {(createdDirectory?: string, createdStat?: import('node:fs').BigIntStats) => Promise<void>} [ownershipGuard]
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

// C36: retain identity before each async guard, then check and mutate synchronously.
// The npm child is a bounded trusted subordinate inside the same exclusive-controller interval.
function retainPackPath(target, entries, directory) {
  if (entries.some(entry => entry.path === target)) return
  if (realpathSync(target) !== target) throw new Error('npm pack path must be a canonical non-symlink path')
  const fd = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK | (directory ? constants.O_DIRECTORY : 0))
  try {
    const stat = fstatSync(fd, { bigint: true }); const atPath = lstatSync(target, { bigint: true })
    if ((directory ? !stat.isDirectory() || !atPath.isDirectory() : !stat.isFile() || !atPath.isFile())
      || atPath.isSymbolicLink() || stat.dev !== atPath.dev || stat.ino !== atPath.ino || stat.mode !== atPath.mode) throw new Error('npm pack path identity changed')
    entries.push({ path: target, fd, stat, directory })
  } catch (error) { closeSync(fd); throw error }
}
function retainPackAncestors(target, entries) {
  let current = path.parse(target).root
  for (const part of ['', ...target.slice(current.length).split('/').filter(Boolean)]) {
    if (part) current = path.join(current, part)
    retainPackPath(current, entries, true)
  }
}
function checkPackPathsSync(entries) {
  for (const entry of entries) {
    const held = fstatSync(entry.fd, { bigint: true }); const atPath = lstatSync(entry.path, { bigint: true })
    for (const value of [held, atPath]) {
      if ((entry.directory ? !value.isDirectory() : !value.isFile()) || value.isSymbolicLink()
        || value.dev !== entry.stat.dev || value.ino !== entry.stat.ino || value.mode !== entry.stat.mode) throw new Error('npm pack path identity changed')
      if (!entry.directory && ['nlink', 'size', 'mtimeNs', 'ctimeNs'].some(field => value[field] !== entry.stat[field])) throw new Error('npm pack file changed')
    }
  }
}
function createPackDirectorySync(target, entries) {
  checkPackPathsSync(entries)
  mkdirSync(target, { mode: 0o700 })
  retainPackPath(target, entries, true)
  checkPackPathsSync(entries)
}
function createPackConfigSync(target, entries) {
  checkPackPathsSync(entries)
  const fd = openSync(target, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW | constants.O_NONBLOCK, 0o600)
  try {
    const stat = fstatSync(fd, { bigint: true }); const atPath = lstatSync(target, { bigint: true })
    if (!stat.isFile() || stat.nlink !== 1n || stat.size !== 0n || Number(stat.mode & 0o7777n) !== 0o600
      || stat.dev !== atPath.dev || stat.ino !== atPath.ino || stat.mode !== atPath.mode) throw new Error('npm pack config identity changed')
    entries.push({ path: target, fd, stat, directory: false })
  } catch (error) { closeSync(fd); throw error }
  checkPackPathsSync(entries)
}

/** @param {NpmPackOptions} options */
export async function runNpmPack(options) {
  await options.ownershipGuard?.()
  const requested = createNpmPackInvocation(options)
  await requireRealDirectory(options.operationRoot, 'npm pack operation root')
  await requireRealDirectory(options.stagedPackageRoot, 'staged package root')
  const nodeExecutable = await requireRealFile(options.nodeExecutable, 'Node executable')
  const npmCliPath = await requireRealFile(options.npmCliPath, 'npm CLI entry')
  const held = []
  try {
    for (const directory of [options.operationRoot, options.stagedPackageRoot, path.dirname(nodeExecutable), path.dirname(npmCliPath)]) retainPackAncestors(directory, held)
    retainPackPath(nodeExecutable, held, false); retainPackPath(npmCliPath, held, false)
    for (const directory of [
      requested.options.env.HOME,
      requested.options.env.TMPDIR,
      requested.options.env.npm_config_cache,
      requested.packOutputRoot,
    ]) {
      await options.ownershipGuard?.()
      createPackDirectorySync(directory, held)
      await requireRealDirectory(directory, 'npm pack owned directory')
      await options.ownershipGuard?.(directory, held.find(entry => entry.path === directory).stat)
    }
    createPackConfigSync(requested.options.env.npm_config_userconfig, held)
    createPackConfigSync(requested.options.env.npm_config_globalconfig, held)

    const invocation = createNpmPackInvocation({
      ...options,
      nodeExecutable,
      npmCliPath,
    })
    await options.ownershipGuard?.()
    options.signal?.throwIfAborted()
    checkPackPathsSync(held)
    const result = spawnSync(invocation.file, invocation.args, invocation.options)
    checkPackPathsSync(held)
    if (result.error || result.status !== 0 || result.signal) throw new Error('npm pack subprocess failed')
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
  } finally { for (const entry of held) closeSync(entry.fd) }
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
