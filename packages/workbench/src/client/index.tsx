import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { useState } from 'react'
import { WorkbenchLauncher, WorkbenchView, storeErrorText } from './workbench/WorkbenchView.js'
import { createWorkbenchStore, type WorkbenchStore } from './workbench/store.js'
import { ConnectionRpcWorkbenchTransport } from './workbench/transport.js'
import { WorkbenchBrowserPort } from './workbench/browser-port.js'
import type { FocusTarget } from './workbench/ProjectList.js'

export const inject = ['connection', 'slots'] as const
export type WorkbenchClientContext = ClientContext & { readonly connection: ConnectionHandle }

function cleanupAll(cleanups: readonly ((() => void) | undefined)[]) {
  let failed = false, firstError: unknown
  for (const cleanup of cleanups) {
    try { cleanup?.() } catch (error) { if (!failed) { failed = true; firstError = error } }
  }
  return { failed, firstError }
}

export function mountWorkbenchClient(ctx: WorkbenchClientContext, suppliedStore?: WorkbenchStore): () => void {
  const uuid = () => globalThis.crypto.randomUUID().toLowerCase()
  const store = suppliedStore ?? createWorkbenchStore(new ConnectionRpcWorkbenchTransport(ctx.connection.rpc),
    { createCommandId: uuid, createProjectId: uuid }, new WorkbenchBrowserPort({
      writeClipboard: text => navigator.clipboard.writeText(text),
      createObjectURL: blob => URL.createObjectURL(blob),
      revokeObjectURL: url => URL.revokeObjectURL(url),
      clickDownload: (url, name) => {
        const anchor = document.createElement('a')
        anchor.href = url; anchor.download = name
        try { document.body.append(anchor); anchor.click() } finally { anchor.remove() }
      },
    }))
  let launcher: FocusTarget | undefined
  function Launcher() {
    const [error, setError] = useState<string>()
    return <><WorkbenchLauncher onOpen={target => {
      launcher = target; setError(undefined)
      void store.open().then(result => { if (!result.ok) setError(storeErrorText(result.code)) }, () => setError('工作台暂时无法连接'))
    }} />{error && <p role="alert">{error}</p>}</>
  }
  function Overlay() { return <WorkbenchView store={store} createCommandId={uuid} restoreFocus={() => { if (launcher?.isConnected !== false) launcher?.focus() }} /> }
  let disposeLauncher: (() => void) | undefined, disposeOverlay: (() => void) | undefined
  try {
    disposeLauncher = ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'pm-workbench-product-launcher', order: 90 }, Launcher))
    disposeOverlay = ctx.slots.inject('shell.overlay', () => ctx.slots.register(
      { name: 'shell.overlay', id: 'pm-workbench-product-overlay', order: 90 }, Overlay))
  } catch (error) { cleanupAll([disposeOverlay, disposeLauncher, () => store.dispose()]); throw error }
  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    const cleanup = cleanupAll([disposeOverlay, disposeLauncher, () => store.dispose()])
    if (cleanup.failed) throw cleanup.firstError
  }
}
export function apply(ctx: WorkbenchClientContext): () => void { return mountWorkbenchClient(ctx) }
