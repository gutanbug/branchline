const writes = require('./hosting-writes.cjs');
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const reviews = require('./reviews.cjs');

const providers = {
  github: { host: 'github.com', api: 'https://api.github.com', device: '/login/device/code', token: '/login/oauth/access_token', verify: '/login/device' },
  gitlab: { host: 'gitlab.com', api: 'https://gitlab.com/api/v4', device: '/oauth/authorize_device', token: '/oauth/token', verify: '/oauth/device' },
};
function provider(id) { if (!Object.hasOwn(providers, id)) throw new Error('GitHub 또는 GitLab을 선택하세요.'); return providers[id]; }
function accountConfig(account) {
  if (typeof account === 'string') return provider(account);
  const config = provider(account.provider);
  if (account.authType !== 'pat') return config;
  if (account.provider !== 'gitlab') throw new Error('PAT 연결은 GitLab에서 지원합니다.');
  let url;
  try { url = new URL(account.origin); } catch { throw new Error('GitLab HTTPS 서버 주소를 입력하세요.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) throw new Error('GitLab HTTPS 서버 주소만 입력하세요. 프로젝트 경로나 /api/v4는 제외하세요.');
  return { host: url.host, api: `${url.origin}/api/v4` };
}
function string(value, max = 4096) { return typeof value === 'string' ? value.slice(0, max) : ''; }
function publicURL(value, host) {
  try { const url = new URL(value); if (url.origin === `https://${host}` && !url.username && !url.password && !url.search && (!url.hash || /^#(?:issuecomment-|discussion_r|pullrequestreview-|note_)[0-9]+$/.test(url.hash))) return url.href; } catch { /* rejected below */ }
  throw new Error('허용된 호스팅 주소가 아닙니다.');
}
function projectPath(value, github) {
  if (typeof value !== 'string' || value.length > 1024 || !value.split('/').every(s => /^[\w.-]+$/.test(s) && s !== '.' && s !== '..') || (github ? value.split('/').length !== 2 : value.split('/').length < 2)) throw new Error('프로젝트 경로를 owner/repository 또는 group/project 형식으로 입력하세요.');
  return github ? value.split('/').map(encodeURIComponent).join('/') : encodeURIComponent(value);
}
function integer(value) { if (!Number.isSafeInteger(Number(value)) || Number(value) < 1) throw new Error('항목 번호가 올바르지 않습니다.'); return Number(value); }
function oauthError(code) {
  return new Error(({ access_denied: '브라우저에서 승인이 거절되었습니다.', expired_token: '승인 코드가 만료되었습니다. 다시 연결하세요.', token_expired: '승인 코드가 만료되었습니다. 다시 연결하세요.', device_flow_disabled: '등록한 GitHub 앱에서 Device Flow를 활성화하세요.', incorrect_client_credentials: '등록된 공개 Client ID를 확인하세요.', invalid_client: '공개 Client ID와 앱 유형을 확인하세요.', invalid_scope: '등록 앱에서 요청 권한을 허용하는지 확인하세요.', bad_refresh_token: '인증 갱신이 만료되었습니다. 계정을 다시 연결하세요.', invalid_grant: '인증이 만료되었거나 취소되었습니다. 다시 연결하세요.' })[code] || 'OAuth 요청을 완료하지 못했습니다. 앱 등록과 Device Flow 설정을 확인하세요.');
}
async function request(url, options = {}, oauth = false) {
  let response, body;
  try {
    response = await fetch(url, { ...options, redirect: 'error', signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(30000)]) : AbortSignal.timeout(30000) });
    const chunks = []; let size = 0;
    if (response.body) for await (const chunk of response.body) { size += chunk.length; if (size > 4 * 1024 * 1024) throw new Error('size'); chunks.push(chunk); }
    try { const raw = Buffer.concat(chunks).toString('utf8'); body = raw.trim() ? JSON.parse(raw) : {}; } catch (e) { if (response.ok) throw e; body = {}; }
  } catch { throw new Error('호스팅 응답을 읽지 못했습니다. 네트워크·프록시를 확인한 뒤 다시 시도하세요. 응답은 30초·4MiB로 제한됩니다.'); }
  if (oauth && body.error && [200, 400, 401, 403].includes(response.status)) return { body, response };
  if (!response.ok) {
    const limited = response.status === 429 || response.status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after'));
    const retry = Number(response.headers.get('retry-after'));
    const reset = Number(response.headers.get('x-ratelimit-reset'));
    const wait = Number.isFinite(retry) && retry > 0 ? `${Math.ceil(retry)}초 이후` : Number.isFinite(reset) && reset > 0 && reset < 1e11 ? `${new Date(reset * 1000).toISOString()} 이후` : '잠시 후';
    const error = new Error(limited ? `API 요청 한도에 도달했습니다. ${wait} 수동으로 다시 조회하세요.` : ({ 401: '인증이 만료되었거나 철회되었습니다. 계정을 다시 연결하세요.', 403: '조회 권한이 없습니다. 토큰 권한·조직 SSO·프로젝트 정책을 확인하세요.', 404: '항목이 없거나 접근 권한이 없습니다. 경로와 계정을 확인하세요.' })[response.status] || `호스팅 조회에 실패했습니다 (HTTP ${response.status}). 다시 조회하세요.`);
    error.status = response.status; throw error;
  }
  return { body, response };
}
function post(config, route, values, signal) { return request(`https://${config.host}${route}`, { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(values), signal }, true); }
function credentials(body) {
  if (body.error) throw oauthError(body.error);
  if (typeof body.access_token !== 'string' || !body.access_token || body.access_token.length > 8192 || /[\r\n]/.test(body.access_token) || String(body.token_type).toLowerCase() !== 'bearer') throw new Error('유효한 OAuth 토큰을 받지 못했습니다. 다시 연결하세요.');
  if (body.expires_in != null && (!Number.isFinite(body.expires_in) || body.expires_in <= 0)) throw new Error('토큰 만료 정보가 올바르지 않습니다.');
  return { accessToken: body.access_token, refreshToken: string(body.refresh_token, 8192), expiresAt: body.expires_in ? Date.now() + body.expires_in * 1000 : null, scope: string(body.scope, 1024) };
}

// Tokens and device_code stay in main. Only the explicitly selected public fields leave this service.
class Hosting {
  constructor(file, secureStorage) { this.file = file; this.secureStorage = secureStorage; this.accounts = new Map(); this.locks = new Map(); this.saving = Promise.resolve(); this.pending = null; this.warning = ''; this.plans = new Map(); }
  secure() { return this.secureStorage.isEncryptionAvailable() && this.secureStorage.getSelectedStorageBackend?.() !== 'basic_text'; }
  async load() {
    try {
      const data = await fs.readFile(this.file);
      if (!this.secure()) throw new Error('storage');
      const accounts = JSON.parse(this.secureStorage.decryptString(data));
      if (!Array.isArray(accounts) || accounts.length > 20) throw new Error('store');
      for (const a of accounts) { const p = accountConfig(a); if (a.key !== `${a.provider}:${p.host}:${a.id}` || !a.accessToken || (a.authType !== 'pat' && !a.clientId)) throw new Error('store'); }
      this.accounts = new Map(accounts.map(a => [a.key, a]));
    } catch (e) { if (e.code !== 'ENOENT') this.warning = '저장된 계정을 복원하지 못했습니다. OS 보안 저장소를 확인한 뒤 앱을 다시 시작하세요. 새 영구 저장은 잠겨 있으며 세션 연결은 가능합니다.'; }
  }
  list() { return { warning: this.warning, accounts: [...this.accounts.values()].map(a => ({ key: a.key, provider: a.provider, host: accountConfig(a).host, authType: a.authType || 'oauth', login: a.login, scope: a.scope || '제공자가 권한 정보를 반환하지 않음', persistent: a.persistent, expiresAt: a.expiresAt, reconnect: !!a.reconnect, writeAccess: a.writeAccess === true })) }; }
  defaults(remembered = {}, bundled = {}) {
    const valid = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{5,256}$/.test(value);
    return Object.fromEntries(Object.keys(providers).map(id => {
      const connected = [...this.accounts.values()].reverse().find(account => account.provider === id && valid(account.clientId))?.clientId;
      return [id, [remembered?.[id], connected, bundled?.[id]].find(valid) || ''];
    }));
  }
  async save() {
    const entries = [...this.accounts.values()].filter(a => a.persistent);
    this.saving = this.saving.catch(() => {}).then(async () => {
      if (this.warning) { if (entries.length) throw new Error('OS 보안 저장소를 먼저 복구하세요.'); return; }
      if (!entries.length) { await fs.rm(this.file, { force: true }); return; }
      if (!this.secure()) throw new Error('OS 보안 저장소를 사용할 수 없습니다.');
      const encrypted = this.secureStorage.encryptString(JSON.stringify(entries));
      await fs.mkdir(path.dirname(this.file), { recursive: true }); await fs.writeFile(this.file + '.tmp', encrypted, { mode: 0o600 }); await fs.rename(this.file + '.tmp', this.file);
    });
    try { await this.saving; } catch { throw new Error('계정의 암호화 저장에 실패했습니다. OS 보안 저장소와 디스크를 확인하세요.'); }
  }
  serial(key, task) {
    const next = (this.locks.get(key) || Promise.resolve()).catch(() => {}).then(task); this.locks.set(key, next);
    return next.finally(() => { if (this.locks.get(key) === next) this.locks.delete(key); });
  }
  cancel(id) { if (this.pending?.id === id) { if (this.pending.committing) throw new Error('계정 저장을 마무리하고 있습니다. 완료 후 연결을 해제할 수 있습니다.'); this.pending.controller.abort(); this.pending = null; } return null; }
  async start(input) {
    const config = provider(input.provider);
    if (typeof input.clientId !== 'string' || !/^[a-zA-Z0-9_-]{5,256}$/.test(input.clientId) || typeof input.persistent !== 'boolean' || typeof input.privateRepos !== 'boolean' || input.writeAccess != null && typeof input.writeAccess !== 'boolean') throw new Error('등록 앱의 공개 Client ID와 저장 방식을 확인하세요. Client Secret은 입력하지 마세요.');
    if (this.pending && this.pending.expiresAt > Date.now()) throw new Error('현재 승인 요청을 취소하거나 완료한 뒤 다시 연결하세요.');
    if (input.persistent && (this.warning || !this.secure())) throw new Error('OS 보안 저장소를 사용할 수 없습니다. 세션 한정으로 연결하세요.');
    const current = { id: randomUUID(), provider: input.provider, clientId: input.clientId, persistent: input.persistent, writeAccess: input.writeAccess === true, controller: new AbortController(), expiresAt: Date.now() + 30000 };
    this.pending = current;
    try {
      const scope = input.provider === 'github' ? (input.privateRepos || input.writeAccess ? 'read:user repo' : 'read:user') : input.writeAccess ? 'read_user api' : 'read_user read_api';
      const { body } = await post(config, config.device, { client_id: input.clientId, scope }, current.controller.signal);
      if (body.error) throw oauthError(body.error);
      const url = publicURL(body.verification_uri, config.host);
      if (new URL(url).pathname !== config.verify || typeof body.user_code !== 'string' || !/^[\w-]{4,32}$/.test(body.user_code) || typeof body.device_code !== 'string' || !body.device_code || body.device_code.length > 2048 || !Number.isFinite(body.expires_in) || body.expires_in <= 0 || body.expires_in > 3600 || body.interval != null && (!Number.isFinite(body.interval) || body.interval < 1 || body.interval > 3600)) throw new Error('승인 코드 응답을 확인할 수 없습니다.');
      if (this.pending !== current) throw new Error('연결 요청이 취소되었습니다.');
      Object.assign(current, { deviceCode: body.device_code, userCode: body.user_code, url, expiresAt: Date.now() + body.expires_in * 1000, interval: Math.max(5, Number(body.interval) || 5) * 1000 });
      current.nextAt = Date.now() + current.interval;
      return { id: current.id, userCode: current.userCode, url, expiresAt: current.expiresAt, nextAt: current.nextAt };
    } catch (e) { this.cancel(current.id); throw e; }
  }
  verification(id) { const p = this.pending; if (!p || p.id !== id || !p.url || p.expiresAt <= Date.now()) throw new Error('승인 요청이 없거나 만료되었습니다.'); return p.url; }
  async poll(id) {
    const p = this.pending; if (!p || p.id !== id) throw new Error('연결 요청이 취소되었습니다.');
    if (Date.now() >= p.expiresAt) { this.cancel(id); throw oauthError('expired_token'); }
    if (p.polling || Date.now() < p.nextAt) return { pending: true, nextAt: p.nextAt };
    p.polling = true;
    const config = provider(p.provider);
    try {
      const { body } = await post(config, config.token, { client_id: p.clientId, device_code: p.deviceCode, grant_type: 'urn:ietf:params:oauth:grant-type:device_code' }, p.controller.signal);
      if (this.pending !== p) throw new Error('연결 요청이 취소되었습니다.');
      if (body.error === 'authorization_pending' || body.error === 'slow_down') {
        if (body.error === 'slow_down') p.interval = Math.min(3600000, Math.max(p.interval + 5000, (Number(body.interval) || 0) * 1000));
        p.nextAt = Date.now() + p.interval; return { pending: true, nextAt: p.nextAt };
      }
      const auth = credentials(body);
      const { body: user } = await this.get(p.provider, auth.accessToken, '/user', p.controller.signal);
      const login = p.provider === 'github' ? user.login : user.username;
      if (!Number.isSafeInteger(user.id) || typeof login !== 'string' || !login) throw new Error('로그인한 계정을 확인하지 못했습니다.');
      if (this.pending !== p || Date.now() >= p.expiresAt) throw new Error('승인 요청이 취소되었거나 만료되었습니다. 다시 연결하세요.');
      const key = `${p.provider}:${config.host}:${user.id}`;
      await this.serial(key, async () => {
        if (this.pending !== p) throw new Error('연결 요청이 취소되었습니다.');
        const old = this.accounts.get(key);
        if (!old && this.accounts.size >= 20) throw new Error('최대 20개 계정을 연결할 수 있습니다.');
        p.committing = true;
        this.accounts.set(key, { ...auth, key, id: user.id, provider: p.provider, clientId: p.clientId, login, persistent: p.persistent, writeAccess: p.writeAccess });
        try { await this.save(); } catch (e) { if (old) this.accounts.set(key, old); else this.accounts.delete(key); throw e; } finally { p.committing = false; }
      });
      this.pending = null; return { pending: false, account: key };
    } catch (e) { this.cancel(id); throw e; } finally { p.polling = false; }
  }
  async connectPat(input) {
    if (!input || typeof input.token !== 'string' || !input.token || input.token.length > 8192 || /[\s\x00-\x1f\x7f]/.test(input.token) || typeof input.persistent !== 'boolean' || typeof input.writeAccess !== 'boolean') throw new Error('PAT와 저장 방식을 확인하세요.');
    const candidate = { provider: 'gitlab', authType: 'pat', origin: input.origin };
    const config = accountConfig(candidate);
    if (input.persistent && (this.warning || !this.secure())) throw new Error('OS 보안 저장소를 사용할 수 없습니다. 세션 한정으로 연결하세요.');
    const { body: user } = await this.get(candidate, input.token, '/user');
    if (!Number.isSafeInteger(user.id) || typeof user.username !== 'string' || !user.username) throw new Error('GitLab 계정을 확인하지 못했습니다.');
    const key = `gitlab:${config.host}:${user.id}`;
    return this.serial(key, async () => {
      const old = this.accounts.get(key);
      if (!old && this.accounts.size >= 20) throw new Error('최대 20개 계정을 연결할 수 있습니다.');
      this.accounts.set(key, { ...candidate, origin: new URL(input.origin).origin, key, id: user.id, login: user.username, accessToken: input.token, persistent: input.persistent, writeAccess: input.writeAccess, expiresAt: null, scope: 'PAT · 실제 권한은 GitLab 토큰 설정을 따름' });
      try { await this.save(); } catch (e) { if (old) this.accounts.set(key, old); else this.accounts.delete(key); throw e; }
      return { account: key };
    });
  }
  async forget(key) { return this.serial(key, async () => { const old = this.accounts.get(key); this.accounts.delete(key); try { await this.save(); } catch (e) { if (old) this.accounts.set(key, old); throw e; } for (const [id, plan] of this.plans) if (plan.account === old) this.plans.delete(id); return this.list(); }); }
  get(id, token, route, signal) { return request(accountConfig(id).api + route, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'User-Agent': 'Branchline', ...((typeof id === 'string' ? id : id.provider) === 'github' ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}) }, signal }); }
  async token(a) {
    if (a.reconnect) throw new Error('계정을 다시 연결하세요.');
    if (!a.expiresAt || a.expiresAt > Date.now() + 60000) return a.accessToken;
    if (!a.refreshToken) { a.reconnect = true; throw new Error('인증이 만료되었습니다. 계정을 다시 연결하세요.'); }
    const config = accountConfig(a);
    const { body } = await post(config, config.token, { client_id: a.clientId, grant_type: 'refresh_token', refresh_token: a.refreshToken });
    if (body.error) { a.reconnect = true; throw oauthError(body.error); }
    const next = credentials(body);
    // Keep a rotated refresh token in memory even if disk persistence fails; never reuse the old pair.
    Object.assign(a, next, { scope: next.scope || a.scope, reconnect: true });
    await this.save();
    const { body: user } = await this.get(a, a.accessToken, '/user');
    if (user.id !== a.id) { a.reconnect = true; throw new Error('갱신된 인증의 계정이 다릅니다. 다시 연결하세요.'); }
    a.reconnect = false; await this.save();
    return a.accessToken;
  }
  async prepareWrite(input) {
    if (!input || typeof input !== 'object') throw new Error('원격 작업을 선택하세요.');
    const a = this.accounts.get(input.account);
    if (!a?.writeAccess) throw new Error('계정 관리에서 원격 쓰기를 허용하여 다시 연결하세요.');
    const gh = a.provider === 'github', base = `${gh ? '/repos/' : '/projects/'}${projectPath(input.project, gh)}`;
    return this.serial(a.key, async () => {
      if (this.accounts.get(a.key) !== a) throw new Error('계정 연결이 변경되었습니다.');
      const token = await this.token(a);
      const plan = await writes.prepare(input, gh, base, async route => (await this.get(a, token, route)).body);
      for (const [id, old] of this.plans) if (old.expiresAt <= Date.now()) this.plans.delete(id);
      if (this.plans.size >= 30) throw new Error('대기 중인 확인창이 너무 많습니다. 5분 후 다시 검토하세요.');
      const id = randomUUID(), expiresAt = Date.now() + 300000;
      this.plans.set(id, { ...plan, account: a, expiresAt });
      return { id, expiresAt, label: plan.label, facts: [{ label: '계정', value: `${accountConfig(a).host} / ${a.login}` }, { label: '프로젝트', value: input.project }, ...plan.facts], text: plan.text || '' };
    });
  }
  discardWrite(id) { this.plans.delete(id); return null; }
  async executeWrite(id) {
    const plan = this.plans.get(id); this.plans.delete(id);
    if (!plan || plan.expiresAt <= Date.now()) throw new Error('작업안이 만료되었거나 이미 사용되었습니다. 결과를 조회한 뒤 다시 검토하세요.');
    const a = plan.account;
    return this.serial(a.key, async () => {
      if (plan.expiresAt <= Date.now()) throw new Error('작업안이 만료되었습니다. 다시 검토하세요.');
      if (this.accounts.get(a.key) !== a || !a.writeAccess) throw new Error('계정 연결이 변경되었습니다. 다시 검토하세요.');
      const token = await this.token(a);
      await writes.verify(plan, a.provider === 'github', async route => (await this.get(a, token, route)).body);
      let result;
      try {
        result = await request(accountConfig(a).api + plan.route, { method: plan.method, headers: { Authorization: `Bearer ${token}`, Accept: 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'Branchline', ...(a.provider === 'github' ? { 'X-GitHub-Api-Version': '2022-11-28' } : {}) }, body: JSON.stringify(plan.body) });
      } catch (e) {
        if (e.status === 401) a.reconnect = true;
        // A dropped response can follow a successful POST. Never replay a consumed plan.
        throw new Error(e.status && e.status < 500 ? `원격 요청이 거절되었습니다 (HTTP ${e.status}). 권한·보호 규칙·SHA를 확인하고 결과를 새로 조회하세요. 자동 재시도하지 않았습니다.` : '요청 결과를 확인하지 못했습니다. 원격에 반영되었을 수 있으므로 제공자에서 결과를 확인하세요. 자동 재전송하지 않았습니다.');
      }
      const body = result.body;
      if (plan.action === 'create') {
        const github = a.provider === 'github', id = String((github ? body?.number : body?.iid) || '');
        let url = '';
        try { url = publicURL(github ? body?.html_url : body?.web_url, accountConfig(a).host); } catch { /* A missing link must not turn a successful POST into a retry. */ }
        return { id, url, message: id ? `${github ? 'PR #' : 'MR !'}${id} 생성 완료` : '생성 요청이 접수되었습니다. 프로젝트 현황에서 결과를 확인하세요.' };
      }
      const merged = plan.action === 'merge' && (a.provider === 'github' ? body.merged === true : body.state === 'merged');
      return { ...(plan.action === 'merge' && { merged }), message: plan.action === 'merge' ? merged ? '병합이 완료되었습니다.' : '병합 요청에 응답했지만 서버에서 완료를 확인하지 못했습니다.' : `${plan.label} 요청이 접수되었습니다. 최신 결과를 조회하세요.`, id: '' };
    });
  }
  async read(input) {
    const a = this.accounts.get(input.account); if (!a) throw new Error('연결된 계정을 선택하세요.');
    const gh = a.provider === 'github', config = accountConfig(a);
    const page = integer(input.page || 1); if (page > 10000) throw new Error('조회 페이지 범위를 초과했습니다.');
    const paging = `per_page=30&page=${page}`;
    const base = input.kind === 'projects' ? '' : `${gh ? '/repos/' : '/projects/'}${projectPath(input.project, gh)}`;
    let route, many = true, searchReviews = false;
    const warnings = [];
    switch (input.kind) {
      case 'projects': route = gh ? `/user/repos?sort=updated&${paging}` : `/projects?membership=true&order_by=last_activity_at&sort=desc&${paging}`; break;
      case 'project': route = base; many = false; break;
      case 'reviews': {
        if (input.ciFilter !== undefined && !['all', 'failed'].includes(input.ciFilter)) throw new Error('CI 검색 조건을 확인하세요.');
        if (!['open', 'closed', 'all'].includes(input.state)) throw new Error('리뷰 상태를 선택하세요.');
        const state = gh || input.state !== 'open' ? input.state : 'opened';
        const role = input.reviewRole || 'all', age = input.inactiveDays || 0, title = input.titleSearch || '';
        if (!['all', 'reviewer', 'assignee', 'author'].includes(role) || ![0, 7, 30].includes(age) || typeof title !== 'string' || title.length > 200 || /[\x00-\x1f\x7f\"\\]/.test(title)) throw new Error('리뷰 검색 조건을 확인하세요. 제목은 따옴표·역슬래시 없이 200자까지 입력하세요.');
        if (role !== 'all' && !/^[a-zA-Z0-9_.-]+$/.test(a.login)) throw new Error('연결 계정의 사용자 이름을 다시 확인하세요.');
        const cutoff = age ? new Date(Date.now() - age * 86400000).toISOString() : '';
        searchReviews = gh && (role !== 'all' || age !== 0 || title.trim() !== '');
        if (searchReviews) {
          if (page > 34) throw new Error('GitHub 검색은 최대 1,000개까지 조회할 수 있습니다. 조건을 좁혀 주세요.');
          const query = [`repo:${input.project}`, 'is:pr', ...(state === 'all' ? [] : [`is:${state}`]), ...(role === 'all' ? [] : [role === 'reviewer' ? 'user-review-requested:@me' : `${role}:${a.login}`]), ...(cutoff ? [`updated:<${cutoff}`] : []), ...(title.trim() ? [`"${title.trim()}" in:title`] : [])].join(' ');
          route = `/search/issues?${new URLSearchParams({ q: query, sort: 'updated', order: 'desc' })}&${paging}`;
        } else {
          const filters = new URLSearchParams();
          if (!gh) {
            filters.set('scope', 'all');
            if (role !== 'all') filters.set({ reviewer: 'reviewer_username', assignee: 'assignee_username[]', author: 'author_username' }[role], a.login);
            if (cutoff) filters.set('updated_before', cutoff);
            if (title.trim()) { filters.set('search', title.trim()); filters.set('in', 'title'); }
          }
          // GitLab closed excludes merged; use all when the user needs both closed and merged.
          route = `${base}/${gh ? 'pulls' : 'merge_requests'}?state=${state}&sort=${gh ? 'updated' : 'desc'}&${gh ? 'direction=desc' : 'order_by=updated_at'}&${paging}${filters.size ? `&${filters}` : ''}`;
        }
        break;
      }
      case 'review': route = `${base}/${gh ? 'pulls' : 'merge_requests'}/${integer(input.id)}`; many = false; break;
      case 'runs': route = `${base}/${gh ? 'actions/runs' : 'pipelines'}?${paging}`; break;
      case 'run': route = `${base}/${gh ? 'actions/runs' : 'pipelines'}/${integer(input.id)}`; many = false; break;
      case 'jobs': route = gh ? `${base}/actions/runs/${integer(input.id)}/attempts/${integer(input.attempt)}/jobs?${paging}` : `${base}/pipelines/${integer(input.id)}/jobs?include_retried=true&${paging}`; break;
      default: if (!reviews.kinds.includes(input.kind)) throw new Error('지원하지 않는 호스팅 조회입니다.');
    }
    let result;
    const token = await this.serial(input.account, async () => { if (this.accounts.get(input.account) !== a) throw new Error('계정 연결이 변경되었습니다. 다시 조회하세요.'); return this.token(a); });
    if (reviews.kinds.includes(input.kind)) return reviews.readResource(input, gh, base, async route => {
      let value;
      try { value = await this.get(a, token, route); } catch (e) { if (e.status === 401) a.reconnect = true; throw e; }
      if (this.accounts.get(input.account) !== a) throw new Error('계정 연결이 변경되었습니다. 다시 조회하세요.');
      return value;
    }, value => { try { return publicURL(value, config.host); } catch { return ''; } });
    try { result = await this.get(a, token, route); } catch (e) { if (e.status === 401) a.reconnect = true; throw e; }
    if (this.accounts.get(input.account) !== a) throw new Error('계정 연결이 변경되었습니다. 다시 조회하세요.');
    const { body, response } = result;
    let rows = searchReviews ? body.items : many ? gh && input.kind === 'runs' ? body.workflow_runs : gh && input.kind === 'jobs' ? body.jobs : body : [body];
    if (!Array.isArray(rows) || rows.length > 100) throw new Error('호스팅 목록 형식이 올바르지 않습니다.');
    if (searchReviews) {
      if (rows.length > 30 || !Number.isSafeInteger(body.total_count) || body.total_count < 0) throw new Error('GitHub 검색 결과 형식이 올바르지 않습니다.');
      if (body.incomplete_results) warnings.push('GitHub 검색이 일부 결과만 반환했습니다. 조건을 좁히거나 다시 조회하세요.');
      if (body.total_count > 1000) warnings.push('GitHub 검색은 최대 1,000개까지만 표시합니다. 검색 조건을 좁혀 주세요.');
      const details = [];
      // Search returns issue-shaped records; hydrate at most 30 PRs with five requests at a time.
      for (let i = 0; i < rows.length; i += 5) {
        const batch = await Promise.all(rows.slice(i, i + 5).map(async row => {
          if (!row.pull_request) throw new Error('Pull Request가 아닌 검색 결과입니다. 다시 조회하세요.');
          const detail = await this.get(a, token, `${base}/pulls/${integer(row.number)}`).catch(error => { if (error.status === 401) a.reconnect = true; throw error; });
          if (this.accounts.get(input.account) !== a) throw new Error('계정 연결이 변경되었습니다. 다시 조회하세요.');
          return detail.body;
        }));
        details.push(...batch);
      }
      rows = details;
    }
    const items = rows.map(row => {
      let url = ''; try { url = publicURL(row.html_url || row.web_url, config.host); } catch { /* missing links have no open action */ }
      const common = { url, date: string(row.updated_at || row.created_at), state: string(row.state || row.status) };
      if (['projects', 'project'].includes(input.kind)) return { ...common, id: string(gh ? row.full_name : row.path_with_namespace), title: string(gh ? row.full_name : row.path_with_namespace), subtitle: row.private || row.visibility === 'private' ? '비공개' : gh ? '공개' : string(row.visibility), body: string(row.description, 20000) };
      if (['reviews', 'review'].includes(input.kind)) return { ...common, version: reviews.snapshot(row, gh).version, id: String(gh ? row.number : row.iid), title: string(row.title), reviewers: (Array.isArray(gh ? row.requested_reviewers : row.reviewers) ? gh ? row.requested_reviewers : row.reviewers : []).map(user => string(gh ? user?.login : user?.username)).filter(Boolean), assignees: (Array.isArray(row.assignees) ? row.assignees : []).map(user => string(gh ? user?.login : user?.username)).filter(Boolean), subtitle: string(gh ? row.user?.login : row.author?.username), state: row.merged || row.merged_at ? 'merged' : common.state, draft: !!row.draft, sha: string(gh ? row.head?.sha : row.diff_refs?.head_sha || row.sha), baseSha: string(gh ? row.base?.sha : row.diff_refs?.base_sha), source: string(gh ? row.head?.label : row.source_branch), target: string(gh ? row.base?.label : row.target_branch), merge: string(gh ? row.mergeable_state : row.detailed_merge_status) || 'unknown', body: string(gh ? row.body : row.description, 20000), truncated: (gh ? row.body : row.description)?.length > 20000 };
      return { ...common, version: writes.runVersion(row, gh), id: String(row.id), title: string(row.display_title || row.name) || `Pipeline #${row.id}`, subtitle: string(row.stage), sha: string(row.head_sha || row.sha || row.commit?.id), source: string(row.head_branch || row.ref), event: string(row.event || row.source), conclusion: string(row.conclusion || row.failure_reason), attempt: Number.isSafeInteger(row.run_attempt) ? row.run_attempt : null, allowFailure: row.allow_failure === true };
    });
    if (items.some(item => !item.id || item.id === 'undefined' || !item.title)) throw new Error('항목 식별자 또는 제목이 없는 응답입니다. 제공자에서 확인하세요.');
    // Follow page numbers only, never provider-supplied URLs (which could leak an Authorization header).
    const nextHeader = response.headers.get('x-next-page');
    const link = response.headers.get('link');
    const hasMore = searchReviews ? page * 30 < Math.min(body.total_count, 1000) : many && (nextHeader !== null ? !!nextHeader : link !== null ? /rel="next"/.test(link) : rows.length === 30);
    let ciSummary;
    let visible = items;
    if (input.kind === 'reviews' && input.ciFilter === 'failed') {
      const states = [];
      for (let i = 0; i < items.length; i += 3) {
        states.push(...await Promise.all(items.slice(i, i + 3).map(item => reviews.ciFailure(item, gh, base, async route => {
          if (this.accounts.get(input.account) !== a) throw new Error('계정 연결이 변경되었습니다.');
          try { return await this.get(a, token, route); } catch (error) { if (error.status === 401) a.reconnect = true; throw error; }
        }).catch(() => 'unknown'))));
      }
      if (this.accounts.get(input.account) !== a) throw new Error('계정 연결이 변경되었습니다. 다시 조회하세요.');
      ciSummary = { inspected: items.length, unknown: states.filter(state => state === 'unknown').length };
      visible = items.filter((_, index) => states[index] === 'failed');
      if (ciSummary.unknown) warnings.push(`CI 미확인 ${ciSummary.unknown}개는 실패 목록에서 제외했습니다. 검사 미등록·권한/조회 오류·Head 변경·조회 한도 초과일 수 있습니다. 전체 CI로 전환해 상세를 확인하거나 새로고침하세요.`);
    }
    return { items: visible, hasMore, checkedAt: new Date().toISOString(), ...(ciSummary ? { ciSummary } : {}), ...(warnings.length ? { warnings } : {}) };
  }
}
module.exports = { Hosting, publicURL, projectPath };
