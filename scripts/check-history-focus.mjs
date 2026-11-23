import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright'

const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'branchline-history-focus-')))
const repo = path.join(root, 'repo'), trace = path.join(root, 'git.trace')
const git = (args, input, env = process.env) => execFileSync('git', ['-C', repo, ...args], { input, env, encoding: 'utf8', maxBuffer: 4 << 20 }).trim()
let app
try {
  await mkdir(repo)
  git(['init', '-q', '-b', 'main'])
  git(['config', 'user.name', 'Fixture'])
  git(['config', 'user.email', 'fixture@example.invalid'])
  const records = []
  for (let i = 1; i <= 49998; i++) records.push('commit refs/heads/main', 'committer Fixture <fixture@example.invalid> ' + (1700000000 + i) + ' +0000', 'data <<END', 'Revision ' + i, 'END', '')
  git(['fast-import', '--quiet'], records.join('\n') + '\n')
  git(['branch', 'archive', 'main~35000'])
  git(['branch', 'milestone', 'main~28000'])
  git(['branch', 'neighbor', 'main~40062'])
  git(['switch', '-q', '--detach', 'main~40000'])
  await writeFile(path.join(repo, 'draft.txt'), 'stash fixture\n')
  git(['add', 'draft.txt'])
  git(['stash', 'push', '-qm', 'historical draft'], undefined, { ...process.env, GIT_AUTHOR_DATE: '1700009999 +0000', GIT_COMMITTER_DATE: '1700009999 +0000' })
  git(['switch', '-q', 'main'])
  const rawOrder = git(['rev-list', '--topo-order', '--stdin'], git(['log', '--all', 'HEAD', '--no-walk', '--format=%H']) + '\n').split('\n')
  assert.equal(rawOrder.length, 50000)
  // The graph hides the Stash index commit, so visible ranks after it shift by one.
  const stashIndex = git(['rev-parse', 'refs/stash^2']), order = rawOrder.filter(sha => sha !== stashIndex)
  assert.equal(order.length, 49999)
  const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile'), GIT_TRACE2_EVENT: trace }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [path.resolve('electron/main.cjs')], env })
  await app.evaluate(({ dialog }, { repo, modulePath }) => {
    dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [repo] })
    const service = process.getBuiltinModule('node:module').createRequire(modulePath)(modulePath)
    const history = service.history
    globalThis.probe = { calls: [] }
    service.history = async (cwd, input) => {
      const call = { sha: input.focusSha }
      globalThis.probe.calls.push(call)
      const result = await history(cwd, input)
      call.rows = result.commits.length
      if (input.focusSha && input.focusSha === globalThis.probe.hold) {
        await new Promise(resolve => { globalThis.probe.release = resolve })
        globalThis.probe.returned = true
      }
      return result
    }
  }, { repo, modulePath: path.resolve('electron/git.cjs') })
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.getByRole('button', { name: '저장소 열기', exact: true }).first().click()
  const sidebar = page.getByRole('region', { name: '현재 저장소 탐색' })
  const branch = name => ({ name, button: sidebar.getByRole('button', { name: '이력 조회: ' + name, exact: true }), sha: git(['rev-parse', name]), inspector: '커밋 상세' })
  const archive = branch('archive'), milestone = branch('milestone')
  const stash = { name: 'Stash', button: sidebar.getByRole('button', { name: /Stash 보기:.*historical draft/ }), sha: git(['rev-parse', 'refs/stash']), inspector: 'Stash 상세' }
  await page.locator('.bl-commit-graph[data-commit-count="100"] .bl-graph-row').first().waitFor()
  async function selected(target) {
    const rank = order.indexOf(target.sha)
    assert.ok(rank >= 28000, 'The fixture target must be deep in history')
    await page.waitForFunction(({ sha, start }) => {
      const graph = document.querySelector('.bl-commit-graph'), row = graph?.querySelector('.bl-graph-row[aria-pressed=true]')
      if (Number(graph?.dataset.startIndex) !== start || graph?.dataset.commitCount !== '200' || row?.dataset.sha !== sha) return false
      const box = row.getBoundingClientRect(), bounds = graph.getBoundingClientRect()
      return box.top >= bounds.top && box.bottom <= bounds.bottom
    }, { sha: target.sha, start: rank - 100 }, { polling: 'raf', timeout: 10000 })
    await page.getByRole('complementary', { name: target.inspector, exact: true }).locator('code[title="' + target.sha + '"]').waitFor()
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  }
  async function graphCommands() {
    return (await readFile(trace, 'utf8')).trim().split('\n').map(line => JSON.parse(line))
      .filter(event => event.event === 'start' && event.argv.includes('--topo-order')).map(event => event.argv)
  }
  for (let run = 1; run <= 3; run++) {
    for (const target of [archive, stash]) {
      const before = (await graphCommands()).length
      await app.evaluate(() => { globalThis.probe.calls = [] })
      const began = performance.now()
      await target.button.click()
      await selected(target)
      const ms = Math.round(performance.now() - began)
      const calls = await app.evaluate(() => globalThis.probe.calls)
      const commands = (await graphCommands()).slice(before)
      assert.deepEqual(calls, [{ sha: target.sha, rows: 200 }])
      assert.equal(commands.length, 2)
      assert.ok(commands[0].includes('rev-list'))
      // 200 rows, plus room for Stash index/untracked commits the graph hides.
      const maxCount = Number(commands[1].find(arg => arg.startsWith('--max-count='))?.slice(12))
      assert.ok(commands[1].includes('log') && maxCount >= 200 && maxCount <= 210)
      console.log({ run, target: target.name, rank: order.indexOf(target.sha), clickToPaintMs: ms, graphReads: calls.length, rows: calls[0].rows, selectedSha: target.sha })
    }
  }
  // Withhold a real result until the later selection is painted, then deliver it out of order.
  for (const [first, last] of [[archive, milestone], [stash, archive], [milestone, stash]]) {
    await app.evaluate((_electron, sha) => { Object.assign(globalThis.probe, { hold: sha, release: null, returned: false }) }, first.sha)
    await first.button.click()
    const deadline = performance.now() + 10000
    while (!await app.evaluate(() => !!globalThis.probe.release)) {
      assert.ok(performance.now() < deadline, 'First lookup did not reach the response gate')
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    await last.button.click()
    await selected(last)
    await app.evaluate(() => { globalThis.probe.release(); globalThis.probe.hold = null })
    assert.ok(await app.evaluate(() => globalThis.probe.returned))
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await selected(last)
    console.log({ lateResponse: first.name, finalSelection: last.name, selectedSha: last.sha })
  }
  for (const target of [branch('neighbor'), stash]) {
    await target.button.click()
    await selected(target)
  }
  console.log('PASS: overlapping branch and Stash windows keep the selected row visible')
} finally {
  try { await app?.close() } finally { await rm(root, { recursive: true, force: true }) }
}
