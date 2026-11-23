export function splitCommitMessage(message: string) {
  const [title = '', ...lines] = message.replaceAll('\r\n', '\n').split('\n')
  return { title, body: lines.join('\n').replace(/^\n+|\n+$/g, '') }
}
const dateFormat = new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false })
export function formatCommitDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : dateFormat.format(date)
}
export function parseCommitPreamble(value: string) {
  const lines = value.split('\n'), sha = /^commit ([a-f0-9]{40,64})$/.exec(lines[0])?.[1]
  const separator = lines.indexOf('')
  if (!sha || separator < 0) return null
  const field = (key: string) => lines.slice(1, separator).find(line => line.startsWith(`${key}:`))?.slice(key.length + 1).trim() || ''
  return { sha, ...splitCommitMessage(lines.slice(separator + 1).map(line => line.startsWith('    ') ? line.slice(4) : line).join('\n').replace(/\n+$/, '')), author: field('Author'), authoredAt: field('AuthorDate'), committer: field('Commit'), committedAt: field('CommitDate'), parents: field('Merge') }
}
