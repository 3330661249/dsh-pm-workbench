# Third-party notices

The research-reference table below retains the Phase 0 provenance baseline.
Its rows are **reference only**; no source from those reference projects was
copied into the package. Official version research retained in this repository
is linked explicitly below. No local
source snapshot, pinned revision, package artifact, or license audit was
retained for the community discovery references, so this notice makes no
community version or license claim.

| Source | Pinned revision or research observation | License status in Phase 0 | Copied code status | Package inclusion status |
| --- | --- | --- | --- | --- |
| Official [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) | Dated official-source observations are retained in [`research/2026-09-02-official-version-matrix-sources.md`](research/2026-09-02-official-version-matrix-sources.md); this notice does not pin one distributable source revision | Research reference only; recheck the applicable license at the exact source or artifact chosen before reuse/distribution | **reference only**; no code copied | **reference only**; no source or package included |
| Community [bugmaker2/dsh-plugin-template](https://github.com/bugmaker2/dsh-plugin-template) | Discovery reference only; no local snapshot or pinned revision | Not verified in this repository | **reference only**; no code copied | **reference only**; no source or package included |
| Community [loadingvx/deepseek-harness-workbench-plugin](https://github.com/loadingvx/deepseek-harness-workbench-plugin) | Discovery reference only; no local snapshot or pinned revision | Not verified in this repository | **reference only**; no code copied | **reference only**; no source or package included |
| Community [forrestahha/dsh-voice-input](https://github.com/forrestahha/dsh-voice-input) | Discovery reference only; no local snapshot or pinned revision | Not verified in this repository | **reference only**; no code copied | **reference only**; no source or package included |
| Community [Ephemeral-AI-Lab/dsh-plugins](https://github.com/Ephemeral-AI-Lab/dsh-plugins), possible `sessions` package | Discovery reference only; no local snapshot, pinned revision, or verified package identity | Not verified in this repository | **reference only**; no code copied | **reference only**; no source or package included |

Before reuse, adding a dependency, or producing a distributable package: pin the
specific source revision or published artifact, inspect its license at that
revision, record what is copied, and update this notice.

## Demo development dependency: @types/react-dom 18.3.7

The root development workspace uses exact `@types/react-dom@18.3.7` for
development-time React DOM TypeScript declarations only. It supplies no runtime
implementation, is not bundled into the browser Demo, and is not included in
the Harness package tarball. The runtime `react-dom` package is a separate
dependency; this notice concerns only the declarations package.

Installed artifact evidence inspected on 2026-09-05:

- `node_modules/@types/react-dom/package.json`: name `@types/react-dom`, version
  `18.3.7`, license `MIT`, description `TypeScript definitions for react-dom`,
  types entry `index.d.ts`, and an empty runtime `main` entry.
- `node_modules/@types/react-dom/LICENSE`: MIT License, copyright Microsoft
  Corporation; the installed artifact contains the license text.
- Root `package.json` pins this exact version in `devDependencies`.
  `package-lock.json` retains its matching integrity and official npm tarball URL.
- The Harness package's explicit file allowlist and package verification exclude
  `node_modules`, type declarations, and the standalone Demo output directory.

The declaration files remain in the installed development dependency; none were
copied into project source or added to the distributable Harness package.

## rc.6 declaration acceptance inputs

The following five npm packages are retained only as the frozen development and
type-verification input described by the accepted
[`package.json`](tools/harness-rc6-declarations/package.json) and its recorded
transitive closure in
[`research/2026-09-05-rc6-declaration-closure.json`](research/2026-09-05-rc6-declaration-closure.json).
They are not imported into the Workbench, included in its package contents, or
executed as a Harness runtime.

| Package | Accepted version | Published license claim | Retained purpose | Source |
| --- | --- | --- | --- | --- |
| `@deepseek-ai/dsh-client-connection` | `0.1.0-rc.6` | MIT, from the accepted public npm package manifest | Host/Client declaration verification input | [public npm package](https://www.npmjs.com/package/@deepseek-ai/dsh-client-connection) |
| `@deepseek-ai/dsh-client-runtime` | `0.1.0-rc.6` | MIT, from the accepted public npm package manifest | Client declaration verification input | [public npm package](https://www.npmjs.com/package/@deepseek-ai/dsh-client-runtime) |
| `@deepseek-ai/dsh-client-ui-layout` | `0.1.0-rc.6` | MIT, from the accepted public npm package manifest | Client declaration verification input | [public npm package](https://www.npmjs.com/package/@deepseek-ai/dsh-client-ui-layout) |
| `@deepseek-ai/dsh-client-ui-sidebar` | `0.1.0-rc.6` | MIT, from the accepted public npm package manifest | Client declaration verification input | [public npm package](https://www.npmjs.com/package/@deepseek-ai/dsh-client-ui-sidebar) |
| `@deepseek-ai/dsh-client-ui-slots` | `0.1.0-rc.6` | MIT, from the accepted public npm package manifest | Client declaration verification input | [public npm package](https://www.npmjs.com/package/@deepseek-ai/dsh-client-ui-slots) |

The accepted versions and integrity values are historical frozen-lock facts.
They do not establish a fresh resolver result, package-runtime compatibility,
or any Harness behavior.

## Bundled dependency: Zod 4.4.3

The root development workspace pins exact `zod@4.4.3`. The Stage 2 package
build bundles Zod into both the Host and Web Client outputs to enforce the
shared strict Probe schemas on both sides of Connection RPC. Zod has been
removed from the published package's runtime `dependencies`; its bundled code
remains governed by the following MIT license. This text is copied exactly from
the installed `node_modules/zod/LICENSE` artifact.

```text
MIT License

Copyright (c) 2025 Colin McDonnell

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
