import type { Meta, StoryObj } from '@storybook/react-vite'
import { Brand, Badge } from '../design-system/components'

const meta = { title: '시작하기/디자인 시스템', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
export const Overview: StoryObj<typeof meta> = {
  name: 'Overview',
  render: () => <article className="bl-spec bl-stack"><header className="bl-spec-header"><div className="bl-row"><Brand /><Badge>디자인 검토용 · v0.1</Badge></div><h1>먼저 시스템을 만들고,<br />같은 언어로 제품을 만듭니다.</h1><p>Branchline Design Handoff를 실행 가능한 React 컴포넌트로 연결했습니다. 토큰부터 상태와 실제 화면 조합까지, 이곳에서 확인하고 다듬으세요.</p></header><div className="bl-grid">{[['01', 'Foundations', '색상, 타이포그래피, 간격, 모서리, 브랜드 원칙', 'foundations-토큰--colors'], ['02', 'Components', '버튼과 폼, 배지, 알림, 다이얼로그, 브랜치 검색', 'components-button--primary'], ['03', 'Patterns', '트리, 커밋 목록, 상세 패널, 적용 영역, 전체 화면', 'patterns-workspace--default']].map(([number, title, body, id]) => <section className="bl-card" key={number}><p className="bl-kicker">{number} / LIBRARY</p><h2>{title}</h2><p>{body}</p><p style={{ marginTop: 'var(--gap-md)' }}><a href={`./?path=/story/${id}`} target="_top">살펴보기 →</a></p></section>)}</div><section className="bl-card"><h2>디자인 검토 순서</h2><ol><li>Foundations에서 공통 토큰과 밀도를 확인합니다.</li><li>각 컴포넌트의 Controls로 문구·상태·속성을 바꿉니다.</li><li>Docs에서 사용 코드와 속성을 확인하고, Accessibility에서 문제를 검토합니다.</li><li>Patterns / Workspace에서 조합과 키보드 동작을 확인합니다.</li></ol></section><section className="bl-card"><h2>현재 범위</h2><p>원본 토큰·스타일 재사용, React 컴포넌트, 상태별 스토리, 브라우저 상호작용 및 접근성 테스트. 제품 화면은 예제 데이터로 동작합니다. 실제 Git·Electron 연동과 디자인 최종 승인은 다음 단계입니다.</p></section></article>,
}
