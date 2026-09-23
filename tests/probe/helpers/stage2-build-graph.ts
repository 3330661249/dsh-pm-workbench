import { builtinModules } from 'node:module'
import type { Metafile } from 'esbuild'

function normalized(value: string): string { return value.replaceAll('\\', '/') }

function isHostExternal(specifier: string) {
  return specifier.startsWith('@deepseek-ai/')
    || specifier.startsWith('node:')
    || builtinModules.includes(specifier)
}

function isClientExternal(specifier: string) {
  return specifier === 'react'
    || specifier.startsWith('react/')
    || specifier === 'react-dom'
    || specifier.startsWith('react-dom/')
    || specifier.startsWith('@deepseek-ai/')
}

const hostSourceInputs = new Set([
  'packages/workbench/src/config.ts',
  'packages/workbench/src/index.ts',
  'packages/workbench/src/integration/harness-rc6/probe-host.ts',
  'packages/workbench/src/probe/protocol.ts',
  'packages/workbench/src/probe/service.ts',
])

const clientSourceInputs = new Set([
  'packages/workbench/src/client/index.tsx',
  'packages/workbench/src/client/probe/ProbeView.tsx',
  'packages/workbench/src/client/probe/store.ts',
  'packages/workbench/src/client/probe/transport.ts',
  'packages/workbench/src/probe/protocol.ts',
])

function isHostInput(input: string) {
  return hostSourceInputs.has(input) || input.startsWith('node_modules/zod/')
}

function isClientInput(input: string) {
  return clientSourceInputs.has(input) || input.startsWith('node_modules/zod/')
}

function assertBuildGraph(label: string, metafile: Metafile, allowInput: (input: string) => boolean, allowExternal: (specifier: string) => boolean) {
  const inputs = Object.keys(metafile.inputs).map(normalized)
  if (!inputs.some((input: string) => input.includes('node_modules/zod/'))) {
    throw new Error(`${label} build must bundle Zod`)
  }
  const forbiddenInput = inputs.find((input: string) => !allowInput(input))
  if (forbiddenInput) {
    throw new Error(`${label} build has a forbidden input: ${forbiddenInput}`)
  }
  if (inputs.some((input: string) => input.includes('node_modules/@deepseek-ai/'))) {
    throw new Error(`${label} build bundled DeepSeek or Cordis runtime source`)
  }
  const imports = Object.values(metafile.outputs).flatMap((output) => output.imports)
  for (const imported of imports) {
    if (!imported.external || !allowExternal(imported.path) || imported.path === 'zod') {
      throw new Error(`${label} build has an undeclared external: ${imported.path}`)
    }
  }
}

export function assertHostProbeBuildGraph(metafile: Metafile) {
  assertBuildGraph('Host', metafile, isHostInput, isHostExternal)
}

export function assertClientProbeBuildGraph(metafile: Metafile) {
  assertBuildGraph('Client', metafile, isClientInput, isClientExternal)
}
