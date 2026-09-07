/** Host metadata only; neither clock values nor locale enter rendered PRD bytes. */
export interface Clock {
  now(): string
}

export const systemClock: Clock = Object.freeze({ now: () => new Date().toISOString() })
