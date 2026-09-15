# Branchline 확장 설계: Electron · 프로젝트 탭 · Worktree · 다중 AI · OAuth · MCP

> 이 문서는 제품 목표와 수용 기준입니다. 2026-09-12 로컬 알파의 실제 구현·미연결 항목은 [IMPLEMENTATION.md](./IMPLEMENTATION.md)를 기준으로 확인합니다.

> 2026-09-12 · 사용자 추가 요구사항을 반영한 구현 명세. 이 파일은 실행 코드나 연결 완료 보고가 아닙니다.
> [PRODUCT.md](./PRODUCT.md)의 개인 기능과 개발자·PM 동등 지원 원칙을 유지합니다. 프로젝트 탭·worktree·대화형 AI 충돌 해결·호스팅 OAuth를 P0로 추가하며, MCP를 먼저 제공하고 전용 IDE 플러그인은 P1로 제안합니다.
> 아래 ID는 `PRODUCT:Gxx`에 해당합니다. 비교·필터·PR/MR·CI의 상세 계약과 handoff ID 대응은 [GIT_WORKFLOWS.md](./GIT_WORKFLOWS.md)에 기록합니다.
> 사용자 확정: Electron으로 빌드·배포하며 Claude Code·Codex·Gemini CLI를 개별 활성화/비활성화하고 각 사용량·잔여량을 확인합니다. 수치 조회 지원 범위는 아래 §4의 제공자별 계약을 따릅니다.

## 1. 요구사항과 완료 조건

| ID | 우선 | 요구사항 | 완료 조건 |
| --- | --- | --- | --- |
| G16 | P0 | 여러 프로젝트를 탭으로 관리 | 서로 다른 저장소와 같은 저장소의 worktree를 함께 열고 각 탭의 상태·초안·작업을 유지 |
| G17 | P0 | Worktree를 일상적으로 사용 | 생성·탐색·탭 열기·이동·삭제·잠금·정리·연결 복구를 Git 제약 안에서 수행 |
| G18 | P0 | 로컬 Auth 기반 대화형 AI 충돌 해결 | 지원 Agent의 기존 로그인 사용, 메시지·추가 지시·중단, 실제 수정안 생성·검토·적용 |
| G19 | P0/P1 | 다른 도구에서 Branchline 사용 | P0 로컬 MCP로 조회와 작업 요청, P1 VS Code·JetBrains 전용 진입 UI |
| G20 | P0 | GitHub·GitLab OAuth | 브라우저에서 계정 승인, 계정별 저장소 연결·권한 확인·재연결·연결 해제 |
| G25 | P0 | 다중 Agent 설정·사용량 | Claude Code·Codex·Gemini CLI별 사용 설정, 대화별 선택, 공식 사용량·잔여량·리셋 시각 또는 조회 불가 이유 표시 |
| G26 | P0 | Electron 빌드·릴리스 | 설치 패키지·서명·업데이트·설치본의 Git/Agent 실행 검증. 상세는 [배포 기준](./ARCHITECTURE.md#9-electron-빌드릴리스-기준) |

## 2. 여러 프로젝트를 탭으로 관리

상단은 `web · main`, `api · feature/login`, `web · fix/payment [worktree]`처럼 저장소와 작업 위치를 함께 표시합니다. 같은 이름의 저장소는 경로·호스트를 추가해 구별합니다. 탭의 점·배지는 미커밋 변경, 진행 중 작업, 충돌, AI 응답 대기를 뜻하며 텍스트와 접근 가능한 이름도 제공합니다.

| 행동 | 유지하거나 확인할 내용 |
| --- | --- |
| 새 프로젝트 열기 | 폴더 선택·clone·최근 목록. 같은 실제 worktree가 이미 열려 있으면 기존 탭 활성화 |
| 탭 전환 | 검색·필터·선택 파일·diff 위치·커밋 메시지·AI 대화 초안 유지. checkout은 실행하지 않음 |
| 순서 변경·고정 | 드래그와 키보드 대체 동작, 탭 목록 검색, 이전/다음 탭 이동 |
| 백그라운드 작업 | Fetch·AI 실행은 원래 탭에 귀속. 다른 탭으로 전환해도 대상 경로를 변경하지 않음 |
| 탭 닫기 | 폴더·worktree·브랜치를 삭제하지 않음. 저장된 초안은 보존하고 작업 중이면 계속 실행/중단을 명시적으로 선택 |
| 닫은 탭 다시 열기 | 마지막 경로·보기 상태 복원. 삭제되거나 접근 불가한 경로는 복구 안내 |
| 앱 재시작 | 탭 순서·활성 탭·초안 복원. Git/AI 실행을 무조건 재전송하지 않고 실제 상태를 먼저 조회 |

데이터 식별은 화면의 `activeTab` 하나에 의존하지 않습니다. `repositoryId`는 공통 Git 디렉터리의 실제 위치, `worktreeId`는 실제 작업 디렉터리의 식별자, `tabId`는 화면 인스턴스입니다. Git이 알려주는 경로를 정규화하며 `.git`이 항상 폴더라고 가정하지 않습니다. 대화·요청·실행 결과는 대상 식별자와 함께 저장합니다. 이동·repair 후 기존 식별자와 경로를 재연결합니다.

저장소 A의 응답이 늦게 도착해도 활성 탭 B의 파일 목록을 덮어쓰지 않아야 합니다. 같은 worktree를 다시 여는 경우에는 대화도 그 worktree의 대화로 이어지며, 별도 충돌 작업은 별도 대화로 분리합니다.

## 3. Worktree 관리

Worktree는 같은 저장소의 여러 작업 디렉터리를 유지하는 기능입니다. 탭 전환과 브랜치 checkout은 다른 행동입니다. 같은 브랜치를 다른 worktree가 사용 중이면 강제로 중복 checkout하지 않고 해당 worktree를 열거나 새 브랜치를 만들도록 안내합니다. [Git worktree](https://git-scm.com/docs/git-worktree)

| 기능 | 화면에 필요한 내용 |
| --- | --- |
| 목록 | 이름·경로·브랜치·HEAD·변경 여부·잠금·진행 중 Git/AI 작업 |
| 생성 | 기존 브랜치 또는 새 브랜치, 시작 ref/SHA, 대상 경로, 생성 후 탭 열기 |
| 열기 | Branchline 탭·IDE·터미널에서 정확한 작업 디렉터리 열기 |
| 이동 | 대상 경로 검증, 관련 탭·감시·실행 세션 정리, 이동 후 경로 재연결 |
| 잠금·해제 | 잠금 이유와 실제 Git 상태. 잠금을 편집 금지나 보안 격리로 오해하지 않도록 표시 |
| 삭제 | 사라질 디렉터리와 변경 사항 표시. clean 확인 후 삭제, dirty이면 보관·커밋·취소 경로 제공 |
| 정리(prune) | 사라진 작업 디렉터리의 메타데이터 정리 대상을 먼저 보여주기 |
| 연결 복구(repair) | 외부 이동으로 연결이 끊긴 경로 확인 후 Git이 지원하는 복구 수행 |

main worktree 제거, submodule을 포함한 worktree 이동 등 Git 자체가 지원하지 않는 경우는 그대로 제한합니다. `prune`은 임의 디렉터리 삭제 기능이 아닙니다. `--force`나 브랜치 강제 재설정은 기본 옵션으로 넣지 않습니다. [Git worktree의 이동·삭제·복구 제약](https://git-scm.com/docs/git-worktree)

여러 worktree는 일부 Git 메타데이터와 refs를 공유합니다. 초기 구현에서는 **같은 공통 Git 디렉터리의 쓰기 작업을 하나의 대기열로 처리**하고 서로 다른 저장소는 독립 실행합니다. AI 추론 대기 동안 저장소 전체를 잠그지 않으며 실제 수정안 적용 구간에서만 검증·쓰기 절차를 수행합니다. 외부 IDE·CLI는 이 대기열을 사용하지 않으므로 실행 직전 상태 재확인이 필요합니다.

## 4. AI Agent와 로컬 인증 세션

`로컬 Auth`는 사용자의 PC에서 해당 Agent가 관리하는 기존 로그인 세션을 뜻합니다. 로컬에서 모델이 추론한다는 의미는 아니며, 선택한 제공자의 서비스에 코드가 전달될 수 있습니다. 연결 화면에서 실행 주체·계정·전송 범위·이용 한도를 표시합니다.

첫 출시의 Agent 대상은 **Claude Code·Codex·Gemini CLI 세 가지**입니다. 모델 이름과 Agent 프로그램을 구분하며 각 Agent의 설치·인증·실행·사용량 조회 능력을 따로 확인합니다. Codex만 구현한 상태를 다중 Agent 기능 완료로 보지 않습니다. Agent가 없어도 로컬 Git과 수동 충돌 해결은 사용할 수 있습니다.

Agent가 직접 관리하는 인증을 재사용하고 Branchline이 인증 파일·브라우저 쿠키·다른 앱의 토큰을 복사하지 않습니다. 세션이 없거나 만료되면 공식 로그인 경로로 연결합니다. 기존 CLI 인증이 API key 방식이면 이를 구독 로그인으로 표시하지 않으며 임의로 다른 과금 방식으로 전환하지 않습니다. Branchline 연결 해제는 세션 사용만 중단하고 공유 CLI 계정 전체에서 자동 로그아웃하지 않습니다. [공식 인증 문서](https://learn.chatgpt.com/docs/auth)

### 제공자별 실행·인증·사용량 지원

| Agent | 연결 경로 | 확인한 사용량 정보 | 잔여 한도 표시 조건 |
| --- | --- | --- | --- |
| Codex | 로컬 Codex App Server, 공식 계정·로그인·대화·중단 API | 계정 rate limits, 지원 버전의 계정 사용량 요약, thread token usage 이벤트 | 계정·인증 방식이 지원하면 창별 사용률·잔여율·리셋 시각. API key 사용을 ChatGPT 구독 한도로 표시하지 않음 |
| Claude Code | 공식 CLI의 구조화 출력 또는 Agent SDK. 배포 제품의 인증 허용 범위를 확인하고 지원 경로 사용 | 실행별 토큰·모델 통계·추정 비용. status line에 5시간/7일 사용률·리셋 정보가 문서화됨 | status line 값을 headless 응답에도 받을 수 있다고 가정하지 않음. 공식 수집 경로가 검증된 조합에서만 표시 |
| Gemini CLI | 공식 headless JSON/stream JSON, CLI가 관리하는 기존 인증 재사용 | headless 실행 통계, 대화형 `/stats model`의 토큰·quota 정보 | `/stats` 화면만으로 quota JSON API를 가정하지 않음. 지원 경로 확인 전 자동 잔여량은 조회 미지원 |

Codex는 `account/rateLimits/read`·`account/rateLimits/updated`, 지원 시 `account/usage/read`, `thread/tokenUsage/updated`를 사용합니다. `rateLimitsByLimitId`가 있으면 버킷별로 읽고 창 길이를 5시간/주간으로 고정하지 않습니다. 이전 조사에서 로컬 `codex-cli 0.153.4`의 app-server 명령만 확인했으며, 설치 버전이 최신 문서의 모든 필드를 제공한다고 보지 않습니다. [OpenAI Docs: App Server](https://learn.chatgpt.com/docs/app-server)

Claude의 실행 JSON에는 사용량·추정 비용이 있으며 status line의 `rate_limits`는 별도 인터페이스입니다. 기존 전역 status line 설정을 덮어쓰거나 조회를 위해 유료 모델 요청을 만들지 않습니다. 공식 이벤트·사용자 선택의 공식 status line 연결 등 실제 수집 경로를 검증해야 하며, 대화형 화면 스크래핑·비공개 usage endpoint 호출로 대체하지 않습니다. [프로그램 실행](https://code.claude.com/docs/en/headless), [Status line](https://code.claude.com/docs/en/statusline)

Claude 인증은 출시 전 확인 항목이 남아 있습니다. 공식 도움말의 2026-06-15 갱신은 SDK·`-p`·타사 앱의 구독 한도 사용이 유지된다고 설명하지만, SDK quickstart는 승인 없이 타사 제품에 claude.ai 로그인·한도를 제공하지 말라고 안내합니다. 이 문서 차이만으로 Branchline의 구독 인증 허용을 확정하지 않습니다. Claude 지원 자체는 유지하며 확인 전 배포 경로는 공식 API key 인증으로 준비하고, 로컬 구독 세션 경로는 허용 범위를 확인해 활성화합니다. API key로의 변경은 사용자가 명시적으로 선택하며 자동 전환하지 않습니다. [구독 사용 안내](https://support.claude.com/en/articles/15036540-use-the-claude-agent-sdk-with-your-claude-plan), [SDK 인증 안내](https://code.claude.com/docs/en/agent-sdk/quickstart)

Gemini는 캐시된 인증이 있으면 headless에서 기존 방식을 이용한다는 공식 안내가 있습니다. Google 로그인·API key·Vertex AI의 계정/프로젝트와 과금 출처를 보존합니다. headless `stats`와 `/stats model`은 다른 출처로 취급하며 지원 버전·권한을 검증합니다. [인증](https://geminicli.com/docs/get-started/authentication/), [Headless](https://geminicli.com/docs/cli/headless/), [Stats 명령](https://geminicli.com/docs/reference/commands/#stats)

### Agent 켜기·끄기와 선택

| 행동 | 동작 계약 |
| --- | --- |
| 개별 활성화 | 설치 경로·버전·인증 상태 확인 후 선택 목록에 추가. 켜기만으로 추론·저장소 접근·유료 호출을 시작하지 않음 |
| 기본 Agent 선택 | 활성 Agent 중 앱 기본값, 필요하면 프로젝트별 기본값 지정 |
| 대화에서 선택 | Agent·실제 계정/과금 방식·모델·사용량 요약 표시. 모델과 옵션은 각 Agent의 지원 값 사용 |
| 비활성화 | 새 실행·재개·자동 사용량 갱신 차단, 대기 요청 취소. 실행 중이면 `완료 후 끄기`/`중단하고 끄기` 선택; 대화·수정안 보존 |
| Agent 전환 | 실행 중 요청의 출처 유지. 새 Agent에 별도 대화를 만들고 선택한 요약·파일만 전달; 내부 thread ID 재사용 금지 |
| 모두 끄기 | AI 입력에 설정 열기 안내, 기본 Git·수동 충돌 해결은 정상 사용 |
| 한도 소진 | 초안 보존, 재개 시각·다른 활성 Agent 선택 제공. 자동 제공자 전환·유료 크레딧 사용·모델 변경 금지 |

`비활성`, `미설치`, `연결 필요`, `준비됨`, `실행 중`, `중단 중`, `한도 초과`, `오류`를 구분합니다. 활성화는 사용자 설정이며 연결·실행 상태는 관측 결과입니다. 비활성화로 CLI 전역 로그아웃·삭제·다른 앱 프로세스 종료를 하지 않습니다. 중단이 확인되지 않으면 `중단 중/확인 필요`로 남깁니다.

여러 Agent를 켜두는 것은 같은 요청을 모두에게 보내는 기능이 아닙니다. 하나의 충돌 대화는 선택 Agent 한 개로 실행합니다. 다른 탭의 실행은 독립적으로 처리하되 같은 파일에 수정안을 적용할 때는 기존 검증·쓰기 대기열을 따릅니다.

### 사용량·잔여량의 표시 계약

| 정보 | 표시할 값 | 혼동하지 않을 것 |
| --- | --- | --- |
| 계정 한도 | 계정·모델/버킷·창 기간·사용률·잔여율·리셋 시각·확인 시각 | Branchline에서만 쓴 양이 아님. 다른 앱과 계정 한도를 공유할 수 있음 |
| 이번 대화 사용량 | 지원되는 입력·출력·캐시 토큰, 요청 수, 출처·집계 범위 | 토큰을 구독 잔여 요청 수로 환산하지 않음 |
| 컨텍스트 | 제공자가 알려준 context 사용량·상한 | 컨텍스트 잔여율은 구독 잔여율이 아님 |
| 비용 | 제공자 보고값 또는 추정값, 통화·가격 기준·관측 범위 | API 환산 비용을 구독 추가 청구액으로 표시하지 않음 |
| 조회 상태 | 로딩·최신·오래됨·조회 미지원·인증 필요·오류 | null/누락은 0 사용·100% 남음·무제한이 아님 |

사용률을 반환할 때 잔여율은 `max(0, min(100, 100 - usedPercent))`입니다. 사용/전체 값이 같은 단위·창으로 주어진 경우에만 비율을 계산하고 전체가 없으면 사용량만 표시합니다. 버킷·모델·분당·일간·주간 한도를 평균하거나 더해 하나의 잔여량으로 만들지 않습니다. 공식 데이터가 없는 잔여 토큰·대화 횟수는 만들지 않습니다.

리셋은 로컬 시간대의 절대 시각과 남은 시간을 표시합니다. 시각이 지났다고 로컬에서 100%로 채우지 않고 재조회합니다. 실패 시 마지막 값·확인 시각을 유지하되 `오래된 정보`로 표시합니다. 외부 CLI에서 계정이 바뀌면 이전 계정의 수치·대화 연결을 재검증합니다.

갱신은 제공자 이벤트 우선, 활성 설정 화면 진입·실행 종료·사용자 새로고침에 조회합니다. polling은 동일 계정의 요청을 묶고 기본 60초 이상 간격·서버 backoff를 지킵니다. 비활성 Agent는 자동 조회하지 않습니다. Branchline 관측 통계는 실행 ID로 중복 제거하며 누적 snapshot을 매번 합산하지 않습니다. 측정 누락·기간 밖 사용이 있으면 계정 전체 통계로 표시하지 않습니다.

설정의 `AI Agents` 목록에는 이름·사용 토글·연결/인증 방식·버전·한도 요약을 표시하고 상세에서 창별 한도와 대화 통계를 펼칩니다. 대화 입력창에는 선택 Agent와 해당 상태를 작게 표시합니다. 잔여량이 없으면 공식 사용량 화면/CLI 안내와 마지막 관측 통계를 제공합니다. 경고는 사용자 설정으로 두고 기본 20%·10%에 창별 1회 안내하는 제안이며 자동 결제·리셋 크레딧 소모로 연결하지 않습니다.

PM에게 팀원의 개인 AI 구독 잔여량을 수집·공유하지 않습니다. 기본 화면은 현재 사용자의 계정·로컬 관측 범위이며 조직 집계는 별도 권한·공식 API가 있을 때 후속 확장합니다.

### 충돌 해결과 대화 흐름

1. 사용자가 해당 worktree에서 진행 중인 merge/rebase/cherry-pick과 충돌 파일을 선택합니다.
2. 양쪽 ref/SHA, 기준 버전, 현재 파일, 이미 사용자가 편집한 내용, 충돌 위치를 함께 수집합니다. rebase에서 `ours/theirs`를 사용자의 소유권으로 단순 번역하지 않습니다.
3. 사용자가 `기존 로그인 검증은 유지하고 새 오류 응답 형식만 반영해줘`처럼 자유롭게 입력합니다. 선택 파일·전송할 문맥이 메시지 옆에 표시됩니다.
4. Agent가 수정안을 만들고 결과·설명·검증 결과를 스트리밍합니다. 중간에 추가 지시, 후속 질문, 중단이 가능합니다. 입력 초안은 탭 전환에도 유지됩니다.
5. 사용자는 양쪽 입력과 AI 결과 diff를 확인하고 `이 수정안 적용` 또는 `다시 수정`을 선택합니다. 적용한 파일과 남은 충돌을 표시합니다.
6. `해결됨으로 표시`, `병합/리베이스 계속`, `커밋`, `Push`는 각각 실제 효과를 가진 별도 행동입니다. AI 응답이 끝났다는 이유만으로 자동 실행하지 않습니다.

대화는 `worktree + Git 작업 + 입력 snapshot + provider + account + Agent thread`에 묶습니다. 작업이 완료되거나 새 rebase 단계로 넘어가면 이전 대화를 참고 기록으로 남기고 입력이 달라졌음을 표시합니다. 진행 중 추가 지시는 지원되는 API로 전달하고, 미지원 Agent는 대기열 또는 중단 후 재요청을 명시합니다. 재시작 후 마지막 메시지를 중복 실행하지 않습니다.

### 수정안 적용의 경계

첫 구현은 Agent가 원본 저장소를 자유롭게 쓰는 방식 대신, 선택 파일의 읽기 문맥과 **별도 임시 편집 공간**에서 수정안을 만들고 Branchline이 검증 후 적용하는 방식으로 제안합니다. 임시 공간은 실제 Git worktree와 구분합니다. linked worktree만으로 보안 격리가 완성되지 않습니다.

- 파일 범위·경로·인코딩·줄바꿈·현재 내용 해시·Git 작업 상태를 적용 직전에 다시 검사합니다. 심볼릭 링크를 통한 저장소 밖 쓰기도 차단합니다.
- 원본이 IDE나 다른 Agent에 의해 바뀌었으면 수정안을 덮어쓰지 않고 재검토 상태로 돌립니다.
- 적용 전 필요한 원본을 보관하고 실패 시 파일별 성공·실패를 기록합니다. 전체 파일 적용이 원자적이라고 가정하지 않습니다.
- 모델의 ‘해결 완료’ 설명만 믿지 않고 실제 unmerged index, 선택 결과, 가능한 검증을 함께 확인합니다. 테스트 실패·검증 미실행·지원하지 않는 바이너리 충돌을 명시합니다.
- 프롬프트에서 경로를 제한하는 것만으로 충분하지 않습니다. Agent 실행의 filesystem·command·network 권한과 상속되는 MCP·hooks 설정을 실제로 제한합니다.
- Agent가 추가 권한을 요구하면 해당 탭·작업에 표시합니다. 다른 탭의 승인을 공유하거나 사용자가 거절한 요청을 자동 우회하지 않습니다.

Git 인증 정보와 팀원의 비공개 데이터는 AI 대화 문맥에 자동 포함하지 않습니다. 대화 기록은 기본 로컬 보관, 저장소별 삭제·보관 설정을 제공하며 팀 공유는 별도 선택입니다. 사용자가 직접 전송한 메시지·선택 문맥에 따른 제공자 측 보관은 해당 서비스 정책에 따릅니다.

## 5. GitHub·GitLab OAuth

Git 자체에는 OAuth 로그인 기능이 없습니다. **호스팅 API 로그인**, **Git Fetch/Push 인증(SSH/HTTPS)**, **AI Agent 로그인**, **Git 작성자 이름·이메일**을 별도 항목으로 관리합니다. 하나의 로그인 성공이 나머지 권한이나 작성자를 변경하지 않습니다.

데스크톱 첫 버전은 두 호스팅 서비스의 **Device Authorization Flow**를 우선 검토합니다. 시스템 브라우저에서 제공자의 주소·코드를 확인하고 승인하며, 앱에 client secret을 내장하지 않는 구성이 가능합니다. GitHub는 앱 등록에서 Device Flow 활성화가 필요합니다. GitLab도 Device Grant를 문서화하고 있습니다. [GitHub OAuth](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [GitLab OAuth](https://docs.gitlab.com/api/oauth2/)

| 단계 | 동작과 상태 |
| --- | --- |
| 연결 준비 | 제공자·호스트·등록된 Client ID·요청 권한 확인. 미설정이면 연결된 것처럼 보이지 않음 |
| 승인 요청 | 제공자 응답의 코드·검증 URL·만료 시각 표시. 토큰 교환은 로컬 호스트 서비스가 담당 |
| 브라우저 승인 | 검증된 HTTPS 호스트만 열기. 앱에서 계정 비밀번호를 받지 않음 |
| 승인 대기 | 서버 지정 polling 간격과 slow_down·취소·거절·만료 처리. 중복 로그인 요청 분리 |
| 연결 완료 | 사용자 API로 실제 계정 확인 후 연결. 기존 탭의 계정을 새 계정으로 임의 교체하지 않음 |
| 기능 사용 | 필요한 권한이 없으면 구체적 이유와 재승인 행동 제공. 원격 정책은 서버 판단 유지 |
| 만료·갱신 | 계정별 갱신을 직렬 처리, 새 토큰을 함께 저장, 실패하면 재연결. 만료 없는 토큰이라고 고정 가정하지 않음 |
| 연결 해제 | Branchline 보관 토큰·관련 캐시 정리. 제공자 접근 권한 철회는 별도 지원 절차로 안내 |

토큰은 OS 보안 저장소에 보관하고 renderer·브라우저 저장소·URL·MCP 응답·로그로 전달하지 않습니다. OS 저장소를 사용할 수 없으면 평문 저장으로 자동 대체하지 않고 세션 한정 사용 또는 오류 안내를 제공합니다. 읽기 화면만 제공하더라도 토큰 자체가 넓은 권한을 가진 경우 그 범위를 정확하게 설명합니다.

PR/MR 읽기·댓글/리뷰·병합, CI 읽기·로그·재실행/취소·수동 실행을 각각 권한 검증 대상으로 둡니다. 로그인 성공만으로 버튼을 모두 활성화하지 않습니다. OAuth scope와 fine-grained token/GitHub App permissions는 다른 체계이므로 API 문서의 권한 이름을 그대로 OAuth scope로 쓰지 않습니다. 등록 앱의 실제 scope와 제공자·계정·저장소 정책을 함께 검증합니다. 지원 범위는 [리뷰·CI 명세](./GIT_WORKFLOWS.md)에 따릅니다.

여러 계정은 `provider + host + accountId`로 구분하고 저장소마다 사용할 계정을 연결합니다. Git clone/Push 인증은 기존 SSH·credential helper를 먼저 사용합니다. 호스팅 API 토큰을 remote URL에 넣거나 전역 Git 설정을 덮어쓰지 않습니다. 향후 HTTPS credential 연동을 제공하면 호스트·계정 단위로 명시적으로 연결합니다.

GitLab PKCE Authorization Code Flow는 브라우저 callback 기반 UX가 필요할 때 대안입니다. 등록한 redirect URI와 state·verifier를 검증해야 하며 운영 callback 형태를 확정한 후 지원합니다. 초기 Device Flow 경로에 callback 서버를 불필요하게 추가하지 않습니다. [GitLab PKCE](https://docs.gitlab.com/api/oauth2/)

### 실제 계정 연동에 필요한 설정

- Branchline 소유 GitHub OAuth App의 공개 Client ID와 Device Flow 활성화.
- Branchline 소유 GitLab OAuth Application의 공개 Application ID, 앱 유형·허용 scope·Device Grant 지원 확인.
- 배포 대상 OS의 보안 저장소 구현 및 실제 사용자 계정에서의 승인 테스트.
- GitHub Enterprise/GitLab Self-Managed는 호스트별 등록·버전·SSO·CA 정책을 별도로 확인한 뒤 확장.

2026-09-12 구현: `electron/hosting.cjs`와 프로젝트 현황 화면에 Device Flow·선택적 safeStorage 암호화 보관·계정 갱신/해제·프로젝트/PR/MR/CI 읽기를 연결했습니다. 실제 등록 앱의 승인·Keychain 저장·실제 저장소 접근은 아직 검증하지 않았습니다. 공개 Client ID는 앱의 연결 폼에서 설정하며 Client Secret이나 토큰을 대화창에 요청하지 않습니다. 현재 범위와 수동 승인 조건은 [구현 상태](./IMPLEMENTATION.md)에 기록합니다.

## 6. 다른 도구에서 사용하는 MCP와 플러그인

방향은 **외부 도구가 Branchline의 기능을 호출하는 MCP 서버**입니다. Branchline에 임의 외부 MCP 서버를 설치해 AI 권한을 늘리는 기능과 구분합니다. 로컬 알파에는 사용자가 실행하는 읽기 전용 `stdio` 서버를 구현했습니다. 네트워크 포트를 공개하지 않고 MCP 클라이언트가 프로세스를 시작합니다. [MCP 전송 방식](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)

| 도구·구현 상태 | 범위 |
| --- | --- |
| `list_projects`, `get_status`, `list_worktrees` (구현) | 사용자가 허용한 저장소의 작업 상태 조회 |
| `get_diff`, `list_conflicts` (구현) | staged/전체 commit SHA diff와 충돌 파일 메타데이터 조회 |
| `open_project` (계획) | Branchline의 해당 프로젝트/worktree 탭으로 이동 |
| `prepare_operation` (계획) | 생성할 worktree·적용할 patch 등 구체적 작업안과 영향 범위 생성 |
| `get_operation`, `cancel_operation` (계획) | 작업의 상태 조회·지원되는 중단 요청 |
| `execute_operation` (계획) | 이미 승인된 작업안 ID·내용 hash·예상 저장소 상태로 검증 후 실행 |

앞의 읽기 도구 5개는 `electron/mcp.cjs`에 구현했으며 나머지 작업 도구는 설계안입니다. 앱의 `외부 도구 연결`에서 허용 저장소를 선택해 stdio 설정을 생성합니다. 개발 소스에서는 `node electron/mcp.cjs --repo /absolute/repository`로 실행합니다. 현재 권한·크기·취소·패키지 실행과 클라이언트 재시작에 의한 철회 조건은 [MCP 사용 범위](./IMPLEMENTATION.md#로컬-mcp-사용-범위)에 기록합니다. MCP에서 `approved: true`를 보내는 것만으로 권한을 얻을 수 없어야 합니다. 승인은 Branchline이 생성·보관하는 작업별 승인으로 묶고, UI가 없으면 승인 필요 오류와 앱 열기 경로를 반환합니다. 읽기 접근도 사용자가 허용한 저장소로 제한합니다. 범용 `exec`, 임의 Git 명령 문자열, 임의 파일 읽기·쓰기는 공개하지 않습니다. 도구 annotation은 UI 힌트이며 실제 접근 통제를 대신하지 않습니다. [MCP Tools](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)

비교·PR/MR·CI를 MCP에 노출할 때도 같은 제공자 계정과 허용 저장소 범위를 사용합니다. 원격 게시·병합·CI 실행은 UI와 동일한 작업안·최신 상태·권한 검증을 거치며 읽기 토큰을 쓰기 권한으로 취급하지 않습니다. CI 로그와 리뷰 내용을 Agent에 자동 전달하지 않습니다. 첫 MCP 계약을 넘는 도구는 해당 기능의 실제 구현에 맞춰 추가합니다.

VS Code·JetBrains 플러그인은 같은 로컬 서비스의 `현재 프로젝트 열기`, `선택 파일 비교`, `충돌을 Branchline에서 해결`, `worktree 열기`로 시작합니다. Git 실행·OAuth·AI 처리를 각 플러그인에 다시 구현하지 않습니다. 플랫폼마다 플러그인 포맷과 MCP 지원이 다르므로 `모든 플랫폼에서 설치 없이 작동`한다고 약속하지 않습니다.

원격 웹·클라우드 MCP는 P1 이후입니다. 로컬 stdio만으로 원격 클라이언트가 PC에 접근할 수는 없습니다. 원격 제공 시 별도 서비스 인증·토큰 대상 검증·호스트 허용·Origin 검증이 필요하며 GitHub/GitLab 토큰을 MCP 인증 토큰으로 전달하지 않습니다. [MCP 인증](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)

## 7. 구현 구조와 기존 코드의 재사용

| 영역 | 책임 |
| --- | --- |
| React 앱 | 프로젝트 탭, worktree 화면, AI 대화·수정안, 계정 연결 상태 |
| 로컬 호스트 서비스 | Git 실행·대기열·파일 검증·OAuth·보안 저장소·Agent 프로세스 |
| Agent별 연결 | Codex App Server·Claude CLI/SDK·Gemini CLI의 인증·대화·스트리밍·사용량. Branchline이 파일 적용 정책을 별도로 집행 |
| MCP·IDE 진입점 | 동일한 로컬 호스트 기능과 승인 정책에 연결 |

호스트와 제품 배포는 Electron으로 확정합니다. 빌드·서명·업데이트 기준은 [아키텍처 §9](./ARCHITECTURE.md#9-electron-빌드릴리스-기준)를 따릅니다. 브라우저 renderer에 OS 파일·Git 실행·토큰을 직접 노출하지 않습니다. 별도 웹 프론트가 로컬 세션에 접근하려면 로컬 bridge와 인증 설계가 필요합니다.

`branchline-design-system-handoff/git-backend.cjs`에는 worktree 목록·생성·삭제·잠금·prune 예제가 있습니다. `github-backend.cjs`는 전달받은 토큰으로 API를 호출하는 예제이며 OAuth 구현은 아닙니다. 이 코드를 재사용하기 전에 현재 루트 앱의 타입·경로 검증·공유 Git 디렉터리 대기열·테스트에 맞게 검토합니다. handoff 전체를 검증 없이 제품 백엔드로 연결하지 않습니다.

프로젝트 탭 상태는 `app`, 저장소 작업 UI는 `features/workspace`, worktree 관리·AI 충돌 대화·계정 연결은 실제 구현 시 해당 기능 모듈로 분리합니다. Git/provider 식별과 실행 정책은 하나의 로컬 호스트에서 소유합니다. 상세 폴더는 [ARCHITECTURE.md](./ARCHITECTURE.md)를 확장하며 빈 플랫폼별 패키지를 미리 만들지 않습니다.

## 8. 수용 테스트와 구현 순서

| 검증 | 통과 기준 |
| --- | --- |
| 세 프로젝트 탭 | 각 검색·선택·커밋 초안 유지, 늦은 응답이 다른 탭에 반영되지 않음 |
| 같은 저장소의 두 worktree | 독립 파일·브랜치 상태, 생성·탭 열기·dirty 삭제 제한·이동 후 경로 복구 |
| 백그라운드 AI | A에서 요청 후 B 전환·추가 메시지·중단 시 모든 이벤트가 A에 귀속 |
| 실제 텍스트 충돌 | 지시에 따른 수정안 생성·적용, 관련 없는 변경 보존, 실제 Git 미해결 상태 확인 |
| 동시 수정 | AI 대기 중 원본 수정 시 적용 거부·재검토. AI 완료로 자동 merge·Push하지 않음 |
| 세 Agent 실제 실행 | Claude·Codex·Gemini 각각 연결·대화·후속 지시·중단·수정안 검증. 미지원 인증 경로와 지원 경로를 구별 |
| Agent 토글·전환 | 모두 끈 상태에서 Git 정상, 실행 중 끄기·대기 요청 취소·새 Agent의 별도 대화, 다른 앱 세션 보존 |
| 사용량 | 실제 제공자 값과 대조, null·조회 미지원·오래된 값·리셋·다중 창·계정 변경·중복 이벤트 처리. 컨텍스트와 계정 한도 분리 |
| 설치본의 Agent | 패키징된 Electron에서 경로·버전·인증·대화·중단·재시작 동작 확인. 개발 shell에서만 성공하면 미완료 |
| 로컬 로그인 | 허용되는 기존 세션 사용, 미로그인·만료·한도 초과 처리. 연결 해제로 CLI 전체 로그아웃하지 않음 |
| OAuth | 실제 등록 앱으로 성공·거절·만료·취소·재연결, 계정 혼선 없음, 비밀값 노출 없음 |
| MCP | 허용 저장소 조회, 승인 없는 쓰기 거부, 오래된 승인·위조 ID 거부, UI와 같은 결과 |

진행 순서는 `탭과 로컬 호스트의 식별·실행 경계 → 로컬 Git/비교·필터/worktree·AI 및 OAuth/PR·MR/CI → 로컬 MCP와 종단 통합 검증 → IDE 플러그인`입니다. 로컬 기능과 원격 협업 기능은 동일한 P0 출시 범위이며 PM을 후속으로 미루지 않습니다. OAuth 등록은 구현 중 먼저 준비해 실제 승인 테스트를 통합 검증으로 진행합니다.

탭·worktree·Agent 설정·Codex 한도 조회와 호스팅 OAuth/PR/MR/CI 조회 코드는 로컬 알파에 연결했습니다. MCP 읽기 서버도 연결했고 MCP 쓰기·AI 대화와 실제 OAuth 계정 승인은 남아 있으며 상세 검증 범위는 구현 상태 문서를 따릅니다.


### 배포용 OAuth 공개 ID 구성

`electron/oauth-clients.json`의 `github`와 `gitlab`에 등록 앱의 공개 ID만 넣는다. 해당 파일은 Electron 패키지의 main 코드와 함께 포함된다. 비밀 Client Secret이나 access token은 넣지 않는다. 이 PC에 기억한 공개 ID → 기존 연결 계정의 공개 ID → 배포 기본 ID 순으로 자동 선택하며 모두 없을 때 최초 입력을 안내한다. 배포 앱 등록·실계정 Device Flow·OS 보안 저장 검증은 실제 운영 환경에서 별도로 완료해야 한다.


## 2026-09-14 후속 연결 상태

운영 경로의 정확한 범위는 [IMPLEMENTATION.md](./IMPLEMENTATION.md)의 후속 구현 절을 따른다. 세 공식 CLI의 선택 파일 대화·최종 JSON 수정안·중단과 검토 후 초안 가져오기를 연결했다. 인증은 CLI에 남으며, 앱 내 계정 선택/변경 감지·텍스트 스트리밍·실시간 추가 지시·재시작 복구는 남아 있다. CLI별 제한 옵션은 새 임시 작업 폴더에만 적용하고 설정을 자동 완화하지 않는다. 실제 인증/과금 추론을 통한 검증은 하지 않았다.

OAuth 쓰기는 새 연결의 별도 선택이다. GitHub read:user+repo 또는 GitLab read_user+api를 요청하며 서버 권한·보호 규칙을 따른다. 원격 작업은 main에 보관한 단회 작업안을 최종 확인 후 소비한다. 실제 계정 승인과 배포용 공개 Client ID 등록은 여전히 필요하다.

### 이 PC의 로그인 앱 자동 설정 · 2026-09-14

성공한 연결의 공개 Client ID를 앱의 workspace.json 내 oauthClients에 제공자별로 기억한다. 기존 암호화 계정을 복원한 경우에도 공개 ID를 재사용한다. 승인 대기·취소·실패한 ID는 추가하지 않는다. 다른 앱을 사용하려면 사용자 지정 옵션으로 전환한다. 계정 해제와 세션 종료 뒤에도 공개 로그인 앱 ID는 유지하며 토큰·Client Secret·device_code는 이 설정에 기록하지 않는다. 설정 저장 실패는 성공한 계정 연결을 실패로 되돌리지 않고 안내한다.

브라우저에서 사용자 승인은 계속 필요하다. 모든 신규 설치본에서 처음부터 ID 입력을 없애려면 배포자가 실제 등록한 공개 ID를 구성해야 한다. 다른 제품의 ID를 가져오거나 임의 값을 생성하지 않는다. [GitHub Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow). Self-managed GitLab 지원 범위는 이번 변경으로 확장하지 않는다.

### 현재 프로젝트 직접 조회와 회사 GitLab PAT · 2026-09-15

프로젝트 현황은 현재 저장소의 remote에서 프로젝트 경로를 얻어 GitHub /repos/{owner}/{repo}, GitLab /projects/{URL-encoded path}를 조회한다. GitLab 하위 그룹 경로를 지원한다. 호스트가 일치하는 연결 계정만 사용하며 OAuth 저장소 목록 조회 권한이나 전체 목록 탐색에 의존하지 않는다. 원격이 여러 개면 origin 기본/사용자 선택, 동일 서버 계정이 여러 개면 사용자 선택이다.

GitLab.com 및 Self-Managed는 별도 PAT 연결을 지원한다. HTTPS 서버 origin(포트 포함)과 PAT를 앱의 계정 연결 창에 입력하며 Client ID 등록은 필요 없다. 서버의 /api/v4/user로 계정을 검증하고 provider+host+accountId로 격리한다. 읽기는 read_api, 원격 쓰기는 api 권한이 필요하며 실제 서버 권한과 보호 정책을 따른다. 토큰에는 자동 갱신을 가정하지 않고 401이면 재연결을 안내한다. 원격 쓰기는 연결 시 별도 opt-in이며 기존 실행 전 검토/단회 작업안/SHA 검증을 유지한다.

입력한 PAT는 마스킹 폼에서 main으로 한 번 전달하고 입력 상태를 비운다. main은 선택적으로 safeStorage로 암호화하며 평문 저장, URL 토큰, 리다이렉트 추적, TLS 검증 해제는 하지 않는다. 회사망/VPN과 신뢰된 HTTPS 인증서는 사용자 환경 조건이다. HTTP 서버·경로 아래 설치된 GitLab·SSH Host 별칭에서 실제 웹 호스트 추론은 현재 지원하지 않는다. HTTPS custom port는 같은 포트의 HTTPS remote에서 자동 매칭한다. 실제 회사 서버와 PAT 검증은 앱에서 연결 후 별도로 수행한다.

근거: [GitLab REST 인증](https://docs.gitlab.com/api/rest/authentication/), [PAT 권한](https://docs.gitlab.com/user/profile/personal_access_tokens/).
