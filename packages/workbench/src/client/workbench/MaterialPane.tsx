import { useEffect, useId, useRef, useState } from 'react'
import { BUILT_IN_SYNTHETIC_TEXT } from '../../analysis/fixture-manifest.js'
import { readMaterialDraft, type MaterialInput } from './material-input.js'
import type { StoreResult, WorkbenchState, WorkbenchStore } from './store.js'

export function MaterialPane({ store, state, pending, onResult, onReadError, onReading, onSave, onAnalyse }: {
  store: WorkbenchStore; state: WorkbenchState; pending: boolean
  onResult(result: StoreResult<unknown>): void; onReadError(): void; onReading(reading: boolean): void; onSave(): void; onAnalyse(): void
}) {
  const id = useId(), generation = useRef(0), [reading, setReading] = useState(false)
  useEffect(() => { setReading(false); onReading(false); return () => { generation.current++; onReading(false) } }, [state.selectedProjectId, state.isOpen])
  async function read(input: MaterialInput) {
    const request = ++generation.current, projectId = state.selectedProjectId
    setReading(true); onReading(true)
    const current = () => request === generation.current && store.getSnapshot().isOpen && store.getSnapshot().selectedProjectId === projectId
    try {
      const draft = await readMaterialDraft(input)
      if (current()) onResult(store.setMaterialDraft(draft, false))
    } catch { if (current()) onReadError() }
    finally { if (current()) { setReading(false); onReading(false) } }
  }
  const source = state.selectedProject?.source
  const persisted = state.selectedSource?.sourceRevisionId === source?.sourceRevisionId ? state.selectedSource : undefined
  const locked = !!source || pending || state.saveState === 'uncertain'
  return <>
    <p>当前仅支持合成测试材料，请勿导入真实访谈或客户信息</p>
    <button type="button" data-dsh-pm-workbench="load-fixture" disabled={locked}
      onClick={() => { if (!locked) void read({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt' }) }}>载入合成测试材料</button>
    <label id={`${id}-text`} htmlFor={`${id}-text-input`}>合成测试材料正文</label>
    <textarea id={`${id}-text-input`} aria-labelledby={`${id}-text`} data-dsh-pm-workbench="material-input" disabled={locked}
      value={state.materialDraft?.text ?? ''} onChange={event => { if (!locked) void read({ kind: 'paste', text: event.currentTarget.value, displayName: 'pasted.txt' }) }} />
    <label id={`${id}-file`} htmlFor={`${id}-file-input`}>导入 TXT 或 Markdown 文件（UTF-8）</label>
    <input id={`${id}-file-input`} aria-labelledby={`${id}-file`} type="file" accept=".txt,.md,text/plain,text/markdown"
      data-dsh-pm-workbench="material-file" disabled={locked} onChange={event => {
        const file = event.currentTarget.files?.[0]
        if (file && !locked) void read({ kind: 'file', file })
        event.currentTarget.value = ''
      }} />
    {state.materialDraft && <p>当前草稿：{state.materialDraft.displayName}</p>}
    <label><input type="checkbox" data-dsh-pm-workbench="synthetic-attestation" checked={state.importAttested} disabled={locked || !state.materialDraft}
      onChange={event => { if (state.materialDraft && !locked) onResult(store.setMaterialDraft(state.materialDraft, event.currentTarget.checked)) }} />
      我确认这是新写的合成测试材料，不含真实个人或客户数据</label>
    {reading && <p role="status">正在校验材料</p>}
    <button type="button" data-dsh-pm-workbench="save-material" disabled={locked || reading || !state.materialDraft || !state.importAttested} onClick={onSave}>确认并保存材料</button>
    <p data-dsh-pm-workbench="source-status" data-source-revision-id={source?.sourceRevisionId}>{source ? '材料已保存，正文已锁定' : '材料尚未保存'}</p>
    {persisted && <pre data-dsh-pm-workbench="source-text">{persisted.text}</pre>}
    <button type="button" data-dsh-pm-workbench="analyse-fixture" disabled={!source || pending || state.saveState !== 'saved' || state.selectedProject?.header.reviewStarted}
      onClick={onAnalyse}>生成本地测试草稿</button>
    <p className="pmwb-notice">本地 Fixture 结果，未调用模型，不代表 AI 分析</p>
  </>
}
