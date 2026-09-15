# Branchline 구현 상태

2026-09-15 · 로컬 알파 0.1.0 · 후속 구현: 공식 CLI 충돌 대화·검토 후 원격 쓰기. PRODUCT.md의 전체 P0 완료나 공개 릴리스가 아니다. 아래 표가 현재 루트 앱의 구현 상태이며, handoff의 예제·기능 계획과 구분한다. 개발자와 PM의 제품 우선순위는 동등하게 유지한다.

## 현재 실행되는 기능

| 영역 | 연결된 동작 | 남은 범위 |
| --- | --- | --- |
| Electron | 로컬 파일로 React 실행, 제한된 preload IPC, renderer sandbox·contextIsolation·CSP | 서명·공증·자동 업데이트·Windows 실제 설치 검증 |
| 프로젝트 | 네이티브 폴더 선택, 빈 폴더 Git 초기화, 저장소 복제, 최근 저장소, 최대 30개 탭, 탭 이동·닫기, 재시작 복원 | 드래그 정렬·고정·복잡한 세션 복구 |
| 개인 Git | 실제 상태·작성자 확인, 파일별 working/index diff, stage·unstage·전체 스테이징/해제·텍스트 수정 구간별 스테이징/해제·commit, 검색/트리/높이 조절, 파일 변경 취소·휴지통, 앱 설정의 개인/업무 작성자 프로필 저장·편집·삭제와 저장소별 적용 | 행 단위 선택·특수 변경 부분 적용·폐기 후 앱 내 복구 |
| 원격·Stash | 원격 목록·추가, Fetch, fast-forward Pull, 단일 브랜치 Push, upstream 설정·ahead/behind, 중앙 Git 툴바, stash 보관·diff·복원·Pop·삭제, 원격 취소 | 원격 수정·삭제·prune·tag·submodule 전용 관리, 자동 merge/rebase Pull, 세부 전송 진행률 |
| 브랜치 | LOCAL·ORIGIN·추가 원격별 사이드바, 검색·이력 조회, 생성·로컬 브랜치 명시적 전환, 조회와 checkout 분리 | 이름 변경·삭제·tag 전용 관리 |
| 커밋 이력 | 전체 ref 또는 지정 ref 조회, 메시지·작성자 리터럴 필터, 경로·기간 조건, 100개 단위 무한 스크롤, 연속 부모 그래프·HEAD/ref·미니맵 이동·컬럼 조절 | 통합 SHA 검색·복수 작성자·merge/revert 조건·저장 필터·대규모 가상 렌더링 |
| 비교 | A/B 도달 가능한 커밋 집합, A만/B만/차이/공통/전체, 개수, 끝점 또는 공통 조상 기준 파일 통계, 검토한 SHA를 현재 브랜치에 Merge/Rebase | 비교 파일별 전체 diff·split view·고급 그래프 |
| Worktree | 활성 저장소 사이드바 목록·키보드 탭 열기, 새 브랜치·기존 로컬 브랜치·detached+폴더 생성, 탭 열기, 잠금·해제, 깨끗한 linked worktree 삭제 | 이동·prune·작업 중 삭제 조율 확장 |
| 충돌 해결 | Git Stage 1/2/3·작업 파일 비교, 직접 편집·전체 결과 검토, 버전 재검사 후 저장, 직전 저장 복원, 별도 해결 표시, merge/rebase/cherry-pick 계속·검토 후 중단, 세 Agent의 대화·수정안 검토·초안 가져오기 | 스트리밍·진행 중 추가 지시, 파일 삭제 선택·바이너리·특수 파일, 강제 복구 |
| Agent 설정 | Claude Code·Codex·Gemini CLI 설치·버전 탐지, 실행 파일 선택, 개별 토글, 기본 Agent 저장, 선택한 공식 CLI 실행·중단 | 앱 내 인증 시작·계정 선택/변경 감지·실제 계정 추론 검증 |
| Agent 한도 | Codex ChatGPT 계정의 공식 읽기 API, 제공된 기간별 사용/잔여 %·리셋·확인 시각 | 실제 계정별 인증 검증, Claude/Gemini 공식 quota 경로, 비용·컨텍스트 별도 표시 |
| PM·개발자 협업 | 활성 저장소의 PR/MR 목록/상세, 서버 제목/내 역할/업데이트 경과 필터, 서식/원문 본문·대화, 버전별 변경 파일·댓글/논의·리뷰 기록/승인 규칙, SHA별 Checks/Status·MR Pipelines, 프로젝트 CI 실행/Jobs, 최대 5개 프로젝트 첫 페이지 모아보기·담당/검토 요청 요약, 현재 Head 검사·승인 요약(조회 범위 명시), PR/MR 생성·댓글·승인·병합, GitHub 변경 요청, CI 재실행·취소 | 필수 검사·승인 최종 집계, 신규 workflow_dispatch/Pipeline 실행·인라인 댓글·GitLab 변경 요청, 원격 프로젝트별 탭·선택 복원 |
| 호스팅 인증 | GitHub.com/GitLab.com Device Flow, 공개 Client ID 설정, 원격 쓰기 별도 선택, 승인 대기·취소·만료·slow_down, 다중 계정, 갱신 직렬화, OS 암호화 보관 또는 세션 한정 연결·해제 | 실제 등록 앱/계정 승인·OS Keychain 저장 검증, Enterprise/Self-Managed, 제공자 권한 철회 자동화 |
| 외부 도구 | stdio MCP 읽기 도구 5개, 열린 저장소를 선택해 클라이언트 설정 JSON 생성·복사, 패키지 내 서버 | MCP 쓰기·IDE 플러그인·실제 외부 클라이언트별 연결 검증 |

초안과 검색·비교 조건은 저장소 경로에 귀속한다. 탭 전환·재시작·닫았다 열기 시 커밋 초안을 복원한다. 마지막 50개 저장소의 보기 상태를 보관한다. 로컬 Git 상세 선택은 탭 전환 중 유지되며 앱 재시작 또는 다른 상위 화면 이동 시 초기화된다. 원격 협업 선택은 아래 별도 세션 계약을 따른다. 탭 닫기는 Git checkout이나 worktree 삭제를 실행하지 않는다.

## 실행과 검증

```sh
pnpm install --frozen-lockfile
pnpm desktop               # TypeScript/Vite 빌드 후 Electron 실행
pnpm check                 # lint/build + Storybook + native + Git/Agent + Electron + Storybook build
pnpm test:git              # 실제 임시 Git 저장소 + 통제된 Agent/OAuth/API 응답
pnpm test:desktop          # 실제 Electron IPC와 UI 흐름, 임시 저장소/프로필
pnpm package:desktop       # 현재 OS/CPU용 실행 번들
pnpm package:mac           # macOS DMG (현재 CPU, --arch x64/arm64 지원)
pnpm package:win           # Windows x64 NSIS 설치 EXE
```

브라우저 `pnpm dev`는 Electron 실행 안내를 표시한다. 기존 디자인 시스템 예제는 `?demo=1`, 전체 컴포넌트 문서는 `pnpm storybook`으로 확인한다. Git 실행 파일이 필요하며 이번 환경의 macOS arm64에서 검증했다. Windows/Linux 지원 완료를 의미하지 않는다.

`release/mac-arm64/Branchline.app`과 `release/Branchline-0.1.0-mac-arm64.dmg`이 macOS ARM64 산출물이다. Windows x64 설치 파일은 `release/Branchline-0.1.0-win-x64-setup.exe`이다. 기존 Branchline 마크를 설치 아이콘으로 사용한다. 배포용 인증서·공증·업데이트 설정은 아직 없으며 공개 release는 게시하지 않는다. 현재 번들 ID는 `dev.branchline.desktop`이며 정식 서명·업데이트 도입 전에 확정해야 한다.

초기 Forge/@electron/packager 구성을 `electron-builder@26.15.3`으로 통합했다. 사용하지 않는 Squirrel용 electron-winstaller 설치 스크립트는 pnpm allowBuilds에서 명시적으로 비활성화하고 NSIS를 사용한다. Vite가 renderer 의존성을 포함하므로 임시 패키징 폴더에는 `dist/`, 운영 `electron/*.cjs`, 최소 package.json만 복사한다. 개발 소스·문서·테스트·개인 설정·node_modules를 넣지 않는다.

## 데이터와 실행 경계

- Git은 shell 문자열 대신 인자 배열로 실행한다. ref는 커밋 SHA로 검증하고 경로는 literal pathspec을 쓴다. 외부 diff/textconv는 실행하지 않는다. 사용자가 커밋할 때 Git hooks·서명·Git 설정은 적용된다.
- 앱이 연 저장소만 IPC 작업 대상으로 허용한다. 같은 Git common directory의 쓰기는 직렬화한다. 실행 직전 HEAD·refs·status·index/working diff·미추적 파일 stat에서 만든 검토 토큰을 재확인한다. 외부 Git 프로세스와의 완전한 트랜잭션 잠금은 아니며 외부 작업 도중 동시 실행은 피해야 한다.
- Git 변경 중 탭 닫기와 앱 종료를 막고 중복 제출을 제한한다. 실패하면 초안과 폼을 남긴다. 강제 삭제·reset·force push는 제공하지 않는다.
- 로컬 설정은 Electron userData의 `workspace.json`에 원자적으로 저장한다. 경로·초안·Agent 선택은 저장하지만 토큰/비밀번호는 저장하지 않는다. 디스크 저장 완료를 기다린 뒤 정상 종료한다. 강제 프로세스 종료 직전 입력은 복구를 보장하지 않는다.
- Agent 버전 탐지는 로그인 확인이 아니다. Codex 한도는 사용자가 활성화하고 새로고침을 눌렀을 때만 app-server의 account/read, account/rateLimits/read를 호출한다. 테스트는 실제 로그인·유료 추론·계정 한도 호출을 하지 않는다.
- Claude/Gemini 자동 quota는 미지원으로 표시한다. null은 0% 사용이나 무제한이 아니다. 마지막 수치는 확인 시각을 표시하며 계정 변경·조회 실패 때 지운다.
- 활성 로컬 상태는 5초·앱 복귀 시 자동 갱신하며 원격 목록은 수동 새로고침 기준이다. Git 출력은 명령당 최대 32MiB, 로컬 Git은 30초·원격 전송은 120초 제한이며, 미추적 텍스트 미리보기는 1MiB다. 초과를 빈 결과로 표시하지 않고 오류/외부 확인 안내를 표시한다. 대형 monorepo 스트리밍·파일 감시는 후속 작업이다.

## 원격·Stash 사용 범위

- GitHub·GitLab을 포함한 일반 HTTPS·SSH remote와 로컬 절대 경로를 사용할 수 있다. 원격당 fetch/push URL이 각각 하나인 구성을 지원하며 URL에 포함된 자격 증명·query는 거부한다. 실제 GitHub/GitLab 계정 인증 시험은 수행하지 않았으며 테스트는 로컬 bare remote와 통제된 SSH 대체 실행 파일만 사용한다.
- 기존 credential helper, `GIT_SSH_COMMAND`/`GIT_SSH`, `core.sshCommand`를 유지한다. 사용자 SSH 실행 설정이 없으면 BatchMode로 대화형 암호·호스트 승인 프롬프트를 막는다. 인증이 필요하면 터미널에서 설정 후 재시도한다. Git transport 인증과 OAuth·PR/MR 연동은 별개다.
- Fetch는 브랜치 추적 ref를 갱신하며 태그·submodule·prune은 자동 실행하지 않는다. Pull은 선택한 원격 브랜치를 명시적으로 Fetch하고 로컬 변경 여부를 재검사한 뒤 fast-forward만 수행한다. 삭제된 원격 브랜치를 남아 있는 로컬 추적 ref로 대신 병합하지 않는다. [Git Fetch](https://git-scm.com/docs/git-fetch)
- Push는 검토한 HEAD SHA를 선택한 목적지의 브랜치 하나로 전송한다. mirror·follow-tags·submodule push를 끄고 강제 refspec을 사용하지 않는다. Push 후 추적 수치의 최신 상태는 Fetch로 다시 확인하며 upstream 변경은 별도 동작이다. [Git Push](https://git-scm.com/docs/git-push)
- 원격 작업은 취소할 수 있지만 이미 서버에 반영된 결과를 되돌리지는 않는다. macOS에서는 해당 Git 프로세스 그룹을 종료한다. Windows 전송 취소·설치본은 아직 검증하지 않았다. 전송 오류의 helper 출력은 비밀값 노출을 피하기 위해 원문을 UI에 보내지 않는다.
- 복제는 새 경로를 독점 생성하며 기존 폴더를 덮어쓰지 않는다. 실패·취소 경로를 앱이 재귀 삭제하지 않으며 사용자가 확인할 수 있도록 경로를 남긴다. 자동 submodule 복제·clone 재개는 미지원이다. [Git Clone](https://git-scm.com/docs/git-clone)
- Stash 보관은 미추적 파일 포함 여부를 선택한다. ignored·submodule 내부 파일은 포함하지 않는다. 복원은 깨끗한 worktree에서 실행하고 `--index`를 선택할 수 있다. 충돌·부분 적용 뒤에는 변경 화면에서 검토하며 원본 stash는 유지한다. 삭제는 SHA/selector 재검증과 명시적 확인을 거친다. [Git Stash](https://git-scm.com/docs/git-stash)

## 다음 구현 묶음

1. 개인 작업 확장: 행 단위 선택·특수 변경 부분 적용·폐기 후 앱 내 복구·원격 수정/삭제·tag/submodule·대형 저장소 처리. 원격 동기화와 stash 기본 흐름은 아래 제한과 함께 구현했다.
2. PM·개발자 협업 확장: 등록 앱으로 실제 OAuth 승인·OS 보안 저장 검증 → 필수 검사 정책·승인 최종 집계·대기 이유 → 리뷰·생성·병합·CI 쓰기 작업. 기본 OAuth와 프로젝트/PR/MR/CI 조회 코드는 구현했으며 실제 사용자 계정에 접속한 상태는 아니다.
3. 대화형 충돌 해결: 수동 3-way 비교·편집·저장·복원·해결 표시는 구현했다. 남은 작업은 provider별 로컬 인증과 실행 격리 검증 → worktree에 귀속된 대화·취소 → 생성 결과 검토·연결이다. 단순 토글이나 수동 편집을 Agent 실행 완료로 보지 않는다.
4. 비교·필터 확장, MCP 작업 승인·쓰기와 IDE 연결 확장, 설치본 서명/업데이트 검증. 각 항목의 수용 기준은 기존 제품 명세를 유지한다.

## 호스팅 협업 조회 사용 범위

- `프로젝트 현황 → 계정 연결`에서 등록한 GitHub OAuth App의 Client ID 또는 GitLab 공개 OAuth Application의 Application ID를 입력한다. GitHub Device Flow를 활성화하고 GitLab은 Confidential을 끄며 `read_user read_api` scope를 등록한다. 앱 등록·실제 사용자 승인은 아직 수행하지 않았다. [GitHub Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [GitLab Device Grant](https://docs.gitlab.com/api/oauth2/)
- GitHub 기본 요청은 `read:user`이며 비공개 저장소 선택 시 `repo`를 추가한다. `repo`에는 쓰기 권한이 포함됨을 승인 전에 표시한다. 현재 협업 IPC는 GET 조회만 제공하며 Git Push는 기존 별도 인증을 사용한다. 기존 앱 승인에 따라 더 넓은 scope가 반환될 수 있어 실제 반환 scope를 표시한다. [OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps)
- 기본은 세션 한정 연결이다. 영구 보관을 선택하면 main에서 Electron safeStorage로 암호화한 `hosting.enc`를 원자적으로 저장한다. `basic_text` 또는 보안 저장소 불가 시 영구 보관을 거부하며 평문으로 자동 대체하지 않는다. 기존 암호화 파일 복호화 실패 시 덮어쓰기를 막고 복구 안내를 표시한다. 이 경우 세션 계정을 해제해도 복구하지 못한 기존 암호화 파일은 보존한다. [Electron safeStorage](https://www.electronjs.org/docs/latest/api/safe-storage)
- 계정은 provider/host/user ID로 최대 20개를 구분한다. 조회 계정을 사용자가 선택하고 같은 계정으로 재승인하면 해당 연결을 갱신한다. 서버 반환 토큰의 만료가 다가오면 계정별로 refresh를 직렬화하고 사용자 ID를 다시 확인한다. refresh 미제공·거절·신원 확인 실패·401은 재연결 안내를 표시한다. 계정 상태 새로고침으로 현재 만료/재연결 상태를 확인한다.
- device_code·access/refresh token은 main에만 머물고 renderer에는 승인용 user_code·검증 URL·계정 메타데이터만 전달한다. API 요청은 HTTPS 공식 호스트의 지정 GET 경로로 제한하고 redirect는 거부한다. 제공자 오류 원문·토큰은 UI/로그로 전달하지 않는다. 외부 브라우저 열기는 선택한 제공자의 query/자격 증명이 없는 HTTPS 주소만 허용한다.
- 프로젝트 목록은 GitHub 접근 가능 저장소 또는 GitLab 멤버 프로젝트이며, 경로 입력으로 다른 접근 가능 프로젝트를 조회할 수 있다. 프로젝트/PR/MR/CI/Jobs를 30개씩 조회하며 현재 페이지 개수를 전체 개수로 표시하지 않는다. 페이지 헤더가 없고 30개가 꽉 찬 경우 다음 페이지를 제공하므로 마지막 빈 페이지가 나올 수 있다. API timeout은 30초·응답 한도는 4MiB다.
- PR/MR와 CI는 각각 갱신·오류를 가진다. 권한/SSO·404·인증 만료·요청 한도를 구분하며 자동 재시도하지 않는다. GitHub `closed`는 병합 포함, GitLab `closed`는 병합 제외이고 `all`에서 병합 건을 포함한다. 본문은 HTML 실행 없는 텍스트로 최대 20,000자를 표시한다. [GitHub PR API](https://docs.github.com/en/rest/pulls/pulls), [GitLab MR API](https://docs.gitlab.com/api/merge_requests/)
- CI 목록은 프로젝트 전체 실행이다. PR/MR의 필수 검사 결과나 최종 병합 가능 여부로 간주하지 않는다. 실행 상태/결론·SHA·ref·원인·GitHub 회차를 따로 표시하고 GitHub Jobs는 선택 회차, GitLab Jobs는 재시도 포함으로 조회한다. 로그는 제공자 화면에서 연다. 앱 내 로그는 미구현이며 재실행·취소는 아래 원격 쓰기 절차를 따른다. PR/MR에서 직접 여는 버전별 검사와 승인 규칙은 아래 범위를 따른다. [Actions runs](https://docs.github.com/en/rest/actions/workflow-runs), [Actions Jobs](https://docs.github.com/en/rest/actions/workflow-jobs), [GitLab Pipelines](https://docs.gitlab.com/api/pipelines/), [GitLab Jobs](https://docs.gitlab.com/api/jobs/)
- 계정 변경/연결 해제 시 이전 프로젝트와 늦은 응답을 지운다. 원격 프로젝트·리뷰·CI 선택과 필터는 같은 앱 세션의 상위 화면 이동 중 유지한다. 앱 재시작과 계정 변경/재승인 시 초기화한다. 화면을 떠나면 진행 중인 OAuth 승인 대기는 취소한다. 로컬 프로젝트 탭의 저장·초안 복원과 별개다.

## 버전에 귀속된 PR/MR 검토

- 상세에서 변경 파일·댓글/논의·리뷰 기록/승인 규칙·검사를 선택해 조회한다. 요청 전후 Head/Base/Start SHA와 브랜치·저장소 식별자를 재확인하고 바뀌면 이전 결과를 표시하지 않는다. 여러 페이지 전체의 원자적 스냅샷을 보장하지는 않는다.
- GitHub files는 API의 최대 3,000개 제한을 안내한다. GitLab collapsed/too_large, binary·누락 patch는 외부 확인 안내로 표시한다. 본문/댓글 20,000자, patch 200,000자, 논의당 note 100개를 넘으면 부분 표시임을 알린다. [GitHub files](https://docs.github.com/en/rest/pulls/pulls), [GitLab diffs](https://docs.gitlab.com/api/merge_requests/)
- GitHub 일반/인라인 댓글은 원래 commit·행·reply ID를 보존하고 review는 기록으로 표시한다. GitLab discussions는 해결 여부·위치와 approval_state 규칙을 표시한다. 과거 APPROVED 기록이나 충족된 규칙을 최종 병합 승인으로 집계하지 않는다. [GitHub reviews](https://docs.github.com/en/rest/pulls/reviews), [GitLab approvals](https://docs.gitlab.com/api/merge_request_approvals/)
- GitHub Checks·Commit Status는 정확한 Head SHA를 조회한다. 테스트 병합 SHA는 열린 PR의 mergeable 상태와 head/base 두 부모를 확인한 경우에만 조회한다. GitLab은 MR 전용 pipelines에서 현재 Head와 다른 SHA를 ‘관계 확인 필요’로 표시한다. 필수 검사 정책·merge queue·최종 병합 가능 판단은 제공자에서 확인한다. [Checks](https://docs.github.com/en/rest/checks/runs), [Status](https://docs.github.com/en/rest/commits/statuses)
- 선택 항목마다 로딩·오류·빈 상태·페이지·확인 시각을 표시한다. 허용한 숫자형 댓글 앵커만 제공자 링크로 연다. 댓글·리뷰·병합·CI 쓰기는 아래 검토 절차로 별도 실행한다.

## 로컬 MCP 사용 범위

`외부 도구 연결`에서 앱에 열린 저장소를 직접 선택하고 설정 JSON을 생성한다. 외부 클라이언트의 stdio 설정에 command/args/env를 등록해야 하며 앱이 다른 프로그램의 설정을 자동 변경하지 않는다. 개발 소스에서는 `node electron/mcp.cjs --repo /absolute/repository`로 실행할 수 있다. 프로토콜 시험 클라이언트와 패키지 내 실행을 검증했으며 실제 외부 플랫폼별 설치 검증은 남아 있다.

- 도구는 `list_projects`, `get_status`, `list_worktrees`, `list_conflicts`, `get_diff` 5개다. diff는 staged 전체 또는 정확한 커밋 SHA만 받는다. unstaged/미추적 파일 내용·OAuth/Agent 인증·임의 명령·쓰기 도구는 제공하지 않는다. 파일 이름과 경로는 조회에 포함된다.
- 시작 인자의 절대 저장소 루트만 최대 30개 허용한다. `repo-N` ID로 조회하며 worktree 메타데이터에 다른 경로가 보여도 접근 권한을 추가하지 않는다. 허용 목록 철회는 클라이언트 설정 변경과 서버 재시작으로 적용한다. 앱의 탭 닫기는 이미 실행 중인 MCP 권한을 철회하지 않는다.
- stdio JSON-RPC, MCP 2025-11-25/2025-06-18 협상, 동시 요청 4개·요청 256KiB·조회 데이터 1MiB·diff 512KiB 제한이다. 취소는 응답을 폐기하며 실행 중인 Git은 최대 30초 제한 안에서 종료한다. 잘린 diff를 정상 결과로 반환하지 않는다. [MCP lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle)
- 저장소/클라이언트는 사용자가 신뢰하는 로컬 환경을 전제로 한다. fsmonitor·외부 diff/textconv를 끄지만 OS sandbox는 아니며 Git의 다른 로컬 설정·filter 실행까지 격리하지 않는다. 저장소 내용은 외부 Agent에 전달되는 신뢰하지 않는 데이터다.
- 패키지 설정은 Electron 실행 파일에 `ELECTRON_RUN_AS_NODE=1`과 ASAR 안의 서버 경로를 전달하므로 별도 Node 설치가 필요 없다. 향후 runAsNode fuse를 끄면 별도 서버 런타임이 필요하다. [Electron 환경 변수](https://www.electronjs.org/docs/latest/api/environment-variables#electron_run_as_node)

## 이번 검증 기록

- ESLint·TypeScript/Vite 빌드, Storybook 70개 테스트, native 키보드·다이얼로그 검사와 정적 Storybook 빌드 통과. Pagination·Disclosure·UsageMeter의 페이지·펼침/접힘·빈 상태를 포함한다.
- Node 21개 테스트 통과. 충돌 원본·외부 변경 차단·복원·해결 표시·rebase/linked worktree·인코딩/경로·사용자 지정 충돌 표시·누락 stage를 실제 임시 Git 저장소에서 검증했다. 기존 실제 Git/Agent/원격 테스트에 OAuth 승인 대기·slow_down·거절·만료·취소, 암호화 파일 저장/복원/삭제, 보안 저장소 불가, refresh 직렬화·토큰 교체·계정 불일치 차단, pagination·PR SHA·CI 회차·한도/권한 오류·조회 도중 계정 해제, 리뷰 버전 변경 차단·원래 댓글 위치·검사 SHA/merge 부모·MR pipeline 관계, MCP 프로토콜·허용 저장소·읽기 전용 경계를 검증했다.
- 개발 Electron과 서명 없는 macOS arm64 번들에서 기존 Git 흐름과 호스팅 UI/IPC를 통과했다. 계정 연결 폼 검증·Device 코드 취소·시스템 브라우저 주소 제한·세션 연결·GitHub/GitLab 조회·30개 이후 페이지·PR/MR 상세·CI 부분 실패와 회차/Jobs·계정 전환 후 늦은 응답 차단·연결 해제, 변경 파일/댓글/승인/검사·오래된 버전 차단, MCP 설정 생성과 생성된 실행 명령의 실제 조회를 확인했다. 같은 임시 프로필의 두 번째 앱 실행이 기존 창으로 귀속되는 것도 확인했다.
- 패키징본의 preload 격리·CSP, 호스팅 승인/PR/CI/MCP 화면 axe(WCAG 2 A/AA, 2.1 AA), 800px 가로 넘침 검사 통과. 일반/좁은 화면 스크린샷을 직접 확인했다. premium strict audit 오류 0, DESIGN.md lint 오류/경고 0, 로컬 문서 링크와 Storybook CSP 분리 확인 통과.

이번 OAuth/API 시험은 통제된 응답만 사용하고 실제 로그인·토큰 발급·원격 쓰기를 하지 않았다. OS 암호화 저장 계약은 테스트 암호화 어댑터로 확인했으며 실제 Keychain 동작은 미검증이다. Git 원격 테스트는 임시 local bare 저장소만 사용했다. macOS 번들은 서명·공증·공개 게시하지 않았다.

패키징본을 같은 시나리오로 재검증하려면 macOS에서 다음을 실행한다. 테스트는 별도 임시 userData를 사용한다.

```sh
pnpm package:desktop
BRANCHLINE_EXECUTABLE="$PWD/release/Branchline-darwin-arm64/Branchline.app/Contents/MacOS/Branchline" node scripts/check-desktop.mjs
```

## 제품 품질 리뷰 반영

[우선순위·화면 근거·수정 결과](./docs/product-review-2026-09-12/REPORT.md)를 별도로 기록했다. 닫은 저장소는 새 MCP 설정 후보에서 제외한다. Git 폼의 한글 조합 Enter를 막고, 날짜 범위 오류·원격 조회 실패에서 복구 경로를 제공하며, 충돌 중 커밋과 재활성화한 Agent의 과거 한도 표시를 차단한다.

프로젝트 탭·내비게이션은 고정하고 키보드로 스크롤 가능한 main이 작업 내용을 소유한다. PR/MR와 CI는 보기 전환을 제공하고 목록↔상세 복귀 시 필터·목록 위치·포커스를 유지한다. 계정·본문·로컬 작업은 공통 Disclosure로 접고, 넓은 창의 리뷰 파일과 diff는 나란히 표시한다. 프로젝트 탭의 이동/닫기는 44px 영역을 보장한다.

추가 Electron 회귀 검증은 `scripts/check-product-quality.mjs`에 있으며 기존 `pnpm check`와 패키지 검증에서 함께 실행한다. 실제 Git 기반 기존 흐름 외에 IME 이벤트·날짜 오류 복구·원격 조회 실패/재시도·quota 무효화·충돌 커밋 비활성·760×580 창·키보드 스크롤을 검사한다. Agent 사용량과 실패/충돌 상태는 격리 프로필의 통제된 IPC 응답을 사용한다.

## 수동 충돌 해결 · 2026-09-14

- `내 작업 → 충돌 해결`에서 실제 Git 인덱스의 Stage 1(기준)/2/3과 현재 작업 파일을 읽는다. Rebase의 Stage 2/3을 사용자 소유로 오표기하지 않는다. 기준/양쪽에 없는 파일은 명시적으로 표시한다. [Git index stages](https://git-scm.com/docs/git-ls-files)
- 공통 SelectField·Disclosure·CodeDiff·TextArea·Dialog·Button·Notice를 재사용한다. 편집은 로컬 초안이며 전체 결과 검토 → 작업 파일 저장 → 별도 해결 표시 순서다. 해결 표시는 선택한 파일만 `git add`하며 merge/rebase 계속·커밋·push·테스트를 실행하지 않는다.
- 원본 SHA·인덱스 stage/mode·HEAD·Git 작업 제어 파일 내용/식별 정보·작업 파일 바이트/모드를 검증한다. 작업별 공통 Git 디렉터리 쓰기 대기열을 재사용한다. 외부 변경을 발견하면 초안을 유지하고 다시 불러오기를 안내한다. 외부 프로그램과 최종 파일 교체/Git add 사이의 원자적 트랜잭션까지 보장하지는 않는다.
- 작업 파일/각 원본은 1 MiB 이하 UTF-8 일반 파일만 허용한다. 심볼릭 링크·하드 링크·submodule·비정상 인코딩·바이너리·작업 파일 부재는 거부한다. 삭제 선택과 복잡한 경로 이동은 외부 도구를 사용한다. CRLF와 실행 권한을 보존하며 혼합 줄바꿈은 앱 저장을 막는다. 파일이 비어 있는 경우에도 명시적으로 검토 후 저장한다. 기본/사용자 지정 길이의 충돌 표시가 남아 있으면 해결 표시를 거부한다.
- 직전 저장 원본은 앱 userData의 `conflict-backups/`에 파일별 1회분으로 남긴다(파일 0600, 디렉터리 0700; 암호화 저장 아님). 임시 파일을 동기화한 후 같은 디렉터리에서 교체한다. 동일 충돌·동일 적용 결과일 때 앱 내 복원이 가능하다. 외부 수정·해결 표시·새 Git 작업 이후 자동 복원을 막으며 남은 사본을 자동 삭제하지 않는다. 복원 관리/내보내기 UI는 후속 범위다.
- 저장하지 않은 편집은 저장소 탭 및 로컬 보기 전환 동안 유지한다. 다른 충돌 파일을 불러올 때 폐기를 확인한다. 상위 화면 이동에도 유지하며 탭 닫기·정상 앱 종료 시 폐기 여부를 확인한다. 앱 재시작·강제 종료 후 초안 복구는 미지원이다.
- Claude/Codex/Gemini의 실제 추론과 대화는 이번 단계에서 실행하지 않았다. 로컬 인증을 그대로 쓰는 제품별 허용 범위와 도구/MCP/hooks/파일 접근 격리가 확인되어야 연결한다. 공식 인증 정보와 계정 데이터는 복사하지 않는다. [Claude Code 제품 제공·인증 조건](https://code.claude.com/docs/en/legal-and-compliance), [Codex App Server](https://learn.chatgpt.com/docs/app-server)

검증: `pnpm check`(Storybook 63개, Node 21개, native·Electron E2E·Storybook build), premium strict 검사, DESIGN lint를 통과했다. CR 단독 줄바꿈 보존 제한을 추가한 뒤 충돌 Node 5개를 다시 통과했고, 최신 소스가 포함된 서명 없는 macOS arm64 번들에서도 전체 Electron 검증을 통과했다. [실행 근거와 화면](./docs/conflict-resolution-2026-09-14/REPORT.md).

## 커밋 그래프·저장소 사이드바 · 2026-09-14

저장소 새로 열기/재시작은 커밋 그래프로 시작한다. 기존 탭 이동 중 보기·커밋 초안은 유지한다. 실제 부모 SHA를 이용해 분기/병합을 그리며 필터나 페이지 밖의 부모는 점선으로 구분한다. 100개 페이지의 레인 좌표는 독립적이다. 실제 그래프가 있다는 이유로 전체 이력의 연속 레인·모든 고급 그래프 조작이 완료된 것은 아니다. Git log의 기존 topo-order 조회를 재사용한다. [Git log](https://git-scm.com/docs/git-log)

활성 저장소 사이드바에 LOCAL·ORIGIN·추가 remote-tracking ref·WORKTREES를 표시한다. 브랜치 선택은 필터/페이지/상세를 초기화한 이력 조회이며 checkout은 별도 확인을 거친다. Worktree 선택은 연결된 실제 경로를 확인한 뒤 탭을 연다. 사이드바에서 조회 실패를 재시도할 수 있고 활성 저장소가 바뀐 뒤 늦게 도착한 응답을 표시하지 않는다. [Git worktree](https://git-scm.com/docs/git-worktree)

그래프/사이드바 최종 검증: `pnpm check`(Storybook 70개·Node 21개·native·Electron E2E·Storybook build), premium strict, DESIGN lint 통과. 서명 없는 macOS arm64 번들에서도 전체 Electron 회귀를 통과했다. [실행 근거와 최종 화면](./docs/repository-graph-2026-09-14/REPORT.md).


## UX 재평가 수정 · 2026-09-14

- 저장하지 않은 충돌 편집은 상위 화면·탭 이동 후 유지한다. 탭 닫기·정상 창 닫기/앱 종료는 계속 편집 또는 버리기 확인을 거친다. 강제 종료 복구·초안 영구 저장은 미지원이다.
- 활성 저장소 자동 갱신은 5초 간격·탭 활성화·앱 복귀 기준이다. 파일 watcher는 아니며 대형 저장소 비용 최적화는 후속 범위다. Git 쓰기 중에는 해당 조회를 조율한다.
- `계속`은 검토 당시 token과 Git operation을 재검사하고 Git의 기본 준비 메시지로 merge/rebase/cherry-pick을 계속한다. hooks·서명은 유지한다. Git 중단과 특수 충돌 지원은 여전히 미완료다.
- 그래프 compact 행 48px·단일 본문 세로 스크롤, 고정 전역 메뉴·새로고침, 원격 상세 컨텍스트 헤더를 제공한다.
- PM 모아보기는 최대 5개 프로젝트의 열린 PR/MR와 주의가 필요한 CI를 각 첫 30개 기준으로 읽는다. 페이지 초과·부분 오류를 표시하고 전체 목록으로 이동한다. 담당자·검토 요청은 제공자가 반환한 값만 표시한다.
- OAuth 배포 기본 ID를 설정할 수 있게 했으나 현재 electron/oauth-clients.json은 빈 값이다. 등록 앱 공개 ID와 실제 승인/OS 저장 검증이 있어야 일반 배포 로그인이 완성된다.
- AI 실행·대화·자동 수정, PR/MR 쓰기·병합 및 CI 실행/취소, 필수 검사/승인 최종 집계는 이번 UX 수정과 별개의 미완료 항목으로 남는다.
- 검증 상세: docs/ux-fixes-2026-09-14/REPORT.md. 원래 감사 보고서는 당시 증거로 유지한다.


## 공식 CLI 충돌 대화 · 원격 쓰기 후속 구현

- `ConflictChat`은 `Conversation` 공통 패턴을 사용한다. worktree 경로·충돌 snapshot·Agent별 입력/대화/수정안을 메모리에 유지한다. 후속 질문에 이전 수정안을 함께 전달한다. 다른 Agent에 대화를 자동 공유하지 않는다. 공식 CLI의 현재 인증을 사용하며, 앱 내 계정 선택·인증 변경 감지는 미구현이다. 계정을 변경했다면 새 대화를 시작해야 한다.
- 선택 파일의 Stage 1/2/3·현재 파일·편집·질문만 stdin으로 전달한다. 전체 전송은 512 KiB, 질문 10,000자, 대화 10회, stdout+stderr 2 MiB, 실행 5분으로 제한한다. 최종 JSON의 설명·전체 수정안만 받아 검증한다. 실시간 텍스트 스트리밍과 실행 중 추가 지시 대신 중단 후 재요청을 제공한다. 화면 이탈 시 실행을 중단하며 입력은 유지한다.
- CLI는 별도 임시 폴더에서 실행한다. Codex는 사용자 config/rules를 읽지 않는 `exec`, read-only sandbox와 shell/hooks/apps/plugins/browser 등 비활성 옵션을 사용한다. Claude Code는 수정하지 않은 설치 바이너리의 safe-mode·tools/MCP 차단·hooks 비활성·세션 저장 비활성 옵션을 사용한다. Gemini CLI는 이 임시 폴더만 세션 신뢰하고 core 도구/MCP/hooks를 제한한 설정·deny 정책·extensions none을 사용한다. CLI 인증 저장소를 복사하거나 전역 로그인/설정을 변경하지 않는다. 관리형 조직 정책은 계속 적용되며 Branchline 자체 OS sandbox를 제공한다는 의미는 아니다. 지원하지 않는 옵션/버전은 오류로 끝내고 안전 옵션을 자동 해제하지 않는다.
- Codex 실행은 사용자 config를 제외하므로 사용자 지정 모델/제공자 설정을 재사용하지 않는다. Claude/Gemini와 Codex 모두 공식 CLI 인증/환경에 따른 사용료가 발생할 수 있다. 계정·과금 방식 확인과 실제 CLI 버전별 통합 추론 검증은 배포 전 남은 조건이다. Claude Code 배포는 제공자의 제품 내 실행 조건을 충족해야 한다. [Codex exec](https://learn.chatgpt.com/docs/developer-commands#codex-exec), [Claude CLI](https://code.claude.com/docs/en/cli-reference), [Claude 제품 제공 조건](https://code.claude.com/docs/en/legal-and-compliance), [Gemini 설정](https://geminicli.com/docs/reference/configuration/), [Gemini policy](https://geminicli.com/docs/reference/policy-engine/).
- 응답은 곧바로 파일에 쓰지 않는다. 전체 수정안 → 기존 편집 초안 교체 확인 → 기존 저장 검토 → 별도 해결 표시 순서다. 요청 이후 직접 편집했다면 교체 확인에 표시하고, 원본 token이 바뀌면 거부한다. 실제 테스트 실행은 하지 않는다. 입력/미적용 제안은 탭 닫기·정상 종료 보호에 포함하며 재시작 복구는 미지원이다.
- 원격 쓰기는 OAuth 연결 때 별도로 선택한다. GitHub는 read:user+repo, GitLab은 read_user+api를 요청한다. 이전 조회 전용 연결은 다시 연결해야 앱에서 쓸 수 있다. 최종 서버 권한·조직 보호 규칙을 우회하지 않는다.
- 원격 작업은 main에 최대 30개·5분 작업안으로 보관한다. 생성 시 같은 프로젝트의 원격 출발/대상 브랜치를 확인한다. 리뷰의 Head/Base 버전, CI의 SHA·상태·회차를 확인창 직후 다시 조회하며, 승인/병합 요청에 provider의 SHA 인자를 전달한다. 생성·댓글·CI API에는 원자적 조건부 쓰기가 없으므로 조회 직후 외부 변경까지 완전히 잠그지 못한다.
- PR/MR 생성, 일반 댓글, 승인, GitHub 변경 요청, GitHub merge/squash/rebase·GitLab 프로젝트 설정 병합, Actions 전체 재실행·GitLab 실패/취소 작업 재시도, 진행 CI 취소를 제공한다. GitLab 재인증이 필요한 승인은 공식 화면에서 진행한다. 원본 브랜치 삭제·관리자 우회·자동 병합 예약을 요청하지 않는다. 신규 workflow_dispatch/Pipeline 생성, fork 간 생성, 인라인 댓글·GitLab 변경 요청은 남은 범위다.
- 실행은 작업안을 한 번만 소비한다. 쓰기의 자동 재시도는 하지 않는다. 연결 중단·서버 오류 등 결과 불명은 반영 가능성을 명시하고 수동 결과 조회를 안내한다. 확인창에 계정·프로젝트·SHA·전송 본문·효과를 보여 주며 성공 후 최신 결과 조회 버튼을 제공한다.
- 검증 근거는 [후속 구현 보고서](./docs/remaining-features-2026-09-14/REPORT.md)에 기록한다. 실제 계정 OAuth/AI 호출·원격 게시·유료 CI 실행을 테스트하지 않았다.

## 고정 이력·커밋 상세 · 2026-09-14

이력 화면은 main 스크롤 대신 고정 프레임을 사용한다. CommitGraph의 현재 페이지(최대 100개) 흐름 미니맵과 목록, 공통 InspectorPanel 상세를 나란히 표시한다. 목록과 상세 본문만 스크롤하며 페이지 이동 중 선택한 커밋을 유지한다. 저장소 전체 이력의 무제한 축소 보기는 제공하지 않는다. 다른 작업 화면은 기존 main 스크롤을 유지한다.

`pnpm check` 통과: Storybook 83개, Node 25개, native·Electron·복구 검사와 Storybook 빌드. 760×580에서 3개 커밋 행, 상세 병렬 배치, 가로 넘침 없음, 페이지 이동 중 선택 보존을 실제 임시 Git 저장소로 확인했다. Premium strict와 DESIGN lint도 통과했다. [전체 화면](./docs/pinned-history-2026-09-14/repository-graph.png), [최소 창](./docs/pinned-history-2026-09-14/repository-graph-narrow.png), [검증 로그](./docs/pinned-history-2026-09-14/check.log). 이번 변경의 설치 번들은 재생성하지 않았다.

## 무한 스크롤·연속 그래프 · 2026-09-14

고정 이력 화면의 이전/다음 페이지를 제거했다. HistoryGraph가 스크롤 하단에서 이전 기록을 누적하고, 공통 CommitGraph가 미조회 부모 레인을 예약해 묶음 경계의 실제 연결을 유지한다. 최초 조회의 SHA 기준들을 다음 요청에 재사용하므로 중간 ref 이동으로 중복·누락된 이력을 섞지 않는다. 선택·스크롤·기존 목록은 추가 조회 중 유지하며 실패 시 같은 위치에서 재시도한다. 최신 이력 버튼은 조회를 새로 시작한다. 필터 변경은 목록을 초기화한다. 미니맵 개수는 누적 로드 수이며 전체 개수로 표시하지 않는다.

검증: `pnpm check`(Storybook 85개, Node 25개, native·Electron·복구·Storybook build), premium strict, DESIGN lint 통과. 307개 실제 임시 Git 커밋을 4회 누적하며 중복·누락 없음, 100번째 부모 연결, 기존 좌표·스크롤·상세 보존을 검증했다. 추가 조회 실패 후 재시도와 ref 이동 후 고정 조회도 통과했다. [100개 경계의 연속 그래프](./docs/infinite-history-2026-09-14/infinite-history-boundary.png), [검증 로그](./docs/infinite-history-2026-09-14/check.log). 로드된 이력은 메모리에 유지하며 대규모 이력의 가상 렌더링은 미구현이다. 설치 번들은 이번에 재생성하지 않았다.

## 그래프 시각 개선 · 2026-09-14

SVG를 25% 너비로 비균등 축소하던 규칙을 제거했다. 레인 간격 24px과 원형 노드 비율을 유지하며 많은 레인은 목록 안에서 가로 스크롤한다. 사용자의 GitKraken 참고에 따라 그래프에만 6개 구분색, 곡선 분기, 병합 이중 원·HEAD 채움·선택 강조를 적용했다. 넓은 목록은 브랜치 라벨을 왼쪽 열에 정렬하고 복수 ref는 대표 라벨과 추가 개수로 요약한다. 전체 이름은 접근 가능한 행 텍스트와 title에 유지한다. 새 첫 부모는 현재 레인을 이어가도록 하여 불필요한 좌우 이동을 줄였다.

`pnpm check` 통과: Storybook 87개, Node 25개, native·Electron·복구·Storybook build. 실제 Git의 12개 부모 병합과 16레인 Storybook에서 노드 비율·가로 탐색·접근성을 검증하고, 307개 무한 스크롤의 기존 연결·위치 보존도 통과했다. Premium strict와 DESIGN lint 통과. [다중 레인 화면](./docs/graph-polish-2026-09-14/graph-lanes-1440.png), [검증 로그](./docs/graph-polish-2026-09-14/check.log). 설치 번들은 재생성하지 않았다.

## 그래프 탐색·컬럼 조절 · 2026-09-14

공통 ScrollOverview로 누적 그래프의 현재 표시 범위를 표시하고 클릭·드래그·위아래/Page/Home/End 키로 이력을 이동한다. 공통 ResizeHandle로 그래프와 제목·설명 사이를 드래그하거나 좌우/Home/End 키로 조절한다. 그래프는 최소 48px, 설명 공간은 최소 100px을 유지하며 창 크기에 맞춰 제한한다. SVG는 고정 레인 간격을 유지하고 그래프 컬럼 하단의 가로 스크롤바·트랙패드·Shift+휠로 이동한다. 제목·브랜치 라벨은 좌우 이동하지 않는다. 기존 커밋 선택과 무한 스크롤 연결을 유지하며 추가 로딩 때 조절한 너비를 보존한다. 두 공통 컴포넌트는 design-system에서 공개하고 Storybook 예제·키보드 상태를 추가했다.

`pnpm check` 통과: Storybook 90개, Node 25개, native·Electron·복구·Storybook build. 실제 임시 Git 저장소의 307개 커밋과 12개 부모 병합에서 미니맵 클릭/드래그, 컬럼 드래그/키보드, 독립 가로 이동, 추가 로딩 중 너비·위치·선택 보존, 접근성, 760×580 최소 창을 검증했다. Premium strict와 DESIGN lint도 통과했다. [컬럼 조절 화면](./docs/graph-navigation-2026-09-14/graph-lanes-1440.png), [최소 창](./docs/graph-navigation-2026-09-14/graph-lanes-760.png), [전체 검증 로그](./docs/graph-navigation-2026-09-14/check.log). 컬럼 너비는 현재 이력 화면에 유지하며 앱 재시작까지 저장하지 않는다. 설치 번들은 재생성하지 않았다.

## 중앙 Git 툴바·작성자 프로필·프로젝트 탭 · 2026-09-14

저장소 제목 행 중앙에 공통 GitToolbar를 배치하고 기존 ToolbarButton의 아이콘/라벨 구성을 재사용했다. Fetch·Pull·Push·Branch·Stash·Pop이 기존 실행/확인 흐름으로 연결되며 제목 옆의 별도 브랜치 만들기·작성자 설정 버튼은 제거했다. Pull은 fast-forward로 제한하고, Pop은 최신 항목과 SHA를 다시 확인해 복원 성공 시만 제거한다. 오류 후 상태 조회와 원격 관리 진입 시 재조회·재시도를 유지한다.

앱 설정에서 개인·업무 작성자 프로필을 최대 30개 저장·편집·삭제하고 열린 저장소에 선택 적용한다. 프로필은 앱 설정 파일에 저장되며 적용은 저장소 local Git identity를 변경한다. 기존 커밋·Git 인증 세션과는 별개다. 프로필 수정/삭제는 이미 적용한 저장소 설정을 자동 변경하지 않는다. 프로젝트 탭의 높이·텍스트 정렬을 고정하고 호버 배경을 탭 단위로 정리해 버튼 일부만 튀어나와 보이던 현상을 수정했다.

검증: `pnpm check` 통과(Storybook 92개, Node 26개, native·Electron·초안 복구·Storybook build). 임시 로컬 원격 저장소에서 중앙 툴바의 Push/Fetch/Pull/Branch/Stash/Pop 실제 실행, 개인·업무 프로필 선택·파일 저장·저장소 적용·IPC 입력 거부·한글 IME, Pop 충돌 시 원본 보존, 호버 전후 탭 크기 일치, 760×580 창의 버튼 표시·접근성을 검증했다. 앱 설정 이동 뒤 충돌 초안 보존과 기존 307개 연속 그래프도 통과했다. Premium strict와 DESIGN lint 통과. [툴바·탭 화면](./docs/toolbar-profiles-2026-09-14/toolbar-hover-1440.png), [프로필 설정](./docs/toolbar-profiles-2026-09-14/author-profiles.png), [전체 검증 로그](./docs/toolbar-profiles-2026-09-14/check.log). 설치 번들은 재생성하지 않았다.


## 사이드바 Stash·Worktree / 충돌 자동 안내 · 2026-09-14

공통 BranchTree에 Stash 변형과 그룹별 관리 동작을 추가했다. 왼쪽 STASH에서 최근 보관 항목을 검색·선택하고 SHA 기준 diff를 확인하며, 전체 보관함의 페이지 탐색·복원·삭제는 기존 RemoteWorkspace 실행 경로를 사용한다. WORKTREES 그룹 안에서 관리 화면으로 이동하거나 각 worktree를 별도 탭으로 연다. 상단 Worktree·Stash 중복 탐색을 제거하고 원격 설정 화면을 분리했다.

기존 활성 저장소 5초 상태 조회와 포커스 갱신으로 미해결 충돌을 감지한다. Merge/Rebase/Cherry-pick 진행 상태, 또는 Stash 복원 등 operation 없는 충돌도 해결 화면으로 안내한다. 처음에는 첫 충돌 파일을 자동으로 읽고 Claude·Codex·Gemini 선택/대화 영역을 펼친다. 동일 충돌의 반복 화면 이동을 막고 새 충돌 안내에서도 저장 전 편집과 대화를 보존한다. 상위 설정·PM 화면은 강제로 이동시키지 않는다. AI 전송·수정안 적용·파일 저장·해결 표시·Git 작업 계속은 기존 사용자 검토 흐름으로 남는다.

검증 근거: `scripts/check-conflicts.mjs`의 실제 외부 Merge 자동 진입·중단 후 재발·초안 보존, `scripts/check-ux-recovery.mjs`의 기존 충돌 저장소 열기·화면/탭/종료 보호, `scripts/check-desktop.mjs`의 사이드바 Stash 키보드 선택·미리보기·복원·삭제와 Worktree 탐색. AI는 임시 CLI 실행 파일로 검증하며 실제 로그인 세션·유료 호출은 사용하지 않는다. [Stash 화면](./docs/sidebar-conflicts-2026-09-14/sidebar-stash.png), [충돌 해결 화면](./docs/sidebar-conflicts-2026-09-14/desktop-conflicts.png), [검증 로그](./docs/sidebar-conflicts-2026-09-14/check.log). 설치 번들은 이번에 재생성하지 않았다.

최종 검증: `pnpm check` 통과(Storybook 94개, Node 26개, native·Electron·초안 복구·Storybook build). 760×580 최소 창과 접근성, 한글 IME, 기존 307개 연속 그래프 회귀 검사도 통과했다. Premium strict와 DESIGN lint는 오류·경고 0개다.


## 이력 UX 감사와 자동 갱신 · 2026-09-14

그래프 하단의 상시 안내, 더 불러오기, 최신 버튼을 제거했다. 하단 근처에서 자동으로 이전 커밋을 조회하며 실패 시 기존 목록을 유지하고 다시 시도를 표시한다. HEAD·조회 ref가 바뀌면 이미 불러온 범위를 새 revision 집합으로 다시 읽어 한 번에 교체한다. 갱신 후 스크롤 중인 커밋의 SHA와 행 내부 위치를 보존한다. 단순 작업 파일 변경은 고정 커밋 diff 재조회를 일으키지 않는다.

그래프·비교 화면에서 선택 전에는 상세를 렌더링하지 않고 목록이 전체 너비를 사용한다. 같은 행 재선택·Esc로 해제하고 그래프 위아래 키로 커밋을 이동한다. 공통 InspectorPanel의 닫기는 선택 행으로 포커스를 반환한다. 상세에 SHA 복사를 추가하고 허용된 저장소/커밋을 검증하는 main IPC를 사용한다. Branch 생성은 선택 SHA, 조회 브랜치, HEAD 순서로 기준을 잡고 확인 화면에 시작점을 표시한다. 공통 Badge의 실제 클래스에 스타일을 연결해 긴 이름/HEAD/추가 개수가 겹치던 문제도 수정했다.

검증: `pnpm check` 통과(Storybook 97개, Node 26개, native·Electron·초안 복구·Storybook build). 실제 임시 Git 307개 커밋과 12개 부모 병합에서 자동 추가 조회·연속 그래프·선택 토글·키보드·자동 갱신·스크롤 기준점 보존·선택 SHA의 실제 브랜치 생성·SHA 복사 IPC 입력 검증을 확인했다. 760×580, IME, 접근성 및 기존 Git/Agent/호스팅 회귀 검사를 통과했다. 클립보드 쓰기 종착점은 테스트 프로세스에서만 대체했으며 사용자 클립보드는 변경하지 않았다. Premium strict 및 DESIGN lint 오류·경고 0개.

[UX 분석과 후속 기능 우선순위](./docs/history-ux-2026-09-14/REVIEW.md), [전체 너비 그래프](./docs/history-ux-2026-09-14/history-full-width.png), [검증 로그](./docs/history-ux-2026-09-14/check.log). 읽은 행의 가상 렌더링은 후속 범위이며 설치 번들은 이번에 재생성하지 않았다.

## Stash 항목 → 그래프 위치·변경 상세 · 2026-09-14

왼쪽 Stash 항목 선택을 커밋 그래프로 연결했다. 필터를 해제하고 선택한 SHA를 이력 revision 집합에 추가한 뒤 첫 100개 밖이면 해당 Stash까지 자동 조회한다. 실제 부모 연결과 Stash 라벨·선택 강조를 표시하고 공통 InspectorPanel에서 파일 요약과 미추적 파일을 포함한 diff를 보여준다. 표시 명령에만 core.quotepath=false를 적용해 한글 경로를 읽을 수 있게 했다. 같은 사이드바 항목은 위치로 다시 이동하며, 그래프의 같은 행 클릭·Esc·선택 해제는 상세를 닫는다. SHA 기준으로 선택하므로 최신 Stash 삭제 등으로 번호가 바뀌어도 다른 내용을 열지 않는다. 조회는 작업 디렉터리를 변경하지 않으며 복원·삭제는 기존 보관함의 검토 흐름을 사용한다.

검증: `pnpm check` 통과(Storybook 98개, Node 26개, native·실제 Electron·초안 복구·Storybook build). `scripts/check-stash-graph.mjs`는 임시 저장소에서 130개 후속 커밋 뒤의 이전 Stash, 실제 부모 연결, 검색 해제, 파일 요약·한글 경로·미추적 diff, 반복 위치 이동, Stash 번호 변경, 선택 해제, 760×580 창과 접근성, 조회 전후 HEAD·브랜치·작업 파일 보존을 검증한다. 공통 CommitGraph의 RevealCommit Story를 추가했다. Premium strict 및 DESIGN lint는 오류·경고 0개다. [화면](./docs/stash-graph-2026-09-14/stash-graph.png), [최소 창](./docs/stash-graph-2026-09-14/stash-graph-narrow.png), [검증 로그](./docs/stash-graph-2026-09-14/check.log). 사이드바는 기존처럼 최근 100개 Stash를 제공하며 전체 보관함에서 나머지를 탐색한다. 설치 번들은 재생성하지 않았다.


## 제품 감사 수정 · 2026-09-14

재현된 검색 결과 가림·한글 diff 경로·Agent 재시도·프로필 필드 오류·삭제 및 초안 보호를 수정했다. 비교에서 검토한 SHA로 Merge/Rebase를 시작하고 충돌 화면으로 이어지며, Git 작업 중단은 별도 확인 뒤 원래 상태로 복구한다. 기존 브랜치·detached Worktree와 전체 스테이징/해제를 추가했다. 상세 크게 보기, 충돌 편집과 대화 병렬 배치, 현재 Head 검사·승인 요약, 허용 저장소 MCP 설정 복사를 연결했다.

검증: `pnpm check` 통과(Storybook 101개, Node 28개, native·실제 Electron·초안 복구·Storybook build). 760×580·키보드·IME·접근성 및 기존 그래프·Stash 회귀를 확인했다. 실제 사용자 저장소·계정·클립보드를 테스트 목적으로 변경하지 않았다. Premium strict와 DESIGN lint 오류·경고 0개. OAuth 공개 ID는 사용자 요청대로 설정 안내를 유지한다. 설치 번들은 재생성하지 않았다. [항목별 수정 상태와 후속 범위](./docs/product-ux-fixes-2026-09-14/RESULTS.md), [검증 로그](./docs/product-ux-fixes-2026-09-14/check.log).

## 호스팅 로그인 앱 자동 설정 · 2026-09-14

연결에 성공한 공개 Client ID를 이 PC의 설정에 제공자별로 기억한다. 이미 저장된 계정의 공개 ID도 자동 재사용하며, 연결 해제·세션 종료 이후에도 공개 설정은 유지한다. 이후 연결 화면은 ID 입력 없이 승인 코드를 요청하고 고급 사용자 지정에서만 ID를 바꾼다. 설정 읽기·저장 실패는 재시도/수동 입력 또는 비차단 안내로 처리한다. 승인 취소·실패한 ID는 자동 설정에 넣지 않는다. token·Client Secret·device_code를 공개 설정에 저장하지 않는다.

검증: pnpm check 통과(Storybook 101개, Node 29개, native·실제 Electron·재시작·접근성·Storybook build). 통제된 제공자에서 ID 없는 승인 요청, 사용자 지정 전환, 제공자 분리, 계정 해제·앱 재시작 후 ID 유지 및 세션 토큰 소멸을 확인했다. 이전 상세 확대의 빈 스크롤 영역에 접근성 역할도 명시했다. Premium strict와 DESIGN lint 오류·경고 0개. 실제 사용자의 로그인 세션을 테스트하지 않았고 실행 중 앱을 재시작하지 않았다.

새 설치본에도 최초 ID 입력을 없애려면 배포용 등록 앱 ID를 oauth-clients.json에 넣어야 한다. 현재 배포 기본 ID는 비어 있다. 회사 자체 GitLab 지원은 후속 범위다. [검증 로그](./docs/oauth-automatic-2026-09-14/check.log), [자동 설정 화면](./docs/oauth-automatic-2026-09-14/oauth-automatic.png).

## 2026-09-14 — 브랜치 컨텍스트 메뉴

- 공통 ContextMenu + Storybook 추가. 사이드바/그래프 라벨 우클릭, 사이드바 ⋯, Shift+F10 및 키보드 이동 지원.
- 일반 클릭의 전체 그래프 위치 이동과 명시적 Solo 분리. 선택 tip까지 추가 이력 조회, 상세 표시, Solo 해제 제공.
- 기존 생성·Worktree·비교·Merge/Rebase·로컬 체크아웃 재사용. 실제 Git으로 원격 추적 체크아웃, 로컬 rename/safe-delete, 검증된 브랜치 이름 복사 추가.
- 브랜치/Worktree 생성도 다이얼로그를 열 때의 검토 token을 적용 시 유지하도록 수정.
- 범위·보호·검증·실제 화면: [branch-menu 결과](./docs/branch-menu-2026-09-14/RESULTS.md). 원격 삭제·PR/MR 메뉴 연동·이력 재작성은 이번 구현에 포함되지 않는다.

## 2026-09-14 — 공통 diff 검토 화면

- 공통 CodeDiff에 파일 선택, 통합/좌우/원본 보기, 실제 이전·이후 줄 번호, 추가·삭제 강조, 변경 구간 탐색, 줄바꿈과 독립 스크롤을 연결했다. 커밋·Stash·작업 파일·PR/MR과 브랜치 비교에서 재사용한다.
- 브랜치 비교는 기존 SHA·방향의 통계와 실제 patch를 함께 조회한다. 충돌 원본·AI 수정안·미추적 파일은 원문 모드로 분리한다. combined/불완전 patch는 원본으로 안내한다.
- 작업 파일의 개별 상세 컨테이너를 InspectorPanel로 전환했다. 확대/축소에도 자식 뷰어를 유지해 파일 선택·보기 방식·스크롤이 초기화되지 않는다. 최소 창에서는 도구막대와 코드 스크롤을 분리한다.
- 앱/기능의 개별 오류·로딩은 Notice, 비교·Stash 페이지 이동은 Pagination으로 교체하고 필요한 변형과 Storybook을 추가했다.
- 구현 범위·검증·실제 Electron 화면: [diff 검토 결과](./docs/diff-viewer-2026-09-14/RESULTS.md). 전체 파일 조회나 문법 하이라이팅, 의미 기반 줄 대응은 이번 구현 범위에 포함되지 않는다.

검증: `pnpm check` 전체 통과(Storybook 111개/33파일, Node 30개, native·Electron·복구·접근성·Storybook build). Premium strict와 DESIGN lint 오류·경고 0개. 임시 저장소/통제된 제공자만 사용했으며 실제 앱 재시작·계정·release 검증은 진행하지 않았다.

## 2026-09-14 — 두 브랜치 그래프 비교와 적용

- 모호한 A/B 필드를 `가져올 브랜치 → 반영할 브랜치`로 바꾸고 공통 BranchComparison에서 두 실제 이력과 공통 조상 이동을 제공한다. 작은 창에서는 위아래로 배치한다.
- 선택 커밋의 변경 확인과 Cherry-pick 검토를 연결했다. 변경 중 작업 트리·검토 이후 상태 변경을 차단하고 Merge 커밋의 부모 선택, 충돌 계속/중단, 빈 결과 건너뛰기를 지원한다. Merge는 실제 반영 브랜치 체크아웃일 때만 활성화한다.
- 비교에서 기존 PR/MR 생성 흐름을 재사용하고 브랜치명을 자동 입력한다. 프로젝트 확인과 최종 실행 검토를 유지하며 비교 SHA와 원격 SHA가 다르면 생성 준비를 거부한다.
- `pnpm check` 전체 통과(Storybook 117개/35파일, Node 31개, native·실제 Electron·초안 복구·접근성·Storybook build). Premium strict와 DESIGN lint 오류·경고 0개. 실제 Git 임시 저장소와 통제된 제공자로 검증했으며 사용자 계정 게시·실행 앱 재시작·설치 번들 생성은 진행하지 않았다.
- [구현 범위·화면·검증 로그](./docs/comparison-2026-09-14/RESULTS.md). 단일 커밋 Cherry-pick과 동일 원격 프로젝트 PR/MR 생성 범위이며 다중 커밋 큐·fork 매핑은 후속 범위다.

## 2026-09-14 — 자동 Stash 체크아웃

로컬·원격 추적 체크아웃에 미추적 포함 자동 Stash → 전환 → 인덱스 포함 apply → 성공 확인 후 자동 Stash 삭제를 연결했다. 사이드바·그래프·비교 화면은 변경 사항이 있어도 전환을 검토할 수 있다. 기존 Dialog/Notice/Button을 재사용해 보관 범위와 실패 시 복구를 안내한다. 체크아웃 실패 시 원래 브랜치의 깨끗한 작업 트리에만 복원을 시도하고, 실패/충돌/불확실한 결과의 Stash는 보존한다. 실제 충돌은 기존 수동/AI 해결 화면으로 이동한다.

검증: `pnpm check` 전체 통과(Storybook 117개/35파일, Node 35개, native·실제 Electron·초안 복구·접근성·Storybook build). 임시 Git에서 혼합 변경·스테이징·한글 rename·미추적 바이너리·기존 보관본·무시된 파일 보호, 실패 복원과 충돌 보존을 확인했다. Electron에서 자동 체크아웃·취소·복원·삭제·충돌 화면 및 최소 창을 검증했다. Premium strict 오류·경고 0개. 실제 사용자 저장소와 계정은 테스트하지 않았고 실행 앱/설치 번들은 재시작·재생성하지 않았다. [화면·범위·로그](./docs/checkout-auto-stash-2026-09-14/RESULTS.md).

## 2026-09-14 — 커밋 파일 목록과 diff 탭

커밋/Stash 상세를 공통 DiffFileList로 전환하고 파일 클릭 시 그래프 위치의 ContentTabs에서 CodeDiff를 연다. 여러 파일을 열고 전환할 수 있으며 같은 파일은 중복 생성하지 않는다. 닫기 버튼·Esc·Delete로 활성 파일을 닫고 그래프 선택과 스크롤을 유지한다. 다른 커밋 또는 사이드바 재탐색 시 이전 파일 탭은 정리한다. 확대 목록에서 파일을 열면 확대를 닫고, 작은 창에서는 diff에 너비를 우선 배정한다. 커밋 상세를 해제할 때는 기존 커밋 행으로 포커스를 복구한다.

Merge 커밋의 파일 변경은 첫 부모 기준으로 조회하며 목록에 비교 기준을 표시한다. 한글·rename·바이너리 경로 표시, 빈 커밋, 불완전 diff의 원본 처리를 확인했다. 공통 컴포넌트 공개와 Storybook을 추가하고 기존 InspectorPanel/CodeDiff를 재사용했다.

검증: `pnpm check` 전체 통과(Storybook 122개/37파일, Node 36개, native·실제 Electron·초안 복구·접근성·Storybook build). 파일 탭 전환/중복/닫기/Esc/IME, 그래프 위치 보존, 최소 창, 실제 Merge 조회와 저장소 불변, 기존 그래프·Stash·자동 체크아웃 회귀를 통과했다. Premium strict와 DESIGN lint 오류·경고 0개. 사용자 저장소·계정은 테스트하지 않았으며 실행 중 앱 재시작과 설치 번들 생성은 진행하지 않았다. [화면·검증·범위](./docs/file-tabs-2026-09-14/RESULTS.md).

## 2026-09-14 — 그래프 +N 브랜치 목록 툴팁

공통 Tooltip을 추가하고 CommitGraph의 +N 배지에 같은 SHA의 전체 참조 목록을 연결했다. LOCAL/REMOTE와 전체 이름을 표시하고 호버 유지·행 키보드 포커스·Esc 닫기·포털 경계 보정·긴 이름 줄바꿈을 지원한다. 읽기 전용 배지는 기존 행 포커스를 공유하며 중첩 버튼을 만들지 않는다. 조회만으로 커밋 선택이나 체크아웃을 바꾸지 않는다.

검증: `pnpm check` 전체 통과(Storybook 125개/38파일, Node 36개, native·실제 Electron·초안 복구·접근성·Storybook build). 실제 임시 저장소에서 로컬/원격 목록, 호버 유지와 위치, 키보드와 Esc 후 선택/체크아웃 보존을 확인했다. 기존 그래프·Stash·파일 탭 회귀도 통과했다. Premium strict와 DESIGN lint 오류·경고 0개. 실행 중 앱 재시작·설치 번들 생성은 진행하지 않았다. [화면과 검증 로그](./docs/branch-tooltip-2026-09-14/RESULTS.md).


## 그래프 브랜치 이름 전체 줄바꿈 (2026-09-14)

- 공통 CommitGraph의 브랜치 Badge를 전체 줄바꿈으로 표시하고 필요한 행만 아래로 확장한다. 넓은 그래프에서 HEAD를 별도 줄에 배치하고 +N 툴팁은 유지한다.
- 실제 행 높이를 ResizeObserver로 읽어 SVG의 선·원형 노드와 누적 지도에 반영한다. 커밋 찾기·스크롤 앵커는 고정 행 번호 곱셈 대신 실제 행 위치를 사용한다.
- 최소 창에서는 고정 세 행 노출 대신 읽을 수 있는 행과 내부 스크롤 도달성을 보장한다. 실행 중인 앱은 자동 재시작하지 않았다.
- 검증 및 화면: docs/branch-wrap-2026-09-14/RESULTS.md.

- 줄바꿈 최종 검증: `pnpm check` 전체 통과(UI 126개·Node 36개·Electron E2E 포함). 크기 변경과 파일 탭 복귀의 스크롤 앵커, 컬럼 드래그 최종 좌표도 보정했다.


## 확대 상세 내부 diff·변경 파일 트리 (2026-09-14)

- InspectorPanel의 확대 상태를 공통 DiffFileBrowser로 전달한다. 일반 상세는 기존 외부 파일 탭을 열고, 확대 상세는 모달 내부에서 diff와 파일 목록을 오간다. 목록 복귀 시 폴더 펼침·표시 방식·파일 포커스를 보존하며 모달 종료는 선택 커밋을 유지한다.
- DiffFileList에 공통 Button/Disclosure/Badge 기반 목록/트리 전환을 추가했다. 전체 경로와 기존 diff 인덱스로 중복 파일명을 구별한다.
- `pnpm check` 전체 통과: UI 129개·Node 36개와 Electron E2E 포함. 화면과 검증: docs/modal-file-tree-2026-09-14/RESULTS.md.


## 커밋 점 포함 브랜치 툴팁 (2026-09-14)

- 공통 CommitGraph의 점에 Tooltip을 연결하고 불러온 실제 부모 연결에서 확인된 포함 브랜치를 표시한다. LOCAL/REMOTE·TIP을 구분하고 최초 작업 브랜치로 표현하지 않는다. 확인 불가·긴 이름·공유 조상·필터 경계를 처리한다.
- 점 호버는 읽기 전용이다. 기존 커밋 선택·키보드·+N 툴팁과 가로 이동을 유지하고, 툴팁의 Esc가 커밋 선택을 함께 해제하지 않도록 공통 Tooltip을 보정했다.
- `pnpm check` 전체 통과: UI 131개·Node 36개 및 Electron E2E. 화면과 검증: docs/commit-node-tooltip-2026-09-14/RESULTS.md.

### 2026-09-14 — 원격 모니터링 및 브랜치 폴더

열린 저장소의 60초 자동 Fetch와 공통 worktree cooldown, LOCAL 브랜치별 추적 커밋 수, 상단 Fetch/Pull/Push SyncBadge를 구현했다. 연결 실패는 마지막 이력 수치와 함께 명시하며 자동 merge/push/prune은 실행하지 않는다. Git 인증은 기존 credential helper/SSH를 사용한다. BranchTree는 선택 경로 외 폴더를 기본 접고 그룹별 전체 펼치기/접기를 제공한다. GitHub/GitLab 실제 회사 계정 검증과 로컬 fixture 검증은 별개다.

### 2026-09-14 — 시·분 표시, 커밋 메시지 카드와 Amend

공통 그래프에 로컬 시각의 시·분을 표시하고, 커밋 상세의 제목·본문·작성자 메타데이터를 공통 카드로 분리했다. 현재 HEAD에서 메시지만 수정하거나 스테이징을 포함하는 Amend 검토/실행을 지원한다. stale 상태·공유 이력 확인·Git hooks 실패를 처리하며 기존 index/worktree와 부모 관계를 검증한다. Claude/Codex/Gemini의 기존 대화 실행 경로로 메시지 제안을 요청하고 검토 후 적용할 수 있다. 실제 계정·과금 호출은 하지 않았으며 제어된 CLI fixture로 연결을 검증한다. 검증 결과는 docs/commit-amend-2026-09-14/RESULTS.md에 기록한다.

### 2026-09-14 — 브랜치 우클릭 Fetch/Pull

사이드바와 그래프의 공통 BranchMenu에서 Fetch/Pull을 기존 RemoteWorkspace 확인창과 sync IPC로 연결했다. LOCAL upstream·REMOTE ref로 대상을 결정하고, 다른 로컬 브랜치 체크아웃 안내와 미설정/변경 중 상태를 표시한다. 확인창의 대상을 고정하고 툴바 선택과 분리한다. 검증 로그와 화면: docs/branch-context-sync-2026-09-14/RESULTS.md.

### 2026-09-14 — Fetch/Pull 2단 메뉴

공통 ContextMenu를 하위 메뉴 구조로 확장하고 BranchMenu에서 `Fetch / Pull ›` 아래 Fetch/Pull을 배치했다. 기존 실행·검토 흐름과 대상 검증은 유지한다. 검증 로그·화면: docs/branch-sync-submenu-2026-09-14/RESULTS.md.

### 2026-09-15 — Pull 자동 Stash

체크아웃의 자동 보관 처리를 withAutoStash로 공유하여 모든 Pull 진입점에서 미추적 포함 보관 → Fetch/fast-forward → 스테이징 복원 → 성공한 자동 Stash 삭제를 지원한다. 실패·취소·복원 충돌 시 Stash를 유지하며 원래 로컬 상태가 유지된 경우만 자동 복구한다. ignored 파일 덮어쓰기를 막고 외부 변경 감지 및 실제 충돌 화면 전환을 유지한다. 검증: docs/pull-autostash-2026-09-15/RESULTS.md.

## 2026-09-15 작업 폴더 편집과 탐색 정리

- `폴더에서 보기`를 그래프 영역의 작업 폴더 탭으로 연결. 왼쪽 실제 텍스트 편집/저장, 오른쪽 폴더 지연 조회, 닫기/Esc/Cmd·Ctrl+S. 저장소별 미저장 초안과 외부 변경 보호.
- `electron/working-files.cjs`가 authorized IPC로 파일 조회·저장을 처리하고 충돌 편집기의 일반 파일/UTF-8 검사와 Git 공통 쓰기 큐를 재사용. 1 MiB UTF-8 일반 파일 한 개 편집, 디렉터리당 5,000개 한도. 자동완성·LSP·파일 생성/이동/삭제는 이번 범위에 포함하지 않음.
- 상태 새로고침은 아이콘으로 축소. 원격 주소·Upstream 설정은 사이드바에 유지하고 주 보기 탭·설정 화면의 중복 Fetch/Pull/Push 제거.
- 검증 기록: `docs/working-file-editor-2026-09-15/RESULTS.md`.

## 2026-09-15 내 변경 사항의 새 파일 diff·줄 수

새 파일 미리보기를 원문에서 Git no-index patch로 변경하여 CodeDiff의 초록색 추가 행과 통합/좌우 비교를 재사용한다. changeStats IPC가 작업 파일과 스테이징의 numstat를 상태 토큰 기준으로 조회한다. 공통 FileChangeRow/DiffStats로 추가·삭제 줄 수, 계산 불가 상태, 간격과 정렬을 통일했다. 검증 기록은 `docs/working-change-counts-2026-09-15/RESULTS.md` 참조.

## 현재 저장소 프로젝트 현황 · 회사 GitLab PAT (2026-09-15)

- 프로젝트 현황을 상단 활성 저장소 탭과 연결했다. 계정별 저장소 카탈로그/수동 프로젝트 찾기/별도 watchlist 화면은 제거하고 remote 경로로 프로젝트를 직접 조회한다. 다중 원격은 origin 기본 및 선택, 동일 서버 다중 계정은 명시 선택이다. 탭을 바꿔도 현황 화면을 유지하며 이전 대상 응답은 폐기한다.
- GitLab PAT 연결 IPC/마스킹 폼/서버 확인/암호화 저장/재연결을 추가했다. Client ID 없이 HTTPS origin에 연결하고 원격 쓰기는 기본 비활성이다. 서버별 API·외부 링크·실행 전 검토 경로를 계정 호스트에 고정했다. HTTP, 경로 설치, SSH 별칭 자동 해석은 미지원이다.
- 실제 회사망/VPN/사내 인증서/실제 PAT는 검증하지 않았다. 테스트의 호스팅 HTTP 응답과 원격 쓰기는 통제된 제공자 응답이다. 사용자 계정으로 MR 생성·병합·게시를 수행하지 않았다.
- 최종 `pnpm check` 통과: UI 150개(44파일), Node 47개, native/Electron/recovery/Storybook. strict UI audit 0건, DESIGN lint 오류·경고 0건. 처음 발견한 제목 계층 문제는 ActionSummary를 확장해 수정했다. 기존 브랜치 툴팁 대기 1회 시간 초과 후 해당 동작을 변경하지 않은 재검증은 통과했다.
- [검증 결과](./docs/current-project-hosting-2026-09-15/RESULTS.md). 앱 자동 재시작·배포·공개 release는 수행하지 않았다.

## PR/MR 목록·상세 UI 정리 (2026-09-15)

- 공통 ReviewListRow로 제목/번호/작성자/브랜치 방향/초안/상태/업데이트 시각을 정렬했다. 목록의 독립 고정 높이 스크롤을 제거했고 상단 계정 관리·원격 문맥·프로젝트 탐색을 압축했다.
- 공통 ReviewDetailLayout으로 제목/브랜치 방향, 본문·검토 자료, 담당자·리뷰어·서버 병합 상태를 분리했다. ContentTabs underline 변형으로 개요와 실제 API 검토 자료를 전환한다. 좁은 창에서는 메타 패널을 본문 아래로 배치한다.
- HostActions compact 배치는 생성/리뷰 액션의 중첩 카드를 없앤다. 원격 권한과 최신 SHA/버전·최종 확인·단회 실행 보호는 유지했다. 본문은 원문 텍스트와 줄바꿈을 보존하며 HTML을 실행하지 않는다. GitLab UI의 CI/승인 아이콘이나 개수를 추정하지 않는다.
- 최종 `pnpm check` exit 0: UI 151개(45파일), Node 47개, native/Electron/recovery/Storybook 통과. strict UI audit 0건, DESIGN lint 오류·경고 0건. 실제 호스팅 통신은 테스트 응답이며 실제 계정으로 게시하거나 회사 MR을 변경하지 않았다.
- [검증 결과와 화면](./docs/review-ui-2026-09-15/RESULTS.md). 사용자 앱 재시작·릴리스 배포는 수행하지 않았다.

## 변경 파일 우클릭 메뉴 · 2026-09-15

- 내 변경 사항의 작업/스테이징 파일에서 공통 ContextMenu를 우클릭·⋯·Shift+F10으로 연다. 기존 FileChangeRow/Button/Dialog/Notice/CodeDiff를 재사용한다.
- 스테이징/해제, 파일별 Stash, 무시(파일/확장자/폴더), 파일 이력/HEAD Blame, 앱 편집, 기본 프로그램/위치, 경로 복사, 패치 저장, 작업 변경 취소, 휴지통 이동을 연결했다. Stage 실행 경로와 성공 후 선택 해제는 기존 +/− 버튼과 동일하다.
- 승인된 저장소의 변경 파일·일반 파일 경계와 상태 토큰, 공통 Git serial queue를 검증한다. 변경 취소/휴지통은 index 보존, Stash는 다른 staged 파일 보호, ignore는 링크·예외 규칙 확인, patch는 기존 파일 덮어쓰기 금지와 정상 취소를 제공한다.
- 외부 IDE/difftool 지정은 미구현이다. 실제 OS 기본 프로그램·파일 관리자·휴지통 사용은 검증 조건을 [결과 기록](./docs/file-context-menu-2026-09-15/RESULTS.md)에 구분했다. 실제 사용자 저장소·계정과 공개 릴리스는 변경하지 않았다.
- 최종 `pnpm check` 통과: UI 154개(46개 파일), Node 48개, native·전체 Electron·복구·Storybook. 전용 파일 메뉴 검사 및 디자인 감사/문서 lint도 통과했다.

## 파일 diff 툴바 정리 · 2026-09-15

내 변경 사항의 중복 파일명 헤더를 제거하고 기존 InspectorPanel/CodeDiff를 확장해 파일명과 크게 보기 버튼을 한 행에 배치했다. 공통 diff의 읽기 전용 하단 문구를 제거했다. 확대/닫기/Esc 후 보기 상태와 포커스를 유지한다. `pnpm check` 전체 통과(UI 155개·Node 48개), 실제 Electron의 좁은 창 배치·접근성·포커스 복귀도 확인했다. [검증 기록](./docs/diff-toolbar-2026-09-15/RESULTS.md).

## 변경 파일 탐색과 부분 스테이징 · 2026-09-15

작업 파일과 스테이징에 경로 검색·목록/트리 전환·높이 조절을 연결했다. FilePathList 계층을 커밋 파일 목록과 공유하고 파일명/디렉터리를 분리했다. 일반 텍스트 수정의 Git 변경 구간별 스테이징/해제는 `git.mutate` 직렬화와 상태 token, 서버 diff 일치 검증 후 서버 patch만 적용한다. 작업 파일을 덮어쓰지 않으며 새 파일/삭제/이름 변경/바이너리/모드 변경/충돌 작업은 파일 단위 처리를 사용한다. [Git apply](https://git-scm.com/docs/git-apply)의 `--cached`, `--check`, `--reverse`를 사용한다.

`pnpm check` 전체 통과(UI 158개, Git/보안 49개, Electron 전체/복구, Storybook). strict 디자인 검사 오류 0. 검증 근거와 화면은 `docs/change-navigation-2026-09-15/`에 기록했다. 실제 사용자 저장소/호스팅 계정의 쓰기나 앱 배포를 수행한 것이 아니다.

## PR/MR 작업 필터·Markdown 본문 · 2026-09-15

프로젝트 전체에 적용되는 제목·내 직접 검토 요청(GitHub)/리뷰어 배정(GitLab)·담당·작성·7/30일 업데이트 없음 필터를 연결했다. GitHub 추가 검색의 1,000개 제한/불완전 결과를 알리고 30개 PR 상세를 최대 5개씩 보충한다. GitLab은 Self-Managed/PAT를 포함한 기존 계정의 프로젝트 MR 필터를 사용한다. CI 실패 필터는 후속 구현으로 현재 페이지의 Head 검사/상태(GitHub) 또는 head_pipeline(GitLab)을 추가 조회한다. 원본 페이지 이동과 미확인 건수를 유지하며 프로젝트 전체 실패 합계는 제공하지 않는다.

PR/MR 본문·댓글/논의는 공통 MarkdownContent로 제목·강조·목록·체크 항목·표·코드를 표시하고 원문으로 전환한다. HTML/원격 이미지 실행 없이 호스팅 링크를 기존 IPC 경계에서 연다. react-markdown 10.1.0, remark-gfm 4.0.1을 추가했다. 미지원 GitLab 전용 문법과 외부 리소스는 제공자에서 확인한다. 검증 기록은 docs/review-workflow-2026-09-15/다.

### CI 실패 필터 검증 · 2026-09-15

`pnpm check` 통과(UI 166개, Git/호스팅 52개, native/Electron/복구 회귀 및 빌드). GitLab 목록에 diff_refs가 없는 경우 상세에서 Head/pipeline을 확인한다. 검사 페이지 이동, 취소/과거 SHA 제외, 권한 오류·미확인 상태, 필터 초기화 및 좁은 화면을 통제된 API로 검증했다. 실제 계정 검증은 남아 있다. 근거: [CI 실패 필터 검증](docs/ci-failure-filter-2026-09-15/README.md).

### DMG / Windows 설치 EXE · 2026-09-15

`electron-builder@26.15.3`으로 실행 번들·macOS DMG·Windows NSIS EXE를 같은 staging 규칙으로 생성한다. `pnpm package:desktop`, `pnpm package:mac`, `pnpm package:win`과 `--arch arm64/x64`를 지원한다. 기존 앱 ID를 유지하며 인증서 서명과 게시를 명시적으로 끈 로컬 설치 빌드다. 기존 마크에서 설치 아이콘을 재사용했다.

macOS arm64 DMG와 Windows x64 EXE 생성, frozen-lockfile 설치·lint·renderer 빌드, macOS 패키지 전체 Electron 회귀, DMG 무결성/마운트/내용 일치를 확인했다. Windows 실제 설치·실행과 배포 서명·공증은 남아 있다. [빌드 안내](BUILD.md), [검증 결과](docs/desktop-installers-2026-09-15/RESULTS.md).
