# Branchline — Claude Code 핸드오프 노트

이 저장소는 **OpenDesign(Web Prototype 스킬)에서 디자인/프로토타이핑 도구로 반복 작업하며 만들어진 Electron Git 클라이언트**입니다. `npm start`로 실제로 실행되고, 실제 저장소를 열면 시스템 `git` CLI를 진짜로 호출합니다 — 겉모습만 있는 목업이 아닙니다. 다만 UI 전체가 **단일 HTML 파일**(`branchline.html`, 약 170KB)에 들어있는 것은 프로토타이핑 툴의 제약(`check-prototype.cjs`가 "정확히 `<script>` 2개"를 강제) 때문이며, Claude Code로 넘어온 뒤에는 이 제약에 얽매일 필요가 없습니다. 아래 "리팩터링 시 주의할 점"을 먼저 읽으세요.

## 실행·검증

```sh
npm install
npm start          # Electron 창 실행 (electron-main.cjs가 진입점)
npm test           # node check-prototype.cjs — branchline.html의 두 <script>가 구문적으로 유효한지 + 핵심 순수 함수(compareRefs, filterRows, reachable, pickCommits 등) 단위 검증
```

앱은 두 모드로 동작합니다.
- **데모 모드**: 저장소를 열지 않은 초기 상태. `branchline.html`의 `<script id="model">` 안에 있는 예제 커밋 그래프(`commits`, `refs`, `wip`, `stashes` 등 메모리 내 배열)로 전체 UI를 조회·조작할 수 있습니다. 새로고침하면 초기화됩니다.
- **실사용 모드(`realMode=true`)**: 상단 "+ 저장소 열기"로 실제 로컬 저장소를 선택하면 진입. 이후 모든 동작은 `electron-main.cjs`의 IPC 핸들러 → `git-backend.cjs`의 `execFile('git', args, {cwd})` 실행으로 이어집니다(쉘 미사용, 인수 배열 방식).

## 파일 지도

| 파일 | 역할 |
|---|---|
| `branchline.html` | 프런트엔드 전체. `<script id="model">`(상태·순수 로직·렌더 함수) + `<script id="ui">`(부트스트랩/이벤트 바인딩) 두 블록만 존재해야 `npm test`가 통과함(리팩터링 후 이 제약을 없애려면 `check-prototype.cjs`도 함께 정리) |
| `electron-main.cjs` | Electron 메인 프로세스. `handle(channel, fn)` 제네릭 래퍼로 `ipcMain.handle`을 등록하고 `{ok:true,value}` / `{ok:false,message}` 형태로 통일해서 반환 |
| `preload.cjs` | `contextBridge`로 `window.gitAPI` / `window.githubAPI` / `window.terminalAPI` / `window.appAPI` 노출. `contextIsolation` 유지 |
| `git-backend.cjs` | 실제 git 실행 로직. `run(cwd,args)` / `runWithInput` / `runEnv` 기반의 함수 65개+ (브랜치·스태시·태그·워크트리·서브모듈·LFS·리베이스·리셋·blame·reflog 등) |
| `github-backend.cjs` | GitHub REST API 클라이언트(fetch 기반, PAT 선택 입력). PR 목록 조회는 실제 동작, 생성/병합 IPC 채널은 있으나 실제 API 연동은 미완성 상태이므로 착수 전 재확인 필요 |
| `git-client-spec.md` | GitKraken 12.4.1 기준 기능 목표 명세(G01–G45). **상태 열("예제"/"미구현")은 조사 시점(2026-09-11) 기준 초안이며 이후 세션에서 다수 항목이 실제로 구현됐습니다. 이 표의 상태 열을 신뢰하지 말고, 아래 "실제 구현 상태" 절과 README.md를 기준으로 판단하세요.** 기능 범위(G01~G45 목록 자체)와 "두 브랜치 비교의 정확한 의미" 절(reachability 기반 정의)은 여전히 유효합니다 |
| `README.md` | 세션 진행 로그에 가깝게 누적된 문서. 상단이 개요/실행법, 이후로 각 변경사항이 시간순으로 추가되어 있어 최신 상태 파악에는 상단 기능 목록을 우선 참고 |
| `brand-spec.md` | 컬러/타이포 토큰 |

## 실제 구현 상태 (git-client-spec.md 표보다 이 목록을 신뢰할 것)

README.md 상단에 열거된 실사용 모드 기능 기준으로, `git-client-spec.md`에서 "미구현"으로 적혀 있지만 **실제로는 구현된** 항목:

- G07 브랜치 관리 — 생성/체크아웃/이름변경/삭제/원격추적 실동작
- G08 네트워크 Git — fetch/pull(ff, ff-only, rebase 3전략)/push/upstream 설정 실동작
- G15 병합, G17 rebase(비인터랙티브) — 사이드바에서 실행, `operationState()`로 충돌 감지
- G16 충돌 해결 — 배너 + 파일별 ours/theirs 선택 + abort/continue
- G22 워크트리, G23 submodule, G24 Git LFS — 추가/상태/업데이트/제거 실동작
- G26 서명 — 커밋 시 서명 선택 + 이력의 `%G?` 검증 상태 표시

여전히 "미구현" 또는 "예제(시뮬레이션)"인 주요 항목 (실제 우선순위 후보):
- G01/G02 저장소 수명주기·다중 탭 — 현재는 탭이 있지만 "최근/즐겨찾기 저장소" 영속화는 없음
- G09 파일 작업(생성·삭제·편집기), G11 ignore 규칙 — IPC 채널(`readWorkingFile` 등)은 있으나 UI 커버리지 재확인 필요
- G14 파일 이력·blame — 백엔드 함수(`parseBlame` 등)는 존재, UI 노출 범위 확인 필요
- G25 Gitflow — 사이드바에 진입점만 있고 규칙 기반 시작/완료 로직은 미완성
- G27 터미널 — `terminalAPI`(PTY 유사 start/input/kill/onData)는 있으나 범위(다중 세션, worktree별) 재확인
- G28 프로필·인증, G29 다중 호스팅(GitLab/Bitbucket/Azure DevOps) — GitHub만 지원
- G30~G33 PR/MR — 목록 조회는 실동작(GitHub REST), 생성/리뷰/병합은 미완성
- G34/G35 이슈·Launchpad, G36~G41 협업·Actions·Cloud Patches·AI·에이전트·최신 worktree UX — 전부 미구현
- G42 사용성 설정 — 커맨드 팔레트(⌘K)는 있음, 테마/그래프 열 커스터마이즈 등은 부분적
- G44 배포 — Electron 진입점만 있고 서명된 설치 파일 빌드 파이프라인 없음

**착수 전에 항상 `grep`으로 실제 코드를 확인하세요** — 이 목록도 스냅샷일 뿐입니다.

## 프런트엔드 아키텍처 (디자인 세션에서 자리잡은 관례)

리팩터링하더라도 아래 동작/개념은 의도적으로 설계된 것이니 유지하는 것을 권장합니다.

1. **`$(id)` = `document.getElementById`, id는 항상 유일해야 함.** 같은 화면에 같은 id를 가진 요소가 두 개 있으면 `$()`가 조용히 잘못된 요소를 반환합니다. 이 때문에 아래 2번 구조가 나왔습니다.
2. **`#content`(백드롭) + `#view-overlay`(전면 오버레이) 이중 구조.** 커밋 그래프는 항상 `#content`에 그려지고, "브랜치 비교/작업 변경/PR·MR/워크트리/..." 같은 화면은 `#view-overlay`가 `#content` 위를 덮으며 렌더링됩니다. 두 컨테이너가 동시에 같은 id(`history-content`, `apply-tray`, `commit-detail` 등)를 갖지 않도록 `render()`가 배타적으로 그립니다. 모달이 아니라 "덮는 화면 + 닫기 버튼"으로 요구된 UX입니다.
3. **`branch` vs `viewBranch` 분리.** `branch`는 실제 `git checkout`된 HEAD. `viewBranch`는 그래프에서 "보고 있는" 필터 대상(널이면 전체 브랜치의 커밋을 함께 표시). 단일 클릭(`selectBranchView`)은 `viewBranch`만 바꾸고, 더블클릭(`showBranch`)은 그래프로 이동까지 하며, **실제 체크아웃은 우클릭 컨텍스트 메뉴의 "체크아웃"에서만** 실행됩니다(`checkoutBranch`). 이 3단 분리는 사용자 요구로 명시적으로 도입된 것이라 되돌리지 마세요.
4. **사이드바 브랜치 트리 들여쓰기.** LOCAL/REMOTE 아래 `buildBranchTree`/`renderBranchNode`가 폴더(`feature/`, `fix/` 등 `/` 구분)를 재귀 구성합니다. 리프 브랜치도 폴더와 동일한 시각적 컬럼에 정렬되도록 `.tree-leaf`(체브런 자리만큼 들여쓰기) + `icon('branch')`를 붙여둔 상태입니다. 폴더 대비 리프의 정렬 픽셀 계산(`.branch-item`, `.branch-folder summary`, 들여쓰기 단계 24px)이 얽혀있으니 건드릴 땐 세 클래스를 함께 확인하세요.
5. **브랜치 필터는 네이티브 `<select>`가 아니라 자체 드롭다운.** `openBranchFilterMenu()`가 `#context-menu`를 재사용해 검색 입력(`#branch-filter-input`) + 결과 리스트(`#branch-filter-list`)를 렌더링합니다. 입력 필드와 리스트를 별도 노드로 분리해 타이핑 중 포커스가 끊기지 않게 한 패턴이니, 다른 검색형 드롭다운을 추가할 때도 이 패턴을 재사용하세요.
6. **"변경 내용"류 UI는 전부 클릭 후 표시 원칙.** 커밋 상세(`renderDetail`, `activeId` 기반)와 "변경 파일" 탭 모두 특정 커밋을 클릭하기 전에는 안내 문구만 보여줍니다. 새 화면을 추가할 때도 이 원칙(선택 전 콘텐츠 노출 금지)을 따르세요.
7. **Fetch/Pull 전략, 헤더 툴바 버튼.** `.toolbar-btn`(테두리 없음, 아이콘 위·라벨 아래, hover 시에만 배경)이 GitKraken 스타일 기준. Pull은 `pullRepo(strategy)`로 `ff`/`ff-only`/`rebase` 3가지, `git-backend.cjs`의 `PULL_STRATEGY_FLAGS`와 1:1 매핑.

## 리팩터링 시 주의할 점

- **단일 HTML 파일 제약은 OpenDesign 프로토타이핑 환경의 산물입니다.** Claude Code에서 계속 개발한다면 `branchline.html`을 `src/` 아래 모듈(상태/렌더/IPC 클라이언트 등)로 쪼개는 것을 권장하되, 쪼갠 뒤에는 `check-prototype.cjs`(정확히 `<script>` 2개를 가정)를 실제 빌드 산출물 검증 스크립트로 교체하거나 제거하세요. `package.json`의 `test` 스크립트도 함께 갱신해야 합니다.
- 프런트엔드에는 번들러가 없습니다(순수 HTML+인라인 JS, 외부 리소스 0개). 모듈화하려면 최소한의 번들 단계(esbuild 등)를 새로 들여와야 하며, 이는 Electron 패키징(G44)과도 연결된 작업입니다.
- `git-backend.cjs`/`electron-main.cjs`/`preload.cjs`는 이미 Node.js 표준 구조라 그대로 확장 가능합니다. IPC 채널을 추가할 때는 기존 `handle('git:xxx', ...)` 제네릭 패턴과 `{ok,value|message}` 응답 형태를 유지하세요.
- `github-backend.cjs`는 GitHub 전용입니다. G29(다중 호스팅) 착수 시 provider 추상화가 필요합니다.

## 참고 순서 제안

1. `README.md` 상단 "실제 Git 저장소에 연결하려면..." 절부터 읽고 실제 동작 범위 확인
2. `git-client-spec.md`의 G01~G45 표에서 목표 기능 범위 확인(상태 열은 무시)
3. 이 문서의 "실제 구현 상태" 절로 갭 목록 확인
4. `branchline.html`에서 관련 함수를 `grep`으로 찾아 현재 동작을 코드로 재확인한 뒤 작업 시작
