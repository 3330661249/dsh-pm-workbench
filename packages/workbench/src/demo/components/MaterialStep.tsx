import { useState } from 'react'
import { decodeUploadedText, validatePastedText } from '../domain/material.js'
import { MAX_UPLOAD_BYTES, type DomainResult, type Material } from '../domain/types.js'
import type { DemoState } from '../state.js'

export function MaterialStep({ state, syntheticInterviewText, onTitleChange, onAccept, onAnalyze, onFailure }: {
  state: DemoState
  syntheticInterviewText: string
  onTitleChange: (title: string) => void
  onAccept: (material: Material) => void
  onAnalyze: (material: Material) => void
  onFailure: (message: string) => void
}) {
  const [text, setText] = useState(state.material?.text ?? '')
  const [reading, setReading] = useState(false)

  function accept(result: DomainResult<Material>, onAccepted = onAccept) {
    if (!result.ok) { onFailure(result.error.message); return }
    if (state.cards.length > 0 && !window.confirm('替换材料会清空当前页面中的需求、优先级和 PRD 预览。是否继续？')) return
    onAccepted(result.value)
    setText(result.value.text)
  }

  async function upload(file: File) {
    if (file.size > MAX_UPLOAD_BYTES) { onFailure('上传文件不能超过 256 KB。'); return }
    setReading(true)
    try {
      const bytes = new Uint8Array(await file.arrayBuffer())
      accept(decodeUploadedText(file.name, bytes))
    } catch (error) {
      onFailure(error instanceof Error ? error.message : String(error))
    } finally { setReading(false) }
  }

  function analyze() {
    try {
      const validated = validatePastedText(text)
      if (!validated.ok) { onFailure(validated.error.message); return }
      accept({ ok: true, value: state.material?.text === text ? state.material : validated.value }, onAnalyze)
    } catch (error) {
      onFailure(error instanceof Error ? error.message : String(error))
    }
  }

  return <section aria-labelledby="material-heading">
    <div className="section-heading"><div><p className="eyebrow">01 / 材料</p><h2 id="material-heading">让需求有据可循。</h2>
      <p className="muted">从一份访谈开始，保留每个判断对应的原话。</p></div><span className="tag">本地演示规则</span></div>
    <div className="material-grid">
      <div className="panel material-editor">
        <label htmlFor="project-title">项目名称</label>
        <input id="project-title" value={state.projectTitle} onChange={(event) => onTitleChange(event.target.value)} />
        <div className="field-top"><label htmlFor="material-text">访谈材料</label><span className="muted">{text.length.toLocaleString('zh-CN')} / 80,000</span></div>
        <textarea id="material-text" rows={12} value={text} disabled={reading} aria-describedby="material-help"
          placeholder="粘贴访谈原文，例如：受访者：每次整理访谈都要在多个文档里找原话……"
          onChange={(event) => setText(event.target.value)} />
        <p id="material-help" className="help">支持 .txt / .md，UTF-8 纯文本；上传最多 256 KiB（262,144 字节），粘贴或解码后最多 80,000 个 UTF-16 code units。材料不能为空，也不能包含 NUL 字符。</p>
        <div className="actions"><button type="button" className="primary" disabled={reading} onClick={analyze}>分析访谈（本地演示）</button>
          <span className="help">原文保留，需求由你确认。</span></div>
      </div>
      <aside className="material-aside">
        <div className="panel"><p className="eyebrow">快速体验</p><h3>先走一遍完整流程</h3>
          <p className="muted">载入一份合成访谈，查看原文引用、调整需求取舍，再导出 PRD 草稿。</p>
          <button type="button" className="secondary" disabled={reading} onClick={() => accept(validatePastedText(syntheticInterviewText))}>载入演示访谈</button>
        </div>
        <div className="panel upload-panel"><label htmlFor="material-file">导入文本文件</label>
          <p className="muted">已有访谈记录？选择 .txt 或 .md 文件。</p>
          <input id="material-file" type="file" accept=".txt,.md,text/plain,text/markdown" disabled={reading} aria-describedby="material-help"
            onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file) }} />
          {reading && <p role="status">正在读取文本……</p>}
          {state.material && <p className="help">当前材料：{state.material.displayName}</p>}
        </div>
      </aside>
    </div>
  </section>
}
