# Snake Game - Phaser 3

> Last updated: 2025-11-20 (테스트 수정)
> Second test: 2025-11-20 (두번째 테스트)

## 프로젝트 개요
Phaser 3 기반 Snake 게임. 스테이지 시스템, 콤보, 아이템, 데드존 등 다양한 기능이 포함된 클래식 게임.

## 파일 구조
```
/Users/imjunseob/my-phaser-game/
├── src/
│   ├── main.js              # Phaser 게임 설정 (pixelArt: true)
│   └── scenes/
│       └── SnakeGame.js     # 메인 게임 로직 (~2400 lines)
├── public/
│   └── assets/
│       ├── bgm/             # 배경음악 (snake_bgm.mp3)
│       ├── sfx/             # 효과음 (moving.mp3, eating.mp3)
│       ├── items/           # 아이템 이미지
│       └── sprite/          # 스프라이트 (bubble.png 등)
└── CLAUDE.md               # 이 파일
```

---

## 게임 시스템

### 기본 설정
- **그리드**: 40x27 (cols x rows)
- **gridSize**: 20px
- **UI 영역**: 상단 60px
- **초기 속도**: 130ms (점점 빨라짐)

### 스테이지 시스템
- 각 스테이지: 25개 먹이 클리어
- 스테이지 클리어 시: 뱀 점프 애니메이션 → "STAGE CLEAR" → 카운트다운 → 다음 스테이지
- 최대 스테이지: 100

---

## 구현된 기능

### 1. 콤보 시스템
- **조건**: 방향전환 3번 이내에 먹이 먹으면 콤보 유지
- **점수 공식**: `10 × (1 + (콤보-1) × 0.5)`
  - 콤보 1: 10점
  - 콤보 10: 55점
  - 콤보 75: 380점
- Stage 3 올콤보 시 총점: **14,625점**

### 2. 말풍선 시스템
- 먹이가 벽에 붙어 생성되면 말풍선 표시
- 메시지: "Oops!", "Sorry!", "My bad!", "Whoops!", "Uh-oh!"
- 페이드인/아웃 애니메이션

### 3. 십자가 후레쉬 효과 (6~15번째 먹이)
- 먹이 위치에서 십자가 모양 라인 깜빡임
- 먹이 위치 강조 효과

### 4. 아이템 시스템 (10번째 먹이 이후)
- 10번째 먹이 먹으면 아이템 시스템 활성화
- 랜덤 위치에 아이템 생성
- 아이템 종류별 효과 (속도, 점수 등)

### 5. 텔레포트 시스템 (21~24번째 먹이)
- **Stage 1**: 각 먹이당 1번 텔레포트
- **Stage 2+**: 각 먹이당 2번 연속 텔레포트
- 1~5 스텝 랜덤 대기 후 텔레포트
- 사라지는 파티클 → 나타나는 파티클 애니메이션

### 6. 데드존 시스템 (Stage 3+)

#### Stage 3 - 10번째 먹이
1. 10번째 먹이는 중앙 부근(±5칸)에 생성
2. 10번째 먹이 먹으면:
   - 게임 일시정지
   - 랜덤 위치 깜빡임 (검은색 타일, 10번)
   - "THIS WILL KILL YOU!" 타이핑 효과
   - 3-2-1-GO 카운트다운
   - 게임 재개

#### Stage 4 - 시작 시
1. 스테이지 시작하면:
   - 게임 일시정지
   - 2개 위치 동시 깜빡임
   - "THIS TOO SHALL KILL YOU!" 메시지
   - 3-2-1-GO 카운트다운
   - 게임 재개

#### 데드존 규칙
- 뱀/먹이와 겹치지 않음
- 기존 데드존과 맨해튼 거리 5칸 이상
- 뱀의 진행방향 바로 앞에 생성 안됨
- 닿으면 즉시 게임 오버
- 다음 스테이지에도 유지

### 7. 25번째 먹이
- 색상: 초록색 (뱀 머리색과 동일)
- 스테이지 클리어 직전 시각적 표시

---

## 주요 변수

### 게임 상태
```javascript
this.snake = [{x, y}, ...]     // 뱀 세그먼트 배열
this.food = {x, y}              // 먹이 위치
this.direction = 'RIGHT'        // 현재 방향
this.inputQueue = []            // 입력 큐 (최대 2개)
this.gameOver = false           // 게임 오버 상태
```

### 점수/스테이지
```javascript
this.score = 0                  // 현재 점수
this.foodCount = 0              // 먹은 먹이 개수
this.currentStage = 1           // 현재 스테이지
this.combo = 0                  // 현재 콤보
this.maxCombo = 0               // 최대 콤보
```

### 시스템 플래그
```javascript
this.deadZones = []                    // 데드존 배열 [{x, y, rect}]
this.foodTeleportEnabled = false       // 텔레포트 활성화
this.currentFoodTeleportCount = 0      // 현재 먹이 텔레포트 횟수
this.nextTeleportStep = 0              // 다음 텔레포트까지 스텝
```

---

## 주요 함수

### 게임 루프
- `moveSnake()` - 뱀 이동, 충돌 체크, 먹이 먹기
- `draw()` - 뱀과 먹이 렌더링
- `generateFood()` - 새 먹이 위치 생성

### 데드존
- `startDeadZoneSequence()` - Stage 3 데드존 생성
- `addDeadZonesForStage4()` - Stage 4 데드존 2개 추가
- `showDeadZoneWarning()` - 경고 메시지 표시
- `startCountdownAndResume()` - 카운트다운 후 재개

### 텔레포트
- `teleportFood()` - 먹이 텔레포트 애니메이션

### 스테이지
- `clearStage()` - 스테이지 클리어 처리
- `showNextStage()` - 다음 스테이지 표시
- `resetStage()` - 스테이지 리셋

### 효과
- `playFoodEffect()` - 먹이 먹을 때 효과
- `createFoodParticles()` - 파티클 효과
- `showComboEffect()` - 콤보 효과

---

## 스테이지별 특징

| Stage | 속도 | 데드존 | 텔레포트 | 특이사항 |
|-------|------|--------|----------|----------|
| 1 | 130ms | 없음 | 1회 | 기본 |
| 2 | 더 빠름 | 없음 | 2회 | 텔레포트 강화 |
| 3 | 더 빠름 | 1개 | 2회 | 10번째 먹이 시 데드존 |
| 4+ | 더 빠름 | +2개 | 2회 | 스테이지 시작 시 데드존 추가 |

---

## 점수 계산

### 기본 점수
```javascript
const comboMultiplier = 1 + (combo - 1) * 0.5;
const earnedScore = Math.floor(10 * comboMultiplier);
```

### 예시 (Stage 3 올콤보)
- 75개 먹이 × 콤보 배율
- 총점: 14,625점
- 마지막 먹이: 380점

---

## 개발 참고

### Phaser 설정
- `pixelArt: true` (main.js)
- 해상도: 800x600 (조정 가능)

### 사운드
- BGM: `assets/bgm/snake_bgm.mp3`
- 이동: `assets/sfx/moving.mp3`
- 먹기: `assets/sfx/eating.mp3`

### 향후 추가 예정
- 스프라이트 애니메이션 (뱀 머리)
- 추가 아이템 효과
- 리더보드
- 모바일 지원
