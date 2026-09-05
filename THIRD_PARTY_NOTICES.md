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
