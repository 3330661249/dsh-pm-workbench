import type { Server } from 'node:http'
import { expect, test, vi } from 'vitest'
import * as buildModule from '../../packages/workbench/build.mjs'

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

test.each([
  { label: 'listen options object', port: { port: 0, host: '0.0.0.0' } },
  { label: 'socket path string', port: '/private/tmp/demo-invalid-port.sock' },
  { label: 'numeric string', port: '4173' },
  { label: 'NaN', port: Number.NaN },
  { label: 'fractional', port: 4173.5 },
  { label: 'negative', port: -1 },
  { label: 'too large', port: 65536 },
  { label: 'infinity', port: Number.POSITIVE_INFINITY },
  { label: 'null', port: null },
  { label: 'boolean', port: true },
  { label: 'boxed number', port: new Number(0) },
])('rejects $label before any build or socket work', async ({ port }) => {
  const { startDemoServer } = await import('../../scripts/serve-demo.mjs')
  // Building replaces output and listening with object/path values could select
  // an unsafe Node overload. Stop at that first side effect during RED as well.
  const build = vi.spyOn(buildModule, 'buildDemo').mockRejectedValue(new Error('unexpected build before port validation'))
  try {
    await expect(startDemoServer({ port: port as number })).rejects.toThrow('port must be an integer number from 0 to 65535')
    expect(build).not.toHaveBeenCalled()
  } finally {
    build.mockRestore()
  }
})
