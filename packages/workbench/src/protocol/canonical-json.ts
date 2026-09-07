import { hasUnpairedSurrogate, utf8ByteLength } from '../domain/limits.js'

function assertValidString(value: string): void {
  if (hasUnpairedSurrogate(value)) throw new Error('unpaired-surrogate')
}

function serialize(value: unknown, ancestors: Set<object>): string {
  if (value === null) return 'null'
  if (typeof value === 'string') {
    assertValidString(value)
    return JSON.stringify(value)
  }
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error('non-json-value')
    return JSON.stringify(value)
  }
  if (typeof value !== 'object') throw new Error('non-json-value')

  if (ancestors.has(value)) throw new Error('non-json-value')
  const prototype = Object.getPrototypeOf(value)
  const isArray = Array.isArray(value)
  if (isArray ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
    throw new Error('non-json-value')
  }

  ancestors.add(value)
  try {
    if (isArray) {
      if (Object.getOwnPropertySymbols(value).length > 0) throw new Error('non-json-value')
      const propertyNames = Object.getOwnPropertyNames(value)
      if (propertyNames.length !== value.length + 1 || !propertyNames.includes('length')) {
        throw new Error('non-json-value')
      }
      const items: string[] = []
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index))
        if (!descriptor || !('value' in descriptor)) throw new Error('non-json-value')
        items.push(serialize(descriptor.value, ancestors))
      }
      return `[${items.join(',')}]`
    }

    if (Object.getOwnPropertySymbols(value).length > 0) throw new Error('non-json-value')
    const properties: string[] = []
    for (const key of Object.keys(value).sort()) {
      assertValidString(key)
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor || !descriptor.enumerable || !('value' in descriptor)) throw new Error('non-json-value')
      properties.push(`${JSON.stringify(key)}:${serialize(descriptor.value, ancestors)}`)
    }
    return `{${properties.join(',')}}`
  } finally {
    ancestors.delete(value)
  }
}

export function canonicalJson(value: unknown): string {
  return serialize(value, new Set())
}

export function canonicalJsonUtf8Bytes(value: unknown): number {
  return utf8ByteLength(canonicalJson(value))
}
