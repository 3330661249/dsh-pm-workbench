import type { Sha256Hex } from '../domain/ids.js'
import {
  projectCommandReceiptSchema,
  type ProjectCommandReceipt,
  type DeletedProjectTombstone,
} from '../domain/model.js'
import { canonicalJson } from '../protocol/canonical-json.js'
import {
  parseProductInput, parseProductOutcome,
  type ProjectCommand, type ProjectCommandOutcome, type ProductErrorCode,
} from '../protocol/product.js'

export function hashProjectCommandRequest(
  command: ProjectCommand,
  sha256Utf8: (value: string) => Sha256Hex,
  endpoint = 'projects.command',
): Sha256Hex {
  const { commandId: _commandId, ...input } = parseProductInput('projects.command', command)
  return sha256Utf8(canonicalJson({ endpoint, input }))
}

export function rejectProjectCommand(command: ProjectCommand, code: ProductErrorCode): ProjectCommandOutcome {
  return parseProductOutcome('projects.command', {
    status: 'rejected', projectId: command.projectId, commandId: command.commandId, error: { code },
  }, command)
}

export function receiptFor(command: ProjectCommand, requestHash: Sha256Hex, outcome: ProjectCommandOutcome): ProjectCommandReceipt {
  const parsed = parseProductOutcome('projects.command', outcome, command)
  return projectCommandReceiptSchema.parse({
    commandId: command.commandId, requestHash,
    outcome: parsed.status === 'accepted' ? { ok: true, ...parsed.value } : { ok: false, code: parsed.error.code },
  })
}

export function replayReceipt(command: ProjectCommand, requestHash: Sha256Hex, receipt: ProjectCommandReceipt): ProjectCommandOutcome {
  if (receipt.requestHash !== requestHash) return rejectProjectCommand(command, 'idempotency-key-reused')
  const stored = projectCommandReceiptSchema.parse(receipt).outcome
  const outcome = stored.ok
    ? { status: 'accepted', projectId: command.projectId, commandId: command.commandId,
      value: Object.fromEntries(Object.entries(stored).filter(([key]) => key !== 'ok')) }
    : { status: 'rejected', projectId: command.projectId, commandId: command.commandId, error: { code: stored.code } }
  return parseProductOutcome('projects.command', outcome, command)
}

export function replayTombstone(command: ProjectCommand, requestHash: Sha256Hex, tombstone: DeletedProjectTombstone): ProjectCommandOutcome {
  if (tombstone.deleteCommandId !== command.commandId) return rejectProjectCommand(command, 'project-deleted')
  if (tombstone.deleteRequestHash !== requestHash) return rejectProjectCommand(command, 'idempotency-key-reused')
  return parseProductOutcome('projects.command', {
    status: 'accepted', projectId: tombstone.projectId, commandId: tombstone.deleteCommandId,
    value: { projectVersion: tombstone.deleteOutcome.projectVersion },
  }, command)
}
