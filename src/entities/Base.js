/**
 * 基地類別
 * 保護目標，被摧毀則遊戲結束
 */

import Phaser from 'phaser';
import { DEPTHS, EVENTS } from '../utils/Constants';

export default class Base extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'base');

    // 不要在這裡創建物理 body，讓 staticGroup 來處理
    scene.add.existing(this);

    this.isDestroyed = false;

    // 設定深度
    this.setDepth(DEPTHS.MAP_UPPER);
  }

  /**
   * 受到傷害
   * 基地一擊即毀
   * @param {number} damage - 傷害值
   */
  takeDamage(damage) {
    if (this.isDestroyed) return;

    this.isDestroyed = true;

    // 建立爆炸特效
    if (this.scene.createExplosion) {
      this.scene.createExplosion(this.x, this.y);
    }

    // 發送基地摧毀事件
    this.scene.events.emit(EVENTS.BASE_DESTROYED);

    // 遊戲結束
    if (this.scene.gameOver) {
      this.scene.gameOver();
    }

    this.destroy();
  }
}
