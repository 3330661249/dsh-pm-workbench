export function isCanonicalSha512Integrity(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('sha512-')) return false
  const encoded = value.slice('sha512-'.length)
  if (!/^[A-Za-z0-9+/]+={0,2}$/u.test(encoded)) return false
  try {
    const digest = Buffer.from(encoded, 'base64')
    return digest.length === 64 && digest.toString('base64') === encoded
  } catch {
    return false
  }
}
