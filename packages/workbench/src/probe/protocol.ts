import { z } from 'zod'

export const PROBE_RPC_CHANNEL = '/dsh-pm-workbench-v1' as const
export const MAX_PROBE_RPC_PAYLOAD_UTF8_BYTES = 4_096 as const
export const MAX_PROBE_COMMAND_RECEIPTS = 256 as const
export const MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES = 1_048_576 as const

export const PROBE_CAPABILITIES = Object.freeze({
  apiVersion: 'pmwb-v1' as const,
  wireSchemaVersion: '1' as const,
  dataSchemaVersion: '1' as const,
  pluginVersion: '0.1.0' as const,
  harnessTarget: '0.1.0-rc.6' as const,
  maxRpcPayloadUtf8Bytes: MAX_PROBE_RPC_PAYLOAD_UTF8_BYTES,
  maxTextUtf8Bytes: 0 as const,
  maxReadPageUtf8Bytes: 4_096 as const,
  maxCommandReceiptsPerAggregate: MAX_PROBE_COMMAND_RECEIPTS,
  maxReceiptLedgerPersistedBytes: MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES,
  maxClientInflightRequests: 8 as const,
  maxHostInflightRequests: 16 as const,
  supportedFeatures: Object.freeze(['health', 'synthetic-counter'] as const),
  storage: 'synthetic-counter-only' as const,
  analysis: 'none' as const,
})

export type ProbeCapabilities = typeof PROBE_CAPABILITIES

const nonNegativeSafeIntegerSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)
export const canonicalUuidV4Schema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
)

export const healthInputSchema = z.strictObject({})
export type HealthInput = z.infer<typeof healthInputSchema>

export const incrementCounterInputSchema = z.strictObject({
  apiVersion: z.literal('pmwb-v1'),
  expectedVersion: nonNegativeSafeIntegerSchema,
  commandId: canonicalUuidV4Schema,
  delta: z.literal(1),
})
export type IncrementCounterInput = z.infer<typeof incrementCounterInputSchema>

const probeCapabilitiesSchema = z.strictObject({
  apiVersion: z.literal(PROBE_CAPABILITIES.apiVersion),
  wireSchemaVersion: z.literal(PROBE_CAPABILITIES.wireSchemaVersion),
  dataSchemaVersion: z.literal(PROBE_CAPABILITIES.dataSchemaVersion),
  pluginVersion: z.literal(PROBE_CAPABILITIES.pluginVersion),
  harnessTarget: z.literal(PROBE_CAPABILITIES.harnessTarget),
  maxRpcPayloadUtf8Bytes: z.literal(PROBE_CAPABILITIES.maxRpcPayloadUtf8Bytes),
  maxTextUtf8Bytes: z.literal(PROBE_CAPABILITIES.maxTextUtf8Bytes),
  maxReadPageUtf8Bytes: z.literal(PROBE_CAPABILITIES.maxReadPageUtf8Bytes),
  maxCommandReceiptsPerAggregate: z.literal(PROBE_CAPABILITIES.maxCommandReceiptsPerAggregate),
  maxReceiptLedgerPersistedBytes: z.literal(PROBE_CAPABILITIES.maxReceiptLedgerPersistedBytes),
  maxClientInflightRequests: z.literal(PROBE_CAPABILITIES.maxClientInflightRequests),
  maxHostInflightRequests: z.literal(PROBE_CAPABILITIES.maxHostInflightRequests),
  supportedFeatures: z.tuple([z.literal('health'), z.literal('synthetic-counter')]),
  storage: z.literal(PROBE_CAPABILITIES.storage),
  analysis: z.literal(PROBE_CAPABILITIES.analysis),
})

const probeHealthValueSchemaDefinition = z.strictObject({
  mode: z.literal('gate-a-probe'),
  capabilities: probeCapabilitiesSchema,
  counter: nonNegativeSafeIntegerSchema,
  aggregateVersion: nonNegativeSafeIntegerSchema,
}).refine((value) => value.counter === value.aggregateVersion)
export interface ProbeHealthValue {
  readonly mode: 'gate-a-probe'
  readonly capabilities: ProbeCapabilities
  readonly counter: number
  readonly aggregateVersion: number
}
export type ProbeHealthOutput = ProbeHealthValue
export const probeHealthValueSchema: z.ZodType<ProbeHealthValue> = probeHealthValueSchemaDefinition

export const incrementCounterValueSchema = z.strictObject({
  counter: nonNegativeSafeIntegerSchema,
  aggregateVersion: nonNegativeSafeIntegerSchema,
}).refine((value) => value.counter === value.aggregateVersion)
export type IncrementCounterValue = z.infer<typeof incrementCounterValueSchema>
export type IncrementCounterOutput = IncrementCounterValue

export const probeBusinessErrorCodeSchema = z.enum([
  'limit-exceeded',
  'version-conflict',
  'idempotency-key-reused',
  'unsupported-schema',
])
export type ProbeBusinessErrorCode = z.infer<typeof probeBusinessErrorCodeSchema>
export type ProbeBusinessErrorMessageKey = `workbench.error.${ProbeBusinessErrorCode}`

const probeBusinessErrorSchema = z.discriminatedUnion('code', [
  z.strictObject({
    code: z.literal('limit-exceeded'),
    messageKey: z.literal('workbench.error.limit-exceeded'),
  }),
  z.strictObject({
    code: z.literal('version-conflict'),
    messageKey: z.literal('workbench.error.version-conflict'),
  }),
  z.strictObject({
    code: z.literal('idempotency-key-reused'),
    messageKey: z.literal('workbench.error.idempotency-key-reused'),
  }),
  z.strictObject({
    code: z.literal('unsupported-schema'),
    messageKey: z.literal('workbench.error.unsupported-schema'),
  }),
])

export type WorkbenchOutcome<T> =
  | { readonly status: 'accepted'; readonly value: T }
  | {
      readonly status: 'rejected'
      readonly error: {
        readonly code: ProbeBusinessErrorCode
        readonly messageKey: ProbeBusinessErrorMessageKey
      }
    }

function workbenchOutcomeSchema<T extends z.ZodType>(valueSchema: T) {
  return z.discriminatedUnion('status', [
    z.strictObject({ status: z.literal('accepted'), value: valueSchema }),
    z.strictObject({ status: z.literal('rejected'), error: probeBusinessErrorSchema }),
  ])
}

export const probeHealthOutcomeSchema = workbenchOutcomeSchema(probeHealthValueSchema)
export const incrementCounterOutcomeSchema = workbenchOutcomeSchema(incrementCounterValueSchema)

export interface ProbeEndpointTypes {
  readonly health: { readonly input: HealthInput; readonly output: ProbeHealthValue }
  readonly 'counter.increment': { readonly input: IncrementCounterInput; readonly output: IncrementCounterValue }
}

export type ProbeEndpoint = keyof ProbeEndpointTypes
export type ProbeInput<E extends ProbeEndpoint> = ProbeEndpointTypes[E]['input']
export type ProbeOutput<E extends ProbeEndpoint> = ProbeEndpointTypes[E]['output']
export type ProbeOutcome<E extends ProbeEndpoint> = WorkbenchOutcome<ProbeOutput<E>>

export interface EndpointDefinition<I, O> {
  readonly inputSchema: z.ZodType<I>
  readonly outcomeSchema: z.ZodType<WorkbenchOutcome<O>>
  readonly validateOutcome: (input: I, outcome: WorkbenchOutcome<O>) => boolean
  readonly maxRequestUtf8Bytes: typeof MAX_PROBE_RPC_PAYLOAD_UTF8_BYTES
  readonly maxOutcomeUtf8Bytes: typeof MAX_PROBE_RPC_PAYLOAD_UTF8_BYTES
  readonly sensitivity: 'none'
}

const healthDefinition: EndpointDefinition<HealthInput, ProbeHealthValue> = Object.freeze({
  inputSchema: healthInputSchema,
  outcomeSchema: probeHealthOutcomeSchema,
  validateOutcome: (_input: HealthInput, outcome: WorkbenchOutcome<ProbeHealthValue>) =>
    outcome.status === 'rejected'
    || outcome.value.counter === outcome.value.aggregateVersion,
  maxRequestUtf8Bytes: MAX_PROBE_RPC_PAYLOAD_UTF8_BYTES,
  maxOutcomeUtf8Bytes: MAX_PROBE_RPC_PAYLOAD_UTF8_BYTES,
  sensitivity: 'none',
})

const incrementDefinition: EndpointDefinition<IncrementCounterInput, IncrementCounterValue> = Object.freeze({
  inputSchema: incrementCounterInputSchema,
  outcomeSchema: incrementCounterOutcomeSchema,
  validateOutcome: (input: IncrementCounterInput, outcome: WorkbenchOutcome<IncrementCounterValue>) =>
    outcome.status === 'rejected'
    || (
      outcome.value.aggregateVersion === input.expectedVersion + 1
      && outcome.value.counter === outcome.value.aggregateVersion
    ),
  maxRequestUtf8Bytes: MAX_PROBE_RPC_PAYLOAD_UTF8_BYTES,
  maxOutcomeUtf8Bytes: MAX_PROBE_RPC_PAYLOAD_UTF8_BYTES,
  sensitivity: 'none',
})

const registry = Object.create(null) as {
  'counter.increment': typeof incrementDefinition
  health: typeof healthDefinition
}
registry['counter.increment'] = incrementDefinition
registry.health = healthDefinition
export const probeRegistry = Object.freeze(registry)

export function isProbeEndpoint(endpoint: string): endpoint is ProbeEndpoint {
  return Object.hasOwn(probeRegistry, endpoint)
}

type CanonicalJsonPrimitive = null | boolean | number | string
export type CanonicalJsonValue =
  | CanonicalJsonPrimitive
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue }

const MAX_CANONICAL_JSON_DEPTH = 64

function encodeCanonicalJson(value: unknown, ancestors: Set<object>, depth: number): string {
  if (depth > MAX_CANONICAL_JSON_DEPTH) throw new TypeError('Invalid canonical JSON value')
  if (value === null || typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value)
  }
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Invalid canonical JSON value')
    return JSON.stringify(value)
  }
  if (typeof value !== 'object') throw new TypeError('Invalid canonical JSON value')
  if (ancestors.has(value)) throw new TypeError('Invalid canonical JSON value')

  ancestors.add(value)
  try {
    if (Array.isArray(value)) {
      if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError('Invalid canonical JSON value')
      const names = Object.getOwnPropertyNames(value)
      if (names.some((name) => name !== 'length' && !/^(0|[1-9][0-9]*)$/.test(name))) {
        throw new TypeError('Invalid canonical JSON value')
      }
      const encoded: string[] = []
      for (let index = 0; index < value.length; index += 1) {
        if (!Object.hasOwn(value, index)) throw new TypeError('Invalid canonical JSON value')
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
          throw new TypeError('Invalid canonical JSON value')
        }
        encoded.push(encodeCanonicalJson(descriptor.value, ancestors, depth + 1))
      }
      return `[${encoded.join(',')}]`
    }

    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) {
      throw new TypeError('Invalid canonical JSON value')
    }
    if (Object.getOwnPropertySymbols(value).length > 0) throw new TypeError('Invalid canonical JSON value')

    const descriptors = Object.getOwnPropertyDescriptors(value)
    const keys = Object.keys(descriptors).sort()
    const encoded: string[] = []
    for (const key of keys) {
      const descriptor = descriptors[key]
      if (!descriptor || !('value' in descriptor) || !descriptor.enumerable) {
        throw new TypeError('Invalid canonical JSON value')
      }
      encoded.push(`${JSON.stringify(key)}:${encodeCanonicalJson(descriptor.value, ancestors, depth + 1)}`)
    }
    return `{${encoded.join(',')}}`
  } finally {
    ancestors.delete(value)
  }
}

export function canonicalJson(value: unknown): string {
  return encodeCanonicalJson(value, new Set(), 0)
}

export function canonicalJsonUtf8Bytes(value: unknown): number {
  return new TextEncoder().encode(canonicalJson(value)).byteLength
}

export function canonicalEnvelopeUtf8Bytes(
  endpoint: string,
  field: 'input' | 'outcome',
  value: unknown,
): number {
  return canonicalJsonUtf8Bytes({ endpoint, [field]: value })
}

export type ProbeParseResult<T> = { readonly ok: true; readonly value: T } | { readonly ok: false }

function definitionFor(endpoint: ProbeEndpoint): EndpointDefinition<unknown, unknown> {
  return probeRegistry[endpoint] as EndpointDefinition<unknown, unknown>
}

export function parseProbeInput<E extends ProbeEndpoint>(
  endpoint: E,
  input: unknown,
): ProbeParseResult<ProbeInput<E>> {
  try {
    const definition = definitionFor(endpoint)
    if (canonicalEnvelopeUtf8Bytes(endpoint, 'input', input) > definition.maxRequestUtf8Bytes) {
      return { ok: false }
    }
    const parsed = definition.inputSchema.safeParse(input)
    if (!parsed.success) return { ok: false }
    return { ok: true, value: parsed.data as ProbeInput<E> }
  } catch {
    return { ok: false }
  }
}

export function parseProbeOutcome<E extends ProbeEndpoint>(
  endpoint: E,
  input: ProbeInput<E>,
  outcome: unknown,
): ProbeParseResult<ProbeOutcome<E>> {
  try {
    const definition = definitionFor(endpoint)
    const parsedInput = definition.inputSchema.safeParse(input)
    if (!parsedInput.success) return { ok: false }
    if (canonicalEnvelopeUtf8Bytes(endpoint, 'outcome', outcome) > definition.maxOutcomeUtf8Bytes) {
      return { ok: false }
    }
    const parsedOutcome = definition.outcomeSchema.safeParse(outcome)
    if (!parsedOutcome.success || !definition.validateOutcome(parsedInput.data, parsedOutcome.data)) {
      return { ok: false }
    }
    return { ok: true, value: parsedOutcome.data as ProbeOutcome<E> }
  } catch {
    return { ok: false }
  }
}

const receiptAcceptedOutcomeSchema = z.strictObject({
  status: z.literal('accepted'),
  value: incrementCounterValueSchema,
})
const receiptConflictOutcomeSchema = z.strictObject({
  status: z.literal('rejected'),
  error: z.strictObject({
    code: z.literal('version-conflict'),
    messageKey: z.literal('workbench.error.version-conflict'),
  }),
})

export const incrementCounterReceiptOutcomeSchema = z.discriminatedUnion('status', [
  receiptAcceptedOutcomeSchema,
  receiptConflictOutcomeSchema,
])
export type IncrementCounterReceiptOutcome = z.infer<typeof incrementCounterReceiptOutcomeSchema>

export const probeReceiptSchema = z.strictObject({
  canonicalRequestHash: z.string().regex(/^[0-9a-f]{64}$/),
  outcome: incrementCounterReceiptOutcomeSchema,
})
export type ProbeReceipt = z.infer<typeof probeReceiptSchema>

const commandReceiptsSchema = z.record(canonicalUuidV4Schema, probeReceiptSchema)

export const probeStateSchema = z.strictObject({
  schemaVersion: z.literal(1),
  syntheticCounter: nonNegativeSafeIntegerSchema,
  aggregateVersion: nonNegativeSafeIntegerSchema,
  commandReceipts: commandReceiptsSchema,
}).superRefine((state, context) => {
  if (state.syntheticCounter !== state.aggregateVersion) {
    context.addIssue({ code: 'custom', message: 'Invalid probe state' })
  }
  const acceptedVersions = Object.values(state.commandReceipts)
    .flatMap((receipt) => receipt.outcome.status === 'accepted'
      ? [receipt.outcome.value.aggregateVersion]
      : [])
    .sort((left, right) => left - right)
  if (
    acceptedVersions.length !== state.aggregateVersion
    || acceptedVersions.some((version, index) => version !== index + 1)
  ) {
    context.addIssue({ code: 'custom', message: 'Invalid probe state' })
  }
  if (Object.keys(state.commandReceipts).length > MAX_PROBE_COMMAND_RECEIPTS) {
    context.addIssue({ code: 'custom', message: 'Invalid probe state' })
  }
  try {
    if (canonicalJsonUtf8Bytes(state.commandReceipts) > MAX_PROBE_RECEIPT_LEDGER_UTF8_BYTES) {
      context.addIssue({ code: 'custom', message: 'Invalid probe state' })
    }
  } catch {
    context.addIssue({ code: 'custom', message: 'Invalid probe state' })
  }
})
export type ProbeState = z.infer<typeof probeStateSchema>

export const initialProbeState: ProbeState = Object.freeze({
  schemaVersion: 1,
  syntheticCounter: 0,
  aggregateVersion: 0,
  commandReceipts: Object.freeze({}),
})
