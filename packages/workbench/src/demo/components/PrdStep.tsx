import { renderDemoPrd, type PrdArtifact } from '../domain/prd.js'
import { eligibleRequirements } from '../domain/requirements.js'
import type { DemoState } from '../state.js'
import { CardEvidence } from './RequirementEditor.js'

export function PrdStep({ state, onGenerated, onFailure, onAnnounce, onReturn }: {
  state: DemoState
  onGenerated: (artifact: PrdArtifact) => void
  onFailure: (message: string) => void
  onAnnounce: (message: string) => void
  onReturn: () => void
}) {
  const included = eligibleRequirements(state.cards).slice().sort((left, right) =>
    left.citations[0].start - right.citations[0].start || left.citations[0].end - right.citations[0].end || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0))

  function generate() {
    if (!state.material) { onFailure('需要先提供材料。'); return }
    try {
      const result = renderDemoPrd({ projectTitle: state.projectTitle, material: state.material, cards: state.cards })
      if (!result.ok) { onFailure(result.error.message); return }
      onGenerated(result.value)
    } catch (error) { onFailure(error instanceof Error ? error.message : String(error)) }
  }

  function download() {
    if (!state.prd) return
    try {
      const blob = new Blob([state.prd.bytes], { type: 'text/markdown;charset=utf-8' })
      const href = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = href
      anchor.download = state.prd.filename
      document.body.append(anchor)
      anchor.click()
      anchor.remove()
      setTimeout(() => URL.revokeObjectURL(href), 0)
      onAnnounce(`已触发下载 ${state.prd.filename}；这是 Demo 导出。`)
    } catch (error) { onFailure(error instanceof Error ? error.message : String(error)) }
  }

  return <section aria-labelledby="prd-heading">
    <div className="section-heading"><div><p className="eyebrow">04 / PRD</p><h2 id="prd-heading">把判断变成可追溯的草稿。</h2>
      <p className="muted">仅收录有原文引用且已纳入的需求；未确定的信息留待你补充。</p></div><span className="tag">Markdown · Demo</span></div>
    <div className="panel prd-toolbar"><p className="selection-count">已纳入 {included.length} 条有原文引用的需求</p>
      <div className="actions"><button type="button" className="secondary" onClick={onReturn}>返回优先级</button><button type="button" className="primary" disabled={included.length === 0} onClick={generate}>生成 PRD 预览</button></div></div>
    {included.length === 0 ? <div className="panel empty-state"><span className="empty-symbol" aria-hidden="true">↗</span><h3>先确定本期范围</h3><p>请先在“优先级”中纳入至少一条有原文引用的需求。</p></div>
      : !state.prd ? <div className="panel empty-state"><h3>你的取舍已就绪</h3><p>点击“生成 PRD 预览”，查看本次 Demo 草稿。</p></div>
      : <article className="panel prd-preview" aria-label="PRD 草稿预览">
        <div className="prd-document-heading"><div><p className="eyebrow">PRD / 演示草稿</p><h3>{state.projectTitle || '未命名项目'}</h3><p className="help">{state.prd.filename}</p></div><button type="button" className="secondary" onClick={download}>下载 Markdown</button></div>
        <section><h4>背景与问题</h4><p>访谈材料：{state.material?.displayName}</p><p>本演示只保留产品经理明确纳入、且可回溯原文的需求。</p></section>
        <section><h4>目标用户</h4><p className="placeholder">待产品经理补充。</p></section>
        <section><h4>用户痛点及访谈依据</h4><p className="muted">材料来源：{state.material?.displayName}</p>
          {included.map((card) => <section key={card.id} className="prd-requirement"><h5>{card.title || '未命名需求'}</h5><p>用户痛点：{card.painPoint}</p><p>需求描述：{card.description}</p><p>人工优先级：{card.priority === 'high' ? '高' : card.priority === 'medium' ? '中' : '低'}</p><p>人工理由：{card.humanReason || '待产品经理补充'}</p><CardEvidence card={card} /></section>)}
        </section>
        <section><h4>本期目标</h4><p className="placeholder">待产品经理补充。</p></section>
        <section><h4>功能需求和优先级</h4><ul>{included.map((card) => <li key={card.id}>{card.title}（{card.priority === 'high' ? '高' : card.priority === 'medium' ? '中' : '低'}）</li>)}</ul></section>
        <section><h4>非本期范围</h4><p>无引用推断不会纳入本次 PRD。</p></section>
        <section><h4>成功指标</h4><p className="placeholder">待产品经理补充。</p></section>
        <section><h4>风险与待确认问题</h4><p>访谈材料的覆盖范围和上线验证标准待产品经理补充。</p></section>
        <section><h4>演示说明</h4><p className="muted">本地确定性 Demo：本产物仅用于演示需求取舍与原文追溯，不代表正式 PRD、上线结论或用户事实。</p></section>
      </article>}
  </section>
}
