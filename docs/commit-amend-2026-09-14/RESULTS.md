# 커밋 메시지 카드와 Amend 검증 — 2026-09-14

## 반영

- CommitGraph의 날짜를 로컬 시간대 날짜·24시간 시:분으로 표시한다. 원본 ISO 시각은 time 속성/툴팁에 유지한다.
- 공통 CommitMessage/CommitMetadata를 DiffFileList·CodeDiff에서 재사용한다. 제목/본문을 분리하고 작성자·작성 시각·커미터·반영 시각·SHA는 접을 수 있는 메타데이터로 표시한다.
- 현재 로컬 브랜치 HEAD의 커밋 상세(확대 포함)와 내 변경 사항에서 Amend를 제공한다. 편집 → 검토 → 실행, 스테이징 포함 선택, 원격 추적 ref 기준 공유 SHA 확인, stale 상태 및 hook 실패 복구를 지원한다.
- Claude/Codex/Gemini의 기존 Agent 대화 경로로 메시지를 제안받고 명시적으로 편집기에 적용한다. 기존 CLI 인증과 도구 비활성 실행을 재사용한다. AI는 Git 명령을 실행하지 않는다.

## 검증 결과

`pnpm check` exit 0: UI 140개/40파일, Node 38개, native UI, Electron IPC/E2E, 초안 복구, 접근성, Storybook build 전체 통과. UI audit의 공통 TextArea resize 규칙 명시 후 최종 lint/renderer build도 확인했다. Premium strict와 DESIGN lint는 오류·경고 0개다. 기존 renderer/Storybook 번들 크기 경고는 남아 있다.

실제 임시 Git 저장소에서 root 및 일반 커밋의 메시지만 수정, 스테이징 포함, index·작업 파일·미추적 파일·부모 관계·작성자 보존, 원격 ref 불변, stale token 차단, 공유 커밋 확인, detached HEAD 거부와 pre-commit hook 실패를 검증했다.

실제 Electron에서 시·분/카드, 확대 상세 내 Amend, 중첩 모달 Esc, 한글 IME, Agent 잘못된 응답 후 요청 보존, 제안과 Git 실행 분리, 최신 상태 재검토와 초안 유지, 760×580 최소 화면 접근성을 확인했다. 기존 그래프·파일 탭·Stash·비교·체크아웃·호스팅 흐름 회귀도 통과했다.

AI는 제어된 가짜 CLI 실행 파일로 세 어댑터와 IPC를 검증했다. 실제 Agent 계정의 모델 응답 품질·사용량·과금 호출, 실제 호스팅 원격 Push, 앱 설치 번들/서명/release 및 사용자 앱 재시작은 이번 검증에 포함하지 않는다.

단독 smoke의 기능 검증은 통과했으나 종료 직후 임시 프로필 삭제가 ENOTEMPTY로 한 번 실패했다. 재시도가 있는 정식 `pnpm check`의 같은 테스트와 정리는 모두 통과했다.

## 증거

- [전체 검증 로그](./check.log)
- [최종 renderer 빌드](./final-build.log)
- [Premium strict](./design-audit.log), [DESIGN lint](./design-lint.log)
- [커밋 상세 카드](./commit-message-card.png)
- [Amend 검토](./amend-review.png), [최소 창 크기](./amend-review-narrow.png)
