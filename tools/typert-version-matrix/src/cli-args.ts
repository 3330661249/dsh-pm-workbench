export type CliArguments =
  | { readonly command: 'validate'; readonly matrix: string }
  | {
    readonly command: 'run'
    readonly matrix: string
    readonly lockMode: 'resolve' | 'frozen'
    readonly output: string
    readonly platformKey?: string
  }
  | { readonly command: 'verify-report'; readonly input: string }

function flags(args: readonly string[]): Map<string, string> {
  if (args.length % 2 !== 0) throw new Error('every CLI flag requires one value')
  const result = new Map<string, string>()
  for (let index = 0; index < args.length; index += 2) {
    const flag = args[index]!
    const value = args[index + 1]!
    if (!flag.startsWith('--')) throw new Error(`unknown flag ${flag}`)
    if (result.has(flag)) throw new Error(`duplicate flag ${flag}`)
    result.set(flag, value)
  }
  return result
}

function requireFlag(values: Map<string, string>, name: string): string {
  const value = values.get(name)
  if (value === undefined || value.length === 0) throw new Error(`missing ${name}`)
  return value
}

function allowOnly(values: Map<string, string>, allowed: readonly string[]): void {
  const unknown = [...values.keys()].find((value) => !allowed.includes(value))
  if (unknown !== undefined) throw new Error(`unknown flag ${unknown}`)
}

export function parseCliArguments(argv: readonly string[]): CliArguments {
  const [command, ...rest] = argv
  const values = flags(rest)
  if (command === 'validate') {
    allowOnly(values, ['--matrix'])
    return { command, matrix: requireFlag(values, '--matrix') }
  }
  if (command === 'verify-report') {
    allowOnly(values, ['--input'])
    return { command, input: requireFlag(values, '--input') }
  }
  if (command === 'run') {
    allowOnly(values, ['--matrix', '--lock-mode', '--output', '--platform-key'])
    const lockMode = requireFlag(values, '--lock-mode')
    if (lockMode !== 'resolve' && lockMode !== 'frozen') {
      throw new Error('--lock-mode must be resolve or frozen')
    }
    const platformKey = values.get('--platform-key')
    if (lockMode === 'frozen' && platformKey === undefined) {
      throw new Error('frozen mode requires --platform-key')
    }
    if (platformKey !== undefined && !/^[a-z0-9][a-z0-9.-]{0,63}$/.test(platformKey)) {
      throw new Error('--platform-key is unsafe')
    }
    return {
      command,
      matrix: requireFlag(values, '--matrix'),
      lockMode,
      output: requireFlag(values, '--output'),
      ...(platformKey === undefined ? {} : { platformKey }),
    }
  }
  throw new Error(`unknown command ${command ?? ''}`)
}
