import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { createHash } from 'node:crypto'
import { CHANNEL, LIMIT, PHASES, recordSchema, serialize, type RecordValue } from './record.js'

export const inject = ['connection', 'storageDomain'] as const
const digest = (text: string) => createHash('sha256').update(text).digest('hex')
function active(id: string, bytes: number): RecordValue {
  const record = { kind: 'active' as const, id, bytes, hash: '0'.repeat(64), padding: '' }
  const remaining = bytes - Buffer.byteLength(serialize(record))
  record.padding = 'x'.repeat(remaining)
  record.hash = digest(record.padding)
  if (Buffer.byteLength(serialize(record)) !== bytes) throw Error('synthetic-size')
  return recordSchema.parse(record)
}
export async function apply(ctx: Context) {
  const domain = await ctx.storageDomain.open(defineDomain({ name: 'dsh_pm_workbench_storage_gate', version: 1, tables: { records: domainTable<string, RecordValue>(recordSchema) } }))
  const table = domain.table('records')
  let busy = false
  const handler: ConnectionRpcHandler = async (endpoint, payload) => {
    if (busy || !PHASES.includes(endpoint as typeof PHASES[number]) || JSON.stringify(payload) !== '{}') return { ok: false, error: { code: 'bad-request', message: 'gate', details: { issues: [] } } }
    busy = true
    try {
      let backendCalls = 0
      const near = endpoint.includes('near-limit')
      const id = near ? 'near' : 'small'
      let record: RecordValue | undefined
      if (endpoint === 'write-small' || endpoint === 'write-near-limit') {
        record = active(id, near ? LIMIT : 512)
        if (Buffer.byteLength(serialize(record)) > LIMIT) throw Error('quota')
        backendCalls++; await table.put(id, record)
      } else if (endpoint === 'write-tombstone') {
        backendCalls++
        const updated = await table.update('small', current => {
          if (current.kind !== 'active') throw Error('not-active')
          return { kind: 'deleted', id: 'small', deletedAt: '2026-09-07T00:00:00.000Z', deleteCommandId: 'synthetic-delete', requestHash: digest('synthetic-delete') }
        })
        if (!updated) throw Error('update-missing')
        record = table.get('small')
      } else if (endpoint === 'reject-over-limit') {
        const candidate = active('over', LIMIT + 1)
        if (Buffer.byteLength(serialize(candidate)) <= LIMIT) { backendCalls++; await table.put('over', candidate) }
        return { ok: true, value: { ok: backendCalls === 0 && table.get('over') === undefined, bytes: LIMIT + 1, hash: digest(serialize(candidate)), hidden: false, backendCalls } }
      } else record = table.get(id)
      if (!record) throw Error('missing')
      const hidden = record.kind === 'deleted' && ![...table.entries()].filter(([, value]) => value.kind === 'active').some(([key]) => key === 'small')
      const bytes = Buffer.byteLength(serialize(record))
      const ok = record.kind === 'active' ? record.bytes === bytes && record.hash === digest(record.padding) : hidden
      return { ok: true, value: { ok, bytes, hash: digest(serialize(record)), hidden, backendCalls } }
    } catch { return { ok: true, value: { ok: false, bytes: 0, hash: '0'.repeat(64), hidden: false, backendCalls: 0 } } }
    finally { busy = false }
  }
  const dispose = ctx.connection.rpc.handle(CHANNEL, handler, { authority: 'loopback' })
  return async () => { await dispose(); await domain.close() }
}
