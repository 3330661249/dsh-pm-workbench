import '@deepseek-ai/dsh-client-connection'
import type { Context } from '@deepseek-ai/cordis'
import type {
  ConnectionRpcHandler,
  HostConnectionHandle,
} from '@deepseek-ai/dsh-client-connection'

declare const ctx: Context
declare const handler: ConnectionRpcHandler

const connection: HostConnectionHandle = ctx.connection

const disposeChannel: () => Promise<void> = connection.rpc.handle(
  '/dsh-pm-workbench-v1',
  handler,
  { authority: 'loopback' },
)

const disposeEffect: () => Promise<void> = ctx.effect(() => disposeChannel)

void disposeEffect
