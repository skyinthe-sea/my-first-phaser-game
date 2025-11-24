import Phaser from 'phaser';
import { getShopItems } from '../data/items.js';
import { bankData, generateBankList, getRandomInRange } from '../data/banks.js';

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

    // 아이템 이미지 로드
    this.load.image('combo_shield', 'assets/items/combo_shield.png');
  }

  create() {
    // 그래픽 객체 초기화
    this.graphics = null;
    this.snakeHeadTint = null;
    this.snakeBodyTint = null;
    this.snakeGlow = false;

    // 십자가 후레쉬 라인 (6~15번째 먹이)
    this.crosshairLines = null;

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
    this.bottomUIHeight = 60;

    // 상단 UI 배경
    const uiBg = this.add.rectangle(0, 0, width, this.uiHeight, 0x1a1a1a, 0.95).setOrigin(0, 0).setDepth(2000);

    // 상단 구분선
    this.add.rectangle(0, this.uiHeight, width, 2, 0x00ff00, 0.3).setOrigin(0, 0).setDepth(2000);

    // 하단 UI 배경
    this.add.rectangle(0, height - this.bottomUIHeight, width, this.bottomUIHeight, 0x1a1a1a, 0.95).setOrigin(0, 0).setDepth(2000);

    // 하단 구분선
    this.add.rectangle(0, height - this.bottomUIHeight - 2, width, 2, 0x00ff00, 0.3).setOrigin(0, 0).setDepth(2000);

    // 그리드 설정 (상단/하단 UI 영역 제외)
    this.gridSize = 20;
    this.gameAreaY = this.uiHeight; // 게임 영역 시작 Y 좌표
    this.cols = Math.floor(width / this.gridSize);
    this.rows = Math.floor((height - this.uiHeight - this.bottomUIHeight) / this.gridSize);

    // 뱀 초기화
    this.snake = [
      { x: 10, y: 15 },
      { x: 9, y: 15 },
      { x: 8, y: 15 }
    ];

    // 방향 (RIGHT)
    this.direction = 'RIGHT';
    this.inputQueue = []; // 입력 큐 (최대 2개까지 저장)

    // 데드존 시스템 (stage 3부터) - generateFood()보다 먼저 초기화!
    this.deadZones = []; // 밟으면 죽는 칸들 [{x, y, rect}]
    this.deadZoneGraphics = this.add.graphics(); // 데드존 그리기용

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
    this.currentFoodTeleportCount = 0; // 현재 먹이가 몇 번 텔레포트되었는지 (최대 2번)
    this.nextTeleportStep = 0; // 다음 텔레포트까지 남은 스텝

    // 콤보 시스템
    this.combo = 0;
    this.maxCombo = 0; // 최대 콤보 추적
    this.directionChangesCount = 0; // 먹이 먹은 후 방향 전환 횟수
    this.hasEatenFirstFood = false; // 첫 먹이를 먹었는지 여부
    this.comboLost = false; // 실드 부족으로 콤보가 끊어졌는지
    this.shieldsUsedThisCycle = false; // 이번 먹이 사이클에서 실드가 사용되었는지

    this.comboFeedback = null; // 콤보 피드백 표시용

    // 아이템 시스템
    this.items = []; // 현재 화면에 있는 아이템 배열
    this.itemSpawnTimer = null; // 아이템 생성 타이머
    this.nextItemDelay = 5000; // 다음 아이템까지 대기 시간 (밀리초)
    this.itemDelays = [5000, 4000, 3000, 2000]; // 아이템 생성 간격 (5초 -> 4초 -> 3초 -> 2초)
    this.itemDelayIndex = 0; // 현재 딜레이 인덱스

    // 상점 시스템 (Stage 2 클리어 후 오픈)
    this.money = 0; // 보유 돈
    this.shopOpen = false; // 상점 열림 상태
    this.hasOpenedShopBefore = false; // 첫 상점 오픈 여부
    this.shopElements = []; // 상점 UI 요소들
    this.selectedShopIndex = 0; // 선택된 아이템 인덱스
    this.shopItems = getShopItems(); // items.js에서 아이템 데이터 로드
    this.shopKeyboardEnabled = false; // 상점 키보드 활성화
    this.isPurchaseConfirmOpen = false; // 구매 확인 창 상태
    this.lastShopFocusKey = null; // 포커스 변화를 감지해 마이크로 인터랙션 적용
    this.purchaseConfirmElements = []; // 구매 확인 알럿 구성 요소
    this.purchaseConfirmButtons = null; // 구매 확인 알럿 버튼 캐싱
    this.purchaseConfirmSelection = 'yes'; // 구매 확인 포커스 (yes/no)
    this.pendingPurchaseIndex = null; // 확인 후 구매할 아이템 인덱스
    this.lastPurchaseConfirmKey = null; // 구매 확인창 포커스 트래킹

    // 아이템 효과 상태
    this.comboShieldCount = 0; // 콤보 실드 개수 (여러 개 지원)
    this.hasHadShield = false; // 실드를 가졌던 적이 있는지 (NO SHIELD 표시용)
    this.hasSpeedBoost = false; // 스피드 부스트 수트 활성화
    this.speedBoostOrbitals = []; // 궤도 파티클들 (인게임용)
    this.speedBoostAngle = 0; // 궤도 회전 각도
    this.speedBoostOrbitalTimer = null; // 궤도 업데이트 타이머

    // 인게임 아이템 상태 UI (우측 하단)
    this.createItemStatusUI();

    // 뱅킹/대출 시스템 (전면 개편)
    this.loans = []; // 은행별 대출 배열 [{bankId, bankName, principal, interestRate, due}]
    this.loanTier = 0; // 현재 대출 티어 (0: 미대출, 1: 1차, 2: 2차, 3: 3차)
    this.totalDebt = 0; // 총 부채
    this.loanUIOpen = false; // 대출 UI 열림 상태
    this.isLoanProcessing = false; // 대출 처리 중 (엔터 연타 방지)
    this.loanElements = []; // 대출 UI 요소들
    this.selectedBankIndex = 0; // 선택된 은행 인덱스
    this.availableBanks = []; // 현재 이용 가능한 은행 목록
    this.loanMode = 'borrow'; // 'borrow' 또는 'repay'
    this.missedPayments = 0; // 연속 미납 횟수 (2회 = 게임오버)
    this.minimumPaymentRate = 0.1; // 최소 상환율 (총 부채의 10%)

    // 보스전 시스템
    this.isBossStage = false; // 보스 스테이지 여부
    this.bossMode = false; // 보스전 진행 중
    this.bossPhase = 'none'; // 'intro', 'trap', 'poisoned', 'battle', 'victory'
    this.snakePoisoned = false; // 독 상태 (보라색 뱀)
    this.poisonGrowthActive = false; // 독 성장 활성화
    this.poisonGrowthData = null; // 독 성장 데이터
    this.bossHitCount = 0; // 보스 적중 횟수 (4번 클리어)
    this.bossElement = null; // 보스 그래픽 요소
    this.bossPosition = null; // 보스 위치
    this.poisonGrowthTarget = 40; // 독 상태 목표 길이
    this.bossInputBlocked = false; // 보스 인트로 중 입력 차단
    this.poisonSpeedTarget = 40; // 독 상태 목표 속도
    this.savedCombo = 0; // 보스전 전 콤보 저장
    this.savedComboShieldCount = 0; // 보스전 전 실드 저장
    this.bossCorners = []; // 보스가 나타날 코너 위치들
    this.originalSnakeColor = 0x00ff00; // 원래 뱀 색상
    this.bossStageInterval = 3; // 보스 등장 스테이지 간격
    this.testBossStage = 3; // 보스 스테이지

    // 키 입력 (입력 큐 시스템)
    this.input.keyboard.on('keydown-LEFT', () => {
      if (this.bossInputBlocked) return;
      if (this.loanUIOpen) return;
      if (this.shopOpen) {
        this.handleShopInput('LEFT');
        return;
      }
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('LEFT');
    });
    this.input.keyboard.on('keydown-RIGHT', () => {
      if (this.bossInputBlocked) return;
      if (this.loanUIOpen) return;
      if (this.shopOpen) {
        this.handleShopInput('RIGHT');
        return;
      }
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('RIGHT');
    });
    this.input.keyboard.on('keydown-UP', () => {
      if (this.bossInputBlocked) return;
      if (this.loanUIOpen) {
        this.handleLoanInput('UP');
        return;
      }
      if (this.shopOpen) {
        this.handleShopInput('UP');
        return;
      }
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('UP');
    });
    this.input.keyboard.on('keydown-DOWN', () => {
      if (this.bossInputBlocked) return;
      if (this.loanUIOpen) {
        this.handleLoanInput('DOWN');
        return;
      }
      if (this.shopOpen) {
        this.handleShopInput('DOWN');
        return;
      }
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('DOWN');
    });

    // ENTER 키 (상점에서 다음 스테이지)
    this.input.keyboard.on('keydown-ENTER', () => {
      if (this.loanUIOpen) {
        this.handleLoanInput('ENTER');
        return;
      }
      if (this.shopOpen) {
        this.handleShopInput('ENTER');
      }
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
      this.checkComboShieldOnDirectionChange();
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
      this.checkComboShieldOnDirectionChange();
      this.showDirectionChangeCounter();
    }
  }

  // 방향전환 시 콤보 실드 체크 (4번째부터 매번 1개씩 소모)
  checkComboShieldOnDirectionChange() {
    // 보스 스테이지에서는 실드 소모 안함
    if (this.bossMode) return;

    // 이미 끊어졌으면 체크 불필요 (콤보가 0이어도 실드는 소모됨)
    if (this.comboLost) return;

    // 4번째 방향전환부터 실드 필요
    if (this.directionChangesCount >= 4) {
      if (this.comboShieldCount > 0) {
        // 실드 소모
        this.comboShieldCount--;
        this.shieldsUsedThisCycle = true; // 실드 사용 표시
        this.showShieldConsumedEffect();
        this.updateItemStatusUI();

        // 마지막 실드 소모 시 수트 해제 애니메이션
        if (this.comboShieldCount === 0) {
          this.showSuitRemovalEffect();
        }
      } else {
        // 실드 없음 - 콤보 끊김 예고
        this.comboLost = true;
        // 실드를 가졌다가 다 쓴 경우에만 NO SHIELD 표시 (최초 1회만)
        if (this.hasHadShield) {
          this.showComboLostWarning();
          this.hasHadShield = false; // 한 번 표시 후 리셋
        }
      }
    }
  }

  generateFood() {
    let foodPos;
    let validPosition = false;

    // 9번째 먹이(foodCount === 8)는 중앙 부근에 생성 (데드존 생성용)
    const shouldSpawnCenter = this.foodCount === 8;

    while (!validPosition) {
      if (shouldSpawnCenter) {
        // 중앙 부근에 생성 (화면 중앙 ±5칸 범위)
        const centerX = Math.floor(this.cols / 2);
        const centerY = Math.floor(this.rows / 2);
        foodPos = {
          x: Phaser.Math.Between(Math.max(5, centerX - 5), Math.min(this.cols - 6, centerX + 5)),
          y: Phaser.Math.Between(Math.max(5, centerY - 5), Math.min(this.rows - 6, centerY + 5))
        };
      } else {
        // 맵 전체 영역에 랜덤 생성
        foodPos = {
          x: Phaser.Math.Between(0, this.cols - 1),
          y: Phaser.Math.Between(0, this.rows - 1)
        };
      }

      // 뱀과 겹치지 않는지 체크
      const notOnSnake = !this.snake.some(segment =>
        segment.x === foodPos.x && segment.y === foodPos.y
      );

      // 데드존과 겹치지 않는지 체크
      const notOnDeadZone = !this.deadZones.some(dz =>
        dz.x === foodPos.x && dz.y === foodPos.y
      );

      validPosition = notOnSnake && notOnDeadZone;
    }

    // 먹이가 벽에 붙어있으면 말풍선 표시
    this.checkAndShowFoodBubble(foodPos);

    // 6~15번째 먹이일 때 십자가 후레쉬 효과
    this.showCrosshairEffect(foodPos);

    return foodPos;
  }

  checkAndShowFoodBubble(foodPos) {
    // 보스 스테이지에서는 말풍선 비활성화
    if (this.bossMode) return;

    // 기존 말풍선 제거
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

    // 벽에 붙어있는지 체크
    const isOnLeftWall = foodPos.x === 0;
    const isOnRightWall = foodPos.x === this.cols - 1;
    const isOnTopWall = foodPos.y === 0;
    const isOnBottomWall = foodPos.y === this.rows - 1;

    if (!isOnLeftWall && !isOnRightWall && !isOnTopWall && !isOnBottomWall) {
      return; // 벽에 안 붙어있으면 리턴
    }

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
  }

  showCrosshairEffect(foodPos) {
    // 기존 십자가 라인 제거
    if (this.crosshairLines) {
      // 모든 객체와 트윈 제거
      this.crosshairLines.forEach(obj => {
        this.tweens.killTweensOf(obj);
        obj.destroy();
      });
      this.crosshairLines = null;
    }

    // 보스 스테이지에서는 십자가 효과 비활성화
    if (this.bossMode) {
      return;
    }

    // stage 3 이상이면 후레쉬 효과 없음
    if (this.currentStage >= 3) {
      return;
    }

    // 0~4번째 먹이가 아니면 리턴 (첫 번째 먹이부터 5번째 먹이까지)
    if (this.foodCount >= 5) {
      return;
    }

    const foodX = foodPos.x * this.gridSize + this.gridSize / 2;
    const foodY = foodPos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    this.crosshairLines = [];

    // 1. 중심에서 퍼지는 빛 원형 펄스 (먹이 주변) - 하늘색
    const pulseCircle = this.add.circle(foodX, foodY, 20, 0x4dd0e1, 0.12);
    pulseCircle.setDepth(1); // 먹이 뒤로
    this.crosshairLines.push(pulseCircle);

    // 펄스 애니메이션 (크기 변화)
    this.tweens.add({
      targets: pulseCircle,
      scale: 1.8,
      alpha: 0,
      duration: 1200,
      ease: 'Cubic.easeOut',
      repeat: -1
    });

    // 2. 글로우 효과를 위한 다층 라인 (세로) - 하늘색, 더 흐릿하게
    const verticalX = foodPos.x * this.gridSize + this.gridSize / 2;

    // 세로 - 외곽 글로우 (매우 두껍고 매우 흐릿함)
    const vGlow = this.add.rectangle(
      verticalX,
      this.gameAreaY + (this.rows * this.gridSize / 2),
      15, // 20 → 15로 조정
      this.rows * this.gridSize,
      0x4dd0e1, // 하늘색
      0.04 // 0.08 → 0.04로 더 흐릿하게
    );
    vGlow.setDepth(1); // 먹이 뒤로
    this.crosshairLines.push(vGlow);

    // 세로 - 중간 레이어
    const vMid = this.add.rectangle(
      verticalX,
      this.gameAreaY + (this.rows * this.gridSize / 2),
      12,
      this.rows * this.gridSize,
      0x80deea, // 밝은 하늘색
      0.08 // 0.12 → 0.08로 더 흐릿하게
    );
    vMid.setDepth(1); // 먹이 뒤로
    this.crosshairLines.push(vMid);

    // 세로 - 중심 라인
    const vCore = this.add.rectangle(
      verticalX,
      this.gameAreaY + (this.rows * this.gridSize / 2),
      3, // 6 → 3으로 얇게
      this.rows * this.gridSize,
      0xb3e5fc, // 매우 밝은 하늘색
      0.15 // 0.25 → 0.15로 더 흐릿하게
    );
    vCore.setDepth(1); // 먹이 뒤로
    this.crosshairLines.push(vCore);

    // 3. 글로우 효과를 위한 다층 라인 (가로) - 하늘색, 더 흐릿하게
    const horizontalY = foodPos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 가로 - 외곽 글로우
    const hGlow = this.add.rectangle(
      this.cols * this.gridSize / 2,
      horizontalY,
      this.cols * this.gridSize,
      15, // 20 → 15로 조정
      0x4dd0e1, // 하늘색
      0.04 // 0.08 → 0.04로 더 흐릿하게
    );
    hGlow.setDepth(1); // 먹이 뒤로
    this.crosshairLines.push(hGlow);

    // 가로 - 중간 레이어
    const hMid = this.add.rectangle(
      this.cols * this.gridSize / 2,
      horizontalY,
      this.cols * this.gridSize,
      12,
      0x80deea, // 밝은 하늘색
      0.08 // 0.12 → 0.08로 더 흐릿하게
    );
    hMid.setDepth(1); // 먹이 뒤로
    this.crosshairLines.push(hMid);

    // 가로 - 중심 라인
    const hCore = this.add.rectangle(
      this.cols * this.gridSize / 2,
      horizontalY,
      this.cols * this.gridSize,
      3, // 6 → 3으로 얇게
      0xb3e5fc, // 매우 밝은 하늘색
      0.15 // 0.25 → 0.15로 더 흐릿하게
    );
    hCore.setDepth(1); // 먹이 뒤로
    this.crosshairLines.push(hCore);

    // 4. 깜빡이는 애니메이션 (부드러운 호흡)
    this.tweens.add({
      targets: [vCore, hCore],
      alpha: 0.06, // 0.1 → 0.06으로 더 흐릿하게
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1
    });

    this.tweens.add({
      targets: [vMid, hMid],
      alpha: 0.03, // 0.04 → 0.03으로 더 흐릿하게
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay: 150 // 약간 시차를 두어 파동 효과
    });

    this.tweens.add({
      targets: [vGlow, hGlow],
      alpha: 0.01, // 0.02 → 0.01로 더 흐릿하게
      duration: 1000,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
      delay: 300
    });
  }

  moveSnake() {
    if (this.gameOver) return;

    // 보스 인트로 중 이동 카운트 체크 (3칸 이동 후 대사)
    if (this.bossMode && this.bossPhase === 'intro' && this.bossIntroMoveCount !== undefined) {
      this.bossIntroMoveCount++;
      if (this.bossIntroMoveCount >= 5) {
        this.bossIntroMoveCount = undefined;
        this.moveTimer.paused = true;
        this.bossInputBlocked = true; // 입력 차단
        this.showSnakeDialogue();
        return;
      }
    }

    // 먹이 텔레포트 체크 (Stage 1: 1번, Stage 2+: 2번)
    const maxTeleports = this.currentStage === 1 ? 1 : 2;
    if (this.foodTeleportEnabled && this.currentFoodTeleportCount < maxTeleports && this.nextTeleportStep > 0) {
      this.nextTeleportStep--;
      if (this.nextTeleportStep === 0) {
        this.teleportFood();
        this.currentFoodTeleportCount++;

        // 최대 텔레포트 횟수가 아니면 다음 텔레포트 준비
        if (this.currentFoodTeleportCount < maxTeleports) {
          this.nextTeleportStep = Phaser.Math.Between(1, 5);
        }
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

    // 데드존 충돌 체크
    const hitDeadZone = this.deadZones.some(dz =>
      dz.x === newHead.x && dz.y === newHead.y
    );
    if (hitDeadZone) {
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
      // 먹이 먹는 효과음 재생
      if (this.eatingSound) {
        this.eatingSound.play();
      }

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

      // 보스전 처리
      if (this.bossMode) {
        if (this.bossPhase === 'trap') {
          // 함정 먹이 - 독 효과 시작
          this.handleBossTrap();
          this.draw();
          return;
        } else if (this.bossPhase === 'battle') {
          // 보스 적중
          if (this.bossHitCount === 3) {
            // 마지막 히트 - 슬로우모션
            this.handleBossFinalHit();
          } else {
            this.handleBossHit();
          }
          this.draw();
          return;
        }
      }

      this.foodCount++;

      // 9번째 먹이 먹으면 데드존 생성 시퀀스 시작 (stage 4에만)
      if (this.foodCount === 9 && this.currentStage === 4) {
        // 먼저 새 먹이 생성 및 파티클 효과
        this.playFoodEffect();

        // 말풍선 제거 (새 먹이 생성 전)
        if (this.foodBubble) {
          if (this.foodBubble.image && this.foodBubble.text) {
            this.tweens.killTweensOf([this.foodBubble.image, this.foodBubble.text]);
          }
          if (this.foodBubble.image) {
            this.foodBubble.image.setVisible(false);
            this.foodBubble.image.setAlpha(0);
          }
          if (this.foodBubble.text) {
            this.foodBubble.text.setVisible(false);
            this.foodBubble.text.setAlpha(0);
          }
          if (this.foodBubble.image) {
            this.foodBubble.image.destroy();
          }
          if (this.foodBubble.text) {
            this.foodBubble.text.destroy();
          }
        }
        this.foodBubble = null;

        // 새 먹이 생성
        this.food = this.generateFood();

        // 파티클 효과
        this.createFoodParticles();

        // 데드존 시퀀스 시작
        this.startDeadZoneSequence();
        return; // 시퀀스가 끝나면 게임이 재개되므로 여기서 리턴
      }

      // 아이템 생성 (데드존이 아닐 때)
      if (this.foodCount === 10) {
        this.spawnItem();
        // 다음 아이템 타이머 시작
        this.startItemSpawnTimer();
      }

      // 콤보 체크 (실드 부족으로 끊어졌는지 확인)
      if (this.comboLost) {
        // 실드 부족으로 콤보가 끊어진 경우
        this.showComboBroken();
        this.combo = 0;
        this.comboText.setText('');
        this.comboLost = false;
      } else {
        // 콤보 유지/증가 (3회 이내 또는 실드로 방어됨)
        this.combo++;
        // 최대 콤보 업데이트
        if (this.combo > this.maxCombo) {
          this.maxCombo = this.combo;
        }
        this.showComboEffect();

        // 실드로 방어된 경우 방패 효과 추가
        if (this.shieldsUsedThisCycle) {
          this.showComboShieldEffect();
        }

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
      this.shieldsUsedThisCycle = false; // 실드 사용 플래그 리셋

      // 먹이 먹은 효과 실행
      this.playFoodEffect();

      // 말풍선 제거 (새 먹이 생성 전)
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

      this.food = this.generateFood();

      // 16번째 먹이부터 20번째까지 텔레포트 활성화
      if (this.foodCount >= 15 && this.foodCount < 20) {
        this.foodTeleportEnabled = true;
        // 새 먹이에 대한 텔레포트 준비
        this.currentFoodTeleportCount = 0; // 새 먹이는 아직 텔레포트 안됨
        this.nextTeleportStep = Phaser.Math.Between(1, 5); // 1~5 스텝 랜덤
      } else {
        // 20번째 이후는 텔레포트 비활성화
        this.foodTeleportEnabled = false;
      }

      // 6번째부터 먹이 파티클 효과 (마지막 먹이 제외)
      if (this.foodCount >= 5 && this.foodCount < 19) {
        this.createFoodParticles();
      }

      // 스테이지 클리어 체크 - 보스전 중에는 비활성화
      // [임시] 테스트용: 5개 먹으면 클리어 (원래 20개)
      if (!this.bossMode && this.foodCount >= 5) {
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
      // 독 성장 중이면 꼬리 제거 안함 (성장)
      if (this.poisonGrowthActive && this.poisonGrowthData) {
        const data = this.poisonGrowthData;
        if (data.currentGrowth < data.growthNeeded) {
          // 속도 증가
          this.moveTimer.delay = Math.max(data.targetSpeed, this.moveTimer.delay - data.speedDecrease);
          data.currentGrowth++;

          // 성장 완료 체크
          if (data.currentGrowth >= data.growthNeeded) {
            this.poisonGrowthActive = false;
            // 보스전 본격 시작
            this.time.delayedCall(500, () => {
              this.startBossBattle();
            });
          }
        } else {
          this.snake.pop();
        }
      } else {
        // 먹이를 안 먹었으면 꼬리 제거
        this.snake.pop();
      }
    }

    // 아이템 업데이트 및 충돌 체크 (보스전 중에는 아이템 비활성화)
    if (!this.bossMode) {
      this.updateItems(newHead);
    }

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
    // 보스 스테이지에서는 방향 전환 카운터 비활성화
    if (this.bossMode) return;

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
      // 콤보 실드가 있으면 SHIELD! 표시
      if (this.comboShieldCount > 0) {
        displayText = 'SHIELD!';
        textColor = '#ffd700'; // 골드
        strokeColor = '#665500';
      } else {
        displayText = 'X';
        textColor = '#666666'; // 회색
        strokeColor = '#222222';
      }
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

  showComboShieldEffect() {
    const { width, height } = this.cameras.main;

    // 1. 화면 전체 플래시 (골드 → 화이트 → 페이드)
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 0.8)
      .setDepth(1000);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => flash.destroy()
    });

    // 2. 방패 아이콘 확대 효과 (중앙에서 커지면서 등장)
    const shieldIcon = this.add.text(width / 2, height / 2 - 60, '🛡️', {
      fontSize: '80px'
    }).setOrigin(0.5).setDepth(1002).setScale(0).setAlpha(0);

    this.tweens.add({
      targets: shieldIcon,
      scale: 1.5,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 방패 회전 + 축소 페이드
        this.tweens.add({
          targets: shieldIcon,
          scale: 0,
          alpha: 0,
          angle: 360,
          duration: 400,
          ease: 'Power2',
          onComplete: () => shieldIcon.destroy()
        });
      }
    });

    // 3. "COMBO SHIELD!!" 텍스트 - 글자별 등장
    const text = 'COMBO SHIELD!!';
    const letters = [];
    const startX = width / 2 - (text.length * 12);

    for (let i = 0; i < text.length; i++) {
      const letter = this.add.text(startX + i * 24, height / 2 + 20, text[i], {
        fontSize: '36px',
        fill: '#ffd700',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(1001).setScale(0).setAlpha(0);
      letters.push(letter);

      // 순차적 등장 애니메이션
      this.tweens.add({
        targets: letter,
        scale: 1.2,
        alpha: 1,
        y: height / 2 + 10,
        duration: 100,
        delay: i * 30,
        ease: 'Back.easeOut'
      });
    }

    // 글자 전체 펄스 + 페이드 아웃
    this.time.delayedCall(text.length * 30 + 200, () => {
      // 펄스
      this.tweens.add({
        targets: letters,
        scale: 1.4,
        duration: 100,
        yoyo: true,
        repeat: 1,
        onComplete: () => {
          // 페이드 아웃
          this.tweens.add({
            targets: letters,
            alpha: 0,
            y: height / 2 - 30,
            duration: 300,
            ease: 'Power2',
            onComplete: () => letters.forEach(l => l.destroy())
          });
        }
      });
    });

    // 4. 웨이브 링 효과 (3겹)
    for (let r = 0; r < 3; r++) {
      const ring = this.add.circle(width / 2, height / 2, 10, 0x000000, 0)
        .setStrokeStyle(4, 0xffd700, 1)
        .setDepth(1000);
      this.tweens.add({
        targets: ring,
        radius: 200 + r * 50,
        alpha: 0,
        duration: 600,
        delay: r * 100,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }

    // 5. 스파클 파티클 (별 모양)
    for (let i = 0; i < 30; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = 50 + Math.random() * 100;
      const sparkle = this.add.text(
        width / 2 + Math.cos(angle) * 30,
        height / 2 + Math.sin(angle) * 30,
        '✦',
        { fontSize: '16px', fill: '#ffd700' }
      ).setOrigin(0.5).setDepth(1001).setAlpha(1);

      this.tweens.add({
        targets: sparkle,
        x: width / 2 + Math.cos(angle) * distance,
        y: height / 2 + Math.sin(angle) * distance,
        alpha: 0,
        scale: 0,
        duration: 400 + Math.random() * 200,
        ease: 'Power2',
        onComplete: () => sparkle.destroy()
      });
    }

    // 6. 화면 테두리 골드 글로우 (펄스)
    const border = this.add.rectangle(width / 2, height / 2, width - 10, height - 10, 0x000000, 0)
      .setStrokeStyle(10, 0xffd700, 1)
      .setDepth(1000);
    this.tweens.add({
      targets: border,
      strokeAlpha: { from: 1, to: 0 },
      duration: 600,
      ease: 'Sine.easeOut',
      onComplete: () => border.destroy()
    });

    // 7. 화면 흔들림
    this.cameras.main.shake(200, 0.01);
  }

  showSuitRemovalEffect() {
    // 수트 해제 효과: 노란 머리가 파티클로 깨지면서 녹색으로 복원
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 1. 노란색 파티클이 깨지면서 날아감
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const particle = this.add.rectangle(
        headX,
        headY,
        4,
        4,
        0xffff00
      ).setDepth(500).setAlpha(1);

      this.tweens.add({
        targets: particle,
        x: headX + Math.cos(angle) * 50,
        y: headY + Math.sin(angle) * 50,
        alpha: 0,
        scale: 0,
        rotation: Math.random() * Math.PI * 2,
        duration: 400,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 2. 녹색 복원 글로우
    const glow = this.add.circle(headX, headY, 5, 0x00ff00, 0.8)
      .setDepth(499);
    this.tweens.add({
      targets: glow,
      radius: 25,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => glow.destroy()
    });

    // 3. "SUIT OFF" 텍스트 (작게)
    const text = this.add.text(headX, headY - 30, 'SUIT OFF', {
      fontSize: '14px',
      fill: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(501).setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1,
      y: headY - 50,
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: text,
          alpha: 0,
          y: headY - 70,
          duration: 300,
          delay: 200,
          onComplete: () => text.destroy()
        });
      }
    });
  }

  // 실드 소모 시 작은 애니메이션 (4번째 방향전환마다)
  showShieldConsumedEffect() {
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 작은 실드 아이콘이 깨지는 효과
    const shieldIcon = this.add.text(headX, headY - 20, '🛡️', {
      fontSize: '20px'
    }).setOrigin(0.5).setDepth(500).setAlpha(1);

    // 실드가 위로 올라가면서 깨지는 애니메이션
    this.tweens.add({
      targets: shieldIcon,
      y: headY - 50,
      alpha: 0,
      scale: 0.3,
      angle: 360,
      duration: 400,
      ease: 'Power2',
      onComplete: () => shieldIcon.destroy()
    });

    // 작은 파티클
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const particle = this.add.circle(headX, headY - 20, 2, 0xffd700)
        .setDepth(499).setAlpha(0.8);
      this.tweens.add({
        targets: particle,
        x: headX + Math.cos(angle) * 25,
        y: headY - 20 + Math.sin(angle) * 25,
        alpha: 0,
        duration: 300,
        onComplete: () => particle.destroy()
      });
    }

    // "-1" 텍스트
    const minusText = this.add.text(headX + 15, headY - 30, '-1', {
      fontSize: '12px',
      fill: '#ff6666',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(501).setAlpha(0);

    this.tweens.add({
      targets: minusText,
      alpha: 1,
      y: headY - 45,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: minusText,
          alpha: 0,
          duration: 200,
          delay: 100,
          onComplete: () => minusText.destroy()
        });
      }
    });
  }

  // 실드 부족으로 콤보 끊김 예고 (X 표시 + 빠른 머리색 복원)
  showComboLostWarning() {
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 1. 큰 X 표시
    const xMark = this.add.text(headX, headY - 30, '✗', {
      fontSize: '40px',
      fill: '#ff0000',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(502).setScale(0).setAlpha(0);

    this.tweens.add({
      targets: xMark,
      scale: 1.5,
      alpha: 1,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: xMark,
          scale: 0,
          alpha: 0,
          duration: 200,
          delay: 200,
          onComplete: () => xMark.destroy()
        });
      }
    });

    // 2. 빠른 머리색 복원 (노란색 → 녹색)
    // 노란색 파티클이 빠르게 튀어나감
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const particle = this.add.rectangle(headX, headY, 3, 3, 0xffff00)
        .setDepth(501).setAlpha(1);
      this.tweens.add({
        targets: particle,
        x: headX + Math.cos(angle) * 40,
        y: headY + Math.sin(angle) * 40,
        alpha: 0,
        rotation: Math.random() * Math.PI * 2,
        duration: 250,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 3. 녹색 플래시
    const flash = this.add.circle(headX, headY, 8, 0x00ff00, 0.9)
      .setDepth(500);
    this.tweens.add({
      targets: flash,
      radius: 30,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => flash.destroy()
    });

    // 4. 화면 흔들림 (작게)
    this.cameras.main.shake(100, 0.005);

    // 5. "NO SHIELD!" 텍스트
    const text = this.add.text(headX, headY + 30, 'NO SHIELD!', {
      fontSize: '12px',
      fill: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(501).setAlpha(0);

    this.tweens.add({
      targets: text,
      alpha: 1,
      y: headY + 40,
      duration: 200,
      onComplete: () => {
        this.tweens.add({
          targets: text,
          alpha: 0,
          duration: 300,
          delay: 300,
          onComplete: () => text.destroy()
        });
      }
    });
  }

  // 인게임 아이템 상태 UI 생성 (하단 UI 영역)
  createItemStatusUI() {
    const { height } = this.cameras.main;

    // 하단 UI 영역 중앙 Y 좌표
    const bottomUIY = height - this.bottomUIHeight / 2;

    // 실드 아이템 위치 (왼쪽에서 첫번째 슬롯)
    const shieldX = 80;

    // 아이템 슬롯 배경
    this.itemStatusBg = this.add.rectangle(shieldX, bottomUIY, 100, 44, 0x000000, 0.5)
      .setDepth(2001)
      .setStrokeStyle(2, 0x333333)
      .setAlpha(0);

    // 실드 아이콘
    this.itemStatusIcon = this.add.text(shieldX - 30, bottomUIY, '🛡️', {
      fontSize: '20px'
    }).setOrigin(0.5).setDepth(2002).setAlpha(0);

    // 실드 개수
    this.itemStatusCount = this.add.text(shieldX + 10, bottomUIY, '×0', {
      fontSize: '18px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0, 0.5).setDepth(2002).setAlpha(0);

    // 상태 라벨
    this.itemStatusLabel = this.add.text(shieldX, bottomUIY - 18, 'SHIELDS', {
      fontSize: '8px',
      fill: '#888888'
    }).setOrigin(0.5).setDepth(2002).setAlpha(0);
  }

  // 아이템 상태 UI 업데이트
  updateItemStatusUI() {
    // 실드가 0개면 UI 숨기기
    if (this.comboShieldCount === 0) {
      // 페이드아웃
      this.tweens.add({
        targets: [this.itemStatusBg, this.itemStatusIcon, this.itemStatusCount, this.itemStatusLabel],
        alpha: 0,
        duration: 300,
        ease: 'Power2'
      });
      return;
    }

    // 실드가 있으면 UI 표시
    const isNewlyVisible = this.itemStatusBg.alpha === 0;

    // 개수 업데이트
    this.itemStatusCount.setText(`×${this.comboShieldCount}`);

    // 색상 업데이트 (개수에 따라)
    if (this.comboShieldCount >= 3) {
      this.itemStatusCount.setFill('#00ff00'); // 녹색 - 여유
      this.itemStatusBg.setStrokeStyle(2, 0x00ff00);
    } else if (this.comboShieldCount === 2) {
      this.itemStatusCount.setFill('#ffff00'); // 노란색 - 보통
      this.itemStatusBg.setStrokeStyle(2, 0xffff00);
    } else {
      this.itemStatusCount.setFill('#ff4444'); // 빨간색 - 위험
      this.itemStatusBg.setStrokeStyle(2, 0xff4444);
    }

    if (isNewlyVisible) {
      // 첫 등장 애니메이션
      this.tweens.add({
        targets: this.itemStatusBg,
        alpha: 1,
        scaleX: { from: 0.5, to: 1 },
        scaleY: { from: 0.5, to: 1 },
        duration: 300,
        ease: 'Back.easeOut'
      });
      this.tweens.add({
        targets: [this.itemStatusIcon, this.itemStatusCount, this.itemStatusLabel],
        alpha: 1,
        duration: 300,
        delay: 100,
        ease: 'Power2'
      });
    } else {
      // 개수 변경 애니메이션
      this.tweens.add({
        targets: this.itemStatusCount,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 100,
        yoyo: true,
        ease: 'Power2'
      });
    }
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

    // 16개 이상: 강한 효과
    if (this.foodCount >= 16) {
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

  // ==================== 데드존 시스템 ====================

  startDeadZoneSequence() {
    // 게임 일시정지
    this.moveTimer.paused = true;

    // 랜덤 위치 선택 (뱀/먹이와 겹치지 않는 곳)
    let deadZonePos;
    let validPosition = false;

    while (!validPosition) {
      deadZonePos = {
        x: Phaser.Math.Between(0, this.cols - 1),
        y: Phaser.Math.Between(0, this.rows - 1)
      };

      // 뱀과 겹치지 않는지
      const notOnSnake = !this.snake.some(segment =>
        segment.x === deadZonePos.x && segment.y === deadZonePos.y
      );

      // 먹이와 겹치지 않는지
      const notOnFood = !(deadZonePos.x === this.food.x && deadZonePos.y === this.food.y);

      // 뱀의 진행방향 바로 앞에 생기지 않게 체크
      const snakeHead = this.snake[0];
      let nextX = snakeHead.x;
      let nextY = snakeHead.y;
      switch (this.direction) {
        case 'LEFT': nextX -= 1; break;
        case 'RIGHT': nextX += 1; break;
        case 'UP': nextY -= 1; break;
        case 'DOWN': nextY += 1; break;
      }
      const notInFrontOfSnake = !(deadZonePos.x === nextX && deadZonePos.y === nextY);

      validPosition = notOnSnake && notOnFood && notInFrontOfSnake;
    }

    // 깜빡이는 사각형 생성
    const rect = this.add.rectangle(
      deadZonePos.x * this.gridSize + this.gridSize / 2,
      deadZonePos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY,
      this.gridSize - 2,
      this.gridSize - 2,
      0x000000,
      1
    );
    rect.setDepth(50);

    // 깜빡임 애니메이션 (10번, 1.5초)
    let blinkCount = 0;
    const blinkTimer = this.time.addEvent({
      delay: 150,
      callback: () => {
        rect.setVisible(!rect.visible);
        blinkCount++;

        if (blinkCount >= 10) {
          blinkTimer.remove();
          rect.setVisible(true);
          rect.setFillStyle(0x000000, 1);

          // 경고 메시지 표시
          this.showDeadZoneWarning(rect, deadZonePos);
        }
      },
      loop: true
    });
  }

  showDeadZoneWarning(rect, deadZonePos) {
    const { width, height } = this.cameras.main;

    // 경고 텍스트
    const warningText = this.add.text(width / 2, height / 2, '', {
      fontSize: '32px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2000);

    const message = 'THIS WILL KILL YOU!';
    let charIndex = 0;

    // 타이핑 효과
    const typingTimer = this.time.addEvent({
      delay: 50,
      callback: () => {
        if (charIndex < message.length) {
          warningText.setText(message.substring(0, charIndex + 1));
          charIndex++;
        } else {
          typingTimer.remove();
          // 타이핑 완료 후 카운트다운
          this.time.delayedCall(500, () => {
            warningText.destroy();
            this.startCountdownAndResume(rect, deadZonePos);
          });
        }
      },
      loop: true
    });
  }

  startCountdownAndResume(rect, deadZonePos) {
    const { width, height } = this.cameras.main;

    // 카운트다운 텍스트
    const countdownText = this.add.text(width / 2, height / 2, '3', {
      fontSize: '64px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2000);

    let countdown = 3;
    const countdownTimer = this.time.addEvent({
      delay: 600,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          countdownText.setText(countdown.toString());
        } else {
          countdownText.setText('GO!');
          countdownTimer.remove();

          // GO! 표시 후 게임 재개
          this.time.delayedCall(400, () => {
            countdownText.destroy();

            // 데드존 저장
            this.deadZones.push({
              x: deadZonePos.x,
              y: deadZonePos.y,
              rect: rect
            });

            // 게임 재개
            this.moveTimer.paused = false;
          });
        }
      },
      loop: true
    });
  }

  addDeadZonesForStage4() {
    // 게임 일시정지
    this.moveTimer.paused = true;

    // 2개의 데드존 위치 찾기
    const deadZonePositions = [];
    for (let i = 0; i < 2; i++) {
      let deadZonePos;
      let validPosition = false;

      while (!validPosition) {
        deadZonePos = {
          x: Phaser.Math.Between(0, this.cols - 1),
          y: Phaser.Math.Between(0, this.rows - 1)
        };

        // 뱀과 겹치지 않는지
        const notOnSnake = !this.snake.some(segment =>
          segment.x === deadZonePos.x && segment.y === deadZonePos.y
        );

        // 먹이와 겹치지 않는지
        const notOnFood = !(deadZonePos.x === this.food.x && deadZonePos.y === this.food.y);

        // 뱀의 진행방향 바로 앞에 생기지 않게 체크
        const snakeHead = this.snake[0];
        let nextX = snakeHead.x;
        let nextY = snakeHead.y;
        switch (this.direction) {
          case 'LEFT': nextX -= 1; break;
          case 'RIGHT': nextX += 1; break;
          case 'UP': nextY -= 1; break;
          case 'DOWN': nextY += 1; break;
        }
        const notInFrontOfSnake = !(deadZonePos.x === nextX && deadZonePos.y === nextY);

        // 기존 데드존과 충분히 떨어져있는지 체크 (맨해튼 거리 5칸 이상)
        const farFromOtherDeadZones = [...this.deadZones, ...deadZonePositions].every(dz => {
          const distance = Math.abs(dz.x - deadZonePos.x) + Math.abs(dz.y - deadZonePos.y);
          return distance >= 5;
        });

        validPosition = notOnSnake && notOnFood && notInFrontOfSnake && farFromOtherDeadZones;
      }

      deadZonePositions.push(deadZonePos);
    }

    // 2개의 깜빡이는 사각형 생성
    const blinkRects = deadZonePositions.map(pos => {
      const rect = this.add.rectangle(
        pos.x * this.gridSize + this.gridSize / 2,
        pos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY,
        this.gridSize - 2,
        this.gridSize - 2,
        0x000000,
        1
      );
      rect.setDepth(50);
      return { rect, pos };
    });

    // 2개 동시 깜빡임 (10번, 1.5초)
    let blinkCount = 0;
    const blinkTimer = this.time.addEvent({
      delay: 150,
      callback: () => {
        blinkRects.forEach(({ rect }) => {
          rect.setVisible(!rect.visible);
        });
        blinkCount++;

        if (blinkCount >= 10) {
          blinkTimer.remove();
          blinkRects.forEach(({ rect }) => {
            rect.setVisible(true);
            rect.setFillStyle(0x000000, 1);
          });

          // 경고 메시지 표시
          this.showStage4Warning(() => {
            // 데드존 저장
            blinkRects.forEach(({ rect, pos }) => {
              this.deadZones.push({
                x: pos.x,
                y: pos.y,
                rect: rect
              });
            });

            // 카운트다운 후 게임 재개
            this.startCountdownAndResumeStage4();
          });
        }
      },
      loop: true
    });
  }

  showStage4Warning(onComplete) {
    const { width, height } = this.cameras.main;

    // 경고 텍스트
    const warningText = this.add.text(width / 2, height / 2, '', {
      fontSize: '32px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2000);

    const message = 'THIS TOO SHALL KILL YOU!';
    let charIndex = 0;

    // 타이핑 효과
    const typingTimer = this.time.addEvent({
      delay: 50,
      callback: () => {
        if (charIndex < message.length) {
          warningText.setText(message.substring(0, charIndex + 1));
          charIndex++;
        } else {
          typingTimer.remove();
          // 타이핑 완료 후 콜백 실행
          this.time.delayedCall(500, () => {
            warningText.destroy();
            onComplete();
          });
        }
      },
      loop: true
    });
  }

  startCountdownAndResumeStage4() {
    const { width, height } = this.cameras.main;

    // 카운트다운 텍스트
    const countdownText = this.add.text(width / 2, height / 2, '3', {
      fontSize: '64px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(2000);

    let countdown = 3;
    const countdownTimer = this.time.addEvent({
      delay: 600,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          countdownText.setText(countdown.toString());
        } else {
          countdownText.setText('GO!');
          countdownTimer.remove();

          // GO! 표시 후 게임 재개
          this.time.delayedCall(400, () => {
            countdownText.destroy();
            // 게임 재개
            this.moveTimer.paused = false;
          });
        }
      },
      loop: true
    });
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
        // 머리 색상
        if (this.snakePoisoned) {
          // 보스전 독 상태 - 보라색
          this.graphics.fillStyle(0x9900ff);
        } else if (this.comboShieldCount > 0) {
          // 콤보 실드가 있으면 노란색 - 수트 기능
          this.graphics.fillStyle(0xffff00);
        } else if (this.snakeHeadTint) {
          this.graphics.fillStyle(this.snakeHeadTint);
        } else if (this.snakeBodyTint) {
          this.graphics.fillStyle(this.snakeBodyTint);
        } else {
          this.graphics.fillStyle(0x00ff00);
        }
      } else {
        // 몸통 색상
        if (this.snakePoisoned) {
          // 보스전 독 상태 - 보라색
          this.graphics.fillStyle(0x7700cc);
        } else if (this.snakeBodyTint) {
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

    // 스피드 부스트 궤도는 별도 타이머에서 업데이트 (60fps 부드러운 애니메이션)

    // 먹이 그리기 (보스 요소가 있으면 건너뛰기)
    if (!this.bossElement) {
      const isFinalFood = this.foodCount === 19; // 다음 먹이가 20번째 (마지막)
      this.graphics.fillStyle(isFinalFood ? 0x00ff00 : 0xff0000);
      this.graphics.fillCircle(
        this.food.x * this.gridSize + this.gridSize / 2,
        this.food.y * this.gridSize + this.gridSize / 2 + this.gameAreaY,
        this.gridSize / 2 - 2
      );
    }
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

    // 보스 요소 정리
    if (this.bossElement) {
      this.bossElement.destroy();
      this.bossElement = null;
    }
    // 보스 HIT 텍스트 정리
    if (this.bossHitText) {
      this.tweens.killTweensOf(this.bossHitText);
      this.bossHitText.destroy();
      this.bossHitText = null;
    }
    this.bossMode = false;
    this.isBossStage = false;
    this.snakePoisoned = false;

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
      ease: 'Back.easeOut',
      onComplete: () => {
        // 상점 조건이면 바로 상점 열기 (카운트다운은 완료 후)
        // [임시] 테스트용: Stage 1 클리어 후 상점 오픈 (원래 Stage 2)
        if (this.currentStage >= 1) {
          this.time.delayedCall(500, () => {
            clearText.destroy();
            this.openShop();
          });
        } else {
          // 상점 없으면 기존대로 카운트다운
          this.startStageClearCountdown(clearText);
        }
      }
    });
  }

  startStageClearCountdown(clearText) {
    const { width, height } = this.cameras.main;

    // 상점이 없을 때도 스코어를 돈으로 전환
    if (this.score > 0) {
      this.money += this.score;

      // 간단한 스코어 전환 표시
      const scoreText = this.add.text(width / 2, height / 2 + 30, `+$${this.score}`, {
        fontSize: '24px',
        fill: '#00ff00',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(5001);

      this.tweens.add({
        targets: scoreText,
        y: height / 2,
        alpha: 0,
        duration: 800,
        onComplete: () => scoreText.destroy()
      });
    }

    // 카운트다운 텍스트
    const countdownText = this.add.text(width / 2, height / 2 + 50, '', {
      fontSize: '96px',
      fill: '#00ffff',
      fontStyle: 'bold',
      stroke: '#0088ff',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(5001).setAlpha(0);

    // 3, 2, 1 카운트다운
    let countdown = 3;
    countdownText.setText(countdown.toString());
    countdownText.setAlpha(1);

    this.time.addEvent({
      delay: 500,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          countdownText.setText(countdown.toString());
          this.tweens.add({
            targets: countdownText,
            scaleX: { from: 0.5, to: 1 },
            scaleY: { from: 0.5, to: 1 },
            duration: 200,
            ease: 'Back.easeOut'
          });
        } else {
          clearText.destroy();
          countdownText.destroy();
          this.showNextStage();
        }
      },
      repeat: 2
    });
  }

  showNextStage() {
    const { width, height } = this.cameras.main;

    // 다음 스테이지로 증가
    this.currentStage++;

    // 보스 스테이지 체크 (테스트: 2, 실제: 5, 10, 15...)
    const isBossStage = this.currentStage === this.testBossStage ||
                        (this.currentStage > this.testBossStage && this.currentStage % this.bossStageInterval === 0);

    if (isBossStage) {
      this.isBossStage = true;
      this.bossMode = true;
      // 콤보 상태 저장 (보스전 후 복원)
      this.savedCombo = this.combo;
      this.savedComboShieldCount = this.comboShieldCount;
      // 보스전 중에는 콤보 비활성화
      this.combo = 0;
      this.comboText.setText('');

      this.resetStage();
      // resetStage 이후에 bossPhase 설정 (resetStage가 'none'으로 리셋하기 때문)
      this.bossPhase = 'intro';
      // 보스 스테이지에서는 먹이 숨기기
      this.food = { x: -100, y: -100 };
      // 3칸 이동 후 대사 시작을 위한 카운터
      this.bossIntroMoveCount = 0;
      // 일반 스테이지 인트로로 진행 (아래 코드로 계속)
    }

    // 보스 스테이지 후 콤보 복원 (보스가 아닌 스테이지로 전환 시)
    if (!isBossStage && this.isBossStage) {
      this.isBossStage = false;
      this.bossMode = false;
      this.combo = this.savedCombo;
      this.comboShieldCount = this.savedComboShieldCount;
      if (this.combo > 0) {
        this.comboText.setText(`x${this.combo}`);
      }
      this.updateItemStatusUI();
    }

    // 보스 스테이지가 아닐 때만 리셋 (보스는 위에서 이미 리셋함)
    if (!isBossStage) {
      this.resetStage();
    }

    // 스피드 부스트 궤도 초기화 (60fps 독립 애니메이션)
    if (this.hasSpeedBoost) {
      this.initSpeedBoostOrbitals();
    }

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

              // Stage 5 시작 시 데드존 2개 추가 애니메이션
              if (this.currentStage === 5) {
                this.addDeadZonesForStage4();
              }
            }
          });
        });
      }
    });
  }

  resetStage() {
    // 스피드 부스트 궤도 정리 (새로 생성하기 전에)
    this.cleanupSpeedBoostOrbitals();

    // 뱀 초기화
    this.snake = [
      { x: 10, y: 15 },
      { x: 9, y: 15 },
      { x: 8, y: 15 }
    ];

    // 방향 초기화
    this.direction = 'RIGHT';
    this.inputQueue = [];

    // 보스전 상태 초기화
    this.bossPhase = 'none';
    this.bossHitCount = 0;
    this.poisonGrowthActive = false;
    this.poisonGrowthData = null;
    this.snakePoisoned = false;
    if (this.bossElement) {
      this.bossElement.destroy();
      this.bossElement = null;
    }

    // 먹이 개수 리셋
    this.foodCount = 0;
    this.foodCountText.setText('0');

    // 스코어 리셋 (매 스테이지 0에서 시작)
    this.score = 0;
    this.scoreText.setText('0');

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

  // =====================
  // 상점 시스템 (Balatro Style)
  // =====================

  openShop() {
    // 이미 상점이 열려있으면 중복 호출 방지
    if (this.shopOpen) return;

    // 인게임 스피드 부스트 궤도 정리 (상점에서는 프리뷰용으로 별도 표시)
    this.cleanupSpeedBoostOrbitals();

    this.shopOpen = true;
    this.isPurchaseConfirmOpen = false;
    this.purchaseConfirmSelection = 'yes';
    this.pendingPurchaseIndex = null;
    this.lastPurchaseConfirmKey = null;
    this.purchaseConfirmButtons = null;
    this.lastShopFocusKey = null;
    const { width, height } = this.cameras.main;

    // 기존 상점 요소가 남아있으면 정리
    if (this.shopElements && this.shopElements.length > 0) {
      this.shopElements.forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      this.shopElements = [];
    }
    if (this.shopCards && this.shopCards.length > 0) {
      this.shopCards.forEach(card => {
        if (card && card.destroy) card.destroy();
      });
      this.shopCards = [];
    }
    if (this.shopDebtElements && this.shopDebtElements.length > 0) {
      this.shopDebtElements.forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      this.shopDebtElements = [];
    }

    // 맵 위의 뱀 그래픽 정리 (보스전 후 보라색 뱀 등)
    this.snakePoisoned = false;
    this.graphics.clear();

    // 매 상점 오픈 시 아이템 목록 새로 로드
    this.shopItems = getShopItems();

    // 대출 이자 적용은 animateScoreToMoney에서 스코어 합산 후 처리
    // (스코어 + 기존돈 → 상환 → 최종금액)

    // 첫 상점 오픈 여부 확인
    const isFirstShop = !this.hasOpenedShopBefore;
    if (isFirstShop) {
      this.hasOpenedShopBefore = true;
    }

    // 어두운 오버레이 (페이드인)
    const overlay = this.add.rectangle(0, 0, width, height, 0x0a1628, 0)
      .setOrigin(0, 0)
      .setDepth(6000);
    this.shopElements.push(overlay);

    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.85,
      duration: 600,
      ease: 'Power2'
    });

    // 첫 상점 오픈 축하 애니메이션
    if (isFirstShop) {
      // 화면 플래시 효과
      const flash = this.add.rectangle(0, 0, width, height, 0xffffff, 0)
        .setOrigin(0, 0).setDepth(6150);
      this.tweens.add({
        targets: flash,
        fillAlpha: { from: 0, to: 0.8 },
        duration: 150,
        yoyo: true,
        onComplete: () => flash.destroy()
      });

      // 메인 축하 텍스트
      const unlockText = this.add.text(width / 2, height / 2 - 60, '🎊 SHOP UNLOCKED! 🎊', {
        fontSize: '48px',
        fill: '#ffff00',
        fontStyle: 'bold',
        stroke: '#ff0000',
        strokeThickness: 6
      }).setOrigin(0.5).setDepth(6100).setAlpha(0).setScale(0);

      // 서브 텍스트
      const subText = this.add.text(width / 2, height / 2 + 10, '✨ You can now buy powerful items! ✨', {
        fontSize: '22px',
        fill: '#00ffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(6100).setAlpha(0);

      // 대형 파티클 폭발 효과
      const colors = [0xffff00, 0xff6600, 0x00ff00, 0xff00ff, 0x00ffff, 0xff0000];

      // 중앙에서 퍼지는 파티클
      for (let i = 0; i < 60; i++) {
        const angle = (i / 60) * Math.PI * 2;
        const distance = Phaser.Math.Between(100, 250);
        const particle = this.add.circle(
          width / 2,
          height / 2,
          Phaser.Math.Between(4, 12),
          colors[i % colors.length],
          1
        ).setDepth(6099).setAlpha(0);

        this.tweens.add({
          targets: particle,
          alpha: { from: 0, to: 1 },
          x: width / 2 + Math.cos(angle) * distance,
          y: height / 2 + Math.sin(angle) * distance,
          scaleX: { from: 1.5, to: 0 },
          scaleY: { from: 1.5, to: 0 },
          duration: Phaser.Math.Between(1000, 2000),
          delay: Phaser.Math.Between(0, 300),
          ease: 'Power2',
          onComplete: () => particle.destroy()
        });
      }

      // 별 파티클 (위로 올라가는)
      for (let i = 0; i < 30; i++) {
        const star = this.add.text(
          Phaser.Math.Between(100, width - 100),
          height + 50,
          '⭐',
          { fontSize: Phaser.Math.Between(16, 32) + 'px' }
        ).setOrigin(0.5).setDepth(6098).setAlpha(0);

        this.tweens.add({
          targets: star,
          alpha: { from: 0, to: 1 },
          y: Phaser.Math.Between(-50, height / 2),
          rotation: Phaser.Math.Between(-2, 2),
          duration: Phaser.Math.Between(1500, 2500),
          delay: Phaser.Math.Between(100, 800),
          ease: 'Power1',
          onComplete: () => star.destroy()
        });
      }

      // 메인 텍스트 등장 (강렬한 바운스)
      this.tweens.add({
        targets: unlockText,
        alpha: 1,
        scale: { from: 0, to: 1.5 },
        duration: 600,
        ease: 'Back.easeOut',
        onComplete: () => {
          // 펄스 효과
          this.tweens.add({
            targets: unlockText,
            scale: { from: 1.5, to: 1.3 },
            duration: 300,
            yoyo: true,
            repeat: 2,
            ease: 'Sine.easeInOut'
          });

          // 무지개 색상 변화
          let colorIndex = 0;
          const rainbowColors = ['#ffff00', '#ff6600', '#ff00ff', '#00ffff', '#00ff00'];
          this.time.addEvent({
            delay: 150,
            repeat: 10,
            callback: () => {
              unlockText.setFill(rainbowColors[colorIndex % rainbowColors.length]);
              colorIndex++;
            }
          });
        }
      });

      // 서브 텍스트 등장
      this.tweens.add({
        targets: subText,
        alpha: 1,
        y: height / 2 + 30,
        scale: { from: 0.5, to: 1 },
        duration: 500,
        delay: 400,
        ease: 'Back.easeOut'
      });

      // 축하 텍스트 페이드아웃 후 상점 UI 표시
      this.time.delayedCall(2500, () => {
        this.tweens.add({
          targets: [unlockText, subText],
          alpha: 0,
          scale: 0.5,
          duration: 400,
          ease: 'Power2',
          onComplete: () => {
            unlockText.destroy();
            subText.destroy();
          }
        });
      });
    }

    // ===== 레이아웃 계산 =====
    const sidebarMargin = 10; // 화면 끝에서 간격
    const sidebarWidth = 140;
    const sidebarEndX = sidebarMargin + sidebarWidth;
    const rightAreaCenterX = sidebarEndX + (width - sidebarEndX) / 2;

    // ===== 네온 SHOP 타이틀 =====

    const titleBg = this.add.rectangle(rightAreaCenterX, 50, 200, 60, 0x8B0000, 1)
      .setDepth(6001)
      .setStrokeStyle(4, 0xff0000)
      .setAlpha(0);
    this.shopElements.push(titleBg);

    const title = this.add.text(rightAreaCenterX, 50, 'SHOP', {
      fontSize: '42px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#ff6600',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(6002).setAlpha(0);
    this.shopElements.push(title);

    // 타이틀 등장 애니메이션
    this.time.delayedCall(200, () => {
      this.tweens.add({
        targets: [titleBg, title],
        alpha: 1,
        scaleX: { from: 0, to: 1 },
        scaleY: { from: 0, to: 1 },
        duration: 400,
        ease: 'Back.easeOut'
      });

      // 네온 깜빡임 효과
      this.time.delayedCall(500, () => {
        this.tweens.add({
          targets: title,
          alpha: { from: 1, to: 0.7 },
          duration: 100,
          yoyo: true,
          repeat: 2,
          onComplete: () => {
            // 지속적인 네온 펄스
            this.shopNeonTween = this.tweens.add({
              targets: title,
              alpha: { from: 1, to: 0.8 },
              duration: 1500,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut'
            });
          }
        });
      });
    });

    // ===== 왼쪽 사이드바 =====
    const sidebarX = -sidebarWidth;
    const sidebarFinalX = sidebarMargin + sidebarWidth / 2;

    const sidebar = this.add.rectangle(sidebarFinalX, height / 2, sidebarWidth, height - 80, 0x1a1a2e, 0.95)
      .setDepth(6001)
      .setStrokeStyle(2, 0x3d5a80)
      .setX(sidebarX);
    this.shopElements.push(sidebar);

    // 사이드바 슬라이드 인
    this.tweens.add({
      targets: sidebar,
      x: sidebarFinalX,
      duration: 500,
      ease: 'Back.easeOut',
      delay: 300
    });

    // 사이드바 내용
    const sidebarContent = [];
    const contentX = sidebarMargin + 10;
    const contentCenterX = sidebarMargin + sidebarWidth / 2;

    // 스테이지 표시
    const stageLabel = this.add.text(contentX, 100, 'STAGE', {
      fontSize: '12px',
      fill: '#888888',
      fontStyle: 'bold'
    }).setDepth(6002).setAlpha(0);
    sidebarContent.push(stageLabel);

    const stageValue = this.add.text(contentCenterX, 125, `${this.currentStage}`, {
      fontSize: '28px',
      fill: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6002).setAlpha(0);
    sidebarContent.push(stageValue);

    // 돈 표시
    const moneyLabel = this.add.text(contentX, 170, 'MONEY', {
      fontSize: '12px',
      fill: '#888888',
      fontStyle: 'bold'
    }).setDepth(6002).setAlpha(0);
    sidebarContent.push(moneyLabel);

    this.shopMoneyText = this.add.text(contentCenterX, 195, `$${this.money}`, {
      fontSize: '24px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(6002).setAlpha(0);
    sidebarContent.push(this.shopMoneyText);

    this.shopElements.push(...sidebarContent);

    // 빚 정보는 updateShopDebtInfo에서 관리 (중복 방지)
    this.shopDebtElements = [];

    // 사이드바 내용 페이드인
    this.time.delayedCall(600, () => {
      sidebarContent.forEach((el, i) => {
        this.tweens.add({
          targets: el,
          alpha: 1,
          duration: 300,
          delay: i * 50,
          ease: 'Power2'
        });
      });
      // 빚 정보 표시 - 정산 완료 후에 표시됨 (animateScoreToMoney에서 호출)
      // 스코어가 있으면 정산이 진행되므로 여기서는 표시하지 않음
      if (this.score === 0) {
        this.time.delayedCall(sidebarContent.length * 50 + 100, () => {
          this.updateShopDebtInfo();
        });
      }
    });

    // ===== 아이템 카드들 =====
    this.shopCards = [];
    const cardWidth = 100;
    const cardHeight = 140;
    const cardSpacing = 120;
    const cardY = 200;
    // 우측 영역 중앙 기준으로 카드 배치
    const totalCardsWidth = (this.shopItems.length - 1) * cardSpacing;
    const cardStartX = rightAreaCenterX - totalCardsWidth / 2;

    // 총 돈 계산 (현재 money + 획득할 score)
    const totalMoney = this.money + this.score;

    this.shopItems.forEach((item, index) => {
      const cardX = cardStartX + index * cardSpacing;
      const canAfford = totalMoney >= item.price;

      // 카드 컨테이너
      const card = this.add.container(cardX, -200).setDepth(6001);

      // 구매 불가 아이템은 처음부터 어둡게
      if (!item.purchased && !canAfford) {
        card.setAlpha(0.5);
      }

      // 카드 배경
      const cardBg = this.add.rectangle(0, 0, cardWidth, cardHeight, 0x2a3f5f, 1)
        .setStrokeStyle(3, item.purchased ? 0x666666 : 0x4a9eff);

      // 카드 내부 패턴
      const cardInner = this.add.rectangle(0, -20, cardWidth - 20, cardHeight - 60, 0x1a2a3f, 1);

      // 아이템 아이콘 (이미지 또는 이모지)
      let iconElement;
      if (item.icon && this.textures.exists(item.icon)) {
        // 이미지가 있으면 이미지 사용
        iconElement = this.add.image(0, -20, item.icon)
          .setDisplaySize(64, 64);
      } else {
        // 이미지가 없으면 기본 이모지
        const defaultIcons = ['⚡', '×2', '❤', '🧲', '🛡'];
        iconElement = this.add.text(0, -25, defaultIcons[index] || '?', {
          fontSize: '32px'
        }).setOrigin(0.5);
      }

      // 아이템 이름
      const nameText = this.add.text(0, 30, item.name.split(' ')[0], {
        fontSize: '11px',
        fill: item.purchased ? '#666666' : '#ffffff',
        fontStyle: 'bold'
      }).setOrigin(0.5);

      // 가격 태그 (구매 가능 여부에 따라 색상)
      const priceTagColor = item.purchased ? 0x666666 : (canAfford ? 0x00aa00 : 0x661111);
      const priceTagStroke = item.purchased ? 0x444444 : (canAfford ? 0x00ff00 : 0xff4444);
      const priceTag = this.add.rectangle(0, -cardHeight / 2 - 15, 40, 20, priceTagColor, 1)
        .setStrokeStyle(2, priceTagStroke);

      const priceTextColor = item.purchased ? '#666666' : (canAfford ? '#00ff00' : '#ff4444');
      const priceText = this.add.text(0, -cardHeight / 2 - 15,
        item.purchased ? 'SOLD' : `$${item.price}`, {
        fontSize: '10px',
        fill: priceTextColor,
        fontStyle: 'bold'
      }).setOrigin(0.5);

      card.add([cardBg, cardInner, iconElement, nameText, priceTag, priceText]);
      this.shopElements.push(card);

      this.shopCards.push({
        container: card,
        bg: cardBg,
        name: nameText,
        price: priceText,
        priceTag: priceTag,
        index: index
      });

      // 카드 떨어지는 애니메이션
      this.time.delayedCall(400 + index * 150, () => {
        this.tweens.add({
          targets: card,
          y: cardY,
          duration: 600,
          ease: 'Bounce.easeOut'
        });

        // 착지 시 파티클
        this.time.delayedCall(600, () => {
          for (let i = 0; i < 3; i++) {
            const particle = this.add.circle(
              cardX + (Math.random() - 0.5) * 30,
              cardY + cardHeight / 2,
              2,
              0x4a9eff
            ).setDepth(6000).setAlpha(0.8);

            this.tweens.add({
              targets: particle,
              y: cardY + cardHeight / 2 + 20,
              alpha: 0,
              duration: 300,
              onComplete: () => particle.destroy()
            });
          }
        });
      });
    });

    // ===== 뱀 프리뷰 영역 =====
    const previewY = 430;
    const previewGridSize = 12;
    const previewCols = 22;
    const previewRows = 5;
    const previewWidth = previewCols * previewGridSize;
    const previewHeight = previewRows * previewGridSize;
    const previewX = rightAreaCenterX - previewWidth / 2;

    // 미니맵 배경
    const previewBg = this.add.rectangle(
      rightAreaCenterX, previewY,
      previewWidth, previewHeight,
      0x0d1117, 1
    ).setDepth(6001).setAlpha(0);
    this.shopElements.push(previewBg);

    // 그리드 라인 저장용
    const gridLines = [];

    // 그리드 라인 (더 선명하게)
    for (let i = 0; i <= previewCols; i++) {
      const x = previewX + i * previewGridSize;
      const line = this.add.rectangle(x, previewY, 1, previewHeight, 0x3a4a5a, 1)
        .setDepth(6001).setAlpha(0);
      gridLines.push(line);
      this.shopElements.push(line);
    }
    for (let i = 0; i <= previewRows; i++) {
      const y = previewY - previewHeight / 2 + i * previewGridSize;
      const line = this.add.rectangle(rightAreaCenterX, y, previewWidth, 1, 0x3a4a5a, 1)
        .setDepth(6001).setAlpha(0);
      gridLines.push(line);
      this.shopElements.push(line);
    }

    // 테두리
    const previewBorder = this.add.rectangle(
      rightAreaCenterX, previewY,
      previewWidth, previewHeight
    ).setDepth(6002).setStrokeStyle(2, 0x4a6a8a).setFillStyle(0x000000, 0).setAlpha(0);
    this.shopElements.push(previewBorder);

    // 초기 뱀 (6칸, 가로)
    this.shopSnakePreview = [];
    const snakeLength = 6;
    const snakeStartCol = Math.floor(previewCols / 2) + 2;
    const snakeRow = Math.floor(previewRows / 2);

    for (let i = 0; i < snakeLength; i++) {
      const col = snakeStartCol - i;
      const cellX = previewX + col * previewGridSize + previewGridSize / 2;
      const cellY = previewY - previewHeight / 2 + snakeRow * previewGridSize + previewGridSize / 2;

      const isHead = i === 0;
      // 콤보 실드가 있으면 노란색, 없으면 녹색
      const color = isHead ? (this.comboShieldCount > 0 ? 0xffff00 : 0x00ff00) : 0x00cc00;

      const segment = this.add.rectangle(
        cellX, cellY,
        previewGridSize - 2, previewGridSize - 2,
        color, 1
      ).setDepth(6002).setAlpha(0);

      this.shopSnakePreview.push(segment);
      this.shopElements.push(segment);
    }

    // 프리뷰 좌표 저장 (수트 적용용)
    this.shopPreviewInfo = {
      headX: previewX + snakeStartCol * previewGridSize + previewGridSize / 2,
      headY: previewY - previewHeight / 2 + snakeRow * previewGridSize + previewGridSize / 2,
      gridSize: previewGridSize
    };

    // 프리뷰 등장 애니메이션
    this.time.delayedCall(1000, () => {
      // 배경과 그리드
      this.tweens.add({
        targets: [previewBg, ...gridLines],
        alpha: 0.6,
        duration: 300,
        ease: 'Power2'
      });

      // 테두리
      this.tweens.add({
        targets: previewBorder,
        alpha: 1,
        duration: 300,
        ease: 'Power2'
      });

      // 뱀 세그먼트 순차 등장
      this.shopSnakePreview.forEach((segment, i) => {
        this.tweens.add({
          targets: segment,
          alpha: 1,
          duration: 200,
          delay: 100 + i * 50,
          ease: 'Back.easeOut'
        });
      });

      // 장착된 수트 적용 (스피드 부스트 궤도 등)
      this.time.delayedCall(400, () => {
        this.applyShopPreviewSuits();
      });
    });

    // ===== 하단 버튼들 =====
    // 사이드바 하단과 버튼 하단 정렬 (사이드바 하단: height - 40, 버튼 높이: 45)
    const sidebarBottom = height - 40;
    const buttonHeight = 45;
    const buttonY = sidebarBottom - buttonHeight / 2;
    const buttonGap = 12;
    const nextBtnWidth = 110;
    const loanBtnWidth = 70;

    // 5번째 카드 우측 = cardStartX + 4 * cardSpacing + cardWidth / 2
    const lastCardRightX = cardStartX + 4 * cardSpacing + cardWidth / 2;
    const loanBtnX = lastCardRightX - loanBtnWidth / 2;

    // Loan 버튼 표시 여부 먼저 확인
    const showLoanBtn = this.currentStage >= 6;

    // Loan 버튼이 없으면 Next Stage 우측을 카드 우측에 맞춤, 있으면 Loan 왼쪽에 배치
    const nextBtnX = showLoanBtn
      ? loanBtnX - loanBtnWidth / 2 - buttonGap - nextBtnWidth / 2
      : lastCardRightX - nextBtnWidth / 2;

    // Next Stage 버튼 (모던 그라데이션 스타일)
    const nextBtnGlow = this.add.rectangle(nextBtnX, buttonY, nextBtnWidth + 8, 53, 0x00ff88, 0.3)
      .setDepth(6000)
      .setAlpha(0);

    const nextBtnBg = this.add.rectangle(nextBtnX, buttonY, nextBtnWidth, 45, 0x1a472a, 1)
      .setDepth(6001)
      .setStrokeStyle(2, 0x00ff88)
      .setAlpha(0);

    const nextBtnHighlight = this.add.rectangle(nextBtnX, buttonY - 12, nextBtnWidth - 10, 8, 0x00ff88, 0.2)
      .setDepth(6001)
      .setAlpha(0);

    const nextBtnText = this.add.text(nextBtnX, buttonY, 'NEXT STAGE', {
      fontSize: '16px',
      fill: '#00ff88',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(6002).setAlpha(0);

    this.shopNextBtn = { bg: nextBtnBg, text: nextBtnText, glow: nextBtnGlow, highlight: nextBtnHighlight };
    this.shopElements.push(nextBtnGlow, nextBtnBg, nextBtnHighlight, nextBtnText);

    // Loan 버튼 (Stage 6 클리어 후 오픈)
    const isFirstLoan = this.currentStage === 6; // 처음 대출 기능 해금

    if (showLoanBtn) {
      const loanBtnGlow = this.add.rectangle(loanBtnX, buttonY, loanBtnWidth + 8, 53, 0xff6b6b, 0.3)
        .setDepth(6000)
        .setAlpha(0);

      const loanBtnBg = this.add.rectangle(loanBtnX, buttonY, loanBtnWidth, 45, 0x4a1a1a, 1)
        .setDepth(6001)
        .setStrokeStyle(2, 0xff6b6b)
        .setAlpha(0);

      const loanBtnHighlight = this.add.rectangle(loanBtnX, buttonY - 12, loanBtnWidth - 10, 8, 0xff6b6b, 0.2)
        .setDepth(6001)
        .setAlpha(0);

      const loanBtnText = this.add.text(loanBtnX, buttonY, 'LOAN', {
        fontSize: '16px',
        fill: '#ff6b6b',
        fontStyle: 'bold',
        align: 'center'
      }).setOrigin(0.5).setDepth(6002).setAlpha(0);

      this.shopLoanBtn = { bg: loanBtnBg, text: loanBtnText, glow: loanBtnGlow, highlight: loanBtnHighlight };
      this.shopElements.push(loanBtnGlow, loanBtnBg, loanBtnHighlight, loanBtnText);

      // 처음 대출 기능 해금 시 NEW 뱃지 추가
      if (isFirstLoan) {
        const newBadge = this.add.text(loanBtnX + 25, buttonY - 25, 'NEW!', {
          fontSize: '10px',
          fill: '#ffff00',
          fontStyle: 'bold',
          stroke: '#ff6600',
          strokeThickness: 2
        }).setOrigin(0.5).setDepth(6003).setAlpha(0);
        this.shopElements.push(newBadge);

        // NEW 뱃지 펄스 애니메이션
        this.time.delayedCall(1400, () => {
          this.tweens.add({
            targets: newBadge,
            alpha: 1,
            scale: { from: 0, to: 1.2 },
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.tweens.add({
                targets: newBadge,
                scale: { from: 1.2, to: 1 },
                duration: 200,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
              });
            }
          });
        });
      }
    } else {
      this.shopLoanBtn = null;
    }

    // 버튼 등장 애니메이션 (슬라이드 업 + 페이드)
    this.time.delayedCall(1200, () => {
      const allBtnElements = [
        nextBtnGlow, nextBtnBg, nextBtnHighlight, nextBtnText
      ];

      // Loan 버튼이 있으면 추가
      if (this.shopLoanBtn) {
        allBtnElements.push(
          this.shopLoanBtn.glow, this.shopLoanBtn.bg,
          this.shopLoanBtn.highlight, this.shopLoanBtn.text
        );
      }

      allBtnElements.forEach((el, i) => {
        const originalY = el.y;
        el.y = originalY + 30;
        this.tweens.add({
          targets: el,
          y: originalY,
          alpha: (el === nextBtnGlow || (this.shopLoanBtn && el === this.shopLoanBtn.glow)) ? 0.3 : 1,
          duration: 400,
          delay: Math.floor(i / 4) * 150,
          ease: 'Back.easeOut'
        });
      });

      // Next Stage 버튼 글로우 펄스
      this.tweens.add({
        targets: nextBtnGlow,
        alpha: 0.5,
        scaleX: 1.05,
        scaleY: 1.1,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    });

    // 선택 인덱스 초기화 (첫 번째 구매 가능한 아이템)
    this.selectedShopIndex = 0;
    for (let i = 0; i < this.shopItems.length; i++) {
      if (!this.shopItems[i].purchased) {
        this.selectedShopIndex = i;
        break;
      }
    }
    // 모든 아이템이 SOLD면 Next Stage 버튼 선택
    if (this.shopItems.every(item => item.purchased)) {
      this.selectedShopIndex = this.shopItems.length;
    }

    // 스코어 → 돈 전환 애니메이션 (첫 상점은 축하 후 시작)
    const settleDelay = isFirstShop ? 3000 : 800;
    this.time.delayedCall(settleDelay, () => {
      this.animateScoreToMoney();
    });

    // 키보드 활성화 (첫 상점은 축하 후 활성화)
    const keyboardDelay = isFirstShop ? 3700 : 1500;
    this.time.delayedCall(keyboardDelay, () => {
      this.updateShopSelection();
      this.shopKeyboardEnabled = true;
    });
  }

  animateScoreToMoney() {
    const { width, height } = this.cameras.main;
    const previousMoney = this.money;
    const scoreEarned = this.score;

    // 정산 중 플래그 설정 (키보드 입력 차단)
    this.isSettling = true;

    // 1. 스코어를 먼저 합산
    const afterScore = previousMoney + scoreEarned;
    this.money = afterScore;

    // 2. 대출이 있으면 자동상환 계산 (5스테이지 원리금균등)
    const repayments = []; // 각 은행별 상환 정보
    let hasMissedPayment = false;
    let bankruptBank = null;

    if (this.loans.length > 0) {
      this.loans.forEach(loan => {
        // 마지막 스테이지면 남은 전액, 아니면 고정 상환액
        const payment = loan.stagesLeft === 1 ? loan.remaining : Math.min(loan.paymentPerStage, loan.remaining);

        if (this.money >= payment) {
          this.money -= payment;
          loan.remaining -= payment;
          loan.stagesLeft--;
          loan.missedPayments = 0;
          repayments.push({
            bankName: loan.bankName,
            amount: payment,
            remainingAfter: loan.remaining
          });
        } else {
          loan.missedPayments++;
          hasMissedPayment = true;
          repayments.push({
            bankName: loan.bankName,
            amount: 0,
            missed: true,
            remainingAfter: loan.remaining
          });
        }
      });

      bankruptBank = this.loans.find(l => l.missedPayments >= 2);
      this.loans = this.loans.filter(loan => loan.remaining > 0);
      this.loanTier = this.loans.length;
      this.totalDebt = this.loans.reduce((sum, loan) => sum + loan.remaining, 0);
    }

    const finalMoney = this.money;

    // 화면 중앙 정산 애니메이션
    const centerX = width / 2;
    const centerY = height / 2;

    // 패널 크기 계산 (상환 개수에 따라 조정)
    const panelWidth = 300;
    const baseHeight = 140;
    const repaymentHeight = repayments.length > 0 ? repayments.length * 22 + 15 : 0;
    const panelHeight = baseHeight + repaymentHeight;

    // 정산 영역 배경 패널
    const panelBg = this.add.rectangle(centerX, centerY, panelWidth, panelHeight, 0x000000, 0.9)
      .setDepth(7100).setScale(0);
    const panelBorder = this.add.rectangle(centerX, centerY, panelWidth, panelHeight)
      .setStrokeStyle(3, 0xffff00).setDepth(7101).setScale(0);

    // 패널 등장 애니메이션
    this.tweens.add({
      targets: [panelBg, panelBorder],
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    // 정산 요소들 저장 (나중에 정리용)
    const settlementElements = [panelBg, panelBorder];

    // Y 위치 계산
    const startY = centerY - panelHeight / 2 + 25;
    let currentY = startY;

    // 기존금액 라벨 + 금액
    const prevLabel = this.add.text(centerX - 100, currentY, 'Previous:', {
      fontSize: '13px',
      fill: '#aaaaaa'
    }).setOrigin(0, 0.5).setDepth(7102).setAlpha(0);
    settlementElements.push(prevLabel);

    const prevAmount = this.add.text(centerX + 100, currentY, `$${previousMoney}`, {
      fontSize: '13px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(7102).setAlpha(0);
    settlementElements.push(prevAmount);

    currentY += 24;

    // 스코어 라벨 + 금액
    const scoreLabel = this.add.text(centerX - 100, currentY, 'Score:', {
      fontSize: '13px',
      fill: '#aaaaaa'
    }).setOrigin(0, 0.5).setDepth(7102).setAlpha(0);
    settlementElements.push(scoreLabel);

    const scoreAmount = this.add.text(centerX + 100, currentY, `+$${scoreEarned}`, {
      fontSize: '13px',
      fill: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(7102).setAlpha(0);
    settlementElements.push(scoreAmount);

    currentY += 24;

    // 각 은행별 상환 라벨 생성
    const repayLabels = [];
    repayments.forEach((repay, index) => {
      const bankLabel = this.add.text(centerX - 100, currentY + index * 22, `${repay.bankName}:`, {
        fontSize: '11px',
        fill: '#aaaaaa'
      }).setOrigin(0, 0.5).setDepth(7102).setAlpha(0);
      settlementElements.push(bankLabel);

      const amountText = repay.missed ? 'MISSED!' : `-$${repay.amount}`;
      const amountColor = repay.missed ? '#ff0000' : '#ff4444';
      const bankAmount = this.add.text(centerX + 100, currentY + index * 22, amountText, {
        fontSize: '11px',
        fill: amountColor,
        fontStyle: 'bold'
      }).setOrigin(1, 0.5).setDepth(7102).setAlpha(0);
      settlementElements.push(bankAmount);

      repayLabels.push({ label: bankLabel, amount: bankAmount, repay });
    });

    // 구분선
    const dividerY = currentY + repayments.length * 22 + 8;
    const divider = this.add.rectangle(centerX, dividerY, 180, 2, 0xffffff, 0.3)
      .setDepth(7102).setAlpha(0);
    settlementElements.push(divider);

    // 최종 금액 표시
    const finalY = dividerY + 20;
    const finalLabel = this.add.text(centerX - 100, finalY, 'Total:', {
      fontSize: '14px',
      fill: '#ffff00'
    }).setOrigin(0, 0.5).setDepth(7102).setAlpha(0);
    settlementElements.push(finalLabel);

    const mainAmount = this.add.text(centerX + 100, finalY, `$${previousMoney}`, {
      fontSize: '18px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(1, 0.5).setDepth(7102).setAlpha(0);
    settlementElements.push(mainAmount);

    let currentDelay = 200;

    // 1단계: 기존 금액 표시
    this.tweens.add({
      targets: [prevLabel, prevAmount, finalLabel, mainAmount, divider],
      alpha: 1,
      duration: 200,
      delay: currentDelay,
      ease: 'Power2'
    });

    currentDelay += 350;

    // 2단계: 스코어 추가
    if (scoreEarned > 0) {
      this.tweens.add({
        targets: [scoreLabel, scoreAmount],
        alpha: 1,
        duration: 200,
        delay: currentDelay,
        ease: 'Power2'
      });

      // 카운트업 애니메이션
      this.time.delayedCall(currentDelay + 250, () => {
        const countDuration = 400;
        const startTime = this.time.now;

        const countUp = this.time.addEvent({
          delay: 16,
          callback: () => {
            const elapsed = this.time.now - startTime;
            const progress = Math.min(elapsed / countDuration, 1);
            const currentValue = Math.floor(previousMoney + scoreEarned * progress);
            mainAmount.setText(`$${currentValue}`);
            mainAmount.setFill('#00ff00');

            if (progress >= 1) {
              mainAmount.setText(`$${afterScore}`);
              mainAmount.setFill('#ffffff');
              countUp.destroy();
            }
          },
          loop: true
        });
      });

      currentDelay += 750;
    }

    // 3단계: 각 은행별 상환 차감 (순차적으로)
    let runningTotal = afterScore;
    repayLabels.forEach((item, index) => {
      const delay = currentDelay + index * 500;

      // 라벨 표시
      this.tweens.add({
        targets: [item.label, item.amount],
        alpha: 1,
        duration: 200,
        delay: delay,
        ease: 'Power2'
      });

      // 카운트다운 애니메이션 (missed가 아닌 경우만)
      if (!item.repay.missed && item.repay.amount > 0) {
        const startValue = runningTotal;
        const endValue = runningTotal - item.repay.amount;
        runningTotal = endValue;

        this.time.delayedCall(delay + 200, () => {
          const countDuration = 250;
          const startTime = this.time.now;

          const countDown = this.time.addEvent({
            delay: 16,
            callback: () => {
              const elapsed = this.time.now - startTime;
              const progress = Math.min(elapsed / countDuration, 1);
              const currentValue = Math.floor(startValue - item.repay.amount * progress);
              mainAmount.setText(`$${currentValue}`);
              mainAmount.setFill('#ff4444');

              if (progress >= 1) {
                mainAmount.setText(`$${endValue}`);
                mainAmount.setFill('#ffffff');
                countDown.destroy();
              }
            },
            loop: true
          });
        });
      }
    });

    currentDelay += repayments.length * 500 + 300;

    // 4단계: 배경 페이드아웃 + 최종 금액 날아감
    this.time.delayedCall(currentDelay + 200, () => {
      // 배경과 라벨들 페이드아웃
      settlementElements.forEach(el => {
        if (el !== mainAmount) {
          this.tweens.add({
            targets: el,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => el.destroy()
          });
        }
      });

      // 최종 금액 빠르게 날아감 (은행 정산 스타일)
      this.time.delayedCall(100, () => {
        const targetX = this.shopMoneyText ? this.shopMoneyText.x : 80;
        const targetY = this.shopMoneyText ? this.shopMoneyText.y : 180;
        const startMoney = previousMoney;

        // 빠르게 날아가기
        this.tweens.add({
          targets: mainAmount,
          x: targetX,
          y: targetY,
          scaleX: 0.5,
          scaleY: 0.5,
          alpha: 0,
          duration: 180,
          ease: 'Power2.easeIn',
          onComplete: () => {
            mainAmount.destroy();

            if (this.shopMoneyText && this.shopMoneyText.active) {
              // 카운트업 애니메이션 (은행 정산 느낌)
              const countDuration = 250;
              const startTime = this.time.now;

              const countUp = this.time.addEvent({
                delay: 16,
                callback: () => {
                  const elapsed = this.time.now - startTime;
                  const progress = Math.min(elapsed / countDuration, 1);
                  // easeOut으로 마지막에 천천히
                  const eased = 1 - Math.pow(1 - progress, 3);
                  const currentValue = Math.floor(startMoney + (finalMoney - startMoney) * eased);
                  this.shopMoneyText.setText(`$${currentValue}`);

                  if (progress >= 1) {
                    this.shopMoneyText.setText(`$${finalMoney}`);
                    countUp.destroy();
                  }
                },
                loop: true
              });
            }

            // 빚 정보 업데이트 + 정산 완료
            this.time.delayedCall(300, () => {
              this.updateShopDebtInfo();
              this.isSettling = false; // 정산 완료 - 키보드 입력 허용

              // 빚 완납 체크 (이전에 대출이 있었고 지금은 없는 경우)
              if (repayments.length > 0 && this.loans.length === 0) {
                this.showDebtFreeAnimation();
              }
            });
          }
        });
      });
    });

    // 파산/연체 경고 (애니메이션 완료 후)
    const warningDelay = currentDelay + 1800;
    if (bankruptBank) {
      this.time.delayedCall(warningDelay, () => {
        this.showBankruptcyGameOver(bankruptBank.bankName);
      });
    } else if (hasMissedPayment) {
      const missedLoans = this.loans.filter(l => l.missedPayments > 0)
        .map(l => ({ name: l.bankName, missed: l.missedPayments }));
      if (missedLoans.length > 0) {
        this.time.delayedCall(warningDelay, () => {
          this.showPaymentWarning(missedLoans);
        });
      }
    }
  }

  // 포커스가 이동할 때 짧은 펄스 애니메이션으로 인터랙션을 통일
  spawnFocusPulse(x, y, color, depth = 6005, collection = 'shop') {
    if (x === undefined || y === undefined) return;

    const outer = this.add.circle(x, y, 44, color, 0.08).setDepth(depth).setAlpha(0);
    const inner = this.add.circle(x, y, 24, color, 0.15).setDepth(depth + 1).setAlpha(0);

    const targets = [outer, inner];
    targets.forEach(t => {
      this.tweens.add({
        targets: t,
        alpha: { from: 0.8, to: 0 },
        scale: { from: 0.9, to: 1.5 },
        duration: 260,
        ease: 'Sine.easeOut',
        onComplete: () => t.destroy()
      });
    });

    if (collection === 'confirm') {
      this.purchaseConfirmElements.push(...targets);
    } else {
      this.shopElements.push(...targets);
    }
  }

  updateShopSelection() {
    if (!this.shopCards) return;

    // 기존 설명 팝업 제거
    if (this.itemDescPopup) {
      this.itemDescPopup.destroy();
      this.itemDescPopup = null;
    }

    // 포커스가 바뀌면 통일된 펄스 연출을 추가
    let focusInfo = null;
    if (this.selectedShopIndex < this.shopItems.length) {
      const focusedItem = this.shopItems[this.selectedShopIndex];
      const focusedCard = this.shopCards[this.selectedShopIndex];
      if (focusedItem && focusedCard) {
        const canAfford = this.money >= focusedItem.price;
        focusInfo = {
          key: `card-${this.selectedShopIndex}`,
          x: focusedCard.container.x,
          y: focusedCard.container.y,
          color: focusedItem.purchased ? 0x666666 : (canAfford ? 0x00ff88 : 0xff4444)
        };
      }
    } else if (this.selectedShopIndex === this.shopItems.length && this.shopNextBtn) {
      focusInfo = {
        key: 'next',
        x: this.shopNextBtn.bg.x,
        y: this.shopNextBtn.bg.y,
        color: 0x00ff88
      };
    } else if (this.selectedShopIndex === this.shopItems.length + 1 && this.shopLoanBtn) {
      focusInfo = {
        key: 'loan',
        x: this.shopLoanBtn.bg.x,
        y: this.shopLoanBtn.bg.y,
        color: 0xff6b6b
      };
    }

    if (focusInfo && focusInfo.key !== this.lastShopFocusKey) {
      this.spawnFocusPulse(focusInfo.x, focusInfo.y, focusInfo.color, 6005, 'shop');
      this.lastShopFocusKey = focusInfo.key;
    }

    // 선택된 아이템이 카드인 경우 설명 팝업 표시
    if (this.selectedShopIndex < this.shopItems.length) {
      const selectedItem = this.shopItems[this.selectedShopIndex];
      const card = this.shopCards[this.selectedShopIndex];

      if (card && selectedItem.description) {
        const { width } = this.cameras.main;

        // 뱀 프리뷰와 동일한 중앙 위치 계산
        const sidebarWidth = 120;
        const sidebarEndX = sidebarWidth + 10;
        const rightAreaCenterX = sidebarEndX + (width - sidebarEndX) / 2;

        // 아이템과 뱀 사이에 툴팁 (아이템 쪽으로 가깝게)
        const popupX = rightAreaCenterX;
        const popupY = 340;

        // 외곽선 (네온 효과)
        const popupBgOuter = this.add.rectangle(popupX, popupY - 30, 320, 50, 0x4a9eff, 1)
          .setDepth(6000);
        // 내부 배경
        const popupBgInner = this.add.rectangle(popupX, popupY - 30, 316, 46, 0x000000, 1)
          .setDepth(6001);

        // 아이템 이름
        const nameText = this.add.text(popupX, popupY - 40, selectedItem.name, {
          fontSize: '14px',
          fill: '#00ffff',
          fontStyle: 'bold',
          stroke: '#006666',
          strokeThickness: 2
        }).setOrigin(0.5).setDepth(6002);

        // 설명 텍스트 - 흰색으로 밝게
        const popupText = this.add.text(popupX, popupY - 22, selectedItem.description, {
          fontSize: '12px',
          fill: '#ffffff',
          align: 'center',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 2,
          wordWrap: { width: 300 }
        }).setOrigin(0.5).setDepth(6002);

        // 컨테이너 대신 개별 요소로 관리 (컨테이너가 렌더링 품질 저하 유발)
        this.itemDescPopup = [popupBgOuter, popupBgInner, nameText, popupText];
        this.itemDescPopup.forEach(el => this.shopElements.push(el));
        // destroy 메서드 추가
        this.itemDescPopup.destroy = function() {
          this.forEach(el => el.destroy());
        };

        // 역동적인 등장 애니메이션
        // 배경: 작게 시작해서 팡! 터지듯이
        [popupBgOuter, popupBgInner].forEach(el => {
          el.setAlpha(0).setScale(0.3);
        });

        this.tweens.add({
          targets: [popupBgOuter, popupBgInner],
          alpha: 1,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          ease: 'Back.easeOut'
        });

        // 텍스트: 위에서 떨어지며 바운스 + 약간 지연
        [nameText, popupText].forEach(el => {
          el.setAlpha(0);
          el.y -= 30;
        });

        this.tweens.add({
          targets: nameText,
          alpha: 1,
          y: '+=30',
          duration: 300,
          delay: 80,
          ease: 'Bounce.easeOut'
        });

        this.tweens.add({
          targets: popupText,
          alpha: 1,
          y: '+=30',
          duration: 300,
          delay: 120,
          ease: 'Bounce.easeOut'
        });
      }
    }

    this.shopCards.forEach((card, index) => {
      const isSelected = index === this.selectedShopIndex;
      const item = this.shopItems[index];
      const canAfford = this.money >= item.price;

      // 딤 처리 업데이트 (구매 가능 여부에 따라)
      if (!item.purchased) {
        // 컨테이너 알파 (딤 처리)
        card.container.setAlpha(canAfford ? 1 : 0.5);

        // 가격 태그 색상
        const priceTagColor = canAfford ? 0x00aa00 : 0x661111;
        const priceTagStroke = canAfford ? 0x00ff00 : 0xff4444;
        card.priceTag.setFillStyle(priceTagColor);
        card.priceTag.setStrokeStyle(2, priceTagStroke);

        // 가격 텍스트 색상
        card.price.setFill(canAfford ? '#00ff00' : '#ff4444');
      }

      if (isSelected && !item.purchased) {
        // 선택된 카드 - 위로 올라오고 발광
        this.tweens.add({
          targets: card.container,
          y: 180,
          duration: 200,
          ease: 'Back.easeOut'
        });

        // 테두리 발광 (구매 불가 시 빨간색)
        card.bg.setStrokeStyle(4, canAfford ? 0xffff00 : 0xff4444);

        // 들썩임 효과
        if (!card.floatTween) {
          card.floatTween = this.tweens.add({
            targets: card.container,
            y: '+=5',
            duration: 300,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut'
          });
        }
      } else {
        // 선택 해제
        this.tweens.add({
          targets: card.container,
          y: 200,
          duration: 200,
          ease: 'Power2'
        });

        card.bg.setStrokeStyle(3, item.purchased ? 0x666666 : 0x4a9eff);

        if (card.floatTween) {
          card.floatTween.stop();
          card.floatTween = null;
        }
      }
    });

    // Next Stage 버튼 하이라이트
    if (this.shopNextBtn) {
      const isNextSelected = this.selectedShopIndex === this.shopItems.length;

      if (isNextSelected) {
        this.shopNextBtn.bg.setStrokeStyle(3, 0xffffff);
        this.shopNextBtn.text.setFill('#ffffff');
        this.shopNextBtn.glow.setFillStyle(0xffffff, 0.5);

        // 포커스 시 스케일 업 + 글로우 강화
        if (!this.shopNextBtn.floatTween) {
          this.shopNextBtn.floatTween = this.tweens.add({
            targets: [this.shopNextBtn.bg, this.shopNextBtn.text, this.shopNextBtn.highlight],
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 150,
            ease: 'Back.easeOut'
          });
          this.tweens.add({
            targets: this.shopNextBtn.glow,
            alpha: 0.7,
            scaleX: 1.15,
            scaleY: 1.2,
            duration: 150
          });
        }
      } else {
        this.shopNextBtn.bg.setStrokeStyle(2, 0x00ff88);
        this.shopNextBtn.text.setFill('#00ff88');
        this.shopNextBtn.glow.setFillStyle(0x00ff88, 0.3);

        // 포커스 해제 시 원래 크기로
        if (this.shopNextBtn.floatTween) {
          this.shopNextBtn.floatTween.stop();
          this.shopNextBtn.floatTween = null;
          this.tweens.add({
            targets: [this.shopNextBtn.bg, this.shopNextBtn.text, this.shopNextBtn.highlight],
            scaleX: 1,
            scaleY: 1,
            duration: 150
          });
          this.tweens.add({
            targets: this.shopNextBtn.glow,
            alpha: 0.3,
            scaleX: 1,
            scaleY: 1,
            duration: 150
          });
        }
      }
    }

    // Loan 버튼 하이라이트
    if (this.shopLoanBtn) {
      const isLoanSelected = this.selectedShopIndex === this.shopItems.length + 1;

      if (isLoanSelected) {
        this.shopLoanBtn.bg.setStrokeStyle(3, 0xffffff);
        this.shopLoanBtn.text.setFill('#ffffff');
        this.shopLoanBtn.glow.setFillStyle(0xffffff, 0.5);

        // 포커스 시 스케일 업 + 글로우 강화
        if (!this.shopLoanBtn.floatTween) {
          this.shopLoanBtn.floatTween = this.tweens.add({
            targets: [this.shopLoanBtn.bg, this.shopLoanBtn.text, this.shopLoanBtn.highlight],
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 150,
            ease: 'Back.easeOut'
          });
          this.tweens.add({
            targets: this.shopLoanBtn.glow,
            alpha: 0.7,
            scaleX: 1.15,
            scaleY: 1.2,
            duration: 150
          });
        }
      } else {
        this.shopLoanBtn.bg.setStrokeStyle(2, 0xff6b6b);
        this.shopLoanBtn.text.setFill('#ff6b6b');
        this.shopLoanBtn.glow.setFillStyle(0xff6b6b, 0.3);

        // 포커스 해제 시 원래 크기로
        if (this.shopLoanBtn.floatTween) {
          this.shopLoanBtn.floatTween.stop();
          this.shopLoanBtn.floatTween = null;
          this.tweens.add({
            targets: [this.shopLoanBtn.bg, this.shopLoanBtn.text, this.shopLoanBtn.highlight],
            scaleX: 1,
            scaleY: 1,
            duration: 150
          });
          this.tweens.add({
            targets: this.shopLoanBtn.glow,
            alpha: 0.3,
            scaleX: 1,
            scaleY: 1,
            duration: 150
          });
        }
      }
    }
  }

  handleShopInput(direction) {
    if (!this.shopOpen || !this.shopKeyboardEnabled || this.isSettling) return;

    // 구매 확인창이 열려 있으면 그쪽으로 입력을 전달
    if (this.isPurchaseConfirmOpen) {
      this.handlePurchaseConfirmInput(direction);
      return;
    }

    const itemCount = this.shopItems.length;

    // 아이템 내에서 다음 선택 가능한 인덱스 찾기 (SOLD 건너뛰기, 아이템만 순환)
    const findNextItemAvailable = (start, delta) => {
      // 버튼에서 좌우 누르면 무시
      if (start >= itemCount) return start;

      let idx = start;
      for (let i = 0; i < itemCount; i++) {
        idx = (idx + delta + itemCount) % itemCount;
        if (!this.shopItems[idx].purchased) {
          return idx;
        }
      }
      return start; // 못 찾으면 현재 유지
    };

    if (direction === 'LEFT') {
      if (this.selectedShopIndex < itemCount) {
        // 아이템 영역에서 좌우 순환
        this.selectedShopIndex = findNextItemAvailable(this.selectedShopIndex, -1);
        this.updateShopSelection();
      } else {
        // 버튼 영역에서 좌우 이동 (Next Stage <-> Loan)
        this.selectedShopIndex = this.selectedShopIndex === itemCount ? itemCount + 1 : itemCount;
        this.updateShopSelection();
      }
    } else if (direction === 'RIGHT') {
      if (this.selectedShopIndex < itemCount) {
        // 아이템 영역에서 좌우 순환
        this.selectedShopIndex = findNextItemAvailable(this.selectedShopIndex, 1);
        this.updateShopSelection();
      } else {
        // 버튼 영역에서 좌우 이동 (Next Stage <-> Loan)
        this.selectedShopIndex = this.selectedShopIndex === itemCount ? itemCount + 1 : itemCount;
        this.updateShopSelection();
      }
    } else if (direction === 'UP') {
      // 버튼에서 위로 누르면 아이템 카드로 이동
      if (this.selectedShopIndex >= this.shopItems.length) {
        // 첫 번째 구매 가능한 아이템 찾기
        let foundIndex = -1;
        for (let i = 0; i < this.shopItems.length; i++) {
          if (!this.shopItems[i].purchased) {
            foundIndex = i;
            break;
          }
        }

        if (foundIndex !== -1) {
          this.selectedShopIndex = foundIndex;
          this.updateShopSelection();
        }
        // 모든 아이템이 SOLD면 버튼에 머무름
      }
    } else if (direction === 'DOWN') {
      // 아이템 카드에서 아래로 누르면 Next Stage 버튼으로 이동
      if (this.selectedShopIndex < this.shopItems.length) {
        this.selectedShopIndex = this.shopItems.length;
        this.updateShopSelection();
      }
    } else if (direction === 'ENTER') {
      // 카드 선택 중이면 구매 시도, Next Stage 버튼이면 상점 닫기, Loan 버튼이면 대출 UI
      if (this.selectedShopIndex < this.shopItems.length) {
        this.attemptPurchase(this.selectedShopIndex);
      } else if (this.selectedShopIndex === this.shopItems.length) {
        this.closeShop();
      } else if (this.selectedShopIndex === this.shopItems.length + 1) {
        this.openLoanUI();
      }
    }
  }

  handleAlreadyPurchased(card) {
    if (!card || !card.container) return;
    this.tweens.add({
      targets: card.container,
      x: card.container.x + 10,
      duration: 50,
      yoyo: true,
      repeat: 3
    });
  }

  handleNotEnoughMoney(card) {
    if (!card || !card.container) return;

    this.shopMoneyText.setFill('#ff0000');
    this.tweens.add({
      targets: this.shopMoneyText,
      x: this.shopMoneyText.x + 5,
      duration: 50,
      yoyo: true,
      repeat: 5,
      onComplete: () => {
        this.shopMoneyText.setFill('#ffff00');
      }
    });

    // 카드 흔들림
    this.tweens.add({
      targets: card.container,
      angle: { from: -5, to: 5 },
      duration: 50,
      yoyo: true,
      repeat: 2,
      onComplete: () => card.container.setAngle(0)
    });

    // "NOT ENOUGH" 메시지 애니메이션
    const cardX = card.container.x;
    const cardY = card.container.y;
    const notEnoughText = this.add.text(cardX, cardY, 'NOT ENOUGH', {
      fontSize: '14px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(6010).setAlpha(0);

    this.tweens.add({
      targets: notEnoughText,
      y: cardY - 50,
      alpha: 1,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        this.tweens.add({
          targets: notEnoughText,
          y: cardY - 80,
          alpha: 0,
          duration: 300,
          delay: 200,
          ease: 'Power2',
          onComplete: () => notEnoughText.destroy()
        });
      }
    });
  }

  attemptPurchase(index) {
    if (this.isPurchaseConfirmOpen) return;
    const item = this.shopItems[index];
    const card = this.shopCards[index];
    if (!item || !card) return;

    if (item.purchased) {
      this.handleAlreadyPurchased(card);
      return;
    }

    if (this.money < item.price) {
      this.handleNotEnoughMoney(card);
      return;
    }

    this.showPurchaseConfirm(item, index);
  }

  showPurchaseConfirm(item, index) {
    if (this.isPurchaseConfirmOpen) return;
    this.isPurchaseConfirmOpen = true;
    this.pendingPurchaseIndex = index;
    this.purchaseConfirmSelection = 'yes';
    this.lastPurchaseConfirmKey = null;
    this.purchaseConfirmElements = [];

    const { width, height } = this.cameras.main;

    // 반투명 오버레이
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0, 0)
      .setDepth(7200)
      .setAlpha(0);
    this.purchaseConfirmElements.push(overlay);
    this.tweens.add({
      targets: overlay,
      alpha: 0.7,
      duration: 180
    });

    // 패널
    const panelBg = this.add.rectangle(width / 2, height / 2, 360, 200, 0x0d1117, 0.95)
      .setDepth(7202)
      .setScale(0.6)
      .setAlpha(0);
    const panelBorder = this.add.rectangle(width / 2, height / 2, 360, 200)
      .setDepth(7203)
      .setStrokeStyle(3, 0x4a9eff)
      .setScale(0.6)
      .setAlpha(0);
    this.purchaseConfirmElements.push(panelBg, panelBorder);

    this.tweens.add({
      targets: [panelBg, panelBorder],
      alpha: 1,
      scaleX: { from: 0.6, to: 1 },
      scaleY: { from: 0.6, to: 1 },
      duration: 220,
      ease: 'Back.easeOut'
    });

    // 타이틀 & 내용
    const title = this.add.text(width / 2, height / 2 - 62, 'CONFIRM PURCHASE', {
      fontSize: '18px',
      fill: '#00ffff',
      fontStyle: 'bold',
      stroke: '#006666',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(7204).setAlpha(0);

    const desc = this.add.text(width / 2, height / 2 - 30,
      `Buy ${item.name} for $${item.price}?`, {
      fontSize: '15px',
      fill: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(7204).setAlpha(0);

    const sub = this.add.text(width / 2, height / 2,
      'Press ENTER to confirm', {
        fontSize: '12px',
        fill: '#aaaaaa'
      }).setOrigin(0.5).setDepth(7204).setAlpha(0);

    this.purchaseConfirmElements.push(title, desc, sub);

    this.tweens.add({
      targets: [title, desc, sub],
      alpha: 1,
      y: '+=8',
      duration: 200,
      ease: 'Power2',
      delay: 60
    });

    // 버튼
    const btnY = height / 2 + 50;
    const yesX = width / 2 - 70;
    const noX = width / 2 + 70;

    const yesGlow = this.add.rectangle(yesX, btnY, 110, 50, 0x00ff88, 0.18)
      .setDepth(7201).setAlpha(0);
    const yesBg = this.add.rectangle(yesX, btnY, 100, 44, 0x103522, 1)
      .setDepth(7202).setStrokeStyle(2, 0x00ff88).setAlpha(0);
    const yesHighlight = this.add.rectangle(yesX, btnY - 12, 80, 8, 0x00ff88, 0.2)
      .setDepth(7202).setAlpha(0);
    const yesText = this.add.text(yesX, btnY, 'YES', {
      fontSize: '16px',
      fill: '#00ff88',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7204).setAlpha(0);

    const noGlow = this.add.rectangle(noX, btnY, 110, 50, 0xff6b6b, 0.18)
      .setDepth(7201).setAlpha(0);
    const noBg = this.add.rectangle(noX, btnY, 100, 44, 0x401c1c, 1)
      .setDepth(7202).setStrokeStyle(2, 0xff6b6b).setAlpha(0);
    const noHighlight = this.add.rectangle(noX, btnY - 12, 80, 8, 0xff6b6b, 0.2)
      .setDepth(7202).setAlpha(0);
    const noText = this.add.text(noX, btnY, 'NO', {
      fontSize: '16px',
      fill: '#ff6b6b',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7204).setAlpha(0);

    this.purchaseConfirmButtons = {
      yes: { bg: yesBg, text: yesText, glow: yesGlow, highlight: yesHighlight },
      no: { bg: noBg, text: noText, glow: noGlow, highlight: noHighlight }
    };

    this.purchaseConfirmElements.push(
      yesGlow, yesBg, yesHighlight, yesText,
      noGlow, noBg, noHighlight, noText
    );

    // 버튼 등장 애니메이션
    [yesGlow, yesBg, yesHighlight, yesText, noGlow, noBg, noHighlight, noText].forEach((el, i) => {
      const originalY = el.y;
      el.y = originalY + 25;
      this.tweens.add({
        targets: el,
        y: originalY,
        alpha: el === yesGlow || el === noGlow ? 0.3 : 1,
        duration: 240,
        delay: 70 + i * 20,
        ease: 'Back.easeOut'
      });
    });

    // 기본 포커스 스타일 적용
    this.updatePurchaseConfirmSelection();
  }

  updatePurchaseConfirmSelection() {
    if (!this.purchaseConfirmButtons) return;

    const yesSelected = this.purchaseConfirmSelection === 'yes';
    const noSelected = this.purchaseConfirmSelection === 'no';

    const styleButton = (btn, selected, baseColor) => {
      if (!btn) return;
      btn.bg.setStrokeStyle(selected ? 3 : 2, selected ? 0xffffff : baseColor);
      btn.text.setFill(selected ? '#ffffff' : Phaser.Display.Color.IntegerToColor(baseColor).rgba);
      btn.glow.setFillStyle(selected ? 0xffffff : baseColor, selected ? 0.4 : 0.2);

      if (selected) {
        if (!btn.floatTween) {
          btn.floatTween = this.tweens.add({
            targets: [btn.bg, btn.text, btn.highlight],
            scaleX: 1.05,
            scaleY: 1.05,
            duration: 140,
            ease: 'Back.easeOut'
          });
        }
      } else if (btn.floatTween) {
        btn.floatTween.stop();
        btn.floatTween = null;
        this.tweens.add({
          targets: [btn.bg, btn.text, btn.highlight],
          scaleX: 1,
          scaleY: 1,
          duration: 120
        });
      }
    };

    styleButton(this.purchaseConfirmButtons.yes, yesSelected, 0x00ff88);
    styleButton(this.purchaseConfirmButtons.no, noSelected, 0xff6b6b);

    // 포커스 펄스
    const focusKey = `confirm-${this.purchaseConfirmSelection}`;
    const focusTarget = yesSelected ? this.purchaseConfirmButtons.yes : this.purchaseConfirmButtons.no;
    const focusColor = yesSelected ? 0x00ff88 : 0xff6b6b;
    if (focusKey !== this.lastPurchaseConfirmKey && focusTarget) {
      this.spawnFocusPulse(focusTarget.bg.x, focusTarget.bg.y, focusColor, 7205, 'confirm');
      this.lastPurchaseConfirmKey = focusKey;
    }
  }

  handlePurchaseConfirmInput(direction) {
    if (!this.isPurchaseConfirmOpen) return;

    if (direction === 'LEFT' || direction === 'UP') {
      this.purchaseConfirmSelection = 'yes';
      this.updatePurchaseConfirmSelection();
    } else if (direction === 'RIGHT' || direction === 'DOWN') {
      this.purchaseConfirmSelection = 'no';
      this.updatePurchaseConfirmSelection();
    } else if (direction === 'ENTER') {
      if (this.purchaseConfirmSelection === 'yes') {
        this.confirmPurchase();
      } else {
        this.closePurchaseConfirmOverlay();
      }
    }
  }

  confirmPurchase() {
    const index = this.pendingPurchaseIndex;
    this.closePurchaseConfirmOverlay();
    if (index !== null && index !== undefined) {
      this.purchaseItem(index);
    }
  }

  closePurchaseConfirmOverlay(force = false) {
    if (!this.purchaseConfirmElements.length && !this.isPurchaseConfirmOpen) return;

    this.isPurchaseConfirmOpen = false;
    this.pendingPurchaseIndex = null;
    this.lastPurchaseConfirmKey = null;

    const elements = [...this.purchaseConfirmElements];
    this.purchaseConfirmElements = [];
    this.purchaseConfirmButtons = null;

    if (force) {
      elements.forEach(el => {
        if (el && el.destroy) el.destroy();
      });
      return;
    }

    elements.forEach(el => {
      if (!el || el.active === false) return;
      this.tweens.add({
        targets: el,
        alpha: 0,
        duration: 160,
        onComplete: () => {
          if (el && el.destroy) el.destroy();
        }
      });
    });
  }

  purchaseItem(index) {
    const item = this.shopItems[index];
    const card = this.shopCards[index];
    if (!item || !card) return;

    if (item.purchased) {
      this.handleAlreadyPurchased(card);
      return;
    }

    if (this.money < item.price) {
      this.handleNotEnoughMoney(card);
      return;
    }

    // 구매 성공!
    this.money -= item.price;
    item.purchased = true;
    this.shopMoneyText.setText(`$${this.money}`);

    // 아이템별 효과 적용
    if (item.id === 'combo_shield') {
      // Combo Shield - 콤보 실드 추가
      this.comboShieldCount++;
      this.hasHadShield = true; // 실드를 가졌던 적이 있음
      this.updateItemStatusUI();

      // 화려한 장착 애니메이션
      if (this.shopSnakePreview && this.shopSnakePreview.length > 0) {
        const head = this.shopSnakePreview[0];
        const headX = head.x;
        const headY = head.y;

        // 1. 노란 파티클 폭발
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const particle = this.add.circle(headX, headY, 3, 0xffff00)
            .setDepth(6010).setAlpha(1);
          this.tweens.add({
            targets: particle,
            x: headX + Math.cos(angle) * 40,
            y: headY + Math.sin(angle) * 40,
            alpha: 0,
            scale: 0,
            duration: 400,
            ease: 'Power2',
            onComplete: () => particle.destroy()
          });
        }

        // 2. 전체 뱀 웨이브 효과 + 머리 노란색으로 변경
        this.shopSnakePreview.forEach((segment, i) => {
          this.tweens.add({
            targets: segment,
            scaleX: 1.4,
            scaleY: 1.4,
            duration: 100,
            delay: i * 50,
            yoyo: true,
            ease: 'Back.easeOut'
          });

          this.time.delayedCall(i * 50, () => {
            segment.setFillStyle(0xffffff);
            this.time.delayedCall(100, () => {
              // 머리는 노란색, 몸통은 원래색
              segment.setFillStyle(i === 0 ? 0xffff00 : 0x00cc00);
            });
          });
        });

        // 3. 머리 글로우 효과
        this.time.delayedCall(300, () => {
          const glow = this.add.circle(headX, headY, 15, 0xffff00, 0.5)
            .setDepth(6009);
          this.tweens.add({
            targets: glow,
            alpha: 0,
            scale: 2,
            duration: 500,
            onComplete: () => glow.destroy()
          });
        });
      }
    } else if (item.id === 'speed_boost' && this.shopSnakePreview && this.shopSnakePreview.length > 0) {
      // Speed Boost - 궤도 전자 수트 기능
      this.hasSpeedBoost = true;

      const head = this.shopSnakePreview[0];
      const headX = head.x;
      const headY = head.y;

      // 1. 화면 전체 플래시 (청록색 → 화이트)
      const { width, height } = this.cameras.main;
      const flash = this.add.rectangle(width / 2, height / 2, width, height, 0x00ffff, 0.6)
        .setDepth(6020);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 200,
        onComplete: () => flash.destroy()
      });

      // 2. 에너지 집중 효과 - 바깥에서 머리로 수렴
      for (let i = 0; i < 20; i++) {
        const angle = (i / 20) * Math.PI * 2;
        const startDist = 80 + Math.random() * 40;
        const particle = this.add.circle(
          headX + Math.cos(angle) * startDist,
          headY + Math.sin(angle) * startDist,
          4, 0x00ffff
        ).setDepth(6015).setAlpha(0.8);

        this.tweens.add({
          targets: particle,
          x: headX,
          y: headY,
          scale: 0.3,
          alpha: 0,
          duration: 400 + Math.random() * 200,
          ease: 'Power2.easeIn',
          onComplete: () => particle.destroy()
        });
      }

      // 3. 중앙 폭발 (에너지 수렴 완료 후)
      this.time.delayedCall(500, () => {
        // 큰 청록색 폭발
        const explosion = this.add.circle(headX, headY, 5, 0x00ffff, 1)
          .setDepth(6016);
        this.tweens.add({
          targets: explosion,
          scale: 8,
          alpha: 0,
          duration: 400,
          ease: 'Power2',
          onComplete: () => explosion.destroy()
        });

        // 화면 흔들림
        this.cameras.main.shake(200, 0.015);

        // 웨이브 링 3개
        for (let r = 0; r < 3; r++) {
          const ring = this.add.circle(headX, headY, 10, 0x000000, 0)
            .setStrokeStyle(3, 0x00ffff, 1)
            .setDepth(6015);
          this.tweens.add({
            targets: ring,
            scale: 4 + r,
            alpha: 0,
            duration: 500,
            delay: r * 100,
            ease: 'Power2',
            onComplete: () => ring.destroy()
          });
        }
      });

      // 4. 뱀 전체 순차 전기 웨이브
      this.shopSnakePreview.forEach((segment, i) => {
        this.time.delayedCall(600 + i * 60, () => {
          // 스케일 펑!
          this.tweens.add({
            targets: segment,
            scaleX: 1.6,
            scaleY: 1.6,
            duration: 80,
            yoyo: true,
            ease: 'Back.easeOut'
          });

          // 색상 플래시
          const originalColor = i === 0 ? (this.comboShieldCount > 0 ? 0xffff00 : 0x00ff00) : 0x00cc00;
          segment.setFillStyle(0xffffff);
          this.time.delayedCall(80, () => {
            segment.setFillStyle(0x00ffff);
            this.time.delayedCall(80, () => {
              segment.setFillStyle(originalColor);
            });
          });

          // 개별 파티클
          for (let p = 0; p < 4; p++) {
            const pAngle = (p / 4) * Math.PI * 2;
            const spark = this.add.circle(segment.x, segment.y, 2, 0x00ffff)
              .setDepth(6014);
            this.tweens.add({
              targets: spark,
              x: segment.x + Math.cos(pAngle) * 15,
              y: segment.y + Math.sin(pAngle) * 15,
              alpha: 0,
              duration: 200,
              onComplete: () => spark.destroy()
            });
          }
        });
      });

      // 5. 궤도 파티클 등장 (상점 프리뷰용)
      this.time.delayedCall(900, () => {
        // 기존 상점 궤도 파티클 제거
        if (this.shopOrbitalParticles) {
          this.shopOrbitalParticles.forEach(p => {
            this.tweens.killTweensOf(p);
            p.destroy();
          });
        }
        this.shopOrbitalParticles = [];

        // 2개의 궤도 파티클 생성
        for (let i = 0; i < 2; i++) {
          const orbital = this.add.circle(headX, headY, 3, 0x00ffff)
            .setDepth(6012).setAlpha(0);
          this.shopElements.push(orbital);
          this.shopOrbitalParticles.push(orbital);

          // 등장 애니메이션
          this.tweens.add({
            targets: orbital,
            alpha: 1,
            scale: { from: 0, to: 1 },
            duration: 200,
            ease: 'Back.easeOut'
          });
        }

        // 궤도 회전 애니메이션
        let shopOrbitalAngle = 0;
        this.shopOrbitalTween = this.time.addEvent({
          delay: 16,
          callback: () => {
            if (!this.shopOpen || !this.shopOrbitalParticles) return;
            shopOrbitalAngle += 0.1;
            const orbitRadius = 12;

            this.shopOrbitalParticles.forEach((orbital, idx) => {
              if (orbital && orbital.active) {
                const angle = shopOrbitalAngle + (idx * Math.PI);
                orbital.setPosition(
                  headX + Math.cos(angle) * orbitRadius,
                  headY + Math.sin(angle) * orbitRadius
                );
              }
            });
          },
          loop: true
        });

        // 글로우 링
        const glowRing = this.add.circle(headX, headY, 12, 0x000000, 0)
          .setStrokeStyle(1, 0x00ffff, 0.3)
          .setDepth(6011);
        this.shopElements.push(glowRing);
      });

      // 6. "BOOST EQUIPPED!" 텍스트
      this.time.delayedCall(700, () => {
        const equipText = this.add.text(headX, headY - 40, 'BOOST!', {
          fontSize: '14px',
          fill: '#00ffff',
          fontStyle: 'bold',
          stroke: '#004444',
          strokeThickness: 3
        }).setOrigin(0.5).setDepth(6017).setAlpha(0).setScale(0.5);

        this.tweens.add({
          targets: equipText,
          alpha: 1,
          scale: 1.2,
          y: headY - 55,
          duration: 300,
          ease: 'Back.easeOut',
          onComplete: () => {
            this.tweens.add({
              targets: equipText,
              alpha: 0,
              y: headY - 70,
              duration: 400,
              delay: 400,
              onComplete: () => equipText.destroy()
            });
          }
        });
      });
    }

    // 카드가 위로 날아가며 사라지는 애니메이션
    if (card.floatTween) {
      card.floatTween.stop();
      card.floatTween = null;
    }

    // 구매 성공 파티클 폭발
    const cardX = card.container.x;
    const cardY = card.container.y;
    for (let i = 0; i < 15; i++) {
      const angle = (i / 15) * Math.PI * 2;
      const particle = this.add.circle(
        cardX,
        cardY,
        4,
        [0x00ff00, 0xffff00, 0x00ffff][Math.floor(Math.random() * 3)]
      ).setDepth(6003);

      this.tweens.add({
        targets: particle,
        x: cardX + Math.cos(angle) * 80,
        y: cardY + Math.sin(angle) * 80,
        alpha: 0,
        scale: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 카드 날아가며 회전
    this.tweens.add({
      targets: card.container,
      y: -200,
      angle: 360,
      scale: 0.5,
      alpha: 0,
      duration: 600,
      ease: 'Back.easeIn',
      onComplete: () => {
        // 구매 완료 표시 (빈 슬롯)
        const soldText = this.add.text(cardX, 200, 'SOLD', {
          fontSize: '16px',
          fill: '#666666',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(6001).setAlpha(0);

        this.tweens.add({
          targets: soldText,
          alpha: 0.5,
          duration: 300
        });

        this.shopElements.push(soldText);
      }
    });

    // 돈 감소 애니메이션
    this.tweens.add({
      targets: this.shopMoneyText,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 100,
      yoyo: true
    });

    // 다음 카드로 자동 이동 (오른쪽으로)
    this.time.delayedCall(300, () => {
      const currentIndex = index;
      const itemCount = this.shopItems.length;

      // 현재 인덱스+1부터 오른쪽으로 검색
      for (let i = 1; i <= itemCount; i++) {
        const nextIndex = (currentIndex + i) % itemCount;
        if (!this.shopItems[nextIndex].purchased) {
          this.selectedShopIndex = nextIndex;
          this.updateShopSelection();
          return;
        }
      }
      // 모두 구매했으면 Next Stage로
      this.selectedShopIndex = this.shopItems.length;
      this.updateShopSelection();
    });
  }

  // 인게임 스피드 부스트 궤도 초기화
  initSpeedBoostOrbitals() {
    // 기존 궤도 정리
    this.cleanupSpeedBoostOrbitals();

    const orbitRadius = 14;
    this.speedBoostOrbitals = [];

    // 궤도 링
    const orbitRing = this.add.circle(0, 0, orbitRadius)
      .setStrokeStyle(1, 0x00ffff, 0.2)
      .setDepth(1000)
      .setVisible(false);
    orbitRing.isRing = true;
    this.speedBoostOrbitals.push(orbitRing);

    // 2개의 전자 파티클
    for (let i = 0; i < 2; i++) {
      // 트레일 (각 전자당 3개)
      for (let t = 0; t < 3; t++) {
        const trail = this.add.circle(0, 0, 3 - t * 0.6, 0x00ffff, 0.2 - t * 0.05)
          .setDepth(1000)
          .setVisible(false);
        trail.trailIndex = t;
        trail.electronIndex = i;
        this.speedBoostOrbitals.push(trail);
      }

      // 글로우
      const glow = this.add.circle(0, 0, 5.5, 0x00ffff, 0.35)
        .setDepth(1001)
        .setVisible(false);
      glow.isGlow = true;
      glow.electronIndex = i;
      this.speedBoostOrbitals.push(glow);

      // 외곽
      const outer = this.add.circle(0, 0, 3, 0x00ffff, 0.9)
        .setDepth(1002)
        .setVisible(false);
      outer.isOuter = true;
      outer.electronIndex = i;
      this.speedBoostOrbitals.push(outer);

      // 코어
      const core = this.add.circle(0, 0, 1.5, 0xffffff, 1)
        .setDepth(1003)
        .setVisible(false);
      core.isCore = true;
      core.electronIndex = i;
      this.speedBoostOrbitals.push(core);
    }

    // 60fps 타이머로 업데이트
    this.speedBoostOrbitalTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.updateSpeedBoostOrbitals()
    });

    // 즉시 표시
    this.speedBoostOrbitals.forEach(p => p.setVisible(true));
  }

  // 인게임 스피드 부스트 궤도 업데이트
  updateSpeedBoostOrbitals() {
    if (!this.hasSpeedBoost || !this.speedBoostOrbitals || this.speedBoostOrbitals.length === 0) return;
    if (!this.snake || this.snake.length === 0) return;

    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 인게임은 크기가 커서 느리게 돌아야 프리뷰와 비슷하게 느껴짐
    const angle = this.time.now * 0.011;
    const orbitRadius = 14;
    const pulseSize = 1 + Math.sin(angle * 3) * 0.4;
    const ringAlpha = 0.12 + Math.sin(angle * 2) * 0.08;

    this.speedBoostOrbitals.forEach(p => {
      if (!p || !p.active) return;

      // 궤도 링
      if (p.isRing) {
        p.setPosition(headX, headY);
        p.setStrokeStyle(1, 0x00ffff, ringAlpha);
        return;
      }

      const electronAngle = angle + (p.electronIndex * Math.PI);

      // 트레일
      if (p.trailIndex !== undefined) {
        const trailAngle = electronAngle - ((p.trailIndex + 1) * 0.18);
        p.setPosition(
          headX + Math.cos(trailAngle) * orbitRadius,
          headY + Math.sin(trailAngle) * orbitRadius
        );
        p.setRadius((3 - p.trailIndex * 0.6) * pulseSize);
      }
      // 글로우
      else if (p.isGlow) {
        p.setPosition(
          headX + Math.cos(electronAngle) * orbitRadius,
          headY + Math.sin(electronAngle) * orbitRadius
        );
        p.setRadius(4.5 + pulseSize);
      }
      // 외곽
      else if (p.isOuter) {
        p.setPosition(
          headX + Math.cos(electronAngle) * orbitRadius,
          headY + Math.sin(electronAngle) * orbitRadius
        );
        p.setRadius(3 * pulseSize);
      }
      // 코어
      else if (p.isCore) {
        p.setPosition(
          headX + Math.cos(electronAngle) * orbitRadius,
          headY + Math.sin(electronAngle) * orbitRadius
        );
        p.setRadius(1.5 * pulseSize);
      }
    });
  }

  // 인게임 스피드 부스트 궤도 정리
  cleanupSpeedBoostOrbitals() {
    if (this.speedBoostOrbitalTimer) {
      this.speedBoostOrbitalTimer.destroy();
      this.speedBoostOrbitalTimer = null;
    }
    if (this.speedBoostOrbitals) {
      this.speedBoostOrbitals.forEach(p => {
        if (p && p.active) p.destroy();
      });
      this.speedBoostOrbitals = [];
    }
  }

  // 상점 프리뷰에 장착된 수트들 적용
  applyShopPreviewSuits() {
    if (!this.shopPreviewInfo || !this.shopSnakePreview || this.shopSnakePreview.length === 0) return;

    const { headX, headY, gridSize } = this.shopPreviewInfo;
    const scale = gridSize / this.gridSize; // 12/20 = 0.6

    // 스피드 부스트 궤도 파티클 적용
    if (this.hasSpeedBoost) {
      const orbitRadius = 14 * scale; // 8.4
      this.shopOrbitalParticles = [];
      let angle = 0;

      // 궤도 링
      const orbitRing = this.add.circle(headX, headY, orbitRadius)
        .setStrokeStyle(1, 0x00ffff, 0.2)
        .setDepth(6003)
        .setAlpha(0);
      this.shopOrbitalParticles.push(orbitRing);
      this.shopElements.push(orbitRing);

      // 2개의 전자 파티클
      for (let i = 0; i < 2; i++) {
        // 트레일 파티클 (각 전자당 3개)
        for (let t = 0; t < 3; t++) {
          const trail = this.add.circle(headX, headY, (2.5 - t * 0.4) * scale, 0x00ffff, 0.15 - t * 0.04)
            .setDepth(6003)
            .setAlpha(0);
          trail.trailIndex = t;
          trail.electronIndex = i;
          this.shopOrbitalParticles.push(trail);
          this.shopElements.push(trail);
        }

        // 글로우 (큰 것)
        const glow = this.add.circle(headX, headY, 4 * scale, 0x00ffff, 0.35)
          .setDepth(6003)
          .setAlpha(0);
        glow.isGlow = true;
        glow.electronIndex = i;
        this.shopOrbitalParticles.push(glow);
        this.shopElements.push(glow);

        // 외곽 (청록색)
        const outer = this.add.circle(headX, headY, 2.5 * scale, 0x00ffff, 0.9)
          .setDepth(6004)
          .setAlpha(0);
        outer.isOuter = true;
        outer.electronIndex = i;
        this.shopOrbitalParticles.push(outer);
        this.shopElements.push(outer);

        // 코어 (흰색)
        const core = this.add.circle(headX, headY, 1.2 * scale, 0xffffff, 1)
          .setDepth(6005)
          .setAlpha(0);
        core.isCore = true;
        core.electronIndex = i;
        this.shopOrbitalParticles.push(core);
        this.shopElements.push(core);
      }

      // 페이드인 애니메이션
      this.shopOrbitalParticles.forEach(p => {
        this.tweens.add({
          targets: p,
          alpha: p.fillAlpha || p.strokeAlpha || 1,
          duration: 300,
          ease: 'Power2'
        });
      });

      // 궤도 회전 애니메이션
      this.shopOrbitalTween = this.time.addEvent({
        delay: 16,
        loop: true,
        callback: () => {
          if (!this.shopOrbitalParticles || this.shopOrbitalParticles.length === 0) return;

          angle += 0.25;
          const pulseSize = 1 + Math.sin(angle * 3) * 0.4;
          const ringAlpha = 0.12 + Math.sin(angle * 2) * 0.08;

          this.shopOrbitalParticles.forEach(p => {
            if (!p || !p.active) return;

            // 궤도 링 펄스
            if (p === orbitRing) {
              p.setStrokeStyle(1, 0x00ffff, ringAlpha);
              return;
            }

            const electronAngle = angle + (p.electronIndex * Math.PI);

            // 트레일 파티클
            if (p.trailIndex !== undefined) {
              const trailAngle = electronAngle - ((p.trailIndex + 1) * 0.18);
              p.x = headX + Math.cos(trailAngle) * orbitRadius;
              p.y = headY + Math.sin(trailAngle) * orbitRadius;
              p.setRadius((2.5 - p.trailIndex * 0.4) * scale * pulseSize);
            }
            // 글로우
            else if (p.isGlow) {
              p.x = headX + Math.cos(electronAngle) * orbitRadius;
              p.y = headY + Math.sin(electronAngle) * orbitRadius;
              p.setRadius((4 + pulseSize) * scale);
            }
            // 외곽
            else if (p.isOuter) {
              p.x = headX + Math.cos(electronAngle) * orbitRadius;
              p.y = headY + Math.sin(electronAngle) * orbitRadius;
              p.setRadius(2.5 * scale * pulseSize);
            }
            // 코어
            else if (p.isCore) {
              p.x = headX + Math.cos(electronAngle) * orbitRadius;
              p.y = headY + Math.sin(electronAngle) * orbitRadius;
              p.setRadius(1.2 * scale * pulseSize);
            }
          });
        }
      });
    }
  }

  closeShop() {
    this.shopKeyboardEnabled = false;
    this.shopOpen = false;
    this.lastShopFocusKey = null;
    this.closePurchaseConfirmOverlay(true);

    // 네온 tween 정리
    if (this.shopNeonTween) {
      this.shopNeonTween.stop();
      this.shopNeonTween = null;
    }

    // 상점 궤도 파티클 정리
    if (this.shopOrbitalTween) {
      this.shopOrbitalTween.destroy();
      this.shopOrbitalTween = null;
    }
    if (this.shopOrbitalParticles) {
      this.shopOrbitalParticles.forEach(p => {
        if (p && p.active) p.destroy();
      });
      this.shopOrbitalParticles = [];
    }

    // 카드 float tween 정리
    if (this.shopCards) {
      this.shopCards.forEach(card => {
        if (card.floatTween) {
          card.floatTween.stop();
        }
      });
    }

    // 멋진 닫기 애니메이션
    // 카드들이 흩어지며 사라짐
    if (this.shopCards) {
      this.shopCards.forEach((card, i) => {
        if (card.container && card.container.alpha > 0) {
          const angle = (Math.random() - 0.5) * 60;
          this.tweens.add({
            targets: card.container,
            y: -300,
            x: card.container.x + (Math.random() - 0.5) * 200,
            angle: angle,
            alpha: 0,
            duration: 400,
            delay: i * 50,
            ease: 'Power2.easeIn'
          });
        }
      });
    }

    // 나머지 요소들 페이드 아웃
    this.shopElements.forEach(element => {
      if (element && element.active !== false) {
        this.tweens.add({
          targets: element,
          alpha: 0,
          duration: 400,
          ease: 'Power2',
          onComplete: () => {
            if (element && element.destroy) {
              element.destroy();
            }
          }
        });
      }
    });

    this.shopElements = [];
    this.shopCards = [];

    // 카운트다운 후 다음 스테이지
    this.time.delayedCall(500, () => {
      this.shopCountdownAndStart();
    });
  }

  shopCountdownAndStart() {
    const { width, height } = this.cameras.main;

    // 카운트다운 텍스트
    const countdownText = this.add.text(width / 2, height / 2, '', {
      fontSize: '96px',
      fill: '#00ffff',
      fontStyle: 'bold',
      stroke: '#0088ff',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(5001);

    let countdown = 3;
    countdownText.setText(countdown.toString());

    // 펄스 애니메이션
    this.tweens.add({
      targets: countdownText,
      scaleX: { from: 0.5, to: 1 },
      scaleY: { from: 0.5, to: 1 },
      duration: 200,
      ease: 'Back.easeOut'
    });

    this.time.addEvent({
      delay: 500,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          countdownText.setText(countdown.toString());
          this.tweens.add({
            targets: countdownText,
            scaleX: { from: 0.5, to: 1 },
            scaleY: { from: 0.5, to: 1 },
            duration: 200,
            ease: 'Back.easeOut'
          });
        } else {
          countdownText.destroy();
          this.showNextStage();
        }
      },
      repeat: 2
    });
  }

  // =====================
  // 뱅킹/대출 시스템
  // =====================

  openLoanUI() {
    if (this.loanUIOpen) return;
    this.loanUIOpen = true;
    this.isLoanProcessing = false; // 대출 처리 플래그 리셋
    this.shopKeyboardEnabled = false;
    this.loanMode = 'borrow';

    const { width, height } = this.cameras.main;

    // 어두운 딤 오버레이 (상점 위에)
    const dimOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setDepth(6999);
    this.loanElements.push(dimOverlay);

    this.tweens.add({
      targets: dimOverlay,
      fillAlpha: 0.7,
      duration: 300
    });

    // 메인 뱅크 UI 배경 (오른쪽)
    const loanBg = this.add.rectangle(width / 2 + 60, height / 2, 380, 420, 0x0a0a1a, 0.98)
      .setDepth(7001)
      .setStrokeStyle(3, 0x4a9eff)
      .setAlpha(0);
    this.loanElements.push(loanBg);

    // 타이틀
    const loanTitle = this.add.text(width / 2 + 60, height / 2 - 180, 'BANK', {
      fontSize: '28px',
      fill: '#00ffff',
      fontStyle: 'bold',
      stroke: '#004444',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(loanTitle);

    // 배경 먼저 표시
    this.tweens.add({
      targets: [loanBg, loanTitle],
      alpha: 1,
      duration: 200,
      ease: 'Power2'
    });

    // 부채 정보는 상점 사이드바에 표시됨

    // 은행 검색 시작
    this.startBankSearch(width, height);

    // ESC 키로 닫기
    this.loanEscHandler = this.input.keyboard.once('keydown-ESC', () => {
      this.closeLoanUI();
    });
  }

  showDebtSummary(width, height) {
    // 왼쪽 채무 패널 배경
    const debtPanelX = width / 2 - 150;
    const debtBg = this.add.rectangle(debtPanelX, height / 2, 160, 300, 0x1a0a0a, 0.95)
      .setDepth(7001)
      .setStrokeStyle(2, 0xff4444)
      .setAlpha(0);
    this.loanElements.push(debtBg);

    // 패널 타이틀
    const debtTitle = this.add.text(debtPanelX, height / 2 - 120, 'YOUR DEBTS', {
      fontSize: '14px',
      fill: '#ff6666',
      fontStyle: 'bold',
      stroke: '#440000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(debtTitle);

    let totalDue = 0;
    const debtTexts = [];

    this.loans.forEach((loan, i) => {
      totalDue += loan.due;

      // 은행 이름
      const bankName = this.add.text(
        debtPanelX,
        height / 2 - 85 + i * 45,
        loan.bankName,
        {
          fontSize: '11px',
          fill: '#ffffff',
          fontStyle: 'bold'
        }
      ).setOrigin(0.5).setDepth(7002).setAlpha(0);

      // 금액 및 이자율
      const debtDetail = this.add.text(
        debtPanelX,
        height / 2 - 70 + i * 45,
        `$${loan.due} (${loan.interestRate}%)`,
        {
          fontSize: '10px',
          fill: '#ff8888'
        }
      ).setOrigin(0.5).setDepth(7002).setAlpha(0);

      debtTexts.push(bankName, debtDetail);
      this.loanElements.push(bankName, debtDetail);
    });

    this.totalDebt = totalDue;

    // 구분선
    const divider = this.add.rectangle(debtPanelX, height / 2 + 70, 120, 2, 0xff4444)
      .setDepth(7002).setAlpha(0);
    this.loanElements.push(divider);

    // 총 부채
    const totalText = this.add.text(
      debtPanelX,
      height / 2 + 90,
      `TOTAL`,
      {
        fontSize: '10px',
        fill: '#ff8888'
      }
    ).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(totalText);

    const totalAmount = this.add.text(
      debtPanelX,
      height / 2 + 108,
      `$${totalDue}`,
      {
        fontSize: '16px',
        fill: '#ff4444',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(totalAmount);

    // 패널 슬라이드인 애니메이션
    debtBg.x -= 50;
    this.tweens.add({
      targets: debtBg,
      alpha: 1,
      x: '+=50',
      duration: 300,
      ease: 'Back.easeOut'
    });

    // 타이틀 등장
    this.tweens.add({
      targets: debtTitle,
      alpha: 1,
      duration: 200,
      delay: 150
    });

    // 채무 목록 순차 등장
    debtTexts.forEach((el, i) => {
      this.tweens.add({
        targets: el,
        alpha: 1,
        duration: 200,
        delay: 200 + i * 50,
        ease: 'Power2'
      });
    });

    // 구분선 및 총액 등장
    this.tweens.add({
      targets: [divider, totalText, totalAmount],
      alpha: 1,
      duration: 200,
      delay: 300 + debtTexts.length * 50
    });
  }

  startBankSearch(width, height) {
    const panelX = width / 2 + 60; // 오른쪽 패널 중심

    // 스피너 (회전하는 원) - 클래스 속성으로 저장
    this.bankSearchSpinner = this.add.circle(panelX, height / 2 - 30, 25, 0x4a9eff, 0)
      .setDepth(7002).setStrokeStyle(4, 0x4a9eff);
    this.loanElements.push(this.bankSearchSpinner);

    // 스피너 회전 애니메이션
    this.tweens.add({
      targets: this.bankSearchSpinner,
      angle: 360,
      duration: 1000,
      repeat: -1,
      ease: 'Linear'
    });

    // 스피너 펄스 효과
    this.tweens.add({
      targets: this.bankSearchSpinner,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 검색 메시지 표시
    const searchText = this.add.text(panelX, height / 2 + 20, 'Searching for banks...', {
      fontSize: '14px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(searchText);

    // 로딩 도트 애니메이션
    let dots = 0;
    this.bankSearchDotAnimation = this.time.addEvent({
      delay: 300,
      callback: () => {
        if (searchText && searchText.active) {
          dots = (dots + 1) % 4;
          searchText.setText('Searching for banks' + '.'.repeat(dots));
        }
      },
      loop: true
    });

    // 검색 텍스트 등장 + 펄스
    this.tweens.add({
      targets: searchText,
      alpha: 1,
      duration: 200,
      delay: 300,
      onComplete: () => {
        this.tweens.add({
          targets: searchText,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // 티어에 따른 검색 시간 결정
    let searchDelay;
    let tierKey;

    if (this.loanTier === 0) {
      tierKey = 'tier1';
      searchDelay = getRandomInRange(bankData.searchAnimation.tier1.minDelay, bankData.searchAnimation.tier1.maxDelay);
    } else if (this.loanTier === 1) {
      tierKey = 'tier2';
      searchDelay = getRandomInRange(bankData.searchAnimation.tier2.minDelay, bankData.searchAnimation.tier2.maxDelay);
    } else if (this.loanTier === 2) {
      tierKey = 'tier3';
      searchDelay = getRandomInRange(bankData.searchAnimation.tier3.minDelay, bankData.searchAnimation.tier3.maxDelay);
    } else {
      // 4차 이상 - 대출 불가
      tierKey = null;
      searchDelay = getRandomInRange(bankData.searchAnimation.noBank.minDelay, bankData.searchAnimation.noBank.maxDelay);
    }

    // 검색 완료 후 은행 목록 표시
    this.time.delayedCall(searchDelay, () => {
      if (this.bankSearchDotAnimation) {
        this.bankSearchDotAnimation.destroy();
        this.bankSearchDotAnimation = null;
      }

      // 검색 텍스트 사라짐
      this.tweens.add({
        targets: searchText,
        alpha: 0,
        y: searchText.y - 20,
        duration: 200,
        onComplete: () => {
          if (tierKey) {
            this.showAvailableBanks(width, height, tierKey);
          } else {
            this.showNoBanksAvailable(width, height);
          }
        }
      });
    });
  }

  showAvailableBanks(width, height, tierKey) {
    // 스피너 제거
    if (this.bankSearchSpinner) {
      this.tweens.killTweensOf(this.bankSearchSpinner);
      this.bankSearchSpinner.destroy();
      this.bankSearchSpinner = null;
    }

    const panelX = width / 2 + 60; // 오른쪽 패널 중심

    // 은행 목록 생성
    this.availableBanks = generateBankList(tierKey);
    this.selectedBankIndex = 0;
    this.bankTexts = [];

    // 결과 타이틀 - 펑! 하고 등장
    const resultTitle = this.add.text(panelX, height / 2 - 130, 'Available Banks:', {
      fontSize: '20px',
      fill: '#00ff88',
      fontStyle: 'bold',
      stroke: '#003311',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(7002).setAlpha(0).setScale(0);
    this.loanElements.push(resultTitle);

    // 은행 목록 표시
    this.availableBanks.forEach((bank, i) => {
      // 은행 이름 배경 (카드 느낌)
      const cardBg = this.add.rectangle(
        panelX,
        height / 2 - 80 + i * 50,
        320, 42, 0x1a2a3f, 0.9
      ).setDepth(7001).setAlpha(0).setStrokeStyle(2, 0x00aa44);
      this.loanElements.push(cardBg);

      const bankText = this.add.text(
        panelX,
        height / 2 - 90 + i * 50,
        `${bank.name}`,
        {
          fontSize: '16px',
          fill: '#ffffff',
          fontStyle: 'bold'
        }
      ).setOrigin(0.5).setDepth(7002).setAlpha(0).setScale(0.5);

      const detailText = this.add.text(
        panelX,
        height / 2 - 70 + i * 50,
        `Rate: ${bank.interestRate}% | Max: $${bank.maxLoan}`,
        {
          fontSize: '12px',
          fill: '#aaaaaa',
          fontStyle: 'bold'
        }
      ).setOrigin(0.5).setDepth(7002).setAlpha(0);

      this.bankTexts.push({ name: bankText, detail: detailText, bank, card: cardBg });
      this.loanElements.push(bankText, detailText);
    });

    // 안내 텍스트
    const helpText = this.add.text(panelX, height / 2 + 170, '↑↓: Select  ENTER: Borrow  ESC: Cancel', {
      fontSize: '12px',
      fill: '#888888',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(helpText);

    // 타이틀 펑! 등장
    this.tweens.add({
      targets: resultTitle,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 반짝 효과
        this.tweens.add({
          targets: resultTitle,
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100,
          yoyo: true
        });
      }
    });

    this.bankTexts.forEach((item, i) => {
      // 카드 배경 - 위에서 떨어짐
      item.card.y -= 30;
      this.tweens.add({
        targets: item.card,
        alpha: 1,
        y: '+=30',
        duration: 400,
        delay: 150 + i * 120,
        ease: 'Bounce.easeOut'
      });

      // 이름 - 스케일 업 + 바운스
      this.tweens.add({
        targets: item.name,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 350,
        delay: 200 + i * 120,
        ease: 'Back.easeOut'
      });

      // 상세 - 페이드 + 슬라이드
      item.detail.y += 10;
      this.tweens.add({
        targets: item.detail,
        alpha: 1,
        y: '-=10',
        duration: 300,
        delay: 250 + i * 120,
        ease: 'Power2'
      });
    });

    this.tweens.add({
      targets: helpText,
      alpha: 1,
      duration: 200,
      delay: 300 + this.availableBanks.length * 100
    });

    // 선택 업데이트
    this.time.delayedCall(300 + this.availableBanks.length * 100, () => {
      this.updateBankSelection();
    });
  }

  showNoBanksAvailable(width, height) {
    // 스피너 제거
    if (this.bankSearchSpinner) {
      this.tweens.killTweensOf(this.bankSearchSpinner);
      this.bankSearchSpinner.destroy();
      this.bankSearchSpinner = null;
    }

    const panelX = width / 2 + 60; // 오른쪽 패널 중심

    // 메인 메시지 - 은행 없음
    const noLoanText = this.add.text(panelX, height / 2 - 80, 'NO BANKS AVAILABLE!', {
      fontSize: '20px',
      fill: '#ff4444',
      fontStyle: 'bold',
      stroke: '#440000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(noLoanText);

    // 위트있는 메시지
    const wittyText = this.add.text(panelX, height / 2 - 40,
      "You've maxed out every bank in town!", {
      fontSize: '12px',
      fill: '#ffaa00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(wittyText);

    const wittyText2 = this.add.text(panelX, height / 2 - 15,
      "Time to pay your debts, rookie!", {
      fontSize: '14px',
      fill: '#ff8888',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(wittyText2);

    // OK 버튼
    const okBg = this.add.rectangle(panelX, height / 2 + 50, 100, 35, 0x006600)
      .setStrokeStyle(2, 0x00ff00)
      .setDepth(7001).setAlpha(0)
      .setInteractive({ useHandCursor: true });
    this.loanElements.push(okBg);

    const okText = this.add.text(panelX, height / 2 + 50, 'OK', {
      fontSize: '16px',
      fill: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(okText);

    const helpText = this.add.text(panelX, height / 2 + 90, 'Press ESC or click OK', {
      fontSize: '10px',
      fill: '#888888'
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(helpText);

    // OK 버튼 클릭 이벤트
    okBg.on('pointerdown', () => {
      this.closeLoanUI();
    });

    okBg.on('pointerover', () => {
      okBg.setFillStyle(0x008800);
    });

    okBg.on('pointerout', () => {
      okBg.setFillStyle(0x006600);
    });

    // 엔터키로 닫기
    this.input.keyboard.once('keydown-ENTER', () => {
      this.closeLoanUI();
    });

    // 애니메이션
    const elements = [noLoanText, wittyText, wittyText2, okBg, okText, helpText];
    elements.forEach((el, i) => {
      el.setScale(0.5);
      this.tweens.add({
        targets: el,
        alpha: 1,
        scaleX: 1,
        scaleY: 1,
        duration: 300,
        delay: i * 80,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (i === 0) {
            // 타이틀 흔들림
            this.tweens.add({
              targets: el,
              x: el.x + 5,
              duration: 50,
              yoyo: true,
              repeat: 5
            });
          }
        }
      });
    });
  }

  showRepaymentOptions(width, height) {
    this.loanMode = 'repay';
    this.selectedBankIndex = 0;
    this.repayTexts = [];

    const panelX = width / 2 + 60; // 오른쪽 패널 중심

    // 상환 타이틀 - 더 화려하게
    const repayTitle = this.add.text(panelX, height / 2 - 60, '💳 Your Loans 💳', {
      fontSize: '18px',
      fill: '#ffaa00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(7002).setAlpha(0).setScale(0.3);
    this.loanElements.push(repayTitle);

    // 대출 목록 표시 - 카드 스타일
    this.loans.forEach((loan, i) => {
      const canRepay = this.money >= loan.due;
      const yPos = height / 2 - 10 + i * 50;

      // 카드 배경
      const cardBg = this.add.rectangle(panelX, yPos + 5, 280, 40, canRepay ? 0x003322 : 0x331111)
        .setStrokeStyle(2, canRepay ? 0x00ff88 : 0xff4444)
        .setDepth(7001).setAlpha(0);
      this.loanElements.push(cardBg);

      const loanText = this.add.text(
        panelX,
        yPos - 5,
        `${loan.bankName}`,
        {
          fontSize: '13px',
          fill: canRepay ? '#ffffff' : '#888888',
          fontStyle: 'bold'
        }
      ).setOrigin(0.5).setDepth(7002).setAlpha(0);

      const detailText = this.add.text(
        panelX,
        yPos + 12,
        `Owe: $${loan.due} ${canRepay ? '✓ Can Repay' : '✗ Need $' + (loan.due - this.money) + ' more'}`,
        {
          fontSize: '9px',
          fill: canRepay ? '#00ff88' : '#ff6666'
        }
      ).setOrigin(0.5).setDepth(7002).setAlpha(0);

      this.repayTexts.push({ name: loanText, detail: detailText, card: cardBg, loan, canRepay });
      this.loanElements.push(loanText, detailText);
    });

    // 안내 텍스트
    const helpText = this.add.text(panelX, height / 2 + 160, '↑↓: Select  ENTER: Repay  ESC: Cancel', {
      fontSize: '10px',
      fill: '#888888',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7002).setAlpha(0);
    this.loanElements.push(helpText);

    // 타이틀 줌인 + 바운스
    this.tweens.add({
      targets: repayTitle,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      delay: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 펄스 효과
        this.tweens.add({
          targets: repayTitle,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      }
    });

    // 카드 바운스 등장
    this.repayTexts.forEach((item, i) => {
      const startY = item.card.y - 50;
      item.card.y = startY;
      item.name.y = startY - 10;
      item.detail.y = startY + 7;

      // 카드 배경 바운스
      this.tweens.add({
        targets: item.card,
        alpha: 1,
        y: '+=50',
        duration: 400,
        delay: 500 + i * 120,
        ease: 'Bounce.easeOut'
      });

      // 텍스트들 바운스
      this.tweens.add({
        targets: [item.name, item.detail],
        alpha: 1,
        y: '+=50',
        duration: 400,
        delay: 520 + i * 120,
        ease: 'Bounce.easeOut'
      });

      // 착지 파티클
      this.time.delayedCall(700 + i * 120, () => {
        for (let p = 0; p < 8; p++) {
          const particle = this.add.circle(
            width / 2 + (Math.random() - 0.5) * 100,
            item.card.y + 20,
            2,
            item.canRepay ? 0x00ff88 : 0xff4444
          ).setDepth(7003).setAlpha(0.8);

          this.tweens.add({
            targets: particle,
            y: item.card.y + 20 + Math.random() * 15,
            x: particle.x + (Math.random() - 0.5) * 30,
            alpha: 0,
            duration: 400,
            onComplete: () => particle.destroy()
          });
        }
      });
    });

    // 도움말 페이드인 + 깜빡임
    this.tweens.add({
      targets: helpText,
      alpha: 1,
      duration: 300,
      delay: 800 + this.loans.length * 120,
      onComplete: () => {
        this.tweens.add({
          targets: helpText,
          alpha: 0.5,
          duration: 1000,
          yoyo: true,
          repeat: -1
        });
      }
    });

    // 선택 업데이트
    this.time.delayedCall(900 + this.loans.length * 120, () => {
      this.updateRepaySelection();
    });
  }

  updateRepaySelection() {
    if (!this.repayTexts || this.repayTexts.length === 0) return;

    this.repayTexts.forEach((item, i) => {
      if (i === this.selectedBankIndex) {
        // 선택된 항목 - 강조
        item.name.setFill(item.canRepay ? '#00ffff' : '#ff8888');
        item.detail.setFill(item.canRepay ? '#00ff88' : '#ff6666');

        // 카드 배경 강조
        if (item.card) {
          item.card.setStrokeStyle(3, item.canRepay ? 0x00ffff : 0xff8888);
          this.tweens.add({
            targets: item.card,
            scaleX: 1.05,
            scaleY: 1.1,
            duration: 150,
            ease: 'Back.easeOut'
          });
        }

        // 텍스트 스케일 업 + 들썩임
        this.tweens.add({
          targets: [item.name, item.detail],
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100,
          ease: 'Power2'
        });

        // 선택 글로우 효과
        this.tweens.add({
          targets: item.name,
          alpha: { from: 0.8, to: 1 },
          duration: 300,
          yoyo: true,
          repeat: -1
        });
      } else {
        // 선택 해제
        item.name.setFill(item.canRepay ? '#ffffff' : '#888888');
        item.detail.setFill(item.canRepay ? '#00ff88' : '#ff6666');

        if (item.card) {
          item.card.setStrokeStyle(2, item.canRepay ? 0x00ff88 : 0xff4444);
          this.tweens.add({
            targets: item.card,
            scaleX: 1,
            scaleY: 1,
            duration: 100,
            ease: 'Power2'
          });
        }

        this.tweens.killTweensOf(item.name);
        item.name.setAlpha(1);

        this.tweens.add({
          targets: [item.name, item.detail],
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Power2'
        });
      }
    });
  }

  updateBankSelection() {
    if (!this.bankTexts || this.bankTexts.length === 0) return;

    this.bankTexts.forEach((item, i) => {
      if (i === this.selectedBankIndex) {
        // 선택된 은행 - 강조
        item.name.setFill('#00ffff');
        item.detail.setFill('#00ff88');

        // 카드 배경 강조
        if (item.card) {
          item.card.setStrokeStyle(3, 0x00ffff);
          this.tweens.add({
            targets: item.card,
            scaleX: 1.05,
            scaleY: 1.1,
            duration: 150,
            ease: 'Back.easeOut'
          });
        }

        // 스케일 업 애니메이션
        this.tweens.add({
          targets: [item.name, item.detail],
          scaleX: 1.1,
          scaleY: 1.1,
          duration: 100,
          ease: 'Power2'
        });

        // 선택 글로우 효과
        this.tweens.add({
          targets: item.name,
          alpha: { from: 0.8, to: 1 },
          duration: 300,
          yoyo: true,
          repeat: -1
        });
      } else {
        // 선택 해제
        item.name.setFill('#ffffff');
        item.detail.setFill('#888888');

        if (item.card) {
          item.card.setStrokeStyle(2, 0x00aa44);
          this.tweens.add({
            targets: item.card,
            scaleX: 1,
            scaleY: 1,
            duration: 100,
            ease: 'Power2'
          });
        }

        this.tweens.killTweensOf(item.name);
        item.name.setAlpha(1);

        this.tweens.add({
          targets: [item.name, item.detail],
          scaleX: 1,
          scaleY: 1,
          duration: 100,
          ease: 'Power2'
        });
      }
    });
  }

  handleLoanInput(direction) {
    if (!this.loanUIOpen) return;

    // 상환 모드
    if (this.loanMode === 'repay') {
      if (!this.repayTexts || this.repayTexts.length === 0) return;

      if (direction === 'UP') {
        this.selectedBankIndex = (this.selectedBankIndex - 1 + this.loans.length) % this.loans.length;
        this.updateRepaySelection();
      } else if (direction === 'DOWN') {
        this.selectedBankIndex = (this.selectedBankIndex + 1) % this.loans.length;
        this.updateRepaySelection();
      } else if (direction === 'ENTER') {
        this.repayLoan(this.selectedBankIndex);
      }
      return;
    }

    // 대출 모드
    if (!this.bankTexts || this.bankTexts.length === 0) return;

    if (direction === 'UP') {
      this.selectedBankIndex = (this.selectedBankIndex - 1 + this.availableBanks.length) % this.availableBanks.length;
      this.updateBankSelection();
    } else if (direction === 'DOWN') {
      this.selectedBankIndex = (this.selectedBankIndex + 1) % this.availableBanks.length;
      this.updateBankSelection();
    } else if (direction === 'ENTER') {
      // 대출 처리 중이면 무시 (엔터 연타 방지)
      if (this.isLoanProcessing) return;

      const selectedBank = this.availableBanks[this.selectedBankIndex];
      if (selectedBank) {
        this.isLoanProcessing = true;
        this.takeLoanFromBank(selectedBank);
      }
    }
  }

  takeLoanFromBank(bank) {
    const amount = bank.maxLoan;
    const interest = Math.ceil(amount * bank.interestRate / 100);
    const totalDue = amount + interest;
    const paymentPerStage = Math.ceil(totalDue / 5); // 5스테이지로 분할

    // 대출 기록 추가
    this.loans.push({
      bankId: bank.id,
      bankName: bank.name,
      principal: amount,
      interest: interest,
      interestRate: bank.interestRate,
      totalDue: totalDue,
      remaining: totalDue,
      paymentPerStage: paymentPerStage,
      stagesLeft: 5,
      missedPayments: 0
    });

    // 티어 증가
    this.loanTier++;

    // 돈 추가
    this.money += amount;
    this.totalDebt += totalDue;

    // 돈 획득 애니메이션
    const { width, height } = this.cameras.main;

    // 코인 파티클 효과
    for (let i = 0; i < 30; i++) {
      const coin = this.add.circle(
        width / 2 + (Math.random() - 0.5) * 150,
        height / 2,
        3 + Math.random() * 3,
        0xffff00
      ).setDepth(7003);

      this.tweens.add({
        targets: coin,
        x: 80,
        y: 180,
        alpha: 0,
        duration: 600 + Math.random() * 600,
        ease: 'Power2',
        onComplete: () => coin.destroy()
      });
    }

    // 획득 텍스트
    const gainText = this.add.text(width / 2, height / 2, `+$${amount}`, {
      fontSize: '48px',
      fill: '#00ff00',
      fontStyle: 'bold',
      stroke: '#004400',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(7003).setScale(0.5);

    this.tweens.add({
      targets: gainText,
      y: height / 2 - 60,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: gainText,
          alpha: 0,
          y: height / 2 - 100,
          duration: 500,
          onComplete: () => gainText.destroy()
        });
      }
    });

    // 은행명 표시
    const bankText = this.add.text(width / 2, height / 2 + 40, `Borrowed from ${bank.name}`, {
      fontSize: '14px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7003).setAlpha(0);

    this.tweens.add({
      targets: bankText,
      alpha: 1,
      duration: 200,
      delay: 200,
      onComplete: () => {
        this.tweens.add({
          targets: bankText,
          alpha: 0,
          duration: 300,
          delay: 800,
          onComplete: () => bankText.destroy()
        });
      }
    });

    // UI 닫기 및 상점 업데이트
    this.time.delayedCall(800, () => {
      this.closeLoanUI();
      if (this.shopMoneyText) {
        this.shopMoneyText.setText(`$${this.money}`);
        // 돈 펄스 효과
        this.tweens.add({
          targets: this.shopMoneyText,
          scaleX: 1.3,
          scaleY: 1.3,
          duration: 150,
          yoyo: true,
          ease: 'Back.easeOut'
        });
      }
      // 빚 정보 업데이트
      this.updateShopDebtInfo();
      // 실시간 상점 아이템 업데이트
      this.updateShopAffordability();
      this.updateShopSelection();
    });
  }

  updateShopDebtInfo() {
    if (!this.shopOpen) return;

    const sidebarMargin = 10;
    const sidebarWidth = 140;
    const contentX = sidebarMargin + 8;
    const contentCenterX = sidebarMargin + sidebarWidth / 2;
    const rightX = sidebarMargin + sidebarWidth - 8;

    // 기존 빚 정보 요소 제거 (shopElements에서도 제거)
    if (this.shopDebtElements) {
      this.shopDebtElements.forEach(el => {
        if (el && el.destroy) {
          // shopElements 배열에서도 제거
          const idx = this.shopElements.indexOf(el);
          if (idx > -1) this.shopElements.splice(idx, 1);
          el.destroy();
        }
      });
    }
    this.shopDebtElements = [];

    // 대출이 없으면 종료
    if (!this.loans || this.loans.length === 0) return;

    let debtY = 240;

    // 구분선
    const debtDivider = this.add.rectangle(contentCenterX, debtY, sidebarWidth - 16, 1, 0xff4444, 0.5)
      .setDepth(6002).setAlpha(0);
    this.shopDebtElements.push(debtDivider);
    this.shopElements.push(debtDivider);
    debtY += 12;

    // DEBTS 라벨
    const debtLabel = this.add.text(contentX, debtY, 'DEBTS', {
      fontSize: '11px',
      fill: '#ff4444',
      fontStyle: 'bold'
    }).setDepth(6002).setAlpha(0);
    this.shopDebtElements.push(debtLabel);
    this.shopElements.push(debtLabel);
    debtY += 16;

    // 각 은행별 상세 정보
    this.loans.forEach(loan => {
      const payment = loan.stagesLeft === 1 ? loan.remaining : Math.min(loan.paymentPerStage, loan.remaining);
      const afterPayment = loan.remaining - payment;

      // 은행 이름
      const shortName = loan.bankName.length > 12 ? loan.bankName.substring(0, 10) + '..' : loan.bankName;
      const bankText = this.add.text(contentX, debtY, shortName, {
        fontSize: '10px',
        fill: '#ffffff',
        fontStyle: 'bold'
      }).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(bankText);
      this.shopElements.push(bankText);
      debtY += 14;

      // 원금/이자
      const principalText = this.add.text(contentX, debtY, `P:$${loan.principal}`, {
        fontSize: '9px',
        fill: '#888888'
      }).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(principalText);
      this.shopElements.push(principalText);

      const interestText = this.add.text(rightX, debtY, `I:$${loan.interest}`, {
        fontSize: '9px',
        fill: '#888888'
      }).setOrigin(1, 0).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(interestText);
      this.shopElements.push(interestText);
      debtY += 12;

      // 잔금
      const remainText = this.add.text(contentX, debtY, `Remain:`, {
        fontSize: '9px',
        fill: '#aaaaaa'
      }).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(remainText);
      this.shopElements.push(remainText);

      const remainValue = this.add.text(rightX, debtY, `$${loan.remaining}`, {
        fontSize: '10px',
        fill: '#ff6666',
        fontStyle: 'bold'
      }).setOrigin(1, 0).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(remainValue);
      this.shopElements.push(remainValue);
      debtY += 12;

      // 다음상환
      const nextText = this.add.text(contentX, debtY, `Next:`, {
        fontSize: '9px',
        fill: '#aaaaaa'
      }).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(nextText);
      this.shopElements.push(nextText);

      const nextValue = this.add.text(rightX, debtY, `-$${payment}`, {
        fontSize: '10px',
        fill: '#ff4444',
        fontStyle: 'bold'
      }).setOrigin(1, 0).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(nextValue);
      this.shopElements.push(nextValue);
      debtY += 12;

      // 상환후
      const afterText = this.add.text(contentX, debtY, `After:`, {
        fontSize: '9px',
        fill: '#aaaaaa'
      }).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(afterText);
      this.shopElements.push(afterText);

      const afterValue = this.add.text(rightX, debtY, `$${afterPayment}`, {
        fontSize: '10px',
        fill: '#ffaa00',
        fontStyle: 'bold'
      }).setOrigin(1, 0).setDepth(6002).setAlpha(0);
      this.shopDebtElements.push(afterValue);
      this.shopElements.push(afterValue);
      debtY += 16;
    });

    // 총 부채
    const totalLine = this.add.rectangle(contentCenterX, debtY, sidebarWidth - 20, 1, 0xff4444, 0.3)
      .setDepth(6002).setAlpha(0);
    this.shopDebtElements.push(totalLine);
    this.shopElements.push(totalLine);
    debtY += 10;

    const totalDebtLabel = this.add.text(contentX, debtY, 'TOTAL', {
      fontSize: '10px',
      fill: '#ff4444'
    }).setDepth(6002).setAlpha(0);
    this.shopDebtElements.push(totalDebtLabel);
    this.shopElements.push(totalDebtLabel);

    const totalDebtValue = this.add.text(rightX, debtY, `$${this.totalDebt}`, {
      fontSize: '14px',
      fill: '#ff4444',
      fontStyle: 'bold'
    }).setOrigin(1, 0).setDepth(6002).setAlpha(0);
    this.shopDebtElements.push(totalDebtValue);
    this.shopElements.push(totalDebtValue);

    // 애니메이션으로 표시 (슬라이드 + 페이드인)
    this.shopDebtElements.forEach((el, i) => {
      const originalX = el.x;
      el.x = originalX - 20;
      this.tweens.add({
        targets: el,
        x: originalX,
        alpha: 1,
        duration: 250,
        delay: i * 30,
        ease: 'Power2'
      });
    });
  }

  updateShopAffordability() {
    // 상점 카드의 구매 가능 여부 실시간 업데이트
    if (!this.shopCards) return;

    this.shopCards.forEach((card, index) => {
      const item = this.shopItems[index];
      if (item.purchased) return;

      const canAfford = this.money >= item.price;

      // 가격 태그 색상 업데이트
      if (card.priceTag) {
        const priceTagColor = canAfford ? 0x00aa00 : 0x661111;
        const priceTagStroke = canAfford ? 0x00ff00 : 0xff4444;
        card.priceTag.setFillStyle(priceTagColor);
        card.priceTag.setStrokeStyle(2, priceTagStroke);
      }

      if (card.price) {
        const priceTextColor = canAfford ? '#00ff00' : '#ff4444';
        card.price.setFill(priceTextColor);

        // 구매 가능해졌을 때 반짝 효과
        if (canAfford) {
          this.tweens.add({
            targets: card.price,
            scaleX: 1.3,
            scaleY: 1.3,
            duration: 150,
            yoyo: true,
            ease: 'Power2'
          });
        }
      }
    });
  }

  applyLoanInterest() {
    // 스테이지 종료 시 이자 적용
    this.loans.forEach(loan => {
      const interest = Math.ceil(loan.due * loan.interestRate / 100);
      loan.due += interest;
    });

    // 총 부채 재계산
    this.totalDebt = this.loans.reduce((sum, loan) => sum + loan.due, 0);
  }

  checkMinimumPayment() {
    if (this.loans.length === 0) return;

    // 작은 금액 순으로 정렬
    this.loans.sort((a, b) => a.due - b.due);

    let totalPaid = 0;
    let missedLoans = [];
    let paidLoans = [];
    let bankruptBank = null;

    // 각 대출별로 최소 상환 시도
    this.loans.forEach(loan => {
      // 최소 상환금액 (대출의 10% 또는 남은 금액)
      const minPayment = Math.min(Math.ceil(loan.due * this.minimumPaymentRate), loan.due);

      if (this.money >= minPayment) {
        // 상환 성공
        this.money -= minPayment;
        loan.due -= minPayment;
        loan.missedPayments = 0; // 연체 횟수 리셋
        totalPaid += minPayment;
        paidLoans.push({ name: loan.bankName, amount: minPayment });
      } else {
        // 연체
        loan.missedPayments++;
        missedLoans.push({ name: loan.bankName, missed: loan.missedPayments });

        if (loan.missedPayments >= 2) {
          bankruptBank = loan.bankName;
        }
      }
    });

    // 완전 상환된 대출 제거
    this.loans = this.loans.filter(loan => loan.due > 0);
    this.loanTier = this.loans.length;

    // 총 부채 재계산
    this.totalDebt = this.loans.reduce((sum, loan) => sum + loan.due, 0);

    // 파산 체크 (2회 연속 연체)
    if (bankruptBank) {
      this.time.delayedCall(500, () => {
        this.showBankruptcyGameOver(bankruptBank);
      });
      return;
    }

    // 결과 표시
    if (missedLoans.length > 0) {
      this.showPaymentWarning(missedLoans);
    } else if (totalPaid > 0) {
      this.showPaymentSuccess(totalPaid, paidLoans);
    }
  }

  showPaymentSuccess(totalAmount, paidLoans) {
    const { width, height } = this.cameras.main;

    // 배경 플래시
    const flashBg = this.add.rectangle(width / 2, 110, 350, 80, 0x00ff88, 0)
      .setDepth(6999);
    this.tweens.add({
      targets: flashBg,
      fillAlpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => flashBg.destroy()
    });

    // 코인 파티클 효과 (위에서 떨어짐)
    for (let i = 0; i < 20; i++) {
      const coin = this.add.circle(
        width / 2 + (Math.random() - 0.5) * 200,
        70,
        3 + Math.random() * 2,
        0x00ff88
      ).setDepth(7001).setAlpha(0.9);

      this.tweens.add({
        targets: coin,
        y: 150 + Math.random() * 30,
        alpha: 0,
        duration: 800 + Math.random() * 400,
        delay: Math.random() * 200,
        ease: 'Bounce.easeOut',
        onComplete: () => coin.destroy()
      });
    }

    // 타이틀 - 줌인 등장
    const titleText = this.add.text(width / 2, 85, '✓ AUTO PAYMENT ✓', {
      fontSize: '16px',
      fill: '#00ff88',
      fontStyle: 'bold',
      stroke: '#003311',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(7000).setScale(0.3).setAlpha(0);

    // 총 상환액 - 큰 글씨 바운스
    const totalText = this.add.text(width / 2, 110, `-$${totalAmount}`, {
      fontSize: '24px',
      fill: '#00ff00',
      fontStyle: 'bold',
      stroke: '#004400',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(7000).setScale(0).setAlpha(0);

    // 은행별 상세
    const detailText = this.add.text(width / 2, 140,
      paidLoans.map(l => `${l.name}: -$${l.amount}`).join(' | '), {
      fontSize: '10px',
      fill: '#88ff88',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(7000).setAlpha(0);

    // 타이틀 애니메이션
    this.tweens.add({
      targets: titleText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 펄스
        this.tweens.add({
          targets: titleText,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 400,
          yoyo: true,
          repeat: 3
        });
      }
    });

    // 금액 바운스
    this.tweens.add({
      targets: totalText,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 400,
      delay: 150,
      ease: 'Bounce.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: totalText,
          scaleX: 1,
          scaleY: 1,
          duration: 200
        });
      }
    });

    // 상세 슬라이드인
    detailText.x -= 50;
    this.tweens.add({
      targets: detailText,
      alpha: 1,
      x: '+=50',
      duration: 300,
      delay: 300,
      ease: 'Power2'
    });

    // 전체 페이드아웃
    this.time.delayedCall(2500, () => {
      [titleText, totalText, detailText].forEach((el, i) => {
        this.tweens.add({
          targets: el,
          alpha: 0,
          y: el.y - 20,
          duration: 400,
          delay: i * 50,
          onComplete: () => el.destroy()
        });
      });
    });
  }

  showDebtFreeAnimation() {
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;

    // 메인 텍스트
    const debtFreeText = this.add.text(centerX, centerY - 20, 'DEBT FREE', {
      fontSize: '28px',
      fill: '#00ff88',
      fontStyle: 'bold',
      stroke: '#004422',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(7200).setAlpha(0).setScale(0.5);

    // 서브 텍스트
    const subText = this.add.text(centerX, centerY + 20, 'Good work. Keep it up.', {
      fontSize: '12px',
      fill: '#aaaaaa'
    }).setOrigin(0.5).setDepth(7200).setAlpha(0);

    // 메인 텍스트 등장
    this.tweens.add({
      targets: debtFreeText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });

    // 서브 텍스트 등장
    this.tweens.add({
      targets: subText,
      alpha: 1,
      duration: 300,
      delay: 300,
      ease: 'Power2'
    });

    // 2초 후 페이드아웃
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: [debtFreeText, subText],
        alpha: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => {
          debtFreeText.destroy();
          subText.destroy();
        }
      });
    });
  }

  showPaymentWarning(missedLoans) {
    const { width, height } = this.cameras.main;

    // 경고 중 키보드 입력 비활성화
    this.shopKeyboardEnabled = false;

    // 화면 흔들기
    this.cameras.main.shake(500, 0.02);

    // 빨간 플래시 효과
    const redFlash = this.add.rectangle(width / 2, height / 2, width, height, 0xff0000, 0)
      .setDepth(7999);
    this.tweens.add({
      targets: redFlash,
      fillAlpha: 0.4,
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => redFlash.destroy()
    });

    // 경고 오버레이
    const warningOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x330000, 0)
      .setDepth(8000);

    this.tweens.add({
      targets: warningOverlay,
      fillAlpha: 0.85,
      duration: 300
    });

    // 경고 아이콘 파티클
    for (let i = 0; i < 15; i++) {
      const spark = this.add.text(
        width / 2 + (Math.random() - 0.5) * 300,
        height / 2 + (Math.random() - 0.5) * 200,
        '⚠',
        { fontSize: '20px' }
      ).setOrigin(0.5).setDepth(8001).setAlpha(0.8);

      this.tweens.add({
        targets: spark,
        y: spark.y - 50,
        alpha: 0,
        rotation: Math.random() * 2,
        duration: 1000 + Math.random() * 500,
        onComplete: () => spark.destroy()
      });
    }

    // 경고 타이틀 - 스케일 폭발 등장
    const warningTitle = this.add.text(width / 2, height / 2 - 80, '⚠ PAYMENT WARNING! ⚠', {
      fontSize: '32px',
      fill: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(8001).setScale(3).setAlpha(0);

    // 연체 은행 목록
    const missedText = this.add.text(width / 2, height / 2 - 30,
      'Failed to pay:', {
      fontSize: '14px',
      fill: '#ff8888',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(8001).setAlpha(0);

    // 은행별 연체 상태 - 각 은행 별도 표시
    const bankElements = [];
    missedLoans.forEach((l, i) => {
      const bankEntry = this.add.text(width / 2, height / 2 + i * 25,
        `${l.name}: Strike ${l.missed}/2`, {
        fontSize: '16px',
        fill: l.missed >= 2 ? '#ff0000' : '#ffffff',
        align: 'center',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(8001).setAlpha(0);
      bankElements.push(bankEntry);
    });

    // 경고 메시지 - 깜빡임
    const strikeText = this.add.text(width / 2, height / 2 + 80,
      '💀 One more miss = BANKRUPT! 💀', {
      fontSize: '14px',
      fill: '#ffaa00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(8001).setAlpha(0);

    // 타이틀 폭발 등장
    this.tweens.add({
      targets: warningTitle,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 지속 흔들림
        this.tweens.add({
          targets: warningTitle,
          x: warningTitle.x + 3,
          duration: 50,
          yoyo: true,
          repeat: -1
        });
        // 빨간 펄스
        this.tweens.add({
          targets: warningTitle,
          fill: { from: '#ff4444', to: '#ff0000' },
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 300,
          yoyo: true,
          repeat: -1
        });
      }
    });

    // 연체 텍스트 슬라이드
    missedText.x -= 100;
    this.tweens.add({
      targets: missedText,
      alpha: 1,
      x: '+=100',
      duration: 300,
      delay: 400,
      ease: 'Power2'
    });

    // 은행별 순차 등장 + 흔들림
    bankElements.forEach((el, i) => {
      el.x += 100;
      this.tweens.add({
        targets: el,
        alpha: 1,
        x: '-=100',
        duration: 300,
        delay: 500 + i * 100,
        ease: 'Back.easeOut',
        onComplete: () => {
          // Strike 2면 격렬한 흔들림
          if (missedLoans[i].missed >= 2) {
            this.tweens.add({
              targets: el,
              x: el.x + 5,
              duration: 30,
              yoyo: true,
              repeat: -1
            });
          }
        }
      });
    });

    // 경고 메시지 깜빡임 등장
    this.tweens.add({
      targets: strikeText,
      alpha: 1,
      duration: 300,
      delay: 700 + missedLoans.length * 100,
      onComplete: () => {
        this.tweens.add({
          targets: strikeText,
          alpha: 0.3,
          duration: 300,
          yoyo: true,
          repeat: -1
        });
      }
    });

    // 자동으로 닫기
    this.time.delayedCall(4000, () => {
      const allElements = [warningOverlay, warningTitle, missedText, strikeText, ...bankElements];
      allElements.forEach((el, i) => {
        this.tweens.killTweensOf(el);
        this.tweens.add({
          targets: el,
          alpha: 0,
          scaleX: el === warningTitle ? 0.5 : 1,
          scaleY: el === warningTitle ? 0.5 : 1,
          duration: 300,
          delay: i * 30,
          onComplete: () => el.destroy()
        });
      });

      // 경고 종료 후 키보드 재활성화
      this.time.delayedCall(allElements.length * 30 + 350, () => {
        this.shopKeyboardEnabled = true;
      });
    });
  }

  showBankruptcyGameOver(bankruptBank = null) {
    const { width, height } = this.cameras.main;

    // 게임 정지
    if (this.moveTimer) {
      this.moveTimer.paused = true;
    }

    // 상점 닫기
    this.closeShop();

    // 강력한 화면 흔들기
    this.cameras.main.shake(1000, 0.05);

    // 폭발 플래시
    const explosionFlash = this.add.rectangle(width / 2, height / 2, width, height, 0xff0000, 0)
      .setDepth(8999);
    this.tweens.add({
      targets: explosionFlash,
      fillAlpha: 0.8,
      duration: 100,
      yoyo: true,
      repeat: 5,
      onComplete: () => explosionFlash.destroy()
    });

    // 폭발 파티클 - 빨간색/주황색
    for (let i = 0; i < 40; i++) {
      const particle = this.add.circle(
        width / 2,
        height / 2,
        5 + Math.random() * 10,
        [0xff0000, 0xff4400, 0xff8800, 0xffaa00][Math.floor(Math.random() * 4)]
      ).setDepth(9002).setAlpha(0.9);

      const angle = Math.random() * Math.PI * 2;
      const speed = 150 + Math.random() * 200;

      this.tweens.add({
        targets: particle,
        x: particle.x + Math.cos(angle) * speed,
        y: particle.y + Math.sin(angle) * speed,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 800 + Math.random() * 400,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 해골 파티클 떨어짐
    for (let i = 0; i < 20; i++) {
      const skull = this.add.text(
        Math.random() * width,
        -50,
        '💀',
        { fontSize: (16 + Math.random() * 16) + 'px' }
      ).setOrigin(0.5).setDepth(9001).setAlpha(0.8);

      this.tweens.add({
        targets: skull,
        y: height + 50,
        rotation: Math.random() * 4 - 2,
        duration: 2000 + Math.random() * 2000,
        delay: Math.random() * 1000,
        ease: 'Power1',
        onComplete: () => skull.destroy()
      });
    }

    // 파산 오버레이 - 더 어둡게
    const bankruptOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x110000, 0)
      .setDepth(9000);

    this.tweens.add({
      targets: bankruptOverlay,
      fillAlpha: 0.95,
      duration: 800,
      delay: 300
    });

    // 파산 타이틀 - 폭발적 등장
    const bankruptTitle = this.add.text(width / 2, height / 2 - 80, '💀 BANKRUPT! 💀', {
      fontSize: '56px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(9001).setScale(5).setAlpha(0);

    this.tweens.add({
      targets: bankruptTitle,
      scaleX: 1,
      scaleY: 1,
      alpha: 1,
      duration: 600,
      ease: 'Back.easeOut',
      delay: 400,
      onComplete: () => {
        // 지속 흔들림
        this.tweens.add({
          targets: bankruptTitle,
          x: bankruptTitle.x + 4,
          duration: 40,
          yoyo: true,
          repeat: -1
        });
        // 색상 펄스
        this.tweens.add({
          targets: bankruptTitle,
          scaleX: 1.05,
          scaleY: 1.05,
          duration: 500,
          yoyo: true,
          repeat: -1
        });
      }
    });

    // 메시지 - 타이핑 효과처럼 순차 등장
    const msgContent = bankruptBank
      ? `${bankruptBank} reported you!\n2 consecutive missed payments.`
      : 'You failed to make minimum payments\nfor 2 consecutive stages.';

    const bankruptMsg = this.add.text(width / 2, height / 2 - 10, msgContent, {
      fontSize: '16px',
      fill: '#ff8888',
      align: 'center',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(9001).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: bankruptMsg,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      delay: 1000,
      ease: 'Back.easeOut'
    });

    // 부채 표시 - 숫자 카운트업 효과
    const debtText = this.add.text(width / 2, height / 2 + 50,
      `Total Debt: $0`, {
      fontSize: '22px',
      fill: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(9001).setAlpha(0);

    this.tweens.add({
      targets: debtText,
      alpha: 1,
      duration: 300,
      delay: 1300,
      onComplete: () => {
        // 숫자 카운트업
        let currentDebt = 0;
        const targetDebt = this.totalDebt;
        const countDuration = 1000;
        const steps = 30;
        const increment = targetDebt / steps;

        for (let i = 0; i <= steps; i++) {
          this.time.delayedCall((countDuration / steps) * i, () => {
            currentDebt = Math.min(Math.floor(increment * i), targetDebt);
            debtText.setText(`Total Debt: $${currentDebt}`);

            // 마지막에 펄스
            if (i === steps) {
              this.tweens.add({
                targets: debtText,
                scaleX: 1.2,
                scaleY: 1.2,
                duration: 100,
                yoyo: true,
                repeat: 2
              });
            }
          });
        }
      }
    });

    // 게임 오버 플래그
    this.gameOver = true;

    // 재시작 안내 - 더 극적으로
    this.time.delayedCall(3000, () => {
      const restartBg = this.add.rectangle(width / 2, height / 2 + 110, 250, 35, 0x222222)
        .setStrokeStyle(2, 0x666666)
        .setDepth(9001).setAlpha(0);

      const restartText = this.add.text(width / 2, height / 2 + 110,
        '[ Press SPACE to restart ]', {
        fontSize: '14px',
        fill: '#aaaaaa',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(9001).setAlpha(0);

      // 바운스 등장
      restartBg.y += 30;
      restartText.y += 30;

      this.tweens.add({
        targets: [restartBg, restartText],
        alpha: 1,
        y: '-=30',
        duration: 400,
        ease: 'Back.easeOut'
      });

      // 깜빡임
      this.tweens.add({
        targets: restartText,
        alpha: 0.4,
        duration: 600,
        yoyo: true,
        repeat: -1,
        delay: 500
      });

      // 재시작 키 입력
      this.input.keyboard.once('keydown-SPACE', () => {
        // 페이드아웃 후 재시작
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.time.delayedCall(500, () => {
          this.scene.restart();
        });
      });
    });
  }

  repayLoan(loanIndex) {
    if (loanIndex < 0 || loanIndex >= this.loans.length) return;

    const loan = this.loans[loanIndex];

    // 돈이 충분한지 확인
    if (this.money < loan.due) {
      // 돈 부족 - 흔들림 효과
      if (this.repayTexts && this.repayTexts[loanIndex]) {
        const item = this.repayTexts[loanIndex];
        this.tweens.add({
          targets: [item.name, item.detail],
          x: '+=5',
          duration: 50,
          yoyo: true,
          repeat: 3
        });
      }
      return;
    }

    // 상환 처리
    this.money -= loan.due;
    this.loans.splice(loanIndex, 1);
    this.loanTier = Math.max(0, this.loanTier - 1);

    // 총 부채 재계산
    this.totalDebt = this.loans.reduce((sum, l) => sum + l.due, 0);

    const { width, height } = this.cameras.main;

    // 상환 완료 효과
    const paidText = this.add.text(width / 2, height / 2, `PAID OFF!\n-$${loan.due}`, {
      fontSize: '24px',
      fill: '#00ff00',
      fontStyle: 'bold',
      stroke: '#004400',
      strokeThickness: 3,
      align: 'center'
    }).setOrigin(0.5).setDepth(7003).setScale(0.5);

    this.tweens.add({
      targets: paidText,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: paidText,
          alpha: 0,
          y: height / 2 - 30,
          duration: 500,
          delay: 500,
          onComplete: () => paidText.destroy()
        });
      }
    });

    // UI 닫고 다시 열기
    this.time.delayedCall(800, () => {
      this.closeLoanUI();
      if (this.shopMoneyText) {
        this.shopMoneyText.setText(`$${this.money}`);
      }
      this.updateShopAffordability();
    });
  }

  closeLoanUI() {
    if (!this.loanUIOpen) return;
    this.loanUIOpen = false;
    this.isLoanProcessing = false; // 대출 처리 플래그 리셋

    // 요소 정리 - 흩어지며 사라짐
    this.loanElements.forEach((el, i) => {
      if (el && el.active) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 50 + Math.random() * 50;

        this.tweens.add({
          targets: el,
          alpha: 0,
          x: el.x + Math.cos(angle) * distance,
          y: el.y + Math.sin(angle) * distance,
          scaleX: 0.5,
          scaleY: 0.5,
          duration: 300,
          delay: i * 20,
          ease: 'Power2',
          onComplete: () => el.destroy()
        });
      }
    });

    this.loanElements = [];
    this.bankTexts = [];
    this.repayTexts = [];
    this.availableBanks = [];
    this.loanMode = 'borrow';

    // 상점 키보드 다시 활성화
    this.time.delayedCall(400, () => {
      this.shopKeyboardEnabled = true;
    });
  }

  // ==================== 보스전 시스템 ====================

  showSnakeDialogue() {
    const { width, height } = this.cameras.main;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + 60;

    // 말풍선 배경
    const bubble = this.add.rectangle(headX, headY - 50, 200, 40, 0xffffff, 0.95)
      .setDepth(5001).setScale(0).setStrokeStyle(2, 0x000000);

    this.tweens.add({
      targets: bubble,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });

    // 타이핑 효과 텍스트
    const dialogue = "Where did the frog go?";
    const dialogueText = this.add.text(headX, headY - 50, '', {
      fontSize: '12px',
      fill: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5002);

    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 50,
      callback: () => {
        dialogueText.setText(dialogue.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex >= dialogue.length) {
          typeTimer.destroy();
          // 대사 완료 후 찾는 액션
          this.time.delayedCall(800, () => {
            this.tweens.add({
              targets: [bubble, dialogueText],
              alpha: 0,
              duration: 200,
              onComplete: () => {
                bubble.destroy();
                dialogueText.destroy();
                this.snakeLookAround();
              }
            });
          });
        }
      },
      loop: true
    });
  }

  snakeLookAround() {
    // 뱀이 좌우로 고개를 돌리는 효과
    const head = this.snake[0];
    let lookCount = 0;
    const directions = ['LEFT', 'RIGHT', 'LEFT', 'RIGHT'];

    const lookTimer = this.time.addEvent({
      delay: 400,
      callback: () => {
        if (lookCount < directions.length) {
          // 머리 위치에 시선 표시
          const headX = head.x * this.gridSize + this.gridSize / 2;
          const headY = head.y * this.gridSize + this.gridSize / 2 + 60;
          const dir = directions[lookCount];
          const offsetX = dir === 'LEFT' ? -20 : 20;

          const eye = this.add.text(headX + offsetX, headY - 20, '👀', {
            fontSize: '16px'
          }).setOrigin(0.5).setDepth(5001).setAlpha(0);

          this.tweens.add({
            targets: eye,
            alpha: 1,
            duration: 100,
            yoyo: true,
            hold: 200,
            onComplete: () => eye.destroy()
          });

          lookCount++;
        } else {
          lookTimer.destroy();
          this.time.delayedCall(500, () => {
            this.showBossAppear();
          });
        }
      },
      loop: true
    });
  }

  showBossAppear() {
    const { width, height } = this.cameras.main;

    // 보스 위치: 뱀과 같은 높이, 우측 벽에서 9칸 떨어진 위치
    let bossX = this.cols - 9;
    let bossY = 15; // 뱀 시작 위치와 동일한 y

    // 데드존과 겹치면 옆으로 이동
    const isOnDeadZone = this.deadZones.some(dz => dz.x === bossX && dz.y === bossY);
    if (isOnDeadZone) {
      const offsets = [
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }
      ];
      for (const offset of offsets) {
        const newX = bossX + offset.x;
        const newY = bossY + offset.y;
        if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows) {
          const alsoOnDeadZone = this.deadZones.some(dz => dz.x === newX && dz.y === newY);
          if (!alsoOnDeadZone) {
            bossX = newX;
            bossY = newY;
            break;
          }
        }
      }
    }

    this.bossPosition = { x: bossX, y: bossY };

    // 화면 플래시
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xff00ff, 0)
      .setDepth(4999);
    this.tweens.add({
      targets: flash,
      fillAlpha: 0.8,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => flash.destroy()
    });

    // 보스 등장 외침
    const bossShout = this.add.text(width / 2, height / 2 - 80, "Hey, you trash snake!", {
      fontSize: '28px',
      fill: '#ff00ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5001).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: bossShout,
      alpha: 1,
      scale: 1.2,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.cameras.main.shake(200, 0.015);
        this.time.delayedCall(1500, () => {
          this.tweens.add({
            targets: bossShout,
            alpha: 0,
            y: bossShout.y - 30,
            duration: 300,
            onComplete: () => bossShout.destroy()
          });
        });
      }
    });

    // 보스 그리기 (뿔 달린 보라색 먹이)
    this.time.delayedCall(500, () => {
      this.drawBoss(bossX, bossY);

      // 보스 대사
      this.time.delayedCall(1000, () => {
        this.showBossDialogue("We are enemies... Take my poison!", () => {
          // 대사 후 바로 게임 재개
          this.time.delayedCall(500, () => {
            this.bossPhase = 'trap';
            this.moveTimer.paused = false;
            this.bossInputBlocked = false;
          });
        });
      });
    });
  }

  drawBoss(x, y) {
    const bossX = x * this.gridSize + this.gridSize / 2;
    const bossY = y * this.gridSize + this.gridSize / 2 + 60;

    // 보스 컨테이너
    const bossContainer = this.add.container(bossX, bossY).setDepth(100);

    // 보스 몸체 (보라색)
    const body = this.add.rectangle(0, 0, this.gridSize - 2, this.gridSize - 2, 0x9900ff);
    bossContainer.add(body);

    // 뿔 (4개 모서리에)
    const hornSize = 4;
    const offset = this.gridSize / 2 - 2;
    const horns = [
      this.add.triangle(-offset, -offset, 0, hornSize, hornSize, hornSize, hornSize / 2, 0, 0xff00ff),
      this.add.triangle(offset, -offset, 0, hornSize, hornSize, hornSize, hornSize / 2, 0, 0xff00ff),
      this.add.triangle(-offset, offset, 0, 0, hornSize, 0, hornSize / 2, hornSize, 0xff00ff),
      this.add.triangle(offset, offset, 0, 0, hornSize, 0, hornSize / 2, hornSize, 0xff00ff)
    ];
    horns.forEach(horn => bossContainer.add(horn));

    // 등장 애니메이션
    bossContainer.setScale(0).setAlpha(0);
    this.tweens.add({
      targets: bossContainer,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });

    // 펄스 효과
    this.tweens.add({
      targets: bossContainer,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.bossElement = bossContainer;

    // 먹이로 설정
    this.food = { x, y };
  }

  showBossDialogue(text, callback) {
    const { width, height } = this.cameras.main;

    const dialogue = this.add.text(width / 2, height / 2, '', {
      fontSize: '20px',
      fill: '#ff00ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(5002);

    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 40,
      callback: () => {
        dialogue.setText(text.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex >= text.length) {
          typeTimer.destroy();
          this.time.delayedCall(1500, () => {
            this.tweens.add({
              targets: dialogue,
              alpha: 0,
              duration: 300,
              onComplete: () => {
                dialogue.destroy();
                if (callback) callback();
              }
            });
          });
        }
      },
      loop: true
    });
  }

  bossPreBattleCountdown() {
    const { width, height } = this.cameras.main;

    const countdownText = this.add.text(width / 2, height / 2, '', {
      fontSize: '72px',
      fill: '#ff00ff',
      fontStyle: 'bold',
      stroke: '#660066',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5000);

    let count = 3;
    const countdownTimer = this.time.addEvent({
      delay: 700,
      callback: () => {
        if (count > 0) {
          countdownText.setText(count.toString());
          countdownText.setScale(1.5);
          this.tweens.add({
            targets: countdownText,
            scale: 1,
            duration: 200,
            ease: 'Back.easeOut'
          });
          count--;
        } else {
          countdownText.destroy();
          this.moveTimer.paused = false;
          this.bossInputBlocked = false; // 입력 차단 해제
        }
      },
      repeat: 3
    });
  }

  handleBossTrap() {
    const { width, height } = this.cameras.main;

    // 먹이 즉시 제거 (화면에서 완전히 숨김)
    this.food = { x: -100, y: -100 };
    if (this.bossElement) {
      this.bossElement.destroy();
      this.bossElement = null;
    }

    // 보스 대사
    const trapText = this.add.text(width / 2, height / 2 - 100, "Good luck!", {
      fontSize: '32px',
      fill: '#ff00ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5001).setAlpha(0);

    this.tweens.add({
      targets: trapText,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: trapText,
            alpha: 0,
            duration: 300,
            onComplete: () => trapText.destroy()
          });
        });
      }
    });

    // 독 효과 시작
    this.bossPhase = 'poisoned';
    this.applyPoison();
  }

  applyPoison() {
    const { width, height } = this.cameras.main;

    // 뱀 색상을 점점 보라색으로
    let blinkCount = 0;
    const blinkTimer = this.time.addEvent({
      delay: 200,
      callback: () => {
        blinkCount++;
        // 깜빡임 효과
        this.snakePoisoned = blinkCount % 2 === 0;
        this.draw();

        if (blinkCount >= 10) {
          blinkTimer.destroy();
          this.snakePoisoned = true;
          this.draw();

          // 보스 대사: "Gotcha!"
          const gotchaText = this.add.text(width / 2, height / 2 - 80, "Gotcha!", {
            fontSize: '36px',
            fill: '#ff00ff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 4
          }).setOrigin(0.5).setDepth(5001).setAlpha(0);

          this.tweens.add({
            targets: gotchaText,
            alpha: 1,
            scale: { from: 0.5, to: 1.3 },
            duration: 300,
            ease: 'Back.easeOut',
            onComplete: () => {
              this.time.delayedCall(800, () => {
                this.tweens.add({
                  targets: gotchaText,
                  alpha: 0,
                  duration: 200,
                  onComplete: () => gotchaText.destroy()
                });
              });
            }
          });

          // 성장 시작
          this.startPoisonGrowth();
        }
      },
      loop: true
    });
  }

  startPoisonGrowth() {
    // 매 이동마다 1칸 성장 + 속도 증가
    this.poisonGrowthActive = true;
    this.poisonGrowthCount = 0;
    this.originalSpeed = this.moveTimer.delay;

    // 목표: 20칸, 40ms
    const targetLength = this.poisonGrowthTarget;
    const targetSpeed = this.poisonSpeedTarget;
    const currentLength = this.snake.length;
    const growthNeeded = targetLength - currentLength;
    const speedDecrease = (this.originalSpeed - targetSpeed) / growthNeeded;

    this.poisonGrowthData = {
      targetLength,
      targetSpeed,
      growthNeeded,
      speedDecrease,
      currentGrowth: 0
    };
  }

  handlePoisonGrowth() {
    if (!this.poisonGrowthActive || !this.poisonGrowthData) return false;

    const data = this.poisonGrowthData;
    if (data.currentGrowth < data.growthNeeded) {
      // 뱀 성장
      const tail = this.snake[this.snake.length - 1];
      this.snake.push({ x: tail.x, y: tail.y });

      // 속도 증가
      this.moveTimer.delay = Math.max(data.targetSpeed, this.moveTimer.delay - data.speedDecrease);

      data.currentGrowth++;

      // 성장 완료 체크
      if (data.currentGrowth >= data.growthNeeded) {
        this.poisonGrowthActive = false;
        // 보스전 본격 시작
        this.time.delayedCall(500, () => {
          this.startBossBattle();
        });
      }
      return true; // 성장함
    }
    return false;
  }

  startBossBattle() {
    const { width, height } = this.cameras.main;
    this.bossPhase = 'battle';
    this.bossHitCount = 0;

    // 코너 위치 설정 (4개) - 정확히 벽에 붙은 모서리
    this.bossCorners = [
      { x: 0, y: 0 }, // 좌상단
      { x: this.cols - 1, y: 0 }, // 우상단
      { x: 0, y: this.rows - 1 }, // 좌하단
      { x: this.cols - 1, y: this.rows - 1 } // 우하단
    ];

    // 배틀 시작 메시지
    const battleText = this.add.text(width / 2, height / 2, "BATTLE START!", {
      fontSize: '48px',
      fill: '#ff00ff',
      fontStyle: 'bold',
      stroke: '#660066',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5001).setAlpha(0);

    this.tweens.add({
      targets: battleText,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.cameras.main.shake(300, 0.01);
        this.time.delayedCall(1000, () => {
          this.tweens.add({
            targets: battleText,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              battleText.destroy();
              this.spawnBossAtCorner();
            }
          });
        });
      }
    });
  }

  spawnBossAtCorner() {
    if (this.bossHitCount >= 4) return;

    // 코너에서 랜덤 선택 (순서대로)
    let corner = { ...this.bossCorners[this.bossHitCount] };

    // 데드존과 겹치면 옆으로 이동
    const isOnDeadZone = this.deadZones.some(dz => dz.x === corner.x && dz.y === corner.y);
    if (isOnDeadZone) {
      // 인접한 위치 찾기 (상하좌우)
      const offsets = [
        { x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 },
        { x: 1, y: 1 }, { x: -1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: -1 }
      ];
      for (const offset of offsets) {
        const newX = corner.x + offset.x;
        const newY = corner.y + offset.y;
        // 경계 체크 및 데드존 체크
        if (newX >= 0 && newX < this.cols && newY >= 0 && newY < this.rows) {
          const alsoOnDeadZone = this.deadZones.some(dz => dz.x === newX && dz.y === newY);
          if (!alsoOnDeadZone) {
            corner = { x: newX, y: newY };
            break;
          }
        }
      }
    }

    this.bossPosition = corner;

    // 보스 그리기
    this.drawBoss(corner.x, corner.y);
  }

  handleBossHit() {
    const { width, height } = this.cameras.main;
    this.bossHitCount++;

    // 보스 피격 효과
    if (this.bossElement) {
      this.tweens.add({
        targets: this.bossElement,
        alpha: 0,
        scale: 1.5,
        duration: 200,
        onComplete: () => {
          if (this.bossElement) {
            this.bossElement.destroy();
            this.bossElement = null;
          }
        }
      });
    }

    // 히트 카운트 표시
    // 기존 hitText 제거
    if (this.bossHitText) {
      this.tweens.killTweensOf(this.bossHitText);
      this.bossHitText.destroy();
      this.bossHitText = null;
    }

    this.bossHitText = this.add.text(width / 2, height / 2 - 100, `HIT ${this.bossHitCount}/4`, {
      fontSize: '36px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5001).setAlpha(0);

    this.tweens.add({
      targets: this.bossHitText,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(500, () => {
          if (this.bossHitText) {
            this.tweens.add({
              targets: this.bossHitText,
              alpha: 0,
              duration: 200,
              onComplete: () => {
                if (this.bossHitText) {
                  this.bossHitText.destroy();
                  this.bossHitText = null;
                }
              }
            });
          }
        });
      }
    });

    // 마지막 히트면 승리
    if (this.bossHitCount >= 4) {
      this.showBossVictory();
    } else {
      // 다음 보스 생성
      this.time.delayedCall(800, () => {
        this.spawnBossAtCorner();
      });
    }
  }

  handleBossFinalHit() {
    const { width, height } = this.cameras.main;

    // 게임 일시정지
    this.moveTimer.paused = true;

    // 울트라 슬로우모션 + 줌
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + 60;

    // 화면 슬로우 모션 효과
    this.time.timeScale = 0.3;

    // 카메라를 뱀 머리 위치로 이동 후 줌 인
    this.cameras.main.pan(headX, headY, 300, 'Power2', false, (camera, progress) => {
      if (progress === 1) {
        this.cameras.main.zoomTo(2, 500, 'Power2', false, (cam, zoomProgress) => {
          if (zoomProgress === 1) {
            // 충돌!
            this.cameras.main.shake(500, 0.03);

            // 보스 비명
            const scream = this.add.text(headX, headY - 50, "AAARGH! RIBBIT!", {
              fontSize: '24px',
              fill: '#ff0000',
              fontStyle: 'bold',
              stroke: '#000000',
              strokeThickness: 3
            }).setOrigin(0.5).setDepth(5002).setAlpha(0);

            this.tweens.add({
              targets: scream,
              alpha: 1,
              y: headY - 80,
              scale: { from: 0.5, to: 1.5 },
              duration: 500,
              onComplete: () => {
                this.time.delayedCall(800, () => {
                  this.tweens.add({
                    targets: scream,
                    alpha: 0,
                    duration: 300,
                    onComplete: () => scream.destroy()
                  });
                });
              }
            });

            // 보스 폭발 파티클
            if (this.bossElement) {
              for (let i = 0; i < 20; i++) {
                const particle = this.add.rectangle(
                  this.bossElement.x,
                  this.bossElement.y,
                  4, 4, 0xff00ff
                ).setDepth(5001);

                const angle = (i / 20) * Math.PI * 2;
                this.tweens.add({
                  targets: particle,
                  x: this.bossElement.x + Math.cos(angle) * 100,
                  y: this.bossElement.y + Math.sin(angle) * 100,
                  alpha: 0,
                  duration: 800,
                  onComplete: () => particle.destroy()
                });
              }

              this.bossElement.destroy();
              this.bossElement = null;
            }

            // 줌 아웃 및 정상 속도 복원
            this.time.delayedCall(1000, () => {
              this.time.timeScale = 1;
              // 카메라 위치 초기화 후 줌 아웃
              const { width, height } = this.cameras.main;
              this.cameras.main.pan(width / 2, height / 2, 300, 'Power2');
              this.cameras.main.zoomTo(1, 500, 'Power2', false, () => {
                this.showBossVictory();
              });
            });
          }
        });
      }
    });
  }

  showBossVictory() {
    const { width, height } = this.cameras.main;
    this.bossPhase = 'victory';

    // 보너스 점수 추가 (보스전은 1000점 보너스만)
    this.score = 1000;
    this.scoreText.setText(this.score.toString());

    // 보스 클리어 텍스트
    const clearText = this.add.text(width / 2, height / 2 - 50, 'BOSS CLEAR!', {
      fontSize: '64px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#ff6600',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(5001).setAlpha(0).setScale(0.5);

    this.tweens.add({
      targets: clearText,
      alpha: 1,
      scale: 1.2,
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 화면 플래시
        const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffff00, 0.5)
          .setDepth(5000);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 500,
          onComplete: () => flash.destroy()
        });

        // 화면 흔들림
        this.cameras.main.shake(500, 0.02);

        // 보너스 점수 표시
        const bonusText = this.add.text(width / 2, height / 2 + 30, '+1000 BONUS!', {
          fontSize: '32px',
          fill: '#00ff00',
          fontStyle: 'bold',
          stroke: '#008800',
          strokeThickness: 4
        }).setOrigin(0.5).setDepth(5001).setAlpha(0);

        this.tweens.add({
          targets: bonusText,
          alpha: 1,
          y: height / 2 + 10,
          duration: 300,
          delay: 500
        });

        // 파티클 폭발
        for (let i = 0; i < 30; i++) {
          const colors = [0xffff00, 0xff00ff, 0x00ffff, 0xff0000, 0x00ff00];
          const particle = this.add.rectangle(
            width / 2, height / 2, 8, 8,
            colors[Math.floor(Math.random() * colors.length)]
          ).setDepth(5001);

          const angle = (i / 30) * Math.PI * 2;
          const distance = 150 + Math.random() * 100;
          this.tweens.add({
            targets: particle,
            x: width / 2 + Math.cos(angle) * distance,
            y: height / 2 + Math.sin(angle) * distance,
            alpha: 0,
            rotation: Math.random() * 10,
            duration: 1000,
            onComplete: () => particle.destroy()
          });
        }

        // 보스 모드 종료 및 상점 열기
        this.time.delayedCall(2000, () => {
          this.tweens.add({
            targets: [clearText, bonusText],
            alpha: 0,
            duration: 300,
            onComplete: () => {
              clearText.destroy();
              bonusText.destroy();

              // 보스 모드 종료
              this.snakePoisoned = false;
              this.bossMode = false;
              this.bossPhase = 'none';

              // 기존 스테이지 클리어 플로우 (상점 열기)
              this.openShop();
            }
          });
        });
      }
    });
  }

  snakeJumpAnimation(callback) {
    // 뱀이 맵 밖으로 날아가는 애니메이션
    const { width, height } = this.cameras.main;

    // 각 세그먼트를 위로 날림
    this.snake.forEach((segment, i) => {
      const segX = segment.x * this.gridSize + this.gridSize / 2;
      const segY = segment.y * this.gridSize + this.gridSize / 2 + 60;

      const jumpRect = this.add.rectangle(segX, segY, this.gridSize - 2, this.gridSize - 2,
        i === 0 ? (this.comboShieldCount > 0 ? 0xffff00 : 0x00ff00) : 0x00cc00
      ).setDepth(5001);

      this.tweens.add({
        targets: jumpRect,
        y: -50,
        x: segX + (Math.random() - 0.5) * 100,
        rotation: Math.random() * 5,
        delay: i * 30,
        duration: 500,
        ease: 'Power2.easeIn',
        onComplete: () => jumpRect.destroy()
      });
    });

    this.time.delayedCall(800, callback);
  }

  update() {
    // 타이머 이벤트가 자동으로 moveSnake를 호출하므로
    // update에서는 아무것도 하지 않아도 됨
  }
}
