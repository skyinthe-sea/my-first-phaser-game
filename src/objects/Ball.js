import Phaser from 'phaser';

export default class Ball extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    // 텍스처가 없으면 생성
    if (!scene.textures.exists('ball')) {
      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0xffffff, 1);
      graphics.fillCircle(10, 10, 10);
      graphics.generateTexture('ball', 20, 20);
      graphics.destroy();
    }

    super(scene, x, y, 'ball');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setCollideWorldBounds(true);
    this.body.onWorldBounds = true;
    this.body.setBounce(1, 1);
    this.body.setCircle(10);
    this.body.setAllowGravity(false);
    this.body.setMaxVelocity(800, 800);

    this.attachedToPaddle = false;
    this.paddle = null;
    this.isFireball = false;
    this.speed = 400;

    // 글로우 효과
    this.glow = scene.add.circle(x, y, 20, 0xffffff, 0.3);
    scene.tweens.add({
      targets: this.glow,
      scale: 1.5,
      alpha: 0.1,
      duration: 500,
      yoyo: true,
      repeat: -1
    });
  }

  attachToPaddle(paddle) {
    this.attachedToPaddle = true;
    this.paddle = paddle;
    this.body.setVelocity(0, 0);
  }

  launch() {
    if (this.attachedToPaddle) {
      this.attachedToPaddle = false;
      this.paddle = null;

      const angle = Phaser.Math.Between(-45, 45);
      this.body.setVelocity(
        Math.sin(Phaser.Math.DegToRad(angle)) * this.speed,
        -this.speed
      );
    }
  }

  setFireball(active) {
    this.isFireball = active;

    if (active) {
      this.setTint(0xff4400);
      if (this.glow) {
        this.glow.setFillStyle(0xff4400);
      }
      this.setScale(1.3);
    } else {
      this.clearTint();
      if (this.glow) {
        this.glow.setFillStyle(0xffffff);
      }
      this.setScale(1);
    }
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    if (this.attachedToPaddle && this.paddle) {
      this.setPosition(this.paddle.x, this.paddle.y - 30);
      this.body.setVelocity(0, 0);
    }

    // 글로우 위치 업데이트
    if (this.glow) {
      this.glow.setPosition(this.x, this.y);
    }

    // 속도 제한 (너무 느려지지 않게)
    if (!this.attachedToPaddle) {
      const velocity = this.body.velocity;
      const currentSpeed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);

      if (currentSpeed > 0 && currentSpeed < 300) {
        const scale = 350 / currentSpeed;
        this.body.setVelocity(velocity.x * scale, velocity.y * scale);
      }

      // 최대 속도 제한
      if (currentSpeed > 800) {
        const scale = 800 / currentSpeed;
        this.body.setVelocity(velocity.x * scale, velocity.y * scale);
      }
    }
  }

  destroy(fromScene) {
    if (this.glow) {
      this.glow.destroy();
    }
    super.destroy(fromScene);
  }
}
