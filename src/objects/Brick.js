import Phaser from 'phaser';

export default class Brick extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, width, height, color, points, hits = 1) {
    const textureName = `brick_${color}_${width}_${height}_${hits}_${Date.now()}_${Math.random()}`;

    // Create a graphics object to draw the brick
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    // Main brick color
    graphics.fillStyle(color, 1);
    graphics.fillRoundedRect(0, 0, width, height, 5);

    // Highlight
    graphics.fillStyle(0xffffff, 0.3);
    graphics.fillRoundedRect(5, 5, width - 10, height / 3, 3);

    // Border
    graphics.lineStyle(3, 0xffffff, hits > 1 ? 0.8 : 0.5);
    graphics.strokeRoundedRect(0, 0, width, height, 5);

    graphics.generateTexture(textureName, width, height);
    graphics.destroy();

    super(scene, x, y, textureName);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setImmovable(true);
    this.body.setAllowGravity(false);

    this.points = points;
    this.maxHits = hits;
    this.currentHits = 0;
    this.color = color;

    // 반짝임 효과
    scene.tweens.add({
      targets: this,
      alpha: 0.8,
      duration: Phaser.Math.Between(2000, 4000),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }

  hit() {
    this.currentHits++;

    if (this.currentHits >= this.maxHits) {
      // 파괴 애니메이션
      this.scene.tweens.add({
        targets: this,
        alpha: 0,
        scale: 1.5,
        duration: 200,
        onComplete: () => {
          this.destroy();
        }
      });

      return true; // 벽돌이 파괴됨
    } else {
      // 히트 애니메이션
      this.setTint(0xffffff);
      this.scene.time.delayedCall(100, () => {
        this.clearTint();
      });

      this.scene.tweens.add({
        targets: this,
        scaleX: 1.1,
        scaleY: 1.1,
        duration: 100,
        yoyo: true
      });

      return false; // 벽돌이 아직 살아있음
    }
  }
}
