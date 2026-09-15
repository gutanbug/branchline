# Branchline

Electron + React + TypeScript 기반 Git 작업 공간입니다. 로컬 저장소·탭·스테이징/커밋·브랜치 비교·worktree·원격 동기화·stash·복제·Agent 설정·호스팅 OAuth/PR/MR 변경 파일·댓글·검사 조회·읽기 전용 MCP를 연결한 로컬 알파입니다. **[구현 상태와 남은 범위](./IMPLEMENTATION.md)**에서 실제 연결 수준을 확인하세요. 공통 디자인 시스템과 Storybook 상호작용 검증을 제공합니다.

프론트엔드 구조와 개발 기준은 [아키텍처 가이드](./ARCHITECTURE.md)를 참고하세요. 현재 구성, 기능 중심 목표 구조, 의존성 규칙과 단계별 이동 기준을 정리했습니다.

개발자와 PM을 동등하게 지원하는 제품 방향은 [제품 전략·경쟁 도구 비교](./PRODUCT.md), 화면과 공통 시각 기준은 [디자인 가이드](./DESIGN.md)에 정리했습니다. 제품 문서의 목표 기능과 현재 알파의 구현 범위는 구분합니다.

[프로젝트 탭·Worktree·다중 AI·OAuth·MCP 확장 설계](./INTEGRATIONS.md)는 추가 요구사항, 인증 방식, 적용 경계와 수용 테스트를 정의합니다. 설계 전체가 구현 완료된 것은 아니며, 실제 계정 승인 검증과 Agent 대화 실행은 남아 있습니다.

[브랜치 비교·필터·PR/MR·CI 작업 명세](./GIT_WORKFLOWS.md)는 handoff와 실제 코드의 차이, GitHub Actions·GitLab CI/CD 범위, PM·개발자 추가 기능과 구현 완료 기준을 정리합니다.

제품의 빌드·릴리스는 **Electron** 기준으로 확정했습니다. [Electron 배포 기준](./ARCHITECTURE.md#9-electron-빌드릴리스-기준)과 [Claude·Codex·Gemini 설정·사용량 명세](./INTEGRATIONS.md#4-ai-agent와-로컬-인증-세션)를 따릅니다. `pnpm build`는 renderer를 빌드하고 `pnpm desktop`은 Electron을 실행합니다. `pnpm package:desktop`은 현재 OS용 서명 없는 번들을 만듭니다. 호스팅 OAuth와 PR/MR·CI 조회 코드는 연결했고 실제 등록 앱 승인은 미검증입니다. 읽기 전용 MCP와 연결 설정 생성도 제공합니다. AI Agent 대화와 검토 후 실행하는 PR/MR·CI 쓰기를 제공합니다. 실제 계정 검증·배포 서명·공증 등 남은 조건은 구현 상태 문서를 따릅니다.

macOS DMG·Windows EXE 생성과 CPU 선택, 설치·배포 조건은 [빌드 안내](./BUILD.md)를 참고하세요.

## 시작하기

프로젝트의 AI 개발 지침은 [AGENTS.md](./AGENTS.md), 작업별 스킬 연결과 명령은 [branchline-workflow](./.agents/skills/branchline-workflow/SKILL.md)에 있습니다. 프로젝트 요청에서 관련 스킬을 적용하도록 구성했으며, 수동으로는 `$branchline-workflow Electron 실행 구조를 구현해줘`처럼 호출합니다.

스킬은 프로젝트의 `.agents/skills`에 두고 자동 선택을 허용했습니다. 목록에 갱신되지 않으면 Codex를 다시 시작한 뒤 확인하세요. 이는 개발 도구의 스킬 설정이며 제품 안의 Claude·Codex·Gemini 활성화 설정과는 별개입니다. [공식 스킬 안내](https://learn.chatgpt.com/docs/build-skills)

Node.js 22.15 이상, pnpm 12.4.1 기준으로 검증했습니다.

```sh
pnpm install --frozen-lockfile
pnpm exec playwright install chromium  # 테스트 브라우저: 최초 1회
pnpm storybook                        # http://127.0.0.1:6006
```

`시작하기 → 디자인 시스템 → Overview`부터 탐색하세요. `Components`의 Controls에서 속성을 변경하고 Docs에서 코드와 API를 확인합니다. `Patterns → Workspace`는 같은 컴포넌트를 조합한 전체 화면입니다.

```sh
pnpm desktop             # 실제 로컬 Git 앱
pnpm package:desktop     # Electron 실행 번들 → release/
pnpm package:mac         # macOS DMG
pnpm package:win         # Windows x64 NSIS 설치 EXE
pnpm test:git            # Git/Agent/호스팅/MCP 테스트
pnpm test:desktop        # 실제 Electron 기능 검증
pnpm dev                 # 실행 안내; ?demo=1에서 기존 Workspace 예제
pnpm lint                # ESLint
pnpm build               # TypeScript 검사 + Vite 빌드
pnpm test                # 63개 스토리: Chromium + axe 접근성 + play 상호작용
pnpm test:native          # 실제 키 입력: dialog/Popover, 폼, 모바일 overflow
pnpm build-storybook     # 정적 컴포넌트 브라우저 → storybook-static/
pnpm check               # UI + Git/Agent/호스팅 + Electron 검증 전체
```

`test:native`는 임시 포트에서 Vite를 시작하고 종료 시 브라우저와 서버를 닫습니다. Storybook의 합성 키 이벤트가 처리하지 않는 네이티브 Escape·포커스 동작을 검증합니다.

외부 MCP 클라이언트 연결은 앱의 `외부 도구 연결`에서 저장소를 선택해 설정 JSON을 생성합니다. 개발 소스 실행은 `node electron/mcp.cjs --repo /absolute/repository`입니다. 읽기 범위와 설정 해제 방법은 [MCP 사용 범위](./IMPLEMENTATION.md#로컬-mcp-사용-범위)를 확인하세요.

## 기본 테마

블랙·화이트 기반 밝은 테마를 기본값으로 사용합니다. 배경 `#fafafa`, 표면 `#ffffff`, 본문·강조 `#000000`, 보조 텍스트 `#666666`, 구분선 `#e5e5e5`입니다. 주요 버튼은 검정 배경·흰 글자이며 hover·선택·포커스·비활성 상태도 무채색으로 표현합니다. OS 다크 모드와 무관하게 같은 기본 테마를 유지합니다. Storybook 탐색 UI와 Docs에도 같은 테마를 적용합니다.

## 현재 구성

| 영역 | 내용 |
| --- | --- |
| Foundations | 6색 토큰, 앱·문서 타이포, 간격·레이아웃, 모서리·그림자, 브랜드 원칙 |
| Components | Brand, Button, ToolbarButton, Badge, TextField, TextArea, Checkbox, EmptyState, Notice, Dialog, BranchFilter, SelectField, CodeDiff, Pagination, Disclosure, UsageMeter |
| Patterns | BranchTree, CommitList, DetailPanel, ApplyTray, 네이티브 DataTable, Workspace |
| 상태 | 기본, 선택, 비활성, 읽기 전용, 로딩, 오류, 빈 결과, 긴 브랜치 이름, 중첩 브랜치 |

총 63개 스토리이며 Storybook Docs 페이지는 별도입니다. `Brand`는 Foundations / 브랜드와 원칙에서 확인합니다.

## 제품에서 사용하기

```tsx
import { Button, TextField } from './design-system'
import './index.css'

export function BranchForm() {
  return (
    <div className="bl-system" lang="ko">
      <TextField label="브랜치 이름" placeholder="feature/new-work" />
      <Button variant="primary">브랜치 만들기</Button>
    </div>
  )
}
```

공개 컴포넌트는 `src/design-system/index.ts`에서 가져옵니다. `BranchFilter`, `BranchTree`, `CommitList`는 값과 콜백을 받으며 실제 Git 작업을 호출하지 않습니다. 예제 데이터는 `src/design-system/examples.ts`, 전체 예제의 상태는 `Workspace.tsx`에 있습니다.

## handoff와의 관계

- `src/index.css`에서 `colors_and_type.css`, `tokens.css`, `components.css`를 **직접 import**합니다. 토큰 값의 이중 관리가 없습니다.
- `src/design-system/system.css`는 React용 베이스, 상태와 반응형 보정만 추가합니다.
- 브랜드 SVG도 handoff 원본을 import합니다. 원본 Electron/Git 구현은 수정하지 않았습니다.
- 44px 상호작용 영역, 한국어 문구, 예제 표기, 상세 선택 전 빈 상태를 유지합니다.
- 조회 필터를 바꿔도 현재 체크아웃은 바뀌지 않습니다. 검색/조회 변경 시 상세 선택을 초기화합니다.
- 원본 `.diff-del`의 대비가 4.43:1이므로 앱에서 `--fg`로 보정했습니다. 새 색상은 추가하지 않습니다.
- 커밋 행은 2줄과 클릭 영역을 위해 58px로 확장했습니다. 좁은 화면은 상세를 아래로 배치하고, 600px 이하에서는 사이드바 트리 대신 같은 검색형 브랜치 필터를 사용합니다.
- Storybook의 native Popover 기반 BranchFilter는 검색 입력/결과 목록을 분리하고 화살표 키·Enter·Escape·바깥 클릭을 지원합니다.

## 다음 작업의 기준

이 버전은 디자인 검토 가능한 초기 시스템입니다. Workspace는 메모리의 **예제 데이터**를 사용하며 Fetch/브랜치 생성/적용도 안내 메시지만 표시합니다. 이력 레인은 시각적 예제이며 Git 부모 관계·reachability 계산은 제공하지 않습니다. 실제 Git·Electron 앱은 별도로 연결되어 있으며 완전한 커밋 그래프와 전체 제품 화면 이식은 남아 있습니다.

컴포넌트를 추가하거나 바꿀 때는 해당 파일 옆의 `src/stories/` 스토리에 상태와 중요한 상호작용을 추가하고 `pnpm check`를 실행하세요. 앱과 Storybook이 같은 컴포넌트와 CSS를 사용하므로 양쪽을 함께 확인해야 합니다.

설정 참고: [Storybook React + Vite](https://storybook.js.org/docs/get-started/frameworks/react-vite), [Vitest addon](https://storybook.js.org/docs/writing-tests/integrations/vitest-addon), [접근성 검사](https://storybook.js.org/docs/writing-tests/accessibility-testing).

최근 제품 리뷰의 우선순위·수정 내역·화면 근거는 [제품 품질 리뷰](./docs/product-review-2026-09-12/REPORT.md)에 있습니다.
