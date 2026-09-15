import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import { checkRepositoryGraph } from './check-repository-graph.mjs'
const require = createRequire(import.meta.url), root = await mkdtemp(path.join(os.tmpdir(), 'branchline-graph-check-'))
const axe = await readFile(require.resolve('axe-core/axe.min.js', { paths: [require.resolve('@storybook/addon-a11y/package.json')] }), 'utf8')
const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile') }; delete env.ELECTRON_RUN_AS_NODE
let app
try {
 app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('electron/main.cjs')], env })
 const page = await app.firstWindow(); page.setDefaultTimeout(15000); await page.setViewportSize({ width: 1440, height: 950 })
 await page.getByRole('heading', { name: /변경을 살펴보고/ }).waitFor()
 await checkRepositoryGraph(app, page, root, async page => { await page.evaluate(axe); assert.deepEqual(await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(item => item.id)), []) })
} catch (error) { await (await app?.firstWindow())?.screenshot({ path: 'docs/history-ux-2026-09-14/failure.png' }).catch(() => {}); throw error }
finally { await app?.evaluate(({ app }) => app.exit(0)).catch(() => {}); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }
