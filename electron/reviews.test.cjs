const test = require('node:test');
const assert = require('node:assert/strict');
const { Hosting, publicURL } = require('./hosting.cjs');
const { snapshot } = require('./reviews.cjs');
const head = 'a'.repeat(40), base = 'b'.repeat(40), merge = 'c'.repeat(40), old = 'd'.repeat(40);
const github = { number: 12, state: 'open', mergeable: true, merge_commit_sha: merge, head: { sha: head, ref: 'topic' }, base: { sha: base, ref: 'main' }, changed_files: 3001 };
const gitlab = { iid: 31, state: 'opened', sha: head, diff_refs: { head_sha: head, base_sha: base, start_sha: base }, source_branch: 'topic', target_branch: 'main' };
function fixture(t, gh) {
  const hosting = new Hosting('', {}), key = gh ? 'github:github.com:1' : 'gitlab:gitlab.com:2';
  hosting.accounts.set(key, { key, id: gh ? 1 : 2, provider: gh ? 'github' : 'gitlab', accessToken: 'fake-access', expiresAt: null });
  const original = global.fetch; t.after(() => { global.fetch = original; });
  return { hosting, query: { account: key, project: gh ? 'team/repo' : 'team/sub/repo', id: gh ? '12' : '31', version: snapshot(gh ? github : gitlab, gh).version, page: 1, target: 'head' } };
}
const json = (body, headers = {}, status = 200) => new Response(JSON.stringify(body), { status, headers });

test('review files pin the inspected version, preserve rename/missing/truncated patches and page limits', async t => {
  const { hosting, query } = fixture(t, true); let change = false, reads = 0, fileReads = 0;
  global.fetch = async url => {
    if (url.endsWith('/pulls/12')) { reads++; return json(change && reads % 2 === 0 ? { ...github, head: { ...github.head, sha: old } } : github); }
    fileReads++; assert.ok(url.includes('/pulls/12/files?per_page=30&page='));
    return json([{ filename: '새 이름.ts', previous_filename: 'old.ts', status: 'renamed', additions: 1, deletions: 1, patch: '@@ -1 +1 @@\n-old\n+new' }, { filename: 'image.png', status: 'added' }, { filename: 'large.txt', status: 'modified', patch: '+'.repeat(200001) }], { link: '<https://attacker.invalid>; rel="next"' });
  };
  const value = await hosting.read({ ...query, kind: 'review-files' });
  assert.equal(value.items[0].subtitle, 'old.ts'); assert.equal(value.items[1].unavailable, true); assert.equal(value.items[2].truncated, true); assert.equal(value.items[2].body.length, 200000); assert.equal(value.hasMore, true); assert.ok(value.warnings.some(w => w.includes('3001')));
  assert.equal((await hosting.read({ ...query, kind: 'review-files', page: 100, target: 'merge' })).hasMore, false, 'file reads must not use the previous checks target');
  const count = fileReads;
  await assert.rejects(hosting.read({ ...query, kind: 'review-files', version: '0'.repeat(64) }), /버전이 변경/); assert.equal(fileReads, count);
  change = true; reads = 0; await assert.rejects(hosting.read({ ...query, kind: 'review-files' }), /조회 중 리뷰 버전/);
});

test('GitHub comments, inline locations and review history retain commit attribution and safe anchors', async t => {
  const { hosting, query } = fixture(t, true);
  global.fetch = async url => url.endsWith('/pulls/12') ? json(github) : json([{ id: 9, user: { login: 'reviewer' }, state: 'APPROVED', body: '<script>text only</script>', commit_id: old, original_commit_id: old, path: 'src/app.ts', line: null, original_line: 7, in_reply_to_id: 8, html_url: 'https://github.com/team/repo/pull/12#discussion_r9' }]);
  for (const kind of ['review-comments', 'review-inline', 'review-approvals']) {
    const item = (await hosting.read({ ...query, kind })).items[0];
    assert.equal(item.sha, old); assert.equal(item.originalLine, 7); assert.equal(item.line, null); assert.equal(item.replyTo, '8'); assert.equal(item.relation, '다른 커밋의 기록'); assert.ok(item.url.endsWith('#discussion_r9'));
  }
  assert.throws(() => publicURL('https://github.com/team/repo#access_token=secret', 'github.com'));
});

test('Checks and Commit Status use exact head or verified merge parents; unavailable and stale merges fail closed', async t => {
  const { hosting, query } = fixture(t, true); let wrongParents = false;
  global.fetch = async url => {
    if (url.endsWith('/pulls/12')) return json(github);
    if (url.includes('/git/commits/')) return json({ parents: [{ sha: wrongParents ? old : head }, { sha: base }] });
    if (url.includes('/check-runs')) return json({ check_runs: [{ id: 3, name: 'unit', status: 'completed', conclusion: 'failure', head_sha: url.includes(merge) ? merge : head, app: { name: 'CI app' } }] });
    assert.ok(url.includes(`/commits/${head}/status`)); return json({ statuses: [{ id: 5, context: 'external/security', state: 'pending', target_url: 'https://ci.external.invalid/job/1' }] });
  };
  const check = (await hosting.read({ ...query, kind: 'review-checks' })).items[0]; assert.equal(check.sha, head); assert.equal(check.conclusion, 'failure');
  const synthetic = (await hosting.read({ ...query, kind: 'review-checks', target: 'merge' })).items[0]; assert.equal(synthetic.sha, merge); assert.match(synthetic.relation, /테스트 병합/);
  const status = (await hosting.read({ ...query, kind: 'review-statuses' })).items[0]; assert.equal(status.state, 'pending'); assert.equal(status.sha, head); assert.equal(status.url, '');
  wrongParents = true; await assert.rejects(hosting.read({ ...query, kind: 'review-checks', target: 'merge' }), /현재 Head·Base와 일치/);
  global.fetch = async () => json({ ...github, mergeable: null }); await assert.rejects(hosting.read({ ...query, kind: 'review-checks', target: 'merge' }), /테스트 병합 커밋을 확인/);
});

test('GitLab discussions, approval rules and associated pipelines keep unsupported or historical states separate', async t => {
  const { hosting, query } = fixture(t, false); let deny = false;
  global.fetch = async url => {
    assert.ok(url.startsWith('https://gitlab.com/api/v4/projects/team%2Fsub%2Frepo/'));
    if (url.endsWith('/merge_requests/31')) return json(gitlab);
    if (url.includes('/diffs?')) return json([{ new_path: 'app.ts', old_path: 'app.ts', collapsed: true, too_large: false, diff: '' }]);
    if (url.includes('/discussions?')) return json([{ id: 'thread-1', notes: [{ id: 1, body: '다시 확인해주세요', author: { username: 'dev' }, resolvable: true, resolved: false, position: { head_sha: old, new_path: 'app.ts', new_line: 4 } }] }], { 'x-next-page': '2' });
    if (url.endsWith('/approval_state')) return deny ? json({ message: 'secret' }, {}, 403) : json({ rules: [{ id: 3, name: 'Maintainers', approved: false, approvals_required: 2, approved_by: [{ name: 'Reviewer' }], contains_hidden_groups: true }] });
    return json([{ id: 8, sha: old, status: 'success', ref: 'refs/merge-requests/31/merge' }, { id: 9, sha: head, status: 'failed', ref: 'topic' }]);
  };
  assert.equal((await hosting.read({ ...query, kind: 'review-files' })).items[0].unavailable, true);
  const threads = await hosting.read({ ...query, kind: 'review-comments' }); assert.equal(threads.hasMore, true); assert.equal(threads.items[0].notes[0].state, 'unresolved');
  assert.equal((await hosting.read({ ...query, kind: 'review-approvals' })).items[0].state, 'approval_required');
  const runs = (await hosting.read({ ...query, kind: 'review-pipelines' })).items; assert.match(runs[0].relation, /확인 필요/); assert.match(runs[1].relation, /현재 Head/);
  deny = true; await assert.rejects(hosting.read({ ...query, kind: 'review-approvals' }), e => /조회 권한/.test(e.message) && !e.message.includes('secret'));
});

test('CI failure filter checks current Head, follows check pages, preserves source pagination and leaves unknowns visible in counts', async t => {
  const { hosting, query } = fixture(t, true);
  let mode = 'second-page', checkReads = 0;
  const review = { ...github, title: 'CI review' };
  global.fetch = async url => {
    if (url.includes('/pulls?')) return json([review], { link: '<https://untrusted.invalid>; rel="next"' });
    if (url.endsWith('/pulls/12')) return json(mode === 'stale' ? { ...review, head: { ...review.head, sha: old } } : review);
    if (url.includes('/check-runs?')) {
      checkReads++;
      assert.ok(url.includes('filter=latest'));
      if (mode === 'denied') return json({}, {}, 403);
      const page = Number(new URL(url).searchParams.get('page'));
      return json({ check_runs: mode === 'empty' ? [] : [{ id: 1, name: 'unit', head_sha: mode === 'old-sha' ? old : head, status: 'completed', conclusion: mode === 'cancel' ? 'cancelled' : mode === 'second-page' && page === 2 ? 'failure' : 'success' }] }, { link: mode === 'second-page' && page === 1 || mode === 'limit' ? '<https://untrusted.invalid>; rel="next"' : '' });
    }
    assert.ok(url.includes(`/commits/${head}/status?`));
    return json({ statuses: mode === 'status-failure' ? [{ id: 2, context: 'deploy', state: 'error' }] : [] });
  };
  const input = { ...query, kind: 'reviews', state: 'open', ciFilter: 'failed' };
  const failed = await hosting.read(input);
  assert.equal(failed.items.length, 1); assert.equal(checkReads, 2); assert.equal(failed.hasMore, true);
  assert.deepEqual(failed.ciSummary, { inspected: 1, unknown: 0 });
  for (mode of ['cancel', 'status-failure', 'denied', 'stale', 'empty', 'old-sha', 'limit']) {
    const result = await hosting.read(input);
    assert.equal(result.items.length, mode === 'status-failure' ? 1 : 0, mode);
    assert.equal(result.ciSummary.unknown, ['cancel', 'status-failure'].includes(mode) ? 0 : 1, mode);
    assert.equal(result.hasMore, true, 'An empty filtered page still has the next source page');
  }
  const before = checkReads;
  assert.equal((await hosting.read({ ...input, ciFilter: 'all' })).items.length, 1);
  assert.equal(checkReads, before, 'Default list performs no CI reads');
  await assert.rejects(hosting.read({ ...input, ciFilter: 'success' }), /CI 검색/);
});

test('GitLab CI failure filter uses MR head_pipeline and never counts older/merge-result pipeline failures', async t => {
  const { hosting, query } = fixture(t, false);
  let pipeline = { sha: head, status: 'failed' };
  global.fetch = async url => {
    if (url.includes('/merge_requests?')) return json([{ ...gitlab, diff_refs: undefined, title: 'MR CI' }], { 'x-next-page': '' });
    assert.ok(url.endsWith('/merge_requests/31'));
    return json({ ...gitlab, head_pipeline: pipeline });
  };
  const input = { ...query, kind: 'reviews', state: 'open', ciFilter: 'failed' };
  assert.equal((await hosting.read(input)).items.length, 1);
  for (pipeline of [{ sha: head, status: 'success' }, { sha: head, status: 'canceled' }, { sha: head, status: 'running' }, { sha: old, status: 'failed' }, null]) {
    const result = await hosting.read(input);
    assert.equal(result.items.length, 0);
    assert.equal(result.ciSummary.unknown, pipeline?.sha === head ? 0 : 1);
  }
});

test('review progress compares the full patch and invalidates opaque files when the review version changes', async t => {
  const { hosting, query } = fixture(t, true);
  let commit = head, tail = 'a';
  const review = () => ({ ...github, head: { ...github.head, sha: commit } });
  global.fetch = async url => url.endsWith('/pulls/12') ? json(review()) : json([
    { filename: 'large', patch: '+'.repeat(200000) + tail }, { filename: 'binary', sha: base },
  ]);
  const read = async () => (await hosting.read({ ...query, kind: 'review-files', version: snapshot(review(), true).version })).items;
  const a = await read(); commit = old;
  const b = await read(); tail = 'b';
  const c = await read();
  assert.equal(a[0].fingerprint, b[0].fingerprint);
  assert.notEqual(a[1].fingerprint, b[1].fingerprint);
  assert.equal(b[0].body, c[0].body);
  assert.notEqual(b[0].fingerprint, c[0].fingerprint);
});
