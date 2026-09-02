import { expect, test } from 'vitest'
import { buildChildEnvironment, renderNpmrc } from '../src/environment.js'

test('child environment keeps a narrow runtime allowlist and case-local npm paths', () => {
  const env = buildChildEnvironment({
    PATH: '/usr/bin',
    HOME: '/Users/example',
    LANG: 'en_US.UTF-8',
    CI: 'true',
    NPM_TOKEN: 'secret',
    NODE_AUTH_TOKEN: 'secret',
    GH_TOKEN: 'secret',
    OPENAI_API_KEY: 'secret',
    DSH_HOME: '/private/profile',
    npm_config_userconfig: '/Users/example/.npmrc',
    NODE_OPTIONS: '--require bad.js',
  }, {
    npmCache: '/case/npm-cache',
    npmrc: '/case/npmrc',
  })

  expect(env).toEqual({
    PATH: '/usr/bin',
    HOME: '/Users/example',
    LANG: 'en_US.UTF-8',
    CI: 'true',
    npm_config_cache: '/case/npm-cache',
    npm_config_userconfig: '/case/npmrc',
    npm_config_registry: 'https://registry.npmjs.org/',
    npm_config_strict_ssl: 'true',
    npm_config_audit: 'false',
    npm_config_fund: 'false',
    npm_config_update_notifier: 'false',
  })
})

test('generated npmrc is public-registry-only and contains no auth setting', () => {
  const npmrc = renderNpmrc()

  expect(npmrc).toContain('registry=https://registry.npmjs.org/')
  expect(npmrc).toContain('strict-ssl=true')
  expect(npmrc).not.toMatch(/auth|token|password/i)
})
