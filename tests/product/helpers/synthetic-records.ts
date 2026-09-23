import {
  baselineIdSchema,
  commandIdSchema,
  generatedDraftIdSchema,
  projectIdSchema,
  requirementIdSchema,
  sha256HexSchema,
  sourceRevisionIdSchema,
  type ProjectId,
} from '../../../packages/workbench/src/domain/ids.js'
import { MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES } from '../../../packages/workbench/src/domain/limits.js'
import type {
  ActiveProjectRecord,
  DeletedProjectTombstone,
  RequirementBaseline,
  RequirementBaselineItem,
} from '../../../packages/workbench/src/domain/model.js'
import { canonicalJsonUtf8Bytes } from '../../../packages/workbench/src/protocol/canonical-json.js'

const AT = '2026-09-07T00:00:00.000Z'
const HASH = sha256HexSchema.parse('0'.repeat(64))
const SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000001')

export const SMALL_PROJECT_ID = projectIdSchema.parse('00000000-0000-4000-8000-000000000001')
export const OTHER_PROJECT_ID = projectIdSchema.parse('00000000-0000-4000-8000-000000000002')
const DELETE_COMMAND_ID = commandIdSchema.parse('20000000-0000-4000-8000-000000000001')

export function makeSmallActiveRecord(options: {
  readonly projectId?: ProjectId
  readonly name?: string
  readonly researchGoal?: string | null
} = {}): ActiveProjectRecord {
  return {
    kind: 'active',
    schemaVersion: 1,
    header: {
      id: options.projectId ?? SMALL_PROJECT_ID,
      name: options.name ?? 'Synthetic project',
      researchGoal: options.researchGoal === undefined ? null : options.researchGoal,
      projectVersion: 1,
      contentVersion: 0,
      reviewStarted: false,
      updatedAt: AT,
    },
    source: null,
    analyses: [],
    currentAnalysisRevisionId: null,
    evidence: [],
    generatedRequirements: [],
    humanRevisions: [],
    humanDecisions: [],
    requirementOrder: [],
    baselines: [],
    currentBaselineId: null,
    prdRevisions: [],
    commandReceipts: [],
  }
}

export function makeTombstone(): DeletedProjectTombstone {
  return {
    kind: 'deleted',
    schemaVersion: 1,
    projectId: SMALL_PROJECT_ID,
    deletedAt: AT,
    deleteCommandId: DELETE_COMMAND_ID,
    deleteRequestHash: HASH,
    deleteOutcome: { ok: true, projectVersion: 2 },
  }
}

function indexedUuid(prefix: string, index: number): string {
  return `${prefix.padEnd(8, '0')}-0000-4000-8000-${index.toString(16).padStart(12, '0')}`
}

function exactUtf8Bytes(bytes: number): string {
  return `${'é'.repeat(Math.floor(bytes / 2))}${bytes % 2 === 0 ? '' : 'x'}`
}

function makeLargeRecord(commonCodePoints: number, specialDescription: string): ActiveProjectRecord {
  const common = '中'.repeat(commonCodePoints)
  const baselines: RequirementBaseline[] = []
  for (let baselineIndex = 0; baselineIndex < 8; baselineIndex += 1) {
    const items: RequirementBaselineItem[] = []
    for (let itemIndex = 0; itemIndex < 24; itemIndex += 1) {
      const ordinal = baselineIndex * 24 + itemIndex + 1
      const draftId = generatedDraftIdSchema.parse(indexedUuid('3', ordinal))
      items.push({
        rank: itemIndex + 1,
        requirementId: requirementIdSchema.parse(indexedUuid('4', ordinal)),
        textSource: { kind: 'generated', draftId, producer: 'fixture' },
        title: common,
        painPoint: common,
        description: baselineIndex === 7 && itemIndex === 23 ? specialDescription : common,
        priority: 'medium',
        humanReason: common,
        evidence: [],
      })
    }
    baselines.push({
      id: baselineIdSchema.parse(indexedUuid('5', baselineIndex + 1)),
      projectId: SMALL_PROJECT_ID,
      projectName: 'Synthetic project',
      researchGoal: null,
      sourceRevisionId: SOURCE_ID,
      sourceContentHash: HASH,
      projectVersion: baselineIndex + 2,
      contentVersion: 1,
      items,
      createdAt: AT,
    })
  }
  return {
    ...makeSmallActiveRecord(),
    header: {
      ...makeSmallActiveRecord().header,
      projectVersion: 9,
      contentVersion: 1,
      reviewStarted: true,
    },
    baselines,
    currentBaselineId: baselines[7]?.id ?? null,
  }
}

let nearLimitRecord: ActiveProjectRecord | undefined

export function makeNearLimitActiveRecord(): ActiveProjectRecord {
  if (nearLimitRecord) return nearLimitRecord
  let low = 1
  let high = 2_000
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const candidate = makeLargeRecord(middle, 'x')
    if (canonicalJsonUtf8Bytes(candidate) <= MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES) low = middle
    else high = middle - 1
  }
  const base = makeLargeRecord(low, 'x')
  const remaining = MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES - canonicalJsonUtf8Bytes(base)
  nearLimitRecord = makeLargeRecord(low, exactUtf8Bytes(remaining + 1))
  return nearLimitRecord
}

export function makeOverLimitActiveRecord(): ActiveProjectRecord {
  const near = makeNearLimitActiveRecord()
  const lastBaseline = near.baselines[near.baselines.length - 1]
  const lastItem = lastBaseline?.items[lastBaseline.items.length - 1]
  if (!lastBaseline || !lastItem) throw new Error('synthetic-builder-failed')
  const items = [
    ...lastBaseline.items.slice(0, -1),
    { ...lastItem, description: `${lastItem.description}x` },
  ]
  return {
    ...near,
    baselines: [
      ...near.baselines.slice(0, -1),
      { ...lastBaseline, items },
    ],
  }
}
