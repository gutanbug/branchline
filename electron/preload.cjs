const { contextBridge, ipcRenderer } = require('electron');
const invoke = async (name, ...args) => {
  const result = await ipcRenderer.invoke(`branchline:${name}`, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value;
};
contextBridge.exposeInMainWorld('branchline', {
  onCloseRequested: callback => { const listener = () => callback(); ipcRenderer.on('branchline:closeRequested', listener); return () => ipcRenderer.removeListener('branchline:closeRequested', listener); },
  closeWindow: () => invoke('closeWindow'),
  copyMcpConfig: paths => invoke('copyMcpConfig', paths),
  mcpConfig: paths => invoke('mcpConfig', paths),
  hostingPat: input => invoke('hostingPat', input),
  hostingDefaults: () => invoke('hostingDefaults'),
  hostingAccounts: () => invoke('hostingAccounts'), hostingStart: input => invoke('hostingStart', input),
  hostingPoll: id => invoke('hostingPoll', id), hostingCancel: id => invoke('hostingCancel', id),
  hostingVerify: id => invoke('hostingVerify', id), hostingForget: key => invoke('hostingForget', key),
  hostingPrepare: input => invoke('hostingPrepare', input), hostingDiscard: id => invoke('hostingDiscard', id), hostingWrite: id => invoke('hostingWrite', id),
  hostingRead: input => invoke('hostingRead', input), hostingExternal: (account, url) => invoke('hostingExternal', account, url),
  bootstrap: () => invoke('bootstrap'), open: path => invoke('open', path), init: () => invoke('init'),
  copyBranchName: (path, ref) => invoke('copyBranchName', path, ref),
  copyCommitSha: (path, sha) => invoke('copyCommitSha', path, sha),
  stashDiff: (path, sha) => invoke('stashDiff', path, sha),
  monitorRemote: path => invoke('monitorRemote', path),
  amendPreview: (path, sha) => invoke('amendPreview', path, sha),
  syncState: (path, offset) => invoke('syncState', path, offset), sync: (path, input) => invoke('sync', path, input),
  cloneDestination: () => invoke('cloneDestination'), clone: input => invoke('clone', input), cancel: id => invoke('cancel', id),
  changeStats: (path, expected) => invoke('changeStats', path, expected),
  state: path => invoke('state', path), history: (path, input) => invoke('history', path, input),
  compare: (path, input) => invoke('compare', path, input), diff: (path, input) => invoke('diff', path, input),
  fileAction: (path, input) => invoke('fileAction', path, input),
  workingList: (path, folder) => invoke('workingList', path, folder),
  workingRead: (path, file) => invoke('workingRead', path, file),
  workingSave: (path, input) => invoke('workingSave', path, input),
  conflictRead: (path, file) => invoke('conflictRead', path, file), conflictChange: (path, input) => invoke('conflictChange', path, input),
  worktrees: path => invoke('worktrees', path), openWorktree: (path, target) => invoke('openWorktree', path, target),
  destination: () => invoke('destination'), mutate: (path, input) => invoke('mutate', path, input),
  profiles: () => invoke('profiles'), saveProfiles: profiles => invoke('saveProfiles', profiles),
  saveWorkspace: data => invoke('saveWorkspace', data), agents: () => invoke('agents'), agentChat: (path, input) => invoke('agentChat', path, input),
  setAgent: (id, enabled) => invoke('setAgent', id, enabled), agentPath: id => invoke('agentPath', id),
  defaultAgent: id => invoke('defaultAgent', id), usage: id => invoke('usage', id), reveal: path => invoke('reveal', path),
});
