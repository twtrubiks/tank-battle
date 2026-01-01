/**
 * 暫停場景 — Style A 金邊 Modal
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';
import {
  PALETTE,
  HEX,
  TEXT_STYLES,
  drawGoldCorners,
  formatScore,
  formatStage,
  formatElapsedTime
} from '../utils/UITheme';

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.PAUSE });
  }

  create() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // 取得來自 GameScene 的當下資料
    const gameScene = this.scene.get(SCENES.GAME);
    const stats = this.captureStats(gameScene);

    // ===== 半透明遮罩 =====
    this.add.rectangle(0, 0, width, height, 0x000000, 0.78).setOrigin(0);

    // ===== Modal =====
    const modalW = 460;
    const modalH = 460;
    const mx = (width - modalW) / 2;
    const my = (height - modalH) / 2;

    // 外圍黑底（雙層描邊基底）
    const outer = this.add.rectangle(mx - 4, my - 4, modalW + 8, modalH + 8, PALETTE.BG_0).setOrigin(0);
    outer.setStrokeStyle(2, PALETTE.GOLD_DEEP);

    // 主面板
    const panel = this.add.rectangle(mx, my, modalW, modalH, PALETTE.PANEL).setOrigin(0);
    panel.setStrokeStyle(3, PALETTE.GOLD);

    // 角落括號
    const cornerG = this.add.graphics();
    drawGoldCorners(cornerG, mx, my, modalW, modalH, 14, 3, PALETTE.GOLD_2);

    // ===== 標題 =====
    this.add.text(mx + modalW / 2, my + 36, '暫  停', {
      fontFamily: TEXT_STYLES.SECTION_TITLE.fontFamily,
      fontSize: '28px',
      color: HEX.GOLD,
      padding: { x: 4, y: 6 },
      shadow: {
        offsetX: 3,
        offsetY: 3,
        color: HEX.BLACK,
        blur: 0,
        fill: true
      }
    }).setOrigin(0.5).setLetterSpacing(8);

    this.add.text(mx + modalW / 2, my + 70, '— PAUSED —', {
      fontFamily: TEXT_STYLES.LABEL_SMALL.fontFamily,
      fontSize: '10px',
      color: HEX.INK_2
    }).setOrigin(0.5).setLetterSpacing(6);

    // ===== 戰況面板 =====
    this.drawBreakdown(mx + 32, my + 110, modalW - 64, stats);

    // ===== 按鈕 =====
    const btnY = my + 280;
    this.createButton(mx + 32, btnY, modalW - 64, '▶  繼 續 遊 戲', true, () => this.resumeGame());
    this.createButton(mx + 32, btnY + 56, modalW - 64, '↻  重 新 開 始', false, () => this.restartGame(gameScene));
    this.createButton(mx + 32, btnY + 112, modalW - 64, '⌂  返 回 主 選 單', false, () => this.backToMenu());

    // 鍵盤
    this.input.keyboard.on('keydown-P', () => this.resumeGame());
    this.input.keyboard.on('keydown-ESC', () => this.resumeGame());
  }

  captureStats(gameScene) {
    const data = (gameScene && gameScene.gameState) || {};
    const total = (gameScene && gameScene.totalEnemyCount) || 0;
    const elapsed =
      gameScene && gameScene.gameStartTime != null && gameScene.time
        ? gameScene.time.now - gameScene.gameStartTime
        : 0;
    return {
      level: data.level || 1,
      score: data.score || 0,
      enemiesRemaining: data.enemiesRemaining || 0,
      enemiesTotal: total,
      elapsed
    };
  }

  drawBreakdown(x, y, w, stats) {
    // 上下虛線（用 graphics 畫）
    const g = this.add.graphics();
    g.lineStyle(1, PALETTE.GOLD_DEEP, 0.7);
    this.drawDashedLine(g, x, y, x + w, y, 4, 4);

    const rows = [
      { k: 'STAGE', v: `${formatStage(stats.level)} / 35` },
      { k: 'SCORE', v: formatScore(stats.score) },
      { k: 'HOSTILES', v: `${stats.enemiesRemaining} / ${Math.max(stats.enemiesTotal, stats.enemiesRemaining)}` },
      { k: 'TIME ELAPSED', v: formatElapsedTime(stats.elapsed) }
    ];

    const rowH = 28;
    rows.forEach((row, i) => {
      const ry = y + 14 + i * rowH;
      this.add.text(x + 8, ry, row.k, {
        fontFamily: TEXT_STYLES.LABEL.fontFamily,
        fontSize: '11px',
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

  /**
   * Style A 按鈕：primary = 金底黑字；其他 = 透明 + 深金邊
   */
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

  resumeGame() {
    this.scene.resume(SCENES.GAME);
    this.scene.stop();
  }

  restartGame(gameScene) {
    const level = (gameScene && gameScene.currentLevel) || 1;
    this.scene.stop(SCENES.GAME);
    this.scene.start(SCENES.GAME, { level });
  }

  backToMenu() {
    this.scene.stop(SCENES.GAME);
    this.scene.start(SCENES.MENU);
  }
}
