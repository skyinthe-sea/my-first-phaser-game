# Snake Game - Phaser 3

> Last updated: 2025-11-25

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
- 각 스테이지: 20개 먹이 클리어
- 스테이지 클리어 시:
  - Stage 1: 스코어 → 돈 전환 → 카운트다운 → 다음 스테이지
  - Stage 2+: 뱀 점프 → "STAGE CLEAR" → 상점 → 정산 → 카운트다운 → 다음 스테이지
- 최대 스테이지: 100

### 기능 해금 시스템
| 기능 | 해금 시점 | 설명 |
|------|----------|------|
| 십자가 후레쉬 | Stage 1-2 | 1~5번째 먹이 위치 강조 |
| 파티클 효과 | 6번째 먹이부터 | 먹이 생성 시 하늘색 별 파티클 |
| 상점 | Stage 4 클리어 후 | 아이템 구매 가능 |
| 보스전 | Stage 3, 6, 9... | 매 3스테이지마다 |
| 데드존 | Stage 4+ | 9번째 먹이 시 생성 |
| 대출 기능 | Stage 8 클리어 후 | NEW 뱃지와 함께 등장 |
| 안개(Fog of War) | Stage 7 | 시야 제한 |
| 원형 독가스 자기장 | Stage 8 | 배틀로얄 스타일 맵 축소 |
| 움직이는 톱니 | Stage 9 | 매 먹이마다 톱니 1개 생성 (최대 5개) |

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
- 1~5번째 먹이 위치에서 십자가 모양 라인 깜빡임
- 먹이 위치 강조 효과
- Stage 3부터는 비활성화

### 4. 아이템 시스템 (10번째 먹이 이후)
- 10번째 먹이 먹으면 아이템 시스템 활성화
- 랜덤 위치에 아이템 생성
- 아이템 종류별 효과 (속도, 점수 등)

### 5. 텔레포트 시스템 (16~19번째 먹이)
- **Stage 1**: 각 먹이당 1번 텔레포트
- **Stage 2+**: 각 먹이당 2번 연속 텔레포트
- 1~5 스텝 랜덤 대기 후 텔레포트
- 사라지는 파티클 → 나타나는 파티클 애니메이션

### 6. 데드존 시스템 (Stage 4+)

#### Stage 4 - 9번째 먹이
1. 9번째 먹이는 중앙 부근(±5칸)에 생성
2. 9번째 먹이 먹으면:
   - 게임 일시정지
   - 랜덤 위치 깜빡임 (검은색 타일, 10번)
   - "THIS WILL KILL YOU!" 타이핑 효과
   - 3-2-1-GO 카운트다운
   - 게임 재개

#### Stage 5 - 시작 시
1. 스테이지 시작하면:
   - 게임 일시정지
   - 3개 위치 동시 깜빡임
   - "THIS TOO SHALL KILL YOU!" 메시지
   - 3-2-1-GO 카운트다운
   - 게임 재개

#### 데드존 규칙
- 뱀/먹이와 겹치지 않음
- 기존 데드존과 맨해튼 거리 5칸 이상
- 뱀의 진행방향 바로 앞에 생성 안됨
- 닿으면 즉시 게임 오버
- 다음 스테이지에도 유지

### 7. 20번째 먹이
- 색상: 초록색 (뱀 머리색과 동일)
- 스테이지 클리어 직전 시각적 표시

### 8. 상점 시스템 (Stage 4 클리어 후)

#### 오픈 조건
- Stage 4 클리어 후부터 매 스테이지 클리어 시 상점 오픈
- STAGE CLEAR → 상점 → 정산 애니메이션 → 3-2-1 카운트다운 → 다음 스테이지

#### UI 구성 (Balatro 스타일)
- **배경**: 어두운 오버레이 (85% 투명도)
- **타이틀**: 네온 "SHOP" 사인 (빨간 배경, 노란 글씨)
- **왼쪽 사이드바**: STAGE, MONEY, DEBTS (대출 정보)
- **메인 영역**: 카드 형태 아이템 5개
- **하단**: Next Stage 버튼 (초록), Loan 버튼 (빨강, Stage 8+)
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
- 버튼 영역: 좌우로 Next Stage ↔ Loan 전환 (Loan은 Stage 8+)
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

#### Stage 1 정산
- 상점이 없으므로 간단한 "+$X" 애니메이션으로 스코어 → 돈 전환

### 10. 대출 시스템 (Stage 8 클리어 후)

#### 해금
- Stage 8 클리어 시 LOAN 버튼에 "NEW!" 뱃지 + 펄스 애니메이션
- Stage 9부터는 일반 표시

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

### 11. 500원 부활 시스템

#### 개요
- 게임 오버 시 보유 자산(돈+스코어)이 500원 이상이면 자동 부활
- 500원을 차감하고 현재 스테이지를 처음부터 다시 시작
- 돈이 있는 한 무제한 부활 가능

#### 부활 조건
- **총 자산**: 현재 돈(money) + 현재 스코어(score) ≥ 500
- 자동 체크: 게임 오버 시점에 자동으로 부활 여부 확인

#### 부활 성공 시퀀스
1. 화면 중앙에 코인 아이콘 + 보유 자산 표시
2. "-$500" 카운트다운 애니메이션 (빠른 속도)
3. "REVIVE!" 텍스트 + 번개 효과
4. 현재 스테이지 재시작

#### 부활 실패 시퀀스 (돈 부족)
1. 지갑 아이콘 + 보유 자산 표시
2. "NEED $500" 요구 금액 표시
3. "NOT ENOUGH!" 텍스트 (빨간색)
4. 일반 게임 오버 화면으로 전환

#### 부활 후 상태
- **뱀**: 3칸, 시작 위치 (5, 13)
- **스코어**: 0으로 리셋
- **속도**: 해당 스테이지 시작 속도로 리셋
- **대출 상환**: 스케줄 유지
- **데드존/톱니 등**: 기존 장애물 유지
- **콤보**: 0으로 리셋

#### 주요 변수
```javascript
this.reviveCost = 500              // 부활 비용
this.isReviving = false            // 부활 중 상태
this.reviveElements = []           // 부활 UI 요소들
```

#### 주요 함수
- `canRevive()` - 부활 가능 여부 체크
- `showReviveSequence()` - 부활 성공 애니메이션
- `showReviveFailedSequence()` - 부활 실패 애니메이션
- `restartCurrentStage()` - 현재 스테이지 재시작

### 12. 보스 배틀 시스템 (매 3스테이지)

#### 보스 스테이지 조건
- 3, 6, 9, 12... 스테이지마다 보스전

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

### 13. 원형 독가스 자기장 시스템 (Stage 8)

#### 개요
- 배틀로얄 스타일의 맵 축소 메커니즘
- 맵 중앙을 기준으로 원형으로 안전 영역이 좁혀짐
- 2초마다 반경 1.5 타일씩 감소
- 최소 반경 4 타일까지 축소

#### 시작 조건
- Stage 8 시작 1초 후 자동 활성화
- 초기 반경: 맵 모서리까지 커버 (전체 맵)
- 원 중심: 맵 정중앙 (cols/2, rows/2)

#### 확장(수축) 프로세스
1. **경고 단계** (약 0.5초)
   - 다음에 독가스가 될 영역이 빨간색/노란색으로 6번 깜빡임 (80ms 간격)
   - 원형 경계선에 흰색 강조
   - 화면 가장자리 빨간 글로우 효과
   - 경고 중에는 게임 진행

2. **확장(수축) 실행**
   - EMP 플래시 효과 (시안색)
   - 원형 수축 링 애니메이션
   - 16개 전기 파티클이 경계선에서 안쪽으로 수축
   - 반경 1.5 타일 감소

3. **먹이 재배치**
   - 먹이가 독가스 영역에 포함되면 자동으로 안전 영역에 재생성
   - foodCount 증가 없음 (카운트 페널티 없음)

#### 비주얼 효과
- **독가스 색상**: EMP 스타일 그라데이션 (시안/마젠타/보라)
- **펄스 애니메이션**: 알파값 변동 (0.6 ~ 0.75)
- **경계선**:
  - 주 경계선: 시안색 (3px, 알파 0.8 ~ 1.0)
  - 내부 글로우: 마젠타색 (1px, 알파 0.4 ~ 0.6)
- **전기 스파크**: 12개의 스파크가 원형 경계선을 따라 회전
- **60fps 독립 타이머**: 부드러운 애니메이션

#### 충돌 규칙
- 뱀이 독가스 영역에 진입하면 즉시 게임 오버
- 먹이는 독가스 영역에 생성되지 않음
- 데드존과 별개로 동작 (중첩 가능)

#### 경고 메시지
- 반경이 최소+3 이하로 줄어들면 "DANGER! GAS CLOSING IN!" 표시

#### 성능 최적화
- 타일별 거리 계산으로 원형 렌더링
- 반경 밖의 타일만 독가스로 표시
- 거리에 따른 알파 그라데이션 (경계에서 멀수록 진함)

### 14. 움직이는 톱니 시스템 (Stage 9)

#### 개요
- 매 먹이를 먹을 때마다 1개의 톱니가 생성 (최대 5개)
- 톱니는 맵을 자유롭게 돌아다니며 뱀을 위협
- 생성 중에는 뱀이 지나갈 수 있지만, 활성화 후 닿으면 즉시 게임 오버

#### 생성 조건
- Stage 9에서 매 먹이 먹을 때마다 1개씩 생성
- 최대 5개까지만 생성 가능
- 보스 모드 중에는 생성 안 됨

#### 톱니 생성 시퀀스
1. **경고 단계** (약 2초)
   - 랜덤 위치에 빨간색 경고 링이 나타남
   - 링이 호흡하듯 커지고 작아지는 애니메이션
   - 뱀/먹이/데드존과 겹치지 않는 위치에 생성

2. **활성화**
   - 경고가 끝나면 톱니 블레이드가 나타남
   - 빠르게 회전하는 애니메이션 (무서운 느낌)
   - 활성화 후부터 충돌 판정 시작 (canKill: true)

#### 이동 패턴
- **기본 이동**: 600ms마다 1칸씩 랜덤 방향으로 이동
- **방향 결정**: 이전 방향을 기억하며, 직진/좌회전/우회전 중 선택
- **벽 충돌**: 벽에 부딪히면 180도 반대 방향으로 회전
- **데드존 회피**: 데드존을 만나면 우회
- **먹이 추적**: 먹이가 가까이 있으면 먹이 방향으로 이동 확률 증가
- **스텝 사이즈**: 가끔 2칸을 한 번에 이동하여 예측 불가능

#### 비주얼 효과
- **톱니 디자인**:
  - 중앙의 검은 원형 허브
  - 12개의 날카로운 톱니 날 (은색)
  - 빨간색 위험 링 (경고용)
- **회전 애니메이션**: 지속적으로 빠르게 회전
- **펄스 효과**: 톱니가 호흡하듯 크기가 미세하게 변함
- **경고 링 애니메이션**: 톱니 주위로 빨간 링이 깜빡임

#### 충돌 규칙
- **생성 중** (경고 단계): 뱀이 지나갈 수 있음 (canKill: false)
- **활성화 후**: 뱀 머리가 닿으면 즉시 게임 오버
- **먹이와의 상호작용**: 톱니는 먹이를 지나갈 수 있음
- **데드존과의 상호작용**: 톱니는 데드존을 피해서 이동

#### 난이도 요소
- 톱니가 쌓일수록 (최대 5개) 피하기 어려워짐
- 예측 불가능한 이동 패턴으로 긴장감 유지
- 먹이 근처에 톱니가 있으면 먹이 먹기가 위험해짐

### 15. 탄막 슈팅 보스 시스템 (Bullet Hell Boss)

#### 개요
- 보스가 랜덤 위치에서 사방으로 총알(데드존 판정)을 발사
- 뱀이 스페이스바로 **사이드 롤 회피**하며 총알을 피함
- vulnerable 상태일 때 보스를 먹으면 HIT 판정
- 4번 HIT로 보스 클리어

#### 현재 설정
- **테스트 스테이지**: Stage 1 (나중에 Stage 6으로 변경 예정)
- `testBulletBossStage = 1`

#### 보스 페이즈 흐름
```
intro → shooting → vulnerable → (HIT) → shooting → vulnerable → ... → victory (4 HIT)
```

#### 사이드 롤 회피 시스템 (SPACE)
- **입력**: 스페이스바
- **동작**: 현재 진행 방향의 수직 방향으로 3칸 순간이동
- **방향**: 자동으로 위/아래 (또는 좌/우) 번갈아가며 롤
- **무적**: 롤 중 200ms 무적 프레임
- **쿨다운**: 1초
- **비주얼 효과**:
  - 잔상 (Ghost Trail): 4개 반투명 뱀 잔상 페이드아웃
  - "DODGE!" 텍스트 팝업
  - 착지 파티클 (먼지/스파크)
  - 무적 중 뱀 깜빡임
- **쿨다운 UI**: 화면 우측 하단에 게이지 표시

#### 총알 시스템
- **발사 패턴**:
  1. 8방향 방사형: 기본 패턴, 모든 방향으로 동시 발사
  2. 나선형 (Spiral): 회전하면서 발사, 피하기 어려움
  3. 조준 발사: 뱀 방향으로 유도탄
- **웨이브 증가**: HIT 할수록 패턴 복잡해짐
- **비주얼**: 마젠타 글로우 원형 + 트레일 효과
- **충돌 판정**: 무적 아닐 때 뱀 머리와 충돌 시 게임 오버

#### vulnerable 상태
- 총알 웨이브 발사 완료 후 2초간 vulnerable
- 보스가 마젠타색 → **초록색**으로 변하며 "HIT ME!" 표시
- 이 상태에서 보스 위치에 도달하면 HIT 판정

#### 인트로 연출
1. 튜토리얼 표시 (스페이스바 = 회피, 스킵 가능)
2. 화면 어둡게 + "WARNING!" 경고 + 카메라 쉐이크
3. 보스 랜덤 위치에 등장 (마젠타 플래시)
4. 보스 대사: "Hey, trash snake!" → "I've become STRONGER!"
5. "BULLET HELL!" 대형 텍스트 + 폭발 파티클
6. 게임 재개 (카운트다운 없이 바로 시작)

#### HIT 처리
1. 뱀이 보스 위치에 도달하면 HIT
2. "HIT X/4!" 텍스트 (기존 스타일)
3. 보스 폭발 이펙트 → 랜덤 위치로 텔레포트
4. 다음 웨이브 시작 (더 어려운 패턴)
5. 4번 HIT 시 victory 페이즈

#### 승리 연출
- 보스 대폭발 파티클
- "BOSS CLEAR!" + "+1000 BONUS!"
- 콤보 복원 후 상점 오픈 (또는 다음 스테이지)

#### 주요 변수
```javascript
this.bulletBossMode = false              // 탄막 보스 모드 활성화
this.bulletBossPhase = 'none'            // 'none' | 'intro' | 'shooting' | 'vulnerable' | 'victory'
this.bulletBossPosition = null           // 보스 위치 {x, y}
this.bulletBossHitCount = 0              // 보스 HIT 횟수 (4번 클리어)
this.bullets = []                        // 총알 배열
this.canDodge = true                     // 회피 가능 여부
this.isInvincible = false                // 회피 중 무적 상태
this.lastDodgeDirection = 'up'           // 번갈아가며 up/down
```

#### 주요 함수
```javascript
// 탄막 보스
startBulletBoss()                        // 탄막 보스 시작
showBulletBossIntro()                    // 인트로 연출
handleBulletBossHit()                    // HIT 처리
showBulletBossVictory()                  // 승리 연출

// 총알 시스템
fireRadialBullets(count, speed)          // 방사형 발사
fireSpiralBullets(count, offset, speed)  // 나선형 발사
fireAimedBullet(speed)                   // 조준 발사
updateBullets()                          // 60fps 위치 업데이트

// 회피 시스템
handleDodge()                            // 회피 실행
performSideRoll()                        // 사이드 롤 동작
showDodgeTutorial(callback)              // 튜토리얼 표시
```

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
this.shopLoanBtn = null                // 대출 버튼 (Stage 8+ 에서만 존재)
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
this.bossStageInterval = 3             // 보스 스테이지 간격
this.testBossStage = 3                 // 보스 스테이지 (3, 6, 9...)
```

### 원형 독가스 자기장 시스템
```javascript
this.gasZoneEnabled = false            // 자기장 활성화 여부
this.gasZoneRadius = 0                 // 현재 안전 영역 반경 (타일 단위)
this.gasZoneMinRadius = 4              // 최소 반경 (게임 가능 영역)
this.gasZoneTimer = null               // 확장 타이머
this.gasZoneExpandInterval = 2000      // 2초마다 확장
this.gasZoneGraphics = null            // 독가스 그래픽 객체
this.gasZoneParticles = []             // EMP 파티클들
this.gasZonePulseTime = 0              // 펄스 애니메이션용 타이머
this.gasZoneCenterX = 0                // 원 중심 X (타일)
this.gasZoneCenterY = 0                // 원 중심 Y (타일)
this.gasZoneAnimTimer = null           // 60fps 애니메이션 타이머
```

### 움직이는 톱니 시스템
```javascript
this.saws = []                         // 톱니 배열
// 각 톱니 객체:
// {
//   x, y,                    // 현재 위치
//   container,               // Phaser Container 객체
//   blade,                   // 톱니 블레이드 이미지
//   warningRing,             // 경고 링
//   spinTween,               // 회전 애니메이션
//   pulseTween,              // 펄스 애니메이션
//   breathTween,             // 호흡 애니메이션
//   moveDelay,               // 이동 딜레이 (ms)
//   canKill,                 // 충돌 판정 활성화 여부
//   nextPosition,            // 다음 이동 위치
//   lastDirection,           // 이전 이동 방향
//   nextStepSize,            // 다음 이동 스텝 (1 or 2)
//   moveTimer                // 이동 타이머
// }

this.sawTextureKey = 'deadly_saw'      // 톱니 텍스처 키
this.sawBaseDelay = 600                // 기본 이동 딜레이 (ms)
this.maxSaws = 5                       // 최대 톱니 개수
```

---

## 주요 함수

### 게임 루프
- `moveSnake()` - 뱀 이동, 충돌 체크, 먹이 먹기
- `draw()` - 뱀과 먹이 렌더링
- `generateFood()` - 새 먹이 위치 생성

### 데드존
- `startDeadZoneSequence()` - Stage 4 데드존 생성
- `addDeadZonesForStage4()` - Stage 5 데드존 3개 추가
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

### 원형 독가스 자기장
- `startGasZone()` - 자기장 시스템 시작
- `stopGasZone()` - 자기장 시스템 정지 (스테이지 리셋 시)
- `expandGasZone()` - 자기장 확장 (반경 감소)
- `isInGasZone(x, y)` - 해당 좌표가 독가스 영역인지 체크
- `renderGasZone()` - 독가스 영역 렌더링
- `renderGasZoneSparks()` - 전기 스파크 효과
- `updateGasZoneAnimation()` - 60fps 애니메이션 업데이트
- `showGasZonePreWarning()` - 확장 전 경고 표시
- `showGasZoneExpandEffect()` - 확장 시 EMP 효과
- `showGasZoneWarning()` - 위험 경고 메시지

### 움직이는 톱니
- `ensureSawTexture()` - 톱니 텍스처 생성 (최초 1회)
- `spawnSaw()` - 톱니 생성 (Stage 9, 매 먹이마다)
- `animateSawSpawn(saw)` - 톱니 생성 애니메이션 (경고 링 → 활성화)
- `activateSaw(saw)` - 톱니 활성화 (충돌 판정 시작)
- `startSawMovement(saw)` - 톱니 이동 시작
- `moveSaw(saw)` - 톱니 이동 처리 (방향 결정, 충돌 체크)
- `decideSawDirection(saw)` - 톱니 다음 방향 결정 (직진/좌회전/우회전)
- `isSawOccupyingTile(x, y)` - 해당 타일에 톱니가 있는지 체크
- `isSawTileDanger(x, y)` - 해당 타일이 톱니 위험 영역인지 체크
- `destroySaw(saw)` - 톱니 제거 (애니메이션 + 정리)
- `destroyAllSaws()` - 모든 톱니 제거 (스테이지 리셋 시)

---

## 스테이지별 특징

| Stage | 속도 | 데드존 | 텔레포트 | 상점 | 대출 | 특이사항 |
|-------|------|--------|----------|------|------|----------|
| 1 | 130ms | 없음 | 1회 | X | X | 십자가 후레쉬 (1~5번째 먹이) |
| 2 | 120ms | 없음 | 2회 | X | X | 십자가 후레쉬, 텔레포트 강화 |
| 3 | 110ms | 없음 | 2회 | X | X | **보스 스테이지** (1000점 보너스) |
| 4 | 100ms | 1개 | 2회 | O | X | 9번째 먹이 시 데드존, 상점 해금 |
| 5 | 90ms | +3개 | 2회 | O | X | 스테이지 시작 시 데드존 3개 추가 |
| 6 | 더 빠름 | - | 2회 | O | X | **보스 스테이지** |
| 7 | - | - | - | O | X | **안개(Fog of War)** - 시야 제한 |
| 8 | - | - | - | O | O | **원형 독가스 자기장**, 대출 기능 해금 (NEW 뱃지) |
| 9 | - | - | - | O | O | **움직이는 톱니** - 매 먹이마다 톱니 1개 생성 (최대 5개) |
| 12,15,18... | - | - | - | O | O | **보스 스테이지** (매 3스테이지) |

---

## 점수 계산

### 기본 점수
```javascript
const comboMultiplier = 1 + (combo - 1) * 0.5;
const earnedScore = Math.floor(10 * comboMultiplier);
```

### 예시 (Stage 3 올콤보)
- 60개 먹이 × 콤보 배율 (3스테이지 × 20개)
- 마지막 먹이 (20콤보): 105점

---

## 개발 참고

### Phaser 설정
- `pixelArt: true` (main.js)
- 해상도: 800x600 (조정 가능)

### 사운드
- BGM: `assets/bgm/snake_bgm.mp3`
- 이동: `assets/sfx/moving.mp3`
- 먹기: `assets/sfx/eating.mp3`

### 현재 설정
- `foodCount >= 20` - 먹이 20개로 스테이지 클리어
- `foodCount >= 5` - 6번째 먹이부터 파티클 효과
- `foodCount >= 15` - 16번째 먹이부터 텔레포트
- `currentStage >= 4` - Stage 4 클리어 후 상점 오픈
- `currentStage === 4` - Stage 4에서 첫 데드존 (9번째 먹이)
- `currentStage === 5` - Stage 5에서 추가 데드존 3개
- `currentStage >= 8` - Stage 8 클리어 후 대출 기능
- `currentStage >= 7` - Stage 7부터 안개(Fog of War)
- `currentStage === 8` - Stage 8에서 원형 독가스 자기장 활성화
- `currentStage === 9` - Stage 9에서 움직이는 톱니 시스템 활성화
- `bossHitCount >= 4` - 보스 먹이 4개로 클리어
- `testBossStage = 3` - Stage 3부터 보스전 (매 3스테이지)
- `gasZoneExpandInterval = 2000` - 자기장 2초마다 확장
- `gasZoneMinRadius = 4` - 자기장 최소 반경 4 타일
- `maxSaws = 5` - 최대 톱니 개수 5개
- `sawBaseDelay = 600` - 톱니 기본 이동 속도 600ms
