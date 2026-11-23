const agentChat = require('./agent-chat.cjs');
const { app, BrowserWindow, Menu, ipcMain, dialog, shell, safeStorage, clipboard } = require('electron');
const path = require('node:path');
const fs = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const git = require('./git.cjs');
const agents = require('./agents.cjs');
const sync = require('./sync.cjs');
const conflicts = require('./conflicts.cjs');
const workingFiles = require('./working-files.cjs');
const fileActions = require('./file-actions.cjs');
const { Hosting, publicURL } = require('./hosting.cjs');
let hosting;
const operations = new Map();
let win, settingsFile, allowClose = false;
let mutations = 0, quitting = false;
const allowed = new Set();
const destinations = new Set();
let settings = { version: 1, recent: [], savedTabs: {}, tabs: [], active: null, profiles: [], agents: {}, defaultAgent: 'codex' };
let saving = Promise.resolve();
const entry = path.join(__dirname, '../dist/index.html');
const allowedURL = pathToFileURL(entry).href;
if (process.env.BRANCHLINE_TEST_DATA && !app.isPackaged) app.setPath('userData', process.env.BRANCHLINE_TEST_DATA);
const primaryInstance = app.requestSingleInstanceLock();
if (!primaryInstance) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
async function save() {
  const data = JSON.stringify(settings);
  saving = saving.catch(() => {}).then(async () => { await fs.mkdir(path.dirname(settingsFile), { recursive: true }); await fs.writeFile(settingsFile + '.tmp', data, { mode: 0o600 }); await fs.rename(settingsFile + '.tmp', settingsFile); });
  return saving;
}
function handle(name, fn) {
  ipcMain.handle(`branchline:${name}`, async (event, ...args) => {
    if (!win || event.sender !== win.webContents || event.senderFrame !== win.webContents.mainFrame || event.senderFrame.url !== allowedURL) return { ok: false, error: '허용되지 않은 호출입니다.' };
    try { return { ok: true, value: await fn(...args) }; } catch (error) { return { ok: false, error: error.message || '작업을 완료하지 못했습니다.' }; }
  });
}
async function authorized(input) {
  if (!allowed.has(input)) throw new Error('먼저 저장소를 열어 주세요.');
  const current = await git.repository(input);
  if (current !== input) throw new Error('저장소 경로가 변경되었습니다. 다시 열어 주세요.');
  return current;
}
async function register(input) {
  const cwd = await git.repository(input); allowed.add(cwd);
  settings.recent = [cwd, ...settings.recent.filter(p => p !== cwd)].slice(0, 20); await save();
  return git.state(cwd);
}
handle('closeWindow', async () => { if (mutations) throw new Error('진행 중인 작업 결과를 확인한 뒤 종료하세요.'); await saving; allowClose = true; setImmediate(() => win.close()); return null; });
handle('bootstrap', async () => ({ ...settings, platform: process.platform, version: app.getVersion() }));
handle('open', async (recentPath) => {
  if (recentPath) { if (!settings.recent.includes(recentPath)) throw new Error('최근 저장소에 없는 경로입니다.'); return register(recentPath); }
  const result = await dialog.showOpenDialog(win, { title: 'Git 저장소 열기', message: '열 Git 저장소 폴더를 선택하세요.', buttonLabel: '저장소 열기', properties: ['openDirectory'] });
  return result.canceled ? null : register(result.filePaths[0]);
});
handle('init', async () => {
  const result = await dialog.showOpenDialog(win, { title: '새 저장소를 만들 빈 폴더 선택', message: '새 Git 저장소를 만들 빈 폴더를 선택하거나 새 폴더를 만드세요. 선택한 폴더에서 git init을 실행합니다.', buttonLabel: '여기에 저장소 만들기', properties: ['openDirectory', 'createDirectory'] });
  if (result.canceled) return null;
  const target = result.filePaths[0];
  if ((await fs.readdir(target)).length) throw new Error('비어 있는 폴더를 선택하세요. 기존 저장소는 열기를 사용하세요.');
  await git.git(target, ['init', '-b', 'main']); return register(target);
});
async function operation(id, task) {
  if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || operations.has(id)) throw new Error('작업 식별자를 확인하세요.');
  const controller = new AbortController(); operations.set(id, controller); mutations++;
  try { return await task(controller.signal); } finally { operations.delete(id); mutations--; }
}
handle('copyBranchName', async (cwd, ref) => {
  const snapshot = await git.state(await authorized(cwd));
  const branch = snapshot.refs.find(branch => branch.ref === ref);
  if (!branch) throw new Error('복사할 브랜치가 없습니다. 새로고침하세요.');
  clipboard.writeText(branch.ref.replace(/^refs\/(heads|remotes)\//, ''));
  return null;
});
handle('copyCommitSha', async (cwd, sha) => {
  const target = await authorized(cwd);
  if (typeof sha !== 'string' || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sha)) throw new Error('복사할 커밋 SHA를 확인하세요.');
  await git.git(target, ['rev-parse', '--verify', '--end-of-options', `${sha}^{commit}`]);
  await clipboard.writeText(sha);
  return null;
});
handle('stashDiff', async (cwd, sha) => sync.preview(await authorized(cwd), sha));
const remoteMonitorController = new AbortController();
handle('monitorRemote', async cwd => sync.monitor(await authorized(cwd), remoteMonitorController.signal));
handle('syncState', async (cwd, offset) => sync.snapshot(await authorized(cwd), offset));
handle('sync', async (cwd, input) => {
  await authorized(cwd);
  try { return await operation(input.id, signal => sync.change(cwd, input, signal)); }
  catch (error) {
    if (error.pushRecovery) return { rejectedPush: error.pushRecovery };
    throw error;
  }
});
handle('cancel', id => { operations.get(id)?.abort(); return null; });
handle('cloneDestination', async () => {
  const result = await dialog.showSaveDialog(win, { title: '복제할 새 폴더 위치', buttonLabel: '위치 선택' });
  if (result.canceled || !result.filePath) return null;
  destinations.add(result.filePath); return result.filePath;
});
handle('clone', async input => {
  if (!destinations.has(input.target)) throw new Error('복제 위치 선택 버튼을 사용하세요.');
  return operation(input.id, async signal => register(await sync.clone(input.url, input.target, signal)));
});
handle('state', async cwd => { await authorized(cwd); return git.serial(cwd, () => git.state(cwd)); });
handle('history', async (cwd, input) => git.history(await authorized(cwd), input));
handle('compare', async (cwd, input) => git.compare(await authorized(cwd), input));
handle('compareCommit', async (cwd, sha, tips) => git.compareCommit(await authorized(cwd), sha, tips));
handle('compareFile', async (cwd, input) => git.compareFile(await authorized(cwd), input));
handle('amendPreview', async (cwd, sha) => git.amendPreview(await authorized(cwd), sha));
handle('changeStats', async (cwd, expected) => git.changeStats(await authorized(cwd), expected));
handle('diff', async (cwd, input) => git.diff(await authorized(cwd), input));
handle('fileAction', async (cwd, input) => {
  cwd = await authorized(cwd); mutations++;
  try {
    return await fileActions.run(cwd, input, {
      copy: value => clipboard.writeText(value),
      reveal: target => shell.showItemInFolder(target),
      open: async target => { const error = await shell.openPath(target); if (error) throw new Error(error); },
      trash: target => shell.trashItem(target),
      patch: async (patch, name) => {
        const result = await dialog.showSaveDialog(win, { title: '파일 변경 패치 저장', defaultPath: name, filters: [{ name: 'Git patch', extensions: ['patch'] }] });
        if (result.canceled || !result.filePath) return false;
        // Never overwrite an existing file, including repository data, from this export.
        try { await fs.writeFile(result.filePath, patch, { flag: 'wx', mode: 0o600 }); } catch (e) { if (e.code === 'EEXIST') throw new Error('같은 이름의 파일이 있습니다. 다른 이름으로 패치를 저장하세요.'); throw e; }
        return true;
      },
    });
  } finally { mutations--; }
});
handle('workingList', async (cwd, folder) => workingFiles.list(await authorized(cwd), folder));
handle('workingRead', async (cwd, file) => workingFiles.read(await authorized(cwd), file));
handle('workingSave', async (cwd, input) => {
  await authorized(cwd); mutations++;
  try { return await workingFiles.save(cwd, input); } finally { mutations--; }
});
handle('conflictRead', async (cwd, file) => conflicts.read(await authorized(cwd), file, path.join(app.getPath('userData'), 'conflict-backups')));
handle('conflictChange', async (cwd, input) => {
  await authorized(cwd); mutations++;
  try { return await conflicts.change(cwd, input, path.join(app.getPath('userData'), 'conflict-backups')); } finally { mutations--; }
});
handle('worktrees', async cwd => git.worktrees(await authorized(cwd)));
handle('openWorktree', async (cwd, target) => {
  const list = await git.worktrees(await authorized(cwd)); if (!list.some(w => w.path === target && !w.prunable)) throw new Error('연결된 worktree를 찾을 수 없습니다.');
  return register(target);
});
handle('destination', async () => {
  const result = await dialog.showSaveDialog(win, { title: '새 worktree 폴더 위치', buttonLabel: '위치 선택' });
  if (result.canceled || !result.filePath) return null;
  destinations.add(result.filePath); return result.filePath;
});
handle('mutate', async (cwd, input) => {
  await authorized(cwd);
  if (input.action === 'worktree-add' && !destinations.has(input.target)) throw new Error('worktree 위치 선택 버튼을 사용하세요.');
  mutations++;
  try { return await git.mutate(cwd, input); } finally { mutations--; }
});
handle('profiles', () => settings.profiles || []);
handle('saveProfiles', async input => {
  if (!Array.isArray(input) || input.length > 30) throw new Error('프로필은 최대 30개까지 저장할 수 있습니다.');
  const profiles = input.map(item => {
    if (!item || typeof item.id !== 'string' || !/^[a-f0-9-]{36}$/.test(item.id)) throw new Error('프로필 식별자를 확인하세요.');
    const label = git.text(item.label, '프로필 이름', 100).trim(), name = git.text(item.name, '작성자 이름', 256).trim(), email = git.text(item.email, '이메일', 320).trim();
    if (!label || !name || !email || /[\r\n]/.test(label + name + email) || !/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error('프로필 이름·작성자 이름·이메일을 확인하세요.');
    return { id: item.id, label, name, email };
  });
  if (new Set(profiles.map(item => item.id)).size !== profiles.length) throw new Error('중복된 프로필입니다.');
  const previous = settings.profiles; settings.profiles = profiles;
  try { await save(); } catch (error) { if (settings.profiles === profiles) settings.profiles = previous; throw error; }
  return profiles;
});
handle('saveWorkspace', async data => {
  if (!Array.isArray(data.tabs) || data.tabs.length > 30) throw new Error('최대 30개의 탭을 열 수 있습니다.');
  settings.tabs = data.tabs.map(tab => {
    if (!settings.recent.includes(tab.path) && !allowed.has(tab.path)) throw new Error('열지 않은 저장소입니다.');
    const result = { path: tab.path, area: tab.area === 'team' ? 'team' : 'workspace' };
    for (const key of ['view', 'query', 'author', 'file', 'ref', 'after', 'before', 'commitMessage', 'a', 'b', 'mode', 'diffMode']) result[key] = git.text(tab[key] || '', key, key === 'commitMessage' ? 10000 : 4096);
    return result;
  });
  settings.savedTabs = Object.fromEntries(Object.entries({ ...settings.savedTabs, ...Object.fromEntries(settings.tabs.map(t => [t.path, t])) }).slice(-50));
  settings.active = settings.tabs.some(t => t.path === data.active) ? data.active : settings.tabs[0]?.path || null;
  await save(); return null;
});
handle('agentChat', (cwd, input) => operation(input?.id, async signal => {
  try {
  await authorized(cwd);
  signal.throwIfAborted();
  if (!input || !Object.hasOwn(agents.names, input.agent) || !settings.agents[input.agent]?.enabled) throw new Error('AI Agents에서 사용할 Agent를 활성화하세요.');
  const agent = (await agents.inspect(settings.agents)).find(a => a.id === input.agent);
  if (!agent?.path || !agent.version) throw new Error('Agent 실행 파일과 설치 버전을 확인하세요.');
  let snapshot;
  if (input.kind === 'commit-message') {
    if (typeof input.includeStaged !== 'boolean') throw new Error('스테이징 변경 포함 여부를 확인하세요.');
    const preview = await git.amendPreview(cwd, input.sha);
    snapshot = { kind: 'commit-message', file: 'COMMIT_MESSAGE', token: preview.token, originalMessage: preview.message, commitDiff: preview.diff, stagedDiff: input.includeStaged ? preview.stagedDiff : '' };
  } else snapshot = await conflicts.read(cwd, input.file, path.join(app.getPath('userData'), 'conflict-backups'));
  if (snapshot.token !== input.expected) throw new Error('원본이 변경되었습니다. 원본을 다시 불러온 뒤 전송하세요.');
  if (!settings.agents[input.agent]?.enabled) throw new Error('Agent가 비활성화되었습니다.');
  const reply = await agentChat.chat(agent, snapshot, input, signal);
  if (input.kind === 'commit-message' && reply.result !== null) { git.text(reply.result, '제안 커밋 메시지', 10000); if (!reply.result.split('\n')[0].trim()) throw new Error('Agent 제안에 커밋 제목이 없습니다.'); }
  return reply;
  } catch (error) { if (signal.aborted) throw new Error('AI 요청을 중단했습니다. 이미 전송된 요청의 사용량은 발생할 수 있습니다.'); throw error; }
}));
handle('agents', () => agents.inspect(settings.agents));
handle('setAgent', async (id, enabled) => {
  if (!Object.hasOwn(agents.names, id) || typeof enabled !== 'boolean') throw new Error('Agent 설정이 올바르지 않습니다.');
  settings.agents[id] = { ...settings.agents[id], enabled }; await save(); return agents.inspect(settings.agents);
});
handle('agentPath', async id => {
  if (!Object.hasOwn(agents.names, id)) throw new Error('Agent를 선택하세요.');
  const result = await dialog.showOpenDialog(win, { title: `${agents.names[id]} 실행 파일 선택`, properties: ['openFile'] });
  if (!result.canceled) { settings.agents[id] = { ...settings.agents[id], path: result.filePaths[0] }; await save(); }
  return agents.inspect(settings.agents);
});
handle('defaultAgent', async id => {
  if (!Object.hasOwn(agents.names, id) || !settings.agents[id]?.enabled) throw new Error('활성 Agent를 선택하세요.');
  settings.defaultAgent = id; await save(); return id;
});
handle('usage', async id => {
  if (id !== 'codex') throw new Error('이 Agent의 공식 자동 잔여량 조회는 아직 지원하지 않습니다.');
  if (!settings.agents[id]?.enabled) throw new Error('Agent를 먼저 활성화하세요.');
  const agent = (await agents.inspect(settings.agents)).find(a => a.id === id);
  if (!agent.path || !agent.version) throw new Error('Codex 실행 파일을 확인하세요.');
  return agents.codexUsage(agent.path);
});
handle('reveal', async cwd => { await authorized(cwd); const error = await shell.openPath(cwd); if (error) throw new Error(error); return null; });
async function rememberOAuthClients(account) {
  const clients = hosting.defaults(settings.oauthClients);
  if (account) clients[account.provider] = account.clientId;
  if (JSON.stringify(settings.oauthClients) === JSON.stringify(clients)) return;
  const previous = settings.oauthClients; settings.oauthClients = clients;
  try { await save(); } catch (error) { if (settings.oauthClients === clients) settings.oauthClients = previous; throw error; }
}
handle('hostingDefaults', async () => {
  const clients = JSON.parse(await fs.readFile(path.join(__dirname, 'oauth-clients.json'), 'utf8'));
  let warning = '';
  try { await rememberOAuthClients(); } catch { warning = '로그인 앱 설정을 디스크에 저장하지 못했습니다. 이번 실행에서는 자동 설정을 사용할 수 있습니다.'; }
  return { ...hosting.defaults(settings.oauthClients, clients), warning };
});
handle('hostingPat', input => hosting.connectPat(input));
handle('hostingAccounts', () => hosting.list());
handle('hostingStart', input => hosting.start(input));
handle('hostingPoll', async id => {
  const result = await hosting.poll(id);
  if (!result.pending) {
    // Remember only a successfully authorized public app ID, never credentials.
    const account = hosting.accounts.get(result.account);
    try { await rememberOAuthClients(account); } catch { result.warning = '계정은 연결했지만 로그인 앱 설정을 디스크에 저장하지 못했습니다.'; }
  }
  return result;
});
handle('hostingCancel', id => hosting.cancel(id));
handle('hostingVerify', async id => { await shell.openExternal(hosting.verification(id)); return null; });
handle('hostingForget', key => hosting.forget(key));
handle('hostingRead', input => hosting.read(input));
handle('hostingPrepare', input => hosting.prepareWrite(input));
handle('hostingDiscard', id => hosting.discardWrite(id));
handle('hostingWrite', async id => { mutations++; try { return await hosting.executeWrite(id); } finally { mutations--; } });
async function mcpConfig(paths) {
  if (!Array.isArray(paths) || !paths.length || paths.length > 30 || new Set(paths).size !== paths.length) throw new Error('허용할 저장소를 1~30개 선택하세요.');
  for (const cwd of paths) await authorized(cwd);
  return { mcpServers: { branchline: { command: process.execPath, args: [path.join(__dirname, 'mcp.cjs'), ...paths.flatMap(cwd => ['--repo', cwd])], env: { ELECTRON_RUN_AS_NODE: '1' } } } };
}
handle('mcpConfig', mcpConfig);
handle('copyMcpConfig', async paths => { await clipboard.writeText(JSON.stringify(await mcpConfig(paths), null, 2)); return null; });
function accountLink(account, url) {
  const selected = hosting.list().accounts.find(a => a.key === account);
  if (!selected) throw new Error('연결된 계정을 선택하세요.');
  return publicURL(url, selected.host);
}
handle('hostingExternal', async (account, url) => { await shell.openExternal(accountLink(account, url)); return null; });
handle('hostingCopyLink', async (account, url) => { await clipboard.writeText(accountLink(account, url)); return null; });
// Branchline-labelled menu: the default template shows "Electron" and developer tools to end users.
function applicationMenu() {
  const name = 'Branchline', mac = process.platform === 'darwin';
  const send = channel => () => win?.webContents.send(channel);
  app.setAboutPanelOptions({ applicationName: name, applicationVersion: app.getVersion() });
  return Menu.buildFromTemplate([
    ...(mac ? [{ label: name, submenu: [{ role: 'about', label: `${name} 정보` }, { type: 'separator' }, { role: 'services', label: '서비스' }, { type: 'separator' }, { role: 'hide', label: `${name} 숨기기` }, { role: 'hideOthers', label: '기타 숨기기' }, { role: 'unhide', label: '모두 보기' }, { type: 'separator' }, { role: 'quit', label: `${name} 종료` }] }] : []),
    { label: '파일', submenu: [mac ? { role: 'close', label: '창 닫기' } : { role: 'quit', label: '종료' }] },
    { label: '편집', submenu: [{ role: 'undo', label: '실행 취소' }, { role: 'redo', label: '다시 실행' }, { type: 'separator' }, { role: 'cut', label: '잘라내기' }, { role: 'copy', label: '복사' }, { role: 'paste', label: '붙여넣기' }, { role: 'selectAll', label: '모두 선택' }] },
    { label: '보기', submenu: [{ role: 'resetZoom', label: '실제 크기' }, { role: 'zoomIn', label: '확대' }, { role: 'zoomOut', label: '축소' }, { type: 'separator' }, { role: 'togglefullscreen', label: '전체 화면' }, ...(app.isPackaged ? [] : [{ type: 'separator' }, { role: 'reload', label: '새로고침 (개발)' }, { role: 'toggleDevTools', label: '개발자 도구 (개발)' }])] },
    { label: '윈도우', submenu: [{ role: 'minimize', label: '최소화' }, { role: 'zoom', label: '확대/축소' }, ...(mac ? [{ type: 'separator' }, { role: 'front', label: '모두 앞으로 가져오기' }] : [])] },
    { label: '도움말', role: 'help', submenu: [{ label: '키보드 단축키', accelerator: 'CmdOrCtrl+/', click: send('branchline:shortcuts') }] },
  ]);
}
app.whenReady().then(async () => {
  if (!primaryInstance) return;
  settingsFile = path.join(app.getPath('userData'), 'workspace.json');
  hosting = new Hosting(path.join(app.getPath('userData'), 'hosting.enc'), safeStorage);
  await hosting.load();
  try { const stored = JSON.parse(await fs.readFile(settingsFile, 'utf8')); if (stored.version === 1 && Array.isArray(stored.recent) && Array.isArray(stored.tabs)) settings = { ...settings, ...stored }; } catch { /* first launch */ }
  for (const tab of settings.tabs) if (typeof tab.path === 'string') allowed.add(tab.path);
  Menu.setApplicationMenu(applicationMenu());
  win = new BrowserWindow({ width: 1440, height: 950, minWidth: 760, minHeight: 580, title: 'Branchline', backgroundColor: '#fafafa', webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', event => event.preventDefault());
  win.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  win.on('close', event => { if (mutations) { allowClose = false; event.preventDefault(); void dialog.showMessageBox(win, { type: 'info', message: '작업이 진행 중입니다.', detail: '작업 결과를 확인한 뒤 앱을 종료하세요.' }); } else if (!allowClose) { quitting = false; event.preventDefault(); win.webContents.send('branchline:closeRequested'); } });
  await win.loadFile(entry);
});
app.on('window-all-closed', () => app.quit());

app.on('before-quit', event => { if (!quitting) { event.preventDefault(); hosting?.pending?.controller.abort(); Promise.allSettled([saving, ...hosting?.locks.values() || [], hosting?.saving]).finally(() => { quitting = true; remoteMonitorController.abort(); app.quit(); }); } });
