/**
 * 鋼牆類別
 * 只能被強化子彈摧毀
 */

import Phaser from 'phaser';
import { DEPTHS, TILE_TYPES } from '../utils/Constants';

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

  /**
   * 摧毀時同步地圖資料：該格變為空地（AI 走位與尋路依賴 map）
   */
  destroy(fromScene) {
    if (this.scene && this.scene.setMapTileAt) {
      this.scene.setMapTileAt(this.x, this.y, TILE_TYPES.EMPTY);
    }
    super.destroy(fromScene);
  }
}
