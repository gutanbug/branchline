# 제품 UX 감사 수정 결과

2026-09-14 · [수정 전 감사](../product-ux-audit-2026-09-14/REVIEW.md)의 식별자로 추적한다. 재현된 결함과 핵심 Git 작업의 단절을 우선 수정했다. 제안된 전체 제품 백로그의 완료를 뜻하지 않는다.

## 수정한 결함과 핵심 흐름

| ID | 수정 | 검증 근거 |
| --- | --- | --- |
| F01 | 비교에서 적용할 A/B 선택 → 현재 브랜치에 Merge 또는 현재 브랜치 Rebase → SHA/방향 검토 → 실행. 변경 파일·기존 작업·detached 상태는 차단하고 충돌 시 해결 화면으로 이동 | `electron/git.test.cjs`, `scripts/check-audit-fixes.mjs`: 실제 Merge/Rebase 충돌과 자동 진입, FF Merge, dirty 차단 |
| F02 | merge/rebase/cherry-pick 중단 확인. 저장·미저장 충돌 편집의 손실을 설명하고 token/operation 재검사 후 Git abort. 취소하면 초안 유지 | native: 세 작업 복구·외부 수정 거부, Electron: Merge/Rebase 중단 취소·확정·원래 HEAD 복구 |
| F05 | Worktree 생성 방식을 새 브랜치 / 기존 로컬 브랜치 / detached로 구분. 다른 Worktree에서 사용 중인 브랜치 차단 | native: 기존·detached·중복 사용, Electron: 기존 브랜치의 실제 폴더 생성 |
| D01 | 절대 위치 필터를 문서 흐름으로 이동. 최소 창에서 필터 높이와 빈 결과 여백 조정 | 1440×950·760×580에서 결과 텍스트의 실제 hit-test, 가로 넘침 검사 |
| D02 | 커밋·작업 파일·비교 통계 출력에 `core.quotepath=false` 적용 | 한글 파일 이름이 실제 diff에 그대로 표시되는 native 검사 |
| D03 | Agent 최초 조회 실패에 다시 조회 버튼 제공 | 실제 Electron IPC의 첫 조회 실패 → 재조회 성공 |
| D04 | 필드별 오류 연결과 첫 오류 포커스, 이메일 검증 | 빈 프로필의 `aria-invalid` 3개·포커스·저장 재시도 |
| D05 | 프로필 삭제 확인, 미저장 입력이 있는 프로필 전환/새 프로필 확인 | 취소 시 입력 보존, 확인 후 삭제, 기존 저장소 작성자 유지 |

## 함께 반영한 개선과 남은 조건

| ID | 현재 상태 |
| --- | --- |
| F03 | 사용자가 공개 ID 미준비로 답변해 기존 OAuth 설정 안내를 유지했다. 등록한 배포용 공개 ID와 실제 계정 승인은 후속 연결 조건이다. |
| F04 | 현재 Head에 귀속한 검사 성공/실패/대기와 승인 요약, 부분 조회 실패·이전 SHA·추가 페이지·정책 미확인을 표시한다. GitHub 보호 규칙/merge queue 및 제공자별 필수 조건의 최종 집계는 남아 있으며 병합 가능으로 단정하지 않는다. |
| U01 | SHA/ref 빠른 이동은 후속 기능. 기존 메시지·작성자·경로 필터 유지. |
| U02 | 전체 스테이징/해제 추가. hunk 단위·파일 트리·작업 폐기/복구는 후속 기능. |
| U03 | 브랜치 이름 변경/삭제, cherry-pick/revert 시작, reflog 복구는 후속 기능. |
| U04 | 적용 대상 A/B와 실제 현재 브랜치 및 SHA 설명 개선. 비교 파일별 전체/split diff는 후속 기능. |
| U05 | 공통 InspectorPanel 크게 보기, 닫기/Escape 후 원래 상세와 포커스 유지. 상세 컬럼 자체의 드래그 리사이즈는 후속 기능. |
| U06 | Stash 상세에서 직접 복원/삭제하는 액션과 내부 부모 노드 안내는 후속 기능. 기존 보관함 검토 후 실행은 유지. |
| U07 | 넓은 창에서 원본·해결 결과와 AI 대화를 나란히 배치. 좁은 창에서는 직접 편집 뒤에 대화 배치. |
| U08 | PM 담당/대기 필터, 원격 프로젝트 탭과 다수 프로젝트 확장은 후속 기능. |
| U09 | Self-managed GitLab/Enterprise는 후속 호스팅 지원 범위. |
| U10 | 설치·로그인·활성화·실행·잔여량을 분리해 설명. 앱 내 로그인 시작, Claude/Gemini 공식 quota 연동은 후속 조건. |
| U11 | 새 Pipeline/workflow_dispatch 실행 및 앱 안 로그 탐색은 후속 기능. 기존 재실행/취소·제공자 로그 열기 유지. |
| U12 | 허용한 저장소의 MCP JSON 복사 추가. main에서 범위를 다시 검증하고 사용자 클립보드를 읽지 않는다. 파일 내보내기·외부 클라이언트별 진단은 후속 기능. |
| U13 | 많은 탭의 검색/고정·키보드 전환, 대규모 그래프 가상 렌더링은 후속 기능. |

## 검증

`pnpm check` 전체 통과: Storybook 32개 파일·101개 테스트, Node 28개 테스트, native/Electron·초안 복구·두 빌드 완료. Premium strict와 DESIGN lint 오류·경고 0개. 760×580 최소 창의 실제 결과 표시와 접근성을 확인했다.

- [전체 검사 로그](./check.log): lint, renderer build, Storybook, native, Git/Agent/호스팅, 실제 Electron, 초안 복구, Storybook build.
- [Premium strict 감사](./premium-audit.json), DESIGN.md lint.
- Git은 임시 저장소와 임시 앱 프로필에서 실행했다. 호스팅과 AI는 통제된 제공자 응답·임시 CLI를 사용했다. 실제 계정 승인·유료 AI·원격 게시를 실행하지 않았다.
- 클립보드는 테스트 프로세스의 쓰기 종착점만 대체했다. 사용자 클립보드를 읽거나 변경하지 않았다.
- 설치 번들 재생성·서명·공개 릴리스는 이번 수정 범위에 포함하지 않는다.
