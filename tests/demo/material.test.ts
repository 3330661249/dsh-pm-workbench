import { describe, expect, it } from 'vitest'

import { decodeUploadedText, validatePastedText } from '../../packages/workbench/src/demo/domain/material.js'

describe('material validation', () => {
  it('preserves pasted text and validates exact boundaries', () => {
    expect(validatePastedText('甲\r\n乙')).toMatchObject({
      ok: true,
      value: { text: '甲\r\n乙', displayName: '粘贴访谈.txt', format: 'pasted' },
    })
    expect(validatePastedText('   ')).toMatchObject({ ok: false, error: { code: 'empty-material' } })
    expect(validatePastedText('甲\u0000乙')).toMatchObject({ ok: false, error: { code: 'nul-character' } })
    expect(validatePastedText('甲'.repeat(80_000)).ok).toBe(true)
    expect(validatePastedText('甲'.repeat(80_001))).toMatchObject({
      ok: false,
      error: { code: 'material-too-long' },
    })
  })

  it('decodes allowed UTF-8 uploads with a single leading BOM removed', () => {
    const encoder = new TextEncoder()
    expect(decodeUploadedText('访谈.md', new Uint8Array([0xef, 0xbb, 0xbf, ...encoder.encode('甲\r\n乙')]))).toMatchObject({
      ok: true,
      value: { text: '甲\r\n乙', displayName: '访谈.md', format: 'text/markdown' },
    })
    expect(decodeUploadedText('访谈.TXT', encoder.encode('甲'))).toMatchObject({
      ok: true,
      value: { text: '甲', displayName: '访谈.TXT', format: 'text/plain' },
    })
    expect(decodeUploadedText('访谈.MD', encoder.encode('乙'))).toMatchObject({
      ok: true,
      value: { text: '乙', displayName: '访谈.MD', format: 'text/markdown' },
    })
  })

  it('rejects unsupported, invalid, oversized, and blank uploads', () => {
    const encoder = new TextEncoder()
    expect(decodeUploadedText('访谈.pdf', encoder.encode('甲'))).toMatchObject({
      ok: false,
      error: { code: 'unsupported-extension' },
    })
    expect(decodeUploadedText('访谈.markdown', encoder.encode('甲'))).toMatchObject({
      ok: false,
      error: { code: 'unsupported-extension' },
    })
    expect(decodeUploadedText('访谈', encoder.encode('甲'))).toMatchObject({
      ok: false,
      error: { code: 'unsupported-extension' },
    })
    expect(decodeUploadedText('访谈.txt', new Uint8Array([0xc3, 0x28]))).toMatchObject({
      ok: false,
      error: { code: 'invalid-utf8' },
    })
    expect(decodeUploadedText('访谈.txt', new Uint8Array(256 * 1024))).toMatchObject({
      ok: false,
      error: { code: 'nul-character' },
    })
    expect(decodeUploadedText('访谈.txt', new Uint8Array(256 * 1024 + 1))).toMatchObject({
      ok: false,
      error: { code: 'file-too-large' },
    })
    expect(decodeUploadedText('访谈.txt', encoder.encode(' \n\t '))).toMatchObject({
      ok: false,
      error: { code: 'empty-material' },
    })
  })

  it('preserves BOM code points not explicitly removed from raw bytes', () => {
    const encoder = new TextEncoder()
    const bom = new Uint8Array([0xef, 0xbb, 0xbf])
    const twiceLeading = new Uint8Array([...bom, ...bom, ...encoder.encode('甲')])
    const nonLeading = new Uint8Array([...encoder.encode('甲'), ...bom, ...encoder.encode('乙')])

    expect(decodeUploadedText('访谈.txt', twiceLeading)).toMatchObject({
      ok: true,
      value: { text: '\uFEFF甲' },
    })
    expect(decodeUploadedText('访谈.txt', nonLeading)).toMatchObject({
      ok: true,
      value: { text: '甲\uFEFF乙' },
    })
    expect(validatePastedText('\uFEFF甲')).toMatchObject({ ok: true, value: { text: '\uFEFF甲' } })
    expect(validatePastedText('甲\uFEFF乙')).toMatchObject({ ok: true, value: { text: '甲\uFEFF乙' } })
  })
})
