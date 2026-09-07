import type { ConfirmationSnapshot, WorkbenchState } from './store.js'
import { decisionText, Evidence, priorityText, selectedRequirements } from './RequirementsPane.js'

export function PriorityPane({ state, confirmation, pending = false, onConfirm, onReview }: {
  state: WorkbenchState; confirmation?: ConfirmationSnapshot; pending?: boolean; onConfirm?: () => void; onReview?: () => void
}) {
  const valid = confirmation?.ok === true && state.saveState === 'saved' && !state.dirty && !pending
    && confirmation.project === state.selectedProject && confirmation.projectVersion === state.selectedProject.header.projectVersion
    && confirmation.contentVersion === state.selectedProject.header.contentVersion
  const project = valid ? confirmation.project : undefined
  const hasIncluded = project?.humanDecisions.some(item => item.decision === 'include') === true
  return <>
    <p>核对已保存的需求、人工决定与原文依据，再确认本期范围。</p>
    <button type="button" onClick={onReview} disabled={pending || state.saveState === 'uncertain' || state.saveState === 'saving'}>重新核对确认摘要</button>
    {project && <div data-dsh-pm-workbench="confirmation-summary" data-project-id={project.header.id}
      data-confirmation-project-version={project.header.projectVersion} data-confirmation-content-version={project.header.contentVersion}>
      <h3>{project.header.name}</h3><p>{project.header.researchGoal || '研究目标未提供'}</p>
      {selectedRequirements(project).map((item, index) => <article key={item.requirementId}>
        <h3>{index + 1}. {item.title}</h3>
        <dl><dt>痛点</dt><dd>{item.painPoint}</dd><dt>描述</dt><dd>{item.description}</dd><dt>优先级</dt><dd>{priorityText[item.priority]}</dd>
          <dt>决定</dt><dd>{decisionText[item.decision]}</dd><dt>人工理由</dt><dd>{item.humanReason || '未提供'}</dd></dl>
        {item.evidence.map(evidence => <Evidence key={evidence.id} evidence={evidence} source={state.selectedSource} />)}
      </article>)}
    </div>}
    {!project && <p>请先保存修改，再重新核对确认摘要。</p>}
    {project && !hasIncluded && <p>请至少选择一项纳入本期的需求并保存修改</p>}
    <button type="button" data-dsh-pm-workbench="confirm-scope" disabled={!valid || !hasIncluded || !!state.baselineChain} onClick={onConfirm}>确认本期需求并生成 PRD</button>
  </>
}
