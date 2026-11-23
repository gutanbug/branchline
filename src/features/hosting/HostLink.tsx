import { useState } from 'react'
import { Button, IconButton, ToastMessage } from '../../design-system'
import type { DesktopAPI } from '../../app/types'

export function HostLink({ api, account, url, label = '제공자에서 열기', showLabel }: { showLabel?: boolean; api: DesktopAPI; account: string; url: string; label?: string }) {
  const [error, setError] = useState('')
  function open() { setError(''); void api.hostingExternal(account, url).catch(e => setError(e.message)) }
  return <div>{showLabel ? <Button onClick={open}>{label}</Button> : <IconButton icon="external" label={label} onClick={open} />}<ToastMessage scope="외부 링크" tone="error" message={error} /></div>
}
