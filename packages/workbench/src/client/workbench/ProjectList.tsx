import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import type { ProjectId } from '../../domain/ids.js'
import type { WorkbenchState } from './store.js'
import { dialogStyle } from './styles.js'

export interface FocusTarget { focus(): void; readonly isConnected?: boolean }

/** Native modal ownership: React owns lifetime; the browser owns the modal stack. */
export function NativeDialog({ marker, heading, children, onClose, restoreFocus, workbench = false }: {
  marker: 'overlay' | 'create-dialog' | 'delete-dialog' | 'discard-dialog'
  heading: string; children: ReactNode; onClose(): void; restoreFocus?: () => void; workbench?: boolean
}) {
  const id = useId()
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    const invoker = dialog.ownerDocument.activeElement as (Element & FocusTarget) | null
    dialog.showModal()
    return () => {
      if (dialog.open) dialog.close()
      if (restoreFocus) restoreFocus()
      else if (invoker?.isConnected) invoker.focus()
    }
  }, [])
  return <dialog ref={ref} data-dsh-pm-workbench={marker} className={workbench ? 'pmwb' : undefined}
    style={dialogStyle} aria-labelledby={id} onCancel={event => {
      event.preventDefault(); event.stopPropagation()
      if (event.target === event.currentTarget) onClose()
    }}>
    <h1 id={id}>{heading}</h1>{children}
  </dialog>
}

export function CreateProjectDialog({ pending, uncertain, error, onCreate, onClose }: {
  pending: boolean; uncertain: boolean; error?: string; onCreate(name: string, goal: string | null, attested: boolean): void; onClose(): void
}) {
  const id = useId()
  const [name, setName] = useState(''), [goal, setGoal] = useState(''), [attested, setAttested] = useState(false)
  return <NativeDialog marker="create-dialog" heading="新建项目" onClose={onClose}>
    <label id={`${id}-name`} htmlFor={`${id}-name-input`}>项目名称</label>
    <input id={`${id}-name-input`} aria-labelledby={`${id}-name`} data-dsh-pm-workbench="project-name" value={name} disabled={pending || uncertain} onChange={event => setName(event.currentTarget.value)} />
    <label id={`${id}-goal`} htmlFor={`${id}-goal-input`}>研究目标（可选）</label>
    <textarea id={`${id}-goal-input`} aria-labelledby={`${id}-goal`} data-dsh-pm-workbench="research-goal" value={goal} disabled={pending || uncertain} onChange={event => setGoal(event.currentTarget.value)} />
    <label><input type="checkbox" data-dsh-pm-workbench="create-synthetic-attestation" checked={attested} disabled={pending || uncertain} onChange={event => setAttested(event.currentTarget.checked)} />
      我确认此项目仅用于合成测试，不含真实个人或客户数据</label>
    {error && <p role="alert">{error}</p>}
    {uncertain && <p>结果待确认，请返回工作台重试原操作或刷新。关闭此窗口不会撤销已发送的操作。</p>}
    <div className="pmwb-actions">
      <button type="button" onClick={onClose}>{uncertain ? '返回工作台' : '取消新建'}</button>
      <button type="button" data-dsh-pm-workbench="confirm-create" disabled={pending || uncertain || !attested || !name.trim()}
        onClick={() => { if (!pending && !uncertain && attested && name.trim()) onCreate(name, goal.trim() ? goal : null, attested) }}>确认新建</button>
    </div>
  </NativeDialog>
}

export function ProjectList({ state, onNew, onSelect }: {
  state: WorkbenchState; onNew?: () => void; onSelect?: (id: ProjectId) => void
}) {
  return <aside data-dsh-pm-workbench="project-list">
    <h2>项目</h2>
    <button type="button" data-dsh-pm-workbench="new-project" disabled={state.projects.length >= 20} onClick={onNew}>新建项目</button>
    {state.projects.length >= 20 && <p>已达到 20 个项目上限</p>}
    {state.projects.length === 0 && <p>暂时没有项目</p>}
    <ul>{state.projects.map(project => <li key={project.id}>
      <button type="button" data-project-id={project.id} aria-current={state.selectedProjectId === project.id ? 'true' : undefined}
        onClick={() => onSelect?.(project.id)}>{project.name}</button>
      <p>{project.researchGoal || '研究目标未提供'}</p>
      <small>更新时间：{project.updatedAt}</small>
    </li>)}</ul>
  </aside>
}
