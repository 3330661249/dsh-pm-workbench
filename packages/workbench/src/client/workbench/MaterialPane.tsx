import { useEffect, useId, useRef, useState } from 'react'
import { BUILT_IN_SYNTHETIC_TEXT } from '../../analysis/fixture-manifest.js'
import { readMaterialDraft, type MaterialDraft, type MaterialInput } from './material-input.js'
import type { StoreResult, WorkbenchState, WorkbenchStore } from './store.js'

export function MaterialPane({ store, state, pending, onResult, onReadStart, onReading, onSave, onAnalyse, onContinue }: {
  store: WorkbenchStore; state: WorkbenchState; pending: boolean
  onResult(result: StoreResult<unknown>): void
  onReadStart(): { onResult(result: StoreResult<unknown>): void; onReadError(): void }
  onReading(reading: boolean): void; onSave(): void; onAnalyse(): void
  onContinue?: () => void
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
  const reviewStarted = !!state.selectedProject?.header.reviewStarted
  const persisted = state.selectedSource?.sourceRevisionId === source?.sourceRevisionId ? state.selectedSource : undefined
  const locked = !!source || pending || state.saveState === 'uncertain'
  function validated() {
    const current = store.getSnapshot(), value = visibleEdit.current
    return live() && !current.selectedProject?.source
      && current.saveState !== 'uncertain' && !!value.verified && value.verified === current.materialDraft && value.text === value.verified.text
  }
  return <div className="pmwb-material-workspace">
    <div className="pmwb-material-content">
      <section className="pmwb-material-editor">
        <header><h3>{source ? '已保存的访谈原文' : '访谈材料正文'}</h3><p>支持粘贴或导入 TXT、Markdown、Word 访谈材料</p></header>
        {source ? persisted ? <pre data-dsh-pm-workbench="source-text">{persisted.text}</pre>
          : <p className="pmwb-material-empty">已保存的材料正文尚未载入。</p>
          : <><label id={`${id}-text`} htmlFor={`${id}-text-input`}>粘贴正文，或从右侧选择文件</label>
            <textarea id={`${id}-text-input`} aria-labelledby={`${id}-text`} data-dsh-pm-workbench="material-input" disabled={locked}
              value={edit.text} placeholder="把访谈记录放在这里…"
              onChange={event => { if (!locked) void read({ kind: 'paste', text: event.currentTarget.value, displayName: 'pasted.txt' }) }} /></>}
      </section>
      <aside className="pmwb-material-sidebar">
        <section className="pmwb-material-import">
          <h3>材料来源</h3>
          <label id={`${id}-file`} htmlFor={`${id}-file-input`}>导入 TXT、Markdown 或 Word（.docx）</label>
          <input id={`${id}-file-input`} aria-labelledby={`${id}-file`} type="file" accept=".txt,.md,.docx,text/plain,text/markdown,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            data-dsh-pm-workbench="material-file" disabled={locked} onChange={event => {
              if (!live()) return
              const file = event.currentTarget.files?.[0]
              if (file && !locked) void read({ kind: 'file', file })
              event.currentTarget.value = ''
            }} />
          <p className="pmwb-notice">Word 文件最大 10 MB，仅提取正文和表格文字，不含图片、页眉页脚；请在左侧预览正文后确认保存。</p>
        </section>
        <section className="pmwb-material-status">
          <h3>材料状态</h3>
          <p data-dsh-pm-workbench="source-status" data-source-revision-id={source?.sourceRevisionId}>{source ? '材料已保存，正文已锁定' : '材料尚未保存'}</p>
          {(source || state.materialDraft) && <p>{source ? `已保存：${source.displayName}` : `当前草稿：${state.materialDraft!.displayName}`}</p>}
          {reading && <p role="status">正在校验材料</p>}
        </section>
        <section className="pmwb-material-permission">
          <h3>使用与权限</h3>
          {!source && <label><input type="checkbox" data-dsh-pm-workbench="data-use-attestation" checked={validated() && state.importAttested} disabled={locked || !validated()}
            onChange={event => { if (!locked && validated()) onResult(store.setMaterialDraft(visibleEdit.current.verified!, event.currentTarget.checked)) }} />
            {state.materialDraft?.dataClassification === 'synthetic'
              ? '我确认这是内置合成测试材料'
              : '我确认有权处理这份材料，并理解点击分析后会发送给当前 Harness 模型提供方'}</label>}
          <p className="pmwb-notice">点击分析会把当前材料发送给 Harness 当前模型提供方；模型结果仍需经过原文引用校验和人工确认</p>
        </section>
        <section className="pmwb-material-fixture">
          <h3>先试一份示例</h3><p>没有准备好的材料时，可使用合成访谈体验流程。</p>
          <button type="button" data-dsh-pm-workbench="load-fixture" disabled={locked}
            onClick={() => { if (!locked) void read({ kind: 'paste', text: BUILT_IN_SYNTHETIC_TEXT, displayName: 'synthetic.txt' }) }}>载入合成测试材料</button>
        </section>
      </aside>
    </div>
    <footer className="pmwb-stage-footer">
      <div className="pmwb-stage-summary"><strong>{source ? '材料已就绪' : '先保存，再分析'}</strong>
        <p>{state.selectedProject?.header.reviewStarted ? '已有分析结果，可前往确认优先级查看。' : source ? 'AI 将提炼需求并提供原文依据，最终范围由你确认。' : '核对正文与使用权限后，保存本次访谈材料。'}</p></div>
      <div className="pmwb-stage-footer-actions">
      {state.selectedProject?.analysis && onContinue && <button type="button" className={reviewStarted ? 'pmwb-primary' : undefined} data-dsh-pm-workbench="continue-to-review" onClick={onContinue}>查看已提炼需求</button>}
      {source ? !reviewStarted && <button type="button" className="pmwb-primary" data-dsh-pm-workbench="analyse-model" disabled={!source || pending || state.saveState !== 'saved' || state.selectedProject?.header.reviewStarted}
        onClick={() => { if (live()) onAnalyse() }}>{pending ? '正在分析…' : '发送给 Harness 模型并分析'}</button>
        : <button type="button" className="pmwb-primary" data-dsh-pm-workbench="save-material" disabled={locked || reading || !validated() || !state.importAttested}
          onClick={() => { if (!locked && validated() && store.getSnapshot().importAttested) onSave() }}>确认并保存材料</button>}
      </div>
    </footer>
  </div>
}
