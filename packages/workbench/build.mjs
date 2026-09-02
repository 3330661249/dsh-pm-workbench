import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'
import { assertWorkbenchWritePath } from '../../scripts/workspace-boundary.ts'

const packageRoot = path.resolve(import.meta.dirname)

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

const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry && (process.argv.includes('--verify-profile') || process.argv.includes('--test-e2e'))) {
  console.error('Not implemented in Task 1.1: profile/E2E verification requires a later compatibility task.')
  process.exitCode = 1
} else if (isEntry && process.argv.includes('--verify')) {
  await buildWorkbench()
  console.log('package build verification passed')
} else if (isEntry) {
  await buildWorkbench()
}
