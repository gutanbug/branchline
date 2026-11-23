# 대규모 브랜치 그래프 조회 · 2026-09-15

## 원인과 변경

전체 ref의 커밋 SHA를 각각 프로세스 인자로 전달하면서 OS 명령줄 길이 제한에 걸리는 경로가 있었다. 로드한 시작점 배열을 다음 페이지에 전달할 때 4,096개를 초과하면 거부하는 별도 결함도 있었다.

`electron/git.cjs`의 공통 실행기에 표준 입력 지원을 추가하고 history/compare에서 `git log --stdin`으로 조회 기준을 전달한다. 쉘 문자열을 사용하지 않는다. history는 SHA 40/64자리 검증을 유지하며 초기/연속 조회의 IPC 시작점 배열을 100,000개로 제한한다. 이는 커밋 표시 개수 제한이 아니라 저장소 조회 시작점 개수 제한이다.

## 재현과 검증

임시 Git 저장소의 30,000개 서로 다른 원격 ref와 연결된 커밋을 `git fast-import`로 생성했다. 실제 사용자 저장소는 변경하지 않았다.

- 수정 전 macOS: `spawn E2BIG` 재현. 현재 호스트 ARG_MAX는 1,048,576바이트였다.
- 수정 후: 첫 페이지/연속 페이지가 Git rev-list의 커밋 집합/순서와 일치.
- ref가 이동한 뒤에도 기존 조회 시작점 기준의 결과 유지.
- 오래된 제목 검색과 대괄호를 포함한 literal 파일 경로 조회.
- 개행/옵션을 끼워 넣은 SHA 입력 거부, Git 조기 종료의 stderr와 stdin 오류 처리.

검증 명령:

```sh
pnpm test:git
node --test --test-name-pattern='large ref sets' electron/git.test.cjs
pnpm lint
node scripts/check-desktop.mjs
```

Windows 실기기 실행, 수정 설치 파일 재빌드/게시, 현재 사용자 앱 재시작은 수행하지 않았다. 이미 게시한 v0.1.0과 작업 트리의 수정 코드를 구분한다.

근거: [Git log --stdin](https://git-scm.com/docs/git-log#Documentation/git-log.txt---stdin), [Node execFile](https://nodejs.org/api/child_process.html#child_processexecfilefile-args-options-callback).

최종 결과: Git/호스팅 Node 테스트 53개 통과, 조기 Git 종료/EPIPE 검사를 포함한 대규모 ref 테스트 재실행 통과, ESLint·git diff --check·전체 Electron 회귀 통과.
