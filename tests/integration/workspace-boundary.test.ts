import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from 'vitest'
import { assertWorkbenchWritePath } from '../../scripts/workspace-boundary.ts'

const repositoryRoot = path.resolve(import.meta.dirname, '../..')
const workbenchBuildRoot = path.join(repositoryRoot, 'packages', 'workbench', 'lib')
const workbenchTempRoot = path.join(repositoryRoot, '.tmp')

test('allows only generated package output and repository-local temporary targets', () => {
  expect(() => assertWorkbenchWritePath(path.join(workbenchBuildRoot, 'client.js'))).not.toThrow()
  expect(() => assertWorkbenchWritePath(path.join(workbenchTempRoot, 'profile', 'cordis.yml'))).not.toThrow()
})

test('rejects source, manifest, and other repository write targets', () => {
  expect(() => assertWorkbenchWritePath(path.join(repositoryRoot, 'README.md'))).toThrow()
  expect(() => assertWorkbenchWritePath(path.join(repositoryRoot, 'packages', 'workbench', 'src', 'client.tsx'))).toThrow()
  expect(() => assertWorkbenchWritePath(path.join(repositoryRoot, 'packages', 'workbench', 'generated', 'client.js'))).toThrow()
})

test('rejects a repository-local temporary path that escapes through a symlink', () => {
  fs.mkdirSync(workbenchTempRoot, { recursive: true })
  const fixtureRoot = fs.mkdtempSync(path.join(workbenchTempRoot, 'boundary-test-'))
  const escapeLink = path.join(fixtureRoot, 'escape')
  const escapeTarget = fs.mkdtempSync(path.join(os.tmpdir(), 'workspace-boundary-escape-'))
  try {
    fs.symlinkSync(escapeTarget, escapeLink)
    expect(() => assertWorkbenchWritePath(path.join(escapeLink, 'should-not-write.js'))).toThrow()
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true })
    fs.rmSync(escapeTarget, { recursive: true, force: true })
  }
})
