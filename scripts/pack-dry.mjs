import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { buildWorkbench } from '../packages/workbench/build.mjs'

const root = path.resolve(import.meta.dirname, '..')

await buildWorkbench()
execFileSync('npm', ['pack', '--workspace', 'packages/workbench', '--dry-run'], {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    npm_config_cache: path.join(root, '.tmp', 'npm-cache'),
  },
})
