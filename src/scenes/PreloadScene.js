/**
 * 預載場景
 * 載入所有遊戲資源
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';
import SoundGenerator from '../utils/SoundGenerator';

export default class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.PRELOAD });
  }

  preload() {
    // 建立載入進度顯示
    this.createLoadingBar();

    // 載入所有資源
    this.loadAssets();

    // 監聽載入進度
    this.load.on('progress', this.onLoadProgress, this);
    this.load.on('complete', this.onLoadComplete, this);
  }

  createLoadingBar() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 載入文字
    this.loadingText = this.add.text(width / 2, height / 2 - 50, '載入中...', {
      font: '20px Arial',
      fill: '#ffffff'
    });
    this.loadingText.setOrigin(0.5, 0.5);

    // 進度條
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x222222, 0.8);
    progressBox.fillRect(width / 2 - 160, height / 2 - 25, 320, 50);

    this.progressBar = progressBar;
    this.progressBarWidth = 300;
    this.progressBarHeight = 30;
    this.progressBarX = width / 2 - 150;
    this.progressBarY = height / 2 - 15;

    // 百分比文字
    this.percentText = this.add.text(width / 2, height / 2, '0%', {
      font: '18px Arial',
      fill: '#ffffff'
    });
    this.percentText.setOrigin(0.5, 0.5);
  }

  onLoadProgress(value) {
    this.percentText.setText(parseInt(value * 100) + '%');
    this.progressBar.clear();
    this.progressBar.fillStyle(0xffffff, 1);
    this.progressBar.fillRect(
      this.progressBarX,
      this.progressBarY,
      this.progressBarWidth * value,
      this.progressBarHeight
    );
  }

  onLoadComplete() {
    this.progressBar.destroy();
    this.loadingText.destroy();
    this.percentText.destroy();
  }

  loadAssets() {
    // 載入精靈圖（使用程序生成的像素藝術）
    // 參考經典 Battle City 風格

    // 坦克
    this.createTankSprite('player_tank', 0xFFCC00, 0xFF8800); // 黃色玩家坦克
    this.createTankSprite('enemy_basic', 0xC0C0C0, 0x808080); // 灰色基礎敵人
    this.createTankSprite('enemy_fast', 0xFF6B6B, 0xCC0000); // 紅色快速敵人
    this.createTankSprite('enemy_power', 0xFFD93D, 0xFFAA00); // 黃色強力敵人
    this.createTankSprite('enemy_armor', 0x6BCB77, 0x228B22); // 綠色裝甲敵人

    // 子彈
    this.createBulletSprite('bullet', 8, 8);

    // 牆壁
    this.createBrickWallSprite('brick', 32, 32);
    this.createSteelWallSprite('steel', 32, 32);
    this.createWaterSprite('water', 32, 32);
    this.createIceSprite('ice', 32, 32);
    this.createForestSprite('forest', 32, 32);

    // 基地（老鷹圖示）
    this.createBaseSprite('base', 32, 32);

    // 道具
    this.createPowerUpSprite('powerup_tank', 'TANK');
    this.createPowerUpSprite('powerup_star', 'STAR');
    this.createPowerUpSprite('powerup_grenade', 'GREN');
    this.createPowerUpSprite('powerup_shovel', 'SHOV');
    this.createPowerUpSprite('powerup_helmet', 'HELM');
    this.createPowerUpSprite('powerup_clock', 'TIME');

    // 載入關卡數據（JSON）
    this.loadLevelData();

    // 生成程序音效（8-bit 復古風格）
    this.generateRetroSounds();
  }

  /**
   * 載入關卡數據
   */
  loadLevelData() {
    // 載入 5 個關卡的配置檔案
    for (let i = 1; i <= 5; i++) {
      this.load.json(`level_${i}`, `data/level_${i}.json`);
    }
    console.log('✓ 開始載入關卡數據 (1-5)');
  }

  /**
   * 生成復古風格音效
   */
  generateRetroSounds() {
    try {
      // 生成所有音效
      SoundGenerator.generateAllSounds(this);
      console.log('✓ 復古音效生成成功');
    } catch (error) {
      console.warn('音效生成失敗:', error);
      // 即使音效生成失敗，遊戲仍可繼續
    }
  }

  /**
   * 創建坦克精靈（像素藝術風格）
   */
  createTankSprite(key, mainColor, darkColor) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const size = 32;

    // 背景透明
    g.clear();

    // 坦克履帶（深色）
    g.fillStyle(darkColor);
    g.fillRect(2, 4, 6, 24);  // 左履帶
    g.fillRect(24, 4, 6, 24); // 右履帶

    // 坦克主體（亮色）
    g.fillStyle(mainColor);
    g.fillRect(8, 6, 16, 20);

    // 炮塔
    g.fillStyle(mainColor);
    g.fillRect(12, 10, 8, 8);

    // 炮管（向上）
    g.fillStyle(darkColor);
    g.fillRect(14, 2, 4, 12);

    // 添加細節：履帶紋理
    g.fillStyle(0x000000);
    for (let i = 0; i < 5; i++) {
      g.fillRect(3, 6 + i * 4, 4, 2);
      g.fillRect(25, 6 + i * 4, 4, 2);
    }

    // 邊框
    g.lineStyle(1, 0x000000);
    g.strokeRect(2, 4, 6, 24);
    g.strokeRect(24, 4, 6, 24);
    g.strokeRect(8, 6, 16, 20);

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /**
   * 創建子彈精靈
   */
  createBulletSprite(key, width, height) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // 子彈核心（白色）
    g.fillStyle(0xFFFFFF);
    g.fillCircle(width / 2, height / 2, width / 2 - 1);

    // 子彈外圈（黃色）
    g.lineStyle(1, 0xFFDD00);
    g.strokeCircle(width / 2, height / 2, width / 2 - 1);

    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * 創建磚牆精靈（磚塊圖案）
   */
  createBrickWallSprite(key, width, height) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    const brickColor = 0xD2691E;
    const mortarColor = 0x8B4513;

    // 砂漿底色
    g.fillStyle(mortarColor);
    g.fillRect(0, 0, width, height);

    // 繪製磚塊圖案（4x4 磚塊）
    g.fillStyle(brickColor);
    const brickW = 7;
    const brickH = 7;
    const gap = 1;

    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        const offset = (row % 2) * (brickW / 2);
        const x = col * (brickW + gap) + offset;
        const y = row * (brickH + gap);

        if (x + brickW <= width) {
          g.fillRect(x, y, brickW, brickH);

          // 磚塊紋理
          g.fillStyle(0xCD853F);
          g.fillRect(x + 1, y + 1, brickW - 2, 2);
          g.fillStyle(brickColor);
        }
      }
    }

    // 邊框
    g.lineStyle(1, 0x654321);
    g.strokeRect(0, 0, width, height);

    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * 創建鋼牆精靈（金屬圖案）
   */
  createSteelWallSprite(key, width, height) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // 金屬底色
    g.fillStyle(0xA9A9A9);
    g.fillRect(0, 0, width, height);

    // 金屬板塊圖案（2x2）
    g.lineStyle(2, 0x696969);
    g.strokeRect(2, 2, 12, 12);
    g.strokeRect(18, 2, 12, 12);
    g.strokeRect(2, 18, 12, 12);
    g.strokeRect(18, 18, 12, 12);

    // 鉚釘
    g.fillStyle(0x505050);
    const rivets = [
      [6, 6], [26, 6], [6, 26], [26, 26],  // 角落
      [16, 6], [6, 16], [26, 16], [16, 26]  // 邊緣中點
    ];
    rivets.forEach(([x, y]) => {
      g.fillCircle(x, y, 2);
    });

    // 高光效果
    g.fillStyle(0xDCDCDC);
    g.fillRect(4, 4, 8, 1);
    g.fillRect(20, 4, 8, 1);
    g.fillRect(4, 20, 8, 1);
    g.fillRect(20, 20, 8, 1);

    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * 創建水面精靈（波浪圖案）
   */
  createWaterSprite(key, width, height) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // 深藍色底
    g.fillStyle(0x1E90FF);
    g.fillRect(0, 0, width, height);

    // 波浪圖案
    g.fillStyle(0x4169E1);
    for (let i = 0; i < 4; i++) {
      const y = i * 8;
      g.fillRect(0, y, width, 4);
    }

    // 水波紋
    g.lineStyle(1, 0x87CEEB, 0.7);
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.arc(8 + i * 8, 8, 4, 0, Math.PI, false);
      g.strokePath();
      g.beginPath();
      g.arc(8 + i * 8, 24, 4, 0, Math.PI, false);
      g.strokePath();
    }

    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * 創建冰面精靈
   */
  createIceSprite(key, width, height) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // 淺藍色底
    g.fillStyle(0xE0F6FF);
    g.fillRect(0, 0, width, height);

    // 冰晶圖案
    g.lineStyle(1, 0xB0E0E6);
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const cx = 8 + i * 12;
        const cy = 8 + j * 12;

        g.lineBetween(cx - 4, cy, cx + 4, cy);
        g.lineBetween(cx, cy - 4, cx, cy + 4);
        g.lineBetween(cx - 3, cy - 3, cx + 3, cy + 3);
        g.lineBetween(cx - 3, cy + 3, cx + 3, cy - 3);
      }
    }

    // 高光
    g.fillStyle(0xFFFFFF, 0.5);
    g.fillRect(2, 2, width - 4, height / 2);

    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * 創建森林精靈（樹木圖案）
   */
  createForestSprite(key, width, height) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // 深綠色底
    g.fillStyle(0x228B22);
    g.fillRect(0, 0, width, height);

    // 樹木圖案（4 棵樹）
    const treePositions = [[6, 6], [22, 6], [6, 22], [22, 22]];

    treePositions.forEach(([x, y]) => {
      // 樹幹
      g.fillStyle(0x8B4513);
      g.fillRect(x - 1, y + 2, 2, 4);

      // 樹冠（深綠）
      g.fillStyle(0x006400);
      g.fillCircle(x, y, 4);

      // 樹冠高光（亮綠）
      g.fillStyle(0x32CD32);
      g.fillCircle(x - 1, y - 1, 2);
    });

    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * 創建基地精靈（老鷹圖示）
   */
  createBaseSprite(key, width, height) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });

    // 紅色底（基地顏色）
    g.fillStyle(0xFF4444);
    g.fillRect(0, 0, width, height);

    // 老鷹剪影（黃色）
    g.fillStyle(0xFFCC00);

    // 鷹頭
    g.fillTriangle(16, 6, 10, 12, 22, 12);

    // 鷹眼
    g.fillStyle(0x000000);
    g.fillCircle(13, 10, 1);
    g.fillCircle(19, 10, 1);

    // 鷹身
    g.fillStyle(0xFFCC00);
    g.fillRect(12, 12, 8, 8);

    // 翅膀
    g.fillTriangle(6, 14, 12, 16, 12, 20);
    g.fillTriangle(26, 14, 20, 16, 20, 20);

    // 尾羽
    g.fillTriangle(16, 20, 12, 26, 20, 26);

    // 邊框
    g.lineStyle(2, 0x000000);
    g.strokeRect(0, 0, width, height);

    g.generateTexture(key, width, height);
    g.destroy();
  }

  /**
   * 創建道具精靈
   */
  createPowerUpSprite(key, type) {
    const g = this.make.graphics({ x: 0, y: 0, add: false });
    const size = 32;

    // 閃爍的背景（菱形圖案）
    g.fillStyle(0xFFDD00);
    this.drawStar(g, size / 2, size / 2, 5, size / 2 - 2, size / 4);

    // 內部圖示（白色圓形背景）
    g.fillStyle(0xFFFFFF);
    g.fillCircle(size / 2, size / 2, 12);

    // 圖示文字或符號
    g.fillStyle(0x000000);

    switch(type) {
    case 'TANK':
      // 坦克圖示（簡化版）
      g.fillRect(12, 14, 8, 4);
      g.fillRect(14, 12, 4, 2);
      break;
    case 'STAR':
      // 星星圖示
      this.drawStar(g, size / 2, size / 2, 5, 8, 4);
      break;
    case 'GREN':
      // 手榴彈圖示
      g.fillCircle(size / 2, size / 2 + 2, 6);
      g.fillRect(14, 10, 4, 4);
      break;
    case 'SHOV':
      // 鏟子圖示
      g.fillRect(14, 12, 4, 8);
      g.fillTriangle(16, 20, 12, 24, 20, 24);
      break;
    case 'HELM':
      // 頭盔圖示
      g.fillEllipse(size / 2, size / 2, 8, 6);
      g.fillRect(10, 18, 12, 2);
      break;
    case 'TIME':
      // 時鐘圖示
      g.strokeCircle(size / 2, size / 2, 8);
      g.fillRect(15, 10, 2, 6);
      g.fillRect(15, 16, 6, 2);
      break;
    }

    g.generateTexture(key, size, size);
    g.destroy();
  }

  /**
   * 手動繪製星星
   */
  drawStar(graphics, cx, cy, points, outerRadius, innerRadius) {
    graphics.beginPath();

    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI / points) * i - Math.PI / 2;
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + Math.cos(angle) * radius;
      const y = cy + Math.sin(angle) * radius;

      if (i === 0) {
        graphics.moveTo(x, y);
      } else {
        graphics.lineTo(x, y);
      }
    }

    graphics.closePath();
    graphics.fillPath();
  }

  create() {
    // 資源載入完成，切換到主選單
    this.scene.start(SCENES.MENU);
  }
}
