# Snake Game - 스프라이트 애니메이션 프로젝트

## 프로젝트 개요
Phaser 3 기반 Snake 게임. 뱀이 먹이를 먹으면서 길어지는 클래식 게임.
10번째 먹이를 먹은 후부터 뱀 머리에 재미있는 스프라이트 애니메이션 추가 예정.

## 파일 구조
```
/Users/imjunseob/my-phaser-game/
├── src/
│   ├── main.js              # Phaser 게임 설정 (pixelArt: true)
│   └── scenes/
│       └── SnakeGame.js     # 메인 게임 로직 (1272 lines)
├── public/
│   └── assets/
│       ├── bgm/             # 배경음악
│       ├── sfx/             # 효과음 (moving.mp3, eating.mp3)
│       ├── items/           # 아이템 이미지
│       └── sprite/          # 스프라이트 저장 위치 (여기에 추가할 예정)
└── CLAUDE.md               # 이 파일
```

## 현재 게임 구조 (SnakeGame.js)

### 주요 변수
- `this.snake` - 뱀 세그먼트 배열 (각 { x, y })
- `this.foodCount` - 먹은 먹이 개수
- `this.graphics` - Graphics 객체 (뱀과 먹이 그리기)
- `this.gridSize = 20` - 격자 크기 (픽셀)

### 현재 뱀 그리기 방식 (line 1158-1211)
```javascript
draw() {
  this.snake.forEach((segment, index) => {
    if (index === 0) {
      this.graphics.fillStyle(0x00ff00); // 머리: 초록색 네모
    } else {
      this.graphics.fillStyle(0x00aa00); // 몸통: 어두운 초록색 네모
    }
    this.graphics.fillRect(
      segment.x * this.gridSize + 1,
      segment.y * this.gridSize + 1 + this.gameAreaY,
      this.gridSize - 2,
      this.gridSize - 2
    );
  });
}
```

### 먹이 먹는 로직 (line 331-443)
- `line 331-335`: 먹이 충돌 감지 + eating.mp3 재생
- `line 337`: `this.foodCount++` (먹이 개수 증가)
- `line 339-344`: 10번째 먹이 먹으면 아이템 시스템 활성화
- `line 402-403`: `playFoodEffect()` 실행 후 새 먹이 생성

### 방향 변수
- `this.direction` - 'LEFT', 'RIGHT', 'UP', 'DOWN'

---

## 🎯 스프라이트 애니메이션 요구사항

### 1. 기존 게임 유지
- 1~9번째 먹이까지는 현재처럼 네모 머리로 진행

### 2. 10번째 먹이 먹은 후 - 머리 생성 애니메이션 ⭐
**타이밍**: `this.foodCount === 10` 직후
**동작**:
1. 게임 일시 정지 (`this.moveTimer.paused = true`)
2. 머리가 자라나는 애니메이션 재생:
   - 네모 머리 → 뱀 머리 스프라이트로 변환
   - 애니메이션 프레임: 4~8장 (부드럽게)
   - 지속 시간: 약 0.5~1초
3. 애니메이션 완료 후 게임 재개 (`this.moveTimer.paused = false`)
4. **향후 추가**: 머리 생성 BGM 재생 (파일 준비되면)

### 3. 먹이 먹는 애니메이션 ⭐
**타이밍**: 먹이 충돌 감지 직후 (line 331)
**동작**:
1. 먹이 먹는 순간 "꿀꺽" 애니메이션 재생
   - 입 벌림 → 최대로 벌림 → 삼킴 → 입 닫힘
   - 애니메이션 프레임: 4~8장
   - 지속 시간: 약 0.2~0.3초 (빠르게)
2. 애니메이션 완료 후 점수 추가 로직 계속 진행
3. **최적화**: 애니메이션 중에도 게임 진행 (비동기)

### 4. 방향별 머리 스프라이트 유지
**요구사항**:
- 10번째 먹이 이후부터 항상 스프라이트 사용
- `this.direction`에 따라 머리 회전/변경:
  - LEFT: 왼쪽 보는 뱀 머리
  - RIGHT: 오른쪽 보는 뱀 머리
  - UP: 위쪽 보는 뱀 머리
  - DOWN: 아래쪽 보는 뱀 머리
- 몸통은 그대로 네모 유지

### 5. BGM 추가 (향후)
- 머리 생성 시 특수 BGM/효과음 재생
- 파일 위치: `public/assets/bgm/` 또는 `sfx/`

---

## 🎨 필요한 스프라이트 목록

### Pixellab MCP로 생성할 스프라이트:

#### 1. **머리 생성 애니메이션** (head_grow.png)
- 스프라이트 시트 형태
- 프레임 수: 6~8장
- 각 프레임 크기: 20x20px (gridSize 기준)
- 내용: 네모 → 작은 뱀 머리 → 완전한 뱀 머리
- 스타일: 귀엽고 재미있는 뱀 (만화 스타일)

#### 2. **먹이 먹는 애니메이션 - 왼쪽** (snake_eat_left.png)
- 스프라이트 시트 형태
- 프레임 수: 6~8장
- 각 프레임 크기: 20x20px
- 내용: 입 닫힘 → 벌림 → 꿀꺽 → 닫힘
- 방향: 왼쪽 보는 방향

#### 3. **먹이 먹는 애니메이션 - 오른쪽** (snake_eat_right.png)
- 2번과 동일, 방향만 오른쪽

#### 4. **먹이 먹는 애니메이션 - 위** (snake_eat_up.png)
- 2번과 동일, 방향만 위

#### 5. **먹이 먹는 애니메이션 - 아래** (snake_eat_down.png)
- 2번과 동일, 방향만 아래

#### 6. **기본 머리 스프라이트 - 4방향** (snake_head.png)
- 스프라이트 시트 또는 개별 파일
- 각 20x20px
- 방향: LEFT, RIGHT, UP, DOWN
- idle 상태 (입 닫힌 평상시)

---

## 🔧 Pixellab MCP 워크플로우

### MCP 서버 상태
- ✅ 추가 완료: `/Users/imjunseob/my-phaser-game`
- ✅ 연결 확인: `claude mcp list` → "Connected"
- ⚠️ **중요**: Claude Code 재시작 후 MCP 도구 사용 가능

### 스프라이트 생성 단계
1. **Pixellab MCP 도구로 이미지 생성**
   - 프롬프트: "cute cartoon snake head sprite, 20x20px, pixel art style, [방향] facing"
   - 스프라이트 시트 생성 요청

2. **다운로드 및 저장**
   - 생성된 이미지를 `public/assets/sprite/` 폴더에 저장
   - 파일명: 위 목록 참고

3. **Phaser 로드 및 적용**
   - `preload()`: 스프라이트 시트 로드
   - 애니메이션 설정: `this.anims.create()`
   - `draw()` 함수 수정: Graphics → Sprite로 전환

---

## ✅ 다음 세션 작업 체크리스트

### Phase 1: Pixellab MCP 테스트
- [ ] Claude Code 재시작
- [ ] Pixellab MCP 도구 사용 가능 확인
- [ ] 테스트 이미지 1개 생성 (예: 뱀 머리 오른쪽)
- [ ] `public/assets/sprite/` 폴더에 저장 확인

### Phase 2: 스프라이트 생성
- [ ] 머리 생성 애니메이션 스프라이트 시트 생성
- [ ] 먹이 먹는 애니메이션 4방향 생성
- [ ] 기본 머리 스프라이트 4방향 생성

### Phase 3: 게임 코드 통합
- [ ] `SnakeGame.js` - `preload()` 스프라이트 로드 추가
- [ ] `create()` - 애니메이션 정의 추가
- [ ] 10번째 먹이 로직 수정 (머리 생성 애니메이션)
- [ ] 먹이 먹는 로직 수정 (꿀꺽 애니메이션)
- [ ] `draw()` 함수 수정 (Graphics → Sprite)
- [ ] 방향 전환 시 머리 스프라이트 회전 로직

### Phase 4: 테스트 및 최적화
- [ ] 애니메이션 재생 테스트
- [ ] 성능 확인 (프레임 드랍 체크)
- [ ] 타이밍 조정 (게임 일시정지 등)
- [ ] 버그 수정

### Phase 5: BGM 추가 (향후)
- [ ] 머리 생성 BGM 파일 준비
- [ ] 게임에 통합

---

## 💡 구현 힌트

### 스프라이트 vs Graphics 전환
**기존 (Graphics):**
```javascript
this.graphics.fillRect(x, y, width, height);
```

**변경 후 (Sprite):**
```javascript
// preload
this.load.spritesheet('snake_head', 'assets/sprite/snake_head.png', {
  frameWidth: 20,
  frameHeight: 20
});

// create
this.snakeHeadSprite = this.add.sprite(x, y, 'snake_head');

// update
this.snakeHeadSprite.setPosition(newX, newY);
this.snakeHeadSprite.setRotation(angle); // 방향 전환
```

### 애니메이션 재생
```javascript
// create
this.anims.create({
  key: 'head_grow',
  frames: this.anims.generateFrameNumbers('head_grow_sheet', { start: 0, end: 7 }),
  frameRate: 12,
  repeat: 0
});

// 재생
this.snakeHeadSprite.play('head_grow');
this.snakeHeadSprite.on('animationcomplete', () => {
  // 애니메이션 완료 후 처리
  this.moveTimer.paused = false;
});
```

---

## 🚨 주의사항

1. **Pixelart 모드**: `main.js`에서 `pixelArt: true` 설정되어 있음
   - 스프라이트도 픽셀아트 스타일 유지

2. **Grid 기반**: 모든 위치는 `gridSize(20px)` 단위
   - 스프라이트 크기도 20x20px 또는 그 배수로

3. **UI 영역**: `this.uiHeight = 60`, `this.gameAreaY = 60`
   - 게임 영역은 Y축 60px부터 시작

4. **최적화**: 스프라이트 개수 최소화
   - 머리 1개만 Sprite, 몸통은 Graphics 유지

---

## 📝 참고

- Phaser 버전: Phaser 3
- 현재 게임 속도: `moveTimer.delay = 150ms` (점점 빨라짐)
- 그리드: 40x27 (cols x rows, UI 제외)
