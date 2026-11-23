import { useEffect, useState } from 'react'
import { Badge, Button, Notice, UsageMeter } from '../../design-system/components'
import type { Agent, AgentId, DesktopAPI, Usage } from '../../app/types'
import { PageHeader, SettingsCard } from '../../design-system'

export function AgentSettings({ api, defaultAgent, onDefault }: { api: DesktopAPI; defaultAgent: AgentId; onDefault: (id: AgentId) => void }) {
  const [revision, setRevision] = useState(0)
  const [agents, setAgents] = useState<Agent[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  useEffect(() => { let live = true; api.agents().then(value => { if (live) setAgents(value) }).catch(e => { if (live) setError(e.message) }); return () => { live = false } }, [api, revision])
  async function run(id: string, task: () => Promise<void>) { setBusy(id); setError(''); try { await task() } catch (e) { setError((e as Error).message) } finally { setBusy('') } }
  return <section className="bl-settings"><PageHeader eyebrow="설정" title="AI Agents" description="이 컴퓨터에 설치된 Agent CLI를 충돌 해결 대화와 커밋 수정에 사용합니다. 사용하기를 켠 Agent만 실행됩니다." />
    {error && <Notice tone="error">{error}<Button disabled={!!busy} onClick={() => { setError(''); setRevision(value => value + 1) }}>Agent 다시 조회</Button></Notice>}
    {!agents.length && !error && <Notice>설치된 Agent를 확인하고 있습니다…</Notice>}
    <div className="bl-agent-list">{agents.map(agent => <SettingsCard key={agent.id} title={agent.name} description={agent.version ? '설치 확인됨' : '실행 파일 확인 필요'} aside={<div className="bl-agent-toggle"><Badge>{agent.enabled ? '사용 중' : '사용 안 함'}</Badge><Button variant={agent.enabled ? 'secondary' : 'primary'} aria-label={`${agent.name} ${agent.enabled ? '사용 중지' : '사용하기'}`} disabled={!!busy} onClick={() => { const enabled = !agent.enabled; if (agent.id === 'codex') setUsage(null); const previous = agents; setAgents(current => current.map(a => a.id === agent.id ? { ...a, enabled } : a)); void run(agent.id, async () => { try { setAgents(await api.setAgent(agent.id, enabled)) } catch (e) { setAgents(previous); throw e } }) }}>{agent.enabled ? '사용 중지' : '사용하기'}</Button></div>}>
      <dl className="bl-facts"><dt>버전</dt><dd>{agent.version || '확인되지 않음'}</dd><dt>실행 경로</dt><dd>{agent.path ? <code>{agent.path}</code> : <span className="bl-muted">설치된 실행 파일을 선택하세요.</span>}</dd><dt>로그인</dt><dd>{agent.id === 'codex' && usage ? '현재 계정 조회 완료' : '확인되지 않음 · 선택한 CLI에서 로그인'}</dd><dt>실행 상태</dt><dd>요청 시 실행</dd><dt>계정 잔여량</dt><dd>{agent.id === 'codex' ? 'ChatGPT 로그인 사용 시 공식 한도 조회' : '자동 조회 미지원 · 공식 CLI에서 확인'}</dd></dl>
      {agent.error && <p>{agent.error}</p>}
      <div className="bl-actions"><Button disabled={!!busy} onClick={() => void run(agent.id, async () => { setUsage(null); setAgents(await api.agentPath(agent.id)) })}>실행 파일 선택</Button><Button disabled={!!busy || !agent.enabled || defaultAgent === agent.id} onClick={() => void run(agent.id, async () => onDefault(await api.defaultAgent(agent.id)))}>{defaultAgent === agent.id && agent.enabled ? '기본 Agent' : '기본으로 설정'}</Button>{agent.id === 'codex' && <Button loading={busy === 'usage'} disabled={!!busy || !agent.enabled || !agent.version} onClick={() => void run('usage', async () => { setUsage(null); setUsage(await api.usage('codex')) })}>사용량 새로고침</Button>}</div>
      {agent.id === 'codex' && agent.enabled && usage && <div className="bl-quota"><p>{usage.account.email || '현재 Codex 계정'} · {usage.account.plan || '플랜 미제공'}</p>{usage.windows.length ? usage.windows.map(w => <div key={w.id}><div className="bl-row-between"><strong>{w.name} · {w.windowMinutes ? `${w.windowMinutes}분 한도` : '기간 미제공'}</strong><span>남음 {w.remainingPercent.toFixed(0)}% · 사용 {w.usedPercent.toFixed(0)}%</span></div><UsageMeter value={w.remainingPercent} label={`${w.name} 남은 사용량`} /><small>초기화 {w.resetsAt ? new Date(w.resetsAt * 1000).toLocaleString('ko-KR') : '시각 미제공'}</small></div>) : <p>계정 한도 수치가 제공되지 않았습니다.</p>}<small>확인 {new Date(usage.checkedAt).toLocaleString('ko-KR')} · 다른 앱과 공유하는 계정 한도입니다.</small></div>}
    </SettingsCard>)}</div>
  </section>
}
