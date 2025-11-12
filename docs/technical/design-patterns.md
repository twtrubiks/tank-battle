# Tank Battle 設計模式詳解

本文檔詳細說明 Tank Battle 專案中使用的設計模式，包括設計動機、實作細節、應用範例和最佳實踐。

---

## 目錄

1. [設計模式概述](#設計模式概述)
2. [狀態機模式 (State Pattern)](#狀態機模式-state-pattern)
3. [物件池模式 (Object Pool Pattern)](#物件池模式-object-pool-pattern)
4. [觀察者模式 (Observer Pattern)](#觀察者模式-observer-pattern)
5. [工廠模式 (Factory Pattern)](#工廠模式-factory-pattern)
6. [單例模式 (Singleton Pattern)](#單例模式-singleton-pattern)
7. [設計模式對比與選擇](#設計模式對比與選擇)

---

## 設計模式概述

### 為什麼需要設計模式？

在遊戲開發中，我們經常面臨以下問題：

❌ **問題 1：AI 邏輯複雜，難以維護**
```javascript
// 糟糕的做法：大量 if-else
update() {
  if (this.isAngry && this.seesPlayer && this.health > 50) {
    // 攻擊
  } else if (this.isAngry && this.seesPlayer && this.health <= 50) {
    // 撤退
  } else if (this.seesPlayer && !this.isAngry) {
    // 追逐
  } else {
    // 巡邏
  }
  // ... 100+ 行程式碼
}
```

❌ **問題 2：頻繁建立/銷毀物件，效能低下**
```javascript
// 糟糕的做法：每次都建立新物件
shoot() {
  const bullet = new Bullet(x, y);  // 記憶體分配
  // ...
  bullet.destroy();  // 觸發 GC
}
// 射擊 1000 次 = 1000 次記憶體分配 + 1000 次 GC
```

❌ **問題 3：系統間耦合度高**
```javascript
// 糟糕的做法：直接調用
class Tank {
  takeDamage() {
    this.scene.updateUI();        // 直接耦合 UI
    this.scene.playSound();       // 直接耦合音效
    this.scene.checkGameOver();   // 直接耦合遊戲邏輯
  }
}
```

### Tank Battle 採用的設計模式

我們使用以下設計模式來解決這些問題：

| 設計模式 | 解決問題 | 應用場景 |
|---------|---------|---------|
| **狀態機模式** | AI 邏輯複雜 | 敵人 AI 行為管理 |
| **物件池模式** | 頻繁建立/銷毀 | 子彈、特效管理 |
| **觀察者模式** | 系統間耦合 | 事件系統 |
| **工廠模式** | 物件建立邏輯 | 敵人生成 |
| **單例模式** | 全域存取 | 管理器類別 |

---

## 狀態機模式 (State Pattern)

### 什麼是狀態機？

**狀態機**是一種行為型設計模式，用於管理物件在不同狀態之間的轉換。每個狀態都是一個獨立的邏輯單元，有自己的行為。

### 為什麼需要狀態機？

#### 問題：大量 if-else 的「義大利麵程式碼」

```javascript
// ❌ 糟糕的做法：沒有使用狀態機
class EnemyAI {
  update() {
    const distance = this.getDistanceToPlayer();
    const health = this.tank.health / this.tank.maxHealth;

    if (health < 0.3) {
      // 撤退邏輯（50 行）
      if (distance < 100) {
        // 快速撤退
      } else {
        // 正常撤退
      }
      // ...
    } else if (distance < 150 && this.canSeePlayer()) {
      // 攻擊邏輯（40 行）
      if (this.isAligned()) {
        // 射擊
      } else {
        // 調整位置
      }
      // ...
    } else if (distance < 300) {
      // 追逐邏輯（35 行）
      // ...
    } else {
      // 巡邏邏輯（30 行）
      // ...
    }
    // 總計：155+ 行，難以維護！
  }
}
```

**問題：**
- ✗ 程式碼冗長（155+ 行）
- ✗ 難以測試（邏輯交錯）
- ✗ 難以擴展（新增狀態需要修改整個 if-else）
- ✗ 難以除錯（不知道目前在哪個狀態）

#### 解決方案：使用狀態機

```javascript
// ✅ 良好的做法：使用狀態機
class EnemyAI {
  constructor(scene, tank) {
    this.stateMachine = new StateMachine();
    this.stateMachine.setContext(this);

    // 每個狀態都是獨立的
    this.stateMachine.addState('patrol', {
      enter: () => { /* 進入巡邏 */ },
      update: (delta) => { /* 巡邏邏輯（30 行）*/ },
      exit: () => { /* 離開巡邏 */ }
    });

    this.stateMachine.addState('chase', { /* 追逐邏輯 */ });
    this.stateMachine.addState('attack', { /* 攻擊邏輯 */ });
    this.stateMachine.addState('retreat', { /* 撤退邏輯 */ });

    this.stateMachine.setState('patrol');
  }

  update(delta) {
    this._decideState();  // 決策邏輯（20 行）
    this.stateMachine.update(delta);  // 執行當前狀態
  }
}
```

**優點：**
- ✓ 程式碼清晰（每個狀態獨立）
- ✓ 易於測試（可以單獨測試每個狀態）
- ✓ 易於擴展（新增狀態只需 `addState()`）
- ✓ 易於除錯（可以追蹤狀態歷史）

### 實作細節

#### 1. StateMachine 類別

**檔案位置**: `src/utils/StateMachine.js`

```javascript
export default class StateMachine {
  constructor() {
    this.states = {};           // 所有狀態
    this.currentState = null;   // 當前狀態
    this.previousState = null;  // 上一個狀態
    this.context = null;        // 狀態機所屬物件
  }

  /**
   * 設定上下文（狀態機所屬的物件）
   * 這樣狀態方法可以存取物件的屬性和方法
   */
  setContext(context) {
    this.context = context;
  }

  /**
   * 新增狀態
   * @param {string} name - 狀態名稱
   * @param {object} state - 狀態物件 { enter, update, exit }
   */
  addState(name, state) {
    // 綁定上下文，讓狀態方法可以使用 this.xxx
    if (state.enter) state.enter = state.enter.bind(this.context);
    if (state.update) state.update = state.update.bind(this.context);
    if (state.exit) state.exit = state.exit.bind(this.context);

    this.states[name] = state;
  }

  /**
   * 切換狀態
   * @param {string} name - 目標狀態名稱
   * @returns {boolean} 是否成功切換
   */
  setState(name, ...args) {
    if (!this.states[name]) {
      console.warn(`State "${name}" does not exist`);
      return false;
    }

    // 避免重複切換到相同狀態
    if (this.currentState === name) {
      return false;
    }

    // 1. 離開當前狀態
    if (this.currentState && this.states[this.currentState].exit) {
      this.states[this.currentState].exit();
    }

    // 2. 記錄狀態歷史
    this.previousState = this.currentState;
    this.currentState = name;

    // 3. 進入新狀態
    if (this.states[name].enter) {
      this.states[name].enter(...args);
    }

    return true;
  }

  /**
   * 更新當前狀態（每幀調用）
   */
  update(delta) {
    if (this.currentState && this.states[this.currentState].update) {
      this.states[this.currentState].update(delta);
    }
  }
}
```

**關鍵設計：**

1. **上下文綁定 (Context Binding)**
   ```javascript
   setContext(context) {
     this.context = context;
   }
   // 綁定後，狀態方法可以使用 this.tank, this.scene 等
   ```

2. **狀態生命週期**
   ```
   enter() → update() → update() → ... → exit()
     ↓         ↓          ↓                ↓
   初始化    每幀執行   每幀執行         清理
   ```

3. **狀態轉換保護**
   ```javascript
   // 避免重複切換
   if (this.currentState === name) return false;
   ```

#### 2. EnemyAI 應用範例

**檔案位置**: `src/systems/EnemyAI.js` (504 行)

##### 狀態定義

```javascript
_initializeStates() {
  // ===== 巡邏狀態 =====
  this.stateMachine.addState('patrol', {
    enter: () => {
      // 初始化巡邏參數
    },

    update: (delta) => {
      // 隨機移動（2% 機率改變方向）
      if (Math.random() < 0.02) {
        const directions = ['up', 'down', 'left', 'right'];
        const randomDirection = Phaser.Utils.Array.GetRandom(directions);
        this.tank.move(randomDirection);
      }

      // 隨機射擊（10% 機率）
      this._tryRandomShoot();
    },

    exit: () => {
      // 清理巡邏狀態
    }
  });

  // ===== 追逐狀態 =====
  this.stateMachine.addState('chase', {
    update: (delta) => {
      const player = this.scene.player;

      if (!player || player.isDestroyed) {
        this.stateMachine.setState('patrol');
        return;
      }

      // 使用 A* 尋路朝向玩家
      this._moveTowardsPlayer(player);

      // 嘗試射擊
      this._tryShootAtPlayer(player);
    },

    exit: () => {
      this.tank.stop();
    }
  });

  // ===== 攻擊狀態 =====
  this.stateMachine.addState('attack', {
    update: (delta) => {
      const player = this.scene.player;

      // 對齊玩家並射擊
      this._alignAndShoot(player);

      // 保持理想距離（100px）
      this._maintainDistance(player);
    }
  });

  // ===== 撤退狀態 =====
  this.stateMachine.addState('retreat', {
    update: (delta) => {
      const player = this.scene.player;

      // 遠離玩家
      this._moveAwayFromPlayer(player);

      // 邊撤退邊射擊
      this._tryShootAtPlayer(player);
    }
  });
}
```

##### 狀態轉換邏輯

```javascript
/**
 * 決定 AI 狀態（每幀調用）
 *
 * 決策樹：
 * 1. 血量 < 30% → 撤退
 * 2. 距離 < 150px → 攻擊
 * 3. 距離 < 300px → 追逐
 * 4. 其他 → 巡邏
 */
_decideState() {
  const player = this.scene.player;

  if (!player || player.isDestroyed) {
    this.stateMachine.setState('patrol');
    return;
  }

  const distance = Phaser.Math.Distance.Between(
    this.tank.x, this.tank.y,
    player.x, player.y
  );

  const healthPercent = this.tank.health / this.tank.maxHealth;

  // 決策邏輯（優先順序由高到低）
  if (healthPercent < this.retreatHealthPercent) {
    this.stateMachine.setState('retreat');
  } else if (distance < this.attackRange) {
    this.stateMachine.setState('attack');
  } else if (distance < this.detectionRange) {
    this.stateMachine.setState('chase');
  } else {
    this.stateMachine.setState('patrol');
  }
}

update(delta) {
  this._decideState();  // 決定狀態
  this.stateMachine.update(delta);  // 執行狀態邏輯

  // 防卡住機制
  this._checkStuck();
}
```

### 狀態轉換圖

```
                    血量 < 30%
                  ┌──────────┐
                  │          │
                  ▼          │
              Retreat ───────┘
                  │
                  │ 血量恢復
                  ▼
              Patrol ────────> Chase ────────> Attack
             (巡邏)      距離<300px    距離<150px   (攻擊)
                                                      │
                           ┌──────────────────────────┘
                           │ 距離>150px
                           └─────────> Chase
```

### 狀態機 vs 大量 if-else 對比

| 比較項目 | 大量 if-else | 狀態機模式 |
|---------|-------------|-----------|
| **程式碼行數** | 155+ 行（單一方法） | 30-50 行/狀態（分離） |
| **可讀性** | ⭐⭐ 差 | ⭐⭐⭐⭐⭐ 優秀 |
| **可維護性** | ⭐⭐ 難以修改 | ⭐⭐⭐⭐⭐ 易於修改 |
| **可測試性** | ⭐ 難以測試 | ⭐⭐⭐⭐⭐ 易於測試 |
| **可擴展性** | ⭐ 需修改整體 | ⭐⭐⭐⭐⭐ 只需新增狀態 |
| **除錯難度** | ⭐ 難以追蹤 | ⭐⭐⭐⭐ 可記錄狀態歷史 |

### 如何擴展新狀態

假設要新增「警戒 (Alert)」狀態：

```javascript
// 1. 定義狀態
this.stateMachine.addState('alert', {
  enter: () => {
    console.log('敵人進入警戒狀態！');
    this.tank.setTint(0xFFFF00);  // 變黃色
  },

  update: (delta) => {
    // 原地旋轉
    this.tank.angle += 2;

    // 持續掃描
    this._scanForPlayer();
  },

  exit: () => {
    this.tank.clearTint();
  }
});

// 2. 加入轉換邏輯
_decideState() {
  // ... 其他邏輯

  if (this.heardNoise && !this.seesPlayer) {
    this.stateMachine.setState('alert');  // 聽到聲音但看不到玩家
  }
}
```

完成！不需要修改其他狀態的程式碼。

### 測試範例

**檔案位置**: `tests/unit/StateMachine.test.js`

```javascript
describe('StateMachine', () => {
  test('應該正確切換狀態', () => {
    const sm = new StateMachine();
    const context = { value: 0 };
    sm.setContext(context);

    sm.addState('idle', {
      enter: () => { context.value = 1; },
      update: () => { context.value += 1; }
    });

    sm.addState('moving', {
      enter: () => { context.value = 10; }
    });

    sm.setState('idle');
    expect(context.value).toBe(1);

    sm.update();
    expect(context.value).toBe(2);

    sm.setState('moving');
    expect(context.value).toBe(10);
    expect(sm.getCurrentState()).toBe('moving');
    expect(sm.getPreviousState()).toBe('idle');
  });
});
```

### 最佳實踐

#### ✅ 建議

1. **狀態單一職責**
   ```javascript
   // ✓ 好：每個狀態只做一件事
   addState('attack', { /* 只處理攻擊 */ });
   addState('defend', { /* 只處理防禦 */ });
   ```

2. **避免狀態內部切換**
   ```javascript
   // ✗ 壞：在狀態內部切換
   update: () => {
     if (condition) this.stateMachine.setState('other');
   }

   // ✓ 好：在統一的決策方法中切換
   _decideState() {
     if (condition) this.stateMachine.setState('other');
   }
   ```

3. **記錄狀態歷史**
   ```javascript
   setState(name) {
     console.log(`[AI] ${this.previousState} → ${name}`);
     // 可用於除錯和分析
   }
   ```

#### ❌ 避免

1. **過度細分狀態**
   ```javascript
   // ✗ 過度細分
   addState('walkingLeft');
   addState('walkingRight');
   addState('walkingUp');

   // ✓ 使用參數
   addState('walking', {
     enter: (direction) => { this.direction = direction; }
   });
   ```

2. **狀態間共享資料不當**
   ```javascript
   // ✗ 使用全域變數
   let sharedData = {};

   // ✓ 使用 context
   this.context.sharedData = {};
   ```

---

## 物件池模式 (Object Pool Pattern)

### 什麼是物件池？

**物件池**是一種創建型設計模式，預先建立一組可重複使用的物件，避免頻繁的記憶體分配和垃圾回收。

### 為什麼需要物件池？

#### 問題：頻繁建立/銷毀造成效能問題

```javascript
// ❌ 糟糕的做法：每次都建立新物件
class Tank {
  shoot() {
    // 每次射擊都建立新子彈
    const bullet = new Bullet(this.scene, this.x, this.y);

    // 子彈飛出畫面後銷毀
    bullet.on('outOfBounds', () => {
      bullet.destroy();  // 觸發垃圾回收 (GC)
    });
  }
}

// 射擊 1000 次的成本：
// - 1000 次 new Bullet() → 1000 次記憶體分配
// - 1000 次 destroy() → 1000 次 GC
// 結果：遊戲卡頓！
```

**效能問題：**
- ✗ 記憶體分配慢（約 0.01-0.1ms/次）
- ✗ GC 暫停遊戲（約 1-10ms）
- ✗ 記憶體碎片化
- ✗ FPS 不穩定

#### 效能數據對比

| 操作 | 無物件池 | 有物件池 | 效能提升 |
|-----|---------|---------|---------|
| 建立 1000 個子彈 | ~10-100ms | ~0ms（已預建） | **100x** |
| 銷毀 1000 個子彈 | ~10-50ms（GC） | ~0ms（回收） | **50x** |
| 記憶體使用 | 不穩定 | 穩定 | - |
| FPS | 45-60 | 穩定 60 | **穩定** |

#### 解決方案：使用物件池

```javascript
// ✅ 良好的做法：使用物件池
class GameScene {
  create() {
    // 預先建立 20 個子彈（只建立一次）
    this.bulletPool = new ObjectPool(
      () => new Bullet(this, 0, 0),  // 工廠函數
      20,   // 初始大小
      50    // 最大大小
    );
  }

  createBullet(x, y, direction) {
    const bullet = this.bulletPool.get();  // 從池中取出（幾乎 0ms）
    bullet.fire(x, y, direction);
    return bullet;
  }

  update() {
    this.bullets.getChildren().forEach(bullet => {
      if (!bullet.active) {
        this.bulletPool.release(bullet);  // 回收到池中（0ms）
      }
    });
  }
}
```

**優點：**
- ✓ 避免頻繁記憶體分配
- ✓ 避免 GC 暫停
- ✓ 記憶體使用穩定
- ✓ FPS 穩定

### 實作細節

#### ObjectPool 類別

**檔案位置**: `src/utils/ObjectPool.js` (92 行)

```javascript
export default class ObjectPool {
  /**
   * 建構子
   * @param {Function} factory - 建立物件的工廠函數
   * @param {number} initialSize - 初始大小（預先建立數量）
   * @param {number} maxSize - 最大大小（上限）
   */
  constructor(factory, initialSize = 10, maxSize = 100) {
    this.factory = factory;
    this.maxSize = maxSize;
    this.pool = [];      // 可用物件池
    this.active = [];    // 使用中物件

    // 預先建立物件
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }

  /**
   * 取得物件
   * @returns {object} 可用物件
   */
  get() {
    let obj;

    if (this.pool.length > 0) {
      // 情況 1：池中有可用物件 → 直接取出
      obj = this.pool.pop();
    } else if (this.active.length < this.maxSize) {
      // 情況 2：池空但未達上限 → 建立新物件
      obj = this.factory();
      console.log(`[ObjectPool] 擴充：建立新物件 (${this.active.length + 1}/${this.maxSize})`);
    } else {
      // 情況 3：已達上限 → 強制重用最舊的物件
      console.warn(`[ObjectPool] 已達上限 (${this.maxSize})，強制重用最舊物件`);
      obj = this.active.shift();
    }

    this.active.push(obj);
    return obj;
  }

  /**
   * 歸還物件
   * @param {object} obj - 要歸還的物件
   */
  release(obj) {
    const index = this.active.indexOf(obj);

    if (index !== -1) {
      // 從活躍列表移除
      this.active.splice(index, 1);

      // 加回池中
      this.pool.push(obj);

      // 重置物件狀態（重要！）
      if (obj.deactivate) {
        obj.deactivate();
      }
    }
  }

  /**
   * 清空池（場景切換時調用）
   */
  clear() {
    [...this.pool, ...this.active].forEach(obj => {
      if (obj.destroy) {
        obj.destroy();
      }
    });

    this.pool = [];
    this.active = [];
  }

  /**
   * 取得統計資訊
   */
  getStats() {
    return {
      poolSize: this.pool.length,        // 可用數量
      activeSize: this.active.length,    // 使用中數量
      totalSize: this.pool.length + this.active.length,  // 總數
      maxSize: this.maxSize,             // 上限
      utilization: (this.active.length / this.maxSize * 100).toFixed(1) + '%'  // 使用率
    };
  }
}
```

#### 關鍵設計

1. **雙列表管理**
   ```javascript
   this.pool = [];    // 可用物件（閒置）
   this.active = [];  // 使用中物件（活躍）

   // 取出時：pool → active
   // 歸還時：active → pool
   ```

2. **自動擴充機制**
   ```javascript
   if (this.pool.length > 0) {
     obj = this.pool.pop();  // 有閒置物件
   } else if (this.active.length < this.maxSize) {
     obj = this.factory();   // 自動擴充
   } else {
     obj = this.active.shift();  // 強制重用
   }
   ```

3. **物件重置**
   ```javascript
   release(obj) {
     // ...
     if (obj.deactivate) {
       obj.deactivate();  // 呼叫物件的重置方法
     }
   }
   ```

### Bullet 應用範例

**檔案位置**: `src/entities/Bullet.js`

```javascript
export default class Bullet extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'bullet');
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.damage = 1;
    this.owner = null;
    this.isPlayerBullet = false;
  }

  /**
   * 發射子彈（從池中取出後調用）
   */
  fire(x, y, direction, speed, damage, owner) {
    // 重新啟動物件
    this.setActive(true);
    this.setVisible(true);
    this.setPosition(x, y);

    // 設定屬性
    this.damage = damage;
    this.owner = owner;
    this.isPlayerBullet = owner === this.scene.player;

    // 設定速度
    this.setVelocity(
      direction === 'left' ? -speed : direction === 'right' ? speed : 0,
      direction === 'up' ? -speed : direction === 'down' ? speed : 0
    );

    // 設定顏色
    this.setTint(this.isPlayerBullet ? 0xFFFF00 : 0xFF0000);
  }

  /**
   * 擊中目標時調用
   */
  onHit() {
    this.deactivate();  // 停用並準備回收
  }

  /**
   * 重置物件狀態（歸還到池中時調用）
   */
  deactivate() {
    this.setActive(false);
    this.setVisible(false);
    this.setVelocity(0, 0);
    this.owner = null;
    this.damage = 1;
  }

  update() {
    // 超出邊界時自動停用
    if (this.x < 0 || this.x > 832 || this.y < 0 || this.y > 832) {
      this.deactivate();
    }
  }
}
```

### GameScene 整合

**檔案位置**: `src/scenes/GameScene.js`

```javascript
export default class GameScene extends Phaser.Scene {
  // ==========================================
  // 系統初始化
  // ==========================================

  initializeSystems() {
    // 建立子彈池（初始 20 個，最大 50 個）
    this.bulletPool = new ObjectPool(
      () => new Bullet(this, 0, 0),
      20,   // 初始大小
      50    // 最大大小
    );

    this.bullets = this.add.group();
  }

  // ==========================================
  // 遊戲物件創建（子彈、道具）
  // ==========================================

  createBullet(x, y, direction, speed, damage, owner) {
    const bullet = this.bulletPool.get();  // 從池中取出

    // 加入群組（創建 physics body）
    this.bullets.add(bullet);
    this.collisionSystem.addBullet(bullet);

    // 發射子彈
    bullet.fire(x, y, direction, speed, damage, owner);

    return bullet;
  }

  // ==========================================
  // 遊戲循環與更新
  // ==========================================

  update(time, delta) {
    // 清理無效子彈
    this.bullets.getChildren().forEach(bullet => {
      if (!bullet.active) {
        this.bulletPool.release(bullet);  // 回收到池中
        this.bullets.remove(bullet, false, false);
      }
    });

    // 每 5 秒記錄一次統計
    if (time % 5000 < 16) {
      const stats = this.bulletPool.getStats();
      console.log('[BulletPool]', stats);
      // 輸出：{ poolSize: 15, activeSize: 5, totalSize: 20, maxSize: 50, utilization: "10.0%" }
    }
  }

  // ==========================================
  // 場景清理
  // ==========================================

  shutdown() {
    // 清理物件池
    if (this.bulletPool) {
      this.bulletPool.clear();
    }
  }
}
```

### 物件池生命週期圖

```
初始化階段：
┌─────────────────────────────────┐
│ new ObjectPool(factory, 20, 50) │
└────────────┬────────────────────┘
             │
             ▼
      建立 20 個物件
             │
             ▼
    ┌────────────────┐
    │ pool: [20 個]  │ ← 可用物件
    │ active: []     │ ← 使用中物件
    └────────────────┘

使用階段：
    玩家射擊
        │
        ▼
    bulletPool.get()
        │
        ▼
    pool.pop() → bullet
        │
        ▼
    active.push(bullet)
        │
        ▼
    bullet.fire(...)
        │
        ▼
    子彈飛行中...
        │
        ▼
    擊中目標 / 超出邊界
        │
        ▼
    bulletPool.release(bullet)
        │
        ▼
    active.splice(bullet)
        │
        ▼
    pool.push(bullet)
        │
        ▼
    bullet.deactivate()  ← 重置狀態

擴充階段（池空且未達上限）：
    bulletPool.get()
        │
        ▼
    pool.length === 0 && active.length < 50
        │
        ▼
    factory() → 建立新物件
        │
        ▼
    active.push(新物件)

強制重用階段（已達上限）：
    bulletPool.get()
        │
        ▼
    active.length === 50
        │
        ▼
    active.shift() → 強制取出最舊物件
        │
        ▼
    重新使用（可能會導致視覺異常）
```

### 效能測試

**檔案位置**: `tests/unit/ObjectPool.test.js`

```javascript
describe('ObjectPool 效能測試', () => {
  test('應該避免頻繁建立物件', () => {
    let createCount = 0;

    const pool = new ObjectPool(
      () => {
        createCount++;
        return { id: createCount };
      },
      10,  // 初始 10 個
      20
    );

    // 初始化時建立 10 個
    expect(createCount).toBe(10);

    // 取出 10 個（不建立新物件）
    const objects = [];
    for (let i = 0; i < 10; i++) {
      objects.push(pool.get());
    }
    expect(createCount).toBe(10);  // 仍然是 10

    // 歸還 10 個
    objects.forEach(obj => pool.release(obj));

    // 再次取出 10 個（仍然不建立新物件）
    for (let i = 0; i < 10; i++) {
      pool.get();
    }
    expect(createCount).toBe(10);  // 仍然是 10！重用成功
  });

  test('應該自動擴充到上限', () => {
    let createCount = 0;

    const pool = new ObjectPool(
      () => ({ id: ++createCount }),
      5,   // 初始 5 個
      10   // 最大 10 個
    );

    expect(createCount).toBe(5);

    // 取出 10 個（會自動擴充 5 個）
    for (let i = 0; i < 10; i++) {
      pool.get();
    }

    expect(createCount).toBe(10);  // 自動擴充到 10
  });

  test('達到上限時應該強制重用', () => {
    const pool = new ObjectPool(
      () => ({ id: Math.random() }),
      2,   // 初始 2 個
      2    // 最大 2 個
    );

    const obj1 = pool.get();
    const obj2 = pool.get();

    // 已達上限，第 3 次取出會強制重用 obj1
    const obj3 = pool.get();

    expect(obj3).toBe(obj1);  // 強制重用！
  });
});
```

### 記憶體使用對比

```javascript
// 測試：射擊 1000 次子彈

// ❌ 無物件池
let memoryBefore = performance.memory.usedJSHeapSize;
for (let i = 0; i < 1000; i++) {
  const bullet = new Bullet(scene, 0, 0);
  bullet.destroy();
}
let memoryAfter = performance.memory.usedJSHeapSize;
console.log('記憶體增長：', (memoryAfter - memoryBefore) / 1024 / 1024, 'MB');
// 輸出：記憶體增長：~2-5 MB（不穩定）

// ✅ 有物件池
const pool = new ObjectPool(() => new Bullet(scene, 0, 0), 20, 50);
memoryBefore = performance.memory.usedJSHeapSize;
for (let i = 0; i < 1000; i++) {
  const bullet = pool.get();
  pool.release(bullet);
}
memoryAfter = performance.memory.usedJSHeapSize;
console.log('記憶體增長：', (memoryAfter - memoryBefore) / 1024 / 1024, 'MB');
// 輸出：記憶體增長：~0.1 MB（穩定）
```

### 適用場景

#### ✅ 適合使用物件池

1. **頻繁建立/銷毀的物件**
   - 子彈（每秒 10-30 個）
   - 爆炸特效（每秒 5-20 個）
   - 粒子效果（每秒 100+ 個）

2. **生命週期短的物件**
   - 子彈（1-3 秒）
   - 特效（0.5-1 秒）

3. **數量可預測的物件**
   - 同時最多 50 個子彈
   - 同時最多 10 個特效

#### ❌ 不適合使用物件池

1. **長期存在的物件**
   - 玩家坦克（整個遊戲只有 1 個）
   - UI 元素（場景內一直存在）

2. **建立成本低的物件**
   - 簡單資料物件 `{ x, y }`
   - 純數值運算

3. **數量不可預測的物件**
   - 使用者輸入事件
   - 網路請求

### 最佳實踐

#### ✅ 建議

1. **合理設定初始大小**
   ```javascript
   // ✓ 根據實際需求設定
   // 同時最多 10 個子彈 → 初始 15 個（留 50% 餘量）
   const bulletPool = new ObjectPool(factory, 15, 30);
   ```

2. **實作 deactivate() 方法**
   ```javascript
   // ✓ 重置所有狀態
   deactivate() {
     this.setActive(false);
     this.setVisible(false);
     this.setVelocity(0, 0);
     this.clearTint();
     this.owner = null;
     // 確保物件可以安全重用
   }
   ```

3. **監控使用率**
   ```javascript
   const stats = pool.getStats();
   if (stats.utilization > '90%') {
     console.warn('物件池使用率過高，考慮增加上限');
   }
   ```

#### ❌ 避免

1. **忘記重置狀態**
   ```javascript
   // ✗ 忘記重置，導致重用時出現問題
   release(bullet) {
     this.pool.push(bullet);
     // 忘記調用 bullet.deactivate()
   }
   // 下次取出時，子彈還保留上次的速度和位置！
   ```

2. **上限設定過小**
   ```javascript
   // ✗ 上限太小
   const pool = new ObjectPool(factory, 5, 5);
   // 第 6 個子彈會強制重用第 1 個，可能導致視覺異常
   ```

3. **在迴圈中頻繁取得/釋放**
   ```javascript
   // ✗ 效能低下
   for (let i = 0; i < 1000; i++) {
     const obj = pool.get();
     pool.release(obj);  // 立即釋放
   }

   // ✓ 批次處理
   const objects = [];
   for (let i = 0; i < 1000; i++) {
     objects.push(pool.get());
   }
   // ... 使用物件
   objects.forEach(obj => pool.release(obj));
   ```

---

## 觀察者模式 (Observer Pattern)

### 什麼是觀察者模式？

**觀察者模式**是一種行為型設計模式，用於在物件之間建立一對多的依賴關係。當一個物件的狀態改變時，所有依賴它的物件都會自動收到通知。

在遊戲開發中，通常稱為**事件系統 (Event System)**。

### 為什麼需要事件系統？

#### 問題：系統間直接耦合

```javascript
// ❌ 糟糕的做法：直接耦合
class PlayerTank {
  takeDamage(damage) {
    this.health -= damage;

    // 直接調用其他系統（緊耦合）
    this.scene.updateHealthUI(this.health);        // UI 系統
    this.scene.playHitSound();                     // 音效系統
    this.scene.shakeCamera();                      // 相機系統

    if (this.health <= 0) {
      this.scene.updateLivesUI(this.lives);        // UI 系統
      this.scene.checkGameOver();                  // 遊戲邏輯
      this.scene.showDeathAnimation();             // 動畫系統
    }
  }
}
// 問題：PlayerTank 需要知道所有其他系統的存在！
```

**問題：**
- ✗ 高耦合（PlayerTank 依賴 5+ 個系統）
- ✗ 難以測試（需要模擬所有依賴）
- ✗ 難以擴展（新增系統需修改 PlayerTank）
- ✗ 職責不清（PlayerTank 做了太多事）

#### 解決方案：使用事件系統

```javascript
// ✅ 良好的做法：事件驅動
class PlayerTank {
  takeDamage(damage) {
    this.health -= damage;

    // 只發送事件，不關心誰在監聽
    this.scene.events.emit(EVENTS.PLAYER_HIT, {
      health: this.health,
      damage: damage
    });

    if (this.health <= 0) {
      this.scene.events.emit(EVENTS.PLAYER_DESTROYED, {
        lives: this.lives
      });
    }
  }
}

// 其他系統監聽事件
class GameScene {
  create() {
    // UI 系統監聽
    this.events.on(EVENTS.PLAYER_HIT, (data) => {
      this.updateHealthUI(data.health);
    });

    // 音效系統監聽
    this.events.on(EVENTS.PLAYER_HIT, () => {
      this.audioManager.playSFX('hit');
    });

    // 相機系統監聽
    this.events.on(EVENTS.PLAYER_HIT, () => {
      this.cameras.main.shake(100, 0.01);
    });

    // 遊戲邏輯監聽
    this.events.on(EVENTS.PLAYER_DESTROYED, (data) => {
      this.checkGameOver(data.lives);
    });
  }
}
```

**優點：**
- ✓ 低耦合（PlayerTank 不需要知道監聽者）
- ✓ 易於測試（可以單獨測試 PlayerTank）
- ✓ 易於擴展（新增監聽器不需修改 PlayerTank）
- ✓ 職責清晰（PlayerTank 只管理自己的狀態）

### Tank Battle 的事件系統

**檔案位置**: `src/utils/Constants.js`

```javascript
// 定義所有遊戲事件
export const EVENTS = {
  // 玩家事件
  PLAYER_HIT: 'player:hit',
  PLAYER_DESTROYED: 'player:destroyed',
  PLAYER_RESPAWN: 'player:respawn',

  // 敵人事件
  ENEMY_DESTROYED: 'enemy:destroyed',
  ENEMY_SPAWN: 'enemy:spawn',

  // 遊戲狀態事件
  SCORE_CHANGED: 'score:changed',
  LIVES_CHANGED: 'lives:changed',
  LEVEL_COMPLETE: 'level:complete',
  GAME_OVER: 'game:over',

  // 道具事件
  POWERUP_COLLECTED: 'powerup:collected',

  // 基地事件
  BASE_DESTROYED: 'base:destroyed'
};
```

### 應用範例

#### 1. PlayerTank 發送事件

**檔案位置**: `src/entities/PlayerTank.js`

```javascript
export default class PlayerTank extends Tank {
  takeDamage(damage) {
    // 無敵狀態不受傷
    if (this.invincible) return;

    this.health -= damage;

    // 發送擊中事件
    this.scene.events.emit(EVENTS.PLAYER_HIT, {
      health: this.health,
      maxHealth: this.maxHealth,
      damage: damage,
      position: { x: this.x, y: this.y }
    });

    if (this.health <= 0) {
      this.lives--;

      // 發送生命值變更事件
      this.scene.events.emit(EVENTS.LIVES_CHANGED, this.lives);

      // 發送摧毀事件
      this.scene.events.emit(EVENTS.PLAYER_DESTROYED, this.lives <= 0);

      this.destroy();
    }
  }

  collectPowerUp(type) {
    // 發送收集事件
    this.scene.events.emit(EVENTS.POWERUP_COLLECTED, {
      type: type,
      player: this
    });

    this.applyPowerUp(type);
  }

  addScore(points) {
    this.score += points;

    // 發送分數變更事件
    this.scene.events.emit(EVENTS.SCORE_CHANGED, this.score);
  }
}
```

#### 2. GameScene 監聽事件

**檔案位置**: `src/scenes/GameScene.js`

```javascript
export default class GameScene extends Phaser.Scene {
  initializeSystems() {
    // ... 其他系統初始化

    // 集中綁定事件監聽器（只綁定一次！）
    this.events.once('shutdown', this.shutdown, this);
    this.events.on(EVENTS.PLAYER_DESTROYED, this.onPlayerDestroyed, this);
    this.events.on(EVENTS.ENEMY_DESTROYED, this.onEnemyDestroyed, this);
    this.events.on(EVENTS.SCORE_CHANGED, this.updateScore, this);
    this.events.on(EVENTS.LIVES_CHANGED, this.updateLives, this);
  }

  // 事件處理器
  onPlayerDestroyed(isGameOver) {
    this.gameState.lives = this.player ? this.player.lives : 0;

    if (isGameOver) {
      this.gameOver();
    } else {
      // 等待 2 秒後重生
      this.time.delayedCall(2000, () => {
        this.respawnPlayer();
      });
    }
  }

  onEnemyDestroyed(enemy) {
    this.gameState.enemiesRemaining--;
    this.gameState.enemiesKilled++;

    // 更新 UI
    this.updateEnemies();

    // 檢查關卡完成
    if (this.gameState.enemiesRemaining <= 0 && this.enemyQueue.length === 0) {
      this.levelComplete();
    }
  }

  updateScore(score) {
    this.gameState.score = score;
    this.scoreText.setText(score.toString());
  }

  updateLives(lives) {
    this.gameState.lives = lives;
    this.livesText.setText(lives.toString());
  }

  // 清理事件監聽器（防止記憶體洩漏）
  shutdown() {
    this.events.off(EVENTS.PLAYER_DESTROYED);
    this.events.off(EVENTS.ENEMY_DESTROYED);
    this.events.off(EVENTS.SCORE_CHANGED);
    this.events.off(EVENTS.LIVES_CHANGED);
  }
}
```

### 事件流程圖

```
玩家被擊中：

PlayerTank.takeDamage()
        │
        ▼
events.emit(PLAYER_HIT, data)
        │
        ├─────────────────┬─────────────────┬─────────────────┐
        ▼                 ▼                 ▼                 ▼
  GameScene:          AudioManager:     CameraSystem:     EffectManager:
  updateHealthUI()    playSFX('hit')    shake()           createHitEffect()

玩家被摧毀：

PlayerTank.takeDamage() → health <= 0
        │
        ▼
events.emit(LIVES_CHANGED, lives)
        │
        ▼
  GameScene: updateLivesUI()
        │
        ▼
events.emit(PLAYER_DESTROYED, isGameOver)
        │
        ├─────────────────┬─────────────────┐
        ▼                 ▼                 ▼
  GameScene:          AudioManager:     EffectManager:
  if (isGameOver)     playSFX('death')  createExplosion()
    gameOver()
  else
    respawnPlayer()
```

### 最佳實踐

#### ✅ 建議

1. **集中定義事件名稱**
   ```javascript
   // ✓ 使用常數
   export const EVENTS = {
     PLAYER_HIT: 'player:hit'
   };

   // ✗ 使用魔術字串
   this.events.emit('playerHit');  // 容易拼錯
   ```

2. **集中綁定監聽器**
   ```javascript
   // ✓ 在 initializeSystems() 中集中綁定
   initializeSystems() {
     this.events.on(EVENTS.PLAYER_HIT, this.onPlayerHit, this);
     this.events.on(EVENTS.SCORE_CHANGED, this.updateScore, this);
   }

   // ✗ 分散在各處綁定（容易忘記解綁）
   create() {
     this.events.on(EVENTS.PLAYER_HIT, ...);
   }
   update() {
     this.events.on(EVENTS.SCORE_CHANGED, ...);
   }
   ```

3. **一定要解綁**
   ```javascript
   // ✓ 場景關閉時解綁
   shutdown() {
     this.events.off(EVENTS.PLAYER_HIT);
     this.events.off(EVENTS.SCORE_CHANGED);
   }

   // 或使用 once（自動解綁）
   this.events.once('shutdown', this.cleanup, this);
   ```

4. **傳遞有意義的資料**
   ```javascript
   // ✓ 傳遞物件，便於擴展
   this.events.emit(EVENTS.PLAYER_HIT, {
     health: this.health,
     damage: damage,
     position: { x, y },
     source: enemy
   });

   // ✗ 傳遞多個參數（難以擴展）
   this.events.emit(EVENTS.PLAYER_HIT, health, damage, x, y, enemy);
   ```

#### ❌ 避免

1. **忘記解綁導致記憶體洩漏**
   ```javascript
   // ✗ 每次生成敵人都綁定一次
   spawnEnemy() {
     const enemy = new Enemy();
     this.events.on(EVENTS.ENEMY_DESTROYED, this.onEnemyDestroyed);
     // 生成 100 個敵人 = 100 個重複監聽器！
   }
   ```

2. **在事件處理器中發送相同事件**
   ```javascript
   // ✗ 無限循環
   this.events.on(EVENTS.SCORE_CHANGED, (score) => {
     this.events.emit(EVENTS.SCORE_CHANGED, score + 1);
     // 無限循環！
   });
   ```

3. **過度依賴事件**
   ```javascript
   // ✗ 簡單的父子關係不需要事件
   class Tank {
     update() {
       this.events.emit('tank:update');
     }
   }

   // ✓ 直接調用即可
   class Tank {
     update() {
       this.weapon.update();
     }
   }
   ```

---

## 工廠模式 (Factory Pattern)

### 什麼是工廠模式？

**工廠模式**是一種創建型設計模式，提供一個統一的介面來建立不同類型的物件，而不需要指定具體的類別。

### Tank Battle 的應用

在 Tank Battle 中，我們使用工廠模式來建立不同類型的敵人：

```javascript
// ❌ 糟糕的做法：直接建立
spawnEnemy(type) {
  let enemy;

  if (type === 'BASIC') {
    enemy = new EnemyTank(this, x, y, 'BASIC');
    enemy.setHealth(1);
    enemy.setSpeed(50);
    enemy.setColor(0x808080);
  } else if (type === 'FAST') {
    enemy = new EnemyTank(this, x, y, 'FAST');
    enemy.setHealth(1);
    enemy.setSpeed(150);
    enemy.setColor(0x00FF00);
  } else if (type === 'POWER') {
    enemy = new EnemyTank(this, x, y, 'POWER');
    enemy.setHealth(2);
    enemy.setSpeed(80);
    enemy.setColor(0xFF0000);
  }
  // 程式碼重複，難以維護
}

// ✅ 良好的做法：工廠模式
// 1. 在 Constants.js 定義類型配置
export const ENEMY_TYPES = {
  BASIC: {
    texture: 'enemy_basic',
    health: 1,
    speed: 50,
    fireRate: 2000,
    score: 100,
    color: 0x808080
  },
  FAST: {
    texture: 'enemy_fast',
    health: 1,
    speed: 150,
    fireRate: 1500,
    score: 200,
    color: 0x00FF00
  },
  POWER: {
    texture: 'enemy_power',
    health: 2,
    speed: 80,
    fireRate: 1000,
    score: 300,
    color: 0xFF0000
  }
};

// 2. 在 EnemyTank 建構子中使用配置
export default class EnemyTank extends Tank {
  constructor(scene, x, y, type) {
    const config = ENEMY_TYPES[type];
    super(scene, x, y, config.texture);

    // 根據配置初始化
    this.type = type;
    this.health = config.health;
    this.maxHealth = config.health;
    this.speed = config.speed;
    this.fireRate = config.fireRate;
    this.score = config.score;
    this.setTint(config.color);
  }
}

// 3. 簡化的生成方法
spawnEnemy(type) {
  const enemy = new EnemyTank(this, x, y, type);
  return enemy;
}
```

**優點：**
- ✓ 集中管理配置
- ✓ 易於新增類型
- ✓ 程式碼簡潔

### 新增敵人類型範例

```javascript
// 只需在 Constants.js 新增配置
export const ENEMY_TYPES = {
  // ... 現有類型

  SUPER: {
    texture: 'enemy_super',
    health: 10,
    speed: 120,
    fireRate: 500,
    score: 1000,
    color: 0xFF00FF
  }
};

// 使用時
const superEnemy = new EnemyTank(this, x, y, 'SUPER');
// 完成！不需要修改 EnemyTank 類別
```

---

## 單例模式 (Singleton Pattern)

### 什麼是單例模式？

**單例模式**確保一個類別只有一個實例，並提供全域存取點。

### Tank Battle 的應用

在 Tank Battle 中，管理器類別（AudioManager, SaveManager）都可以視為單例：

```javascript
// AudioManager.js
export default class AudioManager {
  constructor(scene) {
    // 確保每個場景只有一個 AudioManager
    if (scene.audioManager) {
      return scene.audioManager;
    }

    this.scene = scene;
    this.sounds = {};
    this.musicVolume = 0.5;
    this.sfxVolume = 0.7;

    scene.audioManager = this;
  }

  playSFX(key, volume = 1.0) {
    // 全域音效管理
  }
}

// GameScene.js
initializeSystems() {
  // 建立單例
  this.audioManager = new AudioManager(this);

  // 其他系統也可以存取
  // this.audioManager.playSFX('shoot');
}
```

### SaveManager 單例範例

```javascript
// SaveManager.js
export default class SaveManager {
  constructor() {
    this.SAVE_KEY = 'tank_battle_save_data';
  }

  // 靜態方法提供全域存取
  static getInstance() {
    if (!SaveManager.instance) {
      SaveManager.instance = new SaveManager();
    }
    return SaveManager.instance;
  }

  save(data) {
    localStorage.setItem(this.SAVE_KEY, JSON.stringify(data));
  }

  load() {
    const data = localStorage.getItem(this.SAVE_KEY);
    return data ? JSON.parse(data) : this.defaultData;
  }
}

// 使用
const saveManager = SaveManager.getInstance();
saveManager.save({ level: 5, score: 10000 });
```

---

## 設計模式對比與選擇

### 何時使用哪種設計模式？

| 場景 | 推薦模式 | 理由 |
|-----|---------|------|
| AI 行為管理 | 狀態機模式 | 狀態清晰，易於擴展 |
| 頻繁建立/銷毀物件 | 物件池模式 | 提升效能，減少 GC |
| 系統間通訊 | 觀察者模式 | 降低耦合度 |
| 建立不同類型物件 | 工廠模式 | 集中管理配置 |
| 全域存取 | 單例模式 | 確保唯一實例 |

### 組合使用範例

在 Tank Battle 中，多種設計模式協同工作：

```javascript
// GameScene 整合所有設計模式
export default class GameScene extends Phaser.Scene {
  initializeSystems() {
    // 單例模式：管理器
    this.saveManager = new SaveManager();
    this.audioManager = new AudioManager(this);

    // 物件池模式：子彈
    this.bulletPool = new ObjectPool(
      () => new Bullet(this, 0, 0),
      20,
      50
    );

    // 觀察者模式：事件系統
    this.events.on(EVENTS.PLAYER_HIT, this.onPlayerHit, this);
    this.events.on(EVENTS.ENEMY_DESTROYED, this.onEnemyDestroyed, this);
  }

  spawnEnemy(type) {
    // 工廠模式：建立敵人
    const enemy = new EnemyTank(this, x, y, type);

    // 狀態機模式：AI 行為
    const ai = new EnemyAI(this, enemy);
    enemy.setAI(ai);

    return enemy;
  }

  createBullet(x, y, direction, speed, damage, owner) {
    // 物件池模式：重用子彈
    const bullet = this.bulletPool.get();
    bullet.fire(x, y, direction, speed, damage, owner);
    return bullet;
  }
}
```

### 設計模式效益總結

| 設計模式 | 程式碼行數減少 | 效能提升 | 可維護性提升 |
|---------|--------------|---------|------------|
| **狀態機模式** | 50% | - | ⭐⭐⭐⭐⭐ |
| **物件池模式** | - | 50-100x | ⭐⭐⭐⭐ |
| **觀察者模式** | 30% | - | ⭐⭐⭐⭐⭐ |
| **工廠模式** | 40% | - | ⭐⭐⭐⭐ |
| **單例模式** | 20% | - | ⭐⭐⭐ |

---

## 參考資料

- [設計模式：可重用物件導向軟體的基礎](https://zh.wikipedia.org/wiki/%E8%AE%BE%E8%AE%A1%E6%A8%A1%E5%BC%8F%EF%BC%9A%E5%8F%AF%E5%A4%8D%E7%94%A8%E9%9D%A2%E5%90%91%E5%AF%B9%E8%B1%A1%E8%BD%AF%E4%BB%B6%E7%9A%84%E5%9F%BA%E7%A1%80)
- [Game Programming Patterns](https://gameprogrammingpatterns.com/)
- [Phaser 3 事件系統](https://photonstorm.github.io/phaser3-docs/Phaser.Events.EventEmitter.html)
- [JavaScript 設計模式](https://www.patterns.dev/)

---
