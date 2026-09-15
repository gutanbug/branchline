import { useState } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Button, EmptyState, Notice } from './components'

export function MarkdownContent({ value, baseUrl, onOpenLink }: { value: string; baseUrl?: string; onOpenLink?: (url: string) => Promise<unknown> }) {
  const [raw, setRaw] = useState(false), [error, setError] = useState('')
  function safeLink(href: string) {
    try {
      const base = new URL(baseUrl || ''), url = new URL(href, base)
      return url.protocol === 'https:' && url.origin === base.origin && !url.username && !url.password ? url.href : ''
    } catch { return '' }
  }
  return <section className="bl-markdown-content" aria-label="Markdown 본문">
    <div className="bl-markdown-tools" role="group" aria-label="본문 표시 방식"><Button aria-pressed={!raw} onClick={() => setRaw(false)}>서식 보기</Button><Button aria-pressed={raw} onClick={() => setRaw(true)}>원문 보기</Button></div>
    {error && <Notice tone="error">{error}</Notice>}
    {!value.trim() ? <EmptyState title="작성된 설명이 없습니다">제공자에서 설명을 추가할 수 있습니다.</EmptyState> : raw ? <pre className="bl-markdown-source" tabIndex={0} aria-label="본문 원문">{value}</pre> : <div className="bl-markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml urlTransform={href => safeLink(href)} components={{
      a: ({ href, children }) => href && onOpenLink ? <a href={href} onAuxClick={event => event.preventDefault()} onClick={event => { event.preventDefault(); setError(''); void Promise.resolve().then(() => onOpenLink(href)).catch(e => setError(e.message || '링크를 열지 못했습니다.')) }}>{children} ↗</a> : <span>{children}</span>,
      img: ({ alt }) => <span className="bl-muted">[이미지: {alt || '첨부 이미지'} · 제공자에서 확인]</span>,
      input: ({ checked }) => <span role="img" aria-label={checked ? '완료 항목' : '미완료 항목'}>{checked ? '☑' : '☐'}</span>,
      table: ({ children }) => <div className="bl-markdown-table" role="region" aria-label="본문 표" tabIndex={0}><table>{children}</table></div>,
      h1: ({ children }) => <h4>{children}</h4>, h2: ({ children }) => <h4>{children}</h4>, h3: ({ children }) => <h5>{children}</h5>,
    }}>{value}</Markdown></div>}
  </section>
}
