/**
 * 主選單場景 — Style A (Refined Classic)
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';
import SaveManager from '../managers/SaveManager';
import {
  PALETTE,
  HEX,
  TEXT_STYLES,
  drawGoldCorners,
  formatScore,
  formatStage
} from '../utils/UITheme';

export default class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.MENU });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.saveManager = new SaveManager();
    const saveData = this.saveManager.load();
    const highScore = saveData.highScore || 0;
    const currentLevel = saveData.currentLevel || 1;

    // 純黑底 + 細微掃描線
    this.add.rectangle(0, 0, width, height, PALETTE.BG_0).setOrigin(0);
    this.drawScanlines(width, height);
    this.drawCornerBrackets(width, height);

    // ===== 上方：年代標記 =====
    this.add.text(width / 2, 84, 'EST · 1985 / REMASTERED', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '10px',
      color: HEX.GOLD_3
    }).setOrigin(0.5).setLetterSpacing(6);

    // ===== 主標題 =====
    // 第二層黑陰影（先繪以位於下層）
    // padding 給足，避免中文字身被 canvas 裁切；shadow 也需要垂直空間
    this.add.text(width / 2 + 8, 178, '坦 克 大 戰', {
      fontFamily: TEXT_STYLES.TITLE_HERO.fontFamily,
      fontSize: '52px',
      color: HEX.BLACK,
      padding: { x: 4, y: 10 }
    }).setOrigin(0.5).setLetterSpacing(8);

    // 主標題（含金色 drop shadow）
    this.add.text(width / 2, 170, '坦 克 大 戰', {
      fontFamily: TEXT_STYLES.TITLE_HERO.fontFamily,
      fontSize: '52px',
      color: HEX.GOLD,
      padding: { x: 4, y: 10 },
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: HEX.GOLD_DEEP,
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5).setLetterSpacing(8);

    this.add.text(width / 2, 224, 'S T E E L · F R O N T', {
      fontFamily: TEXT_STYLES.SUBTITLE.fontFamily,
      fontSize: '12px',
      color: HEX.INK_1
    }).setOrigin(0.5).setLetterSpacing(14);

    // ===== 三欄統計面板 =====
    this.drawStatsBlock(width / 2, 290, highScore, currentLevel);

    // ===== 主開始按鈕 =====
    const buttonY = 480;
    this.createStartButton(width / 2, buttonY, currentLevel);

    // ===== 閃爍提示 =====
    const blinkHint = this.add.text(width / 2, buttonY + 64, 'PRESS ENTER TO START', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '11px',
      color: HEX.INK_1
    }).setOrigin(0.5).setLetterSpacing(5);

    this.tweens.add({
      targets: blinkHint,
      alpha: 0,
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: 'Stepped',
      easeParams: [2]
    });

    // ===== 底部鍵盤提示 =====
    this.drawKeyboardHints(width, height);

    // ===== 版本／存檔資訊 =====
    this.add.text(40, height - 32, 'v2.0 · CLASSIC ED.', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '9px',
      color: HEX.INK_3
    }).setLetterSpacing(3);

    this.add.text(width - 40, height - 32, 'SAVE · LOCAL', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '9px',
      color: HEX.INK_3
    }).setOrigin(1, 0).setLetterSpacing(3);

    // ===== 鍵盤輸入 =====
    this.input.keyboard.on('keydown-ENTER', () => this.startGame(currentLevel));
    this.input.keyboard.on('keydown-SPACE', () => this.startGame(currentLevel));
  }

  /**
   * 三欄統計：HIGH SCORE / LAST RUN / RANK
   */
  drawStatsBlock(cx, cy, highScore, currentLevel) {
    const width = 580;
    const height = 78;
    const x = cx - width / 2;
    const y = cy - height / 2;

    // 上下深金線
    const g = this.add.graphics();
    g.lineStyle(2, PALETTE.GOLD_DEEP);
    g.lineBetween(x, y, x + width, y);
    g.lineBetween(x, y + height, x + width, y + height);

    // 兩條垂直分隔線
    g.lineStyle(1, PALETTE.GOLD_DEEP);
    g.lineBetween(x + width / 3, y + 8, x + width / 3, y + height - 8);
    g.lineBetween(x + (width / 3) * 2, y + 8, x + (width / 3) * 2, y + height - 8);

    // 欄位資料
    const cellW = width / 3;
    const cells = [
      { k: 'HIGH SCORE', v: formatScore(highScore), color: HEX.GOLD_2 },
      { k: 'LAST RUN', v: `STAGE ${formatStage(Math.max(1, currentLevel - 1))}`, color: HEX.INK_0 },
      { k: 'RANK', v: this.deriveRank(highScore), color: HEX.PHOSPHOR }
    ];

    cells.forEach((cell, i) => {
      const cellX = x + cellW * i + cellW / 2;
      this.add.text(cellX, y + 18, cell.k, {
        fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
        fontSize: '9px',
        color: HEX.INK_2
      }).setOrigin(0.5).setLetterSpacing(4);

      this.add.text(cellX, y + 48, cell.v, {
        fontFamily: TEXT_STYLES.VALUE.fontFamily,
        fontSize: '20px',
        color: cell.color
      }).setOrigin(0.5).setLetterSpacing(2);
    });
  }

  deriveRank(highScore) {
    if (highScore >= 100000) return 'ACE';
    if (highScore >= 50000) return 'VETERAN';
    if (highScore >= 20000) return 'SCOUT';
    if (highScore >= 5000) return 'CADET';
    return 'ROOKIE';
  }

  /**
   * 開始按鈕（金底黑字 + 雙層描邊）+ 兩側脈動箭頭
   */
  createStartButton(cx, cy, currentLevel) {
    const w = 320;
    const h = 64;
    const bx = cx - w / 2;
    const by = cy - h / 2;

    // 雙層描邊外框
    const frame = this.add.graphics();
    frame.lineStyle(2, PALETTE.GOLD);
    frame.strokeRect(bx - 6, by - 6, w + 12, h + 12);

    // 主體（金色背景）
    const bg = this.add.rectangle(cx, cy, w, h, PALETTE.GOLD).setInteractive();
    // 底部 4px 深金光影（內陰影模擬）
    this.add.rectangle(cx, cy + h / 2 - 2, w, 4, PALETTE.GOLD_3);

    const label = this.add.text(cx, cy, '►   開 始 遊 戲   ◄', {
      fontFamily: TEXT_STYLES.BTN_PRIMARY.fontFamily,
      fontSize: '20px',
      color: HEX.BG_0,
      padding: { x: 0, y: 4 }
    }).setOrigin(0.5).setLetterSpacing(4);

    // 兩側脈動箭頭
    const leftArrow = this.add.text(bx - 28, cy, '▶', {
      fontFamily: TEXT_STYLES.BTN_PRIMARY.fontFamily,
      fontSize: '16px',
      color: HEX.GOLD
    }).setOrigin(0.5).setFlipX(true);

    const rightArrow = this.add.text(bx + w + 28, cy, '▶', {
      fontFamily: TEXT_STYLES.BTN_PRIMARY.fontFamily,
      fontSize: '16px',
      color: HEX.GOLD
    }).setOrigin(0.5);

    this.tweens.add({
      targets: leftArrow,
      x: bx - 36,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.tweens.add({
      targets: rightArrow,
      x: bx + w + 36,
      alpha: 0.5,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // 互動回饋
    bg.on('pointerover', () => {
      bg.setFillStyle(PALETTE.GOLD_2);
      this.tweens.add({
        targets: [bg, label],
        scaleX: 1.04,
        scaleY: 1.04,
        duration: 100
      });
    });
    bg.on('pointerout', () => {
      bg.setFillStyle(PALETTE.GOLD);
      this.tweens.add({
        targets: [bg, label],
        scaleX: 1,
        scaleY: 1,
        duration: 100
      });
    });
    bg.on('pointerdown', () => this.startGame(currentLevel));
  }

  /**
   * 角落金色括號（CRT 螢幕感）
   */
  drawCornerBrackets(width, height) {
    const g = this.add.graphics();
    const inset = 18;
    drawGoldCorners(
      g,
      inset,
      inset,
      width - inset * 2,
      height - inset * 2,
      18,
      2,
      PALETTE.GOLD_DEEP
    );
  }

  /**
   * 細微掃描線（不破壞讀取性的低 alpha 條紋）
   */
  drawScanlines(width, height) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.18);
    for (let y = 0; y < height; y += 3) {
      g.fillRect(0, y, width, 1);
    }
    g.setDepth(50);
  }

  /**
   * 底部鍵盤提示列（移動 / 射擊 / 暫停 / UI）
   */
  drawKeyboardHints(width, height) {
    const y = height - 72;
    const items = [
      { keys: ['←', '→', '↑', '↓'], label: '移動' },
      { keys: ['SPC'], label: '射擊' },
      { keys: ['P'], label: '暫停' },
      { keys: ['TAB'], label: '切換 HUD' }
    ];

    const groupGap = 28;
    const keyW = 24;
    const keyH = 22;
    const keyGap = 4;
    const labelGap = 10;
    const labelCharW = 12;

    const groupWidths = items.map(
      (it) => it.keys.length * keyW + (it.keys.length - 1) * keyGap + labelGap + it.label.length * labelCharW
    );
    const total = groupWidths.reduce((a, b) => a + b, 0) + groupGap * (items.length - 1);
    let startX = (width - total) / 2;

    items.forEach((it, gi) => {
      let cursorX = startX;
      it.keys.forEach((k) => {
        const keyBg = this.add.rectangle(cursorX + keyW / 2, y, keyW, keyH, PALETTE.BG_2);
        keyBg.setStrokeStyle(1, PALETTE.GOLD_DEEP);
        this.add.rectangle(cursorX + keyW / 2, y + keyH / 2 - 1, keyW, 2, PALETTE.GOLD_DEEP);
        this.add.text(cursorX + keyW / 2, y, k, {
          fontFamily: TEXT_STYLES.KBD_KEY.fontFamily,
          fontSize: '9px',
          color: HEX.GOLD_2
        }).setOrigin(0.5);

        cursorX += keyW + keyGap;
      });

      cursorX += labelGap;
      // 中文標籤：Cubic 11 在 11px（native 像素尺寸）渲染最銳利，
      // 並提亮至 INK_1 改善小字可讀性
      this.add.text(cursorX, y, it.label, {
        fontFamily: TEXT_STYLES.KBD_LABEL.fontFamily,
        fontSize: '11px',
        color: HEX.INK_1,
        padding: { x: 0, y: 2 }
      }).setOrigin(0, 0.5).setLetterSpacing(2);

      startX += groupWidths[gi] + groupGap;
    });
  }

  startGame(level) {
    this.scene.start(SCENES.GAME, { level });
  }
}
