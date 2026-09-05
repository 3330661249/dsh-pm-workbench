import { access, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { expect, test } from 'vitest'
import { buildDemo } from '../../packages/workbench/build.mjs'

const repositoryRoot = path.resolve(import.meta.dirname, '../..')
const tempRoot = path.join(repositoryRoot, '.tmp')
const demoRoot = path.join(tempRoot, 'dsh-pm-workbench')

async function fixture(): Promise<string> {
  await mkdir(demoRoot, { recursive: true })
  return mkdtemp(path.join(demoRoot, 'test-build-'))
}

async function filesUnder(root: string, prefix = ''): Promise<string[]> {
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? filesUnder(root, path.join(prefix, entry.name))
    : [path.join(prefix, entry.name)]))).flat().sort()
}

test('builds exactly the three standalone UTF-8 Demo assets and replaces stale output', async () => {
  const outdir = await fixture()
  try {
    await writeFile(path.join(outdir, 'stale.txt'), 'old build')
    await buildDemo({ outdir })
    expect(await filesUnder(outdir)).toEqual(['assets/demo.css', 'assets/demo.js', 'index.html'])
    const html = await readFile(path.join(outdir, 'index.html'), 'utf8')
    expect(html).toContain('./assets/demo.js')
    expect(html).toContain('./assets/demo.css')
    expect(html).toContain('<link rel="icon" href="data:,">')
    const js = await readFile(path.join(outdir, 'assets/demo.js'), 'utf8')
    expect(js).toContain('演示数据')
    expect(js).not.toContain('__ModuleLoader__')
  } finally {
    await rm(outdir, { recursive: true, force: true })
  }
})

test('rejects an additional guard before creating an otherwise valid output', async () => {
  const parent = await fixture()
  const outdir = path.join(parent, 'rejected')
  try {
    await expect(buildDemo({ outdir, guard() { throw new Error('test guard rejected') } })).rejects.toThrow('test guard rejected')
    await expect(access(outdir)).rejects.toThrow()
  } finally {
    await rm(parent, { recursive: true, force: true })
  }
})

test('cannot bypass the physical Demo guard with a no-op injected hook', async () => {
  const parent = await fixture()
  const outside = await mkdtemp(path.join(tempRoot, 'demo-build-escape-'))
  const sentinel = path.join(outside, 'preserve.txt')
  const packageTarget = path.join(repositoryRoot, 'packages/workbench/lib/demo')
  try {
    await writeFile(sentinel, 'preserved')
    await symlink(outside, path.join(parent, 'escape'))
    for (const outdir of [tempRoot, demoRoot, packageTarget, path.join(parent, 'escape')]) {
      await expect(buildDemo({ outdir, guard() {} })).rejects.toThrow()
      expect(await readFile(sentinel, 'utf8')).toBe('preserved')
      expect(await readdir(parent)).toEqual(['escape'])
    }
    await expect(access(packageTarget)).rejects.toThrow()
  } finally {
    await rm(parent, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('rechecks the mandatory guard after an injected hook replaces the output with an escape symlink', async () => {
  const parent = await fixture()
  const outdir = path.join(parent, 'swapped')
  const outside = await mkdtemp(path.join(tempRoot, 'demo-hook-escape-'))
  const sentinel = path.join(outside, 'preserve.txt')
  // A synchronous hook models a path change between build preparation and mutation.
  const fs = await import('node:fs')
  try {
    await writeFile(sentinel, 'preserved')
    await expect(buildDemo({ outdir, guard(target: string) {
      if (target === outdir && !fs.existsSync(outdir)) fs.symlinkSync(outside, outdir)
    } })).rejects.toThrow()
    expect(await readFile(sentinel, 'utf8')).toBe('preserved')
    expect(await readdir(outside)).toEqual(['preserve.txt'])
  } finally {
    await rm(parent, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})

test('rejects a dangling symlink inserted by the hook at the final JavaScript write', async () => {
  const parent = await fixture()
  const outdir = path.join(parent, 'demo')
  const outside = await mkdtemp(path.join(tempRoot, 'demo-dangling-escape-'))
  const outsideFile = path.join(outside, 'must-not-exist.js')
  const jsTarget = path.join(outdir, 'assets/demo.js')
  const fs = await import('node:fs')
  let reachedFinalWrite = false
  try {
    await expect(access(outsideFile)).rejects.toThrow()
    await expect(buildDemo({ outdir, guard(target: string) {
      if (target === jsTarget) {
        reachedFinalWrite = true
        fs.symlinkSync(outsideFile, jsTarget)
      }
    } })).rejects.toThrow()
    expect(reachedFinalWrite).toBe(true)
    await expect(access(outsideFile)).rejects.toThrow()
    expect(await readdir(outside)).toEqual([])
  } finally {
    await rm(parent, { recursive: true, force: true })
    await rm(outside, { recursive: true, force: true })
  }
})
