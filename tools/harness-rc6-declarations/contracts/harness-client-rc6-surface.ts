import '@deepseek-ai/dsh-client-ui-layout/client'
import '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {
  ClientConnectionRpc,
  ConnectionHandle,
} from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ReactElement } from 'react'

declare const ctx: ClientContext
declare const connection: ConnectionHandle
declare const component: () => ReactElement | null

const rpc: ClientConnectionRpc = connection.rpc
const response: ReturnType<ClientConnectionRpc['call']> =
  rpc.call(
    '/dsh-pm-workbench-v1',
    'health',
    {},
    new AbortController().signal,
  )

const disposeLauncher: () => void =
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'pm-workbench-probe-launcher',
      },
      component,
    ),
  )

const disposeOverlay: () => void =
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register(
      {
        name: 'shell.overlay',
        id: 'pm-workbench-probe-overlay',
      },
      component,
    ),
  )

void response
void connection
void disposeLauncher
void disposeOverlay
