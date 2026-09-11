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
.pmwb::backdrop { background: rgba(3, 3, 3, .08); }
.pmwb::before {
  content: ''; position: fixed; inset: 0 auto 0 0; z-index: 0; width: 232px; pointer-events: none;
  background: rgba(0, 0, 0, .08); backdrop-filter: grayscale(1) brightness(.86); -webkit-backdrop-filter: grayscale(1) brightness(.86);
}
.pmwb * { box-sizing: border-box; }
.pmwb h1, .pmwb h2, .pmwb h3, .pmwb p, .pmwb blockquote { margin: 0; }
.pmwb-dialog-heading, .pmwb-visually-hidden {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
}
.pmwb-shell {
  position: relative; z-index: 1;
  height: 100%; min-height: 100%; display: grid; grid-template-rows: 58px minmax(0, 1fr); gap: 22px;
  padding: 28px 26px 28px 232px;
}
.pmwb-shell-header {
  position: relative; z-index: 20; width: 100%; height: 58px; margin: 0;
  display: grid; grid-template-columns: 1fr auto; align-items: center; padding: 0;
  border: 0; background: transparent; box-shadow: none;
}
.pmwb-brand { display: none; }
.pmwb-brand-mark { width: 28px; height: 28px; flex: 0 0 auto; color: var(--pmwb-text); }
.pmwb .dsh-pm-launcher-prism-blade { fill: currentColor; }
.pmwb .dsh-pm-launcher-prism-blade--top { opacity: .96; }
.pmwb .dsh-pm-launcher-prism-blade--right { fill: var(--pmwb-accent); opacity: .9; }
.pmwb .dsh-pm-launcher-prism-blade--left { fill: #d9d9d9; opacity: .7; }
.pmwb .dsh-pm-launcher-prism-core { fill: #fff; }
.pmwb-brand strong { white-space: nowrap; font-size: 17px; font-weight: 630; letter-spacing: .01em; }
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
.pmwb-project-switcher { display: block;
  position: absolute; top: 80px; left: 0; z-index: 32; width: 240px; min-width: 0;
  padding: 10px 10px 0;
}
.pmwb-project-switcher > summary {
  min-width: 0; min-height: 46px; display: flex; align-items: center; gap: 8px; padding: 7px 10px;
  border: 1px solid var(--pmwb-line-soft); border-radius: 10px; list-style: none; color: var(--pmwb-text); background: rgba(255, 255, 255, .035);
}
.pmwb-project-switcher > summary::-webkit-details-marker { display: none; }
.pmwb-project-switcher > summary { padding-right: 14px; }
.pmwb-project-switcher > summary:hover { background: var(--pmwb-glass-soft); }
.pmwb-project-switcher > summary span { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 560; }
.pmwb-project-switcher > summary small { display: none; color: var(--pmwb-subtle); font-size: 11px; white-space: nowrap; }
.pmwb-project-menu {
  position: absolute; top: calc(100% + 14px); left: -8px; z-index: 40; width: 310px; max-height: 440px; overflow: auto;
  padding: 14px; border: 1px solid var(--pmwb-line); border-radius: 14px; background: rgba(16, 16, 16, .94);
  box-shadow: 0 26px 70px rgba(0, 0, 0, .48); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
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
  grid-column: 1 / -1; justify-self: center; width: min(490px, calc(100% - 120px)); min-width: 0;
  display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 5px; padding: 7px 10px;
  border: 1px solid var(--pmwb-line); border-radius: 19px; background: rgba(16, 16, 16, .74);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .035), 0 18px 48px rgba(0, 0, 0, .22);
  backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px);
}
.pmwb .pmwb-stepper button {
  position: relative; display: flex; align-items: center; justify-content: center; gap: 7px;
  padding: 7px 6px; border: 0; color: var(--pmwb-subtle); background: transparent; white-space: nowrap;
}
.pmwb .pmwb-stepper button::after { content: ''; position: absolute; left: 18%; right: 18%; bottom: 1px; height: 1px; background: transparent; }
.pmwb .pmwb-stepper button > span {
  display: grid; place-items: center; width: 20px; height: 20px; border: 1px solid rgba(255,255,255,.16);
  border-radius: 50%; font: 600 10px/1 ui-monospace, monospace;
}
.pmwb .pmwb-stepper button.is-complete { color: var(--pmwb-muted); }
.pmwb .pmwb-stepper button.is-complete > span { color: #161616; border-color: #dddddd; background: #dddddd; }
.pmwb .pmwb-stepper button[aria-current=step] { color: var(--pmwb-text); }
.pmwb .pmwb-stepper button[aria-current=step]::after { background: rgba(255, 255, 255, .78); }
.pmwb .pmwb-stepper button[aria-current=step] > span { color: #161616; border-color: var(--pmwb-accent-strong); background: var(--pmwb-accent-strong); }
.pmwb-header-actions { position: absolute; top: 50%; right: 0; display: flex; align-items: center; justify-content: flex-end; gap: 3px; transform: translateY(-50%); }
.pmwb-save-state { display: inline-flex; align-items: center; gap: 6px; margin-right: 3px; color: var(--pmwb-subtle); font-size: 11px; white-space: nowrap; }
.pmwb-save-state::before { content: ''; width: 5px; height: 5px; border-radius: 50%; background: #8b8b8b; }
.pmwb-save-state--saved::before { background: var(--pmwb-success); }
.pmwb-save-state--saving::before { background: #c7c7c7; }
.pmwb-save-state--failed::before, .pmwb-save-state--uncertain::before { background: #999999; }
.pmwb .pmwb-header-actions button { padding: 6px 7px; border-color: transparent; color: var(--pmwb-muted); background: transparent; font-size: 11px; }
.pmwb .pmwb-header-actions button:hover:not(:disabled) { color: var(--pmwb-text); background: var(--pmwb-glass-soft); }
.pmwb .pmwb-danger-action:hover:not(:disabled) { color: #f0f0f0; }
.pmwb .pmwb-header-actions .pmwb-save-state,
.pmwb .pmwb-header-actions .pmwb-quiet-action,
.pmwb .pmwb-header-actions .pmwb-danger-action { display: none; }
.pmwb-spatial-stage { position: relative; min-width: 0; min-height: 0; display: grid; place-items: start center; padding: 0; }
.pmwb-toast {
  position: absolute; top: -22px; left: 50%; z-index: 30; transform: translateX(-50%); padding: 7px 12px;
  border: 1px solid rgba(200, 200, 200, .24); border-radius: 9px; color: #d0d0d0; background: rgba(24, 24, 24, .84);
  backdrop-filter: blur(18px); -webkit-backdrop-filter: blur(18px); font-size: 12px;
}
.pmwb-surface {
  width: min(920px, calc(100vw - 250px)); max-height: min(740px, calc(100dvh - 210px)); overflow: auto;
  padding: 30px; border: 1px solid var(--pmwb-line); border-radius: 18px; background: var(--pmwb-glass-strong);
  box-shadow: 0 32px 90px rgba(0, 0, 0, .34); backdrop-filter: blur(24px) saturate(108%); -webkit-backdrop-filter: blur(24px) saturate(108%);
}
.pmwb-surface > header { display: flex; align-items: flex-end; justify-content: space-between; gap: 28px; padding-bottom: 20px; margin-bottom: 22px; border-bottom: 1px solid var(--pmwb-line-soft); }
.pmwb-surface > header span { color: var(--pmwb-subtle); font-size: 11px; letter-spacing: .08em; }
.pmwb-surface > header h2 { margin-top: 3px; font-size: 26px; font-weight: 650; letter-spacing: -.025em; }
.pmwb-surface > header p { max-width: 46ch; color: var(--pmwb-muted); text-align: right; }
.pmwb-review {
  width: 100%; height: calc(100dvh - 136px); min-height: 0;
  display: grid; grid-template-columns: 240px minmax(0, 1fr) 320px; grid-template-rows: minmax(0, 1fr); gap: 1px;
}
.pmwb-focus-panel, .pmwb-decision-palette, .pmwb-review-dock {
  min-width: 0; border: 1px solid var(--pmwb-line); background: var(--pmwb-glass);
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, .035), 0 30px 86px rgba(0, 0, 0, .28);
  backdrop-filter: blur(26px) saturate(106%); -webkit-backdrop-filter: blur(26px) saturate(106%);
}
.pmwb-focus-panel { grid-column: 2; grid-row: 1; min-height: 0; overflow: auto; padding: 32px 30px 36px; border-radius: 0; }
.pmwb-model-route { margin-bottom: 14px !important; color: var(--pmwb-subtle); font-size: 11px; letter-spacing: .02em; }
.pmwb-decision-palette {
  grid-column: 3; grid-row: 1; min-height: 0; overflow: auto; display: flex; flex-direction: column;
  padding: 30px 24px 24px; border-left: 0; border-radius: 0 19px 19px 0; background: rgba(18, 18, 18, .72);
}
.pmwb-focus-panel, .pmwb-decision-palette, .pmwb-surface, .pmwb [data-dsh-pm-workbench=prd-markdown] {
  scrollbar-width: thin;
  scrollbar-color: rgba(203, 203, 203, .22) transparent;
}
.pmwb-focus-panel::-webkit-scrollbar, .pmwb-decision-palette::-webkit-scrollbar,
.pmwb-surface::-webkit-scrollbar, .pmwb [data-dsh-pm-workbench=prd-markdown]::-webkit-scrollbar { width: 6px; }
.pmwb-focus-panel::-webkit-scrollbar-track, .pmwb-decision-palette::-webkit-scrollbar-track,
.pmwb-surface::-webkit-scrollbar-track, .pmwb [data-dsh-pm-workbench=prd-markdown]::-webkit-scrollbar-track { background: transparent; }
.pmwb-focus-panel::-webkit-scrollbar-thumb, .pmwb-decision-palette::-webkit-scrollbar-thumb,
.pmwb-surface::-webkit-scrollbar-thumb, .pmwb [data-dsh-pm-workbench=prd-markdown]::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: rgba(203, 203, 203, .22);
}
.pmwb-focus-header { display: flex; align-items: flex-start; justify-content: space-between; gap: 22px; margin-bottom: 6px; }
.pmwb-focus-header > div { min-width: 0; flex: 1; }
.pmwb-focus-header > div > span { display: block; margin-bottom: 8px; color: var(--pmwb-subtle); font-size: 12px; }
.pmwb-focus-header textarea {
  display: block; width: 100%; min-height: 48px; resize: none; overflow: hidden; padding: 0; border: 0; border-radius: 5px;
  color: var(--pmwb-text); background: transparent; font-size: clamp(27px, 2.25vw, 33px); font-weight: 650; line-height: 1.22; letter-spacing: -.025em;
}
.pmwb-focus-header textarea:hover:not(:disabled), .pmwb-focus-header textarea:focus { background: rgba(255, 255, 255, .035); }
.pmwb-rank-control { flex: 0 0 auto; display: flex; align-items: center; gap: 7px; color: var(--pmwb-subtle); font-size: 11px; }
.pmwb-rank-control select { padding: 5px 24px 5px 7px; border: 1px solid var(--pmwb-line-soft); border-radius: 7px; color: var(--pmwb-muted); background: rgba(0,0,0,.18); }
.pmwb-focus-description {
  display: block; width: 100%; min-height: 58px; margin: 0 0 18px; padding: 4px 0; resize: none; border: 0; border-radius: 5px;
  color: var(--pmwb-muted); background: transparent; font-size: 15px; line-height: 1.7;
}
.pmwb-focus-description:hover:not(:disabled), .pmwb-focus-description:focus { background: rgba(255, 255, 255, .035); }
.pmwb-insight-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 20px 0; border-top: 1px solid var(--pmwb-line-soft); border-bottom: 1px solid var(--pmwb-line-soft); }
.pmwb-insight-grid > section { min-width: 0; padding-right: 24px; }
.pmwb-insight-grid > section + section { padding: 0 0 0 24px; border-left: 1px solid var(--pmwb-line-soft); }
.pmwb-focus-panel h3, .pmwb-decision-palette h2 { font-size: 14px; font-weight: 650; letter-spacing: .015em; }
.pmwb-insight-grid h3 { margin-bottom: 9px; }
.pmwb-insight-grid textarea {
  display: block; width: 100%; min-height: 88px; padding: 0; resize: none; border: 0; border-radius: 5px;
  color: var(--pmwb-muted); background: transparent; line-height: 1.65;
}
.pmwb-insight-grid textarea:hover:not(:disabled), .pmwb-insight-grid textarea:focus { background: rgba(255, 255, 255, .035); }
.pmwb-insight-grid p { color: var(--pmwb-muted); line-height: 1.65; }
.pmwb-evidence-section { padding: 20px 0 16px; border-bottom: 1px solid var(--pmwb-line-soft); }
.pmwb-evidence-section > header { display: flex; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 10px; }
.pmwb-evidence-section > header > div { display: flex; align-items: center; gap: 9px; }
.pmwb-evidence-section > header span { color: var(--pmwb-subtle); font-size: 11px; }
.pmwb .pmwb-text-action { padding: 4px 0; border: 0; color: var(--pmwb-accent-strong); background: transparent; font-size: 11px; }
.pmwb-evidence-list { display: grid; gap: 8px; }
.pmwb-evidence {
  position: relative; padding: 12px 112px 12px 16px; border: 1px solid var(--pmwb-line-soft); border-radius: 10px;
  color: var(--pmwb-muted); background: rgba(255, 255, 255, .035);
}
.pmwb-evidence-role { margin-bottom: 3px !important; color: var(--pmwb-subtle); font-size: 10px; }
.pmwb-evidence-quote { line-height: 1.55; }
.pmwb-evidence [data-dsh-pm-workbench=evidence-context] { margin-top: 5px; color: var(--pmwb-subtle); font-size: 10px; }
.pmwb .pmwb-evidence-open { position: absolute; top: 50%; right: 12px; transform: translateY(-50%); padding: 6px 9px; color: var(--pmwb-muted); font-size: 10px; }
.pmwb .pmwb-evidence-open:active:not(:disabled) { transform: translateY(-50%) scale(.98); }
.pmwb-unknowns { display: grid; grid-template-columns: 100px 1fr; gap: 14px; padding-top: 15px; }
.pmwb-unknowns p, .pmwb-muted-copy { color: var(--pmwb-muted); }
.pmwb-decision-palette > section + section { padding-top: 26px; margin-top: 26px; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-decision-palette h2 { margin-bottom: 15px; }
.pmwb-priority-options { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.pmwb .pmwb-priority-options button { min-width: 0; min-height: 54px; display: grid; justify-items: center; place-content: center; gap: 2px; padding: 10px 3px; border-radius: 10px; }
.pmwb-priority-options button strong { font-size: 15px; }
.pmwb-priority-options button span { display: none; }
.pmwb .pmwb-priority-options button.is-selected, .pmwb .pmwb-decision-options button.is-selected {
  border-color: rgba(255, 255, 255, .84);
}
.pmwb .pmwb-priority-options button.is-selected { color: #151515; background: #eeeeee; }
.pmwb .pmwb-decision-options button.is-selected { color: var(--pmwb-text); background: rgba(255, 255, 255, .075); }
.pmwb-ai-recommendation { display: grid; gap: 6px; margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-ai-recommendation strong { color: var(--pmwb-text); font-size: 12px; font-weight: 620; }
.pmwb-ai-recommendation span { display: -webkit-box; overflow: hidden; color: var(--pmwb-subtle); font-size: 11px; line-height: 1.55; -webkit-box-orient: vertical; -webkit-line-clamp: 3; }
.pmwb-decision-options { display: grid; gap: 11px; }
.pmwb .pmwb-decision-options button { min-height: 59px; display: grid; place-content: center start; gap: 2px; padding: 10px 16px; text-align: left; border-radius: 10px; }
.pmwb-decision-options button strong { font-size: 14px; }
.pmwb-decision-options button span { color: var(--pmwb-subtle); font-size: 11px; }
.pmwb .pmwb-decision-options button.is-selected span { color: var(--pmwb-muted); }
.pmwb-reason { display: grid; gap: 7px; margin-top: 18px; color: var(--pmwb-subtle); font-size: 11px; }
.pmwb-reason textarea { width: 100%; min-height: 74px; padding: 10px 11px; resize: vertical; border: 1px solid var(--pmwb-line-soft); border-radius: 9px; color: var(--pmwb-text); background: rgba(0,0,0,.13); }
.pmwb-review-dock {
  position: static; z-index: 18; transform: none; grid-column: 1; grid-row: 1; width: auto; min-width: 0;
  padding: 0; overflow: hidden; border-radius: 19px 0 0 19px;
}
.pmwb-review-nav-header { display: grid; gap: 3px; padding: 76px 20px 16px; border-bottom: 1px solid var(--pmwb-line-soft); }
.pmwb-review-nav-header strong { display: none; overflow: hidden; color: var(--pmwb-text); font-size: 16px; font-weight: 650; text-overflow: ellipsis; white-space: nowrap; }
.pmwb-review-nav-header span { color: var(--pmwb-subtle); font-size: 11px; }
.pmwb-requirement-strip { display: grid; grid-auto-flow: row; grid-auto-rows: minmax(82px, auto); gap: 0; overflow-y: auto; scrollbar-width: thin; }
.pmwb .pmwb-requirement-strip button {
  position: relative; min-width: 0; min-height: 82px; display: grid; grid-template-columns: auto minmax(0,1fr); gap: 2px 10px;
  padding: 15px 18px; text-align: left; border: 0; border-bottom: 1px solid var(--pmwb-line-soft); border-radius: 0; background: transparent;
}
.pmwb .pmwb-requirement-strip button:first-child, .pmwb .pmwb-requirement-strip button:last-child { border-radius: 0; }
.pmwb .pmwb-requirement-strip button.is-selected { background: rgba(255, 255, 255, .075); }
.pmwb .pmwb-requirement-strip button.is-selected::before { content: ''; position: absolute; inset: 0 auto 0 0; width: 2px; background: #eeeeee; }
.pmwb-requirement-strip button > span { grid-row: 1 / 3; color: var(--pmwb-subtle); font: 600 12px/1.5 ui-monospace, monospace; }
.pmwb-requirement-strip button strong { overflow: hidden; color: var(--pmwb-text); font-size: 12px; font-weight: 560; text-overflow: ellipsis; white-space: nowrap; }
.pmwb-requirement-strip button small { color: var(--pmwb-subtle); font-size: 10px; white-space: nowrap; }
.pmwb-review-actions { display: grid; gap: 14px; margin-top: auto; padding-top: 22px; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-review-actions p { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--pmwb-subtle); font-size: 11px; }
.pmwb-review-actions p strong { color: var(--pmwb-text); font-weight: 580; }
.pmwb .pmwb-primary { width: 100%; min-width: 0; min-height: 46px; padding: 10px 18px; border-color: rgba(238, 238, 238, .84); color: #161616; background: #eeeeee; font-weight: 650; white-space: nowrap; }
.pmwb .pmwb-primary:hover:not(:disabled) { border-color: #eeeeee; background: #dedede; }
.pmwb-review-empty { width: min(640px, calc(100vw - 220px)); padding: 36px; border: 1px solid var(--pmwb-line); border-radius: 18px; background: var(--pmwb-glass-strong); backdrop-filter: blur(22px); }
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
.pmwb-prd-surface { width: min(1000px, calc(100vw - 230px)); }
.pmwb-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
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
  .pmwb-shell-header, .pmwb-focus-panel, .pmwb-decision-palette, .pmwb-review-dock, .pmwb-surface { background: rgba(15, 15, 15, .97); }
}
@media (max-width: 1200px) {
  .pmwb::before { width: 210px; }
  .pmwb-shell { padding: 24px 18px 24px 210px; gap: 18px; }
  .pmwb-shell-header { width: 100%; grid-template-columns: 1fr auto; }
  .pmwb-project-switcher { top: 72px; width: 210px; }
  .pmwb-save-state, .pmwb-header-actions .pmwb-danger-action { display: none; }
  .pmwb-review { width: 100%; height: calc(100dvh - 124px); grid-template-columns: 210px minmax(0, 1fr) 280px; grid-template-rows: minmax(0, 1fr); gap: 1px; }
  .pmwb-decision-palette { padding: 26px 22px; }
  .pmwb-review-nav-header { padding: 72px 16px 14px; }
  .pmwb .pmwb-requirement-strip button { padding: 13px 15px; }
  .pmwb-surface, .pmwb-prd-surface { width: min(920px, 100%); }
}
@media (max-height: 900px) and (min-width: 821px) {
  .pmwb-shell { grid-template-rows: 54px minmax(0, 1fr); gap: 16px; padding-top: 18px; padding-bottom: 18px; }
  .pmwb-shell-header { height: 58px; }
  .pmwb-project-switcher { top: 64px; }
  .pmwb-review { height: calc(100dvh - 106px); grid-template-rows: minmax(0, 1fr); gap: 1px; }
  .pmwb-focus-panel { padding-top: 26px; padding-bottom: 28px; }
  .pmwb-decision-palette { padding-top: 26px; padding-bottom: 24px; }
  .pmwb-decision-palette > section + section { padding-top: 19px; margin-top: 19px; }
  .pmwb .pmwb-priority-options button { min-height: 48px; }
  .pmwb-decision-options { gap: 8px; }
  .pmwb .pmwb-decision-options button { min-height: 50px; }
  .pmwb-reason { margin-top: 12px; }
  .pmwb-reason textarea { min-height: 50px; }
  .pmwb .pmwb-requirement-strip button { min-height: 60px; }
  .pmwb-review-actions { padding-top: 14px; }
  .pmwb .pmwb-primary { min-height: 42px; }
}
@media (max-width: 820px) {
  .pmwb::before { display: none; }
  .pmwb-shell { height: 100%; min-height: 100%; overflow-y: auto; padding: 14px 14px 28px; gap: 14px; }
  .pmwb-shell-header { height: auto; min-height: 58px; grid-template-columns: 1fr auto; gap: 8px; padding: 0; }
  .pmwb-project-switcher { position: static; grid-column: 1; grid-row: 1; width: auto; padding: 0 70px 0 0; }
  .pmwb-project-switcher > summary { min-height: 44px; }
  .pmwb-project-menu { left: 0; width: min(310px, calc(100vw - 28px)); }
  .pmwb-stepper { grid-column: 1 / -1; width: calc(100% - 76px); }
  .pmwb-spatial-stage { display: block; min-height: 0; }
  .pmwb-review { height: auto; min-height: 0; grid-template-columns: 1fr; grid-template-rows: auto auto auto; gap: 0; overflow: visible; }
  .pmwb-review-dock { grid-column: 1; grid-row: 1; border-radius: 16px 16px 0 0; }
  .pmwb-review-nav-header { padding: 18px; }
  .pmwb-review-nav-header strong { display: block; }
  .pmwb-requirement-strip { grid-auto-flow: column; grid-auto-columns: minmax(190px, 220px); overflow-x: auto; overflow-y: hidden; }
  .pmwb .pmwb-requirement-strip button { border-right: 1px solid var(--pmwb-line-soft); border-bottom: 0; }
  .pmwb-focus-panel { grid-column: 1; grid-row: 2; min-height: 560px; overflow: visible; padding: 24px 22px; border-radius: 0; }
  .pmwb-decision-palette { grid-column: 1; grid-row: 3; overflow: visible; padding: 24px 22px; border-left: 1px solid var(--pmwb-line); border-top: 0; border-radius: 0 0 16px 16px; }
  .pmwb-decision-palette > section { display: grid; grid-template-columns: 110px 1fr; gap: 10px; }
  .pmwb-decision-palette > section + section { margin-top: 12px; padding-top: 12px; }
  .pmwb-review-actions { margin-top: 20px; }
  .pmwb-review-actions p { justify-content: space-between; }
  .pmwb .pmwb-primary { width: 100%; min-width: 0; }
  .pmwb-insight-grid { grid-template-columns: 1fr; }
  .pmwb-insight-grid > section { padding: 0; }
  .pmwb-insight-grid > section + section { padding: 16px 0 0; margin-top: 16px; border-left: 0; border-top: 1px solid var(--pmwb-line-soft); }
  .pmwb-surface, .pmwb-prd-surface, .pmwb-review-empty { width: 100%; max-height: calc(100dvh - 145px); }
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
