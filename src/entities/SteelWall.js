/**
 * 鋼牆類別
 * 只能被強化子彈摧毀
 */

import Phaser from 'phaser';
import { DEPTHS } from '../utils/Constants';

export default class SteelWall extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'steel');

    // 不要在這裡創建物理 body，讓 staticGroup 來處理
    scene.add.existing(this);

    this.type = 'steel';

    // 設定深度
    this.setDepth(DEPTHS.MAP_UPPER);
  }

  /**
   * 受到傷害
   * 只有強化子彈（damage >= 2）才能摧毀
   * @param {number} damage - 傷害值
   */
  takeDamage(damage) {
    if (damage >= 2) {
      this.destroy();
    }
  }
}
