import type { Meta, StoryObj } from '@storybook/react-vite'
import { Brand, Badge, Button, TextField } from '../design-system/components'
import colors from '../../branchline-design-system-handoff/colors_and_type.css?raw'
import layout from '../../branchline-design-system-handoff/tokens.css?raw'

const meta = { title: 'Foundations/토큰', parameters: { layout: 'fullscreen' } } satisfies Meta
export default meta
type Story = StoryObj<typeof meta>
const colorNames = ['bg', 'surface', 'fg', 'muted', 'border', 'accent']
const roles = ['작업 배경', '패널과 입력 표면', '본문과 아이콘', '보조 설명과 날짜', '구분선과 테두리', '이력 레인과 핵심 적용 동작']
const tokenValue = (name: string) => `${colors}\n${layout}`.match(new RegExp(`--${name}:\\s*([^;]+);`))?.[1] ?? ''

export const Colors: Story = {
  name: '색상',
  render: () => <article className="bl-spec bl-stack"><header className="bl-spec-header"><span className="bl-kicker">FOUNDATIONS / 01</span><h1>블랙과 화이트, 하나의 기준.</h1><p>기본 테마는 블랙·화이트와 중립 회색입니다. 주요 버튼은 검정 배경·흰 글자, 이력 레인과 포커스는 검정으로 표시합니다.</p></header><div className="bl-grid">{colorNames.map((name, index) => <section className="bl-card" key={name}><div className="bl-swatch" style={{ background: `var(--${name})` }} /><h2><code>--{name}</code></h2><p>{roles[index]}</p><small><code>{tokenValue(name)}</code></small></section>)}</div><div className="bl-row"><Button variant="primary" disabled>변경 사항 적용</Button><Badge>예제</Badge><p>상태는 색상만으로 전달하지 않고 텍스트·선택 표시·테두리로 함께 전달합니다.</p></div></article>,
}
export const Typography: Story = {
  name: '타이포그래피',
  render: () => <article className="bl-spec bl-stack"><header className="bl-spec-header"><span className="bl-kicker">FOUNDATIONS / 02</span><h1>정보에 맞는 글자.</h1><p>UI 문구는 시스템 Sans. 브랜치·SHA·날짜·수치·diff는 Mono. 별도 웹폰트 다운로드 없이 동작합니다.</p></header>{['h1', 'h2', 'h3', 'body', 'meta', 'micro'].map(level => <div className="bl-token-row" key={level}><code>--app-fs-{level}<br />{tokenValue(`app-fs-${level}`)}</code><span style={{ fontSize: `var(--app-fs-${level})` }}>브랜치의 흐름을 명확하게</span></div>)}<div className="bl-card"><p className="num">feature/branch-filter · a8f31c2 · 2026-09-12 · +128 −32</p></div><details><summary>마케팅·문서용 스케일 보기</summary>{['h1', 'h2', 'h3', 'lead', 'body', 'meta'].map(level => <p key={level}><code>--fs-{level}: {tokenValue(`fs-${level}`)}</code></p>)}</details></article>,
}
export const Spacing: Story = {
  name: '간격과 레이아웃',
  render: () => <article className="bl-spec bl-stack"><header className="bl-spec-header"><span className="bl-kicker">FOUNDATIONS / 03</span><h1>조밀하지만, 명확하게.</h1><p>문서용 간격과 앱용 치수를 구분합니다. 상호작용 영역은 최소 44px을 확보합니다.</p></header>{['gap-xs', 'gap-sm', 'gap-md', 'gap-lg', 'gap-xl', 'gap-2xl'].map(name => <div className="bl-token-row" key={name}><code>--{name} · {tokenValue(name)}</code><div className="bl-token-bar" style={{ width: `var(--${name})` }} /></div>)}<div className="bl-grid">{['app-sidebar-w', 'app-detail-w', 'app-control-h', 'app-row-h'].map(name => <div className="bl-card" key={name}><code>--{name}</code><h2 className="num">{tokenValue(name)}</h2></div>)}</div><p>원본 행 높이 토큰은 32px입니다. 클릭 가능한 커밋 행은 터치 영역과 두 줄 정보를 위해 58px로 확장했습니다.</p></article>,
}
export const RadiusAndElevation: Story = {
  name: '모서리와 그림자',
  render: () => <article className="bl-spec bl-stack"><header className="bl-spec-header"><span className="bl-kicker">FOUNDATIONS / 04</span><h1>표면의 경계를 분명하게.</h1><p>캔버스 패널은 1px 구분선으로 나눕니다. 그림자는 메뉴와 다이얼로그에만 사용합니다.</p></header><div className="bl-grid">{['app-radius', 'radius', 'radius-lg'].map(name => <div className="bl-card" key={name} style={{ borderRadius: `var(--${name})` }}><code>--{name}</code><h2>{tokenValue(name)}</h2></div>)}</div><div className="bl-grid"><div className="bl-card shadow-menu">메뉴 · shadow-menu</div><div className="bl-card shadow-dialog">다이얼로그 · shadow-dialog</div></div><TextField label="키보드 포커스" placeholder="Tab 키로 포커스를 확인하세요" /></article>,
}
export const Identity: Story = {
  name: '브랜드와 원칙',
  render: () => <article className="bl-spec bl-stack"><header className="bl-spec-header"><span className="bl-kicker">FOUNDATIONS / 05</span><h1>Branchline의 언어.</h1><p>장식보다 읽기 쉬운 이력, 명확한 작업, 일관된 상태를 우선합니다.</p></header><div className="bl-card"><Brand /></div><div className="bl-grid"><section className="bl-card"><h2>한국어, 직접적인 문구</h2><p>“브랜치 만들기”, “변경 사항 적용”처럼 작업의 결과를 말합니다.</p></section><section className="bl-card"><h2>예제 표시</h2><Badge>예제</Badge><p>실제 저장소와 혼동하지 않도록 모든 시드 화면에 표시합니다.</p></section><section className="bl-card"><h2>선택 후 상세</h2><p>선택 전에는 안내를 표시합니다. 조회 브랜치와 실제 체크아웃을 별도로 유지합니다.</p></section></div></article>,
}
