# 進階 AI 系統

> 敵人坦克的智能行為系統詳解

## 概述

本遊戲的敵人 AI 系統實現了多種進階功能，讓敵人行為更加智能和有挑戰性：

- **預測射擊** - 預判玩家移動方向，提前射擊
- **視線檢測** - 判斷是否能直接看到目標
- **智能巡邏** - 有目的地巡邏而非隨機漫步
- **包抄戰術** - 多個敵人協調包抄玩家
- **團隊協作** - 透過 Blackboard 架構共享資訊

## 系統架構

```
┌─────────────────────────────────────────────────────────────┐
│                      GameScene                               │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    AIBlackboard                          ││
│  │  - 玩家位置/速度資訊                                      ││
│  │  - 目標分配管理                                          ││
│  │  - 包抄位置協調                                          ││
│  │  - 巡邏點系統                                            ││
│  │  - 威脅評估                                              ││
│  └─────────────────────────────────────────────────────────┘│
│                           ↑↓                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                   │
│  │ EnemyAI  │  │ EnemyAI  │  │ EnemyAI  │  ...              │
│  │  - 狀態機 │  │  - 狀態機 │  │  - 狀態機 │                   │
│  │  - 尋路   │  │  - 尋路   │  │  - 尋路   │                   │
│  │  - 射擊   │  │  - 射擊   │  │  - 射擊   │                   │
│  └──────────┘  └──────────┘  └──────────┘                   │
└─────────────────────────────────────────────────────────────┘
```

## 功能詳解

### 1. 預測射擊

敵人會根據玩家的移動速度，預測玩家在未來 0.3 秒後的位置，並提前瞄準該位置射擊。

```javascript
// 預測玩家位置
_predictTargetPosition(target, predictionTime = 0.3) {
  const vx = target.body.velocity.x;
  const vy = target.body.velocity.y;

  return {
    x: target.x + vx * predictionTime,
    y: target.y + vy * predictionTime
  };
}
```

**效果**：玩家無法透過簡單的直線移動躲避子彈

### 2. 視線檢測 (Line of Sight)

使用 Bresenham 直線演算法檢測敵人與玩家之間是否有障礙物阻擋。

```javascript
// 檢查視線
_checkLineOfSight(from, to) {
  // 使用 Bresenham 演算法遍歷路徑上的每個格子
  // 如果遇到牆壁 (BRICK/STEEL)，則視線被阻擋
}
```

**效果**：
- 敵人在巡邏時如果「看到」玩家，會立即開火
- 避免敵人對著牆壁射擊

### 3. 智能巡邏

敵人不再隨機漫步，而是依序走訪預定義的巡邏點，覆蓋地圖的關鍵區域。

**巡邏點分布**：
```
    ●─────────●─────────●
    │         │         │
    │    ●────●────●    │
    │    │         │    │
    ●────●────●────●────●
    │    │         │    │
    │    ●────●────●    │
    │         │         │
    ●─────────●─────────●
```

**效果**：
- 敵人會有目的地移動
- 更好的地圖覆蓋率
- 減少玩家「安全角落」

### 4. 包抄戰術

當多個敵人同時追逐玩家時，會協調分配包抄位置，從玩家的側翼或背後攻擊。

**包抄位置優先級**（以玩家面向上方為例）：
1. 下方（背後）- 最高優先
2. 左側
3. 右側
4. 上方（正面）- 最低優先

```javascript
// 優先級排序
_prioritizeFlankingPositions(positions, playerDirection) {
  const priorityMap = {
    'up': ['bottom', 'left', 'right', 'top'],
    'down': ['top', 'left', 'right', 'bottom'],
    // ...
  };
}
```

**效果**：
- 敵人會嘗試從玩家的盲區攻擊
- 最多 2 個敵人同時包抄，避免扎堆

### 5. 團隊協作 (Blackboard 架構)

所有敵人透過共享的「黑板」(Blackboard) 交換資訊：

| 資訊類型 | 說明 |
|---------|------|
| `playerLastKnownPosition` | 玩家最後已知位置 |
| `playerVelocity` | 玩家速度向量 |
| `assignedTargets` | 目標分配（玩家 / 基地） |
| `flankingPositions` | 各敵人的包抄位置 |
| `enemyPositions` | 敵人位置（避免碰撞） |
| `attackingEnemies` | 正在攻擊的敵人集合 |

**效果**：
- 避免所有敵人都攻擊同一目標
- 敵人之間保持最小間距，不會扎堆
- 協調包抄行動

## 配置參數

所有 AI 參數都可以在 `src/utils/Constants.js` 中調整：

```javascript
export const AI_CONFIG = {
  // 預測射擊
  PREDICTION_TIME: 0.3,         // 預測時間（秒）
  PREDICTION_ENABLED: true,

  // 視線檢測
  LINE_OF_SIGHT_ENABLED: true,
  LOS_CHECK_INTERVAL: 200,      // 檢測間隔（ms）

  // 智能巡邏
  SMART_PATROL_ENABLED: true,
  PATROL_POINT_REACH_DIST: 40,

  // 包抄戰術
  FLANKING_ENABLED: true,
  FLANKING_DISTANCE: 120,
  MAX_FLANKING_ENEMIES: 2,

  // 團隊協作
  TEAM_COORDINATION_ENABLED: true,
  MIN_ENEMY_SPACING: 60
};
```

## 移動控制架構：「目標方向」模式

為了解決敵人坦克卡牆和抖動問題，AI 採用「目標方向」(Desired Direction) 模式：

### 核心原理

```javascript
// ❌ 舊架構：多處呼叫 move() → 方向衝突 → 抖動
stateMachine.update() → tank.move(direction1)
onWallHit()          → tank.move(direction2)  // 衝突！
checkIfStuck()       → tank.move(direction3)  // 衝突！

// ✅ 新架構：設定目標方向 → 統一執行
_updateDesiredDirection()  → this.desiredDirection = 'up'
onWallHit()                → this.desiredDirection = 'left'
checkIfStuck()             → this.desiredDirection = 'right'

update() {
  // 只在這裡呼叫一次 move()
  this.tank.move(this.desiredDirection);
}
```

### 方向變更冷卻

為了避免快速切換方向造成抖動，所有方向變更都有 **500ms 冷卻時間**：

```javascript
// 500ms 內不允許再次改變方向
if (currentTime - this.lastDirectionChange < 500) {
  return; // 維持當前方向
}
```

### 統一的 update 流程

```javascript
update(delta) {
  // 1. 根據狀態決定目標方向（不直接移動）
  this._updateDesiredDirection(currentTime);

  // 2. 定期隨機換方向（增加不可預測性）
  if (shouldRandomChange) {
    this._setRandomDirection();
  }

  // 3. 檢測卡住（設定方向，不直接移動）
  this._checkIfStuck();

  // 4. 統一移動：只在這裡呼叫一次 move()
  this.tank.move(this.desiredDirection);

  // 5. 嘗試射擊
  this._tryShoot();
}
```

### 滯後效應 (Hysteresis)

方向選擇使用 **1.2x 滯後閾值** 避免在對角線上抖動：

```javascript
// 只有當 dx 明顯大於 dy 時才選擇水平移動
if (Math.abs(dx) > Math.abs(dy) * 1.2) {
  newDir = dx > 0 ? 'right' : 'left';
} else if (Math.abs(dy) > Math.abs(dx) * 1.2) {
  newDir = dy > 0 ? 'down' : 'up';
} else {
  // 差異不大，維持當前方向
  return;
}
```

**效果**：
- ✅ 消除抖動問題
- ✅ 方向變更更自然
- ✅ 減少卡牆情況

## 狀態機

AI 行為由 4 種狀態組成：

```
         ┌─────────────────────────────────┐
         │            patrol               │
         │  - 智能巡邏                      │
         │  - 視線內看到玩家會射擊          │
         └──────────────┬──────────────────┘
                        │ 發現目標
                        ↓
         ┌─────────────────────────────────┐
         │            chase                │
         │  - 追逐目標（可能包抄）          │
         │  - 使用預測射擊                  │
         └──────────────┬──────────────────┘
                        │ 進入攻擊範圍
                        ↓
         ┌─────────────────────────────────┐
         │            attack               │
         │  - 對齊目標                      │
         │  - 預測射擊                      │
         │  - 保持距離                      │
         └──────────────┬──────────────────┘
                        │ 血量 < 30%
                        ↓
         ┌─────────────────────────────────┐
         │           retreat               │
         │  - 遠離玩家                      │
         │  - 邊撤退邊射擊                  │
         └─────────────────────────────────┘
```

## 測試

AI 系統包含完整的單元測試：

```bash
# 執行 AI 相關測試
npm test -- --testPathPattern="(AIBlackboard|EnemyAI)"
```

測試覆蓋：
- AIBlackboard：19 個測試
- EnemyAI 進階功能：26 個測試

## 檔案結構

```
src/
├── systems/
│   ├── EnemyAI.js        # 敵人 AI 控制器
│   └── AIBlackboard.js   # 團隊協作黑板
├── utils/
│   └── Constants.js      # AI 配置參數
tests/
└── unit/
    ├── EnemyAI.test.js
    └── AIBlackboard.test.js
```

## 參考資料

- [AI Blackboard Architecture for Tactical Game AI](https://tonogameconsultants.com/ai-blackboard/)
- [Squad Coordination in Days Gone (Game AI Pro)](http://www.gameaipro.com/GameAIProOnlineEdition2021/GameAIProOnlineEdition2021_Chapter12_Squad_Coordination_in_Days_Gone.pdf)
- [Behavior Trees for AI: How They Work](https://www.gamedeveloper.com/programming/behavior-trees-for-ai-how-they-work)
