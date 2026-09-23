import { validateEvidence } from './evidence.js'
import type { BaselineId, Sha256Hex } from './ids.js'
import { MAX_BASELINES_PER_PROJECT } from './limits.js'
import {
  deepFreeze,
  generatedRequirementDraftSchema,
  humanDecisionSchema,
  requirementBaselineSchema,
  type ActiveProjectRecord,
  type EvidenceExcerpt,
  type GeneratedRequirementDraft,
  type HumanDecision,
  type RequirementBaseline,
  type RequirementBaselineItem,
} from './model.js'

export interface PublishRequirementBaselineInput {
  readonly baselineId: BaselineId
  readonly createdAt: string
  readonly sha256Utf8: (value: string) => Sha256Hex
}

function failBaseline(code = 'baseline-stale'): never {
  throw new Error(code)
}

function exactPermutation(actual: readonly string[], expected: readonly string[]): boolean {
  return actual.length === expected.length
    && new Set(actual).size === actual.length
    && expected.every(value => actual.includes(value))
}

function selectedText(
  project: ActiveProjectRecord,
  draft: GeneratedRequirementDraft,
  decision: HumanDecision,
): Pick<RequirementBaselineItem, 'textSource' | 'title' | 'painPoint' | 'description'> {
  if (decision.selectedText.kind === 'generated') {
    if (decision.selectedText.draftId !== draft.id) failBaseline()
    return {
      textSource: { kind: 'generated', draftId: draft.id, producer: draft.producer },
      title: draft.title,
      painPoint: draft.painPoint,
      description: draft.description,
    }
  }
  const revisionId = decision.selectedText.revisionId
  const matches = project.humanRevisions.filter(item => item.id === revisionId)
  if (matches.length !== 1) failBaseline()
  const revision = matches[0]!
  if (revision.requirementId !== draft.requirementId || revision.basedOnDraftId !== draft.id) failBaseline()
  return {
    textSource: {
      kind: 'human-revision',
      draftId: draft.id,
      revisionId: revision.id,
    },
    title: revision.title,
    painPoint: revision.painPoint,
    description: revision.description,
  }
}

function verifiedEvidence(
  project: ActiveProjectRecord,
  draft: GeneratedRequirementDraft,
  sha256Utf8: (value: string) => Sha256Hex,
): readonly EvidenceExcerpt[] {
  if (!project.source || draft.sourceRevisionId !== project.source.id) failBaseline()
  if (new Set(draft.evidenceIds).size !== draft.evidenceIds.length) failBaseline('invalid-evidence')
  const result = draft.evidenceIds.map(id => {
    const matches = project.evidence.filter(item => item.id === id)
    if (matches.length !== 1) failBaseline('invalid-evidence')
    try {
      return validateEvidence(project.source!, matches[0]!, sha256Utf8)
    } catch {
      return failBaseline('invalid-evidence')
    }
  })
  if (!result.some(item => item.role === 'support')) failBaseline('invalid-evidence')
  return result
}

export function publishRequirementBaseline(
  project: ActiveProjectRecord,
  input: PublishRequirementBaselineInput,
): RequirementBaseline {
  if (project.baselines.length >= MAX_BASELINES_PER_PROJECT) failBaseline('limit-exceeded')
  if (project.baselines.some(item => item.id === input.baselineId)) failBaseline()
  const currentAnalysisId = project.currentAnalysisRevisionId
  if (!project.source || currentAnalysisId === null) failBaseline()
  const currentAnalysis = project.analyses.filter(item => item.id === currentAnalysisId && item.status === 'draft')
  if (currentAnalysis.length !== 1 || currentAnalysis[0]!.sourceRevisionId !== project.source.id) failBaseline()

  const drafts = project.generatedRequirements.filter(item => item.analysisRevisionId === currentAnalysisId)
  const requirementIds = drafts.map(item => item.requirementId)
  if (drafts.length === 0
    || drafts.some(item => !generatedRequirementDraftSchema.safeParse(item).success)
    || new Set(drafts.map(item => item.id)).size !== drafts.length
    || new Set(requirementIds).size !== drafts.length
    || !exactPermutation(project.requirementOrder, requirementIds)) failBaseline()

  if (project.humanDecisions.length !== drafts.length
    || new Set(project.humanDecisions.map(item => item.requirementId)).size !== drafts.length
    || !exactPermutation(project.humanDecisions.map(item => item.requirementId), requirementIds)) failBaseline()
  if (project.humanDecisions.some(item => !humanDecisionSchema.safeParse(item).success)) failBaseline()

  const decisions = new Map(project.humanDecisions.map(item => [item.requirementId, item]))
  const items: RequirementBaselineItem[] = []
  const excludedRequirements: NonNullable<RequirementBaseline['excludedRequirements']>[number][] = []
  for (const requirementId of project.requirementOrder) {
    const draft = drafts.find(item => item.requirementId === requirementId) ?? failBaseline()
    const decision = decisions.get(requirementId) ?? failBaseline()
    const text = selectedText(project, draft, decision)
    if (decision.decision !== 'include') {
      excludedRequirements.push({ requirementId, title: text.title, description: text.description,
        decision: decision.decision, humanReason: decision.humanReason })
      continue
    }
    items.push({
      rank: items.length + 1,
      requirementId,
      ...text,
      priority: decision.priority,
      humanReason: decision.humanReason,
      assumptions: [...draft.assumptions],
      unknowns: [...draft.unknowns],
      evidence: verifiedEvidence(project, draft, input.sha256Utf8).map(item => structuredClone(item)),
    })
  }
  if (items.length === 0) failBaseline('no-included-requirements')

  const baseline: RequirementBaseline = {
    id: input.baselineId,
    projectId: project.header.id,
    projectName: project.header.name,
    researchGoal: project.header.researchGoal,
    sourceRevisionId: project.source.id,
    sourceContentHash: project.source.contentHash,
    projectVersion: project.header.projectVersion,
    contentVersion: project.header.contentVersion,
    items,
    excludedRequirements,
    createdAt: input.createdAt,
  }
  if (!requirementBaselineSchema.safeParse(baseline).success) failBaseline('limit-exceeded')
  return deepFreeze(structuredClone(baseline))
}
