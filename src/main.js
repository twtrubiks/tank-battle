/**
 * 遊戲入口點
 */

import Phaser from 'phaser';
import config from './config/GameConfig';

// 建立遊戲實例
const game = new Phaser.Game(config);

// 隱藏載入畫面
window.addEventListener('load', () => {
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.add('hidden');
  }
});

// 匯出遊戲實例（用於除錯）
window.game = game;

export default game;
