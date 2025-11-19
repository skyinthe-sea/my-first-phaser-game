import Phaser from 'phaser';
import SnakeGame from './scenes/SnakeGame.js';

const config = {
  type: Phaser.AUTO,
  width: 800,
  height: 600,
  parent: 'game-container',
  backgroundColor: '#2d2d2d',
  scene: [SnakeGame],
  pixelArt: true
};

const game = new Phaser.Game(config);
