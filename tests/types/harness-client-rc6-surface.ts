import '@deepseek-ai/dsh-client-connection/client'
import '@deepseek-ai/dsh-client-runtime/client'
import '@deepseek-ai/dsh-client-ui-layout/client'
import '@deepseek-ai/dsh-client-ui-sidebar/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ReactElement } from 'react'

declare const ctx: ClientContext & { readonly connection: ConnectionHandle }
declare const signal: AbortSignal
declare function Launcher(): ReactElement | null

const result = await ctx.connection.rpc.call(
  '/dsh-pm-workbench-v1',
  'health',
  {},
  signal,
)
ctx.slots.inject('sidebar.footer.action', () =>
  ctx.slots.register(
    { name: 'sidebar.footer.action', id: 'pm-workbench-probe-launcher', order: 90 },
    Launcher,
  ),
)

void result
