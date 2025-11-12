/**
 * A* 尋路算法實現
 * 用於敵人 AI 尋找到達目標的最佳路徑
 */

export default class AStar {
  /**
   * 尋找從起點到終點的路徑
   * @param {Object} start - 起點 {x, y}
   * @param {Object} goal - 終點 {x, y}
   * @param {Array} map - 地圖數據 (26x26)
   * @param {number} tileSize - 格子大小
   * @returns {Array} 路徑數組 [{x, y}, ...]
   */
  static findPath(start, goal, map, tileSize = 32) {
    // 轉換世界座標到格子座標
    const startNode = {
      x: Math.floor(start.x / tileSize),
      y: Math.floor(start.y / tileSize)
    };

    const goalNode = {
      x: Math.floor(goal.x / tileSize),
      y: Math.floor(goal.y / tileSize)
    };

    // 檢查起點和終點是否有效
    if (!this.isValidNode(startNode, map) || !this.isValidNode(goalNode, map)) {
      return null;
    }

    // 開放列表和關閉列表
    const openList = [];
    const closedList = new Set();

    // 初始化起點
    const startPathNode = {
      ...startNode,
      g: 0, // 從起點到當前點的成本
      h: this.heuristic(startNode, goalNode), // 從當前點到終點的估計成本
      f: 0, // f = g + h
      parent: null
    };
    startPathNode.f = startPathNode.g + startPathNode.h;

    openList.push(startPathNode);

    // A* 主循環
    while (openList.length > 0) {
      // 找到 f 值最小的節點
      let currentIndex = 0;
      for (let i = 1; i < openList.length; i++) {
        if (openList[i].f < openList[currentIndex].f) {
          currentIndex = i;
        }
      }

      const current = openList[currentIndex];

      // 到達目標
      if (current.x === goalNode.x && current.y === goalNode.y) {
        return this.reconstructPath(current, tileSize);
      }

      // 從開放列表移除，加入關閉列表
      openList.splice(currentIndex, 1);
      closedList.add(`${current.x},${current.y}`);

      // 檢查鄰居
      const neighbors = this.getNeighbors(current, map);

      for (const neighbor of neighbors) {
        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // 已經在關閉列表中，跳過
        if (closedList.has(neighborKey)) {
          continue;
        }

        // 計算從起點到鄰居的成本
        const gScore = current.g + 1;

        // 檢查是否已經在開放列表中
        const existingNode = openList.find(
          node => node.x === neighbor.x && node.y === neighbor.y
        );

        if (!existingNode) {
          // 新節點，加入開放列表
          const h = this.heuristic(neighbor, goalNode);
          openList.push({
            ...neighbor,
            g: gScore,
            h: h,
            f: gScore + h,
            parent: current
          });
        } else if (gScore < existingNode.g) {
          // 找到更好的路徑，更新節點
          existingNode.g = gScore;
          existingNode.f = gScore + existingNode.h;
          existingNode.parent = current;
        }
      }
    }

    // 沒有找到路徑
    return null;
  }

  /**
   * 啟發式函數（曼哈頓距離）
   * @param {Object} a - 節點 A
   * @param {Object} b - 節點 B
   * @returns {number} 距離
   */
  static heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * 獲取有效鄰居
   * @param {Object} node - 當前節點
   * @param {Array} map - 地圖數據
   * @returns {Array} 鄰居數組
   */
  static getNeighbors(node, map) {
    const neighbors = [];
    const directions = [
      { x: 0, y: -1 }, // 上
      { x: 0, y: 1 },  // 下
      { x: -1, y: 0 }, // 左
      { x: 1, y: 0 }   // 右
    ];

    for (const dir of directions) {
      const neighbor = {
        x: node.x + dir.x,
        y: node.y + dir.y
      };

      if (this.isWalkable(neighbor, map)) {
        neighbors.push(neighbor);
      }
    }

    return neighbors;
  }

  /**
   * 檢查節點是否有效
   * @param {Object} node - 節點
   * @param {Array} map - 地圖數據
   * @returns {boolean}
   */
  static isValidNode(node, map) {
    return (
      node.x >= 0 &&
      node.x < map[0].length &&
      node.y >= 0 &&
      node.y < map.length
    );
  }

  /**
   * 檢查節點是否可行走
   * @param {Object} node - 節點
   * @param {Array} map - 地圖數據
   * @returns {boolean}
   */
  static isWalkable(node, map) {
    if (!this.isValidNode(node, map)) {
      return false;
    }

    const tileType = map[node.y][node.x];

    // 0: 空地
    // 1: 磚牆（不可通過）
    // 2: 鋼牆（不可通過）
    // 3: 水域（不可通過）
    // 4: 冰地（可通過）
    // 5: 森林（可通過）
    // 6: 基地（目標，可通過）

    // 可行走的地形：0(空地), 4(冰地), 5(森林), 6(基地)
    return tileType === 0 || tileType === 4 || tileType === 5 || tileType === 6;
  }

  /**
   * 重建路徑
   * @param {Object} node - 最終節點
   * @param {number} tileSize - 格子大小
   * @returns {Array} 世界座標路徑
   */
  static reconstructPath(node, tileSize) {
    const path = [];
    let current = node;

    while (current !== null) {
      // 轉換回世界座標（格子中心點）
      path.unshift({
        x: current.x * tileSize + tileSize / 2,
        y: current.y * tileSize + tileSize / 2,
        gridX: current.x,
        gridY: current.y
      });
      current = current.parent;
    }

    // 移除第一個點（起點）
    if (path.length > 0) {
      path.shift();
    }

    return path;
  }

  /**
   * 簡化路徑（移除不必要的中間點）
   * @param {Array} path - 原始路徑
   * @returns {Array} 簡化後的路徑
   */
  static simplifyPath(path) {
    if (!path || path.length <= 2) {
      return path;
    }

    const simplified = [path[0]];
    let lastDirection = null;

    for (let i = 1; i < path.length; i++) {
      const prev = path[i - 1];
      const curr = path[i];

      // 計算當前方向
      const dx = Math.sign(curr.x - prev.x);
      const dy = Math.sign(curr.y - prev.y);
      const currentDirection = `${dx},${dy}`;

      // 方向改變時才添加路徑點
      if (currentDirection !== lastDirection) {
        simplified.push(prev);
        lastDirection = currentDirection;
      }
    }

    // 添加最後一個點
    simplified.push(path[path.length - 1]);

    return simplified;
  }
}
