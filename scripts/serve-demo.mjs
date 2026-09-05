import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { buildDemo } from '../packages/workbench/build.mjs'

export async function startDemoServer({ port = 4173 } = {}) {
  const outdir = await buildDemo()
  const routes = new Map([
    ['/', ['index.html', 'text/html; charset=utf-8']],
    ['/index.html', ['index.html', 'text/html; charset=utf-8']],
    ['/assets/demo.js', ['assets/demo.js', 'text/javascript; charset=utf-8']],
    ['/assets/demo.css', ['assets/demo.css', 'text/css; charset=utf-8']],
  ])
  // Read only the fixed build outputs; request URLs never become filesystem paths.
  const assets = new Map(await Promise.all([...routes].map(async ([route, [file, type]]) => [
    route, { body: await readFile(path.join(outdir, file)), type },
  ])))
  const server = createServer((request, response) => {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.writeHead(405, { Allow: 'GET, HEAD' })
      response.end()
      return
    }
    const asset = assets.get(request.url)
    if (!asset) {
      response.writeHead(404)
      response.end()
      return
    }
    response.writeHead(200, { 'Content-Type': asset.type, 'Content-Length': asset.body.length })
    response.end(request.method === 'HEAD' ? undefined : asset.body)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve()
    })
  })
  const address = server.address()
  const url = `http://127.0.0.1:${address.port}/`
  console.log(url)
  return { server, url }
}

const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry) {
  const { server } = await startDemoServer()
  const stop = () => {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
    server.close((error) => {
      if (error) {
        console.error(error)
        process.exitCode = 1
      }
    })
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}
