import { open, lstat, realpath, writeFile } from 'node:fs/promises'
import { constants } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
export const STORAGE_PACKAGE_FILES = Object.freeze(['package/cordis.patch.yml', 'package/lib/client.js', 'package/lib/index.js', 'package/package.json'])
const KEYS = ['schemaVersion','outcome','harnessVersion','packageName','packageVersion','packageFiles','packageSha256','hostMetafileSha256','clientMetafileSha256','smallBytes','smallHashBeforeRestart','smallHashAfterRestart','tombstoneUpdated','tombstoneHiddenAfterRestart','nearLimitBytes','nearLimitHashBeforeRestart','nearLimitHashAfterRestart','overLimitBytes','overLimitRejected','overLimitBackendCalls','phaseCount','restartCount','freshBrowserProfiles','spawnWitnessCount','listenerWitnessCount','externalAttempts','port3080Touched','allLoopback','childCountAfterCleanup','listenerCountAfterCleanup','runRootExistsAfterCleanup','cleanupRenamed','cleanupRevalidated','cleanupRemoved','failure'].sort()
const HASH = /^[a-f0-9]{64}$/
export function verifyStage3aStorageSurfaceResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || JSON.stringify(Object.keys(value).sort()) !== JSON.stringify(KEYS)) throw Error('unsafe-result-field')
  if (typeof value.nearLimitHashAfterRestart !== 'string' || !HASH.test(value.nearLimitHashAfterRestart)) throw Error('missing-near-limit-restart-witness')
  for (const key of ['packageSha256','hostMetafileSha256','clientMetafileSha256','smallHashBeforeRestart','smallHashAfterRestart','nearLimitHashBeforeRestart','nearLimitHashAfterRestart']) if (typeof value[key] !== 'string' || !HASH.test(value[key])) throw Error('missing-hash-witness')
  const exact = { schemaVersion: 1, outcome: 'PASS', harnessVersion: '0.1.0-rc.6', packageName: '@knight/dsh-pm-workbench-storage-gate', packageVersion: '0.0.0-stage3a', smallBytes: 512, nearLimitBytes: 4194304, overLimitBytes: 4194305, overLimitBackendCalls: 0, phaseCount: 7, restartCount: 6, freshBrowserProfiles: 7, spawnWitnessCount: 14, listenerWitnessCount: 14, externalAttempts: 0, port3080Touched: false, allLoopback: true, childCountAfterCleanup: 0, listenerCountAfterCleanup: 0, runRootExistsAfterCleanup: false, tombstoneUpdated: true, tombstoneHiddenAfterRestart: true, overLimitRejected: true, cleanupRenamed: true, cleanupRevalidated: true, cleanupRemoved: true, failure: null }
  for (const [key, expected] of Object.entries(exact)) if (value[key] !== expected) throw Error('incomplete-storage-witness')
  if (JSON.stringify(value.packageFiles) !== JSON.stringify(STORAGE_PACKAGE_FILES)) throw Error('package-inventory-mismatch')
  if (value.smallHashBeforeRestart !== value.smallHashAfterRestart || value.nearLimitHashBeforeRestart !== value.nearLimitHashAfterRestart) throw Error('restart-hash-mismatch')
  return value
}
export function renderStorageGateMarkdown(value) {
  const r = verifyStage3aStorageSurfaceResult(value)
  return `# Stage 3A storage surface\n\nSTAGE3A_STORAGE_SURFACE=PASS\n\nThis diagnostic proves the generic public table behavior in rc.6 only. The final Product record and persistence path remain subject to Task 12. Only newly written neutral synthetic data was used.\n\n| Witness | Result |\n| --- | --- |\n| Harness | ${r.harnessVersion} |\n| Diagnostic package | ${r.packageName}@${r.packageVersion} |\n| Small put and restart get | ${r.smallBytes} bytes; identical SHA-256 |\n| Small SHA-256 | ${r.smallHashAfterRestart} |\n| Tombstone update and restart | Hidden from the gate active-record view |\n| Near-limit put and restart get | ${r.nearLimitBytes} bytes; identical SHA-256 |\n| Near-limit SHA-256 | ${r.nearLimitHashAfterRestart} |\n| Over-limit rejection | ${r.overLimitBytes} bytes; ${r.overLimitBackendCalls} backend calls |\n| Isolated phases / restarts / fresh Chrome profiles | ${r.phaseCount} / ${r.restartCount} / ${r.freshBrowserProfiles} |\n| Spawn / loopback listener witnesses | ${r.spawnWitnessCount} / ${r.listenerWitnessCount} |\n| External page-target requests | ${r.externalAttempts} |\n| Port 3080 touched | false |\n| Children / listeners after cleanup | 0 / 0 |\n| Marker-owned root | Revalidated, renamed, deleted; absence checked |\n| Tgz SHA-256 | ${r.packageSha256} |\n| Host build graph SHA-256 | ${r.hostMetafileSha256} |\n| Client build graph SHA-256 | ${r.clientMetafileSha256} |\n\nExact tgz inventory:\n\n${r.packageFiles.map(file => `- ${file}`).join('\n')}\n`
}
export async function verifyStorageResultFile(file) {
  if (!path.isAbsolute(file) || path.normalize(file) !== file || await realpath(file) !== file) throw Error('unsafe-result-file')
  const lexical = await lstat(file)
  if (!lexical.isFile() || lexical.isSymbolicLink() || lexical.size > 16384) throw Error('unsafe-result-file')
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = await handle.stat(); const bytes = await handle.readFile(); const after = await handle.stat()
    for (const key of ['dev','ino','size','mtimeMs','ctimeMs']) if (before[key] !== after[key] || before[key] !== lexical[key]) throw Error('unsafe-result-file')
    return verifyStage3aStorageSurfaceResult(JSON.parse(bytes.toString('utf8')))
  } finally { await handle.close() }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 5 || process.argv[3] !== '--markdown') throw Error('arguments')
    const result = await verifyStorageResultFile(process.argv[2])
    const output = process.argv[4]
    if (!path.isAbsolute(output) || await realpath(path.dirname(output)) !== path.dirname(output)) throw Error('unsafe-output')
    await writeFile(output, renderStorageGateMarkdown(result), { flag: 'wx', mode: 0o600 })
    process.stdout.write('STAGE3A_STORAGE_SURFACE=PASS\n')
  } catch { process.stderr.write('STAGE3A_STORAGE_SURFACE=BLOCKED\n'); process.exitCode = 1 }
}
