import type { CSSProperties } from 'react'

export const dialogStyle: CSSProperties = {
  pointerEvents: 'auto', color: '#eeeeee', background: '#151515', border: '1px solid rgba(255,255,255,.14)',
  borderRadius: 16, padding: 24, maxWidth: 'calc(100vw - 32px)', maxHeight: 'calc(100vh - 32px)',
  overflow: 'auto', boxSizing: 'border-box', boxShadow: '0 24px 80px rgba(0,0,0,.5)',
}

export const workbenchDialogStyle: CSSProperties = {
  pointerEvents: 'auto', color: '#f4f4f4', background: 'transparent', border: 0,
  borderRadius: 0, padding: 0, margin: 0, width: '100vw', height: '100dvh',
  maxWidth: 'none', maxHeight: 'none', overflow: 'hidden', boxSizing: 'border-box',
}

export const workbenchCss = `
.pmwb {
  --pmwb-glass: rgba(17, 17, 17, .64);
  --pmwb-glass-strong: rgba(18, 18, 18, .74);
  --pmwb-glass-soft: rgba(255, 255, 255, .06);
  --pmwb-line: rgba(255, 255, 255, .16);
  --pmwb-line-soft: rgba(255, 255, 255, .095);
  --pmwb-text: #f5f5f5;
  --pmwb-muted: rgba(242, 242, 242, .74);
  --pmwb-subtle: rgba(242, 242, 242, .50);
  --pmwb-accent: #b8b8b8;
  --pmwb-accent-strong: #eeeeee;
  --pmwb-success: #c9c9c9;
  position: relative;
  width: 100vw;
  height: 100dvh;
  max-width: none;
  max-height: none;
  padding: 0 !important;
  color: var(--pmwb-text);
  background: transparent;
  border: 0;
  font: 15px/1.58 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
  box-shadow: none;
}
.pmwb::backdrop { background: rgba(3, 3, 3, .08); backdrop-filter: grayscale(1); -webkit-backdrop-filter: grayscale(1); }
/* Keep the ripple canvas, but do not expose a second sidebar through the modal. */
body:has(dialog[data-dsh-pm-workbench=overlay][open]) [data-slot=sidebar],
body:has(dialog[data-dsh-pm-workbench=overlay][open]) [data-slot=sidebar] * { visibility: hidden !important; }
.pmwb * { box-sizing: border-box; }
.pmwb h1, .pmwb h2, .pmwb h3, .pmwb p, .pmwb blockquote { margin: 0; }
.pmwb-dialog-heading, .pmwb-visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.pmwb-shell {
  position: relative; z-index: 1; width: calc(100% - 64px); height: calc(100dvh - 64px);
  min-height: 0; margin: 32px; display: grid; grid-template-rows: 72px minmax(0, 1fr);
  border: 1px solid var(--pmwb-line); border-radius: 18px; background: rgba(20, 20, 20, .86);
  box-shadow: 0 24px 80px rgba(0, 0, 0, .24); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
}
.pmwb-shell-header {
  position: relative; z-index: 20; min-width: 0; display: grid;
  grid-template-columns: auto minmax(150px, 250px) minmax(0, 1fr) auto; align-items: center; gap: 18px;
  padding: 0 36px; border-bottom: 1px solid var(--pmwb-line-soft);
}
.pmwb-brand { display: flex; align-items: center; padding-right: 22px; border-right: 1px solid var(--pmwb-line); }
.pmwb-shell-header .pmwb-brand-mark { display: none; }
.pmwb-brand-mark { width: 28px; height: 28px; flex: 0 0 auto; color: var(--pmwb-text); }
.pmwb .dsh-pm-launcher-prism-blade { fill: currentColor; }
.pmwb .dsh-pm-launcher-prism-blade--top { opacity: .96; }
.pmwb .dsh-pm-launcher-prism-blade--right { fill: var(--pmwb-accent); opacity: .9; }
.pmwb .dsh-pm-launcher-prism-blade--left { fill: #d9d9d9; opacity: .7; }
.pmwb .dsh-pm-launcher-prism-core { fill: #fff; }
.pmwb-brand strong { white-space: nowrap; font-size: 20px; font-weight: 630; letter-spacing: .01em; }
.pmwb button, .pmwb input, .pmwb textarea, .pmwb select, .pmwb summary { font: inherit; color: inherit; }
.pmwb button, .pmwb summary { cursor: pointer; }
.pmwb button {
  border: 1px solid var(--pmwb-line); border-radius: 9px; padding: 8px 12px;
  color: var(--pmwb-text); background: rgba(255, 255, 255, .055);
  transition: color 160ms ease, background 160ms ease, border-color 160ms ease, transform 160ms ease, opacity 160ms ease;
}
.pmwb button:hover:not(:disabled) { border-color: rgba(255, 255, 255, .24); background: rgba(255, 255, 255, .09); }
.pmwb button:active:not(:disabled) { transform: scale(.98); }
.pmwb button:disabled { cursor: default; opacity: .38; }
.pmwb :focus-visible { outline: 2px solid var(--pmwb-accent-strong); outline-offset: 3px; }
.pmwb-project-switcher { position: relative; z-index: 32; min-width: 0; width: 100%; }
.pmwb-project-switcher > summary {
  min-width: 0; min-height: 40px; display: list-item; padding: 7px 10px;
  border: 1px solid transparent; border-radius: 8px; color: var(--pmwb-muted); list-style: disclosure-closed;
}
.pmwb-project-switcher > summary::-webkit-details-marker { display: inline; }
.pmwb-project-switcher > summary:hover, .pmwb-project-switcher[open] > summary { background: var(--pmwb-glass-soft); }
.pmwb-project-switcher > summary span { display: inline-block; max-width: 100%; vertical-align: middle; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.pmwb-project-switcher > summary small { display: none; flex: 0 0 auto; color: var(--pmwb-subtle); font-size: 11px; }
.pmwb-project-menu {
  position: absolute; top: calc(100% + 12px); left: 0; z-index: 40; width: 310px; max-width: calc(100vw - 64px); max-height: min(440px, 65dvh); overflow: auto;
  padding: 14px; border: 1px solid var(--pmwb-line); border-radius: 12px; background: rgba(22, 22, 22, .98);
  box-shadow: 0 20px 60px rgba(0, 0, 0, .42);
}
.pmwb-project-menu > header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.pmwb-project-menu > header > div { display: flex; align-items: center; gap: 8px; }
.pmwb-project-menu h2 { font-size: 13px; font-weight: 650; }
.pmwb-project-menu header span { color: var(--pmwb-subtle); font-size: 11px; }
.pmwb .pmwb-new-project { padding: 5px 10px; color: var(--pmwb-accent-strong); background: rgba(255, 255, 255, .08); }
.pmwb-project-menu ul { display: grid; gap: 6px; padding: 0; margin: 0; list-style: none; }
.pmwb-project-menu li { min-width: 0; padding: 8px; border-radius: 9px; }
.pmwb-project-menu li:hover { background: rgba(255, 255, 255, .045); }
.pmwb-project-menu li > small { display: none; }
.pmwb .pmwb-project-item { width: 100%; padding: 3px 0; overflow: hidden; text-align: left; text-overflow: ellipsis; white-space: nowrap; border: 0; background: transparent; }
.pmwb .pmwb-project-item[aria-current=true] { color: var(--pmwb-accent-strong); }
.pmwb-project-goal { overflow: hidden; color: var(--pmwb-subtle); font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.pmwb-rail-empty, .pmwb-rail-message { padding: 10px 4px; color: var(--pmwb-muted); }
.pmwb-rail-empty small { color: var(--pmwb-subtle); }
.pmwb-stepper {
  min-width: 0; width: 100%; max-width: 860px; justify-self: center; display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 4px;
}
.pmwb .pmwb-stepper button {
  position: relative; display: flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 52px; padding: 10px 4px; border: 0; border-radius: 5px; color: var(--pmwb-subtle);
  background: transparent; white-space: nowrap; font-size: 14px;
}
.pmwb .pmwb-stepper button::after { content: ''; position: absolute; left: 12%; right: 12%; bottom: 1px; height: 1px; background: transparent; }
.pmwb .pmwb-stepper button > span {
  display: grid; place-items: center; flex: 0 0 auto; width: 22px; height: 22px; border: 1px solid rgba(255,255,255,.24);
  border-radius: 50%; font: 600 11px/1 ui-sans-serif, sans-serif;
}
.pmwb .pmwb-stepper button[aria-current=step] { color: var(--pmwb-text); }
.pmwb .pmwb-stepper button[aria-current=step]::after { background: rgba(255, 255, 255, .78); }
.pmwb .pmwb-stepper button[aria-current=step] > span { color: #161616; border-color: var(--pmwb-accent-strong); background: var(--pmwb-accent-strong); }
.pmwb-header-actions { min-width: 0; display: flex; align-items: center; justify-content: flex-end; gap: 10px; }
.pmwb-save-state { display: inline-flex; align-items: center; gap: 6px; margin-right: 3px; color: var(--pmwb-subtle); font-size: 11px; white-space: nowrap; }
.pmwb-save-state::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #8b8b8b; }
.pmwb-save-state--saved::before { background: var(--pmwb-success); }
.pmwb-save-state--saving::before { background: #c7c7c7; }
.pmwb-save-state--failed::before, .pmwb-save-state--uncertain::before { background: #999999; }
.pmwb .pmwb-header-actions button { padding: 6px 7px; border-color: transparent; color: var(--pmwb-muted); background: transparent; font-size: 11px; }
.pmwb .pmwb-header-actions button:hover:not(:disabled) { color: var(--pmwb-text); background: var(--pmwb-glass-soft); }
.pmwb .pmwb-danger-action:hover:not(:disabled) { color: #f0f0f0; }
.pmwb .pmwb-header-actions .pmwb-quiet-action,
.pmwb .pmwb-header-actions .pmwb-danger-action { display: none; }
.pmwb-spatial-stage { position: relative; min-width: 0; min-height: 0; display: grid; padding: 0; overflow: hidden; border-radius: 0 0 18px 18px; }
.pmwb-toast {
  position: absolute; top: 12px; left: 50%; z-index: 30; transform: translateX(-50%); padding: 7px 12px;
  border: 1px solid rgba(200, 200, 200, .24); border-radius: 9px; color: #d0d0d0; background: rgba(24, 24, 24, .84);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); font-size: 12px;
}
.pmwb-surface {
  width: 100%; height: 100%; min-height: 0; max-height: none; overflow: auto;
  padding: 32px; border: 0; background: transparent;
}
.pmwb-surface > header { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; padding-bottom: 20px; margin-bottom: 22px; border-bottom: 1px solid var(--pmwb-line-soft); }
.pmwb-surface > header span { color: var(--pmwb-subtle); font-size: 11px; letter-spacing: .08em; }
.pmwb-surface > header h2 { margin-top: 3px; font-size: 26px; font-weight: 650; letter-spacing: -.025em; }
.pmwb-surface > header > div { min-width: 0; overflow-wrap: anywhere; }
.pmwb-surface > header p { max-width: 46ch; color: var(--pmwb-muted); text-align: right; }
.pmwb-review { width: 100%; height: 100%; min-height: 0; display: grid; grid-template-rows: minmax(0, 1fr) auto; overflow: hidden; }
.pmwb-review-content { min-width: 0; min-height: 0; display: grid; grid-template-columns: minmax(0, 1.46fr) minmax(360px, 1fr); overflow: hidden; }
.pmwb-review-dock { min-width: 0; min-height: 0; display: flex; flex-direction: column; padding: 30px 32px; }
.pmwb-review-nav-header { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 26px; }
.pmwb-review-nav-header h2 { font-size: 32px; line-height: 1.35; font-weight: 630; letter-spacing: -.02em; }
.pmwb-review-nav-header p { margin-top: 9px; color: var(--pmwb-muted); font-size: 16px; }
.pmwb-review-nav-header > span { align-self: flex-end; padding-bottom: 2px; flex: 0 0 auto; color: var(--pmwb-subtle); font-size: 14px; }
.pmwb-review-columns { flex: 0 0 auto; display: grid; grid-template-columns: minmax(0, 1fr) 112px 152px; gap: 16px; padding: 18px 28px;
  border: 1px solid var(--pmwb-line); border-radius: 11px 11px 0 0; color: var(--pmwb-muted); font-size: 14px; }
.pmwb-requirement-strip { display: flex; flex-direction: column; flex: 1; min-height: 0; overflow-y: auto; border: 1px solid var(--pmwb-line); border-top: 0; border-radius: 0 0 11px 11px; }
.pmwb .pmwb-requirement-strip button {
  position: relative; flex: 1 0 auto; width: 100%; min-width: 0; min-height: 104px; display: grid;
  grid-template-columns: 34px minmax(0, 1fr) 112px 152px; align-items: center; gap: 16px;
  padding: 22px 28px; text-align: left; border: 0; border-bottom: 1px solid var(--pmwb-line-soft); border-radius: 0; background: transparent;
}
.pmwb .pmwb-requirement-strip button:last-child { border-bottom: 0; }
.pmwb .pmwb-requirement-strip button.is-selected { background: rgba(255, 255, 255, .06); }
.pmwb .pmwb-requirement-strip button.is-selected::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 2px; background: #eeeeee; }
.pmwb-requirement-number { align-self: start; padding-top: 2px; color: var(--pmwb-subtle); font-size: 14px; font-variant-numeric: tabular-nums; }
.pmwb-requirement-summary { min-width: 0; display: grid; gap: 8px; }
.pmwb-requirement-summary strong { color: var(--pmwb-text); font-size: 19px; font-weight: 580; line-height: 1.5; overflow-wrap: anywhere; }
.pmwb-requirement-summary small { display: block; overflow: hidden; color: var(--pmwb-subtle); font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.pmwb-requirement-ai, .pmwb-requirement-decision { color: var(--pmwb-muted); font-size: 16px; white-space: nowrap; }
.pmwb-focus-panel { min-width: 0; min-height: 0; overflow: auto; margin-top: 30px; padding: 0 32px 24px; border-left: 1px solid var(--pmwb-line-soft); }
.pmwb-focus-panel, .pmwb-review-content, .pmwb-requirement-strip, .pmwb-surface, .pmwb [data-dsh-pm-workbench=prd-markdown] { scrollbar-width: thin; scrollbar-color: rgba(203,203,203,.25) transparent; }
.pmwb-focus-panel h3, .pmwb-decision-palette h2 { font-size: 20px; font-weight: 600; }
.pmwb-evidence-section > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px; }
.pmwb-evidence-section > header > div { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
.pmwb-evidence-section > header span { color: var(--pmwb-subtle); font-size: 11px; }
.pmwb .pmwb-text-action { padding: 4px 0; border: 0; color: var(--pmwb-muted); background: transparent; font-size: 12px; white-space: nowrap; }
.pmwb-evidence-list { display: grid; gap: 12px; }
.pmwb-evidence { padding-left: 16px; border-left: 2px solid rgba(255,255,255,.3); color: var(--pmwb-text); }
.pmwb-evidence-role { margin-bottom: 8px !important; color: var(--pmwb-subtle); font-size: 11px; }
.pmwb-evidence-quote { font-size: 21px; line-height: 1.65; overflow-wrap: anywhere; }
.pmwb-evidence [data-dsh-pm-workbench=evidence-context] { margin-top: 10px; color: var(--pmwb-subtle); font-size: 12px; }
.pmwb .pmwb-evidence-open { margin-top: 10px; padding: 4px 8px; font-size: 11px; color: var(--pmwb-muted); }
.pmwb-more-evidence, .pmwb-source-details { color: var(--pmwb-muted); font-size: 12px; }
.pmwb-more-evidence > .pmwb-evidence { margin-top: 16px; }
.pmwb-source-details { margin-top: 14px; }
.pmwb-source-text { max-height: 260px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; padding: 14px; border: 1px solid var(--pmwb-line-soft); border-radius: 8px; font-family: inherit; font-size: 13px; line-height: 1.8; }
.pmwb-ai-recommendation { display: grid; gap: 10px; margin-top: 22px; padding: 20px 0; border-top: 1px solid var(--pmwb-line-soft); border-bottom: 1px solid var(--pmwb-line-soft); }
.pmwb-ai-recommendation strong { color: var(--pmwb-text); font-size: 18px; font-weight: 600; }
.pmwb-ai-recommendation span { color: var(--pmwb-muted); font-size: 15px; line-height: 1.8; overflow-wrap: anywhere; }
.pmwb-decision-palette { padding-top: 22px; }
.pmwb-decision-palette h2 { margin-bottom: 18px; }
.pmwb-priority-row, .pmwb-scope-row { display: grid; grid-template-columns: 66px minmax(0,1fr); align-items: center; gap: 12px; margin-top: 14px; }
.pmwb-priority-row h3, .pmwb-scope-row h3 { color: var(--pmwb-muted); font-size: 13px; font-weight: 400; }
.pmwb-priority-options, .pmwb-decision-options { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 8px; }
.pmwb .pmwb-priority-options button, .pmwb .pmwb-decision-options button { min-width: 0; min-height: 46px; padding: 8px 4px; border-radius: 7px; }
.pmwb-priority-options button strong, .pmwb-decision-options button strong { font-size: 14px; font-weight: 550; white-space: nowrap; }
.pmwb-priority-options button span, .pmwb-decision-options button span { display: none; }
.pmwb .pmwb-priority-options button.is-selected, .pmwb .pmwb-decision-options button.is-selected { color: #171717; background: #eeeeee; border-color: #eeeeee; }
.pmwb-reason { display: grid; grid-template-columns: 66px minmax(0,1fr); align-items: start; gap: 12px; margin-top: 18px; color: var(--pmwb-muted); font-size: 13px; }
.pmwb-reason > span { padding-top: 10px; }
.pmwb-reason textarea { width: 100%; min-height: 74px; max-height: 200px; padding: 10px 12px; resize: vertical; border: 1px solid var(--pmwb-line); border-radius: 8px; color: var(--pmwb-text); background: rgba(0,0,0,.1); }
.pmwb-requirement-details { margin-top: 24px; padding-top: 18px; border-top: 1px solid var(--pmwb-line-soft); color: var(--pmwb-muted); font-size: 13px; }
.pmwb-requirement-details > summary { margin-bottom: 16px; color: var(--pmwb-muted); }
.pmwb-model-route { margin-bottom: 14px !important; color: var(--pmwb-subtle); font-size: 11px; }
.pmwb-focus-header { display: flex; align-items: flex-start; gap: 16px; margin-bottom: 14px; }
.pmwb-focus-header > div { flex: 1; min-width: 0; }
.pmwb-rank-control { display: grid; gap: 6px; flex: 0 0 auto; }
.pmwb-rank-control select { padding: 9px; border: 1px solid var(--pmwb-line); border-radius: 7px; background: #252525; }
.pmwb-requirement-details textarea { display: block; width: 100%; min-height: 72px; margin-top: 6px; padding: 10px 12px; resize: vertical; border: 1px solid var(--pmwb-line); border-radius: 8px; color: var(--pmwb-text); background: rgba(0,0,0,.1); font-size: 13px; }
.pmwb-insight-grid { margin-top: 14px; }
.pmwb-unknowns { display: grid; gap: 8px; margin-top: 18px; }
.pmwb-unknowns h3 { font-size: 13px; }
.pmwb-unknowns p, .pmwb-muted-copy { color: var(--pmwb-muted); }
.pmwb-review-actions { display: flex; align-items: center; justify-content: space-between; gap: 24px; padding: 20px 32px; border-top: 1px solid var(--pmwb-line); background: rgba(0,0,0,.07); }
.pmwb-review-summary { min-width: 0; padding-left: 18px; border-left: 2px solid rgba(255,255,255,.3); }
.pmwb-review-summary p { display: flex; flex-wrap: wrap; gap: 6px 18px; color: var(--pmwb-muted); font-size: 16px; }
.pmwb-review-summary strong { color: var(--pmwb-text); font-weight: 550; }
.pmwb-review-summary small { display: block; margin-top: 5px; color: var(--pmwb-subtle); font-size: 12px; }

.pmwb .pmwb-primary { width: auto; max-width: 100%; min-width: 0; min-height: 46px; padding: 10px 18px; border-color: rgba(238, 238, 238, .84); color: #161616; background: #eeeeee; font-weight: 650; white-space: normal; }
.pmwb-review-actions .pmwb-primary { flex: 0 0 auto; min-width: 270px; min-height: 52px; }
.pmwb .pmwb-primary:hover:not(:disabled) { border-color: #eeeeee; background: #dedede; }
.pmwb-review-empty { width: 100%; padding: 36px; border: 1px solid var(--pmwb-line); border-radius: 18px; background: var(--pmwb-glass-strong); backdrop-filter: blur(22px); }
.pmwb-review-empty h2 { margin-bottom: 8px; }
.pmwb-review-empty p { color: var(--pmwb-muted); }
.pmwb-empty-state { min-height: 320px; display: grid; place-content: center; justify-items: center; text-align: center; }
.pmwb-empty-mark { width: 52px; height: 52px; margin-bottom: 16px; }
.pmwb-empty-state h2 { margin-bottom: 8px; font-size: 24px; }
.pmwb-empty-state p { max-width: 390px; margin-bottom: 20px; color: var(--pmwb-muted); }
.pmwb-material-surface > p, .pmwb-material-surface > label, .pmwb-prd-surface > p { color: var(--pmwb-muted); }
.pmwb-material-surface > label { display: block; margin-top: 14px; }
.pmwb-material-surface input[type=file] { width: 100%; margin-top: 7px; padding: 10px; border: 1px dashed rgba(255,255,255,.2); border-radius: 10px; background: rgba(255,255,255,.035); }
.pmwb-material-surface textarea { display: block; width: 100%; min-height: 130px; margin-top: 7px; padding: 12px; resize: vertical; border: 1px solid var(--pmwb-line-soft); border-radius: 10px; color: var(--pmwb-text); background: rgba(0,0,0,.16); }
.pmwb-material-surface > button { margin: 12px 8px 0 0; }
.pmwb-notice { display: inline-block; margin-top: 14px !important; padding: 6px 9px; border-radius: 7px; color: var(--pmwb-muted); background: rgba(255,255,255,.04); font-size: 11px; }
.pmwb [data-dsh-pm-workbench=source-text] { max-height: 180px; overflow: auto; margin-top: 10px; padding: 12px; border: 1px solid var(--pmwb-line-soft); border-radius: 9px; color: var(--pmwb-muted); background: rgba(0,0,0,.18); white-space: pre-wrap; }
.pmwb-prd-surface { width: 100%; }
.pmwb-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin: 16px 0; }
.pmwb .pmwb-actions > span { min-width: 0; color: var(--pmwb-muted); font-size: 12px; }
.pmwb [data-dsh-pm-workbench=prd-history-item][aria-pressed=true] { border-color: rgba(255,255,255,.6); background: rgba(255,255,255,.12); }
.pmwb [data-dsh-pm-workbench=prd-preview] { margin-top: 18px; }
.pmwb [data-dsh-pm-workbench=prd-markdown] { max-height: 520px; overflow: auto; padding: 20px; border: 1px solid var(--pmwb-line-soft); border-radius: 10px; color: var(--pmwb-muted); background: rgba(0,0,0,.18); white-space: pre-wrap; overflow-wrap: anywhere; }
.pmwb [data-dsh-pm-workbench=baseline-trace] { color: var(--pmwb-subtle); font-size: 11px; }
.pmwb [role=alert] { color: #cccccc; }
dialog[data-dsh-pm-workbench=create-dialog] {
  --pmwb-line: rgba(255, 255, 255, .16);
  --pmwb-line-soft: rgba(255, 255, 255, .095);
  --pmwb-text: #f5f5f5;
  --pmwb-muted: rgba(242, 242, 242, .74);
  --pmwb-accent-strong: #eeeeee;
  width: min(520px, calc(100vw - 32px));
  padding: 28px 30px 26px !important;
  color: var(--pmwb-text) !important;
  border: 1px solid var(--pmwb-line) !important;
  border-radius: 20px !important;
  background: rgba(18, 18, 18, .94) !important;
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .045), 0 32px 90px rgba(0, 0, 0, .52) !important;
  backdrop-filter: blur(28px) saturate(108%);
  -webkit-backdrop-filter: blur(28px) saturate(108%);
}
dialog[data-dsh-pm-workbench=create-dialog][open] { display: block; }
dialog[data-dsh-pm-workbench=create-dialog] > h1 {
  margin: 0 0 24px;
  color: var(--pmwb-text);
  font-size: 26px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -.025em;
}
dialog[data-dsh-pm-workbench=create-dialog] > label:not(:has(input[type=checkbox])) {
  display: block;
  margin: 0 0 8px;
  color: var(--pmwb-muted);
  font-size: 13px;
  font-weight: 560;
}
dialog[data-dsh-pm-workbench=create-dialog] > input[data-dsh-pm-workbench=project-name],
dialog[data-dsh-pm-workbench=create-dialog] > textarea[data-dsh-pm-workbench=research-goal] {
  display: block;
  width: 100%;
  margin: 0 0 18px;
  padding: 12px 14px;
  color: var(--pmwb-text);
  border: 1px solid var(--pmwb-line);
  border-radius: 11px;
  background: rgba(255, 255, 255, .055);
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, .22);
  transition: border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}
dialog[data-dsh-pm-workbench=create-dialog] > input[data-dsh-pm-workbench=project-name] { min-height: 46px; }
dialog[data-dsh-pm-workbench=create-dialog] > textarea[data-dsh-pm-workbench=research-goal] { min-height: 104px; resize: vertical; line-height: 1.6; }
dialog[data-dsh-pm-workbench=create-dialog] > input[data-dsh-pm-workbench=project-name]:hover:not(:disabled),
dialog[data-dsh-pm-workbench=create-dialog] > textarea[data-dsh-pm-workbench=research-goal]:hover:not(:disabled) { background: rgba(255, 255, 255, .072); }
dialog[data-dsh-pm-workbench=create-dialog] > input[data-dsh-pm-workbench=project-name]:focus,
dialog[data-dsh-pm-workbench=create-dialog] > textarea[data-dsh-pm-workbench=research-goal]:focus {
  outline: none;
  border-color: rgba(220, 220, 220, .74);
  background: rgba(255, 255, 255, .082);
  box-shadow: 0 0 0 3px rgba(200, 200, 200, .13), inset 0 1px 2px rgba(0, 0, 0, .2);
}
dialog[data-dsh-pm-workbench=create-dialog] > label:has(input[type=checkbox]) {
  display: grid;
  grid-template-columns: 18px minmax(0, 1fr);
  align-items: start;
  gap: 11px;
  margin-top: 2px;
  padding: 13px 14px;
  color: var(--pmwb-muted);
  border: 1px solid var(--pmwb-line-soft);
  border-radius: 11px;
  background: rgba(255, 255, 255, .035);
  font-size: 13px;
  line-height: 1.55;
  cursor: pointer;
}
dialog[data-dsh-pm-workbench=create-dialog] input[type=checkbox] {
  width: 18px;
  height: 18px;
  margin: 1px 0 0;
  accent-color: var(--pmwb-accent-strong);
}
dialog[data-dsh-pm-workbench=create-dialog] > p { margin-top: 14px; color: var(--pmwb-muted); }
dialog[data-dsh-pm-workbench=create-dialog] > .pmwb-actions {
  display: flex;
  flex-wrap: nowrap;
  justify-content: flex-end;
  gap: 10px;
  margin: 24px 0 0;
}
dialog[data-dsh-pm-workbench=create-dialog] > .pmwb-actions button {
  min-width: 112px;
  min-height: 42px;
  margin: 0;
  padding: 0 17px;
  color: var(--pmwb-text);
  border: 1px solid var(--pmwb-line);
  border-radius: 10px;
  background: rgba(255, 255, 255, .055);
  font: 600 13px/1 ui-sans-serif, -apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Microsoft YaHei", sans-serif;
}
dialog[data-dsh-pm-workbench=create-dialog] > .pmwb-actions [data-dsh-pm-workbench=confirm-create] {
  color: #171717;
  border-color: rgba(238, 238, 238, .86);
  background: var(--pmwb-accent-strong);
  font-weight: 650;
}
dialog[data-dsh-pm-workbench=create-dialog] > .pmwb-actions [data-dsh-pm-workbench=confirm-create]:hover:not(:disabled) {
  border-color: #eeeeee;
  background: #dedede;
}
dialog[data-dsh-pm-workbench=create-dialog] > .pmwb-actions [data-dsh-pm-workbench=confirm-create]:disabled {
  color: rgba(244, 244, 244, .42);
  border-color: var(--pmwb-line-soft);
  background: rgba(255, 255, 255, .045);
}
dialog[data-dsh-pm-workbench=create-dialog]::backdrop { background: rgba(3, 3, 3, .46); backdrop-filter: blur(7px); }
@media (max-width: 560px) {
  dialog[data-dsh-pm-workbench=create-dialog] { padding: 24px 20px 22px !important; border-radius: 16px !important; }
  dialog[data-dsh-pm-workbench=create-dialog] > h1 { margin-bottom: 20px; font-size: 23px; }
  dialog[data-dsh-pm-workbench=create-dialog] > .pmwb-actions { flex-direction: column-reverse; }
  dialog[data-dsh-pm-workbench=create-dialog] > .pmwb-actions button { width: 100%; }
}
@supports not ((backdrop-filter: blur(2px)) or (-webkit-backdrop-filter: blur(2px))) {
  .pmwb-shell { background: rgba(22,22,22,.97); }
}
@media (max-width: 1380px) {
  .pmwb-shell-header { grid-template-columns: auto minmax(120px,180px) minmax(0,1fr) auto; gap: 10px; padding-inline: 22px; }
  .pmwb-brand { padding-right: 16px; }
  .pmwb-brand strong { font-size: 15px; }
  .pmwb .pmwb-stepper button { font-size: 12px; gap: 6px; }
  .pmwb-header-actions { gap: 4px; }
  .pmwb-review-dock { padding: 26px 24px; }
  .pmwb-focus-panel { margin-top: 26px; padding-inline: 24px; }
  .pmwb-review-columns { grid-template-columns: minmax(0,1fr) 62px 112px; gap: 12px; padding-inline: 18px; }
  .pmwb .pmwb-requirement-strip button { grid-template-columns: 22px minmax(0,1fr) 62px 112px; gap: 12px; padding: 20px 18px; }
}
@media (max-width: 1200px) {
  .pmwb-shell { margin: 20px; width: calc(100% - 40px); height: calc(100dvh - 40px); grid-template-rows: 116px minmax(0,1fr); }
  .pmwb-shell-header { grid-template-columns: auto minmax(0,1fr) auto; grid-template-rows: 56px 60px; gap: 0 18px; }
  .pmwb-brand { grid-column: 1; grid-row: 1; }
  .pmwb-project-switcher { grid-column: 2; grid-row: 1; max-width: 300px; }
  .pmwb-header-actions { grid-column: 3; grid-row: 1; }
  .pmwb-stepper { grid-column: 1 / -1; grid-row: 2; max-width: none; }
  .pmwb .pmwb-stepper button { font-size: 13px; }
  .pmwb-review-content { grid-template-columns: minmax(0,1.1fr) minmax(350px,1fr); }
  .pmwb-review-columns { grid-template-columns: minmax(0,1fr) 54px 102px; gap: 8px; padding-inline: 14px; }
  .pmwb .pmwb-requirement-strip button { grid-template-columns: 20px minmax(0,1fr) 54px 102px; gap: 8px; padding: 18px 14px; }
  .pmwb-requirement-summary strong { font-size: 14px; }
  .pmwb-requirement-ai, .pmwb-requirement-decision { font-size: 12px; }
}
@media (max-width: 920px) {
  .pmwb-review-content { display: block; overflow-y: auto; }
  .pmwb-review-dock { overflow: visible; }
  .pmwb-requirement-strip { flex: none; max-height: 360px; }
  .pmwb-focus-panel { overflow: visible; margin: 0 24px; padding: 24px 0; border-left: 0; border-top: 1px solid var(--pmwb-line); }
  .pmwb-review-nav-header h2 { font-size: 25px; }
  .pmwb-review-columns { grid-template-columns: minmax(0,1fr) 72px 118px; }
  .pmwb .pmwb-requirement-strip button { grid-template-columns: 24px minmax(0,1fr) 72px 118px; }
  .pmwb-review-actions { padding: 18px 24px; }
}
@media (max-width: 640px) {
  .pmwb-shell { margin: 8px; width: calc(100% - 16px); height: calc(100dvh - 16px); grid-template-rows: 122px minmax(0,1fr); border-radius: 14px; }
  .pmwb-shell-header { grid-template-rows: 52px 70px; gap: 0 8px; padding-inline: 12px; }
  .pmwb-brand { border: 0; padding: 0; }
  .pmwb-brand strong { font-size: 13px; }
  .pmwb-project-switcher > summary { padding: 5px; }
  .pmwb-project-switcher > summary span { font-size: 11px; }
  .pmwb-project-switcher > summary small { display: none; }
  .pmwb-project-menu { left: auto; right: -38px; }
  .pmwb-save-state { display: none; }
  .pmwb-header-actions { gap: 0; }
  .pmwb .pmwb-stepper button { flex-direction: column; min-height: 60px; gap: 5px; padding: 5px 0; font-size: 10px; }
  .pmwb-review-dock { padding: 22px 16px; }
  .pmwb-review-nav-header { gap: 8px; margin-bottom: 20px; }
  .pmwb-review-nav-header h2 { font-size: 22px; }
  .pmwb-review-nav-header p { font-size: 12px; }
  .pmwb-review-nav-header > span { font-size: 11px; }
  .pmwb-review-columns { grid-template-columns: minmax(0,1fr) 50px 88px; gap: 6px; padding: 12px 10px; font-size: 11px; }
  .pmwb .pmwb-requirement-strip button { grid-template-columns: minmax(0,1fr) 50px 88px; min-height: 88px; gap: 6px; padding: 16px 10px; }
  .pmwb-requirement-number { display: none; }
  .pmwb-requirement-summary strong { font-size: 13px; }
  .pmwb-requirement-summary small, .pmwb-requirement-ai, .pmwb-requirement-decision { font-size: 11px; }
  .pmwb-focus-panel { margin-inline: 16px; }
  .pmwb-evidence-quote { font-size: 16px; }
  .pmwb-priority-row, .pmwb-scope-row, .pmwb-reason { grid-template-columns: 56px minmax(0,1fr); gap: 8px; }
  .pmwb-review-actions { display: grid; grid-template-columns: minmax(0,1fr); gap: 12px; padding: 14px 16px; }
  .pmwb-review-summary { padding-left: 12px; }
  .pmwb-review-summary p { gap: 4px 12px; font-size: 12px; }
  .pmwb-review-summary small { font-size: 11px; }
  .pmwb-review-actions .pmwb-primary { width: 100%; min-height: 42px; }
  .pmwb-surface { padding: 22px 18px; }
  .pmwb-surface > header { flex-direction: column; align-items: stretch; gap: 10px; }
  .pmwb-surface > header p { max-width: none; text-align: left; font-size: 13px; }
  .pmwb-actions > .pmwb-primary { width: 100%; }
}
@media (prefers-reduced-motion: reduce) {
  .pmwb *, .pmwb *::before, .pmwb *::after { scroll-behavior: auto !important; transition-duration: .01ms !important; animation-duration: .01ms !important; }
}
`

export const launcherCss = `
.dsh-pm-launcher {
  box-sizing: border-box;
  width: 100%;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
  padding: 0 13px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  color: #eeeeee;
  background: rgba(20, 20, 20, 0.78);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 5px 16px rgba(0, 0, 0, 0.16);
  font: 500 13px/1 var(--dsw-font-family, inherit);
  letter-spacing: 0.01em;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: transform 160ms ease, color 160ms ease, border-color 160ms ease, background 160ms ease, box-shadow 160ms ease;
}
.dsh-pm-launcher:hover {
  color: #fff;
  border-color: rgba(255, 255, 255, 0.42);
  background: rgba(32, 32, 32, 0.88);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.09), 0 7px 20px rgba(0, 0, 0, 0.2), 0 0 18px rgba(255, 255, 255, 0.06);
  transform: translateY(-1px);
}
.dsh-pm-launcher:active { transform: translateY(0) scale(0.97); }
.dsh-pm-launcher:focus-visible { outline: 2px solid #d6d6d6; outline-offset: 2px; }
.dsh-pm-launcher-icon { width: 22px; height: 22px; flex: 0 0 auto; overflow: visible; }
.dsh-pm-launcher-prism-blade { fill: currentColor; }
.dsh-pm-launcher-prism-blade--top { opacity: 0.96; }
.dsh-pm-launcher-prism-blade--right { fill: #bdbdbd; opacity: 0.9; }
.dsh-pm-launcher-prism-blade--left { fill: #d6d6d6; opacity: 0.76; }
.dsh-pm-launcher-prism-core { fill: #fff; filter: drop-shadow(0 0 3px rgba(255, 255, 255, 0.52)); }
.dsh-pm-launcher-label { white-space: nowrap; }
[data-sidebar-collapsed] .dsh-pm-launcher {
  width: 38px;
  min-width: 38px;
  height: 38px;
  min-height: 38px;
  padding: 0;
  border-radius: 50%;
}
[data-sidebar-collapsed] .dsh-pm-launcher-label {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
@media (prefers-reduced-motion: reduce) {
  .dsh-pm-launcher { transition: none; }
  .dsh-pm-launcher:hover, .dsh-pm-launcher:active { transform: none; }
}
`
