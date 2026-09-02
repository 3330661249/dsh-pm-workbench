declare const exactVersionBrand: unique symbol

export type ExactVersion = string & { readonly [exactVersionBrand]: true }

const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/

export function parseExactVersion(value: unknown, label = 'version'): ExactVersion {
  if (typeof value !== 'string' || !SEMVER.test(value)) {
    throw new Error(`${label} must be a complete exact SemVer string`)
  }

  return value as ExactVersion
}
