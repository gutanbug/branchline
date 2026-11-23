// Resolve only explicit remote hosts; SSH config aliases require a real host in the remote URL.
export function remoteProject(remote: string, host?: string) {
  try {
    const url = new URL(remote.replace(/^(?:[^/@:]+@)?([^/:]+):([^/].*)$/, 'ssh://$1/$2'))
    if (!['ssh:', 'https:', 'http:', 'git:'].includes(url.protocol) || url.search || url.hash || url.password) return null
    const server = url.protocol === 'ssh:' ? url.hostname : url.host
    const project = decodeURIComponent(url.pathname).replace(/^\//, '').replace(/\/$/, '').replace(/\.git$/, '')
    if (host && server !== host || project.split('/').length < 2 || !project.split('/').every(part => /^[\w.-]+$/.test(part) && part !== '.' && part !== '..')) return null
    return { host: server, project }
  } catch { return null }
}

// file:// URLs, absolute/relative paths and Windows drive paths point at a folder, not a hosting service.
export const isLocalRemote = (remote: string) => /^file:\/\//i.test(remote) || /^(?:[\\/]|\.{1,2}[\\/]|~[\\/]|[A-Za-z]:[\\/])/.test(remote)
