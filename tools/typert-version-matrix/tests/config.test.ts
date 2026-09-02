import { readFileSync } from 'node:fs'
import { readFile as readFileAsync } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parseMatrixConfig } from '../src/config.js'

const dshPackages = (version: string, cordis = '4.0.1') => ({
  '@deepseek-ai/dsh-typert-generator': version,
  '@deepseek-ai/dsh-typert-protocol': version,
  '@deepseek-ai/dsh-invariants': version,
  '@deepseek-ai/cordis': cordis,
})

function rawMatrix(name: string): ReturnType<typeof JSON.parse> {
  return JSON.parse(readFileSync(
    fileURLToPath(new URL(`../config/${name}`, import.meta.url)),
    'utf8',
  ))
}

const matrix = () => structuredClone(rawMatrix('matrix.official.json'))

describe('parseMatrixConfig', () => {
  test.each([
    ['matrix.official.json', 'selection', 5],
    ['matrix.official-experimental.json', 'experimental', 3],
    ['matrix.legacy-diagnostic.json', 'diagnostic', 3],
  ] as const)('validates the shipped %s cohort inventory', async (file, purpose, count) => {
    const configPath = fileURLToPath(new URL(`../config/${file}`, import.meta.url))
    const parsed = parseMatrixConfig(JSON.parse(await readFileAsync(configPath, 'utf8')))

    expect(parsed.purpose).toBe(purpose)
    expect(parsed.cases).toHaveLength(count)
  })

  test('accepts the closed official selection shape', () => {
    const parsed = parseMatrixConfig(matrix())
    expect(parsed).toMatchObject({
      schemaVersion: '1',
      decisionMode: 'selection',
      purpose: 'selection',
    })
    expect(parsed.cases.map(({ role }) => role)).toEqual([
      'control',
      'candidate',
      'candidate',
      'candidate',
      'candidate',
    ])
  })

  test('rejects unknown top-level and per-case fields', () => {
    const top = { ...matrix(), command: 'npm install' }
    const nested = matrix()
    nested.cases[0] = { ...nested.cases[0], toolchain: { typescript: '6.0.3' } } as never

    expect(() => parseMatrixConfig(top)).toThrow(/unknown key.*command/i)
    expect(() => parseMatrixConfig(nested)).toThrow(/unknown key.*toolchain/i)
  })

  test('does not let matrix or case JSON override runner timeout policy', () => {
    const top = { ...matrix(), timeoutMs: 1 }
    const nested = matrix()
    nested.cases[0] = { ...nested.cases[0], timeoutMs: 1 } as never

    expect(() => parseMatrixConfig(top)).toThrow(/unknown key.*timeoutMs/i)
    expect(() => parseMatrixConfig(nested)).toThrow(/unknown key.*timeoutMs/i)
  })

  test('does not let matrix or case JSON provide runner provenance', () => {
    const top = { ...matrix(), provenance: { configSha256: '0'.repeat(64) } }
    const nested = matrix()
    nested.cases[0] = {
      ...nested.cases[0],
      provenance: { runnerGit: { commit: '0'.repeat(40), worktreeClean: true } },
    }

    expect(() => parseMatrixConfig(top)).toThrow(/unknown key.*provenance/i)
    expect(() => parseMatrixConfig(nested)).toThrow(/unknown key.*provenance/i)
  })

  test('rejects unapproved registry, adapter, fixture, and policy relaxation', () => {
    const badRegistry = { ...matrix(), registry: 'https://example.invalid/' }
    const badAdapter = { ...matrix(), generatorAdapter: 'guess-v2' }
    const badFixture = { ...matrix(), fixture: 'strict-remote-v2' }
    const badPolicy = matrix()
    badPolicy.policy.requireAllCasesConclusive = false

    expect(() => parseMatrixConfig(badRegistry)).toThrow(/registry/)
    expect(() => parseMatrixConfig(badAdapter)).toThrow(/adapter/)
    expect(() => parseMatrixConfig(badFixture)).toThrow(/fixture/)
    expect(() => parseMatrixConfig(badPolicy)).toThrow(/policy/)
  })

  test('rejects duplicate or unsafe case ids', () => {
    const duplicate = matrix()
    duplicate.cases[1]!.id = duplicate.cases[0]!.id
    const unsafe = matrix()
    unsafe.cases[1]!.id = '../candidate'

    expect(() => parseMatrixConfig(duplicate)).toThrow(/duplicate case id/)
    expect(() => parseMatrixConfig(unsafe)).toThrow(/case id/)
  })

  test('rejects missing selection roles', () => {
    const noControl = matrix()
    noControl.cases = noControl.cases.filter((entry: { role: string }) => entry.role !== 'control')
    const noCandidate = matrix()
    noCandidate.cases = noCandidate.cases.filter((entry: { role: string }) => entry.role !== 'candidate')

    expect(() => parseMatrixConfig(noControl)).toThrow(/control/)
    expect(() => parseMatrixConfig(noCandidate)).toThrow(/candidate/)
  })

  test('rejects unknown packages and mixed DSH cohort versions', () => {
    const unknown = matrix()
    unknown.cases[1]!.packages = {
      ...unknown.cases[1]!.packages,
      '@deepseek-ai/dsh-tool-cordis': '0.1.1-rc.2',
    } as never
    const mixed = matrix()
    mixed.cases[1]!.packages['@deepseek-ai/dsh-invariants'] = '0.1.0-rc.8'

    expect(() => parseMatrixConfig(unknown)).toThrow(/unknown key.*dsh-tool-cordis/i)
    expect(() => parseMatrixConfig(mixed)).toThrow(/aligned DSH cohort/)
  })

  test('rejects tags, ranges, URLs, and local specs anywhere a version is required', () => {
    for (const bad of ['latest', '^0.1.1', 'file:../pkg', 'https://example.invalid/pkg']) {
      const input = matrix()
      input.cases[1]!.packages['@deepseek-ai/dsh-typert-generator'] = bad
      expect(() => parseMatrixConfig(input), bad).toThrow(/exact SemVer/)
    }
  })

  test('rejects an exact but unreviewed cohort and the wrong reviewed Cordis boundary', () => {
    const unreviewed = matrix()
    unreviewed.cases[1]!.release['@deepseek-ai/dsh'] = '9.9.9'
    unreviewed.cases[1]!.packages = dshPackages('9.9.9')
    const wrongCordis = matrix()
    wrongCordis.cases[1]!.packages['@deepseek-ai/cordis'] = '4.0.2'

    expect(() => parseMatrixConfig(unreviewed)).toThrow(/reviewed cohort/)
    expect(() => parseMatrixConfig(wrongCordis)).toThrow(/Cordis/)
  })

  test.each([
    ['missing case', (input: ReturnType<typeof matrix>) => { input.cases.pop() }],
    ['extra case', (input: ReturnType<typeof matrix>) => {
      input.cases.push({
        id: 'typert-0.1.0-rc.5-extra',
        role: 'candidate',
        release: { '@deepseek-ai/dsh': '0.1.0-rc.5' },
        packages: dshPackages('0.1.0-rc.5'),
      })
    }],
    ['tampered id', (input: ReturnType<typeof matrix>) => {
      input.cases[1].id = 'typert-0.1.0-rc.7-renamed'
    }],
    ['tampered role', (input: ReturnType<typeof matrix>) => {
      input.cases[1].role = 'control'
    }],
    ['tampered package', (input: ReturnType<typeof matrix>) => {
      input.cases[1].packages['@deepseek-ai/cordis'] = '4.0.2'
    }],
  ])('rejects an official selection inventory with a %s', (_label, mutate) => {
    const input = matrix()
    mutate(input)

    expect(() => parseMatrixConfig(input)).toThrow(/official case inventory|reviewed boundary/i)
  })

  test.each([
    '@deepseek-ai/dsh-typert-generator',
    '@deepseek-ai/dsh-typert-protocol',
    '@deepseek-ai/dsh-invariants',
    '@deepseek-ai/cordis',
  ])('rejects a tampered exact %s package version', (packageName) => {
    const input = matrix()
    input.cases[1].packages[packageName] = packageName === '@deepseek-ai/cordis'
      ? '4.0.2'
      : '0.1.0-rc.8'

    expect(() => parseMatrixConfig(input)).toThrow(/aligned DSH cohort|official case inventory/i)
  })

  test('supports isolated exploratory and legacy diagnostics without making them candidates', () => {
    const experimental = rawMatrix('matrix.official-experimental.json')
    const legacy = rawMatrix('matrix.legacy-diagnostic.json')

    expect(parseMatrixConfig(experimental)).toMatchObject({ purpose: 'experimental' })
    expect(parseMatrixConfig(legacy)).toMatchObject({ purpose: 'diagnostic' })
  })

  test.each([
    ['missing alpha', (input: ReturnType<typeof matrix>) => { input.cases.pop() }],
    ['renamed alpha', (input: ReturnType<typeof matrix>) => {
      input.cases[0].id = 'typert-0.1.2-alpha.2-renamed'
    }],
    ['promoted alpha', (input: ReturnType<typeof matrix>) => {
      input.cases[0].role = 'candidate'
    }],
  ])('rejects an exploratory inventory with a %s', (_label, mutate) => {
    const input = rawMatrix('matrix.official-experimental.json')
    mutate(input)

    expect(() => parseMatrixConfig(input)).toThrow(/official case inventory|experimental.*role/i)
  })

  test('requires the complete frozen legacy diagnostic inventory', () => {
    const input = rawMatrix('matrix.legacy-diagnostic.json')
    input.cases.shift()

    expect(() => parseMatrixConfig(input)).toThrow(/official case inventory.*diagnostic/i)
  })

  test('rejects role/purpose combinations that could promote exploratory evidence', () => {
    const input = matrix()
    input.decisionMode = 'exploratory'
    input.purpose = 'experimental'
    input.policy.requireAtLeastOneCandidatePass = false

    expect(() => parseMatrixConfig(input)).toThrow(/experimental.*role/)
  })
})
