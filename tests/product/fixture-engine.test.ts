import { describe, expect, it } from 'vitest'

import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { FixtureInsightEngine } from '../../packages/workbench/src/analysis/fixture-engine.js'
import {
  BUILT_IN_SYNTHETIC_HASH,
  BUILT_IN_SYNTHETIC_TEXT,
  FIXTURE_MANIFEST,
} from '../../packages/workbench/src/analysis/fixture-manifest.js'
import type { AnalysisInput, FixtureManifest } from '../../packages/workbench/src/analysis/types.js'
import {
  validateAnalysisCandidate,
} from '../../packages/workbench/src/domain/evidence.js'
import {
  analysisRevisionIdSchema,
  projectIdSchema,
  sourceRevisionIdSchema,
} from '../../packages/workbench/src/domain/ids.js'
import {
  analysisCandidateSchema,
  type AnalysisCandidate,
  type SourceRevision,
} from '../../packages/workbench/src/domain/model.js'

const PROJECT_ID = projectIdSchema.parse('00000000-0000-4000-8000-000000000301')
const OTHER_PROJECT_ID = projectIdSchema.parse('00000000-0000-4000-8000-000000000302')
const SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000301')
const OTHER_SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000302')
const ANALYSIS_ID = analysisRevisionIdSchema.parse('20000000-0000-4000-8000-000000000301')

function source(text = BUILT_IN_SYNTHETIC_TEXT): SourceRevision {
  return {
    id: SOURCE_ID,
    projectId: PROJECT_ID,
    revision: 1,
    displayName: '内置合成访谈.md',
    format: 'text/markdown',
    text,
    utf8Bytes: new TextEncoder().encode(text).byteLength,
    contentHash: nodeSha256Utf8(text),
    syntheticDataAttested: true,
  }
}

function input(text = BUILT_IN_SYNTHETIC_TEXT): AnalysisInput {
  return {
    projectId: PROJECT_ID,
    source: source(text),
    analysisRevisionId: ANALYSIS_ID,
    generation: 1,
    baseProjectVersion: 2,
  }
}

function cloneCandidate(): AnalysisCandidate {
  return structuredClone(FIXTURE_MANIFEST.sources[BUILT_IN_SYNTHETIC_HASH]!.candidate)
}

function fixture(candidate: AnalysisCandidate): FixtureManifest {
  return { schemaVersion: 1, sources: { [BUILT_IN_SYNTHETIC_HASH]: { candidate } } }
}

function indexedEvidenceId(index: number) {
  return `30000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}` as AnalysisCandidate['evidence'][number]['id']
}

function rebind(candidate: AnalysisCandidate, analysisInput = input()): AnalysisCandidate {
  return {
    analysis: {
      ...candidate.analysis,
      id: analysisInput.analysisRevisionId,
      sourceRevisionId: analysisInput.source.id,
      generation: analysisInput.generation,
      baseProjectVersion: analysisInput.baseProjectVersion,
    },
    evidence: candidate.evidence.map(item => ({ ...item, sourceRevisionId: analysisInput.source.id })),
    generatedRequirements: candidate.generatedRequirements.map(item => ({
      ...item,
      analysisRevisionId: analysisInput.analysisRevisionId,
      sourceRevisionId: analysisInput.source.id,
    })),
  }
}

function compileOnlyAnalysisCandidateReadonlyGuards(): void {
  const parsed = analysisCandidateSchema.parse(cloneCandidate())
  // @ts-expect-error Parsed candidates expose readonly properties.
  parsed.analysis.status = 'superseded'
  // @ts-expect-error Parsed candidate collections do not expose mutating methods.
  parsed.evidence.splice(0)
  // @ts-expect-error Nested generated requirement collections remain readonly.
  parsed.generatedRequirements[0]?.assumptions.push('changed')
}

void compileOnlyAnalysisCandidateReadonlyGuards

describe('built-in fixture manifest', () => {
  it('freezes one exact neutral synthetic Chinese source hash and hand-checked locators', () => {
    expect(BUILT_IN_SYNTHETIC_HASH).toBe('aadb7945ca89bfefcf8678f194c43ba84c93bdef602c3a91cd9901b097e7b67c')
    expect(nodeSha256Utf8(BUILT_IN_SYNTHETIC_TEXT)).toBe(BUILT_IN_SYNTHETIC_HASH)
    expect(Object.keys(FIXTURE_MANIFEST.sources)).toEqual([BUILT_IN_SYNTHETIC_HASH])
    const candidate = FIXTURE_MANIFEST.sources[BUILT_IN_SYNTHETIC_HASH]!.candidate
    expect(candidate.evidence.map(({ role, start, end, quote }) => ({ role, start, end, quote }))).toEqual([
      { role: 'support', start: 26, end: 45, quote: '我经常找不到原话，整理一次要来回搜索。' },
      { role: 'support', start: 50, end: 72, quote: '我经常找不到原话，尤其是相似表述很多的时候。' },
      { role: 'counterexample', start: 77, end: 105, quote: '不过短访谈只有一两段时，我直接阅读更快，不需要额外工具。' },
      { role: 'context', start: 131, end: 155, quote: '我担心草稿把推测写成事实，也担心看不到对应原文。' },
    ])
  })

  it('returns a fully rebound, deeply immutable candidate and never calls a model', async () => {
    const candidate = await new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8)
      .analyse(input(), new AbortController().signal)
    expect(candidate.analysis).toMatchObject({
      id: ANALYSIS_ID,
      sourceRevisionId: SOURCE_ID,
      kind: 'fixture',
      generation: 1,
      baseProjectVersion: 2,
      status: 'draft',
    })
    expect(candidate.generatedRequirements.every(item => item.producer === 'fixture')).toBe(true)
    expect(Object.isFrozen(candidate)).toBe(true)
    expect(Object.isFrozen(candidate.evidence)).toBe(true)
    expect(Object.isFrozen(candidate.generatedRequirements[0]?.assumptions)).toBe(true)
    expect(() => ((candidate.generatedRequirements as unknown as unknown[]).push({}))).toThrow()
  })

  it('never analyses an unlisted source hash', async () => {
    const engine = new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8)
    await expect(engine.analyse(input('stranger synthetic text'), new AbortController().signal))
      .rejects.toMatchObject({ code: 'fixture-not-allowed' })
  })

  it('rejects a manifest candidate with one tampered citation atomically', async () => {
    const original = cloneCandidate()
    const candidate = {
      ...original,
      evidence: original.evidence.map((item, index) => index === 0 ? { ...item, quote: '被篡改' } : item),
    }
    await expect(new FixtureInsightEngine(fixture(candidate), nodeSha256Utf8)
      .analyse(input(), new AbortController().signal)).rejects.toThrowError('invalid-evidence')
  })

  it('aborts before manifest work and after candidate validation without returning a partial candidate', async () => {
    const before = new AbortController()
    before.abort()
    let beforeHashCalls = 0
    const beforeEngine = new FixtureInsightEngine(FIXTURE_MANIFEST, (value) => {
      beforeHashCalls += 1
      return nodeSha256Utf8(value)
    })
    await expect(beforeEngine.analyse(input(), before.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(beforeHashCalls).toBe(0)

    const after = new AbortController()
    let afterHashCalls = 0
    const afterEngine = new FixtureInsightEngine(FIXTURE_MANIFEST, (value) => {
      afterHashCalls += 1
      const result = nodeSha256Utf8(value)
      after.abort()
      return result
    })
    await expect(afterEngine.analyse(input(), after.signal)).rejects.toMatchObject({ name: 'AbortError' })
    expect(afterHashCalls).toBeGreaterThan(0)
  })
})

describe('analysis candidate validation', () => {
  it('rejects wrong project and source identity links', () => {
    const candidate = rebind(cloneCandidate())
    expect(() => validateAnalysisCandidate({ ...input(), projectId: OTHER_PROJECT_ID }, candidate, nodeSha256Utf8))
      .toThrowError('invalid-analysis-candidate')
    expect(() => validateAnalysisCandidate(input(), {
      ...candidate,
      analysis: { ...candidate.analysis, sourceRevisionId: OTHER_SOURCE_ID },
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
    expect(() => validateAnalysisCandidate(input(), {
      ...candidate,
      generatedRequirements: candidate.generatedRequirements.map((item, index) => index === 0
        ? { ...item, analysisRevisionId: analysisRevisionIdSchema.parse('20000000-0000-4000-8000-000000000302') }
        : item),
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
  })

  it('rejects duplicate evidence identities and duplicate or missing requirement evidence links', () => {
    const candidate = rebind(cloneCandidate())
    expect(() => validateAnalysisCandidate(input(), {
      ...candidate,
      evidence: [...candidate.evidence, { ...candidate.evidence[0]! }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
    expect(() => validateAnalysisCandidate(input(), {
      ...candidate,
      generatedRequirements: [{
        ...candidate.generatedRequirements[0]!,
        evidenceIds: [candidate.evidence[0]!.id, candidate.evidence[0]!.id],
      }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
    expect(() => validateAnalysisCandidate(input(), {
      ...candidate,
      generatedRequirements: [{
        ...candidate.generatedRequirements[0]!,
        evidenceIds: [indexedEvidenceId(999)],
      }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
  })

  it('rejects duplicate draft and requirement identities', () => {
    const candidate = rebind(cloneCandidate())
    const requirement = candidate.generatedRequirements[0]!
    expect(() => validateAnalysisCandidate(input(), {
      ...candidate,
      generatedRequirements: [requirement, { ...requirement }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
    expect(() => validateAnalysisCandidate(input(), {
      ...candidate,
      generatedRequirements: [
        requirement,
        {
          ...requirement,
          id: '50000000-0000-4000-8000-000000000399' as typeof requirement.id,
        },
      ],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
  })

  it('accepts exactly 24 requirements and 96 evidence, then rejects one more', () => {
    const seed = rebind(cloneCandidate())
    const baseEvidence = seed.evidence[0]!
    const evidence = Array.from({ length: 96 }, (_, index) => ({
      ...baseEvidence,
      id: indexedEvidenceId(index + 1),
    }))
    const baseRequirement = seed.generatedRequirements[0]!
    const requirements = Array.from({ length: 24 }, (_, index) => ({
      ...baseRequirement,
      id: `50000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}` as typeof baseRequirement.id,
      requirementId: `40000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}` as typeof baseRequirement.requirementId,
      evidenceIds: [evidence[index]!.id],
    }))
    const exact = { ...seed, evidence, generatedRequirements: requirements }
    expect(validateAnalysisCandidate(input(), exact, nodeSha256Utf8)).toBe(exact)
    expect(() => validateAnalysisCandidate(input(), {
      ...exact,
      generatedRequirements: [...requirements, { ...requirements[0]!, id: '50000000-0000-4000-8000-000000000999' as typeof baseRequirement.id }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
    expect(() => validateAnalysisCandidate(input(), {
      ...exact,
      evidence: [...evidence, { ...evidence[0]!, id: indexedEvidenceId(999) }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
  })

  it('enforces the 131072-byte evidence aggregate exactly', () => {
    const sourceText = '😀'.repeat(4_000)
    const aggregateSource = source(sourceText)
    const aggregateInput = { ...input(sourceText), source: aggregateSource }
    const seed = rebind(cloneCandidate(), aggregateInput)
    const fullQuote = sourceText
    const tailQuote = '😀'.repeat(768)
    const evidence = [
      ...Array.from({ length: 8 }, (_, index) => ({
        ...seed.evidence[0]!, id: indexedEvidenceId(index + 1), start: 0, end: fullQuote.length,
        quote: fullQuote, quoteHash: nodeSha256Utf8(fullQuote),
      })),
      { ...seed.evidence[0]!, id: indexedEvidenceId(9), start: 0, end: tailQuote.length,
        quote: tailQuote, quoteHash: nodeSha256Utf8(tailQuote) },
    ]
    const requirement = { ...seed.generatedRequirements[0]!, evidenceIds: [evidence[0]!.id] }
    const exact = { ...seed, evidence, generatedRequirements: [requirement] }
    expect(evidence.reduce((sum, item) => sum + new TextEncoder().encode(item.quote).byteLength, 0)).toBe(131_072)
    expect(validateAnalysisCandidate(aggregateInput, exact, nodeSha256Utf8)).toBe(exact)
    expect(() => validateAnalysisCandidate(aggregateInput, {
      ...exact,
      evidence: [...evidence, { ...evidence[8]!, id: indexedEvidenceId(10), end: 2, quote: '😀', quoteHash: nodeSha256Utf8('😀') }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
  })

  it('enforces assumption and unknown count, item, per-category, and analysis aggregate limits', () => {
    const seed = rebind(cloneCandidate())
    const requirement = seed.generatedRequirements[0]!
    const exactItems = Array.from({ length: 20 }, (_, index) => `${index}`.padEnd(409, 'é'))
    expect(exactItems.reduce((sum, item) => sum + new TextEncoder().encode(item).byteLength, 0)).toBe(16_330)
    expect(() => validateAnalysisCandidate(input(), {
      ...seed,
      generatedRequirements: [{ ...requirement, assumptions: exactItems }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')

    const exactCategory = [
      `A${'😀'.repeat(499)}`,
      `B${'😀'.repeat(499)}`,
      `C${'😀'.repeat(499)}`,
      `D${'😀'.repeat(499)}`,
      '😀'.repeat(51),
    ]
    const exact = {
      ...seed,
      generatedRequirements: [{ ...requirement, assumptions: exactCategory, unknowns: exactCategory }],
    }
    expect(validateAnalysisCandidate(input(), exact, nodeSha256Utf8)).toBe(exact)
    expect(() => validateAnalysisCandidate(input(), {
      ...seed,
      generatedRequirements: [{ ...requirement, assumptions: [...exactCategory, 'x'] }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
    expect(() => validateAnalysisCandidate(input(), {
      ...seed,
      generatedRequirements: [{ ...requirement, assumptions: Array.from({ length: 21 }, (_, index) => `假设${index}`) }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
    expect(() => validateAnalysisCandidate(input(), {
      ...seed,
      generatedRequirements: [{ ...requirement, unknowns: ['😀'.repeat(501)] }],
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')

    const aggregateRequirements = Array.from({ length: 5 }, (_, index) => ({
      ...requirement,
      id: `50000000-0000-4000-8000-${(index + 50).toString(16).padStart(12, '0')}` as typeof requirement.id,
      requirementId: `40000000-0000-4000-8000-${(index + 50).toString(16).padStart(12, '0')}` as typeof requirement.requirementId,
      assumptions: exactCategory,
      unknowns: exactCategory,
    }))
    expect(validateAnalysisCandidate(input(), {
      ...seed,
      generatedRequirements: aggregateRequirements.slice(0, 4),
    }, nodeSha256Utf8).generatedRequirements).toHaveLength(4)
    expect(() => validateAnalysisCandidate(input(), {
      ...seed,
      generatedRequirements: aggregateRequirements,
    }, nodeSha256Utf8)).toThrowError('invalid-analysis-candidate')
  })
})
