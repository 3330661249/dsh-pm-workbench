import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { builtinModules } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { assertWorkbenchDemoWritePath, assertWorkbenchWritePath } from '../../scripts/workspace-boundary.ts'

const packageRoot = path.resolve(import.meta.dirname)
const repositoryRoot = path.resolve(packageRoot, '../..')
const demoTempRoot = path.join(repositoryRoot, '.tmp', 'dsh-pm-workbench')
const defaultDemoOutdir = path.join(demoTempRoot, 'demo')

const hostExternals = [...new Set([
  '@deepseek-ai/*',
  ...builtinModules,
  ...builtinModules.map((name) => name.startsWith('node:') ? name : `node:${name}`),
])]
const clientExternals = [
  'react',
  'react/*',
  'react-dom',
  'react-dom/*',
  '@deepseek-ai/*',
]

function normalized(value) {
  return value.replaceAll('\\', '/')
}

function isHostExternal(specifier) {
  return specifier.startsWith('@deepseek-ai/')
    || specifier.startsWith('node:')
    || builtinModules.includes(specifier)
}

function isClientExternal(specifier) {
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

function isHostInput(input) {
  return hostSourceInputs.has(input) || input.startsWith('node_modules/zod/')
}

function isClientInput(input) {
  return clientSourceInputs.has(input) || input.startsWith('node_modules/zod/')
}

function assertBuildGraph(label, metafile, allowInput, allowExternal) {
  const inputs = Object.keys(metafile.inputs).map(normalized)
  if (!inputs.some((input) => input.includes('node_modules/zod/'))) {
    throw new Error(`${label} build must bundle Zod`)
  }
  const forbiddenInput = inputs.find((input) => !allowInput(input))
  if (forbiddenInput) {
    throw new Error(`${label} build has a forbidden input: ${forbiddenInput}`)
  }
  if (inputs.some((input) => input.includes('node_modules/@deepseek-ai/'))) {
    throw new Error(`${label} build bundled DeepSeek or Cordis runtime source`)
  }
  const imports = Object.values(metafile.outputs).flatMap((output) => output.imports)
  for (const imported of imports) {
    if (!imported.external || !allowExternal(imported.path) || imported.path === 'zod') {
      throw new Error(`${label} build has an undeclared external: ${imported.path}`)
    }
  }
}

export function assertHostProbeBuildGraph(metafile) {
  assertBuildGraph('Host', metafile, isHostInput, isHostExternal)
}

export function assertClientProbeBuildGraph(metafile) {
  assertBuildGraph('Client', metafile, isClientInput, isClientExternal)
}

/**
 * @param {{ outdir?: string, onWrite?: (target: string) => void }} [options]
 */
export async function buildWorkbench({ outdir = path.join(packageRoot, 'lib'), onWrite } = {}) {
  const guarded = (target) => {
    assertWorkbenchWritePath(target)
    onWrite?.(target)
    assertWorkbenchWritePath(target)
    return target
  }
  const lib = path.resolve(outdir)
  const hostPath = path.join(lib, 'index.js')
  const clientPath = path.join(lib, 'client.js')
  const [host, client] = await Promise.all([
    build({
      absWorkingDir: repositoryRoot,
      entryPoints: [path.relative(repositoryRoot, path.join(packageRoot, 'src/index.ts'))],
      outfile: hostPath,
      bundle: true,
      write: false,
      metafile: true,
      format: 'esm',
      platform: 'node',
      external: hostExternals,
      sourcemap: false,
    }),
    build({
      absWorkingDir: repositoryRoot,
      entryPoints: [path.relative(repositoryRoot, path.join(packageRoot, 'src/client/index.tsx'))],
      outfile: clientPath,
      bundle: true,
      write: false,
      metafile: true,
      format: 'cjs',
      platform: 'browser',
      external: clientExternals,
      sourcemap: false,
    }),
  ])
  if (host.outputFiles.length !== 1 || client.outputFiles.length !== 1) {
    throw new Error('Workbench build must produce exactly one Host and one Client output')
  }
  assertHostProbeBuildGraph(host.metafile)
  assertClientProbeBuildGraph(client.metafile)
  const source = client.outputFiles[0].text
  const wrapped = `window.__ModuleLoader__.load({ id:'@knight/dsh-pm-workbench', factory(require) { const module={exports:{}}; const exports=module.exports; ${source}; return module.exports; } });\n`
  if (/(?:from\s*['"]zod['"]|require\(\s*['"]zod['"]\s*\))/.test(`${host.outputFiles[0].text}\n${wrapped}`)) {
    throw new Error('Workbench output retained a bare Zod runtime import')
  }
  await rm(guarded(lib), { recursive: true, force: true })
  await mkdir(guarded(lib), { recursive: true })
  await writeFile(guarded(hostPath), host.outputFiles[0].contents)
  await writeFile(guarded(clientPath), wrapped)
  return { hostMetafile: host.metafile, clientMetafile: client.metafile }
}

export async function buildPackableWorkbench() {
  return buildWorkbench()
}

export async function buildDemo({ outdir = defaultDemoOutdir, guard = assertWorkbenchWritePath } = {}) {
  const outputRoot = path.resolve(outdir)
  assertWorkbenchDemoWritePath(outputRoot)
  const guarded = (target) => {
    guard(target)
    // Recheck after the hook as well: it cannot weaken the physical boundary.
    assertWorkbenchDemoWritePath(target)
    return target
  }
  guarded(outputRoot)
  const jsPath = path.join(outputRoot, 'assets', 'demo.js')
  const cssPath = path.join(outputRoot, 'assets', 'demo.css')
  const result = await build({
    entryPoints: [path.join(packageRoot, 'demo', 'main.tsx')],
    outfile: jsPath,
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    charset: 'utf8',
    sourcemap: false,
  })
  const outputs = new Map(result.outputFiles.map((file) => [file.path, file.contents]))
  if (result.outputFiles.length !== 2 || outputs.size !== 2 || !outputs.has(jsPath) || !outputs.has(cssPath)) {
    throw new Error('Demo build must produce exactly assets/demo.js and assets/demo.css')
  }
  let html = await readFile(path.join(packageRoot, 'demo', 'index.html'), 'utf8')
  if (!html.includes('<link rel="stylesheet" href="./assets/demo.css">')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="./assets/demo.css">\n</head>')
  }
  await rm(guarded(outputRoot), { recursive: true, force: true })
  await mkdir(guarded(outputRoot), { recursive: true })
  await mkdir(guarded(path.join(outputRoot, 'assets')), { recursive: true })
  await writeFile(guarded(path.join(outputRoot, 'index.html')), html, 'utf8')
  await writeFile(guarded(jsPath), outputs.get(jsPath))
  await writeFile(guarded(cssPath), outputs.get(cssPath))
  return outputRoot
}

const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry && (process.argv.includes('--verify-profile') || process.argv.includes('--test-e2e'))) {
  console.error('Not implemented in Task 1.1: profile/E2E verification requires a later compatibility task.')
  process.exitCode = 1
} else if (isEntry && process.argv.includes('--verify')) {
  await buildWorkbench()
  console.log('package build verification passed')
} else if (isEntry && process.argv.includes('--demo')) {
  await buildDemo()
} else if (isEntry) {
  await buildWorkbench()
}
