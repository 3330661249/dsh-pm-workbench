import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import ts from 'typescript'
import { expect, test } from 'vitest'

const packageRoot = path.resolve(import.meta.dirname, '../../packages/workbench')
const roots = ['src/demo', 'demo'].map((root) => path.join(packageRoot, root))
const forbiddenTokens = ['fetch(', 'XMLHttpRequest', 'WebSocket', 'localStorage', 'sessionStorage', 'indexedDB', 'document.cookie', 'caches.', 'navigator.serviceWorker']

async function sourceFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true })
  return (await Promise.all(entries.map((entry) => entry.isDirectory()
    ? sourceFiles(path.join(root, entry.name))
    : [path.join(root, entry.name)]))).flat()
}

test('keeps the Demo graph local with only React dependencies and no network or persistence APIs', async () => {
  const files = (await Promise.all(roots.map(sourceFiles))).flat()
  const fileSet = new Set(files)
  expect(files.length).toBeGreaterThan(0)
  for (const file of files) {
    const source = await readFile(file, 'utf8')
    for (const token of forbiddenTokens) expect(source, `${file}: ${token}`).not.toContain(token)
    if (!/\.tsx?$/.test(file)) continue
    const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
    const inspect = (node: ts.Node): void => {
      let specifier: ts.Expression | undefined
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) specifier = node.moduleSpecifier
      if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        expect(node.arguments.length, file).toBe(1)
        specifier = node.arguments[0]
        expect(specifier && ts.isStringLiteral(specifier), `${file}: static import required`).toBe(true)
      }
      if (specifier && ts.isStringLiteral(specifier)) {
        const imported = specifier.text
        if (imported.startsWith('.')) {
          const resolved = path.resolve(path.dirname(file), imported)
          expect([resolved, resolved.replace(/\.js$/, '.ts'), resolved.replace(/\.js$/, '.tsx')].some((candidate) => fileSet.has(candidate)), `${file}: ${imported} escapes Demo graph`).toBe(true)
          if (imported.includes('fixture-provider') && file !== path.join(packageRoot, 'src/demo/DemoApp.tsx')) {
            expect(ts.isImportDeclaration(node), file).toBe(true)
            const bindings = ts.isImportDeclaration(node) ? node.importClause?.namedBindings : undefined
            expect(bindings && ts.isNamedImports(bindings), file).toBe(true)
            if (bindings && ts.isNamedImports(bindings)) {
              expect(bindings.elements.map((item) => (item.propertyName ?? item.name).text), file).toEqual(['assertCardIntegrity'])
            }
          }
        } else {
          expect(['react', 'react-dom/client'], `${file}: external provider/Harness dependency ${imported}`).toContain(imported)
        }
      }
      ts.forEachChild(node, inspect)
    }
    inspect(ast)
  }
})
