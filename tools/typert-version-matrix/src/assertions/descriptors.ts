import { createHash } from 'node:crypto'
import type { DescriptorValidationEvidence } from '../types.js'
import { CompatibilityEvidenceError } from './errors.js'

const PACKAGE = '@knight/dsh-typert-matrix-probe'
const METHOD_ID = 'matrixProbe/health'

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new CompatibilityEvidenceError('DESCRIPTOR_SHAPE', `${label} must be an object`)
  }
  return value as Record<string, unknown>
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new CompatibilityEvidenceError('DESCRIPTOR_SHAPE', `${label} must be an array`)
  }
  return value
}

interface StrictCodec {
  readonly typeSymbol: string
  readonly safeParse: (value: unknown) => { success: boolean }
}

function strictCodec(value: unknown, label: string): StrictCodec {
  const codec = object(value, `${label} codec`)
  const schema = object(codec.schema, `${label} schema`)
  if (codec.mode !== 'strict') {
    throw new CompatibilityEvidenceError('CODEC_PERMISSIVE', `${label} codec mode is not strict`)
  }
  if (typeof codec.typeSymbol !== 'string' || codec.typeSymbol.length === 0) {
    throw new CompatibilityEvidenceError('CODEC_TYPE_SYMBOL', `${label} typeSymbol is empty`)
  }
  if (typeof schema.safeParse !== 'function') {
    throw new CompatibilityEvidenceError('CODEC_SCHEMA', `${label} schema has no safeParse`)
  }
  return {
    typeSymbol: codec.typeSymbol,
    safeParse: schema.safeParse.bind(schema) as StrictCodec['safeParse'],
  }
}

function assertPayloads(
  codec: StrictCodec,
  valid: unknown,
  requiredInvalid: readonly unknown[],
  extraKeyInvalid: unknown,
  label: string,
): { readonly validAcceptedCount: 1; readonly requiredInvalidRejectedCount: number; readonly extraKeyRejectedCount: 1 } {
  if (codec.safeParse(valid).success !== true) {
    throw new CompatibilityEvidenceError('CODEC_VALID_REJECTED', `${label} rejected the valid payload`)
  }
  if (requiredInvalid.some((value) => codec.safeParse(value).success === true)) {
    throw new CompatibilityEvidenceError('CODEC_INVALID_ACCEPTED', `${label} accepted a malformed ${label} payload`)
  }
  if (codec.safeParse(extraKeyInvalid).success === true) {
    throw new CompatibilityEvidenceError('CODEC_INVALID_ACCEPTED', `${label} accepted a malformed ${label} payload`)
  }
  return {
    validAcceptedCount: 1,
    requiredInvalidRejectedCount: requiredInvalid.length,
    extraKeyRejectedCount: 1,
  }
}

function invocation(value: unknown, label: string): Record<string, unknown> {
  const result = object(value, label)
  if (
    result.id !== METHOD_ID
    || result.service !== 'matrixProbe'
    || result.namespace !== 'matrixProbe'
    || result.method !== 'health'
  ) throw new CompatibilityEvidenceError('METHOD_INVENTORY', `${label} does not equal ${METHOD_ID}`)
  return result
}

export function validateStrictDescriptors(
  hostModule: unknown,
  remoteModule: unknown,
): DescriptorValidationEvidence {
  const host = object(hostModule, 'Host module')
  const remote = object(remoteModule, 'Remote module')
  const hostContribution = object(host.TYPERT, 'Host TYPERT')
  const remoteContribution = object(remote.TYPERT_REMOTE, 'Remote TYPERT_REMOTE')
  if (remote.default !== remote.TYPERT_REMOTE) {
    throw new CompatibilityEvidenceError('REMOTE_IDENTITY', 'Remote default and named export must have object identity')
  }
  if (hostContribution.package !== PACKAGE || hostContribution.face !== 'host') {
    throw new CompatibilityEvidenceError('HOST_IDENTITY', 'Host package or face mismatch')
  }
  if (remoteContribution.package !== PACKAGE) {
    throw new CompatibilityEvidenceError('REMOTE_PACKAGE', 'Remote package mismatch')
  }
  const hostInvocations = array(hostContribution.invocations, 'Host invocations')
  const remoteDescriptors = array(remoteContribution.descriptors, 'Remote descriptors')
  if (hostInvocations.length !== 1 || remoteDescriptors.length !== 1) {
    throw new CompatibilityEvidenceError('METHOD_INVENTORY', 'Host and Remote must contain exactly one method')
  }
  const hostMethod = invocation(hostInvocations[0], 'Host invocation')
  const remoteMethod = invocation(remoteDescriptors[0], 'Remote descriptor')
  for (const field of ['id', 'service', 'namespace', 'method'] as const) {
    if (hostMethod[field] !== remoteMethod[field]) {
      throw new CompatibilityEvidenceError('METHOD_MISMATCH', 'Host and Remote method fields must agree')
    }
  }
  const hostParameters = array(hostMethod.parameters, 'Host parameters')
  const remoteParameters = array(remoteMethod.parameters, 'Remote parameters')
  if (hostParameters.length !== 1 || remoteParameters.length !== 1) {
    throw new CompatibilityEvidenceError('PARAMETER_INVENTORY', 'health must have exactly one request parameter')
  }
  const hostRequest = strictCodec(object(hostParameters[0], 'Host parameter').codec, 'Host request')
  const remoteRequest = strictCodec(object(remoteParameters[0], 'Remote parameter').codec, 'Remote request')
  const hostResult = strictCodec(hostMethod.result, 'Host result')
  const remoteResult = strictCodec(remoteMethod.result, 'Remote result')
  if (
    hostRequest.typeSymbol !== remoteRequest.typeSymbol
    || hostResult.typeSymbol !== remoteResult.typeSymbol
  ) throw new CompatibilityEvidenceError('CODEC_SYMBOL_MISMATCH', 'Host and Remote codec symbols must agree')

  const requestInvalid = [
    { nonce: 'wrong' },
    {},
    [],
    'matrix-v1',
    null,
  ]
  const resultInvalid = [
    { ok: false, apiVersion: 'v1' },
    { ok: true, apiVersion: 'v2' },
    { ok: true },
    [],
    'v1',
    null,
  ]
  const requestResults = [hostRequest, remoteRequest].map((codec) => assertPayloads(
    codec,
    { nonce: 'matrix-v1' },
    requestInvalid,
    { nonce: 'matrix-v1', extra: true },
    'request',
  ))
  const resultResults = [hostResult, remoteResult].map((codec) => assertPayloads(
    codec,
    { ok: true, apiVersion: 'v1' },
    resultInvalid,
    { ok: true, apiVersion: 'v1', extra: true },
    'result',
  ))
  const codecEvidence = (
    typeSymbol: string,
    results: typeof requestResults,
  ) => ({
    hostMode: 'strict' as const,
    remoteMode: 'strict' as const,
    hostHasSafeParse: true as const,
    remoteHasSafeParse: true as const,
    typeSymbolBytes: Buffer.byteLength(typeSymbol),
    typeSymbolSha256: createHash('sha256').update(typeSymbol).digest('hex'),
    symbolsAgree: true as const,
    validAcceptedCount: results.reduce((total, result) => total + result.validAcceptedCount, 0),
    requiredInvalidRejectedCount: results.reduce(
      (total, result) => total + result.requiredInvalidRejectedCount,
      0,
    ),
    extraKeyRejectedCount: results.reduce((total, result) => total + result.extraKeyRejectedCount, 0),
  })
  const methodIds = [METHOD_ID]
  return {
    host: {
      exportName: 'TYPERT',
      package: PACKAGE,
      face: 'host',
      methodIds,
      invocationCount: hostInvocations.length,
    },
    remote: {
      exportName: 'TYPERT_REMOTE',
      package: PACKAGE,
      defaultIdentity: true,
      methodIds,
      descriptorCount: remoteDescriptors.length,
    },
    method: {
      id: METHOD_ID,
      service: 'matrixProbe',
      namespace: 'matrixProbe',
      method: 'health',
      hostParameterCount: hostParameters.length,
      remoteParameterCount: remoteParameters.length,
      fieldsAgree: true,
    },
    requestCodec: codecEvidence(hostRequest.typeSymbol, requestResults),
    resultCodec: codecEvidence(hostResult.typeSymbol, resultResults),
    unknownLookup: {
      id: 'matrixProbe/unknown',
      hostMatchCount: hostInvocations.filter((entry) => (
        typeof entry === 'object' && entry !== null && (entry as { id?: unknown }).id === 'matrixProbe/unknown'
      )).length,
      remoteMatchCount: remoteDescriptors.filter((entry) => (
        typeof entry === 'object' && entry !== null && (entry as { id?: unknown }).id === 'matrixProbe/unknown'
      )).length,
    },
  }
}
