const { createHash } = require('node:crypto');
const kinds = ['review-files', 'review-comments', 'review-inline', 'review-approvals', 'review-checks', 'review-statuses', 'review-pipelines'];
const text = (value, max = 4096) => typeof value === 'string' ? value.slice(0, max) : '';
const sha = value => typeof value === 'string' && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(value) ? value : '';
function snapshot(row, gh) {
  const head = sha(gh ? row.head?.sha : row.diff_refs?.head_sha || row.sha), base = sha(gh ? row.base?.sha : row.diff_refs?.base_sha);
  const start = sha(gh ? row.base?.sha : row.diff_refs?.start_sha);
  const source = gh ? row.head?.ref : row.source_branch, target = gh ? row.base?.ref : row.target_branch;
  const version = head && base ? createHash('sha256').update(JSON.stringify([head, base, start, source, target, gh ? row.head?.repo?.id : row.source_project_id, gh ? row.base?.repo?.id : row.target_project_id])).digest('hex') : '';
  return { head, base, start, version, merge: gh && row.state === 'open' && row.mergeable === true ? sha(row.merge_commit_sha) : '' };
}
function array(value) { if (!Array.isArray(value) || value.length > 100) throw new Error('리뷰 응답 형식 또는 크기가 지원 범위를 벗어났습니다. 제공자에서 확인하세요.'); return value; }
function more(response, length) { const next = response.headers.get('x-next-page'), link = response.headers.get('link'); return next !== null ? !!next : link !== null ? /rel="next"/.test(link) : length === 30; }
function body(value) { return { body: text(value, 20000), truncated: typeof value === 'string' && value.length > 20000 }; }
function note(row, gh, current) {
  if (!Number.isSafeInteger(row.id) || row.id < 1) throw new Error('댓글 식별자가 올바르지 않습니다.');
  const commit = sha(row.commit_id || row.position?.head_sha);
  return { id: String(row.id), title: text(gh ? row.user?.login : row.author?.username) || '작성자 미제공', subtitle: row.system ? '시스템 기록' : '', date: text(row.updated_at || row.created_at || row.submitted_at), state: row.resolvable ? row.resolved ? 'resolved' : 'unresolved' : '', ...body(row.body), sha: commit, originalSha: sha(row.original_commit_id), path: text(row.path || row.position?.new_path || row.position?.old_path), line: row.line ?? row.position?.new_line ?? row.position?.old_line ?? null, originalLine: row.original_line ?? null, side: text(row.side || row.position?.position_type), replyTo: row.in_reply_to_id ? String(row.in_reply_to_id) : '', relation: commit ? commit === current.head ? '현재 Head' : '다른 커밋의 기록' : '커밋 귀속 정보 없음', url: '' };
}

async function readResource(input, gh, base, get, link) {
  const id = Number(input.id), page = Number(input.page || 1);
  if (!Number.isSafeInteger(id) || id < 1 || typeof input.version !== 'string' || !/^[a-f0-9]{64}$/.test(input.version)) throw new Error('상세 새로고침으로 검토할 버전을 먼저 확인하세요.');
  const route = `${base}/${gh ? 'pulls' : 'merge_requests'}/${id}`;
  const before = (await get(route)).body, current = snapshot(before, gh);
  if (!current.version || current.version !== input.version) throw new Error('리뷰 버전이 변경되었습니다. 상세 새로고침 후 다시 확인하세요.');
  const paging = `per_page=30&page=${page}`;
  let endpoint, target = current.head;
  switch (input.kind) {
    case 'review-files': endpoint = `${route}/${gh ? 'files' : 'diffs'}?${paging}`; break;
    case 'review-comments': endpoint = gh ? `${base}/issues/${id}/comments?${paging}` : `${route}/discussions?${paging}`; break;
    case 'review-inline': if (!gh) throw new Error('GitLab 행 댓글은 대화에 포함됩니다.'); endpoint = `${route}/comments?${paging}`; break;
    case 'review-approvals': endpoint = gh ? `${route}/reviews?${paging}` : `${route}/approval_state`; break;
    case 'review-checks': case 'review-statuses': {
      if (!gh || !['head', 'merge'].includes(input.target)) throw new Error('GitHub 검사 대상을 선택하세요.');
      if (input.target === 'merge') {
        target = current.merge; if (!target) throw new Error('현재 테스트 병합 커밋을 확인할 수 없습니다. Head 검사를 조회하거나 제공자에서 확인하세요.');
        const parents = (await get(`${base}/git/commits/${target}`)).body.parents;
        if (!Array.isArray(parents) || parents.length !== 2 || ![current.head, current.base].every(value => parents.some(p => p.sha === value))) throw new Error('테스트 병합 커밋이 현재 Head·Base와 일치하지 않습니다. 상세를 새로고침하세요.');
      }
      endpoint = `${base}/commits/${target}/${input.kind === 'review-checks' ? 'check-runs?filter=latest&' : 'status?'}${paging}`; break;
    }
    case 'review-pipelines': if (gh) throw new Error('GitLab MR Pipeline 조회만 지원합니다.'); endpoint = `${route}/pipelines?${paging}`; break;
    default: throw new Error('지원하지 않는 리뷰 조회입니다.');
  }
  const { body: data, response } = await get(endpoint);
  const after = snapshot((await get(route)).body, gh);
  if (after.version !== current.version || ['review-checks', 'review-statuses'].includes(input.kind) && input.target === 'merge' && after.merge !== target) throw new Error('조회 중 리뷰 버전이 변경되었습니다. 상세 새로고침 후 다시 확인하세요.');
  const rows = array(input.kind === 'review-checks' ? data.check_runs : input.kind === 'review-statuses' ? data.statuses : !gh && input.kind === 'review-approvals' ? data.rules : data);
  const warnings = [];
  let items;
  if (input.kind === 'review-files') {
    warnings.push(gh ? 'GitHub 파일 API는 최대 3,000개를 제공합니다. patch는 제공자 미리보기이며 일부 내용이 생략될 수 있습니다.' : 'GitLab diff 제한·접힌 파일·대형 파일은 전체 내용을 제공하지 않을 수 있습니다.');
    if (gh && Number.isFinite(before.changed_files) && before.changed_files > 3000) warnings.push(`전체 ${before.changed_files}개 중 API 조회 상한은 3,000개입니다. 나머지는 로컬 비교 또는 제공자에서 확인하세요.`);
    items = rows.map(row => {
      const patch = gh ? row.patch : row.diff, name = text(gh ? row.filename : row.new_path || row.old_path);
      return { id: name, title: name, subtitle: text(gh ? row.previous_filename : row.old_path), state: gh ? text(row.status) : row.deleted_file ? 'removed' : row.new_file ? 'added' : row.renamed_file ? 'renamed' : 'modified', url: '', date: '', body: text(patch, 200000), truncated: typeof patch === 'string' && patch.length > 200000, unavailable: !patch || !!row.too_large || !!row.collapsed, additions: Number.isSafeInteger(row.additions) ? row.additions : null, deletions: Number.isSafeInteger(row.deletions) ? row.deletions : null, generated: !!row.generated_file, sha: current.head };
    });
  } else if (input.kind === 'review-comments' || input.kind === 'review-inline') {
    items = rows.map(row => {
      if (gh) return { ...note(row, true, current), url: link(row.html_url) };
      if (!Array.isArray(row.notes)) throw new Error('대화의 댓글 형식이 올바르지 않습니다.');
      if (row.notes.length > 100) warnings.push('한 대화의 댓글은 앞 100개까지 표시합니다. 전체 대화는 제공자에서 확인하세요.');
      return { id: text(row.id), title: `대화 ${text(row.id, 12)}`, subtitle: row.individual_note ? '일반 댓글' : '리뷰 대화', state: '', url: '', date: text(row.notes[0]?.created_at), notes: row.notes.slice(0, 100).map(n => note(n, false, current)) };
    });
  } else if (input.kind === 'review-approvals') {
    warnings.push(gh ? '페이지별 리뷰 이력입니다. 이전 커밋의 승인·철회 기록을 현재 승인 수로 합산하지 않습니다.' : '서버가 반환한 승인 규칙입니다. 승인 충족만으로 최종 병합 가능 여부를 판단하지 않습니다.');
    items = rows.map(row => gh ? { ...note(row, true, current), state: text(row.state), date: text(row.submitted_at), url: link(row.html_url) } : { id: String(row.id), title: text(row.name), subtitle: text(row.rule_type), state: row.approved === true ? 'approved' : row.approved === false ? 'approval_required' : 'unknown', date: '', url: '', body: `필요 승인: ${Number.isSafeInteger(row.approvals_required) ? row.approvals_required : '미제공'} · 승인자: ${array(row.approved_by || []).map(u => text(u.name || u.username)).join(', ') || '제공된 승인자 없음'}${row.contains_hidden_groups ? '\n숨겨진 그룹이 있는 규칙입니다.' : ''}` });
  } else {
    warnings.push('조회된 검사를 모두 필수 검사로 간주하지 않습니다. 필수 규칙·merge queue·최종 병합 판정은 제공자에서 확인하세요.');
    items = rows.map(row => ({ id: String(row.id), title: text(row.name || row.context) || `Pipeline #${row.id}`, subtitle: text(row.app?.name || row.creator?.login), state: text(row.status || row.state), conclusion: text(row.conclusion), date: text(row.completed_at || row.updated_at || row.created_at), url: link(row.html_url || row.web_url || row.target_url), sha: sha(row.head_sha || row.sha) || (gh ? target : ''), source: text(row.ref), relation: gh ? input.target === 'merge' ? '현재 Head·Base의 테스트 병합 커밋' : '현재 Head' : row.sha === current.head ? '현재 Head · MR에 연결됨' : 'MR에 연결됨 · 현재 변경과의 관계 확인 필요', body: text(row.description, 20000) }));
  }
  if (items.some(item => !item.id || item.id === 'undefined' || !item.title)) throw new Error('리뷰 항목의 식별자가 올바르지 않습니다.');
  return { items, hasMore: !(!gh && input.kind === 'review-approvals') && more(response, rows.length) && !(gh && input.kind === 'review-files' && page >= 100), warnings: [...new Set(warnings)], version: current.version, head: current.head, base: current.base, checkedAt: new Date().toISOString() };
}
async function ciFailure(item, gh, base, get) {
  const id = Number(item.id);
  if (!Number.isSafeInteger(id) || id < 1) return 'unknown';
  if (!gh) {
    const row = (await get(`${base}/merge_requests/${id}`)).body, current = snapshot(row, false);
    // MR list responses may omit diff_refs; the detail response owns the Head/pipeline pairing.
    if (!current.head || item.sha && current.head !== item.sha || item.version && current.version !== item.version || row.head_pipeline?.sha !== current.head) return 'unknown';
    return row.head_pipeline.status === 'failed' ? 'failed' : row.head_pipeline.status ? 'other' : 'unknown';
  }
  if (!item.version || !sha(item.sha)) return 'unknown';
  let seen = false, incomplete = false;
  for (const kind of ['review-checks', 'review-statuses']) {
    // ponytail: at most 300 entries per resource; mark a larger result unknown instead of scanning without a bound.
    for (let page = 1; page <= 10; page++) {
      const result = await readResource({ id: item.id, version: item.version, kind, target: 'head', page }, true, base, get, () => '');
      const current = result.items.filter(check => check.sha === item.sha);
      if (current.some(check => ['failure', 'failed', 'error', 'timed_out', 'startup_failure'].includes(check.conclusion || check.state))) return 'failed';
      seen ||= current.length > 0;
      if (!result.hasMore) break;
      if (page === 10) incomplete = true;
    }
  }
  return !seen || incomplete ? 'unknown' : 'other';
}
module.exports = { kinds, snapshot, readResource, ciFailure };
