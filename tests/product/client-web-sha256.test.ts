import { afterEach, expect, it, vi } from 'vitest'
import { webSha256Utf8 } from '../../packages/workbench/src/client/workbench/web-sha256.js'
import { BUILT_IN_SYNTHETIC_TEXT } from '../../packages/workbench/src/analysis/fixture-manifest.js'
afterEach(() => vi.unstubAllGlobals())
it('hashes exact UTF-8 with Web Crypto when the Node global is absent', async () => {
  vi.stubGlobal('Buffer', undefined)
  const withoutNodeGlobal = webSha256Utf8('abc')
  vi.unstubAllGlobals()
  expect(await withoutNodeGlobal).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
  expect(await webSha256Utf8(BUILT_IN_SYNTHETIC_TEXT)).toBe('aadb7945ca89bfefcf8678f194c43ba84c93bdef602c3a91cd9901b097e7b67c')
  expect(await webSha256Utf8('中文😀')).toMatch(/^[0-9a-f]{64}$/)
  expect(await webSha256Utf8('é')).not.toBe(await webSha256Utf8('e\u0301'))
})
it('rejects lone surrogates rather than hashing replacement text', async () => {
  await expect(webSha256Utf8('\ud800')).rejects.toThrow('invalid-text')
})
