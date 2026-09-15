const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const git = require('./git.cjs');
const sync = require('./sync.cjs');
async function setup(t) {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'branchline-sync-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const repo = path.join(root, '개인 repo'), remote = path.join(root, 'remote.git');
  await fs.mkdir(repo); await git.git(repo, ['init', '-b', 'main']); await git.git(root, ['init', '--bare', '-b', 'main', remote]);
  await identity(repo); await commit(repo, 'base.txt', 'initial\n', 'initial');
  await change(repo, { action: 'remote-add', remote: 'origin', url: remote });
  return { root, repo, remote };
}
async function identity(cwd) { await git.git(cwd, ['config', 'user.name', 'Sync Test']); await git.git(cwd, ['config', 'user.email', 'sync@example.invalid']); await git.git(cwd, ['config', 'commit.gpgsign', 'false']); }
async function commit(cwd, file, content, message) { await fs.writeFile(path.join(cwd, file), content); await git.git(cwd, ['add', '--', file]); await git.git(cwd, ['commit', '-m', message]); }
async function change(repo, input) { return sync.change(repo, { expected: (await git.state(repo)).token, ...input }); }
const remoteBranch = { remote: 'origin', branch: 'main' };

test('remote push/clone/fetch/ff pull/upstream and stash save/inspect/restore/drop', async t => {
  const { root, repo, remote } = await setup(t);
  assert.equal((await sync.snapshot(repo)).upstream.ahead, null);
  await git.git(repo, ['tag', '-a', 'not-published', '-m', 'fixture tag']);
  await git.git(repo, ['branch', 'not-published']);
  await git.git(repo, ['config', 'push.followTags', 'true']);
  await git.git(repo, ['config', 'remote.origin.mirror', 'true']);
  await change(repo, { action: 'push', ...remoteBranch });
  assert.equal((await git.git(remote, ['for-each-ref', '--format=%(refname)'])).trim(), 'refs/heads/main');
  assert.equal((await git.git(remote, ['rev-parse', 'main'])).trim(), (await git.state(repo)).head);
  await change(repo, { action: 'fetch', remote: 'origin' });
  await change(repo, { action: 'upstream', ...remoteBranch });
  assert.equal((await sync.snapshot(repo)).upstream.ahead, 0);
  const clone = path.join(root, '복제 repo'); await sync.clone(remote, clone); await identity(clone);
  await assert.rejects(sync.clone(remote, clone), /EEXIST/);
  await commit(clone, 'remote.txt', 'remote\n', 'remote change'); await change(clone, { action: 'push', ...remoteBranch });
  await fs.writeFile(path.join(repo, 'base.txt'), 'saved tracked\n'); await git.git(repo, ['add', 'base.txt']);
  await fs.writeFile(path.join(repo, 'new.txt'), 'saved untracked\n');
  await assert.rejects(change(repo, { action: 'pull', expected: 'stale', ...remoteBranch }), /바뀌/);
  await change(repo, { action: 'stash-save', message: '잠시 보관', includeUntracked: true });
  assert.equal((await git.state(repo)).files.length, 0);
  let stash = (await sync.snapshot(repo)).stashes[0];
  assert.match(await sync.preview(repo, stash.sha), /saved untracked/);
  await change(repo, { action: 'fetch', remote: 'origin' });
  assert.equal((await sync.snapshot(repo)).upstream.behind, 1);
  await change(repo, { action: 'pull', ...remoteBranch });
  assert.equal(await fs.readFile(path.join(repo, 'remote.txt'), 'utf8'), 'remote\n');
  await change(repo, { action: 'stash-apply', stashRef: stash.ref, stashSha: stash.sha, restoreIndex: true });
  assert.equal(await fs.readFile(path.join(repo, 'new.txt'), 'utf8'), 'saved untracked\n');
  assert.equal((await git.state(repo)).files.find(f => f.path === 'base.txt').index, 'M');
  assert.equal((await sync.snapshot(repo)).stashes.length, 1);
  await assert.rejects(change(repo, { action: 'stash-drop', stashRef: stash.ref, stashSha: '0'.repeat(40) }), /순서/);
  await change(repo, { action: 'stash-drop', stashRef: stash.ref, stashSha: stash.sha });
  assert.equal((await sync.snapshot(repo)).stashes.length, 0);
  assert.equal(await fs.readFile(path.join(repo, 'new.txt'), 'utf8'), 'saved untracked\n');
  await git.git(repo, ['add', '-A']); await git.git(repo, ['commit', '-m', 'restored changes']);
  const beforeDeletedPull = (await git.state(repo)).head;
  await git.git(remote, ['update-ref', '-d', 'refs/heads/main']);
  await assert.rejects(change(repo, { action: 'pull', ...remoteBranch }), /실패/);
  assert.equal((await git.state(repo)).head, beforeDeletedPull);
});

test('divergence, changed destination, multiple push URLs, and conflict do not silently overwrite', async t => {
  const { root, repo, remote } = await setup(t);
  await change(repo, { action: 'push', ...remoteBranch });
  const clone = path.join(root, 'other'); await sync.clone(remote, clone); await identity(clone);
  await commit(clone, 'other.txt', 'other', 'other'); await change(clone, { action: 'push', ...remoteBranch });
  await commit(repo, 'local.txt', 'local', 'local');
  const head = (await git.state(repo)).head, remoteHead = (await git.git(remote, ['rev-parse', 'main'])).trim();
  await assert.rejects(change(repo, { action: 'push', ...remoteBranch }), /실패/);
  await assert.rejects(change(repo, { action: 'pull', ...remoteBranch }), /fast-forward/);
  assert.equal((await git.state(repo)).head, head); assert.equal((await git.git(remote, ['rev-parse', 'main'])).trim(), remoteHead);
  const expected = (await git.state(repo)).token;
  await git.git(repo, ['remote', 'set-url', '--push', 'origin', clone]);
  await assert.rejects(sync.change(repo, { action: 'push', expected, ...remoteBranch }), /바뀌/);
  await git.git(repo, ['remote', 'set-url', '--add', '--push', 'origin', remote]);
  assert.match((await sync.snapshot(repo)).remotes[0].blocked, /여러 URL/);
  await assert.rejects(change(repo, { action: 'push', ...remoteBranch }), /여러 URL/);
  await fs.writeFile(path.join(repo, 'base.txt'), 'saved conflict\n');
  await change(repo, { action: 'stash-save', message: 'conflict fixture' });
  const stash = (await sync.snapshot(repo)).stashes[0];
  await commit(repo, 'base.txt', 'new base\n', 'changed base');
  await assert.rejects(change(repo, { action: 'stash-apply', stashRef: stash.ref, stashSha: stash.sha }), /원본은 유지/);
  assert.ok((await git.state(repo)).files.some(f => f.conflict));
  assert.equal((await sync.snapshot(repo)).stashes[0].sha, stash.sha);
});

test('credential-bearing URLs are rejected/redacted and running transport is cancellable', async t => {
  const { repo, root } = await setup(t);
  for (const value of ['https://token@example.com/r.git', 'https://example.com/r?token=secret', 'ext::echo unsafe', '--upload-pack=unsafe']) assert.throws(() => sync.address(value));
  assert.equal(sync.address('git@example.com:team/repo.git'), 'git@example.com:team/repo.git');
  assert.equal(sync.redacted('https://token@example.com/r?token=secret').includes('secret'), false);
  await git.git(repo, ['remote', 'set-url', 'origin', 'https://secret@example.com/r.git']);
  assert.equal(JSON.stringify(await sync.snapshot(repo)).includes('secret'), false);
  const ssh = path.join(root, 'fake-ssh'), marker = path.join(root, 'ssh-called');
  await fs.writeFile(ssh, `#!/bin/sh\nprintf called > '${marker}'\nexit 1\n`, { mode: 0o700 });
  await git.git(repo, ['config', 'core.sshCommand', ssh]);
  await git.git(repo, ['remote', 'set-url', 'origin', 'ssh://git@example.invalid/repo.git']);
  const oldSsh = process.env.GIT_SSH_COMMAND, oldGitSsh = process.env.GIT_SSH;
  delete process.env.GIT_SSH_COMMAND; delete process.env.GIT_SSH;
  try { await assert.rejects(change(repo, { action: 'fetch', remote: 'origin' }), /실패/); assert.equal(await fs.readFile(marker, 'utf8'), 'called'); }
  finally { if (oldSsh !== undefined) process.env.GIT_SSH_COMMAND = oldSsh; if (oldGitSsh !== undefined) process.env.GIT_SSH = oldGitSsh; }
  const controller = new AbortController();
  const task = sync.network(repo, ['-c', 'alias.block=!sleep 60', 'block'], controller.signal);
  const timer = setTimeout(() => controller.abort(), 100); t.after(() => clearTimeout(timer));
  const start = Date.now(); await assert.rejects(task, /취소/); assert.ok(Date.now() - start < 3000);
  await assert.rejects(sync.network(repo, ['status'], controller.signal), /취소/);
});

test('stash pop removes only a successfully restored entry; stale and conflicting entries are retained', async t => {
  const { repo } = await setup(t);
  await fs.writeFile(path.join(repo, 'base.txt'), 'staged pop\n'); await git.git(repo, ['add', 'base.txt']);
  await fs.writeFile(path.join(repo, 'new.txt'), 'untracked pop\n');
  await change(repo, { action: 'stash-save', message: 'pop success', includeUntracked: true });
  let stash = (await sync.snapshot(repo)).stashes[0];
  await assert.rejects(change(repo, { action: 'stash-pop', stashRef: stash.ref, stashSha: '0'.repeat(40) }), /순서/);
  await change(repo, { action: 'stash-pop', stashRef: stash.ref, stashSha: stash.sha, restoreIndex: true });
  assert.equal((await sync.snapshot(repo)).stashes.length, 0);
  assert.equal(await fs.readFile(path.join(repo, 'new.txt'), 'utf8'), 'untracked pop\n');
  assert.equal((await git.state(repo)).files.find(file => file.path === 'base.txt').index, 'M');
  await git.git(repo, ['add', '-A']); await git.git(repo, ['commit', '-m', 'pop restored']);
  await fs.writeFile(path.join(repo, 'base.txt'), 'conflicting stash\n');
  await change(repo, { action: 'stash-save', message: 'pop conflict' }); stash = (await sync.snapshot(repo)).stashes[0];
  await commit(repo, 'base.txt', 'conflicting base\n', 'base changed');
  await assert.rejects(change(repo, { action: 'stash-pop', stashRef: stash.ref, stashSha: stash.sha }), /원본은 유지/);
  assert.ok((await git.state(repo)).files.some(file => file.conflict));
  assert.equal((await sync.snapshot(repo)).stashes[0].sha, stash.sha);
});

test('automatic monitoring refreshes tracking counts, shares worktree cooldown and recovers without changing local files', async t => {
  const { root, repo, remote } = await setup(t);
  await change(repo, { action: 'push', ...remoteBranch });
  await change(repo, { action: 'fetch', remote: 'origin' });
  await change(repo, { action: 'upstream', ...remoteBranch });
  const other = path.join(root, 'contributor'); await sync.clone(remote, other); await identity(other);
  const linked = path.join(root, 'linked'); await git.git(repo, ['worktree', 'add', '-b', 'linked', linked]);
  await git.git(linked, ['branch', '--set-upstream-to=origin/main']);
  await commit(other, 'incoming.txt', 'incoming', 'incoming'); await change(other, { action: 'push', ...remoteBranch });
  await commit(repo, 'outgoing.txt', 'outgoing', 'outgoing');
  await fs.writeFile(path.join(repo, 'base.txt'), 'uncommitted');
  const before = await git.state(repo), remoteHead = (await git.state(other)).head;
  let now = Date.now(); t.mock.method(Date, 'now', () => now);
  const [first, shared] = await Promise.all([sync.monitor(repo), sync.monitor(linked)]);
  assert.deepEqual(first, shared); assert.equal(first.error, ''); assert.ok(first.checkedAt);
  let state = await git.state(repo);
  assert.equal(state.head, before.head); assert.equal(state.localToken, before.localToken);
  assert.equal((await git.git(remote, ['rev-parse', 'main'])).trim(), remoteHead);
  assert.deepEqual(state.refs.find(r => r.name === 'main').tracking, { ref: 'refs/remotes/origin/main', ahead: 1, behind: 1 });
  assert.equal((await git.state(linked)).refs.find(r => r.name === 'linked').tracking.behind, 1);
  await commit(other, 'second.txt', 'second', 'second'); await change(other, { action: 'push', ...remoteBranch });
  await sync.monitor(repo);
  assert.equal((await sync.snapshot(repo)).upstream.behind, 1, 'cooldown avoids another fetch');
  now += 60001; await sync.monitor(repo);
  assert.equal((await sync.snapshot(repo)).upstream.behind, 2);
  await git.git(repo, ['remote', 'set-url', 'origin', path.join(root, 'missing.git')]);
  now += 60001; const failed = await sync.monitor(repo);
  assert.match(failed.error, /자동 Fetch 실패/); assert.ok(failed.checkedAt);
  assert.equal((await sync.snapshot(repo)).upstream.behind, 2);
  await git.git(repo, ['remote', 'set-url', 'origin', remote]);
  now += 60001; assert.equal((await sync.monitor(repo)).error, '');
  await git.git(repo, ['branch', '--unset-upstream']);
  state = await git.state(repo); assert.equal(state.refs.find(r => r.name === 'main').tracking, undefined);
  assert.equal(await fs.readFile(path.join(repo, 'base.txt'), 'utf8'), 'uncommitted');
});

test('Pull automatically preserves staged, working and untracked changes with guarded recovery', async t => {
  async function pair(t) {
    const fixture = await setup(t); await change(fixture.repo, { action: 'push', ...remoteBranch });
    const other = path.join(fixture.root, 'publisher'); await sync.clone(fixture.remote, other); await identity(other);
    return { ...fixture, other };
  }
  await t.test('fast-forward restores exact edits and removes only its own stash', async t => {
    const { repo, other } = await pair(t);
    await fs.writeFile(path.join(repo, 'previous.txt'), 'keep'); await change(repo, { action: 'stash-save', message: 'previous', includeUntracked: true });
    const previous = await git.git(repo, ['stash', 'list', '--format=%H']);
    await fs.writeFile(path.join(repo, 'base.txt'), 'staged\n'); await git.git(repo, ['add', 'base.txt']); await fs.writeFile(path.join(repo, 'base.txt'), 'staged\nworking\n');
    const bytes = Buffer.from([0, 255, 42]); await fs.writeFile(path.join(repo, '한글.bin'), bytes);
    await commit(other, 'remote.txt', 'incoming\n', 'incoming'); await change(other, { action: 'push', ...remoteBranch });
    await change(repo, { action: 'pull', ...remoteBranch });
    assert.equal((await git.state(repo)).head, (await git.state(other)).head);
    assert.equal(await git.git(repo, ['show', ':base.txt']), 'staged\n'); assert.equal(await fs.readFile(path.join(repo, 'base.txt'), 'utf8'), 'staged\nworking\n');
    assert.deepEqual(await fs.readFile(path.join(repo, '한글.bin')), bytes); assert.equal(await git.git(repo, ['stash', 'list', '--format=%H']), previous);
  });
  await t.test('divergence restores original work and retains recoverable stash', async t => {
    const { repo, other } = await pair(t);
    await commit(repo, 'local.txt', 'local', 'local'); await commit(other, 'remote.txt', 'remote', 'remote'); await change(other, { action: 'push', ...remoteBranch });
    const head = (await git.state(repo)).head;
    await fs.writeFile(path.join(repo, 'base.txt'), 'keep staged'); await git.git(repo, ['add', 'base.txt']);
    await assert.rejects(change(repo, { action: 'pull', ...remoteBranch }), /보존.*\n.*fast-forward/);
    assert.equal((await git.state(repo)).head, head); assert.equal(await git.git(repo, ['show', ':base.txt']), 'keep staged'); assert.equal(await git.git(repo, ['show', 'stash@{0}:base.txt']), 'keep staged');
  });
  await t.test('apply conflict keeps pulled HEAD and stash; another Pull is blocked', async t => {
    const { repo, other } = await pair(t);
    await fs.writeFile(path.join(repo, 'base.txt'), 'local edit\n');
    await commit(other, 'base.txt', 'remote edit\n', 'remote conflict'); await change(other, { action: 'push', ...remoteBranch });
    await assert.rejects(change(repo, { action: 'pull', ...remoteBranch }), /변경 복원.*보존/);
    assert.equal((await git.state(repo)).head, (await git.state(other)).head); assert.ok((await git.state(repo)).files.some(file => file.conflict));
    const stash = (await sync.snapshot(repo)).stashes[0].sha; assert.equal(await git.git(repo, ['show', `${stash}:base.txt`]), 'local edit\n');
    await assert.rejects(change(repo, { action: 'pull', ...remoteBranch }), /충돌/); assert.equal((await sync.snapshot(repo)).stashes[0].sha, stash);
  });
  await t.test('ignored files and external edits are not overwritten during recovery', async t => {
    const { repo, other } = await pair(t);
    await fs.writeFile(path.join(repo, '.git/info/exclude'), 'ignored.txt\n'); await fs.writeFile(path.join(repo, 'ignored.txt'), 'private ignored');
    await fs.writeFile(path.join(repo, 'base.txt'), 'keep original');
    await commit(other, 'ignored.txt', 'remote tracked', 'remote ignored collision'); await change(other, { action: 'push', ...remoteBranch });
    await assert.rejects(change(repo, { action: 'pull', ...remoteBranch }), /보존/);
    assert.equal(await fs.readFile(path.join(repo, 'ignored.txt'), 'utf8'), 'private ignored'); assert.equal(await fs.readFile(path.join(repo, 'base.txt'), 'utf8'), 'keep original');
    const before = await git.state(repo);
    await assert.rejects(git.serial(repo, () => git.withAutoStash(repo, before, before.branch, 'Pull', async () => {
      await fs.writeFile(path.join(repo, 'base.txt'), 'external writer'); throw new Error('외부 변경');
    })), /보존/);
    assert.equal(await fs.readFile(path.join(repo, 'base.txt'), 'utf8'), 'external writer'); assert.equal(await git.git(repo, ['show', 'stash@{0}:base.txt']), 'keep original');
  });
  await t.test('cancelled transport restores the index and work and retains stash', async t => {
    const { repo, root } = await pair(t);
    await fs.writeFile(path.join(repo, 'base.txt'), 'cancelled staged'); await git.git(repo, ['add', 'base.txt']);
    const ssh = path.join(root, 'blocking-ssh'), marker = path.join(root, 'started');
    await fs.writeFile(ssh, `#!/bin/sh\nprintf called > '${marker}'\nsleep 30\n`, { mode: 0o700 });
    await git.git(repo, ['config', 'core.sshCommand', ssh]); await git.git(repo, ['remote', 'set-url', 'origin', 'ssh://git@example.invalid/repo']);
    const controller = new AbortController(), expected = (await git.state(repo)).token;
    const timer = setInterval(() => { fs.access(marker).then(() => controller.abort()).catch(() => {}) }, 20);
    try { await assert.rejects(sync.change(repo, { action: 'pull', expected, ...remoteBranch }, controller.signal), /보존.*\n.*취소/); }
    finally { clearInterval(timer) }
    assert.equal(await git.git(repo, ['show', ':base.txt']), 'cancelled staged'); assert.equal(await fs.readFile(path.join(repo, 'base.txt'), 'utf8'), 'cancelled staged'); assert.equal((await sync.snapshot(repo)).stashes.length, 1);
  });
});
