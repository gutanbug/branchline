'use strict';
const { contextBridge, ipcRenderer } = require('electron');

const call = channel => (...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld('gitAPI', {
  openRepo: call('git:openRepo'),
  initRepo: call('git:initRepo'),
  cloneRepo: call('git:cloneRepo'),
  snapshot: call('git:snapshot'),
  amendCommit: call('git:amendCommit'),
  readWorkingFile: call('git:readWorkingFile'),
  writeWorkingFile: call('git:writeWorkingFile'),
  createWorkingFile: call('git:createWorkingFile'),
  deleteWorkingFile: call('git:deleteWorkingFile'),
  stage: call('git:stage'),
  unstage: call('git:unstage'),
  stageAll: call('git:stageAll'),
  discardFile: call('git:discardFile'),
  commit: call('git:commit'),
  createBranch: call('git:createBranch'),
  deleteBranch: call('git:deleteBranch'),
  renameBranch: call('git:renameBranch'),
  checkout: call('git:checkout'),
  cherryPick: call('git:cherryPick'),
  merge: call('git:merge'),
  rebase: call('git:rebase'),
  resolveConflict: call('git:resolveConflict'),
  continueOperation: call('git:continueOperation'),
  abortOperation: call('git:abortOperation'),
  pickWorktreePath: call('git:pickWorktreePath'),
  addWorktree: call('git:addWorktree'),
  removeWorktree: call('git:removeWorktree'),
  lockWorktree: call('git:lockWorktree'),
  unlockWorktree: call('git:unlockWorktree'),
  addSubmodule: call('git:addSubmodule'),
  updateSubmodule: call('git:updateSubmodule'),
  deinitSubmodule: call('git:deinitSubmodule'),
  lfsInstall: call('git:lfsInstall'),
  lfsTrack: call('git:lfsTrack'),
  lfsUntrack: call('git:lfsUntrack'),
  stashSave: call('git:stashSave'),
  stashApply: call('git:stashApply'),
  stashPop: call('git:stashPop'),
  stashDrop: call('git:stashDrop'),
  tagCreate: call('git:tagCreate'),
  tagDelete: call('git:tagDelete'),
  tagPush: call('git:tagPush'),
  addRemote: call('git:addRemote'),
  removeRemote: call('git:removeRemote'),
  fetch: call('git:fetch'),
  pull: call('git:pull'),
  push: call('git:push'),
  fetchBranch: call('git:fetchBranch'),
  setUpstream: call('git:setUpstream'),
  diffFile: call('git:diffFile'),
  diffHunks: call('git:diffHunks'),
  stageHunk: call('git:stageHunk'),
  unstageHunk: call('git:unstageHunk'),
  discardHunk: call('git:discardHunk'),
  showCommit: call('git:showCommit'),
  commitMessage: call('git:commitMessage'),
  rebasePlanCommits: call('git:rebasePlanCommits'),
  interactiveRebase: call('git:interactiveRebase'),
  resetTo: call('git:resetTo'),
  revertCommit: call('git:revertCommit'),
  reflog: call('git:reflog'),
  readGitignore: call('git:readGitignore'),
  writeGitignore: call('git:writeGitignore'),
  ignorePath: call('git:ignorePath'),
  untrackFile: call('git:untrackFile'),
  fileHistory: call('git:fileHistory'),
  blame: call('git:blame'),
  commitFiles: call('git:commitFiles'),
  fileAtCommit: call('git:fileAtCommit'),
  signingConfig: call('git:signingConfig'),
  identityConfig: call('git:identityConfig'),
  setIdentity: call('git:setIdentity'),
  unsetLocalIdentity: call('git:unsetLocalIdentity')
});

contextBridge.exposeInMainWorld('githubAPI', {
  detectRemote: call('github:detectRemote'),
  listPullRequests: call('github:listPullRequests'),
  createPullRequest: call('github:createPullRequest'),
  mergePullRequest: call('github:mergePullRequest')
});

contextBridge.exposeInMainWorld('terminalAPI', {
  start: repoPath => ipcRenderer.invoke('terminal:start', repoPath),
  input: (id, data) => ipcRenderer.invoke('terminal:input', id, data),
  kill: id => ipcRenderer.invoke('terminal:kill', id),
  onData: (id, cb) => {
    const channel = `terminal:data:${id}`;
    const listener = (_event, data) => cb(data);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
  onExit: (id, cb) => {
    const channel = `terminal:exit:${id}`;
    const listener = (_event, code) => cb(code);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  }
});

contextBridge.exposeInMainWorld('appAPI', {
  openExternal: call('app:openExternal')
});
