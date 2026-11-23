// Reproduce the September UX findings using an isolated Electron profile and temporary Git data.
import assert from 'node:assert/strict'
import { _electron as electron } from 'playwright'
import { createRequire } from 'node:module'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import git from '../electron/git.cjs'
const require = createRequire(import.meta.url)
const root = await mkdtemp(path.join(os.tmpdir(), 'branchline-ux-'))
const repo = path.join(root, 'personal-project'), output = path.resolve('docs/ux-audit-2026-09-14')
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
  app = await electron.launch({ executablePath: require('electron'), args: [path.resolve('electron/main.cjs')], env })
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.getByRole('heading', { name: '저장소에서 작업 시작', exact: true }).waitFor()
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }) }, repo)
  await page.getByRole('button', { name: '저장소 추가', exact: true }).click(); await page.getByRole('menuitem', { name: '저장소 열기', exact: true }).click()
  await page.getByRole('heading', { name: '커밋 그래프', exact: true }).waitFor()
  await page.getByRole('button', { name: '충돌 해결', exact: true }).click()
  await page.getByRole('region', { name: '충돌 파일', exact: true }).getByRole('button', { name: 'conflict.txt', exact: true }).click()
  await page.getByRole('button', { name: '원본 불러오기', exact: true }).click()
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
  assert.equal(await editor.count(), 0, 'Current issue: conflict snapshot and draft unmounted')
  await page.screenshot({ path: path.join(output, 'draft-after-navigation.png') })
  await page.getByRole('region', { name: '충돌 파일', exact: true }).getByRole('button', { name: 'conflict.txt', exact: true }).click()
  await page.getByRole('button', { name: '원본 불러오기', exact: true }).click()
  assert.match(await editor.inputValue(), /<<<<<<< HEAD/)
  assert.match(await readFile(path.join(repo, 'conflict.txt'), 'utf8'), /<<<<<<< HEAD/)
  console.log('CONFIRMED: unsaved conflict draft disappears on top-level navigation; original disk file intact.')
  await page.getByRole('button', { name: /^내 변경 사항 / }).click()
  await writeFile(path.join(repo, 'external-new.txt'), 'external editor\n')
  // A bounded observation window to measure the lack of refresh; not a network timing dependency.
  await page.waitForTimeout(2000)
  const staleCount = await page.getByRole('button', { name: 'external-new.txt 스테이징', exact: true }).count()
  assert.equal(staleCount, 0)
  await page.screenshot({ path: path.join(output, 'external-change-stale.png') })
  await page.getByRole('button', { name: '상태 새로고침', exact: true }).click()
  await page.getByRole('button', { name: 'external-new.txt 스테이징', exact: true }).waitFor()
  await page.screenshot({ path: path.join(output, 'external-change-refreshed.png') })
  console.log('CONFIRMED: external file absent after 2 seconds; appears on manual refresh.')
  await page.getByRole('button', { name: 'AI Agents', exact: true }).click()
  await page.getByRole('heading', { name: 'Claude Code', exact: true }).waitFor()
  await page.locator('main').evaluate(el => { el.scrollTop = 0 })
  await page.screenshot({ path: path.join(output, 'agents-capability.png') })
  console.log('Captured Agent settings without invoking AI or quota requests.')
} finally { await app?.close(); await rm(root, { recursive: true, force: true }) }
