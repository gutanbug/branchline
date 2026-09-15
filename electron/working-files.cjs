const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { git, text, serial } = require('./git.cjs');
const { safeFile, decode } = require('./conflicts.cjs');
const limit = 1024 * 1024;
const hash = value => createHash('sha256').update(value).digest('hex');

async function location(cwd, file, directory = false, allowMissing = false) {
  text(file, '파일 경로');
  if ((!file && !directory) || path.isAbsolute(file) || file.includes('\\') || (file && file.split('/').some(p => !p || p === '.' || p === '..' || p.toLowerCase() === '.git'))) throw new Error('저장소 내부 경로를 선택하세요.');
  let current = cwd;
  for (const part of file ? file.split('/') : []) {
    current = path.join(current, part);
    let info;
    try { info = await fs.lstat(current); } catch (e) { if (allowMissing && e.code === 'ENOENT') return path.join(cwd, file); throw e; }
    if (info.isSymbolicLink()) throw new Error('심볼릭 링크는 편집할 수 없습니다.');
    if (info.isDirectory() && await fs.lstat(path.join(current, '.git')).then(() => true, e => { if (e.code === 'ENOENT') return false; throw e; })) throw new Error('중첩 저장소·Submodule은 별도 저장소 탭에서 여세요.');
  }
  if (directory && !(await fs.lstat(current)).isDirectory()) throw new Error('폴더가 아닙니다.');
  return current;
}
async function list(cwd, folder = '') {
  const target = await location(cwd, folder, true), entries = [];
  const directory = await fs.opendir(target);
  // ponytail: one folder at a time, capped at 5,000 entries; paginate if real projects hit this ceiling.
  for await (const entry of directory) {
    if (entry.name.toLowerCase() === '.git') continue;
    if (entries.length >= 5000) throw new Error('이 폴더는 5,000개 항목을 초과합니다. 더 작은 폴더를 외부 편집기에서 여세요.');
    entries.push({ name: entry.name, path: folder ? `${folder}/${entry.name}` : entry.name, directory: entry.isDirectory(), disabled: !entry.isDirectory() && !entry.isFile() });
  }
  return entries.sort((a, b) => Number(b.directory) - Number(a.directory) || a.name.localeCompare(b.name));
}
async function read(cwd, file) {
  const target = await location(cwd, file);
  if (await git(cwd, ['ls-files', '--unmerged', '-z', '--', `:(literal)${file}`])) throw new Error('미해결 충돌 파일입니다. 충돌 해결 화면에서 편집하세요.');
  const context = await git(cwd, ['rev-parse', '--verify', 'HEAD']).catch(() => ''), branch = await git(cwd, ['symbolic-ref', '-q', 'HEAD']).catch(() => '');
  const before = await fs.lstat(target), working = await safeFile(cwd, file), after = await fs.lstat(target);
  if (before.ino !== after.ino || before.ctimeMs !== after.ctimeMs || before.size !== after.size) throw new Error('읽는 동안 파일이 변경되었습니다. 다시 시도하세요.');
  const current = decode(working.bytes), eol = current.replaceAll('\r\n', '').includes('\r') || (current.includes('\r\n') && current.replaceAll('\r\n', '').includes('\n')) ? 'mixed' : current.includes('\r\n') ? 'CRLF' : 'LF';
  return { file, current, eol, mode: working.mode, token: hash(JSON.stringify([file, context, branch, hash(working.bytes), working.mode, after.ino, after.ctimeMs])) };
}
async function save(cwd, input) {
  return serial(cwd, async () => {
    text(input?.file, '파일 경로'); text(input?.expected, '원본 확인'); text(input?.result, '편집 내용', limit);
    if (Buffer.byteLength(input.result) > limit || input.result.includes('\0') || Buffer.from(input.result).toString('utf8') !== input.result) throw new Error('1 MiB 이하의 UTF-8 텍스트만 저장할 수 있습니다.');
    const original = await read(cwd, input.file);
    const stale = () => new Error('파일 또는 브랜치가 외부에서 변경되었습니다. 초안을 유지했습니다. 복사한 뒤 파일을 다시 불러와 비교하세요.');
    if (original.token !== input.expected) throw stale();
    if (original.eol === 'mixed') throw new Error('줄바꿈이 혼합된 파일은 외부 편집기를 사용하세요.');
    const normalized = input.result.replaceAll('\r\n', '\n'), result = original.eol === 'CRLF' ? normalized.replaceAll('\n', '\r\n') : normalized;
    if (Buffer.byteLength(result) > limit) throw new Error('줄바꿈을 보존한 결과가 1 MiB를 초과합니다.');
    const target = await location(cwd, input.file), temporary = path.join(path.dirname(target), `.branchline-${randomUUID()}.tmp`);
    let replaced = false;
    try {
      await fs.writeFile(temporary, result, { flag: 'wx', mode: 0o600, flush: true });
      await fs.chmod(temporary, original.mode);
      if ((await read(cwd, input.file)).token !== original.token) throw stale();
      // External tools cannot join our queue: recheck immediately before atomic replacement.
      await fs.rename(temporary, target); replaced = true;
      return await read(cwd, input.file);
    } catch (e) {
      if (replaced) throw new Error('파일은 저장했지만 다시 읽지 못했습니다. 초안을 유지했습니다. 파일을 다시 불러와 확인하세요.');
      throw e;
    } finally { await fs.rm(temporary, { force: true }); }
  });
}
module.exports = { list, read, save, location };
