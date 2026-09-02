import { describe, expect, test } from 'vitest'
import { parseCliArguments } from '../src/cli-args.js'

describe('CLI arguments', () => {
  test('parses the three reviewed commands', () => {
    expect(parseCliArguments(['validate', '--matrix', 'config/matrix.official.json']))
      .toEqual({ command: 'validate', matrix: 'config/matrix.official.json' })
    expect(parseCliArguments(['run', '--matrix', 'config/matrix.official.json', '--lock-mode', 'resolve', '--output', '.tmp/dsh-pm-workbench/version-matrix/runs/run-1']))
      .toMatchObject({ command: 'run', lockMode: 'resolve' })
    expect(parseCliArguments(['verify-report', '--input', 'matrix.json']))
      .toEqual({ command: 'verify-report', input: 'matrix.json' })
  })

  test('requires a reviewed platform key for frozen mode and rejects unknown flags', () => {
    expect(() => parseCliArguments(['run', '--matrix', 'm.json', '--lock-mode', 'frozen', '--output', 'out']))
      .toThrow(/platform-key/)
    expect(() => parseCliArguments(['validate', '--matrix', 'm.json', '--exec', 'anything']))
      .toThrow(/unknown flag/)
  })
})
