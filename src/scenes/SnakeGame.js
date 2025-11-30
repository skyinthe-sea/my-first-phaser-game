import Phaser from 'phaser';
import { getShopItems } from '../data/items.js';
import { bankData, generateBankList, getRandomInRange } from '../data/banks.js';
import { WORLD_CONFIG, getWorldByStage, getBossInfoForStage, shouldHaveSaws, shouldHaveGasZone, shouldHaveFog, shouldHaveFloatingMines, shouldHaveLaserTurrets, isMagnetarStage, TEST_STAGES } from '../data/worlds.js';

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
    // Moving dead zone (saws)
    this.saws = []; // [{ x, y, container, blade, warningRing, spinTween, pulseTween, breathTween, moveDelay, canKill, nextPosition, lastDirection, nextStepSize, moveTimer }]
    this.sawTextureKey = 'deadly_saw';
    this.sawBaseDelay = 600;
    this.maxSaws = 5;

    // Enhanced saws (Stage -1 강화 톱니)
    this.enhancedSaws = [];
    this.maxEnhancedSaws = 3;
    this.enhancedSawDelay = 400; // 기본 600ms보다 빠름
    this.enhancedSawScale = 1.3; // 1.3배 더 큼
    this.enhancedSawTextureKey = 'enhanced_saw';
    this.preserveSawsForNextStage = false; // 톱니 보존 플래그

    // Gear Titan Boss (Stage 0)
    this.gearTitanMode = false;
    this.gearTitanPhase = 'none'; // 'none' | 'intro' | 'phase1' | 'phase2' | 'phase3' | 'vulnerable' | 'enrage' | 'victory'
    this.gearTitanPosition = null;
    this.gearTitanElement = null;
    this.gearTitanContainer = null;
    this.gearTitanHitCount = 0;
    this.gearTitanHitsToKill = 6;
    this.gearTitanHP = this.gearTitanHitsToKill;
    this.gearTitanGears = [];
    this.gearTitanCore = null;
    this.gearTitanLasers = [];
    this.gearTitanAttackTimer = null;
    this.gearTitanAnimTimer = null;
    this.gearTitanVulnerable = false;
    this.gearTitanStunEndTime = 0;

    // Charge Dash System (기어 타이탄 보스용)
    this.isCharging = false;
    this.chargeStartTime = 0;
    this.chargeDuration = 1000; // 1초 차지
    this.chargeReady = false;
    this.dashCooldown = 3000; // 3초 쿨다운
    this.lastDashTime = 0;
    this.isDashing = false;
    this.dashDistance = 5; // 5칸 돌진
    this.chargeUI = null;
    this.chargeGaugeUI = null;
    this.canChargeDash = false; // 기어 타이탄 보스에서만 활성화
    this.chargeEffectParticles = []; // 차지 에너지 파티클들
    this.chargeEffectTimer = null; // 차지 에너지 업데이트 타이머
    this.chargeAuraGraphics = null; // 차지 오라 그래픽

    // 확산형 독가스 시스템 (배틀로얄 자기장) - 원형
    this.gasZoneEnabled = false;
    this.gasZoneRadius = 0; // 현재 안전 영역 반경 (타일 단위)
    this.gasZoneMinRadius = 4; // 최소 반경 (게임 가능 영역)
    this.gasZoneTimer = null; // 확장 타이머
    this.gasZoneExpandInterval = 2000; // 2초마다 확장
    this.gasZoneGraphics = this.add.graphics();
    this.gasZoneGraphics.setDepth(50); // 뱀보다 아래, 그리드보다 위
    this.gasZoneParticles = []; // EMP 파티클들
    this.gasZonePulseTime = 0; // 펄스 애니메이션용
    this.gasZoneCenterX = 0; // 원 중심 X
    this.gasZoneCenterY = 0; // 원 중심 Y

    // ===== Polarity System (비활성화 - 레이저 터렛으로 대체) =====
    this.polarityEnabled = false;
    this.currentPolarity = 'N';
    this.polarityChangeInterval = 10000;
    this.polarityTimer = null;
    this.polarityWarningTimer = null;
    this.polarityMarker = null;
    this.polarityUI = null;
    this.polarityUILabel = null;
    this.polarityChangeWarningTime = 2000;
    this.isPolarityWarning = false;

    // ===== Magnetic Turrets (비활성화 - 레이저 터렛으로 대체) =====
    this.magneticTurrets = [];
    this.turretForceRadius = 5;
    this.turretPulseTime = 0;
    this.turretAnimTimer = null;
    this.baseSpeed = 90;
    this.currentSpeedModifier = 1.0;

    // ===== Laser Turrets (Stage -1: Flux Maze) =====
    this.laserTurrets = []; // [{x, y, container, angle, laserGraphics, warningGraphics, isActive}]
    this.laserTurretPositions = [
      { x: 10, y: 8 },   // 좌상단
      { x: 29, y: 8 },   // 우상단
      { x: 10, y: 19 },  // 좌하단
      { x: 29, y: 19 }   // 우하단
    ];
    this.laserRotationSpeed = 0.02; // 레이저 회전 속도 (라디안/프레임)
    this.laserLength = 25; // 레이저 길이 (타일)
    this.laserFireInterval = 4000; // 4초마다 발사 패턴
    this.laserWarningDuration = 1500; // 경고 1.5초
    this.laserActiveDuration = 2000; // 레이저 활성 2초
    this.laserAnimTimer = null; // 60fps 애니메이션 타이머
    this.laserFireTimer = null; // 발사 타이머
    this.laserPhase = 'idle'; // 'idle' | 'warning' | 'firing'

    // ===== Floating Mines (Stage -1: Flux Maze) =====
    this.floatingMines = []; // [{x, y, element, dx, dy, moveTimer}]
    this.maxFloatingMines = 4;
    this.mineSpeed = 1500; // 1.5초에 1칸 이동
    this.mineSpawnTimer = null; // 기뢰 생성 타이머
    this.mineSpawnInterval = 5000; // 5초마다 생성

    // ===== Magnetar Boss (Stage 0) =====
    this.magnetarMode = false;
    this.magnetarPhase = 'none'; // 'none' | 'intro' | 'phase1' | 'phase2' | 'phase3' | 'victory'
    this.magnetarPosition = null; // 보스 위치 (맵 중앙)
    this.magnetarElement = null; // 보스 그래픽 컨테이너
    this.magnetarCore = null; // 보스 코어 그래픽
    this.magnetarHitCount = 0; // 보스 HIT 횟수
    this.magnetarControlsReversed = false; // 조작 반전 상태
    this.magnetarReverseEndTime = 0; // 반전 종료 시간
    this.magnetarReverseTimer = null; // 반전 타이머
    this.magnetarLaserPatterns = []; // 활성 레이저 패턴들
    this.magnetarShieldGenerators = []; // [{orbitAngle, orbitRadius, destroyed, element, body, beam, x, y}]
    this.magnetarOrbitTimer = null; // 생성기 공전 타이머
    this.magnetarAttackTimer = null; // 공격 패턴 타이머
    this.magnetarGeneratorsVulnerable = false; // 생성기 파괴 가능 여부
    this.magnetarPhase3GasInterval = 800; // Phase 3 가스 축소 간격 (ms)

    // 시야 제한(Fog of War)
    this.fogStageStart = 7;
    this.fogTestForceEnable = false; // stage 7부터 적용
    this.fogVisibleTiles = 4.0;
    this.fogBaseAlpha = 0.94;
    this.fogFlashAlpha = 0.32;
    this.fogFlashDuration = 300;
    this.fogRenderTexture = null;
    this.fogLightSprite = null;
    this.fogLightTextureKey = 'fog_light_mask';
    this.fogFlashEndTime = 0;
    this.fogLastRenderKey = null;
    this.fogEnabled = false;
    this.fogIntroShown = false;
    this.fogIntroPlaying = false;

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
    this.speedText = this.add.text(sectionWidth * 3.5, 28, '90ms', {
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

    // 부활 시스템 (500원 부활)
    this.reviveCost = 500; // 부활 비용
    this.isReviving = false; // 부활 처리 중 플래그
    this.reviveElements = []; // 부활 UI 요소들 (정리용)

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

    // ========== 탄막 슈팅 보스 시스템 (Bullet Hell Boss) ==========
    this.bulletBossMode = false; // 탄막 보스 모드 활성화
    this.bulletBossPhase = 'none'; // 'none' | 'intro' | 'shooting' | 'vulnerable' | 'victory'
    this.bulletBossPosition = null; // 보스 위치 {x, y}
    this.bulletBossElement = null; // 보스 그래픽 컨테이너
    this.bulletBossHitCount = 0; // 보스 HIT 횟수 (4번 클리어)
    this.testBulletBossStage = 6; // Stage 6에서 탄막 보스
    this.bulletBossWaveCount = 0; // 현재 웨이브
    this.bulletBossVulnerableTimer = null; // vulnerable 상태 타이머

    // 총알 시스템
    this.bullets = []; // [{x, y, dx, dy, speed, graphics, trail}, ...]
    this.bulletUpdateTimer = null; // 60fps 업데이트 타이머
    this.bulletSpawnTimer = null; // 총알 발사 타이머

    // 회피 시스템 (Dodge Roll)
    this.canDodge = true; // 회피 가능 여부
    this.dodgeCooldown = 0; // 무한 닷지
    this.lastDodgeTime = 0; // 마지막 회피 시간
    this.lastDodgeDirection = 'up'; // 번갈아가며 up/down 또는 left/right
    this.isInvincible = false; // 회피 중 무적 상태
    this.dodgeCooldownUI = null; // 쿨다운 UI 요소
    this.dodgeTutorialShown = false; // 튜토리얼 표시 여부 (매 보스전마다 초기화)
    this.tutorialOpen = false; // 튜토리얼 열림 상태 (닷지 비활성화용)
    this.postDodgeShieldActive = false; // 닷지 후 보호막 활성화 상태
    this.postDodgeShieldElements = []; // 보호막 그래픽 요소들
    this.postDodgeShieldTimer = null; // 보호막 업데이트 타이머
    this.shieldParticles = null; // 회전 파티클들

    // ========== 안개 보스 시스템 (Fog Boss - Nocturn) ==========
    this.fogBossMode = false; // 안개 보스 모드 활성화
    this.fogBossPhase = 'none'; // 'none' | 'intro' | 'shadow' | 'hallucination' | 'eclipse' | 'victory'
    this.fogBossPosition = null; // 보스 위치 {x, y}
    this.fogBossElement = null; // 보스 그래픽 컨테이너 (연기 + 눈)
    this.fogBossHitCount = 0; // 보스 HIT 횟수 (4번 클리어)
    this.fogBossVisible = false; // 보스 가시 상태
    this.testFogBossStage = 9; // Stage 9 (World 2 보스 - 녹턴)
    this.fogBossBonus = 1500; // 클리어 보너스 점수
    this.fogBossElements = []; // 보스 관련 UI 요소들 (정리용)
    this.fogBossInputBlocked = false; // 인트로 중 입력 차단
    this.savedFogBossCombo = 0; // 보스전 전 콤보 저장
    this.savedFogBossShieldCount = 0; // 보스전 전 실드 저장

    // 조명탄 시스템 (Flare - 플레이어 공격)
    this.flares = []; // 활성 조명탄 배열 [{x, y, container, glow, core}]
    this.flareCount = 0; // 수집한 조명탄 개수
    this.flareLightRadius = 6; // 조명탄 폭발 반경 (타일)
    this.flareActive = false; // 조명탄 폭발 활성화
    this.flareSpawnTimer = null; // 조명탄 생성 타이머
    this.flareSpawnInterval = 8000; // 조명탄 생성 간격 (ms)

    // Shadow Strike 페이즈 (1단계)
    this.shadowStrikeWarningActive = false; // 빨간 눈 경고 활성화
    this.shadowStrikeTimer = null; // 공격 타이머
    this.shadowStrikeInterval = [3000, 5000]; // 공격 간격 범위 (ms)
    this.shadowStrikeWarningTime = 1000; // 경고 지속 시간 (ms)
    this.shadowStrikeTargetPos = null; // 공격 목표 위치

    // 🆕 Stalking & Jump Scare 시스템
    this.stalkingActive = false; // 잠복 단계 활성화
    this.stalkingEyes = null; // 스토킹 눈 요소
    this.stalkingTimer = null; // 눈 깜빡임 타이머
    this.stalkingIntensity = 0; // 긴장도 (0-100)
    this.tensionBuildupTimer = null; // 긴장 고조 타이머
    this.vignetteOverlay = null; // 빨간 비네트 오버레이
    this.heartbeatTimer = null; // 심장박동 효과 타이머
    this.whisperTexts = ['...behind you...', '...closer...', '...run...', '...watching...'];
    this.currentWhisperIndex = 0;
    this.jumpScareActive = false; // 점프 스케어 진행 중
    this.jumpScareDodgeWindow = 500; // 회피 가능 시간 (ms)
    this.fakeOutChance = 0.3; // 가짜 등장 확률 (30%)
    this.lastStalkingEyePos = null; // 마지막 스토킹 눈 위치

    // 🆕 콤보 공격 시스템 (HIT 2+ 연속 공격)
    this.comboAttackCount = 0; // 현재 콤보 공격 횟수
    this.maxComboAttacks = 0; // 최대 콤보 공격 횟수
    this.comboAttackActive = false; // 콤보 공격 진행 중

    // 🆕 Rage Mode 시스템 (HIT 3 분노 모드)
    this.rageModeActive = false; // 분노 모드 활성화
    this.rageFlickerTimer = null; // 화면 깜빡임 타이머
    this.rageGlitchTimer = null; // 글리치 효과 타이머
    this.rageWhisperTexts = ['...KILL...', '...DIE...', '...PAIN...', '...END YOU...', '...SUFFER...'];

    // 🆕 극한 공포 시스템 (The Presence - 브라우저 전체 어둠)
    this.presenceActive = false; // 존재감 시스템 활성화
    this.presenceLevel = 0; // 존재감 레벨 (0-100) - 높을수록 공포
    this.browserDarkOverlay = null; // 브라우저 배경 어둠 오버레이 (DOM)
    this.browserShakeActive = false; // 브라우저 흔들림 효과
    this.attackDirection = null; // 공격 방향 ('up', 'down', 'left', 'right')
    this.dodgeWindowActive = false; // 회피 창 활성화 (SPACE 눌러야 함)
    this.dodgeWindowTimer = null; // 회피 창 타이머
    this.correctDodgeDirection = null; // 정답 회피 방향
    this.attackWarningElement = null; // 공격 경고 UI
    this.presenceTimer = null; // 존재감 증가 타이머
    this.lastAttackTime = 0; // 마지막 공격 시간
    this.attackCooldown = 8000; // 공격 쿨다운 (8초)
    this.presencePulseTimer = null; // 브라우저 펄스 타이머
    this.playerDodged = false; // 플레이어가 닷지를 눌렀는지 (QTE)
    this.dodgeQTEActive = false; // QTE 닷지 활성화 상태
    this.creepyCreatures = []; // 무서운 생물들 배열
    this.creatureSpawnTimer = null; // 생물 스폰 타이머

    // Hallucination 페이즈 (2단계)
    this.hallucinationFoods = []; // 환각 먹이 배열 (4개 가짜 + 1개 진짜)
    this.realFoodIndex = 0; // 진짜 먹이 인덱스

    // Eclipse 페이즈 (3단계)
    this.eclipseActive = false; // 완전한 어둠 활성화
    this.lightOrb = null; // 구원의 빛 오브
    this.originalFogVisibleTiles = 4.0; // 원래 시야 반경 저장
    this.eclipseVisibility = 1.0; // 이클립스 중 시야 (타일)

    // ========== 개발자 테스트 모드 (KK) ==========
    this.devModeEnabled = false; // 개발자 모드 활성화
    this.devModeElements = []; // 개발자 모드 UI 요소들
    this.devStageButtons = []; // 스테이지 선택 버튼들
    this.lastKPressTime = 0; // 마지막 K 키 입력 시간
    this.kPressThreshold = 300; // 더블 프레스 인식 시간 (ms)
    this.selectedDevStage = 1; // 선택된 스테이지
    this.devScrollOffset = 0; // 스크롤 오프셋

    // ========== 신규 월드 테스트 스테이지 시스템 ==========
    this.testStagesEnabled = this.loadTestStageConfig(); // localStorage에서 로드
    this.isTestMode = false; // 테스트 모드 진행 중

    // 키 입력 (입력 큐 시스템)
    this.input.keyboard.on('keydown-LEFT', () => {
      if (this.devModeEnabled) return; // 개발자 모드에서는 무시
      if (this.bossInputBlocked || this.fogBossInputBlocked) return;
      if (this.loanUIOpen) return;
      if (this.shopOpen) {
        this.handleShopInput('LEFT');
        return;
      }
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('LEFT');
    });
    this.input.keyboard.on('keydown-RIGHT', () => {
      if (this.devModeEnabled) return; // 개발자 모드에서는 무시
      if (this.bossInputBlocked || this.fogBossInputBlocked) return;
      if (this.loanUIOpen) return;
      if (this.shopOpen) {
        this.handleShopInput('RIGHT');
        return;
      }
      this.startMusicOnFirstInput();
      this.addDirectionToQueue('RIGHT');
    });
    this.input.keyboard.on('keydown-UP', () => {
      if (this.devModeEnabled) return; // 개발자 모드에서는 무시
      if (this.bossInputBlocked || this.fogBossInputBlocked) return;
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
      if (this.devModeEnabled) return; // 개발자 모드에서는 무시
      if (this.bossInputBlocked || this.fogBossInputBlocked) return;
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
      if (this.devModeEnabled) return; // 개발자 모드에서는 무시
      if (this.loanUIOpen) {
        this.handleLoanInput('ENTER');
        return;
      }
      if (this.shopOpen) {
        this.handleShopInput('ENTER');
      }
    });

    // SPACE 키 (회피 - 탄막 보스전에서만 활성화)
    this.input.keyboard.on('keydown-SPACE', () => {
      if (this.gameOver) return;
      if (this.shopOpen || this.loanUIOpen) return;
      if (this.bossInputBlocked) return;
      // 튜토리얼 중에는 닷지 비활성화 (스킵만 됨)
      if (this.tutorialOpen) return;

      // 탄막 보스 모드에서 회피 가능
      if (this.bulletBossMode && this.bulletBossPhase !== 'intro' && this.bulletBossPhase !== 'victory') {
        this.handleDodge();
      }
      // 안개 보스 모드에서도 회피 가능 (Shadow Strike 중)
      if (this.fogBossMode && this.fogBossPhase === 'shadow') {
        this.handleDodge();
      }
    });

    // K 키 (개발자 모드 - 더블 프레스)
    this.input.keyboard.on('keydown-K', () => {
      // 개발자 모드 UI가 열려있을 때는 무시
      if (this.devModeEnabled) return;

      const now = Date.now();
      if (now - this.lastKPressTime < this.kPressThreshold) {
        // 더블 프레스 감지 - 개발자 모드 열기
        this.openDevMode();
      }
      this.lastKPressTime = now;
    });

    // 게임 오버 플래그
    this.gameOver = false;

    // 스테이지 클리어 애니메이션 중 플래그
    this.isStageClearingAnimation = false;

    // 배경 그리드 그리기
    this.drawGrid();

    // 초기 뱀과 먹이 그리기
    this.draw();

    // 타이머 이벤트로 뱀 이동 (90ms 기본속도)
    this.moveTimer = this.time.addEvent({
      delay: 90,
      callback: this.moveSnake,
      callbackScope: this,
      loop: true
    });

    this.startFogIntroIfNeeded();

    // 탄막 보스 스테이지 체크 (Stage 6)
    if (this.isBulletBossStage()) {
      // 짧은 지연 후 탄막 보스 시작
      this.time.delayedCall(500, () => {
        this.startBulletBoss();
      });
    }

    // 안개 보스 스테이지 체크 (Stage 9 - World 2 녹턴 보스)
    if (this.isFogBossStage()) {
      // 짧은 지연 후 안개 보스 시작
      this.time.delayedCall(500, () => {
        this.startFogBoss();
      });
    }
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

      // 독가스 영역과 겹치지 않는지 체크
      const notOnGasZone = !this.isInGasZone(foodPos.x, foodPos.y);
      const notOnSaw = !this.isSawOccupyingTile(foodPos.x, foodPos.y);

      // 자석 탑과 겹치지 않는지 체크 (Flux Maze)
      const notOnTurret = !this.isTurretAtPosition(foodPos.x, foodPos.y);

      // 떠다니는 기뢰와 겹치지 않는지 체크 (Flux Maze)
      const notOnMine = !this.floatingMines.some(mine =>
        mine.x === foodPos.x && mine.y === foodPos.y
      );

      validPosition = notOnSnake && notOnDeadZone && notOnGasZone && notOnSaw && notOnTurret && notOnMine;
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

    // Stage 1, 2에서만 십자가 후레쉬 효과 (테스트 스테이지 포함 안함)
    if (this.currentStage !== 1 && this.currentStage !== 2) {
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

    // Magnetar 조작 반전 적용 (Phase 1)
    let effectiveDirection = this.direction;
    if (this.magnetarControlsReversed) {
      const reverseMap = { 'UP': 'DOWN', 'DOWN': 'UP', 'LEFT': 'RIGHT', 'RIGHT': 'LEFT' };
      effectiveDirection = reverseMap[this.direction] || this.direction;
    }

    switch (effectiveDirection) {
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

    if (this.isSawTileDanger(newHead.x, newHead.y)) {
      this.endGame();
      return;
    }

    // 독가스 영역 충돌 체크
    if (this.isInGasZone(newHead.x, newHead.y)) {
      this.endGame();
      return;
    }

    // 자석 탑 충돌 체크 (Flux Maze)
    if (this.isTurretAtPosition(newHead.x, newHead.y)) {
      this.endGame();
      return;
    }

    // 떠다니는 기뢰 충돌 체크 (Flux Maze)
    if (this.checkMineCollision(newHead.x, newHead.y)) {
      // checkMineCollision handles the damage/death internally
      if (this.gameOver) return;
    }

    // 레이저 터렛 충돌 체크 (Flux Maze - Stage -1)
    if (this.checkLaserCollision(newHead.x, newHead.y)) {
      this.endGame();
      return;
    }

    // EMP 레이저 충돌 체크 (Magnetar Phase 2)
    if (this.isOnEMPBeam(newHead.x, newHead.y)) {
      this.endGame();
      return;
    }

    // 자기 몸 충돌 체크
    if (this.snake.some(segment => segment.x === newHead.x && segment.y === newHead.y)) {
      this.endGame();
      return;
    }

    // 기어 타이탄 보스 몸 충돌 체크 (대시/무적 상태가 아닐 때)
    if (this.gearTitanMode && this.gearTitanPosition && !this.isDashing && !this.isInvincible) {
      const distToBoss = Math.abs(newHead.x - this.gearTitanPosition.x) + Math.abs(newHead.y - this.gearTitanPosition.y);
      if (distToBoss <= 2) {
        // vulnerable 상태면 HIT 처리
        if (this.gearTitanVulnerable) {
          this.handleGearTitanHit();
          return;
        } else {
          // vulnerable 아니면 게임 오버
          this.endGame();
          return;
        }
      }
    }

    // 뱀 이동
    this.snake.unshift(newHead);

    // 탄막 보스 HIT 체크 (vulnerable 상태에서 보스 위치에 도달)
    if (this.bulletBossMode && this.bulletBossPosition &&
        newHead.x === this.bulletBossPosition.x && newHead.y === this.bulletBossPosition.y) {
      if (this.bulletBossPhase === 'vulnerable') {
        this.handleBulletBossHit();
        this.draw();
        return;
      }
    }

    // Magnetar 보스 관련 충돌 체크
    if (this.magnetarMode) {
      // Phase 3: 보호막 생성기 충돌 체크
      if (this.checkGeneratorCollision(newHead.x, newHead.y)) {
        this.draw();
        return;
      }

      // Phase 1/2: 보스 위치에 도달하면 HIT
      if (this.magnetarPosition &&
          newHead.x === this.magnetarPosition.x && newHead.y === this.magnetarPosition.y) {
        if (this.magnetarPhase === 'phase1' || this.magnetarPhase === 'phase2') {
          this.handleMagnetarHit();
          this.draw();
          return;
        }
      }
    }

    // 안개 보스 관련 충돌 체크
    if (this.fogBossMode) {
      // 조명탄 수집 체크
      for (let i = this.flares.length - 1; i >= 0; i--) {
        const flare = this.flares[i];
        if (newHead.x === flare.x && newHead.y === flare.y) {
          this.collectFlare(flare);
          break;
        }
      }

      // 환각 먹이 충돌 체크 (Hallucination 페이즈)
      if (this.fogBossPhase === 'hallucination' && this.hallucinationFoods.length > 0) {
        for (const food of this.hallucinationFoods) {
          if (newHead.x === food.x && newHead.y === food.y) {
            this.handleHallucinationFood(food);
            this.draw();
            return;
          }
        }
      }

      // 빛 오브 수집 체크 (Eclipse 페이즈)
      if (this.lightOrb && newHead.x === this.lightOrb.x && newHead.y === this.lightOrb.y) {
        this.collectLightOrb();
      }

      // 보스 HIT 체크 (vulnerable 상태에서 보스 위치에 도달)
      if (this.fogBossPosition &&
          newHead.x === this.fogBossPosition.x && newHead.y === this.fogBossPosition.y) {
        if (this.fogBossPhase === 'vulnerable' || (this.fogBossVisible && this.flareActive)) {
          this.handleFogBossHit();
          this.draw();
          return;
        }
      }
    }

    // 먹이를 먹었는지 체크
    if (newHead.x === this.food.x && newHead.y === this.food.y) {
      this.triggerFogFlash();

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

      // 탄막 보스 HIT 체크 (food 위치를 사용하지 않으므로 별도 체크)
      // (이 블록은 food 위치가 아닌 경우에는 실행되지 않음)

      this.foodCount++;

      // World 3 (Stage 10-12): 톱니 생성 (매 먹이마다 1개씩, 최대 5개)
      if (shouldHaveSaws(this.currentStage) && !this.bossMode) {
        this.spawnSaw();
      }

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
      // TODO: 테스트용 임시 설정 (원래 20)
      if (!this.bossMode && this.foodCount >= 5) {
        this.stageClear();
        return; // 클리어 시퀀스 시작하므로 여기서 리턴
      }

      // 속도 증가 (최대 속도 50ms)
      if (this.moveTimer.delay > 50) {
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

    // 극성 마커 위치 업데이트 (Flux Maze)
    if (this.polarityEnabled) {
      this.updatePolarityMarkerPosition();
    }

    // 자기력에 의한 속도 영향 적용 (Flux Maze)
    if (this.magneticTurrets.length > 0) {
      this.applyMagneticSpeedEffect();
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

  // ==================== Moving Dead Zone (Saw) ====================
  ensureSawTexture() {
    if (this.textures.exists(this.sawTextureKey)) return;

    const size = 96;
    const center = size / 2;
    const spikes = 16;
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    g.fillStyle(0xdedede, 1);
    g.lineStyle(3, 0x550000, 0.6);
    g.beginPath();
    for (let i = 0; i < spikes; i++) {
      const angle = (Math.PI * 2 * i) / spikes;
      const radius = i % 2 === 0 ? size * 0.48 : size * 0.32;
      const px = center + Math.cos(angle) * radius;
      const py = center + Math.sin(angle) * radius;
      if (i === 0) {
        g.moveTo(px, py);
      } else {
        g.lineTo(px, py);
      }
    }
    g.closePath();
    g.fillPath();
    g.strokePath();

    g.fillStyle(0x3c3c3c, 1);
    g.fillCircle(center, center, size * 0.18);
    g.fillStyle(0xff0000, 0.85);
    g.fillCircle(center, center, size * 0.08);
    g.lineStyle(2, 0xffffff, 0.2);
    g.strokeCircle(center, center, size * 0.42);

    g.generateTexture(this.sawTextureKey, size, size);
    g.destroy();
  }

  isSawOccupyingTile(x, y) {
    // 일반 톱니 체크
    const normalSawOccupied = this.saws.some(saw => {
      if (!saw) return false;
      if (saw.x === x && saw.y === y) return true;
      if (saw.nextPosition && saw.nextPosition.x === x && saw.nextPosition.y === y) return true;
      return false;
    });

    // 강화 톱니 체크
    const enhancedSawOccupied = this.enhancedSaws.some(saw => {
      if (!saw) return false;
      if (saw.x === x && saw.y === y) return true;
      if (saw.nextPosition && saw.nextPosition.x === x && saw.nextPosition.y === y) return true;
      return false;
    });

    return normalSawOccupied || enhancedSawOccupied;
  }

  isSawTileDanger(x, y) {
    // 일반 톱니 위험 체크
    const normalSawDanger = this.saws.some(saw => saw && saw.canKill && (
      (saw.x === x && saw.y === y) ||
      (saw.nextPosition && saw.nextPosition.x === x && saw.nextPosition.y === y)
    ));

    // 강화 톱니 위험 체크
    const enhancedSawDanger = this.enhancedSaws.some(saw => saw && saw.canKill && (
      (saw.x === x && saw.y === y) ||
      (saw.nextPosition && saw.nextPosition.x === x && saw.nextPosition.y === y)
    ));

    return normalSawDanger || enhancedSawDanger;
  }

  getSawSpawnPosition() {
    const attempts = 100;
    for (let i = 0; i < attempts; i++) {
      const pos = {
        x: Phaser.Math.Between(0, this.cols - 1),
        y: Phaser.Math.Between(0, this.rows - 1)
      };

      if (this.isSawOccupyingTile(pos.x, pos.y)) continue;

      const notOnSnake = !this.snake.some(segment =>
        segment.x === pos.x && segment.y === pos.y
      );
      const notOnFood = !(pos.x === this.food.x && pos.y === this.food.y);
      const notOnGas = !this.isInGasZone(pos.x, pos.y);
      const notOnDeadZone = !this.deadZones.some(dz => dz.x === pos.x && dz.y === pos.y);

      const snakeHead = this.snake[0];
      let nextX = snakeHead.x;
      let nextY = snakeHead.y;
      switch (this.direction) {
        case 'LEFT': nextX -= 1; break;
        case 'RIGHT': nextX += 1; break;
        case 'UP': nextY -= 1; break;
        case 'DOWN': nextY += 1; break;
      }
      const notInFrontOfSnake = !(pos.x === nextX && pos.y === nextY);

      if (notOnSnake && notOnFood && notOnGas && notOnDeadZone && notInFrontOfSnake) {
        return pos;
      }
    }

    return null;
  }

  spawnSaw() {
    if (this.gameOver) return;
    if (this.saws.length >= this.maxSaws) return;

    this.ensureSawTexture();

    const pos = this.getSawSpawnPosition();
    if (!pos) return;

    const centerX = pos.x * this.gridSize + this.gridSize / 2;
    const centerY = pos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    const container = this.add.container(centerX, centerY);
    container.setDepth(120);
    container.setScale(0.2);
    container.setAlpha(0);

    const shadow = this.add.ellipse(0, this.gridSize * 0.18, this.gridSize + 10, this.gridSize / 2, 0x000000, 0.45);
    const aura = this.add.circle(0, 0, this.gridSize * 0.8, 0x5c0000, 0.32);
    aura.setBlendMode(Phaser.BlendModes.ADD);
    const warningRing = this.add.circle(0, 0, this.gridSize * 0.9, 0xff0000, 0);
    warningRing.setStrokeStyle(2, 0xff0000, 1);
    warningRing.setScale(1.8);

    const blade = this.add.image(0, 0, this.sawTextureKey);
    blade.setScale(this.gridSize / 78);
    blade.setTint(0xffffff);

    const core = this.add.circle(0, 0, this.gridSize * 0.22, 0xffffff, 0.9);
    core.setStrokeStyle(1, 0xff0000, 0.8);

    container.add([shadow, aura, warningRing, blade, core]);

    const saw = {
      x: pos.x,
      y: pos.y,
      container,
      blade,
      warningRing,
      moveDelay: this.sawBaseDelay,
      canKill: false,
      nextPosition: null,
      lastDirection: null,
      nextStepSize: 1,
      spinTween: null,
      pulseTween: null,
      breathTween: null,
      moveTimer: null
    };

    this.saws.push(saw);
    this.animateSawSpawn(saw);
  }

  animateSawSpawn(saw) {
    if (!saw) return;

    const { container, blade, warningRing } = saw;

    const spawnFlash = this.add.rectangle(container.x, container.y, this.gridSize * 3.2, this.gridSize * 3.2, 0xff0000, 0.55)
      .setDepth(140)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: spawnFlash,
      alpha: 0,
      scaleX: 2.2,
      scaleY: 2.2,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => spawnFlash.destroy()
    });

    saw.spinTween = this.tweens.add({
      targets: blade,
      angle: 360,
      duration: 260,
      repeat: -1,
      ease: 'Linear'
    });

    saw.pulseTween = this.tweens.add({
      targets: container,
      scaleX: { from: 0.2, to: 1.2 },
      scaleY: { from: 0.2, to: 1.2 },
      alpha: { from: 0, to: 1 },
      duration: 420,
      ease: 'Back.easeOut',
      onComplete: () => {
        warningRing.setScale(1);
        this.tweens.add({
          targets: warningRing,
          scale: { from: 1.4, to: 1 },
          alpha: { from: 1, to: 0 },
          duration: 320,
          ease: 'Quad.easeOut'
        });
        saw.canKill = true;
        this.startSawMovement(saw);
      }
    });

    saw.breathTween = this.tweens.add({
      targets: container,
      scaleX: 1.02,
      scaleY: 0.98,
      duration: 260,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
      delay: 300
    });

    this.tweens.add({
      targets: container,
      angle: { from: Phaser.Math.Between(-65, 65), to: Phaser.Math.Between(-5, 5) },
      duration: 520,
      ease: 'Sine.easeOut'
    });

    this.tweens.add({
      targets: warningRing,
      alpha: { from: 0, to: 0.7 },
      duration: 180,
      yoyo: true,
      ease: 'Quad.easeIn'
    });

    const impactRing = this.add.circle(container.x, container.y, this.gridSize * 1.4, 0xff0000, 0.12).setDepth(135);
    impactRing.setStrokeStyle(4, 0xffffff, 0.8);
    this.tweens.add({
      targets: impactRing,
      scale: 2.3,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => impactRing.destroy()
    });

    this.time.delayedCall(120, () => {
      if (!this.cameras || !this.cameras.main) return;
      this.cameras.main.shake(110, 0.003);
    });
  }

  flashSawEnraged(saw) {
    if (!saw) return;

    const { container, warningRing } = saw;

    this.tweens.add({
      targets: container,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 100,
      yoyo: true,
      ease: 'Quad.easeOut'
    });

    if (warningRing) {
      this.tweens.add({
        targets: warningRing,
        scale: { from: 1, to: 1.6 },
        alpha: { from: 0.8, to: 0 },
        duration: 200,
        ease: 'Quad.easeOut'
      });
    }

    if (saw.spinTween) {
      saw.spinTween.timeScale = 1.5;
      this.time.delayedCall(200, () => {
        if (saw && saw.spinTween) {
          saw.spinTween.timeScale = 1;
        }
      });
    }
  }

  startSawMovement(saw) {
    if (!saw) return;

    if (saw.moveTimer) {
      saw.moveTimer.remove();
    }

    saw.moveTimer = this.time.addEvent({
      delay: saw.moveDelay,
      loop: true,
      callback: () => this.moveSaw(saw)
    });
  }

  // 모든 톱니 일시정지
  pauseAllSaws() {
    // 기본 톱니
    for (const saw of this.saws) {
      if (saw && saw.moveTimer) {
        saw.moveTimer.paused = true;
      }
    }
    // 강화 톱니
    for (const saw of this.enhancedSaws) {
      if (saw && saw.moveTimer) {
        saw.moveTimer.paused = true;
      }
    }
  }

  // 모든 톱니 재개
  resumeAllSaws() {
    // 기본 톱니
    for (const saw of this.saws) {
      if (saw && saw.moveTimer) {
        saw.moveTimer.paused = false;
      }
    }
    // 강화 톱니
    for (const saw of this.enhancedSaws) {
      if (saw && saw.moveTimer) {
        saw.moveTimer.paused = false;
      }
    }
  }

  // 모든 강화 톱니 이동 시작
  startAllEnhancedSawMovement() {
    for (const saw of this.enhancedSaws) {
      if (saw && saw.canKill && !saw.moveTimer) {
        this.startEnhancedSawMovement(saw);
      }
    }
  }

  // 모든 톱니를 맵 밖으로 날려보내는 애니메이션
  animateSawsFlyOut(callback) {
    const { width, height } = this.cameras.main;

    // 뱀 숨기기 (스테이지 클리어 상태의 뱀이 보이지 않도록)
    this.hideSnakeGraphics();

    // 모든 톱니 컨테이너 수집
    const allSawContainers = [];
    this.saws.forEach(saw => {
      if (saw && saw.container && saw.container.active) {
        // 이동 타이머 정지
        if (saw.moveTimer) {
          saw.moveTimer.remove();
          saw.moveTimer = null;
        }
        allSawContainers.push({ container: saw.container, isEnhanced: false });
      }
    });
    this.enhancedSaws.forEach(saw => {
      if (saw && saw.container && saw.container.active) {
        // 이동 타이머 정지
        if (saw.moveTimer) {
          saw.moveTimer.remove();
          saw.moveTimer = null;
        }
        allSawContainers.push({ container: saw.container, isEnhanced: true });
      }
    });

    // 톱니가 없으면 바로 콜백
    if (allSawContainers.length === 0) {
      if (callback) callback();
      return;
    }

    // 화면 어둡게
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    overlay.setDepth(199);
    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.5,
      duration: 300
    });

    // 경고 텍스트
    const warningText = this.add.text(width / 2, height / 2 - 80, 'SAWS RETREATING...', {
      fontSize: '28px',
      fill: '#ff6600',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    this.tweens.add({
      targets: warningText,
      alpha: 1,
      duration: 300
    });

    // 카메라 약간 흔들림
    this.cameras.main.shake(500, 0.015);

    // 각 톱니를 랜덤 방향으로 날려보냄
    let completed = 0;
    const total = allSawContainers.length;

    allSawContainers.forEach((sawData, index) => {
      const container = sawData.container;

      // 랜덤 방향 선택 (상하좌우)
      const directions = [
        { x: -150, y: container.y }, // 왼쪽
        { x: width + 150, y: container.y }, // 오른쪽
        { x: container.x, y: -150 }, // 위
        { x: container.x, y: height + 150 } // 아래
      ];
      const targetPos = Phaser.Math.RND.pick(directions);

      // 회전하며 날아감
      this.tweens.add({
        targets: container,
        rotation: container.rotation + Math.PI * 6,
        duration: 800,
        ease: 'Quad.easeIn'
      });

      // 위치 이동 (날아감)
      this.tweens.add({
        targets: container,
        x: targetPos.x,
        y: targetPos.y,
        scaleX: sawData.isEnhanced ? 0.5 : 0.3,
        scaleY: sawData.isEnhanced ? 0.5 : 0.3,
        alpha: 0.3,
        duration: 800,
        delay: index * 80,
        ease: 'Quad.easeIn',
        onComplete: () => {
          // 날아가는 궤적에 스파크 효과
          const sparkCount = sawData.isEnhanced ? 5 : 3;
          for (let i = 0; i < sparkCount; i++) {
            const spark = this.add.graphics().setDepth(200);
            spark.fillStyle(sawData.isEnhanced ? 0xff4400 : 0xcccccc, 0.8);
            spark.fillCircle(0, 0, Phaser.Math.Between(2, 5));
            spark.x = targetPos.x + Phaser.Math.Between(-20, 20);
            spark.y = targetPos.y + Phaser.Math.Between(-20, 20);
            this.tweens.add({
              targets: spark,
              alpha: 0,
              scaleX: 2,
              scaleY: 2,
              duration: 300,
              delay: i * 50,
              onComplete: () => spark.destroy()
            });
          }

          container.destroy();
          completed++;

          // 모든 톱니가 날아가면 완료
          if (completed >= total) {
            // 배열 비우기
            this.saws = [];
            this.enhancedSaws = [];

            // UI 정리
            this.time.delayedCall(300, () => {
              this.tweens.add({
                targets: [overlay, warningText],
                alpha: 0,
                duration: 300,
                onComplete: () => {
                  overlay.destroy();
                  warningText.destroy();
                  if (callback) callback();
                }
              });
            });
          }
        }
      });
    });
  }

  chooseSawTarget(saw, stepSize = 1) {
    if (!saw) return null;

    const dirs = Phaser.Utils.Array.Shuffle([
      { dx: 1, dy: 0 },
      { dx: -1, dy: 0 },
      { dx: 0, dy: 1 },
      { dx: 0, dy: -1 }
    ]);

    for (const dir of dirs) {
      let tx = saw.x;
      let ty = saw.y;
      let valid = true;

      for (let i = 0; i < stepSize; i++) {
        tx += dir.dx;
        ty += dir.dy;

        if (tx < 0 || tx >= this.cols || ty < 0 || ty >= this.rows) {
          valid = false;
          break;
        }

        if (this.isInGasZone(tx, ty)) {
          valid = false;
          break;
        }
      }

      if (!valid) continue;

      if (this.deadZones.some(dz => dz.x === tx && dz.y === ty)) {
        continue;
      }

      if (this.isSawOccupyingTile(tx, ty)) {
        continue;
      }

      return { x: tx, y: ty, dx: dir.dx, dy: dir.dy };
    }

    if (stepSize > 1) {
      return this.chooseSawTarget(saw, 1);
    }

    return null;
  }

  createSawTrail(fromX, fromY, toX, toY) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const midX = Phaser.Math.Linear(fromX, toX, 0.5);
    const midY = Phaser.Math.Linear(fromY, toY, 0.5);
    const length = Phaser.Math.Distance.Between(fromX, fromY, toX, toY) + this.gridSize * 0.9;

    const slash = this.add.rectangle(midX, midY, length, 8, 0xff0000, 0.9)
      .setDepth(115)
      .setAngle(Phaser.Math.RadToDeg(angle));
    slash.setBlendMode(Phaser.BlendModes.ADD);

    this.tweens.add({
      targets: slash,
      alpha: 0,
      scaleY: 2.4,
      duration: 200,
      ease: 'Quad.easeOut',
      onComplete: () => slash.destroy()
    });

    const spark = this.add.circle(toX, toY, 6, 0xffffff, 0.95).setDepth(115);
    this.tweens.add({
      targets: spark,
      alpha: 0,
      scale: 0.3,
      duration: 150,
      ease: 'Cubic.easeOut',
      onComplete: () => spark.destroy()
    });

    const echo = this.add.rectangle(midX, midY, length * 0.8, 4, 0xff8800, 0.35)
      .setDepth(110)
      .setAngle(Phaser.Math.RadToDeg(angle));
    echo.setBlendMode(Phaser.BlendModes.SCREEN);
    this.tweens.add({
      targets: echo,
      alpha: 0,
      scaleY: 1.8,
      duration: 260,
      ease: 'Quad.easeOut',
      onComplete: () => echo.destroy()
    });
  }

  moveSaw(saw, forceLunge = false) {
    if (!saw || this.gameOver) return;
    if (this.moveTimer && this.moveTimer.paused) return;

    const stepSize = Math.max(1, forceLunge ? Math.max(2, saw.nextStepSize || 1) : (saw.nextStepSize || 1));
    saw.nextStepSize = 1;

    const target = this.chooseSawTarget(saw, stepSize);
    if (!target) return;

    saw.nextPosition = { x: target.x, y: target.y };
    saw.lastDirection = { dx: target.dx, dy: target.dy };

    const fromX = saw.container.x;
    const fromY = saw.container.y;
    const toX = target.x * this.gridSize + this.gridSize / 2;
    const toY = target.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    this.createSawTrail(fromX, fromY, toX, toY);

    this.tweens.add({
      targets: saw.container,
      x: toX,
      y: toY,
      duration: Math.max(150, saw.moveDelay * 0.55),
      ease: 'Sine.easeInOut',
      onStart: () => {
        this.tweens.add({
          targets: saw.container,
          scaleX: 1.12,
          scaleY: 0.9,
          duration: 110,
          yoyo: true,
          repeat: 1
        });
        if (saw.spinTween) {
          saw.spinTween.timeScale = 1.3;
        }
      },
      onComplete: () => {
        if (saw.spinTween) {
          saw.spinTween.timeScale = 1;
        }
        saw.x = target.x;
        saw.y = target.y;
        saw.nextPosition = null;
        this.handleSawCrossedFood(saw, target);
        this.checkSawCollisionWithSnake(saw);
      }
    });

    this.time.delayedCall(40, () => {
      if (!this.cameras || !this.cameras.main) return;
      this.cameras.main.shake(60, 0.0015);
    });
  }

  handleSawCrossedFood(saw, target) {
    if (!saw || !this.food) return;

    if (target.x === this.food.x && target.y === this.food.y) {
      saw.moveDelay = Math.max(60, saw.moveDelay - 5);
      if (saw.moveTimer) {
        saw.moveTimer.delay = saw.moveDelay;
      }
      saw.nextStepSize = 2;
      this.flashSawEnraged(saw);

      this.time.delayedCall(80, () => this.moveSaw(saw, true));
    }
  }

  checkSawCollisionWithSnake(saw) {
    if (!saw || !saw.canKill) return;
    // 스테이지 클리어 중에는 충돌 무시
    if (this.isStageClearingAnimation) return;

    const hitSnake = this.snake.some(segment => segment.x === saw.x && segment.y === saw.y);
    if (hitSnake) {
      this.endGame();
    }
  }

  destroySaw(saw) {
    if (!saw) return;

    if (saw.moveTimer) {
      saw.moveTimer.remove();
      saw.moveTimer = null;
    }

    if (saw.spinTween) {
      saw.spinTween.remove();
    }
    if (saw.pulseTween) {
      saw.pulseTween.remove();
    }
    if (saw.breathTween) {
      saw.breathTween.remove();
    }

    if (saw.container) {
      saw.container.destroy(true);
    }

    const idx = this.saws.indexOf(saw);
    if (idx >= 0) {
      this.saws.splice(idx, 1);
    }
  }

  destroyAllSaws() {
    const clones = [...this.saws];
    clones.forEach(saw => this.destroySaw(saw));
    this.saws = [];
  }

  // =====================
  // 톱니 보존 시스템
  // =====================

  shouldPreserveSaws() {
    // Stage -2 -> -1 전환 시 톱니 보존
    return this.preserveSawsForNextStage;
  }

  // =====================
  // 강화 톱니 시스템 (Stage -1)
  // =====================

  destroyEnhancedSaw(saw) {
    if (!saw) return;

    // 타이머 정리
    if (saw.moveTimer) saw.moveTimer.remove();
    if (saw.spinTween) saw.spinTween.remove();
    if (saw.pulseTween) saw.pulseTween.remove();
    if (saw.breathTween) saw.breathTween.remove();
    if (saw.glowTween) saw.glowTween.remove();
    if (saw.trailTimer) saw.trailTimer.remove();

    // 컨테이너 파괴
    if (saw.container) saw.container.destroy(true);

    // 배열에서 제거
    const idx = this.enhancedSaws.indexOf(saw);
    if (idx >= 0) this.enhancedSaws.splice(idx, 1);
  }

  destroyAllEnhancedSaws() {
    const clones = [...this.enhancedSaws];
    clones.forEach(saw => this.destroyEnhancedSaw(saw));
    this.enhancedSaws = [];
  }

  getEnhancedSawSpawnPosition() {
    // 안전한 위치 찾기
    for (let attempt = 0; attempt < 100; attempt++) {
      const x = Phaser.Math.Between(3, this.cols - 4);
      const y = Phaser.Math.Between(3, this.rows - 4);

      // 뱀과 겹치지 않는지
      const notOnSnake = !this.snake.some(seg => seg.x === x && seg.y === y);
      // 먹이와 겹치지 않는지
      const notOnFood = !(this.food && this.food.x === x && this.food.y === y);
      // 데드존과 겹치지 않는지
      const notOnDeadZone = !this.deadZones.some(dz => dz.x === x && dz.y === y);
      // 기존 톱니와 겹치지 않는지
      const notOnSaw = !this.saws.some(s => Math.abs(s.x - x) < 3 && Math.abs(s.y - y) < 3);
      // 강화 톱니와 겹치지 않는지
      const notOnEnhancedSaw = !this.enhancedSaws.some(s => Math.abs(s.x - x) < 3 && Math.abs(s.y - y) < 3);

      if (notOnSnake && notOnFood && notOnDeadZone && notOnSaw && notOnEnhancedSaw) {
        return { x, y };
      }
    }
    return { x: 20, y: 13 }; // 기본 위치
  }

  spawnEnhancedSaw(delayMovement = false) {
    if (this.gameOver || this.enhancedSaws.length >= this.maxEnhancedSaws) return;

    const pos = this.getEnhancedSawSpawnPosition();
    const pixelX = pos.x * this.gridSize + this.gridSize / 2;
    const pixelY = pos.y * this.gridSize + this.gridSize / 2 + 60;

    // 컨테이너 생성
    const container = this.add.container(pixelX, pixelY);
    container.setDepth(200);
    container.setScale(0);

    // 빨간 글로우 오라 (강화 톱니 특징)
    const glowAura = this.add.graphics();
    const glowSize = this.gridSize * this.enhancedSawScale * 1.5;
    glowAura.fillStyle(0xff0000, 0.3);
    glowAura.fillCircle(0, 0, glowSize);
    container.add(glowAura);

    // 위험 오라
    const dangerAura = this.add.graphics();
    dangerAura.fillStyle(0xff4400, 0.2);
    dangerAura.fillCircle(0, 0, this.gridSize * this.enhancedSawScale);
    container.add(dangerAura);

    // 경고 링
    const warningRing = this.add.graphics();
    warningRing.lineStyle(3, 0xff0000, 0.8);
    warningRing.strokeCircle(0, 0, this.gridSize * this.enhancedSawScale * 0.9);
    container.add(warningRing);

    // 톱니 블레이드 (강화 버전 - 더 크고 날카로움)
    const blade = this.add.graphics();
    const bladeRadius = this.gridSize * 0.45 * this.enhancedSawScale;
    const teethCount = 16; // 더 많은 톱니

    // 블레이드 그리기 (빨간색 포인트 추가)
    blade.fillStyle(0xcc3333, 1); // 빨간 빛 도는 금속
    blade.beginPath();
    for (let i = 0; i < teethCount; i++) {
      const angle = (i / teethCount) * Math.PI * 2;
      const nextAngle = ((i + 0.5) / teethCount) * Math.PI * 2;
      const outerR = bladeRadius * 1.2;
      const innerR = bladeRadius * 0.7;

      if (i === 0) {
        blade.moveTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      } else {
        blade.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      }
      blade.lineTo(Math.cos(nextAngle) * innerR, Math.sin(nextAngle) * innerR);
    }
    blade.closePath();
    blade.fill();

    // 내부 코어 (검은색)
    blade.fillStyle(0x220000, 1);
    blade.fillCircle(0, 0, bladeRadius * 0.35);

    // 빛나는 중심
    blade.fillStyle(0xff6600, 1);
    blade.fillCircle(0, 0, bladeRadius * 0.15);

    container.add(blade);

    // 강화 톱니 객체 생성
    const enhancedSaw = {
      x: pos.x,
      y: pos.y,
      container,
      blade,
      warningRing,
      glowAura,
      dangerAura,
      moveDelay: this.enhancedSawDelay,
      canKill: false,
      nextPosition: null,
      lastDirection: null,
      nextStepSize: 2, // 강화 톱니는 2칸 점프 가능
      spinTween: null,
      pulseTween: null,
      breathTween: null,
      glowTween: null,
      trailTimer: null,
      moveTimer: null,
      isEnhanced: true
    };

    this.enhancedSaws.push(enhancedSaw);
    this.animateEnhancedSawSpawn(enhancedSaw, delayMovement);
  }

  animateEnhancedSawSpawn(saw, delayMovement = false) {
    const { width, height } = this.cameras.main;

    // 스폰 플래시 효과 (빨간색)
    const flash = this.add.graphics();
    flash.setDepth(199);
    const flashX = saw.x * this.gridSize + this.gridSize / 2;
    const flashY = saw.y * this.gridSize + this.gridSize / 2 + 60;

    flash.fillStyle(0xff0000, 0.8);
    flash.fillCircle(flashX, flashY, this.gridSize * 2);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy()
    });

    // 카메라 쉐이크
    this.cameras.main.shake(200, 0.01);

    // 컨테이너 등장 애니메이션
    this.tweens.add({
      targets: saw.container,
      scaleX: this.enhancedSawScale,
      scaleY: this.enhancedSawScale,
      duration: 500,
      ease: 'Back.easeOut'
    });

    // 경고 링 펄스
    this.tweens.add({
      targets: saw.warningRing,
      scaleX: { from: 1.5, to: 1 },
      scaleY: { from: 1.5, to: 1 },
      alpha: { from: 1, to: 0.6 },
      duration: 500,
      ease: 'Power2'
    });

    // 회전 시작 (더 빠르게)
    saw.spinTween = this.tweens.add({
      targets: saw.blade,
      rotation: Math.PI * 2,
      duration: 200, // 기본 톱니보다 빠름
      repeat: -1,
      ease: 'Linear'
    });

    // 글로우 펄스 애니메이션
    saw.glowTween = this.tweens.add({
      targets: saw.glowAura,
      alpha: { from: 0.3, to: 0.6 },
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 400,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 1초 후 활성화
    this.time.delayedCall(1000, () => {
      if (saw && saw.container && saw.container.active) {
        saw.canKill = true;

        // delayMovement가 false일 때만 바로 이동 시작
        if (!delayMovement) {
          this.startEnhancedSawMovement(saw);
        }

        // 활성화 플래시
        const activateFlash = this.add.graphics();
        activateFlash.setDepth(201);
        activateFlash.fillStyle(0xff4400, 0.6);
        activateFlash.fillCircle(
          saw.x * this.gridSize + this.gridSize / 2,
          saw.y * this.gridSize + this.gridSize / 2 + 60,
          this.gridSize * 1.5
        );
        this.tweens.add({
          targets: activateFlash,
          alpha: 0,
          scaleX: 2,
          scaleY: 2,
          duration: 300,
          onComplete: () => activateFlash.destroy()
        });
      }
    });
  }

  startEnhancedSawMovement(saw) {
    if (!saw || !saw.container || !saw.container.active) return;

    saw.moveTimer = this.time.addEvent({
      delay: saw.moveDelay,
      loop: true,
      callback: () => this.moveEnhancedSaw(saw)
    });
  }

  moveEnhancedSaw(saw) {
    if (!saw || !saw.canKill || this.gameOver || !saw.container || !saw.container.active) return;

    // 다음 위치 결정 (2칸 점프 50% 확률)
    const stepSize = Math.random() < 0.5 ? 2 : 1;
    const target = this.chooseEnhancedSawTarget(saw, stepSize);

    if (!target) return;

    const oldX = saw.x;
    const oldY = saw.y;

    // 불꽃 트레일 생성
    this.createEnhancedSawTrail(oldX, oldY, target.x, target.y);

    // 위치 업데이트
    saw.x = target.x;
    saw.y = target.y;
    saw.lastDirection = target.direction;

    // 이동 애니메이션 (더 빠름)
    const newPixelX = saw.x * this.gridSize + this.gridSize / 2;
    const newPixelY = saw.y * this.gridSize + this.gridSize / 2 + 60;

    this.tweens.add({
      targets: saw.container,
      x: newPixelX,
      y: newPixelY,
      duration: saw.moveDelay * 0.4,
      ease: 'Power2',
      onComplete: () => {
        // 충돌 체크 (스테이지 클리어 중에는 무시)
        if (!this.isStageClearingAnimation && saw.canKill && this.checkEnhancedSawCollision(saw)) {
          this.endGame();
        }
      }
    });
  }

  chooseEnhancedSawTarget(saw, stepSize) {
    const directions = [
      { dx: 0, dy: -1, name: 'up' },
      { dx: 0, dy: 1, name: 'down' },
      { dx: -1, dy: 0, name: 'left' },
      { dx: 1, dy: 0, name: 'right' }
    ];

    // 뱀 머리 방향으로 이동 확률 증가 (60%)
    const head = this.snake[0];
    let preferredDir = null;
    if (Math.random() < 0.6) {
      const dx = head.x - saw.x;
      const dy = head.y - saw.y;
      if (Math.abs(dx) > Math.abs(dy)) {
        preferredDir = dx > 0 ? 'right' : 'left';
      } else {
        preferredDir = dy > 0 ? 'down' : 'up';
      }
    }

    // 유효한 방향 필터링
    const validDirs = directions.filter(dir => {
      const newX = saw.x + dir.dx * stepSize;
      const newY = saw.y + dir.dy * stepSize;

      // 맵 범위 체크
      if (newX < 0 || newX >= this.cols || newY < 0 || newY >= this.rows) return false;
      // 데드존 체크
      if (this.deadZones.some(dz => dz.x === newX && dz.y === newY)) return false;
      // 다른 톱니 체크
      if (this.saws.some(s => s.x === newX && s.y === newY)) return false;
      if (this.enhancedSaws.some(s => s !== saw && s.x === newX && s.y === newY)) return false;

      return true;
    });

    if (validDirs.length === 0) return null;

    // 선호 방향 우선
    if (preferredDir) {
      const preferred = validDirs.find(d => d.name === preferredDir);
      if (preferred) {
        return {
          x: saw.x + preferred.dx * stepSize,
          y: saw.y + preferred.dy * stepSize,
          direction: preferred.name
        };
      }
    }

    // 랜덤 선택
    const chosen = Phaser.Math.RND.pick(validDirs);
    return {
      x: saw.x + chosen.dx * stepSize,
      y: saw.y + chosen.dy * stepSize,
      direction: chosen.name
    };
  }

  createEnhancedSawTrail(fromX, fromY, toX, toY) {
    // 불꽃 트레일 효과
    const startPixelX = fromX * this.gridSize + this.gridSize / 2;
    const startPixelY = fromY * this.gridSize + this.gridSize / 2 + 60;
    const endPixelX = toX * this.gridSize + this.gridSize / 2;
    const endPixelY = toY * this.gridSize + this.gridSize / 2 + 60;

    // 트레일 라인
    const trail = this.add.graphics();
    trail.setDepth(150);
    trail.lineStyle(4, 0xff4400, 0.8);
    trail.beginPath();
    trail.moveTo(startPixelX, startPixelY);
    trail.lineTo(endPixelX, endPixelY);
    trail.stroke();

    // 스파크 파티클
    for (let i = 0; i < 5; i++) {
      const t = i / 4;
      const sparkX = startPixelX + (endPixelX - startPixelX) * t;
      const sparkY = startPixelY + (endPixelY - startPixelY) * t;

      const spark = this.add.graphics();
      spark.setDepth(151);
      spark.fillStyle(Phaser.Math.RND.pick([0xff6600, 0xff0000, 0xffaa00]), 1);
      spark.fillCircle(sparkX, sparkY, 3);

      this.tweens.add({
        targets: spark,
        alpha: 0,
        y: sparkY + Phaser.Math.Between(-10, 10),
        x: sparkX + Phaser.Math.Between(-10, 10),
        scaleX: 0,
        scaleY: 0,
        duration: 300,
        onComplete: () => spark.destroy()
      });
    }

    // 트레일 페이드아웃
    this.tweens.add({
      targets: trail,
      alpha: 0,
      duration: 200,
      onComplete: () => trail.destroy()
    });
  }

  checkEnhancedSawCollision(saw) {
    const head = this.snake[0];
    return head.x === saw.x && head.y === saw.y;
  }

  startEnhancedSawHellStage() {
    const { width, height } = this.cameras.main;

    // 게임 일시정지
    this.moveTimer.paused = true;

    // 기존 톱니들도 일시정지
    this.pauseAllSaws();

    // 경고 텍스트
    const warningText = this.add.text(width / 2, height / 2 - 50, 'ENHANCED SAWS INCOMING!', {
      fontSize: '36px',
      fill: '#ff4400',
      fontStyle: 'bold',
      stroke: '#660000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    // 카메라 쉐이크
    this.cameras.main.shake(500, 0.02);

    // 경고 텍스트 애니메이션
    this.tweens.add({
      targets: warningText,
      alpha: 1,
      scaleX: { from: 0.5, to: 1.2 },
      scaleY: { from: 0.5, to: 1.2 },
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: warningText,
          scaleX: 1,
          scaleY: 1,
          duration: 200,
          onComplete: () => {
            // 강화 톱니 3개 순차 생성 (이동은 카운트다운 후 시작)
            let sawIndex = 0;
            const spawnInterval = this.time.addEvent({
              delay: 600,
              repeat: 2,
              callback: () => {
                this.spawnEnhancedSaw(true); // delayMovement = true
                sawIndex++;

                // 마지막 톱니 생성 후
                if (sawIndex >= 3) {
                  this.time.delayedCall(1000, () => {
                    // 경고 텍스트 페이드아웃
                    this.tweens.add({
                      targets: warningText,
                      alpha: 0,
                      duration: 300,
                      onComplete: () => {
                        warningText.destroy();
                        // Stage -1 전용 카운트다운 (톱니 시작 포함)
                        this.startEnhancedSawCountdown();
                      }
                    });
                  });
                }
              }
            });
          }
        });
      }
    });
  }

  // Stage -1 전용 카운트다운 (톱니 이동 시작 포함)
  startEnhancedSawCountdown() {
    const { width, height } = this.cameras.main;

    // 카운트다운 텍스트
    const countdownText = this.add.text(width / 2, height / 2, '3', {
      fontSize: '64px',
      fill: '#ff4400',
      fontStyle: 'bold',
      stroke: '#660000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(5000);

    let countdown = 3;
    const countdownTimer = this.time.addEvent({
      delay: 600,
      callback: () => {
        countdown--;
        if (countdown > 0) {
          countdownText.setText(countdown.toString());
          // 카운트다운 펄스 효과
          this.tweens.add({
            targets: countdownText,
            scaleX: { from: 1.3, to: 1 },
            scaleY: { from: 1.3, to: 1 },
            duration: 200,
            ease: 'Power2'
          });
        } else {
          countdownText.setText('GO!');
          countdownText.setFill('#00ff00');
          countdownTimer.remove();

          // GO! 펄스 효과
          this.tweens.add({
            targets: countdownText,
            scaleX: { from: 1.5, to: 1 },
            scaleY: { from: 1.5, to: 1 },
            duration: 300,
            ease: 'Back.easeOut'
          });

          // GO! 표시 후 게임 재개 + 톱니 시작
          this.time.delayedCall(400, () => {
            countdownText.destroy();

            // 모든 톱니 재개 (기존 톱니)
            this.resumeAllSaws();

            // 강화 톱니 이동 시작
            this.startAllEnhancedSawMovement();

            // 게임 재개
            this.moveTimer.paused = false;
          });
        }
      },
      loop: true
    });
  }

  // =====================
  // 기어 타이탄 보스 시스템 (Stage 0) - 기본 함수들
  // =====================

  isGearTitanStage() {
    // Gear Titan 보스 비활성화 - Stage 0은 Magnetar 보스만 사용
    return false;
  }

  cleanupGearTitan() {
    // 기어 타이탄 요소 정리
    if (this.gearTitanContainer) {
      this.gearTitanContainer.destroy(true);
      this.gearTitanContainer = null;
    }

    if (this.gearTitanAttackTimer) {
      this.gearTitanAttackTimer.remove();
      this.gearTitanAttackTimer = null;
    }

    if (this.gearTitanAnimTimer) {
      this.gearTitanAnimTimer.remove();
      this.gearTitanAnimTimer = null;
    }

    // 기어들 정리
    this.gearTitanGears.forEach(gear => {
      if (gear && gear.destroy) gear.destroy();
    });
    this.gearTitanGears = [];

    // 레이저들 정리
    this.gearTitanLasers.forEach(laser => {
      if (laser && laser.destroy) laser.destroy();
    });
    this.gearTitanLasers = [];

    // 코어 정리
    if (this.gearTitanCore) {
      if (this.gearTitanCore.destroy) this.gearTitanCore.destroy();
      this.gearTitanCore = null;
    }

    // 차지 UI 정리
    this.cleanupChargeUI();

    // 상태 리셋
    this.gearTitanMode = false;
    this.gearTitanPhase = 'none';
    this.gearTitanPosition = null;
    this.gearTitanHitCount = 0;
    this.gearTitanVulnerable = false;
    this.canChargeDash = false;
    this.isCharging = false;
    this.chargeReady = false;
    this.isDashing = false;
  }

  cleanupChargeUI() {
    if (this.chargeUI) {
      this.chargeUI.destroy();
      this.chargeUI = null;
    }
    if (this.chargeGaugeUI) {
      this.chargeGaugeUI.destroy();
      this.chargeGaugeUI = null;
    }
    // 차지 에너지 이펙트도 정리
    this.cleanupChargeEnergyEffect();
  }

  // =====================
  // 기어 타이탄 보스 시스템 - 메인 함수들
  // =====================

  startGearTitan() {
    this.gearTitanMode = true;
    this.gearTitanPhase = 'intro';
    this.gearTitanHitCount = 0;
    this.gearTitanVulnerable = false;
    this.gearTitanStunEndTime = 0;

    // 차지 대시 초기화
    this.canChargeDash = false; // 인트로 동안 비활성화
    this.lastDashTime = 0;
    this.isCharging = false;
    this.chargeReady = false;
    this.isDashing = false;

    // 보스 위치 설정 (맵 중앙)
    this.gearTitanPosition = {
      x: Math.floor(this.cols / 2),
      y: Math.floor(this.rows / 2)
    };

    // 톱니들은 이미 날아갔으므로 바로 보스 등장 인트로 시작
    this.showGearTitanAppearIntro();
  }

  // 기어 타이탄 등장 인트로 (톱니 날아간 후)
  showGearTitanAppearIntro() {
    const { width, height } = this.cameras.main;
    const centerX = this.gearTitanPosition.x * this.gridSize + this.gridSize / 2;
    const centerY = this.gearTitanPosition.y * this.gridSize + this.gridSize / 2 + 60;

    // 게임 일시정지 (이미 되어있을 수 있음)
    this.moveTimer.paused = true;

    // 뱀 대사 (말풍선) - 위트있게
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + 60;

    // 말풍선 컨테이너
    const bubbleContainer = this.add.container(headX, headY - 55).setDepth(5001);

    // 말풍선 배경
    const bubble = this.add.graphics();
    bubble.fillStyle(0xffffff, 0.95);
    bubble.lineStyle(3, 0x333333, 1);
    bubble.fillRoundedRect(-120, -25, 240, 50, 12);
    bubble.strokeRoundedRect(-120, -25, 240, 50, 12);

    // 말풍선 꼬리
    bubble.fillStyle(0xffffff, 0.95);
    bubble.fillTriangle(0, 25, -10, 15, 10, 15);
    bubble.lineStyle(3, 0x333333, 1);
    bubble.lineBetween(-10, 17, 0, 28);
    bubble.lineBetween(10, 17, 0, 28);
    bubbleContainer.add(bubble);

    // 대사 텍스트
    const snakeDialogue = "Good riddance! Now where's the big boss?";
    const dialogueText = this.add.text(0, 0, '', {
      fontSize: '12px',
      fill: '#222222',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    bubbleContainer.add(dialogueText);

    // 말풍선 등장 애니메이션
    bubbleContainer.setScale(0);
    this.tweens.add({
      targets: bubbleContainer,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    // 타이핑 효과
    let charIndex = 0;
    this.time.delayedCall(300, () => {
      const typeTimer = this.time.addEvent({
        delay: 35,
        callback: () => {
          dialogueText.setText(snakeDialogue.substring(0, charIndex + 1));
          charIndex++;
          if (charIndex >= snakeDialogue.length) {
            typeTimer.destroy();

            // 대사 완료 후 보스 등장
            this.time.delayedCall(1000, () => {
              // 말풍선 사라짐
              this.tweens.add({
                targets: bubbleContainer,
                scale: 0,
                alpha: 0,
                duration: 200,
                onComplete: () => bubbleContainer.destroy()
              });

              // 보스 등장 시퀀스
              this.showGearTitanBossAppear(centerX, centerY);
            });
          }
        },
        loop: true
      });
    });
  }

  // 기어 타이탄 보스 등장 시퀀스
  showGearTitanBossAppear(centerX, centerY) {
    const { width, height } = this.cameras.main;

    // 화면 어둡게
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0);
    overlay.setDepth(4999);
    this.tweens.add({
      targets: overlay,
      fillAlpha: 0.7,
      duration: 400
    });

    // WARNING 텍스트
    const warningText = this.add.text(width / 2, height / 2 - 100, 'WARNING!', {
      fontSize: '72px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#660000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    // 카메라 쉐이크
    this.cameras.main.shake(1200, 0.04);

    // WARNING 애니메이션
    this.tweens.add({
      targets: warningText,
      alpha: 1,
      duration: 150,
      yoyo: true,
      repeat: 4,
      onComplete: () => {
        warningText.destroy();

        // 중앙에서 에너지 수렴 효과
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const dist = 150;
          const particle = this.add.graphics().setDepth(5001);
          particle.fillStyle(0xff6600, 0.8);
          particle.fillCircle(0, 0, 8);
          particle.x = centerX + Math.cos(angle) * dist;
          particle.y = centerY + Math.sin(angle) * dist;

          this.tweens.add({
            targets: particle,
            x: centerX,
            y: centerY,
            alpha: 0,
            scaleX: 0.2,
            scaleY: 0.2,
            duration: 500,
            ease: 'Quad.easeIn',
            onComplete: () => particle.destroy()
          });
        }

        // 대폭발 효과
        this.time.delayedCall(500, () => {
          this.cameras.main.flash(300, 255, 150, 0);

          // 폭발 파티클
          for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2;
            const dist = Phaser.Math.Between(40, 100);
            const particle = this.add.graphics().setDepth(5002);
            particle.fillStyle(Phaser.Math.RND.pick([0xff4400, 0xffaa00, 0xff0000]), 1);
            particle.fillCircle(0, 0, Phaser.Math.Between(3, 8));
            particle.x = centerX;
            particle.y = centerY;

            this.tweens.add({
              targets: particle,
              x: centerX + Math.cos(angle) * dist,
              y: centerY + Math.sin(angle) * dist,
              alpha: 0,
              duration: 600,
              ease: 'Power2',
              onComplete: () => particle.destroy()
            });
          }

          // 보스 등장
          this.drawGearTitan();

          // 오버레이 서서히 사라짐
          this.tweens.add({
            targets: overlay,
            fillAlpha: 0,
            duration: 800,
            delay: 400,
            onComplete: () => overlay.destroy()
          });

          // 보스 무서운 대사
          this.time.delayedCall(800, () => {
            this.showGearTitanDialogue("I AM GEAR TITAN... FORGED FROM STEEL!", () => {
              this.showGearTitanDialogue("YOUR SAWS WERE MERE TOYS... NOW FACE ME!", () => {
                // 뱀 반응 (말풍선)
                this.showGearTitanSnakeBubble("Steel? I eat metal for breakfast!", () => {
                  // 차지 대시 튜토리얼 후 전투 시작
                  this.showChargeDashTutorial(() => {
                    this.canChargeDash = true;
                    this.gearTitanPhase = 'phase1';
                    this.moveTimer.paused = false;
                    this.showChargeUI();
                    this.advanceGearTitanPhase();
                  });
                });
              });
            });
          });
        });
      }
    });
  }

  // 기어 타이탄 톱니 합체 인트로 (이전 버전 - 사용 안함)
  showGearTitanMergeIntro() {
    const { width, height } = this.cameras.main;

    // 게임 일시정지
    this.moveTimer.paused = true;

    // 뱀 대사 (말풍선) - 위트있게
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + 60;

    // 말풍선 컨테이너
    const bubbleContainer = this.add.container(headX, headY - 55).setDepth(5001);

    // 말풍선 배경
    const bubble = this.add.graphics();
    bubble.fillStyle(0xffffff, 0.95);
    bubble.lineStyle(3, 0x333333, 1);
    bubble.fillRoundedRect(-110, -25, 220, 50, 12);
    bubble.strokeRoundedRect(-110, -25, 220, 50, 12);

    // 말풍선 꼬리
    bubble.fillStyle(0xffffff, 0.95);
    bubble.fillTriangle(0, 25, -10, 15, 10, 15);
    bubble.lineStyle(3, 0x333333, 1);
    bubble.lineBetween(-10, 17, 0, 28);
    bubble.lineBetween(10, 17, 0, 28);
    bubbleContainer.add(bubble);

    // 대사 텍스트
    const snakeDialogue = "Whoa, saws! You guys need some therapy?";
    const dialogueText = this.add.text(0, 0, '', {
      fontSize: '13px',
      fill: '#222222',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    bubbleContainer.add(dialogueText);

    // 말풍선 등장 애니메이션
    bubbleContainer.setScale(0);
    this.tweens.add({
      targets: bubbleContainer,
      scale: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    // 타이핑 효과
    let charIndex = 0;
    this.time.delayedCall(300, () => {
      const typeTimer = this.time.addEvent({
        delay: 35,
        callback: () => {
          dialogueText.setText(snakeDialogue.substring(0, charIndex + 1));
          charIndex++;
          if (charIndex >= snakeDialogue.length) {
            typeTimer.destroy();

            // 대사 완료 후 톱니들 반응
            this.time.delayedCall(1000, () => {
              // 말풍선 사라짐
              this.tweens.add({
                targets: bubbleContainer,
                scale: 0,
                alpha: 0,
                duration: 200,
                onComplete: () => bubbleContainer.destroy()
              });

              // 톱니들이 떨리기 시작
              this.shakeSawsBeforeMerge();
            });
          }
        },
        loop: true
      });
    });
  }

  // 톱니들 떨림 후 합체
  shakeSawsBeforeMerge() {
    const { width, height } = this.cameras.main;
    const centerX = this.gearTitanPosition.x * this.gridSize + this.gridSize / 2;
    const centerY = this.gearTitanPosition.y * this.gridSize + this.gridSize / 2 + 60;

    // 모든 톱니 컨테이너 수집
    const allSawContainers = [];
    this.saws.forEach(saw => {
      if (saw && saw.container && saw.container.active) {
        allSawContainers.push(saw.container);
      }
    });
    this.enhancedSaws.forEach(saw => {
      if (saw && saw.container && saw.container.active) {
        allSawContainers.push(saw.container);
      }
    });

    // 톱니들 떨림 애니메이션
    allSawContainers.forEach(container => {
      this.tweens.add({
        targets: container,
        x: container.x + Phaser.Math.Between(-3, 3),
        y: container.y + Phaser.Math.Between(-3, 3),
        duration: 50,
        yoyo: true,
        repeat: 15,
        ease: 'Sine.easeInOut'
      });
    });

    // 카메라 쉐이크
    this.cameras.main.shake(800, 0.015);

    // 떨림 후 합체 시작
    this.time.delayedCall(900, () => {
      this.animateSawMerge(allSawContainers, centerX, centerY);
    });
  }

  // 톱니 합체 애니메이션
  animateSawMerge(sawContainers, centerX, centerY) {
    const { width, height } = this.cameras.main;

    // 각 톱니가 중앙으로 빨려들어감
    let completed = 0;
    const total = sawContainers.length;

    sawContainers.forEach((container, index) => {
      // 회전 가속
      this.tweens.add({
        targets: container,
        rotation: container.rotation + Math.PI * 8,
        duration: 800,
        ease: 'Quad.easeIn'
      });

      // 중앙으로 이동
      this.tweens.add({
        targets: container,
        x: centerX,
        y: centerY,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 800,
        delay: index * 50,
        ease: 'Quad.easeIn',
        onComplete: () => {
          // 합체 시 스파크 효과
          const spark = this.add.graphics();
          spark.setDepth(300);
          spark.fillStyle(0xff6600, 1);
          spark.fillCircle(centerX, centerY, 15);
          this.tweens.add({
            targets: spark,
            alpha: 0,
            scaleX: 2,
            scaleY: 2,
            duration: 150,
            onComplete: () => spark.destroy()
          });

          container.destroy();
          completed++;

          // 모든 톱니 합체 완료
          if (completed >= total) {
            this.saws = [];
            this.enhancedSaws = [];
            this.showGearTitanFormation(centerX, centerY);
          }
        }
      });
    });
  }

  // 기어 타이탄 형성 애니메이션
  showGearTitanFormation(centerX, centerY) {
    const { width, height } = this.cameras.main;

    // 대폭발 효과
    this.cameras.main.shake(500, 0.04);
    this.cameras.main.flash(200, 255, 100, 0);

    // 폭발 파티클
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2;
      const dist = Phaser.Math.Between(30, 80);
      const particle = this.add.graphics();
      particle.setDepth(301);
      particle.fillStyle(0xff4400, 1);
      particle.fillCircle(0, 0, Phaser.Math.Between(4, 10));
      particle.x = centerX;
      particle.y = centerY;

      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        alpha: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 보스 등장
    this.time.delayedCall(400, () => {
      this.drawGearTitan();

      // 보스 등장 후 무서운 대사 (자막 스타일)
      this.time.delayedCall(600, () => {
        this.showGearTitanDialogue("I AM GEAR TITAN... FORGED FROM YOUR FEAR!", () => {
          // 두 번째 대사
          this.showGearTitanDialogue("YOUR LITTLE SNAKE WILL BE CRUSHED!", () => {
            // 뱀 반응 (말풍선)
            this.showGearTitanSnakeBubble("Crushed? More like... slithered away!", () => {
              // 차지 대시 튜토리얼 후 전투 시작
              this.showChargeDashTutorial(() => {
                this.canChargeDash = true;
                this.gearTitanPhase = 'phase1';
                this.moveTimer.paused = false;
                this.showChargeUI();
                this.advanceGearTitanPhase();
              });
            });
          });
        });
      });
    });
  }

  // 기어 타이탄 무서운 자막 대사
  showGearTitanDialogue(text, callback) {
    const { width, height } = this.cameras.main;

    // 화면 하단 자막 스타일
    const subtitleBg = this.add.rectangle(width / 2, height - 60, width, 80, 0x000000, 0.8);
    subtitleBg.setDepth(5100);

    const dialogue = this.add.text(width / 2, height - 60, '', {
      fontSize: '22px',
      fill: '#ff3300',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      shadow: { offsetX: 2, offsetY: 2, color: '#ff0000', blur: 10, fill: true }
    }).setOrigin(0.5).setDepth(5101);

    // 카메라 약간 흔들림 (위협적)
    this.cameras.main.shake(200, 0.01);

    // 타이핑 효과
    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 30,
      callback: () => {
        dialogue.setText(text.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex >= text.length) {
          typeTimer.destroy();
          this.time.delayedCall(1200, () => {
            this.tweens.add({
              targets: [subtitleBg, dialogue],
              alpha: 0,
              duration: 300,
              onComplete: () => {
                subtitleBg.destroy();
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

  // 뱀 말풍선 대사 (기어 타이탄용 - 위트있는)
  showGearTitanSnakeBubble(text, callback) {
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + 60;

    // 말풍선 컨테이너
    const bubbleContainer = this.add.container(headX, headY - 55).setDepth(5001);

    // 말풍선 배경
    const bubble = this.add.graphics();
    bubble.fillStyle(0xffffff, 0.95);
    bubble.lineStyle(3, 0x333333, 1);
    bubble.fillRoundedRect(-130, -25, 260, 50, 12);
    bubble.strokeRoundedRect(-130, -25, 260, 50, 12);

    // 말풍선 꼬리
    bubble.fillStyle(0xffffff, 0.95);
    bubble.fillTriangle(0, 25, -10, 15, 10, 15);
    bubble.lineStyle(3, 0x333333, 1);
    bubble.lineBetween(-10, 17, 0, 28);
    bubble.lineBetween(10, 17, 0, 28);
    bubbleContainer.add(bubble);

    // 대사 텍스트
    const dialogueText = this.add.text(0, 0, '', {
      fontSize: '13px',
      fill: '#222222',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    bubbleContainer.add(dialogueText);

    // 말풍선 등장
    bubbleContainer.setScale(0);
    this.tweens.add({
      targets: bubbleContainer,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });

    // 타이핑 효과
    let charIndex = 0;
    this.time.delayedCall(200, () => {
      const typeTimer = this.time.addEvent({
        delay: 35,
        callback: () => {
          dialogueText.setText(text.substring(0, charIndex + 1));
          charIndex++;
          if (charIndex >= text.length) {
            typeTimer.destroy();
            this.time.delayedCall(1000, () => {
              this.tweens.add({
                targets: bubbleContainer,
                scale: 0,
                alpha: 0,
                duration: 200,
                onComplete: () => {
                  bubbleContainer.destroy();
                  if (callback) callback();
                }
              });
            });
          }
        },
        loop: true
      });
    });
  }

  showGearTitanIntro() {
    const { width, height } = this.cameras.main;

    // 게임 일시정지
    this.moveTimer.paused = true;

    // 화면 어둡게
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    overlay.setDepth(4999);

    // WARNING 텍스트
    const warningText = this.add.text(width / 2, height / 2 - 100, 'WARNING!', {
      fontSize: '72px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#660000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    // 카메라 쉐이크
    this.cameras.main.shake(1000, 0.03);

    // WARNING 애니메이션
    this.tweens.add({
      targets: warningText,
      alpha: 1,
      duration: 200,
      yoyo: true,
      repeat: 3,
      onComplete: () => {
        warningText.destroy();

        // 기어 타이탄 등장
        this.drawGearTitan();

        // 보스 이름 표시
        const bossNameText = this.add.text(width / 2, height / 2 - 150, 'GEAR TITAN', {
          fontSize: '64px',
          fill: '#ffcc00',
          fontStyle: 'bold',
          stroke: '#664400',
          strokeThickness: 6
        }).setOrigin(0.5).setDepth(5001).setAlpha(0);

        this.tweens.add({
          targets: bossNameText,
          alpha: 1,
          scaleX: { from: 2, to: 1 },
          scaleY: { from: 2, to: 1 },
          duration: 500,
          ease: 'Back.easeOut',
          onComplete: () => {
            // 튜토리얼 표시
            this.time.delayedCall(1000, () => {
              this.showChargeDashTutorial(() => {
                // 튜토리얼 후 게임 시작
                this.tweens.add({
                  targets: [overlay, bossNameText],
                  alpha: 0,
                  duration: 500,
                  onComplete: () => {
                    overlay.destroy();
                    bossNameText.destroy();
                    // 차지 UI 표시
                    this.showChargeUI();
                    // 첫 번째 공격 패턴 시작
                    this.gearTitanPhase = 'phase1';
                    this.moveTimer.paused = false;
                    this.time.delayedCall(2000, () => {
                      this.gearTitanPhase1Attack();
                    });
                  }
                });
              });
            });
          }
        });
      }
    });
  }

  drawGearTitan() {
    const { width, height } = this.cameras.main;
    const centerX = this.gearTitanPosition.x * this.gridSize + this.gridSize / 2;
    const centerY = this.gearTitanPosition.y * this.gridSize + this.gridSize / 2 + 60;

    // 컨테이너 생성
    this.gearTitanContainer = this.add.container(centerX, centerY);
    this.gearTitanContainer.setDepth(300);
    this.gearTitanContainer.setScale(0);

    // 외부 기어들 (4개)
    const gearRadius = this.gridSize * 2;
    const gearPositions = [
      { angle: 0, offset: gearRadius * 1.5 },
      { angle: Math.PI / 2, offset: gearRadius * 1.5 },
      { angle: Math.PI, offset: gearRadius * 1.5 },
      { angle: Math.PI * 3 / 2, offset: gearRadius * 1.5 }
    ];

    gearPositions.forEach((pos, idx) => {
      const gear = this.createGear(gearRadius * 0.8, 12, 0x888888);
      gear.x = Math.cos(pos.angle) * pos.offset;
      gear.y = Math.sin(pos.angle) * pos.offset;
      this.gearTitanContainer.add(gear);
      this.gearTitanGears.push(gear);

      // 기어 회전 애니메이션
      this.tweens.add({
        targets: gear,
        rotation: (idx % 2 === 0 ? 1 : -1) * Math.PI * 2,
        duration: 3000,
        repeat: -1,
        ease: 'Linear'
      });
    });

    // 중앙 코어 (약점)
    this.gearTitanCore = this.add.graphics();
    this.gearTitanCore.fillStyle(0x440000, 1);
    this.gearTitanCore.fillCircle(0, 0, gearRadius * 0.8);
    this.gearTitanCore.fillStyle(0xff0000, 1);
    this.gearTitanCore.fillCircle(0, 0, gearRadius * 0.5);
    // 눈 (코어 중앙)
    this.gearTitanCore.fillStyle(0x000000, 1);
    this.gearTitanCore.fillCircle(0, 0, gearRadius * 0.2);
    this.gearTitanCore.fillStyle(0xffff00, 1);
    this.gearTitanCore.fillCircle(0, -gearRadius * 0.05, gearRadius * 0.1);
    this.gearTitanContainer.add(this.gearTitanCore);

    // 등장 애니메이션
    this.tweens.add({
      targets: this.gearTitanContainer,
      scaleX: 1,
      scaleY: 1,
      duration: 1000,
      ease: 'Back.easeOut'
    });

    // 전체 컨테이너 회전 (느리게)
    this.gearTitanAnimTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        if (this.gearTitanContainer && this.gearTitanContainer.active) {
          this.gearTitanContainer.rotation += 0.005;
        }
      }
    });
  }

  createGear(radius, teethCount, color) {
    const gear = this.add.graphics();
    const outerRadius = radius;
    const innerRadius = radius * 0.7;
    const toothDepth = radius * 0.15;

    // 기어 몸체
    gear.fillStyle(color, 1);
    gear.beginPath();
    for (let i = 0; i < teethCount; i++) {
      const angle = (i / teethCount) * Math.PI * 2;
      const nextAngle = ((i + 0.5) / teethCount) * Math.PI * 2;
      const toothAngle = ((i + 0.25) / teethCount) * Math.PI * 2;
      const toothAngle2 = ((i + 0.75) / teethCount) * Math.PI * 2;

      if (i === 0) {
        gear.moveTo(Math.cos(angle) * outerRadius, Math.sin(angle) * outerRadius);
      }

      // 톱니 외곽
      gear.lineTo(Math.cos(toothAngle) * (outerRadius + toothDepth), Math.sin(toothAngle) * (outerRadius + toothDepth));
      gear.lineTo(Math.cos(nextAngle) * outerRadius, Math.sin(nextAngle) * outerRadius);
      gear.lineTo(Math.cos(toothAngle2) * innerRadius, Math.sin(toothAngle2) * innerRadius);
      gear.lineTo(Math.cos((i + 1) / teethCount * Math.PI * 2) * outerRadius, Math.sin((i + 1) / teethCount * Math.PI * 2) * outerRadius);
    }
    gear.closePath();
    gear.fill();

    // 중앙 구멍
    gear.fillStyle(0x333333, 1);
    gear.fillCircle(0, 0, radius * 0.25);

    return gear;
  }

  // =====================
  // 차지 대시 시스템
  // =====================

  showChargeDashTutorial(callback) {
    const { width, height } = this.cameras.main;

    const tutorialBg = this.add.rectangle(width / 2, height / 2 + 50, 400, 150, 0x000000, 0.8);
    tutorialBg.setDepth(5002);
    tutorialBg.setStrokeStyle(3, 0xffcc00);

    const tutorialText = this.add.text(width / 2, height / 2 + 30, 'HOLD SPACE to CHARGE\nRELEASE to DASH!', {
      fontSize: '24px',
      fill: '#ffffff',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5).setDepth(5003);

    const skipText = this.add.text(width / 2, height / 2 + 100, 'Press ENTER to continue', {
      fontSize: '16px',
      fill: '#888888'
    }).setOrigin(0.5).setDepth(5003);

    // 깜빡임 애니메이션
    this.tweens.add({
      targets: skipText,
      alpha: { from: 1, to: 0.3 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // 엔터 키 대기
    const enterHandler = this.input.keyboard.once('keydown-ENTER', () => {
      tutorialBg.destroy();
      tutorialText.destroy();
      skipText.destroy();
      if (callback) callback();
    });

    // 자동 스킵 (5초 후)
    this.time.delayedCall(5000, () => {
      if (tutorialBg.active) {
        tutorialBg.destroy();
        tutorialText.destroy();
        skipText.destroy();
        if (callback) callback();
      }
    });
  }

  showChargeUI() {
    const { width, height } = this.cameras.main;

    // 차지 게이지 배경
    this.chargeUI = this.add.container(width - 100, height - 50);
    this.chargeUI.setDepth(1000);

    const gaugeBg = this.add.rectangle(0, 0, 80, 20, 0x333333, 0.8);
    gaugeBg.setStrokeStyle(2, 0x666666);
    this.chargeUI.add(gaugeBg);

    // 차지 게이지 바
    this.chargeGaugeUI = this.add.rectangle(-38, 0, 0, 16, 0x00ff00, 1);
    this.chargeGaugeUI.setOrigin(0, 0.5);
    this.chargeUI.add(this.chargeGaugeUI);

    // 라벨
    const label = this.add.text(0, -20, 'CHARGE', {
      fontSize: '12px',
      fill: '#ffffff'
    }).setOrigin(0.5);
    this.chargeUI.add(label);

    // 쿨다운 텍스트
    this.chargeCooldownText = this.add.text(0, 20, '', {
      fontSize: '10px',
      fill: '#ffcc00'
    }).setOrigin(0.5);
    this.chargeUI.add(this.chargeCooldownText);
  }

  updateChargeUI(progress) {
    if (!this.chargeGaugeUI) return;

    const maxWidth = 76;
    this.chargeGaugeUI.width = maxWidth * progress;

    // 색상 변경 (차지 완료 시 노란색)
    if (progress >= 1) {
      this.chargeGaugeUI.fillColor = 0xffff00;
    } else {
      this.chargeGaugeUI.fillColor = 0x00ff00;
    }
  }

  handleChargeInput() {
    if (!this.canChargeDash || !this.gearTitanMode || this.gameOver) return;

    // chargeUI가 아직 생성되지 않았거나 파괴된 경우 스킵
    if (!this.chargeUI || !this.chargeUI.active) return;

    const spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const now = Date.now();

    // 쿨다운 체크
    if (now - this.lastDashTime < this.dashCooldown) {
      const remaining = Math.ceil((this.dashCooldown - (now - this.lastDashTime)) / 1000);
      if (this.chargeCooldownText && this.chargeCooldownText.active) {
        this.chargeCooldownText.setText(`CD: ${remaining}s`);
      }
      return;
    } else {
      if (this.chargeCooldownText && this.chargeCooldownText.active) {
        this.chargeCooldownText.setText('');
      }
    }

    // 차지 시작/유지
    if (spaceKey.isDown && !this.isDashing) {
      if (!this.isCharging) {
        this.startCharging();
      } else {
        this.updateCharge();
      }
    }

    // 차지 해제 (대시 실행)
    if (spaceKey.isUp && this.isCharging) {
      this.releaseCharge();
    }
  }

  startCharging() {
    this.isCharging = true;
    this.chargeStartTime = Date.now();
    this.chargeReady = false;

    // 차지 시작 효과
    if (this.chargeUI) {
      this.tweens.add({
        targets: this.chargeUI,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 100,
        yoyo: true
      });
    }

    // 에너지 모으는 이펙트 시작
    this.startChargeEnergyEffect();
  }

  // 차지 에너지 이펙트 시작
  startChargeEnergyEffect() {
    // 기존 이펙트 정리
    this.cleanupChargeEnergyEffect();

    // 에너지 파티클 생성
    this.chargeEffectParticles = [];
    const particleCount = 12;

    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const particle = {
        graphics: this.add.graphics().setDepth(98),
        angle: angle,
        radius: 60 + Phaser.Math.Between(0, 20),
        speed: 0.03 + Math.random() * 0.02,
        size: Phaser.Math.Between(3, 6),
        color: Phaser.Math.RND.pick([0x00ffff, 0x00ff88, 0xffff00, 0xff8800]),
        alpha: 0.8,
        trail: []
      };
      this.chargeEffectParticles.push(particle);
    }

    // 오라 그래픽 생성
    this.chargeAuraGraphics = this.add.graphics().setDepth(97);

    // 60fps 업데이트 타이머
    this.chargeEffectTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.updateChargeEnergyEffect()
    });
  }

  // 차지 에너지 이펙트 업데이트
  updateChargeEnergyEffect() {
    if (!this.isCharging || this.chargeEffectParticles.length === 0) {
      this.cleanupChargeEnergyEffect();
      return;
    }

    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + 60;

    const elapsed = Date.now() - this.chargeStartTime;
    const progress = Math.min(elapsed / this.chargeDuration, 1);

    // 오라 그리기
    if (this.chargeAuraGraphics && this.chargeAuraGraphics.active) {
      this.chargeAuraGraphics.clear();

      // 배경 오라 (점점 밝아짐)
      const auraAlpha = 0.1 + progress * 0.3;
      const auraSize = this.gridSize * (1 + progress * 0.5);
      this.chargeAuraGraphics.fillStyle(0x00ffff, auraAlpha);
      this.chargeAuraGraphics.fillCircle(headX, headY, auraSize);

      // 내부 글로우
      this.chargeAuraGraphics.fillStyle(0xffffff, auraAlpha * 0.5);
      this.chargeAuraGraphics.fillCircle(headX, headY, auraSize * 0.6);

      // 차지 완료 시 펄스
      if (progress >= 1) {
        const pulseSize = auraSize + Math.sin(Date.now() * 0.01) * 5;
        this.chargeAuraGraphics.lineStyle(3, 0xffff00, 0.8);
        this.chargeAuraGraphics.strokeCircle(headX, headY, pulseSize);
      }
    }

    // 파티클 업데이트
    this.chargeEffectParticles.forEach((particle, index) => {
      if (!particle.graphics || !particle.graphics.active) return;

      particle.graphics.clear();

      // 반경이 점점 줄어듦 (에너지가 모임)
      const targetRadius = 60 * (1 - progress * 0.9);
      particle.radius = Phaser.Math.Linear(particle.radius, targetRadius, 0.05);

      // 회전
      particle.angle += particle.speed * (1 + progress * 2);

      // 파티클 위치 계산
      const px = headX + Math.cos(particle.angle) * particle.radius;
      const py = headY + Math.sin(particle.angle) * particle.radius;

      // 트레일 기록
      particle.trail.push({ x: px, y: py });
      if (particle.trail.length > 8) {
        particle.trail.shift();
      }

      // 트레일 그리기
      particle.trail.forEach((point, i) => {
        const trailAlpha = (i / particle.trail.length) * particle.alpha * 0.5;
        const trailSize = particle.size * (i / particle.trail.length);
        particle.graphics.fillStyle(particle.color, trailAlpha);
        particle.graphics.fillCircle(point.x, point.y, trailSize);
      });

      // 메인 파티클 그리기
      particle.graphics.fillStyle(particle.color, particle.alpha);
      particle.graphics.fillCircle(px, py, particle.size);

      // 글로우
      particle.graphics.fillStyle(0xffffff, particle.alpha * 0.5);
      particle.graphics.fillCircle(px, py, particle.size * 0.5);

      // 차지 완료 시 전기 스파크 효과
      if (progress >= 1 && Math.random() < 0.1) {
        const sparkAngle = Math.random() * Math.PI * 2;
        const sparkDist = Phaser.Math.Between(5, 15);
        particle.graphics.lineStyle(1, 0xffff00, 0.8);
        particle.graphics.lineBetween(
          px, py,
          px + Math.cos(sparkAngle) * sparkDist,
          py + Math.sin(sparkAngle) * sparkDist
        );
      }
    });
  }

  // 차지 에너지 이펙트 정리
  cleanupChargeEnergyEffect() {
    if (this.chargeEffectTimer) {
      this.chargeEffectTimer.remove();
      this.chargeEffectTimer = null;
    }

    this.chargeEffectParticles.forEach(particle => {
      if (particle.graphics && particle.graphics.active) {
        particle.graphics.destroy();
      }
    });
    this.chargeEffectParticles = [];

    if (this.chargeAuraGraphics && this.chargeAuraGraphics.active) {
      this.chargeAuraGraphics.destroy();
      this.chargeAuraGraphics = null;
    }
  }

  updateCharge() {
    if (!this.isCharging) return;

    const elapsed = Date.now() - this.chargeStartTime;
    const progress = Math.min(elapsed / this.chargeDuration, 1);
    this.updateChargeUI(progress);

    // 차지 완료
    if (progress >= 1 && !this.chargeReady) {
      this.chargeReady = true;
      this.showChargeReadyEffect();
    }
  }

  showChargeReadyEffect() {
    const { width, height } = this.cameras.main;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + 60;

    // 카메라 펄스 효과
    this.cameras.main.flash(100, 255, 255, 0, true);

    // READY 텍스트 (뱀 머리 위)
    const readyText = this.add.text(headX, headY - 40, 'READY!', {
      fontSize: '18px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1001);

    this.tweens.add({
      targets: readyText,
      y: headY - 60,
      alpha: { from: 1, to: 0 },
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 800,
      ease: 'Power2',
      onComplete: () => readyText.destroy()
    });

    // 폭발 링 효과
    const ring = this.add.graphics().setDepth(99);
    ring.lineStyle(4, 0xffff00, 1);
    ring.strokeCircle(headX, headY, 10);

    this.tweens.add({
      targets: ring,
      scaleX: 4,
      scaleY: 4,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });

    // 에너지 방출 파티클
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const spark = this.add.graphics().setDepth(99);
      spark.fillStyle(0xffff00, 1);
      spark.fillCircle(0, 0, 4);
      spark.x = headX;
      spark.y = headY;

      this.tweens.add({
        targets: spark,
        x: headX + Math.cos(angle) * 40,
        y: headY + Math.sin(angle) * 40,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 300,
        ease: 'Power2',
        onComplete: () => spark.destroy()
      });
    }
  }

  releaseCharge() {
    if (this.chargeReady) {
      this.performChargeDash();
    }

    this.isCharging = false;
    this.chargeReady = false;
    this.updateChargeUI(0);

    // 에너지 이펙트 정리
    this.cleanupChargeEnergyEffect();
  }

  performChargeDash() {
    if (this.isDashing) return;

    this.isDashing = true;
    this.isInvincible = true;
    this.lastDashTime = Date.now();

    const head = this.snake[0];
    const dir = this.direction;
    const startPos = { x: head.x, y: head.y }; // 원래 위치 저장

    // 방향에 따른 이동 벡터
    const dirVectors = {
      'UP': { dx: 0, dy: -1 },
      'DOWN': { dx: 0, dy: 1 },
      'LEFT': { dx: -1, dy: 0 },
      'RIGHT': { dx: 1, dy: 0 }
    };

    const vec = dirVectors[dir];

    // 반대 방향 매핑
    const oppositeDir = {
      'UP': 'DOWN',
      'DOWN': 'UP',
      'LEFT': 'RIGHT',
      'RIGHT': 'LEFT'
    };

    // 보스 코어까지 충분히 뻗어나가도록 최대 스텝 결정
    const maxSteps = this.gearTitanMode && this.gearTitanPosition
      ? Math.max(this.dashDistance, Math.abs(head.x - this.gearTitanPosition.x) + Math.abs(head.y - this.gearTitanPosition.y))
      : this.dashDistance;

    // 대시 경로 계산
    const pathPositions = [];
    let maxTravel = 0;
    for (let i = 1; i <= maxSteps; i++) {
      const testX = head.x + vec.dx * i;
      const testY = head.y + vec.dy * i;

      if (testX < 0 || testX >= this.cols || testY < 0 || testY >= this.rows) {
        break;
      }

      pathPositions.push({ x: testX, y: testY });
      maxTravel = i;
    }

    if (maxTravel <= 0) {
      this.isDashing = false;
      this.isInvincible = false;
      return;
    }

    // 코어 정렬 여부와 충돌 여부
    const alignedWithCore = this.gearTitanMode && this.gearTitanPosition && (
      (vec.dx !== 0 && head.y === this.gearTitanPosition.y) ||
      (vec.dy !== 0 && head.x === this.gearTitanPosition.x)
    );

    let dashDist = maxTravel;
    let hitBoss = false;

    if (this.gearTitanMode && this.gearTitanPosition) {
      const distToCore = Math.abs(head.x - this.gearTitanPosition.x) + Math.abs(head.y - this.gearTitanPosition.y);
      if (alignedWithCore && distToCore > 0) {
        dashDist = Math.min(pathPositions.length, distToCore);
      }
      const impactPreview = pathPositions[Math.min(dashDist, pathPositions.length) - 1];
      const distAtEnd = Math.abs(impactPreview.x - this.gearTitanPosition.x) + Math.abs(impactPreview.y - this.gearTitanPosition.y);
      if (distAtEnd <= 1) {
        hitBoss = true;
      }
    }

    // 이동 중 게임 틱 잠시 멈춤
    this.moveTimer.paused = true;

    // === 역동적인 대시 돌진 애니메이션 ===
    const startPixelX = head.x * this.gridSize + this.gridSize / 2;
    const startPixelY = head.y * this.gridSize + this.gridSize / 2 + 60;
    const newHead = pathPositions[dashDist - 1];
    const endPixelX = newHead.x * this.gridSize + this.gridSize / 2;
    const endPixelY = newHead.y * this.gridSize + this.gridSize / 2 + 60;
    const returnDir = oppositeDir[dir];

    // 대시 전 준비 효과 (잠시 웅크림)
    this.showDashChargeEffect(startPixelX, startPixelY);

    // 역동적인 대시 돌진 (빠른 애니메이션으로 이동)
    this.time.delayedCall(50, () => {
      // 모션 블러 잔상 효과 (더 촘촘하게)
      pathPositions.slice(0, dashDist).forEach((pos, idx) => {
        this.createDashGhost(pos.x, pos.y, idx * 8); // 더 빠른 간격
      });

      // 스피드 라인 효과
      this.showSpeedLines(startPixelX, startPixelY, endPixelX, endPixelY, dir);

      // 카메라 쉐이크 (돌진 느낌)
      this.cameras.main.shake(80, 0.015);

      // 뱀 머리를 실제로 이동
      this.snake.unshift(newHead);
      this.snake.pop();
      this.draw();

      // 보스 충돌 판정
      if (hitBoss && this.gearTitanMode) {
        // === 보스에 강력하게 충돌! ===
        this.time.delayedCall(30, () => {
          this.performBossImpact(newHead, startPos, returnDir);
        });
      } else {
        // 보스에 닿지 않은 경우 빠르게 복귀
        this.time.delayedCall(100, () => {
          this.isDashing = false;
          this.isInvincible = false;
          this.moveTimer.paused = false;
          this.draw();
        });
      }
    });
  }

  // === 보스 충돌 처리 (역동적 임팩트) ===
  performBossImpact(impactPos, startPos, returnDir) {
    const bossPx = this.gearTitanPosition.x * this.gridSize + this.gridSize / 2;
    const bossPy = this.gearTitanPosition.y * this.gridSize + this.gridSize / 2 + 60;

    // 1. 임팩트 순간 화면 정지 효과 (히트스톱)
    this.time.timeScale = 0.1;
    this.cameras.main.flash(100, 255, 255, 255, false);

    // 2. 강력한 임팩트 이펙트
    this.showPowerfulImpactEffect(bossPx, bossPy);

    // 3. 보스 피격 반응 (아파하는 효과 + 스턴)
    this.applyBossHitReaction(bossPx, bossPy);

    // 4. 히트스톱 후 뱀 튕겨나감
    this.time.delayedCall(150, () => {
      this.time.timeScale = 1;

      // 뱀이 튕겨져 나오는 역동적 애니메이션
      this.bounceSnakeBack(impactPos, startPos, returnDir, () => {
        // 튕겨져 나온 후 바로 반대방향으로 진행 시작
        this.isDashing = false;

        if (this.gearTitanVulnerable) {
          // 보스가 vulnerable 상태면 HIT 처리
          this.handleGearTitanHit({
            skipSnakePush: true,
            bounceOverride: null, // 이미 튕겨나왔으므로 스킵
            forceDirection: returnDir,
            resumeDelay: 100 // 바로 진행
          });
        } else {
          // 스턴 상태인 보스, 뱀은 바로 진행
          this.direction = returnDir;
          this.inputQueue = [];
          this.isInvincible = false;
          this.moveTimer.paused = false;
          this.draw();
        }
      });
    });
  }

  // === 대시 차지 이펙트 (돌진 전 웅크림) ===
  showDashChargeEffect(x, y) {
    // 차지 파티클이 뱀 주위로 모임
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.add.graphics().setDepth(100);
      particle.fillStyle(0x00ffff, 0.8);
      particle.fillCircle(x + Math.cos(angle) * 30, y + Math.sin(angle) * 30, 4);

      this.tweens.add({
        targets: particle,
        x: x - particle.x,
        y: y - particle.y,
        alpha: 0,
        duration: 50,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  // === 스피드 라인 효과 ===
  showSpeedLines(startX, startY, endX, endY, dir) {
    const lineCount = 12;
    for (let i = 0; i < lineCount; i++) {
      const line = this.add.graphics().setDepth(99);
      const offset = (i - lineCount / 2) * 4;

      let lineStartX = startX;
      let lineStartY = startY;
      let lineEndX = endX;
      let lineEndY = endY;

      if (dir === 'LEFT' || dir === 'RIGHT') {
        lineStartY += offset;
        lineEndY += offset;
      } else {
        lineStartX += offset;
        lineEndX += offset;
      }

      line.lineStyle(2, Phaser.Math.RND.pick([0x00ffff, 0xffffff, 0x00ff88]), 0.8);
      line.beginPath();
      line.moveTo(lineStartX, lineStartY);
      line.lineTo(lineEndX, lineEndY);
      line.stroke();

      this.tweens.add({
        targets: line,
        alpha: 0,
        duration: 150,
        delay: i * 10,
        onComplete: () => line.destroy()
      });
    }
  }

  // === 강력한 임팩트 이펙트 ===
  showPowerfulImpactEffect(x, y) {
    // 대형 충격파 링
    for (let i = 0; i < 4; i++) {
      const ring = this.add.graphics().setDepth(5001);
      ring.lineStyle(6 - i, Phaser.Math.RND.pick([0xffff00, 0xff8800, 0xffffff]), 1);
      ring.strokeCircle(x, y, 15);

      this.tweens.add({
        targets: ring,
        scaleX: 6 + i * 2,
        scaleY: 6 + i * 2,
        alpha: 0,
        duration: 300 + i * 50,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }

    // 스파크 폭발 (더 많이)
    for (let i = 0; i < 20; i++) {
      const angle = (i / 20) * Math.PI * 2 + Math.random() * 0.3;
      const spark = this.add.graphics().setDepth(5002);
      spark.fillStyle(Phaser.Math.RND.pick([0xffff00, 0xff8800, 0xffffff, 0x00ffff]), 1);
      spark.fillCircle(0, 0, Phaser.Math.Between(4, 10));
      spark.x = x;
      spark.y = y;

      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * Phaser.Math.Between(80, 150),
        y: y + Math.sin(angle) * Phaser.Math.Between(80, 150),
        alpha: 0,
        scaleX: 0.3,
        scaleY: 0.3,
        duration: 400,
        ease: 'Power2',
        onComplete: () => spark.destroy()
      });
    }

    // "CRASH!" 텍스트
    const crashText = this.add.text(x, y - 50, 'CRASH!', {
      fontSize: '40px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#ff6600',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(5010).setScale(0);

    this.tweens.add({
      targets: crashText,
      scaleX: 1.3,
      scaleY: 1.3,
      duration: 100,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: crashText,
          y: y - 100,
          alpha: 0,
          scaleX: 0.8,
          scaleY: 0.8,
          duration: 400,
          onComplete: () => crashText.destroy()
        });
      }
    });

    // 강력한 카메라 쉐이크
    this.cameras.main.shake(300, 0.04);
  }

  // === 보스 피격 반응 (아파함 + 스턴) ===
  applyBossHitReaction(bossPx, bossPy) {
    if (!this.gearTitanContainer) return;

    // 보스 스턴 시간 설정
    this.gearTitanStunEndTime = this.time.now + 1200;

    // 1. 빨간/흰색 깜빡임 (아파하는 효과)
    let flashCount = 0;
    const flashColors = [0xff0000, 0xffffff, 0xff0000, 0xffffff, 0xff0000];
    this.time.addEvent({
      delay: 60,
      repeat: flashColors.length - 1,
      callback: () => {
        if (this.gearTitanContainer) {
          this.gearTitanContainer.iterate(child => {
            if (child.setTint) child.setTint(flashColors[flashCount]);
          });
        }
        flashCount++;
      }
    });

    // 깜빡임 후 색상 복원
    this.time.delayedCall(400, () => {
      if (this.gearTitanContainer) {
        this.gearTitanContainer.iterate(child => {
          if (child.clearTint) child.clearTint();
        });
      }
    });

    // 2. 보스가 크게 흔들림 (아파하는 느낌)
    this.tweens.add({
      targets: this.gearTitanContainer,
      x: { from: this.gearTitanContainer.x - 15, to: this.gearTitanContainer.x + 15 },
      duration: 50,
      yoyo: true,
      repeat: 6,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        if (this.gearTitanContainer) {
          this.gearTitanContainer.x = bossPx;
        }
      }
    });

    // 3. 보스 살짝 뒤로 밀림 효과
    this.tweens.add({
      targets: this.gearTitanContainer,
      scaleX: 0.85,
      scaleY: 1.1,
      duration: 100,
      yoyo: true,
      ease: 'Power2'
    });

    // 4. 스턴 별 이펙트 (머리 위에 별이 돌아감)
    this.showBossStunStars(bossPx, bossPy - 60);
  }

  // === 보스 스턴 별 이펙트 ===
  showBossStunStars(x, y) {
    const starCount = 4;
    const stars = [];

    for (let i = 0; i < starCount; i++) {
      const star = this.add.text(x, y, '★', {
        fontSize: '20px',
        fill: '#ffff00'
      }).setOrigin(0.5).setDepth(5005);
      stars.push(star);
    }

    // 별들이 원형으로 돌아감
    let angle = 0;
    const radius = 25;
    const starTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        angle += 0.1;
        stars.forEach((star, idx) => {
          const starAngle = angle + (idx / starCount) * Math.PI * 2;
          star.x = x + Math.cos(starAngle) * radius;
          star.y = y + Math.sin(starAngle) * radius * 0.5;
        });
      }
    });

    // 1초 후 별 제거
    this.time.delayedCall(1000, () => {
      starTimer.remove();
      stars.forEach(star => {
        this.tweens.add({
          targets: star,
          alpha: 0,
          scaleX: 2,
          scaleY: 2,
          duration: 200,
          onComplete: () => star.destroy()
        });
      });
    });
  }

  // === 뱀 튕겨나가기 애니메이션 ===
  bounceSnakeBack(impactPos, startPos, returnDir, onComplete) {
    const impactPx = impactPos.x * this.gridSize + this.gridSize / 2;
    const impactPy = impactPos.y * this.gridSize + this.gridSize / 2 + 60;
    const startPx = startPos.x * this.gridSize + this.gridSize / 2;
    const startPy = startPos.y * this.gridSize + this.gridSize / 2 + 60;

    // 뱀 머리를 시각적으로 튕겨나가게
    const bounceSnake = this.add.graphics().setDepth(5000);
    bounceSnake.fillStyle(0x00ff00, 1);
    bounceSnake.fillRect(-this.gridSize / 2, -this.gridSize / 2, this.gridSize - 2, this.gridSize - 2);
    bounceSnake.x = impactPx;
    bounceSnake.y = impactPy;

    // 튕겨나가는 잔상 효과
    const ghostCount = 6;
    for (let i = 0; i < ghostCount; i++) {
      const t = i / ghostCount;
      const ghostX = Phaser.Math.Linear(impactPx, startPx, t);
      const ghostY = Phaser.Math.Linear(impactPy, startPy, t);

      this.time.delayedCall(i * 25, () => {
        const ghost = this.add.graphics().setDepth(99);
        ghost.fillStyle(0x00ffff, 0.6 - t * 0.4);
        ghost.fillRect(
          ghostX - this.gridSize / 2,
          ghostY - this.gridSize / 2,
          this.gridSize - 2,
          this.gridSize - 2
        );

        this.tweens.add({
          targets: ghost,
          alpha: 0,
          duration: 200,
          onComplete: () => ghost.destroy()
        });
      });
    }

    // 뱀 머리가 빠르게 튕겨나감
    this.tweens.add({
      targets: bounceSnake,
      x: startPx,
      y: startPy,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        bounceSnake.destroy();

        // 착지 효과
        const landEffect = this.add.graphics().setDepth(98);
        landEffect.lineStyle(4, 0x00ff00, 1);
        landEffect.strokeCircle(startPx, startPy, 8);

        // 착지 먼지 파티클
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const dust = this.add.graphics().setDepth(97);
          dust.fillStyle(0xcccccc, 0.7);
          dust.fillCircle(0, 0, 3);
          dust.x = startPx;
          dust.y = startPy;

          this.tweens.add({
            targets: dust,
            x: startPx + Math.cos(angle) * 25,
            y: startPy + Math.sin(angle) * 15,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => dust.destroy()
          });
        }

        this.tweens.add({
          targets: landEffect,
          scaleX: 3,
          scaleY: 3,
          alpha: 0,
          duration: 250,
          onComplete: () => landEffect.destroy()
        });

        // 실제 뱀 위치 업데이트
        this.snake[0] = { x: startPos.x, y: startPos.y };
        this.direction = returnDir;
        this.inputQueue = [];
        this.draw();

        // 콜백 호출
        if (onComplete) onComplete();
      }
    });
  }

  // 대시 후 제자리 복귀 + 반대 방향 전환
  returnSnakeAfterDash(startPos, impactPos, newDirection) {
    const hitX = impactPos.x * this.gridSize + this.gridSize / 2;
    const hitY = impactPos.y * this.gridSize + this.gridSize / 2 + 60;

    // 충돌 효과 - 빨간 플래시
    this.cameras.main.flash(150, 255, 100, 100);
    this.cameras.main.shake(200, 0.02);

    // "BLOCKED!" 텍스트
    const blockedText = this.add.text(hitX, hitY - 40, 'BLOCKED!', {
      fontSize: '24px',
      fill: '#ff4444',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(5000);

    this.tweens.add({
      targets: blockedText,
      y: hitY - 80,
      alpha: 0,
      duration: 450,
      ease: 'Power2',
      onComplete: () => blockedText.destroy()
    });

    // 복귀 잔상 (충돌 → 시작점)
    const steps = Math.max(1, Math.abs(startPos.x - impactPos.x) + Math.abs(startPos.y - impactPos.y));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const gx = Math.round(Phaser.Math.Linear(impactPos.x, startPos.x, t));
      const gy = Math.round(Phaser.Math.Linear(impactPos.y, startPos.y, t));
      this.createDashGhost(gx, gy, i * 22);
    }

    this.time.delayedCall(120, () => {
      this.snake[0] = { x: startPos.x, y: startPos.y };
      this.direction = newDirection;
      this.inputQueue = [];

      const landX = startPos.x * this.gridSize + this.gridSize / 2;
      const landY = startPos.y * this.gridSize + this.gridSize / 2 + 60;
      const landEffect = this.add.graphics().setDepth(98);
      landEffect.lineStyle(3, 0x00ffff, 1);
      landEffect.strokeCircle(landX, landY, 5);

      this.tweens.add({
        targets: landEffect,
        scaleX: 3,
        scaleY: 3,
        alpha: 0,
        duration: 250,
        onComplete: () => landEffect.destroy()
      });

      this.draw();
    });

    this.time.delayedCall(260, () => {
      this.isInvincible = false;
      this.moveTimer.paused = false;
      this.draw();
    });
  }

  // 보스 코어 충돌 비주얼
  playGearTitanImpactEffect(impactPx, impactPy) {
    // 임팩트 링
    for (let i = 0; i < 2; i++) {
      const ring = this.add.graphics().setDepth(5001);
      ring.lineStyle(4 - i, 0xffff00, 1);
      ring.strokeCircle(impactPx, impactPy, 12 + i * 6);
      this.tweens.add({
        targets: ring,
        scaleX: 4 + i,
        scaleY: 4 + i,
        alpha: 0,
        duration: 250 + i * 80,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }

    // 스파크
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const spark = this.add.graphics().setDepth(5002);
      spark.fillStyle(Phaser.Math.RND.pick([0xffff00, 0xff8800, 0xffffff]), 1);
      spark.fillCircle(impactPx, impactPy, Phaser.Math.Between(3, 6));
      this.tweens.add({
        targets: spark,
        x: impactPx + Math.cos(angle) * Phaser.Math.Between(40, 70),
        y: impactPy + Math.sin(angle) * Phaser.Math.Between(40, 70),
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => spark.destroy()
      });
    }

    // 보스 흔들림/깜빡임
    if (this.gearTitanContainer) {
      this.tweens.add({
        targets: this.gearTitanContainer,
        angle: { from: -0.08, to: 0.08 },
        yoyo: true,
        repeat: 5,
        duration: 40
      });

      this.gearTitanContainer.iterate(child => {
        if (child.setTint) child.setTint(0xffcc00);
      });

      this.time.delayedCall(200, () => {
        this.gearTitanContainer.iterate(child => {
          if (child.clearTint) child.clearTint();
        });
      });
    }
  }

  showDashEffect(startX, startY, distance, direction) {
    const { width, height } = this.cameras.main;

    // 대시 라인 효과
    const startPixelX = startX * this.gridSize + this.gridSize / 2;
    const startPixelY = startY * this.gridSize + this.gridSize / 2 + 60;

    const dirVectors = {
      'UP': { dx: 0, dy: -1 },
      'DOWN': { dx: 0, dy: 1 },
      'LEFT': { dx: -1, dy: 0 },
      'RIGHT': { dx: 1, dy: 0 }
    };

    const vec = dirVectors[direction];
    const endPixelX = startPixelX + vec.dx * distance * this.gridSize;
    const endPixelY = startPixelY + vec.dy * distance * this.gridSize;

    // 모션 블러 라인
    const dashLine = this.add.graphics();
    dashLine.setDepth(98);
    dashLine.lineStyle(8, 0x00ffff, 0.8);
    dashLine.beginPath();
    dashLine.moveTo(startPixelX, startPixelY);
    dashLine.lineTo(endPixelX, endPixelY);
    dashLine.stroke();

    // 스파크 파티클
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const sparkX = startPixelX + (endPixelX - startPixelX) * t;
      const sparkY = startPixelY + (endPixelY - startPixelY) * t;

      const spark = this.add.graphics();
      spark.setDepth(99);
      spark.fillStyle(0x00ffff, 1);
      spark.fillCircle(sparkX + Phaser.Math.Between(-5, 5), sparkY + Phaser.Math.Between(-5, 5), 3);

      this.tweens.add({
        targets: spark,
        alpha: 0,
        scaleX: 0,
        scaleY: 0,
        duration: 300,
        delay: i * 20,
        onComplete: () => spark.destroy()
      });
    }

    // 대시 라인 페이드아웃
    this.tweens.add({
      targets: dashLine,
      alpha: 0,
      duration: 200,
      onComplete: () => dashLine.destroy()
    });

    // 카메라 쉐이크
    this.cameras.main.shake(100, 0.01);
  }

  createDashGhost(x, y, delay) {
    const pixelX = x * this.gridSize + this.gridSize / 2;
    const pixelY = y * this.gridSize + this.gridSize / 2 + 60;

    this.time.delayedCall(delay, () => {
      const ghost = this.add.graphics();
      ghost.setDepth(97);
      ghost.fillStyle(0x00ffff, 0.5);
      ghost.fillRect(
        pixelX - this.gridSize / 2,
        pixelY - this.gridSize / 2,
        this.gridSize - 2,
        this.gridSize - 2
      );

      this.tweens.add({
        targets: ghost,
        alpha: 0,
        duration: 200,
        onComplete: () => ghost.destroy()
      });
    });
  }

  checkGearTitanHit(snakeHead) {
    if (!this.gearTitanPosition) return false;

    const dist = Math.abs(snakeHead.x - this.gearTitanPosition.x) + Math.abs(snakeHead.y - this.gearTitanPosition.y);
    return dist <= 2; // 보스 근처 2칸 이내
  }

  // =====================
  // 기어 타이탄 공격 패턴
  // =====================

  gearTitanPhase1Attack() {
    if (!this.gearTitanMode || this.gameOver) return;

    const { width, height } = this.cameras.main;
    const bossPos = this.gearTitanPosition || { x: Math.floor(this.cols / 2), y: Math.floor(this.rows / 2) };

    // 경고 표시
    const warningText = this.add.text(width / 2, 100, 'SAW BARRAGE!', {
      fontSize: '32px',
      fill: '#ff4400',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5000);

    this.tweens.add({
      targets: warningText,
      alpha: { from: 1, to: 0 },
      duration: 1000,
      onComplete: () => warningText.destroy()
    });

    // 4방향에서 톱니 발사
    const cornerSpawns = [
      { x: 0, y: 0 },
      { x: this.cols - 1, y: 0 },
      { x: 0, y: this.rows - 1 },
      { x: this.cols - 1, y: this.rows - 1 }
    ];

    cornerSpawns.forEach((pos, idx) => {
      this.time.delayedCall(idx * 200, () => {
        this.fireGearTitanSaw(pos.x, pos.y);
      });
    });

    // 추가 에지 스폰 (중앙에서 빠르게)
    const edgeSpawns = [
      { x: Math.floor(this.cols / 2), y: 0 },
      { x: Math.floor(this.cols / 2), y: this.rows - 1 },
      { x: 0, y: Math.floor(this.rows / 2) },
      { x: this.cols - 1, y: Math.floor(this.rows / 2) }
    ];

    edgeSpawns.forEach((pos, idx) => {
      this.time.delayedCall(600 + idx * 160, () => {
        this.fireGearTitanSaw(pos.x, pos.y);
      });
    });

    // 플레이어를 겨냥한 추가 샷
    this.time.delayedCall(1200, () => {
      const snakeHead = this.snake[0];
      const fromLeft = snakeHead.x > bossPos.x;
      const fromTop = snakeHead.y > bossPos.y;
      const startX = fromLeft ? 0 : this.cols - 1;
      const startY = fromTop ? 0 : this.rows - 1;
      this.fireGearTitanSaw(startX, startY);
    });

    // 공격 완료 후 취약 상태
    this.time.delayedCall(4200, () => {
      this.makeGearTitanVulnerable();
    });
  }

  fireGearTitanSaw(startX, startY) {
    const pixelX = startX * this.gridSize + this.gridSize / 2;
    const pixelY = startY * this.gridSize + this.gridSize / 2 + 60;

    // 미니 톱니 생성
    const sawContainer = this.add.container(pixelX, pixelY);
    sawContainer.setDepth(250);

    const sawGraphic = this.add.graphics();
    const sawRadius = this.gridSize * 0.4;

    sawGraphic.fillStyle(0xff6600, 1);
    sawGraphic.beginPath();
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const nextAngle = ((i + 0.5) / 8) * Math.PI * 2;
      const outerR = sawRadius * 1.2;
      const innerR = sawRadius * 0.6;

      if (i === 0) {
        sawGraphic.moveTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      } else {
        sawGraphic.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      }
      sawGraphic.lineTo(Math.cos(nextAngle) * innerR, Math.sin(nextAngle) * innerR);
    }
    sawGraphic.closePath();
    sawGraphic.fill();

    sawContainer.add(sawGraphic);

    // 회전 애니메이션
    this.tweens.add({
      targets: sawGraphic,
      rotation: Math.PI * 2,
      duration: 200,
      repeat: -1,
      ease: 'Linear'
    });

    // 뱀 방향으로 이동
    const head = this.snake[0];
    const targetX = head.x * this.gridSize + this.gridSize / 2;
    const targetY = head.y * this.gridSize + this.gridSize / 2 + 60;

    this.tweens.add({
      targets: sawContainer,
      x: targetX,
      y: targetY,
      duration: 1100,
      ease: 'Quad.easeIn',
      onUpdate: () => {
        // 충돌 체크 (무적이 아닐 때만)
        if (!this.isInvincible && !this.isDashing) {
          const sawGridX = Math.floor((sawContainer.x - this.gridSize / 2) / this.gridSize);
          const sawGridY = Math.floor((sawContainer.y - this.gridSize / 2 - 60) / this.gridSize);
          const snakeHead = this.snake[0];

          if (sawGridX === snakeHead.x && sawGridY === snakeHead.y) {
            this.endGame();
          }
        }
      },
      onComplete: () => {
        sawContainer.destroy();
      }
    });
  }

  gearTitanPhase2Attack() {
    if (!this.gearTitanMode || this.gameOver) return;

    const { width, height } = this.cameras.main;

    // 경고 표시
    const warningText = this.add.text(width / 2, 100, 'GEAR LASER!', {
      fontSize: '32px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5000);

    this.tweens.add({
      targets: warningText,
      alpha: { from: 1, to: 0 },
      duration: 1000,
      onComplete: () => warningText.destroy()
    });

    // 랜덤으로 가로 또는 세로 레이저 2연타 (교차)
    const firstHorizontal = Math.random() < 0.5;
    const firstPos = firstHorizontal
      ? Phaser.Math.Between(3, this.rows - 4)
      : Phaser.Math.Between(3, this.cols - 4);

    const snakeHead = this.snake[0];
    const secondHorizontal = !firstHorizontal;
    const secondPos = secondHorizontal
      ? Phaser.Math.Clamp(snakeHead.y + Phaser.Math.Between(-1, 1), 2, this.rows - 3)
      : Phaser.Math.Clamp(snakeHead.x + Phaser.Math.Between(-1, 1), 2, this.cols - 3);

    // 첫 번째 레이저
    this.showLaserWarning(firstHorizontal, firstPos, () => {
      this.fireLaser(firstHorizontal, firstPos, () => {
        // 두 번째 (교차) 레이저
        this.time.delayedCall(300, () => {
          this.showLaserWarning(secondHorizontal, secondPos, () => {
            this.fireLaser(secondHorizontal, secondPos, () => {
              this.time.delayedCall(500, () => {
                this.makeGearTitanVulnerable();
              });
            });
          });
        });
      });
    });
  }

  showLaserWarning(isHorizontal, pos, callback) {
    const { width, height } = this.cameras.main;

    const warningLine = this.add.graphics();
    warningLine.setDepth(200);

    if (isHorizontal) {
      const y = pos * this.gridSize + this.gridSize / 2 + 60;
      warningLine.lineStyle(this.gridSize, 0xff0000, 0.3);
      warningLine.beginPath();
      warningLine.moveTo(0, y);
      warningLine.lineTo(width, y);
      warningLine.stroke();
    } else {
      const x = pos * this.gridSize + this.gridSize / 2;
      warningLine.lineStyle(this.gridSize, 0xff0000, 0.3);
      warningLine.beginPath();
      warningLine.moveTo(x, 60);
      warningLine.lineTo(x, height);
      warningLine.stroke();
    }

    // 경고선 깜빡임
    this.tweens.add({
      targets: warningLine,
      alpha: { from: 0.3, to: 0.8 },
      duration: 200,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        warningLine.destroy();
        if (callback) callback();
      }
    });
  }

  fireLaser(isHorizontal, pos, onComplete) {
    const { width, height } = this.cameras.main;

    const laser = this.add.graphics();
    laser.setDepth(250);

    // 레이저 효과
    if (isHorizontal) {
      const y = pos * this.gridSize + this.gridSize / 2 + 60;
      laser.fillStyle(0xff4400, 0.9);
      laser.fillRect(0, y - this.gridSize / 2, width, this.gridSize);
      laser.fillStyle(0xffff00, 1);
      laser.fillRect(0, y - 3, width, 6);
    } else {
      const x = pos * this.gridSize + this.gridSize / 2;
      laser.fillStyle(0xff4400, 0.9);
      laser.fillRect(x - this.gridSize / 2, 60, this.gridSize, height - 60);
      laser.fillStyle(0xffff00, 1);
      laser.fillRect(x - 3, 60, 6, height - 60);
    }

    // 충돌 체크
    if (!this.isInvincible && !this.isDashing) {
      const head = this.snake[0];
      const hit = isHorizontal ? (head.y === pos) : (head.x === pos);
      if (hit) {
        this.endGame();
      }
    }

    // 카메라 쉐이크
    this.cameras.main.shake(200, 0.02);

    // 레이저 페이드아웃
    this.tweens.add({
      targets: laser,
      alpha: 0,
      duration: 300,
      onComplete: () => {
        laser.destroy();
        // 다음 공격 준비
        if (onComplete) {
          onComplete();
        } else {
          this.time.delayedCall(800, () => {
            this.makeGearTitanVulnerable();
          });
        }
      }
    });
  }

  gearTitanPhase3Attack() {
    if (!this.gearTitanMode || this.gameOver) return;

    const { width, height } = this.cameras.main;

    // 경고 표시
    const warningText = this.add.text(width / 2, 100, 'GRIND CHARGE!', {
      fontSize: '32px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5000);

    this.tweens.add({
      targets: warningText,
      alpha: { from: 1, to: 0 },
      duration: 1000,
      onComplete: () => warningText.destroy()
    });

    // 보스가 뱀 방향으로 돌진
    const head = this.snake[0];
    const bossX = this.gearTitanPosition.x;
    const bossY = this.gearTitanPosition.y;

    // 돌진 방향 결정
    let targetX, targetY;
    if (Math.abs(head.x - bossX) > Math.abs(head.y - bossY)) {
      // 가로 방향 돌진
      targetX = head.x > bossX ? this.cols - 1 : 0;
      targetY = bossY;
    } else {
      // 세로 방향 돌진
      targetX = bossX;
      targetY = head.y > bossY ? this.rows - 1 : 0;
    }

    const startPixelX = bossX * this.gridSize + this.gridSize / 2;
    const startPixelY = bossY * this.gridSize + this.gridSize / 2 + 60;
    const endPixelX = targetX * this.gridSize + this.gridSize / 2;
    const endPixelY = targetY * this.gridSize + this.gridSize / 2 + 60;

    // 경고선 표시
    const chargeLine = this.add.graphics();
    chargeLine.setDepth(199);
    chargeLine.lineStyle(this.gridSize * 2, 0xff0000, 0.3);
    chargeLine.beginPath();
    chargeLine.moveTo(startPixelX, startPixelY);
    chargeLine.lineTo(endPixelX, endPixelY);
    chargeLine.stroke();

    // 경고선 깜빡임
    this.tweens.add({
      targets: chargeLine,
      alpha: { from: 0.3, to: 0.6 },
      duration: 200,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        chargeLine.destroy();

        // 돌진 실행
        if (this.gearTitanContainer) {
          this.tweens.add({
            targets: this.gearTitanContainer,
            x: endPixelX,
            y: endPixelY,
            duration: 380,
            ease: 'Power2',
            onUpdate: () => {
              // 충돌 체크
              if (!this.isInvincible && !this.isDashing && this.gearTitanContainer) {
                const bossGridX = Math.floor((this.gearTitanContainer.x - this.gridSize / 2) / this.gridSize);
                const bossGridY = Math.floor((this.gearTitanContainer.y - this.gridSize / 2 - 60) / this.gridSize);
                const snakeHead = this.snake[0];

                if (Math.abs(bossGridX - snakeHead.x) <= 1 && Math.abs(bossGridY - snakeHead.y) <= 1) {
                  this.endGame();
                }
              }
            },
            onComplete: () => {
              // 보스 위치 업데이트
              this.gearTitanPosition = { x: targetX, y: targetY };

              // 돌진 직후 추가 압박 (보스 위치에서 사출)
              this.time.delayedCall(150, () => {
                this.fireGearTitanSaw(this.gearTitanPosition.x, this.gearTitanPosition.y);
              });

              // 벽에 부딪혀서 스턴 (취약 상태)
              this.cameras.main.shake(300, 0.03);
              this.makeGearTitanVulnerable();
            }
          });
        }
      }
    });
  }

  makeGearTitanVulnerable() {
    if (!this.gearTitanMode) return;

    this.gearTitanVulnerable = true;
    this.gearTitanPhase = 'vulnerable';

    const { width, height } = this.cameras.main;

    // HIT ME! 텍스트
    const hitMeText = this.add.text(width / 2, 100, 'HIT ME!', {
      fontSize: '48px',
      fill: '#00ff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5000);

    this.tweens.add({
      targets: hitMeText,
      alpha: { from: 1, to: 0.5 },
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 300,
      yoyo: true,
      repeat: -1
    });

    // 코어 색상 변경 (초록색)
    if (this.gearTitanCore) {
      this.gearTitanCore.clear();
      this.gearTitanCore.fillStyle(0x004400, 1);
      this.gearTitanCore.fillCircle(0, 0, this.gridSize * 2 * 0.8);
      this.gearTitanCore.fillStyle(0x00ff00, 1);
      this.gearTitanCore.fillCircle(0, 0, this.gridSize * 2 * 0.5);
      this.gearTitanCore.fillStyle(0x000000, 1);
      this.gearTitanCore.fillCircle(0, 0, this.gridSize * 2 * 0.2);
      this.gearTitanCore.fillStyle(0xffffff, 1);
      this.gearTitanCore.fillCircle(0, -this.gridSize * 2 * 0.05, this.gridSize * 2 * 0.1);
    }

    // 짧은 취약 창 (더 어려운 난이도)
    this.time.delayedCall(1800, () => {
      if (hitMeText.active) hitMeText.destroy();

      if (this.gearTitanMode && !this.gameOver) {
        this.gearTitanVulnerable = false;

        // 코어 색상 복원 (빨간색)
        if (this.gearTitanCore) {
          this.gearTitanCore.clear();
          this.gearTitanCore.fillStyle(0x440000, 1);
          this.gearTitanCore.fillCircle(0, 0, this.gridSize * 2 * 0.8);
          this.gearTitanCore.fillStyle(0xff0000, 1);
          this.gearTitanCore.fillCircle(0, 0, this.gridSize * 2 * 0.5);
          this.gearTitanCore.fillStyle(0x000000, 1);
          this.gearTitanCore.fillCircle(0, 0, this.gridSize * 2 * 0.2);
          this.gearTitanCore.fillStyle(0xffff00, 1);
          this.gearTitanCore.fillCircle(0, -this.gridSize * 2 * 0.05, this.gridSize * 2 * 0.1);
        }

        // 다음 공격 패턴
        this.advanceGearTitanPhase();
      }
    });
  }

  advanceGearTitanPhase() {
    if (this.gearTitanStunEndTime && this.time.now < this.gearTitanStunEndTime) {
      const remaining = this.gearTitanStunEndTime - this.time.now;
      this.time.delayedCall(remaining, () => {
        this.gearTitanStunEndTime = 0;
        this.advanceGearTitanPhase();
      });
      return;
    }

    const hitCount = this.gearTitanHitCount;
    const hitsNeeded = this.gearTitanHitsToKill || 4;
    const enrageThreshold = Math.max(2, hitsNeeded - 2);

    // 광폭화 체크 (HP 25% 이하)
    if (hitCount >= enrageThreshold && this.gearTitanPhase !== 'enrage') {
      this.gearTitanEnrageMode();
      return;
    }

    // 패턴 순환
    const patterns = ['phase1', 'phase2', 'phase3'];
    const currentIdx = patterns.indexOf(this.gearTitanPhase);
    const nextIdx = (currentIdx + 1) % patterns.length;
    this.gearTitanPhase = patterns[nextIdx];

    this.time.delayedCall(700, () => {
      switch (this.gearTitanPhase) {
        case 'phase1':
          this.gearTitanPhase1Attack();
          break;
        case 'phase2':
          this.gearTitanPhase2Attack();
          break;
        case 'phase3':
          this.gearTitanPhase3Attack();
          break;
      }
    });
  }

  gearTitanEnrageMode() {
    if (!this.gearTitanMode) return;

    this.gearTitanPhase = 'enrage';

    const { width, height } = this.cameras.main;

    // ENRAGE 텍스트
    const enrageText = this.add.text(width / 2, height / 2, 'ENRAGE!', {
      fontSize: '72px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#660000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    // 카메라 쉐이크
    this.cameras.main.shake(1000, 0.04);

    // 보스 빨간색 틴트
    if (this.gearTitanContainer) {
      this.gearTitanGears.forEach(gear => {
        gear.clear();
        gear.fillStyle(0xff4400, 1);
        // 기어 다시 그리기 (빨간색)
        const radius = this.gridSize * 2 * 0.8;
        gear.beginPath();
        for (let i = 0; i < 12; i++) {
          const angle = (i / 12) * Math.PI * 2;
          const nextAngle = ((i + 0.5) / 12) * Math.PI * 2;
          const outerR = radius;
          const innerR = radius * 0.7;

          if (i === 0) {
            gear.moveTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
          }
          gear.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
          gear.lineTo(Math.cos(nextAngle) * innerR, Math.sin(nextAngle) * innerR);
        }
        gear.closePath();
        gear.fill();
      });
    }

    this.tweens.add({
      targets: enrageText,
      alpha: 1,
      scaleX: { from: 2, to: 1 },
      scaleY: { from: 2, to: 1 },
      duration: 500,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.time.delayedCall(1000, () => {
          enrageText.destroy();

          // 광폭화 공격 (모든 패턴 동시)
          this.gearTitanPhase1Attack();
          this.time.delayedCall(500, () => this.gearTitanPhase2Attack());
          this.time.delayedCall(900, () => this.gearTitanPhase3Attack());
        });
      }
    });
  }

  // =====================
  // 기어 타이탄 HIT/승리 처리
  // =====================

  handleGearTitanHit(options = {}) {
    if (!this.gearTitanVulnerable) return;

    this.gearTitanHitCount++;
    this.gearTitanVulnerable = false;
    const hitsNeeded = this.gearTitanHitsToKill || 4;
    const { skipSnakePush = false, bounceOverride = null, forceDirection = null, resumeDelay = 800 } = options;

    // 히트 후 일시적 무적 (보스 충돌 무시)
    this.isInvincible = true;
    this.moveTimer.paused = true;

    const { width, height } = this.cameras.main;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + 60;
    const bossX = this.gearTitanPosition.x * this.gridSize + this.gridSize / 2;
    const bossY = this.gearTitanPosition.y * this.gridSize + this.gridSize / 2 + 60;

    // === 통쾌한 히트 애니메이션 ===

    // 1. 슬로우 모션 효과 (잠깐)
    this.cameras.main.flash(200, 0, 255, 100, false);

    // 2. 임팩트 링 효과
    for (let i = 0; i < 3; i++) {
      const ring = this.add.graphics().setDepth(5002);
      ring.lineStyle(4 - i, 0x00ffff, 1);
      ring.strokeCircle(bossX, bossY, 10);

      this.tweens.add({
        targets: ring,
        scaleX: 4 + i * 2,
        scaleY: 4 + i * 2,
        alpha: 0,
        duration: 400,
        delay: i * 100,
        onComplete: () => ring.destroy()
      });
    }

    // 3. 스파크 폭발
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const spark = this.add.graphics().setDepth(5003);
      spark.fillStyle(Phaser.Math.RND.pick([0x00ffff, 0x00ff00, 0xffff00]), 1);
      spark.fillCircle(0, 0, Phaser.Math.Between(4, 8));
      spark.x = bossX;
      spark.y = bossY;

      this.tweens.add({
        targets: spark,
        x: bossX + Math.cos(angle) * Phaser.Math.Between(60, 120),
        y: bossY + Math.sin(angle) * Phaser.Math.Between(60, 120),
        alpha: 0,
        duration: 500,
        ease: 'Power2',
        onComplete: () => spark.destroy()
      });
    }

    // 4. HIT 텍스트 (더 역동적으로)
    const hitText = this.add.text(width / 2, height / 2, `CRITICAL HIT!`, {
      fontSize: '56px',
      fill: '#00ffff',
      fontStyle: 'bold',
      stroke: '#004466',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5010).setAlpha(0).setScale(3);

    this.tweens.add({
      targets: hitText,
      alpha: 1,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        // HIT 카운트 표시
        const countText = this.add.text(width / 2, height / 2 + 50, `${this.gearTitanHitCount}/${hitsNeeded}`, {
          fontSize: '36px',
          fill: '#ffcc00',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(5010);

        this.tweens.add({
          targets: [hitText, countText],
          alpha: 0,
          y: '-=30',
          duration: 800,
          delay: 500,
          onComplete: () => {
            hitText.destroy();
            countText.destroy();
          }
        });
      }
    });

    // 5. 카메라 쉐이크 (강력하게)
    this.cameras.main.shake(400, 0.05);

    // 6. 보스 피격 효과 (빨간 플래시 + 밀려남)
    if (this.gearTitanContainer) {
      // 빨간색으로 깜빡
      this.gearTitanContainer.iterate(child => {
        if (child.setTint) child.setTint(0xff0000);
      });

      this.tweens.add({
        targets: this.gearTitanContainer,
        alpha: { from: 1, to: 0.2 },
        duration: 80,
        yoyo: true,
        repeat: 5,
        onComplete: () => {
          this.gearTitanContainer.iterate(child => {
            if (child.clearTint) child.clearTint();
          });
        }
      });
    }

    // 7. 뱀을 보스로부터 밀어내기 (대시 전용일 땐 스킵)
    if (!skipSnakePush) {
      const pushDir = {
        x: head.x - this.gearTitanPosition.x,
        y: head.y - this.gearTitanPosition.y
      };
      const pushDist = Math.sqrt(pushDir.x * pushDir.x + pushDir.y * pushDir.y);
      if (pushDist > 0) {
        pushDir.x /= pushDist;
        pushDir.y /= pushDist;
      } else {
        pushDir.x = 1;
        pushDir.y = 0;
      }

      // 뱀을 4칸 밀어냄
      const newX = Math.max(0, Math.min(this.cols - 1, Math.round(head.x + pushDir.x * 4)));
      const newY = Math.max(0, Math.min(this.rows - 1, Math.round(head.y + pushDir.y * 4)));
      this.snake[0] = { x: newX, y: newY };

      // 8. 방향을 돌진 반대 방향으로 변경
      const oppositeDirections = {
        'RIGHT': 'LEFT',
        'LEFT': 'RIGHT',
        'UP': 'DOWN',
        'DOWN': 'UP'
      };
      this.direction = oppositeDirections[this.direction] || this.direction;
      this.inputQueue = []; // 입력 큐 초기화
    } else {
      // 대시 전용: 제자리 복귀 + 반대 방향 전환
      if (bounceOverride) {
        this.snake[0] = { x: bounceOverride.x, y: bounceOverride.y };
      }
      if (forceDirection) {
        this.direction = forceDirection;
      }
      this.inputQueue = [];

      // 복귀 잔상
      if (bounceOverride) {
        const steps = Math.max(1, Math.abs(head.x - bounceOverride.x) + Math.abs(head.y - bounceOverride.y));
        for (let i = 0; i <= steps; i++) {
          const t = i / steps;
          const gx = Math.round(Phaser.Math.Linear(head.x, bounceOverride.x, t));
          const gy = Math.round(Phaser.Math.Linear(head.y, bounceOverride.y, t));
          this.createDashGhost(gx, gy, i * 18);
        }

        const landX = bounceOverride.x * this.gridSize + this.gridSize / 2;
        const landY = bounceOverride.y * this.gridSize + this.gridSize / 2 + 60;
        const landEffect = this.add.graphics().setDepth(98);
        landEffect.lineStyle(3, 0x00ffff, 1);
        landEffect.strokeCircle(landX, landY, 5);
        this.tweens.add({
          targets: landEffect,
          scaleX: 3,
          scaleY: 3,
          alpha: 0,
          duration: 250,
          onComplete: () => landEffect.destroy()
        });
      }
      this.draw();
    }

    // 9. 무적 해제 및 게임 재개
    this.time.delayedCall(resumeDelay, () => {
      this.isInvincible = false;

      // 4 HIT 시 승리
      if (this.gearTitanHitCount >= hitsNeeded) {
        this.showGearTitanVictory();
      } else {
        // 게임 재개
        this.moveTimer.paused = false;
        // 다음 공격 패턴
        this.time.delayedCall(500, () => {
          this.advanceGearTitanPhase();
        });
      }
    });
  }

  showGearTitanVictory() {
    this.gearTitanPhase = 'victory';

    const { width, height } = this.cameras.main;

    // 보스 폭발 효과
    if (this.gearTitanContainer) {
      // 기어들이 분해되어 날아감
      this.gearTitanGears.forEach((gear, idx) => {
        const angle = (idx / 4) * Math.PI * 2;
        this.tweens.add({
          targets: gear,
          x: gear.x + Math.cos(angle) * 200,
          y: gear.y + Math.sin(angle) * 200,
          alpha: 0,
          rotation: Math.PI * 4,
          duration: 1000,
          ease: 'Power2'
        });
      });

      // 코어 폭발
      this.time.delayedCall(500, () => {
        const explosionX = this.gearTitanContainer.x;
        const explosionY = this.gearTitanContainer.y;

        // 폭발 파티클
        for (let i = 0; i < 20; i++) {
          const particle = this.add.graphics();
          particle.setDepth(400);
          particle.fillStyle(Phaser.Math.RND.pick([0xff0000, 0xff6600, 0xffff00]), 1);
          particle.fillCircle(explosionX, explosionY, Phaser.Math.Between(5, 15));

          const angle = (i / 20) * Math.PI * 2;
          const dist = Phaser.Math.Between(50, 150);

          this.tweens.add({
            targets: particle,
            x: explosionX + Math.cos(angle) * dist,
            y: explosionY + Math.sin(angle) * dist,
            alpha: 0,
            duration: 800,
            onComplete: () => particle.destroy()
          });
        }

        // 화면 플래시
        const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffffff, 1);
        flash.setDepth(5000);
        this.tweens.add({
          targets: flash,
          alpha: 0,
          duration: 500,
          onComplete: () => flash.destroy()
        });

        // 컨테이너 제거
        this.gearTitanContainer.destroy();
        this.gearTitanContainer = null;
      });
    }

    // BOSS CLEAR 텍스트
    this.time.delayedCall(1500, () => {
      const clearText = this.add.text(width / 2, height / 2 - 50, 'BOSS CLEAR!', {
        fontSize: '72px',
        fill: '#00ff00',
        fontStyle: 'bold',
        stroke: '#004400',
        strokeThickness: 8
      }).setOrigin(0.5).setDepth(5001).setAlpha(0);

      this.tweens.add({
        targets: clearText,
        alpha: 1,
        scaleX: { from: 2, to: 1 },
        scaleY: { from: 2, to: 1 },
        duration: 500,
        ease: 'Back.easeOut'
      });

      // +1000 BONUS
      this.time.delayedCall(500, () => {
        const bonusText = this.add.text(width / 2, height / 2 + 50, '+1000 BONUS!', {
          fontSize: '48px',
          fill: '#ffcc00',
          fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(5001).setAlpha(0);

        this.tweens.add({
          targets: bonusText,
          alpha: 1,
          y: height / 2 + 30,
          duration: 500,
          onComplete: () => {
            // 점수 추가
            this.score += 1000;
            this.scoreText.setText(this.score.toString());

            // 정리 및 다음 단계
            this.time.delayedCall(2000, () => {
              clearText.destroy();
              bonusText.destroy();

              // 콤보 복원
              this.combo = this.savedCombo;
              this.comboShieldCount = this.savedComboShieldCount;
              if (this.combo > 0) {
                this.comboText.setText(`x${this.combo}`);
              }

              // 보스 모드 종료
              this.gearTitanMode = false;
              this.gearTitanPhase = 'none';
              this.bossMode = false;
              this.isBossStage = false;
              this.canChargeDash = false;
              this.cleanupChargeUI();

              // 상점 오픈 (뱀 점프 애니메이션 포함)
              this.stageClear();
            });
          }
        });
      });
    });
  }

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

    // 3개의 데드존 위치 찾기
    const deadZonePositions = [];
    for (let i = 0; i < 3; i++) {
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

  // 모든 데드존을 파괴 애니메이션과 함께 제거 (탄막보스 시작 시)
  destroyAllDeadZonesWithAnimation() {
    if (!this.deadZones || this.deadZones.length === 0) return;

    const { width, height } = this.cameras.main;

    // 각 데드존에 파괴 애니메이션 적용
    this.deadZones.forEach((dz, index) => {
      if (!dz.rect) return;

      const dzX = dz.x * this.gridSize + this.gridSize / 2;
      const dzY = this.gameAreaY + dz.y * this.gridSize + this.gridSize / 2;

      // 약간의 딜레이를 두고 순차적으로 파괴
      this.time.delayedCall(index * 80, () => {
        // 1. 빨간 플래시
        this.tweens.add({
          targets: dz.rect,
          fillColor: { from: 0x000000, to: 0xff0000 },
          duration: 100,
          yoyo: true,
          repeat: 2
        });

        // 2. 파괴 파티클 (빨간색 + 검은색 조각들)
        this.time.delayedCall(300, () => {
          // 파편 파티클
          for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const speed = 60 + Math.random() * 40;
            const particle = this.add.rectangle(
              dzX, dzY,
              6 + Math.random() * 4,
              6 + Math.random() * 4,
              i % 2 === 0 ? 0xff0000 : 0x000000
            ).setDepth(2000);

            this.tweens.add({
              targets: particle,
              x: dzX + Math.cos(angle) * speed,
              y: dzY + Math.sin(angle) * speed,
              alpha: 0,
              rotation: Math.random() * Math.PI * 2,
              scale: 0,
              duration: 400,
              ease: 'Power2',
              onComplete: () => particle.destroy()
            });
          }

          // 충격파 링
          const shockwave = this.add.circle(dzX, dzY, 5, 0xff0000, 0.8)
            .setDepth(1999).setStrokeStyle(2, 0xffff00);
          this.tweens.add({
            targets: shockwave,
            radius: 30,
            alpha: 0,
            duration: 300,
            ease: 'Power2',
            onComplete: () => shockwave.destroy()
          });

          // 데드존 rect 제거
          if (dz.rect) {
            this.tweens.add({
              targets: dz.rect,
              alpha: 0,
              scaleX: 0,
              scaleY: 0,
              duration: 200,
              onComplete: () => {
                dz.rect.destroy();
                dz.rect = null;
              }
            });
          }
        });
      });
    });

    // 모든 애니메이션 완료 후 배열 비우기
    const totalDelay = this.deadZones.length * 80 + 600;
    this.time.delayedCall(totalDelay, () => {
      this.deadZones = [];
    });
  }

  draw() {
    // 이전 프레임 지우기
    if (this.graphics) {
      this.graphics.clear();
      // 그래픽이 숨겨져 있으면 다시 보이게 (hideSnakeGraphics 후 복구)
      if (!this.graphics.visible) {
        this.graphics.setVisible(true);
      }
    } else {
      this.graphics = this.add.graphics();
    }

    // 무적 깜빡임 중이면 일부 프레임에서 뱀 그리기 스킵
    const skipSnakeDraw = this.invincibilityBlinkActive && this.invincibilityBlinkCount % 2 === 1;

    // 뱀 그리기 (무적 깜빡임 중에는 스킵)
    if (!skipSnakeDraw) {
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
    }

    // 스피드 부스트 궤도는 별도 타이머에서 업데이트 (60fps 부드러운 애니메이션)

    // 먹이 그리기 (보스 요소가 있으면 건너뛰기)
    if (!this.bossElement && !this.fogBossMode) {
      const isFinalFood = this.foodCount === 19; // 다음 먹이가 20번째 (마지막)
      this.graphics.fillStyle(isFinalFood ? 0x00ff00 : 0xff0000);
      this.graphics.fillCircle(
        this.food.x * this.gridSize + this.gridSize / 2,
        this.food.y * this.gridSize + this.gridSize / 2 + this.gameAreaY,
        this.gridSize / 2 - 2
      );
    }

    this.updateFogOfWar();
  }

  shouldUseFog() {
    // World 2 (Stage 7-9)에서만 안개 활성화
    return this.fogTestForceEnable || shouldHaveFog(this.currentStage);
  }

  isFogOfWarActive() {
    if (this.gameOver) return false;
    return this.shouldUseFog() && this.fogEnabled;
  }

  ensureFogAssets() {
    if (!this.fogRenderTexture) {
      const { width, height } = this.cameras.main;
      this.fogRenderTexture = this.add.renderTexture(0, 0, width, height);
      this.fogRenderTexture.setOrigin(0, 0);
      this.fogRenderTexture.setDepth(1200); // 게임 오브젝트 위, UI 아래
      this.fogRenderTexture.setScrollFactor(0);
    }

    if (!this.fogLightSprite) {
      const lightRadius = this.gridSize * this.fogVisibleTiles;
      const textureSize = Math.ceil(lightRadius * 2);
      const textureKey = `${this.fogLightTextureKey}_v2`;

      if (!this.textures.exists(textureKey)) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        const steps = 12;
        for (let i = 0; i < steps; i++) {
          const t = i / (steps - 1);
          const alpha = Math.pow(t, 1.8); // 중심부는 밝게, 바깥은 급격히 어둡게
          const radius = lightRadius * (1 - 0.85 * t);
          g.fillStyle(0xffffff, alpha);
          g.fillCircle(lightRadius, lightRadius, radius);
        }
        // 완전한 밝기의 작은 코어로 토치 느낌 강화
        g.fillStyle(0xffffff, 1);
        g.fillCircle(lightRadius, lightRadius, lightRadius * 0.14);
        g.generateTexture(textureKey, textureSize, textureSize);
        g.destroy();
      }

      this.fogLightSprite = this.add.image(0, 0, textureKey);
      this.fogLightSprite.setOrigin(0.5);
      this.fogLightSprite.setVisible(false); // renderTexture.erase에서만 사용
    }
  }

  resetFogOfWar() {
    this.fogFlashEndTime = 0;
    this.fogLastRenderKey = null;
    if (this.fogRenderTexture) {
      this.fogRenderTexture.clear();
      this.fogRenderTexture.setVisible(false);
    }
  }

  triggerFogFlash() {
    if (!this.isFogOfWarActive()) return;
    this.fogFlashEndTime = this.time.now + this.fogFlashDuration;
  }

  startFogIntroIfNeeded() {
    if (this.fogIntroShown || this.fogIntroPlaying || !this.shouldUseFog()) {
      this.fogEnabled = this.shouldUseFog();
      if (this.fogEnabled) {
        this.draw(); // 뱀이 안보이는 버그 수정 - fog 활성화 후 다시 그리기
      }
      return;
    }

    this.fogEnabled = false;
    this.fogIntroPlaying = true;
    if (this.moveTimer) {
      this.moveTimer.paused = true;
    }
    this.resetFogOfWar();

    this.destroyAllSaws();

    const { width, height } = this.cameras.main;
    const flickerOverlayDepth = 6000;
    const introDialogueDepth = 6200;
    const flickerOverlay = this.add.rectangle(
      0,
      0,
      width,
      height,
      0x000000,
      0
    ).setOrigin(0, 0).setDepth(flickerOverlayDepth).setScrollFactor(0).setVisible(true);

    const flickerSteps = [
      { alpha: 1.0, duration: 140 },
      { alpha: 0.55, duration: 140 },
      { alpha: 1.0, duration: 140 },
      { alpha: 0.45, duration: 140 },
      { alpha: 1.0, duration: 160 }
    ];

    const applyOverlayAlpha = (a) => {
      flickerOverlay.setVisible(true);
      flickerOverlay.setFillStyle(0x000000, a);
      flickerOverlay.setAlpha(a);
    };

    const showExclaim = () => {
      const head = this.snake[0];
      if (!head) return;
      const headX = head.x * this.gridSize + this.gridSize / 2;
      const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY - this.gridSize * 1.2;
      const mark = this.add.text(headX, headY, '!', {
        fontSize: '26px',
        fontStyle: 'bold',
        fill: '#ffcc00',
        stroke: '#000000',
        strokeThickness: 3
      }).setOrigin(0.5).setDepth(introDialogueDepth);
      mark.setScale(0);
      this.tweens.add({
        targets: mark,
        scale: 1.2,
        alpha: 1,
        duration: 150,
        ease: 'Back.easeOut',
        yoyo: true,
        hold: 80,
        onComplete: () => mark.destroy()
      });
    };

    const playSpark = (power = 1) => {
      const head = this.snake[0];
      if (!head) return;
      const headX = head.x * this.gridSize + this.gridSize / 2;
      const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
      const jitter = this.gridSize * 0.15;
      const spark = this.add.circle(
        headX + Phaser.Math.FloatBetween(-jitter, jitter),
        headY - this.gridSize * 0.4 + Phaser.Math.FloatBetween(-jitter, jitter),
        this.gridSize * 0.18 * (1 + power * 0.6),
        0xffcc55,
        1
      ).setDepth(introDialogueDepth + 1);
      spark.setStrokeStyle(2, 0xff8800, 0.9);
      this.tweens.add({
        targets: spark,
        scale: 1.4 + power * 0.4,
        alpha: 0,
        duration: 160 + power * 80,
        ease: 'Cubic.easeOut',
        onComplete: () => spark.destroy()
      });
    };

    const playFlicker = (idx = 0) => {
      if (idx >= flickerSteps.length) {
        // 완전 어둠 유지
        applyOverlayAlpha(1);
        // 호기심 대사 (보스 말풍선이 아닌 뱀 말풍선 스타일)
        const head = this.snake[0];
        const headX = head.x * this.gridSize + this.gridSize / 2;
        const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
        this.showSnakeStyleDialogue('What the...?', () => {
          // 횃불 점화 시도 2회 후 성공
          const tryIgnite = attempt => {
            if (attempt < 2) {
              playSpark(0.4);
              this.tweens.add({
                targets: flickerOverlay,
                alpha: 0.7,
                duration: 130,
                yoyo: true,
                ease: 'Sine.easeInOut'
              });
              this.time.delayedCall(260, () => tryIgnite(attempt + 1));
            } else {
              // 마지막 점화 성공
              playSpark(1.2);
              this.triggerFogFlash();
              this.fogEnabled = true;
              this.fogLastRenderKey = null;
              this.updateFogOfWar();
              this.tweens.add({
                targets: flickerOverlay,
                alpha: 0,
                duration: 240,
                ease: 'Sine.easeOut',
                onComplete: () => flickerOverlay.destroy()
              });
              // 잠시 멈칫 후 시작 대사
              this.time.delayedCall(420, () => {
                this.showSnakeStyleDialogue("Okay... let's give this a shot!", () => {
                  this.fogIntroPlaying = false;
                  this.fogIntroShown = true;
                  if (this.moveTimer) {
                    this.moveTimer.paused = false;
                  }
                  this.draw(); // 뱀이 안보이는 버그 수정 - fog 활성화 후 다시 그리기
                }, { x: headX, y: headY - this.gridSize * 1.8, depth: introDialogueDepth, fontSize: '14px' });
              }, null, this);
            }
          };
          tryIgnite(0);
        }, { x: headX, y: headY - this.gridSize * 1.8, depth: introDialogueDepth, fontSize: '14px' });
        return;
      }

      if (idx === 0) {
        applyOverlayAlpha(1);
        showExclaim();
      }

      const step = flickerSteps[idx];
      applyOverlayAlpha(step.alpha);
      this.time.delayedCall(step.duration, () => playFlicker(idx + 1));
    };

    // 바로 깜빡임 시작
    playFlicker(0);
  }

  updateFogOfWar() {
    if (!this.isFogOfWarActive()) {
      if (this.fogRenderTexture) {
        this.fogRenderTexture.setVisible(false);
      }
      return;
    }

    if (!this.snake || this.snake.length === 0) return;

    this.ensureFogAssets();

    const head = this.snake[0];
    const headPixelX = head.x * this.gridSize + this.gridSize / 2;
    const headPixelY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
    const { width, height } = this.cameras.main;
    const fogHeight = Math.max(0, height - this.gameAreaY - this.bottomUIHeight);

    let alpha = this.fogBaseAlpha;
    let scale = 1;

    if (this.fogFlashEndTime > this.time.now) {
      const remaining = this.fogFlashEndTime - this.time.now;
      const t = 1 - remaining / this.fogFlashDuration;
      const eased = Phaser.Math.Easing.Quadratic.InOut(Phaser.Math.Clamp(t, 0, 1));
      alpha = Phaser.Math.Linear(this.fogFlashAlpha, this.fogBaseAlpha, eased);
      scale = Phaser.Math.Linear(1.25, 1, eased);
    }

    const renderKey = `${head.x},${head.y},${alpha.toFixed(3)},${scale.toFixed(2)}`;
    if (this.fogLastRenderKey === renderKey) {
      this.fogRenderTexture.setVisible(true);
      return;
    }
    this.fogLastRenderKey = renderKey;

    this.fogRenderTexture.clear();
    this.fogRenderTexture.fill(0x000000, alpha, 0, this.gameAreaY, width, fogHeight);

    this.fogLightSprite.setScale(scale);
    this.fogRenderTexture.erase(this.fogLightSprite, headPixelX, headPixelY);
    this.fogRenderTexture.setVisible(true);
  }

  endGame() {
    if (this.gameOver) return; // 중복 호출 방지

    // 부활 가능 여부 먼저 체크
    if (this.canRevive()) {
      this.gameOver = true; // 임시로 설정 (부활 시 false로 되돌림)
      this.moveTimer.paused = true; // 일시정지
      this.showReviveSequence();
      return;
    }

    // 부활 불가 - 부활 실패 애니메이션 후 게임오버
    this.gameOver = true;
    this.moveTimer.paused = true;
    this.showReviveFailedSequence();
  }

  // 부활 가능 여부 체크
  canRevive() {
    if (this.isReviving) return false; // 이미 부활 처리 중
    const totalAssets = this.money + this.score;
    return totalAssets >= this.reviveCost;
  }

  // 기존 게임오버 처리 (부활 실패 후 또는 직접 호출)
  showGameOverScreen() {
    this.moveTimer.remove();

    this.resetFogOfWar();

    this.destroyAllSaws();

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

  // ========== 부활 시스템 ==========

  // 부활 성공 애니메이션
  showReviveSequence() {
    this.isReviving = true;
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    const totalAssets = this.money + this.score;

    // Phase 1: 슬로우모션 + 어둡게
    this.time.timeScale = 0.3;

    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(1000);
    this.reviveElements.push(overlay);

    this.tweens.add({
      targets: overlay,
      alpha: 0.6,
      duration: 100,
      onComplete: () => {
        // Phase 2: 코인 차감 애니메이션 (빠르게)
        this.showReviveCoinAnimation(centerX, centerY, totalAssets);
      }
    });
  }

  // 코인 차감 애니메이션 (빠른 버전)
  showReviveCoinAnimation(centerX, centerY, totalAssets) {
    const remaining = totalAssets - this.reviveCost;

    // 코인 아이콘 (원형)
    const coinBg = this.add.circle(centerX, centerY - 40, 40, 0xffd700)
      .setDepth(1001);
    const coinSymbol = this.add.text(centerX, centerY - 40, '$', {
      fontSize: '36px',
      fill: '#8B4513',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1002);
    this.reviveElements.push(coinBg, coinSymbol);

    // 현재 자산 → 남은 자산 표시
    const assetText = this.add.text(centerX, centerY + 20, `$${totalAssets}`, {
      fontSize: '48px',
      fill: '#00ff88',
      fontStyle: 'bold',
      stroke: '#004422',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1001);
    this.reviveElements.push(assetText);

    // -$500 표시
    const minusText = this.add.text(centerX + 80, centerY + 20, '-$500', {
      fontSize: '28px',
      fill: '#ff4444',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1002).setAlpha(0);
    this.reviveElements.push(minusText);

    this.tweens.add({
      targets: minusText,
      alpha: 1,
      x: centerX + 100,
      duration: 150
    });

    // 빠른 카운트다운
    let currentValue = totalAssets;
    const countInterval = this.time.addEvent({
      delay: 20,
      repeat: 10,
      callback: () => {
        currentValue -= (totalAssets - remaining) / 10;
        assetText.setText(`$${Math.round(currentValue)}`);
        if (currentValue <= remaining + 1) {
          assetText.setText(`$${remaining}`);
          assetText.setFill('#ffff00');
        }
      }
    });
    this.reviveElements.push({ destroy: () => countInterval.remove() });

    // 코인 파티클 (적게)
    for (let i = 0; i < 6; i++) {
      const angle = (i / 6) * Math.PI * 2;
      const coin = this.add.circle(centerX, centerY - 40, 6, 0xffd700).setDepth(1004);
      this.reviveElements.push(coin);
      this.tweens.add({
        targets: coin,
        x: centerX + Math.cos(angle) * 80,
        y: centerY - 40 + Math.sin(angle) * 60,
        alpha: 0,
        duration: 250
      });
    }

    // REVIVE! 텍스트 빠르게
    this.time.delayedCall(300, () => {
      this.showReviveText(centerX, centerY, remaining);
    });
  }

  // REVIVE! 텍스트 표시 (빠른 버전)
  showReviveText(centerX, centerY, remaining) {
    const reviveText = this.add.text(centerX, centerY - 20, 'REVIVE!', {
      fontSize: '64px',
      fill: '#00ff88',
      fontStyle: 'bold',
      stroke: '#003311',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(1005).setScale(0.5).setAlpha(0);
    this.reviveElements.push(reviveText);
    reviveText.setShadow(0, 0, '#00ff88', 15, true, true);

    this.tweens.add({
      targets: reviveText,
      scale: 1,
      alpha: 1,
      duration: 150,
      ease: 'Back.easeOut'
    });

    // 스파크 (적게)
    for (let i = 0; i < 8; i++) {
      const angle = Math.random() * Math.PI * 2;
      const spark = this.add.star(centerX, centerY - 20, 5, 3, 6, 0x00ff88)
        .setDepth(1004).setAlpha(0.8);
      this.reviveElements.push(spark);
      this.tweens.add({
        targets: spark,
        x: centerX + Math.cos(angle) * 60,
        y: centerY - 20 + Math.sin(angle) * 60,
        alpha: 0,
        duration: 200
      });
    }

    // 빠른 리스폰
    this.time.delayedCall(250, () => {
      this.performRevive(remaining);
    });
  }

  // 실제 부활 처리
  performRevive(remaining) {
    const { width, height } = this.cameras.main;

    // 화면 플래시 (흰색)
    const flash = this.add.rectangle(0, 0, width, height, 0xffffff, 1)
      .setOrigin(0)
      .setDepth(1010);
    this.reviveElements.push(flash);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 150,
      onComplete: () => {
        this.cleanupReviveElements();
        this.time.timeScale = 1;
        this.money = remaining;
        this.restartCurrentStage();
      }
    });
  }

  // 부활 실패 애니메이션 (빠른 버전)
  showReviveFailedSequence() {
    this.isReviving = true;
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    const totalAssets = this.money + this.score;

    // 슬로우모션 없이 빠르게
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.7)
      .setOrigin(0)
      .setDepth(1000);
    this.reviveElements.push(overlay);

    // 현재 자산 표시 (빨간색)
    const assetText = this.add.text(centerX, centerY + 10, `$${totalAssets}`, {
      fontSize: '42px',
      fill: '#ff4444',
      fontStyle: 'bold',
      stroke: '#440000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(1001);
    this.reviveElements.push(assetText);

    // NEED $500 표시
    const needText = this.add.text(centerX, centerY + 60, 'NEED $500', {
      fontSize: '24px',
      fill: '#ff6666',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1001);
    this.reviveElements.push(needText);

    // NOT ENOUGH! 텍스트
    const notEnoughText = this.add.text(centerX, centerY - 50, 'NOT ENOUGH!', {
      fontSize: '48px',
      fill: '#ff4444',
      fontStyle: 'bold',
      stroke: '#220000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(1005).setScale(0.5);
    this.reviveElements.push(notEnoughText);

    this.tweens.add({
      targets: notEnoughText,
      scale: 1,
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 짧은 흔들림
        this.tweens.add({
          targets: notEnoughText,
          x: { from: centerX - 5, to: centerX + 5 },
          duration: 30,
          yoyo: true,
          repeat: 3
        });
      }
    });

    // X 마크
    const xMark = this.add.text(centerX, centerY - 110, '✕', {
      fontSize: '48px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(1005).setAlpha(0);
    this.reviveElements.push(xMark);

    this.tweens.add({
      targets: xMark,
      alpha: 1,
      duration: 100
    });

    // 빨간 플래시
    const redGlow = this.add.rectangle(0, 0, width, height, 0xff0000, 0.15)
      .setOrigin(0)
      .setDepth(999);
    this.reviveElements.push(redGlow);

    this.tweens.add({
      targets: redGlow,
      alpha: 0,
      duration: 200
    });

    // 빠르게 게임오버로 전환
    this.time.delayedCall(500, () => {
      this.transitionToGameOver();
    });
  }

  // 게임오버 화면으로 전환
  transitionToGameOver() {
    const { width, height } = this.cameras.main;

    const fadeOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0)
      .setDepth(1100);
    this.reviveElements.push(fadeOverlay);

    this.tweens.add({
      targets: fadeOverlay,
      alpha: 1,
      duration: 150,
      onComplete: () => {
        this.cleanupReviveElements();
        this.time.timeScale = 1;
        this.showGameOverScreen();
      }
    });
  }

  // 스테이지 재시작 (부활 시)
  restartCurrentStage() {
    // World 4 (Stage 13-15): 자기장 리셋 (부활 시 처음부터 다시 시작)
    if (shouldHaveGasZone(this.currentStage)) {
      this.stopGasZone();
      this.time.delayedCall(1000, () => {
        this.startGasZone();
      });
    }

    // 탄막보스 스테이지: 기존 보스 정리
    if (this.isBulletBossStage()) {
      this.cleanupBulletBoss();
    }

    // 게임 상태 리셋 (스테이지는 유지)
    this.gameOver = false;
    this.isReviving = false;
    this.score = 0;
    this.foodCount = 0;

    // 뱀 초기화 (3칸)
    this.snake = [
      { x: 5, y: 13 },
      { x: 4, y: 13 },
      { x: 3, y: 13 }
    ];
    this.direction = 'RIGHT';
    this.inputQueue = [];

    // 콤보 리셋 (콤보 실드는 유지)
    this.combo = 0;
    this.directionChangesCount = 0;

    // 텔레포트 상태 리셋
    this.foodTeleportEnabled = false;
    this.currentFoodTeleportCount = 0;
    this.nextTeleportStep = 0;

    // 탄막보스가 아닐 때만 먹이 생성 (보스전에서는 먹이 숨김)
    if (!this.isBulletBossStage()) {
      this.generateFood();
    }

    // UI 업데이트
    this.scoreText.setText('0');
    this.updateMoneyDisplay();

    // 그래픽 다시 그리기
    this.draw();

    // 모든 스테이지 시작 속도 90ms 고정
    const startSpeed = 90;
    if (this.moveTimer) {
      this.moveTimer.delay = startSpeed;
      this.moveTimer.paused = false;
    }
    this.speedText.setText(startSpeed + 'ms');

    // 뱀 반짝임 효과 (부활 표시)
    this.showReviveSpawnEffect();

    // 탄막보스 스테이지: 보스 재시작
    if (this.isBulletBossStage()) {
      this.time.delayedCall(800, () => {
        this.startBulletBoss();
      });
    }
  }

  // 부활 후 뱀 반짝임 효과
  showReviveSpawnEffect() {
    let blinkCount = 0;
    const blinkInterval = this.time.addEvent({
      delay: 100,
      repeat: 7,
      callback: () => {
        blinkCount++;
        if (this.graphics) {
          this.graphics.setAlpha(blinkCount % 2 === 0 ? 1 : 0.3);
        }
      },
      callbackScope: this
    });

    // 마지막에 완전히 보이게
    this.time.delayedCall(800, () => {
      if (this.graphics) {
        this.graphics.setAlpha(1);
      }
    });
  }

  // 부활 UI 요소 정리
  cleanupReviveElements() {
    this.reviveElements.forEach(el => {
      if (el && el.destroy) {
        el.destroy();
      }
    });
    this.reviveElements = [];
    this.isReviving = false;
  }

  // 돈 표시 업데이트 (상점 밖에서도 사용)
  updateMoneyDisplay() {
    // 상점 텍스트 객체가 유효한지 확인 (파괴된 객체 접근 방지)
    if (this.shopMoneyText && this.shopMoneyText.active) {
      try {
        this.shopMoneyText.setText(`$${this.money}`);
      } catch (e) {
        // 텍스트 객체가 파괴된 경우 무시
      }
    }
  }

  stageClear() {
    // 게임 일시정지
    this.moveTimer.paused = true;

    // 스테이지 클리어 플래그 설정 (톱니 충돌 무시용)
    this.isStageClearingAnimation = true;

    // 모든 톱니 정지 (일시정지만, 타이머 유지)
    this.pauseAllSaws();

    // 뱀 그래픽 숨기기 (점프 애니메이션에서 별도 렉탱글로 표시)
    this.hideSnakeGraphics();

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
        // Stage 3 클리어 후 상점 오픈
        if (this.currentStage >= 3) {
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

  getNextStageAfterClear() {
    // 테스트 스테이지는 -2 -> -1 -> 0 순서로 강제 진행
    if (this.isTestMode || this.currentStage <= 0) {
      const nextTestStage = this.currentStage + 1;
      if (nextTestStage <= 0 && TEST_STAGES[nextTestStage.toString()]) {
        return { stage: nextTestStage, isTestMode: true };
      }
      return { stage: 1, isTestMode: false };
    }

    return { stage: this.currentStage + 1, isTestMode: false };
  }

  enterBossStage() {
    this.isBossStage = true;
    this.bossMode = true;
    this.savedCombo = this.combo;
    this.savedComboShieldCount = this.comboShieldCount;
    this.combo = 0;
    this.comboText.setText('');
  }

  showNextStage() {
    const { width, height } = this.cameras.main;

    const { stage: nextStage, isTestMode } = this.getNextStageAfterClear();

    this.currentStage = nextStage;
    this.isTestMode = isTestMode;

    // Boss stage checks (bullet/fog/gear titan handled separately)
    const isBulletBoss = this.isBulletBossStage();
    const isFogBoss = this.isFogBossStage();
    const isGearTitan = this.isGearTitanStage();
    const isPoisonFrogBoss = !isBulletBoss && !isFogBoss && !isGearTitan && (
      this.currentStage === this.testBossStage ||
      (this.currentStage > this.testBossStage && this.currentStage % this.bossStageInterval === 0)
    );

    const isAnyBossStage = isPoisonFrogBoss || isBulletBoss || isFogBoss || isGearTitan;

    if (isAnyBossStage) {
      this.enterBossStage();
    }

    if (isPoisonFrogBoss) {
      this.resetStage();
      this.bossPhase = 'intro';
      this.food = { x: -100, y: -100 };
      this.bossIntroMoveCount = 0;
    } else if (isGearTitan) {
      // 기어 타이탄: 톱니 날아가기 애니메이션 후 resetStage
      this.moveTimer.paused = true;
      this.food = { x: -100, y: -100 };
      this.hideFoodGraphics({ skipRedraw: true });
      // resetStage는 톱니 날아간 후 호출됨
    } else if (isAnyBossStage) {
      this.resetStage();
      this.moveTimer.paused = true;
      this.food = { x: -100, y: -100 };
      this.hideFoodGraphics();
    }

    if (!isAnyBossStage && this.isBossStage) {
      this.isBossStage = false;
      this.bossMode = false;
      this.combo = this.savedCombo;
      this.comboShieldCount = this.savedComboShieldCount;
      if (this.combo > 0) {
        this.comboText.setText(`x${this.combo}`);
      }
      this.updateItemStatusUI();
    }

    if (!isAnyBossStage) {
      this.resetStage();
    }

    // Stage 0: 기어 타이탄 보스 시작 (톱니 날아가기 애니메이션 먼저)
    if (isGearTitan) {
      this.time.delayedCall(500, () => {
        this.animateSawsFlyOut(() => {
          this.resetStage();
          this.showSnakeGraphics(); // 뱀 다시 보이기
          this.startGearTitan();
        });
      });
    }

    if (this.hasSpeedBoost) {
      this.initSpeedBoostOrbitals();
    }

    const stageLabel = this.currentStage <= 0
      ? `TEST ${this.currentStage}`
      : `STAGE ${this.currentStage}`;
    const stageColor = this.currentStage <= 0 ? '#ff6600' : '#00ff00';
    const strokeColor = this.currentStage <= 0 ? '#884400' : '#008800';

    const stageText = this.add.text(width / 2, height / 2 - 100, stageLabel, {
      fontSize: '96px',
      fill: stageColor,
      fontStyle: 'bold',
      stroke: strokeColor,
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    this.tweens.add({
      targets: stageText,
      alpha: { from: 0, to: 0.7 },
      scaleX: { from: 1.2, to: 1 },
      scaleY: { from: 1.2, to: 1 },
      duration: 300,
      ease: 'Power2',
      onComplete: () => {
        this.time.delayedCall(400, () => {
          this.tweens.add({
            targets: stageText,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              stageText.destroy();

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
    // 스테이지 클리어 애니메이션 플래그 리셋
    this.isStageClearingAnimation = false;

    // 스피드 부스트 궤도 정리 (새로 생성하기 전에)
    this.cleanupSpeedBoostOrbitals();
    this.resetFogOfWar();

    // 안개 보스 정리
    if (this.fogBossMode) {
      this.cleanupFogBoss();
    }

    // 기어 타이탄 보스 정리
    if (this.gearTitanMode) {
      this.cleanupGearTitan();
    }

    // 톱니 보존 체크: Stage -2 -> -1 전환 시에만 톱니 유지
    if (!this.shouldPreserveSaws()) {
      this.destroyAllSaws();
      this.destroyAllEnhancedSaws();
    }
    this.preserveSawsForNextStage = false; // 플래그 리셋

    // 독가스 정리
    this.stopGasZone();

    // Flux Maze 시스템 정리
    this.stopPolaritySystem();
    this.cleanupMagneticTurrets();
    this.cleanupLaserTurrets();
    this.cleanupFloatingMines();

    // Magnetar 보스 정리
    this.cleanupMagnetar();

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

    // 먹이 생성 (보스 스테이지에서는 생성 안함)
    if (!this.isBossStage && !this.gearTitanMode) {
      this.food = this.generateFood();
    } else {
      // 보스전에서는 먹이를 화면 밖으로
      this.food = { x: -100, y: -100 };
    }

    // 모든 스테이지 시작 속도 90ms 고정
    const startSpeed = 90;
    this.moveTimer.delay = startSpeed;

    // 속도 UI 업데이트
    this.speedText.setText(startSpeed + 'ms');

    // 게임 재개
    this.moveTimer.paused = false;

    // 뱀/먹이 먼저 그리기 (안개 활성화 전에 렌더링)
    this.draw();

    // 스테이지 7에서 처음 진입 시 안개 인트로 실행
    this.startFogIntroIfNeeded();

    // World 4 (Stage 13-15): 원형 독가스 자기장 시스템 활성화
    if (shouldHaveGasZone(this.currentStage)) {
      this.time.delayedCall(1000, () => {
        this.startGasZone();
      });
    }

    // 탄막 보스 스테이지 체크 (Stage 6)
    if (this.isBulletBossStage()) {
      this.time.delayedCall(500, () => {
        this.startBulletBoss();
      });
    }

    // 안개 보스 스테이지 체크 (Stage 9 - World 2 녹턴 보스)
    if (this.isFogBossStage()) {
      this.time.delayedCall(500, () => {
        this.startFogBoss();
      });
    }

    // Flux Maze 기능 활성화 (Stage -1) - 레이저 터렛 시스템
    if (shouldHaveLaserTurrets(this.currentStage)) {
      this.time.delayedCall(1000, () => {
        this.initLaserTurrets();
      });
    }

    if (shouldHaveFloatingMines(this.currentStage)) {
      this.time.delayedCall(2000, () => {
        this.startMineSpawner();
      });
    }

    // Magnetar 보스 스테이지 체크 (Stage 0)
    if (isMagnetarStage(this.currentStage)) {
      this.bossPhase = 'intro';
      this.food = { x: -100, y: -100 };
      this.moveTimer.paused = true;
      this.hideFoodGraphics();
      this.time.delayedCall(500, () => {
        this.startMagnetar();
      });
    }
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
    const showLoanBtn = this.currentStage >= 8;

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

    // Loan 버튼 (Stage 8 클리어 후 오픈)
    const isFirstLoan = this.currentStage === 8; // 처음 대출 기능 해금

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
      this.savedComboShieldCount++; // 보스 클리어 후 복원 시에도 반영되도록
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

  showBossDialogue(text, callback, options = {}) {
    const { width, height } = this.cameras.main;
    const posX = options.x !== undefined ? options.x : width / 2;
    const posY = options.y !== undefined ? options.y : height / 2;
    const depth = options.depth !== undefined ? options.depth : 5002;

    const baseStyle = {
      fontSize: '20px',
      fill: '#ff00ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    };
    const style = options.style ? { ...baseStyle, ...options.style } : baseStyle;

    const dialogue = this.add.text(posX, posY, '', style)
      .setOrigin(0.5)
      .setDepth(depth);

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

  showSnakeStyleDialogue(text, callback, options = {}) {
    const head = this.snake[0];
    const defaultX = head ? head.x * this.gridSize + this.gridSize / 2 : this.cameras.main.width / 2;
    const defaultY = head ? head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY - 50 : this.cameras.main.height / 2;
    const posX = options.x !== undefined ? options.x : defaultX;
    const posY = options.y !== undefined ? options.y : defaultY;
    const depth = options.depth !== undefined ? options.depth : 1300;
    const fontSize = options.fontSize || '12px';

    const bubbleWidth = 260;
    const bubble = this.add.rectangle(posX, posY, bubbleWidth, 52, 0xffffff, 0.95)
      .setDepth(depth)
      .setScale(0)
      .setStrokeStyle(2, 0x000000);

    this.tweens.add({
      targets: bubble,
      scale: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });

    const dialogueText = this.add.text(posX, posY, '', {
      fontSize,
      fill: '#000000',
      fontStyle: 'bold',
      wordWrap: { width: bubbleWidth - 16 }
    }).setOrigin(0.5).setDepth(depth + 1);

    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 45,
      callback: () => {
        dialogueText.setText(text.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex >= text.length) {
          typeTimer.destroy();
          this.time.delayedCall(1100, () => {
            this.tweens.add({
              targets: [bubble, dialogueText],
              alpha: 0,
              duration: 200,
              onComplete: () => {
                bubble.destroy();
                dialogueText.destroy();
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

    // TODO: 원래는 모서리 4개 - { x: 0, y: 0 }, { x: cols-1, y: 0 }, { x: 0, y: rows-1 }, { x: cols-1, y: rows-1 }
    // 테스트용으로 중앙 부근 4군데로 변경
    this.bossCorners = [
      { x: Math.floor(this.cols / 3), y: Math.floor(this.rows / 3) }, // 좌상 중앙
      { x: Math.floor(this.cols * 2 / 3), y: Math.floor(this.rows / 3) }, // 우상 중앙
      { x: Math.floor(this.cols / 3), y: Math.floor(this.rows * 2 / 3) }, // 좌하 중앙
      { x: Math.floor(this.cols * 2 / 3), y: Math.floor(this.rows * 2 / 3) } // 우하 중앙
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
    // 중복 호출 방지: 즉시 phase 변경
    if (this.bossPhase === 'final') return;
    this.bossPhase = 'final';
    this.bossHitCount = 4;

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
              if (this.currentStage >= 3) {
                this.openShop();
              } else {
                this.showStageClearText();
              }
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

  // =====================
  // 확산형 독가스 시스템
  // =====================

  startGasZone() {
    if (this.gasZoneEnabled) return;

    this.gasZoneEnabled = true;

    // 원 중심 계산 (맵 중앙)
    this.gasZoneCenterX = this.cols / 2;
    this.gasZoneCenterY = this.rows / 2;

    // 초기 반경: 맵 모서리까지의 거리 (전체 맵 커버)
    this.gasZoneRadius = Math.sqrt(
      Math.pow(this.cols / 2, 2) + Math.pow(this.rows / 2, 2)
    ) + 1;

    // 독가스 확장 타이머 시작
    this.gasZoneTimer = this.time.addEvent({
      delay: this.gasZoneExpandInterval,
      callback: this.expandGasZone,
      callbackScope: this,
      loop: true
    });

    // 애니메이션 업데이트용 타이머 (60fps)
    this.gasZoneAnimTimer = this.time.addEvent({
      delay: 16, // ~60fps
      callback: this.updateGasZoneAnimation,
      callbackScope: this,
      loop: true
    });

    // 초기 렌더링
    this.renderGasZone();
  }

  stopGasZone() {
    this.gasZoneEnabled = false;
    this.gasZoneRadius = 0;

    if (this.gasZoneTimer) {
      this.gasZoneTimer.destroy();
      this.gasZoneTimer = null;
    }

    if (this.gasZoneAnimTimer) {
      this.gasZoneAnimTimer.destroy();
      this.gasZoneAnimTimer = null;
    }

    // 파티클 정리
    this.gasZoneParticles.forEach(p => {
      if (p && p.destroy) p.destroy();
    });
    this.gasZoneParticles = [];

    // 그래픽 정리
    if (this.gasZoneGraphics) {
      this.gasZoneGraphics.clear();
    }
  }

  expandGasZone() {
    if (!this.gasZoneEnabled) return;
    if (this.gasZoneRadius <= this.gasZoneMinRadius) return;

    // 먼저 경고 표시 후 확장
    this.showGasZonePreWarning(() => {
      // 반경 감소 (1.5 타일씩)
      this.gasZoneRadius = Math.max(this.gasZoneMinRadius, this.gasZoneRadius - 1.5);

      // 확장 시 EMP 펄스 효과
      this.showGasZoneExpandEffect();

      // 렌더링 업데이트
      this.renderGasZone();

      // 먹이가 독가스 영역에 들어갔는지 체크 - 안전 영역에 재생성 (카운트 증가 없음)
      if (this.food && this.isInGasZone(this.food.x, this.food.y)) {
        // 기존 말풍선 제거
        if (this.foodBubble) {
          if (this.foodBubble.image) this.foodBubble.image.destroy();
          if (this.foodBubble.text) this.foodBubble.text.destroy();
          this.foodBubble = null;
        }
        this.food = this.generateFood();
      }

      // 경고 표시
      if (this.gasZoneRadius <= this.gasZoneMinRadius + 3) {
        this.showGasZoneWarning('DANGER! GAS CLOSING IN!');
      }
    });
  }

  showGasZonePreWarning(callback) {
    const gs = this.gridSize;
    const nextRadius = this.gasZoneRadius - 1.5;
    const centerX = this.gasZoneCenterX;
    const centerY = this.gasZoneCenterY;

    // 경고 그래픽 생성
    const warningGraphics = this.add.graphics();
    warningGraphics.setDepth(55);

    // 긴박한 깜빡임 애니메이션
    let blinkCount = 0;
    const maxBlinks = 6;
    const blinkInterval = 80;

    const blinkTimer = this.time.addEvent({
      delay: blinkInterval,
      callback: () => {
        warningGraphics.clear();

        if (blinkCount % 2 === 0) {
          // 경고 색상 (빨간색/노란색 교차)
          const color = blinkCount % 4 === 0 ? 0xff0000 : 0xffff00;

          // 다음에 독가스가 될 영역 (현재 반경과 다음 반경 사이의 링)
          for (let x = 0; x < this.cols; x++) {
            for (let y = 0; y < this.rows; y++) {
              const dist = Math.sqrt(
                Math.pow(x + 0.5 - centerX, 2) + Math.pow(y + 0.5 - centerY, 2)
              );
              // 다음 반경과 현재 반경 사이의 타일만
              if (dist > nextRadius && dist <= this.gasZoneRadius) {
                warningGraphics.fillStyle(color, 0.7);
                warningGraphics.fillRect(
                  x * gs,
                  y * gs + this.gameAreaY,
                  gs,
                  gs
                );
              }
            }
          }

          // 원형 경계선 강조
          const pixelCenterX = centerX * gs;
          const pixelCenterY = centerY * gs + this.gameAreaY;
          warningGraphics.lineStyle(3, 0xffffff, 0.9);
          warningGraphics.strokeCircle(pixelCenterX, pixelCenterY, nextRadius * gs);
        }

        blinkCount++;

        if (blinkCount >= maxBlinks) {
          blinkTimer.destroy();
          warningGraphics.destroy();
          callback();
        }
      },
      callbackScope: this,
      loop: true
    });

    // 원형 글로우 효과
    const pixelCenterX = centerX * gs;
    const pixelCenterY = centerY * gs + this.gameAreaY;
    const glowCircle = this.add.graphics();
    glowCircle.setDepth(54);
    glowCircle.lineStyle(6, 0xff0000, 0.8);
    glowCircle.strokeCircle(pixelCenterX, pixelCenterY, this.gasZoneRadius * gs);

    this.tweens.add({
      targets: glowCircle,
      alpha: { from: 0.8, to: 0 },
      duration: maxBlinks * blinkInterval,
      ease: 'Power2.easeIn',
      onComplete: () => glowCircle.destroy()
    });
  }

  isInGasZone(x, y) {
    if (!this.gasZoneEnabled) return false;

    // 타일 중심에서 원 중심까지의 거리 계산
    const dist = Math.sqrt(
      Math.pow(x + 0.5 - this.gasZoneCenterX, 2) +
      Math.pow(y + 0.5 - this.gasZoneCenterY, 2)
    );

    // 반경 밖이면 독가스 영역
    return dist > this.gasZoneRadius;
  }

  renderGasZone() {
    if (!this.gasZoneGraphics) return;
    this.gasZoneGraphics.clear();

    if (!this.gasZoneEnabled) return;

    const radius = this.gasZoneRadius;
    const time = this.gasZonePulseTime;
    const gs = this.gridSize;
    const centerX = this.gasZoneCenterX;
    const centerY = this.gasZoneCenterY;

    // 펄스 효과를 위한 알파값 변동
    const pulseAlpha = 0.6 + Math.sin(time * 0.005) * 0.15;

    // EMP 색상 (시간에 따라 변화)
    const colorPhase = (time * 0.003) % (Math.PI * 2);
    const r = Math.floor(80 + Math.sin(colorPhase) * 40);
    const g = Math.floor(20 + Math.sin(colorPhase + 2) * 20);
    const b = Math.floor(180 + Math.sin(colorPhase + 4) * 60);
    const baseColor = (r << 16) | (g << 8) | b;

    // 원형 독가스 영역 그리기 (반경 밖의 타일들)
    for (let x = 0; x < this.cols; x++) {
      for (let y = 0; y < this.rows; y++) {
        const dist = Math.sqrt(
          Math.pow(x + 0.5 - centerX, 2) + Math.pow(y + 0.5 - centerY, 2)
        );

        if (dist > radius) {
          // 거리에 따른 알파값 (경계에서 멀수록 진함)
          const distFromEdge = dist - radius;
          const distAlpha = Math.min(1, distFromEdge / 3) * pulseAlpha;

          this.gasZoneGraphics.fillStyle(baseColor, distAlpha);
          this.gasZoneGraphics.fillRect(
            x * gs,
            y * gs + this.gameAreaY,
            gs,
            gs
          );
        }
      }
    }

    // 원형 경계선 강조
    const pixelCenterX = centerX * gs;
    const pixelCenterY = centerY * gs + this.gameAreaY;
    const edgeAlpha = 0.8 + Math.sin(time * 0.01) * 0.2;

    this.gasZoneGraphics.lineStyle(3, 0x00ffff, edgeAlpha);
    this.gasZoneGraphics.strokeCircle(pixelCenterX, pixelCenterY, radius * gs);

    // 내부 글로우 효과 (두 번째 경계선)
    const innerGlow = 0.4 + Math.sin(time * 0.008) * 0.2;
    this.gasZoneGraphics.lineStyle(1, 0xff00ff, innerGlow);
    this.gasZoneGraphics.strokeCircle(pixelCenterX, pixelCenterY, (radius + 0.5) * gs);

    // 전기 스파크 효과 (원형 경계선에서)
    this.renderGasZoneSparks(radius, time);
  }

  renderGasZoneSparks(radius, time) {
    if (radius <= 0) return;

    const gs = this.gridSize;
    const centerX = this.gasZoneCenterX;
    const centerY = this.gasZoneCenterY;
    const pixelCenterX = centerX * gs;
    const pixelCenterY = centerY * gs + this.gameAreaY;

    const sparkCount = 12;
    for (let i = 0; i < sparkCount; i++) {
      const sparkPhase = (time * 0.008 + i * (Math.PI * 2 / sparkCount)) % (Math.PI * 2);
      const sparkIntensity = Math.pow(Math.sin(sparkPhase), 4);

      if (sparkIntensity > 0.3) {
        // 원형 경계선 위의 위치 (각도 기반)
        const angle = (time * 0.002 + i * (Math.PI * 2 / sparkCount)) % (Math.PI * 2);
        const px = pixelCenterX + Math.cos(angle) * radius * gs;
        const py = pixelCenterY + Math.sin(angle) * radius * gs;

        // 스파크 글로우
        this.gasZoneGraphics.fillStyle(0x00ffff, sparkIntensity * 0.8);
        this.gasZoneGraphics.fillCircle(px, py, 6 + sparkIntensity * 4);

        // 스파크 코어
        this.gasZoneGraphics.fillStyle(0xffffff, sparkIntensity);
        this.gasZoneGraphics.fillCircle(px, py, 2 + sparkIntensity * 2);
      }
    }
  }

  updateGasZoneAnimation() {
    if (!this.gasZoneEnabled) return;
    this.gasZonePulseTime += 16;
    this.renderGasZone();
  }

  showGasZoneExpandEffect() {
    const { width, height } = this.cameras.main;
    const gs = this.gridSize;

    // 화면 전체 EMP 플래시
    const flash = this.add.rectangle(
      width / 2, height / 2, width, height,
      0x00ffff, 0.4
    ).setDepth(5500);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 300,
      ease: 'Power2.easeOut',
      onComplete: () => flash.destroy()
    });

    // 원형 수축 링 효과
    const centerX = this.gasZoneCenterX * gs;
    const centerY = this.gasZoneCenterY * gs + this.gameAreaY;

    const ring = this.add.graphics();
    ring.setDepth(5501);

    const startRadius = (this.gasZoneRadius + 1.5) * gs;
    const targetRadius = this.gasZoneRadius * gs;

    this.tweens.add({
      targets: { radius: startRadius },
      radius: targetRadius,
      duration: 400,
      ease: 'Power2.easeIn',
      onUpdate: (tween) => {
        const r = tween.targets[0].radius;
        ring.clear();
        ring.lineStyle(4, 0xff00ff, 0.8 * (1 - tween.progress));
        ring.strokeCircle(centerX, centerY, r);
      },
      onComplete: () => ring.destroy()
    });

    // 전기 파티클 폭발 (원형으로 안쪽으로)
    for (let i = 0; i < 16; i++) {
      const angle = (i / 16) * Math.PI * 2;
      const dist = this.gasZoneRadius * gs + 20;

      const particle = this.add.circle(
        centerX + Math.cos(angle) * dist,
        centerY + Math.sin(angle) * dist,
        3 + Math.random() * 3,
        0x00ffff
      ).setDepth(5502).setAlpha(0.9);

      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * (dist - 60),
        y: centerY + Math.sin(angle) * (dist - 60),
        alpha: 0,
        scale: 0,
        duration: 400,
        ease: 'Power2.easeIn',
        onComplete: () => particle.destroy()
      });
    }
  }

  showGasZoneWarning(message) {
    const { width, height } = this.cameras.main;

    const warningText = this.add.text(width / 2, height / 2, message, {
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#ff0000',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(6000).setAlpha(0);

    this.tweens.add({
      targets: warningText,
      alpha: 1,
      scale: { from: 0.5, to: 1.2 },
      duration: 300,
      ease: 'Back.easeOut',
      yoyo: true,
      hold: 1000,
      onComplete: () => warningText.destroy()
    });
  }

  // =====================================================
  // ===== POLARITY SYSTEM (Stage -1: Flux Maze) =====
  // =====================================================

  startPolaritySystem() {
    if (this.polarityEnabled) return;

    this.polarityEnabled = true;
    this.currentPolarity = Phaser.Math.RND.pick(['N', 'S']);

    // 뱀 머리 위 극성 마커 생성
    this.createPolarityMarker();

    // 화면 UI 생성
    this.createPolarityUI();

    // 극성 변경 타이머 시작
    this.polarityTimer = this.time.addEvent({
      delay: this.polarityChangeInterval,
      callback: this.changePolarity,
      callbackScope: this,
      loop: true
    });

    // 경고 타이머 (변경 2초 전)
    this.polarityWarningTimer = this.time.addEvent({
      delay: this.polarityChangeInterval - this.polarityChangeWarningTime,
      callback: this.showPolarityChangeWarning,
      callbackScope: this,
      loop: true
    });

    console.log('[Polarity] System started with polarity:', this.currentPolarity);
  }

  stopPolaritySystem() {
    this.polarityEnabled = false;

    if (this.polarityTimer) {
      this.polarityTimer.destroy();
      this.polarityTimer = null;
    }

    if (this.polarityWarningTimer) {
      this.polarityWarningTimer.destroy();
      this.polarityWarningTimer = null;
    }

    if (this.polarityMarker) {
      this.polarityMarker.destroy();
      this.polarityMarker = null;
    }

    if (this.polarityUI) {
      this.polarityUI.destroy();
      this.polarityUI = null;
      this.polarityUILabel = null;
    }

    console.log('[Polarity] System stopped');
  }

  createPolarityMarker() {
    const color = this.currentPolarity === 'N' ? '#00aaff' : '#ff4400';

    this.polarityMarker = this.add.text(0, 0, `[${this.currentPolarity}]`, {
      fontSize: '14px',
      fill: color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(150);

    this.updatePolarityMarkerPosition();
  }

  updatePolarityMarkerPosition() {
    if (!this.polarityMarker || !this.snake || !this.snake[0]) return;

    const head = this.snake[0];
    const x = head.x * this.gridSize + this.gridSize / 2;
    const y = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY - 18;

    this.polarityMarker.setPosition(x, y);
  }

  createPolarityUI() {
    const { width } = this.cameras.main;

    // 우측 상단에 극성 표시 UI
    this.polarityUI = this.add.container(width - 60, 30).setDepth(2500);

    const bg = this.add.rectangle(0, 0, 50, 28, 0x222222, 0.9);
    bg.setStrokeStyle(2, this.currentPolarity === 'N' ? 0x00aaff : 0xff4400);

    const label = this.add.text(0, 0, `[${this.currentPolarity}]`, {
      fontSize: '18px',
      fill: this.currentPolarity === 'N' ? '#00aaff' : '#ff4400',
      fontStyle: 'bold'
    }).setOrigin(0.5);

    this.polarityUI.add([bg, label]);
    this.polarityUILabel = label;
    this.polarityUIBg = bg;
  }

  updatePolarityUI() {
    if (!this.polarityUILabel) return;

    const color = this.currentPolarity === 'N' ? '#00aaff' : '#ff4400';
    const hexColor = this.currentPolarity === 'N' ? 0x00aaff : 0xff4400;

    this.polarityUILabel.setText(`[${this.currentPolarity}]`);
    this.polarityUILabel.setColor(color);

    if (this.polarityUIBg) {
      this.polarityUIBg.setStrokeStyle(2, hexColor);
    }

    // 마커 업데이트
    if (this.polarityMarker) {
      this.polarityMarker.setText(`[${this.currentPolarity}]`);
      this.polarityMarker.setColor(color);
    }
  }

  showPolarityChangeWarning() {
    if (!this.polarityEnabled) return;
    this.isPolarityWarning = true;

    // 마커 깜빡임
    if (this.polarityMarker) {
      this.tweens.add({
        targets: this.polarityMarker,
        alpha: 0.3,
        duration: 150,
        yoyo: true,
        repeat: 5
      });
    }

    // 경고 텍스트
    const { width, height } = this.cameras.main;
    const warningText = this.add.text(width / 2, height / 2 - 80, 'POLARITY SHIFT!', {
      fontSize: '28px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(3000).setAlpha(0);

    this.tweens.add({
      targets: warningText,
      alpha: 1,
      scale: { from: 0.8, to: 1.1 },
      duration: 150,
      yoyo: true,
      repeat: 5,
      onComplete: () => warningText.destroy()
    });

    // 화면 가장자리 글로우
    const flash = this.add.rectangle(width / 2, height / 2, width, height, 0xffff00, 0);
    flash.setDepth(2999);
    this.tweens.add({
      targets: flash,
      fillAlpha: 0.15,
      duration: 200,
      yoyo: true,
      repeat: 4,
      onComplete: () => flash.destroy()
    });
  }

  changePolarity() {
    if (!this.polarityEnabled) return;
    this.isPolarityWarning = false;

    const oldPolarity = this.currentPolarity;
    this.currentPolarity = this.currentPolarity === 'N' ? 'S' : 'N';

    // 시각 효과
    this.showPolarityChangeEffect(oldPolarity, this.currentPolarity);

    // UI 업데이트
    this.updatePolarityUI();

    // 자기력 효과 재계산
    if (this.magneticTurrets.length > 0) {
      this.applyMagneticSpeedEffect();
    }

    console.log('[Polarity] Changed from', oldPolarity, 'to', this.currentPolarity);
  }

  showPolarityChangeEffect(from, to) {
    if (!this.snake || !this.snake[0]) return;

    const head = this.snake[0];
    const x = head.x * this.gridSize + this.gridSize / 2;
    const y = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    const color = to === 'N' ? 0x00aaff : 0xff4400;

    // EMP 링 효과
    const ring = this.add.graphics().setDepth(200);
    ring.lineStyle(4, color, 1);
    ring.strokeCircle(x, y, 10);

    this.tweens.add({
      targets: ring,
      scaleX: 6,
      scaleY: 6,
      alpha: 0,
      duration: 400,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });

    // 파티클 효과
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const particle = this.add.graphics().setDepth(200);
      particle.fillStyle(color, 1);
      particle.fillCircle(0, 0, 4);
      particle.x = x;
      particle.y = y;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 40,
        y: y + Math.sin(angle) * 40,
        alpha: 0,
        duration: 350,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 카메라 쉐이크
    this.cameras.main.shake(150, 0.008);
  }

  // =====================================================
  // ===== MAGNETIC TURRETS (Stage -1: Flux Maze) =====
  // =====================================================

  initMagneticTurrets() {
    if (this.magneticTurrets.length > 0) return;

    // 4개 고정 위치 (대칭 배치)
    const positions = [
      { x: 8, y: 6, polarity: 'N' },
      { x: 32, y: 6, polarity: 'S' },
      { x: 8, y: 21, polarity: 'S' },
      { x: 32, y: 21, polarity: 'N' }
    ];

    positions.forEach(pos => {
      this.createMagneticTurret(pos.x, pos.y, pos.polarity);
    });

    // 애니메이션 타이머 시작
    this.turretAnimTimer = this.time.addEvent({
      delay: 16, // 60fps
      callback: this.updateTurretAnimations,
      callbackScope: this,
      loop: true
    });

    console.log('[Turrets] Initialized', this.magneticTurrets.length, 'turrets');
  }

  createMagneticTurret(tileX, tileY, polarity) {
    const gs = this.gridSize;
    const x = tileX * gs + gs / 2;
    const y = tileY * gs + gs / 2 + this.gameAreaY;

    const container = this.add.container(x, y).setDepth(65);

    // 영향 범위 표시용 그래픽
    const forceField = this.add.graphics();
    container.add(forceField);

    // 베이스 (금속 원형)
    const base = this.add.graphics();
    base.fillStyle(0x333344, 1);
    base.fillCircle(0, 0, gs * 0.7);
    base.lineStyle(3, polarity === 'N' ? 0x00aaff : 0xff4400, 1);
    base.strokeCircle(0, 0, gs * 0.7);
    container.add(base);

    // 극성 텍스트
    const polarityText = this.add.text(0, 0, polarity, {
      fontSize: '14px',
      fill: polarity === 'N' ? '#00aaff' : '#ff4400',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(polarityText);

    // 코어 글로우
    const coreGlow = this.add.graphics();
    coreGlow.fillStyle(polarity === 'N' ? 0x00aaff : 0xff4400, 0.3);
    coreGlow.fillCircle(0, 0, gs * 0.4);
    container.add(coreGlow);
    container.sendToBack(coreGlow);

    const turret = {
      x: tileX,
      y: tileY,
      polarity: polarity,
      element: container,
      forceField: forceField,
      forceRadius: this.turretForceRadius,
      pulsePhase: Math.random() * Math.PI * 2,
      base: base,
      coreGlow: coreGlow
    };

    this.magneticTurrets.push(turret);

    // 생성 애니메이션
    container.setScale(0).setAlpha(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });
  }

  updateTurretAnimations() {
    if (!this.polarityEnabled) return;

    this.turretPulseTime += 0.05;

    this.magneticTurrets.forEach(turret => {
      if (!turret.forceField) return;

      turret.forceField.clear();

      const alpha = 0.15 + Math.sin(this.turretPulseTime + turret.pulsePhase) * 0.1;
      const radius = turret.forceRadius * this.gridSize;
      const color = turret.polarity === 'N' ? 0x00aaff : 0xff4400;

      // 외곽 링
      turret.forceField.lineStyle(2, color, alpha * 1.5);
      turret.forceField.strokeCircle(0, 0, radius);

      // 내부 펄스 링들
      for (let i = 1; i <= 3; i++) {
        const ringRadius = radius * (i / 4);
        const ringAlpha = alpha * (1 - i / 5);
        turret.forceField.lineStyle(1, color, ringAlpha);
        turret.forceField.strokeCircle(0, 0, ringRadius);
      }

      // 코어 글로우 펄스
      if (turret.coreGlow) {
        const glowScale = 1 + Math.sin(this.turretPulseTime * 2 + turret.pulsePhase) * 0.15;
        turret.coreGlow.setScale(glowScale);
      }
    });
  }

  calculateMagneticSpeedModifier() {
    if (!this.polarityEnabled || this.magneticTurrets.length === 0) {
      return 1.0;
    }

    if (!this.snake || !this.snake[0]) return 1.0;

    const head = this.snake[0];
    let totalModifier = 1.0;

    this.magneticTurrets.forEach(turret => {
      const dist = Math.sqrt(
        Math.pow(head.x - turret.x, 2) +
        Math.pow(head.y - turret.y, 2)
      );

      if (dist <= turret.forceRadius && dist > 0.5) {
        const distanceRatio = dist / turret.forceRadius;
        const samePolarity = this.currentPolarity === turret.polarity;

        if (samePolarity) {
          // 척력: 속도 감소 (거리 가까우면 0.5x까지)
          const modifier = 0.5 + distanceRatio * 0.5;
          totalModifier = Math.min(totalModifier, modifier);
        } else {
          // 인력: 속도 증가 (거리 가까우면 1.5x까지)
          const modifier = 1.5 - distanceRatio * 0.5;
          totalModifier = Math.max(totalModifier, modifier);
        }
      }
    });

    return totalModifier;
  }

  applyMagneticSpeedEffect() {
    if (!this.polarityEnabled) return;

    const newModifier = this.calculateMagneticSpeedModifier();
    const prevModifier = this.currentSpeedModifier;

    // 속도 배율이 변경되었을 때만 업데이트
    if (Math.abs(newModifier - prevModifier) > 0.01) {
      this.currentSpeedModifier = newModifier;

      // 실제 속도 적용 (baseSpeed가 없으면 현재 delay 기준)
      if (!this.baseSpeed) {
        this.baseSpeed = this.moveTimer.delay;
      }

      // 속도 배율 적용: modifier가 크면 빠름 (delay 감소)
      const newDelay = Math.round(this.baseSpeed / newModifier);
      this.moveTimer.delay = Math.max(30, Math.min(150, newDelay)); // 30~150ms 범위

      // 시각적 피드백
      this.showMagneticSpeedFeedback(newModifier, prevModifier);
    }

    // 매 프레임 자기력 파티클 효과
    this.updateMagneticParticles();
  }

  updateMagneticParticles() {
    if (!this.snake || !this.snake[0]) return;

    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 가까운 탑을 찾아서 자기력 선 표시
    this.magneticTurrets.forEach(turret => {
      const dist = Math.sqrt(
        Math.pow(head.x - turret.x, 2) +
        Math.pow(head.y - turret.y, 2)
      );

      if (dist <= turret.forceRadius && dist > 1) {
        const turretX = turret.x * this.gridSize + this.gridSize / 2;
        const turretY = turret.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
        const samePolarity = this.currentPolarity === turret.polarity;
        const color = samePolarity ? 0xff4400 : 0x00aaff;

        // 10% 확률로 자기력 파티클 생성
        if (Math.random() < 0.1) {
          this.createMagneticFieldParticle(headX, headY, turretX, turretY, color, samePolarity);
        }
      }
    });
  }

  createMagneticFieldParticle(fromX, fromY, toX, toY, color, isRepulsion) {
    const particle = this.add.circle(fromX, fromY, 3, color, 0.8);
    particle.setDepth(90);

    if (isRepulsion) {
      // 척력: 탑에서 뱀으로 밀려나오는 방향
      const angle = Math.atan2(fromY - toY, fromX - toX);
      const targetX = fromX + Math.cos(angle) * 30;
      const targetY = fromY + Math.sin(angle) * 30;

      this.tweens.add({
        targets: particle,
        x: targetX,
        y: targetY,
        alpha: 0,
        scale: 0.3,
        duration: 400,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    } else {
      // 인력: 뱀에서 탑으로 끌려가는 방향
      const midX = (fromX + toX) / 2 + Phaser.Math.Between(-20, 20);
      const midY = (fromY + toY) / 2 + Phaser.Math.Between(-20, 20);

      this.tweens.add({
        targets: particle,
        x: midX,
        y: midY,
        alpha: 0,
        scale: 0.5,
        duration: 300,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  showMagneticSpeedFeedback(modifier, prevModifier) {
    if (!this.snake || !this.snake[0]) return;

    const head = this.snake[0];
    const x = head.x * this.gridSize + this.gridSize / 2;
    const y = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 속도 변화 판단
    let color, text, particleCount;
    if (modifier < 0.8) {
      color = 0xff4400; // 척력 - 빨간색 (느려짐)
      text = 'SLOW!';
      particleCount = 8;
    } else if (modifier > 1.2) {
      color = 0x00aaff; // 인력 - 파란색 (빨라짐)
      text = 'FAST!';
      particleCount = 8;
    } else if (modifier < 0.95) {
      color = 0xff6644;
      text = null;
      particleCount = 4;
    } else if (modifier > 1.05) {
      color = 0x44aaff;
      text = null;
      particleCount = 4;
    } else {
      // 효과 범위 벗어남 - 원래 속도로 복원
      if (this.baseSpeed) {
        this.moveTimer.delay = this.baseSpeed;
      }
      return;
    }

    // 글로우 링 효과
    const glow = this.add.graphics().setDepth(95);
    glow.lineStyle(3, color, 0.8);
    glow.strokeCircle(x, y, this.gridSize * 0.6);

    this.tweens.add({
      targets: glow,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 400,
      ease: 'Power2',
      onComplete: () => glow.destroy()
    });

    // 파티클 버스트
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const particle = this.add.circle(x, y, 4, color, 0.9);
      particle.setDepth(95);

      const dist = modifier < 1 ? 25 : 40; // 척력은 짧게, 인력은 길게
      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.3,
        duration: 350,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 텍스트 표시 (강한 효과일 때만)
    if (text) {
      const feedbackText = this.add.text(x, y - 25, text, {
        fontSize: '14px',
        fontFamily: 'monospace',
        color: color === 0xff4400 ? '#ff4400' : '#00aaff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(100);

      this.tweens.add({
        targets: feedbackText,
        y: y - 45,
        alpha: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => feedbackText.destroy()
      });

      // 화면 테두리 효과
      this.showMagneticBorderEffect(color);
    }
  }

  showMagneticBorderEffect(color) {
    const { width, height } = this.cameras.main;

    const border = this.add.graphics().setDepth(200);
    border.lineStyle(4, color, 0.6);
    border.strokeRect(5, 5, width - 10, height - 10);

    this.tweens.add({
      targets: border,
      alpha: 0,
      duration: 300,
      onComplete: () => border.destroy()
    });

    // 텍스트 피드백 (가끔만 표시)
    if (Math.random() < 0.3) {
      const feedbackText = this.add.text(x, y - 25, text, {
        fontSize: '12px',
        fill: modifier < 0.9 ? '#ff4400' : '#00aaff',
        fontStyle: 'bold'
      }).setOrigin(0.5).setDepth(200).setAlpha(0.8);

      this.tweens.add({
        targets: feedbackText,
        y: y - 45,
        alpha: 0,
        duration: 500,
        onComplete: () => feedbackText.destroy()
      });
    }
  }

  getAdjustedMoveDelay() {
    // 자기력 영향 반영한 실제 이동 딜레이
    const baseDelay = this.moveTimer ? this.moveTimer.delay : this.baseSpeed;
    return Math.round(baseDelay / this.currentSpeedModifier);
  }

  cleanupMagneticTurrets() {
    this.magneticTurrets.forEach(turret => {
      if (turret.element) turret.element.destroy();
    });
    this.magneticTurrets = [];

    if (this.turretAnimTimer) {
      this.turretAnimTimer.destroy();
      this.turretAnimTimer = null;
    }

    this.currentSpeedModifier = 1.0;

    console.log('[Turrets] Cleaned up');
  }

  isTurretAtPosition(x, y) {
    return this.magneticTurrets.some(t => t.x === x && t.y === y) ||
           this.laserTurrets.some(t => t.x === x && t.y === y);
  }

  // =====================================================
  // ===== LASER TURRETS (Stage -1: Flux Maze) =====
  // =====================================================

  initLaserTurrets() {
    if (this.laserTurrets.length > 0) return;

    console.log('[LaserTurrets] Initializing laser turrets...');

    // 4개 고정 위치에 터렛 생성
    this.laserTurretPositions.forEach((pos, index) => {
      this.createLaserTurret(pos.x, pos.y, index);
    });

    // 60fps 애니메이션 타이머
    this.laserAnimTimer = this.time.addEvent({
      delay: 16,
      callback: this.updateLaserTurretAnimations,
      callbackScope: this,
      loop: true
    });

    // 발사 주기 타이머 시작
    this.startLaserFireCycle();

    console.log('[LaserTurrets] Initialized', this.laserTurrets.length, 'turrets');
  }

  createLaserTurret(tileX, tileY, index) {
    const gs = this.gridSize;
    const x = tileX * gs + gs / 2;
    const y = tileY * gs + gs / 2 + this.gameAreaY;

    const container = this.add.container(x, y).setDepth(70);

    // EMP 스타일 베이스 - 가스존과 통일된 비주얼
    const baseGlow = this.add.graphics();
    baseGlow.fillStyle(0x00ffff, 0.3);
    baseGlow.fillCircle(0, 0, gs * 1.2);
    container.add(baseGlow);

    // 터렛 코어 (마젠타/시안 그라데이션 느낌)
    const core = this.add.graphics();
    core.fillStyle(0xff00ff, 0.8);
    core.fillCircle(0, 0, gs * 0.6);
    core.fillStyle(0x00ffff, 1);
    core.fillCircle(0, 0, gs * 0.35);
    core.fillStyle(0xffffff, 1);
    core.fillCircle(0, 0, gs * 0.15);
    container.add(core);

    // 회전하는 외곽 링
    const outerRing = this.add.graphics();
    outerRing.lineStyle(2, 0x00ffff, 0.8);
    outerRing.strokeCircle(0, 0, gs * 0.9);
    // 작은 노드 4개
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI / 2);
      const nx = Math.cos(angle) * gs * 0.9;
      const ny = Math.sin(angle) * gs * 0.9;
      outerRing.fillStyle(0xff00ff, 1);
      outerRing.fillCircle(nx, ny, 3);
    }
    container.add(outerRing);

    // 레이저 그래픽 (발사 시에만 표시)
    const laserGraphics = this.add.graphics();
    laserGraphics.setVisible(false);
    container.add(laserGraphics);

    // 경고 그래픽 (경고 시에만 표시)
    const warningGraphics = this.add.graphics();
    warningGraphics.setVisible(false);
    container.add(warningGraphics);

    // 초기 각도 설정 (각 터렛이 서로 다른 방향)
    const initialAngle = (index * Math.PI / 2) + Math.PI / 4;

    const turret = {
      x: tileX,
      y: tileY,
      container,
      core,
      outerRing,
      baseGlow,
      laserGraphics,
      warningGraphics,
      angle: initialAngle,
      isActive: false,
      isWarning: false,
      pulsePhase: Math.random() * Math.PI * 2
    };

    this.laserTurrets.push(turret);
  }

  startLaserFireCycle() {
    // 첫 발사 전 대기
    this.time.delayedCall(2000, () => {
      this.fireLaserSequence();
    });
  }

  fireLaserSequence() {
    if (this.laserTurrets.length === 0) return;
    if (this.gameOver || this.bossPhase === 'victory') return;

    // 경고 단계
    this.laserPhase = 'warning';
    this.showLaserWarning();

    // 경고 후 발사
    this.time.delayedCall(this.laserWarningDuration, () => {
      if (this.gameOver) return;
      this.laserPhase = 'firing';
      this.activateLasers();

      // 발사 종료
      this.time.delayedCall(this.laserActiveDuration, () => {
        this.deactivateLasers();
        this.laserPhase = 'idle';

        // 다음 발사 사이클
        this.time.delayedCall(this.laserFireInterval - this.laserWarningDuration - this.laserActiveDuration, () => {
          this.fireLaserSequence();
        });
      });
    });
  }

  showLaserWarning() {
    this.laserTurrets.forEach(turret => {
      turret.isWarning = true;
      turret.warningGraphics.setVisible(true);

      // 경고 사운드/효과
      this.cameras.main.shake(100, 0.003);
    });

    // 경고 텍스트
    const warningText = this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 - 50,
      'LASER WARNING!',
      {
        fontSize: '32px',
        fill: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }
    ).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: warningText,
      alpha: { from: 1, to: 0.3 },
      yoyo: true,
      repeat: 2,
      duration: 250,
      onComplete: () => warningText.destroy()
    });
  }

  activateLasers() {
    this.laserTurrets.forEach(turret => {
      turret.isWarning = false;
      turret.isActive = true;
      turret.warningGraphics.setVisible(false);
      turret.laserGraphics.setVisible(true);
    });

    // 발사 플래시 효과
    this.cameras.main.flash(200, 0, 255, 255, false, null, this);
  }

  deactivateLasers() {
    this.laserTurrets.forEach(turret => {
      turret.isActive = false;
      turret.laserGraphics.setVisible(false);
    });
  }

  updateLaserTurretAnimations() {
    const time = this.time.now;

    this.laserTurrets.forEach(turret => {
      // 회전
      turret.angle += this.laserRotationSpeed;
      if (turret.outerRing) {
        turret.outerRing.rotation = turret.angle;
      }

      // 펄스 효과
      turret.pulsePhase += 0.05;
      const pulse = 0.8 + Math.sin(turret.pulsePhase) * 0.2;
      if (turret.baseGlow) {
        turret.baseGlow.setAlpha(0.3 * pulse);
      }

      // 경고 그래픽 업데이트
      if (turret.isWarning) {
        this.drawLaserWarning(turret);
      }

      // 레이저 그래픽 업데이트
      if (turret.isActive) {
        this.drawActiveLaser(turret);
      }
    });
  }

  drawLaserWarning(turret) {
    const gs = this.gridSize;
    const g = turret.warningGraphics;
    g.clear();

    // 점선 경고 라인 (2방향 - 반대 방향)
    const angles = [turret.angle, turret.angle + Math.PI];

    angles.forEach(angle => {
      g.lineStyle(3, 0xffff00, 0.6 + Math.sin(this.time.now * 0.01) * 0.4);

      const dashLength = gs * 0.8;
      const gapLength = gs * 0.4;
      const totalLength = this.laserLength * gs;

      for (let dist = gs; dist < totalLength; dist += dashLength + gapLength) {
        const x1 = Math.cos(angle) * dist;
        const y1 = Math.sin(angle) * dist;
        const x2 = Math.cos(angle) * Math.min(dist + dashLength, totalLength);
        const y2 = Math.sin(angle) * Math.min(dist + dashLength, totalLength);

        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.strokePath();
      }
    });
  }

  drawActiveLaser(turret) {
    const gs = this.gridSize;
    const g = turret.laserGraphics;
    g.clear();

    // 메인 레이저 빔 (2방향)
    const angles = [turret.angle, turret.angle + Math.PI];

    angles.forEach(angle => {
      const endX = Math.cos(angle) * this.laserLength * gs;
      const endY = Math.sin(angle) * this.laserLength * gs;

      // 외곽 글로우
      g.lineStyle(12, 0xff00ff, 0.3);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(endX, endY);
      g.strokePath();

      // 중간 빔
      g.lineStyle(6, 0x00ffff, 0.7);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(endX, endY);
      g.strokePath();

      // 코어 빔
      g.lineStyle(2, 0xffffff, 1);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(endX, endY);
      g.strokePath();
    });
  }

  checkLaserCollision(headX, headY) {
    if (this.laserPhase !== 'firing') return false;

    const gs = this.gridSize;
    const headPixelX = headX * gs + gs / 2;
    const headPixelY = headY * gs + gs / 2 + this.gameAreaY;

    for (const turret of this.laserTurrets) {
      if (!turret.isActive) continue;

      const turretPixelX = turret.x * gs + gs / 2;
      const turretPixelY = turret.y * gs + gs / 2 + this.gameAreaY;

      // 두 방향 레이저 체크
      const angles = [turret.angle, turret.angle + Math.PI];

      for (const angle of angles) {
        // 선분-점 거리 계산
        const laserEndX = turretPixelX + Math.cos(angle) * this.laserLength * gs;
        const laserEndY = turretPixelY + Math.sin(angle) * this.laserLength * gs;

        const dist = this.pointToLineDistance(
          headPixelX, headPixelY,
          turretPixelX, turretPixelY,
          laserEndX, laserEndY
        );

        // 레이저 두께 내에 있으면 충돌
        if (dist < gs * 0.6) {
          return true;
        }
      }
    }

    return false;
  }

  pointToLineDistance(px, py, x1, y1, x2, y2) {
    const A = px - x1;
    const B = py - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = x1;
      yy = y1;
    } else if (param > 1) {
      xx = x2;
      yy = y2;
    } else {
      xx = x1 + param * C;
      yy = y1 + param * D;
    }

    const dx = px - xx;
    const dy = py - yy;
    return Math.sqrt(dx * dx + dy * dy);
  }

  cleanupLaserTurrets() {
    this.laserTurrets.forEach(turret => {
      if (turret.container) turret.container.destroy(true);
    });
    this.laserTurrets = [];

    if (this.laserAnimTimer) {
      this.laserAnimTimer.destroy();
      this.laserAnimTimer = null;
    }

    if (this.laserFireTimer) {
      this.laserFireTimer.destroy();
      this.laserFireTimer = null;
    }

    this.laserPhase = 'idle';

    console.log('[LaserTurrets] Cleaned up');
  }

  // =====================================================
  // ===== FLOATING MINES (Stage -1: Flux Maze) =====
  // =====================================================

  startMineSpawner() {
    if (this.mineSpawnTimer) return;

    this.mineSpawnTimer = this.time.addEvent({
      delay: this.mineSpawnInterval,
      callback: this.spawnFloatingMine,
      callbackScope: this,
      loop: true
    });

    console.log('[Mines] Spawner started');
  }

  stopMineSpawner() {
    if (this.mineSpawnTimer) {
      this.mineSpawnTimer.destroy();
      this.mineSpawnTimer = null;
    }
  }

  spawnFloatingMine() {
    if (this.floatingMines.length >= this.maxFloatingMines) return;
    if (this.gameOver) return;

    const pos = this.getMineSpawnPosition();
    if (!pos) return;

    const gs = this.gridSize;
    const x = pos.x * gs + gs / 2;
    const y = pos.y * gs + gs / 2 + this.gameAreaY;

    const container = this.add.container(x, y).setDepth(70);

    // 경고 글로우 (뒤)
    const glow = this.add.graphics();
    glow.fillStyle(0xff6600, 0.25);
    glow.fillCircle(0, 0, gs * 0.6);
    container.add(glow);

    // 기뢰 본체
    const body = this.add.graphics();
    body.fillStyle(0x444444, 1);
    body.fillCircle(0, 0, gs * 0.35);
    body.lineStyle(2, 0x666666, 1);
    body.strokeCircle(0, 0, gs * 0.35);
    container.add(body);

    // 스파이크들
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const spike = this.add.graphics();
      spike.fillStyle(0x888888, 1);
      spike.beginPath();
      const innerR = gs * 0.3;
      const outerR = gs * 0.5;
      spike.moveTo(Math.cos(angle - 0.15) * innerR, Math.sin(angle - 0.15) * innerR);
      spike.lineTo(Math.cos(angle) * outerR, Math.sin(angle) * outerR);
      spike.lineTo(Math.cos(angle + 0.15) * innerR, Math.sin(angle + 0.15) * innerR);
      spike.closePath();
      spike.fillPath();
      container.add(spike);
    }

    // 위험 표시 (중앙)
    const danger = this.add.text(0, 0, '!', {
      fontSize: '12px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    container.add(danger);

    // 랜덤 방향
    const directions = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];
    const dir = Phaser.Math.RND.pick(directions);

    const mine = {
      x: pos.x,
      y: pos.y,
      element: container,
      glow: glow,
      dx: dir.dx,
      dy: dir.dy,
      moveTimer: null
    };

    // 생성 애니메이션
    container.setScale(0).setAlpha(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 400,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.startMineMovement(mine);
      }
    });

    // 호흡 애니메이션
    this.tweens.add({
      targets: glow,
      alpha: 0.15,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    this.floatingMines.push(mine);

    console.log('[Mines] Spawned mine at', pos.x, pos.y, '- total:', this.floatingMines.length);
  }

  getMineSpawnPosition() {
    const edges = [];

    // 맵 가장자리
    for (let x = 2; x < this.cols - 2; x++) {
      edges.push({ x, y: 1 });
      edges.push({ x, y: this.rows - 2 });
    }
    for (let y = 2; y < this.rows - 2; y++) {
      edges.push({ x: 1, y });
      edges.push({ x: this.cols - 2, y });
    }

    Phaser.Utils.Array.Shuffle(edges);

    for (const pos of edges) {
      const notOnSnake = !this.snake.some(s => s.x === pos.x && s.y === pos.y);
      const notOnFood = !(this.food && this.food.x === pos.x && this.food.y === pos.y);
      const notOnTurret = !this.isTurretAtPosition(pos.x, pos.y);
      const notOnMine = !this.floatingMines.some(m => m.x === pos.x && m.y === pos.y);
      const notOnDeadzone = !this.deadZones.some(d => d.x === pos.x && d.y === pos.y);
      const notInGas = !this.isInGasZone(pos.x, pos.y);

      if (notOnSnake && notOnFood && notOnTurret && notOnMine && notOnDeadzone && notInGas) {
        return pos;
      }
    }

    return null;
  }

  startMineMovement(mine) {
    mine.moveTimer = this.time.addEvent({
      delay: this.mineSpeed,
      callback: () => this.moveFloatingMine(mine),
      loop: true
    });
  }

  moveFloatingMine(mine) {
    if (this.gameOver || !mine || !mine.element) return;

    let newX = mine.x + mine.dx;
    let newY = mine.y + mine.dy;

    // 경계 체크 및 반사
    let bounced = false;
    if (newX < 1 || newX >= this.cols - 1) {
      mine.dx *= -1;
      newX = mine.x;
      bounced = true;
    }
    if (newY < 1 || newY >= this.rows - 1) {
      mine.dy *= -1;
      newY = mine.y;
      bounced = true;
    }

    // 터렛 충돌 체크 (반사)
    if (this.isTurretAtPosition(newX, newY)) {
      mine.dx *= -1;
      mine.dy *= -1;
      bounced = true;
      newX = mine.x;
      newY = mine.y;
    }

    // 가스존 체크 (들어가지 않음)
    if (this.isInGasZone(newX, newY)) {
      mine.dx *= -1;
      mine.dy *= -1;
      bounced = true;
      newX = mine.x;
      newY = mine.y;
    }

    if (!bounced) {
      // 가끔 방향 변경 (15%)
      if (Math.random() < 0.15) {
        const directions = [
          { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
          { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
        ];
        const newDir = Phaser.Math.RND.pick(directions);
        mine.dx = newDir.dx;
        mine.dy = newDir.dy;
      }

      // 이동
      mine.x = newX;
      mine.y = newY;

      const gs = this.gridSize;
      const targetX = newX * gs + gs / 2;
      const targetY = newY * gs + gs / 2 + this.gameAreaY;

      this.tweens.add({
        targets: mine.element,
        x: targetX,
        y: targetY,
        duration: this.mineSpeed * 0.7,
        ease: 'Linear'
      });
    }
  }

  checkMineCollision() {
    if (this.floatingMines.length === 0) return false;
    if (!this.snake || !this.snake[0]) return false;

    const head = this.snake[0];

    for (let i = this.floatingMines.length - 1; i >= 0; i--) {
      const mine = this.floatingMines[i];
      if (mine.x === head.x && mine.y === head.y) {
        this.handleMineHit(mine, i);
        return true;
      }
    }

    return false;
  }

  handleMineHit(mine, index) {
    const x = mine.element.x;
    const y = mine.element.y;

    // 폭발 파티클
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const particle = this.add.graphics().setDepth(200);
      particle.fillStyle(0xff6600, 1);
      particle.fillCircle(0, 0, 4);
      particle.x = x;
      particle.y = y;

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * 50,
        y: y + Math.sin(angle) * 50,
        alpha: 0,
        duration: 350,
        onComplete: () => particle.destroy()
      });
    }

    // 폭발 플래시
    const flash = this.add.graphics().setDepth(195);
    flash.fillStyle(0xff6600, 0.6);
    flash.fillCircle(x, y, this.gridSize);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      scaleX: 2,
      scaleY: 2,
      duration: 200,
      onComplete: () => flash.destroy()
    });

    // 기뢰 제거
    this.destroyMine(mine, index);

    // 카메라 쉐이크
    this.cameras.main.shake(150, 0.015);

    // 몸통 1칸 제거
    if (this.snake.length > 3) {
      const removedSegment = this.snake.pop();

      // 제거된 세그먼트 플래시
      const segX = removedSegment.x * this.gridSize + this.gridSize / 2;
      const segY = removedSegment.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

      const segFlash = this.add.graphics().setDepth(150);
      segFlash.fillStyle(0xff0000, 0.8);
      segFlash.fillRect(
        removedSegment.x * this.gridSize,
        removedSegment.y * this.gridSize + this.gameAreaY,
        this.gridSize,
        this.gridSize
      );

      this.tweens.add({
        targets: segFlash,
        alpha: 0,
        duration: 300,
        onComplete: () => segFlash.destroy()
      });

      // 경고 텍스트
      const warningText = this.add.text(segX, segY - 20, '-1 SEGMENT!', {
        fontSize: '14px',
        fill: '#ff4400',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(200);

      this.tweens.add({
        targets: warningText,
        y: segY - 50,
        alpha: 0,
        duration: 800,
        onComplete: () => warningText.destroy()
      });

      // 뱀 다시 그리기
      this.draw();

      console.log('[Mines] Snake hit! Length:', this.snake.length);
    } else {
      // 뱀이 너무 짧으면 즉사
      console.log('[Mines] Snake too short - game over!');
      this.endGame();
    }
  }

  destroyMine(mine, index) {
    if (mine.moveTimer) {
      mine.moveTimer.destroy();
      mine.moveTimer = null;
    }

    if (mine.element) {
      mine.element.destroy();
    }

    if (index !== undefined) {
      this.floatingMines.splice(index, 1);
    } else {
      const idx = this.floatingMines.indexOf(mine);
      if (idx > -1) this.floatingMines.splice(idx, 1);
    }
  }

  cleanupFloatingMines() {
    this.stopMineSpawner();

    this.floatingMines.forEach(mine => {
      if (mine.moveTimer) mine.moveTimer.destroy();
      if (mine.element) mine.element.destroy();
    });
    this.floatingMines = [];

    console.log('[Mines] Cleaned up');
  }

  isMineAtPosition(x, y) {
    return this.floatingMines.some(m => m.x === x && m.y === y);
  }

  // ========== Magnetar 보스 시스템 (Stage 0) ==========

  startMagnetar() {
    console.log('[Magnetar] Starting boss battle');
    this.magnetarMode = true;
    this.magnetarPhase = 'intro';
    this.magnetarHitCount = 0;
    this.magnetarControlsReversed = false;
    this.magnetarPosition = {
      x: Math.floor(this.cols / 2),
      y: Math.floor(this.rows / 2)
    };

    // 보스 이미지 생성
    this.createMagnetarBoss();

    // 인트로 시퀀스
    this.showMagnetarIntro();
  }

  createMagnetarBoss() {
    const centerX = this.magnetarPosition.x * this.gridSize + this.gridSize / 2;
    const centerY = this.magnetarPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 보스 컨테이너
    this.magnetarElement = this.add.container(centerX, centerY);

    // 중앙 코어 (자석 모양)
    const core = this.add.graphics();
    core.fillStyle(0x444466, 1);
    core.fillCircle(0, 0, 25);
    core.fillStyle(0x6666aa, 1);
    core.fillCircle(0, 0, 18);
    this.magnetarElement.add(core);

    // N극 (파란색 위)
    const northPole = this.add.graphics();
    northPole.fillStyle(0x00aaff, 1);
    northPole.fillRect(-12, -30, 24, 12);
    northPole.fillStyle(0x00ddff, 1);
    northPole.fillRect(-8, -28, 16, 8);
    this.magnetarElement.add(northPole);

    // S극 (빨간색 아래)
    const southPole = this.add.graphics();
    southPole.fillStyle(0xff4400, 1);
    southPole.fillRect(-12, 18, 24, 12);
    southPole.fillStyle(0xff6644, 1);
    southPole.fillRect(-8, 20, 16, 8);
    this.magnetarElement.add(southPole);

    // N/S 라벨
    const nLabel = this.add.text(0, -24, 'N', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.magnetarElement.add(nLabel);

    const sLabel = this.add.text(0, 24, 'S', {
      fontSize: '10px',
      fontFamily: 'monospace',
      color: '#ffffff'
    }).setOrigin(0.5);
    this.magnetarElement.add(sLabel);

    // 자기장 링 효과
    this.magnetarRings = [];
    for (let i = 0; i < 3; i++) {
      const ring = this.add.graphics();
      ring.lineStyle(2, i === 0 ? 0x00aaff : (i === 1 ? 0xff4400 : 0xaa44ff), 0.5);
      ring.strokeCircle(0, 0, 35 + i * 15);
      this.magnetarElement.add(ring);
      this.magnetarRings.push(ring);
    }

    // 펄스 애니메이션
    this.tweens.add({
      targets: this.magnetarElement,
      scaleX: 1.1,
      scaleY: 1.1,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 회전 애니메이션 (링)
    this.magnetarRingTimer = this.time.addEvent({
      delay: 50,
      callback: () => {
        this.magnetarRings.forEach((ring, i) => {
          ring.rotation += (i % 2 === 0 ? 0.02 : -0.02);
        });
      },
      loop: true
    });

    this.magnetarElement.setDepth(100);
    this.magnetarElement.setAlpha(0);
  }

  showMagnetarIntro() {
    const { width, height } = this.cameras.main;

    // 화면 어둡게
    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7);
    overlay.setDepth(90);

    // WARNING 텍스트
    const warningText = this.add.text(width / 2, height / 2 - 80, '⚡ WARNING ⚡', {
      fontSize: '36px',
      fontFamily: 'monospace',
      color: '#ff4400'
    }).setOrigin(0.5).setDepth(95);

    this.tweens.add({
      targets: warningText,
      alpha: 0.3,
      duration: 300,
      yoyo: true,
      repeat: 4
    });

    // 카메라 쉐이크
    this.cameras.main.shake(500, 0.01);

    // 보스 등장
    this.time.delayedCall(1500, () => {
      // 보스 페이드인
      this.tweens.add({
        targets: this.magnetarElement,
        alpha: 1,
        duration: 500,
        ease: 'Power2'
      });

      // 자기장 플래시 효과
      const flash = this.add.graphics();
      flash.fillStyle(0x00aaff, 0.5);
      flash.fillCircle(width / 2, height / 2 + 30, 200);
      flash.setDepth(91);

      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 500,
        onComplete: () => flash.destroy()
      });
    });

    // 보스 대사
    this.time.delayedCall(2500, () => {
      const dialogue1 = this.add.text(width / 2, height / 2 + 100, '"I am MAGNETAR..."', {
        fontSize: '20px',
        fontFamily: 'monospace',
        color: '#00ffff'
      }).setOrigin(0.5).setDepth(95);

      this.time.delayedCall(1500, () => {
        dialogue1.setText('"Feel my magnetic force!"');

        this.time.delayedCall(1500, () => {
          // 인트로 종료, 게임 시작
          overlay.destroy();
          warningText.destroy();
          dialogue1.destroy();

          this.magnetarPhase = 'phase1';
          this.moveTimer.paused = false;

          // Phase 1 시작
          this.startMagnetarPhase1();
        });
      });
    });
  }

  startMagnetarPhase1() {
    console.log('[Magnetar] Phase 1: Reverse Field');
    this.magnetarPhase = 'phase1';

    // Phase 1 안내
    this.showMagnetarPhaseText('PHASE 1: REVERSE FIELD');

    // 조작 반전 시작
    this.time.delayedCall(2000, () => {
      this.startReverseFieldCycle();
    });
  }

  startReverseFieldCycle() {
    if (this.magnetarPhase !== 'phase1' || !this.magnetarMode) return;

    // 조작 반전 경고
    this.showReverseFieldWarning();

    this.time.delayedCall(2000, () => {
      if (this.magnetarPhase !== 'phase1' || !this.magnetarMode) return;

      // 조작 반전 활성화
      this.activateReverseField();

      // 5초 후 반전 해제
      this.time.delayedCall(5000, () => {
        this.deactivateReverseField();

        // 3초 후 다시 반전 (사이클)
        this.time.delayedCall(3000, () => {
          if (this.magnetarPhase === 'phase1' && this.magnetarMode) {
            this.startReverseFieldCycle();
          }
        });
      });
    });
  }

  showReverseFieldWarning() {
    const { width, height } = this.cameras.main;

    // 경고 테두리
    const warningBorder = this.add.graphics();
    warningBorder.lineStyle(8, 0xaa00ff, 1);
    warningBorder.strokeRect(5, 5, width - 10, height - 10);
    warningBorder.setDepth(200);

    this.tweens.add({
      targets: warningBorder,
      alpha: 0,
      duration: 200,
      yoyo: true,
      repeat: 4,
      onComplete: () => warningBorder.destroy()
    });

    // 경고 텍스트
    const warningText = this.add.text(width / 2, height / 2 - 100, '⚠ MAGNETIC REVERSAL ⚠', {
      fontSize: '24px',
      fontFamily: 'monospace',
      color: '#ff00ff'
    }).setOrigin(0.5).setDepth(201);

    this.tweens.add({
      targets: warningText,
      alpha: 0,
      y: height / 2 - 120,
      duration: 1500,
      onComplete: () => warningText.destroy()
    });
  }

  activateReverseField() {
    this.magnetarControlsReversed = true;
    console.log('[Magnetar] Controls REVERSED!');

    const { width, height } = this.cameras.main;

    // 반전 활성 UI
    this.reverseFieldOverlay = this.add.graphics();
    this.reverseFieldOverlay.lineStyle(4, 0xaa00ff, 0.8);
    this.reverseFieldOverlay.strokeRect(10, 10, width - 20, height - 20);
    this.reverseFieldOverlay.setDepth(199);

    // 펄스 효과
    this.tweens.add({
      targets: this.reverseFieldOverlay,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // "CONTROLS REVERSED!" 텍스트
    this.reverseFieldText = this.add.text(width / 2, 90, 'CONTROLS REVERSED!', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#ff00ff',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: this.reverseFieldText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 300,
      yoyo: true,
      repeat: -1
    });
  }

  deactivateReverseField() {
    this.magnetarControlsReversed = false;
    console.log('[Magnetar] Controls restored');

    // UI 정리
    if (this.reverseFieldOverlay) {
      this.tweens.killTweensOf(this.reverseFieldOverlay);
      this.reverseFieldOverlay.destroy();
      this.reverseFieldOverlay = null;
    }
    if (this.reverseFieldText) {
      this.tweens.killTweensOf(this.reverseFieldText);
      this.reverseFieldText.destroy();
      this.reverseFieldText = null;
    }

    // 복원 피드백
    const { width, height } = this.cameras.main;
    const restoreText = this.add.text(width / 2, 90, 'CONTROLS RESTORED', {
      fontSize: '18px',
      fontFamily: 'monospace',
      color: '#00ff00',
      backgroundColor: '#000000',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: restoreText,
      alpha: 0,
      y: 70,
      duration: 1000,
      onComplete: () => restoreText.destroy()
    });
  }

  showMagnetarPhaseText(text) {
    const { width, height } = this.cameras.main;

    const phaseText = this.add.text(width / 2, height / 2, text, {
      fontSize: '32px',
      fontFamily: 'monospace',
      color: '#00ffff'
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: phaseText,
      scaleX: 1.2,
      scaleY: 1.2,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => phaseText.destroy()
    });
  }

  handleMagnetarHit() {
    this.magnetarHitCount++;
    console.log(`[Magnetar] HIT ${this.magnetarHitCount}/6`);

    const { width, height } = this.cameras.main;

    // HIT 표시
    const hitText = this.add.text(width / 2, height / 2 - 50, `HIT ${this.magnetarHitCount}/6!`, {
      fontSize: '36px',
      fontFamily: 'monospace',
      color: '#ffff00'
    }).setOrigin(0.5).setDepth(300);

    this.tweens.add({
      targets: hitText,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 1000,
      onComplete: () => hitText.destroy()
    });

    // 보스 피격 효과
    this.cameras.main.shake(300, 0.02);
    this.tweens.add({
      targets: this.magnetarElement,
      alpha: 0.3,
      duration: 100,
      yoyo: true,
      repeat: 3
    });

    // Phase 전환
    if (this.magnetarHitCount === 1 && this.magnetarPhase === 'phase1') {
      this.deactivateReverseField();
      this.time.delayedCall(1000, () => {
        this.startMagnetarPhase2();
      });
    } else if (this.magnetarHitCount === 2 && this.magnetarPhase === 'phase2') {
      this.stopEMPBeams();
      this.time.delayedCall(1000, () => {
        this.startMagnetarPhase3();
      });
    } else if (this.magnetarHitCount >= 6) {
      // 승리!
      this.showMagnetarVictory();
    }
  }

  // Phase 2: EMP Beam
  startMagnetarPhase2() {
    console.log('[Magnetar] Phase 2: EMP Beam');
    this.magnetarPhase = 'phase2';

    this.showMagnetarPhaseText('PHASE 2: EMP BEAM');

    // EMP 레이저 공격 시작
    this.time.delayedCall(2000, () => {
      this.startEMPBeamCycle();
    });
  }

  startEMPBeamCycle() {
    if (this.magnetarPhase !== 'phase2' || !this.magnetarMode) return;

    // 랜덤 패턴 선택 (십자 또는 X자)
    const pattern = Phaser.Math.Between(0, 1) === 0 ? 'cross' : 'x';
    this.showEMPBeamWarning(pattern);

    this.time.delayedCall(1000, () => {
      if (this.magnetarPhase !== 'phase2' || !this.magnetarMode) return;

      this.fireEMPBeam(pattern);

      // 3초 후 다음 빔
      this.time.delayedCall(3000, () => {
        if (this.magnetarPhase === 'phase2' && this.magnetarMode) {
          this.startEMPBeamCycle();
        }
      });
    });
  }

  showEMPBeamWarning(pattern) {
    const centerX = this.magnetarPosition.x * this.gridSize + this.gridSize / 2;
    const centerY = this.magnetarPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
    const { width, height } = this.cameras.main;

    this.empWarningLines = [];

    if (pattern === 'cross') {
      // 십자 경고선
      const hLine = this.add.graphics();
      hLine.lineStyle(3, 0xffff00, 0.5);
      hLine.lineBetween(0, centerY, width, centerY);
      hLine.setDepth(150);
      this.empWarningLines.push(hLine);

      const vLine = this.add.graphics();
      vLine.lineStyle(3, 0xffff00, 0.5);
      vLine.lineBetween(centerX, this.gameAreaY, centerX, height);
      vLine.setDepth(150);
      this.empWarningLines.push(vLine);
    } else {
      // X자 경고선
      const line1 = this.add.graphics();
      line1.lineStyle(3, 0xffff00, 0.5);
      line1.lineBetween(0, this.gameAreaY, width, height);
      line1.setDepth(150);
      this.empWarningLines.push(line1);

      const line2 = this.add.graphics();
      line2.lineStyle(3, 0xffff00, 0.5);
      line2.lineBetween(width, this.gameAreaY, 0, height);
      line2.setDepth(150);
      this.empWarningLines.push(line2);
    }

    // 경고선 깜빡임
    this.empWarningLines.forEach(line => {
      this.tweens.add({
        targets: line,
        alpha: 0.2,
        duration: 150,
        yoyo: true,
        repeat: 3
      });
    });
  }

  fireEMPBeam(pattern) {
    // 경고선 제거
    this.empWarningLines.forEach(line => line.destroy());
    this.empWarningLines = [];

    const centerX = this.magnetarPosition.x * this.gridSize + this.gridSize / 2;
    const centerY = this.magnetarPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
    const { width, height } = this.cameras.main;

    this.empBeamLines = [];
    this.empBeamPattern = pattern;

    if (pattern === 'cross') {
      // 십자 레이저
      const hBeam = this.add.graphics();
      hBeam.fillStyle(0xff00ff, 0.9);
      hBeam.fillRect(0, centerY - 8, width, 16);
      hBeam.setDepth(160);
      this.empBeamLines.push(hBeam);

      const vBeam = this.add.graphics();
      vBeam.fillStyle(0xff00ff, 0.9);
      vBeam.fillRect(centerX - 8, this.gameAreaY, 16, height - this.gameAreaY);
      vBeam.setDepth(160);
      this.empBeamLines.push(vBeam);
    } else {
      // X자 레이저 (대각선은 그래픽으로 표현이 복잡하므로 단순화)
      const diag1 = this.add.graphics();
      diag1.lineStyle(16, 0xff00ff, 0.9);
      diag1.lineBetween(0, this.gameAreaY, width, height);
      diag1.setDepth(160);
      this.empBeamLines.push(diag1);

      const diag2 = this.add.graphics();
      diag2.lineStyle(16, 0xff00ff, 0.9);
      diag2.lineBetween(width, this.gameAreaY, 0, height);
      diag2.setDepth(160);
      this.empBeamLines.push(diag2);
    }

    // 레이저 발사 효과음 + 화면 플래시
    this.cameras.main.flash(100, 255, 0, 255);

    // 레이저 활성 시간 (0.5초)
    this.empBeamActive = true;

    this.time.delayedCall(500, () => {
      this.empBeamActive = false;
      this.empBeamLines.forEach(beam => beam.destroy());
      this.empBeamLines = [];
    });
  }

  stopEMPBeams() {
    this.empBeamActive = false;
    if (this.empWarningLines) {
      this.empWarningLines.forEach(line => line.destroy());
      this.empWarningLines = [];
    }
    if (this.empBeamLines) {
      this.empBeamLines.forEach(beam => beam.destroy());
      this.empBeamLines = [];
    }
  }

  isOnEMPBeam(x, y) {
    if (!this.empBeamActive || !this.magnetarMode) return false;

    const tileX = x * this.gridSize + this.gridSize / 2;
    const tileY = y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
    const centerX = this.magnetarPosition.x * this.gridSize + this.gridSize / 2;
    const centerY = this.magnetarPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    if (this.empBeamPattern === 'cross') {
      // 십자 레이저: 중심 X나 Y와 겹치면 피격
      const onHorizontal = Math.abs(tileY - centerY) < 20;
      const onVertical = Math.abs(tileX - centerX) < 20;
      return onHorizontal || onVertical;
    } else {
      // X자 레이저: 대각선상에 있으면 피격 (근사치)
      const { width, height } = this.cameras.main;
      const ratio1 = (tileX) / width;
      const ratio2 = 1 - ratio1;
      const expectedY1 = this.gameAreaY + ratio1 * (height - this.gameAreaY);
      const expectedY2 = this.gameAreaY + ratio2 * (height - this.gameAreaY);
      return Math.abs(tileY - expectedY1) < 25 || Math.abs(tileY - expectedY2) < 25;
    }
  }

  // Phase 3: Event Horizon
  startMagnetarPhase3() {
    console.log('[Magnetar] Phase 3: Event Horizon');
    this.magnetarPhase = 'phase3';

    this.showMagnetarPhaseText('PHASE 3: EVENT HORIZON');

    // 가스 자기장 가속
    if (this.gasZoneTimer) {
      this.gasZoneTimer.remove();
    }
    this.gasZoneTimer = this.time.addEvent({
      delay: this.magnetarPhase3GasInterval, // 800ms
      callback: () => this.expandGasZone(),
      loop: true
    });

    // 4개 보호막 생성기 생성
    this.time.delayedCall(2000, () => {
      this.createShieldGenerators();
    });
  }

  createShieldGenerators() {
    this.shieldGenerators = [];
    const centerX = this.magnetarPosition.x;
    const centerY = this.magnetarPosition.y;
    const orbitRadius = 6; // 타일 단위

    // 4개 생성기를 원형으로 배치
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI / 2) + Math.PI / 4; // 45도부터 시작
      const gx = Math.round(centerX + Math.cos(angle) * orbitRadius);
      const gy = Math.round(centerY + Math.sin(angle) * orbitRadius);

      const generator = {
        x: gx,
        y: gy,
        angle: angle,
        alive: true,
        element: null
      };

      // 생성기 시각화
      const pixelX = gx * this.gridSize + this.gridSize / 2;
      const pixelY = gy * this.gridSize + this.gridSize / 2 + this.gameAreaY;

      const container = this.add.container(pixelX, pixelY);

      // 크리스탈 모양
      const crystal = this.add.graphics();
      crystal.fillStyle(0x00ffff, 1);
      crystal.fillTriangle(0, -12, -8, 8, 8, 8);
      crystal.fillStyle(0x00aaff, 0.8);
      crystal.fillTriangle(0, -8, -5, 5, 5, 5);
      container.add(crystal);

      // 에너지 빔 (보스로 연결)
      const beam = this.add.graphics();
      beam.lineStyle(2, 0x00ffff, 0.5);
      const bossPixelX = centerX * this.gridSize + this.gridSize / 2;
      const bossPixelY = centerY * this.gridSize + this.gridSize / 2 + this.gameAreaY;
      beam.lineBetween(0, 0, bossPixelX - pixelX, bossPixelY - pixelY);
      container.add(beam);

      container.setDepth(95);
      generator.element = container;

      // 펄스 애니메이션
      this.tweens.add({
        targets: container,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 500,
        yoyo: true,
        repeat: -1
      });

      this.shieldGenerators.push(generator);
    }

    // 공전 타이머
    this.generatorOrbitTimer = this.time.addEvent({
      delay: 100,
      callback: () => this.updateGeneratorOrbits(),
      loop: true
    });

    console.log('[Magnetar] Shield generators created');
  }

  updateGeneratorOrbits() {
    if (!this.shieldGenerators || !this.magnetarMode) return;

    const centerX = this.magnetarPosition.x;
    const centerY = this.magnetarPosition.y;
    const orbitRadius = 6;

    this.shieldGenerators.forEach(gen => {
      if (!gen.alive) return;

      // 공전 (시계 방향)
      gen.angle += 0.02;
      gen.x = Math.round(centerX + Math.cos(gen.angle) * orbitRadius);
      gen.y = Math.round(centerY + Math.sin(gen.angle) * orbitRadius);

      // 위치 업데이트
      if (gen.element) {
        const pixelX = gen.x * this.gridSize + this.gridSize / 2;
        const pixelY = gen.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
        gen.element.setPosition(pixelX, pixelY);
      }
    });
  }

  checkGeneratorCollision(x, y) {
    if (!this.shieldGenerators || this.magnetarPhase !== 'phase3') return false;

    for (const gen of this.shieldGenerators) {
      if (gen.alive && gen.x === x && gen.y === y) {
        this.destroyGenerator(gen);
        return true;
      }
    }
    return false;
  }

  destroyGenerator(gen) {
    gen.alive = false;

    // 폭발 효과
    const pixelX = gen.x * this.gridSize + this.gridSize / 2;
    const pixelY = gen.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 파티클
    for (let i = 0; i < 8; i++) {
      const particle = this.add.circle(pixelX, pixelY, 4, 0x00ffff);
      const angle = (i / 8) * Math.PI * 2;
      this.tweens.add({
        targets: particle,
        x: pixelX + Math.cos(angle) * 50,
        y: pixelY + Math.sin(angle) * 50,
        alpha: 0,
        duration: 500,
        onComplete: () => particle.destroy()
      });
    }

    // 요소 제거
    if (gen.element) {
      this.tweens.killTweensOf(gen.element);
      gen.element.destroy();
      gen.element = null;
    }

    // HIT 카운트 증가
    this.magnetarHitCount++;
    console.log(`[Magnetar] Generator destroyed! HIT ${this.magnetarHitCount}/6`);

    // 승리 체크
    const aliveCount = this.shieldGenerators.filter(g => g.alive).length;
    if (aliveCount === 0) {
      this.showMagnetarVictory();
    } else {
      // HIT 표시
      const { width, height } = this.cameras.main;
      const hitText = this.add.text(width / 2, height / 2 - 50, `GENERATOR ${4 - aliveCount}/4!`, {
        fontSize: '24px',
        fontFamily: 'monospace',
        color: '#00ffff'
      }).setOrigin(0.5).setDepth(300);

      this.tweens.add({
        targets: hitText,
        alpha: 0,
        y: height / 2 - 80,
        duration: 1000,
        onComplete: () => hitText.destroy()
      });
    }
  }

  showMagnetarVictory() {
    console.log('[Magnetar] Victory!');
    this.magnetarPhase = 'victory';
    this.moveTimer.paused = true;

    const { width, height } = this.cameras.main;

    // 보스 폭발
    this.cameras.main.shake(1000, 0.03);
    this.cameras.main.flash(500, 255, 255, 255);

    // 보스 사라짐
    if (this.magnetarElement) {
      this.tweens.add({
        targets: this.magnetarElement,
        scaleX: 2,
        scaleY: 2,
        alpha: 0,
        duration: 1000,
        onComplete: () => {
          this.magnetarElement.destroy();
          this.magnetarElement = null;
        }
      });
    }

    // 폭발 파티클
    const centerX = this.magnetarPosition.x * this.gridSize + this.gridSize / 2;
    const centerY = this.magnetarPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    for (let i = 0; i < 20; i++) {
      const color = [0x00ffff, 0xff00ff, 0xffff00][i % 3];
      const particle = this.add.circle(centerX, centerY, 8, color);
      const angle = (i / 20) * Math.PI * 2;
      const dist = Phaser.Math.Between(80, 150);
      this.tweens.add({
        targets: particle,
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 1500,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 승리 텍스트
    this.time.delayedCall(1500, () => {
      const victoryText = this.add.text(width / 2, height / 2 - 30, 'BOSS CLEAR!', {
        fontSize: '48px',
        fontFamily: 'monospace',
        color: '#00ff00'
      }).setOrigin(0.5).setDepth(300);

      this.tweens.add({
        targets: victoryText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 500,
        yoyo: true,
        repeat: 2
      });

      // 보너스 점수
      this.time.delayedCall(1000, () => {
        const bonusText = this.add.text(width / 2, height / 2 + 30, '+1000 BONUS!', {
          fontSize: '32px',
          fontFamily: 'monospace',
          color: '#ffff00'
        }).setOrigin(0.5).setDepth(300);

        this.score += 1000;
        this.scoreText.setText(this.score.toString());

        // 정리 및 다음 단계
        this.time.delayedCall(2000, () => {
          victoryText.destroy();
          bonusText.destroy();
          this.cleanupMagnetar();

          // 스테이지 클리어 처리
          this.magnetarMode = false;
          this.stageClear();
        });
      });
    });
  }

  cleanupMagnetar() {
    console.log('[Magnetar] Cleanup');

    // 조작 반전 해제
    this.deactivateReverseField();

    // 보스 요소 정리
    if (this.magnetarElement) {
      this.tweens.killTweensOf(this.magnetarElement);
      this.magnetarElement.destroy();
      this.magnetarElement = null;
    }

    // 링 타이머 정리
    if (this.magnetarRingTimer) {
      this.magnetarRingTimer.destroy();
      this.magnetarRingTimer = null;
    }

    // EMP 빔 정리
    this.stopEMPBeams();

    // 생성기 정리
    if (this.shieldGenerators) {
      this.shieldGenerators.forEach(gen => {
        if (gen.element) {
          this.tweens.killTweensOf(gen.element);
          gen.element.destroy();
        }
      });
      this.shieldGenerators = [];
    }

    if (this.generatorOrbitTimer) {
      this.generatorOrbitTimer.destroy();
      this.generatorOrbitTimer = null;
    }

    // 상태 초기화
    this.magnetarMode = false;
    this.magnetarPhase = 'none';
    this.magnetarHitCount = 0;
    this.magnetarControlsReversed = false;
    this.empBeamActive = false;
  }

  // ========== 탄막 슈팅 보스 시스템 (Bullet Hell Boss) ==========

  // 회피 시스템 - 스페이스바로 사이드 롤
  handleDodge() {
    // 🆕 QTE 닷지 체크 (The Presence 시스템)
    if (this.dodgeQTEActive) {
      this.handleDodgeQTEInput();
      return;
    }

    // 쿨다운 체크
    const now = Date.now();
    if (now - this.lastDodgeTime < this.dodgeCooldown) {
      // 쿨다운 중 - 실패 피드백
      this.showDodgeCooldownFeedback();
      return;
    }

    // 게임 상태 체크 - 탄막 보스 또는 안개 보스 모드에서만
    if (this.gameOver) return;
    if (!this.bulletBossMode && !this.fogBossMode) return;

    // 회피 실행
    this.lastDodgeTime = now;
    this.canDodge = false;
    this.performSideRoll();

    // 쿨다운 후 회피 가능
    this.time.delayedCall(this.dodgeCooldown, () => {
      this.canDodge = true;
      this.updateDodgeCooldownUI();
    });
  }

  performSideRoll() {
    const head = this.snake[0];
    const direction = this.direction;
    let rollDx = 0;
    let rollDy = 0;
    const rollDistance = 3; // 3칸 이동
    let rollAngle = 0; // 구르기 방향 각도

    // 진행 방향에 수직인 방향으로 롤
    if (direction === 'LEFT' || direction === 'RIGHT') {
      // 위/아래로 번갈아가며 롤
      if (this.lastDodgeDirection === 'up') {
        rollDy = rollDistance;
        rollAngle = direction === 'RIGHT' ? Math.PI : -Math.PI;
        this.lastDodgeDirection = 'down';
      } else {
        rollDy = -rollDistance;
        rollAngle = direction === 'RIGHT' ? -Math.PI : Math.PI;
        this.lastDodgeDirection = 'up';
      }
    } else {
      // 좌/우로 번갈아가며 롤
      if (this.lastDodgeDirection === 'left') {
        rollDx = rollDistance;
        rollAngle = direction === 'DOWN' ? -Math.PI : Math.PI;
        this.lastDodgeDirection = 'right';
      } else {
        rollDx = -rollDistance;
        rollAngle = direction === 'DOWN' ? Math.PI : -Math.PI;
        this.lastDodgeDirection = 'left';
      }
    }

    // 새 위치 계산 (벽 클램핑)
    let newX = Math.max(0, Math.min(this.cols - 1, head.x + rollDx));
    let newY = Math.max(0, Math.min(this.rows - 1, head.y + rollDy));

    // 원래 위치 저장
    const originalPositions = this.snake.map(s => ({ x: s.x, y: s.y }));

    // 무적 상태 시작
    this.isInvincible = true;

    // 뱀 전체를 새 위치로 이동 (순간이동)
    const offsetX = newX - head.x;
    const offsetY = newY - head.y;

    for (let i = 0; i < this.snake.length; i++) {
      this.snake[i].x += offsetX;
      this.snake[i].y += offsetY;

      // 벽 클램핑 (각 세그먼트)
      this.snake[i].x = Math.max(0, Math.min(this.cols - 1, this.snake[i].x));
      this.snake[i].y = Math.max(0, Math.min(this.rows - 1, this.snake[i].y));
    }

    // === 고급 구르기 이펙트 ===
    this.createAdvancedRollEffect(originalPositions, offsetX, offsetY, rollAngle);

    // 회피 이펙트 표시
    this.showDodgeEffect(newX, newY);

    // 카메라 쉐이크
    this.cameras.main.shake(80, 0.008);

    // 무적 깜빡임 애니메이션
    this.startInvincibilityBlink();

    // 보호막 이펙트 시작
    this.startPostDodgeShield();

    // 무적 해제 (600ms 후 - 반응 시간 고려)
    this.time.delayedCall(600, () => {
      this.isInvincible = false;
      this.stopInvincibilityBlink();
      this.stopPostDodgeShield();
    });

    // 다시 그리기
    this.draw();

    // 쿨다운 UI 업데이트
    this.updateDodgeCooldownUI();
  }

  // === 고급 구르기 이펙트 시스템 ===
  createAdvancedRollEffect(originalPositions, offsetX, offsetY, rollAngle) {
    const gridSize = this.gridSize;
    const gameAreaY = this.gameAreaY;
    const rollDuration = 180; // 롤 애니메이션 지속시간
    const totalRotations = 1.5; // 1.5바퀴 회전

    // 1. 모션 블러 트레일 (이전 → 현재 위치 사이에 여러 개)
    const trailCount = 8;
    for (let t = 0; t < trailCount; t++) {
      const progress = t / trailCount;
      const delayMs = t * 15;

      this.time.delayedCall(delayMs, () => {
        for (let i = 0; i < Math.min(originalPositions.length, 8); i++) {
          const orig = originalPositions[i];
          const interpX = orig.x + offsetX * progress;
          const interpY = orig.y + offsetY * progress;

          const pixelX = interpX * gridSize + gridSize / 2;
          const pixelY = interpY * gridSize + gridSize / 2 + gameAreaY;

          // 모션 블러 세그먼트
          const blur = this.add.rectangle(
            pixelX, pixelY,
            gridSize - 2, gridSize - 2,
            i === 0 ? 0x00ffff : 0x00ff88,
            0.6 - progress * 0.5
          ).setDepth(95);

          // 회전 효과 (구르는 느낌)
          blur.setRotation(rollAngle * progress * totalRotations);

          // 스케일 왜곡 (모션 블러 느낌)
          const scaleX = 1 + Math.abs(Math.sin(progress * Math.PI)) * 0.3;
          const scaleY = 1 - Math.abs(Math.sin(progress * Math.PI)) * 0.2;
          blur.setScale(scaleX, scaleY);

          // 빠른 페이드아웃
          this.tweens.add({
            targets: blur,
            alpha: 0,
            scale: 0.3,
            duration: 120,
            ease: 'Power2.easeOut',
            onComplete: () => blur.destroy()
          });
        }
      });
    }

    // 2. 시작점 에너지 버스트
    const startX = originalPositions[0].x * gridSize + gridSize / 2;
    const startY = originalPositions[0].y * gridSize + gridSize / 2 + gameAreaY;

    // 에너지 링 (시작점)
    for (let r = 0; r < 3; r++) {
      const ring = this.add.circle(startX, startY, 8 + r * 5, 0x00ffff, 0).setDepth(96);
      ring.setStrokeStyle(3 - r, 0x00ffff, 0.8);

      this.tweens.add({
        targets: ring,
        radius: 30 + r * 15,
        alpha: 0,
        duration: 250 + r * 50,
        onUpdate: () => ring.setStrokeStyle(3 - r, 0x00ffff, ring.alpha),
        onComplete: () => ring.destroy()
      });
    }

    // 에너지 스파크 (시작점)
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
      const spark = this.add.rectangle(startX, startY, 8, 3, 0x00ffff, 1).setDepth(97);
      spark.setRotation(angle);

      this.tweens.add({
        targets: spark,
        x: startX + Math.cos(angle) * 40,
        y: startY + Math.sin(angle) * 40,
        alpha: 0,
        scaleX: 0.2,
        duration: 200,
        ease: 'Power2.easeOut',
        onComplete: () => spark.destroy()
      });
    }

    // 3. 구르기 중앙 경로에 에너지 웨이브
    const midX = (startX + (this.snake[0].x * gridSize + gridSize / 2)) / 2;
    const midY = (startY + (this.snake[0].y * gridSize + gridSize / 2 + gameAreaY)) / 2;

    const wave = this.add.ellipse(midX, midY, 60, 20, 0x00ff88, 0.6).setDepth(94);
    wave.setRotation(Math.atan2(offsetY, offsetX));

    this.tweens.add({
      targets: wave,
      scaleX: 2.5,
      scaleY: 0.5,
      alpha: 0,
      duration: 200,
      onComplete: () => wave.destroy()
    });

    // 4. 도착점 착지 이펙트
    const endX = this.snake[0].x * gridSize + gridSize / 2;
    const endY = this.snake[0].y * gridSize + gridSize / 2 + gameAreaY;

    this.time.delayedCall(80, () => {
      // 착지 충격파
      const impact = this.add.circle(endX, endY, 5, 0xffff00, 0.8).setDepth(96);
      this.tweens.add({
        targets: impact,
        radius: 35,
        alpha: 0,
        duration: 200,
        onComplete: () => impact.destroy()
      });

      // 착지 먼지 파티클
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const dust = this.add.circle(
          endX + Math.cos(angle) * 10,
          endY + Math.sin(angle) * 10,
          3 + Math.random() * 2,
          0xffffaa, 0.7
        ).setDepth(95);

        this.tweens.add({
          targets: dust,
          x: endX + Math.cos(angle) * 25,
          y: endY + Math.sin(angle) * 25 + 5, // 약간 아래로
          alpha: 0,
          scale: 0.3,
          duration: 250,
          ease: 'Power2.easeOut',
          onComplete: () => dust.destroy()
        });
      }

      // 착지 플래시
      const flash = this.add.rectangle(endX, endY, gridSize * 2, gridSize * 2, 0xffffff, 0.5).setDepth(94);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 1.5,
        duration: 100,
        onComplete: () => flash.destroy()
      });
    });

    // 5. 실제 구르는 뱀 애니메이션 (시각적 오버레이)
    this.createRollingSnakeAnimation(originalPositions, offsetX, offsetY, rollAngle, totalRotations, rollDuration);
  }

  createRollingSnakeAnimation(originalPositions, offsetX, offsetY, rollAngle, totalRotations, duration) {
    const gridSize = this.gridSize;
    const gameAreaY = this.gameAreaY;

    // 구르는 뱀 세그먼트 오버레이
    const rollingSegments = [];

    for (let i = 0; i < Math.min(originalPositions.length, 6); i++) {
      const orig = originalPositions[i];
      const startPixelX = orig.x * gridSize + gridSize / 2;
      const startPixelY = orig.y * gridSize + gridSize / 2 + gameAreaY;

      // 구르는 세그먼트 컨테이너
      const container = this.add.container(startPixelX, startPixelY).setDepth(98);

      // 메인 세그먼트
      const segment = this.add.rectangle(0, 0, gridSize - 2, gridSize - 2,
        i === 0 ? 0x00ff00 : 0x00cc00, 1);

      // 글로우 효과
      const glow = this.add.rectangle(0, 0, gridSize + 4, gridSize + 4,
        0x00ffff, 0.4);

      container.add([glow, segment]);
      rollingSegments.push(container);

      // 구르기 애니메이션
      this.tweens.add({
        targets: container,
        x: (orig.x + offsetX) * gridSize + gridSize / 2,
        y: (orig.y + offsetY) * gridSize + gridSize / 2 + gameAreaY,
        rotation: rollAngle * totalRotations,
        duration: duration,
        ease: 'Power2.easeOut',
        delay: i * 15, // 세그먼트별 약간의 지연 (물결 효과)
        onComplete: () => {
          // 착지 시 스케일 바운스
          this.tweens.add({
            targets: container,
            scaleX: 1.2,
            scaleY: 0.8,
            duration: 50,
            yoyo: true,
            onComplete: () => {
              // 페이드아웃
              this.tweens.add({
                targets: container,
                alpha: 0,
                duration: 80,
                onComplete: () => container.destroy()
              });
            }
          });
        }
      });

      // 세그먼트별 스케일 왜곡 (구르는 느낌)
      this.tweens.add({
        targets: segment,
        scaleX: { from: 1, to: 1.3 },
        scaleY: { from: 1, to: 0.7 },
        duration: duration / 3,
        yoyo: true,
        repeat: 1
      });
    }
  }

  createDodgeGhostTrail() {
    // 현재 뱀 위치에 잔상 생성
    const ghostCount = 4;
    const snake = this.snake;

    for (let g = 0; g < ghostCount; g++) {
      this.time.delayedCall(g * 30, () => {
        for (let i = 0; i < Math.min(snake.length, 10); i++) {
          const segment = snake[i];
          const ghostAlpha = 0.6 - (g * 0.15);

          const ghost = this.add.rectangle(
            segment.x * this.gridSize + this.gridSize / 2,
            segment.y * this.gridSize + this.gridSize / 2 + this.gameAreaY,
            this.gridSize - 2,
            this.gridSize - 2,
            i === 0 ? 0x00ff00 : 0x00cc00,
            ghostAlpha
          ).setDepth(90);

          // 살짝 회전 효과
          ghost.setRotation((g - 2) * 0.1);

          // 페이드아웃
          this.tweens.add({
            targets: ghost,
            alpha: 0,
            scale: 0.5,
            rotation: ghost.rotation + 0.5,
            duration: 200,
            ease: 'Power2.easeOut',
            onComplete: () => ghost.destroy()
          });
        }
      });
    }
  }

  showDodgeEffect(newX, newY) {
    const pixelX = newX * this.gridSize + this.gridSize / 2;
    const pixelY = newY * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // === 화려한 "DODGE!" 텍스트 ===
    // 그림자 텍스트 (3D 효과)
    const shadowText = this.add.text(pixelX + 3, pixelY - 27, 'DODGE!', {
      fontSize: '28px',
      fontStyle: 'bold',
      fill: '#000000'
    }).setOrigin(0.5).setDepth(1499).setAlpha(0);

    // 메인 텍스트
    const dodgeText = this.add.text(pixelX, pixelY - 30, 'DODGE!', {
      fontSize: '28px',
      fontStyle: 'bold',
      fill: '#00ffff',
      stroke: '#ffffff',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(1500).setAlpha(0);

    // 글로우 텍스트 (배경)
    const glowText = this.add.text(pixelX, pixelY - 30, 'DODGE!', {
      fontSize: '32px',
      fontStyle: 'bold',
      fill: '#00ffff'
    }).setOrigin(0.5).setDepth(1498).setAlpha(0);

    // 텍스트 등장 애니메이션
    this.tweens.add({
      targets: [shadowText, dodgeText, glowText],
      alpha: { value: 1, duration: 100 },
      y: pixelY - 60,
      scale: { from: 0.3, to: 1.3 },
      duration: 200,
      ease: 'Back.easeOut'
    });

    // 글로우 펄스 효과
    this.tweens.add({
      targets: glowText,
      scale: 1.5,
      alpha: 0.3,
      duration: 150,
      yoyo: true,
      repeat: 2
    });

    // 텍스트 퇴장
    this.time.delayedCall(350, () => {
      this.tweens.add({
        targets: [shadowText, dodgeText, glowText],
        alpha: 0,
        y: pixelY - 90,
        scale: 0.8,
        duration: 200,
        onComplete: () => {
          shadowText.destroy();
          dodgeText.destroy();
          glowText.destroy();
        }
      });
    });

    // === 화려한 착지 파티클 ===
    // 스피드 라인 (방사형)
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 * i) / 16;
      const lineLength = 20 + Math.random() * 15;

      const speedLine = this.add.rectangle(
        pixelX + Math.cos(angle) * 5,
        pixelY + Math.sin(angle) * 5,
        lineLength, 3,
        0x00ffff, 0.9
      ).setDepth(1500).setRotation(angle);

      this.tweens.add({
        targets: speedLine,
        x: pixelX + Math.cos(angle) * 50,
        y: pixelY + Math.sin(angle) * 50,
        alpha: 0,
        scaleX: 0.3,
        duration: 250,
        ease: 'Power3.easeOut',
        onComplete: () => speedLine.destroy()
      });
    }

    // 스파크 파티클 (다양한 색상)
    const sparkColors = [0x00ffff, 0xffff00, 0xffffff, 0x00ff00];
    for (let i = 0; i < 20; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 20 + Math.random() * 30;
      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];

      const spark = this.add.circle(
        pixelX,
        pixelY,
        2 + Math.random() * 3,
        color, 1
      ).setDepth(1500);

      this.tweens.add({
        targets: spark,
        x: pixelX + Math.cos(angle) * dist,
        y: pixelY + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0,
        duration: 350 + Math.random() * 150,
        ease: 'Power2.easeOut',
        onComplete: () => spark.destroy()
      });
    }

    // 에너지 링 (착지 충격파)
    for (let r = 0; r < 2; r++) {
      const ring = this.add.circle(pixelX, pixelY, 10, 0x00ffff, 0).setDepth(1499);
      ring.setStrokeStyle(4 - r * 2, 0x00ffff, 0.8);

      this.tweens.add({
        targets: ring,
        radius: 40 + r * 20,
        duration: 300 + r * 100,
        onUpdate: () => ring.setStrokeStyle(4 - r * 2, 0x00ffff, ring.alpha || 0.8),
        onComplete: () => ring.destroy()
      });

      this.tweens.add({
        targets: ring,
        alpha: 0,
        duration: 300 + r * 100,
        delay: 100
      });
    }

    // 원형 웨이브 이펙트
    const wave = this.add.circle(pixelX, pixelY, 5, 0xffff00, 0).setDepth(1499);
    wave.setStrokeStyle(2, 0xffff00, 0.8);

    this.tweens.add({
      targets: wave,
      radius: 40,
      alpha: 0,
      duration: 300,
      ease: 'Power2.easeOut',
      onUpdate: () => {
        wave.setStrokeStyle(2, 0xffff00, wave.alpha * 0.8);
      },
      onComplete: () => wave.destroy()
    });
  }

  startInvincibilityBlink() {
    // 빠른 깜빡임 효과를 위해 플래그 설정
    this.invincibilityBlinkActive = true;
    this.invincibilityBlinkCount = 0;

    // 깜빡임 타이머
    this.invincibilityBlinkTimer = this.time.addEvent({
      delay: 40,
      callback: () => {
        this.invincibilityBlinkCount++;
        // draw()에서 처리할 수 있도록 플래그만 토글
        this.draw();
      },
      loop: true
    });
  }

  stopInvincibilityBlink() {
    this.invincibilityBlinkActive = false;
    if (this.invincibilityBlinkTimer) {
      this.invincibilityBlinkTimer.destroy();
      this.invincibilityBlinkTimer = null;
    }
    this.draw();
  }

  // === 닷지 후 보호막 이펙트 시스템 ===
  startPostDodgeShield() {
    // 기존 보호막 정리
    this.stopPostDodgeShield();

    this.postDodgeShieldActive = true;
    this.postDodgeShieldElements = [];

    // 뱀 머리 주위에 보호막 원형 이펙트
    const head = this.snake[0];
    const pixelX = head.x * this.gridSize + this.gridSize / 2;
    const pixelY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 1. 외부 보호막 링 (시안색)
    const shieldRing = this.add.circle(pixelX, pixelY, 25, 0x00ffff, 0).setDepth(150);
    shieldRing.setStrokeStyle(3, 0x00ffff, 0.8);
    this.postDodgeShieldElements.push(shieldRing);

    // 2. 내부 글로우 필드
    const shieldGlow = this.add.circle(pixelX, pixelY, 20, 0x00ffff, 0.2).setDepth(149);
    this.postDodgeShieldElements.push(shieldGlow);

    // 3. 회전하는 보호막 파티클들
    this.shieldParticles = [];
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const particle = this.add.circle(
        pixelX + Math.cos(angle) * 22,
        pixelY + Math.sin(angle) * 22,
        3, 0x00ffff, 0.9
      ).setDepth(151);
      this.shieldParticles.push({ graphic: particle, angle: angle });
      this.postDodgeShieldElements.push(particle);
    }

    // 보호막 펄스 애니메이션
    this.tweens.add({
      targets: shieldRing,
      scale: { from: 0.8, to: 1.2 },
      duration: 200,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: shieldGlow,
      alpha: { from: 0.2, to: 0.4 },
      scale: { from: 1, to: 1.1 },
      duration: 150,
      yoyo: true,
      repeat: -1
    });

    // 보호막 업데이트 타이머 (뱀 위치 따라다니기 + 파티클 회전)
    this.postDodgeShieldTimer = this.time.addEvent({
      delay: 16, // 60fps
      callback: () => {
        if (!this.postDodgeShieldActive || !this.snake[0]) return;

        const head = this.snake[0];
        const newX = head.x * this.gridSize + this.gridSize / 2;
        const newY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

        // 보호막 위치 업데이트
        if (shieldRing && shieldRing.active) {
          shieldRing.setPosition(newX, newY);
        }
        if (shieldGlow && shieldGlow.active) {
          shieldGlow.setPosition(newX, newY);
        }

        // 파티클 회전 + 위치 업데이트
        if (this.shieldParticles) {
          for (const p of this.shieldParticles) {
            p.angle += 0.15; // 회전 속도
            if (p.graphic && p.graphic.active) {
              p.graphic.setPosition(
                newX + Math.cos(p.angle) * 22,
                newY + Math.sin(p.angle) * 22
              );
            }
          }
        }
      },
      loop: true
    });

    // "PROTECTED" 텍스트 표시
    const protectedText = this.add.text(pixelX, pixelY - 40, 'PROTECTED', {
      fontFamily: 'Arial Black',
      fontSize: '12px',
      color: '#00ffff',
      stroke: '#003333',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(152).setAlpha(0);
    this.postDodgeShieldElements.push(protectedText);

    this.tweens.add({
      targets: protectedText,
      alpha: 1,
      y: pixelY - 50,
      duration: 200,
      ease: 'Power2.easeOut'
    });

    // 텍스트 깜빡임
    this.tweens.add({
      targets: protectedText,
      alpha: { from: 1, to: 0.5 },
      duration: 100,
      yoyo: true,
      repeat: -1,
      delay: 200
    });
  }

  stopPostDodgeShield() {
    this.postDodgeShieldActive = false;

    // 타이머 정리
    if (this.postDodgeShieldTimer) {
      this.postDodgeShieldTimer.destroy();
      this.postDodgeShieldTimer = null;
    }

    // 보호막 요소들 페이드아웃 후 제거
    if (this.postDodgeShieldElements && this.postDodgeShieldElements.length > 0) {
      for (const element of this.postDodgeShieldElements) {
        if (element && element.active) {
          this.tweens.add({
            targets: element,
            alpha: 0,
            scale: 1.5,
            duration: 150,
            onComplete: () => {
              if (element && element.active) element.destroy();
            }
          });
        }
      }
      this.postDodgeShieldElements = [];
    }

    this.shieldParticles = null;
  }

  showDodgeCooldownFeedback() {
    // 쿨다운 중일 때 피드백
    if (this.dodgeCooldownUI) {
      // UI 흔들기
      this.tweens.add({
        targets: this.dodgeCooldownUI,
        x: this.dodgeCooldownUI.x - 5,
        duration: 50,
        yoyo: true,
        repeat: 3
      });
    }
  }

  createDodgeCooldownUI() {
    const { width, height } = this.cameras.main;
    const uiX = width - 80;
    const uiY = height - this.bottomUIHeight - 40;

    // 컨테이너 생성
    this.dodgeCooldownUI = this.add.container(uiX, uiY).setDepth(2500);

    // 배경
    const bg = this.add.rectangle(0, 0, 60, 20, 0x000000, 0.7).setStrokeStyle(1, 0x00ff00);

    // 게이지 바
    this.dodgeCooldownBar = this.add.rectangle(-25, 0, 50, 14, 0x00ff00, 1).setOrigin(0, 0.5);

    // 레이블
    const label = this.add.text(0, -18, 'DODGE', {
      fontSize: '10px',
      fill: '#00ff00'
    }).setOrigin(0.5);

    // 키 표시
    const keyLabel = this.add.text(0, 18, '[SPACE]', {
      fontSize: '8px',
      fill: '#888888'
    }).setOrigin(0.5);

    this.dodgeCooldownUI.add([bg, this.dodgeCooldownBar, label, keyLabel]);
    this.dodgeCooldownUI.setVisible(false); // 탄막 보스전에서만 표시
  }

  updateDodgeCooldownUI() {
    if (!this.dodgeCooldownUI) return;

    const now = Date.now();
    const elapsed = now - this.lastDodgeTime;
    const progress = Math.min(1, elapsed / this.dodgeCooldown);

    if (this.dodgeCooldownBar) {
      this.dodgeCooldownBar.setScale(progress, 1);
      // 색상 변경 (빨강 → 초록)
      if (progress >= 1) {
        this.dodgeCooldownBar.setFillStyle(0x00ff00);
      } else {
        this.dodgeCooldownBar.setFillStyle(0xff3300);
      }
    }
  }

  showDodgeCooldownUIForBulletBoss() {
    if (!this.dodgeCooldownUI) {
      this.createDodgeCooldownUI();
    }
    this.dodgeCooldownUI.setVisible(true);

    // 실시간 업데이트 타이머
    if (this.dodgeCooldownUpdateTimer) {
      this.dodgeCooldownUpdateTimer.destroy();
    }
    this.dodgeCooldownUpdateTimer = this.time.addEvent({
      delay: 50,
      callback: () => this.updateDodgeCooldownUI(),
      loop: true
    });
  }

  hideDodgeCooldownUI() {
    if (this.dodgeCooldownUI) {
      this.dodgeCooldownUI.setVisible(false);
    }
    if (this.dodgeCooldownUpdateTimer) {
      this.dodgeCooldownUpdateTimer.destroy();
      this.dodgeCooldownUpdateTimer = null;
    }
  }

  // ========== 튜토리얼 시스템 ==========

  showDodgeTutorial(callback) {
    const { width, height } = this.cameras.main;

    // 튜토리얼 중 닷지 비활성화 플래그
    this.tutorialOpen = true;

    // 튜토리얼 중 뱀 이동 정지
    if (this.moveTimer) {
      this.moveTimer.paused = true;
    }

    // 오버레이
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.85)
      .setOrigin(0, 0).setDepth(5000);

    // 튜토리얼 컨테이너
    const container = this.add.container(width / 2, height / 2).setDepth(5001);

    // 박스 배경
    const boxBg = this.add.rectangle(0, 0, 400, 250, 0x1a1a2e, 1)
      .setStrokeStyle(3, 0x00ff00);

    // 타이틀
    const title = this.add.text(0, -90, 'DODGE TUTORIAL', {
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#00ff00'
    }).setOrigin(0.5);

    // 스페이스바 키 표시
    const keyBox = this.add.rectangle(0, -30, 120, 40, 0x333333, 1)
      .setStrokeStyle(2, 0xffffff);
    const keyText = this.add.text(0, -30, 'SPACEBAR', {
      fontSize: '16px',
      fontStyle: 'bold',
      fill: '#ffffff'
    }).setOrigin(0.5);

    // 설명
    const desc = this.add.text(0, 20, '= SIDE ROLL DODGE', {
      fontSize: '18px',
      fill: '#ffff00'
    }).setOrigin(0.5);

    const desc2 = this.add.text(0, 50, 'Roll sideways to avoid bullets!', {
      fontSize: '14px',
      fill: '#aaaaaa'
    }).setOrigin(0.5);

    // 미니 뱀 데모 애니메이션
    const demoSnake = this.add.container(0, 90);
    for (let i = 0; i < 3; i++) {
      const segment = this.add.rectangle(-20 + i * 12, 0, 10, 10, i === 0 ? 0x00ff00 : 0x00cc00);
      demoSnake.add(segment);
    }

    // 뱀이 옆으로 구르는 애니메이션
    this.tweens.add({
      targets: demoSnake,
      y: demoSnake.y - 30,
      duration: 300,
      ease: 'Power2.easeOut',
      yoyo: true,
      repeat: -1,
      repeatDelay: 1000
    });

    // 스킵 안내
    const skipText = this.add.text(0, 110, 'Press any key to continue...', {
      fontSize: '12px',
      fill: '#666666'
    }).setOrigin(0.5);

    // 깜빡임 애니메이션
    this.tweens.add({
      targets: skipText,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // 키 누르기 애니메이션
    this.tweens.add({
      targets: keyBox,
      scaleY: 0.9,
      duration: 150,
      yoyo: true,
      repeat: -1,
      repeatDelay: 800
    });

    container.add([boxBg, title, keyBox, keyText, desc, desc2, demoSnake, skipText]);

    // 등장 애니메이션
    container.setScale(0.5).setAlpha(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    // 3초 후 자동 스킵 또는 아무 키 입력
    let tutorialClosed = false;

    const closeTutorial = () => {
      if (tutorialClosed) return;
      tutorialClosed = true;

      this.tweens.add({
        targets: [container, overlay],
        alpha: 0,
        scale: 0.8,
        duration: 200,
        onComplete: () => {
          container.destroy();
          overlay.destroy();
          // 튜토리얼 종료 - 닷지 활성화
          this.tutorialOpen = false;
          // 뱀 이동 재개
          if (this.moveTimer) {
            this.moveTimer.paused = false;
          }
          if (callback) callback();
        }
      });
    };

    // 아무 키 입력으로 스킵
    const skipListener = this.input.keyboard.once('keydown', closeTutorial);

    // 3초 후 자동 스킵
    this.time.delayedCall(3000, closeTutorial);
  }

  // ========== 총알 시스템 ==========

  createBullet(x, y, dx, dy, speed = 3, type = 'plasma') {
    const pixelX = x * this.gridSize + this.gridSize / 2;
    const pixelY = y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // === 타입별 색상 팔레트 ===
    const colorPalettes = {
      plasma: {
        outer: 0xff0066, mid: 0xff3388, inner: 0xff6699,
        glow: 0xff00ff, core: 0xffffff, ring: 0xff0066
      },
      energy: {
        outer: 0x00ccff, mid: 0x33ddff, inner: 0x66eeff,
        glow: 0x00ffff, core: 0xffffff, ring: 0x0099ff
      },
      spiral: {
        outer: 0x9900ff, mid: 0xaa33ff, inner: 0xcc66ff,
        glow: 0xff00ff, core: 0xffffff, ring: 0x6600cc
      },
      tracker: {
        outer: 0x00ff66, mid: 0x33ff88, inner: 0x66ffaa,
        glow: 0xffff00, core: 0xffffff, ring: 0x00cc44
      },
      wall: {
        outer: 0xff6600, mid: 0xff8833, inner: 0xffaa66,
        glow: 0xff3300, core: 0xffffff, ring: 0xff4400
      },
      shotgun: {
        outer: 0xffcc00, mid: 0xffdd33, inner: 0xffee66,
        glow: 0xffaa00, core: 0xffffff, ring: 0xff9900
      }
    };

    const colors = colorPalettes[type] || colorPalettes.plasma;

    // === 고급 총알 그래픽 (멀티 레이어) ===
    const bulletContainer = this.add.container(pixelX, pixelY).setDepth(200);

    // 타입별 특수 디자인
    if (type === 'spiral') {
      // 나선형 - 회전하는 나선 패턴
      const spiralArms = [];
      for (let i = 0; i < 3; i++) {
        const arm = this.add.rectangle(0, 0, 20, 3, colors.mid, 0.7);
        arm.setRotation((Math.PI * 2 * i) / 3);
        spiralArms.push(arm);
        bulletContainer.add(arm);
      }

      // 나선 회전 애니메이션
      this.tweens.add({
        targets: spiralArms,
        rotation: `+=${Math.PI * 2}`,
        duration: 300,
        repeat: -1
      });

      const spiralCore = this.add.circle(0, 0, 6, colors.outer, 0.9);
      const spiralCenter = this.add.circle(0, 0, 3, colors.core, 1);
      bulletContainer.add([spiralCore, spiralCenter]);

      this.tweens.add({
        targets: spiralCore,
        scale: { from: 1, to: 1.4 },
        alpha: { from: 0.9, to: 0.5 },
        duration: 150,
        yoyo: true,
        repeat: -1
      });

    } else if (type === 'tracker') {
      // 추적탄 - 타겟팅 십자선 스타일
      const crosshairH = this.add.rectangle(0, 0, 22, 2, colors.glow, 0.8);
      const crosshairV = this.add.rectangle(0, 0, 2, 22, colors.glow, 0.8);
      const targetRing = this.add.circle(0, 0, 10, colors.outer, 0);
      targetRing.setStrokeStyle(2, colors.outer, 0.8);
      const innerDot = this.add.circle(0, 0, 4, colors.core, 1);

      bulletContainer.add([crosshairH, crosshairV, targetRing, innerDot]);

      // 회전 및 펄스
      this.tweens.add({
        targets: [crosshairH, crosshairV],
        rotation: Math.PI / 4,
        duration: 400,
        yoyo: true,
        repeat: -1
      });

      this.tweens.add({
        targets: targetRing,
        scale: { from: 1, to: 1.5 },
        alpha: { from: 0.8, to: 0.2 },
        duration: 300,
        repeat: -1
      });

    } else if (type === 'shotgun') {
      // 샷건탄 - 불규칙한 폭발 형태
      const shards = [];
      for (let i = 0; i < 5; i++) {
        const angle = (Math.PI * 2 * i) / 5;
        const shard = this.add.triangle(
          Math.cos(angle) * 6, Math.sin(angle) * 6,
          0, -5, -3, 4, 3, 4,
          colors.mid, 0.8
        ).setRotation(angle);
        shards.push(shard);
        bulletContainer.add(shard);
      }

      const shotgunCore = this.add.circle(0, 0, 5, colors.outer, 1);
      const shotgunCenter = this.add.circle(0, 0, 2, colors.core, 1);
      bulletContainer.add([shotgunCore, shotgunCenter]);

      // 샤드 펄스
      this.tweens.add({
        targets: shards,
        scale: { from: 1, to: 1.3 },
        duration: 120,
        yoyo: true,
        repeat: -1
      });

    } else if (type === 'wall') {
      // 벽탄 - 위험한 불타는 느낌
      const flames = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI * 2 * i) / 6;
        const flame = this.add.ellipse(
          Math.cos(angle) * 8, Math.sin(angle) * 8,
          6, 10, colors.mid, 0.6
        ).setRotation(angle);
        flames.push(flame);
        bulletContainer.add(flame);
      }

      const wallCore = this.add.circle(0, 0, 7, colors.outer, 0.9);
      const wallCenter = this.add.circle(0, 0, 4, colors.core, 1);
      bulletContainer.add([wallCore, wallCenter]);

      // 불꽃 애니메이션
      this.tweens.add({
        targets: flames,
        scaleY: { from: 1, to: 1.5 },
        alpha: { from: 0.6, to: 0.2 },
        duration: 100,
        yoyo: true,
        repeat: -1
      });

    } else {
      // 기본 (plasma, energy) - 원형 글로우 스타일
      // 1. 가장 바깥 - 거대한 에너지 필드 (낮은 알파)
      const outerField = this.add.circle(0, 0, 18, colors.outer, 0.15);

      // 2. 외부 글로우 링
      const glowRing = this.add.circle(0, 0, 14, colors.outer, 0);
      glowRing.setStrokeStyle(2, colors.outer, 0.6);

      // 3. 중간 글로우
      const midGlow = this.add.circle(0, 0, 10, colors.mid, 0.4);

      // 4. 내부 글로우
      const innerGlow = this.add.circle(0, 0, 7, colors.inner, 0.6);

      // 5. 코어 (밝은 중심)
      const core = this.add.circle(0, 0, 4, colors.core, 1);

      // 6. 하이라이트 (반짝이는 점)
      const highlight = this.add.circle(-1, -1, 2, colors.core, 0.9);

      // 7. 에너지 링 회전 효과
      const energyRing = this.add.circle(0, 0, 12, colors.ring, 0);
      energyRing.setStrokeStyle(1, colors.glow, 0.5);

      bulletContainer.add([outerField, glowRing, midGlow, innerGlow, core, highlight, energyRing]);

      // 펄스 애니메이션 (에너지 필드)
      this.tweens.add({
        targets: outerField,
        scale: { from: 1, to: 1.6 },
        alpha: { from: 0.15, to: 0.05 },
        duration: 150,
        yoyo: true,
        repeat: -1
      });

      // 글로우 링 펄스
      this.tweens.add({
        targets: glowRing,
        scale: { from: 1, to: 1.3 },
        duration: 200,
        yoyo: true,
        repeat: -1
      });

      // 코어 펄스 (호흡 효과)
      this.tweens.add({
        targets: [core, innerGlow],
        scale: { from: 1, to: 1.15 },
        duration: 100,
        yoyo: true,
        repeat: -1
      });

      // 에너지 링 회전
      this.tweens.add({
        targets: energyRing,
        rotation: Math.PI * 2,
        duration: 500,
        repeat: -1
      });

      // 하이라이트 깜빡임
      this.tweens.add({
        targets: highlight,
        alpha: { from: 0.9, to: 0.3 },
        duration: 80,
        yoyo: true,
        repeat: -1
      });
    }

    const bullet = {
      x: pixelX,
      y: pixelY,
      dx: dx * speed,
      dy: dy * speed,
      speed: speed,
      type: type,
      graphics: bulletContainer,
      trail: [],
      trailCounter: 0 // 트레일 최적화용
    };

    this.bullets.push(bullet);
    return bullet;
  }

  fireRadialBullets(count = 8, speed = 3, type = 'plasma', angleOffset = 0) {
    if (!this.bulletBossPosition) return;

    const bossX = this.bulletBossPosition.x;
    const bossY = this.bulletBossPosition.y;

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + angleOffset;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      this.createBullet(bossX, bossY, dx, dy, speed, type);
    }

    // 발사 이펙트
    this.showBulletFireEffect(bossX, bossY);
  }

  fireSpiralBullets(bulletCount = 16, rotationOffset = 0, speed = 2.5, type = 'spiral') {
    if (!this.bulletBossPosition) return;

    const bossX = this.bulletBossPosition.x;
    const bossY = this.bulletBossPosition.y;

    for (let i = 0; i < bulletCount; i++) {
      const angle = (Math.PI * 2 * i) / bulletCount + rotationOffset;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);

      // 약간의 지연을 두고 발사
      this.time.delayedCall(i * 50, () => {
        if (this.bulletBossMode) {
          this.createBullet(bossX, bossY, dx, dy, speed, type);
        }
      });
    }
  }

  fireAimedBullet(speed = 4, type = 'tracker') {
    if (!this.bulletBossPosition || !this.snake[0]) return;

    const bossX = this.bulletBossPosition.x;
    const bossY = this.bulletBossPosition.y;
    const head = this.snake[0];

    // 뱀 방향으로 조준
    const dx = head.x - bossX;
    const dy = head.y - bossY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      this.createBullet(bossX, bossY, dx / dist, dy / dist, speed, type);
    }
  }

  showBulletFireEffect(gridX, gridY) {
    const pixelX = gridX * this.gridSize + this.gridSize / 2;
    const pixelY = gridY * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // === 화려한 발사 이펙트 ===

    // 1. 중앙 플래시 (멀티 레이어)
    const flashOuter = this.add.circle(pixelX, pixelY, 50, 0xff0066, 0.3).setDepth(198);
    const flashMid = this.add.circle(pixelX, pixelY, 35, 0xff3388, 0.5).setDepth(199);
    const flashCore = this.add.circle(pixelX, pixelY, 20, 0xffffff, 0.8).setDepth(200);

    this.tweens.add({
      targets: [flashOuter, flashMid, flashCore],
      scale: 2.5,
      alpha: 0,
      duration: 250,
      ease: 'Power2.easeOut',
      onComplete: () => {
        flashOuter.destroy();
        flashMid.destroy();
        flashCore.destroy();
      }
    });

    // 2. 확장 링 (다중)
    for (let r = 0; r < 3; r++) {
      const ring = this.add.circle(pixelX, pixelY, 15, 0xff0066, 0).setDepth(197);
      ring.setStrokeStyle(4 - r, r === 0 ? 0xff0066 : (r === 1 ? 0xff00ff : 0xffff00), 0.8);

      this.tweens.add({
        targets: ring,
        radius: 60 + r * 25,
        duration: 300 + r * 100,
        onUpdate: () => ring.setStrokeStyle(4 - r, ring.strokeColor, Math.max(0, 0.8 - ring.radius / 100)),
        onComplete: () => ring.destroy()
      });
    }

    // 3. 방사형 에너지 라인
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const line = this.add.rectangle(
        pixelX, pixelY,
        25, 3,
        0xff0066, 0.9
      ).setDepth(199).setRotation(angle);

      this.tweens.add({
        targets: line,
        x: pixelX + Math.cos(angle) * 45,
        y: pixelY + Math.sin(angle) * 45,
        alpha: 0,
        scaleX: 0.3,
        duration: 200,
        ease: 'Power2.easeOut',
        onComplete: () => line.destroy()
      });
    }

    // 4. 스파크 파티클
    const sparkColors = [0xff0066, 0xff00ff, 0xffff00, 0xffffff];
    for (let i = 0; i < 16; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 30 + Math.random() * 40;
      const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];

      const spark = this.add.circle(pixelX, pixelY, 2 + Math.random() * 2, color, 1).setDepth(200);

      this.tweens.add({
        targets: spark,
        x: pixelX + Math.cos(angle) * speed,
        y: pixelY + Math.sin(angle) * speed,
        alpha: 0,
        scale: 0,
        duration: 300 + Math.random() * 150,
        ease: 'Power2.easeOut',
        onComplete: () => spark.destroy()
      });
    }

    // 5. 카메라 약간 흔들기
    this.cameras.main.shake(50, 0.003);
  }

  updateBullets() {
    const bulletsToRemove = [];

    for (let i = 0; i < this.bullets.length; i++) {
      const bullet = this.bullets[i];

      // 위치 업데이트
      bullet.x += bullet.dx;
      bullet.y += bullet.dy;

      // 그래픽 위치 업데이트
      if (bullet.graphics) {
        bullet.graphics.setPosition(bullet.x, bullet.y);
      }

      // 트레일 효과
      this.updateBulletTrail(bullet);

      // 벽 충돌 체크
      if (bullet.x < 0 || bullet.x > this.cameras.main.width ||
          bullet.y < this.gameAreaY || bullet.y > this.cameras.main.height - this.bottomUIHeight) {
        bulletsToRemove.push(i);
        this.destroyBullet(bullet);
        continue;
      }

      // 뱀 충돌 체크 (무적 아닐 때만)
      if (!this.isInvincible) {
        const head = this.snake[0];
        const headPixelX = head.x * this.gridSize + this.gridSize / 2;
        const headPixelY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

        const dist = Math.sqrt(
          Math.pow(bullet.x - headPixelX, 2) +
          Math.pow(bullet.y - headPixelY, 2)
        );

        if (dist < this.gridSize * 0.7) {
          // 총알에 맞음!
          this.handleBulletHit();
          return;
        }
      }
    }

    // 제거할 총알들 처리
    for (let i = bulletsToRemove.length - 1; i >= 0; i--) {
      this.bullets.splice(bulletsToRemove[i], 1);
    }
  }

  updateBulletTrail(bullet) {
    // 성능 최적화: 매 2프레임마다 트레일 생성
    bullet.trailCounter = (bullet.trailCounter || 0) + 1;
    if (bullet.trailCounter % 2 !== 0) return;

    // === 타입별 트레일 색상 ===
    const trailColors = {
      plasma: { outer: 0xff0066, mid: 0xff3388, spark: 0xffff00 },
      energy: { outer: 0x00ccff, mid: 0x33ddff, spark: 0x00ffff },
      spiral: { outer: 0x9900ff, mid: 0xaa33ff, spark: 0xff00ff },
      tracker: { outer: 0x00ff66, mid: 0x33ff88, spark: 0xffff00 },
      wall: { outer: 0xff6600, mid: 0xff8833, spark: 0xff3300 },
      shotgun: { outer: 0xffcc00, mid: 0xffdd33, spark: 0xffaa00 }
    };

    const colors = trailColors[bullet.type] || trailColors.plasma;

    // === 화려한 멀티 레이어 트레일 ===

    // 1. 외부 글로우 트레일 (큰, 투명)
    const outerTrail = this.add.circle(bullet.x, bullet.y, 12, colors.outer, 0.2).setDepth(197);
    this.tweens.add({
      targets: outerTrail,
      alpha: 0,
      scale: 0.3,
      duration: 200,
      onComplete: () => outerTrail.destroy()
    });

    // 2. 중간 글로우 트레일
    const midTrail = this.add.circle(bullet.x, bullet.y, 7, colors.mid, 0.4).setDepth(198);
    this.tweens.add({
      targets: midTrail,
      alpha: 0,
      scale: 0.2,
      duration: 180,
      onComplete: () => midTrail.destroy()
    });

    // 3. 코어 트레일 (밝은)
    const coreTrail = this.add.circle(bullet.x, bullet.y, 4, 0xffffff, 0.6).setDepth(199);
    this.tweens.add({
      targets: coreTrail,
      alpha: 0,
      scale: 0.1,
      duration: 150,
      onComplete: () => coreTrail.destroy()
    });

    // 4. 가끔 스파크 추가 (10% 확률)
    if (Math.random() < 0.1) {
      const sparkAngle = Math.random() * Math.PI * 2;
      const spark = this.add.circle(
        bullet.x + Math.cos(sparkAngle) * 5,
        bullet.y + Math.sin(sparkAngle) * 5,
        2, colors.spark, 0.8
      ).setDepth(199);

      this.tweens.add({
        targets: spark,
        x: bullet.x + Math.cos(sparkAngle) * 15,
        y: bullet.y + Math.sin(sparkAngle) * 15,
        alpha: 0,
        duration: 150,
        onComplete: () => spark.destroy()
      });
    }
  }

  destroyBullet(bullet) {
    if (bullet.graphics) {
      // === 타입별 폭발 색상 ===
      const explosionColors = {
        plasma: { flash: 0xff0066, core: 0xffff00, ring: 0xff0066, sparks: [0xff0066, 0xff00ff, 0xffff00, 0xffffff] },
        energy: { flash: 0x00ccff, core: 0xffffff, ring: 0x00ccff, sparks: [0x00ccff, 0x00ffff, 0x66eeff, 0xffffff] },
        spiral: { flash: 0x9900ff, core: 0xffffff, ring: 0x9900ff, sparks: [0x9900ff, 0xff00ff, 0xcc66ff, 0xffffff] },
        tracker: { flash: 0x00ff66, core: 0xffff00, ring: 0x00ff66, sparks: [0x00ff66, 0xffff00, 0x66ffaa, 0xffffff] },
        wall: { flash: 0xff6600, core: 0xffff00, ring: 0xff6600, sparks: [0xff6600, 0xff3300, 0xffaa66, 0xffffff] },
        shotgun: { flash: 0xffcc00, core: 0xffffff, ring: 0xffcc00, sparks: [0xffcc00, 0xffaa00, 0xffee66, 0xffffff] }
      };

      const colors = explosionColors[bullet.type] || explosionColors.plasma;

      // === 화려한 파괴 이펙트 ===
      const x = bullet.graphics.x;
      const y = bullet.graphics.y;

      // 1. 폭발 플래시 (멀티 레이어)
      const flashOuter = this.add.circle(x, y, 20, colors.flash, 0.4).setDepth(200);
      const flashCore = this.add.circle(x, y, 10, colors.core, 0.8).setDepth(201);

      this.tweens.add({
        targets: [flashOuter, flashCore],
        scale: 2,
        alpha: 0,
        duration: 150,
        onComplete: () => {
          flashOuter.destroy();
          flashCore.destroy();
        }
      });

      // 2. 확장 링
      const ring = this.add.circle(x, y, 5, colors.ring, 0).setDepth(199);
      ring.setStrokeStyle(2, colors.ring, 0.8);
      this.tweens.add({
        targets: ring,
        radius: 25,
        duration: 200,
        onUpdate: () => ring.setStrokeStyle(2, colors.ring, Math.max(0, 0.8 - ring.radius / 30)),
        onComplete: () => ring.destroy()
      });

      // 3. 스파크 파티클 (더 많이, 다양한 색상)
      const sparkColors = colors.sparks;
      for (let i = 0; i < 12; i++) {
        const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.3;
        const dist = 20 + Math.random() * 15;
        const color = sparkColors[Math.floor(Math.random() * sparkColors.length)];

        const spark = this.add.circle(x, y, 2 + Math.random() * 2, color, 1).setDepth(200);

        this.tweens.add({
          targets: spark,
          x: x + Math.cos(angle) * dist,
          y: y + Math.sin(angle) * dist,
          alpha: 0,
          scale: 0.2,
          duration: 250 + Math.random() * 100,
          ease: 'Power2.easeOut',
          onComplete: () => spark.destroy()
        });
      }

      // 4. 작은 파편 (빠르게 사라지는 선)
      for (let i = 0; i < 6; i++) {
        const angle = Math.random() * Math.PI * 2;
        const fragment = this.add.rectangle(x, y, 8, 2, colors.flash, 0.9).setDepth(200);
        fragment.setRotation(angle);

        this.tweens.add({
          targets: fragment,
          x: x + Math.cos(angle) * 18,
          y: y + Math.sin(angle) * 18,
          alpha: 0,
          scaleX: 0.2,
          rotation: angle + Math.PI * 0.5,
          duration: 180,
          ease: 'Power2.easeOut',
          onComplete: () => fragment.destroy()
        });
      }

      bullet.graphics.destroy();
    }
  }

  clearAllBullets() {
    for (const bullet of this.bullets) {
      if (bullet.graphics) {
        bullet.graphics.destroy();
      }
    }
    this.bullets = [];
  }

  handleBulletHit() {
    // 총알에 맞음 - 게임 오버
    this.clearAllBullets();
    this.cleanupBulletBoss();
    this.endGame();
  }

  startBulletUpdateTimer() {
    if (this.bulletUpdateTimer) {
      this.bulletUpdateTimer.destroy();
    }

    // 60fps로 총알 업데이트
    this.bulletUpdateTimer = this.time.addEvent({
      delay: 16, // ~60fps
      callback: () => this.updateBullets(),
      loop: true
    });
  }

  stopBulletUpdateTimer() {
    if (this.bulletUpdateTimer) {
      this.bulletUpdateTimer.destroy();
      this.bulletUpdateTimer = null;
    }
  }

  // ========== 탄막 보스 메인 로직 ==========

  startBulletBoss() {
    if (!this.isBossStage) {
      this.enterBossStage();
    }

    this.bulletBossMode = true;
    this.bulletBossPhase = 'intro';
    this.bulletBossHitCount = 0;
    this.bulletBossWaveCount = 0;
    this.bullets = [];

    // 기존 데드존 연출 폭파
    this.destroyAllDeadZonesWithAnimation();

    // 음식 숨김 처리
    this.food = { x: -100, y: -100 };
    this.hideFoodGraphics();

    // 회피 상태 초기화
    this.canDodge = true;
    this.lastDodgeTime = 0;
    this.isInvincible = false;
    this.lastDodgeDirection = 'up';

    // 인트로 연출 시작
    this.showBulletBossIntro();
  }

  hideFoodGraphics(options = {}) {
    const skipRedraw = options.skipRedraw || this.isStageClearingAnimation;
    // foodGraphics가 있으면 숨기기
    if (this.foodGraphics) {
      this.foodGraphics.setVisible(false);
    }
    // 카운트다운/클리어 상태에서는 그래픽을 다시 보이게 만들지 않음
    if (skipRedraw) {
      if (this.graphics && !this.graphics.visible) {
        this.graphics.clear();
      }
      return;
    }
    // 다시 그리기 (먹이가 화면 밖이므로 안 보임)
    this.draw();
  }

  hideSnakeGraphics() {
    // graphics 숨기기 (draw()에서 사용하는 객체)
    if (this.graphics) {
      this.graphics.clear();
      this.graphics.setVisible(false);
    }
    // 스피드 부스트 궤도도 숨기기
    if (this.speedBoostOrbitals) {
      this.speedBoostOrbitals.forEach(o => {
        if (o && o.setVisible) o.setVisible(false);
      });
    }
  }

  showSnakeGraphics() {
    // graphics 다시 보이기
    if (this.graphics) {
      this.graphics.setVisible(true);
    }
    // 스피드 부스트 궤도도 보이기
    if (this.hasSpeedBoost && this.speedBoostOrbitals) {
      this.speedBoostOrbitals.forEach(o => {
        if (o && o.setVisible) o.setVisible(true);
      });
    }
    this.draw();
  }

  showBulletBossIntro() {
    const { width, height } = this.cameras.main;

    // 게임 일시 정지
    this.moveTimer.paused = true;
    this.bossInputBlocked = true;

    // 1. 화면 어둡게
    const darkOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0).setDepth(4000);

    this.tweens.add({
      targets: darkOverlay,
      alpha: 0.7,
      duration: 1000
    });

    // 2. 경고 사이렌 효과
    this.time.delayedCall(500, () => {
      this.showBulletBossWarning();
    });

    // 3. 보스 등장 (2초 후)
    this.time.delayedCall(2000, () => {
      this.showBulletBossAppear(darkOverlay);
    });
  }

  showBulletBossWarning() {
    const { width, height } = this.cameras.main;

    // 화면 가장자리 빨간 글로우 깜빡임
    const warningGlow = this.add.rectangle(0, 0, width, height, 0xff0000, 0)
      .setOrigin(0, 0).setDepth(4001);
    warningGlow.setStrokeStyle(20, 0xff0000, 0);

    // 깜빡임 애니메이션
    let blinkCount = 0;
    const blinkTimer = this.time.addEvent({
      delay: 150,
      callback: () => {
        blinkCount++;
        const alpha = blinkCount % 2 === 0 ? 0 : 0.3;
        warningGlow.setFillStyle(0xff0000, alpha);
        warningGlow.setStrokeStyle(20, 0xff0000, alpha * 2);

        if (blinkCount >= 10) {
          blinkTimer.destroy();
          warningGlow.destroy();
        }
      },
      loop: true
    });

    // "WARNING" 텍스트
    const warningText = this.add.text(width / 2, height / 2, 'WARNING!', {
      fontSize: '48px',
      fontStyle: 'bold',
      fill: '#ff0000',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(4002).setAlpha(0);

    this.tweens.add({
      targets: warningText,
      alpha: 1,
      scale: { from: 0.5, to: 1.5 },
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: warningText,
          alpha: 0,
          duration: 500,
          delay: 500,
          onComplete: () => warningText.destroy()
        });
      }
    });

    // 카메라 쉐이크
    this.cameras.main.shake(500, 0.01);
  }

  showBulletBossAppear(darkOverlay) {
    const { width, height } = this.cameras.main;

    // 보스 위치 결정 (랜덤)
    let bossX, bossY;
    let attempts = 0;
    do {
      bossX = 5 + Math.floor(Math.random() * (this.cols - 10));
      bossY = 5 + Math.floor(Math.random() * (this.rows - 10));
      attempts++;
    } while (this.isPositionOccupied(bossX, bossY) && attempts < 50);

    this.bulletBossPosition = { x: bossX, y: bossY };

    // 플래시 효과
    const flash = this.add.rectangle(0, 0, width, height, 0xff00ff, 0)
      .setOrigin(0, 0).setDepth(4003);

    this.tweens.add({
      targets: flash,
      alpha: 0.8,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => flash.destroy()
    });

    // 카메라 강하게 쉐이크
    this.cameras.main.shake(500, 0.03);

    // 보스 그리기
    this.time.delayedCall(300, () => {
      this.drawBulletBoss();

      // 보스 대사 → 뱀 응답 → 보스 대사 → 게임 시작
      this.time.delayedCall(500, () => {
        this.showBulletBossDialogue("Hey, trash snake!", () => {
          // 뱀의 귀찮다는 듯한 응답
          this.showSnakeBubbleDialogue("Ugh... not you again.", () => {
            // 보스의 유머있는 강해짐 선언
            this.showBulletBossDialogue("I hit the gym! Prepare to get rekt!", () => {
              // "BULLET HELL!" 텍스트
              this.showBulletHellTitle(() => {
                // 어두운 오버레이 제거
                this.tweens.add({
                  targets: darkOverlay,
                  alpha: 0,
                  duration: 300,
                  onComplete: () => darkOverlay.destroy()
                });

                // 보스전 속도 90ms로 설정
                this.moveTimer.delay = 90;

                // 게임 재개 준비
                this.bulletBossPhase = 'shooting';
                this.bossInputBlocked = false;
                this.moveTimer.paused = false;

                // 총알 업데이트 타이머 시작
                this.startBulletUpdateTimer();

                // 회피 쿨다운 UI 표시
                this.showDodgeCooldownUIForBulletBoss();

                // 미사일 경고 → 튜토리얼 → 첫 웨이브 시작
                this.showMissileWarning(() => {
                  this.showDodgeTutorial(() => {
                    // 튜토리얼 끝나면 첫 웨이브 시작
                    this.startBulletWave();
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  // 뱀 말풍선 대사 표시
  showSnakeBubbleDialogue(text, callback) {
    const head = this.snake[0];
    const pixelX = head.x * this.gridSize + this.gridSize / 2;
    const pixelY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 말풍선 배경
    const bubbleBg = this.add.rectangle(pixelX, pixelY - 45, 180, 35, 0xffffff, 0.95)
      .setStrokeStyle(2, 0x00ff00).setDepth(4010);

    // 말풍선 꼬리
    const tail = this.add.triangle(pixelX, pixelY - 25, 0, 0, 10, 10, -10, 10, 0xffffff)
      .setDepth(4010);

    // 대사 텍스트
    const dialogueText = this.add.text(pixelX, pixelY - 45, text, {
      fontSize: '14px',
      fontStyle: 'bold',
      fill: '#00aa00'
    }).setOrigin(0.5).setDepth(4011).setAlpha(0);

    // 등장 애니메이션
    bubbleBg.setScale(0).setAlpha(0);
    tail.setScale(0).setAlpha(0);

    this.tweens.add({
      targets: [bubbleBg, tail],
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });

    // 타이핑 효과
    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 40,
      callback: () => {
        charIndex++;
        dialogueText.setText(text.substring(0, charIndex));
        dialogueText.setAlpha(1);
        if (charIndex >= text.length) {
          typeTimer.destroy();
        }
      },
      repeat: text.length - 1
    });

    // 1.5초 후 사라짐
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: [bubbleBg, tail, dialogueText],
        alpha: 0,
        scale: 0.8,
        duration: 200,
        onComplete: () => {
          bubbleBg.destroy();
          tail.destroy();
          dialogueText.destroy();
          if (callback) callback();
        }
      });
    });
  }

  // 미사일 발사 전 경고 표시
  showMissileWarning(callback) {
    const { width, height } = this.cameras.main;

    // 게임 일시 정지 (경고 중)
    this.moveTimer.paused = true;

    // 보스 위치에서 느낌표 표시
    if (this.bulletBossPosition) {
      const bossPixelX = this.bulletBossPosition.x * this.gridSize + this.gridSize / 2;
      const bossPixelY = this.bulletBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

      // 느낌표들이 사방으로 깜빡이며 경고
      const warningContainer = this.add.container(bossPixelX, bossPixelY).setDepth(3500);

      // 중앙 큰 느낌표
      const centerWarning = this.add.text(0, -50, '⚠', {
        fontSize: '48px'
      }).setOrigin(0.5);

      // 8방향 작은 느낌표
      const smallWarnings = [];
      for (let i = 0; i < 8; i++) {
        const angle = (Math.PI * 2 * i) / 8;
        const dist = 60;
        const warning = this.add.text(
          Math.cos(angle) * dist,
          Math.sin(angle) * dist,
          '!',
          {
            fontSize: '32px',
            fontStyle: 'bold',
            fill: '#ff0000',
            stroke: '#ffff00',
            strokeThickness: 4
          }
        ).setOrigin(0.5).setAlpha(0);
        smallWarnings.push(warning);
        warningContainer.add(warning);
      }

      warningContainer.add(centerWarning);

      // 중앙 느낌표 펄스
      this.tweens.add({
        targets: centerWarning,
        scale: { from: 1, to: 1.5 },
        duration: 200,
        yoyo: true,
        repeat: 4
      });

      // 8방향 느낌표 순차 등장
      smallWarnings.forEach((w, i) => {
        this.tweens.add({
          targets: w,
          alpha: 1,
          scale: { from: 0.5, to: 1.2 },
          duration: 150,
          delay: i * 80,
          yoyo: true,
          repeat: 2
        });
      });

      // "INCOMING!" 텍스트
      const incomingText = this.add.text(width / 2, height / 2 - 80, 'INCOMING!', {
        fontSize: '36px',
        fontStyle: 'bold',
        fill: '#ff0000',
        stroke: '#ffff00',
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(3501).setAlpha(0);

      this.tweens.add({
        targets: incomingText,
        alpha: 1,
        scale: { from: 0.5, to: 1.2 },
        duration: 300,
        ease: 'Back.easeOut'
      });

      // 화면 가장자리 빨간 경고
      const edgeWarning = this.add.rectangle(0, 0, width, height, 0xff0000, 0)
        .setOrigin(0, 0).setDepth(3499);

      this.tweens.add({
        targets: edgeWarning,
        alpha: 0.3,
        duration: 150,
        yoyo: true,
        repeat: 5
      });

      // 카메라 쉐이크
      this.cameras.main.shake(800, 0.008);

      // 경고 끝나면 정리 후 콜백
      this.time.delayedCall(1500, () => {
        this.tweens.add({
          targets: [warningContainer, incomingText, edgeWarning],
          alpha: 0,
          duration: 200,
          onComplete: () => {
            warningContainer.destroy();
            incomingText.destroy();
            edgeWarning.destroy();
            // 게임 재개
            this.moveTimer.paused = false;
            if (callback) callback();
          }
        });
      });
    } else {
      // 게임 재개
      this.moveTimer.paused = false;
      if (callback) callback();
    }
  }

  isPositionOccupied(x, y) {
    // 뱀과 겹치는지 체크
    for (const segment of this.snake) {
      if (segment.x === x && segment.y === y) return true;
    }
    // 데드존과 겹치는지 체크
    for (const dz of this.deadZones) {
      if (dz.x === x && dz.y === y) return true;
    }
    return false;
  }

  drawBulletBoss() {
    if (this.bulletBossElement) {
      this.bulletBossElement.destroy();
    }

    const { x, y } = this.bulletBossPosition;
    const pixelX = x * this.gridSize + this.gridSize / 2;
    const pixelY = y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    const container = this.add.container(pixelX, pixelY).setDepth(150);

    // 위험 링 (회전)
    const dangerRing = this.add.circle(0, 0, 25, 0xff0000, 0).setStrokeStyle(3, 0xff0000, 0.5);

    // 보스 몸체 (마젠타)
    const body = this.add.circle(0, 0, 15, 0xff00ff, 1);

    // 내부 코어 (어두운 색)
    const core = this.add.circle(0, 0, 8, 0x990099, 1);

    // 눈 (위협적)
    const eye1 = this.add.circle(-5, -3, 3, 0xffffff, 1);
    const eye2 = this.add.circle(5, -3, 3, 0xffffff, 1);
    const pupil1 = this.add.circle(-5, -3, 1.5, 0x000000, 1);
    const pupil2 = this.add.circle(5, -3, 1.5, 0x000000, 1);

    container.add([dangerRing, body, core, eye1, eye2, pupil1, pupil2]);

    // 위험 링 회전 애니메이션
    this.tweens.add({
      targets: dangerRing,
      rotation: Math.PI * 2,
      duration: 2000,
      repeat: -1
    });

    // 펄스 애니메이션
    this.tweens.add({
      targets: body,
      scale: { from: 1, to: 1.1 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // 등장 애니메이션
    container.setScale(0).setAlpha(0);
    this.tweens.add({
      targets: container,
      scale: 1,
      alpha: 1,
      duration: 500,
      ease: 'Back.easeOut'
    });

    this.bulletBossElement = container;
    this.bulletBossDangerRing = dangerRing;
    this.bulletBossBody = body;
  }

  showBulletBossDialogue(text, callback) {
    const { width, height } = this.cameras.main;

    const dialogueText = this.add.text(width / 2, height / 2 - 80, '', {
      fontSize: '28px',
      fontStyle: 'bold',
      fill: '#ff00ff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(4500);

    // 타이핑 효과
    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 50,
      callback: () => {
        charIndex++;
        dialogueText.setText(text.substring(0, charIndex));

        if (charIndex >= text.length) {
          typeTimer.destroy();

          // 1초 후 페이드아웃
          this.time.delayedCall(1000, () => {
            this.tweens.add({
              targets: dialogueText,
              alpha: 0,
              y: dialogueText.y - 30,
              duration: 300,
              onComplete: () => {
                dialogueText.destroy();
                if (callback) callback();
              }
            });
          });
        }
      },
      loop: true
    });
  }

  showBulletHellTitle(callback) {
    const { width, height } = this.cameras.main;

    const titleText = this.add.text(width / 2, height / 2, 'BULLET HELL!', {
      fontSize: '64px',
      fontStyle: 'bold',
      fill: '#ff0000',
      stroke: '#ffff00',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(4600).setScale(0).setAlpha(0);

    // 폭발적 등장
    this.tweens.add({
      targets: titleText,
      scale: 1.2,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 카메라 쉐이크
        this.cameras.main.shake(300, 0.02);

        // 파티클 폭발
        for (let i = 0; i < 20; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 50 + Math.random() * 100;
          const particle = this.add.circle(
            width / 2,
            height / 2,
            5 + Math.random() * 5,
            [0xff0000, 0xff00ff, 0xffff00][Math.floor(Math.random() * 3)]
          ).setDepth(4599);

          this.tweens.add({
            targets: particle,
            x: width / 2 + Math.cos(angle) * dist,
            y: height / 2 + Math.sin(angle) * dist,
            alpha: 0,
            duration: 500,
            onComplete: () => particle.destroy()
          });
        }

        // 페이드아웃
        this.time.delayedCall(800, () => {
          this.tweens.add({
            targets: titleText,
            alpha: 0,
            scale: 0.5,
            duration: 300,
            onComplete: () => {
              titleText.destroy();
              if (callback) callback();
            }
          });
        });
      }
    });
  }

  // ========== 웨이브 시스템 ==========

  startBulletWave() {
    if (!this.bulletBossMode || this.bulletBossPhase !== 'shooting') return;

    this.bulletBossWaveCount++;

    // 웨이브에 따라 패턴 복잡도 증가
    const wave = this.bulletBossWaveCount;

    // 모든 웨이브: 바로 발사 (경고는 첫 웨이브 인트로에서만)
    this.showWaveStartText(wave);
    this.executeBulletPattern(wave);
  }

  // 게임 멈추지 않는 빠른 경고 표시
  showQuickMissileWarning() {
    // 기존 경고 정리
    this.clearQuickMissileWarnings();

    if (!this.bulletBossPosition) return;

    // 경고 요소 저장 배열 초기화
    this.quickWarningElements = [];

    const bossPixelX = this.bulletBossPosition.x * this.gridSize + this.gridSize / 2;
    const bossPixelY = this.bulletBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 8방향 느낌표 (게임 멈추지 않음)
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const dist = 50;
      const warning = this.add.text(
        bossPixelX + Math.cos(angle) * dist,
        bossPixelY + Math.sin(angle) * dist,
        '!',
        {
          fontSize: '28px',
          fontStyle: 'bold',
          fill: '#ff0000',
          stroke: '#ffff00',
          strokeThickness: 3
        }
      ).setOrigin(0.5).setDepth(3500).setAlpha(0);

      this.quickWarningElements.push(warning);

      // 순차적으로 나타났다 사라지기
      this.tweens.add({
        targets: warning,
        alpha: 1,
        scale: { from: 0.5, to: 1.3 },
        duration: 100,
        delay: i * 50,
        yoyo: true,
        hold: 200,
        onComplete: () => {
          if (warning && warning.active) warning.destroy();
        }
      });
    }

    // 중앙 경고 아이콘
    const centerWarning = this.add.text(bossPixelX, bossPixelY - 40, '⚠', {
      fontSize: '36px'
    }).setOrigin(0.5).setDepth(3501).setAlpha(0);

    this.quickWarningElements.push(centerWarning);

    this.tweens.add({
      targets: centerWarning,
      alpha: 1,
      scale: { from: 0.8, to: 1.4 },
      duration: 150,
      yoyo: true,
      hold: 300,
      onComplete: () => {
        if (centerWarning && centerWarning.active) centerWarning.destroy();
      }
    });

    // 화면 가장자리 빨간 플래시 (짧게)
    const { width, height } = this.cameras.main;
    const edgeFlash = this.add.rectangle(0, 0, width, height, 0xff0000, 0)
      .setOrigin(0, 0).setDepth(3499);

    this.quickWarningElements.push(edgeFlash);

    this.tweens.add({
      targets: edgeFlash,
      alpha: 0.2,
      duration: 100,
      yoyo: true,
      repeat: 2,
      onComplete: () => {
        if (edgeFlash && edgeFlash.active) edgeFlash.destroy();
      }
    });
  }

  // 경고 요소들 즉시 정리
  clearQuickMissileWarnings() {
    if (this.quickWarningElements && this.quickWarningElements.length > 0) {
      for (const element of this.quickWarningElements) {
        if (element && element.active) {
          this.tweens.killTweensOf(element);
          element.destroy();
        }
      }
      this.quickWarningElements = [];
    }
  }

  showWaveStartText(wave) {
    const { width } = this.cameras.main;

    const waveText = this.add.text(width / 2, this.gameAreaY + 30, `WAVE ${wave}`, {
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#ff6600',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(3000).setAlpha(0);

    this.tweens.add({
      targets: waveText,
      alpha: 1,
      scale: { from: 0.5, to: 1 },
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: waveText,
          alpha: 0,
          duration: 500,
          delay: 500,
          onComplete: () => waveText.destroy()
        });
      }
    });
  }

  executeBulletPattern(wave) {
    // === 더 어려운 웨이브별 패턴 ===
    const patterns = [];
    const baseSpeed = 3.5 + wave * 0.3; // 웨이브마다 빨라짐

    // 웨이브 1: 12방향 + 빠른 속도
    patterns.push(() => this.fireRadialBullets(12, baseSpeed, 'plasma'));

    // 지연된 추가 방사 (첫 웨이브부터)
    patterns.push(() => {
      this.time.delayedCall(400, () => {
        this.fireRadialBullets(12, baseSpeed, 'energy', Math.PI / 12); // 오프셋으로 엇갈리게
      });
    });

    // 웨이브 2+: 나선형 2개 (반대 방향)
    if (wave >= 2) {
      patterns.push(() => {
        this.time.delayedCall(300, () => this.fireSpiralBullets(16, 0, baseSpeed - 0.5, 'spiral'));
        this.time.delayedCall(600, () => this.fireSpiralBullets(16, Math.PI, baseSpeed - 0.5, 'spiral'));
      });
    }

    // 웨이브 3+: 연속 조준탄 5발
    if (wave >= 3) {
      patterns.push(() => {
        for (let i = 0; i < 5; i++) {
          this.time.delayedCall(200 + i * 180, () => this.fireAimedBullet(baseSpeed + 1, 'tracker'));
        }
      });
    }

    // 웨이브 4+: 원형 벽 패턴 (피하기 어려움)
    if (wave >= 4) {
      patterns.push(() => {
        this.time.delayedCall(1000, () => {
          this.fireRadialBullets(24, baseSpeed - 1, 'wall');
          this.time.delayedCall(200, () => this.fireRadialBullets(24, baseSpeed - 1, 'wall', Math.PI / 24));
        });
      });
    }

    // 웨이브 5+: 산탄 패턴
    if (wave >= 5) {
      patterns.push(() => {
        this.time.delayedCall(800, () => this.fireShotgunBullets(7, baseSpeed + 0.5));
      });
    }

    // 모든 패턴 실행
    for (const pattern of patterns) {
      pattern();
    }

    // 웨이브 종료 후 vulnerable 상태로 전환
    const waveEndDelay = 2500 + wave * 400;
    this.time.delayedCall(waveEndDelay, () => {
      if (this.bulletBossMode && this.bulletBossPhase === 'shooting') {
        this.setBossVulnerable();
      }
    });
  }

  // 산탄 패턴 (뱀 방향으로 퍼지는 총알)
  fireShotgunBullets(count, speed) {
    if (!this.bulletBossPosition || !this.snake[0]) return;

    const bossX = this.bulletBossPosition.x;
    const bossY = this.bulletBossPosition.y;
    const head = this.snake[0];

    const baseAngle = Math.atan2(head.y - bossY, head.x - bossX);
    const spread = Math.PI / 6; // 30도 퍼짐

    for (let i = 0; i < count; i++) {
      const angle = baseAngle + spread * ((i / (count - 1)) - 0.5) * 2;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      this.createBullet(bossX, bossY, dx, dy, speed, 'shotgun');
    }

    this.showBulletFireEffect(bossX, bossY);
  }

  // ========== Vulnerable 상태 ==========

  setBossVulnerable() {
    if (!this.bulletBossMode) return;

    this.bulletBossPhase = 'vulnerable';

    // 보스 색상을 초록색으로 변경
    if (this.bulletBossBody) {
      this.tweens.add({
        targets: this.bulletBossBody,
        fillColor: { from: 0xff00ff, to: 0x00ff00 },
        duration: 300
      });
      this.bulletBossBody.setFillStyle(0x00ff00);
    }

    // "HIT ME!" 표시
    this.showHitMeIndicator();

    // 2초 후 다시 shooting 상태로 (맞지 않았다면)
    this.bulletBossVulnerableTimer = this.time.delayedCall(2000, () => {
      if (this.bulletBossPhase === 'vulnerable') {
        this.bulletBossPhase = 'shooting';
        this.hideHitMeIndicator();

        // 보스 색상 복원
        if (this.bulletBossBody) {
          this.bulletBossBody.setFillStyle(0xff00ff);
        }

        // 다음 웨이브
        this.startBulletWave();
      }
    });
  }

  showHitMeIndicator() {
    if (!this.bulletBossPosition) return;

    const { x, y } = this.bulletBossPosition;
    const pixelX = x * this.gridSize + this.gridSize / 2;
    const pixelY = y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    this.hitMeText = this.add.text(pixelX, pixelY - 40, 'HIT', {
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#00ff00',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(160);

    // 깜빡임 애니메이션
    this.tweens.add({
      targets: this.hitMeText,
      alpha: { from: 1, to: 0.3 },
      scale: { from: 1, to: 1.2 },
      duration: 200,
      yoyo: true,
      repeat: -1
    });
  }

  hideHitMeIndicator() {
    if (this.hitMeText) {
      this.hitMeText.destroy();
      this.hitMeText = null;
    }
  }

  // ========== HIT 처리 ==========

  handleBulletBossHit() {
    if (this.bulletBossPhase !== 'vulnerable') return;

    this.bulletBossHitCount++;

    // 타이머 취소
    if (this.bulletBossVulnerableTimer) {
      this.bulletBossVulnerableTimer.destroy();
    }

    // HIT ME 표시 제거
    this.hideHitMeIndicator();

    // 모든 총알 제거
    this.clearAllBullets();

    // 4번 HIT면 울트라 슬로우모션 파이널 히트!
    if (this.bulletBossHitCount >= 4) {
      this.handleBulletBossFinalHit();
    } else {
      // HIT 이펙트
      this.showBulletBossHitEffect();

      // HIT 텍스트
      const hitText = `HIT ${this.bulletBossHitCount}/4!`;
      this.showHitText(hitText);

      // 보스 텔레포트 후 잠시 텀을 두고 다음 웨이브
      this.time.delayedCall(1000, () => {
        this.teleportBulletBoss();

        // 새 위치에서 느낌표 경고 후 공격 시작
        this.time.delayedCall(400, () => {
          this.showBossWarningBeforeAttack(() => {
            this.bulletBossPhase = 'shooting';
            this.startBulletWave();
          });
        });
      });
    }
  }

  // 보스가 새 위치에서 공격 전 느낌표 경고 표시
  showBossWarningBeforeAttack(onComplete) {
    if (!this.bulletBossPosition) {
      onComplete();
      return;
    }

    const { x, y } = this.bulletBossPosition;
    const pixelX = x * this.gridSize + this.gridSize / 2;
    const pixelY = y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 느낌표 표시
    const warningText = this.add.text(pixelX, pixelY - 35, '!', {
      fontSize: '28px',
      fontStyle: 'bold',
      fill: '#ff0000',
      stroke: '#ffff00',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(160).setAlpha(0);

    // 빠르게 나타났다 사라지는 애니메이션
    this.tweens.add({
      targets: warningText,
      alpha: 1,
      scale: { from: 0.5, to: 1.3 },
      duration: 150,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 잠시 유지 후 사라짐
        this.tweens.add({
          targets: warningText,
          alpha: { from: 1, to: 0.5 },
          scale: { from: 1.3, to: 1.1 },
          duration: 100,
          yoyo: true,
          repeat: 1,
          onComplete: () => {
            this.tweens.add({
              targets: warningText,
              alpha: 0,
              scale: 0.3,
              duration: 100,
              onComplete: () => {
                warningText.destroy();
                onComplete();
              }
            });
          }
        });
      }
    });
  }

  // 탄막 보스 파이널 히트 - 울트라 슬로우모션 극적 연출 (짧게)
  handleBulletBossFinalHit() {
    const { width, height } = this.cameras.main;

    // 게임 완전 정지
    this.moveTimer.paused = true;
    this.bulletBossPhase = 'victory';

    // 보스 위치
    const bossX = this.bulletBossElement ? this.bulletBossElement.x : width / 2;
    const bossY = this.bulletBossElement ? this.bulletBossElement.y : height / 2;

    // === PHASE 1: 슬로우모션 + 화면 어둡게 ===
    this.time.timeScale = 0.3;

    const darkOverlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0)
      .setDepth(5000).setScrollFactor(0); // 화면 고정
    this.tweens.add({
      targets: darkOverlay,
      alpha: 0.5,
      duration: 200
    });

    // 카메라 줌 (빠르게)
    this.cameras.main.zoomTo(1.8, 300, 'Power2', false, (cam, zoomProgress) => {
      if (zoomProgress === 1) {
        this.cameras.main.shake(400, 0.04);

        // === PHASE 2: "FINAL HIT!" 텍스트 (화면 중앙 고정) ===
        const finalHitText = this.add.text(width / 2, height / 2 - 60, 'FINAL HIT!!', {
          fontSize: '56px',
          fontStyle: 'bold',
          fill: '#ff0000',
          stroke: '#ffff00',
          strokeThickness: 8
        }).setOrigin(0.5).setDepth(6000).setScale(0).setScrollFactor(0);

        this.tweens.add({
          targets: finalHitText,
          scale: 1.2,
          duration: 250,
          ease: 'Back.easeOut'
        });

        // 보스 비명 (월드 좌표)
        const scream = this.add.text(bossX, bossY - 40, "NOOOOO!!!", {
          fontSize: '28px',
          fontStyle: 'bold',
          fill: '#ff00ff',
          stroke: '#ffffff',
          strokeThickness: 3
        }).setOrigin(0.5).setDepth(6001).setAlpha(0);

        this.tweens.add({
          targets: scream,
          alpha: 1,
          y: bossY - 70,
          scale: { from: 0.5, to: 1.5 },
          duration: 400
        });

        // 보스 팽창
        if (this.bulletBossElement) {
          this.tweens.add({
            targets: this.bulletBossElement,
            scale: 2,
            duration: 400,
            ease: 'Quad.easeIn'
          });
        }

        // === PHASE 3: 대폭발 (400ms 후) ===
        this.time.delayedCall(400, () => {
          // 화면 플래시
          const flash = this.add.rectangle(width / 2, height / 2, width * 2, height * 2, 0xffffff, 0)
            .setDepth(6500).setScrollFactor(0);
          this.tweens.add({
            targets: flash,
            alpha: 0.9,
            duration: 100,
            yoyo: true,
            hold: 50,
            onComplete: () => flash.destroy()
          });

          // 보스 폭발
          if (this.bulletBossElement) {
            const bx = this.bulletBossElement.x;
            const by = this.bulletBossElement.y;

            // 폭발 링
            for (let ring = 0; ring < 2; ring++) {
              const explosionRing = this.add.circle(bx, by, 10, 0xffffff, 0).setDepth(6200);
              explosionRing.setStrokeStyle(4, [0xff00ff, 0xffff00][ring]);
              this.tweens.add({
                targets: explosionRing,
                radius: 100 + ring * 40,
                alpha: 0,
                duration: 400,
                delay: ring * 50,
                onComplete: () => explosionRing.destroy()
              });
            }

            // 폭발 파티클
            for (let i = 0; i < 25; i++) {
              const angle = (i / 25) * Math.PI * 2;
              const dist = 40 + Math.random() * 80;
              const colors = [0xff00ff, 0xffff00, 0x00ffff, 0xffffff];
              const particle = this.add.star(bx, by, 5, 3, 6,
                colors[Math.floor(Math.random() * colors.length)]
              ).setDepth(6100);

              this.tweens.add({
                targets: particle,
                x: bx + Math.cos(angle) * dist,
                y: by + Math.sin(angle) * dist,
                rotation: Math.random() * 6,
                scale: 0,
                alpha: 0,
                duration: 500,
                onComplete: () => particle.destroy()
              });
            }

            this.bulletBossElement.destroy();
            this.bulletBossElement = null;
          }

          // 텍스트 페이드아웃
          this.tweens.add({
            targets: [finalHitText, scream],
            alpha: 0,
            duration: 300,
            delay: 200,
            onComplete: () => {
              if (finalHitText && finalHitText.active) finalHitText.destroy();
              if (scream && scream.active) scream.destroy();
            }
          });

          // === PHASE 4: 줌 아웃 & 승리 (600ms 후) ===
          this.time.delayedCall(600, () => {
            this.time.timeScale = 1;

            this.tweens.add({
              targets: darkOverlay,
              alpha: 0,
              duration: 200,
              onComplete: () => darkOverlay.destroy()
            });

            this.cameras.main.zoomTo(1, 300, 'Power2', false, () => {
              this.showBulletBossVictory();
            });
          });
        });
      }
    });
  }

  showBulletBossHitEffect() {
    if (!this.bulletBossElement) return;

    const x = this.bulletBossElement.x;
    const y = this.bulletBossElement.y;

    // 폭발 파티클
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const dist = 30 + Math.random() * 30;
      const particle = this.add.circle(
        x, y,
        4 + Math.random() * 4,
        [0x00ff00, 0xffff00, 0xffffff][Math.floor(Math.random() * 3)]
      ).setDepth(200);

      this.tweens.add({
        targets: particle,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        duration: 400,
        onComplete: () => particle.destroy()
      });
    }

    // 카메라 쉐이크
    this.cameras.main.shake(200, 0.02);

    // 보스 깜빡임
    this.tweens.add({
      targets: this.bulletBossElement,
      alpha: 0,
      duration: 100,
      yoyo: true,
      repeat: 3
    });
  }

  showHitText(text) {
    const { width, height } = this.cameras.main;

    const hitText = this.add.text(width / 2, height / 2, text, {
      fontSize: '48px',
      fontStyle: 'bold',
      fill: '#ffff00',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5000).setScale(0);

    this.tweens.add({
      targets: hitText,
      scale: 1.2,
      duration: 200,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: hitText,
          alpha: 0,
          y: hitText.y - 50,
          duration: 500,
          delay: 300,
          onComplete: () => hitText.destroy()
        });
      }
    });
  }

  teleportBulletBoss() {
    // 새 위치 결정
    let newX, newY;
    let attempts = 0;
    do {
      newX = 5 + Math.floor(Math.random() * (this.cols - 10));
      newY = 5 + Math.floor(Math.random() * (this.rows - 10));
      attempts++;
    } while ((this.isPositionOccupied(newX, newY) ||
             (newX === this.bulletBossPosition.x && newY === this.bulletBossPosition.y)) &&
             attempts < 50);

    // 사라지는 이펙트
    if (this.bulletBossElement) {
      this.tweens.add({
        targets: this.bulletBossElement,
        alpha: 0,
        scale: 0,
        duration: 200,
        onComplete: () => {
          this.bulletBossElement.destroy();
          this.bulletBossPosition = { x: newX, y: newY };
          this.drawBulletBoss();
        }
      });
    }
  }

  // ========== 승리 처리 ==========

  showBulletBossVictory() {
    // 이미 파이널 히트에서 phase를 victory로 설정했으므로 다시 확인
    this.bulletBossPhase = 'victory';
    const { width, height } = this.cameras.main;
    const centerX = width / 2;
    const centerY = height / 2;
    const victoryElements = [];

    // 게임 완전 정지 (뱀이 움직이지 않도록)
    this.moveTimer.paused = true;
    this.stopBulletUpdateTimer();
    this.clearQuickMissileWarnings();

    // 게임 영역 클리어 (뱀, 먹이 숨기기)
    this.clearGameAreaForVictory();

    // 보스는 파이널 히트에서 이미 파괴됨 - 바로 축하 연출로
    // === "BULLET HELL CLEAR!" 텍스트 바로 시작 ===

    // 화면 플래시 (노란색)
    const flash2 = this.add.rectangle(centerX, centerY, width, height, 0xffff00, 0.6)
      .setDepth(6000).setScrollFactor(0);
    victoryElements.push(flash2);
    this.tweens.add({
      targets: flash2,
      alpha: 0,
      duration: 300,
      onComplete: () => flash2.destroy()
    });

    // "BULLET HELL" 텍스트 (위에서 떨어짐)
    const bulletHellText = this.add.text(centerX, -100, 'BULLET HELL', {
      fontSize: '64px',
      fontStyle: 'bold',
      fill: '#ff00ff',
      stroke: '#ffffff',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(6500).setScrollFactor(0);
    victoryElements.push(bulletHellText);

    this.tweens.add({
      targets: bulletHellText,
      y: centerY - 50,
      duration: 400,
      ease: 'Bounce.easeOut'
    });

    // "CLEAR!!" 텍스트 (아래에서 올라옴)
    const clearText = this.add.text(centerX, height + 100, 'CLEAR!!', {
      fontSize: '80px',
      fontStyle: 'bold',
      fill: '#ffff00',
      stroke: '#ff6600',
      strokeThickness: 8
    }).setOrigin(0.5).setDepth(6500).setScrollFactor(0);
    victoryElements.push(clearText);

    this.tweens.add({
      targets: clearText,
      y: centerY + 40,
      duration: 400,
      ease: 'Bounce.easeOut',
      delay: 200
    });

    // 텍스트 펄스 효과
    this.time.delayedCall(700, () => {
      this.tweens.add({
        targets: [bulletHellText, clearText],
        scale: { from: 1, to: 1.1 },
        duration: 300,
        yoyo: true,
        repeat: 3,
        ease: 'Sine.easeInOut'
      });

      // 레인보우 글로우 효과
      let glowTime = 0;
      const glowInterval = this.time.addEvent({
        delay: 50,
        callback: () => {
          glowTime += 0.2;
          const hue = (Math.sin(glowTime) + 1) / 2;
          bulletHellText.setTint(Phaser.Display.Color.HSLToColor(hue, 1, 0.5).color);
        },
        repeat: 40
      });
    });

    // === PHASE 3: 컨페티 & 불꽃놀이 (1초 후) ===
    this.time.delayedCall(1000, () => {
      // 컨페티 비
      for (let i = 0; i < 100; i++) {
        const confetti = this.add.rectangle(
          Math.random() * width,
          -20 - Math.random() * 200,
          8 + Math.random() * 8,
          4 + Math.random() * 4,
          [0xff00ff, 0xffff00, 0x00ffff, 0xff0000, 0x00ff00, 0xff6600][Math.floor(Math.random() * 6)]
        ).setDepth(5800).setRotation(Math.random() * Math.PI);
        victoryElements.push(confetti);

        this.tweens.add({
          targets: confetti,
          y: height + 50,
          x: confetti.x + (Math.random() - 0.5) * 200,
          rotation: confetti.rotation + Math.random() * 10,
          duration: 2000 + Math.random() * 1500,
          delay: Math.random() * 1000,
          onComplete: () => confetti.destroy()
        });
      }

      // 불꽃놀이 (화면 여러 곳에서)
      for (let fw = 0; fw < 5; fw++) {
        this.time.delayedCall(fw * 400, () => {
          const fwX = 100 + Math.random() * (width - 200);
          const fwY = 100 + Math.random() * (height - 250);
          const fwColor = [0xff00ff, 0xffff00, 0x00ffff, 0xff6600, 0x00ff00][fw];

          // 불꽃 발사
          const rocket = this.add.circle(fwX, height, 5, fwColor).setDepth(5900);
          victoryElements.push(rocket);

          this.tweens.add({
            targets: rocket,
            y: fwY,
            duration: 400,
            ease: 'Quad.easeOut',
            onComplete: () => {
              rocket.destroy();

              // 폭발 파티클
              for (let p = 0; p < 24; p++) {
                const angle = (p / 24) * Math.PI * 2;
                const dist = 40 + Math.random() * 60;
                const spark = this.add.circle(fwX, fwY, 3 + Math.random() * 4, fwColor).setDepth(5900);
                victoryElements.push(spark);

                this.tweens.add({
                  targets: spark,
                  x: fwX + Math.cos(angle) * dist,
                  y: fwY + Math.sin(angle) * dist + 30,
                  alpha: 0,
                  scale: 0,
                  duration: 800,
                  ease: 'Quad.easeOut',
                  onComplete: () => spark.destroy()
                });
              }

              // 폭발음 대신 시각적 플래시
              const miniFlash = this.add.circle(fwX, fwY, 30, fwColor, 0.5).setDepth(5890);
              victoryElements.push(miniFlash);
              this.tweens.add({
                targets: miniFlash,
                scale: 2,
                alpha: 0,
                duration: 200,
                onComplete: () => miniFlash.destroy()
              });
            }
          });
        });
      }
    });

    // === PHASE 4: 보너스 점수 (1.8초 후) ===
    this.time.delayedCall(1800, () => {
      // "+1000 BONUS!"
      const bonusText = this.add.text(centerX, centerY + 100, '+1000 BONUS!', {
        fontSize: '40px',
        fontStyle: 'bold',
        fill: '#00ff00',
        stroke: '#004400',
        strokeThickness: 5
      }).setOrigin(0.5).setDepth(6500).setScale(0).setScrollFactor(0);
      victoryElements.push(bonusText);

      this.tweens.add({
        targets: bonusText,
        scale: 1.3,
        duration: 300,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: bonusText,
            scale: 1,
            duration: 200
          });
        }
      });

      // 점수 카운트업 효과
      this.score = 0;
      const scoreCountUp = this.time.addEvent({
        delay: 20,
        callback: () => {
          this.score += 50;
          if (this.score >= 1000) {
            this.score = 1000;
            scoreCountUp.remove();
          }
          this.scoreText.setText(this.score.toString());
        },
        repeat: 20
      });

      // 코인 파티클
      for (let c = 0; c < 20; c++) {
        const coin = this.add.circle(
          bonusText.x + (Math.random() - 0.5) * 200,
          bonusText.y,
          6, 0xffd700
        ).setDepth(6400);
        victoryElements.push(coin);

        this.tweens.add({
          targets: coin,
          y: coin.y - 50 - Math.random() * 50,
          alpha: 0,
          duration: 600,
          delay: c * 30,
          ease: 'Quad.easeOut',
          onComplete: () => coin.destroy()
        });
      }
    });

    // === PHASE 5: 승리 링 이펙트 (2.5초 후) ===
    this.time.delayedCall(2500, () => {
      // 화면 중앙에서 퍼지는 승리 링
      for (let i = 0; i < 3; i++) {
        this.time.delayedCall(i * 200, () => {
          const victoryRing = this.add.circle(centerX, centerY, 20, 0xffffff, 0).setDepth(6000);
          victoryRing.setStrokeStyle(4, 0xffd700);
          victoryElements.push(victoryRing);

          this.tweens.add({
            targets: victoryRing,
            radius: 400,
            alpha: 0,
            duration: 800,
            onComplete: () => victoryRing.destroy()
          });
        });
      }
    });

    // === PHASE 6: 마무리 및 상점 전환 (4초 후) ===
    this.time.delayedCall(4000, () => {
      // 모든 텍스트 페이드 아웃
      victoryElements.forEach(el => {
        if (el && el.active) {
          this.tweens.add({
            targets: el,
            alpha: 0,
            duration: 500,
            onComplete: () => el.destroy()
          });
        }
      });

      // 마지막 화면 플래시
      const finalFlash = this.add.rectangle(centerX, centerY, width, height, 0xffffff, 0.4).setDepth(7000);
      this.tweens.add({
        targets: finalFlash,
        alpha: 0,
        duration: 500,
        onComplete: () => finalFlash.destroy()
      });

      this.time.delayedCall(800, () => {
        this.cleanupBulletBoss();

        // 상점 오픈 또는 다음 스테이지
        if (this.currentStage >= 3) {
          this.openShop();
        } else {
          this.showStageClearText();
        }
      });
    });
  }

  cleanupBulletBoss() {
    this.bulletBossMode = false;
    this.bulletBossPhase = 'none';
    this.bulletBossPosition = null;

    // 총알 정리
    this.clearAllBullets();
    this.stopBulletUpdateTimer();

    // UI 정리
    this.hideDodgeCooldownUI();
    this.hideHitMeIndicator();

    // 보호막 정리
    this.stopPostDodgeShield();
    this.isInvincible = false;

    // 보스 요소 정리
    if (this.bulletBossElement) {
      this.bulletBossElement.destroy();
      this.bulletBossElement = null;
    }

    // 콤보 복원
    this.combo = this.savedCombo;
    this.comboShieldCount = this.savedComboShieldCount;
    if (this.combo > 0) {
      this.comboText.setText(`x${this.combo}`);
    }

    // 게임 재개는 상점 닫힌 후 또는 다음 스테이지에서 처리
    // this.moveTimer.paused = false; // 여기서 재개하지 않음!
  }

  // 승리 연출용 게임 영역 클리어
  clearGameAreaForVictory() {
    // 뱀 그래픽 숨기기
    if (this.snakeGraphics) {
      this.snakeGraphics.clear();
    }

    // 먹이 그래픽 숨기기
    if (this.foodGraphics) {
      this.foodGraphics.clear();
    }

    // 데드존 숨기기
    if (this.deadZones) {
      this.deadZones.forEach(dz => {
        if (dz.rect) dz.rect.setVisible(false);
      });
    }

    // 톱니 숨기기
    if (this.saws) {
      this.saws.forEach(saw => {
        if (saw.container) saw.container.setVisible(false);
      });
    }

    // 자기장 숨기기
    if (this.gasZoneGraphics) {
      this.gasZoneGraphics.clear();
    }
  }

  // 탄막 보스 스테이지 체크 (showNextStage에서 호출)
  isBulletBossStage() {
    return this.currentStage === this.testBulletBossStage;
  }

  // 안개 보스 스테이지 체크
  isFogBossStage() {
    return this.currentStage === this.testFogBossStage;
  }

  // ========== 안개 보스 (Nocturn) 시스템 ==========

  // 안개 보스 시작
  startFogBoss() {
    const previousCombo = this.isBossStage ? this.savedCombo : this.combo;
    const previousShield = this.isBossStage ? this.savedComboShieldCount : this.comboShieldCount;

    if (!this.isBossStage) {
      this.enterBossStage();
      this.savedCombo = previousCombo;
      this.savedComboShieldCount = previousShield;
    }

    this.fogBossMode = true;
    this.fogBossPhase = 'intro';
    this.fogBossHitCount = 0;
    this.fogBossVisible = false;
    this.flareCount = 0;
    this.flares = [];
    this.hallucinationFoods = [];

    if (this.moveTimer) {
      this.moveTimer.delay = 90;
      this.speedText.setText('90ms');
    }

    this.savedFogBossCombo = previousCombo;
    this.savedFogBossShieldCount = previousShield;
    this.combo = 0;
    this.comboShieldCount = 0;
    this.updateItemStatusUI();

    this.fogTestForceEnable = true;
    this.originalFogVisibleTiles = this.fogVisibleTiles;
    this.fogVisibleTiles = 2.5;
    this.fogEnabled = true;
    this.ensureFogAssets();

    this.draw();
    this.updateFogOfWar();

    this.food = { x: -100, y: -100 };

    this.moveTimer.paused = true;

    this.showFogBossIntro();
  }

  showFogBossIntro() {
    const { width, height } = this.cameras.main;
    this.fogBossInputBlocked = true;
    this.fogBossElements = [];

    // 1. 화면 어둡게
    const darkOverlay = this.add.rectangle(0, 0, width, height, 0x000000, 0)
      .setOrigin(0, 0)
      .setDepth(5000);
    this.fogBossElements.push(darkOverlay);

    this.tweens.add({
      targets: darkOverlay,
      alpha: 0.85,
      duration: 800,
      ease: 'Power2'
    });

    // 2. 속삭임 텍스트
    this.time.delayedCall(1000, () => {
      const whisperText = this.add.text(width / 2, height / 2 - 50, '', {
        fontSize: '28px',
        fill: '#666666',
        fontStyle: 'italic'
      }).setOrigin(0.5).setDepth(5001).setAlpha(0);
      this.fogBossElements.push(whisperText);

      this.tweens.add({
        targets: whisperText,
        alpha: 1,
        duration: 300
      });

      // 타이핑 효과
      const whisperMessage = '...';
      let charIndex = 0;
      const typeTimer = this.time.addEvent({
        delay: 200,
        callback: () => {
          charIndex++;
          whisperText.setText(whisperMessage.substring(0, charIndex));
          if (charIndex >= whisperMessage.length) {
            typeTimer.destroy();
          }
        },
        loop: true
      });

      // 3. 빨간 눈 등장 (1.5초 후)
      this.time.delayedCall(1500, () => {
        // 속삭임 페이드아웃
        this.tweens.add({
          targets: whisperText,
          alpha: 0,
          duration: 300
        });

        // 🆕 DOM(브라우저 배경)도 함께 어두워지는 공포 연출!
        this.createBrowserDarkness();

        // 추가 공포 연출: 브라우저 전체 빨간 플래시
        this.flashBrowserRed();

        this.showFogBossEyesAppear();
      });
    });
  }

  // 빨간 눈 등장 애니메이션
  showFogBossEyesAppear() {
    const { width, height } = this.cameras.main;

    // 보스 초기 위치 (화면 중앙 우측)
    const bossX = Math.floor(this.cols * 0.7);
    const bossY = Math.floor(this.rows * 0.5);
    this.fogBossPosition = { x: bossX, y: bossY };

    const pixelX = bossX * this.gridSize + this.gridSize / 2;
    const pixelY = bossY * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 빨간 눈 컨테이너
    const eyesContainer = this.add.container(pixelX, pixelY).setDepth(5002);
    this.fogBossElements.push(eyesContainer);

    // 눈 글로우 (배경)
    const leftGlow = this.add.circle(-10, 0, 12, 0xff0000, 0.3);
    const rightGlow = this.add.circle(10, 0, 12, 0xff0000, 0.3);
    eyesContainer.add([leftGlow, rightGlow]);

    // 눈 (핵심)
    const leftEye = this.add.circle(-10, 0, 5, 0xff0000, 0);
    const rightEye = this.add.circle(10, 0, 5, 0xff0000, 0);
    eyesContainer.add([leftEye, rightEye]);

    // 눈동자
    const leftPupil = this.add.circle(-10, 0, 2, 0x000000, 0);
    const rightPupil = this.add.circle(10, 0, 2, 0x000000, 0);
    eyesContainer.add([leftPupil, rightPupil]);

    // 눈 페이드인 + 스케일
    eyesContainer.setScale(0.5);
    this.tweens.add({
      targets: [leftEye, rightEye],
      alpha: 1,
      duration: 500,
      ease: 'Power2'
    });
    this.tweens.add({
      targets: [leftPupil, rightPupil],
      alpha: 1,
      duration: 500,
      delay: 200,
      ease: 'Power2'
    });
    this.tweens.add({
      targets: [leftGlow, rightGlow],
      alpha: 0.5,
      duration: 600,
      ease: 'Power2'
    });
    this.tweens.add({
      targets: eyesContainer,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 600,
      ease: 'Back.easeOut'
    });

    // 눈 펄스 애니메이션
    this.tweens.add({
      targets: eyesContainer,
      scaleX: { from: 1.1, to: 1.3 },
      scaleY: { from: 1.1, to: 1.3 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 카메라 살짝 흔들기
    this.cameras.main.shake(300, 0.005);

    // 4. 보스 대사 (1초 후)
    this.time.delayedCall(1000, () => {
      this.showFogBossDialogue('You dare enter MY domain...', 0xff0000, () => {
        // 5. 보스 전체 모습 공개
        this.time.delayedCall(500, () => {
          this.revealFogBoss(eyesContainer);
        });
      });
    });
  }

  // 보스 대사 표시 (타이핑 효과)
  showFogBossDialogue(text, color = 0xff0000, callback = null) {
    const { width, height } = this.cameras.main;

    const dialogueText = this.add.text(width / 2, height / 2 + 80, '', {
      fontSize: '24px',
      fill: `#${color.toString(16).padStart(6, '0')}`,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5003);
    this.fogBossElements.push(dialogueText);

    // 타이핑 효과
    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 50,
      callback: () => {
        charIndex++;
        dialogueText.setText(text.substring(0, charIndex));
        if (charIndex >= text.length) {
          typeTimer.destroy();
          // 대사 완료 후 콜백
          if (callback) {
            this.time.delayedCall(800, callback);
          }
        }
      },
      loop: true
    });

    // 화면 가장자리 빨간 글로우
    const edgeGlow = this.add.rectangle(0, 0, width, height, color, 0)
      .setOrigin(0, 0)
      .setDepth(4999);
    this.fogBossElements.push(edgeGlow);

    this.tweens.add({
      targets: edgeGlow,
      alpha: 0.15,
      duration: 300,
      yoyo: true,
      repeat: 2
    });
  }

  // 보스 전체 모습 공개
  revealFogBoss(eyesContainer) {
    const { width, height } = this.cameras.main;

    // 에너지 수렴 파티클
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const startDist = 100 + Math.random() * 50;
      const particle = this.add.circle(
        eyesContainer.x + Math.cos(angle) * startDist,
        eyesContainer.y + Math.sin(angle) * startDist,
        4 + Math.random() * 3,
        0x330033,
        0.8
      ).setDepth(5001);
      this.fogBossElements.push(particle);

      this.tweens.add({
        targets: particle,
        x: eyesContainer.x,
        y: eyesContainer.y,
        scale: 0.2,
        alpha: 0,
        duration: 600 + Math.random() * 300,
        ease: 'Power2.easeIn',
        onComplete: () => particle.destroy()
      });
    }

    // 폭발 플래시
    this.time.delayedCall(700, () => {
      const flash = this.add.circle(eyesContainer.x, eyesContainer.y, 10, 0x660066, 1)
        .setDepth(5004);
      this.fogBossElements.push(flash);

      this.tweens.add({
        targets: flash,
        scaleX: 8,
        scaleY: 8,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => flash.destroy()
      });

      // 보스 본체 그리기
      this.drawFogBoss();

      // 기존 눈 컨테이너 제거
      eyesContainer.destroy();

      // 보스 이름 등장
      this.time.delayedCall(300, () => {
        this.showFogBossTitle();
      });
    });
  }

  // 보스 이름 타이틀 애니메이션
  showFogBossTitle() {
    const { width, height } = this.cameras.main;

    // 이름 배경
    const titleBg = this.add.rectangle(width / 2, height / 2 - 120, 300, 50, 0x000000, 0.8)
      .setOrigin(0.5)
      .setDepth(5005)
      .setScale(0);
    this.fogBossElements.push(titleBg);

    // 보스 이름
    const titleText = this.add.text(width / 2, height / 2 - 120, 'NOCTURN', {
      fontSize: '36px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5006).setScale(0);
    this.fogBossElements.push(titleText);

    // 부제
    const subtitleText = this.add.text(width / 2, height / 2 - 85, '심연의 그림자', {
      fontSize: '16px',
      fill: '#aa0000',
      fontStyle: 'italic'
    }).setOrigin(0.5).setDepth(5006).setAlpha(0);
    this.fogBossElements.push(subtitleText);

    // 애니메이션
    this.tweens.add({
      targets: [titleBg, titleText],
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: subtitleText,
      alpha: 1,
      duration: 300,
      delay: 300
    });

    // 제목 깜빡임
    this.tweens.add({
      targets: titleText,
      alpha: { from: 1, to: 0.7 },
      duration: 500,
      yoyo: true,
      repeat: 3,
      delay: 500
    });

    // 뱀 반응
    this.time.delayedCall(1500, () => {
      this.showSnakeReactionToFogBoss();
    });
  }

  // 뱀 반응
  showSnakeReactionToFogBoss() {
    const { width, height } = this.cameras.main;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 뱀 말풍선
    const bubbleBg = this.add.ellipse(headX + 50, headY - 30, 160, 40, 0xffffff, 0.9)
      .setDepth(5007)
      .setScale(0);
    this.fogBossElements.push(bubbleBg);

    const bubbleText = this.add.text(headX + 50, headY - 30, 'What is this thing?!', {
      fontSize: '12px',
      fill: '#000000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5008).setAlpha(0);
    this.fogBossElements.push(bubbleText);

    this.tweens.add({
      targets: bubbleBg,
      scaleX: 1,
      scaleY: 1,
      duration: 200,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: bubbleText,
      alpha: 1,
      duration: 200,
      delay: 100
    });

    // 튜토리얼 힌트
    this.time.delayedCall(1500, () => {
      this.showFogBossTutorial();
    });
  }

  // 튜토리얼 힌트
  showFogBossTutorial() {
    const { width, height } = this.cameras.main;

    // 힌트 배경
    const hintBg = this.add.rectangle(width / 2, height - 100, 400, 60, 0x333300, 0.9)
      .setOrigin(0.5)
      .setDepth(5007)
      .setAlpha(0);
    this.fogBossElements.push(hintBg);

    // 조명탄 아이콘 (원으로 표현)
    const flareIcon = this.add.circle(width / 2 - 150, height - 100, 15, 0xffff00, 0)
      .setDepth(5008);
    this.fogBossElements.push(flareIcon);

    // 힌트 텍스트
    const hintText = this.add.text(width / 2 + 10, height - 100, 'Find FLARES to expose the shadow!', {
      fontSize: '18px',
      fill: '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(5008).setAlpha(0);
    this.fogBossElements.push(hintText);

    // 페이드인
    this.tweens.add({
      targets: [hintBg, flareIcon, hintText],
      alpha: 1,
      duration: 400
    });

    // 조명탄 아이콘 펄스
    this.tweens.add({
      targets: flareIcon,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      duration: 500,
      yoyo: true,
      repeat: 3
    });

    // 인트로 종료 및 게임 시작
    this.time.delayedCall(2500, () => {
      this.endFogBossIntro();
    });
  }

  // 인트로 종료
  endFogBossIntro() {
    // 모든 인트로 요소 페이드아웃
    this.fogBossElements.forEach(element => {
      if (element && element.active) {
        this.tweens.add({
          targets: element,
          alpha: 0,
          duration: 400,
          onComplete: () => {
            if (element && element.destroy) {
              element.destroy();
            }
          }
        });
      }
    });
    this.fogBossElements = [];

    // 보스 다시 그리기 (인게임용)
    this.time.delayedCall(500, () => {
      this.drawFogBoss();

      // 페이즈 전환
      this.fogBossPhase = 'shadow';
      this.fogBossInputBlocked = false;

      // 게임 재개
      this.moveTimer.paused = false;

      // 조명탄 생성 시작
      this.startFlareSpawning();

      // Shadow Strike 시작
      this.startShadowStrikePhase();
    });
  }

  // 보스 그리기 (징그러운 디자인)
  drawFogBoss() {
    // 기존 보스 요소 정리
    if (this.fogBossElement) {
      this.fogBossElement.destroy();
    }

    const bossX = this.fogBossPosition.x * this.gridSize + this.gridSize / 2;
    const bossY = this.fogBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 보스 컨테이너
    this.fogBossElement = this.add.container(bossX, bossY).setDepth(150);

    // 촉수들 (8개) - 불규칙하게 움직임
    this.bossTentacles = [];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const tentacle = this.add.rectangle(
        Math.cos(angle) * 20,
        Math.sin(angle) * 20,
        6,
        25,
        0x1a0011,
        0.8
      ).setRotation(angle + Math.PI / 2);
      this.fogBossElement.add(tentacle);
      this.bossTentacles.push(tentacle);

      // 촉수 꿈틀거림
      this.tweens.add({
        targets: tentacle,
        scaleY: { from: 1, to: 1.4 },
        scaleX: { from: 1, to: 0.7 },
        duration: 400 + i * 100,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
        delay: i * 50
      });
    }

    // 어두운 아우라 (맥동)
    const darkAura = this.add.circle(0, 0, 35, 0x0a0005, 0.4);
    this.fogBossElement.add(darkAura);
    this.tweens.add({
      targets: darkAura,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      alpha: { from: 0.4, to: 0.1 },
      duration: 1000,
      yoyo: true,
      repeat: -1
    });

    // 몸통 - 불규칙한 형태 (여러 원으로 구성)
    const bodyParts = [];
    for (let i = 0; i < 5; i++) {
      const offsetX = Phaser.Math.Between(-5, 5);
      const offsetY = Phaser.Math.Between(-5, 5);
      const size = 12 + Phaser.Math.Between(0, 8);
      const body = this.add.circle(offsetX, offsetY, size, 0x0d0008, 0.9);
      this.fogBossElement.add(body);
      bodyParts.push(body);
    }

    // 중심 핵 (맥동하는 심장처럼)
    const core = this.add.circle(0, 0, 10, 0x220011, 1);
    this.fogBossElement.add(core);
    this.tweens.add({
      targets: core,
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 300,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 눈 3개 (비대칭, 크기 다름)
    const eyes = [
      { x: -10, y: -5, size: 6, pupilSize: 3 },
      { x: 8, y: -3, size: 5, pupilSize: 2.5 },
      { x: 0, y: 5, size: 4, pupilSize: 2 }  // 제3의 눈
    ];

    this.bossEyes = [];
    eyes.forEach((eyeData, idx) => {
      // 눈 글로우 (핏줄같은 느낌)
      const eyeGlow = this.add.circle(eyeData.x, eyeData.y, eyeData.size + 3, 0x660000, 0.4);
      this.fogBossElement.add(eyeGlow);

      // 눈알 (노란빛 + 핏줄)
      const eyeball = this.add.circle(eyeData.x, eyeData.y, eyeData.size, 0xaaaa00, 1);
      this.fogBossElement.add(eyeball);

      // 홍채
      const iris = this.add.circle(eyeData.x, eyeData.y, eyeData.size * 0.7, 0x990000, 1);
      this.fogBossElement.add(iris);

      // 동공 (세로로 긴 고양이 눈)
      const pupil = this.add.ellipse(eyeData.x, eyeData.y, eyeData.pupilSize * 0.5, eyeData.pupilSize * 1.5, 0x000000, 1);
      this.fogBossElement.add(pupil);

      this.bossEyes.push({ eyeball, iris, pupil, eyeGlow });

      // 눈 깜빡임 (불규칙)
      this.time.addEvent({
        delay: 2000 + idx * 1000,
        callback: () => {
          if (!this.fogBossElement || !this.fogBossElement.active) return;
          this.tweens.add({
            targets: [eyeball, iris, pupil, eyeGlow],
            scaleY: 0.1,
            duration: 80,
            yoyo: true,
            onComplete: () => {
              // 다음 깜빡임 예약
              if (this.fogBossMode) {
                this.time.delayedCall(3000 + Math.random() * 2000, () => {
                  if (this.fogBossElement && this.fogBossElement.active) {
                    this.tweens.add({
                      targets: [eyeball, iris, pupil, eyeGlow],
                      scaleY: 0.1,
                      duration: 80,
                      yoyo: true
                    });
                  }
                });
              }
            }
          });
        },
        loop: false
      });
    });

    // 입 (이빨이 보이는 찢어진 입)
    const mouthBg = this.add.ellipse(0, 12, 14, 6, 0x000000, 1);
    this.fogBossElement.add(mouthBg);

    // 이빨들
    for (let i = 0; i < 5; i++) {
      const toothX = -5 + i * 2.5;
      const toothHeight = 3 + Math.random() * 2;
      const tooth = this.add.triangle(
        toothX, 10,
        0, 0,
        1.5, toothHeight,
        -1.5, toothHeight,
        0xccccaa, 1
      );
      this.fogBossElement.add(tooth);
    }

    // 침 떨어지는 효과
    this.bossSlimeTimer = this.time.addEvent({
      delay: 800,
      callback: () => this.createBossSlime(),
      loop: true
    });

    // 전체 보스 불규칙한 떨림
    this.tweens.add({
      targets: this.fogBossElement,
      x: bossX + Phaser.Math.Between(-2, 2),
      y: bossY + Phaser.Math.Between(-2, 2),
      duration: 100,
      yoyo: true,
      repeat: -1
    });

    // 연기 파티클 (위로 올라감)
    this.createBossSmokeParticles();

    // 보스가 보이지 않는 상태면 숨기기
    if (!this.fogBossVisible) {
      this.fogBossElement.setAlpha(0);
    }
  }

  // 보스 연기 파티클
  createBossSmokeParticles() {
    if (!this.fogBossElement || !this.fogBossPosition) return;

    const bossX = this.fogBossPosition.x * this.gridSize + this.gridSize / 2;
    const bossY = this.fogBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 2개의 연기 파티클 생성
    for (let i = 0; i < 2; i++) {
      const offsetX = Phaser.Math.Between(-15, 15);
      const particle = this.add.circle(bossX + offsetX, bossY - 10, 4 + Math.random() * 3, 0x220022, 0.4)
        .setDepth(149);

      this.tweens.add({
        targets: particle,
        y: bossY - 60 - Math.random() * 30,
        x: bossX + offsetX + Phaser.Math.Between(-20, 20),
        alpha: 0,
        scale: 0.3,
        duration: 1500 + Math.random() * 500,
        onComplete: () => particle.destroy()
      });
    }

    // 보스가 활성화되어 있으면 계속 파티클 생성
    if (this.fogBossMode && this.fogBossPhase !== 'victory') {
      this.time.delayedCall(400, () => this.createBossSmokeParticles());
    }
  }

  // 보스 침 떨어지는 효과
  createBossSlime() {
    if (!this.fogBossElement || !this.fogBossElement.active || !this.fogBossPosition) return;

    const bossX = this.fogBossPosition.x * this.gridSize + this.gridSize / 2;
    const bossY = this.fogBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 침 물방울
    const slime = this.add.ellipse(
      bossX + Phaser.Math.Between(-5, 5),
      bossY + 15,
      3 + Math.random() * 2,
      5 + Math.random() * 3,
      0x00ff00,
      0.7
    ).setDepth(148);

    // 떨어지는 애니메이션
    this.tweens.add({
      targets: slime,
      y: bossY + 60 + Math.random() * 30,
      scaleX: 0.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 800 + Math.random() * 400,
      ease: 'Quad.easeIn',
      onComplete: () => slime.destroy()
    });

    // 침이 바닥에 닿으면 튀는 효과
    this.time.delayedCall(700, () => {
      if (!this.fogBossMode) return;

      const splash = this.add.circle(slime.x, bossY + 60, 4, 0x00ff00, 0.4).setDepth(147);
      this.tweens.add({
        targets: splash,
        scaleX: 2,
        scaleY: 0.5,
        alpha: 0,
        duration: 300,
        onComplete: () => splash.destroy()
      });
    });
  }

  // 조명탄 생성 시작
  startFlareSpawning() {
    // 첫 조명탄 즉시 생성
    this.spawnFlare();

    // 주기적으로 조명탄 생성
    this.flareSpawnTimer = this.time.addEvent({
      delay: this.flareSpawnInterval,
      callback: () => this.spawnFlare(),
      loop: true
    });
  }

  // 조명탄 생성
  spawnFlare() {
    if (!this.fogBossMode || this.fogBossPhase === 'victory') return;
    if (this.flares.length >= 2) return; // 최대 2개까지만

    // 안전한 위치 찾기
    let flarePos;
    let validPosition = false;
    let attempts = 0;

    while (!validPosition && attempts < 50) {
      flarePos = {
        x: Phaser.Math.Between(3, this.cols - 4),
        y: Phaser.Math.Between(3, this.rows - 4)
      };

      // 뱀, 보스, 기존 조명탄과 겹치지 않는지 확인
      validPosition = true;

      // 뱀과 거리 체크
      for (const segment of this.snake) {
        if (Math.abs(segment.x - flarePos.x) < 3 && Math.abs(segment.y - flarePos.y) < 3) {
          validPosition = false;
          break;
        }
      }

      // 보스와 거리 체크
      if (this.fogBossPosition) {
        if (Math.abs(this.fogBossPosition.x - flarePos.x) < 4 &&
            Math.abs(this.fogBossPosition.y - flarePos.y) < 4) {
          validPosition = false;
        }
      }

      // 기존 조명탄과 거리 체크
      for (const flare of this.flares) {
        if (Math.abs(flare.x - flarePos.x) < 5 && Math.abs(flare.y - flarePos.y) < 5) {
          validPosition = false;
          break;
        }
      }

      attempts++;
    }

    if (!validPosition) return;

    const pixelX = flarePos.x * this.gridSize + this.gridSize / 2;
    const pixelY = flarePos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 조명탄 컨테이너
    const container = this.add.container(pixelX, pixelY).setDepth(120);

    // 외곽 글로우
    const outerGlow = this.add.circle(0, 0, 15, 0xffff00, 0.2);
    // 중간 글로우
    const midGlow = this.add.circle(0, 0, 10, 0xffa500, 0.4);
    // 코어
    const core = this.add.circle(0, 0, 5, 0xffffff, 1);

    container.add([outerGlow, midGlow, core]);

    // 펄스 애니메이션
    this.tweens.add({
      targets: outerGlow,
      scaleX: { from: 1, to: 1.5 },
      scaleY: { from: 1, to: 1.5 },
      alpha: { from: 0.3, to: 0.1 },
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    this.tweens.add({
      targets: midGlow,
      scaleX: { from: 1, to: 1.2 },
      scaleY: { from: 1, to: 1.2 },
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    // 스파클 파티클
    this.createFlareSparkles(container, pixelX, pixelY);

    // 조명탄 등록
    const flare = {
      x: flarePos.x,
      y: flarePos.y,
      container: container,
      outerGlow: outerGlow,
      midGlow: midGlow,
      core: core
    };
    this.flares.push(flare);

    // 등장 애니메이션
    container.setScale(0);
    this.tweens.add({
      targets: container,
      scaleX: 1,
      scaleY: 1,
      duration: 400,
      ease: 'Back.easeOut'
    });
  }

  // 조명탄 스파클 효과
  createFlareSparkles(container, pixelX, pixelY) {
    const createSparkle = () => {
      if (!container || !container.active) return;

      const angle = Math.random() * Math.PI * 2;
      const dist = 8 + Math.random() * 10;
      const sparkle = this.add.circle(
        Math.cos(angle) * dist,
        Math.sin(angle) * dist,
        1 + Math.random(),
        0xffff00,
        0.8
      );
      container.add(sparkle);

      this.tweens.add({
        targets: sparkle,
        alpha: 0,
        scale: 0,
        x: Math.cos(angle) * (dist + 10),
        y: Math.sin(angle) * (dist + 10),
        duration: 400 + Math.random() * 200,
        onComplete: () => {
          sparkle.destroy();
          if (container && container.active) {
            createSparkle();
          }
        }
      });
    };

    // 3개의 스파클 시작
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(i * 200, createSparkle);
    }
  }

  // 조명탄 수집
  collectFlare(flare) {
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 조명탄이 뱀 머리로 날아감
    this.tweens.add({
      targets: flare.container,
      x: headX,
      y: headY,
      scaleX: 0.5,
      scaleY: 0.5,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        flare.container.destroy();
      }
    });

    // 배열에서 제거
    const index = this.flares.indexOf(flare);
    if (index > -1) {
      this.flares.splice(index, 1);
    }

    // 조명탄 카운트 증가
    this.flareCount++;

    // 🆕 회피 시도 카운트 리셋 (빛의 조각으로 회복!)
    if (this.dodgeAttemptCount > 0) {
      this.dodgeAttemptCount = 0;
      // 리셋 피드백
      const resetText = this.add.text(headX, headY - 40, 'DODGE RESET!', {
        fontSize: '14px',
        fill: '#00ffff',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5).setDepth(200);

      this.tweens.add({
        targets: resetText,
        alpha: 0,
        y: headY - 70,
        duration: 800,
        onComplete: () => resetText.destroy()
      });
    }

    // 수집 효과
    this.showFlareCollectEffect(headX, headY);

    // 조명탄 폭발 항상 트리거
    this.time.delayedCall(100, () => {
      this.triggerFlareExplosion();
    });
  }

  // 조명탄 수집 효과
  showFlareCollectEffect(x, y) {
    // "+1 FLARE" 텍스트
    const text = this.add.text(x, y - 20, '+1 FLARE', {
      fontSize: '16px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: text,
      y: y - 50,
      alpha: 0,
      duration: 800,
      onComplete: () => text.destroy()
    });

    // 플래시 효과
    const flash = this.add.circle(x, y, 20, 0xffff00, 0.6).setDepth(199);
    this.tweens.add({
      targets: flash,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 300,
      onComplete: () => flash.destroy()
    });
  }

  // 보스 근처인지 체크
  isNearFogBoss() {
    if (!this.fogBossPosition) return false;
    const head = this.snake[0];
    const dist = Math.abs(head.x - this.fogBossPosition.x) + Math.abs(head.y - this.fogBossPosition.y);
    return dist <= 8;
  }

  // 조명탄 폭발 (보스 노출)
  triggerFlareExplosion() {
    if (this.flareCount <= 0) return;
    if (this.flareActive) return;

    this.flareCount--;
    this.flareActive = true;

    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 화면 플래시
    const { width, height } = this.cameras.main;
    const flash = this.add.rectangle(0, 0, width, height, 0xffffaa, 0.7)
      .setOrigin(0, 0)
      .setDepth(4000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy()
    });

    // 빛 파동 효과
    this.createLightWave(headX, headY);

    // 시야 일시적 확대
    const originalVisibility = this.fogVisibleTiles;
    this.fogVisibleTiles = this.flareLightRadius;

    // 보스 노출
    this.fogBossVisible = true;
    if (this.fogBossElement) {
      this.tweens.add({
        targets: this.fogBossElement,
        alpha: 1,
        duration: 200
      });
    }

    // 보스가 공격 중이면 (점프 스케어 중, 경고 상태, 또는 보이는 상태) HIT!
    if (this.jumpScareActive || this.shadowStrikeWarningActive || this.fogBossVisible) {
      // 🆕 HIT 등록 대기 상태 (회피 실패보다 우선!)
      this.fogBossHitPending = true;

      // 🆕 QTE가 활성화 중이면 즉시 취소 (HIT 우선!)
      if (this.dodgeQTEActive) {
        this.dodgeQTEActive = false;
        this.cleanupQTEElements();
      }

      // 보스 공격 취소
      if (this.shadowStrikeTimer) {
        this.shadowStrikeTimer.destroy();
        this.shadowStrikeTimer = null;
      }
      this.shadowStrikeWarningActive = false;
      this.jumpScareActive = false;

      // 스토킹 시스템 정리
      this.cleanupStalkingSystem();

      // 보스 비명 + 고통 애니메이션
      this.showFogBossPain();

      // HIT 처리
      this.time.delayedCall(500, () => {
        this.fogBossHitPending = false;
        this.handleFogBossHit();
      });
    } else {
      // 보스 비명
      this.showFogBossScream('ARGH! THE LIGHT!');
    }

    // 2초 후 다시 숨기기
    this.time.delayedCall(2000, () => {
      this.flareActive = false;
      this.fogVisibleTiles = originalVisibility;

      // 아직 클리어 전이면 숨김
      if (this.fogBossPhase === 'shadow' && this.fogBossHitCount < 4) {
        this.fogBossVisible = false;
        if (this.fogBossElement) {
          this.tweens.add({
            targets: this.fogBossElement,
            alpha: 0,
            duration: 300
          });
        }

        // 다음 공격 예약
        const delay = Phaser.Math.Between(this.shadowStrikeInterval[0], this.shadowStrikeInterval[1]);
        this.shadowStrikeTimer = this.time.delayedCall(delay, () => {
          this.showShadowStrikeWarning();
        });
      }
    });
  }

  // 빛 파동 효과
  createLightWave(x, y) {
    // 여러 링 생성
    for (let i = 0; i < 4; i++) {
      const ring = this.add.circle(x, y, 20, 0xffff00, 0)
        .setDepth(3999)
        .setStrokeStyle(3, 0xffff00, 0.8);

      this.tweens.add({
        targets: ring,
        scaleX: 10 + i * 2,
        scaleY: 10 + i * 2,
        alpha: 0,
        duration: 600,
        delay: i * 100,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }

    // 방사형 빛줄기
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const beam = this.add.rectangle(x, y, 200, 4, 0xffffaa, 0.6)
        .setOrigin(0, 0.5)
        .setRotation(angle)
        .setDepth(3998);

      this.tweens.add({
        targets: beam,
        scaleX: 2,
        alpha: 0,
        duration: 500,
        delay: 100,
        onComplete: () => beam.destroy()
      });
    }
  }

  // 보스 비명
  showFogBossScream(text) {
    if (!this.fogBossPosition) return;

    const bossX = this.fogBossPosition.x * this.gridSize + this.gridSize / 2;
    const bossY = this.fogBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    const screamText = this.add.text(bossX, bossY - 40, text, {
      fontSize: '18px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: screamText,
      y: bossY - 70,
      alpha: 0,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 1000,
      onComplete: () => screamText.destroy()
    });

    // 카메라 흔들기
    this.cameras.main.shake(200, 0.01);
  }

  // 보스 고통 애니메이션
  showFogBossPain() {
    if (!this.fogBossElement || !this.fogBossPosition) return;

    const bossX = this.fogBossPosition.x * this.gridSize + this.gridSize / 2;
    const bossY = this.fogBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 비명 텍스트
    const screamText = this.add.text(bossX, bossY - 50, 'AAAARGH!!!', {
      fontSize: '24px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: screamText,
      y: bossY - 100,
      alpha: 0,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 1200,
      onComplete: () => screamText.destroy()
    });

    // 보스 몸체 빨간색으로 깜빡임
    const originalTint = 0xffffff;
    let flashCount = 0;
    const flashTimer = this.time.addEvent({
      delay: 80,
      callback: () => {
        if (this.fogBossElement && this.fogBossElement.active) {
          // 빨간색/원래색 번갈아가며 플래시
          const tint = flashCount % 2 === 0 ? 0xff0000 : 0xffffff;
          this.fogBossElement.list.forEach(child => {
            if (child.setTint) child.setTint(tint);
          });
        }
        flashCount++;
        if (flashCount >= 8) {
          flashTimer.destroy();
          // 원래 색으로 복원
          if (this.fogBossElement && this.fogBossElement.active) {
            this.fogBossElement.list.forEach(child => {
              if (child.clearTint) child.clearTint();
            });
          }
        }
      },
      loop: true
    });

    // 보스 몸체 흔들림
    this.tweens.add({
      targets: this.fogBossElement,
      x: bossX + 5,
      duration: 50,
      yoyo: true,
      repeat: 6
    });

    // 고통 파티클 (보스에서 뿜어져 나옴)
    for (let i = 0; i < 12; i++) {
      const angle = (i / 12) * Math.PI * 2;
      const particle = this.add.circle(
        bossX,
        bossY,
        4 + Math.random() * 4,
        0xff0000,
        0.8
      ).setDepth(155);

      this.tweens.add({
        targets: particle,
        x: bossX + Math.cos(angle) * (60 + Math.random() * 40),
        y: bossY + Math.sin(angle) * (60 + Math.random() * 40),
        alpha: 0,
        scale: 0.3,
        duration: 600 + Math.random() * 300,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 강한 카메라 흔들기
    this.cameras.main.shake(400, 0.03);

    // 화면 빨간 플래시
    const { width, height } = this.cameras.main;
    const flash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.3)
      .setOrigin(0, 0)
      .setDepth(3500);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy()
    });
  }

  // Shadow Strike 페이즈 시작 → 새로운 "The Presence" 시스템
  startShadowStrikePhase() {
    this.fogBossPhase = 'shadow';

    // 보스 숨기기
    this.fogBossVisible = false;
    if (this.fogBossElement) {
      this.fogBossElement.setAlpha(0);
    }

    // 🆕 The Presence 시스템 시작
    this.startPresenceSystem();
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🆕 THE PRESENCE SYSTEM - 극한의 공포 (브라우저 전체 어둠)
  // ═══════════════════════════════════════════════════════════════════

  // The Presence 시스템 시작
  startPresenceSystem() {
    this.presenceActive = true;
    this.presenceLevel = 0;
    this.stalkingActive = true;
    const hitCount = this.fogBossHitCount;

    // 1. 브라우저 배경 어둠 오버레이 생성 (DOM)
    this.createBrowserDarkness();

    // 2. 인게임 비네트 생성
    this.createVignetteOverlay();

    // 3. HIT 수에 따른 인트로 연출 (대사 끝나면 공격 시작)
    // 🆕 대사 중에는 공격 차단
    this.presenceDialogueActive = true;
    this.showPresenceIntro();

    // 4. 존재감 점진적 증가 타이머
    const presenceSpeed = Math.max(800 - hitCount * 100, 400);
    this.presenceTimer = this.time.addEvent({
      delay: presenceSpeed,
      callback: () => this.updatePresenceLevel(),
      loop: true
    });

    // 🆕 공격/스폰은 대사 끝난 후 showPresenceIntro에서 호출됨
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🆕 무서운 생물 시스템 - 횃불 영역에 흠칫 놀라게 하는 존재들
  // ═══════════════════════════════════════════════════════════════════

  // 무서운 생물 스폰 시작
  startCreatureSpawning() {
    // 3~6초마다 생물 스폰
    this.creatureSpawnTimer = this.time.addEvent({
      delay: Phaser.Math.Between(3000, 6000),
      callback: () => {
        if (!this.presenceActive || this.gameOver) return;
        this.spawnCreepyCreature();
        // 다음 스폰 간격 랜덤화
        if (this.creatureSpawnTimer) {
          this.creatureSpawnTimer.delay = Phaser.Math.Between(4000, 8000);
        }
      },
      loop: true
    });
  }

  // 무서운 생물 스폰
  spawnCreepyCreature() {
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 생물 종류 (다양한 디자인)
    const creatureTypes = [
      'ghost',      // 유령 - 하얀 반투명
      'crawler',    // 기어다니는 것 - 여러 다리
      'eyeball',    // 눈알 - 큰 눈
      'shadow',     // 그림자 인간 - 길쭉한 형태
      'hands',      // 손 - 바닥에서 나오는 손들
      'face'        // 일그러진 얼굴
    ];
    const type = Phaser.Math.RND.pick(creatureTypes);

    // 시야 가장자리에서 스폰 (횃불 빛 영역 끝)
    const spawnAngle = Math.random() * Math.PI * 2;
    const spawnDistance = this.fogVisibleTiles * this.gridSize * 0.8;
    const spawnX = headX + Math.cos(spawnAngle) * spawnDistance;
    const spawnY = headY + Math.sin(spawnAngle) * spawnDistance;

    // 반대쪽으로 이동할 목표
    const targetAngle = spawnAngle + Math.PI + Phaser.Math.FloatBetween(-0.5, 0.5);
    const targetDistance = spawnDistance * 2;
    const targetX = headX + Math.cos(targetAngle) * targetDistance;
    const targetY = headY + Math.sin(targetAngle) * targetDistance;

    // 생물 생성
    const creature = this.createCreature(type, spawnX, spawnY);
    this.creepyCreatures.push(creature);

    // 이동 애니메이션 (천천히 스쳐지나감)
    const moveDuration = Phaser.Math.Between(1500, 3000);

    this.tweens.add({
      targets: creature,
      x: targetX,
      y: targetY,
      duration: moveDuration,
      ease: 'Linear',
      onComplete: () => {
        this.destroyCreature(creature);
      }
    });

    // 50% 확률로 깜짝 효과
    if (Math.random() < 0.5) {
      this.time.delayedCall(moveDuration * 0.3, () => {
        this.creatureJumpScare(creature);
      });
    }
  }

  // 생물 생성 (타입별 디자인)
  createCreature(type, x, y) {
    const container = this.add.container(x, y).setDepth(155).setAlpha(0);

    switch (type) {
      case 'ghost':
        // 유령 - 흰색 반투명 형태
        const ghostBody = this.add.ellipse(0, 0, 25, 35, 0xffffff, 0.3);
        const ghostEye1 = this.add.circle(-5, -5, 4, 0x000000, 0.8);
        const ghostEye2 = this.add.circle(5, -5, 4, 0x000000, 0.8);
        const ghostMouth = this.add.ellipse(0, 8, 8, 12, 0x000000, 0.6);
        container.add([ghostBody, ghostEye1, ghostEye2, ghostMouth]);
        // 흔들림
        this.tweens.add({
          targets: container,
          y: container.y + 5,
          duration: 500,
          yoyo: true,
          repeat: -1
        });
        break;

      case 'crawler':
        // 기어다니는 것 - 여러 다리
        const crawlerBody = this.add.ellipse(0, 0, 30, 15, 0x1a0a0a, 0.6);
        for (let i = 0; i < 6; i++) {
          const legX = -12 + i * 5;
          const leg = this.add.rectangle(legX, 10, 2, 12, 0x1a0a0a, 0.5)
            .setAngle(Phaser.Math.Between(-20, 20));
          container.add(leg);
        }
        container.add(crawlerBody);
        // 다리 움직임
        container.list.forEach((child, i) => {
          if (i > 0) {
            this.tweens.add({
              targets: child,
              angle: child.angle + Phaser.Math.Between(-10, 10),
              duration: 100,
              yoyo: true,
              repeat: -1,
              delay: i * 30
            });
          }
        });
        break;

      case 'eyeball':
        // 큰 눈알
        const eyeWhite = this.add.circle(0, 0, 20, 0xffffee, 0.5);
        const eyeIris = this.add.circle(0, 0, 12, 0x880000, 0.7);
        const eyePupil = this.add.circle(0, 0, 6, 0x000000, 0.9);
        const veins = [];
        for (let i = 0; i < 5; i++) {
          const angle = (i / 5) * Math.PI * 2;
          const vein = this.add.line(0, 0,
            Math.cos(angle) * 10, Math.sin(angle) * 10,
            Math.cos(angle) * 18, Math.sin(angle) * 18,
            0xff0000, 0.3
          ).setLineWidth(1);
          veins.push(vein);
        }
        container.add([eyeWhite, ...veins, eyeIris, eyePupil]);
        // 눈알 굴러감
        this.tweens.add({
          targets: container,
          angle: 360,
          duration: 2000,
          repeat: -1
        });
        break;

      case 'shadow':
        // 그림자 인간 - 길쭉한 검은 형태
        const shadowBody = this.add.ellipse(0, 0, 15, 50, 0x0a0005, 0.4);
        const shadowHead = this.add.circle(0, -30, 10, 0x0a0005, 0.5);
        const shadowEye1 = this.add.circle(-3, -32, 2, 0xff0000, 0.8);
        const shadowEye2 = this.add.circle(3, -32, 2, 0xff0000, 0.8);
        container.add([shadowBody, shadowHead, shadowEye1, shadowEye2]);
        // 흔들림
        this.tweens.add({
          targets: container,
          scaleX: { from: 0.8, to: 1.2 },
          duration: 300,
          yoyo: true,
          repeat: -1
        });
        break;

      case 'hands':
        // 바닥에서 나오는 손들
        for (let i = 0; i < 3; i++) {
          const handX = -15 + i * 15;
          const hand = this.add.container(handX, 0);
          const palm = this.add.ellipse(0, 0, 10, 15, 0x2a1a1a, 0.5);
          for (let f = 0; f < 5; f++) {
            const finger = this.add.rectangle(-6 + f * 3, -12, 3, 10, 0x2a1a1a, 0.5);
            hand.add(finger);
          }
          hand.add(palm);
          container.add(hand);
          // 손가락 움직임
          this.tweens.add({
            targets: hand,
            y: hand.y - 5,
            angle: Phaser.Math.Between(-10, 10),
            duration: 200 + i * 100,
            yoyo: true,
            repeat: -1
          });
        }
        break;

      case 'face':
        // 일그러진 얼굴
        const faceBase = this.add.circle(0, 0, 25, 0x1a0a0a, 0.4);
        const faceEye1 = this.add.circle(-8, -5, 6, 0xffffaa, 0.6);
        const faceEye2 = this.add.circle(10, -8, 4, 0xffffaa, 0.6);
        const facePupil1 = this.add.circle(-8, -5, 3, 0x000000, 0.8);
        const facePupil2 = this.add.circle(10, -8, 2, 0x000000, 0.8);
        const faceMouth = this.add.ellipse(2, 12, 20, 10, 0x000000, 0.7);
        container.add([faceBase, faceEye1, faceEye2, facePupil1, facePupil2, faceMouth]);
        // 입 벌림
        this.tweens.add({
          targets: faceMouth,
          scaleY: { from: 1, to: 2 },
          duration: 500,
          yoyo: true,
          repeat: -1
        });
        break;
    }

    // 페이드인
    this.tweens.add({
      targets: container,
      alpha: 0.6,
      duration: 300
    });

    return container;
  }

  // 생물 깜짝 효과
  creatureJumpScare(creature) {
    if (!creature || !creature.active) return;

    // 갑자기 선명해졌다 사라짐
    this.tweens.add({
      targets: creature,
      alpha: 1,
      scaleX: 1.5,
      scaleY: 1.5,
      duration: 100,
      yoyo: true,
      onComplete: () => {
        if (creature && creature.active) {
          creature.setAlpha(0.4);
        }
      }
    });

    // 카메라 미세 흔들림
    this.cameras.main.shake(100, 0.01);

    // 브라우저 미세 플래시
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(50, 0, 0, 0.2);
      pointer-events: none;
      z-index: 9997;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 100);
  }

  // 생물 제거
  destroyCreature(creature) {
    const index = this.creepyCreatures.indexOf(creature);
    if (index > -1) {
      this.creepyCreatures.splice(index, 1);
    }

    if (creature && creature.active) {
      this.tweens.add({
        targets: creature,
        alpha: 0,
        duration: 200,
        onComplete: () => {
          creature.destroy();
        }
      });
    }
  }

  // 모든 생물 정리
  cleanupCreatures() {
    if (this.creatureSpawnTimer) {
      this.creatureSpawnTimer.destroy();
      this.creatureSpawnTimer = null;
    }

    this.creepyCreatures.forEach(creature => {
      if (creature && creature.destroy) creature.destroy();
    });
    this.creepyCreatures = [];
  }

  // 브라우저 배경 어둠 오버레이 생성 (DOM 조작)
  createBrowserDarkness() {
    // 기존 오버레이 제거
    this.removeBrowserDarkness();

    // 브라우저 전체를 덮는 어둠 오버레이 생성
    const overlay = document.createElement('div');
    overlay.id = 'presence-darkness';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(ellipse at center, transparent 30%, rgba(10, 0, 5, 0) 100%);
      pointer-events: none;
      z-index: 9999;
      transition: background 0.5s ease;
      opacity: 0;
    `;
    document.body.appendChild(overlay);
    this.browserDarkOverlay = overlay;

    // 서서히 어둠 등장
    setTimeout(() => {
      if (this.browserDarkOverlay) {
        this.browserDarkOverlay.style.opacity = '1';
      }
    }, 100);

    // 브라우저 배경색도 변경
    document.body.style.transition = 'background 2s ease';
    document.body.style.background = 'linear-gradient(135deg, #0a0005 0%, #1a0510 100%)';
  }

  // 브라우저 어둠 강도 업데이트
  updateBrowserDarkness(level) {
    if (!this.browserDarkOverlay) return;

    // level: 0-100
    const darkness = Math.min(level / 100, 1);
    const innerRadius = Math.max(30 - darkness * 25, 5); // 30% → 5%
    const outerAlpha = Math.min(darkness * 0.9, 0.85);

    this.browserDarkOverlay.style.background = `
      radial-gradient(ellipse at center,
        transparent ${innerRadius}%,
        rgba(10, 0, 5, ${outerAlpha * 0.3}) ${innerRadius + 20}%,
        rgba(10, 0, 5, ${outerAlpha * 0.6}) ${innerRadius + 40}%,
        rgba(10, 0, 5, ${outerAlpha}) 100%)
    `;
  }

  // 브라우저 펄스 효과 (심장박동)
  browserPulse() {
    if (!this.browserDarkOverlay || !this.presenceActive) return;

    // 빨간 플래시
    const pulse = document.createElement('div');
    pulse.id = 'presence-pulse';
    pulse.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: radial-gradient(ellipse at center, transparent 20%, rgba(80, 0, 0, 0.3) 100%);
      pointer-events: none;
      z-index: 9998;
      animation: presencePulse 0.3s ease-out;
    `;
    document.body.appendChild(pulse);

    // CSS 애니메이션 추가
    if (!document.getElementById('presence-pulse-style')) {
      const style = document.createElement('style');
      style.id = 'presence-pulse-style';
      style.textContent = `
        @keyframes presencePulse {
          0% { opacity: 0; }
          30% { opacity: 1; }
          100% { opacity: 0; }
        }
        @keyframes browserShake {
          0%, 100% { transform: translate(0, 0); }
          10% { transform: translate(-5px, -3px); }
          20% { transform: translate(5px, 3px); }
          30% { transform: translate(-3px, 5px); }
          40% { transform: translate(3px, -5px); }
          50% { transform: translate(-5px, 3px); }
          60% { transform: translate(5px, -3px); }
          70% { transform: translate(-3px, -5px); }
          80% { transform: translate(3px, 5px); }
          90% { transform: translate(-5px, -3px); }
        }
        @keyframes attackFlash {
          0% { opacity: 0; background: rgba(255, 0, 0, 0.8); }
          20% { opacity: 1; }
          100% { opacity: 0; background: rgba(0, 0, 0, 0); }
        }
      `;
      document.head.appendChild(style);
    }

    // 펄스 제거
    setTimeout(() => pulse.remove(), 300);
  }

  // 브라우저 흔들림 효과
  browserShake(duration = 500, intensity = 'medium') {
    const gameContainer = document.getElementById('game-container');
    if (!gameContainer) return;

    const intensityMap = {
      light: '3px',
      medium: '8px',
      heavy: '15px',
      extreme: '25px'
    };

    gameContainer.style.animation = `browserShake ${duration}ms ease-in-out`;
    gameContainer.style.setProperty('--shake-amount', intensityMap[intensity] || '8px');

    setTimeout(() => {
      gameContainer.style.animation = '';
    }, duration);
  }

  // 브라우저 플래시 효과
  browserFlash(color = 'red', duration = 200) {
    const flash = document.createElement('div');
    flash.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: ${color === 'red' ? 'rgba(255, 0, 0, 0.6)' : 'rgba(255, 255, 255, 0.8)'};
      pointer-events: none;
      z-index: 10000;
      animation: attackFlash ${duration}ms ease-out;
    `;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), duration);
  }

  // 🆕 인트로용 극적인 빨간 플래시 (빨간 눈 등장 시)
  flashBrowserRed() {
    // 첫 번째 플래시 - 강렬하게
    this.browserFlash('red', 150);
    this.browserShake(300, 'medium');

    // 두 번째 플래시 - 여운
    setTimeout(() => {
      const afterFlash = document.createElement('div');
      afterFlash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: radial-gradient(ellipse at center, rgba(100, 0, 0, 0.3) 0%, transparent 70%);
        pointer-events: none;
        z-index: 10000;
        animation: introFlashFade 1s ease-out forwards;
      `;
      document.body.appendChild(afterFlash);

      // CSS 애니메이션 추가
      if (!document.getElementById('intro-flash-style')) {
        const style = document.createElement('style');
        style.id = 'intro-flash-style';
        style.textContent = `
          @keyframes introFlashFade {
            0% { opacity: 1; }
            100% { opacity: 0; }
          }
        `;
        document.head.appendChild(style);
      }

      setTimeout(() => afterFlash.remove(), 1000);
    }, 100);

    // 브라우저 배경 즉시 어둡게 전환
    document.body.style.transition = 'background 0.5s ease';
    document.body.style.background = 'linear-gradient(135deg, #0a0005 0%, #150010 100%)';
  }

  // 브라우저 어둠 제거
  removeBrowserDarkness() {
    // 오버레이 제거
    const existing = document.getElementById('presence-darkness');
    if (existing) existing.remove();

    // 펄스 제거
    const pulse = document.getElementById('presence-pulse');
    if (pulse) pulse.remove();

    // 배경색 복원
    document.body.style.transition = 'background 1s ease';
    document.body.style.background = 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)';

    this.browserDarkOverlay = null;
  }

  // The Presence 인트로 연출
  showPresenceIntro() {
    const { width, height } = this.cameras.main;
    const hitCount = this.fogBossHitCount;

    // HIT 수에 따른 대사
    const dialogues = [
      { text: "I am everywhere...", subtext: "You cannot hide." },
      { text: "Did you think you escaped?", subtext: "I am always watching." },
      { text: "Your fear feeds me...", subtext: "RUN." },
      { text: "THIS ENDS NOW.", subtext: "" }
    ];
    const dialogue = dialogues[Math.min(hitCount, 3)];

    // 메인 텍스트
    const mainText = this.add.text(width / 2, height / 2 - 20, '', {
      fontSize: `${28 + hitCount * 4}px`,
      fill: '#880000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000);

    // 타이핑 효과
    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 60,
      callback: () => {
        if (charIndex < dialogue.text.length) {
          mainText.setText(dialogue.text.substring(0, charIndex + 1));
          charIndex++;
          // 브라우저 미세 흔들림
          if (hitCount >= 2) this.browserShake(50, 'light');
        }
      },
      repeat: dialogue.text.length - 1
    });

    // 서브 텍스트
    if (dialogue.subtext) {
      this.time.delayedCall(dialogue.text.length * 60 + 500, () => {
        const subText = this.add.text(width / 2, height / 2 + 30, dialogue.subtext, {
          fontSize: '20px',
          fill: '#ff0000',
          fontStyle: 'italic'
        }).setOrigin(0.5).setDepth(5000).setAlpha(0);

        this.tweens.add({
          targets: subText,
          alpha: 1,
          duration: 300,
          onComplete: () => {
            this.time.delayedCall(1500, () => {
              this.tweens.add({
                targets: [mainText, subText],
                alpha: 0,
                duration: 500,
                onComplete: () => {
                  mainText.destroy();
                  subText.destroy();
                  // 🆕 대사 끝 → 공격 시작!
                  this.onPresenceDialogueEnd();
                }
              });
            });
          }
        });
      });
    } else {
      // HIT 3: 바로 사라지고 공격 시작
      this.time.delayedCall(1500, () => {
        this.tweens.add({
          targets: mainText,
          alpha: 0,
          duration: 300,
          onComplete: () => {
            mainText.destroy();
            // 🆕 대사 끝 → 공격 시작!
            this.onPresenceDialogueEnd();
          }
        });
      });
    }

    // 브라우저 펄스 시작
    this.browserPulse();
  }

  // 🆕 대사 종료 후 호출 - 공격 시작 + 빛의 조각 스폰
  onPresenceDialogueEnd() {
    this.presenceDialogueActive = false;

    // 빛의 조각 스폰! (대사 후 첫 스폰)
    this.spawnFlare();

    // 공격 스케줄링 시작
    this.schedulePresenceAttack();

    // 스토킹 눈 시작
    this.scheduleStalkingEyes();

    // 무서운 생물들 스폰 시작
    this.startCreatureSpawning();
  }

  // 존재감 레벨 업데이트
  updatePresenceLevel() {
    if (!this.fogBossMode || !this.presenceActive || this.gameOver) return;

    const hitCount = this.fogBossHitCount;

    // 존재감 점진적 증가
    const increaseRate = 3 + hitCount * 2;
    this.presenceLevel = Math.min(this.presenceLevel + increaseRate, 100);

    // 브라우저 어둠 업데이트
    this.updateBrowserDarkness(this.presenceLevel);

    // 인게임 비네트 업데이트
    this.updateVignetteIntensity(this.presenceLevel);

    // 존재감 50 이상: 심장박동 효과
    if (this.presenceLevel >= 50 && !this.presencePulseTimer) {
      this.startPresenceHeartbeat();
    }

    // 존재감 70 이상: 안개 짙어짐
    if (this.presenceLevel >= 70) {
      this.fogVisibleTiles = Math.max(2.5, this.originalFogVisibleTiles - this.presenceLevel * 0.02);
    }
  }

  // 심장박동 효과 (브라우저 포함)
  startPresenceHeartbeat() {
    if (this.presencePulseTimer) return;

    this.presencePulseTimer = this.time.addEvent({
      delay: 1000 - this.presenceLevel * 3,
      callback: () => {
        // 🆕 보스 모드 종료 시에도 정지
        if (!this.fogBossMode || !this.presenceActive || this.gameOver) {
          if (this.presencePulseTimer) {
            this.presencePulseTimer.destroy();
            this.presencePulseTimer = null;
          }
          return;
        }

        // 브라우저 펄스
        this.browserPulse();

        // 카메라 줌 펄스
        this.tweens.add({
          targets: this.cameras.main,
          zoom: 1.02,
          duration: 100,
          yoyo: true
        });

        // 딜레이 업데이트
        if (this.presencePulseTimer) {
          this.presencePulseTimer.delay = Math.max(600, 1000 - this.presenceLevel * 4);
        }
      },
      loop: true
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // 🆕 공격 시스템 - 명확한 방향 경고 + 회피
  // ═══════════════════════════════════════════════════════════════════

  // 공격 스케줄링
  schedulePresenceAttack() {
    if (!this.fogBossMode || !this.presenceActive || this.gameOver) return;

    const hitCount = this.fogBossHitCount;
    // HIT 많을수록 공격 간격 짧아짐
    const cooldown = Math.max(5000, this.attackCooldown - hitCount * 1000);

    this.time.delayedCall(cooldown, () => {
      if (this.fogBossMode && this.presenceActive && !this.gameOver) {
        this.initiatePresenceAttack();
      }
    });
  }

  // 공격 시작 - 명확한 방향 경고
  initiatePresenceAttack() {
    if (!this.fogBossMode || !this.presenceActive || this.gameOver) return;

    const { width, height } = this.cameras.main;
    const hitCount = this.fogBossHitCount;

    // 1. 공격 방향 결정 (뱀의 앞, 옆, 뒤 중 하나)
    const directions = ['front', 'left', 'right', 'behind'];
    // HIT 높을수록 뒤에서 공격 확률 증가
    const weights = hitCount >= 2 ? [30, 25, 25, 20] : [50, 25, 25, 0];
    this.attackDirection = this.weightedRandom(directions, weights);

    // 실제 방향 계산 (뱀의 현재 방향 기준)
    const actualDirection = this.getActualAttackDirection(this.attackDirection);

    // 회피해야 할 방향 (공격 반대 방향)
    this.correctDodgeDirection = this.getOppositDirection(actualDirection);

    // 2. 경고 단계 시작
    this.showAttackWarning(actualDirection);
  }

  // 가중치 랜덤 선택
  weightedRandom(items, weights) {
    const total = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * total;
    for (let i = 0; i < items.length; i++) {
      random -= weights[i];
      if (random <= 0) return items[i];
    }
    return items[0];
  }

  // 뱀 방향 기준으로 실제 공격 방향 계산
  getActualAttackDirection(relativeDir) {
    const snakeDir = this.direction;
    const dirMap = {
      'RIGHT': { front: 'left', behind: 'right', left: 'up', right: 'down' },
      'LEFT': { front: 'right', behind: 'left', left: 'down', right: 'up' },
      'UP': { front: 'down', behind: 'up', left: 'left', right: 'right' },
      'DOWN': { front: 'up', behind: 'down', left: 'right', right: 'left' }
    };
    return dirMap[snakeDir][relativeDir];
  }

  // 반대 방향 구하기
  getOppositDirection(dir) {
    const opposite = { 'up': 'down', 'down': 'up', 'left': 'right', 'right': 'left' };
    return opposite[dir];
  }

  // 공격 경고 표시 (명확한 방향 화살표)
  showAttackWarning(attackFrom) {
    const { width, height } = this.cameras.main;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 1. 브라우저 전체 빨간 테두리 깜빡임
    this.showBrowserWarningBorder(attackFrom);

    // 2. 방향 화살표 경고 (어디서 공격이 오는지)
    const arrowConfig = {
      'up': { x: headX, y: 60, rotation: Math.PI / 2, text: '↓ FROM ABOVE!' },
      'down': { x: headX, y: height - 30, rotation: -Math.PI / 2, text: '↑ FROM BELOW!' },
      'left': { x: 30, y: headY, rotation: 0, text: '→ FROM LEFT!' },
      'right': { x: width - 30, y: headY, rotation: Math.PI, text: '← FROM RIGHT!' }
    };
    const config = arrowConfig[attackFrom];

    // 경고 화살표
    const warningArrow = this.add.text(config.x, config.y, '⚠️', {
      fontSize: '40px'
    }).setOrigin(0.5).setDepth(6000);

    // 방향 텍스트
    const dirText = this.add.text(width / 2, height / 2 - 80, config.text, {
      fontSize: '32px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
      backgroundColor: '#000000aa',
      padding: { x: 15, y: 8 }
    }).setOrigin(0.5).setDepth(6000);

    // 회피 안내
    const dodgeHint = this.add.text(width / 2, height / 2 + 50, `DODGE ${this.correctDodgeDirection.toUpperCase()}! [SPACE]`, {
      fontSize: '28px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(6000);

    // 깜빡임 애니메이션
    this.tweens.add({
      targets: [warningArrow, dirText, dodgeHint],
      alpha: { from: 1, to: 0.3 },
      duration: 150,
      yoyo: true,
      repeat: 5
    });

    // 브라우저 흔들림
    this.browserShake(1500, 'medium');

    // 카메라 흔들림
    this.cameras.main.shake(1500, 0.03);

    // 경고 시간 후 공격 실행 (2초 - 회피 준비 시간)
    const warningTime = Math.max(1500, 2000 - this.fogBossHitCount * 200);

    this.time.delayedCall(warningTime, () => {
      warningArrow.destroy();
      dirText.destroy();
      dodgeHint.destroy();
      this.executePresenceAttack(attackFrom);
    });

    // 회피 창 활성화
    this.dodgeWindowActive = true;
    this.dodgeWindowTimer = this.time.delayedCall(warningTime + 500, () => {
      this.dodgeWindowActive = false;
    });
  }

  // 브라우저 경고 테두리
  showBrowserWarningBorder(direction) {
    const border = document.createElement('div');
    border.id = 'presence-warning-border';

    // 방향에 따른 테두리
    const borderStyles = {
      'up': 'border-top: 8px solid #ff0000;',
      'down': 'border-bottom: 8px solid #ff0000;',
      'left': 'border-left: 8px solid #ff0000;',
      'right': 'border-right: 8px solid #ff0000;'
    };

    border.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      ${borderStyles[direction]}
      pointer-events: none;
      z-index: 10001;
      box-sizing: border-box;
      animation: presencePulse 0.3s ease-in-out infinite;
    `;
    document.body.appendChild(border);

    // 2초 후 제거
    setTimeout(() => border.remove(), 2000);
  }

  // 공격 실행
  executePresenceAttack(attackFrom) {
    if (!this.fogBossMode || !this.presenceActive || this.gameOver) return;
    if (!this.snake || this.snake.length === 0) return;

    const { width, height } = this.cameras.main;
    const head = this.snake[0];

    // 1. 브라우저 강력한 플래시 + 흔들림
    this.browserFlash('white', 150);
    this.browserShake(500, 'heavy');

    // 2. 보스 등장 위치 계산
    const offsetTiles = 3;
    let bossX = head.x;
    let bossY = head.y;

    switch (attackFrom) {
      case 'up': bossY = head.y - offsetTiles; break;
      case 'down': bossY = head.y + offsetTiles; break;
      case 'left': bossX = head.x - offsetTiles; break;
      case 'right': bossX = head.x + offsetTiles; break;
    }

    // 보스 위치 설정
    this.fogBossPosition = { x: bossX, y: bossY };
    const bossPixelX = bossX * this.gridSize + this.gridSize / 2;
    const bossPixelY = bossY * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 3. 보스 등장
    this.fogBossVisible = true;
    if (this.fogBossElement) {
      this.fogBossElement.setPosition(bossPixelX, bossPixelY);
      this.fogBossElement.setAlpha(1);
      this.fogBossElement.setScale(2);

      // 확대 후 돌진
      this.tweens.add({
        targets: this.fogBossElement,
        scaleX: 1,
        scaleY: 1,
        duration: 100
      });
    }

    // 4. "RAAAGH!" 비명
    const scream = this.add.text(width / 2, height / 2, 'RAAAGH!!!', {
      fontSize: '72px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(6000).setAlpha(0);

    this.tweens.add({
      targets: scream,
      alpha: 1,
      scaleX: { from: 0.5, to: 1.3 },
      scaleY: { from: 0.5, to: 1.3 },
      duration: 150,
      onComplete: () => {
        this.time.delayedCall(200, () => {
          scream.destroy();
        });
      }
    });

    // 5. 돌진 실행
    this.time.delayedCall(200, () => {
      this.executePresenceDash(attackFrom);
    });
  }

  // 돌진 실행 - QTE 스타일 (SPACE 눌러야 회피)
  executePresenceDash(attackFrom) {
    // 🆕 이미 QTE 진행 중이면 중복 공격 방지
    if (this.dodgeQTEActive) {
      return;
    }

    // 🆕 보스 모드 종료, 게임오버 상태, snake가 없으면 실행 안함
    if (!this.fogBossMode || !this.presenceActive || this.gameOver) {
      return;
    }
    if (!this.snake || this.snake.length === 0) {
      return;
    }

    const head = this.snake[0];
    const targetX = head.x * this.gridSize + this.gridSize / 2;
    const targetY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // QTE 상태 초기화
    this.playerDodged = false;
    this.dodgeQTEActive = true;

    // 🆕 회피 시도 카운트 증가
    this.dodgeAttemptCount = (this.dodgeAttemptCount || 0) + 1;

    // 돌진 속도 (HIT 많을수록 + 시도 횟수 많을수록 빨라짐!)
    // 초반: 700ms (여유) → 후반: 250ms (극한)
    const baseTime = 700;
    const hitPenalty = this.fogBossHitCount * 80;  // HIT당 80ms 감소
    const attemptPenalty = this.dodgeAttemptCount * 15;  // 시도당 15ms 감소
    const dashDuration = Math.max(250, baseTime - hitPenalty - attemptPenalty);

    // QTE 프롬프트 표시 (남은 시간도 전달)
    this.showDodgeQTE(dashDuration);

    // QTE 시간 (돌진 중에 눌러야 함)
    const qteWindow = dashDuration + 100;

    this.tweens.add({
      targets: this.fogBossElement,
      x: targetX,
      y: targetY,
      duration: dashDuration,
      ease: 'Power2.easeIn',
      onUpdate: () => {
        // 돌진 중 잔상 효과
        if (Math.random() < 0.3 && this.fogBossElement) {
          const trail = this.add.circle(
            this.fogBossElement.x + Phaser.Math.Between(-10, 10),
            this.fogBossElement.y + Phaser.Math.Between(-10, 10),
            8, 0x660033, 0.5
          ).setDepth(140);
          this.tweens.add({
            targets: trail,
            alpha: 0,
            scale: 0.3,
            duration: 200,
            onComplete: () => trail.destroy()
          });
        }
      },
      onComplete: () => {
        // QTE 창 종료
        this.dodgeQTEActive = false;

        // 플레이어가 SPACE를 눌렀는지 확인
        if (this.playerDodged) {
          // 회피 성공!
          this.handlePresenceDodgeSuccess();
        } else {
          // 회피 실패 - 죽음!
          this.handlePresenceKill();
        }
      }
    });

    // 보스 위치 업데이트
    this.fogBossPosition = { x: head.x, y: head.y };
  }

  // QTE 닷지 프롬프트 표시
  showDodgeQTE(duration = 600) {
    const { width, height } = this.cameras.main;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 🆕 기존 QTE 요소가 있으면 먼저 정리 (중복 방지!)
    this.cleanupQTEElements();

    // 🆕 QTE 세션 ID 생성 (나중에 정리 시 확인용)
    this.currentQTESessionId = Date.now();
    const sessionId = this.currentQTESessionId;

    // 🆕 난이도 표시 (시간이 짧을수록 빨간색)
    const difficultyRatio = Math.max(0, (duration - 250) / 450); // 0(극한) ~ 1(여유)
    const timerColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      { r: 255, g: 0, b: 0 },    // 빨강 (위험)
      { r: 0, g: 255, b: 0 },    // 초록 (안전)
      100,
      Math.floor(difficultyRatio * 100)
    );
    const timerHexColor = Phaser.Display.Color.GetColor(timerColor.r, timerColor.g, timerColor.b);

    // 큰 SPACE 프롬프트
    const qtePrompt = this.add.container(width / 2, height / 2 + 80).setDepth(7000);

    // 배경 (난이도에 따라 테두리 색 변경)
    const borderColor = duration < 400 ? 0xff0000 : 0xffff00;
    const bg = this.add.rectangle(0, 0, 280, 70, 0x000000, 0.8)
      .setStrokeStyle(4, borderColor);
    qtePrompt.add(bg);

    // SPACE 키 아이콘
    const keyBg = this.add.rectangle(-60, 0, 80, 40, 0x333333)
      .setStrokeStyle(2, 0xffffff);
    const keyText = this.add.text(-60, 0, 'SPACE', {
      fontSize: '16px',
      fill: '#ffffff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    qtePrompt.add([keyBg, keyText]);

    // "TO DODGE!" 텍스트 (시간 짧으면 QUICK! 추가)
    const urgency = duration < 400 ? 'QUICK!' : 'TO DODGE!';
    const dodgeText = this.add.text(40, 0, urgency, {
      fontSize: '24px',
      fill: duration < 400 ? '#ff6666' : '#ffff00',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    qtePrompt.add(dodgeText);

    // 타이머 바 (점점 줄어듦) - 색상이 난이도 반영
    const timerBarBg = this.add.rectangle(0, 45, 260, 12, 0x333333);
    const timerBar = this.add.rectangle(-130, 45, 260, 10, timerHexColor).setOrigin(0, 0.5);
    qtePrompt.add([timerBarBg, timerBar]);

    // 타이머 바 애니메이션 (실제 지속시간에 맞춤!)
    this.tweens.add({
      targets: timerBar,
      scaleX: 0,
      duration: duration,
      ease: 'Linear',
      onUpdate: () => {
        // 시간이 거의 없을 때 빨간색으로 변경
        if (timerBar.scaleX < 0.3) {
          timerBar.setFillStyle(0xff0000);
        }
      }
    });

    // 깜빡임 효과 (시간 짧으면 더 빠르게)
    const blinkSpeed = duration < 400 ? 60 : 100;
    this.tweens.add({
      targets: [bg, keyBg],
      alpha: { from: 1, to: 0.5 },
      duration: blinkSpeed,
      yoyo: true,
      repeat: -1
    });

    // 뱀 머리 위에도 표시
    const headPrompt = this.add.text(headX, headY - 40, '⚡ SPACE! ⚡', {
      fontSize: '20px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(7000);

    this.tweens.add({
      targets: headPrompt,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      duration: 100,
      yoyo: true,
      repeat: -1
    });

    // 저장 (나중에 정리용)
    this.qteElements = [qtePrompt, headPrompt];

    // QTE 끝나면 자동 제거 (세션 ID 체크로 중복 정리 방지!)
    this.time.delayedCall(duration + 200, () => {
      // 🆕 같은 세션의 QTE만 정리 (이미 새 QTE가 시작됐으면 스킵)
      if (this.currentQTESessionId === sessionId) {
        this.cleanupQTEElements();
      }
    });
  }

  // 🆕 QTE 요소 정리 함수
  cleanupQTEElements() {
    if (this.qteElements) {
      this.qteElements.forEach(el => {
        if (el && el.destroy) {
          // tweens 먼저 중지
          this.tweens.killTweensOf(el);
          el.destroy();
        }
      });
      this.qteElements = null;
    }
  }

  // QTE 닷지 입력 처리 (키보드 핸들러에서 호출)
  handleDodgeQTEInput() {
    if (!this.dodgeQTEActive) return false;

    // 닷지 성공!
    this.playerDodged = true;
    this.dodgeQTEActive = false;

    // 🆕 QTE 프롬프트 즉시 제거 (정리 함수 사용)
    this.cleanupQTEElements();

    // 즉시 "PERFECT!" 표시
    this.showPerfectDodge();

    return true;
  }

  // 퍼펙트 닷지 연출
  showPerfectDodge() {
    const { width, height } = this.cameras.main;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 슬로우모션 효과
    this.time.timeScale = 0.3;
    this.tweens.timeScale = 0.3;

    // 🆕 보스가 옆으로 빠르게 지나가는 효과 (실제로 피한 느낌!)
    this.showBossPassingEffect(headX, headY);

    // 뱀이 옆으로 굴러가는 연출 (잔상)
    for (let i = 0; i < 4; i++) {
      const ghost = this.add.circle(
        headX + i * 15,
        headY,
        this.gridSize / 2 - 2,
        0x00ff00,
        0.6 - i * 0.15
      ).setDepth(150);

      this.tweens.add({
        targets: ghost,
        alpha: 0,
        x: ghost.x + 30,
        duration: 300,
        delay: i * 50,
        onComplete: () => ghost.destroy()
      });
    }

    // "PERFECT!" 텍스트
    const perfectText = this.add.text(width / 2, height / 2 - 50, 'PERFECT!', {
      fontSize: '48px',
      fill: '#00ffff',
      fontStyle: 'bold',
      stroke: '#003333',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(7000);

    this.tweens.add({
      targets: perfectText,
      scaleX: { from: 0.5, to: 1.2 },
      scaleY: { from: 0.5, to: 1.2 },
      duration: 200,
      onComplete: () => {
        this.tweens.add({
          targets: perfectText,
          alpha: 0,
          y: height / 2 - 100,
          duration: 500,
          onComplete: () => perfectText.destroy()
        });
      }
    });

    // 0.5초 후 시간 복구
    this.time.delayedCall(500, () => {
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;
    });

    // 무적 프레임
    this.isInvincible = true;
    this.time.delayedCall(800, () => {
      this.isInvincible = false;
    });
  }

  // 🆕 보스가 옆으로 지나가는 효과 (슬로우모션 중)
  showBossPassingEffect(headX, headY) {
    // 보스가 지나가는 방향 결정 (뱀 방향의 반대쪽에서 출발)
    const directions = ['left', 'right', 'top', 'bottom'];
    const passDir = directions[Math.floor(Math.random() * directions.length)];

    let startX, startY, endX, endY;
    const offset = 150; // 화면 밖에서 시작

    switch (passDir) {
      case 'left':
        startX = headX - offset;
        startY = headY;
        endX = headX + offset;
        endY = headY + Phaser.Math.Between(-30, 30);
        break;
      case 'right':
        startX = headX + offset;
        startY = headY;
        endX = headX - offset;
        endY = headY + Phaser.Math.Between(-30, 30);
        break;
      case 'top':
        startX = headX + Phaser.Math.Between(-50, 50);
        startY = headY - offset;
        endX = headX + Phaser.Math.Between(-50, 50);
        endY = headY + offset;
        break;
      case 'bottom':
        startX = headX + Phaser.Math.Between(-50, 50);
        startY = headY + offset;
        endX = headX + Phaser.Math.Between(-50, 50);
        endY = headY - offset;
        break;
    }

    // 보스 그림자 (지나가는 형체)
    const passingBoss = this.add.container(startX, startY).setDepth(6500);

    // 어두운 형체 (블러 느낌)
    const shadowBody = this.add.ellipse(0, 0, 60, 80, 0x220022, 0.7);
    passingBoss.add(shadowBody);

    // 빨간 눈 (트레일 효과)
    const leftEye = this.add.circle(-8, -10, 5, 0xff0000, 1);
    const rightEye = this.add.circle(8, -10, 5, 0xff0000, 1);
    leftEye.setBlendMode(Phaser.BlendModes.ADD);
    rightEye.setBlendMode(Phaser.BlendModes.ADD);
    passingBoss.add([leftEye, rightEye]);

    // 잔상 트레일 생성
    const trailCount = 8;
    for (let i = 0; i < trailCount; i++) {
      const trailProgress = i / trailCount;
      const trailX = startX + (endX - startX) * trailProgress * 0.3;
      const trailY = startY + (endY - startY) * trailProgress * 0.3;

      const trail = this.add.ellipse(trailX, trailY, 50, 70, 0x330033, 0.3 - i * 0.03)
        .setDepth(6400);

      this.tweens.add({
        targets: trail,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 400,
        delay: i * 30,
        onComplete: () => trail.destroy()
      });
    }

    // 보스 빠르게 지나감 (슬로우모션 상태에서도 빠르게!)
    this.tweens.add({
      targets: passingBoss,
      x: endX,
      y: endY,
      duration: 200, // 슬로우모션이라 실제로는 더 길게 느껴짐
      ease: 'Power2.easeIn',
      onUpdate: () => {
        // 지나가면서 눈 트레일
        if (Math.random() < 0.5) {
          const eyeTrail = this.add.circle(
            passingBoss.x + Phaser.Math.Between(-15, 15),
            passingBoss.y - 10,
            3, 0xff0000, 0.6
          ).setDepth(6400).setBlendMode(Phaser.BlendModes.ADD);

          this.tweens.add({
            targets: eyeTrail,
            alpha: 0,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 150,
            onComplete: () => eyeTrail.destroy()
          });
        }
      },
      onComplete: () => {
        passingBoss.destroy();
      }
    });

    // 스윽 하는 바람 효과 (시각적)
    const windLines = [];
    for (let i = 0; i < 5; i++) {
      const lineY = headY + Phaser.Math.Between(-40, 40);
      const line = this.add.rectangle(
        passDir === 'left' ? headX - 30 : headX + 30,
        lineY,
        80, 2, 0x666699, 0.5
      ).setDepth(6300);
      windLines.push(line);

      this.tweens.add({
        targets: line,
        x: passDir === 'left' ? headX + 100 : headX - 100,
        alpha: 0,
        scaleX: 2,
        duration: 250,
        delay: i * 30,
        onComplete: () => line.destroy()
      });
    }
  }

  // 회피 성공 처리
  handlePresenceDodgeSuccess() {
    const { width, height } = this.cameras.main;

    // "SURVIVED!" 표시
    const survivedText = this.add.text(width / 2, height / 2, 'SURVIVED!', {
      fontSize: '36px',
      fill: '#00ff00',
      fontStyle: 'bold',
      stroke: '#003300',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000);

    this.tweens.add({
      targets: survivedText,
      alpha: 0,
      y: height / 2 - 50,
      duration: 800,
      onComplete: () => survivedText.destroy()
    });

    // 보스 숨기기 (좌절하며 사라짐)
    this.time.delayedCall(300, () => {
      // 보스 좌절 비명
      const frustration = this.add.text(
        this.fogBossElement?.x || width / 2,
        (this.fogBossElement?.y || height / 2) - 30,
        'MISSED!',
        {
          fontSize: '20px',
          fill: '#ff6666',
          fontStyle: 'bold'
        }
      ).setOrigin(0.5).setDepth(160);

      this.tweens.add({
        targets: frustration,
        alpha: 0,
        y: frustration.y - 30,
        duration: 600,
        onComplete: () => frustration.destroy()
      });

      if (this.fogBossElement) {
        // 보스가 안개 속으로 녹아드는 효과
        this.tweens.add({
          targets: this.fogBossElement,
          alpha: 0,
          scaleX: 0.5,
          scaleY: 0.5,
          duration: 500,
          ease: 'Power2.easeIn'
        });
      }
      this.fogBossVisible = false;

      // 존재감 약간 감소 (안심 효과)
      if (this.presenceActive) {
        this.presenceLevel = Math.max(this.presenceLevel - 20, 30);
        this.updateBrowserDarkness(this.presenceLevel);
      }

      // 다음 공격 스케줄 (페이즈에 따라 다르게)
      this.time.delayedCall(500, () => {
        if (this.fogBossPhase === 'shadow') {
          // Shadow 페이즈면 shadowStrike 계속
          const delay = Phaser.Math.Between(this.shadowStrikeInterval[0], this.shadowStrikeInterval[1]);
          this.shadowStrikeTimer = this.time.delayedCall(delay, () => {
            this.showShadowStrikeWarning();
          });
        } else if (this.presenceActive) {
          // Presence 시스템이면 presenceAttack 스케줄
          this.schedulePresenceAttack();
        }
      });
    });
  }

  // 회피 실패 - 사망 (보스에게 잡아먹힘!)
  handlePresenceKill() {
    // 🆕 HIT 대기 중이면 사망 무시 (클리어 우선!)
    if (this.fogBossHitPending) {
      return;
    }

    this.gameOver = true;
    if (this.moveTimer) this.moveTimer.paused = true;

    // 🆕 잡아먹히는 애니메이션!
    this.showBossEatingAnimation();
  }

  // 🆕 보스가 뱀을 잡아먹는 애니메이션 (회피 성공과 동일한 매커니즘, 뱀만 끌려감)
  showBossEatingAnimation() {
    const { width, height } = this.cameras.main;
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 1. 회피 성공과 동일하게 슬로우모션 시작
    this.time.timeScale = 0.3;
    this.tweens.timeScale = 0.3;

    // 2. 보스가 지나가는 방향 결정 (showBossPassingEffect와 동일!)
    const directions = ['left', 'right', 'top', 'bottom'];
    const passDir = directions[Math.floor(Math.random() * directions.length)];

    let startX, startY, endX, endY;
    const offset = 150;

    switch (passDir) {
      case 'left':
        startX = headX - offset;
        startY = headY;
        endX = headX + offset;
        endY = headY + Phaser.Math.Between(-30, 30);
        break;
      case 'right':
        startX = headX + offset;
        startY = headY;
        endX = headX - offset;
        endY = headY + Phaser.Math.Between(-30, 30);
        break;
      case 'top':
        startX = headX + Phaser.Math.Between(-50, 50);
        startY = headY - offset;
        endX = headX + Phaser.Math.Between(-50, 50);
        endY = headY + offset;
        break;
      case 'bottom':
        startX = headX + Phaser.Math.Between(-50, 50);
        startY = headY + offset;
        endX = headX + Phaser.Math.Between(-50, 50);
        endY = headY - offset;
        break;
    }

    // 3. 보스 그림자 생성 (showBossPassingEffect와 동일한 디자인!)
    const passingBoss = this.add.container(startX, startY).setDepth(6500);

    // 어두운 형체 (블러 느낌) - 동일한 크기
    const shadowBody = this.add.ellipse(0, 0, 60, 80, 0x220022, 0.7);
    passingBoss.add(shadowBody);

    // 빨간 눈 2개 (동일)
    const leftEye = this.add.circle(-8, -10, 5, 0xff0000, 1);
    const rightEye = this.add.circle(8, -10, 5, 0xff0000, 1);
    leftEye.setBlendMode(Phaser.BlendModes.ADD);
    rightEye.setBlendMode(Phaser.BlendModes.ADD);
    passingBoss.add([leftEye, rightEye]);

    // 4. 잔상 트레일 생성 (동일)
    const trailCount = 8;
    for (let i = 0; i < trailCount; i++) {
      const trailProgress = i / trailCount;
      const trailX = startX + (headX - startX) * trailProgress * 0.3;
      const trailY = startY + (headY - startY) * trailProgress * 0.3;

      const trail = this.add.ellipse(trailX, trailY, 50, 70, 0x330033, 0.3 - i * 0.03)
        .setDepth(6400);

      this.tweens.add({
        targets: trail,
        alpha: 0,
        scaleX: 0.5,
        scaleY: 0.5,
        duration: 400,
        delay: i * 30,
        onComplete: () => trail.destroy()
      });
    }

    // 5. 뱀 복제본 생성 (끌려갈 용도)
    const snakeCopy = [];
    this.snake.forEach((segment, index) => {
      const segX = segment.x * this.gridSize + this.gridSize / 2;
      const segY = segment.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
      const isHead = index === 0;

      const copy = this.add.circle(segX, segY, this.gridSize / 2 - 2, isHead ? 0x00aa00 : 0x00ff00, 1)
        .setDepth(6400);
      snakeCopy.push({ element: copy, startX: segX, startY: segY });
    });

    // 원본 뱀 숨기기 (graphics 객체로 그려짐!)
    if (this.graphics) {
      this.graphics.clear();
      this.graphics.setAlpha(0);
    }

    // 6. 보스 빠르게 지나감 (뱀 위치까지) - 그리고 뱀을 낚아채며 계속 이동
    let snakeCaught = false;

    this.tweens.add({
      targets: passingBoss,
      x: endX,
      y: endY,
      duration: 200,
      ease: 'Power2.easeIn',
      onUpdate: () => {
        // 지나가면서 눈 트레일 (동일)
        if (Math.random() < 0.5) {
          const eyeTrail = this.add.circle(
            passingBoss.x + Phaser.Math.Between(-15, 15),
            passingBoss.y - 10,
            3, 0xff0000, 0.6
          ).setDepth(6400).setBlendMode(Phaser.BlendModes.ADD);

          this.tweens.add({
            targets: eyeTrail,
            alpha: 0,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 150,
            onComplete: () => eyeTrail.destroy()
          });
        }

        // 보스가 뱀 위치에 도달하면 뱀을 낚아챔!
        const distToSnake = Math.sqrt(
          Math.pow(passingBoss.x - headX, 2) + Math.pow(passingBoss.y - headY, 2)
        );

        if (!snakeCaught && distToSnake < 30) {
          snakeCaught = true;

          // 뱀이 보스에 붙어서 함께 끌려감
          snakeCopy.forEach((copyData, idx) => {
            const offsetX = copyData.startX - headX;
            const offsetY = copyData.startY - headY;

            // 보스와 함께 어둠 속으로 끌려감
            this.tweens.add({
              targets: copyData.element,
              x: endX + offsetX * 0.3,
              y: endY + offsetY * 0.3,
              alpha: 0,
              scaleX: 0.1,
              scaleY: 0.1,
              duration: 150,
              delay: idx * 10,
              ease: 'Power2.easeIn',
              onComplete: () => copyData.element.destroy()
            });
          });
        }
      },
      onComplete: () => {
        passingBoss.destroy();
      }
    });

    // 7. 슬로우모션 끝나고 "Delicious..." 표시 (안개는 그대로!)
    this.time.delayedCall(400, () => {
      // 시간 복구
      this.time.timeScale = 1;
      this.tweens.timeScale = 1;

      // 잠시 후 "Delicious..." (안개 위에 표시 - depth 5000)
      this.time.delayedCall(800, () => {
        const deliciousText = this.add.text(width / 2, height / 2, 'Delicious...', {
          fontSize: '32px',
          fill: '#cc3333',
          fontStyle: 'italic',
          stroke: '#000000',
          strokeThickness: 3
        }).setOrigin(0.5).setDepth(5000).setAlpha(0);

        this.tweens.add({
          targets: deliciousText,
          alpha: 1,
          duration: 400
        });

        // 1초 후 게임 오버
        this.time.delayedCall(1200, () => {
          this.tweens.add({
            targets: deliciousText,
            alpha: 0,
            duration: 300,
            onComplete: () => {
              deliciousText.destroy();
              this.cleanupPresenceSystem();
              this.showGameOverScreen();
            }
          });
        });
      });
    });
  }

  // Presence 시스템 정리
  cleanupPresenceSystem() {
    this.presenceActive = false;
    this.stalkingActive = false;
    this.presenceLevel = 0;
    this.dodgeWindowActive = false;

    if (this.presenceTimer) {
      this.presenceTimer.destroy();
      this.presenceTimer = null;
    }
    if (this.presencePulseTimer) {
      this.presencePulseTimer.destroy();
      this.presencePulseTimer = null;
    }
    if (this.dodgeWindowTimer) {
      this.dodgeWindowTimer.destroy();
      this.dodgeWindowTimer = null;
    }

    // 브라우저 어둠 제거
    this.removeBrowserDarkness();

    // 기존 스토킹 시스템도 정리
    this.cleanupStalkingSystem();
  }

  // 🆕 스토킹 페이즈 시작 (기존 코드 유지 - The Presence 시스템에서 호출)
  startStalkingPhase() {
    // The Presence에서 이미 처리하므로 여기서는 눈 스케줄만
    this.stalkingActive = true;
  }

  // 🆕 Rage Mode 시작 (HIT 3 분노 모드)
  startRageMode() {
    this.rageModeActive = true;

    const { width, height } = this.cameras.main;

    // Rage 시작 연출
    this.showRageModeIntro();

    // 화면 깜빡임 효과 (지속적)
    this.rageFlickerTimer = this.time.addEvent({
      delay: Phaser.Math.Between(400, 800),
      callback: () => {
        if (!this.rageModeActive || this.gameOver) return;

        // 랜덤하게 화면 깜빡임
        const flicker = this.add.rectangle(0, 0, width, height, 0xff0000, 0.15)
          .setOrigin(0, 0).setDepth(2998);

        this.tweens.add({
          targets: flicker,
          alpha: 0,
          duration: 100,
          onComplete: () => flicker.destroy()
        });

        // 다음 깜빡임 스케줄 (불규칙하게)
        if (this.rageFlickerTimer) {
          this.rageFlickerTimer.delay = Phaser.Math.Between(300, 700);
        }
      },
      loop: true
    });

    // 글리치 효과 타이머
    this.rageGlitchTimer = this.time.addEvent({
      delay: Phaser.Math.Between(2000, 4000),
      callback: () => {
        if (!this.rageModeActive || this.gameOver) return;
        this.showRageGlitch();
      },
      loop: true
    });
  }

  // 🆕 Rage Mode 인트로 연출
  showRageModeIntro() {
    const { width, height } = this.cameras.main;

    // 강력한 화면 플래시
    const flash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.6)
      .setOrigin(0, 0).setDepth(5000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500,
      onComplete: () => flash.destroy()
    });

    // "RAGE MODE" 텍스트
    const rageText = this.add.text(width / 2, height / 2, 'RAGE MODE', {
      fontSize: '48px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#ffff00',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5001).setAlpha(0);

    // 텍스트 흔들림 효과
    this.tweens.add({
      targets: rageText,
      alpha: 1,
      scaleX: { from: 0.5, to: 1.2 },
      scaleY: { from: 0.5, to: 1.2 },
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        // 흔들림
        this.tweens.add({
          targets: rageText,
          x: width / 2 + Phaser.Math.Between(-10, 10),
          y: height / 2 + Phaser.Math.Between(-5, 5),
          duration: 50,
          repeat: 10,
          yoyo: true
        });

        // 페이드아웃
        this.time.delayedCall(800, () => {
          this.tweens.add({
            targets: rageText,
            alpha: 0,
            scaleX: 1.5,
            scaleY: 1.5,
            duration: 300,
            onComplete: () => rageText.destroy()
          });
        });
      }
    });

    // 카메라 강한 흔들림
    this.cameras.main.shake(800, 0.05);
  }

  // 🆕 Rage 글리치 효과
  showRageGlitch() {
    const { width, height } = this.cameras.main;

    // 화면 일부 잘려서 이동하는 효과
    const numSlices = Phaser.Math.Between(3, 6);
    for (let i = 0; i < numSlices; i++) {
      const sliceY = Phaser.Math.Between(0, height);
      const sliceHeight = Phaser.Math.Between(5, 30);
      const sliceOffset = Phaser.Math.Between(-20, 20);

      const slice = this.add.rectangle(sliceOffset, sliceY, width, sliceHeight, 0xff0000, 0.3)
        .setOrigin(0, 0).setDepth(2997);

      this.tweens.add({
        targets: slice,
        x: Phaser.Math.Between(-30, 30),
        alpha: 0,
        duration: 150,
        delay: i * 30,
        onComplete: () => slice.destroy()
      });
    }

    // 랜덤 속삭임 (분노 버전)
    if (Math.random() < 0.5) {
      const whisper = Phaser.Math.RND.pick(this.rageWhisperTexts);
      const whisperText = this.add.text(
        Phaser.Math.Between(50, width - 50),
        Phaser.Math.Between(100, height - 100),
        whisper,
        {
          fontSize: '24px',
          fill: '#ff0000',
          fontStyle: 'bold',
          stroke: '#000000',
          strokeThickness: 3
        }
      ).setOrigin(0.5).setDepth(3002).setAlpha(0);

      this.tweens.add({
        targets: whisperText,
        alpha: 0.8,
        duration: 100,
        onComplete: () => {
          this.tweens.add({
            targets: whisperText,
            alpha: 0,
            y: whisperText.y - 20,
            duration: 400,
            onComplete: () => whisperText.destroy()
          });
        }
      });
    }

    // 다음 글리치 스케줄 (불규칙)
    if (this.rageGlitchTimer) {
      this.rageGlitchTimer.delay = Phaser.Math.Between(1500, 3500);
    }
  }

  // 🆕 Rage Mode 정리
  cleanupRageMode() {
    this.rageModeActive = false;

    if (this.rageFlickerTimer) {
      this.rageFlickerTimer.destroy();
      this.rageFlickerTimer = null;
    }
    if (this.rageGlitchTimer) {
      this.rageGlitchTimer.destroy();
      this.rageGlitchTimer = null;
    }
  }

  // 🆕 페이즈 인트로 연출 (HIT 수에 따라 다른 연출)
  showPhaseIntro() {
    const { width, height } = this.cameras.main;
    const hitCount = this.fogBossHitCount;

    // HIT 수에 따른 보스 대사
    const dialogues = [
      { text: "I see you...", color: '#880000' },                    // 0 HIT
      { text: "You got lucky... NOT AGAIN!", color: '#aa0000' },     // 1 HIT
      { text: "NOW I'M ANGRY!", color: '#cc0000' },                  // 2 HIT
      { text: "YOU WILL NOT ESCAPE!!!", color: '#ff0000' }           // 3 HIT
    ];

    const dialogue = dialogues[Math.min(hitCount, 3)];

    // 보스 대사 표시
    const text = this.add.text(width / 2, height / 2, dialogue.text, {
      fontSize: `${24 + hitCount * 6}px`,
      fill: dialogue.color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    // 타이핑 효과
    const fullText = dialogue.text;
    text.setText('');
    let charIndex = 0;

    this.time.addEvent({
      delay: 50 - hitCount * 10,
      callback: () => {
        if (charIndex < fullText.length) {
          text.setText(fullText.substring(0, charIndex + 1));
          charIndex++;
          // 카메라 살짝 흔들기
          if (hitCount >= 2) {
            this.cameras.main.shake(50, 0.005);
          }
        }
      },
      repeat: fullText.length - 1
    });

    this.tweens.add({
      targets: text,
      alpha: 1,
      duration: 200
    });

    // HIT 2+ : 화면 빨간 플래시
    if (hitCount >= 2) {
      const flash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.3)
        .setOrigin(0, 0).setDepth(4999);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        duration: 500,
        onComplete: () => flash.destroy()
      });
    }

    // HIT 3 : 보스 분노 효과 - 화면 떨림 + 검은 선 효과
    if (hitCount >= 3) {
      this.cameras.main.shake(800, 0.02);

      // 화면에 빠르게 스쳐가는 검은 선들
      for (let i = 0; i < 5; i++) {
        this.time.delayedCall(i * 100, () => {
          const line = this.add.rectangle(
            Phaser.Math.Between(0, width),
            0, 3, height, 0x000000, 0.7
          ).setOrigin(0, 0).setDepth(5001);

          this.tweens.add({
            targets: line,
            x: line.x + Phaser.Math.Between(-100, 100),
            alpha: 0,
            duration: 200,
            onComplete: () => line.destroy()
          });
        });
      }
    }

    // 대사 사라짐
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: text,
        alpha: 0,
        y: height / 2 - 30,
        duration: 300,
        onComplete: () => text.destroy()
      });
    });
  }

  // 🆕 빨간 비네트 오버레이 생성
  createVignetteOverlay() {
    const { width, height } = this.cameras.main;

    // 기존 비네트 제거
    if (this.vignetteOverlay) {
      this.vignetteOverlay.destroy();
    }

    // 그라데이션 비네트 효과 (가장자리가 빨간색)
    this.vignetteOverlay = this.add.graphics().setDepth(3000);
    this.updateVignetteIntensity(0);
  }

  // 🆕 비네트 강도 업데이트 (아주 미세하게)
  updateVignetteIntensity(intensity) {
    if (!this.vignetteOverlay) return;

    const { width, height } = this.cameras.main;
    this.vignetteOverlay.clear();

    // 긴장도에 따라 비네트 강도 조절 (매우 약하게)
    // 최대 alpha를 0.15로 제한 (기존 0.4에서 대폭 감소)
    const alpha = Math.min(intensity / 100 * 0.15, 0.15);

    // 테두리만 살짝 빨갛게 (두께도 줄임)
    const borderWidth = 5 + intensity * 0.1;
    this.vignetteOverlay.lineStyle(borderWidth, 0xff0000, alpha);
    this.vignetteOverlay.strokeRect(0, 0, width, height);

    // 긴장도 높을 때만 두 번째 테두리 추가
    if (intensity > 50) {
      const innerAlpha = alpha * 0.5;
      this.vignetteOverlay.lineStyle(borderWidth * 0.5, 0xff0000, innerAlpha);
      this.vignetteOverlay.strokeRect(borderWidth, borderWidth, width - borderWidth * 2, height - borderWidth * 2);
    }
  }

  // 🆕 스토킹 눈 스케줄링 (HIT 수에 따라 더 빈번하게)
  scheduleStalkingEyes() {
    if (!this.stalkingActive || this.gameOver) return;

    const hitCount = this.fogBossHitCount;

    // HIT 수에 따라 기본 딜레이 감소 (더 빠르게 나타남)
    // 0 HIT: 3000ms 기준, 3 HIT: 1500ms 기준
    const hitBonus = hitCount * 500;
    const baseDelay = Math.max(1500, 3000 - hitBonus - this.stalkingIntensity * 20);
    const minDelay = Math.max(600, 800 - hitCount * 100);
    const delay = Math.max(Phaser.Math.Between(baseDelay - 500, baseDelay + 500), minDelay);

    this.stalkingTimer = this.time.delayedCall(delay, () => {
      if (this.stalkingActive && !this.gameOver) {
        this.showStalkingEyes();
      }
    });
  }

  // 🆕 스토킹 눈 표시 (안개 속에서 번쩍이는 빨간 눈 - HIT 수에 따라 눈 개수 증가)
  showStalkingEyes() {
    if (!this.stalkingActive || this.gameOver) return;

    const head = this.snake[0];
    const hitCount = this.fogBossHitCount;

    // HIT 수에 따라 눈 개수 증가 (0 HIT: 1개, 1 HIT: 2개, 2 HIT: 3개, 3 HIT: 4개)
    const eyeCount = 1 + hitCount;

    // HIT 수에 따라 눈이 더 가깝게 나타남
    const minDistance = Math.max(4, 6 - hitCount);
    const maxDistance = Math.max(6, 10 - hitCount);

    const allEyeContainers = [];

    for (let i = 0; i < eyeCount; i++) {
      // 눈 위치 계산 (서로 겹치지 않게 분산)
      const angleOffset = (Math.PI * 2 / eyeCount) * i + Math.random() * 0.5;
      const distance = Phaser.Math.Between(minDistance, maxDistance);
      let eyeX = head.x + Math.cos(angleOffset) * distance;
      let eyeY = head.y + Math.sin(angleOffset) * distance;

      // 맵 경계 체크
      eyeX = Phaser.Math.Clamp(eyeX, 2, this.cols - 3);
      eyeY = Phaser.Math.Clamp(eyeY, 2, this.rows - 3);

      if (i === 0) {
        this.lastStalkingEyePos = { x: eyeX, y: eyeY };
      }

      const pixelX = eyeX * this.gridSize + this.gridSize / 2;
      const pixelY = eyeY * this.gridSize + this.gridSize / 2 + this.gameAreaY;

      // HIT 수에 따라 눈 크기 증가
      const eyeScale = 1 + hitCount * 0.15;

      // 눈 컨테이너 생성
      const eyeContainer = this.add.container(pixelX, pixelY).setDepth(160).setAlpha(0).setScale(eyeScale);

      // 눈 글로우 (HIT 수에 따라 더 밝아짐)
      const glowAlpha = 0.3 + hitCount * 0.1;
      const eyeGlow = this.add.circle(0, 0, 15, 0xff0000, glowAlpha);
      const leftEye = this.add.circle(-8, 0, 5, 0xff0000, 1);
      const rightEye = this.add.circle(8, 0, 5, 0xff0000, 1);

      // 동공 (세로로 긴 고양이 눈)
      const leftPupil = this.add.ellipse(-8, 0, 2, 5, 0x000000, 1);
      const rightPupil = this.add.ellipse(8, 0, 2, 5, 0x000000, 1);

      eyeContainer.add([eyeGlow, leftEye, rightEye, leftPupil, rightPupil]);

      // 뱀 방향 쳐다보기
      const lookAngle = Phaser.Math.Angle.Between(eyeX, eyeY, head.x, head.y);
      const lookOffset = 2;
      leftPupil.x = -8 + Math.cos(lookAngle) * lookOffset;
      leftPupil.y = Math.sin(lookAngle) * lookOffset;
      rightPupil.x = 8 + Math.cos(lookAngle) * lookOffset;
      rightPupil.y = Math.sin(lookAngle) * lookOffset;

      allEyeContainers.push({ container: eyeContainer, leftPupil, rightPupil, eyeX, eyeY });

      // 페이드인 (시간차 적용)
      this.tweens.add({
        targets: eyeContainer,
        alpha: 1,
        duration: 150,
        delay: i * 80  // 시간차로 하나씩 나타남
      });
    }

    // 모든 눈이 나타난 후 효과
    this.time.delayedCall(eyeCount * 80 + 200, () => {
      // 눈들이 뱀을 따라가는 효과
      allEyeContainers.forEach(({ leftPupil, rightPupil, eyeX, eyeY }) => {
        this.tweens.add({
          targets: [leftPupil, rightPupil],
          x: (target) => {
            const baseX = target === leftPupil ? -8 : 8;
            const newAngle = Phaser.Math.Angle.Between(eyeX, eyeY, this.snake[0].x, this.snake[0].y);
            return baseX + Math.cos(newAngle) * 2;
          },
          y: () => {
            const newAngle = Phaser.Math.Angle.Between(eyeX, eyeY, this.snake[0].x, this.snake[0].y);
            return Math.sin(newAngle) * 2;
          },
          duration: 400
        });
      });

      // 긴장도 높으면 속삭임 텍스트 추가 (HIT 높을수록 확률 증가)
      const whisperChance = 0.3 + hitCount * 0.15;
      if (this.stalkingIntensity > 30 && Math.random() < whisperChance) {
        this.showWhisperText();
      }

      // HIT 3+ : 눈들이 빠르게 깜빡이는 효과
      if (hitCount >= 3) {
        allEyeContainers.forEach(({ container }, idx) => {
          this.tweens.add({
            targets: container,
            alpha: { from: 1, to: 0.3 },
            duration: 80,
            yoyo: true,
            repeat: 3,
            delay: idx * 50
          });
        });
      }

      // 페이드아웃 (HIT 높을수록 오래 유지)
      const displayTime = 600 + hitCount * 150;
      this.time.delayedCall(displayTime, () => {
        let destroyedCount = 0;
        allEyeContainers.forEach(({ container }, idx) => {
          this.tweens.add({
            targets: container,
            alpha: 0,
            duration: 200,
            delay: idx * 50,
            onComplete: () => {
              container.destroy();
              destroyedCount++;

              // 모든 눈이 사라진 후 다음 단계
              if (destroyedCount === allEyeContainers.length) {
                // 긴장도가 충분히 높으면 점프 스케어 확률 체크
                // HIT 수에 따라 필요한 긴장도 감소 (더 빨리 공격)
                const requiredTension = Math.max(50, 70 - hitCount * 10);
                if (this.stalkingIntensity >= requiredTension) {
                  this.checkJumpScareOrContinue();
                } else {
                  this.scheduleStalkingEyes();
                }
              }
            }
          });
        });
      });
    });

    // 카메라 미세 흔들림 (HIT 수에 비례해서 더 강하게)
    const shakeIntensity = 0.002 + this.stalkingIntensity * 0.0001 + hitCount * 0.003;
    if (this.stalkingIntensity > 40 || hitCount >= 2) {
      this.cameras.main.shake(100 + hitCount * 50, shakeIntensity);
    }
  }

  // 🆕 속삭임 텍스트 표시
  showWhisperText() {
    const { width, height } = this.cameras.main;

    const text = this.whisperTexts[this.currentWhisperIndex];
    this.currentWhisperIndex = (this.currentWhisperIndex + 1) % this.whisperTexts.length;

    // 랜덤 위치 (화면 가장자리)
    const positions = [
      { x: Phaser.Math.Between(50, 150), y: Phaser.Math.Between(100, height - 100) },
      { x: Phaser.Math.Between(width - 150, width - 50), y: Phaser.Math.Between(100, height - 100) },
      { x: Phaser.Math.Between(100, width - 100), y: Phaser.Math.Between(70, 120) },
      { x: Phaser.Math.Between(100, width - 100), y: Phaser.Math.Between(height - 120, height - 70) }
    ];
    const pos = Phaser.Math.RND.pick(positions);

    const whisper = this.add.text(pos.x, pos.y, text, {
      fontSize: '16px',
      fill: '#880000',
      fontStyle: 'italic',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(3001).setAlpha(0);

    // 타이핑 효과
    whisper.setText('');
    let charIndex = 0;
    const typeTimer = this.time.addEvent({
      delay: 80,
      callback: () => {
        if (charIndex < text.length) {
          whisper.setText(text.substring(0, charIndex + 1));
          charIndex++;
        }
      },
      repeat: text.length - 1
    });

    // 페이드인
    this.tweens.add({
      targets: whisper,
      alpha: 0.7,
      duration: 300
    });

    // 페이드아웃
    this.time.delayedCall(2000, () => {
      this.tweens.add({
        targets: whisper,
        alpha: 0,
        duration: 500,
        onComplete: () => whisper.destroy()
      });
    });
  }

  // 🆕 긴장도 업데이트
  updateStalkingIntensity() {
    if (!this.stalkingActive || this.gameOver) return;

    // 긴장도 점진적 증가
    this.stalkingIntensity = Math.min(this.stalkingIntensity + 5, 100);

    // 비네트 업데이트
    this.updateVignetteIntensity(this.stalkingIntensity);

    // 긴장도 50 이상이면 심장박동 효과 시작
    if (this.stalkingIntensity >= 50 && !this.heartbeatTimer) {
      this.startHeartbeatEffect();
    }

    // 긴장도 높을수록 안개 짙어짐
    if (this.stalkingIntensity >= 60) {
      this.fogVisibleTiles = Math.max(2.0, this.originalFogVisibleTiles - this.stalkingIntensity * 0.02);
    }
  }

  // 🆕 심장박동 효과
  startHeartbeatEffect() {
    if (this.heartbeatTimer) return;

    const { width, height } = this.cameras.main;

    this.heartbeatTimer = this.time.addEvent({
      delay: 800 - this.stalkingIntensity * 3, // 긴장도 높을수록 빠름
      callback: () => {
        if (!this.stalkingActive || this.gameOver) {
          this.heartbeatTimer.destroy();
          this.heartbeatTimer = null;
          return;
        }

        // 화면 펄스 효과
        const pulse = this.add.rectangle(0, 0, width, height, 0x330000, 0)
          .setOrigin(0, 0)
          .setDepth(2999);

        this.tweens.add({
          targets: pulse,
          alpha: { from: 0, to: 0.15 },
          duration: 100,
          yoyo: true,
          onComplete: () => pulse.destroy()
        });

        // 카메라 살짝 줌
        this.tweens.add({
          targets: this.cameras.main,
          zoom: 1.02,
          duration: 100,
          yoyo: true
        });
      },
      loop: true
    });
  }

  // 🆕 점프 스케어 또는 계속 스토킹 결정 (HIT 수에 따라 다른 행동)
  checkJumpScareOrContinue() {
    if (!this.stalkingActive || this.gameOver) return;

    const hitCount = this.fogBossHitCount;

    // HIT 수에 따라 가짜 등장 확률 감소 (더 공격적으로)
    const adjustedFakeOutChance = Math.max(0.1, this.fakeOutChance - hitCount * 0.1);

    // 가짜 등장 확률 체크
    if (Math.random() < adjustedFakeOutChance) {
      this.executeFakeOut();
    } else {
      // HIT 2+ : 콤보 공격 시작 (연속 공격)
      if (hitCount >= 2 && !this.comboAttackActive) {
        this.startComboAttack();
      } else {
        // 진짜 점프 스케어!
        this.executeJumpScare();
      }
    }
  }

  // 🆕 콤보 공격 시작 (HIT 2+ 연속 공격)
  startComboAttack() {
    const hitCount = this.fogBossHitCount;
    this.comboAttackActive = true;
    this.comboAttackCount = 0;

    // HIT 수에 따라 콤보 횟수 결정 (2 HIT: 2연속, 3 HIT: 3연속)
    this.maxComboAttacks = Math.min(hitCount, 3);

    // 콤보 경고 표시
    this.showComboWarning();
  }

  // 🆕 콤보 경고 표시
  showComboWarning() {
    const { width, height } = this.cameras.main;
    const hitCount = this.fogBossHitCount;

    // 경고 텍스트
    const warningTexts = [
      '', '',
      'DOUBLE STRIKE!', // 2 HIT
      'TRIPLE FURY!!'   // 3 HIT
    ];
    const warningText = this.add.text(width / 2, height / 2, warningTexts[hitCount] || 'COMBO!', {
      fontSize: '36px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    // 줌인 효과
    warningText.setScale(0.5);
    this.tweens.add({
      targets: warningText,
      alpha: 1,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 200,
      onComplete: () => {
        this.tweens.add({
          targets: warningText,
          alpha: 0,
          y: height / 2 - 50,
          duration: 300,
          delay: 300,
          onComplete: () => {
            warningText.destroy();
            // 첫 번째 콤보 공격 실행
            this.executeComboAttack();
          }
        });
      }
    });

    // 화면 붉은 플래시
    const flash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.3)
      .setOrigin(0, 0).setDepth(4999);
    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 400,
      onComplete: () => flash.destroy()
    });

    // 강한 카메라 흔들기
    this.cameras.main.shake(400, 0.04);
  }

  // 🆕 콤보 공격 실행 (연속 점프 스케어)
  executeComboAttack() {
    if (this.gameOver) {
      this.comboAttackActive = false;
      return;
    }

    this.comboAttackCount++;

    // 콤보 카운트 표시
    const { width, height } = this.cameras.main;
    const countText = this.add.text(width / 2, 80, `COMBO ${this.comboAttackCount}/${this.maxComboAttacks}`, {
      fontSize: '24px',
      fill: '#ffaa00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(5000);

    this.tweens.add({
      targets: countText,
      alpha: 0,
      y: 60,
      duration: 500,
      delay: 500,
      onComplete: () => countText.destroy()
    });

    // 점프 스케어 실행 (콤보 모드)
    this.executeJumpScare(true);
  }

  // 🆕 콤보 공격 다음 단계
  continueComboOrEnd() {
    if (this.comboAttackCount < this.maxComboAttacks) {
      // 다음 콤보까지 짧은 대기
      this.time.delayedCall(400, () => {
        if (!this.gameOver) {
          this.executeComboAttack();
        }
      });
    } else {
      // 콤보 완료 - 스토킹으로 복귀
      this.comboAttackActive = false;
      this.comboAttackCount = 0;

      // 콤보 완료 효과
      this.showComboEndEffect();

      this.time.delayedCall(800, () => {
        if (!this.gameOver) {
          this.stalkingIntensity = 30;
          this.startStalkingPhase();
        }
      });
    }
  }

  // 🆕 콤보 완료 효과
  showComboEndEffect() {
    const { width, height } = this.cameras.main;

    const endText = this.add.text(width / 2, height / 2, 'SURVIVED!', {
      fontSize: '28px',
      fill: '#00ff00',
      fontStyle: 'bold',
      stroke: '#003300',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    this.tweens.add({
      targets: endText,
      alpha: 1,
      scaleX: { from: 0.5, to: 1 },
      scaleY: { from: 0.5, to: 1 },
      duration: 200,
      onComplete: () => {
        this.tweens.add({
          targets: endText,
          alpha: 0,
          duration: 400,
          delay: 500,
          onComplete: () => endText.destroy()
        });
      }
    });
  }

  // 🆕 가짜 등장 (놀래키고 사라짐)
  executeFakeOut() {
    const head = this.snake[0];
    const { width, height } = this.cameras.main;

    // 뱀 바로 앞에 갑자기 보스 얼굴 등장
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 방향에 따라 앞쪽 위치 계산
    let fakeX = headX;
    let fakeY = headY;
    const offset = this.gridSize * 3;

    switch (this.direction) {
      case 'UP': fakeY -= offset; break;
      case 'DOWN': fakeY += offset; break;
      case 'LEFT': fakeX -= offset; break;
      case 'RIGHT': fakeX += offset; break;
    }

    // 갑자기 나타나는 보스 얼굴
    const fakeFace = this.createScaryFace(fakeX, fakeY);

    // 화면 플래시
    const flash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.4)
      .setOrigin(0, 0)
      .setDepth(4000);

    // 카메라 흔들기
    this.cameras.main.shake(200, 0.03);

    // 빠르게 사라짐
    this.time.delayedCall(200, () => {
      this.tweens.add({
        targets: [fakeFace, flash],
        alpha: 0,
        duration: 150,
        onComplete: () => {
          fakeFace.destroy();
          flash.destroy();

          // 긴장도 약간 낮추기 (안심 효과)
          this.stalkingIntensity = Math.max(this.stalkingIntensity - 15, 50);

          // 다시 스토킹
          this.scheduleStalkingEyes();
        }
      });
    });
  }

  // 🆕 진짜 점프 스케어 공격! (HIT 수에 따라 더 빠르고 공격적)
  executeJumpScare(isCombo = false) {
    if (this.jumpScareActive || this.gameOver) return;

    this.jumpScareActive = true;
    this.stalkingActive = false;

    const head = this.snake[0];
    const { width, height } = this.cameras.main;
    const hitCount = this.fogBossHitCount;

    // 뱀 바로 앞에 보스 등장
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // HIT 수에 따라 더 가까이 나타남 (더 빠른 반응 필요)
    const offsetMultiplier = Math.max(1.5, 2.5 - hitCount * 0.3);
    const offset = this.gridSize * offsetMultiplier;

    // 방향에 따라 앞쪽 위치
    let jumpX = headX;
    let jumpY = headY;

    switch (this.direction) {
      case 'UP': jumpY -= offset; break;
      case 'DOWN': jumpY += offset; break;
      case 'LEFT': jumpX -= offset; break;
      case 'RIGHT': jumpX += offset; break;
    }

    // HIT 3 (Rage Mode): 가끔 옆에서 등장 (예측 불가)
    if (hitCount >= 3 && Math.random() < 0.4) {
      const sideDirection = Math.random() < 0.5 ? 'left' : 'right';
      if (this.direction === 'UP' || this.direction === 'DOWN') {
        jumpX = headX + (sideDirection === 'left' ? -offset : offset);
        jumpY = headY;
      } else {
        jumpX = headX;
        jumpY = headY + (sideDirection === 'left' ? -offset : offset);
      }
    }

    // 무서운 얼굴 생성 (HIT 수에 따라 더 크게)
    const scaryFace = this.createScaryFace(jumpX, jumpY);
    const initialScale = 0.4 + hitCount * 0.15;
    scaryFace.setScale(initialScale);

    // 콤보 모드에서는 더 빠른 연출
    const freezeTime = isCombo ? 150 : 300;
    const flashDuration = isCombo ? 100 : 200;

    // 화면 정지 효과를 위해 게임 일시정지
    this.moveTimer.paused = true;

    // 강력한 화면 플래시 (HIT 수에 따라 색상 변화)
    const flashColor = hitCount >= 3 ? 0xff0000 : 0xffffff;
    const flashAlpha = 0.6 + hitCount * 0.1;
    const flash = this.add.rectangle(0, 0, width, height, flashColor, flashAlpha)
      .setOrigin(0, 0)
      .setDepth(4500);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: flashDuration,
      onComplete: () => flash.destroy()
    });

    // 보스 확대 + 비명 (HIT 수에 따라 더 빠르게)
    const scaleUpDuration = Math.max(80, 150 - hitCount * 20);
    const finalScale = 1.8 + hitCount * 0.3;
    this.tweens.add({
      targets: scaryFace,
      scaleX: finalScale,
      scaleY: finalScale,
      duration: scaleUpDuration,
      ease: 'Back.easeOut'
    });

    // HIT 수에 따른 비명 텍스트 변화
    const screams = ['RAAAGH!!!', 'RAAAGHH!!!!', 'DIE!!!!', 'NO ESCAPE!!!'];
    const screamText = this.add.text(width / 2, height / 2 - 100, screams[hitCount] || screams[0], {
      fontSize: `${56 + hitCount * 8}px`,
      fill: hitCount >= 3 ? '#ffff00' : '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5000).setScale(0);

    this.tweens.add({
      targets: screamText,
      scaleX: 1.2 + hitCount * 0.1,
      scaleY: 1.2 + hitCount * 0.1,
      duration: 100
    });

    // 카메라 흔들림 (HIT 수에 따라 더 강하게)
    const shakeIntensity = 0.04 + hitCount * 0.015;
    this.cameras.main.shake(400 + hitCount * 50, shakeIntensity);

    // HIT 3 : 추가 효과 - 화면 왜곡
    if (hitCount >= 3) {
      this.tweens.add({
        targets: this.cameras.main,
        zoom: { from: 1.1, to: 1 },
        duration: 200
      });
    }

    // 화면 정지 후 돌진 (HIT 많을수록 빨리)
    this.time.delayedCall(freezeTime, () => {
      // 화면 정지 해제
      this.moveTimer.paused = false;

      // 뱀의 현재 위치를 타겟으로 저장
      this.shadowStrikeTargetPos = { x: this.snake[0].x, y: this.snake[0].y };

      // 보스 실제 위치 업데이트
      const jumpTileX = Math.floor(jumpX / this.gridSize);
      const jumpTileY = Math.floor((jumpY - this.gameAreaY) / this.gridSize);
      this.fogBossPosition = { x: jumpTileX, y: jumpTileY };

      // 무서운 얼굴 제거하고 실제 보스로 교체
      scaryFace.destroy();
      screamText.destroy();

      // 보스 보이게
      this.fogBossVisible = true;
      if (this.fogBossElement) {
        this.fogBossElement.setPosition(jumpX, jumpY);
        this.fogBossElement.setAlpha(1);
      }

      // 🆕 "DODGE NOW!" 경고 표시 (명확한 회피 타이밍)
      this.showDodgeWarning();

      // 돌진 실행 (콤보 모드 전달)
      this.executeShadowStrikeDash(isCombo);
    });
  }

  // 🆕 무서운 얼굴 생성
  createScaryFace(x, y) {
    const face = this.add.container(x, y).setDepth(4000).setAlpha(1);

    // 어두운 얼굴 베이스
    const faceBase = this.add.circle(0, 0, 40, 0x0a0005, 0.9);
    face.add(faceBase);

    // 크고 무서운 눈 3개
    const eyes = [
      { x: -20, y: -10, size: 12 },
      { x: 20, y: -10, size: 12 },
      { x: 0, y: 5, size: 8 }
    ];

    eyes.forEach(eyeData => {
      const eyeGlow = this.add.circle(eyeData.x, eyeData.y, eyeData.size + 5, 0xff0000, 0.5);
      const eyeball = this.add.circle(eyeData.x, eyeData.y, eyeData.size, 0xffff00, 1);
      const iris = this.add.circle(eyeData.x, eyeData.y, eyeData.size * 0.6, 0xff0000, 1);
      const pupil = this.add.ellipse(eyeData.x, eyeData.y, eyeData.size * 0.3, eyeData.size * 0.8, 0x000000, 1);
      face.add([eyeGlow, eyeball, iris, pupil]);
    });

    // 찢어진 입
    const mouth = this.add.ellipse(0, 25, 30, 15, 0x000000, 1);
    face.add(mouth);

    // 이빨
    for (let i = 0; i < 7; i++) {
      const toothX = -12 + i * 4;
      const tooth = this.add.triangle(toothX, 20, 0, 0, 3, 10, -3, 10, 0xccccaa, 1);
      face.add(tooth);
    }

    return face;
  }

  // 🆕 "DODGE NOW!" 경고 표시
  showDodgeWarning() {
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 뱀 위에 큰 경고 텍스트
    const dodgeText = this.add.text(headX, headY - 50, '⚠️ DODGE! [SPACE] ⚠️', {
      fontSize: '28px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#ff0000',
      strokeThickness: 4,
      backgroundColor: '#000000aa',
      padding: { x: 10, y: 5 }
    }).setOrigin(0.5).setDepth(6000);

    // 깜빡임 효과
    this.tweens.add({
      targets: dodgeText,
      alpha: { from: 1, to: 0.3 },
      scaleX: { from: 1, to: 1.1 },
      scaleY: { from: 1, to: 1.1 },
      duration: 100,
      yoyo: true,
      repeat: 3,
      onComplete: () => dodgeText.destroy()
    });

    // 화면 가장자리 노란 플래시 (위험 표시)
    const { width, height } = this.cameras.main;
    const warningBorder = this.add.graphics().setDepth(5500);
    warningBorder.lineStyle(8, 0xffff00, 0.8);
    warningBorder.strokeRect(0, 0, width, height);

    this.tweens.add({
      targets: warningBorder,
      alpha: 0,
      duration: 500,
      onComplete: () => warningBorder.destroy()
    });
  }

  // 🆕 Shadow Strike 돌진 (점프 스케어 후 - HIT 수에 따라 더 빠름)
  executeShadowStrikeDash(isCombo = false) {
    if (!this.shadowStrikeTargetPos) {
      this.jumpScareActive = false;
      if (isCombo) {
        this.continueComboOrEnd();
      } else {
        this.startStalkingPhase();
      }
      return;
    }

    const targetX = this.shadowStrikeTargetPos.x * this.gridSize + this.gridSize / 2;
    const targetY = this.shadowStrikeTargetPos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
    const hitCount = this.fogBossHitCount;

    // 회피 가능 윈도우 시작
    this.canDodgeBoss = true;

    // HIT 수에 따라 돌진 속도 증가 (더 빠르게)
    const dashDuration = Math.max(100, 200 - hitCount * 30);

    // 보스 돌진
    this.tweens.add({
      targets: this.fogBossElement,
      x: targetX,
      y: targetY,
      duration: dashDuration,
      ease: 'Power3.easeIn',
      onComplete: () => {
        this.canDodgeBoss = false;

        // 충돌 체크
        const head = this.snake[0];
        const dist = Math.abs(head.x - this.shadowStrikeTargetPos.x) + Math.abs(head.y - this.shadowStrikeTargetPos.y);

        if (dist <= 1 && !this.isInvincible) {
          // 회피 실패 - 게임 오버
          this.comboAttackActive = false;
          this.handleFogBossKill();
        } else {
          // 회피 성공
          const recoveryTime = isCombo ? 300 : 500;
          this.time.delayedCall(recoveryTime, () => {
            this.fogBossVisible = false;
            this.jumpScareActive = false;

            if (this.fogBossElement) {
              this.tweens.add({
                targets: this.fogBossElement,
                alpha: 0,
                duration: 200
              });
            }

            // 콤보 모드면 다음 콤보 또는 종료
            if (isCombo) {
              this.continueComboOrEnd();
            } else {
              // 긴장도 리셋하고 다시 스토킹
              this.stalkingIntensity = 30;
              this.startStalkingPhase();
            }
          });
        }
      }
    });

    // 보스 위치 업데이트
    this.fogBossPosition = { ...this.shadowStrikeTargetPos };
  }

  // 🆕 스토킹 시스템 정리
  cleanupStalkingSystem() {
    this.stalkingActive = false;
    this.jumpScareActive = false;
    this.stalkingIntensity = 0;
    this.comboAttackActive = false;
    this.comboAttackCount = 0;

    if (this.stalkingTimer) {
      this.stalkingTimer.destroy();
      this.stalkingTimer = null;
    }
    if (this.tensionBuildupTimer) {
      this.tensionBuildupTimer.destroy();
      this.tensionBuildupTimer = null;
    }
    if (this.heartbeatTimer) {
      this.heartbeatTimer.destroy();
      this.heartbeatTimer = null;
    }
    if (this.rageFlickerTimer) {
      this.rageFlickerTimer.destroy();
      this.rageFlickerTimer = null;
    }
    if (this.rageGlitchTimer) {
      this.rageGlitchTimer.destroy();
      this.rageGlitchTimer = null;
    }
    if (this.vignetteOverlay) {
      this.vignetteOverlay.destroy();
      this.vignetteOverlay = null;
    }
    if (this.stalkingEyes) {
      this.stalkingEyes.destroy();
      this.stalkingEyes = null;
    }

    // Rage Mode 정리
    this.rageModeActive = false;
  }

  // Shadow Strike 경고
  showShadowStrikeWarning() {
    if (this.fogBossPhase !== 'shadow') return;
    if (this.gameOver) return;

    this.shadowStrikeWarningActive = true;

    // 뱀의 현재 위치를 타겟으로 저장
    const head = this.snake[0];
    this.shadowStrikeTargetPos = { x: head.x, y: head.y };

    // 보스를 타겟 근처로 이동
    this.teleportFogBoss(head.x + Phaser.Math.Between(-5, 5), head.y + Phaser.Math.Between(-5, 5));

    // 빨간 눈 경고
    const bossX = this.fogBossPosition.x * this.gridSize + this.gridSize / 2;
    const bossY = this.fogBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 경고 눈
    const warningEyes = this.add.container(bossX, bossY).setDepth(160);
    const leftEye = this.add.circle(-10, 0, 6, 0xff0000, 0);
    const rightEye = this.add.circle(10, 0, 6, 0xff0000, 0);
    warningEyes.add([leftEye, rightEye]);

    // 눈 페이드인 + 빠른 펄스
    this.tweens.add({
      targets: [leftEye, rightEye],
      alpha: 1,
      duration: 200
    });

    this.tweens.add({
      targets: warningEyes,
      scaleX: { from: 1, to: 1.5 },
      scaleY: { from: 1, to: 1.5 },
      duration: 150,
      yoyo: true,
      repeat: 5
    });

    // 뱀 머리 위에 "!" 표시
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;
    const warningIcon = this.add.text(headX, headY - 25, '!', {
      fontSize: '24px',
      fill: '#ff0000',
      fontStyle: 'bold'
    }).setOrigin(0.5).setDepth(200);

    this.tweens.add({
      targets: warningIcon,
      scaleX: { from: 1, to: 1.3 },
      scaleY: { from: 1, to: 1.3 },
      duration: 100,
      yoyo: true,
      repeat: 5
    });

    // 경고 시간 후 공격
    this.time.delayedCall(this.shadowStrikeWarningTime, () => {
      warningEyes.destroy();
      warningIcon.destroy();
      this.executeShadowStrike();
    });
  }

  // Shadow Strike 실행 - 🆕 QTE 시스템으로 변경 (GOT YOU! 제거)
  executeShadowStrike() {
    if (this.fogBossPhase !== 'shadow') return;
    if (!this.shadowStrikeTargetPos) return;

    // 🆕 QTE 시스템으로 연결 (위치 기반 즉사 제거!)
    // The Presence 시스템의 QTE 닷지 사용
    this.executePresenceDash('shadow');
  }

  // 보스에게 죽음
  handleFogBossKill() {
    this.gameOver = true;
    this.moveTimer.paused = true;

    const { width, height } = this.cameras.main;

    // 화면 빨간 플래시
    const flash = this.add.rectangle(0, 0, width, height, 0xff0000, 0.5)
      .setOrigin(0, 0)
      .setDepth(5000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 500
    });

    // 보스 웃음
    this.showFogBossScream('GOT YOU!');

    // 게임 오버 처리
    this.time.delayedCall(1500, () => {
      this.cleanupFogBoss();
      this.showGameOverScreen();
    });
  }

  // 보스 텔레포트
  teleportFogBoss(targetX, targetY) {
    // 경계 체크
    targetX = Phaser.Math.Clamp(targetX, 2, this.cols - 3);
    targetY = Phaser.Math.Clamp(targetY, 2, this.rows - 3);

    this.fogBossPosition = { x: targetX, y: targetY };

    // 보스 요소 위치 업데이트
    if (this.fogBossElement) {
      this.fogBossElement.x = targetX * this.gridSize + this.gridSize / 2;
      this.fogBossElement.y = targetY * this.gridSize + this.gridSize / 2 + this.gameAreaY;
    }
  }

  // 보스 히트 처리
  handleFogBossHit() {
    this.fogBossHitCount++;

    const { width, height } = this.cameras.main;

    // 히트 효과 (테스트용: 1 HIT 클리어, 원래는 4)
    const hitText = this.add.text(width / 2, height / 2, `HIT ${this.fogBossHitCount}/1!`, {
      fontSize: '48px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#ff0000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000).setScale(0);

    this.tweens.add({
      targets: hitText,
      scaleX: 1,
      scaleY: 1,
      duration: 300,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: hitText,
      alpha: 0,
      y: height / 2 - 50,
      duration: 600,
      delay: 600,
      onComplete: () => hitText.destroy()
    });

    // 카메라 효과
    this.cameras.main.shake(300, 0.02);

    // 다음 페이즈 체크 - 테스트: 1회 HIT으로 클리어 (원래는 4)
    if (this.fogBossHitCount >= 1) {
      this.handleFogBossFinalHit();
    } else {
      // 보스 텔레포트 후 계속 Shadow Strike
      this.time.delayedCall(1500, () => {
        // 새 위치로 텔레포트
        const newX = Phaser.Math.Between(5, this.cols - 6);
        const newY = Phaser.Math.Between(5, this.rows - 6);
        this.teleportFogBoss(newX, newY);

        // 보스 숨기기
        this.fogBossVisible = false;
        if (this.fogBossElement) {
          this.tweens.add({
            targets: this.fogBossElement,
            alpha: 0,
            duration: 300
          });
        }

        // 다음 공격 예약 (더 빠르게)
        const delay = Phaser.Math.Between(
          this.shadowStrikeInterval[0] - this.fogBossHitCount * 300,
          this.shadowStrikeInterval[1] - this.fogBossHitCount * 300
        );
        this.shadowStrikeTimer = this.time.delayedCall(Math.max(delay, 1500), () => {
          this.showShadowStrikeWarning();
        });
      });
    }
  }

  // Hallucination 페이즈 시작
  startHallucinationPhase() {
    this.fogBossPhase = 'hallucination';

    // 타이머 정리
    if (this.shadowStrikeTimer) {
      this.shadowStrikeTimer.destroy();
    }

    // 보스 대사
    const { width, height } = this.cameras.main;
    const dialogue = this.add.text(width / 2, height / 2, 'Can you find the truth in darkness?', {
      fontSize: '24px',
      fill: '#9900ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    this.tweens.add({
      targets: dialogue,
      alpha: 1,
      duration: 300
    });

    this.tweens.add({
      targets: dialogue,
      alpha: 0,
      duration: 300,
      delay: 2000,
      onComplete: () => dialogue.destroy()
    });

    // 화면 왜곡 효과
    this.cameras.main.shake(500, 0.008);

    // 환각 먹이 생성
    this.time.delayedCall(2500, () => {
      this.spawnHallucinationFood();
    });
  }

  // 환각 먹이 생성
  spawnHallucinationFood() {
    this.hallucinationFoods = [];

    // 5개 위치 생성
    const positions = [];
    for (let i = 0; i < 5; i++) {
      let pos;
      let valid = false;
      let attempts = 0;

      while (!valid && attempts < 50) {
        pos = {
          x: Phaser.Math.Between(5, this.cols - 6),
          y: Phaser.Math.Between(5, this.rows - 6)
        };

        valid = true;
        // 뱀과 거리 체크
        for (const segment of this.snake) {
          if (Math.abs(segment.x - pos.x) < 3 && Math.abs(segment.y - pos.y) < 3) {
            valid = false;
            break;
          }
        }
        // 다른 위치와 거리 체크
        for (const p of positions) {
          if (Math.abs(p.x - pos.x) < 4 && Math.abs(p.y - pos.y) < 4) {
            valid = false;
            break;
          }
        }
        attempts++;
      }

      if (valid) {
        positions.push(pos);
      }
    }

    // 진짜 먹이 인덱스 (랜덤)
    this.realFoodIndex = Phaser.Math.Between(0, positions.length - 1);

    // 먹이 생성
    positions.forEach((pos, index) => {
      const isReal = index === this.realFoodIndex;
      const pixelX = pos.x * this.gridSize + this.gridSize / 2;
      const pixelY = pos.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

      const container = this.add.container(pixelX, pixelY).setDepth(110);

      // 먹이 기본 모양 (빨간 사각형)
      const food = this.add.rectangle(0, 0, this.gridSize - 2, this.gridSize - 2, 0xff0000)
        .setStrokeStyle(1, 0xff6666);
      container.add(food);

      // 진짜 먹이는 미묘한 따뜻한 파티클 (조명탄 사용 시 노출)
      if (isReal) {
        const warmGlow = this.add.circle(0, 0, 12, 0xffaa00, 0);
        container.add(warmGlow);

        // 조명탄 활성화 시 노출
        this.time.addEvent({
          delay: 100,
          callback: () => {
            if (this.flareActive) {
              warmGlow.setAlpha(0.4);
              food.setFillStyle(0xff6600); // 더 따뜻한 색
            } else {
              warmGlow.setAlpha(0);
              food.setFillStyle(0xff0000);
            }
          },
          loop: true
        });
      } else {
        // 가짜 먹이는 미묘한 쉬머 (조명탄 사용 시 보라색 틴트)
        this.time.addEvent({
          delay: 100,
          callback: () => {
            if (this.flareActive) {
              food.setFillStyle(0x9900ff); // 보라색 틴트
            } else {
              food.setFillStyle(0xff0000);
            }
          },
          loop: true
        });
      }

      // 펄스 애니메이션
      this.tweens.add({
        targets: container,
        scaleX: { from: 1, to: 1.1 },
        scaleY: { from: 1, to: 1.1 },
        duration: 500,
        yoyo: true,
        repeat: -1
      });

      this.hallucinationFoods.push({
        x: pos.x,
        y: pos.y,
        container: container,
        isReal: isReal
      });
    });
  }

  // 환각 먹이 먹기 처리
  handleHallucinationFood(food) {
    if (food.isReal) {
      // 진짜 먹이 - 보스 히트
      food.container.destroy();
      const index = this.hallucinationFoods.indexOf(food);
      if (index > -1) {
        this.hallucinationFoods.splice(index, 1);
      }

      // 나머지 가짜 먹이 폭발
      this.hallucinationFoods.forEach(fake => {
        const explosionX = fake.x * this.gridSize + this.gridSize / 2;
        const explosionY = fake.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

        // 폭발 효과
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const particle = this.add.circle(explosionX, explosionY, 4, 0x9900ff, 1).setDepth(200);

          this.tweens.add({
            targets: particle,
            x: explosionX + Math.cos(angle) * 40,
            y: explosionY + Math.sin(angle) * 40,
            alpha: 0,
            duration: 400,
            onComplete: () => particle.destroy()
          });
        }

        fake.container.destroy();
      });
      this.hallucinationFoods = [];

      // 히트 처리
      this.handleFogBossHit();
    } else {
      // 가짜 먹이 - 게임 오버
      const { width, height } = this.cameras.main;

      // "IT WAS A TRAP!" 메시지
      const trapText = this.add.text(width / 2, height / 2, 'IT WAS A TRAP!', {
        fontSize: '36px',
        fill: '#ff0000',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(5000).setScale(0);

      this.tweens.add({
        targets: trapText,
        scaleX: 1.2,
        scaleY: 1.2,
        duration: 300,
        ease: 'Back.easeOut'
      });

      // 보스 웃음
      this.showFogBossScream('FOOLISH SNAKE!');

      // 게임 오버
      this.handleFogBossKill();
    }
  }

  // Eclipse 페이즈 시작
  startEclipsePhase() {
    this.fogBossPhase = 'eclipse';
    this.eclipseActive = true;

    const { width, height } = this.cameras.main;

    // 보스 대사
    const dialogue = this.add.text(width / 2, height / 2, 'EMBRACE THE VOID!', {
      fontSize: '32px',
      fill: '#9900ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    this.tweens.add({
      targets: dialogue,
      alpha: 1,
      scaleX: { from: 0.5, to: 1.2 },
      scaleY: { from: 0.5, to: 1.2 },
      duration: 500,
      ease: 'Power2'
    });

    this.tweens.add({
      targets: dialogue,
      alpha: 0,
      duration: 300,
      delay: 1500,
      onComplete: () => dialogue.destroy()
    });

    // 시야 극도로 축소
    this.time.delayedCall(2000, () => {
      this.fogVisibleTiles = this.eclipseVisibility;

      // 빛 오브 생성
      this.spawnLightOrb();

      // Shadow Strike 계속 (더 빈번하게)
      this.shadowStrikeInterval = [2000, 3500];
      this.startShadowStrikePhase();
    });
  }

  // 빛 오브 생성
  spawnLightOrb() {
    // 맵 중앙 근처에 생성
    const orbX = Math.floor(this.cols / 2) + Phaser.Math.Between(-3, 3);
    const orbY = Math.floor(this.rows / 2) + Phaser.Math.Between(-3, 3);

    const pixelX = orbX * this.gridSize + this.gridSize / 2;
    const pixelY = orbY * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 오브 컨테이너
    const container = this.add.container(pixelX, pixelY).setDepth(130);

    // 외곽 글로우 (희미하게)
    const outerGlow = this.add.circle(0, 0, 20, 0xffffff, 0.1);
    // 중간 글로우
    const midGlow = this.add.circle(0, 0, 12, 0xffffaa, 0.2);
    // 코어
    const core = this.add.circle(0, 0, 6, 0xffffff, 0.6);

    container.add([outerGlow, midGlow, core]);

    // 펄스 애니메이션
    this.tweens.add({
      targets: outerGlow,
      alpha: { from: 0.1, to: 0.3 },
      scaleX: { from: 1, to: 1.5 },
      scaleY: { from: 1, to: 1.5 },
      duration: 1000,
      yoyo: true,
      repeat: -1
    });

    this.tweens.add({
      targets: core,
      alpha: { from: 0.6, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    this.lightOrb = {
      x: orbX,
      y: orbY,
      container: container
    };
  }

  // 빛 오브 수집
  collectLightOrb() {
    if (!this.lightOrb) return;

    const { width, height } = this.cameras.main;

    // 오브 파괴
    this.lightOrb.container.destroy();

    // 거대한 빛 폭발
    const head = this.snake[0];
    const headX = head.x * this.gridSize + this.gridSize / 2;
    const headY = head.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

    // 화면 플래시
    const flash = this.add.rectangle(0, 0, width, height, 0xffffff, 1)
      .setOrigin(0, 0)
      .setDepth(5000);

    this.tweens.add({
      targets: flash,
      alpha: 0,
      duration: 1000,
      onComplete: () => flash.destroy()
    });

    // 시야 완전 복원
    this.fogVisibleTiles = 6;
    this.eclipseActive = false;

    // 빛 파동
    this.createLightWave(headX, headY);

    // "NOW! STRIKE!" 프롬프트
    const strikeText = this.add.text(width / 2, height / 2 - 100, 'NOW! STRIKE!', {
      fontSize: '36px',
      fill: '#ffff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5001);

    this.tweens.add({
      targets: strikeText,
      scaleX: { from: 0.5, to: 1.2 },
      scaleY: { from: 0.5, to: 1.2 },
      duration: 300,
      ease: 'Back.easeOut'
    });

    this.tweens.add({
      targets: strikeText,
      alpha: 0,
      duration: 300,
      delay: 1500,
      onComplete: () => strikeText.destroy()
    });

    // 보스 완전 노출
    this.fogBossVisible = true;
    if (this.fogBossElement) {
      this.fogBossElement.setAlpha(1);
    }

    // Shadow Strike 타이머 정지
    if (this.shadowStrikeTimer) {
      this.shadowStrikeTimer.destroy();
    }

    // 보스 vulnerable 상태
    this.fogBossPhase = 'vulnerable';
    this.lightOrb = null;
  }

  // 최종 히트 처리
  handleFogBossFinalHit() {
    this.fogBossPhase = 'victory';
    this.moveTimer.paused = true;

    const { width, height } = this.cameras.main;

    // 슬로우 모션
    this.time.timeScale = 0.3;

    // 카메라 줌
    this.cameras.main.zoomTo(1.5, 500);

    // 보스 비명
    const screamText = this.add.text(width / 2, height / 2, 'NO! THE LIGHT... IT BURNS!', {
      fontSize: '28px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000).setScale(0);

    this.tweens.add({
      targets: screamText,
      scaleX: 1.2,
      scaleY: 1.2,
      duration: 500,
      ease: 'Back.easeOut'
    });

    // 보스 분해 효과
    this.time.delayedCall(1500, () => {
      this.time.timeScale = 1;
      this.cameras.main.zoomTo(1, 500);

      // 보스 파티클 분해
      if (this.fogBossElement) {
        const bossX = this.fogBossElement.x;
        const bossY = this.fogBossElement.y;

        for (let i = 0; i < 40; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 50 + Math.random() * 100;
          const particle = this.add.circle(bossX, bossY, 3 + Math.random() * 4, 0x330033, 1)
            .setDepth(200);

          this.tweens.add({
            targets: particle,
            x: bossX + Math.cos(angle) * speed,
            y: bossY + Math.sin(angle) * speed,
            alpha: 0,
            scale: 0,
            duration: 800 + Math.random() * 400,
            onComplete: () => particle.destroy()
          });
        }

        this.fogBossElement.destroy();
        this.fogBossElement = null;
      }

      screamText.destroy();

      // 승리 시퀀스
      this.time.delayedCall(1000, () => {
        this.showFogBossVictory();
      });
    });
  }

  // 승리 시퀀스 (Dawn Breaking) - 드라마틱 버전
  showFogBossVictory() {
    const { width, height } = this.cameras.main;
    const victoryElements = [];

    // ====== PHASE 1: 보스의 고통스러운 죽음 ======

    // 1-1. 화면 떨림 시작
    this.cameras.main.shake(1500, 0.02);

    // 1-2. 보스 비명 (이미 있으면 스킵)
    const bossScream = this.add.text(width / 2, height / 2 - 80, 'NOOOO...!', {
      fontSize: '32px',
      fill: '#ff0000',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5100).setAlpha(0);
    victoryElements.push(bossScream);

    this.tweens.add({
      targets: bossScream,
      alpha: 1,
      scaleX: { from: 0.5, to: 1.3 },
      scaleY: { from: 0.5, to: 1.3 },
      duration: 300,
      onComplete: () => {
        this.tweens.add({
          targets: bossScream,
          alpha: 0,
          y: height / 2 - 120,
          duration: 800
        });
      }
    });

    // 1-3. 보스 분해 파티클 (보스가 부서지는 효과)
    if (this.fogBossElement && this.fogBossPosition) {
      const bossX = this.fogBossPosition.x * this.gridSize + this.gridSize / 2;
      const bossY = this.fogBossPosition.y * this.gridSize + this.gridSize / 2 + this.gameAreaY;

      // 보스 조각들이 흩어짐
      for (let i = 0; i < 30; i++) {
        const shard = this.add.polygon(
          bossX + Phaser.Math.Between(-20, 20),
          bossY + Phaser.Math.Between(-20, 20),
          [0, 0, 8, 3, 6, 10, -2, 8],
          0x220011,
          0.9
        ).setDepth(5050);

        this.tweens.add({
          targets: shard,
          x: shard.x + Phaser.Math.Between(-200, 200),
          y: shard.y + Phaser.Math.Between(-200, 200),
          angle: Phaser.Math.Between(-360, 360),
          alpha: 0,
          scaleX: 0.1,
          scaleY: 0.1,
          duration: 1500,
          delay: i * 30,
          ease: 'Power2.easeOut',
          onComplete: () => shard.destroy()
        });
      }

      // 보스 눈 튀어나가는 효과 (3개)
      for (let i = 0; i < 3; i++) {
        const eyeShard = this.add.circle(
          bossX + Phaser.Math.Between(-15, 15),
          bossY + Phaser.Math.Between(-10, 10),
          6 - i,
          0xcccc00,
          1
        ).setDepth(5060);

        this.tweens.add({
          targets: eyeShard,
          x: eyeShard.x + Phaser.Math.Between(-300, 300),
          y: eyeShard.y + Phaser.Math.Between(-300, 300),
          alpha: 0,
          duration: 1200,
          delay: 200 + i * 100,
          ease: 'Power3.easeOut',
          onComplete: () => eyeShard.destroy()
        });
      }
    }

    // ====== PHASE 2: 안개 산산이 부서짐 ======
    this.time.delayedCall(800, () => {
      // 2-1. 안개 비활성화
      this.fogEnabled = false;
      this.fogTestForceEnable = false;

      // 2-2. 안개 파편 생성 (안개가 유리처럼 깨지는 효과)
      const shardCount = 50;
      for (let i = 0; i < shardCount; i++) {
        const shardX = Phaser.Math.Between(0, width);
        const shardY = Phaser.Math.Between(this.gameAreaY, height);
        const shardSize = Phaser.Math.Between(15, 40);

        // 불규칙한 다각형 파편
        const points = [];
        const sides = Phaser.Math.Between(4, 7);
        for (let j = 0; j < sides; j++) {
          const angle = (j / sides) * Math.PI * 2;
          const dist = shardSize * (0.5 + Math.random() * 0.5);
          points.push(Math.cos(angle) * dist, Math.sin(angle) * dist);
        }

        const fogShard = this.add.polygon(shardX, shardY, points, 0x111122, 0.7)
          .setDepth(4900);

        // 균열선 추가
        const crackLine = this.add.line(
          shardX, shardY,
          0, 0,
          Phaser.Math.Between(-10, 10),
          Phaser.Math.Between(-10, 10),
          0x333355, 0.5
        ).setDepth(4901);

        // 파편이 날아가며 사라짐
        const targetAngle = Math.atan2(shardY - height / 2, shardX - width / 2);
        const distance = 300 + Math.random() * 200;

        this.tweens.add({
          targets: [fogShard, crackLine],
          x: shardX + Math.cos(targetAngle) * distance,
          y: shardY + Math.sin(targetAngle) * distance,
          angle: Phaser.Math.Between(-180, 180),
          alpha: 0,
          scaleX: 0.3,
          scaleY: 0.3,
          duration: 1500,
          delay: i * 20,
          ease: 'Power2.easeOut',
          onComplete: () => {
            fogShard.destroy();
            crackLine.destroy();
          }
        });
      }

      // 2-3. 안개 텍스처도 제거
      if (this.fogRenderTexture) {
        this.tweens.add({
          targets: this.fogRenderTexture,
          alpha: 0,
          duration: 500
        });
      }

      // 깨지는 유리 소리 효과 (카메라 쉐이크)
      this.cameras.main.shake(300, 0.03);
    });

    // ====== PHASE 3: DOM + 화면 밝아짐 ======
    this.time.delayedCall(1500, () => {
      // 3-1. DOM 브라우저 배경 밝아짐
      try {
        document.body.style.transition = 'background 2s ease';
        document.body.style.background = 'linear-gradient(135deg, #87CEEB 0%, #FFD700 50%, #FFA500 100%)';
      } catch (e) {}

      // 3-2. 게임 화면 밝은 오버레이
      const dawnOverlay = this.add.rectangle(0, 0, width, height, 0xffeedd, 0)
        .setOrigin(0, 0)
        .setDepth(5000);
      victoryElements.push(dawnOverlay);

      this.tweens.add({
        targets: dawnOverlay,
        alpha: 0.6,
        duration: 1500,
        ease: 'Power2.easeIn'
      });

      // 3-3. 태양 광선 (아래에서 퍼져나옴)
      for (let i = 0; i < 16; i++) {
        const angle = (i / 16) * Math.PI - Math.PI / 2; // 위쪽에서 시작
        const ray = this.add.rectangle(
          width / 2,
          height + 50,
          600,
          4 + Math.random() * 4,
          0xffffaa,
          0
        ).setOrigin(0, 0.5).setRotation(angle).setDepth(4998);

        victoryElements.push(ray); // 🆕 정리 목록에 추가

        this.tweens.add({
          targets: ray,
          alpha: { from: 0, to: 0.4 + Math.random() * 0.3 },
          scaleX: { from: 0.5, to: 1.5 },
          duration: 1000,
          delay: i * 50,
          ease: 'Power2.easeOut'
        });
      }

      // 3-4. 아름다운 태양 등장 (그라데이션 효과)
      const sunContainer = this.add.container(width / 2, height + 100).setDepth(4999);
      victoryElements.push(sunContainer);

      // 외부 코로나 글로우 (가장 바깥, 흐릿하고 큰)
      const corona4 = this.add.circle(0, 0, 180, 0xffff88, 0.08);
      const corona3 = this.add.circle(0, 0, 150, 0xffffaa, 0.12);
      const corona2 = this.add.circle(0, 0, 120, 0xffdd66, 0.18);
      const corona1 = this.add.circle(0, 0, 100, 0xffcc44, 0.25);
      sunContainer.add([corona4, corona3, corona2, corona1]);

      // 태양 본체 (그라데이션 - 여러 겹)
      const sunOuter = this.add.circle(0, 0, 80, 0xffaa00, 1);      // 주황
      const sunMid = this.add.circle(0, 0, 60, 0xffcc33, 1);        // 밝은 주황
      const sunInner = this.add.circle(0, 0, 40, 0xffdd66, 1);      // 노란 주황
      const sunCore = this.add.circle(0, 0, 25, 0xffeeaa, 1);       // 밝은 노랑
      const sunHot = this.add.circle(0, 0, 12, 0xffffff, 0.8);      // 흰색 중심
      sunContainer.add([sunOuter, sunMid, sunInner, sunCore, sunHot]);

      // 코로나 펄스 애니메이션
      [corona4, corona3, corona2, corona1].forEach((corona, i) => {
        this.tweens.add({
          targets: corona,
          scaleX: { from: 1, to: 1.2 + i * 0.05 },
          scaleY: { from: 1, to: 1.2 + i * 0.05 },
          alpha: { from: corona.alpha, to: corona.alpha * 1.5 },
          duration: 1200 + i * 200,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      });

      // 태양 떠오름
      this.tweens.add({
        targets: sunContainer,
        y: height - 100,
        duration: 2500,
        ease: 'Power2.easeOut'
      });

      // 🆕 나중에 오른쪽으로 날아갈 참조 저장
      this.victorySunContainer = sunContainer;
    });

    // ====== PHASE 4: "DAWN BREAKS!" 텍스트 ======
    this.time.delayedCall(2800, () => {
      // 4-1. 메인 텍스트
      const victoryText = this.add.text(width / 2, height / 2 - 60, 'DAWN BREAKS!', {
        fontSize: '56px',
        fill: '#FFD700',
        fontStyle: 'bold',
        stroke: '#ffffff',
        strokeThickness: 6
      }).setOrigin(0.5).setDepth(5200).setScale(0).setAlpha(0);
      victoryElements.push(victoryText);

      // 글자 하나씩 나타나는 효과 시뮬레이션
      this.tweens.add({
        targets: victoryText,
        alpha: 1,
        scaleX: { from: 0.3, to: 1.2 },
        scaleY: { from: 0.3, to: 1.2 },
        duration: 600,
        ease: 'Back.easeOut',
        onComplete: () => {
          // 텍스트 펄스
          this.tweens.add({
            targets: victoryText,
            scaleX: { from: 1.2, to: 1.0 },
            scaleY: { from: 1.2, to: 1.0 },
            duration: 300
          });
        }
      });

      // 4-2. 빛 파티클 분출
      for (let i = 0; i < 40; i++) {
        const sparkle = this.add.circle(
          width / 2 + Phaser.Math.Between(-100, 100),
          height / 2 - 60,
          Phaser.Math.Between(2, 6),
          0xffffaa,
          1
        ).setDepth(5201);

        this.tweens.add({
          targets: sparkle,
          x: sparkle.x + Phaser.Math.Between(-200, 200),
          y: sparkle.y + Phaser.Math.Between(-150, 150),
          alpha: 0,
          duration: 1000,
          delay: i * 15,
          ease: 'Power2.easeOut',
          onComplete: () => sparkle.destroy()
        });
      }

      // 플래시 효과
      this.browserFlash('white', 300);
      this.cameras.main.flash(300, 255, 255, 200);
    });

    // ====== PHASE 5: 보너스 + 뱀 대사 ======
    this.time.delayedCall(4000, () => {
      // 5-1. 보너스 점수
      const bonusText = this.add.text(width / 2, height / 2 + 30, `+${this.fogBossBonus} BONUS!`, {
        fontSize: '40px',
        fill: '#00ff00',
        fontStyle: 'bold',
        stroke: '#004400',
        strokeThickness: 4
      }).setOrigin(0.5).setDepth(5202).setScale(0);
      victoryElements.push(bonusText);

      this.tweens.add({
        targets: bonusText,
        scaleX: 1,
        scaleY: 1,
        duration: 400,
        ease: 'Back.easeOut'
      });

      this.score += this.fogBossBonus;
      this.scoreText.setText(this.score.toString());

      // 5-2. 코인 비
      for (let i = 0; i < 30; i++) {
        const coin = this.add.circle(
          Phaser.Math.Between(50, width - 50),
          -20,
          5 + Math.random() * 4,
          0xffdd00,
          1
        ).setDepth(5150);

        this.tweens.add({
          targets: coin,
          y: height + 30,
          x: coin.x + Phaser.Math.Between(-50, 50),
          duration: 1500 + Math.random() * 1000,
          delay: i * 40,
          ease: 'Bounce.easeOut',
          onComplete: () => coin.destroy()
        });
      }

      // 5-3. 뱀 대사
      this.time.delayedCall(1500, () => {
        const snakeText = this.add.text(width / 2, height / 2 + 100, 'Finally... I can see again!', {
          fontSize: '22px',
          fill: '#00dd00',
          fontStyle: 'italic',
          stroke: '#003300',
          strokeThickness: 2
        }).setOrigin(0.5).setDepth(5203).setAlpha(0);
        victoryElements.push(snakeText);

        this.tweens.add({
          targets: snakeText,
          alpha: 1,
          y: height / 2 + 90,
          duration: 500
        });
      });
    });

    // ====== PHASE 6: 마무리 및 정리 ======
    this.time.delayedCall(7000, () => {
      // 6-1. 태양이 오른쪽으로 부드럽게 날아감!
      if (this.victorySunContainer && this.victorySunContainer.active) {
        this.tweens.add({
          targets: this.victorySunContainer,
          x: width + 200,
          y: this.victorySunContainer.y - 100, // 약간 위로 올라가면서
          scaleX: 0.6,
          scaleY: 0.6,
          duration: 1200,
          ease: 'Power2.easeIn',
          onComplete: () => {
            if (this.victorySunContainer && this.victorySunContainer.destroy) {
              this.victorySunContainer.destroy();
            }
          }
        });
      }

      // 6-2. 다른 요소들은 페이드아웃 (태양 컨테이너 제외)
      victoryElements.forEach(el => {
        if (el && el.active && el !== this.victorySunContainer) {
          this.tweens.add({
            targets: el,
            alpha: 0,
            duration: 800,
            onComplete: () => {
              if (el && el.destroy) el.destroy();
            }
          });
        }
      });

      // 6-3. DOM 배경 복원 (태양 날아간 후)
      this.time.delayedCall(800, () => {
        try {
          document.body.style.transition = 'background 1s ease';
          document.body.style.background = 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)';
        } catch (e) {}
      });

      // 6-4. 보스 모드 종료
      this.cleanupFogBoss();

      // 6-5. 콤보/실드 복원
      this.combo = this.savedFogBossCombo;
      this.comboShieldCount = this.savedFogBossShieldCount;
      this.updateItemStatusUI();

      // 6-6. 상점 오픈 또는 다음 스테이지
      this.time.delayedCall(1200, () => {
        this.stageClear();
      });
    });
  }

  // 보스 정리
  cleanupFogBoss() {
    this.fogBossMode = false;
    this.fogBossPhase = 'none';
    this.fogBossVisible = false;
    this.fogBossHitCount = 0;

    // 타이머 정리
    if (this.shadowStrikeTimer) {
      this.shadowStrikeTimer.destroy();
      this.shadowStrikeTimer = null;
    }
    if (this.flareSpawnTimer) {
      this.flareSpawnTimer.destroy();
      this.flareSpawnTimer = null;
    }
    if (this.bossSlimeTimer) {
      this.bossSlimeTimer.destroy();
      this.bossSlimeTimer = null;
    }

    // 🆕 스토킹 시스템 정리
    this.cleanupStalkingSystem();

    // 🆕 Presence 시스템 정리 (브라우저 어둠, 펄스 등)
    this.cleanupPresenceSystem();

    // 요소 정리
    if (this.fogBossElement) {
      this.fogBossElement.destroy();
      this.fogBossElement = null;
    }

    // 조명탄 정리
    this.flares.forEach(flare => {
      if (flare.container) {
        flare.container.destroy();
      }
    });
    this.flares = [];
    this.flareCount = 0;

    // 환각 먹이 정리
    this.hallucinationFoods.forEach(food => {
      if (food.container) {
        food.container.destroy();
      }
    });
    this.hallucinationFoods = [];

    // 빛 오브 정리
    if (this.lightOrb && this.lightOrb.container) {
      this.lightOrb.container.destroy();
      this.lightOrb = null;
    }

    // 🆕 안개 완전히 비활성화 (다음 스테이지는 일반 스테이지)
    this.fogEnabled = false;
    this.fogTestForceEnable = false;
    this.fogIntroPlaying = false; // 인트로 진행 중 플래그도 리셋
    this.fogLastRenderKey = null; // 렌더 캐시 리셋

    // fogRenderTexture 숨기기 (destroy하지 않음 - 나중에 재사용 가능)
    if (this.fogRenderTexture) {
      this.fogRenderTexture.clear();
      this.fogRenderTexture.setVisible(false);
      this.fogRenderTexture.setAlpha(1); // 다음에 사용할 때를 위해 복원
    }

    // 안개 설정 복원
    this.fogVisibleTiles = this.originalFogVisibleTiles;
    this.eclipseActive = false;
    this.fogIntroShown = false; // 다음 안개 스테이지에서 인트로 다시 보여주기

    // 🆕 카메라 줌 리셋
    this.cameras.main.setZoom(1);

    // UI 요소 정리
    this.fogBossElements.forEach(el => {
      if (el && el.destroy) {
        el.destroy();
      }
    });
    this.fogBossElements = [];
  }

  // ========== 개발자 테스트 모드 (KK) ==========

  // localStorage에서 테스트 스테이지 설정 로드
  loadTestStageConfig() {
    try {
      const saved = localStorage.getItem('snakeGame_testStages');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.warn('Failed to load test stage config:', e);
    }
    return { '-2': false, '-1': false, '0': false };
  }

  // localStorage에 테스트 스테이지 설정 저장
  saveTestStageConfig() {
    try {
      localStorage.setItem('snakeGame_testStages', JSON.stringify(this.testStagesEnabled));
    } catch (e) {
      console.warn('Failed to save test stage config:', e);
    }
  }

  // 테스트 스테이지 토글
  toggleTestStage(stage) {
    const key = stage.toString();
    if (this.testStagesEnabled.hasOwnProperty(key)) {
      this.testStagesEnabled[key] = !this.testStagesEnabled[key];
      this.saveTestStageConfig();
      this.updateDevModeUI();
    }
  }

  // 개발자 모드 열기
  openDevMode() {
    if (this.devModeEnabled) return;
    if (this.shopOpen || this.loanUIOpen) return;

    this.devModeEnabled = true;

    // 게임 일시정지
    if (this.moveTimer) {
      this.moveTimer.paused = true;
    }

    const { width, height } = this.cameras.main;
    this.devModeElements = [];
    this.devStageButtons = [];

    // 어두운 오버레이
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.9)
      .setOrigin(0, 0)
      .setDepth(9000)
      .setInteractive();
    this.devModeElements.push(overlay);

    // 타이틀
    const title = this.add.text(width / 2, 30, 'DEV MODE', {
      fontSize: '32px',
      fill: '#ff00ff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(9001);
    this.devModeElements.push(title);

    // 서브타이틀
    const subtitle = this.add.text(width / 2, 60, 'Stage Select', {
      fontSize: '16px',
      fill: '#aaaaaa'
    }).setOrigin(0.5).setDepth(9001);
    this.devModeElements.push(subtitle);

    // 스테이지 목록 영역
    const listY = 100;
    const listHeight = height - 180;
    const itemHeight = 26;
    const visibleItems = Math.floor(listHeight / itemHeight);

    // 테스트 스테이지 섹션
    const testLabel = this.add.text(60, listY, '[TEST STAGES]', {
      fontSize: '14px',
      fill: '#ff6600',
      fontStyle: 'bold'
    }).setDepth(9001);
    this.devModeElements.push(testLabel);

    // 모든 스테이지 생성 (테스트 + 일반)
    const allStages = [-2, -1, 0, ...Array.from({ length: 30 }, (_, i) => i + 1)];

    let currentY = listY + 25;
    allStages.forEach((stage, index) => {
      // 일반 스테이지 시작 시 구분선
      if (stage === 1) {
        const normalLabel = this.add.text(60, currentY, '[NORMAL STAGES]', {
          fontSize: '14px',
          fill: '#00ff00',
          fontStyle: 'bold'
        }).setDepth(9001);
        this.devModeElements.push(normalLabel);
        currentY += 25;
      }

      const world = getWorldByStage(stage);
      const bossInfo = getBossInfoForStage(stage);

      let label = '';
      let color = '#ffffff';

      if (stage <= 0) {
        // 테스트 스테이지 (기계왕국 개발)
        const enabled = this.testStagesEnabled[stage.toString()];
        const checkbox = enabled ? '[v]' : '[ ]';
        const testStageInfo = TEST_STAGES[stage.toString()];
        const mappedStage = testStageInfo ? testStageInfo.mappedStage : 10;
        label = `${checkbox} Test ${stage} -> S${mappedStage}`;
        if (stage === 0) label += ' [BOSS]';
        color = enabled ? '#00ff00' : '#888888';
      } else {
        // 일반 스테이지
        label = `Stage ${stage}`;
        if (world && world.name) {
          label += ` (${world.name})`;
        }
        if (bossInfo) {
          label += ' [BOSS]';
          color = '#ff6666';
        }
      }

      // 현재 스테이지 표시
      if (stage === this.currentStage) {
        label = '> ' + label + ' <';
        color = '#00ffff';
      }

      const btn = this.add.text(80, currentY, label, {
        fontSize: '16px',
        fill: color,
        padding: { x: 8, y: 2 }
      }).setDepth(9001).setInteractive();

      btn.stageValue = stage;
      btn.originalColor = color;

      btn.on('pointerover', () => {
        if (this.selectedDevStage !== stage) {
          btn.setFill('#ffff00');
        }
      });
      btn.on('pointerout', () => {
        if (this.selectedDevStage !== stage) {
          btn.setFill(btn.originalColor);
        }
      });
      btn.on('pointerdown', () => {
        this.selectedDevStage = stage;
        this.updateDevModeSelection();
      });

      this.devStageButtons.push(btn);
      this.devModeElements.push(btn);
      currentY += itemHeight;
    });

    // 안내 텍스트
    const helpText = this.add.text(width / 2, height - 60, [
      'Arrow Keys: Select    ENTER: Start Stage',
      'T: Toggle Test Stage    ESC: Cancel'
    ].join('\n'), {
      fontSize: '14px',
      fill: '#888888',
      align: 'center'
    }).setOrigin(0.5).setDepth(9001);
    this.devModeElements.push(helpText);

    // 선택 초기화
    this.selectedDevStage = this.currentStage;
    this.updateDevModeSelection();

    // 키보드 핸들러 설정
    this.devModeKeyHandler = this.input.keyboard.on('keydown', (event) => {
      this.handleDevModeInput(event.key);
    });
  }

  // 개발자 모드 UI 업데이트
  updateDevModeUI() {
    this.devStageButtons.forEach(btn => {
      const stage = btn.stageValue;
      const world = getWorldByStage(stage);
      const bossInfo = getBossInfoForStage(stage);

      let label = '';
      let color = '#ffffff';

      if (stage <= 0) {
        // 테스트 스테이지 (기계왕국 개발)
        const enabled = this.testStagesEnabled[stage.toString()];
        const checkbox = enabled ? '[v]' : '[ ]';
        const testStageInfo = TEST_STAGES[stage.toString()];
        const mappedStage = testStageInfo ? testStageInfo.mappedStage : 10;
        label = `${checkbox} Test ${stage} -> S${mappedStage}`;
        if (stage === 0) label += ' [BOSS]';
        color = enabled ? '#00ff00' : '#888888';
      } else {
        label = `Stage ${stage}`;
        if (world && world.name) {
          label += ` (${world.name})`;
        }
        if (bossInfo) {
          label += ' [BOSS]';
          color = '#ff6666';
        }
      }

      if (stage === this.currentStage) {
        label = '> ' + label + ' <';
        color = '#00ffff';
      }

      btn.setText(label);
      btn.originalColor = color;

      if (this.selectedDevStage === stage) {
        btn.setFill('#ffff00');
      } else {
        btn.setFill(color);
      }
    });
  }

  // 선택 UI 업데이트
  updateDevModeSelection() {
    this.devStageButtons.forEach(btn => {
      if (btn.stageValue === this.selectedDevStage) {
        btn.setFill('#ffff00');
        btn.setFontStyle('bold');
      } else {
        btn.setFill(btn.originalColor);
        btn.setFontStyle('normal');
      }
    });
  }

  // 개발자 모드 키보드 입력 처리
  handleDevModeInput(key) {
    if (!this.devModeEnabled) return;

    const currentIndex = this.devStageButtons.findIndex(
      btn => btn.stageValue === this.selectedDevStage
    );

    switch (key) {
      case 'ArrowUp':
        if (currentIndex > 0) {
          this.selectedDevStage = this.devStageButtons[currentIndex - 1].stageValue;
          this.updateDevModeSelection();
        }
        break;
      case 'ArrowDown':
        if (currentIndex < this.devStageButtons.length - 1) {
          this.selectedDevStage = this.devStageButtons[currentIndex + 1].stageValue;
          this.updateDevModeSelection();
        }
        break;
      case 'Enter':
        this.startFromDevMode(this.selectedDevStage);
        break;
      case 'Escape':
        this.closeDevMode();
        break;
      case 't':
      case 'T':
        // 테스트 스테이지 토글 (테스트 스테이지 선택 중일 때만)
        if (this.selectedDevStage <= 0) {
          this.toggleTestStage(this.selectedDevStage);
        }
        break;
    }
  }

  // 선택한 스테이지에서 시작
  startFromDevMode(targetStage) {
    this.closeDevMode();

    // 테스트 모드 여부
    this.isTestMode = targetStage <= 0;
    this.currentStage = targetStage;

    // 게임 오버 상태 초기화
    this.gameOver = false;

    // 스테이지 리셋 (개발 모드용)
    this.resetForDevMode();

    // 보스 스테이지 여부
    const isBulletBoss = this.isBulletBossStage();
    const isFogBoss = this.isFogBossStage();
    const isPoisonBoss = !isBulletBoss && !isFogBoss && (
      this.currentStage === this.testBossStage ||
      (this.currentStage > this.testBossStage && this.currentStage % this.bossStageInterval === 0)
    );

    // 보스 스테이지 진입
    if (isPoisonBoss || isBulletBoss || isFogBoss) {
      this.enterBossStage();
    }

    // 카운트다운 표시
    this.showDevModeCountdown(() => {
      if (this.moveTimer) {
        this.moveTimer.paused = false;
      }

      this.activateStageFeatures();
    });
  }

  activateStageFeatures() {
    // 안개 인트로 (World 2)
    if (shouldHaveFog(this.currentStage)) {
      this.startFogIntroIfNeeded();
    }

    // 독가스 자기장 (World 4)
    if (shouldHaveGasZone(this.currentStage)) {
      this.time.delayedCall(1000, () => {
        this.startGasZone();
      });
    }

    // 탄막 보스 (Stage 6)
    if (this.isBulletBossStage()) {
      this.bossPhase = 'intro';
      this.food = { x: -100, y: -100 };
      this.moveTimer.paused = true;
      this.hideFoodGraphics();
      this.time.delayedCall(500, () => {
        this.startBulletBoss();
      });
    }

    // 안개 보스 (Stage 9)
    if (this.isFogBossStage()) {
      this.bossPhase = 'intro';
      this.food = { x: -100, y: -100 };
      this.moveTimer.paused = true;
      this.hideFoodGraphics();
      this.time.delayedCall(500, () => {
        this.startFogBoss();
      });
    }

    // 독개구리 보스 (Stage 3, 12, 15 등 - 탄막/안개 보스 제외)
    const isPoisonBoss = !this.isBulletBossStage() && !this.isFogBossStage() && !isMagnetarStage(this.currentStage) && (
      this.currentStage === this.testBossStage ||
      (this.currentStage > this.testBossStage && this.currentStage % this.bossStageInterval === 0)
    );
    if (isPoisonBoss) {
      this.bossPhase = 'intro';
      this.food = { x: -100, y: -100 };
      this.bossIntroMoveCount = 0;
    }

    // Flux Maze 기능 활성화 (Stage -1) - 레이저 터렛 시스템
    if (shouldHaveLaserTurrets(this.currentStage)) {
      this.time.delayedCall(1000, () => {
        this.initLaserTurrets();
      });
    }

    if (shouldHaveFloatingMines(this.currentStage)) {
      this.time.delayedCall(2000, () => {
        this.startMineSpawner();
      });
    }

    // Magnetar 보스 스테이지 체크 (Stage 0)
    if (isMagnetarStage(this.currentStage)) {
      this.bossPhase = 'intro';
      this.food = { x: -100, y: -100 };
      this.moveTimer.paused = true;
      this.hideFoodGraphics();
      this.time.delayedCall(500, () => {
        this.startMagnetar();
      });
    }
  }

  // 개발자 모드용 게임 완전 리셋
  resetForDevMode() {
    // 기존 상태 완전 정리
    this.cleanupSpeedBoostOrbitals();
    this.resetFogOfWar();
    this.destroyAllSaws();
    this.stopGasZone();

    // Flux Maze 시스템 정리
    this.stopPolaritySystem();
    this.cleanupMagneticTurrets();
    this.cleanupLaserTurrets();
    this.cleanupFloatingMines();

    // Magnetar 보스 정리
    this.cleanupMagnetar();

    // 안개 보스 정리
    if (this.fogBossMode) {
      this.cleanupFogBoss();
    }

    // 탄막 보스 정리
    if (this.bulletBossMode) {
      this.cleanupBulletBoss();
    }

    // 기존 보스 요소 정리
    if (this.bossElement) {
      this.bossElement.destroy();
      this.bossElement = null;
    }

    // 뱀 초기화
    this.snake = [
      { x: 10, y: 15 },
      { x: 9, y: 15 },
      { x: 8, y: 15 }
    ];
    this.direction = 'RIGHT';
    this.inputQueue = [];

    // 점수/먹이 리셋
    this.score = 0;
    this.scoreText.setText('0');
    this.foodCount = 0;
    this.foodCountText.setText('0');

    // 콤보 리셋
    this.combo = 0;
    this.comboText.setText('');
    this.directionChangesCount = 0;

    // 보스 상태 완전 리셋
    this.bossMode = false;
    this.isBossStage = false;
    this.bossPhase = 'none';
    this.bossHitCount = 0;
    this.snakePoisoned = false;
    this.poisonGrowthActive = false;
    this.poisonGrowthData = null;

    // 탄막 보스 상태 리셋
    this.bulletBossMode = false;
    this.bulletBossPhase = 'none';
    this.bulletBossHitCount = 0;
    this.bulletBossPosition = null;
    this.bullets = [];

    // 안개 보스 상태 리셋
    this.fogBossMode = false;
    this.fogBossPhase = 'none';
    this.fogBossHitCount = 0;
    this.fogBossPosition = null;
    this.fogIntroShown = false;

    // 기타 상태 리셋
    this.hasEatenFirstFood = false;
    this.comboLost = false;
    this.shieldsUsedThisCycle = false;

    // 모든 스테이지 시작 속도 90ms 고정
    const startSpeed = 90;
    if (this.moveTimer) {
      this.moveTimer.delay = startSpeed;
      this.moveTimer.paused = true; // 카운트다운 후 재개
    }
    this.speedText.setText(startSpeed + 'ms');

    // 먹이 생성
    this.food = this.generateFood();

    // 그래픽 업데이트
    this.draw();

    // 아이템 상태 UI 업데이트
    this.updateItemStatusUI();
  }

  // 개발자 모드 카운트다운
  showDevModeCountdown(callback) {
    const { width, height } = this.cameras.main;
    let count = 3;

    // 스테이지 표시
    const stageLabel = this.currentStage <= 0
      ? `TEST ${this.currentStage}`
      : `STAGE ${this.currentStage}`;

    const world = getWorldByStage(this.currentStage);
    const worldName = world && world.name ? ` - ${world.name}` : '';

    const stageText = this.add.text(width / 2, height / 2 - 80, stageLabel + worldName, {
      fontSize: '28px',
      fill: '#00ff00',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setDepth(5000);

    const countText = this.add.text(width / 2, height / 2, count.toString(), {
      fontSize: '96px',
      fill: '#ffffff',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(5000);

    const countdownTimer = this.time.addEvent({
      delay: 600,
      callback: () => {
        count--;
        if (count > 0) {
          countText.setText(count.toString());
          // 펄스 효과
          this.tweens.add({
            targets: countText,
            scaleX: 1.2,
            scaleY: 1.2,
            duration: 100,
            yoyo: true
          });
        } else if (count === 0) {
          countText.setText('GO!');
          countText.setFill('#00ff00');
        } else {
          stageText.destroy();
          countText.destroy();
          callback();
        }
      },
      repeat: 3
    });
  }

  // 개발자 모드 닫기
  closeDevMode() {
    if (!this.devModeEnabled) return;

    this.devModeEnabled = false;

    // UI 정리
    this.devModeElements.forEach(el => {
      if (el && el.destroy) {
        el.destroy();
      }
    });
    this.devModeElements = [];
    this.devStageButtons = [];

    // 키보드 핸들러 제거
    if (this.devModeKeyHandler) {
      this.input.keyboard.off('keydown', this.devModeKeyHandler);
      this.devModeKeyHandler = null;
    }

    // 게임 재개
    if (this.moveTimer && !this.gameOver) {
      this.moveTimer.paused = false;
    }
  }

  // 게임 시작 스테이지 결정 (테스트 스테이지 포함)
  determineStartStage() {
    // 테스트 스테이지 -2가 활성화되어 있으면 -2에서 시작
    if (this.testStagesEnabled['-2']) {
      this.isTestMode = true;
      return -2;
    }
    return 1;
  }

  // 월드 정보 가져오기 (UI 표시용)
  getWorldDisplayInfo(stage) {
    if (stage <= 0) {
      return { name: 'Test', nameKo: '테스트', color: '#ff6600' };
    }
    const world = getWorldByStage(stage);
    return {
      name: world.name || 'Unknown',
      nameKo: world.nameKo || world.name || 'Unknown',
      color: '#00ff00'
    };
  }

  update() {
    // 타이머 이벤트가 자동으로 moveSnake를 호출하므로
    // update에서는 아무것도 하지 않아도 됨

    // 기어 타이탄 보스: 차지 대시 입력 처리
    if (this.gearTitanMode && this.canChargeDash && !this.gameOver) {
      this.handleChargeInput();
    }
  }
}

