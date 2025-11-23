# Snake Game - Phaser 3

> Last updated: 2025-11-23

## 프로젝트 개요
Phaser 3 기반 Snake 게임. 스테이지 시스템, 콤보, 아이템, 데드존, 상점, 대출 시스템 등 다양한 기능이 포함된 클래식 게임.

## 파일 구조
```
my-phaser-game/
├── src/
│   ├── main.js              # Phaser 게임 설정 (pixelArt: true)
│   ├── data/
│   │   ├── banks.js         # 은행 데이터 (티어별 금리/한도)
│   │   └── items.js         # 상점 아이템 데이터
│   └── scenes/
│       └── SnakeGame.js     # 메인 게임 로직 (~8100 lines)
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
- **항상 지켜야할 것**: 모든 인터랙티브 요소에 생동감 있는 애니메이션(Micro-interactions)을 일괄 적용

### 스테이지 시스템
- 각 스테이지: 25개 먹이 클리어
- 스테이지 클리어 시:
  - Stage 1-2: 스코어 → 돈 전환 → 카운트다운 → 다음 스테이지
  - Stage 3+: 뱀 점프 → "STAGE CLEAR" → 상점 → 정산 → 카운트다운 → 다음 스테이지
- 최대 스테이지: 100

### 기능 해금 시스템
| 기능 | 해금 시점 | 설명 |
|------|----------|------|
| 십자가 후레쉬 | Stage 1-2 | 1~10번째 먹이 위치 강조 |
| 데드존 | Stage 3+ | 10번째 먹이 시 생성 |
| 상점 | Stage 3 클리어 후 | 아이템 구매 가능 |
| 보스전 | Stage 5, 10, 15... | 매 5스테이지마다 |
| 대출 기능 | Stage 6 클리어 후 | NEW 뱃지와 함께 등장 |

---

## 구현된 기능

### 1. 콤보 시스템
- **조건**: 방향전환 3번 이내에 먹이 먹으면 콤보 유지
- **점수 공식**: `10 × (1 + (콤보-1) × 0.5)`
  - 콤보 1: 10점
  - 콤보 10: 55점
  - 콤보 75: 380점
- **콤보 실드**: 4번째 방향전환부터 매번 1개씩 소모
  - 4번째 방향전환: 실드 1개 소모
  - 5번째 방향전환: 실드 1개 더 소모
  - 실드 부족 시: X 표시 + 콤보 끊김 예고, 먹이 먹을 때 콤보 실패
- **수트 기능**: 콤보 실드가 1개 이상일 때 뱀 머리가 노란색으로 변경
  - 구매 시: 상점 프리뷰에서 머리 노란색 + 글로우 애니메이션
  - 실드 소모 시: 작은 실드 아이콘이 깨지는 효과 + "-1" 표시
  - 마지막 실드 소모 시: "SUIT OFF" 텍스트 + 녹색 복원 애니메이션
  - 실드 부족 콤보 끊김: X 표시 + 빠른 머리색 복원 + "NO SHIELD!" 텍스트
  - 게임오버 시: 녹색 머리로 리셋
- **아이템 상태 UI**: 화면 우측 하단에 실드 개수 표시
  - 3개 이상: 녹색 테두리 (여유)
  - 2개: 노란색 테두리 (보통)
  - 1개: 빨간색 테두리 (위험)

### 2. 말풍선 시스템
- 먹이가 벽에 붙어 생성되면 말풍선 표시
- 메시지: "Oops!", "Sorry!", "My bad!", "Whoops!", "Uh-oh!"
- 페이드인/아웃 애니메이션

### 3. 십자가 후레쉬 효과 (Stage 1-2 전용)
- 1~10번째 먹이 위치에서 십자가 모양 라인 깜빡임
- 먹이 위치 강조 효과
- Stage 3부터는 비활성화

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

### 8. 상점 시스템 (Stage 3 클리어 후)

#### 오픈 조건
- Stage 3 클리어 후부터 매 스테이지 클리어 시 상점 오픈
- STAGE CLEAR → 상점 → 정산 애니메이션 → 3-2-1 카운트다운 → 다음 스테이지

#### UI 구성 (Balatro 스타일)
- **배경**: 어두운 오버레이 (85% 투명도)
- **타이틀**: 네온 "SHOP" 사인 (빨간 배경, 노란 글씨)
- **왼쪽 사이드바**: STAGE, MONEY, DEBTS (대출 정보)
- **메인 영역**: 카드 형태 아이템 5개
- **하단**: Next Stage 버튼 (초록), Loan 버튼 (빨강, Stage 6+)
- **뱀 프리뷰**: 현재 장착된 수트 표시 (콤보 실드 노란 머리, 스피드 부스트 궤도 등)

#### 아이템 목록
| 아이템 | 설명 | 가격 |
|--------|------|------|
| Combo Shield | 콤보 끊김 1회 보호 + 수트(머리 노란색) | $10 |
| Speed Boost | 궤도 전자 수트 + 속도 효과 | $150 |
| Double Score | 다음 스테이지 점수 2배 | $200 |
| Extra Life | 목숨 +1 (1회 부활) | $300 |
| Magnet | 먹이를 끌어당김 | $250 |

#### Speed Boost 수트
- 구매 시: 에너지 집중 → 폭발 → 전자 궤도 등장 애니메이션
- 인게임: 뱀 머리 주위로 2개의 전자가 궤도를 돌며 회전
- 60fps 독립 타이머로 부드러운 애니메이션
- 트레일 효과 + 펄스 크기 변화
- 상점 프리뷰와 인게임 비율 맞춤 (0.6 스케일)

#### 조작법
- **←→**: 카드 선택 (아이템 영역에서 순환)
- **↑↓**: 아이템 ↔ 버튼 이동
- **ENTER**: 구매 / 버튼 실행
- **ESC**: 상점 닫기

#### 네비게이션
- 아이템 영역: 좌우 순환 (SOLD 건너뜀)
- 버튼 영역: 좌우로 Next Stage ↔ Loan 전환 (Loan은 Stage 6+)
- 구매 후: 오른쪽 다음 아이템으로 자동 이동, 마지막이면 Next Stage로

#### 애니메이션 요소
- **타이틀**: 줌인 등장 → 깜빡임 → 지속 펄스
- **사이드바**: 왼쪽에서 슬라이드 인, 정보 순차 페이드인
- **카드**: 위에서 바운스 등장, 착지 파티클
- **선택**: 카드 위로 올라옴 + 노란 테두리 + 들썩임
- **구매**: 파티클 폭발 → 회전하며 날아감 → "SOLD"
- **딤 처리**: 돈 부족 시 카드 어둡게 + 가격 빨간색

#### 피드백
- **돈 부족**: 빨간 깜빡임 + 좌우 흔들림 + 카드 흔들림
- **이미 구매**: 카드 좌우 흔들림

### 9. 정산 시스템

#### 스테이지 클리어 후
1. 화면 중앙에 정산 패널 표시
2. 순차적으로 애니메이션:
   - **Previous**: 기존 보유금
   - **Score**: +획득 점수 (카운트업)
   - **은행별 상환**: -상환금액 (카운트다운)
3. 최종 금액이 사이드바로 날아감
4. 빚 완납 시 "DEBT FREE" 메시지

#### Stage 1-2 정산
- 상점이 없으므로 간단한 "+$X" 애니메이션으로 스코어 → 돈 전환

### 10. 대출 시스템 (Stage 6 클리어 후)

#### 해금
- Stage 6 클리어 시 LOAN 버튼에 "NEW!" 뱃지 + 펄스 애니메이션
- Stage 7부터는 일반 표시

#### 티어 구조 (banks.js)
| 티어 | 은행 유형 | 금리 | 한도 |
|------|----------|------|------|
| 1차 | 일반 은행 (5개) | 3~8% | $500~1000 |
| 2차 | 저축은행 (3개) | 8~15% | $300~600 |
| 3차 | 대부업체 (2개) | 18~24% | $100~300 |

#### 대출 프로세스
1. Loan 버튼 클릭 → 은행 검색 애니메이션
2. 현재 티어에서 랜덤 은행 선택
3. 금리/한도 표시 → 금액 입력 (슬라이더)
4. 대출 승인 → 돈 추가
5. 엔터 연타 방지 (isLoanProcessing 플래그)

#### 상환 방식 (5스테이지 균등분할)
- 원금 + 이자를 5회로 나눠 상환
- 매 스테이지 클리어 시 자동 차감
- 상환 완료 시 다음 티어 이용 가능

#### 연체 시스템
- **1회 연체**: Payment Warning 표시 (Strike 1/2)
- **2회 연속 연체**: 파산 → 게임 오버
- 연체 시 경고 화면 4초간 표시

#### 대출 불가 상황
- 모든 티어 대출 완료 시: "No banks available" 메시지
- 위트있는 메시지 + OK/ESC로 닫기

### 11. 보스 배틀 시스템 (매 5스테이지)

#### 보스 스테이지 조건
- 5, 10, 15, 20... 스테이지마다 보스전

#### 보스전 플로우
1. **인트로**
   - 일반 스테이지처럼 3,2,1 카운트다운
   - 뱀 5칸 이동 후 대사: "Where did the frog go?"
   - 뱀이 두리번거리는 애니메이션

2. **보스 등장**
   - 보스 위치: 뱀과 같은 높이(y=15), 우측 벽에서 9칸 떨어진 곳
   - 보스 대사: "Hey, you trash snake!"
   - 보스 대사: "We are enemies... Take my poison!"
   - 대사 후 바로 게임 재개 (카운트다운 없음)

3. **독 먹이 (Trap Phase)**
   - 보스가 보라색 독 먹이로 변신
   - 먹으면 즉시 사라짐 (애니메이션 없음)
   - 보스 대사: "Good luck!"
   - 뱀 색상이 보라색으로 변경 (깜빡임 후)
   - 보스 대사: "Gotcha!"

4. **독 성장**
   - 뱀이 3칸에서 40칸까지 성장
   - 속도가 40ms까지 점점 빨라짐
   - 성장 완료 후 "BATTLE START!" 메시지

5. **배틀 (Battle Phase)**
   - 4개 코너에 순서대로 보스 등장
   - 코너 위치: (0, 0), (cols-1, 0), (0, rows-1), (cols-1, rows-1) - 정확히 벽에 붙은 모서리
   - 데드존과 겹치면 자동으로 옆 칸으로 이동
   - HIT 1/4, 2/4, 3/4 표시
   - 3번 히트 후 마지막 4번째는 슬로우모션 연출

6. **파이널 히트**
   - 카메라가 뱀 머리 위치로 이동
   - 울트라 슬로우모션 (timeScale: 0.3)
   - 줌 인 (2배)
   - 보스 비명: "AAARGH! RIBBIT!"
   - 보스 폭발 파티클
   - 줌 아웃 후 승리

7. **보스 클리어**
   - "BOSS CLEAR!" 텍스트 + 화면 플래시
   - "+1000 BONUS!" 점수 추가
   - 보스전 점수는 정확히 1000점만
   - 상점 오픈 (기존 스테이지 클리어 플로우와 동일)

#### 보스전 특수 규칙
- **콤보 실드 보호**: 보스전 중 실드 소모 안함
- **콤보 저장**: 보스전 시작 시 콤보 저장, 클리어 후 복원
- **방향 카운터 비활성**: 3,2,1,x 표시 안함
- **말풍선/십자가 효과 비활성**: 보스전 중 비활성

#### 보스 UI 요소
- 보스 디자인: 보라색 몸체 + 4개 뿔 (마젠타색)
- 펄스 애니메이션으로 위협적인 느낌

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
this.score = 0                  // 현재 스테이지 점수 (매 스테이지 리셋)
this.money = 0                  // 보유 돈 (누적)
this.foodCount = 0              // 먹은 먹이 개수
this.currentStage = 1           // 현재 스테이지
this.combo = 0                  // 현재 콤보
this.maxCombo = 0               // 최대 콤보
this.comboShieldCount = 0       // 콤보 실드 개수
```

### 아이템 효과 상태
```javascript
this.hasSpeedBoost = false              // 스피드 부스트 수트 활성화
this.speedBoostOrbitals = []            // 궤도 파티클들 (인게임용)
this.speedBoostOrbitalTimer = null      // 궤도 업데이트 타이머 (60fps)
```

### 시스템 플래그
```javascript
this.deadZones = []                    // 데드존 배열 [{x, y, rect}]
this.foodTeleportEnabled = false       // 텔레포트 활성화
this.currentFoodTeleportCount = 0      // 현재 먹이 텔레포트 횟수
this.nextTeleportStep = 0              // 다음 텔레포트까지 스텝
```

### 상점 시스템
```javascript
this.shopOpen = false                  // 상점 열림 상태
this.shopElements = []                 // 상점 UI 요소들
this.shopCards = []                    // 카드 UI 요소들
this.selectedShopIndex = 0             // 선택된 인덱스 (아이템 + 버튼)
this.shopItems = [...]                 // 아이템 배열
this.shopKeyboardEnabled = false       // 상점 키보드 활성화
this.shopDebtElements = []             // 빚 정보 UI 요소들
this.shopLoanBtn = null                // 대출 버튼 (Stage 6+ 에서만 존재)
this.shopPreviewInfo = {}              // 프리뷰 좌표 정보 (수트 적용용)
```

### 대출 시스템
```javascript
this.loans = []                        // 대출 배열
// 각 대출 객체:
// {
//   bankId, bankName,
//   principal,              // 원금
//   interest,               // 이자
//   interestRate,           // 금리
//   totalDue,               // 총 상환액 (원금+이자)
//   remaining,              // 남은 상환액
//   paymentPerStage,        // 스테이지당 상환액
//   stagesLeft,             // 남은 상환 횟수 (최대 5)
//   missedPayments          // 연속 연체 횟수
// }

this.loanTier = 0                      // 현재 대출 티어 (0~3)
this.totalDebt = 0                     // 총 부채
this.loanElements = []                 // 대출 UI 요소들
this.loanUIOpen = false                // 대출 UI 열림 상태
this.isLoanProcessing = false          // 대출 처리 중 (엔터 연타 방지)
```

### 보스전 시스템
```javascript
this.isBossStage = false               // 보스 스테이지 여부
this.bossMode = false                  // 보스 모드 활성화
this.bossPhase = 'none'                // 'intro', 'trap', 'poisoned', 'battle', 'victory'
this.snakePoisoned = false             // 뱀 독 상태 (보라색)
this.poisonGrowthActive = false        // 독 성장 중
this.poisonGrowthTarget = 40           // 최대 성장 길이
this.poisonSpeedTarget = 40            // 최종 속도 (ms)
this.bossHitCount = 0                  // 보스 히트 횟수 (0~4)
this.bossElement = null                // 보스 그래픽 요소
this.bossPosition = null               // 보스 위치 {x, y}
this.bossCorners = []                  // 배틀 코너 위치들
this.bossInputBlocked = false          // 대사 중 입력 차단
this.savedCombo = 0                    // 저장된 콤보
this.savedComboShieldCount = 0         // 저장된 실드 개수
this.bossStageInterval = 5             // 보스 스테이지 간격
this.testBossStage = 5                 // 보스 스테이지 (5, 10, 15...)
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
- `showStageClearText()` - 스테이지 클리어 텍스트 표시
- `startStageClearCountdown()` - 상점 없을 때 카운트다운 (스코어→돈 전환 포함)
- `showNextStage()` - 다음 스테이지 표시
- `resetStage()` - 스테이지 리셋

### 상점
- `openShop()` - 상점 열기 (UI 생성, 애니메이션)
- `closeShop()` - 상점 닫기 (정리, 애니메이션)
- `updateShopSelection()` - 선택 UI 업데이트 (딤 처리 포함)
- `handleShopInput()` - 상점 키보드 입력 처리
- `purchaseItem()` - 아이템 구매
- `shopCountdownAndStart()` - 상점 닫은 후 카운트다운
- `updateShopDebtInfo()` - 사이드바 빚 정보 업데이트
- `applyShopPreviewSuits()` - 상점 프리뷰에 장착 수트 적용

### 스피드 부스트 궤도
- `initSpeedBoostOrbitals()` - 인게임 궤도 파티클 초기화
- `updateSpeedBoostOrbitals()` - 60fps 궤도 위치 업데이트
- `cleanupSpeedBoostOrbitals()` - 궤도 파티클 정리

### 정산
- `animateScoreToMoney()` - 스코어 → 돈 전환 + 상환 애니메이션
- `showDebtFreeAnimation()` - 빚 완납 축하 메시지

### 대출
- `openLoanUI()` - 대출 UI 열기
- `closeLoanUI()` - 대출 UI 닫기
- `searchForBank()` - 은행 검색 애니메이션
- `showBankOffer()` - 은행 제안 표시
- `takeLoanFromBank()` - 대출 실행
- `showNoBanksAvailable()` - 대출 불가 메시지
- `showPaymentWarning()` - 연체 경고 표시
- `showBankruptcyGameOver()` - 파산 게임오버

### 효과
- `playFoodEffect()` - 먹이 먹을 때 효과
- `createFoodParticles()` - 파티클 효과
- `showComboEffect()` - 콤보 효과

### 보스전
- `showSnakeDialogue()` - 뱀 대사 표시
- `snakeLookAround()` - 뱀 두리번거리기 애니메이션
- `showBossAppear()` - 보스 등장 시퀀스
- `showBossDialogue()` - 보스 대사 (타이핑 효과)
- `drawBoss()` - 보스 그리기 (보라색 + 뿔)
- `handleBossTrap()` - 독 먹이 먹었을 때 처리
- `applyPoison()` - 독 효과 적용 (색상 변경)
- `startPoisonGrowth()` - 독 성장 시작
- `handlePoisonGrowth()` - 성장 처리 (속도/길이)
- `startBossBattle()` - 배틀 페이즈 시작
- `spawnBossAtCorner()` - 코너에 보스 생성
- `handleBossHit()` - 보스 히트 처리
- `handleBossFinalHit()` - 마지막 히트 (슬로우모션)
- `showBossVictory()` - 보스 클리어 처리

---

## 스테이지별 특징

| Stage | 속도 | 데드존 | 텔레포트 | 상점 | 대출 | 특이사항 |
|-------|------|--------|----------|------|------|----------|
| 1 | 130ms | 없음 | 1회 | X | X | 십자가 후레쉬 |
| 2 | 120ms | 없음 | 2회 | X | X | 십자가 후레쉬, 텔레포트 강화 |
| 3 | 110ms | 1개 | 2회 | O | X | 10번째 먹이 시 데드존 |
| 4 | 100ms | +2개 | 2회 | O | X | 스테이지 시작 시 데드존 추가 |
| 5 | 90ms | +2개 | 2회 | O | X | **보스 스테이지** (1000점 보너스) |
| 6+ | 더 빠름 | +2개 | 2회 | O | O | 대출 기능 해금 (Stage 6 = NEW 뱃지) |
| 10,15,20... | - | - | - | O | O | **보스 스테이지** |

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

### 현재 설정 (정상 플레이용)
- `foodCount >= 25` - 먹이 25개로 스테이지 클리어
- `currentStage >= 3` - Stage 3 클리어 후 상점 오픈
- `currentStage >= 6` - Stage 6 클리어 후 대출 기능
- `bossHitCount >= 4` - 보스 먹이 4개로 클리어
- `testBossStage = 5` - Stage 5부터 보스전
