# Branchline — 기능 분석과 Electron 구현 명세

조사 기준: 2026-09-11. 비교 제품은 **GitKraken Desktop 12.4.1** 및 Desktop에서 연결하는 서비스 기능입니다. GitLens, Git Integration for Jira의 독립 제품 기능 전체까지 포함한 분석은 아닙니다. [현재 릴리스 노트](https://help.gitkraken.com/gitkraken-desktop/current/)

## 현재 산출물과 구현 경계

`branchline.html`은 독립 실행 가능한 한국어 프로토타입입니다. `electron-main.cjs`는 동일 화면을 로컬 Electron 창에 올리는 진입점입니다. 실제 저장소 접근, Git 명령 실행, 인증, 원격 API, 충돌 처리, 배포 패키징은 아직 구현하지 않았습니다. GitKraken과의 전 기능 동등성을 완료했다고 주장하지 않습니다.

예제 데이터에서 동작하는 기능:

- 브랜치 선택 즉시 해당 ref에서 도달 가능한 커밋만 표시
- 기준 브랜치에 없는 이력만 조회하는 추가 모드
- 서로 다른 두 브랜치의 전체·양쪽 차집합·한쪽 차집합·공통 이력 표시
- 커밋 메시지·해시·작성자·파일 검색과 작성자·시작일 복합 필터
- 필터 불일치 행 제거, 숨겨진 조상을 거치는 연결의 점선 표시
- 부모 관계 기반 SVG 커밋 그래프, 병합 노드, 상세와 예제 diff
- 여러 일반 커밋 선택 → 적용 순서 확인 → 대상에 새 커밋 생성
- 원본 이력 보존, 이미 적용된 예제 커밋의 재선택 방지, 병합 커밋 선택 제한
- 예제 PR/MR 목록·서비스 필터·초안 작성·브랜치 비교 연결
- 예제 변경 스테이징·커밋, 스태시 저장·복원, 브랜치 생성
- 워크트리 목록과 이력 연결, 빠른 실행, 화면 배율

제한: 예제 diff는 커밋별 설명용 변경 한 쌍이며 실제 패치 적용 결과가 아닙니다. 그래프 레인은 예제 데이터에 지정되어 있습니다. 대규모 DAG의 자동 레인 할당, 빈 커밋·동일 패치 판별, 충돌·재개·중단은 미구현입니다. 새로고침하면 메모리의 예제 변경은 사라집니다.

## 요구사항에 영향을 주는 조사 결과

1. **GitKraken에도 Solo가 있습니다.** 선택한 ref 외의 브랜치를 숨길 수 있습니다. “브랜치 단독 조회가 전혀 없다”는 전제는 수정해야 합니다. 차별점은 단일 클릭 필터, 조회와 체크아웃 분리, 차집합 모드의 직접 노출입니다. [Hide / Solo](https://help.gitkraken.com/gitkraken-desktop/hiding-and-soloing/)
2. **검색과 그래프 표시 범위는 구분해야 합니다.** GitKraken은 메시지·SHA·작성자 검색 결과를 그래프에서 강조합니다. 초기 그래프 로딩 범위가 검색 완전성에 영향을 줄 수 있습니다. Branchline의 실제 구현은 현재 로드된 화면만 검색해서는 안 됩니다. [커밋 검색](https://help.gitkraken.com/gitkraken-desktop/search/)
3. **JetBrains 방식은 결과 집합을 좁히는 필터입니다.** 브랜치·작성자·날짜·폴더 필터와 파일 이력 탐색을 제공합니다. Branchline에서도 조회 조건과 표시 행을 일치시킵니다. [JetBrains 변경 이력 조사](https://www.jetbrains.com/help/idea/investigate-changes.html)
4. **PR 리뷰는 문서 간 차이가 있습니다.** 12.3.0 릴리스 설명은 기존 앱 내 리뷰를 gitkraken.dev 링크로 대체했다고 적습니다. PR 안내 문서는 여전히 앱 내 제안·댓글 등도 설명합니다. 최신 릴리스 우선으로 판단하되, 계정·플랜·서비스별 실앱 검증이 필요합니다. 12.4.1에는 GitHub PR의 base/head diff 바로 보기가 추가됐습니다. [릴리스](https://help.gitkraken.com/gitkraken-desktop/current/) · [PR 안내](https://help.gitkraken.com/gitkraken-desktop/pull-requests/)
5. **최근 범위에는 AI 에이전트도 포함됩니다.** 워크트리 그룹, 세션 상태, 권한 요청 응답, 이슈에서 에이전트 시작 등을 기능 동등성 검증에 포함해야 합니다. [에이전트](https://help.gitkraken.com/gitkraken-desktop/agents/)

## 전체 기능 범위 기준표

아래 표는 공식 Desktop 문서 목차와 조사한 핵심 상세 문서에서 도출한 구현 백로그입니다. “포함”은 최종 제품 요구사항에 포함한다는 뜻이며 현재 구현 완료 표시가 아닙니다. 세부 메뉴, 운영체제·플랜·권한 조합의 실앱 검증까지 마친 완전성 인증은 아닙니다. 모든 행이 최종 범위에 남아야 합니다. [공식 전체 문서 목차](https://help.gitkraken.com/gitkraken-desktop/gitkraken-desktop-home/)

상태: **예제** = HTML에서 부분 시뮬레이션, **미구현** = 실제 기능·화면 구현 필요. 실제 Git/서비스 연동은 모든 행에서 미구현입니다.

| ID | 기능군 | 포함할 세부 기능 | 현재 | 완료 판정 기준 |
|---|---|---|---|---|
| G01 | 저장소 수명주기 | 열기, 초기화, HTTPS/SSH clone, shallow clone, 최근·즐겨찾기 저장소 | 미구현 | 일반·빈·shallow 저장소를 열고 실패·취소를 복구 |
| G02 | 저장소 탐색 | 여러 탭, 탭 복원, 디렉터리 탐색, 워크스페이스 저장소 묶음 | 미구현 | 여러 저장소 상태가 섞이지 않음 |
| G03 | ref 탐색 | 로컬·원격 브랜치, 태그, 스태시, 접기, 검색, 일괄 표시·숨기기 | 예제 | 숨김이 저장소 자체를 바꾸지 않음 |
| G04 | 그래프 | 부모 연결, 병합 노드, WIP, ref 라벨, 선택 상세, 크기·열 조절, 브랜치 고정 | 예제 | 실제 DAG와 연결·방향 일치, 로딩 경계 명시 |
| G05 | 이력 검색 | 메시지·SHA·작성자 검색, 전체 이력 조회, 해시·ref 이동 | 예제 | 화면 밖의 일치 결과도 반환 |
| G06 | Solo / Hide | 개별·다중 ref Solo, 숨기기, 전체 복구 | 예제 | 선택 ref의 조상 집합과 표시 범위 일치 |
| G07 | 브랜치 관리 | 생성, 체크아웃, 이름 변경, 삭제, 원격 추적, detached HEAD 처리 | 예제 | 사용 중인 브랜치 삭제 방지, ref 변경 검증 |
| G08 | 네트워크 Git | fetch, pull, push, 자동 fetch, upstream 설정, 원격 추가·수정·삭제, prune | 미구현 | 인증·분기·네트워크 오류를 구분 |
| G09 | 파일 작업 | 생성·수정·삭제, 파일 필터, 편집기, 미리보기, 변경 취소 | 미구현 | 바이너리·인코딩·줄바꿈·큰 파일 처리 |
| G10 | 스테이징 | 파일·부분·행 단위 stage/unstage, 전체 선택 | 예제 | index와 working tree의 실제 차이 일치 |
| G11 | 무시 규칙 | ignore, 추적 중단, .gitignore 작성 | 미구현 | 추적 파일과 미추적 파일을 구별 |
| G12 | 커밋 | 제목·본문, amend, 서명, 훅 결과, 커밋 전 검증 | 예제 | 빈 메시지·빈 index 처리, 훅 실패 시 데이터 보존 |
| G13 | diff | 커밋·파일·두 revision 비교, unified/split, 공백, rename, 이미지·바이너리 | 예제 | 실제 Git diff와 일치 |
| G14 | 파일 이력·blame | 파일 이력, 줄 작성자, rename 이전 이력, 과거 내용 보기 | 미구현 | 이동·이름 변경 사례를 추적 |
| G15 | 병합 | fast-forward, merge commit, squash merge, 사전 충돌 감지 | 미구현 | 전략마다 부모와 작업 트리 결과 검증 |
| G16 | 충돌 해결 | base/ours/theirs, 파일·hunk 해결, 외부 merge 도구, 계속·중단 | 미구현 | 부분 성공 후 중단·재개 시 데이터 보존 |
| G17 | rebase | 일반 rebase, 인터랙티브 rebase, 순서·squash·drop·reword | 미구현 | 커밋 변경과 중단·재개의 결과 검증 |
| G18 | cherry-pick | 한 개·여러 개, 순서 변경, squash·drop·메시지 수정, 병합 부모 지정 | 예제 | 실제 적용·충돌·빈 결과·중복 패치를 처리 |
| G19 | 이력 복원 | reset soft/mixed/hard, revert, undo/redo, reflog 기반 복원 가능 범위 | 미구현 | 공개된 이력과 로컬 이력의 위험을 구분 |
| G20 | 스태시 | 저장, 메시지, 목록, apply/pop, 삭제, 미추적 파일 선택 | 예제 | 복원 충돌 시 원본 스태시 보존 |
| G21 | 태그 | lightweight/annotated 생성, 삭제, checkout, 원격 push | 예제 | 태그 종류·대상·원격 범위 검증 |
| G22 | 워크트리 | 추가, 전환, 잠금, 제거, 작업 디렉터리·브랜치 관계 | 예제 | 다른 워크트리에서 사용 중인 브랜치 보호 |
| G23 | submodule | 추가·초기화·업데이트·열기, 상태·커밋 포인터 | 미구현 | 중첩·인증·detached HEAD 처리 |
| G24 | Git LFS | 저장소 설정, 추적 패턴, LFS 상태·객체 처리 | 미구현 | pointer를 파일 내용으로 오인하지 않음 |
| G25 | Gitflow | 초기화, feature/release/hotfix 시작·완료, 브랜치 규칙 | 미구현 | 규칙에 따른 merge/tag 결과 일치 |
| G26 | 훅·서명 | Git hooks 실행 결과, GPG/SSH 서명, 검증 상태 | 미구현 | 암호 입력·실패·검증 불가를 구분 |
| G27 | 터미널·외부 도구 | 내장 터미널, 다중 세션, worktree별 세션, 편집기·diff·merge 도구 | 미구현 | 경로·인수 안전 처리, 세션 종료 관리 |
| G28 | 프로필·인증 | 여러 Git identity, 프로필별 설정, SSH 키, OAuth, 자격 증명 | 미구현 | 저장소별 identity와 계정이 섞이지 않음 |
| G29 | Git 호스팅 | GitHub/Enterprise, GitLab/Self-Managed, Bitbucket/Data Center, Azure DevOps, 일반 Git remote | 미구현 | 서비스·배포형·권한별 capability 표 검증 |
| G30 | PR/MR 생성 | source/base 선택, 제목·본문·템플릿, 초안, reviewer·assignee·label | 예제 | push 상태·권한·서버 검증 오류 처리 |
| G31 | PR/MR 탐색 | 목록, 개인·전체·사용자 필터, 커밋·변경 파일, 상태·CI | 예제 | 페이지네이션·fork·삭제된 ref 처리 |
| G32 | 리뷰 | 댓글·인용·제안·수락·거절, 외부 리뷰 연결 | 미구현 | 서비스별 지원/미지원 명시, 승인 상태 동기화 |
| G33 | PR/MR 병합 | merge/squash/rebase, 보호 규칙·CI·리뷰 확인, 병합된 상태 | 미구현 | 서버 판정을 최종 권한으로 사용 |
| G34 | 이슈 | Jira/Datacenter, GitHub/Enterprise Issues, GitLab/Self-Managed Issues, Trello | 미구현 | 이슈 조회·브랜치 연계·권한 검증 |
| G35 | Launchpad | 여러 저장소의 PR·이슈 통합, 필터·정렬·그룹·개인 업무 | 미구현 | 빈 상태와 인증 오류를 혼동하지 않음 |
| G36 | 협업 | 팀·Team View, 작업 브랜치·팀원 상태, 공유 워크스페이스 | 미구현 | 접근 권한·갱신·탈퇴 처리 |
| G37 | GitHub Actions | 워크플로·상태·로그 등 서비스별 노출 범위 | 미구현 | 제공 API와 제품 실제 메뉴를 추가 확인 |
| G38 | Cloud Patches | WIP/커밋 패치 생성·공유·적용·삭제, 공유 대상·접근 권한 | 미구현 | 수신자 권한과 링크 회수 검증 |
| G39 | AI 지원 | 커밋·스태시 메시지, 커밋·브랜치 설명, PR 제목·설명, 충돌 해결, Commit Composer | 미구현 | provider·모델·프롬프트·전송 내용 제어 |
| G40 | 에이전트 | worktree별 세션, 시작·상태·중단, 이슈 컨텍스트, permission 응답 | 미구현 | 실행 프로세스·작업 디렉터리·권한 범위 검증 |
| G41 | 최신 worktree UX | 탭 그룹, worktree별 WIP, 병합 PR 표시, 안전한 정리 | 미구현 | 열린 탭과 상태가 실제 worktree와 일치 |
| G42 | 사용성 설정 | 테마, 그래프 열·아바타·날짜·깊이, 단축키, 커맨드 팔레트 | 예제 | 키보드·배율·대비·설정 저장 검증 |
| G43 | 운영 지원 | 활동·오류 로그, 성능 옵션, 파일 감시 실패, 네트워크 재시도 | 미구현 | 실패 원인과 재시도 방법을 제공 |
| G44 | 플랫폼·배포 | Windows/macOS/Linux, WSL2, 업데이트, 서명된 설치 파일 | 진입점만 | 대상 OS별 설치·재시작·업데이트 검증 |
| G45 | 기업 환경 | 프록시·인증서, self-hosted/serverless, 오프라인, 조직 설정 | 미구현 | 클라우드 의존 기능을 분리하고 정책 준수 |

세부 확인 출처: [인터페이스](https://help.gitkraken.com/gitkraken-desktop/interface/), [커밋](https://help.gitkraken.com/gitkraken-desktop/commits/), [diff](https://help.gitkraken.com/gitkraken-desktop/diff/), [브랜치·병합](https://help.gitkraken.com/gitkraken-desktop/branching-and-merging/), [인터랙티브 rebase](https://help.gitkraken.com/gitkraken-desktop/interactive-rebase/), [cherry-pick](https://help.gitkraken.com/gitkraken-desktop/cherrypick/), [워크트리](https://help.gitkraken.com/gitkraken-desktop/worktrees/), [연동](https://help.gitkraken.com/gitkraken-desktop/integrations/), [Launchpad](https://help.gitkraken.com/gitkraken-desktop/gitkraken-launchpad/), [AI](https://help.gitkraken.com/gitkraken-desktop/gkd-gitkraken-ai/), [실험 기능](https://help.gitkraken.com/gitkraken-desktop/experimental-features/), [설정](https://help.gitkraken.com/gitkraken-desktop/preferences/), [온프레미스](https://help.gitkraken.com/gitkraken-desktop/self-hosted/).

## 두 브랜치 비교의 정확한 의미

커밋은 “생성된 브랜치 이름”을 소유하지 않습니다. 브랜치는 커밋을 가리키는 ref이고, 조회는 DAG 도달 가능성으로 정의해야 합니다. 브랜치 A와 B를 비교할 때:

| 화면 | 집합 | Git 조회 개념 |
|---|---|---|
| A의 전체 조상 | A에서 도달 가능한 커밋 | `git log A` |
| A에만 있는 이력 | Reach(A) − Reach(B) | `git log B..A` |
| B에만 있는 이력 | Reach(B) − Reach(A) | `git log A..B` |
| 양쪽 차이 | 대칭 차집합 | `git log --left-right A...B` |
| 전체 비교 이력 | Reach(A) ∪ Reach(B) | `git log A B` |
| 공통 커밋 | Reach(A) ∩ Reach(B) | 모든 merge-base의 조상 집합 |
| 첫 부모 이력 | 각 merge의 첫 부모만 따라감 | `git log --first-parent A` |
| 끝점 파일 차이 | 두 스냅샷의 차이 | `git diff A B` |
| 브랜치 도입 변경 | merge-base에서 head까지 | `git diff B...A` |

첫 부모 이력은 “A에서 만든 커밋만”과 동의어가 아닙니다. criss-cross merge에서는 merge-base가 여러 개일 수 있습니다. 관계없는 이력은 공통 조상이 없고, shallow clone은 미확인 조상을 별도로 표시해야 합니다. [Git revision 조회](https://git-scm.com/docs/git-rev-list)

**패치 동등성은 SHA 동등성과 다릅니다.** cherry-pick은 SHA를 바꾸므로 차집합에 계속 나타날 수 있습니다. 실제품은 `--cherry-mark` 또는 patch-id를 사용해 “SHA는 다르지만 이미 적용됨”을 별도로 표시합니다. 예제는 `origin` 연결로만 중복을 판별하며 Git 수준의 패치 동등성은 구현하지 않았습니다.

## 커밋 가져오기 실행 계약

1. source·target ref를 확정한 SHA로 해석하고 비교 스냅샷을 생성합니다.
2. 대상 작업 트리의 미커밋 변경, 진행 중인 rebase/merge/cherry-pick, 잠금, 다른 worktree 사용을 검사합니다.
3. source에만 존재하는 선택 커밋을 검증합니다. 일반 커밋은 부모 우선으로 적용하고, merge 커밋은 mainline 선택을 별도 요구합니다.
4. 대상 이름·작업 디렉터리·선택 커밋·순서·재서명 여부를 실행 전에 표시합니다.
5. 실제 변경 직전에 ref SHA를 다시 검증합니다. 비교 후 변경됐다면 재계산하며 조용히 덮어쓰지 않습니다.
6. Git executor에서 저장소 단위 쓰기를 직렬화하고 실제 `cherry-pick`을 실행합니다. 원본 커밋을 삭제하지 않습니다.
7. 충돌이면 중단 상태로 전환하고 파일별 해결·계속·건너뛰기·중단을 제공합니다. 부분 성공 내역을 기록합니다.
8. 빈 커밋, 이미 적용된 패치, 커밋 훅·서명 실패를 각각 설명합니다.
9. 완료 후 target ref와 graph를 갱신합니다. push는 별도 동작이며 로컬 완료를 원격 완료처럼 표현하지 않습니다.

다른 전달 방식: 전체 브랜치 반영은 merge, 정리된 단일 변경은 squash merge, 커밋 재배치는 rebase, 저장소 간 변경 전달은 patch. 이 방식들을 동일한 버튼 이름으로 숨기지 않고 이력 변화와 충돌 처리를 구분합니다. GitKraken은 다중 커밋 cherry-pick과 적용 전 편집도 제공합니다. [GitKraken cherry-pick](https://help.gitkraken.com/gitkraken-desktop/cherrypick/)

## PR·MR 비교 계약

PR/MR은 커밋 자체가 아니라 source/base ref와 상태·리뷰를 포함하는 서버 객체입니다. 공급자가 반환한 저장소·fork·head SHA·base SHA를 기준으로 비교 세션을 만듭니다.

- 단일 PR/MR 선택: base와 head 비교를 열고 도입된 커밋·변경 파일을 표시합니다.
- 두 PR/MR 간 비교: 각각의 base/head 쌍에서 도입 커밋 집합을 구한 뒤 SHA 또는 패치 동등성으로 비교합니다. 단순 head1...head2는 기준 브랜치 차이가 섞이므로 별도 모드로 표시합니다.
- 일부 커밋 가져오기: 쓰기 가능한 대상 브랜치에 로컬 적용 후 push하고 필요한 경우 새 PR/MR을 생성합니다. 원본 PR/MR의 커밋을 이동·삭제한 것처럼 표현하지 않습니다.
- MR/PR 생성 전 source push 상태, 리뷰 권한, 보호 브랜치, 허용 merge 전략을 확인합니다.
- 토큰 만료·403·rate limit·fork remote 부재·force-push·삭제된 브랜치를 독립 상태로 처리합니다.

현재 HTML은 단일 PR/MR의 source/base 비교 연결만 제공합니다. 두 요청을 직접 골라 비교하는 화면, 실제 API, 리뷰·병합은 미구현입니다. [공급자별 PR 지원](https://help.gitkraken.com/gitkraken-desktop/pull-requests/)

## Electron 구조

```text
Renderer: 화면·필터·선택·그래프
    ↓ 유형이 정해진 좁은 호출
Preload: contextBridge 기반 공개 API
    ↓ 검증된 IPC
Main: 경로 선택·권한·자격 증명·작업 조율
    ├─ Git 실행 작업: spawn / execFile 인수 배열, shell 사용 안 함
    └─ 서비스 요청: 공급자별 OAuth·REST/GraphQL
```

실제 구현에서는 Git CLI를 우선 사용합니다. `git log --format`의 구분자는 NUL 등으로 명확하게 정의하고, 파일명은 `-z` 출력으로 처리합니다. 임의의 명령 문자열을 renderer에서 받아 실행하지 않습니다. ref는 검증한 object ID로 해석하고, 파일 경로는 `--` 뒤의 인수로 전달합니다.

보안 기본값: renderer의 Node 접근 금지, context isolation, sandbox, IPC sender·인수 검증, 허용되지 않은 navigation·새 창 차단, OS 자격 증명 저장소, 저장소 내용의 HTML 실행 방지. [Electron 보안 지침](https://www.electronjs.org/docs/latest/tutorial/security)

현재 Electron 진입점은 로컬 HTML만 실행하며 preload·IPC·Git 권한을 열지 않습니다. HTML 독립 실행 때문에 인라인 스크립트를 허용하지만 연결은 CSP `connect-src 'none'`으로 막습니다. 실제 Git 연동 단계에서는 이벤트 바인딩과 스크립트를 로컬 파일로 분리해 CSP를 강화해야 합니다. Electron 버전은 조사 시점 공식 안정 버전을 지정했습니다. [Electron 릴리스](https://releases.electronjs.org/)

## 그래프와 필터 구현 규칙

- 정렬은 topological order를 우선하고 동률만 시간으로 정합니다. 날짜만 정렬하면 부모가 자식 위에 잘못 올 수 있습니다.
- 커밋 ID를 기준으로 안정적인 레인을 유지하고, first-parent와 추가 부모의 선을 구분합니다.
- 필터는 행의 투명도를 낮추는 방식이 아니라 결과 행 집합을 변경합니다.
- 숨겨진 조상을 건너 연결하는 선은 점선이며 직접 부모처럼 표현하지 않습니다. 필터 제거 시 원래 DAG로 돌아갑니다.
- 노드는 채워진 원으로 표시하고 ref·선 형태·텍스트를 함께 사용합니다. 색상만으로 상태를 전달하지 않습니다.
- 데이터 로딩 경계와 필터 생략 경계를 다르게 표시합니다. 아직 불러오지 않은 조상을 삭제된 커밋처럼 보이지 않게 합니다.
- 대규모 데이터는 Git 조회 취소, 가상 목록, 화면 범위의 SVG/Canvas 렌더링을 적용합니다. 예제의 고정 레인 알고리즘을 그대로 확장하지 않습니다.
- 테스트 저장소에는 다중 부모·octopus merge, criss-cross, 장수 브랜치, 태그 다수, detached HEAD, worktree, shallow clone을 포함합니다.

## 구현 순서와 출시 기준

| 단계 | 범위 | 통과 조건 |
|---|---|---|
| 1 | 현재 프로토타입 검토 | 핵심 정보 구조·브랜치 비교 UX 확정 |
| 2 | 실제 읽기 전용 Git | 저장소 선택, refs·log·diff·status, DAG 자동 레인, 전체 이력 검색 |
| 3 | 로컬 쓰기 | stage·commit·branch·stash, cherry-pick·merge·rebase, 충돌·복구 |
| 4 | 원격 협업 | 인증, fetch/pull/push, 서비스별 PR/MR 생성·리뷰·비교·병합 |
| 5 | 전체 동등성 | G01–G45 잔여 기능, OS·플랜·권한 조합, 대규모 저장소·기업 배포 |

최종 출시의 “모든 기능 포함” 판정은 각 항목에 소스 버전, 대상 OS, 플랜, 서비스, 테스트 저장소, 성공/실패/복구 검증 결과를 연결한 뒤 내려야 합니다. 현재 문서는 그 추적을 위한 1차 범위표입니다. 계정이 필요한 기능의 실앱 조사는 추가로 필요합니다.
