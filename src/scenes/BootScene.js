/**
 * 啟動場景
 * 初始化遊戲基本設定
 */

import Phaser from 'phaser';
import { SCENES } from '../utils/Constants';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: SCENES.BOOT });
  }

  preload() {
    // 載入啟動畫面所需的最小資源
    // 例如：載入進度條圖片
  }

  async create() {
    // 初始化遊戲基本設定
    this.setupGlobalSettings();

    // 等待自訂字型載入完成（Phaser 用 canvas 繪製文字，未載入完成會 fallback 且不重繪）
    await this.waitForFonts();

    // 切換到預載場景
    this.scene.start(SCENES.PRELOAD);
  }

  setupGlobalSettings() {
    // 設定全域遊戲設定
    // 例如：音量、難度等
  }

  async waitForFonts() {
    if (!document.fonts || !document.fonts.load) return;
    try {
      await Promise.all([
        document.fonts.load('16px "Press Start 2P"'),
        document.fonts.load('16px "Cubic 11"'),
        document.fonts.load('16px "Cubic 11"', '坦克大戰')
      ]);
      await document.fonts.ready;
    } catch (e) {
      console.warn('字型載入失敗，將使用 fallback：', e);
    }
  }
}
