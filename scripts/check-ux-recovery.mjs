// Regression checks for draft protection and automatic refresh, isolated from real user data.
import assert from 'node:assert/strict'
import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import git from '../electron/git.cjs'
const require = createRequire(import.meta.url)
const root = await mkdtemp(path.join(os.tmpdir(), 'branchline-ux-'))
const repo = path.join(root, 'personal-project'), output = path.resolve(process.env.BRANCHLINE_SCREENSHOTS || 'docs/ux-fixes-2026-09-14')
await mkdir(repo); await mkdir(output, { recursive: true })
const run = args => git.git(repo, args)
await run(['init', '-b', 'main']); await run(['config', 'user.name', 'UX Audit']); await run(['config', 'user.email', 'audit@example.invalid']); await run(['config', 'commit.gpgsign', 'false'])
for (const [branch, content] of [['', 'base'], ['topic', 'topic'], ['main', 'main']]) {
  if (branch) await run(branch === 'topic' ? ['switch', '-c', branch] : ['switch', branch])
  await writeFile(path.join(repo, 'conflict.txt'), `${content}\n`); await run(['add', '.']); await run(['commit', '-m', content])
}
await assert.rejects(run(['merge', 'topic']))
const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile') }; delete env.ELECTRON_RUN_AS_NODE
let app
try {
  const packaged = process.env.BRANCHLINE_EXECUTABLE
  app = await electron.launch({ executablePath: packaged || require('electron'), args: packaged ? [`--user-data-dir=${env.BRANCHLINE_TEST_DATA}`] : [path.resolve('electron/main.cjs')], env })
  assert.equal(await app.evaluate(({ app }) => app.isPackaged), !!packaged)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.getByRole('heading', { name: '저장소에서 작업 시작', exact: true }).waitFor()
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }) }, repo)
  await page.getByRole('button', { name: '저장소 열기', exact: true }).click()
  await page.getByRole('heading', { name: '충돌 해결', exact: true }).waitFor()
  const editor = page.getByLabel('해결 결과 편집', { exact: true })
  await editor.fill('두 브랜치를 조합한 저장 전 초안\n')
  await editor.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'draft-before-navigation.png') })
  await page.getByRole('button', { name: '프로젝트 현황', exact: true }).click()
  assert.equal(await page.getByRole('dialog').count(), 0, 'Current issue: navigation has no dirty-draft guard')
  await page.getByRole('button', { name: '계정 연결', exact: true }).click()
  await page.getByRole('dialog', { name: '호스팅 계정 연결' }).waitFor()
  await page.screenshot({ path: path.join(output, 'oauth-onboarding.png') })
  await page.keyboard.press('Escape')
  await page.locator('button[aria-description="열린 저장소 1개"]', { hasText: '내 작업' }).click()
  await page.getByRole('heading', { name: '충돌 해결', exact: true }).waitFor()
  assert.equal(await editor.inputValue(), '두 브랜치를 조합한 저장 전 초안\n')
  await page.screenshot({ path: path.join(output, 'draft-after-navigation.png') })
  for (const label of ['AI Agents', '외부 도구 연결', '앱 설정']) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await page.locator('button[aria-description="열린 저장소 1개"]', { hasText: '내 작업' }).click()
    assert.equal(await editor.inputValue(), '두 브랜치를 조합한 저장 전 초안\n')
  }
  await page.getByRole('button', { name: 'personal-project 탭 닫기', exact: true }).click()
  await page.getByRole('dialog', { name: '저장하지 않은 충돌 편집' }).waitFor()
  await page.getByRole('button', { name: '계속 편집', exact: true }).click()
  assert.equal(await editor.inputValue(), '두 브랜치를 조합한 저장 전 초안\n')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  await page.getByRole('dialog', { name: '저장하지 않은 충돌 편집' }).waitFor()
  await page.screenshot({ path: path.join(output, 'close-draft-guard.png') })
  await page.getByRole('button', { name: '계속 편집', exact: true }).click()
  assert.equal(await editor.inputValue(), '두 브랜치를 조합한 저장 전 초안\n')
  assert.match(await readFile(path.join(repo, 'conflict.txt'), 'utf8'), /<<<<<<< HEAD/)
  console.log('PASS: conflict draft survives every top-level page; tab and native window close cancel preserve the draft.')
  await page.getByRole('button', { name: /^내 변경 사항 / }).click()
  await writeFile(path.join(repo, 'external-new.txt'), 'external editor\n')
  await page.getByRole('button', { name: 'external-new.txt 스테이징', exact: true }).waitFor({ timeout: 10000 })
  await page.getByRole('button', { name: 'external-new.txt 스테이징', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'external-change-refreshed.png') })
  console.log('PASS: external file appears automatically without losing the conflict draft.')
  await page.getByRole('button', { name: 'AI Agents', exact: true }).click()
  await page.getByRole('heading', { name: 'Claude Code', exact: true }).waitFor()
  await page.locator('main').evaluate(el => { el.scrollTop = 0 })
  await page.screenshot({ path: path.join(output, 'agents-capability.png') })
  console.log('Captured Agent settings without invoking AI or quota requests.')
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close())
  await page.getByRole('dialog', { name: '저장하지 않은 충돌 편집' }).waitFor()
  const closed = app.waitForEvent('close')
  await page.getByRole('button', { name: '편집 버리고 종료', exact: true }).click()
  await closed
  app = null
  console.log('PASS: explicit discard permits native app shutdown.')
} finally { await app?.evaluate(({ app }) => app.exit(0)).catch(() => {}); await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }) }
