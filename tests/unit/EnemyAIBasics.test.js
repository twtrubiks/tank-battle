/**
 * EnemyAI 基礎行為測試（真實實作）
 * 撞牆換向、坦克相撞、卡住檢測、目標優先級
 */

import EnemyAI from '../../src/systems/EnemyAI';
import GridMovement from '../../src/utils/GridMovement';
import { TILE_TYPES } from '../../src/utils/Constants';

const makeEmptyMap = (size = 26) =>
  Array(size).fill(null).map(() => Array(size).fill(TILE_TYPES.EMPTY));

/**
 * 建立測試用坦克替身
 */
const makeTank = (overrides = {}) => ({
  x: GridMovement.gridToPixel(5, 5).x,
  y: GridMovement.gridToPixel(5, 5).y,
  enemyType: 'BASIC',
  direction: 'up',
  speed: 60,
  health: 1,
  maxHealth: 1,
  isFrozen: false,
  isDestroyed: false,
  move: jest.fn(),
  stop: jest.fn(),
  shoot: jest.fn(),
  body: { velocity: { x: 0, y: 0 } },
  ...overrides
});

/**
 * 建立測試用場景替身
 */
const makeScene = (map = makeEmptyMap()) => ({
  time: { now: 100000 },
  levelData: { map },
  aiBlackboard: null,
  player: null,
  base: null
});

describe('EnemyAI 基礎行為', () => {
  describe('目標優先級', () => {
    test('應該使用 enemyType 決定優先級（FAST 偏好攻擊基地）', () => {
      const ai = new EnemyAI(makeScene(), makeTank({ enemyType: 'FAST' }));

      expect(ai.targetPriority).toEqual({ player: 0.4, base: 0.6 });
    });

    test('BASIC 類型偏好攻擊玩家', () => {
      const ai = new EnemyAI(makeScene(), makeTank({ enemyType: 'BASIC' }));

      expect(ai.targetPriority).toEqual({ player: 0.7, base: 0.3 });
    });

    test('未知類型應該退回 BASIC 優先級', () => {
      const ai = new EnemyAI(makeScene(), makeTank({ enemyType: undefined }));

      expect(ai.targetPriority).toEqual({ player: 0.7, base: 0.3 });
    });
  });

  describe('onWallHit - 撞牆換向', () => {
    test('應該選擇可行走的垂直方向', () => {
      const map = makeEmptyMap();
      // 坦克在 (5,5) 朝上撞牆，左邊也是牆 → 只能往右
      map[5][4] = TILE_TYPES.BRICK;  // 左
      map[4][5] = TILE_TYPES.BRICK;  // 上

      const scene = makeScene(map);
      const ai = new EnemyAI(scene, makeTank());
      ai.desiredDirection = 'up';
      ai.lastDirectionChange = 0;

      ai.onWallHit();

      expect(ai.desiredDirection).toBe('right');
    });

    test('垂直方向都被堵住時應該從其他可行走方向挑選', () => {
      const map = makeEmptyMap();
      // 朝上撞牆，左右都是牆 → 只能往下
      map[5][4] = TILE_TYPES.BRICK;  // 左
      map[5][6] = TILE_TYPES.BRICK;  // 右
      map[4][5] = TILE_TYPES.BRICK;  // 上

      const scene = makeScene(map);
      const ai = new EnemyAI(scene, makeTank());
      ai.desiredDirection = 'up';
      ai.lastDirectionChange = 0;

      ai.onWallHit();

      expect(ai.desiredDirection).toBe('down');
    });

    test('冷卻時間內不應該換向', () => {
      const scene = makeScene();
      const ai = new EnemyAI(scene, makeTank());
      ai.desiredDirection = 'up';
      ai.lastDirectionChange = scene.time.now; // 剛換過方向

      ai.onWallHit();

      expect(ai.desiredDirection).toBe('up');
    });

    test('撞牆時應該作廢目前路徑', () => {
      const scene = makeScene();
      const ai = new EnemyAI(scene, makeTank());
      ai.desiredDirection = 'up';
      ai.lastDirectionChange = 0;
      ai.currentPath = [{ x: 100, y: 100 }];

      ai.onWallHit();

      expect(ai.currentPath).toBeNull();
    });
  });

  describe('onTankHit - 坦克相撞', () => {
    test('應該改變 desiredDirection 而非直接呼叫 move()', () => {
      const scene = makeScene();
      const tank = makeTank();
      const ai = new EnemyAI(scene, tank);
      ai.desiredDirection = 'down';
      ai.lastDirectionChange = 0;
      tank.move.mockClear();

      ai.onTankHit();

      // 統一移動出口才負責呼叫 move()，事件處理只改目標方向
      expect(tank.move).not.toHaveBeenCalled();
      expect(ai.desiredDirection).not.toBe('down');
    });
  });

  describe('_checkIfStuck - 卡住檢測（時間制）', () => {
    test('原地不動累積足夠時間後應該換方向', () => {
      const scene = makeScene();
      const ai = new EnemyAI(scene, makeTank());
      ai.desiredDirection = 'up';

      // 連續 4 個評估窗口（每窗口 250ms）原地不動 → 累積 1000ms
      for (let i = 0; i < 4; i++) {
        ai._checkIfStuck(250);
      }

      expect(ai.stuckTurned).toBe(true);
      expect(ai.desiredDirection).not.toBe('up');
    });

    test('正常移動時不應該觸發卡住處理', () => {
      const scene = makeScene();
      const tank = makeTank();
      const ai = new EnemyAI(scene, tank);
      ai.desiredDirection = 'up';

      // 每個窗口以正常速度移動（60 px/s * 0.25s = 15px）
      for (let i = 0; i < 8; i++) {
        tank.y -= 15;
        ai._checkIfStuck(250);
      }

      expect(ai.stuckTurned).toBe(false);
      expect(ai.stuckTime).toBe(0);
      expect(ai.desiredDirection).toBe('up');
    });

    test('嚴重卡住時應該強制對齊到格子中心', () => {
      const scene = makeScene();
      const center = GridMovement.gridToPixel(5, 5);
      const tank = makeTank({ x: center.x + 7, y: center.y - 5 });
      const ai = new EnemyAI(scene, tank);

      // 持續卡住直到超過 STUCK_ESCAPE_TIME（2500ms）
      for (let i = 0; i < 11; i++) {
        ai._checkIfStuck(250);
      }

      expect(tank.x).toBe(center.x);
      expect(tank.y).toBe(center.y);
    });
  });
});
