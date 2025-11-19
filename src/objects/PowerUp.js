import Phaser from 'phaser';

export default class PowerUp extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    // 파워업 타입
    const types = ['expand', 'multiball', 'fireball', 'slow', 'life'];
    const type = Phaser.Utils.Array.GetRandom(types);

    // 타입별 색상
    const colors = {
      'expand': 0x00ff88,
      'multiball': 0x0088ff,
      'fireball': 0xff4400,
      'slow': 0xffdd00,
      'life': 0xff0080
    };

    const color = colors[type];
    const textureName = `powerup_${type}_${Date.now()}_${Math.random()}`;

    // Create a graphics object to draw the powerup
    const graphics = scene.make.graphics({ x: 0, y: 0, add: false });

    // Star shape
    graphics.fillStyle(color, 1);
    graphics.lineStyle(2, 0xffffff, 1);

    const size = 25;
    const points = [];
    for (let i = 0; i < 5; i++) {
      const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
      const radius = i % 2 === 0 ? size : size / 2;
      points.push({
        x: size + Math.cos(angle) * radius,
        y: size + Math.sin(angle) * radius
      });
    }

    graphics.beginPath();
    graphics.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      graphics.lineTo(points[i].x, points[i].y);
    }
    graphics.closePath();
    graphics.fillPath();
    graphics.strokePath();

    graphics.generateTexture(textureName, size * 2, size * 2);
    graphics.destroy();

    super(scene, x, y, textureName);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.type = type;
    this.color = color;

    // 물리 설정
    this.body.setVelocityY(150);
    this.body.setCircle(size);
    this.body.setAllowGravity(false);

    // 글로우 효과
    this.glow = scene.add.circle(x, y, size, color, 0.3);

    // 텍스트 (처음 글자)
    const labels = {
      'expand': 'E',
      'multiball': 'M',
      'fireball': 'F',
      'slow': 'S',
      'life': '♥'
    };

    this.label = scene.add.text(x, y, labels[type], {
      fontFamily: 'Arial',
      fontSize: '16px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    // 회전 애니메이션
    scene.tweens.add({
      targets: this,
      angle: 360,
      duration: 2000,
      repeat: -1,
      ease: 'Linear'
    });

    // 글로우 애니메이션
    scene.tweens.add({
      targets: this.glow,
      scale: 1.5,
      alpha: 0.1,
      duration: 800,
      yoyo: true,
      repeat: -1
    });
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);

    // 글로우와 라벨 위치 업데이트
    if (this.glow) {
      this.glow.setPosition(this.x, this.y);
    }
    if (this.label) {
      this.label.setPosition(this.x, this.y);
    }

    // 화면 밖으로 나가면 파괴
    if (this.y > this.scene.cameras.main.height + 50) {
      this.destroy();
    }
  }

  destroy(fromScene) {
    if (this.glow) {
      this.glow.destroy();
    }
    if (this.label) {
      this.label.destroy();
    }
    super.destroy(fromScene);
  }
}
