import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { expect, test } from 'vitest'
import { allocateCasePaths } from '../src/boundaries.js'
import { buildCaseCommandPlan } from '../src/command-plan.js'
import { parseMatrixConfig } from '../src/config.js'

test('command plan is fixed, argv-based, and contains no Harness/runtime operation', async () => {
  const config = parseMatrixConfig(JSON.parse(await readFile(
    fileURLToPath(new URL('../config/matrix.official.json', import.meta.url)),
    'utf8',
  )))
  const matrixCase = config.cases[0]!
  const paths = allocateCasePaths('/run-root', matrixCase.id)
  const plan = buildCaseCommandPlan(config, matrixCase, paths, 'resolve')

  expect(plan.filter(({ stage }) => stage === 'registry')).toHaveLength(5)
  expect(plan.map(({ stage }) => stage)).toEqual([
    'registry', 'registry', 'registry', 'registry', 'registry',
    'resolve-lock', 'install', 'tree', 'compile', 'direct-generator', 'tsdown', 'pack-dry-run',
  ])
  expect(plan.map(({ timeoutMs }) => timeoutMs)).toEqual([
    180_000, 180_000, 180_000, 180_000, 180_000,
    900_000, 900_000, 180_000, 180_000, 180_000, 180_000, 180_000,
  ])
  expect(plan.at(-1)?.args).toContain('@knight/dsh-typert-matrix-probe')
  expect(plan.every(({ shell }) => shell === false)).toBe(true)
  const serialized = JSON.stringify(plan)
  expect(serialized).not.toMatch(/"program":"(?:dsh|sh|zsh|bash)"/)
  expect(serialized).not.toMatch(/3080|profile|browser|server|model|recording|transcript/i)
  expect(serialized).not.toMatch(/&&|\$\(|`/)
  expect(serialized).not.toMatch(/legacy-peer-deps|--force|--omit(?:=|\")/)
})

test('frozen lock planning keeps the same controlled extended lock budget', async () => {
  const config = parseMatrixConfig(JSON.parse(await readFile(
    fileURLToPath(new URL('../config/matrix.official.json', import.meta.url)),
    'utf8',
  )))
  const matrixCase = config.cases[0]!
  const plan = buildCaseCommandPlan(
    config,
    matrixCase,
    allocateCasePaths('/run-root', matrixCase.id),
    'frozen',
  )

  expect(plan.find(({ stage }) => stage === 'resolve-lock')).toMatchObject({
    args: expect.arrayContaining(['ci', '--dry-run']),
    timeoutMs: 900_000,
  })
})
