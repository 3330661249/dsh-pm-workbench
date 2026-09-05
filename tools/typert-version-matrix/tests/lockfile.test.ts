import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { parseMatrixConfig } from '../src/config.js'
import {
  validateInstalledGraph,
  validatePackageLock,
  validateRegistryLockAgreement,
} from '../src/lockfile.js'
import type { MatrixCase, MatrixConfig, RegistryEvidence } from '../src/types.js'

let config: MatrixConfig
let matrixCase: MatrixCase

beforeAll(async () => {
  const file = fileURLToPath(new URL('../config/matrix.official.json', import.meta.url))
  config = parseMatrixConfig(JSON.parse(await readFile(file, 'utf8')))
  matrixCase = config.cases[1]!
})

const direct = () => ({
  '@deepseek-ai/dsh-typert-generator': '0.1.0-rc.7',
  '@deepseek-ai/dsh-typert-protocol': '0.1.0-rc.7',
  '@deepseek-ai/dsh-invariants': '0.1.0-rc.7',
  '@deepseek-ai/cordis': '4.0.1',
  typescript: '6.0.3',
  tsdown: '0.22.2',
  zod: '4.4.3',
})

const lock = (): { name: string; version: string; lockfileVersion: number; requires: boolean; packages: Record<string, any> } => ({
  name: '@knight/dsh-typert-matrix-root',
  version: '0.0.0',
  lockfileVersion: 3,
  requires: true,
  packages: {
    '': { name: '@knight/dsh-typert-matrix-root', version: '0.0.0', devDependencies: direct() },
    'packages/probe': {
      name: '@knight/dsh-typert-matrix-probe',
      version: '0.0.0',
      dependencies: { '@deepseek-ai/dsh-typert-protocol': '0.1.0-rc.7', zod: '4.4.3' },
      peerDependencies: { '@deepseek-ai/cordis': '4.0.1' },
    },
    'node_modules/@knight/dsh-typert-matrix-probe': { resolved: 'packages/probe', link: true },
    ...Object.fromEntries(Object.entries(direct()).map(([name, version]) => [
      `node_modules/${name}`,
      { name, version, integrity: 'sha512-YWJjMTIz', resolved: `https://registry.npmjs.org/${name}/-/${version}.tgz` },
    ])),
  },
})

describe('lock and installed graph validation', () => {
  test('accepts an exact lock with the real workspace link and records a hash', () => {
    expect(validatePackageLock(JSON.stringify(lock()), matrixCase, config.toolchain))
      .toMatchObject({
        lockfileVersion: 3,
        lockSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
        directVersions: direct(),
        directPackages: {
          '@deepseek-ai/dsh-typert-generator': {
            version: '0.1.0-rc.7',
            integrity: 'sha512-YWJjMTIz',
          },
        },
      })
  })

  test('rejects a missing workspace link or direct version drift', () => {
    const noLink = lock()
    delete noLink.packages['node_modules/@knight/dsh-typert-matrix-probe']
    const drift = lock()
    drift.packages['node_modules/@deepseek-ai/dsh-typert-generator']!.version = '0.1.0-rc.8'

    expect(() => validatePackageLock(JSON.stringify(noLink), matrixCase, config.toolchain))
      .toThrow(/workspace link/)
    expect(() => validatePackageLock(JSON.stringify(drift), matrixCase, config.toolchain))
      .toThrow(/version mismatch/)
  })

  test('rejects missing integrity and another DSH cohort hidden in the graph', () => {
    const noIntegrity = lock()
    noIntegrity.packages['node_modules/@deepseek-ai/dsh-invariants']!.integrity = ''
    const mixed = lock()
    mixed.packages['node_modules/@deepseek-ai/dsh-tool-cordis'] = {
      name: '@deepseek-ai/dsh-tool-cordis',
      version: '0.1.0-rc.8',
      integrity: 'sha512-YWJjMTIz',
      resolved: 'https://registry.npmjs.org/x/-/x.tgz',
    }

    expect(() => validatePackageLock(JSON.stringify(noIntegrity), matrixCase, config.toolchain))
      .toThrow(/integrity/)
    expect(() => validatePackageLock(JSON.stringify(mixed), matrixCase, config.toolchain))
      .toThrow(/mixed DSH cohort/)
  })

  test('accepts a clean npm ls graph and rejects npm problem markers', () => {
    const clean = { name: 'root', version: '0.0.0', dependencies: direct() }
    const result = validateInstalledGraph(clean, matrixCase, config.toolchain)
    const broken = { ...clean, problems: ['missing: dependency@1.0.0'] }

    expect(result).toEqual({
      installedGraphSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      problemCount: 0,
      directVersions: direct(),
    })
    expect(() => validateInstalledGraph(broken, matrixCase, config.toolchain)).toThrow(/npm ls problems/)
  })

  test('closes registry version and integrity evidence over every locked direct package', () => {
    const validated = validatePackageLock(JSON.stringify(lock()), matrixCase, config.toolchain)
    const registry = Object.entries(validated.directPackages).map(([name, entry]) => ({
      name,
      requestedVersion: entry.version,
      returnedVersion: entry.version,
      integrity: entry.integrity,
      tarballOrigin: 'https://registry.npmjs.org',
      observedAt: '2026-09-02T00:00:00.000Z',
    })) as RegistryEvidence[]

    expect(() => validateRegistryLockAgreement(registry, validated.directPackages)).not.toThrow()

    const mismatched = registry.map((entry, index) => index === 0
      ? { ...entry, integrity: 'sha512-ZGlmZmVyZW50' as const }
      : entry)
    expect(() => validateRegistryLockAgreement(mismatched, validated.directPackages))
      .toThrow(/registry-lock.*integrity/i)

    expect(() => validateRegistryLockAgreement(registry.slice(1), validated.directPackages))
      .toThrow(/registry-lock.*missing/i)
  })
})
