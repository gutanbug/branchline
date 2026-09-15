const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { git, text, serial, state } = require('./git.cjs');
const limit = 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');
const stale = () => new Error('충돌 원본이나 작업 파일이 바뀌었습니다. 초안을 복사한 뒤 원본을 다시 불러오세요.');

function decode(bytes) {
  const value = bytes.toString('utf8');
  if (bytes.includes(0) || !Buffer.from(value).equals(bytes)) throw new Error('UTF-8 텍스트 파일만 편집할 수 있습니다. 외부 편집기를 사용하세요.');
  return value;
}
async function safeFile(cwd, file) {
  text(file, '파일 경로');
  if (!file || path.isAbsolute(file) || file.split(/[\\/]/).some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git')) throw new Error('파일 경로가 올바르지 않습니다.');
  let current = cwd;
  for (const part of file.split('/')) {
    current = path.join(current, part);
    const info = await fs.lstat(current).catch(e => { if (e.code === 'ENOENT') throw new Error('작업 파일이 없습니다. 경로를 다시 확인하세요.'); throw e; });
    if (info.isSymbolicLink() || (current !== path.join(cwd, file) && !info.isDirectory())) throw new Error('심볼릭 링크 경로는 편집할 수 없습니다.');
  }
  const handle = await fs.open(current, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await handle.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > limit) throw new Error('1 MiB 이하의 일반 파일만 편집할 수 있습니다.');
    const bytes = await handle.readFile();
    if (bytes.length > limit) throw new Error('파일이 너무 큽니다.');
    return { bytes, mode: info.mode & 0o777 };
  } finally { await handle.close(); }
}
async function identity(cwd, file) {
  const entries = await git(cwd, ['ls-files', '--unmerged', '-z', '--', `:(literal)${file}`]);
  if (!entries) throw new Error('이 파일에는 미해결 충돌이 없습니다. 저장소 상태를 새로고침하세요.');
  const stages = entries.split('\0').filter(Boolean).map(row => {
    const match = /^(\d{6}) ([a-f0-9]{40,64}) ([123])\t([\s\S]+)$/.exec(row);
    if (!match || match[4] !== file || !['100644', '100755'].includes(match[1])) throw new Error('심볼릭 링크·submodule 충돌은 외부 Git 도구에서 해결하세요.');
    return { mode: match[1], oid: match[2], stage: Number(match[3]) };
  });
  const gitdir = (await git(cwd, ['rev-parse', '--absolute-git-dir'])).trim();
  const controls = await Promise.all(['HEAD', 'MERGE_HEAD', 'REBASE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'MERGE_MSG', 'rebase-merge/head-name', 'rebase-merge/onto', 'rebase-merge/orig-head', 'rebase-merge/msgnum', 'rebase-apply/next', 'rebase-apply/onto', 'rebase-apply/orig-head'].map(async name => {
    try { const target = path.join(gitdir, name), info = await fs.stat(target); return [name, await fs.readFile(target, 'utf8'), info.ino, info.mtimeMs, info.ctimeMs]; } catch (e) { if (e.code === 'ENOENT') return [name, null]; throw e; }
  }));
  const head = (await git(cwd, ['rev-parse', '--verify', 'HEAD'])).trim();
  return { stages, context: hash(JSON.stringify([cwd, file, entries, head, controls])) };
}
const backupPath = (vault, cwd, file) => path.join(vault, hash(JSON.stringify([cwd, file])) + '.json');
async function backup(vault, cwd, file) {
  try { return JSON.parse(await fs.readFile(backupPath(vault, cwd, file), 'utf8')); } catch (e) { if (e.code === 'ENOENT') return null; throw new Error('충돌 복원 사본을 읽을 수 없습니다. 원본 보호를 위해 저장을 중단합니다.'); }
}
async function read(cwd, file, vault) {
  text(file, '충돌 경로');
  const before = await identity(cwd, file);
  const working = await safeFile(cwd, file);
  const versions = await Promise.all([1, 2, 3].map(async stage => {
    const entry = before.stages.find(item => item.stage === stage);
    if (!entry) return null;
    if (Number(await git(cwd, ['cat-file', '-s', entry.oid])) > limit) throw new Error('1 MiB 이하의 충돌 원본만 비교할 수 있습니다.');
    return decode(await git(cwd, ['cat-file', 'blob', entry.oid], { encoding: 'buffer', maxBuffer: limit + 1 }));
  }));
  const current = decode(working.bytes);
  const after = await identity(cwd, file);
  if (before.context !== after.context || !working.bytes.equals((await safeFile(cwd, file)).bytes)) throw stale();
  const saved = await backup(vault, cwd, file);
  const contentHash = hash(working.bytes);
  return { file, context: before.context, token: hash(JSON.stringify([before.context, contentHash, working.mode])), base: versions[0], ours: versions[1], theirs: versions[2], current, mode: working.mode,
    canRestore: saved?.context === before.context && saved?.after === contentHash, eol: current.replaceAll('\r\n', '').includes('\r') ? 'mixed' : current.includes('\r\n') ? current.replaceAll('\r\n', '').includes('\n') ? 'mixed' : 'CRLF' : 'LF' };
}
async function change(cwd, input, vault) {
  return serial(cwd, async () => {
    if (!['apply', 'restore', 'resolve'].includes(input?.action)) throw new Error('충돌 작업을 확인하세요.');
    let current = await read(cwd, input.file, vault);
    if (current.token !== input.expected) throw stale();
    if (input.action === 'resolve') {
      const attribute = (await git(cwd, ['check-attr', '-z', 'conflict-marker-size', '--', input.file])).split('\0')[2];
      const size = /^[1-9]\d{0,3}$/.test(attribute) ? Number(attribute) : 7;
      if (new RegExp(`^(?:<{${size},}|={${size},}|>{${size},}|\\|{${size},})(?: |\\r?$)`, 'm').test(current.current)) throw new Error('충돌 표시가 남아 있습니다. 결과를 편집하고 저장한 뒤 해결 표시하세요.');
      if ((await read(cwd, input.file, vault)).token !== current.token) throw stale();
      await git(cwd, ['add', '--', `:(literal)${input.file}`]);
      try { return { repository: await state(cwd), snapshot: null }; }
      catch { throw new Error('해결 표시를 실행했지만 상태 조회에 실패했습니다. 다시 실행하기 전에 저장소 상태를 새로고침하세요.'); }
    }
    let result;
    if (input.action === 'restore') {
      if (!current.canRestore) throw new Error('현재 파일에 복원할 수 있는 직전 사본이 없습니다.');
      const saved = await backup(vault, cwd, input.file);
      result = decode(Buffer.from(saved.before, 'base64'));
    } else {
      result = text(input.result, '해결 결과', limit);
      if (Buffer.byteLength(result) > limit || Buffer.from(result).toString('utf8') !== result) throw new Error('1 MiB 이하의 UTF-8 결과만 저장할 수 있습니다.');
      if (current.eol === 'mixed') throw new Error('줄바꿈이 혼합된 파일은 외부 편집기에서 해결하세요.');
      result = result.replace(/\r\n/g, '\n');
      if (current.eol === 'CRLF') result = result.replace(/\n/g, '\r\n');
    }
    const target = path.join(cwd, input.file), temporary = path.join(path.dirname(target), `.branchline-${randomUUID()}.tmp`);
    await fs.mkdir(vault, { recursive: true, mode: 0o700 });
    const record = backupPath(vault, cwd, input.file), pending = record + '.' + randomUUID();
    let replaced = false;
    try {
      await fs.writeFile(temporary, result, { flag: 'wx', mode: 0o600, flush: true });
      await fs.chmod(temporary, current.mode);
      if (input.action === 'apply') {
        await fs.writeFile(pending, JSON.stringify({ context: current.context, before: Buffer.from(current.current).toString('base64'), after: hash(Buffer.from(result)) }), { flag: 'wx', mode: 0o600, flush: true });
      }
      const fresh = await read(cwd, input.file, vault);
      if (fresh.token !== current.token) throw stale();
      if (input.action === 'apply') await fs.rename(pending, record);
      await fs.rename(temporary, target);
      replaced = true;
      if (input.action === 'restore') await fs.rm(record);
      current = await read(cwd, input.file, vault);
      return { repository: await state(cwd), snapshot: current };
    } catch (error) {
      if (replaced) throw new Error('작업 파일을 변경했지만 후속 상태 확인에 실패했습니다. 원본을 다시 불러와 확인하세요. 복원 사본은 앱 데이터의 conflict-backups 폴더에서 확인할 수 있습니다.');
      throw error;
    } finally { await fs.rm(temporary, { force: true }); await fs.rm(pending, { force: true }); }
  });
}
module.exports = { read, change, safeFile, decode };
