import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import git from '../electron/git.cjs'

export async function checkAmend(app, page, root, accessibility) {
  const cwd = path.join(root, 'amend-project'); await mkdir(cwd)
  await git.git(cwd, ['init', '-b', 'main'])
  for (const [key, value] of [['user.name', '메시지 작성자'], ['user.email', 'amend@example.invalid'], ['commit.gpgsign', 'false']]) await git.git(cwd, ['config', key, value])
  await writeFile(path.join(cwd, 'file.txt'), 'base\n'); await git.git(cwd, ['add', '.']); await git.git(cwd, ['commit', '-m', '기반 커밋'])
  const parent = (await git.state(cwd)).head
  await writeFile(path.join(cwd, 'file.txt'), 'committed\n'); await git.git(cwd, ['add', '.'])
  await git.git(cwd, ['commit', '-m', '[TASK-17] 서비스 테스트 추가\n\n주요 변경사항\n- 테스트 모듈 확장\n- 문서 갱신'], { env: { ...process.env, GIT_AUTHOR_DATE: '2026-09-14T15:52:42+09:00', GIT_COMMITTER_DATE: '2026-09-14T15:52:42+09:00' } })
  const oldHead = (await git.state(cwd)).head
  await git.git(cwd, ['update-ref', 'refs/remotes/origin/main', oldHead])
  await writeFile(path.join(cwd, 'file.txt'), 'staged\n'); await git.git(cwd, ['add', '.']); await writeFile(path.join(cwd, 'file.txt'), 'working\n')
  const index = await git.git(cwd, ['write-tree'])
  const executable = path.join(root, 'amend-codex')
  await writeFile(executable, `#!${process.execPath}
if (process.argv.includes('--version')) { console.log('fixture 1.0'); process.exit(0); }
let input=''; process.stdin.setEncoding('utf8'); process.stdin.on('data',s=>input+=s); process.stdin.on('end',()=>{
const data=JSON.parse(input.slice(input.indexOf('\\n')+1));
if (!input.includes('Do not use tools') || !data.committedChanges || data.additionalStagedChanges) process.exit(2);
if (data.question === '오류 응답') { console.log('malformed'); return; }
console.log(JSON.stringify({message:'제목과 본문 제안입니다. 실행한 작업은 없습니다.', result:'[TASK-17] 서비스 테스트 보강\\n\\n변경 이유\\n- 테스트 범위를 확대합니다.'}));
});`, { mode: 0o700 })
  await app.evaluate(({ dialog }, executable) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [executable] }) }, executable)
  await page.evaluate(async () => { await window.branchline.agentPath('codex'); await window.branchline.setAgent('codex', true) })
  await app.evaluate(({ dialog }, cwd) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cwd] }) }, cwd)
  await page.setViewportSize({ width: 1440, height: 950 }); await page.getByRole('button', { name: '저장소 추가', exact: true }).click(); await page.getByRole('menuitem', { name: '저장소 열기', exact: true }).click()
  const workspace = page.locator('.bl-repository:visible'), graph = workspace.locator('.bl-commit-graph')
  const headRow = graph.locator('.bl-graph-row').filter({ hasText: '[TASK-17] 서비스 테스트 추가' })
  await headRow.waitFor(); assert.match(await headRow.locator('time').innerText(), /\d{2}:52/); assert.ok(!(await headRow.locator('time').innerText()).includes(':42'))
  await headRow.click()
  const inspector = page.getByRole('complementary', { name: '커밋 상세', exact: true })
  await inspector.getByRole('heading', { name: '[TASK-17] 서비스 테스트 추가', exact: true }).waitFor()
  await inspector.getByRole('region', { name: '커밋 본문', exact: true }).getByText(/주요 변경사항/).waitFor()
  await inspector.getByRole('button', { name: '커밋 상세 크게 보기' }).click()
  const expanded = page.getByRole('dialog', { name: '커밋 상세 크게 보기', exact: true })
  await expanded.getByRole('heading', { name: '[TASK-17] 서비스 테스트 추가', exact: true }).waitFor()
  await accessibility(page)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'commit-message-card.png') })
  await expanded.getByRole('button', { name: 'Amend', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: '최근 커밋 수정 · Amend', exact: true })
  await dialog.getByLabel('커밋 제목', { exact: true }).waitFor(); await page.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' }); assert.equal(await expanded.isVisible(), true)
  await page.keyboard.press('Escape'); await expanded.waitFor({ state: 'hidden' })
  await inspector.getByRole('button', { name: 'Amend', exact: true }).click()
  const title = dialog.getByLabel('커밋 제목', { exact: true })
  await title.waitFor(); assert.equal(await title.inputValue(), '[TASK-17] 서비스 테스트 추가')
  await title.dispatchEvent('keydown', { key: 'Enter', isComposing: true, bubbles: true }); assert.equal(await dialog.getByRole('button', { name: 'Amend 실행', exact: true }).count(), 0)
  await dialog.getByText('AI로 커밋 메시지 다듬기', { exact: true }).click()
  const prompt = dialog.getByLabel('Agent에게 전달할 요청', { exact: true })
  await prompt.fill('오류 응답'); await dialog.getByRole('button', { name: '선택한 Agent에 전송', exact: true }).click()
  await dialog.getByRole('alert').filter({ hasText: '유효한 수정안' }).waitFor(); assert.equal(await prompt.inputValue(), '오류 응답')
  await prompt.fill('제목과 본문을 다듬어줘'); await dialog.getByRole('button', { name: '선택한 Agent에 전송', exact: true }).click()
  await dialog.getByRole('button', { name: 'AI 제안을 편집기에 적용' }).waitFor()
  assert.equal((await git.state(cwd)).head, oldHead); assert.equal(await title.inputValue(), '[TASK-17] 서비스 테스트 추가')
  await dialog.getByRole('button', { name: 'AI 제안을 편집기에 적용' }).click()
  await dialog.getByRole('button', { name: 'Amend 검토', exact: true }).click()
  const execute = dialog.getByRole('button', { name: 'Amend 실행', exact: true })
  assert.equal(await execute.isEnabled(), false)
  await dialog.getByRole('checkbox', { name: '공유된 커밋의 SHA를 재작성한다는 것을 확인했습니다' }).check()
  await accessibility(page)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'amend-review.png') })
  await execute.click(); await dialog.waitFor({ state: 'hidden' })
  const amended = (await git.state(cwd)).head; assert.notEqual(amended, oldHead)
  assert.equal(await git.git(cwd, ['write-tree']), index); assert.equal(await readFile(path.join(cwd, 'file.txt'), 'utf8'), 'working\n')
  assert.equal((await git.git(cwd, ['rev-parse', 'HEAD^'])).trim(), parent); assert.equal((await git.git(cwd, ['rev-parse', 'refs/remotes/origin/main'])).trim(), oldHead)
  await workspace.getByRole('heading', { name: '[TASK-17] 서비스 테스트 보강', exact: true }).waitFor()
  await page.getByRole('button', { name: /^내 변경 사항 / }).click(); await page.getByRole('button', { name: '최근 커밋 수정 · Amend', exact: true }).click()
  await title.waitFor(); await title.fill('[TASK-17] 스테이징 반영'); await dialog.getByRole('checkbox', { name: '스테이징 변경 1개도 포함' }).check()
  await dialog.getByRole('button', { name: 'Amend 검토', exact: true }).click()
  await writeFile(path.join(cwd, 'later.txt'), 'external edit')
  await execute.click(); await dialog.getByRole('alert').filter({ hasText: /바뀌|변경/ }).first().waitFor()
  assert.equal((await git.state(cwd)).head, amended); assert.equal(await title.inputValue(), '[TASK-17] 스테이징 반영')
  await dialog.getByRole('button', { name: '최신 상태 다시 검토' }).click()
  await dialog.getByRole('button', { name: 'Amend 검토', exact: true }).click()
  await page.setViewportSize({ width: 760, height: 580 }); await accessibility(page)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'amend-review-narrow.png') })
  await execute.click(); await dialog.waitFor({ state: 'hidden' })
  assert.equal(await git.git(cwd, ['show', 'HEAD:file.txt']), 'staged\n'); assert.equal(await readFile(path.join(cwd, 'file.txt'), 'utf8'), 'working\n')
  // Amend applies only to HEAD; other commits do not show the action at all.
  await graph.locator('.bl-graph-row').filter({ hasText: '기반 커밋' }).click(); await inspector.getByRole('button', { name: '전체 커밋 SHA 복사', exact: true }).waitFor(); assert.equal(await inspector.getByRole('button', { name: 'Amend', exact: true }).count(), 0)
  await page.setViewportSize({ width: 1440, height: 950 })
  console.log('PASS: minute timestamps, title/body cards, nested modal Escape, AI message proposals, reviewed message-only/staged Amend, published acknowledgment, stale recovery, parent/index/worktree preservation and narrow accessibility')
}
