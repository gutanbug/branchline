# Fetch/Pull 2단 메뉴 — 2026-09-14

공통 ContextMenu의 항목에 하위 items를 지원하고 설치된 Base UI SubmenuRoot/SubmenuTrigger/Positioner/Popup을 재사용했다. BranchMenu의 `Fetch / Pull ›` 아래 Fetch와 Pull을 배치했으며 기존 실행·대상 검증은 유지한다. 사이드바 우클릭·⋯ 및 그래프 브랜치 배지에 동일하게 적용된다.

- 호버·클릭·오른쪽 방향키로 진입하고 왼쪽 방향키/Esc는 하위 메뉴부터 닫는다.
- 자식 액션의 비활성 이유를 유지하며 확인창 종료 후 원래 브랜치에 포커스를 돌려준다.
- 화면 경계 위치 보정과 내부 스크롤을 공유하고 760×580 화면에서 두 메뉴의 경계를 검증했다.

검증: `pnpm check` exit 0. UI 145개/41파일, Node 38개, native·Electron E2E·초안 복구·Storybook build 전체 통과. Premium strict/디자인 lint 오류·경고 0개. 실제 임시 bare remote에서 하위 메뉴 Fetch/Pull, 방향·추적 대상, 실패 후 재시도, 작업 파일 보존, 키보드·접근성을 확인했다. 사용자 저장소/계정으로 테스트하지 않았으며 실행 중 사용자 앱은 재시작하지 않았다. 기존 번들 크기 경고는 남아 있다.

- [전체 로그](./check.log)
- [2단 메뉴](./branch-sync-menu.png)
- [좁은 창](./branch-submenu-narrow.png)
- [디자인 검사](./design-audit.log), [디자인 문서 lint](./design-lint.log)
