import { createHash, randomBytes } from 'node:crypto'
import {
  chmod,
  copyFile,
  lstat,
  link,
  mkdir,
  mkdtemp,
  open,
  readFile,
  realpath,
  readdir,
  rename,
  rm,
  stat,
  unlink,
  writeFile,
} from 'node:fs/promises'
import { constants as fsConstants } from 'node:fs'
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { execFile } from 'node:child_process'
import { promisify, types } from 'node:util'

const execFileAsync = promisify(execFile)
const moduleDirectory = dirname(fileURLToPath(import.meta.url))
const DEFAULT_WORKSPACE_ROOT = resolve(moduleDirectory, '..')
const DEFAULT_CANDIDATE_ROOT = resolve(
  DEFAULT_WORKSPACE_ROOT,
  '.tmp/dsh-pm-workbench/declaration-input-candidate',
)
const EXPECTED = {
  label: 'local-2026-09-05-rc6-declaration-lock-v1',
  authorizationBasis: 'owner-continued-after-explicit-offline-rc6-preflight-update',
  registryPackageCount: 169,
  deepseekPackageCount: 59,
  dshPackageCount: 54,
  dshVersion: '0.1.0-rc.6',
  selectedContentBytes: 9_590_214,
  rootDependencies: {
    '@deepseek-ai/cordis': '4.0.1',
    '@deepseek-ai/dsh-client-connection': '0.1.0-rc.6',
    '@deepseek-ai/dsh-client-runtime': '0.1.0-rc.6',
    '@deepseek-ai/dsh-client-ui-layout': '0.1.0-rc.6',
    '@deepseek-ai/dsh-client-ui-sidebar': '0.1.0-rc.6',
    '@deepseek-ai/dsh-client-ui-slots': '0.1.0-rc.6',
    '@deepseek-ai/dsh-invariants': '0.1.0-rc.6',
    react: '18.3.1',
  },
  nestedCommander: {
    lockPath: 'node_modules/katex/node_modules/commander',
    name: 'commander',
    parent: 'katex',
    version: '8.3.0',
  },
  contractHashes: {
    'tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts':
      '8848b3635b4962dee538a3609af574c69b34a2ca001cb0b44edc327bff0c3f90',
    'tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts':
      '3280e7b2c45861d5258e398e9a60e9e96d2664fa7207086c6a3eec76508defe4',
    'tsconfig.surface.host.json':
      '85320fca37cdfcb0e4712d35e14249ed681489d78bfa29f1fdc532562c4ee093',
    'tsconfig.surface.client.json':
      '5063d26fe852412fdc5659d16d2e0cf312e88415126360c63221c50f9f7735ea',
  },
}

const EXPECTED_RUNTIME = {
  node: { version: 'v24.14.0', basename: 'node', sha256: '9e831e9b13aa47c5e5eaa3904d232aa527124e8abba7ca5d72b67b46cfb10ae8' },
  npm: { version: '11.9.0', cliBasename: 'npm-cli.js', cliSha256: '8e5f6f3429f8cdbe693cdc29904e9d5a7b127a494bd15c804bd54c7403bfcbe7' },
}

const EXPECTED_ACCEPTED_PACKAGE_JSON_CANONICAL_SHA256 = 'ec3d67e9bcc952d225166c4290a0f4850038058b0ea62f1a9642ba8d6c7f593f'
const EXPECTED_ACCEPTED_PACKAGE_LOCK_CANONICAL_SHA256 = 'd99f9a20b594ca3bd825d33a17c5f4f3953de3589c2df7fd5d87e77cbea2ecd1'
const EXPECTED_COMMITTED_V1_INPUT_RAW_SHA256 = 'eaa89753953535e0a231ac99d3053de75d8fb67c2d73f7b9bcae9a2997d7e489'
const EXPECTED_COMPILER_SOURCE_AGGREGATE_SHA256 = '44535345dd7a3448bac9206c60ad352f67c265708d410c4c5e20dad0de83d943'
const EXPECTED_VERIFIER_SOURCE_SHA256 = '7e28949d1899df9dda79e765f342c559254ab67e45a77dca1b2abe329c5d9f8e'
const EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256 = '3caf3ab49fe4b79c7ce703411e95f3d3af625a4a8ad96a10d77427dfd2972d56'
const CLIENT_COMPILER_OVERLAY_RELATIVE = 'tsconfig.surface.client.overlay.json'
const EXPECTED_CLIENT_COMPILER_OVERLAY_SHA256 = 'ccc1578a3ed59a72264d3d468af7968b2a0771b693875d9ea9ee8fda4b1a2d24'
const CLIENT_COMPILER_OVERLAY = {
  extends: './tsconfig.surface.client.json',
  compilerOptions: {
    paths: {
      react: ['./.compiler/node_modules/@types/react/index.d.ts'],
      'prop-types': ['./.compiler/node_modules/@types/prop-types/index.d.ts'],
      csstype: ['./.compiler/node_modules/csstype/index.d.ts'],
    },
  },
}
const REPLAY_EVIDENCE_KIND = 'REAL_NPM_CLI'
const NPM_CLI_RELATIVE_FROM_NODE = '../lib/node_modules/npm/bin/npm-cli.js'
const V2_PROPOSAL_POINTER_RELATIVE = '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json'
const V2_PROPOSAL_BUNDLE_PARENT_RELATIVE = '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal-bundles'
const V2_PROPOSAL_INPUT_NAME = 'input-manifest.v2.json'
const V2_PROPOSAL_CLOSURE_NAME = 'rc6-declaration-closure.v2.json'
const V2_PROPOSAL_POINTER_MAX_BYTES = 4096

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`)
  error.code = code
  Object.defineProperty(error, 'ownedInputError', { value: true })
  throw error
}

async function settleOwnedMutations(operations) {
  const results = await Promise.allSettled(operations)
  const failed = results.find((result) => result.status === 'rejected')
  if (failed) throw failed.reason
  return results.map((result) => result.value)
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sameStringMap(actual, expected) {
  if (!isObject(actual)) return false
  const actualKeys = Object.keys(actual).sort()
  const expectedKeys = Object.keys(expected).sort()
  return actualKeys.length === expectedKeys.length && actualKeys.every(
    (key, index) => key === expectedKeys[index] && actual[key] === expected[key],
  )
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex')
}

function normalizedAcceptanceSourceSha256(bytes) {
  const source = bytes.toString('utf8')
  const declaration = /const EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256 = '[a-f0-9]{64}'/gu
  const matches = [...source.matchAll(declaration)]
  if (matches.length !== 1) fail('VERIFIER_SOURCE_MISMATCH', 'acceptance source stamp')
  const normalized = source.replace(
    declaration,
    `const EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256 = '${'0'.repeat(64)}'`,
  )
  return sha256(Buffer.from(normalized, 'utf8'))
}

function isOwnerReadableReadOnlyMode(mode) {
  const permissions = mode & 0o777
  return (permissions & 0o400) !== 0 && (permissions & 0o333) === 0
}

function compareUtf8(left, right) {
  return Buffer.from(left, 'utf8').compare(Buffer.from(right, 'utf8'))
}

const legacyContentCollator = new Intl.Collator()

function assertCanonicalString(value, label) {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(index + 1)
      if (!(next >= 0xdc00 && next <= 0xdfff)) fail('INVALID_CANONICAL_JSON', `${label}: unpaired high surrogate`)
      index += 1
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      fail('INVALID_CANONICAL_JSON', `${label}: unpaired low surrogate`)
    }
  }
}

export function canonicalJsonBytes(value) {
  const active = new WeakSet()

  function encode(current, label) {
    if (current === null) return 'null'
    if (typeof current === 'boolean') return current ? 'true' : 'false'
    if (typeof current === 'string') {
      assertCanonicalString(current, label)
      return JSON.stringify(current)
    }
    if (typeof current === 'number') {
      if (!Number.isFinite(current) || Object.is(current, -0) || (Number.isInteger(current) && !Number.isSafeInteger(current))) {
        fail('INVALID_CANONICAL_JSON', `${label}: invalid number`)
      }
      return JSON.stringify(current)
    }
    if (typeof current !== 'object' || current === null) {
      fail('INVALID_CANONICAL_JSON', `${label}: non-JSON value`)
    }
    if (types.isProxy(current)) fail('INVALID_CANONICAL_JSON', `${label}: proxy`)
    if (active.has(current)) fail('INVALID_CANONICAL_JSON', `${label}: cycle`)
    active.add(current)
    try {
      if (Array.isArray(current)) {
        if (Object.getPrototypeOf(current) !== Array.prototype) {
          fail('INVALID_CANONICAL_JSON', `${label}: non-standard array prototype`)
        }
        const keys = Reflect.ownKeys(current)
        const expectedLengthDescriptor = Object.getOwnPropertyDescriptor(current, 'length')
        if (!expectedLengthDescriptor
          || expectedLengthDescriptor.value !== current.length
          || expectedLengthDescriptor.enumerable
          || expectedLengthDescriptor.configurable
          || !expectedLengthDescriptor.writable) {
          fail('INVALID_CANONICAL_JSON', `${label}: invalid array length`)
        }
        if (keys.length !== current.length + 1 || !keys.includes('length')) {
          fail('INVALID_CANONICAL_JSON', `${label}: sparse or extended array`)
        }
        const items = []
        for (let index = 0; index < current.length; index += 1) {
          const key = String(index)
          const descriptor = Object.getOwnPropertyDescriptor(current, key)
          if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')
            || descriptor.get !== undefined || descriptor.set !== undefined) {
            fail('INVALID_CANONICAL_JSON', `${label}: invalid array index`)
          }
          items.push(encode(descriptor.value, `${label}[${index}]`))
        }
        return `[${items.join(',')}]`
      }
      const prototype = Object.getPrototypeOf(current)
      if (prototype !== Object.prototype && prototype !== null) {
        fail('INVALID_CANONICAL_JSON', `${label}: non-plain object`)
      }
      const keys = Reflect.ownKeys(current)
      const values = []
      for (const key of keys) {
        if (typeof key !== 'string') fail('INVALID_CANONICAL_JSON', `${label}: symbol key`)
        const descriptor = Object.getOwnPropertyDescriptor(current, key)
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, 'value')
          || descriptor.get !== undefined || descriptor.set !== undefined) {
          fail('INVALID_CANONICAL_JSON', `${label}: non-data property`)
        }
        assertCanonicalString(key, `${label}: key`)
        values.push({ key, value: descriptor.value })
      }
      values.sort((left, right) => compareUtf8(left.key, right.key))
      return `{${values.map(({ key, value: propertyValue }) => `${JSON.stringify(key)}:${encode(propertyValue, `${label}.${key}`)}`).join(',')}}`
    } finally {
      active.delete(current)
    }
  }
  return encode(value, '$')
}

function assertExactKeys(value, keys, label) {
  if (!isObject(value)) fail('INVALID_SCHEMA_OBJECT', label)
  const actual = Object.keys(value).sort(compareUtf8)
  const expected = [...keys].sort(compareUtf8)
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    fail('SCHEMA_KEY_MISMATCH', label)
  }
}

function assertSafeManifestStrings(value, label = 'input-manifest') {
  if (typeof value === 'string') {
    if (/(?:^|[^A-Za-z0-9])(?:\/(?:Users|private|tmp|home)\/|[A-Za-z]:[\\/]|\\\\|file:|~[\\/]|\.\.(?:[\\/]|$))/i.test(value)) {
      fail('MANIFEST_PATH_LEAK', `${label}: ${value}`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertSafeManifestStrings(item, `${label}[${index}]`))
    return
  }
  if (isObject(value)) {
    for (const [key, item] of Object.entries(value)) assertSafeManifestStrings(item, `${label}.${key}`)
  }
}

const V2_SELECTED_INDEX_SHA256 = '73e76d127ab8188d8005e4becb750bbe9cfec30988e501185b13558f4c6cd3f6'
const V2_SELECTED_CONTENT_AGGREGATE_SHA256 = '3a8c2e3ba2bb7e07d3cc51212e9ae3dd4925e522d9c9c87acac16fee122757dc'

const PRODUCTION_BOUNDARY_LINES = `package-lock.json a11f8250581bd1aa5f85f654044221f691b5231a5db7f12e76f3162a4f202f7f
package.json 6dc8bbe6a042376d43cd6ed29d558e91b06d629d9b850250bf45c10c5aa6575d
packages/workbench/LICENSE 541ac1a31c63fab3ae8bf4afca4024e7e9508f72094e706dc95516f1cbe56330
packages/workbench/README.md 36b2f21961c07890470266a654ef6050f51342f8bdc6393300627f1620a7fb0b
packages/workbench/build.mjs 35c3e5e11ead1d14be12dae5e87e89091473c661ffd9d75d7edde71f15ec25d6
packages/workbench/cordis.patch.yml c21499b2a16364a8087065f57a608f15484b7572435b71d576379ba38f70fe80
packages/workbench/demo/demo.css ae7cba2a78491057e1650fcc62bacc407ac6402aca7281d855b303b51c9081f9
packages/workbench/demo/index.html 6ae248a5f51ca1363f4e01c8730cecb65ab4c4a52250976e27ac5d3d56e318d2
packages/workbench/demo/main.tsx 79b11976d95c747c0b77860939dbff6a51efbd8e43ce4f8c69bf1f496993c4c2
packages/workbench/docs/compatibility.md 4472d72b8166a183e4c23965a20dd63b8d0ced43ca07f99d43b56fdde23703c9
packages/workbench/docs/privacy.md 8483e09ecf1422363c7abb105ccd1ec37721a1119b01ec112faa726c11969c50
packages/workbench/docs/third-party.md bfc5de65cee0d97467275757567fa1fd3ed25eda45d8e7e35f68300f63ec4fb5
packages/workbench/package.json f21428122a218911f460bf507c2b8ca7f7e7ee6881aefd2cd370ca331daff717
packages/workbench/src/client/index.tsx 53a50ac48a030eba8b71a5b8d41c698bfd60e3637ee87e68aa7c4494ff73b0a2
packages/workbench/src/config.ts b28841540da669125f58b0740ba813bbb02b1445e6b3e7f4a21f8927c32255d5
packages/workbench/src/demo/DemoApp.tsx 17100c3e9c84f6de32c0529c74282a1462a06b461fe2021a5c9d824a8108c45e
packages/workbench/src/demo/components/DemoNotice.tsx 516457e97e712931398ca5ca50118adbde68d3f5977e9a615ab3f5772de4ae46
packages/workbench/src/demo/components/MaterialStep.tsx 02fd373fc2470a4660c2a7cab5010810aa26a331b8c0ddfe451b56f1caa7b7ed
packages/workbench/src/demo/components/PrdStep.tsx 334385325532c27948e78153640ccfd07e7490790d4b5408944f45dab781e33a
packages/workbench/src/demo/components/PriorityStep.tsx b77757e5abc4ec93d6bfb5abd92f740e14c9ac9d2a8a04fddfc74eda94dbe76f
packages/workbench/src/demo/components/RequirementEditor.tsx 6c9f580a533909b45ddb6c7842e558de627a8facce1d999eb4f504991c0ded53
packages/workbench/src/demo/components/RequirementsStep.tsx 79f48c0809a98280f48b2577d43f6810e53bc4c9e4549e15f0365490f8f396ce
packages/workbench/src/demo/components/StepNavigation.tsx 586404a4fdfe35efde7555e4c4cdc9c52e6d2e353af4bf71922da8eacd3fe33b
packages/workbench/src/demo/components/WorkbenchMark.tsx 70b9ea9defcd17d1e889d707d17de1023b05b2378fa818766c676a73bfe1cfd6
packages/workbench/src/demo/domain/fixture-provider.ts 2c6209d8a8d1c532ba1e7e2e7e2dd8a4429d9219321dac36a6da8f32224f85b5
packages/workbench/src/demo/domain/material.ts e74d3c63c8e7a127918acae7963440ff7a8f30ed67c95c384cc9a0ee7f6ce2a9
packages/workbench/src/demo/domain/prd.ts 07f78db390981a7c79c5840449027a19be73c3cf7ec4cbae05c50bff75e47074
packages/workbench/src/demo/domain/requirements.ts 16d8901c5f786bc3adc47927804bbbc7619b4d68b4aebc2e3ca8ccff49cc8fad
packages/workbench/src/demo/domain/types.ts 03df9c070d598943d19072f5f1d440a1a4eb0aba0228080b8502ddba1d300bb1
packages/workbench/src/demo/state.ts a6258c9390596c29a80bde76494be45f26eb78219729a8e5eb0db98e6a1b6bdd
packages/workbench/src/index.ts 72c630a2602abb073666c5335c495cc2e2f9212ea9ab2712edbf2778015dd80b
packages/workbench/tsconfig.build.json 6390da9b363885f6dedbbdde34d1f97a05b88a64639c6544fe7eda1cada00cc9
packages/workbench/tsconfig.json bbccb8bab9670cda697161c5a3307ddcb6b6abc302be224058bdeb4ffcb21519`

export const expectedProductionBoundary = {
  baselineCommit: 'bd0ae743e0c490b5aa770eccae3dd77d325e9a48',
  files: PRODUCTION_BOUNDARY_LINES.split('\n').map((line) => {
    const [path, sha256] = line.split(' ')
    return { path, sha256 }
  }),
  aggregateSha256: '73f111ba9929d5960d70e27fefe36a43f43951aabcf65a0f2d665bf8c454f5cb',
}

export const expectedCompilerToolchain = {
  typescript: { lockPath: 'node_modules/typescript', version: '6.0.3', integrity: 'sha512-y2TvuxSZPDyQakkFRPZHKFm+KKVqIisdg9/CZwm9ftvKXLP8NRWj38/ODjNbr43SsoXqNuAisEf1GdCxqWcdBw==' },
  nodeTypes: { lockPath: 'node_modules/@types/node', version: '24.13.3', integrity: 'sha512-Dh8vAsV36ig5wa9OX4pXvMc9D3Veibfw2wix0CUwYODLD8nkj9UsLjASr49nPg+2eKzxhBV+v7L8pXvT4e639Q==' },
  undiciTypes: { lockPath: 'node_modules/undici-types', version: '7.18.2', integrity: 'sha512-AsuCzffGHJybSaRrmr5eHr81mwJU3kjw6M+uprWvCXiNeN9SOGwQ3Jn8jb8m3Z6izVgknn1R0FTCEAP2QrLY/w==' },
  reactTypes: { lockPath: 'node_modules/@types/react', version: '18.3.31', integrity: 'sha512-vfEqpXTvwT91yhmwdfouStN2hSKwTvyRs8qpLfADyrq/kxDw0hZM7Wk9Ug1FELj8hIby+S/+kQCSRFF32nv2Qw==' },
  propTypes: { lockPath: 'node_modules/@types/prop-types', version: '15.7.15', integrity: 'sha512-F6bEyamV9jKGAFBEmlQnesRPGOQqS2+Uwi0Em15xenOxHaf2hv6L8YCVn3rPdPJOiJfPiCnLIRyvwVaqMY3MIw==' },
  csstype: { lockPath: 'node_modules/csstype', version: '3.2.3', integrity: 'sha512-z1HGKcYy2xA8AGQfwrn0PAy+PB7X/GSj3UVJW9qKyn43xWa+gl5nXmU4qqLMRzWVLFC8KusUX8T/0kCiOYpAIQ==' },
}

const expectedCompilerRootDependencies = {
  typescript: {},
  nodeTypes: { 'undici-types': '~7.18.0' },
  undiciTypes: {},
  reactTypes: { '@types/prop-types': '*', csstype: '^3.2.2' },
  propTypes: {},
  csstype: {},
}

async function sha256File(path, missingCode) {
  return sha256(await readFileWithStableMissingCode(path, undefined, missingCode))
}

async function readJsonFile(path) {
  let handle
  try {
    const preflight = await lstat(path)
    if (!preflight.isFile() || preflight.isSymbolicLink()) {
      fail('INPUT_READ_FAILED', 'json input')
    }
    handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK,
    )
  } catch {
    fail('INPUT_READ_FAILED', 'json input')
  }
  let bytes
  let identity
  try {
    const before = await handle.stat()
    const pathBefore = await lstat(path)
    if (!before.isFile() || !pathBefore.isFile() || pathBefore.isSymbolicLink()
      || before.nlink !== 1 || pathBefore.nlink !== 1) {
      fail('INPUT_READ_FAILED', 'json input')
    }
    for (const field of ['dev', 'ino', 'size', 'nlink', 'mode', 'mtimeMs', 'ctimeMs']) {
      if (before[field] !== pathBefore[field]) fail('SOURCE_FILE_IDENTITY_CHANGED', 'json input')
    }
    bytes = await handle.readFile()
    const after = await handle.stat()
    const pathAfter = await lstat(path)
    for (const field of ['dev', 'ino', 'size', 'nlink', 'mode', 'mtimeMs', 'ctimeMs']) {
      if (before[field] !== after[field] || before[field] !== pathAfter[field]) {
        fail('SOURCE_FILE_IDENTITY_CHANGED', 'json input')
      }
    }
    if (bytes.length !== before.size) fail('SOURCE_FILE_IDENTITY_CHANGED', 'json input')
    identity = {
      sha256: sha256(bytes),
      size: before.size,
      mode: before.mode & 0o777,
      dev: before.dev,
      ino: before.ino,
      nlink: before.nlink,
      mtimeMs: before.mtimeMs,
      ctimeMs: before.ctimeMs,
    }
  } catch (error) {
    if (error?.code) throw error
    fail('INPUT_READ_FAILED', 'json input')
  } finally {
    await handle?.close()
  }
  const raw = bytes.toString('utf8')
  let value
  try {
    value = JSON.parse(raw)
  } catch {
    fail('INVALID_JSON_OBJECT', 'json input')
  }
  if (!isObject(value)) fail('INVALID_JSON_OBJECT', path)
  return {
    raw,
    rawBytes: bytes,
    rawSha256: sha256(bytes),
    canonicalSha256: sha256(canonicalJsonBytes(value)),
    identity,
    value,
  }
}

export const publicInputSchemaCodes = Object.freeze([
  'UNSUPPORTED_INPUT_MANIFEST_SCHEMA',
  'INVALID_JSON_OBJECT',
  'INPUT_READ_FAILED',
])

export const dynamicOwnedInputErrorCodes = Object.freeze([
  'EXPECTED_REGULAR_FILE',
  'EXPECTED_DIRECTORY',
  'INVALID_SOURCE_CACHE',
  'INVALID_CANDIDATE_ROOT',
  'MISSING_CACHE_CONTENT',
  'PRODUCTION_BOUNDARY_FILE_MISSING',
  'INVALID_NODE_EXECUTABLE',
  'INVALID_NPM_CLI',
  'MISSING_CACHE_INDEX',
])

export const publicInputMismatchCodes = Object.freeze([
  'INVALID_CANONICAL_JSON', 'INVALID_SCHEMA_OBJECT', 'SCHEMA_KEY_MISMATCH', 'MANIFEST_PATH_LEAK',
  'UNSAFE_RELATIVE_PATH', 'INVALID_LOCK_PATH',
  'ACCEPTED_PACKAGE_JSON_CANONICAL_MISMATCH', 'ACCEPTED_PACKAGE_LOCK_CANONICAL_MISMATCH',
  'CANDIDATE_LABEL_MISMATCH', 'INVALID_CANDIDATE_EXPECTED', 'CANDIDATE_EXPECTED_MISMATCH',
  'INVALID_ACCEPTED_ROOT_PACKAGE', 'ROOT_DEPENDENCY_MISMATCH', 'INVALID_LOCKFILE_V3',
  'LEGACY_LOCK_DEPENDENCIES_FORBIDDEN', 'ROOT_LOCK_DEPENDENCY_MISMATCH', 'REGISTRY_COUNT_MISMATCH',
  'DEEPSEEK_COHORT_COUNT_MISMATCH', 'MISSING_LOCK_INTEGRITY', 'MIXED_COHORT',
  'NESTED_COMMANDER_MISMATCH', 'INVALID_LOCK_PROJECTION_RECORD', 'INVALID_ROOT_LOCKFILE',
  'COMPILER_TOOLCHAIN_MISMATCH', 'ROOT_LOCK_TOOLCHAIN_MISMATCH', 'PRODUCTION_BOUNDARY_MANIFEST_MISMATCH',
  'PRODUCTION_BOUNDARY_FILE_LIST_MISMATCH', 'PRODUCTION_BOUNDARY_HASH_MISMATCH',
  'INPUT_MANIFEST_VERSION_MISMATCH', 'INPUT_MANIFEST_TEXT_INVALID', 'ACCEPTED_INPUT_HASH_MISMATCH',
  'ACCEPTED_ROOT_PACKAGE_MISMATCH', 'PACKAGE_COUNTS_MISMATCH', 'DECLARATION_COHORT_MISMATCH',
  'SELECTED_CACHE_COUNT_OR_BYTES_MISMATCH', 'INVALID_SELECTED_CACHE_ENTRY',
  'NONCANONICAL_SELECTED_CACHE_ORDER', 'LOCK_PROJECTION_MISMATCH', 'SELECTED_CACHE_BYTE_SUM_MISMATCH',
  'SELECTED_INDEX_HASH_MISMATCH', 'SELECTED_CONTENT_AGGREGATE_MISMATCH', 'LOCK_PROJECTION_HASH_MISMATCH',
  'PROPOSAL_STAGE_RESULT_MISMATCH', 'RUNTIME_IDENTITY_TYPE_MISMATCH', 'RUNTIME_IDENTITY_MISMATCH',
  'COMMITTED_INPUT_BYTE_HASH_MISMATCH', 'COMMITTED_INPUT_CANONICAL_MISMATCH',
  'INVALID_COMMITTED_SELECTED_CACHE', 'INVALID_COMMITTED_CACHE_ENTRY',
  'UNSUPPORTED_INTEGRITY', 'INVALID_SHA512_INTEGRITY',
  'CACHE_INDEX_IDENTITY_MISMATCH', 'INVALID_CACHE_INDEX_SIZE', 'ACCEPTED_ROOT_NOT_EMPTY',
  'INVALID_LOCK_RECORD', 'AMBIGUOUS_CACHE_INDEX', 'INVALID_CACHE_INDEX_LINE', 'CACHE_SIZE_MISMATCH',
  'CACHE_CONTENT_INTEGRITY_MISMATCH', 'SELECTED_CACHE_COUNT_MISMATCH', 'SELECTED_CACHE_BYTES_MISMATCH',
  'PRODUCTION_BOUNDARY_SYMLINK', 'PRODUCTION_BOUNDARY_SPECIAL_FILE',
  'COPIED_INDEX_HASH_MISMATCH', 'COPIED_CONTENT_SIZE_MISMATCH', 'COPIED_CONTENT_INTEGRITY_MISMATCH',
  'CACHE_SYMLINK_FORBIDDEN', 'IMMUTABLE_CONTRACT_HASH_CHANGED', 'COPIED_CONTRACT_HASH_MISMATCH',
  'INVALID_CANDIDATE_LIVE_PATHS', 'INVALID_CACHE_INDEX_JSON',
  'INCONCLUSIVE_CACHE_MISS', 'CACHE_READONLY_REQUIRED',
  'CACHE_INVENTORY_EXTRA', 'CACHE_INVENTORY_MISSING', 'CACHE_INVENTORY_SYMLINK',
  'CACHE_INVENTORY_SPECIAL', 'CACHE_HARDLINK_FORBIDDEN',
  'SOURCE_CACHE_SNAPSHOT_MISMATCH', 'TARGET_CACHE_SNAPSHOT_MISMATCH',
  'BUNDLE_PATH_CONTAINMENT', 'BUNDLE_VERIFY_MISSING',
  'BUNDLE_VERIFY_SYMLINK', 'BUNDLE_VERIFY_WRITABLE', 'BUNDLE_VERIFY_SPECIAL',
  'BUNDLE_VERIFY_HARDLINK', 'BUNDLE_RECEIPT_MISMATCH',
  'STABLE_POINTER_CONFLICT',
  'STABLE_POINTER_LINK_STATE',
  'CACHE_INDEX_CRLF_FORBIDDEN', 'CACHE_INDEX_LINE_LIMIT', 'CACHE_INDEX_TOTAL_BYTES_LIMIT',
  'SOURCE_FILE_IDENTITY_CHANGED', 'PREPARE_OPTIONS_MISMATCH', 'STAGE_OPTIONS_MISMATCH',
  'COMMITTED_V1_BOOTSTRAP_MISMATCH', 'STABLE_POINTER_REQUIRED',
  'PUBLISHED_LOGICAL_INPUT_MISMATCH', 'PROPOSAL_CONFLICT',
  'PROPOSAL_POINTER_LINK_STATE', 'REPLAY_PATH_CONTAINMENT',
  'COMPILER_PATH_CONTAINMENT', 'COMPILER_OUTPUT_ESCAPE', 'STORAGE_SELECTED_OR_IMPORTED',
  'VERIFIER_SOURCE_MISMATCH',
  'BUNDLE_SOURCE_TARGET_INODE_OVERLAP',
  'CACHE_SOURCE_PATH_CHAIN_INVALID',
  'CACHE_INDEX_SCHEMA_MISMATCH',
  'CANDIDATE_SCHEMA_MISMATCH', 'CANDIDATE_AUTHORIZATION_MISMATCH',
  ...dynamicOwnedInputErrorCodes,
])

export const publicInputOperationalCodes = Object.freeze([
  'BUNDLE_CLEANUP_FAILED',
  'BUNDLE_CLEANUP_OWNERSHIP_LOST',
  'BUNDLE_DIRECTORY_COLLISION',
  'BUNDLE_TARGET_WRITE_FAILED',
  'POINTER_COMMIT_FAILED',
  'POINTER_COMMIT_UNCERTAIN',
  'POINTER_RESIDUE_CLEANUP_FAILED',
  'POINTER_SIZE_LIMIT',
  'POINTER_TEMP_WRITE_FAILED',
  'OFFLINE_REPLAY_FAILED',
  'STAGED_REPLAY_VERIFICATION_FAILED',
  'DECLARATION_COMPILE_FAILED',
  'PROPOSAL_POINTER_TEMP_WRITE_FAILED',
  'PROPOSAL_COMMIT_FAILED',
  'PROPOSAL_COMMIT_UNCERTAIN',
  'PROPOSAL_RESIDUE_CLEANUP_FAILED',
  'PROPOSAL_CLEANUP_FAILED',
  'PROPOSAL_CLEANUP_OWNERSHIP_LOST',
  'REPLAY_ROOT_CREATE_FAILED',
  'REPLAY_CLEANUP_FAILED',
  'REPLAY_CLEANUP_OWNERSHIP_LOST',
  'COMMITTED_EVIDENCE_CHANGED',
])

const PUBLIC_INPUT_SCHEMA_CODES = new Set(publicInputSchemaCodes)
const PUBLIC_INPUT_MISMATCH_CODES = new Set(publicInputMismatchCodes)
const PUBLIC_INPUT_OPERATIONAL_CODES = new Set(publicInputOperationalCodes)

export function mapPublicInputError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  if (code === 'LEGACY_ACCEPT_DISABLED') {
    return { status: 'FAIL_INPUT_POLICY', reasonCode: code }
  }
  if (PUBLIC_INPUT_SCHEMA_CODES.has(code)) {
    return { status: 'FAIL_INPUT_SCHEMA', reasonCode: code }
  }
  if (PUBLIC_INPUT_MISMATCH_CODES.has(code)) return { status: 'FAIL_INPUT_MISMATCH', reasonCode: code }
  if (PUBLIC_INPUT_OPERATIONAL_CODES.has(code)) return { status: 'FAIL_INPUT_INTERNAL', reasonCode: code }
  return { status: 'FAIL_INPUT_INTERNAL', reasonCode: 'UNEXPECTED_INPUT_ERROR' }
}

function ensureRelativePath(path, label) {
  if (path.startsWith('/') || path.includes('..') || path.includes('\\')) {
    fail('UNSAFE_RELATIVE_PATH', `${label}: ${path}`)
  }
  return path
}

function packageNameFromLockPath(lockPath) {
  const marker = 'node_modules/'
  const index = lockPath.lastIndexOf(marker)
  if (index === -1) fail('INVALID_LOCK_PATH', lockPath)
  return lockPath.slice(index + marker.length)
}

function integrityToContentPath(cacheRoot, integrity) {
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity)
  if (!match) fail('UNSUPPORTED_INTEGRITY', integrity)
  const hex = Buffer.from(match[1], 'base64').toString('hex')
  if (hex.length !== 128) fail('INVALID_SHA512_INTEGRITY', integrity)
  return resolve(cacheRoot, 'content-v2/sha512', hex.slice(0, 2), hex.slice(2, 4), hex.slice(4))
}

function cacheIndexPath(cacheRoot, key) {
  const digest = sha256(key)
  return resolve(
    cacheRoot,
    'index-v5',
    digest.slice(0, 2),
    digest.slice(2, 4),
    digest.slice(4),
  )
}

function assertRegistryUrl(url, label) {
  let parsed
  try { parsed = new URL(url) } catch { fail('CACHE_INDEX_SCHEMA_MISMATCH', label) }
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'registry.npmjs.org'
    || (parsed.port !== '' && parsed.port !== '443') || parsed.username !== ''
    || parsed.password !== '' || parsed.search !== '' || parsed.hash !== '') {
    fail('CACHE_INDEX_SCHEMA_MISMATCH', label)
  }
}

const CACHE_KEY_PREFIX = 'make-fetch-happen:request-cache:'
const CACHE_INDEX_REQUEST_HEADERS = new Set([
  'accept-charset',
  'accept-encoding',
  'accept-language',
  'accept',
  'cache-control',
  'host',
])
const CACHE_INDEX_RESPONSE_HEADERS = new Set([
  'cache-control',
  'content-encoding',
  'content-language',
  'content-type',
  'date',
  'etag',
  'expires',
  'last-modified',
  'link',
  'location',
  'pragma',
  'vary',
])
const CACHE_INDEX_HEADER_VALUE_MAX_BYTES = 1024 * 1024
const CACHE_INDEX_SENSITIVE_HEADER_NAMES = new Set([
  'authorization',
  'cookie',
  'npm-session',
  'proxy-authorization',
  'set-cookie',
  'x-api-key',
])

function failCacheIndexSchema() {
  fail('CACHE_INDEX_SCHEMA_MISMATCH', 'cache index')
}

function assertCacheIndexExactKeys(value, keys) {
  try {
    assertExactKeys(value, keys, 'cache index')
  } catch (error) {
    if (error?.code === 'SCHEMA_KEY_MISMATCH' || error?.code === 'INVALID_SCHEMA_OBJECT') {
      failCacheIndexSchema()
    }
    throw error
  }
}

function assertNonnegativeSafeInteger(value) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    failCacheIndexSchema()
  }
}

function assertCanonicalCacheIntegrity(integrity) {
  if (typeof integrity !== 'string') failCacheIndexSchema()
  const match = /^sha512-([A-Za-z0-9+/]+={0,2})$/.exec(integrity)
  if (!match) failCacheIndexSchema()
  const bytes = Buffer.from(match[1], 'base64')
  if (bytes.length !== 64 || bytes.toString('base64') !== match[1]) failCacheIndexSchema()
}

function expectedCacheUrl(expectedKey, expectedIntegrity) {
  if (typeof expectedKey !== 'string' || !expectedKey.startsWith(CACHE_KEY_PREFIX)) {
    failCacheIndexSchema()
  }
  assertCanonicalCacheIntegrity(expectedIntegrity)
  const url = expectedKey.slice(CACHE_KEY_PREFIX.length)
  assertRegistryUrl(url, 'cache index')
  let parsed
  try { parsed = new URL(url) } catch { failCacheIndexSchema() }
  if (url.length === 0 || url.length > 16 * 1024 || parsed.pathname === '/'
    || parsed.pathname.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(url)
    || /%(?:2f|5c|00)/i.test(url)) {
    failCacheIndexSchema()
  }
  return url
}

function assertSafeCacheHeaderValue(value) {
  if (typeof value !== 'string' || Buffer.byteLength(value, 'utf8') > CACHE_INDEX_HEADER_VALUE_MAX_BYTES
    || /[\u0000-\u001f\u007f]/.test(value)
    || /(?:^|[\s"'=<([{,:])\/(?:Users|private|tmp|home|Volumes|opt|workspace|var\/folders)\//i.test(value)
    || /(?:^|[\s"'=<([{,:])[A-Za-z]:[\\/]/.test(value)
    || /(?:^|[^A-Za-z0-9])(?:\\\\|file:|~[\\/]|\.\.(?:[\\/]|$))/i.test(value)
    || /(?:^|[\s"'=<([{,:])(?:bearer|basic)\s+\S/i.test(value)
    || /https?:\/\/[^/\s@]+@/i.test(value)
    || /[?&](?:x-amz-(?:credential|signature|security-token)|access[_-]?token|token|api[_-]?key|secret|password|signature|sig)=/i.test(value)) {
    failCacheIndexSchema()
  }
}

function assertSafeCacheHeaderMap(headers, allowedNames) {
  if (!isObject(headers)) failCacheIndexSchema()
  for (const [name, value] of Object.entries(headers)) {
    if (!allowedNames.has(name)) failCacheIndexSchema()
    assertSafeCacheHeaderValue(value)
  }
}

function varyRequestHeaderNames(responseHeaders) {
  const names = new Set()
  const vary = responseHeaders.vary
  if (vary === undefined || vary === '*') return names
  if (typeof vary !== 'string') failCacheIndexSchema()
  const parts = vary.split(',').map((name) => name.trim().toLowerCase())
  if (parts.length > 64 || parts.some((name) => name === ''
    || !/^[!#$%&'*+.^_`|~0-9a-z-]+$/.test(name))) {
    failCacheIndexSchema()
  }
  for (const name of parts) names.add(name)
  return names
}

function assertSafeCacheRequestHeaderMap(headers, responseHeaders) {
  if (!isObject(headers)) failCacheIndexSchema()
  const variedNames = varyRequestHeaderNames(responseHeaders)
  for (const [name, value] of Object.entries(headers)) {
    if (!CACHE_INDEX_REQUEST_HEADERS.has(name) && !variedNames.has(name)) failCacheIndexSchema()
    if (CACHE_INDEX_SENSITIVE_HEADER_NAMES.has(name)) failCacheIndexSchema()
    assertSafeCacheHeaderValue(value)
  }
}

function assertSafeFrozenCacheIndexRecord(record, expectedKey, expectedIntegrity) {
  if (!isObject(record)) failCacheIndexSchema()
  assertCacheIndexExactKeys(record, ['integrity', 'key', 'metadata', 'size'])
  if (record.key !== expectedKey || record.integrity !== expectedIntegrity) {
    fail('CACHE_INDEX_IDENTITY_MISMATCH', 'cache index')
  }
  if (typeof record.size !== 'number' || !Number.isSafeInteger(record.size) || record.size < 0) {
    fail('INVALID_CACHE_INDEX_SIZE', 'cache index')
  }
  if (!isObject(record.metadata)) failCacheIndexSchema()
  assertCacheIndexExactKeys(record.metadata, ['url'])
  assertRegistryUrl(record.metadata.url, 'cache index')
  if (record.metadata.url !== expectedCacheUrl(expectedKey, expectedIntegrity)) {
    fail('CACHE_INDEX_IDENTITY_MISMATCH', 'cache index')
  }
}

function assertSafeSourceCacheIndexRecord(record, expectedKey, expectedIntegrity) {
  if (!isObject(record)) failCacheIndexSchema()
  assertCacheIndexExactKeys(record, ['integrity', 'key', 'metadata', 'size', 'time'])
  assertNonnegativeSafeInteger(record.time)
  if (typeof record.size !== 'number' || !Number.isSafeInteger(record.size) || record.size < 0) {
    fail('INVALID_CACHE_INDEX_SIZE', 'cache index')
  }
  if (!isObject(record.metadata)) failCacheIndexSchema()
  assertCacheIndexExactKeys(record.metadata, ['options', 'reqHeaders', 'resHeaders', 'time', 'url'])
  assertNonnegativeSafeInteger(record.metadata.time)
  assertRegistryUrl(record.metadata.url, 'cache index')
  const boundUrl = expectedCacheUrl(expectedKey, expectedIntegrity)
  if (record.key !== expectedKey || record.integrity !== expectedIntegrity
    || record.metadata.url !== boundUrl) {
    fail('CACHE_INDEX_IDENTITY_MISMATCH', 'cache index')
  }
  assertSafeCacheHeaderMap(record.metadata.resHeaders, CACHE_INDEX_RESPONSE_HEADERS)
  assertSafeCacheRequestHeaderMap(record.metadata.reqHeaders, record.metadata.resHeaders)
  if (!isObject(record.metadata.options)) failCacheIndexSchema()
  assertCacheIndexExactKeys(record.metadata.options, ['compress'])
  if (typeof record.metadata.options.compress !== 'boolean') failCacheIndexSchema()
}

async function lstatWithStableMissingCode(path, code) {
  try {
    return await lstat(path)
  } catch (error) {
    if (error && error.code === 'ENOENT') fail(code, path)
    throw error
  }
}

async function readFileWithStableMissingCode(path, options, code) {
  try {
    return await readFile(path, options)
  } catch (error) {
    if (code && error && error.code === 'ENOENT') fail(code, path)
    throw error
  }
}

async function readdirWithStableMissingCode(path, code) {
  try {
    return await readdir(path)
  } catch (error) {
    if (error && error.code === 'ENOENT') fail(code, path)
    throw error
  }
}

export async function realpathWithStableMissingCode(path, code) {
  try {
    return await realpath(path)
  } catch (error) {
    if (error && error.code === 'ENOENT') fail(code, path)
    throw error
  }
}

async function assertRegularFile(path, code = 'EXPECTED_REGULAR_FILE') {
  const fileStat = await lstatWithStableMissingCode(path, code)
  if (!fileStat.isFile() || fileStat.isSymbolicLink()) fail(code, path)
  return fileStat
}

async function assertDirectory(path, code = 'EXPECTED_DIRECTORY') {
  const directoryStat = await lstatWithStableMissingCode(path, code)
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) fail(code, path)
  return directoryStat
}

export async function assertDirectoryEmptyOrAbsent(path) {
  let directoryStat
  try {
    directoryStat = await lstat(path)
  } catch (error) {
    if (error && error.code === 'ENOENT') return
    throw error
  }
  if (!directoryStat.isDirectory() || directoryStat.isSymbolicLink()) fail('EXPECTED_DIRECTORY', path)
  if ((await readdirWithStableMissingCode(path, 'EXPECTED_DIRECTORY')).length !== 0) {
    fail('ACCEPTED_ROOT_NOT_EMPTY', path)
  }
}

function assertCandidateShape(candidate, packageJson, packageLock) {
  if (candidate.schemaVersion !== '1' || candidate.label !== EXPECTED.label) {
    fail('CANDIDATE_LABEL_MISMATCH', String(candidate.label))
  }
  if (!isObject(candidate.expected)) fail('INVALID_CANDIDATE_EXPECTED', 'expected')
  for (const [key, value] of Object.entries({
    registryPackageCount: EXPECTED.registryPackageCount,
    deepseekPackageCount: EXPECTED.deepseekPackageCount,
    dshPackageCount: EXPECTED.dshPackageCount,
    dshVersion: EXPECTED.dshVersion,
    selectedContentBytes: EXPECTED.selectedContentBytes,
  })) {
    if (candidate.expected[key] !== value) fail('CANDIDATE_EXPECTED_MISMATCH', key)
  }
  if (packageJson.name !== 'dsh-rc6-prune-lock-probe' || packageJson.private !== true) {
    fail('INVALID_ACCEPTED_ROOT_PACKAGE', 'name/private')
  }
  if (!sameStringMap(packageJson.devDependencies, EXPECTED.rootDependencies)) {
    fail('ROOT_DEPENDENCY_MISMATCH', 'package.json devDependencies')
  }
  if (packageLock.lockfileVersion !== 3 || !isObject(packageLock.packages)) {
    fail('INVALID_LOCKFILE_V3', 'lockfileVersion/packages')
  }
  if (Object.hasOwn(packageLock, 'dependencies')) fail('LEGACY_LOCK_DEPENDENCIES_FORBIDDEN', 'dependencies')
  const rootRecord = packageLock.packages['']
  if (!isObject(rootRecord) || !sameStringMap(rootRecord.devDependencies, EXPECTED.rootDependencies)) {
    fail('ROOT_LOCK_DEPENDENCY_MISMATCH', 'packages[""]')
  }
  const records = Object.entries(packageLock.packages).filter(([path]) => path !== '')
  if (records.length !== EXPECTED.registryPackageCount) fail('REGISTRY_COUNT_MISMATCH', String(records.length))
  const deepseek = records.filter(([path]) => packageNameFromLockPath(path).startsWith('@deepseek-ai/'))
  const dsh = deepseek.filter(([path]) => packageNameFromLockPath(path).startsWith('@deepseek-ai/dsh-'))
  if (deepseek.length !== EXPECTED.deepseekPackageCount || dsh.length !== EXPECTED.dshPackageCount) {
    fail('DEEPSEEK_COHORT_COUNT_MISMATCH', `${deepseek.length}/${dsh.length}`)
  }
  for (const [lockPath, record] of records) {
    if (!isObject(record) || typeof record.integrity !== 'string') {
      fail('MISSING_LOCK_INTEGRITY', lockPath)
    }
    assertRegistryUrl(record.resolved, lockPath)
    const name = packageNameFromLockPath(lockPath)
    if (name.startsWith('@deepseek-ai/dsh-') && record.version !== EXPECTED.dshVersion) {
      fail('MIXED_COHORT', `${name}@${String(record.version)}`)
    }
  }
  const nested = packageLock.packages[EXPECTED.nestedCommander.lockPath]
  if (!isObject(nested) || nested.version !== EXPECTED.nestedCommander.version) {
    fail('NESTED_COMMANDER_MISMATCH', EXPECTED.nestedCommander.lockPath)
  }
}

function assertProductionCandidateShape(candidate) {
  if (!isObject(candidate)) fail('CANDIDATE_SCHEMA_MISMATCH', 'candidate')
  try {
    assertExactKeys(candidate, [
      'authorizationBasis',
      'expected',
      'label',
      'npmCliPath',
      'schemaVersion',
      'sourceCacheRoot',
    ], 'candidate')
    assertExactKeys(candidate.expected, [
      'deepseekPackageCount',
      'dshPackageCount',
      'dshVersion',
      'registryPackageCount',
      'selectedContentBytes',
    ], 'candidate.expected')
  } catch (error) {
    if (error?.code === 'SCHEMA_KEY_MISMATCH' || error?.code === 'INVALID_SCHEMA_OBJECT') {
      fail('CANDIDATE_SCHEMA_MISMATCH', 'candidate')
    }
    throw error
  }
  if (candidate.authorizationBasis !== EXPECTED.authorizationBasis) {
    fail('CANDIDATE_AUTHORIZATION_MISMATCH', 'candidate')
  }
  if (typeof candidate.sourceCacheRoot !== 'string' || candidate.sourceCacheRoot === ''
    || typeof candidate.npmCliPath !== 'string' || candidate.npmCliPath === ''
    || !isAbsolute(candidate.sourceCacheRoot) || !isAbsolute(candidate.npmCliPath)
    || /[\u0000-\u001f\u007f]/.test(candidate.sourceCacheRoot)
    || /[\u0000-\u001f\u007f]/.test(candidate.npmCliPath)) {
    fail('CANDIDATE_SCHEMA_MISMATCH', 'candidate')
  }
}

async function readSelectedCacheRecords({ cacheRoot, packageLock }) {
  await assertDirectory(cacheRoot, 'INVALID_SOURCE_CACHE')
  const entries = []
  for (const [lockPath, record] of Object.entries(packageLock.packages)) {
    if (lockPath === '') continue
    entries.push(await readSelectedCacheRecord({ cacheRoot, lockPath, record }))
  }
  entries.sort((left, right) => compareUtf8(left.lockPath, right.lockPath))
  if (entries.length !== EXPECTED.registryPackageCount) fail('SELECTED_CACHE_COUNT_MISMATCH', String(entries.length))
  const totalBytes = entries.reduce((total, entry) => total + entry.byteLength, 0)
  if (totalBytes !== EXPECTED.selectedContentBytes) fail('SELECTED_CACHE_BYTES_MISMATCH', String(totalBytes))
  return { entries, totalBytes }
}

export async function readCacheContentBytes(path) {
  return readFileWithStableMissingCode(path, undefined, 'MISSING_CACHE_CONTENT')
}

export async function readSelectedCacheRecord({ cacheRoot, lockPath, record }) {
  if (!isObject(record)) fail('INVALID_LOCK_RECORD', lockPath)
  ensureRelativePath(lockPath, 'lock path')
  const name = packageNameFromLockPath(lockPath)
  const key = `make-fetch-happen:request-cache:${record.resolved}`
  const sourceIndexPath = cacheIndexPath(cacheRoot, key)
  const indexRaw = await readFileWithStableMissingCode(sourceIndexPath, 'utf8', 'MISSING_CACHE_INDEX')
  const lines = indexRaw.trimEnd().split('\n').filter(Boolean)
  if (lines.length !== 1) fail('AMBIGUOUS_CACHE_INDEX', sourceIndexPath)
  const tab = lines[0].indexOf('\t')
  if (tab < 1) fail('INVALID_CACHE_INDEX_LINE', sourceIndexPath)
  const checksum = lines[0].slice(0, tab)
  let indexRecord
  try {
    indexRecord = JSON.parse(lines[0].slice(tab + 1))
  } catch {
    fail('INVALID_CACHE_INDEX_JSON', sourceIndexPath)
  }
  assertSafeFrozenCacheIndexRecord(indexRecord, key, record.integrity)
  const contentPath = integrityToContentPath(cacheRoot, record.integrity)
  const contentStat = await assertRegularFile(contentPath, 'MISSING_CACHE_CONTENT')
  if (contentStat.size !== indexRecord.size) fail('CACHE_SIZE_MISMATCH', lockPath)
  const actualIntegrity = `sha512-${createHash('sha512').update(await readCacheContentBytes(contentPath)).digest('base64')}`
  if (actualIntegrity !== record.integrity) fail('CACHE_CONTENT_INTEGRITY_MISMATCH', lockPath)
  return {
    lockPath,
    name,
    version: record.version,
    integrity: record.integrity,
    key,
    indexChecksum: checksum,
    byteLength: contentStat.size,
    contentDigest: record.integrity,
    sourceIndexPath,
    contentPath,
    indexRaw,
  }
}

async function readNoFollow(path, code) {
  let handle
  try {
    const preflight = await lstat(path)
    if (!preflight.isFile() || preflight.isSymbolicLink()) fail(code, path)
    handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK,
    )
  } catch (error) {
    if (error && error.code === 'ENOENT') fail(code, path)
    if (error?.ownedInputError === true) throw error
    throw error
  }
  try {
    const before = await handle.stat()
    if (!before.isFile() || before.nlink !== 1) fail(code, path)
    const bytes = await handle.readFile()
    const after = await handle.stat()
    if (!after.isFile() || after.dev !== before.dev || after.ino !== before.ino
      || after.size !== before.size || after.nlink !== before.nlink
      || after.mode !== before.mode || after.mtimeMs !== before.mtimeMs
      || after.ctimeMs !== before.ctimeMs || bytes.length !== before.size) {
      fail('SOURCE_FILE_IDENTITY_CHANGED', path)
    }
    return bytes
  } finally {
    await handle.close()
  }
}

const CACHE_INDEX_MAX_BYTES = 8 * 1024 * 1024
const CACHE_INDEX_MAX_LINE_BYTES = 1024 * 1024
const CACHE_CONTENT_MAX_BYTES = 16 * 1024 * 1024

async function readBoundSourceFile(
  path,
  code,
  maximumBytes = CACHE_INDEX_MAX_BYTES,
  oversizedCode = code,
  logicalLabel = 'source file',
  {
    symlinkCode = code,
    specialCode = code,
    hardlinkCode = code,
    writableCode,
    allowedLinkCounts = [1],
  } = {},
) {
  let handle
  try {
    const preflight = await lstat(path)
    if (preflight.isSymbolicLink()) fail(symlinkCode, logicalLabel)
    if (!preflight.isFile()) fail(specialCode, logicalLabel)
    if (preflight.size > maximumBytes) fail(oversizedCode, logicalLabel)
    handle = await open(
      path,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | fsConstants.O_NONBLOCK,
    )
  } catch (error) {
    if (error?.code === 'ELOOP') fail(symlinkCode, logicalLabel)
    if (error?.ownedInputError === true) throw error
    fail(code, logicalLabel)
  }
  try {
    const before = await handle.stat()
    const pathBefore = await lstat(path)
    if (pathBefore.isSymbolicLink()) fail(symlinkCode, logicalLabel)
    if (!before.isFile() || !pathBefore.isFile()) fail(specialCode, logicalLabel)
    if (before.dev !== pathBefore.dev || before.ino !== pathBefore.ino) {
      fail('SOURCE_FILE_IDENTITY_CHANGED', logicalLabel)
    }
    for (const field of ['size', 'nlink', 'mode', 'mtimeMs', 'ctimeMs']) {
      if (before[field] !== pathBefore[field]) fail('SOURCE_FILE_IDENTITY_CHANGED', logicalLabel)
    }
    if (writableCode && (before.mode & 0o222) !== 0) fail(writableCode, logicalLabel)
    if (!allowedLinkCounts.includes(before.nlink)) fail(hardlinkCode, logicalLabel)
    if (before.size > maximumBytes) fail(oversizedCode, logicalLabel)
    const bytes = await handle.readFile()
    const after = await handle.stat()
    const pathAfter = await lstat(path)
    for (const field of ['dev', 'ino', 'size', 'nlink', 'mode', 'mtimeMs', 'ctimeMs']) {
      if (before[field] !== after[field]) fail('SOURCE_FILE_IDENTITY_CHANGED', logicalLabel)
    }
    if (pathAfter.isSymbolicLink() || !pathAfter.isFile()
      || pathAfter.dev !== before.dev || pathAfter.ino !== before.ino
      || pathAfter.nlink !== before.nlink || pathAfter.mode !== before.mode
      || pathAfter.size !== before.size || pathAfter.mtimeMs !== before.mtimeMs
      || pathAfter.ctimeMs !== before.ctimeMs) {
      fail('SOURCE_FILE_IDENTITY_CHANGED', logicalLabel)
    }
    if (bytes.length !== before.size) fail('SOURCE_FILE_IDENTITY_CHANGED', logicalLabel)
    return { bytes, identity: cacheFileIdentity(before, bytes) }
  } catch (error) {
    if (error?.ownedInputError === true) throw error
    fail(code, logicalLabel)
  } finally {
    await handle?.close()
  }
}

function cacheFileIdentity(fileStat, bytes) {
  return {
    sha256: sha256(bytes),
    size: fileStat.size,
    mode: fileStat.mode & 0o777,
    dev: fileStat.dev,
    ino: fileStat.ino,
    nlink: fileStat.nlink,
  }
}

async function selectCacheIndexRecordInternal({ indexPath, expectedKey, expectedIntegrity }) {
  expectedCacheUrl(expectedKey, expectedIntegrity)
  const { bytes: indexBytes, identity } = await readBoundSourceFile(
    indexPath,
    'MISSING_CACHE_INDEX',
    CACHE_INDEX_MAX_BYTES,
    'CACHE_INDEX_TOTAL_BYTES_LIMIT',
    'cache index',
  )
  if (indexBytes.length > CACHE_INDEX_MAX_BYTES) fail('CACHE_INDEX_TOTAL_BYTES_LIMIT', 'cache index')
  const raw = indexBytes.toString('utf8')
  if (raw.includes('\r')) fail('CACHE_INDEX_CRLF_FORBIDDEN', 'cache index')
  let selected = undefined
  for (const line of raw.split('\n')) {
    if (line === '') continue
    if (Buffer.byteLength(line, 'utf8') > CACHE_INDEX_MAX_LINE_BYTES) fail('CACHE_INDEX_LINE_LIMIT', 'cache index')
    const tab = line.indexOf('\t')
    if (tab < 40) continue
    const checksum = line.slice(0, tab)
    const json = line.slice(tab + 1)
    if (!/^[a-f0-9]{40}$/.test(checksum) || sha256Sha1(json) !== checksum) {
      continue
    }
    let parsed
    try {
      parsed = JSON.parse(json)
    } catch {
      continue
    }
    if (isObject(parsed) && parsed.key === expectedKey) {
      selected = { checksum, record: parsed, line }
    }
  }
  if (!selected || selected.record === null || !isObject(selected.record)
    || selected.record.integrity !== expectedIntegrity) {
    fail('INCONCLUSIVE_CACHE_MISS', 'cache index')
  }
  assertSafeSourceCacheIndexRecord(selected.record, expectedKey, expectedIntegrity)
  const record = {
    key: selected.record.key,
    integrity: selected.record.integrity,
    metadata: { url: selected.record.metadata.url },
    size: selected.record.size,
  }
  const json = canonicalJsonBytes(record)
  const checksum = sha256Sha1(json)
  return {
    checksum,
    record,
    line: `${checksum}\t${json}`,
    frozenIndexRaw: `\n${checksum}\t${json}`,
    indexBytes,
    sourceIdentity: identity,
  }
}

// The public diagnostic carries only logical cache data.  Source bytes and
// filesystem identity remain private to the publisher's transfer path.
export async function selectCacheIndexRecord(options) {
  if (!isObject(options)) failCacheIndexSchema()
  assertCacheIndexExactKeys(options, ['expectedIntegrity', 'expectedKey', 'indexPath'])
  const { indexPath, expectedKey, expectedIntegrity } = options
  if (typeof indexPath !== 'string') failCacheIndexSchema()
  expectedCacheUrl(expectedKey, expectedIntegrity)
  const selected = await selectCacheIndexRecordInternal({ indexPath, expectedKey, expectedIntegrity })
  return {
    checksum: selected.checksum,
    record: selected.record,
    frozenIndexRaw: selected.frozenIndexRaw,
  }
}

function sha256Sha1(value) {
  return createHash('sha1').update(value).digest('hex')
}

function selectedCacheExpectation(lockModel) {
  if (!isObject(lockModel) || !Array.isArray(lockModel.entries)) fail('INVALID_LOCK_PROJECTION_RECORD', 'lockModel')
  const entries = [...lockModel.entries].sort((left, right) => compareUtf8(left.lockPath, right.lockPath))
  const expected = lockModel.expected ?? {}
  const count = expected.count ?? entries.length
  const totalBytes = expected.totalBytes
  if (!Number.isSafeInteger(count) || count !== entries.length || !Number.isSafeInteger(totalBytes) || totalBytes < 0) {
    fail('CACHE_INVENTORY_MISSING', 'lock model expected counts')
  }
  return { entries, count, totalBytes }
}

function relativeCachePath(cacheRoot, absolutePath) {
  const path = relative(cacheRoot, absolutePath).split(sep).join('/')
  if (path === '' || path.startsWith('../') || path === '..') fail('CACHE_INVENTORY_EXTRA', absolutePath)
  return path
}

function addDirectoryAncestors(paths, path) {
  const parts = path.split('/')
  parts.pop()
  while (parts.length > 0) {
    paths.add(parts.join('/'))
    parts.pop()
  }
}

async function inventoryCacheTree(cacheRoot, { requireReadOnly }) {
  const records = []
  async function walk(absolutePath, relativePath = '') {
    const entry = await lstatWithStableMissingCode(absolutePath, 'CACHE_INVENTORY_MISSING')
    if (entry.isSymbolicLink()) fail('CACHE_INVENTORY_SYMLINK', relativePath)
    if (requireReadOnly && (entry.mode & 0o222) !== 0) fail('CACHE_READONLY_REQUIRED', relativePath)
    if (entry.isDirectory()) {
      if (relativePath) records.push({ path: relativePath, type: 'directory', mode: entry.mode & 0o777 })
      for (const name of (await readdirWithStableMissingCode(absolutePath, 'CACHE_INVENTORY_MISSING')).sort(compareUtf8)) {
        await walk(resolve(absolutePath, name), relativePath ? `${relativePath}/${name}` : name)
      }
      return
    }
    if (!entry.isFile()) fail('CACHE_INVENTORY_SPECIAL', relativePath)
    if (entry.nlink !== 1) fail('CACHE_HARDLINK_FORBIDDEN', relativePath)
    const bytes = await readNoFollow(absolutePath, 'CACHE_INVENTORY_MISSING')
    records.push({ path: relativePath, type: 'file', ...cacheFileIdentity(entry, bytes) })
  }
  await walk(cacheRoot)
  records.sort((left, right) => compareUtf8(left.path, right.path))
  return { records, sha256: sha256(canonicalJson(records)) }
}

export async function snapshotSelectedCacheFixtureOnly({ cacheRoot, lockModel, requireReadOnly, requireExactInventory }) {
  const expected = selectedCacheExpectation(lockModel)
  await assertDirectory(cacheRoot, 'INVALID_SOURCE_CACHE')
  const selected = []
  const expectedPaths = new Set()
  for (const entry of expected.entries) {
    const indexPath = cacheIndexPath(cacheRoot, entry.key)
    const contentPath = integrityToContentPath(cacheRoot, entry.integrity)
    const indexStat = await assertRegularFile(indexPath, 'MISSING_CACHE_INDEX')
    const contentStat = await assertRegularFile(contentPath, 'MISSING_CACHE_CONTENT')
    if (requireReadOnly && ((indexStat.mode & 0o222) !== 0 || (contentStat.mode & 0o222) !== 0)) {
      fail('CACHE_READONLY_REQUIRED', entry.lockPath)
    }
    if (requireExactInventory && (indexStat.nlink !== 1 || contentStat.nlink !== 1)) {
      fail('CACHE_HARDLINK_FORBIDDEN', entry.lockPath)
    }
    const index = await selectCacheIndexRecordInternal({ indexPath, expectedKey: entry.key, expectedIntegrity: entry.integrity })
    const contentBytes = await readNoFollow(contentPath, 'MISSING_CACHE_CONTENT')
    const contentIntegrity = `sha512-${createHash('sha512').update(contentBytes).digest('base64')}`
    if (contentIntegrity !== entry.integrity || contentBytes.length !== index.record.size || contentBytes.length !== contentStat.size) {
      fail('INCONCLUSIVE_CACHE_MISS', entry.lockPath)
    }
    const indexBytes = await readNoFollow(indexPath, 'MISSING_CACHE_INDEX')
    selected.push({
      lockPath: entry.lockPath,
      key: entry.key,
      integrity: entry.integrity,
      byteLength: contentBytes.length,
      frozenIndexRaw: index.frozenIndexRaw,
      indexIdentity: cacheFileIdentity(indexStat, indexBytes),
      contentIdentity: cacheFileIdentity(contentStat, contentBytes),
      indexPath,
      contentPath,
      // These bytes are deliberately retained only in the in-process fixture
      // snapshot.  Copying consumes them directly, so no source pathname is
      // reopened after the verified read.
      indexBytes,
      contentBytes,
    })
    for (const path of [relativeCachePath(cacheRoot, indexPath), relativeCachePath(cacheRoot, contentPath)]) {
      expectedPaths.add(path)
      addDirectoryAncestors(expectedPaths, path)
    }
  }
  const totalBytes = selected.reduce((total, entry) => total + entry.byteLength, 0)
  if (selected.length !== expected.count || totalBytes !== expected.totalBytes) fail('CACHE_INVENTORY_MISSING', 'selected count or bytes')
  const inventory = await inventoryCacheTree(cacheRoot, { requireReadOnly })
  if (requireExactInventory) {
    const actualPaths = new Set(inventory.records.map((record) => record.path))
    for (const path of actualPaths) if (!expectedPaths.has(path)) fail('CACHE_INVENTORY_EXTRA', path)
    for (const path of expectedPaths) if (!actualPaths.has(path)) fail('CACHE_INVENTORY_MISSING', path)
  }
  return { entries: selected, totalBytes, inventory }
}

// The production-shaped transfer reader deliberately never walks cacheRoot.
// It touches only each lock-projected index/content pair and the ancestors
// needed to open them.  The recursive inventory verifier is for the newly
// built bundle, never for a historical cache shared with other npm work.
async function snapshotSelectedCacheForTransfer({ cacheRoot, lockModel }) {
  const expected = selectedCacheExpectation(lockModel)
  const sourceBoundary = await openBoundDirectory(cacheRoot, 'INVALID_SOURCE_CACHE', 'source cache')
  try {
    const entries = []
    for (const entry of expected.entries) {
      const indexPath = cacheIndexPath(cacheRoot, entry.key)
      const contentPath = integrityToContentPath(cacheRoot, entry.integrity)
      await assertDescendantDirectoryChain(sourceBoundary, indexPath, {
        code: 'CACHE_SOURCE_PATH_CHAIN_INVALID',
        missingCode: 'MISSING_CACHE_INDEX',
        logicalLabel: 'cache index',
      })
      const index = await selectCacheIndexRecordInternal({ indexPath, expectedKey: entry.key, expectedIntegrity: entry.integrity })
      await assertDescendantDirectoryChain(sourceBoundary, indexPath, {
        code: 'CACHE_SOURCE_PATH_CHAIN_INVALID',
        missingCode: 'MISSING_CACHE_INDEX',
        logicalLabel: 'cache index',
      })
      await assertDescendantDirectoryChain(sourceBoundary, contentPath, {
        code: 'CACHE_SOURCE_PATH_CHAIN_INVALID',
        missingCode: 'MISSING_CACHE_CONTENT',
        logicalLabel: 'cache content',
      })
      const { bytes: contentBytes, identity: contentIdentity } = await readBoundSourceFile(
        contentPath,
        'MISSING_CACHE_CONTENT',
        CACHE_CONTENT_MAX_BYTES,
        'MISSING_CACHE_CONTENT',
        'cache content',
      )
      await assertDescendantDirectoryChain(sourceBoundary, contentPath, {
        code: 'CACHE_SOURCE_PATH_CHAIN_INVALID',
        missingCode: 'MISSING_CACHE_CONTENT',
        logicalLabel: 'cache content',
      })
      await assertBoundDirectory(sourceBoundary, 'CACHE_SOURCE_PATH_CHAIN_INVALID', 'source cache')
      if (index.sourceIdentity.nlink !== 1 || contentIdentity.nlink !== 1) fail('CACHE_HARDLINK_FORBIDDEN', entry.lockPath)
      if (contentBytes.length !== contentIdentity.size
        || `sha512-${createHash('sha512').update(contentBytes).digest('base64')}` !== entry.integrity
        || contentBytes.length !== index.record.size) {
        fail('INCONCLUSIVE_CACHE_MISS', entry.lockPath)
      }
      entries.push({
        lockPath: entry.lockPath,
        name: entry.name,
        version: entry.version,
        key: entry.key,
        integrity: entry.integrity,
        indexChecksum: index.checksum,
        byteLength: contentBytes.length,
        contentDigest: entry.contentDigest,
        frozenIndexRaw: index.frozenIndexRaw,
        indexIdentity: index.sourceIdentity,
        contentIdentity,
        contentBytes,
      })
    }
    const totalBytes = entries.reduce((total, entry) => total + entry.byteLength, 0)
    if (entries.length !== expected.count || totalBytes !== expected.totalBytes) fail('CACHE_INVENTORY_MISSING', 'selected count or bytes')
    await assertBoundDirectory(sourceBoundary, 'CACHE_SOURCE_PATH_CHAIN_INVALID', 'source cache')
    return { entries, totalBytes }
  } finally {
    await sourceBoundary.handle.close()
  }
}

async function snapshotPublishedSelectedCache({ cacheRoot, lockModel }) {
  const expected = selectedCacheExpectation(lockModel)
  const sourceBoundary = await openBoundDirectory(
    cacheRoot,
    'BUNDLE_RECEIPT_MISMATCH',
    'published cache root',
  )
  try {
    const entries = []
    for (const entry of expected.entries) {
      const indexPath = cacheIndexPath(cacheRoot, entry.key)
      const contentPath = integrityToContentPath(cacheRoot, entry.integrity)
      for (const [path, missingCode, logicalLabel] of [
        [indexPath, 'BUNDLE_RECEIPT_MISMATCH', 'published cache index'],
        [contentPath, 'BUNDLE_RECEIPT_MISMATCH', 'published cache content'],
      ]) {
        await assertDescendantDirectoryChain(sourceBoundary, path, {
          code: 'BUNDLE_RECEIPT_MISMATCH',
          missingCode,
          logicalLabel,
        })
      }
      const indexSnapshot = await readBoundSourceFile(
        indexPath,
        'BUNDLE_RECEIPT_MISMATCH',
        CACHE_INDEX_MAX_BYTES,
        'BUNDLE_RECEIPT_MISMATCH',
        'published cache index',
        { writableCode: 'BUNDLE_RECEIPT_MISMATCH' },
      )
      const rawIndex = indexSnapshot.bytes.toString('utf8')
      const match = /^\n([a-f0-9]{40})\t([^\n]+)$/.exec(rawIndex)
      if (!match || sha256Sha1(match[2]) !== match[1]) {
        fail('BUNDLE_RECEIPT_MISMATCH', 'published cache index checksum')
      }
      let record
      try {
        record = JSON.parse(match[2])
      } catch {
        fail('BUNDLE_RECEIPT_MISMATCH', 'published cache index json')
      }
      assertSafeFrozenCacheIndexRecord(record, entry.key, entry.integrity)
      if (canonicalJsonBytes(record) !== match[2]) {
        fail('BUNDLE_RECEIPT_MISMATCH', 'published cache index canonical')
      }
      const contentSnapshot = await readBoundSourceFile(
        contentPath,
        'BUNDLE_RECEIPT_MISMATCH',
        CACHE_CONTENT_MAX_BYTES,
        'BUNDLE_RECEIPT_MISMATCH',
        'published cache content',
        { writableCode: 'BUNDLE_RECEIPT_MISMATCH' },
      )
      if (contentSnapshot.bytes.length !== record.size
        || `sha512-${createHash('sha512').update(contentSnapshot.bytes).digest('base64')}` !== entry.integrity) {
        fail('BUNDLE_RECEIPT_MISMATCH', 'published cache content identity')
      }
      for (const [path, logicalLabel] of [
        [indexPath, 'published cache index'],
        [contentPath, 'published cache content'],
      ]) {
        await assertDescendantDirectoryChain(sourceBoundary, path, {
          code: 'BUNDLE_RECEIPT_MISMATCH',
          missingCode: 'BUNDLE_RECEIPT_MISMATCH',
          logicalLabel,
        })
      }
      entries.push({
        ...entry,
        indexChecksum: match[1],
        byteLength: contentSnapshot.bytes.length,
        frozenIndexRaw: rawIndex,
        indexIdentity: indexSnapshot.identity,
        contentIdentity: contentSnapshot.identity,
        contentBytes: contentSnapshot.bytes,
      })
    }
    const totalBytes = entries.reduce((total, entry) => total + entry.byteLength, 0)
    if (entries.length !== expected.count || totalBytes !== expected.totalBytes) {
      fail('BUNDLE_RECEIPT_MISMATCH', 'published cache count or bytes')
    }
    await assertBoundDirectory(sourceBoundary, 'BUNDLE_RECEIPT_MISMATCH', 'published cache root')
    return { entries, totalBytes }
  } finally {
    await sourceBoundary.handle.close().catch(() => {})
  }
}

export async function snapshotSelectedCacheSelectedOnlyForTest({ cacheRoot, lockModel }) {
  return snapshotSelectedCacheForTransfer({ cacheRoot, lockModel })
}

export function compareCacheSnapshots(left, right, { role = 'source' } = {}) {
  const logical = (snapshot) => ({
    totalBytes: snapshot.totalBytes,
    entries: snapshot.entries.map((entry) => ({
      lockPath: entry.lockPath,
      key: entry.key,
      integrity: entry.integrity,
      byteLength: entry.byteLength,
      frozenIndexRaw: entry.frozenIndexRaw,
    })).sort((a, b) => compareUtf8(a.lockPath, b.lockPath)),
  })
  if (canonicalJsonBytes(logical(left)) !== canonicalJsonBytes(logical(right))) {
    fail(role === 'target' ? 'TARGET_CACHE_SNAPSHOT_MISMATCH' : 'SOURCE_CACHE_SNAPSHOT_MISMATCH', role)
  }
  return true
}

async function makeTreeReadOnlyStrict(path) {
  const entry = await lstat(path)
  if (entry.isSymbolicLink()) fail('CACHE_INVENTORY_SYMLINK', path)
  if (entry.isDirectory()) {
    const boundary = await openBoundDirectory(
      path,
      'BUNDLE_PATH_CONTAINMENT',
      'tree sealing directory',
    )
    try {
      for (const name of await readdirWithStableMissingCode(path, 'CACHE_INVENTORY_MISSING')) {
        await makeTreeReadOnlyStrict(resolve(path, name))
      }
      await assertBoundDirectory(boundary, 'BUNDLE_PATH_CONTAINMENT', 'tree sealing directory')
      await boundary.handle.chmod(0o555)
      const sealed = await boundary.handle.stat()
      if (!sealed.isDirectory() || (sealed.mode & 0o777) !== 0o555) {
        fail('CACHE_READONLY_REQUIRED', path)
      }
      await assertBoundDirectory(boundary, 'BUNDLE_PATH_CONTAINMENT', 'tree sealing directory')
    } finally {
      await boundary.handle.close().catch(() => {})
    }
  } else if (entry.isFile()) {
    const sealed = await readBoundSourceFile(
      path,
      'CACHE_INVENTORY_MISSING',
      CACHE_CONTENT_MAX_BYTES,
      'CACHE_INVENTORY_MISSING',
      'tree sealing file',
      {
        symlinkCode: 'CACHE_INVENTORY_SYMLINK',
        specialCode: 'CACHE_INVENTORY_SPECIAL',
        hardlinkCode: 'CACHE_HARDLINK_FORBIDDEN',
        writableCode: 'CACHE_READONLY_REQUIRED',
      },
    )
    if (sealed.identity.mode !== 0o444) fail('CACHE_READONLY_REQUIRED', path)
  } else fail('CACHE_INVENTORY_SPECIAL', path)
}

async function makeTreeWritableForCleanup(path) {
  const entry = await lstat(path)
  if (entry.isSymbolicLink()) return
  if (entry.isDirectory()) {
    await chmod(path, 0o755)
    for (const name of await readdir(path)) await makeTreeWritableForCleanup(resolve(path, name))
  } else if (!entry.isFile()) fail('CACHE_INVENTORY_SPECIAL', path)
}

const FIXTURE_POINTER_RELATIVE_PATH = '.tmp/dsh-pm-workbench/declaration-input-source.json'
const FIXTURE_BUNDLE_PARENT_RELATIVE_PATH = '.tmp/dsh-pm-workbench/declaration-input-source-bundles'
const POINTER_MAX_BYTES = 4096

function fixtureBundlePaths(workspaceRoot) {
  const pointerPath = resolve(workspaceRoot, FIXTURE_POINTER_RELATIVE_PATH)
  const pointerParent = dirname(pointerPath)
  const bundleParent = resolve(workspaceRoot, FIXTURE_BUNDLE_PARENT_RELATIVE_PATH)
  if (relative(pointerParent, bundleParent) !== 'declaration-input-source-bundles') {
    fail('BUNDLE_PATH_CONTAINMENT', 'fixture bundle parent')
  }
  return { pointerPath, pointerParent, bundleParent }
}

async function openBoundDirectory(path, code, logicalLabel) {
  const lexicalPath = resolve(path)
  let handle
  try {
    handle = await open(
      lexicalPath,
      fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW | (fsConstants.O_DIRECTORY ?? 0),
    )
    const fdBefore = await handle.stat()
    const pathBefore = await lstat(lexicalPath)
    const canonicalBefore = await realpath(lexicalPath)
    const fdAfter = await handle.stat()
    const pathAfter = await lstat(lexicalPath)
    const canonicalAfter = await realpath(lexicalPath)
    if (!fdBefore.isDirectory() || !pathBefore.isDirectory() || pathBefore.isSymbolicLink()
      || !fdAfter.isDirectory() || !pathAfter.isDirectory() || pathAfter.isSymbolicLink()
      || fdBefore.dev !== fdAfter.dev || fdBefore.ino !== fdAfter.ino
      || fdBefore.dev !== pathBefore.dev || fdBefore.ino !== pathBefore.ino
      || fdBefore.dev !== pathAfter.dev || fdBefore.ino !== pathAfter.ino
      || canonicalBefore !== canonicalAfter) {
      fail(code, logicalLabel)
    }
    return {
      path: lexicalPath,
      canonicalPath: canonicalBefore,
      dev: fdBefore.dev,
      ino: fdBefore.ino,
      handle,
    }
  } catch (error) {
    await handle?.close().catch(() => {})
    if (error?.ownedInputError === true) throw error
    fail(code, logicalLabel)
  }
}

async function assertBoundDirectory(boundary, code, logicalLabel) {
  try {
    const fdBefore = await boundary.handle.stat()
    const pathBefore = await lstat(boundary.path)
    const canonicalBefore = await realpath(boundary.path)
    const fdAfter = await boundary.handle.stat()
    const pathAfter = await lstat(boundary.path)
    const canonicalAfter = await realpath(boundary.path)
    if (!fdBefore.isDirectory() || !pathBefore.isDirectory() || pathBefore.isSymbolicLink()
      || !fdAfter.isDirectory() || !pathAfter.isDirectory() || pathAfter.isSymbolicLink()
      || fdBefore.dev !== boundary.dev || fdBefore.ino !== boundary.ino
      || fdAfter.dev !== boundary.dev || fdAfter.ino !== boundary.ino
      || pathBefore.dev !== boundary.dev || pathBefore.ino !== boundary.ino
      || pathAfter.dev !== boundary.dev || pathAfter.ino !== boundary.ino
      || canonicalBefore !== boundary.canonicalPath || canonicalAfter !== boundary.canonicalPath) {
      fail(code, logicalLabel)
    }
  } catch (error) {
    if (error?.ownedInputError === true) throw error
    fail(code, logicalLabel)
  }
}

async function assertDescendantDirectoryChain(boundary, child, {
  code,
  missingCode = code,
  logicalLabel,
  includeLeafDirectory = false,
} = {}) {
  await assertBoundDirectory(boundary, code, logicalLabel)
  const relativeChild = relative(boundary.path, resolve(child))
  if (relativeChild === '' || relativeChild === '..' || relativeChild.startsWith(`..${sep}`)) {
    fail(code, logicalLabel)
  }
  const parts = relativeChild.split(sep)
  const directoryParts = includeLeafDirectory ? parts : parts.slice(0, -1)
  let current = boundary.path
  for (let index = 0; index < directoryParts.length; index += 1) {
    current = resolve(current, directoryParts[index])
    try {
      await lstat(current)
    } catch (error) {
      if (error?.code === 'ENOENT') fail(missingCode, logicalLabel)
      throw error
    }
    let currentBoundary
    try {
      currentBoundary = await openBoundDirectory(current, code, logicalLabel)
      if (currentBoundary.canonicalPath !== resolve(boundary.canonicalPath, ...directoryParts.slice(0, index + 1))) {
        fail(code, logicalLabel)
      }
      await assertBoundDirectory(currentBoundary, code, logicalLabel)
    } catch (error) {
      if (error?.code === 'ENOENT') fail(missingCode, logicalLabel)
      throw error
    } finally {
      await currentBoundary?.handle.close().catch(() => {})
    }
  }
  await assertBoundDirectory(boundary, code, logicalLabel)
}

async function ensureDescendantDirectoryChain(boundary, child, code, logicalLabel) {
  await assertBoundDirectory(boundary, code, logicalLabel)
  const relativeChild = relative(boundary.path, resolve(child))
  if (relativeChild === '' || relativeChild === '..' || relativeChild.startsWith(`..${sep}`)) {
    fail(code, logicalLabel)
  }
  const parts = relativeChild.split(sep)
  let current = boundary.path
  for (let index = 0; index < parts.length; index += 1) {
    current = resolve(current, parts[index])
    await assertBoundDirectory(boundary, code, logicalLabel)
    try {
      await mkdir(current, { mode: 0o700 })
    } catch (error) {
      if (error?.code !== 'EEXIST') fail(code, logicalLabel)
    }
    let currentBoundary
    try {
      currentBoundary = await openBoundDirectory(current, code, logicalLabel)
      if (currentBoundary.canonicalPath !== resolve(boundary.canonicalPath, ...parts.slice(0, index + 1))) {
        fail(code, logicalLabel)
      }
      await assertBoundDirectory(currentBoundary, code, logicalLabel)
    } finally {
      await currentBoundary?.handle.close().catch(() => {})
    }
  }
  await assertBoundDirectory(boundary, code, logicalLabel)
}

async function assertPublicationBoundaries({
  workspaceBoundary,
  pointerParentBoundary,
  bundleParentBoundary,
  bundleBoundary,
}) {
  await assertBoundDirectory(workspaceBoundary, 'BUNDLE_PATH_CONTAINMENT', 'workspace root')
  await assertBoundDirectory(pointerParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'pointer parent')
  await assertBoundDirectory(bundleParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle parent')
  if (pointerParentBoundary.canonicalPath
    !== resolve(workspaceBoundary.canonicalPath, '.tmp/dsh-pm-workbench')
    || bundleParentBoundary.canonicalPath
      !== resolve(pointerParentBoundary.canonicalPath, 'declaration-input-source-bundles')) {
    fail('BUNDLE_PATH_CONTAINMENT', 'publication parent relationship')
  }
  if (bundleBoundary) {
    await assertBoundDirectory(bundleBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle root')
    if (bundleBoundary.canonicalPath
      !== resolve(bundleParentBoundary.canonicalPath, safeBundleSegment(bundleBoundary.path))) {
      fail('BUNDLE_PATH_CONTAINMENT', 'bundle relationship')
    }
  }
}

async function unlinkOwnedPointerTemporary(pointerTemporary, code) {
  let entry
  try {
    entry = await lstat(pointerTemporary.path)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    fail(code, 'pointer temporary')
  }
  if (!entry.isFile() || entry.isSymbolicLink()
    || entry.dev !== pointerTemporary.identity.dev || entry.ino !== pointerTemporary.identity.ino
    || ![1, 2].includes(entry.nlink)) {
    fail(code, 'pointer temporary identity')
  }
  try {
    await unlink(pointerTemporary.path)
  } catch (error) {
    if (error?.code === 'ENOENT') return
    fail(code, 'pointer temporary unlink')
  }
}

async function cleanupOwnedUnpublishedBundle({
  workspaceBoundary,
  pointerParentBoundary,
  bundleParentBoundary,
  bundleBoundary,
  bundleRoot,
  ownerMarker,
}) {
  try {
    await assertPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    const owner = await readBoundSourceFile(
      resolve(bundleRoot, '.owner'),
      'BUNDLE_CLEANUP_OWNERSHIP_LOST',
      128,
      'BUNDLE_CLEANUP_OWNERSHIP_LOST',
      'bundle owner',
      { writableCode: 'BUNDLE_CLEANUP_OWNERSHIP_LOST' },
    )
    if (owner.bytes.toString('utf8') !== ownerMarker) {
      fail('BUNDLE_CLEANUP_OWNERSHIP_LOST', 'bundle owner')
    }
  } catch {
    fail('BUNDLE_CLEANUP_OWNERSHIP_LOST', 'owned bundle')
  }

  const quarantinePath = resolve(
    bundleParentBoundary.path,
    `.cleanup-${ownerMarker}-${randomBytes(8).toString('hex')}`,
  )
  try {
    await rename(bundleRoot, quarantinePath)
  } catch {
    fail('BUNDLE_CLEANUP_FAILED', 'bundle quarantine rename')
  }
  const quarantineBoundary = {
    ...bundleBoundary,
    path: quarantinePath,
    canonicalPath: resolve(bundleParentBoundary.canonicalPath, basename(quarantinePath)),
  }
  try {
    await assertBoundDirectory(quarantineBoundary, 'BUNDLE_CLEANUP_OWNERSHIP_LOST', 'quarantined bundle')
    const owner = await readBoundSourceFile(
      resolve(quarantinePath, '.owner'),
      'BUNDLE_CLEANUP_OWNERSHIP_LOST',
      128,
      'BUNDLE_CLEANUP_OWNERSHIP_LOST',
      'quarantined bundle owner',
      { writableCode: 'BUNDLE_CLEANUP_OWNERSHIP_LOST' },
    )
    if (owner.bytes.toString('utf8') !== ownerMarker) {
      fail('BUNDLE_CLEANUP_OWNERSHIP_LOST', 'quarantined bundle owner')
    }
  } catch {
    fail('BUNDLE_CLEANUP_OWNERSHIP_LOST', 'quarantined bundle')
  }
  await bundleBoundary.handle.close().catch(() => {})
  try {
    await makeTreeWritableForCleanup(quarantinePath)
    await rm(quarantinePath, { recursive: true, force: true })
  } catch {
    fail('BUNDLE_CLEANUP_FAILED', 'quarantined bundle removal')
  }
}

async function writeBundleFile(target, bytes) {
  let handle
  let identity
  try {
    handle = await open(target, fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW, 0o600)
    await handle.writeFile(bytes)
    await handle.sync()
    const beforeSeal = await handle.stat()
    if (!beforeSeal.isFile() || beforeSeal.nlink !== 1) {
      fail('BUNDLE_TARGET_WRITE_FAILED', target)
    }
    await handle.chmod(0o444)
    const afterWrite = await handle.stat()
    if (!afterWrite.isFile() || afterWrite.dev !== beforeSeal.dev
      || afterWrite.ino !== beforeSeal.ino || afterWrite.size !== beforeSeal.size
      || afterWrite.nlink !== 1 || (afterWrite.mode & 0o777) !== 0o444) {
      fail('BUNDLE_TARGET_WRITE_FAILED', target)
    }
    const reread = Buffer.alloc(bytes.length)
    const { bytesRead } = await handle.read(reread, 0, reread.length, 0)
    if (bytesRead !== bytes.length || !reread.equals(Buffer.from(bytes))) fail('BUNDLE_TARGET_WRITE_FAILED', target)
    identity = cacheFileIdentity(afterWrite, bytes)
  } catch (error) {
    if (error?.code) fail('BUNDLE_TARGET_WRITE_FAILED', target)
    throw error
  } finally {
    await handle?.close()
  }
  const reopened = await readBoundSourceFile(target, 'BUNDLE_TARGET_WRITE_FAILED', Math.max(CACHE_CONTENT_MAX_BYTES, bytes.length))
  if (reopened.identity.dev !== identity.dev || reopened.identity.ino !== identity.ino
    || reopened.identity.size !== identity.size || reopened.identity.nlink !== 1
    || !reopened.bytes.equals(Buffer.from(bytes))) fail('BUNDLE_TARGET_WRITE_FAILED', target)
  return reopened.identity
}

async function inventoryBundlePayload(bundleRoot) {
  const records = []
  const rootBoundary = await openBoundDirectory(bundleRoot, 'BUNDLE_PATH_CONTAINMENT', 'inventory root')
  async function walk(absolutePath, logicalPath, heldDirectoryBoundary) {
    const entry = await lstatWithStableMissingCode(absolutePath, 'BUNDLE_VERIFY_MISSING')
    if (entry.isSymbolicLink()) fail('BUNDLE_VERIFY_SYMLINK', logicalPath)
    if (entry.isDirectory()) {
      const directoryBoundary = heldDirectoryBoundary
        ?? await openBoundDirectory(absolutePath, 'BUNDLE_PATH_CONTAINMENT', 'inventory directory')
      try {
        const expectedCanonical = logicalPath === '.'
          ? rootBoundary.canonicalPath
          : resolve(rootBoundary.canonicalPath, ...logicalPath.split('/'))
        if (directoryBoundary.canonicalPath !== expectedCanonical) {
          fail('BUNDLE_PATH_CONTAINMENT', 'inventory directory relationship')
        }
        const directoryStat = await directoryBoundary.handle.stat()
        if ((directoryStat.mode & 0o222) !== 0) fail('BUNDLE_VERIFY_WRITABLE', logicalPath)
        records.push({ path: logicalPath, type: 'directory', mode: directoryStat.mode & 0o777 })
        for (const name of (await readdirWithStableMissingCode(absolutePath, 'BUNDLE_VERIFY_MISSING')).sort(compareUtf8)) {
          await walk(resolve(absolutePath, name), logicalPath === '.' ? name : `${logicalPath}/${name}`)
        }
        await assertBoundDirectory(directoryBoundary, 'BUNDLE_PATH_CONTAINMENT', 'inventory directory')
      } finally {
        if (!heldDirectoryBoundary) await directoryBoundary.handle.close().catch(() => {})
      }
      return
    }
    if (!entry.isFile()) fail('BUNDLE_VERIFY_SPECIAL', logicalPath)
    const { bytes, identity } = await readBoundSourceFile(
      absolutePath,
      'BUNDLE_VERIFY_MISSING',
      CACHE_CONTENT_MAX_BYTES,
      'BUNDLE_VERIFY_MISSING',
      logicalPath,
      {
        symlinkCode: 'BUNDLE_VERIFY_SYMLINK',
        specialCode: 'BUNDLE_VERIFY_SPECIAL',
        hardlinkCode: 'BUNDLE_VERIFY_HARDLINK',
        writableCode: 'BUNDLE_VERIFY_WRITABLE',
      },
    )
    records.push({ path: logicalPath, type: 'file', mode: identity.mode, size: identity.size, sha256: identity.sha256 })
  }
  try {
    await walk(bundleRoot, '.', rootBoundary)
    await assertBoundDirectory(rootBoundary, 'BUNDLE_PATH_CONTAINMENT', 'inventory root')
    return records.sort((left, right) => compareUtf8(left.path, right.path))
  } finally {
    await rootBoundary.handle.close().catch(() => {})
  }
}

function safeBundleSegment(path) {
  const segment = basename(path)
  if (!/^[a-z0-9-]{16,}$/.test(segment)) fail('BUNDLE_PATH_CONTAINMENT', segment)
  return segment
}

async function createExclusiveBundleDirectory(bundleParent) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const candidate = resolve(bundleParent, `bundle-${randomBytes(16).toString('hex')}`)
    try {
      await mkdir(candidate, { mode: 0o700 })
      return candidate
    } catch (error) {
      if (error?.code === 'EEXIST') continue
      throw error
    }
  }
  fail('BUNDLE_DIRECTORY_COLLISION', 'bundle directory')
}

async function writeReadOnlyPointerTemp(pointerParentBoundary, pointerBytes) {
  if (pointerBytes.length > POINTER_MAX_BYTES) fail('POINTER_SIZE_LIMIT', 'pointer')
  await assertBoundDirectory(pointerParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'pointer parent')
  const temporary = resolve(
    pointerParentBoundary.path,
    `.declaration-input-source-${randomBytes(16).toString('hex')}.tmp`,
  )
  let handle
  try {
    handle = await open(
      temporary,
      fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o444,
    )
    const beforeWrite = await handle.stat()
    if (!beforeWrite.isFile() || beforeWrite.nlink !== 1
      || beforeWrite.size !== 0 || !isOwnerReadableReadOnlyMode(beforeWrite.mode)) {
      fail('POINTER_TEMP_WRITE_FAILED', 'pointer temporary identity')
    }
    await handle.writeFile(pointerBytes)
    await handle.sync()
    const afterWrite = await handle.stat()
    if (!afterWrite.isFile() || afterWrite.dev !== beforeWrite.dev
      || afterWrite.ino !== beforeWrite.ino || afterWrite.nlink !== 1
      || afterWrite.size !== pointerBytes.length || !isOwnerReadableReadOnlyMode(afterWrite.mode)) {
      fail('POINTER_TEMP_WRITE_FAILED', 'pointer temporary identity')
    }
  } catch (error) {
    if (error?.code) fail('POINTER_TEMP_WRITE_FAILED', 'pointer temporary')
    throw error
  } finally {
    await handle?.close()
  }
  const verify = await readBoundSourceFile(
    temporary,
    'POINTER_TEMP_WRITE_FAILED',
    POINTER_MAX_BYTES,
    'POINTER_SIZE_LIMIT',
    'pointer temporary',
    { writableCode: 'POINTER_TEMP_WRITE_FAILED' },
  )
  if (!verify.bytes.equals(pointerBytes)) {
    fail('POINTER_TEMP_WRITE_FAILED', 'pointer reopen')
  }
  await assertBoundDirectory(pointerParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'pointer parent')
  return { path: temporary, identity: verify.identity }
}

async function readStablePointer(pointerPath) {
  let snapshot
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      snapshot = await readBoundSourceFile(
        pointerPath,
        'STABLE_POINTER_CONFLICT',
        POINTER_MAX_BYTES,
        'STABLE_POINTER_CONFLICT',
        'stable pointer',
        {
          symlinkCode: 'STABLE_POINTER_CONFLICT',
          specialCode: 'STABLE_POINTER_CONFLICT',
          hardlinkCode: 'STABLE_POINTER_CONFLICT',
          writableCode: 'STABLE_POINTER_CONFLICT',
          allowedLinkCounts: [1, 2],
        },
      )
      break
    } catch (error) {
      if (error?.code !== 'SOURCE_FILE_IDENTITY_CHANGED' || attempt === 2) throw error
    }
  }
  const { bytes, identity } = snapshot
  if (!isOwnerReadableReadOnlyMode(identity.mode)) {
    fail('STABLE_POINTER_LINK_STATE', 'stable pointer mode')
  }
  let value
  try {
    value = JSON.parse(bytes.toString('utf8'))
  } catch {
    fail('STABLE_POINTER_CONFLICT', 'pointer json')
  }
  if (!isObject(value) || canonicalJsonBytes(value) + '\n' !== bytes.toString('utf8')) fail('STABLE_POINTER_CONFLICT', 'pointer canonical')
  assertPublishedPointerShape(value)
  return { bytes, identity, value }
}

async function convergeStablePointerLinkCount(pointerParentBoundary, pointerPath, stable) {
  if (stable.identity.nlink === 1) return stable
  if (stable.identity.nlink !== 2) fail('STABLE_POINTER_LINK_STATE', 'stable pointer link count')
  await assertBoundDirectory(pointerParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'pointer parent')
  const matchingAliases = []
  for (const name of await readdirWithStableMissingCode(
    pointerParentBoundary.path,
    'STABLE_POINTER_LINK_STATE',
  )) {
    if (!/^\.declaration-input-source-[a-f0-9]{32}\.tmp$/.test(name)) continue
    const aliasPath = resolve(pointerParentBoundary.path, name)
    let entry
    try {
      entry = await lstat(aliasPath)
    } catch (error) {
      if (error?.code === 'ENOENT') continue
      fail('STABLE_POINTER_LINK_STATE', 'pointer temporary alias')
    }
    if (entry.dev !== stable.identity.dev || entry.ino !== stable.identity.ino) continue
    if (!entry.isFile() || entry.isSymbolicLink() || (entry.mode & 0o222) !== 0
      || ![1, 2].includes(entry.nlink)) {
      fail('STABLE_POINTER_LINK_STATE', 'pointer temporary alias identity')
    }
    matchingAliases.push({ path: aliasPath, identity: stable.identity })
  }
  if (matchingAliases.length !== 1) {
    const reread = await readStablePointer(pointerPath)
    if (reread.identity.dev === stable.identity.dev
      && reread.identity.ino === stable.identity.ino
      && reread.identity.nlink === 1
      && reread.bytes.equals(stable.bytes)) {
      return reread
    }
    fail('STABLE_POINTER_LINK_STATE', 'stable pointer alias count')
  }
  await unlinkOwnedPointerTemporary(
    matchingAliases[0],
    'POINTER_RESIDUE_CLEANUP_FAILED',
  )
  const converged = await readStablePointer(pointerPath)
  if (converged.identity.dev !== stable.identity.dev
    || converged.identity.ino !== stable.identity.ino
    || converged.identity.nlink !== 1
    || !converged.bytes.equals(stable.bytes)) {
    fail('POINTER_RESIDUE_CLEANUP_FAILED', 'stable pointer convergence')
  }
  await assertBoundDirectory(pointerParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'pointer parent')
  return converged
}

function assertPublishedPointerShape(pointer) {
  assertExactKeys(pointer, [
    'bundleRelativePath',
    'receiptRelativePath',
    'receiptSha256',
    'schemaVersion',
  ], 'published pointer')
  if (pointer.schemaVersion !== '2'
    || typeof pointer.bundleRelativePath !== 'string'
    || !/^declaration-input-source-bundles\/bundle-[a-f0-9]{32}$/.test(pointer.bundleRelativePath)
    || pointer.receiptRelativePath !== `${pointer.bundleRelativePath}/receipt.json`
    || typeof pointer.receiptSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(pointer.receiptSha256)) {
    fail('BUNDLE_RECEIPT_MISMATCH', 'pointer')
  }
}

function assertPublishedDescriptorShape(descriptor, expectedDescriptor) {
  assertExactKeys(descriptor, [
    'schemaVersion',
    'inputLabel',
    'authorizationBasis',
    'packageJsonRawSha256',
    'packageJsonCanonicalSha256',
    'packageLockRawSha256',
    'packageLockCanonicalSha256',
    'lockProjectionSha256',
    'selectedCacheIndexSha256',
    'selectedContentAggregateSha256',
    'selectedCacheRelativePath',
    'packageCounts',
    'selectedCount',
    'selectedBytes',
    'uniqueIndexFileCount',
    'uniqueContentFileCount',
  ], 'published descriptor')
  assertExactKeys(descriptor.packageCounts, ['registry', 'deepseek', 'dsh'], 'published descriptor package counts')
  if (descriptor.schemaVersion !== '2' || descriptor.selectedCacheRelativePath !== '_cacache') {
    fail('BUNDLE_RECEIPT_MISMATCH', 'descriptor version')
  }
  for (const key of [
    'packageJsonRawSha256',
    'packageJsonCanonicalSha256',
    'packageLockRawSha256',
    'packageLockCanonicalSha256',
    'lockProjectionSha256',
    'selectedCacheIndexSha256',
    'selectedContentAggregateSha256',
  ]) {
    if (typeof descriptor[key] !== 'string' || !/^[a-f0-9]{64}$/.test(descriptor[key])) {
      fail('BUNDLE_RECEIPT_MISMATCH', `descriptor ${key}`)
    }
  }
  for (const key of ['selectedCount', 'selectedBytes', 'uniqueIndexFileCount', 'uniqueContentFileCount']) {
    if (!Number.isSafeInteger(descriptor[key]) || descriptor[key] < 0) {
      fail('BUNDLE_RECEIPT_MISMATCH', `descriptor ${key}`)
    }
  }
  assertSafeManifestStrings(descriptor, 'published descriptor')
  if (canonicalJsonBytes(descriptor) !== canonicalJsonBytes(expectedDescriptor)) {
    fail('BUNDLE_RECEIPT_MISMATCH', 'descriptor identity')
  }
}

function assertPublishedPayloadShape(payload, expectedEntries) {
  const expectedFiles = new Set(['selected-source.json'])
  const expectedDirectories = new Set(['.'])
  for (const entry of expectedEntries) {
    const indexPath = `_cacache/${relativeCachePath('_cacache', cacheIndexPath('_cacache', entry.key))}`
    const contentPath = `_cacache/${relativeCachePath('_cacache', integrityToContentPath('_cacache', entry.integrity))}`
    expectedFiles.add(indexPath)
    expectedFiles.add(contentPath)
    addDirectoryAncestors(expectedDirectories, indexPath)
    addDirectoryAncestors(expectedDirectories, contentPath)
  }
  const actualFiles = new Set()
  const actualDirectories = new Set()
  for (const record of payload) {
    if (!isObject(record) || typeof record.path !== 'string'
      || record.path.startsWith('/') || record.path.includes('\\')
      || record.path === '..' || record.path.startsWith('../') || record.path.includes('/../')) {
      fail('BUNDLE_RECEIPT_MISMATCH', 'payload path')
    }
    if (record.type === 'directory') {
      assertExactKeys(record, ['path', 'type', 'mode'], 'published directory payload')
      if (record.mode !== 0o555 || actualDirectories.has(record.path)) {
        fail('BUNDLE_RECEIPT_MISMATCH', 'directory payload')
      }
      actualDirectories.add(record.path)
    } else if (record.type === 'file') {
      assertExactKeys(record, ['path', 'type', 'mode', 'size', 'sha256'], 'published file payload')
      if (record.mode !== 0o444 || !Number.isSafeInteger(record.size) || record.size < 0
        || typeof record.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(record.sha256)
        || actualFiles.has(record.path)) {
        fail('BUNDLE_RECEIPT_MISMATCH', 'file payload')
      }
      actualFiles.add(record.path)
    } else {
      fail('BUNDLE_RECEIPT_MISMATCH', 'payload type')
    }
  }
  const sameSet = (actual, expected) => actual.size === expected.size && [...actual].every((value) => expected.has(value))
  if (!sameSet(actualFiles, expectedFiles) || !sameSet(actualDirectories, expectedDirectories)) {
    fail('BUNDLE_RECEIPT_MISMATCH', 'payload inventory')
  }
}

function assertPublishedPayloadIdentity(payload, expectedDescriptor, expectedEntries) {
  const expectedFiles = new Map()
  const register = (path, bytes) => {
    const identity = { mode: 0o444, size: bytes.length, sha256: sha256(bytes) }
    const previous = expectedFiles.get(path)
    if (previous && canonicalJsonBytes(previous) !== canonicalJsonBytes(identity)) {
      fail('BUNDLE_RECEIPT_MISMATCH', 'expected payload collision')
    }
    expectedFiles.set(path, identity)
  }
  register('selected-source.json', Buffer.from(`${canonicalJsonBytes(expectedDescriptor)}\n`, 'utf8'))
  for (const entry of expectedEntries) {
    register(
      `_cacache/${relativeCachePath('_cacache', cacheIndexPath('_cacache', entry.key))}`,
      Buffer.from(entry.frozenIndexRaw, 'utf8'),
    )
    register(
      `_cacache/${relativeCachePath('_cacache', integrityToContentPath('_cacache', entry.integrity))}`,
      entry.contentBytes,
    )
  }
  const actualFiles = payload.filter((record) => record.type === 'file')
  if (actualFiles.length !== expectedFiles.size) fail('BUNDLE_RECEIPT_MISMATCH', 'payload file count')
  for (const record of actualFiles) {
    const expected = expectedFiles.get(record.path)
    if (!expected || record.mode !== expected.mode || record.size !== expected.size || record.sha256 !== expected.sha256) {
      fail('BUNDLE_RECEIPT_MISMATCH', 'payload file identity')
    }
  }
}

function buildPublicationDescriptor({ sourceSnapshot, lockModel, publicationIdentity }) {
  const selectedHashes = computeSelectedCacheHashes(sourceSnapshot.entries)
  return {
    schemaVersion: '2',
    inputLabel: publicationIdentity.inputLabel,
    authorizationBasis: publicationIdentity.authorizationBasis,
    packageJsonRawSha256: publicationIdentity.packageJsonRawSha256,
    packageJsonCanonicalSha256: publicationIdentity.packageJsonCanonicalSha256,
    packageLockRawSha256: publicationIdentity.packageLockRawSha256,
    packageLockCanonicalSha256: publicationIdentity.packageLockCanonicalSha256,
    lockProjectionSha256: lockModel.sha256,
    selectedCacheIndexSha256: selectedHashes.selectedCacheIndexSha256,
    selectedContentAggregateSha256: selectedHashes.selectedContentAggregateSha256,
    selectedCacheRelativePath: '_cacache',
    packageCounts: publicationIdentity.packageCounts,
    selectedCount: sourceSnapshot.entries.length,
    selectedBytes: sourceSnapshot.totalBytes,
    uniqueIndexFileCount: lockModel.expected.uniqueIndexFileCount,
    uniqueContentFileCount: lockModel.expected.uniqueContentFileCount,
  }
}

async function pathExistsWithoutFollowing(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    fail('STABLE_POINTER_CONFLICT', 'stable pointer access')
  }
}

async function verifyPublishedBundle({
  workspaceRoot,
  bundleParentBoundary,
  pointer,
  expectedDescriptor,
  expectedEntries,
}) {
  if (!isObject(pointer)) fail('BUNDLE_RECEIPT_MISMATCH', 'pointer')
  assertPublishedPointerShape(pointer)
  await assertBoundDirectory(bundleParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle parent')
  const paths = fixtureBundlePaths(workspaceRoot)
  const bundleRoot = resolve(paths.pointerParent, pointer.bundleRelativePath)
  const relativeBundle = relative(paths.bundleParent, bundleRoot)
  if (!/^bundle-[a-f0-9]{32}$/.test(relativeBundle) || relativeBundle.includes(sep)) {
    fail('BUNDLE_PATH_CONTAINMENT', 'published bundle')
  }
  const bundleBoundary = await openBoundDirectory(bundleRoot, 'BUNDLE_PATH_CONTAINMENT', 'published bundle')
  try {
    if (bundleBoundary.canonicalPath
      !== resolve(bundleParentBoundary.canonicalPath, relativeBundle)) {
      fail('BUNDLE_PATH_CONTAINMENT', 'published bundle relationship')
    }
    const readPublishedFile = async (path, label) => (await readBoundSourceFile(
      path,
      'BUNDLE_RECEIPT_MISMATCH',
      CACHE_CONTENT_MAX_BYTES,
      'BUNDLE_RECEIPT_MISMATCH',
      label,
      {
        symlinkCode: 'BUNDLE_RECEIPT_MISMATCH',
        specialCode: 'BUNDLE_RECEIPT_MISMATCH',
        hardlinkCode: 'BUNDLE_RECEIPT_MISMATCH',
        writableCode: 'BUNDLE_RECEIPT_MISMATCH',
      },
    )).bytes
    const receiptBytes = await readPublishedFile(resolve(bundleRoot, 'receipt.json'), 'published receipt')
    if (sha256(receiptBytes) !== pointer.receiptSha256) fail('BUNDLE_RECEIPT_MISMATCH', 'receipt hash')
    let receipt
    try {
      receipt = JSON.parse(receiptBytes.toString('utf8'))
    } catch {
      fail('BUNDLE_RECEIPT_MISMATCH', 'receipt json')
    }
    if (!isObject(receipt) || `${canonicalJsonBytes(receipt)}\n` !== receiptBytes.toString('utf8')) {
      fail('BUNDLE_RECEIPT_MISMATCH', 'receipt shape')
    }
    assertExactKeys(receipt, [
      'ownerMarker',
      'payload',
      'payloadIdentitySha256',
      'result',
      'selectedBytes',
      'selectedCount',
    ], 'published receipt')
    if (receipt.result !== 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION'
      || typeof receipt.ownerMarker !== 'string' || !/^[a-f0-9]{32}$/.test(receipt.ownerMarker)
      || typeof receipt.payloadIdentitySha256 !== 'string' || !/^[a-f0-9]{64}$/.test(receipt.payloadIdentitySha256)
      || receipt.selectedCount !== expectedDescriptor.selectedCount
      || receipt.selectedBytes !== expectedDescriptor.selectedBytes
      || !Array.isArray(receipt.payload)) {
      fail('BUNDLE_RECEIPT_MISMATCH', 'receipt summary')
    }
    const owner = await readPublishedFile(resolve(bundleRoot, '.owner'), 'published owner')
    if (owner.toString('utf8') !== receipt.ownerMarker) fail('BUNDLE_RECEIPT_MISMATCH', 'owner marker')
    const actualPayload = (await inventoryBundlePayload(bundleRoot))
      .filter((record) => record.path !== '.owner' && record.path !== 'receipt.json')
    assertPublishedPayloadShape(actualPayload, expectedEntries)
    assertPublishedPayloadIdentity(actualPayload, expectedDescriptor, expectedEntries)
    if (canonicalJsonBytes(actualPayload) !== canonicalJsonBytes(receipt.payload)
      || sha256(canonicalJsonBytes(actualPayload)) !== receipt.payloadIdentitySha256) {
      fail('BUNDLE_RECEIPT_MISMATCH', 'payload')
    }
    const descriptorBytes = await readPublishedFile(
      resolve(bundleRoot, 'selected-source.json'),
      'published descriptor',
    )
    let descriptor
    try {
      descriptor = JSON.parse(descriptorBytes.toString('utf8'))
    } catch {
      fail('BUNDLE_RECEIPT_MISMATCH', 'descriptor json')
    }
    if (!isObject(descriptor) || `${canonicalJsonBytes(descriptor)}\n` !== descriptorBytes.toString('utf8')) {
      fail('BUNDLE_RECEIPT_MISMATCH', 'descriptor canonical')
    }
    assertPublishedDescriptorShape(descriptor, expectedDescriptor)
    await assertBoundDirectory(bundleBoundary, 'BUNDLE_PATH_CONTAINMENT', 'published bundle')
    await assertBoundDirectory(bundleParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle parent')
    return { bundleRoot, descriptor, receipt }
  } finally {
    await bundleBoundary.handle.close().catch(() => {})
  }
}

async function prepareSelectedSourceCore({ workspaceRoot, workspaceBoundary, sourceCacheRoot, lockModel, publicationIdentity } = {}) {
  const paths = fixtureBundlePaths(workspaceRoot)
  await assertDescendantDirectoryChain(workspaceBoundary, paths.pointerParent, {
    code: 'BUNDLE_PATH_CONTAINMENT',
    missingCode: 'BUNDLE_PATH_CONTAINMENT',
    logicalLabel: 'pointer parent',
    includeLeafDirectory: true,
  })
  const pointerParentBoundary = await openBoundDirectory(
    paths.pointerParent,
    'BUNDLE_PATH_CONTAINMENT',
    'pointer parent',
  )
  let bundleParentBoundary
  let bundleBoundary
  let bundleRoot
  let pointerTemporary
  let ownerMarker
  let publicationState = 'INITIAL'
  try {
    await assertBoundDirectory(workspaceBoundary, 'BUNDLE_PATH_CONTAINMENT', 'workspace root')
    if (await pathExistsWithoutFollowing(paths.pointerPath)) {
      const stable = await readStablePointer(paths.pointerPath)
      await assertDescendantDirectoryChain(pointerParentBoundary, paths.bundleParent, {
        code: 'BUNDLE_PATH_CONTAINMENT',
        missingCode: 'STABLE_POINTER_CONFLICT',
        logicalLabel: 'bundle parent',
        includeLeafDirectory: true,
      })
      bundleParentBoundary = await openBoundDirectory(
        paths.bundleParent,
        'BUNDLE_PATH_CONTAINMENT',
        'bundle parent',
      )
      const bundleRoot = resolve(paths.pointerParent, stable.value.bundleRelativePath)
      const relativeBundle = relative(paths.bundleParent, bundleRoot)
      if (!/^bundle-[a-f0-9]{32}$/.test(relativeBundle) || relativeBundle.includes(sep)) {
        fail('BUNDLE_PATH_CONTAINMENT', 'published bundle')
      }
      const publishedBundleBoundary = await openBoundDirectory(
        bundleRoot,
        'BUNDLE_PATH_CONTAINMENT',
        'published bundle',
      )
      let publishedSnapshot
      try {
        if (publishedBundleBoundary.canonicalPath
          !== resolve(bundleParentBoundary.canonicalPath, relativeBundle)) {
          fail('BUNDLE_PATH_CONTAINMENT', 'published bundle relationship')
        }
        const publishedCacheRoot = resolve(bundleRoot, '_cacache')
        await assertDescendantDirectoryChain(publishedBundleBoundary, publishedCacheRoot, {
          code: 'BUNDLE_RECEIPT_MISMATCH',
          missingCode: 'BUNDLE_RECEIPT_MISMATCH',
          logicalLabel: 'published cache root',
          includeLeafDirectory: true,
        })
        publishedSnapshot = await snapshotPublishedSelectedCache({
          cacheRoot: publishedCacheRoot,
          lockModel,
        })
        await assertBoundDirectory(
          publishedBundleBoundary,
          'BUNDLE_PATH_CONTAINMENT',
          'published bundle',
        )
      } finally {
        await publishedBundleBoundary.handle.close().catch(() => {})
      }
      const descriptor = buildPublicationDescriptor({
        sourceSnapshot: publishedSnapshot,
        lockModel,
        publicationIdentity,
      })
      const verifiedExisting = await verifyPublishedBundle({
        workspaceRoot,
        bundleParentBoundary,
        pointer: stable.value,
        expectedDescriptor: descriptor,
        expectedEntries: publishedSnapshot.entries,
      })
      const convergedStable = await convergeStablePointerLinkCount(
        pointerParentBoundary,
        paths.pointerPath,
        stable,
      )
      await assertPublicationBoundaries({
        workspaceBoundary,
        pointerParentBoundary,
        bundleParentBoundary,
      })
      publicationState = 'COMPLETE'
      return {
        status: 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION',
        pointer: convergedStable.value,
        descriptor: verifiedExisting.descriptor,
      }
    }
    const sourceBefore = await snapshotSelectedCacheForTransfer({ cacheRoot: sourceCacheRoot, lockModel })
    const sourceInodes = new Set(sourceBefore.entries.flatMap((entry) => [
      `${entry.indexIdentity.dev}:${entry.indexIdentity.ino}`,
      `${entry.contentIdentity.dev}:${entry.contentIdentity.ino}`,
    ]))
    await assertBoundDirectory(pointerParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'pointer parent')
    await ensureDescendantDirectoryChain(
      pointerParentBoundary,
      paths.bundleParent,
      'BUNDLE_PATH_CONTAINMENT',
      'bundle parent',
    )
    bundleParentBoundary = await openBoundDirectory(
      paths.bundleParent,
      'BUNDLE_PATH_CONTAINMENT',
      'bundle parent',
    )
    await assertBoundDirectory(workspaceBoundary, 'BUNDLE_PATH_CONTAINMENT', 'workspace root')
    await assertBoundDirectory(bundleParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle parent')
    bundleRoot = await createExclusiveBundleDirectory(paths.bundleParent)
    const segment = safeBundleSegment(bundleRoot)
    await assertBoundDirectory(bundleParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle parent')
    bundleBoundary = await openBoundDirectory(bundleRoot, 'BUNDLE_PATH_CONTAINMENT', 'bundle root')
    if (bundleBoundary.canonicalPath !== resolve(bundleParentBoundary.canonicalPath, segment)) {
      fail('BUNDLE_PATH_CONTAINMENT', 'bundle root')
    }
    publicationState = 'OWNED_BUILDING'
    ownerMarker = randomBytes(16).toString('hex')
    await writeBundleFile(resolve(bundleRoot, '.owner'), Buffer.from(ownerMarker, 'utf8'))
    const descriptor = buildPublicationDescriptor({
      sourceSnapshot: sourceBefore,
      lockModel,
      publicationIdentity,
    })
    await writeBundleFile(resolve(bundleRoot, 'selected-source.json'), Buffer.from(`${canonicalJsonBytes(descriptor)}\n`, 'utf8'))
    for (const entry of sourceBefore.entries) {
      const indexTarget = cacheIndexPath(resolve(bundleRoot, '_cacache'), entry.key)
      const contentTarget = integrityToContentPath(resolve(bundleRoot, '_cacache'), entry.integrity)
      await ensureDescendantDirectoryChain(
        bundleBoundary,
        dirname(indexTarget),
        'BUNDLE_PATH_CONTAINMENT',
        'bundle index parent',
      )
      await ensureDescendantDirectoryChain(
        bundleBoundary,
        dirname(contentTarget),
        'BUNDLE_PATH_CONTAINMENT',
        'bundle content parent',
      )
      const indexIdentity = await writeBundleFile(indexTarget, Buffer.from(entry.frozenIndexRaw, 'utf8'))
      const contentIdentity = await writeBundleFile(contentTarget, entry.contentBytes)
      if (sourceInodes.has(`${indexIdentity.dev}:${indexIdentity.ino}`)
        || sourceInodes.has(`${contentIdentity.dev}:${contentIdentity.ino}`)
        || indexIdentity.dev === contentIdentity.dev && indexIdentity.ino === contentIdentity.ino) {
        fail('BUNDLE_SOURCE_TARGET_INODE_OVERLAP', entry.lockPath)
      }
    }
    await assertBoundDirectory(bundleBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle root')
    await makeTreeReadOnlyStrict(bundleRoot)
    await assertBoundDirectory(bundleBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle root')
    publicationState = 'OWNED_SEALED'
    const payload = (await inventoryBundlePayload(bundleRoot)).filter((record) => record.path !== '.owner')
    const payloadIdentitySha256 = sha256(canonicalJsonBytes(payload))
    const receipt = {
      result: 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION',
      ownerMarker,
      payloadIdentitySha256,
      selectedCount: sourceBefore.entries.length,
      selectedBytes: sourceBefore.totalBytes,
      payload,
    }
    const receiptBytes = Buffer.from(`${canonicalJsonBytes(receipt)}\n`, 'utf8')
    await bundleBoundary.handle.chmod(0o700)
    await assertBoundDirectory(bundleBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle root')
    await writeBundleFile(resolve(bundleRoot, 'receipt.json'), receiptBytes)
    await makeTreeReadOnlyStrict(bundleRoot)
    await assertBoundDirectory(bundleBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle root')
    const receiptSha256 = sha256(receiptBytes)
    const pointer = {
      bundleRelativePath: `declaration-input-source-bundles/${segment}`,
      receiptRelativePath: `declaration-input-source-bundles/${segment}/receipt.json`,
      receiptSha256,
      schemaVersion: '2',
    }
    const pointerBytes = Buffer.from(`${canonicalJsonBytes(pointer)}\n`, 'utf8')
    await verifyPublishedBundle({
      workspaceRoot,
      bundleParentBoundary,
      pointer,
      expectedDescriptor: descriptor,
      expectedEntries: sourceBefore.entries,
    })
    await assertPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    pointerTemporary = await writeReadOnlyPointerTemp(pointerParentBoundary, pointerBytes)
    publicationState = 'POINTER_TEMP_READY'
    await assertPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    let adoptedExisting
    try {
      await link(pointerTemporary.path, paths.pointerPath)
      publicationState = 'PUBLISHED_OWN'
    } catch (error) {
      if (error?.code === 'EEXIST') {
        const existing = await readStablePointer(paths.pointerPath)
        let verifiedExisting
        try {
          verifiedExisting = await verifyPublishedBundle({
            workspaceRoot,
            bundleParentBoundary,
            pointer: existing.value,
            expectedDescriptor: descriptor,
            expectedEntries: sourceBefore.entries,
          })
        } catch {
          fail('STABLE_POINTER_CONFLICT', 'stable pointer exists')
        }
        const converged = await convergeStablePointerLinkCount(
          pointerParentBoundary,
          paths.pointerPath,
          existing,
        )
        adoptedExisting = { stable: converged, verified: verifiedExisting }
      } else {
        let stableAfterError
        try {
          if (await pathExistsWithoutFollowing(paths.pointerPath)) {
            stableAfterError = await readStablePointer(paths.pointerPath)
          }
        } catch {
          publicationState = 'PUBLICATION_UNKNOWN'
          fail('POINTER_COMMIT_UNCERTAIN', 'stable pointer probe')
        }
        if (!stableAfterError) {
          let temporaryAfterError
          try {
            temporaryAfterError = await readBoundSourceFile(
              pointerTemporary.path,
              'POINTER_COMMIT_UNCERTAIN',
              POINTER_MAX_BYTES,
              'POINTER_COMMIT_UNCERTAIN',
              'pointer temporary after link error',
              {
                hardlinkCode: 'POINTER_COMMIT_UNCERTAIN',
                writableCode: 'POINTER_COMMIT_UNCERTAIN',
              },
            )
          } catch {
            publicationState = 'PUBLICATION_UNKNOWN'
            fail('POINTER_COMMIT_UNCERTAIN', 'pointer temporary probe')
          }
          if (temporaryAfterError.identity.dev === pointerTemporary.identity.dev
            && temporaryAfterError.identity.ino === pointerTemporary.identity.ino
            && temporaryAfterError.identity.nlink === 1
            && temporaryAfterError.bytes.equals(pointerBytes)) {
            fail('POINTER_COMMIT_FAILED', 'stable pointer link')
          }
          publicationState = 'PUBLICATION_UNKNOWN'
          fail('POINTER_COMMIT_UNCERTAIN', 'pointer link state')
        }
        if (stableAfterError.bytes.equals(pointerBytes)
          && stableAfterError.identity.dev === pointerTemporary.identity.dev
          && stableAfterError.identity.ino === pointerTemporary.identity.ino) {
          publicationState = 'PUBLISHED_OWN'
        } else {
          let verifiedExisting
          try {
            verifiedExisting = await verifyPublishedBundle({
              workspaceRoot,
              bundleParentBoundary,
              pointer: stableAfterError.value,
              expectedDescriptor: descriptor,
              expectedEntries: sourceBefore.entries,
            })
          } catch {
            publicationState = 'PUBLICATION_UNKNOWN'
            fail('POINTER_COMMIT_UNCERTAIN', 'unexpected stable pointer')
          }
          const converged = await convergeStablePointerLinkCount(
            pointerParentBoundary,
            paths.pointerPath,
            stableAfterError,
          )
          adoptedExisting = { stable: converged, verified: verifiedExisting }
        }
      }
    }
    if (adoptedExisting) {
      publicationState = 'ADOPTED_EXISTING'
      await unlinkOwnedPointerTemporary(pointerTemporary, 'POINTER_RESIDUE_CLEANUP_FAILED')
      pointerTemporary = undefined
      await cleanupOwnedUnpublishedBundle({
        workspaceBoundary,
        pointerParentBoundary,
        bundleParentBoundary,
        bundleBoundary,
        bundleRoot,
        ownerMarker,
      })
      bundleBoundary = undefined
      bundleRoot = undefined
      publicationState = 'COMPLETE'
      return {
        status: 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION',
        pointer: adoptedExisting.stable.value,
        descriptor: adoptedExisting.verified.descriptor,
      }
    }
    await assertPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    const stable = await readStablePointer(paths.pointerPath)
    if (!stable.bytes.equals(pointerBytes)
      || stable.identity.dev !== pointerTemporary.identity.dev
      || stable.identity.ino !== pointerTemporary.identity.ino) {
      fail('POINTER_COMMIT_UNCERTAIN', 'stable pointer identity')
    }
    await verifyPublishedBundle({
      workspaceRoot,
      bundleParentBoundary,
      pointer: stable.value,
      expectedDescriptor: descriptor,
      expectedEntries: sourceBefore.entries,
    })
    await unlinkOwnedPointerTemporary(pointerTemporary, 'POINTER_RESIDUE_CLEANUP_FAILED')
    pointerTemporary = undefined
    const stableAfterCleanup = await readStablePointer(paths.pointerPath)
    if (!stableAfterCleanup.bytes.equals(pointerBytes) || stableAfterCleanup.identity.nlink !== 1) {
      fail('POINTER_RESIDUE_CLEANUP_FAILED', 'stable pointer link count')
    }
    await assertPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    publicationState = 'COMPLETE'
    return { status: 'PASS_SELECTED_SOURCE_BUNDLE_PREPARATION', pointer, descriptor, bundleRoot }
  } catch (error) {
    if (!['PUBLISHED_OWN', 'ADOPTED_EXISTING', 'PUBLICATION_UNKNOWN', 'COMPLETE'].includes(publicationState)) {
      if (pointerTemporary) {
        await unlinkOwnedPointerTemporary(pointerTemporary, 'POINTER_RESIDUE_CLEANUP_FAILED')
        pointerTemporary = undefined
      }
      if (bundleRoot && bundleBoundary && bundleParentBoundary && ownerMarker) {
        await cleanupOwnedUnpublishedBundle({
          workspaceBoundary,
          pointerParentBoundary,
          bundleParentBoundary,
          bundleBoundary,
          bundleRoot,
          ownerMarker,
        })
        bundleBoundary = undefined
        bundleRoot = undefined
      }
    }
    throw error
  } finally {
    await bundleBoundary?.handle.close().catch(() => {})
    await bundleParentBoundary?.handle.close().catch(() => {})
    await pointerParentBoundary.handle.close().catch(() => {})
  }
}

// Deliberately narrow production entrypoint: no caller-controlled final root,
// cache root, test switch, or lock-model bypass.  It remains unreachable while
// the committed schema-v1 gate is pending B2, so this task does not perform a
// historical preparation merely by loading the module.
export async function prepareSelectedSource({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
  if (arguments[0] === null || !isObject(arguments[0])
    || Object.keys(arguments[0]).length !== 1 || !Object.hasOwn(arguments[0], 'workspaceRoot')) {
    fail('PREPARE_OPTIONS_MISMATCH', 'prepareSelectedSource options')
  }
  const workspaceBoundary = await openBoundDirectory(
    workspaceRoot,
    'BUNDLE_PATH_CONTAINMENT',
    'workspace root',
  )
  try {
    const candidateRoot = resolve(workspaceRoot, '.tmp/dsh-pm-workbench/declaration-input-candidate')
    await assertDescendantDirectoryChain(workspaceBoundary, candidateRoot, {
      code: 'BUNDLE_PATH_CONTAINMENT',
      missingCode: 'INVALID_CANDIDATE_ROOT',
      logicalLabel: 'candidate root',
      includeLeafDirectory: true,
    })
    const candidateBoundary = await openBoundDirectory(
      candidateRoot,
      'INVALID_CANDIDATE_ROOT',
      'candidate root',
    )
    let candidateFile
    let packageFile
    let lockFile
    try {
      ;[candidateFile, packageFile, lockFile] = await Promise.all([
        readJsonFile(resolve(candidateRoot, 'candidate.json')),
        readJsonFile(resolve(candidateRoot, 'package.json')),
        readJsonFile(resolve(candidateRoot, 'package-lock.json')),
      ])
      await assertBoundDirectory(candidateBoundary, 'BUNDLE_PATH_CONTAINMENT', 'candidate root')
    } finally {
      await candidateBoundary.handle.close()
    }
    assertProductionCandidateShape(candidateFile.value)
    assertCandidateShape(candidateFile.value, packageFile.value, lockFile.value)
    if (typeof candidateFile.value.sourceCacheRoot !== 'string') fail('INVALID_SOURCE_CACHE', 'candidate source cache')
    const sourceCacheRoot = candidateFile.value.sourceCacheRoot
    const lockModel = deriveCanonicalLockInput(packageFile.value, lockFile.value)
    const publicationIdentity = {
      inputLabel: candidateFile.value.label,
      authorizationBasis: candidateFile.value.authorizationBasis,
      packageJsonRawSha256: packageFile.rawSha256,
      packageJsonCanonicalSha256: packageFile.canonicalSha256,
      packageLockRawSha256: lockFile.rawSha256,
      packageLockCanonicalSha256: lockFile.canonicalSha256,
      packageCounts: {
        registry: EXPECTED.registryPackageCount,
        deepseek: EXPECTED.deepseekPackageCount,
        dsh: EXPECTED.dshPackageCount,
      },
    }
    const { status, pointer, descriptor } = await prepareSelectedSourceCore({
      workspaceRoot,
      workspaceBoundary,
      sourceCacheRoot,
      lockModel,
      publicationIdentity,
    })
    return { status, pointer, descriptor }
  } finally {
    await workspaceBoundary.handle.close()
  }
}

async function consumeSelectedSourcePublication({
  workspaceRoot,
  lockModel,
  publicationIdentity,
}) {
  const paths = fixtureBundlePaths(workspaceRoot)
  const workspaceBoundary = await openBoundDirectory(
    workspaceRoot,
    'BUNDLE_PATH_CONTAINMENT',
    'workspace root',
  )
  let pointerParentBoundary
  let bundleParentBoundary
  try {
    await assertDescendantDirectoryChain(workspaceBoundary, paths.pointerParent, {
      code: 'BUNDLE_PATH_CONTAINMENT',
      missingCode: 'STABLE_POINTER_REQUIRED',
      logicalLabel: 'pointer parent',
      includeLeafDirectory: true,
    })
    pointerParentBoundary = await openBoundDirectory(
      paths.pointerParent,
      'BUNDLE_PATH_CONTAINMENT',
      'pointer parent',
    )
    const stable = await readStablePointer(paths.pointerPath)
    if (stable.identity.nlink !== 1) {
      fail('STABLE_POINTER_LINK_STATE', 'consumer requires a converged stable pointer')
    }
    await assertDescendantDirectoryChain(pointerParentBoundary, paths.bundleParent, {
      code: 'BUNDLE_PATH_CONTAINMENT',
      missingCode: 'STABLE_POINTER_REQUIRED',
      logicalLabel: 'bundle parent',
      includeLeafDirectory: true,
    })
    bundleParentBoundary = await openBoundDirectory(
      paths.bundleParent,
      'BUNDLE_PATH_CONTAINMENT',
      'bundle parent',
    )
    const bundleRoot = resolve(paths.pointerParent, stable.value.bundleRelativePath)
    const relativeBundle = relative(paths.bundleParent, bundleRoot)
    if (!/^bundle-[a-f0-9]{32}$/.test(relativeBundle) || relativeBundle.includes(sep)) {
      fail('BUNDLE_PATH_CONTAINMENT', 'published bundle')
    }
    const cacheRoot = resolve(bundleRoot, '_cacache')
    const snapshot = await snapshotPublishedSelectedCache({ cacheRoot, lockModel })
    const descriptor = buildPublicationDescriptor({
      sourceSnapshot: snapshot,
      lockModel,
      publicationIdentity,
    })
    const verified = await verifyPublishedBundle({
      workspaceRoot,
      bundleParentBoundary,
      pointer: stable.value,
      expectedDescriptor: descriptor,
      expectedEntries: snapshot.entries,
    })
    await assertBoundDirectory(workspaceBoundary, 'BUNDLE_PATH_CONTAINMENT', 'workspace root')
    await assertBoundDirectory(pointerParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'pointer parent')
    await assertBoundDirectory(bundleParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'bundle parent')
    return {
      pointer: stable.value,
      pointerBytes: stable.bytes,
      pointerIdentity: stable.identity,
      descriptor: verified.descriptor,
      receipt: verified.receipt,
      bundleRoot,
      cacheRoot,
      snapshot,
    }
  } finally {
    await bundleParentBoundary?.handle.close().catch(() => {})
    await pointerParentBoundary?.handle.close().catch(() => {})
    await workspaceBoundary.handle.close().catch(() => {})
  }
}

function canonicalSelectedCacheEntries(entries) {
  return entries.map((entry) => ({
    lockPath: entry.lockPath,
    name: entry.name,
    version: entry.version,
    integrity: entry.integrity,
    key: entry.key,
    byteLength: entry.byteLength,
    contentDigest: entry.contentDigest,
  }))
}

function legacyCanonicalContentAggregate(entries) {
  return [...entries]
    .map((entry) => ({ contentDigest: entry.contentDigest, byteLength: entry.byteLength }))
    .sort((left, right) =>
      left.contentDigest === right.contentDigest
        ? left.byteLength - right.byteLength
        : legacyContentCollator.compare(left.contentDigest, right.contentDigest),
    )
}

function canonicalContentAggregate(entries) {
  return [...entries]
    .map((entry) => ({
      lockPath: entry.lockPath,
      contentDigest: entry.contentDigest,
      byteLength: entry.byteLength,
    }))
    .sort((left, right) => compareUtf8(left.lockPath, right.lockPath))
}

export function computeSelectedCacheHashes(entries) {
  return {
    selectedCacheIndexSha256: sha256(canonicalJson(canonicalSelectedCacheEntries(entries))),
    selectedContentAggregateSha256: sha256(canonicalJson(canonicalContentAggregate(entries))),
  }
}

export function deriveCanonicalLockInput(packageJson, packageLock) {
  if (sha256(canonicalJsonBytes(packageJson)) !== EXPECTED_ACCEPTED_PACKAGE_JSON_CANONICAL_SHA256) {
    fail('ACCEPTED_PACKAGE_JSON_CANONICAL_MISMATCH', 'package.json')
  }
  if (sha256(canonicalJsonBytes(packageLock)) !== EXPECTED_ACCEPTED_PACKAGE_LOCK_CANONICAL_SHA256) {
    fail('ACCEPTED_PACKAGE_LOCK_CANONICAL_MISMATCH', 'package-lock.json')
  }
  assertCandidateShape({
    schemaVersion: '1',
    label: EXPECTED.label,
    expected: {
      registryPackageCount: EXPECTED.registryPackageCount,
      deepseekPackageCount: EXPECTED.deepseekPackageCount,
      dshPackageCount: EXPECTED.dshPackageCount,
      dshVersion: EXPECTED.dshVersion,
      selectedContentBytes: EXPECTED.selectedContentBytes,
    },
  }, packageJson, packageLock)
  const entries = Object.entries(packageLock.packages)
    .filter(([lockPath]) => lockPath !== '')
    .map(([lockPath, record]) => {
      ensureRelativePath(lockPath, 'lock path')
      if (!isObject(record) || typeof record.version !== 'string' || typeof record.integrity !== 'string') {
        fail('INVALID_LOCK_PROJECTION_RECORD', lockPath)
      }
      assertRegistryUrl(record.resolved, lockPath)
      return {
        lockPath,
        name: packageNameFromLockPath(lockPath),
        version: record.version,
        integrity: record.integrity,
        key: `make-fetch-happen:request-cache:${record.resolved}`,
        contentDigest: record.integrity,
      }
  })
  .sort((left, right) => compareUtf8(left.lockPath, right.lockPath))
  if (entries.length !== EXPECTED.registryPackageCount) fail('REGISTRY_COUNT_MISMATCH', String(entries.length))
  const expected = {
    count: entries.length,
    totalBytes: EXPECTED.selectedContentBytes,
    uniqueIndexFileCount: new Set(entries.map((entry) => entry.key)).size,
    uniqueContentFileCount: new Set(entries.map((entry) => entry.integrity)).size,
  }
  if (expected.count !== EXPECTED.registryPackageCount
    || expected.uniqueIndexFileCount !== EXPECTED.registryPackageCount
    || expected.uniqueContentFileCount !== EXPECTED.registryPackageCount) {
    fail('REGISTRY_COUNT_MISMATCH', 'selected lock projection uniqueness')
  }
  return { entries, expected, sha256: sha256(canonicalJson(entries)) }
}

function assertCompilerToolchain(rootPackageLock, compilerToolchain) {
  assertExactKeys(
    compilerToolchain,
    ['typescript', 'nodeTypes', 'undiciTypes', 'reactTypes', 'propTypes', 'csstype'],
    'compilerToolchain',
  )
  if (!isObject(rootPackageLock?.packages)) fail('INVALID_ROOT_LOCKFILE', 'packages')
  for (const [key, expected] of Object.entries(expectedCompilerToolchain)) {
    const actual = compilerToolchain[key]
    assertExactKeys(actual, ['lockPath', 'version', 'integrity'], `compilerToolchain.${key}`)
    if (canonicalJsonBytes(actual) !== canonicalJsonBytes(expected)) fail('COMPILER_TOOLCHAIN_MISMATCH', key)
    const rootEntry = rootPackageLock.packages[expected.lockPath]
    if (!isObject(rootEntry) || rootEntry.version !== expected.version || rootEntry.integrity !== expected.integrity) {
      fail('ROOT_LOCK_TOOLCHAIN_MISMATCH', expected.lockPath)
    }
    const rootDependencies = rootEntry.dependencies ?? {}
    if (!sameStringMap(rootDependencies, expectedCompilerRootDependencies[key])) {
      fail('ROOT_LOCK_TOOLCHAIN_MISMATCH', `${expected.lockPath} dependencies`)
    }
  }
}

function assertProductionBoundaryShape(productionBoundary) {
  assertExactKeys(productionBoundary, ['baselineCommit', 'files', 'aggregateSha256'], 'productionBoundary')
  if (canonicalJsonBytes(productionBoundary) !== canonicalJsonBytes(expectedProductionBoundary)) {
    fail('PRODUCTION_BOUNDARY_MANIFEST_MISMATCH', 'expected boundary')
  }
}

export async function validateProductionBoundary({ workspaceRoot = DEFAULT_WORKSPACE_ROOT, inputManifest }) {
  assertProductionBoundaryShape(inputManifest.productionBoundary)
  const expectedPaths = expectedProductionBoundary.files.map(({ path }) => path)
  const actualPaths = ['package.json', 'package-lock.json']
  async function walk(directory, prefix) {
    const names = await readdirWithStableMissingCode(directory, 'PRODUCTION_BOUNDARY_FILE_LIST_MISMATCH')
    for (const name of names) {
      const absolutePath = resolve(directory, name)
      const path = `${prefix}/${name}`
      const entry = await lstatWithStableMissingCode(absolutePath, 'PRODUCTION_BOUNDARY_FILE_LIST_MISMATCH')
      if (entry.isSymbolicLink()) fail('PRODUCTION_BOUNDARY_SYMLINK', path)
      if (path === 'packages/workbench/lib') continue
      if (entry.isDirectory()) await walk(absolutePath, path)
      else if (entry.isFile()) actualPaths.push(path)
      else fail('PRODUCTION_BOUNDARY_SPECIAL_FILE', path)
    }
  }
  await walk(resolve(workspaceRoot, 'packages/workbench'), 'packages/workbench')
  actualPaths.sort(compareUtf8)
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) fail('PRODUCTION_BOUNDARY_FILE_LIST_MISMATCH', 'unexpected/missing path')
  const files = []
  for (const path of expectedPaths) {
    const absolutePath = resolve(workspaceRoot, path)
    const snapshot = await readBoundSourceFile(
      absolutePath,
      'PRODUCTION_BOUNDARY_FILE_MISSING',
      16 * 1024 * 1024,
      'PRODUCTION_BOUNDARY_FILE_MISSING',
      'production boundary file',
      {
        symlinkCode: 'PRODUCTION_BOUNDARY_SYMLINK',
        specialCode: 'PRODUCTION_BOUNDARY_SPECIAL_FILE',
        hardlinkCode: 'PRODUCTION_BOUNDARY_SPECIAL_FILE',
      },
    )
    if (snapshot.identity.mode !== 0o644) {
      fail('PRODUCTION_BOUNDARY_HASH_MISMATCH', path)
    }
    files.push({ path, sha256: snapshot.identity.sha256 })
  }
  if (JSON.stringify(files) !== JSON.stringify(expectedProductionBoundary.files) || sha256(canonicalJson(files)) !== expectedProductionBoundary.aggregateSha256) {
    fail('PRODUCTION_BOUNDARY_HASH_MISMATCH', 'changed source')
  }
  return expectedProductionBoundary
}

export function validateInputManifest({ inputManifest, packageJson, packageLock, rootPackageLock }) {
  assertExactKeys(inputManifest, [
    'schemaVersion', 'inputLabel', 'authorizationBasis', 'packageJsonSha256', 'packageLockSha256',
    'lockfileVersion', 'acceptedRootPackage', 'packageCounts', 'dshVersion', 'nestedCommander',
    'selectedCache', 'selectedCacheIndexSha256', 'selectedContentAggregateSha256', 'proposalStage',
    'runtime', 'compilerToolchain', 'productionBoundary', 'lockProjectionSha256',
  ], 'inputManifest')
  assertSafeManifestStrings(inputManifest)
  if (inputManifest.schemaVersion !== '2' || inputManifest.lockfileVersion !== 3) fail('INPUT_MANIFEST_VERSION_MISMATCH', String(inputManifest.schemaVersion))
  if (inputManifest.inputLabel !== EXPECTED.label || inputManifest.authorizationBasis !== EXPECTED.authorizationBasis) fail('INPUT_MANIFEST_TEXT_INVALID', 'inputLabel/authorizationBasis')
  if (inputManifest.packageJsonSha256 !== '208bae9d2b2c0d67b2fa6b985d394cc1ce483e3a5cd226e391ca0a6b7f261cd1' || inputManifest.packageLockSha256 !== 'dde74c404cfbf8e7b1ec7cabece36d2aa2061f256770570f69c15f3064061ad1') fail('ACCEPTED_INPUT_HASH_MISMATCH', 'packageJson/packageLock')
  assertExactKeys(inputManifest.acceptedRootPackage, ['name', 'private', 'devDependencies'], 'acceptedRootPackage')
  if (inputManifest.acceptedRootPackage.name !== packageJson.name || inputManifest.acceptedRootPackage.private !== true || !sameStringMap(inputManifest.acceptedRootPackage.devDependencies, packageJson.devDependencies)) fail('ACCEPTED_ROOT_PACKAGE_MISMATCH', 'name/private/devDependencies')
  assertExactKeys(inputManifest.packageCounts, ['registry', 'deepseek', 'dsh'], 'packageCounts')
  if (canonicalJsonBytes(inputManifest.packageCounts) !== canonicalJsonBytes({ registry: 169, deepseek: 59, dsh: 54 })) fail('PACKAGE_COUNTS_MISMATCH', 'packageCounts')
  if (inputManifest.dshVersion !== EXPECTED.dshVersion || canonicalJsonBytes(inputManifest.nestedCommander) !== canonicalJsonBytes(EXPECTED.nestedCommander)) fail('DECLARATION_COHORT_MISMATCH', 'dsh/nested commander')
  assertExactKeys(inputManifest.selectedCache, ['entries', 'totalBytes'], 'selectedCache')
  if (!Array.isArray(inputManifest.selectedCache.entries) || inputManifest.selectedCache.entries.length !== EXPECTED.registryPackageCount || inputManifest.selectedCache.totalBytes !== EXPECTED.selectedContentBytes) fail('SELECTED_CACHE_COUNT_OR_BYTES_MISMATCH', 'selectedCache')
  const projection = deriveCanonicalLockInput(packageJson, packageLock)
  const seen = new Set()
  let previous = null
  for (let index = 0; index < inputManifest.selectedCache.entries.length; index += 1) {
    const entry = inputManifest.selectedCache.entries[index]
    assertExactKeys(entry, ['lockPath', 'name', 'version', 'integrity', 'key', 'byteLength', 'contentDigest'], `selectedCache.entries[${index}]`)
    if (typeof entry.lockPath !== 'string' || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0) fail('INVALID_SELECTED_CACHE_ENTRY', String(index))
    if (seen.has(entry.lockPath) || (previous !== null && compareUtf8(previous, entry.lockPath) >= 0)) fail('NONCANONICAL_SELECTED_CACHE_ORDER', entry.lockPath)
    seen.add(entry.lockPath); previous = entry.lockPath
    const expected = projection.entries[index]
    for (const key of ['lockPath', 'name', 'version', 'integrity', 'key', 'contentDigest']) if (entry[key] !== expected[key]) fail('LOCK_PROJECTION_MISMATCH', `${entry.lockPath}:${key}`)
  }
  if (inputManifest.selectedCache.totalBytes !== inputManifest.selectedCache.entries.reduce((total, entry) => total + entry.byteLength, 0)) fail('SELECTED_CACHE_BYTE_SUM_MISMATCH', 'totalBytes')
  const hashes = computeSelectedCacheHashes(inputManifest.selectedCache.entries)
  if (hashes.selectedCacheIndexSha256 !== inputManifest.selectedCacheIndexSha256 || inputManifest.selectedCacheIndexSha256 !== V2_SELECTED_INDEX_SHA256) fail('SELECTED_INDEX_HASH_MISMATCH', 'selectedCacheIndexSha256')
  if (hashes.selectedContentAggregateSha256 !== inputManifest.selectedContentAggregateSha256 || inputManifest.selectedContentAggregateSha256 !== V2_SELECTED_CONTENT_AGGREGATE_SHA256) fail('SELECTED_CONTENT_AGGREGATE_MISMATCH', 'selectedContentAggregateSha256')
  if (projection.sha256 !== inputManifest.lockProjectionSha256) fail('LOCK_PROJECTION_HASH_MISMATCH', 'lockProjectionSha256')
  assertExactKeys(inputManifest.proposalStage, ['command', 'result'], 'proposalStage')
  if (inputManifest.proposalStage.command !== 'stageRc6DeclarationInputV2({ workspaceRoot })' || inputManifest.proposalStage.result !== 'PASS_STAGED_RC6_DECLARATION_INPUT_V2') fail('PROPOSAL_STAGE_RESULT_MISMATCH', 'proposalStage')
  assertExactKeys(inputManifest.runtime, ['node', 'npm'], 'runtime')
  assertExactKeys(inputManifest.runtime.node, ['version', 'basename', 'sha256'], 'runtime.node')
  assertExactKeys(inputManifest.runtime.npm, ['version', 'cliBasename', 'cliSha256'], 'runtime.npm')
  for (const [label, value] of Object.entries({ ...inputManifest.runtime.node, ...inputManifest.runtime.npm })) if (typeof value !== 'string') fail('RUNTIME_IDENTITY_TYPE_MISMATCH', label)
  if (canonicalJsonBytes(inputManifest.runtime) !== canonicalJsonBytes(EXPECTED_RUNTIME)) fail('RUNTIME_IDENTITY_MISMATCH', 'runtime')
  assertCompilerToolchain(rootPackageLock, inputManifest.compilerToolchain)
  assertProductionBoundaryShape(inputManifest.productionBoundary)
  return { projection, hashes }
}

async function copySelectedCache({ cacheRoot, targetCacheRoot, entries }) {
  await assertDirectoryEmptyOrAbsent(targetCacheRoot)
  await mkdir(targetCacheRoot, { recursive: true })
  for (const entry of entries) {
    const indexTarget = cacheIndexPath(targetCacheRoot, entry.key)
    const contentTarget = integrityToContentPath(targetCacheRoot, entry.integrity)
    await mkdir(dirname(indexTarget), { recursive: true })
    await mkdir(dirname(contentTarget), { recursive: true })
    await copyFile(entry.sourceIndexPath, indexTarget)
    await copyFile(entry.contentPath, contentTarget)
    if ((await sha256File(indexTarget)) !== sha256(entry.indexRaw)) fail('COPIED_INDEX_HASH_MISMATCH', entry.lockPath)
    if ((await stat(contentTarget)).size !== entry.byteLength) fail('COPIED_CONTENT_SIZE_MISMATCH', entry.lockPath)
    const contentIntegrity = `sha512-${createHash('sha512').update(await readFile(contentTarget)).digest('base64')}`
    if (contentIntegrity !== entry.integrity) fail('COPIED_CONTENT_INTEGRITY_MISMATCH', entry.lockPath)
  }
  await makeTreeReadOnlyStrict(targetCacheRoot)
}

async function copyImmutableContractFiles({ workspaceRoot, acceptedRoot }) {
  for (const [relativePath, expectedHash] of Object.entries(EXPECTED.contractHashes)) {
    const source = resolve(workspaceRoot, relativePath)
    if ((await sha256File(source)) !== expectedHash) fail('IMMUTABLE_CONTRACT_HASH_CHANGED', relativePath)
    const destination = resolve(acceptedRoot, relativePath)
    await mkdir(dirname(destination), { recursive: true })
    await copyFile(source, destination)
    if ((await sha256File(destination)) !== expectedHash) fail('COPIED_CONTRACT_HASH_MISMATCH', relativePath)
  }
}

async function copyAcceptedInputFiles({ candidateRoot, acceptedRoot }) {
  await mkdir(acceptedRoot, { recursive: true })
  await copyFile(resolve(candidateRoot, 'package.json'), resolve(acceptedRoot, 'package.json'))
  await copyFile(resolve(candidateRoot, 'package-lock.json'), resolve(acceptedRoot, 'package-lock.json'))
}

function assertPinnedRuntimeEntries({ nodePath, npmCliPath, nodeSnapshot, npmSnapshot }) {
  if (process.version !== EXPECTED_RUNTIME.node.version
    || basename(nodePath) !== EXPECTED_RUNTIME.node.basename
    || nodeSnapshot.identity.sha256 !== EXPECTED_RUNTIME.node.sha256) {
    fail('INVALID_NODE_EXECUTABLE', 'Node executable identity')
  }
  if (basename(npmCliPath) !== EXPECTED_RUNTIME.npm.cliBasename
    || npmSnapshot.identity.sha256 !== EXPECTED_RUNTIME.npm.cliSha256) {
    fail('INVALID_NPM_CLI', 'npm CLI entry identity')
  }
}

async function readRuntimeIdentity(nodePath, npmCliPath) {
  const [nodeBefore, npmBefore] = await Promise.all([
    readBoundSourceFile(
      nodePath,
      'INVALID_NODE_EXECUTABLE',
      256 * 1024 * 1024,
      'INVALID_NODE_EXECUTABLE',
      'Node executable',
    ),
    readBoundSourceFile(
      npmCliPath,
      'INVALID_NPM_CLI',
      16 * 1024 * 1024,
      'INVALID_NPM_CLI',
      'npm CLI entry',
    ),
  ])
  assertPinnedRuntimeEntries({ nodePath, npmCliPath, nodeSnapshot: nodeBefore, npmSnapshot: npmBefore })
  let npmVersion
  try {
    npmVersion = (await execFileAsync(nodePath, [npmCliPath, '--version'], {
      env: {},
      maxBuffer: 1024 * 1024,
      timeout: 30_000,
    })).stdout.trim()
  } catch {
    fail('INVALID_NPM_CLI', 'npm CLI version execution')
  }
  const [nodeAfter, npmAfter] = await Promise.all([
    readBoundSourceFile(
      nodePath,
      'INVALID_NODE_EXECUTABLE',
      256 * 1024 * 1024,
      'INVALID_NODE_EXECUTABLE',
      'Node executable',
    ),
    readBoundSourceFile(
      npmCliPath,
      'INVALID_NPM_CLI',
      16 * 1024 * 1024,
      'INVALID_NPM_CLI',
      'npm CLI entry',
    ),
  ])
  for (const [label, before, after] of [
    ['Node executable', nodeBefore, nodeAfter],
    ['npm CLI entry', npmBefore, npmAfter],
  ]) {
    if (before.identity.dev !== after.identity.dev
      || before.identity.ino !== after.identity.ino
      || before.identity.size !== after.identity.size
      || before.identity.mode !== after.identity.mode
      || before.identity.nlink !== after.identity.nlink
      || before.identity.sha256 !== after.identity.sha256) {
      fail(label === 'Node executable' ? 'INVALID_NODE_EXECUTABLE' : 'INVALID_NPM_CLI', `${label} identity changed`)
    }
  }
  assertPinnedRuntimeEntries({ nodePath, npmCliPath, nodeSnapshot: nodeAfter, npmSnapshot: npmAfter })
  if (npmVersion !== EXPECTED_RUNTIME.npm.version) {
    fail('INVALID_NPM_CLI', 'npm CLI version')
  }
  return {
    node: {
      version: process.version,
      basename: basename(nodePath),
      sha256: nodeBefore.identity.sha256,
    },
    npm: {
      version: npmVersion,
      cliBasename: basename(npmCliPath),
      cliSha256: npmBefore.identity.sha256,
    },
  }
}

async function writeInputManifest({
  workspaceRoot,
  candidate,
  packageJson,
  packageLock,
  selected,
  runtime,
}) {
  const selectedCacheEntries = canonicalSelectedCacheEntries(selected.entries)
  const inputManifest = {
    // B1 keeps the live writer on the historical v1 format. B2 must pass
    // replay-derived evidence and atomically replace this with a v2 snapshot.
    schemaVersion: '1',
    inputLabel: candidate.label,
    authorizationBasis: candidate.authorizationBasis,
    packageJsonSha256: await sha256File(resolve(workspaceRoot, 'tools/harness-rc6-declarations/package.json')),
    packageLockSha256: await sha256File(resolve(workspaceRoot, 'tools/harness-rc6-declarations/package-lock.json')),
    acceptedRootPackage: { name: packageJson.name, devDependencies: packageJson.devDependencies },
    packageCounts: { registry: 169, deepseek: 59, dsh: 54 },
    dshVersion: EXPECTED.dshVersion,
    nestedCommander: EXPECTED.nestedCommander,
    selectedCache: { entries: selectedCacheEntries, totalBytes: selected.totalBytes },
    selectedCacheIndexSha256: sha256(canonicalJson(selectedCacheEntries)),
    selectedContentAggregateSha256: sha256(canonicalJson(legacyCanonicalContentAggregate(selected.entries))),
    runtime,
  }
  const target = resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json')
  await writeFile(target, canonicalJson(inputManifest), 'utf8')
  return inputManifest
}

async function readCommittedDeclarationFiles(workspaceRoot) {
  const inputPath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json')
  const packagePath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/package.json')
  const lockPath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/package-lock.json')
  const rootLockPath = resolve(workspaceRoot, 'package-lock.json')
  const [inputFile, packageFile, lockFile, rootLockFile] = await Promise.all([
    readJsonFile(inputPath),
    readJsonFile(packagePath),
    readJsonFile(lockPath),
    readJsonFile(rootLockPath),
  ])
  return { inputFile, packageFile, lockFile, rootLockFile }
}

async function inspectCommittedDeclarationInputSnapshot({ workspaceRoot, files }) {
  const { inputFile, packageFile, lockFile, rootLockFile } = files
  const inputManifest = inputFile.value
  const packageJson = packageFile.value
  const packageLock = lockFile.value
  const rootPackageLock = rootLockFile.value
  if (inputManifest.schemaVersion !== '1' && inputManifest.schemaVersion !== '2') {
    fail('UNSUPPORTED_INPUT_MANIFEST_SCHEMA', String(inputManifest.schemaVersion))
  }
  if (inputManifest.schemaVersion === '1') {
    assertCandidateShape(
      { schemaVersion: '1', label: inputManifest.inputLabel, expected: {
        registryPackageCount: inputManifest.packageCounts?.registry,
        deepseekPackageCount: inputManifest.packageCounts?.deepseek,
        dshPackageCount: inputManifest.packageCounts?.dsh,
        dshVersion: inputManifest.dshVersion,
        selectedContentBytes: inputManifest.selectedCache?.totalBytes,
      } },
      packageJson,
      packageLock,
    )
  }
  const entries = inputManifest.selectedCache?.entries
  if (!Array.isArray(entries) || entries.length !== EXPECTED.registryPackageCount) {
    fail('INVALID_COMMITTED_SELECTED_CACHE', 'entries')
  }
  const normalizedEntries = entries.map((entry) => {
    if (!isObject(entry)) fail('INVALID_COMMITTED_CACHE_ENTRY', String(entry))
    return entry
  })
  const selectedHashes = inputManifest.schemaVersion === '1'
    ? {
        selectedCacheIndexSha256: sha256(canonicalJson(normalizedEntries)),
        selectedContentAggregateSha256: sha256(canonicalJson(legacyCanonicalContentAggregate(normalizedEntries))),
      }
    : computeSelectedCacheHashes(normalizedEntries)
  const packageJsonSha256 = packageFile.rawSha256
  const packageLockSha256 = lockFile.rawSha256
  if (inputManifest.schemaVersion === '2') {
    if (packageJsonSha256 !== inputManifest.packageJsonSha256 || packageLockSha256 !== inputManifest.packageLockSha256) {
      fail('COMMITTED_INPUT_BYTE_HASH_MISMATCH', 'packageJson/packageLock')
    }
    validateInputManifest({ inputManifest, packageJson, packageLock, rootPackageLock })
    await validateProductionBoundary({ workspaceRoot, inputManifest })
    if (!inputFile.rawBytes.equals(canonicalDocumentBytes(inputManifest))) {
      fail('COMMITTED_INPUT_CANONICAL_MISMATCH', 'input-manifest v2')
    }
  }
  return {
    inputManifest,
    packageJson,
    packageLock,
    packageJsonSha256,
    packageLockSha256,
    ...selectedHashes,
    ...(inputManifest.schemaVersion === '1'
      ? { status: 'CHANGES_REQUIRED_REVIEW', reason: 'INPUT_MANIFEST_V2_PENDING_B2' }
      : { status: 'PASS_STATIC_METADATA' }),
  }
}

export async function inspectCommittedDeclarationInput({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
  const files = await readCommittedDeclarationFiles(workspaceRoot)
  return inspectCommittedDeclarationInputSnapshot({ workspaceRoot, files })
}

async function inspectCommittedV1Bootstrap(workspaceRoot, files) {
  if (files.inputFile.rawSha256 !== EXPECTED_COMMITTED_V1_INPUT_RAW_SHA256
    || files.inputFile.value.schemaVersion !== '1') {
    fail('COMMITTED_V1_BOOTSTRAP_MISMATCH', 'committed input-manifest v1')
  }
  return inspectCommittedDeclarationInputSnapshot({ workspaceRoot, files })
}

const COMMITTED_ANCESTOR_RELATIVE_PATHS = [
  'tools',
  'tools/harness-rc6-declarations',
  'research',
]

async function snapshotCommittedAncestorBoundaries(workspaceRoot, workspaceBoundary) {
  const boundaries = []
  try {
    for (const relativePath of COMMITTED_ANCESTOR_RELATIVE_PATHS) {
      const path = resolve(workspaceRoot, relativePath)
      await assertDescendantDirectoryChain(workspaceBoundary, path, {
        code: 'COMMITTED_EVIDENCE_CHANGED',
        missingCode: 'COMMITTED_EVIDENCE_CHANGED',
        logicalLabel: 'committed evidence ancestry',
        includeLeafDirectory: true,
      })
      const boundary = await openBoundDirectory(
        path,
        'COMMITTED_EVIDENCE_CHANGED',
        'committed evidence ancestry',
      )
      if (boundary.canonicalPath
        !== resolve(workspaceBoundary.canonicalPath, relativePath)) {
        await boundary.handle.close().catch(() => {})
        fail('COMMITTED_EVIDENCE_CHANGED', 'committed evidence ancestry')
      }
      boundaries.push({ relativePath, ...boundary })
    }
    return boundaries
  } catch (error) {
    await Promise.all(boundaries.map((boundary) => boundary.handle.close().catch(() => {})))
    throw error
  }
}

async function assertCommittedAncestorBoundaries(
  workspaceBoundary,
  committedAncestorBoundaries,
) {
  await assertBoundDirectory(
    workspaceBoundary,
    'COMMITTED_EVIDENCE_CHANGED',
    'committed evidence workspace',
  )
  for (const boundary of committedAncestorBoundaries) {
    await assertBoundDirectory(
      boundary,
      'COMMITTED_EVIDENCE_CHANGED',
      'committed evidence ancestry',
    )
    if (boundary.canonicalPath
      !== resolve(workspaceBoundary.canonicalPath, boundary.relativePath)) {
      fail('COMMITTED_EVIDENCE_CHANGED', 'committed evidence ancestry')
    }
  }
}

function assertSamePublication(before, after) {
  for (const key of ['pointer', 'descriptor', 'receipt']) {
    if (canonicalJsonBytes(before[key]) !== canonicalJsonBytes(after[key])) {
      fail('PUBLISHED_LOGICAL_INPUT_MISMATCH', key)
    }
  }
  if (!before.pointerBytes.equals(after.pointerBytes)
    || before.pointerIdentity.dev !== after.pointerIdentity.dev
    || before.pointerIdentity.ino !== after.pointerIdentity.ino
    || before.pointerIdentity.nlink !== 1 || after.pointerIdentity.nlink !== 1) {
    fail('PUBLISHED_LOGICAL_INPUT_MISMATCH', 'pointer identity')
  }
  if (canonicalJsonBytes(canonicalSelectedCacheEntries(before.snapshot.entries))
    !== canonicalJsonBytes(canonicalSelectedCacheEntries(after.snapshot.entries))) {
    fail('PUBLISHED_LOGICAL_INPUT_MISMATCH', 'selected cache')
  }
}

async function assertCommittedEvidenceUnchanged(
  workspaceRoot,
  committedFiles,
  closureFile,
  workspaceBoundary,
  committedAncestorBoundaries = [],
) {
  const committedPaths = [
    'tools/harness-rc6-declarations/input-manifest.json',
    'tools/harness-rc6-declarations/package.json',
    'tools/harness-rc6-declarations/package-lock.json',
    'package-lock.json',
    'research/2026-09-05-rc6-declaration-closure.json',
  ]
  const assertCommittedAncestry = async () => {
    if (!workspaceBoundary) return
    await assertCommittedAncestorBoundaries(workspaceBoundary, committedAncestorBoundaries)
    for (const relativePath of committedPaths) {
      await assertDescendantDirectoryChain(
        workspaceBoundary,
        resolve(workspaceRoot, relativePath),
        {
          code: 'COMMITTED_EVIDENCE_CHANGED',
          missingCode: 'COMMITTED_EVIDENCE_CHANGED',
          logicalLabel: 'committed evidence ancestry',
        },
      )
    }
  }
  await assertCommittedAncestry()
  const [afterFiles, afterClosure] = await Promise.all([
    readCommittedDeclarationFiles(workspaceRoot),
    readJsonFile(resolve(workspaceRoot, 'research/2026-09-05-rc6-declaration-closure.json')),
  ])
  await assertCommittedAncestry()
  const assertSameCommittedFile = (before, after, label) => {
    if (!after.rawBytes.equals(before.rawBytes)) fail('COMMITTED_EVIDENCE_CHANGED', label)
    for (const field of [
      'sha256', 'size', 'mode', 'dev', 'ino', 'nlink', 'mtimeMs', 'ctimeMs',
    ]) {
      if (after.identity[field] !== before.identity[field]) {
        fail('COMMITTED_EVIDENCE_CHANGED', label)
      }
    }
  }
  for (const key of ['inputFile', 'packageFile', 'lockFile', 'rootLockFile']) {
    assertSameCommittedFile(committedFiles[key], afterFiles[key], key)
  }
  assertSameCommittedFile(closureFile, afterClosure, 'closure')
}

function isPathWithin(root, candidate) {
  const remainder = relative(root, candidate)
  return remainder === '' || (remainder !== '..' && !remainder.startsWith(`..${sep}`) && !isAbsolute(remainder))
}

function canonicalDocumentBytes(value) {
  return Buffer.from(`${canonicalJsonBytes(value)}\n`, 'utf8')
}

async function readImmutableContractSnapshots(workspaceRoot, workspaceBoundary) {
  const snapshots = []
  for (const [relativePath, expectedHash] of Object.entries(EXPECTED.contractHashes)) {
    const source = resolve(workspaceRoot, relativePath)
    await assertDescendantDirectoryChain(workspaceBoundary, source, {
      code: 'BUNDLE_PATH_CONTAINMENT',
      missingCode: 'IMMUTABLE_CONTRACT_HASH_CHANGED',
      logicalLabel: 'immutable contract input',
    })
    const snapshot = await readBoundSourceFile(
      source,
      'IMMUTABLE_CONTRACT_HASH_CHANGED',
      1024 * 1024,
      'IMMUTABLE_CONTRACT_HASH_CHANGED',
      'immutable contract input',
    )
    if (snapshot.identity.sha256 !== expectedHash) {
      fail('IMMUTABLE_CONTRACT_HASH_CHANGED', relativePath)
    }
    snapshots.push({ relativePath, expectedHash, ...snapshot })
  }
  return snapshots
}

async function assertImmutableContractSnapshotsUnchanged(workspaceRoot, snapshots) {
  for (const snapshot of snapshots) {
    const after = await readBoundSourceFile(
      resolve(workspaceRoot, snapshot.relativePath),
      'IMMUTABLE_CONTRACT_HASH_CHANGED',
      1024 * 1024,
      'IMMUTABLE_CONTRACT_HASH_CHANGED',
      'immutable contract input',
    )
    if (!after.bytes.equals(snapshot.bytes)
      || after.identity.dev !== snapshot.identity.dev
      || after.identity.ino !== snapshot.identity.ino
      || after.identity.sha256 !== snapshot.expectedHash) {
      fail('IMMUTABLE_CONTRACT_HASH_CHANGED', snapshot.relativePath)
    }
  }
}

async function writeReplayInputs({ replayBoundary, replayRoot, committedFiles, contractSnapshots }) {
  await settleOwnedMutations([
    writeBundleFile(resolve(replayRoot, 'package.json'), committedFiles.packageFile.rawBytes),
    writeBundleFile(resolve(replayRoot, 'package-lock.json'), committedFiles.lockFile.rawBytes),
  ])
  for (const snapshot of contractSnapshots) {
    const destination = resolve(replayRoot, snapshot.relativePath)
    if (dirname(destination) !== replayRoot) {
      await ensureDescendantDirectoryChain(
        replayBoundary,
        dirname(destination),
        'REPLAY_PATH_CONTAINMENT',
        'replay contract parent',
      )
    }
    const written = await writeBundleFile(destination, snapshot.bytes)
    if (written.sha256 !== snapshot.expectedHash) {
      fail('COPIED_CONTRACT_HASH_MISMATCH', snapshot.relativePath)
    }
  }
}

function replayCompilerPackages() {
  return [
    expectedCompilerToolchain.typescript,
    expectedCompilerToolchain.nodeTypes,
    expectedCompilerToolchain.undiciTypes,
    expectedCompilerToolchain.reactTypes,
    expectedCompilerToolchain.propTypes,
    expectedCompilerToolchain.csstype,
  ]
}

async function snapshotCompilerPackageTree(packageRoot) {
  const rootBoundary = await openBoundDirectory(
    packageRoot,
    'COMPILER_PATH_CONTAINMENT',
    'compiler package root',
  )
  const records = []
  const identities = []
  const materials = []
  async function walk(directory, logicalPath, heldBoundary) {
    const boundary = heldBoundary ?? await openBoundDirectory(
      directory,
      'COMPILER_PATH_CONTAINMENT',
      'compiler package directory',
    )
    try {
      const expectedCanonical = logicalPath === '.'
        ? rootBoundary.canonicalPath
        : resolve(rootBoundary.canonicalPath, ...logicalPath.split('/'))
      if (boundary.canonicalPath !== expectedCanonical) {
        fail('COMPILER_PATH_CONTAINMENT', 'compiler package directory')
      }
      await assertBoundDirectory(boundary, 'COMPILER_PATH_CONTAINMENT', 'compiler package directory')
      const directoryStat = await boundary.handle.stat()
      records.push({ path: logicalPath, type: 'directory', mode: directoryStat.mode & 0o777 })
      identities.push({
        path: logicalPath,
        type: 'directory',
        mode: directoryStat.mode & 0o777,
        dev: directoryStat.dev,
        ino: directoryStat.ino,
      })
      for (const name of (await readdirWithStableMissingCode(
        directory,
        'COMPILER_PATH_CONTAINMENT',
      )).sort(compareUtf8)) {
        const child = resolve(directory, name)
        const childLogical = logicalPath === '.' ? name : `${logicalPath}/${name}`
        const childStat = await lstatWithStableMissingCode(child, 'COMPILER_PATH_CONTAINMENT')
        if (childStat.isSymbolicLink()) {
          fail('COMPILER_PATH_CONTAINMENT', 'compiler package symlink')
        }
        if (childStat.isDirectory()) {
          await walk(child, childLogical)
          continue
        }
        if (!childStat.isFile()) fail('COMPILER_PATH_CONTAINMENT', 'compiler package special file')
        const snapshot = await readBoundSourceFile(
          child,
          'COMPILER_PATH_CONTAINMENT',
          CACHE_CONTENT_MAX_BYTES,
          'COMPILER_PATH_CONTAINMENT',
          'compiler package file',
        )
        records.push({
          path: childLogical,
          type: 'file',
          mode: snapshot.identity.mode,
          size: snapshot.identity.size,
          sha256: snapshot.identity.sha256,
        })
        identities.push({ path: childLogical, type: 'file', ...snapshot.identity })
        materials.push({ path: childLogical, bytes: snapshot.bytes })
      }
      await assertBoundDirectory(boundary, 'COMPILER_PATH_CONTAINMENT', 'compiler package directory')
    } finally {
      if (!heldBoundary) await boundary.handle.close().catch(() => {})
    }
  }
  try {
    await walk(packageRoot, '.', rootBoundary)
    await assertBoundDirectory(rootBoundary, 'COMPILER_PATH_CONTAINMENT', 'compiler package root')
    return {
      canonicalRoot: rootBoundary.canonicalPath,
      records: records.sort((left, right) => compareUtf8(left.path, right.path)),
      identities: identities.sort((left, right) => compareUtf8(left.path, right.path)),
      materials: materials.sort((left, right) => compareUtf8(left.path, right.path)),
    }
  } finally {
    await rootBoundary.handle.close().catch(() => {})
  }
}

async function snapshotCompilerToolchainSource(workspaceRoot, workspaceBoundary) {
  const packages = []
  const snapshots = []
  for (const expected of replayCompilerPackages()) {
    const packageRoot = resolve(workspaceRoot, expected.lockPath)
    await assertDescendantDirectoryChain(workspaceBoundary, packageRoot, {
      code: 'COMPILER_PATH_CONTAINMENT',
      missingCode: 'COMPILER_PATH_CONTAINMENT',
      logicalLabel: `compiler source package ${expected.lockPath}`,
      includeLeafDirectory: true,
    })
    const snapshot = await snapshotCompilerPackageTree(packageRoot)
    if (!isPathWithin(workspaceRoot, snapshot.canonicalRoot)) {
      fail('COMPILER_PATH_CONTAINMENT', 'compiler source package')
    }
    const manifest = await readBoundSourceFile(
      resolve(packageRoot, 'package.json'),
      'COMPILER_PATH_CONTAINMENT',
      1024 * 1024,
      'COMPILER_PATH_CONTAINMENT',
      'compiler source manifest',
    )
    let manifestValue
    try {
      manifestValue = JSON.parse(manifest.bytes.toString('utf8'))
    } catch {
      fail('COMPILER_PATH_CONTAINMENT', 'compiler source manifest')
    }
    if (!isObject(manifestValue) || manifestValue.version !== expected.version) {
      fail('COMPILER_PATH_CONTAINMENT', 'compiler source manifest version')
    }
    const summary = {
      lockPath: expected.lockPath,
      version: expected.version,
      integrity: expected.integrity,
      inventoryCount: snapshot.records.length,
      inventorySha256: sha256(canonicalJsonBytes(snapshot.records)),
    }
    packages.push(summary)
    snapshots.push({ expected, packageRoot, ...snapshot })
  }
  packages.sort((left, right) => compareUtf8(left.lockPath, right.lockPath))
  const aggregateSha256 = sha256(canonicalJsonBytes(packages))
  if (aggregateSha256 !== EXPECTED_COMPILER_SOURCE_AGGREGATE_SHA256) {
    fail('COMPILER_PATH_CONTAINMENT', 'compiler source aggregate')
  }
  return { workspaceRoot, workspaceBoundary, snapshots, packages, aggregateSha256 }
}

function sealedCompilerRecords(records) {
  return records.map((record) => record.type === 'directory'
    ? { ...record, mode: 0o555 }
    : { ...record, mode: 0o444 })
}

function clientCompilerOverlayBytes() {
  const bytes = canonicalDocumentBytes(CLIENT_COMPILER_OVERLAY)
  if (sha256(bytes) !== EXPECTED_CLIENT_COMPILER_OVERLAY_SHA256) {
    fail('COMPILER_PATH_CONTAINMENT', 'client compiler overlay identity')
  }
  return bytes
}

async function materializeReplayCompilerToolchain({
  replayRoot,
  replayBoundary,
  sourceSnapshot,
}) {
  const compilerRoot = resolve(replayRoot, '.compiler')
  await ensureDescendantDirectoryChain(
    replayBoundary,
    compilerRoot,
    'COMPILER_PATH_CONTAINMENT',
    'replay compiler root',
  )
  const installedPackages = []
  for (const snapshot of sourceSnapshot.snapshots) {
    const destinationRoot = resolve(compilerRoot, snapshot.expected.lockPath)
    await ensureDescendantDirectoryChain(
      replayBoundary,
      destinationRoot,
      'COMPILER_PATH_CONTAINMENT',
      'replay compiler package',
    )
    for (const material of snapshot.materials) {
      const destination = resolve(destinationRoot, ...material.path.split('/'))
      if (!isPathWithin(destinationRoot, destination)) {
        fail('COMPILER_PATH_CONTAINMENT', 'replay compiler file')
      }
      if (dirname(destination) !== destinationRoot) {
        await ensureDescendantDirectoryChain(
          replayBoundary,
          dirname(destination),
          'COMPILER_PATH_CONTAINMENT',
          'replay compiler directory',
        )
      }
      await writeBundleFile(destination, material.bytes)
    }
    await makeTreeReadOnlyStrict(destinationRoot)
    const inventory = await inventoryBundlePayload(destinationRoot)
    const expectedInventory = sealedCompilerRecords(snapshot.records)
    if (canonicalJsonBytes(inventory) !== canonicalJsonBytes(expectedInventory)) {
      fail('COMPILER_PATH_CONTAINMENT', 'replay compiler materialization')
    }
    installedPackages.push({
      lockPath: snapshot.expected.lockPath,
      version: snapshot.expected.version,
      integrity: snapshot.expected.integrity,
      inventoryCount: inventory.length,
      inventorySha256: sha256(canonicalJsonBytes(inventory)),
    })
  }
  installedPackages.sort((left, right) => compareUtf8(left.lockPath, right.lockPath))
  await assertBoundDirectory(replayBoundary, 'COMPILER_PATH_CONTAINMENT', 'replay root')
  const clientOverlayPath = resolve(replayRoot, CLIENT_COMPILER_OVERLAY_RELATIVE)
  const clientOverlayBytes = clientCompilerOverlayBytes()
  const clientOverlayIdentity = await writeBundleFile(clientOverlayPath, clientOverlayBytes)
  await assertBoundDirectory(replayBoundary, 'COMPILER_PATH_CONTAINMENT', 'replay root')
  if (clientOverlayIdentity.mode !== 0o444 || clientOverlayIdentity.nlink !== 1
    || clientOverlayIdentity.sha256 !== EXPECTED_CLIENT_COMPILER_OVERLAY_SHA256) {
    fail('COMPILER_PATH_CONTAINMENT', 'client compiler overlay seal')
  }
  const clientOverlayEvidence = {
    relativePath: CLIENT_COMPILER_OVERLAY_RELATIVE,
    sha256: clientOverlayIdentity.sha256,
    size: clientOverlayIdentity.size,
    mode: clientOverlayIdentity.mode,
    nlink: clientOverlayIdentity.nlink,
  }
  const sealedEvidence = {
    packages: installedPackages,
    clientOverlay: clientOverlayEvidence,
  }
  const evidence = {
    schemaVersion: '2',
    sourceAggregateSha256: sourceSnapshot.aggregateSha256,
    sealedAggregateSha256: sha256(canonicalJsonBytes(sealedEvidence)),
    packages: installedPackages,
    clientOverlay: clientOverlayEvidence,
  }
  const tscPath = await realpathWithStableMissingCode(
    resolve(compilerRoot, expectedCompilerToolchain.typescript.lockPath, 'bin/tsc'),
    'COMPILER_PATH_CONTAINMENT',
  )
  if (!isPathWithin(compilerRoot, tscPath)) {
    fail('COMPILER_PATH_CONTAINMENT', 'replay compiler entry')
  }
  return {
    tscPath,
    compilerRoot,
    sourceSnapshot,
    evidence,
    clientOverlay: {
      path: clientOverlayPath,
      bytes: clientOverlayBytes,
      identity: clientOverlayIdentity,
    },
  }
}

async function assertCompilerToolchainSourceUnchanged(sourceSnapshot) {
  const currentSource = await snapshotCompilerToolchainSource(
    sourceSnapshot.workspaceRoot,
    sourceSnapshot.workspaceBoundary,
  )
  for (let index = 0; index < currentSource.snapshots.length; index += 1) {
    const before = sourceSnapshot.snapshots[index]
    const after = currentSource.snapshots[index]
    if (canonicalJsonBytes(after.identities) !== canonicalJsonBytes(before.identities)
      || canonicalJsonBytes(after.records) !== canonicalJsonBytes(before.records)) {
      fail('COMPILER_PATH_CONTAINMENT', 'compiler source changed')
    }
  }
}

async function assertClientCompilerOverlayUnchanged(compilerSnapshot) {
  const currentOverlay = await readBoundSourceFile(
    compilerSnapshot.clientOverlay.path,
    'COMPILER_PATH_CONTAINMENT',
    64 * 1024,
    'COMPILER_PATH_CONTAINMENT',
    'client compiler overlay',
    { writableCode: 'COMPILER_PATH_CONTAINMENT' },
  )
  const beforeOverlay = compilerSnapshot.clientOverlay
  if (!currentOverlay.bytes.equals(beforeOverlay.bytes)
    || currentOverlay.identity.dev !== beforeOverlay.identity.dev
    || currentOverlay.identity.ino !== beforeOverlay.identity.ino
    || currentOverlay.identity.size !== beforeOverlay.identity.size
    || currentOverlay.identity.mode !== 0o444
    || currentOverlay.identity.nlink !== 1
    || currentOverlay.identity.sha256 !== EXPECTED_CLIENT_COMPILER_OVERLAY_SHA256) {
    fail('COMPILER_PATH_CONTAINMENT', 'client compiler overlay changed')
  }
  return {
    relativePath: CLIENT_COMPILER_OVERLAY_RELATIVE,
    sha256: currentOverlay.identity.sha256,
    size: currentOverlay.identity.size,
    mode: currentOverlay.identity.mode,
    nlink: currentOverlay.identity.nlink,
  }
}

async function assertReplayCompilerToolchainUnchanged(compilerSnapshot) {
  await assertCompilerToolchainSourceUnchanged(compilerSnapshot.sourceSnapshot)
  const currentPackages = []
  for (const pkg of compilerSnapshot.evidence.packages) {
    const root = resolve(compilerSnapshot.compilerRoot, pkg.lockPath)
    const inventory = await inventoryBundlePayload(root)
    if (inventory.length !== pkg.inventoryCount
      || sha256(canonicalJsonBytes(inventory)) !== pkg.inventorySha256) {
      fail('COMPILER_PATH_CONTAINMENT', 'replay compiler inventory changed')
    }
    currentPackages.push({ ...pkg })
  }
  currentPackages.sort((left, right) => compareUtf8(left.lockPath, right.lockPath))
  const currentOverlayEvidence = await assertClientCompilerOverlayUnchanged(compilerSnapshot)
  if (canonicalJsonBytes(currentOverlayEvidence)
      !== canonicalJsonBytes(compilerSnapshot.evidence.clientOverlay)
    || sha256(canonicalJsonBytes({
      packages: currentPackages,
      clientOverlay: currentOverlayEvidence,
    })) !== compilerSnapshot.evidence.sealedAggregateSha256) {
    fail('COMPILER_PATH_CONTAINMENT', 'replay compiler evidence changed')
  }
}

function isStorageDeclarationRelativePath(relativePath) {
  const segments = relativePath.split('/')
  for (let index = 0; index <= segments.length - 3; index += 1) {
    if (segments[index] === 'node_modules'
      && segments[index + 1] === '@deepseek-ai'
      && (segments[index + 2] === 'dsh-storage'
        || segments[index + 2] === 'dsh-storage-domain')) {
      return true
    }
  }
  return false
}

async function assertCompilerOutputLocality({
  stdout,
  replayRoot,
  surface,
  contractRelativePath,
}) {
  const lines = stdout.split(/\r?\n/u).map((line) => line.trim()).filter(Boolean)
  const expectedContract = await realpathWithStableMissingCode(
    resolve(replayRoot, contractRelativePath),
    'COMPILER_OUTPUT_ESCAPE',
  )
  const relativeFiles = []
  for (const line of lines) {
    if (!isAbsolute(line)) fail('COMPILER_OUTPUT_ESCAPE', 'non-absolute compiler file list')
    const normalized = await realpathWithStableMissingCode(line, 'COMPILER_OUTPUT_ESCAPE')
    if (!isPathWithin(replayRoot, normalized)) {
      fail('COMPILER_OUTPUT_ESCAPE', 'compiler file list')
    }
    const replayRelative = relative(replayRoot, normalized)
    if (replayRelative === ''
      || replayRelative === '..'
      || replayRelative.startsWith(`..${sep}`)
      || isAbsolute(replayRelative)) {
      fail('COMPILER_OUTPUT_ESCAPE', 'compiler relative file list')
    }
    relativeFiles.push(replayRelative.split(sep).join('/'))
  }
  if (new Set(relativeFiles).size !== relativeFiles.length) {
    fail('COMPILER_OUTPUT_ESCAPE', 'duplicate compiler file list entry')
  }
  const expectedContractRelative = relative(replayRoot, expectedContract).split(sep).join('/')
  if (!relativeFiles.includes(expectedContractRelative)) {
    fail('COMPILER_OUTPUT_ESCAPE', 'copied contract absent from compiler file list')
  }
  if (relativeFiles.some(isStorageDeclarationRelativePath)) {
    fail('STORAGE_SELECTED_OR_IMPORTED', surface)
  }
  const sortedRelativeFiles = [...relativeFiles].sort(compareUtf8)
  return {
    surface,
    contractRelativePath,
    relativeFileCount: sortedRelativeFiles.length,
    relativeFileListSha256: sha256(canonicalJsonBytes(sortedRelativeFiles)),
    realpathsWithinReplayRoot: true,
    contractListed: true,
    storageDeclarationFilesListed: false,
  }
}

function declarationCompileArguments(configPath, typeRootsPath) {
  return [
    '-p',
    configPath,
    '--noEmit',
    '--types',
    'node',
    '--typeRoots',
    typeRootsPath,
    '--listFiles',
    '--pretty',
    'false',
  ]
}

async function runDeclarationCompile({
  nodePath,
  compilerSnapshot,
  replayRoot,
  homeRoot,
  tempRoot,
  surface,
  configRelativePath,
  contractRelativePath,
}) {
  const configPath = resolve(replayRoot, configRelativePath)
  const args = [
    compilerSnapshot.tscPath,
    ...declarationCompileArguments(
      configPath,
      resolve(compilerSnapshot.compilerRoot, 'node_modules/@types'),
    ),
  ]
  let result
  let executionFailed = false
  await assertClientCompilerOverlayUnchanged(compilerSnapshot)
  try {
    result = await execFileAsync(nodePath, args, {
      cwd: replayRoot,
      env: { HOME: homeRoot, TMPDIR: tempRoot },
      maxBuffer: 10 * 1024 * 1024,
      timeout: 60_000,
    })
  } catch {
    executionFailed = true
  }
  await assertClientCompilerOverlayUnchanged(compilerSnapshot)
  if (executionFailed) fail('DECLARATION_COMPILE_FAILED', configRelativePath)
  return assertCompilerOutputLocality({
    stdout: result.stdout,
    replayRoot,
    surface,
    contractRelativePath,
  })
}

function successfulStagedVerificationIdentity(verification) {
  try {
    assertExactKeys(verification, [
      'closure',
      'realpathsWithinStagingRoot',
      'selectedDeclarationManifests',
      'status',
      'storage',
    ], 'staged verification')
    assertExactKeys(verification.storage, ['selectedOrImported'], 'staged verification storage')
    assertExactKeys(verification.closure, [
      'fullDeepseekCohort',
      'selectedDeclarationSubgraph',
    ], 'staged verification closure')
    assertExactKeys(verification.closure.selectedDeclarationSubgraph, [
      'records',
      'roots',
    ], 'staged verification selected declarations')
    const { fullDeepseekCohort, selectedDeclarationSubgraph } = verification.closure
    if (verification.status !== 'PASS_STAGED_REPLAY'
      || verification.realpathsWithinStagingRoot !== true
      || verification.storage.selectedOrImported !== false
      || !Array.isArray(fullDeepseekCohort)
      || fullDeepseekCohort.length !== EXPECTED.deepseekPackageCount
      || !Array.isArray(selectedDeclarationSubgraph.records)
      || selectedDeclarationSubgraph.records.length !== 5
      || !Array.isArray(selectedDeclarationSubgraph.roots)
      || selectedDeclarationSubgraph.roots.length !== 5
      || !Array.isArray(verification.selectedDeclarationManifests)
      || canonicalJsonBytes(verification.selectedDeclarationManifests)
        !== canonicalJsonBytes(selectedDeclarationSubgraph.records)) {
      fail('STAGED_REPLAY_VERIFICATION_FAILED', 'staged verification result')
    }
    return {
      status: verification.status,
      realpathsWithinStagingRoot: true,
      storageSelectedOrImported: false,
      fullDeepseekCount: fullDeepseekCohort.length,
      selectedDeclarationCount: selectedDeclarationSubgraph.records.length,
      verifierClosureSha256: sha256(canonicalJsonBytes(verification.closure)),
      selectedDeclarationManifestsSha256: sha256(
        canonicalJsonBytes(verification.selectedDeclarationManifests),
      ),
    }
  } catch (error) {
    if (error?.ownedInputError === true
      && error.code === 'STAGED_REPLAY_VERIFICATION_FAILED') throw error
    fail('STAGED_REPLAY_VERIFICATION_FAILED', 'staged verification result')
  }
}

async function assertBoundSourceSnapshotUnchanged(path, before, code, label) {
  const after = await readBoundSourceFile(
    path,
    code,
    4 * 1024 * 1024,
    code,
    label,
  )
  for (const field of ['sha256', 'size', 'mode', 'dev', 'ino', 'nlink']) {
    if (after.identity[field] !== before.identity[field]) fail(code, `${label} changed`)
  }
  if (!after.bytes.equals(before.bytes)) fail(code, `${label} changed`)
}

async function assertVerificationSourcesUnchanged(sourceSnapshot) {
  await Promise.all([
    assertBoundSourceSnapshotUnchanged(
      sourceSnapshot.acceptancePath,
      sourceSnapshot.acceptance,
      'VERIFIER_SOURCE_MISMATCH',
      'acceptance source',
    ),
    assertBoundSourceSnapshotUnchanged(
      sourceSnapshot.verifierPath,
      sourceSnapshot.verifier,
      'VERIFIER_SOURCE_MISMATCH',
      'verifier source',
    ),
  ])
}

function verificationSourcePayload(files) {
  return [
    { path: '.', type: 'directory', mode: 0o555 },
    { path: 'scripts', type: 'directory', mode: 0o555 },
    ...files.map(({ name, bytes }) => ({
      path: `scripts/${name}`,
      type: 'file',
      mode: 0o444,
      size: bytes.length,
      sha256: sha256(bytes),
    })),
  ].sort((left, right) => compareUtf8(left.path, right.path))
}

async function materializeReplayVerificationSources({
  replayRoot,
  replayBoundary,
  sourceSnapshot,
}) {
  await assertVerificationSourcesUnchanged(sourceSnapshot)
  const verificationRoot = resolve(replayRoot, '.verification')
  const scriptsRoot = resolve(verificationRoot, 'scripts')
  await ensureDescendantDirectoryChain(
    replayBoundary,
    scriptsRoot,
    'VERIFIER_SOURCE_MISMATCH',
    'replay verification source root',
  )
  const files = [
    { name: 'accept-rc6-declaration-input.mjs', bytes: sourceSnapshot.acceptance.bytes },
    { name: 'verify-rc6-declaration-closure.mjs', bytes: sourceSnapshot.verifier.bytes },
  ]
  if (REPLAY_EVIDENCE_KIND !== 'REAL_NPM_CLI') {
    const seam = await readBoundSourceFile(
      resolve(moduleDirectory, 'child-process-replay-seam.mjs'),
      'VERIFIER_SOURCE_MISMATCH',
      4 * 1024 * 1024,
      'VERIFIER_SOURCE_MISMATCH',
      'synthetic replay seam',
    )
    files.push({ name: 'child-process-replay-seam.mjs', bytes: seam.bytes })
  }
  for (const file of files) {
    await writeBundleFile(resolve(scriptsRoot, file.name), file.bytes)
  }
  await makeTreeReadOnlyStrict(verificationRoot)
  const expectedPayload = verificationSourcePayload(files)
  const actualPayload = await inventoryBundlePayload(verificationRoot)
  if (canonicalJsonBytes(actualPayload) !== canonicalJsonBytes(expectedPayload)) {
    fail('VERIFIER_SOURCE_MISMATCH', 'replay verification source materialization')
  }
  return {
    verificationRoot,
    verifierPath: resolve(scriptsRoot, 'verify-rc6-declaration-closure.mjs'),
    sourceSnapshot,
    payload: expectedPayload,
    sealedAggregateSha256: sha256(canonicalJsonBytes(expectedPayload)),
  }
}

async function assertReplayVerificationSourcesUnchanged(snapshot) {
  await assertVerificationSourcesUnchanged(snapshot.sourceSnapshot)
  const actualPayload = await inventoryBundlePayload(snapshot.verificationRoot)
  if (canonicalJsonBytes(actualPayload) !== canonicalJsonBytes(snapshot.payload)
    || sha256(canonicalJsonBytes(actualPayload)) !== snapshot.sealedAggregateSha256) {
    fail('VERIFIER_SOURCE_MISMATCH', 'replay verification sources changed')
  }
}

async function cleanupOwnedDirectory({
  parentBoundary,
  ownedBoundary,
  root,
  ownerMarker,
  quarantinePrefix,
  ownershipCode,
  cleanupCode,
}) {
  try {
    await assertBoundDirectory(parentBoundary, ownershipCode, 'owned directory parent')
    await assertBoundDirectory(ownedBoundary, ownershipCode, 'owned directory')
    if (ownedBoundary.canonicalPath
      !== resolve(parentBoundary.canonicalPath, basename(root))) {
      fail(ownershipCode, 'owned directory relationship')
    }
    const owner = await readBoundSourceFile(
      resolve(root, '.owner'),
      ownershipCode,
      128,
      ownershipCode,
      'owned directory marker',
    )
    if (owner.bytes.toString('utf8') !== ownerMarker) {
      fail(ownershipCode, 'owned directory marker')
    }
    await assertBoundDirectory(parentBoundary, ownershipCode, 'owned directory parent')
    await assertBoundDirectory(ownedBoundary, ownershipCode, 'owned directory')
    const quarantinePath = resolve(
      parentBoundary.path,
      `${quarantinePrefix}${ownerMarker}-${randomBytes(8).toString('hex')}`,
    )
    try {
      await rename(root, quarantinePath)
    } catch {
      fail(cleanupCode, 'quarantine rename')
    }
    ownedBoundary.path = quarantinePath
    ownedBoundary.canonicalPath = resolve(parentBoundary.canonicalPath, basename(quarantinePath))
    await assertBoundDirectory(ownedBoundary, ownershipCode, 'quarantined directory')
    const quarantinedOwner = await readBoundSourceFile(
      resolve(quarantinePath, '.owner'),
      ownershipCode,
      128,
      ownershipCode,
      'quarantined directory marker',
    )
    if (quarantinedOwner.bytes.toString('utf8') !== ownerMarker) {
      fail(ownershipCode, 'quarantined directory marker')
    }
    await assertBoundDirectory(parentBoundary, ownershipCode, 'owned directory parent')
    await assertBoundDirectory(ownedBoundary, ownershipCode, 'quarantined directory')
    // Keep the isolated quarantine instead of recursively chmod/rm'ing by path.
    // Node does not expose the dirfd-relative removal primitives needed to make
    // a recursive deletion safe against same-user path replacement or hardlinks.
    return { quarantinePath }
  } catch (error) {
    if (error?.ownedInputError === true && error.code === ownershipCode) throw error
    if (error?.ownedInputError === true && error.code === cleanupCode) throw error
    fail(ownershipCode, 'owned directory')
  } finally {
    await ownedBoundary.handle.close().catch(() => {})
  }
}

function proposalBundlePaths(workspaceRoot) {
  const pointerPath = resolve(workspaceRoot, V2_PROPOSAL_POINTER_RELATIVE)
  const pointerParent = dirname(pointerPath)
  const bundleParent = resolve(workspaceRoot, V2_PROPOSAL_BUNDLE_PARENT_RELATIVE)
  if (relative(pointerParent, bundleParent) !== 'rc6-declaration-v2-proposal-bundles') {
    fail('BUNDLE_PATH_CONTAINMENT', 'proposal bundle parent')
  }
  return { pointerPath, pointerParent, bundleParent }
}

async function assertProposalPublicationBoundaries({
  workspaceBoundary,
  pointerParentBoundary,
  bundleParentBoundary,
  bundleBoundary,
}) {
  await assertBoundDirectory(workspaceBoundary, 'BUNDLE_PATH_CONTAINMENT', 'workspace root')
  await assertBoundDirectory(
    pointerParentBoundary,
    'BUNDLE_PATH_CONTAINMENT',
    'proposal pointer parent',
  )
  await assertBoundDirectory(
    bundleParentBoundary,
    'BUNDLE_PATH_CONTAINMENT',
    'proposal bundle parent',
  )
  if (pointerParentBoundary.canonicalPath
      !== resolve(workspaceBoundary.canonicalPath, '.tmp/dsh-pm-workbench')
    || bundleParentBoundary.canonicalPath
      !== resolve(pointerParentBoundary.canonicalPath, 'rc6-declaration-v2-proposal-bundles')) {
    fail('BUNDLE_PATH_CONTAINMENT', 'proposal publication parent relationship')
  }
  if (bundleBoundary) {
    await assertBoundDirectory(bundleBoundary, 'BUNDLE_PATH_CONTAINMENT', 'proposal bundle')
    const segment = basename(bundleBoundary.path)
    if (!/^bundle-[a-f0-9]{32}$/.test(segment)
      || bundleBoundary.canonicalPath
        !== resolve(bundleParentBoundary.canonicalPath, segment)) {
      fail('BUNDLE_PATH_CONTAINMENT', 'proposal bundle relationship')
    }
  }
}

function assertProposalPointerShape(pointer) {
  assertExactKeys(pointer, [
    'bundleRelativePath',
    'receiptRelativePath',
    'receiptSha256',
    'schemaVersion',
  ], 'proposal pointer')
  if (pointer.schemaVersion !== '2'
    || typeof pointer.bundleRelativePath !== 'string'
    || !/^rc6-declaration-v2-proposal-bundles\/bundle-[a-f0-9]{32}$/.test(pointer.bundleRelativePath)
    || pointer.receiptRelativePath !== `${pointer.bundleRelativePath}/receipt.json`
    || typeof pointer.receiptSha256 !== 'string'
    || !/^[a-f0-9]{64}$/.test(pointer.receiptSha256)) {
    fail('PROPOSAL_CONFLICT', 'proposal pointer')
  }
}

async function proposalPointerExists(path) {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if (error?.code === 'ENOENT') return false
    fail('PROPOSAL_CONFLICT', 'proposal pointer access')
  }
}

async function readStableProposalPointer(pointerPath) {
  let snapshot
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      snapshot = await readBoundSourceFile(
        pointerPath,
        'PROPOSAL_CONFLICT',
        V2_PROPOSAL_POINTER_MAX_BYTES,
        'PROPOSAL_CONFLICT',
        'proposal pointer',
        {
          symlinkCode: 'PROPOSAL_CONFLICT',
          specialCode: 'PROPOSAL_CONFLICT',
          hardlinkCode: 'PROPOSAL_POINTER_LINK_STATE',
          writableCode: 'PROPOSAL_CONFLICT',
          allowedLinkCounts: [1, 2],
        },
      )
      break
    } catch (error) {
      if (error?.code !== 'SOURCE_FILE_IDENTITY_CHANGED' || attempt === 2) throw error
    }
  }
  if (!isOwnerReadableReadOnlyMode(snapshot.identity.mode)) {
    fail('PROPOSAL_POINTER_LINK_STATE', 'proposal pointer mode')
  }
  let value
  try {
    value = JSON.parse(snapshot.bytes.toString('utf8'))
  } catch {
    fail('PROPOSAL_CONFLICT', 'proposal pointer json')
  }
  if (!isObject(value) || !snapshot.bytes.equals(canonicalDocumentBytes(value))) {
    fail('PROPOSAL_CONFLICT', 'proposal pointer canonical')
  }
  assertProposalPointerShape(value)
  return { ...snapshot, value }
}

async function writeReadOnlyProposalPointerTemp(pointerParentBoundary, pointerBytes) {
  if (pointerBytes.length > V2_PROPOSAL_POINTER_MAX_BYTES) {
    fail('PROPOSAL_POINTER_TEMP_WRITE_FAILED', 'proposal pointer size')
  }
  await assertBoundDirectory(pointerParentBoundary, 'BUNDLE_PATH_CONTAINMENT', 'proposal pointer parent')
  const path = resolve(
    pointerParentBoundary.path,
    `.rc6-declaration-v2-proposal-${randomBytes(16).toString('hex')}.tmp`,
  )
  let handle
  try {
    handle = await open(
      path,
      fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW,
      0o444,
    )
    const beforeWrite = await handle.stat()
    if (!beforeWrite.isFile() || beforeWrite.nlink !== 1
      || beforeWrite.size !== 0 || !isOwnerReadableReadOnlyMode(beforeWrite.mode)) {
      fail('PROPOSAL_POINTER_TEMP_WRITE_FAILED', 'proposal pointer temporary identity')
    }
    await handle.writeFile(pointerBytes)
    await handle.sync()
    const afterWrite = await handle.stat()
    if (!afterWrite.isFile() || afterWrite.dev !== beforeWrite.dev
      || afterWrite.ino !== beforeWrite.ino || afterWrite.nlink !== 1
      || afterWrite.size !== pointerBytes.length || !isOwnerReadableReadOnlyMode(afterWrite.mode)) {
      fail('PROPOSAL_POINTER_TEMP_WRITE_FAILED', 'proposal pointer temporary identity')
    }
  } catch {
    fail('PROPOSAL_POINTER_TEMP_WRITE_FAILED', 'proposal pointer temporary')
  } finally {
    await handle?.close().catch(() => {})
  }
  const verify = await readBoundSourceFile(
    path,
    'PROPOSAL_POINTER_TEMP_WRITE_FAILED',
    V2_PROPOSAL_POINTER_MAX_BYTES,
    'PROPOSAL_POINTER_TEMP_WRITE_FAILED',
    'proposal pointer temporary',
    { writableCode: 'PROPOSAL_POINTER_TEMP_WRITE_FAILED' },
  )
  if (!verify.bytes.equals(pointerBytes)) {
    fail('PROPOSAL_POINTER_TEMP_WRITE_FAILED', 'proposal pointer temporary bytes')
  }
  return { path, identity: verify.identity }
}

async function convergeProposalPointerLinkCount(pointerParentBoundary, pointerPath, stable) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await assertBoundDirectory(
      pointerParentBoundary,
      'BUNDLE_PATH_CONTAINMENT',
      'proposal pointer parent',
    )
    const current = await readStableProposalPointer(pointerPath)
    if (current.identity.dev !== stable.identity.dev
      || current.identity.ino !== stable.identity.ino
      || !current.bytes.equals(stable.bytes)) {
      fail('PROPOSAL_POINTER_LINK_STATE', 'proposal pointer identity')
    }
    if (current.identity.nlink === 1) {
      const confirm = await readStableProposalPointer(pointerPath)
      await assertBoundDirectory(
        pointerParentBoundary,
        'BUNDLE_PATH_CONTAINMENT',
        'proposal pointer parent',
      )
      if (confirm.identity.dev === current.identity.dev
        && confirm.identity.ino === current.identity.ino
        && confirm.identity.nlink === 1
        && confirm.bytes.equals(current.bytes)) return confirm
      continue
    }
    if (current.identity.nlink !== 2) {
      fail('PROPOSAL_POINTER_LINK_STATE', 'proposal pointer link count')
    }
    const matchingAliases = []
    for (const name of await readdirWithStableMissingCode(
      pointerParentBoundary.path,
      'PROPOSAL_POINTER_LINK_STATE',
    )) {
      if (!/^\.rc6-declaration-v2-proposal-[a-f0-9]{32}\.tmp$/.test(name)) continue
      const path = resolve(pointerParentBoundary.path, name)
      let entry
      try {
        entry = await lstat(path)
      } catch (error) {
        if (error?.code === 'ENOENT') continue
        fail('PROPOSAL_POINTER_LINK_STATE', 'proposal pointer alias')
      }
      if (entry.dev === current.identity.dev && entry.ino === current.identity.ino) {
        if (!entry.isFile() || entry.isSymbolicLink() || (entry.mode & 0o222) !== 0
          || ![1, 2].includes(entry.nlink)) {
          fail('PROPOSAL_POINTER_LINK_STATE', 'proposal pointer alias identity')
        }
        matchingAliases.push({ path, identity: current.identity })
      }
    }
    if (matchingAliases.length === 1) {
      await unlinkOwnedPointerTemporary(
        matchingAliases[0],
        'PROPOSAL_RESIDUE_CLEANUP_FAILED',
      )
    } else if (matchingAliases.length > 1) {
      fail('PROPOSAL_POINTER_LINK_STATE', 'proposal pointer alias count')
    }
  }
  const converged = await readStableProposalPointer(pointerPath)
  await assertBoundDirectory(
    pointerParentBoundary,
    'BUNDLE_PATH_CONTAINMENT',
    'proposal pointer parent',
  )
  if (converged.identity.dev !== stable.identity.dev
    || converged.identity.ino !== stable.identity.ino
    || converged.identity.nlink !== 1
    || !converged.bytes.equals(stable.bytes)) {
    fail('PROPOSAL_RESIDUE_CLEANUP_FAILED', 'proposal pointer convergence')
  }
  return converged
}

function proposalPayload(inputBytes, closureBytes) {
  return [
    { path: '.', type: 'directory', mode: 0o555 },
    {
      path: V2_PROPOSAL_INPUT_NAME,
      type: 'file',
      mode: 0o444,
      size: inputBytes.length,
      sha256: sha256(inputBytes),
    },
    {
      path: V2_PROPOSAL_CLOSURE_NAME,
      type: 'file',
      mode: 0o444,
      size: closureBytes.length,
      sha256: sha256(closureBytes),
    },
  ].sort((left, right) => compareUtf8(left.path, right.path))
}

const PROPOSAL_EVIDENCE_KEYS = Object.freeze([
  'acceptanceSourceSha256',
  'verifierSourceSha256',
  'compilerSourceAggregateSha256',
  'compilerSealedAggregateSha256',
  'verifierResultSha256',
  'compileResults',
  'compilerResultSha256',
])

const COMPILE_RESULT_KEYS = Object.freeze([
  'surface',
  'contractRelativePath',
  'relativeFileCount',
  'relativeFileListSha256',
  'realpathsWithinReplayRoot',
  'contractListed',
  'storageDeclarationFilesListed',
])

const EXPECTED_COMPILE_CONTRACTS = Object.freeze({
  host: 'tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts',
  client: 'tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts',
})

function assertProposalObjectKeys(value, expectedKeys, label) {
  if (!isObject(value)) fail('PROPOSAL_CONFLICT', label)
  const actualKeys = Object.keys(value).sort(compareUtf8)
  const sortedExpectedKeys = [...expectedKeys].sort(compareUtf8)
  if (actualKeys.length !== sortedExpectedKeys.length
    || actualKeys.some((key, index) => key !== sortedExpectedKeys[index])) {
    fail('PROPOSAL_CONFLICT', `${label} keys`)
  }
}

function assertCompileResults(compileResults) {
  assertProposalObjectKeys(compileResults, ['host', 'client'], 'compile results')
  for (const surface of ['host', 'client']) {
    const result = compileResults[surface]
    assertProposalObjectKeys(result, COMPILE_RESULT_KEYS, `${surface} compile result`)
    if (result.surface !== surface
      || result.contractRelativePath !== EXPECTED_COMPILE_CONTRACTS[surface]
      || !Number.isSafeInteger(result.relativeFileCount)
      || result.relativeFileCount < 1
      || typeof result.relativeFileListSha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(result.relativeFileListSha256)
      || result.realpathsWithinReplayRoot !== true
      || result.contractListed !== true
      || result.storageDeclarationFilesListed !== false) {
      fail('PROPOSAL_CONFLICT', `${surface} compile result identity`)
    }
  }
}

function assertProposalEvidence(proposalEvidence) {
  assertProposalObjectKeys(proposalEvidence, PROPOSAL_EVIDENCE_KEYS, 'proposal evidence')
  for (const key of [
    'acceptanceSourceSha256',
    'verifierSourceSha256',
    'compilerSourceAggregateSha256',
    'compilerSealedAggregateSha256',
    'verifierResultSha256',
    'compilerResultSha256',
  ]) {
    if (typeof proposalEvidence[key] !== 'string'
      || !/^[a-f0-9]{64}$/.test(proposalEvidence[key])) {
      fail('PROPOSAL_CONFLICT', `proposal evidence ${key}`)
    }
  }
  assertCompileResults(proposalEvidence.compileResults)
  if (proposalEvidence.compilerResultSha256
      !== sha256(canonicalJsonBytes(proposalEvidence.compileResults))) {
    fail('PROPOSAL_CONFLICT', 'proposal compiler result identity')
  }
}

function verifierResultIdentityFromProposalClosure(closure) {
  if (!isObject(closure)
    || !Array.isArray(closure.fullDeepseekCohort)
    || closure.fullDeepseekCohort.length !== EXPECTED.deepseekPackageCount
    || !isObject(closure.selectedDeclarationSubgraph)
    || !Array.isArray(closure.selectedDeclarationSubgraph.records)
    || closure.selectedDeclarationSubgraph.records.length !== 5
    || !Array.isArray(closure.selectedDeclarationSubgraph.roots)
    || closure.selectedDeclarationSubgraph.roots.length !== 5) {
    fail('PROPOSAL_CONFLICT', 'proposal verifier result identity')
  }
  const verifierClosure = {
    fullDeepseekCohort: closure.fullDeepseekCohort,
    selectedDeclarationSubgraph: closure.selectedDeclarationSubgraph,
  }
  return {
    status: 'PASS_STAGED_REPLAY',
    realpathsWithinStagingRoot: true,
    storageSelectedOrImported: false,
    fullDeepseekCount: closure.fullDeepseekCohort.length,
    selectedDeclarationCount: closure.selectedDeclarationSubgraph.records.length,
    verifierClosureSha256: sha256(canonicalJsonBytes(verifierClosure)),
    selectedDeclarationManifestsSha256: sha256(
      canonicalJsonBytes(closure.selectedDeclarationSubgraph.records),
    ),
  }
}

function expectedProposalReceipt({
  ownerMarker,
  inputBytes,
  closureBytes,
  sourcePublication,
  runtime,
  proposalEvidence,
}) {
  assertProposalEvidence(proposalEvidence)
  const payload = proposalPayload(inputBytes, closureBytes)
  const npmPolicy = {
    cliBasename: 'npm-cli.js',
    command: 'ci',
    args: [
      '--ignore-scripts', '--offline', '--audit=false', '--fund=false',
      '--update-notifier=false', '--cache=<verified-bundle>', '--prefix=<owned-replay>',
      '--logs-dir=<owned-logs>', '--userconfig=<owned-npmrc>', '--globalconfig=<owned-npmrc>',
    ],
    envKeys: ['HOME', 'TMPDIR'],
  }
  const compilePolicy = {
    compiler: 'typescript/bin/tsc',
    invocations: [
      {
        surface: 'host',
        configRelativePath: 'tsconfig.surface.host.json',
        args: declarationCompileArguments('<host-config>', '<sealed-compiler-types>'),
      },
      {
        surface: 'client',
        configRelativePath: CLIENT_COMPILER_OVERLAY_RELATIVE,
        args: declarationCompileArguments('<client-overlay>', '<sealed-compiler-types>'),
      },
    ],
    clientOverlay: {
      relativePath: CLIENT_COMPILER_OVERLAY_RELATIVE,
      sha256: EXPECTED_CLIENT_COMPILER_OVERLAY_SHA256,
      extends: CLIENT_COMPILER_OVERLAY.extends,
      compilerOptions: CLIENT_COMPILER_OVERLAY.compilerOptions,
    },
    envKeys: ['HOME', 'TMPDIR'],
  }
  return {
    schemaVersion: '1',
    result: 'PASS_RC6_DECLARATION_V2_PROPOSAL',
    ownerMarker,
    inputManifestSha256: sha256(inputBytes),
    closureSha256: sha256(closureBytes),
    selectedSourcePointerSha256: sha256(sourcePublication.pointerBytes),
    selectedSourceReceiptSha256: sourcePublication.pointer.receiptSha256,
    selectedSourcePayloadIdentitySha256: sourcePublication.receipt.payloadIdentitySha256,
    npmPolicySha256: sha256(canonicalJsonBytes(npmPolicy)),
    compilePolicySha256: sha256(canonicalJsonBytes(compilePolicy)),
    acceptanceSourceSha256: proposalEvidence.acceptanceSourceSha256,
    verifierSourceSha256: proposalEvidence.verifierSourceSha256,
    compilerSourceAggregateSha256: proposalEvidence.compilerSourceAggregateSha256,
    compilerSealedAggregateSha256: proposalEvidence.compilerSealedAggregateSha256,
    verifierResultSha256: proposalEvidence.verifierResultSha256,
    compileResults: proposalEvidence.compileResults,
    compilerResultSha256: proposalEvidence.compilerResultSha256,
    runtime,
    payloadIdentitySha256: sha256(canonicalJsonBytes(payload)),
    payload,
  }
}

async function verifyProposalBundle({
  paths,
  bundleParentBoundary,
  pointer,
  inputManifest,
  closure,
  sourcePublication,
  runtime,
  proposalEvidence,
}) {
  assertProposalPointerShape(pointer)
  assertProposalEvidence(proposalEvidence)
  if (proposalEvidence.verifierResultSha256
      !== sha256(canonicalJsonBytes(verifierResultIdentityFromProposalClosure(closure)))) {
    fail('PROPOSAL_CONFLICT', 'proposal verifier result identity')
  }
  await assertBoundDirectory(
    bundleParentBoundary,
    'BUNDLE_PATH_CONTAINMENT',
    'proposal bundle parent',
  )
  const bundleRoot = resolve(paths.pointerParent, pointer.bundleRelativePath)
  const segment = relative(paths.bundleParent, bundleRoot)
  if (!/^bundle-[a-f0-9]{32}$/.test(segment) || segment.includes(sep)) {
    fail('PROPOSAL_CONFLICT', 'proposal bundle path')
  }
  const bundleBoundary = await openBoundDirectory(
    bundleRoot,
    'PROPOSAL_CONFLICT',
    'proposal bundle',
  )
  try {
    if (bundleBoundary.canonicalPath !== resolve(bundleParentBoundary.canonicalPath, segment)) {
      fail('PROPOSAL_CONFLICT', 'proposal bundle relationship')
    }
    const readProposalFile = async (name) => (await readBoundSourceFile(
      resolve(bundleRoot, name),
      'PROPOSAL_CONFLICT',
      16 * 1024 * 1024,
      'PROPOSAL_CONFLICT',
      'proposal bundle file',
      {
        symlinkCode: 'PROPOSAL_CONFLICT',
        specialCode: 'PROPOSAL_CONFLICT',
        hardlinkCode: 'PROPOSAL_CONFLICT',
        writableCode: 'PROPOSAL_CONFLICT',
      },
    )).bytes
    const [ownerBytes, inputBytes, closureBytes, receiptBytes] = await Promise.all([
      readProposalFile('.owner'),
      readProposalFile(V2_PROPOSAL_INPUT_NAME),
      readProposalFile(V2_PROPOSAL_CLOSURE_NAME),
      readProposalFile('receipt.json'),
    ])
    if (!inputBytes.equals(canonicalDocumentBytes(inputManifest))
      || !closureBytes.equals(canonicalDocumentBytes(closure))
      || sha256(receiptBytes) !== pointer.receiptSha256) {
      fail('PROPOSAL_CONFLICT', 'proposal bytes')
    }
    let receipt
    try {
      receipt = JSON.parse(receiptBytes.toString('utf8'))
    } catch {
      fail('PROPOSAL_CONFLICT', 'proposal receipt json')
    }
    if (!isObject(receipt) || !receiptBytes.equals(canonicalDocumentBytes(receipt))) {
      fail('PROPOSAL_CONFLICT', 'proposal receipt canonical')
    }
    assertExactKeys(receipt, [
      'acceptanceSourceSha256',
      'closureSha256',
      'compilePolicySha256',
      'compileResults',
      'compilerSealedAggregateSha256',
      'compilerResultSha256',
      'compilerSourceAggregateSha256',
      'inputManifestSha256',
      'npmPolicySha256',
      'ownerMarker',
      'payload',
      'payloadIdentitySha256',
      'result',
      'runtime',
      'schemaVersion',
      'selectedSourcePayloadIdentitySha256',
      'selectedSourcePointerSha256',
      'selectedSourceReceiptSha256',
      'verifierResultSha256',
      'verifierSourceSha256',
    ], 'proposal receipt')
    assertProposalEvidence(Object.fromEntries(
      PROPOSAL_EVIDENCE_KEYS.map((key) => [key, receipt[key]]),
    ))
    if (typeof receipt.ownerMarker !== 'string'
      || !/^[a-f0-9]{32}$/.test(receipt.ownerMarker)
      || ownerBytes.toString('utf8') !== receipt.ownerMarker) {
      fail('PROPOSAL_CONFLICT', 'proposal owner')
    }
    const expectedReceipt = expectedProposalReceipt({
      ownerMarker: receipt.ownerMarker,
      inputBytes,
      closureBytes,
      sourcePublication,
      runtime,
      proposalEvidence,
    })
    if (canonicalJsonBytes(receipt) !== canonicalJsonBytes(expectedReceipt)) {
      fail('PROPOSAL_CONFLICT', 'proposal receipt identity')
    }
    const inventory = (await inventoryBundlePayload(bundleRoot))
      .filter((record) => record.path !== '.owner' && record.path !== 'receipt.json')
    if (canonicalJsonBytes(inventory) !== canonicalJsonBytes(proposalPayload(inputBytes, closureBytes))) {
      fail('PROPOSAL_CONFLICT', 'proposal payload')
    }
    await assertBoundDirectory(bundleBoundary, 'PROPOSAL_CONFLICT', 'proposal bundle')
    await assertBoundDirectory(
      bundleParentBoundary,
      'BUNDLE_PATH_CONTAINMENT',
      'proposal bundle parent',
    )
    return { bundleRoot, bundleBoundary, receipt, inputBytes, closureBytes }
  } catch (error) {
    await bundleBoundary.handle.close().catch(() => {})
    throw error
  }
}

async function publishV2ProposalBundle({
  workspaceRoot,
  workspaceBoundary,
  inputManifest,
  closure,
  sourcePublication,
  runtime,
  proposalEvidence,
  assertPreCommit,
}) {
  if (typeof assertPreCommit !== 'function') {
    fail('PROPOSAL_COMMIT_UNCERTAIN', 'proposal precommit verifier')
  }
  const paths = proposalBundlePaths(workspaceRoot)
  await assertDescendantDirectoryChain(workspaceBoundary, paths.pointerParent, {
    code: 'BUNDLE_PATH_CONTAINMENT',
    missingCode: 'BUNDLE_PATH_CONTAINMENT',
    logicalLabel: 'proposal pointer parent',
    includeLeafDirectory: true,
  })
  const pointerParentBoundary = await openBoundDirectory(
    paths.pointerParent,
    'BUNDLE_PATH_CONTAINMENT',
    'proposal pointer parent',
  )
  let bundleParentBoundary
  let bundleBoundary
  let bundleRoot
  let pointerTemporary
  let ownerMarker
  let publicationState = 'INITIAL'
  let linkAttempted = false
  let publishedOwnWithIndependentPointerInode = false
  const inputBytes = canonicalDocumentBytes(inputManifest)
  const closureBytes = canonicalDocumentBytes(closure)
  try {
    await ensureDescendantDirectoryChain(
      pointerParentBoundary,
      paths.bundleParent,
      'BUNDLE_PATH_CONTAINMENT',
      'proposal bundle parent',
    )
    bundleParentBoundary = await openBoundDirectory(
      paths.bundleParent,
      'BUNDLE_PATH_CONTAINMENT',
      'proposal bundle parent',
    )
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
    })
    if (await proposalPointerExists(paths.pointerPath)) {
      const stable = await readStableProposalPointer(paths.pointerPath)
      const verified = await verifyProposalBundle({
        paths,
        bundleParentBoundary,
        pointer: stable.value,
        inputManifest,
        closure,
        sourcePublication,
        runtime,
        proposalEvidence,
      })
      await verified.bundleBoundary.handle.close()
      await assertPreCommit()
      await assertProposalPublicationBoundaries({
        workspaceBoundary,
        pointerParentBoundary,
        bundleParentBoundary,
      })
      const converged = await convergeProposalPointerLinkCount(
        pointerParentBoundary,
        paths.pointerPath,
        stable,
      )
      await assertProposalPublicationBoundaries({
        workspaceBoundary,
        pointerParentBoundary,
        bundleParentBoundary,
      })
      const verifiedConverged = await verifyProposalBundle({
        paths,
        bundleParentBoundary,
        pointer: converged.value,
        inputManifest,
        closure,
        sourcePublication,
        runtime,
        proposalEvidence,
      })
      await verifiedConverged.bundleBoundary.handle.close()
      const finalStable = await readStableProposalPointer(paths.pointerPath)
      if (finalStable.identity.dev !== converged.identity.dev
        || finalStable.identity.ino !== converged.identity.ino
        || finalStable.identity.nlink !== 1
        || !finalStable.bytes.equals(converged.bytes)) {
        fail('PROPOSAL_COMMIT_UNCERTAIN', 'adopted proposal pointer changed')
      }
      publicationState = 'COMPLETE'
      return { pointer: finalStable.value, publicationStatus: 'ADOPTED_EXISTING' }
    }
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
    })
    bundleRoot = await createExclusiveBundleDirectory(paths.bundleParent)
    bundleBoundary = await openBoundDirectory(bundleRoot, 'BUNDLE_PATH_CONTAINMENT', 'proposal bundle')
    if (bundleBoundary.canonicalPath
      !== resolve(bundleParentBoundary.canonicalPath, basename(bundleRoot))) {
      fail('BUNDLE_PATH_CONTAINMENT', 'proposal bundle relationship')
    }
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    publicationState = 'OWNED_BUILDING'
    ownerMarker = randomBytes(16).toString('hex')
    await writeBundleFile(resolve(bundleRoot, '.owner'), Buffer.from(ownerMarker, 'utf8'))
    await settleOwnedMutations([
      writeBundleFile(resolve(bundleRoot, V2_PROPOSAL_INPUT_NAME), inputBytes),
      writeBundleFile(resolve(bundleRoot, V2_PROPOSAL_CLOSURE_NAME), closureBytes),
    ])
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    const receipt = expectedProposalReceipt({
      ownerMarker,
      inputBytes,
      closureBytes,
      sourcePublication,
      runtime,
      proposalEvidence,
    })
    const receiptBytes = canonicalDocumentBytes(receipt)
    await writeBundleFile(resolve(bundleRoot, 'receipt.json'), receiptBytes)
    await makeTreeReadOnlyStrict(bundleRoot)
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    publicationState = 'OWNED_SEALED'
    const segment = basename(bundleRoot)
    const pointer = {
      bundleRelativePath: `rc6-declaration-v2-proposal-bundles/${segment}`,
      receiptRelativePath: `rc6-declaration-v2-proposal-bundles/${segment}/receipt.json`,
      receiptSha256: sha256(receiptBytes),
      schemaVersion: '2',
    }
    const pointerBytes = canonicalDocumentBytes(pointer)
    const verifiedOwn = await verifyProposalBundle({
      paths,
      bundleParentBoundary,
      pointer,
      inputManifest,
      closure,
      sourcePublication,
      runtime,
      proposalEvidence,
    })
    await verifiedOwn.bundleBoundary.handle.close()
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    pointerTemporary = await writeReadOnlyProposalPointerTemp(pointerParentBoundary, pointerBytes)
    publicationState = 'POINTER_TEMP_READY'
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    await assertPreCommit()
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    let adoptedExisting
    let linkError
    try {
      linkAttempted = true
      publicationState = 'PUBLICATION_UNKNOWN'
      await link(pointerTemporary.path, paths.pointerPath)
      publicationState = 'PUBLISHED_OWN'
    } catch (error) {
      linkError = error
    }
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    if (linkError) {
      if (linkError?.code === 'EEXIST') {
        const existing = await readStableProposalPointer(paths.pointerPath)
        if (existing.bytes.equals(pointerBytes)) {
          publicationState = 'PUBLISHED_OWN'
          publishedOwnWithIndependentPointerInode = existing.identity.dev
              !== pointerTemporary.identity.dev
            || existing.identity.ino !== pointerTemporary.identity.ino
        } else {
          publicationState = 'LINK_DID_NOT_PUBLISH'
          let verifiedExisting
          try {
            verifiedExisting = await verifyProposalBundle({
              paths,
              bundleParentBoundary,
              pointer: existing.value,
              inputManifest,
              closure,
              sourcePublication,
              runtime,
              proposalEvidence,
            })
          } catch {
            fail('PROPOSAL_CONFLICT', 'proposal pointer exists')
          }
          await verifiedExisting.bundleBoundary.handle.close()
          const converged = await convergeProposalPointerLinkCount(
            pointerParentBoundary,
            paths.pointerPath,
            existing,
          )
          adoptedExisting = converged
        }
      } else {
        let stableAfterError
        try {
          if (await proposalPointerExists(paths.pointerPath)) {
            stableAfterError = await readStableProposalPointer(paths.pointerPath)
          }
        } catch {
          publicationState = 'PUBLICATION_UNKNOWN'
          fail('PROPOSAL_COMMIT_UNCERTAIN', 'proposal pointer probe')
        }
        if (!stableAfterError) {
          const temporaryAfterError = await readBoundSourceFile(
            pointerTemporary.path,
            'PROPOSAL_COMMIT_UNCERTAIN',
            V2_PROPOSAL_POINTER_MAX_BYTES,
            'PROPOSAL_COMMIT_UNCERTAIN',
            'proposal pointer temporary probe',
            { allowedLinkCounts: [1, 2] },
          )
          if (temporaryAfterError.identity.dev === pointerTemporary.identity.dev
            && temporaryAfterError.identity.ino === pointerTemporary.identity.ino
            && temporaryAfterError.identity.nlink === 1
            && temporaryAfterError.bytes.equals(pointerBytes)) {
            publicationState = 'LINK_DID_NOT_PUBLISH'
            fail('PROPOSAL_COMMIT_FAILED', 'proposal pointer link')
          }
          publicationState = 'PUBLICATION_UNKNOWN'
          fail('PROPOSAL_COMMIT_UNCERTAIN', 'proposal pointer state')
        }
        if (stableAfterError.bytes.equals(pointerBytes)) {
          publicationState = 'PUBLISHED_OWN'
          publishedOwnWithIndependentPointerInode = stableAfterError.identity.dev
              !== pointerTemporary.identity.dev
            || stableAfterError.identity.ino !== pointerTemporary.identity.ino
        } else {
          publicationState = 'LINK_DID_NOT_PUBLISH'
          let verifiedExisting
          try {
            verifiedExisting = await verifyProposalBundle({
              paths,
              bundleParentBoundary,
              pointer: stableAfterError.value,
              inputManifest,
              closure,
              sourcePublication,
              runtime,
              proposalEvidence,
            })
          } catch {
            publicationState = 'PUBLICATION_UNKNOWN'
            fail('PROPOSAL_COMMIT_UNCERTAIN', 'unexpected proposal pointer')
          }
          await verifiedExisting.bundleBoundary.handle.close()
          adoptedExisting = await convergeProposalPointerLinkCount(
            pointerParentBoundary,
            paths.pointerPath,
            stableAfterError,
          )
        }
      }
    }
    if (adoptedExisting) {
      publicationState = 'ADOPTED_EXISTING'
      await assertProposalPublicationBoundaries({
        workspaceBoundary,
        pointerParentBoundary,
        bundleParentBoundary,
        bundleBoundary,
      })
      await unlinkOwnedPointerTemporary(
        pointerTemporary,
        'PROPOSAL_RESIDUE_CLEANUP_FAILED',
      )
      pointerTemporary = undefined
      await cleanupOwnedDirectory({
        parentBoundary: bundleParentBoundary,
        ownedBoundary: bundleBoundary,
        root: bundleRoot,
        ownerMarker,
        quarantinePrefix: '.cleanup-proposal-',
        ownershipCode: 'PROPOSAL_CLEANUP_OWNERSHIP_LOST',
        cleanupCode: 'PROPOSAL_CLEANUP_FAILED',
      })
      bundleBoundary = undefined
      bundleRoot = undefined
      await assertProposalPublicationBoundaries({
        workspaceBoundary,
        pointerParentBoundary,
        bundleParentBoundary,
      })
      const finalStable = await readStableProposalPointer(paths.pointerPath)
      if (finalStable.identity.dev !== adoptedExisting.identity.dev
        || finalStable.identity.ino !== adoptedExisting.identity.ino
        || finalStable.identity.nlink !== 1
        || !finalStable.bytes.equals(adoptedExisting.bytes)) {
        fail('PROPOSAL_COMMIT_UNCERTAIN', 'adopted proposal pointer changed')
      }
      const verifiedAdopted = await verifyProposalBundle({
        paths,
        bundleParentBoundary,
        pointer: finalStable.value,
        inputManifest,
        closure,
        sourcePublication,
        runtime,
        proposalEvidence,
      })
      await verifiedAdopted.bundleBoundary.handle.close()
      const confirmedStable = await readStableProposalPointer(paths.pointerPath)
      if (confirmedStable.identity.dev !== finalStable.identity.dev
        || confirmedStable.identity.ino !== finalStable.identity.ino
        || confirmedStable.identity.nlink !== 1
        || !confirmedStable.bytes.equals(finalStable.bytes)) {
        fail('PROPOSAL_COMMIT_UNCERTAIN', 'adopted proposal pointer changed')
      }
      publicationState = 'COMPLETE'
      return { pointer: confirmedStable.value, publicationStatus: 'ADOPTED_EXISTING' }
    }
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    const stable = await readStableProposalPointer(paths.pointerPath)
    if (!stable.bytes.equals(pointerBytes)
      || !publishedOwnWithIndependentPointerInode
        && (stable.identity.dev !== pointerTemporary.identity.dev
          || stable.identity.ino !== pointerTemporary.identity.ino)) {
      publicationState = 'PUBLICATION_UNKNOWN'
      fail('PROPOSAL_COMMIT_UNCERTAIN', 'proposal pointer identity')
    }
    const verifiedPublished = await verifyProposalBundle({
      paths,
      bundleParentBoundary,
      pointer: stable.value,
      inputManifest,
      closure,
      sourcePublication,
      runtime,
      proposalEvidence,
    })
    await verifiedPublished.bundleBoundary.handle.close()
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    await unlinkOwnedPointerTemporary(
      pointerTemporary,
      'PROPOSAL_RESIDUE_CLEANUP_FAILED',
    )
    pointerTemporary = undefined
    const converged = await readStableProposalPointer(paths.pointerPath)
    if (!converged.bytes.equals(pointerBytes) || converged.identity.nlink !== 1) {
      fail('PROPOSAL_RESIDUE_CLEANUP_FAILED', 'proposal pointer final state')
    }
    await assertProposalPublicationBoundaries({
      workspaceBoundary,
      pointerParentBoundary,
      bundleParentBoundary,
      bundleBoundary,
    })
    const verifiedConverged = await verifyProposalBundle({
      paths,
      bundleParentBoundary,
      pointer: converged.value,
      inputManifest,
      closure,
      sourcePublication,
      runtime,
      proposalEvidence,
    })
    await verifiedConverged.bundleBoundary.handle.close()
    const confirmed = await readStableProposalPointer(paths.pointerPath)
    if (confirmed.identity.dev !== converged.identity.dev
      || confirmed.identity.ino !== converged.identity.ino
      || confirmed.identity.nlink !== 1
      || !confirmed.bytes.equals(converged.bytes)) {
      fail('PROPOSAL_COMMIT_UNCERTAIN', 'published proposal pointer changed')
    }
    publicationState = 'COMPLETE'
    return { pointer: confirmed.value, publicationStatus: 'PUBLISHED' }
  } catch (error) {
    if (['PUBLISHED_OWN', 'PUBLICATION_UNKNOWN'].includes(publicationState)
      && !['PROPOSAL_COMMIT_UNCERTAIN', 'PROPOSAL_RESIDUE_CLEANUP_FAILED'].includes(error?.code)) {
      fail('PROPOSAL_COMMIT_UNCERTAIN', 'published proposal verification')
    }
    if ((!linkAttempted || publicationState === 'LINK_DID_NOT_PUBLISH')
      && !['PUBLISHED_OWN', 'ADOPTED_EXISTING', 'PUBLICATION_UNKNOWN', 'COMPLETE'].includes(publicationState)) {
      if (pointerTemporary) {
        await unlinkOwnedPointerTemporary(
          pointerTemporary,
          'PROPOSAL_RESIDUE_CLEANUP_FAILED',
        )
        pointerTemporary = undefined
      }
      if (bundleRoot && bundleBoundary && bundleParentBoundary && ownerMarker) {
        await cleanupOwnedDirectory({
          parentBoundary: bundleParentBoundary,
          ownedBoundary: bundleBoundary,
          root: bundleRoot,
          ownerMarker,
          quarantinePrefix: '.cleanup-proposal-',
          ownershipCode: 'PROPOSAL_CLEANUP_OWNERSHIP_LOST',
          cleanupCode: 'PROPOSAL_CLEANUP_FAILED',
        })
        bundleBoundary = undefined
        bundleRoot = undefined
      }
    }
    throw error
  } finally {
    await bundleBoundary?.handle.close().catch(() => {})
    await bundleParentBoundary?.handle.close().catch(() => {})
    await pointerParentBoundary.handle.close().catch(() => {})
  }
}

async function createOwnedReplayRoot(workspaceRoot, workspaceBoundary) {
  const replayParent = resolve(workspaceRoot, '.tmp/dsh-pm-workbench/rc6-declaration-v2-replays')
  await ensureDescendantDirectoryChain(
    workspaceBoundary,
    replayParent,
    'REPLAY_PATH_CONTAINMENT',
    'replay parent',
  )
  const parentBoundary = await openBoundDirectory(
    replayParent,
    'REPLAY_PATH_CONTAINMENT',
    'replay parent',
  )
  let root
  try {
    root = await mkdtemp(resolve(replayParent, 'replay-'))
  } catch (error) {
    await parentBoundary.handle.close().catch(() => {})
    fail('REPLAY_ROOT_CREATE_FAILED', 'replay root')
  }
  let rootBoundary
  try {
    rootBoundary = await openBoundDirectory(root, 'REPLAY_PATH_CONTAINMENT', 'replay root')
    if (rootBoundary.canonicalPath !== resolve(parentBoundary.canonicalPath, basename(root))) {
      fail('REPLAY_PATH_CONTAINMENT', 'replay root relationship')
    }
    const ownerMarker = randomBytes(16).toString('hex')
    await writeBundleFile(resolve(root, '.owner'), Buffer.from(ownerMarker, 'utf8'))
    return { root, rootBoundary, parentBoundary, ownerMarker }
  } catch (error) {
    await rootBoundary?.handle.close().catch(() => {})
    await parentBoundary.handle.close().catch(() => {})
    fail('REPLAY_ROOT_CREATE_FAILED', 'replay root initialization')
  }
}

export async function stageRc6DeclarationInputV2(options) {
  if (!isObject(options)
    || Object.keys(options).length !== 1 || !Object.hasOwn(options, 'workspaceRoot')
    || typeof options.workspaceRoot !== 'string' || options.workspaceRoot === '') {
    fail('STAGE_OPTIONS_MISMATCH', 'stageRc6DeclarationInputV2 options')
  }
  const { workspaceRoot } = options
  const workspaceBoundary = await openBoundDirectory(
    workspaceRoot,
    'BUNDLE_PATH_CONTAINMENT',
    'workspace root',
  )
  let replay
  let replayCleaned = false
  let committedAncestorBoundaries = []
  try {
    for (const relativePath of [
      'tools/harness-rc6-declarations/input-manifest.json',
      'tools/harness-rc6-declarations/package.json',
      'tools/harness-rc6-declarations/package-lock.json',
      'research/2026-09-05-rc6-declaration-closure.json',
      'package-lock.json',
    ]) {
      await assertDescendantDirectoryChain(workspaceBoundary, resolve(workspaceRoot, relativePath), {
        code: 'BUNDLE_PATH_CONTAINMENT',
        missingCode: 'INPUT_READ_FAILED',
        logicalLabel: 'committed declaration evidence',
      })
    }
    committedAncestorBoundaries = await snapshotCommittedAncestorBoundaries(
      workspaceRoot,
      workspaceBoundary,
    )
    const [files, closureFile] = await Promise.all([
      readCommittedDeclarationFiles(workspaceRoot),
      readJsonFile(resolve(workspaceRoot, 'research/2026-09-05-rc6-declaration-closure.json')),
    ])
    const bootstrap = await inspectCommittedV1Bootstrap(workspaceRoot, files)
    const pointerPath = fixtureBundlePaths(workspaceRoot).pointerPath
    try {
      const pointerStat = await lstat(pointerPath)
      if (!pointerStat.isFile() || pointerStat.isSymbolicLink()) {
        fail('STABLE_POINTER_REQUIRED', 'selected-source publication')
      }
    } catch (error) {
      if (error?.ownedInputError === true) throw error
      if (error?.code === 'ENOENT') fail('STABLE_POINTER_REQUIRED', 'selected-source publication')
      throw error
    }
    const packageJson = files.packageFile.value
    const packageLock = files.lockFile.value
    const lockModel = deriveCanonicalLockInput(packageJson, packageLock)
    const publicationIdentity = {
      inputLabel: bootstrap.inputManifest.inputLabel,
      authorizationBasis: bootstrap.inputManifest.authorizationBasis,
      packageJsonRawSha256: files.packageFile.rawSha256,
      packageJsonCanonicalSha256: files.packageFile.canonicalSha256,
      packageLockRawSha256: files.lockFile.rawSha256,
      packageLockCanonicalSha256: files.lockFile.canonicalSha256,
      packageCounts: {
        registry: EXPECTED.registryPackageCount,
        deepseek: EXPECTED.deepseekPackageCount,
        dsh: EXPECTED.dshPackageCount,
      },
    }
    const publicationBefore = await consumeSelectedSourcePublication({
      workspaceRoot,
      lockModel,
      publicationIdentity,
    })
    const selectedCacheEntries = canonicalSelectedCacheEntries(publicationBefore.snapshot.entries)
    const selectedHashes = computeSelectedCacheHashes(selectedCacheEntries)
    if (selectedHashes.selectedCacheIndexSha256 !== publicationBefore.descriptor.selectedCacheIndexSha256
      || selectedHashes.selectedContentAggregateSha256 !== publicationBefore.descriptor.selectedContentAggregateSha256
      || publicationBefore.descriptor.packageJsonRawSha256 !== files.packageFile.rawSha256
      || publicationBefore.descriptor.packageLockRawSha256 !== files.lockFile.rawSha256) {
      fail('PUBLISHED_LOGICAL_INPUT_MISMATCH', 'descriptor')
    }
    const nodePath = await realpathWithStableMissingCode(process.execPath, 'INVALID_NODE_EXECUTABLE')
    const npmCliPath = await realpathWithStableMissingCode(
      resolve(dirname(nodePath), NPM_CLI_RELATIVE_FROM_NODE),
      'INVALID_NPM_CLI',
    )
    const runtime = await readRuntimeIdentity(nodePath, npmCliPath)
    if (canonicalJsonBytes(runtime) !== canonicalJsonBytes(EXPECTED_RUNTIME)
      || canonicalJsonBytes(runtime) !== canonicalJsonBytes(bootstrap.inputManifest.runtime)) {
      fail('RUNTIME_IDENTITY_MISMATCH', 'bootstrap runtime')
    }
    const contractSnapshots = await readImmutableContractSnapshots(workspaceRoot, workspaceBoundary)
    const compilerSourceSnapshot = await snapshotCompilerToolchainSource(
      workspaceRoot,
      workspaceBoundary,
    )
    const acceptanceSourcePath = fileURLToPath(import.meta.url)
    const verifierSourcePath = resolve(moduleDirectory, 'verify-rc6-declaration-closure.mjs')
    const [acceptanceSourceSnapshot, verifierSourceSnapshot] = await Promise.all([
      readBoundSourceFile(
        acceptanceSourcePath,
        'VERIFIER_SOURCE_MISMATCH',
        4 * 1024 * 1024,
        'VERIFIER_SOURCE_MISMATCH',
        'acceptance source',
      ),
      readBoundSourceFile(
        verifierSourcePath,
        'VERIFIER_SOURCE_MISMATCH',
        4 * 1024 * 1024,
        'VERIFIER_SOURCE_MISMATCH',
        'verifier source',
      ),
    ])
    if (normalizedAcceptanceSourceSha256(acceptanceSourceSnapshot.bytes)
        !== EXPECTED_ACCEPTANCE_SOURCE_NORMALIZED_SHA256) {
      fail('VERIFIER_SOURCE_MISMATCH', 'acceptance source hash')
    }
    if (verifierSourceSnapshot.identity.sha256 !== EXPECTED_VERIFIER_SOURCE_SHA256) {
      fail('VERIFIER_SOURCE_MISMATCH', 'verifier source hash')
    }
    const verificationSourceSnapshot = {
      acceptancePath: acceptanceSourcePath,
      acceptance: acceptanceSourceSnapshot,
      verifierPath: verifierSourcePath,
      verifier: verifierSourceSnapshot,
    }
    const inputManifest = {
    schemaVersion: '2',
    inputLabel: bootstrap.inputManifest.inputLabel,
    authorizationBasis: bootstrap.inputManifest.authorizationBasis,
    packageJsonSha256: files.packageFile.rawSha256,
    packageLockSha256: files.lockFile.rawSha256,
    lockfileVersion: packageLock.lockfileVersion,
    acceptedRootPackage: {
      name: packageJson.name,
      private: packageJson.private,
      devDependencies: packageJson.devDependencies,
    },
    packageCounts: bootstrap.inputManifest.packageCounts,
    dshVersion: bootstrap.inputManifest.dshVersion,
    nestedCommander: bootstrap.inputManifest.nestedCommander,
    selectedCache: {
      entries: selectedCacheEntries,
      totalBytes: publicationBefore.snapshot.totalBytes,
    },
    ...selectedHashes,
    proposalStage: {
      command: 'stageRc6DeclarationInputV2({ workspaceRoot })',
      result: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
    },
    runtime,
    compilerToolchain: expectedCompilerToolchain,
    productionBoundary: expectedProductionBoundary,
    lockProjectionSha256: lockModel.sha256,
    }
    validateInputManifest({
      inputManifest,
      packageJson,
      packageLock,
      rootPackageLock: files.rootLockFile.value,
    })
    await validateProductionBoundary({ workspaceRoot, inputManifest })

    replay = await createOwnedReplayRoot(workspaceRoot, workspaceBoundary)
    await writeReplayInputs({
      replayBoundary: replay.rootBoundary,
      replayRoot: replay.root,
      committedFiles: files,
      contractSnapshots,
    })
    const homeRoot = resolve(replay.root, '.home')
    const tempRoot = resolve(replay.root, '.tmp')
    const logRoot = resolve(replay.root, '.logs')
    await settleOwnedMutations([
      ensureDescendantDirectoryChain(replay.rootBoundary, homeRoot, 'REPLAY_PATH_CONTAINMENT', 'replay home'),
      ensureDescendantDirectoryChain(replay.rootBoundary, tempRoot, 'REPLAY_PATH_CONTAINMENT', 'replay temp'),
      ensureDescendantDirectoryChain(replay.rootBoundary, logRoot, 'REPLAY_PATH_CONTAINMENT', 'replay logs'),
    ])
    const userNpmrc = resolve(replay.root, 'user.npmrc')
    const globalNpmrc = resolve(replay.root, 'global.npmrc')
    const npmrc = 'ignore-scripts=true\noffline=true\naudit=false\nfund=false\nupdate-notifier=false\n'
    await settleOwnedMutations([
      writeBundleFile(userNpmrc, Buffer.from(npmrc, 'utf8')),
      writeBundleFile(globalNpmrc, Buffer.from(npmrc, 'utf8')),
    ])
    const npmArguments = [
      npmCliPath,
      'ci',
      '--ignore-scripts',
      '--offline',
      '--audit=false',
      '--fund=false',
      '--update-notifier=false',
      `--cache=${publicationBefore.bundleRoot}`,
      `--prefix=${replay.root}`,
      `--logs-dir=${logRoot}`,
      `--userconfig=${userNpmrc}`,
      `--globalconfig=${globalNpmrc}`,
    ]
    try {
      await execFileAsync(nodePath, npmArguments, {
        cwd: replay.root,
        env: {
          HOME: homeRoot,
          TMPDIR: tempRoot,
        },
        maxBuffer: 10 * 1024 * 1024,
        timeout: 120_000,
      })
    } catch {
      fail('OFFLINE_REPLAY_FAILED', 'npm ci')
    }
    const publicationAfter = await consumeSelectedSourcePublication({
      workspaceRoot,
      lockModel,
      publicationIdentity,
    })
    assertSamePublication(publicationBefore, publicationAfter)
    const compilerSnapshot = await materializeReplayCompilerToolchain({
      replayRoot: replay.root,
      replayBoundary: replay.rootBoundary,
      sourceSnapshot: compilerSourceSnapshot,
    })
    const verificationSnapshot = await materializeReplayVerificationSources({
      replayRoot: replay.root,
      replayBoundary: replay.rootBoundary,
      sourceSnapshot: verificationSourceSnapshot,
    })
    const verifierUrl = pathToFileURL(verificationSnapshot.verifierPath)
    verifierUrl.searchParams.set('sha256', verifierSourceSnapshot.identity.sha256)
    const verifier = await import(verifierUrl.href)
    if (typeof verifier.verifyStagedDeclarationClosure !== 'function') {
      fail('OFFLINE_REPLAY_FAILED', 'staged closure verifier unavailable')
    }
    let verified
    let verifiedIdentity
    try {
      verified = await verifier.verifyStagedDeclarationClosure({
        workspaceRoot,
        inputManifest,
        stagingRoot: replay.root,
      })
      verifiedIdentity = successfulStagedVerificationIdentity(verified)
    } catch {
      fail('STAGED_REPLAY_VERIFICATION_FAILED', 'staged closure verification')
    }
    const hostCompileResult = await runDeclarationCompile({
      nodePath,
      compilerSnapshot,
      replayRoot: replay.root,
      homeRoot,
      tempRoot,
      surface: 'host',
      configRelativePath: 'tsconfig.surface.host.json',
      contractRelativePath: 'tools/harness-rc6-declarations/contracts/harness-host-rc6-surface.ts',
    })
    const clientCompileResult = await runDeclarationCompile({
      nodePath,
      compilerSnapshot,
      replayRoot: replay.root,
      homeRoot,
      tempRoot,
      surface: 'client',
      configRelativePath: CLIENT_COMPILER_OVERLAY_RELATIVE,
      contractRelativePath: 'tools/harness-rc6-declarations/contracts/harness-client-rc6-surface.ts',
    })
    const compileResults = {
      host: hostCompileResult,
      client: clientCompileResult,
    }
    let verifiedAfterCompile
    let verifiedAfterCompileIdentity
    try {
      verifiedAfterCompile = await verifier.verifyStagedDeclarationClosure({
        workspaceRoot,
        inputManifest,
        stagingRoot: replay.root,
      })
      verifiedAfterCompileIdentity = successfulStagedVerificationIdentity(verifiedAfterCompile)
    } catch {
      fail('STAGED_REPLAY_VERIFICATION_FAILED', 'post-compile closure verification')
    }
    if (canonicalJsonBytes(verifiedAfterCompileIdentity)
      !== canonicalJsonBytes(verifiedIdentity)) {
      fail('PUBLISHED_LOGICAL_INPUT_MISMATCH', 'closure changed during compile')
    }
    await assertReplayVerificationSourcesUnchanged(verificationSnapshot)
    const closure = {
      schemaVersion: '2',
      generationCommand: 'stageRc6DeclarationInputV2({ workspaceRoot })',
      inputManifestSha256: sha256(canonicalDocumentBytes(inputManifest)),
      packageLockSha256: inputManifest.packageLockSha256,
      packageCounts: inputManifest.packageCounts,
      runtime: inputManifest.runtime,
      fullDeepseekCohort: verified.closure.fullDeepseekCohort,
      selectedDeclarationSubgraph: verified.closure.selectedDeclarationSubgraph,
    }
    assertSafeManifestStrings(inputManifest, 'v2 input proposal')
    assertSafeManifestStrings(closure, 'v2 closure proposal')
    await assertCommittedEvidenceUnchanged(
      workspaceRoot,
      files,
      closureFile,
      workspaceBoundary,
      committedAncestorBoundaries,
    )
    await assertImmutableContractSnapshotsUnchanged(workspaceRoot, contractSnapshots)
    await assertReplayCompilerToolchainUnchanged(compilerSnapshot)
    await assertReplayVerificationSourcesUnchanged(verificationSnapshot)
    const proposalEvidence = {
      acceptanceSourceSha256: acceptanceSourceSnapshot.identity.sha256,
      verifierSourceSha256: verifierSourceSnapshot.identity.sha256,
      compilerSourceAggregateSha256: compilerSnapshot.evidence.sourceAggregateSha256,
      compilerSealedAggregateSha256: compilerSnapshot.evidence.sealedAggregateSha256,
      verifierResultSha256: sha256(canonicalJsonBytes(verifiedAfterCompileIdentity)),
      compileResults,
      compilerResultSha256: sha256(canonicalJsonBytes(compileResults)),
    }
    assertProposalEvidence(proposalEvidence)
    await cleanupOwnedDirectory({
      parentBoundary: replay.parentBoundary,
      ownedBoundary: replay.rootBoundary,
      root: replay.root,
      ownerMarker: replay.ownerMarker,
      quarantinePrefix: '.cleanup-replay-',
      ownershipCode: 'REPLAY_CLEANUP_OWNERSHIP_LOST',
      cleanupCode: 'REPLAY_CLEANUP_FAILED',
    })
    await replay.parentBoundary.handle.close()
    replayCleaned = true
    replay = undefined
    const publicationFinal = await consumeSelectedSourcePublication({
      workspaceRoot,
      lockModel,
      publicationIdentity,
    })
    assertSamePublication(publicationBefore, publicationFinal)
    const assertPreCommit = async () => {
      const runtimeBeforeCommit = await readRuntimeIdentity(nodePath, npmCliPath)
      if (canonicalJsonBytes(runtimeBeforeCommit) !== canonicalJsonBytes(runtime)) {
        fail('RUNTIME_IDENTITY_MISMATCH', 'runtime changed during replay')
      }
      const publicationBeforeCommit = await consumeSelectedSourcePublication({
        workspaceRoot,
        lockModel,
        publicationIdentity,
      })
      assertSamePublication(publicationFinal, publicationBeforeCommit)
      await assertCommittedEvidenceUnchanged(
        workspaceRoot,
        files,
        closureFile,
        workspaceBoundary,
        committedAncestorBoundaries,
      )
      await assertImmutableContractSnapshotsUnchanged(workspaceRoot, contractSnapshots)
      await assertCompilerToolchainSourceUnchanged(compilerSourceSnapshot)
      await assertVerificationSourcesUnchanged(verificationSourceSnapshot)
      await validateProductionBoundary({ workspaceRoot, inputManifest })
      validateInputManifest({
        inputManifest,
        packageJson,
        packageLock,
        rootPackageLock: files.rootLockFile.value,
      })
    }
    if (REPLAY_EVIDENCE_KIND !== 'REAL_NPM_CLI') {
      await assertPreCommit()
      return {
        status: 'INCONCLUSIVE_SYNTHETIC_REPLAY',
        evidenceKind: REPLAY_EVIDENCE_KIND,
        selectedCount: inputManifest.selectedCache.entries.length,
        selectedBytes: inputManifest.selectedCache.totalBytes,
        fullDeepseekCount: closure.fullDeepseekCohort.length,
        selectedDeclarationCount: closure.selectedDeclarationSubgraph.records.length,
        candidateInputManifestSha256: sha256(canonicalDocumentBytes(inputManifest)),
        candidateClosureSha256: sha256(canonicalDocumentBytes(closure)),
      }
    }
    const published = await publishV2ProposalBundle({
      workspaceRoot,
      workspaceBoundary,
      inputManifest,
      closure,
      sourcePublication: publicationFinal,
      runtime,
      proposalEvidence,
      assertPreCommit,
    })
    const proposalBase = `.tmp/dsh-pm-workbench/${published.pointer.bundleRelativePath}`
    return {
      status: 'PASS_STAGED_RC6_DECLARATION_INPUT_V2',
      replayStatus: verified.status,
      publicationStatus: published.publicationStatus,
      proposalPointer: V2_PROPOSAL_POINTER_RELATIVE,
      inputManifestProposal: `${proposalBase}/${V2_PROPOSAL_INPUT_NAME}`,
      closureProposal: `${proposalBase}/${V2_PROPOSAL_CLOSURE_NAME}`,
    }
  } finally {
    let cleanupFailed = false
    if (replay && !replayCleaned) {
      try {
        await cleanupOwnedDirectory({
          parentBoundary: replay.parentBoundary,
          ownedBoundary: replay.rootBoundary,
          root: replay.root,
          ownerMarker: replay.ownerMarker,
          quarantinePrefix: '.cleanup-replay-',
          ownershipCode: 'REPLAY_CLEANUP_OWNERSHIP_LOST',
          cleanupCode: 'REPLAY_CLEANUP_FAILED',
        })
      } catch {
        cleanupFailed = true
      }
      await replay.parentBoundary.handle.close().catch(() => { cleanupFailed = true })
    }
    await Promise.all(
      committedAncestorBoundaries.map((boundary) => boundary.handle.close().catch(() => {})),
    )
    await workspaceBoundary.handle.close().catch(() => {})
    if (cleanupFailed) fail('REPLAY_CLEANUP_FAILED', 'replay cleanup')
  }
}

export async function acceptRc6DeclarationInput(_options) {
  fail('LEGACY_ACCEPT_DISABLED', 'use stageRc6DeclarationInputV2')
}

async function main() {
  try {
    await acceptRc6DeclarationInput()
  } catch (error) {
    process.stdout.write(canonicalJson(mapPublicInputError(error)))
    process.exitCode = 1
  }
}

if (basename(process.argv[1] ?? '') === 'accept-rc6-declaration-input.mjs') void main()
