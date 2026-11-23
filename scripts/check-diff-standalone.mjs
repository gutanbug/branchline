import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, rm, readFile } from 'node:fs/promises'
import os from 'node:os'
import assert from 'node:assert/strict'
import path from 'node:path'
import { checkDiffViewer } from './check-diff-viewer.mjs'
const require = createRequire(import.meta.url), root = await mkdtemp(path.join(os.tmpdir(), 'branchline-fixed-ui-'))
const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile') }; delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('electron/main.cjs')], env })
const page = await app.firstWindow()
const axe = await readFile(require.resolve('axe-core/axe.min.js', { paths: [require.resolve('@storybook/addon-a11y/package.json')] }), 'utf8')
try {
  await page.getByRole('heading', { name: '저장소에서 작업 시작', exact: true }).waitFor()
  if (process.env.BRANCHLINE_SCREENSHOTS) await mkdir(process.env.BRANCHLINE_SCREENSHOTS, { recursive: true })
  await checkDiffViewer(app, page, root, async page => { await page.evaluate(axe); assert.deepEqual(await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(item => ({ id: item.id, nodes: item.nodes.map(node => node.target) }))), []) })
} catch (error) { await page.screenshot({ path: '/tmp/branchline-diff-failure.png' }); throw error }
finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }
