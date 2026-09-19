import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { PrdRevisionId } from '../../domain/ids.js'
import { validationPlanSchema, type ValidationHandoff, type ValidationMode, type ValidationPlan,
  type ValidationRequest, type ValidationRun, type ValidationTask, type ValidationVerdict } from '../../validation/model.js'
import type { WorkbenchState } from './store.js'
import { ValidationSession, type ValidationClient } from './validation-client.js'
import { validationHandoffArchive } from './handoff-export.js'
import type { WorkbenchBrowserDependencies } from './browser-port.js'

const modes: { value: ValidationMode; title: string; description: string; label: string }[] = [
  { value: 'demo', title: '可交互 Demo', description: '把操作流程变成可点击的界面，先看体验是否顺畅。', label: '模拟数据 · 交互体验' },
  { value: 'capability', title: '核心能力验证', description: '逐条运行测试案例，对照预期检查 AI 的实际表现。', label: '真实模型 · 案例测试' },
  { value: 'poc', title: '可运行 POC', description: '在标准模板中输入材料，真实运行一次核心任务。', label: '真实模型 · 输入到结果' },
]
const statuses: Record<ValidationTask['status'], string> = { draft: '计划待确认', confirmed: '准备就绪', running: '正在运行', completed: '待人工判断', failed: '运行失败', judged: '已记录结论' }
const verdicts: Record<ValidationVerdict, string> = { pass: '通过', partial: '部分通过', fail: '未通过', hold: '暂不判断' }
const uuid = () => globalThis.crypto.randomUUID().toLowerCase()
const time = (value: string) => new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
type Mutation = Exclude<ValidationRequest, { action: 'list' | 'create' }>
type Change = Mutation extends infer T ? T extends Mutation ? Omit<T, 'projectId' | 'taskId' | 'expectedVersion' | 'commandId'> : never : never

function ModeIcon({ mode }: { mode: ValidationMode }) {
  return <svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" strokeWidth="1.35" aria-hidden="true">
    {mode === 'demo' ? <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="M3 9h18M8 13l5 3-5 2z" /></>
      : mode === 'capability' ? <><path d="M9 3h6M10 3v7L4 19a1 1 0 0 0 1 2h14a1 1 0 0 0 1-2l-6-9V3M7 16h10" /><path d="m10 15 2-3 2 3" /></>
        : <><rect x="3" y="4" width="18" height="16" rx="3" /><path d="m8 10 4 3-4 3m6 0h3" /></>}
  </svg>
}

export function ValidationPane({ state, client, stage, onStage, onReview, onSelectPrd, onDownloadPrd }: {
  state: WorkbenchState; client: ValidationClient; stage: 'validation' | 'handoff'; onStage(stage: 3 | 4): void
  onReview(): void; onSelectPrd(id: PrdRevisionId): void; onDownloadPrd(): void
}) {
  const project = state.selectedProject!
  const session = useMemo(() => new ValidationSession(client, project.header.id), [client, project.header.id])
  const snapshot = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot)
  const [mode, setMode] = useState<ValidationMode>('capability')
  const included = project.humanDecisions.filter(item => item.decision === 'include').map(item => item.requirementId)
  const [requirements, setRequirements] = useState<string[]>(included)
  const [handoff, setHandoff] = useState<{ taskId: string; version: number; value: ValidationHandoff }>()
  const [downloadState, setDownloadState] = useState('')
  const live = useRef(true)
  const exporting = useRef(false)
  useEffect(() => { live.current = true; session.activate(); void session.load(); return () => { live.current = false; session.dispose() } }, [session])
  const selected = snapshot.tasks.find(task => task.id === snapshot.selectedTaskId)
  const summary = project.prdSummaries.find(item => item.prdRevisionId === state.selectedPrdRevisionId)
  const mutable = !state.dirty && state.saveState === 'saved' && !state.pendingRetry
  const ready = mutable && summary?.status === 'current'
  const pending = !!snapshot.busy || !!snapshot.uncertainRequest
  const matchingTasks = stage === 'handoff' ? snapshot.tasks.filter(task => task.verdict?.value === 'pass') : snapshot.tasks
  const task = stage === 'handoff' ? selected?.verdict?.value === 'pass' ? selected : matchingTasks[0] : selected
  const stale = task ? task.stale || !mutable || !project.prdSummaries.some(prd => prd.prdRevisionId === task.prdRevisionId && prd.status === 'current') : false
  const latestRun = task?.runs.at(-1)

  async function create() {
    if (!ready || !summary || !requirements.length || pending) return
    await session.submit({ action: 'create', projectId: project.header.id, taskId: uuid(), commandId: uuid(), expectedVersion: 0,
      payload: { prdRevisionId: summary.prdRevisionId, requirementIds: requirements, mode } }, 'AI 正在根据所选需求起草验证计划，请稍候…')
  }
  async function mutate(current: ValidationTask, change: Change, label: string) {
    const request = { ...change, projectId: project.header.id, taskId: current.id, expectedVersion: current.version, commandId: uuid() } as Mutation
    const result = await session.submit(request, label)
    if (live.current && result?.ok && result.handoff && result.task) setHandoff({ taskId: result.task.id, version: result.task.version, value: result.handoff })
  }
  async function download(value: ValidationHandoff) {
    if (exporting.current) return
    exporting.current = true
    setDownloadState('正在准备交付包…')
    try {
      const picker = (globalThis as unknown as { showSaveFilePicker?: WorkbenchBrowserDependencies['pickSaveFile'] }).showSaveFilePicker
      const filename = value.filename.replace(/\.[^.]+$/, '') + '.zip'
      // Open the desktop picker directly within the user gesture, before producing the archive.
      const file = picker ? await picker.call(globalThis, { startIn: 'desktop', suggestedName: filename,
        types: [{ description: '研发交付包', accept: { 'application/zip': ['.zip'] } }] }) : undefined
      const blob = await validationHandoffArchive(value)
      if (!live.current) return
      if (file) {
        const writer = await file.createWritable()
        try { await writer.write(blob); if (live.current) await writer.close(); else await writer.abort() }
        catch (error) { try { await writer.abort() } catch { /* preserve original failure */ } throw error }
      } else {
        const url = URL.createObjectURL(blob), anchor = document.createElement('a')
        anchor.href = url; anchor.download = filename
        try { document.body.append(anchor); anchor.click() }
        finally { anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
      }
      if (live.current) setDownloadState(file ? '交付包已保存。' : '已发起下载，请在浏览器下载列表查看。')
    } catch (error) {
      if (live.current) setDownloadState(error instanceof DOMException && error.name === 'AbortError' ? '' : '交付包下载失败，请重试。')
    } finally { exporting.current = false }
  }

  return <section className="pmwb-surface pmwb-validation" data-dsh-pm-workbench={stage === 'handoff' ? 'handoff-center' : 'validation-center'}>
    <header><div><span>{project.header.name}</span><h2>{stage === 'handoff' ? '准备交给研发' : '方案验证'}</h2></div>
      <p>{stage === 'handoff' ? '把已确认的范围、验证结果与待解决问题一起交付。' : '先选一段关键场景，再用适合的方式验证。'}</p></header>
    <div className="pmwb-validation-toolbar">
      <label>来源 PRD <select aria-label="验证来源 PRD" value={state.selectedPrdRevisionId ?? ''} disabled={pending}
        onChange={event => onSelectPrd(event.target.value as PrdRevisionId)}>
        {!summary && <option value="">请选择 PRD</option>}
        {project.prdSummaries.map((prd, index) => <option key={prd.prdRevisionId} value={prd.prdRevisionId}>PRD {index + 1} · {prd.status === 'current' ? '当前版本' : '历史版本'}</option>)}
      </select></label>
      <button type="button" disabled={!!snapshot.busy} onClick={() => { void session.load() }}>刷新验证记录</button>
    </div>
    {snapshot.busy && <p className="pmwb-validation-notice" role="status" aria-live="polite"><span className="pmwb-working-dot" />{snapshot.busy}</p>}
    {snapshot.error && <p className="pmwb-validation-notice" role="alert">{snapshot.error}</p>}
    {snapshot.uncertainRequest && <button type="button" disabled={!!snapshot.busy} onClick={() => { void session.retry() }}>重试原操作</button>}
    {stage === 'validation' && <>
      {!selected && <>
        <div className="pmwb-validation-modes">{modes.map(item => <button type="button" key={item.value} className="pmwb-validation-mode"
          data-dsh-pm-workbench={`validation-mode-${item.value}`} aria-pressed={mode === item.value} disabled={pending} onClick={() => setMode(item.value)}>
          <ModeIcon mode={item.value} /><strong>{item.title}</strong><span>{item.description}</span><small>{item.label}</small>
        </button>)}</div>
        <div className="pmwb-validation-create">
          <div><h3>这次验证哪些需求？</h3><p>先选最关键的 1–3 条；验证通过仅代表本次选择的范围。</p></div>
          <fieldset disabled={pending || !ready} className="pmwb-validation-scope"><legend className="pmwb-visually-hidden">需求范围</legend>
            {included.map(id => { const human = project.selectedHumanRevisions.find(item => item.requirementId === id)
              const title = human?.title ?? project.generatedRequirements.find(item => item.requirementId === id)?.title ?? '未命名需求'
              return <label key={id}><input type="checkbox" checked={requirements.includes(id)} onChange={event => setRequirements(list => event.target.checked ? [...list, id] : list.filter(item => item !== id))} /><span>{title}</span></label>
            })}
          </fieldset>
          {!ready && <p className="pmwb-validation-notice">请先保存需求，并选择与当前已确认范围一致的 PRD。</p>}
          <div className="pmwb-validation-create-footer"><p>点击后，将所选需求和 PRD 发送给当前 Harness 模型，起草可编辑的验证计划。</p>
            <button type="button" className="pmwb-primary" data-dsh-pm-workbench="validation-create" disabled={!ready || !requirements.length || pending} onClick={() => { void create() }}>生成验证计划</button></div>
        </div>
      </>}
      {selected && <div className="pmwb-validation-detail">
        <div className="pmwb-validation-detail-heading"><button type="button" disabled={pending} onClick={() => session.select()}>← 验证中心</button>
          <span>{modes.find(item => item.value === selected.mode)?.title} · {statuses[selected.status]}</span></div>
        <h3>{selected.plan.title}</h3>
        <p className="pmwb-validation-muted">PRD {project.prdSummaries.findIndex(item => item.prdRevisionId === selected.prdRevisionId) + 1} · {selected.requirementTitles.join('、')}</p>
        {stale && <p className="pmwb-validation-notice">需求或 PRD 已更新。本记录保留历史依据，请为新版 PRD 创建新的验证任务。</p>}
        {selected.lastError && <p className="pmwb-validation-notice" role="alert">{selected.lastError}</p>}
        {selected.status === 'running' && !snapshot.busy && <p className="pmwb-validation-notice" role="status">任务仍在运行，完成后可刷新查看结果。</p>}
        <ValidationTaskDetail key={`${selected.id}:${selected.version}`} task={selected} disabled={pending || stale}
          onMutation={(change, label) => { void mutate(selected, change, label) }} onReview={onReview} onHandoff={() => onStage(4)} />
      </div>}
    </>}
    {stage === 'handoff' && <>
      {!task ? <div className="pmwb-validation-empty"><h3>还没有可交付的验证结果</h3><p>完成验证并记录“通过”结论后，便可整理研发交付包。</p>
        <button type="button" className="pmwb-primary" onClick={() => onStage(3)}>前往方案验证</button></div>
        : <div className="pmwb-handoff">
          <h3>{task.plan.title}</h3><p className="pmwb-validation-muted">仅交付本次通过的 {task.requirementIds.length} 条需求范围，未验证部分将在交付文档中列出。</p>
          <dl><div><dt>本次验证</dt><dd>{modes.find(item => item.value === task.mode)?.title}</dd></div>
            <div><dt>人工结论</dt><dd>{verdicts[task.verdict!.value]} · {task.verdict!.note || '未补充说明'}</dd></div>
            <div><dt>来源 PRD</dt><dd>第 {project.prdSummaries.findIndex(prd => prd.prdRevisionId === task.prdRevisionId) + 1} 版</dd></div>
            <div><dt>已运行案例</dt><dd>{latestRun?.results.length ?? 0} 条</dd></div></dl>
          <div className="pmwb-handoff-contents"><h3>交付包内容</h3><p>PRD 与需求范围 · 验收标准 · 验证报告 · 实际运行记录 · 未验证范围和风险 · 使用说明</p></div>
          {stale && <p className="pmwb-validation-notice">这次验证对应的需求已变更，请在当前 PRD 下重新验证后交付。</p>}
          <div className="pmwb-actions">
            <button type="button" className="pmwb-primary" data-dsh-pm-workbench="validation-handoff" disabled={pending || stale || latestRun?.status !== 'completed'}
              onClick={() => { setHandoff(undefined); void mutate(task, { action: 'handoff' }, '正在整理研发交付包…') }}>整理研发交付包</button>
            <button type="button" onClick={() => { session.select(task.id); onStage(3) }}>查看验证依据</button>
          </div>
          {handoff?.taskId === task.id && handoff.version === task.version && !stale && <div className="pmwb-handoff-ready">
            <p>研发交付包已准备好</p><button type="button" className="pmwb-primary" data-dsh-pm-workbench="download-handoff" disabled={downloadState === '正在准备交付包…'} onClick={() => { void download(handoff.value) }}>下载研发交付包</button>
            <details><summary>预览交付内容</summary><pre>{handoff.value.markdown}</pre></details>
          </div>}
          {downloadState && <p role="status">{downloadState}</p>}
          {state.selectedPrdRevisionId === task.prdRevisionId && <button type="button" className="pmwb-text-action" onClick={onDownloadPrd}>仅下载来源 PRD</button>}
        </div>}
    </>}
    <section className="pmwb-validation-history"><header><h3>{stage === 'handoff' ? '已通过的验证' : '验证记录'}</h3><span>{matchingTasks.length} 项</span></header>
      {!matchingTasks.length && <p className="pmwb-validation-muted">{snapshot.busy ? '正在读取…' : '每次验证都会保留计划、结果与人工结论。'}</p>}
      {matchingTasks.map(item => <button type="button" className="pmwb-validation-history-row" key={item.id} disabled={pending} aria-pressed={item.id === task?.id}
        onClick={() => { setHandoff(undefined); setDownloadState(''); session.select(item.id) }}>
        <ModeIcon mode={item.mode} /><span><strong>{item.plan.title}</strong><small>{modes.find(mode => mode.value === item.mode)?.title} · {time(item.createdAt)}</small></span>
        <span className="pmwb-validation-badge">{item.stale ? '历史依据' : item.verdict ? verdicts[item.verdict.value] : statuses[item.status]}</span><span aria-hidden="true">↗</span>
      </button>)}
    </section>
  </section>
}

export function ValidationTaskDetail({ task, disabled, onMutation, onReview, onHandoff }: {
  task: ValidationTask; disabled: boolean; onMutation(change: Change, label: string): void; onReview(): void; onHandoff(): void
}) {
  const [plan, setPlan] = useState<ValidationPlan>(() => structuredClone(task.plan))
  const [allowModel, setAllowModel] = useState(task.allowModelUse)
  const [input, setInput] = useState(''), [note, setNote] = useState(task.verdict?.note ?? '')
  const [selectedRun, setSelectedRun] = useState(task.runs.at(-1)?.id)
  const run = task.runs.find(item => item.id === selectedRun), latest = task.runs.at(-1)
  const changed = JSON.stringify(plan) !== JSON.stringify(task.plan)
  const planValid = validationPlanSchema.safeParse(plan).success
  const editDisabled = disabled || task.status === 'running'
  const canRun = !editDisabled && !changed && task.confirmedPlanVersion === task.planVersion && (task.mode === 'demo' || allowModel)
  const patch = (value: Partial<ValidationPlan>) => setPlan(previous => ({ ...previous, ...value }))
  const patchCase = (index: number, key: 'input' | 'expected', value: string) => patch({ cases: plan.cases.map((item, n) => n === index ? { ...item, [key]: value } : item) })
  return <>
    <details className="pmwb-validation-plan" open={task.runs.length === 0 || task.status === 'draft'}>
      <summary>验证计划 <span>第 {task.planVersion} 版 · {task.plan.cases.length} 个案例{changed ? ' · 有未保存修改' : ''}</span></summary>
      <fieldset disabled={editDisabled}>
        <label>计划名称<input maxLength={160} value={plan.title} onChange={event => patch({ title: event.target.value })} /></label>
        <label>我们想验证什么<textarea rows={2} maxLength={6000} value={plan.goal} onChange={event => patch({ goal: event.target.value })} /></label>
        <label>通过标准（每行一条）<textarea rows={3} maxLength={12000} value={plan.criteria.join('\n')} onChange={event => patch({ criteria: event.target.value.split('\n') })} /></label>
        <div className="pmwb-validation-cases">{plan.cases.map((item, index) => <details key={item.id} className="pmwb-validation-case"><summary>案例 {index + 1}<span>{item.expected.slice(0, 80)}</span></summary>
          <label>输入材料<textarea rows={3} maxLength={20000} value={item.input} onChange={event => patchCase(index, 'input', event.target.value)} /></label>
          <label>预期表现<textarea rows={2} maxLength={6000} value={item.expected} onChange={event => patchCase(index, 'expected', event.target.value)} /></label>
          <button type="button" disabled={plan.cases.length <= 3} onClick={() => patch({ cases: plan.cases.filter((_, n) => n !== index) })}>移除此案例</button>
        </details>)}</div>
        <button type="button" disabled={plan.cases.length >= 20} onClick={() => patch({ cases: [...plan.cases, { id: uuid(), input: '', expected: '' }] })}>添加测试案例</button>
        {changed && <div className="pmwb-actions"><button type="button" className="pmwb-primary" disabled={!planValid} onClick={() => onMutation({ action: 'updatePlan', payload: plan }, '正在保存验证计划…')}>保存计划</button><span>{planValid ? '修改后需重新确认计划。' : '请补全计划、通过标准及至少 3 条完整案例。'}</span></div>}
      </fieldset>
      <p className="pmwb-validation-muted">{task.planProvenance.kind === 'template' ? '使用起始模板，请编辑并核对计划。' : `计划起草：${task.planProvenance.provider} / ${task.planProvenance.model}`}</p>
    </details>
    {task.confirmedPlanVersion !== task.planVersion && !changed && <div className="pmwb-validation-confirm">
      {task.mode !== 'demo' && <label><input type="checkbox" checked={allowModel} disabled={editDisabled} onChange={event => setAllowModel(event.target.checked)} />我已核对所选 PRD 和验证计划，并允许将本次测试材料发送给当前 Harness 模型。</label>}
      {task.mode === 'demo' && <p>点击确认即表示已核对所选 PRD 范围与验证计划。Demo 使用预设模拟结果验证操作体验，不代表功能已经完成。</p>}
      <button type="button" className="pmwb-primary" data-dsh-pm-workbench="validation-confirm" disabled={editDisabled || task.mode !== 'demo' && !allowModel}
        onClick={() => onMutation({ action: 'confirm', payload: { allowModelUse: task.mode !== 'demo' && allowModel } }, '正在确认计划…')}>确认 PRD 与验证计划</button>
    </div>}
    {task.mode === 'poc' && <div className="pmwb-poc-input"><h3>运行核心场景</h3><p>在工作台内使用标准输入 → AI 处理 → 结果模板。输入会发送给当前 Harness 模型。</p>
      <label>本次输入<textarea rows={5} placeholder="粘贴一段材料，真实运行这次验证任务…" maxLength={20000} value={input} disabled={editDisabled} onChange={event => setInput(event.target.value)} /></label>
    </div>}
    <div className="pmwb-actions"><button type="button" className="pmwb-primary" data-dsh-pm-workbench="validation-run" disabled={!canRun || task.mode === 'poc' && !input.trim()}
      onClick={() => onMutation({ action: 'run', payload: task.mode === 'poc' ? { input } : {} }, task.mode === 'demo' ? '正在准备交互 Demo…' : '正在运行真实模型测试，较长材料可能需要几分钟…')}>
      {task.mode === 'demo' ? latest ? '重新生成 Demo' : '生成交互 Demo' : task.mode === 'poc' ? '运行 POC' : latest ? '重新运行测试' : '开始测试'}</button>
      {task.confirmedPlanVersion === task.planVersion && <span className="pmwb-validation-muted">计划已确认 · 第 {task.planVersion} 版</span>}</div>
    {!!task.runs.length && <section className="pmwb-validation-results">
      <header><h3>运行结果</h3><select aria-label="运行历史" value={selectedRun} onChange={event => setSelectedRun(event.target.value)}>
        {task.runs.map((item, index) => <option key={item.id} value={item.id}>第 {index + 1} 次 · {time(item.startedAt)}</option>)}
      </select></header>
      {run && <ValidationRunResults key={run.id} run={run} mode={task.mode} />}
    </section>}
    {latest?.status === 'completed' && <section className="pmwb-validation-judgment"><h3>你的验证结论</h3>
      <p>结论针对最新一次运行和本次选择的需求。自动检查仅供参考。</p>
      <label>判断依据或需要改进的地方<textarea rows={3} maxLength={6000} value={note} disabled={editDisabled} onChange={event => setNote(event.target.value)} /></label>
      <div className="pmwb-actions">{(Object.keys(verdicts) as ValidationVerdict[]).map(value => <button type="button" key={value} aria-pressed={task.verdict?.value === value}
        data-dsh-pm-workbench={`validation-judge-${value}`} disabled={editDisabled || changed || run?.id !== latest.id || latest.planVersion !== task.planVersion}
        onClick={() => onMutation({ action: 'judge', payload: { verdict: value, note } }, '正在保存人工结论…')}>{verdicts[value]}</button>)}</div>
      {run?.id !== latest.id && <p className="pmwb-validation-muted">正在查看历史运行。请切回最新一次运行后判断。</p>}
      {task.verdict?.value === 'pass' && <div className="pmwb-validation-next"><p>已记录通过结论，可整理本次验证范围的交付材料。</p><button type="button" className="pmwb-primary" onClick={onHandoff}>进入研发准备 →</button></div>}
      {(task.verdict?.value === 'partial' || task.verdict?.value === 'fail') && <div className="pmwb-validation-next"><p>保留这次验证结果，返回调整需求，再生成新的 PRD。</p><button type="button" className="pmwb-primary" onClick={onReview}>返回需求修改 →</button></div>}
      {task.verdict?.value === 'hold' && <p className="pmwb-validation-muted">已保留结果，补充证据后可再作判断。</p>}
    </section>}
  </>
}

export function ValidationRunResults({ run, mode }: { run: ValidationRun; mode: ValidationMode }) {
  return <>
    <p className="pmwb-validation-muted">{run.status === 'completed' ? '运行完成' : run.status === 'failed' ? '运行失败' : '运行中'} · 计划第 {run.planVersion} 版</p>
    {run.verdict && <p className="pmwb-validation-notice">本次人工结论：{verdicts[run.verdict.value]}{run.verdict.note ? ` · ${run.verdict.note}` : ''}</p>}
    {run.error && <p className="pmwb-validation-notice" role="alert">{run.error}</p>}
    {mode === 'demo' && run.demo && <ControlledDemo demo={run.demo} />}
    {run.results.map((result, index) => <details className="pmwb-validation-case" key={result.caseId} open={mode === 'poc'}>
      <summary>案例 {index + 1}<span>{result.status === 'failed' ? '运行失败' : '已获得结果'}{result.checks.some(check => !check.passed) ? ' · 有待核对项' : ''}</span></summary>
      <div className="pmwb-validation-result-grid"><div><h4>输入</h4><pre>{result.input}</pre><h4>预期表现</h4><pre>{result.expected}</pre></div>
        <div><h4>{result.provenance.kind === 'controlled-demo' ? '模拟结果' : '模型实际输出'}</h4><pre>{result.actual || '没有返回结果'}</pre></div></div>
      {result.error && <p role="alert">{result.error}</p>}
      {!!result.checks.length && <ul className="pmwb-validation-checks">{result.checks.map((check, index) => <li key={index}>{check.passed ? '✓' : '○'} {check.label} · {check.passed ? '满足' : '待核对'}</li>)}</ul>}
      <p className="pmwb-validation-muted">{result.provenance.kind === 'controlled-demo' ? '预设模拟数据，不代表真实能力' : `${result.provenance.provider} / ${result.provenance.model}`}</p>
    </details>)}
  </>
}

export function ControlledDemo({ demo }: { demo: NonNullable<ValidationRun['demo']> }) {
  const [input, setInput] = useState(''), [step, setStep] = useState(0), [shown, setShown] = useState(false)
  return <div className="pmwb-controlled-demo" data-dsh-pm-workbench="controlled-demo">
    <header><h3>{demo.title}</h3><span>交互预览 · 模拟数据</span></header>
    <ol>{demo.steps.map((item, index) => <li key={index} aria-current={step === index ? 'step' : undefined}>{item}</li>)}</ol>
    {!shown ? <><label>{demo.inputLabel}<textarea rows={3} placeholder="输入一些示例内容，体验操作流程" value={input} onChange={event => setInput(event.target.value)} /></label>
      <button type="button" className="pmwb-primary" disabled={!input.trim()} onClick={() => { setStep(demo.steps.length - 1); setShown(true) }}>{demo.actionLabel}</button></>
      : <div role="status"><h4>模拟结果</h4><pre>{demo.sampleOutput}</pre><button type="button" onClick={() => { setShown(false); setStep(0) }}>返回重新体验</button></div>}
    <p className="pmwb-validation-muted">此处显示固定示例，不会根据输入调用模型。</p>
  </div>
}
