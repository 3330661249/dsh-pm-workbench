import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const manifestPath = resolve(import.meta.dirname, '../../packages/workbench/package.json')

describe('workbench bundle manifest', () => {
  test('declares the single private rc.6 Host and Client bundle contract', async () => {
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

    expect(manifest.name).toBe('@knight/dsh-pm-workbench')
    expect(manifest.private).toBe(true)
    expect(manifest.version).toBe('0.1.0')
    expect(manifest.main).toBe('./lib/index.js')
    expect(manifest).not.toHaveProperty('optionalDependencies')
    expect(manifest.license).toBe('UNLICENSED')
    expect(manifest.exports['.']).toBe('./lib/index.js')
    expect(manifest.exports['./client']).toBe('./lib/client.js')
    expect(manifest.dsh.bundle.patch).toBe('./cordis.patch.yml')
    expect(manifest.dsh.client).toEqual({
      platform: 'web',
      inject: [
        '@deepseek-ai/dsh-client-connection',
        '@deepseek-ai/dsh-client-runtime',
        '@deepseek-ai/dsh-client-ui-layout',
        '@deepseek-ai/dsh-client-ui-sidebar',
      ],
    })
    expect(manifest.exports['./package.json']).toBe('./package.json')
    expect(manifest).not.toHaveProperty('dependencies')
    expect(manifest.files).toEqual([
      'lib',
      'cordis.patch.yml',
      'README.md',
      'LICENSE',
      'docs',
    ])
    expect(manifest.peerDependencies).toEqual(expect.objectContaining({
      '@deepseek-ai/cordis': '4.0.1',
      '@deepseek-ai/dsh-invariants': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-connection': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-layout': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-sidebar': '0.1.0-rc.6',
      '@deepseek-ai/dsh-client-ui-slots': '0.1.0-rc.6',
      '@deepseek-ai/dsh-storage-domain': '0.1.0-rc.6',
      react: '18.3.1',
      'react-dom': '18.3.1',
    }))
    expect(manifest.peerDependenciesMeta).toEqual({
      '@deepseek-ai/cordis': { optional: true },
      '@deepseek-ai/dsh-invariants': { optional: true },
      '@deepseek-ai/dsh-client-connection': { optional: true },
      '@deepseek-ai/dsh-client-runtime': { optional: true },
      '@deepseek-ai/dsh-client-ui-layout': { optional: true },
      '@deepseek-ai/dsh-client-ui-sidebar': { optional: true },
      '@deepseek-ai/dsh-client-ui-slots': { optional: true },
      '@deepseek-ai/dsh-storage-domain': { optional: true },
      react: { optional: true },
      'react-dom': { optional: true },
    })
  })

})

test('ships truthful Stage 3A package documentation and the unchanged full Zod notice', async () => {
  const packageRoot = resolve(import.meta.dirname, '../../packages/workbench')
  for (const file of ['README.md', 'docs/compatibility.md', 'docs/privacy.md']) {
    const text = await readFile(resolve(packageRoot, file), 'utf8')
    expect(text).toMatch(/Stage 3A/)
    expect(text).toMatch(/synthetic/i)
    expect(text).toMatch(/Stage 3B.*unimplemented/s)
    expect(text).toMatch(/not secure erasure/)
    expect(text).not.toContain('/dsh-pm-workbench-v1')
  }
  const notice = await readFile(resolve(packageRoot, 'docs/third-party.md'), 'utf8')
  expect(notice).toContain((await readFile(resolve(packageRoot, '../../node_modules/zod/LICENSE'), 'utf8')).trim())
  expect(notice).toContain('Zod 4.4.3')
  expect(notice).toContain('shared Product schemas')
})
