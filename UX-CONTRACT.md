# Branchline 동작 계약

근거: PRODUCT.md, GIT_WORKFLOWS.md, INTEGRATIONS.md. 시각 토큰은 DESIGN.md와 기존 CSS가 원본이다. 한국어 데스크톱 제품이며 일본 시장 전용 규칙은 적용하지 않는다.

| Capability | Canonical owner | Source of truth | Allowed variants | Verification |
| --- | --- | --- | --- | --- |
| Table Selection | workspace 선택 상태 | Git 작업 명세 | 단일 커밋/파일, 필터 변경 시 해제 | desktop E2E |
| Select/Listbox | 공통 SelectField, 기존 BranchFilter | DESIGN.md | 설정/비교는 OS 팝업 허용, 기존 검색형 브랜치는 authored | keyboard/E2E |
| Date | native input date | Git 작업 명세 | 로컬 시간대의 달력 허용 | 날짜 경계 테스트 |
| Form | 공통 TextField/TextArea | DESIGN.md | noValidate, 인라인 오류·초안 보존 | validation/E2E |
| Scrollbar | src/index.css | DESIGN.md | 전역 무채색, 코드 패널 가로 스크롤 | narrow viewport |
| Column Resize | 공통 ResizeHandle | DESIGN.md | 포인터 캡처 드래그, 너비는 좌우 키·높이는 위아래 키, Home/End, 최소/최대 제한 | Storybook·Electron E2E |
| History Overview | 공통 ScrollOverview | DESIGN.md | 범위 표시, 클릭·드래그, 위아래·Page·Home/End, 전체 표시 시 비활성 | Storybook·Electron E2E |
| Toast | 공통 ToastProvider / ToastMessage + 지속 오류 Notice | DESIGN.md | 성공·안내·경고·오류·진행 상태, 중복 제거, hover/focus 정지 | live region, F6, 모달 포털 |
| CRUD | desktop 화면·Electron service | INTEGRATIONS.md | 저장소 열기 후 활성 탭, 생성 후 해당 목록 갱신 | 실제 임시 Git 저장소 |

프로젝트 탭과 보기 상태는 URL 대신 로컬 앱 설정에 저장한다. 저장소 경로·개인 커밋 초안은 공유 URL에 넣지 않는다. 탐색은 checkout이 아니며 닫기는 삭제가 아니다. 필터·초안·선택은 탭마다 독립이다. 느린 응답은 요청한 저장소와 조건에만 반영한다.

워크스페이스의 리스트와 코드 패널이 스크롤을 소유한다. 좁은 화면은 목록/상세를 세로로 배치하고 전체 페이지 가로 넘침을 막는다. 긴 경로는 전체 보기와 줄바꿈을 제공한다.

변경 확정 전에는 대상·효과가 보이는 앱 Dialog를 사용한다. 작업 중 중복 실행을 막고 실패하면 폼·초안을 보존한다. 파일 폐기·강제 Git 명령은 구현·복구 검증 전 제공하지 않는다. 호스팅은 실제 연결 계정과 조회 상태를 표시하고 AI는 선택 파일의 대화·수정안 검토·중단을 제공하고 실제 계정 검증·스트리밍 등 미지원 범위를 구분한다.

비교·필터는 호스트에서 실제 Git 조회를 수행한다. 첫 로딩 개수는 전체 결과 개수가 아니며 더 읽기와 shallow 경계를 구분한다. 현재 메시지와 작성자는 각각 리터럴 필터이며 경로·기간은 별도 조건이다. 통합 SHA 검색은 후속 범위다. 제품 목표의 고급 조건은 구현 상태 문서에서 구분한다.

원격·Stash·복제 폼은 공통 Button/TextField/Checkbox/SelectField/Dialog/Notice를 사용한다. SelectField는 기존 네이티브 팝업 결정을 유지하며 비교와 원격 화면이 함께 사용한다. CodeDiff는 공통 변경 미리보기이고 업무 로직을 소유하지 않는다. 원격 등록은 목록 갱신·선택, 복제는 새 탭 열기, stash 복원은 원본 유지·변경 화면 진입 제공을 따른다. 원격 취소/실패는 자동 재시도하지 않고 현재 상태를 다시 읽는다.

협업 조회는 공통 Pagination·SelectField·Button·Badge·TextField·Checkbox·Dialog·Notice를 조합한다. 프로젝트/리뷰/CI/Jobs는 독립된 페이지와 확인 시각을 가진다. 계정 변경·해제·재승인은 해당 조회 맥락을 초기화하며 늦은 결과는 폐기한다. OAuth 취소는 승인 대기를 끝내고, 연결 해제는 Branchline 보관 토큰 삭제이며 제공자 권한 철회와 별개다. 계정 상태 새로고침은 조회 선택을 보존한다. PR/MR 조회 조건·상세 선택·목록과 상세의 스크롤은 저장소 경로와 조회 계정·프로젝트에 맞춰 복원한다. 그래프는 선택한 커밋과 상단에 보이던 커밋을 따로 기억한다. 두 화면 모두 탭을 닫았다 열거나 앱을 재시작해도 유지한다. 계정 연결 폼은 화면 이탈 시 정리해 승인 대기를 취소한다.

## PR/MR 자원과 MCP 연결

`ReviewResources.tsx`는 요약에서 선택한 PR/MR 버전에 귀속해 파일·논의·리뷰·검사를 조회한다. 자원 선택은 aria-pressed Button, 페이지는 공통 Pagination이며 요약/자원별 갱신을 구분한다. 버전이 바뀌면 이전 결과를 숨기고 요약 새로고침을 안내한다. 파일 patch 누락·잘림, 과거 commit 기록·필수 검사 판단 불가는 명시한다.

`McpSettings.tsx`는 열린 저장소를 Checkbox로 선택하고 Button으로 설정을 생성해 readOnly TextArea에 표시한다. 빈 선택·생성 오류는 Notice로 안내하며 선택 변경 시 결과를 지운다. 앱이 외부 클라이언트 설정을 수정하거나 연결을 완료했다고 표시하지 않는다. 사이드바는 상태 변경 시 글자/배경 대비가 즉시 함께 바뀐다.

## 품질 리뷰의 회귀 계약

- 공통 Disclosure는 네이티브 details/summary의 키보드 동작을 사용한다. 계정 관리·리뷰 요약·로컬 작업·비교 파일 요약에 재사용한다.
- 작업 스크롤은 main이 소유하며 main은 Tab/PageDown으로 접근한다. 헤더·프로젝트 탭·앱 내비게이션을 항상 사용할 수 있어야 한다. 탭 이동/닫기 클릭 영역은 44×44px 이상이다.
- PR/MR와 CI는 aria-pressed 보기 선택으로 이동한다. 상세 진입 시 상세 영역을 포커스하고 목록 복귀 시 선택했던 행을 포커스한다. 목록 필터/스크롤과 리뷰 선택은 보기 전환 시 유지한다.
- MCP의 새 설정 후보와 로컬 현황은 현재 열린 탭에서 도출한다. 캐시에 남은 닫은 저장소를 열린 목록으로 표시하지 않는다. 실행 중인 MCP의 권한 철회 계약은 그대로다.
- 모든 Git 제출 폼에서 IME 조합 Enter를 막는다. 날짜 변환 실패와 역전된 기간은 로딩 종료 및 수정 가능한 오류로 처리한다.
- 원격 조회 실패는 로딩과 구분하고 같은 화면에서 재시도를 제공한다. 미해결 충돌 중 커밋을 비활성화하고 해결 경로를 설명한다. Agent 사용 설정 변경 시 이전 사용량을 지운다.

## 그래프 첫 화면과 저장소 사이드바

- 새로 열기·닫았다 다시 열기·앱 재시작은 `history`(커밋 그래프)로 진입하되 미해결 충돌이 있으면 해결 화면으로 안내한다. 열려 있는 프로젝트 탭 사이의 이동은 기존 보기를 유지한다. 저장된 커밋 초안과 검색 조건을 삭제하지 않는다.
- BranchTree의 LOCAL은 로컬 heads, ORIGIN/기타 원격 그룹은 로컬 remote-tracking refs다. 원격 서버를 실시간으로 조회한 목록으로 표시하지 않는다. 브랜치 선택은 이력 조회만 변경하고 이전 상세 선택·페이지·커밋 필터를 초기화한다. 로컬 checkout은 별도 검토 다이얼로그를 사용한다.
- Worktree 목록은 활성 저장소 경로와 조회 시점에 귀속한다. 오래된 응답은 버리고 오류에 재시도를 제공한다. 선택은 기존 openWorktree IPC로 별도 탭을 열며 checkout·삭제를 실행하지 않는다. 잠금·누락 경로와 현재 worktree를 구분한다.
- 공통 CommitGraph는 Git log의 topo-order와 실제 부모 SHA를 사용한다. 전송은 100개 묶음으로 하되 이력 UI는 무한 스크롤로 누적한다. 첫 조회의 SHA 기준들을 고정하여 뒤쪽 조회에 재사용한다. 필터 없는 이력은 미조회 부모 레인도 예약해 추가 로딩 전후 좌표와 연결을 유지한다. 필터·shallow로 빠진 부모를 다른 조상으로 바꾸지 않는다. 선택 후 실제 커밋 diff를 조회하며 그래프 자체에서 Git 쓰기를 실행하지 않는다.
- BranchTree 그룹/중첩 폴더는 공통 Disclosure, 행은 Button, 검색은 TextField다. 긴 브랜치 이름은 사이드바 안에서 가로 스크롤하고, 행의 호버·키보드 포커스 시 공통 Tooltip에 원격 이름과 상위 폴더를 포함한 브랜치 경로를 표시한다. CommitGraph의 SVG는 보조 시각 정보이며 부모 관계는 텍스트로도 접근할 수 있다. Storybook과 실제 merge/107개 커밋/원격 ref/worktree fixture로 검증한다.


## 2026-09-14 재평가 수정

- 충돌 편집은 DesktopApp의 경로별 `ConflictEditor`가 소유하며 상위 화면 이동에도 유지한다. 원본 재읽기는 기존 버리기 확인을 유지한다. 탭 닫기와 Electron 창 닫기/종료 요청은 공통 Dialog에서 계속 편집 또는 편집 버리기를 선택한다. 디스크에 임의 초안을 저장하지 않는다. 강제 프로세스 종료는 보호 범위 밖이다.
- 활성 저장소는 열기·탭 활성화·앱 복귀 및 5초 간격으로 조회한다. 숨겨진 문서·Git 쓰기 중에는 조회를 제한한다. 같은 상태는 본문을 다시 로딩하지 않고, 오래된 응답은 원래 경로에서만 반영한다. main의 Git 쓰기/상태 조회는 공통 Git 디렉터리 기준 직렬화한다.
- Git 계속은 현재 화면의 operation과 token을 고정해 버튼에서 바로 실행한다. 미해결 충돌·미스테이징 tracked 변경이 있으면 거절한다. 계속 도중 다른 충돌이 나면 새 상태를 읽고 기존 작업을 보존한다. Git 중단·강제 복구는 별도 미지원 범위다. 원본: GIT_WORKFLOWS.md, electron/git.cjs.
- 상위 탐색·새로고침은 고정, 사이드바 저장소 목록과 main이 각자 스크롤한다. 이력 화면에서는 main을 고정하고 그래프 목록과 InspectorPanel 본문이 각각 스크롤한다. 누적 이력 미니맵과 상세 제목·SHA·추가 조회 상태는 고정하며 최소 760×580에서도 상세를 목록 옆에 유지한다. 레인은 24px 간격과 원형 노드 비율을 유지하며 많은 레인에서는 그래프 컬럼 안에서만 가로 스크롤한다. 세로 스크롤은 모든 행이 공유하며 가로 이동으로 제목·라벨이 밀리지 않는다. ResizeHandle은 그래프 48px 이상과 설명 100px 이상을 확보하고 현재 창 너비에 맞춰 제한한다. ScrollOverview는 누적 로드 구간의 현재 위치·범위를 표시하고 클릭·드래그·키보드 이동을 제공한다. 이 조작들은 커밋 선택이나 Git 상태를 변경하지 않는다. 그래프 영역에 한정한 구분색은 보조 정보이고 실제 부모 SHA와 브랜치명이 식별 근거다. 추가 로딩은 선택한 커밋과 기존 목록·스크롤을 보존하고 브랜치·검색 조건 변경은 누적 목록과 선택을 해제한다. HEAD·조회 ref 변경 시 이미 읽은 범위를 새로운 고정 SHA 집합으로 다시 조회하고 한 번에 교체한다. 별도 최신/더 불러오기 버튼을 두지 않는다. 다른 화면의 main 스크롤은 유지한다. 원격 컨텍스트 헤더는 sticky이며 포커스 대상에 여유를 둔다.
- 모아보기는 계정별 선택한 최대 5개 프로젝트, PR/MR·CI 각 첫 30개를 조회한다. 일부 오류는 해당 결과에 남기고 다른 결과를 유지한다. 선택 범위가 바뀌면 이전 결과를 숨긴다. 상세에서 목록 복귀 시 모아보기 선택과 결과를 유지한다. 재시작·계정 변경 시 초기화한다.
- `ActionSummary`는 공통 상태·사실·다음 확인 패턴이며 feature가 제공자 데이터의 의미를 전달한다. 담당·검토 요청 미제공을 승인 완료로 바꾸지 않는다.
- OAuth 배포용 공개 ID는 electron/oauth-clients.json에서 읽는다. 설정되면 일반 사용자는 제공자와 권한/저장 방식만 선택한다. 사용자 지정 ID는 별도 체크박스로 전환하며 배포용 ID가 없으면 준비되지 않은 상태를 명시한다. Client Secret/토큰은 이 설정에 넣지 않는다.


## 후속 실행 계약

- `Conversation`은 공통 UI이며 Agent나 IPC를 직접 호출하지 않는다. IME Enter는 전송하지 않고 명시적 전송 Button만 사용한다. 진행·중단·오류와 입력 보존을 지원한다. Storybook에서 빈 상태·후속 요청·중단·실패를 제공한다.
- 충돌 AI 요청은 Agent별 대화와 원본 token에 귀속한다. 완료된 대화·입력은 상위 화면 이동에도 남고 진행 요청은 이탈 때 취소한다. 적용되지 않은 수정안과 입력은 정상 종료/탭 닫기 보호 대상이다. 계정 변경 자동 감지와 영구 대화 보관은 미지원이다.
- `HostActions`의 업무 로직은 features/hosting에 두고 디자인 컴포넌트를 조합한다. 계정의 명시적 writeAccess가 필요하며 stale SHA/CI 회차를 main에서 다시 검사한다. 작업안은 만료·취소·한 번 실행 후 재사용하지 않는다. 결과 불명에서 자동 재시도하지 않고 보존된 폼과 제공자 결과 조회로 복구한다.

## 중앙 툴바·앱 설정

- GitToolbar는 공통 ToolbarButton을 조합하는 시각 소유자다. RemoteWorkspace는 기존 원격/보관 작업과 확인 Dialog의 단일 실행 소유자로 유지하며, 저장소 보기 탐색 옆의 상단 슬롯에 동기화(Fetch·Pull·Push)와 브랜치·Stash 작업을 묶어 표시한다. 좁은 창에서는 툴바를 다음 줄에 배치한다. Branch는 RepositoryWorkspace의 기존 생성 Dialog로 연결한다. 저장소 보기 이동으로 작업 대상이 다른 저장소로 바뀌지 않는다.
- Fetch/Pull/Push는 원격·브랜치를 확인하고 선택할 수 있다. Pull은 fast-forward만 수행한다. Pop은 최신 보관 항목을 다시 읽고 SHA를 확인하며 복원 성공 시 제거하고 충돌·실패 시 원본을 보존한다. Apply는 원본을 유지하는 기존 동작이다. 진행 중 중복 실행과 탭 닫기를 막고 실패 후 상태를 다시 읽는다.
- ProfileSettings는 앱 설정에 저장한 프로필 목록을 관리한다. 이름/이메일을 IPC 경계에서 검증하고 최대 30개를 보관한다. 적용은 선택한 저장소의 local Git identity를 갱신하며 다른 저장소의 전역 설정이나 로그인 세션은 변경하지 않는다. 같은 Git 디렉터리를 공유하는 worktree에 함께 적용될 수 있음을 표시한다. 프로필 편집/삭제만으로 이미 적용된 저장소 설정을 수정하지 않는다. 저장 실패 시 입력을 보존하고 앱 설정 이동 중 충돌 초안도 유지한다.


## Stash·Worktree와 자동 충돌 안내

- STASH·WORKTREES의 탐색·관리 진입점은 왼쪽 BranchTree가 소유한다. 원격 설정과 Stash 보관함은 화면을 분리하되 RemoteWorkspace의 실행·검토·오류 복구를 공유한다. 사이드바는 최근 100개 Stash만 보여주며 전체 보관함의 페이지 탐색으로 나머지를 조회한다. 보관함은 같은 Git 저장소의 worktree가 공유한다. 선택한 diff는 SHA 기준이며 목록 위치를 쓰기 대상 식별자로 단독 사용하지 않는다.
- 활성 저장소는 기존 5초 상태 조회와 창 포커스/표시 복귀 시 갱신으로 외부 충돌을 감지한다. 앱 내 Git 작업 실패도 상태를 다시 조회한다. Merge/Rebase/Cherry-pick의 진행 여부와 미해결 파일은 실제 Git 상태를 사용하며 Stash 복원처럼 operation이 없어도 충돌 파일이 있으면 해결 화면으로 안내한다.
- 같은 충돌에서는 수동 탐색을 존중하고 첫 안내를 반복하지 않는다. 충돌 없는 상태 관찰 후 재발 또는 HEAD·브랜치·진행 작업 변경은 새 안내 대상이다. 폴링 사이에 시작·종료된 작업은 감지하지 못할 수 있다. 비활성 저장소 전체를 백그라운드 감시하는 기능은 추가하지 않는다.
- 해결 화면 진입 시 기존 편집이 없으면 첫 충돌 파일을 자동으로 읽고 AI 대화를 펼친다. 오류는 파일 선택과 수동 재조회로 복구한다. 기존 초안·완료 대화·AI 수정안은 자동 교체하지 않는다. 자동 감지는 CLI 요청이나 실제 파일 저장을 실행하지 않으며 사용자의 명시적인 전송·검토 흐름을 유지한다.


## 이력 갱신·선택 계약

- 커밋 검색창과 HEAD 이동은 그래프 바로 위에 항상 표시한다. 그래프에서 / 키를 누르면 검색창에 포커스한다. FilterBar에서 브랜치·작성자·경로·날짜 조건을 펼치거나 접을 수 있고, 적용 개수를 표시한다. 필터 초기화는 검색어를 유지한다.
- HistoryGraph는 하단 근처에서 100개씩 자동 추가한다. 최초부터 모든 기록을 읽어 UI를 멈추게 하지 않는다. 정상 상태의 상시 하단 문구와 작업 버튼은 제거하고 진행·실패·shallow 경계만 노출한다. 실패 시 기존 행을 유지하고 공통 Button으로 같은 요청을 재시도한다.
- HEAD·전체 refs 또는 선택한 ref의 SHA가 바뀌면 이전에 읽은 범위까지 다시 조회해 한 번에 교체한다. 갱신 요청에서도 첫 페이지의 revision SHA 집합을 고정하며 오래된 응답은 버린다. 스크롤 중이면 첫 가시 커밋의 SHA·행 내부 offset을 유지하고 맨 위에서는 새 커밋을 보여준다. 필터 변경은 기존처럼 탐색을 초기화한다. 단순 작업 파일 변경은 과거 커밋 목록·diff를 새로 읽게 하지 않는다.
- 그래프·비교 목록에서 선택 전에는 상세를 렌더링하지 않는다. 같은 커밋 재선택, 그래프/상세의 Esc, 상세의 선택 해제로 닫는다. 위아래 키는 그래프의 인접 커밋을 선택한다. 상세 닫기는 선택했던 행으로 포커스를 반환한다. IME 조합 중 키 입력은 단축키로 처리하지 않는다.
- 전체 SHA 복사는 승인된 저장소의 실제 커밋 SHA만 IPC에서 검증한 뒤 Electron main의 clipboard.writeText로 실행한다. 일반 클립보드 읽기 API나 임의 문자열 쓰기를 renderer에 공개하지 않는다. 관련 API는 [Electron 공식 문서](https://www.electronjs.org/docs/latest/api/clipboard)를 확인했다.
- Branch 시작점은 선택 SHA → 이력의 조회 ref SHA → 현재 HEAD다. 검토 Dialog에 시작점을 표시하고 기존 expected token 검증으로 확인 뒤 바뀐 저장소 상태를 거부한다.


## Stash 위치·상세 계약

- 사이드바 Stash 항목은 보관함 대신 커밋 그래프로 이동한다. 조회 필터를 초기화하고 해당 SHA를 revision 집합에 추가하므로 최신 refs/stash에서 도달할 수 없는 이전 보관 항목도 나타난다. 실제 Stash 커밋과 부모 관계를 그대로 그린다.
- 첫 페이지 밖의 Stash는 해당 SHA가 나올 때까지 100개 단위로 자동 조회하며 고정 revision·중복 제거·요청 취소·오류 재시도를 유지한다. 선택 시 한 번만 위치를 맞추고 이후 사용자의 스크롤을 존중한다. 사이드바 같은 항목을 다시 누르면 다시 위치를 맞춘다.
- 상세는 선택한 SHA의 stash show --stat --patch --include-untracked 결과를 사용한다. 한글 경로는 표시용 명령에만 core.quotepath=false를 적용해 읽을 수 있게 한다. 항목 번호가 바뀌어도 SHA 기준 내용을 유지하며 다시 선택하면 상세를 재조회한다. 조회는 checkout·apply·pop을 실행하지 않는다.

OAuth 앱 ID 자동 선택의 원본은 INTEGRATIONS.md의 이 PC 로그인 앱 자동 설정 계약이다. 계정 승인에 성공한 공개 ID만 기억하며 최초 입력과 고급 사용자 지정은 기존 TextField를 재사용한다. 설정 조회 중에는 승인 요청을 비활성화하고 실패 시 동일 화면에서 재시도·직접 입력을 제공한다.

## 브랜치 메뉴와 Solo

브랜치의 일반 클릭은 전체 그래프 내 위치 선택이다. Solo는 우클릭/⋯/Shift+F10 메뉴에서 명시적으로 선택하고 상단 또는 메뉴에서 해제한다. 선택 ref의 모든 도달 가능한 이력을 조회하며 커밋의 작성 브랜치를 추정하지 않는다. 그래프 Badge와 사이드바는 같은 공통 ContextMenu/BranchMenu를 사용한다.

메뉴에서 실행을 요청하면 기존 작업 Dialog에서 정확한 ref/SHA·방향·이름·위치를 검토한다. 로컬 삭제는 현재 HEAD에 병합된 사용하지 않는 브랜치만 허용한다. 원격 추적 체크아웃은 새 로컬 이름으로 만들며 중복 이름을 덮어쓰지 않는다. 메뉴에서 연 Dialog 취소는 원래 브랜치 버튼으로 포커스를 반환한다.

두 브랜치 비교의 canonical owner는 BranchComparison + 기존 CommitGraph/HistoryGraph다. 커밋 상세는 InspectorPanel/CodeDiff, 로컬 실행 검토는 RepositoryWorkspace Dialog, 원격 생성 검토는 HostActions를 재사용한다. 가져올/반영할 브랜치와 현재 체크아웃 위치를 구분하며 조회만으로 전환하지 않는다.

## 자동 Stash 체크아웃 · 2026-09-14

- 근거: 사용자 자동 Stash → checkout → apply → 성공 후 delete 요청 및 GIT_WORKFLOWS.md의 체크아웃 계약.
- 소유자: electron/git.cjs의 withAutoStash. 사이드바/그래프 BranchMenu, Solo 전환 버튼, ComparisonWorkspace의 체크아웃은 같은 mutate 경로를 사용한다.
- UI: 기존 Dialog/Notice/Button을 재사용하고 확인창에서 파일 수·미추적 포함·스테이징 복원·실패 시 보존을 안내한다. 작업 중 중복 실행을 막고 성공 시 복원/삭제 결과를 알린다. 실패 시 실제 저장소를 갱신하고 충돌이 있으면 기존 ConflictWorkspace로 연결한다.
- Stash 적용 충돌에는 Merge 계속 버튼을 안내하지 않는다. 해결 후 내 변경 사항에서 검토하고 보존된 Stash를 확인 후 삭제한다.

## 커밋 파일 목록 → 그래프 영역의 파일 탭 · 2026-09-14

- 근거: 사용자 요청(선택 커밋의 변경 파일 목록, 파일 클릭 시 그래프 위치 새 탭, 닫기 버튼·Esc).
- 소유자: CommitReview는 선택 SHA와 열린 파일을 관리한다. DiffFileList는 파일 표시/선택, ContentTabs는 ARIA 탭·키보드·닫기, CodeDiff는 실제 변경을 표시한다. InspectorPanel의 확대 목록에서는 DiffFileBrowser가 파일을 모달 내부 CodeDiff로 연다. 변경 파일 목록 버튼으로 돌아오면 표시 방식·폴더 펼침과 해당 파일 포커스를 복원한다. 확대 모달은 닫기/Esc로 닫으며 선택 커밋과 외부 파일 탭을 유지한다. DiffFileList는 목록/트리 전환을 공통 제공하고 트리의 파일 식별은 전체 경로와 기존 diff 인덱스를 유지한다.
- 같은 파일은 중복 탭을 만들지 않는다. 다른 커밋 선택 시 이전 파일을 정리하고, 활성 파일 닫기는 그래프와 선택 커밋을 유지한다. 그래프를 숨겨도 데이터와 스크롤은 유지한다. 파일 탭에서 Esc가 커밋 선택 해제로 전파되지 않게 한다.
- Merge 커밋의 변경 파일은 첫 부모 기준이며 목록에 비교 기준을 알린다. 빈 커밋은 파일 없음, 바이너리·불완전 diff는 기존 원본 표시를 유지한다.

## 그래프 +N 브랜치 목록 · 2026-09-14

- 근거: 사용자 요청(+1 호버 시 연결된 브랜치 목록).
- 소유자: CommitGraph는 같은 SHA의 refs를 전달하고 공통 Tooltip은 호버/포커스·위치·닫힘을 담당한다. 그래프의 별도 브랜치 컬럼과 좁은 화면의 인라인 배지가 같은 동작을 사용한다.
- +N은 숨겨진 참조 개수이며 툴팁에는 이미 표시된 첫 브랜치도 포함한 전체 목록을 표시한다. HEAD는 별도 상태 표시로 개수에 중복 포함하지 않는다.
- 목록 조회는 선택·체크아웃을 변경하지 않는다. 기존 행의 키보드 포커스를 공유하고 첫 Esc는 열린 툴팁만 닫는다. 별도 Git 요청이나 사용자 저장소 쓰기는 없다.

- 긴 그래프 브랜치 이름은 전체 줄바꿈으로 표시하고 해당 행만 자연스럽게 늘린다. 공통 CommitGraph는 실제 행 높이로 선·노드·누적 지도·조회 위치를 맞춘다. 추가 ref는 기존 +N 툴팁을 유지한다. 원본: 사용자 요청(2026-09-14), DESIGN.md.

- 커밋 점 호버는 읽기 전용 포함 브랜치 확인이다. 공통 Tooltip과 graphBranches가 불러온 실제 부모 연결에서 확인한 LOCAL/REMOTE refs를 표시한다. 누락된 조상을 건너뛰거나 최초 작업 브랜치를 추정하지 않는다. 선택·checkout은 변경하지 않는다. 키보드 행 포커스와 Esc 닫기를 지원한다. 근거: 사용자 요청(2026-09-14), DESIGN.md.

## 원격 모니터링과 폴더 상태

- `SyncBadge` → 공통 Badge, `GitToolbar` 및 BranchTree가 재사용한다. `Disclosure`는 제어형 open/onOpenChange를 지원한다. 별도 화면 전용 버튼/배지는 만들지 않는다.
- 자동 확인은 열린 저장소·공통 Git 디렉터리별 60초 cooldown, Git serial queue, Git credential helper/SSH, timeout/비대화형 인증을 사용한다. 자동 Pull·Push·prune은 없다. 실패에도 cooldown을 적용하며 마지막 성공 시간과 실패 상태를 함께 보존한다.
- LOCAL 수치는 각 upstream 비교다. 툴바는 현재 작업 원격/브랜치가 upstream과 같을 때만 수치를 표시하고 별도 push URL이면 Push 수치는 확인 불가로 둔다. Fetch 배지는 원격 미조회 수가 아닌 Pull 대기 수다. OAuth API의 PR/MR·CI 폴링은 이 기능의 대상이 아니다.
- BranchTree 선택 경로 기본 펼침, 검색 결과 경로 펼침, 그룹별 전체 펼치기/접기, 새로고침 중 수동 상태 유지: Storybook SelectedFolders 및 Electron remote-monitor/repository-graph 테스트.

## 커밋 제목·본문과 Amend · 2026-09-14

- 근거: 사용자 요청(그래프 날짜+시:분, Title/Body 카드, 선택적 AI Amend).
- 소유자: CommitMessage/CommitMetadata는 메시지·정보 표현, Dialog wide는 편집/검토 공간, AmendCommit은 초안/Agent 대화/실행 단계를 소유한다. DiffFileList/CodeDiff 및 실제 HEAD 상세/내 변경 사항에서 재사용한다.
- HEAD·로컬 브랜치·진행 중 작업 없음·충돌 없음 조건을 main에서 다시 검증한다. 실행은 기존 expected token과 공통 Git 쓰기 큐를 거친다. 메시지만 수정할 때 index/worktree를 보존하고 스테이징 포함 시 staged 내용만 반영한다. hooks와 서명 설정을 우회하지 않는다.
- 원격 추적 ref 기준 공유 여부와 확인을 표시하며 자동 force push는 없다. 실패 시 초안 보존, 상태 갱신 후 재검토, IME Enter 방지, 중첩 모달 Esc와 포커스 복원을 유지한다.
- AI 제안은 명시적 전송, 로그인된 활성 Agent의 기존 도구 비활성 CLI 경로, 제안 적용, 최종 실행으로 구분한다. 기존 메시지와 diff를 전송하며 계정 인증이나 유료 호출을 테스트 목적으로 실행하지 않는다.

## 브랜치 메뉴 원격 작업 · 2026-09-14

- 근거: 사용자 요청(사이드바 브랜치 우클릭 Fetch/Pull), 기존 원격 fast-forward Pull 계약.
- 소유자: BranchMenu가 메뉴/비활성 이유, RemoteWorkspace가 대상 확인과 실행을 소유한다. 사이드바와 그래프 배지에서 같은 액션을 사용하며 별도 네트워크 실행 경로를 만들지 않는다.
- LOCAL은 remote upstream, REMOTE는 해당 원격 ref를 사용한다. 구성된 가장 긴 원격 이름 접두사로 `/`가 있는 원격 이름을 처리한다. 다른 로컬 브랜치는 체크아웃 후 Pull, 현재 브랜치에 충돌/진행 중 작업이 있으면 Pull을 막는다. 일반 작업 변경은 2026-09-15 자동 Stash Pull 계약을 따른다.
- 확인창의 원격·브랜치를 고정하여 툴바의 수동 대상과 섞이지 않게 한다. main의 기존 expected token, Fetch 후 localToken 확인, ff-only·오류/취소 처리를 그대로 사용한다. 작업 파일이나 체크아웃은 메뉴 조회로 변경하지 않는다.
- 검증: Features/BranchMenu stories, scripts/check-branch-sync.mjs의 실제 임시 bare remote·다른 upstream 이름·키보드·취소·오프라인 재시도·좁은 창 접근성.

### Fetch/Pull 하위 메뉴 · 2026-09-14

사용자 요청에 따라 `Fetch / Pull` 부모 항목 아래에 Fetch와 Pull을 배치한다. 소유자는 공통 ContextMenu이며 items를 가진 항목은 Base UI 하위 메뉴, onClick 항목은 기존 액션으로 처리한다. 호버/클릭과 방향키 진입, 단계별 Esc 닫기, 포털 충돌 보정, 액션 확인창 이후 원래 브랜치 포커스 복원을 공유한다. ContextMenu.Submenu Story와 branch-sync Electron E2E에서 검증한다.

## 자동 Stash Pull · 2026-09-15

근거: 사용자 요청과 GIT_WORKFLOWS.md의 자동 Stash Pull 계약. 공통 Git withAutoStash가 체크아웃/Pull의 보관·복원·삭제를 소유한다. RemoteWorkspace와 BranchMenu는 기존 컴포넌트/IPC를 사용하고 일반 변경으로 Pull을 차단하지 않는다. 충돌·진행 중 작업·로컬 브랜치 없음은 차단하며 확인창은 변경 수와 복구 계약을 표시한다. 실패 시 초안/작업 상태를 갱신하고 보존된 Stash와 충돌 해결 경로를 제공한다. 단독·전체 Electron E2E 및 실제 임시 Git 테스트로 검증한다.

## 작업 폴더 편집 · 2026-09-15

- 사용자 요청: 그래프 자리에 편집 탭, 오른쪽 파일 디렉터리, 왼쪽 실제 파일 수정. 공통 ContentTabs/FileEditor/Button/TextArea/Disclosure/Dialog를 사용한다.
- WorkingFiles: 폴더를 펼칠 때 직접 자식만 조회, 저장소별 한 파일의 편집 초안 유지. 파일 교체/다시 읽기/탭 닫기·Esc는 미저장 초안을 확인한다. DesktopApp이 프로젝트 닫기·네이티브 종료를 보호한다. 그래프·다른 페이지·프로젝트로 이동해도 초안은 유지한다.
- main의 authorized 경로와 공통 Git serial 큐에서 1 MiB 이하 UTF-8 일반 파일만 편집한다. 기존 CRLF/BOM/실행 권한을 유지하고 staging/commit은 실행하지 않는다. 원본 내용·inode·ctime·HEAD·브랜치가 달라지면 저장을 거부하고 초안을 유지한다. .git/심볼릭 링크/하드 링크/중첩 저장소·submodule/충돌 파일은 이 편집기로 쓰지 않는다. 혼합 줄바꿈은 읽기 전용. 외부 도구와 OS 수준의 배타 잠금은 제공하지 않으며 원자 교체 직전 다시 확인한다.
- 원격 관리 제거 대신 중복 동작만 정리: 상단 GitToolbar에서 Fetch/Pull/Push, 사이드바 설정 진입점에서 주소와 Upstream. 로컬 상태 갱신은 작은 아이콘으로 유지.
- 검증: FileEditor Storybook, working-files Node 테스트, check-working-files Electron 실제 저장·줄바꿈·인덱스 보존·외부 변경·초안·닫기·키보드·IME·최소 창 크기·접근성.

## 내 변경 사항의 통계와 새 파일 diff · 2026-09-15

- 사용자 요청: 새 파일의 추가 행을 초록색으로 통일하고 작업 파일마다 추가·삭제 줄 수와 버튼 여백 제공.
- 소유자: Git diff/numstat가 데이터, FileChangeRow/DiffStats가 행·기호·상태 표현, CodeDiff가 공통 unified/split 뷰를 소유한다. 작업 파일은 index 대비, 스테이징은 HEAD 대비 줄 수로 분리한다.
- 조회는 활성 내 변경 사항 화면에서 상태 토큰을 기준으로 실행하고 늦은 응답을 폐기한다. main의 authorized 경로·공통 Git 큐·전후 토큰 확인을 사용한다. 실패는 재조회 경로와 이유를 표시하며 신규 파일 통계 조회의 Git 프로세스 동시 실행은 4개로 제한한다.
- 새 파일의 Git no-index diff는 외부 diff/textconv 없이 /dev/null과 비교한다. 바이너리/1 MiB 초과/조회 실패는 계산 불가 상태이며 0줄로 위장하지 않는다. 빈 파일은 +0/−0. 파일 조회는 저장·staging·commit을 수행하지 않는다.
- 검증: Git 실제 fixture의 부분 스테이징·이름 변경·특수 경로·바이너리·심볼릭 링크·stale 검사, FileChangeRow Storybook, 실제 Electron check-changes/check-diff-viewer의 녹색 행·줄 수·stage/unstage·여백·좁은 창·접근성.

## 현재 프로젝트 PR/MR · GitLab PAT

프로젝트 현황의 대상은 현재 열린 저장소 탭이다. remote의 호스트와 경로로 프로젝트를 조회하고 전체 계정 저장소 카탈로그는 거치지 않는다. 상단 탭 전환은 프로젝트 현황을 유지하며 이전 대상의 늦은 응답은 폐기한다. 같은 화면 내 원격·계정 변경 시 리뷰 선택은 초기화한다. 다른 주 화면을 다녀올 때 현재 프로젝트 상세는 유지한다. 계정이 하나면 자동 연결하고 같은 호스트 계정이 여럿이면 사용자가 선택한다. 서로 다른 서버의 계정을 대신 사용하지 않는다.

GitLab PAT는 연결 창에서 서버 주소와 마스킹 입력으로 받는다. 공개 Application ID가 필요하지 않다. HTTPS origin(선택적 포트)을 지원하며 경로 설치·HTTP·SSH 별칭 자동 해석은 지원하지 않는다. 토큰을 요청 직후 입력 상태에서 지우고 main에서만 보관한다. 기본 원격 쓰기는 꺼져 있다. 실제 권한은 서버에서 확인하며 read_api 조회와 api 쓰기 권한을 안내한다.

## PR/MR 탐색 밀도와 검토 탭

공통 ReviewListRow는 목록 전체 행을 키보드로 열 수 있는 Button으로 구현한다. 목록에는 GitHub #번호, GitLab !번호와 실제 업데이트 시각을 표시하며 CI 상태를 조회하지 않은 경우 성공/실패 아이콘을 만들지 않는다. 목록의 필터/페이지와 선택한 행으로 돌아오는 포커스를 유지한다.

ReviewDetailLayout과 ContentTabs(underline)를 사용한다. 개요에서 본문과 현재 Head 검토 요약·원격 작업을 확인하고 변경 파일/대화/검사 자료는 탭에서 조회한다. 자료 변경 시 버전 검증과 기존 오류 복구를 유지하며 미조회·조회 실패·현재 Head 결과 없음·추가 페이지를 숨겨서 성공처럼 표현하지 않는다. Escape/IME와 원격 실행 확인 Dialog는 기존 계약을 유지한다. 상세의 담당자/리뷰어/상태 사이드바는 좁은 창에서 본문 아래로 이동한다.

## 변경 파일 메뉴 · 2026-09-15

근거: 사용자 GitKraken 변경 파일 메뉴 요청. 공통 ContextMenu/FileChangeRow가 우클릭·⋯·Shift+F10과 2단 메뉴를 소유하고 FileActions가 실제 Git/native 연결·확인·오류 복구를 담당한다. 기존 BranchMenu와 같은 포커스 복원과 Esc 동작을 사용한다.

- 작업 파일 변경 취소는 작업 트리만 인덱스로 복원한다. 스테이징 내용은 유지한다. 미추적·이름 변경 파일에는 이 취소를 적용하지 않으며 새 파일 삭제는 휴지통으로 이동한다. 휴지통 이동도 인덱스에는 영향을 주지 않는다.
- 이 파일 Stash는 선택한 파일의 작업/인덱스를 함께 보관한다. Git의 Stash 인덱스 부모에 다른 staged 파일이 포함되는 문제를 피하기 위해 다른 파일이 스테이징되어 있거나 이름 변경·첫 커밋 전·충돌·진행 작업이 있으면 전체 Stash를 안내한다.
- 무시 규칙은 미추적 파일만 선택 가능하며 루트 .gitignore에 파일/확장자/폴더 규칙을 추가한다. 광범위 규칙은 확인창에서 범위를 설명한다. 기존 추적을 해제하거나 파일을 삭제하지 않는다. 특수문자는 Git 패턴으로 escape하고 링크를 통한 외부 파일 수정은 거부한다.
- 파일 이력은 기존 그래프의 파일 경로 필터, Blame은 고정 HEAD의 읽기 전용 CodeDiff, 편집은 기존 작업 폴더 탭이다. 다른 파일의 미저장 편집을 덮어쓰지 않는다. 이력에서 과거 이름 전체를 자동 추적하는 기능은 추가하지 않는다.
- native 연결은 승인된 저장소의 실제 변경 파일만 허용한다. 상대/전체 경로 복사, 기본 프로그램, 파일 위치, 패치 저장, 휴지통을 제공한다. 외부 IDE·difftool 지정 기능은 미구현이며 작동하지 않는 메뉴는 노출하지 않는다. 기본 프로그램 연결이 IDE이면 해당 프로그램으로 열린다.
- 읽기/쓰기 전 상태 토큰과 일반 파일 경계 검증, 공통 Git 쓰기 큐를 사용한다. 새 바이너리/큰 파일 패치는 먼저 스테이징해야 한다. 내보내기는 기존 파일을 덮어쓰지 않는다. 취소·실패에는 재조회/원래 메뉴로 복귀 경로를 유지한다.

## 변경 파일 탐색·부분 스테이징

- ChangeFileList는 작업 파일과 스테이징 각각의 검색/트리/높이를 유지한다. FilePathList가 커밋 파일 목록과 폴더 구조를 공유한다. 검색 중에도 전체 스테이징은 전체 범위이며 이를 결과 수 옆에 알린다.
- CodeDiff는 구간 번호만 콜백으로 전달한다. RepositoryWorkspace는 표시된 diff와 당시 token을 함께 보낸다. main은 현재 Git diff와 일치를 검증하고 서버에서 선택 구간을 추출하여 `git apply --cached`로만 적용한다. 해제는 `--reverse`이며 작업 파일은 수정하지 않는다.
- `--check` 실패, 오래된 token/diff, 잘못된 구간 번호, 특수 파일/진행 중 작업은 쓰기 전에 거부한다. 실패 후 상태를 다시 조회하며 남은 변경이 있으면 파일 선택을 유지한다. 행 단위 선택과 신규/삭제/이름 변경/바이너리/모드 변경의 부분 적용은 미지원이다.

## PR/MR 서버 필터·본문 표시

- 필터와 디바운스는 ReviewFilters, 실제 데이터/페이지/선택은 HostingWorkspace.ProjectFeed, 요청 검증은 electron/hosting.cjs가 소유한다. 기존 native SelectField 결정을 유지한다. 필터 변경은 첫 페이지와 목록으로 이동하고 목록 복귀는 기존 필터와 행 포커스를 유지한다. 다른 프로젝트/계정/CI 화면으로 전환하면 필터는 초기화된다.
- GitHub 기본 목록은 pulls, 추가 조건은 Search Issues and Pull Requests의 저장소 고정 검색과 해당 프로젝트 PR 상세 보충 조회를 사용한다. 한 페이지 최대 30개, 동시 보충 조회 5개다. GitLab은 프로젝트 MR 목록의 reviewer_username/assignee_username[]/author_username·updated_before·search/in=title을 사용한다. 단어/문구 검색의 정확한 일치 규칙은 제공자 검색을 따른다.
- GitHub 검색의 일부 결과와 최대 1,000개 제한을 명시한다. 접근 오류/한도/계정 변경은 기존 오류 UI로 표시하고 자동으로 반복 요청하지 않는다. CI 실패 필터는 아래의 별도 현재 Head 조회를 사용한다.
- MarkdownContent가 리뷰 설명/대화의 서식·원문을 공유한다. react-markdown와 remark-gfm을 사용하며 raw HTML 플러그인을 사용하지 않는다. 외부 리소스 자동 요청 없이 이미지 대체 텍스트를 표시하고 같은 호스팅 origin의 HTTPS 링크만 기존 hostingExternal 검증으로 실행한다.

근거: [GitHub 검색](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/filtering-and-searching-issues-and-pull-requests), [GitLab MR API](https://docs.gitlab.com/api/merge_requests/), [react-markdown](https://github.com/remarkjs/react-markdown).

## CI 실패 필터

- 기본 목록에는 CI API 요청을 추가하지 않는다. 선택 시 현재 원본 페이지(최대 30개)를 3개씩 확인하고 원본 페이지의 다음/이전 이동을 유지한다. 실패 건수는 프로젝트 전체 합계가 아니다.
- GitHub는 버전 검증을 포함한 기존 review-checks/filter=latest 및 review-statuses를 재사용한다. 실패/error/시간 초과/startup_failure만 포함한다. 리소스당 최대 300개를 확인하고 더 남으면 미확인으로 분류한다.
- GitLab(Self-Managed PAT 포함)은 MR 상세의 head_pipeline이 현재 Head SHA와 일치하는 경우에만 failed를 포함한다. 과거·테스트 병합 파이프라인으로 추정하지 않는다.
- 오류, 버전 변경, 검사 미제공, 조회 상한은 미확인 건수로 별도 표시한다. 빈 실패 목록을 성공 또는 병합 가능으로 표시하지 않는다. 전체 CI/상세/새로고침으로 복구한다.

근거: [GitHub Checks](https://docs.github.com/en/rest/checks/runs#list-check-runs-for-a-git-reference), [GitHub Commit Status](https://docs.github.com/en/rest/commits/statuses#get-the-combined-status-for-a-specific-reference), [GitLab MR head_pipeline](https://docs.gitlab.com/api/merge_requests/#get-single-mr).

## 비활성 로컬 브랜치 Pull · 2026-09-17

BranchMenu의 기존 Fetch / Pull 하위 메뉴를 재사용한다. 체크아웃하지 않은 로컬 브랜치에도 Pull을 제공하고, 확인창은 원격 → 선택한 로컬 브랜치와 ‘체크아웃 없이 갱신’을 명시한다. 이 경로의 완료 안내는 자동 Stash 복원 문구를 사용하지 않는다. 원격 브랜치 메뉴는 ‘현재 브랜치로 Pull’ 의미를 유지한다. 근거: GIT_WORKFLOWS.md의 체크아웃 없는 로컬 브랜치 Pull.


## 반복 설명·확인 단계 간소화 · 2026-09-17

사용자의 현재 요청에 따라 기능명이 충분히 설명하는 작업은 중복 설명과 확인 단계를 생략한다. 아래 계약이 이전 확인 모달 관련 설명보다 우선한다.

- ContextMenu는 항목명을 한 줄로 표시한다. 대상은 title, 비활성 이유는 접근성 설명과 포커스·호버 Tooltip으로 제공한다. TextField의 보조 안내는 라벨 옆 공통 Tooltip 도움말에 두며, 필드 오류는 즉시 표시한다.
- Fetch/Pull/일반 Push/Upstream, 로컬 체크아웃/커밋/Git 계속, 파일 Stash/무시 규칙, 충돌 파일 저장/해결 표시는 버튼에서 바로 실행한다. 상태 token·Git 직렬화·자동 Stash 복구·중복 실행 차단은 유지한다. 진행과 오류는 같은 화면에 표시하며 네트워크 작업 취소를 제공한다.
- Stash 복원·Pop도 바로 실행한다. 스테이징 복원 옵션은 보관함에 배치하고 기본값은 기존처럼 꺼짐이다. 메시지가 필요한 Stash 생성, 새 브랜치·원격 등록·복제 등 입력 폼은 유지한다.
- PR/MR 생성·댓글·승인·변경 요청은 입력 폼에서 한 번 제출한다. 추가 입력 없는 GitLab 승인은 버튼에서 바로 실행하고 실패는 해당 화면에 표시한다. main 프로세스의 권한·버전 확인 및 일회성 실행 계획은 그대로 사용한다. 원격 병합은 병합 방식과 최신 대상 검토를 유지하고, CI 실행/취소는 최신 계획을 즉시 조회해 확인 한 단계만 제공한다.
- 삭제·변경 폐기·이력 재작성·미저장 초안 덮어쓰기와 AI 대화 초기화는 확인을 유지한다. AI 제안은 요청 이후 편집하지 않았으면 초안으로 바로 가져오며, 편집했으면 덮어쓰기를 확인한다.
- 반복된 화면 사용법은 제거한다. 실제 상태·오류·계정 권한·데이터 전송 범위·조회 한계는 남긴다. 긴 AI/MCP 안내는 공통 Disclosure로 접되 AI 전송 대상/사용량 발생 가능성은 전송 전에 표시한다.

## Stash 컨텍스트 메뉴 · 2026-09-18

사이드바와 보관함은 공통 ContextMenu를 조합한 StashMenu를 사용한다. 우클릭·Shift+F10과 사이드바 ⋯ 버튼에서 Apply/Pop/Delete를 제공한다. RemoteWorkspace의 기존 실행·직렬화·오류 복구 경로와 ref+SHA 검증을 재사용한다. Apply는 보관본 유지, Pop은 성공 시 제거, Delete는 대상 ref/SHA와 복구 불가 안내 후 확인한다. 변경/진행 작업이 있으면 Apply/Pop을 비활성화하며 이유는 title/aria-description으로 제공한다. 선택한 Stash 제거 성공 시 상세 선택을 해제한다. 검증: StashMenu Story와 check-stash-graph.mjs의 임시 Git 저장소.

## Worktree 컨텍스트 메뉴 · 2026-09-18

- Sidebar BranchTree와 Worktree 관리 목록은 공통 ContextMenu를 조합한 WorktreeMenu를 사용한다. 우클릭·Shift+F10·사이드바 ⋯로 현재 탭 열기 / 새 탭 열기 / 제거 / 브랜치와 함께 제거 / 잠금·해제를 제공한다.
- 현재 탭 열기는 요청을 시작한 탭을 교체하고, 새 탭 열기는 기존 탭을 유지한다. 대상이 이미 열려 있으면 기존 탭을 활성화한다. 경로별 커밋 초안은 보존하며 미저장 파일·충돌 편집이 있으면 교체를 거부하고 새 탭 열기를 안내한다. Checkout을 실행하지 않는다.
- 열린 탭의 Worktree는 먼저 탭을 닫아야 제거할 수 있다. 기본 Worktree·잠금·변경/진행 작업·무시된 파일은 제거를 차단한다. 확인창은 경로·HEAD와 브랜치 보존/삭제 차이를 명시한다. Git 실행 소유자는 electron/git.cjs이며 실패 후 실제 상태를 갱신한다.
- 브랜치와 함께 제거는 현재 HEAD에 병합된 로컬 브랜치만 대상으로 한다. 두 Git 명령 사이 실패 시 Worktree 제거 여부와 브랜치 유지 상태를 구분해 알린다. 원격 브랜치는 건드리지 않는다. Git 잠금은 파일 편집 금지가 아니라 제거·이동·정리 보호다.
- 검증: WorktreeMenu Story, electron/git.test.cjs, scripts/check-worktree-menu.mjs.

## 변경을 유지하는 체크아웃·Pull · 2026-09-18

기존 BranchMenu/Notice/RepositoryToolbar를 재사용해 ‘변경 유지 · 필요 시 자동 Stash’로 안내한다. 성공 문구는 Stash 실행 여부와 무관하게 작업 변경 유지 결과를 알린다. 일반 체크아웃·Pull에는 확인창을 추가하지 않는다. 겹치지 않는 변경은 직접 유지하고, 자동 보관은 Git이 덮어쓰기를 거부한 경우에만 사용한다. Fetch 실패·최신·분기는 변경을 옮기지 않는다. 적용 충돌은 보관 SHA와 기존 충돌 화면으로 연결한다. 검증은 임시 저장소의 실제 Git 및 기존 Electron 메뉴·툴바 E2E로 수행한다.

## 작업 결과 토스트 · 2026-09-18

근거: 사용자 요청에 따라 작업 결과 알림은 ToastMessage로 통일한다. Git/Fetch/Pull/Stash·파일 저장/복사·호스팅 계정·PR/MR 작업·프로필 저장 결과는 고정 토스트로 제공하며 조회 중 설명과 필드 검증은 해당 UI에 유지한다. 성공/안내 6초, 오류/경고 수동 닫기, 진행 중 작업 취소, 같은 출처·내용 중복 제거, F6·hover/focus 타이머 정지는 공통 소유자 계약이다. native Dialog에서도 접근 가능한 포털을 사용하며 토스트가 초안 포커스를 빼앗지 않는다. 메시지 저장/원격 전송은 추가하지 않는다.

## 메뉴와 선택 상태

- 저장소 탭과 PR/MR·CI 등 화면 이동은 현재 위치를 표시한다. Fetch·Push·브랜치 생성 같은 즉시 실행 버튼은 선택 상태를 갖지 않으며 읽어 주는 이름에 화면의 Git 명령도 포함한다.
- 변경 파일 목록/트리, diff, 리뷰 대상 필터, Markdown 보기에서 한 가지만 고르는 항목은 공통 ModeSelector로 표시한다. 선택된 항목을 다시 눌러도 해제되지 않는다. 방향키로 이동하고 Enter/Space로 적용한다.
- 브랜치 비교의 Merge·Rebase는 브랜치 선택 바로 아래에서 검토 창을 연다. 개별 커밋 작업은 해당 커밋 메뉴에 둔다. 파일 차이 기준과 커밋 범위는 선택지를 펼쳐 둔다.
- PR/MR 목록은 리뷰 상태·마지막 업데이트·CI 실패 여부를 바로 선택한다. 충돌 해결은 검색 가능한 파일 목록에서 선택하며, 다른 파일로 이동해도 미저장 초안을 표시한다.
- PR/MR과 CI 실행 목록의 행은 앱 내 상세를 연다. 제공자 링크가 있으면 행 오른쪽의 복사·외부 열기 버튼이나 행의 우클릭·Shift+F10으로 같은 작업을 실행한다. 링크 작업은 목록 선택을 변경하지 않는다.
- 저장소·파일·Stash·Worktree 메뉴는 작업 대상과 결과를 구분한다. 비활성 이유는 해당 항목에서만 확인한다. Apply는 복원 후 보관하고 Pop은 복원 성공 시 삭제한다.
- Agent 사용 여부처럼 즉시 저장되는 설정은 스위치, Amend·Stash 옵션과 MCP 허용 저장소처럼 제출 시 적용되는 값은 체크박스를 사용한다.
