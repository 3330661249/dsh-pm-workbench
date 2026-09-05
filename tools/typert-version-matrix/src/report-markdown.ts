import type { MatrixReport } from './aggregate.js'

function cell(value: unknown): string {
  return String(value).replaceAll('|', '\\|').replaceAll('\n', ' ')
}

export function renderMarkdown(report: MatrixReport): string {
  const rows = report.cases.map((entry) => {
    const cohort = entry.case.release['@deepseek-ai/dsh']
    return `| ${cell(cohort)} | ${cell(entry.case.role)} | ${cell(entry.status)} |`
  })
  const failures = report.cases
    .filter((entry) => entry.failure !== undefined)
    .map((entry) => `- \`${entry.case.id}\`: \`${entry.failure!.code}\` at \`${entry.failure!.stage}\``)
  return [
    `# Typert version matrix: ${report.runId}`,
    '',
    `**Decision:** \`${report.decision}\``,
    '',
    `**Exit code:** \`${report.exitCode}\` — ${report.exitReason}`,
    '',
    `**Evidence boundary:** This result does not prove full DeepSeek Harness compatibility. Human review is required.`,
    '',
    '| Typert cohort | Role | Result |',
    '| --- | --- | --- |',
    ...rows,
    '',
    '## Failures',
    '',
    ...(failures.length === 0 ? ['- None recorded.'] : failures),
    '',
  ].join('\n')
}
