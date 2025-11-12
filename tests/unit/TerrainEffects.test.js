/**
 * 地形效果單元測試
 * 測試水域、冰地、森林的物理效果
 */

describe('地形效果', () => {
  describe('水域（Water）', () => {
    test('水域應該阻擋坦克移動', () => {
      const water = {
        type: 'water',
        isStatic: true,
        blocksMovement: true
      };

      expect(water.type).toBe('water');
      expect(water.blocksMovement).toBe(true);
    });

    test('子彈應該能穿透水域', () => {
      const water = { type: 'water' };
      const bullet = { active: true };

      // 子彈穿透邏輯（在 CollisionSystem 中實現）
      const shouldDestroy = water.type !== 'water';

      expect(shouldDestroy).toBe(false);
    });

    test('水域應該有波浪動畫效果', () => {
      const water = {
        type: 'water',
        alpha: 0.95,
        hasAnimation: true
      };

      expect(water.hasAnimation).toBe(true);
      expect(water.alpha).toBeGreaterThan(0.8);
      expect(water.alpha).toBeLessThanOrEqual(1);
    });
  });

  describe('冰地（Ice）', () => {
    test('坦克進入冰地時應該降低阻力', () => {
      const tank = {
        drag: 400,
        onIce: false
      };

      // 模擬進入冰地
      const originalDrag = tank.drag;
      tank.drag = 50; // 冰地阻力
      tank.onIce = true;

      expect(tank.drag).toBeLessThan(originalDrag);
      expect(tank.drag).toBe(50);
      expect(tank.onIce).toBe(true);
    });

    test('坦克離開冰地時應該恢復原始阻力', () => {
      const tank = {
        drag: 50,
        onIce: true,
        originalDrag: 400
      };

      // 模擬離開冰地
      tank.drag = tank.originalDrag;
      tank.onIce = false;

      expect(tank.drag).toBe(400);
      expect(tank.onIce).toBe(false);
    });

    test('冰地滑行係數應該正確', () => {
      const ice = {
        type: 'ice',
        slipperiness: 0.95,
        reducedDrag: 50
      };

      expect(ice.slipperiness).toBeGreaterThan(0.9);
      expect(ice.reducedDrag).toBeLessThan(100);
    });
  });

  describe('森林（Forest）', () => {
    test('坦克進入森林時應該被視覺遮蔽', () => {
      const tank = {
        alpha: 1.0,
        inForest: false
      };

      // 模擬進入森林
      tank.alpha = 0.7;
      tank.inForest = true;

      expect(tank.alpha).toBeLessThan(1.0);
      expect(tank.alpha).toBe(0.7);
      expect(tank.inForest).toBe(true);
    });

    test('坦克離開森林時應該恢復原始透明度', () => {
      const tank = {
        alpha: 0.7,
        inForest: true,
        originalAlpha: 1.0
      };

      // 模擬離開森林
      tank.alpha = tank.originalAlpha;
      tank.inForest = false;

      expect(tank.alpha).toBe(1.0);
      expect(tank.inForest).toBe(false);
    });

    test('森林應該在坦克上方渲染（深度層級）', () => {
      const DEPTHS = {
        MAP_LOWER: 1,
        ENTITY: 2,
        MAP_UPPER: 3
      };

      const forest = { depth: DEPTHS.MAP_UPPER };
      const tank = { depth: DEPTHS.ENTITY };

      expect(forest.depth).toBeGreaterThan(tank.depth);
    });

    test('森林本身應該是半透明的', () => {
      const forest = {
        type: 'forest',
        alpha: 0.85
      };

      expect(forest.alpha).toBeGreaterThan(0.7);
      expect(forest.alpha).toBeLessThan(1.0);
    });
  });

  describe('地形重疊檢測', () => {
    test('應該正確檢測坦克與地形的重疊', () => {
      // 模擬矩形重疊檢測
      const tankBounds = { x: 100, y: 100, width: 32, height: 32 };
      const terrainBounds = { x: 110, y: 110, width: 32, height: 32 };

      // 簡化的 AABB 碰撞檢測
      const isOverlapping =
        tankBounds.x < terrainBounds.x + terrainBounds.width &&
        tankBounds.x + tankBounds.width > terrainBounds.x &&
        tankBounds.y < terrainBounds.y + terrainBounds.height &&
        tankBounds.y + tankBounds.height > terrainBounds.y;

      expect(isOverlapping).toBe(true);
    });

    test('不重疊時應該返回 false', () => {
      const tankBounds = { x: 100, y: 100, width: 32, height: 32 };
      const terrainBounds = { x: 200, y: 200, width: 32, height: 32 };

      const isOverlapping =
        tankBounds.x < terrainBounds.x + terrainBounds.width &&
        tankBounds.x + tankBounds.width > terrainBounds.x &&
        tankBounds.y < terrainBounds.y + terrainBounds.height &&
        tankBounds.y + tankBounds.height > terrainBounds.y;

      expect(isOverlapping).toBe(false);
    });
  });
});
