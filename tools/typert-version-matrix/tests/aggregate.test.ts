import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import {
  aggregateMatrix,
  REQUIRED_PASS_ASSERTIONS,
  type AggregateMetadata,
} from '../src/aggregate.js'
import { REQUIRED_ARTIFACTS } from '../src/assertions/artifacts.js'
import { parseMatrixConfig } from '../src/config.js'
import { hashMatrixConfig } from '../src/provenance.js'
import type { CaseEvidence, MatrixConfig } from '../src/types.js'

let selection: MatrixConfig
let experimental: MatrixConfig

beforeAll(async () => {
  const config = async (name: string) => parseMatrixConfig(JSON.parse(await readFile(
    fileURLToPath(new URL(`../config/${name}`, import.meta.url)),
    'utf8',
  )))
  selection = await config('matrix.official.json')
  experimental = await config('matrix.official-experimental.json')
})

function evidence(config: MatrixConfig, statusById: Record<string, CaseEvidence['status']>): CaseEvidence[] {
  const provenance = {
    schemaVersion: '1' as const,
    configSha256: hashMatrixConfig(config),
    configFileSha256: 'c'.repeat(64),
    fixtureSha256: 'f'.repeat(64),
    runnerGit: { sourceGitCommit: 'a'.repeat(40), worktreeClean: true as const },
    runnerArtifacts: {
      sourceTreeSha256: '1'.repeat(64),
      distJsSha256: '2'.repeat(64),
      toolPackageLockSha256: '3'.repeat(64),
    },
    lockMode: 'resolve' as const,
    platformKey: null,
    runStartedAt: '2026-09-02T00:00:00.000Z',
    runCompletedAt: '2026-09-02T00:01:00.000Z',
    ci: null,
  }
  return config.cases.map((matrixCase) => {
    const status = statusById[matrixCase.id] ?? 'FAIL_COMPATIBILITY'
    return {
      schemaVersion: '1',
      case: matrixCase,
      fixtureSha256: 'f'.repeat(64),
      status,
      assertions: status === 'PASS'
        ? REQUIRED_PASS_ASSERTIONS.map((id) => ({
          id,
          status: 'PASS',
          expected: { assertion: id, outcome: 'required' },
          actualSummary: { assertion: id, outcome: 'observed' },
          evidenceRefs: [],
        }))
        : [{ id: 'B03', status: 'FAIL', expected: 'one result', actualSummary: 0, evidenceRefs: [] }],
      artifacts: status === 'PASS'
        ? REQUIRED_ARTIFACTS.map((path) => ({ path, size: 1, sha256: 'a'.repeat(64), createdAtMs: 1 }))
        : [],
      provenance,
    }
  })
}

function metadata(
  config: MatrixConfig,
  runId: string,
  overrides: Partial<AggregateMetadata> = {},
): AggregateMetadata {
  return {
    runId,
    platform: 'darwin',
    arch: 'arm64',
    node: config.runtime.node,
    npmCli: config.runtime.npmCli,
    ...overrides,
  }
}

describe('matrix aggregation', () => {
  test('defines the exact ordered 36-item PASS inventory including B07', () => {
    expect(REQUIRED_PASS_ASSERTIONS).toHaveLength(36)
    expect(REQUIRED_PASS_ASSERTIONS).toEqual([
      'A01', 'A02', 'A03', 'A04', 'A05', 'A06', 'A07', 'A08', 'A09',
      'B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07',
      'C01', 'C02', 'C03', 'C04', 'C05', 'C06', 'C07', 'C08', 'C09', 'C10',
      'D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09', 'D10',
    ])
  })

  test('returns 1 when control and all candidates fail conclusively', () => {
    const result = aggregateMatrix(selection, evidence(selection, {}), metadata(selection, 'run-1'))

    expect(result.exitCode).toBe(1)
    expect(result.eligibleCandidateIds).toEqual([])
    expect(result.decision).toBe('NO_ELIGIBLE_CANDIDATE')
  })

  test('returns 0 only when one candidate passes and every case is conclusive', () => {
    const candidate = selection.cases.find((entry) => entry.role === 'candidate')!
    const result = aggregateMatrix(
      selection,
      evidence(selection, { [candidate.id]: 'PASS' }),
      metadata(selection, 'run-2'),
    )

    expect(result.exitCode).toBe(0)
    expect(result.eligibleCandidateIds).toEqual([candidate.id])
    expect(result.decision).toBe('ELIGIBLE_FOR_NEXT_ISOLATED_MOUNT_PROBE')
    expect(result.humanDecisionRequired).toBe(true)
  })

  test('returns 2 when any case is inconclusive even if a candidate passes', () => {
    const candidates = selection.cases.filter((entry) => entry.role === 'candidate')
    const result = aggregateMatrix(
      selection,
      evidence(selection, {
        [candidates[0]!.id]: 'PASS',
        [candidates[1]!.id]: 'INCONCLUSIVE_REGISTRY',
      }),
      metadata(selection, 'run-3'),
    )

    expect(result.exitCode).toBe(2)
    expect(result.eligibleCandidateIds).toEqual([])
    expect(result.decision).toBe('INCONCLUSIVE')
  })

  test('refuses a PASS synthesized from ordinary build success or missing A-D assertions', () => {
    const cases = evidence(selection, {})
    cases[0] = {
      ...cases[0]!,
      status: 'PASS',
      assertions: [{ id: 'B07', status: 'PASS', expected: 0, actualSummary: 0, evidenceRefs: [] }],
    }

    expect(() => aggregateMatrix(selection, cases, metadata(selection, 'run-4')))
      .toThrow(/PASS.*assertions/)
  })

  test.each([
    ['duplicate', (assertions: CaseEvidence['assertions']) => [assertions[0]!, ...assertions]],
    ['extra', (assertions: CaseEvidence['assertions']) => [
      ...assertions,
      { id: 'E01', status: 'PASS' as const, expected: {}, actualSummary: {}, evidenceRefs: [] },
    ]],
    ['out of order', (assertions: CaseEvidence['assertions']) => [assertions[1]!, assertions[0]!, ...assertions.slice(2)]],
    ['non-PASS', (assertions: CaseEvidence['assertions']) => assertions.map((entry, index) => (
      index === 4 ? { ...entry, status: 'FAIL' as const } : entry
    ))],
    ['boolean placeholder', (assertions: CaseEvidence['assertions']) => assertions.map((entry, index) => (
      index === 4 ? { ...entry, expected: true, actualSummary: true } : entry
    ))],
  ])('rejects a PASS with a %s assertion inventory', (_label, mutate) => {
    const entries = evidence(selection, {})
    const candidate = selection.cases.find(({ role }) => role === 'candidate')!
    const index = entries.findIndex(({ case: item }) => item.id === candidate.id)
    const passing = evidence(selection, { [candidate.id]: 'PASS' })[index]!
    entries[index] = { ...passing, assertions: mutate(passing.assertions) }

    expect(() => aggregateMatrix(selection, entries, metadata(selection, 'bad-pass-inventory')))
      .toThrow(/PASS.*assertions/i)
  })

  test('never promotes exploratory or legacy evidence to an eligible candidate', () => {
    const cases = evidence(experimental, Object.fromEntries(
      experimental.cases.map(({ id }) => [id, 'PASS']),
    ))
    const result = aggregateMatrix(experimental, cases, metadata(experimental, 'run-5'))

    expect(result.exitCode).toBe(1)
    expect(result.eligibleCandidateIds).toEqual([])
    expect(result.decision).toBe('EXPLORATORY_ONLY')
  })

  test('records the shared fixture, config, and clean runner Git provenance in the matrix report', () => {
    const result = aggregateMatrix(selection, evidence(selection, {}), metadata(selection, 'run-6'))

    expect(result.environment.provenance).toEqual({
      schemaVersion: '1',
      configSha256: hashMatrixConfig(selection),
      configFileSha256: 'c'.repeat(64),
      fixtureSha256: 'f'.repeat(64),
      runnerGit: { sourceGitCommit: 'a'.repeat(40), worktreeClean: true },
      runnerArtifacts: {
        sourceTreeSha256: '1'.repeat(64),
        distJsSha256: '2'.repeat(64),
        toolPackageLockSha256: '3'.repeat(64),
      },
      lockMode: 'resolve',
      platformKey: null,
      runStartedAt: '2026-09-02T00:00:00.000Z',
      runCompletedAt: '2026-09-02T00:01:00.000Z',
      ci: null,
    })
  })

  test.each([
    ['fixture SHA', (cases: CaseEvidence[]) => {
      cases[1] = {
        ...cases[1]!,
        provenance: { ...cases[1]!.provenance!, fixtureSha256: 'e'.repeat(64) },
      }
    }],
    ['runner commit', (cases: CaseEvidence[]) => {
      cases[1] = {
        ...cases[1]!,
        provenance: {
          ...cases[1]!.provenance!,
          runnerGit: { sourceGitCommit: 'b'.repeat(40), worktreeClean: true },
        },
      }
    }],
  ])('rejects cross-case provenance mismatch for %s', (_label, mutate) => {
    const cases = evidence(selection, {})
    mutate(cases)

    expect(() => aggregateMatrix(selection, cases, metadata(selection, 'run-7')))
      .toThrow(/(?:provenance.*differs|differs.*provenance)/i)
  })

  test('rejects missing, dirty, or non-canonical config provenance', () => {
    const missing = evidence(selection, {})
    delete (missing[0] as { provenance?: unknown }).provenance
    const dirty = evidence(selection, {})
    dirty[0] = {
      ...dirty[0]!,
      provenance: {
        ...dirty[0]!.provenance!,
        runnerGit: { sourceGitCommit: 'a'.repeat(40), worktreeClean: false },
      } as never,
    }
    const wrongConfig = evidence(selection, {}).map((entry) => ({
      ...entry,
      provenance: { ...entry.provenance!, configSha256: '0'.repeat(64) },
    }))

    expect(() => aggregateMatrix(selection, missing, metadata(selection, 'run-8')))
      .toThrow(/provenance/i)
    expect(() => aggregateMatrix(selection, dirty, metadata(selection, 'run-9')))
      .toThrow(/clean/i)
    expect(() => aggregateMatrix(selection, wrongConfig, metadata(selection, 'run-10')))
      .toThrow(/config.*SHA/i)
  })

  test('binds a frozen lock platform key to the reported runtime platform', () => {
    const frozen = evidence(selection, {}).map((entry) => ({
      ...entry,
      provenance: {
        ...entry.provenance!,
        lockMode: 'frozen' as const,
        platformKey: 'darwin-arm64-node24-npm11',
      },
    }))

    expect(() => aggregateMatrix(selection, frozen, metadata(selection, 'run-11', {
      platform: 'linux',
      arch: 'x64',
    }))).toThrow(/platformKey.*linux-x64-node24-npm11/i)
    expect(() => aggregateMatrix(selection, frozen, metadata(selection, 'run-12', {
      platform: 'darwin',
      arch: 'arm64',
    }))).not.toThrow()
  })

  test.each(['unknown', 'default', 'fake_arch'])(
    'rejects unsupported runtime architecture %s before aggregation',
    (arch) => {
      expect(() => aggregateMatrix(
        selection,
        evidence(selection, {}),
        metadata(selection, 'unsupported-arch', { arch }),
      )).toThrow(/architecture/i)
    },
  )
})
