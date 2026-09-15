const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile, spawn } = require('node:child_process');
const { promisify } = require('node:util');
const readline = require('node:readline');
const exec = promisify(execFile);
const names = { claude: 'Claude Code', codex: 'Codex', gemini: 'Gemini CLI' };
async function locate(id) {
  const dirs = [...(process.env.PATH || '').split(path.delimiter), path.join(os.homedir(), '.local/bin'), '/opt/homebrew/bin', '/usr/local/bin'];
  for (const dir of dirs.filter(Boolean)) {
    const candidate = path.join(dir, id + (process.platform === 'win32' ? '.exe' : ''));
    try { await fs.access(candidate, fs.constants.X_OK); return candidate; } catch { /* try next */ }
  }
  return null;
}
async function inspect(settings) {
  return Promise.all(Object.keys(names).map(async id => {
    const executable = settings[id]?.path || await locate(id);
    let version = null, error = null;
    if (executable) try { version = (await exec(executable, ['--version'], { timeout: 5000, maxBuffer: 16384 })).stdout.trim().slice(0, 120); } catch { error = '실행 파일의 버전을 확인하지 못했습니다.'; }
    return { id, name: names[id], enabled: settings[id]?.enabled === true, path: executable, version, error, quotaSupport: id === 'codex' ? 'official' : 'unavailable' };
  }));
}
function codexUsage(executable) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ['app-server', '--stdio'], { stdio: ['pipe', 'pipe', 'ignore'] });
    let done = false; let account = null;
    const finish = (error, result) => { if (done) return; done = true; clearTimeout(timer); child.stdin.end(); child.kill(); error ? reject(error) : resolve(result); };
    const timer = setTimeout(() => finish(new Error('사용량 조회 시간이 초과되었습니다.')), 15000);
    const send = payload => { if (!done) child.stdin.write(JSON.stringify(payload) + '\n'); };
    child.stdin.on('error', () => finish(new Error('Agent 연결이 종료되었습니다.')));
    child.on('error', () => finish(new Error('Codex를 실행하지 못했습니다.')));
    child.on('exit', () => { if (!done) finish(new Error('Codex 연결이 종료되었습니다.')); });
    let received = 0;
    child.stdout.on('data', chunk => { received += chunk.length; if (received > 1024 * 1024) finish(new Error('Agent 응답이 너무 큽니다.')); });
    readline.createInterface({ input: child.stdout }).on('line', line => {
      if (line.length > 1024 * 1024) return;
      let msg; try { msg = JSON.parse(line); } catch { return; }
      if (msg.error && [1, 2, 3].includes(msg.id)) return finish(new Error('설치된 Codex의 인증 방식 또는 버전에서 한도를 조회할 수 없습니다.'));
      if (msg.id === 1) { send({ method: 'initialized', params: {} }); send({ id: 2, method: 'account/read', params: { refreshToken: false } }); }
      if (msg.id === 2) {
        const item = msg.result?.account;
        if (!item || item.type !== 'chatgpt') return finish(new Error('Codex CLI에서 ChatGPT 계정으로 로그인한 뒤 다시 조회하세요. API key 한도는 지원하지 않습니다.'));
        account = { type: item.type, email: item.email || null, plan: item.planType || null };
        send({ id: 3, method: 'account/rateLimits/read', params: {} });
      }
      if (msg.id === 3) {
        const r = msg.result || {};
        const buckets = r.rateLimitsByLimitId ? Object.entries(r.rateLimitsByLimitId) : r.rateLimits ? [['codex', r.rateLimits]] : [];
        const windows = buckets.flatMap(([id, bucket]) => ['primary', 'secondary'].flatMap(key => {
          const window = bucket[key]; if (!window || typeof window.usedPercent !== 'number' || !Number.isFinite(window.usedPercent)) return [];
          return [{ id: `${id}/${key}`, name: bucket.limitName || id, usedPercent: window.usedPercent, remainingPercent: Math.max(0, Math.min(100, 100 - window.usedPercent)), windowMinutes: Number.isFinite(window.windowDurationMins) ? window.windowDurationMins : null, resetsAt: Number.isFinite(window.resetsAt) ? window.resetsAt : null }];
        }));
        finish(null, { account, windows, checkedAt: new Date().toISOString() });
      }
    });
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'branchline', version: '0.1.0' }, capabilities: { experimentalApi: true } } });
  });
}
module.exports = { names, inspect, codexUsage };
