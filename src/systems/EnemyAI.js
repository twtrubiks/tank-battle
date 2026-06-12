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
    this.attackIdealDistance = 100;  // 攻擊狀態理想距離
    this.attackDistanceBuffer = 30;  // 距離緩衝區，減少頻繁切換

    // 時間控制
    this.lastStateChange = 0;
    this.stateChangeCooldown = AI_CONFIG.STATE_CHANGE_COOLDOWN;
    this.lastShot = 0;

    // 移動意圖：狀態機設定，統一移動出口（update 尾端）執行
    this.desiredDirection = 'down'; // 目標方向
    this.wantsToMove = true;        // 是否要移動（false = 停車射擊）
    this.lastDirectionChange = 0;
    this.directionChangeCooldown = 500; // 500ms 方向變更冷卻
    this.lastRandomDirectionChange = 0;
    this.randomDirectionInterval = 3000; // 每 3 秒有機會隨機換方向
    this.lastShootDecision = 0;
    this.shootDecisionInterval = 250; // 隨機射擊決策間隔（時間制，避免依賴幀率）

    // 卡住檢測（時間制：以移動量窗口評估，不受畫面更新率影響）
    this.stuckTime = 0;
    this.stuckWindowTime = 0;
    this.stuckWindowDistance = 0;
    this.stuckTurned = false;
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
    // 注意：要用 enemyType（'BASIC' 等），tank.type 是 Phaser GameObject 內建欄位（'Sprite'）
    this.currentTarget = null; // 'player' 或 'base'
    this.targetPriority = this._determineTargetPriority(tank.enemyType);

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

      update: () => {
        // 智能巡邏：以尋路前往巡邏點；無巡邏點則維持方向漫遊
        if (this.smartPatrolEnabled && this.currentPatrolTarget) {
          const distance = Phaser.Math.Distance.Between(
            this.tank.x,
            this.tank.y,
            this.currentPatrolTarget.x,
            this.currentPatrolTarget.y
          );

          if (distance < this.patrolPointReachDist) {
            // 到達巡邏點，換下一個
            this._assignNewPatrolTarget();
          } else {
            this._moveTowardsTarget(this.currentPatrolTarget);
          }
        } else {
          // 後備：維持目前方向前進（撞牆由 onWallHit 換向），偶爾隨機換向
          this._maybeRandomTurn();
        }

        // 看得到玩家就瞄準射擊，否則隨機射擊
        if (this.hasLineOfSight && this.scene.player && !this.scene.player.isDestroyed) {
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

      update: () => {
        const target = this._getCurrentTarget();

        if (!target) {
          this.stateMachine.setState('patrol');
          return;
        }

        // 包抄模式 vs 直接追逐
        if (this.isFlankingMode && this.flankingTarget) {
          this._executeFlankingMove();
        } else {
          // 朝向目標移動（A* 尋路）
          this._moveTowardsTarget(target);
        }

        // 嘗試射擊（使用預測射擊）
        this._tryShootAtTargetWithPrediction(target);
      },

      exit: () => {
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

      update: () => {
        const target = this._getCurrentTarget();

        if (!target) {
          this.stateMachine.setState('patrol');
          return;
        }

        // 太近時先拉開距離（只對玩家；基地則直接靠近）
        // 注意順序：拉開距離與對齊會互搶方向，太近時以脫身優先
        const distance = Phaser.Math.Distance.Between(
          this.tank.x,
          this.tank.y,
          target.x,
          target.y
        );
        const tooClose = this.currentTarget === 'player' &&
          distance < this.attackIdealDistance - this.attackDistanceBuffer;

        if (tooClose) {
          this._moveAwayFromTarget(target);
          this._tryShootAtTargetWithPrediction(target);
          return;
        }

        // 對齊並射擊（使用預測）
        this._alignAndShootTargetWithPrediction(target);

        // 理想距離內停車射擊、太遠則逼近（只對玩家）
        if (this.currentTarget === 'player') {
          this._maintainDistance(target);
        }
      },

      exit: () => {
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

      update: () => {
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
      }
    });
  }

  /**
   * 更新 AI
   * 狀態機決定「移動意圖」（desiredDirection / wantsToMove）與射擊，
   * 統一移動出口只有這裡：避免多處呼叫 move() 互相覆蓋造成抖動
   * @param {number} delta - 時間差
   */
  update(delta) {
    if (this.tank.isFrozen) return;

    const currentTime = this.scene.time.now;

    // 更新黑板位置
    this._updateBlackboardPosition();

    // 視線檢測（節流）
    if (this.losEnabled && currentTime - this.lastLosCheck > this.losCheckInterval) {
      this._updateLineOfSight();
      this.lastLosCheck = currentTime;
    }

    // 定期評估狀態切換
    if (currentTime - this.lastStateChange > this.stateChangeCooldown) {
      this._evaluateState();
      this.lastStateChange = currentTime;
    }

    // 狀態行為：設定移動意圖並處理射擊
    this.wantsToMove = true;
    this.stateMachine.update(delta);

    // 檢測卡住（只在有移動意圖時評估）
    this._checkIfStuck(delta);

    // === 統一移動出口：只在這裡呼叫 move() / stop() ===
    if (this.wantsToMove) {
      this.tank.move(this.desiredDirection);

      // 轉角滑動輔助：貼齊通道中心線，減少卡牆角
      if (this.scene.applyCornerSlide) {
        this.scene.applyCornerSlide(this.tank, this.desiredDirection);
      }
    } else {
      // 停車射擊時仍要轉動砲口對準目標
      this.tank.face(this.desiredDirection);
      this.tank.stop();
    }
  }

  /**
   * 設定移動意圖（統一移動出口在 update() 中執行）
   * @param {string} direction - 方向
   * @private
   */
  _setMoveIntent(direction) {
    this.desiredDirection = direction;
    this.wantsToMove = true;
  }

  /**
   * 偶爾隨機換方向（巡邏漫遊用，增加不可預測性）
   * @private
   */
  _maybeRandomTurn() {
    const currentTime = this.scene.time.now;

    if (currentTime - this.lastRandomDirectionChange > this.randomDirectionInterval) {
      this.lastRandomDirectionChange = currentTime;

      if (Math.random() < 0.3) { // 30% 機率換方向
        this._setRandomDirection(currentTime);
      }
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
      GAME_CONFIG.TILE_SIZE,
      GAME_CONFIG.PLAY_OFFSET_Y
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
      // dx 和 dy 相近，優先維持當前軸向
      const currentDir = this.desiredDirection;
      if ((currentDir === 'left' || currentDir === 'right') && Math.abs(dx) > deadZone) {
        newDirection = dx > 0 ? 'right' : 'left';
      } else if ((currentDir === 'up' || currentDir === 'down') && Math.abs(dy) > deadZone) {
        newDirection = dy > 0 ? 'down' : 'up';
      } else {
        // 完全沒有偏好，選擇較大偏移的方向
        newDirection = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      }
    }

    this._setMoveIntent(newDirection);
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
      return;
    }

    // 計算首選方向（加入滯後效應防止抖動）
    let primaryDir, secondaryDir;
    const axisThreshold = 1.5;
    const currentDir = this.desiredDirection;

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
      this._setMoveIntent(primaryDir);
      return;
    }

    // 首選方向被阻擋，嘗試次要方向
    if (this._isDirectionSafe(secondaryDir)) {
      this._setMoveIntent(secondaryDir);
      return;
    }

    // 兩個方向都被阻擋，使用智能方向選擇
    const safeDir = this._chooseSafestDirection();
    if (safeDir) {
      this._setMoveIntent(safeDir);
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
    const offsetY = GAME_CONFIG.PLAY_OFFSET_Y;
    const vector = DIRECTION_VECTORS[direction];

    // 檢查前方一格的位置
    const checkX = this.tank.x + vector.x * tileSize;
    const checkY = this.tank.y + vector.y * tileSize;

    const gridX = Math.floor(checkX / tileSize);
    const gridY = Math.floor((checkY - offsetY) / tileSize);

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
      return;
    }

    // 反向方向被牆擋住時改走可行走方向，避免倒退撞牆
    if (!this._isDirectionSafe(newDir)) {
      const safeDir = this._chooseSafestDirection();
      if (safeDir) {
        newDir = safeDir;
      }
    }

    if (newDir !== this.desiredDirection) {
      this.lastDirectionChange = currentTime;
    }
    this._setMoveIntent(newDir);
  }

  /**
   * 保持與目標的距離（太近的情況由 attack 狀態先行處理）
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

    if (distance > this.attackIdealDistance + this.attackDistanceBuffer + 50) {
      // 太遠：維持當前方向逼近（不用複雜的路徑計算）
      this.wantsToMove = true;
    } else {
      // 在理想範圍內，停止移動專心射擊
      this.wantsToMove = false;
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
   * 決策以固定時間間隔進行，不隨畫面更新率改變
   * @private
   */
  _tryRandomShoot() {
    const currentTime = this.scene.time.now;

    if (currentTime - this.lastShot < this.tank.fireRate) {
      return;
    }

    if (currentTime - this.lastShootDecision < this.shootDecisionInterval) {
      return;
    }
    this.lastShootDecision = currentTime;

    // 每次決策 25% 機率射擊
    if (Math.random() < 0.25) {
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
    const offsetY = GAME_CONFIG.PLAY_OFFSET_Y;
    const map = this.scene.levelData.map;

    // 評估每個方向的安全性
    const directionScores = directions.map(dir => {
      const vector = DIRECTION_VECTORS[dir];

      // 檢查前方一格和兩格的位置
      const check1X = this.tank.x + vector.x * tileSize;
      const check1Y = this.tank.y + vector.y * tileSize;
      const check2X = this.tank.x + vector.x * tileSize * 2;
      const check2Y = this.tank.y + vector.y * tileSize * 2;

      // 轉換為格子坐標（扣除遊戲場 Y 偏移）
      const gridX1 = Math.floor(check1X / tileSize);
      const gridY1 = Math.floor((check1Y - offsetY) / tileSize);
      const gridX2 = Math.floor(check2X / tileSize);
      const gridY2 = Math.floor((check2Y - offsetY) / tileSize);

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
   * 檢測是否卡住（時間制）
   * 以固定時間窗口累計移動量，與預期移動距離比較，
   * 不受畫面更新率影響（幀數計數在高刷新率螢幕會誤判）
   * @param {number} delta - 距離上一幀的時間差（ms）
   * @private
   */
  _checkIfStuck(delta) {
    // 主動停車（攻擊狀態保持距離）不是卡住
    if (!this.wantsToMove) {
      this.stuckTime = 0;
      this.stuckTurned = false;
      this.stuckWindowTime = 0;
      this.stuckWindowDistance = 0;
      this.lastPosition.x = this.tank.x;
      this.lastPosition.y = this.tank.y;
      return;
    }

    // 累計本窗口的移動量
    const distance = Phaser.Math.Distance.Between(
      this.tank.x,
      this.tank.y,
      this.lastPosition.x,
      this.lastPosition.y
    );
    this.stuckWindowTime += delta;
    this.stuckWindowDistance += distance;
    this.lastPosition.x = this.tank.x;
    this.lastPosition.y = this.tank.y;

    // 窗口未滿，繼續累計
    if (this.stuckWindowTime < AI_CONFIG.STUCK_CHECK_INTERVAL) {
      return;
    }

    // 評估：實際移動量遠低於預期（速度 × 時間）即視為卡住
    const expectedDistance = this.tank.speed * (this.stuckWindowTime / 1000);
    const isStuck = this.stuckWindowDistance < expectedDistance * 0.25;

    if (isStuck) {
      this.stuckTime += this.stuckWindowTime;

      if (this.stuckTime >= AI_CONFIG.STUCK_ESCAPE_TIME) {
        // 嚴重卡住：強制對齊格子中心，仍失敗則搬移到最近可行走格
        if (!this._forceGridAlign()) {
          this._escapeToWalkablePosition();
        }
        this.currentPath = null;
        this.stuckTime = 0;
        this.stuckTurned = false;
      } else if (this.stuckTime >= AI_CONFIG.STUCK_TURN_TIME && !this.stuckTurned) {
        // 中度卡住：換一個可行走的方向
        this.desiredDirection = this._pickEscapeDirection();
        this.lastDirectionChange = this.scene.time.now;
        this.currentPath = null;
        this.stuckTurned = true;
      }
    } else {
      this.stuckTime = 0;
      this.stuckTurned = false;
    }

    // 重置評估窗口
    this.stuckWindowTime = 0;
    this.stuckWindowDistance = 0;
  }

  /**
   * 挑選脫困方向：優先可行走方向（排除目前方向），否則任一其他方向
   * @returns {string} 方向
   * @private
   */
  _pickEscapeDirection() {
    const map = this.scene.levelData?.map;
    const walkable = GridMovement.getAvailableDirections(this.tank, map)
      .filter(dir => dir !== this.desiredDirection);

    if (walkable.length > 0) {
      return Phaser.Utils.Array.GetRandom(walkable);
    }

    const others = ['up', 'down', 'left', 'right'].filter(dir => dir !== this.desiredDirection);
    return Phaser.Utils.Array.GetRandom(others);
  }

  // ========== 事件處理 ==========

  /**
   * 碰到牆壁時的處理
   * 換向前先檢查可行走性，避免在轉角選到另一面牆後被冷卻鎖住
   */
  onWallHit() {
    const currentTime = this.scene.time.now;

    // 防止高頻振盪：使用冷卻時間
    if (currentTime - this.lastDirectionChange < this.directionChangeCooldown) {
      return;
    }

    const map = this.scene.levelData?.map;
    const currentDir = this.desiredDirection;
    const perpendicular = (currentDir === 'up' || currentDir === 'down')
      ? ['left', 'right']
      : ['up', 'down'];

    // 優先：可行走的垂直方向；其次：任何可行走方向（排除原方向）；最後：隨機垂直方向
    let candidates = perpendicular.filter(dir =>
      GridMovement.canMoveInDirection(this.tank, dir, map)
    );

    if (candidates.length === 0) {
      candidates = GridMovement.getAvailableDirections(this.tank, map)
        .filter(dir => dir !== currentDir);
    }

    if (candidates.length === 0) {
      candidates = perpendicular;
    }

    // 只設定目標方向，不直接呼叫 move()
    this.desiredDirection = Phaser.Utils.Array.GetRandom(candidates);
    this.lastDirectionChange = currentTime;

    // 撞牆代表目前路徑已不可信，下次更新時重新計算
    this.currentPath = null;
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
   * 必須改 desiredDirection 才有效：直接呼叫 move() 會在同幀稍後
   * 被統一移動出口以 desiredDirection 覆蓋
   */
  onTankHit() {
    const currentTime = this.scene.time.now;

    if (currentTime - this.lastDirectionChange < this.directionChangeCooldown) {
      return;
    }

    this.desiredDirection = this._pickEscapeDirection();
    this.lastDirectionChange = currentTime;
    this.currentPath = null;
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
    const offsetY = GAME_CONFIG.PLAY_OFFSET_Y;

    // 轉換為格子坐標（扣除遊戲場 Y 偏移）
    const x0 = Math.floor(from.x / tileSize);
    const y0 = Math.floor((from.y - offsetY) / tileSize);
    const x1 = Math.floor(to.x / tileSize);
    const y1 = Math.floor((to.y - offsetY) / tileSize);

    // Bresenham 直線演算法
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;

    let x = x0;
    let y = y0;

    // 步數上限 = 棋盤距離，保證迴圈有界
    const maxSteps = dx + dy + 1;

    for (let step = 0; step < maxSteps; step++) {
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
      // 垂直對齊，面向目標
      const newDir = dy > 0 ? 'down' : 'up';
      if (newDir !== this.desiredDirection) {
        this.lastDirectionChange = currentTime;
      }
      this._setMoveIntent(newDir);
    } else if (Math.abs(dy) < tolerance) {
      // 水平對齊
      const newDir = dx > 0 ? 'right' : 'left';
      if (newDir !== this.desiredDirection) {
        this.lastDirectionChange = currentTime;
      }
      this._setMoveIntent(newDir);
    }
    // 未對齊時維持當前移動意圖，邊走邊嘗試射擊

    this._tryShootAtTargetWithPrediction(target);
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
    const playHeight = GAME_CONFIG.PLAY_HEIGHT;
    const offsetY = GAME_CONFIG.PLAY_OFFSET_Y;
    const maxAttempts = 30;

    // 嘗試生成可行走的隨機位置（限制於遊戲場範圍內，避免進入 HUD）
    for (let i = 0; i < maxAttempts; i++) {
      const candidate = {
        x: margin + Math.random() * (width - 2 * margin),
        y: offsetY + margin + Math.random() * (playHeight - 2 * margin)
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
    const offsetY = GAME_CONFIG.PLAY_OFFSET_Y;
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
      const gridY = Math.floor((point.y - offsetY) / tileSize);

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

  /**
   * 清理資源（當敵人被銷毀時調用）
   */
  destroy() {
    this.unregisterFromBlackboard();
  }
}
