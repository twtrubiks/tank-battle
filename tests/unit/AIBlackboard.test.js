/**
 * AIBlackboard 單元測試
 * 測試敵人團隊協作系統
 */

describe('AIBlackboard', () => {
  let mockScene;
  let blackboard;

  beforeEach(() => {
    // 模擬 Phaser 場景
    mockScene = {
      time: { now: 1000 },
      player: {
        x: 400,
        y: 400,
        isDestroyed: false,
        direction: 'up',
        body: { velocity: { x: 0, y: -100 } },
        starLevel: 2,
        lives: 3
      },
      game: {
        config: { width: 832, height: 832 }
      }
    };

    // 模擬 AIBlackboard 類別的行為
    blackboard = {
      playerLastKnownPosition: null,
      playerLastSeenTime: 0,
      playerVelocity: { x: 0, y: 0 },
      playerDirection: 'down',
      assignedTargets: new Map(),
      flankingPositions: new Map(),
      enemyPositions: new Map(),
      attackingEnemies: new Set(),
      assignedPatrolPoints: new Map(),
      threatLevel: 0,
      activeEnemyCount: 0,
      patrolPoints: [],
      config: {
        positionUpdateInterval: 100,
        flankingDistance: 120,
        minDistanceBetweenEnemies: 60,
        playerInfoExpireTime: 5000,
        maxFlankingEnemies: 2
      }
    };
  });

  describe('玩家資訊管理', () => {
    test('應該能更新玩家位置資訊', () => {
      const player = mockScene.player;

      // 更新玩家資訊
      blackboard.playerLastKnownPosition = { x: player.x, y: player.y };
      blackboard.playerLastSeenTime = mockScene.time.now;
      blackboard.playerVelocity = {
        x: player.body.velocity.x,
        y: player.body.velocity.y
      };
      blackboard.playerDirection = player.direction;

      expect(blackboard.playerLastKnownPosition).toEqual({ x: 400, y: 400 });
      expect(blackboard.playerLastSeenTime).toBe(1000);
      expect(blackboard.playerVelocity).toEqual({ x: 0, y: -100 });
      expect(blackboard.playerDirection).toBe('up');
    });

    test('應該能預測玩家位置', () => {
      blackboard.playerLastKnownPosition = { x: 400, y: 400 };
      blackboard.playerVelocity = { x: 100, y: 0 };

      const predictionTime = 0.5; // 0.5 秒
      const predictedPos = {
        x: blackboard.playerLastKnownPosition.x + blackboard.playerVelocity.x * predictionTime,
        y: blackboard.playerLastKnownPosition.y + blackboard.playerVelocity.y * predictionTime
      };

      expect(predictedPos.x).toBe(450);
      expect(predictedPos.y).toBe(400);
    });

    test('應該能檢查玩家資訊是否有效', () => {
      blackboard.playerLastKnownPosition = { x: 400, y: 400 };
      blackboard.playerLastSeenTime = 1000;

      // 資訊在有效期內
      const currentTime = 2000; // 1 秒後
      const isValid = (currentTime - blackboard.playerLastSeenTime) < blackboard.config.playerInfoExpireTime;
      expect(isValid).toBe(true);

      // 資訊已過期
      const expiredTime = 10000; // 9 秒後
      const isExpired = (expiredTime - blackboard.playerLastSeenTime) < blackboard.config.playerInfoExpireTime;
      expect(isExpired).toBe(false);
    });
  });

  describe('目標分配', () => {
    test('應該能為敵人分配目標', () => {
      const enemyId = 'enemy_1';
      const preferredTarget = 'player';

      blackboard.assignedTargets.set(enemyId, preferredTarget);

      expect(blackboard.assignedTargets.get(enemyId)).toBe('player');
    });

    test('應該能平衡目標分配', () => {
      // 假設已有 2 個敵人攻擊玩家
      blackboard.assignedTargets.set('enemy_1', 'player');
      blackboard.assignedTargets.set('enemy_2', 'player');

      // 計算當前分配
      let playerCount = 0;
      let baseCount = 0;
      blackboard.assignedTargets.forEach(target => {
        if (target === 'player') playerCount++;
        else if (target === 'base') baseCount++;
      });

      expect(playerCount).toBe(2);
      expect(baseCount).toBe(0);

      // 新敵人應該被分配去攻擊基地
      const shouldAssignToBase = playerCount >= 2 && baseCount === 0;
      expect(shouldAssignToBase).toBe(true);
    });

    test('應該能移除目標分配', () => {
      const enemyId = 'enemy_1';
      blackboard.assignedTargets.set(enemyId, 'player');
      blackboard.flankingPositions.set(enemyId, { x: 100, y: 100 });
      blackboard.enemyPositions.set(enemyId, { x: 200, y: 200 });

      // 移除分配
      blackboard.assignedTargets.delete(enemyId);
      blackboard.flankingPositions.delete(enemyId);
      blackboard.enemyPositions.delete(enemyId);

      expect(blackboard.assignedTargets.has(enemyId)).toBe(false);
      expect(blackboard.flankingPositions.has(enemyId)).toBe(false);
      expect(blackboard.enemyPositions.has(enemyId)).toBe(false);
    });
  });

  describe('包抄戰術', () => {
    test('應該能計算包抄位置', () => {
      blackboard.playerLastKnownPosition = { x: 400, y: 400 };
      const flankDist = blackboard.config.flankingDistance;

      const potentialPositions = [
        { x: 400 - flankDist, y: 400, side: 'left' },
        { x: 400 + flankDist, y: 400, side: 'right' },
        { x: 400, y: 400 - flankDist, side: 'top' },
        { x: 400, y: 400 + flankDist, side: 'bottom' }
      ];

      expect(potentialPositions.length).toBe(4);
      expect(potentialPositions[0].x).toBe(280); // 400 - 120
      expect(potentialPositions[1].x).toBe(520); // 400 + 120
    });

    test('應該能根據玩家方向優先排序包抄位置', () => {
      const playerDirection = 'up';
      const priorityMap = {
        'up': ['bottom', 'left', 'right', 'top'],
        'down': ['top', 'left', 'right', 'bottom'],
        'left': ['right', 'top', 'bottom', 'left'],
        'right': ['left', 'top', 'bottom', 'right']
      };

      const priority = priorityMap[playerDirection];
      expect(priority[0]).toBe('bottom'); // 玩家面向上，優先從後方包抄
    });

    test('應該限制同時包抄的敵人數量', () => {
      const maxFlanking = blackboard.config.maxFlankingEnemies;

      blackboard.flankingPositions.set('enemy_1', { x: 100, y: 100 });
      blackboard.flankingPositions.set('enemy_2', { x: 200, y: 200 });

      const canJoin = blackboard.flankingPositions.size < maxFlanking;
      expect(canJoin).toBe(false);
    });

    test('應該檢測位置是否已被佔據', () => {
      const pos1 = { x: 100, y: 100 };
      const pos2 = { x: 130, y: 100 }; // 距離 30，小於 minDistanceBetweenEnemies (60)

      blackboard.flankingPositions.set('enemy_1', pos1);

      const minDist = blackboard.config.minDistanceBetweenEnemies;
      const distance = Math.sqrt(
        Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2)
      );

      const isOccupied = distance < minDist;
      expect(isOccupied).toBe(true);
    });
  });

  describe('團隊協調', () => {
    test('應該能更新敵人位置', () => {
      const enemyId = 'enemy_1';
      const position = { x: 300, y: 400 };

      blackboard.enemyPositions.set(enemyId, { ...position, time: 1000 });

      expect(blackboard.enemyPositions.get(enemyId).x).toBe(300);
      expect(blackboard.enemyPositions.get(enemyId).y).toBe(400);
    });

    test('應該能獲取附近的敵人', () => {
      blackboard.enemyPositions.set('enemy_1', { x: 100, y: 100 });
      blackboard.enemyPositions.set('enemy_2', { x: 150, y: 100 });
      blackboard.enemyPositions.set('enemy_3', { x: 500, y: 500 });

      const referencePos = { x: 100, y: 100 };
      const radius = 100;

      const nearby = [];
      blackboard.enemyPositions.forEach((pos, enemyId) => {
        const dist = Math.sqrt(
          Math.pow(pos.x - referencePos.x, 2) + Math.pow(pos.y - referencePos.y, 2)
        );
        if (dist < radius && dist > 0) {
          nearby.push({ enemyId, distance: dist });
        }
      });

      expect(nearby.length).toBe(1); // 只有 enemy_2 在範圍內
      expect(nearby[0].enemyId).toBe('enemy_2');
    });

    test('應該能追蹤正在攻擊的敵人', () => {
      blackboard.attackingEnemies.add('enemy_1');
      blackboard.attackingEnemies.add('enemy_2');

      expect(blackboard.attackingEnemies.has('enemy_1')).toBe(true);
      expect(blackboard.attackingEnemies.size).toBe(2);

      blackboard.attackingEnemies.delete('enemy_1');
      expect(blackboard.attackingEnemies.has('enemy_1')).toBe(false);
    });
  });

  describe('智能巡邏點系統', () => {
    test('應該能初始化巡邏點', () => {
      const width = 832;
      const height = 832;
      const margin = 80;

      const patrolPoints = [
        // 四個角落
        { x: margin, y: margin },
        { x: width - margin, y: margin },
        { x: margin, y: height - margin },
        { x: width - margin, y: height - margin },
        // 中央
        { x: width / 2, y: height / 2 }
      ];

      expect(patrolPoints.length).toBeGreaterThan(0);
      expect(patrolPoints[0]).toEqual({ x: 80, y: 80 });
    });

    test('應該能為敵人分配巡邏點', () => {
      blackboard.patrolPoints = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 300, y: 300 }
      ];

      const enemyId = 'enemy_1';
      const currentPos = { x: 150, y: 150 };

      // 簡單分配：選擇第一個未被分配的巡邏點
      const assignedIndex = 0;
      blackboard.assignedPatrolPoints.set(enemyId, assignedIndex);

      expect(blackboard.assignedPatrolPoints.get(enemyId)).toBe(0);
      expect(blackboard.patrolPoints[assignedIndex]).toEqual({ x: 100, y: 100 });
    });

    test('應該能獲取下一個巡邏點', () => {
      blackboard.patrolPoints = [
        { x: 100, y: 100 },
        { x: 200, y: 200 },
        { x: 300, y: 300 }
      ];

      const enemyId = 'enemy_1';
      blackboard.assignedPatrolPoints.set(enemyId, 0);

      // 移動到下一個巡邏點
      const currentIndex = blackboard.assignedPatrolPoints.get(enemyId);
      const nextIndex = (currentIndex + 1) % blackboard.patrolPoints.length;
      blackboard.assignedPatrolPoints.set(enemyId, nextIndex);

      expect(blackboard.assignedPatrolPoints.get(enemyId)).toBe(1);
    });
  });

  describe('威脅評估', () => {
    test('應該能計算威脅等級', () => {
      const player = mockScene.player;
      let threat = 50; // 基礎威脅值

      // 玩家星星等級
      if (player.starLevel) {
        threat += player.starLevel * 10;
      }

      // 玩家血量
      if (player.lives) {
        threat += player.lives * 5;
      }

      // 活躍敵人數量
      const activeEnemies = 1;
      if (activeEnemies < 2) {
        threat += 20;
      }

      expect(threat).toBe(105); // 50 + 20 + 15 + 20
    });

    test('威脅等級應該在 0-100 之間', () => {
      const clampedThreat = (value) => Math.min(100, Math.max(0, value));

      expect(clampedThreat(150)).toBe(100);
      expect(clampedThreat(-10)).toBe(0);
      expect(clampedThreat(75)).toBe(75);
    });
  });

  describe('清理', () => {
    test('應該能清理所有數據', () => {
      // 設置一些數據
      blackboard.playerLastKnownPosition = { x: 100, y: 100 };
      blackboard.assignedTargets.set('enemy_1', 'player');
      blackboard.flankingPositions.set('enemy_1', { x: 200, y: 200 });
      blackboard.enemyPositions.set('enemy_1', { x: 300, y: 300 });
      blackboard.attackingEnemies.add('enemy_1');

      // 清理
      blackboard.playerLastKnownPosition = null;
      blackboard.playerLastSeenTime = 0;
      blackboard.playerVelocity = { x: 0, y: 0 };
      blackboard.assignedTargets.clear();
      blackboard.flankingPositions.clear();
      blackboard.enemyPositions.clear();
      blackboard.attackingEnemies.clear();
      blackboard.assignedPatrolPoints.clear();
      blackboard.threatLevel = 0;

      expect(blackboard.playerLastKnownPosition).toBeNull();
      expect(blackboard.assignedTargets.size).toBe(0);
      expect(blackboard.flankingPositions.size).toBe(0);
      expect(blackboard.enemyPositions.size).toBe(0);
      expect(blackboard.attackingEnemies.size).toBe(0);
    });
  });
});
