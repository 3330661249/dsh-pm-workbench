import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { aggregateMatrix, REQUIRED_PASS_ASSERTIONS } from '../src/aggregate.js'
import { REQUIRED_ARTIFACTS } from '../src/assertions/artifacts.js'
import { parseMatrixConfig } from '../src/config.js'
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
  return config.cases.map((matrixCase) => {
    const status = statusById[matrixCase.id] ?? 'FAIL_COMPATIBILITY'
    return {
      schemaVersion: '1',
      case: matrixCase,
      status,
      assertions: status === 'PASS'
        ? REQUIRED_PASS_ASSERTIONS.map((id) => ({ id, status: 'PASS', expected: true, actualSummary: true, evidenceRefs: [] }))
        : [{ id: 'B03', status: 'FAIL', expected: 'one result', actualSummary: 0, evidenceRefs: [] }],
      artifacts: status === 'PASS'
        ? REQUIRED_ARTIFACTS.map((path) => ({ path, size: 1, sha256: 'a'.repeat(64), createdAtMs: 1 }))
        : [],
    }
  })
}

describe('matrix aggregation', () => {
  test('returns 1 when control and all candidates fail conclusively', () => {
    const result = aggregateMatrix(selection, evidence(selection, {}), { runId: 'run-1' })

    expect(result.exitCode).toBe(1)
    expect(result.eligibleCandidateIds).toEqual([])
    expect(result.decision).toBe('NO_ELIGIBLE_CANDIDATE')
  })

  test('returns 0 only when one candidate passes and every case is conclusive', () => {
    const candidate = selection.cases.find((entry) => entry.role === 'candidate')!
    const result = aggregateMatrix(
      selection,
      evidence(selection, { [candidate.id]: 'PASS' }),
      { runId: 'run-2' },
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
      { runId: 'run-3' },
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

    expect(() => aggregateMatrix(selection, cases, { runId: 'run-4' }))
      .toThrow(/PASS.*assertions/)
  })

  test('never promotes exploratory or legacy evidence to an eligible candidate', () => {
    const cases = evidence(experimental, Object.fromEntries(
      experimental.cases.map(({ id }) => [id, 'PASS']),
    ))
    const result = aggregateMatrix(experimental, cases, { runId: 'run-5' })

    expect(result.exitCode).toBe(1)
    expect(result.eligibleCandidateIds).toEqual([])
    expect(result.decision).toBe('EXPLORATORY_ONLY')
  })
})
