import '@deepseek-ai/dsh-client-connection'
import '@deepseek-ai/dsh-storage-domain'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'

declare const ctx: Context
declare const handler: ConnectionRpcHandler
declare const probeDomainSpec: Parameters<typeof ctx.storageDomain.open>[0]

const dispose = ctx.connection.rpc.handle(
  '/dsh-pm-workbench-v1',
  handler,
  { authority: 'loopback' },
)
const domain = await ctx.storageDomain.open(probeDomainSpec)

void dispose
void domain
