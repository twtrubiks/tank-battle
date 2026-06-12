/**
 * GridMovement 格子移動輔助測試
 * 重點：對齊目標必須是格子中心（k * TILE_SIZE + TILE_SIZE / 2），
 * 與 gridToPixel / 坦克生成位置一致，而非格線交點
 */

import GridMovement from '../../src/utils/GridMovement';
import { GAME_CONFIG, TILE_TYPES } from '../../src/utils/Constants';

const TILE = GAME_CONFIG.TILE_SIZE;       // 32
const OFFSET_Y = GAME_CONFIG.PLAY_OFFSET_Y; // 44

/**
 * 建立全空地的測試地圖
 */
const makeEmptyMap = (size = 26) =>
  Array(size).fill(null).map(() => Array(size).fill(TILE_TYPES.EMPTY));

describe('GridMovement', () => {
  describe('snapXToGrid / snapYToGrid - 對齊到格子中心', () => {
    test('已在格子中心的座標應該保持不變', () => {
      // 格子 1 的中心：1 * 32 + 16 = 48
      expect(GridMovement.snapXToGrid(48)).toBe(48);
      // 格子 24 的中心（Y 含偏移）：24 * 32 + 16 + 44 = 828
      expect(GridMovement.snapYToGrid(828)).toBe(828);
    });

    test('偏移的座標應該吸附到最近的格子中心', () => {
      expect(GridMovement.snapXToGrid(60)).toBe(48);   // 距 48 較近
      expect(GridMovement.snapXToGrid(65)).toBe(80);   // 距 80 較近
      expect(GridMovement.snapYToGrid(70)).toBe(60);   // 格子 0 中心 = 16 + 44 = 60
      expect(GridMovement.snapYToGrid(77)).toBe(92);   // 格子 1 中心 = 48 + 44 = 92
    });

    test('snap 結果應該與 gridToPixel 一致', () => {
      for (let grid = 0; grid < 5; grid++) {
        const pixel = GridMovement.gridToPixel(grid, grid);
        expect(GridMovement.snapXToGrid(pixel.x)).toBe(pixel.x);
        expect(GridMovement.snapYToGrid(pixel.y)).toBe(pixel.y);
      }
    });
  });

  describe('pixelToGrid / gridToPixel - 座標轉換', () => {
    test('gridToPixel 應該回傳格子中心', () => {
      expect(GridMovement.gridToPixel(0, 0)).toEqual({ x: 16, y: 16 + OFFSET_Y });
      expect(GridMovement.gridToPixel(2, 3)).toEqual({
        x: 2 * TILE + 16,
        y: 3 * TILE + 16 + OFFSET_Y
      });
    });

    test('pixelToGrid 與 gridToPixel 應該互為反函數', () => {
      const pixel = GridMovement.gridToPixel(5, 7);
      expect(GridMovement.pixelToGrid(pixel.x, pixel.y)).toEqual({ gridX: 5, gridY: 7 });
    });
  });

  describe('checkAlignment - 對齊檢查', () => {
    test('位於格子中心的坦克應該判定為已對齊', () => {
      const pixel = GridMovement.gridToPixel(3, 3);
      const alignment = GridMovement.checkAlignment({ x: pixel.x, y: pixel.y });

      expect(alignment.alignedX).toBe(true);
      expect(alignment.alignedY).toBe(true);
      expect(alignment.offsetX).toBe(0);
      expect(alignment.offsetY).toBe(0);
    });

    test('偏離中心的坦克應該回報正確偏移量', () => {
      const pixel = GridMovement.gridToPixel(3, 3);
      const alignment = GridMovement.checkAlignment({ x: pixel.x + 6, y: pixel.y - 5 });

      expect(alignment.alignedX).toBe(false);
      expect(alignment.alignedY).toBe(false);
      expect(alignment.offsetX).toBe(6);
      expect(alignment.offsetY).toBe(-5);
      expect(alignment.nearestX).toBe(pixel.x);
      expect(alignment.nearestY).toBe(pixel.y);
    });
  });

  describe('isPositionWalkable - 可行走檢查', () => {
    test('空地、冰地、森林應該可行走', () => {
      const map = makeEmptyMap();
      map[5][5] = TILE_TYPES.ICE;
      map[6][6] = TILE_TYPES.FOREST;

      expect(GridMovement.isPositionWalkable(...Object.values(GridMovement.gridToPixel(5, 5)), map)).toBe(true);
      expect(GridMovement.isPositionWalkable(...Object.values(GridMovement.gridToPixel(6, 6)), map)).toBe(true);
    });

    test('磚牆、鋼牆、水域應該不可行走', () => {
      const map = makeEmptyMap();
      map[5][5] = TILE_TYPES.BRICK;
      map[6][6] = TILE_TYPES.STEEL;
      map[7][7] = TILE_TYPES.WATER;

      [[5, 5], [6, 6], [7, 7]].forEach(([gx, gy]) => {
        const pixel = GridMovement.gridToPixel(gx, gy);
        expect(GridMovement.isPositionWalkable(pixel.x, pixel.y, map)).toBe(false);
      });
    });

    test('超出地圖範圍應該不可行走', () => {
      const map = makeEmptyMap();
      expect(GridMovement.isPositionWalkable(-50, -50, map)).toBe(false);
    });
  });

  describe('calculateCornerSlide - 角落滑動修正', () => {
    test('垂直移動且水平偏移時應該回傳朝中心線的滑動修正', () => {
      const map = makeEmptyMap();
      const center = GridMovement.gridToPixel(5, 5);
      // 坦克向上移動，但偏右 8px
      const tank = { x: center.x + 8, y: center.y };

      const slide = GridMovement.calculateCornerSlide(tank, 'up', map);

      expect(slide).not.toBeNull();
      expect(slide.axis).toBe('x');
      expect(slide.amount).toBeLessThan(0); // 往左修正（朝中心）
      expect(slide.targetValue).toBe(center.x);
    });

    test('滑動目標被牆阻擋時不應該回傳修正', () => {
      const map = makeEmptyMap();
      const center = GridMovement.gridToPixel(5, 5);
      // 中心線位置是牆
      map[5][5] = TILE_TYPES.BRICK;
      const tank = { x: center.x + 8, y: center.y };

      const slide = GridMovement.calculateCornerSlide(tank, 'up', map);

      expect(slide).toBeNull();
    });

    test('已對齊時不需要滑動修正', () => {
      const map = makeEmptyMap();
      const center = GridMovement.gridToPixel(5, 5);
      const tank = { x: center.x, y: center.y };

      expect(GridMovement.calculateCornerSlide(tank, 'up', map)).toBeNull();
      expect(GridMovement.calculateCornerSlide(tank, 'left', map)).toBeNull();
    });
  });

  describe('forceSnapToGrid - 強制對齊', () => {
    test('應該將偏移的坦克吸附回格子中心（而非格線交點）', () => {
      const map = makeEmptyMap();
      const center = GridMovement.gridToPixel(5, 5);
      const tank = { x: center.x + 7, y: center.y - 9 };

      const result = GridMovement.forceSnapToGrid(tank, map);

      expect(result).toBe(true);
      expect(tank.x).toBe(center.x);
      expect(tank.y).toBe(center.y);
      // 對齊後的位置必須是格子中心格式：k * 32 + 16
      expect((tank.x - TILE / 2) % TILE).toBe(0);
      expect((tank.y - OFFSET_Y - TILE / 2) % TILE).toBe(0);
    });

    test('對齊目標不可行走時不應該移動坦克', () => {
      const map = makeEmptyMap();
      map[5][5] = TILE_TYPES.STEEL;
      const center = GridMovement.gridToPixel(5, 5);
      const tank = { x: center.x + 5, y: center.y };

      const result = GridMovement.forceSnapToGrid(tank, map);

      expect(result).toBe(false);
      expect(tank.x).toBe(center.x + 5);
    });
  });

  describe('canMoveInDirection / getAvailableDirections', () => {
    test('前方有牆時應該回報不可通行', () => {
      const map = makeEmptyMap();
      map[4][5] = TILE_TYPES.BRICK; // 上方一格是牆
      const center = GridMovement.gridToPixel(5, 5);
      const tank = { x: center.x, y: center.y };

      expect(GridMovement.canMoveInDirection(tank, 'up', map)).toBe(false);
      expect(GridMovement.canMoveInDirection(tank, 'down', map)).toBe(true);

      const available = GridMovement.getAvailableDirections(tank, map);
      expect(available).not.toContain('up');
      expect(available).toEqual(expect.arrayContaining(['down', 'left', 'right']));
    });
  });
});
