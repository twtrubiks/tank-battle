/**
 * 關卡完成場景 — Style A 勝利 Modal
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

export default class LevelCompleteScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.LEVEL_COMPLETE });
  }

  init(data) {
    this.score = data.score || 0;
    this.currentLevel = data.level || 1;
    this.nextLevel = this.currentLevel + 1;
    this.lives = data.lives !== undefined ? data.lives : 3;
    this.starLevel = data.starLevel || 0;
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    this.saveManager = new SaveManager();
    this.saveManager.completeLevel(this.currentLevel, this.score);

    const highScore = this.saveManager.getHighScore();
    const isNewHighScore = this.score === highScore && this.score > 0;

    // ===== 遮罩 =====
    this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0);

    // ===== Modal =====
    const modalW = 500;
    const modalH = 540;
    const mx = (width - modalW) / 2;
    const my = (height - modalH) / 2;

    this.add.rectangle(mx - 4, my - 4, modalW + 8, modalH + 8, PALETTE.BG_0)
      .setOrigin(0)
      .setStrokeStyle(2, PALETTE.GOLD_DEEP);

    this.add.rectangle(mx, my, modalW, modalH, PALETTE.PANEL)
      .setOrigin(0)
      .setStrokeStyle(3, PALETTE.GOLD);

    const cornerG = this.add.graphics();
    drawGoldCorners(cornerG, mx, my, modalW, modalH, 14, 3, PALETTE.GOLD_2);

    // ===== CLEARED 標籤（綠底）=====
    const chipW = 112;
    const chipX = mx + modalW / 2 - chipW / 2;
    const chipY = my + 24;
    this.add.rectangle(chipX, chipY, chipW, 22, PALETTE.PHOSPHOR).setOrigin(0);
    this.add.text(chipX + chipW / 2, chipY + 11, 'CLEARED', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '10px',
      color: HEX.BG_0
    }).setOrigin(0.5).setLetterSpacing(4);

    // ===== 標題 =====
    this.add.text(mx + modalW / 2, my + 78, '關 卡 通 過', {
      fontFamily: TEXT_STYLES.SECTION_TITLE.fontFamily,
      fontSize: '28px',
      color: HEX.PHOSPHOR,
      padding: { x: 4, y: 6 },
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: HEX.BLACK,
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5).setLetterSpacing(8);

    this.add.text(mx + modalW / 2, my + 112, '— STAGE CLEAR —', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '10px',
      color: HEX.INK_2
    }).setOrigin(0.5).setLetterSpacing(6);

    // ===== 三顆星 =====
    const stars = this.computeStars();
    this.drawStars(mx + modalW / 2, my + 158, stars);

    // ===== 戰績明細 =====
    this.drawBreakdown(mx + 36, my + 210, modalW - 72, isNewHighScore);

    // ===== 按鈕 =====
    const btnY = my + modalH - 120;
    const isLast = this.nextLevel > 5;

    if (isLast) {
      this.createButton(mx + 36, btnY, modalW - 72, '⌂  返 回 主 選 單', true, () => this.backToMenu());
    } else {
      this.createButton(mx + 36, btnY, modalW - 72, `▶  下 一 關  ·  STAGE ${formatStage(this.nextLevel)}`, true, () => this.nextStage());
      this.createButton(mx + 36, btnY + 56, modalW - 72, '⌂  返 回 主 選 單', false, () => this.backToMenu());
    }

    // ===== 倒數提示 =====
    if (!isLast) {
      this.countdownText = this.add.text(mx + modalW / 2, my + modalH - 18, '3 秒後自動進入下一關...', {
        fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
        fontSize: '9px',
        color: HEX.INK_2,
        padding: { x: 0, y: 2 }
      }).setOrigin(0.5).setLetterSpacing(2);

      let countdown = 3;
      this.time.addEvent({
        delay: 1000,
        repeat: 2,
        callback: () => {
          countdown--;
          if (countdown > 0 && this.countdownText) {
            this.countdownText.setText(`${countdown} 秒後自動進入下一關...`);
          }
        }
      });

      this.time.delayedCall(3000, () => this.nextStage());
    } else {
      this.add.text(mx + modalW / 2, my + modalH - 18, '★  ALL STAGES CLEARED  ★', {
        fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
        fontSize: '10px',
        color: HEX.GOLD_2
      }).setOrigin(0.5).setLetterSpacing(4);
    }

    // 鍵盤
    this.input.keyboard.on('keydown-ENTER', () => {
      if (isLast) this.backToMenu();
      else this.nextStage();
    });
  }

  /**
   * 根據存活生命數計算星級（1-3 顆）
   */
  computeStars() {
    if (this.lives >= 3) return 3;
    if (this.lives >= 2) return 2;
    if (this.lives >= 1) return 1;
    return 1; // 通關至少給 1 顆
  }

  drawStars(cx, cy, count) {
    const total = 3;
    const gap = 16;
    const size = 32;
    const startX = cx - ((total - 1) * (size + gap)) / 2;

    for (let i = 0; i < total; i++) {
      const x = startX + i * (size + gap);
      const on = i < count;
      const text = this.add.text(x, cy, '★', {
        fontFamily: TEXT_STYLES.SECTION_TITLE.fontFamily,
        fontSize: '32px',
        color: on ? HEX.GOLD : HEX.GOLD_DEEP,
        shadow: on
          ? { offsetX: 0, offsetY: 0, color: HEX.GOLD_2, blur: 12, fill: false }
          : undefined
      }).setOrigin(0.5);

      if (on) {
        // 入場縮放動畫
        text.setScale(0);
        this.tweens.add({
          targets: text,
          scale: 1,
          duration: 280,
          delay: i * 180,
          ease: 'Back.easeOut'
        });
      }
    }
  }

  drawBreakdown(x, y, w, isNewHigh) {
    const g = this.add.graphics();
    g.lineStyle(1, PALETTE.GOLD_DEEP, 0.7);
    this.drawDashedLine(g, x, y, x + w, y, 4, 4);

    const rows = [
      { k: 'STAGE', v: `${formatStage(this.currentLevel)} / 35`, color: HEX.GOLD_2 },
      { k: 'CURRENT SCORE', v: formatScore(this.score), color: HEX.GOLD_2 },
      { k: 'LIVES REMAINING', v: `${this.lives}`, color: HEX.PHOSPHOR },
      { k: 'STAR LEVEL', v: this.starLevel > 0 ? `Lv.${this.starLevel}` : '—', color: HEX.GOLD_2 }
    ];

    const rowH = 28;
    rows.forEach((row, i) => {
      const ry = y + 14 + i * rowH;
      this.add.text(x + 8, ry, row.k, {
        fontFamily: TEXT_STYLES.LABEL.fontFamily,
        fontSize: '10px',
        color: HEX.INK_1
      }).setOrigin(0, 0.5).setLetterSpacing(2);

      this.add.text(x + w - 8, ry, row.v, {
        fontFamily: TEXT_STYLES.VALUE.fontFamily,
        fontSize: '12px',
        color: row.color
      }).setOrigin(1, 0.5).setLetterSpacing(2);
    });

    const totalY = y + 14 + rows.length * rowH + 8;
    this.drawDashedLine(g, x, totalY - 6, x + w, totalY - 6, 4, 4);

    // TOTAL 加總列
    this.add.text(x + 8, totalY + 8, 'TOTAL', {
      fontFamily: TEXT_STYLES.SECTION_TITLE.fontFamily,
      fontSize: '14px',
      color: HEX.GOLD
    }).setOrigin(0, 0.5).setLetterSpacing(4);

    this.add.text(x + w - 8, totalY + 8, formatScore(this.score), {
      fontFamily: TEXT_STYLES.SECTION_TITLE.fontFamily,
      fontSize: '18px',
      color: HEX.GOLD_2
    }).setOrigin(1, 0.5).setLetterSpacing(2);

    if (isNewHigh) {
      const tag = this.add.text(x + w / 2, totalY + 36, '★  NEW HIGH SCORE  ★', {
        fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
        fontSize: '10px',
        color: HEX.GOLD_2
      }).setOrigin(0.5).setLetterSpacing(4);

      this.tweens.add({
        targets: tag,
        alpha: 0.4,
        duration: 600,
        yoyo: true,
        repeat: -1
      });
    }
  }

  drawDashedLine(g, x1, y1, x2, y2, dash, gap) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    const ux = dx / len;
    const uy = dy / len;
    let drawn = 0;
    while (drawn < len) {
      const sx = x1 + ux * drawn;
      const sy = y1 + uy * drawn;
      const next = Math.min(drawn + dash, len);
      const ex = x1 + ux * next;
      const ey = y1 + uy * next;
      g.lineBetween(sx, sy, ex, ey);
      drawn = next + gap;
    }
  }

  createButton(x, y, w, label, primary, callback) {
    const h = 44;
    const cx = x + w / 2;
    const cy = y + h / 2;

    const bg = this.add.rectangle(x, y, w, h, primary ? PALETTE.GOLD : PALETTE.BG_1).setOrigin(0);
    bg.setStrokeStyle(2, primary ? PALETTE.GOLD : PALETTE.GOLD_DEEP);
    bg.setInteractive();

    const text = this.add.text(cx, cy, label, {
      fontFamily: TEXT_STYLES.BTN_SECONDARY.fontFamily,
      fontSize: '12px',
      color: primary ? HEX.BG_0 : HEX.INK_1,
      padding: { x: 0, y: 3 }
    }).setOrigin(0.5).setLetterSpacing(4);

    bg.on('pointerover', () => {
      if (primary) {
        bg.setFillStyle(PALETTE.GOLD_2);
      } else {
        bg.setFillStyle(PALETTE.BG_2);
        bg.setStrokeStyle(2, PALETTE.GOLD);
        text.setColor(HEX.GOLD_2);
      }
    });
    bg.on('pointerout', () => {
      if (primary) {
        bg.setFillStyle(PALETTE.GOLD);
      } else {
        bg.setFillStyle(PALETTE.BG_1);
        bg.setStrokeStyle(2, PALETTE.GOLD_DEEP);
        text.setColor(HEX.INK_1);
      }
    });
    bg.on('pointerdown', callback);
  }

  nextStage() {
    if (this._navigating) return;
    this._navigating = true;
    this.scene.start(SCENES.GAME, {
      level: this.nextLevel,
      lives: this.lives,
      starLevel: this.starLevel
    });
  }

  backToMenu() {
    if (this._navigating) return;
    this._navigating = true;
    this.scene.start(SCENES.MENU);
  }
}
