import { useLayoutEffect, useMemo } from 'react'

type Fields = Record<string, string | number>

// Each local worktree keeps only its last view. Never restore it under a different filter, account or project.
function navigationBookmark<T extends Fields>(key: string, scope: string, defaults: T) {
  const storageKey = 'branchline.navigation.v1:' + key
  let value = { ...defaults }, timer: number | undefined
  try {
    const saved = key && JSON.parse(localStorage.getItem(storageKey) || 'null')
    if (key && saved?.scope === scope && saved.value) {
      for (const k of Object.keys(defaults) as (keyof T)[]) {
        const v = saved.value[k]
        if (typeof v === typeof defaults[k] && (typeof v === 'number' ? Number.isSafeInteger(v) && v >= 0 : v.length <= 8192)) value[k] = v
      }
    }
  } catch { /* Missing or obsolete preferences use the default view. */ }
  function flush() {
    if (timer === undefined) return
    clearTimeout(timer); timer = undefined
    try { localStorage.setItem(storageKey, JSON.stringify({ scope, value })) } catch { /* The current session still works without storage. */ }
  }
  return { get value() { return value }, update(patch: Partial<T>, scrolling = false) {
    if (Object.entries(patch).every(([k, v]) => value[k] === v)) return
    value = { ...value, ...patch }
    if (!key) return
    timer ??= window.setTimeout(flush, 160)
    if (!scrolling) flush()
  }, flush }
}

export function useNavigationBookmark<T extends Fields>(key: string, scope: string, defaults: T) {
  const bookmark = useMemo(() => navigationBookmark(key, scope, defaults), [key, scope, defaults])
  useLayoutEffect(() => {
    window.addEventListener('pagehide', bookmark.flush)
    window.addEventListener('beforeunload', bookmark.flush)
    return () => {
      window.removeEventListener('pagehide', bookmark.flush)
      window.removeEventListener('beforeunload', bookmark.flush)
      bookmark.flush()
    }
  }, [bookmark])
  return bookmark
}
