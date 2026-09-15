'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fsp = require('node:fs/promises');

const RS = '\x1e';
const FS = '\x1f';

function run(cwd, args) {
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_EDITOR: 'true', EDITOR: 'true', GIT_TERMINAL_PROMPT: '0' }
    }, (err, stdout, stderr) => {
      if (err) {
        const message = (stderr || err.message || '').trim();
        reject(Object.assign(new Error(message || 'git 명령이 실패했습니다.'), { code: err.code, stderr: message }));
        return;
      }
      resolve(stdout);
    });
  });
}

function runWithInput(cwd, args, input) {
  return new Promise((resolve, reject) => {
    const child = execFile('git', args, {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_EDITOR: 'true', EDITOR: 'true', GIT_TERMINAL_PROMPT: '0' }
    }, (err, stdout, stderr) => {
      if (err) {
        const message = (stderr || err.message || '').trim();
        reject(Object.assign(new Error(message || 'git 명령이 실패했습니다.'), { code: err.code, stderr: message }));
        return;
      }
      resolve(stdout);
    });
    child.stdin.write(input);
    child.stdin.end();
  });
}

function runEnv(cwd, args, extraEnv) {
  return new Promise((resolve, reject) => {
    execFile('git', args, {
      cwd,
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_EDITOR: 'true', EDITOR: 'true', GIT_TERMINAL_PROMPT: '0', ...extraEnv }
    }, (err, stdout, stderr) => {
      if (err) {
        const message = (stderr || err.message || '').trim();
        reject(Object.assign(new Error(message || 'git 명령이 실패했습니다.'), { code: err.code, stderr: message }));
        return;
      }
      resolve(stdout);
    });
  });
}

async function assertRepo(repoPath) {
  try {
    const top = (await run(repoPath, ['rev-parse', '--show-toplevel'])).trim();
    return top;
  } catch {
    throw new Error('선택한 경로는 Git 저장소가 아닙니다.');
  }
}

async function currentBranch(repoPath) {
  try {
    const name = (await run(repoPath, ['symbolic-ref', '--short', '-q', 'HEAD'])).trim();
    return name || null;
  } catch {
    return null;
  }
}

async function listBranches(repoPath) {
  const out = await run(repoPath, ['for-each-ref', '--format=%(refname:short)' + FS + '%(objectname)', 'refs/heads', 'refs/remotes']);
  const refs = {};
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    const [name, sha] = line.split(FS);
    if (name === 'origin' || name.endsWith('/HEAD')) continue;
    refs[name] = sha;
  }
  return refs;
}

async function listTags(repoPath) {
  const out = await run(repoPath, ['for-each-ref', '--format=%(refname:short)' + FS + '%(objectname)' + FS + '%(objecttype)', 'refs/tags']);
  return out.split('\n').filter(Boolean).map(line => {
    const [name, sha, type] = line.split(FS);
    return { name, sha, annotated: type === 'tag' };
  });
}

async function log(repoPath, limit = 400) {
  const format = ['%H', '%h', '%an', '%ad', '%P', '%G?', '%GS', '%s'].join(FS);
  const out = await run(repoPath, ['log', '--all', '--date-order', `--format=${format}${RS}`, '--date=format:%Y-%m-%d' + FS + '%H:%M:%S', `-n${limit}`]);
  return out.split(RS).map(rec => rec.replace(/^\n/, '')).filter(Boolean).map(rec => {
    const [sha, short, author, date, time, parents, signature, signer, ...rest] = rec.split(FS);
    return {
      id: sha,
      sha: short,
      author,
      date,
      time,
      parents: parents ? parents.split(' ').filter(Boolean) : [],
      signature: signature || 'N',
      signer: signer || '',
      title: rest.join(FS).trim()
    };
  });
}

async function fileHistory(repoPath, file, limit = 200) {
  const format = ['%H', '%h', '%an', '%ad', '%s'].join(FS);
  const out = await run(repoPath, ['log', '--follow', `--format=${format}`, '--date=format:%Y-%m-%d' + FS + '%H:%M:%S', `-n${limit}`, '--', file]);
  return out.split('\n').filter(Boolean).map(line => {
    const [sha, shortSha, author, date, time, ...rest] = line.split(FS);
    return { sha, shortSha, author, date, time, subject: rest.join(FS) };
  });
}

function parseBlame(text) {
  const lines = text.split('\n');
  const commits = {};
  const result = [];
  let i = 0;
  while (i < lines.length) {
    const header = lines[i];
    const m = header && header.match(/^([0-9a-f]{40}) (\d+) (\d+)/);
    if (!m) { i++; continue; }
    const sha = m[1];
    const finalLine = Number(m[3]);
    i++;
    if (!commits[sha]) commits[sha] = { sha };
    while (i < lines.length && !lines[i].startsWith('\t')) {
      const l = lines[i];
      if (l.startsWith('author ')) commits[sha].author = l.slice(7);
      else if (l.startsWith('author-time ')) commits[sha].authorTime = Number(l.slice(12));
      else if (l.startsWith('summary ')) commits[sha].summary = l.slice(8);
      i++;
    }
    const content = i < lines.length ? lines[i].slice(1) : '';
    i++;
    result.push({
      line: finalLine,
      sha,
      shortSha: sha.slice(0, 7),
      author: commits[sha].author || '',
      summary: commits[sha].summary || '',
      authorTime: commits[sha].authorTime || 0,
      content
    });
  }
  return result;
}

async function blame(repoPath, file, ref) {
  const out = await run(repoPath, ['blame', '--porcelain', ...(ref ? [ref] : []), '--', file]);
  return parseBlame(out);
}

async function status(repoPath) {
  const out = await run(repoPath, ['status', '--porcelain=v1', '-z']);
  const entries = out.split('\0').filter(Boolean);
  const files = [];
  for (const entry of entries) {
    const x = entry[0], y = entry[1], file = entry.slice(3);
    if (x === '?' && y === '?') { files.push({ path: file, staged: false, status: '?' }); continue; }
    if (x !== ' ' && x !== '?') files.push({ path: file, staged: true, status: x });
    if (y !== ' ') files.push({ path: file, staged: false, status: y });
  }
  return files;
}

async function readGitignore(repoPath) {
  try {
    return await fsp.readFile(path.join(repoPath, '.gitignore'), 'utf8');
  } catch {
    return '';
  }
}

async function writeGitignore(repoPath, content) {
  const normalized = content.endsWith('\n') || content === '' ? content : content + '\n';
  await fsp.writeFile(path.join(repoPath, '.gitignore'), normalized, 'utf8');
}

async function ignorePath(repoPath, pattern) {
  const current = await readGitignore(repoPath);
  const lines = current.split('\n').map(l => l.trim());
  if (lines.includes(pattern.trim())) return;
  const next = current === '' || current.endsWith('\n') ? current + pattern + '\n' : current + '\n' + pattern + '\n';
  await writeGitignore(repoPath, next);
}

const untrackFile = (repoPath, file) => run(repoPath, ['rm', '--cached', '--', file]);

async function listRemotes(repoPath) {
  const out = await run(repoPath, ['remote', '-v']);
  const map = new Map();
  for (const line of out.split('\n')) {
    const m = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
    if (m) map.set(m[1], m[2]);
  }
  return [...map].map(([name, url]) => ({ name, url }));
}

async function listStashes(repoPath) {
  const out = await run(repoPath, ['stash', 'list', `--format=%gd${FS}%s`]);
  return out.split('\n').filter(Boolean).map(line => {
    const [ref, title] = line.split(FS);
    return { ref, title };
  });
}

async function gitDir(repoPath) {
  return (await run(repoPath, ['rev-parse', '--git-dir'])).trim();
}

async function pathExists(p) {
  try { await fsp.access(p); return true; } catch { return false; }
}

async function operationState(repoPath) {
  const dir = await gitDir(repoPath);
  const abs = name => path.isAbsolute(dir) ? path.join(dir, name) : path.join(repoPath, dir, name);
  if (await pathExists(abs('MERGE_HEAD'))) return 'merge';
  if (await pathExists(abs('CHERRY_PICK_HEAD'))) return 'cherry-pick';
  if (await pathExists(abs('REVERT_HEAD'))) return 'revert';
  if (await pathExists(abs('rebase-merge')) || await pathExists(abs('rebase-apply'))) return 'rebase';
  return null;
}

async function conflictedFiles(repoPath) {
  const out = await run(repoPath, ['diff', '--name-only', '--diff-filter=U', '-z']);
  return out.split('\0').filter(Boolean);
}

function unquoteGitString(str) {
  if (!str.startsWith('"') || !str.endsWith('"')) return str;
  const inner = str.slice(1, -1);
  const bytes = [];
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '\\') {
      const next = inner[i + 1];
      if (next === 'n') { bytes.push(10); i++; }
      else if (next === 't') { bytes.push(9); i++; }
      else if (next === '\\') { bytes.push(92); i++; }
      else if (next === '"') { bytes.push(34); i++; }
      else if (/[0-7]/.test(next || '')) { bytes.push(parseInt(inner.slice(i + 1, i + 4), 8)); i += 3; }
      else { bytes.push(inner.charCodeAt(i)); }
    } else {
      bytes.push(inner.charCodeAt(i));
    }
  }
  return Buffer.from(bytes).toString('utf8');
}

async function listWorktrees(repoPath) {
  const out = await run(repoPath, ['worktree', 'list', '--porcelain']);
  return out.split(/\n\n+/).filter(Boolean).map(block => {
    const rec = { path: null, head: null, branch: null, detached: false, locked: false, lockReason: '', bare: false, prunable: false };
    for (const line of block.split('\n')) {
      if (line.startsWith('worktree ')) rec.path = line.slice('worktree '.length);
      else if (line.startsWith('HEAD ')) rec.head = line.slice('HEAD '.length);
      else if (line.startsWith('branch ')) rec.branch = line.slice('branch '.length).replace('refs/heads/', '');
      else if (line === 'detached') rec.detached = true;
      else if (line === 'bare') rec.bare = true;
      else if (line.startsWith('locked')) { rec.locked = true; rec.lockReason = unquoteGitString(line.slice('locked'.length).trim()); }
      else if (line.startsWith('prunable')) rec.prunable = true;
    }
    return rec;
  });
}

const addWorktree = (repoPath, targetPath, branch, createNew) => run(repoPath,
  createNew ? ['worktree', 'add', '-b', branch, targetPath] : ['worktree', 'add', targetPath, branch]);
const removeWorktree = (repoPath, targetPath, force) => run(repoPath, ['worktree', 'remove', ...(force ? ['--force'] : []), targetPath]);
const lockWorktree = (repoPath, targetPath, reason) => run(repoPath, ['worktree', 'lock', ...(reason ? ['--reason', reason] : []), targetPath]);
const unlockWorktree = (repoPath, targetPath) => run(repoPath, ['worktree', 'unlock', targetPath]);
const pruneWorktrees = repoPath => run(repoPath, ['worktree', 'prune']);

async function submoduleUrls(repoPath) {
  let out;
  try { out = await run(repoPath, ['config', '-f', '.gitmodules', '--get-regexp', '.']); } catch { return {}; }
  const entries = {};
  for (const line of out.split('\n')) {
    const sp = line.indexOf(' ');
    if (sp === -1) continue;
    const key = line.slice(0, sp), value = line.slice(sp + 1);
    const m = key.match(/^submodule\.(.+)\.(path|url)$/);
    if (!m) continue;
    const [, name, field] = m;
    entries[name] = entries[name] || {};
    entries[name][field] = value;
  }
  const map = {};
  for (const name of Object.keys(entries)) if (entries[name].path) map[entries[name].path] = entries[name].url || '';
  return map;
}

async function listSubmodules(repoPath) {
  const [statusOut, urls] = await Promise.all([
    run(repoPath, ['submodule', 'status']).catch(() => ''),
    submoduleUrls(repoPath)
  ]);
  return statusOut.split('\n').filter(Boolean).map(line => {
    const m = line.match(/^([ +\-U])([0-9a-f]{40}) (.+?)(?: \((.+)\))?$/);
    if (!m) return null;
    const [, flag, sha, subPath, describe] = m;
    const status = flag === ' ' ? 'clean' : flag === '-' ? 'uninitialized' : flag === '+' ? 'modified' : flag === 'U' ? 'conflict' : 'unknown';
    return { path: subPath, sha, url: urls[subPath] || '', status, describe: describe || '' };
  }).filter(Boolean);
}

const addSubmodule = (repoPath, url, subPath, branch) => run(repoPath, ['submodule', 'add', ...(branch ? ['-b', branch] : []), '--', url, subPath]);
const initSubmodule = (repoPath, subPath) => run(repoPath, subPath ? ['submodule', 'init', '--', subPath] : ['submodule', 'init']);
const updateSubmodule = (repoPath, subPath) => run(repoPath, subPath ? ['submodule', 'update', '--init', '--recursive', '--', subPath] : ['submodule', 'update', '--init', '--recursive']);
const deinitSubmodule = (repoPath, subPath, force) => run(repoPath, ['submodule', 'deinit', ...(force ? ['-f'] : []), '--', subPath]);
const syncSubmodule = (repoPath, subPath) => run(repoPath, subPath ? ['submodule', 'sync', '--', subPath] : ['submodule', 'sync']);

const lfsAvailable = repoPath => run(repoPath, ['lfs', 'version']).then(() => true).catch(() => false);
const lfsInstalled = repoPath => run(repoPath, ['config', '--local', '--get', 'filter.lfs.smudge']).then(v => !!v.trim()).catch(() => false);
const lfsInstall = repoPath => run(repoPath, ['lfs', 'install', '--local']);

async function lfsTrackedPatterns(repoPath) {
  try {
    const out = await run(repoPath, ['lfs', 'track']);
    return out.split('\n').map(l => l.trim())
      .filter(l => l && !l.toLowerCase().startsWith('listing'))
      .map(l => l.replace(/\s*\(\.gitattributes\)\s*$/, ''));
  } catch { return []; }
}

async function lfsTrack(repoPath, pattern) {
  await run(repoPath, ['lfs', 'track', pattern]);
  await run(repoPath, ['add', '.gitattributes']);
}

async function lfsUntrack(repoPath, pattern) {
  await run(repoPath, ['lfs', 'untrack', pattern]);
  await run(repoPath, ['add', '.gitattributes']).catch(() => {});
}

async function lfsFiles(repoPath) {
  try {
    const out = await run(repoPath, ['lfs', 'ls-files', '-l']);
    return out.split('\n').filter(Boolean).map(line => {
      const m = line.match(/^([0-9a-f]+)\s+([*-])\s+(.+)$/);
      if (!m) return null;
      const [, oid, flag, filePath] = m;
      return { oid, path: filePath, downloaded: flag === '*' };
    }).filter(Boolean);
  } catch { return []; }
}

async function lfsSummary(repoPath) {
  const available = await lfsAvailable(repoPath);
  if (!available) return { available: false, installed: false, patterns: [], files: [] };
  const [installed, patterns, files] = await Promise.all([lfsInstalled(repoPath), lfsTrackedPatterns(repoPath), lfsFiles(repoPath)]);
  return { available, installed, patterns, files };
}

async function snapshot(repoPath) {
  const top = await assertRepo(repoPath);
  const [branches, tags, commits, head, files, remotes, stashes, operation, worktrees, submodules, lfs] = await Promise.all([
    listBranches(top), listTags(top), log(top), currentBranch(top), status(top), listRemotes(top), listStashes(top), operationState(top), listWorktrees(top), listSubmodules(top), lfsSummary(top)
  ]);
  const conflicts = operation ? await conflictedFiles(top) : [];
  return { path: top, name: path.basename(top), refs: branches, tags, commits, head, files, remotes, stashes, operation, conflicts, worktrees, submodules, lfs };
}

const stage = (repoPath, file) => run(repoPath, ['add', '--', file]);
const unstage = (repoPath, file) => run(repoPath, ['restore', '--staged', '--', file]);
const stageAll = repoPath => run(repoPath, ['add', '-A']);
const discardFile = (repoPath, file) => run(repoPath, ['checkout', '--', file]);

async function commit(repoPath, title, description, sign) {
  const args = ['commit', '-m', title];
  if (description) args.push('-m', description);
  if (sign === true) args.push('-S');
  else if (sign === false) args.push('--no-gpg-sign');
  await run(repoPath, args);
  return (await run(repoPath, ['rev-parse', 'HEAD'])).trim();
}

async function amendCommit(repoPath, title, description, sign) {
  const args = ['commit', '--amend', '-m', title];
  if (description) args.push('-m', description);
  if (sign === true) args.push('-S');
  else if (sign === false) args.push('--no-gpg-sign');
  await run(repoPath, args);
  return (await run(repoPath, ['rev-parse', 'HEAD'])).trim();
}

async function initRepo(targetPath) {
  await fsp.mkdir(targetPath, { recursive: true });
  await run(targetPath, ['init']);
  return assertRepo(targetPath);
}

async function cloneRepo(url, targetPath) {
  await fsp.mkdir(path.dirname(targetPath), { recursive: true });
  await run(process.cwd(), ['clone', url, targetPath]);
  return assertRepo(targetPath);
}

function resolveInsideRepo(repoPath, relPath) {
  const full = path.resolve(repoPath, relPath);
  const base = path.resolve(repoPath) + path.sep;
  if (full !== path.resolve(repoPath) && !full.startsWith(base)) {
    throw new Error('저장소 밖의 경로는 사용할 수 없습니다.');
  }
  return full;
}

async function readWorkingFile(repoPath, relPath) {
  return fsp.readFile(resolveInsideRepo(repoPath, relPath), 'utf8');
}

async function writeWorkingFile(repoPath, relPath, content) {
  const full = resolveInsideRepo(repoPath, relPath);
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, content, 'utf8');
}

async function createWorkingFile(repoPath, relPath) {
  const full = resolveInsideRepo(repoPath, relPath);
  try {
    await fsp.access(full);
    throw new Error('이미 존재하는 파일입니다.');
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  await fsp.mkdir(path.dirname(full), { recursive: true });
  await fsp.writeFile(full, '', 'utf8');
}

async function deleteWorkingFile(repoPath, relPath) {
  await fsp.unlink(resolveInsideRepo(repoPath, relPath));
}

async function signingConfig(repoPath) {
  const get = async key => { try { return (await run(repoPath, ['config', '--get', key])).trim(); } catch { return ''; } };
  const [gpgFormat, signingKey, autoSign] = await Promise.all([get('gpg.format'), get('user.signingkey'), get('commit.gpgsign')]);
  return { gpgFormat: gpgFormat || 'openpgp', signingKey, autoSign: autoSign === 'true', configured: !!signingKey };
}

async function identityConfig(repoPath) {
  const get = async (key, scope) => {
    try { return (await run(repoPath, ['config', `--${scope}`, '--get', key])).trim(); } catch { return ''; }
  };
  const [localName, localEmail, globalName, globalEmail] = await Promise.all([
    get('user.name', 'local'), get('user.email', 'local'),
    get('user.name', 'global'), get('user.email', 'global')
  ]);
  return { localName, localEmail, globalName, globalEmail };
}

async function setIdentity(repoPath, name, email, scope) {
  const flag = scope === 'global' ? '--global' : '--local';
  if (name) await run(repoPath, ['config', flag, 'user.name', name]);
  if (email) await run(repoPath, ['config', flag, 'user.email', email]);
}

async function unsetLocalIdentity(repoPath) {
  const tryUnset = async key => { try { await run(repoPath, ['config', '--local', '--unset', key]); } catch { /* not set */ } };
  await tryUnset('user.name');
  await tryUnset('user.email');
}

const createBranch = (repoPath, name, base) => run(repoPath, ['branch', name, base]);
const deleteBranch = (repoPath, name, force) => run(repoPath, ['branch', force ? '-D' : '-d', name]);
const renameBranch = (repoPath, oldName, newName) => run(repoPath, ['branch', '-m', oldName, newName]);
const checkout = (repoPath, name) => run(repoPath, ['checkout', name]);
const cherryPick = (repoPath, sha) => run(repoPath, ['cherry-pick', sha]);
const cherryPickAbort = repoPath => run(repoPath, ['cherry-pick', '--abort']);
const merge = (repoPath, name, strategy) => run(repoPath, ['merge', ...(strategy === 'squash' ? ['--squash'] : strategy === 'ff-only' ? ['--ff-only'] : strategy === 'no-ff' ? ['--no-ff'] : []), name]);
const mergeAbort = repoPath => run(repoPath, ['merge', '--abort']);
const rebase = (repoPath, onto) => run(repoPath, ['rebase', onto]);

const resolveConflict = async (repoPath, file, strategy) => {
  await run(repoPath, ['checkout', `--${strategy}`, '--', file]);
  await run(repoPath, ['add', '--', file]);
};

const RESET_MODES = new Set(['soft', 'mixed', 'hard']);
const resetTo = (repoPath, target, mode) => {
  if (!RESET_MODES.has(mode)) throw new Error(`알 수 없는 reset 모드입니다: ${mode}`);
  return run(repoPath, ['reset', `--${mode}`, target]);
};
const revertCommit = (repoPath, sha, noCommit) => run(repoPath, ['revert', ...(noCommit ? ['--no-commit'] : []), sha]);

async function reflog(repoPath, limit = 100) {
  const format = ['%H', '%h', '%gs', '%ad'].join(FS);
  const out = await run(repoPath, ['reflog', `--format=${format}`, '--date=format:%Y-%m-%d' + FS + '%H:%M:%S', `-n${limit}`]);
  return out.split('\n').filter(Boolean).map((line, index) => {
    const [sha, shortSha, action, date, time] = line.split(FS);
    return { sha, shortSha, selector: `HEAD@{${index}}`, action, date, time };
  });
}

const OPERATION_ARGS = { merge: 'merge', rebase: 'rebase', 'cherry-pick': 'cherry-pick', revert: 'revert' };
function continueOperation(repoPath, kind) {
  const verb = OPERATION_ARGS[kind];
  if (!verb) throw new Error('알 수 없는 작업입니다.');
  return run(repoPath, [verb, '--continue']);
}
function abortOperation(repoPath, kind) {
  const verb = OPERATION_ARGS[kind];
  if (!verb) throw new Error('알 수 없는 작업입니다.');
  return run(repoPath, [verb, '--abort']);
}

const stashSave = (repoPath, message, includeUntracked) => run(repoPath, ['stash', 'push', ...(includeUntracked ? ['-u'] : []), ...(message ? ['-m', message] : [])]);
const stashApply = (repoPath, ref) => run(repoPath, ['stash', 'apply', ref]);
const stashPop = (repoPath, ref) => run(repoPath, ['stash', 'pop', ref]);
const stashDrop = (repoPath, ref) => run(repoPath, ['stash', 'drop', ref]);

const tagCreate = (repoPath, name, target, message, sign) => {
  const args = ['tag'];
  if (sign) args.push('-s');
  else if (message) args.push('-a');
  args.push(name, target);
  if (message) args.push('-m', message);
  return run(repoPath, args);
};
const tagDelete = (repoPath, name) => run(repoPath, ['tag', '-d', name]);

const addRemote = (repoPath, name, url) => run(repoPath, ['remote', 'add', name, url]);
const removeRemote = (repoPath, name) => run(repoPath, ['remote', 'remove', name]);
const fetch = (repoPath, remote, prune) => run(repoPath, ['fetch', ...(prune ? ['--prune'] : []), remote || '--all']);
const PULL_STRATEGY_FLAGS = { ff: ['--ff'], 'ff-only': ['--ff-only'], rebase: ['--rebase'] };
const pull = (repoPath, remote, branch, strategy) => run(repoPath, ['pull', ...(PULL_STRATEGY_FLAGS[strategy] || []), remote || 'origin', ...(branch ? [branch] : [])]);
const push = (repoPath, remote, branch, setUpstream) => run(repoPath, ['push', ...(setUpstream ? ['-u'] : []), remote || 'origin', branch || 'HEAD']);
const tagPush = (repoPath, remote, name) => run(repoPath, ['push', remote || 'origin', name]);
const fetchBranch = (repoPath, remote, branch) => run(repoPath, ['fetch', remote || 'origin', `${branch}:${branch}`]);
const setUpstream = (repoPath, branch, remoteRef) => run(repoPath, ['branch', `--set-upstream-to=${remoteRef}`, branch]);

const showCommit = (repoPath, sha) => run(repoPath, ['show', '--no-color', sha]);
async function commitMessage(repoPath, sha) {
  const out = await run(repoPath, ['log', '-1', `--format=%s${FS}%b`, sha]);
  const [title, ...rest] = out.split(FS);
  return { title: title || '', description: rest.join(FS).trim() };
}

async function diffFile(repoPath, file, mode, ref) {
  if (mode === 'staged') return run(repoPath, ['diff', '--no-color', '--cached', '--', file]);
  if (mode === 'commit') return run(repoPath, ['show', '--no-color', ref, '--', file]);
  return run(repoPath, ['diff', '--no-color', '--', file]);
}

async function commitFiles(repoPath, sha) {
  const out = await run(repoPath, ['diff-tree', '--no-commit-id', '--name-status', '-r', '--root', '-M', sha]);
  return out.split('\n').filter(Boolean).map(line => {
    const parts = line.split('\t');
    const status = parts[0][0];
    if ((status === 'R' || status === 'C') && parts.length > 2) return { status, oldPath: parts[1], path: parts[2] };
    return { status, path: parts[1] };
  });
}

const fileAtCommit = (repoPath, sha, file) => run(repoPath, ['show', `${sha}:${file}`]);

function parseHunks(diffText) {
  const lines = diffText.replace(/\n$/, '').split('\n');
  const header = [];
  const hunks = [];
  let current = null;
  let i = 0;
  while (i < lines.length && !lines[i].startsWith('@@')) { header.push(lines[i]); i++; }
  for (; i < lines.length; i++) {
    if (lines[i].startsWith('@@')) {
      if (current) hunks.push(current);
      current = { header: lines[i], body: [] };
    } else if (current) {
      current.body.push(lines[i]);
    }
  }
  if (current) hunks.push(current);
  return {
    header: header.join('\n'),
    hunks: hunks.map((h, index) => ({ index, header: h.header, raw: `${h.header}\n${h.body.join('\n')}` }))
  };
}

async function diffHunks(repoPath, file, staged) {
  const diffText = await run(repoPath, ['diff', '--no-color', ...(staged ? ['--cached'] : []), '--', file]);
  if (!diffText.trim()) return { header: '', hunks: [] };
  return parseHunks(diffText);
}

const buildPatch = (header, hunkRaw) => `${header}\n${hunkRaw}\n`;
const stageHunk = (repoPath, header, hunkRaw) => runWithInput(repoPath, ['apply', '--cached', '-'], buildPatch(header, hunkRaw));
const unstageHunk = (repoPath, header, hunkRaw) => runWithInput(repoPath, ['apply', '--cached', '--reverse', '-'], buildPatch(header, hunkRaw));
const discardHunk = (repoPath, header, hunkRaw) => runWithInput(repoPath, ['apply', '--reverse', '-'], buildPatch(header, hunkRaw));

const REBASE_ACTIONS = new Set(['pick', 'reword', 'squash', 'fixup', 'drop']);

async function rebasePlanCommits(repoPath, baseSha) {
  const format = ['%H', '%h', '%an', '%s'].join(FS);
  const out = await run(repoPath, ['log', '--reverse', `--format=${format}`, `${baseSha}..HEAD`]);
  return out.split('\n').filter(Boolean).map(line => {
    const [sha, shortSha, author, ...rest] = line.split(FS);
    return { sha, shortSha, author, subject: rest.join(FS) };
  });
}

async function rebaseGitDir(repoPath) {
  const dir = (await run(repoPath, ['rev-parse', '--git-path', 'rebase-merge'])).trim();
  return path.isAbsolute(dir) ? dir : path.join(repoPath, dir);
}

async function stoppedShaPrefix(repoPath) {
  try {
    const dir = await rebaseGitDir(repoPath);
    return (await fsp.readFile(path.join(dir, 'stopped-sha'), 'utf8')).trim();
  } catch {
    return null;
  }
}

async function resolveRewordPauses(repoPath, plan) {
  while ((await operationState(repoPath)) === 'rebase') {
    const stopped = await stoppedShaPrefix(repoPath);
    if (!stopped) break;
    const item = plan.find(p => p.sha.startsWith(stopped) || stopped.startsWith(p.sha.slice(0, 7)));
    if (!item || item.action !== 'reword' || !item.message) break;
    await run(repoPath, ['commit', '--amend', '-m', item.message]);
    await runEnv(repoPath, ['rebase', '--continue'], { GIT_EDITOR: 'true' });
  }
}

async function interactiveRebase(repoPath, baseSha, plan) {
  for (const item of plan) {
    if (!REBASE_ACTIONS.has(item.action)) throw new Error(`알 수 없는 리베이스 동작입니다: ${item.action}`);
  }
  const tmpDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'branchline-rebase-'));
  const planPath = path.join(tmpDir, 'plan.json');
  const seqScriptPath = path.join(tmpDir, 'seq-editor.cjs');
  const todoPlan = plan.map(p => ({ sha: p.sha, action: p.action === 'reword' ? 'edit' : p.action }));
  await fsp.writeFile(planPath, JSON.stringify(todoPlan));
  await fsp.writeFile(seqScriptPath, [
    "const fs = require('fs');",
    'const todoPath = process.argv[2];',
    `const plan = JSON.parse(fs.readFileSync(${JSON.stringify(planPath)}, 'utf8'));`,
    "const lines = plan.map(p => (p.action + ' ' + p.sha).trim());",
    "fs.writeFileSync(todoPath, lines.join('\\n') + '\\n');"
  ].join('\n'));
  const quote = value => `"${String(value).replace(/"/g, '\\"')}"`;
  const seqEditorCmd = `${quote(process.execPath)} ${quote(seqScriptPath)}`;
  try {
    await runEnv(repoPath, ['rebase', '-i', baseSha], { GIT_SEQUENCE_EDITOR: seqEditorCmd, GIT_EDITOR: 'true' });
    await resolveRewordPauses(repoPath, plan);
  } finally {
    await fsp.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

module.exports = {
  assertRepo, snapshot, log, status,
  stage, unstage, stageAll, discardFile,
  commit, amendCommit, initRepo, cloneRepo,
  readWorkingFile, writeWorkingFile, createWorkingFile, deleteWorkingFile,
  createBranch, deleteBranch, renameBranch, checkout,
  cherryPick, cherryPickAbort, merge, mergeAbort, rebase,
  resolveConflict, continueOperation, abortOperation, conflictedFiles, operationState,
  listWorktrees, addWorktree, removeWorktree, lockWorktree, unlockWorktree, pruneWorktrees,
  listSubmodules, addSubmodule, initSubmodule, updateSubmodule, deinitSubmodule, syncSubmodule,
  lfsAvailable, lfsInstalled, lfsInstall, lfsTrack, lfsUntrack, lfsTrackedPatterns, lfsFiles, lfsSummary,
  signingConfig, identityConfig, setIdentity, unsetLocalIdentity,
  stashSave, stashApply, stashPop, stashDrop, listStashes,
  tagCreate, tagDelete, tagPush, listTags,
  addRemote, removeRemote, listRemotes, fetch, pull, push, fetchBranch, setUpstream,
  diffFile, showCommit, commitMessage, diffHunks, stageHunk, unstageHunk, discardHunk,
  rebasePlanCommits, interactiveRebase,
  resetTo, revertCommit, reflog,
  readGitignore, writeGitignore, ignorePath, untrackFile,
  fileHistory, blame,
  commitFiles, fileAtCommit
};
