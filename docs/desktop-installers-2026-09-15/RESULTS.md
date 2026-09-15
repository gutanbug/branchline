# 설치 파일 빌드 검증 · 2026-09-15

- macOS arm64 DMG 생성 성공: `pnpm package:mac`.
- Windows x64 NSIS 설치 EXE 교차 생성 성공: `pnpm package:win` (macOS arm64 호스트).
- `pnpm install --frozen-lockfile`, ESLint, TypeScript/Vite 빌드 통과.
- 새 macOS 패키지를 임시 사용자 프로필·저장소로 실행하여 전체 `scripts/check-desktop.mjs` 통과. Git 쓰기·원격·OAuth/호스팅·MCP·Agent fixture·키보드·최소 창·재시작을 포함한다. 실제 사용자 저장소/계정은 변경하지 않았다.
- DMG hdiutil checksum 검증과 읽기 전용 마운트 확인: 앱 ID/버전, Applications 바로가기, 실행 검증한 번들과 app.asar SHA-256 일치.
- macOS/Windows app.asar에는 dist/와 운영 electron/, 최소 package.json만 포함(23개 항목). 개발 node_modules, 테스트, docs, src, .env 제외 확인.
- Windows 설치 EXE는 NSIS PE32 self-extracting archive, 포함 앱은 PE32+ x86-64. Authenticode 서명 디렉터리 크기는 0이다. 빌더의 signing 로그는 사용자 정의 무서명 단계이며 실제 인증서 서명을 뜻하지 않는다.
- --mac/--win 동시 지정과 미지원 ia32를 빌드 시작 전에 거부하는 것 확인.

Windows 실제 설치/실행, macOS Intel/Windows ARM64 실행, Developer ID/Windows 인증서 서명, macOS 공증, 자동 업데이트, 공개 게시/CI 실행은 하지 않았다. 기존 renderer 500kB 청크 경고는 남아 있다.

명령·설치 방법: [BUILD.md](../../BUILD.md).

산출물 SHA-256(현재 빌드):

```text
7823c4ffaa5da98394678bfb16a44645fde40a80971436bfcbe71c808ece0dd7  Branchline-0.1.0-mac-arm64.dmg
db35ef331cfed81738eb91ae641028cc4dfdb55823030aa617f948c50209073d  Branchline-0.1.0-win-x64-setup.exe
```
