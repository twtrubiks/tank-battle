/**
 * 主選單場景
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';
import SaveManager from '../managers/SaveManager';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MENU });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 初始化存檔管理器
    this.saveManager = new SaveManager();
    const saveData = this.saveManager.load();
    const highScore = saveData.highScore;
    const currentLevel = saveData.currentLevel;

    // 添加裝飾邊框（經典風格）
    const graphics = this.add.graphics();
    graphics.lineStyle(4, 0xFFCC00);
    graphics.strokeRect(20, 20, width - 40, height - 40);
    graphics.lineStyle(2, 0xFF8800);
    graphics.strokeRect(24, 24, width - 48, height - 48);

    // 標題（像素風格）
    const titleText = this.add.text(width / 2, 100, '坦 克 大 戰', {
      fontFamily: 'Courier New, monospace',
      fontSize: '56px',
      fontStyle: 'bold',
      fill: '#FFCC00',
      stroke: '#000000',
      strokeThickness: 4,
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: '#FF8800',
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5);

    // 標題閃爍效果
    this.tweens.add({
      targets: titleText,
      alpha: 0.7,
      duration: 800,
      yoyo: true,
      repeat: -1
    });

    // 副標題（英文）
    this.add.text(width / 2, 160, 'BATTLE CITY', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 顯示最高分和當前關卡
    const statsY = 210;
    this.add.text(width / 2, statsY, `最高分數: ${highScore}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      fill: '#FFD700',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.add.text(width / 2, statsY + 30, `當前關卡: ${currentLevel}`, {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      fontStyle: 'bold',
      fill: '#00FF00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    // 裝飾坦克圖示
    this.createDecorativeTanks(width, height);

    // 開始按鈕（像素風格）
    const buttonY = height / 2 + 20;
    const buttonBg = this.add.rectangle(width / 2, buttonY, 280, 60, 0x333333);
    buttonBg.setStrokeStyle(3, 0xFFCC00);

    const startButton = this.add.text(width / 2, buttonY, '▶  開 始 遊 戲', {
      fontFamily: 'Courier New, monospace',
      fontSize: '28px',
      fontStyle: 'bold',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setInteractive();

    // 按鈕互動效果
    buttonBg.setInteractive();
    buttonBg.on('pointerdown', () => {
      // 從當前關卡開始遊戲
      this.scene.start(SCENES.GAME, { level: currentLevel });
    });

    buttonBg.on('pointerover', () => {
      buttonBg.setFillStyle(0x555555);
      buttonBg.setStrokeStyle(4, 0xFFFF00);
      startButton.setStyle({ fill: '#FFFF00' });
      this.tweens.add({
        targets: [buttonBg, startButton],
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100
      });
    });

    buttonBg.on('pointerout', () => {
      buttonBg.setFillStyle(0x333333);
      buttonBg.setStrokeStyle(3, 0xFFCC00);
      startButton.setStyle({ fill: '#FFFFFF' });
      this.tweens.add({
        targets: [buttonBg, startButton],
        scaleX: 1,
        scaleY: 1,
        duration: 100
      });
    });

    startButton.on('pointerdown', () => {
      // 從當前關卡開始遊戲
      this.scene.start(SCENES.GAME, { level: currentLevel });
    });

    // 控制說明（美化後）
    const instructionsY = height - 150;
    this.add.text(width / 2, instructionsY, '═══ 遊 戲 操 作 ═══', {
      fontFamily: 'Courier New, monospace',
      fontSize: '20px',
      fontStyle: 'bold',
      fill: '#FFCC00',
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5);

    this.add.text(width / 2, instructionsY + 35, '方向鍵 - 移動坦克', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5);

    this.add.text(width / 2, instructionsY + 60, '空白鍵 - 發射子彈', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5);

    this.add.text(width / 2, instructionsY + 85, 'P 鍵 - 暫停遊戲', {
      fontFamily: 'Courier New, monospace',
      fontSize: '16px',
      fill: '#FFFFFF',
      stroke: '#000000',
      strokeThickness: 1
    }).setOrigin(0.5);

    // 版本資訊
    this.add.text(width / 2, height - 30, 'v1.0.0 - Classic Edition', {
      fontFamily: 'Courier New, monospace',
      fontSize: '12px',
      fill: '#888888'
    }).setOrigin(0.5);
  }

  /**
   * 創建裝飾用的坦克圖示
   */
  createDecorativeTanks(width, height) {
    // 左側坦克
    const leftTank = this.add.sprite(100, height / 2, 'player_tank');
    leftTank.setScale(1.5);
    this.tweens.add({
      targets: leftTank,
      y: height / 2 - 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 右側坦克
    const rightTank = this.add.sprite(width - 100, height / 2, 'enemy_basic');
    rightTank.setScale(1.5);
    rightTank.setAngle(180);
    this.tweens.add({
      targets: rightTank,
      y: height / 2 + 10,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
}
