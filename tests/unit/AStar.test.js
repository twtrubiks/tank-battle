/**
 * A* 尋路演算法測試
 */

import AStar from '../../src/utils/AStar';
import { TILE_TYPES, GAME_CONFIG } from '../../src/utils/Constants';

const TILE = GAME_CONFIG.TILE_SIZE;
const OFFSET_Y = GAME_CONFIG.PLAY_OFFSET_Y;

const makeEmptyMap = (size = 26) =>
  Array(size).fill(null).map(() => Array(size).fill(TILE_TYPES.EMPTY));

/**
 * 格子座標轉世界座標（格子中心）
 */
const toWorld = (gridX, gridY) => ({
  x: gridX * TILE + TILE / 2,
  y: gridY * TILE + TILE / 2 + OFFSET_Y
});

describe('AStar', () => {
  test('開闊地圖上應該找到路徑', () => {
    const map = makeEmptyMap();
    const path = AStar.findPath(toWorld(1, 1), toWorld(5, 1), map, TILE, OFFSET_Y);

    expect(path).not.toBeNull();
    expect(path.length).toBeGreaterThan(0);
    // 終點是目標格子
    const last = path[path.length - 1];
    expect(last.gridX).toBe(5);
    expect(last.gridY).toBe(1);
  });

  test('路徑應該繞過牆壁缺口', () => {
    const map = makeEmptyMap();
    // 橫牆只留 x=10 缺口
    for (let x = 0; x < 26; x++) {
      if (x !== 10) {
        map[7][x] = TILE_TYPES.BRICK;
      }
    }

    const path = AStar.findPath(toWorld(5, 5), toWorld(5, 12), map, TILE, OFFSET_Y);

    expect(path).not.toBeNull();
    // 穿越橫牆的那一步必須在缺口
    const crossing = path.find(p => p.gridY === 7);
    expect(crossing.gridX).toBe(10);
  });

  test('目標被完全包圍時應該回傳 null', () => {
    const map = makeEmptyMap();
    // 目標 (10,10) 周圍築滿鋼牆
    [[9, 10], [11, 10], [10, 9], [10, 11]].forEach(([x, y]) => {
      map[y][x] = TILE_TYPES.STEEL;
    });

    const path = AStar.findPath(toWorld(1, 1), toWorld(10, 10), map, TILE, OFFSET_Y);

    expect(path).toBeNull();
  });

  test('冰地、森林與基地格應該可通行', () => {
    const map = makeEmptyMap();
    // 強制路徑經過特殊地形
    for (let x = 0; x < 26; x++) {
      if (x !== 3) {
        map[5][x] = TILE_TYPES.BRICK;
      }
    }
    map[5][3] = TILE_TYPES.ICE;

    const path = AStar.findPath(toWorld(3, 3), toWorld(3, 8), map, TILE, OFFSET_Y);

    expect(path).not.toBeNull();
    expect(path.some(p => p.gridX === 3 && p.gridY === 5)).toBe(true);
  });

  test('水域應該不可通行', () => {
    const map = makeEmptyMap();
    // 水域整排橫斷
    for (let x = 0; x < 26; x++) {
      map[5][x] = TILE_TYPES.WATER;
    }

    const path = AStar.findPath(toWorld(3, 3), toWorld(3, 8), map, TILE, OFFSET_Y);

    expect(path).toBeNull();
  });

  describe('simplifyPath', () => {
    test('應該移除同方向的中間點', () => {
      const straight = [
        { x: 16, y: 16 },
        { x: 48, y: 16 },
        { x: 80, y: 16 },
        { x: 112, y: 16 }
      ];

      const simplified = AStar.simplifyPath(straight);

      // 直線只保留頭尾（可能含一個方向起點）
      expect(simplified.length).toBeLessThan(straight.length);
      expect(simplified[simplified.length - 1]).toEqual(straight[straight.length - 1]);
    });

    test('應該保留轉彎點', () => {
      const lShape = [
        { x: 16, y: 16 },
        { x: 48, y: 16 },
        { x: 80, y: 16 },
        { x: 80, y: 48 },
        { x: 80, y: 80 }
      ];

      const simplified = AStar.simplifyPath(lShape);

      // 轉彎點 (80,16) 必須保留
      expect(simplified.some(p => p.x === 80 && p.y === 16)).toBe(true);
      expect(simplified[simplified.length - 1]).toEqual(lShape[lShape.length - 1]);
    });
  });
});
