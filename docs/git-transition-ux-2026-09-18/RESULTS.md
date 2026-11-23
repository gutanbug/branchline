# 체크아웃·Fetch/Pull 변경 보존 검증

## 원인과 수정

기존 공통 체크아웃/Pull 흐름은 변경이 있으면 먼저 Stash했다. 안전하게 그대로 이동할 수 있는 변경에도 보관·복원 단계를 실행했고, Pull은 네트워크 실패나 최신 상태를 확인하기 전부터 작업 파일을 옮겼다.

이제 Git의 변경 보존 동작을 먼저 사용한다. Git이 파일 덮어쓰기를 거부했고 실제 로컬 상태가 변하지 않았을 때만 기존 자동 Stash 경로를 실행한다. Pull은 Fetch와 최신/분기 확인을 먼저 처리한다. 다른 로컬 브랜치 Pull은 현재 브랜치를 전환하지 않는 기존 원자적 ref 갱신을 유지한다.

## 실제 Git 임시 저장소 시나리오

| 시나리오 | 검증 결과 |
| --- | --- |
| 로컬/원격 추적 브랜치 체크아웃 + 겹치지 않는 변경 | 변경을 그대로 이동, 임시 Stash 없음 |
| staged + unstaged 혼합, rename, 미추적/바이너리 파일 | index·작업 파일·기존 Stash 보존 |
| 같은 파일의 서로 다른 부분 변경 후 체크아웃/Pull | 필요 시 자동 Stash, staged/unstaged 구분 복원, 성공 후 자체 Stash 제거 |
| 실제 내용 충돌 | 대상 브랜치/받은 HEAD 유지, 원래 변경 Stash 보존, 충돌 상태 노출 |
| 미추적 중첩 저장소 및 staged gitlink | 내부 HEAD/index/작업 파일 유지, 겹치지 않는 부모 변경에 임시 Stash 없음 |
| 이미 최신 또는 로컬 브랜치 ahead 상태에서 Pull | 로컬 상태와 기존 Stash 유지 |
| 원격 연결 실패·없는 원격 브랜치·전송 취소 | 새 Stash 없이 로컬 변경 유지 |
| 원격/로컬 커밋이 분기된 Pull | Stash 전에 중단, 변경 유지, 비교 후 Merge/Rebase 안내 |
| A 브랜치에서 Fetch 또는 B 로컬 브랜치 Pull | A HEAD/index/작업 파일/Stash 유지, B만 fast-forward |
| B가 다른 Worktree에서 사용 중이거나 분기된 경우 | 강제 갱신 없이 거부 |
| ignored 파일/중첩 저장소 경로와 대상 파일 충돌 | 원본 덮어쓰지 않음, 필요한 복구 백업 유지 |
| post-checkout hook 실패 | 재실행하지 않음, 실제 전환 상태와 작업 변경 유지 |
| hook/외부 도구가 추가 변경 생성 | 복원/삭제를 무리하게 진행하지 않고 상태 노출 |

실행: `node --test electron/git.test.cjs electron/sync.test.cjs` — 37개 통과.

## 범위와 남는 보호 조건

검증용 Git 변경은 임시 저장소와 로컬 bare remote에서 실행했다. 실제 회사/개인 저장소에서 checkout·Pull·Stash 적용을 시험하지 않았다. 실제 충돌, ignored 파일 덮어쓰기 위험, 외부 도구의 동시 변경, 다른 Worktree 점유는 무조건 성공 처리하지 않는다. 이전 실패로 남은 Stash는 자동 적용하거나 삭제하지 않는다.

## 전체 검증과 실행 확인

- `pnpm check` 통과: lint, renderer build, Storybook 테스트 185개, native 검사, Git/백엔드 테스트 62개, Electron E2E, 초안 복구 E2E, Storybook build.
- 기존 Electron E2E에서 중앙 툴바와 우클릭 Fetch/Pull, 다른 브랜치 Pull, staged/unstaged/미추적 변경 보존, 오프라인 재시도, 충돌 화면 연결, 키보드 및 좁은 화면 접근성 통과.
- 디자인 strict audit: 오류·경고 0개. 기존 Vite 번들 크기 경고는 남아 있다.
- 앱 프로세스가 종료된 상태임을 확인한 뒤 `env -u ELECTRON_RUN_AS_NODE pnpm desktop`으로 최신 코드를 빌드·실행했다. 실제 Branchline 창의 기존 프로젝트 탭, 변경 파일 수, 커밋 그래프와 Fetch/Pull 툴바 표시를 확인했다.
