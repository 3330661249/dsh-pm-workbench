import { defineDomain, domainTable } from '@deepseek-ai/dsh-storage-domain'
import { validationRecordSchema, type ValidationRecord } from '../../validation/model.js'

export const validationDomainSpec = defineDomain({
  name: 'dsh_pm_workbench_validation', version: 1,
  tables: { tasks: domainTable<string, ValidationRecord>(validationRecordSchema) },
})
