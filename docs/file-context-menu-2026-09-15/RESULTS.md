# 변경 파일 우클릭 메뉴

사용자 제공 GitKraken 파일 메뉴를 참고해 내 변경 사항의 작업 파일·스테이징 파일에 공통 ContextMenu를 적용했다. 파일 행의 ⋯, 우클릭, Shift+F10은 같은 작업을 제공한다.

## 연결된 기능

- 기존 mutate 경로를 사용하는 스테이징/해제, 파일 diff 선택, 이 파일 Stash.
- 파일·확장자·폴더별 무시 규칙 하위 메뉴와 범위 확인. root .gitignore에 literal 경로 패턴을 추가하고 실제 제외되지 않으면 예외 규칙을 안내한다.
- 파일 경로를 지정한 기존 커밋 그래프와 HEAD 기준 Blame. 작업 폴더 편집 탭과 미저장 초안 보호를 재사용한다.
- 상대/전체 경로 복사 하위 메뉴, 기본 프로그램, 파일 위치, 선택 범위의 binary-capable patch 내보내기.
- 작업 트리만 인덱스로 복원하는 변경 취소. 실제 파일 삭제는 휴지통 이동으로 처리하며 모두 범위 확인 후 실행한다.

## 소유권과 검증

FileChangeRow → ContextMenu, FileActions → Dialog/Notice/CodeDiff, 편집 → 기존 WorkingFiles를 재사용했다. Button은 React 19 ref를 전달할 수 있도록 타입을 확장했다. 토큰·색·타입 스케일·메뉴 레이아웃은 기존 시스템과 일치한다. 새로운 UI 의존성은 없다.

- `node --test electron/file-actions.test.cjs`: 실제 임시 저장소에서 index/worktree 분리, stale 거부, 단일 파일 Stash와 다른 staged 파일 보호, 한글/특수 경로, 무시 규칙과 예외, binary patch 제한, 링크 차단, 휴지통 어댑터와 취소 결과 검증.
- `node scripts/check-file-menu.mjs`: 격리된 Electron 프로필에서 우클릭/⋯/Shift+F10, 2단 메뉴 방향키·Esc, 좁은 창과 접근성, 확인창 취소 포커스, discard 취소/실행, 실제 stage/unstage, ignore, 패치 저장 취소/저장, 편집 탭 이동 검증.
- `deleted-folder-check.log`: 상위 폴더까지 삭제된 파일의 개별 복원 확인.
- `design-audit.json`, `design-lint.log`: 엄격 디자인 감사와 DESIGN lint 모두 오류·경고 0.
- 전체 검사는 `check.log`, 시도 중 메뉴 전환 대기/비활성 저장소 locator 문제는 별도 attempt 로그로 보존했다. 확인창 포커스 문제는 공통 Button의 ref 지원과 실제 focus 호출로 수정했다.

## 범위와 조건

외부 IDE·difftool을 앱에서 지정하는 설정은 추가하지 않았다. 운영체제 기본 프로그램이 IDE이면 기본 프로그램 열기를 사용할 수 있다. 실제 Finder/기본 프로그램 실행·운영체제 휴지통 이동은 이 테스트에서 실행하지 않았고 main 연결은 공식 Electron API를 사용한다. 휴지통 동작은 임시 파일 이동 어댑터로 검증했다.

파일 Stash는 다른 파일이 staged 상태이거나 이름 변경, 첫 커밋 전, 충돌/진행 작업이면 제한한다. 새 바이너리·큰 파일은 먼저 stage한 뒤 patch를 내보낸다. 기존 파일 덮어쓰기는 허용하지 않는다. 경로 검증은 일반 파일만 허용하고 링크/중첩 저장소는 별도로 연다. 외부 프로세스와 OS 수준의 배타 잠금은 제공하지 않는다.

회사/개인 실제 저장소·계정은 테스트에 사용하지 않았다. 앱 재시작·설치본 패키징·서명·배포는 이번 작업에 포함하지 않는다.

공식 근거: [Electron shell](https://www.electronjs.org/docs/latest/api/shell), [Git stash](https://git-scm.com/docs/git-stash), [Git ignore](https://git-scm.com/docs/gitignore). Git Stash의 다른 staged 파일 포함 여부와 .gitignore 우선순위는 실제 fixture에서도 확인했다.

[기본 메뉴 화면](./file-menu.png) · [좁은 창 하위 메뉴](./file-menu-narrow.png)

## 최종 결과

`pnpm check` 종료 코드 0. UI 154개/46개 파일, Node 48개, native 검사, 전체 Electron E2E, 복구 흐름, Storybook 빌드가 통과했다. renderer/Storybook의 기존 500 kB chunk 안내만 남아 있다. 전용 Electron 검사도 종료 코드 0이다. 삭제된 상위 폴더 복원, 무시 예외 규칙 거부/부분 적용 안내까지 확인했다.
