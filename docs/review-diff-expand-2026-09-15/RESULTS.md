# PR/MR 변경 파일 확대 검증 · 2026-09-15

- ReviewResources의 파일 미리보기에 기존 InspectorPanel(integratedToolbar)·CodeDiff를 연결했다. 중복 파일 제목을 제거하고 같은 툴바에 크게 보기 버튼을 배치했다.
- 확대/복귀 때 같은 CodeDiff 인스턴스를 이동하므로 표시 방식·줄바꿈을 유지한다. 기존 Dialog·Esc·포커스 복귀를 재사용한다.
- patch 미제공 파일은 확대 버튼을 제공하지 않고 기존 안내를 유지한다. 파일별 잘림 안내는 확대 창에도 전달한다. 서버 원본 추가 조회 기능은 변경하지 않았다.
- `pnpm check` 전체 통과: lint/build, Storybook 171개, native UI, Git/Agent/hosting 53개, Electron E2E, UX 복구, Storybook build.
- 통제된 GitHub/GitLab 응답으로 좌우 비교 → 확대 → 닫기/Esc → 복귀, 줄바꿈 유지, 확대 코드 영역 너비 증가, 미제공 patch 안내를 검증했다. 운영 계정 원격 쓰기를 수행한 검증은 아니다.
- 760×580 최소 창에서 Dialog 경계·닫기 접근·자동 접근성 검증 통과.
- strict UI 감사 및 DESIGN.md lint: 오류/경고 0. `git diff --check` 통과. 기존 500kB 청크 경고 유지.

## 화면 근거

- [변경 파일 미리보기](./desktop-review-files.png)
- [좌우 비교 확대](./review-diff-expanded.png)
- [최소 창 확대](./review-diff-expanded-narrow.png)

## 실제 앱 확인

앱을 정상 종료하고 최신 코드로 다시 실행했다. 연결된 회사 GitLab의 기존 MR에서 SQL 변경 파일을 좌우 비교로 확대한 뒤 Esc로 닫아 보기 상태와 확대 버튼 포커스가 유지되는 것을 확인했다. 사용자가 바로 확인할 수 있도록 확대 화면을 다시 열어 두었다. 이 과정은 조회·보기 전환만 수행했다.
