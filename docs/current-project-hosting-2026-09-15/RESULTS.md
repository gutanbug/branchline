# 현재 저장소의 PR/MR · GitLab PAT 검증

## 변경

- `DesktopApp` 활성 탭을 `HostingWorkspace`로 전달한다. 현황에서 탭을 전환하면 해당 저장소의 프로젝트를 직접 조회한다.
- remote의 실제 호스트/경로를 사용한다. GitHub와 GitLab subgroup, SSH/scp/HTTPS를 처리하고 다른 서버의 계정을 자동 대입하지 않는다. 다중 원격과 같은 서버 다중 계정만 선택 UI를 제공한다.
- GitLab PAT는 명시한 HTTPS 서버에만 전송한다. 사용자 API 확인, 선택적 OS 암호화 저장, 만료/401 재연결, 읽기 전용 기본값, 기존 원격 쓰기 확인 흐름을 유지한다. Client ID는 필요 없다.
- 공통 ActionSummary/SelectField/Notice/Dialog/TextField/Checkbox/Button과 기존 리뷰·CI 컴포넌트를 재사용한다. 새 페이지 패턴과 URL 매칭을 Storybook에서 검증한다.

## 실제 실행 결과

- `pnpm check`: exit 0. UI 150개/44파일, Node 47개, native, Electron E2E, recovery, Storybook 빌드 통과.
- Electron: 현재 프로젝트 직접 조회(계정 카탈로그 요청 없음), 상단 탭 전환, 회사 GitLab PAT 폼/마스킹, API MR/CI, 계정 해제, 늦은 이전 응답 폐기, 원격 작업안·SHA 보호, 기존 상세 유지, 좁은 화면과 접근성 검증.
- Node: PAT HTTPS origin 검증, 잘못된 주소/토큰 거부, 서버 격리, 암호화 저장/복원, subgroup MR 조회, 쓰기 비활성, 401 재연결, 연결 실패 시 기존 계정 유지, 연결 해제 검증.
- strict UI audit: 오류/경고/위반 0. DESIGN lint: 오류/경고 0.
- 제목 계층 오류는 공통 컴포넌트 headingLevel 지원으로 수정했다. 첫 전체 실행의 기존 브랜치 tooltip 대기 시간 초과는 기록을 보존했고 다음 전체 실행에서 통과했다. renderer 500kB 초과 경고는 기존과 동일하게 남아 있다.

## 증거

- [전체 로그](./check.log)
- [현재 프로젝트 화면](./current-project.png)
- [회사 GitLab PAT 연결](./gitlab-pat.png)
- [좁은 화면](./desktop-hosting-narrow.png)
- [정적 UI 검사](./design-audit.json)
- [DESIGN 검사](./design-lint.log)
- [제목 단계 수정 전 검사](./heading-check.log)
- [툴팁 시간 초과 실행](./tooltip-attempt.log)

## 조건

호스팅 HTTP는 테스트 응답이며 실제 회사 서버/PAT는 사용하지 않았다. 사용자 계정의 원격 MR·댓글·병합·CI 작업을 실행하지 않았다. 회사망/VPN과 신뢰된 HTTPS 인증서가 필요하다. HTTP·경로 아래 설치된 GitLab·SSH Host 별칭에서 웹 호스트 자동 추론은 미지원이다. HTTPS 사용자 지정 포트는 동일한 HTTPS remote 포트로 매칭한다. 앱 재시작과 배포는 수행하지 않았다.
