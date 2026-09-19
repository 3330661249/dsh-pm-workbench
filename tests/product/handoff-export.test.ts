import { expect, it } from 'vitest'
import { validationHandoffArchive } from '../../packages/workbench/src/client/workbench/handoff-export.js'

it('packages the Word handoff, readable report and original runnable configuration without remote content', async () => {
  const archive = await validationHandoffArchive({ filename: '研发交付.docx', markdown: '# 示例 PRD\n\n## 范围\n- 仅验证一个需求', configuration: '{"mode":"poc","projectId":"synthetic"}' })
  const bytes = new Uint8Array(await archive.arrayBuffer()), view = new DataView(bytes.buffer)
  let offset = 0
  const entries: Record<string, Uint8Array> = {}
  while (view.getUint32(offset, true) === 0x04034b50) {
    const length = view.getUint32(offset + 18, true), nameLength = view.getUint16(offset + 26, true)
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength))
    entries[name] = bytes.slice(offset + 30 + nameLength, offset + 30 + nameLength + length)
    offset += 30 + nameLength + length
  }
  expect(Object.keys(entries)).toEqual(['研发交付.docx', '验证报告.md', '运行配置.json', '使用说明.md'])
  expect(new DataView(entries['研发交付.docx']!.buffer).getUint32(0, true)).toBe(0x04034b50)
  expect(new TextDecoder().decode(entries['验证报告.md'])).toContain('仅验证一个需求')
  expect(JSON.parse(new TextDecoder().decode(entries['运行配置.json']))).toEqual({mode:'poc',projectId:'synthetic'})
  expect(new TextDecoder().decode(entries['使用说明.md'])).toContain('DeepSeek Harness')
  expect(archive.type).toBe('application/zip')
})
