import type { Repository } from './types'

export function headLabel(repo: Pick<Repository, 'branch' | 'head'>) {
  return repo.branch || (repo.head ? `Detached HEAD · ${repo.head.slice(0, 8)}` : '첫 커밋 전')
}
