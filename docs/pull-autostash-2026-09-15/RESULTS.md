# 자동 Stash Pull — 2026-09-15

체크아웃의 Stash 처리를 공통 `withAutoStash`로 묶어 Pull에서도 사용한다. 사이드바/그래프 우클릭의 Fetch/Pull 하위 메뉴, 상단 툴바와 원격 화면을 모두 기존 sync IPC로 연결했다.

현재 변경이 있으면 미추적 파일까지 보관 → Fetch → 로컬 상태 재검증 → fast-forward → `stash apply --index` → 브랜치/HEAD/충돌 확인 → 해당 자동 Stash 삭제로 처리한다. 기존 Stash는 보존하고 ignored 파일을 덮어쓰지 않는다. 진행 중 작업·미해결 충돌은 계속 차단한다.

실패·취소 시 원래 HEAD/브랜치와 깨끗한 상태가 유지된 경우에만 원래 작업을 복원하며 복구용 Stash는 남긴다. 외부 변경이나 복원 충돌은 자동 삭제하지 않는다. Pull 후 복원 충돌은 받은 HEAD와 Stash를 유지하고 실제 unmerged 상태를 기존 AI 충돌 해결 화면에 연결한다. 스테이징 복원 실패를 숨기는 강제 재적용은 하지 않는다.

검증: `pnpm check` exit 0. UI 146개/41파일, Node 44개, native·Electron IPC/E2E·복구·Storybook build 전체 통과. Premium strict 및 DESIGN lint 오류·경고 0개. 기존 번들 크기 경고는 남아 있다.

실제 임시 Git/bare remote에서 staged/unstaged/untracked 및 바이너리 보존, 이전 Stash 보존, 분기 거부 후 복원, 원격 요청 취소, 적용 충돌과 후속 Pull 차단, ignored 파일 충돌, 외부 작업 파일 변경 보존을 검증했다. Electron에서는 변경이 있는 Pull의 활성화/확인/실행/삭제 및 충돌 화면 자동 이동을 확인했다. 기존 체크아웃 회귀도 통과했다. 실제 사용자 저장소·계정·원격을 테스트로 수정하지 않았으며 AI 과금 호출과 사용자 앱 재시작은 하지 않았다.

- [전체 검증](./check.log), [집중 Git 테스트](./git-tests.log)
- [자동 Stash 안내](./pull-autostash-preview.png)
- [충돌 화면 연결](./pull-autostash-conflict.png)
- [디자인 검사](./design-audit.log), [디자인 문서 lint](./design-lint.log)
