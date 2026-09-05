export const MAX_UPLOAD_BYTES = 256 * 1024
export const MAX_MATERIAL_CODE_UNITS = 80_000

export type MaterialFormat = 'pasted' | 'text/plain' | 'text/markdown'
export type Priority = 'high' | 'medium' | 'low'
export type Decision = 'pending' | 'include' | 'defer' | 'reject'

export interface Material {
  readonly text: string
  readonly displayName: string
  readonly format: MaterialFormat
}

export interface Citation {
  readonly start: number
  readonly end: number
  readonly text: string
}

interface RequirementBase {
  readonly id: string
  readonly fixtureLabel: '演示生成'
  readonly title: string
  readonly painPoint: string
  readonly description: string
  readonly demoReason: string
  readonly suggestedPriority: Priority
  readonly priority: Priority
  readonly decision: Decision
  readonly humanReason: string
  readonly manuallyEdited: boolean
}

export interface CitedRequirement extends RequirementBase {
  readonly kind: 'cited'
  readonly citations: readonly [Citation, ...Citation[]]
}

export interface InferenceRequirement extends RequirementBase {
  readonly kind: 'inference'
  readonly citations: readonly []
}

export type RequirementCard = CitedRequirement | InferenceRequirement

export type DomainErrorCode =
  | 'empty-material'
  | 'nul-character'
  | 'unsupported-extension'
  | 'file-too-large'
  | 'invalid-utf8'
  | 'material-too-long'
  | 'invalid-citation'
  | 'invalid-card-shape'
  | 'inference-cannot-be-included'
  | 'material-required'
  | 'no-included-requirements'

export type DomainResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: { readonly code: DomainErrorCode; readonly message: string } }
