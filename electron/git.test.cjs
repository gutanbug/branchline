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
    assert.deepEqual(result.commits.map(c => c.message), expected); assert.equal(result.aOnly, 1); assert.equal(result.bOnly, 1);
  }
  assert.equal((await service.state(cwd)).branch, 'feature');
  assert.match((await service.compare(cwd, { a: 'feature', b: 'main', mode: 'a', diffMode: 'introduced' })).diff, /diff --git[\s\S]*@@/);
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
  await assert.rejects(service.history(cwd, { offset: -1 }), /조회 위치/);
  await assert.rejects(service.compare(cwd, { a: '--help', b: 'main', mode: 'a' }), /선택하세요/);
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
  assert.match((await service.compare(cwd, { a: 'topic', b: 'main', mode: 'a' })).diff, /한글.txt/)
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
  await t.test('successful restore preserves index, mixed edits, rename, binary and previous stashes', async t => {
    const { cwd } = await fixture(t);
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
    const before = await service.state(cwd);
    await assert.rejects(service.mutate(cwd, { action: 'switch', ref: 'refs/heads/topic', expected: 'stale' }), /상태가 바뀌/);
    assert.equal((await service.state(cwd)).token, before.token);
    const after = await run(cwd, 'topic');
    assert.equal(after.branch, 'topic');
    assert.equal(await service.git(cwd, ['write-tree']), index);
    assert.equal(await service.git(cwd, ['diff', '--binary']), changed);
    assert.deepEqual(await fs.readFile(path.join(cwd, 'binary.dat')), bytes);
    assert.equal(await service.git(cwd, ['stash', 'list', '--format=%H']), previous);
  });
  await t.test('apply conflict keeps destination checkout and exact recoverable source', async t => {
    const { cwd } = await fixture(t);
    await commit(cwd, 'same.txt', 'base\n', 'base');
    await service.git(cwd, ['switch', '-c', 'topic']);
    await commit(cwd, 'same.txt', 'topic\n', 'topic');
    await service.git(cwd, ['switch', 'main']);
    await fs.writeFile(path.join(cwd, 'same.txt'), 'local edits\n');
    await assert.rejects(run(cwd, 'topic'), /자동 Stash .*보존/);
    const after = await service.state(cwd);
    assert.equal(after.branch, 'topic'); assert.ok(after.files.some(file => file.conflict));
    assert.equal(await service.git(cwd, ['show', 'stash@{0}:same.txt']), 'local edits\n');
    const stashes = await service.git(cwd, ['stash', 'list']);
    await assert.rejects(run(cwd, 'main'), /충돌/);
    assert.equal(await service.git(cwd, ['stash', 'list']), stashes);
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
