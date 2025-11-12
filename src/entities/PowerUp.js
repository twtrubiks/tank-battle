/**
 * 道具類別
 */

import Phaser from 'phaser';
import { POWERUP_TYPES, DEPTHS } from '../utils/Constants';

export default class PowerUp extends Phaser.Physics.Arcade.Sprite {
  /**
   * 建構子
   * @param {Phaser.Scene} scene - 場景
   * @param {number} x - X 座標
   * @param {number} y - Y 座標
   * @param {string} type - 道具類型
   */
  constructor(scene, x, y, type = 'STAR') {
    const config = POWERUP_TYPES[type];

    if (!config) {
      console.error(`Unknown power-up type: ${type}`);
      type = 'STAR';
    }

    super(scene, x, y, config.texture);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.powerUpType = type;
    this.config = config;

    // 設定深度
    this.setDepth(DEPTHS.ENTITY);

    // 設定碰撞箱
    this.body.setSize(28, 28);
    this.body.setOffset(2, 2);

    // 閃爍動畫
    this._startBlinkAnimation();

    // 15 秒後消失
    this._startTimer();
  }

  /**
   * 開始閃爍動畫
   * @private
   */
  _startBlinkAnimation() {
    this.scene.tweens.add({
      targets: this,
      alpha: 0.3,
      duration: 500,
      yoyo: true,
      repeat: -1
    });
  }

  /**
   * 開始計時器
   * @private
   */
  _startTimer() {
    this.scene.time.delayedCall(15000, () => {
      if (this.active) {
        this.destroy();
      }
    });
  }

  /**
   * 摧毀道具
   */
  destroy() {
    // 停止所有 tweens（檢查 scene 是否還存在）
    if (this.scene && this.scene.tweens) {
      this.scene.tweens.killTweensOf(this);
    }
    super.destroy();
  }
}
