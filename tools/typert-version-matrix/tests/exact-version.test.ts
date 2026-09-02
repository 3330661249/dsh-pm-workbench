import { describe, expect, test } from 'vitest'

const accepted = [
  '0.1.0',
  '0.1.0-rc.6',
  '0.1.2-alpha.4',
  '24.14.0',
  '1.2.3-beta.1+darwin.arm64',
]

const rejected = [
  '',
  '1',
  '1.2',
  '01.2.3',
  '1.02.3',
  '1.2.03',
  '1.2.3-01',
  'v1.2.3',
  ' 1.2.3',
  '1.2.3 ',
  '^1.2.3',
  '~1.2.3',
  '>=1.2.3',
  '*',
  'latest',
  'next',
  'npm:thing@1.2.3',
  'file:../thing',
  'workspace:*',
  'https://registry.npmjs.org/pkg',
  'git+https://github.com/example/repo.git',
  '1.2.3;echo',
  '1.2.3$(id)',
  '1.2.3|cat',
]

describe('parseExactVersion', () => {
  test.each(accepted)('accepts and preserves exact SemVer %s', async (value) => {
    const { parseExactVersion } = await import('../src/exact-version.js')

    expect(parseExactVersion(value)).toBe(value)
  })

  test.each(rejected)('rejects non-exact or unsafe version %j', async (value) => {
    const { parseExactVersion } = await import('../src/exact-version.js')

    expect(() => parseExactVersion(value)).toThrow(/exact SemVer/)
  })

  test('rejects non-string values rather than coercing them', async () => {
    const { parseExactVersion } = await import('../src/exact-version.js')

    expect(() => parseExactVersion(123)).toThrow(/exact SemVer/)
  })
})
