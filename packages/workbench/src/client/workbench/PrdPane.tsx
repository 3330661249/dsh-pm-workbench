import type { PrdRevisionId } from '../../domain/ids.js'
import type { WorkbenchState } from './store.js'

export function PrdPane({ state, onSelect, onDownload, onRegenerate, pending = false }: {
  state: WorkbenchState; onSelect?: (id: PrdRevisionId) => void; onDownload?: () => void; onRegenerate?: () => void; pending?: boolean
}) {
  const project = state.selectedProject
  const canRegenerate = !pending && !state.dirty && state.saveState === 'saved' && !state.pendingRetry
    && !!project?.currentBaseline && project.currentBaseline.contentVersion === project.header.contentVersion
  const summaries = state.selectedProject?.prdSummaries ?? []
  const summary = summaries.find(item => item.prdRevisionId === state.selectedPrdRevisionId)
  const value = state.selectedMarkdown
  const selected = summary && value && value.projectId === state.selectedProjectId && value.prdRevisionId === summary.prdRevisionId
    && value.contentHash === summary.contentHash && value.baselineId === summary.baselineId && value.baselineContentVersion === summary.baselineContentVersion
  return <>
    {summaries.length === 0 && <p>确认本期需求后，可在此查看 PRD。</p>}
    <div className="pmwb-actions">{summaries.map((item, index) => <button type="button" key={item.prdRevisionId} data-dsh-pm-workbench="prd-history-item"
      data-prd-revision-id={item.prdRevisionId} data-baseline-id={item.baselineId} data-prd-hash={item.contentHash} data-prd-current={String(item.status === 'current')}
      onClick={() => onSelect?.(item.prdRevisionId)}>PRD {index + 1} · {item.status === 'current' ? '当前内容' : '历史内容'}</button>)}
      {onRegenerate && <button type="button" data-dsh-pm-workbench="regenerate-prd" disabled={!canRegenerate} onClick={onRegenerate}>{pending ? '起草中…' : '重新生成'}</button>}
    </div>
    {selected && <div data-dsh-pm-workbench="prd-preview" data-prd-revision-id={summary.prdRevisionId} data-baseline-id={summary.baselineId}
      data-prd-hash={summary.contentHash} data-prd-current={String(summary.status === 'current')}>
      <p>{summary.status === 'stale' ? '需求已调整，此 PRD 保留的是上次确认的内容' : '此 PRD 对应当前已确认内容'}</p>
      <p data-dsh-pm-workbench="baseline-trace">基线 {summary.baselineId} · 确认内容版本 {summary.baselineContentVersion}</p>
      <pre data-dsh-pm-workbench="prd-markdown">{value.markdown}</pre>
    </div>}
    {!selected && state.baselineChain && <p data-dsh-pm-workbench="baseline-trace">基线 {state.baselineChain.baselineId} · 确认内容版本 {state.baselineChain.confirmedContentVersion}</p>}
    <div className="pmwb-actions">
      <button type="button" className="pmwb-primary" data-dsh-pm-workbench="download-prd" disabled={!selected} onClick={onDownload}>下载PRD</button>
    </div>
  </>
}
