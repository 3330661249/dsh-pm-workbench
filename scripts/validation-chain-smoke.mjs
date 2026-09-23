import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build } from 'esbuild'

// Explicitly invoked acceptance run. Creates only one named synthetic project; never reads unrelated project content.
const root = path.resolve(import.meta.dirname, '..')
const out = path.join(root, '.tmp/validation-acceptance')
await mkdir(out, { recursive: true })
await build({ stdin: { contents: `export { readMaterialDraft } from './packages/workbench/src/client/workbench/material-input.ts';\nexport { wordDocument } from './packages/workbench/src/client/workbench/browser-port.ts';\nexport { validationHandoffArchive } from './packages/workbench/src/client/workbench/handoff-export.ts';`, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile: path.join(out, 'tools.mjs'), logLevel: 'silent' })
const tools = await import(pathToFileURL(path.join(out, 'tools.mjs')).href)
const stateFile = path.join(out, 'state.json')
let state
try { state = JSON.parse(await readFile(stateFile, 'utf8')) } catch { state = { projectId: randomUUID(), phase: 'new', version: 0, tasks: {} } }
const save = () => writeFile(stateFile, JSON.stringify(state, null, 2))
const origin = process.env.PMWB_ACCEPTANCE_ORIGIN || 'http://127.0.0.1:3080'
async function rpc(channel, method, payload) {
  const response = await fetch(origin + channel + '/' + method, { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'client-request', rpcId: randomUUID(), method, payload }), signal: AbortSignal.timeout(900000) })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  const envelope = await response.json()
  if (!envelope.result?.ok) throw new Error(`RPC ${envelope.result?.error?.code ?? 'invalid-response'}`)
  return envelope.result.value
}
const product = (method, payload = {}) => rpc('/dsh-pm-workbench-product-v1', method, { apiVersion: 'pmwb-product-v1', ...payload })
async function command(payload) {
  const value = await product('projects.command', { projectId: state.projectId, expectedVersion: state.version, commandId: randomUUID(), payload })
  if (value.status !== 'accepted') throw new Error(`Product ${payload.kind}: ${value.error?.code}`)
  state.version = value.value.projectVersion; state.contentVersion = value.value.contentVersion
  await save(); return value.value
}
async function currentProject() {
  const result = await product('projects.get', { projectId: state.projectId })
  if (result.status !== 'accepted') throw new Error('Acceptance project not found')
  state.version = result.value.header.projectVersion; state.contentVersion = result.value.header.contentVersion
  return result.value
}
const phase = process.argv[2] || 'prepare'
if (phase === 'prepare') {
  if (state.phase === 'new') {
    await command({ kind: 'project.create', name: '完整链路验收 · 合成访谈', researchGoal: '验证访谈需求提炼及原文追溯的最小产品流程。全部内容为虚构测试材料。', dataUseAttested: true })
    state.phase = 'created'; await save(); console.log('已创建专用合成验收项目')
  }
  if (state.phase === 'created') {
    const markdown = '# 合成访谈：访谈原文追溯\n\n主持人：你整理访谈最费时的是什么？\n受访者：我每次要在很长的访谈里反复搜索，才能找到某条需求对应的原话。\n主持人：希望怎么改善？\n受访者：我希望点击需求就能看到原文和上下文，不用自己复制查找。\n主持人：你担心 AI 出什么错？\n受访者：我最担心它把自己的猜测写成用户说过的话，引用必须和原文一字不差。\n主持人：如果材料里没有提到某个结论呢？\n受访者：那就明确说没有依据，交给我确认，不要编造访谈引文。\n主持人：所有访谈都需要吗？\n受访者：只有一两段的短访谈我直接读更快，不需要强制走工具。\n'
    const bytes = new Uint8Array(await tools.wordDocument(markdown).arrayBuffer())
    await writeFile(path.join(out, '合成访谈验收.docx'), bytes)
    const draft = await tools.readMaterialDraft({kind:'file', file:{name:'合成访谈验收.docx',type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',size:bytes.length,arrayBuffer:async()=>bytes.buffer}})
    const value = await command({kind:'source.importText', text:draft.text,displayName:draft.displayName,format:draft.format,dataUseAttested:true,dataClassification:'authorized-real'})
    state.sourceRevisionId=value.sourceRevisionId;state.phase='imported';await save();console.log('Word 正文提取、导入和读回已完成')
  }
  if (state.phase === 'imported') {
    await currentProject()
    await command({kind:'analysis.runHarnessModel',sourceRevisionId:state.sourceRevisionId})
    state.phase='analyzed';await save();console.log('真实模型完成需求提炼')
  }
  if (state.phase === 'analyzed') {
    const project = await currentProject()
    state.requirementIds=project.generatedRequirements.slice(0,2).map(item=>item.requirementId)
    if (!state.requirementIds.length) throw new Error('No requirements returned')
    for(const requirementId of state.requirementIds) await command({kind:'requirement.update',requirementId,decision:'include',priority:'high',humanReason:'合成链路验收范围确认，不代表真实用户的优先级决策。'})
    const published=await command({kind:'baseline.publish',confirmedContentVersion:state.contentVersion})
    state.baselineId=published.baselineId;state.phase='baseline';await save();console.log('合成需求已确认并保存基线')
  }
  if (state.phase === 'baseline') {
    await currentProject()
    const value=await command({kind:'prd.render',baselineId:state.baselineId,confirmedContentVersion:state.contentVersion})
    state.prdRevisionId=value.prdRevisionId;state.phase='prd';await save();console.log('真实模型完成 create-prd 起草')
  }
  const project=await currentProject()
  const prd=await product('artifacts.getMarkdown',{projectId:state.projectId,prdRevisionId:state.prdRevisionId})
  await writeFile(path.join(out,'prd.docx'),new Uint8Array(await tools.wordDocument(prd.value.markdown).arrayBuffer()))
  await writeFile(path.join(out,'prepare-evidence.json'),JSON.stringify({project,prd},null,2))
  console.log(JSON.stringify({phase:state.phase,projectId:state.projectId,requirements:state.requirementIds.length,prdSaved:true}))
} else if (phase === 'refine') {
  const mode=process.argv[3]
  if (!['capability','poc'].includes(mode)) throw new Error('Choose capability or poc')
  const task=state.tasks[mode]
  const plan=mode==='capability'?{
    title:'需求到原文追溯 · 文本出处提取',
    goal:'作为实际文本处理组件，从本次输入的访谈原文中提取指定需求的逐字出处及已有上下文。此次仅验证文本提取，不验证点击界面、外部系统或整项需求交付。',
    criteria:['按每个指定需求返回实际出处，detail说明上下文；evidence只逐字引用本次访谈原文。','原文不支持指定需求时明确说明未找到，不编造出处。','相同原话出现多次时保留多个候选及各自已有上下文，不擅自唯一定位。'],
    cases:[
      {id:'normal',input:'访谈原文：主持人：整理访谈有哪些困难？受访者：我经常找不到需求对应的原话。我希望点开需求就能看到原文上下文。主持人：那引用呢？受访者：原话不能被改写。\n指定需求：点击需求看到原文及上下文。',expected:'找到“我希望点开需求就能看到原文上下文。”及前后原文，不声称已实现点击界面。'},
      {id:'missing',input:'访谈原文：受访者：我只需要导出文件时保留表格格式。\n指定需求：点击需求看到原文上下文。',expected:'明确原文未表达指定需求，不用导出格式内容冒充其支持证据。'},
      {id:'ambiguous',input:'访谈原文：片段一：主持人询问搜索耗时。受访者：我希望能对应回原文。片段二：主持人询问引用可信度。受访者：我希望能对应回原文。\n指定需求：需求可以对应回原文。',expected:'识别两个候选，分别保留搜索耗时、引用可信度上下文。'}]
  }:{
    title:'引用逐字校验 · 核心文本 POC',
    goal:'直接处理本次输入给出的来源原文与候选引用，逐条给出是否逐字匹配及差异说明。仅验证这个文本核心场景，不验证完整产品或所有异常。',
    criteria:['逐条比对候选引用与本次来源原文；正确引用标为一致，改写引用标为不一致。','不得把PRD、需求说明、验收标准中的文字当作本次候选。','引用依据只能逐字取自本次来源原文；没有出处时明确说明，不补写用户原话。'],
    cases:[
      {id:'exact',input:'来源原文：我需要导出表格。\n候选引用：我需要导出表格。',expected:'一致，逐字找到。'},
      {id:'changed',input:'来源原文：我需要导出表格。\n候选引用：我需要自动导出表格。',expected:'不一致，添加了“自动”。'},
      {id:'missing',input:'来源原文：（未提供）\n候选引用：我需要导出表格。',expected:'无法找到出处，不把候选当已证实用户原话。'}]
  }
  const response=await rpc('/dsh-pm-validation-v1','request',{action:'updatePlan',projectId:state.projectId,taskId:task.id,commandId:randomUUID(),expectedVersion:task.version,payload:plan})
  if(!response.ok)throw new Error(response.code)
  state.tasks[mode]=response.task;await save();console.log(`${mode}: 已收敛为可执行的文本核心场景，旧运行和未通过结论保留`)
} else if (phase === 'validation') {
  const mode=process.argv[3]
  if (!['demo','capability','poc'].includes(mode)) throw new Error('Choose demo, capability or poc')
  async function validation(request) {
    const response=await rpc('/dsh-pm-validation-v1','request',{projectId:state.projectId,...request})
    if (!response.ok) throw new Error(`Validation ${request.action}: ${response.code}: ${response.message}`)
    if(response.task){state.tasks[mode]=response.task;await save()}
    return response
  }
  let task=state.tasks[mode]
  if(!task) {
    const result=await validation({action:'create',taskId:randomUUID(),commandId:randomUUID(),expectedVersion:0,payload:{prdRevisionId:state.prdRevisionId,requirementIds:mode==='poc'?state.requirementIds.slice(-1):state.requirementIds.slice(0,1),mode}})
    task=result.task;console.log(`${mode}: AI验证计划已保存`)
  }
  if(task.status==='draft') {
    const result=await validation({action:'confirm',taskId:task.id,commandId:randomUUID(),expectedVersion:task.version,payload:{allowModelUse:true}})
    task=result.task;console.log(`${mode}: 合成测试计划已确认`)
  }
  if(task.status==='confirmed'||task.status==='failed') {
    const result=await validation({action:'run',taskId:task.id,commandId:randomUUID(),expectedVersion:task.version,payload:mode==='poc'?{input:'来源原文：受访者：我每次整理长访谈都找不到需求对应的原话。我希望点击需求后就能看到原文上下文。\n候选引用A：我希望点击需求后就能看到原文上下文。\n候选引用B：我希望自动生成所有需求并直接发布。\n请逐条处理这两条候选，给出实际一致性结果。'}:{}})
    task=result.task;console.log(`${mode}: 执行结束，状态 ${task.status}`)
  }
  await writeFile(path.join(out,`${mode}-evidence.json`),JSON.stringify(task,null,2))
  console.log(JSON.stringify({mode,status:task.status,cases:task.runs.at(-1)?.results.length,provenance:task.runs.at(-1)?.results.map(item=>item.provenance)}))
} else if (phase === 'judge') {
  const mode=process.argv[3],verdict=process.argv[4],note=process.argv[5]
  if(!note||!['pass','partial','fail','hold'].includes(verdict))throw new Error('Explicit verdict and inspection note required')
  const task=state.tasks[mode]
  const response=await rpc('/dsh-pm-validation-v1','request',{action:'judge',projectId:state.projectId,taskId:task.id,commandId:randomUUID(),expectedVersion:task.version,payload:{verdict,note}})
  if(!response.ok)throw new Error(response.code)
  state.tasks[mode]=response.task;await save()
  if(verdict==='pass') {
    const handoff=await rpc('/dsh-pm-validation-v1','request',{action:'handoff',projectId:state.projectId,taskId:task.id,commandId:randomUUID(),expectedVersion:response.task.version})
    if(!handoff.ok)throw new Error(handoff.code)
    await writeFile(path.join(out,`${mode}-研发交付.zip`),new Uint8Array(await (await tools.validationHandoffArchive(handoff.handoff)).arrayBuffer()))
    await writeFile(path.join(out,`${mode}-handoff.json`),JSON.stringify(handoff.handoff,null,2))
    console.log(`${mode}: 已保存研发交付ZIP`)
  }
  console.log(`${mode}: 验收人员结论 ${verdict}`)
} else throw new Error('Unknown phase')
