import type { Server } from 'node:http'
import { expect, test } from 'vitest'

function close(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
}

test('builds and serves the fixed Demo routes on an actual loopback port and closes cleanly', async () => {
  const { startDemoServer } = await import('../../scripts/serve-demo.mjs')
  const { server, url } = await startDemoServer({ port: 0 })
  try {
    const address = server.address()
    expect(address && typeof address !== 'string' && address.address).toBe('127.0.0.1')
    expect(address && typeof address !== 'string' && address.port).toBeGreaterThan(0)
    expect(url).toBe(`http://127.0.0.1:${address && typeof address !== 'string' ? address.port : 0}/`)
    for (const route of ['', 'index.html', 'assets/demo.js', 'assets/demo.css']) {
      const response = await fetch(new URL(route, url))
      expect(response.status, route).toBe(200)
      expect((await response.text()).length).toBeGreaterThan(0)
    }
    const head = await fetch(new URL('assets/demo.css', url), { method: 'HEAD' })
    const get = await fetch(new URL('assets/demo.css', url))
    expect(head.status).toBe(200)
    expect(head.headers.get('content-type')).toBe('text/css; charset=utf-8')
    expect(head.headers.get('content-length')).toBe(get.headers.get('content-length'))
    expect(await head.text()).toBe('')
    await get.arrayBuffer()
    for (const route of ['missing', 'assets/', 'package.json', 'assets/demo.js?extra=1', '%2e%2e/package.json']) {
      const response = await fetch(new URL(route, url))
      expect(response.status, route).toBe(404)
      await response.text()
    }
    const post = await fetch(url, { method: 'POST' })
    expect(post.status).toBe(405)
    expect(post.headers.get('allow')).toBe('GET, HEAD')
    await post.text()
  } finally {
    await close(server)
  }
  expect(server.listening).toBe(false)
})
