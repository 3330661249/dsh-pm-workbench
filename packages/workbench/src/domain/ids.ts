import { z } from 'zod'

const canonicalUuidV4Definition = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  'invalid-canonical-uuid-v4',
)

export const projectIdSchema = canonicalUuidV4Definition.brand<'ProjectId'>()
export type ProjectId = z.infer<typeof projectIdSchema>

export const sourceRevisionIdSchema = canonicalUuidV4Definition.brand<'SourceRevisionId'>()
export type SourceRevisionId = z.infer<typeof sourceRevisionIdSchema>

export const analysisRevisionIdSchema = canonicalUuidV4Definition.brand<'AnalysisRevisionId'>()
export type AnalysisRevisionId = z.infer<typeof analysisRevisionIdSchema>

export const evidenceIdSchema = canonicalUuidV4Definition.brand<'EvidenceId'>()
export type EvidenceId = z.infer<typeof evidenceIdSchema>

export const requirementIdSchema = canonicalUuidV4Definition.brand<'RequirementId'>()
export type RequirementId = z.infer<typeof requirementIdSchema>

export const generatedDraftIdSchema = canonicalUuidV4Definition.brand<'GeneratedDraftId'>()
export type GeneratedDraftId = z.infer<typeof generatedDraftIdSchema>

export const requirementRevisionIdSchema = canonicalUuidV4Definition.brand<'RequirementRevisionId'>()
export type RequirementRevisionId = z.infer<typeof requirementRevisionIdSchema>

export const baselineIdSchema = canonicalUuidV4Definition.brand<'BaselineId'>()
export type BaselineId = z.infer<typeof baselineIdSchema>

export const prdRevisionIdSchema = canonicalUuidV4Definition.brand<'PrdRevisionId'>()
export type PrdRevisionId = z.infer<typeof prdRevisionIdSchema>

export const commandIdSchema = canonicalUuidV4Definition.brand<'CommandId'>()
export type CommandId = z.infer<typeof commandIdSchema>

export const sha256HexSchema = z.string().regex(/^[0-9a-f]{64}$/, 'invalid-lowercase-sha256').brand<'Sha256Hex'>()
export type Sha256Hex = z.infer<typeof sha256HexSchema>
