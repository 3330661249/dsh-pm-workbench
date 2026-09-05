import type { Context } from '@deepseek-ai/cordis'
import { Remote, TypertRemoteService } from '@deepseek-ai/dsh-typert-protocol'

export interface MatrixHealthRequest {
  readonly nonce: 'matrix-v1'
}

export interface MatrixHealthResult {
  readonly ok: true
  readonly apiVersion: 'v1'
}

export class MatrixProbeService extends TypertRemoteService {
  constructor(ctx: Context) {
    super(ctx, 'matrixProbe')
  }

  @Remote
  health(_request: MatrixHealthRequest): MatrixHealthResult {
    return { ok: true, apiVersion: 'v1' }
  }
}

export default MatrixProbeService
