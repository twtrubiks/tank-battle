/**
 * 水域地形
 * 阻挡坦克移动，子弹可以通过
 */

import Phaser from 'phaser';
import { DEPTHS } from '../utils/Constants';

export default class Water extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'water');

    // 不要在這裡創建物理 body，讓 staticGroup 來處理
    scene.add.existing(this);

    this.type = 'water';

    // 設定深度（在坦克下方）
    this.setDepth(DEPTHS.MAP_LOWER);

    // 創建波浪動畫效果
    this._createWaveAnimation();
  }

  /**
   * 創建波浪動畫
   * @private
   */
  _createWaveAnimation() {
    // 使用 tween 創造輕微的波動效果
    this.scene.tweens.add({
      targets: this,
      alpha: { from: 0.9, to: 1.0 },
      duration: 2000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
  }
}
