import { mkdir, mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import path from 'node:path'
import type { Metafile } from 'esbuild'
import { expect, test } from 'vitest'
import {
  assertClientProbeBuildGraph,
  assertHostProbeBuildGraph,
} from './helpers/stage2-build-graph.js'

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

test('accepts the complete frozen Stage 2 synthetic Host and Client graphs', () => {
  const host = syntheticMetafile([
    'packages/workbench/src/config.ts',
    'packages/workbench/src/index.ts',
    'packages/workbench/src/integration/harness-rc6/probe-host.ts',
    'packages/workbench/src/probe/protocol.ts',
    'packages/workbench/src/probe/service.ts',
    'node_modules/zod/index.js',
  ])
  const client = syntheticMetafile([
    'packages/workbench/src/client/index.tsx',
    'packages/workbench/src/client/probe/ProbeView.tsx',
    'packages/workbench/src/client/probe/store.ts',
    'packages/workbench/src/client/probe/transport.ts',
    'packages/workbench/src/probe/protocol.ts',
    'node_modules/zod/index.js',
  ])
  host.outputs['synthetic-output.js']!.entryPoint = 'packages/workbench/src/index.ts'
  client.outputs['synthetic-output.js']!.entryPoint = 'packages/workbench/src/client/index.tsx'
  for (const graph of [host, client]) {
    graph.outputs['synthetic-output.js']!.inputs = Object.fromEntries(Object.keys(graph.inputs).map(input => [input, { bytesInOutput: 1 }]))
  }
  expect(() => assertHostProbeBuildGraph(host)).not.toThrow()
  expect(() => assertClientProbeBuildGraph(client)).not.toThrow()
})
