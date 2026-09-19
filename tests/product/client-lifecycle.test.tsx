import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClientConnectionRpc } from '@deepseek-ai/dsh-client-connection/client'
import { mountWorkbenchClient, type WorkbenchClientContext } from '../../packages/workbench/src/client/index.js'
import { WorkbenchView } from '../../packages/workbench/src/client/workbench/WorkbenchView.js'
import { createWorkbenchStore, type WorkbenchStore } from '../../packages/workbench/src/client/workbench/store.js'
import { WorkbenchBrowserPort, type WorkbenchBrowserDependencies } from '../../packages/workbench/src/client/workbench/browser-port.js'
import { ConnectionRpcWorkbenchTransport, type Stage3aProjectCommand } from '../../packages/workbench/src/client/workbench/transport.js'
import { readMaterialDraft } from '../../packages/workbench/src/client/workbench/material-input.js'
import * as materialInput from '../../packages/workbench/src/client/workbench/material-input.js'
import { ProjectService } from '../../packages/workbench/src/application/project-service.js'
import { TableProjectRepository } from '../../packages/workbench/src/application/project-repository.js'
import { nodeSha256Utf8 } from '../../packages/workbench/src/application/node-sha256.js'
import { FixtureInsightEngine } from '../../packages/workbench/src/analysis/fixture-engine.js'
import { HybridInsightEngine, type InsightEngine } from '../../packages/workbench/src/analysis/types.js'
import { BUILT_IN_SYNTHETIC_TEXT, FIXTURE_MANIFEST } from '../../packages/workbench/src/analysis/fixture-manifest.js'
import { PRODUCT_API_VERSION, PRODUCT_CAPABILITIES, type StrictProjectCommandPayload } from '../../packages/workbench/src/protocol/product.js'
import type { ActiveProjectRecord, StoredProjectRecord } from '../../packages/workbench/src/domain/model.js'
import type { ProjectId } from '../../packages/workbench/src/domain/ids.js'
import { createFakeDomainTable } from './helpers/fake-domain-table.js'
import { makeSmallActiveRecord, SMALL_PROJECT_ID, OTHER_PROJECT_ID } from './helpers/synthetic-records.js'
import { ControlledDemo, ValidationTaskDetail } from '../../packages/workbench/src/client/workbench/ValidationPane.js'
import { makeValidationTask, validationRun } from './helpers/validation-fixtures.js'

// Only React's scheduling and native host nodes are faked. Production components,
// handlers, store, protocol, transport validation and export port execute unchanged.
// This proves component/ref wiring, not browser focus trapping or rendering.
const hooks = vi.hoisted(() => ({ current: undefined as any }))
vi.mock('react', async importOriginal => {
  const actual = await importOriginal<typeof import('react')>()
  const slot = () => { const scope = hooks.current; return [scope, scope.cursor++] as const }
  const memo = (factory: () => unknown, deps?: readonly unknown[]) => {
    const [scope, index] = slot(); const old = scope.slots[index]
    if (!old || !deps || deps.some((value, i) => !Object.is(value, old.deps?.[i]))) scope.slots[index] = { value: factory(), deps }
    return scope.slots[index].value
  }
  const effect = (callback: () => void | (() => void), deps?: readonly unknown[]) => {
    const [scope, index] = slot(); const old = scope.slots[index]
    if (!old || !deps || deps.some((value, i) => !Object.is(value, old.deps?.[i]))) {
      const entry = { deps, cleanup: old?.cleanup }; scope.slots[index] = entry
      scope.renderer.effects.push(() => { entry.cleanup?.(); entry.cleanup = callback() })
    }
  }
  return { ...actual,
    useState: (initial: any) => {
      if (!hooks.current) return actual.useState(initial)
      const [scope, index] = slot()
      if (!(index in scope.slots)) scope.slots[index] = { value: typeof initial === 'function' ? initial() : initial }
      return [scope.slots[index].value, (next: any) => { scope.slots[index].value = typeof next === 'function' ? next(scope.slots[index].value) : next; scope.renderer.dirty = true }]
    },
    useRef: (initial: any) => hooks.current ? memo(() => ({ current: initial }), []) : actual.useRef(initial),
    useMemo: (factory: any, deps: any) => hooks.current ? memo(factory, deps) : actual.useMemo(factory, deps),
    useCallback: (callback: any, deps: any) => hooks.current ? memo(() => callback, deps) : actual.useCallback(callback, deps),
    useEffect: (callback: any, deps: any) => hooks.current ? effect(callback, deps) : actual.useEffect(callback, deps),
    useId: () => hooks.current ? memo(() => `test-id-${hooks.current.renderer.nextId++}`, []) : actual.useId(),
    useSyncExternalStore: (subscribe: any, getSnapshot: any, getServerSnapshot: any) => {
      if (!hooks.current) return actual.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
      const renderer = hooks.current.renderer
      effect(() => subscribe(() => { renderer.dirty = true }), [subscribe])
      return getSnapshot()
    },
  }
})
type TestNode = { type: string; props: Record<string, any>; children: Array<TestNode | string>; host: any }
const renderers: ComponentHarness[] = []
class ComponentHarness {
  scopes = new Map<string, any>(); hosts = new Map<string, any>(); effects: Array<() => void> = []
  tree: Array<TestNode | string> = []; dirty = false; nextId = 1
  document = { activeElement: null as any }; dialogEvents: string[] = []
  constructor(private readonly element: ReactNode) { vi.stubGlobal('document', this.document); renderers.push(this); this.render() }
  render() {
    let loops = 0
    do {
      this.dirty = false; const seen = new Set<string>(); const hostSeen = new Set<string>(); this.effects = []
      const walk = (value: ReactNode, path: string): Array<TestNode | string> => {
        if (value === null || value === undefined || typeof value === 'boolean') return []
        if (typeof value === 'string' || typeof value === 'number') return [String(value)]
        if (Array.isArray(value)) return value.flatMap((child, index) => walk(child, `${path}.${isValidElement(child) && child.key !== null ? child.key : index}`))
        if (!isValidElement(value)) return []
        const props = value.props as Record<string, any>
        if (typeof value.type === 'function') {
          const key = `${path}:${value.type.name}`; seen.add(key)
          const scope = this.scopes.get(key) ?? { slots: [], renderer: this }; scope.cursor = 0; this.scopes.set(key, scope)
          const previous = hooks.current; hooks.current = scope
          let output: ReactNode
          try { output = (value.type as (props: any) => ReactNode)(props) } finally { hooks.current = previous }
          return walk(output, `${key}.out`)
        }
        if (typeof value.type !== 'string') return walk(props.children, path)
        hostSeen.add(path)
        let host = this.hosts.get(path)
        if (!host) {
          host = { open: false, isConnected: true, ownerDocument: this.document,
            focus: () => { this.document.activeElement = host; this.dialogEvents.push(`focus:${host.marker ?? value.type}`) },
            showModal: () => { host.open = true; this.dialogEvents.push(`show:${host.marker}`) },
            close: () => { host.open = false; this.dialogEvents.push(`close:${host.marker}`) } }
          this.hosts.set(path, host)
        }
        host.marker = props['data-dsh-pm-workbench']; host.props = props
        const ref = (value as any).ref
        if (host.ref !== ref) { if (typeof host.ref === 'function') host.ref(null); else if (host.ref) host.ref.current = null; host.ref = ref }
        if (typeof ref === 'function') ref(host); else if (ref) ref.current = host
        return [{ type: value.type, props, host, children: walk(props.children, `${path}.children`) }]
      }
      this.tree = walk(this.element, 'root')
      for (const [key, scope] of this.scopes) if (!seen.has(key)) { for (const entry of scope.slots) entry?.cleanup?.(); this.scopes.delete(key) }
      for (const [key, host] of this.hosts) if (!hostSeen.has(key)) { host.isConnected = false; if (typeof host.ref === 'function') host.ref(null); else if (host.ref) host.ref.current = null; this.hosts.delete(key) }
      for (const callback of this.effects) callback()
    } while (this.dirty && ++loops < 20)
    if (loops >= 20) throw new Error('component render did not settle')
  }
  nodes(): TestNode[] { const all: TestNode[] = []; const visit = (nodes: Array<TestNode | string>) => { for (const node of nodes) if (typeof node !== 'string') { all.push(node); visit(node.children) } }; visit(this.tree); return all }
  all(marker: string) { return this.nodes().filter(node => node.props['data-dsh-pm-workbench'] === marker) }
  one(marker: string) { const values = this.all(marker); expect(values, `one ${marker}`).toHaveLength(1); return values[0]! }
  text(node?: TestNode): string { const visit = (nodes: Array<TestNode | string>): string => nodes.map(value => typeof value === 'string' ? value : visit(value.children)).join(''); return visit(node ? node.children : this.tree) }
  fire(marker: string, event: string, values: Record<string, unknown> = {}) {
    const node = this.one(marker); node.host.focus()
    return node.props[event]?.({ target: node.host, currentTarget: Object.assign(node.host, values), preventDefault: vi.fn(), stopPropagation: vi.fn() })
  }
  click(marker: string) { return this.fire(marker, 'onClick') }
  clickText(text: string) { const node = this.nodes().find(node => node.type === 'button' && this.text(node) === text); expect(node, text).toBeDefined(); node!.host.focus(); return node!.props.onClick?.({ currentTarget: node!.host }) }
  clickTextStartingWith(text: string) { const node = this.nodes().find(node => node.type === 'button' && this.text(node).startsWith(text)); expect(node, text).toBeDefined(); node!.host.focus(); return node!.props.onClick?.({ currentTarget: node!.host }) }
  async settle(condition?: () => boolean) {
    await vi.waitFor(() => {
      this.render()
      if (condition) expect(condition()).toBe(true)
      else {
        expect(this.all('refresh-project').some(node => node.props.disabled)).toBe(false)
        expect(this.nodes().some(node => node.props.role === 'status' && this.text(node) === '正在校验材料')).toBe(false)
      }
    }, { timeout: 2_000, interval: 10 })
  }
  unmount() { for (const scope of this.scopes.values()) for (const entry of scope.slots) entry?.cleanup?.(); this.scopes.clear(); this.hosts.clear() }
}
afterEach(() => { for (const renderer of renderers.splice(0)) renderer.unmount(); vi.unstubAllGlobals(); vi.restoreAllMocks() })
const uuid = (n: number) => `20000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`
describe('validation interactions', () => {
  it('requires model consent before confirming and sends the confirmed plan command', () => {
    const onMutation = vi.fn(), task = makeValidationTask()
    const ui = new ComponentHarness(<ValidationTaskDetail task={task} disabled={false} onMutation={onMutation} onReview={() => {}} onHandoff={() => {}} />)
    expect(ui.text()).toContain('我已核对所选 PRD 和验证计划，并允许将本次测试材料发送给当前 Harness 模型。')
    expect(ui.text(ui.one('validation-confirm'))).toBe('确认 PRD 与验证计划')
    expect(ui.one('validation-confirm').props.disabled).toBe(true)
    const checkbox = ui.nodes().find(node => node.type === 'input' && node.props.type === 'checkbox')!
    checkbox.props.onChange({ target: { checked: true } }); ui.render()
    expect(ui.one('validation-confirm').props.disabled).toBe(false)
    ui.click('validation-confirm')
    expect(onMutation).toHaveBeenCalledWith({ action: 'confirm', payload: { allowModelUse: true } }, '正在确认计划…')
    expect(ui.one('validation-run').props.disabled).toBe(true)
  })
  it('runs a confirmed POC only with nonempty input', () => {
    const onMutation = vi.fn(), task = makeValidationTask({ mode: 'poc', status: 'confirmed', allowModelUse: true, confirmedPlanVersion: 1 })
    const ui = new ComponentHarness(<ValidationTaskDetail task={task} disabled={false} onMutation={onMutation} onReview={() => {}} onHandoff={() => {}} />)
    expect(ui.one('validation-run').props.disabled).toBe(true)
    const input = ui.nodes().find(node => node.type === 'textarea' && node.props.placeholder?.startsWith('粘贴一段材料'))!
    input.props.onChange({ target: { value: '需要批量整理会议结论。' } }); ui.render()
    expect(ui.one('validation-run').props.disabled).toBe(false); ui.click('validation-run')
    expect(onMutation.mock.calls[0]![0]).toEqual({ action: 'run', payload: { input: '需要批量整理会议结论。' } })
  })
  it('states that Demo confirmation covers the PRD scope while simulated results do not prove feature completion', () => {
    const ui = new ComponentHarness(<ValidationTaskDetail task={makeValidationTask({ mode: 'demo' })} disabled={false}
      onMutation={() => {}} onReview={() => {}} onHandoff={() => {}} />)
    expect(ui.text()).toContain('点击确认即表示已核对所选 PRD 范围与验证计划')
    expect(ui.text()).toContain('不代表功能已经完成')
    expect(ui.text(ui.one('validation-confirm'))).toBe('确认 PRD 与验证计划')
  })
  it('keeps automatic checks distinct from human verdict and routes partial results back to requirements', () => {
    const onReview = vi.fn(), onMutation = vi.fn()
    const task = makeValidationTask({ status: 'judged', confirmedPlanVersion: 1, allowModelUse: true, runs: [validationRun],
      verdict: { value: 'partial', note: '需要补充失败场景', runId: validationRun.id, judgedAt: validationRun.completedAt! } })
    const ui = new ComponentHarness(<ValidationTaskDetail task={task} disabled={false} onMutation={onMutation} onReview={onReview} onHandoff={() => {}} />)
    expect(ui.text()).toContain('自动检查仅供参考')
    expect(ui.text()).toContain('实际输出')
    ui.click('validation-judge-hold'); expect(onMutation.mock.calls[0]![0]).toEqual({ action: 'judge', payload: { verdict: 'hold', note: '需要补充失败场景' } })
    ui.clickText('返回需求修改 →'); expect(onReview).toHaveBeenCalledOnce()
  })
  it('keeps a controlled Demo visibly simulated while its input, result and reset controls work', () => {
    const ui = new ComponentHarness(<ControlledDemo demo={{ title: '访谈整理', inputLabel: '访谈材料', actionLabel: '查看整理效果', steps: ['放入材料', '查看结果'], sampleOutput: '模拟需求：减少手工录入' }} />)
    expect(ui.text()).toContain('模拟数据'); expect(ui.text()).not.toContain('模拟需求：减少手工录入')
    const input = ui.nodes().find(node => node.type === 'textarea')!
    input.props.onChange({ target: { value: '示例材料' } }); ui.render(); ui.clickText('查看整理效果'); ui.render()
    expect(ui.text()).toContain('模拟需求：减少手工录入')
    expect(ui.text()).toContain('不会根据输入调用模型')
    ui.clickText('返回重新体验'); ui.render(); expect(ui.text()).not.toContain('模拟需求：减少手工录入')
  })
})
function deferred<T = void>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r }); return { promise, resolve } }
async function setup(options: { empty?: boolean; included?: boolean; browser?: Partial<WorkbenchBrowserDependencies> } = {}) {
  const table = createFakeDomainTable<ProjectId, StoredProjectRecord>([[SMALL_PROJECT_ID, makeSmallActiveRecord({ name: '合成研究一' })], [OTHER_PROJECT_ID, makeSmallActiveRecord({ projectId: OTHER_PROJECT_ID, name: '合成研究二' })]])
  let hostId = 1000, clientId = 3000
  const fixture = new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8)
  const model: InsightEngine = { analyse: async (input, signal) => {
    const candidate = await fixture.analyse({ ...input, mode: 'fixture' }, signal)
    return { ...candidate, analysis: { ...candidate.analysis, kind: 'harness-model', provider: 'test-provider', model: 'test-model' },
      generatedRequirements: candidate.generatedRequirements.map(draft => ({ ...draft, producer: 'ai' })) }
  } }
  const service = new ProjectService(new TableProjectRepository(table, { engine: new HybridInsightEngine(fixture, model),
    sha256Utf8: nodeSha256Utf8, clock: { now: () => '2026-09-07T08:00:00.000Z' }, newId: () => uuid(hostId++) }))
  const record = () => table.get(SMALL_PROJECT_ID) as ActiveProjectRecord
  const external = (payload: StrictProjectCommandPayload) => service.command({ apiVersion: PRODUCT_API_VERSION, projectId: SMALL_PROJECT_ID, expectedVersion: record().header.projectVersion, commandId: uuid(clientId++), payload })
  if (!options.empty) {
    await external({ kind: 'source.importText', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt', format: 'pasted', syntheticDataAttested: true })
    await external({ kind: 'analysis.runFixture', sourceRevisionId: record().source!.id })
    if (options.included) await external({ kind: 'requirement.update', requirementId: record().requirementOrder[0]!, decision: 'include', title: '人工最终标题', humanReason: '对应原文已核对' })
  }
  const commands: Stage3aProjectCommand[] = []; const reads: string[] = []
  let intercept: ((endpoint: string, input: unknown, next: () => Promise<unknown>) => Promise<unknown>) | undefined
  const call: ClientConnectionRpc['call'] = async (_channel, endpoint, input) => {
    if (endpoint === 'projects.command') commands.push(input as Stage3aProjectCommand); else reads.push(endpoint)
    const next = async () => ({ ok: true, value: endpoint === 'health' ? { status: 'accepted', value: PRODUCT_CAPABILITIES }
      : endpoint === 'projects.list' ? await service.list(input) : endpoint === 'projects.get' ? await service.get(input)
      : endpoint === 'sources.get' ? await service.getSource(input) : endpoint === 'artifacts.getMarkdown' ? await service.getMarkdown(input) : await service.command(input) })
    return (intercept ? await intercept(endpoint, input, next) : await next()) as Awaited<ReturnType<ClientConnectionRpc['call']>>
  }
  const clipboard: string[] = []; const downloads: Array<{ url: string; name: string }> = []; const blobs: Blob[] = []; const revoked: string[] = []
  const browser = new WorkbenchBrowserPort({ writeClipboard: async text => { clipboard.push(text) }, createObjectURL: blob => { blobs.push(blob); return 'owned-test-url' },
    clickDownload: (url, name) => { downloads.push({ url, name }) }, revokeObjectURL: url => { revoked.push(url) }, ...options.browser })
  const ids = { createCommandId: () => uuid(clientId++), createProjectId: () => uuid(clientId++) }
  const store = createWorkbenchStore(new ConnectionRpcWorkbenchTransport({ call }), ids, browser)
  await store.open(); await store.selectProject(SMALL_PROJECT_ID)
  const ui = () => new ComponentHarness(<WorkbenchView store={store} createCommandId={ids.createCommandId} />)
  return { store, ui, ids, commands, reads, clipboard, downloads, blobs, revoked, record, external, service, call, intercept: (next?: typeof intercept) => { intercept = next } }
}
function context(events: string[], failure?: string) {
  const live = new Map<string, ComponentType<any>>()
  const ctx = { connection: { rpc: { call: vi.fn() }, start: vi.fn(() => { throw new Error('must not start connection') }) }, slots: {
    inject: (name: string, callback: () => () => void) => { if (failure === `setup:${name}`) throw new Error('setup failure'); const cleanup = callback(); return () => { events.push(`unregister:${name}`); cleanup(); if (failure === name) throw new Error('cleanup failure') } },
    register: (options: { name: string; id: string }, component: ComponentType<any>) => { expect(live.has(options.id)).toBe(false); live.set(options.id, component); return () => { live.delete(options.id) } },
  } } as unknown as WorkbenchClientContext
  return { ctx, live }
}
async function withPrdHistory(browser?: Partial<WorkbenchBrowserDependencies>) {
  const h = await setup({ included: true, browser }); const ui = h.ui(); await ui.settle()
  ui.click('confirm-scope'); await ui.settle()
  ui.click('step-1'); ui.render()
  ui.fire('human-reason', 'onChange', { value: '第二次确认的合成研究理由' }); ui.render(); ui.click('save-requirements'); await ui.settle()
  ui.clickText('核对本期范围'); ui.render(); ui.click('confirm-scope'); await ui.settle()
  return { ...h, ui, first: h.record().prdRevisions[0]!, second: h.record().prdRevisions[1]! }
}

describe('Product lifecycle and real store handlers', () => {
  it('registers only Product additive slots and reverses cleanup with an idempotent store disposal', async () => {
    const h = await setup(); const events: string[] = []; const { ctx, live } = context(events)
    const disposeStore = h.store.dispose; h.store.dispose = () => { events.push('store.dispose'); disposeStore() }
    const dispose = mountWorkbenchClient(ctx, h.store)
    expect([...live.keys()]).toEqual(['pm-workbench-product-launcher', 'pm-workbench-product-overlay'])
    dispose(); dispose(); expect(events).toEqual(['unregister:shell.overlay', 'unregister:sidebar.footer.action', 'store.dispose']); expect(live.size).toBe(0)
  })
  it.each(['setup:shell.overlay', 'shell.overlay'] as const)('cleans every owned resource even when %s fails', async failure => {
    const h = await setup(); const events: string[] = []; const { ctx, live } = context(events, failure)
    const disposeStore = h.store.dispose; h.store.dispose = () => { events.push('store.dispose'); disposeStore(); throw new Error('store cleanup') }
    if (failure.startsWith('setup')) expect(() => mountWorkbenchClient(ctx, h.store)).toThrow('setup failure')
    else { const dispose = mountWorkbenchClient(ctx, h.store); expect(dispose).toThrow('cleanup failure'); expect(dispose).not.toThrow() }
    expect(events.at(-1)).toBe('store.dispose'); expect(live.size).toBe(0)
  })
  it('reuses one store through close/reopen with no duplicate slots/listeners, reacquires source and restores launcher focus', async () => {
    const h = await setup(); h.store.close(); const events: string[] = []; const { ctx, live } = context(events)
    let listeners = 0; const subscribe = h.store.subscribe; h.store.subscribe = listener => { listeners++; const off = subscribe(listener); return () => { listeners--; off() } }
    const dispose = mountWorkbenchClient(ctx, h.store)
    const ui = new ComponentHarness(<>{createElement(live.get('pm-workbench-product-launcher')!)}{createElement(live.get('pm-workbench-product-overlay')!)}</>)
    ui.click('launcher'); await ui.settle()
    ui.fire('requirement-title', 'onChange', { value: '关闭后还在的草稿' }); ui.render()
    ui.click('close'); ui.render(); expect(ui.all('overlay')).toHaveLength(0)
    expect(ui.document.activeElement).toBe(ui.one('launcher').host)
    ui.click('launcher'); await ui.settle()
    expect(ui.one('requirement-title').props.value).toBe('关闭后还在的草稿')
    ui.click('step-0'); ui.render()
    expect(ui.one('source-text')).toBeDefined(); expect(live.size).toBe(2); expect(listeners).toBe(1)
    ui.unmount(); expect(listeners).toBe(0); dispose()
  })
  it('keeps creation attestation separate and uses a named native create dialog with cancel focus restoration', async () => {
    const h = await setup({ empty: true }); const ui = h.ui(); await ui.settle()
    ui.click('new-project'); ui.render(); expect(ui.one('create-dialog').type).toBe('dialog')
    expect(ui.one('confirm-create').props.disabled).toBe(true)
    ui.fire('project-name', 'onChange', { value: '新的合成项目' }); ui.fire('research-goal', 'onChange', { value: '' }); ui.render()
    ui.click('confirm-create'); await ui.settle(); expect(h.commands).toHaveLength(0)
    ui.fire('create-data-use-attestation', 'onChange', { checked: true }); ui.render(); ui.click('confirm-create'); await ui.settle()
    expect(h.commands).toHaveLength(1); expect(h.commands[0]).toMatchObject({ expectedVersion: 0, payload: { kind: 'project.create', name: '新的合成项目', researchGoal: null, dataUseAttested: true } })
    expect(h.store.getSnapshot().importAttested).toBe(false); expect(ui.all('create-dialog')).toHaveLength(0)
    ui.click('new-project'); ui.render(); expect(ui.one('create-data-use-attestation').props.checked).toBe(false)
    const cancel = ui.one('create-dialog'); const event = { target: cancel.host, currentTarget: cancel.host, preventDefault: vi.fn(), stopPropagation: vi.fn() }
    cancel.props.onCancel(event); ui.render(); expect(event.preventDefault).toHaveBeenCalled(); expect(event.stopPropagation).toHaveBeenCalled()
    expect(ui.all('overlay')).toHaveLength(1); expect(ui.document.activeElement).toBe(ui.one('new-project').host)
  })
  it('keeps Fixture loading in memory until the separate material attestation and explicit save action', async () => {
    const h = await setup({ empty: true }); const ui = h.ui(); await ui.settle()
    ui.click('load-fixture'); await ui.settle()
    expect(h.commands).toHaveLength(0); expect(h.store.getSnapshot().materialDraft?.text).toBe(BUILT_IN_SYNTHETIC_TEXT)
    expect(ui.one('data-use-attestation').props.checked).toBe(false)
    ui.fire('data-use-attestation', 'onChange', { checked: true }); ui.render(); ui.click('save-material'); await ui.settle()
    expect(h.commands.map(command => command.payload.kind)).toEqual(['source.importText'])
    expect(ui.text(ui.one('source-text'))).toBe(BUILT_IN_SYNTHETIC_TEXT)
    ui.click('analyse-model'); await ui.settle()
    expect(h.commands[1]).toMatchObject({ apiVersion: PRODUCT_API_VERSION, projectId: SMALL_PROJECT_ID, expectedVersion: 2,
      payload: { kind: 'analysis.runHarnessModel', sourceRevisionId: h.record().source!.id } })
    expect(ui.all('requirement-card')).toHaveLength(1)
  })
  it('retains the exact verified material object and existing form after failed and raced file reads', async () => {
    const h = await setup({ empty: true }); const draft = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'fixture.txt' }); h.store.setMaterialDraft(draft, false)
    const ui = h.ui(); await ui.settle()
    ui.fire('material-file', 'onChange', { files: [{ name: 'PRIVATE_CANARY.pdf', type: 'application/pdf', size: 1, arrayBuffer: async () => new ArrayBuffer(1) }] }); await ui.settle()
    expect(h.store.getSnapshot().materialDraft).toBe(draft); expect(ui.one('material-input').props.value).toBe(BUILT_IN_SYNTHETIC_TEXT)
    expect(ui.text()).toContain('材料读取失败，请检查 Word、TXT 或 Markdown 文件；文本请使用 UTF-8 编码，Word 文件请勿加密'); expect(ui.text()).not.toContain('PRIVATE_CANARY')
    const pending = deferred<ArrayBuffer>(); const bytes = new TextEncoder().encode('较早输入')
    ui.fire('material-file', 'onChange', { files: [{ name: 'earlier.txt', type: 'text/plain', size: bytes.length, arrayBuffer: () => pending.promise }] })
    ui.fire('material-input', 'onChange', { value: '较新输入' }); await ui.settle(); pending.resolve(bytes.buffer); await ui.settle()
    expect(h.store.getSnapshot().materialDraft?.text).toBe('较新输入'); expect(h.commands).toHaveLength(0)
  })
  it('opens source context from evidence and binds human controls to explicit requirement save', async () => {
    const h = await setup(); const ui = h.ui(); await ui.settle()
    const open = ui.nodes().find(node => node.type === 'button' && ui.text(node) === '来自访谈')!
    open.props.onClick(); await ui.settle(); expect(ui.text(ui.all('evidence')[0]!)).toContain(h.record().evidence[0]!.quote)
    ui.fire('requirement-title', 'onChange', { value: '新的标题' }); ui.render()
    ui.fire('requirement-pain-point', 'onChange', { value: '新的痛点' }); ui.render()
    ui.fire('requirement-description', 'onChange', { value: '新的描述' }); ui.render()
    ui.clickTextStartingWith('P2'); ui.render()
    ui.clickTextStartingWith('纳入本期'); ui.render()
    ui.fire('human-reason', 'onChange', { value: '人工理由' }); ui.render()
    ui.fire('requirement-order', 'onChange', { value: '1' }); ui.render()
    expect(h.commands).toHaveLength(0); expect(ui.one('save-requirements').props.disabled).toBe(false)
    ui.click('save-requirements'); await ui.settle()
    expect(h.commands.map(command => command.payload.kind)).toEqual(['requirement.update', 'requirement.update', 'requirement.update', 'requirement.update', 'requirement.update', 'requirement.update', 'requirements.reorder'])
    expect(h.store.getSnapshot().saveState).toBe('saved'); expect(ui.one('requirement-title').props.value).toBe('新的标题')
  })
  it('passes the exact rendered token once, latches before awaits, and never implicitly saves during confirmation', async () => {
    const h = await setup({ included: true }); const ui = h.ui(); await ui.settle()
    ui.fire('requirement-title', 'onChange', { value: '随后放弃的临时标题' }); ui.render()
    ui.click('discard-drafts'); ui.render(); ui.click('confirm-discard'); await ui.settle()
    const prepare = h.store.prepareConfirmation; const issued: unknown[] = []; h.store.prepareConfirmation = () => { const value = prepare(); issued.push(value); return value }
    ui.clickText('核对本期范围'); ui.render(); const displayed = issued.at(-1)
    const publish = vi.spyOn(h.store, 'publishConfirmedBaseline'); const gate = deferred(); const entered = deferred()
    h.intercept(async (endpoint, _input, next) => { if (endpoint === 'projects.command') { entered.resolve(); await gate.promise } return next() })
    const button = ui.one('confirm-scope'); button.props.onClick(); button.props.onClick(); await entered.promise
    expect(publish).toHaveBeenCalledTimes(1); expect(publish.mock.calls[0]![0]).toBe(displayed)
    gate.resolve(); await ui.settle()
    expect(h.commands.map(command => command.payload.kind)).toEqual(['baseline.publish', 'prd.render'])
    expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(h.record().prdRevisions[0]!.id)
    expect(ui.text()).toContain(h.record().baselines[0]!.id)
  })
  it('invalidates a displayed summary on a newer edit and requires explicit review after saving', async () => {
    const h = await setup({ included: true }); const ui = h.ui(); await ui.settle(); const old = ui.one('confirm-scope')
    ui.fire('requirement-title', 'onChange', { value: '新版本待保存' }); ui.render()
    expect(ui.all('confirmation-summary')).toHaveLength(0); expect(ui.one('save-requirements').props.disabled).toBe(false)
    old.props.onClick(); await ui.settle(); expect(h.commands).toHaveLength(0)
    ui.click('save-requirements'); await ui.settle(); expect(ui.text(ui.one('confirm-scope'))).toBe('核对本期范围')
    ui.clickText('核对本期范围'); ui.render(); expect(ui.text(ui.one('confirmation-summary'))).toContain('确认摘要已准备')
    ui.click('confirm-scope'); await ui.settle(); expect(h.commands.map(c => c.payload.kind)).toEqual(['requirement.update', 'baseline.publish', 'prd.render'])
  })
  it('retains local drafts on project-switch refusal and discards only after a named native confirmation', async () => {
    const h = await setup(); const ui = h.ui(); await ui.settle(); ui.fire('requirement-title', 'onChange', { value: '要保留的修改' }); ui.render()
    ui.clickText('合成研究二'); await ui.settle(); expect(h.store.getSnapshot().selectedProjectId).toBe(SMALL_PROJECT_ID)
    expect(ui.one('requirement-title').props.value).toBe('要保留的修改'); expect(ui.text()).toContain('请先保存或放弃当前项目的修改')
    ui.click('discard-drafts'); ui.render(); expect(ui.one('discard-dialog').type).toBe('dialog'); expect(ui.text(ui.one('discard-dialog'))).toContain('仅放弃本地未保存或被拒绝的修改')
    ui.clickText('取消放弃'); ui.render(); expect(h.store.getSnapshot().dirty).toBe(true)
    ui.click('discard-drafts'); ui.render(); ui.click('confirm-discard'); await ui.settle()
    expect(h.commands).toHaveLength(0); expect(h.store.getSnapshot().dirty).toBe(false)
    ui.clickText('合成研究二'); await ui.settle(); expect(h.store.getSnapshot().selectedProjectId).toBe(OTHER_PROJECT_ID)
  })
  it('keeps named delete cancellation/failure and consumes accepted null deletion without fetching the tombstone', async () => {
    const h = await setup(); const ui = h.ui(); await ui.settle(); ui.click('delete-project'); ui.render()
    expect(ui.one('delete-dialog').type).toBe('dialog'); expect(ui.text(ui.one('delete-dialog'))).toContain('合成研究一')
    ui.clickText('取消删除'); ui.render(); expect(h.commands).toHaveLength(0)
    h.intercept(async (endpoint, _input, next) => endpoint === 'projects.command' ? { ok: false, error: { code: 'internal', message: 'DELETE_PRIVATE_CANARY', details: {} } } : next())
    ui.click('delete-project'); ui.render(); ui.click('confirm-delete'); await ui.settle()
    expect(ui.text()).toContain('工作台暂时无法连接'); expect(ui.text()).not.toContain('DELETE_PRIVATE_CANARY'); expect(h.store.getSnapshot().selectedProjectId).toBe(SMALL_PROJECT_ID)
    expect(ui.text(ui.one('delete-dialog'))).toContain('工作台暂时无法连接')
    expect(ui.all('discard-drafts').every(node => node.props.disabled)).toBe(true)
    ui.clickText('返回工作台'); ui.render()
    h.intercept(); ui.click('retry-uncertain'); await ui.settle()
    expect(h.commands[1]).toEqual(h.commands[0]); expect(h.store.getSnapshot().selectedProjectId).toBeUndefined(); expect(ui.all('delete-dialog')).toHaveLength(0)
    expect(h.store.getSnapshot().projects.map(p => p.id)).not.toContain(SMALL_PROJECT_ID)
  })
  it('recovers an accepted baseline after read-back failure without publishing twice', async () => {
    const h = await setup({ included: true }); const ui = h.ui(); await ui.settle()
    h.intercept(async (endpoint, _input, next) => endpoint === 'projects.get' ? { ok: false, error: { code: 'internal', message: 'PRIVATE', details: {} } } : next())
    ui.click('confirm-scope'); await ui.settle(); expect(h.store.getSnapshot().baselineChain).toBeDefined()
    expect(ui.text()).toContain('基线已确认，PRD 尚未完成，请刷新继续'); expect(ui.all('discard-drafts').every(node => node.props.disabled)).toBe(true)
    h.intercept(); ui.click('refresh-project'); await ui.settle()
    expect(h.commands.map(c => c.payload.kind)).toEqual(['baseline.publish', 'prd.render']); expect(ui.all('prd-preview')).toHaveLength(1)
    ui.click('refresh-project'); await ui.settle(); expect(h.commands).toHaveLength(2)
  })
  it('shows drafting progress instead of advising refresh while PRD generation is still running', async () => {
    const h = await setup({ included: true }), gate = deferred(); const ui = h.ui(); await ui.settle()
    h.intercept(async (endpoint, input, next) => {
      if (endpoint === 'projects.command' && (input as Stage3aProjectCommand).payload.kind === 'prd.render') await gate.promise
      return next()
    })
    ui.click('confirm-scope')
    try {
      await vi.waitFor(() => { ui.render(); expect(h.commands.some(command => command.payload.kind === 'prd.render')).toBe(true) })
      expect(ui.text()).toContain('正在根据已确认范围起草 PRD')
      expect(ui.text()).not.toContain('请刷新继续')
      expect(ui.one('regenerate-prd').props.disabled).toBe(true)
    } finally { gate.resolve() }
    await ui.settle()
    expect(ui.all('prd-preview')).toHaveLength(1)
  })
  it('exactly retries uncertain rendering then selects its accepted revision without another render', async () => {
    const h = await setup({ included: true }); const ui = h.ui(); await ui.settle()
    h.intercept(async (endpoint, input, next) => { const value = await next(); if (endpoint === 'projects.command' && (input as Stage3aProjectCommand).payload.kind === 'prd.render') throw new Error('lost'); return value })
    ui.click('confirm-scope'); await ui.settle(); const retry = h.store.getSnapshot().pendingRetry
    ui.click('step-1'); ui.render()
    expect(retry?.payload.kind).toBe('prd.render'); expect(ui.text()).toContain('结果待确认')
    for (const marker of ['requirement-title', 'requirement-pain-point', 'requirement-description', 'human-reason', 'requirement-order']) expect(ui.one(marker).props.disabled, marker).toBe(true)
    for (const marker of ['priority', 'decision']) expect(ui.one(marker).children.filter(child => typeof child !== 'string').every(child => typeof child !== 'string' && child.props.disabled), marker).toBe(true)
    ui.click('refresh-project'); await ui.settle(); expect(h.store.getSnapshot().pendingRetry).toBe(retry)
    expect(ui.one('confirm-scope').props.disabled).toBe(true)
    h.intercept(); ui.click('retry-uncertain'); await ui.settle()
    expect(h.commands.map(c => c.payload.kind)).toEqual(['baseline.publish', 'prd.render', 'prd.render']); expect(h.commands[2]).toEqual(h.commands[1])
    expect(h.record().prdRevisions).toHaveLength(1); expect(ui.all('prd-preview')).toHaveLength(1)
  })
  it('regenerates the saved baseline once on double-click and retains the previous PRD', async () => {
    const h = await setup({ included: true }), ui = h.ui(); await ui.settle()
    ui.click('confirm-scope'); await ui.settle()
    const original = structuredClone(h.record().prdRevisions[0]!), count = h.commands.length, gate = deferred()
    h.intercept(async (endpoint, input, next) => {
      if (endpoint === 'projects.command' && (input as Stage3aProjectCommand).payload.kind === 'prd.render') await gate.promise
      return next()
    })
    ui.click('regenerate-prd'); ui.click('regenerate-prd')
    try {
      await vi.waitFor(() => expect(h.commands.length).toBe(count + 1))
      expect(h.commands.at(-1)!.payload).toMatchObject({ kind: 'prd.render', baselineId: original.baselineId })
    } finally { gate.resolve() }
    await ui.settle()
    expect(h.record().prdRevisions).toHaveLength(2)
    expect(h.record().prdRevisions[0]).toEqual(original)
    expect(h.store.getSnapshot().selectedPrdRevisionId).toBe(h.record().prdRevisions[1]!.id)
  })
  it('requires a newly displayed confirmation after baseline-stale and keeps stale PRD selectable and export-bound', async () => {
    const h = await setup({ included: true }); const ui = h.ui(); await ui.settle(); ui.click('confirm-scope'); await ui.settle()
    const first = h.record().prdRevisions[0]!
    ui.click('step-1'); ui.render()
    ui.fire('human-reason', 'onChange', { value: '调整需求的理由' }); ui.render(); ui.click('save-requirements'); await ui.settle()
    ui.click('step-2'); ui.render(); expect(ui.text()).toContain('需求已调整，此 PRD 保留的是上次确认的内容')
    ui.click('step-1'); ui.render(); ui.clickText('核对本期范围'); ui.render(); ui.click('confirm-scope'); await ui.settle()
    const second = h.record().prdRevisions[1]!; expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(second.id)
    ui.all('prd-history-item').find(node => node.props['data-prd-revision-id'] === first.id)!.props.onClick(); await ui.settle()
    await h.store.copySelectedMarkdown(); ui.click('download-prd'); await ui.settle()
    expect(h.clipboard).toEqual([first.markdown]); expect(h.blobs[0]!.type).toBe('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    expect(h.downloads).toEqual([{ url: 'owned-test-url', name: `prd-${first.id}.docx` }]); expect(h.revoked).toEqual(['owned-test-url'])
    expect(ui.text(ui.one('prd-markdown'))).toBe(first.markdown)
    const pending = deferred(); const entered = deferred()
    h.intercept(async (endpoint, input, next) => { const value = await next(); if (endpoint === 'artifacts.getMarkdown' && (input as any).prdRevisionId === first.id) { entered.resolve(); await pending.promise } return value })
    ui.all('prd-history-item').find(node => node.props['data-prd-revision-id'] === first.id)!.props.onClick(); await entered.promise
    ui.all('prd-history-item').find(node => node.props['data-prd-revision-id'] === second.id)!.props.onClick()
    await ui.settle(() => ui.all('prd-preview')[0]?.props['data-prd-revision-id'] === second.id); pending.resolve(); await ui.settle()
    expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(second.id)
    h.store.close(); ui.render(); await h.store.open(); await ui.settle(); expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(second.id)
  })
  it('does not create a rejected baseline queue when no requirement is included', async () => {
    const h = await setup(); const ui = h.ui(); await ui.settle()
    expect(ui.one('confirm-scope').props.disabled).toBe(true)
    ui.click('confirm-scope'); await ui.settle(); expect(h.commands).toHaveLength(0)
    expect(ui.text()).toContain('请至少选择一项纳入本期的需求并保存修改')
    ui.clickTextStartingWith('纳入本期'); ui.render(); ui.click('save-requirements'); await ui.settle()
    ui.clickText('核对本期范围'); ui.render(); expect(ui.one('confirm-scope').props.disabled).toBe(false)
  })
  it('keeps discard unavailable during a material read, queued save, and accepted-but-unread save', async () => {
    const h = await setup({ empty: true }); const ui = h.ui(); await ui.settle(); ui.click('load-fixture'); await ui.settle()
    const gate = deferred<ArrayBuffer>(); const bytes = new TextEncoder().encode('新的合成材料')
    ui.fire('material-file', 'onChange', { files: [{ name: 'new.txt', type: 'text/plain', size: bytes.length, arrayBuffer: () => gate.promise }] }); ui.render()
    expect(ui.all('discard-drafts').every(node => node.props.disabled)).toBe(true)
    gate.resolve(bytes.buffer); await ui.settle(); expect(ui.all('discard-drafts')).toHaveLength(1)
    ui.click('discard-drafts'); ui.render(); ui.click('confirm-discard'); await ui.settle()
    ui.click('load-fixture'); await ui.settle(); ui.fire('data-use-attestation', 'onChange', { checked: true }); ui.render()
    const entered = deferred(); const wait = deferred()
    h.intercept(async (endpoint, _input, next) => { if (endpoint === 'projects.command') { entered.resolve(); await wait.promise }; return next() })
    ui.click('save-material'); await entered.promise; ui.render(); expect(ui.all('discard-drafts').every(node => node.props.disabled)).toBe(true)
    h.intercept(async (endpoint, _input, next) => endpoint === 'projects.get' ? { ok: false, error: { code: 'internal', message: 'private', details: {} } } : next())
    wait.resolve(); await ui.settle(); expect(h.store.getSnapshot().acceptedVersionFloor).toBe(2)
    expect(ui.all('discard-drafts').every(node => node.props.disabled)).toBe(true)
    expect(ui.all('save-requirements')).toHaveLength(0)
    expect(vi.spyOn(h.store, 'flushProjectEdits')).not.toHaveBeenCalled()
  })
  it('invalidates an externally stale baseline and sends no second publication until new visible review', async () => {
    const h = await setup({ included: true }); const ui = h.ui(); await ui.settle(); let changed = false
    h.intercept(async (endpoint, input, next) => {
      const value = await next()
      if (!changed && endpoint === 'projects.command' && (input as Stage3aProjectCommand).payload.kind === 'baseline.publish') {
        changed = true; await h.external({ kind: 'requirement.update', requirementId: h.record().requirementOrder[0]!, title: '外部更新的标题' })
      }
      return value
    })
    ui.click('confirm-scope'); await ui.settle()
    expect(h.commands.map(c => c.payload.kind)).toEqual(['baseline.publish']); expect(h.store.getSnapshot().baselineChain).toBeUndefined()
    expect(ui.all('confirmation-summary')).toHaveLength(0); expect(ui.text(ui.one('confirm-scope'))).toBe('核对本期范围')
    ui.click('refresh-project'); await ui.settle(); expect(h.commands).toHaveLength(1)
    ui.clickText('核对本期范围'); ui.render(); expect(ui.all('confirmation-summary')).toHaveLength(1)
    ui.click('confirm-scope'); await ui.settle(); expect(h.commands.map(c => c.payload.kind)).toEqual(['baseline.publish', 'baseline.publish', 'prd.render'])
  })
  it('ignores material and PRD errors from closed or superseded selections', async () => {
    const h = await setup({ empty: true }); const ui = h.ui(); await ui.settle()
    const pending = deferred<ArrayBuffer>()
    ui.fire('material-file', 'onChange', { files: [{ name: 'old.txt', type: 'text/plain', size: 1, arrayBuffer: () => pending.promise }] })
    ui.clickText('合成研究二'); await ui.settle(); pending.resolve(new Uint8Array([0xff]).buffer); await ui.settle()
    expect(ui.text()).not.toContain('材料读取失败'); expect(h.store.getSnapshot().materialDraft).toBeUndefined()
  })
  it('checks complete Product metadata across named dialogs, evidence, errors and verified Markdown', async () => {
    const h = await setup({ included: true }); await h.external({ kind: 'requirement.update', requirementId: h.record().requirementOrder[0]!, title: 'TITLE_CANARY', painPoint: 'PAIN_CANARY', description: 'DESC_CANARY', humanReason: 'REASON_CANARY' })
    await h.store.refresh(); const ui = h.ui(); await ui.settle()
    const seen = new Set<string>()
    const allowed = new Set(['data-project-id', 'data-requirement-id', 'data-evidence-id', 'data-source-revision-id', 'data-quote-start', 'data-quote-end', 'data-quote-hash',
      'data-confirmation-project-version', 'data-confirmation-content-version', 'data-prd-revision-id', 'data-baseline-id', 'data-prd-hash', 'data-prd-current'])
    function check() {
      for (const node of ui.nodes()) {
        const marker = node.props['data-dsh-pm-workbench']; if (marker) seen.add(marker)
        for (const [key, value] of Object.entries(node.props)) {
          if (key === 'title' || key === 'hidden' || key === 'aria-label') expect(value).toBeUndefined()
          if (key.startsWith('data-') && key !== 'data-dsh-pm-workbench' && value !== undefined) {
            expect(allowed.has(key), key).toBe(true)
            expect(String(value)).toMatch(/^(?:[0-9a-f-]{36}|[0-9a-f]{64}|true|false|\d+)$/)
          }
          if (key.startsWith('aria-') || key.startsWith('data-') || key === 'title') expect(String(value)).not.toContain('CANARY')
        }
      }
      for (const marker of seen) if (!['requirement-card', 'requirement-title', 'requirement-pain-point', 'requirement-description', 'priority', 'decision', 'human-reason', 'requirement-order',
        'evidence', 'evidence-context', 'evidence-quote', 'prd-history-item'].includes(marker)) expect(ui.all(marker).length).toBeLessThanOrEqual(1)
    }
    check(); ui.click('step-0'); ui.render(); check(); ui.click('step-1'); ui.render()
    ui.click('new-project'); ui.render(); ui.fire('project-name', 'onChange', { value: 'PROJECT_CANARY' }); ui.fire('research-goal', 'onChange', { value: 'GOAL_CANARY' }); ui.render(); check()
    ui.clickText('取消新建'); ui.render(); ui.click('delete-project'); ui.render(); check(); ui.clickText('取消删除'); ui.render()
    ui.click('confirm-scope'); await ui.settle(); check()
    ui.click('step-1'); ui.render()
    ui.fire('human-reason', 'onChange', { value: 'NEW_REASON_CANARY' }); ui.render(); ui.click('discard-drafts'); ui.render(); check()
    for (const marker of ['create-dialog', 'create-data-use-attestation', 'confirm-create', 'project-name', 'research-goal', 'delete-dialog', 'confirm-delete',
      'discard-dialog', 'confirm-discard', 'source-text', 'evidence-context', 'evidence-quote', 'confirmation-summary', 'prd-preview', 'prd-history-item', 'prd-markdown', 'baseline-trace']) expect(seen.has(marker), marker).toBe(true)
  })
  it('constructs the default public connection client lazily and cleans its temporary download anchor through the port', async () => {
    const h = await setup({ included: true }); const { ctx, live } = context([])
    ctx.connection.rpc.call = h.call
    const commandIds: string[] = []; const originalCrypto = globalThis.crypto
    vi.stubGlobal('crypto', { subtle: originalCrypto.subtle, randomUUID: () => { const id = `90000000-0000-4000-8000-${(4000 + commandIds.length).toString(16).padStart(12, '0').toUpperCase()}`; commandIds.push(id); return id } })
    const before = h.reads.length; const dispose = mountWorkbenchClient(ctx)
    expect(h.reads).toHaveLength(before)
    const ui = new ComponentHarness(<>{createElement(live.get('pm-workbench-product-launcher')!)}{createElement(live.get('pm-workbench-product-overlay')!)}</>)
    ui.click('launcher'); await ui.settle()
    expect(ui.text()).toContain('人工最终标题')
    ui.clickText('合成研究一'); await ui.settle(); ui.click('confirm-scope'); await ui.settle()
    expect(h.commands.map(c => c.commandId)).toEqual(commandIds.map(id => id.toLowerCase()))
    const anchor = { href: '', download: '', click: vi.fn(), remove: vi.fn() }; const append = vi.fn()
    Object.assign(ui.document, { createElement: (name: string) => { expect(name).toBe('a'); return anchor }, body: { append } })
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('owned-dom-url'); const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    ui.click('download-prd'); await ui.settle()
    expect(create).toHaveBeenCalledTimes(1); expect(append).toHaveBeenCalledWith(anchor); expect(anchor.click).toHaveBeenCalledTimes(1)
    expect(anchor.remove).toHaveBeenCalledTimes(1); expect(revoke).toHaveBeenCalledExactlyOnceWith('owned-dom-url')
    expect(anchor.download).toBe(`prd-${h.record().prdRevisions[0]!.id}.docx`)
    dispose()
  })
  it('allows safe local discard after a known rejected delete, then permits switching without another command', async () => {
    const h = await setup(); const ui = h.ui(); await ui.settle()
    h.intercept(async (endpoint, input, next) => endpoint === 'projects.command' ? { ok: true, value: {
      status: 'rejected', projectId: (input as Stage3aProjectCommand).projectId, commandId: (input as Stage3aProjectCommand).commandId, error: { code: 'storage-failed' },
    } } : next())
    ui.click('delete-project'); ui.render(); ui.click('confirm-delete'); await ui.settle()
    expect(h.store.getSnapshot().saveState).toBe('failed'); ui.clickText('取消删除'); ui.render()
    ui.click('discard-drafts'); ui.render(); ui.click('confirm-discard'); await ui.settle()
    expect(h.commands).toHaveLength(1); expect(h.store.getSnapshot().saveState).toBe('saved')
    ui.clickText('合成研究二'); await ui.settle(); expect(h.store.getSnapshot().selectedProjectId).toBe(OTHER_PROJECT_ID)
  })
  it('shows creation failures inside the active native dialog and makes uncertainty return to exact retry', async () => {
    const h = await setup({ empty: true }); const ui = h.ui(); await ui.settle()
    h.intercept(async (endpoint, _input, next) => endpoint === 'projects.command' ? { ok: false, error: { code: 'internal', message: 'RAW_CREATE_CANARY', details: {} } } : next())
    ui.click('new-project'); ui.render(); ui.fire('project-name', 'onChange', { value: '仅供测试' }); ui.fire('create-data-use-attestation', 'onChange', { checked: true }); ui.render()
    ui.click('confirm-create'); await ui.settle()
    expect(ui.text(ui.one('create-dialog'))).toContain('工作台暂时无法连接'); expect(ui.text()).not.toContain('RAW_CREATE_CANARY')
    expect(ui.one('confirm-create').props.disabled).toBe(true)
    ui.clickText('返回工作台'); ui.render(); expect(ui.one('retry-uncertain')).toBeDefined()
  })
  it('keeps the old confirmation invalid after discard restores the same authoritative object', async () => {
    const h = await setup({ included: true }); const ui = h.ui(); await ui.settle()
    const authoritative = h.store.getSnapshot().selectedProject
    ui.fire('requirement-title', 'onChange', { value: '随后放弃的修改' }); ui.render()
    ui.click('discard-drafts'); ui.render(); ui.click('confirm-discard'); await ui.settle()
    expect(h.store.getSnapshot().selectedProject).toBe(authoritative)
    expect(ui.all('confirmation-summary')).toHaveLength(0); expect(ui.text(ui.one('confirm-scope'))).toBe('核对本期范围')
    ui.click('confirm-scope'); await ui.settle(); expect(h.commands).toHaveLength(0); expect(ui.all('confirmation-summary')).toHaveLength(1)
    ui.click('confirm-scope'); await ui.settle(); expect(h.commands.map(c => c.payload.kind)).toEqual(['baseline.publish', 'prd.render'])
  })
  it('keeps each material keystroke visible while hashing and admits only the latest exact verified draft', async () => {
    const h = await setup({ empty: true }); const old = await readMaterialDraft({ kind: 'paste', text: '此前校验的合成文本', displayName: 'old.txt' })
    h.store.setMaterialDraft(old, false); const ui = h.ui(); await ui.settle()
    const gates = [deferred(), deferred()]; let count = 0
    const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle)
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementation(async (algorithm, data) => { await gates[count++]?.promise; return digest(algorithm, data) })
    const reads = vi.spyOn(materialInput, 'readMaterialDraft')
    ui.fire('material-input', 'onChange', { value: '第一段正在输入的合成文字' }); ui.render()
    expect.soft(ui.one('material-input').props.value).toBe('第一段正在输入的合成文字')
    expect(ui.one('material-input').props.disabled).toBe(false)
    ui.fire('material-input', 'onChange', { value: BUILT_IN_SYNTHETIC_TEXT }); ui.render()
    expect.soft(ui.one('material-input').props.value).toBe(BUILT_IN_SYNTHETIC_TEXT)
    expect(ui.one('save-material').props.disabled).toBe(true)
    gates[0]!.resolve(); await reads.mock.results[0]!.value; ui.render()
    expect(h.store.getSnapshot().materialDraft).toBe(old)
    expect.soft(ui.one('material-input').props.value).toBe(BUILT_IN_SYNTHETIC_TEXT)
    expect(ui.one('save-material').props.disabled).toBe(true)
    gates[1]!.resolve(); const latest = await reads.mock.results[1]!.value; await ui.settle()
    expect(h.store.getSnapshot().materialDraft).toBe(latest); expect(latest.text).toBe(BUILT_IN_SYNTHETIC_TEXT)
    expect(ui.one('data-use-attestation').props.checked).toBe(false)
    ui.fire('data-use-attestation', 'onChange', { checked: true }); ui.render(); expect(ui.one('save-material').props.disabled).toBe(false)
    ui.click('save-material'); await ui.settle()
    expect(h.commands).toHaveLength(1); expect(h.commands[0]!.payload).toMatchObject({ kind: 'source.importText', text: BUILT_IN_SYNTHETIC_TEXT })
    expect(ui.text(ui.one('source-text'))).toBe(BUILT_IN_SYNTHETIC_TEXT)
  })
  it('refuses a previously enabled material save handler immediately after a new visible edit starts', async () => {
    const h = await setup({ empty: true }); const draft = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'old.txt' })
    h.store.setMaterialDraft(draft, true); const ui = h.ui(); await ui.settle(); const staleSave = ui.one('save-material').props.onClick
    const gate = deferred(); const digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle)
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementationOnce(async (algorithm, data) => { await gate.promise; return digest(algorithm, data) })
    const importing = vi.spyOn(h.store, 'importMaterial')
    ui.fire('material-input', 'onChange', { value: '新输入尚未校验' }); staleSave()
    expect.soft(importing).not.toHaveBeenCalled()
    gate.resolve(); await ui.settle(); expect(h.commands).toHaveLength(0)
  })
  it('retains failed material text visibly and refuses saving the older verified draft underneath it', async () => {
    const h = await setup({ empty: true }); const draft = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'old.txt' })
    h.store.setMaterialDraft(draft, true); const ui = h.ui(); await ui.settle()
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockRejectedValueOnce(new Error('HASH_PRIVATE_CANARY'))
    ui.fire('material-input', 'onChange', { value: '校验失败但应保留的可见合成文字' }); await ui.settle()
    expect.soft(ui.one('material-input').props.value).toBe('校验失败但应保留的可见合成文字')
    expect.soft(ui.one('save-material').props.disabled).toBe(true)
    expect(h.store.getSnapshot().materialDraft).toBe(draft)
    expect(ui.text()).toContain('材料读取失败，请检查 Word、TXT 或 Markdown 文件；文本请使用 UTF-8 编码，Word 文件请勿加密'); expect(ui.text()).not.toContain('HASH_PRIVATE_CANARY')
    ui.click('save-material'); await ui.settle(); expect(h.commands).toHaveLength(0)
  })
  it('does not let an older refresh recovery replace a later historical PRD selection', async () => {
    const h = await withPrdHistory(); const { ui, first, second } = h
    expect(h.store.getSnapshot().acceptedReceipt?.value.prdRevisionId).toBe(second.id)
    const entered = deferred(), gate = deferred(); let delayed = false
    h.intercept(async (endpoint, _input, next) => { const value = await next(); if (endpoint === 'projects.get' && !delayed) { delayed = true; entered.resolve(); await gate.promise }; return value })
    const refresh = vi.spyOn(h.store, 'refresh')
    ui.click('refresh-project'); await entered.promise
    const refreshing = refresh.mock.results[0]!.value
    ui.all('prd-history-item').find(node => node.props['data-prd-revision-id'] === first.id)!.props.onClick()
    await ui.settle(() => ui.all('prd-preview')[0]?.props['data-prd-revision-id'] === first.id)
    gate.resolve(); await refreshing; await ui.settle()
    expect(h.store.getSnapshot().selectedPrdRevisionId).toBe(first.id)
    expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(first.id); expect(ui.text(ui.one('prd-markdown'))).toBe(first.markdown)
    await h.store.copySelectedMarkdown(); ui.click('download-prd'); await ui.settle()
    expect(h.clipboard).toEqual([first.markdown]); expect(await h.blobs[0]!.text()).toContain(first.baselineId)
    expect(h.downloads[0]!.name).toBe(`prd-${first.id}.docx`)
  })
  it.each(['download-prd'] as const)('ignores a delayed %s failure after the user selects another PRD', async marker => {
    const entered = deferred(), gate = deferred()
    const fail = async () => { entered.resolve(); await gate.promise; throw new Error('EXPORT_PRIVATE_CANARY') }
    const h = await withPrdHistory({ clickDownload: fail })
    const { ui, first } = h
    const exporting = vi.spyOn(h.store, 'downloadSelectedMarkdown')
    ui.click(marker); await entered.promise; const completion = exporting.mock.results[0]!.value
    ui.all('prd-history-item').find(node => node.props['data-prd-revision-id'] === first.id)!.props.onClick()
    await ui.settle(() => ui.all('prd-preview')[0]?.props['data-prd-revision-id'] === first.id)
    gate.resolve(); await completion; await ui.settle()
    expect(ui.nodes().filter(node => node.props.role === 'alert')).toHaveLength(0)
    expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(first.id); expect(ui.text(ui.one('prd-markdown'))).toBe(first.markdown)
    expect(ui.text()).not.toContain('EXPORT_PRIVATE_CANARY')
  })
  it('does not let an old successful download clear a newer selected-PRD export error', async () => {
    const entered = deferred(), gate = deferred()
    let downloads = 0
    const h = await withPrdHistory({ clickDownload: async () => { if (++downloads === 1) { entered.resolve(); await gate.promise } else throw new Error('DOWNLOAD_PRIVATE_CANARY') } })
    const { ui, first } = h; const downloading = vi.spyOn(h.store, 'downloadSelectedMarkdown')
    ui.click('download-prd'); await entered.promise; const oldDownload = downloading.mock.results[0]!.value
    ui.all('prd-history-item').find(node => node.props['data-prd-revision-id'] === first.id)!.props.onClick()
    await ui.settle(() => ui.all('prd-preview')[0]?.props['data-prd-revision-id'] === first.id)
    ui.click('download-prd'); await ui.settle(() => ui.text().includes('工作台暂时无法连接'))
    gate.resolve(); await oldDownload; await ui.settle()
    expect(ui.text()).toContain('工作台暂时无法连接'); expect(ui.text()).not.toContain('DOWNLOAD_PRIVATE_CANARY')
    expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(first.id)
  })
  it('ignores the actual first opening completion after close and a successful newer reopen', async () => {
    const h = await setup(); h.store.close(); const { ctx, live } = context([]); const dispose = mountWorkbenchClient(ctx, h.store)
    const ui = new ComponentHarness(<>{createElement(live.get('pm-workbench-product-launcher')!)}{createElement(live.get('pm-workbench-product-overlay')!)}</>)
    const entered = deferred(), gate = deferred(); let delayed = false
    h.intercept(async (endpoint, _input, next) => { if (endpoint === 'projects.get' && !delayed) { delayed = true; entered.resolve(); await gate.promise }; return next() })
    const opening = vi.spyOn(h.store, 'open')
    ui.click('launcher'); await entered.promise; const firstOpening = opening.mock.results[0]!.value; ui.render()
    ui.click('close'); ui.render(); ui.click('launcher'); await opening.mock.results[1]!.value; await ui.settle()
    expect(ui.all('overlay')).toHaveLength(1); expect(ui.nodes().filter(node => node.props.role === 'alert')).toHaveLength(0)
    gate.resolve(); await firstOpening; await ui.settle()
    expect(ui.nodes().filter(node => node.props.role === 'alert')).toHaveLength(0)
    expect(ui.all('overlay')).toHaveLength(1); expect(h.store.getSnapshot().isOpen).toBe(true)
    dispose()
  })
  it.each(['save-material', 'data-use-attestation'] as const)('refuses retained %s handlers from an unmounted material pane after reopen', async marker => {
    const h = await setup({ empty: true }); const draft = await readMaterialDraft({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'old.txt' })
    h.store.setMaterialDraft(draft, true); const ui = h.ui(); await ui.settle()
    expect(ui.one('save-material').props.disabled).toBe(false)
    const old = ui.one(marker), event = marker === 'save-material' ? 'onClick' : 'onChange'
    ui.click('close'); ui.render(); expect(ui.all('material-input')).toHaveLength(0)
    await h.store.open(); await ui.settle()
    const gate = deferred(), digest = globalThis.crypto.subtle.digest.bind(globalThis.crypto.subtle)
    vi.spyOn(globalThis.crypto.subtle, 'digest').mockImplementationOnce(async (algorithm, data) => { await gate.promise; return digest(algorithm, data) })
    const reading = vi.spyOn(materialInput, 'readMaterialDraft'), importing = vi.spyOn(h.store, 'importMaterial')
    ui.fire('material-input', 'onChange', { value: '重新打开后正在输入的新合成材料' }); ui.render()
    expect(ui.one('material-input').props.value).toBe('重新打开后正在输入的新合成材料')
    old.props[event]({ currentTarget: { checked: false } })
    expect.soft(importing).not.toHaveBeenCalled()
    expect.soft(h.store.getSnapshot().importAttested).toBe(true)
    await Promise.all(importing.mock.results.map(result => result.value))
    gate.resolve(); await reading.mock.results[0]!.value; await ui.settle()
    expect(h.commands).toHaveLength(0); expect(h.record().source).toBeNull()
    expect(h.store.getSnapshot().materialDraft?.text).toBe('重新打开后正在输入的新合成材料')
    expect(ui.one('material-input').props.value).toBe('重新打开后正在输入的新合成材料')
  })
  it.each(['download-prd'] as const)('keeps a newer source-read error when an older %s succeeds on the same PRD', async marker => {
    const entered = deferred(), gate = deferred()
    const exporting = async () => { entered.resolve(); await gate.promise }
    const h = await withPrdHistory({ clickDownload: exporting })
    const { ui, second } = h
    const completion = vi.spyOn(h.store, 'downloadSelectedMarkdown')
    ui.click(marker); await entered.promise
    h.intercept(async (endpoint, _input, next) => endpoint === 'sources.get' ? { ok: false, error: { code: 'internal', message: 'NEW_SOURCE_PRIVATE_CANARY', details: {} } } : next())
    ui.click('step-1'); ui.render(); ui.clickText('查看全部原文'); await ui.settle(() => ui.text().includes('工作台暂时无法连接'))
    gate.resolve(); await completion.mock.results[0]!.value; await ui.settle()
    ui.click('step-2'); ui.render()
    expect(ui.text()).toContain('工作台暂时无法连接'); expect(ui.text()).not.toContain('NEW_SOURCE_PRIVATE_CANARY')
    expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(second.id)
  })
  it.each(['download-prd'] as const)('ignores an older %s failure after a newer source read succeeds on the same PRD', async marker => {
    const entered = deferred(), gate = deferred()
    const exporting = async () => { entered.resolve(); await gate.promise; throw new Error('OLD_EXPORT_PRIVATE_CANARY') }
    const h = await withPrdHistory({ clickDownload: exporting })
    const { ui, second } = h
    const completion = vi.spyOn(h.store, 'downloadSelectedMarkdown'), source = vi.spyOn(h.store, 'loadSource')
    ui.click(marker); await entered.promise; ui.click('step-1'); ui.render(); ui.clickText('查看全部原文'); await source.mock.results[0]!.value; ui.render()
    expect(ui.nodes().filter(node => node.props.role === 'alert')).toHaveLength(0)
    gate.resolve(); await completion.mock.results[0]!.value; await ui.settle()
    ui.click('step-2'); ui.render()
    expect(ui.nodes().filter(node => node.props.role === 'alert')).toHaveLength(0); expect(ui.text()).not.toContain('OLD_EXPORT_PRIVATE_CANARY')
    expect(ui.one('prd-preview').props['data-prd-revision-id']).toBe(second.id)
  })
})
