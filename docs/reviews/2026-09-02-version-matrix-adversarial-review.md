# Official Typert 版本矩阵对抗式审查记录

日期：2026-09-02

审查对象：`codex/version-matrix` 分支上的 hardened matrix runner，以及随后产生的 Darwin arm64 frozen 结果

受审 runner 提交：`d1cb6c6cb86374748001282fd7a6bbd8675f5ad0`

审查方式：独立只读代码审查、针对性回归验证、正式运行后再核对 canonical 产物

## 审查范围与证据边界

本次审查回答的是一个窄问题：版本矩阵是否能在固定 fixture、固定工具链、固定官方包版本、固定 reviewed lock 与干净 Git 提交上，以 fail-closed 方式判断严格 Typert Host/Client Remote 生成条件是否满足。

审查覆盖：

- selection 与 experimental 配置的精确版本清单、角色和聚合决策；
- frozen 命令链是否真实执行、是否与 reviewed program/argv 和 stage 数量一致；
- registry、fixture、workspace link、lock、安装图、生成摘要、artifact 与 assertion 的交叉约束；
- failure code、failure stage、case status、单条非 PASS assertion 之间的语义一致性；
- Node/npm/runtime/platform key、runner Git 提交和 clean-worktree provenance；
- 完整 8-case reviewed-lock manifest、逐 case lock SHA-256 与 installed-graph SHA-256 的绑定；
- 报告中本地路径、原始源码、凭据形态与非 canonical 数值的拒绝规则；
- JSON semantic verifier、canonical JSON 回环，以及 Markdown/JUnit 派生视图的一致性；
- 正式 frozen selection 与 experimental 运行产生的最终结果。

本次审查没有启动、安装或挂载 DeepSeek Harness 插件，没有操作 Harness profile、端口 3080、模型配置、涟漪主题、用户访谈或任何真实用户数据。矩阵结果不能外推为完整 Harness 兼容性、插件可安装性、UI 行为、持久化、安全性或发布就绪结论。

## 严重度结论

- **P0：0**
- **P1：0**
- **P2：5 个保留项**，均不改变本次 8 个 case 的状态、聚合决策或 Gate A 结论。

此前审查发现的 P1 均已闭合，并经过针对性回归或正式 frozen 证据复核。没有遗留阻塞提交、运行或开 Pull Request 的 P0/P1。

## 已发现并闭合的 P1

| 主题 | 原风险 | 闭合方式与复核结论 |
| --- | --- | --- |
| Frozen stage | frozen 路径曾把 lock 预检阶段作为合成证据，真实 `npm ci --dry-run` 没有执行；报告可能声称完成了未发生的步骤。 | frozen 路径现在先真实执行 reviewed command plan 中的 `npm ci --dry-run --ignore-scripts ...`，成功后才允许执行安装。direct-generator failure 必须精确具有 11 个真实进程 stage，PASS 必须精确具有 12 个；program、argv、退出码、signal、timeout 与截断标记均受校验。正式 8 个 case 的第 6 个 stage 均为真实 dry-run 且退出 0。 |
| Failure semantics | `GENERATION_EMPTY` 以外的 direct failure code 曾可能与生成摘要矛盾，`REMOTE_GENERATION_EMPTY` 等状态也可能无法被自身 serializer 接受；非 PASS assertion 可能携带自报文本而不是可重算事实。 | direct failure 只从可公开的 discovery singleton identity、automatic/forced 计数及五个 artifact 的 present/bytes/SHA 状态重算；删除不能独立解释的 opaque normalized digest。`DISCOVERY_MISMATCH`、`GENERATION_EMPTY`、`GENERATION_IDENTITY`、`REMOTE_GENERATION_EMPTY`、`GENERATION_DISAGREEMENT` 均有正向和矛盾 code 回归。`GENERATION_EMPTY` 明确要求 automatic/forced 不是 `1/1`。非 PASS 只能保留一条由 status/code/stage 推导出的 `FAIL` 或 `BLOCKED` assertion。 |
| Runtime binding | aggregate/report 曾可接受调用方遗漏或伪造的 Node、npm、platform、arch，形成看似可信的 frozen provenance。 | runtime metadata 改为显式提供并与配置中的 Node `24.14.0`、npm CLI `11.9.0` 精确相等；拒绝 `unknown`、`default`、伪造或不支持的 OS/architecture。frozen `platformKey` 必须等于实际 runtime key。正式结果均绑定 `darwin-arm64-node24-npm11`。 |
| Reviewed-lock manifest | 单个 frozen case 曾未被自动绑定到完整 reviewed set，lock 或安装图可能与 manifest 漂移，甚至只验证当前 selection 子集。 | CLI 在任何正式 frozen run 前验证 selection 与 experimental 合计 8 个 case 的闭合集合；manifest 身份、case 数、配置归属、文件 inventory、每个 lock SHA-256、直接版本、registry origin/integrity 与 installed-graph SHA-256 均交叉验证。PASS 和 non-PASS 通过同一 `bindReviewedLockEvidence()` 路径绑定。每个正式 case 的观测 lock/graph digest 与同一 8-case manifest 一致。 |
| SHA-512 与本地路径误判 | 合法 npm `sha512-...` Base64 中的 `/` 曾被通用本地路径探测器误判；若粗放豁免整个字段，又可能放行真正的路径。 | 豁免仅允许出现在精确的 `report.cases[i].registry[j].integrity` 字段，并要求规范 Base64 且解码为 64-byte digest；其他字段中的绝对路径、`file:`、用户目录或路径形态仍拒绝。正式结果包含带 `/` 的合法 integrity，能够通过 canonical verifier，未扩大路径白名单。 |
| 报告中的本地路径与自报内容 | 非 PASS summary、evidence 或嵌套对象曾有机会夹带本机路径或未经约束的内容，造成隐私泄露和不可复核断言。 | 非 PASS actual summary 固定为 typed status/code/stage 投影；serializer 对整个 projected report 执行嵌入路径检查。stage 只保留 `<repo>`、`<workspace>`、`<case-root>` 等 token，case workspace、npm cache/npmrc、stdout/stderr、raw logs 与生成源码不进入发布报告。正式两份报告均通过路径与敏感内容检查。 |
| Numeric serializer | JavaScript `NaN`、`Infinity`、`-Infinity` 或超安全整数可能通过局部类型检查，随后被 `JSON.stringify()` 改写为 `null` 或失真，使 serializer 输出无法被自身 verifier 回读。 | serializer 输出前递归拒绝所有非有限数值与超出 `Number.MAX_SAFE_INTEGER` 的整数；artifact `size`、`createdAtMs`、generation counts/bytes，以及 stage `durationMs`、`exitCode`、stdout/stderr bytes 均有字段级约束。回归覆盖 `NaN`、`Infinity`、超安全整数，并验证 failure、PASS、frozen 三类报告 canonical round trip。 |

## 保留的五个 P2

### P2-1：时间证据尚未完全交叉验证

canonical verifier 对 provenance 的 run 起止时间已有规范 UTC 和先后检查，但 registry `observedAt` 与 stage `startedAt` 目前主要按字符串保留，尚未完整重算以下关系：

- `observedAt`、`startedAt` 是否都是 canonical UTC ISO instant；
- 每个时间是否位于 `runStartedAt` 与 `runCompletedAt` 之间；
- stage 是否按数组顺序单调开始；
- `startedAt + durationMs` 是否越过 run completion；
- registry observation 是否落在相应 registry stage 的时间范围；
- artifact `createdAtMs` 是否不早于本次 generation/run start，并且不晚于 completion 加文件系统容差。

因此，离线修改者理论上可以把 `observedAt` 或 `startedAt` 改成无效字符串，或把 artifact 时间改成 `0`、同时维持 `fresh: true` 和关联字段相等，再刷新 evidence refs；当前 verifier 对这些跨字段矛盾的拒绝仍不充分。真实 runner 会生成 ISO 时间，并在采集时根据 generation start 检查 mtime；这些字段也不会单独决定 PASS，所以评为 P2。后续应由 verifier 根据 run/stage 时间重新推导 freshness，而不是只信任 `fresh: true`。

### P2-2：运行时 SHA-512 校验弱于 canonical verifier

registry 采集层仍使用较宽松的 integrity 正则，lockfile 解析层主要检查 `sha512-` 前缀；最终 canonical verifier 才执行规范 Base64 与 64-byte digest 校验。无效 integrity 无法形成可发布的错误 PASS，但会较晚才失败，错误归因也不够精确。后续可让 registry 与 lockfile 层复用同一个 `isCanonicalSha512Integrity()`。

### P2-3：部分 Frozen PASS assertion 未直接引用 reviewed-lock digest

PASS evidence refs 中的 A03、A05、A07 会引用 lock、installed graph、registry 或 validation，但没有各自直接附带 `reviewed-lock:` digest。结构校验已经要求 reviewed lock 与实际 lock/graph 精确一致，所以当前不是完整性漏洞；增加直接引用可以改善人工审计时的证据导航与可读性。

### P2-4：提交报告脚本没有强制 JSON 唯一字节编码

`scripts/verify-committed-matrix-reports.mjs` 会验证 JSON 语义，并按已验证 JSON 逐字节重渲染 Markdown/JUnit，但尚未强制原始 JSON 字节等于 `serializeMatrixReport(parseAndVerifyReport(raw))`。因此，语义等价但重新缩进或改变键顺序的 JSON 仍可通过该脚本。当前提交候选中的两份 JSON 已另行验证为 canonical 原字节回环相等；这里保留的是脚本未来无法自动阻止格式漂移的问题。

### P2-5：Resolve 模式可接受无意义的 `--platform-key`

resolve 模式仍允许携带非空 platform key。它不会获得 reviewed-lock 身份，也不会改变 eligibility 或聚合决策，但会制造不必要的 provenance 语义噪声。后续应在参数层拒绝 resolve 与 `--platform-key` 的组合。

## 静态与回归验证

独立 reviewer 在最终 runner 快照上执行并确认：

| 命令 | 结果 |
| --- | --- |
| `cd tools/typert-version-matrix && npm run typecheck` | 通过 |
| `cd tools/typert-version-matrix && npm test` | 17 个测试文件、**271 个测试全部通过** |
| 针对 `tests/reports.test.ts` 的单文件回归 | **126 个测试全部通过** |
| `cd tools/typert-version-matrix && npm run verify:locks` | `VALID_LOCK_SET platform=darwin-arm64-node24-npm11 cases=8` |
| `git diff --check` | 通过 |

这些测试覆盖 frozen dry-run 的真实执行顺序、11/12-stage contract、direct failure code 重算、矛盾 evidence 拒绝、runtime 绑定、完整 manifest/lock/graph 漂移、SHA-512 精确豁免、本地路径拒绝、非有限数值与 canonical round trip。

## 正式 frozen runs 运行后复核

静态 P0/P1 清零后，从干净 source commit `d1cb6c6cb86374748001282fd7a6bbd8675f5ad0` 执行了两次正式 frozen run：

| Matrix | Run ID | Cases | Decision | Exit |
| --- | --- | ---: | --- | ---: |
| Selection | `2026-09-02-hardened-frozen-selection-darwin-arm64-01` | 5 | `NO_ELIGIBLE_CANDIDATE` | 1 |
| Experimental | `2026-09-02-hardened-frozen-experimental-darwin-arm64-01` | 3 | `EXPLORATORY_ONLY` | 1 |

运行后复核结果：

- 8/8 case 均完成为 `FAIL_COMPATIBILITY / GENERATION_EMPTY`，failure stage 为 `direct-generator`；不存在 incomplete 或 infrastructure-error case。
- 每个 fixture package 都被 discovery 精确发现一次，身份为 `@knight/dsh-typert-matrix-probe`、host face、`packages/probe`；但 automatic generation 为 `0`，forced generation 为 `0`，五个必需严格 Remote artifact 为 `0/5`。
- 每个 case 的 frozen dry-run、安装、安装图检查、TypeScript 编译、direct generator 与 tsdown stage 都有受约束的进程证据；普通 `lib/index.js` bundle 只作为 `decisive: false` 的诊断事实，不能替代严格 Remote artifact。
- 所有 case 都绑定同一个 8-case reviewed manifest；实际 lock SHA-256 与 installed-graph SHA-256 和 manifest 中逐 case 预期一致。
- 每个 case 的 `directGeneratorSummary.rawSourceIncluded` 都是 `false`；发布目录没有 case workspace、npm cache/npmrc、进程原始日志或生成源码。
- 两份 JSON 均通过 `verify-report` canonical semantic verifier；`verify-committed-matrix-reports.mjs` 返回 `VERIFIED_COMMITTED_MATRIX_REPORTS count=2`。
- 两份已发布 JSON 都与 `serializeMatrixReport(parseAndVerifyReport(raw))` 的输出原字节相等，再次 parse/serialize 的 round trip 也保持原字节；对应 Markdown 与 JUnit 均由已验证 JSON 在内存中重渲染并逐字节相等。
- 两个 exit `1` 都是矩阵策略结论：selection 没有 eligible candidate；experimental 证据即使完整也不参与自动选择。它们不是 runner 崩溃、超时或安装基础设施失败。

## 最终判断

最终审查结论维持 **P0 = 0、P1 = 0**。这批 frozen 报告足以支持以下窄结论：在 Darwin arm64、Node `24.14.0`、npm CLI `11.9.0`、固定 synthetic fixture 和 reviewed 依赖图下，所测 5 个 selection cohort 与 3 个 experimental cohort 都没有生成当前架构要求的严格 Typert Remote artifacts。

该结论**不等于** DeepSeek Harness 插件不可安装，也不等于这些版本对 Harness 普遍不兼容；它只否决了当前“必须由这些官方 Typert cohort 自动/强制生成五个严格 Remote artifact”这一条候选技术路径。尚未完成真实 Harness 的安装、挂载、UI、持久化、生命周期和涟漪主题共存验收，因此 **Gate A 保持 NO-GO**，不得进入完整 PM Workbench 实现或把本结果包装成可用插件证明。
