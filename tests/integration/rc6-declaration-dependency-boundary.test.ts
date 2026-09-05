import { resolve } from 'node:path'
import { describe, expect, test } from 'vitest'

const workspaceRoot = resolve(import.meta.dirname, '../..')

const closure = await import('../../scripts/verify-rc6-declaration-closure.mjs')
const eligibility = await closure.getLocalReplayEligibility({ workspaceRoot })

describe('rc.6 declaration dependency boundary', () => {
  test('audits the committed closure without requiring any local cache or accepted installation', async () => {
    const audit = await closure.inspectCommittedDeclarationClosure({ workspaceRoot })

    expect(audit.packageCounts).toEqual({ registry: 169, deepseek: 59, dsh: 54 })
    expect(audit.closure.fullDeepseekCohort).toHaveLength(59)
    expect(audit.closure.selectedDeclarationSubgraph.roots).toEqual([
      '@deepseek-ai/dsh-client-connection',
      '@deepseek-ai/dsh-client-runtime',
      '@deepseek-ai/dsh-client-ui-layout',
      '@deepseek-ai/dsh-client-ui-sidebar',
      '@deepseek-ai/dsh-client-ui-slots',
    ])
    expect(audit.closure.fullDeepseekCohort.every((entry: { name: string; version: string }) =>
      entry.name.startsWith('@deepseek-ai/') &&
      entry.name.startsWith('@deepseek-ai/dsh-')
        ? entry.version === '0.1.0-rc.6'
        : true,
    )).toBe(true)
  })

  test.skipIf(!eligibility.eligible)(
    'replays the local accepted root only when cache and root are both present',
    async () => {
      const replay = await closure.verifyLocalAcceptedDeclarationClosure({ workspaceRoot })

      expect(replay.status).toBe('PASS_LOCAL_REPLAY')
      expect(replay.selectedDeclarationManifests).toHaveLength(5)
      expect(replay.storage?.selectedOrImported).toBe(false)
      expect(replay.cacheReadOnly).toBe(true)
      expect(replay.realpathsWithinAcceptedRoot).toBe(true)
    },
  )

  test.skipIf(eligibility.eligible)(
    'SKIP_ACCEPTED_CACHE_OR_ROOT_ABSENT',
    () => {
      expect(eligibility.reason).toBe('SKIP_ACCEPTED_CACHE_OR_ROOT_ABSENT')
    },
  )
})
