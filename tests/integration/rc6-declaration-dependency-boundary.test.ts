import { execFile } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, resolve } from 'node:path'
import { promisify } from 'node:util'
import { describe, expect, test } from 'vitest'

const workspaceRoot = resolve(import.meta.dirname, '../..')

const closure = await import('../../scripts/verify-rc6-declaration-closure.mjs')
const eligibility = await closure.getLocalReplayEligibility({ workspaceRoot })
const execFileAsync = promisify(execFile)
const closureRelativePath = 'research/2026-09-05-rc6-declaration-closure.json'

async function createClosureCliFixture() {
  const root = await mkdtemp(resolve(tmpdir(), 'rc6-retired-closure-cli-'))
  const scriptsRoot = resolve(root, 'scripts')
  await mkdir(scriptsRoot, { recursive: true })
  await Promise.all([
    copyFile(
      resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs'),
      resolve(scriptsRoot, 'accept-rc6-declaration-input.mjs'),
    ),
    copyFile(
      resolve(workspaceRoot, 'scripts/verify-rc6-declaration-closure.mjs'),
      resolve(scriptsRoot, 'verify-rc6-declaration-closure.mjs'),
    ),
  ])
  return root
}

async function runClosureFixtureCli(root: string, argv: string[]) {
  const script = resolve(root, 'scripts/verify-rc6-declaration-closure.mjs')
  return execFileAsync(process.execPath, [script, ...argv], { cwd: root })
}

type DependencyManifestFixture = {
  name: string
  version: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  peerDependencies?: Record<string, string>
  peerDependenciesMeta?: Record<string, { optional?: boolean }>
}

type InstalledPlacementFixture = {
  packageLock: {
    packages: Record<string, {
      version?: string
      integrity?: string
      dependencies?: Record<string, string>
      optionalDependencies?: Record<string, string>
      peerDependencies?: Record<string, string>
      peerDependenciesMeta?: Record<string, { optional?: boolean }>
    }>
  }
  installed: Array<{
    lockPath: string
    manifestPath: string
    manifest: DependencyManifestFixture
  }>
}

function installedPlacementFixture(): InstalledPlacementFixture {
  return {
    packageLock: {
      packages: {
        '': {},
        'node_modules/@deepseek-ai/cordis': {
          version: '4.0.1',
          integrity: 'sha512-cordis',
          dependencies: {
            '@deepseek-ai/cosmokit': '^1.8.2',
            '@standard-schema/spec': '^1.1.0',
          },
          optionalDependencies: {},
          peerDependencies: {
            '@deepseek-ai/cordis-plugin-include': '^1.0.6',
            '@deepseek-ai/cordis-plugin-loader': '^1.0.2',
          },
          peerDependenciesMeta: {
            '@deepseek-ai/cordis-plugin-include': { optional: true },
            '@deepseek-ai/cordis-plugin-loader': { optional: true },
          },
        },
        'node_modules/@deepseek-ai/schemastery': {
          version: '3.18.1',
          integrity: 'sha512-schemastery',
        },
        'node_modules/katex/node_modules/commander': {
          version: '8.3.0',
          integrity: 'sha512-commander',
        },
      },
    },
    installed: [
      {
        lockPath: 'node_modules/@deepseek-ai/cordis',
        manifestPath: '/fixture/node_modules/@deepseek-ai/cordis/package.json',
        manifest: {
          name: '@deepseek-ai/cordis',
          version: '4.0.1',
          dependencies: {
            '@standard-schema/spec': '^1.1.0',
            '@deepseek-ai/cosmokit': '^1.8.2',
          },
          peerDependencies: {
            '@deepseek-ai/cordis-plugin-loader': '^1.0.2',
            '@deepseek-ai/cordis-plugin-include': '^1.0.6',
          },
          peerDependenciesMeta: {
            '@deepseek-ai/cordis-plugin-loader': { optional: true },
            '@deepseek-ai/cordis-plugin-include': { optional: true },
          },
        },
      },
      {
        lockPath: 'node_modules/@deepseek-ai/schemastery',
        manifestPath: '/fixture/node_modules/@deepseek-ai/schemastery/package.json',
        manifest: { name: '@deepseek-ai/schemastery', version: '3.18.1' },
      },
      {
        lockPath: 'node_modules/katex/node_modules/commander',
        manifestPath: '/fixture/node_modules/katex/node_modules/commander/package.json',
        manifest: { name: 'commander', version: '8.3.0' },
      },
    ],
  }
}

describe('rc.6 declaration dependency boundary', () => {
  test('accepts canonical dependency metadata across key order and missing empty fields', () => {
    expect(() => closure.assertInstalledPlacement(installedPlacementFixture())).not.toThrow()
  })

  test('rejects an installed manifest with a dependency deleted from the lock record', () => {
    const fixture = installedPlacementFixture()
    delete fixture.installed[0]!.manifest.dependencies!['@standard-schema/spec']

    expect(() => closure.assertInstalledPlacement(fixture)).toThrowError(
      'INSTALLED_LOCK_DEPENDENCY_METADATA_MISMATCH: node_modules/@deepseek-ai/cordis:dependencies',
    )
  })

  test('rejects an installed manifest with a dependency added beyond the lock record', () => {
    const fixture = installedPlacementFixture()
    fixture.installed[0]!.manifest.dependencies!['unexpected-package'] = '1.0.0'

    expect(() => closure.assertInstalledPlacement(fixture)).toThrowError(
      'INSTALLED_LOCK_DEPENDENCY_METADATA_MISMATCH: node_modules/@deepseek-ai/cordis:dependencies',
    )
  })

  test('rejects an installed manifest with mutated peer dependency metadata', () => {
    const fixture = installedPlacementFixture()
    fixture.installed[0]!.manifest.peerDependenciesMeta!['@deepseek-ai/cordis-plugin-loader']!.optional = false

    expect(() => closure.assertInstalledPlacement(fixture)).toThrowError(
      'INSTALLED_LOCK_DEPENDENCY_METADATA_MISMATCH: node_modules/@deepseek-ai/cordis:peerDependenciesMeta',
    )
  })

  test('audits the committed closure without requiring any local cache or accepted installation', async () => {
    const audit = await closure.inspectCommittedDeclarationClosure({ workspaceRoot })

    expect(audit.packageCounts).toEqual({ registry: 169, deepseek: 59, dsh: 54 })
    expect(audit.closure.fullDeepseekCohort).toHaveLength(59)
    expect(audit.closure.selectedDeclarationSubgraph.roots).toEqual([
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-ui-slots',
    ])
    expect(audit.closure.fullDeepseekCohort.every((entry: { name: string; version: string }) =>
      entry.name.startsWith('@deepseek-ai/') &&
      entry.name.startsWith('@deepseek-ai/dsh-')
        ? entry.version === '0.1.0-rc.6'
        : true,
    )).toBe(true)
  })

  test.skipIf(!eligibility.eligible)(
    'replays the local accepted root only when cache and root are both present',
    async () => {
      const replay = await closure.verifyLocalAcceptedDeclarationClosure({ workspaceRoot })

      expect(replay.status).toBe('PASS_LOCAL_REPLAY')
      expect(replay.selectedDeclarationManifests).toHaveLength(5)
      expect(replay.storage?.selectedOrImported).toBe(false)
      expect(replay.selectedCacheReadOnly).toBe(true)
      expect(replay.realpathsWithinAcceptedRoot).toBe(true)
    },
  )

  test.skipIf(eligibility.eligible)(
    'SKIP_ACCEPTED_CACHE_OR_ROOT_ABSENT',
    () => {
      expect(eligibility.reason).toBe('SKIP_ACCEPTED_CACHE_OR_ROOT_ABSENT')
    },
  )

  test('rejects the retired closure writer without observing caller input or changing the historical closure', async () => {
    const before = await readFile(resolve(workspaceRoot, closureRelativePath))
    const missingWorkspace = resolve(await mkdtemp(resolve(tmpdir(), 'rc6-retired-closure-writer-')), 'missing')
    const explosiveInput = new Proxy({}, {
      get() {
        throw new Error('caller input must remain unobserved')
      },
    })

    try {
      const proxyOutcome = await closure.writeCommittedDeclarationClosure(explosiveInput).then(
        () => 'RESOLVED',
        (error) => error,
      )
      const missingWorkspaceOutcome = await closure.writeCommittedDeclarationClosure({ workspaceRoot: missingWorkspace }).then(
        () => 'RESOLVED',
        (error) => error,
      )

      expect(proxyOutcome).toMatchObject({
        code: 'LEGACY_CLOSURE_WRITE_DISABLED',
      })
      expect(missingWorkspaceOutcome).toMatchObject({
        code: 'LEGACY_CLOSURE_WRITE_DISABLED',
      })
      await expect(readFile(resolve(workspaceRoot, closureRelativePath))).resolves.toEqual(before)
    } finally {
      await rm(dirname(missingWorkspace), { recursive: true, force: true })
    }
  })

  test.each([
    { label: 'empty', argv: [] },
    { label: 'write', argv: ['--write'] },
    { label: 'check-metadata-only', argv: ['--check-metadata-only'] },
    { label: 'check-realpaths', argv: ['--check-realpaths'] },
    { label: 'unknown', argv: ['--unknown'] },
  ])('rejects retired closure CLI argv $label with fixed policy JSON only and preserves the historical closure', async ({ argv }) => {
    const root = await createClosureCliFixture()
    const before = await readFile(resolve(workspaceRoot, closureRelativePath))

    try {
      await expect(runClosureFixtureCli(root, argv)).rejects.toMatchObject({
        code: 1,
        stdout: `${JSON.stringify({
          status: 'FAIL_CLOSURE_POLICY',
          reasonCode: 'LEGACY_CLOSURE_WRITE_DISABLED',
        }, null, 2)}\n`,
        stderr: '',
      })
      await expect(readFile(resolve(workspaceRoot, closureRelativePath))).resolves.toEqual(before)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
