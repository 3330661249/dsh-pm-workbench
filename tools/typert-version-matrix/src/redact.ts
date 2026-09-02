export function redactText(input: string, roots: readonly string[] = []): string {
  let result = input
  for (const root of [...roots].sort((left, right) => right.length - left.length)) {
    if (root.length > 0) result = result.replaceAll(root, '<repo>')
  }
  result = result.replace(/\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g, '<redacted>')
  result = result.replace(
    /\b[A-Za-z0-9_]*(?:API_KEY|TOKEN|SECRET|PASSWORD)=[^\s]+/gi,
    (match) => `${match.slice(0, match.indexOf('=') + 1)}<redacted>`,
  )
  return result
}
