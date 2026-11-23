import { useId } from 'react'

/**
 * Static dot grid backdrop, adapted from Magic UI's Dot Pattern without motion or glow.
 * Draws between the muted and border tones; the radial mask keeps the center clear so text stays readable.
 */
export function DotPattern({ spacing = 16, radius = 1, fade = 'radial', className = '' }: { spacing?: number; radius?: number; fade?: 'radial' | 'none'; className?: string }) {
  const id = useId()
  return <svg aria-hidden="true" focusable="false" className={`bl-dot-pattern ${className}`} data-fade={fade}>
    <defs><pattern id={id} width={spacing} height={spacing} patternUnits="userSpaceOnUse"><circle cx={radius} cy={radius} r={radius} /></pattern></defs>
    <rect width="100%" height="100%" fill={`url(#${id})`} />
  </svg>
}
