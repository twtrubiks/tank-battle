/**
 * 敵人 AI 控制器
 * 使用狀態機實現 4 種行為：巡邏、追逐、攻擊、撤退
 */

import Phaser from 'phaser';
import StateMachine from '../utils/StateMachine';
import AStar from '../utils/AStar';
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

    // 移動相關
    this.stuckCounter = 0;
    this.lastPosition = { x: tank.x, y: tank.y };
    this.wallHitCounter = 0;  // 連續撞牆計數
    this.lastWallHitTime = 0; // 上次撞牆時間

    // 卡住位置記憶（避免重複進入同一個卡住位置）
    this.stuckPositions = []; // 儲存最近卡住的位置
    this.stuckPositionMemorySize = 5; // 記住最近 5 個卡住位置
    this.stuckPositionRadius = 50; // 50 像素範圍內視為同一位置

    // 方向穩定化機制（防止高頻振盪）
    this.lastDirectionChange = 0; // 上次改變方向的時間
    this.directionChangeDelay = 150; // 150ms 內不允許再次改變方向

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

    // 初始化狀態
    this._initializeStates();
    this.stateMachine.setState('patrol');
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
        // 開始巡邏
      },

      update: (delta) => {
        // 隨機移動
        if (Math.random() < 0.02) {
          const directions = ['up', 'down', 'left', 'right'];
          const randomDirection = Phaser.Utils.Array.GetRandom(directions);
          this.tank.move(randomDirection);
        }

        // 隨機射擊
        this._tryRandomShoot();
      },

      exit: () => {
        // 離開巡邏狀態
      }
    });

    // ===== 追逐狀態 =====
    this.stateMachine.addState('chase', {
      enter: () => {
        // 開始追逐
      },

      update: (delta) => {
        const target = this._getCurrentTarget();

        if (!target) {
          this.stateMachine.setState('patrol');
          return;
        }

        // 朝向目標移動
        this._moveTowardsTarget(target);

        // 嘗試射擊
        this._tryShootAtTarget(target);
      },

      exit: () => {
        this.tank.stop();
      }
    });

    // ===== 攻擊狀態 =====
    this.stateMachine.addState('attack', {
      enter: () => {
        // 開始攻擊
      },

      update: (delta) => {
        const target = this._getCurrentTarget();

        if (!target) {
          this.stateMachine.setState('patrol');
          return;
        }

        // 對齊並射擊
        this._alignAndShootTarget(target);

        // 保持距離（只對玩家保持距離，基地則直接靠近）
        if (this.currentTarget === 'player') {
          this._maintainDistance(target);
        }
      },

      exit: () => {
        this.tank.stop();
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
   * 更新 AI
   * @param {number} delta - 時間差
   */
  update(delta) {
    if (this.tank.isFrozen) return;

    const currentTime = this.scene.time.now;

    // 定期評估狀態切換
    if (currentTime - this.lastStateChange > this.stateChangeCooldown) {
      this._evaluateState();
      this.lastStateChange = currentTime;
    }

    // 更新當前狀態
    this.stateMachine.update(delta);

    // 檢測卡住
    this._checkIfStuck();
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

    // 選擇移動方向
    if (Math.abs(dx) > Math.abs(dy)) {
      this.tank.move(dx > 0 ? 'right' : 'left');
    } else {
      this.tank.move(dy > 0 ? 'down' : 'up');
    }
  }

  /**
   * 直線移動到目標（後備方案）
   * @param {Object} target - 目標對象
   * @private
   */
  _moveDirectly(target) {
    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      this.tank.move(dx > 0 ? 'right' : 'left');
    } else {
      this.tank.move(dy > 0 ? 'down' : 'up');
    }
  }

  /**
   * 遠離目標移動
   * @param {Object} target - 目標對象
   * @private
   */
  _moveAwayFromTarget(target) {
    // 清除追逐路徑
    this.currentPath = null;

    const dx = target.x - this.tank.x;
    const dy = target.y - this.tank.y;

    // 反向移動
    if (Math.abs(dx) > Math.abs(dy)) {
      this.tank.move(dx > 0 ? 'left' : 'right');
    } else {
      this.tank.move(dy > 0 ? 'up' : 'down');
    }
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

    if (distance < idealDistance) {
      this._moveAwayFromTarget(target);
    } else if (distance > idealDistance + 50) {
      this._moveTowardsTarget(target);
    } else {
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
   * 檢測是否卡住（分級檢測系統）
   * @private
   */
  _checkIfStuck() {
    // 只在移動狀態（chase, patrol）時檢測卡住
    // 在 attack 或 retreat 狀態時不檢測（這些狀態下可能會原地不動射擊）
    const currentState = this.stateMachine.currentState;
    if (currentState !== 'chase' && currentState !== 'patrol') {
      this.stuckCounter = 0;
      return;
    }

    // 計算位移距離
    const distance = Phaser.Math.Distance.Between(
      this.tank.x,
      this.tank.y,
      this.lastPosition.x,
      this.lastPosition.y
    );

    // 檢測當前速度（Phaser 物理引擎）
    const currentVelocity = Math.sqrt(
      this.tank.body.velocity.x ** 2 + this.tank.body.velocity.y ** 2
    );

    // 如果移動距離很小或速度接近 0，增加卡住計數
    if (distance < AI_CONFIG.STUCK_DISTANCE || currentVelocity < AI_CONFIG.STUCK_VELOCITY_THRESHOLD) {
      this.stuckCounter++;

      // 檢查是否接近之前卡住的位置，如果是則加速響應
      const nearPreviousStuckPosition = this._isNearStuckPosition();
      if (nearPreviousStuckPosition && this.stuckCounter > AI_CONFIG.STUCK_THRESHOLD_LIGHT) {
        // 如果接近之前卡住的位置，提前觸發逃脫
        this.currentPath = null;
        const allDirections = ['up', 'down', 'left', 'right'];
        const validDirections = allDirections.filter(dir => dir !== this.tank.direction);
        const newDirection = Phaser.Utils.Array.GetRandom(validDirections);
        this.tank.move(newDirection);
        this.stuckCounter = 0;
        return;
      }

      // 分級響應系統
      if (this.stuckCounter >= AI_CONFIG.STUCK_THRESHOLD_SEVERE) {
        // === 嚴重卡住（90 幀 / 1.5 秒）：隨機方向逃脫 ===
        this.currentPath = null;
        this._recordStuckPosition(); // 記錄卡住位置
        const allDirections = ['up', 'down', 'left', 'right'];
        const validDirections = allDirections.filter(dir => dir !== this.tank.direction);
        const newDirection = Phaser.Utils.Array.GetRandom(validDirections);
        this.tank.move(newDirection);
        this.stuckCounter = 0;

      } else if (this.stuckCounter >= AI_CONFIG.STUCK_THRESHOLD_MEDIUM) {
        // === 中度卡住（60 幀 / 1.0 秒）：智能選擇新方向 ===
        // 每 10 幀嘗試一次，避免過於頻繁
        if (this.stuckCounter % 10 === 0) {
          this.currentPath = null;
          const newDirection = this._chooseSafestDirection();
          if (newDirection) {
            this.tank.move(newDirection);
          }
        }

      } else if (this.stuckCounter >= AI_CONFIG.STUCK_THRESHOLD_LIGHT) {
        // === 輕微卡住（30 幀 / 0.5 秒）：強制路徑重算 ===
        // 每 15 幀嘗試一次
        if (this.stuckCounter % 15 === 0) {
          this.currentPath = null;
          this.lastPathUpdate = 0; // 立即觸發路徑重算
        }
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
   * 碰到牆壁時的處理（改進版）
   */
  onWallHit() {
    const currentTime = this.scene.time.now;

    // === 方向穩定化檢查：防止高頻振盪 ===
    if (currentTime - this.lastDirectionChange < this.directionChangeDelay) {
      // 距離上次方向改變太近，忽略此次碰撞
      return;
    }

    // 檢查撞牆頻率（防止快速循環）
    const timeSinceLastHit = currentTime - this.lastWallHitTime;

    // 如果距離上次撞牆很近（< 100ms），增加計數器
    if (timeSinceLastHit < 100) {
      this.wallHitCounter++;
    } else {
      // 重置計數器
      this.wallHitCounter = 1;
    }

    this.lastWallHitTime = currentTime;

    // 清除當前路徑
    this.currentPath = null;

    // 如果連續撞牆次數過多（降低閾值從 5 到 3），說明卡在角落
    if (this.wallHitCounter > 3) {
      // === 角落逃脫策略：後退-轉向 ===
      this._recordStuckPosition(); // 記錄角落位置

      // 1. 先反向後退一小段距離
      const oppositeDirections = {
        'up': 'down',
        'down': 'up',
        'left': 'right',
        'right': 'left'
      };
      const backwardDirection = oppositeDirections[this.tank.direction];

      // 後退短暫時間
      this.tank.move(backwardDirection);

      // 記錄方向改變時間
      this.lastDirectionChange = currentTime;

      // 使用延遲來實現後退後轉向
      this.scene.time.delayedCall(200, () => {
        // 2. 然後選擇隨機新方向（排除當前和相反方向）
        const allDirections = ['up', 'down', 'left', 'right'];
        const validDirections = allDirections.filter(
          dir => dir !== this.tank.direction && dir !== backwardDirection
        );
        if (validDirections.length > 0) {
          const newDirection = Phaser.Utils.Array.GetRandom(validDirections);
          this.tank.move(newDirection);
          this.lastDirectionChange = this.scene.time.now; // 更新時間
        }
      });

      // 延遲路徑更新，給時間逃離角落
      this.lastPathUpdate = currentTime - 300; // 0.7秒後才會重新計算路徑

      // 重置計數器
      this.wallHitCounter = 0;
    } else {
      // 正常情況：使用智能方向選擇
      const newDirection = this._chooseSafestDirection();
      if (newDirection) {
        this.tank.move(newDirection);
        this.lastDirectionChange = currentTime; // 記錄方向改變時間
      }

      // 不要立即重置路徑更新時間，給當前移動一些時間
      this.lastPathUpdate = currentTime - 700; // 0.3秒後才會重新計算路徑
    }
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
}
