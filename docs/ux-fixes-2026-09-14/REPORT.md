# Branchline UX 수정 결과

2026-09-14 · 로컬 알파 0.1.0 · macOS arm64 Electron

[UX 재평가](../ux-audit-2026-09-14/REPORT.md)에서 확인한 초안 유실·상태 갱신·탐색 마찰을 수정하고, Git 계속과 PM 모아보기·요약을 연결했다. 모든 제품 백로그의 완료를 뜻하지 않는다.

| 감사 항목 | 수정 상태 | 결과와 남은 범위 |
| --- | --- | --- |
| P0-01 충돌 초안 유실 | 수정 | 저장소별 상위 상태로 이동. 상위 화면과 탭 이동 후 유지. 탭 닫기·정상 창 닫기/앱 종료 시 계속 편집 또는 버리기 확인. 강제 종료·재시작 복구용 영구 저장은 미지원. |
| P1-02 Git 작업 마무리 | 계속 동작 구현 | merge/rebase/cherry-pick 계속을 별도 확인으로 실행. 미해결 충돌·미스테이징 tracked 변경·검토 이후 상태 변경은 차단. Git 중단·특수 충돌은 후속 범위. |
| P1-03 OAuth 진입 | 구성 경로 구현, 운영 설정 대기 | 배포용 공개 ID가 있으면 사용자 ID 입력 생략. 사용자 지정 연결은 별도 선택. 현재 등록 앱 ID는 비어 있고 실제 계정 승인은 미검증. |
| P1-04 PM 관리 흐름 | 부분 구현 | 최대 5개 프로젝트의 PR/MR·CI 모아보기, 담당/검토 요청 요약, 상세 이동·목록 복귀, 부분 실패 유지. 각 첫 30개이며 전체 작업/필수 검사 집계가 아니다. PR/MR 생성·리뷰·병합·CI 쓰기는 미구현. |
| P1-05 AI 대화 | 미구현, 지원 안내 정리 | 설치·설정과 실제 로그인/실행을 구별하도록 안내. 실제 대화·Agent 자동 수정, Claude/Gemini 자동 한도는 여전히 미지원. |
| P2-06 외부 변경 갱신 | 수정 | 활성 저장소 5초 간격·탭 활성화·앱 복귀 갱신. 늦은 응답 폐기, Git 쓰기/상태 조회 조율, 초안 보존. 파일 watcher 방식은 아니다. |
| P2-07 그래프 공간·탐색 | 수정 | 48px compact 행, 반복 여백 축소, main 단일 세로 스크롤. 전역 메뉴·새로고침 고정. 760×580에서 최소 3개 전체 행 표시 검증. |
| P2-08 원격/로컬 맥락 | 수정 | 원격 제공자·계정·프로젝트 헤더 고정. 로컬 브랜치는 내 작업에서 탐색하고 다른 상위 화면 footer는 로컬 HEAD로 명시. |

## 구현 원칙

기존 Button·Dialog·Notice·Disclosure·Checkbox·Badge·SelectField를 재사용했다. CommitGraph에 compact 변형을 추가했다. 필요한 요약은 공통 ActionSummary로 생성해 index 공개·Storybook 리뷰/미확인/실패 상태를 추가했으며 화면별로 UI를 복제하지 않았다. DESIGN.md·UX-CONTRACT.md·IMPLEMENTATION.md·INTEGRATIONS.md·GIT_WORKFLOWS.md를 갱신했다.

Git 계속은 [공식 merge 문서](https://git-scm.com/docs/git-merge)와 [rebase 문서](https://git-scm.com/docs/git-rebase)의 계속 명령을 사용한다. 준비된 메시지로 진행하고 hooks·서명 설정은 유지한다. 작업 제어 파일의 내용/식별 정보와 검토 token을 재검사하며, 확인창을 연 뒤 외부 파일이 바뀌면 자동 갱신 여부와 무관하게 이전 승인을 재사용하지 않는다.

PM의 담당·검토 요청은 제공자의 반환 값으로 표시하며 미제공을 승인 완료로 바꾸지 않는다. [GitHub PR API](https://docs.github.com/en/rest/pulls/pulls), [GitLab MR API](https://docs.gitlab.com/api/merge_requests/).

## 실제 검증

- `pnpm check`: lint·renderer build·Storybook 74개·native 브라우저·Node 22개·Electron E2E·초안 복구 회귀·Storybook build 통과. [로그](check.log)
- 추가 회귀: 모든 상위 페이지 이동 후 초안 유지, 탭 닫기 취소, 실제 Electron 창 닫기 취소, 편집 버리고 정상 종료, 외부 파일 자동 반영 통과. [로그](recovery.log)
- Git 계속: 임시 merge/rebase 완료, 미해결/미스테이징 거절, operation 식별 변경과 stale token 거절 통과. 실제 Electron에서도 충돌 저장·해결 표시 후 2-parent merge 커밋 확인.
- PM: 두 프로젝트 모아보기, 한 CI의 권한 실패와 다른 결과 동시 유지, 상세 이동 후 선택/결과 복원 검증. OAuth 기본 ID 경로는 통제된 공개 ID와 HTTP 응답으로 확인.
- `premium` strict: 오류/위반 0. [JSON](premium-audit.json). DESIGN lint 오류 0·경고 0.
- `pnpm package:desktop`: 서명 없는 macOS arm64 번들 생성. [로그](package.log)
- 해당 번들의 전체 Electron E2E와 별도 초안/종료 회귀 통과. [전체](packaged-check.log), [초안/종료](packaged-recovery.log)
- Storybook 문서 번들의 500kB 초과 안내는 남아 있다. 빌드 실패가 아니며 이번 수정과 별개다.

## 화면

아래는 수정한 Electron 번들에서 캡처하고 직접 확인한 화면이다.

![최소 창의 compact 그래프](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-fixes-2026-09-14/packaged/repository-graph-narrow.png)

![여러 프로젝트의 PR/MR와 CI 모아보기](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-fixes-2026-09-14/packaged/project-watchlist.png)

![상세 스크롤 중 유지되는 원격 프로젝트 맥락](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-fixes-2026-09-14/packaged/desktop-review-files.png)

## 남은 조건

- 배포용 GitHub 공개 Client ID·GitLab 공개 Application ID를 [OAuth 설정](../../electron/oauth-clients.json)에 넣고 실제 계정 Device Flow·OS 보안 저장을 검증해야 일반 배포 로그인 완료다. Client Secret/토큰은 이 파일에 넣지 않는다.
- AI 대화·자동 수정과 PR/MR·CI 쓰기는 별도 미구현 기능이다. 이를 이미 동작하는 UI처럼 표시하지 않는다.
- 자동 갱신은 활성 저장소의 주기적 상태 읽기다. 대형 저장소 비용·파일 watcher·모든 비활성 탭 동시 갱신은 후속 범위다.
- 강제 프로세스 종료/OS 충돌 후 초안 복원, Git abort/강제 복구, 실제 VoiceOver·고배율·Windows/Linux는 검증하지 않았다.
- 실제 사용자 저장소·로그인 세션을 테스트로 변경하지 않았고, AI 추론·실계정 OAuth·원격 공개·서명된 release를 실행하지 않았다.
