import assert from 'node:assert/strict'
import { mkdir, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import git from '../electron/git.cjs'

export async function checkComparison(app, page, root, accessibility) {
  const cwd = path.join(root, 'comparison-flow'); await mkdir(cwd)
  await git.git(cwd, ['init', '-b', 'main'])
  for (const [name, value] of [['user.name', 'Comparison Test'], ['user.email', 'comparison@example.invalid'], ['commit.gpgsign', 'false']]) await git.git(cwd, ['config', name, value])
  async function commit(file, text, message) { await writeFile(path.join(cwd, file), text); await git.git(cwd, ['add', '.']); await git.git(cwd, ['commit', '-m', message]); return (await git.state(cwd)).head }
  async function history(branch, count, parent) {
    const input = Array.from({ length: count }, (_, i) =>
      `commit refs/heads/${branch}\ncommitter Test <test@example.invalid> ${1700000000 + i} +0000\ndata <<END\n${branch} ${i}\nEND\n${i === 0 && parent ? `from ${parent}\n` : ''}\n`).join('')
    await git.git(cwd, ['fast-import', '--quiet'], { input })
  }
  await history('main', 460)
  const common = await commit('base.txt', 'base\n', '공통 기반')
  await git.git(cwd, ['switch', '-c', 'feature/review'])
  const large = await commit('large.txt', ('x'.repeat(127) + '\n').repeat(33 * 1024 * 1024 / 128), '대용량 텍스트 추가')
  assert.equal((await stat(path.join(cwd, 'large.txt'))).size, 33 * 1024 * 1024)
  const source = await commit('feature.txt', '검토할 변경\n', '로그인 흐름 개선')
  await git.git(cwd, ['switch', 'main'])
  const target = await commit('main.txt', '배포 설정\n', '배포 설정 정리')
  await history('long-target', 150, common)
  const remote = path.join(root, 'comparison-remote.git')
  await git.git(root, ['init', '--bare', '-b', 'main', remote])
  await git.git(cwd, ['remote', 'add', 'origin', remote])
  await app.evaluate((_, modulePath) => {
    const require = process.getBuiltinModule('node:module').createRequire(modulePath), service = require(modulePath)
    const original = service.compareFile, calls = []
    service.compareFile = (cwd, input) => { calls.push(input.file); return original(cwd, input) }
    globalThis.comparisonProbe = { calls, restore: () => { service.compareFile = original } }
  }, path.resolve('electron/git.cjs'))
  await app.evaluate(({ dialog }, cwd) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cwd] }) }, cwd)
  await page.setViewportSize({ width: 1440, height: 950 })
  await page.getByRole('button', { name: '저장소 추가', exact: true }).click(); await page.getByRole('menuitem', { name: '저장소 열기', exact: true }).click()
  await page.getByRole('button', { name: /^comparison-flow main/ }).waitFor()
  await page.getByRole('button', { name: '브랜치 비교', exact: true }).click()
  const compare = page.getByRole('region', { name: '브랜치 비교 작업', exact: true })
  await compare.getByRole('combobox', { name: '가져올 브랜치', exact: true }).selectOption('refs/heads/feature/review')
  await compare.getByRole('combobox', { name: '반영할 브랜치', exact: true }).selectOption('refs/heads/main')
  const from = compare.getByRole('region', { name: '가져올 브랜치 그래프', exact: true }), to = compare.getByRole('region', { name: '반영할 브랜치 그래프', exact: true })
  await from.locator(`svg[data-sha="${source}"]`).waitFor(); await to.locator(`svg[data-sha="${target}"]`).waitFor()
  assert.equal(await from.locator(`svg[data-sha="${target}"]`).count(), 0)
  assert.equal(await to.locator(`svg[data-sha="${source}"]`).count(), 0)
  await from.getByText('이쪽에만 2개', { exact: true }).waitFor()
  await to.getByText('이쪽에만 1개', { exact: true }).waitFor()
  await checkLinkedScroll(page, compare, common)
  const files = compare.getByRole('region', { name: '변경 파일', exact: true })
  await files.getByRole('heading', { name: '변경 파일 3' }).waitFor()
  assert.equal(await files.getByRole('button', { name: 'main.txt', exact: true }).count(), 1)
  const introduced = compare.getByRole('button', { name: '공통 조상 이후 변경', exact: true })
  await introduced.press('Enter')
  await files.getByRole('heading', { name: '변경 파일 2' }).waitFor()
  assert.equal(await introduced.evaluate(el => el === document.activeElement), true)
  assert.equal(await files.getByRole('button', { name: 'main.txt', exact: true }).count(), 0)
  await compare.getByRole('button', { name: '두 브랜치 끝 비교', exact: true }).click()
  await files.getByRole('heading', { name: '변경 파일 3' }).waitFor()
  await checkLargePreviewAndReview(app, compare, files, source, target, root)
  await from.locator('.bl-graph-row').filter({ hasText: '대용량 텍스트 추가' }).click()
  const detail = compare.getByRole('complementary', { name: '선택 커밋 변경', exact: true })
  await detail.getByRole('button', { name: 'large.txt', exact: true }).waitFor()
  await from.locator('.bl-graph-row[aria-pressed=true]').getByText('가져올 쪽에만', { exact: true }).waitFor()
  await to.locator(`.bl-graph-row[data-sha="${target}"]`).click()
  await to.locator('.bl-graph-row[aria-pressed=true]').getByText('반영할 쪽에만', { exact: true }).waitFor()
  await detail.getByRole('button', { name: '선택 커밋 변경 닫기' }).click()
  await compare.getByRole('button', { name: /양쪽에서 보기/ }).click()
  await from.locator('.bl-graph-row[aria-pressed=true]').getByText('양쪽 공통', { exact: true }).waitFor()
  assert.equal(await compare.locator(`.bl-graph-row[aria-pressed=true] svg[data-sha="${common}"]`).count(), 2)
  await compare.getByRole('button', { name: '선택 커밋 변경 닫기' }).click()
  await page.getByRole('main').evaluate(el => { el.scrollTop = 0 })
  await accessibility(page)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'comparison-dual.png') })
  const picked = from.locator(`.bl-graph-row[data-sha="${source}"]`)
  await picked.click({ button: 'right' })
  await page.getByRole('menuitem', { name: 'Cherry-pick…', exact: true }).click()
  await page.getByRole('dialog').locator(`pre[title="${source}"]`).getByText(source.slice(0, 8), { exact: false }).waitFor()
  await page.getByRole('dialog', { name: 'Cherry-pick 검토', exact: true }).getByRole('button', { name: '취소' }).click()
  assert.equal((await git.state(cwd)).head, target)
  await picked.and(page.locator(':focus')).waitFor()
  await from.getByRole('button', { name: `커밋 ${source.slice(0, 8)} 메뉴`, exact: true }).click()
  await page.getByRole('menuitem', { name: 'Cherry-pick…', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Cherry-pick 실행', exact: true }).click()
  await page.getByRole('dialog').waitFor({ state: 'hidden' })
  assert.equal(await git.git(cwd, ['show', 'HEAD:feature.txt']), '검토할 변경\n')
  assert.equal((await git.state(cwd)).branch, 'main')
  await compare.getByRole('button', { name: '가져올 브랜치와 반영할 브랜치 교환' }).click()
  await from.locator('.bl-graph-row').first().waitFor()
  assert.equal(await compare.getByRole('combobox', { name: '가져올 브랜치', exact: true }).inputValue(), 'refs/heads/main')
  assert.equal(await compare.getByRole('button', { name: '현재 브랜치에 Merge…', exact: true }).isEnabled(), false)
  await compare.getByRole('button', { name: '반영할 브랜치 체크아웃', exact: true }).waitFor()
  await page.setViewportSize({ width: 760, height: 580 })
  await compare.getByRole('region', { name: '두 브랜치 그래프' }).scrollIntoViewIfNeeded()
  const [left, right] = await Promise.all([from, to].map(side => side.locator('.bl-commit-graph').boundingBox()))
  assert.ok(left && right && Math.abs(left.y - right.y) < 2 && left.x + left.width <= right.x + 1, 'Minimum desktop width keeps both graphs on the same horizontal line')
  await accessibility(page)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  if (process.env.BRANCHLINE_SCREENSHOTS) await page.screenshot({ path: path.join(process.env.BRANCHLINE_SCREENSHOTS, 'comparison-narrow.png') })
  const rebaseRow = to.locator(`.bl-graph-row[data-sha="${large}"]`)
  await rebaseRow.press('Shift+F10')
  const menu = page.getByRole('menu', { name: `커밋 ${large.slice(0, 8)}`, exact: true })
  await menu.and(page.locator(':focus-within')).waitFor()
  const bounds = await menu.boundingBox()
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 760 && bounds.y >= 0 && bounds.y + bounds.height <= 580)
  await accessibility(page)
  await page.keyboard.press('End')
  await menu.getByRole('menuitem', { name: '이 커밋 위로 Rebase…' }).and(page.locator(':focus')).waitFor()
  await page.keyboard.press('Enter')
  const review = page.getByRole('dialog', { name: 'Rebase 검토', exact: true })
  await review.locator(`pre[title="${large}"]`).getByText(large.slice(0, 8), { exact: false }).waitFor()
  await review.getByRole('button', { name: 'Rebase 실행', exact: true }).click()
  await review.waitFor({ state: 'hidden' })
  assert.equal((await git.state(cwd)).branch, 'main')
  await git.git(cwd, ['merge-base', '--is-ancestor', large, 'HEAD'])
  await assert.rejects(git.git(cwd, ['merge-base', '--is-ancestor', source, 'HEAD']), { code: 1 })
  await page.setViewportSize({ width: 1440, height: 950 })
  console.log('PASS: selected commit membership on both graphs, context and keyboard menus, exact non-tip Rebase; dual real branch graphs, common ancestor selection, clear direction and swap, Cherry-pick cancel/apply, checkout guard and minimum-window accessibility')
}

async function checkLinkedScroll(page, compare, common) {
  const graphs = compare.locator('.bl-comparison-side .bl-commit-graph')
  const centeredMatch = async (expected, previous) => (await page.waitForFunction(({ expected, previous }) => {
    const [left, right] = document.querySelectorAll('.bl-comparison-side .bl-commit-graph')
    if (!left?.clientHeight || !right?.clientHeight) return false
    const center = (graph, row) => row.getBoundingClientRect().top + row.offsetHeight / 2 - graph.getBoundingClientRect().top
    const rows = [...left.querySelectorAll('.bl-graph-row')]
    const distance = row => Math.abs(center(left, row) - left.clientHeight / 2)
    const row = rows.sort((a, b) => distance(a) - distance(b))[0]
    if (!row || distance(row) > row.offsetHeight / 2 + 1) return false
    const sha = row.dataset.sha
    const peer = right.querySelector(`.bl-graph-row[data-sha="${sha}"]`)
    return peer && (!expected || sha === expected) && sha !== previous && Math.abs(center(left, row) - center(right, peer)) < 2 && sha
  }, { expected, previous }, { timeout: 8000 })).jsonValue()
  const target = compare.getByRole('combobox', { name: '반영할 브랜치', exact: true })
  await target.selectOption('refs/heads/long-target')
  await compare.getByText('이쪽에만 150개', { exact: true }).waitFor()
  await centeredMatch(common)
  // On the short side, putting the base near the lower edge requires space above its tip.
  await graphs.nth(1).evaluate(el => { el.scrollTop -= 3 * 48 })
  await page.waitForFunction(sha => {
    const panes = [...document.querySelectorAll('.bl-comparison-side .bl-commit-graph')]
    const centers = panes.map(pane => {
      const row = pane.querySelector(`.bl-graph-row[data-sha="${sha}"]`)
      return row && row.getBoundingClientRect().top + row.offsetHeight / 2 - pane.getBoundingClientRect().top
    })
    return centers.every(center => center > panes[0].clientHeight / 2 + 100) && Math.abs(centers[0] - centers[1]) < 2
  }, common, { timeout: 5000 })
  await graphs.nth(1).evaluate(el => { el.scrollTop += 3 * 48 })
  await centeredMatch(common)
  // The destination initially ends about 100 shared commits before the source.
  await graphs.nth(0).evaluate(el => { el.scrollTop += 165 * 48 })
  const beyondPage = await centeredMatch(null, common)
  await graphs.nth(1).evaluate(el => { el.scrollTop -= 75 * 48 })
  await centeredMatch(null, beyondPage)
  await target.selectOption('refs/heads/main')
  await compare.getByText('이쪽에만 1개', { exact: true }).waitFor()
  await centeredMatch(common)
  await graphs.nth(0).evaluate(el => { el.scrollTop += 12 * 48 })
  const older = await centeredMatch(null, common)
  await graphs.nth(1).evaluate(el => { el.scrollTop += 5 * 48 })
  await centeredMatch(null, older)
  assert.equal(await compare.getByRole('complementary', { name: '선택 커밋 변경' }).count(), 0)
  await compare.getByRole('button', { name: /양쪽에서 보기/ }).click()
  await centeredMatch(common)
  await compare.getByRole('button', { name: '선택 커밋 변경 닫기' }).click()
  console.log('PASS: common SHA centered within 2 pixels on both sides after scrolling across a missing page and reversing, no incidental selection')
}

async function checkLargePreviewAndReview(app, compare, files, source, target, root) {
  const calls = () => app.evaluate(() => globalThis.comparisonProbe.calls)
  const patch = compare.getByRole('region', { name: '선택한 파일 변경' })
  assert.deepEqual(await calls(), [])
  await files.getByRole('button', { name: 'large.txt', exact: true }).click()
  await patch.getByText(/1 MiB를 넘어/).waitFor()
  await files.getByRole('button', { name: 'feature.txt', exact: true }).click()
  await patch.getByText('검토할 변경', { exact: true }).waitFor()
  assert.deepEqual(await calls(), ['large.txt', 'feature.txt'])
  await app.evaluate(({ shell }, modulePath) => {
    const { Hosting } = process.getBuiltinModule('node:module').createRequire(modulePath)(modulePath)
    const proto = Hosting.prototype
    function assertPat(input) { if (input.origin !== 'https://gitlab.test' || !input.writeAccess || input.token !== 'fixture') throw new Error('계정 연결 입력을 확인하세요.') }
    const overrides = {
      connectPat: async input => { assertPat(input); globalThis.comparisonProbe.disconnected = false; return { account: 'gitlab' } },
      list: () => ({ accounts: (globalThis.comparisonProbe.disconnected ? [] : ['github', 'gitlab']).map(provider => ({ key: provider, host: provider + '.test', login: 'fixture', provider, writeAccess: true })), warning: '' }),
      read: async input => ({ items: [{ id: input.project }] }),
      prepareWrite: async input => { globalThis.comparisonProbe.input = input; return { id: 'fixture-plan', expiresAt: Date.now() + 300000, label: 'PR/MR 생성', facts: [], text: '' } },
      executeWrite: async id => { globalThis.comparisonProbe.writes.push(id); const { account, project } = globalThis.comparisonProbe.input; return { id: '42', message: '생성 완료', url: `https://${account}.test/${project}/${account === 'github' ? 'pull' : '-/merge_requests'}/42` } },
    }
    const originals = Object.fromEntries(Object.keys(overrides).map(key => [key, proto[key]]))
    Object.assign(proto, overrides)
    globalThis.comparisonProbe.writes = []
    const open = shell.openExternal
    shell.openExternal = async url => { globalThis.comparisonProbe.opened = url }
    globalThis.comparisonProbe.restoreHost = () => { Object.assign(proto, originals); shell.openExternal = open }
  }, path.resolve('electron/hosting.cjs'))
  try {
    await compare.getByText('PR/MR 만들기', { exact: true }).click()
    const dialog = compare.page().getByRole('dialog')
    for (const provider of ['github', 'gitlab']) {
      await compare.getByRole('combobox', { name: 'PR/MR 작성 계정' }).selectOption(provider)
      await compare.getByRole('textbox', { name: 'PR/MR 원격 프로젝트' }).fill('team/project')
      await compare.getByRole('button', { name: '원격 프로젝트 확인' }).click()
      await compare.getByRole('button', { name: provider === 'github' ? 'PR 만들기' : 'MR 만들기' }).click()
      await dialog.getByRole('textbox', { name: '제목' }).fill('대용량 파일 비교 검토')
      await dialog.getByRole('button', { name: 'PR/MR 생성' }).click()
      await dialog.waitFor({ state: 'hidden' })
      const input = await app.evaluate(() => globalThis.comparisonProbe.input)
      assert.deepEqual([input.account, input.project, input.source, input.target, input.sourceSha, input.targetSha], [provider, 'team/project', 'feature/review', 'main', source, target])
    }
    assert.deepEqual(await app.evaluate(() => globalThis.comparisonProbe.writes), ['fixture-plan', 'fixture-plan'])
    assert.deepEqual(await calls(), ['large.txt', 'feature.txt'])
    await compare.getByText('PR/MR 만들기', { exact: true }).click()
    await checkFirstReview(app, compare.page(), root)
    console.log('PASS: 33 MiB text; 2/1 unique commits, 3 changed files, 0 initial patches, only selected large/small patches, GitHub PR and GitLab MR submissions with compared SHAs (stub hosts)')
  } finally {
    await app.evaluate(() => { globalThis.comparisonProbe.restoreHost(); globalThis.comparisonProbe.restore(); delete globalThis.comparisonProbe })
  }
}


async function checkFirstReview(app, page, root) {
  const cwd = path.join(root, 'first-contribution'), bare = path.join(root, 'first-review.git')
  await mkdir(cwd)
  await git.git(cwd, ['init', '-b', 'main'])
  for (const [name, value] of [['user.name', 'New Developer'], ['user.email', 'dev@example.invalid'], ['commit.gpgsign', 'false']]) await git.git(cwd, ['config', name, value])
  await git.git(cwd, ['commit', '--allow-empty', '-m', 'base'])
  const base = (await git.state(cwd)).head
  await git.git(root, ['init', '--bare', '-b', 'main', bare])
  // Only the display URL is hosted. The fixture routes Git traffic to the local bare repository.
  await writeFile(path.join(root, 'fixture-ssh'), `case "$*" in
    *"git-receive-pack 'team/first.git'") exec git receive-pack ../first-review.git ;;
    *"git-upload-pack 'team/first.git'") exec git upload-pack ../first-review.git ;;
    *) exit 1 ;;
  esac\n`)
  await git.git(cwd, ['config', 'core.sshCommand', 'sh ../fixture-ssh'])
  await git.git(cwd, ['config', 'ssh.variant', 'simple'])
  await git.git(cwd, ['remote', 'add', 'origin', 'git@gitlab.test:team/first.git'])
  await git.git(cwd, ['push', '-u', 'origin', 'main'])
  await app.evaluate(({ dialog }, cwd) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [cwd] }) }, cwd)
  await page.getByRole('button', { name: '저장소 추가', exact: true }).click()
  await page.getByRole('menuitem', { name: '저장소 열기', exact: true }).click()
  await page.getByRole('button', { name: /^first-contribution main/ }).waitFor()
  const toolbar = page.getByRole('group', { name: 'Git 빠른 작업' })
  const dialog = page.getByRole('dialog')
  await toolbar.getByRole('button', { name: '브랜치 만들기' }).click()
  await dialog.getByLabel('새 브랜치 이름').fill('feature/first')
  await dialog.getByRole('button', { name: '만들고 체크아웃' }).click()
  await page.getByRole('button', { name: /^first-contribution feature\/first/ }).waitFor()
  assert.equal((await git.state(cwd)).branch, 'feature/first')

  await writeFile(path.join(cwd, 'guide.md'), 'Hello, Branchline!\n')
  await page.getByRole('button', { name: '상태 새로고침', exact: true }).click()
  await page.getByRole('button', { name: '내 변경 사항 1', exact: true }).click()
  await page.getByRole('button', { name: '모두 스테이징', exact: true }).click()
  await page.getByRole('textbox', { name: '커밋 메시지' }).fill('Add a guide')
  await page.getByRole('button', { name: /에 커밋$/ }).click()
  await page.getByRole('button', { name: 'PR/MR 준비' }).waitFor()
  const head = (await git.state(cwd)).head
  assert.notEqual(head, base)
  assert.equal((await git.git(cwd, ['rev-parse', 'main'])).trim(), base)
  await app.evaluate(() => { globalThis.comparisonProbe.disconnected = true })
  await page.getByRole('button', { name: 'PR/MR 준비' }).click()
  const form = page.getByRole('region', { name: '비교에서 PR/MR 생성' })
  await form.getByText('호스팅 계정을 연결하세요', { exact: true }).waitFor()
  assert.equal(await form.getByRole('button', { name: '계정 연결', exact: true }).count(), 1, 'First-time contributor can connect an account without leaving PR/MR preparation')
  await form.getByRole('button', { name: '계정 연결', exact: true }).click()
  await dialog.getByLabel('호스팅 제공자').selectOption('gitlab')
  await dialog.getByLabel('연결 방식').selectOption('pat')
  await dialog.getByLabel('GitLab 서버 주소', { exact: true }).fill('https://gitlab.test')
  await dialog.getByLabel('Personal Access Token (PAT)', { exact: true }).fill('fixture')
  await dialog.getByLabel(/원격 쓰기 허용/).check()
  await dialog.getByRole('button', { name: 'GitLab PAT 연결' }).click()
  await dialog.waitFor({ state: 'hidden' })
  await form.getByRole('button', { name: 'origin/feature/first에 Push', exact: true }).click()
  await form.getByText('origin/feature/first에 게시됨', { exact: true }).waitFor()
  assert.equal((await git.git(bare, ['rev-parse', 'refs/heads/feature/first'])).trim(), head)

  const compare = page.getByRole('region', { name: '브랜치 비교 작업' })
  assert.equal(await compare.getByRole('combobox', { name: '가져올 브랜치', exact: true }).inputValue(), 'refs/heads/feature/first')
  assert.equal(await compare.getByRole('combobox', { name: '반영할 브랜치', exact: true }).inputValue(), 'refs/heads/main')
  for (const [account, action] of [['gitlab', 'MR 만들기'], ['github', 'PR 만들기']]) {
    if (account === 'github') {
      await compare.getByLabel('PR/MR 작성 계정').selectOption(account)
      await compare.getByLabel('PR/MR 원격 프로젝트').fill('team/first')
      await compare.getByRole('button', { name: '원격 프로젝트 확인' }).click()
      assert.equal(await form.getByRole('button', { name: /에 Push$/ }).count(), 0)
    } else {
      assert.equal(await compare.getByLabel('PR/MR 원격 프로젝트').inputValue(), 'team/first')
      assert.equal(await compare.getByLabel('PR/MR 작성 계정').inputValue(), 'gitlab')
    }
    await compare.getByRole('button', { name: action, exact: true }).click()
    await dialog.getByLabel('제목', { exact: true }).fill('Add a guide')
    await dialog.getByRole('button', { name: 'PR/MR 생성', exact: true }).click()
    await dialog.waitFor({ state: 'hidden' })
    await form.getByRole('button', { name: account === 'github' ? 'PR #42 열기' : 'MR !42 열기', exact: true }).click()
    const expectedUrl = `https://${account}.test/team/first/${account === 'github' ? 'pull' : '-/merge_requests'}/42`
    assert.equal(await app.evaluate(() => globalThis.comparisonProbe.opened), expectedUrl)
    const { input, writes } = await app.evaluate(() => ({ input: globalThis.comparisonProbe.input, writes: globalThis.comparisonProbe.writes.length }))
    assert.deepEqual([input.account, input.project, input.source, input.target, input.sourceSha, input.targetSha], [account, 'team/first', 'feature/first', 'main', head, base])
    assert.equal(writes, account === 'gitlab' ? 3 : 4)
  }
  await page.getByRole('button', { name: 'first-contribution 탭 닫기', exact: true }).click()
  await page.getByRole('button', { name: /^comparison-flow main/ }).click()
  console.log('PASS: open, create and check out, stage and commit, push to a local bare remote and submit GitHub PR/GitLab MR for the published SHA (stub hosts)')
}
