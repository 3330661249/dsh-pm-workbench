import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { defineDomain } from '@deepseek-ai/dsh-storage-domain'

import {
  createProbeHandler,
  createProbeRepository,
  initialProbeState,
  internalProbeResult,
  probeStateSchema,
} from '../../probe/service.js'
import { PROBE_CAPABILITIES, PROBE_RPC_CHANNEL } from '../../probe/protocol.js'

export const inject = ['connection', 'storageDomain'] as const

export const probeDomainSpec = defineDomain({
  name: 'dsh_pm_workbench_probe',
  version: 1,
  global: {
    schema: probeStateSchema,
    initial: initialProbeState,
  },
  tables: {},
})

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const domain = await ctx.storageDomain.open(probeDomainSpec)
  const repository = createProbeRepository(domain.global)
  const lifecycle = new AbortController()
  const handler = createProbeHandler(repository)
  const inFlight = new Set<Promise<Awaited<ReturnType<ConnectionRpcHandler>>>>()
  let accepting = true

  try {
    const admittedHandler: ConnectionRpcHandler = (endpoint, payload, signal) => {
      if (!accepting || inFlight.size >= PROBE_CAPABILITIES.maxHostInflightRequests) {
        return Promise.resolve(internalProbeResult())
      }

      const operation = (async () => {
        try {
          const combinedSignal = AbortSignal.any([signal, lifecycle.signal])
          return await handler(endpoint, payload, combinedSignal)
        } catch {
          return internalProbeResult()
        }
      })()
      inFlight.add(operation)
      void operation.finally(() => inFlight.delete(operation))
      return operation
    }

    const disposeRoute = ctx.connection.rpc.handle(
      PROBE_RPC_CHANNEL,
      admittedHandler,
      { authority: 'loopback' },
    )

    let disposal: Promise<void> | undefined
    return () => {
      if (disposal) return disposal
      accepting = false
      disposal = Promise.resolve().then(async () => {
        const failures: unknown[] = []
        try {
          await disposeRoute()
        } catch (error) {
          failures.push(error)
        }
        lifecycle.abort()
        await Promise.allSettled([...inFlight])
        try {
          await repository.close()
        } catch (error) {
          failures.push(error)
        }
        try {
          await domain.close()
        } catch (error) {
          failures.push(error)
        }
        if (failures.length > 0) throw failures[0]
      })
      return disposal
    }
  } catch (error) {
    accepting = false
    lifecycle.abort()
    await Promise.allSettled([...inFlight])
    await repository.close()
    await domain.close()
    throw error
  }
}
