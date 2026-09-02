import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { verifyFixture } from '../src/fixture.js'

const fixtureRoot = fileURLToPath(new URL('../fixtures/strict-remote-v1/', import.meta.url))

describe('strict-remote-v1 fixture', () => {
  test('verifies every frozen file and returns a stable aggregate SHA-256', async () => {
    const result = await verifyFixture(fixtureRoot)

    expect(result.fixture).toBe('strict-remote-v1')
    expect(result.files).toHaveLength(5)
    expect(result.aggregateSha256).toMatch(/^[a-f0-9]{64}$/)
  })

  test('fails before execution when a copied fixture file drifts', async () => {
    const copyRoot = await mkdtemp(path.join(os.tmpdir(), 'typert-fixture-'))
    await cp(fixtureRoot, copyRoot, { recursive: true })
    const source = path.join(copyRoot, 'packages/probe/src/index.ts')
    await writeFile(source, `${await readFile(source, 'utf8')}\n// drift\n`)

    await expect(verifyFixture(copyRoot)).rejects.toThrow(/hash mismatch/)
  })

  test('fails when an unmanifested file is present', async () => {
    const copyRoot = await mkdtemp(path.join(os.tmpdir(), 'typert-fixture-'))
    await cp(fixtureRoot, copyRoot, { recursive: true })
    await writeFile(path.join(copyRoot, 'unexpected.txt'), 'not frozen')

    await expect(verifyFixture(copyRoot)).rejects.toThrow(/file inventory/)
  })
})
