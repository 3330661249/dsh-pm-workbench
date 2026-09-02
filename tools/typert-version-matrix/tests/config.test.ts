import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { parseMatrixConfig } from '../src/config.js'

const dshPackages = (version: string, cordis = '4.0.1') => ({
  '@deepseek-ai/dsh-typert-generator': version,
  '@deepseek-ai/dsh-typert-protocol': version,
  '@deepseek-ai/dsh-invariants': version,
  '@deepseek-ai/cordis': cordis,
})

const matrix = () => ({
  schemaVersion: '1',
  decisionMode: 'selection',
  purpose: 'selection',
  runtime: { node: '24.14.0', npmCli: '11.9.0' },
  toolchain: { typescript: '6.0.3', tsdown: '0.22.2', zod: '4.4.3' },
  registry: 'https://registry.npmjs.org/',
  generatorAdapter: 'workspace-v1',
  fixture: 'strict-remote-v1',
  policy: {
    requireAllCasesConclusive: true,
    requireAtLeastOneCandidatePass: true,
  },
  cases: [
    {
      id: 'typert-0.1.0-rc.6-control',
      role: 'control',
      release: { '@deepseek-ai/dsh': '0.1.0-rc.6' },
      packages: dshPackages('0.1.0-rc.6'),
    },
    {
      id: 'typert-0.1.1-rc.2',
      role: 'candidate',
      release: { '@deepseek-ai/dsh': '0.1.1-rc.2' },
      packages: dshPackages('0.1.1-rc.2'),
    },
  ],
})

describe('parseMatrixConfig', () => {
  test.each([
    ['matrix.official.json', 'selection', 5],
    ['matrix.official-experimental.json', 'experimental', 3],
    ['matrix.legacy-diagnostic.json', 'diagnostic', 3],
  ] as const)('validates the shipped %s cohort inventory', async (file, purpose, count) => {
    const configPath = fileURLToPath(new URL(`../config/${file}`, import.meta.url))
    const parsed = parseMatrixConfig(JSON.parse(await readFile(configPath, 'utf8')))

    expect(parsed.purpose).toBe(purpose)
    expect(parsed.cases).toHaveLength(count)
  })

  test('accepts the closed official selection shape', () => {
    expect(parseMatrixConfig(matrix())).toMatchObject({
      schemaVersion: '1',
      decisionMode: 'selection',
      purpose: 'selection',
      cases: [{ role: 'control' }, { role: 'candidate' }],
    })
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
    noControl.cases = noControl.cases.filter((entry) => entry.role !== 'control')
    const noCandidate = matrix()
    noCandidate.cases = noCandidate.cases.filter((entry) => entry.role !== 'candidate')

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

  test('supports isolated exploratory and legacy diagnostics without making them candidates', () => {
    const experimental = {
      ...matrix(),
      decisionMode: 'exploratory',
      purpose: 'experimental',
      policy: { requireAllCasesConclusive: true, requireAtLeastOneCandidatePass: false },
      cases: [{
        id: 'typert-0.1.2-alpha.4',
        role: 'experimental',
        release: { '@deepseek-ai/dsh': '0.1.2-alpha.4' },
        packages: dshPackages('0.1.2-alpha.4', '4.0.2'),
      }],
    }
    const legacy = {
      ...matrix(),
      decisionMode: 'exploratory',
      purpose: 'diagnostic',
      policy: { requireAllCasesConclusive: true, requireAtLeastOneCandidatePass: false },
      cases: [{
        id: 'typert-0.1.0-rc.3-legacy',
        role: 'diagnostic',
        release: { '@deepseek-ai/dsh': '0.1.0-rc.3' },
        packages: dshPackages('0.1.0-rc.3'),
      }],
    }

    expect(parseMatrixConfig(experimental)).toMatchObject({ purpose: 'experimental' })
    expect(parseMatrixConfig(legacy)).toMatchObject({ purpose: 'diagnostic' })
  })

  test('rejects role/purpose combinations that could promote exploratory evidence', () => {
    const input = matrix()
    input.decisionMode = 'exploratory'
    input.purpose = 'experimental'
    input.policy.requireAtLeastOneCandidatePass = false

    expect(() => parseMatrixConfig(input)).toThrow(/experimental.*role/)
  })
})
