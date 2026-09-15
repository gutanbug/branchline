const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createInterface } = require('node:readline');
const git = require('./git.cjs');

test('stdio MCP lifecycle, real Git reads, explicit allowlist, no writes, error bounds and secret isolation', async t => {
  const root = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'branchline-mcp-'))), repo = path.join(root, '한글 repo');
  await fs.mkdir(repo); await git.git(repo, ['init', '-b', 'main']); await git.git(repo, ['config', 'user.name', 'MCP Test']); await git.git(repo, ['config', 'user.email', 'mcp@example.invalid']); await git.git(repo, ['config', 'commit.gpgsign', 'false']);
  await fs.writeFile(path.join(repo, 'file.txt'), 'first\n'); await git.git(repo, ['add', '.']); await git.git(repo, ['commit', '-m', 'initial']);
  const head = (await git.git(repo, ['rev-parse', 'HEAD'])).trim();
  await fs.writeFile(path.join(repo, 'file.txt'), 'first\nsecond\n'); await git.git(repo, ['add', '.']); await fs.writeFile(path.join(repo, 'untracked.txt'), 'untracked-secret');
  const executable = process.env.BRANCHLINE_EXECUTABLE || process.execPath;
  const entry = process.env.BRANCHLINE_MCP_ENTRY || path.join(__dirname, 'mcp.cjs');
  const child = spawn(executable, [entry, '--repo', repo], { env: { ...process.env, ...(process.env.BRANCHLINE_EXECUTABLE ? { ELECTRON_RUN_AS_NODE: '1' } : {}) }, stdio: ['pipe', 'pipe', 'pipe'] });
  t.after(async () => { child.kill(); await fs.rm(root, { recursive: true, force: true }); });
  const waiting = new Map(); let nextId = 0, output = '', stderr = '';
  child.stderr.on('data', data => { stderr += data; });
  createInterface({ input: child.stdout }).on('line', line => { output += line; const message = JSON.parse(line); waiting.get(message.id)?.(message); waiting.delete(message.id); });
  function request(method, params) {
    const id = ++nextId;
    return new Promise((resolve, reject) => { const timer = setTimeout(() => { waiting.delete(id); reject(new Error(`MCP ${method} timed out: ${stderr}`)); }, 10000); waiting.set(id, value => { clearTimeout(timer); resolve(value); }); child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n'); });
  }
  const call = (name, args) => request('tools/call', { name, arguments: args });
  assert.equal((await request('tools/list', {})).error.code, -32000);
  const init = await request('initialize', { protocolVersion: '2025-11-25', clientInfo: { name: 'fixture', version: '1' }, capabilities: {} }); assert.equal(init.result.protocolVersion, '2025-11-25');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const tools = (await request('tools/list', {})).result.tools; assert.equal(tools.length, 5); assert.ok(tools.every(tool => tool.annotations.readOnlyHint));
  const projects = (await call('list_projects', {})).result.structuredContent.projects; assert.equal(projects[0].path, repo); assert.equal(projects[0].id, 'repo-1');
  const state = (await call('get_status', { project: 'repo-1' })).result.structuredContent; assert.equal(state.head, head); assert.equal(state.files.length, 2); assert.equal(state.token, undefined); assert.equal(state.identity, undefined);
  const diff = (await call('get_diff', { project: 'repo-1' })).result.structuredContent; assert.match(diff.diff, /\+second/); assert.equal(diff.diff.includes('untracked-secret'), false);
  assert.match((await call('get_diff', { project: 'repo-1', sha: head })).result.structuredContent.diff, /initial/);
  assert.equal((await call('get_status', { project: root })).error.code, -32602);
  assert.equal((await call('get_diff', { project: 'repo-1', file: '../untracked.txt' })).error.code, -32602);
  assert.equal((await call('get_diff', { project: 'repo-1', sha: '--output=evil' })).error.code, -32602);
  assert.equal((await call('execute_operation', { approved: true })).error.code, -32602);
  assert.equal((await request('roots/list', {})).error.code, -32601);
  assert.equal((await call('list_conflicts', { project: 'repo-1' })).result.structuredContent.files.length, 0);
  const worktrees = (await call('list_worktrees', { project: 'repo-1' })).result.structuredContent.worktrees; assert.equal(worktrees[0].project, 'repo-1');
  assert.equal((await git.git(repo, ['rev-parse', 'HEAD'])).trim(), head); assert.equal(output.includes('untracked-secret'), false);
  child.stdin.end(); await new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('MCP did not stop on EOF')), 5000); child.once('close', code => { clearTimeout(timer); try { assert.equal(code, 0); resolve(); } catch (e) { reject(e); } }); });
});
