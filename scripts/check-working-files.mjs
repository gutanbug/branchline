import assert from 'node:assert/strict'
import { mkdir, writeFile, readFile } from 'node:fs/promises'
import path from 'node:path'
import git from '../electron/git.cjs'

export async function checkWorkingFiles(app, page, root, accessibility) {
  const cwd = path.join(root, 'working-editor'), target = path.join(cwd, 'src/설정.txt')
  await mkdir(path.join(cwd, 'src'), { recursive: true }); await writeFile(target, 'initial\r\n'); await writeFile(path.join(cwd, 'other.txt'), 'other\n'); await writeFile(path.join(cwd, 'image.bin'), Buffer.from([0, 255]));
  await git.git(cwd, ['init', '-b', 'main']); await git.git(cwd, ['config', 'user.name', 'Editor Test']); await git.git(cwd, ['config', 'user.email', 'editor@example.invalid']); await git.git(cwd, ['add', '.']); await git.git(cwd, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'initial files']);
  const originalTree = await git.git(cwd, ['write-tree'])
  await app.evaluate(({ dialog }, cwd) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cwd] }) }, cwd)
  await page.setViewportSize({ width: 1440, height: 950 }); await page.getByRole('button', { name: '저장소 열기', exact: true }).first().click(); await page.getByRole('button', { name: /^working-editor main/ }).waitFor()
  await page.getByRole('button', { name: '폴더에서 보기', exact: true }).click()
  await page.getByRole('tab', { name: '작업 폴더', exact: true }).waitFor()
  const tree = page.getByRole('complementary', { name: '작업 폴더 파일 디렉터리' }), input = page.getByRole('textbox', { name: '파일 내용', exact: true })
  await tree.getByText('src', { exact: true }).click(); await tree.getByRole('button', { name: 'src/설정.txt 파일 열기', exact: true }).click(); await input.waitFor()
  await input.fill('수정된 한글\nsecond\n'); await input.dispatchEvent('compositionstart'); await input.dispatchEvent('keydown', { key: 'Escape', isComposing: true }); await input.dispatchEvent('compositionend'); assert.equal(await page.getByRole('dialog').count(), 0)
  await input.press('Meta+s'); await page.getByText('파일을 저장했습니다.', { exact: true }).waitFor(); assert.equal(await readFile(target, 'utf8'), '수정된 한글\r\nsecond\r\n'); assert.equal(await git.git(cwd, ['write-tree']), originalTree)
  await writeFile(path.join(cwd, 'src/추가.txt'), 'new file'); await tree.getByRole('button', { name: '파일 디렉터리 새로고침' }).click(); await tree.getByRole('button', { name: 'src/추가.txt 파일 열기' }).waitFor();
  const box = await input.boundingBox(), directoryBox = await tree.boundingBox(); assert(box.width > directoryBox.width && box.x < directoryBox.x, 'editor left, directory right')
  await accessibility(page)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'working-file-editor.png') })
  await input.fill('보존할 초안'); await page.getByRole('tab', { name: '그래프', exact: true }).click(); await page.getByRole('tab', { name: /작업 폴더/ }).click(); assert.equal(await input.inputValue(), '보존할 초안')
  await page.getByRole('button', { name: 'AI Agents', exact: true }).click(); await page.getByRole('button', { name: /^내 작업 / }).click(); assert.equal(await input.inputValue(), '보존할 초안', 'draft survives workspace unmount')
  await input.press('Escape'); let confirmation = page.getByRole('dialog', { name: '저장하지 않은 파일 편집' }); await confirmation.waitFor(); await confirmation.getByRole('button', { name: '계속 편집' }).click(); assert.equal(await input.inputValue(), '보존할 초안')
  await page.getByRole('button', { name: 'working-editor 탭 닫기', exact: true }).click(); await confirmation.waitFor(); await confirmation.getByRole('button', { name: '계속 편집' }).click()
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].close()); await confirmation.waitFor(); await confirmation.getByRole('button', { name: '계속 편집' }).click()
  await writeFile(target, 'external change\n'); await page.getByRole('button', { name: '파일 저장', exact: true }).click(); await page.getByRole('alert').filter({ hasText: '외부에서 변경' }).waitFor(); assert.equal(await input.inputValue(), '보존할 초안'); assert.equal(await readFile(target, 'utf8'), 'external change\n')
  await tree.getByRole('button', { name: 'other.txt 파일 열기', exact: true }).click(); await confirmation.waitFor(); await confirmation.getByRole('button', { name: '계속 편집' }).click(); assert.equal(await input.inputValue(), '보존할 초안')
  await page.getByRole('button', { name: '다시 불러오기', exact: true }).click(); await confirmation.waitFor(); await confirmation.getByRole('button', { name: '편집 버리고 이동' }).click(); await page.waitForFunction(() => document.querySelector('.bl-source-input')?.value === 'external change\n')
  await tree.getByRole('button', { name: 'image.bin 파일 열기', exact: true }).click(); await page.getByRole('alert').filter({ hasText: 'UTF-8' }).waitFor(); assert.equal(await input.inputValue(), 'external change\n')
  await tree.getByText('src', { exact: true }).click(); await tree.getByRole('button', { name: 'src/설정.txt 파일 열기', exact: true }).click()
  await page.setViewportSize({ width: 760, height: 580 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true); const small = await input.boundingBox(); assert(small.height > 90 && small.width > 100, 'minimum window keeps editor usable'); await accessibility(page)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'working-file-editor-narrow.png') })
  await input.press('Escape'); await page.getByRole('tab', { name: '작업 폴더', exact: true }).waitFor({ state: 'hidden' }); await page.getByRole('tab', { name: '그래프', exact: true }).waitFor()
  await page.getByRole('button', { name: '폴더에서 보기', exact: true }).click(); await page.getByRole('button', { name: '작업 폴더 탭 닫기', exact: true }).click(); await page.getByRole('tab', { name: '작업 폴더', exact: true }).waitFor({ state: 'hidden' })
  assert.equal(await page.getByRole('navigation', { name: '저장소 보기' }).getByRole('button', { name: '원격', exact: true }).count(), 0)
  await page.getByRole('button', { name: '원격 설정 열기', exact: true }).click(); await page.getByRole('heading', { name: '원격 주소·추적 브랜치' }).waitFor()
  await page.getByRole('button', { name: 'working-editor 탭 닫기', exact: true }).click(); await page.setViewportSize({ width: 1440, height: 950 })
  console.log('PASS: working editor tab, file tree, real save without staging, CRLF, IME, Escape/button/native close protection, external change, binary error, draft persistence, narrow screen')
}
