import type { Meta, StoryObj } from '@storybook/react-vite'
import { exampleBranches } from '../design-system/examples'
const meta = { title: 'Patterns/DataTable', parameters: { docs: { description: { component: '정적 정보는 네이티브 table과 handoff의 ds-table 클래스로 표시합니다. 수치 열은 Mono·우측 정렬, 좁은 화면은 가로 스크롤을 사용합니다.' } } } } satisfies Meta
export default meta
export const Default: StoryObj<typeof meta> = { render: () => <div className="bl-table-scroll"><table className="ds-table"><caption>예제 · 브랜치 비교 요약</caption><thead><tr><th scope="col">브랜치</th><th scope="col">상태</th><th scope="col" className="num-col">Ahead</th><th scope="col" className="num-col">Behind</th></tr></thead><tbody>{exampleBranches.map((branch, index) => <tr key={branch}><th scope="row"><code>{branch}</code></th><td>{index === 0 ? '현재 체크아웃' : '조회 가능'}</td><td className="num-col">{[5, 1, 0][index]}</td><td className="num-col">{[2, 3, 0][index]}</td></tr>)}</tbody></table></div> }
