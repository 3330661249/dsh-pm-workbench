import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { useEffect, useRef, useState } from 'react'
import { WorkbenchLauncher, WorkbenchView, storeErrorText } from './workbench/WorkbenchView.js'
import { createWorkbenchStore, type WorkbenchStore } from './workbench/store.js'
import { ConnectionRpcWorkbenchTransport } from './workbench/transport.js'
import { WorkbenchBrowserPort } from './workbench/browser-port.js'
import type { FocusTarget } from './workbench/ProjectList.js'
import { RpcValidationClient } from './workbench/validation-client.js'

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
  const validationClient = new RpcValidationClient(ctx.connection.rpc)
  const picker = (globalThis as unknown as { showSaveFilePicker?: ConstructorParameters<typeof WorkbenchBrowserPort>[0]['pickSaveFile'] }).showSaveFilePicker
  const store = suppliedStore ?? createWorkbenchStore(new ConnectionRpcWorkbenchTransport(ctx.connection.rpc),
    { createCommandId: uuid, createProjectId: uuid }, new WorkbenchBrowserPort({
      writeClipboard: text => navigator.clipboard.writeText(text),
      createObjectURL: blob => URL.createObjectURL(blob),
      revokeObjectURL: url => URL.revokeObjectURL(url),
      pickSaveFile: typeof picker === 'function' ? options => picker.call(globalThis, options) : undefined,
      clickDownload: (url, name) => {
        const anchor = document.createElement('a')
        anchor.href = url; anchor.download = name
        try { document.body.append(anchor); anchor.click() } finally { anchor.remove() }
      },
    }))
  let launcher: FocusTarget | undefined, openingGeneration = 0, disposed = false
  const invalidateOpening = () => { openingGeneration++ }
  function Launcher() {
    const [error, setError] = useState<string>(), alive = useRef(true)
    useEffect(() => { alive.current = true; return () => { alive.current = false; invalidateOpening() } }, [])
    return <><WorkbenchLauncher onOpen={target => {
      if (disposed || !alive.current) return
      const request = ++openingGeneration
      const current = () => alive.current && !disposed && request === openingGeneration && store.getSnapshot().isOpen
      launcher = target; setError(undefined)
      void (async () => {
        const opened = await store.open()
        if (!current()) return
        if (!opened.ok) { setError(storeErrorText(opened.code)); return }
        const snapshot = store.getSnapshot()
        const first = snapshot.projects[0]
        if (!snapshot.selectedProjectId && first) {
          const selected = await store.selectProject(first.id)
          if (current()) setError(selected.ok ? undefined : storeErrorText(selected.code))
        }
      })().catch(() => { if (current()) setError('工作台暂时无法连接') })
    }} />{error && <p role="alert">{error}</p>}</>
  }
  function Overlay() { return <WorkbenchView store={store} validationClient={validationClient} createCommandId={uuid} onClose={invalidateOpening} restoreFocus={() => { if (launcher?.isConnected !== false) launcher?.focus() }} /> }
  let disposeLauncher: (() => void) | undefined, disposeOverlay: (() => void) | undefined
  try {
    disposeLauncher = ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
      { name: 'sidebar.footer.action', id: 'pm-workbench-product-launcher', order: 90 }, Launcher))
    disposeOverlay = ctx.slots.inject('shell.overlay', () => ctx.slots.register(
      { name: 'shell.overlay', id: 'pm-workbench-product-overlay', order: 90 }, Overlay))
  } catch (error) { disposed = true; invalidateOpening(); cleanupAll([disposeOverlay, disposeLauncher, () => store.dispose()]); throw error }
  return () => {
    if (disposed) return
    disposed = true; invalidateOpening()
    const cleanup = cleanupAll([disposeOverlay, disposeLauncher, () => store.dispose()])
    if (cleanup.failed) throw cleanup.firstError
  }
}
export function apply(ctx: WorkbenchClientContext): () => void { return mountWorkbenchClient(ctx) }
