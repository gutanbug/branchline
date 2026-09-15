# CI 실패 필터 · 2026-09-15

프로젝트 현황 → PR/MR 검토 → CI 결과에서 ‘CI 실패만 · 현재 Head’를 선택한다. 기존 상태·역할·기간·제목 검색과 함께 사용할 수 있다. 기본 목록은 CI를 추가 조회하지 않는다.

현재 원본 페이지(최대 30개)의 리뷰를 확인하며 다음/이전 페이지 이동을 유지한다. 결과 수는 확인/실패/미확인을 구분한다. 프로젝트 전체 실패 건수는 아니다. GitHub는 Head의 latest Checks와 Commit Status, GitLab은 MR 상세의 Head와 일치하는 head_pipeline을 사용한다. 취소·대기·과거/테스트 병합 결과를 실패로 오인하지 않는다. 검사 미등록·권한/조회 오류·Head 변경·리소스당 300개 상한 초과는 미확인으로 알린다.

검증 항목:

- GitHub 추가 검사 페이지 실패, Commit Status error, 취소 제외, 과거 SHA, Head 변경, 권한 거절, 빈 검사, 상한 초과, 빈 실패 페이지의 다음 페이지 유지.
- GitLab 목록에 diff_refs가 없는 경우 MR 상세 조회, Head 실패/성공/취소/대기/과거 SHA/미등록 구분.
- 공통 SelectField 선택·초기화, 기존 제목 검색/IME, Electron 실제 renderer→preload→main 필터 연결, 오류 복구, 800px 화면과 접근성.
- 테스트는 임시 저장소와 통제된 제공자 API 응답을 사용한다. 실제 GitHub/회사 GitLab 계정으로 검증하지 않았다.

검증 로그: [전체 검사](check.log), [리뷰 API 검사](reviews-check.log), [디자인 검사](design-audit.json), [DESIGN.md 검사](design-lint.log).

검증 결과: `pnpm check` 통과(UI 166개, Git/호스팅 52개, native/Electron/복구 회귀, renderer/Storybook 빌드). strict 디자인 검사와 DESIGN.md lint는 오류 0건이다. Electron 스크린샷으로 기본 너비와 800px 화면을 확인했다. 최초 E2E 선택자 오류는 combobox 접근성 이름으로 수정하고 전체 검사를 재실행했다.

화면: [실패 목록](ci-failure-filter.png), [좁은 화면의 미확인 안내](ci-failure-filter-narrow.png).
