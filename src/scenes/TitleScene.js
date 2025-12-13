import Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width, height } = this.scale;

    this.cameras.main.fadeIn(200, 0, 0, 0);

    // Base background
    this.add.rectangle(0, 0, width, height, 0x0d1117, 1).setOrigin(0, 0);

    // Subtle grid lines to match the in-game HUD tone
    const grid = this.add.graphics({ lineStyle: { width: 1, color: 0x00ff66, alpha: 0.08 } });
    const gridSize = 40;
    for (let x = 0; x <= width; x += gridSize) {
      grid.lineBetween(x, 0, x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      grid.lineBetween(0, y, width, y);
    }

    // Top/bottom HUD bars for continuity with the gameplay UI
    this.add.rectangle(0, 0, width, 64, 0x13181f, 0.92).setOrigin(0, 0);
    this.add.rectangle(0, height - 64, width, 64, 0x13181f, 0.92).setOrigin(0, 0);
    this.add.rectangle(0, 64, width, 2, 0x00ff66, 0.4).setOrigin(0, 0);
    this.add.rectangle(0, height - 66, width, 2, 0x00ff66, 0.4).setOrigin(0, 0);

    // Title glow
    const titleGlow = this.add.rectangle(width / 2, height / 2 - 90, 360, 120, 0x00ff66, 0.05).setOrigin(0.5);
    titleGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: titleGlow,
      alpha: 0.12,
      yoyo: true,
      duration: 1300,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Title text
    this.add.text(width / 2, height / 2 - 96, 'SNAKE 2026', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      color: '#b3ffe4',
      fontStyle: 'bold',
      stroke: '#00ff99',
      strokeThickness: 4,
      shadow: {
        color: '#00ffaa',
        blur: 16,
        fill: true,
        offsetX: 0,
        offsetY: 0
      }
    }).setOrigin(0.5);

    this.add.text(width / 2, height / 2 - 40, 'Pixel Storm', {
      fontFamily: 'Arial',
      fontSize: '16px',
      color: '#8cf7c8',
      letterSpacing: 1,
      align: 'center'
    }).setOrigin(0.5);

    // Start button
    const buttonWidth = 240;
    const buttonHeight = 64;
    const button = this.add.container(width / 2, height / 2 + 40);
    const buttonGlow = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x00ff66, 0.06);
    buttonGlow.setBlendMode(Phaser.BlendModes.ADD);
    const buttonBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x0f1a12, 0.92).setStrokeStyle(2, 0x00ff88, 1);
    const buttonLabel = this.add.text(0, 0, 'START GAME', {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#b3ffd8',
      letterSpacing: 1.5
    }).setOrigin(0.5);
    button.add([buttonGlow, buttonBg, buttonLabel]);
    button.setSize(buttonWidth, buttonHeight);
    button.setInteractive(new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

    const handleHover = (isHovering) => {
      buttonBg.setFillStyle(isHovering ? 0x143320 : 0x0f1a12, 0.95);
      buttonLabel.setColor(isHovering ? '#d6ffe9' : '#b3ffd8');
    };

    let started = false;
    const startGame = () => {
      if (started) return;
      started = true;
      this.cameras.main.fadeOut(250, 0, 0, 0);
      this.time.delayedCall(260, () => {
        this.scene.start('SnakeGame');
      });
    };

    button.on('pointerover', () => handleHover(true));
    button.on('pointerout', () => handleHover(false));
    button.on('pointerdown', startGame);

    this.tweens.add({
      targets: button,
      scaleX: 1.02,
      scaleY: 1.02,
      yoyo: true,
      repeat: -1,
      duration: 900,
      ease: 'Sine.easeInOut'
    });

    this.input.keyboard.once('keydown-SPACE', startGame);
    this.input.keyboard.once('keydown-ENTER', startGame);
  }
}
