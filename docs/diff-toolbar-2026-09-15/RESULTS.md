# 파일 diff 툴바 정리 · 2026-09-15

- InspectorPanel의 integratedToolbar와 CodeDiff의 actions 조합으로 파일명·줄 수·크게 보기 버튼을 한 행에 표시한다. 내 변경 사항의 별도 제목 헤더를 제거했다.
- 확대창은 ‘파일 변경 크게 보기’라는 제목을 사용하고 파일명은 diff 툴바에 한 번만 표시한다. 같은 포털 콘텐츠를 이동하므로 보기 상태를 유지하며 닫기/Esc 후 확대 버튼으로 포커스를 복원한다.
- 공통 CodeDiff 하단의 반복적인 읽기 전용 문구와 미사용 스타일을 제거했다. 바이너리·불완전 diff 등 실제 상태 안내는 유지한다.

검증:

- `pnpm check` 종료 코드 0: UI 155개/46개 파일, Node 48개, native·전체 Electron·복구 검사·Storybook 빌드 통과 (`check.log`).
- 전용 Electron 검사 종료 코드 0: 중복 제목 없음, footer 없음, 실제 Esc와 포커스 복귀, 줄바꿈 상태 유지, 760px에서 파일명/확대 버튼 같은 행, 접근성 확인 (`focused-check.log`).
- 실제 임시 저장소의 1440px/760px 실행 화면을 `working-changes.png`, `working-changes-narrow.png`로 기록하고 육안 확인했다.
- 엄격 디자인 감사 및 DESIGN lint 오류·경고 0.
- 첫 시도는 Storybook 합성 Escape가 네이티브 dialog를 닫지 않는 테스트 문제와 기존 Review 포커스 검사 실패로 중단됐다. Storybook은 닫기 버튼을 검증하고 실제 Escape는 Electron에서 검증하도록 정리했다. 기존 Review 코드는 수정하지 않았으며 최종 전체 검사에서 통과했다 (`first-attempt.log`).

사용자 저장소와 실행 중인 앱은 변경하지 않았고 공개 릴리스/설치 번들 검증은 수행하지 않았다.
