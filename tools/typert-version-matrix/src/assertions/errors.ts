export class CompatibilityEvidenceError extends Error {
  readonly status = 'FAIL_COMPATIBILITY' as const

  constructor(readonly code: string, message: string) {
    super(message)
    this.name = 'CompatibilityEvidenceError'
  }
}

export class AdapterEvidenceError extends Error {
  readonly status = 'INCONCLUSIVE_ADAPTER' as const

  constructor(message: string) {
    super(message)
    this.name = 'AdapterEvidenceError'
  }
}
