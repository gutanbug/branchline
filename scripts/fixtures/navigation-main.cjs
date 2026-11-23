// Start the real desktop app with a controlled hosting service before its first renderer loads.
const { app, dialog, ipcMain } = require('electron');
const path = require('node:path');
if (!process.env.BRANCHLINE_TEST_DATA) throw new Error('An isolated test profile is required.');
require('../../electron/main.cjs');

const repo = path.join(path.dirname(process.env.BRANCHLINE_TEST_DATA), 'history');
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [repo] });
app.on('browser-window-created', (_event, window) => window.setContentSize(1250, 820));

let pendingReview;
app.on('hold-review', () => { pendingReview = new Promise(resolve => app.once('release-review', resolve)); });
if (process.argv.includes('--hold-review')) app.emit('hold-review');
const provider = process.argv.includes('--github') ? 'github' : 'gitlab';
const row = id => ({ id, title: 'Review number ' + id, state: 'open', subtitle: 'Developer', date: '', url: '' });
for (const name of ['hostingAccounts', 'hostingRead']) ipcMain.removeHandler('branchline:' + name);
ipcMain.handle('branchline:hostingAccounts', () => ({ ok: true, value: { accounts: [{ key: 'test', provider, host: `${provider}.example.test`, login: 'dev' }], warning: '' } }));
ipcMain.handle('branchline:hostingRead', async (_event, q) => {
  let items = [];
  if (q.kind === 'project') items = [{ id: q.project, title: q.project }];
  if (q.kind === 'reviews') items = Array.from({ length: 30 }, (_, i) => row(String(i + 1)));
  if (q.kind === 'review') {
    await pendingReview;
    items = [{ ...row(q.id), body: Array.from({ length: 100 }, (_, i) => 'Paragraph ' + i).join('\n\n') }];
  }
  return { ok: true, value: { checkedAt: '', hasMore: false, items } };
});
