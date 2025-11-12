/**
 * 冰地地形
 * 坦克在冰上移動時會滑行（減少摩擦力）
 */

import Phaser from 'phaser';
import { DEPTHS } from '../utils/Constants';

export default class Ice extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'ice');

    scene.add.existing(this);

    this.type = 'ice';

    // 設定深度（在坦克下方）
    this.setDepth(DEPTHS.MAP_LOWER);

    // 冰地配置
    this.slipperiness = 0.95; // 滑行係數（越接近 1 越滑）
    this.originalDrag = null;
  }

  /**
   * 當坦克進入冰地
   * @param {Tank} tank - 坦克實例
   */
  onTankEnter(tank) {
    if (!tank.body) return;

    // 保存原始阻力值
    this.originalDrag = {
      x: tank.body.drag.x,
      y: tank.body.drag.y
    };

    // 減少阻力，讓坦克滑行
    tank.body.setDrag(50);

    // 標記坦克在冰上
    tank.onIce = true;
  }

  /**
   * 當坦克離開冰地
   * @param {Tank} tank - 坦克實例
   */
  onTankExit(tank) {
    if (!tank.body || !this.originalDrag) return;

    // 恢復原始阻力
    tank.body.setDrag(this.originalDrag.x, this.originalDrag.y);

    // 清除冰上標記
    tank.onIce = false;
  }

  /**
   * 檢查坦克是否在冰地上
   * @param {Tank} tank - 坦克實例
   * @returns {boolean}
   */
  isOverlapping(tank) {
    const bounds1 = this.getBounds();
    const bounds2 = tank.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(bounds1, bounds2);
  }
}
