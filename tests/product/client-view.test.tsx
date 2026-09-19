import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { WorkbenchLauncher, WorkbenchView } from '../../packages/workbench/src/client/workbench/WorkbenchView.js'
import { PriorityPane } from '../../packages/workbench/src/client/workbench/PriorityPane.js'
import { PrdPane } from '../../packages/workbench/src/client/workbench/PrdPane.js'
import { ProjectList } from '../../packages/workbench/src/client/workbench/ProjectList.js'
import { ReviewWorkspace } from '../../packages/workbench/src/client/workbench/RequirementsPane.js'
import { launcherCss, workbenchCss } from '../../packages/workbench/src/client/workbench/styles.js'
import type { WorkbenchState, WorkbenchStore, ConfirmationSnapshot } from '../../packages/workbench/src/client/workbench/store.js'
import type { ProjectView } from '../../packages/workbench/src/application/project-views.js'
import { FIXTURE_MANIFEST, BUILT_IN_SYNTHETIC_HASH, BUILT_IN_SYNTHETIC_TEXT } from '../../packages/workbench/src/analysis/fixture-manifest.js'
import { baselineIdSchema, prdRevisionIdSchema, requirementRevisionIdSchema } from '../../packages/workbench/src/domain/ids.js'
import { makeSmallActiveRecord, SMALL_PROJECT_ID, OTHER_PROJECT_ID } from './helpers/synthetic-records.js'

const candidate = FIXTURE_MANIFEST.sources[BUILT_IN_SYNTHETIC_HASH]!.candidate
const generated = candidate.generatedRequirements[0]!
const header = { ...makeSmallActiveRecord().header, name: 'PROJECT_CANARY', researchGoal: 'GOAL_CANARY', projectVersion: 8, contentVersion: 7, reviewStarted: true }
const revision = { id: requirementRevisionIdSchema.parse('60000000-0000-4000-8000-000000000001'), requirementId: generated.requirementId,
  basedOnDraftId: generated.id, title: '人工最终标题 TITLE_CANARY', painPoint: 'PAIN_CANARY', description: 'DESCRIPTION_CANARY' }
const project: ProjectView = { header, source: { projectId: SMALL_PROJECT_ID, sourceRevisionId: candidate.analysis.sourceRevisionId, revision: 1,
  displayName: 'FILE_CANARY.txt', format: 'pasted', utf8Bytes: new TextEncoder().encode(BUILT_IN_SYNTHETIC_TEXT).length,
  contentHash: BUILT_IN_SYNTHETIC_HASH, syntheticDataAttested: true }, analysis: candidate.analysis,
  generatedRequirements: candidate.generatedRequirements, selectedHumanRevisions: [revision],
  humanDecisions: [{ requirementId: generated.requirementId, selectedText: { kind: 'human-revision', revisionId: revision.id }, priority: 'high', decision: 'include', humanReason: 'REASON_CANARY' }],
  requirementOrder: [generated.requirementId], evidence: candidate.evidence, currentBaseline: null, prdSummaries: [] }
const ready: WorkbenchState = { isOpen: true, projects: [header], selectedProjectId: SMALL_PROJECT_ID, selectedProject: project,
  selectedSource: { ...project.source!, text: BUILT_IN_SYNTHETIC_TEXT }, drafts: [], dirtyRevision: 0, savedDraftRevision: 0,
  dirty: false, saveState: 'saved', acceptedVersionFloor: 8, importAttested: false, materialDirty: false }
const token = (state: WorkbenchState): ConfirmationSnapshot => state.saveState === 'saved' && state.selectedProject
  ? Object.freeze({ ok: true, projectVersion: state.selectedProject.header.projectVersion, contentVersion: state.selectedProject.header.contentVersion, project: state.selectedProject })
  : { ok: false, reason: state.saveState === 'saved' ? 'unsaved' : state.saveState }
function staticStore(state = ready): WorkbenchStore {
  return { getSnapshot: () => state, subscribe: () => () => {}, getConfirmationSnapshot: () => token(state) } as unknown as WorkbenchStore
}
const render = (state = ready) => renderToStaticMarkup(<WorkbenchView store={staticStore(state)} />)
function tag(html: string, marker: string) { return html.match(new RegExp(`<[^>]+data-dsh-pm-workbench="${marker}"[^>]*>`))?.[0] ?? '' }
function dataNames(element: string) { return [...element.matchAll(/\b(data-[a-z-]+)=/g)].map(m => m[1]).filter(n => n !== 'data-dsh-pm-workbench').sort() }

describe('Product semantic markup', () => {
  it('renders a comparison list and evidence/decision panel with a separate review footer', () => {
    const html = render()
    expect(tag(html, 'review-navigator')).toMatch(/^<section/)
    expect(tag(html, 'requirement-card')).toMatch(/^<aside class="pmwb-focus-panel"/)
    expect(html).toContain('<div class="pmwb-review-content"><section class="pmwb-review-dock"')
    expect(html).toMatch(/<section class="pmwb-decision-palette">[\s\S]*<\/aside><\/div><footer class="pmwb-review-actions">/)
    expect(html).toContain('确认本期需求')
    expect(html).toContain('先核对依据，再决定优先级与本期范围。')
    expect(html).toContain('class="pmwb-review-columns"')
    expect(html).toContain('<details class="pmwb-requirement-details">')
    expect(html).toContain('仅已纳入的需求进入本期 PRD')
    expect(html).toContain('AI 建议')
    expect(workbenchCss).toContain('backdrop-filter: grayscale(1)')
    const monochromeCss = `${workbenchCss}\n${launcherCss}`
    expect(monochromeCss).not.toContain('linear-gradient')

    for (const match of monochromeCss.matchAll(/#([0-9a-f]{6})\b/gi)) {
      const [r, g, b] = [match[1]!.slice(0, 2), match[1]!.slice(2, 4), match[1]!.slice(4, 6)]
      expect(r, match[0]).toBe(g)
      expect(g, match[0]).toBe(b)
    }
    for (const match of monochromeCss.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)) {
      expect(match[1], match[0]).toBe(match[2])
      expect(match[2], match[0]).toBe(match[3])
    }
  })

  it('keeps the original AI recommendation distinct from a saved human priority in the list and detail', () => {
    const changed: ProjectView = { ...project, humanDecisions: project.humanDecisions.map(item => ({ ...item, priority: 'low' })) }
    const html = render({ ...ready, selectedProject: changed })
    expect(html).toContain('class="pmwb-requirement-ai">P0</span>')
    expect(html).toContain('class="pmwb-requirement-decision">P2 · 已纳入</span>')
    expect(html).toContain('<strong>AI 建议：P0</strong>')
    expect(html).not.toContain('AI 建议：P2')
    const quote = candidate.evidence.find(item => item.id === generated.evidenceIds[0])!.quote
    expect(html).toContain(`<small>“${quote.match(/^[\s\S]*?[。！？.!?](?:[”’」』"]|$)?|^[\s\S]+$/)?.[0] ?? quote}”</small>`)
  })

  it.each(['pending-operation', 'uncertain', 'saving', 'no-included'] as const)('keeps the review footer confirmation disabled for %s', condition => {
    const state: WorkbenchState = { ...ready, saveState: condition === 'uncertain' ? 'uncertain' : condition === 'saving' ? 'saving' : 'saved',
      selectedProject: condition === 'no-included' ? { ...project, humanDecisions: project.humanDecisions.map(item => ({ ...item, decision: 'pending' })) } : project }
    const html = renderToStaticMarkup(<ReviewWorkspace store={staticStore(state)} state={state} confirmation={token(state)} pending={condition === 'pending-operation'}
      onResult={() => {}} onSave={() => {}} onEvidence={() => {}} onReview={() => {}} onConfirm={() => {}} />)
    expect(tag(html, 'confirm-scope')).toContain('disabled=""')
  })

  it('shows the exact Harness provider and model for a model-generated analysis', () => {
    const modelProject = { ...project, analysis: { ...project.analysis!, kind: 'harness-model' as const,
      provider: 'deepseek-official', model: 'deepseek-v4-flash' } }
    const html = render({ ...ready, selectedProject: modelProject })
    expect(tag(html, 'model-route')).toContain('data-dsh-pm-workbench="model-route"')
    expect(html).toContain('Harness 模型分析 · deepseek-official / deepseek-v4-flash')
  })

  it('shows the authorized real-data gate in the material stage and three ordinary workflow buttons', () => {
    const html = render({ ...ready, selectedProject: { ...project, analysis: null } })
    for (const text of ['支持粘贴或导入 TXT、Markdown、Word 访谈材料', '我确认有权处理这份材料，并理解点击分析后会发送给当前 Harness 模型提供方',
      '发送给 Harness 模型并分析', '模型结果仍需经过原文引用校验和人工确认', '导入材料', '确认优先级', '生成 PRD', '确认并保存材料']) expect(html).toContain(text)
    expect(html).not.toContain('当前模型验证仅支持合成测试材料')
    expect(html).not.toContain('role="tab"')
    for (const text of ['API key', 'provider', '发送消息', '选择模型', '发布基线']) expect(html).not.toContain(text)
  })
  it('uses a native pointer-active named Workbench dialog and a keyboard button launcher', () => {
    const html = render()
    expect(tag(html, 'overlay')).toMatch(/^<dialog/)
    expect(tag(html, 'overlay')).toContain('aria-labelledby=')
    expect(tag(html, 'overlay')).toContain('pointer-events:auto')
    expect(tag(html, 'close')).toContain('type="button"')
    const launcher = renderToStaticMarkup(<WorkbenchLauncher onOpen={() => {}} />)
    expect(tag(launcher, 'launcher')).toMatch(/^<button/)
    expect(launcher).not.toContain('aria-label=')
    expect(launcher).toContain('class="dsh-pm-launcher"')
    expect(launcher).toContain('class="dsh-pm-launcher-icon"')
    expect(launcher).toContain('data-icon-variant="validation-prism"')
    expect(launcher.match(/<path class="dsh-pm-launcher-prism-blade/g)).toHaveLength(3)
    expect(launcher).toContain('class="dsh-pm-launcher-prism-core"')
    expect(launcher).toContain('class="dsh-pm-launcher-label"')
    expect(launcher).toContain('<svg')
    expect(launcher).toContain('AI PM 工作台')
    expect(launcher).toContain('[data-sidebar-collapsed] .dsh-pm-launcher')
    expect(render({ ...ready, isOpen: false })).toBe('')
  })
  it('renders the selected floating workbench shell with a compact project switcher, three-step navigator, and composed empty state', () => {
    const empty = render({ ...ready, projects: [], selectedProject: undefined, selectedProjectId: undefined, selectedSource: undefined })
    expect(tag(empty, 'workbench-header')).toMatch(/^<header/)
    expect(tag(empty, 'brand-mark')).toMatch(/^<svg/)
    expect(tag(empty, 'stepper')).toMatch(/^<nav/)
    expect(tag(empty, 'empty-state')).toMatch(/^<section/)
    expect(tag(empty, 'empty-new-project')).toContain('type="button"')
    expect(empty).toContain('还没有项目')
    expect(empty).toContain('新建第一个项目')
    expect(empty).toContain('background:transparent')
    expect(empty).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')
    expect(empty).not.toContain('材料 → 需求 → 优先级 → PRD')
    expect(empty).not.toContain('当前仅支持合成测试材料，请勿导入真实访谈或客户信息')
    const disconnected = render({ ...ready, projects: [], selectedProject: undefined, selectedProjectId: undefined, selectedSource: undefined, error: 'host-unavailable' })
    expect(disconnected).toContain('class="pmwb-visually-hidden" role="alert">工作台暂时无法连接')
    const active = tag(render(), 'step-1')
    expect(active).toContain('aria-current="step"')
    expect(tag(render(), 'review-workspace')).toMatch(/^<section/)
  })
  it('renders empty inventory, optional goal, limit and Host-supplied row order using only public summaries', () => {
    const empty = render({ ...ready, projects: [], selectedProject: undefined, selectedProjectId: undefined, selectedSource: undefined })
    expect(empty).toContain('暂时没有项目'); expect(empty).toContain('新建项目')
    const headers = [{ ...header, id: OTHER_PROJECT_ID, name: '第二个先显示', researchGoal: null }, { ...header, name: '第一个后显示' }]
    const html = renderToStaticMarkup(<ProjectList state={{ ...ready, projects: headers }} />)
    const inventory = html.slice(html.indexOf('<ul>'))
    expect(inventory.indexOf('第二个先显示')).toBeLessThan(inventory.indexOf('第一个后显示'))
    expect(html).toContain('研究目标未提供')
    for (const text of ['材料已导入', '已分析', 'PRD 已过期', '需求审核中']) expect(html).not.toContain(text)
    const full = render({ ...ready, projects: Array.from({ length: 20 }, (_, n) => ({ ...header, id: `${header.id.slice(0, -2)}${String(n).padStart(2, '0')}` as typeof header.id })) })
    expect(full).toContain('已达到 20 个项目上限'); expect(tag(full, 'new-project')).toContain('disabled=""')
  })
  it.each(['unsaved', 'saving', 'failed', 'uncertain'] as const)('blocks final publication while save state is %s', saveState => {
    const state = { ...ready, saveState }
    const html = renderToStaticMarkup(<PriorityPane state={state} confirmation={token(state)} />)
    expect(html).toContain('确认本期需求并生成 PRD')
    expect(tag(html, 'confirm-scope')).toContain('disabled=""')
    expect(tag(html, 'confirmation-summary')).toBe('')
  })
  it('renders the complete authoritative summary, not a newer local title, with exact identity witnesses', () => {
    const html = renderToStaticMarkup(<PriorityPane state={ready} confirmation={token(ready)} />)
    for (const text of [revision.title, revision.painPoint, revision.description, '高', '纳入本期', 'REASON_CANARY', candidate.evidence[0]!.quote]) expect(html).toContain(text)
    expect(tag(html, 'confirmation-summary')).toContain('data-confirmation-content-version="7"')
    expect(dataNames(tag(html, 'confirmation-summary'))).toEqual(['data-confirmation-content-version', 'data-confirmation-project-version', 'data-project-id'])
  })
  it.each([['unsaved', '未保存'], ['saving', '保存中'], ['saved', '已保存'], ['failed', '保存失败'], ['uncertain', '结果待确认']] as const)(
    'renders %s independently of selected review stage', (saveState, label) => {
      const html = render({ ...ready, saveState }); expect(html).toContain(label); expect(html).toContain('确认优先级')
      expect(tag(html, 'step-1')).toContain('aria-current="step"')
      expect(dataNames(tag(html, 'save-state'))).toEqual([])
    })
  it.each([['transport-internal', '工作台暂时无法连接'], ['host-unavailable', '工作台暂时无法连接'],
    ['version-conflict', '内容已更新，请刷新后重试'], ['invalid-evidence', '原文依据无法核对，请刷新后重试']] as const)('renders fixed safe %s errors', (error, message) => {
      expect(render({ ...ready, error })).toContain(message)
    })
  it('renders a neutral no-valid-needs message and source and evidence as visible text with exact witnesses', () => {
    expect(render({ ...ready, selectedProject: { ...project, generatedRequirements: [], requirementOrder: [], humanDecisions: [], selectedHumanRevisions: [] } }))
      .toContain('暂未找到有充分依据的需求，可检查材料或保留为后续研究问题。')
    const html = render()
    expect(html).toContain('来自访谈'); expect(html).toContain(candidate.evidence[0]!.quote)
    expect(dataNames(tag(html, 'evidence'))).toEqual(['data-evidence-id', 'data-quote-end', 'data-quote-hash', 'data-quote-start', 'data-source-revision-id'])
    for (const name of ['requirement-title', 'requirement-pain-point', 'requirement-description', 'priority', 'decision', 'human-reason', 'requirement-order', 'evidence-quote', 'evidence-context']) expect(tag(html, name)).not.toBe('')
    const material = render({ ...ready, selectedProject: { ...project, analysis: null } })
    expect(material).toContain(BUILT_IN_SYNTHETIC_TEXT)
    expect(tag(material, 'source-text')).not.toContain('hidden')
    expect(dataNames(tag(material, 'source-status'))).toEqual(['data-source-revision-id'])
  })
  it('binds retained stale and current PRD markup and trace to a selected history revision', () => {
    const summary = { projectId: SMALL_PROJECT_ID, prdRevisionId: prdRevisionIdSchema.parse('70000000-0000-4000-8000-000000000001'),
      baselineId: baselineIdSchema.parse('80000000-0000-4000-8000-000000000001'), sourceRevisionId: candidate.analysis.sourceRevisionId,
      baselineContentVersion: 6, rendererVersion: 'pmwb-prd-v1' as const, contentHash: BUILT_IN_SYNTHETIC_HASH, utf8Bytes: 15, createdAt: header.updatedAt, status: 'stale' as const }
    const state = { ...ready, selectedProject: { ...project, prdSummaries: [summary] }, selectedPrdRevisionId: summary.prdRevisionId,
      selectedMarkdown: { ...summary, markdown: 'MARKDOWN_CANARY' } }
    const html = renderToStaticMarkup(<PrdPane state={state} />)
    for (const text of ['需求已调整，此 PRD 保留的是上次确认的内容', '下载PRD', 'MARKDOWN_CANARY', summary.baselineId]) expect(html).toContain(text)
    expect(tag(html, 'copy-prd')).toBe('')
    expect(html).not.toContain('下载 Word')
    for (const marker of ['prd-preview', 'prd-history-item']) expect(dataNames(tag(html, marker))).toEqual(['data-baseline-id', 'data-prd-current', 'data-prd-hash', 'data-prd-revision-id'])
    expect(tag(html, 'prd-preview')).toContain('data-prd-current="false"'); expect(tag(html, 'prd-markdown')).not.toContain('hidden')
    expect(tag(html, 'prd-history-item')).toContain('aria-pressed="true"')
    const unselected = renderToStaticMarkup(<PrdPane state={{ ...state, selectedPrdRevisionId: undefined, selectedMarkdown: undefined }} />)
    expect(tag(unselected, 'prd-history-item')).toContain('aria-pressed="false"')
    const current = renderToStaticMarkup(<PrdPane state={{ ...state, selectedProject: { ...project, prdSummaries: [{ ...summary, status: 'current' }] } }} />)
    expect(tag(current, 'prd-preview')).toContain('data-prd-current="true"')
  })
  it('offers explicit PRD regeneration only for a saved, current human baseline', () => {
    const baseline = { id: baselineIdSchema.parse('80000000-0000-4000-8000-000000000001'), projectId: SMALL_PROJECT_ID,
      sourceRevisionId: candidate.analysis.sourceRevisionId, sourceContentHash: BUILT_IN_SYNTHETIC_HASH, projectVersion: header.projectVersion, contentVersion: header.contentVersion, itemCount: 1, createdAt: header.updatedAt }
    const current = { ...ready, selectedProject: { ...project, currentBaseline: baseline } }
    const pane = (state: WorkbenchState, pending = false) => tag(renderToStaticMarkup(<PrdPane state={state} pending={pending} onRegenerate={() => {}} />), 'regenerate-prd')
    expect(pane(current)).toContain('button')
    expect(pane(current)).not.toContain('disabled')
    expect(pane(current, true)).toContain('disabled')
    expect(pane({ ...current, saveState: 'unsaved', dirty: true })).toContain('disabled')
    expect(pane({ ...current, selectedProject: { ...current.selectedProject, currentBaseline: { ...baseline, contentVersion: header.contentVersion - 1 } } })).toContain('disabled')
  })
  it('keeps every free-text canary out of all Product witness, title, hidden and accessibility attributes', () => {
    const html = render()
    const risky = [...html.matchAll(/\b(?:data-[\w-]+|title|aria-[\w-]+|hidden)="([^"]*)"/g)].map(match => match[0]).join('\n')
    for (const text of ['CANARY', generated.title, candidate.evidence[0]!.quote, 'synthetic.txt']) expect(risky).not.toContain(text)
    expect(html).not.toMatch(/\b(?:title|aria-label|hidden)=/)
    for (const match of html.matchAll(/\b(data-[\w-]+)="([^"]*)"/g)) {
      if (match[1] === 'data-dsh-pm-workbench') continue
      expect(match[2]).toMatch(/^(?:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|[0-9a-f]{64}|true|false|\d+)$/)
    }
  })
})
