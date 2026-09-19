import { useEffect, useId, useRef, useState } from 'react'
import { BUILT_IN_SYNTHETIC_TEXT } from '../../analysis/fixture-manifest.js'
import { readMaterialDraft, type MaterialDraft, type MaterialInput } from './material-input.js'
import type { StoreResult, WorkbenchState, WorkbenchStore } from './store.js'

export function MaterialPane({ store, state, pending, onResult, onReadStart, onReading, onSave, onAnalyse }: {
  store: WorkbenchStore; state: WorkbenchState; pending: boolean
  onResult(result: StoreResult<unknown>): void
  onReadStart(): { onResult(result: StoreResult<unknown>): void; onReadError(): void }
  onReading(reading: boolean): void; onSave(): void; onAnalyse(): void
}) {
  const id = useId(), generation = useRef(0), alive = useRef(true), [reading, setReading] = useState(false)
  const [edit, setEdit] = useState<{ text: string; verified?: MaterialDraft }>(() => ({ text: state.materialDraft?.text ?? '', verified: state.materialDraft }))
  const visibleEdit = useRef(edit)
  function display(next: typeof edit) { visibleEdit.current = next; setEdit(next) }
  useEffect(() => {
    alive.current = true
    display({ text: state.materialDraft?.text ?? '', verified: state.materialDraft }); setReading(false); onReading(false)
    return () => { alive.current = false; generation.current++; visibleEdit.current = { text: visibleEdit.current.text }; onReading(false) }
  }, [state.selectedProjectId, state.isOpen, state.materialDraft])
  function live() { const current = store.getSnapshot(); return alive.current && current.isOpen && current.selectedProjectId === state.selectedProjectId }
  async function read(input: MaterialInput) {
    if (!live()) return
    const request = ++generation.current, feedback = onReadStart()
    // The controlled value must follow the input synchronously, before hashing.
    // Clearing this ref also refuses a save handler retained from an older render.
    display({ text: input.kind === 'paste' ? input.text : visibleEdit.current.text })
    setReading(true); onReading(true)
    const current = () => request === generation.current && live()
    try {
      const draft = await readMaterialDraft(input)
      if (current()) {
        const result = store.setMaterialDraft(draft, false)
        if (result.ok) display({ text: draft.text, verified: draft })
        feedback.onResult(result)
      }
    } catch { if (current()) feedback.onReadError() }
    finally { if (current()) { setReading(false); onReading(false) } }
  }
  const source = state.selectedProject?.source
  const persisted = state.selectedSource?.sourceRevisionId === source?.sourceRevisionId ? state.selectedSource : undefined
  const locked = !!source || pending || state.saveState === 'uncertain'
  function validated() {
    const current = store.getSnapshot(), value = visibleEdit.current
    return live() && !current.selectedProject?.source
      && current.saveState !== 'uncertain' && !!value.verified && value.verified === current.materialDraft && value.text === value.verified.text
  }
  return <>
    <p>支持粘贴或导入 TXT、Markdown、Word 访谈材料</p>
    <button type="button" data-dsh-pm-workbench="load-fixture" disabled={locked}
      onClick={() => { if (!locked) void read({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt' }) }}>载入合成测试材料</button>
    <label id={`${id}-text`} htmlFor={`${id}-text-input`}>访谈材料正文</label>
    <textarea id={`${id}-text-input`} aria-labelledby={`${id}-text`} data-dsh-pm-workbench="material-input" disabled={locked}
      value={edit.text} onChange={event => { if (!locked) void read({ kind: 'paste', text: event.currentTarget.value, displayName: 'pasted.txt' }) }} />
    <label id={`${id}-file`} htmlFor={`${id}-file-input`}>导入 TXT、Markdown 或 Word（.docx）</label>
    <input id={`${id}-file-input`} aria-labelledby={`${id}-file`} type="file" accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      data-dsh-pm-workbench="material-file" disabled={locked} onChange={event => {
        if (!live()) return
        const file = event.currentTarget.files?.[0]
        if (file && !locked) void read({ kind: 'file', file })
        event.currentTarget.value = ''
      }} />
    <p className="pmwb-notice">Word 文件最大 10 MB，仅提取正文和表格文字，不含图片、页眉页脚；请在上方预览正文后确认保存。</p>
    {state.materialDraft && <p>当前草稿：{state.materialDraft.displayName}</p>}
    <label><input type="checkbox" data-dsh-pm-workbench="data-use-attestation" checked={validated() && state.importAttested} disabled={locked || !validated()}
      onChange={event => { if (!locked && validated()) onResult(store.setMaterialDraft(visibleEdit.current.verified!, event.currentTarget.checked)) }} />
      {state.materialDraft?.dataClassification === 'synthetic'
        ? '我确认这是内置合成测试材料'
        : '我确认有权处理这份材料，并理解点击分析后会发送给当前 Harness 模型提供方'}</label>
    {reading && <p role="status">正在校验材料</p>}
    <button type="button" data-dsh-pm-workbench="save-material" disabled={locked || reading || !validated() || !state.importAttested}
      onClick={() => { if (!locked && validated() && store.getSnapshot().importAttested) onSave() }}>确认并保存材料</button>
    <p data-dsh-pm-workbench="source-status" data-source-revision-id={source?.sourceRevisionId}>{source ? '材料已保存，正文已锁定' : '材料尚未保存'}</p>
    {persisted && <pre data-dsh-pm-workbench="source-text">{persisted.text}</pre>}
    <button type="button" data-dsh-pm-workbench="analyse-model" disabled={!source || pending || state.saveState !== 'saved' || state.selectedProject?.header.reviewStarted}
      onClick={() => { if (live()) onAnalyse() }}>发送给 Harness 模型并分析</button>
    <p className="pmwb-notice">点击分析会把当前材料发送给 Harness 当前模型提供方；模型结果仍需经过原文引用校验和人工确认</p>
  </>
}
