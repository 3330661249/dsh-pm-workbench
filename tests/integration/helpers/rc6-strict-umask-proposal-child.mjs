import { createHash } from 'node:crypto'
import { lstat, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { withSynthetic169BootstrapProductionPath } from './rc6-169-production-path.ts'

const repositoryRoot = process.argv[2]

if (!repositoryRoot) {
  throw new Error('repository root argument is required')
}

const evidence = await withSynthetic169BootstrapProductionPath(
  repositoryRoot,
  async (fixture) => {
    // Keep the process-global umask change out of the Vitest worker.  Only the
    // two real production publisher calls below run while the strict mask is
    // active; fixture construction has already completed in this child.
    const previousUmask = process.umask(0o077)
    try {
      const activeUmask = process.umask()
      const first = await fixture.stageV2Proposal()
      const pointerPath = resolve(
        fixture.workspaceRoot,
        '.tmp/dsh-pm-workbench/rc6-declaration-v2-proposal.json',
      )
      const firstBytes = await readFile(pointerPath)
      const firstStat = await lstat(pointerPath, { bigint: true })
      const second = await fixture.stageV2Proposal()
      const finalBytes = await readFile(pointerPath)
      const finalStat = await lstat(pointerPath, { bigint: true })

      return {
        strictUmask: activeUmask.toString(8).padStart(4, '0'),
        firstPublicationStatus: first.publicationStatus,
        firstPointer: {
          mode: Number(firstStat.mode & 0o777n),
          nlink: firstStat.nlink.toString(),
          sha256: createHash('sha256').update(firstBytes).digest('hex'),
        },
        secondPublicationStatus: second.publicationStatus,
        finalPointer: {
          mode: Number(finalStat.mode & 0o777n),
          nlink: finalStat.nlink.toString(),
          sha256: createHash('sha256').update(finalBytes).digest('hex'),
          sameIdentity:
            finalStat.dev === firstStat.dev && finalStat.ino === firstStat.ino,
        },
      }
    } finally {
      process.umask(previousUmask)
    }
  },
  { publishSyntheticProposal: true },
)

process.stdout.write(`${JSON.stringify(evidence)}\n`)
