import { OFFICIAL_PACKAGE_NAMES, type OfficialPackageName, type RegistryEvidence } from './types.js'

export class RegistryEvidenceError extends Error {
  readonly status = 'INCONCLUSIVE_REGISTRY' as const
  override name = 'RegistryEvidenceError'
}

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new RegistryEvidenceError(`registry evidence ${label} must be an object`)
  }
  return value as Record<string, unknown>
}

export function parseRegistryMetadata(
  requestedName: OfficialPackageName,
  requestedVersion: string,
  raw: unknown,
  observedAt: string,
): RegistryEvidence {
  if (!OFFICIAL_PACKAGE_NAMES.includes(requestedName)) {
    throw new RegistryEvidenceError('registry evidence package is not allowlisted')
  }
  const value = object(raw, 'response')
  const dist = value.dist === undefined
    ? {
      integrity: value['dist.integrity'],
      tarball: value['dist.tarball'],
    }
    : object(value.dist, 'dist')
  if (value.name !== requestedName || value.version !== requestedVersion) {
    throw new RegistryEvidenceError('registry evidence name or version mismatch')
  }
  if (typeof dist.integrity !== 'string' || !/^sha512-[A-Za-z0-9+/=]+$/.test(dist.integrity)) {
    throw new RegistryEvidenceError('registry evidence is missing sha512 integrity')
  }
  let tarball: URL
  try {
    tarball = new URL(String(dist.tarball))
  } catch {
    throw new RegistryEvidenceError('registry evidence has an invalid tarball URL')
  }
  if (tarball.origin !== 'https://registry.npmjs.org') {
    throw new RegistryEvidenceError('registry evidence tarball origin is not official')
  }
  const repository = typeof value.repository === 'string'
    ? value.repository
    : object(value.repository, 'repository').url
  const repositoryUrl = typeof repository === 'string' ? repository : undefined
  if (
    requestedName !== '@deepseek-ai/cordis'
    && (repositoryUrl === undefined || !repositoryUrl.includes('deepseek-ai/deepseek-harness'))
  ) {
    throw new RegistryEvidenceError('registry evidence repository is not official Harness')
  }
  if (!Number.isFinite(Date.parse(observedAt))) {
    throw new RegistryEvidenceError('registry evidence timestamp is invalid')
  }

  return {
    name: requestedName,
    requestedVersion,
    returnedVersion: requestedVersion,
    integrity: dist.integrity as `sha512-${string}`,
    tarballOrigin: 'https://registry.npmjs.org',
    ...(repositoryUrl === undefined ? {} : { repositoryUrl }),
    observedAt,
  }
}
