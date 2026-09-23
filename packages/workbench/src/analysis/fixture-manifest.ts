import {
  analysisRevisionIdSchema,
  evidenceIdSchema,
  generatedDraftIdSchema,
  requirementIdSchema,
  sha256HexSchema,
  sourceRevisionIdSchema,
} from '../domain/ids.js'
import type { AnalysisCandidate } from '../domain/model.js'
import { deepFreeze, type FixtureManifest } from './types.js'

export const BUILT_IN_SYNTHETIC_TEXT = '主持人：请描述你整理访谈记录时遇到的问题。\n受访者：我经常找不到原话，整理一次要来回搜索。\n受访者：我经常找不到原话，尤其是相似表述很多的时候。\n受访者：不过短访谈只有一两段时，我直接阅读更快，不需要额外工具。\n主持人：如果生成需求草稿，你最担心什么？\n受访者：我担心草稿把推测写成事实，也担心看不到对应原文。\n'

export const BUILT_IN_SYNTHETIC_HASH = sha256HexSchema.parse(
  'aadb7945ca89bfefcf8678f194c43ba84c93bdef602c3a91cd9901b097e7b67c',
)

const TEMPLATE_SOURCE_ID = sourceRevisionIdSchema.parse('10000000-0000-4000-8000-000000000301')
const TEMPLATE_ANALYSIS_ID = analysisRevisionIdSchema.parse('20000000-0000-4000-8000-000000000301')

const candidate: AnalysisCandidate = {
  analysis: {
    id: TEMPLATE_ANALYSIS_ID,
    sourceRevisionId: TEMPLATE_SOURCE_ID,
    kind: 'fixture',
    generation: 1,
    baseProjectVersion: 2,
    status: 'draft',
  },
  evidence: [
    {
      id: evidenceIdSchema.parse('30000000-0000-4000-8000-000000000301'),
      sourceRevisionId: TEMPLATE_SOURCE_ID,
      role: 'support',
      start: 26,
      end: 45,
      quote: '我经常找不到原话，整理一次要来回搜索。',
      quoteHash: sha256HexSchema.parse('41bda411fe65dd54c83a6df092ff730f397f25bcf7d96d189cd927ab75992b8a'),
    },
    {
      id: evidenceIdSchema.parse('30000000-0000-4000-8000-000000000302'),
      sourceRevisionId: TEMPLATE_SOURCE_ID,
      role: 'support',
      start: 50,
      end: 72,
      quote: '我经常找不到原话，尤其是相似表述很多的时候。',
      quoteHash: sha256HexSchema.parse('627742ffbbfc40f7e40b320126b02cbd33f5350346cc00fde99b4f193e98c5a2'),
    },
    {
      id: evidenceIdSchema.parse('30000000-0000-4000-8000-000000000303'),
      sourceRevisionId: TEMPLATE_SOURCE_ID,
      role: 'counterexample',
      start: 77,
      end: 105,
      quote: '不过短访谈只有一两段时，我直接阅读更快，不需要额外工具。',
      quoteHash: sha256HexSchema.parse('7bbcf228eabf144c60c4fb8ae27b272f3dc1c1bafedcac73f4b78af10b9b0dc2'),
    },
    {
      id: evidenceIdSchema.parse('30000000-0000-4000-8000-000000000304'),
      sourceRevisionId: TEMPLATE_SOURCE_ID,
      role: 'context',
      start: 131,
      end: 155,
      quote: '我担心草稿把推测写成事实，也担心看不到对应原文。',
      quoteHash: sha256HexSchema.parse('3b8ef17392299cccfb6318f57efc36c8f83aafc22b1d531ba10973bd66302f66'),
    },
  ],
  generatedRequirements: [
    {
      id: generatedDraftIdSchema.parse('50000000-0000-4000-8000-000000000301'),
      requirementId: requirementIdSchema.parse('40000000-0000-4000-8000-000000000301'),
      analysisRevisionId: TEMPLATE_ANALYSIS_ID,
      sourceRevisionId: TEMPLATE_SOURCE_ID,
      producer: 'fixture',
      title: '让需求草稿可回到逐字原文',
      painPoint: '整理者在相似表述较多时反复搜索原话，并担心草稿把推测写成事实。',
      description: '为本地测试草稿显示逐字引用、引用角色和定位信息，保留短材料直接阅读更快的相反情况。',
      evidenceIds: [
        evidenceIdSchema.parse('30000000-0000-4000-8000-000000000301'),
        evidenceIdSchema.parse('30000000-0000-4000-8000-000000000302'),
        evidenceIdSchema.parse('30000000-0000-4000-8000-000000000303'),
        evidenceIdSchema.parse('30000000-0000-4000-8000-000000000304'),
      ],
      rationale: '两次相同问题表述支持原文定位，但同一受访者的重复表达不代表多个用户；短材料反例限制适用场景。',
      assumptions: ['整理者需要从草稿回看原始访谈上下文'],
      unknowns: ['长访谈中定位原话能节省多少时间', '不同整理者是否有相同问题'],
      suggestedPriority: 'high',
    },
  ],
}

export const FIXTURE_MANIFEST: FixtureManifest = deepFreeze({
  schemaVersion: 1,
  sources: {
    [BUILT_IN_SYNTHETIC_HASH]: { candidate },
  },
})
