/**
 * 敵人出生點佔位檢查測試
 * 出生點被坦克佔據時不可疊生（兩個不可推動的 body 深度重疊無法分離）
 */

import GameScene from '../../src/scenes/GameScene';
import { GAME_CONFIG } from '../../src/utils/Constants';

const TILE = GAME_CONFIG.TILE_SIZE;
const OFFSET_Y = GAME_CONFIG.PLAY_OFFSET_Y;

/**
 * 出生點格子座標 → 世界座標
 */
const spawnToWorld = (spawn) => ({
  x: spawn.x * TILE + TILE / 2,
  y: spawn.y * TILE + TILE / 2 + OFFSET_Y
});

describe('敵人出生點佔位檢查', () => {
  let scene;
  const enemySpawns = [{ x: 0, y: 0 }, { x: 12, y: 0 }, { x: 24, y: 0 }];

  beforeEach(() => {
    scene = new GameScene();
    scene.levelData = { enemySpawns };
    scene.player = null;
    scene.enemies = { getChildren: () => [] };
  });

  describe('isSpawnPointFree', () => {
    test('附近沒有坦克時應該回報可用', () => {
      const world = spawnToWorld(enemySpawns[0]);

      expect(scene.isSpawnPointFree(world.x, world.y, TILE * 1.5)).toBe(true);
    });

    test('玩家佔據時應該回報不可用', () => {
      const world = spawnToWorld(enemySpawns[0]);
      scene.player = { active: true, x: world.x, y: world.y };

      expect(scene.isSpawnPointFree(world.x, world.y, TILE * 1.5)).toBe(false);
    });

    test('已死亡的坦克不應該佔據出生點', () => {
      const world = spawnToWorld(enemySpawns[0]);
      scene.player = { active: false, x: world.x, y: world.y };

      expect(scene.isSpawnPointFree(world.x, world.y, TILE * 1.5)).toBe(true);
    });
  });

  describe('findFreeSpawnPoint', () => {
    test('應該避開被玩家佔據的出生點', () => {
      const occupied = spawnToWorld(enemySpawns[0]);
      scene.player = { active: true, x: occupied.x, y: occupied.y };

      // 多次嘗試（出生點順序隨機），不可選到被佔據的點
      for (let i = 0; i < 20; i++) {
        const point = scene.findFreeSpawnPoint();
        expect(point).not.toBeNull();
        expect(point).not.toEqual(occupied);
      }
    });

    test('所有出生點都被佔據時應該回傳 null', () => {
      const occupiedTanks = enemySpawns.map(spawn => {
        const world = spawnToWorld(spawn);
        return { active: true, x: world.x, y: world.y };
      });
      scene.enemies = { getChildren: () => occupiedTanks };

      expect(scene.findFreeSpawnPoint()).toBeNull();
    });

    test('沒有任何坦克時應該回傳其中一個出生點', () => {
      const point = scene.findFreeSpawnPoint();
      const worlds = enemySpawns.map(spawnToWorld);

      expect(worlds).toContainEqual(point);
    });
  });
});
