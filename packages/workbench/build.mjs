import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { assertWorkbenchDemoWritePath, assertWorkbenchWritePath } from '../../scripts/workspace-boundary.ts'

const packageRoot = path.resolve(import.meta.dirname)
const repositoryRoot = path.resolve(packageRoot, '../..')
const demoTempRoot = path.join(repositoryRoot, '.tmp', 'dsh-pm-workbench')
const defaultDemoOutdir = path.join(demoTempRoot, 'demo')

export async function buildWorkbench({ outdir = path.join(packageRoot, 'lib'), guard = assertWorkbenchWritePath } = {}) {
  const guarded = (target) => { guard(target); return target }
  const lib = path.resolve(outdir)
  await rm(guarded(lib), { recursive: true, force: true })
  await mkdir(guarded(lib), { recursive: true })
  await build({ entryPoints: [path.join(packageRoot, 'src/index.ts')], outfile: guarded(path.join(lib, 'index.js')), bundle: true, format: 'esm', platform: 'node', sourcemap: false })
  const client = await build({ entryPoints: [path.join(packageRoot, 'src/client/index.tsx')], bundle: true, write: false, format: 'cjs', platform: 'browser', external: ['react', 'react/*', 'react-dom', 'react-dom/*', '@deepseek-ai/*'], sourcemap: false })
  const source = client.outputFiles[0].text
  const wrapped = `window.__ModuleLoader__.load({ id:'@knight/dsh-pm-workbench', factory(require) { const module={exports:{}}; const exports=module.exports; ${source}; return module.exports; } });\n`
  await writeFile(guarded(path.join(lib, 'client.js')), wrapped)
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
