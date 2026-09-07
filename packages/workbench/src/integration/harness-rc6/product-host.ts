import type { Context } from '@deepseek-ai/cordis'
import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import { FixtureInsightEngine } from '../../analysis/fixture-engine.js'
import { FIXTURE_MANIFEST } from '../../analysis/fixture-manifest.js'
import { nodeSha256Utf8 } from '../../application/node-sha256.js'
import { createProductHandler, internalProductResult } from '../../application/product-handler.js'
import { TableProjectRepository } from '../../application/project-repository.js'
import { ProjectService } from '../../application/project-service.js'
import { PRODUCT_CAPABILITIES, PRODUCT_RPC_CHANNEL } from '../../protocol/product.js'
import { projectDomainSpec } from './project-domain.js'

export { projectDomainSpec } from './project-domain.js'
export const inject = ['connection', 'storageDomain'] as const

export async function apply(ctx: Context): Promise<() => Promise<void>> {
  const lifecycle = new AbortController()
  const inFlight = new Set<ReturnType<ConnectionRpcHandler>>()
  let accepting = true
  let repository: TableProjectRepository | undefined
  // Take Domain ownership before extracting its table so extraction failures also close it.
  const domain = await ctx.storageDomain.open(projectDomainSpec)
  try {
    const table = domain.table('projects')
    repository = new TableProjectRepository(table, {
      engine: new FixtureInsightEngine(FIXTURE_MANIFEST, nodeSha256Utf8),
      sha256Utf8: nodeSha256Utf8,
    })
    const ownedRepository = repository
    const handler = createProductHandler(new ProjectService(ownedRepository))
    const admittedHandler: ConnectionRpcHandler = (endpoint, payload, signal) => {
      if (!accepting || inFlight.size >= PRODUCT_CAPABILITIES.maxHostInflightRequests) {
        return Promise.resolve(internalProductResult())
      }
      // Reserve a slot before any service code can synchronously reenter the route.
      const operation = Promise.resolve().then(async () => {
        try {
          return await handler(endpoint, payload, AbortSignal.any([signal, lifecycle.signal]))
        } catch {
          return internalProductResult()
        }
      })
      inFlight.add(operation)
      void operation.then(() => inFlight.delete(operation), () => inFlight.delete(operation))
      return operation
    }
    const disposeRoute = ctx.connection.rpc.handle(PRODUCT_RPC_CHANNEL, admittedHandler, { authority: 'loopback' })
    let disposal: Promise<void> | undefined
    return () => {
      if (disposal) return disposal
      accepting = false
      // Store the promise before invoking any disposer, including a synchronously reentrant one.
      disposal = Promise.resolve().then(async () => {
        const failures: unknown[] = []
        try { await disposeRoute() } catch (error) { failures.push(error) }
        try { lifecycle.abort() } catch (error) { failures.push(error) }
        await Promise.allSettled([...inFlight])
        try { await ownedRepository.close() } catch (error) { failures.push(error) }
        try { await domain.close() } catch (error) { failures.push(error) }
        if (failures.length) throw failures[0]
      })
      return disposal
    }
  } catch (error) {
    accepting = false
    try { lifecycle.abort() } catch { /* Preserve the setup failure after all cleanup. */ }
    await Promise.allSettled([...inFlight])
    try { await repository?.close() } catch { /* Domain cleanup must still run. */ }
    try { await domain.close() } catch { /* The original setup failure takes precedence. */ }
    throw error
  }
}
