import { createHash } from 'node:crypto'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, test } from 'vitest'
import { parseMatrixConfig } from '../src/config.js'
import { verifyReviewedLockSet } from '../src/reviewed-locks.js'
import type { MatrixConfig } from '../src/types.js'

const toolRoot = fileURLToPath(new URL('..', import.meta.url))
const platformKey = 'darwin-arm64-node24-npm11'
const sourceDirectory = path.join(toolRoot, 'locks', platformKey)
let configs: readonly { readonly fileName: string; readonly config: MatrixConfig }[]

beforeAll(async () => {
  configs = await Promise.all([
    'matrix.official.json',
    'matrix.official-experimental.json',
  ].map(async (fileName) => ({
    fileName,
    config: parseMatrixConfig(JSON.parse(await readFile(path.join(toolRoot, 'config', fileName), 'utf8'))),
  })))
})

async function copiedPlatform(): Promise<string> {
  const root = await mkdtemp(path.join(tmpdir(), 'reviewed-lock-set-'))
  const destination = path.join(root, platformKey)
  await cp(sourceDirectory, destination, { recursive: true })
  return destination
}

function sha256(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

async function rewriteManifest(
  directory: string,
  edit: (manifest: any) => void,
  editTable?: (readme: string) => string,
): Promise<void> {
  const readmePath = path.join(directory, 'README.md')
  const readme = await readFile(readmePath, 'utf8')
  const match = readme.match(/<!-- reviewed-lock-manifest:start -->\n```json\n([\s\S]*?)\n```\n<!-- reviewed-lock-manifest:end -->/u)
  if (match === null) throw new Error('test fixture has no embedded manifest')
  const manifest = JSON.parse(match[1]!)
  edit(manifest)
  const replaced = readme.replace(match[1]!, JSON.stringify(manifest, null, 2))
  await writeFile(readmePath, editTable?.(replaced) ?? replaced)
}

async function rewriteLock(
  directory: string,
  caseId: string,
  edit: (lock: any) => void,
  alignManifest: boolean,
): Promise<void> {
  const fileName = `${caseId}.package-lock.json`
  const lockPath = path.join(directory, fileName)
  const lock = JSON.parse(await readFile(lockPath, 'utf8'))
  edit(lock)
  const raw = `${JSON.stringify(lock, null, 2)}\n`
  await writeFile(lockPath, raw)
  if (alignManifest) {
    await rewriteManifest(directory, (manifest) => {
      const item = manifest.cases.find((candidate: any) => candidate.id === caseId)
      item.lockSha256 = sha256(raw)
    }, (readme) => {
      const tableLine = readme.split('\n').find((line) => line.includes(`| \`${caseId}\` |`))
      const oldHash = tableLine?.match(/[a-f0-9]{64}/u)?.[0]
      return oldHash === undefined ? readme : readme.replaceAll(oldHash, sha256(raw))
    })
  }
}

describe('reviewed platform lock set', () => {
  test('accepts the closed Darwin inventory and binds every case to its config and README manifest', async () => {
    const verified = await verifyReviewedLockSet({ platformDirectory: sourceDirectory, configs })

    expect(verified).toMatchObject({
      platformKey,
      caseCount: 8,
      manifestSha256: expect.stringMatching(/^[a-f0-9]{64}$/),
    })
    expect(Object.keys(verified.cases)).toHaveLength(8)
    expect(verified.cases['typert-0.1.0-rc.7']).toEqual({
      lockSha256: 'ab74ad4a74e4a66bf8f41f37717a33b2890d089ed6cce3da8b51342e2f051437',
      installedGraphSha256: '25309cb3692ff9d9b832256ffb276d4276987c04d0b301df004b3cdf8d16f79c',
    })
  })

  test('rejects a tampered transitive lock entry rather than trusting its direct dependencies', async () => {
    const directory = await copiedPlatform()
    await rewriteLock(directory, 'typert-0.1.0-rc.7', (lock) => {
      lock.packages['node_modules/@babel/generator'].version = '999.0.0'
    }, false)

    await expect(verifyReviewedLockSet({ platformDirectory: directory, configs }))
      .rejects.toThrow(/lock SHA-256/i)
  })

  test('rejects a missing, extra, or misnamed lock', async () => {
    const missing = await copiedPlatform()
    await rm(path.join(missing, 'typert-0.1.0-rc.7.package-lock.json'))
    await expect(verifyReviewedLockSet({ platformDirectory: missing, configs })).rejects.toThrow(/inventory/i)

    const extra = await copiedPlatform()
    await writeFile(path.join(extra, 'extra.package-lock.json'), '{}\n')
    await expect(verifyReviewedLockSet({ platformDirectory: extra, configs })).rejects.toThrow(/inventory/i)

    const odd = await copiedPlatform()
    await writeFile(path.join(odd, 'notes.json'), '{}\n')
    await expect(verifyReviewedLockSet({ platformDirectory: odd, configs })).rejects.toThrow(/inventory/i)
  })

  test('rejects missing, duplicate, or wrong-config manifest cases and table drift', async () => {
    const missing = await copiedPlatform()
    await rewriteManifest(missing, (manifest) => { manifest.cases.pop() })
    await expect(verifyReviewedLockSet({ platformDirectory: missing, configs })).rejects.toThrow(/manifest.*case|inventory/i)

    const wrongConfig = await copiedPlatform()
    await rewriteManifest(wrongConfig, (manifest) => {
      manifest.cases[0].matrixConfig = 'matrix.official-experimental.json'
    })
    await expect(verifyReviewedLockSet({ platformDirectory: wrongConfig, configs })).rejects.toThrow(/config/i)

    const table = await copiedPlatform()
    await rewriteManifest(table, () => {}, (readme) => readme.replace('49299fcc', 'aaaaaaaa'))
    await expect(verifyReviewedLockSet({ platformDirectory: table, configs })).rejects.toThrow(/table/i)
  })

  test('rejects lock hash drift and root manifest drift even if the edited hash is re-declared', async () => {
    const hashDrift = await copiedPlatform()
    await writeFile(
      path.join(hashDrift, 'typert-0.1.0-rc.7.package-lock.json'),
      `${await readFile(path.join(hashDrift, 'typert-0.1.0-rc.7.package-lock.json'), 'utf8')} `,
    )
    await expect(verifyReviewedLockSet({ platformDirectory: hashDrift, configs })).rejects.toThrow(/SHA-256/i)

    const rootDrift = await copiedPlatform()
    await rewriteLock(rootDrift, 'typert-0.1.0-rc.7', (lock) => {
      lock.packages[''].license = 'MIT'
    }, true)
    await expect(verifyReviewedLockSet({ platformDirectory: rootDrift, configs })).rejects.toThrow(/root/i)
  })

  test('rejects direct origin or integrity drift even when hashes and manifest metadata are made self-consistent', async () => {
    for (const [field, value, expected] of [
      ['resolved', 'https://example.invalid/pkg.tgz', /origin|resolved/i],
      ['integrity', 'sha512-ZHJpZnQ=', /integrity/i],
    ] as const) {
      const directory = await copiedPlatform()
      const id = 'typert-0.1.0-rc.7'
      const packageName = '@deepseek-ai/dsh-typert-generator'
      await rewriteLock(directory, id, (lock) => {
        lock.packages[`node_modules/${packageName}`][field] = value
      }, true)
      await rewriteManifest(directory, (manifest) => {
        const item = manifest.cases.find((candidate: any) => candidate.id === id)
        item.directPackages[packageName][field] = value
      })

      await expect(verifyReviewedLockSet({ platformDirectory: directory, configs })).rejects.toThrow(expected)
    }
  })

  test('rejects mixed cohort entries and invalid installed-graph evidence hashes', async () => {
    const mixed = await copiedPlatform()
    await rewriteLock(mixed, 'typert-0.1.0-rc.7', (lock) => {
      lock.packages['node_modules/@deepseek-ai/dsh-hidden'] = {
        version: '0.1.0-rc.8',
        resolved: 'https://registry.npmjs.org/@deepseek-ai/dsh-hidden/-/dsh-hidden-0.1.0-rc.8.tgz',
        integrity: 'sha512-ZHJpZnQ=',
      }
    }, true)
    await expect(verifyReviewedLockSet({ platformDirectory: mixed, configs })).rejects.toThrow(/cohort/i)

    const graph = await copiedPlatform()
    await rewriteManifest(graph, (manifest) => {
      manifest.cases[0].installedGraphSha256 = 'unknown'
    })
    await expect(verifyReviewedLockSet({ platformDirectory: graph, configs })).rejects.toThrow(/installed graph/i)
  })
})
