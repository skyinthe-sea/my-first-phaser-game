import Phaser from 'phaser';
import Paddle from '../objects/Paddle.js';
import Ball from '../objects/Ball.js';
import Brick from '../objects/Brick.js';
import PowerUp from '../objects/PowerUp.js';
import ParticleManager from '../utils/ParticleManager.js';

export default class GameScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // Physics world bounds 설정 (위, 왼쪽, 오른쪽만 막고 아래는 열어둠)
    this.physics.world.setBoundsCollision(true, true, true, false);

    // 게임 상태
    this.score = 0;
    this.lives = 3;
    this.combo = 0;
    this.maxCombo = 0;
    this.level = 1;
    this.ballsInPlay = 0;

    // 파티클 매니저
    this.particleManager = new ParticleManager(this);

    // 배경
    this.createBackground();

    // 패들 생성
    this.paddle = new Paddle(this, width / 2, height - 50);

    // 공 생성
    this.balls = this.physics.add.group({
      classType: Ball,
      runChildUpdate: true
    });

    this.createBall();

    // 벽돌 생성
    this.bricks = this.physics.add.group({
      classType: Brick
    });

    this.createBricks();

    // 파워업 그룹
    this.powerUps = this.physics.add.group({
      classType: PowerUp,
      runChildUpdate: true
    });

    // 충돌 설정
    this.physics.add.collider(this.balls, this.paddle, this.hitPaddle, null, this);
    // 벽돌 충돌: processCallback으로 파이어볼일 때는 관통하도록 설정
    this.physics.add.collider(this.balls, this.bricks, this.hitBrick, this.processBrickCollision, this);
    this.physics.add.overlap(this.paddle, this.powerUps, this.collectPowerUp, null, this);

    // UI
    this.createUI();

    // 입력 설정 - 단순하게
    this.leftKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
    this.rightKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

    // 카메라 효과
    this.cameras.main.fadeIn(500);

    // 파워업 타이머
    this.powerUpEffects = {};
  }

  createBackground() {
    const { width, height } = this.cameras.main;
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0a0a0a, 0x0a0a0a, 1);
    graphics.fillRect(0, 0, width, height);

    // 배경 파티클
    for (let i = 0; i < 30; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const size = Phaser.Math.Between(1, 3);
      const particle = this.add.circle(x, y, size, 0x4a4a6a, 0.2);

      this.tweens.add({
        targets: particle,
        y: y + Phaser.Math.Between(50, 150),
        alpha: 0.5,
        duration: Phaser.Math.Between(3000, 6000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }
  }

  createBricks() {
    const { width } = this.cameras.main;
    const rows = 6;
    const cols = 10;
    const brickWidth = 100;
    const brickHeight = 30;
    const padding = 10;
    const offsetX = (width - (cols * (brickWidth + padding) - padding)) / 2;
    const offsetY = 80;

    const colors = [0xff0080, 0xff4040, 0xff8800, 0xffdd00, 0x00ff88, 0x0088ff];

    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const x = offsetX + col * (brickWidth + padding) + brickWidth / 2;
        const y = offsetY + row * (brickHeight + padding) + brickHeight / 2;
        const color = colors[row];
        const points = (rows - row) * 100;
        const hits = row >= 4 ? 2 : 1; // 하위 2줄은 2번 맞춰야 깨짐

        const brick = new Brick(this, x, y, brickWidth, brickHeight, color, points, hits);
        this.bricks.add(brick);
      }
    }
  }

  createBall() {
    const ball = new Ball(this, this.paddle.x, this.paddle.y - 30);
    this.balls.add(ball);
    ball.attachToPaddle(this.paddle);
    this.ballsInPlay++;
  }

  createUI() {
    const { width } = this.cameras.main;

    // 스코어
    this.scoreText = this.add.text(20, 20, 'SCORE: 0', {
      fontFamily: 'Arial',
      fontSize: '28px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    });

    // 콤보
    this.comboText = this.add.text(width / 2, 20, '', {
      fontFamily: 'Arial',
      fontSize: '32px',
      fontStyle: 'bold',
      color: '#ff0080',
      stroke: '#ffffff',
      strokeThickness: 3
    }).setOrigin(0.5, 0).setVisible(false);

    // 생명
    this.livesText = this.add.text(width - 20, 20, '♥ ♥ ♥', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ff0080'
    }).setOrigin(1, 0);

    // 레벨
    this.levelText = this.add.text(width - 20, 60, 'LEVEL ' + this.level, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(1, 0);
  }

  hitPaddle(ball, paddle) {
    // 공의 속도를 패들 충돌 위치에 따라 조정
    const diff = ball.x - paddle.x;
    const normalizedDiff = diff / (paddle.displayWidth / 2);

    ball.body.velocity.x = normalizedDiff * 400;

    // 최소 Y 속도 보장
    if (Math.abs(ball.body.velocity.y) < 200) {
      ball.body.velocity.y = -300;
    }

    // 충돌 효과
    this.particleManager.paddleHit(ball.x, ball.y);
    this.cameras.main.shake(50, 0.002);

    // 패들 애니메이션
    this.tweens.add({
      targets: paddle,
      scaleY: 0.8,
      duration: 50,
      yoyo: true
    });
  }

  processBrickCollision(ball, brick) {
    // 파이어볼이면 물리적 충돌 없이 관통 (false 반환)
    // 일반 공이면 물리적 충돌 발생 (true 반환)
    return !ball.isFireball;
  }

  hitBrick(ball, brick) {
    const destroyed = brick.hit();

    if (destroyed) {
      // 콤보 증가
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);

      // 점수 추가 (콤보 보너스)
      const comboMultiplier = 1 + (this.combo * 0.1);
      const points = Math.floor(brick.points * comboMultiplier);
      this.score += points;

      // 콤보 UI 업데이트
      if (this.combo > 1) {
        this.comboText.setText(`${this.combo}x COMBO!`);
        this.comboText.setVisible(true);
        this.comboText.setScale(1.5);

        this.tweens.add({
          targets: this.comboText,
          scale: 1,
          duration: 200
        });
      }

      // 점수 플로팅 텍스트
      this.showFloatingText(brick.x, brick.y, `+${points}`, 0xffdd00);

      // 파티클 효과
      this.particleManager.brickDestroy(brick.x, brick.y, brick.color);

      // 카메라 쉐이크
      this.cameras.main.shake(100, 0.003);

      // 파워업 드롭 (20% 확률)
      if (Math.random() < 0.2) {
        const powerUp = new PowerUp(this, brick.x, brick.y);
        this.powerUps.add(powerUp);
      }

      // 모든 벽돌 제거시 다음 레벨
      if (this.bricks.countActive() === 0) {
        this.nextLevel();
      }
    } else {
      // 벽돌이 파괴되지 않았을 때
      this.particleManager.brickHit(brick.x, brick.y, brick.color);
    }

    this.updateUI();
  }

  collectPowerUp(paddle, powerUp) {
    const type = powerUp.type;

    powerUp.destroy();

    // 파티클 효과
    this.particleManager.powerUpCollect(powerUp.x, powerUp.y);

    // 파워업 텍스트 표시
    const powerUpNames = {
      'expand': '패들 확장!',
      'multiball': '멀티볼!',
      'fireball': '파이어볼!',
      'slow': '슬로우 모션!',
      'life': '생명 +1!'
    };

    this.showFloatingText(powerUp.x, powerUp.y, powerUpNames[type], 0x00ff88);

    // 파워업 효과 적용
    switch(type) {
      case 'expand':
        this.expandPaddle();
        break;
      case 'multiball':
        this.createMultiBalls();
        break;
      case 'fireball':
        this.activateFireball();
        break;
      case 'slow':
        this.activateSlowMotion();
        break;
      case 'life':
        this.lives = Math.min(this.lives + 1, 5);
        this.updateUI();
        break;
    }
  }

  expandPaddle() {
    // 기존 효과 제거
    if (this.powerUpEffects.expand) {
      this.powerUpEffects.expand.remove();
    }

    this.paddle.setDisplaySize(this.paddle.displayWidth * 1.5, this.paddle.displayHeight);
    this.paddle.body.setSize(this.paddle.displayWidth, this.paddle.displayHeight);

    this.powerUpEffects.expand = this.time.delayedCall(10000, () => {
      this.tweens.add({
        targets: this.paddle,
        displayWidth: this.paddle.displayWidth / 1.5,
        duration: 300
      });
      this.time.delayedCall(300, () => {
        this.paddle.body.setSize(this.paddle.displayWidth, this.paddle.displayHeight);
      });
    });
  }

  createMultiBalls() {
    this.balls.children.entries.forEach(ball => {
      for (let i = 0; i < 2; i++) {
        const newBall = new Ball(this, ball.x, ball.y);
        this.balls.add(newBall);

        const angle = Phaser.Math.Between(-60, 60);
        const speed = 400;
        newBall.body.velocity.x = Math.sin(Phaser.Math.DegToRad(angle)) * speed;
        newBall.body.velocity.y = -Math.cos(Phaser.Math.DegToRad(angle)) * speed;

        this.ballsInPlay++;
      }
    });
  }

  activateFireball() {
    if (this.powerUpEffects.fireball) {
      this.powerUpEffects.fireball.remove();
    }

    this.balls.children.entries.forEach(ball => {
      ball.setFireball(true);
    });

    this.powerUpEffects.fireball = this.time.delayedCall(8000, () => {
      this.balls.children.entries.forEach(ball => {
        ball.setFireball(false);
      });
    });
  }

  activateSlowMotion() {
    if (this.powerUpEffects.slow) {
      this.powerUpEffects.slow.remove();
    }

    this.physics.world.timeScale = 2;

    this.powerUpEffects.slow = this.time.delayedCall(5000, () => {
      this.physics.world.timeScale = 1;
    });
  }

  showFloatingText(x, y, text, color) {
    const floatingText = this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: '24px',
      fontStyle: 'bold',
      color: '#' + color.toString(16).padStart(6, '0'),
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.tweens.add({
      targets: floatingText,
      y: y - 50,
      alpha: 0,
      duration: 1000,
      ease: 'Power2',
      onComplete: () => floatingText.destroy()
    });
  }

  nextLevel() {
    this.level++;

    // 레벨 클리어 텍스트
    const { width, height } = this.cameras.main;
    const levelClearText = this.add.text(width / 2, height / 2, `LEVEL ${this.level - 1} CLEAR!`, {
      fontFamily: 'Arial',
      fontSize: '64px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#ff0080',
      strokeThickness: 8
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: levelClearText,
      alpha: 1,
      scale: 1.2,
      duration: 500,
      yoyo: true,
      onComplete: () => {
        levelClearText.destroy();
        this.createBricks();
        this.updateUI();
      }
    });

    // 보너스 점수
    this.score += this.level * 1000;
  }

  ballOut(ball) {
    ball.destroy();
    this.ballsInPlay--;

    // 콤보 리셋
    this.combo = 0;
    this.comboText.setVisible(false);

    if (this.ballsInPlay <= 0) {
      this.lives--;
      this.updateUI();

      if (this.lives > 0) {
        this.time.delayedCall(500, () => {
          this.createBall();
        });
      } else {
        this.gameOver();
      }
    }
  }

  gameOver() {
    const { width, height } = this.cameras.main;

    // 게임 오버 화면
    const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0);

    const gameOverText = this.add.text(width / 2, height / 2 - 100, 'GAME OVER', {
      fontFamily: 'Arial',
      fontSize: '80px',
      fontStyle: 'bold',
      color: '#ff0080',
      stroke: '#ffffff',
      strokeThickness: 6
    }).setOrigin(0.5);

    const scoreText = this.add.text(width / 2, height / 2, `FINAL SCORE: ${this.score}`, {
      fontFamily: 'Arial',
      fontSize: '40px',
      color: '#ffffff'
    }).setOrigin(0.5);

    const maxComboText = this.add.text(width / 2, height / 2 + 50, `MAX COMBO: ${this.maxCombo}x`, {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#ffdd00'
    }).setOrigin(0.5);

    const restartText = this.add.text(width / 2, height / 2 + 120, 'CLICK TO RESTART', {
      fontFamily: 'Arial',
      fontSize: '32px',
      color: '#888888'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: restartText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    this.input.once('pointerdown', () => {
      this.scene.restart();
    });
  }

  updateUI() {
    this.scoreText.setText(`SCORE: ${this.score}`);

    const hearts = '♥ '.repeat(this.lives);
    this.livesText.setText(hearts);

    this.levelText.setText(`LEVEL ${this.level}`);
  }

  update() {
    // 패들 이동 - 단순하게 현재 눌린 키 상태를 전달
    this.paddle.update(this.leftKey.isDown, this.rightKey.isDown);

    // 공 발사
    if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
      this.balls.children.entries.forEach(ball => {
        if (ball.attachedToPaddle) {
          ball.launch();
        }
      });
    }

    // 공이 화면 아래로 떨어진 경우
    this.balls.children.entries.forEach(ball => {
      if (ball.y > this.cameras.main.height + 50) {
        this.ballOut(ball);
      }
    });
  }
}
