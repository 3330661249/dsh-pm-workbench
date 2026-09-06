import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { buildWorkbench } from '../packages/workbench/build.mjs'

const root = path.resolve(import.meta.dirname, '..')
const buildEvidence = await buildWorkbench()
if (!buildEvidence?.hostMetafile || !buildEvidence?.clientMetafile) {
  throw new Error('build did not return Host and Client graph evidence')
}
const result = execFileSync('npm', ['pack', '--workspace', 'packages/workbench', '--json', '--dry-run'], { cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(root, '.tmp', 'npm-cache') } })
const metadata = JSON.parse(result)
const files = metadata[0]?.files?.map((item) => item.path) ?? []
const forbidden = /(^|\/)(tests?|src|\.tmp)(\/|$)|\.env$|\/(Users|private|tmp)\//
if (files.some((file) => forbidden.test(file))) throw new Error(`forbidden package file: ${files.find((file) => forbidden.test(file))}`)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'packages/workbench/package.json'), 'utf8'))
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('invalid dsh bundle patch metadata')
if (!manifest.dsh?.client?.inject?.length) throw new Error('missing dsh client inject graph')
if (Object.hasOwn(manifest, 'dependencies')) throw new Error('published package must have zero runtime dependencies')
for (const required of ['cordis.patch.yml', 'lib/index.js', 'lib/client.js', 'docs/third-party.md']) {
  if (!files.includes(required)) throw new Error(`required bundle file missing: ${required}`)
}
for (const file of files) {
  const absolute = path.join(root, 'packages/workbench', file)
  if (!fs.statSync(absolute).isFile()) continue
  const bytes = fs.readFileSync(absolute)
  if (bytes.includes(Buffer.from(root))) throw new Error(`absolute repository path leaked into package file: ${file}`)
  const text = bytes.toString('utf8')
  if (/(?:file:\/\/|\/Users\/[^\s'"`]+|\/private\/tmp\/[^\s'"`]+)/.test(text)) {
    throw new Error(`absolute filesystem path leaked into package file: ${file}`)
  }
}
const graphInputs = (metafile) => Object.keys(metafile.inputs).map((input) => input.replaceAll('\\', '/'))
for (const [label, metafile] of [['Host', buildEvidence.hostMetafile], ['Client', buildEvidence.clientMetafile]]) {
  const inputs = graphInputs(metafile)
  if (!inputs.some((input) => input.includes('node_modules/zod/'))) throw new Error(`${label} graph did not bundle Zod`)
  if (inputs.some((input) => input.includes('node_modules/@deepseek-ai/'))) throw new Error(`${label} graph bundled a Harness or Cordis runtime`)
}
const host = fs.readFileSync(path.join(root, 'packages/workbench/lib/index.js'), 'utf8')
const client = fs.readFileSync(path.join(root, 'packages/workbench/lib/client.js'), 'utf8')
if (!client.includes('window.__ModuleLoader__.load') || !client.includes("id:'@knight/dsh-pm-workbench'")) throw new Error('invalid client wrapper')
if (/(?:from\s*['"]zod['"]|require\(\s*['"]zod['"]\s*\))/.test(`${host}\n${client}`)) throw new Error('bare Zod runtime import remained in output')
const patch = fs.readFileSync(path.join(root, 'packages/workbench/cordis.patch.yml'), 'utf8')
if ((patch.match(/^- insert:/gm) ?? []).length !== 1) throw new Error('patch must contain exactly one insert')
const zodLicense = fs.readFileSync(path.join(root, 'node_modules/zod/LICENSE'), 'utf8').trim()
const thirdParty = fs.readFileSync(path.join(root, 'packages/workbench/docs/third-party.md'), 'utf8')
if (!thirdParty.includes(zodLicense)) throw new Error('packed third-party notice does not contain the complete Zod license')
console.log(JSON.stringify({ files, bundledZod: true, runtimeDependencies: 0, status: 'verified' }, null, 2))
