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

function fail(code, detail) {
  const error = new Error(`${code}: ${detail}`)
  error.code = code
  Object.defineProperty(error, 'ownedInputError', { value: true })
  throw error
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

const V2_SELECTED_INDEX_SHA256 = '26ace684b811eed1aff8627aaaf072f346a5a9983676ac5d4607a2690b09e001'
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
}

async function sha256File(path, missingCode) {
  return sha256(await readFileWithStableMissingCode(path, undefined, missingCode))
}

async function readJsonFile(path) {
  let handle
  try {
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  } catch {
    fail('INPUT_READ_FAILED', 'json input')
  }
  let bytes
  try {
    const before = await handle.stat()
    if (!before.isFile() || before.nlink !== 1) fail('INPUT_READ_FAILED', 'json input')
    bytes = await handle.readFile()
    const after = await handle.stat()
    if (before.dev !== after.dev || before.ino !== after.ino || before.size !== after.size
      || before.nlink !== after.nlink || before.mtimeMs !== after.mtimeMs || before.ctimeMs !== after.ctimeMs) {
      fail('SOURCE_FILE_IDENTITY_CHANGED', 'json input')
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
  'ACCEPTANCE_RESULT_MISMATCH', 'RUNTIME_IDENTITY_TYPE_MISMATCH', 'RUNTIME_IDENTITY_MISMATCH',
  'COMMITTED_INPUT_BYTE_HASH_MISMATCH', 'INVALID_COMMITTED_SELECTED_CACHE', 'INVALID_COMMITTED_CACHE_ENTRY',
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
  'SOURCE_FILE_IDENTITY_CHANGED', 'PREPARE_OPTIONS_MISMATCH',
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
])

const PUBLIC_INPUT_SCHEMA_CODES = new Set(publicInputSchemaCodes)
const PUBLIC_INPUT_MISMATCH_CODES = new Set(publicInputMismatchCodes)
const PUBLIC_INPUT_OPERATIONAL_CODES = new Set(publicInputOperationalCodes)

export function mapPublicInputError(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
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
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  } catch (error) {
    if (error && error.code === 'ENOENT') fail(code, path)
    throw error
  }
  try {
    return await handle.readFile()
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
    handle = await open(path, fsConstants.O_RDONLY | fsConstants.O_NOFOLLOW)
  } catch (error) {
    if (error?.code === 'ELOOP') fail(symlinkCode, logicalLabel)
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
  if (entry.isDirectory()) {
    for (const name of await readdir(path)) await makeTreeReadOnlyStrict(resolve(path, name))
    await chmod(path, 0o555)
  } else if (entry.isFile()) {
    await chmod(path, 0o444)
  } else fail('CACHE_INVENTORY_SPECIAL', path)
}

async function makeTreeWritableForCleanup(path) {
  const entry = await lstat(path)
  if (entry.isSymbolicLink()) return
  if (entry.isDirectory()) {
    await chmod(path, 0o755)
    for (const name of await readdir(path)) await makeTreeWritableForCleanup(resolve(path, name))
  } else if (entry.isFile()) {
    await chmod(path, 0o644)
  }
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
  } catch {
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
    await handle.chmod(0o444)
    const afterWrite = await handle.stat()
    if (!afterWrite.isFile() || afterWrite.nlink !== 1 || (afterWrite.mode & 0o222) !== 0) fail('BUNDLE_TARGET_WRITE_FAILED', target)
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
    handle = await open(temporary, fsConstants.O_RDWR | fsConstants.O_CREAT | fsConstants.O_EXCL | fsConstants.O_NOFOLLOW, 0o600)
    await handle.writeFile(pointerBytes)
    await handle.chmod(0o444)
    await handle.sync()
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
  if (identity.mode !== 0o444) fail('STABLE_POINTER_LINK_STATE', 'stable pointer mode')
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
    await chmod(bundleRoot, 0o755)
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

function canonicalSelectedCacheEntries(entries) {
  return entries.map((entry) => ({
    lockPath: entry.lockPath,
    name: entry.name,
    version: entry.version,
    integrity: entry.integrity,
    key: entry.key,
    indexChecksum: entry.indexChecksum,
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
  assertExactKeys(compilerToolchain, ['typescript', 'nodeTypes', 'undiciTypes'], 'compilerToolchain')
  if (!isObject(rootPackageLock?.packages)) fail('INVALID_ROOT_LOCKFILE', 'packages')
  for (const [key, expected] of Object.entries(expectedCompilerToolchain)) {
    const actual = compilerToolchain[key]
    assertExactKeys(actual, ['lockPath', 'version', 'integrity'], `compilerToolchain.${key}`)
    if (JSON.stringify(actual) !== JSON.stringify(expected)) fail('COMPILER_TOOLCHAIN_MISMATCH', key)
    const rootEntry = rootPackageLock.packages[expected.lockPath]
    if (!isObject(rootEntry) || rootEntry.version !== expected.version || rootEntry.integrity !== expected.integrity) {
      fail('ROOT_LOCK_TOOLCHAIN_MISMATCH', expected.lockPath)
    }
  }
}

function assertProductionBoundaryShape(productionBoundary) {
  assertExactKeys(productionBoundary, ['baselineCommit', 'files', 'aggregateSha256'], 'productionBoundary')
  if (JSON.stringify(productionBoundary) !== JSON.stringify(expectedProductionBoundary)) {
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
    await assertRegularFile(absolutePath, 'PRODUCTION_BOUNDARY_FILE_MISSING')
    files.push({ path, sha256: await sha256File(absolutePath, 'PRODUCTION_BOUNDARY_FILE_MISSING') })
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
    'selectedCache', 'selectedCacheIndexSha256', 'selectedContentAggregateSha256', 'acceptance',
    'runtime', 'compilerToolchain', 'productionBoundary', 'lockProjectionSha256',
  ], 'inputManifest')
  assertSafeManifestStrings(inputManifest)
  if (inputManifest.schemaVersion !== '2' || inputManifest.lockfileVersion !== 3) fail('INPUT_MANIFEST_VERSION_MISMATCH', String(inputManifest.schemaVersion))
  if (inputManifest.inputLabel !== EXPECTED.label || inputManifest.authorizationBasis !== EXPECTED.authorizationBasis) fail('INPUT_MANIFEST_TEXT_INVALID', 'inputLabel/authorizationBasis')
  if (inputManifest.packageJsonSha256 !== '208bae9d2b2c0d67b2fa6b985d394cc1ce483e3a5cd226e391ca0a6b7f261cd1' || inputManifest.packageLockSha256 !== 'dde74c404cfbf8e7b1ec7cabece36d2aa2061f256770570f69c15f3064061ad1') fail('ACCEPTED_INPUT_HASH_MISMATCH', 'packageJson/packageLock')
  assertExactKeys(inputManifest.acceptedRootPackage, ['name', 'private', 'devDependencies'], 'acceptedRootPackage')
  if (inputManifest.acceptedRootPackage.name !== packageJson.name || inputManifest.acceptedRootPackage.private !== true || !sameStringMap(inputManifest.acceptedRootPackage.devDependencies, packageJson.devDependencies)) fail('ACCEPTED_ROOT_PACKAGE_MISMATCH', 'name/private/devDependencies')
  assertExactKeys(inputManifest.packageCounts, ['registry', 'deepseek', 'dsh'], 'packageCounts')
  if (JSON.stringify(inputManifest.packageCounts) !== JSON.stringify({ registry: 169, deepseek: 59, dsh: 54 })) fail('PACKAGE_COUNTS_MISMATCH', 'packageCounts')
  if (inputManifest.dshVersion !== EXPECTED.dshVersion || JSON.stringify(inputManifest.nestedCommander) !== JSON.stringify(EXPECTED.nestedCommander)) fail('DECLARATION_COHORT_MISMATCH', 'dsh/nested commander')
  assertExactKeys(inputManifest.selectedCache, ['entries', 'totalBytes'], 'selectedCache')
  if (!Array.isArray(inputManifest.selectedCache.entries) || inputManifest.selectedCache.entries.length !== EXPECTED.registryPackageCount || inputManifest.selectedCache.totalBytes !== EXPECTED.selectedContentBytes) fail('SELECTED_CACHE_COUNT_OR_BYTES_MISMATCH', 'selectedCache')
  const projection = deriveCanonicalLockInput(packageJson, packageLock)
  const seen = new Set()
  let previous = null
  for (let index = 0; index < inputManifest.selectedCache.entries.length; index += 1) {
    const entry = inputManifest.selectedCache.entries[index]
    assertExactKeys(entry, ['lockPath', 'name', 'version', 'integrity', 'key', 'indexChecksum', 'byteLength', 'contentDigest'], `selectedCache.entries[${index}]`)
    if (typeof entry.lockPath !== 'string' || typeof entry.indexChecksum !== 'string' || !Number.isSafeInteger(entry.byteLength) || entry.byteLength < 0) fail('INVALID_SELECTED_CACHE_ENTRY', String(index))
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
  assertExactKeys(inputManifest.acceptance, ['command', 'result'], 'acceptance')
  if (inputManifest.acceptance.command !== 'node scripts/accept-rc6-declaration-input.mjs' || !['PASS_ACCEPTED_INPUT', 'PASS_OFFLINE_INSTALL'].includes(inputManifest.acceptance.result)) fail('ACCEPTANCE_RESULT_MISMATCH', 'acceptance')
  assertExactKeys(inputManifest.runtime, ['node', 'npm'], 'runtime')
  assertExactKeys(inputManifest.runtime.node, ['version', 'basename', 'sha256'], 'runtime.node')
  assertExactKeys(inputManifest.runtime.npm, ['version', 'cliBasename', 'cliSha256'], 'runtime.npm')
  for (const [label, value] of Object.entries({ ...inputManifest.runtime.node, ...inputManifest.runtime.npm })) if (typeof value !== 'string') fail('RUNTIME_IDENTITY_TYPE_MISMATCH', label)
  if (JSON.stringify(inputManifest.runtime) !== JSON.stringify(EXPECTED_RUNTIME)) fail('RUNTIME_IDENTITY_MISMATCH', 'runtime')
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
  await makeTreeReadOnly(targetCacheRoot)
}

async function makeTreeReadOnly(path) {
  const entryStat = await lstat(path)
  if (entryStat.isSymbolicLink()) fail('CACHE_SYMLINK_FORBIDDEN', path)
  if (entryStat.isDirectory()) {
    for (const child of await readdir(path)) await makeTreeReadOnly(resolve(path, child))
    await chmod(path, 0o555)
    return
  }
  if (entryStat.isFile()) await chmod(path, 0o444)
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

async function readRuntimeIdentity(nodePath, npmCliPath) {
  await assertRegularFile(nodePath, 'INVALID_NODE_EXECUTABLE')
  await assertRegularFile(npmCliPath, 'INVALID_NPM_CLI')
  return {
    node: {
      version: process.version,
      basename: basename(nodePath),
      sha256: await sha256File(nodePath),
    },
    npm: {
      version: (await execFileAsync(nodePath, [npmCliPath, '--version'])).stdout.trim(),
      cliBasename: basename(npmCliPath),
      cliSha256: await sha256File(npmCliPath),
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

export async function inspectCommittedDeclarationInput({ workspaceRoot = DEFAULT_WORKSPACE_ROOT } = {}) {
  const inputPath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/input-manifest.json')
  const packagePath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/package.json')
  const lockPath = resolve(workspaceRoot, 'tools/harness-rc6-declarations/package-lock.json')
  const { value: inputManifest } = await readJsonFile(inputPath)
  const { value: packageJson } = await readJsonFile(packagePath)
  const { value: packageLock } = await readJsonFile(lockPath)
  const { value: rootPackageLock } = await readJsonFile(resolve(workspaceRoot, 'package-lock.json'))
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
  const indexHash = sha256(canonicalJson(normalizedEntries))
  const contentHash = sha256(canonicalJson(inputManifest.schemaVersion === '1'
    ? legacyCanonicalContentAggregate(normalizedEntries)
    : canonicalContentAggregate(normalizedEntries)))
  const packageJsonSha256 = await sha256File(packagePath)
  const packageLockSha256 = await sha256File(lockPath)
  if (inputManifest.schemaVersion === '2') {
    if (packageJsonSha256 !== inputManifest.packageJsonSha256 || packageLockSha256 !== inputManifest.packageLockSha256) {
      fail('COMMITTED_INPUT_BYTE_HASH_MISMATCH', 'packageJson/packageLock')
    }
    validateInputManifest({ inputManifest, packageJson, packageLock, rootPackageLock })
    await validateProductionBoundary({ workspaceRoot, inputManifest })
  }
  return {
    inputManifest,
    packageJson,
    packageLock,
    packageJsonSha256,
    packageLockSha256,
    selectedCacheIndexSha256: indexHash,
    selectedContentAggregateSha256: contentHash,
    ...(inputManifest.schemaVersion === '1'
      ? { status: 'CHANGES_REQUIRED_REVIEW', reason: 'INPUT_MANIFEST_V2_PENDING_B2' }
      : { status: 'PASS_STATIC_METADATA' }),
  }
}

export async function acceptRc6DeclarationInput({
  workspaceRoot = DEFAULT_WORKSPACE_ROOT,
  candidateRoot = DEFAULT_CANDIDATE_ROOT,
  replay = true,
} = {}) {
  const committed = await inspectCommittedDeclarationInput({ workspaceRoot })
  if (committed.inputManifest.schemaVersion !== '2') {
    return {
      status: 'CHANGES_REQUIRED_REVIEW',
      reason: 'INPUT_MANIFEST_V2_PENDING_B2',
    }
  }
  await assertDirectory(candidateRoot, 'INVALID_CANDIDATE_ROOT')
  const candidatePath = resolve(candidateRoot, 'candidate.json')
  const packagePath = resolve(candidateRoot, 'package.json')
  const lockPath = resolve(candidateRoot, 'package-lock.json')
  await Promise.all([assertRegularFile(candidatePath), assertRegularFile(packagePath), assertRegularFile(lockPath)])
  const { value: candidate } = await readJsonFile(candidatePath)
  const { value: packageJson } = await readJsonFile(packagePath)
  const { value: packageLock } = await readJsonFile(lockPath)
  assertProductionCandidateShape(candidate)
  assertCandidateShape(candidate, packageJson, packageLock)
  if (typeof candidate.sourceCacheRoot !== 'string' || typeof candidate.npmCliPath !== 'string') {
    fail('INVALID_CANDIDATE_LIVE_PATHS', 'sourceCacheRoot/npmCliPath')
  }
  const sourceCacheRoot = await realpathWithStableMissingCode(candidate.sourceCacheRoot, 'INVALID_SOURCE_CACHE')
  const npmCliPath = await realpathWithStableMissingCode(candidate.npmCliPath, 'INVALID_NPM_CLI')
  const nodePath = await realpathWithStableMissingCode(process.execPath, 'INVALID_NODE_EXECUTABLE')
  const selected = await readSelectedCacheRecords({ cacheRoot: sourceCacheRoot, packageLock })
  const paths = {
    targetCacheRoot: resolve(workspaceRoot, '.tmp/dsh-pm-workbench/declaration-input-cache'),
    logRoot: resolve(workspaceRoot, '.tmp/dsh-pm-workbench/declaration-input-logs'),
    tempRoot: resolve(workspaceRoot, '.tmp/dsh-pm-workbench/declaration-input-tmp'),
    acceptedRoot: resolve(workspaceRoot, '.tmp/dsh-pm-workbench/rc6-declarations/accepted'),
  }
  await assertDirectoryEmptyOrAbsent(paths.targetCacheRoot)
  await assertDirectoryEmptyOrAbsent(paths.acceptedRoot)
  await mkdir(paths.logRoot, { recursive: true })
  await mkdir(paths.tempRoot, { recursive: true })
  await copySelectedCache({
    cacheRoot: sourceCacheRoot,
    targetCacheRoot: resolve(paths.targetCacheRoot, '_cacache'),
    entries: selected.entries,
  })
  await chmod(paths.targetCacheRoot, 0o555)
  await copyAcceptedInputFiles({ candidateRoot, acceptedRoot: paths.acceptedRoot })
  await copyImmutableContractFiles({ workspaceRoot, acceptedRoot: paths.acceptedRoot })
  const acceptedToolsRoot = resolve(workspaceRoot, 'tools/harness-rc6-declarations')
  await mkdir(acceptedToolsRoot, { recursive: true })
  await copyFile(packagePath, resolve(acceptedToolsRoot, 'package.json'))
  await copyFile(lockPath, resolve(acceptedToolsRoot, 'package-lock.json'))
  const runtime = await readRuntimeIdentity(nodePath, npmCliPath)
  const inputManifest = await writeInputManifest({ workspaceRoot, candidate, packageJson, packageLock, selected, runtime })
  if (replay) {
    const userNpmrc = resolve(paths.tempRoot, 'user-npmrc')
    const globalNpmrc = resolve(paths.tempRoot, 'global-npmrc')
    await Promise.all([
      writeFile(userNpmrc, 'ignore-scripts=true\n', 'utf8'),
      writeFile(globalNpmrc, 'ignore-scripts=true\n', 'utf8'),
    ])
    await execFileAsync(nodePath, [npmCliPath, 'ci', '--ignore-scripts', '--offline', '--audit=false', '--fund=false', '--update-notifier=false', `--cache=${paths.targetCacheRoot}`, `--prefix=${paths.acceptedRoot}`, `--logs-dir=${paths.logRoot}`, `--userconfig=${userNpmrc}`, `--globalconfig=${globalNpmrc}`], {
      cwd: paths.acceptedRoot,
      env: { PATH: process.env.PATH ?? '', HOME: paths.tempRoot, TMPDIR: paths.tempRoot },
      maxBuffer: 10 * 1024 * 1024,
    })
  }
  return { status: replay ? 'PASS_OFFLINE_INSTALL' : 'PASS_ACCEPTED_INPUT', paths, inputManifest }
}

async function main() {
  try {
    const result = await acceptRc6DeclarationInput()
    process.stdout.write(canonicalJson(result.status === 'CHANGES_REQUIRED_REVIEW'
      ? { status: result.status, reason: result.reason }
      : { status: result.status }))
    if (result.status === 'CHANGES_REQUIRED_REVIEW') process.exitCode = 1
  } catch (error) {
    process.stdout.write(canonicalJson(mapPublicInputError(error)))
    process.exitCode = 1
  }
}

if (basename(process.argv[1] ?? '') === 'accept-rc6-declaration-input.mjs') void main()
