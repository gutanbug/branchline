import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { checkAuditFixes } from './check-audit-fixes.mjs'
const require = createRequire(import.meta.url), root = await mkdtemp(path.join(os.tmpdir(), 'branchline-fixed-ui-'))
const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile') }; delete env.ELECTRON_RUN_AS_NODE
const app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('electron/main.cjs')], env })
const page = await app.firstWindow()
try {
  await page.getByRole('heading', { name: /변경을 살펴보고/ }).waitFor()
  if (process.env.BRANCHLINE_SCREENSHOTS) await mkdir(process.env.BRANCHLINE_SCREENSHOTS, { recursive: true })
  await checkAuditFixes(app, page, root, async () => {})
} catch (error) { await page.screenshot({ path: '/tmp/branchline-audit-failure.png' }); throw error }
finally { await app.evaluate(({ app }) => app.exit(0)).catch(() => {}); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }
