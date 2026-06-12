/**
 * EnemyAI 狀態機整合測試
 * 驗證狀態機真正驅動行為：攻擊保持距離（停車射擊）、
 * 追逐使用 A* 尋路、巡邏視線射擊、撤退反向移動
 */

import EnemyAI from '../../src/systems/EnemyAI';
import GridMovement from '../../src/utils/GridMovement';
import { TILE_TYPES, AI_CONFIG } from '../../src/utils/Constants';

const makeEmptyMap = (size = 26) =>
  Array(size).fill(null).map(() => Array(size).fill(TILE_TYPES.EMPTY));

const makeTank = (overrides = {}) => ({
  x: GridMovement.gridToPixel(5, 5).x,
  y: GridMovement.gridToPixel(5, 5).y,
  enemyType: 'BASIC',
  direction: 'up',
  speed: 60,
  fireRate: 2000,
  health: 1,
  maxHealth: 1,
  isFrozen: false,
  isDestroyed: false,
  move: jest.fn(),
  stop: jest.fn(),
  face: jest.fn(),
  shoot: jest.fn(),
  body: { velocity: { x: 0, y: 0 } },
  ...overrides
});

const makeScene = (map = makeEmptyMap()) => ({
  time: { now: 100000 },
  levelData: { map },
  aiBlackboard: null,
  player: null,
  base: null
});

/**
 * 建立指定狀態的 AI，並關閉本次 update 的狀態重新評估
 */
const makeAIInState = (scene, tank, state, target = 'player') => {
  const ai = new EnemyAI(scene, tank);
  ai.currentTarget = target;
  ai.stateMachine.setState(state);
  ai.lastStateChange = scene.time.now; // 冷卻中，不重新評估狀態
  return ai;
};

describe('EnemyAI 狀態機整合', () => {
  describe('attack 狀態 - 保持距離', () => {
    test('在理想距離內應該停車射擊而非繼續逼近', () => {
      const scene = makeScene();
      const tank = makeTank();
      // 玩家在正上方 100px（理想距離範圍內）
      scene.player = {
        x: tank.x,
        y: tank.y - 100,
        isDestroyed: false,
        body: { velocity: { x: 0, y: 0 } }
      };

      const ai = makeAIInState(scene, tank, 'attack');
      ai.update(16);

      // 停車 + 轉向目標 + 開火，不得繼續移動
      expect(tank.stop).toHaveBeenCalled();
      expect(tank.move).not.toHaveBeenCalled();
      expect(tank.face).toHaveBeenCalledWith('up');
      expect(tank.shoot).toHaveBeenCalled();
    });

    test('距離太近時應該拉開距離（恢復移動）', () => {
      const scene = makeScene();
      const tank = makeTank();
      // 玩家貼臉（40px < 理想距離 - 緩衝）
      scene.player = {
        x: tank.x,
        y: tank.y - 40,
        isDestroyed: false,
        body: { velocity: { x: 0, y: 0 } }
      };

      const ai = makeAIInState(scene, tank, 'attack');
      ai.lastDirectionChange = 0;
      ai.update(16);

      // 應該往遠離玩家的方向移動（玩家在上 → 往下）
      expect(tank.move).toHaveBeenCalledWith('down');
      expect(tank.stop).not.toHaveBeenCalled();
    });
  });

  describe('chase 狀態 - A* 尋路', () => {
    test('目標在牆後時應該計算出繞行路徑', () => {
      const map = makeEmptyMap();
      // 在敵人與玩家之間築一道橫牆，只留 x=10 一個缺口
      for (let x = 0; x < 26; x++) {
        if (x !== 10) {
          map[7][x] = TILE_TYPES.STEEL;
        }
      }

      const scene = makeScene(map);
      const tank = makeTank(); // 位於格子 (5,5)
      const playerPos = GridMovement.gridToPixel(5, 12); // 牆的另一側
      scene.player = {
        x: playerPos.x,
        y: playerPos.y,
        isDestroyed: false,
        body: { velocity: { x: 0, y: 0 } }
      };

      const ai = makeAIInState(scene, tank, 'chase');
      ai.update(16);

      // 應該產生路徑並開始沿路徑移動
      expect(ai.currentPath).not.toBeNull();
      expect(ai.currentPath.length).toBeGreaterThan(0);
      // 路徑必須通過缺口（x=10）
      const passesGap = ai.currentPath.some(p => p.gridX === 10);
      expect(passesGap).toBe(true);
      expect(tank.move).toHaveBeenCalledWith(ai.desiredDirection);
    });

    test('目標消失時應該回到巡邏狀態', () => {
      const scene = makeScene();
      const tank = makeTank();
      scene.player = null;

      const ai = makeAIInState(scene, tank, 'chase');
      ai.update(16);

      expect(ai.stateMachine.getCurrentState()).toBe('patrol');
    });
  });

  describe('patrol 狀態 - 視線射擊', () => {
    test('看得到玩家且對準時應該瞄準射擊', () => {
      const scene = makeScene();
      const tank = makeTank({ direction: 'up' });
      // 玩家在正上方、無遮蔽
      scene.player = {
        x: tank.x,
        y: tank.y - 150,
        isDestroyed: false,
        body: { velocity: { x: 0, y: 0 } }
      };

      const ai = makeAIInState(scene, tank, 'patrol');
      ai.lastLosCheck = 0; // 強制本幀更新視線
      ai.update(16);

      expect(ai.hasLineOfSight).toBe(true);
      expect(tank.shoot).toHaveBeenCalled();
    });

    test('玩家被牆擋住時不應該有視線', () => {
      const map = makeEmptyMap();
      // 玩家上方隔一道牆
      map[3][5] = TILE_TYPES.BRICK;

      const scene = makeScene(map);
      const tank = makeTank({ direction: 'up' });
      const playerPos = GridMovement.gridToPixel(5, 1);
      scene.player = {
        x: playerPos.x,
        y: playerPos.y,
        isDestroyed: false,
        body: { velocity: { x: 0, y: 0 } }
      };

      const ai = makeAIInState(scene, tank, 'patrol');
      ai.lastLosCheck = 0;
      ai.update(16);

      expect(ai.hasLineOfSight).toBe(false);
    });
  });

  describe('retreat 狀態 - 撤退', () => {
    test('應該往遠離目標的方向移動', () => {
      const scene = makeScene();
      const tank = makeTank();
      // 玩家在正下方
      scene.player = {
        x: tank.x,
        y: tank.y + 120,
        isDestroyed: false,
        body: { velocity: { x: 0, y: 0 } }
      };

      const ai = makeAIInState(scene, tank, 'retreat');
      ai.lastDirectionChange = 0;
      ai.update(16);

      expect(tank.move).toHaveBeenCalledWith('up');
    });
  });

  describe('統一移動出口', () => {
    test('每幀只呼叫一次 move()', () => {
      const scene = makeScene();
      const tank = makeTank();

      const ai = makeAIInState(scene, tank, 'patrol');
      ai.update(16);

      expect(tank.move).toHaveBeenCalledTimes(1);
      expect(tank.move).toHaveBeenCalledWith(ai.desiredDirection);
    });

    test('冰凍時不應該執行任何 AI 行為', () => {
      const scene = makeScene();
      const tank = makeTank({ isFrozen: true });

      const ai = makeAIInState(scene, tank, 'patrol');
      ai.update(16);

      expect(tank.move).not.toHaveBeenCalled();
      expect(tank.shoot).not.toHaveBeenCalled();
    });
  });

  describe('卡住檢測與移動意圖', () => {
    test('主動停車（攻擊保持距離）不應該被判定為卡住', () => {
      const scene = makeScene();
      const tank = makeTank();
      scene.player = {
        x: tank.x,
        y: tank.y - 100,
        isDestroyed: false,
        body: { velocity: { x: 0, y: 0 } }
      };

      const ai = makeAIInState(scene, tank, 'attack');

      // 停車狀態持續超過 STUCK_TURN_TIME
      const frames = Math.ceil((AI_CONFIG.STUCK_TURN_TIME * 2) / 250);
      for (let i = 0; i < frames; i++) {
        ai.lastStateChange = scene.time.now;
        ai.update(250);
      }

      expect(ai.stuckTime).toBe(0);
      expect(ai.stuckTurned).toBe(false);
    });
  });
});
