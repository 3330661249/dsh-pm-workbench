import { assertCardIntegrity } from './fixture-provider.js'
import type {
  CitedRequirement,
  Decision,
  DomainResult,
  Material,
  Priority,
  RequirementCard,
} from './types.js'

export interface ManualRequirementEdit {
  readonly title?: string
  readonly description?: string
  readonly painPoint?: string
  readonly priority?: Priority
  readonly decision?: Decision
  readonly humanReason?: string
}

export function applyManualEdit(
  material: Material,
  card: RequirementCard,
  edit: ManualRequirementEdit,
): DomainResult<RequirementCard> {
  const title = edit.title ?? card.title
  const description = edit.description ?? card.description
  const painPoint = edit.painPoint ?? card.painPoint
  const priority = edit.priority ?? card.priority
  const decision = edit.decision ?? card.decision
  const humanReason = edit.humanReason ?? card.humanReason
  const changed =
    title !== card.title ||
    description !== card.description ||
    painPoint !== card.painPoint ||
    priority !== card.priority ||
    decision !== card.decision ||
    humanReason !== card.humanReason

  const updated: RequirementCard = {
    ...card,
    title,
    description,
    painPoint,
    priority,
    decision,
    humanReason,
    manuallyEdited: card.manuallyEdited || changed,
  } as RequirementCard

  return assertCardIntegrity(material, updated)
}

export function eligibleRequirements(cards: readonly RequirementCard[]): readonly CitedRequirement[] {
  return cards.filter((card): card is CitedRequirement => card.kind === 'cited' && card.decision === 'include')
}
