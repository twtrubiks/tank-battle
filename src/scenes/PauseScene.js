/**
 * 暫停場景
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.PAUSE });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 半透明背景
    this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0);

    // 裝飾邊框
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0xFFCC00);
    graphics.strokeRect(width / 2 - 200, height / 2 - 150, 400, 300);
    graphics.lineStyle(2, 0xFF8800);
    graphics.strokeRect(width / 2 - 196, height / 2 - 146, 392, 292);

    // 暫停標題
    const titleText = this.add.text(width / 2, height / 2 - 60, 'PAUSE', {
      fontFamily: 'Courier New, monospace',
      fontSize: '72px',
      fontStyle: 'bold',
      fill: '#FFCC00',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: '#FF8800',
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5);

    // 標題脈動效果
    this.tweens.add({
      targets: titleText,
      scaleX: 1.05,
      scaleY: 1.05,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 副標題
    this.add.text(width / 2, height / 2 + 20, '遊戲暫停中', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 繼續遊戲提示
    const continueText = this.add.text(width / 2, height / 2 + 70, '按 [P] 鍵繼續', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fill: '#AAAAAA',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5);

    // 提示文字閃爍
    this.tweens.add({
      targets: continueText,
      alpha: 0.3,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    // 附加說明
    this.add.text(width / 2, height / 2 + 110, '或點擊螢幕任意位置', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      fill: '#666666'
    }).setOrigin(0.5);

    // 監聽繼續遊戲鍵
    this.input.keyboard.on('keydown-P', () => {
      this.resumeGame();
    });

    // 點擊螢幕繼續
    this.input.on('pointerdown', () => {
      this.resumeGame();
    });
  }

  resumeGame() {
    this.scene.resume(SCENES.GAME);
    this.scene.stop();
  }
}
