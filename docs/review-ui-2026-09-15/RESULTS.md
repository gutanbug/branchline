# PR/MR UI 개선 검증

## 구현과 확인

- `ReviewListRow`: 재사용 가능한 제목 중심 행. 긴 제목 줄바꿈, 브랜치 전체 title, GitHub #/GitLab ! 번호, 작성자, 실제 상태/초안, 업데이트 시각.
- `ReviewDetailLayout`: 제목·상태·병합 방향, 가운데 본문/검토 자료, 오른쪽 담당자·리뷰어·병합 상태/Head/조회 계정. 좁은 화면에서는 메타 정보를 본문 아래로 이동.
- 기존 ContentTabs를 underline 변형으로 확장했다. 개요와 파일/대화/승인/검사를 키보드로 전환한다. 기존 그래프/파일 탭의 기본 변형은 유지한다.
- 계정 관리는 제목 옆 Disclosure, 다중 원격은 문맥 행, 원격 헤더와 PR/MR·CI 탐색은 한 줄로 정리했다. 목록은 페이지 스크롤을 사용하며 불필요한 중첩 카드/내부 스크롤을 제거했다.
- 실제 데이터가 없는 CI/승인 숫자나 이미지는 생성하지 않는다. 본문은 원문 텍스트/줄바꿈을 보존하며 HTML 실행이나 외부 이미지 자동 로드는 없다.

## 실행 결과

최종 `pnpm check`: exit 0. UI 151개/45파일, Node 47개, native/Electron/recovery/Storybook 통과.

새 Storybook 패턴은 목록 클릭, 상세 정보, underline 탭의 방향키/포커스, 목록 복귀와 긴 이름을 검증한다. Electron 검사는 PR/MR 생성·댓글·리뷰·버전 변경·병합 검토·파일 diff·검사 탭·페이지·목록 복귀 포커스·다중 프로젝트·PAT·권한·반응형/접근성 흐름을 실행했다. 테스트 호스팅 응답과 임시 저장소를 사용했으며 사용자 MR/계정 원격 쓰기는 실행하지 않았다.

strict UI audit 위반/오류/경고 0건. DESIGN lint 오류/경고 0건. 최초 검사에서 접힌 부연 설명의 가시성을 기대하던 테스트가 실패했고, Disclosure를 열어 내용을 검증하도록 수정했다. 첫 전체 통과 이후 화면을 확인해 상단 배치를 한 번 더 정리했으며 최종 전체 검사도 통과했다. 기존 renderer/Storybook chunk 크기 경고는 남아 있다.

## 화면과 로그

- [PR 목록](./current-project.png)
- [MR 개요](./mr-overview.png)
- [좁은 창의 MR](./mr-overview-narrow.png)
- [리뷰 파일 비교](./desktop-review-files.png)
- [전체 검사 로그](./check.log)
- [첫 전체 통과 로그](./first-pass.log)
- [Disclosure 테스트 갱신 전](./disclosure-attempt.log)
- [정적 UI 검사](./design-audit.json)
- [디자인 문서 검사](./design-lint.log)

앱 자동 재시작·설치 번들·공개 배포는 수행하지 않았다.
