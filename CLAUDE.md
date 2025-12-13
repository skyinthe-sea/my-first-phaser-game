# Snake Game - Phaser 3

> **코드 규모**: ~30,000 lines (SnakeGame.js)
> **Last updated**: 2025-12-05

---

## 프로젝트 구조

```
my-phaser-game/
├── src/
│   ├── main.js                    # Phaser 설정 (800x600, pixelArt: true)
│   ├── data/
│   │   ├── banks.js               # 은행 데이터 (3티어, 10개 은행)
│   │   ├── items.js               # 상점 아이템 (5종)
│   │   └── worlds.js              # 월드/스테이지 설정
│   └── scenes/
│       └── SnakeGame.js           # 메인 게임 로직 (단일 파일)
├── public/assets/
│   ├── bgm/                       # snake_bgm.mp3
│   ├── sfx/                       # moving.mp3, eating.mp3
│   ├── items/                     # 아이템 이미지
│   └── sprite/                    # bubble.png 등
└── CLAUDE.md                      # 이 문서
```

---

## 코드 아키텍처

### 단일 Scene 구조
모든 게임 로직이 `SnakeGame` 클래스 하나에 있음. 리팩토링보다 빠른 개발 우선.

### 코드 섹션 (대략적 라인 범위)
| 섹션 | 내용 |
|------|------|
| 1-500 | 변수 초기화 (`create()`) |
| 500-3000 | 기본 게임 로직 (이동, 충돌, 먹이) |
| 3000-7000 | UI 시스템 (상점, 대출, 정산) |
| 7000-15000 | 보스 시스템 (독개구리, 탄막, NEXUS 등) |
| 15000-20000 | 특수 시스템 (가스존, 톱니, 안개) |
| 20000-25000 | Flux Maze, Magnetar 보스 |
| 25000-30000 | **Quantum Split (17탄)**, Meta Universe |

### 네이밍 컨벤션
```javascript
// 함수 접두사
show~()      // UI/연출 표시
handle~()    // 이벤트 처리
create~()    // 객체 생성
cleanup~()   // 정리/제거
start~()     // 시스템 시작
stop~()      // 시스템 중지
update~()    // 상태 업데이트
draw~()      // 렌더링

// 변수 접두사
is~          // boolean 상태
has~         // 보유 여부
~Timer       // Phaser TimerEvent
~Graphics    // Phaser Graphics 객체
~Elements    // UI 요소 배열 (정리용)
```

---

## 게임 기본 설정

| 항목 | 값 |
|------|-----|
| 그리드 | 40 x 27 (cols x rows) |
| 타일 크기 | 20px |
| UI 영역 | 상단 60px |
| 시작 속도 | 90ms |
| 최대 속도 | 50ms |
| 속도 감소 | 먹이당 -5ms |
| 클리어 조건 | 20개 먹이 |

---

## 월드 & 스테이지 시스템

### 월드 구성 (각 3스테이지, 마지막이 보스)

| 월드 | 이름 | 스테이지 | 핵심 메카닉 | 보스 |
|------|------|----------|-------------|------|
| 0 | Basic | 1-3 | 십자가 플래시, 텔레포트 | 독개구리 |
| 1 | Deadzone | 4-6 | 데드존 생성 | 총잡이 (Bullet Hell) |
| 2 | Darkness | 7-9 | 안개 (Fog of War) | 녹턴 |
| 3 | Machine | 10-12 | 움직이는 톱니 | 기어 보스 |
| 4 | Cyber | 13-15 | 가스 자기장 | NEXUS (암기 보스) |
| 5 | Quantum | 16-18 | 6개 유니버스 분할 | TBD |

### 기능 해금 타임라인
```
Stage 1   : 십자가 플래시, 텔레포트(1회)
Stage 3   : 첫 보스전, 상점 해금
Stage 4   : 데드존 시작 (9번째 먹이)
Stage 7   : 안개(Fog of War)
Stage 8   : 대출 기능 해금
Stage 10  : 톱니 시스템
Stage 13  : 가스 자기장
Stage 15  : NEXUS 보스 (암기)
Stage 17  : Quantum Split (6유니버스)
```

---

## 핵심 시스템 요약

### 1. 콤보 시스템
- **유지 조건**: 방향전환 3번 이내에 먹이
- **점수**: `10 × (1 + (콤보-1) × 0.5)`
- **실드**: 4번째 방향전환부터 소모, 아이템으로 구매

### 2. 상점 시스템 (Stage 4+)
| 아이템 | 효과 | 가격 |
|--------|------|------|
| Combo Shield | 콤보 보호 1회, 노란 머리 수트 | $10 |
| Speed Boost | 전자 궤도 수트 | $150 |
| Double Score | 다음 스테이지 2배 점수 | $200 |
| Extra Life | 1회 부활 | $300 |
| Magnet | 먹이 끌어당김 | $250 |

### 3. 대출 시스템 (Stage 8+)
- **3티어**: 일반은행(3-8%) → 저축은행(8-15%) → 대부업(18-24%)
- **상환**: 5스테이지 균등분할
- **연체**: 2회 연속 → 파산 게임오버

### 4. 부활 시스템
- **비용**: $500 (돈+점수에서 차감)
- **조건**: 총 자산 ≥ 500
- **효과**: 현재 스테이지 재시작, 장애물 유지

### 5. 보스전 (매 3스테이지)
| 보스 | 스테이지 | 특징 |
|------|----------|------|
| 독개구리 | 3 | 독 먹이 → 40칸 성장 → 코너 4HIT |
| 총잡이 | 6 | 탄막 슈팅, 스페이스바 회피 |
| 녹턴 | 9 | TBD |
| 기어보스 | 12 | TBD |
| NEXUS | 15 | 바이너리 암기 4라운드 |
| ??? | 18 | TBD (자기자신과 대결 예정) |

### 6. Quantum Split (Stage 17)
- **컨셉**: 6개 평행우주에서 동시 플레이
- **뷰포트**: 3x2 그리드, 각 266x270px
- **먹이**: 6개 우주에 각각 배치, 총 20개로 클리어
- **속도**: 먹이당 5ms 증가 (최대 50ms)
- **비주얼**: 네온 글로우 테두리 + 에너지 입자 + 코너 노드

---

## 개발자 모드 (KK)

게임 중 `K` 키 빠르게 2번 → 개발자 모드

| 키 | 기능 |
|----|------|
| ↑↓ | 스테이지 선택 |
| Enter | 선택 스테이지 시작 |
| T | 테스트 스테이지 토글 (-2, -1, 0) |
| ESC | 모드 종료 |

### 테스트 스테이지
| Stage | 이름 | 내용 |
|-------|------|------|
| -2 | Cyber Base | 가스존 기본 |
| -1 | Flux Maze | 극성 + 자석탑 + 기뢰 |
| 0 | Magnetar | 3페이즈 자석 보스 |

---

## 주요 변수 레퍼런스

### 게임 상태
```javascript
this.snake = [{x, y}, ...]     // 뱀 세그먼트
this.food = {x, y}             // 먹이 위치
this.direction = 'RIGHT'       // 현재 방향
this.inputQueue = []           // 입력 버퍼 (최대 2)
this.gameOver = false
this.score = 0                 // 스테이지별 리셋
this.money = 0                 // 누적
this.currentStage = 1
this.foodCount = 0
```

### 시스템별 플래그
```javascript
// 보스
this.bossMode = false
this.bossPhase = 'none'        // intro|trap|battle|victory
this.bulletBossMode = false
this.nexusMode = false
this.magnetarMode = false

// 장애물
this.deadZones = []
this.saws = []
this.gasZoneEnabled = false

// 특수 모드
this.quantumSplitMode = false  // 17탄
this.fogEnabled = false        // 안개
this.polarityEnabled = false   // 극성 시스템
```

### Quantum Split 전용
```javascript
this.quantumViewports = []           // 6개 RenderTexture
this.quantumFoods = []               // 6개 먹이
this.quantumTotalFood = 0            // 총 먹은 수
this.quantumTargetFood = 20          // 클리어 조건
this.quantumBorderGlowLayers = []    // 글로우 레이어
this.quantumCornerNodes = []         // 코너 빛나는 노드
this.quantumEnergyParticles = []     // 흐르는 입자
```

---

## 주요 함수 인덱스

### 게임 루프
- `moveSnake()` - 이동 + 충돌 + 먹이
- `draw()` - 렌더링
- `generateFood()` - 먹이 생성

### 스테이지 전환
- `clearStage()` - 클리어 처리
- `resetStage()` - 리셋
- `showNextStage()` - 다음 스테이지

### 상점/경제
- `openShop()` / `closeShop()`
- `purchaseItem(index)`
- `openLoanUI()` / `takeLoanFromBank()`
- `animateScoreToMoney()` - 정산

### 보스
- `startBoss~()` - 각 보스 시작
- `handleBoss~Hit()` - HIT 처리
- `showBoss~Victory()` - 승리 연출
- `cleanup~()` - 정리

### Quantum Split
- `showQuantumSplitIntro()` - 인트로 시퀀스
- `initQuantumViewports()` - 뷰포트 생성
- `drawQuantumViewports()` - 매 프레임 렌더링
- `handleQuantumMovement()` - 이동 처리
- `handleQuantumFoodEaten()` - 먹이 처리
- `createQuantumBorders()` - 네온 테두리 생성
- `startQuantumBorderAnimation()` - 60fps 애니메이션
- `cleanupQuantumSplit()` - 정리

---

## 애니메이션 가이드라인

### 원칙
> **모든 인터랙티브 요소에 생동감 있는 Micro-interaction 적용**

### 패턴
```javascript
// 팝인 등장
this.tweens.add({
  targets: element,
  scale: { from: 0, to: 1 },
  alpha: { from: 0, to: 1 },
  duration: 300,
  ease: 'Back.easeOut'
});

// 펄스 강조
this.tweens.add({
  targets: element,
  scale: 1.1,
  yoyo: true,
  repeat: -1,
  duration: 500
});

// 60fps 독립 애니메이션
this.time.addEvent({
  delay: 16,
  callback: () => { /* 매 프레임 업데이트 */ },
  loop: true
});
```

### 색상 팔레트
| 용도 | 색상 |
|------|------|
| 뱀 머리 | `0x00ff00` (초록) |
| 뱀 몸통 | `0x00aa00` |
| 먹이 | `0xff0000` (빨강) / `0x00ff00` (마지막) |
| 보스 | `0x9932cc` (보라) |
| 위험 | `0xff0000` / `0xff00ff` (마젠타) |
| 사이버 | `0x00ffff` (시안) / `0xff00ff` |
| UI 강조 | `0xffff00` (노랑) |

### Universe 색상 (Quantum Split)
```javascript
this.universeColors = [
  0xff6b6b,  // U1: 빨강
  0xffa500,  // U2: 주황
  0xffff00,  // U3: 노랑
  0x00ff00,  // U4: 초록
  0xff00ff,  // U5: 마젠타
  0x00ffff   // U6: 시안
];
```

---

## 개발 시 주의사항

### DO
- 함수명에 동사 접두사 사용
- cleanup 함수에서 모든 요소 정리
- 60fps 애니메이션은 별도 타이머 사용
- 상태 변경 시 관련 UI 동기화

### DON'T
- `this.currentSpeed` 같은 미초기화 변수 사용 (버그 원인)
- 타이머/트윈 정리 누락 (메모리 누수)
- 하드코딩 좌표 (그리드 기반 계산 사용)

### 디버깅 팁
```javascript
// 현재 상태 확인
console.log('Stage:', this.currentStage);
console.log('Food:', this.foodCount);
console.log('Speed:', this.moveTimer.delay);

// 특정 스테이지 점프 (개발자 모드에서)
// K, K → 화살표로 선택 → Enter
```

---

## 테스트용 임시 설정 (원복 필요)

> **주의**: 아래 설정들은 테스트용으로 변경된 상태. 정식 배포 전 원복 필요!

| # | 설정 | 라인 | 현재값 | 정식값 | 설명 |
|---|------|------|--------|--------|------|
| 1 | 일반 스테이지 클리어 조건 | 1957 | **5개** | 20개 | `foodCount >= 5` → `>= 20` |
| 2 | 16탄 Meta Universe 클리어 | 258 | **5개** | 20개 | `metaUniverseTargetFood = 5` → `20` |
| 3 | 18탄 Phase1 HIT 표시 | 31407 | **1마리** | 5마리 | `totalGhostsRequired = 1` → `5` |
| 4 | 18탄 Phase1→2 진행 조건 | 31415 | **1마리** | 5마리 | `ghostsRequiredForPhase2 = 1` → `5` |
| 5 | 18탄 러너 테스트 플래그 | 27825 | 설정됨 | **삭제** | `this.testRunnerTransition = true;` 라인 삭제 |
| 6 | 3탄 독개구리 보스 위치 | 14184-14189 | 중앙4군데 | 모서리4개 | `bossCorners` 배열 수정 |

### 원복 코드 예시

```javascript
// #1: 라인 1957
if (!this.bossMode && this.foodCount >= 20) {  // 5 → 20

// #2: 라인 258
this.metaUniverseTargetFood = 20;  // 5 → 20

// #3, #4: 라인 31407, 31415
const totalGhostsRequired = 5;      // 1 → 5
const ghostsRequiredForPhase2 = 5;  // 1 → 5

// #5: 라인 27825 (삭제)
// this.testRunnerTransition = true;  ← 이 줄 삭제

// #6: 라인 14184-14189 (모서리로 복원)
this.bossCorners = [
  { x: 0, y: 0 },
  { x: this.cols - 1, y: 0 },
  { x: 0, y: this.rows - 1 },
  { x: this.cols - 1, y: this.rows - 1 }
];
```

---

## 향후 개발 예정

- [ ] **Stage 18 보스**: 자기 자신과의 대결 (시간의 잔상 or 미러 매치)
- [ ] Stage 19-21: World 6 신규 메카닉
- [ ] 사운드 이펙트 추가
- [ ] 모바일 터치 지원

---

*이 문서는 Claude Code와 함께 개발하며 자동 업데이트됩니다.*
