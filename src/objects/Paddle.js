import Phaser from 'phaser';

export default class Paddle extends Phaser.Physics.Arcade.Image {
  constructor(scene, x, y) {
    // 텍스처가 없으면 생성
    if (!scene.textures.exists('paddle')) {
      const graphics = scene.make.graphics({ x: 0, y: 0, add: false });
      graphics.fillStyle(0xff0080, 1);
      graphics.fillRoundedRect(0, 0, 150, 20, 5);
      graphics.fillStyle(0xff4080, 0.5);
      graphics.fillRoundedRect(5, 5, 140, 10, 3);
      graphics.generateTexture('paddle', 150, 20);
      graphics.destroy();
    }

    super(scene, x, y, 'paddle');

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setImmovable(true);
    this.body.setAllowGravity(false);

    this.speed = 8; // 픽셀/프레임

    // 글로우 효과
    this.glowCircle = scene.add.circle(x, y, 0, 0xff0080, 0.3);
    scene.tweens.add({
      targets: this.glowCircle,
      scale: 1.5,
      alpha: 0,
      duration: 1000,
      repeat: -1
    });
  }

  update(leftPressed, rightPressed) {
    const halfWidth = this.width / 2;
    const gameWidth = this.scene.cameras.main.width;

    // 왼쪽 키만 눌림
    if (leftPressed && !rightPressed) {
      this.x -= this.speed;
    }
    // 오른쪽 키만 눌림
    else if (rightPressed && !leftPressed) {
      this.x += this.speed;
    }
    // 둘 다 눌림 또는 둘 다 안 눌림 = 정지

    // 경계 체크
    if (this.x < halfWidth) {
      this.x = halfWidth;
    } else if (this.x > gameWidth - halfWidth) {
      this.x = gameWidth - halfWidth;
    }

    // 글로우 위치 업데이트
    if (this.glowCircle) {
      this.glowCircle.setPosition(this.x, this.y);
    }
  }

  destroy(fromScene) {
    if (this.glowCircle) {
      this.glowCircle.destroy();
    }
    super.destroy(fromScene);
  }
}
