import type { CSSProperties } from 'react'

import type {
  ProbeFocusTarget,
  ProbeStoreState,
} from './store.js'

const buttonStyle: CSSProperties = {
  appearance: 'none',
  border: '1px solid rgba(196, 181, 253, 0.42)',
  borderRadius: 10,
  background: 'rgba(35, 29, 48, 0.92)',
  color: '#f5f3ff',
  cursor: 'pointer',
  font: 'inherit',
  padding: '8px 12px',
}

export interface ProbeLauncherProps {
  readonly onOpen: (focusTarget: ProbeFocusTarget) => void
}

export function ProbeLauncher({ onOpen }: ProbeLauncherProps) {
  return <button
    type="button"
    data-dsh-pm-workbench="launcher"
    aria-haspopup="dialog"
    style={{ ...buttonStyle, padding: '6px 10px', fontSize: 13 }}
    onClick={(event) => { onOpen(event.currentTarget) }}
  >
    PM 探针
  </button>
}

export interface ProbeViewProps {
  readonly state: ProbeStoreState
  readonly onRefresh: () => void
  readonly onIncrement: () => void
  readonly onClose: () => void
}

function phaseText(state: ProbeStoreState): string {
  switch (state.phase) {
    case 'loading': return '连接中'
    case 'ready': return '已连接'
    case 'updating': return '正在写入合成计数器'
    case 'uncertain': return '结果待确认，请刷新'
    case 'error': return state.error === 'version-conflict' ? '版本已变化，请刷新' : '探针暂不可用'
    case 'closed': return '已关闭'
  }
}

export function ProbeView({
  state,
  onRefresh,
  onIncrement,
  onClose,
}: ProbeViewProps) {
  if (!state.isOpen) return null
  const authoritative = state.authoritative
  const busy = state.phase === 'loading' || state.phase === 'updating'
  const writeReady = state.phase === 'ready' && authoritative !== undefined

  return <section
    data-dsh-pm-workbench="overlay"
    data-phase={state.phase}
    role="dialog"
    aria-modal="true"
    aria-labelledby="dsh-pm-workbench-probe-title"
    style={{
      pointerEvents: 'auto',
      position: 'fixed',
      inset: 'auto 24px 24px auto',
      zIndex: 1200,
      width: 'min(360px, calc(100vw - 32px))',
      boxSizing: 'border-box',
      border: '1px solid rgba(196, 181, 253, 0.35)',
      borderRadius: 18,
      background: 'rgba(21, 18, 29, 0.96)',
      boxShadow: '0 18px 60px rgba(0, 0, 0, 0.42)',
      color: '#f5f3ff',
      padding: 18,
      fontFamily: 'ui-sans-serif, system-ui, sans-serif',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: 12 }}>
      <div>
        <h2 id="dsh-pm-workbench-probe-title" style={{ margin: 0, fontSize: 17 }}>PM Workbench 探针</h2>
        <p style={{ margin: '5px 0 0', color: '#c4b5fd', fontSize: 12 }}>仅使用合成计数器</p>
      </div>
      <button type="button" data-dsh-pm-workbench="close" aria-label="关闭探针" style={buttonStyle} onClick={onClose}>关闭</button>
    </div>

    <p aria-live="polite" style={{ margin: '16px 0 10px', color: '#ddd6fe', fontSize: 13 }}>{phaseText(state)}</p>
    {authoritative && <div
      data-dsh-pm-workbench="counter"
      data-counter={authoritative.counter}
      data-version={authoritative.aggregateVersion}
      style={{ borderRadius: 12, background: 'rgba(124, 58, 237, 0.13)', padding: 14 }}
    >
      <div style={{ fontSize: 30, fontVariantNumeric: 'tabular-nums' }}>{authoritative.counter}</div>
      <div style={{ marginTop: 4, color: '#b7adc8', fontSize: 12 }}>版本 {authoritative.aggregateVersion}</div>
    </div>}

    <p style={{ margin: '12px 0', color: '#b7adc8', fontSize: 12 }}>
      DeepSeek Harness {authoritative?.harnessTarget ?? '0.1.0-rc.6'} · 插件 {authoritative?.pluginVersion ?? '0.1.0'}
    </p>
    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
      <button type="button" style={buttonStyle} disabled={busy} onClick={onRefresh}>刷新</button>
      <button
        type="button"
        data-dsh-pm-workbench="increment"
        style={{ ...buttonStyle, background: 'rgba(109, 40, 217, 0.92)' }}
        disabled={!writeReady}
        onClick={onIncrement}
      >
        +1
      </button>
    </div>
  </section>
}
