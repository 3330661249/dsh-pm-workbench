import type { MatrixReport } from './aggregate.js'

function xml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

export function renderJUnit(report: MatrixReport): string {
  const failed = report.cases.filter(({ status }) => status !== 'PASS').length
  const cases = report.cases.map((entry) => {
    const name = `${entry.case.id} (${entry.case.role})`
    if (entry.status === 'PASS') return `  <testcase name="${xml(name)}"/>`
    const detail = entry.failure?.code ?? entry.status
    return `  <testcase name="${xml(name)}"><failure message="${xml(detail)}">${xml(entry.status)}</failure></testcase>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<testsuite name="typert-version-matrix" tests="${report.cases.length}" failures="${failed}">`,
    ...cases,
    '</testsuite>',
    '',
  ].join('\n')
}
