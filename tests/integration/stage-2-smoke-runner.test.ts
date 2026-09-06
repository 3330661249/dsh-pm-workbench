import { describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { link, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import {
  STAGE2_PHASES,
  assertPackToolProvenance,
  assertSameTreeInventory,
  buildChromeArgv,
  buildHarnessInvocation,
  buildPluginInvocation,
  cleanupBrowserPhaseResources,
  cleanupOwnedRunRoot,
  createCdpPeer,
  createPageNetworkGate,
  createIsolatedChildEnvironment,
  createProductionAdapters,
  createRuntimeChildEnvironment,
  classifyProfileExit,
  executeStage2Smoke,
  parseDevToolsActivePort,
  parseLsofListenerWitness,
  parseStage2Args,
  renderPnpmShim,
  runStage2Cli,
  proveNoOpenHandles,
  isStrictLsofNoMatch,
  isWorkbenchClientBundleUrl,
  inventoryOwnedTree,
  validateTreeClosureInventory,
  validatePackageVerificationReceipt,
  validateObservedPackageFile,
  validatePackedMetadataAgainstVerification,
} from '../../scripts/run-stage-2-isolated-smoke.mjs'
import {
  canonicalStage2Result,
  renderStage2SmokeMarkdown,
  validateStage2SmokeResult,
} from '../../scripts/verify-stage-2-smoke-result.mjs'

const HASH_A = 'a'.repeat(64)
const HASH_B = 'b'.repeat(64)
const HASH_C = 'c'.repeat(64)

function digest(bytes: Buffer) {
  return createHash('sha256').update(bytes).digest('hex')
}

const inputs = Object.freeze({
  node: '/accepted/node',
  dshCli: '/accepted/dsh/lib/bin.js',
  npmCli: '/accepted/npm/bin/npm-cli.js',
  pnpmNode: '/accepted/pnpm-node',
  pnpmCli: '/accepted/pnpm/bin/pnpm.mjs',
  chrome: '/accepted/Google Chrome',
})

function expectedObservation(phase: string) {
  const witnesses = { chromeSpawnReceiptSha256: HASH_B, chromeListenerWitnessSha256: HASH_C }
  switch (phase) {
    case 'initial-enabled':
      return { markerState: 'present', counters: [0, 1], focusRestored: true, externalNetworkAttempts: 0, ...witnesses }
    case 'restart-enabled':
      return { markerState: 'present', counters: [1], focusRestored: true, externalNetworkAttempts: 0, ...witnesses }
    case 'disabled':
    case 'removed':
      return { markerState: 'absent', counters: [], focusRestored: false, externalNetworkAttempts: 0, ...witnesses }
    case 'readded':
      return { markerState: 'present', counters: [1, 2], focusRestored: true, externalNetworkAttempts: 0, ...witnesses }
    default:
      throw new Error(`unexpected phase ${phase}`)
  }
}

function fakeAdapters(overrides: Record<string, unknown> = {}) {
  const events: string[] = []
  let runtimeOrdinal = 0
  const adapters = {
    workspace: {
      create: vi.fn(async () => {
        events.push('workspace.create')
        return {
          runId: '00000000-0000-4000-8000-000000000001',
          runRoot: '/owned/run',
          packageSourceRoot: '/owned/run/package-source',
          packRoot: '/owned/run/pack',
          dshHome: '/owned/run/dsh-home',
          disablePatchPath: '/owned/run/disable.yml',
          browserProfile: (phase: string) => `/owned/run/browser/${phase}`,
        }
      }),
      cleanup: vi.fn(async () => {
        events.push('workspace.cleanup')
        return { renamed: true, revalidated: true, removed: true }
      }),
    },
    package: {
      freeze: vi.fn(async () => {
        events.push('package.freeze')
        return { tgzAbsolutePath: '/owned/run/pack/workbench.tgz', sha256: HASH_A }
      }),
    },
    profile: {
      add: vi.fn(async ({ readd = false }: { readd?: boolean }) => {
        events.push(readd ? 'profile.readd' : 'profile.add')
      }),
      remove: vi.fn(async () => { events.push('profile.remove') }),
      witness: vi.fn(async ({ state }: { state: string }) => {
        events.push(`profile.witness:${state}`)
        return { state }
      }),
    },
    runtime: {
      start: vi.fn(async ({ phase }: { phase: string }) => {
        events.push(`runtime.start:${phase}`)
        runtimeOrdinal += 1
        return {
          port: 32_000 + runtimeOrdinal,
          origin: `http://127.0.0.1:${32_000 + runtimeOrdinal}`,
          spawnReceiptSha256: HASH_B,
          listenerWitnessSha256: HASH_C,
          loopback: true,
          stop: vi.fn(async () => { events.push(`runtime.stop:${phase}`) }),
        }
      }),
    },
    browser: {
      observePhase: vi.fn(async ({ phase, profilePath }: { phase: string; profilePath: string }) => {
        events.push(`browser:${phase}:${profilePath}`)
        return expectedObservation(phase)
      }),
    },
  }
  return { adapters: Object.assign(adapters, overrides), events }
}

describe('Stage 2 runner closed inputs and command grammar', () => {
  it('accepts exactly six named absolute inputs and binds --node to process.execPath', () => {
    expect(parseStage2Args([
      '--node', inputs.node,
      '--dsh-cli', inputs.dshCli,
      '--npm-cli', inputs.npmCli,
      '--pnpm-node', inputs.pnpmNode,
      '--pnpm-cli', inputs.pnpmCli,
      '--chrome', inputs.chrome,
    ], { processExecPath: inputs.node })).toEqual(inputs)

    expect(() => parseStage2Args([
      '--node', inputs.node,
      '--dsh-cli', 'relative/bin.js',
      '--npm-cli', inputs.npmCli,
      '--pnpm-node', inputs.pnpmNode,
      '--pnpm-cli', inputs.pnpmCli,
      '--chrome', inputs.chrome,
    ], { processExecPath: inputs.node })).toThrow(/STAGE2_INPUT_INVALID/)

    expect(() => parseStage2Args([
      '--node', '/different/node',
      '--dsh-cli', inputs.dshCli,
      '--npm-cli', inputs.npmCli,
      '--pnpm-node', inputs.pnpmNode,
      '--pnpm-cli', inputs.pnpmCli,
      '--chrome', inputs.chrome,
    ], { processExecPath: inputs.node })).toThrow(/STAGE2_NODE_MISMATCH/)
  })

  it('constructs the exact public add, remove, and boot argv without raw RPC or port 3080', () => {
    const tgz = '/owned/run/pack/workbench.tgz'
    expect(buildPluginInvocation('add', tgz)).toEqual([
      'plugin', '--profile', 'web', 'add', tgz, '--offline',
    ])
    expect(buildPluginInvocation('remove')).toEqual([
      'plugin', '--profile', 'web', 'remove', '@knight/dsh-pm-workbench',
    ])
    expect(buildHarnessInvocation()).toEqual([
      'web', '--host', '127.0.0.1', '--port', '0',
    ])
    expect(buildHarnessInvocation('/owned/run/disable.yml')).toEqual([
      'web', '--patch', '/owned/run/disable.yml', '--host', '127.0.0.1', '--port', '0',
    ])
    expect(JSON.stringify([
      buildPluginInvocation('add', tgz),
      buildPluginInvocation('remove'),
      buildHarnessInvocation(),
    ])).not.toMatch(/3080|\/api|rpc/i)
  })

  it('creates a closed isolated environment and an exact pnpm shim', () => {
    const environment = createIsolatedChildEnvironment({
      home: '/owned/run/home',
      dshHome: '/owned/run/dsh-home',
      temp: '/owned/run/tmp',
      xdgConfig: '/owned/run/xdg/config',
      xdgCache: '/owned/run/xdg/cache',
      xdgData: '/owned/run/xdg/data',
      xdgState: '/owned/run/xdg/state',
      npmCache: '/owned/run/npm/cache',
      npmUserConfig: '/owned/run/npm/userconfig',
      npmGlobalConfig: '/owned/run/npm/globalconfig',
      pnpmHome: '/owned/run/pnpm/home',
      pnpmStore: '/owned/run/pnpm/store',
      pnpmCache: '/owned/run/pnpm/cache',
      pnpmState: '/owned/run/pnpm/state',
      shimDirectory: '/owned/run/bin',
    })

    expect(environment).toEqual({
      HOME: '/owned/run/home',
      DSH_HOME: '/owned/run/dsh-home',
      TMPDIR: '/owned/run/tmp',
      XDG_CONFIG_HOME: '/owned/run/xdg/config',
      XDG_CACHE_HOME: '/owned/run/xdg/cache',
      XDG_DATA_HOME: '/owned/run/xdg/data',
      XDG_STATE_HOME: '/owned/run/xdg/state',
      NPM_CONFIG_CACHE: '/owned/run/npm/cache',
      NPM_CONFIG_USERCONFIG: '/owned/run/npm/userconfig',
      NPM_CONFIG_GLOBALCONFIG: '/owned/run/npm/globalconfig',
      NPM_CONFIG_AUDIT: 'false',
      NPM_CONFIG_FUND: 'false',
      NPM_CONFIG_UPDATE_NOTIFIER: 'false',
      npm_config_offline: 'true',
      PNPM_HOME: '/owned/run/pnpm/home',
      npm_config_store_dir: '/owned/run/pnpm/store',
      npm_config_cache_dir: '/owned/run/pnpm/cache',
      npm_config_state_dir: '/owned/run/pnpm/state',
      PATH: '/owned/run/bin',
      LANG: 'C',
      LC_ALL: 'C',
      NO_COLOR: '1',
    })
    expect(JSON.stringify(environment)).not.toMatch(/TOKEN|SECRET|KEY|COOKIE|PROXY|PROVIDER|NODE_OPTIONS/i)
    const runtimeEnvironment = createRuntimeChildEnvironment({
      home: '/owned/run/home',
      dshHome: '/owned/run/dsh-home',
      temp: '/owned/run/tmp',
      xdgConfig: '/owned/run/xdg/config',
      xdgCache: '/owned/run/xdg/cache',
      xdgData: '/owned/run/xdg/data',
      xdgState: '/owned/run/xdg/state',
      npmCache: '/owned/run/npm/cache',
      npmUserConfig: '/owned/run/npm/userconfig',
      npmGlobalConfig: '/owned/run/npm/globalconfig',
      pnpmHome: '/owned/run/pnpm/home',
      pnpmStore: '/owned/run/pnpm/store',
      pnpmCache: '/owned/run/pnpm/cache',
      pnpmState: '/owned/run/pnpm/state',
      shimDirectory: '/owned/run/bin',
    })
    expect(runtimeEnvironment.npm_config_offline).toBe('true')
    expect(runtimeEnvironment).not.toHaveProperty('PATH')

    expect(renderPnpmShim(inputs.pnpmNode, inputs.pnpmCli)).toBe(
      "#!/bin/sh\nexec '/accepted/pnpm-node' '/accepted/pnpm/bin/pnpm.mjs' \"$@\"\n",
    )
    expect(renderPnpmShim("/a/it's/node", '/b/pnpm.mjs')).toContain("'/a/it'\"'\"'s/node'")
  })
})

describe('Stage 2 browser and listener guards', () => {
  it('parses only a loopback DevToolsActivePort and rejects 3080', () => {
    expect(parseDevToolsActivePort(Buffer.from('43191\n/devtools/browser/123e4567-e89b-42d3-a456-426614174000\n'))).toEqual({
      port: 43_191,
      browserPath: '/devtools/browser/123e4567-e89b-42d3-a456-426614174000',
      webSocketUrl: 'ws://127.0.0.1:43191/devtools/browser/123e4567-e89b-42d3-a456-426614174000',
    })
    expect(() => parseDevToolsActivePort(Buffer.from('3080\n/devtools/browser/123e4567-e89b-42d3-a456-426614174000\n')))
      .toThrow(/STAGE2_FORBIDDEN_PORT/)
    expect(() => parseDevToolsActivePort(Buffer.from('43191\n/devtools/page/not-browser\n')))
      .toThrow(/STAGE2_DEVTOOLS_FILE_INVALID/)
  })

  it('requires the retained Chrome pid to own one 127.0.0.1 listener', () => {
    expect(parseLsofListenerWitness('p741\nn127.0.0.1:43191\n', { pid: 741, port: 43_191 })).toEqual({
      pid: 741,
      host: '127.0.0.1',
      port: 43_191,
    })
    expect(() => parseLsofListenerWitness('p742\nn127.0.0.1:43191\n', { pid: 741, port: 43_191 }))
      .toThrow(/STAGE2_LISTENER_MISMATCH/)
    expect(() => parseLsofListenerWitness('p741\nn\*:43191\n', { pid: 741, port: 43_191 }))
      .toThrow(/STAGE2_LISTENER_MISMATCH/)
  })

  it('builds a fixed Chrome command with an owned profile and no permissive network flag', () => {
    const argv = buildChromeArgv('/owned/run/browser/initial-enabled')
    expect(argv).toContain('--remote-debugging-address=127.0.0.1')
    expect(argv).toContain('--remote-debugging-port=0')
    expect(argv).toContain('--user-data-dir=/owned/run/browser/initial-enabled')
    expect(argv).toContain('--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE 127.0.0.1')
    expect(argv).toContain('about:blank')
    expect(argv.join(' ')).not.toMatch(/3080|remote-allow-origins=\*|no-sandbox/)
  })

  it('drives CDP through an injected WebSocket without starting a browser', async () => {
    class FakeWebSocket {
      static instance: FakeWebSocket
      listeners = new Map<string, Set<(event: { data?: string }) => void>>()

      constructor(readonly url: string) {
        FakeWebSocket.instance = this
        queueMicrotask(() => { this.dispatch('open', {}) })
      }

      addEventListener(name: string, listener: (event: { data?: string }) => void) {
        const listeners = this.listeners.get(name) ?? new Set()
        listeners.add(listener)
        this.listeners.set(name, listeners)
      }

      removeEventListener(name: string, listener: (event: { data?: string }) => void) {
        this.listeners.get(name)?.delete(listener)
      }

      dispatch(name: string, event: { data?: string }) {
        for (const listener of this.listeners.get(name) ?? []) listener(event)
      }

      send(bytes: string) {
        const request = JSON.parse(bytes)
        queueMicrotask(() => {
          this.dispatch('message', { data: JSON.stringify({ id: request.id, result: { product: 'fixed' } }) })
        })
      }

      close() {
        this.dispatch('close', {})
      }
    }

    const endpoint = 'ws://127.0.0.1:43191/devtools/browser/123e4567-e89b-42d3-a456-426614174000'
    const peer = await createCdpPeer(endpoint, { WebSocketImpl: FakeWebSocket, timeoutMs: 100 })
    await expect(peer.send('Browser.getVersion')).resolves.toEqual({ product: 'fixed' })
    const observedEvents: string[] = []
    const unsubscribe = peer.onEvent((entry: { method: string }) => { observedEvents.push(entry.method) })
    const documentEvent = peer.waitForEvent('Network.responseReceived', 'session-1', 100)
    FakeWebSocket.instance.dispatch('message', {
      data: JSON.stringify({
        method: 'Network.responseReceived',
        params: { requestId: 'document', loaderId: 'main-loader', type: 'Document' },
        sessionId: 'session-1',
      }),
    })
    await expect(documentEvent).resolves.toMatchObject({ type: 'Document', loaderId: 'main-loader' })
    const lifecycleEvent = peer.waitForEvent('Page.lifecycleEvent', 'session-1', 100)
    FakeWebSocket.instance.dispatch('message', {
      data: JSON.stringify({
        method: 'Page.lifecycleEvent',
        params: { loaderId: 'main-loader', name: 'load' },
        sessionId: 'session-1',
      }),
    })
    await expect(lifecycleEvent).resolves.toEqual({ loaderId: 'main-loader', name: 'load' })
    expect(observedEvents).toEqual(['Network.responseReceived', 'Page.lifecycleEvent'])
    unsubscribe()
    peer.close()
  })

  function fakePageNetworkPeer() {
    let handler: ((event: { method: string; params: Record<string, unknown>; sessionId: string }) => void) | undefined
    const peer = {
      send: vi.fn(async () => ({})),
      onEvent: vi.fn((next: typeof handler) => {
        handler = next
        return () => { handler = undefined }
      }),
    }
    return {
      peer,
      emit(method: string, params: Record<string, unknown>) {
        handler?.({ method, params, sessionId: 'page-session' })
      },
    }
  }

  function emitResource(
    emit: (method: string, params: Record<string, unknown>) => void,
    { requestId, loaderId = 'main-loader', type, url, status = 200, finish = true }: {
      requestId: string
      loaderId?: string
      type: string
      url: string
      status?: number
      finish?: boolean
    },
  ) {
    emit('Network.requestWillBeSent', { requestId, loaderId, type, request: { url } })
    emit('Network.responseReceived', { requestId, loaderId, type, response: { url, status } })
    if (finish) emit('Network.loadingFinished', { requestId })
  }

  function emitSuccessfulMain(
    emit: (method: string, params: Record<string, unknown>) => void,
    origin: string,
  ) {
    emitResource(emit, { requestId: 'document', type: 'Document', url: origin })
    emit('Page.lifecycleEvent', { loaderId: 'main-loader', name: 'load' })
  }

  function emitSuccessfulPluginClient(
    emit: (method: string, params: Record<string, unknown>) => void,
    origin: string,
  ) {
    emitResource(emit, {
      requestId: 'plugin-client',
      type: 'Script',
      url: `${origin}/plugins/@knight/dsh-pm-workbench/client.js?rev=0123456789ab`,
    })
  }

  it('recognizes only the rc.6 public workbench client bundle URL', () => {
    const origin = 'http://127.0.0.1:32001'
    expect(isWorkbenchClientBundleUrl(
      `${origin}/plugins/@knight/dsh-pm-workbench/client.js?rev=0123456789ab`,
      origin,
    )).toBe(true)
    expect(isWorkbenchClientBundleUrl(`${origin}/plugins/@knight/dsh-pm-workbench/client.js`, origin)).toBe(false)
    expect(isWorkbenchClientBundleUrl(
      `${origin}/plugins/@knight/dsh-pm-workbench/client.js.map?rev=0123456789ab`,
      origin,
    )).toBe(false)
  })

  it.each([404, 405])('rejects a same-origin plugin client response with HTTP %s', async (status) => {
    const origin = 'http://127.0.0.1:32001'
    const { peer, emit } = fakePageNetworkPeer()
    const state = { externalAttempts: 0, controlFailed: false }
    const gate = createPageNetworkGate(peer, 'page-session', origin, state, {
      quietMs: 1,
      timeoutMs: 50,
    })
    gate.setMainLoader('main-loader')
    emitSuccessfulMain(emit, origin)
    emitResource(emit, {
      requestId: 'plugin-client',
      type: 'Script',
      url: `${origin}/plugins/@knight/dsh-pm-workbench/client.js?rev=0123456789ab`,
      status,
    })

    await expect(gate.settle('initial-enabled')).rejects.toMatchObject({
      stage2Code: 'STAGE2_OBSERVATION_MISMATCH',
      stage2Outcome: 'FAIL',
    })
  })

  it('rejects any page-target Network.loadingFailed event', async () => {
    const origin = 'http://127.0.0.1:32001'
    const { peer, emit } = fakePageNetworkPeer()
    const state = { externalAttempts: 0, controlFailed: false }
    const gate = createPageNetworkGate(peer, 'page-session', origin, state, {
      quietMs: 1,
      timeoutMs: 50,
    })
    gate.setMainLoader('main-loader')
    emitSuccessfulMain(emit, origin)
    emitSuccessfulPluginClient(emit, origin)
    emit('Network.loadingFailed', { requestId: 'late-script', type: 'Script', errorText: 'net::ERR_FAILED' })

    await expect(gate.settle('initial-enabled')).rejects.toMatchObject({
      stage2Code: 'STAGE2_PAGE_NAVIGATION_FAILED',
      stage2Outcome: 'INCONCLUSIVE',
    })
  })

  it('keeps listening through a quiet window and catches a delayed external request', async () => {
    const origin = 'http://127.0.0.1:32001'
    const { peer, emit } = fakePageNetworkPeer()
    const state = { externalAttempts: 0, controlFailed: false }
    let sleepCount = 0
    const gate = createPageNetworkGate(peer, 'page-session', origin, state, {
      quietMs: 5,
      timeoutMs: 50,
      sleep: vi.fn(async () => {
        sleepCount += 1
        if (sleepCount === 1) {
          emit('Network.requestWillBeSent', {
            requestId: 'delayed-external',
            loaderId: 'main-loader',
            type: 'Fetch',
            request: { url: 'https://example.invalid/late' },
          })
        }
      }),
    })
    gate.setMainLoader('main-loader')
    emitSuccessfulMain(emit, origin)
    emitSuccessfulPluginClient(emit, origin)

    await expect(gate.settle('initial-enabled')).rejects.toMatchObject({
      stage2Code: 'STAGE2_EXTERNAL_NETWORK_ATTEMPT',
      stage2Outcome: 'FAIL',
    })
    expect(sleepCount).toBeGreaterThanOrEqual(2)
    expect(state.externalAttempts).toBe(1)
  })

  it('drains Fetch controls before requiring a fresh event-stable quiet window', async () => {
    const origin = 'http://127.0.0.1:32001'
    const { peer, emit } = fakePageNetworkPeer()
    let resolveControl: (() => void) | undefined
    peer.send.mockImplementation((method?: string) => method === 'Fetch.continueRequest'
      ? new Promise<Record<string, never>>((resolve) => { resolveControl = () => resolve({}) })
      : Promise.resolve({}))
    const quietResolvers: Array<() => void> = []
    const sleep = vi.fn(() => new Promise<void>((resolve) => { quietResolvers.push(resolve) }))
    const gate = createPageNetworkGate(
      peer,
      'page-session',
      origin,
      { externalAttempts: 0, controlFailed: false },
      { quietMs: 1, timeoutMs: 1_000, sleep },
    )
    gate.setMainLoader('main-loader')
    emitSuccessfulMain(emit, origin)
    emit('Fetch.requestPaused', {
      requestId: 'fetch-control',
      networkId: 'same-origin-fetch',
      request: { url: `${origin}/api/probe` },
    })

    const settling = gate.settle('disabled')
    await vi.waitFor(() => expect(resolveControl).toBeTypeOf('function'))
    expect(sleep).not.toHaveBeenCalled()
    resolveControl?.()

    await vi.waitFor(() => expect(quietResolvers).toHaveLength(1))
    emit('Network.dataReceived', { requestId: 'same-origin-fetch', dataLength: 1 })
    quietResolvers.shift()?.()

    await vi.waitFor(() => expect(quietResolvers).toHaveLength(1))
    quietResolvers.shift()?.()
    await expect(settling).resolves.toBeUndefined()
    expect(sleep).toHaveBeenCalledTimes(2)
  })

  it('disposes its subscription without replaying a cached quiesce failure', async () => {
    const origin = 'http://127.0.0.1:32001'
    const { peer, emit } = fakePageNetworkPeer()
    peer.send.mockRejectedValueOnce(new Error('blocked control failed'))
    const state = { externalAttempts: 0, controlFailed: false }
    const gate = createPageNetworkGate(peer, 'page-session', origin, state, {
      quietMs: 1,
      timeoutMs: 50,
    })
    gate.setMainLoader('main-loader')
    emitSuccessfulMain(emit, origin)
    emit('Fetch.requestPaused', {
      requestId: 'fetch-control',
      networkId: 'same-origin-fetch',
      request: { url: `${origin}/api/probe` },
    })

    await expect(gate.settle('disabled')).rejects.toMatchObject({
      stage2Code: 'STAGE2_NETWORK_CONTROL_FAILED',
      stage2Outcome: 'SAFETY_ABORT',
    })
    await expect(gate.dispose()).resolves.toBeUndefined()
  })

  it('continues peer close and retained-child stop when an earlier browser cleanup step fails', async () => {
    const page = { disposeNetwork: vi.fn(async () => { throw new Error('cached gate rejection') }) }
    const peer = { close: vi.fn(() => undefined) }
    const stopRetained = vi.fn(async () => undefined)

    const cleanup = await cleanupBrowserPhaseResources({
      page,
      peer,
      child: { exitCode: null, signalCode: null },
      devtools: { port: 43_191 },
      receipt: { pid: 123 },
      run: {},
      validated: {},
      operations: {
        stopRetained,
        stopIncomplete: vi.fn(async () => undefined),
        assertListenerAbsent: vi.fn(async () => undefined),
      },
    })

    expect(cleanup).toEqual({ ok: false })
    expect(page.disposeNetwork).toHaveBeenCalledOnce()
    expect(peer.close).toHaveBeenCalledOnce()
    expect(stopRetained).toHaveBeenCalledOnce()
  })

  it('requires main completion in every phase but requires the workbench client only when enabled', async () => {
    const origin = 'http://127.0.0.1:32001'
    const disabledPeer = fakePageNetworkPeer()
    const disabledGate = createPageNetworkGate(
      disabledPeer.peer,
      'page-session',
      origin,
      { externalAttempts: 0, controlFailed: false },
      { quietMs: 1, timeoutMs: 50 },
    )
    disabledGate.setMainLoader('main-loader')
    emitSuccessfulMain(disabledPeer.emit, origin)
    await expect(disabledGate.settle('disabled')).resolves.toBeUndefined()

    const incompletePeer = fakePageNetworkPeer()
    const incompleteGate = createPageNetworkGate(
      incompletePeer.peer,
      'page-session',
      origin,
      { externalAttempts: 0, controlFailed: false },
      { quietMs: 1, timeoutMs: 50 },
    )
    incompleteGate.setMainLoader('main-loader')
    emitResource(incompletePeer.emit, {
      requestId: 'document', type: 'Document', url: origin, finish: false,
    })
    incompletePeer.emit('Page.lifecycleEvent', { loaderId: 'main-loader', name: 'load' })
    emitSuccessfulPluginClient(incompletePeer.emit, origin)
    await expect(incompleteGate.settle('initial-enabled')).rejects.toMatchObject({
      stage2Code: 'STAGE2_PAGE_NAVIGATION_FAILED',
    })
  })
})

describe('Stage 2 five-phase state machine', () => {
  it('observes 0→1, restart 1, disabled absent, removed absent, and readd 1→2', async () => {
    const { adapters, events } = fakeAdapters()
    const emitted: string[] = []

    const result = await executeStage2Smoke({
      inputs,
      adapters,
      emit: (bytes: string) => {
        events.push('emit')
        emitted.push(bytes)
      },
    })

    expect(result.outcome).toBe('PASS')
    expect(result.phases.map((phase: { id: string; counters: number[]; markerState: string }) => ({
      id: phase.id,
      counters: phase.counters,
      markerState: phase.markerState,
    }))).toEqual([
      { id: 'initial-enabled', counters: [0, 1], markerState: 'present' },
      { id: 'restart-enabled', counters: [1], markerState: 'present' },
      { id: 'disabled', counters: [], markerState: 'absent' },
      { id: 'removed', counters: [], markerState: 'absent' },
      { id: 'readded', counters: [1, 2], markerState: 'present' },
    ])
    expect(adapters.browser.observePhase.mock.calls.map(([call]) => call.profilePath)).toEqual(
      STAGE2_PHASES.map((phase) => `/owned/run/browser/${phase}`),
    )
    expect(adapters.profile.add).toHaveBeenCalledTimes(2)
    expect(adapters.profile.remove).toHaveBeenCalledOnce()
    expect(events).toContain('profile.witness:installed-disabled')
    expect(events).toContain('profile.witness:removed')
    expect(events.at(-2)).toBe('workspace.cleanup')
    expect(events.at(-1)).toBe('emit')
    expect(emitted).toEqual([canonicalStage2Result(result)])
  })

  it('rejects any actual runtime port 3080 and still cleans the owned root', async () => {
    const { adapters, events } = fakeAdapters()
    adapters.runtime.start.mockResolvedValueOnce({
      port: 3080,
      origin: 'http://127.0.0.1:3080',
      spawnReceiptSha256: HASH_B,
      listenerWitnessSha256: HASH_C,
      loopback: true,
      stop: vi.fn(async () => { events.push('runtime.stop:forbidden') }),
    })

    const result = await executeStage2Smoke({ inputs, adapters })

    expect(result.outcome).toBe('SAFETY_ABORT')
    expect(result.failure).toEqual({ code: 'STAGE2_FORBIDDEN_PORT' })
    expect(events).toContain('runtime.stop:forbidden')
    expect(events.at(-1)).toBe('workspace.cleanup')
  })

  it('never removes the run root when retained-child shutdown is uncertain', async () => {
    const { adapters, events } = fakeAdapters()
    adapters.runtime.start.mockResolvedValueOnce({
      port: 32_001,
      origin: 'http://127.0.0.1:32001',
      spawnReceiptSha256: HASH_B,
      listenerWitnessSha256: HASH_C,
      loopback: true,
      stop: vi.fn(async () => { throw new Error('uncertain stop') }),
    })

    const result = await executeStage2Smoke({ inputs, adapters })

    expect(result.outcome).toBe('SAFETY_ABORT')
    expect(result.failure).toEqual({ code: 'STAGE2_RUNTIME_STOP_FAILED' })
    expect(result.cleanup).toEqual({ renamed: false, revalidated: false, removed: false })
    expect(events).not.toContain('workspace.cleanup')
  })

  it('marks process closure unproved when owned-root cleanup refuses', async () => {
    const { adapters } = fakeAdapters()
    adapters.workspace.cleanup.mockRejectedValueOnce(new Error('active child receipt remains'))

    const result = await executeStage2Smoke({ inputs, adapters })

    expect(result.outcome).toBe('SAFETY_ABORT')
    expect(result.failure).toEqual({ code: 'STAGE2_CLEANUP_FAILED' })
    expect(result.process.allStopped).toBe(false)
    expect(result.cleanup).toEqual({ renamed: false, revalidated: false, removed: false })
  })

  it('returns FAIL for a closed observation mismatch without copying raw errors', async () => {
    const { adapters } = fakeAdapters()
    adapters.browser.observePhase.mockImplementationOnce(async () => ({
      markerState: 'present',
      counters: [0, 2],
      focusRestored: true,
      externalNetworkAttempts: 0,
      chromeSpawnReceiptSha256: HASH_B,
      chromeListenerWitnessSha256: HASH_C,
    }))

    const result = await executeStage2Smoke({ inputs, adapters })

    expect(result.outcome).toBe('FAIL')
    expect(result.failure).toEqual({ code: 'STAGE2_OBSERVATION_MISMATCH' })
    expect(JSON.stringify(result)).not.toMatch(/stack|Users|private|CANARY|token/i)
  })

  it('records attached page-target network attempts before returning the matching FAIL', async () => {
    const { adapters } = fakeAdapters()
    adapters.browser.observePhase.mockImplementationOnce(async () => ({
      ...expectedObservation('initial-enabled'),
      externalNetworkAttempts: 1,
    }))

    const result = await executeStage2Smoke({ inputs, adapters })

    expect(result.outcome).toBe('FAIL')
    expect(result.failure).toEqual({ code: 'STAGE2_EXTERNAL_NETWORK_ATTEMPT' })
    expect(result.network).toEqual({ scope: 'browser-page-target', externalAttempts: 1 })
    expect(validateStage2SmokeResult(result)).toBe(result)
    expect(() => validateStage2SmokeResult({
      ...result,
      network: { scope: 'browser-page-target', externalAttempts: 0 },
    })).toThrow(/STAGE2_RESULT_INVALID/)
  })

  it('classifies a missing offline dependency without silently retrying online', async () => {
    const { adapters } = fakeAdapters()
    adapters.profile.add.mockRejectedValueOnce(Object.assign(new Error('raw registry URL'), {
      stage2Code: 'STAGE2_OFFLINE_DEPENDENCY_MISSING',
      stage2Outcome: 'NEEDS_NETWORK_PERMISSION',
    }))

    const result = await executeStage2Smoke({ inputs, adapters })

    expect(result.outcome).toBe('NEEDS_NETWORK_PERMISSION')
    expect(result.failure).toEqual({ code: 'STAGE2_OFFLINE_DEPENDENCY_MISSING' })
    expect(adapters.profile.add).toHaveBeenCalledOnce()
    expect(JSON.stringify(result)).not.toContain('raw registry URL')
  })

  it('classifies an untyped adapter failure as a closed INCONCLUSIVE outcome', async () => {
    const { adapters } = fakeAdapters()
    adapters.runtime.start.mockRejectedValueOnce(new Error('/Users/private/CANARY raw failure'))

    const result = await executeStage2Smoke({ inputs, adapters })

    expect(result.outcome).toBe('INCONCLUSIVE')
    expect(result.failure).toEqual({ code: 'STAGE2_INTERNAL_FAILURE' })
    expect(JSON.stringify(result)).not.toMatch(/Users|CANARY|raw failure/)
  })
})

describe('owned cleanup and independent result verification', () => {
  it('accepts only a fully explained lexical tree closure and records symlinks without following', () => {
    const inventory = [
      { path: '.', kind: 'directory', dev: '1', ino: '1', mode: '448', nlink: '3', size: '96' },
      { path: 'a', kind: 'file', dev: '1', ino: '2', mode: '420', nlink: '2', size: '1' },
      { path: 'b', kind: 'file', dev: '1', ino: '2', mode: '420', nlink: '2', size: '1' },
      { path: 'fallback', kind: 'symlink', dev: '1', ino: '3', mode: '511', nlink: '1', size: '17', target: '../../outside/pkg' },
    ]

    expect(validateTreeClosureInventory(inventory)).toBe(inventory)
    expect(() => validateTreeClosureInventory(inventory.filter((entry) => entry.path !== 'b')))
      .toThrow(/STAGE2_TREE_HARDLINK_ESCAPE/)
    expect(() => validateTreeClosureInventory([
      ...inventory,
      { path: 'pipe', kind: 'special', dev: '1', ino: '4', mode: '420', nlink: '1', size: '0' },
    ])).toThrow(/STAGE2_TREE_SPECIAL_FILE/)
    expect(() => validateTreeClosureInventory([
      inventory[0],
      { path: 'mounted', kind: 'directory', dev: '2', ino: '4', mode: '493', nlink: '2', size: '64' },
    ])).toThrow(/STAGE2_TREE_CROSS_DEVICE/)
  })

  it('inventories real hardlinks and records an interior symlink lexically', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'stage2-tree-unit-'))
    try {
      await writeFile(path.join(root, 'a'), 'x')
      await link(path.join(root, 'a'), path.join(root, 'b'))
      await symlink('../../outside/pkg', path.join(root, 'fallback'))

      const inventory = await inventoryOwnedTree(root)

      expect(inventory.map((entry: { path: string }) => entry.path)).toEqual(['.', 'a', 'b', 'fallback'])
      expect(inventory.find((entry: { path: string }) => entry.path === 'fallback')).toMatchObject({
        kind: 'symlink',
        target: '../../outside/pkg',
      })
      expect(inventory.filter((entry: { kind: string; ino: string }) => entry.kind === 'file')
        .map((entry: { ino: string }) => entry.ino)).toEqual([
        inventory.find((entry: { path: string }) => entry.path === 'a')?.ino,
        inventory.find((entry: { path: string }) => entry.path === 'a')?.ino,
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('requires the original and renamed tombstone inventories to remain exactly equal', () => {
    const before = [{ path: '.', kind: 'directory', dev: '1', ino: '1', mode: '448', nlink: '2', size: '64' }]
    const after = before.map((entry) => ({ ...entry }))
    expect(assertSameTreeInventory(before, after)).toBe(true)
    expect(() => assertSameTreeInventory(before, [{ ...after[0], mode: '493' }]))
      .toThrow(/STAGE2_TREE_INVENTORY_DRIFT/)
  })

  it('requires a bounded all-process lsof +D absence proof before cleanup', async () => {
    const validated = { assert: vi.fn(async () => undefined) }
    const absent = vi.fn(async () => {
      throw Object.assign(new Error('no matches'), { code: 1, stdout: '', stderr: '' })
    })
    await expect(proveNoOpenHandles('/owned/run', validated, { execFile: absent })).resolves.toBe(true)
    expect(absent).toHaveBeenCalledWith('/usr/sbin/lsof', [
      '-nP', '+D', '/owned/run', '-Fpcfnt',
    ], expect.objectContaining({ shell: false }))

    await expect(proveNoOpenHandles('/owned/run', validated, {
      execFile: vi.fn(async () => ({ stdout: 'p42\nfcwd\nn/owned/run\n', stderr: '' })),
    })).rejects.toThrow(/STAGE2_OPEN_HANDLE_REMAINS/)
    await expect(proveNoOpenHandles('/owned/run', validated, {
      execFile: vi.fn(async () => { throw Object.assign(new Error('timed out'), { code: 'ETIMEDOUT' }) }),
    })).rejects.toThrow(/STAGE2_OPEN_HANDLE_UNPROVED/)
    expect(isStrictLsofNoMatch({ code: 1, stdout: '', stderr: '' })).toBe(true)
    expect(isStrictLsofNoMatch({ code: '1', stdout: '', stderr: '' })).toBe(false)
    expect(isStrictLsofNoMatch({ code: 1, stdout: '', stderr: 'warning' })).toBe(false)
    expect(isStrictLsofNoMatch({ code: 1, stdout: '', stderr: '', killed: true })).toBe(false)
    expect(isStrictLsofNoMatch({ code: 1, stdout: '', stderr: '', signal: 'SIGTERM' })).toBe(false)
  })

  it('discharges profile children directly only after one clean exit zero', () => {
    expect(classifyProfileExit({
      exitCode: 0, signalCode: null, captureError: null, overflow: false,
    })).toBe('direct')
    expect(classifyProfileExit({
      exitCode: 1, signalCode: null, captureError: null, overflow: false,
    })).toBe('negative-witness')
    expect(classifyProfileExit({
      exitCode: null, signalCode: 'SIGTERM', captureError: null, overflow: false,
    })).toBe('uncertain')
    expect(classifyProfileExit({
      exitCode: 0, signalCode: null, captureError: new Error('capture'), overflow: false,
    })).toBe('uncertain')
    expect(classifyProfileExit({
      exitCode: 0, signalCode: null, captureError: null, overflow: true,
    })).toBe('uncertain')
  })

  it('revalidates Node then npm provenance as one ordered pack boundary', async () => {
    const calls: string[] = []
    const validated = { assert: vi.fn(async (key: string) => { calls.push(key) }) }

    await expect(assertPackToolProvenance(validated)).resolves.toBe(true)

    expect(calls).toEqual(['node', 'npmCli'])
  })

  it('rejects a forged build-output hash before verified bytes can be staged', () => {
    const allowlist = ['lib/client.js', 'lib/index.js', 'package.json']
    const files = allowlist.map((file) => {
      const bytes = Buffer.from(file === 'package.json' ? '{}' : file)
      return { path: file, mode: 0o644, size: bytes.byteLength, sha256: digest(bytes), bytes }
    })
    const verification = {
      name: '@knight/dsh-pm-workbench',
      version: '0.1.0',
      bundledZod: true,
      runtimeDependencies: 0,
      files,
      outputHashes: {
        'lib/client.js': files[0].sha256,
        'lib/index.js': files[1].sha256,
      },
    }

    expect(validatePackageVerificationReceipt(verification, allowlist)).toBe(verification)
    expect(() => validatePackageVerificationReceipt({
      ...verification,
      outputHashes: { ...verification.outputHashes, 'lib/client.js': HASH_C },
    }, allowlist)).toThrow(/STAGE2_BUILD_OUTPUT_HASH_INVALID/)
  })

  it('binds npm pack path, size, and normalized mode to the frozen nine-file receipt', () => {
    const verification = {
      files: [
        { path: 'LICENSE', size: 12, mode: 0o100644 },
        { path: 'lib/index.js', size: 20, mode: 0o100644 },
      ],
    }
    const metadata = {
      files: [
        { path: 'LICENSE', size: 12, mode: 0o644 },
        { path: 'lib/index.js', size: 20, mode: 0o644 },
      ],
    }

    expect(validatePackedMetadataAgainstVerification(metadata, verification)).toBe(metadata)
    expect(() => validatePackedMetadataAgainstVerification({
      files: metadata.files.map((file) => file.path === 'lib/index.js' ? { ...file, size: 21 } : file),
    }, verification)).toThrow(/STAGE2_PACK_METADATA_DRIFT/)
    expect(() => validatePackedMetadataAgainstVerification({
      files: metadata.files.map((file) => file.path === 'LICENSE' ? { ...file, mode: 0o600 } : file),
    }, verification)).toThrow(/STAGE2_PACK_METADATA_DRIFT/)
  })

  it('rejects an installed package file whose permission mode drifted', () => {
    const expected = { path: 'lib/index.js', size: 20, mode: 0o100644, sha256: HASH_A }
    const observed = { sha256: HASH_A, identity: { size: '20', mode: String(0o100644) } }

    expect(validateObservedPackageFile(observed, expected)).toBe(observed)
    expect(() => validateObservedPackageFile({
      ...observed,
      identity: { ...observed.identity, mode: String(0o100600) },
    }, expected)).toThrow(/STAGE2_PROFILE_WITNESS_INVALID/)
  })

  it('never exits successfully with empty output when the six CLI inputs are absent', async () => {
    const emitted: string[] = []
    const exitCode = await runStage2Cli([], { emit: (bytes: string) => { emitted.push(bytes) } })

    expect(exitCode).toBe(1)
    expect(emitted).toHaveLength(1)
    const parsed = JSON.parse(emitted[0])
    expect(parsed.outcome).toBe('SAFETY_ABORT')
    expect(parsed.failure).toEqual({ code: 'STAGE2_INPUT_INVALID' })
    expect(canonicalStage2Result(parsed)).toBe(emitted[0])
  })

  it('renames, revalidates, removes, and proves absence in that order', async () => {
    const events: string[] = []
    const deps = {
      revalidate: vi.fn(async (path: string) => { events.push(`revalidate:${path}`) }),
      rename: vi.fn(async (from: string, to: string) => { events.push(`rename:${from}:${to}`) }),
      remove: vi.fn(async (path: string) => { events.push(`remove:${path}`) }),
      assertAbsent: vi.fn(async (path: string) => { events.push(`absent:${path}`) }),
    }

    await cleanupOwnedRunRoot({
      runRoot: '/tmp/stage2-owned-run',
      tombstoneRoot: '/tmp/stage2-owned-run.cleanup',
      marker: 'owner-1',
    }, deps)

    expect(events).toEqual([
      'revalidate:/tmp/stage2-owned-run',
      'rename:/tmp/stage2-owned-run:/tmp/stage2-owned-run.cleanup',
      'revalidate:/tmp/stage2-owned-run.cleanup',
      'remove:/tmp/stage2-owned-run.cleanup',
      'absent:/tmp/stage2-owned-run.cleanup',
    ])
  })

  it('refuses production cleanup while one registered child remains live', async () => {
    const validated = { inputs, assert: vi.fn(async () => undefined) }
    const adapters = createProductionAdapters(validated)
    const run = await adapters.workspace.create()
    const child: { exitCode: number | null; signalCode: string | null } = { exitCode: null, signalCode: null }
    const receipt = { child }
    run.registerChild(receipt)

    try {
      await expect(adapters.workspace.cleanup(run)).rejects.toThrow(/STAGE2_LIVE_CHILD_UNCERTAIN/)
    } finally {
      child.exitCode = 0
      run.markChildStopped(receipt)
      await rm(run.runRoot, { recursive: true, force: true })
    }
  })

  it('accepts only the closed sanitized PASS result and renders the bounded claim', async () => {
    const { adapters } = fakeAdapters()
    const result = await executeStage2Smoke({ inputs, adapters })

    expect(validateStage2SmokeResult(result)).toEqual(result)
    expect(result.network).toEqual({ scope: 'browser-page-target', externalAttempts: 0 })
    const markdown = renderStage2SmokeMarkdown(result)
    expect(markdown).toContain('The Stage 2 isolated smoke passed for the recorded rc.6 combination.')
    expect(markdown).not.toMatch(/\/Users\/|\/private\/|127\.0\.0\.1:\d+|pid|WebSocket/i)
    expect(markdown).toContain('Network observation scope: browser-page-target')
    expect(markdown).not.toContain('all network traffic')

    expect(() => validateStage2SmokeResult({ ...result, extra: true })).toThrow(/STAGE2_RESULT_INVALID/)
    expect(() => validateStage2SmokeResult({
      ...result,
      network: { scope: 'global', externalAttempts: 0 },
    })).toThrow(/STAGE2_RESULT_INVALID/)
    expect(() => validateStage2SmokeResult({
      ...result,
      failure: { code: '/Users/private/CANARY' },
    })).toThrow(/STAGE2_RESULT_INVALID/)
  })

  it('rejects forged non-PASS phase, count, cleanup, and outcome evidence', async () => {
    const { adapters } = fakeAdapters()
    const pass = await executeStage2Smoke({ inputs, adapters })
    const onePhase = {
      ...pass,
      outcome: 'INCONCLUSIVE',
      phases: [pass.phases[0]],
      process: {
        spawnReceipts: 2,
        listenerWitnesses: 2,
        allLoopback: true,
        allStopped: true,
        freshBrowserProfiles: 1,
      },
      failure: { code: 'STAGE2_INTERNAL_FAILURE' },
    }
    expect(validateStage2SmokeResult(onePhase)).toBe(onePhase)
    expect(() => validateStage2SmokeResult({
      ...onePhase,
      phases: [{ ...(onePhase.phases[0] as Record<string, unknown>), counters: [99] }],
    })).toThrow(/STAGE2_RESULT_INVALID/)
    expect(() => validateStage2SmokeResult({
      ...onePhase,
      process: { ...onePhase.process, spawnReceipts: 3 },
    })).toThrow(/STAGE2_RESULT_INVALID/)
    expect(() => validateStage2SmokeResult({
      ...onePhase,
      cleanup: { renamed: false, revalidated: false, removed: true },
    })).toThrow(/STAGE2_RESULT_INVALID/)
    expect(() => validateStage2SmokeResult({
      ...onePhase,
      outcome: 'SAFETY_ABORT',
      process: { ...onePhase.process, allStopped: true },
      cleanup: { renamed: false, revalidated: false, removed: false },
      failure: { code: 'STAGE2_CLEANUP_FAILED' },
    })).toThrow(/STAGE2_RESULT_INVALID/)
    expect(() => validateStage2SmokeResult({
      ...onePhase,
      outcome: 'FAIL',
      failure: { code: 'STAGE2_INTERNAL_FAILURE' },
    })).toThrow(/STAGE2_RESULT_INVALID/)
    expect(() => validateStage2SmokeResult({
      ...onePhase,
      failure: { code: 'STAGE2_UNKNOWN_FORGED' },
    })).toThrow(/STAGE2_RESULT_INVALID/)
  })
})
