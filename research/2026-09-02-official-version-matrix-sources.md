# DeepSeek Harness Typert 官方版本矩阵：来源与候选锁定

核查日期：**2026-09-02（Asia/Shanghai）**
研究范围：只使用 `deepseek-ai/deepseek-harness` 官方 GitHub 仓库、其标签/提交/源码，以及 `https://registry.npmjs.org` 返回的 npm 官方 registry 元数据和官方 tarball。
本轮性质：**只读研究**。没有修改产品代码、没有安装到 Harness Profile、没有执行候选包代码、没有创建或修改远程仓库。

## 1. 结论摘要

1. 截至核查日，四个核心包共同存在 **11 个可精确安装的版本 cohort**。针对“rc.6 之后是否有官方版本解除阻塞”的主矩阵，应测 `0.1.0-rc.6` 到 `0.1.2-alpha.4` 共 **8 组**；更早的 `0.0.1-rc.5`、`0.1.0-rc.2`、`0.1.0-rc.3` 可作为低优先级降级诊断。[四包官方 packument：dsh](https://registry.npmjs.org/@deepseek-ai%2Fdsh)、[generator](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator)、[protocol](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-protocol)、[invariants](https://registry.npmjs.org/@deepseek-ai%2Fdsh-invariants)（核查：2026-09-02）
2. `0.1.2-alpha.1` 有官方 Git 标签，但四包版本列表中没有这个 npm 版本；对 `@deepseek-ai/dsh@0.1.2-alpha.1` 的官方 registry 精确查询返回 `E404`。它不是 npm 安装矩阵候选。[官方 alpha.1 标签](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.2-alpha.1)、[npm dsh packument](https://registry.npmjs.org/@deepseek-ai%2Fdsh)（核查：2026-09-02）
3. 不能使用裸包名、`latest` 或混合 dist-tag 安装矩阵。`dsh` 的 `latest` 是 `0.1.1-rc.2`，但 generator 与 invariants 的 `latest` 仍是 `0.0.1-rc.1`，protocol 的 `latest` 是 `0.1.0-rc.6`。所有矩阵项必须把四包和 Cordis 写成精确版本。[四包官方 packument](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator)（同上其余三包；核查：2026-09-02）
4. 从 `0.0.1-rc.5`、`0.1.0-rc.2`、`0.1.0-rc.3`、`0.1.0-rc.6` 的官方发布提交，到 rc.7、rc.8、1.1 rc、alpha.2–alpha.4 官方标签，再到核查日 `master`，`WorkspaceAnalyzer.isTypeMetaSymbol()` 的相关函数块内容完全相同；其 SHA-256 均为 `c330f4345eb9cfb49120c9ed8623aee3a1b60ec7ef01f1e513199e0f9433b634`。逻辑仍只接受“workspace registration 名称匹配”或“同名 ambient module”两条来源路径。[rc.6 analyzer](https://github.com/deepseek-ai/deepseek-harness/blob/15148dbd9a1d1f1ef1a26e5749b32af0cd663935/packages/typert/generator/src/analyzer.ts#L1805-L1820)、[alpha.4 analyzer](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/packages/typert/generator/src/analyzer.ts#L1839-L1854)（核查：2026-09-02）
5. 11 个官方 protocol tarball 的 `lib/types/index.d.ts` 都把 `Remote` 声明为普通导出，`declare module` 计数均为 0；没有出现能够命中上述第二条来源路径的 ambient wrapper。[protocol 官方 packument](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-protocol)、[rc.6 tarball](https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.0-rc.6.tgz)、[alpha.4 tarball](https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.2-alpha.4.tgz)（核查：2026-09-02）
6. 因而，**官方源码和已发布声明文件没有显示 npm package provenance 缺口已经修复**。这不是“八个候选已经实测失败”的结论；除 rc.6 外，其余版本仍必须运行同一份隔离探针，才能形成运行结果。[官方 Typert generator README](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/packages/typert/generator/README.md)、[官方 analyzer](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/packages/typert/generator/src/analyzer.ts#L1839-L1854)（核查：2026-09-02）

## 2. 证据边界与查询方法

### 2.1 registry 边界

本机 `npm config get registry` 返回 `https://registry.npmmirror.com`。该镜像结果没有被用作本文证据。所有正式查询都显式加入：

```bash
--registry https://registry.npmjs.org
```

官方 packument 与版本元数据入口：

- [`@deepseek-ai/dsh`](https://registry.npmjs.org/@deepseek-ai%2Fdsh)
- [`@deepseek-ai/dsh-typert-generator`](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator)
- [`@deepseek-ai/dsh-typert-protocol`](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-protocol)
- [`@deepseek-ai/dsh-invariants`](https://registry.npmjs.org/@deepseek-ai%2Fdsh-invariants)
- [`@deepseek-ai/cordis`](https://registry.npmjs.org/@deepseek-ai%2Fcordis)

以上入口均在 2026-09-02 重新查询。版本可用性以官方 registry packument 中的 `versions` 为准；许可证、依赖与完整性以 `/<exact-version>` 元数据和对应 tarball 为准。

### 2.2 GitHub 边界

官方 Git 标签从 `dsh-v0.1.0-rc.7` 开始。更早共同 cohort 通过官方提交历史中的 `release(dsh): <version>` 提交与该提交内的根 `package.json` 版本共同定位：

| 版本 | 官方源码坐标 | 说明 | 核查日期 |
| --- | --- | --- | --- |
| `0.0.1-rc.5` | [`3e8a1cfa`](https://github.com/deepseek-ai/deepseek-harness/commit/3e8a1cfa339e0c2dd1c233fe8179e42b1ed73945) | 发布提交；无同名公开 tag | 2026-09-02 |
| `0.1.0-rc.2` | [`60b04b6e`](https://github.com/deepseek-ai/deepseek-harness/commit/60b04b6ef73a2b7387e6887d19fe2276ff2630a0) | 发布提交；无同名公开 tag | 2026-09-02 |
| `0.1.0-rc.3` | [`8a954b2e`](https://github.com/deepseek-ai/deepseek-harness/commit/8a954b2eca50e4aa77c928d7ada40c0bff6135eb) | 发布提交；无同名公开 tag | 2026-09-02 |
| `0.1.0-rc.6` | [`15148dbd`](https://github.com/deepseek-ai/deepseek-harness/commit/15148dbd9a1d1f1ef1a26e5749b32af0cd663935) | 发布提交；无同名公开 tag | 2026-09-02 |
| `0.1.0-rc.7` | [`dsh-v0.1.0-rc.7`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.0-rc.7) → [`99f6f02f`](https://github.com/deepseek-ai/deepseek-harness/commit/99f6f02fecdb7dff40c3fbc9470f5907c29f74ca) | 官方 tag | 2026-09-02 |
| `0.1.0-rc.8` | [`dsh-v0.1.0-rc.8`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.0-rc.8) → [`141eb6fe`](https://github.com/deepseek-ai/deepseek-harness/commit/141eb6fef83422698aef7a981029e843e8161534) | 官方 tag | 2026-09-02 |
| `0.1.1-rc.1` | [`dsh-v0.1.1-rc.1`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.1-rc.1) → [`528c682e`](https://github.com/deepseek-ai/deepseek-harness/commit/528c682e061696f5a160f363f236ecbf53cbd006) | 官方 tag | 2026-09-02 |
| `0.1.1-rc.2` | [`dsh-v0.1.1-rc.2`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.1-rc.2) → [`b150a551`](https://github.com/deepseek-ai/deepseek-harness/commit/b150a551b8d465e31e418e1b2eaf5e79bbb7d28e) | 官方 tag | 2026-09-02 |
| `0.1.2-alpha.2` | [`dsh-v0.1.2-alpha.2`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.2-alpha.2) → [`0a53fb55`](https://github.com/deepseek-ai/deepseek-harness/commit/0a53fb55bea101816fa226bb964ae2bed71c343b) | 官方 tag | 2026-09-02 |
| `0.1.2-alpha.3` | [`dsh-v0.1.2-alpha.3`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.2-alpha.3) → [`dd6322d6`](https://github.com/deepseek-ai/deepseek-harness/commit/dd6322d604e00eec1ba5e0c8541159906a21094a) | 官方 tag | 2026-09-02 |
| `0.1.2-alpha.4` | [`dsh-v0.1.2-alpha.4`](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.2-alpha.4) → [`4e84901e`](https://github.com/deepseek-ai/deepseek-harness/commit/4e84901e6471b79ec0338099867ebb4606d12bb5) | 官方 tag；核查日 `master` 也是此提交 | 2026-09-02 |

早期发布提交与 npm tarball没有 `gitHead` 字段提供的密码学绑定，所以本文把二者分别记录为“同版本官方源码提交”和“官方 npm 工件”，不声称提交 SHA 就是 tarball 的可验证构建来源。

## 3. 官方 npm 可获得版本

| 包 | 官方 registry 中的版本 | dist-tags | 核查日期与来源 |
| --- | --- | --- | --- |
| `@deepseek-ai/dsh` | `0.0.1-rc.1`, `0.0.1-rc.2`, `0.0.1-rc.5`, `0.1.0-rc.2`, `0.1.0-rc.3`, `0.1.0-rc.6`, `0.1.0-rc.7`, `0.1.0-rc.8`, `0.1.1-rc.1`, `0.1.1-rc.2`, `0.1.2-alpha.2`, `0.1.2-alpha.3`, `0.1.2-alpha.4` | `latest=0.1.1-rc.2`, `next=0.1.1-rc.2`, `alpha=0.1.2-alpha.4` | [官方 packument](https://registry.npmjs.org/@deepseek-ai%2Fdsh), 2026-09-02 |
| `@deepseek-ai/dsh-typert-generator` | 与 dsh 相同的 13 个版本 | `latest=0.0.1-rc.1`, `next=0.1.1-rc.2`, `alpha=0.1.2-alpha.4` | [官方 packument](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator), 2026-09-02 |
| `@deepseek-ai/dsh-typert-protocol` | `0.0.1-rc.3`, `0.0.1-rc.5`, `0.1.0-rc.2`, `0.1.0-rc.3`, `0.1.0-rc.6`, `0.1.0-rc.7`, `0.1.0-rc.8`, `0.1.1-rc.1`, `0.1.1-rc.2`, `0.1.2-alpha.2`, `0.1.2-alpha.3`, `0.1.2-alpha.4` | `latest=0.1.0-rc.6`, `next=0.1.1-rc.2`, `alpha=0.1.2-alpha.4` | [官方 packument](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-protocol), 2026-09-02 |
| `@deepseek-ai/dsh-invariants` | 与 dsh 相同的 13 个版本 | `latest=0.0.1-rc.1`, `next=0.1.1-rc.2`, `alpha=0.1.2-alpha.4` | [官方 packument](https://registry.npmjs.org/@deepseek-ai%2Fdsh-invariants), 2026-09-02 |

四包的共同版本交集为：

```text
0.0.1-rc.5
0.1.0-rc.2
0.1.0-rc.3
0.1.0-rc.6
0.1.0-rc.7
0.1.0-rc.8
0.1.1-rc.1
0.1.1-rc.2
0.1.2-alpha.2
0.1.2-alpha.3
0.1.2-alpha.4
```

这是“可从官方 npm 同时取得四包”的交集，不代表这些版本都与当前 PM Workbench 骨架兼容。

## 4. Exact cohort 与工具链锁定

所有表格中的 `dsh / generator / protocol / invariants` 都必须使用该行的同一个 exact version。不要写 `^`、`~`、`latest`、`next` 或 `alpha`。

| 优先级 | cohort：四核心包 exact version | Cordis exact | TypeScript exact | tsdown exact | Node 约束 | 许可证 | 来源与核查日期 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 可选降级 | `0.0.1-rc.5` | `4.0.1-rc.4` | `6.0.3` | `0.22.2` | `^22.19.0 \|\| >=24.0.0` | DSH 四包 BSD-3-Clause；Cordis MIT | [发布提交](https://github.com/deepseek-ai/deepseek-harness/commit/3e8a1cfa339e0c2dd1c233fe8179e42b1ed73945)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.0.1-rc.5)，2026-09-02 |
| 可选降级 | `0.1.0-rc.2` | `4.0.1` | `6.0.3` | `0.22.2` | 同上 | MIT | [发布提交](https://github.com/deepseek-ai/deepseek-harness/commit/60b04b6ef73a2b7387e6887d19fe2276ff2630a0)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.0-rc.2)，2026-09-02 |
| 可选降级 | `0.1.0-rc.3` | `4.0.1` | `6.0.3` | `0.22.2` | 同上 | MIT | [发布提交](https://github.com/deepseek-ai/deepseek-harness/commit/8a954b2eca50e4aa77c928d7ada40c0bff6135eb)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.0-rc.3)，2026-09-02 |
| **基线** | `0.1.0-rc.6` | `4.0.1` | `6.0.3` | `0.22.2` | 同上 | MIT | [发布提交](https://github.com/deepseek-ai/deepseek-harness/commit/15148dbd9a1d1f1ef1a26e5749b32af0cd663935)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.0-rc.6)，2026-09-02 |
| 主矩阵 | `0.1.0-rc.7` | `4.0.1` | `6.0.3` | `0.22.2` | 同上 | MIT | [官方 tag](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.0-rc.7)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.0-rc.7)，2026-09-02 |
| 主矩阵 | `0.1.0-rc.8` | `4.0.1` | `6.0.3` | `0.22.2` | 同上 | MIT | [官方 tag](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.0-rc.8)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.0-rc.8)，2026-09-02 |
| 主矩阵 | `0.1.1-rc.1` | `4.0.1` | `6.0.3` | `0.22.2` | 同上 | MIT | [官方 tag](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.1-rc.1)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.1-rc.1)，2026-09-02 |
| 主矩阵 | `0.1.1-rc.2` | `4.0.1` | `6.0.3` | `0.22.2` | 同上 | MIT | [官方 tag](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.1-rc.2)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.1-rc.2)，2026-09-02 |
| 主矩阵 | `0.1.2-alpha.2` | `4.0.2` | `6.0.3` | `0.22.2` | 同上 | MIT | [官方 tag](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.2-alpha.2)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.2-alpha.2)，2026-09-02 |
| 主矩阵 | `0.1.2-alpha.3` | `4.0.2` | `6.0.3` | `0.22.2` | 同上 | MIT | [官方 tag](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.2-alpha.3)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.2-alpha.3)，2026-09-02 |
| 主矩阵 | `0.1.2-alpha.4` | `4.0.2` | `6.0.3` | `0.22.2` | 同上 | MIT | [官方 tag](https://github.com/deepseek-ai/deepseek-harness/tree/dsh-v0.1.2-alpha.4)、[generator npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.2-alpha.4)，2026-09-02 |

### 4.1 为什么锁这些工具版本

- 上述 11 个官方源码坐标的根 `package.json` 都声明 Node `^22.19.0 || >=24.0.0`、`packageManager: pnpm@11.7.0`、TypeScript `^6.0.3`、tsdown `^0.22.2`；其 `pnpm-lock.yaml` 的根 importer 均解析到 TypeScript `6.0.3`、tsdown `0.22.2` 和 tsx `4.22.4`。[rc.6 根 package.json](https://github.com/deepseek-ai/deepseek-harness/blob/15148dbd9a1d1f1ef1a26e5749b32af0cd663935/package.json)、[rc.6 锁文件](https://github.com/deepseek-ai/deepseek-harness/blob/15148dbd9a1d1f1ef1a26e5749b32af0cd663935/pnpm-lock.yaml)、[alpha.4 根 package.json](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/package.json)、[alpha.4 锁文件](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/pnpm-lock.yaml)（核查：2026-09-02）
- `tsdown@0.22.2` 自己要求 Node `^22.18.0 || >=24.0.0`，与 Harness 的 Node 约束取交集后仍是 Harness 的 `^22.19.0 || >=24.0.0`。[tsdown 0.22.2 官方 npm 元数据](https://registry.npmjs.org/tsdown/0.22.2)（核查：2026-09-02）
- `typescript@6.0.3` 是 generator 每个候选都声明的 `^6.0.3` 依赖，也是官方锁文件解析值。[TypeScript 6.0.3 官方 npm 元数据](https://registry.npmjs.org/typescript/6.0.3)、[generator alpha.4 npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.2-alpha.4)（核查：2026-09-02）
- 当前探针主机是 Node `v24.14.0`、npm `11.9.0`，满足上述约束。若构建官方源码，使用 `pnpm@11.7.0`；若只做外部 npm package 探针，可以继续用 npm，但必须生成独立 lockfile 并审计实际解析版本。
- generator 的官方源码开发依赖使用 `zod ^4.4.3`。若探针需要直接生成/加载 Zod schema，应继续精确锁 `zod@4.4.3`，避免让 Zod 漂移成为第二变量。[generator alpha.4 manifest](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/packages/typert/generator/package.json)、[zod 4.4.3 官方 npm 元数据](https://registry.npmjs.org/zod/4.4.3)（核查：2026-09-02）

### 4.2 Cordis 分界

- `0.0.1-rc.5` 官方源码使用 `@deepseek-ai/cordis@4.0.1-rc.4`。[rc.5 Cordis manifest](https://github.com/deepseek-ai/deepseek-harness/blob/3e8a1cfa339e0c2dd1c233fe8179e42b1ed73945/vendor/cordis/package.json)（核查：2026-09-02）
- `0.1.0-rc.2` 至 `0.1.1-rc.2` 官方源码使用 `@deepseek-ai/cordis@4.0.1`。[rc.6 Cordis manifest](https://github.com/deepseek-ai/deepseek-harness/blob/15148dbd9a1d1f1ef1a26e5749b32af0cd663935/vendor/cordis/package.json)、[Cordis 4.0.1 npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fcordis/4.0.1)（核查：2026-09-02）
- alpha.2 至 alpha.4 官方源码使用 `@deepseek-ai/cordis@4.0.2`。[alpha.4 Cordis manifest](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/vendor/cordis/package.json)、[Cordis 4.0.2 npm 元数据](https://registry.npmjs.org/@deepseek-ai%2Fcordis/4.0.2)（核查：2026-09-02）

虽然 peer range 允许更高的兼容版本，矩阵必须使用上述 exact 值，否则“Host 版本变化”和“Cordis 变化”会同时发生，无法解释结果。

### 4.3 alpha.4 的 peer 变化

`@deepseek-ai/dsh-typert-generator@0.1.2-alpha.4` 与 protocol alpha.4 已不再声明 `dsh-invariants` peer，只保留 Cordis；`@deepseek-ai/dsh-invariants@0.1.2-alpha.4` 仍是官方发布包。为保持版本列完整，矩阵可以安装同 cohort invariants，但不得写成“alpha.4 generator 必须依赖 invariants”。[generator alpha.4 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.1.2-alpha.4)、[protocol alpha.4 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-protocol/0.1.2-alpha.4)、[invariants alpha.4 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-invariants/0.1.2-alpha.4)（核查：2026-09-02）

## 5. npm package provenance 逻辑有没有变化

### 5.1 generator 侧

所有 11 个共同 cohort 及核查日 `master` 的 `isTypeMetaSymbol()` 都执行同一判断：

```ts
const registration = this.registrationForFile(declaration.getSourceFile().fileName)
if (registration?.name === '@deepseek-ai/dsh-typert-protocol') return true
for (let current = declaration; current !== undefined; current = optionalParent(current)) {
  if (ts.isModuleDeclaration(current)
    && ts.isStringLiteral(current.name)
    && current.name.text === '@deepseek-ai/dsh-typert-protocol') return true
}
return false
```

对应官方源码：[rc.5 analyzer](https://github.com/deepseek-ai/deepseek-harness/blob/3e8a1cfa339e0c2dd1c233fe8179e42b1ed73945/packages/typert/generator/src/analyzer.ts#L1805-L1820)、[rc.6 analyzer](https://github.com/deepseek-ai/deepseek-harness/blob/15148dbd9a1d1f1ef1a26e5749b32af0cd663935/packages/typert/generator/src/analyzer.ts#L1805-L1820)、[rc.7 analyzer](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.0-rc.7/packages/typert/generator/src/analyzer.ts#L1805-L1820)、[1.1-rc.2 analyzer](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.1-rc.2/packages/typert/generator/src/analyzer.ts#L1805-L1820)、[alpha.4 analyzer](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/packages/typert/generator/src/analyzer.ts#L1839-L1854)（核查：2026-09-02）。

没有看到以下任一变化：

- 根据声明文件所属 npm package 的 `package.json#name` 接受 protocol；
- 调用已有的 external-module identity 解析器来识别 `node_modules/@deepseek-ai/dsh-typert-protocol`；
- 把普通 `node_modules` protocol 注册为 workspace package。

因此，源码层面的结论是：**package provenance 判断没有变化。**

### 5.2 protocol 侧

11 个官方 npm protocol tarball 的 `lib/types/index.d.ts` 检查结果：

| 版本段 | `index.d.ts` SHA-256 | `declare module` | `export declare function Remote` | 核查日期与来源 |
| --- | --- | --- | --- | --- |
| `0.0.1-rc.5` 至 `0.1.1-rc.2` | `d13e3c6a6518b53861327b35c74db2753424bfa7e95cfbb8758e872f8230cc3b` | `0` | 存在 | [protocol packument](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-protocol)，2026-09-02 |
| `0.1.2-alpha.2` 至 `0.1.2-alpha.4` | `7d7ae5201508f41926a7c884ee5e154ae38fb8b1da5e4bdf861563e368eaf8a8` | `0` | 存在 | [alpha.2 元数据](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-protocol/0.1.2-alpha.2)、[alpha.4 tarball](https://registry.npmjs.org/@deepseek-ai/dsh-typert-protocol/-/dsh-typert-protocol-0.1.2-alpha.4.tgz)，2026-09-02 |

alpha 版本确实修改过 protocol 表面，例如 `Remote` 增加 stream 选项；但它仍是普通 module export，没有 ambient module 包装。[alpha.4 protocol 源码](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/packages/typert/protocol/src/index.ts#L154-L234)（核查：2026-09-02）

### 5.3 能说与不能说

可以说：

- 已发布候选与当前 master 中，造成 rc.6 provenance 失败的两个静态条件没有发生能够解除问题的变化。
- 源码审计没有找到“较新官方版本已修复”的证据。

不能说：

- “其余十个版本已经实测失败。”本轮没有运行它们的生成器。
- “只看源码即可跳过矩阵。”打包、tsdown plugin、workspace discovery、导出形状仍可能在不同版本发生别的变化；同一隔离探针仍然是最终证据。
- “alpha.4 可安全升级当前 Harness。”这还需要 Profile、Slot、Bundle、Remote runtime、涟漪插件共存等独立兼容性验证。

## 6. 许可证核实

| 范围 | 许可证 | 直接来源 | 核查日期 |
| --- | --- | --- | --- |
| DSH 四核心包 `0.0.1-rc.5` | BSD-3-Clause | [rc.5 根 LICENSE](https://github.com/deepseek-ai/deepseek-harness/blob/3e8a1cfa339e0c2dd1c233fe8179e42b1ed73945/LICENSE)、各包 exact npm 元数据，例如 [generator rc.5](https://registry.npmjs.org/@deepseek-ai%2Fdsh-typert-generator/0.0.1-rc.5) | 2026-09-02 |
| DSH 四核心包 `0.1.0-rc.2` 至 `0.1.2-alpha.4` | MIT | [rc.2 根 LICENSE](https://github.com/deepseek-ai/deepseek-harness/blob/60b04b6ef73a2b7387e6887d19fe2276ff2630a0/LICENSE)、[alpha.4 根 LICENSE](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/LICENSE)、各 exact npm 元数据 | 2026-09-02 |
| `@deepseek-ai/cordis@4.0.1-rc.4`, `4.0.1`, `4.0.2` | MIT | [vendored Cordis LICENSE](https://github.com/deepseek-ai/deepseek-harness/blob/dsh-v0.1.2-alpha.4/vendor/cordis/LICENSE)、[Cordis npm packument](https://registry.npmjs.org/@deepseek-ai%2Fcordis) | 2026-09-02 |
| TypeScript `6.0.3` | Apache-2.0 | [官方 npm 元数据](https://registry.npmjs.org/typescript/6.0.3) | 2026-09-02 |
| tsdown `0.22.2`, tsx `4.22.4`, zod `4.4.3` | MIT | [tsdown](https://registry.npmjs.org/tsdown/0.22.2)、[tsx](https://registry.npmjs.org/tsx/4.22.4)、[zod](https://registry.npmjs.org/zod/4.4.3) 官方 npm 元数据 | 2026-09-02 |

对 rc.6 与 alpha.4 抽样下载的 generator、protocol、invariants tarball均含 `package/LICENSE`，内容 SHA-256 是 `ebb4f09972aee8608be255debaf78451a68e95c290f55c240dec2ecfa16ea6be`，首行为 `MIT License`。这支持上述 npm manifest 结论，但公开分发 PM Workbench 时仍应生成自己的第三方通知并逐个保留许可证，不应把 Harness 的 MIT 直接当成 PM Workbench 自身已获准发布。

## 7. 给版本矩阵 runner 的约束

### 7.1 建议执行顺序

为尽快回答“有没有官方版本解除 rc.6 阻塞”，建议：

1. 重跑 `0.1.0-rc.6`，确认测试夹具没有漂移。
2. 测 `0.1.1-rc.2`：当前 `latest/next` 实际指向的候选。
3. 测 `0.1.2-alpha.4`：官方 npm 与 `master` 的最新 alpha 候选。
4. 再补 `rc.7`、`rc.8`、`1.1-rc.1`、`alpha.2`、`alpha.3`，形成连续时间线。
5. 只有用户希望验证“更早版本是否曾经可用”时，再跑 rc.5、rc.2、rc.3；它们的静态 provenance 逻辑也相同，且 rc.5 还是不同许可证和 prerelease Cordis，迁移价值较低。

### 7.2 fail-closed 规则

每个 cohort 应满足：

- 独立目录、独立 `node_modules`、独立 lockfile、独立 npm cache；
- 所有 DSH 坐标 exact pin，并检查 `npm ls --all` 没有其他 DSH cohort；
- 记录官方 registry 返回的 `dist.integrity` 与最终 lockfile integrity；
- 固定同一份 probe 源码、tsconfig、tsdown config 和断言；
- 同时记录 `discover()`、`analyze().invocations`、自动 `generate()`、强制 `generate([package])`；
- 必须断言五个目标文件存在，普通 bundle exit 0 不能算 Remote 成功；
- 不使用 `paths` 重定向、ambient shim、手写 descriptor、源码 vendoring、generator patch 或复制官方生成产物；
- 任一版本只有在生成、加载、Host/Client mount 和一次严格 JSON round trip 都通过后，才可成为新的 Gate A 候选。

## 8. 未确定项

1. **运行结果仍未确定**：除 rc.6 已有本地失败证据外，本研究不把源码相同等同于实际运行失败。
2. **npm tarball 与早期 release commit 的构建绑定不完整**：早期包没有 `gitHead`；本文只分别记录官方 npm artifact integrity 与官方同版本 release commit。
3. **alpha.4 不是稳定发布**：`alpha` dist-tag 指向它，但 `latest/next` 仍是 1.1 rc.2。即使 alpha.4 Remote 探针成功，也不能直接覆盖当前 rc.6 环境。
4. **更高版本可能随时发布**：本文是 2026-09-02 快照。开始下一次升级 PR 前必须重新查询四包 packument 与官方 tags。
5. **源码修复不等于第三方插件闭环修复**：即使以后 `isTypeMetaSymbol()` 接受 npm package identity，仍要单独验证生成 artifact、runtime module identity、Client `$mount`、Profile 安装/卸载和原涟漪插件共存。

## 9. 本研究的可复核命令

```bash
npm view '@deepseek-ai/dsh' version dist-tags versions time license repository --json \
  --registry https://registry.npmjs.org

npm view '@deepseek-ai/dsh-typert-generator@0.1.2-alpha.4' \
  name version license dist.integrity dist.tarball repository \
  peerDependencies dependencies --json \
  --registry https://registry.npmjs.org

npm view '@deepseek-ai/dsh@0.1.2-alpha.1' version --json \
  --registry https://registry.npmjs.org

git ls-remote --tags https://github.com/deepseek-ai/deepseek-harness.git
git ls-remote https://github.com/deepseek-ai/deepseek-harness.git refs/heads/master
```

最终候选矩阵不应从本文手抄版本字符串后直接运行；runner 应先用官方 registry 重新确认 exact version 存在，再对解析后的 lockfile 做一致性断言。
