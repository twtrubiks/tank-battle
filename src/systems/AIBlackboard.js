/**
 * AI 黑板系統 (Blackboard)
 * 實現敵人之間的資訊共享和團隊協作
 *
 * 參考資料：
 * - AI Blackboard Architecture for Tactical Game AI
 * - Squad Coordination in Days Gone
 */

import Phaser from 'phaser';
import { GAME_CONFIG, TILE_TYPES } from '../utils/Constants';

export default class AIBlackboard {
  /**
   * 建構子
   * @param {Phaser.Scene} scene - 遊戲場景
   */
  constructor(scene) {
    this.scene = scene;

    // === 玩家資訊 ===
    this.playerLastKnownPosition = null;  // 玩家最後已知位置
    this.playerLastSeenTime = 0;          // 最後看到玩家的時間
    this.playerVelocity = { x: 0, y: 0 }; // 玩家速度向量
    this.playerDirection = 'down';        // 玩家面向方向

    // === 目標分配 ===
    this.assignedTargets = new Map();     // 敵人ID -> 目標類型 ('player' | 'base')
    this.targetAssignmentCooldown = 3000; // 目標分配冷卻時間

    // === 包抄位置管理 ===
    this.flankingPositions = new Map();   // 敵人ID -> 包抄位置
    this.occupiedPositions = [];          // 已被佔據的位置

    // === 威脅評估 ===
    this.threatLevel = 0;                 // 整體威脅等級 (0-100)
    this.dangerZones = [];                // 危險區域列表

    // === 團隊狀態 ===
    this.activeEnemyCount = 0;            // 活躍敵人數量
    this.enemyPositions = new Map();      // 敵人ID -> 位置
    this.attackingEnemies = new Set();    // 正在攻擊的敵人集合

    // === 巡邏點系統 ===
    this.patrolPoints = [];               // 全局巡邏點列表
    this.assignedPatrolPoints = new Map(); // 敵人ID -> 巡邏點索引

    // === 配置 ===
    this.config = {
      positionUpdateInterval: 100,        // 位置更新間隔 (ms)
      flankingDistance: 120,              // 包抄距離
      minDistanceBetweenEnemies: 60,      // 敵人之間最小距離
      playerInfoExpireTime: 5000,         // 玩家資訊過期時間 (ms)
      maxFlankingEnemies: 2               // 最大同時包抄敵人數
    };

    // 初始化巡邏點
    this._initializePatrolPoints();
  }

  // ==========================================
  // 玩家資訊管理
  // ==========================================

  /**
   * 更新玩家位置資訊
   * @param {Object} player - 玩家坦克
   */
  updatePlayerInfo(player) {
    if (!player || player.isDestroyed) return;

    const currentTime = this.scene.time.now;

    // 更新位置
    this.playerLastKnownPosition = { x: player.x, y: player.y };
    this.playerLastSeenTime = currentTime;

    // 更新速度
    if (player.body) {
      this.playerVelocity = {
        x: player.body.velocity.x,
        y: player.body.velocity.y
      };
    }

    // 更新方向
    this.playerDirection = player.direction || 'down';
  }

  /**
   * 預測玩家位置
   * @param {number} predictionTime - 預測時間 (秒)
   * @returns {Object|null} 預測位置 { x, y }
   */
  predictPlayerPosition(predictionTime = 0.3) {
    if (!this.playerLastKnownPosition) return null;

    const currentTime = this.scene.time.now;
    const timeSinceLastSeen = (currentTime - this.playerLastSeenTime) / 1000;

    // 如果資訊太舊，不進行預測
    if (timeSinceLastSeen > this.config.playerInfoExpireTime / 1000) {
      return this.playerLastKnownPosition;
    }

    // 基於速度預測未來位置
    return {
      x: this.playerLastKnownPosition.x + this.playerVelocity.x * predictionTime,
      y: this.playerLastKnownPosition.y + this.playerVelocity.y * predictionTime
    };
  }

  /**
   * 檢查玩家資訊是否有效
   * @returns {boolean}
   */
  isPlayerInfoValid() {
    if (!this.playerLastKnownPosition) return false;

    const currentTime = this.scene.time.now;
    return (currentTime - this.playerLastSeenTime) < this.config.playerInfoExpireTime;
  }

  // ==========================================
  // 目標分配
  // ==========================================

  /**
   * 為敵人分配目標，確保均衡分配
   * @param {string} enemyId - 敵人 ID
   * @param {string} preferredTarget - 偏好目標 ('player' | 'base')
   * @returns {string} 分配的目標
   */
  assignTarget(enemyId, preferredTarget = 'player') {
    // 計算當前目標分配情況
    let playerTargetCount = 0;
    let baseTargetCount = 0;

    this.assignedTargets.forEach((target) => {
      if (target === 'player') playerTargetCount++;
      else if (target === 'base') baseTargetCount++;
    });

    // 如果攻擊玩家的敵人太多，分配一些去攻擊基地
    let assignedTarget = preferredTarget;
    if (playerTargetCount >= 2 && baseTargetCount === 0) {
      assignedTarget = 'base';
    }

    this.assignedTargets.set(enemyId, assignedTarget);
    return assignedTarget;
  }

  /**
   * 移除敵人的目標分配
   * @param {string} enemyId - 敵人 ID
   */
  removeTargetAssignment(enemyId) {
    this.assignedTargets.delete(enemyId);
    this.flankingPositions.delete(enemyId);
    this.assignedPatrolPoints.delete(enemyId);
    this.enemyPositions.delete(enemyId);
    this.attackingEnemies.delete(enemyId);
  }

  // ==========================================
  // 包抄戰術
  // ==========================================

  /**
   * 計算包抄位置
   * @param {string} enemyId - 敵人 ID
   * @param {Object} enemyPos - 敵人當前位置
   * @returns {Object|null} 包抄位置 { x, y }
   */
  calculateFlankingPosition(enemyId, enemyPos) {
    if (!this.playerLastKnownPosition) return null;

    const playerPos = this.playerLastKnownPosition;
    const flankDist = this.config.flankingDistance;

    // 計算可能的包抄位置（玩家的四個方向）
    const potentialPositions = [
      { x: playerPos.x - flankDist, y: playerPos.y, side: 'left' },
      { x: playerPos.x + flankDist, y: playerPos.y, side: 'right' },
      { x: playerPos.x, y: playerPos.y - flankDist, side: 'top' },
      { x: playerPos.x, y: playerPos.y + flankDist, side: 'bottom' }
    ];

    // 根據玩家面向方向，優先選擇側翼或背後
    const prioritizedPositions = this._prioritizeFlankingPositions(
      potentialPositions,
      this.playerDirection
    );

    // 選擇最佳的未被佔據的位置
    for (const pos of prioritizedPositions) {
      if (!this._isPositionOccupied(pos, enemyId)) {
        // 檢查位置是否在地圖範圍內且可安全行走
        if (this._isPositionValid(pos) && this._isPositionSafelyWalkable(pos)) {
          this.flankingPositions.set(enemyId, pos);
          return pos;
        }
      }
    }

    // 如果所有包抄位置都不可用，嘗試尋找附近的可行走位置
    for (const pos of prioritizedPositions) {
      const nearbyPos = this._findNearbyWalkablePosition(pos);
      if (nearbyPos && !this._isPositionOccupied(nearbyPos, enemyId)) {
        this.flankingPositions.set(enemyId, nearbyPos);
        return nearbyPos;
      }
    }

    // 如果還是找不到，返回 null
    return null;
  }

  /**
   * 根據玩家方向優先排序包抄位置
   * @private
   */
  _prioritizeFlankingPositions(positions, playerDirection) {
    // 優先選擇玩家背後和側翼
    const priorityMap = {
      'up': ['bottom', 'left', 'right', 'top'],
      'down': ['top', 'left', 'right', 'bottom'],
      'left': ['right', 'top', 'bottom', 'left'],
      'right': ['left', 'top', 'bottom', 'right']
    };

    const priority = priorityMap[playerDirection] || ['left', 'right', 'top', 'bottom'];

    return positions.sort((a, b) => {
      return priority.indexOf(a.side) - priority.indexOf(b.side);
    });
  }

  /**
   * 檢查位置是否已被佔據
   * @private
   */
  _isPositionOccupied(pos, excludeEnemyId) {
    const minDist = this.config.minDistanceBetweenEnemies;

    for (const [enemyId, flankPos] of this.flankingPositions) {
      if (enemyId === excludeEnemyId) continue;

      const dist = Phaser.Math.Distance.Between(pos.x, pos.y, flankPos.x, flankPos.y);
      if (dist < minDist) return true;
    }

    return false;
  }

  /**
   * 檢查位置是否有效（在地圖範圍內且可行走）
   * @private
   */
  _isPositionValid(pos) {
    const margin = 32;
    const width = this.scene.game.config.width || 832;
    const height = this.scene.game.config.height || 832;

    // 首先檢查邊界
    if (pos.x <= margin || pos.x >= width - margin ||
        pos.y <= margin || pos.y >= height - margin) {
      return false;
    }

    // 然後檢查是否可行走
    return this._isPositionWalkable(pos);
  }

  /**
   * 檢查位置是否可行走（不是牆壁、鋼牆或水）
   * @param {Object} pos - 位置 { x, y }
   * @returns {boolean} 是否可行走
   * @private
   */
  _isPositionWalkable(pos) {
    if (!this.scene.levelData || !this.scene.levelData.map) {
      return true; // 無地圖資料時假設可行走
    }

    const map = this.scene.levelData.map;
    const tileSize = GAME_CONFIG.TILE_SIZE;

    // 轉換為格子坐標
    const gridX = Math.floor(pos.x / tileSize);
    const gridY = Math.floor(pos.y / tileSize);

    // 檢查邊界
    if (gridY < 0 || gridY >= map.length || gridX < 0 || gridX >= map[0].length) {
      return false;
    }

    const tile = map[gridY][gridX];

    // 不可行走的地形：磚牆、鋼牆、水
    const unwalkable = [TILE_TYPES.BRICK, TILE_TYPES.STEEL, TILE_TYPES.WATER];
    return !unwalkable.includes(tile);
  }

  /**
   * 檢查位置及其周圍是否都可行走（用於確保坦克可以通過）
   * @param {Object} pos - 位置 { x, y }
   * @returns {boolean} 是否安全可行走
   * @private
   */
  _isPositionSafelyWalkable(pos) {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const halfTile = tileSize / 2;

    // 檢查中心點和四個角落
    const checkPoints = [
      pos,
      { x: pos.x - halfTile, y: pos.y - halfTile },
      { x: pos.x + halfTile, y: pos.y - halfTile },
      { x: pos.x - halfTile, y: pos.y + halfTile },
      { x: pos.x + halfTile, y: pos.y + halfTile }
    ];

    return checkPoints.every(p => this._isPositionWalkable(p));
  }

  /**
   * 尋找指定位置附近的可行走位置
   * @param {Object} pos - 原始位置 { x, y }
   * @param {number} searchRadius - 搜索半徑（預設 80）
   * @returns {Object|null} 可行走位置或 null
   * @private
   */
  _findNearbyWalkablePosition(pos, searchRadius = 80) {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const step = tileSize / 2;

    // 螺旋搜索附近的位置
    for (let radius = step; radius <= searchRadius; radius += step) {
      const candidates = [
        { x: pos.x + radius, y: pos.y },
        { x: pos.x - radius, y: pos.y },
        { x: pos.x, y: pos.y + radius },
        { x: pos.x, y: pos.y - radius },
        { x: pos.x + radius, y: pos.y + radius },
        { x: pos.x - radius, y: pos.y + radius },
        { x: pos.x + radius, y: pos.y - radius },
        { x: pos.x - radius, y: pos.y - radius }
      ];

      for (const candidate of candidates) {
        if (this._isPositionValid(candidate) && this._isPositionSafelyWalkable(candidate)) {
          return { ...candidate, side: pos.side };
        }
      }
    }

    return null;
  }

  /**
   * 獲取目前進行包抄的敵人數量
   * @returns {number}
   */
  getFlankingEnemyCount() {
    return this.flankingPositions.size;
  }

  /**
   * 檢查是否可以加入包抄
   * @returns {boolean}
   */
  canJoinFlanking() {
    return this.flankingPositions.size < this.config.maxFlankingEnemies;
  }

  // ==========================================
  // 團隊協調
  // ==========================================

  /**
   * 更新敵人位置
   * @param {string} enemyId - 敵人 ID
   * @param {Object} position - 位置 { x, y }
   */
  updateEnemyPosition(enemyId, position) {
    this.enemyPositions.set(enemyId, { ...position, time: this.scene.time.now });
  }

  /**
   * 獲取附近的敵人
   * @param {Object} position - 參考位置
   * @param {number} radius - 搜索半徑
   * @param {string} excludeId - 排除的敵人 ID
   * @returns {Array} 附近敵人列表
   */
  getNearbyEnemies(position, radius, excludeId = null) {
    const nearby = [];

    this.enemyPositions.forEach((pos, enemyId) => {
      if (enemyId === excludeId) return;

      const dist = Phaser.Math.Distance.Between(position.x, position.y, pos.x, pos.y);
      if (dist < radius) {
        nearby.push({ enemyId, position: pos, distance: dist });
      }
    });

    return nearby.sort((a, b) => a.distance - b.distance);
  }

  /**
   * 檢查是否有其他敵人正在攻擊目標
   * @param {string} target - 目標類型
   * @param {string} excludeId - 排除的敵人 ID
   * @returns {number} 正在攻擊該目標的敵人數量
   */
  getAttackersCount(target, excludeId = null) {
    let count = 0;

    this.assignedTargets.forEach((assignedTarget, enemyId) => {
      if (enemyId !== excludeId && assignedTarget === target) {
        if (this.attackingEnemies.has(enemyId)) {
          count++;
        }
      }
    });

    return count;
  }

  /**
   * 標記敵人開始攻擊
   * @param {string} enemyId - 敵人 ID
   */
  markAsAttacking(enemyId) {
    this.attackingEnemies.add(enemyId);
  }

  /**
   * 標記敵人停止攻擊
   * @param {string} enemyId - 敵人 ID
   */
  markAsNotAttacking(enemyId) {
    this.attackingEnemies.delete(enemyId);
  }

  // ==========================================
  // 智能巡邏點系統
  // ==========================================

  /**
   * 初始化巡邏點
   * @private
   */
  _initializePatrolPoints() {
    // 預設巡邏點 - 覆蓋地圖的關鍵區域
    const width = 832;
    const height = 832;
    const margin = 80;

    // 候選巡邏點
    const candidatePoints = [
      // 四個角落
      { x: margin, y: margin },
      { x: width - margin, y: margin },
      { x: margin, y: height - margin },
      { x: width - margin, y: height - margin },
      // 邊緣中點
      { x: width / 2, y: margin },
      { x: width / 2, y: height - margin },
      { x: margin, y: height / 2 },
      { x: width - margin, y: height / 2 },
      // 中央區域
      { x: width / 2, y: height / 2 },
      { x: width / 3, y: height / 3 },
      { x: width * 2 / 3, y: height / 3 },
      { x: width / 3, y: height * 2 / 3 },
      { x: width * 2 / 3, y: height * 2 / 3 }
    ];

    // 初始時先使用候選點，等地圖載入後會過濾
    this.patrolPoints = candidatePoints;
    this._patrolPointsNeedValidation = true;
  }

  /**
   * 驗證並過濾巡邏點（在地圖載入後調用）
   * @private
   */
  _validatePatrolPoints() {
    if (!this._patrolPointsNeedValidation) return;
    if (!this.scene.levelData || !this.scene.levelData.map) return;

    // 過濾掉不可行走的點
    const validPoints = this.patrolPoints.filter(point =>
      this._isPositionSafelyWalkable(point)
    );

    // 如果過濾後點太少，動態生成新的巡邏點
    if (validPoints.length < 5) {
      const additionalPoints = this._generateWalkablePatrolPoints(10 - validPoints.length);
      this.patrolPoints = [...validPoints, ...additionalPoints];
    } else {
      this.patrolPoints = validPoints;
    }

    this._patrolPointsNeedValidation = false;
  }

  /**
   * 動態生成可行走的巡邏點
   * @param {number} count - 需要生成的數量
   * @returns {Array} 巡邏點列表
   * @private
   */
  _generateWalkablePatrolPoints(count) {
    const points = [];
    const margin = 80;
    const width = this.scene.game.config.width || 832;
    const height = this.scene.game.config.height || 832;
    const maxAttempts = count * 20; // 最多嘗試次數
    let attempts = 0;

    while (points.length < count && attempts < maxAttempts) {
      attempts++;
      const candidate = {
        x: margin + Math.random() * (width - 2 * margin),
        y: margin + Math.random() * (height - 2 * margin)
      };

      // 檢查是否可行走且與現有點保持距離
      if (this._isPositionSafelyWalkable(candidate)) {
        const minDistFromExisting = 100;
        const tooClose = [...this.patrolPoints, ...points].some(p => {
          const dist = Phaser.Math.Distance.Between(candidate.x, candidate.y, p.x, p.y);
          return dist < minDistFromExisting;
        });

        if (!tooClose) {
          points.push(candidate);
        }
      }
    }

    return points;
  }

  /**
   * 為敵人分配巡邏點
   * @param {string} enemyId - 敵人 ID
   * @param {Object} currentPos - 當前位置
   * @returns {Object|null} 巡邏點位置
   */
  assignPatrolPoint(enemyId, currentPos) {
    // 找出未被分配的巡邏點
    const assignedIndices = new Set(this.assignedPatrolPoints.values());

    let bestPoint = null;
    let bestScore = -Infinity;
    let bestIndex = -1;

    this.patrolPoints.forEach((point, index) => {
      if (assignedIndices.has(index)) return;

      // 計算分數：距離適中的點得分更高
      const dist = Phaser.Math.Distance.Between(currentPos.x, currentPos.y, point.x, point.y);

      // 理想距離是 150-300，太近或太遠都扣分
      let score = 100;
      if (dist < 100) score -= (100 - dist);
      else if (dist > 400) score -= (dist - 400) / 5;

      // 隨機因素增加多樣性
      score += Math.random() * 30;

      if (score > bestScore) {
        bestScore = score;
        bestPoint = point;
        bestIndex = index;
      }
    });

    if (bestPoint && bestIndex >= 0) {
      this.assignedPatrolPoints.set(enemyId, bestIndex);
      return bestPoint;
    }

    // 如果所有點都被分配，隨機選擇一個
    const randomIndex = Math.floor(Math.random() * this.patrolPoints.length);
    this.assignedPatrolPoints.set(enemyId, randomIndex);
    return this.patrolPoints[randomIndex];
  }

  /**
   * 獲取下一個巡邏點
   * @param {string} enemyId - 敵人 ID
   * @returns {Object|null} 下一個巡邏點
   */
  getNextPatrolPoint(enemyId) {
    const currentIndex = this.assignedPatrolPoints.get(enemyId);

    if (currentIndex === undefined) {
      return null;
    }

    // 移動到下一個巡邏點（循環）
    const nextIndex = (currentIndex + 1) % this.patrolPoints.length;
    this.assignedPatrolPoints.set(enemyId, nextIndex);

    return this.patrolPoints[nextIndex];
  }

  // ==========================================
  // 威脅評估
  // ==========================================

  /**
   * 計算整體威脅等級
   * @param {Object} player - 玩家坦克
   */
  calculateThreatLevel(player) {
    if (!player || player.isDestroyed) {
      this.threatLevel = 0;
      return;
    }

    let threat = 50; // 基礎威脅值

    // 玩家星星等級越高，威脅越大
    if (player.starLevel) {
      threat += player.starLevel * 10;
    }

    // 玩家血量越高，威脅越大
    if (player.lives) {
      threat += player.lives * 5;
    }

    // 活躍敵人越少，威脅越大
    const activeEnemies = this.enemyPositions.size;
    if (activeEnemies < 2) {
      threat += 20;
    }

    this.threatLevel = Math.min(100, Math.max(0, threat));
  }

  /**
   * 獲取威脅等級
   * @returns {number} 威脅等級 (0-100)
   */
  getThreatLevel() {
    return this.threatLevel;
  }

  // ==========================================
  // 清理
  // ==========================================

  /**
   * 清理所有數據
   */
  clear() {
    this.playerLastKnownPosition = null;
    this.playerLastSeenTime = 0;
    this.playerVelocity = { x: 0, y: 0 };
    this.assignedTargets.clear();
    this.flankingPositions.clear();
    this.occupiedPositions = [];
    this.enemyPositions.clear();
    this.attackingEnemies.clear();
    this.assignedPatrolPoints.clear();
    this.threatLevel = 0;
  }

  /**
   * 更新黑板（每幀調用）
   */
  update() {
    // 驗證巡邏點（只在地圖載入後執行一次）
    if (this._patrolPointsNeedValidation) {
      this._validatePatrolPoints();
    }

    // 更新活躍敵人數量
    this.activeEnemyCount = this.enemyPositions.size;

    // 如果場景有玩家，更新玩家資訊
    if (this.scene.player && !this.scene.player.isDestroyed) {
      this.updatePlayerInfo(this.scene.player);
      this.calculateThreatLevel(this.scene.player);
    }
  }
}
