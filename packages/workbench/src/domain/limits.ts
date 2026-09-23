export const MAX_ACTIVE_PROJECTS = 20 as const
export const MAX_TOMBSTONES_BEFORE_CREATE_BLOCKED = 1_024 as const
export const MAX_PROJECT_ROWS = 1_044 as const

export const MAX_PROJECT_NAME_CODE_POINTS = 120 as const
export const MAX_PROJECT_NAME_UTF8_BYTES = 512 as const
export const MAX_RESEARCH_GOAL_CODE_POINTS = 500 as const
export const MAX_RESEARCH_GOAL_UTF8_BYTES = 2_048 as const

export const MAX_SOURCE_RAW_UTF8_BYTES = 262_144 as const
export const MAX_SOURCE_PERSISTED_UTF8_BYTES = 262_144 as const
export const MAX_SOURCE_UTF16_CODE_UNITS = 80_000 as const

export const MAX_REQUIREMENTS_PER_ANALYSIS = 24 as const
export const MAX_EVIDENCE_PER_ANALYSIS = 96 as const
export const MAX_EVIDENCE_QUOTE_CODE_POINTS = 4_000 as const
export const MAX_EVIDENCE_QUOTE_UTF8_BYTES = 16_384 as const
export const MAX_PROJECT_EVIDENCE_QUOTE_UTF8_BYTES = 131_072 as const

export const MAX_ASSUMPTIONS_PER_REQUIREMENT = 20 as const
export const MAX_UNKNOWNS_PER_REQUIREMENT = 20 as const
export const MAX_ASSUMPTION_OR_UNKNOWN_CODE_POINTS = 500 as const
export const MAX_ASSUMPTION_OR_UNKNOWN_UTF8_BYTES = 2_048 as const
export const MAX_ASSUMPTIONS_UTF8_BYTES_PER_REQUIREMENT = 8_192 as const
export const MAX_UNKNOWNS_UTF8_BYTES_PER_REQUIREMENT = 8_192 as const
export const MAX_ANALYSIS_ASSUMPTIONS_AND_UNKNOWNS_UTF8_BYTES = 65_536 as const

export const MAX_REQUIREMENT_TEXT_CODE_POINTS = 2_000 as const
export const MAX_REQUIREMENT_TEXT_UTF8_BYTES = 8_192 as const
export const MAX_HUMAN_REASON_CODE_POINTS = 2_000 as const
export const MAX_HUMAN_REASON_UTF8_BYTES = 8_192 as const

export const MAX_BASELINES_PER_PROJECT = 8 as const
export const MAX_PRD_REVISIONS_PER_PROJECT = 8 as const
export const MAX_COMMAND_RECEIPTS_PER_PROJECT = 256 as const
export const MAX_PRD_MARKDOWN_UTF8_BYTES = 262_144 as const
export const MAX_ACTIVE_PROJECT_RECORD_UTF8_BYTES = 4_194_304 as const
export const MAX_TOMBSTONE_UTF8_BYTES = 2_048 as const
export const MAX_PROFILE_ACTIVE_RECORD_UTF8_BYTES = 83_886_080 as const

export function hasUnpairedSurrogate(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) return true
      const next = value.charCodeAt(index + 1)
      if (next < 0xdc00 || next > 0xdfff) return true
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return true
    }
  }
  return false
}

export function unicodeCodePointLength(value: string): number {
  return [...value].length
}

export function utf8ByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength
}
