const { execFile } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { promisify } = require('node:util');
const exec = promisify(execFile);
const queues = new Map();

function text(value, name, max = 4096) {
  if (typeof value !== 'string' || value.includes('\0') || value.length > max) throw new Error(`${name} 값이 올바르지 않습니다.`);
  return value;
}
async function git(cwd, args, options = {}) {
  const { okExitCodes = [], ...processOptions } = options;
  try {
    const { stdout } = await exec('git', ['--no-pager', ...args], {
      cwd, maxBuffer: 32 * 1024 * 1024, timeout: 30000,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' }, ...processOptions,
    });
    return stdout;
  } catch (error) {
    if (okExitCodes.includes(error.code) && error.stdout !== undefined) return error.stdout;
    throw new Error((error.stderr || error.message || 'Git 작업 실패').toString().slice(0, 3000));
  }
}
async function optional(cwd, args) { try { return (await git(cwd, args)).trim(); } catch { return null; } }
async function repository(input) {
  text(input, '저장소 경로');
  const cwd = await fs.realpath(input);
  if ((await git(cwd, ['rev-parse', '--is-bare-repository'])).trim() === 'true') throw new Error('작업 디렉터리가 있는 저장소를 선택하세요.');
  return fs.realpath((await git(cwd, ['rev-parse', '--show-toplevel'])).trim());
}
async function commonDir(cwd) { return fs.realpath(path.resolve(cwd, (await git(cwd, ['rev-parse', '--git-common-dir'])).trim())); }
async function serial(cwd, fn) {
  const key = await commonDir(cwd);
  const previous = queues.get(key) || Promise.resolve();
  const next = previous.catch(() => {}).then(fn);
  queues.set(key, next);
  try { return await next; } finally { if (queues.get(key) === next) queues.delete(key); }
}
function parseStatus(raw) {
  const parts = raw.split('\0'); const files = [];
  for (let i = 0; i < parts.length; i++) {
    const row = parts[i]; if (!row) continue;
    const index = row[0], working = row[1]; const filename = row.slice(3);
    const originalPath = /[RC]/.test(index + working) ? parts[++i] : null;
    files.push({ path: filename, originalPath, index, working, untracked: index === '?', conflict: /U/.test(index + working) || ['AA', 'DD'].includes(index + working) });
  }
  return files;
}
async function state(cwd) {
  const [head, branch, raw, refsRaw, shallow, gitdir, identityName, identityEmail] = await Promise.all([
    optional(cwd, ['rev-parse', '--verify', 'HEAD']), optional(cwd, ['symbolic-ref', '--short', '-q', 'HEAD']),
    git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    git(cwd, ['for-each-ref', '--format=%(refname)%00%(refname:short)%00%(objectname)%00%(upstream)%00%(upstream:track,nobracket)', 'refs/heads', 'refs/remotes']),
    git(cwd, ['rev-parse', '--is-shallow-repository']), git(cwd, ['rev-parse', '--absolute-git-dir']),
    optional(cwd, ['config', 'user.name']), optional(cwd, ['config', 'user.email']),
  ]);
  let operation = null;
  for (const [file, kind] of [['MERGE_HEAD', 'merge'], ['rebase-merge', 'rebase'], ['rebase-apply', 'rebase'], ['CHERRY_PICK_HEAD', 'cherry-pick']]) {
    try { await fs.access(path.join(gitdir.trim(), file)); operation = kind; break; } catch { /* absent */ }
  }
  const indexDiff = await git(cwd, ['diff', '--cached', '--no-ext-diff', '--no-textconv', '--binary']);
  const workingDiff = await git(cwd, ['diff', '--no-ext-diff', '--no-textconv', '--binary']);
  // ponytail: stat fingerprint for untracked files; use streaming hashes when full content guarantees are required.
  const untracked = await Promise.all(parseStatus(raw).filter(f => f.untracked).map(async f => { const info = await fs.lstat(path.join(cwd, f.path)); return [f.path, info.size, info.mtimeMs, info.ctimeMs]; }));
  const controls = operation ? await Promise.all(['MERGE_HEAD', 'MERGE_MSG', 'REBASE_HEAD', 'CHERRY_PICK_HEAD', 'rebase-merge/head-name', 'rebase-merge/onto', 'rebase-merge/orig-head', 'rebase-merge/git-rebase-todo', 'rebase-merge/msgnum', 'rebase-apply/next', 'rebase-apply/onto', 'rebase-apply/orig-head'].map(async name => {
    try { const target = path.join(gitdir.trim(), name), info = await fs.stat(target); return [name, await fs.readFile(target, 'utf8'), info.ino, info.mtimeMs, info.ctimeMs]; } catch (e) { if (e.code === 'ENOENT') return [name, null]; throw e; }
  })) : [];
  const localToken = createHash('sha256').update(JSON.stringify([head, branch, operation, controls, raw, indexDiff, workingDiff, untracked])).digest('hex');
  const configuration = await optional(cwd, ['config', '--null', '--get-regexp', '^(remote|branch|url)\\.']);
  const stashHead = await optional(cwd, ['rev-parse', '--verify', 'refs/stash']);
  const token = createHash('sha256').update(JSON.stringify([localToken, refsRaw, configuration, stashHead])).digest('hex');
  return { path: cwd, name: path.basename(cwd), head, branch, files: parseStatus(raw), token, localToken, shallow: shallow.trim() === 'true', operation,
    identity: { name: identityName, email: identityEmail }, checkedAt: new Date().toISOString(),
    refs: refsRaw.trim().split('\n').filter(Boolean).map(row => { const [ref, name, sha, upstream, track] = row.split('\0'); return { ref, name, sha, ...(upstream ? { tracking: { ref: upstream, ahead: track === 'gone' ? null : Number(track.match(/ahead (\d+)/)?.[1] || 0), behind: track === 'gone' ? null : Number(track.match(/behind (\d+)/)?.[1] || 0) } } : {}) }; }).filter(r => !r.ref.endsWith('/HEAD')) };
}
async function resolve(cwd, ref) {
  text(ref, '브랜치 또는 커밋', 1024);
  if (!ref || ref.startsWith('-')) throw new Error('브랜치 또는 커밋을 선택하세요.');
  return (await git(cwd, ['rev-parse', '--verify', '--end-of-options', `${ref}^{commit}`])).trim();
}
async function history(cwd, input = {}) {
  const { query = '', author = '', file = '', ref = '', offset = 0, after = '', before = '' } = input;
  for (const [key, value] of Object.entries({ query, author, file, ref, after, before })) text(value, key, 1024);
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('조회 위치가 올바르지 않습니다.');
  for (const date of [after, before]) if (date && (!/^\d{4}-\d{2}-\d{2}T/.test(date) || !Number.isFinite(Date.parse(date)))) throw new Error('날짜를 확인하세요.');
  const head = ref ? null : await optional(cwd, ['rev-parse', '--verify', 'HEAD']);
  if (input.revisions !== undefined && (!Array.isArray(input.revisions) || input.revisions.length > 4096 || input.revisions.some(sha => typeof sha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)))) throw new Error('이력 조회 기준이 올바르지 않습니다.');
  if (input.stashSha !== undefined && (typeof input.stashSha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(input.stashSha))) throw new Error('Stash SHA를 확인하세요.');
  const revisions = input.revisions ?? (ref ? [await resolve(cwd, ref)] : (await git(cwd, ['log', '--all', ...(head ? [head] : []), '--no-walk', '--format=%H'])).trim().split('\n').filter(Boolean));
  if (input.revisions === undefined && input.stashSha) { await resolve(cwd, input.stashSha); if (!revisions.includes(input.stashSha)) revisions.push(input.stashSha); }
  if (!revisions.length) return { commits: [], hasMore: false, offset, revisions, refSha: null };
  const args = ['log', ...revisions, '--topo-order', '-z', '--format=%H%x00%P%x00%an%x00%ae%x00%cI%x00%s', '--fixed-strings', '--regexp-ignore-case', '--max-count=101', `--skip=${offset}`];
  if (query) args.push(`--grep=${query}`);
  if (author) args.push(`--author=${author}`);
  if (after) args.push(`--since-as-filter=${after}`);
  if (before) args.push(`--until=${before}`);
  args.push('--'); if (file) args.push(`:(literal)${file}`);
  const raw = await git(cwd, args); const fields = raw.split('\0'); const commits = [];
  for (let i = 0; i + 5 < fields.length; i += 6) commits.push({ sha: fields[i], parents: fields[i + 1].split(' ').filter(Boolean), author: fields[i + 2], email: fields[i + 3], date: fields[i + 4], message: fields[i + 5] });
  return { commits: commits.slice(0, 100), hasMore: commits.length > 100, offset, revisions, refSha: ref ? revisions[0] : null };
}
async function compare(cwd, input) {
  const a = await resolve(cwd, input.a), b = await resolve(cwd, input.b);
  const modes = ['a', 'b', 'different', 'common', 'all'];
  if (!modes.includes(input.mode)) throw new Error('비교 모드를 확인하세요.');
  const bases = (await optional(cwd, ['merge-base', '--all', a, b]) || '').split('\n').filter(Boolean);
  const ranges = { a: [`${b}..${a}`], b: [`${a}..${b}`], different: [`${a}...${b}`], common: bases, all: [a, b] };
  const revisions = ranges[input.mode];
  const offset = input.offset ?? 0;
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) throw new Error('조회 위치를 확인하세요.');
  const raw = revisions.length ? await git(cwd, ['log', ...revisions, '--topo-order', '-z', '--format=%H%x00%P%x00%an%x00%ae%x00%cI%x00%s', '--max-count=101', `--skip=${offset}`, '--']) : '';
  const fields = raw.split('\0'), commits = [];
  for (let i = 0; i + 5 < fields.length; i += 6) commits.push({ sha: fields[i], parents: fields[i + 1].split(' ').filter(Boolean), author: fields[i + 2], email: fields[i + 3], date: fields[i + 4], message: fields[i + 5] });
  const counts = (await git(cwd, ['rev-list', '--left-right', '--count', `${a}...${b}`])).trim().split(/\s+/).map(Number);
  const introduced = input.diffMode === 'introduced';
  const diffError = introduced && bases.length !== 1 ? (bases.length ? '공통 조상이 여러 개입니다. 두 브랜치의 현재 파일 차이를 선택하세요.' : '공통 조상을 확인할 수 없습니다. 두 브랜치의 현재 파일 차이를 선택하세요.') : '';
  const diff = diffError ? '' : await git(cwd, ['-c', 'core.quotepath=false', 'diff', '--no-ext-diff', '--no-textconv', '--stat', '--patch', introduced ? bases[0] : b, a, '--']);
  return { a, b, bases, aOnly: counts[0], bOnly: counts[1], commits: commits.slice(0, 100), hasMore: commits.length > 100, offset, diff, diffError, shallow: (await git(cwd, ['rev-parse', '--is-shallow-repository'])).trim() === 'true' };
}
async function diff(cwd, input) {
  if (input.sha) return git(cwd, ['-c', 'core.quotepath=false', 'show', '--format=fuller', '--date=iso-strict', '--diff-merges=first-parent', '--no-ext-diff', '--no-textconv', await resolve(cwd, input.sha), '--']);
  const filename = text(input.file, '파일');
  const snapshot = await state(cwd); const entry = snapshot.files.find(f => f.path === filename);
  if (!entry) throw new Error('파일 상태가 바뀌었습니다. 새로고침하세요.');
  if (entry.untracked) return (await untrackedDiff(cwd, filename, false)) ?? '1 MiB보다 큰 미추적 파일입니다. 외부 편집기에서 확인하세요.';
  return git(cwd, ['-c', 'core.quotepath=false', 'diff', ...(input.staged ? ['--cached'] : []), '--no-ext-diff', '--no-textconv', '--', `:(literal)${filename}`, ...(entry.originalPath ? [`:(literal)${entry.originalPath}`] : [])]);
}
async function untrackedDiff(cwd, file, statistics) {
  const info = await fs.lstat(path.join(cwd, file));
  if (!info.isFile() && !info.isSymbolicLink()) throw new Error('일반 파일만 비교할 수 있습니다. 중첩 저장소는 별도 탭에서 여세요.');
  if (info.size > 1024 * 1024) return null;
  // Git compares symlinks as link targets, never as the contents they point to.
  return git(cwd, ['-c', 'core.quotepath=false', 'diff', '--no-index', '--no-ext-diff', '--no-textconv', ...(statistics ? ['--numstat', '-z'] : ['--patch']), '--', '/dev/null', file], { okExitCodes: [1] });
}
function parseNumstat(raw) {
  const parts = raw.split('\0'), stats = Object.create(null);
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    const match = /^(\d+|-)\t(\d+|-)\t([\s\S]*)$/.exec(parts[i]);
    if (!match) throw new Error('변경 줄 수를 읽을 수 없습니다. 다시 시도하세요.');
    let file = match[3];
    if (!file) { i++; file = parts[++i]; } // -z rename: old path, then destination.
    if (!file) throw new Error('변경 파일 경로를 읽을 수 없습니다.');
    stats[file] = match[1] === '-' || match[2] === '-' ? { added: null, deleted: null, reason: '바이너리' } : { added: Number(match[1]), deleted: Number(match[2]) };
  }
  return stats;
}
async function changeStats(cwd, expected) {
  text(expected, '저장소 상태');
  return serial(cwd, async () => {
    const snapshot = await state(cwd);
    if (snapshot.token !== expected) throw new Error('파일 상태가 바뀌었습니다. 상태를 새로고침하세요.');
    const args = ['diff', '--no-ext-diff', '--no-textconv', '--numstat', '-z'];
    const [working, staged] = (await Promise.all([git(cwd, args), git(cwd, [...args, '--cached'])])).map(parseNumstat);
    const untracked = snapshot.files.filter(file => file.untracked);
    // Limit concurrent Git children when a folder contains many new files.
    for (let i = 0; i < untracked.length; i += 4) await Promise.all(untracked.slice(i, i + 4).map(async file => {
      try {
        const raw = await untrackedDiff(cwd, file.path, true);
        working[file.path] = raw === null ? { added: null, deleted: null, reason: '1 MiB 초과' } : Object.values(parseNumstat(raw))[0] || { added: 0, deleted: 0 };
      } catch { working[file.path] = { added: null, deleted: null, reason: '조회 실패' }; }
    }));
    if ((await state(cwd)).token !== expected) throw new Error('조회 중 파일이 바뀌었습니다. 다시 시도하세요.');
    return { working, staged };
  });
}
async function worktrees(cwd) {
  const out = await git(cwd, ['worktree', 'list', '--porcelain', '-z']);
  return out.split('\0\0').filter(Boolean).map(block => {
    const result = { path: '', branch: null, head: '', locked: false, prunable: false };
    for (const item of block.split('\0')) {
      if (item.startsWith('worktree ')) result.path = item.slice(9);
      if (item.startsWith('HEAD ')) result.head = item.slice(5);
      if (item.startsWith('branch ')) result.branch = item.slice(7).replace('refs/heads/', '');
      if (item.startsWith('locked')) result.locked = true;
      if (item.startsWith('prunable')) result.prunable = true;
    }
    return result;
  });
}
// Callers hold the common-repository write queue across save, operation and restore.
async function withAutoStash(cwd, current, target, label, run) {
  if (current.operation || current.files.some(file => file.conflict)) throw new Error('진행 중 Git 작업과 충돌을 먼저 해결하세요.');
  let stash, saved = current;
  const retained = () => `자동 Stash ${stash}를 보존했습니다. 왼쪽 Stash에서 내용을 확인하고 복원하세요.`;
  if (current.files.length) {
    if (!current.head) throw new Error('첫 커밋 전에 변경 사항을 자동 Stash할 수 없습니다. 먼저 첫 커밋을 만드세요.');
    const message = `Branchline ${label} ${current.branch || 'detached HEAD'} → ${target} · ${randomUUID()}`;
    try {
      await git(cwd, ['stash', 'push', '--include-untracked', '--no-keep-index', '-m', message]);
    } catch (error) {
      throw new Error(`자동 Stash를 완료하지 못해 ${label}하지 않았습니다. 작업 파일과 Stash 목록을 확인하세요.\n${error.message}`);
    }
    const entries = (await git(cwd, ['stash', 'list', '--format=%H%x00%gs'])).split('\n');
    stash = entries.find(row => row.endsWith(`: ${message}`))?.split('\0')[0];
    if (!stash) throw new Error(`자동 Stash를 확인하지 못해 ${label}하지 않았습니다. 작업 파일과 Stash 목록을 확인하세요.`);
    saved = await state(cwd);
    if (saved.files.length || saved.head !== current.head || saved.branch !== current.branch || saved.operation) throw new Error(`자동 보관 후에도 변경 사항이 있거나 브랜치가 바뀌어 ${label}을 중단했습니다. 서브모듈 변경도 확인하세요. ${retained()}`);
  }
  try {
    await run(saved);
  } catch (error) {
    if (!stash) throw error;
    const failed = await state(cwd);
    let restored = false;
    if (failed.head === current.head && failed.branch === current.branch && !failed.operation && !failed.files.length) {
      try { await git(cwd, ['stash', 'apply', '--index', stash]); restored = true; } catch { /* Keep the snapshot even if recovery is partial. */ }
    }
    throw new Error(`${label} 실패 · 현재 브랜치: ${failed.branch || 'detached HEAD'}. ${restored ? '원래 작업 변경을 복원했습니다. ' : ''}${retained()}\n${error.message}`);
  }
  if (!stash) return;
  try {
    const switched = await state(cwd);
    if (switched.branch !== target || switched.operation || switched.files.length) throw new Error(`${label} 이후 다른 변경이 감지되었습니다.`);
    await git(cwd, ['stash', 'apply', '--index', stash]);
    const applied = await state(cwd);
    if (applied.branch !== target || applied.head !== switched.head || applied.operation || applied.files.some(file => file.conflict)) throw new Error('적용 후 브랜치와 충돌 상태를 확인해야 합니다.');
  } catch (error) {
    throw new Error(`${target} ${label} 후 변경 복원을 완료하지 못했습니다. 충돌 또는 스테이징 상태를 확인하세요. ${retained()}\n${error.message}`);
  }
  // ponytail: external Git bypasses the app queue; recheck SHA before drop, coordinate writers if cross-process transactions are required.
  if (await optional(cwd, ['rev-parse', '--verify', 'refs/stash']) !== stash) throw new Error(`${label}과 변경 복원은 완료했지만 Stash 목록이 바뀌었습니다. ${retained()}`);
  try { await git(cwd, ['stash', 'drop', 'stash@{0}']); }
  catch (error) { throw new Error(`${label}과 변경 복원은 완료했지만 자동 Stash를 삭제하지 못했습니다. ${retained()}\n${error.message}`); }
}
async function amendPreview(cwd, sha) {
  return serial(cwd, async () => {
    const repository = await state(cwd);
    if (!sha || sha !== repository.head || !repository.branch || repository.operation || repository.files.some(file => file.conflict)) throw new Error('진행 중 작업과 충돌이 없는 현재 브랜치 HEAD만 Amend할 수 있습니다.');
    const [message, diff, stagedDiff, published] = await Promise.all([
      git(cwd, ['show', '--no-patch', '--format=%B', sha]),
      git(cwd, ['show', '--format=', '--diff-merges=first-parent', '--no-ext-diff', '--no-textconv', sha, '--']),
      git(cwd, ['diff', '--cached', '--no-ext-diff', '--no-textconv']),
      git(cwd, ['for-each-ref', `--contains=${sha}`, '--format=%(refname:short)', 'refs/remotes']),
    ]);
    return { sha, token: repository.token, message: message.replace(/\n$/, ''), diff, stagedDiff, published: published.trim().split('\n').filter(Boolean), stagedFiles: repository.files.filter(file => !file.untracked && file.index !== ' ').map(file => file.path) };
  });
}
async function mutate(cwd, input) {
  return serial(cwd, async () => {
    const current = await state(cwd);
    if (input.expected !== current.token) throw new Error('저장소 상태가 바뀌었습니다. 새로고침 후 다시 검토하세요.');
    const { action } = input;
    if (['merge', 'rebase'].includes(action)) {
      if (!current.branch || !current.head || current.operation || current.files.length) throw new Error('변경을 커밋하거나 Stash에 보관하고 진행 중 작업을 완료한 뒤 실행하세요.');
      const base = await resolve(cwd, input.base);
      if (base === current.head) throw new Error('현재 HEAD와 다른 적용 대상을 선택하세요.');
      const args = action === 'merge' ? ['merge', '--ff', '--commit', '--no-squash', '--no-edit', '--no-autostash', base] : ['rebase', '--no-autostash', '--no-update-refs', '--no-rebase-merges', base];
      await git(cwd, args, { env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true', GIT_SEQUENCE_EDITOR: 'true' } });
    } else if (action === 'cherry-pick') {
      if (!current.branch || !current.head || current.operation || current.files.length) throw new Error('변경을 커밋하거나 Stash에 보관하고 진행 중 작업을 완료한 뒤 실행하세요.');
      if (typeof input.base !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(input.base)) throw new Error('검토한 커밋 SHA를 확인하세요.');
      const commit = await resolve(cwd, input.base);
      const parents = (await git(cwd, ['show', '-s', '--format=%P', commit, '--'])).trim().split(' ').filter(Boolean);
      if (parents.length > 1 ? !Number.isInteger(input.mainline) || input.mainline < 1 || input.mainline > parents.length : input.mainline !== undefined) throw new Error('Merge 커밋은 적용 기준 부모를 명시적으로 선택하세요.');
      await git(cwd, ['cherry-pick', '--no-edit', '-x', ...(parents.length > 1 ? ['-m', String(input.mainline)] : []), commit], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true' } });
    } else if (action === 'skip') {
      if (current.operation !== 'cherry-pick' || input.operation !== current.operation) throw new Error('진행 중 Cherry-pick을 다시 확인하세요.');
      await git(cwd, ['cherry-pick', '--skip'], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_EDITOR: 'true' } });
    } else if (action === 'abort') {
      if (!['merge', 'rebase', 'cherry-pick'].includes(current.operation) || input.operation !== current.operation) throw new Error('진행 중 Git 작업이 바뀌었습니다. 다시 확인하세요.');
      await git(cwd, [current.operation, '--abort']);
    } else if (['stage-all', 'unstage-all'].includes(action)) {
      if (current.files.some(file => file.conflict)) throw new Error('충돌 파일을 먼저 해결하세요.');
      if (action === 'stage-all') await git(cwd, ['add', '-A', '--', '.']);
      else if (current.head) await git(cwd, ['restore', '--staged', '--', '.']);
      else await git(cwd, ['rm', '--cached', '-r', '--', '.']);
    } else if (['stage-hunk', 'unstage-hunk'].includes(action)) {
      const staged = action === 'unstage-hunk';
      const file = current.files.find(f => f.path === input.file);
      if (current.operation || !file || file.conflict || file.untracked || file.originalPath || (staged ? file.index : file.working) !== 'M') throw new Error('일반 텍스트 수정 파일만 구간별로 처리할 수 있습니다. 이 파일은 전체 스테이징을 사용하세요.');
      const patch = await diff(cwd, { file: file.path, staged });
      if (typeof input.preview !== 'string' || patch !== input.preview) throw new Error('변경 내용이 바뀌었습니다. 다시 검토하세요.');
      const starts = [...patch.matchAll(/^@@ /gm)].map(match => match.index);
      const header = patch.slice(0, starts[0]);
      if (!Number.isInteger(input.hunk) || input.hunk < 0 || input.hunk >= starts.length || (patch.match(/^diff --git /gm) || []).length !== 1 || !/^index [a-f0-9]+\.\.[a-f0-9]+ 100(?:644|755)$/m.test(header) || /^(old mode|new mode|new file|deleted file|rename |copy |Binary files|GIT binary patch)/m.test(header)) throw new Error('구간별로 처리할 수 없는 변경입니다. 파일 전체 스테이징을 사용하세요.');
      const folder = await fs.mkdtemp(path.join(require('node:os').tmpdir(), 'branchline-hunk-'));
      try {
        const target = path.join(folder, 'change.patch');
        await fs.writeFile(target, header + patch.slice(starts[input.hunk], starts[input.hunk + 1]), { mode: 0o600 });
        const args = ['apply', '--cached', '--whitespace=nowarn', ...(staged ? ['--reverse'] : [])];
        await git(cwd, [...args, '--check', target]);
        if ((await state(cwd)).token !== input.expected) throw new Error('저장소 상태가 바뀌었습니다. 다시 검토하세요.');
        await git(cwd, [...args, target]);
      } finally { await fs.rm(folder, { recursive: true, force: true }); }
    } else if (['stage', 'unstage'].includes(action)) {
      const file = current.files.find(f => f.path === input.file);
      if (!file || file.conflict) throw new Error('대상 파일을 다시 확인하세요. 충돌 파일은 수동 해결이 필요합니다.');
      const paths = [file.path, ...(file.originalPath ? [file.originalPath] : [])].map(f => `:(literal)${f}`);
      if (action === 'stage') await git(cwd, ['add', '--', ...paths]);
      else if (current.head) await git(cwd, ['restore', '--staged', '--', ...paths]);
      else await git(cwd, ['rm', '--cached', '--', ...paths]);
    } else if (action === 'amend') {
      if (!current.head || !current.branch || input.base !== current.head || current.operation || current.files.some(file => file.conflict)) throw new Error('진행 중 작업과 충돌이 없는 현재 브랜치 HEAD만 Amend할 수 있습니다.');
      if (typeof input.includeStaged !== 'boolean') throw new Error('스테이징 변경 포함 여부를 확인하세요.');
      const message = text(input.message, '커밋 메시지', 10000).trim();
      if (!message || !message.split('\n')[0].trim()) throw new Error('커밋 제목을 입력하세요.');
      const published = (await git(cwd, ['for-each-ref', `--contains=${current.head}`, '--format=%(refname)', 'refs/remotes'])).trim();
      if (published && input.rewritePublished !== true) throw new Error('원격에 공유된 커밋의 재작성 여부를 확인하세요.');
      await git(cwd, ['commit', '--amend', '--allow-empty', '--cleanup=verbatim', ...(!input.includeStaged ? ['--only'] : []), '-m', message]);
    } else if (action === 'commit') {
      if (current.operation || current.files.some(f => f.conflict)) throw new Error('진행 중 Git 작업을 먼저 완료하세요.');
      const message = text(input.message, '커밋 메시지', 10000).trim();
      if (!message) throw new Error('커밋 메시지를 입력하세요.');
      if (!current.files.some(f => !f.untracked && f.index !== ' ')) throw new Error('스테이징된 변경이 없습니다.');
      await git(cwd, ['commit', '-m', message]);
    } else if (action === 'continue') {
      if (!['merge', 'rebase', 'cherry-pick'].includes(current.operation) || input.operation !== current.operation) throw new Error('진행 중 Git 작업이 바뀌었습니다. 상태를 다시 확인하세요.');
      if (current.files.some(f => f.conflict)) throw new Error('모든 충돌 파일을 먼저 해결 표시하세요.');
      if (current.files.some(f => !f.untracked && f.working !== ' ')) throw new Error('작업 파일의 변경을 검토하고 스테이징한 뒤 계속하세요.');
      await git(cwd, [current.operation, '--continue'], { env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C', GIT_EDITOR: 'true' } });
    } else if (action === 'branch') {
      const name = text(input.name, '브랜치 이름', 256); if (name.startsWith('-')) throw new Error('브랜치 이름을 확인하세요.');
      await git(cwd, ['check-ref-format', '--branch', name]);
      await git(cwd, ['branch', name, await resolve(cwd, input.base || 'HEAD')]);
    } else if (['branch-rename', 'branch-delete', 'switch-remote'].includes(action)) {
      if (current.operation) throw new Error('진행 중 Git 작업을 먼저 완료하세요.');
      const remote = action === 'switch-remote';
      const branch = current.refs.find(r => r.ref === input.ref && r.ref.startsWith(remote ? 'refs/remotes/' : 'refs/heads/'));
      if (!branch || branch.sha !== input.base) throw new Error('대상 브랜치가 바뀌었습니다. 메뉴를 다시 열어 검토하세요.');
      const name = branch.ref.slice(remote ? 13 : 11);
      if (!remote && (await worktrees(cwd)).some(w => w.branch === name && (action === 'branch-delete' || w.path !== cwd))) throw new Error('Worktree에서 사용 중인 브랜치입니다. 먼저 다른 브랜치로 전환하세요.');
      if (action === 'branch-delete') {
        if (!current.head) throw new Error('현재 HEAD를 확인하세요.');
        try { await git(cwd, ['merge-base', '--is-ancestor', branch.sha, current.head]); } catch { throw new Error('현재 HEAD에 병합되지 않은 브랜치는 삭제하지 않습니다. 먼저 변경을 비교하세요.'); }
        await git(cwd, ['branch', '-d', '--', name]);
      } else {
        const next = text(input.name, '브랜치 이름', 256);
        if (!next || next.startsWith('-')) throw new Error('브랜치 이름을 확인하세요.');
        await git(cwd, ['check-ref-format', `refs/heads/${next}`]);
        if (remote) {
          if (current.refs.some(ref => ref.ref === `refs/heads/${next}`)) throw new Error('같은 이름의 로컬 브랜치가 이미 있습니다. 다른 이름을 입력하세요.');
          await withAutoStash(cwd, current, next, '체크아웃', () => git(cwd, ['switch', '--no-overwrite-ignore', '--track=direct', '-c', next, '--', branch.ref]));
        } else await git(cwd, ['branch', '-m', '--', name, next]);
      }
    } else if (action === 'switch') {
      const branch = current.refs.find(r => r.ref === input.ref && r.ref.startsWith('refs/heads/'));
      if (!branch) throw new Error('로컬 브랜치를 선택하세요.');
      if (input.base && input.base !== branch.sha) throw new Error('대상 브랜치가 바뀌었습니다. 다시 검토하세요.');
      if ((await worktrees(cwd)).some(tree => tree.branch === branch.ref.slice(11) && tree.path !== cwd)) throw new Error('다른 Worktree에서 사용 중인 브랜치입니다. 해당 Worktree를 탭에서 여세요.');
      await withAutoStash(cwd, current, branch.ref.slice(11), '체크아웃', () => git(cwd, ['switch', '--no-overwrite-ignore', '--', branch.ref.slice(11)]));
    } else if (action === 'identity') {
      const name = text(input.name, '작성자 이름', 256).trim(), email = text(input.email, '이메일', 320).trim();
      if (!name || !email || /[\r\n]/.test(name + email)) throw new Error('작성자 이름과 이메일을 확인하세요.');
      await git(cwd, ['config', '--local', 'user.name', name]); await git(cwd, ['config', '--local', 'user.email', email]);
    } else if (action === 'worktree-add') {
      const target = text(input.target, 'worktree 경로'); if (!path.isAbsolute(target)) throw new Error('절대 경로를 입력하세요.');
      const mode = input.worktreeMode || 'new';
      if (!['new', 'existing', 'detached'].includes(mode)) throw new Error('Worktree 생성 방식을 확인하세요.');
      if (mode === 'existing') {
        const branch = current.refs.find(ref => ref.ref === input.ref && ref.ref.startsWith('refs/heads/'));
        if (!branch) throw new Error('기존 로컬 브랜치를 선택하세요.');
        if ((await worktrees(cwd)).some(item => item.branch === branch.ref.slice(11))) throw new Error('다른 Worktree에서 사용 중인 브랜치입니다. 해당 Worktree를 탭에서 여세요.');
        await git(cwd, ['worktree', 'add', '--', target, branch.ref.slice(11)]);
      } else if (mode === 'detached') await git(cwd, ['worktree', 'add', '--detach', '--', target, await resolve(cwd, input.base || 'HEAD')]);
      else {
        const name = text(input.name, '새 브랜치', 256); if (name.startsWith('-')) throw new Error('브랜치 이름을 확인하세요.');
        await git(cwd, ['check-ref-format', '--branch', name]);
        await git(cwd, ['worktree', 'add', '-b', name, '--', target, await resolve(cwd, input.base || 'HEAD')]);
      }
    } else if (['worktree-remove', 'worktree-lock', 'worktree-unlock'].includes(action)) {
      const list = await worktrees(cwd); const item = list.find(w => w.path === input.target);
      if (!item || item.path === list[0].path || item.path === cwd) throw new Error('현재 또는 기본 worktree에는 이 작업을 할 수 없습니다.');
      if (action === 'worktree-remove') { if ((await state(item.path)).files.length) throw new Error('worktree에 변경 사항이 있습니다.'); await git(cwd, ['worktree', 'remove', '--', item.path]); }
      else await git(cwd, ['worktree', action === 'worktree-lock' ? 'lock' : 'unlock', '--', item.path]);
    } else throw new Error('지원하지 않는 Git 작업입니다.');
    return state(cwd);
  });
}
module.exports = { git, text, repository, state, history, compare, diff, changeStats, worktrees, mutate, parseStatus, serial, commonDir, amendPreview, withAutoStash };
