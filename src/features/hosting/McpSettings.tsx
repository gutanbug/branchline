import { useState } from 'react'
import { Button, Checkbox, EmptyState, Notice, TextArea } from '../../design-system'
import type { DesktopAPI, Repository } from '../../app/types'

export function McpSettings({ api, repos }: { api: DesktopAPI; repos: Repository[] }) {
  const [selected, setSelected] = useState<string[]>([]), [config, setConfig] = useState(''), [copied, setCopied] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false)
  async function generate() {
    if (busy) return
    setError(''); setConfig(''); setCopied(false)
    if (!selected.length) { setError('외부 도구에 읽기를 허용할 저장소를 선택하세요.'); return }
    setBusy(true)
    try { setConfig(JSON.stringify(await api.mcpConfig(selected), null, 2)) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="bl-settings"><div className="bl-page-heading"><span className="bl-kicker">INTEGRATIONS / MCP</span><h1>외부 도구 연결</h1><p>MCP를 지원하는 클라이언트에서 선택한 로컬 저장소를 조회하세요.</p></div>
    <Notice>읽기 범위: 프로젝트 목록·Git 상태·worktree 목록·충돌 파일 목록·staged/커밋 diff. OAuth·Agent 세션, 미추적 파일 내용과 Git 쓰기는 제공하지 않습니다.</Notice>
    <section className="bl-sync-section"><h2>접근을 허용할 저장소</h2><p>설정을 외부 클라이언트에 등록하면 해당 도구가 선택한 저장소의 Git 데이터와 추적된 파일 내용을 읽을 수 있습니다.</p>
      {!repos.length ? <EmptyState title="먼저 저장소를 열어 주세요">상단 저장소 열기를 사용한 뒤 이 화면으로 돌아오세요.</EmptyState> : <form noValidate onSubmit={e => { e.preventDefault(); void generate() }}><div className="bl-host-form">{repos.map(repo => <Checkbox key={repo.path} label={`${repo.name} · ${repo.path}`} checked={selected.includes(repo.path)} disabled={busy} onChange={e => { setSelected(current => e.target.checked ? [...current, repo.path] : current.filter(p => p !== repo.path)); setConfig(''); setCopied(false); setError('') }} />)}</div>
        {error && <Notice tone="error">{error}</Notice>}<Button variant="primary" type="submit" loading={busy}>선택한 저장소의 MCP 설정 만들기</Button></form>}
    </section>
    {config && <section className="bl-sync-section"><h2>클라이언트에 등록</h2><p>아래 JSON은 mcpServers 형식의 예시입니다. 사용 중인 클라이언트의 stdio MCP 설정에 command·args·env를 등록하세요. 경로에 공백이 있어도 args 배열을 그대로 사용합니다.</p><div className="bl-actions"><Button disabled={busy} onClick={() => { setBusy(true); setError(''); api.copyMcpConfig(selected).then(() => setCopied(true)).catch(reason => setError(reason.message)).finally(() => setBusy(false)) }}>MCP 설정 복사</Button>{copied && <Notice>설정을 복사했습니다.</Notice>}</div><TextArea label="MCP 설정 JSON" value={config} readOnly rows={16} spellCheck={false} className="bl-path resize-none" /><Notice>설정 생성만으로 외부 클라이언트에 연결되지 않습니다. 허용 범위를 바꾸거나 해제하려면 클라이언트 설정을 수정하고 MCP 서버를 다시 시작하세요. 앱의 저장소 탭을 닫아도 실행 중인 MCP 권한은 유지됩니다.</Notice></section>}
  </section>
}
