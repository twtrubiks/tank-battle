/**
 * 關卡完成場景
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';
import SaveManager from '../managers/SaveManager';

export default class LevelCompleteScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.LEVEL_COMPLETE });
  }

  init(data) {
    this.score = data.score || 0;
    this.currentLevel = data.level || 1;
    this.nextLevel = this.currentLevel + 1;
    this.lives = data.lives || 3;
    this.starLevel = data.starLevel || 0;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 初始化存檔管理器並完成關卡
    this.saveManager = new SaveManager();
    this.saveManager.completeLevel(this.currentLevel, this.score);

    // 檢查是否為新高分
    const highScore = this.saveManager.getHighScore();
    const isNewHighScore = this.score === highScore;

    // 勝利背景覆蓋
    const overlay = this.add.rectangle(0, 0, width, height, 0x003300, 0.7);
    overlay.setOrigin(0, 0);

    // 裝飾邊框
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0x44FF44);
    graphics.strokeRect(40, 40, width - 80, height - 80);
    graphics.lineStyle(2, 0x00CC00);
    graphics.strokeRect(44, 44, width - 88, height - 88);

    // 勝利星星裝飾
    this.createVictoryStars(width, height);

    // 關卡完成標題
    const titleText = this.add.text(width / 2, 120, 'STAGE CLEAR!', {
      fontFamily: 'Courier New, monospace',
      fontSize: '64px',
      fontStyle: 'bold',
      fill: '#44FF44',
      stroke: '#000000',
      strokeThickness: 6,
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: '#00CC00',
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5);

    // 標題閃爍效果
    this.tweens.add({
      targets: titleText,
      alpha: 0.7,
      duration: 500,
      yoyo: true,
      repeat: -1
    });

    // 副標題
    this.add.text(width / 2, 190, '任務完成！', {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 統計資訊
    const statsY = height / 2 - 20;
    this.add.text(width / 2, statsY - 30, '═══ 戰 鬥 結 果 ═══', {
      fontFamily: 'Courier New, monospace',
      fontSize: '22px',
      fontStyle: 'bold',
      fill: '#FFCC00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.add.text(width / 2, statsY + 10, `當前分數: ${this.score}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 如果是新高分，顯示特別標註
    if (isNewHighScore) {
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

    this.add.text(width / 2, statsY + 80, `完成關卡: ${this.currentLevel}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '24px',
      fill: '#AAAAAA',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 下一關按鈕（檢查是否還有下一關）
    if (this.nextLevel <= 5) {
      this.createButton(width / 2, height - 150, `▶  第 ${this.nextLevel} 關`, () => {
        this.scene.start(SCENES.GAME, {
          level: this.nextLevel,
          lives: this.lives,
          starLevel: this.starLevel
        });
      });
    } else {
      // 已完成所有關卡
      this.createButton(width / 2, height - 150, '返回主選單', () => {
        this.scene.start(SCENES.MENU);
      });
    }

    // 倒數提示（只在有下一關時顯示）
    if (this.nextLevel <= 5) {
      const countdownText = this.add.text(width / 2, height - 80, '3 秒後自動進入下一關...', {
        fontFamily: 'Courier New, monospace',
        fontSize: '16px',
        fill: '#AAAAAA',
        stroke: '#000000',
        strokeThickness: 1
      }).setOrigin(0.5);

      // 倒數計時器
      let countdown = 3;
      this.time.addEvent({
        delay: 1000,
        repeat: 2,
        callback: () => {
          countdown--;
          if (countdown > 0) {
            countdownText.setText(`${countdown} 秒後自動進入下一關...`);
          }
        }
      });

      // 3 秒後自動進入下一關
      this.time.delayedCall(3000, () => {
        this.scene.start(SCENES.GAME, {
          level: this.nextLevel,
          lives: this.lives,
          starLevel: this.starLevel
        });
      });
    } else {
      // 已完成所有關卡
      const congratsText = this.add.text(width / 2, height - 80, '恭喜！您已完成所有關卡！', {
        fontFamily: 'Courier New, monospace',
        fontSize: '20px',
        fontStyle: 'bold',
        fill: '#FFD700',
        stroke: '#000000',
        strokeThickness: 2
      }).setOrigin(0.5);

      this.tweens.add({
        targets: congratsText,
        alpha: 0.6,
        duration: 600,
        yoyo: true,
        repeat: -1
      });
    }
  }

  createVictoryStars(width, height) {
    // 創建隨機閃爍的星星裝飾
    for (let i = 0; i < 20; i++) {
      const x = 80 + Math.random() * (width - 160);
      const y = 80 + Math.random() * (height - 160);
      const star = this.add.text(x, y, '★', {
        fontSize: '24px',
        fill: '#FFFF00'
      }).setOrigin(0.5);

      this.tweens.add({
        targets: star,
        alpha: 0.2,
        scale: 0.5,
        duration: 800 + Math.random() * 400,
        delay: Math.random() * 1000,
        yoyo: true,
        repeat: -1
      });
    }
  }

  createButton(x, y, text, callback) {
    const buttonBg = this.add.rectangle(x, y, 280, 50, 0x333333);
    buttonBg.setStrokeStyle(3, 0x44FF44);

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
      buttonBg.setStrokeStyle(3, 0x44FF44);
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
