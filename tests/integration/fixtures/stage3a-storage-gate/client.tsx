import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { useState } from 'react'
import { CHANNEL, PHASES, witnessSchema } from './record.js'
export const inject = ['connection', 'slots'] as const
export function apply(ctx: ClientContext & { connection: ConnectionHandle }) {
  function Gate() {
    const [status, setStatus] = useState('idle')
    const [busy, setBusy] = useState(false)
    async function execute(phase: typeof PHASES[number]) {
      setBusy(true); setStatus('pending')
      try {
        const response = await ctx.connection.rpc.call(CHANNEL, phase, {}, AbortSignal.timeout(20000))
        if (!response.ok) throw Error('gate')
        setStatus(JSON.stringify(witnessSchema.parse(response.value)))
      } catch { setStatus('FAIL') } finally { setBusy(false) }
    }
    return <section aria-label="Synthetic storage gate" style={{ position: 'fixed', left: 280, top: 40, width: 450, background: 'white', color: 'black', padding: 20, zIndex: 10 }}>
      {PHASES.map(phase => <button key={phase} data-dsh-pm-storage-gate={phase} disabled={busy} onClick={() => { void execute(phase) }} style={{ display: 'block', margin: 8, padding: 8 }}>{phase}</button>)}
      <output data-dsh-pm-storage-gate="status" data-witness={status}>{status}</output>
    </section>
  }
  return ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'dsh-pm-workbench-storage-gate', order: 90 }, Gate))
}
