import { ToastMessage } from '../../design-system'
import { useState } from 'react'
import { Button, Checkbox, Disclosure, EmptyState, Notice, PageHeader, SettingsCard, TextArea } from '../../design-system'
import { compactPath } from '../../app/paths'
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
  return <section className="bl-settings"><PageHeader eyebrow="설정" title="외부 도구 연결" description="Claude Desktop 같은 MCP 클라이언트가 선택한 저장소를 읽을 수 있게 설정을 만듭니다. 읽기 전용이며 Git 쓰기는 제공하지 않습니다." />
    <SettingsCard title="접근을 허용할 저장소" description="설정을 외부 클라이언트에 등록하면 해당 도구가 선택한 저장소의 Git 데이터와 추적된 파일 내용을 읽을 수 있습니다.">
      <Disclosure title="읽을 수 있는 범위"><p>프로젝트·Git 상태·Worktree·충돌 목록·staged/커밋 diff를 읽습니다. OAuth·Agent 세션, 미추적 파일 내용과 Git 쓰기는 제공하지 않습니다.</p></Disclosure>
      {!repos.length ? <EmptyState decorated title="먼저 저장소를 열어 주세요">탭 옆 + 메뉴에서 저장소 열기를 선택한 뒤 이 화면으로 돌아오세요.</EmptyState> : <form noValidate onSubmit={e => { e.preventDefault(); void generate() }}><div className="bl-host-form">{repos.map(repo => <Checkbox key={repo.path} title={repo.path} label={`${repo.name} · ${compactPath(repo.path)}`} checked={selected.includes(repo.path)} disabled={busy} onChange={e => { setSelected(current => e.target.checked ? [...current, repo.path] : current.filter(p => p !== repo.path)); setConfig(''); setCopied(false); setError('') }} />)}</div>
        {error && (!selected.length ? <Notice tone="error">{error}</Notice> : <ToastMessage scope="MCP" tone="error" message={error} />)}<Button variant="primary" type="submit" loading={busy}>선택한 저장소의 MCP 설정 만들기</Button></form>}
    </SettingsCard>
    {config && <SettingsCard title="클라이언트에 등록" description="복사한 설정을 MCP 클라이언트의 설정 파일에 추가하세요."><div className="bl-actions"><Button disabled={busy} onClick={() => { setBusy(true); setError(''); setCopied(false); api.copyMcpConfig(selected).then(() => setCopied(true)).catch(reason => setError(reason.message)).finally(() => setBusy(false)) }}>MCP 설정 복사</Button><ToastMessage scope="MCP" tone="success" message={copied ? '설정을 복사했습니다.' : ''} /></div><TextArea label="MCP 설정 JSON" value={config} readOnly rows={16} spellCheck={false} className="bl-path resize-none" /><Notice>설정 생성만으로 외부 클라이언트에 연결되지 않습니다. 허용 범위를 바꾸거나 해제하려면 클라이언트 설정을 수정하고 MCP 서버를 다시 시작하세요. 앱의 저장소 탭을 닫아도 실행 중인 MCP 권한은 유지됩니다.</Notice></SettingsCard>}
  </section>
}
