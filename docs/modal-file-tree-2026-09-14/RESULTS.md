# 확대 상세 내부 diff와 변경 파일 트리

- 확대 상세에서 파일 선택 시 모달 내부 CodeDiff를 표시한다. 외부 파일 탭은 생성하지 않는다.
- 변경 파일 목록 버튼으로 돌아오면 트리 모드·폴더 펼침·파일 버튼 포커스를 유지한다. 닫기/Esc는 모달만 닫고 선택 커밋을 유지한다.
- 일반 상세의 파일 선택은 기존 그래프 영역 파일 탭을 연다.
- 공통 DiffFileList에 목록/트리 표시 전환을 제공한다. 폴더는 Disclosure, 파일은 기존 Button/Badge로 표시한다. 같은 파일명도 전체 경로와 diff 인덱스로 구분한다.
- 공통 DiffFileBrowser를 공개하고 Storybook에 inline/expanded/narrow 예와 상호작용 검사를 추가했다.

## 검증

최종 `pnpm check` 종료 코드 0: lint, renderer build, UI 129개/39파일, native, Node 36개, 전체 Electron E2E, 초안 복원, Storybook build 통과. premium 정적 검사와 DESIGN lint는 오류/경고 0. 기존 Vite 청크 크기 경고는 유지한다.

실제 임시 Git 저장소에서 동일 파일명·한글 하위 폴더, Enter로 폴더 접기/펼치기, 모달 내부 diff, 목록 복귀 포커스, Esc 종료, 최소 760×580, 접근성, 기존 일반 파일 탭과 스크롤 복원을 검증했다. 실제 사용자 저장소·계정에 테스트 변경을 하지 않았다.

- [확대 diff](./expanded-file-diff.png)
- [좁은 모달 diff](./expanded-file-narrow.png)
- [트리 목록](./expanded-file-tree.png)
- [전체 검사 로그](./check.log)

사용자 앱은 자동 재시작하지 않았다.
