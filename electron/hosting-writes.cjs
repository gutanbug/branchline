const { createHash } = require('node:crypto');
const { snapshot } = require('./reviews.cjs');
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value);
function text(value, label, max, empty = false) {
  if (typeof value !== 'string' || value.length > max || /\0/.test(value) || !empty && !value.trim()) throw new Error(`${label} 입력을 확인하세요.`);
  return value;
}
function branch(value) {
  text(value, '브랜치', 255);
  if (/^[.-]|[\s~^:?*\[\\\x00-\x1f\x7f]|\.\.|@\{|\/$|\.$|\.lock(?:\/|$)|\/\//.test(value) || value.split('/').some(part => part.startsWith('.')) || value === '@') throw new Error('브랜치 이름을 확인하세요. 같은 프로젝트의 원격 브랜치를 입력하세요.');
  return value;
}
function runVersion(row, gh) { return sha(gh ? row.head_sha : row.sha) && (!gh || Number.isSafeInteger(row.run_attempt) && row.run_attempt > 0) ? hash([row.id, gh ? row.head_sha : row.sha, row.status, row.conclusion, row.run_attempt, row.updated_at, row.head_branch, row.ref]) : ''; }
const labels = { create: 'PR/MR 생성', comment: '댓글 게시', approve: '리뷰 승인', 'request-changes': '변경 요청', merge: '병합', rerun: 'CI 재실행', cancel: 'CI 취소' };

// All routes and request bodies are constructed here; renderer cannot supply an HTTP request.
async function prepare(input, gh, base, get) {
  if (!Object.hasOwn(labels, input.action)) throw new Error('지원하지 않는 원격 작업입니다.');
  const action = input.action, plan = { action, label: labels[action], method: 'POST', body: {}, checks: [], facts: [] };
  if (action === 'create') {
    const title = text(input.title, '제목', 255).trim(), body = text(input.body || '', '본문', 20000, true);
    const source = branch(input.source), target = branch(input.target);
    if (source === target || typeof input.draft !== 'boolean') throw new Error('서로 다른 출발·대상 브랜치와 초안 여부를 확인하세요.');
    for (const [name, label] of [[source, '출발'], [target, '대상']]) {
      const route = `${base}/${gh ? 'branches' : 'repository/branches'}/${encodeURIComponent(name)}`;
      const row = await get(route), value = gh ? row.commit?.sha : row.commit?.id;
      if (!sha(value) || row.name !== name) throw new Error('원격 브랜치 SHA를 확인하지 못했습니다.');
      const expected = name === source ? input.sourceSha : input.targetSha;
      if (expected !== undefined && (!sha(expected) || expected !== value)) throw new Error(`${label} 브랜치의 원격 SHA가 비교한 버전과 다릅니다. Push/Fetch 후 다시 비교하세요.`);
      plan.checks.push({ route, kind: 'branch', value }); plan.facts.push({ label, value: `${name} · ${value}` });
    }
    plan.route = `${base}/${gh ? 'pulls' : 'merge_requests'}`;
    plan.body = gh ? { title, body, head: source, base: target, draft: input.draft } : { title: input.draft && !/^Draft:/i.test(title) ? `Draft: ${title}` : title, description: body, source_branch: source, target_branch: target, remove_source_branch: false };
    plan.facts.push({ label: '제목', value: plan.body.title }, { label: '초안', value: input.draft ? '예' : '아니요' }); plan.text = body;
    return plan;
  }
  if (!/^[1-9]\d{0,14}$/.test(String(input.id)) || !sha(input.version)) throw new Error('최신 상세 정보를 먼저 조회하세요.');
  const run = action === 'rerun' || action === 'cancel';
  const route = `${base}/${run ? gh ? 'actions/runs' : 'pipelines' : gh ? 'pulls' : 'merge_requests'}/${input.id}`;
  const row = await get(route), version = run ? runVersion(row, gh) : snapshot(row, gh).version;
  if (!version || input.version !== version) throw new Error('검토한 버전이 변경되었습니다. 상세 새로고침 후 다시 검토하세요.');
  const head = run ? gh ? row.head_sha : row.sha : snapshot(row, gh).head;
  plan.checks.push({ route, kind: run ? 'run' : 'review', value: run ? version : hash([version, row.state, row.draft, row.updated_at, row.detailed_merge_status]) });
  plan.facts.push({ label: '항목', value: `#${input.id}` }, { label: 'Head SHA', value: head });
  if (run) {
    if (action === 'rerun' && !(gh ? row.status === 'completed' : ['failed', 'canceled'].includes(row.status))) throw new Error('완료된 GitHub 실행 또는 실패·취소된 GitLab 실행만 재실행할 수 있습니다.');
    if (action === 'cancel' && !(gh ? ['queued', 'in_progress', 'waiting', 'pending', 'requested'].includes(row.status) : ['created', 'pending', 'running', 'preparing', 'waiting_for_resource', 'scheduled'].includes(row.status))) throw new Error('대기·진행 중인 실행만 취소할 수 있습니다.');
    plan.route = `${route}/${action === 'rerun' ? gh ? 'rerun' : 'retry' : 'cancel'}`;
    plan.facts.push({ label: '실행 상태', value: row.status }, { label: '회차', value: gh ? String(row.run_attempt) : '실패·취소 작업 재시도' });
    return plan;
  }
  if (!(gh ? row.state === 'open' : row.state === 'opened') || row.merged || row.merged_at) throw new Error('열린 PR/MR에서만 작업할 수 있습니다.');
  if (action !== 'comment' && row.draft) throw new Error('초안의 승인·변경 요청·병합은 제공자에서 준비 상태로 전환한 뒤 진행하세요.');
  plan.facts.push({ label: '브랜치', value: gh ? `${row.head?.label || row.head?.ref} → ${row.base?.label || row.base?.ref}` : `${row.source_branch} → ${row.target_branch}` });
  if (action === 'merge') {
    if (!gh && input.method !== 'project' || gh && !['merge', 'squash', 'rebase'].includes(input.method)) throw new Error('병합 방식을 선택하세요.');
    plan.route = `${route}/merge`; plan.method = 'PUT';
    plan.body = gh ? { sha: head, merge_method: input.method } : { sha: head, should_remove_source_branch: false };
    plan.facts.push({ label: '병합 방식', value: gh ? input.method : '프로젝트 설정' });
  } else if (action === 'comment') {
    plan.text = text(input.body, '댓글', 20000);
    plan.route = gh ? `${base}/issues/${input.id}/comments` : `${route}/notes`; plan.body = { body: plan.text };
  } else {
    if (!gh && action === 'request-changes') throw new Error('GitLab 변경 요청은 제공자에서 진행하세요.');
    if (!gh && ['checking', 'approvals_syncing'].includes(row.detailed_merge_status)) throw new Error('GitLab이 변경 내용을 확인 중입니다. 상세 새로고침 후 승인하세요.');
    if (!gh) {
      const route = `${base}/merge_requests/${input.id}/versions?per_page=1&page=1`, versions = await get(route), version = Array.isArray(versions) && versions[0];
      if (!version || version.head_commit_sha !== head || !sha(version.patch_id_sha)) throw new Error('GitLab 변경 내용 처리가 끝나지 않았습니다. 최신 diff가 준비된 뒤 다시 승인하세요.');
      plan.checks.push({ route, kind: 'approval-diff', value: hash([version.id, version.head_commit_sha, version.patch_id_sha]) });
    }
    plan.text = text(input.body || '', '리뷰 의견', 20000, action === 'approve');
    if (!gh && plan.text) throw new Error('GitLab 승인 의견은 별도 댓글로 게시하세요.');
    plan.route = `${route}/${gh ? 'reviews' : 'approve'}`;
    plan.body = gh ? { commit_id: head, event: action === 'approve' ? 'APPROVE' : 'REQUEST_CHANGES', body: plan.text } : { sha: head };
  }
  return plan;
}
async function verify(plan, gh, get) {
  for (const check of plan.checks) {
    const row = await get(check.route);
    const value = check.kind === 'approval-diff' ? hash([row[0]?.id, row[0]?.head_commit_sha, row[0]?.patch_id_sha]) : check.kind === 'branch' ? gh ? row.commit?.sha : row.commit?.id : check.kind === 'run' ? runVersion(row, gh) : hash([snapshot(row, gh).version, row.state, row.draft, row.updated_at, row.detailed_merge_status]);
    if (value !== check.value) throw new Error('확인창을 연 뒤 원격 상태가 변경되었습니다. 다시 조회하고 검토하세요.');
  }
}
module.exports = { prepare, verify, runVersion };
