import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import ts from 'typescript'
import { describe, expect, test } from 'vitest'

const workspaceRoot = resolve(import.meta.dirname, '../..')
const hostContractPath =
  'tests/types/harness-host-rc6-surface.ts'
const clientContractPath =
  'tests/types/harness-client-rc6-surface.ts'
const hostAllowedImports = new Set([
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-connection',
  '@deepseek-ai/dsh-storage-domain',
])
const clientAllowedImports = new Set([
  '@deepseek-ai/dsh-client-ui-layout/client',
  '@deepseek-ai/dsh-client-ui-sidebar/client',
  '@deepseek-ai/dsh-client-connection/client',
  '@deepseek-ai/dsh-client-runtime/client',
  'react',
])

type JsonObject = Record<string, unknown>

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

async function readWorkspaceFile(path: string) {
  return readFile(resolve(workspaceRoot, path), 'utf8')
}

async function readJsonObject(path: string) {
  const value: unknown = JSON.parse(await readWorkspaceFile(path))
  expect(isJsonObject(value)).toBe(true)
  if (!isJsonObject(value)) throw new Error(`${path} must contain a JSON object`)
  return value
}

function expectNoContractBypass(
  source: string,
  allowedImports?: ReadonlySet<string>,
) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    source,
  )
  for (
    let token = scanner.scan();
    token !== ts.SyntaxKind.EndOfFileToken;
    token = scanner.scan()
  ) {
    if (
      token !== ts.SyntaxKind.SingleLineCommentTrivia &&
      token !== ts.SyntaxKind.MultiLineCommentTrivia
    ) {
      continue
    }
    const comment = scanner.getTokenText()
    if (/@ts-(?:ignore|nocheck|expect-error)\b/.test(comment)) {
      throw new Error('TypeScript suppression directives are forbidden')
    }
    if (/^\/\/\/\s*<reference\b/i.test(comment)) {
      throw new Error('triple-slash reference directives are forbidden')
    }
  }

  const sourceFile = ts.createSourceFile(
    'harness-rc6-surface.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const specifiers: string[] = []
  const inspect = (node: ts.Node): void => {
    if (
      ts.isModuleDeclaration(node) &&
      ts.isStringLiteral(node.name) &&
      node.name.text.startsWith('@deepseek-ai/')
    ) {
      throw new Error(`local Harness module declaration: ${node.name.text}`)
    }
    if (node.kind === ts.SyntaxKind.AnyKeyword) {
      throw new Error('any is forbidden in declaration contracts')
    }
    if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
      throw new Error('type assertions are forbidden in declaration contracts')
    }
    if (ts.isNonNullExpression(node)) {
      throw new Error('non-null assertions are forbidden in declaration contracts')
    }
    if (
      (ts.isVariableDeclaration(node) || ts.isPropertyDeclaration(node)) &&
      node.exclamationToken !== undefined
    ) {
      throw new Error(
        'definite-assignment assertions are forbidden in declaration contracts',
      )
    }
    if (ts.isImportDeclaration(node)) {
      if (!ts.isStringLiteral(node.moduleSpecifier)) {
        throw new Error('static imports must use a string-literal specifier')
      }
      specifiers.push(node.moduleSpecifier.text)
    }
    if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      throw new Error('export-from declarations are forbidden')
    }
    if (ts.isImportTypeNode(node)) {
      throw new Error('import type expressions are forbidden')
    }
    if (ts.isImportEqualsDeclaration(node)) {
      throw new Error('import-equals declarations are forbidden')
    }
    if (ts.isIdentifier(node) && node.text === 'require') {
      throw new Error('the CommonJS require binding is forbidden')
    }
    if (
      ts.isElementAccessExpression(node) &&
      node.argumentExpression !== undefined &&
      ts.isStringLiteralLike(node.argumentExpression) &&
      node.argumentExpression.text === 'require'
    ) {
      throw new Error('element access to the CommonJS require binding is forbidden')
    }
    if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
        throw new Error('dynamic imports are forbidden')
      }
      const commonJsLoader =
        (ts.isIdentifier(node.expression) && node.expression.text === 'require') ||
        (ts.isPropertyAccessExpression(node.expression) &&
          ((ts.isIdentifier(node.expression.expression) &&
            node.expression.expression.text === 'require') ||
            node.expression.name.text === 'require'))
      if (commonJsLoader) throw new Error('CommonJS module loading is forbidden')
    }
    ts.forEachChild(node, inspect)
  }
  inspect(sourceFile)

  for (const specifier of specifiers) {
    if (/(?:^|\/)(?:src|lib|dist|internal)(?:\/|$)/.test(specifier)) {
      throw new Error(`private package subpath is forbidden: ${specifier}`)
    }
    if (/^\.\.?(?:\/|$)/.test(specifier)) {
      throw new Error(`relative imports are forbidden: ${specifier}`)
    }
    if (/^(?:\/|file:|[A-Za-z]:[\\/])/.test(specifier)) {
      throw new Error(`absolute imports are forbidden: ${specifier}`)
    }
    if (allowedImports !== undefined && !allowedImports.has(specifier)) {
      throw new Error(`unexpected declaration-contract import: ${specifier}`)
    }
  }
  return specifiers
}

function expectStrictCompilerOptions(
  compilerOptions: JsonObject,
  expectedLib: readonly string[],
  expectedTypes: readonly string[],
) {
  expect(Object.keys(compilerOptions).sort()).toEqual(
    [
      'lib',
      'module',
      'moduleResolution',
      'noEmit',
      'noImplicitAny',
      'skipLibCheck',
      'strict',
      'target',
      'types',
    ].sort(),
  )
  expect(compilerOptions.target).toBe('ES2022')
  expect(compilerOptions.module).toBe('NodeNext')
  expect(compilerOptions.moduleResolution).toBe('NodeNext')
  expect(compilerOptions.strict).toBe(true)
  expect(compilerOptions.noImplicitAny).toBe(true)
  expect(compilerOptions.skipLibCheck).toBe(false)
  expect(compilerOptions.noEmit).toBe(true)
  expect(compilerOptions.lib).toEqual(expectedLib)
  expect(compilerOptions.types).toEqual(expectedTypes)
  expect(compilerOptions).not.toHaveProperty('paths')
  expect(compilerOptions).not.toHaveProperty('typeRoots')
}

async function expectStrictSurfaceConfig(
  configPath: string,
  contractPath: string,
  expectedLib: readonly string[],
  expectedTypes: readonly string[],
) {
  const config = await readJsonObject(configPath)
  expect(Object.keys(config).sort()).toEqual(['compilerOptions', 'files'])
  expect(config.files).toEqual([contractPath])

  const compilerOptions = config.compilerOptions
  expect(isJsonObject(compilerOptions)).toBe(true)
  if (!isJsonObject(compilerOptions)) {
    throw new Error(`${configPath} must define compilerOptions`)
  }
  expectStrictCompilerOptions(compilerOptions, expectedLib, expectedTypes)
}

describe('rc.6 declaration contracts cannot bypass public surfaces', () => {
  test.each([
    ['single cast', 'declare const source: unknown\nconst value = source as string'],
    ['angle-bracket assertion', 'declare const source: unknown\nconst value = <string>source'],
    ['non-null assertion', 'declare const source: string | undefined\nconst value = source!'],
    ['expect-error suppression', '// @ts-expect-error\nconst value: string = 1'],
    ['as const', 'const value = {} as const'],
    ['definite-assignment assertion', 'class Example { connection!: string }'],
    ['local module with trivia', "declare /* local */ module '@deepseek-ai/fake' {}"],
    ['private import ending in src', "import type { X } from '@deepseek-ai/fake/src'"],
    ['private lib import', "import type { X } from '@deepseek-ai/fake/lib/private'"],
    ['export-from', "export type { X } from '@deepseek-ai/fake/src/private'"],
    ['import type expression', "type X = import('@deepseek-ai/fake/src/private').X"],
    ['dynamic import', "void import('@deepseek-ai/fake/src/private')"],
    ['require', "require('@deepseek-ai/fake/src/private')"],
    [
      'parenthesized require',
      "declare const require: (specifier: string) => unknown\n;(require)('@deepseek-ai/fake/src/private')",
    ],
    [
      'aliased require',
      "declare const require: (specifier: string) => unknown\nconst load = require\nload('@deepseek-ai/fake/src/private')",
    ],
    [
      'element-access require',
      "declare const module: Record<'require', (specifier: string) => unknown>\nconst load = module['require']\nload('@deepseek-ai/fake/src/private')",
    ],
    ['import equals', "import X = require('@deepseek-ai/fake/src/private')"],
    ['reference path', '/// <reference path="./fake.d.ts" />'],
    ['reference types', '/// <reference types="@deepseek-ai/fake" />'],
    ['reference lib', '/// <reference lib="dom" />'],
    ['no default lib', '/// <reference no-default-lib="true" />'],
  ])('guard rejects %s', (_label, source) => {
    expect(() => expectNoContractBypass(source)).toThrow()
  })

  test.each([
    ['any in a string', "const text = 'any'"],
    ['suppression text in a string', "const text = '@ts-ignore'"],
    ['CommonJS loader name in a string', "const text = 'require'"],
  ])('guard does not confuse %s with syntax', (_label, source) => {
    expect(() => expectNoContractBypass(source)).not.toThrow()
  })

  test('Client import allowlist catches a Host root import hidden in a type query', () => {
    const source =
      "type Hidden = import('@deepseek-ai/dsh-client-connection').HostConnectionHandle"
    expect(() => expectNoContractBypass(source, clientAllowedImports)).toThrow()
  })

  test('strict compiler guard rejects noCheck even when the original fields stay strict', () => {
    expect(() =>
      expectStrictCompilerOptions({
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noImplicitAny: true,
        skipLibCheck: false,
        noEmit: true,
        lib: ['ES2022'],
        types: [],
        noCheck: true,
      }, ['ES2022'], []),
    ).toThrow()
  })

  test('Host and Client contracts contain no local declaration substitute', async () => {
    const [hostSource, clientSource] = await Promise.all([
      readWorkspaceFile(hostContractPath),
      readWorkspaceFile(clientContractPath),
    ])

    expectNoContractBypass(hostSource, hostAllowedImports)
    expectNoContractBypass(clientSource, clientAllowedImports)
  })

  test('surface compilers are strict and each names only its own contract', async () => {
    await Promise.all([
      expectStrictSurfaceConfig(
        'tsconfig.stage2.surface.host.json',
        hostContractPath,
        ['ES2022', 'DOM'],
        ['node'],
      ),
      expectStrictSurfaceConfig(
        'tsconfig.stage2.surface.client.json',
        clientContractPath,
        ['ES2022', 'DOM', 'DOM.Iterable'],
        [],
      ),
    ])
  })

  test('Client carries the rc.6 public Connection handle intersection and official sidebar slot augmentation', async () => {
    const source = await readWorkspaceFile(clientContractPath)
    const specifiers = expectNoContractBypass(source, clientAllowedImports)
    const layoutImport = "import '@deepseek-ai/dsh-client-ui-layout/client'"
    const sidebarImport = "import '@deepseek-ai/dsh-client-ui-sidebar/client'"

    expect(source).toContain(
      "import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'",
    )
    expect(source).toContain(
      "import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'",
    )
    expect(specifiers).not.toContain('@deepseek-ai/dsh-client-connection')
    expect(source).toContain(
      'declare const ctx: ClientContext & { readonly connection: ConnectionHandle }',
    )
    expect(source).toMatch(/\bctx\.connection\.rpc\.call\(\s*['"]\/dsh-pm-workbench-v1['"]/)

    expect(source).toContain(layoutImport)
    expect(source).toContain(sidebarImport)
    expect(source.indexOf(sidebarImport)).toBeLessThan(
      source.indexOf("ctx.slots.inject('sidebar.footer.action'"),
    )
    expect(source).toContain("ctx.slots.inject('sidebar.footer.action'")
    expect(source).toContain("name: 'sidebar.footer.action'")
    expect(source).not.toContain("ctx.slots.inject('shell.overlay'")
  })

  test('Host alone loads the public Connection and storage augmentations', async () => {
    const source = await readWorkspaceFile(hostContractPath)
    const specifiers = expectNoContractBypass(source, hostAllowedImports)

    expect(specifiers).toContain('@deepseek-ai/dsh-client-connection')
    expect(specifiers).toContain('@deepseek-ai/dsh-storage-domain')
    expect(specifiers).not.toContain('@deepseek-ai/dsh-client-connection/client')
    expect(source).toMatch(/\bctx\.connection\.rpc\.handle\(\s*['"]\/dsh-pm-workbench-v1['"]/)
    expect(source).toContain("{ authority: 'loopback' }")
    expect(source).toContain('const domain = await ctx.storageDomain.open(probeDomainSpec)')
    expect(source).toContain('void dispose')
    expect(source).toContain('void domain')
  })
})
