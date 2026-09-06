import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import {
  ProbeLauncher,
  ProbeView,
} from '../../packages/workbench/src/client/probe/ProbeView.js'
import type { ProbeStoreState } from '../../packages/workbench/src/client/probe/store.js'

const readyState: ProbeStoreState = {
  isOpen: true,
  phase: 'ready',
  authoritative: {
    mode: 'gate-a-probe',
    counter: 2,
    aggregateVersion: 2,
    pluginVersion: '0.1.0',
    harnessTarget: '0.1.0-rc.6',
  },
}

describe('ProbeView SSR contract', () => {
  it('renders the exact launcher marker without replacing a Harness root', () => {
    const html = renderToStaticMarkup(<ProbeLauncher onOpen={() => {}} />)

    expect(html).toContain('data-dsh-pm-workbench="launcher"')
    expect(html).toContain('type="button"')
    expect(html).not.toContain('data-dsh-pm-workbench="root"')
  })

  it('renders an accessible pointer-active dialog with stable numeric smoke markers', () => {
    const html = renderToStaticMarkup(<ProbeView
      state={readyState}
      onRefresh={() => {}}
      onIncrement={() => {}}
      onClose={() => {}}
    />)

    expect(html).toContain('data-dsh-pm-workbench="overlay"')
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toMatch(/aria-labelledby="[^"]+"/)
    expect(html).toMatch(/pointer-events:auto/)
    expect(html).toContain('data-dsh-pm-workbench="counter"')
    expect(html).toContain('data-counter="2"')
    expect(html).toContain('data-version="2"')
    expect(html).toContain('data-dsh-pm-workbench="increment"')
    expect(html).toContain('data-dsh-pm-workbench="close"')
    expect(html).toContain('DeepSeek Harness 0.1.0-rc.6')
    expect(html).toContain('插件 0.1.0')
    expect(html).toContain('刷新')
    expect(html).toContain('+1')
    const incrementButton = html.match(/<button[^>]*data-dsh-pm-workbench="increment"[^>]*>/u)?.[0]
    expect(incrementButton).not.toContain('disabled=""')
  })

  it('renders nothing while the overlay is closed', () => {
    const html = renderToStaticMarkup(<ProbeView
      state={{ isOpen: false, phase: 'closed' }}
      onRefresh={() => {}}
      onIncrement={() => {}}
      onClose={() => {}}
    />)
    expect(html).toBe('')
  })

  it('does not expose a synthetic zero as authoritative before health is accepted', () => {
    const html = renderToStaticMarkup(<ProbeView
      state={{ isOpen: true, phase: 'loading' }}
      onRefresh={() => {}}
      onIncrement={() => {}}
      onClose={() => {}}
    />)

    expect(html).not.toContain('data-dsh-pm-workbench="counter"')
    expect(html).not.toContain('data-counter="0"')
  })

  it('does not expose real-data workflow language or arbitrary error payloads', () => {
    const html = renderToStaticMarkup(<ProbeView
      state={{ ...readyState, phase: 'uncertain', error: 'transport-internal' }}
      onRefresh={() => {}}
      onIncrement={() => {}}
      onClose={() => {}}
    />)
    for (const forbidden of ['访谈', '录音', '文件', '工作区', 'API key', 'provider', 'CANARY']) {
      expect(html).not.toContain(forbidden)
    }
    expect(html).toContain('结果待确认')
  })

  it.each([
    { phase: 'uncertain' as const, error: 'transport-internal' as const },
    { phase: 'error' as const, error: 'version-conflict' as const },
    { phase: 'error' as const, error: 'protocol-invalid' as const },
    { phase: 'updating' as const, error: undefined },
  ])('disables +1 while the state requires refresh confirmation: $phase', ({ phase, error }) => {
    const html = renderToStaticMarkup(<ProbeView
      state={{ ...readyState, phase, error }}
      onRefresh={() => {}}
      onIncrement={() => {}}
      onClose={() => {}}
    />)

    const incrementButton = html.match(/<button[^>]*data-dsh-pm-workbench="increment"[^>]*>/u)?.[0]
    expect(incrementButton).toContain('disabled=""')
  })
})
