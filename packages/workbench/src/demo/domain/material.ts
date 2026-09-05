import {
  MAX_MATERIAL_CODE_UNITS,
  MAX_UPLOAD_BYTES,
  type DomainErrorCode,
  type DomainResult,
  type Material,
  type MaterialFormat,
} from './types.js'

const errorMessages: Record<DomainErrorCode, string> = {
  'empty-material': '材料不能为空。',
  'nul-character': '材料不能包含 NUL 字符。',
  'unsupported-extension': '仅支持 .txt 和 .md 文件。',
  'file-too-large': '上传文件不能超过 256 KB。',
  'invalid-utf8': '上传文件不是有效的 UTF-8 文本。',
  'material-too-long': '材料不能超过 80000 个字符。',
  'invalid-citation': '引用位置无效。',
  'invalid-card-shape': '需求卡片结构无效。',
  'inference-cannot-be-included': '无引用推断不能纳入。',
  'material-required': '需要先提供材料。',
  'no-included-requirements': '至少需要一条已纳入的需求。',
}

function failure<T>(code: DomainErrorCode): DomainResult<T> {
  return { ok: false, error: { code, message: errorMessages[code] } }
}

function validateDecodedText(
  text: string,
  displayName: string,
  format: MaterialFormat,
): DomainResult<Material> {
  if (text.trim().length === 0) return failure('empty-material')
  if (text.includes('\u0000')) return failure('nul-character')
  if (text.length > MAX_MATERIAL_CODE_UNITS) return failure('material-too-long')

  return { ok: true, value: { text, displayName, format } }
}

export function validatePastedText(text: string): DomainResult<Material> {
  return validateDecodedText(text, '粘贴访谈.txt', 'pasted')
}

export function decodeUploadedText(fileName: string, bytes: Uint8Array): DomainResult<Material> {
  const extension = /\.([^.]+)$/.exec(fileName)?.[1]?.toLowerCase()
  const format: MaterialFormat | undefined =
    extension === 'txt' ? 'text/plain' : extension === 'md' ? 'text/markdown' : undefined

  if (!format) return failure('unsupported-extension')
  if (bytes.byteLength > MAX_UPLOAD_BYTES) return failure('file-too-large')

  const hasLeadingBom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf
  const payload = hasLeadingBom ? bytes.subarray(3) : bytes

  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(payload)
  } catch {
    return failure('invalid-utf8')
  }

  return validateDecodedText(text, fileName, format)
}
