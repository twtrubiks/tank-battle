/**
 * 磚牆類別
 * 可被摧毀的牆壁
 */

import Phaser from 'phaser';
import { DEPTHS } from '../utils/Constants';

export default class BrickWall extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'brick');

    // 不要在這裡創建物理 body，讓 staticGroup 來處理
    scene.add.existing(this);

    this.type = 'brick';
    this.health = 1;

    // 設定深度
    this.setDepth(DEPTHS.MAP_UPPER);
  }

  /**
   * 受到傷害
   * @param {number} damage - 傷害值
   */
  takeDamage(damage) {
    this.health -= damage;

    if (this.health <= 0) {
      this.destroy();
    }
  }
}
