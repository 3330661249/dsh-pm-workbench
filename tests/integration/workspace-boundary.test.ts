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

const demoRoot = path.join(workbenchTempRoot, 'dsh-pm-workbench')

test('allows strict physical Demo descendants and rejects wider roots and package output', async () => {
  const { assertWorkbenchDemoWritePath } = await import('../../scripts/workspace-boundary.ts')
  expect(() => assertWorkbenchDemoWritePath(path.join(demoRoot, 'demo'))).not.toThrow()
  expect(() => assertWorkbenchDemoWritePath(path.join(demoRoot, 'test-guard', 'assets/demo.js'))).not.toThrow()
  for (const target of [workbenchTempRoot, demoRoot, path.join(workbenchBuildRoot, 'demo')]) {
    expect(() => assertWorkbenchDemoWritePath(target)).toThrow()
  }
})

test('rejects a Demo child symlink pointing elsewhere inside the wider temporary root', async () => {
  const { assertWorkbenchDemoWritePath } = await import('../../scripts/workspace-boundary.ts')
  fs.mkdirSync(demoRoot, { recursive: true })
  const fixture = fs.mkdtempSync(path.join(demoRoot, 'test-boundary-'))
  const outside = fs.mkdtempSync(path.join(workbenchTempRoot, 'demo-escape-'))
  try {
    fs.symlinkSync(outside, path.join(fixture, 'escape'))
    expect(() => assertWorkbenchDemoWritePath(path.join(fixture, 'escape', 'new', 'demo.js'))).toThrow()
  } finally {
    fs.rmSync(fixture, { recursive: true, force: true })
    fs.rmSync(outside, { recursive: true, force: true })
  }
})
