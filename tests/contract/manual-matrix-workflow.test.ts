import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'

describe('manual matrix workflow budget', () => {
  test('allows the five sequential selection cases to exhaust bounded stage budgets', async () => {
    const workflow = await readFile(
      fileURLToPath(new URL('../../.github/workflows/manual-typert-matrix.yml', import.meta.url)),
      'utf8',
    )
    const match = workflow.match(/^\s*timeout-minutes:\s*(\d+)\s*$/mu)

    expect(match?.[1]).toBe('360')
  })

  test('verifies the canonical report and final marker before accepting a captured exit', async () => {
    const workflow = await readFile(
      fileURLToPath(new URL('../../.github/workflows/manual-typert-matrix.yml', import.meta.url)),
      'utf8',
    )

    expect(workflow).toContain('verify-report --input "$MATRIX_OUTPUT/matrix.json"')
    expect(workflow).toContain('run.final.json')
    expect(workflow).toContain('MATRIX_EXIT_CODE: ${{ steps.matrix.outputs.exit_code }}')
    expect(workflow).toContain('steps.verify_evidence.outcome == \'success\'')
    expect(workflow).toContain('renderMarkdown(verified)')
    expect(workflow).toContain('renderJUnit(verified)')
  })

  test('uploads only canonical reports, run markers, and portable proposed locks', async () => {
    const workflow = await readFile(
      fileURLToPath(new URL('../../.github/workflows/manual-typert-matrix.yml', import.meta.url)),
      'utf8',
    )
    const upload = workflow.slice(workflow.indexOf('- name: Upload allowlisted evidence'))

    expect(upload).toContain("if: ${{ always() && steps.verify_evidence.outcome == 'success' }}")
    expect(upload).not.toMatch(/cases\/\*\/logs|cases\/\*\/evidence\.json|workspace\/packages\/probe\/lib/)
    expect(upload).toContain('/matrix.json')
    expect(upload).toContain('/matrix.md')
    expect(upload).toContain('/junit.xml')
    expect(upload).toContain('/cases/*/proposed-lock/**')
  })
})
