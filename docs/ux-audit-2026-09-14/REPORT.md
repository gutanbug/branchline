# Branchline 개인 개발자·PM UX 재평가

2026-09-14 · 현재 Electron renderer · macOS · 제품 코드 수정 없이 실행 감사

현재 제품은 **개인 개발자의 기본 로컬 Git 작업에는 사용할 수 있는 알파**다. 그러나 **개발자와 PM에게 동등한 완결성을 제공하는 관리 도구라는 목표에는 아직 미달**한다. 그래프·브랜치·worktree 탐색은 개선됐지만, 초안 보존·병합 마무리·팀의 조치 판단이 먼저 보완되어야 한다. 기능 테스트 통과를 제품 사용성 완료로 보지 않는다.

흑백 토큰·버튼·입력·대화상자의 일관성은 유지할 가치가 있다. 문제의 중심은 색상이나 장식보다 **화면에 확보된 작업 공간, 작업 맥락, 다음 행동, 입력 보존**이다. 이번 감사는 경쟁 제품의 최신 버전 비교나 사용자 실험이 아닌 현재 앱의 전문가 평가다.

## 검증 범위와 근거

- 이번 실행에서 저장한 Electron 화면만 사용했다. 아래에 제시한 이미지는 각각 열어서 상태를 확인했다.
- 실제 임시 Git 저장소로 열기·스테이징·커밋·비교·검색·탭 복원·원격 bare 저장소 Push/Fetch·Stash·clone·충돌 해결·그래프·worktree 탭을 실행했다.
- GitHub/GitLab은 실제 IPC와 서비스 경로에 통제된 HTTP 응답을 연결했다. 실제 OAuth 계정 승인·조직 권한·운영 PR/MR는 검증하지 않았다.
- AI는 설치 탐지와 설정을 확인했다. 실제 대화나 사용량 요청은 실행하지 않았다. MCP는 기존 테스트의 설정 생성·허용 저장소·서버 검증 범위다.
- 760×580 최소 창과 1440×950 화면을 확인했다. 일부 기본 테스트 캡처는 Retina 이미지다.
- 기존 Electron 시나리오와 axe 검사 통과: [실행 로그](runtime-check.log).
- 추가 재현 성공: [초안 유실·수동 갱신 로그](reproductions.log), [재현 스크립트](../../scripts/audit-ux-2026-09-14.mjs). 이 스크립트는 현 결함의 재현용이며, 수정 후 기대 결과를 바꾸어 회귀 검증으로 전환해야 한다.
- 초기 추가 스크립트는 SelectField 탐색자를 잘못 사용해 중단됐다. 실제 접근성 역할인 combobox로 수정한 뒤 전체 재실행을 통과했다. 이를 제품 결함으로 집계하지 않았다.

## 흐름별 평가

| 단계 | 실제 확인한 흐름 | 상태 | 강점과 마찰 |
| --- | --- | --- | --- |
| 1 | 저장소 열기 → 전체 그래프 → LOCAL/ORIGIN 조회 | 조건부 양호 | 실제 부모 관계를 표시하고 조회와 checkout을 분리한다. 최소 창에서는 한 행 정도만 보여 이점이 줄어든다. |
| 2 | 변경 확인 → 파일 스테이징 → 커밋 → 외부 편집 반영 | 개선 필요 | 기본 커밋과 초안 복원은 통과. 외부 파일은 수동 갱신 전까지 목록에 없었다. |
| 3 | 브랜치 비교 → 조건·결과 검토 | 조건부 양호 | 기준과 비교 방향, 양쪽 전용 커밋을 구별한다. A/B·끝점 표현은 초보자에게 추가 해석을 요구한다. |
| 4 | 원격 동기화·Stash → worktree 탐색·탭 열기 | 조건부 양호 | 실제 로컬 원격 동작 및 키보드 worktree 열기 통과. 일상 버튼이 긴 화면 아래로 밀린다. |
| 5 | 충돌 편집 → 상위 화면 이동 → 돌아오기 / 해결 표시 | 차단 결함 | 입력한 초안이 확인 없이 사라진다. 해결 표시 뒤 merge 완료도 외부 도구가 필요하다. |
| 6 | 프로젝트 현황 → 호스팅 계정 연결 | 진입 장벽 | 권한·세션 유지 조건은 명확하다. 일반 사용자에게 OAuth 앱 등록과 Client ID 준비를 요구한다. |
| 7 | 프로젝트 → PR/MR 상세 → 변경·리뷰·CI 확인 | PM 목표 미달 | 근거 조회는 가능하지만 여러 프로젝트의 담당·대기 이유·다음 조치 집계와 앱 내 조치가 없다. |
| 8 | AI Agents → 사용 설정·지원 범위 확인 | 부분 구현 | 실행하지 않고 켜기/끄기 가능. 대화·자동 충돌 수정은 미연결이며 제공자별 한도 지원이 다르다. |
| 9 | 외부 도구 연결 → 허용 저장소 → MCP 설정 | 범위 내 양호 | 읽기 범위와 저장소 선택이 명시적이다. 외부 IDE의 실제 등록·작업 경험은 별도 검증이 필요하다. |

## 우선순위와 완료 조건

모든 항목은 **발견·미수정** 상태다. 결함과 원래 미구현인 제품 요구를 구별했다. P0는 입력 데이터 손실, P1은 핵심 흐름의 미완료, P2는 탐색·판단·복구 마찰 기준이다.

### P0-01 · 화면 이동 시 충돌 해결 초안 유실 — 재현된 결함

단계 5. 충돌 파일을 불러와 결과를 편집한 뒤 `프로젝트 현황`을 눌렀다가 `내 작업`으로 돌아오면 파일 선택과 편집기가 초기화된다. 확인 대화상자는 없으며 원본을 다시 읽어도 입력한 문장은 돌아오지 않는다. **디스크의 원본과 Git 이력은 유지되지만 사용자가 작성한 미저장 입력이 소실된다.** 기존 경고 문장으로 예방할 수 있는 문제로 보지 않는다.

근거: [이동 전](draft-before-navigation.png), [이동 후](draft-after-navigation.png), 추가 재현 로그. [DesktopApp](../../src/app/DesktopApp.tsx) 상위 page 분기에서 RepositoryWorkspace가 해제되고 [ConflictWorkspace](../../src/features/workspace/ConflictWorkspace.tsx)의 snapshot/draft가 내부 state에만 있다.

수정: 저장소·파일·원본 버전별 편집 상태를 상위로 올려 화면 이동에도 유지한다. 탭 닫기·앱 종료에서는 명시적인 초안 보존 또는 버리기 선택을 제공한다. 원본 버전이 바뀌면 초안을 남긴 채 재검토를 요구해야 한다.

완료 조건: 프로젝트 현황·Agent·외부 도구 이동 및 탭 전환 후 초안 동일, 닫기 취소 시 동일, 원본이 외부 변경되어도 초안 소실이나 무검증 덮어쓰기 없음.

### P1-02 · 충돌을 해결해도 Git 작업을 끝낼 수 없음 — 미구현 요구

단계 5. 파일 저장·백업 복원·해결 표시는 동작한다. 그러나 해결 표시 뒤에도 Git operation은 merge로 남고, 일반 커밋 버튼은 operation 중 비활성이다. 외부 Git 도구로 계속하라는 안내만 제공한다. 자동 rebase Pull 역시 현재 지원 범위가 아니다.

근거: 이번 충돌 테스트가 해결 표시 후 `operation === merge`를 확인했다. [ConflictWorkspace](../../src/features/workspace/ConflictWorkspace.tsx), [RepositoryWorkspace](../../src/features/workspace/RepositoryWorkspace.tsx).

수정: 현재 Git 작업을 상단에 고정하고 `미해결 파일 → 결과 검토 → 병합 계속`을 연결한다. 중단은 영향을 설명하는 별도 확인으로 제공한다. merge와 rebase의 진행 조건은 구별해야 한다.

완료 조건: 임시 merge/rebase에서 수정·해결 표시·계속으로 실제 작업 종료까지 가능하고 실패 시 입력과 작업 상태를 보존한다.

### P1-03 · PM의 계정 연결에 개발자 설정을 요구 — 진입 UX

단계 6. `계정 연결` 첫 화면에 공개 Client ID 입력과 OAuth App 등록 지침이 나온다. PM은 로그인 전에 외부 서비스의 개발자 설정을 이해해야 한다. 잘못된 입력의 포커스·오류 처리는 좋지만 준비 부담을 해소하지 못한다.

근거: [계정 연결 화면](oauth-onboarding.png), [AccountConnections](../../src/features/hosting/AccountConnections.tsx).

수정: 배포용 등록 앱을 기준으로 제공자 선택 → 브라우저 승인 → 프로젝트 선택으로 구성하고 사용자 지정 Client ID는 고급 연결로 이동한다. Git 전송 인증과 OAuth의 차이는 유지하되 필요한 때 단계별로 설명한다.

완료 조건: 일반 연결에서 Client ID를 직접 준비하지 않고 시작 가능. 앱 등록·제공자 정책·실계정 승인은 별도의 실제 통합 검증 조건이다.

### P1-04 · PM의 질문에 답하는 요약과 조치 흐름 부재 — 미구현 요구

단계 7. 프로젝트 하나를 열어 PR/MR, 리뷰 기록, Checks, Commit Status, CI를 따로 조회한다. 상태·작성자·브랜치는 상세의 접힌 영역에 있다. 여러 프로젝트에서 누가 어떤 리뷰를 기다리는지, 무엇 때문에 병합이 막혔는지를 묶어 보여주지 않는다. PR/MR 생성·댓글·리뷰·병합, CI 재실행/취소는 외부 제공자로 이동해야 한다.

근거: [PR 상세](desktop-review-files.png), [CI 상세](desktop-hosting.png), [HostingWorkspace](../../src/features/hosting/HostingWorkspace.tsx), [ReviewResources](../../src/features/hosting/ReviewResources.tsx), [구현 범위](../../IMPLEMENTATION.md). 조회 성공과 관리 흐름 완료를 구별했다.

수정: 프로젝트·작업명·담당·대기 이유·대기 기간·최신 검사·다음 조치를 가진 작업 목록을 먼저 제공한다. PR 상세 상단에서 최신 SHA 기준 검사·승인 근거를 요약하고 알 수 없는 상태는 미확인으로 표시한다. 이후 권한과 최신 버전을 재확인하는 쓰기 흐름을 연결한다. 개발자에게도 같은 목록을 `내 리뷰 요청`으로 사용할 수 있게 한다.

완료 조건: 둘 이상의 프로젝트에서 검토 대기와 CI 실패를 식별하고 담당자·원인을 한 화면에서 파악한다. 일부 요청 실패나 오래된 승인으로 병합 가능을 오판하지 않는다. 앱 내 조치와 제공자에서 할 조치가 명확히 구별된다.

### P1-05 · AI의 활성 설정과 실제 작업 지원 사이의 간격 — 미구현 요구

단계 8. Claude·Codex·Gemini 설정은 있지만 충돌 해결 대화·추가 지시·결과 적용은 없다. Codex에는 한도 조회 경로가 있고 Claude/Gemini에는 자동 조회 미지원이 표시된다. 이를 모든 Agent의 로그인·사용량·실행이 완료된 것으로 안내하면 안 된다.

근거: [Agent 화면](agents-capability.png), [AgentSettings](../../src/features/agents/AgentSettings.tsx), 단계 5 안내. 이번 실행에서는 실제 quota 수치를 검증하지 않았다.

수정: 설정 화면에 `설치 / 인증 확인 / 사용 설정 / 실행 지원 / 한도 지원`을 구분하고, 충돌 화면에서 대화 → 변경안 검토 → 별도 적용 흐름을 연결한다. 제공되지 않는 사용량은 미지원 상태를 유지한다.

완료 조건: 지원 Agent 한 개부터 취소·오류·추가 지시·초안 보존·적용 직전 원본 검사를 끝까지 검증한 뒤 지원 목록을 확장한다.

### P2-06 · 외부 편집 후 상태가 수동 갱신 전까지 낡음 — 재현된 마찰

단계 2. 외부에서 새 파일을 만들고 2초 관찰했을 때 변경 목록은 기존 1개였다. `상태 새로고침` 후 2개로 바뀌었다. 이 관찰을 무한 대기 실험으로 확대하지 않으며, 현재 DesktopApp에 자동 watcher/포커스 갱신이 없다는 코드 확인이 뒷받침한다. 쓰기 직전 버전 검사는 이미 있지만 사용자가 현재 상태를 아는 문제는 남는다.

근거: [갱신 전](external-change-stale.png), [갱신 후](external-change-refreshed.png), [DesktopApp](../../src/app/DesktopApp.tsx).

수정: 먼저 앱 복귀·탭 활성화에 갱신을 연결하고, 활성 저장소의 외부 변경 감지는 중복 요청을 합쳐 제공한다. 새로고침은 스크롤과 관계없이 접근할 수 있는 저장소 도구 영역에 둔다. 원격 추적 상태는 마지막 Fetch 기준이라는 안내를 유지한다.

완료 조건: 외부 변경 후 사용자 복귀 시 파일·HEAD·브랜치가 함께 갱신되고 선택·초안은 보존된다. 느린 이전 요청이 다른 탭의 상태를 덮지 않는다.

### P2-07 · 그래프와 기본 기능의 작업 공간 부족 — 시각·탐색 UX

단계 1·3·4. 760×580 화면에서 그래프 시작은 약 y=473, 고정 footer는 y=542 부근이라 첫 행 정도만 보인다. 헤더·프로젝트 탭·제목·HEAD·기능 메뉴·조회 설명·필터가 본문 앞을 차지한다. 사이드바·본문·그래프가 각각 세로 스크롤되고 프로젝트 탭·기능 메뉴에도 가로 스크롤이 있다. 사이드바를 내리면 프로젝트 현황과 Agent 메뉴가 화면 밖으로 이동한다. 접근 불가능한 것은 아니지만 반복 이동 비용이 크다.

근거: [넓은 그래프](repository-graph.png), [최소 창 그래프](repository-graph-narrow.png), [worktree](quality-worktrees.png), [CSS](../../src/app/desktop.css).

수정: 저장소명·현재 브랜치·동기화·새로고침을 한 도구 영역에 묶고 작성자 설정은 설정 메뉴로 옮긴다. 전역 탐색과 저장소 목록의 스크롤을 분리한다. 작은 창에서는 제목과 반복 메타 영역을 줄이고 목록에 남은 높이를 준다. 컨트롤 클릭 영역을 무조건 줄이지 않는다.

완료 조건: 760×580에서도 스크롤 전 여러 커밋을 비교할 수 있고, 본문을 읽으면서 전역 메뉴와 새로고침을 바로 찾을 수 있다. 탭·메뉴의 키보드 이동과 포커스 표시 유지.

### P2-08 · 원격 프로젝트와 로컬 저장소 맥락이 섞임 — 판단 UX

단계 7. 원격 PR/CI 상세를 스크롤하면 원격 프로젝트 제목은 사라지지만 왼쪽에는 다른 로컬 저장소 `한글 project`의 브랜치와 footer HEAD가 남는다. 로컬 영역이라는 문구는 있으나 상세 화면 바로 옆에서 두 대상의 관계를 판단하기 어렵다. 실제로 잘못된 저장소를 수정한 것은 확인되지 않았으므로 오작동으로 보고하지 않는다.

수정: 원격 상세에는 제공자 / 계정 / 프로젝트 / PR 번호를 지속적으로 표시한다. 로컬 저장소와 연결되었는지, 별개인지 명시하고 해당 로컬 작업으로 이동하는 행동을 구분한다. 원격 프로젝트 선택·탭 복원을 로컬 탭처럼 제공한다.

완료 조건: 다른 로컬 저장소를 연 상태에서도 현재 PR의 원격 소속과 검사 SHA를 혼동 없이 확인할 수 있다.

## 후속 기능 순서

개인 개발자: 위 입력 보존·갱신·Git 작업 마무리 후 hunk 스테이징, 변경 폐기와 복구, 브랜치 이름 변경/삭제, 기존 브랜치 worktree 생성, SHA 검색을 우선한다. 이미 가능한 기본 stage/commit을 새로 만들 필요는 없다.

PM: 연결 단순화와 작업 목록·대기 이유를 먼저 만든 뒤 리뷰·PR/MR 생성·병합·CI 조치를 연결한다. 큰 통계 카드보다 실제 담당자와 막힌 작업이 먼저다.

공통 디자인: 기존 Button·Disclosure·Badge·Notice·CodeDiff·CommitGraph·BranchTree를 재사용/확장한다. 작업 요약 같은 역할이 없으면 공통 컴포넌트로 생성·공개하고 Storybook 상태를 추가한다. 별도의 화면별 디자인 체계나 테마 교체는 필요하지 않다.

## 접근성 판단과 제한

현재 시나리오의 axe 검사와 일부 키보드·IME 검증은 통과했다. worktree 열기 Enter, 검색 지우기 포커스, dialog Escape, 한글 조합 중 미제출 등이 포함된다. 시각적으로 선택 상태와 포커스 테두리가 구별되고 상태를 색만으로 전달하지 않는 점은 강점이다.

다만 많은 중첩 스크롤, 11px 전역 메뉴/메타, 긴 코드와 경로, 접힌 상태 정보는 저시력·키보드 사용자의 탐색 부담을 높일 위험이 있다. 이는 이번 스크린샷에 근거한 위험 평가이며 자동 검사 실패라고 주장하지 않는다. 실제 VoiceOver, 시스템 글자 확대, 고배율, 긴 한국어/브랜치 대량 데이터, 대형 저장소의 지연, Windows/Linux, 실계정 SSO·OAuth·Agent 세션은 검증하지 않았다. 전체 접근성 준수나 공개 출시 준비 완료를 주장할 수 없다.

## 이번 실행의 화면 기록

### 1. 그래프와 현재 저장소
![전체 그래프](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/repository-graph.png)
![최소 창 그래프](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/repository-graph-narrow.png)

### 2. 변경과 외부 편집 반영
![수동 갱신 전](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/external-change-stale.png)
![수동 갱신 후](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/external-change-refreshed.png)

### 3. 브랜치 비교
![브랜치 비교](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/desktop-compare.png)

### 4. 원격·worktree
![원격 동기화](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/desktop-sync.png)
![worktree 최소 창](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/quality-worktrees.png)

### 5. 충돌 편집과 화면 이동
![충돌 원본 비교](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/desktop-conflicts.png)
![이동 전 초안](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/draft-before-navigation.png)
![이동 후 초기화](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/draft-after-navigation.png)

### 6. 계정 연결
![OAuth 첫 연결](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/oauth-onboarding.png)

### 7. 원격 검토와 CI
![PR 검토](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/desktop-review-files.png)
![CI 상세](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/desktop-hosting.png)

### 8. Agent
![Agent 지원 범위](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/agents-capability.png)

### 9. MCP
![MCP 저장소 선택](/Users/cha_hammin/develop/personal/frontend/branchline/docs/ux-audit-2026-09-14/desktop-mcp-scope.png)
