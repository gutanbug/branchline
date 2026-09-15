# 브랜치 우클릭 Fetch/Pull — 2026-09-14

BranchMenu/ContextMenu를 확장하여 사이드바·그래프 배지에서 Fetch/Pull을 제공한다. RemoteWorkspace의 기존 확인창과 sync IPC를 재사용하며 새 Git 실행 경로나 의존성을 추가하지 않았다.

- LOCAL: remote upstream을 기본 대상으로 사용한다. 미설정·로컬 전용 추적은 설정 안내, 다른 로컬 브랜치의 Pull은 체크아웃 안내를 제공한다.
- REMOTE: 해당 원격에서 Fetch 또는 현재 로컬 브랜치로 fast-forward Pull한다. 작업 파일·진행 중 작업·detached HEAD의 Pull은 비활성화한다.
- 확인창의 대상은 고정하고 툴바 선택과 분리한다. 구성된 원격 이름의 가장 긴 접두사로 슬래시가 있는 이름을 처리한다. Fetch는 해당 원격 전체 이력을 가져온다. Pull은 원격 → 로컬 방향으로 표시한다.

`pnpm check` exit 0: UI 144개/41파일, Node 38개, native·Electron IPC/E2E·오류/초안 복구·Storybook build 통과. Premium strict와 DESIGN lint 오류·경고 0개. 기존 번들 크기 경고는 유지된다.

임시 로컬 bare remote에서 실제 Fetch/Pull, 로컬/원격 브랜치 이름 차이, 슬래시 원격 이름, 툴바 대상과 격리, 미설정·다른 로컬·미커밋 변경 차단, 키보드 메뉴·취소 후 포커스, 오프라인 재시도, 760×580 접근성을 검증했다. 전체 테스트에서 새 저장소를 열기 전 이전 화면을 누르던 테스트 순서를 고친 뒤 전체 통과했다. 실제 사용자 저장소·계정·원격은 테스트로 변경하지 않았다. 사용자 앱은 재시작하지 않았다.

- [전체 검증 로그](./check.log)
- [우클릭 메뉴](./branch-sync-menu.png)
- [Pull 확인](./branch-pull-preview.png), [좁은 창](./branch-pull-narrow.png)
- [Premium strict](./design-audit.log), [DESIGN lint](./design-lint.log)
