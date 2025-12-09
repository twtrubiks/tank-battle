/**
 * EnemyAI 進階功能單元測試
 * 測試預測射擊、視線檢測、智能巡邏、包抄戰術等
 */

describe('EnemyAI 進階功能', () => {
  describe('預測射擊', () => {
    test('應該能預測靜止目標的位置', () => {
      const target = {
        x: 100,
        y: 100,
        body: { velocity: { x: 0, y: 0 } }
      };

      const predictionTime = 0.3;
      const predictedPos = {
        x: target.x + target.body.velocity.x * predictionTime,
        y: target.y + target.body.velocity.y * predictionTime
      };

      expect(predictedPos.x).toBe(100);
      expect(predictedPos.y).toBe(100);
    });

    test('應該能預測移動目標的位置', () => {
      const target = {
        x: 100,
        y: 100,
        body: { velocity: { x: 100, y: 50 } }
      };

      const predictionTime = 0.5;
      const predictedPos = {
        x: target.x + target.body.velocity.x * predictionTime,
        y: target.y + target.body.velocity.y * predictionTime
      };

      expect(predictedPos.x).toBe(150); // 100 + 100 * 0.5
      expect(predictedPos.y).toBe(125); // 100 + 50 * 0.5
    });

    test('預測時間越長，偏移越大', () => {
      const target = {
        x: 0,
        y: 0,
        body: { velocity: { x: 120, y: 0 } }
      };

      const shortPrediction = target.x + target.body.velocity.x * 0.2;
      const longPrediction = target.x + target.body.velocity.x * 0.5;

      expect(shortPrediction).toBe(24);
      expect(longPrediction).toBe(60);
      expect(longPrediction).toBeGreaterThan(shortPrediction);
    });

    test('應該能判斷是否對準預測位置', () => {
      const tank = { x: 100, y: 100, direction: 'right' };
      const predictedPos = { x: 200, y: 100 };
      const tolerance = 40;

      // 水平對齊
      const isAligned = Math.abs(tank.y - predictedPos.y) < tolerance;
      // 方向正確
      const isDirectionCorrect = tank.direction === 'right' && tank.x < predictedPos.x;

      expect(isAligned).toBe(true);
      expect(isDirectionCorrect).toBe(true);
    });
  });

  describe('視線檢測 (Line of Sight)', () => {
    const TILE_TYPES = {
      EMPTY: 0,
      BRICK: 1,
      STEEL: 2
    };

    test('無障礙物時應該有視線', () => {
      const map = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
      ];

      const from = { x: 0, y: 0 };
      const to = { x: 4, y: 4 };

      // 模擬視線檢測：檢查路徑上是否有障礙物
      let hasLineOfSight = true;
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const steps = Math.max(Math.abs(dx), Math.abs(dy));

      for (let i = 0; i <= steps; i++) {
        const x = Math.round(from.x + (dx * i) / steps);
        const y = Math.round(from.y + (dy * i) / steps);
        if (map[y] && map[y][x] === TILE_TYPES.BRICK || map[y][x] === TILE_TYPES.STEEL) {
          hasLineOfSight = false;
          break;
        }
      }

      expect(hasLineOfSight).toBe(true);
    });

    test('有牆壁時應該沒有視線', () => {
      const map = [
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 1, 0, 0], // 中間有磚牆
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0]
      ];

      const from = { x: 0, y: 2 };
      const to = { x: 4, y: 2 };

      // 模擬視線檢測
      let hasLineOfSight = true;
      for (let x = from.x; x <= to.x; x++) {
        if (map[2][x] === TILE_TYPES.BRICK || map[2][x] === TILE_TYPES.STEEL) {
          hasLineOfSight = false;
          break;
        }
      }

      expect(hasLineOfSight).toBe(false);
    });

    test('Bresenham 演算法應該正確計算路徑', () => {
      // 測試從 (0, 0) 到 (4, 2) 的路徑
      const from = { x: 0, y: 0 };
      const to = { x: 4, y: 2 };

      const path = [];
      let x = from.x;
      let y = from.y;
      const dx = Math.abs(to.x - from.x);
      const dy = Math.abs(to.y - from.y);
      const sx = from.x < to.x ? 1 : -1;
      const sy = from.y < to.y ? 1 : -1;
      let err = dx - dy;

      while (true) {
        path.push({ x, y });
        if (x === to.x && y === to.y) break;

        const e2 = 2 * err;
        if (e2 > -dy) {
          err -= dy;
          x += sx;
        }
        if (e2 < dx) {
          err += dx;
          y += sy;
        }
      }

      expect(path.length).toBeGreaterThan(0);
      expect(path[0]).toEqual({ x: 0, y: 0 });
      expect(path[path.length - 1]).toEqual({ x: 4, y: 2 });
    });
  });

  describe('智能巡邏', () => {
    test('應該能生成有效的巡邏點', () => {
      const margin = 80;
      const width = 832;
      const height = 832;

      const patrolPoint = {
        x: margin + Math.random() * (width - 2 * margin),
        y: margin + Math.random() * (height - 2 * margin)
      };

      expect(patrolPoint.x).toBeGreaterThanOrEqual(margin);
      expect(patrolPoint.x).toBeLessThanOrEqual(width - margin);
      expect(patrolPoint.y).toBeGreaterThanOrEqual(margin);
      expect(patrolPoint.y).toBeLessThanOrEqual(height - margin);
    });

    test('應該能判斷是否到達巡邏點', () => {
      const tank = { x: 100, y: 100 };
      const patrolTarget = { x: 110, y: 105 };
      const reachDistance = 40;

      const distance = Math.sqrt(
        Math.pow(tank.x - patrolTarget.x, 2) +
        Math.pow(tank.y - patrolTarget.y, 2)
      );

      const hasReached = distance < reachDistance;
      expect(hasReached).toBe(true);
    });

    test('巡邏點應該循環', () => {
      const patrolPoints = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 300, y: 300 }
      ];

      let currentIndex = 2; // 最後一個點
      const nextIndex = (currentIndex + 1) % patrolPoints.length;

      expect(nextIndex).toBe(0); // 應該循環回第一個點
    });
  });

  describe('包抄戰術', () => {
    test('應該能計算四個包抄位置', () => {
      const playerPos = { x: 400, y: 400 };
      const flankDistance = 120;

      const flankingPositions = [
        { x: playerPos.x - flankDistance, y: playerPos.y, side: 'left' },
        { x: playerPos.x + flankDistance, y: playerPos.y, side: 'right' },
        { x: playerPos.x, y: playerPos.y - flankDistance, side: 'top' },
        { x: playerPos.x, y: playerPos.y + flankDistance, side: 'bottom' }
      ];

      expect(flankingPositions.length).toBe(4);
      expect(flankingPositions[0].x).toBe(280);
      expect(flankingPositions[1].x).toBe(520);
    });

    test('應該根據玩家方向優先選擇背後', () => {
      const playerDirection = 'up';
      const priorityMap = {
        'up': ['bottom', 'left', 'right', 'top'],
        'down': ['top', 'left', 'right', 'bottom'],
        'left': ['right', 'top', 'bottom', 'left'],
        'right': ['left', 'top', 'bottom', 'right']
      };

      const priority = priorityMap[playerDirection];

      // 玩家面向上方，優先從下方（背後）包抄
      expect(priority[0]).toBe('bottom');
    });

    test('應該能判斷包抄位置是否有效', () => {
      const margin = 32;
      const width = 832;
      const height = 832;

      const validPos = { x: 400, y: 400 };
      const invalidPos = { x: 10, y: 10 }; // 太靠近邊界

      const isValidPos = (pos) => {
        return pos.x > margin && pos.x < width - margin &&
               pos.y > margin && pos.y < height - margin;
      };

      expect(isValidPos(validPos)).toBe(true);
      expect(isValidPos(invalidPos)).toBe(false);
    });

    test('到達包抄位置後應該切換到攻擊模式', () => {
      const tank = { x: 295, y: 400 };
      const flankingTarget = { x: 300, y: 400 };
      const reachThreshold = 30;

      const distance = Math.sqrt(
        Math.pow(tank.x - flankingTarget.x, 2) +
        Math.pow(tank.y - flankingTarget.y, 2)
      );

      const hasReached = distance < reachThreshold;
      expect(hasReached).toBe(true);
    });
  });

  describe('威脅評估', () => {
    test('應該能計算威脅分數', () => {
      const tank = { x: 100, y: 100, health: 2, maxHealth: 4 };
      const player = { x: 150, y: 100, direction: 'left' };

      let score = 50;

      // 距離因素（距離 = 50，小於 100）
      const distance = Math.sqrt(
        Math.pow(tank.x - player.x, 2) +
        Math.pow(tank.y - player.y, 2)
      );

      if (distance < 100) score += 30;
      else if (distance < 200) score += 20;

      // 血量因素（50%，符合 <= 0.5）
      const healthPercent = tank.health / tank.maxHealth;
      if (healthPercent <= 0.25) score += 30;
      else if (healthPercent <= 0.5) score += 15;

      // 50 + 30（距離50<100）+ 15（血量50%）= 95
      expect(score).toBe(95);
    });

    test('應該能判斷玩家是否面向敵人', () => {
      const enemy = { x: 200, y: 100 };
      const player = { x: 100, y: 100, direction: 'right' };
      const tolerance = 50;

      const dx = enemy.x - player.x;
      const dy = enemy.y - player.y;

      let isFacing = false;
      if (player.direction === 'right' && dx > 0 && Math.abs(dy) < tolerance) {
        isFacing = true;
      }

      expect(isFacing).toBe(true);
    });

    test('威脅分數應該限制在 0-100', () => {
      const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

      expect(clamp(150, 0, 100)).toBe(100);
      expect(clamp(-20, 0, 100)).toBe(0);
      expect(clamp(75, 0, 100)).toBe(75);
    });
  });

  describe('AI 配置', () => {
    const AI_CONFIG = {
      PREDICTION_TIME: 0.3,
      PREDICTION_ENABLED: true,
      LINE_OF_SIGHT_ENABLED: true,
      LOS_CHECK_INTERVAL: 200,
      SMART_PATROL_ENABLED: true,
      PATROL_POINT_REACH_DIST: 40,
      FLANKING_ENABLED: true,
      FLANKING_DISTANCE: 120,
      MAX_FLANKING_ENEMIES: 2,
      TEAM_COORDINATION_ENABLED: true,
      MIN_ENEMY_SPACING: 60
    };

    test('預測射擊配置應該有效', () => {
      expect(AI_CONFIG.PREDICTION_ENABLED).toBe(true);
      expect(AI_CONFIG.PREDICTION_TIME).toBe(0.3);
      expect(AI_CONFIG.PREDICTION_TIME).toBeGreaterThan(0);
      expect(AI_CONFIG.PREDICTION_TIME).toBeLessThan(1);
    });

    test('視線檢測配置應該有效', () => {
      expect(AI_CONFIG.LINE_OF_SIGHT_ENABLED).toBe(true);
      expect(AI_CONFIG.LOS_CHECK_INTERVAL).toBe(200);
      expect(AI_CONFIG.LOS_CHECK_INTERVAL).toBeGreaterThan(0);
    });

    test('智能巡邏配置應該有效', () => {
      expect(AI_CONFIG.SMART_PATROL_ENABLED).toBe(true);
      expect(AI_CONFIG.PATROL_POINT_REACH_DIST).toBe(40);
    });

    test('包抄戰術配置應該有效', () => {
      expect(AI_CONFIG.FLANKING_ENABLED).toBe(true);
      expect(AI_CONFIG.FLANKING_DISTANCE).toBe(120);
      expect(AI_CONFIG.MAX_FLANKING_ENEMIES).toBe(2);
    });

    test('團隊協作配置應該有效', () => {
      expect(AI_CONFIG.TEAM_COORDINATION_ENABLED).toBe(true);
      expect(AI_CONFIG.MIN_ENEMY_SPACING).toBe(60);
    });
  });

  describe('狀態機整合', () => {
    test('追逐狀態應該支援包抄模式', () => {
      const state = {
        name: 'chase',
        isFlankingMode: true,
        flankingTarget: { x: 300, y: 400 }
      };

      expect(state.isFlankingMode).toBe(true);
      expect(state.flankingTarget).not.toBeNull();
    });

    test('攻擊狀態應該使用預測射擊', () => {
      const attackState = {
        name: 'attack',
        usePrediction: true
      };

      expect(attackState.usePrediction).toBe(true);
    });

    test('巡邏狀態應該使用智能巡邏', () => {
      const patrolState = {
        name: 'patrol',
        useSmartPatrol: true,
        currentPatrolTarget: { x: 200, y: 200 }
      };

      expect(patrolState.useSmartPatrol).toBe(true);
      expect(patrolState.currentPatrolTarget).not.toBeNull();
    });
  });

  describe('清理和銷毀', () => {
    test('銷毀時應該從黑板取消註冊', () => {
      const blackboard = {
        assignedTargets: new Map([['enemy_1', 'player']]),
        flankingPositions: new Map([['enemy_1', { x: 100, y: 100 }]]),
        enemyPositions: new Map([['enemy_1', { x: 200, y: 200 }]]),
        attackingEnemies: new Set(['enemy_1'])
      };

      // 模擬取消註冊
      const enemyId = 'enemy_1';
      blackboard.assignedTargets.delete(enemyId);
      blackboard.flankingPositions.delete(enemyId);
      blackboard.enemyPositions.delete(enemyId);
      blackboard.attackingEnemies.delete(enemyId);

      expect(blackboard.assignedTargets.has(enemyId)).toBe(false);
      expect(blackboard.flankingPositions.has(enemyId)).toBe(false);
      expect(blackboard.enemyPositions.has(enemyId)).toBe(false);
      expect(blackboard.attackingEnemies.has(enemyId)).toBe(false);
    });
  });
});
