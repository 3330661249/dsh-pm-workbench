import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import { useSyncExternalStore } from 'react'

import { ProbeLauncher, ProbeView } from './probe/ProbeView.js'
import { createProbeStore, type ProbeStore } from './probe/store.js'
import { ConnectionRpcProbeTransport } from './probe/transport.js'

export const inject = ['connection', 'slots'] as const

export type ProbeClientContext = ClientContext & {
  readonly connection: ConnectionHandle
}

type Cleanup = (() => void) | undefined

function cleanupAll(cleanups: readonly Cleanup[]):
  | { readonly failed: false }
  | { readonly failed: true; readonly error: unknown } {
  let failed = false
  let firstError: unknown
  for (const cleanup of cleanups) {
    if (!cleanup) continue
    try {
      cleanup()
    } catch (error) {
      if (!failed) {
        failed = true
        firstError = error
      }
    }
  }
  return failed ? { failed: true, error: firstError } : { failed: false }
}

export function mountProbeClient(
  ctx: ProbeClientContext,
  suppliedStore?: ProbeStore,
): () => void {
  const store = suppliedStore ?? createProbeStore(
    new ConnectionRpcProbeTransport(ctx.connection.rpc),
  )

  function Launcher() {
    return <ProbeLauncher onOpen={(target) => { void store.open(target) }} />
  }

  function Overlay() {
    const state = useSyncExternalStore(
      (listener) => store.subscribe(listener),
      () => store.getSnapshot(),
      () => store.getSnapshot(),
    )
    return <ProbeView
      state={state}
      onRefresh={() => { void store.refresh() }}
      onIncrement={() => { void store.increment() }}
      onClose={() => { store.close() }}
    />
  }

  let disposeLauncher: (() => void) | undefined
  let disposeOverlay: (() => void) | undefined
  try {
    disposeLauncher = ctx.slots.inject('sidebar.footer.action', () =>
      ctx.slots.register(
        {
          name: 'sidebar.footer.action',
          id: 'pm-workbench-probe-launcher',
          order: 90,
        },
        Launcher,
      ),
    )
    disposeOverlay = ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register(
        {
          name: 'shell.overlay',
          id: 'pm-workbench-probe-overlay',
          order: 90,
        },
        Overlay,
      ),
    )
  } catch (error) {
    cleanupAll([disposeOverlay, disposeLauncher, () => { store.dispose() }])
    throw error
  }

  let disposed = false
  return () => {
    if (disposed) return
    disposed = true
    const cleanup = cleanupAll([
      disposeOverlay,
      disposeLauncher,
      () => { store.dispose() },
    ])
    if (cleanup.failed) throw cleanup.error
  }
}

export function apply(ctx: ProbeClientContext): () => void {
  return mountProbeClient(ctx)
}
