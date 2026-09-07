import type { ActiveProjectRecord } from '../domain/model.js'
import {
  parseProductInput, parseProductOutcome,
  type ProductEndpoint, type ProductOutcome, type ProjectCommandOutcome,
} from '../protocol/product.js'
import {
  type ProjectRepository, type CreateProjectCommand, type ExistingProjectCommand, type DeleteProjectCommand,
} from './project-repository.js'
import { projectViewOf, sourceViewOf, markdownViewOf } from './project-views.js'

/** The application boundary accepts unknown wire data and correlates every returned outcome. */
export class ProjectService {
  constructor(private readonly repository: ProjectRepository) {}

  async command(input: unknown, signal?: AbortSignal): Promise<ProjectCommandOutcome> {
    const command = parseProductInput('projects.command', input)
    const outcome = command.payload.kind === 'project.create'
      ? await this.repository.create(command as CreateProjectCommand, signal)
      : command.payload.kind === 'project.delete'
        ? await this.repository.deleteProject(command as DeleteProjectCommand, signal)
        : await this.repository.mutate(command as ExistingProjectCommand, signal)
    return parseProductOutcome('projects.command', outcome, command)
  }

  async list(input: unknown, signal?: AbortSignal): Promise<ProductOutcome<'projects.list'>> {
    const parsed = parseProductInput('projects.list', input)
    let outcome: unknown
    try { outcome = { status: 'accepted', value: await this.repository.list(signal) } }
    catch (error) { outcome = this.#readFailure(error) }
    return parseProductOutcome('projects.list', outcome, parsed)
  }

  get(input: unknown, signal?: AbortSignal): Promise<ProductOutcome<'projects.get'>> {
    return this.#read('projects.get', input, projectViewOf, signal)
  }

  async getSource(input: unknown, signal?: AbortSignal): Promise<ProductOutcome<'sources.get'>> {
    const parsed = parseProductInput('sources.get', input)
    return this.#read('sources.get', parsed, project => sourceViewOf(project, parsed.sourceRevisionId), signal)
  }

  async getMarkdown(input: unknown, signal?: AbortSignal): Promise<ProductOutcome<'artifacts.getMarkdown'>> {
    const parsed = parseProductInput('artifacts.getMarkdown', input)
    return this.#read('artifacts.getMarkdown', parsed, project => markdownViewOf(project, parsed.prdRevisionId), signal)
  }

  async #read<E extends Extract<ProductEndpoint, 'projects.get' | 'sources.get' | 'artifacts.getMarkdown'>>(
    endpoint: E, input: unknown, projectValue: (record: ActiveProjectRecord) => unknown, signal?: AbortSignal,
  ): Promise<ProductOutcome<E>> {
    const parsed = parseProductInput(endpoint, input)
    let record
    try { record = await this.repository.get(parsed.projectId, signal) }
    catch (error) { return parseProductOutcome(endpoint, this.#readFailure(error), parsed) }
    if (!record || record.kind === 'deleted') return parseProductOutcome(endpoint, { status: 'rejected', error: { code: 'not-found' } }, parsed)
    let value
    try { value = projectValue(record) }
    catch (error) {
      if (error instanceof Error && error.message === 'not-found') return parseProductOutcome(endpoint, { status: 'rejected', error: { code: 'not-found' } }, parsed)
      throw error
    }
    return parseProductOutcome(endpoint, { status: 'accepted', value }, parsed)
  }

  #readFailure(error: unknown): unknown {
    return { status: 'rejected', error: { code: error instanceof Error && error.message === 'cancelled' ? 'cancelled' : 'storage-failed' } }
  }
}
