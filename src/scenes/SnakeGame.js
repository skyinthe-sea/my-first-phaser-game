import Phaser from 'phaser';

export default class SnakeGame extends Phaser.Scene {
  constructor() {
    super({ key: 'SnakeGame' });
  }

  preload() {
    // 배경음악 로드
    this.load.audio('bgm', 'assets/bgm/snake_bgm.mp3');
    // 이동 효과음 로드
    this.load.audio('moving', 'assets/sfx/moving.mp3');
    // 먹이 먹는 효과음 로드
    this.load.audio('eating', 'assets/sfx/eating.mp3');

    // 뱀 머리 스프라이트 로드 (2개로 4방향 구현)
    this.load.image('snake_head_side', 'assets/sprite/snake_head_side.png'); // 좌우
    this.load.image('snake_head_top', 'assets/sprite/snake_head_top.png');   // 위아래

    // 말풍선 이미지 로드
    this.load.image('bubble', 'assets/sprite/bubble.png');
  }

  create() {
    // 그래픽 객체 초기화
    this.graphics = null;
    this.snakeHeadTint = null;
    this.snakeBodyTint = null;
    this.snakeGlow = false;

    // 배경음악 설정 (첫 입력 후 재생)
    this.bgMusic = this.sound.add('bgm', {
      loop: true,
      volume: 0.8
    });

    // 이동 효과음
    this.movingSound = this.sound.add('moving', {
      volume: 0.3
    });

    // 먹이 먹는 효과음
    this.eatingSound = this.sound.add('eating', {
      volume: 0.5
    });

    // 첫 입력 시 음악 재생
    this.musicStarted = false;

    // 화면 크기
    const { width, height } = this.cameras.main;

    // UI 영역 높이
    this.uiHeight = 60;

    // UI 배경
    const uiBg = this.add.rectangle(0, 0, width, this.uiHeight, 0x1a1a1a, 0.95).setOrigin(0, 0).setDepth(2000);

    // 구분선
    this.add.rectangle(0, this.uiHeight, width, 2, 0x00ff00, 0.3).setOrigin(0, 0).setDepth(2000);

    // 그리드 설정 (UI 영역 제외)
    this.gridSize = 20;
    this.gameAreaY = this.uiHeight; // 게임 영역 시작 Y 좌표
    this.cols = Math.floor(width / this.gridSize);
    this.rows = Math.floor((height - this.uiHeight) / this.gridSize);

    // 뱀 초기화
    this.snake = [
      { x: 10, y: 15 },
      { x: 9, y: 15 },
      { x: 8, y: 15 }
    ];

    // 방향 (RIGHT)
    this.direction = 'RIGHT';
    this.inputQueue = []; // 입력 큐 (최대 2개까지 저장)

    // 먹이
    this.food = this.generateFood();
    // this.foodBubble은 generateFood()에서 checkAndShowFoodBubble()을 통해 자동으로 설정됨

    // 점수
    this.score = 0;
    this.foodCount = 0; // 먹은 먹이 개수

    // 스테이지 시스템
    this.currentStage = 1; // 현재 스테이지 (1~100)
    this.maxStages = 100; // 최대 스테이지

    // 뱀 머리 스프라이트 생성 (현재 미사용)
    this.snakeHeadSprite = this.add.sprite(0, 0, 'snake_head_side');
    this.snakeHeadSprite.setOrigin(0.5, 0.5);
    this.snakeHeadSprite.setScale(0.5); // 40px → 20px로 스케일 조정 (완벽한 정수 배율!)
    this.snakeHeadSprite.setVisible(false); // 사용 안함
    this.snakeHeadSprite.setDepth(100);

    // UI 텍스트들 - 4개 균등 배치
    const sectionWidth = width / 4;

    // SCORE 섹션
    this.add.text(sectionWidth * 0.5, 10, 'SCORE:', {
      fontSize: '12px',
      fill: '#888',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(2001);
    this.scoreText = this.add.text(sectionWidth * 0.5, 28, '0', {
      fontSize: '24px',
      fill: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(2001);

    // FOOD 섹션
    this.add.text(sectionWidth * 1.5, 10, 'FOOD:', {
      fontSize: '12px',
      fill: '#888',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(2001);
    this.foodCountText = this.add.text(sectionWidth * 1.5, 28, '0', {
      fontSize: '24px',
      fill: '#ff6600',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(2001);

    // COMBO 섹션
    this.add.text(sectionWidth * 2.5, 10, 'COMBO:', {
      fontSize: '12px',
      fill: '#888',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(2001);
    this.comboText = this.add.text(sectionWidth * 2.5, 28, '', {
      fontSize: '24px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#ff0000',
      strokeThickness: 2
    }).setOrigin(0.5, 0).setDepth(2001);

    // SPEED 섹션
    this.add.text(sectionWidth * 3.5, 10, 'SPEED:', {
      fontSize: '12px',
      fill: '#888',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(2001);
    this.speedText = this.add.text(sectionWidth * 3.5, 28, '130ms', {
      fontSize: '24px',
      fill: '#00aaff',
      fontStyle: 'bold'
    }).setOrigin(0.5, 0).setDepth(2001);

    // 먹이 텔레포트 시스템 (21번째부터)
    this.foodTeleportEnabled = false;
    this.currentFoodTeleported = false; // 현재 먹이가 이미 텔레포트되었는지
    this.nextTeleportStep = 0; // 다음 텔레포트까지 남은 스텝

    // 콤보 시스템
    this.combo = 0;
    this.maxCombo = 0; // 최대 콤보 추적
    this.directionChangesCount = 0; // 먹이 먹은 후 방향 전환 횟수
    this.hasEatenFirstFood = false; // 첫 먹이를 먹었는지 여부

    this.comboFeedback = null; // 콤보 피드백 표시용

    // 아이템 시스템
    this.items = []; // 현재 화면에 있는 아이템 배열
    this.itemSpawnTimer = null; // 아이템 생성 타이머
    this.nextItemDelay = 5000; // 다음 아이템까지 대기 시간 (밀리초)
    this.itemDelays = [5000, 4000, 3000, 2000]; // 아이템 생성 간격 (5초 -> 4초 -> 3초 -> 2초)
    this.itemDelayIndex = 0; // 현재 딜레이 인덱스

    // 키 입력 (입력 큐 시스템)
    this.input.keyboard.on('keydown-LEFT', () => {
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('LEFT');
    });
    this.input.keyboard.on('keydown-RIGHT', () => {
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('RIGHT');
    });
    this.input.keyboard.on('keydown-UP', () => {
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('UP');
    });
    this.input.keyboard.on('keydown-DOWN', () => {
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('DOWN');
    });

    // 게임 오버 플래그
    this.gameOver = false;

    // 배경 그리드 그리기
    this.drawGrid();

    // 초기 뱀과 먹이 그리기
    this.draw();

    // 타이머 이벤트로 뱀 이동 (150ms마다)
    this.moveTimer = this.time.addEvent({
      delay: 130,
      callback: this.moveSnake,
      callbackScope: this,
      loop: true
    });
  }

  drawGrid() {
    const graphics = this.add.graphics();
    graphics.lineStyle(1, 0x444444, 0.3);

    for (let x = 0; x <= this.cols; x++) {
      graphics.moveTo(x * this.gridSize, this.gameAreaY);
      graphics.lineTo(x * this.gridSize, this.cameras.main.height);
    }

    for (let y = 0; y <= this.rows; y++) {
      graphics.moveTo(0, y * this.gridSize + this.gameAreaY);
      graphics.lineTo(this.cameras.main.width, y * this.gridSize + this.gameAreaY);
    }

    graphics.strokePath();
  }

  startMusicOnFirstInput() {
    if (!this.musicStarted) {
      this.musicStarted = true;
      if (this.bgMusic) {
        this.bgMusic.play();
      }
    }
  }

  // 반대 방향인지 체크
  isOppositeDirection(dir1, dir2) {
    return (
      (dir1 === 'LEFT' && dir2 === 'RIGHT') ||
      (dir1 === 'RIGHT' && dir2 === 'LEFT') ||
      (dir1 === 'UP' && dir2 === 'DOWN') ||
      (dir1 === 'DOWN' && dir2 === 'UP')
    );
  }

  // 입력 큐에 방향 추가
  addDirectionToQueue(newDirection) {
    // 큐가 비어있으면 현재 방향 기준으로 체크
    if (this.inputQueue.length === 0) {
      // 현재 방향과 반대 방향이면 무시
      if (this.isOppositeDirection(this.direction, newDirection)) {
        return;
      }
      // 현재 방향과 같으면 무시
      if (this.direction === newDirection) {
        return;
      }
      // 유효한 입력이면 추가
      this.inputQueue.push(newDirection);
      if (this.movingSound) this.movingSound.play();
      this.directionChangesCount++;
      this.showDirectionChangeCounter();
    }
    // 큐에 이미 입력이 있으면 마지막 입력 기준으로 체크
    else if (this.inputQueue.length < 2) {
      const lastQueuedDirection = this.inputQueue[this.inputQueue.length - 1];
      // 큐의 마지막 방향과 반대 방향이면 무시
      if (this.isOppositeDirection(lastQueuedDirection, newDirection)) {
        return;
      }
      // 큐의 마지막 방향과 같으면 무시
      if (lastQueuedDirection === newDirection) {
        return;
      }
      // 유효한 입력이면 추가 (최대 2개까지)
      this.inputQueue.push(newDirection);
      if (this.movingSound) this.movingSound.play();
      this.directionChangesCount++;
      this.showDirectionChangeCounter();
    }
  }

  generateFood() {
    let foodPos;
    let validPosition = false;

    while (!validPosition) {
      // 맵 전체 영역에 랜덤 생성
      foodPos = {
        x: Phaser.Math.Between(0, this.cols - 1),
        y: Phaser.Math.Between(0, this.rows - 1)
      };

      validPosition = !this.snake.some(segment =>
        segment.x === foodPos.x && segment.y === foodPos.y
      );
    }

    // 먹이가 벽에 붙어있으면 말풍선 표시
    this.checkAndShowFoodBubble(foodPos);

    return foodPos;
  }

  checkAndShowFoodBubble(foodPos) {
    console.log('[DEBUG] checkAndShowFoodBubble called, foodPos:', foodPos);

    // 기존 말풍선 제거
    if (this.foodBubble) {
      console.log('[DEBUG] Removing old bubble before creating new one');

      // 즉시 보이지 않게 + alpha 0으로 설정
      if (this.foodBubble.image) {
        this.foodBubble.image.setVisible(false);
        this.foodBubble.image.setAlpha(0);
      }
      if (this.foodBubble.text) {
        this.foodBubble.text.setVisible(false);
        this.foodBubble.text.setAlpha(0);
      }

      // TweenManager에서 완전히 제거
      if (this.foodBubble.image && this.foodBubble.text) {
        this.tweens.killTweensOf([this.foodBubble.image, this.foodBubble.text]);
      }

      // 객체 제거
      if (this.foodBubble.image) {
        this.foodBubble.image.destroy();
      }
      if (this.foodBubble.text) {
        this.foodBubble.text.destroy();
      }
    }
    this.foodBubble = null;

    // 벽에 붙어있는지 체크
    const isOnLeftWall = foodPos.x === 0;
    const isOnRightWall = foodPos.x === this.cols - 1;
    const isOnTopWall = foodPos.y === 0;
    const isOnBottomWall = foodPos.y === this.rows - 1;

    if (!isOnLeftWall && !isOnRightWall && !isOnTopWall && !isOnBottomWall) {
      console.log('[DEBUG] Food not on wall, no bubble');
      return; // 벽에 안 붙어있으면 리턴
    }

    console.log('[DEBUG] Food on wall, creating bubble');

    // 재치있는 메시지 랜덤 선택
    const messages = ['Oops!', 'Sorry!', 'My bad!', 'Whoops!', 'Uh-oh!'];
    const message = Phaser.Utils.Array.GetRandom(messages);

    // 먹이 위치 계산 (픽셀 좌표)
    const foodX = foodPos.x * this.gridSize + this.gridSize / 2;
    const foodY = foodPos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 말풍선 위치 및 방향 결정
    let bubbleX = foodX;
    let bubbleY = foodY;
    let offsetX = 0;
    let offsetY = 0;
    let rotation = 0;
    let flipX = false;
    let flipY = false;

    // 벽 위치에 따른 말풍선 배치
    let originX = 0.5;
    let originY = 0.5;
    let textOffsetX = 0;
    let textOffsetY = 0;

    if (isOnLeftWall) {
      // 왼쪽 벽
      if (isOnTopWall) {
        // 왼쪽 위 모서리: 말풍선을 오른쪽 아래로
        offsetY = 30; // 아래쪽으로 변경
        originX = 1;
        originY = 0.5;
        textOffsetX = 38;
        textOffsetY = 2;
        rotation = -Math.PI;
      } else if (foodPos.x === 0 && foodPos.y === 1) {
        // 왼쪽 위 모서리 한 칸 아래 (0, 1)
        offsetY = 30; // 아래쪽으로 변경
        originX = 1;
        originY = 0.5;
        textOffsetX = 38;
        textOffsetY = 2;
        rotation = -Math.PI;
      } else if (foodPos.x === 0 && foodPos.y === 2) {
        // 왼쪽 위 모서리 한 칸 아래 (0, 1)
        offsetY = 30; // 아래쪽으로 변경
        originX = 1;
        originY = 0.5;
        textOffsetX = 38;
        textOffsetY = 2;
        rotation = -Math.PI;
      } else if (isOnBottomWall) {
        // 왼쪽 아래 모서리: 말풍선을 오른쪽 위로
        offsetX = 70;
        offsetY = -30;
        originX = 1;
        originY = 0.5;
        textOffsetX = -35;
        textOffsetY = -5;
        flipX = true;
      } else {
        // 왼쪽 벽 중간: 기본값 (오른쪽 위로)
        offsetX = 70;
        offsetY = -30;
        originX = 1;
        originY = 0.5;
        textOffsetX = -35;
        textOffsetY = -5;
        flipX = true;
      }
    } else if (isOnRightWall) {
      // 오른쪽 벽
      if (isOnTopWall) {
        // 오른쪽 위 모서리: 말풍선을 왼쪽 아래로
        offsetX = 5;
        offsetY = 30; // 아래쪽으로 변경
        originX = 0;
        originY = 0.5;
        textOffsetX = -35;
        textOffsetY = 5;
        rotation = -Math.PI;
        flipX = true;
      } else if (foodPos.x === this.cols - 1 && foodPos.y === 1) {
        offsetX = 5;
        offsetY = 30; // 아래쪽으로 변경
        originX = 0;
        originY = 0.5;
        textOffsetX = -35;
        textOffsetY = 5;
        rotation = -Math.PI;
        flipX = true;
      } else if (foodPos.x === this.cols - 1 && foodPos.y === 2) {
        offsetX = 5;
        offsetY = 30; // 아래쪽으로 변경
        originX = 0;
        originY = 0.5;
        textOffsetX = -35;
        textOffsetY = 5;
        rotation = -Math.PI;
        flipX = true;
      } else if (isOnBottomWall) {
        // 오른쪽 아래 모서리: 말풍선을 왼쪽 위로
        offsetX = -70;
        offsetY = -30;
        originX = 0;
        originY = 0.5;
        textOffsetX = 35;
        textOffsetY = -5;
        flipX = false;
      } else {
        // 오른쪽 벽 중간: 기본값 (왼쪽 위로)
        offsetX = -70;
        offsetY = -30;
        originX = 0;
        originY = 0.5;
        textOffsetX = 35;
        textOffsetY = -5;
        flipX = false;
      }
    } else if (isOnTopWall) {
      // 위쪽 벽
      if (foodPos.x === this.cols - 2 && foodPos.y === 0) {
        // 오른쪽 위 모서리 한 칸 왼쪽 (cols-2, 0)
        offsetY = 30;
        offsetX = -28;
        textOffsetY = 5;
        rotation = -Math.PI;
        flipX = true;
      } else if (foodPos.x === this.cols - 3 && foodPos.y === 0) {
        // 오른쪽 위 모서리 두 칸 왼쪽 (cols-2, 0)
        offsetY = 30;
        offsetX = -28;
        textOffsetY = 5;
        rotation = -Math.PI;
        flipX = true;
      } else {
        // 위쪽 벽 나머지: -180도 회전 (꼬리가 위)
        offsetY = 30;
        offsetX = 32;
        textOffsetY = 5;
        rotation = -Math.PI;
      }
    } else if (isOnBottomWall) {
      // 아래쪽 벽
      if (foodPos.x === 1 && foodPos.y === this.rows - 1) {
        // 왼쪽 아래 모서리 오른쪽 한 칸 (1, rows-1)
        offsetY = -35;
        offsetX = 20;
        textOffsetY = -5;
        rotation = 0;
        flipX = true;
      } else if (foodPos.x === 2 && foodPos.y === this.rows - 1) {
        // 왼쪽 아래 모서리 오른쪽 두 칸 (2, rows-1)
        offsetY = -35;
        offsetX = 20;
        textOffsetY = -5;
        rotation = 0;
        flipX = true;
      } else {
        // 아래쪽 벽 나머지: 회전 없이 위에 표시
        offsetY = -30;
        offsetX = -25;
        textOffsetY = -5;
        rotation = 0;
        flipX = false;
      }
    }

    bubbleX = foodX + offsetX;
    bubbleY = foodY + offsetY;

    // 말풍선 이미지 생성
    const bubbleImage = this.add.image(bubbleX, bubbleY, 'bubble')
      .setOrigin(originX, originY)
      .setDepth(1000)
      .setAlpha(0)
      .setScale(0.07); // 크기 더 축소 (0.09 -> 0.07)

    // 회전 및 반전 적용
    bubbleImage.setRotation(rotation);
    bubbleImage.setFlipX(flipX);

    // 빨간색 텍스트 생성 (말풍선 안에)
    const bubbleText = this.add.text(bubbleX + textOffsetX, bubbleY + textOffsetY, message, {
      fontSize: '11px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1001).setAlpha(0);

    // 페이드인 애니메이션
    this.tweens.add({
      targets: [bubbleImage, bubbleText],
      alpha: 1,
      duration: 300,
      ease: 'Power2'
    });

    // 말풍선 객체 저장
    this.foodBubble = {
      image: bubbleImage,
      text: bubbleText
    };
    console.log('[DEBUG] Bubble created and stored:', this.foodBubble);
  }

  moveSnake() {
    if (this.gameOver) return;

    // 먹이 텔레포트 체크 (각 먹이마다 1번씩)
    if (this.foodTeleportEnabled && !this.currentFoodTeleported && this.nextTeleportStep > 0) {
      this.nextTeleportStep--;
      if (this.nextTeleportStep === 0) {
        this.teleportFood();
        this.currentFoodTeleported = true; // 이 먹이는 텔레포트 완료
      }
    }

    // 큐에서 다음 방향 꺼내기
    if (this.inputQueue.length > 0) {
      this.direction = this.inputQueue.shift(); // 큐의 첫 번째 요소 꺼내기
    }

    // 새로운 머리 위치 계산
    const head = this.snake[0];
    let newHead = { x: head.x, y: head.y };

    switch (this.direction) {
      case 'LEFT':
        newHead.x -= 1;
        break;
      case 'RIGHT':
        newHead.x += 1;
        break;
      case 'UP':
        newHead.y -= 1;
        break;
      case 'DOWN':
        newHead.y += 1;
        break;
    }

    // 벽 충돌 체크
    if (newHead.x < 0 || newHead.x >= this.cols ||
        newHead.y < 0 || newHead.y >= this.rows) {
      this.endGame();
      return;
    }

    // 자기 몸 충돌 체크
    if (this.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      this.endGame();
      return;
    }

    // 뱀 이동
    this.snake.unshift(newHead);

    // 먹이를 먹었는지 체크
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      console.log('[DEBUG] ===== FOOD EATEN ===== at position:', newHead.x, newHead.y);
      console.log('[DEBUG] this.foodBubble before removal:', this.foodBubble);

      // 먹이 먹는 효과음 재생
      if (this.eatingSound) {
        this.eatingSound.play();
      }

      // 말풍선 제거
      if (this.foodBubble) {
        console.log('[DEBUG] Removing bubble at food eat (foodCount=' + this.foodCount + ')');

        // 즉시 보이지 않게 + alpha 0으로 설정
        if (this.foodBubble.image) {
          this.foodBubble.image.setVisible(false);
          this.foodBubble.image.setAlpha(0);
        }
        if (this.foodBubble.text) {
          this.foodBubble.text.setVisible(false);
          this.foodBubble.text.setAlpha(0);
        }

        // TweenManager에서 완전히 제거
        if (this.foodBubble.image && this.foodBubble.text) {
          this.tweens.killTweensOf([this.foodBubble.image, this.foodBubble.text]);
        }

        // 객체 제거
        if (this.foodBubble.image) {
          this.foodBubble.image.destroy();
        }
        if (this.foodBubble.text) {
          this.foodBubble.text.destroy();
        }

        console.log('[DEBUG] Bubble removed');
      } else {
        console.log('[DEBUG] No bubble to remove (this.foodBubble is null)');
      }
      this.foodBubble = null;

      this.foodCount++;

      // 10번째 먹이 먹으면 아이템 생성
      if (this.foodCount === 10) {
        this.spawnItem();
        // 다음 아이템 타이머 시작
        this.startItemSpawnTimer();
      }

      // 콤보 체크 (3번 방향전환 안에 먹었는지)
      if (this.directionChangesCount <= 3) {
        // 콤보 유지/증가
        this.combo++;
        // 최대 콤보 업데이트
        if (this.combo > this.maxCombo) {
          this.maxCombo = this.combo;
        }
        this.showComboEffect();

        // 콤보 텍스트 업데이트
        this.comboText.setText(`x${this.combo}`);
        // 콤보 텍스트 펄스 효과
        this.tweens.add({
          targets: this.comboText,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 100,
          yoyo: true,
          ease: 'Power2'
        });
      } else {
        // 콤보 끊김
        if (this.combo > 0) {
          this.showComboBroken();
        }
        this.combo = 0;
        this.comboText.setText('');
      }

      // 콤보에 따른 점수 배율
      const comboMultiplier = this.combo > 0 ? 1 + ((this.combo - 1) * 0.5) : 1;
      const earnedScore = Math.floor(10 * comboMultiplier);
      this.score += earnedScore;

      // 점수 UI 업데이트 + 애니메이션
      this.scoreText.setText(this.score.toString());
      this.tweens.add({
        targets: this.scoreText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 100,
        yoyo: true,
        ease: 'Power2'
      });

      // 먹이 개수 UI 업데이트 + 애니메이션
      this.foodCountText.setText(this.foodCount.toString());
      this.tweens.add({
        targets: this.foodCountText,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 100,
        yoyo: true,
        ease: 'Power2'
      });

      // 방향 전환 카운터 리셋 (0으로 되돌림)
      this.directionChangesCount = 0;

      // 먹이 먹은 효과 실행
      this.playFoodEffect();

      // 말풍선 제거 (새 먹이 생성 전)
      if (this.foodBubble) {
        console.log('[DEBUG] Removing bubble before generating new food');

        // 즉시 보이지 않게 + alpha 0으로 설정
        if (this.foodBubble.image) {
          this.foodBubble.image.setVisible(false);
          this.foodBubble.image.setAlpha(0);
        }
        if (this.foodBubble.text) {
          this.foodBubble.text.setVisible(false);
          this.foodBubble.text.setAlpha(0);
        }

        // TweenManager에서 완전히 제거
        if (this.foodBubble.image && this.foodBubble.text) {
          this.tweens.killTweensOf([this.foodBubble.image, this.foodBubble.text]);
        }

        // 객체 제거
        if (this.foodBubble.image) {
          this.foodBubble.image.destroy();
        }
        if (this.foodBubble.text) {
          this.foodBubble.text.destroy();
        }
      }
      this.foodBubble = null;

      this.food = this.generateFood();

      // 21번째 먹이부터 텔레포트 활성화
      if (this.foodCount >= 21) {
        this.foodTeleportEnabled = true;
        // 새 먹이에 대한 텔레포트 준비
        this.currentFoodTeleported = false; // 새 먹이는 아직 텔레포트 안됨
        this.nextTeleportStep = Phaser.Math.Between(1, 5); // 1~5 스텝 랜덤
      }

      // 10번째부터 먹이 파티클 효과
      if (this.foodCount >= 10) {
        this.createFoodParticles();
      }

      // 스테이지 클리어 체크 (20개 먹으면 클리어)
      if (this.foodCount >= 20) { // 20개 먹으면 클리어
        this.stageClear();
        return; // 클리어 시퀀스 시작하므로 여기서 리턴
      }

      // 속도 증가
      if (this.moveTimer.delay > 40) {
        this.moveTimer.delay -= 5;

        // 속도 UI 업데이트 + 애니메이션
        this.speedText.setText(this.moveTimer.delay + 'ms');
        this.tweens.add({
          targets: this.speedText,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 100,
          yoyo: true,
          ease: 'Power2'
        });
        // 색상 플래시 효과
        this.speedText.setColor('#ffff00');
        this.time.delayedCall(200, () => {
          this.speedText.setColor('#00aaff');
        });
      }
    } else {
      // 먹이를 안 먹었으면 꼬리 제거
      this.snake.pop();
    }

    // 아이템 업데이트 및 충돌 체크
    this.updateItems(newHead);

    // 화면 다시 그리기
    this.draw();
  }

  // ==================== 아이템 시스템 ====================

  startItemSpawnTimer() {
    if (this.itemSpawnTimer) {
      this.itemSpawnTimer.remove();
    }

    // 현재 딜레이 인덱스에 따른 대기 시간
    const delay = this.itemDelayIndex < this.itemDelays.length
      ? this.itemDelays[this.itemDelayIndex]
      : 2000; // 마지막 이후는 계속 2초

    this.itemSpawnTimer = this.time.addEvent({
      delay: delay,
      callback: () => {
        this.spawnItem();
        this.itemDelayIndex++;
        this.startItemSpawnTimer(); // 다음 타이머 시작
      },
      callbackScope: this
    });
  }

  spawnItem() {
    // 랜덤 시작 위치 (격자 기준)
    const startX = Phaser.Math.Between(0, this.cols - 2);
    const startY = Phaser.Math.Between(0, this.rows - 2);

    // 랜덤 이동 방향 및 속도
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const speed = this.moveTimer.delay / 2; // 뱀 속도의 절반

    // TODO: 아이템 타입 선택 로직 (여기에 랜덤 또는 가중치 기반 선택)
    const itemType = null; // 현재 아이템 없음

    if (!itemType) return; // 아이템 타입이 없으면 생성하지 않음

    // 아이템 생성
    const item = {
      type: itemType,
      gridX: startX,
      gridY: startY,
      pixelX: startX * this.gridSize,
      pixelY: startY * this.gridSize + this.gameAreaY,
      velocityX: Math.cos(angle) * (this.gridSize / speed),
      velocityY: Math.sin(angle) * (this.gridSize / speed),
      graphics: null,
      size: 2 // 2x2 격자 크기
    };

    // 아이템 그래픽 생성
    this.createItemGraphics(item);

    this.items.push(item);
  }

  createItemGraphics(item) {
    const graphics = this.add.graphics();
    graphics.setDepth(500);
    item.graphics = graphics;

    // TODO: 여기에 각 아이템 타입별 그래픽 생성 코드 추가
    // 예시:
    // if (item.type === 'item_name') {
    //   // 아이템 비주얼 그리기
    // }
  }

  updateItems(snakeHead) {
    const itemsToRemove = [];

    this.items.forEach((item, index) => {
      // 아이템 이동
      item.pixelX += item.velocityX;
      item.pixelY += item.velocityY;

      // 격자 좌표 업데이트
      item.gridX = Math.floor(item.pixelX / this.gridSize);
      item.gridY = Math.floor((item.pixelY - this.gameAreaY) / this.gridSize);

      // 그래픽 위치 업데이트
      if (item.graphics) {
        item.graphics.clear();

        // TODO: 여기에 각 아이템 타입별 그래픽 업데이트 코드 추가
        // if (item.type === 'item_name') {
        //   // 아이템 비주얼 다시 그리기
        // }

        // 텍스트 위치 업데이트
        if (item.text) {
          const centerX = item.pixelX + (this.gridSize * item.size) / 2;
          const centerY = item.pixelY + (this.gridSize * item.size) / 2;
          item.text.setPosition(centerX, centerY);
        }
      }

      // 화면 밖으로 나갔는지 체크
      const { width, height } = this.cameras.main;
      if (item.pixelX < -this.gridSize * item.size ||
          item.pixelX > width ||
          item.pixelY < this.gameAreaY - this.gridSize * item.size ||
          item.pixelY > height) {
        itemsToRemove.push(index);
        return;
      }

      // 뱀과 충돌 체크 (2x2 격자)
      for (let dx = 0; dx < item.size; dx++) {
        for (let dy = 0; dy < item.size; dy++) {
          if (snakeHead.x === item.gridX + dx && snakeHead.y === item.gridY + dy) {
            this.collectItem(item);
            itemsToRemove.push(index);
            return;
          }
        }
      }
    });

    // 제거할 아이템 처리
    itemsToRemove.reverse().forEach(index => {
      const item = this.items[index];
      if (item.graphics) item.graphics.destroy();
      if (item.text) item.text.destroy();
      this.items.splice(index, 1);
    });
  }

  collectItem(item) {
    const centerX = item.pixelX + (this.gridSize * item.size) / 2;
    const centerY = item.pixelY + (this.gridSize * item.size) / 2;

    // TODO: 여기에 각 아이템 타입별 효과 코드 추가
    // if (item.type === 'item_name') {
    //   // 아이템 효과 적용
    //   // 수집 비주얼 효과
    // }
  }

  teleportFood() {
    const oldFood = { ...this.food };
    const foodPixelPos = {
      x: oldFood.x * this.gridSize + this.gridSize / 2,
      y: oldFood.y * this.gridSize + this.gridSize / 2 + this.gameAreaY
    };

    // 사라지는 애니메이션 (빠르게)
    const disappearCircle = this.add.circle(foodPixelPos.x, foodPixelPos.y, this.gridSize / 2, 0xff0000, 1);
    this.tweens.add({
      targets: disappearCircle,
      scaleX: 0,
      scaleY: 0,
      alpha: 0,
      duration: 150,
      ease: 'Power2',
      onComplete: () => disappearCircle.destroy()
    });

    // 폭발 파티클
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const particle = this.add.circle(foodPixelPos.x, foodPixelPos.y, 3, 0xff0000, 1);
      this.tweens.add({
        targets: particle,
        x: foodPixelPos.x + Math.cos(angle) * 30,
        y: foodPixelPos.y + Math.sin(angle) * 30,
        alpha: 0,
        duration: 200,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 새 위치 생성
    this.food = this.generateFood();
    const newFoodPixelPos = {
      x: this.food.x * this.gridSize + this.gridSize / 2,
      y: this.food.y * this.gridSize + this.gridSize / 2 + this.gameAreaY
    };

    // 나타나는 애니메이션 (중간 속도로 페이드인)
    const appearCircle = this.add.circle(newFoodPixelPos.x, newFoodPixelPos.y, this.gridSize / 2, 0xff0000, 0);
    appearCircle.setScale(0.5);
    this.tweens.add({
      targets: appearCircle,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.out',
      onComplete: () => appearCircle.destroy()
    });

    // 링 효과
    const ring = this.add.circle(newFoodPixelPos.x, newFoodPixelPos.y, this.gridSize / 2, 0xff6600, 0);
    ring.setStrokeStyle(2, 0xff0000, 0.8);
    this.tweens.add({
      targets: ring,
      scaleX: 3,
      scaleY: 3,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });

    // 파티클 생성
    this.createFoodParticles();
  }

  createFoodParticles() {
    const foodPixelPos = {
      x: this.food.x * this.gridSize + this.gridSize / 2,
      y: this.food.y * this.gridSize + this.gridSize / 2 + this.gameAreaY
    };

    // 먹이 생성 효과 - 청록색/시안 계열로 강렬하게

    // 1. 강력한 중앙 플래시 (크고 밝게)
    const bigFlash = this.add.circle(foodPixelPos.x, foodPixelPos.y, this.gridSize * 2, 0x00ffff, 0.9);
    this.tweens.add({
      targets: bigFlash,
      scaleX: 3.5,
      scaleY: 3.5,
      alpha: 0,
      duration: 500,
      ease: 'Power3',
      onComplete: () => bigFlash.destroy()
    });

    // 2. 중앙에서 퍼지는 링 5개 (더 많이, 더 강하게)
    for (let i = 0; i < 5; i++) {
      const ring = this.add.circle(foodPixelPos.x, foodPixelPos.y, 8, 0x00ffff, 0);
      ring.setStrokeStyle(3, 0x00ffff, 1);
      this.tweens.add({
        targets: ring,
        scaleX: 5,
        scaleY: 5,
        alpha: 0,
        duration: 700,
        delay: i * 120,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }

    // 3. 십자가 모양 레이저 효과
    const crossColors = [0x00ffff, 0x00ddff, 0x00bbff, 0x0099ff];
    for (let i = 0; i < 4; i++) {
      const angle = (Math.PI / 2) * i; // 90도씩
      const beam = this.add.rectangle(
        foodPixelPos.x,
        foodPixelPos.y,
        60,
        4,
        crossColors[i],
        0.8
      );
      beam.setRotation(angle);
      beam.setDepth(1000);

      this.tweens.add({
        targets: beam,
        scaleX: 0,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => beam.destroy()
      });
    }

    // 4. 별 모양 파티클 12개 (사방으로 퍼짐, 더 많이)
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const star = this.add.text(foodPixelPos.x, foodPixelPos.y, '★', {
        fontSize: '20px',
        fill: '#00ffff'
      }).setOrigin(0.5).setAlpha(0).setDepth(1001);

      this.tweens.add({
        targets: star,
        x: foodPixelPos.x + Math.cos(angle) * 50,
        y: foodPixelPos.y + Math.sin(angle) * 50,
        alpha: 1,
        angle: 360,
        duration: 400,
        ease: 'Power2',
        onComplete: () => {
          this.tweens.add({
            targets: star,
            alpha: 0,
            scaleX: 0,
            scaleY: 0,
            duration: 200,
            onComplete: () => star.destroy()
          });
        }
      });
    }

    // 5. 반짝이는 작은 파티클들 (16개, 두 겹의 원형으로)
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const distance = this.gridSize * (i % 2 === 0 ? 1.5 : 2);
      const particle = this.add.circle(
        foodPixelPos.x + Math.cos(angle) * distance,
        foodPixelPos.y + Math.sin(angle) * distance,
        2,
        0x00ffff,
        0
      );
      particle.setDepth(1002);

      this.tweens.add({
        targets: particle,
        alpha: 1,
        scaleX: 3,
        scaleY: 3,
        duration: 250,
        delay: i * 20,
        yoyo: true,
        onComplete: () => particle.destroy()
      });
    }

    // 6. 펄스 효과 (안쪽에서 바깥으로)
    const pulse = this.add.circle(foodPixelPos.x, foodPixelPos.y, this.gridSize / 2, 0xffffff, 0.5);
    pulse.setDepth(999);
    this.tweens.add({
      targets: pulse,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 600,
      ease: 'Cubic.out',
      onComplete: () => pulse.destroy()
    });
  }

  showDirectionChangeCounter() {
    // 뱀 머리 위치
    const head = this.snake[0];
    const headPixelX = head.x * this.gridSize + this.gridSize / 2;
    const headPixelY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 남은 기회 계산
    const movesLeft = 4 - this.directionChangesCount;
    let displayText = '';
    let textColor = '';
    let strokeColor = '';

    if (movesLeft === 3) {
      displayText = '3';
      textColor = '#00ff00'; // 초록
      strokeColor = '#004400';
    } else if (movesLeft === 2) {
      displayText = '2';
      textColor = '#ffaa00'; // 주황
      strokeColor = '#664400';
    } else if (movesLeft === 1) {
      displayText = '1';
      textColor = '#ff0000'; // 빨강
      strokeColor = '#660000';
    } else if (movesLeft === 0) {
      displayText = 'X';
      textColor = '#666666'; // 회색
      strokeColor = '#222222';
    } else {
      return; // 4 이상이면 표시 안 함
    }

    // 화면 경계 체크를 위한 여유 공간
    const margin = 50;
    const { width, height } = this.cameras.main;

    // 기본 오프셋 (오른쪽 위)
    let offsetX = 30;
    let offsetY = -30;

    // 상단 경계 체크 (UI 영역 + 여유)
    if (headPixelY - margin < this.gameAreaY + 40) {
      offsetY = 30; // 아래쪽으로
    }

    // 우측 경계 체크
    if (headPixelX + margin > width - 40) {
      offsetX = -30; // 왼쪽으로
    }

    // 좌측 경계 체크
    if (headPixelX - margin < 40) {
      offsetX = 30; // 오른쪽으로 (기본값 유지)
    }

    // 하단 경계 체크
    if (headPixelY + margin > height - 40) {
      offsetY = -30; // 위쪽으로 (기본값 유지)
    }

    const counterText = this.add.text(headPixelX + offsetX, headPixelY + offsetY, displayText, {
      fontSize: '32px',
      fill: textColor,
      fontStyle: 'bold',
      stroke: strokeColor,
      strokeThickness: 4
    }).setOrigin(0.5, 0.5).setDepth(1500).setAlpha(0).setScale(0.5);

    // 애니메이션 방향 계산 (offset 방향으로)
    const animOffsetY = offsetY > 0 ? 10 : -10;

    // 재밌는 애니메이션: 빠르게 페이드인 + 스케일 + 위로 떠오름
    this.tweens.add({
      targets: counterText,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      y: headPixelY + offsetY + animOffsetY,
      duration: 150,
      ease: 'Back.out',
      onComplete: () => {
        // 잠시 유지 후 빠르게 페이드아웃
        this.tweens.add({
          targets: counterText,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          y: headPixelY + offsetY + animOffsetY * 2,
          duration: 200,
          delay: 100,
          ease: 'Power2',
          onComplete: () => counterText.destroy()
        });
      }
    });

    // 추가 효과: 링 확산
    const ring = this.add.circle(headPixelX + offsetX, headPixelY + offsetY, 10, 0xffffff, 0);
    ring.setStrokeStyle(2, textColor.replace('#', '0x'), 0.8);
    ring.setDepth(1499);
    this.tweens.add({
      targets: ring,
      scaleX: 2.5,
      scaleY: 2.5,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });
  }

  showComboEffect() {
    const { width, height } = this.cameras.main;

    // 콤보 레벨에 따른 효과
    let comboLevel = 1;
    if (this.combo >= 10) comboLevel = 4;
    else if (this.combo >= 5) comboLevel = 3;
    else if (this.combo >= 3) comboLevel = 2;

    // 콤보 색상 - 노란색/주황색 계열 (먹이 효과와 구분)
    const comboColors = {
      text: '#ffdd00',
      stroke: '#ff6600',
      particle: '#ff9900',
      flash: 0xffaa00
    };

    // 콤보 달성 텍스트
    const comboAnnounce = this.add.text(width / 2, height / 2, `COMBO x${this.combo}!`, {
      fontSize: 48 + (comboLevel * 12) + 'px',
      fill: comboColors.text,
      fontStyle: 'bold',
      stroke: comboColors.stroke,
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: comboAnnounce,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      y: height / 2 - 50,
      duration: 800,
      ease: 'Power2',
      onComplete: () => comboAnnounce.destroy()
    });

    // 레벨별 추가 효과
    if (comboLevel >= 2) {
      // 화면 가장자리 빛나는 효과 (주황색)
      const border = this.add.rectangle(width / 2, height / 2, width, height, comboColors.flash, 0)
        .setStrokeStyle(5, comboColors.flash, 0.8);

      this.tweens.add({
        targets: border,
        alpha: 0,
        duration: 500,
        onComplete: () => border.destroy()
      });
    }

    if (comboLevel >= 3) {
      // 화면 흔들림
      this.cameras.main.shake(200, 0.003);

      // 별 파티클 (주황색 계열)
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const star = this.add.text(width / 2, height / 2, '★', {
          fontSize: '32px',
          fill: comboColors.particle
        }).setOrigin(0.5);

        this.tweens.add({
          targets: star,
          x: width / 2 + Math.cos(angle) * 150,
          y: height / 2 + Math.sin(angle) * 100,
          alpha: 0,
          angle: 360,
          duration: 600,
          ease: 'Power2',
          onComplete: () => star.destroy()
        });
      }
    }

    if (comboLevel >= 4) {
      // 강한 배경 번쩍임 (주황색)
      const megaFlash = this.add.rectangle(0, 0, width, height, comboColors.flash, 0.4).setOrigin(0);
      this.tweens.add({
        targets: megaFlash,
        alpha: 0,
        duration: 400,
        onComplete: () => megaFlash.destroy()
      });
    }
  }

  showComboBroken() {
    const { width, height } = this.cameras.main;

    // 콤보 끊김 알림
    const brokenText = this.add.text(width / 2, height / 2, 'COMBO BROKEN!', {
      fontSize: '36px',
      fill: '#888888',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(1000);

    this.tweens.add({
      targets: brokenText,
      alpha: 0,
      y: height / 2 + 30,
      duration: 600,
      ease: 'Power2',
      onComplete: () => brokenText.destroy()
    });
  }

  playFoodEffect() {
    const { width, height } = this.cameras.main;
    const foodPos = {
      x: this.food.x * this.gridSize + this.gridSize / 2,
      y: this.food.y * this.gridSize + this.gridSize / 2 + this.gameAreaY
    };

    // 1~3개: 효과 없음
    if (this.foodCount <= 3) {
      return;
    }

    // 4~10개: 약한 효과
    if (this.foodCount >= 4 && this.foodCount <= 10) {
      // 먹이 위치에서 작은 스플래시
      const splash = this.add.circle(foodPos.x, foodPos.y, 10, 0xff0000, 0.6);
      this.tweens.add({
        targets: splash,
        scaleX: 3,
        scaleY: 3,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => splash.destroy()
      });

      // 뱀 머리 빨간색 깜빡임
      this.snakeHeadTint = 0xff0000;
      this.time.delayedCall(100, () => {
        this.snakeHeadTint = null;
      });
    }

    // 11~20개: 중간 효과
    if (this.foodCount >= 11 && this.foodCount <= 20) {
      // 큰 스플래시 + 링 효과
      const splash = this.add.circle(foodPos.x, foodPos.y, 15, 0xff0000, 0.8);
      this.tweens.add({
        targets: splash,
        scaleX: 5,
        scaleY: 5,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => splash.destroy()
      });

      // 링 효과
      for (let i = 0; i < 3; i++) {
        const ring = this.add.circle(foodPos.x, foodPos.y, 20, 0xff6600, 0);
        ring.setStrokeStyle(3, 0xff0000, 0.7);
        this.tweens.add({
          targets: ring,
          scaleX: 4,
          scaleY: 4,
          alpha: 0,
          duration: 600,
          delay: i * 100,
          ease: 'Cubic.out',
          onComplete: () => ring.destroy()
        });
      }

      // 뱀 전체 색상 변화
      this.snakeBodyTint = 0xff6600;
      this.time.delayedCall(200, () => {
        this.snakeBodyTint = null;
      });

      // 배경 약한 번쩍임
      const flash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.15).setOrigin(0);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 200,
        onComplete: () => flash.destroy()
      });
    }

    // 21개 이상: 강한 효과
    if (this.foodCount >= 21) {
      // 강력한 스플래시 폭발
      const splash = this.add.circle(foodPos.x, foodPos.y, 20, 0xff0000, 1);
      this.tweens.add({
        targets: splash,
        scaleX: 8,
        scaleY: 8,
        alpha: 0,
        duration: 500,
        ease: 'Power3',
        onComplete: () => splash.destroy()
      });

      // 다중 링 효과
      for (let i = 0; i < 5; i++) {
        const ring = this.add.circle(foodPos.x, foodPos.y, 25, 0xff0000, 0);
        ring.setStrokeStyle(4, 0xff0000, 0.9);
        this.tweens.add({
          targets: ring,
          scaleX: 6,
          scaleY: 6,
          alpha: 0,
          duration: 700,
          delay: i * 80,
          ease: 'Cubic.out',
          onComplete: () => ring.destroy()
        });
      }

      // 파티클 효과
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12;
        const particle = this.add.circle(foodPos.x, foodPos.y, 4, 0xff0000, 1);
        this.tweens.add({
          targets: particle,
          x: foodPos.x + Math.cos(angle) * 60,
          y: foodPos.y + Math.sin(angle) * 60,
          alpha: 0,
          duration: 500,
          ease: 'Power2',
          onComplete: () => particle.destroy()
        });
      }

      // 뱀 전체 강한 색상 변화 + 그림자
      this.snakeBodyTint = 0xff0000;
      this.snakeGlow = true;
      this.time.delayedCall(300, () => {
        this.snakeBodyTint = null;
        this.snakeGlow = false;
      });

      // 강한 배경 번쩍임
      const flash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.3).setOrigin(0);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 300,
        onComplete: () => flash.destroy()
      });

      // 화면 흔들림
      this.cameras.main.shake(150, 0.005);
    }
  }

  draw() {
    // 이전 프레임 지우기
    if (this.graphics) {
      this.graphics.clear();
    } else {
      this.graphics = this.add.graphics();
    }

    // 뱀 그리기
    this.snake.forEach((segment, index) => {
      // 글로우 효과 (강한 효과일 때)
      if (this.snakeGlow) {
        this.graphics.fillStyle(0xff0000, 0.3);
        this.graphics.fillCircle(
          segment.x * this.gridSize + this.gridSize / 2,
          segment.y * this.gridSize + this.gridSize / 2 + this.gameAreaY,
          this.gridSize
        );
      }

      if (index === 0) {
        // 머리 색상 (틴트 적용)
        if (this.snakeHeadTint) {
          this.graphics.fillStyle(this.snakeHeadTint);
        } else if (this.snakeBodyTint) {
          this.graphics.fillStyle(this.snakeBodyTint);
        } else {
          this.graphics.fillStyle(0x00ff00);
        }
      } else {
        // 몸통 색상
        if (this.snakeBodyTint) {
          this.graphics.fillStyle(this.snakeBodyTint);
        } else {
          this.graphics.fillStyle(0x00aa00);
        }
      }

      this.graphics.fillRect(
        segment.x * this.gridSize + 1,
        segment.y * this.gridSize + 1 + this.gameAreaY,
        this.gridSize - 2,
        this.gridSize - 2
      );
    });

    // 먹이 그리기
    this.graphics.fillStyle(0xff0000);
    this.graphics.fillCircle(
      this.food.x * this.gridSize + this.gridSize / 2,
      this.food.y * this.gridSize + this.gridSize / 2 + this.gameAreaY,
      this.gridSize / 2 - 2
    );
  }

  endGame() {
    this.gameOver = true;
    this.moveTimer.remove();

    // 아이템 타이머 정리
    if (this.itemSpawnTimer) {
      this.itemSpawnTimer.remove();
    }

    // 모든 아이템 제거
    this.items.forEach(item => {
      if (item.graphics) item.graphics.destroy();
      if (item.text) item.text.destroy();
    });
    this.items = [];

    // 배경음악 정지
    if (this.bgMusic) {
      this.bgMusic.stop();
    }

    const { width, height } = this.cameras.main;

    // 반투명 오버레이
    this.add.rectangle(0, 0, width, height, 0x000000, 0.7).setOrigin(0);

    // 게임 오버 텍스트
    this.add.text(width / 2, height / 2 - 80, 'GAME OVER', {
      fontSize: '64px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2, `Final Score: ${this.score}`, {
      fontSize: '32px',
      fill: '#fff'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 50, `Final Stage: ${this.currentStage}`, {
      fontSize: '32px',
      fill: '#00aaff'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 100, `Max Combo: x${this.maxCombo}`, {
      fontSize: '32px',
      fill: '#ffaa00'
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 + 160, 'Press SPACE to Restart', {
      fontSize: '24px',
      fill: '#aaa'
    }).setOrigin(0.5);

    // 스페이스바로 재시작
    this.input.keyboard.once('keydown-SPACE', () => {
      this.scene.restart();
    });

    // 클릭으로도 재시작 가능
    this.input.once('pointerdown', () => {
      this.scene.restart();
    });
  }

  stageClear() {
    // 게임 일시정지
    this.moveTimer.paused = true;

    const { width, height } = this.cameras.main;

    // 먹이 즉시 숨김
    this.graphics.clear();

    // 말풍선 제거
    if (this.foodBubble) {
      // 즉시 보이지 않게 + alpha 0으로 설정
      if (this.foodBubble.image) {
        this.foodBubble.image.setVisible(false);
        this.foodBubble.image.setAlpha(0);
      }
      if (this.foodBubble.text) {
        this.foodBubble.text.setVisible(false);
        this.foodBubble.text.setAlpha(0);
      }

      // TweenManager에서 완전히 제거
      if (this.foodBubble.image && this.foodBubble.text) {
        this.tweens.killTweensOf([this.foodBubble.image, this.foodBubble.text]);
      }

      // 객체 제거
      if (this.foodBubble.image) {
        this.foodBubble.image.destroy();
      }
      if (this.foodBubble.text) {
        this.foodBubble.text.destroy();
      }
    }
    this.foodBubble = null;

    // 뱀 점프 애니메이션
    this.playSnakeJumpAnimation(() => {
      // 점프 애니메이션 완료 후 STAGE CLEAR 표시
      this.showStageClearText();
    });
  }

  playSnakeJumpAnimation(onComplete) {
    const { width, height } = this.cameras.main;

    // 진행 방향에 따른 목표 위치 계산
    let targetX = 0;
    let targetY = 0;

    switch (this.direction) {
      case 'RIGHT':
        targetX = width + 300;
        break;
      case 'LEFT':
        targetX = -300;
        break;
      case 'UP':
        targetY = -300;
        break;
      case 'DOWN':
        targetY = height + 300;
        break;
    }

    // 각 세그먼트를 Rectangle 객체로 생성
    const segmentRects = [];
    this.snake.forEach((segment, index) => {
      const color = index === 0 ? 0x00ff00 : 0x00aa00;
      const startX = segment.x * this.gridSize + this.gridSize / 2;
      const startY = segment.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

      const rect = this.add.rectangle(
        startX,
        startY,
        this.gridSize - 2,
        this.gridSize - 2,
        color
      ).setDepth(4000);

      segmentRects.push(rect);

      // 각 세그먼트에 순차적 점프 (2.5D 효과)
      this.time.delayedCall(index * 80, () => {
        // Phase 1: 준비 동작 (작게)
        this.tweens.add({
          targets: rect,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 100,
          ease: 'Quad.easeIn',
          onComplete: () => {
            // Phase 2: 화면 밖으로 튀어나옴! (크게)
            this.tweens.add({
              targets: rect,
              scaleX: 4,
              scaleY: 4,
              duration: 300,
              ease: 'Back.easeOut',
              onComplete: () => {
                // Phase 3: 살짝 작아지며 화면 밖으로 사라짐
                this.tweens.add({
                  targets: rect,
                  scaleX: 0.5,
                  scaleY: 0.5,
                  alpha: 0,
                  duration: 350,
                  ease: 'Power2.easeIn',
                  onComplete: () => {
                    rect.destroy();
                    // 마지막 세그먼트 완료 시
                    if (index === this.snake.length - 1) {
                      if (onComplete) onComplete();
                    }
                  }
                });
              }
            });
          }
        });

        // 진행 방향으로 이동 (Z축 점프와 동시 진행)
        const finalX = this.direction === 'LEFT' || this.direction === 'RIGHT' ? targetX : startX;
        const finalY = this.direction === 'UP' || this.direction === 'DOWN' ? targetY : startY;

        this.tweens.add({
          targets: rect,
          x: finalX,
          y: finalY,
          duration: 800,
          ease: 'Power2.easeOut'
        });
      });
    });
  }

  showStageClearText() {
    const { width, height } = this.cameras.main;

    // STAGE CLEAR 텍스트
    const clearText = this.add.text(width / 2, height / 2 - 100, 'STAGE CLEAR!', {
      fontSize: '72px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#ff6600',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    // STAGE CLEAR 애니메이션 (줌인 + 페이드인)
    this.tweens.add({
      targets: clearText,
      scaleX: { from: 0, to: 1.2 },
      scaleY: { from: 0, to: 1.2 },
      alpha: { from: 0, to: 1 },
      duration: 500,
      ease: 'Back.easeOut'
    });

    // 카운트다운 텍스트 (처음에는 숨김)
    const countdownText = this.add.text(width / 2, height / 2 + 50, '', {
      fontSize: '96px',
      fill: '#00ffff',
      fontStyle: 'bold',
      stroke: '#0088ff',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(5001).setAlpha(0);

    // 0.5초 대기 후 카운트다운 시작
    this.time.delayedCall(500, () => {
      // 3, 2, 1 카운트다운
      let countdown = 3;
      countdownText.setText(countdown.toString());
      countdownText.setAlpha(1); // 표시

      // 카운트다운 애니메이션 (빠르게)
      const countdownTimer = this.time.addEvent({
        delay: 500, // 1000ms에서 500ms로 변경 (2배 빠르게)
        callback: () => {
          countdown--;
          if (countdown > 0) {
            countdownText.setText(countdown.toString());
            // 펄스 애니메이션
            this.tweens.add({
              targets: countdownText,
              scaleX: { from: 0.5, to: 1 },
              scaleY: { from: 0.5, to: 1 },
              duration: 200,
              ease: 'Back.easeOut'
            });
          } else {
            // 카운트다운 끝
            clearText.destroy();
            countdownText.destroy();

            // STAGE X 표시
            this.showNextStage();
          }
        },
        repeat: 2 // 3번 실행 (3, 2, 1)
      });
    });
  }

  showNextStage() {
    const { width, height } = this.cameras.main;

    // 다음 스테이지로 증가
    this.currentStage++;

    // 게임을 먼저 리셋하고 시작 (동시에 진행)
    this.resetStage();

    // STAGE X 텍스트 (상단에 투명하게 표시)
    const stageText = this.add.text(width / 2, height / 2 - 100, `STAGE ${this.currentStage}`, {
      fontSize: '96px',
      fill: '#00ff00',
      fontStyle: 'bold',
      stroke: '#008800',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    // STAGE X 애니메이션 (빠르게 페이드인 → 빠르게 페이드아웃)
    this.tweens.add({
      targets: stageText,
      alpha: { from: 0, to: 0.7 }, // 투명하지만 보이게
      scaleX: { from: 1.2, to: 1 },
      scaleY: { from: 1.2, to: 1 },
      duration: 300, // 500ms → 300ms로 빠르게
      ease: 'Power2',
      onComplete: () => {
        // 짧은 대기 후 빠르게 페이드아웃
        this.time.delayedCall(400, () => { // 1000ms → 400ms로 빠르게
          this.tweens.add({
            targets: stageText,
            alpha: 0,
            duration: 300, // 500ms → 300ms로 빠르게
            onComplete: () => {
              stageText.destroy();
            }
          });
        });
      }
    });
  }

  resetStage() {
    // 뱀 초기화
    this.snake = [
      { x: 10, y: 15 },
      { x: 9, y: 15 },
      { x: 8, y: 15 }
    ];

    // 방향 초기화
    this.direction = 'RIGHT';
    this.inputQueue = [];

    // 먹이 개수 리셋
    this.foodCount = 0;
    this.foodCountText.setText('0');

    // 콤보는 유지 (스테이지 넘어가도 이어짐)
    this.directionChangesCount = 0;

    // 먹이 생성
    this.food = this.generateFood();

    // 스테이지별 시작 속도 설정
    // 스테이지 1: 130ms, 스테이지 2: 120ms, 스테이지 3: 110ms...
    // 최소 속도는 40ms
    const startSpeed = Math.max(40, 130 - (this.currentStage - 1) * 10);
    this.moveTimer.delay = startSpeed;

    // 속도 UI 업데이트
    this.speedText.setText(startSpeed + 'ms');

    // 게임 재개
    this.moveTimer.paused = false;
  }

  update() {
    // 타이머 이벤트가 자동으로 moveSnake를 호출하므로
    // update에서는 아무것도 하지 않아도 됨
  }
}
