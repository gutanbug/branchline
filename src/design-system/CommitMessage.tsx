import { Disclosure } from './components'
import { formatCommitDate, parseCommitPreamble } from './commit-message'

export function CommitMessage({ title, body }: { title: string; body: string }) {
  return <section className="bl-commit-message" aria-label="커밋 메시지 카드">
    <div className="bl-commit-message-title"><small>제목 · Title</small><h3>{title || '제목 없음'}</h3></div>
    <div className="bl-commit-message-body" tabIndex={0} role="region" aria-label="커밋 본문"><small>본문 · Body</small><p>{body || '본문이 없는 커밋입니다.'}</p></div>
  </section>
}
export function CommitMetadata({ value }: { value: string }) {
  const commit = parseCommitPreamble(value)
  if (!commit) return <Disclosure title="커밋 정보"><pre className="bl-diff-metadata" tabIndex={0}>{value}</pre></Disclosure>
  return <><CommitMessage title={commit.title} body={commit.body} /><Disclosure title="커밋 정보"><dl className="bl-commit-facts">
    {([['SHA', commit.sha], ['작성자', commit.author], ['작성 일시', formatCommitDate(commit.authoredAt)], ['커미터', commit.committer], ['반영 일시', formatCommitDate(commit.committedAt)], ['병합 부모', commit.parents]]).filter(([, value]) => value).map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
  </dl></Disclosure></>
}
