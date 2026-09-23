import type { KvTable } from '@deepseek-ai/dsh-storage-domain'

type DurableOperation = () => Promise<void>

export interface FakeDomainTable<K extends string, V> extends KvTable<K, V> {
  readonly writeCount: number
  rejectNextWrite(error: Error): void
  deferNextWrite(operation: Promise<void>): void
  close(): Promise<void>
}

class FakeDomainTableImpl<K extends string, V> implements FakeDomainTable<K, V> {
  readonly #records: Map<K, V>
  readonly #durableOperations: DurableOperation[] = []
  #tail: Promise<void> = Promise.resolve()
  #disposing = false
  #closed = false
  #disposal: Promise<void> | undefined
  #writeCount = 0

  constructor(initial: Iterable<readonly [K, V]>) {
    this.#records = new Map(initial)
  }

  get writeCount(): number {
    return this.#writeCount
  }

  get size(): number {
    this.#assertReadable()
    return this.#records.size
  }

  get(key: K): V | undefined {
    this.#assertReadable()
    return this.#records.get(key)
  }

  entries(): IterableIterator<[K, V]> {
    this.#assertReadable()
    return new Map(this.#records).entries()
  }

  keys(): IterableIterator<K> {
    this.#assertReadable()
    return new Map(this.#records).keys()
  }

  put(key: K, value: V): Promise<void> {
    return this.#enqueue(async () => {
      await this.#durablyWrite()
      this.#records.set(key, value)
    })
  }

  delete(key: K): Promise<boolean> {
    return this.#enqueue(async () => {
      if (!this.#records.has(key)) return false
      await this.#durablyWrite()
      this.#records.delete(key)
      return true
    })
  }

  update(key: K, transform: (current: V) => V): Promise<V> {
    return this.#enqueue(async () => {
      const current = this.#records.get(key)
      if (current === undefined) throw new Error('missing-key')
      const next = transform(current)
      await this.#durablyWrite()
      this.#records.set(key, next)
      return next
    })
  }

  rejectNextWrite(error: Error): void {
    this.#durableOperations.push(() => Promise.reject(error))
  }

  deferNextWrite(operation: Promise<void>): void {
    this.#durableOperations.push(() => operation)
  }

  close(): Promise<void> {
    if (this.#disposal) return this.#disposal
    this.#disposing = true
    this.#disposal = this.#tail.then(() => {
      this.#closed = true
    })
    return this.#disposal
  }

  #enqueue<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#disposing) return Promise.reject(new Error('closed'))
    const slice = this.#tail.then(operation)
    this.#tail = slice.then(() => undefined, () => undefined)
    return slice
  }

  async #durablyWrite(): Promise<void> {
    this.#writeCount += 1
    await (this.#durableOperations.shift()?.() ?? Promise.resolve())
  }

  #assertReadable(): void {
    if (this.#closed) throw new Error('closed')
  }
}

export function createFakeDomainTable<K extends string, V>(
  initial: Iterable<readonly [K, V]> = [],
): FakeDomainTable<K, V> {
  return new FakeDomainTableImpl(initial)
}
