const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { Hosting, publicURL, projectPath } = require('./hosting.cjs');
const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'branchline-hosting-'));
  const originalFetch = global.fetch, originalNow = Date.now;
  let clock = originalNow(); Date.now = () => clock;
  t.after(async () => { global.fetch = originalFetch; Date.now = originalNow; await fs.rm(root, { recursive: true, force: true }); });
  const key = crypto.randomBytes(32);
  const storage = { isEncryptionAvailable: () => true, getSelectedStorageBackend: () => 'keychain', encryptString: value => { const iv = crypto.randomBytes(12), cipher = crypto.createCipheriv('aes-256-gcm', key, iv); return Buffer.concat([iv, cipher.update(value), cipher.final(), cipher.getAuthTag()]); }, decryptString: data => { const cipher = crypto.createDecipheriv('aes-256-gcm', key, data.subarray(0, 12)); cipher.setAuthTag(data.subarray(-16)); return Buffer.concat([cipher.update(data.subarray(12, -16)), cipher.final()]).toString(); } };
  const file = path.join(root, 'hosting.enc');
  const hosting = new Hosting(file, storage); await hosting.load();
  const advance = time => { clock = time; };
  return { hosting, file, storage, advance };
}
function device(provider = 'github') { return { device_code: 'device-secret', user_code: 'ABCD-1234', verification_uri: provider === 'github' ? 'https://github.com/login/device' : 'https://gitlab.com/oauth/device', expires_in: 900, interval: 5 }; }
function access(extra = {}) { return { access_token: 'access-secret', token_type: 'bearer', scope: 'read:user', ...extra }; }

test('device approval, rate pacing, cancellation, account identity, encrypted persistence and deletion', async t => {
  const { hosting, file, storage, advance } = await fixture(t);
  const calls = []; let polls = 0;
  global.fetch = async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/device/code')) { assert.equal(options.body.get('scope'), 'read:user repo'); return json(device()); }
    if (url.endsWith('/access_token')) { assert.equal(options.body.get('device_code'), 'device-secret'); assert.equal(options.body.has('client_secret'), false); polls++; return json(polls === 1 ? { error: 'authorization_pending' } : polls === 2 ? { error: 'slow_down', interval: 10 } : access()); }
    assert.equal(url, 'https://api.github.com/user'); assert.equal(options.headers.Authorization, 'Bearer access-secret'); return json({ id: 7, login: 'developer', email: 'not-forwarded', private_data: 'not-forwarded' });
  };
  const started = await hosting.start({ provider: 'github', clientId: 'test_client', persistent: true, privateRepos: true });
  assert.equal(JSON.stringify(started).includes('device-secret'), false);
  assert.equal(hosting.verification(started.id), 'https://github.com/login/device');
  await assert.rejects(hosting.start({ provider: 'github', clientId: 'other_client', persistent: false, privateRepos: false }), /현재 승인/);
  await hosting.poll(started.id); assert.equal(polls, 0);
  advance(started.nextAt); const waiting = await hosting.poll(started.id); assert.equal(waiting.pending, true);
  advance(waiting.nextAt); const slow = await hosting.poll(started.id); assert.equal(slow.nextAt - Date.now(), 10000);
  await hosting.poll(started.id); assert.equal(polls, 2);
  advance(slow.nextAt); const completed = await hosting.poll(started.id); assert.equal(completed.account, 'github:github.com:7');
  const exposed = JSON.stringify(hosting.list()); assert.equal(/secret|private_data|not-forwarded/.test(exposed), false);
  const encrypted = await fs.readFile(file); assert.equal(encrypted.includes('access-secret'), false);
  const restored = new Hosting(file, storage); await restored.load(); assert.equal(restored.list().accounts[0].login, 'developer');
  await restored.forget(completed.account); await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  const second = await hosting.start({ provider: 'github', clientId: 'test_client', persistent: false, privateRepos: true }); hosting.cancel(second.id); await assert.rejects(hosting.poll(second.id), /취소/);
  assert.ok(calls.every(c => c.options.redirect === 'error'));
  storage.getSelectedStorageBackend = () => 'basic_text';
  await assert.rejects(hosting.start({ provider: 'github', clientId: 'test_client', persistent: true, privateRepos: true }), /보안 저장소/);
  assert.throws(() => publicURL('https://github.com@attacker.invalid/login/device', 'github.com'));
  assert.throws(() => publicURL('https://github.com/path?access_token=secret', 'github.com'));
  assert.throws(() => projectPath('owner/../repo', true));
});

test('device rejection, expiry, redirected verification and in-flight cancellation never connect', async t => {
  const { hosting, advance, file } = await fixture(t);
  global.fetch = async () => json({ ...device(), verification_uri: 'https://attacker.invalid/login/device' });
  const input = { provider: 'github', clientId: 'test_client', persistent: false, privateRepos: false };
  await assert.rejects(hosting.start(input), /호스팅 주소/);
  global.fetch = async url => json(url.endsWith('/device/code') ? device() : { error: 'access_denied', error_description: 'access-secret' });
  let started = await hosting.start(input); advance(started.nextAt); await assert.rejects(hosting.poll(started.id), /승인이 거절/); assert.equal(hosting.list().accounts.length, 0);
  started = await hosting.start(input); advance(started.expiresAt); await assert.rejects(hosting.poll(started.id), /만료/);
  started = await hosting.start(input); advance(started.nextAt);
  let release; global.fetch = () => new Promise(resolve => { release = resolve; });
  const inFlight = hosting.poll(started.id); hosting.cancel(started.id); release(json(access())); await assert.rejects(inFlight, /취소/);
  assert.equal(hosting.list().accounts.length, 0); await assert.rejects(fs.stat(file), { code: 'ENOENT' });
  await fs.writeFile(file, 'unreadable'); await hosting.load(); assert.match(hosting.list().warning, /복원하지 못/);
  await assert.rejects(hosting.start({ ...input, persistent: true }), /보안 저장소/);
});

test('GitHub read pagination, PR versions, run attempts, rate limits and allowlisted read routes', async t => {
  const { hosting, advance } = await fixture(t);
  global.fetch = async url => json(url.endsWith('/device/code') ? device() : url.endsWith('/access_token') ? access() : { id: 1, login: 'pm' });
  const started = await hosting.start({ provider: 'github', clientId: 'test_client', persistent: false, privateRepos: false }); advance(started.nextAt); const { account } = await hosting.poll(started.id);
  const seen = [];
  global.fetch = async (url, options) => {
    seen.push(url); assert.equal(options.method, undefined); assert.equal(options.headers.Authorization, 'Bearer access-secret');
    if (url.includes('/user/repos')) return json(Array.from({ length: 30 }, (_, i) => ({ full_name: `team/repo-${i}`, private: true, html_url: `https://github.com/team/repo-${i}` })), 200, { link: '<https://attacker.invalid/?token=secret>; rel="next"' });
    if (url.includes('/pulls/12')) return json({ number: 12, title: 'Review me', state: 'open', mergeable_state: 'unknown', head: { sha: 'a'.repeat(40), label: 'fork:feature' }, base: { sha: 'b'.repeat(40), label: 'team:main' }, user: { login: 'dev' }, body: '<script>unsafe</script>', html_url: 'https://github.com/team/repo/pull/12' });
    if (url.includes('/attempts/2/jobs')) return json({ jobs: [{ id: 4, name: 'test', status: 'completed', conclusion: 'failure', html_url: 'https://github.com/team/repo/actions/runs/3/job/4' }] });
    if (url.endsWith('/actions/runs/3')) return json({ id: 3, name: 'CI', status: 'completed', conclusion: 'failure', run_attempt: 2, head_sha: 'c'.repeat(40), head_branch: 'feature', event: 'pull_request' });
    if (url.includes('/actions/runs?')) return json({ message: 'secret response must not escape' }, 403, { 'x-ratelimit-remaining': '0', 'retry-after': '60' });
    return json({ message: 'access-secret' }, 404);
  };
  const first = await hosting.read({ account, kind: 'projects', page: 1 }); assert.equal(first.items.length, 30); assert.equal(first.hasMore, true);
  await hosting.read({ account, kind: 'projects', page: 2 }); assert.ok(seen[1].endsWith('page=2')); assert.ok(seen.every(url => url.startsWith('https://api.github.com/')));
  const pr = (await hosting.read({ account, kind: 'review', project: 'team/repo', id: '12' })).items[0]; assert.equal(pr.sha, 'a'.repeat(40)); assert.equal(pr.baseSha, 'b'.repeat(40)); assert.equal(pr.merge, 'unknown');
  const run = (await hosting.read({ account, kind: 'run', project: 'team/repo', id: '3' })).items[0]; assert.equal(run.attempt, 2); assert.equal(run.state, 'completed'); assert.equal(run.conclusion, 'failure'); assert.notEqual(run.sha, pr.sha);
  const jobs = await hosting.read({ account, kind: 'jobs', project: 'team/repo', id: '3', attempt: run.attempt }); assert.equal(jobs.items[0].title, 'test');
  await assert.rejects(hosting.read({ account, kind: 'runs', project: 'team/repo' }), /60초 이후/);
  await assert.rejects(hosting.read({ account, kind: 'project', project: 'team/missing' }), e => /접근 권한/.test(e.message) && !e.message.includes('secret'));
  await assert.rejects(hosting.read({ account, kind: 'delete', project: 'team/repo' }), /지원하지/);
  await assert.rejects(hosting.read({ account, kind: 'reviews', project: 'team/repo', state: 'open&evil=true' }), /리뷰 상태/);
  let release, ready; const requested = new Promise(resolve => { ready = resolve; });
  global.fetch = () => new Promise(resolve => { release = resolve; ready(); });
  const stale = hosting.read({ account, kind: 'projects' }); await requested;
  await hosting.forget(account); release(json([{ full_name: 'team/repo' }]));
  await assert.rejects(stale, /계정 연결이 변경/);
});

test('GitLab device grant, subgroup paths, serialized refresh rotation and account separation', async t => {
  const { hosting, advance, file, storage } = await fixture(t);
  let refreshes = 0, uid = 9;
  global.fetch = async (url, options) => {
    if (url.endsWith('/authorize_device')) { assert.equal(options.body.get('scope'), 'read_user read_api'); return json(device('gitlab')); }
    if (url.endsWith('/oauth/token')) {
      if (options.body.get('grant_type') === 'refresh_token') { refreshes++; assert.equal(options.body.get('refresh_token'), 'refresh-secret'); return json(access({ access_token: 'rotated-secret', refresh_token: 'next-refresh-secret', expires_in: 7200, scope: 'read_user read_api' })); }
      return json(access({ refresh_token: 'refresh-secret', expires_in: 120, scope: 'read_user read_api' }));
    }
    if (url.endsWith('/user')) return json({ id: uid, username: `pm${uid}` });
    assert.equal(options.headers.Authorization, 'Bearer rotated-secret');
    assert.ok(url.startsWith('https://gitlab.com/api/v4/projects/group%2Fsub%2Frepo/'));
    if (url.includes('/merge_requests?')) { assert.ok(url.includes('state=opened')); return json([{ iid: 31, title: 'MR', state: 'opened', sha: 'd'.repeat(40), detailed_merge_status: 'checking', author: { username: 'writer' }, source_branch: 'topic', target_branch: 'main' }], 200, { 'x-next-page': '' }); }
    if (url.includes('/pipelines?')) return json([{ id: 8, status: 'success', sha: 'e'.repeat(40), ref: 'refs/merge-requests/31/merge' }], 200, { 'x-next-page': '2' });
    if (url.includes('/pipelines/8/jobs')) return json([{ id: 20, name: 'optional', status: 'failed', allow_failure: true }]);
    throw new Error('unexpected route');
  };
  const input = { provider: 'gitlab', clientId: 'test_client', persistent: true, privateRepos: false };
  const started = await hosting.start(input); advance(started.nextAt); const { account } = await hosting.poll(started.id); advance(Date.now() + 65000);
  const [reviews, runs] = await Promise.all([hosting.read({ account, kind: 'reviews', project: 'group/sub/repo', state: 'open' }), hosting.read({ account, kind: 'runs', project: 'group/sub/repo' })]);
  assert.equal(refreshes, 1); assert.equal(reviews.hasMore, false); assert.equal(runs.hasMore, true); assert.notEqual(reviews.items[0].sha, runs.items[0].sha);
  const jobs = await hosting.read({ account, kind: 'jobs', project: 'group/sub/repo', id: '8' }); assert.equal(jobs.items[0].allowFailure, true);
  const restored = new Hosting(file, storage); await restored.load(); assert.equal(restored.accounts.get(account).refreshToken, 'next-refresh-secret');
  uid = 10; const other = await hosting.start(input); advance(other.nextAt); const connected = await hosting.poll(other.id); assert.notEqual(account, connected.account); assert.equal(hosting.list().accounts.length, 2);
  global.fetch = async () => json({ message: 'secret' }, 401);
  await assert.rejects(hosting.read({ account, kind: 'projects' }), /다시 연결/); assert.equal(hosting.list().accounts.find(a => a.key === account).reconnect, true);
  assert.equal(hosting.list().accounts.find(a => a.key === connected.account).reconnect, false);
  advance(Date.now() + 65000);
  global.fetch = async url => url.endsWith('/oauth/token') ? json(access({ access_token: 'mismatched-secret', expires_in: 7200 })) : json({ id: 999, username: 'unexpected' });
  await assert.rejects(hosting.read({ account: connected.account, kind: 'projects' }), /계정이 다릅니다/);
  await assert.rejects(hosting.read({ account: connected.account, kind: 'projects' }), /다시 연결/);
});

test('remote writes use immutable single-use plans, SHA guards, scopes and no retry after uncertain responses', async t => {
  const { hosting, advance } = await fixture(t);
  const head = 'a'.repeat(40), base = 'b'.repeat(40);
  let currentHead = head, attempt = 1, status = 'completed', fail = false, posts = [];
  const account = { key: 'github:github.com:1', provider: 'github', id: 1, login: 'pm', accessToken: 'fixture-secret', writeAccess: true };
  hosting.accounts.set(account.key, account);
  global.fetch = async (url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer fixture-secret');
    if (options.method) {
      posts.push({ url, method: options.method, body: JSON.parse(options.body) });
      if (fail) throw new Error('fixture-secret timeout');
      if (url.endsWith('/merge')) return json({ merged: true });
      return url.endsWith('/rerun') || url.endsWith('/cancel') ? new Response(null, { status: 202 }) : json({ number: 14, id: 15 });
    }
    if (url.includes('/branches/')) return json({ name: decodeURIComponent(url.split('/branches/')[1]), commit: { sha: url.endsWith('main') ? base : currentHead } });
    if (url.endsWith('/actions/runs/9')) return json({ id: 9, head_sha: head, run_attempt: attempt, status });
    return json({ number: 12, title: 'Review', state: 'open', head: { sha: currentHead, ref: 'topic', label: 'pm:topic' }, base: { sha: base, ref: 'main', label: 'pm:main' } });
  };
  const query = { account: account.key, project: 'team/repo', id: '12' };
  const review = async () => (await hosting.read({ ...query, kind: 'review' })).items[0];
  const input = { ...query, action: 'merge', version: (await review()).version, method: 'squash' };
  let plan = await hosting.prepareWrite(input);
  assert.equal(JSON.stringify(plan).includes('fixture-secret'), false);
  currentHead = 'c'.repeat(40);
  await assert.rejects(hosting.executeWrite(plan.id), /원격 상태가 변경/); assert.equal(posts.length, 0);
  await assert.rejects(hosting.prepareWrite(input), /버전이 변경/);
  currentHead = head; plan = await hosting.prepareWrite(input);
  assert.match((await hosting.executeWrite(plan.id)).message, /병합이 완료/);
  assert.deepEqual(posts.at(-1).body, { sha: head, merge_method: 'squash' });
  await assert.rejects(hosting.executeWrite(plan.id), /이미 사용/);
  for (const action of ['comment', 'approve', 'request-changes']) {
    plan = await hosting.prepareWrite({ ...input, action, body: '한글 의견' });
    await hosting.executeWrite(plan.id);
    assert.equal(posts.at(-1).body.body, '한글 의견');
    if (action !== 'comment') assert.equal(posts.at(-1).body.commit_id, head);
  }
  const create = { account: account.key, project: 'team/repo', action: 'create', title: '탭 복원', body: '설명', source: 'feature/tabs', target: 'main', draft: true };
  await assert.rejects(hosting.prepareWrite({ ...create, sourceSha: 'f'.repeat(40), targetSha: base }), /원격 SHA/);
  await assert.rejects(hosting.prepareWrite({ ...create, sourceSha: currentHead, targetSha: 'f'.repeat(40) }), /원격 SHA/);
  plan = await hosting.prepareWrite({ ...create, sourceSha: currentHead, targetSha: base }); await hosting.executeWrite(plan.id);
  assert.deepEqual(posts.at(-1).body, { title: '탭 복원', body: '설명', head: 'feature/tabs', base: 'main', draft: true });
  await assert.rejects(hosting.prepareWrite({ ...create, source: '../main' }), /브랜치/);
  plan = await hosting.prepareWrite(create); advance(plan.expiresAt); await assert.rejects(hosting.executeWrite(plan.id), /만료/);
  const run = async () => (await hosting.read({ ...query, id: '9', kind: 'run' })).items[0];
  plan = await hosting.prepareWrite({ ...query, id: '9', action: 'rerun', version: (await run()).version });
  attempt++; await assert.rejects(hosting.executeWrite(plan.id), /상태가 변경/);
  plan = await hosting.prepareWrite({ ...query, id: '9', action: 'rerun', version: (await run()).version }); await hosting.executeWrite(plan.id);
  assert.ok(posts.at(-1).url.endsWith('/rerun'));
  status = 'in_progress'; plan = await hosting.prepareWrite({ ...query, id: '9', action: 'cancel', version: (await run()).version }); await hosting.executeWrite(plan.id);
  assert.ok(posts.at(-1).url.endsWith('/cancel'));
  plan = await hosting.prepareWrite({ ...input, action: 'comment', body: '한 번만 게시' }); fail = true;
  const count = posts.length;
  await assert.rejects(hosting.executeWrite(plan.id), e => /반영되었을 수/.test(e.message) && !e.message.includes('secret'));
  await assert.rejects(hosting.executeWrite(plan.id), /이미 사용/); assert.equal(posts.length, count + 1);
  fail = false; plan = await hosting.prepareWrite(input); await hosting.forget(account.key); await assert.rejects(hosting.executeWrite(plan.id), /만료|이미 사용/);
  account.writeAccess = false; hosting.accounts.set(account.key, account); await assert.rejects(hosting.prepareWrite(input), /원격 쓰기/);
});

test('GitLab write opt-in, subgroup routes and review/CI provider semantics', async t => {
  const { hosting, advance } = await fixture(t);
  const head = 'd'.repeat(40), base = 'b'.repeat(40), posts = [];
  let state = 'opened', ci = 'failed';
  global.fetch = async (url, options) => {
    if (url.endsWith('/authorize_device')) { assert.equal(options.body.get('scope'), 'read_user api'); return json(device('gitlab')); }
    if (url.endsWith('/oauth/token')) return json(access({ scope: 'api read_user' }));
    if (url.endsWith('/user')) return json({ id: 2, username: 'pm' });
    assert.ok(url.startsWith('https://gitlab.com/api/v4/projects/group%2Fsub%2Frepo/'));
    if (options.method) { posts.push({ url, body: JSON.parse(options.body) }); return json({ iid: 31, state: 'merged' }); }
    if (url.includes('/repository/branches/')) return json({ name: decodeURIComponent(url.split('/branches/')[1]), commit: { id: head } });
    if (url.includes('/pipelines/')) return json({ id: 8, sha: head, status: ci, updated_at: '2026-09-14' });
    if (url.includes('/versions?')) return json([{ id: 4, head_commit_sha: head, patch_id_sha: base }]);
    return json({ iid: 31, title: 'Review', state, sha: head, diff_refs: { head_sha: head, base_sha: base, start_sha: base }, source_branch: 'topic', target_branch: 'main', detailed_merge_status: 'mergeable' });
  };
  const deviceFlow = await hosting.start({ provider: 'gitlab', clientId: 'fixture_client', privateRepos: false, persistent: false, writeAccess: true }); advance(deviceFlow.nextAt);
  const { account } = await hosting.poll(deviceFlow.id); assert.equal(hosting.list().accounts[0].writeAccess, true);
  const query = { account, project: 'group/sub/repo', id: '31' };
  const version = (await hosting.read({ ...query, kind: 'review' })).items[0].version;
  for (const action of ['approve', 'merge', 'comment']) {
    const plan = await hosting.prepareWrite({ ...query, version, action, method: 'project', body: action === 'comment' ? '의견' : '' }); await hosting.executeWrite(plan.id);
    assert.deepEqual(posts.at(-1).body, action === 'approve' ? { sha: head } : action === 'merge' ? { sha: head, should_remove_source_branch: false } : { body: '의견' });
  }
  const plan = await hosting.prepareWrite({ ...query, version, action: 'approve' }); state = 'closed'; await assert.rejects(hosting.executeWrite(plan.id), /상태가 변경/);
  state = 'opened'; await assert.rejects(hosting.prepareWrite({ ...query, version, action: 'request-changes', body: '수정' }), /제공자에서/);
  let next = await hosting.prepareWrite({ account, project: query.project, action: 'create', title: '제목', body: '', source: 'topic', target: 'main', draft: true }); await hosting.executeWrite(next.id);
  assert.equal(posts.at(-1).body.title, 'Draft: 제목');
  for (const action of ['rerun', 'cancel']) {
    ci = action === 'rerun' ? 'failed' : 'running';
    const run = (await hosting.read({ ...query, id: '8', kind: 'run' })).items[0];
    next = await hosting.prepareWrite({ ...query, id: '8', version: run.version, action }); await hosting.executeWrite(next.id);
    assert.ok(posts.at(-1).url.endsWith(action === 'rerun' ? '/retry' : '/cancel'));
  }
});

test('public login defaults reuse only approved accounts and separate provider and credential state', async t => {
  const { hosting, file, storage, advance } = await fixture(t)
  assert.deepEqual(hosting.defaults(), { github: '', gitlab: '' })
  assert.deepEqual(hosting.defaults(null, { github: 'bundled_app', gitlab: 'invalid\nclient' }), { github: 'bundled_app', gitlab: '' })
  global.fetch = async url => json(url.endsWith('/device/code') ? device() : url.endsWith('/access_token') ? access() : { id: 7, login: 'developer' })
  const input = { provider: 'github', clientId: 'approved_app', persistent: true, privateRepos: false }
  let pending = await hosting.start(input)
  assert.equal(hosting.defaults().github, '', 'Pending or canceled apps must not become automatic defaults')
  hosting.cancel(pending.id); assert.equal(hosting.defaults().github, '')
  pending = await hosting.start(input); advance(pending.nextAt); await hosting.poll(pending.id)
  assert.deepEqual(hosting.defaults(), { github: 'approved_app', gitlab: '' })
  assert.deepEqual(hosting.defaults({ github: 'chosen_app' }, { github: 'bundled_app', gitlab: 'gitlab_app' }), { github: 'chosen_app', gitlab: 'gitlab_app' })
  assert.equal(/secret|accessToken|refreshToken|deviceCode/.test(JSON.stringify(hosting.defaults())), false)
  const restored = new Hosting(file, storage); await restored.load()
  assert.equal(restored.defaults().github, 'approved_app', 'Previously connected accounts migrate without entering a client ID')
  await restored.forget('github:github.com:7')
  assert.equal(restored.defaults({ github: 'approved_app' }).github, 'approved_app', 'Remembered public IDs can outlive an account without retaining its token')
})

test('self-managed GitLab PAT stays bound to its HTTPS origin, survives encrypted storage and handles expiry', async t => {
  const { hosting, file, storage } = await fixture(t);
  const input = { origin: 'https://gitlab.company.test:8443', token: 'fixture-pat-secret', persistent: true, writeAccess: false };
  const calls = []; let expired = false;
  global.fetch = async (url, options) => {
    calls.push(url); assert.equal(new URL(url).origin, input.origin); assert.equal(options.redirect, 'error');
    assert.equal(options.headers.Authorization, 'Bearer fixture-pat-secret');
    if (expired) return json({ message: input.token }, 401);
    if (url.endsWith('/user')) return json({ id: 42, username: 'engineer' });
    if (url.includes('/merge_requests?')) return json([{ iid: 5, title: '회사 MR', state: 'opened', web_url: input.origin + '/team/sub/project/-/merge_requests/5' }]);
    return json({ path_with_namespace: 'team/sub/project', visibility: 'private', web_url: input.origin + '/team/sub/project' });
  };
  for (const origin of ['http://company.test', 'https://user:secret@company.test', 'https://company.test/api/v4', 'https://company.test?token=secret']) await assert.rejects(hosting.connectPat({ ...input, origin }));
  await assert.rejects(hosting.connectPat({ ...input, token: 'bad\nheader' }));
  assert.equal(calls.length, 0);
  const { account } = await hosting.connectPat(input);
  assert.equal(account, 'gitlab:gitlab.company.test:8443:42');
  assert.equal(JSON.stringify(hosting.list()).includes(input.token), false);
  assert.equal((await fs.readFile(file)).includes(input.token), false);
  const restored = new Hosting(file, storage); await restored.load();
  assert.equal(restored.list().accounts[0].host, 'gitlab.company.test:8443');
  const project = await restored.read({ account, kind: 'project', project: 'team/sub/project' });
  assert.equal(project.items[0].url, input.origin + '/team/sub/project');
  const mrs = await restored.read({ account, kind: 'reviews', project: 'team/sub/project', state: 'open', page: 1 });
  assert.equal(mrs.items[0].id, '5'); assert.match(calls.at(-1), /projects\/team%2Fsub%2Fproject\/merge_requests/);
  await assert.rejects(restored.prepareWrite({ account, action: 'create', project: 'team/sub/project' }), /쓰기/);
  expired = true;
  await assert.rejects(restored.read({ account, kind: 'project', project: 'team/sub/project' }), /인증이 만료/);
  assert.equal(restored.list().accounts[0].reconnect, true);
  await assert.rejects(hosting.connectPat(input), /인증이 만료/);
  assert.equal(hosting.list().accounts.length, 1);
  await restored.forget(account); await assert.rejects(fs.stat(file), { code: 'ENOENT' });
});

test('review filters use server queries, scoped PR hydration, pagination limits and guarded search inputs', async t => {
  const { hosting, advance } = await fixture(t);
  global.fetch = async url => json(url.endsWith('/device/code') ? device() : url.endsWith('/access_token') ? access() : { id: 1, login: 'pm' });
  const start = await hosting.start({ provider: 'github', clientId: 'test_client', persistent: false, privateRepos: false }); advance(start.nextAt); const { account } = await hosting.poll(start.id);
  const calls = []; let incomplete = false;
  global.fetch = async url => {
    calls.push(url); const u = new URL(url);
    if (u.pathname === '/search/issues') {
      const q = u.searchParams.get('q'); assert.match(q, /^repo:team\/repo is:pr is:open user-review-requested:@me updated:</); assert.match(q, /"수집 오류" in:title$/);
      assert.equal(u.searchParams.get('sort'), 'updated');
      return json({ total_count: 1100, incomplete_results: incomplete, items: [{ number: 42, pull_request: { url: 'https://attacker.invalid/never-follow' } }] });
    }
    assert.equal(u.pathname, '/repos/team/repo/pulls/42');
    return json({ number: 42, title: '수집 오류 수정', user: { login: 'author' }, requested_reviewers: [{ login: 'pm' }], head: { label: 'feature/fix', sha: 'a'.repeat(40) }, base: { label: 'main', sha: 'b'.repeat(40) } });
  };
  const query = { account, kind: 'reviews', project: 'team/repo', state: 'open', reviewRole: 'reviewer', inactiveDays: 7, titleSearch: '수집 오류', page: 2 };
  const result = await hosting.read(query); assert.equal(result.items[0].source, 'feature/fix'); assert.deepEqual(result.items[0].reviewers, ['pm']); assert.equal(result.hasMore, true); assert.match(result.warnings[0], /1,000/); assert.match(calls[0], /page=2/);
  incomplete = true; const last = await hosting.read({ ...query, page: 34 }); assert.equal(last.hasMore, false); assert.ok(last.warnings.some(w => /일부 결과/.test(w)));
  const before = calls.length;
  for (const patch of [{ titleSearch: '" OR repo:other/private' }, { inactiveDays: -1 }, { reviewRole: 'admin' }, { titleSearch: {} }, { page: 35 }]) await assert.rejects(hosting.read({ ...query, ...patch }), /검색/);
  assert.equal(calls.length, before);
  await hosting.forget(account);
  hosting.accounts.set('company', { provider: 'gitlab', host: 'gitlab.company.test', origin: 'https://gitlab.company.test', authMode: 'pat', login: 'manager', accessToken: 'fixture-only', expiresAt: null });
  global.fetch = async url => {
    const u = new URL(url); assert.equal(u.pathname, '/api/v4/projects/team%2Fsub%2Frepo/merge_requests');
    assert.equal(u.searchParams.get('scope'), 'all'); assert.equal(u.searchParams.get('assignee_username[]'), 'manager'); assert.equal(u.searchParams.get('search'), '한글 & 조건'); assert.equal(u.searchParams.get('in'), 'title'); assert.ok(u.searchParams.get('updated_before')); assert.equal(u.searchParams.get('page'), '2');
    return json([{ iid: 5, title: '한글 & 조건' }], 200, { 'x-next-page': '' });
  };
  const mr = await hosting.read({ account: 'company', kind: 'reviews', project: 'team/sub/repo', state: 'all', reviewRole: 'assignee', inactiveDays: 30, titleSearch: '한글 & 조건', page: 2 });
  assert.equal(mr.items[0].id, '5'); assert.equal(mr.hasMore, false);
});
