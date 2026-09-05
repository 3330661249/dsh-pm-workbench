import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DemoApp } from '../../packages/workbench/src/demo/DemoApp.js'
import { RequirementsStep } from '../../packages/workbench/src/demo/components/RequirementsStep.js'
import { PriorityStep } from '../../packages/workbench/src/demo/components/PriorityStep.js'
import { PrdStep } from '../../packages/workbench/src/demo/components/PrdStep.js'
import { StepNavigation } from '../../packages/workbench/src/demo/components/StepNavigation.js'
import { createDemoCards, SYNTHETIC_INTERVIEW_TEXT } from '../../packages/workbench/src/demo/domain/fixture-provider.js'
import { initialDemoState, type DemoState } from '../../packages/workbench/src/demo/state.js'
import { renderDemoPrd } from '../../packages/workbench/src/demo/domain/prd.js'

const material = { text: SYNTHETIC_INTERVIEW_TEXT, displayName: '合成访谈.txt', format: 'pasted' as const }
const generated = createDemoCards(material)
if (!generated.ok) throw new Error(generated.error.message)
const state: DemoState = { ...initialDemoState, material, cards: generated.value }
const noop = () => {}

describe('standalone Demo markup', () => {
  it('shows permanent boundaries and an accessible material entry on first load', () => {
    const html = renderToStaticMarkup(<DemoApp />)
    expect(html).toContain('演示数据，未连接 DeepSeek Harness，未调用真实模型。')
    expect(html).toContain('仅保存在当前页面内存中；刷新或关闭页面后会丢失。')
    for (const name of ['材料', '需求', '优先级', 'PRD']) expect(html).toContain(name)
    expect(html).toContain('for="material-text"')
    expect(html).toContain('<textarea id="material-text"')
    expect(html).toContain('.txt / .md')
    expect(html).toContain('载入演示访谈</button>')
    expect(html).toContain('role="status"')
    expect(html).not.toMatch(/dangerouslySetInnerHTML|DeepSeek[- ](?:V[0-9]|R[0-9])|GPT[- ]|已保存|自动保存|保存成功|saved/i)
  })

  it('keeps cited evidence read-only and distinguishes inference in requirements', () => {
    const html = renderToStaticMarkup(<RequirementsStep state={state} onEdit={noop} onContinue={noop} />)
    expect(html).toContain('原文引用')
    expect(html).toContain('[4, 28)')
    expect(html).toContain('<blockquote>每次整理访谈都要在多个文档里找原话，常常花半小时</blockquote>')
    expect(html).toContain('演示生成')
    expect(html).toContain('AI 推断，待确认（演示）')
    expect(html).toContain('不可纳入本次 PRD')
    expect(html).toContain('for="demo-cited-1-title"')
  })

  it('shows native priority decisions and citation provenance', () => {
    const html = renderToStaticMarkup(<PriorityStep state={state} onEdit={noop} onContinue={noop} />)
    expect(html).toContain('<fieldset')
    expect(html).toContain('原文引用')
    expect(html).toContain('[4, 28)')
    expect(html).toContain('演示生成')
    expect(html).toContain('AI 推断，待确认（演示）')
    expect(html).toContain('value="include"')
    expect(html).toContain('已纳入 0 条有原文引用的需求')
  })

  it('never offers inference an include control', () => {
    const inferenceState = { ...state, cards: state.cards.filter((card) => card.kind === 'inference') }
    const html = renderToStaticMarkup(<PriorityStep state={inferenceState} onEdit={noop} onContinue={noop} />)
    expect(html).toContain('不可纳入本次 PRD')
    expect(html).toContain('value="defer"')
    expect(html).toContain('value="reject"')
    expect(html).not.toContain('value="include"')
    expect(html).not.toContain('value="high"')
  })

  it('lets existing cards reach PRD even before a requirement is included', () => {
    const html = renderToStaticMarkup(<StepNavigation state={state} onStep={noop} />)
    expect(html).toMatch(/<button(?=[^>]*data-step="prd")(?:(?!disabled)[^>])*>/)
  })

  it('explains the empty PRD state with a disabled generation action', () => {
    const html = renderToStaticMarkup(<PrdStep state={state} onGenerated={noop} onFailure={noop} onAnnounce={noop} onReturn={noop} />)
    expect(html).toContain('请先在“优先级”中纳入至少一条有原文引用的需求。')
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>生成 PRD 预览<\/button>/)
    expect(html).toContain('返回优先级')
  })

  it('renders only included evidence and safely escapes user text in PRD preview', () => {
    const cards = state.cards.map((card, index) => index === 0 ? { ...card, title: '<script>unsafe()</script>', decision: 'include' as const } : card)
    const artifact = renderDemoPrd({ projectTitle: '测试项目', material, cards })
    if (!artifact.ok) throw new Error(artifact.error.message)
    const html = renderToStaticMarkup(<PrdStep state={{ ...state, cards, prd: artifact.value }} onGenerated={noop} onFailure={noop} onAnnounce={noop} onReturn={noop} />)
    expect(html).toContain('&lt;script&gt;unsafe()&lt;/script&gt;')
    expect(html).not.toContain('<script>')
    expect(html).not.toContain('补充访谈覆盖范围')
    expect(html).toContain('待产品经理补充')
    expect(html).toContain('下载 Markdown')
    expect(html).toContain('[4, 28)')
  })
})
