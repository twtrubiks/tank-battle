/**
 * 基地防護（鏟子道具）測試
 * 重點：重複拾取時延長時間而非疊加，
 * 原牆（磚/鋼/水）在防護結束後依類型恢復
 */

import GameScene from '../../src/scenes/GameScene';
import { TILE_TYPES, GAME_CONFIG } from '../../src/utils/Constants';

describe('基地防護（鏟子道具）', () => {
  let scene;
  let pendingTimers;

  /**
   * 建立可手動觸發 delayedCall 的 GameScene 測試替身
   */
  const createScene = (existingWalls = []) => {
    pendingTimers = [];

    const s = new GameScene();
    s.base = { isDestroyed: false };
    s.gameState = { baseProtected: false };
    s.levelData = {
      basePosition: { x: 12, y: 24 },
      map: Array(26).fill(null).map(() => Array(26).fill(TILE_TYPES.EMPTY))
    };
    s.add = { existing: jest.fn() };
    s.collisionSystem = {
      addWall: jest.fn(),
      wallGroup: { getChildren: () => existingWalls }
    };
    s.time = {
      delayedCall: jest.fn((duration, callback) => {
        const timer = { duration, callback, removed: false, remove: jest.fn(function () { this.removed = true; }) };
        pendingTimers.push(timer);
        return timer;
      })
    };
    return s;
  };

  /**
   * 在指定世界座標建立一面測試用原牆
   */
  const makeExistingWall = (gridX, gridY, type) => {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    return {
      active: true,
      type,
      x: gridX * tileSize + tileSize / 2,
      y: gridY * tileSize + tileSize / 2 + GAME_CONFIG.PLAY_OFFSET_Y,
      destroy: jest.fn(function () { this.active = false; })
    };
  };

  beforeEach(() => {
    scene = createScene();
  });

  test('啟動防護時應該在基地周圍建立 8 面鋼牆', () => {
    scene.activateBaseProtection(15000);

    expect(scene.gameState.baseProtected).toBe(true);
    expect(scene.baseProtectionWalls).toHaveLength(8);
    expect(scene.collisionSystem.addWall).toHaveBeenCalledTimes(8);

    // 地圖資料同步為鋼牆
    expect(scene.levelData.map[23][11]).toBe(TILE_TYPES.STEEL);
    expect(scene.levelData.map[24][11]).toBe(TILE_TYPES.STEEL);
  });

  test('防護到期後應該移除鋼牆並恢復原本的磚牆', () => {
    const brick = makeExistingWall(11, 23, 'brick');
    scene = createScene([brick]);

    scene.activateBaseProtection(15000);
    expect(brick.destroy).toHaveBeenCalled();

    // 觸發到期
    pendingTimers[0].callback();

    expect(scene.gameState.baseProtected).toBe(false);
    // 原磚牆恢復：addWall 被呼叫 8（鋼牆）+ 1（恢復磚牆）次
    expect(scene.collisionSystem.addWall).toHaveBeenCalledTimes(9);
    expect(scene.levelData.map[23][11]).toBe(TILE_TYPES.BRICK);
  });

  test('防護期間重複拾取應該重設計時器而非重建牆', () => {
    scene.activateBaseProtection(15000);
    const firstTimer = pendingTimers[0];
    const wallsAfterFirst = scene.collisionSystem.addWall.mock.calls.length;

    // 防護中再次拾取
    scene.activateBaseProtection(15000);

    // 第一個計時器被取消、不重建牆
    expect(firstTimer.remove).toHaveBeenCalled();
    expect(scene.collisionSystem.addWall).toHaveBeenCalledTimes(wallsAfterFirst);
    expect(pendingTimers).toHaveLength(2);

    // 只有新計時器到期才會結束防護
    pendingTimers[1].callback();
    expect(scene.gameState.baseProtected).toBe(false);
  });

  test('原本是鋼牆時，防護結束後應該恢復鋼牆而非磚牆', () => {
    const steel = makeExistingWall(13, 23, 'steel');
    scene = createScene([steel]);

    scene.activateBaseProtection(15000);
    pendingTimers[0].callback();

    expect(scene.levelData.map[23][13]).toBe(TILE_TYPES.STEEL);
  });

  test('基地已被摧毀時不應該啟動防護', () => {
    scene.base.isDestroyed = true;
    scene.activateBaseProtection(15000);

    expect(scene.gameState.baseProtected).toBe(false);
    expect(scene.collisionSystem.addWall).not.toHaveBeenCalled();
  });
});
