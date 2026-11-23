# 셸·협업 아이콘 작업 검증 · 2026-09-15

## 변경

- 앱 설정은 헤더 오른쪽 톱니바퀴, 저장소 열기·새 저장소·복제는 프로젝트 탭 옆 + 메뉴로 이동.
- 기존 Button·Tooltip을 조합한 IconButton과 ContextMenu의 menuOnly 변형 사용. 새 라이브러리·테마 없음.
- 프로젝트 현황의 새로고침·외부 열기·목록 복귀·검색 지우기·필터 초기화·PR/MR 생성 진입을 아이콘으로 통일. 실행 결과를 구분해야 하는 병합·승인·CI 제어와 오류 재시도는 텍스트 유지.
- 한국어 접근성 이름, 44px 클릭 영역, 로딩 중 중복 실행 차단과 고정 크기, reduced-motion 적용.

## 검증

- `pnpm check` 통과: lint, renderer build, Storybook 171개 테스트, native 검증, Git/Agent/호스팅 53개 테스트, Electron 전체 회귀, UX 복구, Storybook build.
- 메뉴 Enter·방향키·Escape·원래 버튼 포커스 복귀, 복제 Dialog의 Escape/취소와 포커스 복귀 검증.
- 임시 Git 저장소에서 열기·복제·탭 복원, 760×580 최소 창에서 메뉴 경계·탭 넘침·+ 버튼 접근 확인.
- GitHub/GitLab은 통제된 API 응답으로 기존 조회·생성 진입·승인/병합 검토·CI·오류 복구·권한과 접근성 검증. 운영 계정의 원격 쓰기를 실행한 검증은 아님.
- strict UI 정적 감사: 오류·경고 0 (`static-audit.json`). DESIGN.md lint 오류·경고 0. `git diff --check` 통과.
- 기존 renderer/Storybook의 500kB 청크 경고는 유지.

## 화면 근거

- [탭 옆 추가 메뉴 · 최소 창](./repository-add-narrow.png)
- [탭 가로 스크롤 중 + 고정](./repository-tabs-overflow.png)
- [프로젝트 현황의 아이콘 작업](./current-project.png)
- [리뷰 변경 파일 작업](./desktop-review-files.png)

## 앱 재시작

실행 중인 Branchline을 Cmd+Q로 정상 종료한 뒤 `env -u ELECTRON_RUN_AS_NODE pnpm desktop`으로 최신 빌드를 실행했다. 실제 열린 프로젝트 3개가 복원되었고 헤더 설정 아이콘, 탭 옆 저장소 추가 메뉴의 세 항목 및 Escape 복귀를 확인했다.
