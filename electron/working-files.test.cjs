const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const files = require('./working-files.cjs');
const { git } = require('./git.cjs');

test('working file editor: save, stale source, UTF-8, path boundaries and index preservation', async () => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'branchline-editor-')));
  try {
    await git(root, ['init', '-b', 'main']); await git(root, ['config', 'user.name', 'Test']); await git(root, ['config', 'user.email', 'test@example.invalid']);
    await fs.mkdir(path.join(root, '한글 폴더'));
    const file = '한글 폴더/파일.txt', target = path.join(root, file);
    await fs.writeFile(target, '\ufeff처음\r\n두 번째\r\n', { mode: 0o755 });
    await git(root, ['add', '.']); await git(root, ['-c', 'commit.gpgsign=false', 'commit', '-m', 'first']);
    const index = await git(root, ['write-tree']);
    assert.equal((await files.list(root)).some(entry => entry.name === '.git'), false);
    assert.equal((await files.list(root))[0].directory, true);
    let snapshot = await files.read(root, file);
    snapshot = await files.save(root, { file, expected: snapshot.token, result: '\ufeff수정\n두 번째\n' });
    assert.equal(snapshot.current, '\ufeff수정\r\n두 번째\r\n'); assert.equal((await fs.stat(target)).mode & 0o777, 0o755);
    assert.equal(await git(root, ['write-tree']), index, 'saving never stages or commits');
    await assert.rejects(files.save(root, { file, expected: snapshot.token, result: '\n'.repeat(600000) }), /1 MiB/);
    assert.equal(await fs.readFile(target, 'utf8'), snapshot.current);
    await fs.writeFile(target, 'external\n');
    await assert.rejects(files.save(root, { file, expected: snapshot.token, result: 'draft' }), /외부에서 변경/);
    assert.equal(await fs.readFile(target, 'utf8'), 'external\n');
    snapshot = await files.read(root, file); await git(root, ['switch', '-c', 'other']);
    await assert.rejects(files.save(root, { file, expected: snapshot.token, result: 'draft' }), /외부에서 변경/);
    for (const bad of ['../escape', '/tmp/escape', '.git/config', '한글 폴더/../파일', 'a\\b']) await assert.rejects(files.read(root, bad), /내부 경로/);
    await fs.symlink(target, path.join(root, 'link')); await assert.rejects(files.read(root, 'link'), /심볼릭/);
    await fs.mkdir(path.join(root, 'nested')); await git(path.join(root, 'nested'), ['init']); await fs.writeFile(path.join(root, 'nested/test'), 'nested');
    await assert.rejects(files.list(root, 'nested'), /중첩 저장소/); await assert.rejects(files.read(root, 'nested/test'), /중첩 저장소/);
    await fs.writeFile(path.join(root, 'binary'), Buffer.from([0, 255])); await assert.rejects(files.read(root, 'binary'), /UTF-8/);
    await fs.writeFile(path.join(root, 'large'), Buffer.alloc(1024 * 1024 + 1, 65)); await assert.rejects(files.read(root, 'large'), /1 MiB/);
    await fs.writeFile(path.join(root, 'mixed'), 'a\r\nb\nc'); snapshot = await files.read(root, 'mixed');
    await assert.rejects(files.save(root, { file: 'mixed', expected: snapshot.token, result: 'mixed' }), /혼합/);
    await fs.link(target, path.join(root, 'hardlink')); await assert.rejects(files.read(root, 'hardlink'), /일반 파일/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
