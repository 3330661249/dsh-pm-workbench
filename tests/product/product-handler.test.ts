import { describe, expect, it, vi } from 'vitest'
import { createProductHandler, internalProductResult } from '../../packages/workbench/src/application/product-handler.js'
import { ProjectService } from '../../packages/workbench/src/application/project-service.js'
import { TableProjectRepository } from '../../packages/workbench/src/application/project-repository.js'
import { FixtureInsightEngine } from '../../packages/workbench/src/analysis/fixture-engine.js'
import { FIXTURE_MANIFEST } from '../../packages/workbench/src/analysis/fixture-manifest.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { projectViewOf, sourceViewSchema, markdownViewSchema } from '../../packages/workbench/src/application/project-views.js'
import type { ProjectId } from '../../packages/workbench/src/domain/ids.js'
import type { StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import { PRODUCT_CAPABILITIES, type ProductEndpoint } from '../../packages/workbench/src/protocol/product.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import { SMALL_PROJECT_ID, OTHER_PROJECT_ID, makeSmallActiveRecord } from './helpers/synthetic-records.js'

const api = { apiVersion: 'pmwb-product-v1' }
const id = '10000000-0000-4000-8000-000000000001'
const command = { ...api, projectId: SMALL_PROJECT_ID, commandId: id, expectedVersion: 0,
  payload: { kind: 'project.create', name: 'Synthetic test', researchGoal: null, syntheticDataAttested: true } }
const sourceValue = { projectId: SMALL_PROJECT_ID, sourceRevisionId: id, revision: 1, displayName: 'synthetic.txt',
  format: 'pasted', utf8Bytes: 1, contentHash: nodeSha256Utf8('x'), syntheticDataAttested: true, text: 'x' }
const markdownValue = { projectId: SMALL_PROJECT_ID, prdRevisionId: id, sourceRevisionId: id, baselineId: id,
  baselineContentVersion: 1, rendererVersion: 'pmwb-prd-v1', contentHash: nodeSha256Utf8('x'), utf8Bytes: 1,
  createdAt: '2026-09-07T00:00:00.000Z', markdown: 'x' }
const outerFailure = { ok: false, error: { code: 'internal', message: 'Product request failed.', details: {} } }
function setup() {
  const table = createFakeDomainTable<ProjectId, StoredProjectRecord>()
  const repository = new TableProjectRepository(table, {
    engine: new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8), sha256Utf8: nodeSha256Utf8,
  })
  const service = new ProjectService(repository)
  const handler = createProductHandler(service)
  const call = (endpoint: string, input: unknown, signal = new AbortController().signal) => handler(endpoint, input, signal)
  return { table, repository, service, call }
}

describe('Product Connection handler', () => {
  it('dispatches all six endpoints through the actual service and returns business failures inside success', async () => {
    const { call, table } = setup()
    expect(await call('health', api)).toEqual({ ok: true, value: { status: 'accepted', value: PRODUCT_CAPABILITIES } })
    expect(await call('projects.command', command)).toEqual({ ok: true, value: {
      status: 'accepted', projectId: SMALL_PROJECT_ID, commandId: id, value: { projectVersion: 1, contentVersion: 0 },
    } })
    expect(await call('projects.list', api)).toMatchObject({ ok: true, value: { status: 'accepted', value: [{ id: SMALL_PROJECT_ID, name: 'Synthetic test' }] } })
    expect(await call('projects.get', { ...api, projectId: SMALL_PROJECT_ID })).toMatchObject({ ok: true, value: { status: 'accepted', value: { header: { id: SMALL_PROJECT_ID } } } })
    expect(await call('sources.get', { ...api, projectId: SMALL_PROJECT_ID, sourceRevisionId: id })).toEqual({ ok: true, value: { status: 'rejected', error: { code: 'not-found' } } })
    expect(await call('artifacts.getMarkdown', { ...api, projectId: SMALL_PROJECT_ID, prdRevisionId: id })).toEqual({ ok: true, value: { status: 'rejected', error: { code: 'not-found' } } })
    expect(table.writeCount).toBe(1)
  })

  it.each(['unknown', 'counter.increment', '__proto__', 'constructor'])('rejects unknown endpoint %s without dispatch', async endpoint => {
    const { service, call, table } = setup()
    const dispatch = vi.spyOn(service, 'command')
    expect(await call(endpoint, command)).toEqual(outerFailure)
    expect(dispatch).not.toHaveBeenCalled()
    expect(table.writeCount).toBe(0)
  })

  it.each([
    ['health', { ...api, source: 'private synthetic marker' }],
    ['projects.list', {}],
    ['projects.get', api],
    ['sources.get', { ...api, projectId: SMALL_PROJECT_ID }],
    ['artifacts.getMarkdown', { ...api, projectId: SMALL_PROJECT_ID, prdRevisionId: id, extra: true }],
    ['projects.command', { ...command, payload: { ...command.payload, syntheticDataAttested: false } }],
    ['projects.command', { ...command, payload: { ...command.payload, extra: true } }],
    ['projects.command', { ...api, projectId: SMALL_PROJECT_ID, commandId: id, expectedVersion: 0, ...command.payload }],
  ])('enforces strict %s inputs including nested payload and attestation', async (endpoint, input) => {
    const { call, table } = setup()
    expect(await call(endpoint as string, input)).toEqual(outerFailure)
    expect(table.writeCount).toBe(0)
  })

  it('maps oversized and non-JSON inputs to bounded errors without reading accessor payloads', async () => {
    const { call } = setup()
    expect(await call('health', { ...api, extra: 'x'.repeat(5000) })).toEqual(outerFailure)
    const getter = vi.fn(() => { throw new Error('private marker') })
    expect(await call('health', Object.defineProperty({}, 'apiVersion', { enumerable: true, get: getter }))).toEqual(outerFailure)
    expect(getter).not.toHaveBeenCalled()
  })

  it.each([
    ['projects.list', 'list', api, { status: 'accepted', value: [], extra: 'private marker' }],
    ['projects.get', 'get', { ...api, projectId: SMALL_PROJECT_ID }, { status: 'accepted', value: projectViewOf(makeSmallActiveRecord({ projectId: OTHER_PROJECT_ID })) }],
    ['sources.get', 'getSource', { ...api, projectId: SMALL_PROJECT_ID, sourceRevisionId: id }, { status: 'rejected', error: { code: 'not-found', detail: 'private marker' } }],
    ['artifacts.getMarkdown', 'getMarkdown', { ...api, projectId: SMALL_PROJECT_ID, prdRevisionId: id }, { status: 'rejected', error: { code: 'unknown' } }],
    ['projects.command', 'command', command, { status: 'accepted', projectId: OTHER_PROJECT_ID, commandId: id, value: { projectVersion: 1, contentVersion: 0 } }],
    ['projects.command', 'command', command, { status: 'accepted', projectId: SMALL_PROJECT_ID, commandId: id, value: { projectVersion: 2, contentVersion: 0 } }],
  ] as const)('validates and correlates every actual %s service outcome', async (endpoint, method, input, outcome) => {
    const { service, call } = setup()
    vi.spyOn(service, method).mockResolvedValue(outcome as never)
    expect(await call(endpoint, input)).toEqual(outerFailure)
  })

  it.each(['project', 'revision'] as const)('correlates successful source and Markdown outcomes to the originating %s identity', async mismatch => {
    const { service, call } = setup()
    const wrongSource = { ...sourceValue, ...(mismatch === 'project' ? { projectId: OTHER_PROJECT_ID } : { sourceRevisionId: OTHER_PROJECT_ID }) }
    const wrongMarkdown = { ...markdownValue, ...(mismatch === 'project' ? { projectId: OTHER_PROJECT_ID } : { prdRevisionId: OTHER_PROJECT_ID }) }
    // Each response is structurally valid; only correlation may reject it.
    expect(sourceViewSchema.safeParse(wrongSource).success).toBe(true)
    expect(markdownViewSchema.safeParse(wrongMarkdown).success).toBe(true)
    vi.spyOn(service, 'getSource').mockResolvedValue({ status: 'accepted', value: wrongSource } as never)
    vi.spyOn(service, 'getMarkdown').mockResolvedValue({ status: 'accepted', value: wrongMarkdown } as never)
    expect(await call('sources.get', { ...api, projectId: SMALL_PROJECT_ID, sourceRevisionId: id })).toEqual(outerFailure)
    expect(await call('artifacts.getMarkdown', { ...api, projectId: SMALL_PROJECT_ID, prdRevisionId: id })).toEqual(outerFailure)
  })

  it('dispatches successful source and Markdown reads to their distinct service methods', async () => {
    const { service, call } = setup()
    vi.spyOn(service, 'getSource').mockResolvedValue({ status: 'accepted', value: sourceValue } as never)
    vi.spyOn(service, 'getMarkdown').mockResolvedValue({ status: 'accepted', value: markdownValue } as never)
    expect(await call('sources.get', { ...api, projectId: SMALL_PROJECT_ID, sourceRevisionId: id })).toEqual({ ok: true, value: { status: 'accepted', value: sourceValue } })
    expect(await call('artifacts.getMarkdown', { ...api, projectId: SMALL_PROJECT_ID, prdRevisionId: id })).toEqual({ ok: true, value: { status: 'accepted', value: markdownValue } })
  })

  it('correlates rejected command outcomes as well as successful ones', async () => {
    const { service, call } = setup()
    vi.spyOn(service, 'command').mockResolvedValue({ status: 'rejected', projectId: SMALL_PROJECT_ID,
      commandId: OTHER_PROJECT_ID, error: { code: 'version-conflict' } } as never)
    expect(await call('projects.command', command)).toEqual(outerFailure)
  })

  it('validates the outcome against an immutable originating input even if caller input changes', async () => {
    const { service, call } = setup()
    let finish!: (value: Awaited<ReturnType<ProjectService['get']>>) => void
    vi.spyOn(service, 'get').mockImplementation(() => new Promise(resolve => { finish = resolve }))
    const input = { ...api, projectId: SMALL_PROJECT_ID }
    const pending = call('projects.get', input)
    input.projectId = OTHER_PROJECT_ID
    finish({ status: 'accepted', value: projectViewOf(makeSmallActiveRecord({ projectId: OTHER_PROJECT_ID })) })
    expect(await pending).toEqual(outerFailure)
  })

  it('maps oversized outcomes and thrown service data to fixed bounded Connection envelopes', async () => {
    const { service, call } = setup()
    vi.spyOn(service, 'list').mockResolvedValue({ status: 'accepted', value: 'x'.repeat(131073) } as never)
    expect(await call('projects.list', api)).toEqual(outerFailure)
    for (const thrown of [new Error('private text /synthetic/path stack'), { code: 'invalid-request', payload: 'private marker' }, null]) {
      vi.spyOn(service, 'get').mockImplementation(() => { throw thrown })
      expect(await call('projects.get', { ...api, projectId: SMALL_PROJECT_ID })).toEqual(outerFailure)
    }
    expect(internalProductResult()).toEqual(outerFailure)
  })

  it.each(['health', 'projects.list', 'projects.get', 'sources.get', 'artifacts.getMarkdown', 'projects.command'] as const)
  ('cancels pre-aborted %s without dispatch or writes, with command identity preserved', async endpoint => {
    const { call, table, service } = setup()
    const dispatch = vi.spyOn(service, 'command')
    const controller = new AbortController()
    controller.abort(new Error('private abort reason'))
    const inputs: Record<ProductEndpoint, unknown> = { health: api, 'projects.list': api,
      'projects.get': { ...api, projectId: SMALL_PROJECT_ID },
      'sources.get': { ...api, projectId: SMALL_PROJECT_ID, sourceRevisionId: id },
      'artifacts.getMarkdown': { ...api, projectId: SMALL_PROJECT_ID, prdRevisionId: id }, 'projects.command': command }
    expect(await call(endpoint, inputs[endpoint], controller.signal)).toEqual({ ok: true, value: {
      status: 'rejected', ...(endpoint === 'projects.command' ? { projectId: SMALL_PROJECT_ID, commandId: id } : {}), error: { code: 'cancelled' },
    } })
    expect(dispatch).not.toHaveBeenCalled()
    expect(table.writeCount).toBe(0)
  })

  it('validates even an invalid actual outcome returned after cancellation', async () => {
    const { call, service } = setup()
    const controller = new AbortController()
    vi.spyOn(service, 'list').mockImplementation(async () => {
      controller.abort()
      return { status: 'accepted', value: [], extra: 'private' } as never
    })
    expect(await call('projects.list', api, controller.signal)).toEqual(outerFailure)
  })

  it('validates the model command through the real repository before model invocation', async () => {
    const { call, table } = setup()
    await call('projects.command', command)
    const input = { ...command, commandId: '20000000-0000-4000-8000-000000000001', expectedVersion: 1,
      payload: { kind: 'analysis.runHarnessModel', sourceRevisionId: id } }
    expect(await call('projects.command', input)).toEqual({ ok: true, value: { status: 'rejected', projectId: SMALL_PROJECT_ID,
      commandId: input.commandId, error: { code: 'not-found' } } })
    expect(table.writeCount).toBe(2)
  })
})
