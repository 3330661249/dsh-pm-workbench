export interface ChildEnvironmentPaths {
  readonly npmCache: string
  readonly npmrc: string
}

const PASSTHROUGH = ['PATH', 'HOME', 'LANG', 'LC_ALL', 'TMPDIR', 'CI'] as const

export function buildChildEnvironment(
  source: Readonly<Record<string, string | undefined>>,
  paths: ChildEnvironmentPaths,
): Record<string, string> {
  const result: Record<string, string> = {}
  for (const key of PASSTHROUGH) {
    const value = source[key]
    if (typeof value === 'string' && value.length > 0) result[key] = value
  }
  return {
    ...result,
    npm_config_cache: paths.npmCache,
    npm_config_userconfig: paths.npmrc,
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_strict_ssl: 'true',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  }
}

export function renderNpmrc(): string {
  return [
    'registry=https://registry.npmjs.org/',
    'strict-ssl=true',
    'audit=false',
    'fund=false',
    'update-notifier=false',
    '',
  ].join('\n')
}
