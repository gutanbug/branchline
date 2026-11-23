import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtemp, mkdir, realpath, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright'

const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'branchline-navigation-')))
const repo = path.join(root, 'history'), env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile') }
delete env.ELECTRON_RUN_AS_NODE
const provider = process.argv.includes('--github') ? 'github' : 'gitlab'
let app, page
async function launch(holdReview = false) {
  const args = [path.resolve('scripts/fixtures/navigation-main.cjs')]
  if (provider === 'github') args.push('--github')
  if (holdReview) args.push('--hold-review')
  app = await electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args, env })
  page = await app.firstWindow()
  page.setDefaultTimeout(13000)
  page.on('pageerror', error => console.error(error.message))
}
async function closeWindow() {
  await Promise.all([
    app.waitForEvent('close', { timeout: 13000 }),
    app.evaluate(({ BrowserWindow }) => { BrowserWindow.getAllWindows()[0].close() }),
  ])
  app = undefined
}
const graph = () => page.locator('.bl-commit-graph:visible').first()
const main = () => page.locator('.bl-desktop-main')
const review = () => page.getByRole('region', { name: 'PR/MR 상세' }).getByRole('heading', { name: /Review number 12/ })
async function waitForTop(selector, value) {
  try {
    await page.waitForFunction(([sel, y]) => Math.abs(document.querySelector(sel).scrollTop - y) <= 1, [selector, value])
  } catch (cause) {
    const actual = await page.locator(selector).evaluate(element => ({ top: element.scrollTop, max: element.scrollHeight - element.clientHeight }))
    const saved = await page.evaluate(path => JSON.parse(localStorage.getItem('branchline.navigation.v1:review:' + path) || 'null')?.value, repo)
    throw new Error(`Expected scrollTop ${value}, measured ${JSON.stringify(actual)}, review bookmark ${JSON.stringify(saved)}`, { cause })
  }
}
let anchor, inset, selected
async function verifyGraph() {
  await page.getByRole('button', { name: /^내 작업/ }).click()
  await page.waitForFunction(({ sha, inset }) => {
    const g = document.querySelector('.bl-commit-graph'), row = g?.querySelector('[data-sha="' + sha + '"]')
    return row && Math.abs(g.getBoundingClientRect().top - row.getBoundingClientRect().top - inset) <= 1
  }, { sha: anchor, inset })
  await page.locator('.bl-repository:visible').getByText(selected.slice(0, 12), { exact: true }).first().waitFor()
}
try {
  await mkdir(repo)
  const git = (...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8' })
  git('init', '-q', '-b', 'main')
  git('config', 'core.sshCommand', 'false')
  git('remote', 'add', 'origin', `git@${provider}.example.test:team/demo.git`)
  let stream = ''
  for (let i = 1; i <= 260; i++) stream += 'commit refs/heads/main\ncommitter Test <test@example.invalid> ' + (1700000000 + i) + ' +0000\ndata <<END\nRevision ' + i + '\nEND\n\n'
  execFileSync('git', ['-C', repo, 'fast-import', '--quiet'], { input: stream })
  await launch()
  await page.getByRole('button', { name: '저장소 열기', exact: true }).first().click()
  const row = graph().locator('[data-index="2"]')
  selected = await row.getAttribute('data-sha')
  await row.click()
  await graph().evaluate(g => { g.scrollTop = g.scrollHeight })
  await page.waitForFunction(() => Number(document.querySelector('.bl-commit-graph')?.dataset.commitCount) >= 200)
  await graph().evaluate(g => { g.scrollTop = 6909 })
  await graph().locator('[data-index="145"]').waitFor({ state: 'attached' })
  ;[anchor, inset] = await graph().evaluate(g => {
    const top = g.getBoundingClientRect().top, first = [...g.querySelectorAll('[data-sha]')].find(r => r.getBoundingClientRect().bottom > top)
    return [first.dataset.sha, top - first.getBoundingClientRect().top]
  })
  assert.notEqual(selected, anchor)
  await page.getByRole('button', { name: '프로젝트 현황', exact: true }).click()
  const item = page.getByRole('button', { name: /Review number 12\b/ })
  await item.scrollIntoViewIfNeeded()
  const listTop = await main().evaluate(e => e.scrollTop)
  assert.ok(listTop > 0)
  await item.click()
  await review().waitFor()
  await main().evaluate(e => { e.scrollTop = 677 })
  await waitForTop('.bl-desktop-main', 677)
  await page.getByRole('button', { name: 'history 탭 닫기' }).click()
  await page.locator('.bl-recent button').first().click()
  await review().waitFor()
  await waitForTop('.bl-desktop-main', 677)
  await verifyGraph()
  await page.getByRole('button', { name: '프로젝트 현황', exact: true }).click()
  await review().waitFor()
  await closeWindow()
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', 'commit', '--allow-empty', '-qm', 'New HEAD')
  await launch(true)
  const loading = () => page.getByText('상세 정보를 조회하고 있습니다…', { exact: true })
  await loading().waitFor()
  await app.evaluate(({ app }) => { app.emit('release-review') })
  await review().waitFor()
  await waitForTop('.bl-desktop-main', 677)

  // Quit while a refresh has collapsed the detail below its saved offset.
  await main().evaluate(e => new Promise(resolve => {
    e.addEventListener('scroll', () => resolve(), { once: true })
    e.scrollTop = 911
  }))
  await app.evaluate(({ app }) => { app.emit('hold-review') })
  await page.getByRole('button', { name: '상세 새로고침', exact: true }).evaluate(button => button.click())
  await loading().waitFor()
  await waitForTop('.bl-desktop-main', 0)
  await closeWindow()
  await launch(true)
  await loading().waitFor()
  await app.evaluate(({ app }) => { app.emit('release-review') })
  await review().waitFor()
  await waitForTop('.bl-desktop-main', 911)
  await page.getByRole('region', { name: 'PR/MR 상세' }).getByText(provider === 'github' ? '#12' : '!12', { exact: true }).waitFor()
  await page.getByRole('button', { name: '리뷰 목록으로' }).click()
  await waitForTop('.bl-desktop-main', listTop)
  await verifyGraph()
  console.log(`Restored ${provider} review 12 at 677px and 911px after two Electron relaunches, list at ${listTop}px, and the selected graph commit after a new HEAD.`)
} finally {
  await app?.close()
  await rm(root, { recursive: true, force: true })
}
