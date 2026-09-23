import { z } from 'zod'
export const CHANNEL = '/dsh-pm-workbench-stage3a-storage-gate-v1'
export const LIMIT = 4_194_304
export const PHASES = ['write-small', 'read-small', 'write-tombstone', 'read-tombstone', 'write-near-limit', 'read-near-limit', 'reject-over-limit'] as const
export const recordSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('active'), id: z.string(), bytes: z.number().int(), hash: z.string().regex(/^[a-f0-9]{64}$/), padding: z.string() }),
  z.strictObject({ kind: z.literal('deleted'), id: z.string(), deletedAt: z.string(), deleteCommandId: z.string(), requestHash: z.string().regex(/^[a-f0-9]{64}$/) }),
])
export type RecordValue = z.infer<typeof recordSchema>
export const witnessSchema = z.strictObject({ ok: z.boolean(), bytes: z.number().int().nonnegative(), hash: z.string().regex(/^[a-f0-9]{64}$/), hidden: z.boolean(), backendCalls: z.number().int().nonnegative() })
export function serialize(record: RecordValue) { return JSON.stringify(recordSchema.parse(record)) }
