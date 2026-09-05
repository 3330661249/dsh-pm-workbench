import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { buildWorkbench } from '../packages/workbench/build.mjs'

const root = path.resolve(import.meta.dirname, '..')
await buildWorkbench()
const result = execFileSync('npm', ['pack', '--workspace', 'packages/workbench', '--json', '--dry-run'], { cwd: root, encoding: 'utf8', env: { ...process.env, npm_config_cache: path.join(root, '.tmp', 'npm-cache') } })
const metadata = JSON.parse(result)
const files = metadata[0]?.files?.map((item) => item.path) ?? []
const forbidden = /(^|\/)(tests?|src|\.tmp)(\/|$)|\.env$|\/(Users|private|tmp)\//
if (files.some((file) => forbidden.test(file))) throw new Error(`forbidden package file: ${files.find((file) => forbidden.test(file))}`)
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'packages/workbench/package.json'), 'utf8'))
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') throw new Error('invalid dsh bundle patch metadata')
if (!manifest.dsh?.client?.inject?.length) throw new Error('missing dsh client inject graph')
if (!files.includes('cordis.patch.yml') || !files.includes('lib/client.js')) throw new Error('required bundle files missing')
for (const file of files) {
  const absolute = path.join(root, 'packages/workbench', file)
  if (!fs.statSync(absolute).isFile()) continue
  const bytes = fs.readFileSync(absolute)
  if (bytes.includes(Buffer.from(root))) throw new Error(`absolute repository path leaked into package file: ${file}`)
}
const client = fs.readFileSync(path.join(root, 'packages/workbench/lib/client.js'), 'utf8')
if (!client.includes('window.__ModuleLoader__.load') || !client.includes("id:'@knight/dsh-pm-workbench'")) throw new Error('invalid client wrapper')
const patch = fs.readFileSync(path.join(root, 'packages/workbench/cordis.patch.yml'), 'utf8')
if ((patch.match(/^- insert:/gm) ?? []).length !== 1) throw new Error('patch must contain exactly one insert')
console.log(JSON.stringify({ files, status: 'verified' }, null, 2))
