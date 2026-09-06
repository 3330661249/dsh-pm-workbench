import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const workspaceRoot = resolve(import.meta.dirname, '../..')
const rc6DirectPackages = [
  '@deepseek-ai/dsh-agent',
  '@deepseek-ai/dsh-agent-presets',
  '@deepseek-ai/dsh-api-gateway',
  '@deepseek-ai/dsh-api-remotes',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-locale',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-theme',
  '@deepseek-ai/dsh-cordis-host-runner',
  '@deepseek-ai/dsh-host-plugin-inventory',
  '@deepseek-ai/dsh-host-webserver',
  '@deepseek-ai/dsh-invariants',
  '@deepseek-ai/dsh-message-feedback',
  '@deepseek-ai/dsh-sandbox',
  '@deepseek-ai/dsh-sandbox-policy',
  '@deepseek-ai/dsh-storage',
  '@deepseek-ai/dsh-storage-domain',
  '@deepseek-ai/dsh-typert-protocol',
  '@deepseek-ai/dsh-typert-registry',
] as const
const rc6OverridePackages = [
  '@deepseek-ai/dsh-agent-default-model',
  '@deepseek-ai/dsh-atomic-write',
  '@deepseek-ai/dsh-attachment',
  '@deepseek-ai/dsh-brand',
  '@deepseek-ai/dsh-client-schema-form',
  '@deepseek-ai/dsh-client-ui-settings',
  '@deepseek-ai/dsh-code-runtime',
  '@deepseek-ai/dsh-commands',
  '@deepseek-ai/dsh-credentials',
  '@deepseek-ai/dsh-goal',
  '@deepseek-ai/dsh-home-paths',
  '@deepseek-ai/dsh-host-apiproxy',
  '@deepseek-ai/dsh-host-directory-picker',
  '@deepseek-ai/dsh-jobs',
  '@deepseek-ai/dsh-llm',
  '@deepseek-ai/dsh-llm-retry',
  '@deepseek-ai/dsh-native-command',
  '@deepseek-ai/dsh-scope',
  '@deepseek-ai/dsh-session',
  '@deepseek-ai/dsh-session-persistence',
  '@deepseek-ai/dsh-session-projection',
  '@deepseek-ai/dsh-session-projection-cache',
  '@deepseek-ai/dsh-session-query',
  '@deepseek-ai/dsh-session-title',
  '@deepseek-ai/dsh-settings',
  '@deepseek-ai/dsh-skill',
  '@deepseek-ai/dsh-subagent',
  '@deepseek-ai/dsh-system-prompt',
  '@deepseek-ai/dsh-timeout',
  '@deepseek-ai/dsh-tools',
  '@deepseek-ai/dsh-user-approval',
  '@deepseek-ai/dsh-user-questions',
  '@deepseek-ai/dsh-workspace',
] as const
const optionalWorkbenchPeers = [
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-invariants',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-client-runtime',
  '@deepseek-ai/dsh-client-ui-layout',
  '@deepseek-ai/dsh-client-ui-sidebar',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-storage-domain',
  'react',
  'react-dom',
] as const
const compatibilityOverrides = {
  '@deepseek-ai/cordis-plugin-include': '1.0.6',
  '@deepseek-ai/cordis-plugin-loader': '1.0.2',
  '@deepseek-ai/cosmokit': '1.8.2',
  '@deepseek-ai/schemastery': '3.18.1',
} as const

async function readJson(path: string): Promise<Record<string, unknown>> {
  return JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
}

function packageNameFromLockLocation(location: string): string | undefined {
  const marker = 'node_modules/'
  const markerIndex = location.lastIndexOf(marker)
  if (markerIndex === -1) return undefined
  return location.slice(markerIndex + marker.length)
}

describe('rc.6 public smoke surface', () => {
  test('pins the 56-package rc.6 DSH closure without duplicate overrides', async () => {
    const rootManifest = await readJson(resolve(workspaceRoot, 'package.json'))
    const lockfile = await readJson(resolve(workspaceRoot, 'package-lock.json'))
    const rootDevDependencies = rootManifest.devDependencies as Record<string, string>
    const overrides = rootManifest.overrides as Record<string, string>
    const lockPackages = lockfile.packages as Record<string, { name?: string; version?: string }>
    const lockDshOccurrences = Object.entries(lockPackages)
      .map(([location, entry]) => ({
        name: packageNameFromLockLocation(location),
        version: entry.version,
      }))
      .filter((entry): entry is { name: string; version: string | undefined } =>
        entry.name?.startsWith('@deepseek-ai/dsh-') ?? false,
      )
    const uniqueLockDshNames = [...new Set(lockDshOccurrences.map((entry) => entry.name))]
    const rootDshDevDependencyKeys = Object.keys(rootDevDependencies)
      .filter((packageName) => packageName.startsWith('@deepseek-ai/dsh-'))
      .sort()

    expect(rootDevDependencies['@deepseek-ai/cordis']).toBe('4.0.1')
    expect(rootDshDevDependencyKeys).toEqual([...rc6DirectPackages].sort())
    for (const packageName of rc6DirectPackages) {
      expect(rootDevDependencies[packageName]).toBe('0.1.0-rc.6')
    }
    expect(overrides).toEqual({
      ...Object.fromEntries(
        rc6OverridePackages.map((packageName) => [packageName, '0.1.0-rc.6']),
      ),
      ...compatibilityOverrides,
    })
    for (const packageName of rc6DirectPackages) {
      expect(overrides).not.toHaveProperty(packageName)
    }
    for (const packageName of rc6OverridePackages) {
      expect(rootDevDependencies).not.toHaveProperty(packageName)
    }
    expect(uniqueLockDshNames.sort()).toEqual(
      [...rc6DirectPackages, ...rc6OverridePackages].sort(),
    )
    expect(uniqueLockDshNames).toHaveLength(56)
    expect(lockDshOccurrences.every((entry) => entry.version === '0.1.0-rc.6')).toBe(true)
  })

  test('pins the non-DSH Cordis compatibility cohort separately from the DSH closure', async () => {
    const rootManifest = await readJson(resolve(workspaceRoot, 'package.json'))
    const lockfile = await readJson(resolve(workspaceRoot, 'package-lock.json'))
    const rootDevDependencies = rootManifest.devDependencies as Record<string, string>
    const overrides = rootManifest.overrides as Record<string, string>
    const lockPackages = lockfile.packages as Record<string, { version?: string }>

    expect(rootDevDependencies['@deepseek-ai/cordis']).toBe('4.0.1')
    const lockOccurrences = Object.entries(lockPackages).map(([location, entry]) => ({
      name: packageNameFromLockLocation(location),
      version: entry.version,
    }))

    for (const [packageName, version] of Object.entries(compatibilityOverrides)) {
      expect(rootDevDependencies).not.toHaveProperty(packageName)
      expect(overrides[packageName]).toBe(version)
      const occurrences = lockOccurrences.filter((entry) => entry.name === packageName)
      expect(occurrences.length).toBeGreaterThan(0)
      expect(occurrences.every((entry) => entry.version === version)).toBe(true)
    }
  })

  test('pins every Zod occurrence to the rc.6 Harness-compatible 4.4.3', async () => {
    const rootManifest = await readJson(resolve(workspaceRoot, 'package.json'))
    const lockfile = await readJson(resolve(workspaceRoot, 'package-lock.json'))
    const rootDevDependencies = rootManifest.devDependencies as Record<string, string>
    const lockPackages = lockfile.packages as Record<string, { version?: string }>
    const zodOccurrences = Object.entries(lockPackages)
      .map(([location, entry]) => ({
        name: packageNameFromLockLocation(location),
        version: entry.version,
      }))
      .filter((entry) => entry.name === 'zod')

    expect(rootDevDependencies.zod).toBe('4.4.3')
    expect(zodOccurrences.length).toBeGreaterThan(0)
    expect(zodOccurrences.every((entry) => entry.version === '4.4.3')).toBe(true)
  })

  test('resolves the exact direct public rc.6 package manifests', async () => {
    const resolvedManifests = await Promise.all(
      rc6DirectPackages.map((packageName) =>
        readJson(resolve(workspaceRoot, 'node_modules', packageName, 'package.json')),
      ),
    )

    for (const manifest of resolvedManifests) {
      expect(manifest.version).toBe('0.1.0-rc.6')
    }
  })

  test('keeps bundled Zod development-owned and declares the ordered additive client injections', async () => {
    const workbenchManifest = await readJson(
      resolve(workspaceRoot, 'packages/workbench/package.json'),
    )
    const lockfile = await readJson(resolve(workspaceRoot, 'package-lock.json'))
    const workspaceLock = (lockfile.packages as Record<string, Record<string, unknown>>)['packages/workbench']
    const peerDependencies = workbenchManifest.peerDependencies as Record<string, string>
    const peerDependenciesMeta = workbenchManifest.peerDependenciesMeta as Record<string, unknown>
    const dsh = workbenchManifest.dsh as {
      client: { inject: string[]; platform: string }
    }

    expect(workbenchManifest).not.toHaveProperty('dependencies')
    expect(workspaceLock).not.toHaveProperty('dependencies')
    expect(dsh.client).toEqual({
      platform: 'web',
      inject: [
        '@deepseek-ai/dsh-client-connection',
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-ui-layout',
        '@deepseek-ai/dsh-client-ui-sidebar',
      ],
    })
    expect(peerDependencies).toEqual({
      '@deepseek-ai/cordis': '4.0.1',
      '@deepseek-ai/dsh-invariants': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-connection': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-layout': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-sidebar': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-slots': '0.1.0-rc.6',
      '@deepseek-ai/dsh-storage-domain': '0.1.0-rc.6',
      react: '18.3.1',
      'react-dom': '18.3.1',
    })
    expect(peerDependenciesMeta).toEqual(Object.fromEntries(
      optionalWorkbenchPeers.map((packageName) => [packageName, { optional: true }]),
    ))
  })
})
