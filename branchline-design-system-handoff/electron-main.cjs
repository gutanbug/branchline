const { app, BrowserWindow, Menu, session, ipcMain, dialog, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');
const git = require('./git-backend.cjs');
const github = require('./github-backend.cjs');

const terminals = new Map();
function shellCommand() {
  if (process.platform === 'win32') return process.env.COMSPEC || 'cmd.exe';
  return process.env.SHELL || '/bin/bash';
}
function killAllTerminals() {
  for (const child of terminals.values()) {
    try { child.kill(); } catch { /* already exited */ }
  }
  terminals.clear();
}

function createWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 1000, minWidth: 760, minHeight: 600,
    title: 'Branchline — Git 브랜치 관리',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, 'preload.cjs')
    }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.loadFile(path.join(__dirname, 'branchline.html'));
}

function handle(channel, fn) {
  ipcMain.handle(channel, async (_event, ...args) => {
    try {
      return { ok: true, value: await fn(...args) };
    } catch (error) {
      return { ok: false, message: error.message || '알 수 없는 Git 오류입니다.' };
    }
  });
}

handle('git:openRepo', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  const repoPath = await git.assertRepo(result.filePaths[0]);
  return git.snapshot(repoPath);
});
handle('git:snapshot', repoPath => git.snapshot(repoPath));
handle('git:initRepo', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  const repoPath = await git.initRepo(result.filePaths[0]);
  return git.snapshot(repoPath);
});
handle('git:cloneRepo', async url => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'], title: '복제할 위치 선택' });
  if (result.canceled || !result.filePaths.length) return null;
  const name = url.split('/').pop().replace(/\.git$/, '') || 'repository';
  const target = path.join(result.filePaths[0], name);
  const repoPath = await git.cloneRepo(url, target);
  return git.snapshot(repoPath);
});
handle('git:amendCommit', (repoPath, title, description, sign) => git.amendCommit(repoPath, title, description, sign).then(() => git.snapshot(repoPath)));
handle('git:readWorkingFile', (repoPath, relPath) => git.readWorkingFile(repoPath, relPath));
handle('git:writeWorkingFile', (repoPath, relPath, content) => git.writeWorkingFile(repoPath, relPath, content).then(() => git.snapshot(repoPath)));
handle('git:createWorkingFile', (repoPath, relPath) => git.createWorkingFile(repoPath, relPath).then(() => git.snapshot(repoPath)));
handle('git:deleteWorkingFile', (repoPath, relPath) => git.deleteWorkingFile(repoPath, relPath).then(() => git.snapshot(repoPath)));
handle('git:stage', (repoPath, file) => git.stage(repoPath, file).then(() => git.snapshot(repoPath)));
handle('git:unstage', (repoPath, file) => git.unstage(repoPath, file).then(() => git.snapshot(repoPath)));
handle('git:stageAll', repoPath => git.stageAll(repoPath).then(() => git.snapshot(repoPath)));
handle('git:discardFile', (repoPath, file) => git.discardFile(repoPath, file).then(() => git.snapshot(repoPath)));
handle('git:commit', (repoPath, title, description, sign) => git.commit(repoPath, title, description, sign).then(() => git.snapshot(repoPath)));
handle('git:signingConfig', repoPath => git.signingConfig(repoPath));
handle('git:identityConfig', repoPath => git.identityConfig(repoPath));
handle('git:setIdentity', (repoPath, name, email, scope) => git.setIdentity(repoPath, name, email, scope));
handle('git:unsetLocalIdentity', repoPath => git.unsetLocalIdentity(repoPath));
handle('git:createBranch', (repoPath, name, base) => git.createBranch(repoPath, name, base).then(() => git.snapshot(repoPath)));
handle('git:deleteBranch', (repoPath, name, force) => git.deleteBranch(repoPath, name, force).then(() => git.snapshot(repoPath)));
handle('git:renameBranch', (repoPath, oldName, newName) => git.renameBranch(repoPath, oldName, newName).then(() => git.snapshot(repoPath)));
handle('git:checkout', (repoPath, name) => git.checkout(repoPath, name).then(() => git.snapshot(repoPath)));
handle('git:cherryPick', (repoPath, sha) => git.cherryPick(repoPath, sha).then(() => git.snapshot(repoPath)));
handle('git:merge', (repoPath, name, strategy) => git.merge(repoPath, name, strategy).then(() => git.snapshot(repoPath)));
handle('git:rebase', (repoPath, onto) => git.rebase(repoPath, onto).then(() => git.snapshot(repoPath)));
handle('git:resolveConflict', (repoPath, file, strategy) => git.resolveConflict(repoPath, file, strategy).then(() => git.snapshot(repoPath)));
handle('git:continueOperation', (repoPath, kind) => git.continueOperation(repoPath, kind).then(() => git.snapshot(repoPath)));
handle('git:abortOperation', (repoPath, kind) => git.abortOperation(repoPath, kind).then(() => git.snapshot(repoPath)));
handle('git:pickWorktreePath', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});
handle('git:addWorktree', (repoPath, targetPath, branch, createNew) => git.addWorktree(repoPath, targetPath, branch, createNew).then(() => git.snapshot(repoPath)));
handle('git:removeWorktree', (repoPath, targetPath, force) => git.removeWorktree(repoPath, targetPath, force).then(() => git.snapshot(repoPath)));
handle('git:lockWorktree', (repoPath, targetPath, reason) => git.lockWorktree(repoPath, targetPath, reason).then(() => git.snapshot(repoPath)));
handle('git:unlockWorktree', (repoPath, targetPath) => git.unlockWorktree(repoPath, targetPath).then(() => git.snapshot(repoPath)));
handle('git:addSubmodule', (repoPath, url, subPath, branch) => git.addSubmodule(repoPath, url, subPath, branch).then(() => git.snapshot(repoPath)));
handle('git:updateSubmodule', (repoPath, subPath) => git.updateSubmodule(repoPath, subPath).then(() => git.snapshot(repoPath)));
handle('git:deinitSubmodule', (repoPath, subPath, force) => git.deinitSubmodule(repoPath, subPath, force).then(() => git.snapshot(repoPath)));
handle('git:lfsInstall', repoPath => git.lfsInstall(repoPath).then(() => git.snapshot(repoPath)));
handle('git:lfsTrack', (repoPath, pattern) => git.lfsTrack(repoPath, pattern).then(() => git.snapshot(repoPath)));
handle('git:lfsUntrack', (repoPath, pattern) => git.lfsUntrack(repoPath, pattern).then(() => git.snapshot(repoPath)));
handle('git:stashSave', (repoPath, message, includeUntracked) => git.stashSave(repoPath, message, includeUntracked).then(() => git.snapshot(repoPath)));
handle('git:stashApply', (repoPath, ref) => git.stashApply(repoPath, ref).then(() => git.snapshot(repoPath)));
handle('git:stashPop', (repoPath, ref) => git.stashPop(repoPath, ref).then(() => git.snapshot(repoPath)));
handle('git:stashDrop', (repoPath, ref) => git.stashDrop(repoPath, ref).then(() => git.snapshot(repoPath)));
handle('git:tagCreate', (repoPath, name, target, message, sign) => git.tagCreate(repoPath, name, target, message, sign).then(() => git.snapshot(repoPath)));
handle('git:tagDelete', (repoPath, name) => git.tagDelete(repoPath, name).then(() => git.snapshot(repoPath)));
handle('git:tagPush', (repoPath, remote, name) => git.tagPush(repoPath, remote, name).then(() => git.snapshot(repoPath)));
handle('git:addRemote', (repoPath, name, url) => git.addRemote(repoPath, name, url).then(() => git.snapshot(repoPath)));
handle('git:removeRemote', (repoPath, name) => git.removeRemote(repoPath, name).then(() => git.snapshot(repoPath)));
handle('git:fetch', (repoPath, remote, prune) => git.fetch(repoPath, remote, prune).then(() => git.snapshot(repoPath)));
handle('git:pull', (repoPath, remote, branch, strategy) => git.pull(repoPath, remote, branch, strategy).then(() => git.snapshot(repoPath)));
handle('git:push', (repoPath, remote, branch, setUpstream) => git.push(repoPath, remote, branch, setUpstream).then(() => git.snapshot(repoPath)));
handle('git:fetchBranch', (repoPath, remote, branch) => git.fetchBranch(repoPath, remote, branch).then(() => git.snapshot(repoPath)));
handle('git:setUpstream', (repoPath, branch, remoteRef) => git.setUpstream(repoPath, branch, remoteRef).then(() => git.snapshot(repoPath)));
handle('git:diffFile', (repoPath, file, mode, ref) => git.diffFile(repoPath, file, mode, ref));
handle('git:diffHunks', (repoPath, file, staged) => git.diffHunks(repoPath, file, staged));
handle('git:stageHunk', (repoPath, header, hunkRaw) => git.stageHunk(repoPath, header, hunkRaw).then(() => git.snapshot(repoPath)));
handle('git:unstageHunk', (repoPath, header, hunkRaw) => git.unstageHunk(repoPath, header, hunkRaw).then(() => git.snapshot(repoPath)));
handle('git:discardHunk', (repoPath, header, hunkRaw) => git.discardHunk(repoPath, header, hunkRaw).then(() => git.snapshot(repoPath)));
handle('git:showCommit', (repoPath, sha) => git.showCommit(repoPath, sha));
handle('git:commitMessage', (repoPath, sha) => git.commitMessage(repoPath, sha));
handle('git:rebasePlanCommits', (repoPath, baseSha) => git.rebasePlanCommits(repoPath, baseSha));
handle('git:interactiveRebase', (repoPath, baseSha, plan) => git.interactiveRebase(repoPath, baseSha, plan).then(() => git.snapshot(repoPath)));
handle('git:resetTo', (repoPath, target, mode) => git.resetTo(repoPath, target, mode).then(() => git.snapshot(repoPath)));
handle('git:revertCommit', (repoPath, sha, noCommit) => git.revertCommit(repoPath, sha, noCommit).then(() => git.snapshot(repoPath)));
handle('git:reflog', (repoPath, limit) => git.reflog(repoPath, limit));
handle('git:readGitignore', repoPath => git.readGitignore(repoPath));
handle('git:writeGitignore', (repoPath, content) => git.writeGitignore(repoPath, content).then(() => git.snapshot(repoPath)));
handle('git:ignorePath', (repoPath, pattern) => git.ignorePath(repoPath, pattern).then(() => git.snapshot(repoPath)));
handle('git:untrackFile', (repoPath, file) => git.untrackFile(repoPath, file).then(() => git.snapshot(repoPath)));
handle('git:fileHistory', (repoPath, file, limit) => git.fileHistory(repoPath, file, limit));
handle('git:blame', (repoPath, file, ref) => git.blame(repoPath, file, ref));
handle('git:commitFiles', (repoPath, sha) => git.commitFiles(repoPath, sha));
handle('git:fileAtCommit', (repoPath, sha, file) => git.fileAtCommit(repoPath, sha, file));

handle('github:detectRemote', async repoPath => {
  const remotes = await git.listRemotes(repoPath);
  const origin = remotes.find(r => r.name === 'origin');
  if (!origin) return null;
  const parsed = github.parseGithubRemote(origin.url);
  return parsed ? { ...parsed, remoteUrl: origin.url } : null;
});
handle('github:listPullRequests', (owner, repo, token, state) => github.listPullRequests(owner, repo, token, state));
handle('github:createPullRequest', (owner, repo, token, payload) => github.createPullRequest(owner, repo, token, payload));
handle('github:mergePullRequest', (owner, repo, token, number, mergeMethod) => github.mergePullRequest(owner, repo, token, number, mergeMethod));
handle('app:openExternal', url => {
  if (!/^https:\/\/github\.com\//.test(url)) throw new Error('허용되지 않은 링크입니다.');
  return shell.openExternal(url);
});

ipcMain.handle('terminal:start', (event, repoPath) => {
  if (!fs.existsSync(repoPath) || !fs.statSync(repoPath).isDirectory()) {
    throw new Error('유효한 저장소 경로가 아닙니다.');
  }
  const id = `t${Date.now()}${Math.random().toString(36).slice(2, 8)}`;
  const child = spawn(shellCommand(), [], { cwd: repoPath, env: process.env });
  terminals.set(id, child);
  const sender = event.sender;
  const send = (channel, payload) => { if (!sender.isDestroyed()) sender.send(channel, payload); };
  child.stdout.on('data', chunk => send(`terminal:data:${id}`, chunk.toString('utf8')));
  child.stderr.on('data', chunk => send(`terminal:data:${id}`, chunk.toString('utf8')));
  child.on('exit', code => { send(`terminal:exit:${id}`, code); terminals.delete(id); });
  return id;
});
ipcMain.handle('terminal:input', (_event, id, data) => {
  const child = terminals.get(id);
  if (!child) throw new Error('종료된 터미널 세션입니다.');
  child.stdin.write(data);
});
ipcMain.handle('terminal:kill', (_event, id) => {
  const child = terminals.get(id);
  if (child) { child.kill(); terminals.delete(id); }
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_contents, _permission, reply) => reply(false));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { killAllTerminals(); if (process.platform !== 'darwin') app.quit(); });
app.on('before-quit', killAllTerminals);
