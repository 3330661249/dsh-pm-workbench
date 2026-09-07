import { describe, expect, it, vi } from 'vitest'
import { ProjectService } from '../../packages/workbench/src/application/project-service.js'
import { TableProjectRepository } from '../../packages/workbench/src/application/project-repository.js'
import { hashProjectCommandRequest } from '../../packages/workbench/src/application/receipts.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { FixtureInsightEngine } from '../../packages/workbench/src/analysis/fixture-engine.js'
import { BUILT_IN_SYNTHETIC_TEXT, FIXTURE_MANIFEST } from '../../packages/workbench/src/analysis/fixture-manifest.js'
import type { InsightEngine } from '../../packages/workbench/src/analysis/types.js'
import { DeterministicPrdRenderer, type PrdRenderer } from '../../packages/workbench/src/domain/prd.js'
import type { ActiveProjectRecord, StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import { type ProjectId, baselineIdSchema, sourceRevisionIdSchema, requirementIdSchema } from '../../packages/workbench/src/domain/ids.js'
import { parseProductInput, parseProductOutcome, type StrictProjectCommandPayload, type ProjectCommandOutcome } from '../../packages/workbench/src/protocol/product.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import { makeSmallActiveRecord, SMALL_PROJECT_ID, OTHER_PROJECT_ID } from './helpers/synthetic-records.js'

const uuid = (n: number) => `10000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
const at = '2026-09-07T08:00:00.000Z'
function setup(options: { engine?: InsightEngine; renderer?: PrdRenderer; record?: ActiveProjectRecord } = {}) {
  const table = createFakeDomainTable<ProjectId, StoredProjectRecord>([[SMALL_PROJECT_ID, options.record ?? makeSmallActiveRecord()]])
  const engine = options.engine ?? new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8)
  let id = 1000
  const clock = { now: vi.fn(() => at) }
  const newId = vi.fn(() => uuid(id++))
  const service = new ProjectService(new TableProjectRepository(table, { engine, clock, newId,
    sha256Utf8: nodeSha256Utf8, ...(options.renderer ? { renderer: options.renderer } : {}) }))
  const record = () => table.get(SMALL_PROJECT_ID) as ActiveProjectRecord
  let commandId = options.record ? 5000 : 1
  const input = (payload: StrictProjectCommandPayload, expectedVersion = record().header.projectVersion) =>
    parseProductInput('projects.command', { apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID,
      commandId: uuid(commandId++), expectedVersion, payload })
  const run = (payload: StrictProjectCommandPayload, expectedVersion?: number) => service.command(input(payload, expectedVersion))
  const importSource = () => run({ kind: 'source.importText', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt', format: 'pasted', syntheticDataAttested: true })
  const analyse = () => run({ kind: 'analysis.runFixture', sourceRevisionId: record().source!.id })
  const ready = async () => { await importSource(); await analyse() }
  return { table, service, record, input, run, importSource, analyse, ready, engine, clock, newId }
}

describe('Stage 3A project command service', () => {
  it('imports one exact source atomically and exposes empty project/source/PRD behavior', async () => {
    const { service, table, record, importSource } = setup()
    expect(await service.get({ apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID })).toMatchObject({ status: 'accepted', value: { source: null, analysis: null, generatedRequirements: [] } })
    expect(await service.get({ apiVersion: 'pmwb-product-v1', projectId: OTHER_PROJECT_ID })).toEqual({ status: 'rejected', error: { code: 'not-found' } })
    expect(await service.getSource({ apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID, sourceRevisionId: uuid(99) })).toMatchObject({ status: 'rejected', error: { code: 'not-found' } })
    expect(await service.getMarkdown({ apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID, prdRevisionId: uuid(99) })).toMatchObject({ status: 'rejected', error: { code: 'not-found' } })
    expect(await importSource()).toMatchObject({ status: 'accepted', value: { projectVersion: 2, contentVersion: 1 } })
    expect(table.writeCount).toBe(1)
    expect(record().source).toMatchObject({ text: BUILT_IN_SYNTHETIC_TEXT, contentHash: 'aadb7945ca89bfefcf8678f194c43ba84c93bdef602c3a91cd9901b097e7b67c', syntheticDataAttested: true })
    expect(await importSource()).toMatchObject({ status: 'rejected', error: { code: 'source-locked' } })
    expect(record().header).toMatchObject({ projectVersion: 2, contentVersion: 1 })
  })

  it('supersedes only an unreviewed Fixture revision and commits each complete candidate in one write', async () => {
    const { ready, analyse, record, table } = setup()
    await ready()
    const oldId = record().currentAnalysisRevisionId
    expect(record()).toMatchObject({ header: { projectVersion: 3, contentVersion: 2, reviewStarted: false },
      analyses: [{ status: 'draft', generation: 1, baseProjectVersion: 2 }], humanDecisions: [{ decision: 'pending' }] })
    expect(table.writeCount).toBe(2)
    expect((await analyse()).status).toBe('accepted')
    expect(record().analyses).toMatchObject([{ id: oldId, status: 'superseded' }, { status: 'draft', generation: 2, baseProjectVersion: 3 }])
    expect(record().generatedRequirements).toHaveLength(1)
    expect(record().evidence).toHaveLength(4)
    expect(table.writeCount).toBe(3)
  })

  it.each(['title', 'painPoint', 'description', 'priority', 'decision', 'humanReason', 'selectedText', 'reorder'] as const)
  ('locks later analysis after review action %s and uses independent human text revisions', async field => {
    const { ready, run, analyse, record } = setup()
    await ready()
    const draft = record().generatedRequirements[0]!
    const before = JSON.stringify(draft)
    const payload: StrictProjectCommandPayload = field === 'reorder'
      ? { kind: 'requirements.reorder', requirementIds: [draft.requirementId] }
      : { kind: 'requirement.update', requirementId: draft.requirementId,
        ...(field === 'selectedText' ? { selectedText: { kind: 'generated' as const, draftId: draft.id } }
          : field === 'decision' ? { decision: 'include' as const }
            : field === 'priority' ? { priority: 'low' as const } : { [field]: '人工修订内容' }) }
    expect(await run(payload)).toMatchObject({ status: 'accepted', value: { projectVersion: 4, contentVersion: 3 } })
    expect(record().header.reviewStarted).toBe(true)
    expect(JSON.stringify(record().generatedRequirements[0])).toBe(before)
    expect(record().humanRevisions).toHaveLength(['title', 'painPoint', 'description'].includes(field) ? 1 : 0)
    expect(await analyse()).toMatchObject({ status: 'rejected', error: { code: 'analysis-already-reviewed' } })
    expect(record().header).toMatchObject({ projectVersion: 4, contentVersion: 3, updatedAt: at })
  })

  it('rejects a malformed generation atomically without publishing any candidate fields', async () => {
    const underlying = new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8)
    const engine: InsightEngine = { analyse: async (input, signal) => {
      const candidate = await underlying.analyse(input, signal)
      return { ...candidate, analysis: { ...candidate.analysis, generation: input.generation + 1 } }
    } }
    const { importSource, analyse, record } = setup({ engine })
    await importSource()
    expect(await analyse()).toMatchObject({ status: 'rejected', error: { code: 'invalid-evidence' } })
    expect(record()).toMatchObject({ header: { projectVersion: 2, contentVersion: 1 }, analyses: [], evidence: [], generatedRequirements: [] })
  })

  it('writes nothing when cancellation arrives during candidate preparation', async () => {
    const controller = new AbortController()
    const real = new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8)
    const engine: InsightEngine = { analyse: async (input, signal) => {
      const result = await real.analyse(input, signal)
      controller.abort()
      return result
    } }
    const { service, importSource, input, record, table } = setup({ engine })
    await importSource()
    const before = JSON.stringify(record())
    const result = await service.command(input({ kind: 'analysis.runFixture', sourceRevisionId: record().source!.id }), controller.signal)
    expect(result).toMatchObject({ status: 'rejected', error: { code: 'cancelled' } })
    expect(table.writeCount).toBe(1)
    expect(JSON.stringify(record())).toBe(before)
  })

  it('rejects the reserved model command with a durable receipt before any engine invocation', async () => {
    const engine: InsightEngine = { analyse: vi.fn(() => Promise.reject(new Error('must never run'))) }
    const { service, importSource, input, record, table } = setup({ engine })
    await importSource()
    const request = input({ kind: 'analysis.runHarnessModel', sourceRevisionId: record().source!.id })
    const outcome = await service.command(request)
    expect(outcome).toEqual({ status: 'rejected', projectId: SMALL_PROJECT_ID, commandId: request.commandId, error: { code: 'stage-unavailable' } })
    expect(engine.analyse).not.toHaveBeenCalled()
    expect(record().commandReceipts.at(-1)?.outcome).toEqual({ ok: false, code: 'stage-unavailable' })
    expect(await service.command(request)).toEqual(outcome)
    expect(table.writeCount).toBe(2)
  })

  it('publishes the exact confirmation version then renders from that baseline without advancing contentVersion', async () => {
    const { service, ready, run, record } = setup()
    await ready()
    await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, decision: 'include', humanReason: '本期采用' })
    const confirmed = record().header
    expect(confirmed).toMatchObject({ projectVersion: 4, contentVersion: 3 })
    const published = await run({ kind: 'baseline.publish', confirmedContentVersion: 3 }, 4)
    expect(published).toMatchObject({ status: 'accepted', value: { projectVersion: 5, contentVersion: 3 } })
    expect(record().baselines[0]).toMatchObject({ projectVersion: 4, contentVersion: 3, items: [{ humanReason: '本期采用' }] })
    const baselineId = record().currentBaselineId!
    expect(await run({ kind: 'prd.render', baselineId, confirmedContentVersion: 3 }, 5)).toMatchObject({ status: 'accepted', value: { projectVersion: 6, contentVersion: 3, baselineId } })
    const saved = record().prdRevisions[0]!
    expect(saved.markdown).toContain(`baselineId=${baselineId}`)
    expect(saved.contentHash).toBe(nodeSha256Utf8(saved.markdown))
    expect(await service.getMarkdown({ apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID, prdRevisionId: saved.id })).toMatchObject({ status: 'accepted', value: { markdown: saved.markdown, contentHash: saved.contentHash } })
    const bytes = JSON.stringify(record().prdRevisions)
    await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, priority: 'low' })
    expect(await run({ kind: 'prd.render', baselineId, confirmedContentVersion: 3 })).toMatchObject({ status: 'rejected', error: { code: 'baseline-stale' } })
    expect(JSON.stringify(record().prdRevisions)).toBe(bytes)
    expect(await service.get({ apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID })).toMatchObject({ status: 'accepted', value: { prdSummaries: [{ status: 'stale' }] } })
  })

  it('rejects intervening content mutation between publication and render, even with latest project CAS', async () => {
    const { ready, run, record } = setup()
    await ready()
    await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, decision: 'include' })
    await run({ kind: 'baseline.publish', confirmedContentVersion: 3 })
    const baselineId = record().currentBaselineId!
    await run({ kind: 'requirements.reorder', requirementIds: record().requirementOrder })
    expect(await run({ kind: 'prd.render', baselineId, confirmedContentVersion: 3 })).toMatchObject({ status: 'rejected', error: { code: 'baseline-stale' } })
    expect(record().prdRevisions).toEqual([])
    expect(record().baselines).toHaveLength(1)
    expect(await run({ kind: 'baseline.publish', confirmedContentVersion: 3 })).toMatchObject({ status: 'rejected', error: { code: 'baseline-stale' } })
  })

  it('retains a saved baseline after renderer failure and retries the same render without duplicating publication', async () => {
    const real = new DeterministicPrdRenderer(nodeSha256Utf8)
    let fail = true
    const renderer: PrdRenderer = { render: input => { if (fail) throw new Error('limit-exceeded'); return real.render(input) } }
    const { service, ready, run, input, record, table } = setup({ renderer })
    await ready()
    await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, decision: 'include' })
    await run({ kind: 'baseline.publish', confirmedContentVersion: 3 })
    const request = input({ kind: 'prd.render', baselineId: record().currentBaselineId!, confirmedContentVersion: 3 })
    const before = JSON.stringify(record())
    expect(await service.command(request)).toMatchObject({ status: 'rejected', error: { code: 'limit-exceeded' } })
    expect(JSON.stringify(record())).toBe(before)
    expect(table.writeCount).toBe(4)
    fail = false
    expect((await service.command(request)).status).toBe('accepted')
    expect(record().baselines).toHaveLength(1)
    expect(record().prdRevisions).toHaveLength(1)
  })

  it.each(['retained baseline', 'baseline content version', 'project', 'source'] as const)
  ('rejects renderer output bound to the wrong %s without advancing project state', async mismatch => {
    const real = new DeterministicPrdRenderer(nodeSha256Utf8)
    let renderCount = 0
    const renderer: PrdRenderer = { render: request => {
      renderCount += 1
      const older = record().baselines[0]!
      if (mismatch === 'retained baseline') {
        // Return valid bytes for A using the new PRD identity requested for current B.
        return real.render({ ...request, baseline: older, currentBaselineId: older.id,
          currentContentVersion: older.contentVersion })
      }
      const prd = real.render(request)
      if (mismatch === 'baseline content version') return { ...prd, baselineContentVersion: older.contentVersion }
      if (mismatch === 'project') return { ...prd, projectId: OTHER_PROJECT_ID }
      return { ...prd, sourceRevisionId: sourceRevisionIdSchema.parse(uuid(999)) }
    } }
    const { ready, run, input, service, record, table, clock } = setup({ renderer })
    await ready()
    await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, decision: 'include' })
    await run({ kind: 'baseline.publish', confirmedContentVersion: 3 })
    await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, humanReason: '第二次确认的理由' })
    await run({ kind: 'baseline.publish', confirmedContentVersion: 4 })
    expect(record().baselines.map(baseline => baseline.contentVersion)).toEqual([3, 4])
    expect(record().currentBaselineId).toBe(record().baselines[1]!.id)
    const before = record()
    const writes = table.writeCount
    clock.now.mockReturnValue('2026-09-08T08:00:00.000Z')
    const request = input({ kind: 'prd.render', baselineId: before.currentBaselineId!, confirmedContentVersion: 4 })
    const outcome = await service.command(request)
    expect(outcome).toEqual({ status: 'rejected', projectId: SMALL_PROJECT_ID,
      commandId: request.commandId, error: { code: 'invalid-evidence' } })
    expect(record()).toEqual({ ...before, commandReceipts: [...before.commandReceipts, {
      commandId: request.commandId, requestHash: hashProjectCommandRequest(request, nodeSha256Utf8),
      outcome: { ok: false, code: 'invalid-evidence' },
    }] })
    expect(record().prdRevisions).toEqual([])
    expect(record().header).toMatchObject({ projectVersion: 7, contentVersion: 4, updatedAt: at })
    expect(table.writeCount).toBe(writes + 1)
    expect(await service.command(request)).toEqual(outcome)
    expect(renderCount).toBe(1)
    expect(table.writeCount).toBe(writes + 1)
  })

  it('retains eight baselines and PRDs and rejects the first extra revision without a write', async () => {
    const { ready, run, record, table } = setup()
    await ready()
    await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, decision: 'include' })
    for (let i = 0; i < 8; i++) {
      expect((await run({ kind: 'baseline.publish', confirmedContentVersion: 3 })).status).toBe('accepted')
      expect((await run({ kind: 'prd.render', baselineId: record().currentBaselineId!, confirmedContentVersion: 3 })).status).toBe('accepted')
    }
    const before = table.writeCount
    expect(await run({ kind: 'baseline.publish', confirmedContentVersion: 3 })).toMatchObject({ status: 'rejected', error: { code: 'limit-exceeded' } })
    expect(await run({ kind: 'prd.render', baselineId: record().currentBaselineId!, confirmedContentVersion: 3 })).toMatchObject({ status: 'rejected', error: { code: 'limit-exceeded' } })
    expect(table.writeCount).toBe(before)
    expect(record().baselines).toHaveLength(8)
    expect(record().prdRevisions).toHaveLength(8)
  })

  it('checks originating project, command, source and PRD identities at every service return', async () => {
    const { service, input } = setup()
    const request = input({ kind: 'source.importText', text: '合成文字', displayName: 's.txt', format: 'pasted', syntheticDataAttested: true })
    const wrong: ProjectCommandOutcome = { status: 'accepted', projectId: OTHER_PROJECT_ID, commandId: request.commandId,
      value: { projectVersion: 2, contentVersion: 1, sourceRevisionId: sourceRevisionIdSchema.parse(uuid(123)) } }
    const repository = { mutate: async () => wrong } as unknown as TableProjectRepository
    await expect(new ProjectService(repository).command(request)).rejects.toThrow('invalid-outcome')
    expect(() => parseProductOutcome('projects.command', { ...wrong, projectId: SMALL_PROJECT_ID, commandId: uuid(999) }, request)).toThrow('invalid-outcome')
    await expect(service.getMarkdown({ apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID, prdRevisionId: 'INVALID' })).rejects.toThrow('invalid-request')
    expect(() => parseProductOutcome('projects.command', { status: 'accepted', projectId: SMALL_PROJECT_ID, commandId: request.commandId,
      value: { projectVersion: 2, contentVersion: 1, baselineId: baselineIdSchema.parse(uuid(123)) } }, request)).toThrow('invalid-outcome')
  })

  it('receipts fixture, baseline and permutation business failures while preserving the complete current content', async () => {
    const { ready, run, record } = setup()
    await ready()
    const before = { ...record(), commandReceipts: [] }
    expect(await run({ kind: 'baseline.publish', confirmedContentVersion: 2 })).toMatchObject({ status: 'rejected', error: { code: 'no-included-requirements' } })
    expect(await run({ kind: 'requirements.reorder', requirementIds: [requirementIdSchema.parse(uuid(999))] })).toMatchObject({ status: 'rejected', error: { code: 'baseline-stale' } })
    expect({ ...record(), commandReceipts: [] }).toEqual(before)
    // A missing source is a business rejection rather than a partial analysis revision.
    const empty = setup()
    expect(await empty.run({ kind: 'analysis.runFixture', sourceRevisionId: sourceRevisionIdSchema.parse(uuid(999)) })).toMatchObject({ status: 'rejected', error: { code: 'not-found' } })
    const unsupported = setup()
    await unsupported.run({ kind: 'source.importText', text: '这段合成文字不在 Fixture 清单', displayName: 's.txt', format: 'pasted', syntheticDataAttested: true })
    expect(await unsupported.analyse()).toMatchObject({ status: 'rejected', error: { code: 'fixture-not-allowed' } })
    expect(unsupported.record()).toMatchObject({ header: { projectVersion: 2, contentVersion: 1 }, analyses: [], generatedRequirements: [],
      commandReceipts: [expect.anything(), { outcome: { ok: false, code: 'fixture-not-allowed' } }] })
  })

  it('validates supporting quotes through the Host hash dependency on every include update', async () => {
    const first = setup()
    await first.ready()
    const current = first.record()
    const corrupted: ActiveProjectRecord = { ...current, evidence: current.evidence.map((item, i) => i === 0 ? { ...item, quote: '伪造引用' } : item) }
    const { run, record } = setup({ record: corrupted })
    expect(await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, decision: 'include' })).toMatchObject({ status: 'rejected', error: { code: 'invalid-evidence' } })
    expect(record().humanDecisions[0]?.decision).toBe('pending')
    expect(record().header).toMatchObject({ projectVersion: 3, contentVersion: 2, reviewStarted: false })
  })

  it('reconstructs the entire confirmed workflow, retained bytes and exact receipts after a JSON storage restart', async () => {
    const current = setup()
    await current.ready()
    await current.run({ kind: 'requirement.update', requirementId: current.record().requirementOrder[0]!, title: '人工最终标题', decision: 'include' })
    await current.run({ kind: 'baseline.publish', confirmedContentVersion: 3 })
    const request = current.input({ kind: 'prd.render', baselineId: current.record().currentBaselineId!, confirmedContentVersion: 3 })
    const result = await current.service.command(request)
    const prd = current.record().prdRevisions[0]!
    const getInput = { apiVersion: 'pmwb-product-v1', projectId: SMALL_PROJECT_ID }
    const markdownInput = { ...getInput, prdRevisionId: prd.id }
    const expectedView = await current.service.get(getInput)
    const expectedMarkdown = await current.service.getMarkdown(markdownInput)
    const restarted = setup({ record: JSON.parse(JSON.stringify(current.record())) as ActiveProjectRecord })
    expect(await restarted.service.get(getInput)).toEqual(expectedView)
    expect(await restarted.service.getMarkdown(markdownInput)).toEqual(expectedMarkdown)
    expect(await restarted.service.command(request)).toEqual(result)
    expect(restarted.table.writeCount).toBe(0)
    expect(restarted.clock.now).not.toHaveBeenCalled()
    expect(restarted.newId).not.toHaveBeenCalled()
  })

  it('owns an immutable prepared analysis snapshot if the engine mutates its returned object later', async () => {
    const real = new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8)
    const engine: InsightEngine = { analyse: async (input, signal) => {
      const returned = structuredClone(await real.analyse(input, signal))
      queueMicrotask(() => queueMicrotask(() => { Reflect.set(returned.evidence[0]!, 'quote', '外部覆写的引用') }))
      return returned
    } }
    const { ready, record } = setup({ engine })
    await ready()
    expect(record().header).toMatchObject({ projectVersion: 3, contentVersion: 2 })
    expect(record().evidence[0]?.quote).toBe('我经常找不到原话，整理一次要来回搜索。')
    expect(nodeSha256Utf8(record().evidence[0]!.quote)).toBe(record().evidence[0]!.quoteHash)
  })

  it('owns immutable prepared PRD bytes if the renderer mutates its returned object later', async () => {
    const real = new DeterministicPrdRenderer(nodeSha256Utf8)
    const renderer: PrdRenderer = { render: input => {
      const returned = structuredClone(real.render(input))
      queueMicrotask(() => { Reflect.set(returned, 'markdown', '外部覆写的 Markdown') })
      return returned
    } }
    const { ready, run, record } = setup({ renderer })
    await ready()
    await run({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, decision: 'include' })
    await run({ kind: 'baseline.publish', confirmedContentVersion: 3 })
    expect((await run({ kind: 'prd.render', baselineId: record().currentBaselineId!, confirmedContentVersion: 3 })).status).toBe('accepted')
    const prd = record().prdRevisions[0]!
    expect(prd.markdown.startsWith('## 背景与问题')).toBe(true)
    expect(prd.contentHash).toBe(nodeSha256Utf8(prd.markdown))
  })
})
