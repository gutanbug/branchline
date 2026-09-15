import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import git from '../electron/git.cjs'
const require = createRequire(import.meta.url), root = await mkdtemp(path.join(os.tmpdir(), 'branchline-history-audit-'))
const cwd = path.join(root, 'review-project'), output = path.resolve('docs/history-ux-2026-09-14')
await mkdir(cwd)
await git.git(cwd, ['init', '-b', 'main'])
await git.git(cwd, ['config', 'user.name', 'Review Developer']); await git.git(cwd, ['config', 'user.email', 'review@example.invalid']); await git.git(cwd, ['config', 'commit.gpgsign', 'false'])
for (let i = 0; i < 8; i++) { await writeFile(path.join(cwd, 'app.txt'), `revision ${i}\n`); await git.git(cwd, ['add', '.']); await git.git(cwd, ['commit', '-m', `변경 ${i}: 긴 커밋 메시지와 전체 변경 확인`]) }
await git.git(cwd, ['branch', 'feature/review', 'HEAD~2'])
const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile') }; delete env.ELECTRON_RUN_AS_NODE
let app
try {
 app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('electron/main.cjs')], env })
 const page = await app.firstWindow(); page.setDefaultTimeout(10000); await page.setViewportSize({ width: 1440, height: 950 })
 await page.getByRole('heading', { name: /변경을 살펴보고/ }).waitFor()
 await app.evaluate(({ dialog }, cwd) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cwd] }) }, cwd)
 await page.getByRole('button', { name: '저장소 열기', exact: true }).first().click()
 const graph = page.locator('.bl-commit-graph:visible'), row = graph.getByRole('button').first()
 await row.waitFor(); await page.screenshot({ path: path.join(output, '01-before-history.png') })
 await row.click(); await page.getByRole('complementary', { name: '커밋 상세', exact: true }).getByLabel('변경 내용', { exact: true }).waitFor()
 await row.click(); await page.screenshot({ path: path.join(output, '02-before-reselect.png') })
 console.log('Same row remains selected:', await row.getAttribute('aria-pressed'))
 await git.git(cwd, ['commit', '--allow-empty', '-m', '외부에서 추가된 최신 커밋'])
 await page.getByRole('button', { name: '상태 새로고침', exact: true }).click()
 await page.getByRole('button', { name: '상태 새로고침', exact: true }).waitFor({ state: 'visible' })
 await page.waitForFunction(() => !document.querySelector('.bl-sidebar-refresh button').disabled)
 console.log('Ref refresh includes external commit:', await graph.getByRole('button', { name: /외부에서 추가된 최신 커밋/ }).count())
 await page.screenshot({ path: path.join(output, '03-before-refresh.png') })
 await page.getByRole('button', { name: '브랜치 비교', exact: true }).click()
 await page.getByRole('combobox', { name: '가져올 브랜치', exact: true }).selectOption('refs/heads/main')
 await page.getByRole('combobox', { name: '반영할 브랜치', exact: true }).selectOption('refs/heads/feature/review')
 await page.getByRole('region', { name: '가져올 브랜치 그래프', exact: true }).getByText('이쪽에만 3개', { exact: true }).waitFor()
 await page.screenshot({ path: path.join(output, '04-before-compare.png') })
} finally { await app?.evaluate(({ app }) => app.exit(0)).catch(() => {}); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }
