/**
 * 格子移動輔助類
 * 實現經典 Battle City 風格的格子對齊移動
 *
 * 參考資料：
 * - Phaser Coding Tips 5: Pacman-style movement
 * - Battle City NES movement mechanics
 */

import { GAME_CONFIG, TILE_TYPES, DIRECTION_VECTORS } from './Constants';

export default class GridMovement {
  /**
   * 將像素座標對齊到格子中心
   * @param {number} value - 像素座標
   * @returns {number} 對齊後的座標
   */
  static snapToGrid(value) {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    return Math.round(value / tileSize) * tileSize;
  }

  /**
   * 將像素座標轉換為格子座標
   * @param {number} x - X 像素座標
   * @param {number} y - Y 像素座標
   * @returns {Object} 格子座標 { gridX, gridY }
   */
  static pixelToGrid(x, y) {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    return {
      gridX: Math.floor(x / tileSize),
      gridY: Math.floor(y / tileSize)
    };
  }

  /**
   * 將格子座標轉換為像素座標（格子中心）
   * @param {number} gridX - 格子 X 座標
   * @param {number} gridY - 格子 Y 座標
   * @returns {Object} 像素座標 { x, y }
   */
  static gridToPixel(gridX, gridY) {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    return {
      x: gridX * tileSize + tileSize / 2,
      y: gridY * tileSize + tileSize / 2
    };
  }

  /**
   * 檢查坦克是否已對齊到格子
   * @param {Object} tank - 坦克對象
   * @param {number} threshold - 對齊閾值（預設 4 像素）
   * @returns {Object} { alignedX, alignedY, offsetX, offsetY }
   */
  static checkAlignment(tank, threshold = 4) {
    const tileSize = GAME_CONFIG.TILE_SIZE;

    // 計算最近的格子中心
    const nearestX = this.snapToGrid(tank.x);
    const nearestY = this.snapToGrid(tank.y);

    // 計算偏移量
    const offsetX = tank.x - nearestX;
    const offsetY = tank.y - nearestY;

    return {
      alignedX: Math.abs(offsetX) <= threshold,
      alignedY: Math.abs(offsetY) <= threshold,
      offsetX,
      offsetY,
      nearestX,
      nearestY
    };
  }

  /**
   * 計算角落滑動修正
   * 當坦克碰到牆角時，計算應該滑動的方向和距離
   * @param {Object} tank - 坦克對象
   * @param {string} direction - 移動方向
   * @param {Array} map - 地圖數據
   * @returns {Object|null} 滑動修正 { axis, amount } 或 null
   */
  static calculateCornerSlide(tank, direction, map) {
    if (!map) return null;

    const tileSize = GAME_CONFIG.TILE_SIZE;
    const alignment = this.checkAlignment(tank, tileSize * 0.45);

    // 垂直移動時檢查水平對齊
    if (direction === 'up' || direction === 'down') {
      if (!alignment.alignedX && Math.abs(alignment.offsetX) > 2) {
        // 檢查滑動方向是否會導致碰撞
        const slideDir = alignment.offsetX > 0 ? -1 : 1;
        const targetX = alignment.nearestX;

        // 驗證滑動後的位置是否可行走
        if (this.isPositionWalkable(targetX, tank.y, map)) {
          return {
            axis: 'x',
            amount: slideDir * Math.min(3, Math.abs(alignment.offsetX)),
            targetValue: targetX
          };
        }
      }
    }

    // 水平移動時檢查垂直對齊
    if (direction === 'left' || direction === 'right') {
      if (!alignment.alignedY && Math.abs(alignment.offsetY) > 2) {
        const slideDir = alignment.offsetY > 0 ? -1 : 1;
        const targetY = alignment.nearestY;

        if (this.isPositionWalkable(tank.x, targetY, map)) {
          return {
            axis: 'y',
            amount: slideDir * Math.min(3, Math.abs(alignment.offsetY)),
            targetValue: targetY
          };
        }
      }
    }

    return null;
  }

  /**
   * 檢查位置是否可行走
   * @param {number} x - X 像素座標
   * @param {number} y - Y 像素座標
   * @param {Array} map - 地圖數據
   * @returns {boolean}
   */
  static isPositionWalkable(x, y, map) {
    if (!map) return true;

    const tileSize = GAME_CONFIG.TILE_SIZE;
    const halfTank = 14; // 坦克半寬（略小於實際碰撞體積）

    // 檢查坦克四個角落
    const corners = [
      { x: x - halfTank, y: y - halfTank },
      { x: x + halfTank, y: y - halfTank },
      { x: x - halfTank, y: y + halfTank },
      { x: x + halfTank, y: y + halfTank }
    ];

    for (const corner of corners) {
      const gridX = Math.floor(corner.x / tileSize);
      const gridY = Math.floor(corner.y / tileSize);

      if (gridY < 0 || gridY >= map.length || gridX < 0 || gridX >= map[0].length) {
        return false;
      }

      const tile = map[gridY][gridX];
      if (tile === TILE_TYPES.BRICK || tile === TILE_TYPES.STEEL || tile === TILE_TYPES.WATER) {
        return false;
      }
    }

    return true;
  }

  /**
   * 檢查指定方向是否可通行
   * @param {Object} tank - 坦克對象
   * @param {string} direction - 方向
   * @param {Array} map - 地圖數據
   * @returns {boolean}
   */
  static canMoveInDirection(tank, direction, map) {
    if (!map) return true;

    const tileSize = GAME_CONFIG.TILE_SIZE;
    const vector = DIRECTION_VECTORS[direction];

    // 檢查前方一格
    const checkX = tank.x + vector.x * tileSize;
    const checkY = tank.y + vector.y * tileSize;

    return this.isPositionWalkable(checkX, checkY, map);
  }

  /**
   * 獲取可用的移動方向
   * @param {Object} tank - 坦克對象
   * @param {Array} map - 地圖數據
   * @returns {Array} 可用方向列表
   */
  static getAvailableDirections(tank, map) {
    const directions = ['up', 'down', 'left', 'right'];
    return directions.filter(dir => this.canMoveInDirection(tank, dir, map));
  }

  /**
   * 強制對齊坦克到最近的格子（用於卡住時的緊急修正）
   * @param {Object} tank - 坦克對象
   * @param {Array} map - 地圖數據
   * @returns {boolean} 是否成功對齊
   */
  static forceSnapToGrid(tank, map) {
    const alignment = this.checkAlignment(tank);

    // 如果偏移量不大，直接對齊
    if (Math.abs(alignment.offsetX) < 16 && Math.abs(alignment.offsetY) < 16) {
      // 檢查對齊位置是否可行走
      if (this.isPositionWalkable(alignment.nearestX, alignment.nearestY, map)) {
        tank.x = alignment.nearestX;
        tank.y = alignment.nearestY;
        return true;
      }
    }

    return false;
  }

  /**
   * 尋找最近的可行走格子位置
   * @param {Object} tank - 坦克對象
   * @param {Array} map - 地圖數據
   * @returns {Object|null} 可行走位置 { x, y }
   */
  static findNearestWalkablePosition(tank, map) {
    if (!map) return null;

    const tileSize = GAME_CONFIG.TILE_SIZE;
    const { gridX, gridY } = this.pixelToGrid(tank.x, tank.y);

    // 螺旋搜索
    for (let radius = 0; radius <= 3; radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          if (Math.abs(dx) !== radius && Math.abs(dy) !== radius) continue;

          const checkGridX = gridX + dx;
          const checkGridY = gridY + dy;
          const pixel = this.gridToPixel(checkGridX, checkGridY);

          if (this.isPositionWalkable(pixel.x, pixel.y, map)) {
            return pixel;
          }
        }
      }
    }

    return null;
  }
}
