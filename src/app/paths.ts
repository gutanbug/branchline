/** Long local paths read better as their last two folders; callers keep the full path in a title. */
export const compactPath = (path: string) => { const parts = path.split(/[\\/]/).filter(Boolean); return parts.length > 3 ? `…/${parts.slice(-2).join('/')}` : path }
