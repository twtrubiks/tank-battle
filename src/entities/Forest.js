/**
 * 森林地形
 * 坦克可以穿過，但會被森林視覺上遮蔽
 */

import Phaser from 'phaser';
import { DEPTHS } from '../utils/Constants';

export default class Forest extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'forest');

    scene.add.existing(this);

    this.type = 'forest';

    // 設定深度（在坦克上方，遮蔽效果）
    this.setDepth(DEPTHS.MAP_UPPER);

    // 設定半透明度，讓玩家能看到森林下的坦克
    this.setAlpha(0.85);
  }

  /**
   * 當坦克進入森林
   * @param {Tank} tank - 坦克實例
   */
  onTankEnter(tank) {
    // 略微降低坦克的 alpha 值，創造被遮蔽的效果
    if (tank.setAlpha) {
      tank._originalAlpha = tank.alpha;
      tank.setAlpha(0.7);
    }

    // 標記坦克在森林中
    tank.inForest = true;
  }

  /**
   * 當坦克離開森林
   * @param {Tank} tank - 坦克實例
   */
  onTankExit(tank) {
    // 恢復坦克的原始 alpha 值
    if (tank.setAlpha && tank._originalAlpha !== undefined) {
      tank.setAlpha(tank._originalAlpha);
      delete tank._originalAlpha;
    }

    // 清除森林標記
    tank.inForest = false;
  }

  /**
   * 檢查坦克是否在森林中
   * @param {Tank} tank - 坦克實例
   * @returns {boolean}
   */
  isOverlapping(tank) {
    const bounds1 = this.getBounds();
    const bounds2 = tank.getBounds();
    return Phaser.Geom.Intersects.RectangleToRectangle(bounds1, bounds2);
  }
}
