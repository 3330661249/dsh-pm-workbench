import { lstat, realpath } from 'node:fs/promises'
import path from 'node:path'

const RUNS_RELATIVE_ROOT = '.tmp/dsh-pm-workbench/version-matrix/runs'
const CASE_ID = /^[a-z0-9](?:[a-z0-9.-]{0,62}[a-z0-9])?$/

export interface CasePaths {
  readonly root: string
  readonly workspace: string
  readonly npmCache: string
  readonly npmrc: string
  readonly nodeModules: string
  readonly logs: string
  readonly proposedLock: string
  readonly evidence: string
  readonly report: string
}

function isWithin(root: string, target: string): boolean {
  const relative = path.relative(root, target)
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative))
}

async function exists(value: string): Promise<boolean> {
  try {
    await lstat(value)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

async function nearestExistingAncestor(value: string): Promise<string> {
  let current = value
  while (!(await exists(current))) {
    const parent = path.dirname(current)
    if (parent === current) throw new Error('output path has no existing ancestor')
    current = parent
  }
  return current
}

export async function resolveNewRunRoot(
  repositoryRoot: string,
  requestedRelative: string,
): Promise<string> {
  if (
    requestedRelative.length === 0
    || path.isAbsolute(requestedRelative)
    || requestedRelative.split(/[\\/]/u).includes('..')
  ) {
    throw new Error('output path must be a traversal-free relative path')
  }

  const repositoryReal = await realpath(repositoryRoot)
  const runsRoot = path.resolve(repositoryReal, RUNS_RELATIVE_ROOT)
  const runsReal = await realpath(runsRoot)
  const target = path.resolve(repositoryReal, requestedRelative)
  if (!isWithin(runsRoot, target) || target === runsRoot) {
    throw new Error(`output path must be a new child of ${RUNS_RELATIVE_ROOT}`)
  }
  if (await exists(target)) throw new Error('output path already exists')

  const existingAncestor = await nearestExistingAncestor(target)
  const existingReal = await realpath(existingAncestor)
  if (!isWithin(runsReal, existingReal)) {
    throw new Error('output path resolves outside the runs root through a symlink')
  }
  return target
}

export function assertSafeCaseId(caseId: string): void {
  if (!CASE_ID.test(caseId)) throw new Error('case id must match the safe slug grammar')
}

export function allocateCasePaths(runRoot: string, caseId: string): CasePaths {
  assertSafeCaseId(caseId)
  const root = path.join(runRoot, 'cases', caseId)
  const workspace = path.join(root, 'workspace')
  return {
    root,
    workspace,
    npmCache: path.join(root, 'npm-cache'),
    npmrc: path.join(root, 'npmrc'),
    nodeModules: path.join(workspace, 'node_modules'),
    logs: path.join(root, 'logs'),
    proposedLock: path.join(root, 'proposed-lock'),
    evidence: path.join(root, 'evidence.json'),
    report: path.join(root, 'report.md'),
  }
}

export function assertLexicallyWithin(root: string, target: string, label: string): void {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(target)
  if (!isWithin(resolvedRoot, resolvedTarget)) {
    throw new Error(`${label} is outside its allowed root`)
  }
}
