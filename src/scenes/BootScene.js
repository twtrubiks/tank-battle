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

  create() {
    // 初始化遊戲基本設定
    this.setupGlobalSettings();

    // 切換到預載場景
    this.scene.start(SCENES.PRELOAD);
  }

  setupGlobalSettings() {
    // 設定全域遊戲設定
    // 例如：音量、難度等
  }
}
