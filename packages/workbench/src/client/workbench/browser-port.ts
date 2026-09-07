import type { MarkdownView } from '../../application/project-views.js'
import { isVerifiedMarkdown } from './transport.js'

export interface WorkbenchBrowserDependencies {
  writeClipboard(text: string): Promise<void>
  createObjectURL(blob: Blob): string
  clickDownload(ownedUrl: string, downloadName: string): void | Promise<void>
  revokeObjectURL(ownedUrl: string): void
}
/** Owns every export resource; consumers provide validated text, never a URL. */
export class WorkbenchBrowserPort {
  private readonly owned = new Set<string>()
  private disposed = false
  private generation = 0
  constructor(private readonly browser: WorkbenchBrowserDependencies) {}
  private assert(value: MarkdownView): void {
    if (this.disposed) throw new Error('disposed')
    if (!isVerifiedMarkdown(value)) throw new Error('unverified-markdown')
  }
  async copy(value: MarkdownView): Promise<void> {
    this.assert(value)
    await this.browser.writeClipboard(value.markdown)
  }
  async download(value: MarkdownView): Promise<void> {
    this.assert(value)
    const generation = this.generation
    const url = this.browser.createObjectURL(new Blob([value.markdown], { type: 'text/markdown;charset=utf-8' }))
    this.owned.add(url)
    try {
      if (!this.disposed && generation === this.generation) await this.browser.clickDownload(url, `prd-${value.prdRevisionId}.md`)
    } finally { this.revoke(url) }
  }
  private revoke(url: string): void {
    if (this.owned.delete(url)) this.browser.revokeObjectURL(url)
  }
  close(): void {
    this.generation++
    for (const url of [...this.owned]) {
      try { this.revoke(url) } catch { /* continue cleaning remaining owned resources */ }
    }
  }
  dispose(): void { this.disposed = true; this.close() }
}
