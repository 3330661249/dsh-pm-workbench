# 安装预览版

## 前提

- 已安装并可启动 DeepSeek Harness **0.1.0-rc.6**，`dsh --version` 可用。
- 首发支持范围限定为 **macOS 26 + Harness rc.6**（本机实测 26.6.2）。其他系统版本、平台与 Harness 版本尚未验证。
- 先备份自己的 Harness profile。首次试用建议使用独立的 `DSH_HOME`，不要复制密钥或真实材料到示例目录。
- 模型由你在 Harness 中配置，本插件不附带账号或额度。

## 使用 GitHub 预览附件

从本仓库 Releases 下载 `knight-dsh-pm-workbench-0.1.0.tgz`。在保存该文件的目录打开终端：

```sh
dsh plugin --profile web add ./knight-dsh-pm-workbench-0.1.0.tgz
```

rc.6 的插件命令会安装包，并把声明了 `dsh.bundle` 的包加入 profile 的 bundle 列表。正常关闭并重新启动原来的 Harness：

```sh
dsh web --host 127.0.0.1 --port 3080
```

打开本机页面，侧边栏应出现「AI PM 工作台」。如果已由其他进程占用 3080，请先正常关闭那个进程，或选择另一个端口，不要重复启动争抢端口。

**不要额外重复叠加同一插件的 `--patch`。** 如果你以前通过手工补丁安装过本插件，应先保留备份，再移除那个重复入口。

首次打开后选择示例材料或导入仓库里的虚构访谈。确认当前模型与费用后，再点击分析或生成。此命令已在独立 DSH_HOME 中用当前预览包实际安装，并在无模型账号、无涟漪插件的 rc.6 页面中打开工作台。该验证复用本机 Harness 安装与依赖缓存，不等于全新电脑验证；其他版本的加载方式可能不同。

## 从源码构建

在仓库根目录，使用 macOS 26 和官方 `.pkg` 内的 Node.js 24.14.0 / npm 11.9.0：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run typecheck
npm test
npm run build
npm run verify:package
npm pack ./packages/workbench --ignore-scripts
```

最后一条命令在当前目录生成 tgz。依照上面的插件安装命令安装它。源码构建产物与 GitHub 下载附件是不同构建，不要混淆它们的校验和。

## 卸载

正常停止 Harness 后运行：

```sh
dsh plugin --profile web remove @knight/dsh-pm-workbench
```

再按原方式启动 Harness。卸载不会删除工作台项目数据；数据仍保存在该 profile 对应的 Harness storage 中。不要为了卸载插件删除整个 Harness 数据目录。

## 常见问题

- **没有工作台入口**：确认装入的是启动时使用的 web profile；有自定义 `DSH_HOME` 时，安装与启动必须使用同一个值。
- **模型调用失败**：确认 Harness 模型路由、余额及联网状态；插件不会将失败悄悄替换为成功的模板结果。
- **Word 没有保存到桌面**：支持文件保存对话框的浏览器会建议桌面，其他浏览器使用自己的下载设置。
- **没有涟漪背景**：这是正常现象；涟漪是另一个项目，不属于此安装包。
