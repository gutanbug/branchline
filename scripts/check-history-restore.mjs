import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, realpath, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { _electron as electron } from 'playwright'

const root = await realpath(await mkdtemp(path.join(os.tmpdir(), 'branchline-history-restore-')))
const publisher = path.join(root, 'publisher'), remote = path.join(root, 'origin.git'), repo = path.join(root, 'reader')
const total = 50_000, index = 35_000, inset = 7
const git = (cwd, args, input) => execFileSync('git', ['-C', cwd, ...args], { input, encoding: 'utf8' }).trim()
let app, page
async function launch(trace) {
  const env = { ...process.env, BRANCHLINE_TEST_DATA: path.join(root, 'profile'), GIT_TRACE2_EVENT: trace }
  delete env.ELECTRON_RUN_AS_NODE
  app = await electron.launch({ executablePath: createRequire(import.meta.url)('electron'), args: [path.resolve('electron/main.cjs')], env })
  page = await app.firstWindow()
}
function publish(version, base) {
  const records = []
  for (let i = base ? 10_001 : 1; i <= total; i++) {
    records.push('commit refs/heads/main', 'committer Tester <test@example.invalid> ' + (1700000000 + i) + ' +0000', 'data <<END', 'Revision ' + i + ', run ' + version, 'END')
    if (i === 10_001 && base) records.push('from ' + base)
    records.push('')
  }
  git(publisher, ['fast-import', '--quiet', '--force'], records.join('\n') + '\n')
  git(publisher, ['push', '-q', '--force-with-lease', 'origin', 'main'])
}
async function atTop(sha, offset) {
  await page.waitForFunction(([sha, inset]) => {
    const g = document.querySelector('.bl-commit-graph'), row = g?.querySelector('.bl-graph-row[data-sha="' + sha + '"]')
    return row && Math.abs(g.getBoundingClientRect().top - row.getBoundingClientRect().top - inset) < 1
  }, [sha, offset])
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}
const graph = () => page.locator('.bl-commit-graph:visible')
try {
  await mkdir(publisher)
  git(root, ['init', '-q', '--bare', '-b', 'main', remote])
  git(publisher, ['init', '-q', '-b', 'main'])
  git(publisher, ['remote', 'add', 'origin', remote])
  publish(0)
  git(root, ['clone', '-q', remote, repo])
  const base = git(repo, ['rev-parse', 'HEAD~40000'])
  git(repo, ['reset', '-q', '--hard', base]) // Only the remote tracking ref keeps the rewritten portion visible.
  await launch(path.join(root, 'setup.trace'))
  await app.evaluate(({ dialog }, repo) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [repo] }) }, repo)
  await page.getByRole('button', { name: '저장소 열기', exact: true }).first().click()
  // Save a real bookmark using the same scroll events as a user, before rewriting any commits.
  while (true) {
    const count = Number(await graph().getAttribute('data-commit-count'))
    if (count > index + 100) break
    await graph().evaluate(g => { g.scrollTop = g.scrollHeight })
    await page.waitForFunction(n => Number(document.querySelector('.bl-commit-graph')?.dataset.commitCount) > n, count)
  }
  await graph().evaluate((g, i) => { g.scrollTop = i * 48 }, index)
  const row = graph().locator('[data-index="' + index + '"]')
  await row.evaluate((row, inset) => {
    const g = row.closest('.bl-commit-graph')
    g.scrollTop += row.getBoundingClientRect().top - g.getBoundingClientRect().top + inset
  }, inset)
  let anchor = git(repo, ['rev-parse', 'origin/main~' + index])
  await atTop(anchor, inset)
  for (let run = 1; run <= 3; run++) {
    await app.close(); app = undefined
    publish(run, base)
    git(repo, ['fetch', '-q', 'origin'])
    assert.equal(git(repo, ['rev-list', '--count', '--all']), String(total))
    assert.equal(git(repo, ['cat-file', '-t', anchor]), 'commit')
    assert.equal(git(repo, ['for-each-ref', '--contains', anchor]), '')
    anchor = git(repo, ['rev-parse', 'origin/main~' + index])
    const trace = path.join(root, 'run-' + run + '.trace'), began = performance.now()
    await launch(trace)
    await atTop(anchor, inset)
    const ms = Math.round(performance.now() - began)
    const calls = (await readFile(trace, 'utf8')).trim().split('\n').map(s => JSON.parse(s))
      .filter(e => e.event === 'start' && e.argv.includes('--topo-order'))
    assert.equal(calls.length, 1, 'Restore must perform exactly one paged graph query')
    assert.ok(calls[0].argv.includes('--skip=' + (index - 100)) && calls[0].argv.includes('--max-count=201'))
    const loaded = Number(await graph().getAttribute('data-commit-count'))
    const mountedRows = await graph().locator('.bl-graph-row').count()
    assert.equal(loaded, 200)
    assert.ok(mountedRows > 0 && mountedRows < loaded, 'Only visible rows and overscan should be mounted')
    console.log({ run, commits: total, index, coldElectronToPaintMs: ms, historyCalls: calls.length, loaded, mountedRows })
  }
  const first = await graph().getAttribute('data-first-sha')
  await graph().evaluate(g => { g.scrollTop = 0 })
  await page.waitForFunction(n => Number(document.querySelector('.bl-commit-graph')?.dataset.startIndex) === n, index - 200)
  await atTop(first, 0)
  await graph().evaluate(g => { g.scrollTop = g.scrollHeight })
  await page.waitForFunction(() => Number(document.querySelector('.bl-commit-graph')?.dataset.commitCount) > 300)
} finally {
  try { await app?.close() } finally { await rm(root, { recursive: true, force: true }) }
}
