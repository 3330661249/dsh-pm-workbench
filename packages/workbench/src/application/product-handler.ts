import type { ConnectionRpcHandler } from '@deepseek-ai/dsh-client-connection'
import {
  PRODUCT_CAPABILITIES, isProductEndpoint, parseProductInput, parseProductOutcome,
  type ProductEndpoint, type ProductInput,
} from '../protocol/product.js'
import type { ProjectService } from './project-service.js'

type ProductConnectionResult = Awaited<ReturnType<ConnectionRpcHandler>>
type ProductService = Pick<ProjectService, 'list' | 'get' | 'getSource' | 'getMarkdown' | 'command'>

/** rc.6 has a closed carrier error union. Product classifications remain internal;
 * bad-request requires an issues field, so our empty-details boundary uses internal. */
export function internalProductResult(): ProductConnectionResult {
  return { ok: false, error: { code: 'internal', message: 'Product request failed.', details: {} } }
}

function cancelledOutcome(endpoint: ProductEndpoint, input: ProductInput<ProductEndpoint>) {
  return { status: 'rejected',
    ...(endpoint === 'projects.command' ? {
      projectId: (input as ProductInput<'projects.command'>).projectId,
      commandId: (input as ProductInput<'projects.command'>).commandId,
    } : {}), error: { code: 'cancelled' } }
}

function execute(service: ProductService, endpoint: ProductEndpoint, input: unknown, signal: AbortSignal): unknown {
  switch (endpoint) {
    case 'health': return { status: 'accepted', value: PRODUCT_CAPABILITIES }
    case 'projects.list': return service.list(input, signal)
    case 'projects.get': return service.get(input, signal)
    case 'sources.get': return service.getSource(input, signal)
    case 'artifacts.getMarkdown': return service.getMarkdown(input, signal)
    case 'projects.command': return service.command(input, signal)
  }
}

/** Fixed Connection errors never carry caller data, schema issues or thrown diagnostics. */
export function createProductHandler(service: ProductService): ConnectionRpcHandler {
  return async (endpoint, payload, signal) => {
    try {
      if (!isProductEndpoint(endpoint)) return internalProductResult()
      // Retain the parsed frozen snapshot, never correlate against the mutable carrier payload.
      const input = parseProductInput(endpoint, payload)
      if (signal.aborted) {
        return { ok: true, value: parseProductOutcome(endpoint, cancelledOutcome(endpoint, input), input) }
      }
      const outcome = parseProductOutcome(endpoint, await execute(service, endpoint, input, signal), input)
      // A durable operation may finish after observation was cancelled. Validate it, then suppress success.
      return { ok: true, value: signal.aborted
        ? parseProductOutcome(endpoint, cancelledOutcome(endpoint, input), input) : outcome }
    } catch {
      return internalProductResult()
    }
  }
}
