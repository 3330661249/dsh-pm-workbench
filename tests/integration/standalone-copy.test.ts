import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { access, cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import { expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const repositoryRoot = path.resolve(import.meta.dirname, '../..')
const sensitiveEnvironmentName = /(?:token|secret|password|credential|api[_-]?key)|^(?:dsh|harness|deepseek|openai|anthropic|gemini|google|azure|aws|github|gh)_/i
const sourceCandidates = [
  '.github/workflows',
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.host.json',
  'tsconfig.tests.json',
  'vitest.config.ts',
  'packages/workbench',
  'scripts',
  'tests',
] as const

function isGeneratedOrLocal(relative: string): boolean {
  const segments = relative.split(path.sep)
  return segments.includes('node_modules')
    || segments.includes('.tmp')
    || relative === path.join('packages', 'workbench', 'lib')
    || relative.startsWith(`${path.join('packages', 'workbench', 'lib')}${path.sep}`)
}

async function hashSourceCandidates(root: string): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  async function visit(absolute: string): Promise<void> {
    const relative = path.relative(root, absolute)
    if (relative && isGeneratedOrLocal(relative)) return
    const stats = await lstat(absolute)
    if (stats.isDirectory()) {
      for (const name of (await readdir(absolute)).sort()) await visit(path.join(absolute, name))
      return
    }
    if (stats.isFile()) result[relative] = createHash('sha256').update(await readFile(absolute)).digest('hex')
  }

  for (const candidate of sourceCandidates) await visit(path.join(root, candidate))
  return result
}

async function findEscapedSymlinks(root: string, boundary: string): Promise<string[]> {
  const escaped: string[] = []
  const physicalBoundary = await realpath(boundary)

  async function visit(absolute: string): Promise<void> {
    const stats = await lstat(absolute)
    if (stats.isSymbolicLink()) {
      const physicalTarget = await realpath(absolute)
      const relative = path.relative(physicalBoundary, physicalTarget)
      if (relative === '..' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) escaped.push(absolute)
      return
    }
    if (stats.isDirectory()) {
      for (const name of await readdir(absolute)) await visit(path.join(absolute, name))
    }
  }

  await visit(root)
  return escaped
}

test.skipIf(process.env.WORKBENCH_STANDALONE_COPY_CHILD === '1')(
  'installs and verifies an allowlisted source copy from an arbitrary standalone path without network access',
  async () => {
    const fixtureRoot = await mkdtemp(path.join(os.tmpdir(), 'dsh-pm-standalone-'))
    const cloneRoot = path.join(fixtureRoot, 'renamed-repository')
    const sentinel = path.join(fixtureRoot, 'outside-copy-sentinel.txt')
    const cloneCache = path.join(cloneRoot, '.tmp', 'npm-cache')
    const cloneNpmrc = path.join(cloneRoot, '.tmp', 'npmrc')
    const sourceBefore = await hashSourceCandidates(repositoryRoot)

    try {
      await mkdir(cloneRoot, { recursive: true })
      await writeFile(sentinel, 'must remain unchanged\n')
      await mkdir(path.dirname(cloneNpmrc), { recursive: true })
      await writeFile(cloneNpmrc, 'registry=https://registry.npmjs.org/\noffline=true\n')

      for (const candidate of sourceCandidates) {
        await cp(path.join(repositoryRoot, candidate), path.join(cloneRoot, candidate), {
          recursive: true,
          filter(source) {
            const relative = path.relative(repositoryRoot, source)
            return !isGeneratedOrLocal(relative)
          },
        })
      }

      // Seed the already-installed dependency tree so this acceptance test never
      // needs the network. Verbatim relative links keep npm bins and the workspace
      // link inside the arbitrary clone instead of pointing back to this checkout.
      await cp(path.join(repositoryRoot, 'node_modules'), path.join(cloneRoot, 'node_modules'), {
        recursive: true,
        verbatimSymlinks: true,
      })

      const inheritedEnvironment = Object.fromEntries(
        Object.entries(process.env).filter(([name]) => !sensitiveEnvironmentName.test(name)),
      )
      const childEnv = {
        ...inheritedEnvironment,
        WORKBENCH_STANDALONE_COPY_CHILD: '1',
        npm_config_cache: cloneCache,
        npm_config_userconfig: cloneNpmrc,
        npm_config_offline: 'true',
        npm_config_audit: 'false',
        npm_config_fund: 'false',
        npm_config_update_notifier: 'false',
      }
      const runNpm = async (args: string[]) => execFileAsync('npm', args, {
        cwd: cloneRoot,
        env: childEnv,
        maxBuffer: 20 * 1024 * 1024,
      })

      await runNpm(['install', '--offline', '--ignore-scripts', '--no-audit', '--no-fund', '--no-save'])
      await runNpm(['run', 'typecheck'])
      await runNpm(['test'])
      await runNpm(['run', 'build'])
      const verified = await runNpm(['run', 'verify:package'])
      await runNpm(['run', 'pack:dry'])

      expect(verified.stdout).toContain('"status": "verified"')
      await expect(access(path.join(cloneRoot, 'packages', 'workbench', 'lib', 'index.js'))).resolves.toBeUndefined()
      await expect(access(path.join(cloneRoot, 'packages', 'workbench', 'lib', 'client.js'))).resolves.toBeUndefined()
      await expect(access(cloneCache)).resolves.toBeUndefined()
      expect(await findEscapedSymlinks(path.join(cloneRoot, 'node_modules'), cloneRoot)).toEqual([])
      expect(await hashSourceCandidates(cloneRoot)).toEqual(sourceBefore)
      expect(await hashSourceCandidates(repositoryRoot)).toEqual(sourceBefore)
      expect(await readFile(sentinel, 'utf8')).toBe('must remain unchanged\n')
      expect((await readdir(fixtureRoot)).sort()).toEqual(['outside-copy-sentinel.txt', 'renamed-repository'])
    } finally {
      await rm(fixtureRoot, { recursive: true, force: true })
    }
  },
  120_000,
)
