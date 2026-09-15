# Branchline 프론트엔드 아키텍처

> 기준일: 2026-09-12 · 현재 코드 분석 및 향후 개발 기준
> 루트 앱은 기능 중심 구조로 확장했습니다. 전체 제품 완료 범위는 [구현 상태](./IMPLEMENTATION.md)를 기준으로 봅니다.
> 사용자 확정: 제품 런타임과 빌드·릴리스는 **Electron**을 사용합니다. 루트 Vite 앱에 Electron main/preload와 로컬 패키징을 연결했습니다. 서명·공개 릴리스는 남아 있습니다.

## 1. 채택할 구조

**기능 중심 구조(Feature-based Architecture)**를 사용합니다. 앱 초기화는 `app`, 제품 기능은 `features`, 공통 UI는 기존 `design-system`에 둡니다. 기능의 UI·상태·타입을 가까이 배치해 하나의 기능을 수정할 때 여러 전역 폴더를 오가지 않도록 합니다.

프론트엔드 전체에서 사용량 1위인 폴더 구조를 확정할 근거는 없습니다. 기능별 구성은 [Redux 공식 가이드가 권장하는 패턴](https://redux.js.org/faq/code-structure/)이며, [Bulletproof React의 프로젝트 구조](https://github.com/alan2207/bulletproof-react/blob/master/docs/project-structure.md)에서도 사용합니다. 여기서는 그 원칙을 현재 규모에 맞게 적용합니다. Redux 설치를 전제로 하지 않습니다.

현재 Branchline은 Electron 로컬 알파와 기존 디자인 시스템 예제입니다. 전체 FSD 계층, 마이크로 프론트엔드, 별도 패키지 분리는 도입하지 않습니다. 아래 이동 계획은 현재 Workspace를 정리하는 범위입니다. [제품 전략](./PRODUCT.md)에 따라 첫 제품 버전은 개발자와 PM을 동등하게 지원하며, 구현 단계에서는 `team-overview`, `reviews` 등 실제 기능을 함께 추가합니다. [디자인 가이드](./DESIGN.md)는 공통 시각 기준을 정의합니다.

프로젝트 탭·worktree·AI·OAuth·MCP의 실행 경계와 데이터 식별 규칙은 [확장 설계](./INTEGRATIONS.md)를 따릅니다. 아래 폴더 트리는 기존 예제 코드 이동 기준이며 전체 제품의 완성 구조가 아닙니다.

브랜치 비교·필터·PR/MR·CI의 동작 계약과 완료 기준은 [Git 작업 명세](./GIT_WORKFLOWS.md)를 따릅니다. 비교·필터는 `workspace`, 원격 검토는 `reviews`에서 시작하며, CI를 독립 탐색하는 화면이 구현될 때 해당 기능 모듈을 추가합니다.

## 2. 현재 구조와 실행 흐름

루트 `package.json` 기준으로 React 19, TypeScript 6, Vite 8, Storybook 10, Vitest 4, Playwright를 사용합니다. `@base-ui/react`도 설치되어 있지만 현재 `src/design-system` 구현은 React와 네이티브 HTML 요소를 사용합니다. 라우터와 외부 전역 상태 관리 라이브러리는 없습니다.

```text
electron/
├── main.cjs                 # 창·sender 검증·허용 저장소·로컬 설정·IPC
├── preload.cjs              # 명시적으로 허용한 API만 renderer에 전달
├── git.cjs                  # Git CLI 상태·조회·검토 토큰·쓰기 큐
├── agents.cjs               # CLI 버전 탐지·Codex 읽기 전용 한도 조회
├── sync.cjs                 # 원격·clone·stash·전송 취소
├── hosting.cjs              # Device Flow·암호화 인증·PR/MR/CI 조회
├── reviews.cjs              # 버전 재검증·파일/논의/리뷰·SHA별 검사
├── mcp.cjs                  # 허용 저장소의 읽기 전용 stdio 서버
└── *.test.cjs               # 임시 저장소/가짜 프로토콜 테스트
src/
├── main.tsx / App.tsx        # React 진입·desktop/demo 분기
├── app/                     # DesktopApp·IPC 타입·앱 레이아웃
├── features/workspace/      # 변경·이력·비교·worktree
├── features/agents/         # 개별 Agent 설정·사용량
├── features/hosting/        # 계정 연결·원격 협업 조회
├── design-system/           # 기존 공통 UI·demo Workspace·토큰 보정
└── stories/                 # 공통 UI 예제 63개
scripts/                     # native/Electron 검사·packager
branchline-design-system-handoff/ # 보존한 원본 디자인·참고 구현
```

```text
main.tsx → App → DesktopApp → RepositoryWorkspace / AgentSettings / HostingWorkspace
                            → window.branchline (preload)
                            → main의 sender/경로 검증 → git.cjs / sync.cjs / agents.cjs / agent-chat.cjs / hosting.cjs / hosting-writes.cjs
App (?demo=1) → 기존 Workspace → examples.ts
```

앱 탭·필터·초안은 React 상태와 main의 userData 설정에 저장한다. 상세 요청은 저장소·조건 키로 오래된 응답을 버린다. 기존 Workspace의 Fetch 등은 `?demo=1` 안의 예제이며 운영 경로와 구분한다. 아직 미구현인 기능을 위해 별도 상태 라이브러리나 provider 추상 계층을 만들지 않는다.

## 3. 권장 폴더 구조

다음은 **첫 구조 정리 시의 목표**입니다. 파일을 옮길 때만 해당 폴더를 생성합니다.

```text
src/
├── main.tsx
├── index.css
├── app/
│   └── App.tsx                # 앱 진입 화면과 전역 조합
├── features/
│   └── workspace/
│       ├── Workspace.tsx     # 기능 화면과 공유 상태 소유
│       ├── BranchFilter.tsx  # 브랜치 조회 필터
│       ├── BranchTree.tsx    # 브랜치 탐색
│       ├── CommitList.tsx    # 커밋 목록
│       ├── DetailPanel.tsx   # 커밋 상세
│       ├── ApplyTray.tsx     # 선택 변경 적용 영역
│       ├── types.ts          # Commit 등 기능 타입
│       └── examples.ts       # 현재 데모·스토리용 데이터
├── design-system/
│   ├── index.ts              # 공통 UI 공개 진입점
│   ├── components.tsx        # Button, TextField, Dialog 등
│   └── system.css
└── stories/                  # 기존 스토리 위치 유지
```

공통 UI를 이름만 바꾸기 위해 `shared/ui`로 옮기지 않습니다. `design-system`을 공통 UI의 유일한 위치로 사용합니다. 작은 기본 컴포넌트는 기존 `components.tsx`에 유지하고, 독립적으로 수정하기 어려워질 때 개별 파일로 분리합니다.

| 나중에 추가할 위치 | 생성 조건과 책임 |
| --- | --- |
| `features/<기능>/` | 독립된 사용자 작업과 상태를 가진 기능이 생길 때 |
| `features/workspace/useWorkspace.ts` | 화면에서 상태 전이·비동기 처리를 분리할 실제 필요가 생길 때 |
| `features/workspace/api.ts` | 실제 데이터 연결이 생길 때 기능별 조회·변경 함수 배치 |
| `features/workspace/*.test.ts` | UI와 독립된 필터·변환·상태 전이 로직을 추출할 때 |
| `shared/` | 여러 기능에서 실제로 공유하는 비 UI 코드가 생길 때 |
| `app/routes.tsx` | URL로 접근할 여러 화면과 라우터를 도입할 때 |
| `app/providers.tsx` | 앱 전체에 필요한 Context 등의 설정이 늘어날 때 |

`pages`, `hooks`, `utils`, `services`, `store`를 빈 전역 폴더로 미리 만들지 않습니다. 한 기능에서만 쓰는 훅·함수·타입은 해당 기능에 둡니다.

## 4. 의존성과 공개 경계

허용하는 import 방향은 다음과 같습니다. `shared`는 실제로 도입한 이후에만 적용합니다.

```text
app → features → design-system
 │       │             │
 └───────┴─────────────→ shared
```

- `app`은 기능을 조합하고 필요하면 공통 UI를 직접 사용합니다.
- `features`는 자기 기능 내부와 `design-system`, `shared`를 사용합니다.
- `design-system`은 `app`과 `features`를 import하지 않습니다. 입력값과 콜백으로 동작합니다.
- `shared`는 기능·화면을 알지 못합니다. `Commit`처럼 특정 기능에 속한 타입을 편의상 이동하지 않습니다.
- 서로 다른 기능을 직접 연결해야 한다면 우선 `app`에서 값과 콜백으로 조합합니다. 공통 코드 이동은 실제 재사용이 확인된 뒤 결정합니다.
- 스토리는 기능과 공통 UI를 import할 수 있지만 제품 코드는 스토리를 import하지 않습니다.

공통 UI는 `design-system/index.ts`의 명시적 export를 사용합니다. 기능은 필요한 파일을 직접 import하고, 외부 사용 지점이 늘어 공개 목록 관리가 필요해지면 기능의 `index.ts`를 추가합니다. 기능 내부에서는 자기 `index.ts`를 거쳐 순환 참조를 만들지 않습니다.

현재 경로 별칭은 설정되어 있지 않으므로 상대 경로를 사용합니다. `@/` 별칭이 필요해지면 TypeScript와 Vite 양쪽에서 해석되도록 설정한 후 사용합니다.

## 5. 상태와 데이터 처리

| 상태 종류 | 배치 원칙 | Workspace 예시 |
| --- | --- | --- |
| 컴포넌트 내부 상태 | 해당 컴포넌트의 `useState` 또는 DOM 기능 | BranchFilter 내부 검색어, dialog ref |
| 여러 하위 UI가 공유하는 상태 | 가장 가까운 공통 부모 | 조회 브랜치, 커밋 검색어, 선택 상태 |
| 계산 가능한 값 | 원본으로부터 렌더링 중 계산 | 검색 결과, 선택 개수 |
| 외부 데이터 | 연결 도입 시 기능의 API 함수와 데이터 처리 훅 | 저장소 브랜치·커밋 목록 |
| 앱 전체 상태 | 여러 화면이 실제 공유할 때 상위 Context 등 검토 | 향후 활성 저장소 |

중복 상태를 줄이고 선택 항목은 가능하면 ID로 보관한 뒤 원본에서 찾습니다. 예를 들어 외부 커밋 데이터를 연결할 때는 `selectedHash`를 저장하고 최신 목록에서 선택 커밋을 계산합니다. 이는 [React의 상태 구조 지침](https://react.dev/learn/choosing-the-state-structure)에 따른 권장 변경이며, 기존 demo는 `Commit` 객체를 저장하고 제품 UI는 SHA 또는 파일 경로를 저장합니다.

조회 브랜치와 실제 체크아웃 브랜치는 서로 다른 상태로 유지합니다. 검색 또는 조회 브랜치 변경 시 상세 선택과 변경 포함 여부를 초기화하는 기존 동작도 유지합니다. 계산 결과를 동기화하기 위한 불필요한 `useEffect`나 전역 저장소를 추가하지 않습니다.

실제 연결 시에는 UI 이벤트 → 기능의 처리 함수/훅 → `api.ts` → 외부 시스템 순서로 흐르게 합니다. 기본 UI가 직접 Git 명령이나 네트워크 요청을 실행하지 않도록 합니다. 로딩·오류·빈 결과를 구분하고 실패 시 성공 메시지를 표시하지 않습니다. 저장소나 조회 조건이 바뀌었을 때 이전 요청 결과가 새 화면을 덮어쓰지 않도록 처리합니다.

로컬 Git·Agent 인증·OAuth·MCP는 Electron 호스트에서 처리하고 renderer는 상태와 결과만 사용합니다. 로컬 Git·Agent 설정·Codex 한도·OAuth/호스팅 조회 코드는 연결했고 읽기 전용 MCP도 연결했고 AI 대화와 MCP 쓰기는 후속 작업입니다. OAuth는 실제 계정 승인과 OS 보안 저장소 검증이 남아 있습니다. 외부 응답은 TypeScript 타입 선언만으로 검증된 것으로 보지 않으며, 실행 경계에서 입력과 응답을 검증합니다. 현재 예제 브랜치 이름 정규식은 실제 Git 이름 검증을 대신하지 않습니다.

프로젝트 탭은 `app`에서 조합하되 저장소 상태를 하나의 전역 활성 경로에 덮어쓰지 않습니다. 요청과 AI 대화는 repository/worktree/tab/operation 식별자를 사용하며 응답 수신 시 원래 대상과 입력 버전을 확인합니다. 같은 저장소의 linked worktree는 공통 Git 디렉터리를 공유하므로 초기 쓰기 대기열도 그 단위로 묶습니다. 호스팅 계정·Git transport 인증·Agent 인증·작성자 설정은 별개로 소유합니다. OAuth 토큰은 UI 상태나 MCP 응답에 넣지 않습니다.

실제 비교는 로컬 호스트에서 검증한 ref를 SHA로 고정해 Git의 조상 집합을 조회합니다. 필터는 전체 지정 범위에 적용한 뒤 페이지로 반환하고 renderer는 표시·가상화만 담당합니다. 응답에는 입력 SHA·조건·조회 범위의 완전성·다음 페이지 정보를 붙입니다. 오래된 요청은 취소하거나 결과를 버립니다. 현재 로드한 예제 배열의 브랜치 이름·400행 제한을 실제 비교 알고리즘으로 재사용하지 않습니다.

원격 데이터는 `provider + host + repositoryId + PR/MR 번호`와 fork/head/base·diff 버전을 보존합니다. CI 실행 ID·시도·검사 SHA·이벤트·PR/MR 관계도 함께 유지합니다. 계정별 캐시를 분리하고 API 페이지네이션·한도·부분 실패를 처리합니다. GitHub와 GitLab 호출은 제공자별 함수로 시작하며 공통 UI에는 실제 지원 동작과 원본 상태를 전달합니다. 등록만 된 빈 provider 플러그인 계층은 만들지 않습니다.

## 6. 스타일과 컴포넌트 규칙

- 디자인 토큰은 handoff의 `colors_and_type.css`, `tokens.css`, `components.css`를 계속 원본으로 사용합니다.
- 앱과 Storybook은 동일한 `src/index.css`를 로딩합니다. 파일 이동 시 CSS·SVG import 경로도 함께 수정합니다.
- `system.css`는 현재 공통 보정과 Workspace 레이아웃을 함께 포함합니다. 화면 스타일을 별도로 수정할 필요가 생기면 해당 부분만 기능의 `workspace.css`로 옮기고 공통 진입점에서 로딩합니다.
- 기본 테마, 한국어 표시, `bl-system` 래퍼, 키보드 탐색, 포커스 복귀, 입력 label과 오류 연결, 반응형 동작을 유지합니다.
- 컴포넌트 파일은 `PascalCase.tsx`, 훅은 `useSomething.ts`, 기능 폴더는 `kebab-case`를 사용합니다.
- [프로젝트 지침](./AGENTS.md)의 디자인 컴포넌트 필수 사용 원칙을 최우선으로 적용합니다. 기존 디자인 컴포넌트를 반드시 재사용·확장하고, 없으면 `src/design-system/`에 생성·공개한 뒤 사용합니다. 네이티브 HTML은 공통 컴포넌트 내부 구현에 활용합니다. 동일한 역할의 UI·폼·상태 라이브러리를 구조 정리만을 위해 추가하지 않습니다.

## 7. 현재 파일의 이동 기준

| 현재 코드 | 목표 위치 또는 처리 |
| --- | --- |
| `src/App.tsx` | `src/app/App.tsx`; `main.tsx`의 import 수정 |
| `Workspace.tsx`의 `Workspace` | `src/features/workspace/Workspace.tsx` |
| 같은 파일의 `BranchTree`, `CommitList`, `DetailPanel`, `ApplyTray` | 같은 기능 폴더의 각 컴포넌트 파일 |
| `components.tsx`의 `BranchFilter` | `src/features/workspace/BranchFilter.tsx` |
| `examples.ts`의 `Commit` 타입 | `src/features/workspace/types.ts` |
| `examples.ts`의 예제 배열 | `src/features/workspace/examples.ts`; 실제 데이터 연결 후 스토리·데모에서만 사용 |
| `src/design-system/index.ts` | 기능 컴포넌트와 `Commit` 재수출 제거, 공통 UI만 공개 |
| `src/stories/*.stories.tsx` | 위치 유지, 이동한 컴포넌트·타입·데이터의 import 수정 |
| `src/App.css` | 전체 참조를 다시 확인한 뒤 미사용이면 삭제 |

경로 변경은 앱뿐 아니라 공개 export, 모든 스토리, CSS와 SVG 참조까지 함께 처리합니다. 외부 소비자가 있다면 먼저 사용처를 확인하고 경로 변경을 조율합니다. `design-system`이 기능 모듈을 재수출하는 상태를 최종 구조로 남기지 않습니다.

## 8. 적용 순서와 검증

1. Workspace 기능 코드와 타입·예제 데이터를 옮기고 앱·스토리의 모든 참조를 수정합니다.
2. `App.tsx`를 `app`으로 옮기고 공통 UI 공개 목록을 정리합니다.
3. 동작이 유지되는 것을 확인한 뒤, 별도 작업으로 실제 데이터 연결과 필요한 상태 처리를 추가합니다.

구조 변경 후에는 기존 검증 명령을 사용합니다.

```sh
pnpm check
# lint → build → test → test:native → build-storybook
```

`pnpm test`는 현재 Storybook 플러그인과 Chromium 기반 테스트입니다. 일반 `*.test.ts` 단위 테스트를 추가할 때는 해당 파일이 실제로 발견·실행되도록 Vitest의 별도 테스트 프로젝트 또는 설정을 함께 구성합니다. 테스트 파일을 만들었다는 이유만으로 기존 명령이 실행한다고 가정하지 않습니다.

검증에서는 조회 필터가 체크아웃을 바꾸지 않는지, 검색 변경 시 선택이 초기화되는지, 적용 후 상태가 정리되는지 확인합니다. 네이티브 dialog·Popover의 Escape와 포커스 복귀, 모바일 가로 넘침, 앱과 Storybook의 동일한 스타일도 기존 검사로 확인합니다.

이 문서만 변경한 경우에는 문서의 경로·명령·현재/목표 구분을 확인합니다. 실행 코드 변경이 없다면 전체 브라우저 테스트를 추가로 실행할 필요는 없습니다.

## 9. Electron 빌드·릴리스 기준

Electron은 제품 런타임으로 확정합니다. React/Vite는 renderer를 빌드하고 main·preload는 별도 Node 실행 코드로 묶습니다. 패키징은 **electron-builder**를 사용하며 macOS DMG와 Windows NSIS 설치 EXE를 생성합니다. 초기 Forge/@electron/packager 구성을 현재 설치 파일 빌드로 통합했습니다. 현재 Electron 의존성·main·preload·로컬 패키징 스크립트가 있습니다. handoff의 Electron 실행 예제를 재사용하되 원본 HTML을 루트 React 앱 대신 배포하지 않습니다. [Electron 배포](https://www.electronjs.org/docs/latest/tutorial/application-distribution)

| 경계 | 구현 기준 |
| --- | --- |
| Renderer | 기존 React UI, 패키징된 로컬 자산 사용. 개발 서버 없이 실행되며 Git·토큰·Agent 프로세스 직접 접근 금지 |
| Preload | contextBridge의 구체적 호출만 노출. 범용 IPC·shell·파일 접근을 공개하지 않음 |
| Main/호스트 | sender·인수·경로 검증, Git 쓰기 대기열, 보안 저장소, OAuth, Agent 프로세스와 사용량 수집 |
| Agent 연결 | Claude·Codex·Gemini별 작은 연결 모듈. 실제 공통 실행/중단/이벤트/지원 정보만 같은 타입으로 반환 |
| 인증·사용량 | provider·실제 계정·인증 방식·버킷·기간별 소유. UI/탭에서 동일 계정 통계를 중복 집계하지 않음 |

`contextIsolation: true`, `nodeIntegration: false`, renderer sandbox와 CSP를 기준으로 삼습니다. 외부 링크·탐색을 검증하고 PR 본문·로그·Agent 출력 같은 원격 콘텐츠에 Node 권한을 주지 않습니다. Electron renderer sandbox는 별도 Agent의 파일/명령 권한을 제한해 주지 않으므로 [Agent 적용 경계](./INTEGRATIONS.md)를 별도로 집행합니다. [Electron 보안](https://www.electronjs.org/docs/latest/tutorial/security)

Agent CLI는 최초에 사용자가 설치한 실행 파일을 탐지·선택해 연결합니다. 일반 터미널과 GUI 앱의 PATH가 다를 수 있으므로 앱 실행 경로에서 탐지하고 선택한 절대 경로·버전을 보관합니다. 사용자 shell 초기화 파일을 임의 실행하지 않으며 shell 문자열 대신 인수 배열·stdin으로 통신합니다. 설치 파일에 CLI 인증·API key를 포함하지 않습니다. Node가 필요한 외부 CLI는 자체 런타임 요구를 확인하고 Electron 내장 Node가 자동 제공된다고 가정하지 않습니다. 실행할 수 없으면 설치 안내를 제공하며 임의 버전을 자동 설치하지 않습니다.

초기 배포 형태는 스토어 외 직접 배포로 제안합니다. 지원 OS·CPU 조합은 아직 확정되지 않았으므로 macOS arm64/x64, Windows x64, Linux x64를 검증 후보로 관리합니다. 실제 설치·Git·인증·Agent 시험을 통과한 조합만 지원 목록에 게시합니다. Electron 선택만으로 모든 OS 지원을 선언하지 않습니다.

| 릴리스 단계 | 완료 조건 |
| --- | --- |
| 빌드 | 고정 lockfile, 명시적 앱 버전·ID, renderer/main/preload 빌드. 현재 `pnpm build`는 Vite 출력만 만들므로 설치 파일 생성과 구분 |
| 패키징 | OS별 maker·아이콘·메타데이터, 필요한 자산만 포함. 인증·개인 저장소·개발 로그 제외 |
| 서명 | macOS Developer ID 서명·notarization, Windows 배포 서명과 인증서 검증. 서명 자격은 CI 비밀값으로 관리 |
| 설치본 검증 | 개발 도구 없는 시험 환경에서 실행, 경로에 공백/한글, Git 탐지·OAuth·세 Agent·보안 저장소 검증 |
| 배포 | 버전별 설치 파일·checksum·릴리스 노트·지원 OS/Agent 버전·알려진 제약 제공. 빌드 성공과 공개 게시를 분리 |
| 업데이트 | stable/beta 채널, OS·패키지에 맞는 업데이트 방식, 서명·출처 확인, 실패 시 기존 설치 유지 |
| 재시작·복구 | Git 쓰기·Agent 실행 중 업데이트 재시작 연기, 탭·초안·대화 복원, 실행 자동 재전송 금지. 저장 데이터 변경 시 백업·버전 호환 확인 |

macOS 서명·공증과 Windows 서명은 별도 준비가 필요합니다. OS별 업데이트 기능도 같지 않으므로 기본 autoUpdater 지원을 Linux에 그대로 약속하지 않고 선택한 패키지의 업데이트 경로를 정합니다. [코드 서명](https://www.electronjs.org/docs/latest/tutorial/code-signing), [업데이트](https://www.electronjs.org/docs/latest/tutorial/updates)

Branchline 제품의 Actions/CI 화면과 **Branchline 자체를 빌드·배포하는 CI**는 구분합니다. 릴리스 CI는 기존 검사→OS별 패키징→설치본 검사→서명/배포 순서로 구성하고 서명 산출물도 설치 검증합니다. 구체적 태그·릴리스 저장소·배포 채널은 구성할 때 확정합니다. 로컬 실행 번들·macOS DMG·Windows NSIS EXE 생성 명령을 구성했습니다. 인증서 등록·release 게시·릴리스 CI는 아직 수행하지 않았습니다. 명령과 산출물은 [BUILD.md](./BUILD.md)를 따릅니다.

### 호스팅 조회 알파 구현

`electron/hosting.cjs`는 공식 호스트 Device Flow, 계정별 refresh 직렬화, 지정 GET API와 응답 정규화를 소유합니다. 토큰은 별도 `hosting.enc`에 Electron safeStorage 암호문으로만 저장하고 기본은 세션 한정입니다. 같은 userData를 쓰는 앱은 Electron single-instance lock으로 한 프로세스만 실행하며 두 번째 실행은 기존 창을 엽니다. 정상 종료는 진행 중 토큰 갱신·암호화 저장을 기다립니다. `src/features/hosting/`은 공통 디자인 컴포넌트로 조회·설정 UI를 구성하며 renderer가 토큰이나 임의 요청 URL을 API로 전달하지 않습니다. 계정과 프로젝트가 바뀌면 늦은 응답을 폐기합니다.

`reviews.cjs`는 hosting의 인증된 GET 함수를 재사용하고 요청 전후 PR/MR 버전을 확인합니다. `ReviewResources.tsx`와 공유 `queries.ts`가 선택 자원의 상태와 늦은 응답 폐기를 담당합니다. `McpSettings.tsx`는 main에서 허용 경로를 확인한 설정 JSON만 받으며 MCP 프로세스는 클라이언트가 별도로 실행합니다. `mcp.cjs`는 기존 `git.cjs`의 읽기 함수를 재사용하고 OAuth 저장소에 접근하지 않습니다.


### 후속 연결의 소유권

`electron/agent-chat.cjs`는 선택 파일 요청을 공식 CLI에 stdin으로 전달하고 제한된 최종 응답만 반환한다. `ConflictChat`은 메모리 초안과 provider별 대화를 소유하며 `Conversation` 공통 UI를 조합한다. 임시 작업 폴더와 공식 CLI 인증 저장소는 별개이며 실제 Git 파일 적용은 기존 `conflicts.cjs` 경로로만 수행한다.

`hosting-writes.cjs`는 고정된 provider별 쓰기 경로·입력·버전 재검사를, `Hosting`은 토큰·5분 단회 작업안·계정 직렬화를 소유한다. renderer에 URL/HTTP 메서드/토큰을 받는 범용 쓰기 API를 노출하지 않는다. 실제 운영 인증·CLI 정책/버전별 검증 및 릴리스 조건은 IMPLEMENTATION.md를 따른다.

### 작업 파일 편집 경계 · 2026-09-15

DesktopApp이 저장소별 WorkingEditor 초안과 종료 보호를 소유한다. CommitReview는 기존 ContentTabs에 작업 폴더 탭을 조합하고 WorkingFiles가 디렉터리 조회/저장/교체 확인을 처리한다. FileEditor는 표시와 이벤트만 소유한다. preload workingList/workingRead/workingSave → main authorized → working-files.cjs 경계로 접근하며 쓰기는 Git common-dir serial 큐를 사용한다. 파일 저장은 인덱스·커밋을 변경하지 않는다. 외부 프로세스 변경은 원본 토큰과 교체 직전 재검사로 감지한다.
