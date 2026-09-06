import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { Metafile } from 'esbuild'
import { expect, test } from 'vitest'
import {
  assertClientProbeBuildGraph,
  assertHostProbeBuildGraph,
  buildWorkbench,
} from '../../packages/workbench/build.mjs'

const repositoryRoot = path.resolve(import.meta.dirname, '../..')

async function filesUnder(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesUnder(root, path.join(prefix, entry.name))
    : [path.join(prefix, entry.name)]))).flat().sort()
}

function bundledInputs(metafile: Metafile): string[] {
  return Object.keys(metafile.inputs).map((input) => input.replaceAll('\\', '/'))
}

function externalImports(metafile: Metafile): string[] {
  return Object.values(metafile.outputs)
    .flatMap((output) => output.imports)
    .filter((entry) => entry.external)
    .map((entry) => entry.path)
}

function isHostExternal(specifier: string): boolean {
  return specifier.startsWith('@deepseek-ai/')
    || specifier.startsWith('node:')
}

function isClientExternal(specifier: string): boolean {
  return specifier === 'react'
    || specifier.startsWith('react/')
    || specifier === 'react-dom'
    || specifier.startsWith('react-dom/')
    || specifier.startsWith('@deepseek-ai/')
}

function syntheticMetafile(inputs: readonly string[]): Metafile {
  return {
    inputs: Object.fromEntries(inputs.map((input) => [input, {
      bytes: 1,
      imports: [],
    }])),
    outputs: {
      'synthetic-output.js': {
        bytes: 1,
        inputs: {},
        imports: [{
          path: '@deepseek-ai/dsh-client-connection',
          kind: 'import-statement',
          external: true,
        }],
        exports: [],
      },
    },
  }
}

test('rejects Client and React implementation inputs from the Host graph', () => {
  for (const forbiddenInput of [
    'packages/workbench/src/client/probe/store.ts',
    'node_modules/react/index.js',
    'node_modules/react-dom/index.js',
  ]) {
    const metafile = syntheticMetafile([
      'packages/workbench/src/index.ts',
      'node_modules/zod/index.js',
      forbiddenInput,
    ])

    expect(() => assertHostProbeBuildGraph(metafile)).toThrow(/Host build has a forbidden input/)
  }
})

test('rejects Host, Node-shim, and storage implementation inputs from the Client graph', () => {
  for (const forbiddenInput of [
    'packages/workbench/src/integration/harness-rc6/probe-host.ts',
    'packages/workbench/src/probe/service.ts',
    'packages/workbench/src/client/node-crypto-shim.ts',
    'node_modules/crypto-browserify/index.js',
    'node_modules/@deepseek-ai/dsh-storage-domain/lib/index.js',
  ]) {
    const metafile = syntheticMetafile([
      'packages/workbench/src/client/index.tsx',
      'packages/workbench/src/probe/protocol.ts',
      'node_modules/zod/index.js',
      forbiddenInput,
    ])

    expect(() => assertClientProbeBuildGraph(metafile)).toThrow(/Client build has a forbidden input/)
  }
})

test('bundles Zod but no Harness runtime and records closed Host and Client graphs', async () => {
  const tempRoot = path.join(repositoryRoot, '.tmp', 'dsh-pm-workbench')
  await mkdir(tempRoot, { recursive: true })
  const fixture = await mkdtemp(path.join(tempRoot, 'probe-build-'))
  const outdir = path.join(fixture, 'lib')

  try {
    const result = await buildWorkbench({ outdir })
    expect(await filesUnder(outdir)).toEqual(['client.js', 'index.js'])

    const hostInputs = bundledInputs(result.hostMetafile)
    const clientInputs = bundledInputs(result.clientMetafile)
    for (const inputs of [hostInputs, clientInputs]) {
      expect(inputs.some((input) => input.includes('node_modules/zod/'))).toBe(true)
      expect(inputs.some((input) => input.includes('node_modules/@deepseek-ai/'))).toBe(false)
    }

    const hostExternals = externalImports(result.hostMetafile)
    const clientExternals = externalImports(result.clientMetafile)
    expect(hostExternals.length).toBeGreaterThan(0)
    expect(clientExternals.length).toBeGreaterThan(0)
    expect(hostExternals.every(isHostExternal)).toBe(true)
    expect(clientExternals.every(isClientExternal)).toBe(true)
    expect([...hostExternals, ...clientExternals]).not.toContain('zod')
    expect(clientExternals.some((specifier) => specifier.startsWith('node:'))).toBe(false)

    const host = await readFile(path.join(outdir, 'index.js'), 'utf8')
    const client = await readFile(path.join(outdir, 'client.js'), 'utf8')
    expect(`${host}\n${client}`).not.toMatch(/(?:from\s*['"]zod['"]|require\(\s*['"]zod['"]\s*\))/)
    expect(client).toContain('window.__ModuleLoader__.load')
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
})
