# 데스크톱 설치 파일 빌드

Electron 44.3.0 / electron-builder 26.15.3을 사용한다. Node.js 22.15 이상과 pnpm 12.4.1 기준으로 검증했다. 버전은 `package.json`, 정확한 의존성은 `pnpm-lock.yaml`이 기준이다.

```sh
pnpm install --frozen-lockfile
```

| 목적 | 명령 | 출력 |
| --- | --- | --- |
| macOS 현재 CPU DMG | `pnpm package:mac` | `release/Branchline-<version>-mac-<arch>.dmg` |
| macOS Apple Silicon | `pnpm package:mac --arch arm64` | 위 이름의 `arm64.dmg` |
| macOS Intel | `pnpm package:mac --arch x64` | 위 이름의 `x64.dmg` |
| Windows x64 설치 EXE | `pnpm package:win` | `release/Branchline-<version>-win-x64-setup.exe` |
| Windows ARM64 설치 EXE | `pnpm package:win --arch arm64` | 위 이름의 `arm64-setup.exe` (실행 미검증) |
| 현재 OS/CPU 실행 번들 | `pnpm package:desktop` | `release/mac-arm64`, `release/mac` 또는 `release/win-unpacked` 등 |

각 명령은 TypeScript/Vite 빌드를 먼저 실행한다. macOS DMG는 Mac에서 빌드한다. Windows는 Windows에서 같은 명령을 실행하는 것이 검증 기준이다. 현재 Mac에서 x64 EXE 교차 생성도 확인했지만 Windows 설치/실행 성공을 의미하지 않는다. 플랫폼 도구와 Electron은 최초 빌드 시 다운로드되므로 네트워크와 충분한 디스크 공간이 필요하다.

## 설치와 포함 파일

- DMG: `Branchline.app`을 Applications로 드래그한다.
- EXE: NSIS 설치 마법사에서 설치 폴더를 선택한다. 현재 사용자 범위 설치이며 완료 후 자동 실행하지 않는다. 제거 시 앱 사용자 데이터는 유지한다.
- 실행에는 Git이 별도 설치되어 있어야 한다. Claude/Codex/Gemini CLI는 해당 기능을 사용할 때 사용자가 별도 설치/인증한다.
- 임시 staging 폴더에 Vite `dist/`, 운영 `electron/`, 최소 `package.json`만 복사한다. 테스트, 개발 의존성, 개인 저장소, 사용자 설정/로그인 세션은 포함하지 않는다.
- `build/icon.svg`는 기존 `branchline-mark.svg`를 재사용한 설치용 마크다. 빌더가 macOS/Windows 아이콘으로 변환한다.
- `scripts/package-desktop.mjs`가 ID(`dev.branchline.desktop`), 파일 범위, 대상, 설치 옵션을 소유한다. 앱 버전 변경은 루트 `package.json`에서 한다. `dist/`와 `release/`는 생성물이다.

## 검증과 배포 상태

```sh
pnpm lint
# 생성된 macOS ARM64 실행 번들의 전체 Electron 회귀 검사:
BRANCHLINE_EXECUTABLE="$PWD/release/mac-arm64/Branchline.app/Contents/MacOS/Branchline" node scripts/check-desktop.mjs
hdiutil verify release/Branchline-0.1.0-mac-arm64.dmg
```

Windows 검증은 Windows 시험 환경에서 EXE 설치/시작/제거, Git 탐지, 공백·한글 경로, 저장소 열기, 호스팅 인증, Agent 탐지를 확인한다. macOS Intel/Windows ARM64는 빌드 타깃을 제공하지만 이번 실제 실행 검증 대상은 아니다.

이 명령은 개발자 인증서 서명·macOS 공증·공개 게시를 하지 않는다. `publish: never`로 배포 업로드를 금지한다. 배포 인증서를 사용하려면 현재 명시적인 무서명 설정(mac.identity: null, win.signtoolOptions.sign)을 서명 설정으로 교체하고 별도 검증해야 한다. 인증서 없이 받은 설치 파일에는 Gatekeeper/SmartScreen 경고가 나타날 수 있다. OS 보안 설정을 끄는 절차는 포함하지 않는다. 자동 업데이트는 아직 연결하지 않았다.

공식 문서: [다중 플랫폼 빌드](https://www.electron.build/v26/docs/features/multi-platform-build/), [DMG](https://www.electron.build/v26/docs/dmg/), [NSIS](https://www.electron.build/v26/docs/nsis/), [아이콘](https://www.electron.build/v26/docs/features/icons-and-images/).
