/**
 * 冰地地形
 * 坦克在冰上移動時會滑行（減少摩擦力）
 */

import Phaser from 'phaser';
import { DEPTHS, TANK_CONFIG } from '../utils/Constants';

export default class Ice extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'ice');

    scene.add.existing(this);

    this.type = 'ice';

    // 設定深度（在坦克下方）
    this.setDepth(DEPTHS.MAP_LOWER);
  }

  /**
   * 當坦克進入冰地
   * 阻力值使用全域常數而非逐 tile 紀錄：
   * 同時跨越多塊冰時，per-tile 狀態會把已降低的阻力誤存成「原始值」
   * @param {Tank} tank - 坦克實例
   */
  onTankEnter(tank) {
    if (!tank.body) return;

    // 減少阻力，讓坦克滑行
    tank.body.setDrag(TANK_CONFIG.ICE_DRAG);

    // 標記坦克在冰上
    tank.onIce = true;
  }

  /**
   * 當坦克離開冰地
   * @param {Tank} tank - 坦克實例
   */
  onTankExit(tank) {
    if (!tank.body) return;

    // 恢復原始阻力
    tank.body.setDrag(TANK_CONFIG.NORMAL_DRAG);

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
