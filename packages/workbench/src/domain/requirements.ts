import type {
  RequirementId,
  RequirementRevisionId,
} from './ids.js'
import {
  MAX_HUMAN_REASON_CODE_POINTS,
  MAX_HUMAN_REASON_UTF8_BYTES,
  hasUnpairedSurrogate,
  unicodeCodePointLength,
  utf8ByteLength,
} from './limits.js'
import {
  deepFreeze,
  generatedRequirementDraftSchema,
  humanDecisionSchema,
  humanRequirementRevisionSchema,
  type ActiveProjectRecord,
  type GeneratedRequirementDraft,
  type HumanDecision,
  type HumanRequirementRevision,
} from './model.js'

export type RequirementSelectedText = HumanDecision['selectedText']

export interface RequirementUpdate {
  readonly requirementId: RequirementId
  readonly humanRevisionId?: RequirementRevisionId
  readonly title?: string
  readonly painPoint?: string
  readonly description?: string
  readonly selectedText?: RequirementSelectedText
  readonly priority?: HumanDecision['priority']
  readonly decision?: HumanDecision['decision']
  readonly humanReason?: string
}

function failUpdate(code = 'baseline-stale'): never {
  throw new Error(code)
}

function currentDrafts(project: ActiveProjectRecord): readonly GeneratedRequirementDraft[] {
  const currentId = project.currentAnalysisRevisionId
  const currentAnalysis = project.analyses.filter(item => item.id === currentId && item.status === 'draft')
  if (currentId === null
    || project.source === null
    || currentAnalysis.length !== 1
    || currentAnalysis[0]!.sourceRevisionId !== project.source.id) {
    return failUpdate()
  }
  const drafts = project.generatedRequirements.filter(item => item.analysisRevisionId === currentId)
  if (drafts.length === 0
    || drafts.some(item => item.sourceRevisionId !== project.source!.id)
    || drafts.some(item => !generatedRequirementDraftSchema.safeParse(item).success)
    || new Set(drafts.map(item => item.id)).size !== drafts.length
    || new Set(drafts.map(item => item.requirementId)).size !== drafts.length) failUpdate()
  return drafts
}

function findCurrentDraft(project: ActiveProjectRecord, requirementId: RequirementId): GeneratedRequirementDraft {
  const draft = currentDrafts(project).find(item => item.requirementId === requirementId)
  return draft ?? failUpdate()
}

function findSelectedRevision(
  project: ActiveProjectRecord,
  draft: GeneratedRequirementDraft,
  selectedText: RequirementSelectedText,
): HumanRequirementRevision | undefined {
  if (selectedText.kind === 'generated') {
    if (selectedText.draftId !== draft.id) failUpdate()
    return undefined
  }
  const matches = project.humanRevisions.filter(item => item.id === selectedText.revisionId)
  const revision = matches[0]
  if (matches.length !== 1
    || !revision
    || revision.requirementId !== draft.requirementId
    || revision.basedOnDraftId !== draft.id) failUpdate()
  return revision
}

function defaultDecision(draft: GeneratedRequirementDraft): HumanDecision {
  return {
    requirementId: draft.requirementId,
    selectedText: { kind: 'generated', draftId: draft.id },
    priority: draft.suggestedPriority,
    decision: 'pending',
    humanReason: '',
  }
}

function validateHumanReason(value: string): void {
  if (hasUnpairedSurrogate(value)
    || unicodeCodePointLength(value) > MAX_HUMAN_REASON_CODE_POINTS
    || utf8ByteLength(value) > MAX_HUMAN_REASON_UTF8_BYTES) failUpdate('limit-exceeded')
}

export function applyRequirementUpdate(
  project: ActiveProjectRecord,
  update: RequirementUpdate,
): ActiveProjectRecord {
  const draft = findCurrentDraft(project, update.requirementId)
  const matchingDecisions = project.humanDecisions.filter(item => item.requirementId === update.requirementId)
  if (matchingDecisions.length > 1) failUpdate()
  const previousDecision = matchingDecisions[0] ?? defaultDecision(draft)
  const previousRevision = findSelectedRevision(project, draft, previousDecision.selectedText)
  const editsText = update.title !== undefined
    || update.painPoint !== undefined
    || update.description !== undefined

  let createdRevision: HumanRequirementRevision | undefined
  if (editsText) {
    if (!update.humanRevisionId
      || project.humanRevisions.some(item => item.id === update.humanRevisionId)) failUpdate()
    createdRevision = {
      id: update.humanRevisionId,
      requirementId: draft.requirementId,
      basedOnDraftId: draft.id,
      title: update.title ?? previousRevision?.title ?? draft.title,
      painPoint: update.painPoint ?? previousRevision?.painPoint ?? draft.painPoint,
      description: update.description ?? previousRevision?.description ?? draft.description,
    }
    if (!humanRequirementRevisionSchema.safeParse(createdRevision).success) failUpdate()
  } else if (update.humanRevisionId !== undefined) {
    failUpdate()
  }

  let selectedText = update.selectedText ?? previousDecision.selectedText
  if (createdRevision) {
    const createdSelection: RequirementSelectedText = {
      kind: 'human-revision',
      revisionId: createdRevision.id,
    }
    if (update.selectedText !== undefined
      && (update.selectedText.kind !== 'human-revision'
        || update.selectedText.revisionId !== createdRevision.id)) failUpdate()
    selectedText = createdSelection
  }
  if (selectedText.kind === 'human-revision' && createdRevision?.id === selectedText.revisionId) {
    // The newly constructed revision was validated above.
  } else {
    findSelectedRevision(project, draft, selectedText)
  }

  const humanReason = update.humanReason ?? previousDecision.humanReason
  validateHumanReason(humanReason)
  const nextDecision: HumanDecision = {
    requirementId: draft.requirementId,
    selectedText,
    priority: update.priority ?? previousDecision.priority,
    decision: update.decision ?? previousDecision.decision,
    humanReason,
  }
  if (!humanDecisionSchema.safeParse(nextDecision).success) failUpdate()
  if (nextDecision.decision === 'include') {
    if (new Set(draft.evidenceIds).size !== draft.evidenceIds.length) failUpdate('invalid-evidence')
    const linkedEvidence = draft.evidenceIds.map(id => project.evidence.filter(item => item.id === id))
    if (linkedEvidence.some(matches => matches.length !== 1)
      || linkedEvidence.flat().some(item => item.sourceRevisionId !== project.source!.id)
      || !linkedEvidence.flat().some(item => item.role === 'support')) failUpdate('invalid-evidence')
  }

  const nextDecisions = project.humanDecisions.filter(item => item.requirementId !== update.requirementId)
  const desiredIndex = project.humanDecisions.findIndex(item => item.requirementId === update.requirementId)
  if (desiredIndex < 0) nextDecisions.push(nextDecision)
  else nextDecisions.splice(desiredIndex, 0, nextDecision)

  return deepFreeze(structuredClone({
    ...project,
    header: { ...project.header, reviewStarted: true },
    humanRevisions: createdRevision
      ? [...project.humanRevisions, createdRevision]
      : [...project.humanRevisions],
    humanDecisions: nextDecisions,
  })) as ActiveProjectRecord
}

export function applyRequirementOrder(
  project: ActiveProjectRecord,
  order: readonly RequirementId[],
): ActiveProjectRecord {
  const expected = currentDrafts(project).map(item => item.requirementId)
  if (order.length !== expected.length
    || new Set(order).size !== order.length
    || expected.some(id => !order.includes(id))) failUpdate()

  return deepFreeze(structuredClone({
    ...project,
    header: { ...project.header, reviewStarted: true },
    requirementOrder: [...order],
  })) as ActiveProjectRecord
}
