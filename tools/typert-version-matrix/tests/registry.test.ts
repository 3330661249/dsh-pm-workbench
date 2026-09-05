import { describe, expect, test } from 'vitest'
import { parseRegistryMetadata } from '../src/registry.js'

const raw = () => ({
  name: '@deepseek-ai/dsh-typert-generator',
  version: '0.1.0-rc.7',
  dist: {
    integrity: 'sha512-YWJjMTIz',
    tarball: 'https://registry.npmjs.org/@deepseek-ai/dsh-typert-generator/-/dsh-typert-generator-0.1.0-rc.7.tgz',
  },
  repository: {
    type: 'git',
    url: 'git+https://github.com/deepseek-ai/deepseek-harness.git',
  },
  token: 'must-not-be-copied',
})

describe('parseRegistryMetadata', () => {
  test('keeps only exact official registry evidence', () => {
    expect(parseRegistryMetadata(
      '@deepseek-ai/dsh-typert-generator',
      '0.1.0-rc.7',
      raw(),
      '2026-09-02T00:00:00.000Z',
    )).toEqual({
      name: '@deepseek-ai/dsh-typert-generator',
      requestedVersion: '0.1.0-rc.7',
      returnedVersion: '0.1.0-rc.7',
      integrity: 'sha512-YWJjMTIz',
      tarballOrigin: 'https://registry.npmjs.org',
      repositoryUrl: 'git+https://github.com/deepseek-ai/deepseek-harness.git',
      observedAt: '2026-09-02T00:00:00.000Z',
    })
  })

  test('accepts npm 11 multi-field output with literal dist selector keys', () => {
    const value = raw()
    const flat = {
      name: value.name,
      version: value.version,
      'dist.integrity': value.dist.integrity,
      'dist.tarball': value.dist.tarball,
      repository: value.repository,
    }

    expect(parseRegistryMetadata(
      '@deepseek-ai/dsh-typert-generator',
      '0.1.0-rc.7',
      flat,
      '2026-09-02T00:00:00.000Z',
    )).toMatchObject({
      integrity: 'sha512-YWJjMTIz',
      tarballOrigin: 'https://registry.npmjs.org',
    })
  })

  test.each([
    ['wrong version', (value: ReturnType<typeof raw>) => { value.version = '0.1.0-rc.8' }],
    ['missing integrity', (value: ReturnType<typeof raw>) => { value.dist.integrity = '' }],
    ['mirror origin', (value: ReturnType<typeof raw>) => { value.dist.tarball = 'https://mirror.invalid/pkg.tgz' }],
    ['wrong repository', (value: ReturnType<typeof raw>) => { value.repository.url = 'https://github.com/example/fork.git' }],
  ])('rejects %s as inconclusive registry evidence', (_label, mutate) => {
    const value = raw()
    mutate(value)

    expect(() => parseRegistryMetadata(
      '@deepseek-ai/dsh-typert-generator',
      '0.1.0-rc.7',
      value,
      '2026-09-02T00:00:00.000Z',
    )).toThrow(/registry evidence/)
  })
})
