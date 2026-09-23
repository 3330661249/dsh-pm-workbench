import { MAX_EVIDENCE_QUOTE_CODE_POINTS } from '../domain/limits.js'

export interface SourceSegment {
  readonly segmentId: string
  readonly text: string
  readonly start: number
  readonly end: number
}

/** IDs are scoped to one frozen source. Preserve exact text and UTF-16 offsets. */
export function sourceSegments(source: string): readonly SourceSegment[] {
  const segments: SourceSegment[] = []
  for (const line of source.matchAll(/[^\r\n]+/gu)) {
    if (!line[0].trim()) continue
    const points = Array.from(line[0])
    let start = line.index!
    for (let offset = 0; offset < points.length; offset += MAX_EVIDENCE_QUOTE_CODE_POINTS) {
      const text = points.slice(offset, offset + MAX_EVIDENCE_QUOTE_CODE_POINTS).join('')
      segments.push({ segmentId: `S${segments.length + 1}`, text, start, end: start + text.length })
      start += text.length
    }
  }
  return segments
}
