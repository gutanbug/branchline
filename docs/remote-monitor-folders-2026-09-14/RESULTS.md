# 원격 커밋 모니터링과 사이드바 폴더

- 열린 저장소의 원격을 60초마다 자동 Fetch한다. 같은 Git 저장소의 worktree는 하나의 cooldown과 쓰기 queue를 공유한다. 자동 Pull·Push·prune은 실행하지 않는다.
- LOCAL의 각 브랜치에 upstream 대비 받을/보낼 커밋 수를 표시한다. 중앙 Fetch·Pull은 Pull 대기 수, Push는 보낼 수를 표시한다. 추적 대상이 없거나 대상 원격/브랜치가 다르면 확인 불가(—)이며, Fetch 배지는 서버의 아직 조회하지 않은 변경 개수가 아니다.
- 연결 실패는 마지막으로 가져온 이력 기준임을 안내하고 다음 주기에 다시 확인한다. 기존 Git credential helper/SSH 인증을 재사용하며 호스팅 OAuth API와 별개다.
- LOCAL·ORIGIN 등 원격 그룹의 하위 폴더는 선택한 브랜치 경로만 기본으로 펼친다. 선택이 없으면 현재 checkout 경로를 연다. 그룹별 전체 펼치기/접기 아이콘과 한국어 접근성 이름을 제공한다. 검색 결과 경로는 자동으로 펼친다.
- 공통 Badge를 조합한 SyncBadge와 기존 GitToolbar·BranchTree·Disclosure·Button을 사용한다. 변경 없는 자동 확인은 기존 그래프 데이터를 유지하며 폴더 수동 상태도 보존한다.

최종 `pnpm check` 종료 코드 0: lint, renderer build, UI 135개/39파일, native, Node 37개, 전체 Electron E2E, 초안 복원, Storybook build를 통과했다. premium 정적 검사와 DESIGN lint는 오류·경고 0이다. 기존 Vite 500KB 청크 경고는 유지한다. 임시 bare 원격과 복제본에서 원격 추가 커밋, 로컬 분기, cooldown, Worktree 공유, 연결 실패/복구, 원본 파일·HEAD 보존을 검증했다. Electron의 실제 60초 타이머는 통제된 시계를 사용해 확인했다. 실제 GitHub/GitLab 계정의 인증이나 사용자 저장소는 테스트 목적으로 변경하지 않았다.

- [일반 창](./remote-monitor.png)
- [최소 창](./remote-monitor-narrow.png)
- [공통 툴바](./toolbar-story.png)
- [전체 검사 로그](./check.log)

사용자 앱은 자동 재시작하지 않았다.
