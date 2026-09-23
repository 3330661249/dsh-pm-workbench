import { renderToStaticMarkup } from 'react-dom/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ValidationPane, ValidationRunResults } from '../../packages/workbench/src/client/workbench/ValidationPane.js'
import type { WorkbenchState } from '../../packages/workbench/src/client/workbench/store.js'
import type { ValidationSnapshot } from '../../packages/workbench/src/client/workbench/validation-client.js'
import { projectViewOf } from '../../packages/workbench/src/application/project-views.js'
import { makeSmallActiveRecord } from './helpers/synthetic-records.js'
import { makeValidationTask, validationRun } from './helpers/validation-fixtures.js'

const external = vi.hoisted(() => ({ snapshot: { tasks: [] } as ValidationSnapshot }))
vi.mock('react', async original => ({ ...await original<typeof import('react')>(), useSyncExternalStore: () => external.snapshot }))
const project = projectViewOf(makeSmallActiveRecord())
const state: WorkbenchState = { isOpen: true, projects: [project.header], selectedProjectId: project.header.id, selectedProject: project,
  drafts: [], dirtyRevision: 0, savedDraftRevision: 0, dirty: false, saveState: 'saved', acceptedVersionFloor: project.header.projectVersion,
  importAttested: false, materialDirty: false }
const request = vi.fn()
const render = (stage: 'validation' | 'handoff' = 'validation') => renderToStaticMarkup(<ValidationPane state={state} client={{ request }} stage={stage}
  onStage={() => {}} onReview={() => {}} onSelectPrd={() => {}} onDownloadPrd={() => {}} />)
beforeEach(() => { external.snapshot = { tasks: [] }; request.mockClear() })

describe('validation and handoff workspace presentation', () => {
  it('separates creation, record history and the creation footer without sending model requests', () => {
    const html = render()
    expect(html).toContain('<div class="pmwb-validation-workspace">')
    expect(html).toContain('<aside class="pmwb-validation-history" aria-label="验证记录">')
    expect(html).toContain('<footer class="pmwb-validation-footer">')
    expect(html).toContain('将所选需求和 PRD 发送给当前 Harness 模型')
    expect(html.match(/<button[^>]+data-dsh-pm-workbench="validation-create"[^>]*>/)?.[0]).toContain('disabled=""')
    expect(html.match(/class="pmwb-validation-mode"/g)).toHaveLength(3)
    expect(request).not.toHaveBeenCalled()
  })

  it('keeps plan consent and execution guards in selected record details', () => {
    const task = makeValidationTask()
    external.snapshot = { tasks: [task], selectedTaskId: task.id }
    const html = render()
    expect(html).toContain('我已核对所选 PRD 和验证计划，并允许将本次测试材料发送给当前 Harness 模型。')
    expect(html.match(/<button[^>]+data-dsh-pm-workbench="validation-confirm"[^>]*>/)?.[0]).toContain('disabled=""')
    expect(html.match(/<button[^>]+data-dsh-pm-workbench="validation-run"[^>]*>/)?.[0]).toContain('disabled=""')
    expect(html).toContain('验证计划')
    expect(html).toContain('刷新验证记录')
    expect(html).not.toContain('data-dsh-pm-workbench="validation-create"')
  })

  it('lists the passed scope and package contents before the guarded handoff footer', () => {
    const task = makeValidationTask({ status: 'judged', runs: [validationRun], verdict: { value: 'pass', note: '已核对', runId: validationRun.id, judgedAt: validationRun.completedAt! } })
    external.snapshot = { tasks: [task], selectedTaskId: task.id }
    const html = render('handoff')
    expect(html).toContain('<aside class="pmwb-validation-history" aria-label="已通过的验证">')
    expect(html).toContain('class="pmwb-handoff-scope"')
    expect(html).toContain('提炼有依据的需求')
    expect(html).toContain('class="pmwb-handoff-contents"')
    expect(html).toContain('未验证范围和风险')
    expect(html.match(/<button[^>]+data-dsh-pm-workbench="validation-handoff"[^>]*>/)?.[0]).toContain('disabled=""')
    expect(html).not.toContain('data-dsh-pm-workbench="download-handoff"')
    expect(request).not.toHaveBeenCalled()
  })
})


describe('structured validation results', () => {
  const renderActual = (actual: string) => renderToStaticMarkup(<ValidationRunResults mode="poc" run={{ ...validationRun,
    results: [{ ...validationRun.results[0]!, actual }] }} />)
  it('groups new model output and keeps the original JSON available safely', () => {
    const actual = JSON.stringify({ findings: [{ title: '数据不一致', detail: '<script>unsafe()</script>', evidence: ['数字不对'] }],
      followUps: [{ question: '请描述经历', reason: '场景不明', evidence: ['不好用'] }],
      inputGaps: [{ missingInput: '待比对引用', reason: '无法完成逐字比对' }] })
    const html = renderActual(actual)
    for (const label of ['业务发现', '待追问问题', '输入缺失说明', '查看原始输出', '请描述经历', '无法完成逐字比对']) expect(html).toContain(label)
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })
  it.each(['旧版纯文本', '{"summary":"旧结果","items":[]}', '<script>unsafe()</script>'])('preserves historical output without schema migration: %s', actual => {
    const html = renderActual(actual)
    expect(html).not.toContain('查看原始输出')
    expect(html).not.toContain('<script>')
    expect(html).toContain(actual.startsWith('<') ? '&lt;script&gt;' : actual.replaceAll('"', '&quot;'))
  })
})
