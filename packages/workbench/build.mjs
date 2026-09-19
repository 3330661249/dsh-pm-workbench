import { createHash } from 'node:crypto'
import { constants } from 'node:fs'
import { lstat, mkdir, open, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { build, stop } from 'esbuild'
import { assertWorkbenchDemoWritePath, assertWorkbenchWritePath } from '../../scripts/workspace-boundary.ts'

const packageRoot = path.resolve(import.meta.dirname)
const repositoryRoot = path.resolve(packageRoot, '../..')
const demoTempRoot = path.join(repositoryRoot, '.tmp', 'dsh-pm-workbench')
const defaultDemoOutdir = path.join(demoTempRoot, 'demo')
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const sorted = values => [...values].sort(compare)
function fail(label = 'Product') { throw new Error(`${label} build graph contract invalid`) }
function number(value) { if (!Number.isSafeInteger(value) || value < 0 || Object.is(value, -0)) fail() }
function keys(value, required, optional = []) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || required.some(key => !Object.hasOwn(value, key))
    || Object.keys(value).some(key => ![...required, ...optional].includes(key))) fail()
}

// Literal C23 contract, manually reviewed against Task 10; never learned at runtime.
const zodInputs = new Set([
  "node_modules/zod/index.js",
  "node_modules/zod/v4/classic/checks.js",
  "node_modules/zod/v4/classic/coerce.js",
  "node_modules/zod/v4/classic/compat.js",
  "node_modules/zod/v4/classic/errors.js",
  "node_modules/zod/v4/classic/external.js",
  "node_modules/zod/v4/classic/from-json-schema.js",
  "node_modules/zod/v4/classic/iso.js",
  "node_modules/zod/v4/classic/parse.js",
  "node_modules/zod/v4/classic/schemas.js",
  "node_modules/zod/v4/core/api.js",
  "node_modules/zod/v4/core/checks.js",
  "node_modules/zod/v4/core/core.js",
  "node_modules/zod/v4/core/doc.js",
  "node_modules/zod/v4/core/errors.js",
  "node_modules/zod/v4/core/index.js",
  "node_modules/zod/v4/core/json-schema-generator.js",
  "node_modules/zod/v4/core/json-schema-processors.js",
  "node_modules/zod/v4/core/json-schema.js",
  "node_modules/zod/v4/core/parse.js",
  "node_modules/zod/v4/core/regexes.js",
  "node_modules/zod/v4/core/registries.js",
  "node_modules/zod/v4/core/schemas.js",
  "node_modules/zod/v4/core/to-json-schema.js",
  "node_modules/zod/v4/core/util.js",
  "node_modules/zod/v4/core/versions.js",
  "node_modules/zod/v4/locales/ar.js",
  "node_modules/zod/v4/locales/az.js",
  "node_modules/zod/v4/locales/be.js",
  "node_modules/zod/v4/locales/bg.js",
  "node_modules/zod/v4/locales/ca.js",
  "node_modules/zod/v4/locales/cs.js",
  "node_modules/zod/v4/locales/da.js",
  "node_modules/zod/v4/locales/de.js",
  "node_modules/zod/v4/locales/el.js",
  "node_modules/zod/v4/locales/en.js",
  "node_modules/zod/v4/locales/eo.js",
  "node_modules/zod/v4/locales/es.js",
  "node_modules/zod/v4/locales/fa.js",
  "node_modules/zod/v4/locales/fi.js",
  "node_modules/zod/v4/locales/fr-CA.js",
  "node_modules/zod/v4/locales/fr.js",
  "node_modules/zod/v4/locales/he.js",
  "node_modules/zod/v4/locales/hr.js",
  "node_modules/zod/v4/locales/hu.js",
  "node_modules/zod/v4/locales/hy.js",
  "node_modules/zod/v4/locales/id.js",
  "node_modules/zod/v4/locales/index.js",
  "node_modules/zod/v4/locales/is.js",
  "node_modules/zod/v4/locales/it.js",
  "node_modules/zod/v4/locales/ja.js",
  "node_modules/zod/v4/locales/ka.js",
  "node_modules/zod/v4/locales/kh.js",
  "node_modules/zod/v4/locales/km.js",
  "node_modules/zod/v4/locales/ko.js",
  "node_modules/zod/v4/locales/lt.js",
  "node_modules/zod/v4/locales/mk.js",
  "node_modules/zod/v4/locales/ms.js",
  "node_modules/zod/v4/locales/nl.js",
  "node_modules/zod/v4/locales/no.js",
  "node_modules/zod/v4/locales/ota.js",
  "node_modules/zod/v4/locales/pl.js",
  "node_modules/zod/v4/locales/ps.js",
  "node_modules/zod/v4/locales/pt.js",
  "node_modules/zod/v4/locales/ro.js",
  "node_modules/zod/v4/locales/ru.js",
  "node_modules/zod/v4/locales/sl.js",
  "node_modules/zod/v4/locales/sv.js",
  "node_modules/zod/v4/locales/ta.js",
  "node_modules/zod/v4/locales/th.js",
  "node_modules/zod/v4/locales/tr.js",
  "node_modules/zod/v4/locales/ua.js",
  "node_modules/zod/v4/locales/uk.js",
  "node_modules/zod/v4/locales/ur.js",
  "node_modules/zod/v4/locales/uz.js",
  "node_modules/zod/v4/locales/vi.js",
  "node_modules/zod/v4/locales/yo.js",
  "node_modules/zod/v4/locales/zh-CN.js",
  "node_modules/zod/v4/locales/zh-TW.js"
])
const hostApplicationInputs = new Set([
  "packages/workbench/skills/create-prd/SKILL.md",
  "packages/workbench/src/analysis/create-prd-renderer.ts",
  "packages/workbench/src/analysis/fixture-engine.ts",
  "packages/workbench/src/analysis/fixture-manifest.ts",
  "packages/workbench/src/analysis/harness-model-engine.ts",
  "packages/workbench/src/analysis/types.ts",
  "packages/workbench/src/application/clock.ts",
  "packages/workbench/src/application/node-sha256.ts",
  "packages/workbench/src/application/product-handler.ts",
  "packages/workbench/src/application/project-repository.ts",
  "packages/workbench/src/application/project-service.ts",
  "packages/workbench/src/application/project-views.ts",
  "packages/workbench/src/application/receipts.ts",
  "packages/workbench/src/config.ts",
  "packages/workbench/src/domain/baseline.ts",
  "packages/workbench/src/domain/evidence.ts",
  "packages/workbench/src/domain/ids.ts",
  "packages/workbench/src/domain/limits.ts",
  "packages/workbench/src/domain/model.ts",
  "packages/workbench/src/domain/prd.ts",
  "packages/workbench/src/domain/requirements.ts",
  "packages/workbench/src/domain/text.ts",
  "packages/workbench/src/index.ts",
  "packages/workbench/src/integration/harness-rc6/cordis-analysis-port.ts",
  "packages/workbench/src/integration/harness-rc6/product-host.ts",
  "packages/workbench/src/integration/harness-rc6/project-domain.ts",
  "packages/workbench/src/integration/harness-rc6/subagent-analysis-runner.ts",
  "packages/workbench/src/integration/harness-rc6/subagent-prd-runner.ts",
  "packages/workbench/src/integration/harness-rc6/validation-domain.ts",
  "packages/workbench/src/protocol/canonical-json.ts",
  "packages/workbench/src/protocol/product.ts",
  "packages/workbench/src/validation/model.ts",
  "packages/workbench/src/validation/runner.ts",
  "packages/workbench/src/validation/service.ts"
])
const clientApplicationInputs = new Set([
  "packages/workbench/src/analysis/fixture-manifest.ts",
  "packages/workbench/src/analysis/types.ts",
  "packages/workbench/src/application/project-views.ts",
  "packages/workbench/src/client/index.tsx",
  "packages/workbench/src/client/workbench/MaterialPane.tsx",
  "packages/workbench/src/client/workbench/PrdPane.tsx",
  "packages/workbench/src/client/workbench/PriorityPane.tsx",
  "packages/workbench/src/client/workbench/ProjectList.tsx",
  "packages/workbench/src/client/workbench/RequirementsPane.tsx",
  "packages/workbench/src/client/workbench/ValidationPane.tsx",
  "packages/workbench/src/client/workbench/WorkbenchView.tsx",
  "packages/workbench/src/client/workbench/browser-port.ts",
  "packages/workbench/src/client/workbench/docx-input.ts",
  "packages/workbench/src/client/workbench/handoff-export.ts",
  "packages/workbench/src/client/workbench/material-input.ts",
  "packages/workbench/src/client/workbench/store.ts",
  "packages/workbench/src/client/workbench/styles.ts",
  "packages/workbench/src/client/workbench/transport.ts",
  "packages/workbench/src/client/workbench/validation-client.ts",
  "packages/workbench/src/client/workbench/validation-styles.ts",
  "packages/workbench/src/client/workbench/web-sha256.ts",
  "packages/workbench/src/domain/ids.ts",
  "packages/workbench/src/domain/limits.ts",
  "packages/workbench/src/domain/model.ts",
  "packages/workbench/src/domain/text.ts",
  "packages/workbench/src/protocol/canonical-json.ts",
  "packages/workbench/src/protocol/product.ts",
  "packages/workbench/src/validation/model.ts"
])
const reviewedImports = {
  "packages/workbench/skills/create-prd/SKILL.md": [],
  "packages/workbench/src/analysis/create-prd-renderer.ts": [["node_modules/zod/index.js","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false],["packages/workbench/src/domain/prd.ts","import-statement",false]],
  "packages/workbench/src/integration/harness-rc6/subagent-prd-runner.ts": [["packages/workbench/src/analysis/create-prd-renderer.ts","import-statement",false],["packages/workbench/src/analysis/types.ts","import-statement",false]],
  "node_modules/zod/index.js": [["node_modules/zod/v4/classic/external.js","import-statement",false],["node_modules/zod/v4/classic/external.js","import-statement",false]],
  "node_modules/zod/v4/classic/checks.js": [["node_modules/zod/v4/core/index.js","import-statement",false]],
  "node_modules/zod/v4/classic/coerce.js": [["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/classic/schemas.js","import-statement",false]],
  "node_modules/zod/v4/classic/compat.js": [["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/core/index.js","import-statement",false]],
  "node_modules/zod/v4/classic/errors.js": [["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/classic/external.js": [["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/classic/schemas.js","import-statement",false],["node_modules/zod/v4/classic/checks.js","import-statement",false],["node_modules/zod/v4/classic/errors.js","import-statement",false],["node_modules/zod/v4/classic/parse.js","import-statement",false],["node_modules/zod/v4/classic/compat.js","import-statement",false],["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/locales/en.js","import-statement",false],["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/core/json-schema-processors.js","import-statement",false],["node_modules/zod/v4/classic/from-json-schema.js","import-statement",false],["node_modules/zod/v4/locales/index.js","import-statement",false],["node_modules/zod/v4/classic/iso.js","import-statement",false],["node_modules/zod/v4/classic/iso.js","import-statement",false],["node_modules/zod/v4/classic/coerce.js","import-statement",false]],
  "node_modules/zod/v4/classic/from-json-schema.js": [["node_modules/zod/v4/core/registries.js","import-statement",false],["node_modules/zod/v4/classic/checks.js","import-statement",false],["node_modules/zod/v4/classic/iso.js","import-statement",false],["node_modules/zod/v4/classic/schemas.js","import-statement",false]],
  "node_modules/zod/v4/classic/iso.js": [["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/classic/schemas.js","import-statement",false]],
  "node_modules/zod/v4/classic/parse.js": [["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/classic/errors.js","import-statement",false]],
  "node_modules/zod/v4/classic/schemas.js": [["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/core/index.js","import-statement",false],["node_modules/zod/v4/core/json-schema-processors.js","import-statement",false],["node_modules/zod/v4/core/to-json-schema.js","import-statement",false],["node_modules/zod/v4/classic/checks.js","import-statement",false],["node_modules/zod/v4/classic/iso.js","import-statement",false],["node_modules/zod/v4/classic/parse.js","import-statement",false]],
  "node_modules/zod/v4/core/api.js": [["node_modules/zod/v4/core/checks.js","import-statement",false],["node_modules/zod/v4/core/registries.js","import-statement",false],["node_modules/zod/v4/core/schemas.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/core/checks.js": [["node_modules/zod/v4/core/core.js","import-statement",false],["node_modules/zod/v4/core/regexes.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/core/core.js": [],
  "node_modules/zod/v4/core/doc.js": [],
  "node_modules/zod/v4/core/errors.js": [["node_modules/zod/v4/core/core.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/core/index.js": [["node_modules/zod/v4/core/core.js","import-statement",false],["node_modules/zod/v4/core/parse.js","import-statement",false],["node_modules/zod/v4/core/errors.js","import-statement",false],["node_modules/zod/v4/core/schemas.js","import-statement",false],["node_modules/zod/v4/core/checks.js","import-statement",false],["node_modules/zod/v4/core/versions.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false],["node_modules/zod/v4/core/regexes.js","import-statement",false],["node_modules/zod/v4/locales/index.js","import-statement",false],["node_modules/zod/v4/core/registries.js","import-statement",false],["node_modules/zod/v4/core/doc.js","import-statement",false],["node_modules/zod/v4/core/api.js","import-statement",false],["node_modules/zod/v4/core/to-json-schema.js","import-statement",false],["node_modules/zod/v4/core/json-schema-processors.js","import-statement",false],["node_modules/zod/v4/core/json-schema-generator.js","import-statement",false],["node_modules/zod/v4/core/json-schema.js","import-statement",false]],
  "node_modules/zod/v4/core/json-schema-generator.js": [["node_modules/zod/v4/core/json-schema-processors.js","import-statement",false],["node_modules/zod/v4/core/to-json-schema.js","import-statement",false]],
  "node_modules/zod/v4/core/json-schema-processors.js": [["node_modules/zod/v4/core/to-json-schema.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/core/json-schema.js": [],
  "node_modules/zod/v4/core/parse.js": [["node_modules/zod/v4/core/core.js","import-statement",false],["node_modules/zod/v4/core/errors.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/core/regexes.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/core/registries.js": [],
  "node_modules/zod/v4/core/schemas.js": [["node_modules/zod/v4/core/checks.js","import-statement",false],["node_modules/zod/v4/core/core.js","import-statement",false],["node_modules/zod/v4/core/doc.js","import-statement",false],["node_modules/zod/v4/core/parse.js","import-statement",false],["node_modules/zod/v4/core/regexes.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false],["node_modules/zod/v4/core/versions.js","import-statement",false],["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/core/to-json-schema.js": [["node_modules/zod/v4/core/registries.js","import-statement",false]],
  "node_modules/zod/v4/core/util.js": [["node_modules/zod/v4/core/core.js","import-statement",false]],
  "node_modules/zod/v4/core/versions.js": [],
  "node_modules/zod/v4/locales/ar.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/az.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/be.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/bg.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ca.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/cs.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/da.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/de.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/el.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/en.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/eo.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/es.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/fa.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/fi.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/fr-CA.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/fr.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/he.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/hr.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/hu.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/hy.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/id.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/index.js": [["node_modules/zod/v4/locales/ar.js","import-statement",false],["node_modules/zod/v4/locales/az.js","import-statement",false],["node_modules/zod/v4/locales/be.js","import-statement",false],["node_modules/zod/v4/locales/bg.js","import-statement",false],["node_modules/zod/v4/locales/ca.js","import-statement",false],["node_modules/zod/v4/locales/cs.js","import-statement",false],["node_modules/zod/v4/locales/da.js","import-statement",false],["node_modules/zod/v4/locales/de.js","import-statement",false],["node_modules/zod/v4/locales/el.js","import-statement",false],["node_modules/zod/v4/locales/en.js","import-statement",false],["node_modules/zod/v4/locales/eo.js","import-statement",false],["node_modules/zod/v4/locales/es.js","import-statement",false],["node_modules/zod/v4/locales/fa.js","import-statement",false],["node_modules/zod/v4/locales/fi.js","import-statement",false],["node_modules/zod/v4/locales/fr.js","import-statement",false],["node_modules/zod/v4/locales/fr-CA.js","import-statement",false],["node_modules/zod/v4/locales/he.js","import-statement",false],["node_modules/zod/v4/locales/hr.js","import-statement",false],["node_modules/zod/v4/locales/hu.js","import-statement",false],["node_modules/zod/v4/locales/hy.js","import-statement",false],["node_modules/zod/v4/locales/id.js","import-statement",false],["node_modules/zod/v4/locales/is.js","import-statement",false],["node_modules/zod/v4/locales/it.js","import-statement",false],["node_modules/zod/v4/locales/ja.js","import-statement",false],["node_modules/zod/v4/locales/ka.js","import-statement",false],["node_modules/zod/v4/locales/kh.js","import-statement",false],["node_modules/zod/v4/locales/km.js","import-statement",false],["node_modules/zod/v4/locales/ko.js","import-statement",false],["node_modules/zod/v4/locales/lt.js","import-statement",false],["node_modules/zod/v4/locales/mk.js","import-statement",false],["node_modules/zod/v4/locales/ms.js","import-statement",false],["node_modules/zod/v4/locales/nl.js","import-statement",false],["node_modules/zod/v4/locales/no.js","import-statement",false],["node_modules/zod/v4/locales/ota.js","import-statement",false],["node_modules/zod/v4/locales/ps.js","import-statement",false],["node_modules/zod/v4/locales/pl.js","import-statement",false],["node_modules/zod/v4/locales/pt.js","import-statement",false],["node_modules/zod/v4/locales/ro.js","import-statement",false],["node_modules/zod/v4/locales/ru.js","import-statement",false],["node_modules/zod/v4/locales/sl.js","import-statement",false],["node_modules/zod/v4/locales/sv.js","import-statement",false],["node_modules/zod/v4/locales/ta.js","import-statement",false],["node_modules/zod/v4/locales/th.js","import-statement",false],["node_modules/zod/v4/locales/tr.js","import-statement",false],["node_modules/zod/v4/locales/ua.js","import-statement",false],["node_modules/zod/v4/locales/uk.js","import-statement",false],["node_modules/zod/v4/locales/ur.js","import-statement",false],["node_modules/zod/v4/locales/uz.js","import-statement",false],["node_modules/zod/v4/locales/vi.js","import-statement",false],["node_modules/zod/v4/locales/zh-CN.js","import-statement",false],["node_modules/zod/v4/locales/zh-TW.js","import-statement",false],["node_modules/zod/v4/locales/yo.js","import-statement",false]],
  "node_modules/zod/v4/locales/is.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/it.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ja.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ka.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/kh.js": [["node_modules/zod/v4/locales/km.js","import-statement",false]],
  "node_modules/zod/v4/locales/km.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ko.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/lt.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/mk.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ms.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/nl.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/no.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ota.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/pl.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ps.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/pt.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ro.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ru.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/sl.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/sv.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ta.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/th.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/tr.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ua.js": [["node_modules/zod/v4/locales/uk.js","import-statement",false]],
  "node_modules/zod/v4/locales/uk.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/ur.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/uz.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/vi.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/yo.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/zh-CN.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "node_modules/zod/v4/locales/zh-TW.js": [["node_modules/zod/v4/core/util.js","import-statement",false]],
  "packages/workbench/src/analysis/fixture-engine.ts": [["packages/workbench/src/domain/evidence.ts","import-statement",false],["packages/workbench/src/analysis/types.ts","import-statement",false]],
  "packages/workbench/src/analysis/fixture-manifest.ts": [["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/analysis/types.ts","import-statement",false]],
  "packages/workbench/src/analysis/harness-model-engine.ts": [["node_modules/zod/index.js","import-statement",false],["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/domain/evidence.ts","import-statement",false],["packages/workbench/src/analysis/types.ts","import-statement",false]],
  "packages/workbench/src/analysis/types.ts": [],
  "packages/workbench/src/application/clock.ts": [],
  "packages/workbench/src/application/node-sha256.ts": [["node:crypto","import-statement",true],["packages/workbench/src/domain/ids.ts","import-statement",false]],
  "packages/workbench/src/application/product-handler.ts": [["packages/workbench/src/protocol/product.ts","import-statement",false]],
  "packages/workbench/src/application/project-repository.ts": [["node:crypto","import-statement",true],["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false],["packages/workbench/src/domain/requirements.ts","import-statement",false],["packages/workbench/src/domain/baseline.ts","import-statement",false],["packages/workbench/src/domain/prd.ts","import-statement",false],["packages/workbench/src/domain/text.ts","import-statement",false],["packages/workbench/src/domain/evidence.ts","import-statement",false],["packages/workbench/src/protocol/canonical-json.ts","import-statement",false],["packages/workbench/src/protocol/product.ts","import-statement",false],["packages/workbench/src/application/clock.ts","import-statement",false],["packages/workbench/src/application/project-views.ts","import-statement",false],["packages/workbench/src/application/receipts.ts","import-statement",false]],
  "packages/workbench/src/application/project-service.ts": [["packages/workbench/src/protocol/product.ts","import-statement",false],["./project-repository.js","import-statement",true],["packages/workbench/src/application/project-views.ts","import-statement",false]],
  "packages/workbench/src/application/project-views.ts": [["node_modules/zod/index.js","import-statement",false],["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false]],
  "packages/workbench/src/application/receipts.ts": [["packages/workbench/src/domain/model.ts","import-statement",false],["packages/workbench/src/protocol/canonical-json.ts","import-statement",false],["packages/workbench/src/protocol/product.ts","import-statement",false]],
  "packages/workbench/src/client/index.tsx": [["react","import-statement",true],["packages/workbench/src/client/workbench/WorkbenchView.tsx","import-statement",false],["packages/workbench/src/client/workbench/store.ts","import-statement",false],["packages/workbench/src/client/workbench/transport.ts","import-statement",false],["packages/workbench/src/client/workbench/browser-port.ts","import-statement",false],["packages/workbench/src/client/workbench/validation-client.ts","import-statement",false],["react/jsx-runtime","import-statement",true]],
  "packages/workbench/src/client/workbench/MaterialPane.tsx": [["react","import-statement",true],["packages/workbench/src/analysis/fixture-manifest.ts","import-statement",false],["packages/workbench/src/client/workbench/material-input.ts","import-statement",false],["react/jsx-runtime","import-statement",true]],
  "packages/workbench/src/client/workbench/PrdPane.tsx": [["react/jsx-runtime","import-statement",true]],
  "packages/workbench/src/client/workbench/PriorityPane.tsx": [["packages/workbench/src/client/workbench/RequirementsPane.tsx","import-statement",false],["react/jsx-runtime","import-statement",true]],
  "packages/workbench/src/client/workbench/ProjectList.tsx": [["react","import-statement",true],["packages/workbench/src/client/workbench/styles.ts","import-statement",false],["react/jsx-runtime","import-statement",true]],
  "packages/workbench/src/client/workbench/RequirementsPane.tsx": [["react","import-statement",true],["react/jsx-runtime","import-statement",true]],
  "packages/workbench/src/client/workbench/WorkbenchView.tsx": [["react","import-statement",true],["packages/workbench/src/protocol/product.ts","import-statement",false],["packages/workbench/src/client/workbench/ProjectList.tsx","import-statement",false],["packages/workbench/src/client/workbench/MaterialPane.tsx","import-statement",false],["packages/workbench/src/client/workbench/RequirementsPane.tsx","import-statement",false],["packages/workbench/src/client/workbench/PriorityPane.tsx","import-statement",false],["packages/workbench/src/client/workbench/PrdPane.tsx","import-statement",false],["packages/workbench/src/client/workbench/styles.ts","import-statement",false],["packages/workbench/src/client/workbench/ValidationPane.tsx","import-statement",false],["packages/workbench/src/client/workbench/validation-styles.ts","import-statement",false],["react/jsx-runtime","import-statement",true]],
  "packages/workbench/src/client/workbench/browser-port.ts": [["packages/workbench/src/client/workbench/transport.ts","import-statement",false]],
  "packages/workbench/src/client/workbench/material-input.ts": [["packages/workbench/src/analysis/fixture-manifest.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/domain/text.ts","import-statement",false],["packages/workbench/src/client/workbench/web-sha256.ts","import-statement",false],["packages/workbench/src/client/workbench/docx-input.ts","import-statement",false]],
  "packages/workbench/src/client/workbench/store.ts": [["packages/workbench/src/protocol/product.ts","import-statement",false],["packages/workbench/src/protocol/canonical-json.ts","import-statement",false],["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/client/workbench/transport.ts","import-statement",false],["packages/workbench/src/client/workbench/material-input.ts","import-statement",false]],
  "packages/workbench/src/client/workbench/styles.ts": [],
  "packages/workbench/src/client/workbench/transport.ts": [["packages/workbench/src/analysis/fixture-manifest.ts","import-statement",false],["packages/workbench/src/protocol/product.ts","import-statement",false],["packages/workbench/src/client/workbench/web-sha256.ts","import-statement",false]],
  "packages/workbench/src/client/workbench/web-sha256.ts": [["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false]],
  "packages/workbench/src/config.ts": [],
  "packages/workbench/src/domain/baseline.ts": [["packages/workbench/src/domain/evidence.ts","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false]],
  "packages/workbench/src/domain/evidence.ts": [["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false],["packages/workbench/src/domain/text.ts","import-statement",false]],
  "packages/workbench/src/domain/ids.ts": [["node_modules/zod/index.js","import-statement",false]],
  "packages/workbench/src/domain/limits.ts": [],
  "packages/workbench/src/domain/model.ts": [["node_modules/zod/index.js","import-statement",false],["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/protocol/canonical-json.ts","import-statement",false]],
  "packages/workbench/src/domain/prd.ts": [["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false]],
  "packages/workbench/src/domain/requirements.ts": [["packages/workbench/src/domain/evidence.ts","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false]],
  "packages/workbench/src/domain/text.ts": [["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false]],
  "packages/workbench/src/index.ts": [["packages/workbench/src/config.ts","import-statement",false],["packages/workbench/src/integration/harness-rc6/product-host.ts","import-statement",false]],
  "packages/workbench/src/integration/harness-rc6/cordis-analysis-port.ts": [["node:crypto","import-statement",true],["@deepseek-ai/dsh-agent-default-model","import-statement",true],["@deepseek-ai/dsh-session","import-statement",true],["@deepseek-ai/dsh-tools","import-statement",true]],
  "packages/workbench/src/integration/harness-rc6/product-host.ts": [["node:crypto","import-statement",true],["packages/workbench/skills/create-prd/SKILL.md","import-statement",false],["packages/workbench/src/analysis/create-prd-renderer.ts","import-statement",false],["packages/workbench/src/analysis/fixture-engine.ts","import-statement",false],["packages/workbench/src/analysis/harness-model-engine.ts","import-statement",false],["packages/workbench/src/analysis/fixture-manifest.ts","import-statement",false],["packages/workbench/src/analysis/types.ts","import-statement",false],["packages/workbench/src/application/node-sha256.ts","import-statement",false],["packages/workbench/src/application/product-handler.ts","import-statement",false],["packages/workbench/src/application/project-repository.ts","import-statement",false],["packages/workbench/src/application/project-service.ts","import-statement",false],["packages/workbench/src/protocol/product.ts","import-statement",false],["packages/workbench/src/integration/harness-rc6/cordis-analysis-port.ts","import-statement",false],["packages/workbench/src/integration/harness-rc6/project-domain.ts","import-statement",false],["packages/workbench/src/integration/harness-rc6/subagent-analysis-runner.ts","import-statement",false],["packages/workbench/src/integration/harness-rc6/subagent-prd-runner.ts","import-statement",false],["packages/workbench/src/integration/harness-rc6/validation-domain.ts","import-statement",false],["packages/workbench/src/validation/service.ts","import-statement",false],["packages/workbench/src/validation/runner.ts","import-statement",false],["packages/workbench/src/validation/model.ts","import-statement",false],["packages/workbench/src/integration/harness-rc6/project-domain.ts","import-statement",false]],
  "packages/workbench/src/integration/harness-rc6/project-domain.ts": [["@deepseek-ai/dsh-storage-domain","import-statement",true],["packages/workbench/src/domain/model.ts","import-statement",false]],
  "packages/workbench/src/integration/harness-rc6/subagent-analysis-runner.ts": [["packages/workbench/src/analysis/harness-model-engine.ts","import-statement",false],["packages/workbench/src/analysis/types.ts","import-statement",false]],
  "packages/workbench/src/protocol/canonical-json.ts": [["packages/workbench/src/domain/limits.ts","import-statement",false]],
  "packages/workbench/src/protocol/product.ts": [["node_modules/zod/index.js","import-statement",false],["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/domain/model.ts","import-statement",false],["packages/workbench/src/domain/limits.ts","import-statement",false],["packages/workbench/src/application/project-views.ts","import-statement",false],["packages/workbench/src/protocol/canonical-json.ts","import-statement",false]],
  "packages/workbench/src/validation/model.ts": [["node_modules/zod/index.js","import-statement",false]],
  "packages/workbench/src/integration/harness-rc6/validation-domain.ts": [["@deepseek-ai/dsh-storage-domain","import-statement",true],["packages/workbench/src/validation/model.ts","import-statement",false]],
  "packages/workbench/src/validation/runner.ts": [["node_modules/zod/index.js","import-statement",false],["packages/workbench/src/validation/model.ts","import-statement",false]],
  "packages/workbench/src/validation/service.ts": [["node:crypto","import-statement",true],["packages/workbench/src/domain/ids.ts","import-statement",false],["packages/workbench/src/protocol/canonical-json.ts","import-statement",false],["packages/workbench/src/validation/runner.ts","import-statement",false],["packages/workbench/src/validation/model.ts","import-statement",false]],
  "packages/workbench/src/client/workbench/docx-input.ts": [],
  "packages/workbench/src/client/workbench/validation-client.ts": [["packages/workbench/src/validation/model.ts","import-statement",false]],
  "packages/workbench/src/client/workbench/handoff-export.ts": [["packages/workbench/src/client/workbench/browser-port.ts","import-statement",false]],
  "packages/workbench/src/client/workbench/ValidationPane.tsx": [["react","import-statement",true],["packages/workbench/src/validation/model.ts","import-statement",false],["packages/workbench/src/client/workbench/validation-client.ts","import-statement",false],["packages/workbench/src/client/workbench/handoff-export.ts","import-statement",false],["react/jsx-runtime","import-statement",true]],
  "packages/workbench/src/client/workbench/validation-styles.ts": []
}
const hostExternals = Object.freeze(["@deepseek-ai/dsh-agent-default-model", "@deepseek-ai/dsh-session", "@deepseek-ai/dsh-storage-domain", "@deepseek-ai/dsh-tools", "node:crypto"])
const clientExternals = Object.freeze(["react", "react/jsx-runtime"])
const outputImports = {
  "host": [
    [
      "@deepseek-ai/dsh-agent-default-model",
      "import-statement",
      true
    ],
    [
      "@deepseek-ai/dsh-session",
      "import-statement",
      true
    ],
    [
      "@deepseek-ai/dsh-storage-domain",
      "import-statement",
      true
    ],
    [
      "@deepseek-ai/dsh-storage-domain",
      "import-statement",
      true
    ],
    [
      "@deepseek-ai/dsh-tools",
      "import-statement",
      true
    ],
    [
      "node:crypto",
      "import-statement",
      true
    ],
    [
      "node:crypto",
      "import-statement",
      true
    ],
    [
      "node:crypto",
      "import-statement",
      true
    ],
    [
      "node:crypto",
      "import-statement",
      true
    ],
    [
      "node:crypto",
      "import-statement",
      true
    ]
  ],
  "client": [
    [
      "react",
      "require-call",
      true
    ],
    [
      "react",
      "require-call",
      true
    ],
    [
      "react",
      "require-call",
      true
    ],
    [
      "react",
      "require-call",
      true
    ],
    [
      "react",
      "require-call",
      true
    ],
    [
      "react",
      "require-call",
      true
    ],
    [
      "react/jsx-runtime",
      "require-call",
      true
    ],
    [
      "react/jsx-runtime",
      "require-call",
      true
    ],
    [
      "react/jsx-runtime",
      "require-call",
      true
    ],
    [
      "react/jsx-runtime",
      "require-call",
      true
    ],
    [
      "react/jsx-runtime",
      "require-call",
      true
    ],
    [
      "react/jsx-runtime",
      "require-call",
      true
    ],
    [
      "react/jsx-runtime",
      "require-call",
      true
    ],
    [
      "react/jsx-runtime",
      "require-call",
      true
    ]
  ]
}

const roles = {
  host: { inputs: new Set([...zodInputs, ...hostApplicationInputs]), externals: hostExternals, platform: 'node', format: 'esm', entryPoint: 'packages/workbench/src/index.ts', output: 'lib/index.js', exports: ['apply', 'inject', 'projectDomainSpec', 'workbenchConfig'] },
  client: { inputs: new Set([...zodInputs, ...clientApplicationInputs]), externals: clientExternals, platform: 'browser', format: 'cjs', entryPoint: 'packages/workbench/src/client/index.tsx', output: 'lib/client.js', exports: [] },
}
export const PRODUCT_INPUT_PATHS = Object.freeze(sorted(new Set([...roles.host.inputs, ...roles.client.inputs])))
export const PRODUCT_CONFIG_PATHS = Object.freeze(['tsconfig.json', 'packages/workbench/tsconfig.json'])

export function canonicalJson(value) {
  const seen = new Set()
  function visit(item) {
    if (item === null || typeof item === 'boolean' || typeof item === 'string') return JSON.stringify(item)
    if (typeof item === 'number') { number(item); return JSON.stringify(item) }
    if (!item || typeof item !== 'object' || seen.has(item)) fail()
    seen.add(item)
    let encoded
    if (Array.isArray(item)) encoded = '[' + Array.from(item, visit).join(',') + ']'
    else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) fail()
      encoded = '{' + sorted(Object.keys(item)).map(key => JSON.stringify(key) + ':' + visit(item[key])).join(',') + '}'
    }
    seen.delete(item)
    return encoded
  }
  return visit(value)
}
const tuple = item => [item.path, item.kind, item.external === true]
const sortTuples = items => [...items].sort((a, b) => compare(a[0], b[0]) || compare(a[1], b[1]) || Number(a[2]) - Number(b[2]))
function assertGraph(role, metafile, canonical = false) {
  const rule = roles[role]; if (!rule) fail()
  keys(metafile, ['inputs', 'outputs'])
  const paths = Object.keys(metafile.inputs)
  if (paths.length > 512 || !same(sorted(paths), sorted(rule.inputs))) fail(role)
  let total = 0
  for (const name of paths) {
    const record = metafile.inputs[name]; keys(record, ['bytes', 'imports'], ['format'])
    number(record.bytes)
    if (record.format !== undefined && record.format !== 'esm') fail(role)
    if (!Array.isArray(record.imports)) fail(role)
    total += record.imports.length
    for (const item of record.imports) {
      keys(item, ['path', 'kind'], ['external', 'original'])
      if (item.external !== undefined && typeof item.external !== 'boolean') fail(role)
      if (item.original !== undefined && typeof item.original !== 'string') fail(role)
    }
    if (!same(sortTuples(record.imports.map(tuple)), sortTuples(reviewedImports[name]))) fail(role)
  }
  if (total > 4096 || Object.keys(metafile.outputs).length !== 1) fail(role)
  const [outputPath, output] = Object.entries(metafile.outputs)[0]
  if (canonical) { if (outputPath !== rule.output) fail(role) }
  else {
    if (typeof outputPath !== 'string' || outputPath.includes(String.fromCharCode(92)) || outputPath.startsWith('/')
      || path.posix.normalize(outputPath) !== outputPath || outputPath.split('/').includes('..')
      || path.posix.basename(outputPath) !== path.posix.basename(rule.output)) fail(role)
    assertWorkbenchWritePath(path.resolve(repositoryRoot, outputPath))
  }
  keys(output, ['bytes', 'inputs', 'imports', 'exports', 'entryPoint'])
  number(output.bytes)
  if (output.entryPoint !== rule.entryPoint || !same(sorted(Object.keys(output.inputs)), sorted(rule.inputs))) fail(role)
  for (const contribution of Object.values(output.inputs)) { keys(contribution, ['bytesInOutput']); number(contribution.bytesInOutput) }
  if (!Array.isArray(output.imports) || output.imports.length > 32) fail(role)
  for (const item of output.imports) {
    keys(item, ['path', 'kind', 'external'])
    if (item.external !== true || !rule.externals.includes(item.path)) fail(role)
  }
  if (!same(sortTuples(output.imports.map(tuple)), outputImports[role])
    || !Array.isArray(output.exports) || output.exports.length > 32
    || !same(sorted(output.exports), rule.exports)) fail(role)
  return output
}
export function assertHostProductBuildGraph(metafile) { assertGraph('host', metafile) }
export function assertClientProductBuildGraph(metafile) { assertGraph('client', metafile) }

export function assertCanonicalProductGraph(graph, role) {
  keys(graph, ['platform', 'format', 'inputs', 'output'])
  const rule = roles[role]
  if (!rule || graph.platform !== rule.platform || graph.format !== rule.format || !Array.isArray(graph.inputs)) fail()
  if (!same(graph.inputs.map(i => i.path), sorted(rule.inputs))) fail()
  const inputs = {}
  for (const input of graph.inputs) {
    keys(input, ['path', 'bytes', 'sha256', 'imports']); assertHash(input.sha256)
    if (!Array.isArray(input.imports)) fail()
    for (const item of input.imports) keys(item, ['path', 'kind', 'external'])
    if (!same(input.imports.map(tuple), sortTuples(input.imports.map(tuple)))) fail()
    inputs[input.path] = { bytes: input.bytes, imports: input.imports }
  }
  const o = graph.output
  keys(o, ['path', 'entryPoint', 'bytes', 'sha256', 'inputs', 'imports', 'exports']); assertHash(o.sha256)
  if (!Array.isArray(o.inputs) || !same(o.inputs.map(i => i.path), sorted(rule.inputs))) fail()
  for (const input of o.inputs) keys(input, ['path', 'bytesInOutput'])
  if (!same(o.imports.map(tuple), sortTuples(o.imports.map(tuple))) || !same(o.exports, rule.exports)) fail()
  assertGraph(role, { inputs, outputs: { [o.path]: {
    entryPoint: o.entryPoint, bytes: o.bytes, inputs: Object.fromEntries(o.inputs.map(i => [i.path, { bytesInOutput: i.bytesInOutput }])), imports: o.imports, exports: o.exports,
  } } }, true)
}
function assertHash(value) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) fail() }
function orderedImports(items) { return sortTuples(items.map(tuple)).map(([path, kind, external]) => ({ path, kind, external })) }
export function wrapProductClient(raw) {
  return Buffer.from(`window.__ModuleLoader__.load({ id:'@knight/dsh-pm-workbench', factory(require) { const module={exports:{}}; const exports=module.exports; ${raw.toString('utf8')}; return module.exports; } });\n`)
}
function normalizeGraph(role, metafile, sources, raw) {
  const output = assertGraph(role, metafile)
  const rule = roles[role]
  const graph = {
    platform: rule.platform, format: rule.format,
    inputs: sorted(rule.inputs).map(name => {
      const bytes = sources.get(name)
      if (!Buffer.isBuffer(bytes) || bytes.length !== metafile.inputs[name].bytes) fail()
      return { path: name, bytes: bytes.length, sha256: sha256(bytes), imports: orderedImports(metafile.inputs[name].imports) }
    }),
    output: { path: rule.output, entryPoint: rule.entryPoint, bytes: raw.length, sha256: sha256(raw), inputs: sorted(rule.inputs).map(name => ({ path: name, bytesInOutput: output.inputs[name].bytesInOutput })), imports: orderedImports(output.imports), exports: sorted(output.exports) },
  }
  if (output.bytes !== raw.length) fail()
  assertCanonicalProductGraph(graph, role)
  return graph
}

export function assertElidedProductTypeImport(sources) {
  const parent = 'packages/workbench/src/application/project-service.ts'
  const target = 'packages/workbench/src/application/project-repository.ts'
  const source = sources.get(parent)?.toString('utf8')
  if (typeof source !== 'string' || !sources.has(target)
    || path.posix.join(path.posix.dirname(parent), './project-repository.js').replace(/\.js$/, '.ts') !== target) fail()
  const imports = [...source.matchAll(/import\s*\{([^{}]*)\}\s*from\s*['"]\.\/project-repository\.js['"]/g)]
  if (imports.length !== 1) fail()
  const specifiers = imports[0][1].split(',').map(s => s.trim()).filter(Boolean)
  if (specifiers.length !== 4 || !specifiers.every(s => /^type\s+[A-Za-z_$][\w$]*$/.test(s))) fail()
}

// The compiler receives only frozen source bytes. Resolution cannot load another filesystem candidate.
export function stopProductCompiler() { stop() }
export async function compileProductSnapshots(snapshots, assertOwned) {
  const sources = new Map([...snapshots].map(([name, bytes]) => [name, Buffer.from(bytes)]))
  for (const name of [...PRODUCT_INPUT_PATHS, ...PRODUCT_CONFIG_PATHS]) if (!sources.has(name)) fail()
  assertElidedProductTypeImport(sources)
  const rootConfig = JSON.parse(sources.get('tsconfig.json').toString('utf8'))
  const packageConfig = JSON.parse(sources.get('packages/workbench/tsconfig.json').toString('utf8'))
  const compilerOptions = { ...rootConfig.compilerOptions, ...packageConfig.compilerOptions }
  const outputs = {}
  for (const role of ['host', 'client']) {
    const rule = roles[role]
    await assertOwned?.()
    const result = await build({
      absWorkingDir: repositoryRoot, entryPoints: [rule.entryPoint],
      outfile: path.join(packageRoot, rule.output), bundle: true, write: false, metafile: true,
      format: rule.format, platform: rule.platform, external: rule.externals,
      sourcemap: false, tsconfigRaw: { compilerOptions }, logLevel: 'silent',
      plugins: [{ name: 'frozen-product-sources', setup(api) {
        api.onResolve({ filter: /.*/ }, args => {
          if (rule.externals.includes(args.path)) return { path: args.path, external: true }
          let resolved
          if (args.kind === 'entry-point') resolved = path.relative(repositoryRoot, path.resolve(repositoryRoot, args.path)).split(path.sep).join('/')
          else if (args.path === 'zod') resolved = 'node_modules/zod/index.js'
          else if (args.path.startsWith('.')) {
            const relative = path.relative(repositoryRoot, path.resolve(path.dirname(args.importer), args.path.endsWith(".md?raw") ? args.path.slice(0, -4) : args.path)).split(path.sep).join('/')
            resolved = [relative, relative.replace(/\.js$/, '.ts'), relative.replace(/\.js$/, '.tsx')].find(p => rule.inputs.has(p))
          }
          if (!rule.inputs.has(resolved) || !sources.has(resolved)) fail(role)
          return { path: path.join(repositoryRoot, resolved), ...(zodInputs.has(resolved) ? { sideEffects: false } : {}) }
        })
        api.onLoad({ filter: /.*/ }, async args => {
          await assertOwned?.()
          const name = path.relative(repositoryRoot, args.path).split(path.sep).join('/')
          if (!rule.inputs.has(name) || !sources.has(name)) fail(role)
          return { contents: sources.get(name), loader: name.endsWith('.md') ? 'text' : name.endsWith('.tsx') ? 'tsx' : name.endsWith('.ts') ? 'ts' : 'js', resolveDir: path.dirname(args.path) }
        })
      } }],
    })
    await assertOwned?.()
    if (result.outputFiles.length !== 1) fail(role)
    const raw = Buffer.from(result.outputFiles[0].contents)
    outputs[role] = { metafile: result.metafile, raw, graph: normalizeGraph(role, result.metafile, sources, raw) }
  }
  const hostBytes = outputs.host.raw
  const clientBytes = wrapProductClient(outputs.client.raw)
  return Object.freeze({
    hostMetafile: outputs.host.metafile, clientMetafile: outputs.client.metafile,
    graphs: { host: outputs.host.graph, client: outputs.client.graph },
    graphHashes: { host: sha256(canonicalJson(outputs.host.graph)), client: sha256(canonicalJson(outputs.client.graph)) },
    outputHashes: Object.freeze({ 'lib/client.js': sha256(clientBytes), 'lib/index.js': sha256(hostBytes) }),
    outputBytes: { 'lib/client.js': clientBytes, 'lib/index.js': hostBytes },
  })
}

async function readBuildSource(name) {
  const target = path.join(repositoryRoot, name)
  const handle = await open(target, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const before = await handle.stat({ bigint: true })
    if (!before.isFile() || before.nlink !== 1n || before.size > 2n * 1024n * 1024n) fail()
    const bytes = Buffer.alloc(Number(before.size)); let offset = 0
    while (offset < bytes.length) { const { bytesRead } = await handle.read(bytes, offset, bytes.length - offset, offset); if (!bytesRead) fail(); offset += bytesRead }
    const after = await handle.stat({ bigint: true }); const atPath = await lstat(target, { bigint: true })
    for (const key of ['dev', 'ino', 'mode', 'nlink', 'size', 'mtimeNs', 'ctimeNs']) if (before[key] !== after[key] || before[key] !== atPath[key]) fail()
    return bytes
  } finally { await handle.close() }
}
/** @param {{ outdir?: string, onWrite?: (target: string) => void }} [options] */
export async function buildWorkbench({ outdir = path.join(packageRoot, 'lib'), onWrite } = {}) {
  const sources = new Map()
  for (const name of [...PRODUCT_INPUT_PATHS, ...PRODUCT_CONFIG_PATHS]) sources.set(name, await readBuildSource(name))
  const result = await compileProductSnapshots(sources)
  for (const [name, bytes] of sources) if (!bytes.equals(await readBuildSource(name))) fail()
  const guarded = target => { assertWorkbenchWritePath(target); onWrite?.(target); assertWorkbenchWritePath(target); return target }
  const lib = path.resolve(outdir)
  await rm(guarded(lib), { recursive: true, force: true })
  await mkdir(guarded(lib), { recursive: true })
  for (const name of ['lib/index.js', 'lib/client.js']) await writeFile(guarded(path.join(lib, path.basename(name))), result.outputBytes[name])
  return result
}
export async function buildPackableWorkbench() { return buildWorkbench() }

export async function buildDemo({ outdir = defaultDemoOutdir, guard = assertWorkbenchWritePath } = {}) {
  const outputRoot = path.resolve(outdir)
  assertWorkbenchDemoWritePath(outputRoot)
  const guarded = (target) => {
    guard(target)
    // Recheck after the hook as well: it cannot weaken the physical boundary.
    assertWorkbenchDemoWritePath(target)
    return target
  }
  guarded(outputRoot)
  const jsPath = path.join(outputRoot, 'assets', 'demo.js')
  const cssPath = path.join(outputRoot, 'assets', 'demo.css')
  const result = await build({
    entryPoints: [path.join(packageRoot, 'demo', 'main.tsx')],
    outfile: jsPath,
    bundle: true,
    write: false,
    platform: 'browser',
    format: 'iife',
    charset: 'utf8',
    sourcemap: false,
  })
  const outputs = new Map(result.outputFiles.map((file) => [file.path, file.contents]))
  if (result.outputFiles.length !== 2 || outputs.size !== 2 || !outputs.has(jsPath) || !outputs.has(cssPath)) {
    throw new Error('Demo build must produce exactly assets/demo.js and assets/demo.css')
  }
  let html = await readFile(path.join(packageRoot, 'demo', 'index.html'), 'utf8')
  if (!html.includes('<link rel="stylesheet" href="./assets/demo.css">')) {
    html = html.replace('</head>', '  <link rel="stylesheet" href="./assets/demo.css">\n</head>')
  }
  await rm(guarded(outputRoot), { recursive: true, force: true })
  await mkdir(guarded(outputRoot), { recursive: true })
  await mkdir(guarded(path.join(outputRoot, 'assets')), { recursive: true })
  await writeFile(guarded(path.join(outputRoot, 'index.html')), html, 'utf8')
  await writeFile(guarded(jsPath), outputs.get(jsPath))
  await writeFile(guarded(cssPath), outputs.get(cssPath))
  return outputRoot
}

const isEntry = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href
if (isEntry && (process.argv.includes('--verify-profile') || process.argv.includes('--test-e2e'))) {
  console.error('Not implemented in Task 1.1: profile/E2E verification requires a later compatibility task.')
  process.exitCode = 1
} else if (isEntry && process.argv.includes('--verify')) {
  await buildWorkbench()
  console.log('package build verification passed')
} else if (isEntry && process.argv.includes('--demo')) {
  await buildDemo()
} else if (isEntry) {
  await buildWorkbench()
}
