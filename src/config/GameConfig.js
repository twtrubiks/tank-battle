/**
 * Phaser 遊戲配置
 */

import Phaser from 'phaser';
import { GAME_CONFIG, SCENES } from '../utils/Constants';

// 匯入場景（稍後建立）
import BootScene from '../scenes/BootScene';
import PreloadScene from '../scenes/PreloadScene';
import MenuScene from '../scenes/MenuScene';
import GameScene from '../scenes/GameScene';
import PauseScene from '../scenes/PauseScene';
import GameOverScene from '../scenes/GameOverScene';
import LevelCompleteScene from '../scenes/LevelCompleteScene';

const config = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: GAME_CONFIG.WIDTH,
  height: GAME_CONFIG.HEIGHT,
  backgroundColor: '#000000',

  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,           // 關閉 debug 模式，移除碰撞框和速度線
      fps: 60
    }
  },

  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    GameScene,
    PauseScene,
    GameOverScene,
    LevelCompleteScene
  ],

  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_CONFIG.WIDTH,
    height: GAME_CONFIG.HEIGHT
  },

  render: {
    pixelArt: true,         // 像素風格，關閉抗鋸齒
    antialias: false,
    roundPixels: true
  },

  audio: {
    disableWebAudio: false
  }
};

export default config;
