import { Toggle } from '@base-ui/react/toggle'
import { ToggleGroup } from '@base-ui/react/toggle-group'
import { Button } from './components'

export function ModeSelector<T extends string>({ label, options, value, onChange }: {
  label: string; options: readonly (readonly [T, string])[]; value: T; onChange: (value: T) => void
}) {
  return <ToggleGroup<T> className="bl-mode-selector" aria-label={label} value={[value]} onValueChange={([next]) => { if (next !== undefined) onChange(next) }}>
    {options.map(([id, name]) => <Toggle key={id} value={id} render={<Button variant={value === id ? 'primary' : 'ghost'} />}>{name}</Toggle>)}
  </ToggleGroup>
}
