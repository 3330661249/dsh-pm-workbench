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
declare function Overlay(): ReactElement | null
await ctx.connection.rpc.call('/dsh-pm-workbench-product-v1', 'health', { apiVersion: 'pmwb-product-v1' }, signal)
ctx.slots.inject('sidebar.footer.action', () => ctx.slots.register(
  { name: 'sidebar.footer.action', id: 'pm-workbench-product-launcher', order: 90 },
  Launcher,
))
ctx.slots.inject('shell.overlay', () => ctx.slots.register(
  { name: 'shell.overlay', id: 'pm-workbench-product-overlay', order: 90 },
  Overlay,
))
