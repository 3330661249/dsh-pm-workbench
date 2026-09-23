import '@deepseek-ai/dsh-client-connection'
import '@deepseek-ai/dsh-storage-domain'
import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { z } from 'zod'

type ProjectId = string & { readonly __projectId: unique symbol }
const recordSchema = z.strictObject({ kind: z.literal('surface'), version: z.number().int() })
const spec = defineDomain({
  name: 'dsh_pm_workbench_product_surface',
  version: 1,
  tables: { projects: domainTable<ProjectId, z.infer<typeof recordSchema>>(recordSchema) },
})
declare const ctx: Context
declare const handler: ConnectionRpcHandler
const domain = await ctx.storageDomain.open(spec)
const projects = domain.table('projects')
const id = '00000000-0000-4000-8000-000000000000' as ProjectId
void projects.get(id)
void projects.entries()
void projects.keys()
void projects.size
await projects.put(id, { kind: 'surface', version: 1 })
const updated = await projects.update(id, current => ({ ...current, version: current.version + 1 }))
const deleted = await projects.delete(id)
const dispose = ctx.connection.rpc.handle('/dsh-pm-workbench-product-v1', handler, { authority: 'loopback' })
await dispose()
await domain.close()
void updated
void deleted
