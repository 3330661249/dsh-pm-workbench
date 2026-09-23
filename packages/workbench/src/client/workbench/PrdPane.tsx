import type { ReactNode } from 'react'
import type { PrdRevisionId } from '../../domain/ids.js'
import type { WorkbenchState } from './store.js'

// This reader intentionally supports a small Markdown subset. HTML, links and
// unsupported syntax remain escaped text; the exact source stays available below.
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*)/g).map((part, index) => part.startsWith('**') && part.endsWith('**')
    ? <strong key={index}>{part.slice(2, -2)}</strong> : part)
}
function markdownBlocks(markdown: string): ReactNode[] {
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n'), blocks: ReactNode[] = []
  let index = 0
  while (index < lines.length) {
    const line = lines[index]!, key = index
    if (!line.trim()) { index++; continue }
    if (/^```/.test(line)) {
      const code: string[] = []; index++
      while (index < lines.length && !/^```/.test(lines[index]!)) code.push(lines[index++]!)
      if (index < lines.length) index++
      blocks.push(<pre key={key}><code>{code.join('\n')}</code></pre>); continue
    }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line)
    if (heading) {
      const Heading = `h${heading[1]!.length}` as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6'
      blocks.push(<Heading key={key}>{inline(heading[2]!)}</Heading>); index++; continue
    }
    const list = /^(?:[-*+]\s+|\d+[.)]\s+)\S/.exec(line)
    if (list) {
      const ordered = /^\d/.test(line), pattern = ordered ? /^\d+[.)]\s+(.+)$/ : /^[-*+]\s+(.+)$/
      const items: ReactNode[] = []
      while (index < lines.length) {
        const item = pattern.exec(lines[index]!); if (!item) break
        items.push(<li key={index}>{inline(item[1]!)}</li>); index++
      }
      blocks.push(ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>); continue
    }
    if (/^\s*\|/.test(line)) {
      const table: string[] = []
      while (index < lines.length && /^\s*\|/.test(lines[index]!)) table.push(lines[index++]!)
      blocks.push(<pre key={key}>{table.join('\n')}</pre>); continue
    }
    const paragraph: string[] = [line]; index++
    while (index < lines.length && lines[index]!.trim() && !/^(?:#{1,6}\s|[-*+]\s|\d+[.)]\s|```|\s*\|)/.test(lines[index]!)) paragraph.push(lines[index++]!)
    blocks.push(<p key={key}>{inline(paragraph.join('\n'))}</p>)
  }
  return blocks
}

export function PrdPane({ state, onSelect, onDownload, onRegenerate, pending = false, onBack, onContinue, canContinue = false }: {
  state: WorkbenchState; onSelect?: (id: PrdRevisionId) => void; onDownload?: () => void; onRegenerate?: () => void; pending?: boolean
  onBack?: () => void; onContinue?: () => void; canContinue?: boolean
}) {
  const project = state.selectedProject
  const canRegenerate = !pending && !state.dirty && state.saveState === 'saved' && !state.pendingRetry
    && !!project?.currentBaseline && project.currentBaseline.contentVersion === project.header.contentVersion
  const summaries = state.selectedProject?.prdSummaries ?? []
  const summary = summaries.find(item => item.prdRevisionId === state.selectedPrdRevisionId)
  const value = state.selectedMarkdown
  const selected = summary && value && value.projectId === state.selectedProjectId && value.prdRevisionId === summary.prdRevisionId
    && value.contentHash === summary.contentHash && value.baselineId === summary.baselineId && value.baselineContentVersion === summary.baselineContentVersion
  const traceIndex = selected ? value.markdown.search(/^(?:## 附录：需求与证据追溯\r?\n)?### 可追溯信息\s*$/m) : -1
  const body = selected ? traceIndex < 0 ? value.markdown : value.markdown.slice(0, traceIndex) : ''
  return <div className="pmwb-prd-workspace">
    <div className="pmwb-prd-content">
      <section className="pmwb-prd-document">
        {selected ? <article data-dsh-pm-workbench="prd-preview" data-prd-revision-id={summary.prdRevisionId} data-baseline-id={summary.baselineId}
          data-prd-hash={summary.contentHash} data-prd-current={String(summary.status === 'current')}>
          <div className="pmwb-prd-rich-text">{markdownBlocks(body)}</div>
          <details className="pmwb-prd-raw"><summary>查看 Markdown 原文</summary><pre data-dsh-pm-workbench="prd-markdown">{value.markdown}</pre></details>
        </article> : <div className="pmwb-prd-empty"><h3>{summaries.length === 0 ? '尚未生成 PRD' : '选择一份 PRD'}</h3>
          <p>{summaries.length === 0 ? '确认本期需求后，可在此查看 PRD。' : '从右侧选择版本，核对内容后下载。'}</p></div>}
      </section>
      <aside className="pmwb-prd-sidebar">
        <section className="pmwb-prd-versions"><header><h3>文档版本</h3><span>{summaries.length} 份</span></header>
          {summaries.map((item, index) => <button type="button" key={item.prdRevisionId} data-dsh-pm-workbench="prd-history-item"
            data-prd-revision-id={item.prdRevisionId} data-baseline-id={item.baselineId} data-prd-hash={item.contentHash} data-prd-current={String(item.status === 'current')}
            aria-pressed={item.prdRevisionId === state.selectedPrdRevisionId}
            onClick={() => onSelect?.(item.prdRevisionId)}>PRD {index + 1} · {item.status === 'current' ? '当前内容' : '历史内容'}</button>)}
        </section>
        <section className="pmwb-prd-status"><h3>确认与修改</h3>
          <p>{selected ? summary.status === 'stale' ? '需求已调整，此 PRD 保留的是上次确认的内容' : '此 PRD 对应当前已确认内容' : 'PRD 基于人工确认的需求范围生成。'}</p>
          <p>如需修改需求，请先返回确认优先级，再生成新的文档版本。</p>
          {onBack && <button type="button" data-dsh-pm-workbench="back-to-review" onClick={onBack}>返回需求确认</button>}
          {onRegenerate && <button type="button" data-dsh-pm-workbench="regenerate-prd" disabled={!canRegenerate} onClick={onRegenerate}>{pending ? '起草中…' : '重新生成'}</button>}
        </section>
        {(selected || state.baselineChain) && <details className="pmwb-prd-provenance"><summary>版本追溯信息</summary>
          {selected ? <p data-dsh-pm-workbench="baseline-trace">基线 {summary.baselineId} · 确认内容版本 {summary.baselineContentVersion}</p>
            : state.baselineChain && <p data-dsh-pm-workbench="baseline-trace">基线 {state.baselineChain.baselineId} · 确认内容版本 {state.baselineChain.confirmedContentVersion}</p>}
          {selected && traceIndex >= 0 && <pre>{value.markdown.slice(traceIndex)}</pre>}
        </details>}
      </aside>
    </div>
    <footer className="pmwb-stage-footer">
      <div className="pmwb-stage-summary"><strong>{selected ? '文档可下载' : '等待确认文档'}</strong><p>以 Word 格式保存文档，或继续验证本期核心场景。</p></div>
      <div className="pmwb-stage-footer-actions">
        {onContinue && <button type="button" data-dsh-pm-workbench="continue-to-validation" disabled={!selected || pending || !canContinue} onClick={onContinue}>进入方案验证 →</button>}
        <button type="button" className="pmwb-primary" data-dsh-pm-workbench="download-prd" disabled={!selected} onClick={onDownload}>下载PRD</button>
      </div>
    </footer>
  </div>
}
