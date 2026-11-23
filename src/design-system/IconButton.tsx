import type { ComponentProps } from 'react'
import { Button } from './components'
import { Tooltip } from './Tooltip'

const paths = {
  branch: 'M7 7v10m0-4c6 0 10-2 10-6M7 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Zm0 14a2 2 0 1 0 0 4 2 2 0 0 0 0-4ZM17 3a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  folder: 'M3 6a1 1 0 0 1 1-1h5l2 2h9a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1Z',
  folderOpen: 'M3 17V6a1 1 0 0 1 1-1h5l2 2h7a1 1 0 0 1 1 1v2M3 18l3-7h16l-3 8H4Z',
  search: 'M15.5 15.5 21 21M18 10a8 8 0 1 0-16 0 8 8 0 0 0 16 0Z',
  filter: 'M3 6h8m4 0h6M3 18h3m4 0h11M11 3v6M6 15v6',
  locate: 'M12 2v3m0 14v3M2 12h3m14 0h3M12 5a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 5a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
  plus: 'M12 5v14M5 12h14',
  download: 'M12 3v12m-5-5 5 5 5-5M4 17v3h16v-3',
  expand: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  settings: 'M9 3h6l.6 3 2.4 1.4 2.9-.9 3 5.2-2.3 2.1v2.8l2.3 2.1-3 5.2-2.9-.9-2.4 1.4L15 27H9l-.6-3.6L6 22l-2.9.9-3-5.2 2.3-2.1v-2.8L.1 10.7l3-5.2 2.9.9L8.4 6Z',
  refresh: 'M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9',
  external: 'M14 3h7v7M21 3l-11 11M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5',
  copy: 'M8 8h12v13H8zM16 5V3H4v13h2',
  back: 'M19 12H5m7-7-7 7 7 7',
  reset: 'M3 4v6h6M3 10a9 9 0 1 1 1 8',
  close: 'm6 6 12 12M6 18 18 6',
}
export function Icon({ name, className = '' }: { name: keyof typeof paths; className?: string }) {
  return <svg aria-hidden="true" focusable="false" data-icon={name} viewBox={name === 'settings' ? '-2 1 28 28' : '0 0 24 24'} className={`bl-icon ${className}`}><path d={paths[name]} />{name === 'settings' && <circle cx="12" cy="15" r="4" />}</svg>
}

export function IconButton({ icon, label, tooltip = true, loading = false, disabled, className = '', ...props }: Omit<ComponentProps<typeof Button>, 'children'> & { icon: keyof typeof paths; label: string; tooltip?: boolean }) {
  const button = <Button {...props} variant={props.variant || 'ghost'} aria-label={label} aria-busy={loading || undefined} title={tooltip ? undefined : label} disabled={disabled || loading} className={`bl-icon-button ${className}`}>
    <Icon name={loading ? 'refresh' : icon} className={loading ? 'bl-icon-busy' : ''} />
  </Button>
  return tooltip ? <Tooltip content={label}>{button}</Tooltip> : button
}
