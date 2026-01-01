/**
 * 遊戲結束場景 — Style A 紅邊 Modal
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';
import {
  PALETTE,
  HEX,
  TEXT_STYLES,
  drawGoldCorners,
  formatScore,
  formatStage
} from '../utils/UITheme';

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

    // ===== 遮罩（深紅暈染）=====
    this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0);
    this.add.rectangle(0, 0, width, height, 0x4a0000, 0.18).setOrigin(0);

    // ===== Modal =====
    const modalW = 540;
    const modalH = 520;
    const mx = (width - modalW) / 2;
    const my = (height - modalH) / 2;

    this.add.rectangle(mx - 4, my - 4, modalW + 8, modalH + 8, PALETTE.BG_0)
      .setOrigin(0)
      .setStrokeStyle(2, PALETTE.DANGER_DEEP);

    this.add.rectangle(mx, my, modalW, modalH, PALETTE.PANEL)
      .setOrigin(0)
      .setStrokeStyle(3, PALETTE.DANGER);

    // 紅色角落括號
    const cornerG = this.add.graphics();
    drawGoldCorners(cornerG, mx, my, modalW, modalH, 14, 3, PALETTE.DANGER);

    // ===== 標題 =====
    const title = this.add.text(mx + modalW / 2, my + 56, 'GAME OVER', {
      fontFamily: TEXT_STYLES.SECTION_TITLE.fontFamily,
      fontSize: '32px',
      color: HEX.DANGER,
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: HEX.BLACK,
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5).setLetterSpacing(8);

    this.add.text(mx + modalW / 2, my + 96, '— 任 務 失 敗 —', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '10px',
      color: HEX.INK_2,
      padding: { x: 0, y: 2 }
    }).setOrigin(0.5).setLetterSpacing(6);

    // 標題微閃爍
    this.tweens.add({
      targets: title,
      alpha: 0.6,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    // ===== 大分數 =====
    this.add.text(mx + modalW / 2, my + 138, 'FINAL SCORE', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '10px',
      color: HEX.INK_2
    }).setOrigin(0.5).setLetterSpacing(6);

    this.add.text(mx + modalW / 2, my + 184, formatScore(this.finalScore), {
      fontFamily: TEXT_STYLES.SECTION_TITLE.fontFamily,
      fontSize: '44px',
      color: HEX.GOLD_2,
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: HEX.GOLD_DEEP,
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5).setLetterSpacing(4);

    if (this.isNewHighScore) {
      const newHi = this.add.text(mx + modalW / 2, my + 220, '★  NEW PERSONAL BEST  ★', {
        fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
        fontSize: '10px',
        color: HEX.PHOSPHOR
      }).setOrigin(0.5).setLetterSpacing(4);

      this.tweens.add({
        targets: newHi,
        alpha: 0.5,
        duration: 600,
        yoyo: true,
        repeat: -1
      });
    }

    // ===== 戰績明細 =====
    this.drawBreakdown(mx + 36, my + 248, modalW - 72);

    // ===== 按鈕 =====
    const btnY = my + modalH - 124;
    this.createButton(mx + 36, btnY, modalW - 72, '↻  再 來 一 局', true, () => this.restart());
    this.createButton(mx + 36, btnY + 56, modalW - 72, '⌂  返 回 主 選 單', false, () => this.backToMenu());

    this.input.keyboard.on('keydown-ENTER', () => this.restart());
    this.input.keyboard.on('keydown-ESC', () => this.backToMenu());
  }

  drawBreakdown(x, y, w) {
    const g = this.add.graphics();
    g.lineStyle(1, PALETTE.GOLD_DEEP, 0.7);
    this.drawDashedLine(g, x, y, x + w, y, 4, 4);

    const rows = [
      { k: 'STAGE REACHED', v: `${formatStage(this.level)} / 35` },
      { k: 'FINAL SCORE', v: formatScore(this.finalScore) }
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
        color: HEX.GOLD_2
      }).setOrigin(1, 0.5).setLetterSpacing(2);
    });

    this.drawDashedLine(g, x, y + 14 + rows.length * rowH, x + w, y + 14 + rows.length * rowH, 4, 4);
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

  restart() {
    if (this._navigating) return;
    this._navigating = true;
    this.scene.start(SCENES.GAME, { level: 1 });
  }

  backToMenu() {
    if (this._navigating) return;
    this._navigating = true;
    this.scene.start(SCENES.MENU);
  }
}
