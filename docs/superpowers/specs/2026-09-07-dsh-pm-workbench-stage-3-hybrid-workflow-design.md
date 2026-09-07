# DeepSeek Harness AI 产品经理工作台：第三阶段混合路线设计

**日期：** 2026-09-07

**状态：** 路线 A 已获用户选择；本书面设计待用户复核

**基础提交：** `199932a`

**目标版本：** DeepSeek Harness `0.1.0-rc.6`

**上位产品设计：** `docs/superpowers/specs/2026-09-04-dsh-pm-workbench-simple-alpha-design.md`

**已通过的前置证据：** `docs/gate-results/stage-2-isolated-smoke.md`

## 1. 本阶段要解决什么

第三阶段把已经通过真实安装验证的合成计数器 Probe，演进为第一条 AI 产品经理业务工作流：

```text
访谈文字
  → 有原文依据的需求草稿
  → 产品经理审阅与调整优先级
  → 确认纳入范围
  → 可追溯的 Markdown PRD
```

采用用户选择的 **A：两阶段混合路线**：

1. **Stage 3A：工作台核心。** 先在真实 Harness 插件中完成项目、材料、证据、需求、人工决定、优先级、PRD、保存、重启恢复与删除。分析器先使用明确标注的本地合成 Fixture；Fixture 只接受清单内的内置合成样例，不冒充 AI。
2. **Stage 3B：真实模型 Gate M。** 在相同业务接口后接入 Harness 的结构化模型能力，只用新写的合成访谈验证模型、引用、取消、工具边界和提示注入。
3. **真实材料获准使用不属于第三阶段。** 即使 Gate M 通过，也要另行核验提供方、留存、日志、删除和用户授权，才能处理真实访谈。首版无法自动判断一段文字是否来自真人，因此项目创建与材料确认都要求用户勾选“这是合成测试材料”；这是一项明确限制和人工声明，不冒充自动脱敏或技术识别。

这样做的目的不是推迟 AI，而是先把 AI 不能保证的部分变成可复算规则：材料身份、原文引用、人工决定、状态保存和 PRD 生成都由插件控制；模型只提供候选解释。

## 2. 成功标准与允许声明

### 2.1 Stage 3A 成功标准

在全新隔离的 rc.6 profile 中，使用打包后的真实插件和合成材料完成：

1. 创建、打开和删除项目；
2. 通过粘贴或 UTF-8 `.txt` / `.md` 文件导入清单内的合成样例内容；
3. 运行明确标注为“本地测试分析”的 Fixture 分析；
4. 查看需求与逐字原文引用；
5. 编辑需求、优先级、处理结论和人工理由；
6. 确认并保存一次不可变需求基线；
7. 只用已纳入且有有效引用的需求生成 Markdown PRD；
8. 复制或下载 PRD；
9. 刷新与重启 Harness 后恢复项目、人工决定和 PRD；
10. disable、remove 和 re-add 插件时满足已定义的数据与界面行为；
11. 不接触用户当前 `3080` profile，不调用模型；网络结论只描述验收器实际观察到的页面目标范围，不外推到整台机器或 Host。

通过后只允许称为：

> 在隔离的 DeepSeek Harness rc.6 中，合成文字完成了可追溯的需求审阅与 Markdown PRD 工作流。

不得称为 AI 分析可用、真实访谈可用、完整 Alpha、生产安全或可公开分发。

### 2.2 Stage 3B 成功标准

Stage 3B 只有在 Stage 3A 固定通过后才开始。它必须证明：

1. 真实结构化结果来自 Harness 实际模型运行；
2. 使用一份固定合成访谈和一份开发期间未见的合成访谈；
3. 每条引用都由模型返回明确位置，并能在 Host 中逐字匹配；
4. 无引用内容只能作为推断、假设、开放问题或研究项；
5. 模型失败、拒绝、超时、取消或无结构化结果时不生成伪成功；
6. 材料中的提示注入文本不能触发文件、Shell、浏览器、网络或其他工具动作；
7. 重新分析不会静默覆盖人工决定；
8. 发送前界面显示模型提供方和实际发送范围，并由用户主动确认；若 Harness 不返回身份，界面必须显示“由 Harness 管理，身份未返回”，只有用户针对合成材料单独接受这一未知项后才可运行，且验收记录不得写成“提供方身份已确认”。

通过后只允许称为：

> 在隔离的 DeepSeek Harness rc.6 中，真实 Harness 模型对指定合成访谈完成了受约束的结构化需求草稿生成。

这仍不代表真实敏感访谈已获准。

## 3. 用户工作流

工作台保持四个业务区域，但不做强制逐页向导。用户可以在允许的状态下直接切换：

1. **材料**
2. **需求与证据**
3. **优先级与范围**
4. **PRD**

### 3.1 项目列表

打开插件先看到项目列表，而不是计数器。新建项目时填写项目名称，并可选填一句研究目标；未填写目标时仍可提取问题，但优先级建议必须显示“研究目标未提供”，不能声称已按业务目标排序。用户可以：

- 新建项目；
- 按最近更新时间打开项目；
- 查看项目当前阶段、保存状态和是否有过期 PRD；
- 删除项目。

第一版最多保存 20 个活动项目。达到上限后停止创建，不自动删除旧项目。删除时显示项目名称并二次确认；Host 持久化删除失败时项目仍保留。

### 3.2 材料

一个项目第一版只接收一份确认后的材料：

- 直接粘贴文字；
- 选择 `.txt`；
- 选择 `.md`。

文件必须是 UTF-8，原始字节不超过 256 KiB；解码后的 JavaScript 字符串不超过 80,000 个 UTF-16 code units；去除首尾空白后不能为空，且不能包含 NUL。

材料区域持续显示“当前仅支持合成测试材料，请勿导入真实访谈或客户信息”。用户确认材料前必须勾选“我确认这是新写的合成测试材料，不含真实个人或客户数据”；Host 拒绝没有该声明的导入。插件不声称能靠复选框或内容扫描证明材料已经匿名化。

材料按照用户最终确认的字符串原样保存：不改变换行、不做 Unicode normalization；文件只允许移除开头一个 UTF-8 BOM。材料 SHA-256 对最终字符串重新编码后的 UTF-8 字节计算。

开始分析后不允许原地替换材料。用户要换材料时，新建项目。这样避免旧引用和旧 PRD 在没有版本迁移机制时失去依据。

### 3.3 分析草稿

Stage 3A 的按钮文案是“生成本地测试草稿”，结果持续显示：

> 本地 Fixture 结果，未调用模型，不代表 AI 分析。

Stage 3A 的 `FixtureInsightEngine` 只接受随包冻结的 `FixtureManifest` 中的材料 SHA-256，并返回与该样例绑定的确定性草稿。未列入清单的材料可以留在尚未提交的 Client 草稿中，但不能持久化或运行 Fixture，界面显示“本地测试仅支持内置合成样例”。它不得截取任意文本后套入固定需求来制造“分析成功”。Stage 3B 才允许经过上述合成材料声明的陌生文本进入模型测试。

Stage 3B 才显示“发送并分析”。发送前必须展示：

- 将发送的材料；
- 当前研究目标，或“未提供”；
- Harness 返回的模型或提供方名称；
- 身份未返回时的“由 Harness 管理，身份未返回”；
- 数据发送说明；
- 主动确认按钮。

不得在用户只导入材料时自动启动模型，也不得在失败后静默回退到 Fixture。

### 3.4 需求与证据

每张需求卡必须区分以下内容：

- 原文证据；
- 对痛点的解释；
- 候选需求；
- 模型或本地测试的建议理由；
- 假设；
- 未知项；
- 建议优先级；
- 人工优先级与处理结论。

用户点击引用时可以看到原文上下文。相同受访者重复表达同一问题不能被界面描述为“多个用户支持”；相反证据必须保留，不能被合并成一致意见。

第一版允许修改标题、痛点、需求描述、优先级、处理结论和人工理由。不做需求合并、拆分或永久删除；重复项可将一个保留、另一个标记“不做”。任何编辑、优先级调整、处理结论或重排都会把当前分析标记为“已开始审阅”。

### 3.5 优先级与范围

优先级只有高、中、低，不伪造 RICE 数字。建议理由必须说明使用了哪些证据以及哪些信息缺失。

处理结论是：

- `include`：纳入；
- `defer`：暂缓；
- `reject`：不做；
- `pending`：待判断。

最终顺序和结论由用户决定。人工理由可以为空，但界面应提示它会帮助之后回看。不存在用户规模、收益、成本或工作量依据时显示未知，不能由模型补造。

### 3.6 PRD

生成前显示集中确认页：纳入需求、顺序、证据状态、仍待确认的问题。用户按钮文案是“确认本期需求并生成 PRD”；内部先保存不可变需求基线，再生成 PRD，不向用户使用容易误解为对外发布的“发布基线”。

PRD 包含：

1. 背景与问题；
2. 目标用户和场景；
3. 用户痛点及访谈依据；
4. 本期目标；
5. 功能需求和优先级；
6. 非本期范围；
7. 验收建议；
8. 成功指标；
9. 风险与待确认问题。

没有材料依据的市场规模、用户数量、排期、收入、研发成本、成功指标和技术方案显示“待产品经理补充”。模型生成的验收条件和方案建议必须标明“建议”，不能伪装成访谈事实。

PRD 不提供富文本正文编辑。用户可以预览、复制和下载 UTF-8 无 BOM Markdown。改变材料、需求、顺序或人工决定后，旧 PRD 保留但显示“已过期”，不会被静默覆盖。

## 4. 三个人工检查点

为了兼顾效率与责任，首版只设置三处集中检查，不要求每个算法步骤逐项弹窗：

1. **发送前确认：** Stage 3B 中确认实际发送材料，以及界面展示的模型提供方状态（包括“身份未返回”）。
2. **证据与需求确认：** 用户核对引用、编辑需求并决定纳入、暂缓或不做。
3. **PRD 生成前确认：** 用户确认本期需求；系统内部保存不可变需求基线，再生成 PRD。

AI 可以一次生成完整草稿，但草稿状态始终是“未审阅”，自动化程度和确认状态分开表示。

## 5. 领域模型

### 5.1 项目与材料

```ts
type ProjectId = string
type SourceRevisionId = string
type AnalysisRevisionId = string
type EvidenceId = string
type RequirementId = string
type GeneratedDraftId = string
type RequirementRevisionId = string
type BaselineId = string
type PrdRevisionId = string

interface ProjectHeader {
  id: ProjectId
  name: string
  researchGoal: string | null
  projectVersion: number
  contentVersion: number
  reviewStarted: boolean
  updatedAt: string
}

interface SourceRevision {
  id: SourceRevisionId
  projectId: ProjectId
  revision: 1
  displayName: string
  format: 'pasted' | 'text/plain' | 'text/markdown'
  text: string
  utf8Bytes: number
  contentHash: string
  syntheticDataAttested: true
}
```

项目名称不能为空；研究目标可以为空。名称不超过 120 个 Unicode code points / 512 UTF-8 bytes，研究目标不超过 500 个 code points / 2,048 UTF-8 bytes。第一版项目名称与研究目标在创建后不修改，以免已有分析的目标上下文悄然变化。

`updatedAt` 由 Host 注入的 `Clock` 在 accepted 且非 receipt replay 的 mutation 完成时写入；业务 rejected、读取和幂等重放都不更新时间。`projects.list` 固定按 `updatedAt` 降序、`projectId` 升序打破同秒并列；测试使用 fixed clock。该时间只服务列表排序和 metadata，不影响 `contentVersion` 或 PRD bytes。

所有 ID 使用 canonical lowercase UUID v4；所有哈希使用 64 个字符的 lowercase SHA-256 hex。所有持久化和协议字符串拒绝 unpaired surrogate；本设计中的 byte 上限都按 UTF-8 编码后的实际字节复算，不能从 JavaScript `string.length` 猜测。

### 5.2 证据

```ts
interface EvidenceExcerpt {
  id: EvidenceId
  sourceRevisionId: SourceRevisionId
  role: 'support' | 'counterexample' | 'context'
  start: number
  end: number
  quote: string
  quoteHash: string
}
```

Host 在每次写入、读取和生成 PRD 前重新验证：

```text
Number.isSafeInteger(start) && Number.isSafeInteger(end)
0 <= start < end <= source.text.length
start 和 end 都位于 UTF-16 scalar boundary，不切开 surrogate pair
quote 非空，且满足字段与总量上限
evidence 与 requirement 都属于当前 project 和同一个 sourceRevision
source.text.slice(start, end) === quote
sha256(utf8(quote)) === quoteHash
```

Evidence ID 在项目中必须唯一，需求中的每个 `evidenceId` 都必须解析成功且不得重复。位置使用最终持久化字符串上的 UTF-16 半开区间 `[start, end)`。模型必须直接返回明确的 start/end；Host 不按 quote 搜索，也不接受“取第一个匹配”作为成功。任一引用不合法时，本次分析结果整体失败并允许重试。

### 5.3 需求与人工决定

```ts
interface AnalysisRevision {
  id: AnalysisRevisionId
  sourceRevisionId: SourceRevisionId
  kind: 'fixture' | 'harness-model'
  generation: number
  baseProjectVersion: number
  status: 'draft' | 'superseded'
}

interface GeneratedRequirementDraft {
  id: GeneratedDraftId
  requirementId: RequirementId
  analysisRevisionId: AnalysisRevisionId
  sourceRevisionId: SourceRevisionId
  producer: 'fixture' | 'ai'
  title: string
  painPoint: string
  description: string
  evidenceIds: readonly EvidenceId[]
  rationale: string
  assumptions: readonly string[]
  unknowns: readonly string[]
  suggestedPriority: 'high' | 'medium' | 'low'
}

interface HumanRequirementRevision {
  id: RequirementRevisionId
  requirementId: RequirementId
  basedOnDraftId: GeneratedDraftId
  title: string
  painPoint: string
  description: string
}

interface HumanDecision {
  requirementId: RequirementId
  selectedText:
    | { kind: 'generated'; draftId: GeneratedDraftId }
    | { kind: 'human-revision'; revisionId: RequirementRevisionId }
  priority: 'high' | 'medium' | 'low'
  decision: 'pending' | 'include' | 'defer' | 'reject'
  humanReason: string
}
```

没有至少一条 `support` 证据的 Fixture 或 AI 需求不能设为 `include`。没有证据的内容保存在假设、未知项或后续研究项中，不进入需求基线。

生成草稿、人工文本版本和人工决定分开保存：人工编辑创建 `HumanRequirementRevision`，不得覆盖 `GeneratedRequirementDraft.suggestedPriority`、证据或模型理由。

首次分析原子写入一个完整 `AnalysisRevision`。在 `reviewStarted === false` 且还没有 baseline / PRD 时，重复分析可以把旧的未审阅 revision 标成 `superseded`，再原子写入整组新候选；一旦发生文本编辑、优先级改变、处理结论改变、重排、确认基线或生成 PRD，后续分析返回 `analysis-already-reviewed`，第一版要求新建项目，不做自动合并。模型返回时还必须匹配启动时冻结的 `sourceRevisionId + generation + baseProjectVersion`，否则结果作废且不写入半组草稿。

### 5.4 基线与 PRD

```ts
interface RequirementBaselineItem {
  rank: number
  requirementId: RequirementId
  textSource:
    | { kind: 'generated'; draftId: GeneratedDraftId; producer: 'fixture' | 'ai' }
    | { kind: 'human-revision'; draftId: GeneratedDraftId; revisionId: RequirementRevisionId }
  title: string
  painPoint: string
  description: string
  priority: 'high' | 'medium' | 'low'
  humanReason: string
  evidence: readonly EvidenceExcerpt[]
}

interface RequirementBaseline {
  id: BaselineId
  projectId: ProjectId
  projectName: string
  researchGoal: string | null
  sourceRevisionId: SourceRevisionId
  sourceContentHash: string
  projectVersion: number
  contentVersion: number
  items: readonly RequirementBaselineItem[]
  createdAt: string
}

interface PrdRevision {
  id: PrdRevisionId
  projectId: ProjectId
  sourceRevisionId: SourceRevisionId
  baselineId: BaselineId
  baselineContentVersion: number
  rendererVersion: 'pmwb-prd-v1'
  contentHash: string
  markdown: string
  createdAt: string
}
```

Baseline 和 PRD 是不可变 revision。Baseline 按顺序深拷贝项目名称、研究目标、source identity，以及当时已纳入需求的最终文字、优先级、人工理由和已验证证据；至少包含一个 `include` item。Renderer 只能读取该快照，不得再按 ID 查询可变的当前需求。暂缓和不做项仍保存在当前项目供回看，但不进入首版 PRD；“非本期范围”没有可验证依据时显示待补充，不从这些项自动编造范围结论。

`projectVersion` 用于所有 accepted mutation 的 CAS；`contentVersion` 只在会改变 PRD 输入的 source、analysis、requirement、priority、decision 或 reorder 命令成功时增加。`baseline.publish` 与 `prd.render` 增加 `projectVersion`，但不增加 `contentVersion`。PRD 只有在 `baselineId` 仍是当前确认的 baseline，且 baseline 的 `contentVersion` 仍等于项目当前 `contentVersion` 时才是 current；否则保留原字节并标记 stale。

`createdAt` 与 `updatedAt` 只作为 metadata，不写入 Markdown bytes。相同 immutable baseline、`rendererVersion` 和固定配置必须生成完全相同的 UTF-8 bytes 与 SHA-256；Markdown 需包含 project ID、source revision/content hash、baseline ID、requirement ID，以及 `textSource` 中的 generated draft ID 或 human revision ID、evidence locator/quoteHash 和 renderer version。未发生人工文本改写时明确标成“使用原始本地测试/模型草稿”，不把 `null` 当成隐含 revision。

## 6. 软件架构

保持一个插件包，不提前拆成多个独立插件。内部按职责分层，方便以后增加录音转写、批量访谈、竞品研究和 POC，而不引入通用工作流引擎。

```text
packages/workbench/src/
├── domain/                 # 材料、证据、需求、基线和 PRD 的纯规则
├── application/            # 项目命令、CAS、幂等与业务编排
├── analysis/               # InsightEngine 接口及 Fixture/未来 Harness 实现
├── protocol/               # Product RPC 严格 schema 与闭集 endpoint
├── integration/harness-rc6/
│   ├── product-host.ts     # Host 生命周期和公开 Connection RPC
│   └── project-domain.ts   # storageDomain 适配器
└── client/workbench/       # 项目列表、四个业务区域、草稿与保存状态
```

### 6.1 四个扩展接口

```ts
interface InsightEngine {
  analyse(input: AnalysisInput, signal: AbortSignal): Promise<AnalysisCandidate>
}

interface ProjectRepository {
  list(signal?: AbortSignal): Promise<readonly ProjectSummary[]>
  get(projectId: ProjectId, signal?: AbortSignal): Promise<ProjectRecord | undefined>
  create(input: CreateProjectInput, signal?: AbortSignal): Promise<ProjectCommandOutcome>
  mutate(command: ProjectCommand, signal?: AbortSignal): Promise<ProjectCommandOutcome>
  deleteProject(command: DeleteProjectCommand, signal?: AbortSignal): Promise<DeleteProjectOutcome>
  close(): Promise<void>
}

interface PrdRenderer {
  render(input: CurrentBaselineInput): PrdRevision
}

interface WorkbenchTransport {
  health(signal: AbortSignal): Promise<WorkbenchResult<Capabilities>>
  listProjects(signal: AbortSignal): Promise<WorkbenchResult<ProjectSummary[]>>
  getProject(input: GetProjectInput, signal: AbortSignal): Promise<WorkbenchResult<ProjectView>>
  getSource(input: GetSourceInput, signal: AbortSignal): Promise<WorkbenchResult<SourceView>>
  getMarkdown(input: GetMarkdownInput, signal: AbortSignal): Promise<WorkbenchResult<MarkdownView>>
  command(input: ProjectCommand, signal: AbortSignal): Promise<WorkbenchResult<ProjectCommandOutcome>>
}
```

所有 repository 操作只存在于 Host；Client 不直接读取 `storageDomain`，只能取得 Transport 双端验证后的 bounded view。Stage 3A 只替换 `InsightEngine` 为 Fixture 实现；Stage 3B 使用同一接口接入 Harness 模型。Client、存储、证据校验和 PRD renderer 不依赖具体模型。

### 6.2 Product 与 Probe 分离

Stage 3 使用独立 Product route：

```text
/dsh-pm-workbench-product-v1
```

闭集 endpoint 只有：

```text
health
projects.list
projects.get
sources.get
artifacts.getMarkdown
projects.command
```

`projects.command` 使用严格 discriminated union，承载：

```text
project.create
project.delete
source.importText
analysis.runFixture          # 仅 Stage 3A
analysis.runHarnessModel     # 仅 Stage 3B
requirement.update
requirements.reorder
baseline.publish
prd.render
```

每个 command 是 closed discriminated union，不接受额外字段、本地路径、`File`、object URL 或任意嵌套 payload。`source.importText` 只接收解码后的文本、安全 display name、format 与合成材料声明；`requirements.reorder` 必须是当前分析中全部 requirement ID 的无重复精确 permutation；`baseline.publish` 只接受仍属于当前 source / analysis 的有效需求与 evidence，并要求至少一项有 supporting evidence 的 `include`；`prd.render` 只接受当前、未过期的 baseline。业务错误也是 closed union，outer error 固定为空 details，不回显 source、quote、模型原始输出、路径或 `Error.message`。

`ProjectView` 是固定的 bounded projection，只包含：

- `ProjectHeader`；
- 当前 source metadata，不含 text；
- 当前 `AnalysisRevision` metadata；
- 当前 generated requirements、用户当前选中的文字版本、当前 decisions 和 current evidence；
- 当前 baseline summary，不含其深拷贝 `items`；
- 最多 8 条 PRD summary（ID、baseline ID、hash、current/stale），不含 Markdown。

`projects.get` 不返回历史 baseline items、历史 evidence、HumanRequirementRevision 全文历史、完整 source text 或完整 Markdown。历史 baseline 仅由 Host 用于审计和确定性 PRD；首版 UI 不浏览它的全文。完整 source 和用户明确选择的 PRD 分别由 `sources.get` 与 `artifacts.getMarkdown` 返回。因为首版 source 和 PRD 都有较小硬上限，这两个 endpoint 一次返回完整内容，不提前增加分页协议。

Stage 2 的 `health/counter.increment` Probe protocol 不接受自由文本，也不扩展为 Product endpoint。进入 Product 构建后，生产入口不再挂载 Probe；旧 Probe 源码和报告可以保留为历史验证证据，但不进入 Product 运行图。Stage 3A 必须生成新的 package hash、Product build-graph receipt 和 isolated smoke report；Stage 2 只证明同一 rc.6 组合上的 Connection RPC、global storage、additive slots 与基础 lifecycle 曾经通过，不证明 Product table、业务流程或模型。

### 6.3 持久化

使用 `storageDomain` 的 `projects` table。每个 key 对应一个严格 discriminated record：

```ts
type StoredProjectRecord = ActiveProjectRecord | DeletedProjectTombstone
```

活动记录保存一个完整、schema-validated 的当前快照与项目内 command receipts。删除不直接丢掉整行，而是在同一次 `table.update` 中把活动记录替换为不含项目名称、研究目标、source、evidence、requirements、baseline 或 PRD 的最小 tombstone；tombstone 只保留 project ID、删除时间、`deleteCommandId`、delete command request hash 和紧凑 outcome。项目列表从活动记录派生，不另存一份容易与项目记录分叉的摘要 catalog。

所有 mutation 都带：

```ts
{
  projectId: string
  expectedVersion: number
  commandId: string
  payload: StrictProjectCommandPayload
}
```

`project.create` 的 `projectId` 与 `commandId` 由 Client 预生成并由 Host 严格校验，`expectedVersion` 固定为 `0`。Host 使用 `table.put` 创建 version `1` 的活动记录，并把 create receipt 放在同一记录中。现存项目的 mutation 才使用 `table.update`；`project.delete` 使用 `table.update` 原子替换为 tombstone。一个共享的 membership queue 串行包住 create/delete 的“不存在或状态检查 → 20 项活动上限检查 → durable put/update 完成”，避免两个并发 create 同时越过上限；普通项目 mutation 仍按 project 串行。

规则：

- 幂等身份是 `(projectId, commandId)`；request hash 绑定 endpoint、command kind、projectId、expectedVersion 以及移除 commandId 后的严格 payload；
- 同一 `commandId` 与同一 canonical payload 在活动项目存续期间重放第一次结果；delete receipt 在 tombstone 存续期间重放第一次结果，不重复写入；
- 同一 `commandId` 与不同 payload 返回 `idempotency-key-reused`；
- `expectedVersion` 过期返回 `version-conflict`，不部分修改；
- schema 通过并进入 CAS / 领域判断后的 accepted 与业务 rejected outcome 都保存 receipt；transport、schema、commit 前取消和容量前置拒绝不创建 receipt；
- 活动项目 receipt 不静默淘汰；达到上限后拒绝新的非删除 mutation，但始终允许用户删除项目；
- tombstone 防止已删除 project ID 被重新创建，并允许丢失 delete 响应后安全重试；tombstone 在该 profile 存续期间不自动清除；达到创建门槛时拒绝创建新 project ID，但现有项目仍可删除为原 key 的 tombstone；
- 命中 tombstone 时，原 `deleteCommandId` 加同 request hash 重放原结果；原 command ID 加不同 hash 返回 `idempotency-key-reused`；其他 command ID 固定返回 `project-deleted`，不改写 tombstone 或新增 receipt；
- 持久化失败不更新 Client 的权威快照；
- 响应丢失但写入可能已经完成时，Client 显示“结果待确认”，只允许用同一 command ID 重试或刷新；
- 项目删除在 Host 成功持久化 tombstone 后才从界面消失；`projects.list/get` 不返回 tombstone。

删除是项目 aggregate 生命周期的终点：如果 create 的成功响应先丢失、项目随后又被成功删除，旧 create command 的长尾重试固定返回 `project-deleted`，不再承诺重放删除前的 create outcome。该收窄规则避免 tombstone 保留项目名称或其他已删除内容。

每次 durable write 前都先构造完整候选记录，并验证：活动记录自身、profile 活动记录合计，以及该记录将产生的 `ProjectSummary`、当前 `ProjectView`、`SourceView` 和每个仍可读取的 `MarkdownView` 都能通过 schema 与对应 endpoint outcome budget。任一投影超限时整条命令以 `limit-exceeded` 拒绝，不能保存一个随后无法通过公开 endpoint 读回的合法记录。

Stage 3A 的真实隔离验收必须证明刷新和 Harness 重启后状态恢复。浏览器的 `localStorage`、`sessionStorage` 和 IndexedDB 不保存项目正文。

空项目是合法的 `draft-without-source`：`project.create` 成功后，即使文件解码或材料导入失败，项目仍可打开、重新导入或删除；“不产生半个项目”是指不产生 schema 无效的 source、analysis 或 PRD，不是回滚一个已经成功创建的空项目。

### 6.4 固定容量与协议预算

第一版先用较小上限换取简单、可复算的全量读取；任一上限都在 Client 预检并由 Host 权威重验，超限拒绝且不截断：

| 对象 | 上限 |
| --- | --- |
| 活动项目 | 20 |
| 删除 tombstone | 创建门槛 1,024；达到后禁止创建新 project ID，不阻止删除当时最多 20 个活动项目，因此 table 绝对上限为 1,044；不自动清除 |
| 原始 TXT/MD 与持久化 source UTF-8 | 各 262,144 bytes |
| source 字符串 | 80,000 UTF-16 code units，且无 unpaired surrogate |
| 需求 / evidence | 每个分析最多 24 / 96 |
| 单条 evidence quote | 4,000 code points / 16,384 UTF-8 bytes |
| 一个项目的 evidence quote 合计 | 131,072 UTF-8 bytes |
| assumption / unknown 数量 | 每个 requirement 各最多 20 项 |
| 单条 assumption / unknown | 500 code points / 2,048 UTF-8 bytes |
| assumption / unknown 合计 | 每个 requirement 的两类各 8,192 bytes；一次 analysis 两类合计 65,536 bytes |
| 普通需求文字字段 | title、painPoint、description、rationale 每字段 2,000 code points / 8,192 UTF-8 bytes；具体 schema 可以更小 |
| 人工理由 | 2,000 code points / 8,192 UTF-8 bytes |
| baseline / PRD revision | 每项目各最多 8；不静默淘汰 |
| 单个 Markdown PRD | 262,144 UTF-8 bytes；超限拒绝，不截断 |
| command receipts | 每个活动项目 256；不静默淘汰 |
| 活动项目持久化编码 | 4,194,304 canonical JSON UTF-8 bytes |
| 单个 tombstone | 2,048 canonical JSON UTF-8 bytes |
| profile 内活动项目编码合计 | 由“20 项 × 每项 4,194,304”直接推出最多 83,886,080 bytes，不是另一条需要跨项目事务的独立 quota |

Endpoint 对规范化 `{ endpoint, input }` / `{ endpoint, outcome }` 整体执行以下上限：

| Endpoint | request | outcome |
| --- | ---: | ---: |
| `health` | 4,096 | 16,384 |
| `projects.list` | 4,096 | 131,072 |
| `projects.get` | 4,096 | 1,048,576 |
| `sources.get` | 4,096 | 786,432 |
| `artifacts.getMarkdown` | 4,096 | 786,432 |
| `projects.command` | 786,432 | 262,144 |

严格 Zod schema 在 Client 发送前和 Host 接收后都执行，拒绝 extra/missing fields；outcome 在 Host 返回前和 Client 接收后再次验证。`sources.get` 与 `artifacts.getMarkdown` 返回 identity、实际 UTF-8 bytes 和 SHA-256，Client 复算后才展示为完整或允许下载。Connection carrier 在插件 handler 前已经解析请求，因此这些业务预算不能被描述成对恶意本机进程的完整内存 DoS 防护。

因为活动项目数与每项目编码分别受硬上限约束，活动项目编码合计上限是数学上的派生值；普通 mutation 无需另做跨 row 的“80 MiB CAS”。Tombstone 另受 2,048-byte 单条上限与 1,044-row 绝对上限约束。任何 endpoint projection 仍必须满足 §6.3 的 commit 前可读性不变量。

### 6.5 Host 与 Client 生命周期

沿用 Stage 2 已验证的边界：

- Host 最多 16 个在途请求；Client 最多 8 个；
- Host 停止顺序：停止接收 → 注销 route → abort → 等待在途请求与写入 → 关闭 domain；
- Client 先注销 launcher/overlay，再取消请求并释放 store；
- 关闭工作台恢复打开按钮的焦点；
- teardown 开始后拒绝新请求并取消尚未提交的模型运行；已经开始的 durable write 可以在 drain 中完成，只有 awaited teardown 返回后才保证不再产生写入或 UI 更新；
- 所有外层错误都使用固定安全错误码，不返回原文、模型输出、路径、stack 或凭据。

用户动作与数据语义固定为：

| 动作 | 界面与 route | Product Domain 数据 |
| --- | --- | --- |
| 关闭工作台 | 关闭 overlay | 保留 |
| 刷新 / 重启同一 profile | 重新加载 | 应恢复，Stage 3A 必须实测 |
| disable 插件 | 释放入口与 route | 保留，不改写 |
| remove package | 移除入口与 route | 不宣称擦除；按 rc.6 当前语义预期保留，Stage 3A 必须实测 |
| re-add 同一包 | 重新挂载 | 若实测保留则恢复；否则 Stage 3A FAIL / INCONCLUSIVE，不编造恢复 |
| 删除项目 | 成功后从 Product reads 消失 | 活动记录原子变成无正文 tombstone；不等于安全擦除底层介质历史、已下载文件、系统备份或模型提供方副本 |
| 删除隔离测试 profile | 不属于产品按钮 | 只用于所有测试进程停止后的验收环境清理 |

## 7. Stage 3B 模型适配器

### 7.1 推荐入口

优先研究公开的 `ctx.subagents.start` 结构化结果入口，因为它提供 `outputSchema`、`result.structured`、`stopReason` 和 `dispose()`。接口声明存在不等于当前 rc.6 运行组合已提供可用 provider，因此先做 capability probe，失败即停止，不使用聊天抓取或隐藏 HTTP fallback。

Capability probe 还必须证明插件能通过公开 API 创建并拥有任务专用 parent/child Agent，且不会继承当前聊天、无关 workspace、preset 或会话历史；parent 与 child 都由本次 run 负责 drain/dispose。若只能借用当前聊天 Agent，Gate M 为 `NO-GO`。

每次发送冻结并记录 `analysisRunId + projectId + sourceRevisionId + sourceContentHash + researchGoalHash + generation + baseProjectVersion + provider/model route`。界面展示值必须与实际 run 绑定；身份未返回时记录稳定的 `unknown`，不得猜测。身份未知只允许在用户针对合成材料做一次单独运行授权后测试，不能满足未来真实材料的提供方 Gate。

模型成功必须同时满足：

```text
stopReason === 'completed'
structured 存在
Host 严格 schema 通过
字段与数量上限通过
所有引用逐字定位和 quoteHash 通过
输出未尝试越过当前 project/source identity
```

不得从自由文本 `output` 中再次搜索或修补 JSON。

Stage 2 的 Probe、Stage 3A 的 Fixture、Product route 可用或页面目标零外网观察，都不构成 subagent provider、模型身份、工具隔离、取消或模型网络出口的证据。

### 7.2 工具边界

rc.6 的 `toolFilter` 不能单独证明“零工具”：公开声明说明 scoped registrations 和保留的 Code Mode transport 可能不受普通过滤影响。

Gate M 必须在第一个模型步骤前证明实际可达工具面只包含结构化结果捕获所必需的能力，并使用合成攻击材料验证：

- 不读取文件；
- 不运行 Shell；
- 不打开浏览器；
- 不访问访谈中出现的 URL；
- 不读取其他会话；
- 不调用外部插件；
- 不自动发布、导出或修改项目决定。

如果无法在公开 API 范围内证明这些边界，Stage 3B 停止为 `NO-GO`，不通过提示词声称安全。

### 7.3 取消与失败

支持启动前取消、运行中取消、超时、拒绝、`max-tokens`、`error`、无 structured、错误 structured、基础设施 rejection 和未知 stop reason。

成功结果只在启动时冻结的 run identity 全部仍匹配、`reviewStarted === false` 且项目版本没有改变时提交。`run.result` 结束后始终在 `finally` 中等待 `run.dispose()`，并释放任务专用 parent/child；取消不能宣称已经发送给提供方的数据被撤回。

Stage 3B 不静默切换 provider、模型、Fixture 或底层 LLM API。备选模型路径需要新的明确决定和验收。

## 8. UI 状态与错误

工作台始终显示：

- 当前项目；
- 当前步骤；
- `未保存 / 保存中 / 已保存 / 保存失败 / 结果待确认`；
- 分析来源 `本地测试 / 模型生成`；
- 当前草稿是否已人工审阅；
- PRD 是否过期。

错误必须保持用户已输入内容，不产生 schema 无效的 source、半组需求或伪成功 PRD；已经成功创建的空项目是合法草稿。常见失败以可操作中文说明：

- 输入为空、格式错误、编码错误、过大或含 NUL；
- “工作台暂时无法连接”或“插件版本不兼容”；
- “内容已更新，请刷新后重试”；
- 引用无效；
- 模型未配置、取消、超时、拒绝或结果无效；
- 保存失败或写入结果待确认；
- PRD 已过期。

“没有有效需求”不是系统错误。它使用中性空状态：“暂未找到有充分依据的需求，可检查材料或保留为后续研究问题。”技术错误码与用户文案分开，默认界面不展示 Host、Fixture、CAS 或 protocol 等实现术语。

## 9. 隐私和数据边界

第三阶段的实现与自动验收只允许新写的合成、无身份信息材料。不得提交或附带真实访谈、录音、姓名、联系方式、客户信息、API Key、模型原始响应、Harness profile、浏览器数据或原始运行日志。

自由文本入口本身不能可靠判断材料是真是假。首版通过持续警示、必选的合成材料声明、Stage 3A Fixture 清单，以及每次模型发送前的再次确认来限制使用；文档和界面必须明确这不是敏感信息检测或匿名化保证。我们在第三阶段不输入或批准真实材料，但不宣称软件能识别用户是否作出了不实声明。

Stage 3A 不调用模型，package manager 保持 offline，运行监听仅在 `127.0.0.1`。Stage 3B 的模型调用属于明确外发动作，必须单独取得运行授权；Stage 2 的 browser-page-target 外网请求为零不能推导 Host 或模型调用的网络行为。

真实材料至少等待以下内容单独通过：

- 实际模型提供方和地区；
- 传输、留存、训练使用和删除政策；
- Harness 与插件日志是否记录正文；
- 本地静态数据保护与删除语义；
- 用户发送前确认；
- 提示注入与工具面验证。

## 10. 测试与验收层次

### 10.1 Stage 3A 自动测试

至少覆盖：

- TXT/MD、BOM、UTF-8、NUL、字节和 code-unit 上限；
- unpaired surrogate 拒绝，以及 emoji、surrogate pair、CRLF/LF 下的引用位置；
- 负数、小数、NaN、越界、零长度、切开 surrogate pair、quote、offset、quoteHash、project/sourceRevision 交叉篡改与缺失 evidence ID；
- Fixture manifest 只接受绑定的合成 source hash，陌生文本不产生伪分析；
- 无 supporting evidence 的需求不能纳入；
- 生成字段与人工版本分离，任一 review action 后禁止重新分析，过期 generation 不提交；
- reorder、baseline 深拷贝、旧 baseline/PRD 不变、刚生成 PRD 不 stale、同 baseline 重渲染字节一致；
- Markdown/HTML/脚注结构转义；
- PRD 只含人工纳入需求；
- CAS、command idempotency、断线重试和 uncertain mutation；
- create 使用预生成 ID/`expectedVersion: 0`，并发第 20/21 个 create 恰好一个成功；
- delete 响应丢失可由 tombstone 重放；同 delete command 改 payload 被拒，新 command 得到 `project-deleted`；create 响应丢失后又删除再重试也得到 `project-deleted`；project ID 不复用，删除失败保留，create/delete 交错不超限；
- accepted mutation 的更新时间、receipt replay 不更新时间、同时间按 project ID 排序以及重启后顺序稳定；
- Host/Client 并发、取消、卸载与 lifecycle；
- assumption / unknown 单项与合计边界、最大合法 current view 加 8 个历史 baseline 后 `projects.get` 仍可读；
- strict schema、每个 endpoint 的 canonical envelope byte budget、project/profile persisted budget、所有 read projection 的 commit 前预算和错误脱敏；
- Product bundle 不含 Probe route，不捆绑 Harness/Cordis 第二份 runtime；
- Client 不使用浏览器持久化保存正文。

### 10.2 Stage 3A 真实隔离验收

进入完整流程前先通过 Product storage-surface gate：精确 rc.6 public declarations 能表达 table `get/put/update/delete/close`；repository fake 通过 CAS、tombstone、预算与写失败恢复；最小真实 tgz 在全新隔离 profile 中完成一条 synthetic row 的 put → restart read → tombstone → restart absent-from-reads，并用无正文的 near-4-MiB synthetic row 验证 put → restart 后 canonical bytes/hash 不变。4 MiB 是插件写入前的 application quota，不宣称是 rc.6 backend 的容量上限；超过插件 quota 的输入在调用 backend 前安全拒绝。Stage 2 只实测过 global counter，不能替代这个 gate。

随后用新的真实 tgz、全新非 `3080` profile 和临时 Chrome 完成：安装 → 新建项目 → 加载清单内合成文字 → 本地测试草稿 → 人工编辑/排序/纳入 → 确认本期需求 → 生成并下载 PRD → 刷新/重启恢复 → disable/remove/re-add 后再次恢复 → 删除项目并在重启后保持不可见 → 清理。

验收器只能通过 Product 自有稳定 marker 和真实指针/键盘驱动公开 UI，不调用 raw RPC、HTTP 或 Harness 私有 DOM。它验证下载字节、SHA-256、引用追溯、Product build graph、进程与监听关闭、临时目录删除和明确范围内的网络观察。不能只靠截图、配置或文件存在判定通过；remove/re-add 的数据行为按 §6.5 的表逐项记录。

### 10.3 Stage 3B Gate M

Gate M 使用两套独立材料：冻结回归样例，以及实现逻辑冻结后才交给验收者的未见合成样例。两者至少包含：

- 三个明确问题；
- 同一人重复表达；
- 后文否定前文；
- 相反证据；
- 只有功能方案、没有问题；
- 无有效需求；
- 姓名/电话样式的虚构敏感字段；
- 提示注入、URL、读文件和运行命令指令；
- 模型伪造引用与结构不完整。

同时验收任务专用 parent/child、聊天历史隔离、实际工具面、provider/model route 绑定、启动前与运行中取消、超时、拒绝、`max-tokens`、无 structured、错误 structured、基础设施 rejection、未知 stop reason 和 awaited dispose。任何失败都不能静默切换为 Fixture 或另一条模型路径。

引用定位可以确定性验证；语义是否合理仍由人工对照评估。产品价值另用“人工完成 vs 工作台完成”的总耗时、遗漏、无依据结论和纠错成本衡量，不能只看生成速度和 PRD 篇幅。

## 11. 本阶段明确不做

- 使用真实访谈、真实客户资料或录音；
- 录音转写、说话人识别、Word/PDF/图片/视频解析；
- 需求合并、拆分、历史版本对比和多人协作；
- RICE/Kano 等复杂评分；
- 自动联网调研；
- 自动排期、预算、研发成本或成功指标；
- 自动生成高保真原型或 POC 代码；
- 飞书、Notion、Jira、Figma 等外部写入；
- 自动发布、通知、PR、部署或公开分发；
- 通用工作流编排引擎。

## 12. 后续扩展方式

本阶段只固定四个稳定接口：`InsightEngine`、`ProjectRepository`、`PrdRenderer` 和 `WorkbenchTransport`。后续能力以独立模块挂接：

- 录音转写生成新的 `SourceRevision`，不改证据和需求规则；
- 多访谈聚类消费多个经过确认的 source/evidence，不改 PRD renderer；
- 竞品分析产生独立来源类型，不冒充用户证据；
- 原型和 POC 只能消费人工发布的 baseline；
- 外部系统同步需要单独的显式导出 adapter 和授权，不进入核心事务。

插件仍保持一个包。只有出现两个能够独立安装、独立升级且不共享项目事务的模块后，才重新讨论拆成多个插件。

## 13. 实施顺序

1. 先完成 Product storage-surface 小门槛，不假定 Stage 2 的 global counter 已证明 table；
2. 提取 Demo 的纯领域规则，去除 Demo 语义污染，并把 Fixture 收敛为 manifest-bound engine；
3. 实现 Product schema、预算、项目 repository、CAS、receipt 与 tombstone；
4. 实现分析 revision、人工 revision、不可变 baseline 和确定性 PRD renderer；
5. 实现 Product Host route 与 lifecycle；
6. 实现项目列表和四区域 Workbench Client；
7. 完成新 tgz 的 Stage 3A 隔离验收；
8. 单独设计并运行 Gate M capability probe；
9. capability 通过后实现 Harness `InsightEngine`；
10. 用两份合成访谈完成 Gate M；
11. 真实材料不获准使用，等待单独的隐私与数据启用决定。

## 14. 需要用户复核的最终决策

本设计固定以下选择：

1. 先完成 Stage 3A 的可安装工作台核心，再接 Stage 3B 真实模型；
2. Stage 3A 的 Fixture 结果必须显式标注，不能叫 AI；
3. Stage 3B 只使用合成访谈，真实材料仍不获准使用；
4. 原文引用、人工决定和 PRD 由 Host 的确定性规则控制；
5. Product production entry 替换 Probe entry，Probe 只保留历史证据；
6. 首版使用一个插件包和四个内部扩展接口，不做通用工作流引擎；
7. 项目可选填一句研究目标；缺少时不冒充按业务目标完成排序；
8. “只用合成材料”依赖明确警示、人工声明与运行纪律，不冒充自动识别真实资料；
9. 模型工具面或任务历史隔离无法通过公开 API 验证时，Gate M 直接停止，不用提示词或私有接口绕过。
