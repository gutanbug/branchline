import type { ReactElement } from 'react'
import { ContextMenu } from './ContextMenu'
import { IconButton } from './IconButton'

export function LinkedRow({ label, children, onCopy, onOpen }: { label: string; children: ReactElement; onCopy: () => void; onOpen: () => void }) {
  return <div className="bl-linked-row">
    <ContextMenu label={label} groups={[[{ label: '링크 복사', onClick: onCopy }, { label: '브라우저에서 열기', onClick: onOpen }]]}>{children}</ContextMenu>
    <IconButton icon="copy" label={`${label} 링크 복사`} onClick={onCopy} />
    <IconButton icon="external" label={`${label} 브라우저에서 열기`} onClick={onOpen} />
  </div>
}
