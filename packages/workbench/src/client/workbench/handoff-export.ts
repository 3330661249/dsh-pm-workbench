import type { ValidationHandoff } from '../../validation/model.js'
import { wordDocument } from './browser-port.js'

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Fixed filenames and stored entries: user text never becomes a ZIP path or executable file. */
export async function validationHandoffArchive(handoff: ValidationHandoff): Promise<Blob> {
  const encoder = new TextEncoder()
  const entries = [
    { name: '研发交付.docx', bytes: new Uint8Array(await wordDocument(handoff.markdown).arrayBuffer()) },
    { name: '验证报告.md', bytes: encoder.encode(handoff.markdown) },
    { name: '运行配置.json', bytes: encoder.encode(handoff.configuration) },
    { name: '使用说明.md', bytes: encoder.encode('# 研发交付包\n\n研发交付.docx 包含本次 PRD、选中需求的验证记录和人工结论。验证报告.md 是可编辑的文本副本。运行配置.json 记录所用计划及运行配置。\n\n## 使用验证产物\n打开 DeepSeek Harness → AI PM 工作台 → 原项目 → 方案验证 → 对应历史任务。Demo 可在页面中交互；POC 在工作台内运行，需要可用的模型配置。这里的 JSON 是可读配置，当前不支持独立启动或跨设备导入。\n\n本交付只覆盖报告列出的需求、案例与版本。其余功能、正式上线、真实用户效果及生产环境质量仍需单独评估。请在对外分享前检查访谈引文和模型输出中是否有不应分享的信息。\n') },
  ].map(entry => ({ ...entry, encodedName: encoder.encode(entry.name) }))
  const localSize = entries.reduce((sum, entry) => sum + 30 + entry.encodedName.length + entry.bytes.length, 0)
  const centralSize = entries.reduce((sum, entry) => sum + 46 + entry.encodedName.length, 0)
  const buffer = new ArrayBuffer(localSize + centralSize + 22), bytes = new Uint8Array(buffer), view = new DataView(buffer)
  let local = 0, central = localSize
  for (const entry of entries) {
    const crc = crc32(entry.bytes), size = entry.bytes.length, nameSize = entry.encodedName.length
    view.setUint32(local, 0x04034b50, true)
    view.setUint16(local + 4, 20, true); view.setUint16(local + 6, 0x0800, true)
    view.setUint16(local + 12, 33, true); view.setUint32(local + 14, crc, true)
    view.setUint32(local + 18, size, true); view.setUint32(local + 22, size, true); view.setUint16(local + 26, nameSize, true)
    bytes.set(entry.encodedName, local + 30); bytes.set(entry.bytes, local + 30 + nameSize)
    view.setUint32(central, 0x02014b50, true)
    view.setUint16(central + 4, 20, true); view.setUint16(central + 6, 20, true); view.setUint16(central + 8, 0x0800, true)
    view.setUint16(central + 14, 33, true); view.setUint32(central + 16, crc, true)
    view.setUint32(central + 20, size, true); view.setUint32(central + 24, size, true); view.setUint16(central + 28, nameSize, true)
    view.setUint32(central + 42, local, true); bytes.set(entry.encodedName, central + 46)
    local += 30 + nameSize + size; central += 46 + nameSize
  }
  view.setUint32(central, 0x06054b50, true); view.setUint16(central + 8, entries.length, true); view.setUint16(central + 10, entries.length, true)
  view.setUint32(central + 12, centralSize, true); view.setUint32(central + 16, localSize, true)
  return new Blob([buffer], { type: 'application/zip' })
}
