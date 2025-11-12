/**
 * GameScene 遊戲場景單元測試
 * 測試安全生成位置檢查邏輯
 */

import { TILE_TYPES } from '../../src/utils/Constants';

// 模擬 GameScene 的安全位置檢查方法（提取到外部供所有測試使用）
class MockGameScene {
  constructor(levelData) {
    this.levelData = levelData;
  }

  /**
   * 檢查位置是否安全（可以生成坦克）
   * 這是從 GameScene.js 複製的邏輯
   */
  isPositionSafe(x, y, map) {
    // 檢查是否超出地圖邊界
    if (y < 0 || y >= map.length || x < 0 || x >= map[0].length) {
      return false;
    }

    const tileType = map[y][x];

    // 安全的地形類型：空地(0)、冰地(4)、森林(5)
    const safeTiles = [TILE_TYPES.EMPTY, TILE_TYPES.ICE, TILE_TYPES.FOREST];

    return safeTiles.includes(tileType);
  }

  /**
   * 尋找安全的生成位置
   * 這是從 GameScene.js 複製的邏輯
   */
  findSafeSpawnPosition(x, y) {
    const map = this.levelData.map;

    // 檢查原始位置是否安全
    if (this.isPositionSafe(x, y, map)) {
      return { x, y };
    }

    // 如果不安全，在周圍尋找安全位置
    // 搜尋範圍逐漸擴大
    for (let radius = 1; radius <= 5; radius++) {
      for (let dx = -radius; dx <= radius; dx++) {
        for (let dy = -radius; dy <= radius; dy++) {
          // 只檢查當前半徑邊緣的點（避免重複檢查）
          if (Math.abs(dx) === radius || Math.abs(dy) === radius) {
            const newX = x + dx;
            const newY = y + dy;

            if (this.isPositionSafe(newX, newY, map)) {
              return { x: newX, y: newY };
            }
          }
        }
      }
    }

    // 如果還是找不到，使用預設安全位置
    return { x: 8, y: 24 };
  }
}

describe('GameScene - 安全生成位置檢查', () => {

  describe('isPositionSafe', () => {
    test('空地 (0) 應該是安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(1, 1, map)).toBe(true);
    });

    test('冰地 (4) 應該是安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 4, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(1, 1, map)).toBe(true);
    });

    test('森林 (5) 應該是安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 5, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(1, 1, map)).toBe(true);
    });

    test('磚牆 (1) 應該是不安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(1, 1, map)).toBe(false);
    });

    test('鋼牆 (2) 應該是不安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 2, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(1, 1, map)).toBe(false);
    });

    test('水域 (3) 應該是不安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 3, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(1, 1, map)).toBe(false);
    });

    test('基地 (6) 應該是不安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 6, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(1, 1, map)).toBe(false);
    });

    test('超出地圖邊界（負數）應該是不安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(-1, 1, map)).toBe(false);
      expect(scene.isPositionSafe(1, -1, map)).toBe(false);
    });

    test('超出地圖邊界（超過範圍）應該是不安全的', () => {
      const map = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(3, 1, map)).toBe(false);
      expect(scene.isPositionSafe(1, 3, map)).toBe(false);
    });
  });

  describe('findSafeSpawnPosition', () => {
    test('原始位置安全時，應該返回原始位置', () => {
      const map = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(2, 2);
      expect(result).toEqual({ x: 2, y: 2 });
    });

    test('原始位置在磚牆上，應該尋找附近的空地', () => {
      const map = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0], // 中間是磚牆
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(2, 2);

      // 應該找到附近的安全位置（不是原始位置）
      expect(result).not.toEqual({ x: 2, y: 2 });

      // 驗證找到的位置確實是安全的
      expect(scene.isPositionSafe(result.x, result.y, map)).toBe(true);
    });

    test('被牆壁包圍時，應該能找到外圍的空地', () => {
      const map = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 1, 1, 1, 0], // 中心被牆壁包圍
        [0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(2, 2);

      // 應該找到外圍的安全位置
      expect(scene.isPositionSafe(result.x, result.y, map)).toBe(true);

      // 確保不在中心的牆壁區域
      const isInWallArea = result.x >= 1 && result.x <= 3 && result.y >= 1 && result.y <= 3;
      expect(isInWallArea).toBe(false);
    });

    test('應該優先選擇最近的安全位置', () => {
      const map = [
        [0, 0, 0, 0, 0],
        [0, 1, 1, 1, 0],
        [0, 1, 1, 0, 0], // 右邊有空地
        [0, 1, 1, 1, 0],
        [0, 0, 0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(2, 2);

      // 應該找到距離為 1 的位置 (3, 2)
      expect(result).toEqual({ x: 3, y: 2 });
    });

    test('原始位置在冰地上，應該返回原始位置（冰地是安全的）', () => {
      const map = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 4, 0, 0], // 中間是冰地
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(2, 2);
      expect(result).toEqual({ x: 2, y: 2 });
    });

    test('原始位置在森林上，應該返回原始位置（森林是安全的）', () => {
      const map = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 5, 0, 0], // 中間是森林
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
      ];
      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(2, 2);
      expect(result).toEqual({ x: 2, y: 2 });
    });

    test('完全沒有安全位置時，應該返回預設位置 (8, 24)', () => {
      // 創建一個小地圖，全部都是牆壁
      const map = [
        [1, 1, 1],
        [1, 1, 1],
        [1, 1, 1]
      ];
      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(1, 1);

      // 應該返回預設位置
      expect(result).toEqual({ x: 8, y: 24 });
    });

    test('真實場景：關卡 4 的問題位置 (8, 24)', () => {
      // 模擬關卡 4 第 24 行的部分地圖
      const map = new Array(26).fill(null).map(() => new Array(26).fill(0));

      // 設置第 24 行 (索引 23) 的磚牆
      map[23][8] = 1; // 原本的問題位置
      map[23][9] = 1;
      map[23][10] = 1;
      map[23][11] = 1;
      map[23][12] = 1;
      map[23][13] = 1;
      map[23][14] = 1;
      map[23][15] = 1;

      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(8, 23);

      // 應該找到附近的安全位置
      expect(result).not.toEqual({ x: 8, y: 23 });
      expect(scene.isPositionSafe(result.x, result.y, map)).toBe(true);
    });

    test('真實場景：關卡 5 的問題位置 (8, 24)', () => {
      // 模擬關卡 5 第 24 行的部分地圖
      const map = new Array(26).fill(null).map(() => new Array(26).fill(0));

      // 設置第 24 行 (索引 23) 的磚牆
      map[23][8] = 1; // 原本的問題位置
      map[23][9] = 1;
      map[23][10] = 2; // 鋼牆
      map[23][11] = 2;
      map[23][12] = 2;
      map[23][13] = 2;
      map[23][14] = 2;
      map[23][15] = 1;

      const scene = new MockGameScene({ map });
      const result = scene.findSafeSpawnPosition(8, 23);

      // 應該找到附近的安全位置
      expect(result).not.toEqual({ x: 8, y: 23 });
      expect(scene.isPositionSafe(result.x, result.y, map)).toBe(true);
    });
  });

  describe('邊界情況測試', () => {
    test('地圖邊角位置應該正確處理', () => {
      const map = [
        [0, 0, 0],
        [0, 0, 0],
        [0, 0, 0]
      ];
      const scene = new MockGameScene({ map });

      // 測試四個角落
      expect(scene.isPositionSafe(0, 0, map)).toBe(true);
      expect(scene.isPositionSafe(2, 0, map)).toBe(true);
      expect(scene.isPositionSafe(0, 2, map)).toBe(true);
      expect(scene.isPositionSafe(2, 2, map)).toBe(true);
    });

    test('1x1 地圖應該正確處理', () => {
      const map = [[0]];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(0, 0, map)).toBe(true);
    });

    test('空地圖應該不會崩潰', () => {
      const map = [];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(0, 0, map)).toBe(false);
    });

    test('地圖只有一行時應該正確處理', () => {
      const map = [[0, 1, 0, 4, 5]];
      const scene = new MockGameScene({ map });
      expect(scene.isPositionSafe(0, 0, map)).toBe(true);  // 空地
      expect(scene.isPositionSafe(1, 0, map)).toBe(false); // 磚牆
      expect(scene.isPositionSafe(3, 0, map)).toBe(true);  // 冰地
      expect(scene.isPositionSafe(4, 0, map)).toBe(true);  // 森林
    });
  });
});

describe('GameScene - 經典道具掉落機制', () => {
  // 擴展 MockGameScene 以支持道具掉落測試
  class MockGameSceneWithPowerUps extends MockGameScene {
    constructor(levelData) {
      super(levelData);
      this.gameState = {
        enemiesKilled: 0,
        enemiesRemaining: 10
      };
      this.powerUpsSpawned = [];
    }

    spawnPowerUp(x, y, type) {
      this.powerUpsSpawned.push({ x, y, type });
    }

    onEnemyDestroyed() {
      this.gameState.enemiesKilled++;

      // 經典模式：第 4、11、18 輛敵人掉落道具
      const powerUpTriggers = [4, 11, 18];
      if (powerUpTriggers.includes(this.gameState.enemiesKilled)) {
        const pos = this.getRandomEmptyPosition();
        if (pos) {
          const tileSize = 32;
          const worldX = pos.x * tileSize + tileSize / 2;
          const worldY = pos.y * tileSize + tileSize / 2;
          this.spawnPowerUp(worldX, worldY);
        }
      }
    }

    getRandomEmptyPosition() {
      const map = this.levelData.map;
      const emptyPositions = [];

      for (let y = 2; y < map.length - 2; y++) {
        for (let x = 2; x < map[0].length - 2; x++) {
          if (this.isPositionSafe(x, y, map)) {
            emptyPositions.push({ x, y });
          }
        }
      }

      if (emptyPositions.length > 0) {
        return emptyPositions[0];
      }

      return { x: 13, y: 13 };
    }
  }

  describe('經典觸發點測試', () => {
    test('第 4 個敵人被擊毀時應該掉落道具', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));
      const scene = new MockGameSceneWithPowerUps({ map });

      // 擊毀前 3 個敵人
      scene.onEnemyDestroyed();
      scene.onEnemyDestroyed();
      scene.onEnemyDestroyed();
      expect(scene.powerUpsSpawned.length).toBe(0);

      // 擊毀第 4 個敵人
      scene.onEnemyDestroyed();
      expect(scene.powerUpsSpawned.length).toBe(1);
      expect(scene.gameState.enemiesKilled).toBe(4);
    });

    test('第 11 個敵人被擊毀時應該掉落道具', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));
      const scene = new MockGameSceneWithPowerUps({ map });

      // 擊毀 11 個敵人
      for (let i = 0; i < 11; i++) {
        scene.onEnemyDestroyed();
      }

      // 應該在第 4 和第 11 個敵人處掉落 2 個道具
      expect(scene.powerUpsSpawned.length).toBe(2);
      expect(scene.gameState.enemiesKilled).toBe(11);
    });

    test('第 18 個敵人被擊毀時應該掉落道具', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));
      const scene = new MockGameSceneWithPowerUps({ map });

      // 擊毀 18 個敵人
      for (let i = 0; i < 18; i++) {
        scene.onEnemyDestroyed();
      }

      // 應該在第 4、11、18 個敵人處掉落 3 個道具
      expect(scene.powerUpsSpawned.length).toBe(3);
      expect(scene.gameState.enemiesKilled).toBe(18);
    });

    test('擊毀 20 個敵人應該只掉落 3 個道具', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));
      const scene = new MockGameSceneWithPowerUps({ map });

      // 擊毀 20 個敵人
      for (let i = 0; i < 20; i++) {
        scene.onEnemyDestroyed();
      }

      // 只在第 4、11、18 處掉落道具
      expect(scene.powerUpsSpawned.length).toBe(3);
    });
  });

  describe('隨機位置生成測試', () => {
    test('應該在空地生成道具', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));
      const scene = new MockGameSceneWithPowerUps({ map });

      const pos = scene.getRandomEmptyPosition();
      expect(pos).toBeDefined();
      expect(scene.isPositionSafe(pos.x, pos.y, map)).toBe(true);
    });

    test('應該避開磚牆和鋼牆', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));
      // 在地圖中間放置一些障礙物
      for (let i = 10; i < 16; i++) {
        for (let j = 10; j < 16; j++) {
          map[i][j] = TILE_TYPES.BRICK;
        }
      }

      const scene = new MockGameSceneWithPowerUps({ map });
      const pos = scene.getRandomEmptyPosition();

      expect(pos).toBeDefined();
      expect(scene.isPositionSafe(pos.x, pos.y, map)).toBe(true);
      // 確保不在障礙物區域
      expect(pos.x < 10 || pos.x >= 16 || pos.y < 10 || pos.y >= 16).toBe(true);
    });

    test('應該可以在冰地生成道具', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.ICE));
      const scene = new MockGameSceneWithPowerUps({ map });

      const pos = scene.getRandomEmptyPosition();
      expect(pos).toBeDefined();
      expect(map[pos.y][pos.x]).toBe(TILE_TYPES.ICE);
    });

    test('應該可以在森林生成道具', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.FOREST));
      const scene = new MockGameSceneWithPowerUps({ map });

      const pos = scene.getRandomEmptyPosition();
      expect(pos).toBeDefined();
      expect(map[pos.y][pos.x]).toBe(TILE_TYPES.FOREST);
    });

    test('地圖邊緣應該被排除（避免生成在邊界）', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));
      const scene = new MockGameSceneWithPowerUps({ map });

      const pos = scene.getRandomEmptyPosition();
      expect(pos).toBeDefined();
      // 確保不在最外層 2 格邊界
      expect(pos.x).toBeGreaterThanOrEqual(2);
      expect(pos.x).toBeLessThan(24);
      expect(pos.y).toBeGreaterThanOrEqual(2);
      expect(pos.y).toBeLessThan(24);
    });
  });

  describe('道具位置有效性測試', () => {
    test('道具應該生成在可達位置', () => {
      const map = Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY));
      const scene = new MockGameSceneWithPowerUps({ map });

      // 擊毀第 4 個敵人觸發道具
      for (let i = 0; i < 4; i++) {
        scene.onEnemyDestroyed();
      }

      expect(scene.powerUpsSpawned.length).toBe(1);
      const powerUp = scene.powerUpsSpawned[0];

      // 檢查道具位置的有效性（轉換回格子座標）
      const tileSize = 32;
      const tileX = Math.floor((powerUp.x - tileSize / 2) / tileSize);
      const tileY = Math.floor((powerUp.y - tileSize / 2) / tileSize);

      expect(scene.isPositionSafe(tileX, tileY, map)).toBe(true);
    });
  });
});
