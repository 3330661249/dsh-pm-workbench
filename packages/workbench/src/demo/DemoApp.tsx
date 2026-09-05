import { useEffect, useReducer, useRef, useState } from 'react'
import { createDemoCards, SYNTHETIC_INTERVIEW_TEXT } from './domain/fixture-provider.js'
import type { Material } from './domain/types.js'
import { demoReducer, initialDemoState, type DemoAction } from './state.js'
import { DemoNotice } from './components/DemoNotice.js'
import { MaterialStep } from './components/MaterialStep.js'
import { PrdStep } from './components/PrdStep.js'
import { PriorityStep } from './components/PriorityStep.js'
import { RequirementsStep } from './components/RequirementsStep.js'
import { StepNavigation } from './components/StepNavigation.js'
import { WorkbenchMark } from './components/WorkbenchMark.js'

export function DemoApp() {
  const [state, dispatch] = useReducer(demoReducer, initialDemoState)
  const [announcement, setAnnouncement] = useState('')
  const errorRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLElement>(null)
  const previousStep = useRef(state.step)
  const send = (action: DemoAction) => { setAnnouncement(''); dispatch(action) }

  function analyzeMaterial(material: Material) {
    send({ type: 'materialAccepted', material })
    try {
      const cards = createDemoCards(material)
      if (!cards.ok) { send({ type: 'operationFailed', message: cards.error.message }); return }
      send({ type: 'analysisAccepted', cards: cards.value })
      setAnnouncement(`已用本地演示规则生成 ${cards.value.length} 张卡片；没有调用模型。`)
    } catch (error) {
      send({ type: 'operationFailed', message: error instanceof Error ? error.message : String(error) })
    }
  }

  useEffect(() => { if (state.error) errorRef.current?.focus() }, [state.error])
  useEffect(() => {
    if (previousStep.current !== state.step) {
      mainRef.current?.focus()
      previousStep.current = state.step
    }
  }, [state.step])

  return <div className="demo-shell">
    <a className="skip-link" href="#main-content">跳到主要内容</a>
    <header className="app-header"><div className="brand"><WorkbenchMark /><div><h1>PM Workbench</h1><p>从访谈原文，到产品判断。</p></div></div><span className="demo-badge">LOCAL DEMO</span></header>
    <StepNavigation state={state} onStep={(step) => send({ type: 'stepRequested', step })} />
    <DemoNotice />
    <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement || state.notice}</p>
    {state.error && <div className="error-alert" role="alert" tabIndex={-1} ref={errorRef}><strong>操作未完成</strong><p>{state.error}</p><button type="button" onClick={() => send({ type: 'errorCleared' })}>关闭提示</button></div>}
    <main id="main-content" tabIndex={-1} ref={mainRef}>
      {state.step === 'material' && <MaterialStep state={state} syntheticInterviewText={SYNTHETIC_INTERVIEW_TEXT} onTitleChange={(value) => send({ type: 'projectTitleChanged', value })} onAccept={(material) => send({ type: 'materialAccepted', material })} onAnalyze={analyzeMaterial} onFailure={(message) => send({ type: 'operationFailed', message })} />}
      {state.step === 'requirements' && <RequirementsStep state={state} onEdit={(id, edit) => send({ type: 'requirementEdited', id, edit })} onContinue={() => send({ type: 'stepRequested', step: 'priority' })} />}
      {state.step === 'priority' && <PriorityStep state={state} onEdit={(id, edit) => send({ type: 'requirementEdited', id, edit })} onContinue={() => send({ type: 'stepRequested', step: 'prd' })} />}
      {state.step === 'prd' && <PrdStep state={state} onGenerated={(artifact) => send({ type: 'prdGenerated', artifact })} onFailure={(message) => send({ type: 'operationFailed', message })} onAnnounce={setAnnouncement} onReturn={() => send({ type: 'stepRequested', step: 'priority' })} />}
    </main>
    <footer className="app-footer"><span>PM Workbench / 本地确定性 Demo</span><span>材料 → 需求 → 优先级 → PRD</span></footer>
  </div>
}
