export type ShortcutGroup = { title: string; items: { keys: string[]; label: string }[] }

/** Read-only keyboard shortcut reference. Keys are shown as separate keycaps; alternatives use "또는". */
export function ShortcutList({ groups }: { groups: ShortcutGroup[] }) {
  return <div className="bl-shortcuts">{groups.map(group => <section key={group.title} aria-label={group.title}>
    <h3>{group.title}</h3>
    <dl>{group.items.map(item => <div key={item.label} className="bl-shortcut-row"><dt>{item.label}</dt><dd>{item.keys.map((combo, i) => <span key={combo}>{i > 0 && <span className="bl-shortcut-or">또는</span>}{combo.split('+').map(key => <kbd key={key}>{key}</kbd>)}</span>)}</dd></div>)}</dl>
  </section>)}</div>
}
