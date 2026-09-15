const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { git, state } = require('./git.cjs');
const conflicts = require('./conflicts.cjs');

async function fixture(t, operation = 'merge', file = '한글 [file]\nnext.txt') {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'branchline-conflicts-')));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const cwd = path.join(root, 'repo'), vault = path.join(root, 'backups'); await fs.mkdir(cwd);
  await git(cwd, ['init', '-b', 'main']);
  await git(cwd, ['config', 'user.name', 'Fixture']); await git(cwd, ['config', 'user.email', 'test@example.invalid']); await git(cwd, ['config', 'commit.gpgsign', 'false']);
  await git(cwd, ['config', 'core.autocrlf', 'false']);
  async function commit(value) { await fs.writeFile(path.join(cwd, file), value); await git(cwd, ['add', '.']); await git(cwd, ['commit', '-m', value]); }
  await commit('base\n'); await git(cwd, ['checkout', '-b', 'topic']); await commit('topic\n');
  await git(cwd, ['checkout', 'main']); await commit('main\n');
  if (operation === 'rebase') await git(cwd, ['checkout', 'topic']);
  await assert.rejects(git(cwd, operation === 'merge' ? ['merge', 'topic'] : ['rebase', 'main']));
  return { cwd, vault, file, root, read: () => conflicts.read(cwd, file, vault), change: (snapshot, action, result) => conflicts.change(cwd, { file, expected: snapshot.token, action, result }, vault) };
}
test('real three-way merge, stale edit rejection, persistent undo, mark resolved without commit', async t => {
  const f = await fixture(t); let snapshot = await f.read();
  assert.equal(snapshot.base, 'base\n'); assert.equal(snapshot.ours, 'main\n'); assert.equal(snapshot.theirs, 'topic\n');
  await assert.rejects(f.change(snapshot, 'resolve'), /충돌 표시/);
  const original = snapshot.current, head = (await state(f.cwd)).head;
  await fs.writeFile(path.join(f.cwd, f.file), 'external edit\n');
  await assert.rejects(f.change(snapshot, 'apply', 'stale overwrite'), /바뀌/);
  assert.equal(await fs.readFile(path.join(f.cwd, f.file), 'utf8'), 'external edit\n');
  await fs.writeFile(path.join(f.cwd, f.file), original); snapshot = await f.read();
  let changed = await f.change(snapshot, 'apply', 'resolved\n');
  assert.equal(changed.snapshot.current, 'resolved\n'); assert.equal(changed.repository.files[0].conflict, true);
  assert.equal((await f.read()).canRestore, true);
  changed = await f.change(await f.read(), 'restore'); assert.equal(changed.snapshot.current, original); assert.equal(changed.snapshot.canRestore, false);
  changed = await f.change(changed.snapshot, 'apply', 'resolved\n');
  changed = await f.change(changed.snapshot, 'resolve');
  assert.equal(changed.snapshot, null); assert.equal(changed.repository.files.some(item => item.conflict), false);
  assert.equal(changed.repository.operation, 'merge'); assert.equal(changed.repository.head, head);
  assert.equal(await git(f.cwd, ['show', `:${f.file}`]), 'resolved\n');
});
test('rebase stages, operation identity and linked-worktree isolation', async t => {
  const f = await fixture(t, 'rebase'); const snapshot = await f.read();
  assert.equal(snapshot.ours, 'main\n'); assert.equal(snapshot.theirs, 'topic\n');
  const linked = path.join(f.root, 'linked'); await git(f.cwd, ['worktree', 'add', '-b', 'other', linked, 'main']);
  await assert.rejects(conflicts.read(linked, f.file, f.vault), /미해결 충돌이 없습니다/);
  const directory = (await git(f.cwd, ['rev-parse', '--absolute-git-dir'])).trim();
  await fs.writeFile(path.join(directory, 'rebase-merge/msgnum'), '99\n');
  await assert.rejects(f.change(snapshot, 'apply', 'wrong operation'), /바뀌/);
});
test('binary, symlink, oversized and missing paths fail closed; CRLF and file mode survive', async t => {
  const f = await fixture(t, 'merge', 'file.txt'); const target = path.join(f.cwd, f.file);
  await fs.writeFile(target, 'a\0b'); await assert.rejects(f.read(), /UTF-8/);
  await fs.writeFile(target, Buffer.from([0xff])); await assert.rejects(f.read(), /UTF-8/);
  await fs.writeFile(target, 'x'.repeat(1024 * 1024 + 1)); await assert.rejects(f.read(), /1 MiB/);
  await fs.rm(target); await assert.rejects(f.read(), /작업 파일이 없습니다/);
  const outside = path.join(f.root, 'outside'); await fs.writeFile(outside, 'private'); await fs.symlink(outside, target);
  await assert.rejects(f.read(), /심볼릭/); assert.equal(await fs.readFile(outside, 'utf8'), 'private');
  await fs.rm(target); await fs.writeFile(target, 'current\r\n'); await fs.chmod(target, 0o755);
  let next = await f.change(await f.read(), 'apply', 'resolved\n'); assert.equal(next.snapshot.current, 'resolved\r\n'); assert.equal((await fs.stat(target)).mode & 0o777, 0o755);
  next = await f.change(next.snapshot, 'restore'); assert.equal(next.snapshot.current, 'current\r\n');
  await fs.writeFile(target, 'mixed\r\nline\n'); await assert.rejects(f.change(await f.read(), 'apply', 'x'), /혼합/);
  await fs.writeFile(target, 'legacy\rline\r'); await assert.rejects(f.change(await f.read(), 'apply', 'x'), /혼합/);
  await assert.rejects(conflicts.read(f.cwd, '../outside', f.vault));
});
test('custom conflict markers cannot be staged; failed apply leaves working file untouched', async t => {
  const f = await fixture(t, 'merge', 'file.txt');
  await fs.writeFile(path.join(f.cwd, '.gitattributes'), 'file.txt conflict-marker-size=5\n');
  await fs.writeFile(path.join(f.cwd, f.file), '<<<<< HEAD\nleft\n=====\nright\n>>>>> topic\n');
  const snapshot = await f.read(); await assert.rejects(f.change(snapshot, 'resolve'), /충돌 표시/);
  await assert.rejects(f.change(snapshot, 'apply', '\ud800'), /UTF-8/);
  assert.equal((await f.read()).current, snapshot.current);
});

test('missing index stages remain absent for delete/modify and add/add conflicts', async t => {
  const f = await fixture(t, 'merge', 'file.txt');
  await git(f.cwd, ['merge', '--abort']); await git(f.cwd, ['rm', '--', f.file]); await git(f.cwd, ['commit', '-m', 'delete']);
  await assert.rejects(git(f.cwd, ['merge', 'topic']));
  const deleted = await f.read(); assert.equal(deleted.ours, null); assert.equal(deleted.theirs, 'topic\n');
  await git(f.cwd, ['merge', '--abort']);
  for (const branch of ['topic', 'main']) {
    await git(f.cwd, ['checkout', branch]); await fs.writeFile(path.join(f.cwd, 'new.txt'), branch + '\n');
    await git(f.cwd, ['add', 'new.txt']); await git(f.cwd, ['commit', '-m', 'add']);
  }
  await assert.rejects(git(f.cwd, ['merge', 'topic']));
  const added = await conflicts.read(f.cwd, 'new.txt', f.vault);
  assert.equal(added.base, null); assert.equal(added.ours, 'main\n'); assert.equal(added.theirs, 'topic\n');
});
