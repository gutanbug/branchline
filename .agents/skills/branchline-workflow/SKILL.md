---
name: branchline-workflow
description: "Branchline 프로젝트의 기능 구현·수정·검토·검증·릴리스 준비에 사용한다. React UI, Electron, Git 비교·worktree, Claude·Codex·Gemini, OAuth·PR/MR·CI·MCP 작업을 관련 프로젝트 문서와 설치된 전문 스킬에 연결한다. 다른 프로젝트나 일반 Git 사용 질문에는 적용하지 않는다."
---

# Branchline 개발 워크플로

현재 요청에 해당하는 행만 적용한다. 이 스킬은 개발 작업을 안내하며 Branchline 제품 안에서 실행되는 AI Agent 설정과는 별개다. 사용자 요청의 범위·우선순위·기존 권한을 유지한다.

## 프로젝트와 작업 범위

- 프로젝트 루트의 `package.json` 이름이 `branchline`인지, 아래 문서가 이 작업 공간의 문서인지 먼저 확인한다. 다른 폴더에 이 지침을 전파하지 않는다.
- 현재 요청과 관련된 실제 실행 경로·호출자·검증 코드를 읽는다. 제품 문서의 목표 기능을 현재 구현으로 가정하지 않는다.
- [PRODUCT.md](../../../PRODUCT.md)는 기능 범위, [ARCHITECTURE.md](../../../ARCHITECTURE.md)는 코드 소유권·Electron 배포 기준이다. 작업에 해당하는 절만 읽고 이미 읽은 변경 없는 자료는 반복 로딩하지 않는다.
- `branchline-design-system-handoff/`는 디자인 원본과 참고 구현이다. 현재 루트 앱의 연결·검증 여부를 확인하고 재사용한다. 범위 전체를 무조건 이식하지 않는다.

## 작업별 자동 적용

스킬은 현재 세션의 카탈로그에서 이름으로 찾고 실제 `SKILL.md`를 읽어 적용한다. 아래 이름은 설치된 스킬 식별자이며 shell 명령이 아니다. 캐시 버전이나 개인 절대 경로를 프로젝트에 고정하지 않는다.

| 요청·변경 대상 | 연결할 스킬 | 프로젝트 문서·핵심 검증 |
| --- | --- | --- |
| 코드 작성·수정·리팩터링·구현 설계 | `ponytail:ponytail` | 기존 구현·표준 기능 우선. 명시적으로 요청한 기능과 오류 처리를 생략하지 않음 |
| 화면·컴포넌트·스타일·폼·UX 수정 또는 UI 검토 | `frontend-design-premium:frontend-design` 다음 `frontend-design-premium:frontend-design-premium` | [DESIGN.md](../../../DESIGN.md), 공통 UI·토큰·관련 Storybook. 키보드·IME·오류·빈 상태·좁은 화면 확인 |
| 코드 구조·파일 관계에 관한 질문 | `graphify` | 기존 `graphify-out/graph.json`이 있으면 조회 우선. 전체 그래프 생성은 요청·실제 필요가 있을 때 선택; 좁은 변경의 의존성 확인은 `rg`와 직접 읽기 |
| Electron main/preload·IPC·패키징·업데이트 | 코드 스킬, UI 변경이 있으면 UI 스킬도 적용 | ARCHITECTURE §9, 공식 Electron 문서. renderer 권한·IPC 경계·설치본 실행 확인 |
| Git 상태·이력·비교·필터·merge·worktree | 코드 스킬, UI 변경 시 UI 스킬 | [GIT_WORKFLOWS.md](../../../GIT_WORKFLOWS.md), [INTEGRATIONS.md](../../../INTEGRATIONS.md). 실제 Git fixture로 집합·경로·상태 변경 검증 |
| AI 대화·Agent 토글·인증·사용량 | 코드 스킬, UI 변경 시 UI 스킬; Codex 관련이면 `openai-docs` | INTEGRATIONS §4, Claude/Gemini 공식 문서. provider·계정·worktree·대화 분리, 잔여량 미지원 처리 |
| GitHub/GitLab OAuth·PR/MR·CI | 코드 스킬, UI 변경 시 UI 스킬 | INTEGRATIONS §5, GIT_WORKFLOWS §4~5. 공식 API, pagination·권한·최신 SHA·부분 실패 |
| Branchline MCP 서버·IDE 연결 | 코드 스킬, 설정 UI 변경 시 UI 스킬 | INTEGRATIONS §6, 공식 MCP/IDE 문서. 허용 저장소·승인된 작업안·토큰 경계 |
| 프로젝트 스킬 추가·트리거 조정 | `skill-creator` | 이 스킬과 AGENTS.md, frontmatter·invocation policy·발견 여부 검증 |
| 과도한 설계 검토를 명시적으로 요청 | `ponytail:ponytail-review` 또는 전체 저장소면 `ponytail:ponytail-audit` | 요청한 diff/전체 범위를 구분. 일반 검토를 임의 삭제 작업으로 바꾸지 않음 |

`코드 스킬`은 첫 행의 ponytail을 뜻한다. 예를 들어 Agent 설정 UI는 코드+UI 스킬을 적용하고, Codex 한도 API까지 바꾸면 OpenAI Docs도 적용한다. Electron 전용 스킬이 설치되어 있다고 가정하지 않는다.

필요한 외부 스킬이 없으면 누락 이름과 영향을 알리고 가능한 독립 작업은 진행한다. 프로젝트 규칙을 지키며 공식 문서로 대체할 수 있는 부분은 계속한다. 필수 의존 스킬이 필요한 UI 등은 해당 기능에 한해 제한을 명시한다. 설치·전역 설정 변경은 이 라우팅만으로 수행하지 않는다.

## 구현 시 유지할 기준

- UI는 [AGENTS.md의 디자인 컴포넌트 필수 사용 원칙](../../../AGENTS.md)을 최우선으로 적용한다. 기존 컴포넌트 검색·재사용, 필요한 변형 확장, 없는 컴포넌트의 `src/design-system/` 생성·공개 후 사용 순서를 지킨다. 화면별 HTML/CSS 복제로 대체하지 않으며 새 컴포넌트의 Storybook과 관련 검증을 포함한다.
- 개발자·PM은 동등한 제품 사용자이며 개인 로컬 Git은 호스팅 로그인 없이 완결된다. 이번 요청과 무관한 전체 백로그를 매번 구현하지 않는다.
- Electron은 확정 런타임이다. renderer에는 OS/Git/토큰을 직접 노출하지 않는다. 제품 CI 화면과 Branchline 자체 릴리스 CI를 구분한다.
- 탭 전환과 checkout, 탭 닫기와 worktree 삭제를 구분한다. 요청·응답·초안은 원래 저장소/worktree에 귀속한다.
- 실제 브랜치 비교는 SHA와 Git 조상 집합을 사용한다. 로드된 400행이나 예제 브랜치 라벨로 전체 이력의 정확성을 판단하지 않는다.
- 같은 저장소의 worktree는 공통 Git 디렉터리 기준으로 쓰기를 조율하고 적용 직전 외부 변경을 다시 확인한다.
- Agent의 로그인·활성 설정·실행 상태·사용량은 별개다. null은 잔여 100%가 아니며 계정 quota·컨텍스트·비용도 구분한다. 인증 허용 범위는 INTEGRATIONS의 확인 사항과 최신 공식 자료를 따른다.
- Git/OAuth/Agent 비밀값은 UI·로그·MCP로 보내지 않는다. 제품 구현을 이유로 실제 계정 로그인·AI 과금 호출·원격 게시·release 공개를 자동 수행하지 않는다. 현재 사용자가 이미 승인한 구체적 작업은 다시 승인받지 않는다.

## 검증 선택

먼저 현재 `package.json`을 확인한다. 아래 명령은 초기 구성의 실제 명령이며 바뀌면 이 표도 갱신한다.

| 변경 | 검증 |
| --- | --- |
| 일반 TS/React 코드 | `pnpm lint`, `pnpm build`, 변경 로직에 해당하는 실행 가능한 테스트 |
| 공통 UI·상호작용·스타일 | `pnpm check` — lint → build → test → test:native → test:git → Electron E2E → build-storybook. 실제 화면·키보드·반응형 확인과 UI 스킬 필수 검사도 수행 |
| 독립 Git/Agent/IPC 로직 | 그 로직을 실제로 실행하는 테스트를 추가·실행. 현재 Storybook용 `pnpm test`가 일반 `*.test.ts`를 자동 실행한다고 가정하지 않음 |
| 문서·스킬만 변경 | 상대 링크·스키마·트리거 범위 확인. 앱 전체 빌드를 불필요하게 실행하지 않음 |
| Electron 패키징·릴리스 | 실제 추가된 build/package 명령과 대상 OS 설치본 검증. 현재 Vite `pnpm build`를 Electron 배포 성공으로 보고하지 않음 |

`DESIGN.md`를 바꾸면 `npx --yes -p @google/design.md designmd lint DESIGN.md`도 실행한다. 스킬을 바꾸면 설치된 skill-creator의 `scripts/quick_validate.py`로 검사한다. 읽기 전용 확인만 필요할 때 새 AI 대화를 실행해 사용량을 소모하지 않는다.

작업 종료 시 실제 변경·검증 결과·남은 연결 조건만 간결하게 보고한다. 계획·mock·참고 코드·실제 연결·실제 환경 검증을 구분한다.

## 수동 호출 예시

다음은 `$branchline-workflow` 뒤에 전달하는 자연어 요청이다. 별도의 `/electron` 같은 slash command를 등록하는 문법이 아니다.

- `$branchline-workflow 프로젝트 탭과 저장소 열기를 구현해줘.`
- `$branchline-workflow Electron 빌드와 설치 패키지를 구성해줘.`
- `$branchline-workflow 브랜치 비교와 전체 이력 필터를 구현해줘.`
- `$branchline-workflow Claude·Codex·Gemini 토글과 사용량 화면을 구현해줘.`
- `$branchline-workflow 이번 변경의 검증과 구현 상태를 확인해줘.`
