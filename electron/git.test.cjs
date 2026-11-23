const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const service = require('./git.cjs');

async function fixture(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'branchline-git-')));
  const cwd = path.join(root, '한글 repo'); await fs.mkdir(cwd);
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await service.git(cwd, ['init', '-b', 'main']);
  await service.git(cwd, ['config', 'user.name', 'Fixture']);
  await service.git(cwd, ['config', 'user.email', 'fixture@example.invalid']);
  await service.git(cwd, ['config', 'commit.gpgsign', 'false']);
  return { root, cwd };
}
async function commit(cwd, file, content, message) { await fs.writeFile(path.join(cwd, file), content); await service.git(cwd, ['add', '--', file]); await service.git(cwd, ['commit', '-m', message]); }

test('repository with a patch larger than 32 MiB opens and detects staged and unstaged edits', async t => {
  const { cwd } = await fixture(t);
  const file = 'large.txt', target = path.join(cwd, file);
  await commit(cwd, file, 'base\n', 'base');
  await commit(cwd, '.gitattributes', 'large.txt diff\n', 'keep text diffs');
  const content = Buffer.alloc(34 * 1024 * 1024, 'a');
  await fs.writeFile(target, content);
  const opened = await service.state(await service.repository(cwd));
  assert.equal(opened.files[0].working, 'M');
  assert.equal((await service.history(cwd)).commits[0].sha, opened.head);
  content[content.length - 1] = 98;
  await fs.writeFile(target, content);
  const edited = await service.state(cwd);
  assert.notEqual(edited.localToken, opened.localToken);
  await service.git(cwd, ['add', '--', file]);
  const staged = await service.state(cwd);
  assert.equal(staged.files[0].index, 'M');
  content[content.length - 1] = 99;
  await fs.writeFile(target, content);
  await service.git(cwd, ['add', '--', file]);
  const restaged = await service.state(cwd);
  assert.deepEqual(restaged.files, staged.files);
  assert.notEqual(restaged.localToken, staged.localToken);
  await fs.writeFile(path.join(cwd, '.gitattributes'), 'large.txt -diff\n');
  const binary = await service.state(cwd);
  content[content.length - 1] = 100;
  await fs.writeFile(target, content);
  const binaryEdit = await service.state(cwd);
  content[content.length - 1] = 101;
  await fs.writeFile(target, content);
  assert.notEqual((await service.state(cwd)).localToken, binaryEdit.localToken);
  assert.notEqual(binary.localToken, binaryEdit.localToken);
});

test('initial commit, literal paths, staged review token, rename, worktree isolation', async t => {
  const { cwd, root } = await fixture(t);
  assert.equal((await service.state(cwd)).head, null);
  assert.equal((await service.history(cwd)).commits.length, 0);
  const file = '한글 [file]\nnext.txt';
  await fs.writeFile(path.join(cwd, file), 'hello\n');
  let state = await service.state(cwd);
  assert.equal(state.files[0].path, file);
  state = await service.mutate(cwd, { action: 'stage', file, expected: state.token });
  assert.equal(state.files[0].index, 'A');
  state = await service.mutate(cwd, { action: 'unstage', file, expected: state.token });
  assert.equal(await fs.readFile(path.join(cwd, file), 'utf8'), 'hello\n');
  state = await service.mutate(cwd, { action: 'stage', file, expected: state.token });
  const stale = state.token;
  await fs.writeFile(path.join(cwd, file), 'changed\n'); await service.git(cwd, ['add', '--', file]);
  await assert.rejects(service.mutate(cwd, { action: 'commit', message: 'stale', expected: stale }), /상태가 바뀌/);
  state = await service.state(cwd);
  state = await service.mutate(cwd, { action: 'commit', message: 'initial commit', expected: state.token });
  assert.ok(state.head); assert.equal(state.files.length, 0);
  await service.git(cwd, ['mv', '--', file, 'renamed.txt']);
  state = await service.state(cwd);
  assert.equal(state.files.length, 1); assert.equal(state.files[0].originalPath, file);
  state = await service.mutate(cwd, { action: 'unstage', file: 'renamed.txt', expected: state.token });
  assert.ok(state.files.some(f => f.path === 'renamed.txt'));
  await service.git(cwd, ['add', '-A']); await service.git(cwd, ['commit', '-m', 'rename']);
  state = await service.state(cwd);
  const target = path.join(root, 'linked tree');
  await service.mutate(cwd, { action: 'worktree-add', expected: state.token, name: 'feature/parallel', target, base: 'HEAD' });
  const list = await service.worktrees(cwd); assert.equal(list.length, 2); assert.equal(list[1].path, target);
  assert.equal((await service.state(target)).branch, 'feature/parallel');
  await fs.writeFile(path.join(target, 'dirty.txt'), 'keep');
  await assert.rejects(service.mutate(cwd, { action: 'worktree-remove', expected: (await service.state(cwd)).token, target }), /변경 사항/);
  await fs.unlink(path.join(target, 'dirty.txt'));
  await service.mutate(cwd, { action: 'worktree-lock', expected: (await service.state(cwd)).token, target });
  assert.equal((await service.worktrees(cwd))[1].locked, true);
  await service.mutate(cwd, { action: 'worktree-unlock', expected: (await service.state(cwd)).token, target });
  await service.mutate(cwd, { action: 'worktree-remove', expected: (await service.state(cwd)).token, target });
  assert.equal((await service.worktrees(cwd)).length, 1);
});

test('comparison previews only the literal file or rename selected, even across a file/directory transition', async t => {
  const { cwd } = await fixture(t);
  const beforeName = 'old[?].txt', afterName = 'new[?].txt', changedType = 'item[?]';
  await fs.writeFile(path.join(cwd, beforeName), 'renamed content\n');
  await fs.writeFile(path.join(cwd, changedType), 'previous file\n');
  await service.git(cwd, ['add', '.']); await service.git(cwd, ['commit', '-m', 'before']);
  const before = (await service.git(cwd, ['rev-parse', 'HEAD'])).trim();
  await fs.rename(path.join(cwd, beforeName), path.join(cwd, afterName));
  await fs.unlink(path.join(cwd, changedType)); await fs.mkdir(path.join(cwd, changedType));
  await fs.writeFile(path.join(cwd, changedType, 'child'), 'unrelated child\n');
  await service.git(cwd, ['add', '-A']); await service.git(cwd, ['commit', '-m', 'after']);
  const result = await service.compare(cwd, { a: 'HEAD', b: before, mode: 'a' });
  assert.deepEqual(result.files.find(file => file.path === afterName), { status: 'R', path: afterName, originalPath: beforeName });
  const input = { from: before, to: result.a };
  const rename = await service.compareFile(cwd, { ...input, file: afterName, originalPath: beforeName });
  assert.match(rename.patch, /rename from old/); assert.match(rename.patch, /rename to new/);
  const deleted = await service.compareFile(cwd, { ...input, file: changedType });
  assert.match(deleted.patch, /-previous file/); assert.doesNotMatch(deleted.patch, /unrelated child/);
  await assert.rejects(service.compareFile(cwd, { ...input, file: '../outside' }), /파일/);
});

test('comparison uses reachable sets, does not checkout, and filters beyond visible history', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'base.txt', 'base\n', 'needle [literal]');
  const base = (await service.state(cwd)).head;
  await service.git(cwd, ['branch', 'feature']);
  await commit(cwd, 'main.txt', 'main\n', 'main only');
  await service.git(cwd, ['switch', 'feature']);
  await commit(cwd, 'feature.txt', 'feature\n', 'feature only');
  for (const [mode, expected] of [['a', ['feature only']], ['b', ['main only']], ['common', ['needle [literal]']]]) {
    const result = await service.compare(cwd, { a: 'feature', b: 'main', mode, diffMode: 'endpoints' });
    assert.equal(Object.hasOwn(result, 'diff'), false); assert.deepEqual(result.files.map(file => file.path), ['feature.txt', 'main.txt']);
    assert.deepEqual(result.commits.map(c => c.message), expected); assert.equal(result.aOnly, 1); assert.equal(result.bOnly, 1);
  }
  assert.equal((await service.state(cwd)).branch, 'feature');
  const introduced = await service.compare(cwd, { a: 'feature', b: 'main', mode: 'a', diffMode: 'introduced' });
  assert.deepEqual(introduced.files, [{ status: 'A', path: 'feature.txt' }]);
  assert.match((await service.compareFile(cwd, { from: introduced.diffBase, to: introduced.a, file: 'feature.txt' })).patch, /diff --git[\s\S]*@@/);
  const root = await service.compareCommit(cwd, base);
  assert.deepEqual(root.files, [{ status: 'A', path: 'base.txt' }]);
  const tips = { a: introduced.a, b: introduced.b };
  for (const [sha, expected] of [[base, 'common'], [tips.a, 'source'], [tips.b, 'target']]) {
    assert.equal((await service.compareCommit(cwd, sha, tips)).membership, expected);
  }
  await assert.rejects(service.compareCommit(cwd, base, { a: '--all', b: tips.b }), /비교할 브랜치/);
  assert.match((await service.compareFile(cwd, { from: root.diffBase, to: base, file: 'base.txt' })).patch, /\+base/);
  const raw = await service.git(cwd, ['rev-list', 'main...feature']);
  assert.deepEqual(new Set((await service.compare(cwd, { a: 'feature', b: 'main', mode: 'different' })).commits.map(c => c.sha)), new Set(raw.trim().split('\n')));
  // Create history quickly without hooks or repeated worktree writes.
  let parent = (await service.state(cwd)).head;
  const tree = (await service.git(cwd, ['rev-parse', 'HEAD^{tree}'])).trim();
  for (let i = 0; i < 405; i++) parent = (await service.git(cwd, ['commit-tree', tree, '-p', parent, '-m', `later ${i}`])).trim();
  await service.git(cwd, ['update-ref', 'refs/heads/feature', parent]);
  const first = await service.history(cwd, { ref: 'feature' }); assert.equal(first.commits.length, 100); assert.equal(first.hasMore, true);
  const second = await service.history(cwd, { ref: 'feature', offset: 100 }); assert.notEqual(second.commits[0].sha, first.commits[0].sha);
  const all = await service.history(cwd);
  await service.git(cwd, ['update-ref', 'refs/heads/feature', base]);
  const stable = await service.history(cwd, { ref: 'feature', offset: 100, revisions: first.revisions });
  assert.deepEqual(stable.commits, second.commits, 'A moving branch cannot alter the captured history');
  const allStable = await service.history(cwd, { revisions: all.revisions });
  assert.deepEqual(allStable.commits, all.commits, 'All-branch snapshots retain their original roots');
  await assert.rejects(service.history(cwd, { revisions: ['--all'] }), /조회 기준/);
  await service.git(cwd, ['update-ref', 'refs/heads/feature', parent]);
  const filtered = await service.history(cwd, { ref: 'feature', query: 'needle [literal]' }); assert.deepEqual(filtered.commits.map(c => c.sha), [base]);
  const total = Number((await service.git(cwd, ['rev-list', '--count', 'feature'])).trim());
  const order = (await service.git(cwd, ['rev-list', '--topo-order', 'feature'])).trim().split('\n');
  for (const rank of [0, 203, total - 1]) {
    const page = await service.history(cwd, { revisions: first.revisions, focusSha: order[rank], limit: 200 });
    const start = Math.max(0, Math.min(rank - 100, total - 200));
    assert.equal(page.offset, start);
    assert.deepEqual(page.commits.map(commit => commit.sha), order.slice(start, start + 200));
    assert.equal(page.hasMore, start + 200 < total);
  }
  await assert.rejects(service.history(cwd, { focusSha: '--all' }), /이동할 커밋 SHA/);
  await assert.rejects(service.history(cwd, { ref: 'main', focusSha: parent }), /선택한 커밋을 찾을 수 없습니다/);
  for (const offset of [total - 2, total + 200]) {
    const tail = await service.history(cwd, { ref: 'feature', offset, limit: 8, anchorSha: '0'.repeat(40) });
    assert.equal(tail.offset, total - 8);
    assert.equal(tail.commits.length, 8);
    assert.equal(tail.commits.at(-1).sha, base);
    assert.equal(tail.hasMore, false);
  }
  const shifted = await service.history(cwd, { ref: 'feature', offset: 140, limit: 8, anchorSha: parent });
  assert.equal(shifted.offset, 0);
  assert.equal(shifted.commits[0].sha, parent);
  const other = await service.history(cwd, { ref: 'feature', offset: 140, limit: 8, anchorSha: (await service.git(cwd, ['rev-parse', 'main'])).trim() });
  assert.equal(other.offset, 140);
  const narrowed = await service.history(cwd, { ref: 'feature', offset: 140, query: 'needle [literal]', anchorSha: parent });
  assert.equal(narrowed.offset, 0);
  assert.deepEqual(narrowed.commits.map(c => c.sha), [base]);
  await assert.rejects(service.history(cwd, { anchorSha: '--all' }), /복원할 커밋/);
  const link = `https://github.com/example/fixture/pull/8/commits/${parent}#diff-a`;
  for (const query of [parent.slice(0, 9), link]) {
    const found = await service.history(cwd, { query, ref: 'feature' });
    assert.deepEqual(found.commits.map(commit => commit.sha), [parent]);
    assert.equal(found.hasMore, false);
    assert.equal((await service.history(cwd, { query, ref: 'main' })).commits.length, 0);
    assert.equal((await service.history(cwd, { query, file: 'other.txt' })).commits.length, 0);
  }
  assert.equal((await service.history(cwd, { limit: 250 })).commits.length, 250);
  await assert.rejects(service.history(cwd, { limit: 1001 }), /조회 개수/);
  await assert.rejects(service.history(cwd, { offset: -1 }), /조회 위치/);
  await assert.rejects(service.compare(cwd, { a: '--help', b: 'main', mode: 'a' }), /선택하세요/);
});

test('a rebased bookmark opens at its previous rank while the old object is still on disk', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'base', 'base', 'base');
  await service.git(cwd, ['branch', 'topic']);
  await commit(cwd, 'upstream', 'new', 'upstream');
  await service.git(cwd, ['switch', 'topic']);
  await commit(cwd, 'topic', 'first', 'topic one');
  await commit(cwd, 'topic', 'second', 'topic two');
  const saved = (await service.history(cwd, { ref: 'topic', offset: 1, limit: 1 })).commits[0];
  await service.git(cwd, ['rebase', 'main']);
  assert.equal((await service.git(cwd, ['cat-file', '-t', saved.sha])).trim(), 'commit');
  const result = await service.history(cwd, { ref: 'topic', offset: 1, limit: 1, anchorSha: saved.sha });
  assert.equal(result.offset, 1);
  assert.equal(result.commits[0].message, saved.message);
  assert.notEqual(result.commits[0].sha, saved.sha);
});

test('detached commits and date boundaries remain queryable', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'base', 'base', 'base');
  await service.git(cwd, ['switch', '--detach']);
  await commit(cwd, 'detached', 'new', 'detached commit');
  const head = (await service.state(cwd)).head;
  assert.equal((await service.history(cwd)).commits[0].sha, head);
  assert.equal((await service.history(cwd, { after: '2099-01-01T00:00:00Z' })).commits.length, 0);
  assert.equal((await service.history(cwd, { before: '2000-01-01T00:00:00Z' })).commits.length, 0);
  const current = await service.state(cwd);
  await service.mutate(cwd, { action: 'switch', ref: 'refs/heads/main', expected: current.token });
  assert.equal((await service.state(cwd)).branch, 'main');
});

test('continue merge and rebase checks reviewed state, conflicts, unstaged edits and operation identity', async t => {
  for (const operation of ['merge', 'rebase']) {
    const { cwd } = await fixture(t)
    await commit(cwd, 'conflict.txt', 'base\n', 'base')
    await service.git(cwd, ['switch', '-c', 'topic'])
    await commit(cwd, 'conflict.txt', 'topic\n', 'topic')
    await service.git(cwd, ['switch', 'main'])
    await commit(cwd, 'conflict.txt', 'main\n', 'main')
    await assert.rejects(service.git(cwd, [operation, 'topic']))
    let current = await service.state(cwd)
    await assert.rejects(service.mutate(cwd, { action: 'continue', operation, expected: current.token }), /먼저 해결/)
    await fs.writeFile(path.join(cwd, 'conflict.txt'), 'resolved\n')
    await service.git(cwd, ['add', '.'])
    current = await service.state(cwd)
    const before = current.token
    const control = path.join(cwd, '.git', operation === 'merge' ? 'MERGE_MSG' : 'rebase-merge/git-rebase-todo')
    await fs.appendFile(control, '\n')
    await assert.rejects(service.mutate(cwd, { action: 'continue', operation, expected: before }), /상태가 바뀌/)
    await fs.writeFile(path.join(cwd, 'conflict.txt'), 'unstaged\n')
    current = await service.state(cwd)
    await assert.rejects(service.mutate(cwd, { action: 'continue', operation, expected: current.token }), /스테이징/)
    await service.git(cwd, ['add', '.'])
    current = await service.state(cwd)
    await assert.rejects(service.mutate(cwd, { action: 'continue', operation: 'cherry-pick', expected: current.token }), /진행 중 Git 작업/)
    current = await service.mutate(cwd, { action: 'continue', operation, expected: current.token })
    assert.equal(current.operation, null)
    assert.equal(await fs.readFile(path.join(cwd, 'conflict.txt'), 'utf8'), 'unstaged\n')
    await assert.rejects(service.mutate(cwd, { action: 'continue', operation, expected: current.token }), /진행 중 Git 작업/)
  }
})

test('reviewed integration starts safely, exposes conflicts and abort restores merge/rebase/cherry-pick', async t => {
  for (const operation of ['merge', 'rebase', 'cherry-pick']) {
    const { cwd } = await fixture(t)
    await commit(cwd, '한글.txt', 'base\n', 'base')
    await service.git(cwd, ['switch', '-c', 'topic'])
    await commit(cwd, '한글.txt', 'topic\n', 'topic')
    const topic = (await service.state(cwd)).head
    await service.git(cwd, ['switch', 'main'])
    await commit(cwd, '한글.txt', 'main\n', 'main')
    let current = await service.state(cwd), before = current.head
    if (operation === 'cherry-pick') await assert.rejects(service.git(cwd, [operation, topic]))
    else {
      await fs.writeFile(path.join(cwd, 'draft.txt'), 'keep')
      await assert.rejects(service.mutate(cwd, { action: operation, base: topic, expected: (await service.state(cwd)).token }), /Stash/)
      await fs.unlink(path.join(cwd, 'draft.txt'))
      await assert.rejects(service.mutate(cwd, { action: operation, base: topic, expected: current.token }))
    }
    current = await service.state(cwd)
    assert.equal(current.operation, operation)
    assert.ok(current.files.some(file => file.conflict))
    await assert.rejects(service.mutate(cwd, { action: 'abort', operation: 'unknown', expected: current.token }), /작업이 바뀌/)
    const stale = current.token
    await fs.writeFile(path.join(cwd, '한글.txt'), 'manual edit\n')
    await assert.rejects(service.mutate(cwd, { action: 'abort', operation, expected: stale }), /상태가 바뀌/)
    current = await service.mutate(cwd, { action: 'abort', operation, expected: (await service.state(cwd)).token })
    assert.equal(current.operation, null); assert.equal(current.head, before); assert.equal(current.branch, 'main')
    assert.equal(await fs.readFile(path.join(cwd, '한글.txt'), 'utf8'), 'main\n')
  }
})

test('fast-forward merge, existing/detached worktrees, bulk staging and readable Korean diffs', async t => {
  const { cwd, root } = await fixture(t)
  await fs.writeFile(path.join(cwd, '한글.txt'), 'base\n')
  let current = await service.mutate(cwd, { action: 'stage-all', expected: (await service.state(cwd)).token })
  current = await service.mutate(cwd, { action: 'unstage-all', expected: current.token })
  assert.equal(current.files[0].untracked, true)
  await commit(cwd, '한글.txt', 'base\n', 'base')
  await service.git(cwd, ['switch', '-c', 'topic'])
  await commit(cwd, '한글.txt', 'topic\n', 'topic')
  const topic = (await service.state(cwd)).head
  await service.git(cwd, ['switch', 'main'])
  const comparison = await service.compare(cwd, { a: 'topic', b: 'main', mode: 'a' });
  assert.match((await service.compareFile(cwd, { from: comparison.diffBase, to: comparison.a, file: '한글.txt' })).patch, /한글.txt/)
  assert.match(await service.diff(cwd, { sha: topic }), /한글.txt/)
  current = await service.mutate(cwd, { action: 'merge', base: topic, expected: (await service.state(cwd)).token })
  assert.equal(current.head, topic); assert.equal(current.branch, 'main')
  await fs.writeFile(path.join(cwd, '한글.txt'), 'more\n')
  assert.match(await service.diff(cwd, { file: '한글.txt' }), /한글.txt/)
  current = await service.mutate(cwd, { action: 'stage-all', expected: (await service.state(cwd)).token })
  current = await service.mutate(cwd, { action: 'unstage-all', expected: current.token })
  assert.equal(current.files[0].working, 'M')
  await service.mutate(cwd, { action: 'worktree-add', worktreeMode: 'existing', ref: 'refs/heads/topic', target: path.join(root, 'existing'), expected: current.token })
  assert.equal((await service.state(path.join(root, 'existing'))).branch, 'topic')
  await assert.rejects(service.mutate(cwd, { action: 'worktree-add', worktreeMode: 'existing', ref: 'refs/heads/topic', target: path.join(root, 'duplicate'), expected: (await service.state(cwd)).token }), /사용 중/)
  await service.mutate(cwd, { action: 'worktree-add', worktreeMode: 'detached', base: topic, target: path.join(root, 'detached'), expected: (await service.state(cwd)).token })
  assert.equal((await service.state(path.join(root, 'detached'))).branch, null)
  // New worktree from a remote-tracking branch tracks it; a moved remote tip is rejected.
  await service.git(cwd, ['remote', 'add', 'origin', path.join(root, 'origin.git')])
  await service.git(cwd, ['update-ref', 'refs/remotes/origin/feat', topic])
  await service.mutate(cwd, { action: 'worktree-add', name: 'feat', upstream: 'refs/remotes/origin/feat', base: topic, target: path.join(root, 'tracked'), expected: (await service.state(cwd)).token })
  assert.equal((await service.git(path.join(root, 'tracked'), ['rev-parse', '--abbrev-ref', '@{upstream}'])).trim(), 'origin/feat')
  await assert.rejects(service.mutate(cwd, { action: 'worktree-add', name: 'feat2', upstream: 'refs/remotes/origin/feat', base: current.head === topic ? 'HEAD~1' : 'HEAD', target: path.join(root, 'stale'), expected: (await service.state(cwd)).token }), /변경되었습니다/)
})

test('branch menu: tracking checkout, guarded rename/delete, stale review and occupied worktrees', async t => {
  const { cwd, root } = await fixture(t);
  await commit(cwd, 'base.txt', 'base', 'base');
  const base = (await service.state(cwd)).head;
  await service.git(cwd, ['remote', 'add', 'origin', path.join(root, 'offline.git')]);
  await service.git(cwd, ['update-ref', 'refs/remotes/origin/feature/review', base]);
  await service.git(cwd, ['branch', 'origin/feature/review']);
  const run = async (action, ref, name) => {
    const state = await service.state(cwd);
    return service.mutate(cwd, { action, ref, name, base: state.refs.find(r => r.ref === ref)?.sha, expected: state.token });
  };
  await run('switch-remote', 'refs/remotes/origin/feature/review', 'review/local');
  assert.equal((await service.state(cwd)).branch, 'review/local');
  assert.equal((await service.git(cwd, ['rev-parse', '--symbolic-full-name', '@{u}'])).trim(), 'refs/remotes/origin/feature/review');
  await run('branch-rename', 'refs/heads/review/local', '검토/완료');
  assert.equal((await service.state(cwd)).branch, '검토/완료');
  await assert.rejects(run('branch-delete', 'refs/heads/검토/완료'), /Worktree/);
  await service.git(cwd, ['switch', 'main']);
  await run('branch-delete', 'refs/heads/검토/완료');
  assert.ok((await service.state(cwd)).refs.some(r => r.ref === 'refs/remotes/origin/feature/review'));
  await service.git(cwd, ['switch', '-c', 'unmerged']);
  await commit(cwd, 'review.txt', 'keep this', 'unmerged');
  await service.git(cwd, ['switch', 'main']);
  await assert.rejects(run('branch-delete', 'refs/heads/unmerged'), /병합되지/);
  await service.git(cwd, ['worktree', 'add', path.join(root, 'other'), 'unmerged']);
  await assert.rejects(run('branch-rename', 'refs/heads/unmerged', 'moved'), /Worktree/);
  await assert.rejects(run('branch-rename', 'refs/heads/main', '-bad'), /이름/);
  await assert.rejects(run('switch-remote', 'refs/remotes/origin/feature/review', 'main'), /이미 있습니다/);
  const state = await service.state(cwd);
  await assert.rejects(service.mutate(cwd, { action: 'branch-delete', ref: 'refs/heads/unmerged', base, expected: state.token }), /대상 브랜치/);
  await service.git(cwd, ['branch', 'changed']);
  await assert.rejects(service.mutate(cwd, { action: 'branch-rename', ref: 'refs/heads/main', name: 'oops', base, expected: state.token }), /상태가 바뀌/);
  await fs.writeFile(path.join(cwd, 'dirty.txt'), 'preserve');
  await run('switch-remote', 'refs/remotes/origin/feature/review', 'dirty');
  assert.equal((await service.state(cwd)).branch, 'dirty');
  assert.equal((await service.git(cwd, ['stash', 'list'])).trim(), '');
  assert.equal(await fs.readFile(path.join(cwd, 'dirty.txt'), 'utf8'), 'preserve');
});

test('cherry-pick preserves reviewed SHA, mainline, clean-tree guard and conflict recovery', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'base.txt', 'base\n', 'base');
  const base = (await service.state(cwd)).head;
  await service.git(cwd, ['switch', '-c', 'topic']);
  await commit(cwd, 'feature.txt', 'feature\n', 'feature');
  const source = (await service.state(cwd)).head;
  await service.git(cwd, ['switch', 'main']);
  const before = await service.state(cwd);
  await assert.rejects(service.mutate(cwd, { action: 'cherry-pick', base: source, expected: 'stale' }), /상태가 바뀌/);
  await fs.writeFile(path.join(cwd, 'dirty.txt'), 'untracked');
  await assert.rejects(service.mutate(cwd, { action: 'cherry-pick', base: source, expected: (await service.state(cwd)).token }), /보관/);
  await fs.unlink(path.join(cwd, 'dirty.txt'));
  await service.mutate(cwd, { action: 'cherry-pick', base: source, expected: (await service.state(cwd)).token });
  assert.equal(await fs.readFile(path.join(cwd, 'feature.txt'), 'utf8'), 'feature\n');
  assert.match(await service.git(cwd, ['log', '-1', '--format=%B']), new RegExp(source));
  assert.equal((await service.state(cwd)).branch, before.branch);
  await assert.rejects(service.mutate(cwd, { action: 'cherry-pick', base: source, expected: (await service.state(cwd)).token }), /empty|nothing to commit/);
  assert.equal((await service.state(cwd)).operation, 'cherry-pick');
  await service.mutate(cwd, { action: 'skip', operation: 'cherry-pick', expected: (await service.state(cwd)).token });
  assert.equal((await service.state(cwd)).operation, null);
  await service.git(cwd, ['switch', '-c', 'conflict-source', base]);
  await commit(cwd, 'base.txt', 'source\n', 'source conflict');
  const conflict = (await service.state(cwd)).head;
  await service.git(cwd, ['switch', 'main']);
  await commit(cwd, 'base.txt', 'target\n', 'target conflict');
  const target = (await service.state(cwd)).head;
  await assert.rejects(service.mutate(cwd, { action: 'cherry-pick', base: conflict, expected: (await service.state(cwd)).token }), /conflict|CONFLICT/);
  assert.equal((await service.state(cwd)).operation, 'cherry-pick');
  await service.mutate(cwd, { action: 'abort', operation: 'cherry-pick', expected: (await service.state(cwd)).token });
  assert.equal((await service.state(cwd)).head, target);
  await assert.rejects(service.mutate(cwd, { action: 'cherry-pick', base: conflict, expected: (await service.state(cwd)).token }), /conflict|CONFLICT/);
  await fs.writeFile(path.join(cwd, 'base.txt'), 'resolved\n'); await service.git(cwd, ['add', 'base.txt']);
  await service.mutate(cwd, { action: 'continue', operation: 'cherry-pick', expected: (await service.state(cwd)).token });
  assert.equal((await service.state(cwd)).operation, null);
  assert.equal(await fs.readFile(path.join(cwd, 'base.txt'), 'utf8'), 'resolved\n');
  const tree = (await service.git(cwd, ['rev-parse', `${source}^{tree}`])).trim();
  const merge = (await service.git(cwd, ['commit-tree', tree, '-p', base, '-p', source, '-m', 'merge fixture'])).trim();
  await assert.rejects(service.mutate(cwd, { action: 'cherry-pick', base: merge, expected: (await service.state(cwd)).token }), /부모/);
  await service.git(cwd, ['switch', '-c', 'mainline-target', base]);
  await service.mutate(cwd, { action: 'cherry-pick', base: merge, mainline: 1, expected: (await service.state(cwd)).token });
  assert.equal(await fs.readFile(path.join(cwd, 'feature.txt'), 'utf8'), 'feature\n');
});

test('automatic checkout carries staged/unstaged/untracked changes and retains recovery stashes on failure', async t => {
  const run = async (cwd, ref) => service.mutate(cwd, { action: 'switch', ref: `refs/heads/${ref}`, expected: (await service.state(cwd)).token });
  await t.test('local and tracking checkout carry parent edits and nested repositories without stash', async t => {
    const { cwd, root } = await fixture(t);
    await commit(cwd, 'base.txt', 'base\n', 'base');
    await service.git(cwd, ['branch', 'topic']);
    const base = (await service.state(cwd)).head;
    await service.git(cwd, ['update-ref', 'refs/remotes/origin/review', base]);
    await service.git(cwd, ['remote', 'add', 'origin', cwd]);
    const nested = path.join(cwd, 'config', '한글 설정', 'telegraf');
    await fs.mkdir(nested, { recursive: true });
    await service.git(nested, ['init', '-b', 'main']);
    await service.git(nested, ['config', 'user.name', 'Nested']);
    await service.git(nested, ['config', 'user.email', 'nested@example.invalid']);
    await service.git(nested, ['config', 'commit.gpgsign', 'false']);
    await commit(nested, 'inner.txt', 'base\n', 'inner base');
    await fs.writeFile(path.join(nested, 'inner.txt'), 'staged\n');
    await service.git(nested, ['add', '.']);
    await fs.writeFile(path.join(nested, 'inner.txt'), 'staged\nworking\n');
    await fs.writeFile(path.join(nested, 'draft.txt'), 'untracked\n');
    await service.git(cwd, ['add', '--', 'config']);
    await service.git(cwd, ['config', 'submodule.recurse', 'true']);
    await fs.writeFile(path.join(cwd, 'base.txt'), 'parent edits\n');
    const hooks = path.join(root, 'hooks'); await fs.mkdir(hooks);
    await fs.writeFile(path.join(hooks, 'post-checkout'), '#!/bin/sh\ngit rev-parse -q --verify refs/stash >> "' + path.join(root, 'observed-stashes') + '" || true\n', { mode: 0o755 });
    await service.git(cwd, ['config', 'core.hooksPath', hooks]);
    const index = await service.git(cwd, ['write-tree']), innerIndex = await service.git(nested, ['write-tree']);
    const innerHead = (await service.state(nested)).head;
    assert.match(await service.git(cwd, ['ls-files', '--stage']), /160000/);
    await run(cwd, 'topic');
    const current = await service.state(cwd);
    await service.mutate(cwd, { action: 'switch-remote', ref: 'refs/remotes/origin/review', base, name: 'review/local', expected: current.token });
    assert.equal((await service.state(cwd)).branch, 'review/local');
    assert.equal((await fs.readFile(path.join(root, 'observed-stashes'), 'utf8')).trim(), '');
    assert.equal(await fs.readFile(path.join(cwd, 'base.txt'), 'utf8'), 'parent edits\n');
    assert.equal(await service.git(cwd, ['write-tree']), index);
    assert.equal(await service.git(nested, ['write-tree']), innerIndex);
    assert.equal((await service.state(nested)).head, innerHead);
    assert.equal(await fs.readFile(path.join(nested, 'inner.txt'), 'utf8'), 'staged\nworking\n');
    assert.equal(await fs.readFile(path.join(nested, 'draft.txt'), 'utf8'), 'untracked\n');
    assert.equal(await service.git(cwd, ['stash', 'list']), '');
    // A gitlink-only edit can also travel with a native checkout without a stash.
    await fs.writeFile(path.join(cwd, 'base.txt'), 'base\n');
    await run(cwd, 'main');
    assert.equal((await fs.readFile(path.join(root, 'observed-stashes'), 'utf8')).trim(), '');
    assert.equal(await service.git(cwd, ['write-tree']), index);
    assert.equal(await service.git(cwd, ['stash', 'list']), '');
    await fs.writeFile(path.join(cwd, 'base.txt'), 'parent edits\n');
    await fs.writeFile(path.join(hooks, 'post-checkout'), '#!/bin/sh\nprintf "external edit\\n" > "config/한글 설정/telegraf/inner.txt"\n', { mode: 0o755 });
    await assert.rejects(run(cwd, 'topic'), /중첩 저장소의 상태/);
    assert.equal((await service.state(cwd)).branch, 'topic');
    assert.equal(await fs.readFile(path.join(cwd, 'base.txt'), 'utf8'), 'parent edits\n');
    assert.equal(await service.git(cwd, ['stash', 'list']), '');
    assert.equal(await fs.readFile(path.join(nested, 'inner.txt'), 'utf8'), 'external edit\n');
  });
  await t.test('non-overlapping checkout preserves index, mixed edits, rename, binary and previous stashes without temporary stash', async t => {
    const { cwd, root } = await fixture(t);
    await commit(cwd, 'mixed.txt', 'base\n', 'base');
    await commit(cwd, 'rename.txt', 'rename\n', 'rename');
    await service.git(cwd, ['branch', 'topic']);
    await fs.writeFile(path.join(cwd, 'old.txt'), 'old stash');
    await service.git(cwd, ['stash', 'push', '-u', '-m', 'keep previous']);
    const previous = await service.git(cwd, ['stash', 'list', '--format=%H']);
    await fs.writeFile(path.join(cwd, 'mixed.txt'), 'staged\n');
    await service.git(cwd, ['add', 'mixed.txt']);
    await fs.writeFile(path.join(cwd, 'mixed.txt'), 'staged\nunstaged\n');
    await service.git(cwd, ['mv', 'rename.txt', '이름 변경.txt']);
    const bytes = Buffer.from([0, 1, 255, 0, 42]);
    await fs.writeFile(path.join(cwd, 'binary.dat'), bytes);
    const index = await service.git(cwd, ['write-tree']);
    const changed = await service.git(cwd, ['diff', '--binary']);
    const hooks = path.join(root, 'hooks'); await fs.mkdir(hooks);
    await fs.writeFile(path.join(hooks, 'post-checkout'), '#!/bin/sh\ngit rev-parse refs/stash > "' + path.join(root, 'observed-stash') + '"\n', { mode: 0o755 });
    await service.git(cwd, ['config', 'core.hooksPath', hooks]);
    const after = await run(cwd, 'topic');
    const observed = (await fs.readFile(path.join(root, 'observed-stash'), 'utf8')).trim();
    assert.equal(observed, previous.trim(), 'No temporary stash during checkout');
    assert.equal(after.branch, 'topic');
    assert.equal(await service.git(cwd, ['write-tree']), index);
    assert.equal(await service.git(cwd, ['diff', '--binary']), changed);
    assert.deepEqual(await fs.readFile(path.join(cwd, 'binary.dat')), bytes);
    assert.equal(await service.git(cwd, ['stash', 'list', '--format=%H']), previous);
  });
  await t.test('checkout uses the latest branch tip and edits despite an older UI snapshot', async t => {
    const { cwd } = await fixture(t);
    await commit(cwd, 'base.txt', 'base\n', 'base');
    await service.git(cwd, ['branch', 'topic']);
    await service.git(cwd, ['remote', 'add', 'origin', cwd]);
    const before = await service.state(cwd);
    const tree = (await service.git(cwd, ['rev-parse', 'HEAD^{tree}'])).trim();
    const newer = (await service.git(cwd, ['commit-tree', tree, '-p', before.head, '-m', 'updated branch tip'])).trim();
    await service.git(cwd, ['update-ref', 'refs/heads/topic', newer]);
    await service.git(cwd, ['update-ref', 'refs/remotes/origin/review', newer]);
    await fs.writeFile(path.join(cwd, 'base.txt'), 'latest editor changes\n');
    await fs.writeFile(path.join(cwd, 'new.txt'), 'new file\n');
    const after = await service.mutate(cwd, { action: 'switch', ref: 'refs/heads/topic', base: before.head, expected: before.token });
    assert.equal(after.head, newer); assert.equal(after.branch, 'topic');
    await service.mutate(cwd, { action: 'switch-remote', ref: 'refs/remotes/origin/review', name: 'review/local', base: before.head, expected: before.token });
    assert.equal((await service.state(cwd)).branch, 'review/local');
    assert.equal(await fs.readFile(path.join(cwd, 'base.txt'), 'utf8'), 'latest editor changes\n');
    assert.equal(await fs.readFile(path.join(cwd, 'new.txt'), 'utf8'), 'new file\n');
    assert.equal(await service.git(cwd, ['stash', 'list']), '');
    await assert.rejects(service.mutate(cwd, { action: 'switch', ref: 'refs/heads/missing', expected: before.token }), /로컬 브랜치/);
  });
  await t.test('apply conflict returns to the source branch with the exact local edits', async t => {
    const { cwd } = await fixture(t);
    await commit(cwd, 'same.txt', 'base\n', 'base');
    await service.git(cwd, ['switch', '-c', 'topic']);
    await commit(cwd, 'same.txt', 'topic\n', 'topic');
    await service.git(cwd, ['switch', 'main']);
    await fs.writeFile(path.join(cwd, 'same.txt'), 'local edits\n');
    await assert.rejects(run(cwd, 'topic'), /겹쳐 체크아웃하지 않았습니다/);
    const after = await service.state(cwd);
    assert.equal(after.branch, 'main'); assert.ok(!after.files.some(file => file.conflict));
    assert.equal(await fs.readFile(path.join(cwd, 'same.txt'), 'utf8'), 'local edits\n');
    assert.equal(await service.git(cwd, ['stash', 'list']), '');
  });
  await t.test('overlapping files use automatic stash and restore staged and working changes', async t => {
    const { cwd } = await fixture(t);
    const lines = Array.from({ length: 24 }, (_, i) => `line ${i}\n`);
    await commit(cwd, 'same.txt', lines.join(''), 'base');
    await service.git(cwd, ['switch', '-c', 'topic']);
    const incoming = [...lines]; incoming[23] = 'remote tail\n';
    await commit(cwd, 'same.txt', incoming.join(''), 'remote edit');
    await service.git(cwd, ['switch', 'main']);
    const staged = [...lines]; staged[0] = 'staged first\n';
    await fs.writeFile(path.join(cwd, 'same.txt'), staged.join('')); await service.git(cwd, ['add', 'same.txt']);
    const working = [...staged]; working[1] = 'working second\n';
    await fs.writeFile(path.join(cwd, 'same.txt'), working.join(''));
    await assert.rejects(service.git(cwd, ['switch', '--no-overwrite-ignore', 'topic']), /overwritten/);
    await run(cwd, 'topic');
    staged[23] = incoming[23]; working[23] = incoming[23];
    assert.equal((await service.state(cwd)).branch, 'topic');
    assert.equal(await service.git(cwd, ['show', ':same.txt']), staged.join(''));
    assert.equal(await fs.readFile(path.join(cwd, 'same.txt'), 'utf8'), working.join(''));
    assert.equal(await service.git(cwd, ['stash', 'list']), '');
  });
  await t.test('a failing post-checkout hook is not retried and leaves carried edits in place', async t => {
    const { cwd, root } = await fixture(t);
    await commit(cwd, 'base.txt', 'base\n', 'base');
    await service.git(cwd, ['branch', 'topic']);
    await fs.writeFile(path.join(cwd, 'draft.txt'), 'preserve\n');
    const hooks = path.join(root, 'hooks'); await fs.mkdir(hooks);
    await fs.writeFile(path.join(hooks, 'post-checkout'), '#!/bin/sh\nprintf "hook edit\\n" > hook-created.txt\nexit 1\n', { mode: 0o755 });
    await service.git(cwd, ['config', 'core.hooksPath', hooks]);
    await assert.rejects(run(cwd, 'topic'));
    assert.equal((await service.state(cwd)).branch, 'topic');
    assert.equal(await fs.readFile(path.join(cwd, 'draft.txt'), 'utf8'), 'preserve\n');
    assert.equal(await fs.readFile(path.join(cwd, 'hook-created.txt'), 'utf8'), 'hook edit\n');
    assert.equal(await service.git(cwd, ['stash', 'list']), '');
  });
  await t.test('failed switch restores original edits and keeps backup; ignored files survive', async t => {
    const { cwd } = await fixture(t);
    await commit(cwd, '.gitignore', 'ignored.txt\n', 'ignore');
    await commit(cwd, 'edit.txt', 'base\n', 'base');
    await service.git(cwd, ['switch', '-c', 'topic']);
    await fs.writeFile(path.join(cwd, 'ignored.txt'), 'tracked target\n');
    await service.git(cwd, ['add', '-f', 'ignored.txt']); await service.git(cwd, ['commit', '-m', 'target']);
    await service.git(cwd, ['switch', 'main']);
    await fs.writeFile(path.join(cwd, 'ignored.txt'), 'private ignored content\n');
    await fs.writeFile(path.join(cwd, 'edit.txt'), 'keep staged\n'); await service.git(cwd, ['add', 'edit.txt']);
    await assert.rejects(run(cwd, 'topic'), /체크아웃 실패.*현재 브랜치: main/);
    assert.equal((await service.state(cwd)).branch, 'main');
    assert.equal(await fs.readFile(path.join(cwd, 'ignored.txt'), 'utf8'), 'private ignored content\n');
    assert.equal(await service.git(cwd, ['show', ':edit.txt']), 'keep staged\n');
    assert.equal(await service.git(cwd, ['show', 'stash@{0}:edit.txt']), 'keep staged\n');
  });
});

test('commit file review includes merge changes relative to its first parent', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'base.txt', 'base\n', 'base');
  await service.git(cwd, ['switch', '-c', 'topic']);
  await commit(cwd, 'feature.txt', 'feature\n', 'feature');
  await service.git(cwd, ['switch', 'main']);
  await commit(cwd, 'main.txt', 'main\n', 'main');
  await service.git(cwd, ['merge', '--no-edit', 'topic']);
  const before = await service.state(cwd);
  const patch = await service.diff(cwd, { sha: before.head });
  assert.match(patch, /diff --git a\/feature.txt b\/feature.txt/);
  assert.doesNotMatch(patch, /diff --git a\/main.txt/);
  assert.equal((await service.state(cwd)).token, before.token);
});

test('Amend preserves unstaged/index content for message-only, reviews staged changes, and guards shared or stale HEAD', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'file.txt', 'base\n', '기존 제목\n\n기존 본문');
  const original = await service.state(cwd), author = (await service.git(cwd, ['show', '-s', '--format=%an|%ae|%aI'])).trim();
  await fs.writeFile(path.join(cwd, 'file.txt'), 'staged\n'); await service.git(cwd, ['add', 'file.txt']);
  await fs.writeFile(path.join(cwd, 'file.txt'), 'unstaged\n'); await fs.writeFile(path.join(cwd, 'untracked.txt'), 'keep');
  const index = await service.git(cwd, ['write-tree']);
  let preview = await service.amendPreview(cwd, original.head);
  assert.match(preview.message, /기존 제목\n\n기존 본문/); assert.deepEqual(preview.stagedFiles, ['file.txt']); assert.match(preview.stagedDiff, /\+staged/);
  let state = await service.mutate(cwd, { action: 'amend', base: preview.sha, expected: preview.token, message: '수정 제목\n\n수정 본문', includeStaged: false });
  assert.notEqual(state.head, original.head); assert.equal(await service.git(cwd, ['show', 'HEAD:file.txt']), 'base\n');
  assert.equal(await service.git(cwd, ['write-tree']), index); assert.equal(await fs.readFile(path.join(cwd, 'file.txt'), 'utf8'), 'unstaged\n');
  assert.equal((await service.git(cwd, ['show', '-s', '--format=%an|%ae|%aI'])).trim(), author);
  await assert.rejects(service.amendPreview(cwd, original.head), /HEAD/);
  preview = await service.amendPreview(cwd, state.head);
  await fs.writeFile(path.join(cwd, 'untracked.txt'), 'changed');
  await assert.rejects(service.mutate(cwd, { action: 'amend', base: preview.sha, expected: preview.token, message: 'stale', includeStaged: true }), /바뀌/);
  preview = await service.amendPreview(cwd, state.head);
  state = await service.mutate(cwd, { action: 'amend', base: preview.sha, expected: preview.token, message: '스테이징 반영', includeStaged: true });
  assert.equal(await service.git(cwd, ['show', 'HEAD:file.txt']), 'staged\n'); assert.equal(await service.git(cwd, ['diff', '--cached']), '');
  assert.equal(await fs.readFile(path.join(cwd, 'file.txt'), 'utf8'), 'unstaged\n');
  await service.git(cwd, ['update-ref', 'refs/remotes/origin/main', state.head]);
  preview = await service.amendPreview(cwd, state.head); assert.deepEqual(preview.published, ['origin/main']);
  const input = { action: 'amend', base: preview.sha, expected: preview.token, message: '공유 커밋 수정', includeStaged: false };
  await assert.rejects(service.mutate(cwd, input), /공유된/);
  state = await service.mutate(cwd, { ...input, rewritePublished: true });
  assert.equal((await service.git(cwd, ['rev-parse', 'refs/remotes/origin/main'])).trim(), preview.sha);
  assert.equal((await service.git(cwd, ['show', '-s', '--format=%P'])).trim(), '', 'root parents preserved');
  const hooks = path.join(cwd, '.git/hooks/pre-commit'); await fs.writeFile(hooks, '#!/bin/sh\nexit 1\n', { mode: 0o700 });
  preview = await service.amendPreview(cwd, state.head);
  await assert.rejects(service.mutate(cwd, { action: 'amend', base: preview.sha, expected: preview.token, message: 'hook rejected', includeStaged: false }));
  assert.equal((await service.state(cwd)).head, state.head); assert.equal(await fs.readFile(path.join(cwd, 'untracked.txt'), 'utf8'), 'changed');
  await service.git(cwd, ['switch', '--detach']);
  await assert.rejects(service.amendPreview(cwd, state.head), /HEAD/);
});

test('working and staged line counts, new-file patches, rename paths and binary/large handling', async t => {
  const { cwd, root } = await fixture(t);
  await commit(cwd, 'tracked.txt', 'one\ntwo\nthree\n', 'initial');
  await fs.writeFile(path.join(cwd, 'tracked.txt'), 'one\nchanged\nthree\n'); await service.git(cwd, ['add', '--', 'tracked.txt']);
  await fs.writeFile(path.join(cwd, 'tracked.txt'), 'one\nchanged\nthree\nextra\n');
  const unusual = '새 파일\t[1]\n다음.txt'; await fs.writeFile(path.join(cwd, unusual), '한글\r\n++source\r\nlast');
  await fs.writeFile(path.join(cwd, 'empty.txt'), ''); await fs.writeFile(path.join(cwd, 'binary.bin'), Buffer.from([0, 255]));
  await fs.writeFile(path.join(cwd, 'large.txt'), Buffer.alloc(1024 * 1024 + 1, 65));
  await fs.writeFile(path.join(root, 'outside.txt'), 'PRIVATE OUTSIDE CONTENT'); await fs.symlink(path.join(root, 'outside.txt'), path.join(cwd, 'link'));
  let state = await service.state(cwd), stats = await service.changeStats(cwd, state.token);
  assert.deepEqual(stats.working['tracked.txt'], { added: 1, deleted: 0 }); assert.deepEqual(stats.staged['tracked.txt'], { added: 1, deleted: 1 });
  assert.deepEqual(stats.working[unusual], { added: 3, deleted: 0 }); assert.deepEqual(stats.working['empty.txt'], { added: 0, deleted: 0 });
  assert.equal(stats.working['binary.bin'].reason, '바이너리'); assert.equal(stats.working['large.txt'].added, null);
  const patch = await service.diff(cwd, { file: unusual }); assert.match(patch, /new file mode/); assert.match(patch, /\+한글/); assert.match(patch, /\+\+\+source/); assert.match(patch, /No newline at end of file/);
  assert.doesNotMatch(await service.diff(cwd, { file: 'link' }), /PRIVATE OUTSIDE CONTENT/);
  assert.match(await service.diff(cwd, { file: 'binary.bin' }), /Binary files/);
  await service.git(cwd, ['mv', '--', 'tracked.txt', 'renamed\t한글.txt']);
  state = await service.state(cwd); stats = await service.changeStats(cwd, state.token);
  assert.deepEqual(stats.staged['renamed\t한글.txt'], { added: 1, deleted: 1 }); assert.deepEqual(stats.working['renamed\t한글.txt'], { added: 1, deleted: 0 });
  await fs.writeFile(path.join(cwd, unusual), 'changed'); await assert.rejects(service.changeStats(cwd, state.token), /상태가 바뀌었습니다/);
  await fs.mkdir(path.join(cwd, 'nested')); await service.git(path.join(cwd, 'nested'), ['init']); await fs.writeFile(path.join(cwd, 'nested/content'), 'nested');
  await assert.rejects(service.diff(cwd, { file: 'nested/' }), /일반 파일만 비교/);
  await service.git(cwd, ['reset', '--hard', 'HEAD']); await fs.rm(path.join(cwd, 'tracked.txt'));
  state = await service.state(cwd); stats = await service.changeStats(cwd, state.token); assert.deepEqual(stats.working['tracked.txt'], { added: 0, deleted: 3 });
});

test('hunk staging preserves worktree, rejects stale previews and reverses only selected index changes', async t => {
  const { cwd } = await fixture(t);
  await service.git(cwd, ['config', 'core.autocrlf', 'false']);
  const file = '한글 [변경] file.txt', original = Array.from({ length: 40 }, (_, i) => `line ${i + 1}`).join('\r\n');
  await commit(cwd, file, original, 'base');
  const changed = original.replace('line 3\r', 'changed 3\r\ninserted\r').replace('line 39\r', 'changed 39\r');
  await fs.writeFile(path.join(cwd, file), changed);
  async function apply(action, hunk, extra = {}) { const expected = (await service.state(cwd)).token, preview = await service.diff(cwd, { file, staged: action === 'unstage-hunk' }); return service.mutate(cwd, { action, file, hunk, expected, preview, ...extra }); }
  const before = await service.git(cwd, ['diff', '--cached', '--binary']);
  await assert.rejects(apply('stage-hunk', 0, { preview: 'forged patch' }), /다시 검토/);
  await assert.rejects(apply('stage-hunk', 7), /구간별/);
  await assert.rejects(apply('stage-hunk', 0, { expected: 'stale' }), /상태가 바뀌/);
  assert.equal(await service.git(cwd, ['diff', '--cached', '--binary']), before);
  await apply('stage-hunk', 1);
  assert.equal(await service.git(cwd, ['show', `:${file}`]), original.replace('line 39\r', 'changed 39\r'));
  assert.equal(await fs.readFile(path.join(cwd, file), 'utf8'), changed);
  await apply('stage-hunk', 0);
  assert.equal(await service.git(cwd, ['show', `:${file}`]), changed);
  await apply('unstage-hunk', 0);
  assert.equal(await service.git(cwd, ['show', `:${file}`]), original.replace('line 39\r', 'changed 39\r'));
  assert.equal(await fs.readFile(path.join(cwd, file), 'utf8'), changed);
  await apply('unstage-hunk', 0);
  assert.equal(await service.git(cwd, ['show', `:${file}`]), original);
  // A mode change must never be silently bundled into a text hunk.
  await fs.chmod(path.join(cwd, file), 0o755);
  await assert.rejects(apply('stage-hunk', 0), /구간별/);
  await fs.chmod(path.join(cwd, file), 0o644);
  await fs.writeFile(path.join(cwd, 'new.txt'), 'new\n');
  await assert.rejects(service.mutate(cwd, { action: 'stage-hunk', file: 'new.txt', hunk: 0, preview: await service.diff(cwd, { file: 'new.txt' }), expected: (await service.state(cwd)).token }), /일반 텍스트/);
  await commit(cwd, 'binary.bin', Buffer.from([0, 1, 2]), 'binary');
  await fs.writeFile(path.join(cwd, 'binary.bin'), Buffer.from([0, 3, 4]));
  await assert.rejects(service.mutate(cwd, { action: 'stage-hunk', file: 'binary.bin', hunk: 0, preview: await service.diff(cwd, { file: 'binary.bin' }), expected: (await service.state(cwd)).token }), /구간별/);
});

test('large ref sets load and paginate without expanding process arguments', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'literal [file].txt', 'base\n', 'base');
  const base = (await service.state(cwd)).head;
  // Real Git fixture: 30,000 distinct remote tips exceed Windows/macOS argv limits.
  const count = 30000, commands = [];
  for (let i = 0; i < count; i++) {
    const message = `tip ${String(i).padStart(5, '0')}`;
    commands.push(`commit refs/remotes/origin/topic/${i}\nmark :${i + 1}\ncommitter Fixture <fixture@example.invalid> ${1700000000 + i} +0000\ndata ${Buffer.byteLength(message)}\n${message}\nfrom ${i ? `:${i}` : base}\n\n`);
  }
  require('node:child_process').execFileSync('git', ['fast-import', '--quiet'], { cwd, input: commands.join(''), timeout: 30000 });
  const expected = (await service.git(cwd, ['rev-list', '--all', '--topo-order'])).trim().split('\n');
  const first = await service.history(cwd);
  assert.ok(first.revisions.length > 4096);
  assert.deepEqual(first.commits.map(c => c.sha), expected.slice(0, 100));
  assert.equal(first.hasMore, true);
  const tree = (await service.git(cwd, ['rev-parse', 'HEAD^{tree}'])).trim();
  const newer = (await service.git(cwd, ['commit-tree', tree, '-p', expected[0], '-m', 'arrived after snapshot'])).trim();
  await service.git(cwd, ['update-ref', `refs/remotes/origin/topic/${count - 1}`, newer]);
  const second = await service.history(cwd, { revisions: first.revisions, offset: 100 });
  assert.deepEqual(second.commits.map(c => c.sha), expected.slice(100, 200));
  assert.deepEqual((await service.history(cwd, { revisions: first.revisions })).commits, first.commits);
  assert.deepEqual((await service.history(cwd, { revisions: first.revisions, query: 'tip 00000' })).commits.map(c => c.message), ['tip 00000']);
  assert.deepEqual((await service.history(cwd, { revisions: first.revisions, file: 'literal [file].txt' })).commits.map(c => c.sha), [base]);
  await assert.rejects(service.history(cwd, { revisions: ['0'.repeat(40), ...first.revisions] }), /bad object/, 'Early Git exit must retain stderr without an unhandled stdin EPIPE');
  await assert.rejects(service.history(cwd, { revisions: [base + '\n--all'] }), /조회 기준/);
});

test('worktree context removal protects changes, operations, locks and unmerged branches', async t => {
  const { cwd, root } = await fixture(t);
  await commit(cwd, 'base.txt', 'base\n', 'base');
  const target = path.join(root, 'linked');
  await service.git(cwd, ['worktree', 'add', '-b', 'topic', target]);
  const command = async (action, extra = {}) => {
    const item = (await service.worktrees(cwd)).find(w => w.path === target);
    return service.mutate(cwd, { action, expected: (await service.state(cwd)).token, target, base: item?.head, ref: item?.branch ? `refs/heads/${item.branch}` : '', ...extra });
  };
  await assert.rejects(command('worktree-remove', { target: cwd }), /기본/);
  await service.mutate(target, { action: 'worktree-lock', expected: (await service.state(target)).token, target });
  await assert.rejects(command('worktree-remove-branch'), /잠긴/);
  await command('worktree-unlock');
  await fs.writeFile(path.join(target, 'draft.txt'), 'keep');
  await assert.rejects(command('worktree-remove-branch'), /변경 사항/);
  await fs.rm(path.join(target, 'draft.txt'));
  await service.git(cwd, ['config', 'core.excludesFile', path.join(root, 'ignore')]);
  await fs.writeFile(path.join(root, 'ignore'), 'local.secret\n');
  await fs.writeFile(path.join(target, 'local.secret'), 'keep ignored');
  await assert.rejects(command('worktree-remove'), /무시된 파일/);
  await fs.rm(path.join(target, 'local.secret'));
  const mergeHead = path.resolve(target, (await service.git(target, ['rev-parse', '--git-path', 'MERGE_HEAD'])).trim());
  await fs.writeFile(mergeHead, `${(await service.state(target)).head}\n`);
  await assert.rejects(command('worktree-remove'), /진행 중/);
  await fs.rm(mergeHead);
  await assert.rejects(command('worktree-remove-branch', { base: '0'.repeat(40) }), /바뀌었/);
  await commit(target, 'topic.txt', 'unique\n', 'topic');
  await assert.rejects(command('worktree-remove-branch'), /병합되지/);
  assert.equal(await fs.readFile(path.join(target, 'topic.txt'), 'utf8'), 'unique\n');
  await service.git(cwd, ['merge', '--ff-only', 'topic']);
  await command('worktree-remove-branch');
  assert.equal((await service.worktrees(cwd)).length, 1);
  assert.equal((await service.state(cwd)).refs.some(ref => ref.ref === 'refs/heads/topic'), false);
  await service.git(cwd, ['worktree', 'add', '-b', 'keep-branch', target]);
  await command('worktree-remove');
  assert.equal((await service.state(cwd)).refs.some(ref => ref.ref === 'refs/heads/keep-branch'), true);
  await service.git(cwd, ['worktree', 'add', '--detach', target]);
  await assert.rejects(command('worktree-remove-branch'), /로컬 브랜치/);
  await command('worktree-remove');
  // Git may reject branch deletion after the directory was removed: report both outcomes.
  await service.git(cwd, ['branch', 'older', 'HEAD^']);
  await service.git(cwd, ['worktree', 'add', '-b', 'partial', target]);
  await service.git(cwd, ['branch', '--set-upstream-to=older', 'partial']);
  await assert.rejects(command('worktree-remove-branch'), /Worktree는 제거했지만 partial 브랜치는 유지/);
  assert.equal((await service.worktrees(cwd)).length, 1);
  assert.equal((await service.state(cwd)).refs.some(ref => ref.ref === 'refs/heads/partial'), true);
});

test('checkout that cannot re-apply overlapping work returns to the original branch with the work intact', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'README.md', '# A\n', 'base');
  await service.git(cwd, ['branch', 'older']);
  await commit(cwd, 'README.md', '# A\nB\n', 'main change');
  await fs.writeFile(path.join(cwd, 'README.md'), '# A\nB\nlocal edit\n');
  await service.git(cwd, ['add', 'README.md']);
  await fs.writeFile(path.join(cwd, 'README.md'), '# A\nB\nlocal edit\nmore\n');
  const before = await service.state(cwd);
  await assert.rejects(service.mutate(cwd, { action: 'switch', ref: 'refs/heads/older', expected: before.token }), /겹쳐 체크아웃하지 않았습니다/);
  const after = await service.state(cwd);
  assert.equal(after.branch, 'main');
  assert.equal(after.head, before.head);
  assert.equal(await fs.readFile(path.join(cwd, 'README.md'), 'utf8'), '# A\nB\nlocal edit\nmore\n');
  assert.equal((await service.git(cwd, ['diff', '--cached', '--', 'README.md'])).includes('+local edit'), true);
  assert.equal((await service.git(cwd, ['stash', 'list'])).trim(), '');
});

test('checkout rollback also covers unstaged overlap and untracked files restored from the stash', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'README.md', '# A\n', 'base');
  await service.git(cwd, ['branch', 'older']);
  await commit(cwd, 'README.md', '# A\nB\n', 'main change');
  await fs.writeFile(path.join(cwd, 'README.md'), '# A\nB\nlocal\n');
  await fs.writeFile(path.join(cwd, 'new.txt'), 'untracked\n');
  const before = await service.state(cwd);
  await assert.rejects(service.mutate(cwd, { action: 'switch', ref: 'refs/heads/older', expected: before.token }), /main 브랜치와 작업 변경을 그대로 유지/);
  const after = await service.state(cwd);
  assert.equal(after.branch, 'main');
  assert.equal(await fs.readFile(path.join(cwd, 'README.md'), 'utf8'), '# A\nB\nlocal\n');
  assert.equal(await fs.readFile(path.join(cwd, 'new.txt'), 'utf8'), 'untracked\n');
  assert.equal((await service.git(cwd, ['stash', 'list'])).trim(), '');
});

test('state lists annotated tags at their peeled commit', async t => {
  const { cwd } = await fixture(t);
  await commit(cwd, 'a.txt', '1\n', 'init');
  await service.git(cwd, ['tag', '-a', 'v1.0.0', '-m', 'release']);
  await service.git(cwd, ['tag', 'light']);
  const repo = await service.state(cwd);
  assert.deepEqual(repo.tags.map(tag => tag.sha), [repo.head, repo.head]);
  assert.deepEqual(repo.tags.map(tag => tag.name).sort(), ['light', 'v1.0.0']);
});
test('graph hides stash index/untracked commits and keeps page offsets in visible rows', async t => {
  const { cwd } = await fixture(t);
  for (let i = 0; i < 6; i++) await commit(cwd, 'a.txt', `${i}\n`, `c${i}`);
  await fs.writeFile(path.join(cwd, 'a.txt'), 'dirty\n'); await fs.writeFile(path.join(cwd, 'new.txt'), 'u\n');
  await service.git(cwd, ['stash', 'push', '-u', '-m', 'keep']);
  const stash = (await service.git(cwd, ['rev-parse', 'stash@{0}'])).trim();
  const internals = (await service.git(cwd, ['rev-parse', 'stash@{0}^2', 'stash@{0}^3'])).trim().split('\n');
  const all = await service.history(cwd, { limit: 100 });
  assert.equal(all.commits.length, 7);
  assert.ok(all.commits.some(item => item.sha === stash));
  assert.ok(!all.commits.some(item => internals.includes(item.sha)));
  assert.deepEqual(all.commits.find(item => item.sha === stash).parents.length, 1);
  const paged = [];
  for (let offset = 0; offset < 7; offset += 2) {
    const page = await service.history(cwd, { limit: 2, offset, revisions: all.revisions });
    assert.equal(page.offset, offset);
    paged.push(...page.commits.map(item => item.sha));
    assert.equal(page.hasMore, offset + 2 < 7);
  }
  assert.deepEqual(paged, all.commits.map(item => item.sha));
  const focused = await service.history(cwd, { limit: 2, focusSha: all.commits[5].sha, revisions: all.revisions });
  assert.ok(focused.commits.some(item => item.sha === all.commits[5].sha));
  assert.deepEqual(focused.commits.map(item => item.sha), all.commits.slice(focused.offset, focused.offset + 2).map(item => item.sha));
});
