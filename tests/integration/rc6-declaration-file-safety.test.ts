import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { chmod, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { promisify } from 'node:util'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'

const execFileAsync = promisify(execFile)
const workspaceRoot = resolve(import.meta.dirname, '../..')
const acceptanceSourcePath = resolve(workspaceRoot, 'scripts/accept-rc6-declaration-input.mjs')
const acceptanceSource = await readFile(acceptanceSourcePath, 'utf8')
const sourceFile = ts.createSourceFile(
  acceptanceSourcePath,
  acceptanceSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
)
const verifierSourcePath = resolve(workspaceRoot, 'scripts/verify-rc6-declaration-closure.mjs')
const verifierSource = await readFile(verifierSourcePath, 'utf8')
const verifierSourceFile = ts.createSourceFile(
  verifierSourcePath,
  verifierSource,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.JS,
)

function namedFunctionIn(file: ts.SourceFile, name: string): ts.FunctionDeclaration {
  let match: ts.FunctionDeclaration | undefined
  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) match = node
    ts.forEachChild(node, visit)
  }
  visit(file)
  if (!match) throw new Error(`missing function ${name}`)
  return match
}

function namedFunction(name: string): ts.FunctionDeclaration {
  return namedFunctionIn(sourceFile, name)
}

function optionalNamedFunctionText(file: ts.SourceFile, name: string): string {
  let match: ts.FunctionDeclaration | undefined
  function visit(node: ts.Node): void {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) match = node
    ts.forEachChild(node, visit)
  }
  visit(file)
  return match?.getText(file) ?? ''
}

function descendants<T extends ts.Node>(
  root: ts.Node,
  predicate: (node: ts.Node) => node is T,
): T[] {
  const matches: T[] = []
  function visit(node: ts.Node): void {
    if (predicate(node)) matches.push(node)
    ts.forEachChild(node, visit)
  }
  visit(root)
  return matches
}

function expressionPath(expression: ts.Expression): string | undefined {
  if (ts.isIdentifier(expression)) return expression.text
  if (!ts.isPropertyAccessExpression(expression)) return undefined
  const parent = expressionPath(expression.expression)
  return parent ? `${parent}.${expression.name.text}` : undefined
}

function calls(root: ts.Node, path?: string): ts.CallExpression[] {
  return descendants(root, ts.isCallExpression).filter((call) =>
    path === undefined || expressionPath(call.expression) === path,
  )
}

function conditionText(statement: ts.IfStatement): string {
  return statement.expression.getText(sourceFile).replaceAll(/\s+/g, '')
}

describe('rc.6 declaration filesystem safety structure', () => {
  test('production acceptance source carries its independently recomputed normalized hash', () => {
    const declaration = /const EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256 = '([a-f0-9]{64})'/gu
    const matches = [...acceptanceSource.matchAll(declaration)]

    expect(matches).toHaveLength(1)
    const normalized = acceptanceSource.replace(
      declaration,
      `const EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256 = '${'0'.repeat(64)}'`,
    )
    const recomputed = createHash('sha256').update(normalized, 'utf8').digest('hex')
    expect(matches[0]![1]).toBe(recomputed)
  })

  test.each(['readJsonFile', 'readNoFollow', 'readBoundSourceFile'])(
    '%s opens a preflighted source with O_NONBLOCK',
    (functionName) => {
      const openCalls = calls(namedFunction(functionName), 'open')

      expect(openCalls).toHaveLength(1)
      expect(openCalls[0]!.arguments[1]?.getText(sourceFile)).toContain(
        'fsConstants.O_NONBLOCK',
      )
    },
  )

  test('closure verifier readJsonSnapshot preflights and opens with O_NONBLOCK', () => {
    const implementation = namedFunctionIn(verifierSourceFile, 'readJsonSnapshot')
    const implementationText = implementation.getText(verifierSourceFile)
    const lstatCalls = calls(implementation, 'lstat')
    const openCalls = calls(implementation, 'open')

    expect(lstatCalls.length).toBeGreaterThanOrEqual(3)
    expect(openCalls).toHaveLength(1)
    expect(lstatCalls[0]!.getStart(verifierSourceFile)).toBeLessThan(
      openCalls[0]!.getStart(verifierSourceFile),
    )
    expect(openCalls[0]!.arguments[1]?.getText(verifierSourceFile)).toContain(
      'fsConstants.O_NONBLOCK',
    )
    expect(implementationText).toContain('const preflight = await lstat(path)')
    expect(implementationText).toContain('!preflight.isFile()')
    expect(implementationText).toContain('preflight.isSymbolicLink()')
  })

  test('closure verifier binds accepted package inputs through JSON snapshots', () => {
    const implementation = namedFunctionIn(
      verifierSourceFile,
      'verifyLocalAcceptedDeclarationClosure',
    )
    const implementationText = implementation.getText(verifierSourceFile)

    expect(calls(implementation, 'readJsonSnapshot')).toHaveLength(2)
    expect(implementationText).not.toContain('sha256File(acceptedPackagePath)')
    expect(implementationText).not.toContain('sha256File(acceptedLockPath)')
  })

  test('closure verifier reads cache index and content through bound binary snapshots', () => {
    const implementation = namedFunctionIn(verifierSourceFile, 'verifySelectedCache')
    const implementationText = implementation.getText(verifierSourceFile)

    expect(calls(implementation, 'readBinarySnapshot')).toHaveLength(2)
    expect(calls(implementation, 'assertSelectedCacheAncestorChain')).toHaveLength(4)
    expect(calls(implementation, 'readFile')).toHaveLength(0)
    expect(implementationText).toContain('expectedBytes: entry.byteLength')
  })

  test('closure verifier binary snapshots reject writable files before reading exact bytes', () => {
    const implementation = namedFunctionIn(verifierSourceFile, 'readBinarySnapshot')
    const implementationText = implementation.getText(verifierSourceFile)
    const readCall = calls(implementation, 'handle.readFile')

    expect(implementationText).toContain('(preflight.mode & 0o222) !== 0')
    expect(implementationText).toContain('preflight.size !== expectedBytes')
    expect(readCall).toHaveLength(1)
    expect(implementationText.indexOf('preflight.size !== expectedBytes')).toBeLessThan(
      readCall[0]!.getStart(verifierSourceFile) - implementation.getStart(verifierSourceFile),
    )
  })

  test('acceptance source pins the exact closure verifier bytes', () => {
    const declaration = /const EXPECTED_VERIFIER_SOURCE_SHA256 = '([a-f0-9]{64})'/gu
    const matches = [...acceptanceSource.matchAll(declaration)]
    const verifierSha256 = createHash('sha256').update(verifierSource, 'utf8').digest('hex')

    expect(matches).toHaveLength(1)
    expect(matches[0]![1]).toBe(verifierSha256)
  })

  test('readRuntimeIdentity pins runtime entries before npm execution and rechecks them after', () => {
    const implementation = namedFunction('readRuntimeIdentity')
    const pinCalls = calls(implementation, 'assertPinnedRuntimeEntries')
    const executionCalls = calls(implementation, 'execFileAsync')

    expect(pinCalls).toHaveLength(2)
    expect(executionCalls).toHaveLength(1)
    expect(pinCalls[0]!.getEnd()).toBeLessThan(executionCalls[0]!.getStart(sourceFile))
    expect(executionCalls[0]!.getEnd()).toBeLessThan(pinCalls[1]!.getStart(sourceFile))
  })

  test('makeTreeReadOnlyStrict never chmods a file path while sealing', () => {
    const implementation = namedFunction('makeTreeReadOnlyStrict')
    const directoryBranch = descendants(implementation, ts.isIfStatement).find(
      (statement) => conditionText(statement) === 'entry.isDirectory()',
    )

    expect(directoryBranch).toBeDefined()
    expect(calls(directoryBranch!.thenStatement, 'boundary.handle.chmod')).toHaveLength(1)

    const fileBranch = directoryBranch!.elseStatement
    expect(fileBranch && ts.isIfStatement(fileBranch)).toBe(true)
    if (!fileBranch || !ts.isIfStatement(fileBranch)) return
    expect(conditionText(fileBranch)).toBe('entry.isFile()')
    expect(calls(fileBranch.thenStatement, 'readBoundSourceFile')).toHaveLength(1)
    expect(
      calls(fileBranch.thenStatement).filter((call) =>
        expressionPath(call.expression)?.endsWith('chmod'),
      ),
    ).toHaveLength(0)
  })

  test('makeTreeWritableForCleanup chmods directories only', () => {
    const implementation = namedFunction('makeTreeWritableForCleanup')
    const directoryBranch = descendants(implementation, ts.isIfStatement).find(
      (statement) => conditionText(statement) === 'entry.isDirectory()',
    )

    expect(directoryBranch).toBeDefined()
    const allChmodCalls = calls(implementation, 'chmod')
    const directoryChmodCalls = calls(directoryBranch!.thenStatement, 'chmod')
    expect(directoryChmodCalls).toHaveLength(1)
    expect(directoryChmodCalls[0]!.arguments[0]?.getText(sourceFile)).toBe('path')
    expect(allChmodCalls.map((call) => call.pos)).toEqual(
      directoryChmodCalls.map((call) => call.pos),
    )
  })

  test('writeBundleFile rejects a special or multiply linked inode before chmod', () => {
    const implementation = namedFunction('writeBundleFile')
    const beforeSealDeclarations = descendants(implementation, ts.isVariableDeclaration).filter(
      (declaration) => declaration.name.getText(sourceFile) === 'beforeSeal'
        && declaration.initializer?.getText(sourceFile) === 'await handle.stat()',
    )
    const hardlinkGuard = descendants(implementation, ts.isIfStatement).find((statement) => {
      const condition = conditionText(statement)
      return condition.includes('!beforeSeal.isFile()')
        && condition.includes('beforeSeal.nlink!==1')
    })
    const chmodCalls = calls(implementation, 'handle.chmod')

    expect(beforeSealDeclarations).toHaveLength(1)
    expect(hardlinkGuard).toBeDefined()
    expect(calls(hardlinkGuard!.thenStatement, 'fail')).toHaveLength(1)
    expect(chmodCalls).toHaveLength(1)
    expect(beforeSealDeclarations[0]!.getEnd()).toBeLessThan(hardlinkGuard!.getStart(sourceFile))
    expect(hardlinkGuard!.getEnd()).toBeLessThan(chmodCalls[0]!.getStart(sourceFile))
  })

  test('proposal publication waits for both parallel payload writes before cleanup can begin', () => {
    const implementation = namedFunction('publishV2ProposalBundle')
    const settledCalls = calls(implementation, 'settleOwnedMutations')

    expect(settledCalls).toHaveLength(1)
    const payloadWrites = settledCalls[0]!.arguments[0]?.getText(sourceFile) ?? ''
    expect(payloadWrites).toContain('V2_PROPOSAL_INPUT_NAME')
    expect(payloadWrites).toContain('V2_PROPOSAL_CLOSURE_NAME')
    expect(calls(namedFunction('settleOwnedMutations'), 'Promise.allSettled')).toHaveLength(1)
  })

  test('all owned replay parallel mutations use the all-settled barrier', () => {
    expect(calls(namedFunction('writeReplayInputs'), 'settleOwnedMutations')).toHaveLength(1)
    const stage = namedFunction('stageRc6DeclarationInputV2')
    expect(calls(stage, 'settleOwnedMutations')).toHaveLength(2)
  })

  test('proposal cleanup includes the proven link-did-not-publish state', () => {
    const implementation = namedFunction('publishV2ProposalBundle').getText(sourceFile)

    expect(implementation).toContain(
      "!linkAttempted || publicationState === 'LINK_DID_NOT_PUBLISH'",
    )
  })
})

test.skipIf(process.platform === 'win32').each([
  {
    functionName: 'readJsonFile',
    invocation: 'readJsonFile(process.argv[1])',
    expectedError: 'INPUT_READ_FAILED',
  },
  {
    functionName: 'readNoFollow',
    invocation: "readNoFollow(process.argv[1], 'READ_FAILED')",
    expectedError: 'READ_FAILED',
  },
  {
    functionName: 'readBoundSourceFile',
    invocation: "readBoundSourceFile(process.argv[1], 'READ_FAILED')",
    expectedError: 'READ_FAILED',
  },
])(
  '$functionName does not block if a regular preflight target becomes a FIFO before open',
  async ({ functionName, invocation, expectedError }) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'rc6-fifo-read-'))
    const fifoPath = join(temporaryRoot, 'input.json')
    const implementation = namedFunction(functionName).getText(sourceFile)

    try {
      await execFileAsync('mkfifo', [fifoPath])
      const childProgram = `
        import { constants as fsConstants } from 'node:fs'
        import { lstat as realLstat, open } from 'node:fs/promises'

        const CACHE_INDEX_MAX_BYTES = 8 * 1024 * 1024
        let lstatCalls = 0
        const lstat = async (path) => {
          lstatCalls += 1
          if (lstatCalls === 1) {
            return { isFile: () => true, isSymbolicLink: () => false, size: 0 }
          }
          return realLstat(path)
        }
        const fail = (code) => {
          const error = new Error(code)
          error.ownedInputError = true
          throw error
        }

        ${implementation}

        try {
          await ${invocation}
          process.stdout.write('UNEXPECTED_SUCCESS')
          process.exitCode = 2
        } catch (error) {
          process.stdout.write(error.message)
        }
      `

      const { stdout } = await execFileAsync(
        process.execPath,
        ['--input-type=module', '--eval', childProgram, fifoPath],
        { timeout: 2_000, killSignal: 'SIGKILL' },
      )

      expect(stdout).toBe(expectedError)
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  },
  5_000,
)

test.skipIf(process.platform === 'win32')(
  'closure verifier readJsonSnapshot does not block if a regular preflight target becomes a FIFO before open',
  async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'rc6-verifier-fifo-read-'))
    const fifoPath = join(temporaryRoot, 'input.json')
    const implementation = namedFunctionIn(verifierSourceFile, 'readJsonSnapshot')
      .getText(verifierSourceFile)

    try {
      await execFileAsync('mkfifo', [fifoPath])
      const childProgram = `
        import { createHash } from 'node:crypto'
        import { constants as fsConstants } from 'node:fs'
        import { lstat as realLstat, open, realpath } from 'node:fs/promises'

        let lstatCalls = 0
        const lstat = async (path) => {
          lstatCalls += 1
          if (lstatCalls === 1) {
            return { isFile: () => true, isSymbolicLink: () => false, size: 0 }
          }
          return realLstat(path)
        }
        const fail = (code) => {
          const error = new Error(code)
          error.code = code
          throw error
        }
        const sha256 = (value) => createHash('sha256').update(value).digest('hex')
        const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
        const isWithin = () => true

        ${implementation}

        try {
          await readJsonSnapshot(process.argv[1])
          process.stdout.write('UNEXPECTED_SUCCESS')
          process.exitCode = 2
        } catch (error) {
          process.stdout.write(error.message)
        }
      `

      const { stdout } = await execFileAsync(
        process.execPath,
        ['--input-type=module', '--eval', childProgram, fifoPath],
        { timeout: 2_000, killSignal: 'SIGKILL' },
      )

      expect(stdout).toBe('INVALID_JSON_OBJECT')
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  },
  5_000,
)

test.skipIf(process.platform === 'win32').each([
  ['package.json', 'package-lock.json'],
  ['package-lock.json', 'package.json'],
] as const)(
  'closure verifier rejects an accepted-root %s FIFO without blocking',
  async (fifoName, regularName) => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'rc6-verifier-accepted-fifo-'))
    const acceptedRoot = join(temporaryRoot, 'accepted')
    const cacheRoot = join(temporaryRoot, 'cache')
    const fifoPath = join(acceptedRoot, fifoName)
    const regularBytes = Buffer.from('{}\n', 'utf8')
    const readJsonSnapshot = namedFunctionIn(verifierSourceFile, 'readJsonSnapshot')
      .getText(verifierSourceFile)
    const sha256File = optionalNamedFunctionText(verifierSourceFile, 'sha256File')
    const verifyLocal = namedFunctionIn(
      verifierSourceFile,
      'verifyLocalAcceptedDeclarationClosure',
    ).getText(verifierSourceFile)

    try {
      await Promise.all([
        mkdir(acceptedRoot, { recursive: true }),
        mkdir(cacheRoot, { recursive: true }),
      ])
      await writeFile(join(acceptedRoot, regularName), regularBytes)
      await execFileAsync('mkfifo', [fifoPath])
      const regularSha256 = createHash('sha256').update(regularBytes).digest('hex')
      const childProgram = `
        import { createHash } from 'node:crypto'
        import { constants as fsConstants } from 'node:fs'
        import { lstat, open, readFile, realpath } from 'node:fs/promises'
        import { relative, resolve, sep } from 'node:path'

        const DEFAULT_WORKSPACE_ROOT = process.argv[1]
        const sha256 = (value) => createHash('sha256').update(value).digest('hex')
        const isObject = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)
        const isWithin = (root, candidate) => {
          const remainder = relative(root, candidate)
          return remainder === '' || (!remainder.startsWith('..' + sep) && remainder !== '..')
        }
        const fail = (code) => { const error = new Error(code); error.code = code; throw error }
        const getLocalReplayEligibility = async () => ({
          eligible: true,
          acceptedRoot: process.argv[2],
          cacheRoot: process.argv[3],
        })
        const inspectCommittedDeclarationInput = async () => ({
          inputManifest: {
            packageJsonSha256: process.argv[4],
            packageLockSha256: process.argv[5],
          },
          packageJson: {},
          packageLock: {},
        })
        const assertReadOnlyDirectory = async () => {}
        const verifySelectedCache = async () => {}
        const scanInstalledPackages = async () => []
        const assertInstalledPlacement = () => {}
        const buildDeepseekClosure = async () => ({
          selectedDeclarationSubgraph: { records: [] },
        })

        ${sha256File}
        ${readJsonSnapshot}
        ${verifyLocal}

        try {
          await verifyLocalAcceptedDeclarationClosure({ workspaceRoot: process.argv[1] })
          process.stdout.write('UNEXPECTED_SUCCESS')
          process.exitCode = 2
        } catch (error) {
          process.stdout.write(error.code ?? error.message)
        }
      `
      const packageHash = fifoName === 'package.json' ? '0'.repeat(64) : regularSha256
      const lockHash = fifoName === 'package-lock.json' ? '0'.repeat(64) : regularSha256
      const { stdout } = await execFileAsync(
        process.execPath,
        [
          '--input-type=module', '--eval', childProgram,
          temporaryRoot, acceptedRoot, cacheRoot, packageHash, lockHash,
        ],
        { timeout: 2_000, killSignal: 'SIGKILL' },
      )

      expect(stdout).toBe('ACCEPTED_ROOT_INPUT_HASH_MISMATCH')
    } finally {
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  },
  5_000,
)

test.skipIf(process.platform === 'win32')(
  'closure verifier rejects an accepted cache content FIFO without blocking',
  async () => {
    const temporaryRoot = await mkdtemp(join(tmpdir(), 'rc6-verifier-content-fifo-'))
    const cacheRoot = join(
      temporaryRoot,
      '.tmp/dsh-pm-workbench/declaration-input-cache/_cacache',
    )
    const key = 'https://registry.npmjs.org/fixture/-/fixture-1.0.0.tgz'
    const keyDigest = createHash('sha256').update(key).digest('hex')
    const contentBytes = Buffer.from('x', 'utf8')
    const integrity = `sha512-${createHash('sha512').update(contentBytes).digest('base64')}`
    const hex = Buffer.from(integrity.slice('sha512-'.length), 'base64').toString('hex')
    const indexPath = join(
      cacheRoot,
      'index-v5',
      keyDigest.slice(0, 2),
      keyDigest.slice(2, 4),
      keyDigest.slice(4),
    )
    const contentPath = join(
      cacheRoot,
      'content-v2/sha512',
      hex.slice(0, 2),
      hex.slice(2, 4),
      hex.slice(4),
    )
    const entry = { key, integrity, byteLength: contentBytes.length, lockPath: 'fixture' }
    const selectedDirectories = new Set<string>()
    for (const selectedPath of [indexPath, contentPath]) {
      let current = dirname(selectedPath)
      while (true) {
        selectedDirectories.add(current)
        if (current === cacheRoot) break
        current = dirname(current)
      }
    }
    const readBinarySnapshot = optionalNamedFunctionText(
      verifierSourceFile,
      'readBinarySnapshot',
    )
    const assertSelectedCacheAncestorChain = optionalNamedFunctionText(
      verifierSourceFile,
      'assertSelectedCacheAncestorChain',
    )
    const verifySelectedCache = namedFunctionIn(verifierSourceFile, 'verifySelectedCache')
      .getText(verifierSourceFile)
    const assertRegularFile = namedFunctionIn(verifierSourceFile, 'assertRegularFile')
      .getText(verifierSourceFile)

    try {
      await Promise.all([
        mkdir(join(indexPath, '..'), { recursive: true }),
        mkdir(join(contentPath, '..'), { recursive: true }),
      ])
      await writeFile(indexPath, `fixture\t${JSON.stringify({
        key,
        integrity,
        size: contentBytes.length,
      })}\n`)
      await execFileAsync('mkfifo', [contentPath])
      await chmod(indexPath, 0o444)
      for (const directory of [...selectedDirectories].sort((left, right) => right.length - left.length)) {
        await chmod(directory, 0o555)
      }
      const childProgram = `
        import { createHash } from 'node:crypto'
        import { constants as fsConstants } from 'node:fs'
        import { lstat, open, readFile, realpath } from 'node:fs/promises'
        import { dirname, relative, resolve, sep } from 'node:path'

        const ACCEPTED_CACHE_RELATIVE = '.tmp/dsh-pm-workbench/declaration-input-cache'
        const ACCEPTED_CACHE_INDEX_MAX_BYTES = 8 * 1024 * 1024
        const sha256 = (value) => createHash('sha256').update(value).digest('hex')
        const isWithin = (root, candidate) => {
          const remainder = relative(root, candidate)
          return remainder === '' || (!remainder.startsWith('..' + sep) && remainder !== '..')
        }
        const fail = (code) => { const error = new Error(code); error.code = code; throw error }

        ${assertRegularFile}
        ${readBinarySnapshot}
        ${assertSelectedCacheAncestorChain}
        ${verifySelectedCache}

        try {
          await verifySelectedCache({
            workspaceRoot: process.argv[1],
            inputManifest: { selectedCache: { entries: [JSON.parse(process.argv[2])] } },
          })
          process.stdout.write('UNEXPECTED_SUCCESS')
          process.exitCode = 2
        } catch (error) {
          process.stdout.write(error.code ?? error.message)
        }
      `
      const { stdout } = await execFileAsync(
        process.execPath,
        ['--input-type=module', '--eval', childProgram, temporaryRoot, JSON.stringify(entry)],
        { timeout: 2_000, killSignal: 'SIGKILL' },
      )

      expect(stdout).toBe('ACCEPTED_CACHE_CONTENT_MISMATCH')
    } finally {
      for (const directory of [...selectedDirectories].sort((left, right) => left.length - right.length)) {
        await chmod(directory, 0o755).catch(() => {})
      }
      await rm(temporaryRoot, { recursive: true, force: true })
    }
  },
  5_000,
)
