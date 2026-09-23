import type { Context } from '@deepseek-ai/cordis'
import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'

import type { ProjectId } from '../../domain/ids.js'
import type { StoredProjectRecord } from '../../domain/model.js'
import { storedProjectRecordSchema } from '../../domain/model.js'

export const projectDomainSpec = defineDomain({
  name: 'dsh_pm_workbench_projects',
  version: 1,
  tables: {
    projects: domainTable<ProjectId, StoredProjectRecord>(storedProjectRecordSchema),
  },
})

export async function openProjectsTable(ctx: Context) {
  const domain = await ctx.storageDomain.open(projectDomainSpec)
  return Object.freeze({ domain, table: domain.table('projects') })
}
