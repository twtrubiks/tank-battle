/**
 * 遊戲結束場景
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.GAME_OVER });
  }

  init(data) {
    this.finalScore = data.score || 0;
    this.level = data.level || 1;
    this.isNewHighScore = data.isNewHighScore || false;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 暗紅色背景覆蓋
    const overlay = this.add.rectangle(0, 0, width, height, 0x330000, 0.7);
    overlay.setOrigin(0, 0);

    // 裝飾邊框
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0xFF4444);
    graphics.strokeRect(40, 40, width - 80, height - 80);
    graphics.lineStyle(2, 0xCC0000);
    graphics.strokeRect(44, 44, width - 88, height - 88);

    // 遊戲結束標題
    const titleText = this.add.text(width / 2, 120, 'GAME OVER', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      fontStyle: 'bold',
      fill: '#FF4444',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: '#CC0000',
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5);

    // 標題閃爍效果
    this.tweens.add({
      targets: titleText,
      alpha: 0.6,
      duration: 600,
      yoyo: true,
      repeat: -1
    });

    // 副標題
    this.add.text(width / 2, 190, '任務失敗', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 統計資訊框
    const statsY = height / 2 - 20;
    this.add.text(width / 2, statsY - 30, '═══ 戰 鬥 統 計 ═══', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      fontStyle: 'bold',
      fill: '#FFCC00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.add.text(width / 2, statsY + 10, `最終分數: ${this.finalScore}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 如果是新高分，顯示特別標註
    if (this.isNewHighScore) {
      const newHighScoreText = this.add.text(width / 2, statsY + 45, '★ 新紀錄！★', {
        fontFamily: 'Courier New, monospace',
        fontSize: '22px',
        fontStyle: 'bold',
        fill: '#FFD700',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      this.tweens.add({
        targets: newHighScoreText,
        scale: 1.1,
        duration: 400,
        yoyo: true,
        repeat: -1
      });
    }

    this.add.text(width / 2, statsY + 80, `戰至關卡: ${this.level}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      fill: '#AAAAAA',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 創建按鈕
    this.createButton(width / 2, height - 180, '▶  重新開始', () => {
      this.scene.start(SCENES.GAME, { level: 1 });
    });

    this.createButton(width / 2, height - 110, '◀  回主選單', () => {
      this.scene.start(SCENES.MENU);
    });

    // 提示文字
    this.add.text(width / 2, height - 50, '點擊按鈕繼續', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      fill: '#888888'
    }).setOrigin(0.5);
  }

  createButton(x, y, text, callback) {
    const buttonBg = this.add.rectangle(x, y, 280, 50, 0x333333);
    buttonBg.setStrokeStyle(3, 0xFF4444);

    const buttonText = this.add.text(x, y, text, {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    buttonBg.setInteractive();
    buttonBg.on('pointerdown', callback);

    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(0x555555);
      buttonBg.setStrokeStyle(4, 0xFFFF00);
      buttonText.setStyle({ fill: '#FFFF00' });
      this.tweens.add({
        targets: [buttonBg, buttonText],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100
      });
    });

    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x333333);
      buttonBg.setStrokeStyle(3, 0xFF4444);
      buttonText.setStyle({ fill: '#FFFFFF' });
      this.tweens.add({
        targets: [buttonBg, buttonText],
        scaleX: 1,
        scaleY: 1,
        duration: 100
      });
    });
  }
}
