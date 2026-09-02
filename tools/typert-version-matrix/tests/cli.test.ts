import { describe, expect, test } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseCliArguments } from '../src/cli-args.js'
import { verifyFrozenLockInputs } from '../src/cli.js'

describe('CLI arguments', () => {
  test('parses the reviewed commands', () => {
    expect(parseCliArguments(['validate', '--matrix', 'config/matrix.official.json']))
      .toEqual({ command: 'validate', matrix: 'config/matrix.official.json' })
    expect(parseCliArguments(['run', '--matrix', 'config/matrix.official.json', '--lock-mode', 'resolve', '--output', '.tmp/dsh-pm-workbench/version-matrix/runs/run-1']))
      .toMatchObject({ command: 'run', lockMode: 'resolve' })
    expect(parseCliArguments(['verify-report', '--input', 'matrix.json']))
      .toEqual({ command: 'verify-report', input: 'matrix.json' })
    expect(parseCliArguments(['verify-locks', '--platform-key', 'darwin-arm64-node24-npm11']))
      .toEqual({ command: 'verify-locks', platformKey: 'darwin-arm64-node24-npm11' })
  })

  test('requires a reviewed platform key for frozen mode and rejects unknown flags', () => {
    expect(() => parseCliArguments(['run', '--matrix', 'm.json', '--lock-mode', 'frozen', '--output', 'out']))
      .toThrow(/platform-key/)
    expect(() => parseCliArguments(['validate', '--matrix', 'm.json', '--exec', 'anything']))
      .toThrow(/unknown flag/)
    expect(() => parseCliArguments(['verify-locks', '--platform-key', '../outside']))
      .toThrow(/unsafe/)
  })

  test('preflights the complete selection plus experimental reviewed lock set for frozen runs', async () => {
    const toolRoot = fileURLToPath(new URL('..', import.meta.url))
    const repositoryRoot = path.resolve(toolRoot, '../..')

    const reviewed = await verifyFrozenLockInputs(
      repositoryRoot,
      toolRoot,
      'darwin-arm64-node24-npm11',
    )

    expect(reviewed.caseCount).toBe(8)
    expect(Object.keys(reviewed.cases).sort()).toEqual([
      'typert-0.1.0-rc.6-control',
      'typert-0.1.0-rc.7',
      'typert-0.1.0-rc.8',
      'typert-0.1.1-rc.1',
      'typert-0.1.1-rc.2',
      'typert-0.1.2-alpha.2',
      'typert-0.1.2-alpha.3',
      'typert-0.1.2-alpha.4',
    ])
  })
})
