import { useEffect, useRef, useState } from 'react'
import { Button, Checkbox, Dialog, Notice, SelectField, TextField } from '../../design-system'
import type { DesktopAPI, HostAccounts, HostDevice } from '../../app/types'

export function AccountConnections({ api, accounts, onChange }: { api: DesktopAPI; accounts: HostAccounts; onChange: (value: HostAccounts, selected?: string) => void }) {
  const dialog = useRef<HTMLDialogElement>(null), forgetDialog = useRef<HTMLDialogElement>(null), clientInput = useRef<HTMLInputElement>(null)
  const pending = useRef<string | null>(null)
  const [method, setMethod] = useState('oauth'), [origin, setOrigin] = useState('https://gitlab.com'), [pat, setPat] = useState('')
  const [provider, setProvider] = useState<'github' | 'gitlab'>('github')
  const [defaults, setDefaults] = useState({ github: '', gitlab: '' }), [custom, setCustom] = useState(false)
  const [defaultsBusy, setDefaultsBusy] = useState(true), [defaultsError, setDefaultsError] = useState(''), [defaultsWarning, setDefaultsWarning] = useState('')
  const [revision, setRevision] = useState(0)
  const [clientId, setClientId] = useState(''), [privateRepos, setPrivateRepos] = useState(false), [persistent, setPersistent] = useState(false), [writeAccess, setWriteAccess] = useState(false)
  const [device, setDevice] = useState<HostDevice | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState(''), [fieldError, setFieldError] = useState(''), [message, setMessage] = useState('')
  const [forget, setForget] = useState(''), [forgetError, setForgetError] = useState('')
  useEffect(() => {
    let live = true
    const task = api.hostingDefaults ? api.hostingDefaults() : Promise.resolve({ github: '', gitlab: '', warning: '' })
    task.then(value => { if (live) { setDefaults(value); setDefaultsError(''); setDefaultsWarning(value.warning || '') } }).catch(e => { if (live) setDefaultsError(e.message) }).finally(() => { if (live) setDefaultsBusy(false) })
    return () => { live = false }
  }, [api, revision])
  function reloadDefaults() { setDefaultsBusy(true); setDefaultsError(''); setRevision(value => value + 1) }

  useEffect(() => () => { if (pending.current) void api.hostingCancel(pending.current).catch(() => {}) }, [api])
  useEffect(() => {
    if (!device) return
    let live = true
    const timer = window.setTimeout(async () => {
      try {
        const result = await api.hostingPoll(device.id)
        if (!live) return
        if (result.pending) setDevice({ ...device, nextAt: result.nextAt! })
        else {
          const next = await api.hostingAccounts()
          if (!live) return
          pending.current = null; setDevice(null)
          onChange(next, result.account); reloadDefaults(); setCustom(false); setClientId(''); setMessage(result.warning || '계정이 연결되었습니다. 현재 저장소의 프로젝트를 조회합니다.'); dialog.current?.close()
        }
      } catch (e) { if (live) { pending.current = null; setDevice(null); setError((e as Error).message) } }
    }, Math.max(0, Math.min(device.nextAt, device.expiresAt) - Date.now()))
    return () => { live = false; window.clearTimeout(timer) }
  }, [api, device, onChange])
  async function start() {
    if (busy || method === 'oauth' && defaultsBusy || device) return
    if (provider === 'gitlab' && method === 'pat') {
      setBusy(true); setError('')
      const token = pat; setPat('')
      try { const result = await api.hostingPat({ origin: origin.trim(), token, persistent, writeAccess }); onChange(await api.hostingAccounts(), result.account); setMessage('GitLab PAT 계정이 연결되었습니다.'); dialog.current?.close() } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
      return
    }
    setError(''); setFieldError(''); setMessage('')
    const publicId = !defaultsError && defaults[provider] && !custom ? defaults[provider] : clientId.trim()
    if (!/^[a-zA-Z0-9_-]{5,256}$/.test(publicId)) { setFieldError('등록된 공개 Client ID를 입력하세요.'); clientInput.current?.focus(); return }
    setBusy(true)
    try { const result = await api.hostingStart({ provider, clientId: publicId, persistent, privateRepos, writeAccess }); pending.current = result.id; setDevice(result) } catch (e) { setError((e as Error).message) } finally { setBusy(false) }
  }
  async function cancel() {
    if (!device) return
    try { await api.hostingCancel(device.id); pending.current = null; setDevice(null); setMessage('연결 요청을 취소했습니다.'); dialog.current?.close() } catch (e) { setError((e as Error).message) }
  }
  async function disconnect() {
    setBusy(true); setForgetError('')
    try { onChange(await api.hostingForget(forget)); setMessage('Branchline 계정 연결을 해제했습니다.'); forgetDialog.current?.close() } catch (e) { setForgetError((e as Error).message) } finally { setBusy(false) }
  }
  return <section className="bl-sync-section" aria-label="호스팅 계정">
    <div className="bl-row-between"><h2>호스팅 계정</h2><div className="bl-actions"><Button disabled={busy} onClick={() => { void api.hostingAccounts().then(value => onChange(value)).catch(e => setMessage(e.message)) }}>계정 상태 새로고침</Button><Button disabled={busy} onClick={() => { setError(''); setFieldError(''); reloadDefaults(); dialog.current?.showModal() }}>계정 연결</Button></div></div>
    <p className="bl-muted">GitHub · GitLab · 회사 GitLab / 호스팅 API 계정을 연결합니다.</p>
    {accounts.warning && <Notice tone="error">{accounts.warning}</Notice>}
    {message && <Notice>{message}</Notice>}
    {accounts.accounts.map(a => <article className="bl-host-account" key={a.key}><div><strong>{a.host} / {a.login}</strong><p>{a.persistent ? 'OS 암호화 저장' : '이번 앱 세션에서만 사용'}{a.reconnect ? ' · 재연결 필요' : ''}</p><small>승인 권한: {a.scope} · 앱 원격 쓰기 {a.writeAccess ? '허용' : '비활성'}</small>{a.expiresAt && <small>토큰 만료: {new Date(a.expiresAt).toLocaleString('ko-KR')} · 갱신 가능 여부에 따라 자동 갱신 또는 재연결</small>}</div><Button aria-label={`${a.host} ${a.login} 연결 해제`} onClick={() => { setForget(a.key); setForgetError(''); forgetDialog.current?.showModal() }}>연결 해제</Button></article>)}
    <Dialog dialogRef={dialog} title="호스팅 계정 연결" onClose={() => setPat('')} busy={busy || !!device}>
      {error && <Notice tone="error">{error}</Notice>}
      {device ? <div className="bl-host-device"><Notice>시스템 브라우저에서 아래 코드를 확인하고 승인하세요. 승인 결과를 기다리고 있습니다.</Notice><TextField label="승인 코드" value={device.userCode} readOnly /><p className="bl-path">{device.url}</p><p>만료 {new Date(device.expiresAt).toLocaleTimeString('ko-KR')}</p><div className="bl-actions"><Button variant="primary" onClick={() => { void api.hostingVerify(device.id).catch(e => setError(e.message)) }}>브라우저에서 승인</Button><Button onClick={() => void cancel()}>연결 취소</Button></div></div>
        : <form noValidate onSubmit={event => { event.preventDefault(); void start() }} onKeyDown={event => { if (event.key === 'Enter' && event.nativeEvent.isComposing) event.preventDefault() }}>
          <div className="bl-host-form"><SelectField label="호스팅 제공자" value={provider} onChange={value => { setProvider(value as typeof provider); setMethod('oauth'); setPat(''); setClientId(''); setCustom(false); setWriteAccess(false); setFieldError('') }} options={[{ value: 'github', label: 'GitHub' }, { value: 'gitlab', label: 'GitLab' }]} disabled={busy} />
            {provider === 'gitlab' && <SelectField label="연결 방식" value={method} onChange={value => { setMethod(value); setPat(''); setError('') }} disabled={busy} options={[{ value: 'oauth', label: 'GitLab.com · 브라우저 승인' }, { value: 'pat', label: 'PAT · 회사 GitLab / GitLab.com' }]} />}
            {method === 'pat' ? <><TextField label="GitLab 서버 주소" value={origin} onChange={event => setOrigin(event.target.value)} disabled={busy} placeholder="https://gitlab.company.com" hint="HTTPS 서버 주소만 입력하세요. 프로젝트 경로와 /api/v4는 제외합니다." /><TextField label="Personal Access Token (PAT)" type="password" autoComplete="off" value={pat} onChange={event => setPat(event.target.value)} disabled={busy} hint="조회에는 read_api, 원격 쓰기에는 api 권한이 필요합니다. Client ID는 필요하지 않습니다." /><Notice compact>입력한 서버에만 토큰을 전송합니다. 사내망/VPN과 신뢰할 수 있는 HTTPS 인증서가 필요합니다.</Notice></> : <>
            {defaultsBusy ? <Notice>로그인 앱 설정을 확인하고 있습니다…</Notice> : defaultsError ? <Notice tone="error">자동 설정을 확인하지 못했습니다. {defaultsError}<Button onClick={reloadDefaults}>로그인 설정 다시 확인</Button></Notice> : defaults[provider] ? <><Notice>저장된 로그인 앱 설정을 자동으로 사용합니다. Client ID 입력 없이 아래에서 승인 코드를 요청하세요.</Notice><Checkbox label="사용자 지정 OAuth 앱으로 연결" checked={custom} disabled={busy} onChange={e => { setCustom(e.target.checked); setFieldError(''); setError('') }} /></> : <Notice>이 PC에서 사용할 로그인 앱 설정이 아직 없습니다. 공개 ID로 한 번 연결하면 이후에는 자동으로 설정합니다. 배포용 기본 ID가 포함된 앱은 첫 연결부터 입력할 필요가 없습니다.</Notice>}
            {defaultsWarning && <Notice>{defaultsWarning}</Notice>}{!defaultsBusy && (defaultsError || custom || !defaults[provider]) && <TextField ref={clientInput} label={provider === 'github' ? '공개 Client ID' : '공개 Application ID'} value={clientId} onChange={e => setClientId(e.target.value)} error={fieldError} disabled={busy} hint={provider === 'github' ? 'GitHub OAuth App 등록에서 Device Flow를 활성화하세요.' : 'GitLab OAuth Application의 Confidential을 끄고 조회는 read_user·read_api, 원격 쓰기는 read_user·api를 허용하세요.'} autoComplete="off" />}
            </>}
            {provider === 'github' && <Checkbox label="비공개 저장소도 조회" checked={privateRepos} disabled={busy} onChange={e => setPrivateRepos(e.target.checked)} />}
            <Checkbox label="원격 쓰기 허용 · PR/MR 생성·리뷰·병합·CI 제어" checked={writeAccess} disabled={busy} onChange={e => setWriteAccess(e.target.checked)} />
            <Notice>{method === 'pat' ? 'PAT의 실제 권한과 프로젝트 정책을 따릅니다. 원격 쓰기는 아래 설정과 별개로 토큰에 api 권한이 있어야 하며, 실행 전 작업안을 확인합니다.' : writeAccess ? provider === 'github' ? '요청 권한: read:user + repo. 공개·비공개 저장소 쓰기가 포함됩니다. 실제 작업은 별도 검토 후 실행합니다.' : '요청 권한: read_user + api. API 읽기·쓰기가 포함됩니다. 실제 작업은 별도 검토 후 실행합니다.' : provider === 'github' ? privateRepos ? '요청 권한: read:user + repo. GitHub repo 권한에는 저장소 쓰기도 포함됩니다. 이번 연결에서는 Branchline의 원격 쓰기를 사용하지 않습니다.' : '요청 권한: read:user. 공개 저장소를 조회합니다. 기존 앱 승인에 따라 제공자가 더 넓은 권한을 반환할 수 있습니다.' : '요청 권한: read_user + read_api. 계정·프로젝트·MR·Pipeline 정보를 읽습니다.'}</Notice>
            <Checkbox label="OS 보안 저장소로 암호화하여 다음 실행에도 유지" checked={persistent} disabled={busy} onChange={e => setPersistent(e.target.checked)} />
            <p className="bl-muted">선택하지 않으면 앱 종료 시 연결이 사라집니다. 계정 비밀번호·Client Secret은 입력하지 않습니다. 호스팅 연결은 Git Push 인증과 AI Agent 로그인을 변경하지 않습니다. 같은 계정을 다시 연결하면 해당 계정의 기존 연결을 갱신합니다.</p>
          </div><div className="bl-actions bl-dialog-actions"><Button variant="primary" type="submit" disabled={method === 'oauth' && defaultsBusy} loading={busy}>{method === 'pat' ? 'GitLab PAT 연결' : provider === 'github' ? 'GitHub 승인 코드 요청' : 'GitLab 승인 코드 요청'}</Button></div>
        </form>}
    </Dialog>
    <Dialog dialogRef={forgetDialog} title="계정 연결 해제" busy={busy}>
      <p>{accounts.accounts.find(a => a.key === forget)?.login} 계정의 Branchline 보관 인증을 삭제합니다. 원격 저장소와 Git 인증은 유지됩니다.</p><Notice>제공자 측 접근 권한 철회는 GitHub Settings → Applications 또는 GitLab Preferences → Applications 또는 Access Tokens에서 별도로 진행하세요.</Notice>
      {forgetError && <Notice tone="error">{forgetError}</Notice>}<div className="bl-actions bl-dialog-actions"><Button variant="primary" loading={busy} onClick={() => void disconnect()}>연결 해제 확인</Button></div>
    </Dialog>
  </section>
}
