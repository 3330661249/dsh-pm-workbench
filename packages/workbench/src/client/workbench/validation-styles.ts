export const validationCss = `
.pmwb .pmwb-validation { display: grid; grid-template-rows: minmax(0, 1fr) auto; width: 100%; height: 100%; min-height: 0; max-width: none; padding: 0; overflow: hidden; }
.pmwb-validation-workspace { display: grid; grid-template-columns: minmax(0, 1fr) minmax(280px, 330px); min-width: 0; min-height: 0; overflow: hidden; }
.pmwb-validation-main { min-width: 0; min-height: 0; overflow: hidden; }
.pmwb-validation-scroll { height: 100%; min-width: 0; overflow: auto; padding: 30px 36px; }
.pmwb-validation-scroll, .pmwb-validation-history-list { scrollbar-width: thin; scrollbar-color: rgba(203,203,203,.25) transparent; }
.pmwb-validation-heading { margin-bottom: 18px; }
.pmwb-validation-heading h2 { font-size: 28px; font-weight: 620; letter-spacing: -.025em; line-height: 1.4; }
.pmwb-validation-heading p { margin-top: 8px; color: var(--pmwb-muted); font-size: 14px; }
.pmwb-validation h3 { font-size: 18px; font-weight: 590; letter-spacing: -.02em; }
.pmwb-validation h4 { margin: 14px 0 7px; color: var(--pmwb-muted); font-size: 13px; font-weight: 550; }
.pmwb-validation-toolbar { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-bottom: 20px; }
.pmwb-validation-toolbar label { display: flex; flex-wrap: wrap; align-items: center; min-width: 0; gap: 12px; color: var(--pmwb-muted); font-size: 14px; }
.pmwb .pmwb-validation select { min-width: 0; max-width: 100%; padding: 8px 12px; border: 1px solid var(--pmwb-line); border-radius: 8px; background: #222222; font-size: 13px; }
.pmwb-validation-section-heading { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
.pmwb-validation-section-heading > span { color: var(--pmwb-subtle); font-size: 13px; }
.pmwb-validation-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
.pmwb .pmwb-validation-mode { display: grid; grid-template-columns: 24px minmax(0, 1fr); align-content: center; align-items: center; gap: 7px 9px; min-height: 76px; padding: 15px 16px; text-align: left; border-radius: 10px; background: transparent; }
.pmwb .pmwb-validation-mode[aria-pressed=true] { border-color: rgba(255,255,255,.55); background: rgba(255,255,255,.085); }
.pmwb-validation-mode svg { width: 22px; height: 22px; opacity: .8; }
.pmwb-validation-mode strong { font-size: 15px; font-weight: 590; }
.pmwb-validation-mode small { grid-column: 2; color: var(--pmwb-subtle); font-size: 12px; }
.pmwb-validation-method-description { margin-top: 10px !important; color: var(--pmwb-muted); font-size: 14px; }
.pmwb-validation-create { margin-top: 22px; padding-top: 18px; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-validation-create > p, .pmwb-validation-empty p, .pmwb-validation-judgment > p, .pmwb-poc-input > p { color: var(--pmwb-muted); font-size: 14px; }
.pmwb-validation-scope { display: grid; min-width: 0; gap: 0; margin: 16px 0 0; padding: 0; border: 1px solid var(--pmwb-line-soft); border-radius: 10px; overflow: hidden; }
.pmwb-validation-scope:empty { border: 0; }
.pmwb-validation-scope label { display: flex; align-items: flex-start; gap: 12px; min-height: 54px; padding: 15px 16px; border-bottom: 1px solid var(--pmwb-line-soft); font-size: 14px; overflow-wrap: anywhere; }
.pmwb-validation-scope label:last-child { border-bottom: 0; }
.pmwb-validation-scope label:has(input:checked) { background: rgba(255,255,255,.04); }
.pmwb-validation input[type=checkbox] { accent-color: #cccccc; width: 16px; height: 16px; flex-shrink: 0; margin-top: 3px; }
.pmwb-validation-footer { display: flex; justify-content: space-between; align-items: center; gap: 28px; min-width: 0; padding: 20px 36px; border-top: 1px solid var(--pmwb-line); background: rgba(20,20,20,.22); }
.pmwb-validation-footer > div:first-child { min-width: 0; padding-left: 16px; border-left: 2px solid rgba(255,255,255,.22); }
.pmwb-validation-footer strong { font-size: 15px; font-weight: 550; }
.pmwb-validation-footer p { max-width: 64ch; margin-top: 4px; color: var(--pmwb-subtle); font-size: 12px; line-height: 1.65; overflow-wrap: anywhere; }
.pmwb-validation-footer-actions { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
.pmwb .pmwb-validation-footer button { flex-shrink: 0; min-height: 46px; padding: 10px 22px; font-size: 14px; white-space: nowrap; }
.pmwb .pmwb-validation-footer .pmwb-primary { min-width: 176px; }
.pmwb-validation-notice { display: flex; align-items: center; gap: 10px; margin: 16px 0 !important; padding: 13px 15px; border: 1px solid var(--pmwb-line); border-radius: 9px; background: rgba(255,255,255,.04); font-size: 13px; overflow-wrap: anywhere; }
.pmwb-validation [role=alert] { border-left: 2px solid #dddddd; }
.pmwb-working-dot { flex-shrink: 0; width: 7px; height: 7px; border-radius: 50%; background: #eeeeee; animation: pmwb-working 1.5s ease-in-out infinite; }
@keyframes pmwb-working { 50% { opacity: .3; } }
.pmwb .pmwb-validation-muted { color: var(--pmwb-subtle); font-size: 13px; line-height: 1.8; overflow-wrap: anywhere; }
.pmwb-validation-history { display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; min-width: 0; min-height: 0; padding: 30px 24px 24px; border-left: 1px solid var(--pmwb-line-soft); overflow: hidden; }
.pmwb-validation-history > header, .pmwb-validation-results > header { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 10px; }
.pmwb-validation-history > header h3 { font-size: 17px; }
.pmwb-validation-history > header > span { color: var(--pmwb-subtle); font-size: 13px; }
.pmwb-validation-history-description { margin-bottom: 22px !important; color: var(--pmwb-subtle); font-size: 12px; line-height: 1.7; }
.pmwb-validation-history-list { min-height: 0; overflow: auto; }
.pmwb .pmwb-validation-history-row { display: grid; grid-template-columns: 20px minmax(0, 1fr); align-items: start; gap: 7px 10px; width: 100%; padding: 16px 12px; border: 0; border-bottom: 1px solid var(--pmwb-line-soft); border-radius: 0; background: transparent; text-align: left; }
.pmwb .pmwb-validation-history-row[aria-pressed=true] { background: rgba(255,255,255,.065); box-shadow: inset 2px 0 0 #cccccc; }
.pmwb-validation-history-row > span:first-of-type { min-width: 0; display: grid; gap: 6px; }
.pmwb-validation-history-row strong { font-size: 14px; font-weight: 530; overflow-wrap: anywhere; line-height: 1.6; }
.pmwb-validation-history-row small { font-size: 12px; color: var(--pmwb-subtle); }
.pmwb-validation-history-row svg { width: 19px; height: 22px; opacity: .6; }
.pmwb-validation-badge { grid-column: 2; justify-self: start; padding: 1px 7px; border: 1px solid var(--pmwb-line); border-radius: 4px; color: var(--pmwb-muted); font-size: 12px; }
.pmwb .pmwb-validation-refresh { justify-self: start; margin-top: 18px; border-color: transparent; background: transparent; padding: 5px 0; font-size: 12px; color: var(--pmwb-subtle); }
.pmwb-validation-detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin: 4px 0 20px; }
.pmwb-validation-detail-heading span { color: var(--pmwb-muted); font-size: 12px; }
.pmwb-validation-detail > h3 { margin-bottom: 6px; font-size: 20px; overflow-wrap: anywhere; }
.pmwb-validation-plan { margin: 22px 0; border: 1px solid var(--pmwb-line); border-radius: 12px; padding: 15px 18px; background: rgba(0,0,0,.08); }
.pmwb-validation summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 13px; list-style: none; }
.pmwb-validation summary::after { content: '+'; color: var(--pmwb-subtle); }
.pmwb-validation details[open] > summary::after { content: '−'; }
.pmwb-validation summary::-webkit-details-marker { display: none; }
.pmwb-validation summary > span { flex: 1; text-align: right; font-size: 12px; color: var(--pmwb-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pmwb-validation-plan > fieldset { display: grid; min-width: 0; gap: 14px; margin: 20px 0 12px; padding: 0; border: 0; }
.pmwb-validation-plan label, .pmwb-poc-input > label, .pmwb-validation-judgment > label, .pmwb-controlled-demo > label { display: grid; min-width: 0; gap: 8px; color: var(--pmwb-muted); font-size: 14px; }
.pmwb .pmwb-validation textarea, .pmwb .pmwb-validation input:not([type=checkbox]) { display: block; width: 100%; min-width: 0; margin: 0; padding: 10px 12px; border: 1px solid var(--pmwb-line); border-radius: 8px; background: rgba(0,0,0,.16); color: var(--pmwb-text); font: inherit; font-size: 13px; line-height: 1.7; resize: vertical; }
.pmwb-validation input:disabled, .pmwb-validation textarea:disabled { opacity: .7; }
.pmwb-validation-cases { display: grid; gap: 9px; }
.pmwb-validation-case { margin: 9px 0; border: 1px solid var(--pmwb-line-soft); border-radius: 9px; padding: 13px; }
.pmwb-validation-case[open] > summary { margin-bottom: 16px; }
.pmwb-validation-case label { margin-bottom: 13px; }
.pmwb-validation-case > button { font-size: 12px; }
.pmwb-validation-confirm { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 0; }
.pmwb-validation-confirm > label { display: flex; flex: 1 1 280px; min-width: 0; align-items: flex-start; gap: 10px; font-size: 12px; color: var(--pmwb-muted); }
.pmwb-validation-confirm > button { flex-shrink: 0; }
.pmwb-poc-input { padding: 20px 0; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-poc-input p { margin: 8px 0 14px; }
.pmwb-validation-results { margin-top: 30px; padding-top: 22px; border-top: 1px solid var(--pmwb-line); }
.pmwb-validation-result-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 20px; }
.pmwb-validation-result-grid > div { min-width: 0; }
.pmwb-validation pre { margin: 7px 0 14px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--pmwb-muted); font-size: 12px; font-family: inherit; line-height: 1.85; max-height: 460px; overflow: auto; }
.pmwb-validation-output { overflow-wrap: anywhere; font-size: 12px; line-height: 1.8; }
.pmwb-validation-output > section + section { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-validation-output h5 { margin: 14px 0 4px; font-size: 13px; font-weight: 600; }
.pmwb-validation-output p { margin: 5px 0; white-space: pre-wrap; }
.pmwb-validation-output ol, .pmwb-validation-output ul { padding-left: 20px; }
.pmwb-validation-output li + li { margin-top: 12px; }
.pmwb-validation-output blockquote { margin: 8px 0 14px; padding: 6px 12px; border-left: 2px solid var(--pmwb-line); color: var(--pmwb-muted); white-space: pre-wrap; }
.pmwb-validation-output > details { margin-top: 20px; color: var(--pmwb-muted); }
.pmwb-validation-checks { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 12px 0; list-style: none; font-size: 12px; color: var(--pmwb-muted); }
.pmwb-validation-judgment { margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--pmwb-line); }
.pmwb-validation-judgment > p { margin: 7px 0 15px; }
.pmwb-validation-judgment button[aria-pressed=true] { color: #161616; background: #eeeeee; border-color: #eeeeee; }
.pmwb-validation-next { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-top: 18px; padding: 17px; border: 1px solid var(--pmwb-line); border-radius: 10px; }
.pmwb-validation-next p { flex: 1 1 280px; min-width: 0; color: var(--pmwb-muted); font-size: 12px; }
.pmwb-validation-next button { flex-shrink: 0; }
.pmwb-controlled-demo { margin-top: 18px; padding: 24px; border: 1px solid var(--pmwb-line); border-radius: 14px; background: rgba(255,255,255,.045); }
.pmwb-controlled-demo > header { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.pmwb-controlled-demo > header span { color: var(--pmwb-subtle); font-size: 10px; }
.pmwb-controlled-demo > ol { display: flex; flex-wrap: wrap; gap: 10px 28px; padding-left: 17px; margin: 22px 0; font-size: 12px; color: var(--pmwb-subtle); }
.pmwb-controlled-demo li[aria-current=step] { color: #eeeeee; }
.pmwb-controlled-demo > button { margin: 13px 0; }
.pmwb-validation-empty { padding: 56px 0; text-align: center; }
.pmwb-validation-empty p { margin: 12px 0 23px; }
.pmwb-handoff { padding: 0; }
.pmwb-handoff > h3 { margin-bottom: 10px; font-size: 20px; overflow-wrap: anywhere; }
.pmwb-handoff dl { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0; }
.pmwb-handoff dl > div { padding-top: 13px; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-handoff dt { font-size: 12px; color: var(--pmwb-subtle); }
.pmwb-handoff dd { margin: 5px 0 0; font-size: 13px; overflow-wrap: anywhere; }
.pmwb-handoff-contents { padding: 20px 0; border-top: 1px solid var(--pmwb-line); }
.pmwb-handoff-scope { margin: 26px 0; }
.pmwb-handoff-scope ul { list-style: none; padding: 0; margin: 14px 0 0; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-handoff-scope li { display: flex; gap: 16px; padding: 14px 0; border-bottom: 1px solid var(--pmwb-line-soft); font-size: 14px; }
.pmwb-handoff-scope li > span { color: var(--pmwb-subtle); font-variant-numeric: tabular-nums; }
.pmwb-handoff-contents ul { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 24px; padding: 0 0 0 16px; margin: 16px 0 0; font-size: 14px; color: var(--pmwb-muted); }
.pmwb-handoff-ready { margin: 18px 0; padding: 18px 0; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-handoff-ready > button { justify-self: start; }
.pmwb-handoff-ready pre { font-size: 12px; }
@media (max-width: 1180px) {
  .pmwb-validation-workspace { grid-template-columns: minmax(0, 1fr) 280px; }
  .pmwb-validation-scroll { padding: 26px; }
  .pmwb .pmwb-validation-mode { grid-template-columns: minmax(0,1fr); padding: 14px; }
  .pmwb-validation-mode svg { display: none; }
  .pmwb-validation-mode small { grid-column: 1; }
  .pmwb-validation-history { padding-inline: 18px; }
  .pmwb-validation-footer { padding-inline: 26px; }
}
@media (max-width: 900px) {
  .pmwb-validation-workspace { display: block; overflow: auto; }
  .pmwb-validation-main, .pmwb-validation-scroll { height: auto; overflow: visible; }
  .pmwb-validation-history { display: block; padding: 24px 26px; border-left: 0; border-top: 1px solid var(--pmwb-line); }
  .pmwb-validation-history-list { max-height: 280px; overflow: auto; }
  .pmwb-validation-history-description { margin-bottom: 12px !important; }
  .pmwb-validation-result-grid { grid-template-columns: 1fr; }
  .pmwb-validation-footer { gap: 18px; }
  .pmwb-validation-footer-actions { flex-wrap: wrap; justify-content: flex-end; }
}
@media (max-width: 640px) {
  .pmwb-validation-scroll, .pmwb-validation-history { padding: 22px 18px; }
  .pmwb-validation-heading h2 { font-size: 22px; }
  .pmwb-validation-section-heading { align-items: flex-start; flex-wrap: wrap; gap: 5px; }
  .pmwb-validation-modes { grid-template-columns: 1fr; gap: 8px; }
  .pmwb .pmwb-validation-mode { min-height: 64px; grid-template-columns: minmax(0,1fr) auto; align-items: center; padding: 13px 14px; }
  .pmwb-validation-mode small { grid-column: 2; font-size: 11px; }
  .pmwb-validation-footer { align-items: stretch; flex-direction: column; gap: 14px; padding: 16px 18px; }
  .pmwb-validation-footer p { font-size: 11px; }
  .pmwb-validation-footer-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .pmwb .pmwb-validation-footer button { min-width: 0; padding-inline: 12px; }
  .pmwb .pmwb-validation-footer .pmwb-primary { min-width: 0; }
  .pmwb-validation-confirm, .pmwb-validation-next { align-items: stretch; flex-direction: column; gap: 16px; }
  .pmwb-validation-confirm > label, .pmwb-validation-next p { flex: none; }
  .pmwb-validation-results > header, .pmwb-validation-detail-heading { flex-wrap: wrap; }
  .pmwb-validation-results > header select { width: 100%; }
  .pmwb-handoff dl, .pmwb-handoff-contents ul { grid-template-columns: 1fr; }
}
@media (prefers-reduced-motion: reduce) { .pmwb-working-dot { animation: none; } }
`
