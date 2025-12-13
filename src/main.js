import Phaser from 'phaser';
import TitleScene from './scenes/TitleScene.js';
import SnakeGame from './scenes/SnakeGame.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 660,
  parent: 'game-container',
  backgroundColor: '#2d2d2d',
  scene: [TitleScene, SnakeGame],
  pixelArt: true
};

const game = new Phaser.Game(config);
