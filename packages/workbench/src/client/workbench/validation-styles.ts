export const validationCss = `
.pmwb .pmwb-stepper { grid-template-columns: repeat(5, minmax(0, 1fr)); width: min(740px, calc(100% - 80px)); }
.pmwb .pmwb-stepper button { padding-inline: 12px; font-size: 12px; white-space: nowrap; }
.pmwb .pmwb-validation { width: 100%; max-width: 1160px; padding: 28px 32px; }
.pmwb-validation > header { margin-bottom: 18px; }
.pmwb-validation h3 { font-size: 17px; font-weight: 590; letter-spacing: -.02em; }
.pmwb-validation h4 { margin: 14px 0 7px; color: var(--pmwb-muted); font-size: 12px; font-weight: 550; }
.pmwb-validation-toolbar { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 22px; }
.pmwb-validation-toolbar label { display: flex; flex-wrap: wrap; align-items: center; min-width: 0; gap: 10px; color: var(--pmwb-muted); font-size: 12px; }
.pmwb .pmwb-validation select { min-width: 0; max-width: 100%; padding: 7px 12px; border: 1px solid var(--pmwb-line); border-radius: 8px; background: #222222; font-size: 12px; }
.pmwb-validation-modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; margin: 6px 0 24px; }
.pmwb .pmwb-validation-mode { display: flex; align-items: flex-start; flex-direction: column; text-align: left; min-height: 188px; padding: 24px 20px 18px; border-radius: 14px; background: rgba(255,255,255,.025); }
.pmwb .pmwb-validation-mode[aria-pressed=true] { border-color: rgba(255,255,255,.68); background: rgba(255,255,255,.09); box-shadow: inset 0 0 0 1px rgba(255,255,255,.06); }
.pmwb-validation-mode svg { margin-bottom: 17px; opacity: .87; }
.pmwb-validation-mode strong { margin-bottom: 7px; font-size: 17px; font-weight: 580; }
.pmwb-validation-mode span { max-width: 28ch; color: var(--pmwb-muted); font-size: 12px; line-height: 1.75; }
.pmwb-validation-mode small { margin-top: 16px; color: var(--pmwb-subtle); font-size: 10px; letter-spacing: .03em; }
.pmwb-validation-create { border-top: 1px solid var(--pmwb-line-soft); padding: 24px 0; }
.pmwb-validation-create > div:first-child { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.pmwb-validation-create p, .pmwb-validation-empty p, .pmwb-validation-judgment > p, .pmwb-poc-input > p { color: var(--pmwb-muted); font-size: 12px; }
.pmwb-validation-scope { display: grid; min-width: 0; gap: 8px; margin: 15px 0; padding: 0; border: 0; }
.pmwb-validation-scope label { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; border-radius: 9px; background: rgba(255,255,255,.03); font-size: 13px; overflow-wrap: anywhere; }
.pmwb-validation input[type=checkbox] { accent-color: #cccccc; width: 15px; height: 15px; flex-shrink: 0; }
.pmwb-validation-create-footer { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 24px; padding-top: 12px; }
.pmwb-validation-create-footer p { min-width: 0; max-width: 54ch; font-size: 12px; line-height: 1.8; }
.pmwb-validation-create-footer button { justify-self: end; }
.pmwb-validation-notice { display: flex; align-items: center; gap: 10px; margin: 12px 0 !important; padding: 13px 15px; border: 1px solid var(--pmwb-line); border-radius: 9px; background: rgba(255,255,255,.06); font-size: 12px; }
.pmwb-validation [role=alert] { border-left: 2px solid #dddddd; }
.pmwb-working-dot { width: 7px; height: 7px; border-radius: 50%; background: #eeeeee; animation: pmwb-working 1.5s ease-in-out infinite; }
@keyframes pmwb-working { 50% { opacity: .3; } }
.pmwb .pmwb-validation-muted { color: var(--pmwb-subtle); font-size: 11px; line-height: 1.8; overflow-wrap: anywhere; }
.pmwb-validation-history { margin-top: 28px; padding-top: 22px; border-top: 1px solid var(--pmwb-line); }
.pmwb-validation-history > header, .pmwb-validation-results > header { display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 12px; }
.pmwb-validation-history > header > span { color: var(--pmwb-subtle); font-size: 12px; }
.pmwb .pmwb-validation-history-row { display: flex; align-items: center; gap: 14px; width: 100%; padding: 15px 4px; border: 0; border-top: 1px solid var(--pmwb-line-soft); border-radius: 0; background: transparent; text-align: left; }
.pmwb .pmwb-validation-history-row[aria-pressed=true] { background: rgba(255,255,255,.065); box-shadow: inset 2px 0 0 #cccccc; }
.pmwb-validation-history-row > span:first-of-type { min-width: 0; flex: 1; display: grid; gap: 5px; }
.pmwb-validation-history-row strong { font-size: 13px; font-weight: 530; overflow-wrap: anywhere; }
.pmwb-validation-history-row small { font-size: 10px; color: var(--pmwb-subtle); }
.pmwb-validation-history-row svg { flex-shrink: 0; width: 20px; opacity: .7; }
.pmwb-validation-badge { flex-shrink: 0; padding: 3px 8px; border: 1px solid var(--pmwb-line); border-radius: 5px; color: var(--pmwb-muted); font-size: 10px; }
.pmwb-validation-detail-heading { display: flex; align-items: center; justify-content: space-between; gap: 15px; margin: 4px 0 20px; }
.pmwb-validation-detail-heading span { color: var(--pmwb-muted); font-size: 12px; }
.pmwb-validation-detail > h3 { margin-bottom: 6px; font-size: 22px; overflow-wrap: anywhere; }
.pmwb-validation-plan { margin: 22px 0; border: 1px solid var(--pmwb-line); border-radius: 12px; padding: 15px 18px; background: rgba(0,0,0,.08); }
.pmwb-validation summary { display: flex; align-items: center; justify-content: space-between; gap: 16px; font-size: 13px; list-style: none; }
.pmwb-validation summary::after { content: '+'; color: var(--pmwb-subtle); }
.pmwb-validation details[open] > summary::after { content: '−'; }
.pmwb-validation summary::-webkit-details-marker { display: none; }
.pmwb-validation summary > span { flex: 1; text-align: right; font-size: 11px; color: var(--pmwb-subtle); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pmwb-validation-plan > fieldset { display: grid; min-width: 0; gap: 14px; margin: 20px 0 12px; padding: 0; border: 0; }
.pmwb-validation-plan label, .pmwb-poc-input > label, .pmwb-validation-judgment > label, .pmwb-controlled-demo > label { display: grid; min-width: 0; gap: 7px; color: var(--pmwb-muted); font-size: 12px; }
.pmwb .pmwb-validation textarea, .pmwb .pmwb-validation input:not([type=checkbox]) { display: block; width: 100%; min-width: 0; margin: 0; padding: 10px 12px; border: 1px solid var(--pmwb-line); border-radius: 8px; background: rgba(0,0,0,.16); color: var(--pmwb-text); font: inherit; font-size: 13px; line-height: 1.7; resize: vertical; }
.pmwb-validation input:disabled, .pmwb-validation textarea:disabled { opacity: .7; }
.pmwb-validation-cases { display: grid; gap: 9px; }
.pmwb-validation-case { margin: 9px 0; border: 1px solid var(--pmwb-line-soft); border-radius: 9px; padding: 13px; }
.pmwb-validation-case[open] > summary { margin-bottom: 16px; }
.pmwb-validation-case label { margin-bottom: 13px; }
.pmwb-validation-case > button { font-size: 11px; }
.pmwb-validation-confirm { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 20px; padding: 16px 0; }
.pmwb-validation-confirm > label { display: flex; flex: 1 1 280px; min-width: 0; align-items: flex-start; gap: 10px; font-size: 12px; color: var(--pmwb-muted); }
.pmwb-validation-confirm > button { flex-shrink: 0; }
.pmwb-poc-input { padding: 20px 0; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-poc-input p { margin: 8px 0 14px; }
.pmwb-validation-results { margin-top: 30px; padding-top: 22px; border-top: 1px solid var(--pmwb-line); }
.pmwb-validation-result-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 20px; }
.pmwb-validation-result-grid > div { min-width: 0; }
.pmwb-validation pre { margin: 7px 0 14px; white-space: pre-wrap; overflow-wrap: anywhere; color: var(--pmwb-muted); font-size: 12px; font-family: inherit; line-height: 1.85; max-height: 460px; overflow: auto; }
.pmwb-validation-checks { display: flex; flex-wrap: wrap; gap: 8px 18px; padding: 12px 0; list-style: none; font-size: 11px; color: var(--pmwb-muted); }
.pmwb-validation-judgment { margin-top: 26px; padding-top: 22px; border-top: 1px solid var(--pmwb-line); }
.pmwb-validation-judgment > p { margin: 7px 0 15px; }
.pmwb-validation-judgment button[aria-pressed=true] { color: #161616; background: #eeeeee; border-color: #eeeeee; }
.pmwb-validation-next { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-top: 18px; padding: 17px; border: 1px solid var(--pmwb-line); border-radius: 10px; }
.pmwb-validation-next p { flex: 1 1 280px; min-width: 0; color: var(--pmwb-muted); font-size: 12px; }
.pmwb-validation-next button { flex-shrink: 0; }
.pmwb-controlled-demo { margin-top: 18px; padding: 24px; border: 1px solid var(--pmwb-line); border-radius: 14px; background: rgba(255,255,255,.045); }
.pmwb-controlled-demo > header { display: flex; align-items: center; justify-content: space-between; gap: 14px; }
.pmwb-controlled-demo > header span { color: var(--pmwb-subtle); font-size: 10px; }
.pmwb-controlled-demo > ol { display: flex; flex-wrap: wrap; gap: 10px 28px; padding-left: 17px; margin: 22px 0; font-size: 11px; color: var(--pmwb-subtle); }
.pmwb-controlled-demo li[aria-current=step] { color: #eeeeee; }
.pmwb-controlled-demo > button { margin: 13px 0; }
.pmwb-validation-empty { padding: 56px 0; text-align: center; }
.pmwb-validation-empty p { margin: 12px 0 23px; }
.pmwb-handoff { padding: 14px 0 0; }
.pmwb-handoff > h3 { margin-bottom: 10px; font-size: 22px; overflow-wrap: anywhere; }
.pmwb-handoff dl { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 25px 0; }
.pmwb-handoff dl > div { padding-top: 13px; border-top: 1px solid var(--pmwb-line-soft); }
.pmwb-handoff dt { font-size: 11px; color: var(--pmwb-subtle); }
.pmwb-handoff dd { margin: 5px 0 0; font-size: 13px; overflow-wrap: anywhere; }
.pmwb-handoff-contents { padding: 20px 0; border-top: 1px solid var(--pmwb-line); }
.pmwb-handoff-contents p { margin-top: 9px; color: var(--pmwb-muted); font-size: 12px; }
.pmwb-handoff-ready { display: grid; gap: 15px; margin: 18px 0; padding: 20px; border: 1px solid var(--pmwb-line); border-radius: 12px; background: rgba(255,255,255,.045); }
.pmwb-handoff-ready > button { justify-self: start; }
.pmwb-handoff-ready pre { font-size: 12px; }
@media (max-width: 1150px) { .pmwb .pmwb-stepper button { font-size: 10px; padding-inline: 7px; } .pmwb .pmwb-stepper button > span { width: 20px; height: 20px; font-size: 10px; } }
@media (max-width: 1100px) { .pmwb .pmwb-stepper { width: 100%; } }
@media (max-width: 900px) { .pmwb .pmwb-validation { padding: 22px; } .pmwb-validation-modes { gap: 9px; } .pmwb .pmwb-validation-mode { padding: 18px 14px; } .pmwb-validation-create > div:first-child { align-items: flex-start; flex-direction: column; gap: 7px; } .pmwb-validation-result-grid { grid-template-columns: 1fr; } }
@media (max-width: 640px) {
  .pmwb .pmwb-stepper button { flex-direction: column; gap: 5px; padding: 6px 4px; }
  .pmwb .pmwb-validation { padding: 19px 16px; }
  .pmwb-validation-modes { grid-template-columns: 1fr; }
  .pmwb .pmwb-validation-mode { min-height: auto; }
  .pmwb-validation-mode svg { margin-bottom: 10px; }
  .pmwb-validation-create-footer { grid-template-columns: minmax(0, 1fr); gap: 16px; }
  .pmwb .pmwb-validation-create-footer button, .pmwb .pmwb-validation-confirm > button, .pmwb .pmwb-validation-next button { width: 100%; }
  .pmwb-validation-confirm, .pmwb-validation-next { align-items: stretch; flex-direction: column; gap: 16px; }
  .pmwb-validation-confirm > label, .pmwb-validation-next p { flex: none; }
  .pmwb-validation-results > header, .pmwb-validation-detail-heading { flex-wrap: wrap; }
  .pmwb-validation-results > header select { width: 100%; }
  .pmwb-handoff dl { grid-template-columns: 1fr; }
  .pmwb-validation-badge { max-width: 78px; }
}
@media (prefers-reduced-motion: reduce) { .pmwb-working-dot { animation: none; } }
`
