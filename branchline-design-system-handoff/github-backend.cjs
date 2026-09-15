'use strict';

function parseGithubRemote(url) {
  if (!url) return null;
  const patterns = [
    /^https?:\/\/(?:[^@/]+@)?github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?\/?$/,
    /^git@github\.com:([^/]+)\/([^/.]+?)(?:\.git)?$/,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/.]+?)(?:\.git)?$/
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return { owner: m[1], repo: m[2] };
  }
  return null;
}

function classifyError(status, body) {
  if (status === 401) return '인증 실패: 토큰이 없거나 만료되었습니다.';
  if (status === 403) {
    if (/rate limit/i.test(body)) return 'GitHub API 요청 한도를 초과했습니다. 잠시 후 다시 시도하거나 토큰을 등록해 한도를 늘리세요.';
    return '권한이 없습니다. 저장소 접근 권한이 있는 토큰인지 확인하세요.';
  }
  if (status === 404) return '저장소 또는 리소스를 찾을 수 없습니다. 비공개 저장소라면 접근 권한이 있는 토큰이 필요합니다.';
  if (status === 422) return '요청이 거부되었습니다: ' + body;
  return `GitHub API 오류 (${status}): ${body}`;
}

async function githubRequest(method, path, token, body) {
  let res;
  try {
    res = await fetch(`https://api.github.com${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'branchline-prototype',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/json' } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    });
  } catch (error) {
    throw new Error('네트워크 오류로 GitHub에 연결할 수 없습니다: ' + error.message);
  }
  const text = await res.text();
  if (!res.ok) throw new Error(classifyError(res.status, text));
  return text ? JSON.parse(text) : null;
}

async function listPullRequests(owner, repo, token, state = 'open') {
  const data = await githubRequest('GET', `/repos/${owner}/${repo}/pulls?state=${state}&per_page=30`, token);
  return data.map(pr => ({
    number: pr.number,
    title: pr.title,
    author: pr.user?.login || '',
    state: pr.state,
    draft: !!pr.draft,
    merged: !!pr.merged_at,
    head: pr.head?.ref,
    base: pr.base?.ref,
    url: pr.html_url,
    updatedAt: pr.updated_at
  }));
}

async function createPullRequest(owner, repo, token, { title, head, base, body, draft }) {
  if (!token) throw new Error('PR을 생성하려면 GitHub Personal Access Token이 필요합니다.');
  const pr = await githubRequest('POST', `/repos/${owner}/${repo}/pulls`, token, { title, head, base, body, draft: !!draft });
  return { number: pr.number, url: pr.html_url, title: pr.title };
}

async function mergePullRequest(owner, repo, token, number, mergeMethod) {
  if (!token) throw new Error('병합하려면 GitHub Personal Access Token이 필요합니다.');
  const result = await githubRequest('PUT', `/repos/${owner}/${repo}/pulls/${number}/merge`, token, { merge_method: mergeMethod || 'merge' });
  return { merged: !!result.merged, message: result.message };
}

module.exports = { parseGithubRemote, listPullRequests, createPullRequest, mergePullRequest };
