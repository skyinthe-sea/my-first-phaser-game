export default class ParticleManager {
  constructor(scene) {
    this.scene = scene;
  }

  brickDestroy(x, y, color) {
    // 폭발 파티클
    for (let i = 0; i < 20; i++) {
      const angle = (Math.PI * 2 * i) / 20;
      const speed = Phaser.Math.Between(100, 300);

      const particle = this.scene.add.circle(x, y, Phaser.Math.Between(3, 8), color);

      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      this.scene.tweens.add({
        targets: particle,
        x: x + velocityX * 0.5,
        y: y + velocityY * 0.5,
        alpha: 0,
        scale: 0,
        duration: 800,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 중앙 폭발 링
    const ring = this.scene.add.circle(x, y, 10, color, 0.5);
    this.scene.tweens.add({
      targets: ring,
      scale: 5,
      alpha: 0,
      duration: 500,
      ease: 'Power2',
      onComplete: () => ring.destroy()
    });

    // 광선 효과
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const length = 40;

      const line = this.scene.add.line(
        x, y,
        0, 0,
        Math.cos(angle) * length,
        Math.sin(angle) * length,
        0xffffff,
        0.8
      ).setLineWidth(2);

      this.scene.tweens.add({
        targets: line,
        alpha: 0,
        duration: 300,
        ease: 'Power2',
        onComplete: () => line.destroy()
      });
    }
  }

  brickHit(x, y, color) {
    // 히트 파티클
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = Phaser.Math.Between(50, 150);

      const particle = this.scene.add.circle(x, y, Phaser.Math.Between(2, 5), color);

      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      this.scene.tweens.add({
        targets: particle,
        x: x + velocityX * 0.3,
        y: y + velocityY * 0.3,
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }
  }

  paddleHit(x, y) {
    // 패들 히트 파티클
    for (let i = 0; i < 10; i++) {
      const offsetX = Phaser.Math.Between(-30, 30);
      const particle = this.scene.add.circle(
        x + offsetX,
        y,
        Phaser.Math.Between(2, 4),
        0xff0080
      );

      this.scene.tweens.add({
        targets: particle,
        y: y - Phaser.Math.Between(20, 40),
        alpha: 0,
        duration: 400,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 충격파
    const wave = this.scene.add.ellipse(x, y, 60, 20, 0xff0080, 0.5);
    this.scene.tweens.add({
      targets: wave,
      scaleX: 2,
      scaleY: 0.5,
      alpha: 0,
      duration: 300,
      ease: 'Power2',
      onComplete: () => wave.destroy()
    });
  }

  powerUpCollect(x, y) {
    // 수집 효과
    const colors = [0xff0080, 0x00ff88, 0x0088ff, 0xffdd00];

    for (let i = 0; i < 30; i++) {
      const angle = (Math.PI * 2 * i) / 30;
      const speed = Phaser.Math.Between(100, 200);
      const color = Phaser.Utils.Array.GetRandom(colors);

      const particle = this.scene.add.star(
        x, y,
        5,
        Phaser.Math.Between(3, 6),
        Phaser.Math.Between(6, 10),
        color
      );

      const velocityX = Math.cos(angle) * speed;
      const velocityY = Math.sin(angle) * speed;

      this.scene.tweens.add({
        targets: particle,
        x: x + velocityX * 0.4,
        y: y + velocityY * 0.4,
        angle: 360,
        alpha: 0,
        scale: 0,
        duration: 600,
        ease: 'Power2',
        onComplete: () => particle.destroy()
      });
    }

    // 빛나는 링
    for (let i = 0; i < 3; i++) {
      const ring = this.scene.add.circle(x, y, 15, 0xffffff, 0.6);
      this.scene.tweens.add({
        targets: ring,
        scale: 3,
        alpha: 0,
        duration: 600,
        delay: i * 100,
        ease: 'Power2',
        onComplete: () => ring.destroy()
      });
    }
  }

  screenShake() {
    this.scene.cameras.main.shake(200, 0.005);
  }

  flash(color = 0xffffff) {
    this.scene.cameras.main.flash(200,
      (color >> 16) & 0xff,
      (color >> 8) & 0xff,
      color & 0xff
    );
  }
}
