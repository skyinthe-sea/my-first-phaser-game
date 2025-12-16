import Phaser from 'phaser';

export default class TitleScene extends Phaser.Scene {
  constructor() {
    super({ key: 'TitleScene' });
  }

  create() {
    const { width, height } = this.scale;
    const uiHeight = 60;
    const bottomUiHeight = 60;
    const playAreaY = uiHeight;
    const playAreaH = height - uiHeight - bottomUiHeight;
    const centerX = width / 2;
    const centerY = playAreaY + playAreaH / 2;

    const colors = {
      bgTop: 0x0d1117,
      bgBottom: 0x070a0f,
      hud: 0x1a1a1a,
      accent: 0x00ff00,
      accentSoft: 0x00ff88,
      cyan: 0x00ffff
    };

    this.cameras.main.fadeIn(200, 0, 0, 0);

    // Background (slightly richer than the old flat fill, but same tone)
    const bg = this.add.graphics();
    bg.fillGradientStyle(colors.bgTop, colors.bgTop, colors.bgBottom, colors.bgBottom, 1);
    bg.fillRect(0, 0, width, height);

    // Playfield grid to match in-game gridSize vibe
    const grid = this.add.graphics();
    grid.lineStyle(1, colors.accent, 0.06);
    const gridSize = 20;
    for (let x = 0; x <= width; x += gridSize) {
      grid.lineBetween(x, playAreaY, x, playAreaY + playAreaH);
    }
    for (let y = playAreaY; y <= playAreaY + playAreaH; y += gridSize) {
      grid.lineBetween(0, y, width, y);
    }

    // Subtle glow pockets (keeps the in-game neon feel)
    const glow = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    glow.fillStyle(colors.accentSoft, 0.05);
    glow.fillCircle(120, playAreaY + 120, 180);
    glow.fillStyle(colors.cyan, 0.04);
    glow.fillCircle(width - 140, playAreaY + 220, 220);

    // Pixel noise (stable seed so it doesn't feel like a filter flicker)
    const rng = new Phaser.Math.RandomDataGenerator(['title-ui-v2']);
    const noise = this.add.graphics();
    const speckColors = [colors.accent, colors.cyan, 0xffffff];
    for (let i = 0; i < 220; i++) {
      const x = rng.between(0, width);
      const y = rng.between(playAreaY, playAreaY + playAreaH);
      noise.fillStyle(rng.pick(speckColors), rng.realInRange(0.03, 0.08));
      noise.fillRect(x, y, 1, 1);
    }

    // Top/bottom HUD bars (match SnakeGame palette)
    this.add.rectangle(0, 0, width, uiHeight, colors.hud, 0.95).setOrigin(0, 0);
    this.add.rectangle(0, height - bottomUiHeight, width, bottomUiHeight, colors.hud, 0.95).setOrigin(0, 0);
    this.add.rectangle(0, uiHeight, width, 2, colors.accent, 0.3).setOrigin(0, 0);
    this.add.rectangle(0, height - bottomUiHeight - 2, width, 2, colors.accent, 0.3).setOrigin(0, 0);

    // Subtle scanline sweep through the playfield
    const scanline = this.add.rectangle(centerX, playAreaY - 6, width, 10, colors.accent, 0.045).setOrigin(0.5, 0);
    scanline.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: scanline,
      y: playAreaY + playAreaH,
      duration: 2400,
      repeat: -1,
      ease: 'Linear'
    });

    // Title glow (keeps prior vibe; slightly cleaner)
    const titleGlow = this.add.circle(centerX, centerY - 92, 160, colors.accent, 0.055).setOrigin(0.5);
    titleGlow.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: titleGlow,
      alpha: 0.12,
      yoyo: true,
      duration: 1300,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // Title text (+ subtle cyan ghost for a "polished" UI look)
    const titleGhost = this.add.text(centerX + 2, centerY - 94, 'SNAKE 2026', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#00ffff',
      fontStyle: 'bold',
      letterSpacing: 2
    }).setOrigin(0.5);
    titleGhost.setAlpha(0.22);
    titleGhost.setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({
      targets: titleGhost,
      x: centerX + 4,
      alpha: 0.3,
      yoyo: true,
      duration: 900,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.add.text(centerX, centerY - 96, 'SNAKE 2026', {
      fontFamily: 'monospace',
      fontSize: '64px',
      color: '#00ff00',
      fontStyle: 'bold',
      stroke: '#003300',
      strokeThickness: 8,
      letterSpacing: 2,
      shadow: { offsetX: 0, offsetY: 0, color: '#00ff00', blur: 12, fill: true }
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 42, 'Pixel Storm', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#00ffff',
      letterSpacing: 2,
      align: 'center'
    }).setOrigin(0.5);

    // Start button (same interactions, slightly cleaner visuals)
    const buttonWidth = 240;
    const buttonHeight = 54;
    const button = this.add.container(centerX, centerY + 52);
    const buttonGlow = this.add.rectangle(0, 0, buttonWidth + 10, buttonHeight + 10, colors.accentSoft, 0.22);
    buttonGlow.setBlendMode(Phaser.BlendModes.ADD);
    const buttonBg = this.add.rectangle(0, 0, buttonWidth, buttonHeight, 0x1a472a, 1).setStrokeStyle(2, colors.accentSoft, 1);
    const buttonHighlight = this.add.rectangle(0, -buttonHeight / 2 + 10, buttonWidth - 10, 8, colors.accentSoft, 0.2);
    const buttonLabel = this.add.text(0, 0, 'START GAME', {
      fontFamily: 'monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#00ff88',
      letterSpacing: 2
    }).setOrigin(0.5);
    button.add([buttonGlow, buttonBg, buttonHighlight, buttonLabel]);
    button.setSize(buttonWidth, buttonHeight);
    button.setInteractive(
      new Phaser.Geom.Rectangle(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight),
      Phaser.Geom.Rectangle.Contains
    );

    const handleHover = (isHovering) => {
      buttonGlow.setAlpha(isHovering ? 0.35 : 0.22);
      buttonHighlight.setAlpha(isHovering ? 0.35 : 0.2);
      buttonBg.setFillStyle(isHovering ? 0x205c36 : 0x1a472a, 1);
      buttonLabel.setColor(isHovering ? '#d6ffe9' : '#00ff88');
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

    // Input hint (design only; keys already work)
    const hint = this.add.text(centerX, height - bottomUiHeight / 2, 'PRESS SPACE / ENTER', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#00ff00',
      stroke: '#001a00',
      strokeThickness: 3,
      letterSpacing: 1
    }).setOrigin(0.5);
    this.tweens.add({
      targets: hint,
      alpha: 0.65,
      yoyo: true,
      duration: 1100,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.input.keyboard.once('keydown-SPACE', startGame);
    this.input.keyboard.once('keydown-ENTER', startGame);
  }
}
