import Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width, height } = this.cameras.main;

    // 배경 그라디언트 효과
    const graphics = this.add.graphics();
    graphics.fillGradientStyle(0x1a1a2e, 0x1a1a2e, 0x0a0a0a, 0x0a0a0a, 1);
    graphics.fillRect(0, 0, width, height);

    // 파티클 배경
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(0, width);
      const y = Phaser.Math.Between(0, height);
      const particle = this.add.circle(x, y, 2, 0xff0080, 0.3);

      this.tweens.add({
        targets: particle,
        alpha: 0.8,
        duration: Phaser.Math.Between(1000, 2000),
        yoyo: true,
        repeat: -1
      });
    }

    // 타이틀
    const title = this.add.text(width / 2, height / 3, 'BREAKOUT', {
      fontFamily: 'Arial',
      fontSize: '120px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#ff0080',
      strokeThickness: 8
    }).setOrigin(0.5);

    const subtitle = this.add.text(width / 2, height / 3 + 90, 'INFERNO', {
      fontFamily: 'Arial',
      fontSize: '80px',
      fontStyle: 'bold',
      color: '#ff0080',
      stroke: '#ffffff',
      strokeThickness: 4
    }).setOrigin(0.5);

    // 타이틀 애니메이션
    this.tweens.add({
      targets: [title, subtitle],
      scale: 1.05,
      duration: 1000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 시작 버튼
    const startText = this.add.text(width / 2, height / 2 + 150, 'CLICK TO START', {
      fontFamily: 'Arial',
      fontSize: '40px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5);

    this.tweens.add({
      targets: startText,
      alpha: 0.3,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // 조작 설명
    this.add.text(width / 2, height - 100, '← → 방향키로 패들 이동 | SPACE로 공 발사', {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#888888'
    }).setOrigin(0.5);

    // 클릭으로 게임 시작
    this.input.on('pointerdown', () => {
      this.cameras.main.fade(500, 0, 0, 0);
      this.time.delayedCall(500, () => {
        this.scene.start('GameScene');
      });
    });
  }
}
