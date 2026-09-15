const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const git = require('./git.cjs');

function address(value) {
  git.text(value, '원격 주소');
  if (!value || /[\r\n]/.test(value) || value.startsWith('-')) throw new Error('원격 주소를 확인하세요.');
  if (path.isAbsolute(value)) return value;
  if (/^[\w.-]+@[\w.-]+:[^\s]+$/.test(value) && !value.includes('::')) return value;
  let url; try { url = new URL(value); } catch { throw new Error('HTTPS·SSH 주소 또는 로컬 절대 경로를 입력하세요.'); }
  if (!['https:', 'ssh:', 'file:'].includes(url.protocol) || url.password || (url.protocol === 'https:' && url.username) || url.search || url.hash) throw new Error('자격 증명이 포함되지 않은 HTTPS·SSH 주소 또는 로컬 경로를 사용하세요.');
  return value;
}
function redacted(value) {
  return value.replace(/([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi, '$1[인증정보 숨김]@').replace(/([?&#](?:[^\s=]+)=)[^\s&#]+/g, '$1[숨김]');
}
async function optional(cwd, args) { try { return (await git.git(cwd, args)).trim(); } catch { return null; } }
async function remotes(cwd) {
  const names = (await git.git(cwd, ['remote'])).trim().split('\n').filter(Boolean);
  return Promise.all(names.map(async name => {
    const fetch = (await git.git(cwd, ['remote', 'get-url', '--all', name])).trim().split('\n');
    const push = (await git.git(cwd, ['remote', 'get-url', '--push', '--all', name])).trim().split('\n');
    let blocked = '';
    try {
      if (fetch.length !== 1 || push.length !== 1) throw new Error('여러 URL이 등록된 원격입니다. 단일 목적지로 정리한 뒤 사용하세요.');
      if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)) throw new Error('이 원격 이름은 앱에서 지원하지 않습니다.');
      await git.git(cwd, ['check-ref-format', `refs/remotes/${name}/branchline-check`]);
      address(fetch[0]); address(push[0]);
    } catch (e) { blocked = e.message; }
    return { name, fetch: fetch[0], push: push[0], blocked };
  }));
}
async function snapshot(cwd, offset = 0) {
  if (!Number.isInteger(offset) || offset < 0 || offset > 1000000) throw new Error('조회 위치를 확인하세요.');
  const [repository, list, raw] = await Promise.all([git.state(cwd), remotes(cwd), git.git(cwd, ['stash', 'list', '-z', '--format=%H%x00%gd%x00%gs%x00%cI', '--max-count=101', `--skip=${offset}`])]);
  const fields = raw.split('\0'), stashes = [];
  for (let i = 0; i + 3 < fields.length; i += 4) stashes.push({ sha: fields[i], ref: fields[i + 1], message: fields[i + 2], date: fields[i + 3] });
  const upstreamRef = repository.head ? await optional(cwd, ['rev-parse', '--symbolic-full-name', '@{upstream}']) : null;
  const remote = repository.branch ? await optional(cwd, ['config', '--get', `branch.${repository.branch}.remote`]) : null;
  const merge = repository.branch ? await optional(cwd, ['config', '--get', `branch.${repository.branch}.merge`]) : null;
  const counts = upstreamRef ? await optional(cwd, ['rev-list', '--left-right', '--count', `HEAD...${upstreamRef}`]) : null;
  const [ahead, behind] = counts ? counts.split(/\s+/).map(Number) : [null, null];
  return { repository, remotes: list.map(r => ({ ...r, fetch: redacted(r.fetch), push: redacted(r.push) })), upstream: { ref: upstreamRef, remote, branch: merge?.replace(/^refs\/heads\//, '') || null, ahead, behind }, stashes: stashes.slice(0, 100), hasMore: stashes.length > 100, offset };
}
async function network(cwd, args, signal) {
  const customSsh = process.env.GIT_SSH_COMMAND || process.env.GIT_SSH || await optional(cwd, ['config', '--get', 'core.sshCommand']);
  if (signal?.aborted) return Promise.reject(new Error('작업을 취소했습니다. 원격 반영 여부는 Fetch 후 확인하세요.'));
  return new Promise((resolve, reject) => {
    const child = spawn('git', ['--no-pager', '-c', 'protocol.allow=never', '-c', 'protocol.https.allow=always', '-c', 'protocol.ssh.allow=always', '-c', 'protocol.file.allow=always', ...args], {
      cwd, detached: process.platform !== 'win32', stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'Never', ...(!customSsh ? { GIT_SSH_COMMAND: 'ssh -oBatchMode=yes' } : {}), LC_ALL: 'C' },
    });
    let size = 0, output = '', reason = '', forceTimer;
    const kill = sig => { try { if (process.platform !== 'win32') process.kill(-child.pid, sig); else child.kill(sig); } catch { /* already exited */ } };
    const stop = message => { if (reason) return; reason = message; kill('SIGTERM'); forceTimer = setTimeout(() => kill('SIGKILL'), 1000); };
    const abort = () => stop('작업을 취소했습니다. 원격 반영 여부는 Fetch 후 확인하세요.');
    signal?.addEventListener('abort', abort, { once: true });
    const timer = setTimeout(() => stop('원격 작업 시간이 초과되었습니다. 연결과 원격 상태를 확인하세요.'), 120000);
    child.stdout.on('data', chunk => { size += chunk.length; if (size > 32 * 1024 * 1024) stop('Git 출력 한도를 초과했습니다.'); else output += chunk.toString(); });
    child.stderr.on('data', chunk => { size += chunk.length; if (size > 32 * 1024 * 1024) stop('Git 출력 한도를 초과했습니다.'); });
    let spawnError = false;
    child.on('error', () => { spawnError = true; });
    child.on('close', code => {
      clearTimeout(timer); clearTimeout(forceTimer); signal?.removeEventListener('abort', abort);
      // Provider/helper stderr can contain credentials; expose an actionable summary instead.
      if (reason || code !== 0 || spawnError) reject(new Error(reason || '원격 Git 작업에 실패했습니다. 주소·기존 credential helper/SSH 인증·권한과 원격 이력을 확인하세요. Push 거부 또는 중단 시 Fetch로 반영 여부를 확인한 뒤 다시 검토하세요.'));
      else resolve(output);
    });
    if (signal?.aborted) abort();
  });
}
const checks = new Map();
function fetchArgs(remote, branch) {
  return ['fetch', '--atomic', '--no-prune', '--no-tags', '--no-recurse-submodules', '--refmap=', '--', remote.fetch, branch ? `+refs/heads/${branch}:refs/remotes/${remote.name}/${branch}` : `+refs/heads/*:refs/remotes/${remote.name}/*`];
}
// Shared worktrees use one queue and one cooldown, including failed checks.
async function monitor(cwd, signal) {
  const key = await git.commonDir(cwd);
  return git.serial(cwd, async () => {
    const previous = checks.get(key);
    if (previous && Date.now() - previous.attemptedAt < 60000) return previous;
    const list = await remotes(cwd), errors = [];
    for (const remote of list) {
      try {
        if (remote.blocked) throw new Error(remote.blocked);
        await network(cwd, fetchArgs(remote), signal);
      } catch { errors.push(remote.name); }
    }
    const result = { attemptedAt: Date.now(), checkedAt: errors.length ? previous?.checkedAt || null : list.length ? new Date().toISOString() : null, configured: !!list.length, error: errors.length ? `${errors.join(', ')} 자동 Fetch 실패 · 연결·Git 인증을 확인하세요. 수치는 마지막으로 가져온 이력 기준입니다.` : '' };
    checks.set(key, result);
    return result;
  });
}
async function clone(source, target, signal) {
  address(source); git.text(target, '복제 경로');
  if (!path.isAbsolute(target)) throw new Error('복제할 절대 경로를 선택하세요.');
  // Reserve a new destination exclusively; never recursively clean a user-selected directory.
  await fs.mkdir(target);
  try { await network(path.dirname(target), ['clone', '--no-recurse-submodules', '--origin', 'origin', '--', source, target], signal); }
  catch (e) { throw new Error(`${e.message}\n복제 경로: ${target}\n실패한 경로는 자동 삭제하지 않습니다. 내용을 확인하고 다른 새 폴더로 재시도하세요.`); }
  return git.repository(target);
}
async function change(cwd, input, signal) {
  return git.serial(cwd, async () => {
    const current = await git.state(cwd);
    if (input.expected !== current.token) throw new Error('저장소 상태나 연결 설정이 바뀌었습니다. 새로고침 후 다시 검토하세요.');
    if (signal?.aborted) throw new Error('작업을 취소했습니다.');
    const { action } = input;
    if (action === 'remote-add') {
      const name = git.text(input.remote, '원격 이름', 128);
      if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(name)) throw new Error('원격 이름에 영문·숫자·점·밑줄·하이픈·슬래시를 사용하세요.');
      await git.git(cwd, ['check-ref-format', `refs/remotes/${name}/branchline-check`]);
      await git.git(cwd, ['remote', 'add', '--', name, address(input.url)]);
    } else if (['fetch', 'pull', 'push', 'upstream'].includes(action)) {
      const remote = (await remotes(cwd)).find(r => r.name === input.remote);
      if (!remote || remote.blocked) throw new Error(remote?.blocked || '원격 저장소를 다시 선택하세요.');
      let branch;
      if (action !== 'fetch') {
        branch = git.text(input.branch, '원격 브랜치', 256);
        if (!branch || branch.startsWith('-')) throw new Error('원격 브랜치 이름을 확인하세요.');
        await git.git(cwd, ['check-ref-format', `refs/heads/${branch}`]);
        if (!current.head || !current.branch || current.operation) throw new Error('커밋이 있는 로컬 브랜치에서 진행 중 Git 작업을 먼저 정리하세요.');
      }
      if (action === 'fetch' || action === 'pull') {
        const receive = async saved => {
          await network(cwd, fetchArgs(remote, action === 'pull' ? branch : undefined), signal);
          if (action !== 'pull') return;
          const fresh = await git.state(cwd);
          if (signal?.aborted) throw new Error('Fetch 후 취소했습니다. 작업 파일은 병합하지 않았습니다.');
          if (fresh.localToken !== saved.localToken) throw new Error('Fetch 중 로컬 상태가 바뀌어 Pull을 중단했습니다. 변경을 다시 검토하세요.');
          const sha = (await git.git(cwd, ['rev-parse', '--verify', '--end-of-options', `refs/remotes/${remote.name}/${branch}^{commit}`])).trim();
          try { await git.git(cwd, ['merge', '--ff-only', '--no-autostash', '--no-overwrite-ignore', '--no-edit', sha]); }
          catch { throw new Error('Fetch는 완료했지만 fast-forward Pull을 완료하지 못했습니다. 분기된 이력이나 작업 파일을 브랜치 비교에서 검토하세요.'); }
        };
        if (action === 'pull') await git.withAutoStash(cwd, current, current.branch, 'Pull', receive);
        else await receive(current);
      } else if (action === 'push') {
        await network(cwd, ['push', '--porcelain', '--no-mirror', '--no-follow-tags', '--recurse-submodules=no', '--', remote.push, `${current.head}:refs/heads/${branch}`], signal);
      } else await git.git(cwd, ['branch', `--set-upstream-to=refs/remotes/${remote.name}/${branch}`, '--', current.branch]);
    } else if (action === 'stash-save') {
      if (!current.head || current.operation || current.files.some(f => f.conflict)) throw new Error('첫 커밋과 진행 중 Git 작업을 먼저 완료하세요.');
      if (!current.files.some(f => input.includeUntracked === true || !f.untracked)) throw new Error('보관할 변경 사항이 없습니다.');
      const message = git.text(input.message || '', '보관 메시지', 1000).trim();
      if (!message) throw new Error('보관 메시지를 입력하세요.');
      await git.git(cwd, ['stash', 'push', ...(input.includeUntracked === true ? ['--include-untracked'] : []), '-m', message]);
    } else if (['stash-apply', 'stash-pop', 'stash-drop'].includes(action)) {
      if (!/^stash@\{\d+\}$/.test(input.stashRef) || !/^[a-f0-9]{40,64}$/.test(input.stashSha)) throw new Error('보관 항목을 다시 선택하세요.');
      const actual = (await git.git(cwd, ['rev-parse', '--verify', '--end-of-options', input.stashRef])).trim();
      if (actual !== input.stashSha) throw new Error('Stash 순서가 바뀌었습니다. 목록을 다시 확인하세요.');
      if (action === 'stash-apply' || action === 'stash-pop') {
        if (current.files.length || current.operation) throw new Error('깨끗한 작업 디렉터리에서 복원하세요.');
        try { await git.git(cwd, ['stash', action === 'stash-pop' ? 'pop' : 'apply', ...(input.restoreIndex === true ? ['--index'] : []), action === 'stash-pop' ? input.stashRef : actual]); }
        catch { throw new Error('Stash 복원을 완료하지 못했습니다. 충돌·부분 적용 상태를 내 변경 사항에서 확인하세요. 보관 원본은 유지했습니다.'); }
      } else await git.git(cwd, ['stash', 'drop', input.stashRef]);
    } else throw new Error('지원하지 않는 동기화 작업입니다.');
    try { return await git.state(cwd); } catch { throw new Error('Git 명령은 완료했지만 상태를 다시 읽지 못했습니다. 상태 새로고침과 원격 확인 후 다음 작업을 진행하세요.'); }
  });
}
async function preview(cwd, sha) {
  if (typeof sha !== 'string' || !/^[a-f0-9]{40,64}$/.test(sha)) throw new Error('Stash를 선택하세요.');
  return git.git(cwd, ['-c', 'core.quotepath=false', 'stash', 'show', '--stat', '--patch', '--include-untracked', '--no-ext-diff', '--no-textconv', sha]);
}
module.exports = { preview, address, redacted, snapshot, network, clone, change, monitor };
