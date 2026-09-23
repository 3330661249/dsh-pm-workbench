import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile, lstat, realpath } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
const ROOT = import.meta.dirname
const ZOD_ROOT = path.resolve(ROOT, '../../../../node_modules/zod')
export const PACKAGE_FILES = Object.freeze(['cordis.patch.yml', 'lib/client.js', 'lib/index.js', 'package.json'])
const HOST_SOURCES = ['host.ts', 'record.ts']
const CLIENT_SOURCES = ['client.tsx', 'record.ts']
const HOST_EXTERNALS = ['@deepseek-ai/dsh-storage-domain', 'node:crypto']
const CLIENT_EXTERNALS = ['react', 'react/jsx-runtime']
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
export function assertFixtureGraph(metafile, kind) {
  const sources = kind === 'host' ? HOST_SOURCES : CLIENT_SOURCES
  const externals = kind === 'host' ? HOST_EXTERNALS : CLIENT_EXTERNALS
  const seen = new Set()
  let bundledZod = false
  for (const [input, entry] of Object.entries(metafile.inputs)) {
    const absolute = path.resolve(ROOT, input)
    const relative = path.relative(ROOT, absolute)
    if (sources.includes(relative)) seen.add(relative)
    else if (absolute.startsWith(`${ZOD_ROOT}${path.sep}`) && /\.js$/.test(absolute)) bundledZod = true
    else throw Error('fixture-input-forbidden')
    for (const dependency of entry.imports) if (dependency.external && !externals.includes(dependency.path)) throw Error('fixture-external-forbidden')
  }
  for (const output of Object.values(metafile.outputs)) {
    for (const dependency of output.imports) if (!dependency.external || !externals.includes(dependency.path)) throw Error('fixture-output-external-forbidden')
  }
  if (seen.size !== sources.length || !bundledZod) throw Error('fixture-source-closure')
}
export async function buildStorageGateFixture({ outputRoot }) {
  if (!path.isAbsolute(outputRoot) || await realpath(outputRoot) !== outputRoot || !(await lstat(outputRoot)).isDirectory()) throw Error('fixture-output-root')
  const output = path.join(outputRoot, 'build')
  await mkdir(output, { mode: 0o700 })
  const results = {}
  for (const [kind, entry, externals] of [['host', 'host.ts', HOST_EXTERNALS], ['client', 'client.tsx', CLIENT_EXTERNALS]]) {
    const result = await build({ absWorkingDir: ROOT, entryPoints: [entry], bundle: true, write: false, metafile: true, format: kind === 'host' ? 'esm' : 'cjs', platform: kind === 'host' ? 'node' : 'browser', target: kind === 'host' ? 'node24' : 'es2022', jsx: 'automatic', legalComments: 'none', external: externals, outfile: kind === 'host' ? 'lib/index.js' : 'lib/client.js' })
    assertFixtureGraph(result.metafile, kind)
    results[kind] = result
  }
  const manifest = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'))
  if (manifest.name !== '@knight/dsh-pm-workbench-storage-gate' || manifest.version !== '0.0.0-stage3a' || manifest.dependencies || manifest.scripts) throw Error('fixture-package-identity')
  const files = []
  for (const file of PACKAGE_FILES) {
    const bytes = file === 'lib/index.js' ? Buffer.from(results.host.outputFiles[0].contents) : file === 'lib/client.js' ? Buffer.from(`window.__ModuleLoader__.load({ id:'@knight/dsh-pm-workbench-storage-gate', factory(require) { const module={exports:{}}; const exports=module.exports; ${results.client.outputFiles[0].text}; return module.exports; } });\n`) : await readFile(path.join(ROOT, file))
    const destination = path.join(output, file)
    await mkdir(path.dirname(destination), { recursive: true, mode: 0o700 })
    await writeFile(destination, bytes, { flag: 'wx', mode: 0o644 })
    files.push({ path: file, mode: 0o644, size: bytes.length, sha256: hash(bytes) })
  }
  const receipt = { name: manifest.name, version: manifest.version, bundledZod: true, runtimeDependencies: 0, packageRoot: output, files, packageFiles: PACKAGE_FILES.map(file => `package/${file}`), hostMetafile: results.host.metafile, clientMetafile: results.client.metafile, outputHashes: Object.fromEntries(files.filter(f => f.path.startsWith('lib/')).map(f => [f.path, f.sha256])) }
  return receipt
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error('arguments')
    const receipt = await buildStorageGateFixture({ outputRoot: process.argv[2] })
    await writeFile(path.join(process.argv[2], 'build-receipt.json'), JSON.stringify(receipt), { flag: 'wx', mode: 0o600 })
  } catch { process.stderr.write('STAGE3A_FIXTURE_BUILD=FAIL\n'); process.exitCode = 1 }
}
