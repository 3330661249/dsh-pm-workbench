import type { CSSProperties } from 'react'

export const dialogStyle: CSSProperties = {
  pointerEvents: 'auto', color: '#e8edf5', background: '#151c29', border: '1px solid #536078',
  borderRadius: 16, padding: 24, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)',
  overflow: 'auto', boxSizing: 'border-box',
}
export const workbenchCss = `
.pmwb { width: 1240px; font: 15px/1.65 system-ui, sans-serif; }
.pmwb * { box-sizing: border-box; }
.pmwb h1, .pmwb h2, .pmwb h3, .pmwb p { margin: 0 0 12px; }
.pmwb header, .pmwb nav, .pmwb-actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; margin-bottom: 16px; }
.pmwb header h1 { flex: 1; }
.pmwb button, .pmwb input, .pmwb textarea, .pmwb select { font: inherit; color: inherit; background: #202c3e; border: 1px solid #657591; border-radius: 7px; padding: 8px 12px; }
.pmwb button { cursor: pointer; }
.pmwb button:disabled { opacity: .5; cursor: default; }
.pmwb :focus-visible { outline: 3px solid #93d7ff; outline-offset: 3px; }
.pmwb label { display: block; margin-top: 12px; }
.pmwb input:not([type=checkbox]), .pmwb textarea { display: block; width: 100%; }
.pmwb textarea { min-height: 100px; resize: vertical; }
.pmwb-body { display: grid; grid-template-columns: 230px minmax(0, 1fr); gap: 24px; }
.pmwb section, .pmwb article { border: 1px solid #43516a; border-radius: 10px; padding: 18px; margin-bottom: 18px; min-width: 0; }
.pmwb aside ul { padding: 0; list-style: none; }
.pmwb aside li { margin-bottom: 16px; overflow-wrap: anywhere; }
.pmwb pre, .pmwb blockquote { white-space: pre-wrap; overflow-wrap: anywhere; margin: 12px 0; }
.pmwb pre { max-height: 460px; overflow: auto; background: #101722; padding: 12px; }
.pmwb dl { margin: 8px 0; } .pmwb dt { color: #b0c9e7; } .pmwb dd { margin: 0 0 10px; white-space: pre-wrap; overflow-wrap: anywhere; }
.pmwb-notice { padding: 12px; background: #233149; border-radius: 8px; }
.pmwb [role=alert] { color: #ffd49c; }
.pmwb dialog { width: 540px; } .pmwb dialog::backdrop, dialog.pmwb::backdrop { background: #050a12b8; }
@media (max-width: 760px) { .pmwb-body { grid-template-columns: 1fr; } .pmwb { padding: 16px !important; } }
`
