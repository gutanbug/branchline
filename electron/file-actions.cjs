const fs = require('node:fs/promises');
const path = require('node:path');
const { constants } = require('node:fs');
const { git, state, serial, text, diff } = require('./git.cjs');
const { location, read } = require('./working-files.cjs');

function ignorePattern(file, kind) {
  if (/[\r\n]/.test(file)) throw new Error('줄바꿈이 있는 경로는 무시 규칙에 추가할 수 없습니다.');
  const escape = value => value.replace(/[\\*?\[\]#! ]/g, '\\$&');
  if (kind === 'ignore-file') return `/${escape(file)}`;
  if (kind === 'ignore-extension' && path.extname(file)) return `*${escape(path.extname(file))}`;
  if (kind === 'ignore-folder' && path.dirname(file) !== '.') return `/${escape(path.dirname(file))}/`;
  throw new Error('무시할 파일·확장자·폴더를 확인하세요.');
}
async function changedFile(cwd, input) {
  text(input?.file, '파일 경로');
  if (typeof input.staged !== 'boolean') throw new Error('변경 범위를 확인하세요.');
  const repo = await state(cwd);
  if (repo.token !== input.expected) throw new Error('저장소 상태가 바뀌었습니다. 메뉴를 닫고 다시 검토하세요.');
  const entry = repo.files.find(file => file.path === input.file);
  if (!entry) throw new Error('변경 파일을 다시 선택하세요.');
  // Validate ancestors even when the selected tracked file has been deleted.
  const folder = path.dirname(entry.path);
  await location(cwd, folder === '.' ? '' : folder, true, true);
  const target = path.join(cwd, entry.path);
  let info;
  try { await location(cwd, entry.path); info = await fs.lstat(target); } catch (e) { if (e.code !== 'ENOENT') throw e; }
  if (info && (!info.isFile() || info.nlink !== 1)) throw new Error('일반 파일만 지원합니다. 링크·Submodule은 별도로 확인하세요.');
  return { repo, entry, target, info };
}
async function run(cwd, input, native = {}) {
  return serial(cwd, async () => {
    const { repo, entry, target, info } = await changedFile(cwd, input);
    const action = input.action, literal = `:(literal)${entry.path}`;
    if (action === 'copy-relative' || action === 'copy-absolute') { await native.copy(action === 'copy-relative' ? entry.path : target); return {}; }
    if (action === 'blame') {
      if (!repo.head || entry.untracked || entry.index === 'A') throw new Error('아직 커밋되지 않은 파일에는 Blame 이력이 없습니다.');
      const original = entry.originalPath || entry.path;
      return { text: await git(cwd, ['-c', 'core.quotepath=false', 'blame', '--date=iso-strict', '-l', repo.head, '--', original]) };
    }
    if (action === 'patch') {
      if (entry.conflict) throw new Error('충돌을 해결한 뒤 패치를 저장하세요.');
      let patch;
      if (entry.untracked) patch = await diff(cwd, { file: entry.path });
      else patch = await git(cwd, ['diff', ...(input.staged ? ['--cached'] : []), '--binary', '--full-index', '--no-ext-diff', '--no-textconv', '--', literal, ...(entry.originalPath ? [`:(literal)${entry.originalPath}`] : [])]);
      if (!patch.startsWith('diff --git ') || entry.untracked && patch.includes('\nBinary files ')) throw new Error('내보낼 패치가 없습니다. 새 바이너리·큰 파일은 먼저 스테이징하세요.');
      return { cancelled: await native.patch(patch, `${path.basename(entry.path)}.patch`) === false };
    }
    if (action === 'reveal' || action === 'open') {
      if (!info) throw new Error('작업 파일이 삭제되어 있습니다. 먼저 복원하세요.');
      await native[action](target); return {};
    }
    if (repo.operation || repo.files.some(file => file.conflict)) throw new Error('진행 중 Git 작업·충돌을 먼저 해결하세요.');
    if (action === 'discard') {
      if (input.staged || entry.untracked || entry.originalPath || entry.working === ' ') throw new Error('작업 파일의 추적 중인 변경만 취소할 수 있습니다. 새 파일은 휴지통으로 이동하세요.');
      await git(cwd, ['restore', '--worktree', '--', literal]);
    } else if (action === 'stash-file') {
      if (!repo.head || entry.originalPath) throw new Error('첫 커밋 전이나 이름 변경 파일은 전체 Stash 보관함을 사용하세요.');
      // Git's stash index parent includes other staged files even with a pathspec.
      if (repo.files.some(file => file.path !== entry.path && !file.untracked && file.index !== ' ')) throw new Error('다른 파일도 스테이징되어 있습니다. 먼저 스테이징을 해제하거나 전체 Stash를 사용하세요.');
      await git(cwd, ['stash', 'push', '--include-untracked', '-m', `Branchline: ${entry.path}`, '--', literal]);
    } else if (action === 'trash') {
      if (!info) throw new Error('이미 삭제된 파일입니다.');
      await native.trash(target);
    } else if (['ignore-file', 'ignore-extension', 'ignore-folder'].includes(action)) {
      if (!entry.untracked) throw new Error('이미 추적 중인 파일은 무시 규칙으로 제외되지 않습니다. 미추적 파일을 선택하세요.');
      const pattern = ignorePattern(entry.path, action), ignore = path.join(cwd, '.gitignore');
      let original;
      try { original = await read(cwd, '.gitignore'); } catch (e) { if (e.code !== 'ENOENT') throw e; }
      if (original?.eol === 'mixed') throw new Error('.gitignore의 혼합 줄바꿈을 먼저 정리하세요.');
      if (original?.current.replaceAll('\r\n', '\n').split('\n').includes(pattern)) throw new Error('같은 무시 규칙이 이미 있습니다. .gitignore의 예외 규칙과 하위 폴더 규칙을 확인하세요.');
      const handle = await fs.open(ignore, original ? constants.O_WRONLY | constants.O_APPEND | constants.O_NOFOLLOW : 'wx', 0o644);
      try {
        if (original) {
          const opened = await handle.stat(), existing = await fs.lstat(ignore);
          if (opened.ino !== existing.ino || (await read(cwd, '.gitignore')).token !== original.token) throw new Error('.gitignore가 바뀌었습니다. 다시 검토하세요.');
        }
        const eol = original?.eol === 'CRLF' ? '\r\n' : '\n';
        await handle.writeFile(`${original?.current && !original.current.endsWith('\n') ? eol : ''}${pattern}${eol}`); await handle.sync();
      } finally { await handle.close(); }
      const next = await state(cwd);
      if (next.files.some(file => file.path === entry.path && file.untracked)) throw new Error('무시 규칙은 추가했지만 선택한 파일은 계속 표시됩니다. 예외 규칙과 하위 폴더의 .gitignore를 확인하세요.');
      return { repository: next, pattern };
    } else throw new Error('지원하지 않는 파일 작업입니다.');
    return { repository: await state(cwd) };
  });
}
module.exports = { run, ignorePattern };
