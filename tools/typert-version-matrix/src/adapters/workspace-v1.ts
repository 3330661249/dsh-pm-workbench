import { createRequire } from 'node:module'
import { mkdir, realpath, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { AdapterEvidenceError } from '../assertions/errors.js'
import type {
  DirectGeneratorEvidence,
  NormalizedDiscovery,
  NormalizedEmitResult,
} from '../assertions/generation.js'

function object(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new AdapterEvidenceError(`${label} has an unsupported public API shape`)
  }
  return value as Record<string, unknown>
}

function normalizeRoot(workspaceRoot: string, root: unknown): string {
  if (typeof root !== 'string') throw new AdapterEvidenceError('discovery root is not a string')
  const relative = path.relative(workspaceRoot, root).split(path.sep).join('/')
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AdapterEvidenceError('discovery root resolves outside workspace')
  }
  return relative
}

function normalizeDiscovery(workspaceRoot: string, value: unknown): NormalizedDiscovery {
  const entry = object(value, 'discovery')
  if (typeof entry.package !== 'string' || !Array.isArray(entry.faces)) {
    throw new AdapterEvidenceError('discovery has an unsupported public API shape')
  }
  return {
    package: entry.package,
    root: normalizeRoot(workspaceRoot, entry.root),
    faces: entry.faces.map(String).sort(),
  }
}

function normalizeEmit(workspaceRoot: string, value: unknown): NormalizedEmitResult {
  const entry = object(value, 'emit result')
  const remote = entry.remote === undefined ? undefined : object(entry.remote, 'Remote emit result')
  if (
    typeof entry.package !== 'string'
    || typeof entry.face !== 'string'
    || !Array.isArray(entry.exports)
    || typeof entry.js !== 'string'
    || typeof entry.dts !== 'string'
  ) throw new AdapterEvidenceError('emit result has an unsupported public API shape')
  return {
    package: entry.package,
    packageRoot: normalizeRoot(workspaceRoot, entry.packageRoot),
    face: entry.face,
    exports: entry.exports.map(String).sort(),
    js: entry.js,
    dts: entry.dts,
    ...(remote === undefined ? {} : {
      remote: {
        js: String(remote.js ?? ''),
        dts: String(remote.dts ?? ''),
        dtsMap: String(remote.dtsMap ?? ''),
      },
    }),
  }
}

export async function inspectWorkspace(workspaceRoot: string): Promise<DirectGeneratorEvidence> {
  const root = await realpath(workspaceRoot)
  const require = createRequire(path.join(root, 'package.json'))
  let loaded: Record<string, unknown>
  try {
    loaded = object(
      await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-typert-generator')).href),
      'generator module',
    )
  } catch (error) {
    throw new AdapterEvidenceError(`cannot load reviewed generator export: ${String(error)}`)
  }
  if (typeof loaded.WorkspaceTypertGenerator !== 'function') {
    throw new AdapterEvidenceError('WorkspaceTypertGenerator public export is unavailable')
  }
  const generator = new (loaded.WorkspaceTypertGenerator as new (root: string) => {
    discover(faces: readonly ['host']): unknown[]
    generate(packages: readonly string[] | undefined, faces: readonly ['host']): unknown[]
  })(root)
  if (typeof generator.discover !== 'function' || typeof generator.generate !== 'function') {
    throw new AdapterEvidenceError('WorkspaceTypertGenerator API differs from workspace-v1')
  }
  try {
    const discover = generator.discover(['host']).map((entry) => normalizeDiscovery(root, entry))
    const automatic = generator.generate(undefined, ['host']).map((entry) => normalizeEmit(root, entry))
    const forced = generator
      .generate(['@knight/dsh-typert-matrix-probe'], ['host'])
      .map((entry) => normalizeEmit(root, entry))
    return { discover, automatic, forced }
  } catch (error) {
    if (error instanceof AdapterEvidenceError) throw error
    throw new AdapterEvidenceError(`workspace-v1 public API call failed: ${String(error)}`)
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  if (args.length !== 6 || args[0] !== '--workspace' || args[2] !== '--output' || args[4] !== '--case-root') {
    throw new AdapterEvidenceError('adapter requires fixed --workspace, --output, --case-root argv')
  }
  const workspace = await realpath(args[1]!)
  const caseRoot = await realpath(args[5]!)
  const output = path.resolve(args[3]!)
  const relative = path.relative(caseRoot, output)
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new AdapterEvidenceError('adapter output is outside case root')
  }
  const evidence = await inspectWorkspace(workspace)
  await mkdir(path.dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' })
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 2
  })
}
