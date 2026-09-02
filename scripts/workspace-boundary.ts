import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repositoryRoot = fs.realpathSync.native(path.resolve(import.meta.dirname, '..'))
const workbenchBuildRoot = path.join(repositoryRoot, 'packages', 'workbench', 'lib')
const workbenchTempRoot = path.join(repositoryRoot, '.tmp')

function isWithin(candidate: string, parent: string): boolean {
  const relative = path.relative(parent, candidate)
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

/**
 * Resolves every existing path component, including symlinks. For a target that
 * does not exist yet, its deepest existing ancestor is resolved physically and
 * the still-new suffix is then restored. This prevents a lexical in-bound path
 * from writing through a symlink to an out-of-bound destination.
 */
function resolveForWrite(candidate: string): string {
  const unresolvedSuffix: string[] = []
  let cursor = path.resolve(candidate)

  while (!fs.existsSync(cursor)) {
    const parent = path.dirname(cursor)
    assert.notEqual(parent, cursor, `Unable to find an existing ancestor for ${candidate}`)
    unresolvedSuffix.unshift(path.basename(cursor))
    cursor = parent
  }

  return path.join(fs.realpathSync.native(cursor), ...unresolvedSuffix)
}

const allowedWriteRoots = [
  workbenchBuildRoot,
  workbenchTempRoot,
]

/**
 * Required guard for workbench build, cleanup, and temporary writers. Generated
 * package output is restricted to packages/workbench/lib; all disposable probe,
 * cache, and matrix output is restricted to the standalone repository's .tmp.
 */
export function assertWorkbenchWritePath(candidate: string): void {
  const resolvedCandidate = resolveForWrite(candidate)
  assert.ok(
    allowedWriteRoots.some((allowedRoot) => isWithin(resolvedCandidate, allowedRoot)),
    `Workbench writes are restricted to ${allowedWriteRoots.join(' or ')}; received ${resolvedCandidate}`,
  )
}
