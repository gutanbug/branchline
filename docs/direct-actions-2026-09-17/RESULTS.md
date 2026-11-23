# 반복 설명과 확인 단계 정리 · 2026-09-17

기능명과 실행 대상만으로 판단할 수 있는 작업은 사용 위치에서 실행한다. 버튼을 누른 뒤 같은 내용을 다시 확인하는 단계와 반복 사용법을 줄였다. 입력값을 받는 화면, 데이터 삭제·덮어쓰기, 이력 변경과 병합 검토는 유지했다.

## 적용 범위

| 사용 위치 | 변경 |
| --- | --- |
| 브랜치·파일·저장소 공통 메뉴 | 항목 아래 설명 제거. 대상과 비활성 이유는 hover·접근성 설명으로 제공 |
| 공통 입력 필드 | 하단 hint를 라벨 옆 도움말로 이동. 키보드 포커스·Esc 지원. 오류는 계속 즉시 표시 |
| Git 툴바·브랜치 우클릭 | Fetch/Pull/일반 Push/Upstream 바로 실행. 비활성 브랜치 Pull도 동일 |
| 체크아웃·커밋·Git 계속 | 기존 실행 함수를 바로 호출. 자동 Stash와 충돌 복구 유지 |
| Stash·파일 메뉴 | 복원/Pop, 파일 보관, ignore 규칙 바로 실행. 스테이징 복원 선택은 보관함에 배치 |
| 충돌 해결 | 저장·스테이징 즉시 실행. 외부 변경 시 거부, 복원·편집 폐기 확인 유지 |
| AI 제안 | 요청 후 편집하지 않았으면 초안으로 바로 가져오기. 새 편집이 있으면 덮어쓰기 확인 |
| PR/MR | 작성·댓글·승인·변경 요청 폼에서 한 번 제출. 추가 입력 없는 GitLab 승인은 버튼에서 바로 실행. 권한·최신 버전 검사는 유지 |
| CI 실행·취소 | 최신 대상 조회 후 확인 한 단계. 재실행의 배포/사용료 가능성 안내 유지 |
| 원격·Worktree·설정·필터 | 반복 설명 삭제·축약. 실제 상태·조회 한계·오류·보안 범위는 보존 |

공통 ContextMenu, TextField/Tooltip, Dialog, Notice, ActionSummary를 재사용했다. 별도 의존성은 추가하지 않았다. 같은 실행에 대한 연속 클릭은 in-flight guard로 차단한다.

직접 체크아웃 후 완료 알림이 최소 창의 그래프 높이를 줄이는 문제도 검증 중 발견해 수정했다. 공통 Notice의 compact 변형과 작은 상단 간격을 사용하고, 다른 화면·조회 범위로 이동하면 지난 완료 알림을 지운다. 오류 알림은 유지한다.

## 검증 범위

실제 Git 작업은 임시 저장소와 로컬 bare remote에서 검증한다. GitHub/GitLab API는 통제된 응답, Claude/Codex/Gemini CLI는 테스트 실행 파일로 검증한다. 실제 계정에 댓글·리뷰·CI 실행을 게시하거나 AI 과금 호출을 하지 않는다.

- Storybook: 일반 항목에서 부가 설명을 숨기고 disabled 이유는 접근 가능하게 유지, 입력 도움말 focus/Esc, 데이터만 있는 ActionSummary, PR 한 번 제출 검증.
- Electron: 직접 커밋의 연속 클릭, Fetch/Pull/Push/Pop·체크아웃·충돌 저장·파일 무시, 실패 복구, 한글 IME, 최소 창 및 접근성 검증.
- 원격 쓰기: 입력 유지, 실제 API 호출 한 번, 최신 SHA 불일치 거부 및 계정 격리 검증.
- 삭제·변경 폐기·미저장 편집 보호와 AI 초안 덮어쓰기 확인 검증.

검증 화면: [간결한 브랜치 메뉴](branch-menu-1440.png), [원격 설정](desktop-sync-narrow.png), [댓글 작성](remote-write-form.png), [충돌 해결](desktop-conflicts.png), [최소 창 그래프](repository-graph-narrow.png), [입력 도움말을 적용한 프로필](author-profiles.png).

## 최종 결과

- `pnpm check` 전체 성공: lint, renderer build, Storybook 175개, native UI, Git/호스팅/Agent/보안 54개, Electron 전체 흐름, 종료·초안 복구, Storybook build.
- strict 디자인 정적 검사 오류·경고 0. DESIGN.md lint 오류·경고 0. `git diff --check` 통과.
- 최소 창 760×580, 메뉴 키보드·Esc·IME, 잘못된 입력·오프라인·최신 상태 변경·중복 클릭 검증을 포함했다.
- 마지막에 `env -u ELECTRON_RUN_AS_NODE pnpm desktop`으로 최신 renderer를 빌드해 실제 앱을 재실행했다. `dist/index.html` 로딩, 기존 두 저장소 탭과 선택 브랜치·그래프 복원, 설명 없는 브랜치 메뉴 및 Esc 닫기를 실제 앱에서 확인했다.
- 실제 사용자 저장소에는 테스트용 커밋·체크아웃·Pull·Push를 실행하지 않았다. 커밋·푸시·Release 게시와 설치 패키지 검증은 이번 작업 범위에 포함하지 않는다.
