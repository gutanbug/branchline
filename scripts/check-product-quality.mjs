import assert from 'node:assert/strict'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'

// Run last: only this temporary Electron process gets controlled failure/Agent IPC fixtures.
export async function checkProductQuality(app, page, repository, accessibility) {
  const errors = []; page.on('pageerror', e => errors.push(e.message))
  async function capture(name) { if (process.env.BRANCHLINE_SCREENSHOTS) { await mkdir(process.env.BRANCHLINE_SCREENSHOTS, { recursive: true }); await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, name), fullPage: true }) } }
  await page.getByRole('button', { name: /^한글 project feature\/test/ }).click()
  await page.getByRole('button', { name: '커밋 그래프', exact: true }).click()
  if (!await page.locator('.bl-repository:visible').getByLabel('시작일 · 커미터 날짜', { exact: true }).isVisible()) await page.locator('.bl-repository:visible').getByText(/^커밋 검색·필터/).click()
  await page.locator('.bl-repository:visible').getByLabel('시작일 · 커미터 날짜', { exact: true }).fill('2026-12-31')
  await page.locator('.bl-repository:visible').getByLabel('종료일 · 로컬 시간', { exact: true }).fill('2026-01-01')
  await page.getByRole('alert').filter({ hasText: '시작일은 종료일보다' }).waitFor()
  await page.getByRole('alert').filter({ hasText: '시작일은 종료일보다' }).scrollIntoViewIfNeeded()
  await capture('quality-date-error.png')
  await page.getByRole('button', { name: '필터 초기화', exact: true }).click()
  await page.getByRole('button', { name: /desktop commit/ }).waitFor()
  await page.getByRole('button', { name: '브랜치 만들기', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '브랜치 만들기', exact: true })
  await dialog.getByLabel('새 브랜치 이름', { exact: true }).fill('한글-검토')
  const composingPrevented = await dialog.getByLabel('새 브랜치 이름', { exact: true }).evaluate(input => {
    const event = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true, cancelable: true }); input.dispatchEvent(event); return event.defaultPrevented
  })
  assert.equal(composingPrevented, true, 'IME commit Enter must not submit a Git mutation form')
  await capture('quality-branch-dialog.png')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Worktree 관리', exact: true }).click()
  await page.getByText('기본 worktree', { exact: false }).waitFor()
  await capture('quality-worktrees.png')
  // Failure must end loading, disable mutations, and expose a working retry.
  await app.evaluate(({ ipcMain }, repository) => {
    let calls = 0
    ipcMain.removeHandler('branchline:syncState')
    ipcMain.handle('branchline:syncState', () => ++calls === 1 ? { ok: false, error: '검증용 원격 조회 실패' } : { ok: true, value: { repository, remotes: [], upstream: { ref: null, remote: null, branch: null, ahead: null, behind: null }, stashes: [], offset: 0, hasMore: false } })
  }, repository)
  await page.getByRole('button', { name: '원격 설정 열기', exact: true }).click()
  await page.getByRole('alert').filter({ hasText: '검증용 원격 조회 실패' }).waitFor()
  assert.equal(await page.getByText('원격 설정과 보관 목록을 읽고 있습니다…', { exact: true }).isVisible(), false)
  assert.equal(await page.getByRole('button', { name: '원격 추가', exact: true }).isEnabled(), false)
  await capture('quality-remote-error.png')
  await page.getByRole('button', { name: '원격 목록 다시 시도', exact: true }).click()
  await page.getByText('등록된 원격이 없습니다', { exact: true }).waitFor()
  assert.equal(await page.getByRole('alert').filter({ hasText: '검증용 원격 조회 실패' }).count(), 0)
  // No real Agent session or paid call is used.
  await app.evaluate(({ ipcMain }) => {
    let enabled = true
    const agents = () => [{ id: 'codex', name: 'Codex', enabled, path: '/fixture/codex', version: 'fixture', error: null, quotaSupport: 'fixture' }]
    for (const name of ['agents', 'setAgent', 'usage']) ipcMain.removeHandler(`branchline:${name}`)
    ipcMain.handle('branchline:agents', () => ({ ok: true, value: agents() }))
    ipcMain.handle('branchline:setAgent', (_event, _id, value) => { enabled = value; return { ok: true, value: agents() } })
    ipcMain.handle('branchline:usage', () => ({ ok: true, value: { account: { email: 'audit@example.invalid', plan: 'fixture' }, windows: [{ id: 'five', name: '5시간', usedPercent: 40, remainingPercent: 60, windowMinutes: 300, resetsAt: null }], checkedAt: new Date().toISOString() } }))
  })
  await page.getByRole('button', { name: 'AI Agents', exact: true }).click()
  await page.getByRole('button', { name: '사용량 새로고침', exact: true }).click()
  await page.getByText('남음 60% · 사용 40%', { exact: true }).waitFor()
  await accessibility(page); await capture('quality-agent-usage.png')
  await page.getByLabel('Codex 사용', { exact: true }).uncheck()
  await page.getByLabel('Codex 사용', { exact: true }).check()
  assert.equal(await page.getByText('남음 60% · 사용 40%', { exact: true }).count(), 0, 'Re-enabling cannot resurrect an old account quota')
  await page.getByRole('button', { name: /^한글 project feature\/test/ }).click()
  await page.getByRole('button', { name: /^내 변경 사항 \d+$/ }).click()
  await page.getByRole('button', { name: 'saved.txt', exact: false }).first().click()
  await page.locator('.bl-diff-add .bl-diff-text').filter({ hasText: 'stash desktop content' }).waitFor()
  await page.locator('.bl-diff-add .bl-diff-text').filter({ hasText: 'stash desktop content' }).scrollIntoViewIfNeeded()
  await accessibility(page); await capture('quality-changes.png')
  const shell = await page.locator('.bl-desktop-header').boundingBox()
  const main = page.locator('main')
  await main.evaluate(element => { element.scrollTop = element.scrollHeight })
  assert.deepEqual(await page.locator('.bl-desktop-header').boundingBox(), shell, 'Navigation must stay visible while work content scrolls')
  await page.setViewportSize({ width: 760, height: 580 })
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true)
  await accessibility(page); await capture('quality-minimum-window.png')
  await main.evaluate(element => { element.scrollTop = 0 }); await main.focus(); await page.keyboard.press('PageDown')
  await page.waitForFunction(() => document.querySelector('main').scrollTop > 0)
  const closeTarget = await page.getByRole('button', { name: '한글 project 탭 닫기', exact: true }).boundingBox()
  assert.ok(closeTarget.width >= 44 && closeTarget.height >= 44, 'Project actions need full 44px targets')
  await app.evaluate(({ ipcMain }, repository) => {
    ipcMain.removeHandler('branchline:state')
    ipcMain.handle('branchline:state', () => ({ ok: true, value: { ...repository, checkedAt: new Date().toISOString(), operation: null, files: [{ path: 'conflict.txt', index: 'U', working: 'U', conflict: true, untracked: false, originalPath: null }] } }))
  }, repository)
  await page.getByRole('button', { name: '상태 새로고침', exact: true }).click()
  await page.getByRole('heading', { name: '충돌 해결', exact: true }).waitFor()
  await page.getByRole('button', { name: /^내 변경 사항 / }).click()
  await page.getByText(/미해결 충돌이 있습니다/).waitFor()
  assert.equal(await page.getByRole('button', { name: '선택한 변경 커밋', exact: true }).isEnabled(), false)
  assert.deepEqual(errors, [])
  console.log('PASS: product quality — IME, date recovery, remote retry, quota invalidation, fixed navigation, minimum window and accessibility')
}
