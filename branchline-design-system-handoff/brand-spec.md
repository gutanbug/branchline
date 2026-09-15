# Branchline 디자인 기준

선택 방향: `tech-utility`. 흰색·밝은 회색 작업 배경, 흰 표면, 검정 텍스트, 검정색 적용 버튼과 커밋 레인으로 구성합니다.

```css
:root {
  --bg:      #fafafa;
  --surface: #ffffff;
  --fg:      #000000;
  --muted:   #666666;
  --border:  #e5e5e5;
  --accent:  #000000;
  --font-display: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-body:    -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'IBM Plex Mono', ui-monospace, Menlo, monospace;
}
```

- 데이터 밀도가 높은 도구이므로 선택 방향의 단일 sans 계열 예외를 적용합니다. 해시·ref·수치는 mono입니다.
- 시드의 표·변경 이력 구조를 탐색/작업/상세 3열로 구성합니다. 화면이 좁아지면 상세 패널을 아래로 내립니다.
- 주요 시각 표현은 부모 관계를 나타내는 커밋 그래프 하나입니다. 장식용 이미지와 그라데이션을 추가하지 않습니다.
- 강조색은 그래프의 한 레인과 핵심 적용 동작에 사용합니다. 주요 버튼은 검정 배경과 흰 글자로 대비를 확보합니다.
- 한국어 UI, 명시적인 예제 데이터 표기, 키보드 포커스, 빈 결과 상태를 유지합니다.
