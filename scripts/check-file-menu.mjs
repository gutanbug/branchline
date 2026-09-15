import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtemp, realpath, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { _electron as electron } from 'playwright'
import { checkChanges } from './check-changes.mjs'
const require = createRequire(import.meta.url)
const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'branchline-menu-check-')))
const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile') }; delete env.ELECTRON_RUN_AS_NODE
const axe = await readFile(require.resolve('axe-core/axe.min.js', { paths: [require.resolve('@storybook/addon-a11y/package.json')] }), 'utf8')
let app, page
try {
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('electron/main.cjs')], env })
  page = await app.firstWindow(); await page.waitForLoadState('domcontentloaded')
  await checkChanges(app, page, root, async page => {
    await page.evaluate(axe)
    assert.deepEqual(await page.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21aa'] })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) }))), [])
  })
  console.log('PASS: file context menu, submenu keyboard/Escape, native export cancel/save, stage/unstage, safe discard, ignore and editor navigation')
} catch (error) {
  console.error('Focus at failure:', await page?.evaluate(() => document.activeElement?.outerHTML.slice(0, 1000)))
  if (process.env.BRANCHLINE_SCREENSHOTS) await page?.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'file-menu-failure.png') }).catch(() => {})
  throw error
} finally {
  await app?.evaluate(({ app }) => app.exit(0)).catch(() => {})
  await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 })
}
