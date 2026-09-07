# Stage 3A Product public rc.6 surface

**Observed status:** the isolated Host and Client fixtures compile against the
installed, exact rc.6 declaration graph. This is compile-only declaration
evidence. It is not runtime persistence evidence: no plugin was installed, no
Harness process or browser was touched, and no RPC, storage, slot, or lifecycle
operation was executed.

## Frozen Product identity

| Surface | Frozen value |
| --- | --- |
| RPC channel | `/dsh-pm-workbench-product-v1` |
| health payload API version | `pmwb-product-v1` |
| domain name | `dsh_pm_workbench_product_surface` |
| domain version | `1` |
| table | `projects` |
| launcher slot / id / order | `sidebar.footer.action` / `pm-workbench-product-launcher` / `90` |
| overlay slot / id / order | `shell.overlay` / `pm-workbench-product-overlay` / `90` |

## Installed package versions observed

| Package | Version |
| --- | --- |
| `@deepseek-ai/cordis` | `4.0.1` |
| `@deepseek-ai/dsh-client-connection` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-client-runtime` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-client-ui-layout` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-client-ui-sidebar` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-client-ui-slots` | `0.1.0-rc.6` |
| `@deepseek-ai/dsh-storage-domain` | `0.1.0-rc.6` |
| `zod` | `4.4.3` |
| `react` | `18.3.1` |

## Public declaration signatures observed

The Host fixture imports only the public package roots. The installed
declarations expose:

```ts
defineDomain<S extends DomainSpec>(spec: S): S
domainTable<K extends string, V>(schema: ZodType<V>): DomainTableSpec<K, V>
DomainFacility.open<S extends DomainSpec>(spec: S): Promise<Domain<S>>
Domain<S>.table<N extends keyof S['tables'] & string>(name: N):
  KvTable<TableKeyOf<S, N>, TableValueOf<S, N>>
KvTable<K, V>.get(key: K): V | undefined
KvTable<K, V>.entries(): IterableIterator<[K, V]>
KvTable<K, V>.keys(): IterableIterator<K>
KvTable<K, V>.size: number
KvTable<K, V>.put(key: K, value: V): Promise<void>
KvTable<K, V>.update(key: K, fn: (current: V) => V): Promise<V>
KvTable<K, V>.delete(key: K): Promise<boolean>
Domain<S>.close(): Promise<void>
ConnectionRpcHandler =
  (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<RpcResult<unknown>>
HostConnectionRpc.handle(
  channel: string,
  handler: ConnectionRpcHandler,
  options: ConnectionRpcHandlerOptions,
): () => Promise<void>
```

The Client fixture imports only the documented public `/client` entrypoints
plus public React types. The installed declarations expose:

```ts
ClientConnectionRpc.call(
  channel: string,
  endpoint: string,
  payload: unknown,
  signal?: AbortSignal,
): Promise<RpcResult<unknown>>
SlotRegistry.inject(
  key: keyof SlotMap & string,
  callback: () => SlotInjectionEffect,
): () => void
SlotRegistry.register: SlotCore['register']
```

The public slot augmentations declare both `sidebar.footer.action` and
`shell.overlay` as root-scoped list slots. Compilation accepts registration of
the Product launcher and overlay components through those declarations.

## Compiler boundary

Both isolated configs use `NodeNext`, strict checking, `noImplicitAny: true`,
`skipLibCheck: false`, and `noEmit: true`. The Host fixture includes only Node,
ES2022, and DOM declarations; the Client fixture excludes Node types and uses
ES2022, DOM, and DOM iterable declarations. Neither fixture imports an
implementation, a private package subpath, or a copied descriptor, and neither
uses an untyped cast.

The Host and Client TypeScript commands exited `0` in the isolated worktree.
That result proves only that the named Product API calls are accepted by the
installed declarations. Runtime loading, real RPC behavior, durable writes,
restart persistence, rendering, cleanup, package installation, and compatibility
with an active Harness profile remain untested by this task.
