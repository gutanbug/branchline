import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import git from '../electron/git.cjs'
import sync from '../electron/sync.cjs'

export async function checkRemoteMonitor(app, page, root, accessibility) {
  await page.clock.install()
  const remote = path.join(root, 'monitor.git'), contributor = path.join(root, 'monitor-contributor'), cwd = path.join(root, 'monitor-project')
  await git.git(root, ['init', '--bare', '-b', 'main', remote]); await mkdir(contributor)
  await git.git(contributor, ['init', '-b', 'main'])
  await git.git(contributor, ['config', 'user.name', 'Monitor']); await git.git(contributor, ['config', 'user.email', 'monitor@example.invalid']); await git.git(contributor, ['config', 'commit.gpgsign', 'false'])
  await writeFile(path.join(contributor, 'base.txt'), 'base'); await git.git(contributor, ['add', '.']); await git.git(contributor, ['commit', '-m', 'base'])
  await git.git(contributor, ['remote', 'add', 'origin', remote]); await git.git(contributor, ['push', 'origin', 'main'])
  await sync.clone(remote, cwd)
  await git.git(cwd, ['config', 'user.name', 'Local']); await git.git(cwd, ['config', 'user.email', 'local@example.invalid']); await git.git(cwd, ['config', 'commit.gpgsign', 'false'])
  await git.git(cwd, ['switch', '-c', 'feature/ui/current']); await git.git(cwd, ['branch', '--set-upstream-to=origin/main'])
  await git.git(cwd, ['commit', '--allow-empty', '-m', 'local pending'])
  await git.git(cwd, ['branch', 'feature/api/other']); await git.git(cwd, ['branch', 'fix/other'])
  const head = (await git.state(cwd)).head
  const publish = async message => { await git.git(contributor, ['commit', '--allow-empty', '-m', message]); await git.git(contributor, ['push', 'origin', 'main']) }
  await publish('incoming one')
  await app.evaluate(({ dialog }, cwd) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cwd] }) }, cwd)
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.getByRole('button', { name: '저장소 추가', exact: true }).click(); await page.getByRole('menuitem', { name: '저장소 열기', exact: true }).click()
  const sidebar = page.getByRole('region', { name: '현재 저장소 탐색' }), toolbar = page.getByRole('group', { name: 'Git 빠른 작업' })
  await toolbar.getByLabel('받을 커밋 1개').first().waitFor()
  await toolbar.getByLabel('보낼 커밋 1개').waitFor()
  const current = sidebar.getByRole('button', { name: '이력 조회: feature/ui/current', exact: true })
  assert.equal(await current.isVisible(), true)
  await current.getByLabel('받을 커밋 1개').waitFor()
  assert.equal(await sidebar.getByRole('button', { name: '이력 조회: feature/api/other', exact: true }).isVisible(), false)
  await sidebar.getByRole('button', { name: 'LOCAL 전체 펼치기', exact: true }).focus(); await page.keyboard.press('Enter')
  assert.equal(await sidebar.getByRole('button', { name: '이력 조회: feature/api/other', exact: true }).isVisible(), true)
  await sidebar.getByRole('button', { name: 'LOCAL 전체 접기', exact: true }).click()
  assert.equal(await current.isVisible(), false)
  await sidebar.getByLabel('브랜치·Stash·Worktree 찾기').fill('current'); await current.waitFor()
  await sidebar.getByRole('button', { name: '브랜치 검색 지우기' }).click()
  await current.waitFor({ state: 'hidden' })
  await sidebar.getByRole('button', { name: 'LOCAL 전체 펼치기', exact: true }).click()
  await current.waitFor()
  // Move both clocks: exercise the actual 60-second renderer timer and main-process cooldown.
  await app.evaluate(() => { globalThis.monitorClock = Date.now; globalThis.monitorOffset = 0; Date.now = () => globalThis.monitorClock() + globalThis.monitorOffset })
  async function tick() { await app.evaluate(() => { globalThis.monitorOffset += 60001 }); await page.clock.fastForward(60001) }
  try {
    await publish('incoming two'); await tick()
    await toolbar.getByLabel('받을 커밋 2개').first().waitFor()
    await current.getByLabel('받을 커밋 2개').waitFor()
    assert.equal((await git.state(cwd)).head, head, 'No automatic pull or push')
    await git.git(cwd, ['remote', 'set-url', 'origin', path.join(root, 'monitor-offline.git')]); await tick()
    await sidebar.getByText(/origin 자동 Fetch 실패/).waitFor()
    await toolbar.getByLabel('받을 커밋 2개').first().waitFor()
    await git.git(cwd, ['remote', 'set-url', 'origin', remote]); await tick()
    await sidebar.getByText(/자동 Fetch · .*1분 간격/).waitFor()
    await accessibility(page)
    if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'remote-monitor.png') })
    await page.setViewportSize({ width: 760, height: 580 }); await accessibility(page)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'remote-monitor-narrow.png') })
  } finally { await app.evaluate(() => { Date.now = globalThis.monitorClock }); await page.clock.resume() }
  console.log('PASS: periodic automatic fetch, tracking badges, offline recovery, selected folders and keyboard expand/collapse')
}
