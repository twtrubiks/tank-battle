/**
 * 敵人 AI 控制器
 * 使用狀態機實現 4 種行為：巡邏、追逐、攻擊、撤退
 *
 * 進階功能：
 * - 預測射擊：預測玩家移動位置，提前射擊
 * - 視線檢測：判斷是否能直接看到目標
 * - 智能巡邏：有目的地巡邏而非隨機漫步
 * - 包抄戰術：多個敵人協調包抄玩家
 * - 團隊協作：透過 Blackboard 共享資訊
 */

import Phaser from 'phaser';
import StateMachine from '../utils/StateMachine';
import AStar from '../utils/AStar';
import GridMovement from '../utils/GridMovement';
import { AI_CONFIG, GAME_CONFIG, TILE_TYPES, DIRECTION_VECTORS } from '../utils/Constants';

export default class EnemyAI {
  /**
   * 建構子
   * @param {Phaser.Scene} scene - 場景
   * @param {EnemyTank} tank - 敵人坦克
   */
  constructor(scene, tank) {
    this.scene = scene;
    this.tank = tank;

    // 唯一識別碼
    this.id = `enemy_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // 狀態機
    this.stateMachine = new StateMachine();
    this.stateMachine.setContext(this);

    // AI 參數
    this.detectionRange = AI_CONFIG.DETECTION_RANGE;
    this.attackRange = AI_CONFIG.ATTACK_RANGE;
    this.retreatHealthPercent = AI_CONFIG.RETREAT_HEALTH_PERCENT;

    // 時間控制
    this.lastStateChange = 0;
    this.stateChangeCooldown = AI_CONFIG.STATE_CHANGE_COOLDOWN;
    this.lastShot = 0;

    // 移動相關 - 簡化為「目標方向」模式
    this.desiredDirection = 'down'; // 目標方向
    this.lastDirectionChange = 0;
    this.directionChangeCooldown = 500; // 500ms 方向變更冷卻
    this.lastRandomDirectionChange = 0;
    this.randomDirectionInterval = 3000; // 每 3 秒有機會隨機換方向

    this.stuckCounter = 0;
    this.lastPosition = { x: tank.x, y: tank.y };

    // A* 尋路相關
    this.currentPath = null;
    this.pathUpdateInterval = 500; // 每 0.5 秒更新路徑（從 1000ms 降低）
    this.lastPathUpdate = 0;
    this.currentWaypointIndex = 0;
    this.waypointReachDistance = 16; // 到達路徑點的距離閾值

    // 路徑更新優化
    this.pathUpdateIntervalChase = 500; // 追逐狀態更頻繁更新
    this.pathUpdateIntervalPatrol = 1000; // 巡邏狀態較少更新

    // 目標選擇（經典模式）
    this.currentTarget = null; // 'player' 或 'base'
    this.targetPriority = this._determineTargetPriority(tank.type);

    // === 進階 AI 功能 ===

    // 預測射擊
    this.predictionEnabled = AI_CONFIG.PREDICTION_ENABLED;
    this.predictionTime = AI_CONFIG.PREDICTION_TIME;

    // 視線檢測
    this.losEnabled = AI_CONFIG.LINE_OF_SIGHT_ENABLED;
    this.lastLosCheck = 0;
    this.losCheckInterval = AI_CONFIG.LOS_CHECK_INTERVAL;
    this.hasLineOfSight = false;

    // 智能巡邏
    this.smartPatrolEnabled = AI_CONFIG.SMART_PATROL_ENABLED;
    this.currentPatrolTarget = null;
    this.patrolPointReachDist = AI_CONFIG.PATROL_POINT_REACH_DIST;

    // 包抄戰術
    this.flankingEnabled = AI_CONFIG.FLANKING_ENABLED;
    this.isFlankingMode = false;
    this.flankingTarget = null;

    // 團隊協作
    this.teamCoordinationEnabled = AI_CONFIG.TEAM_COORDINATION_ENABLED;

    // 初始化狀態
    this._initializeStates();
    this.stateMachine.setState('patrol');

    // 註冊到黑板
    this._registerToBlackboard();
  }

  // ==========================================
  // 黑板系統整合
  // ==========================================

  /**
   * 註冊到黑板系統
   * @private
   */
  _registerToBlackboard() {
    const blackboard = this._getBlackboard();
    if (blackboard && this.teamCoordinationEnabled) {
      // 分配目標
      const preferredTarget = this.targetPriority.player > 0.5 ? 'player' : 'base';
      blackboard.assignTarget(this.id, preferredTarget);

      // 更新位置
      blackboard.updateEnemyPosition(this.id, { x: this.tank.x, y: this.tank.y });
    }
  }

  /**
   * 從黑板系統取消註冊
   */
  unregisterFromBlackboard() {
    const blackboard = this._getBlackboard();
    if (blackboard) {
      blackboard.removeTargetAssignment(this.id);
    }
  }

  /**
   * 獲取黑板實例
   * @returns {AIBlackboard|null}
   * @private
   */
  _getBlackboard() {
    return this.scene.aiBlackboard || null;
  }

  /**
   * 更新黑板中的敵人位置
   * @private
   */
  _updateBlackboardPosition() {
    const blackboard = this._getBlackboard();
    if (blackboard && this.teamCoordinationEnabled) {
      blackboard.updateEnemyPosition(this.id, { x: this.tank.x, y: this.tank.y });
    }
  }

  /**
   * 根據敵人類型決定目標優先級
   * @param {string} tankType - 敵人類型
   * @returns {Object} 目標優先級配置
   * @private
   */
  _determineTargetPriority(tankType) {
    // 經典模式：不同敵人類型有不同的目標偏好
    const priorities = {
      'BASIC': { player: 0.7, base: 0.3 },   // 主要攻擊玩家
      'FAST': { player: 0.4, base: 0.6 },    // 主要攻擊基地（快速衝鋒）
      'POWER': { player: 0.8, base: 0.2 },   // 強力坦克主要攻擊玩家
      'ARMOR': { player: 0.8, base: 0.2 }    // 裝甲坦克主要攻擊玩家
    };

    return priorities[tankType] || priorities['BASIC'];
  }

  /**
   * 初始化所有 AI 狀態
   * @private
   */
  _initializeStates() {
    // ===== 巡邏狀態 =====
    this.stateMachine.addState('patrol', {
      enter: () => {
        // 開始巡邏 - 獲取巡邏點
        this._assignNewPatrolTarget();
      },

      update: (delta) => {
        // 智能巡邏 vs 隨機巡邏
        if (this.smartPatrolEnabled) {
          this._executeSmartPatrol();
        } else {
          // 後備：隨機移動（每幀都嘗試移動）
          this._executeRandomPatrol();
        }

        // 隨機射擊（但如果看到玩家就瞄準射擊）
        if (this.hasLineOfSight && this.scene.player) {
          this._tryShootAtTarget(this.scene.player);
        } else {
          this._tryRandomShoot();
        }
      },

      exit: () => {
        // 離開巡邏狀態
        this.currentPatrolTarget = null;
      }
    });

    // ===== 追逐狀態 =====
    this.stateMachine.addState('chase', {
      enter: () => {
        // 開始追逐 - 決定是否進行包抄
        this._evaluateFlankingOpportunity();

        // 標記開始攻擊
        const blackboard = this._getBlackboard();
        if (blackboard) {
          blackboard.markAsAttacking(this.id);
        }
      },

      update: (delta) => {
        const target = this._getCurrentTarget();

        if (!target) {
          this.stateMachine.setState('patrol');
          return;
        }

        // 包抄模式 vs 直接追逐
        if (this.isFlankingMode && this.flankingTarget) {
          this._executeFlankingMove();
        } else {
          // 朝向目標移動
          this._moveTowardsTarget(target);
        }

        // 嘗試射擊（使用預測射擊）
        this._tryShootAtTargetWithPrediction(target);
      },

      exit: () => {
        this.tank.stop();
        this.isFlankingMode = false;
        this.flankingTarget = null;

        // 標記停止攻擊
        const blackboard = this._getBlackboard();
        if (blackboard) {
          blackboard.markAsNotAttacking(this.id);
        }
      }
    });

    // ===== 攻擊狀態 =====
    this.stateMachine.addState('attack', {
      enter: () => {
        // 開始攻擊
        const blackboard = this._getBlackboard();
        if (blackboard) {
          blackboard.markAsAttacking(this.id);
        }
      },

      update: (delta) => {
        const target = this._getCurrentTarget();

        if (!target) {
          this.stateMachine.setState('patrol');
          return;
        }

        // 對齊並射擊（使用預測）
        this._alignAndShootTargetWithPrediction(target);

        // 保持距離（只對玩家保持距離，基地則直接靠近）
        if (this.currentTarget === 'player') {
          this._maintainDistance(target);
        }
      },

      exit: () => {
        this.tank.stop();

        // 標記停止攻擊
        const blackboard = this._getBlackboard();
        if (blackboard) {
          blackboard.markAsNotAttacking(this.id);
        }
      }
    });

    // ===== 撤退狀態 =====
    this.stateMachine.addState('retreat', {
      enter: () => {
        // 開始撤退
      },

      update: (delta) => {
        const target = this._getCurrentTarget();

        if (!target) {
          this.stateMachine.setState('patrol');
          return;
        }

        // 遠離目標（通常是玩家）
        this._moveAwayFromTarget(target);

        // 邊撤退邊射擊
        this._tryShootAtTarget(target);
      },

      exit: () => {
        this.tank.stop();
      }
    });
  }

  /**
   * 更新 AI（簡化版 - 統一移動控制）
   * @param {number} delta - 時間差
   */
  update(delta) {
    if (this.tank.isFrozen) return;

    const currentTime = this.scene.time.now;

    // 更新黑板位置
    this._updateBlackboardPosition();

    // 定期評估狀態切換
    if (currentTime - this.lastStateChange > this.stateChangeCooldown) {
      this._evaluateState();
      this.lastStateChange = currentTime;
    }

    // 根據狀態決定目標方向（但不直接移動）
    this._updateDesiredDirection(currentTime);

    // 定期隨機換方向（增加不可預測性）
    if (currentTime - this.lastRandomDirectionChange > this.randomDirectionInterval) {
      if (Math.random() < 0.3) { // 30% 機率換方向
        this._setRandomDirection(currentTime);
      }
      this.lastRandomDirectionChange = currentTime;
    }

    // 檢測卡住
    this._checkIfStuck();

    // === 統一移動：只在這裡呼叫 move() ===
    this.tank.move(this.desiredDirection);

    // 嘗試射擊
    this._tryShoot();
  }

  /**
   * 根據當前狀態更新目標方向
   * @private
   */
  _updateDesiredDirection(currentTime) {
    const target = this._getCurrentTarget();

    // 沒有目標，維持當前方向
    if (!target) return;

    // 方向變更冷卻中，不改變
    if (currentTime - this.lastDirectionChange < this.directionChangeCooldown) {
      return;
    }

    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // 攻擊狀態：在射程內就停止接近，專心射擊
    if (this.stateMachine.currentState === 'attack' && distance < 150) {
      // 對準目標方向
      this._alignToTarget(target, currentTime);
      return;
    }

    // 追逐狀態：朝目標移動
    if (this.stateMachine.currentState === 'chase') {
      this._setDirectionTowardsTarget(target, currentTime);
      return;
    }

    // 撤退狀態：遠離目標
    if (this.stateMachine.currentState === 'retreat') {
      this._setDirectionAwayFromTarget(target, currentTime);
      return;
    }

    // 巡邏狀態：維持當前方向（撞牆時由 onWallHit 處理）
  }

  /**
   * 對準目標（用於攻擊狀態）
   * @private
   */
  _alignToTarget(target, currentTime) {
    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;
    const tolerance = 25;

    let newDir = this.desiredDirection;

    if (Math.abs(dx) < tolerance) {
      // 垂直對齊
      newDir = dy > 0 ? 'down' : 'up';
    } else if (Math.abs(dy) < tolerance) {
      // 水平對齊
      newDir = dx > 0 ? 'right' : 'left';
    }

    if (newDir !== this.desiredDirection) {
      this.desiredDirection = newDir;
      this.lastDirectionChange = currentTime;
    }
  }

  /**
   * 設定朝向目標的方向
   * @private
   */
  _setDirectionTowardsTarget(target, currentTime) {
    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;

    // 選擇主要移動軸向（差異較大的方向）
    let newDir;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      newDir = dx > 0 ? 'right' : 'left';
    } else if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      newDir = dy > 0 ? 'down' : 'up';
    } else {
      // 差不多，維持當前方向
      return;
    }

    if (newDir !== this.desiredDirection) {
      this.desiredDirection = newDir;
      this.lastDirectionChange = currentTime;
    }
  }

  /**
   * 設定遠離目標的方向
   * @private
   */
  _setDirectionAwayFromTarget(target, currentTime) {
    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;

    let newDir;
    if (Math.abs(dx) > Math.abs(dy) * 1.2) {
      newDir = dx > 0 ? 'left' : 'right'; // 反向
    } else if (Math.abs(dy) > Math.abs(dx) * 1.2) {
      newDir = dy > 0 ? 'up' : 'down'; // 反向
    } else {
      return;
    }

    if (newDir !== this.desiredDirection) {
      this.desiredDirection = newDir;
      this.lastDirectionChange = currentTime;
    }
  }

  /**
   * 設定隨機方向
   * @private
   */
  _setRandomDirection(currentTime) {
    const directions = ['up', 'down', 'left', 'right'];
    const otherDirs = directions.filter(d => d !== this.desiredDirection);
    this.desiredDirection = Phaser.Utils.Array.GetRandom(otherDirs);
    this.lastDirectionChange = currentTime;
  }

  /**
   * 嘗試射擊
   * @private
   */
  _tryShoot() {
    const target = this._getCurrentTarget();
    if (!target) {
      // 沒目標時隨機射擊
      if (Math.random() < 0.02) {
        this.tank.shoot();
      }
      return;
    }

    // 有目標時檢查是否對準
    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;
    const tolerance = 30;
    const dir = this.tank.direction;

    let aligned = false;
    if (dir === 'up' && dy < 0 && Math.abs(dx) < tolerance) aligned = true;
    if (dir === 'down' && dy > 0 && Math.abs(dx) < tolerance) aligned = true;
    if (dir === 'left' && dx < 0 && Math.abs(dy) < tolerance) aligned = true;
    if (dir === 'right' && dx > 0 && Math.abs(dy) < tolerance) aligned = true;

    if (aligned) {
      this.tank.shoot();
    } else if (Math.random() < 0.05) {
      // 未對準時也有小機率射擊
      this.tank.shoot();
    }
  }

  /**
   * 評估並切換狀態
   * @private
   */
  _evaluateState() {
    const player = this.scene.player;
    const base = this.scene.base;

    // 選擇目標（基於優先級和隨機性）
    this._selectTarget(player, base);

    // 如果沒有有效目標，巡邏
    if (!this.currentTarget) {
      this.stateMachine.setState('patrol');
      return;
    }

    // 根據目標決定行為
    const target = this.currentTarget === 'player' ? player : base;

    if (!target || (target.isDestroyed !== undefined && target.isDestroyed)) {
      this.currentTarget = null;
      this.stateMachine.setState('patrol');
      return;
    }

    // 計算與目標的距離
    const distance = Phaser.Math.Distance.Between(
      this.tank.x,
      this.tank.y,
      target.x,
      target.y
    );

    // 計算血量比例
    const healthPercent = this.tank.health / this.tank.maxHealth;

    // 決策邏輯
    if (healthPercent < this.retreatHealthPercent && this.currentTarget === 'player') {
      // 只在攻擊玩家時才撤退，攻擊基地時不撤退
      this.stateMachine.setState('retreat');
    } else if (distance < this.attackRange) {
      this.stateMachine.setState('attack');
    } else if (distance < this.detectionRange || this.currentTarget === 'base') {
      // 如果目標是基地，總是追逐
      this.stateMachine.setState('chase');
    } else {
      this.stateMachine.setState('patrol');
    }
  }

  /**
   * 選擇攻擊目標（玩家或基地）
   * @param {PlayerTank} player - 玩家坦克
   * @param {Base} base - 基地
   * @private
   */
  _selectTarget(player, base) {
    // 如果已有目標且目標有效，有一定機率保持當前目標（避免頻繁切換）
    if (this.currentTarget) {
      const target = this.currentTarget === 'player' ? player : base;
      if (target && (!target.isDestroyed || target.isDestroyed === false)) {
        // 80% 機率保持當前目標
        if (Math.random() < 0.8) {
          return;
        }
      }
    }

    // 檢查玩家和基地是否可用
    const playerAvailable = player && !player.isDestroyed;
    const baseAvailable = base && !base.isDestroyed;

    if (!playerAvailable && !baseAvailable) {
      this.currentTarget = null;
      return;
    }

    if (!playerAvailable) {
      this.currentTarget = 'base';
      return;
    }

    if (!baseAvailable) {
      this.currentTarget = 'player';
      return;
    }

    // 根據優先級隨機選擇目標
    const roll = Math.random();
    if (roll < this.targetPriority.player) {
      this.currentTarget = 'player';
    } else {
      this.currentTarget = 'base';
    }
  }

  // ========== 行為方法 ==========

  /**
   * 獲取當前目標對象
   * @returns {Object|null} 目標對象（玩家或基地）
   * @private
   */
  _getCurrentTarget() {
    if (this.currentTarget === 'player') {
      return this.scene.player;
    } else if (this.currentTarget === 'base') {
      return this.scene.base;
    }
    return null;
  }

  /**
   * 朝向目標移動（使用 A* 尋路）
   * @param {Object} target - 目標對象
   * @private
   */
  _moveTowardsTarget(target) {
    const currentTime = this.scene.time.now;

    // 根據當前狀態選擇路徑更新頻率
    const currentState = this.stateMachine.currentState;
    const updateInterval = currentState === 'chase'
      ? this.pathUpdateIntervalChase
      : this.pathUpdateIntervalPatrol;

    // 定期更新路徑或路徑不存在時重新計算
    if (!this.currentPath || currentTime - this.lastPathUpdate > updateInterval) {
      this._updatePath(target);
      this.lastPathUpdate = currentTime;
    }

    // 沿著路徑移動
    if (this.currentPath && this.currentPath.length > 0) {
      this._followPath();
    } else {
      // 沒有路徑時使用簡單直線移動（後備方案）
      this._moveDirectly(target);
    }
  }

  /**
   * 更新到達目標的路徑
   * @param {Object} target - 目標對象
   * @private
   */
  _updatePath(target) {
    if (!this.scene.levelData || !this.scene.levelData.map) {
      return;
    }

    const start = { x: this.tank.x, y: this.tank.y };
    const goal = { x: target.x, y: target.y };

    // 使用 A* 尋找路徑
    const path = AStar.findPath(
      start,
      goal,
      this.scene.levelData.map,
      GAME_CONFIG.TILE_SIZE
    );

    if (path && path.length > 0) {
      this.currentPath = AStar.simplifyPath(path);
      this.currentWaypointIndex = 0;
    } else {
      this.currentPath = null;
    }
  }

  /**
   * 沿著路徑移動
   * @private
   */
  _followPath() {
    if (!this.currentPath || this.currentWaypointIndex >= this.currentPath.length) {
      this.currentPath = null;
      return;
    }

    const waypoint = this.currentPath[this.currentWaypointIndex];
    const distance = Phaser.Math.Distance.Between(
      this.tank.x,
      this.tank.y,
      waypoint.x,
      waypoint.y
    );

    // 到達當前路徑點，移動到下一個
    if (distance < this.waypointReachDistance) {
      this.currentWaypointIndex++;
      if (this.currentWaypointIndex >= this.currentPath.length) {
        this.currentPath = null;
        return;
      }
    }

    // 朝向當前路徑點移動
    const dx = waypoint.x - this.tank.x;
    const dy = waypoint.y - this.tank.y;

    // 死區：如果偏移量很小，維持當前方向
    const deadZone = 8;
    if (Math.abs(dx) < deadZone && Math.abs(dy) < deadZone) {
      // 已經很接近目標點，維持當前方向
      this.tank.move(this.tank.direction);
      return;
    }

    // 計算新方向
    let newDirection;
    // 加入滯後效應：需要明顯差異才切換軸向（防止在對角線上抖動）
    const axisThreshold = 1.5; // dx 需要比 dy 大 1.5 倍才會選擇水平移動
    if (Math.abs(dx) > Math.abs(dy) * axisThreshold) {
      newDirection = dx > 0 ? 'right' : 'left';
    } else if (Math.abs(dy) > Math.abs(dx) * axisThreshold) {
      newDirection = dy > 0 ? 'down' : 'up';
    } else {
      // dx 和 dy 相近，優先維持當前方向
      const currentDir = this.tank.direction;
      if ((currentDir === 'left' || currentDir === 'right') && Math.abs(dx) > deadZone) {
        newDirection = dx > 0 ? 'right' : 'left';
      } else if ((currentDir === 'up' || currentDir === 'down') && Math.abs(dy) > deadZone) {
        newDirection = dy > 0 ? 'down' : 'up';
      } else {
        // 完全沒有偏好，選擇較大偏移的方向
        newDirection = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
    }

    this.tank.move(newDirection);
  }

  /**
   * 直線移動到目標（後備方案，帶有智能避障）
   * @param {Object} target - 目標對象
   * @private
   */
  _moveDirectly(target) {
    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;

    // 死區：偏移量很小時維持當前方向
    const deadZone = 8;
    if (Math.abs(dx) < deadZone && Math.abs(dy) < deadZone) {
      if (this._isDirectionSafe(this.tank.direction)) {
        this.tank.move(this.tank.direction);
      }
      return;
    }

    // 計算首選方向（加入滯後效應防止抖動）
    let primaryDir, secondaryDir;
    const axisThreshold = 1.5;
    const currentDir = this.tank.direction;

    if (Math.abs(dx) > Math.abs(dy) * axisThreshold) {
      primaryDir = dx > 0 ? 'right' : 'left';
      secondaryDir = dy > 0 ? 'down' : 'up';
    } else if (Math.abs(dy) > Math.abs(dx) * axisThreshold) {
      primaryDir = dy > 0 ? 'down' : 'up';
      secondaryDir = dx > 0 ? 'right' : 'left';
    } else {
      // dx 和 dy 相近，優先維持當前軸向
      if (currentDir === 'left' || currentDir === 'right') {
        primaryDir = dx > 0 ? 'right' : 'left';
        secondaryDir = dy > 0 ? 'down' : 'up';
      } else {
        primaryDir = dy > 0 ? 'down' : 'up';
        secondaryDir = dx > 0 ? 'right' : 'left';
      }
    }

    // 檢查首選方向是否可行走
    if (this._isDirectionSafe(primaryDir)) {
      this.tank.move(primaryDir);
      return;
    }

    // 首選方向被阻擋，嘗試次要方向
    if (this._isDirectionSafe(secondaryDir)) {
      this.tank.move(secondaryDir);
      return;
    }

    // 兩個方向都被阻擋，使用智能方向選擇
    const safeDir = this._chooseSafestDirection();
    if (safeDir) {
      this.tank.move(safeDir);
    }
  }

  /**
   * 檢查指定方向是否安全（前方沒有障礙物）
   * @param {string} direction - 方向
   * @returns {boolean}
   * @private
   */
  _isDirectionSafe(direction) {
    if (!this.scene.levelData || !this.scene.levelData.map) {
      return true;
    }

    const map = this.scene.levelData.map;
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const vector = DIRECTION_VECTORS[direction];

    // 檢查前方一格的位置
    const checkX = this.tank.x + vector.x * tileSize;
    const checkY = this.tank.y + vector.y * tileSize;

    const gridX = Math.floor(checkX / tileSize);
    const gridY = Math.floor(checkY / tileSize);

    // 邊界檢查
    if (gridY < 0 || gridY >= map.length || gridX < 0 || gridX >= map[0].length) {
      return false;
    }

    const tile = map[gridY][gridX];

    // 安全的地形：空地、冰地、森林
    return tile === TILE_TYPES.EMPTY || tile === TILE_TYPES.ICE || tile === TILE_TYPES.FOREST;
  }

  /**
   * 遠離目標移動
   * @param {Object} target - 目標對象
   * @private
   */
  _moveAwayFromTarget(target) {
    // 清除追逐路徑
    this.currentPath = null;

    const currentTime = this.scene.time.now;

    // 方向穩定：200ms 內不換方向
    if (currentTime - this.lastDirectionChange < 200) {
      this.tank.move(this.tank.direction);
      return;
    }

    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;

    // 反向移動（加入滯後效應防止抖動）
    const axisThreshold = 1.3;
    let newDir;

    if (Math.abs(dx) > Math.abs(dy) * axisThreshold) {
      newDir = dx > 0 ? 'left' : 'right';
    } else if (Math.abs(dy) > Math.abs(dx) * axisThreshold) {
      newDir = dy > 0 ? 'up' : 'down';
    } else {
      // dx 和 dy 相近，維持當前方向
      this.tank.move(this.tank.direction);
      return;
    }

    if (newDir !== this.tank.direction) {
      this.lastDirectionChange = currentTime;
    }
    this.tank.move(newDir);
  }

  /**
   * 對齊目標並射擊
   * @param {Object} target - 目標對象
   * @private
   */
  _alignAndShootTarget(target) {
    const tolerance = 10;

    // 檢查是否在同一條線上
    if (Math.abs(this.tank.x - target.x) < tolerance) {
      // 垂直對齊
      this.tank.move(this.tank.y < target.y ? 'down' : 'up');
      this._tryShootAtTarget(target);
    } else if (Math.abs(this.tank.y - target.y) < tolerance) {
      // 水平對齊
      this.tank.move(this.tank.x < target.x ? 'right' : 'left');
      this._tryShootAtTarget(target);
    } else {
      // 未對齊，先移動對齊
      this._moveTowardsTarget(target);
      // 即使未完全對齊也嘗試射擊（避免被地形阻擋時完全不攻擊）
      this._tryShootAtTarget(target);
    }
  }

  /**
   * 保持與目標的距離
   * @param {Object} target - 目標對象
   * @private
   */
  _maintainDistance(target) {
    const distance = Phaser.Math.Distance.Between(
      this.tank.x,
      this.tank.y,
      target.x,
      target.y
    );

    const idealDistance = 100;
    const buffer = 30; // 增加緩衝區，減少頻繁切換

    if (distance < idealDistance - buffer) {
      this._moveAwayFromTarget(target);
    } else if (distance > idealDistance + buffer + 50) {
      // 距離太遠時，維持當前方向移動（不用複雜的路徑計算）
      this.tank.move(this.tank.direction);
    } else {
      // 在理想範圍內，停止移動專心射擊
      this.tank.stop();
    }
  }

  /**
   * 嘗試射擊目標
   * @param {Object} target - 目標對象
   * @private
   */
  _tryShootAtTarget(target) {
    const currentTime = this.scene.time.now;

    if (currentTime - this.lastShot < this.tank.fireRate) {
      return;
    }

    // 檢查是否對準目標
    const tolerance = 30;
    let canShoot = false;

    const dir = this.tank.direction;
    if (dir === 'up' && this.tank.y > target.y) {
      canShoot = Math.abs(this.tank.x - target.x) < tolerance;
    } else if (dir === 'down' && this.tank.y < target.y) {
      canShoot = Math.abs(this.tank.x - target.x) < tolerance;
    } else if (dir === 'left' && this.tank.x > target.x) {
      canShoot = Math.abs(this.tank.y - target.y) < tolerance;
    } else if (dir === 'right' && this.tank.x < target.x) {
      canShoot = Math.abs(this.tank.y - target.y) < tolerance;
    }

    if (canShoot) {
      this.tank.shoot();
      this.lastShot = currentTime;
    }
  }

  /**
   * 隨機射擊（巡邏時）
   * @private
   */
  _tryRandomShoot() {
    const currentTime = this.scene.time.now;

    if (currentTime - this.lastShot < this.tank.fireRate) {
      return;
    }

    // 10% 機率射擊
    if (Math.random() < 0.1) {
      this.tank.shoot();
      this.lastShot = currentTime;
    }
  }

  /**
   * 智能選擇最安全的移動方向
   * 基於地圖數據，選擇沒有障礙物的方向
   * @returns {string|null} 最安全的方向，如果所有方向都有障礙則返回 null
   * @private
   */
  _chooseSafestDirection() {
    if (!this.scene.levelData || !this.scene.levelData.map) {
      // 無地圖數據，返回隨機垂直方向
      return this._choosePerpendicularDirection();
    }

    const directions = ['up', 'down', 'left', 'right'];
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const map = this.scene.levelData.map;

    // 評估每個方向的安全性
    const directionScores = directions.map(dir => {
      const vector = DIRECTION_VECTORS[dir];

      // 檢查前方一格和兩格的位置
      const check1X = this.tank.x + vector.x * tileSize;
      const check1Y = this.tank.y + vector.y * tileSize;
      const check2X = this.tank.x + vector.x * tileSize * 2;
      const check2Y = this.tank.y + vector.y * tileSize * 2;

      // 轉換為格子坐標
      const gridX1 = Math.floor(check1X / tileSize);
      const gridY1 = Math.floor(check1Y / tileSize);
      const gridX2 = Math.floor(check2X / tileSize);
      const gridY2 = Math.floor(check2Y / tileSize);

      let score = 0;

      // 檢查前方一格
      if (gridY1 >= 0 && gridY1 < map.length && gridX1 >= 0 && gridX1 < map[0].length) {
        const tile1 = map[gridY1][gridX1];
        if (tile1 === TILE_TYPES.EMPTY || tile1 === TILE_TYPES.ICE || tile1 === TILE_TYPES.FOREST) {
          score += 10; // 前方一格安全
        } else {
          score -= 5; // 前方一格有障礙
        }
      } else {
        score -= 10; // 超出邊界
      }

      // 檢查前方兩格（更遠的視野）
      if (gridY2 >= 0 && gridY2 < map.length && gridX2 >= 0 && gridX2 < map[0].length) {
        const tile2 = map[gridY2][gridX2];
        if (tile2 === TILE_TYPES.EMPTY || tile2 === TILE_TYPES.ICE || tile2 === TILE_TYPES.FOREST) {
          score += 5; // 前方兩格安全（獎勵較少）
        }
      }

      // 避免選擇當前方向的相反方向（避免來回振盪）
      const oppositeDirections = {
        'up': 'down',
        'down': 'up',
        'left': 'right',
        'right': 'left'
      };
      if (dir === oppositeDirections[this.tank.direction]) {
        score -= 3; // 輕微懲罰反向
      }

      return { dir, score };
    });

    // 過濾掉得分為負的方向
    const validDirections = directionScores.filter(d => d.score > 0);

    if (validDirections.length === 0) {
      // 所有方向都有障礙，選擇得分最高的
      directionScores.sort((a, b) => b.score - a.score);
      return directionScores[0].dir;
    }

    // 選擇得分最高的方向
    validDirections.sort((a, b) => b.score - a.score);
    return validDirections[0].dir;
  }

  /**
   * 選擇垂直於當前方向的方向
   * @returns {string} 垂直方向
   * @private
   */
  _choosePerpendicularDirection() {
    const perpendicularDirections = {
      'up': ['left', 'right'],
      'down': ['left', 'right'],
      'left': ['up', 'down'],
      'right': ['up', 'down']
    };

    const possibleDirections = perpendicularDirections[this.tank.direction] || ['up', 'down', 'left', 'right'];
    return Phaser.Utils.Array.GetRandom(possibleDirections);
  }

  /**
   * 檢查當前位置是否接近之前卡住的位置
   * @returns {boolean} 是否在卡住位置附近
   * @private
   */
  _isNearStuckPosition() {
    for (const stuckPos of this.stuckPositions) {
      const distance = Phaser.Math.Distance.Between(
        this.tank.x,
        this.tank.y,
        stuckPos.x,
        stuckPos.y
      );
      if (distance < this.stuckPositionRadius) {
        return true;
      }
    }
    return false;
  }

  /**
   * 記錄卡住位置
   * @private
   */
  _recordStuckPosition() {
    // 添加到記憶列表
    this.stuckPositions.push({ x: this.tank.x, y: this.tank.y });

    // 保持列表大小
    if (this.stuckPositions.length > this.stuckPositionMemorySize) {
      this.stuckPositions.shift(); // 移除最舊的記錄
    }
  }

  /**
   * 檢測是否卡住（簡化版）
   * @private
   */
  _checkIfStuck() {
    // 計算位移距離
    const distance = Phaser.Math.Distance.Between(
      this.tank.x,
      this.tank.y,
      this.lastPosition.x,
      this.lastPosition.y
    );

    // 如果移動距離很小，增加卡住計數
    if (distance < 1) {
      this.stuckCounter++;

      // 卡住超過 60 幀（約 1 秒），換方向
      if (this.stuckCounter >= 60) {
        const allDirections = ['up', 'down', 'left', 'right'];
        const validDirections = allDirections.filter(dir => dir !== this.desiredDirection);
        // 只設定目標方向，不直接呼叫 move()
        this.desiredDirection = Phaser.Utils.Array.GetRandom(validDirections);
        this.lastDirectionChange = this.scene.time.now;
        this.stuckCounter = 0;
      }
    } else {
      // 正常移動，重置計數器
      this.stuckCounter = 0;
    }

    // 更新上次位置
    this.lastPosition.x = this.tank.x;
    this.lastPosition.y = this.tank.y;
  }

  // ========== 事件處理 ==========

  /**
   * 碰到牆壁時的處理（簡化版）
   */
  onWallHit() {
    const currentTime = this.scene.time.now;

    // 防止高頻振盪：使用冷卻時間
    if (currentTime - this.lastDirectionChange < this.directionChangeCooldown) {
      return;
    }

    // 選擇垂直於當前方向的隨機方向
    const currentDir = this.desiredDirection;
    let newDirections;

    if (currentDir === 'up' || currentDir === 'down') {
      newDirections = ['left', 'right'];
    } else {
      newDirections = ['up', 'down'];
    }

    // 只設定目標方向，不直接呼叫 move()
    this.desiredDirection = Phaser.Utils.Array.GetRandom(newDirections);
    this.lastDirectionChange = currentTime;
  }

  /**
   * 嘗試邊緣滑動（處理坦克只碰到牆壁一點點的情況）
   * 使用 GridMovement 輔助類進行精確的格子對齊
   * @returns {boolean} 是否成功應用滑動
   * @private
   */
  _tryEdgeSliding() {
    const map = this.scene.levelData?.map;
    const direction = this.tank.direction;

    // 使用 GridMovement 計算角落滑動
    const slide = GridMovement.calculateCornerSlide(this.tank, direction, map);

    if (slide) {
      // 應用滑動修正
      if (slide.axis === 'x') {
        this.tank.x += slide.amount;
      } else if (slide.axis === 'y') {
        this.tank.y += slide.amount;
      }
      return true;
    }

    return false;
  }

  /**
   * 強制將坦克對齊到格子（用於嚴重卡住時）
   * @returns {boolean} 是否成功對齊
   * @private
   */
  _forceGridAlign() {
    const map = this.scene.levelData?.map;
    return GridMovement.forceSnapToGrid(this.tank, map);
  }

  /**
   * 尋找並移動到最近的可行走位置
   * @returns {boolean} 是否成功
   * @private
   */
  _escapeToWalkablePosition() {
    const map = this.scene.levelData?.map;
    const safePos = GridMovement.findNearestWalkablePosition(this.tank, map);

    if (safePos) {
      this.tank.x = safePos.x;
      this.tank.y = safePos.y;
      this.currentPath = null;
      return true;
    }

    return false;
  }

  /**
   * 碰到其他坦克時的處理
   */
  onTankHit() {
    const currentDirection = this.tank.direction;
    const availableDirections = ['up', 'down', 'left', 'right'].filter(
      dir => dir !== currentDirection
    );

    const newDirection = Phaser.Utils.Array.GetRandom(availableDirections);
    this.tank.move(newDirection);
  }

  // ==========================================
  // 進階 AI 功能：視線檢測
  // ==========================================

  /**
   * 更新視線檢測狀態
   * @private
   */
  _updateLineOfSight() {
    const player = this.scene.player;
    if (!player || player.isDestroyed) {
      this.hasLineOfSight = false;
      return;
    }

    this.hasLineOfSight = this._checkLineOfSight(
      { x: this.tank.x, y: this.tank.y },
      { x: player.x, y: player.y }
    );
  }

  /**
   * 檢查兩點之間是否有視線（無障礙物）
   * 使用 Bresenham 演算法進行射線檢測
   * @param {Object} from - 起點 { x, y }
   * @param {Object} to - 終點 { x, y }
   * @returns {boolean} 是否有視線
   */
  _checkLineOfSight(from, to) {
    if (!this.scene.levelData || !this.scene.levelData.map) {
      return true; // 無地圖資料時假設有視線
    }

    const map = this.scene.levelData.map;
    const tileSize = GAME_CONFIG.TILE_SIZE;

    // 轉換為格子坐標
    const x0 = Math.floor(from.x / tileSize);
    const y0 = Math.floor(from.y / tileSize);
    const x1 = Math.floor(to.x / tileSize);
    const y1 = Math.floor(to.y / tileSize);

    // Bresenham 直線演算法
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    while (true) {
      // 檢查當前格子是否阻擋視線
      if (y >= 0 && y < map.length && x >= 0 && x < map[0].length) {
        const tile = map[y][x];
        // 牆壁阻擋視線
        if (tile === TILE_TYPES.BRICK || tile === TILE_TYPES.STEEL) {
          return false;
        }
      }

      // 到達終點
      if (x === x1 && y === y1) break;

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

    return true;
  }

  /**
   * 檢查是否能直接射擊到目標（考慮方向對齊和視線）
   * @param {Object} target - 目標
   * @returns {boolean}
   */
  _canDirectlyShoot(target) {
    if (!this.hasLineOfSight) return false;

    const tolerance = 30;
    const dir = this.tank.direction;

    // 檢查方向對齊
    if (dir === 'up' && this.tank.y > target.y) {
      return Math.abs(this.tank.x - target.x) < tolerance;
    } else if (dir === 'down' && this.tank.y < target.y) {
      return Math.abs(this.tank.x - target.x) < tolerance;
    } else if (dir === 'left' && this.tank.x > target.x) {
      return Math.abs(this.tank.y - target.y) < tolerance;
    } else if (dir === 'right' && this.tank.x < target.x) {
      return Math.abs(this.tank.y - target.y) < tolerance;
    }

    return false;
  }

  // ==========================================
  // 進階 AI 功能：預測射擊
  // ==========================================

  /**
   * 預測目標未來的位置
   * @param {Object} target - 目標對象
   * @param {number} predictionTime - 預測時間（秒）
   * @returns {Object} 預測位置 { x, y }
   */
  _predictTargetPosition(target, predictionTime = null) {
    if (!this.predictionEnabled || !target || !target.body) {
      return { x: target.x, y: target.y };
    }

    const time = predictionTime || this.predictionTime;

    // 獲取目標速度
    const vx = target.body.velocity.x || 0;
    const vy = target.body.velocity.y || 0;

    // 預測位置
    return {
      x: target.x + vx * time,
      y: target.y + vy * time
    };
  }

  /**
   * 使用預測射擊嘗試射擊目標
   * @param {Object} target - 目標對象
   * @private
   */
  _tryShootAtTargetWithPrediction(target) {
    const currentTime = this.scene.time.now;

    if (currentTime - this.lastShot < this.tank.fireRate) {
      return;
    }

    // 獲取預測位置
    const predictedPos = this._predictTargetPosition(target);

    // 檢查是否對準預測位置
    const tolerance = 40; // 稍微放寬容差
    let canShoot = false;

    const dir = this.tank.direction;
    if (dir === 'up' && this.tank.y > predictedPos.y) {
      canShoot = Math.abs(this.tank.x - predictedPos.x) < tolerance;
    } else if (dir === 'down' && this.tank.y < predictedPos.y) {
      canShoot = Math.abs(this.tank.x - predictedPos.x) < tolerance;
    } else if (dir === 'left' && this.tank.x > predictedPos.x) {
      canShoot = Math.abs(this.tank.y - predictedPos.y) < tolerance;
    } else if (dir === 'right' && this.tank.x < predictedPos.x) {
      canShoot = Math.abs(this.tank.y - predictedPos.y) < tolerance;
    }

    if (canShoot) {
      this.tank.shoot();
      this.lastShot = currentTime;
    }
  }

  /**
   * 對齊目標並使用預測射擊
   * @param {Object} target - 目標對象
   * @private
   */
  _alignAndShootTargetWithPrediction(target) {
    const currentTime = this.scene.time.now;

    // 方向穩定：200ms 內不換方向
    if (currentTime - this.lastDirectionChange < 200) {
      this.tank.move(this.tank.direction);
      this._tryShootAtTargetWithPrediction(target);
      return;
    }

    // 獲取預測位置
    const predictedPos = this._predictTargetPosition(target);
    const tolerance = 20;
    const dx = predictedPos.x - this.tank.x;
    const dy = predictedPos.y - this.tank.y;

    // 檢查是否在同一條線上（使用預測位置）
    if (Math.abs(dx) < tolerance) {
      // 垂直對齊，朝目標方向移動
      const newDir = dy > 0 ? 'down' : 'up';
      if (newDir !== this.tank.direction) {
        this.lastDirectionChange = currentTime;
      }
      this.tank.move(newDir);
      this._tryShootAtTargetWithPrediction(target);
    } else if (Math.abs(dy) < tolerance) {
      // 水平對齊
      const newDir = dx > 0 ? 'right' : 'left';
      if (newDir !== this.tank.direction) {
        this.lastDirectionChange = currentTime;
      }
      this.tank.move(newDir);
      this._tryShootAtTargetWithPrediction(target);
    } else {
      // 未對齊，維持當前方向繼續移動
      this.tank.move(this.tank.direction);
      this._tryShootAtTargetWithPrediction(target);
    }
  }

  // ==========================================
  // 進階 AI 功能：智能巡邏
  // ==========================================

  /**
   * 分配新的巡邏目標
   * @private
   */
  _assignNewPatrolTarget() {
    const blackboard = this._getBlackboard();

    if (blackboard && this.smartPatrolEnabled) {
      // 從黑板獲取巡邏點
      this.currentPatrolTarget = blackboard.assignPatrolPoint(
        this.id,
        { x: this.tank.x, y: this.tank.y }
      );
    } else {
      // 後備方案：隨機生成巡邏目標
      this.currentPatrolTarget = this._generateRandomPatrolTarget();
    }
  }

  /**
   * 生成隨機巡邏目標（確保位置可行走）
   * @returns {Object} 巡邏點 { x, y }
   * @private
   */
  _generateRandomPatrolTarget() {
    const margin = 80;
    const width = GAME_CONFIG.WIDTH;
    const height = GAME_CONFIG.HEIGHT;
    const maxAttempts = 30;

    // 嘗試生成可行走的隨機位置
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = {
        x: margin + Math.random() * (width - 2 * margin),
        y: margin + Math.random() * (height - 2 * margin)
      };

      // 檢查位置是否可行走
      if (this._isTargetPositionWalkable(candidate)) {
        return candidate;
      }
    }

    // 後備方案：返回當前位置附近的安全位置
    return this._findSafePositionNearby({ x: this.tank.x, y: this.tank.y });
  }

  /**
   * 檢查目標位置是否可行走
   * @param {Object} pos - 位置 { x, y }
   * @returns {boolean}
   * @private
   */
  _isTargetPositionWalkable(pos) {
    if (!this.scene.levelData || !this.scene.levelData.map) {
      return true;
    }

    const map = this.scene.levelData.map;
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

    for (const point of checkPoints) {
      const gridX = Math.floor(point.x / tileSize);
      const gridY = Math.floor(point.y / tileSize);

      // 邊界檢查
      if (gridY < 0 || gridY >= map.length || gridX < 0 || gridX >= map[0].length) {
        return false;
      }

      const tile = map[gridY][gridX];
      // 不可行走的地形
      if (tile === TILE_TYPES.BRICK || tile === TILE_TYPES.STEEL || tile === TILE_TYPES.WATER) {
        return false;
      }
    }

    return true;
  }

  /**
   * 尋找當前位置附近的安全位置
   * @param {Object} pos - 參考位置
   * @returns {Object} 安全位置
   * @private
   */
  _findSafePositionNearby(pos) {
    const tileSize = GAME_CONFIG.TILE_SIZE;
    const searchRadius = tileSize * 5;

    // 螺旋搜索
    for (let radius = tileSize; radius <= searchRadius; radius += tileSize) {
      const candidates = [
        { x: pos.x + radius, y: pos.y },
        { x: pos.x - radius, y: pos.y },
        { x: pos.x, y: pos.y + radius },
        { x: pos.x, y: pos.y - radius }
      ];

      for (const candidate of candidates) {
        if (this._isTargetPositionWalkable(candidate)) {
          return candidate;
        }
      }
    }

    // 最後方案：返回原位置
    return pos;
  }

  /**
   * 執行智能巡邏
   * @private
   */
  _executeSmartPatrol() {
    // 簡化：直接朝當前方向移動，撞牆時由 onWallHit() 處理換向
    this.tank.move(this.tank.direction);
  }

  /**
   * 執行隨機巡邏（後備方案）
   * @private
   */
  _executeRandomPatrol() {
    // 簡單策略：持續朝當前方向移動，不每幀重新計算
    this.tank.move(this.tank.direction);
  }

  // ==========================================
  // 進階 AI 功能：包抄戰術
  // ==========================================

  /**
   * 評估包抄機會
   * @private
   */
  _evaluateFlankingOpportunity() {
    if (!this.flankingEnabled || this.currentTarget !== 'player') {
      this.isFlankingMode = false;
      this.flankingTarget = null;
      return;
    }

    const blackboard = this._getBlackboard();
    if (!blackboard) {
      this.isFlankingMode = false;
      return;
    }

    // 檢查是否可以加入包抄
    if (!blackboard.canJoinFlanking()) {
      this.isFlankingMode = false;
      return;
    }

    // 計算包抄位置
    const flankPos = blackboard.calculateFlankingPosition(
      this.id,
      { x: this.tank.x, y: this.tank.y }
    );

    if (flankPos) {
      this.isFlankingMode = true;
      this.flankingTarget = flankPos;
    } else {
      this.isFlankingMode = false;
      this.flankingTarget = null;
    }
  }

  /**
   * 執行包抄移動
   * @private
   */
  _executeFlankingMove() {
    if (!this.flankingTarget) {
      this.isFlankingMode = false;
      return;
    }

    // 計算到包抄位置的距離
    const distance = Phaser.Math.Distance.Between(
      this.tank.x,
      this.tank.y,
      this.flankingTarget.x,
      this.flankingTarget.y
    );

    // 到達包抄位置後，切換到攻擊模式
    if (distance < 30) {
      this.isFlankingMode = false;
      this.flankingTarget = null;

      // 清除黑板中的包抄位置
      const blackboard = this._getBlackboard();
      if (blackboard) {
        blackboard.flankingPositions.delete(this.id);
      }

      // 切換到攻擊狀態
      this.stateMachine.setState('attack');
      return;
    }

    // 移動到包抄位置
    this._moveTowardsTarget(this.flankingTarget);

    // 在包抄途中也嘗試射擊
    const player = this.scene.player;
    if (player && !player.isDestroyed) {
      this._tryShootAtTargetWithPrediction(player);
    }
  }

  // ==========================================
  // 威脅評估
  // ==========================================

  /**
   * 計算對當前敵人的威脅評估分數
   * @returns {number} 威脅分數 (0-100)
   */
  calculateThreatScore() {
    const player = this.scene.player;
    if (!player || player.isDestroyed) return 0;

    let score = 50; // 基礎分數

    // 距離因素
    const distance = Phaser.Math.Distance.Between(
      this.tank.x,
      this.tank.y,
      player.x,
      player.y
    );

    // 越近威脅越高
    if (distance < 100) score += 30;
    else if (distance < 200) score += 20;
    else if (distance < 300) score += 10;

    // 玩家是否面向我
    if (this._isPlayerFacingMe(player)) {
      score += 20;
    }

    // 我的血量
    const healthPercent = this.tank.health / this.tank.maxHealth;
    if (healthPercent <= 0.25) score += 30;
    else if (healthPercent <= 0.5) score += 15;

    // 視線威脅
    if (this.hasLineOfSight) {
      score += 15;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * 檢查玩家是否面向這個敵人
   * @param {Object} player - 玩家
   * @returns {boolean}
   * @private
   */
  _isPlayerFacingMe(player) {
    if (!player || !player.direction) return false;

    const dx = this.tank.x - player.x;
    const dy = this.tank.y - player.y;
    const dir = player.direction;

    const tolerance = 50;

    switch (dir) {
    case 'up':
      return dy < 0 && Math.abs(dx) < tolerance;
    case 'down':
      return dy > 0 && Math.abs(dx) < tolerance;
    case 'left':
      return dx < 0 && Math.abs(dy) < tolerance;
    case 'right':
      return dx > 0 && Math.abs(dy) < tolerance;
    default:
      return false;
    }
  }

  /**
   * 清理資源（當敵人被銷毀時調用）
   */
  destroy() {
    this.unregisterFromBlackboard();
  }
}
