import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright'

const count = 30_000
const root = await mkdtemp(path.join(os.tmpdir(), 'branchline-large-history-'))
const repo = path.join(root, 'graph-fixture')
let app
try {
  await mkdir(repo)
  const git = (args, input) => execFileSync('git', args, { cwd: repo, input, encoding: 'utf8' }).trim()
  git(['init', '-q', '-b', 'main'])
  const records = []
  let main = 0
  for (let i = 1; i <= count; i++) {
    const topic = i % 60 === 55, message = 'Graph fixture commit ' + i
    records.push('commit refs/heads/' + (topic ? 'topic' : 'main'), 'mark :' + i,
      'committer Reviewer <fixture@example.invalid> ' + (1700000000 + i) + ' +0000',
      'data ' + message.length, message)
    if (main) records.push('from :' + main)
    if (i % 60 === 0) records.push('merge :' + (i - 5))
    records.push('')
    if (!topic) main = i
  }
  git(['fast-import', '--quiet'], records.join('\n') + '\n')
  const oldest = git(['rev-list', '--max-parents=0', 'HEAD'])
  const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile') }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [path.resolve('electron/main.cjs')], env })
  await app.evaluate(({ dialog }, repo) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [repo] }) }, repo)
  const page = await app.firstWindow()
  const viewport = process.argv.includes('--narrow') ? { width: 760, height: 580 } : { width: 1440, height: 900 }
  await page.setViewportSize(viewport)
  await page.getByRole('button', { name: '저장소 추가', exact: true }).click()
  await page.getByRole('menuitem', { name: '저장소 열기', exact: true }).click()
  const graph = page.locator('.bl-commit-graph:visible')
  const report = await graph.evaluate(async (scroller, total) => {
    const intervals = []
    const thirds = [[], [], []]
    const started = performance.now()
    let previous = 0, maxRows = 0, blankFrames = 0, pages = 0, loaded = 0, waitingFrames = 0
    const bounds = scroller.getBoundingClientRect()
    while (performance.now() - started < 180_000) {
      const time = await new Promise(requestAnimationFrame)
      const rows = scroller.querySelectorAll('.bl-graph-row')
      if (previous) {
        const interval = time - previous
        intervals.push(interval)
        const first = Number(rows[0]?.dataset.index ?? 0)
        thirds[Math.min(2, Math.floor(first * 3 / total))].push(interval)
      }
      previous = time
      const count = Number(scroller.dataset.commitCount)
      if (count !== loaded) { pages++; loaded = count }
      maxRows = Math.max(maxRows, rows.length)
      const center = document.elementFromPoint(bounds.left + bounds.width * .7, bounds.top + bounds.height * .5)
      if (!center?.closest('.bl-graph-row')) blankFrames++
      if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1) {
        if (loaded === total) break
        waitingFrames++
      }
      scroller.scrollTop += 240
    }
    intervals.sort((a, b) => a - b)
    return {
      loaded, pages, frames: intervals.length, maxRows, blankFrames, waitingFrames,
      reachedEnd: scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1,
      p95Ms: intervals[Math.floor(intervals.length * .95)], maxMs: intervals.at(-1),
      p95ByThirdMs: thirds.map(samples => samples.sort((a, b) => a - b)[Math.floor(samples.length * .95)]),
      minimapElements: document.querySelectorAll('.bl-scroll-overview-art *').length,
    }
  }, count)
  console.log({ viewport, ...report })
  assert.equal(report.loaded, count)
  assert.equal(report.reachedEnd, true)
  assert.ok(report.pages > 1 && report.maxRows < 75 && report.minimapElements < 10)
  assert.equal(report.blankFrames, 0)
  assert.ok(report.p95ByThirdMs[2] <= Math.max(34, report.p95ByThirdMs[0] * 1.75), 'Scrolling slows down deep in history')
  const last = graph.locator(`[data-index="${count - 1}"]`)
  assert.equal(await last.getAttribute('data-sha'), oldest)
  await last.focus()
  await page.keyboard.press('ArrowUp')
  assert.equal(await graph.locator('[aria-pressed=true]').getAttribute('data-index'), String(count - 2))
} finally {
  try { await app?.close() } finally { await rm(root, { recursive: true, force: true }) }
}
