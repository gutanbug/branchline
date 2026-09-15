export type Commit = { hash: string; message: string; author: string; date: string; branch: string; file: string }
// 예제 fixtures: no connection to a local repository or Electron IPC.
export const exampleBranches = ['feature/branch-filter', 'fix/keyboard-nav', 'main']
export const exampleCommits: Commit[] = [
  { hash: 'a8f31c2', message: '브랜치 필터 선택 UI 추가', author: '예제 개발자', date: '2026-09-12', branch: 'feature/branch-filter', file: 'src/BranchFilter.tsx' },
  { hash: 'c5e90b1', message: '검색 결과가 없을 때 안내 표시', author: '예제 개발자', date: '2026-09-11', branch: 'feature/branch-filter', file: 'src/EmptyState.tsx' },
  { hash: 'b3d84a6', message: '그래프 키보드 포커스 수정', author: '예제 개발자', date: '2026-09-11', branch: 'fix/keyboard-nav', file: 'src/CommitList.tsx' },
  { hash: '8e921f0', message: '커밋 상세 패널 간격 정리', author: '예제 개발자', date: '2026-09-10', branch: 'main', file: 'src/DetailPanel.tsx' },
  { hash: '4cb71d8', message: '공통 폼 컴포넌트 연결', author: '예제 개발자', date: '2026-09-10', branch: 'main', file: 'src/TextField.tsx' },
  { hash: '29d6fe3', message: '디자인 토큰과 기본 레이아웃 적용', author: '예제 개발자', date: '2026-09-09', branch: 'main', file: 'src/index.css' },
]
